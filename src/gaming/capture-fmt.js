// Frametime capture panel formatting helpers, pulled out of gaming-capture-ui.js so
// they're testable without a DOM. Pure functions (renderer: window.GamingCaptureFmt, node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingCaptureFmt = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const Frames = (typeof module === 'object' && module.exports)
    ? require('./framemetrics')
    : (typeof self !== 'undefined' ? self : this).GamingFrames
  const Present = (typeof module === 'object' && module.exports)
    ? require('./presentpath')
    : (typeof self !== 'undefined' ? self : this).GamingPresent
  const Charts = (typeof module === 'object' && module.exports)
    ? require('./gaming-charts')
    : (typeof self !== 'undefined' ? self : this).GamingCharts

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  const f1 = v => (Math.round(v * 10) / 10).toFixed(1)
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2)
  const tile = (label, value) => `<div class="metric"><div class="ml">${label}</div><div class="mv">${value}</div></div>`

  const badgeLevel = kind => (kind === 'direct' ? 'good' : kind && kind !== 'unknown' ? 'warn' : '')
  const kindBadge = kind => kind ? `<span class="gm-pathbadge ${badgeLevel(kind)}">${esc(Present.KIND_LABEL[kind] || kind)}</span>` : ''

  // "How frames reach the screen" — what PresentMon reports about the presentation path.
  function pathHtml(s) {
    if (!s) return ''
    const v = Present.verdict(s)
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

  function resultHtml(r, label) {
    const m = r.metrics
    const others = r.apps.filter(a => a.app !== r.app).slice(0, 4).map(a => a.app)
    return `
      <div class="gm-note" style="margin:0 0 10px">Captured <b>${esc(r.app)}</b> · ${m.frames} frames over ${f1(m.durationSec)} s${others.length ? ' · also presenting: ' + esc(others.join(', ')) : ''}</div>
      <div class="gm-grid">
        ${tile('Avg FPS', f1(m.avgFps))}${tile('1% low', f1(m.low1Fps))}${tile('0.1% low', f1(m.low01Fps))}
        ${tile('Spikes', m.spikes)}${tile('99th pct ms', f2(m.p99Ms))}${tile('Worst frame ms', f1(m.maxMs))}
      </div>
      ${pathHtml(r.present)}
      ${Charts.multi([{ label: 'frametime', color: 'var(--gm)', values: Frames.downsampleMax(r.frametimes, 600) }],
        { hline: { y: m.spikeThresholdMs, label: `spike > ${f1(m.spikeThresholdMs)} ms (2× median)` }, label: 'Frametime graph' })}
      <div class="gm-note">Lows are the average of the slowest 1% / 0.1% of frames. Spikes are frames slower than 2× the median.</div>
      <div class="gm-row" style="margin-top:12px">
        <div class="fg"><div class="fl">Save as</div><input type="text" maxlength="80" data-cap-label value="${esc(label)}" placeholder="e.g. baseline, polling 2000Hz, FreeSync + cap 315"></div>
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
    const kindOf = x => (x.present ? Present.KIND_LABEL[x.present.kind] : '—')
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
      ${Charts.multi([
        { label: 'A: ' + c.a.label, color: '#22d3ee', values: Frames.downsampleMax(c.a.frametimes, 300) },
        { label: 'B: ' + c.b.label, color: '#f472b6', values: Frames.downsampleMax(c.b.frametimes, 300) }
      ], { label: 'Frametime comparison' })}
      <div class="gm-note">Both captures are stretched to the same width, so the x-axis is "start to end", not absolute time. Differences under 1% are treated as noise — change one thing at a time.</div>`
  }

  function savedHtml(saved, picked, comparison) {
    if (!saved.length) return '<div class="gm-note">No saved captures yet. Capture, give it a label, and save it to compare before/after.</div>'
    const rows = saved.map(c => `<tr>
      <td><input type="checkbox" data-cap-pick="${c.id}"${picked.includes(c.id) ? ' checked' : ''}></td>
      <td><b>${esc(c.label)}</b>${kindBadge(c.present_kind)}<div class="gm-note" style="margin:2px 0 0">${esc(c.created_at)} UTC · ${esc(c.app || '')}</div></td>
      <td>${f1(c.avg_fps)}</td><td>${f1(c.low1_fps)}</td><td>${f1(c.low01_fps)}</td><td>${c.spikes}</td>
      <td style="text-align:right"><button class="btn btn-sm btn-d" data-cap-del="${c.id}">✕</button></td></tr>`).join('')
    return `<table class="gm-table"><thead><tr><th></th><th>Capture</th><th>Avg</th><th>1%</th><th>0.1%</th><th>Spikes</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="gm-row" style="margin-top:10px"><button class="btn btn-gm" data-cap-compare${picked.length === 2 ? '' : ' disabled'}>Compare selected${picked.length === 2 ? '' : ' (pick 2)'}</button></div>
      ${comparison ? comparisonHtml(comparison) : ''}`
  }

  return { pathHtml, resultHtml, comparisonHtml, savedHtml }
})
