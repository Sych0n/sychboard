# SychBoard handoff for the next Claude chat / routine

Written 2026-10-23 by the Claude chat that built the Gaming tab. Read this whole file first, then `ROADMAP.md`.
Daniel is away for stretches: anything that needs his judgment goes in **Needs Daniel** below, not into code.

## 1. Hard rules (non-negotiable)
1. **Never push or merge to `main`.** `.github/workflows/release.yml` runs on every push to `main`, bumps the version, builds and auto-updates the app installed on Daniel's PC. Merging `game-rebuild` into `main` is Daniel's deliberate "ship it" decision.
2. **Only work on `game-rebuild`** (or a branch cut from it). Do **not** touch `feature/home-tab` / `C:\Users\danie\Dev\sychboard-home`: another chat owns the Smart Home tab.
3. **Do not push at all unless Daniel has said so** (see section 6: pushing `game-rebuild` is a decision he has not made yet).
4. **No secrets** in code, notes, commits or logs: no tokens, API keys, passwords, recovery codes, SSH keys. Don't open files that look like secrets.
5. **Gaming tab hard rules** (from `GAMING_TAB_PLAN.md`): nothing that reads/writes game memory, injects into a game, draws an overlay, or automates input (Valorant's Vanguard must never have a reason to care). System checks are **read-only**. Do not change Windows / driver / monitor / mouse settings; Daniel does that himself. No copying GPL code.
6. Don't commit or discard the 9 **pre-existing uncommitted changes** in the working tree (`.gitignore`, `netlify.toml`, deleted `netlify/edge-functions/inject-env.js`, deleted `.netlify/*`). They look like the start of the Netlify key-leak fix (see Needs Daniel #1). Commit with `git commit -o <paths>` so they are never swept in.
7. Commit style: short lowercase messages, **no Co-Authored-By**. New files need `git add -N <file>` before `git commit -o`.
8. One focused item per run. Gate every commit on tests: `npm test && git commit ...` (use `&&`, never `;`).

## 2. Repo map and state
- Dev copy: `C:\Users\danie\Downloads\sychboard-electron\sychboard-electron` (NOT the stale clone in `C:\Users\danie\Archive\Desktop\sychboard`). Remote: `https://github.com/Sych0n/sychboard`.
- Branch `game-rebuild` = the real app (SQLite, gamification, Gaming tab, Obsidian export, MCP/AI assistant). Local head `adf4cb6` is **18 commits ahead of `origin/game-rebuild`** (`b1ef7ce`, an old "130th pass" docs commit) and **189 ahead of `main`**; `main` has 1 commit that `game-rebuild` lacks (`chore: bump version to 1.0.17`; `package.json` here says 1.0.16, expect a conflict on merge).
- `npm test` = `node --test "src/gaming/*.test.js" "src/obsidian/*.test.js"` -> **114 tests, all passing**. Tests use Node's built-in `node:sqlite` (better-sqlite3 in `src/db.js` is built for Electron's ABI and cannot load in plain Node). Needs Node 24 (local is v24.15.0).
- Packaging: `package.json` `build.files` includes `src/**/*`, so `src/gaming/` and `src/obsidian/` ship; `healthcheck.ps1` is read through Electron's asar-aware `fs` and sent to PowerShell as `-EncodedCommand`, so it should need no unpacking (not yet verified in an actual packaged build: do `npm run build` locally once before any release).
- Core files: `main.js` (IPC; registers gaming + obsidian IPC), `preload.js` (`window.sychboard.*`), `src/db.js` (migrations 1-7 + appends gaming migrations 8-13 from `src/gaming/schema.js`), `src/renderer.js` (shared UI; keep gaming code OUT of it), `src/index.html`, `src/sw.js` (cache list: add new script files and bump `CACHE`).

