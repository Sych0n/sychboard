'use strict'
const path = require('path')

let _db = null
let _app = null

// ── Level / XP helpers ──────────────────────────────────────────────────────

function levelForTotalXp(totalXp) {
  let level = 1, cum = 0, increment = 100
  while (cum + increment <= totalXp) {
    cum += increment
    increment += 50
    level++
  }
  return { level, currentLevelXp: totalXp - cum, xpToNext: increment }
}

const RANKS = [[1,'Novice'],[6,'Apprentice'],[11,'Adept'],[16,'Expert'],[21,'Master'],[26,'Grandmaster'],[31,'Legend']]
function rankForLevel(level) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i][0]) return RANKS[i][1]
  }
  return 'Novice'
}

function streakBonusPct(streak) {
  if (streak >= 100) return 0.30
  if (streak >= 60)  return 0.25
  if (streak >= 30)  return 0.20
  if (streak >= 14)  return 0.15
  if (streak >= 7)   return 0.10
  if (streak >= 3)   return 0.05
  return 0
}

// Format a Date's LOCAL calendar day as YYYY-MM-DD. Never use toISOString() for
// this — it serializes in UTC, which silently shifts the date by a day for any
// non-UTC timezone whenever local and UTC calendar days differ (always true for
// part of every day outside UTC+0).
function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parse a YYYY-MM-DD string as LOCAL midnight. `new Date("YYYY-MM-DD")` parses as
// UTC midnight, which combined with local getDate()/setDate() causes the same
// day-shift as toISOString() above (opposite direction, e.g. any UTC-negative zone).
function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// A "now" timestamp in the same UTC "YYYY-MM-DD HH:MM:SS" shape SQLite's own
// datetime('now') produces — required for imported/backfilled rows, since
// renderer.js's parseUtcTimestamp() only knows how to turn *that* shape into
// real ISO-8601 (it swaps the space for 'T' and appends 'Z'); a plain
// toISOString() fallback already has a 'T'/'Z'/milliseconds and comes out
// unparseable ("Invalid Date") once parseUtcTimestamp appends its own 'Z'.
function sqliteNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// Returns [mondayStr, sundayStr] for the Mon-Sun calendar week containing the
// given YYYY-MM-DD app-date. Used instead of SQLite's strftime('%Y-%W', ...),
// which numbers weeks from Jan 1 (not true ISO-8601 weeks) — two calendar-
// adjacent days can land in different %W buckets across a year boundary
// (e.g. 2026-01-04 is week "2026-00", 2026-01-05 is week "2026-01"), letting a
// weekly quest be completed twice in what's actually the same 7-day week.
function isoWeekRange(dateStr) {
  const d = parseLocalDate(dateStr)
  const dow = d.getDay() // 0=Sun..6=Sat
  const monday = new Date(d)
  monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow))
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return [formatLocalDate(monday), formatLocalDate(sunday)]
}

function getRolloverHour() {
  // Clamped: an out-of-range stored value (e.g. >=24, reachable only via a direct
  // IPC call or a hand-edited/corrupted backup, since there's no UI for this
  // setting) would otherwise make getAppDate()'s `now.getHours() < rolloverHour`
  // check permanently true or permanently false, silently freezing the app-date
  // one day in the past forever.
  const raw = parseInt(_db?.prepare("SELECT value FROM settings WHERE key='day_rollover_hour'").get()?.value ?? '4')
  return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : 4
}

function getAppDate() {
  const rolloverHour = getRolloverHour()
  const now = new Date()
  if (now.getHours() < rolloverHour) now.setDate(now.getDate() - 1)
  return formatLocalDate(now)
}

// ── Init & migrations ────────────────────────────────────────────────────────

function initDB(electronApp) {
  _app = electronApp
  const Database = require('better-sqlite3')
  const dbPath = path.join(_app.getPath('userData'), 'sychboard.db')
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  migrate()
  return _db
}

