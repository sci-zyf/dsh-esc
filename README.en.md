# dsh-esc

[中文](README.md)

DSH web plugin: press **Esc** during generation to interrupt the running answer — exactly the same effect as clicking the "Stop generating" button in the input bar. It uses the same official session-cancel path, touches no model context, and does not alter session history.

## Usage

While an answer is being generated, press Esc once to interrupt it — no need to reach for the stop button.

Behavior boundaries (nothing else is affected):

- **Window not focused** → no key events reach the page, nothing happens.
- **No current session, or the current session is idle** → nothing happens.
- **Focus is inside another editable control** (Better Sidebar input, settings search, any `input`/`textarea`/contenteditable not owned by the main composer) → Esc is left alone; the main session is untouched.
- **A menu/popover is open** (command menu, dropdown, modal dialog, etc.) → Esc still closes that overlay; the plugin stands aside.
- **Esc pressed during IME composition** → released, keeping the cancel-composition behavior.
- **Focus is in the main composer or on blank page area, and the current session is generating** → interrupted, equivalent to clicking Stop.

## Install

Prerequisites:

- dsh CLI installed globally: `npm install -g @deepseek-ai/dsh`
- A web profile exists: `dsh profile list` should include `web`

Install from a GitHub repository (fill in the repo URL once created):

```bash
dsh plugin --profile web add <your-github-repo-url>
```

Restart DSH after install (or it applies live with profile `patchReload: live`). Uninstall:

```bash
dsh plugin --profile web remove dsh-esc
```

Verify: restart, start a generation, press Esc anywhere on blank page area (or in the composer) — the answer should stop immediately.

## How it works

- `client.js`: the browser-side core. Registers a `keydown` listener on `document`; only when the boundary conditions above hold, it resolves the current session through the official `sessions` service and calls `session.cancel()` — the same call behind the Stop button.
- `lib/index.js`: host half, a mount-only entry with no dependencies.
- The interruptible condition (session running and continuable) matches when the Stop button is shown; uncancellable cases return an error on the host side and are silently ignored, matching a Stop-button click.

## Host adaptation

- Built for the DSH 0.1.2-rc line (web profile); may need small adjustments as DSH evolves.
- Pure UI plugin: imports no `@deepseek-ai` internal package, declares no peerDependencies. It relies on keyboard events and the stable public `sessions` service; verify against the running host version.
- Modifies no DSH built-in modules; mounted via `cordis.patch.yml`, removable at any time.
