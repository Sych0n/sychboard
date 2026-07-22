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

function getAppDate() {
  const rolloverHour = parseInt(_db?.prepare("SELECT value FROM settings WHERE key='day_rollover_hour'").get()?.value ?? '4')
  const now = new Date()
  if (now.getHours() < rolloverHour) now.setDate(now.getDate() - 1)
  return now.toISOString().split('T')[0]
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
    `}
  ]

  const newlyApplied = []
  for (const m of migrations) {
    if (!applied.has(m.version)) {
      _db.exec(m.sql)
      _db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version)
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
  // Weekly quests count as completed for the whole %Y-%W week; daily/epic per app-day.
  return _db.prepare(`
    SELECT q.*, c.name as category_name, c.key as category_key, c.icon as category_icon, c.color as category_color,
      CASE
        WHEN q.frequency = 'weekly' THEN
          EXISTS(SELECT 1 FROM quest_completions w WHERE w.quest_id = q.id
                 AND strftime('%Y-%W', w.app_date) = strftime('%Y-%W', ?))
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
  `).all(appDate, appDate, appDate)
}

function completeQuest(questId) {
  const appDate = getAppDate()
  const quest = _db.prepare('SELECT * FROM quests WHERE id = ?').get(questId)
  if (!quest) throw new Error('Quest not found: ' + questId)

  // Weekly quests: one completion per ISO-ish week (%Y-%W), not per day
  if (quest.frequency === 'weekly') {
    const doneThisWeek = _db.prepare(
      "SELECT 1 FROM quest_completions WHERE quest_id=? AND strftime('%Y-%W', app_date)=strftime('%Y-%W', ?)"
    ).get(questId, appDate)
    if (doneThisWeek) throw new Error('Weekly quest already completed this week')
  }

  const streak = _db.prepare('SELECT * FROM streaks WHERE category_id = ?').get(quest.category_id)
  const currentStreak = streak?.current_streak ?? 0
  const bonusPct = streakBonusPct(currentStreak)
  const xpAwarded = Math.round(quest.base_xp * (1 + bonusPct))

  const profile = _db.prepare('SELECT * FROM profile WHERE id = 1').get()
  const oldXp = profile?.total_xp ?? 0
  const newTotalXp = oldXp + xpAwarded
  const oldLevel = levelForTotalXp(oldXp)
  const newLevelInfo = levelForTotalXp(newTotalXp)
  const leveledUp = newLevelInfo.level > oldLevel.level

  const catKey = { 1:'health', 2:'productivity', 3:'creativity', 4:'finance' }[quest.category_id] ?? 'health'

  // SychCoins: ~20% of XP per quest (min 1), plus level × 10 for each level gained
  const coinsFromQuest = Math.max(1, Math.round(xpAwarded * 0.2))
  let coinsFromLevelUp = 0
  if (leveledUp) {
    for (let L = oldLevel.level + 1; L <= newLevelInfo.level; L++) coinsFromLevelUp += L * 10
  }
  const coinsAwarded = coinsFromQuest + coinsFromLevelUp

  const doComplete = _db.transaction(() => {
    _db.prepare(`INSERT INTO quest_completions (quest_id,app_date,xp_awarded,streak_bonus_pct) VALUES (?,?,?,?)`)
      .run(questId, appDate, xpAwarded, bonusPct)
    _db.prepare('UPDATE profile SET total_xp=?, current_level=?, sychcoins=sychcoins+? WHERE id=1')
      .run(newTotalXp, newLevelInfo.level, coinsAwarded)
    _db.prepare(`INSERT INTO xp_log (amount,source_type,source_id,running_total,reason) VALUES (?,?,?,?,?)`)
      .run(xpAwarded, 'quest_completion', questId, newTotalXp, 'Completed: ' + quest.name)

    // Update streak — "yesterday" must be relative to the APP date, not the wall
    // clock, or completions between midnight and the rollover hour wrongly
    // count as a broken streak.
    const lastDate = streak?.last_completion_date
    const yesterday = new Date(appDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const dayBeforeYesterday = new Date(appDate)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0]

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
    if (newStreak % 7 === 0 && newStreak > currentStreak) tokens = Math.min(tokens + 1, 3)

    if (streak && lastDate !== appDate) {
      _db.prepare(`UPDATE streaks SET current_streak=?,longest_streak=?,last_completion_date=?,freeze_tokens=? WHERE category_id=?`)
        .run(newStreak, longest, appDate, tokens, quest.category_id)
    } else if (!streak) {
      _db.prepare(`INSERT INTO streaks (category_id,current_streak,longest_streak,last_completion_date,freeze_tokens) VALUES (?,1,1,?,0)`)
        .run(quest.category_id, appDate)
    }

    // Check streak & level badges
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

    // Category sweep bonus (+10 XP if all daily quests in category done today).
    // Guarded against re-award: uncompleteQuest doesn't claw this back (it's a
    // once-per-day-per-category credit for the day, not tied to one quest), so
    // without this check toggling the triggering quest off/on would re-satisfy
    // catDoneToday===catDailyTotal and farm +10 XP indefinitely for free.
    let finalTotalXp = newTotalXp
    let sweepBonus   = 0
    const catDailyTotal = _db.prepare(`SELECT COUNT(*) as n FROM quests WHERE category_id=? AND frequency='daily' AND active=1`).get(quest.category_id)?.n ?? 0
    const catDoneToday = _db.prepare(`SELECT COUNT(*) as n FROM quest_completions qc JOIN quests q ON qc.quest_id=q.id WHERE q.category_id=? AND q.frequency='daily' AND qc.app_date=?`).get(quest.category_id, appDate)?.n ?? 0
    if (catDailyTotal > 0 && catDoneToday === catDailyTotal) {
      const rolloverHour = parseInt(_db.prepare("SELECT value FROM settings WHERE key='day_rollover_hour'").get()?.value ?? '4')
      const alreadySwept = _db.prepare(
        `SELECT 1 FROM xp_log WHERE source_type='category_sweep' AND source_id=? AND date(occurred_at, ?)=?`
      ).get(quest.category_id, `-${rolloverHour} hours`, appDate)
      if (!alreadySwept) {
        sweepBonus  = 10
        finalTotalXp = newTotalXp + sweepBonus
        _db.prepare('UPDATE profile SET total_xp=? WHERE id=1').run(finalTotalXp)
        _db.prepare(`INSERT INTO xp_log (amount,source_type,source_id,running_total,reason) VALUES (?,?,?,?,?)`)
          .run(sweepBonus, 'category_sweep', quest.category_id, finalTotalXp, catKey + ' category sweep bonus')
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
    ? _db.prepare(
        "SELECT * FROM quest_completions WHERE quest_id=? AND strftime('%Y-%W', app_date)=strftime('%Y-%W', ?) ORDER BY app_date DESC LIMIT 1"
      ).get(questId, todayAppDate)
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
      // the streak effect it paid for is being reverted right here.
      const freezeRestored = !!completion.freeze_used
      _db.prepare(`UPDATE streaks SET current_streak=MAX(0,current_streak-1), last_completion_date=?, freeze_tokens=MIN(3,freeze_tokens+?) WHERE category_id=?`)
        .run(prevCompletion, freezeRestored ? 1 : 0, quest.category_id)
    }
  })()

  return { xpRemoved, newTotal, coinsRemoved, coins: getCoins() }
}

// ── SychCoins & shop ─────────────────────────────────────────────────────────

function getCoins() {
  return _db.prepare('SELECT sychcoins FROM profile WHERE id=1').get()?.sychcoins ?? 0
}

function purchaseItem(itemKey, cost) {
  const numCost = Number(cost)
  if (!Number.isFinite(numCost) || numCost < 0) return { ok: false, error: 'invalid_cost' }
  const price = Math.round(numCost)
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

// Buys a Streak Freeze consumable: checks balance, deducts coins, and grants the
// tokens all inside one transaction, so two overlapping purchase clicks can't
// both read "sufficient balance" before either deduction lands (the same
// double-spend shape as the already-fixed weekly-quest/sweep-bonus farms) —
// unlike the old renderer path, which called coins:award then streaks:add-freeze
// as two separate non-atomic IPC round-trips.
function purchaseFreeze(cost) {
  const numCost = Number(cost)
  if (!Number.isFinite(numCost) || numCost < 0) return { ok: false, error: 'invalid_cost' }
  const price = Math.round(numCost)
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
  const rolloverHour = parseInt(_db.prepare("SELECT value FROM settings WHERE key='day_rollover_hour'").get()?.value ?? '4')
  _db.prepare(`SELECT date(occurred_at, ?) as d, SUM(CASE WHEN amount>0 THEN amount ELSE 0 END) as xp FROM xp_log GROUP BY d ORDER BY d DESC LIMIT 60`)
    .all(`-${rolloverHour} hours`).forEach(r => { map[r.d] = r.xp })
  const out = []
  const anchor = new Date(getAppDate())
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(anchor)
    dt.setDate(dt.getDate() - i)
    const key = dt.toISOString().split('T')[0]
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
  // Global engagement streak: consecutive days with any completion
  const appDate = getAppDate()
  let globalStreak = 0, globalLongest = 0
  const completionDates = _db.prepare(`SELECT DISTINCT app_date FROM quest_completions ORDER BY app_date DESC LIMIT 400`).all().map(r => r.app_date)
  if (completionDates.length) {
    const check = new Date(appDate)
    for (const d of completionDates) {
      const checkStr = check.toISOString().split('T')[0]
      if (d === checkStr) { globalStreak++; check.setDate(check.getDate() - 1) }
      else break
    }
    // Compute longest
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

function updateDisplayName(name) {
  _db.prepare('UPDATE profile SET display_name=? WHERE id=1').run(name)
}

module.exports = { initDB, listQuests, completeQuest, uncompleteQuest, getProfile, getStreaks, listBadges, getRecentActivity, getSetting, setSetting, updateDisplayName, getCoins, purchaseItem, purchaseFreeze, getXpHistory }
