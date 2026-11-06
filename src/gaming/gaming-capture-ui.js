// Frametime capture panel (PresentMon wrapper UI), rendered inside the Health Check card.
// PresentMon is downloaded and chosen by the user — SychBoard never fetches it.
(function () {
  'use strict'
  const G = window.Gaming
  const F = window.GamingFrames
  const Fmt = window.GamingCaptureFmt
  const esc = G.esc

  const api = () => window.sychboard && window.sychboard.gaming

  const st = {
    pm: null, seconds: '30', proc: '', label: '',
    result: null, running: false, startedAt: 0, error: '', msg: '',
    saved: [], picked: [], comparison: null
  }
  let timer = null

  async function load() {
    const a = api()
    const [p, s] = await Promise.all([a.presentmon.status(), a.captures.list()])
    st.pm = p.ok ? p.data : { path: null, ok: false }
    st.saved = s.ok ? s.data : []
    st.picked = st.picked.filter(id => st.saved.some(c => c.id === id))
    if (st.picked.length < 2) st.comparison = null
  }

  async function draw(el) {
    const a = api()
    if (!el.isConnected) return
    el.innerHTML = `
      <div class="gm-note" style="margin:0 0 10px">Captures frame times through PresentMon (Windows ETW) — it does not touch the game process. Use games closed or the practice range. Download PresentMon yourself from Intel's official GitHub (GameTechDev/PresentMon releases); SychBoard never downloads it.</div>
      <div class="gm-row">
        <div class="fg"><div class="fl">PresentMon executable</div><div style="font-size:12.5px;color:${st.pm && st.pm.ok ? 'var(--gm)' : 'var(--text3)'};word-break:break-all">${st.pm && st.pm.path ? esc(st.pm.path) + (st.pm.ok ? '' : ' (invalid: ' + esc(st.pm.error || '') + ')') : 'Not chosen yet'}</div></div>
        <button class="btn" data-cap-pick-exe${st.running ? ' disabled' : ''}>${st.pm && st.pm.path ? 'Change…' : 'Choose PresentMon.exe…'}</button>
      </div>
      <div class="gm-row">
        <div class="fg"><div class="fl">Duration (s, 5–120)</div><input type="number" min="5" max="120" data-cap="seconds" value="${esc(st.seconds)}"></div>
        <div class="fg"><div class="fl">Process (optional)</div><input type="text" maxlength="64" placeholder="auto: busiest app" data-cap="proc" value="${esc(st.proc)}"></div>
        ${st.running
          ? '<button class="btn btn-d" data-cap-cancel>Cancel</button>'
          : `<button class="btn btn-gm" data-cap-start${st.pm && st.pm.ok ? '' : ' disabled'}>Start capture</button>`}
      </div>
      ${st.running ? '<div class="gm-note" id="gm-cap-timer"></div>' : ''}
      ${st.error ? `<div class="gm-err">${esc(st.error)}</div>` : ''}
      ${st.msg ? `<div class="gm-note" style="color:var(--green)">${esc(st.msg)}</div>` : ''}
      ${st.result ? Fmt.resultHtml(st.result, st.label) : ''}
      <div class="gm-sub">Saved captures</div>
      <div id="gm-cap-saved">${Fmt.savedHtml(st.saved, st.picked, st.comparison)}</div>`

    el.querySelectorAll('[data-cap]').forEach(i => i.addEventListener('input', () => { st[i.dataset.cap] = i.value }))
    const lab = el.querySelector('[data-cap-label]')
    if (lab) lab.addEventListener('input', () => { st.label = lab.value })

    el.querySelector('[data-cap-pick-exe]').addEventListener('click', async () => {
      const r = await a.presentmon.pick()
      if (!r.ok) st.error = r.error; else { st.pm = r.data; st.error = '' }
      draw(el)
    })

    const start = el.querySelector('[data-cap-start]')
    if (start) start.addEventListener('click', async () => {
      st.running = true; st.error = ''; st.msg = ''; st.startedAt = Date.now()
      draw(el)
      const secs = Math.min(120, Math.max(5, Number(st.seconds) || 30))
      clearInterval(timer)
      timer = setInterval(() => {
        const t = document.getElementById('gm-cap-timer')
        if (!t) return clearInterval(timer)
        t.textContent = `Capturing… ${Math.max(0, secs - Math.round((Date.now() - st.startedAt) / 1000))} s left`
      }, 500)
      const r = await a.presentmon.capture({ seconds: Number(st.seconds), processName: st.proc })
      clearInterval(timer)
      st.running = false
      if (r.ok) { st.result = r.data; st.label = '' } else { st.error = r.error }
      draw(el)
    })

    const cancel = el.querySelector('[data-cap-cancel]')
    if (cancel) cancel.addEventListener('click', () => a.presentmon.cancel())

    const save = el.querySelector('[data-cap-save]')
    if (save) save.addEventListener('click', async () => {
      const r = await a.captures.save(st.label)
      if (!r.ok) { st.error = r.error; return draw(el) }
      st.error = ''; st.msg = `Saved "${r.data.label}".`; st.label = ''
      G.dataChanged()
      await load(); draw(el)
    })

    el.querySelectorAll('[data-cap-pick]').forEach(cb => cb.addEventListener('change', () => {
      const id = Number(cb.dataset.capPick)
      st.picked = cb.checked ? [...st.picked, id].slice(-2) : st.picked.filter(x => x !== id)
      st.comparison = null
      draw(el)
    }))

    el.querySelectorAll('[data-cap-del]').forEach(b => b.addEventListener('click', async () => {
      const r = await a.captures.remove(Number(b.dataset.capDel))
      if (!r.ok) st.error = r.error; else G.dataChanged()
      await load(); draw(el)
    }))

    const cmp = el.querySelector('[data-cap-compare]')
    if (cmp) cmp.addEventListener('click', async () => {
      // A = the older capture ("before"), B = the newer one ("after").
      const [ra, rb] = await Promise.all([...st.picked].sort((x, y) => x - y).map(id => a.captures.get(id)))
      if (!ra.ok || !rb.ok) { st.error = (ra.error || rb.error); return draw(el) }
      st.comparison = { a: ra.data, b: rb.data, rows: F.compare(ra.data, rb.data) }
      st.error = ''
      draw(el)
    })
  }

  G.renderCapture = async function (el) {
    if (!api()) return
    try { await load() } catch (e) { st.error = e.message }
    draw(el)
  }
})()