function migrate() {
  _db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`)
  const applied = new Set(_db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version))

  const migrations = [
    { version: 1, sql: `
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        display_name TEXT NOT NULL DEFAULT 'Operator',
        total_xp INTEGER NOT NULL DEFAULT 0,
        current_level INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT
      );
      CREATE TABLE IF NOT EXISTS quests (
        id INTEGER PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        tier TEXT NOT NULL,
        base_xp INTEGER NOT NULL,
        frequency TEXT NOT NULL,
        repeatable INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS quest_completions (
        id INTEGER PRIMARY KEY,
        quest_id INTEGER NOT NULL REFERENCES quests(id),
        app_date TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        xp_awarded INTEGER NOT NULL,
        streak_bonus_pct REAL NOT NULL DEFAULT 0,
        notes TEXT,
        UNIQUE(quest_id, app_date)
      );
      CREATE TABLE IF NOT EXISTS streaks (
        id INTEGER PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_completion_date TEXT,
        freeze_tokens INTEGER NOT NULL DEFAULT 0,
        UNIQUE(category_id)
      );
      CREATE TABLE IF NOT EXISTS xp_log (
        id INTEGER PRIMARY KEY,
        occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        amount INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        running_total INTEGER NOT NULL,
        reason TEXT
      );
      CREATE TABLE IF NOT EXISTS badges (
        id INTEGER PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        category_id INTEGER REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS badge_unlocks (
        id INTEGER PRIMARY KEY,
        badge_id INTEGER NOT NULL REFERENCES badges(id),
        unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(badge_id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      INSERT OR IGNORE INTO settings VALUES ('day_rollover_hour','4');
      INSERT OR IGNORE INTO settings VALUES ('soft_reset_enabled','1');
      INSERT OR IGNORE INTO profile (id, display_name) VALUES (1, 'Operator');
    `},
    { version: 2, sql: `
      INSERT OR IGNORE INTO categories VALUES (1,'health','Health','#10b981','💪');
      INSERT OR IGNORE INTO categories VALUES (2,'productivity','Productivity','#3b82f6','⚡');
      INSERT OR IGNORE INTO categories VALUES (3,'creativity','Creativity','#8b5cf6','🎨');
      INSERT OR IGNORE INTO categories VALUES (4,'finance','Finance','#f59e0b','💰');
      INSERT OR IGNORE INTO streaks (category_id) VALUES (1),(2),(3),(4);
      -- Health quests
      INSERT OR IGNORE INTO quests (category_id,key,name,tier,base_xp,frequency,sort_order) VALUES
        (1,'h_water','Drink 2L water','trivial',5,'daily',1),
        (1,'h_walk','10-min walk / 10k steps','easy',10,'daily',2),
        (1,'h_sleep_log','Log sleep (7+ hrs)','easy',10,'daily',3),
        (1,'h_no_junk','No junk food day','easy',10,'daily',4),
        (1,'h_workout','Workout session','medium',25,'daily',5),
        (1,'h_gym_3x','3x gym sessions this week','medium',50,'weekly',6),
        (1,'h_meal_prep','Meal-prep session','medium',25,'weekly',7),
        (1,'h_milestone','Hit a weight/strength milestone','epic',100,'epic',8);
      -- Productivity quests
      INSERT OR IGNORE INTO quests (category_id,key,name,tier,base_xp,frequency,sort_order) VALUES
        (2,'p_top3','Complete top 3 priority tasks','medium',20,'daily',1),
        (2,'p_pomodoro','One deep-work / Pomodoro block','easy',15,'daily',2),
        (2,'p_inbox','Inbox zero','easy',10,'daily',3),
        (2,'p_lectures','Attend all lectures/seminars','easy',10,'daily',4),
        (2,'p_planner','Review weekly planner','medium',20,'weekly',5),
        (2,'p_ship_feature','Ship a SychBoard or PubHub feature','hard',50,'weekly',6),
        (2,'p_theory_test','Pass theory test','epic',150,'epic',7),
        (2,'p_ship_release','Ship a SychBoard/PubHub release','epic',100,'epic',8);
      -- Creativity quests
      INSERT OR IGNORE INTO quests (category_id,key,name,tier,base_xp,frequency,sort_order) VALUES
        (3,'c_write_script','Write/script for a video','easy',15,'daily',1),
        (3,'c_film_edit','Film or edit 15+ min of content','medium',20,'daily',2),
        (3,'c_practice','Practice a creative skill (20 min)','easy',10,'daily',3),
        (3,'c_post_socials','Post to socials for Sychon','easy',10,'weekly',4),
        (3,'c_publish_video','Publish a YouTube video','hard',75,'weekly',5),
        (3,'c_channel_milestone','Hit a channel milestone','epic',150,'epic',6);
      -- Finance quests
      INSERT OR IGNORE INTO quests (category_id,key,name,tier,base_xp,frequency,sort_order) VALUES
        (4,'f_log_spending','Log all spending for the day','trivial',5,'daily',1),
        (4,'f_no_spend','No-spend day','easy',10,'daily',2),
        (4,'f_review_budget','Review budget','medium',20,'weekly',3),
        (4,'f_dca','Make monthly DCA investment','medium',25,'weekly',4),
        (4,'f_milestone','Hit a savings/investment milestone','epic',100,'epic',5);
      -- Badges
      INSERT OR IGNORE INTO badges (key,name,description,icon,category_id) VALUES
        ('spark_health','3-Day Spark','3-day Health streak','🌟',1),
        ('spark_productivity','3-Day Spark','3-day Productivity streak','🌟',2),
        ('spark_creativity','3-Day Spark','3-day Creativity streak','🌟',3),
        ('spark_finance','3-Day Spark','3-day Finance streak','🌟',4),
        ('week_health','Week Warrior','7-day Health streak','🔥',1),
        ('week_productivity','Week Warrior','7-day Productivity streak','🔥',2),
        ('week_creativity','Week Warrior','7-day Creativity streak','🔥',3),
        ('week_finance','Week Warrior','7-day Finance streak','🔥',4),
        ('fortnight_health','Fortnight Flame','14-day Health streak','⚡',1),
        ('fortnight_productivity','Fortnight Flame','14-day Productivity streak','⚡',2),
        ('fortnight_creativity','Fortnight Flame','14-day Creativity streak','⚡',3),
        ('fortnight_finance','Fortnight Flame','14-day Finance streak','⚡',4),
        ('monthly_health','Monthly Master','30-day Health streak','🏆',1),
        ('monthly_productivity','Monthly Master','30-day Productivity streak','🏆',2),
        ('monthly_creativity','Monthly Master','30-day Creativity streak','🏆',3),
        ('monthly_finance','Monthly Master','30-day Finance streak','🏆',4),
        ('level_5','Rising Star','Reach level 5','⭐',NULL),
        ('level_10','Veteran','Reach level 10','💫',NULL),
        ('level_20','Elite','Reach level 20','🌠',NULL),
        ('centurion_health','Centurion','100-day Health streak','👑',1),
        ('centurion_productivity','Centurion','100-day Productivity streak','👑',2),
        ('centurion_creativity','Centurion','100-day Creativity streak','👑',3),
        ('centurion_finance','Centurion','100-day Finance streak','👑',4);
    `},
    { version: 3, sql: `
      ALTER TABLE profile ADD COLUMN sychcoins INTEGER NOT NULL DEFAULT 0;
      INSERT OR IGNORE INTO settings VALUES ('shop_owned','[]');
    `},
    { version: 4, sql: `
      ALTER TABLE quest_completions ADD COLUMN freeze_used INTEGER NOT NULL DEFAULT 0;
    `},
    { version: 5, sql: `
      -- Epic/milestone quests ("Pass theory test", "Hit a savings milestone", etc.)
      -- are one-time achievements, but the v2 seed INSERTs never set repeatable and
      -- silently took the column's repeatable=1 default, making them re-completable
      -- once per day forever (the "hide after first completion" filter in
      -- listQuests() only fires when repeatable=0). Fix existing rows retroactively;
      -- new epic quests must set repeatable=0 explicitly going forward.
      UPDATE quests SET repeatable = 0 WHERE frequency = 'epic';
    `},
    { version: 6, sql: `
      -- The 7-day-streak-milestone freeze-token grant (completeQuest) had no
      -- record of which completion granted it, so uncompleteQuest could only
      -- refund tokens *consumed* to bridge a gap (freeze_used), never claw back
      -- one *granted* by the completion being undone. A repeated
      -- complete-streak-to-7/uncomplete cycle farmed unlimited (capped at 3)
      -- free freeze tokens per category with the streak itself always
      -- correctly reverting to 6. Track the grant explicitly so it can be
      -- reverted the same way freeze_used already is.
      ALTER TABLE quest_completions ADD COLUMN milestone_token_granted INTEGER NOT NULL DEFAULT 0;
    `},
    { version: 7, sql: `
      -- uncompleteQuest's streak revert always did current_streak=MAX(0,current_streak-1),
      -- an inverse that only holds for the plain +1 and freeze-bridge transitions.
      -- completeQuest's "broken streak" branch instead sets current_streak to
      -- floor(oldStreak*0.5)+1 (soft reset, the default) or 1 (hard reset) — a
      -- non-linear transform that -1 doesn't undo. Completing a quest right after a
      -- streak break, then unticking that same completion, permanently corrupted
      -- current_streak to a value between the true pre-break streak and the reset
      -- value, silently poisoning every future soft-reset for that category (which
      -- reads current_streak as its baseline). Record the true pre-completion value
      -- so it can be restored exactly instead of decremented.
      ALTER TABLE quest_completions ADD COLUMN pre_streak INTEGER;
    `}
  ]

  const newlyApplied = []
  for (const m of migrations) {
    if (!applied.has(m.version)) {
      // Run the DDL and its schema_migrations bookkeeping in one transaction —
      // otherwise a failure partway through leaves the schema half-applied but
      // unmarked, and the next launch retries the same SQL from scratch, which
      // fails on non-idempotent statements (e.g. ALTER TABLE ADD COLUMN throws
      // "duplicate column" on the already-added part), breaking startup for good.
      _db.transaction(() => {
        _db.exec(m.sql)
        _db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version)
      })()
      newlyApplied.push(m.version)
    }
  }

  // v3 retroactive coin grant: coins for every level already reached (level × 10 each)
  if (newlyApplied.includes(3)) {
    const profile = _db.prepare('SELECT total_xp FROM profile WHERE id=1').get()
    if (profile) {
      const { level } = levelForTotalXp(profile.total_xp)
      let retro = 0
      for (let n = 2; n <= level; n++) retro += n * 10
      if (retro > 0) _db.prepare('UPDATE profile SET sychcoins = sychcoins + ? WHERE id=1').run(retro)
    }
  }
}

// ── Query functions ──────────────────────────────────────────────────────────

function listQuests() {
  const appDate = getAppDate()
  const [weekStart, weekEnd] = isoWeekRange(appDate)
  // Weekly quests count as completed for the whole Mon-Sun week; daily/epic per app-day.
  return _db.prepare(`
    SELECT q.*, c.name as category_name, c.key as category_key, c.icon as category_icon, c.color as category_color,
      CASE
        WHEN q.frequency = 'weekly' THEN
          EXISTS(SELECT 1 FROM quest_completions w WHERE w.quest_id = q.id
                 AND w.app_date BETWEEN ? AND ?)
        ELSE
          EXISTS(SELECT 1 FROM quest_completions d WHERE d.quest_id = q.id AND d.app_date = ?)
      END as completed_today,
      (SELECT t.xp_awarded FROM quest_completions t WHERE t.quest_id = q.id AND t.app_date = ?
       ORDER BY t.id DESC LIMIT 1) as xp_awarded_today
    FROM quests q
    JOIN categories c ON q.category_id = c.id
    WHERE q.active = 1 AND (
      q.frequency = 'daily' OR q.frequency = 'weekly' OR
      (q.frequency = 'epic' AND (q.repeatable = 1 OR
        NOT EXISTS(SELECT 1 FROM quest_completions e WHERE e.quest_id = q.id)))
    )
    ORDER BY q.frequency DESC, q.category_id, q.sort_order, q.id
  `).all(weekStart, weekEnd, appDate, appDate)
}

function completeQuest(questId) {
  const appDate = getAppDate()
  const quest = _db.prepare('SELECT * FROM quests WHERE id = ?').get(questId)
  if (!quest) throw new Error('Quest not found: ' + questId)

  // Weekly quests: one completion per Mon-Sun calendar week, not per day
  if (quest.frequency === 'weekly') {
    const [weekStart, weekEnd] = isoWeekRange(appDate)
    const doneThisWeek = _db.prepare(
      'SELECT 1 FROM quest_completions WHERE quest_id=? AND app_date BETWEEN ? AND ?'
    ).get(questId, weekStart, weekEnd)
    if (doneThisWeek) throw new Error('Weekly quest already completed this week')
  }

  // Non-repeatable epic quests: one completion ever, not one per day. listQuests()
  // already hides them from the UI after their first completion, but that's a
  // display-only filter — without this check, driving the IPC bridge directly
  // (or a future repeatable=0 quest completed before its first daily reset) can
  // still re-award XP for it every day forever.
  if (quest.frequency === 'epic' && quest.repeatable !== 1) {
    const doneEver = _db.prepare('SELECT 1 FROM quest_completions WHERE quest_id=?').get(questId)
    if (doneEver) throw new Error('Epic quest already completed')
  }

  const streak = _db.prepare('SELECT * FROM streaks WHERE category_id = ?').get(quest.category_id)
  const currentStreak = streak?.current_streak ?? 0
  const bonusPct = streakBonusPct(currentStreak)
  const xpAwarded = Math.round(quest.base_xp * (1 + bonusPct))

  const profile = _db.prepare('SELECT * FROM profile WHERE id = 1').get()
  const oldXp = profile?.total_xp ?? 0

  const catKey = { 1:'health', 2:'productivity', 3:'creativity', 4:'finance' }[quest.category_id] ?? 'health'

  const doComplete = _db.transaction(() => {
    _db.prepare(`INSERT INTO quest_completions (quest_id,app_date,xp_awarded,streak_bonus_pct) VALUES (?,?,?,?)`)
      .run(questId, appDate, xpAwarded, bonusPct)
    const afterQuestXp = oldXp + xpAwarded
    _db.prepare(`INSERT INTO xp_log (amount,source_type,source_id,running_total,reason) VALUES (?,?,?,?,?)`)
      .run(xpAwarded, 'quest_completion', questId, afterQuestXp, 'Completed: ' + quest.name)

    // Update streak — "yesterday" must be relative to the APP date, not the wall
    // clock, or completions between midnight and the rollover hour wrongly
    // count as a broken streak.
    const lastDate = streak?.last_completion_date
    const yesterday = parseLocalDate(appDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatLocalDate(yesterday)
    const dayBeforeYesterday = parseLocalDate(appDate)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    const dayBeforeYesterdayStr = formatLocalDate(dayBeforeYesterday)

    let tokens = streak?.freeze_tokens ?? 0
    let freezeUsed = false
    let newStreak
    if (lastDate === appDate) {
      newStreak = currentStreak
    } else if (!lastDate || lastDate === yesterdayStr) {
      newStreak = currentStreak + 1
    } else if (lastDate === dayBeforeYesterdayStr && tokens > 0) {
      // Exactly one missed day and a freeze token in stock: spend it to bridge the
      // gap instead of breaking the streak (this is what "Streak Freeze" purchases
      // and 7-day-milestone rewards were previously granting but never consuming).
      newStreak = currentStreak + 1
      tokens -= 1
      freezeUsed = true
    } else {
      // Broken streak
      const softReset = _db.prepare("SELECT value FROM settings WHERE key='soft_reset_enabled'").get()
      newStreak = softReset?.value === '1' ? Math.floor(currentStreak * 0.5) + 1 : 1
    }

    if (freezeUsed) {
      _db.prepare('UPDATE quest_completions SET freeze_used=1 WHERE quest_id=? AND app_date=?').run(questId, appDate)
    }

    const longest = Math.max(newStreak, streak?.longest_streak ?? 0)
    let milestoneTokenGranted = false
    if (newStreak % 7 === 0 && newStreak > currentStreak) {
      // Only actually a *grant* (worth clawing back on uncomplete) if it moved
      // the count — once already capped at 3, a further milestone is a no-op.
      if (tokens < 3) milestoneTokenGranted = true
      tokens = Math.min(tokens + 1, 3)
    }
    if (milestoneTokenGranted) {
      _db.prepare('UPDATE quest_completions SET milestone_token_granted=1 WHERE quest_id=? AND app_date=?').run(questId, appDate)
    }

    if (streak && lastDate !== appDate) {
      _db.prepare(`UPDATE streaks SET current_streak=?,longest_streak=?,last_completion_date=?,freeze_tokens=? WHERE category_id=?`)
        .run(newStreak, longest, appDate, tokens, quest.category_id)
      // Record the true pre-completion value so uncompleteQuest can restore it
      // exactly (see migration v7) instead of assuming a plain -1 inverse, which
      // is wrong for the soft/hard-reset branch above.
      _db.prepare('UPDATE quest_completions SET pre_streak=? WHERE quest_id=? AND app_date=?').run(currentStreak, questId, appDate)
    } else if (!streak) {
      _db.prepare(`INSERT INTO streaks (category_id,current_streak,longest_streak,last_completion_date,freeze_tokens) VALUES (?,1,1,?,0)`)
        .run(quest.category_id, appDate)
      _db.prepare('UPDATE quest_completions SET pre_streak=0 WHERE quest_id=? AND app_date=?').run(questId, appDate)
    }

    // Check streak badges now; level badges are checked below, after the sweep
    // bonus is folded into the total (see note there for why).
    const badgesUnlocked = []
    const streakMilestones = [[3,`spark_${catKey}`],[7,`week_${catKey}`],[14,`fortnight_${catKey}`],[30,`monthly_${catKey}`],[100,`centurion_${catKey}`]]
    for (const [threshold, key] of streakMilestones) {
      if (newStreak >= threshold) {
        const badge = _db.prepare('SELECT * FROM badges WHERE key=?').get(key)
        if (badge && !_db.prepare('SELECT id FROM badge_unlocks WHERE badge_id=?').get(badge.id)) {
          _db.prepare('INSERT OR IGNORE INTO badge_unlocks (badge_id) VALUES (?)').run(badge.id)
          badgesUnlocked.push(badge)
        }
      }
    }

    // Category sweep bonus (+10 XP if all daily quests in category done today).
    // Guarded against re-award: uncompleteQuest doesn't claw this back (it's a
    // once-per-day-per-category credit for the day, not tied to one quest), so
    // without this check toggling the triggering quest off/on would re-satisfy
    // catDoneToday===catDailyTotal and farm +10 XP indefinitely for free.
    //
    // This must run BEFORE level/coins are derived below: if the sweep bonus is
    // itself what crosses a level threshold, deriving level/coins from the
    // pre-sweep total would silently skip that level-up — no toast, no
    // coinsFromLevelUp, no level badge — and since getProfile() always derives
    // level fresh from total_xp, that transition could never be observed or
    // repaid on a later call once total_xp already reflects the higher level
    // (the coins for it would be lost for good).
    let finalTotalXp = afterQuestXp
    let sweepBonus   = 0
    const catDailyTotal = _db.prepare(`SELECT COUNT(*) as n FROM quests WHERE category_id=? AND frequency='daily' AND active=1`).get(quest.category_id)?.n ?? 0
    const catDoneToday = _db.prepare(`SELECT COUNT(*) as n FROM quest_completions qc JOIN quests q ON qc.quest_id=q.id WHERE q.category_id=? AND q.frequency='daily' AND qc.app_date=?`).get(quest.category_id, appDate)?.n ?? 0
    if (catDailyTotal > 0 && catDoneToday === catDailyTotal) {
      const rolloverHour = getRolloverHour()
      // occurred_at is stored in UTC (SQLite's datetime('now')); 'localtime' must
      // convert it to the OS-local wall clock BEFORE the rollover-hour shift, or
      // this disagrees with getAppDate() (which shifts local time) for any
      // non-UTC timezone during the window around the rollover hour equal in
      // size to the UTC offset.
      const alreadySwept = _db.prepare(
        `SELECT 1 FROM xp_log WHERE source_type='category_sweep' AND source_id=? AND date(occurred_at, 'localtime', ?)=?`
      ).get(quest.category_id, `-${rolloverHour} hours`, appDate)
      if (!alreadySwept) {
        sweepBonus  = 10
        finalTotalXp = afterQuestXp + sweepBonus
        _db.prepare(`INSERT INTO xp_log (amount,source_type,source_id,running_total,reason) VALUES (?,?,?,?,?)`)
          .run(sweepBonus, 'category_sweep', quest.category_id, finalTotalXp, catKey + ' category sweep bonus')
      }
    }

    // Level/coins are derived from the FINAL total (post-sweep) so a sweep-
    // triggered level-up is never missed.
    const oldLevel = levelForTotalXp(oldXp)
    const newLevelInfo = levelForTotalXp(finalTotalXp)
    const leveledUp = newLevelInfo.level > oldLevel.level
    // SychCoins: ~20% of XP per quest (min 1), plus level × 10 for each level gained
    const coinsFromQuest = Math.max(1, Math.round(xpAwarded * 0.2))
    let coinsFromLevelUp = 0
    if (leveledUp) {
      for (let L = oldLevel.level + 1; L <= newLevelInfo.level; L++) coinsFromLevelUp += L * 10
    }
    const coinsAwarded = coinsFromQuest + coinsFromLevelUp

    _db.prepare('UPDATE profile SET total_xp=?, current_level=?, sychcoins=sychcoins+? WHERE id=1')
      .run(finalTotalXp, newLevelInfo.level, coinsAwarded)

    if (leveledUp) {
      for (const [lvl, key] of [[5,'level_5'],[10,'level_10'],[20,'level_20']]) {
        if (newLevelInfo.level >= lvl) {
          const badge = _db.prepare('SELECT * FROM badges WHERE key=?').get(key)
          if (badge && !_db.prepare('SELECT id FROM badge_unlocks WHERE badge_id=?').get(badge.id)) {
            _db.prepare('INSERT OR IGNORE INTO badge_unlocks (badge_id) VALUES (?)').run(badge.id)
            badgesUnlocked.push(badge)
          }
        }
      }
    }

    return { xpAwarded, newTotalXp: finalTotalXp, sweepBonus, leveledUp, newLevel: newLevelInfo.level, newRank: rankForLevel(newLevelInfo.level), streak: { category: catKey, current: newStreak, bonusPct, freezeUsed }, badgesUnlocked, coinsAwarded, coinsFromLevelUp, coins: (_db.prepare('SELECT sychcoins FROM profile WHERE id=1').get()?.sychcoins ?? 0) }
  })

  return doComplete()
}

function uncompleteQuest(questId) {
  const todayAppDate = getAppDate()
  const quest = _db.prepare('SELECT * FROM quests WHERE id=?').get(questId)
  if (!quest) throw new Error('Quest not found: ' + questId)

  // Weekly quests can be completed on any day of the ISO week (listQuests/
  // completeQuest treat the whole %Y-%W week as "done"), so find that
  // completion's own row instead of only looking at today's app_date —
  // otherwise unticking a weekly quest completed earlier in the week
  // silently no-ops and the checkbox just snaps back on refresh.
  const completion = quest.frequency === 'weekly'
    ? (() => {
        const [weekStart, weekEnd] = isoWeekRange(todayAppDate)
        return _db.prepare(
          'SELECT * FROM quest_completions WHERE quest_id=? AND app_date BETWEEN ? AND ? ORDER BY app_date DESC LIMIT 1'
        ).get(questId, weekStart, weekEnd)
      })()
    : _db.prepare('SELECT * FROM quest_completions WHERE quest_id=? AND app_date=?').get(questId, todayAppDate)
  if (!completion) return { xpRemoved: 0 }
  const completionDate = completion.app_date

  const xpRemoved = completion.xp_awarded
  const profile = _db.prepare('SELECT * FROM profile WHERE id=1').get()
  const newTotal = Math.max(0, (profile?.total_xp ?? 0) - xpRemoved)
  const oldLevel = levelForTotalXp(profile?.total_xp ?? 0)
  const newLevel = levelForTotalXp(newTotal)

  // Claw back coins symmetrically (quest drop + any level-up bonus) so toggling can't farm coins
  let coinsRemoved = Math.max(1, Math.round(xpRemoved * 0.2))
  for (let L = newLevel.level + 1; L <= oldLevel.level; L++) coinsRemoved += L * 10

  _db.transaction(() => {
    // freeze_used/milestone_token_granted are day-level streak-transition effects
    // that completeQuest only ever sets on the FIRST completion of the day for a
    // category (later same-day completions hit the lastDate===appDate no-op
    // branch) — but in a multi-quest category, that flagged completion isn't
    // necessarily the one being undone here. If a same-day sibling completion
    // still exists (otherOnDate>0 below, so the streak revert below correctly
    // no-ops — the day still counts), deleting the flagged row outright would
    // permanently orphan the token grant: neither this deletion (skipped, day
    // still active) nor a later deletion of the sibling (which never carried the
    // flag) would ever claw it back, letting the already-fixed 2026-08-13
    // milestone-token farm resurface via a different multi-quest completion
    // order. Migrate the flags onto a remaining sibling first so whichever
    // completion ends up being the LAST one deleted for that date correctly
    // triggers the clawback.
    // pre_streak (migration v7) is the same kind of day-level, first-completion-
    // only marker as freeze_used/milestone_token_granted above — carry it along
    // in the same sibling migration so whichever completion ends up being the
    // LAST one deleted for that date is also the one uncompleteQuest's revert
    // block (below) can restore the true pre-day streak value from.
    if (completion.freeze_used || completion.milestone_token_granted || completion.pre_streak != null) {
      const sibling = _db.prepare(`SELECT qc.id FROM quest_completions qc JOIN quests q ON qc.quest_id=q.id WHERE q.category_id=? AND qc.app_date=? AND qc.id!=?`).get(quest.category_id, completionDate, completion.id)
      if (sibling) {
        _db.prepare('UPDATE quest_completions SET freeze_used=MAX(freeze_used,?), milestone_token_granted=MAX(milestone_token_granted,?), pre_streak=COALESCE(pre_streak,?) WHERE id=?')
          .run(completion.freeze_used ? 1 : 0, completion.milestone_token_granted ? 1 : 0, completion.pre_streak, sibling.id)
      }
    }
    _db.prepare('DELETE FROM quest_completions WHERE id=?').run(completion.id)
    _db.prepare('UPDATE profile SET total_xp=?, current_level=?, sychcoins=MAX(0,sychcoins-?) WHERE id=1').run(newTotal, newLevel.level, coinsRemoved)
    _db.prepare(`INSERT INTO xp_log (amount,source_type,source_id,running_total,reason) VALUES (?,?,?,?,?)`)
      .run(-xpRemoved, 'manual_adjust', questId, newTotal, 'Uncompleted: ' + quest.name)

    // Revert streak if no other completions on that same date in this category.
    // Use completionDate (the day this completion actually landed on), not
    // today — a weekly quest's completion may be several days old by the time
    // it's unticked, and that's the date whose streak effect must be undone.
    const otherOnDate = _db.prepare(`SELECT COUNT(*) as n FROM quest_completions qc JOIN quests q ON qc.quest_id=q.id WHERE q.category_id=? AND qc.app_date=? AND qc.quest_id!=?`).get(quest.category_id, completionDate, questId)?.n ?? 0
    if (otherOnDate === 0) {
      // Restore last_completion_date to the true most-recent prior completion (or
      // NULL if there truly is none) — not unconditionally NULL. Nulling it here
      // makes completeQuest treat the next completion as "first ever" (the
      // `!lastDate` branch), which always grants +1 regardless of how many days
      // were actually skipped, permanently disabling streak breaks/soft-resets
      // for this category after any complete→uncomplete cycle.
      const prevCompletion = _db.prepare(`
        SELECT MAX(qc.app_date) as d FROM quest_completions qc JOIN quests q ON qc.quest_id=q.id
        WHERE q.category_id=? AND qc.app_date<?
      `).get(quest.category_id, completionDate)?.d ?? null
      // If this completion was the one that bridged a missed day by spending a
      // freeze token, undoing it must refund the token — otherwise a
      // complete->uncomplete cycle permanently burns a token for nothing, since
      // the streak effect it paid for is being reverted right here. Symmetrically,
      // if this completion was the one that *granted* a 7-day-milestone token,
      // undoing it must claw that token back too — otherwise a repeated
      // complete-to-7/uncomplete cycle farms unlimited (capped) free freeze
      // tokens while the streak itself always correctly reverts to 6.
      const freezeRestored = !!completion.freeze_used
      const milestoneClawback = !!completion.milestone_token_granted
      const tokenDelta = (freezeRestored ? 1 : 0) - (milestoneClawback ? 1 : 0)
      // current_streak=current_streak-1 is only a correct inverse for the plain
      // +1 and freeze-bridge completion branches. completeQuest's broken-streak
      // branch instead sets current_streak to a soft/hard-reset value (a
      // non-linear transform of the pre-completion streak), which -1 doesn't
      // undo — restore the exact pre-completion value recorded at completion
      // time instead, when available (migration v7; older rows predating it, or
      // an imported backup without the column, fall back to the -1 approximation
      // rather than fail).
      if (completion.pre_streak != null) {
        _db.prepare(`UPDATE streaks SET current_streak=?, last_completion_date=?, freeze_tokens=MAX(0,MIN(3,freeze_tokens+?)) WHERE category_id=?`)
          .run(completion.pre_streak, prevCompletion, tokenDelta, quest.category_id)
      } else {
        _db.prepare(`UPDATE streaks SET current_streak=MAX(0,current_streak-1), last_completion_date=?, freeze_tokens=MAX(0,MIN(3,freeze_tokens+?)) WHERE category_id=?`)
          .run(prevCompletion, tokenDelta, quest.category_id)
      }
    }
  })()

  return { xpRemoved, newTotal, coinsRemoved, coins: getCoins() }
}

// ── SychCoins & shop ─────────────────────────────────────────────────────────

function getCoins() {
  return _db.prepare('SELECT sychcoins FROM profile WHERE id=1').get()?.sychcoins ?? 0
}

// Server-side prices + equip-slot types for cosmetic shop items — must stay in
// sync with SHOP_ITEMS in src/renderer.js. The renderer's catalog exists only
// client-side, so without this, purchaseItem() had to trust whatever `cost` the
// IPC caller supplied for whatever `itemKey` it supplied; anyone driving the IPC
// bridge directly (e.g. devtools console) could buy any real item for 0 coins,
// or "own" a made-up key, by simply passing a different cost — same trust gap as
// the negative-cost bug fixed 2026-07-22, just for the price itself rather than
// its sign. `type` additionally backs equipItem()'s ownership check below.
const SHOP_CATALOG = {
  accent_white: { cost: 0, type: 'accent' }, accent_cyan: { cost: 50, type: 'accent' }, accent_purple: { cost: 75, type: 'accent' }, accent_red: { cost: 75, type: 'accent' }, accent_emerald: { cost: 75, type: 'accent' }, accent_gold: { cost: 100, type: 'accent' },
  font_grotesk: { cost: 0, type: 'font' }, font_inter: { cost: 50, type: 'font' }, font_mono: { cost: 75, type: 'font' },
  bg_deepspace: { cost: 0, type: 'bg' }, bg_nebula: { cost: 100, type: 'bg' }, bg_carbon: { cost: 150, type: 'bg' }, bg_aurora: { cost: 150, type: 'bg' },
  card_standard: { cost: 0, type: 'card' }, card_glow: { cost: 100, type: 'card' }, card_glass: { cost: 150, type: 'card' },
  orb_white: { cost: 0, type: 'orb' }, orb_cyan: { cost: 100, type: 'orb' }, orb_gold: { cost: 150, type: 'orb' }
}

function purchaseItem(itemKey, cost) {
  const entry = SHOP_CATALOG[itemKey]
  if (entry === undefined) return { ok: false, error: 'unknown_item' }
  const price = entry.cost
  const doBuy = _db.transaction(() => {
    const coins = getCoins()
    let owned = []
    try { owned = JSON.parse(getSetting('shop_owned') || '[]') } catch (e) { owned = [] }
    if (owned.includes(itemKey)) return { ok: false, error: 'already_owned', coins, owned }
    if (coins < price) return { ok: false, error: 'insufficient', coins, owned }
    _db.prepare('UPDATE profile SET sychcoins=? WHERE id=1').run(coins - price)
    owned.push(itemKey)
    setSetting('shop_owned', JSON.stringify(owned))
    return { ok: true, coins: coins - price, owned }
  })
  return doBuy()
}

// Equips a cosmetic into its slot (equip_accent/font/bg/card/orb in settings),
// server-side gated on ownership — the actual write path a purchased/free item
// takes to become active. Before this, equipShopItem() in the renderer wrote
// straight through the generic `settings:set` IPC channel with no ownership
// check anywhere (client or server): SHOP_ITEMS' cost/ownership gating lived
// only in the renderer's own button-rendering logic, so driving the IPC bridge
// directly (e.g. window.sychboard.settings.set('equip_bg','bg_aurora')) could
// equip any real cosmetic for 0 coins — the same "don't trust the client" gap
// purchaseItem()'s SHOP_CATALOG closed for buying, just left open for equipping.
function equipItem(itemKey) {
  const entry = SHOP_CATALOG[itemKey]
  if (entry === undefined) return { ok: false, error: 'unknown_item' }
  if (entry.cost > 0) {
    let owned = []
    try { owned = JSON.parse(getSetting('shop_owned') || '[]') } catch (e) { owned = [] }
    if (!owned.includes(itemKey)) return { ok: false, error: 'not_owned' }
  }
  setSetting('equip_' + entry.type, itemKey)
  return { ok: true, type: entry.type }
}

// Buys a Streak Freeze consumable: checks balance, deducts coins, and grants the
// tokens all inside one transaction, so two overlapping purchase clicks can't
// both read "sufficient balance" before either deduction lands (the same
// double-spend shape as the already-fixed weekly-quest/sweep-bonus farms) —
// unlike the old renderer path, which called coins:award then streaks:add-freeze
// as two separate non-atomic IPC round-trips.
const FREEZE_TOKEN_COST = 150 // must stay in sync with the 'freeze_token' entry in SHOP_ITEMS

function purchaseFreeze() {
  const price = FREEZE_TOKEN_COST
  const doBuy = _db.transaction(() => {
    const coins = getCoins()
    if (coins < price) return { ok: false, error: 'insufficient', coins }
    _db.prepare('UPDATE profile SET sychcoins=? WHERE id=1').run(coins - price)
    _db.prepare('UPDATE streaks SET freeze_tokens=MIN(3,freeze_tokens+1)').run()
    return { ok: true, coins: coins - price, freezes: _db.prepare('SELECT category_id, freeze_tokens FROM streaks').all() }
  })
  return doBuy()
}

function getXpHistory(days = 7) {
  const n = Math.min(60, Math.max(1, Math.round(Number(days) || 7)))
  const map = {}
  // Group by APP date (shift by the rollover hour) so 1am grinding counts
  // toward the same bar as the evening before, matching quests/streaks.
  // occurred_at is stored in UTC (SQLite's datetime('now')) — 'localtime' must
  // convert to the OS-local wall clock before the rollover shift, or this
  // disagrees with getAppDate() for any non-UTC timezone near the rollover hour.
  const rolloverHour = getRolloverHour()
  _db.prepare(`SELECT date(occurred_at, 'localtime', ?) as d, SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) as xp FROM xp_log GROUP BY d ORDER BY d DESC LIMIT 60`)
    .all(`-${rolloverHour} hours`).forEach(r => { map[r.d] = r.xp })
  const out = []
  const anchor = parseLocalDate(getAppDate())
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(anchor)
    dt.setDate(dt.getDate() - i)
    const key = formatLocalDate(dt)
    out.push({ date: key, xp: map[key] || 0, label: dt.toLocaleDateString('en-GB', { weekday: 'short' }) })
  }
  return out
}

function getProfile() {
  const profile = _db.prepare('SELECT * FROM profile WHERE id=1').get()
  const totalXp = profile?.total_xp ?? 0
  const { level, currentLevelXp, xpToNext } = levelForTotalXp(totalXp)
  return { totalXp, level, currentLevelXp, xpToNext, rank: rankForLevel(level), displayName: profile?.display_name ?? 'Operator' }
}

function getStreaks() {
  const categories = _db.prepare(`SELECT s.*, c.name, c.key, c.icon, c.color FROM streaks s JOIN categories c ON s.category_id=c.id`).all()
  const appDate = getAppDate()
  // Per-category current_streak is only updated inside completeQuest/uncompleteQuest,
  // i.e. only when that category is actually touched — so it never decays on its own
  // and stays stuck at its last value indefinitely once a category goes cold (unlike
  // the global streak below, which was already fixed to check liveness on every
  // read). Apply the same "1-day gap alive, 2+ broken" threshold here for display,
  // without touching the stored value: completeQuest independently recomputes the
  // real transition from last_completion_date the next time that category is
  // actually completed, so this is read-only and can't desync that logic.
  const yesterdayForCats = parseLocalDate(appDate)
  yesterdayForCats.setDate(yesterdayForCats.getDate() - 1)
  const yesterdayForCatsStr = formatLocalDate(yesterdayForCats)
  for (const c of categories) {
    if (c.last_completion_date && c.last_completion_date !== appDate && c.last_completion_date !== yesterdayForCatsStr) {
      c.current_streak = 0
    }
  }
  // Global engagement streak: consecutive days with any completion
  let globalStreak = 0, globalLongest = 0
  const completionDates = _db.prepare(`SELECT DISTINCT app_date FROM quest_completions ORDER BY app_date DESC LIMIT 400`).all().map(r => r.app_date)
  if (completionDates.length) {
    // The streak isn't broken just because *today* has no completion yet — it's
    // only broken once a full day has passed with no activity (same threshold
    // completeQuest uses: a 1-day-old last completion is still "alive", a
    // 2+-day-old one is broken). Anchor the walk at the most recent activity
    // date if that's today or yesterday, so the widget doesn't show 0 every
    // single morning before the user has completed anything.
    const yesterday = parseLocalDate(appDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatLocalDate(yesterday)
    let check = null
    if (completionDates[0] === appDate) check = parseLocalDate(appDate)
    else if (completionDates[0] === yesterdayStr) check = yesterday
    if (check) {
      for (const d of completionDates) {
        const checkStr = formatLocalDate(check)
        if (d === checkStr) { globalStreak++; check.setDate(check.getDate() - 1) }
        else break
      }
    }
    // Compute longest. These two are only ever subtracted from each other (never
    // fed through getDate()/setDate() or re-serialized), so parsing them as UTC
    // midnight here is safe — the day-diff comes out the same either way.
    let run = 1
    for (let i = 1; i < completionDates.length; i++) {
      const a = new Date(completionDates[i-1]), b = new Date(completionDates[i])
      const diff = Math.round((a - b) / 86400000)
      if (diff === 1) { run++ } else { if (run > globalLongest) globalLongest = run; run = 1 }
    }
    if (run > globalLongest) globalLongest = run
  }
  return { categories, globalStreak, globalLongest }
}

function listBadges() {
  return _db.prepare(`
    SELECT b.*, CASE WHEN bu.id IS NOT NULL THEN 1 ELSE 0 END as unlocked, bu.unlocked_at
    FROM badges b LEFT JOIN badge_unlocks bu ON bu.badge_id=b.id
    ORDER BY b.category_id NULLS LAST, b.id
  `).all()
}

function getRecentActivity(limit = 8) {
  return _db.prepare(`
    SELECT qc.completed_at, qc.xp_awarded, q.name as quest_name, c.icon as category_icon, c.color as category_color
    FROM quest_completions qc JOIN quests q ON qc.quest_id=q.id JOIN categories c ON q.category_id=c.id
    ORDER BY qc.completed_at DESC LIMIT ?
  `).all(limit)
}

function getSetting(key) {
  return _db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? null
}

function setSetting(key, value) {
  _db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value))
}

// ── Data export / import ────────────────────────────────────────────────────
// Dumps every user-generated table (not the static quest/category/badge
// catalog, which is reseeded by migrate() on any DB) so a restore only needs
// to replay progress, not the schema's seed data.
function exportGameData() {
  return {
    profile: _db.prepare('SELECT display_name, total_xp, current_level, sychcoins FROM profile WHERE id=1').get(),
    quest_completions: _db.prepare('SELECT quest_id, app_date, completed_at, xp_awarded, streak_bonus_pct, notes, freeze_used, milestone_token_granted, pre_streak FROM quest_completions').all(),
    streaks: _db.prepare('SELECT category_id, current_streak, longest_streak, last_completion_date, freeze_tokens FROM streaks').all(),
    xp_log: _db.prepare('SELECT occurred_at, amount, source_type, source_id, running_total, reason FROM xp_log').all(),
    badge_unlocks: _db.prepare('SELECT badge_id, unlocked_at FROM badge_unlocks').all(),
    settings: _db.prepare('SELECT key, value FROM settings').all()
  }
}

// Replaces all user-generated game data with the given export. Validates
// shape before touching anything; runs as one transaction so a malformed or
// partially-invalid file can't leave the DB half-wiped. current_level is
// always re-derived from total_xp rather than trusted from the import, same
// as every in-app write path (getProfile() never reads the stored column).
function importGameData(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_data' }
  const { profile, quest_completions, streaks, xp_log, badge_unlocks, settings } = data
  if (!profile || typeof profile !== 'object' || !Array.isArray(quest_completions) ||
      !Array.isArray(streaks) || !Array.isArray(xp_log) || !Array.isArray(badge_unlocks) ||
      !Array.isArray(settings)) {
    return { ok: false, error: 'malformed_data' }
  }

  const doImport = _db.transaction(() => {
    _db.prepare('DELETE FROM quest_completions').run()
    _db.prepare('DELETE FROM xp_log').run()
    _db.prepare('DELETE FROM badge_unlocks').run()
    _db.prepare('DELETE FROM streaks').run()
    _db.prepare('DELETE FROM settings').run()

    const totalXp = Math.max(0, Math.round(Number(profile.total_xp) || 0))
    const { level } = levelForTotalXp(totalXp)
    _db.prepare('UPDATE profile SET display_name=?, total_xp=?, current_level=?, sychcoins=? WHERE id=1')
      .run(String(profile.display_name ?? 'Operator').slice(0, 40), totalXp, level, Math.max(0, Math.round(Number(profile.sychcoins) || 0)))

    const insSetting = _db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)')
    for (const s of settings) if (s && typeof s.key === 'string') insSetting.run(s.key, String(s.value ?? ''))
    // These are relied on elsewhere (getAppDate, soft-reset, shop) — restore
    // defaults if the import predates them or omitted them.
    if (getSetting('day_rollover_hour') == null) insSetting.run('day_rollover_hour', '4')
    if (getSetting('soft_reset_enabled') == null) insSetting.run('soft_reset_enabled', '1')
    if (getSetting('shop_owned') == null) insSetting.run('shop_owned', '[]')

    // equipItem()'s ownership check (2026-08-13) only guards the live shop:equip
    // IPC path — a restored backup writes equip_* settings directly via the loop
    // above with no such check, so a crafted/hand-edited file could equip any
    // paid cosmetic with shop_owned left empty, bypassing the SychCoins economy
    // the same way the pre-fix equip path did. Re-validate every restored
    // equip_* slot against the (now-finalized) shop_owned list here.
    let restoredOwned = []
    try { restoredOwned = JSON.parse(getSetting('shop_owned') || '[]') } catch (e) { restoredOwned = [] }
    const delSetting = _db.prepare('DELETE FROM settings WHERE key=?')
    for (const type of ['accent', 'font', 'bg', 'card', 'orb']) {
      const key = 'equip_' + type
      const val = getSetting(key)
      if (val == null) continue
      const entry = SHOP_CATALOG[val]
      if (!entry || entry.type !== type || (entry.cost > 0 && !restoredOwned.includes(val))) delSetting.run(key)
    }

    const insStreak = _db.prepare('INSERT INTO streaks (category_id,current_streak,longest_streak,last_completion_date,freeze_tokens) VALUES (?,?,?,?,?)')
    for (const s of streaks) {
      if (!Number.isInteger(s?.category_id)) continue
      insStreak.run(s.category_id, Math.max(0, Math.round(Number(s.current_streak) || 0)), Math.max(0, Math.round(Number(s.longest_streak) || 0)),
        typeof s.last_completion_date === 'string' ? s.last_completion_date : null, Math.min(3, Math.max(0, Math.round(Number(s.freeze_tokens) || 0))))
    }

    const insCompletion = _db.prepare('INSERT OR IGNORE INTO quest_completions (quest_id,app_date,completed_at,xp_awarded,streak_bonus_pct,notes,freeze_used,milestone_token_granted,pre_streak) VALUES (?,?,?,?,?,?,?,?,?)')
    for (const c of quest_completions) {
      if (!Number.isInteger(c?.quest_id) || typeof c?.app_date !== 'string') continue
      insCompletion.run(c.quest_id, c.app_date, typeof c.completed_at === 'string' ? c.completed_at : sqliteNow(),
        Math.round(Number(c.xp_awarded) || 0), Number(c.streak_bonus_pct) || 0, typeof c.notes === 'string' ? c.notes : null, c.freeze_used ? 1 : 0, c.milestone_token_granted ? 1 : 0,
        Number.isInteger(c.pre_streak) ? c.pre_streak : null)
    }

    const insXp = _db.prepare('INSERT INTO xp_log (occurred_at,amount,source_type,source_id,running_total,reason) VALUES (?,?,?,?,?,?)')
    for (const x of xp_log) {
      if (typeof x?.source_type !== 'string') continue
      insXp.run(typeof x.occurred_at === 'string' ? x.occurred_at : sqliteNow(), Math.round(Number(x.amount) || 0),
        x.source_type, Number.isInteger(x.source_id) ? x.source_id : null, Math.round(Number(x.running_total) || 0), typeof x.reason === 'string' ? x.reason : null)
    }

    const insBadge = _db.prepare('INSERT OR IGNORE INTO badge_unlocks (badge_id,unlocked_at) VALUES (?,?)')
    for (const b of badge_unlocks) {
      if (!Number.isInteger(b?.badge_id)) continue
      insBadge.run(b.badge_id, typeof b.unlocked_at === 'string' ? b.unlocked_at : sqliteNow())
    }
  })

  try {
    doImport()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Wipes all user-generated game progress (profile/streaks/xp/completions/
// badges/settings) back to fresh-install defaults, in one transaction. Does
// not touch the static quest/category/badge catalog (reseeded by migrate()).
function clearGameData() {
  const doClear = _db.transaction(() => {
    _db.prepare('DELETE FROM quest_completions').run()
    _db.prepare('DELETE FROM xp_log').run()
    _db.prepare('DELETE FROM badge_unlocks').run()
    _db.prepare('DELETE FROM streaks').run()
    _db.prepare('DELETE FROM settings').run()
    _db.prepare("UPDATE profile SET display_name='Operator', total_xp=0, current_level=1, sychcoins=0 WHERE id=1").run()
    _db.prepare('INSERT INTO streaks (category_id) SELECT id FROM categories').run()
    _db.prepare("INSERT INTO settings VALUES ('day_rollover_hour','4')").run()
    _db.prepare("INSERT INTO settings VALUES ('soft_reset_enabled','1')").run()
    _db.prepare("INSERT INTO settings VALUES ('shop_owned','[]')").run()
  })

  try {
    doClear()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

module.exports = { initDB, listQuests, completeQuest, uncompleteQuest, getProfile, getStreaks, listBadges, getRecentActivity, getSetting, setSetting, getCoins, purchaseItem, purchaseFreeze, equipItem, getXpHistory, exportGameData, importGameData, clearGameData }
