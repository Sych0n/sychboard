'use strict'
// Turns a *subset* of SychBoard's state into Obsidian-friendly markdown files.
// Pure: no fs, no Electron. Only an explicit allowlist of "note-like" data is ever exported —
// never balances, API keys, chat history, sleep logs, etc.
//
// Every file carries `source: sychboard` in its frontmatter. vault.js only ever overwrites files
// that carry that marker, so a note Daniel writes by hand can never be clobbered.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SECTION_LABELS = { finance: 'Finance', uni: 'Uni', youtube: 'YouTube', schedule: 'Schedule', fitness: 'Fitness', travel: 'Travel' }
const MAX_TEXT = 100000
const MAX_ITEM = 300

const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
const text = (v, max = MAX_TEXT) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').slice(0, max) : '')
const oneLine = v => text(v, MAX_ITEM).replace(/\s*\n\s*/g, ' ').trim()

function front(type, extra = {}) {
  const lines = ['---', 'source: sychboard', `type: ${type}`]
  for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${v}`)
  lines.push(`tags: [sychboard, ${type}]`, '---', '')
  return lines.join('\n')
}

function checklist(items) {
  const out = []
  for (const it of Array.isArray(items) ? items : []) {
    if (!isObj(it)) continue
    const t = oneLine(it.text)
    if (t) out.push(`- [${it.done ? 'x' : ' '}] ${t}`)
  }
  return out
}

function journalFiles(journals) {
  const files = []
  if (!isObj(journals)) return files
  for (const date of Object.keys(journals).sort()) {
    if (!DATE_RE.test(date)) continue            // also blocks any path trickery in the key
    const body = text(journals[date])
    if (!body.trim()) continue
    files.push({ relPath: `SychBoard/Journal/${date}.md`, content: `${front('journal', { date })}\n# ${date}\n\n${body.replace(/\s+$/, '')}\n` })
  }
  return files
}

function goalsFile(goals) {
  const items = (Array.isArray(goals) ? goals : []).filter(isObj).map(g => ({ text: oneLine(g.text), cat: oneLine(g.category).replace(/\s+/g, '-'), done: !!g.done })).filter(g => g.text)
  if (!items.length) return null
  const line = g => `- [${g.done ? 'x' : ' '}] ${g.text}${g.cat ? ` #${g.cat}` : ''}`
  const active = items.filter(g => !g.done).map(line), done = items.filter(g => g.done).map(line)
  const parts = [front('goals'), '# Goals', '']
  parts.push('## Active', '', ...(active.length ? active : ['_none_']), '')
  if (done.length) parts.push('## Done', '', ...done, '')
  return { relPath: 'SychBoard/Goals.md', content: parts.join('\n') }
}

function todosFile(s) {
  const parts = [front('todos'), '# Todos', '']
  const focus = oneLine(s.todayFocus)
  if (focus) parts.push(`**Today's focus:** ${focus}`, '')
  let any = !!focus
  const add = (title, items) => {
    const lines = checklist(items)
    if (!lines.length) return
    any = true
    parts.push(`## ${title}`, '', ...lines, '')
  }
  add('Setup', s.setupTodos)
  add('General', s.genTodos)
  if (isObj(s.secTodos)) for (const [k, label] of Object.entries(SECTION_LABELS)) add(label, s.secTodos[k])
  add('Dev / Side Project', s.devTodos)
  return any ? { relPath: 'SychBoard/Todos.md', content: parts.join('\n') } : null
}

function notesFile(s) {
  const uni = text(s.uniNotes), fit = text(s.fitnessNotes)
  if (!uni.trim() && !fit.trim()) return null
  const parts = [front('notes'), '# Notes', '']
  if (uni.trim()) parts.push('## Uni', '', uni.replace(/\s+$/, ''), '')
  if (fit.trim()) parts.push('## Fitness', '', fit.replace(/\s+$/, ''), '')
  return { relPath: 'SychBoard/Notes.md', content: parts.join('\n') }
}

// ── Gaming tab (summary rows read by the main process; never taken from the renderer) ──
const cell = v => oneLine(v).replace(/\|/g, '\\|').replace(/\[\[/g, '[ [') || ' '
const fnum = (v, digits = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '–')
const dayOf = v => (typeof v === 'string' ? v.slice(0, 10) : '')
const PATH_LABEL = { direct: 'Direct flip', 'composed-flip': 'Composed flip', 'composed-copy': 'Composed copy', copy: 'Legacy copy', unknown: 'Unknown' }
const pathLabel = k => PATH_LABEL[k] || ''
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)]
const rowsOf = v => (Array.isArray(v) ? v.filter(isObj) : [])

function captureSummary(c, pre) {
  if (c[pre + '_label'] == null) return '–'
  const bits = [`${fnum(c[pre + '_avg_fps'])} fps`, `1% low ${fnum(c[pre + '_low1_fps'])}`]
  if (pathLabel(c[pre + '_present_kind'])) bits.push(pathLabel(c[pre + '_present_kind']))
  return cell(`${c[pre + '_label']} (${bits.join(', ')})`)
}

