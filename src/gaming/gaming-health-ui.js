// Health Check card: read-only system checks (✅ / ⚠️ + why) and, below them,
// the frametime capture panel (gaming-capture-ui.js).
(function () {
  'use strict'
  const G = window.Gaming
  const Fmt = window.GamingHealthFmt

  const api = () => window.sychboard && window.sychboard.gaming && window.sychboard.gaming.health

  // Kept across card re-renders, not persisted.
  let last = null, running = false, error = ''

  function render(body) {
    const a = api()
    if (!a) { body.innerHTML = '<div class="empty">Health checks need the desktop app (they query Windows).</div>'; return }
    body.innerHTML = `
      <div class="gm-note" style="margin:0 0 12px">Read-only: this reports what it finds and never changes a setting. Run it with games closed.</div>
      <div class="gm-row"><button class="btn btn-gm" data-hc-run${running ? ' disabled' : ''}>${running ? 'Checking…' : last ? 'Re-run check' : 'Run health check'}</button></div>
      <div id="gm-hc-results">${Fmt.resultsHtml(last, error)}</div>
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
