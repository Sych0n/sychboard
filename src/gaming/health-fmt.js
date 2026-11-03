// Health Check results panel, pulled out of gaming-health-ui.js so it's testable
// without a DOM. Pure function (renderer: window.GamingHealthFmt, node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingHealthFmt = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  // last: the health:run result ({checks, isAdmin, ranAt}) or null if never run. error: a run failure message, if any.
  function resultsHtml(last, error) {
    if (error) return `<div class="gm-err">${esc(error)}</div>`
    if (!last) return '<div class="gm-note">Not run yet.</div>'
    const nOk = last.checks.filter(c => c.status === 'ok').length
    const nWarn = last.checks.length - nOk
    const needAdmin = last.checks.filter(c => c.needsAdmin).length
    const banner = !last.isAdmin && needAdmin
      ? `<div class="gm-note" style="color:var(--amber)">Not running as administrator — ${needAdmin} check${needAdmin === 1 ? '' : 's'} could not be read in full. Restart SychBoard as admin for those; nothing is skipped silently.</div>` : ''
    const rows = last.checks.map(c => `
      <div class="gm-chk">
        <div class="gm-chk-ico">${c.status === 'ok' ? '✅' : '⚠️'}</div>
        <div>
          <div class="gm-chk-name">${esc(c.title)}${c.needsAdmin ? ' <span class="chip chip-a">needs admin</span>' : ''}</div>
          <div class="gm-chk-val" style="white-space:pre-line">${esc(c.value)}</div>
          <div class="gm-chk-why">${esc(c.why)}</div>
        </div>
      </div>`).join('')
    return `<div class="gm-note" style="margin:0 0 6px">${nOk} ✅ · ${nWarn} ⚠️ · checked ${esc(new Date(last.ranAt).toLocaleTimeString())}</div>${banner}${rows}`
  }

  return { resultsHtml }
})
