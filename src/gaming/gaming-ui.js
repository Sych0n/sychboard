// Gaming tab shell. Cards register themselves via Gaming.registerCard() from
// their own files (gaming-sens-ui.js, gaming-sessions-ui.js, ...), so renderer.js
// only needs to know about rGaming().
//
// Everything here is tooling / tracking only: no game process access, no overlays,
// no input automation (see GAMING_TAB_PLAN.md hard rules).
(function () {
  'use strict'

  const cards = []

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  // render(bodyEl) may be async. A card that throws shows an error instead of
  // taking the whole tab down.
  function registerCard(card) {
    const i = cards.findIndex(c => c.id === card.id)
    if (i >= 0) cards[i] = card
    else cards.push(card)
    cards.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  }

  async function renderCard(card, body) {
    try {
      await card.render(body)
    } catch (e) {
      console.error('[gaming]', card.id, e)
      body.innerHTML = `<div class="empty">${esc(card.title)} failed to load: ${esc(e.message)}</div>`
    }
  }

  async function rGaming() {
    const root = document.getElementById('gaming-content')
    if (!root) return
    root.innerHTML = cards.map(c =>
      `<div class="card gm-card" id="gmc-${c.id}">
        <div class="card-title">${esc(c.title)}</div>
        <div class="gm-card-body" id="gmb-${c.id}"></div>
      </div>`).join('')
    await Promise.all(cards.map(c => renderCard(c, document.getElementById('gmb-' + c.id))))
  }

  // Re-render a single card in place (e.g. after saving a profile).
  async function refreshCard(id) {
    const card = cards.find(c => c.id === id)
    const body = document.getElementById('gmb-' + id)
    if (card && body) await renderCard(card, body)
  }

  function placeholder(body, text) {
    body.innerHTML = `<div class="empty"><span class="empty-icon">🛠</span>${esc(text)}<span class="empty-sub">Coming in a later phase</span></div>`
  }

  // Gaming data lives in SQLite (main process), so renderer.js's save() never sees it change.
  // Cards call this after a write so the Obsidian export picks it up.
  function dataChanged() {
    try { if (window.ObsidianSync && typeof window.ObsidianSync.schedule === 'function') window.ObsidianSync.schedule() } catch (_) { /* optional */ }
  }

  window.Gaming = { registerCard, refreshCard, esc, placeholder, dataChanged }
  window.rGaming = rGaming
})()
