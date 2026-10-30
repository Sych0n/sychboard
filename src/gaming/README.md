# Gaming module

Tracking and tooling for the Gaming tab: sensitivity profiles, session/aim logging,
a read-only system health check, PresentMon frame-time capture, and a change journal
for "did that setting help?" testing. Paired with a one-way export into Obsidian
(`src/obsidian/`, documented inline below since the two ship together).

**Hard rule (see `GAMING_TAB_PLAN.md` / `HANDOFF.md` section 1):** nothing here reads
or writes game memory, injects into a game, draws an overlay, or automates input.
Health checks are read-only; PresentMon capture only launches the user's own exe
against a process name they chose.

## Architecture

- **Main process only.** All gaming data lives in SQLite, read and written through
  `store.js`, which is wired up in `main.js` via `ipc.js`. The renderer never
  touches the database directly.
- **UI cards.** `gaming-ui.js` is the tab shell: cards call `Gaming.registerCard({id,
  title, order, render})` from their own file at load time; `rGaming()` renders the
  tab by calling each card's `render(bodyEl)` (sandboxed — a throwing card shows an
  error instead of breaking the tab). `gaming-cards-stub.js` is the leftover
  placeholder for the not-yet-built Mouse card (`HANDOFF.md` Needs Daniel #5).
- **Shared pure helpers** are UMD modules (`module.exports` under Node, `window.X`
  in the renderer) so they can be unit-tested with plain `node --test` and still
  load as a `<script>` tag: `stats-math.js` (median/percentile, shared by
  `framemetrics.js` and `presentpath.js`), `sens.js` (DPI/sens conversion math).
- **No dependency on `db.js`.** `store.js` takes `getDb` and `awardXp` as
  constructor arguments (see `createStore(getDb, awardXp)`), so tests run it
  against an in-memory `node:sqlite` database with a stub `awardXp`, independent
  of Electron's `better-sqlite3` build.

## Files

| File | Role |
|---|---|
| `gaming-ui.js` | Tab shell, card registry (`Gaming.registerCard`, `rGaming`, `Gaming.dataChanged`) |
| `gaming.css` | Styles scoped under `#page-gaming` (don't reuse global class names from `src/styles.css`, e.g. `.gm-badge`) |
| `gaming-cards-stub.js` | Placeholder cards not yet built (currently just Mouse) |
| `sens.js` / `gaming-sens-ui.js` | Sensitivity converter (yaw-based, across games) |
| `stats.js` / `gaming-sessions-ui.js` / `gaming-charts.js` | Session + aim-score logging, charts |
| `healthcheck.ps1` / `healthcheck.js` / `gaming-health-ui.js` | Read-only system check: `healthcheck.ps1` collects 13 rows on the PC, `healthcheck.js` evaluates them, the UI renders the result |
| `presentmon.js` / `framemetrics.js` / `presentpath.js` / `gaming-capture-ui.js` | Launches the user's PresentMon exe, computes FPS/latency metrics, classifies presentation path (Independent Flip vs. composed) |
| `store.js` (change journal part) / `gaming-changes-ui.js` | Change Journal: one row per setting tweak, optionally linked to before/after captures |
| `schema.js` | Gaming migrations (versions 8-13, append-only) |
| `store.js` | Main-process data layer — all gaming reads/writes go through here |
| `ipc.js` | Registers the `gaming:*` IPC channels on `ipcMain` |
| `backup.js` | Export/import of gaming data for the app's backup feature; excludes machine-specific settings |
| `stats-math.js` | Shared median/percentile helper |

## IPC channels (`src/gaming/ipc.js`)

Every channel is wrapped so a thrown error reaches the renderer as
`{ ok: false, error }` instead of an opaque Electron error; success is
`{ ok: true, data }`.

| Channel | Args | Notes |
|---|---|---|
| `gaming:sens:list` | – | |
| `gaming:sens:save` | profile | upsert by unique `name` |
| `gaming:sens:delete` | id | |
| `gaming:session:add` | session | awards XP |
| `gaming:session:list` | – | |
| `gaming:session:delete` | id | |
| `gaming:aim:add` | score | awards XP |
| `gaming:aim:list` | – | |
| `gaming:aim:delete` | id | |
| `gaming:change:add` / `:list` / `:update` / `:delete` | ... | Change Journal CRUD |
| `gaming:health:run` | – | runs `healthcheck.ps1`, read-only |
| `gaming:pm:status` | – | validates the stored PresentMon path |
| `gaming:pm:pick` | – | native file dialog only; renderer can never supply a path |
| `gaming:pm:capture` | `{seconds, processName}` | one capture at a time |
| `gaming:pm:cancel` | – | |
| `gaming:capture:save` / `:list` / `:get` / `:delete` | ... | persist/inspect a finished capture |

## Migrations

Gaming migrations are versions 8-13 in `schema.js`, appended to `db.js`'s own list
(`db.js` pushes `require('./gaming/schema').migrations` after its own, and throws
on a duplicate version number — see `db.js` around the migration runner). **Never
edit a shipped migration; add a new version instead.** The next free version is
**14**.

| Version | Adds |
|---|---|
| 8 | `gaming_sens_profiles` |
| 9 | `gaming_sessions`, `gaming_aim_scores` |
| 10 | `gaming_captures` |
| 11 | Gaming quest category, quests, badges (`core: true` — touches `db.js`-owned tables) |
| 12 | `gaming_captures.present_kind` / `.present_json` |
| 13 | `gaming_changes` |

Migrations flagged `core: true` write to `db.js`-owned tables (`categories`,
`quests`, `streaks`, `badges`), so the bare in-memory-DB unit tests use
`standaloneMigrations` (everything except `core: true`) — the full list only runs
under real Electron. Only version 11 is `core: true` today.

## Obsidian export (`src/obsidian/`)

One-way: SychBoard → vault, never the other direction. `export.js` is pure
(`buildFiles(state, gaming)` → `{path: content}`); `vault.js` does the actual
writes (`syncToVault`) and only ever overwrites a file whose frontmatter says
`source: sychboard` — it never deletes anything in the vault. `obsidian/ipc.js`
registers the `obsidian:status` / `:pick` / `:sync` / `:disconnect` channels; the
vault path is chosen only through a native folder picker and stored by the main
process, same as the PresentMon exe path. `store.exportSummary()` is the gaming
half of the sync payload and caches its result behind a cheap signature (row
counts / max id / `updated_at`) so a debounced sync doesn't re-read five tables
when nothing gaming-related changed.

## Invariants

- Migrations are append-only; the next version is always one past the highest in
  `schema.js`.
- `gaming_presentmon_path` and `obsidian_vault_path` are machine-specific: never
  exported, restored, or writable through the generic `settings:set` channel (see
  `backup.js`'s `MACHINE_SETTINGS` and the `main.js` settings guard).
- The renderer can never supply a filesystem path to execute or write — only
  native dialogs (`dialog.showOpenDialog`) produce one.
- The Obsidian export only overwrites files it owns (`source: sychboard`
  frontmatter) and never deletes.
- Gaming rows for the Obsidian export are read in the main process
  (`gamingStore.exportSummary()`), never accepted from the renderer.

## Tests and how to run them

`npm test` runs `node --test "src/gaming/*.test.js" "src/obsidian/*.test.js"` against
Node's built-in `node:sqlite` (Electron's `better-sqlite3` build can't load in plain
Node — see `HANDOFF.md` section 2). `npm run check` additionally `node --check`s
every shipped `.js` file first (`scripts/check.js`), then runs `npm test`.

Each source file has a matching `*.test.js` (e.g. `store.js` → `store.test.js`).
Tests that exercise migrations use `standaloneMigrations` against an in-memory DB
plus a stub `awardXp`; they do not spin up Electron.

## Adding a card

1. Add a new `src/gaming/gaming-<name>-ui.js` file. Call
   `window.Gaming.registerCard({ id, title, order, render })` at the top level
   (IIFE), where `render(bodyEl)` may be `async` and should throw on failure
   rather than leave the card in a half-rendered state.
2. If the card needs persisted data, add store functions in `store.js` (plus a
   migration in `schema.js` if it needs new tables/columns — see Migrations
   above) and expose them as `gaming:*` channels in `ipc.js`.
3. After a write, call `Gaming.dataChanged()` so the Obsidian export picks up the
   change on its next debounced sync.
4. Register the new script in `src/index.html` (after `gaming-ui.js`, before
   `renderer.js`) and in `src/sw.js`'s cache list, bumping `CACHE`.
5. Add a `*.test.js` for any new pure logic or store function; if you added a
   table/column, extend `backup.js` and its round-trip test unless the data is
   machine-specific (`MACHINE_SETTINGS`).