### Gaming module (`src/gaming/`) and Obsidian export (`src/obsidian/`)
| Feature | Files |
|---|---|
| Tab shell, card registry | `gaming-ui.js`, `gaming.css` (scoped under `#page-gaming`; the global `styles.css` already owns `.gm-badge`, don't reuse that name) |
| Sens converter | `sens.js`, `gaming-sens-ui.js` |
| Session tracker, aim scores, charts | `stats.js`, `gaming-sessions-ui.js`, `gaming-charts.js` |
| Health check (read-only, 13 rows) | `healthcheck.ps1` (collector), `healthcheck.js` (evaluate), `gaming-health-ui.js` |
| PresentMon capture + metrics | `presentmon.js`, `framemetrics.js`, `presentpath.js` (Independent Flip vs composed, latency), `gaming-capture-ui.js` |
| Change Journal | `store.js` (`addChange` ...), `gaming-changes-ui.js` |
| Storage, IPC, backup | `schema.js`, `store.js`, `ipc.js`, `backup.js` |
| Obsidian one-way export | `src/obsidian/export.js` (pure), `vault.js` (safe writes), `ipc.js`, `obsidian-ui.js` |

Invariants worth keeping: migrations are append-only (never edit a shipped one; next version is **14**); machine-specific settings (`gaming_presentmon_path`, `obsidian_vault_path`) are never exported, restored or writable through generic `settings:set`; the renderer can never supply a path to execute or write (native dialogs only); the Obsidian export only overwrites files whose frontmatter says `source: sychboard` and never deletes; gaming rows for the export are read in the main process, never accepted from the renderer.

## 3. Environment limits
- **Cloud routine** (claude.ai/code/routines): clones from GitHub, so it only sees what has been **pushed**. It has no display, cannot run Electron, cannot load better-sqlite3, has no Windows, no PowerShell health check, no PresentMon. It can: edit code, run `npm test`, `node --check`.
- **Local Claude Code chat on Daniel's PC**: can additionally launch the real app (see "Electron smoke test" below), run the health check, read his config files, and read/write the Obsidian vault at `C:\Users\danie\Documents\ObsidianVault` (start at `Home.md`).
- Electron smoke test (worked 2026-10-23): small Electron script that sets `app.setPath('userData', <temp dir>)` BEFORE `require('<repo>/main.js')`, waits for the `index.html` window, then `executeJavaScript` against it. A fresh profile shows the welcome overlay: run `st.userName='x'; obFinish()`, set `#app` style opacity to 1 before `capturePage`. Always use a throwaway `userData` so Daniel's real database is never touched.

## 4. Needs Daniel (do NOT do these; log questions here, don't guess)
1. **Netlify key exposure (CRITICAL, in ROADMAP.md).** The `inject-env` edge function on `main` puts API keys in every page. Only Daniel can check whether the Netlify site is public and rotate the Groq / YouTube / Trading 212 keys. The uncommitted working-tree changes remove the edge function but do nothing for keys already exposed, and the deployed site builds from `main`.
2. ~~Push `game-rebuild` to GitHub?~~ **DECIDED 2026-10-23: Daniel approved.** Pushed `b1ef7ce..9dcd960` (fast-forward; `main` untouched; the diff was scanned and held no secrets; `release.yml` only triggers on `main`). The cloud routine now pushes to `game-rebuild` too, so **local chats must `git fetch origin && git pull --rebase --autostash` before working** (the 9 pre-existing uncommitted changes make a plain pull refuse).
3. **Merging to `main` / releasing 1.1.** The checklist is in ROADMAP "v1.1 path to merging". A routine may prepare a merge-readiness report (see B1), never do the merge.
4. **300 Hz vs 320 Hz test result** for the grainy feel (he is on 320 Hz, Valorant Max FPS 315). Hardware settings are his to change; record outcomes in the vault `Change Log` and the in-app Change Journal.
5. **Mouse card**: still a "coming in a later phase" placeholder. Options: remove it, or build a polling-rate test. A polling test must use a **focused foreground window** (Windows throttles background raw input to ~125 Hz, which produced a false "125 Hz" finding once) and can only be validated with his real mouse on his PC.
6. **Gaming quests / XP**: hooking quest `g_capture_test` ("Test one setting change with a PresentMon capture") to Change Journal entries that have before+after captures touches XP rules in `db.js`. Ask first.
7. **Non-code chores only he can do**: connect the vault (Settings -> Obsidian -> Choose vault), move the SSH keys / recovery codes out of Downloads into a password manager, MemTest86 (USB in Downloads), BIOS update (F34 is from May 2025), uninstall Voicemod.

## 5. Safe autonomous backlog (ordered; one item per run; each ends with `npm test` green)
- **B1. Merge-readiness report (read-only deliverable).** Write `docs/MERGE_READINESS.md`: what `game-rebuild` changes vs `main`, migrations list (1-13), version-bump conflict (1.0.16 vs 1.0.17), what the first launch does to an existing user's data, anything in ROADMAP "v1.1" still open, risks. Do not merge, tag or bump the version.
- **B2. Review leftovers (small, tested):** (a) `presentpath.js` re-implements median/percentile that `framemetrics.js` has: share one helper; (b) `store.js` / `backup.js` strip `present_json` via an unused destructure: select the explicit column list instead; (c) Obsidian sync rebuilds all gaming files on every debounced save: skip the gaming read when nothing gaming-related changed (e.g. a cheap `max(id)`/`count` signature), keep the output byte-identical; (d) health check `apps` row warns for an idle Discord/Medal process: reword as informational or only warn for recorders, update tests.
- **B3. `npm run check` script:** `node --check` on `main.js`, `preload.js`, `mcp-client.js`, `src/db.js`, `src/renderer.js`, every `src/gaming/*.js` and `src/obsidian/*.js`, then `npm test`. Document it here.
- **B4. Docs:** `src/gaming/README.md` (architecture, IPC channel table, migration list, test strategy, how to add a card). Link it from this file.
- **B5. Test gaps on pure code:** IPC argument validation in `src/gaming/ipc.js` (already wrapped; add tests that bad ids/patches return `{ok:false}`), `gaming-*-ui.js` pure helpers (extract `deltaHtml`-style functions into a UMD file like `presentpath.js` if you want them testable).
- **B6. Game-config reader (needs a PC to verify, so local chat only):** read-only health-check row that compares Valorant's `MaxFramerateAlways` (in `%LOCALAPPDATA%\VALORANT\Saved\Config\<id>\Windows\RiotUserSettings.ini`, key `EAresFloatSettingName::MaxFramerateAlways`, with `LimitFramerateAlways=True`) to the main monitor's refresh rate and warns when the cap is **above** it (leaves the VRR range). Reads a file on disk only; never touch the game process. Use a fixture ini for tests.
- Never start: `localStorage -> SQLite` data migration code (ROADMAP says write a spec, not code), anything in `sychboard-mcp/` that adds new write/action tools, anything that sends data off the machine.

## 6. How to set up the routine
Existing routines (checked 2026-10-23): `trig_01RiiStMDYq8sosAtYxQfZcE` "SychBoard - game-rebuild work block" is **disabled** (last ran 2026-08-27) and its prompt is stale (it targets the four bugs, which are fixed, and it produced 130 "no code changes" log commits). `trig_014m2SJyXzc7dwkAPrr6xDsC` is the Chuck Bird bot routine: leave it alone.

Recommended: **do not re-enable the old one.** After Daniel approves pushing `game-rebuild` (Needs Daniel #2), update it (or create a new one) with a prompt like the one below, at most once a day, and have a local chat do anything that needs the PC.

```
One autonomous work block on SychBoard (Electron + vanilla JS + SQLite). RULES: work ONLY on the
game-rebuild branch. NEVER push to or merge into main (a push to main auto-releases to the user's
installed app). Never touch feature/home-tab. No secrets anywhere. FIRST: git fetch origin &&
git checkout game-rebuild && git pull --rebase. Read HANDOFF.md fully, then ROADMAP.md. Pick the
FIRST unfinished item in HANDOFF.md section 5 (B1..B5; skip B6, it needs a PC). Do exactly ONE item.
If nothing is left, or the item needs a decision, add a specific question under "Needs Daniel" in
HANDOFF.md and stop. Do NOT add log commits when you changed no code. Verify: `npm test` must be
green and `node --check` must pass on every .js file you touched; do not run Electron or npm install
unless the item needs it. If verification fails, push nothing and write what broke under "Run log".
Commit style: short lowercase messages, no Co-Authored-By. Commit the code and one dated line in the
"Run log" below together, then push to game-rebuild only.
```

**Done 2026-10-23 (at Daniel's request, by the Smart Home chat):** routine `trig_01RiiStMDYq8sosAtYxQfZcE` was updated in place (same id), renamed "SychBoard - HANDOFF backlog (daily)", enabled, cron `0 4 * * *` (UTC, i.e. once a day about 05:00 UK time), with the prompt above (lightly shortened). The Chuck Bird routine was not touched. It runs in Anthropic's cloud from the pushed code; it does not use Daniel's PC or home server.

## 7. Definition of done for any item
- `npm test` green (114 tests at time of writing; the count should only go up).
- New behaviour has a test; new DB columns/tables have a **new** migration version and are covered by backup export/import in `src/gaming/backup.js` (+ a round-trip test).
- UI: no new global CSS class names that already exist in `src/styles.css`; new script files added to `src/index.html` and `src/sw.js` (+ bump `CACHE`).
- Vault note updated if a local chat did the work: `C:\Users\danie\Documents\ObsidianVault\Projects\SychBoard\SychBoard Gaming Tab.md`; state table in `Home.md` if status changed. Cloud routines cannot reach the vault: append to the Run log below instead.

## 8. Run log (append-only: date, who, what, result)
- 2026-10-23 Claude (Gaming tab chat): wrote this handoff. Branch state: `game-rebuild` 18 local commits not pushed, 114 tests passing, real-Electron smoke test of the Gaming tab passed in a throwaway profile.
- 2026-10-23 Claude (Smart Home chat, Daniel's go-ahead): pushed `game-rebuild` (`b1ef7ce..9dcd960`), updated and enabled the routine (daily 04:00 UTC), recorded both here. Next: the routine's first run (B1 merge-readiness report).
- 2026-10-23 Claude (routine, first run): did B1 — wrote `docs/MERGE_READINESS.md` (diff vs `main`, migrations 1-13, version conflict 1.0.16 vs 1.0.17, data-migration verdict, open risks incl. the still-unrotated Netlify key leak). No app code touched. `npm test` 114/114 green. Next: B2 (review leftovers).
