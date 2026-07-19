# SychBoard — Roadmap & Audit

> Audited 2026-07-18 (Claude session). Branch `game-rebuild` = the real, current version:
> SQLite (src/db.js), full gamification (quests/XP/levels/ranks/badges/streaks/SychCoins/shop),
> Three.js boot orb, GSAP. `main` is the OLD localStorage version — **do not develop on main**.
> ⚠️ CI releases + auto-updates the installed app on every push to `main`. Merging game-rebuild
> into main is the "ship it" moment — deliberate, only after the blockers below are fixed.

## Audit verdict

db.js is genuinely well-engineered: versioned migrations, transactions everywhere,
soft-reset streaks with freeze tokens, coin clawback on quest-untick (no toggle farming),
category sweep bonuses, retroactive coin grants. The IPC surface is complete and clean.

## 🐛 Bugs found — ✅ ALL 4 FIXED 2026-07-18 (verified against real SQLite in isolated tests)

1. **Streak rollover bug** — `completeQuest` computes "yesterday" from the real clock, but
   `getAppDate()` shifts the app-day before the 4am rollover. Completing a quest between
   midnight and 4am after a valid previous-day completion can wrongly soft-reset the streak.
   Fix: derive yesterday from `getAppDate()` minus 1, not `new Date()` minus 1.
2. **Weekly quests are farmable daily** — `quest_completions` is unique per (quest, app_date)
   and `listQuests` shows weekly quests every day, so a 50xp weekly can be completed 7×/week.
   Fix: for `frequency='weekly'`, check completion within the ISO week, not the day.
3. **Sweep bonus invisible** — the +10xp category sweep updates the DB after `newTotalXp` is
   computed, so the returned total (and the UI) lags until next refresh.
