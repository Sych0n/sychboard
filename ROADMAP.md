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

## 🐛 Bugs found (fix before merging to main)

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

1. Fix the four bugs above.
2. **Data migration** — old installs have localStorage (`sb4_`) data; the game version reads
   SQLite. Write a one-time import (renderer reads sb4_ keys → IPC → db.js) so finances,
   habits, journal, sleep history survive the update. Without this, shipping wipes user data.
3. Shop completion — accent colours/fonts/backgrounds exist (`shop_owned`, equip flow);
   finish the catalog + apply-on-boot.
4. Boot orb polish (Three.js) — user-flagged.
5. Then: bump version, merge → main, CI ships it, installed app auto-updates.

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
