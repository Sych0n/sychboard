# sychboard-mcp

Phase 1 of turning SychBoard into a personal AI OS: a minimal local MCP
(Model Context Protocol) server, stdio transport, **read-only tools only**.
Any MCP-compatible client (Claude Code today, SychBoard's own AI Assistant
panel next) can connect and call these tools.

## Tools

| Tool | What it does | How |
|---|---|---|
| `get_chuck_bird_status` | Chuck Bird bot health: systemd state, uptime, cog count | Read-only SSH to the prod box (`systemctl is-active` + `journalctl` grep — the bot has no HTTP health endpoint yet) |
| `get_system_status` | CPU / RAM / disk usage of this machine | `os` module + one `Get-CimInstance` PowerShell query |
| `list_recent_project_files` | Most recently modified files under a path | Filesystem walk; names/mtimes/sizes only, never contents; path must be inside the home dir |

## Permissions

`permissions.json` has one entry per tool:

- a tool with **no entry** or an unrecognized mode (e.g. `"deny"`) is refused
  **server-side** — it errors instead of running.
- `"confirm"` vs `"auto"` is the client's job: Claude Code prompts before
  unapproved tools by default, and the in-app assistant will read this same
  file once it's wired up. Everything starts on `"confirm"`; loosen
  per-tool once proven reliable.

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

Write/destructive tools, multi-model routing, video pipeline, smart home,
habit-learning. Read-only first, always.

## Next step

Wire this server into SychBoard's in-app "AI Assistant" panel as an MCP
client — that's the moment the chat box becomes the orchestrator.
