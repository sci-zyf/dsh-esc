// dsh-esc — client (web) half.
//
// 浏览器端捕获 Escape 键：当且仅当「当前激活会话正在生成且可中断」时，触发与
// 输入栏停止按钮相同的会话取消，其余场景一律放行，不改变任何既有 ESC 行为。
//
// 触发条件（全部满足才生效）：
//   1. 按键为 Escape，且非输入法组合中、非自动重复、未被其它处理器消费。
//   2. 没有已打开的菜单/弹层需要消费 ESC（命令菜单、下拉、模态等）。
//   3. 焦点不在「其它插件/页面的输入控件」里（input/textarea/contenteditable
//      且不属于主 composer），避免误伤 Better Sidebar 等输入框。
//   4. 存在当前会话，且其运行状态为 running。
//
// Bundle 格式遵循 DSH client 模块系统：window.__ModuleLoader__.load({id, factory})。
// 纯浏览器 bundle：仅在 window 存在时注册。host（Node）进程若误导入本文件
// 应静默跳过，而不是抛 ReferenceError 拖垮整个插件树。
if (typeof window !== "undefined" && window.__ModuleLoader__) {
window.__ModuleLoader__.load({
	id: "dsh-esc",
	factory: (require) => {
		"use strict";
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// ---- Cordis 插件入口 ----
		// 宿主加载行（cordis.patch.yml）注入 host 半边；client 半边由 web 模块系统
		// 通过 package.json 的 dsh.client.platform + exports["./client"] 发现并执行。
		exports.name = "dsh-esc";

		// 只依赖官方公开的 sessions 会话服务（rewind / better-sidebar 均经此面访问）。
		exports.inject = ["sessions"];

		/** 主 composer 输入区标记（官方渲染编辑器时写入）。 */
		var COMPOSER_INPUT_SELECTOR = "[data-composer-input], [data-composer-card]";

		/**
		 * 元素是否可见（排除 display:none / 未挂载的占位）。
		 */
		function isVisible(element) {
			if (!element || !(element instanceof HTMLElement)) return false;
			if (element.closest("body") === null) return false;
			return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length > 0);
		}

		/**
		 * 是否有已打开、应由 ESC 关闭的官方浮层（命令菜单 / 下拉 / 模态）。
		 * 这些组件各自注册 Escape 关闭逻辑；存在时本插件放行，避免抢按键。
		 */
		function hasOpenOverlayConsumingEscape() {
			var selectors = [
				'[role="dialog"]', // 模态对话框
				'[role="menu"]', // 下拉菜单
				'[role="listbox"]', // 命令/引用列表
				"[data-trigger-menu]" // 输入触发器（/ 命令等）菜单
			];
			for (var i = 0; i < selectors.length; i += 1) {
				var nodes = document.querySelectorAll(selectors[i]);
				for (var j = 0; j < nodes.length; j += 1) {
					if (isVisible(nodes[j])) return true;
				}
			}
			return false;
		}

		/**
		 * 焦点是否落在「主 composer 输入区」内。
		 */
		function focusInComposer(element) {
			return !!element && typeof element.closest === "function" && !!element.closest(COMPOSER_INPUT_SELECTOR);
		}

		/**
		 * 焦点是否落在其它输入控件（input / textarea / contenteditable）——
		 * Better Sidebar 输入框、设置搜索框等均在此列，一律放行不抢 ESC。
		 */
		function focusInForeignEditable(element) {
			if (!element) return false;
			if (focusInComposer(element)) return false;
			if (typeof element.closest === "function") {
				var editable = element.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]');
				if (editable) return true;
			}
			var tag = element.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return true;
			if (element.isContentEditable) return true;
			return false;
		}

		/**
		 * 判定当前是否有「正在生成」的会话并返回其 id。
		 * running 状态读取自官方 sessions 服务的 list 快照（与界面行一致）。
		 */
		function runningSessionId(ctx) {
			var sessions = ctx.sessions;
			if (!sessions) return undefined;
			var list = sessions.list && typeof sessions.list.getSnapshot === "function" ? sessions.list.getSnapshot() : undefined;
			if (!list) return undefined;
			var current = list.current;
			if (current === undefined) return undefined;
			var row = list.byId ? list.byId[current] : undefined;
			if (!row || row.running !== true) return undefined;
			return current;
		}

		/**
		 * 与输入栏「停止生成」同源的取消：对当前会话调用 session.cancel()。
		 * 不可取消（如子代理激活不可中断）时 host 侧返回错误，这里静默忽略——
		 * 与 UI 停止按钮点击失败的行为一致，不产生噪音。
		 */
		function interruptCurrentSession(ctx, sessionId) {
			var sessions = ctx.sessions;
			if (!sessions) return;
			var binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : undefined;
			var session = binding && binding.session;
			if (!session || typeof session.cancel !== "function") return;
			var outcome = session.cancel();
			if (outcome && typeof outcome.catch === "function") outcome.catch(function () {});
		}

		/**
		 * 浏览器端 apply：注册文档级 keydown 监听并随生命周期清理。
		 */
		exports.apply = function (ctx) {
			try {
				ctx.effect(function* () {
					var onKeyDown = function (event) {
						// 1. 仅处理裸 Escape。
						if (event.key !== "Escape") return;
						if (event.repeat) return; // 长按重复不重复触发
						if (event.isComposing) return; // 输入法组合中按 ESC = 取消组合
						if (event.defaultPrevented) return; // 已由更贴近的处理器消费

						// 2. 官方浮层打开时放行，让它们自己关闭。
						if (hasOpenOverlayConsumingEscape()) return;

						// 3. 焦点在其它输入控件内时放行（避免误伤 Better Sidebar 等）。
						var active = document.activeElement;
						if (focusInForeignEditable(active)) return;

						// 4. 存在运行中的当前会话才中断。
						var sessionId = runningSessionId(ctx);
						if (sessionId === undefined) return;

						event.preventDefault();
						event.stopPropagation();
						interruptCurrentSession(ctx, sessionId);
					};

					document.addEventListener("keydown", onKeyDown, false);
					yield function () {
						document.removeEventListener("keydown", onKeyDown, false);
					};
				}, "dsh-esc: Escape interrupts the running turn");
			} catch (error) {
				// sessions 服务缺失或上下文差异时静默降级，不拖垮其它插件。
				if (typeof console !== "undefined" && console.warn) {
					console.warn("[dsh-esc] apply skipped:", error && error.message ? error.message : String(error));
				}
			}
		};

		return module.exports;
	}
});
}
