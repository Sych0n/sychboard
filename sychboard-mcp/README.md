# sychboard-mcp

Turning SychBoard into a personal AI OS: a minimal local MCP
(Model Context Protocol) server, stdio transport. Started as Phase 1
read-only tools; now also has three confirm-gated write/action tools
(restart, git commit, git push) added once the server-side permission
enforcement below was in place. Any MCP-compatible client (Claude Code
today, SychBoard's own AI Assistant panel) can connect and call these tools.

## Tools

| Tool | What it does | How |
|---|---|---|
| `get_chuck_bird_status` | Chuck Bird bot health: systemd state, uptime, cog count | Read-only SSH to the prod box (`systemctl is-active` + `journalctl` grep — the bot has no HTTP health endpoint yet) |
| `get_system_status` | CPU / RAM / disk usage of this machine | `os` module + one `Get-CimInstance` PowerShell query |
| `list_recent_project_files` | Most recently modified files under a path | Filesystem walk; names/mtimes/sizes only, never contents; path must be inside the home dir |
| `restart_chuck_bird` | **WRITE.** Restarts the live production Chuck Bird bot, briefly interrupting connected players | `sudo systemctl restart chuckbird` over SSH on the prod box — no other command, no other access |
| `git_diff` | Stages all changes and returns the diff | Scoped to the sychboard/chuck-bird repos only, no free-text path input |
| `git_commit` | **WRITE.** Commits staged changes | Scoped to sychboard/chuck-bird only; approved via a custom native dialog (`commit-dialog.ps1`) showing the real diff and an editable AI-drafted message; never `--amend`, never rewrites history |
| `git_push` | **WRITE.** Pushes the current branch to `origin` | Scoped to sychboard/chuck-bird only; never `--force`, never deletes branches; refuses `main`/`master` unless the caller explicitly names that exact branch and it matches the actual current branch |

## Permissions

`permissions.json` has one entry per tool:

- a tool with **no entry** or an unrecognized mode (e.g. `"deny"`) is refused
  **server-side** — it errors instead of running.
- `"confirm"` mode is enforced by the **server itself**, not the connecting
  client: `confirmPermission()`/`confirmCommitMessage()` in `server.js` use
  MCP elicitation when the client supports it, falling back to a native OS
  confirm dialog the server process spawns directly — so a compromised or
  script-driven client can't skip approval by claiming a call is
  pre-approved. `"auto"` mode is pre-approved with no prompt. Everything
  currently ships on `"confirm"`; loosen per-tool only once proven reliable.

## Setup

```
cd sychboard-mcp
npm install
```

Register with Claude Code (from anywhere):

```
claude mcp add sychboard-mcp -- node C:\Users\danie\Downloads\sychboard-electron\sychboard-electron\sychboard-mcp\server.js
```

`get_chuck_bird_status` needs the same SSH key access as the deploy script
(`opc@152.67.159.196`). Override the host with the `CHUCKBIRD_SSH_HOST` env
var if it ever moves.

## Explicitly out of scope (Phase 2+)

`restart_chuck_bird`/`git_commit`/`git_push` above are now in scope
(confirm-gated write tools, added once server-side enforcement existed).
Still out of scope: multi-model routing, video pipeline, smart home,
habit-learning.

## In-app integration (done)

SychBoard's own AI Assistant panel is an MCP client of this server:

- `mcp-client.js` (repo root) — dependency-free stdio JSON-RPC client in the
  Electron **main process**; spawns `server.js` with `ELECTRON_RUN_AS_NODE`
  (works in packaged builds, no system Node needed), lazily on first use.
- Permission enforcement happens in the main process on **every** call:
  no `permissions.json` entry → refused; `confirm` without an explicit
  user approval → refused. The renderer can't bypass it.
- The chat panel (`src/renderer.js`) passes the tools to Groq
  (llama-3.3-70b tool-calling); `confirm`-mode tools show an in-chat
  Allow/Deny prompt before running. Flip a tool to `"auto"` in
  permissions.json to skip the prompt.
