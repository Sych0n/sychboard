// Frametime capture panel (PresentMon wrapper UI), rendered inside the Health Check card.
// PresentMon is downloaded and chosen by the user — SychBoard never fetches it.
(function () {
  'use strict'
  const G = window.Gaming
  const F = window.GamingFrames
  const P = window.GamingPresent
  const esc = G.esc

  const api = () => window.sychboard && window.sychboard.gaming

  const st = {
    pm: null, seconds: '30', proc: '', label: '',
    result: null, running: false, startedAt: 0, error: '', msg: '',
    saved: [], picked: [], comparison: null
  }
  let timer = null

  const f1 = v => (Math.round(v * 10) / 10).toFixed(1)
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2)
  const tile = (label, value) => `<div class="metric"><div class="ml">${label}</div><div class="mv">${value}</div></div>`

  const badgeLevel = kind => (kind === 'direct' ? 'good' : kind && kind !== 'unknown' ? 'warn' : '')
  const kindBadge = kind => kind ? `<span class="gm-pathbadge ${badgeLevel(kind)}">${esc(P.KIND_LABEL[kind] || kind)}</span>` : ''

  // "How frames reach the screen" — what PresentMon reports about the presentation path.
  function pathHtml(s) {
    if (!s) return ''
    const v = P.verdict(s)
    const ms = x => (x ? `${f1(x.median)} ms (95th ${f1(x.p95)})` : null)
    const facts = [
      s.modes.map(m => `${esc(m.mode)} ${m.pct.toFixed(0)}%`).join(' · '),
      s.tearingPct >= 0.5 ? `tearing allowed on ${s.tearingPct.toFixed(0)}% of frames` : 'tearing not allowed',
      s.syncInterval != null ? `sync interval ${s.syncInterval}` : null,
      s.displayLatency ? `display latency ${ms(s.displayLatency)}` : null,
      s.clickToPhoton ? `click-to-photon ${ms(s.clickToPhoton)} over ${s.clickToPhoton.count} clicks` : null
    ].filter(Boolean)
    return `<div class="gm-path ${v.level}"><div class="gm-path-title">${esc(v.title)}</div>
      <div class="gm-path-text">${esc(v.text)}</div>
      <div class="gm-path-facts">${facts.join('<br>')}</div></div>`
  }

  function resultHtml(r) {
    const m = r.metrics
    const others = r.apps.filter(a => a.app !== r.app).slice(0, 4).map(a => a.app)
    return `
      <div class="gm-note" style="margin:0 0 10px">Captured <b>${esc(r.app)}</b> · ${m.frames} frames over ${f1(m.durationSec)} s${others.length ? ' · also presenting: ' + esc(others.join(', ')) : ''}</div>
      <div class="gm-grid">
        ${tile('Avg FPS', f1(m.avgFps))}${tile('1% low', f1(m.low1Fps))}${tile('0.1% low', f1(m.low01Fps))}
        ${tile('Spikes', m.spikes)}${tile('99th pct ms', f2(m.p99Ms))}${tile('Worst frame ms', f1(m.maxMs))}
      </div>
      ${pathHtml(r.present)}
      ${G.charts.multi([{ label: 'frametime', color: 'var(--gm)', values: F.downsampleMax(r.frametimes, 600) }],
        { hline: { y: m.spikeThresholdMs, label: `spike > ${f1(m.spikeThresholdMs)} ms (2× median)` }, label: 'Frametime graph' })}
      <div class="gm-note">Lows are the average of the slowest 1% / 0.1% of frames. Spikes are frames slower than 2× the median.</div>
      <div class="gm-row" style="margin-top:12px">
        <div class="fg"><div class="fl">Save as</div><input type="text" maxlength="80" data-cap-label value="${esc(st.label)}" placeholder="e.g. baseline, polling 2000Hz, FreeSync + cap 315"></div>
        <button class="btn btn-gm" data-cap-save>Save capture</button>
      </div>`
  }

  function comparisonHtml(c) {
    const cls = b => b === 'same' ? '' : `style="color:var(--${b === 'b' ? 'green' : 'red'})"`
    const rows = c.rows.map(r => {
      const fmt = v => Number(v).toFixed(r.digits)
      const d = (r.delta > 0 ? '+' : '') + Number(r.delta).toFixed(r.digits) + (r.pct != null ? ` (${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1)}%)` : '')
      return `<tr><td>${esc(r.label)}</td><td>${fmt(r.a)}</td><td>${fmt(r.b)}</td><td ${cls(r.better)}>${d}${r.better === 'same' ? ' · same' : r.better === 'b' ? ' · better' : ' · worse'}</td></tr>`
    }).join('')
    const A = esc(c.a.label), B = esc(c.b.label)
    // Path rows are text, not numbers: they say whether the two captures even used the same route.
    const kindOf = x => (x.present ? P.KIND_LABEL[x.present.kind] : '—')
    const lat = (x, key) => (x.present && x.present[key] ? f1(x.present[key].median) : '—')
    const la = c.a.present && c.a.present.displayLatency, lb = c.b.present && c.b.present.displayLatency
    // Under 1 ms is within run-to-run noise for a 30 s capture.
    const latDiff = la && lb ? lb.median - la.median : null
    const latDelta = latDiff == null ? '' : Math.abs(latDiff) < 1 ? 'same'
      : `<span style="color:var(--${latDiff < 0 ? 'green' : 'red'})">${latDiff > 0 ? '+' : ''}${latDiff.toFixed(1)} ms · ${latDiff < 0 ? 'better' : 'worse'}</span>`
    const pathRows = (c.a.present || c.b.present) ? `
      <tr><td>Presentation path</td><td>${esc(kindOf(c.a))}</td><td>${esc(kindOf(c.b))}</td><td>${c.a.present && c.b.present && c.a.present.kind !== c.b.present.kind ? 'different path' : ''}</td></tr>
      <tr><td>Display latency (ms, median)</td><td>${lat(c.a, 'displayLatency')}</td><td>${lat(c.b, 'displayLatency')}</td><td>${latDelta}</td></tr>` : ''
    return `
      <table class="gm-table"><thead><tr><th>Metric</th><th>A: ${A}</th><th>B: ${B}</th><th>B vs A</th></tr></thead><tbody>${rows}${pathRows}</tbody></table>
      ${G.charts.multi([
        { label: 'A: ' + c.a.label, color: '#22d3ee', values: F.downsampleMax(c.a.frametimes, 300) },
        { label: 'B: ' + c.b.label, color: '#f472b6', values: F.downsampleMax(c.b.frametimes, 300) }
      ], { label: 'Frametime comparison' })}
      <div class="gm-note">Both captures are stretched to the same width, so the x-axis is "start to end", not absolute time. Differences under 1% are treated as noise — change one thing at a time.</div>`
  }

  function savedHtml() {
    if (!st.saved.length) return '<div class="gm-note">No saved captures yet. Capture, give it a label, and save it to compare before/after.</div>'
    const rows = st.saved.map(c => `<tr>
      <td><input type="checkbox" data-cap-pick="${c.id}"${st.picked.includes(c.id) ? ' checked' : ''}></td>
      <td><b>${esc(c.label)}</b>${kindBadge(c.present_kind)}<div class="gm-note" style="margin:2px 0 0">${esc(c.created_at)} UTC · ${esc(c.app || '')}</div></td>
      <td>${f1(c.avg_fps)}</td><td>${f1(c.low1_fps)}</td><td>${f1(c.low01_fps)}</td><td>${c.spikes}</td>
      <td style="text-align:right"><button class="btn btn-sm btn-d" data-cap-del="${c.id}">✕</button></td></tr>`).join('')
    return `<table class="gm-table"><thead><tr><th></th><th>Capture</th><th>Avg</th><th>1%</th><th>0.1%</th><th>Spikes</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="gm-row" style="margin-top:10px"><button class="btn btn-gm" data-cap-compare${st.picked.length === 2 ? '' : ' disabled'}>Compare selected${st.picked.length === 2 ? '' : ' (pick 2)'}</button></div>
      ${st.comparison ? comparisonHtml(st.comparison) : ''}`
  }

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
      ${st.result ? resultHtml(st.result) : ''}
      <div class="gm-sub">Saved captures</div>
      <div id="gm-cap-saved">${savedHtml()}</div>`

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
      if (!r.ok) st.error = r.error
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