4. `getStreaks`/`getXpHistory` mix real dates with app-dates (same rollover blind spot as #1).

## 🚀 v1.1 (game release) — path to merging into main

1. ~~Fix the four bugs above.~~ ✅ done.
2. **Data migration** — see spec below (2026-07-19). Verdict: no code needed for v1.1;
   revisit "legacy seed" as an optional v1.2+ nice-to-have.
3. ~~Shop completion~~ ✅ verified already done (2026-07-19) — see note below.
4. ~~Boot orb polish (Three.js) — user-flagged.~~ ✅ done (2026-07-19) — added window-resize
   handling for the boot screen (star field canvas + Three.js orb renderer), which previously
   sized once at boot start and never adapted if the Electron window was resized before launch.
5. Then: bump version, merge → main, CI ships it, installed app auto-updates.

### Shop — verified complete (2026-07-19)

Checked `src/renderer.js` (`SHOP_ITEMS`, `rShop`, `buyShopItem`, `equipShopItem`, `loadEquips`,
`applyEquips`), `src/styles.css` (`data-bg`/`data-card`/`data-orbprev` rules), `src/db.js`
(`purchaseItem`, `shop_owned` setting), `main.js` (`shop:purchase`, `coins:*`,
`streaks:add-freeze`, `settings:*` IPC handlers) and `preload.js` (bridge). Full catalog exists
(6 accents, 3 fonts, 4 backgrounds, 3 card styles, 3 boot-orb themes, 1 consumable). Equip state
persists via `settings` table (`equip_accent/font/bg/card/orb`), and `loadEquips()` is awaited
*before* `startBoot()` on normal app init (`src/renderer.js:2399-2405`), so the boot orb and
theme render with the right equipped items from the first frame. No gaps found — nothing to do
here for v1.1.

### Data migration — spec (2026-07-19)

**The original concern was partly wrong.** Re-checked what actually happens when game-rebuild
merges into main:

- `appId`/`productName` are unchanged (`com.sychboard.app` / `SychBoard` in both branches'
  `package.json`), so Electron's `userData` path — and therefore the `localStorage` partition —
  is identical across the update. Nothing gets wiped by the app switching versions.
- `src/renderer.js` `load()`/`save()` (lines ~90-129) still read/write the exact same `sb4_*`
  keys for finance, habits (`st.habits`/`st.habitHistory`), journal, sleep, goals, todos, etc.
  That data model was **not touched** by the SQLite rebuild — it's the same code path as on
  `main` today.
- `src/db.js` (quests/XP/streaks/badges/shop/SychCoins) is purely additive: it never reads or
  writes any `sb4_` key. It's a separate SQLite file (`sychboard.db` in `userData`).

So merging to main will **not** wipe finances/habits/journal/sleep — they load exactly as
before, untouched. The "shipping wipes user data" framing in the original audit was incorrect.

**The real (much smaller) gap:** the new gamification layer starts at Level 1 / 0 XP / 0
SychCoins / 0-day streaks for everyone, including users with months of history in the old
localStorage habit tracker. Not data loss — but it may *feel* like a downgrade the first time an
existing user opens the updated app.

**Two options considered:**

- **Option A — do nothing (recommended for v1.1).** Ship as-is. The new gamification system
  starts fresh; the old localStorage-backed sections (Habits, Finance, Journal, Sleep, etc.)
  keep working exactly as they do today, unaffected. Zero risk of a buggy one-time import
  corrupting `profile.total_xp`/`sychcoins` or double-counting streaks.
- **Option B — one-time "legacy seed" import (deferred, v1.2+ nice-to-have).** On first launch
  after the update, read `st.habitHistory` (`{date: {d: doneCount, t: totalCount}}`, no
  per-category or per-quest breakdown — see `recordHabitHistory()` at
  `src/renderer.js:2001`) and backfill an *approximate* XP/coin grant plus a "legacy days
  active" badge. This is inherently a heuristic: `habitHistory` has no mapping to the four
  gamification categories (health/productivity/creativity/finance) or to specific quests, so
  any XP import is an estimate, not a faithful replay of what the user "would have earned."

  Sketch if pursued later:
  1. New `settings` key `legacy_seeded` (absent = not yet run).
  2. `db.js: importLegacyHabitHistory(habitHistoryObj)` — guarded by
     `if (getSetting('legacy_seeded')) return { skipped: true }`; inside one transaction, walk
     `habitHistory` dates ascending, grant XP proportional to `d/t` per day (flat rate, e.g.
     5xp × completion%) into `xp_log` (`source_type='legacy_import'`), bump
     `profile.total_xp`; do **not** attempt to backfill per-category `streaks` rows (no
     category data exists to attribute it to) — leave those at 0 and let real usage build them
     naturally; finish with `setSetting('legacy_seeded', '1')`.
  3. New IPC handler `game:import-legacy` in `main.js`, called once from renderer's boot
     sequence after `load()`, passing `st.habitHistory`.
  4. Must be idempotent (checked via the flag) since it'd be safe to call on every boot.
  5. Needs a dry-run against a synthetic `habitHistory` fixture before ever touching a real
     profile — an off-by-one in the running-total math would corrupt `xp_log`.

**Recommendation:** ship v1.1 with Option A (no migration code). The thing the original audit
was worried about — real user data loss — doesn't happen. Option B is a nice-to-have UX polish
item, not a correctness requirement, and its heuristic nature makes it lower priority than the
rest of the v1.1/v1.2 queue.

## 📈 v1.2+ — real data & feel

- YouTube API + Trading 212 live data on the dashboard cards (keys via the dev panel).
- Installer polish: signed feel, first-run onboarding, tray icon, launch-on-startup toggle.
- Data export/backup (from old MEMORY.md backlog) — one-click JSON dump + restore.
- AI: feed bills/subscriptions into the prompt (proactive warnings); apply parseMD beyond journal.
- ADHD loop tuning: confetti/sound on quest complete, "next best action" nudge on Home,
  daily quest auto-reset notification at rollover.

## 🔭 Ideas (proposals — Daniel decides)

- Chuck Bird crossover: SychBoard quest completions grant Chuck feathers via a tiny API.
- Weekly review screen: XP graph, streak health, badge progress, AI-written week summary.
- Mobile PWA parity for the game system (currently desktop-first).

## Autonomous work log

- 2026-07-18: repo audited; uncommitted game work rescued to `game-rebuild`; this roadmap added.
- 2026-07-18: all 4 audit bugs fixed in src/db.js (app-date streak yesterday, weekly once-per-week guard + display, sweep bonus in return, xp history rollover-aware). Tested with temp DB. Known minor quirk: a weekly completed on a previous day can't be un-ticked later in the week (uncomplete matches same-day only).
- 2026-07-19: audited shop system end-to-end (renderer/css/db/main/preload) — already fully implemented, no work needed. Wrote the localStorage-to-SQLite data migration spec: corrected the audit's premise (merging to main does not wipe localStorage data — appId/userData path is unchanged and old sb4_ keys are untouched by the SQLite rebuild), recommended shipping v1.1 without migration code, and sketched an optional v1.2+ "legacy seed" XP import as a deferred nice-to-have.
- 2026-07-19: boot orb polish — the Three.js orb and star-field canvas on the boot screen sized themselves once from `window.innerWidth` at boot start with no resize handling; added a `bootResizeHandler` wired up in `startBoot()` (star canvas dims + `renderer.setSize` on the orb) and torn down in both `startBoot()`'s own reset path and `enterApp()` to avoid leaking listeners across boots. All four v1.1 queue items are now done except the merge-to-main step itself.
