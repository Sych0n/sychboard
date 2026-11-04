// Sens Converter formatting helpers, pulled out of gaming-sens-ui.js so they're
// testable without a DOM. Pure functions (renderer: window.GamingSensFmt, node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingSensFmt = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const S = (typeof module === 'object' && module.exports)
    ? require('./sens')
    : (typeof self !== 'undefined' ? self : this).GamingSens

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  const fmt = (n, d) => Number(n.toFixed(d)).toString()

  function gameOptionsHtml(selected) {
    return Object.keys(S.GAMES).map(k =>
      `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(S.GAMES[k].name)}</option>`).join('')
  }

  function resultsHtml(game, sens, dpi) {
    let r
    try { r = S.convertAll(game, sens, dpi) } catch (e) {
      return `<div class="gm-err">${esc(e.message)}</div>`
    }
    const rows = r.games.map(g =>
      `<tr class="${g.key === game ? 'gm-src' : ''}"><td>${esc(g.name)}</td><td>${fmt(g.sens, 4)}</td><td>${fmt(g.eDpi, 1)}</td></tr>`).join('')
    return `
      <div class="gm-grid">
        <div class="metric"><div class="ml">cm / 360°</div><div class="mv">${fmt(r.cmPer360, 2)}</div></div>
        <div class="metric"><div class="ml">in / 360°</div><div class="mv">${fmt(r.inchesPer360, 2)}</div></div>
        <div class="metric"><div class="ml">eDPI</div><div class="mv">${fmt(r.eDpi, 1)}</div></div>
      </div>
      <table class="gm-table"><thead><tr><th>Game</th><th>Equivalent sens</th><th>eDPI</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="gm-note">Same DPI in every game. Equivalent sens = sens × yaw(source) ÷ yaw(target), so cm/360 is identical across the table.</div>`
  }

  // cm/360 shown next to a saved profile; unknown game key (e.g. an old profile for a removed game) just omits it.
  function profileCm(p) {
    try { return fmt(S.cmPer360(p.game, p.sens, p.dpi), 2) + ' cm/360' } catch (_) { return '' }
  }

  function profilesTableHtml(profiles) {
    if (!profiles.length) return `<div class="gm-note">No saved profiles yet. Name the current values and hit Save.</div>`
    return `<table class="gm-table"><tbody>${profiles.map(p => `<tr>
        <td><b>${esc(p.name)}</b><div class="gm-note" style="margin:2px 0 0">${esc((S.GAMES[p.game] || {}).name || p.game)} · ${p.sens} @ ${p.dpi} DPI · ${profileCm(p)}</div></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" data-gm-load="${p.id}">Load</button>
          <button class="btn btn-sm btn-d" data-gm-del="${p.id}">Delete</button>
        </td></tr>`).join('')}</tbody></table>`
  }

  return { fmt, gameOptionsHtml, resultsHtml, profilesTableHtml }
})
