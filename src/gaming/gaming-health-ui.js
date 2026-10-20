// Health Check card: read-only system checks (✅ / ⚠️ + why) and, below them,
// the frametime capture panel (gaming-capture-ui.js).
(function () {
  'use strict'
  const G = window.Gaming
  const esc = G.esc

  const api = () => window.sychboard && window.sychboard.gaming && window.sychboard.gaming.health

  // Kept across card re-renders, not persisted.
  let last = null, running = false, error = ''

  function resultsHtml() {
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

  function render(body) {
    const a = api()
    if (!a) { body.innerHTML = '<div class="empty">Health checks need the desktop app (they query Windows).</div>'; return }
    body.innerHTML = `
      <div class="gm-note" style="margin:0 0 12px">Read-only: this reports what it finds and never changes a setting. Run it with games closed.</div>
      <div class="gm-row"><button class="btn btn-gm" data-hc-run${running ? ' disabled' : ''}>${running ? 'Checking…' : last ? 'Re-run check' : 'Run health check'}</button></div>
      <div id="gm-hc-results">${resultsHtml()}</div>
      <div class="gm-sub">Frametime capture (PresentMon)</div>
      <div id="gm-capture"></div>`

    body.querySelector('[data-hc-run]').addEventListener('click', async () => {
      running = true; error = ''
      G.refreshCard('health')
      try {
        const res = await a.run()
        if (res.ok) last = res.data; else error = res.error
      } catch (e) { error = e.message }
      running = false
      G.refreshCard('health')
    })

    if (G.renderCapture) G.renderCapture(body.querySelector('#gm-capture'))
  }

  G.registerCard({ id: 'health', title: 'Health Check', order: 20, render })
})()
