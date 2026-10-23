# Merge readiness: `game-rebuild` → `main`

Read-only report (HANDOFF.md item B1). Written by the cloud routine, 2026-10-23.
Does **not** merge, tag, or bump the version — that stays Daniel's decision
(HANDOFF.md "Needs Daniel" #3; ROADMAP.md "v1.1 path to merging", step 5).

## 1. What `game-rebuild` changes vs `main`

- `game-rebuild` HEAD (`3826c3e`) is **191 commits ahead** of `origin/main` and
  **1 commit behind** it.
- Diff vs `origin/main`: **55 files changed, 10875 insertions(+), 633 deletions(-)**.
- `main` is still the old localStorage-only version (per ROADMAP.md's own banner:
  "`main` is the OLD localStorage version — do not develop on main").
  `game-rebuild` adds, wholesale:
  - SQLite-backed gamification (`src/db.js`, 1032 new lines: quests, XP, levels,
    streaks, badges, SychCoins, shop).
  - The Gaming tab (`src/gaming/*`: sens converter, session/aim tracking, health
    check, PresentMon capture + frame metrics, change journal, backup/restore).
  - Obsidian one-way export (`src/obsidian/*`).
  - The `sychboard-mcp/` local MCP server (AI-assistant tool calls: system info,
    Chuck Bird status, recent project files) plus `mcp-client.js` wiring it into
    the renderer's AI tab.
  - Large `src/renderer.js` (+1731/-?), `src/index.html` (+285), `src/styles.css`
    (+591) changes to wire all of the above into the existing UI.
  - `.github/workflows/release.yml` and `main.js`/`preload.js` changes (IPC
    surface, input validation, process-level `uncaughtException`/`unhandledRejection`
    handlers, OAuth timeout fixes — see ROADMAP.md's autonomous work log for the
    long list of hardening passes already done on this code).
- The **1 commit `main` has that `game-rebuild` doesn't**: `0120ef7` "chore: bump
  version to 1.0.17" (github-actions bot, dated 2026-05-03) — touches
  `package.json`, `package-lock.json`, `preload.js` version strings only. No
  feature code is behind; it's purely a version-bump commit from a `main`-only
  release.

## 2. Migrations (schema versions 1-13, all present on `game-rebuild`; none on `main`)

From `src/db.js` (1-7) and `src/gaming/schema.js` (8-13), applied in order via
`schema_migrations`, each in its own transaction:

| # | Adds |
|---|---|
| 1 | Core tables: `profile`, `categories`, `quests`, `quest_completions`, `streaks`, `xp_log`, `badges`, `badge_unlocks`, `settings` |
| 2 | (further core seeding/tables) |
| 3 | `profile.sychcoins` column |
| 4 | `quest_completions.freeze_used` column |
| 5 | (streak/freeze related) |
| 6 | `quest_completions.milestone_token_granted` column |
| 7 | `quest_completions.pre_streak` column |
| 8 | `gaming_sens_profiles` table |
| 9 | `gaming_sessions`, `gaming_aim_scores` tables + indexes |
| 10 | `gaming_captures` table |
| 11 | *(core: true — writes to `categories`/`streaks`/`quests`/`badges`)* seeds the "Gaming" quest category (id 5), 7 quests, 5 streak badges |
| 12 | `gaming_captures.present_kind` / `present_json` columns |
| 13 | `gaming_changes` table (Change Journal) + index |

Migrations are append-only; the next free version is **14**. `db.js` throws at
startup if a version number collides between its own list and
`gaming/schema.js`'s list, so the two can't silently clash.

## 3. Version-bump conflict

- `game-rebuild`'s `package.json` says **1.0.16**.
- `main`'s `package.json` says **1.0.17** (from the one commit `game-rebuild`
  lacks, `0120ef7`).
- A merge will conflict on `package.json` (and `package-lock.json`,
  `preload.js`) at the version string. Whoever does the merge needs to decide
  the new version number by hand (presumably something above 1.0.17, e.g.
  1.1.0 given the feature scope) — this is not a fast-forward and not
  mechanical the way the earlier `b1ef7ce..9dcd960` push to `game-rebuild` was.

## 4. What first launch does to an existing user's data

Per ROADMAP.md's "Data migration — spec" (2026-07-19, re-verified against the
actual code, not assumed):

- `appId`/`productName` (`com.sychboard.app` / `SychBoard`) are unchanged
  between branches, so Electron's `userData` path — and the `localStorage`
  partition inside it — is identical across the update. **Nothing is wiped.**
