# dsh-esc

[English](README.en.md)

DSH Web 插件：生成过程中按 **Esc** 立即中断当前回答，效果与点击输入栏的「停止生成」按钮完全一致——走同一条官方会话取消链路，不消耗模型上下文，不改变会话历史。

## 使用

回答还在生成时，直接按一次 Esc 即可中断，无需再用鼠标找停止按钮。

行为边界（保证不误伤）：

- **窗口未激活或无键盘焦点** → 页面收不到按键，插件不触发。
- **无当前会话，或当前会话空闲** → 不触发。
- **焦点在其它输入控件里**（Better Sidebar 输入框、设置搜索框、任何 `input`/`textarea`/可编辑区，且不属于主 composer）→ 放行，不触碰主会话。
- **有已打开的菜单/弹层**（命令菜单、下拉、模态对话框等）→ 放行，Esc 仍用于关闭这些浮层。
- **输入法组合中按 Esc** → 放行，保留取消组合的原有行为。
- **焦点在主 composer 或页面空白区域，且当前会话正在生成** → 中断，等价点击停止按钮。

## 安装

前置条件：

- 已全局安装 dsh CLI：`npm install -g @deepseek-ai/dsh`
- 已存在 web profile：`dsh profile list` 中应包含 `web`

从 GitHub 仓库安装（仓库地址创建后填入）：

```bash
dsh plugin --profile web add <your-github-repo-url>
```

安装后重启 DSH（或 profile `patchReload: live` 时自动生效）。卸载：

```bash
dsh plugin --profile web remove dsh-esc
```

验证安装：重启后让 DSH 开始生成回答，在页面任意空白处（或输入栏）按 Esc，回答应立即中断。

## 原理

- `client.js`：浏览器端核心。给 `document` 注册捕获式 `keydown` 监听，仅在满足前述边界条件时，经官方 `sessions` 服务找到当前会话，调用与停止按钮同源的 `session.cancel()`。
- `lib/index.js`：宿主半边，仅作为插件行装载入口，无依赖。
- ESC 的触发条件（可中断 = 会话 running 且可继续）与输入栏停止按钮的可见条件对齐；不可中断情形下 host 侧返回错误被静默忽略，与点击停止按钮一致。

## 宿主适配

- 适配 DSH 0.1.2-rc 系列（web profile），随 DSH 界面演进可能需调整。
- 纯 UI 插件：不直接 import 任何 `@deepseek-ai` 内部包，不声明 peerDependencies。依赖的键盘事件与公开会话服务面（`sessions`）为稳定接口，宿主升级时以实际运行验证为准。
- 不修改任何 DSH 内置模块；通过 `cordis.patch.yml` 装载，可随时卸载。