function gamingFiles(g) {
  if (!isObj(g)) return []
  const files = []
  const out = (name, type, title, intro, tables) => {
    const parts = [front(type), `# ${title}`, '', intro, '']
    for (const [h, lines] of tables) parts.push(...(h ? [`## ${h}`, ''] : []), ...lines, '')
    files.push({ relPath: `SychBoard/Gaming/${name}.md`, content: parts.join('\n') })
  }

  const changes = rowsOf(g.changes)
  if (changes.length) {
    out('Change Log', 'gaming-changes', 'Gaming change log',
      'One setting changed at a time, with the PresentMon captures taken before and after. Verdict: testing, keep or revert.',
      [[null, table(['Date', 'Change', 'Before', 'After', 'Felt', 'Verdict', 'Notes'], changes.map(c => [
        cell(dayOf(c.date)), cell(c.what), captureSummary(c, 'b'), captureSummary(c, 'a'),
        Number.isInteger(c.felt) ? `${c.felt}/5` : '–', cell(c.verdict), cell(c.notes)]))]])
  }

  const caps = rowsOf(g.captures)
  if (caps.length) {
    out('Captures', 'gaming-captures', 'Frametime captures',
      'Saved PresentMon captures (newest first). Lows are the average of the slowest 1% / 0.1% of frames; spikes are frames slower than 2x the median.',
      [[null, table(['Saved', 'Label', 'App', 'Avg FPS', '1% low', '0.1% low', 'Spikes', 'Worst frame (ms)', 'Presentation'], caps.map(c => [
        cell(dayOf(c.created_at)), cell(c.label), cell(c.app), fnum(c.avg_fps), fnum(c.low1_fps), fnum(c.low01_fps),
        Number.isInteger(c.spikes) ? String(c.spikes) : '–', fnum(c.max_ms), cell(pathLabel(c.present_kind))]))]])
  }

  const sessions = rowsOf(g.sessions), aim = rowsOf(g.aim_scores)
  if (sessions.length || aim.length) {
    const tables = []
    if (sessions.length) tables.push(['Sessions', table(['Date', 'Game', 'Mode', 'Result', 'Score', 'Rank change', 'Felt smooth', 'Notes'], sessions.map(s => [
      cell(dayOf(s.date) + (s.start_time ? ' ' + s.start_time : '')), cell(s.game), cell(s.mode), cell(s.result), fnum(s.score, 0),
      Number.isInteger(s.rank_change) ? (s.rank_change > 0 ? '+' : '') + s.rank_change : '–', Number.isInteger(s.smoothness) ? `${s.smoothness}/5` : '–', cell(s.notes)]))])
    if (aim.length) tables.push(['Aim trainer scores', table(['Date', 'Scenario', 'Score', 'Notes'], aim.map(a => [
      cell(dayOf(a.date)), cell(a.scenario), fnum(a.score, 0), cell(a.notes)]))])
    out('Sessions and Aim', 'gaming-sessions', 'Gaming sessions and aim scores', 'Logged in SychBoard (newest first).', tables)
  }

  const profiles = rowsOf(g.sens_profiles)
  if (profiles.length) {
    out('Sens Profiles', 'gaming-sens', 'Sensitivity profiles',
      'Saved sensitivity settings. Converting between games keeps the same cm/360 (the yaw table is in SychBoard).',
      [[null, table(['Name', 'Game', 'Sens', 'DPI'], profiles.map(p => [cell(p.name), cell(p.game), fnum(p.sens, 3).replace(/\.?0+$/, ''), Number.isFinite(p.dpi) ? String(p.dpi) : '–']))]])
  }
  return files
}

// state: { journals, goals, setupTodos, genTodos, devTodos, secTodos, todayFocus, uniNotes, fitnessNotes }
// gaming (optional): { sens_profiles, sessions, aim_scores, captures, changes } from the main process
function buildFiles(state, gaming) {
  const s = isObj(state) ? state : {}
  const files = [...journalFiles(s.journals)]
  for (const f of [goalsFile(s.goals), todosFile(s), notesFile(s)]) if (f) files.push(f)
  files.push(...gamingFiles(gaming))
  const index = [
    front('index'), '# SychBoard export', '',
    'These files are written by **SychBoard** (one-way: SychBoard to Obsidian). Edit them in SychBoard;',
    'changes made here are overwritten the next time SychBoard syncs. Files without `source: sychboard`',
    'in their frontmatter are never touched.', '',
    `- Journal entries: ${files.filter(f => f.relPath.startsWith('SychBoard/Journal/')).length}`,
    ...files.filter(f => !f.relPath.startsWith('SychBoard/Journal/')).map(f => `- [[${f.relPath.replace(/^SychBoard\//, '').replace(/\.md$/, '')}]]`), ''
  ].join('\n')
  files.unshift({ relPath: 'SychBoard/00 SychBoard.md', content: index })
  return files
}

// The only keys the main process accepts from the renderer.
const STATE_KEYS = ['journals', 'goals', 'setupTodos', 'genTodos', 'devTodos', 'secTodos', 'todayFocus', 'uniNotes', 'fitnessNotes']
function pickState(raw) {
  const out = {}
  if (isObj(raw)) for (const k of STATE_KEYS) if (raw[k] !== undefined) out[k] = raw[k]
  return out
}

module.exports = { buildFiles, pickState, STATE_KEYS, DATE_RE }