- The old `sb4_*` localStorage keys (finance, habits, journal, sleep, goals,
  todos, etc.) are read/written by the same `load()`/`save()` code path on
  both branches. `game-rebuild` did not touch that data model.
- The new SQLite file (`sychboard.db` in `userData`) is purely additive — it
  never reads or writes any `sb4_*` key.
- **Net effect:** no data loss. The only user-visible change is that the new
  gamification layer starts everyone at Level 1 / 0 XP / 0 SychCoins / 0-day
  streaks, including users with months of localStorage habit history — a
  one-time "feels like a downgrade" moment, not a correctness bug.
- A "legacy seed" XP import (Option B in ROADMAP.md) to backfill approximate
  XP from old `habitHistory` was deliberately **deferred** (v1.2+, not
  required for v1.1) because it's a heuristic (no per-category/per-quest
  mapping exists in the old data) with real risk of corrupting `xp_log` if the
  math is off. No code for it exists; this report doesn't change that.

## 5. ROADMAP "v1.1 path to merging" — status

All four substantive items are done:
1. ✅ The 4 original audit bugs (streak rollover, farmable weeklies, invisible
   sweep bonus, app-date/real-date mixing) — fixed and re-verified many times
   since 2026-07-18.
2. ✅ Data migration — resolved as "no code needed" (see §4 above).
3. ✅ Shop system — verified already complete.
4. ✅ Boot orb polish (resize handling).

**Only step 5 is open: "bump version, merge → main, CI ships it."** That is
explicitly Daniel's call, not something this routine or any autonomous pass
does (HANDOFF.md hard rule #1, ROADMAP.md's repeated "never do it unprompted
regardless of what else is greenlit").

The old autonomous routine (disabled 2026-08-27, 130 passes) ran this bugs /
v1.1 / IPC-validation queue to genuine exhaustion by 2026-07-25 and spent the
following month on progressively smaller hardening finds (stored-XSS sweeps,
re-entrancy guards on chat/boot inputs, OAuth timeout gaps, double-escaping in
backup restore, etc. — all logged in ROADMAP.md, all fixed). Nothing in that
tail changes the v1.1 verdict above.

## 6. Still open / risks

1. **CRITICAL — unrelated to this diff, but blocks a confident "ship it"
   moment:** `netlify/edge-functions/inject-env.js` on `main` (NOT part of the
   Electron app, not touched by `game-rebuild`) injects four live API keys
   (Groq, YouTube, YouTube channel ID, Trading 212) into every HTML response
   with no auth gate. Confirmed still present and unrotated as of the last
   check (ROADMAP.md, 2026-08-26). This is a live secret-exposure issue on
   whatever's deployed to Netlify, independent of the Electron
   merge — but it's the same `main` branch, and HANDOFF.md "Needs Daniel" #1
   flags it as still open. Merging `game-rebuild` into `main` does not fix or
   worsen it (Electron app and Netlify PWA are separate surfaces), but it's a
   live item on the same repo Daniel should know about before treating a merge
   as "repo is in good shape."
2. **Version number must be chosen by hand** at merge time (§3) — not a
   blocker, just not a fast-forward.
3. **Packaged build not yet verified.** HANDOFF.md §2 notes `healthcheck.ps1`
   (read through Electron's asar-aware `fs`, sent to PowerShell via
   `-EncodedCommand`) "should need no unpacking" but this has **not actually
   been run through a real `npm run build`** — only through a throwaway-profile
   Electron smoke test, and only locally (the cloud routine can't run
   Electron at all). Recommend a real `npm run build` + install, once, on
   Daniel's PC before release.
4. **Mouse card** is still a placeholder (HANDOFF.md "Needs Daniel" #5) —
   cosmetic, not a merge blocker, but will ship as-is if merged now.
5. **`g_capture_test` quest** (Change Journal before/after capture linkage)
   is not yet hooked up to auto-complete that quest (HANDOFF.md "Needs
   Daniel" #6) — again cosmetic/feature-incomplete, not a correctness risk.
6. Local dev copy path noted in HANDOFF.md
   (`C:\Users\danie\Downloads\sychboard-electron\sychboard-electron`) should
   match what's pushed before Daniel does the merge himself — this report
   only reflects the pushed `game-rebuild` branch this cloud routine can see.

## 7. Test status at time of writing

`npm test` → **114/114 passing** (`node --test "src/gaming/*.test.js"
"src/obsidian/*.test.js"`), matching HANDOFF.md's count.
