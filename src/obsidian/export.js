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

// state: { journals, goals, setupTodos, genTodos, devTodos, secTodos, todayFocus, uniNotes, fitnessNotes }
function buildFiles(state) {
  const s = isObj(state) ? state : {}
  const files = [...journalFiles(s.journals)]
  for (const f of [goalsFile(s.goals), todosFile(s), notesFile(s)]) if (f) files.push(f)
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
