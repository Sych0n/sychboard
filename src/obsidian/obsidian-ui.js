// Obsidian export: Settings card + debounced auto-sync after every save().
// One-way (SychBoard -> vault). The main process owns the vault path and all file writes.
(function () {
  'use strict'
  const api = () => window.sychboard && window.sychboard.obsidian
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  let status = { path: null, valid: false }
  let timer = null, busy = false, last = null, error = ''

  // Only note-like data is sent; the main process allowlists it again and never sees finances or keys.
  function snapshot() {
    if (typeof st === 'undefined') return {}
    return {
      journals: st.journals, goals: st.goals, setupTodos: st.setupTodos, genTodos: st.genTodos,
      devTodos: st.devTodos, secTodos: st.secTodos, todayFocus: st.todayFocus, uniNotes: st.uniNotes, fitnessNotes: st.fitnessNotes
    }
  }

  async function refreshStatus() {
    const a = api(); if (!a) return
    try { const r = await a.status(); status = r.ok ? r.data : { path: null, valid: false } } catch (_) { status = { path: null, valid: false } }
  }

  async function syncNow() {
    const a = api()
    if (!a || !status.valid || busy) return
    busy = true; error = ''
    try {
      const r = await a.sync(snapshot())
      if (r.ok) last = { at: new Date(), ...r.data }; else error = r.error
    } catch (e) { error = e.message }
    busy = false
    paint()
  }

  // Called from save(): wait for typing to settle, then copy.
  function schedule() {
    if (!status.valid) return
    clearTimeout(timer)
    timer = setTimeout(syncNow, 4000)
  }

  function summary() {
    if (!last) return ''
    const bits = [`${last.written.length} written`, `${last.unchanged.length} unchanged`]
    if (last.skipped.length) bits.push(`${last.skipped.length} skipped (a file with that name already exists and wasn't made by SychBoard)`)
    if (last.errors.length) bits.push(`${last.errors.length} failed`)
    return `Last sync ${last.at.toLocaleTimeString()}: ${bits.join(', ')}`
  }

  function paint() {
    const el = document.getElementById('obsidian-si')
    if (!el) return
    if (!api()) { el.innerHTML = '<div class="sl">Obsidian</div><div class="ss">Needs the desktop app.</div>'; return }
    el.innerHTML = `
      <div class="sl">Obsidian</div>
      <div class="ss">Copies your journal, goals, todos and notes into your Obsidian vault, in a <b>SychBoard</b> folder. One-way: edit in SychBoard. It never overwrites a file you wrote yourself, never deletes anything, and never sends finances or API keys.</div>
      <div class="ss" style="margin-top:6px">${status.valid ? 'Vault: <b>' + esc(status.path) + '</b>' : (status.path ? 'Saved vault not found: ' + esc(status.path) : 'No vault connected.')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn btn-sm" data-ob="pick">${status.valid ? 'Change vault…' : 'Choose vault…'}</button>
        <button class="btn btn-p btn-sm" data-ob="sync"${status.valid && !busy ? '' : ' disabled'}>${busy ? 'Syncing…' : 'Sync now'}</button>
        ${status.path ? '<button class="btn btn-sm" data-ob="off">Disconnect</button>' : ''}
      </div>
      ${error ? `<div class="ss" style="color:var(--red);margin-top:8px">${esc(error)}</div>` : ''}
      ${last ? `<div class="ss" style="margin-top:8px">${esc(summary())}</div>` : ''}`
    el.querySelector('[data-ob=pick]').addEventListener('click', async () => {
      error = ''
      const r = await api().pick()
      if (!r.ok) error = r.error; else status = r.data
      paint()
      if (status.valid) syncNow()
    })
    el.querySelector('[data-ob=sync]').addEventListener('click', syncNow)
    const off = el.querySelector('[data-ob=off]')
    if (off) off.addEventListener('click', async () => { await api().disconnect(); status = { path: null, valid: false }; last = null; paint() })
  }

  async function renderCard() { await refreshStatus(); paint() }

  window.ObsidianSync = { schedule, syncNow, renderCard, snapshot }
  setTimeout(refreshStatus, 1500)   // so the first save after launch can auto-sync
})()
