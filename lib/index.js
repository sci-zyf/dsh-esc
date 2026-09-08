// dsh-esc — host half.
//
// ESC 中断发生在浏览器 DOM（keydown），因此全部逻辑在 client 半边（client.js）。
// host 半边只作为插件行的装载入口存在：cordis 需要一个可 apply 的模块才能把
// 该行挂进 profile loader。这里不依赖任何 @deepseek-ai 包，避免装配差异崩溃。

/** Cordis 插件名（loader 诊断）。 */
export const name = 'dsh-esc'

/**
 * Host apply：无操作占位。
 *
 * 行为说明见 README；浏览器半边经 package.json `dsh.client.platform: "web"`
 * 与 `exports["./client"]` 由 web 装配自动发现并加载。
 *
 * @param ctx - host context（本插件不使用）。
 */
export function apply(_ctx) {
  // 空实现：ESC 中断的键盘监听在 client.js 中注册。
}
