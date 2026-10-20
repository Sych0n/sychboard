// Tiny SVG chart helpers for the Gaming tab (no dependencies). Return markup strings.
(function () {
  'use strict'
  const G = window.Gaming
  const esc = G.esc

  const W = 600, H = 160, L = 44, R = 12, T = 12, B = 24

  function empty(msg) {
    return `<div class="empty" style="padding:22px 16px">${esc(msg)}</div>`
  }

  function niceRange(vals, forceMin, forceMax) {
    let lo = forceMin != null ? forceMin : Math.min(...vals)
    let hi = forceMax != null ? forceMax : Math.max(...vals)
    if (lo === hi) { lo -= 1; hi += 1 }
    return [lo, hi]
  }

  // points: [{x:label, y:number}]  oldest → newest
  function line(points, opts = {}) {
    if (!points.length) return empty(opts.empty || 'No data yet')
    const fmt = opts.fmt || (v => String(Math.round(v * 100) / 100))
    const [lo, hi] = niceRange(points.map(p => p.y), opts.min, opts.max)
    const px = i => points.length === 1 ? (L + (W - L - R) / 2) : L + i * (W - L - R) / (points.length - 1)
    const py = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')
    const dots = points.map((p, i) =>
      `<circle cx="${px(i).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="3.5" fill="var(--gm)"><title>${esc(p.x)}: ${esc(fmt(p.y))}</title></circle>`).join('')
    return `<svg class="gm-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'chart')}">
      <line x1="${L}" y1="${py(hi)}" x2="${W - R}" y2="${py(hi)}" stroke="rgba(255,255,255,0.06)"/>
      <line x1="${L}" y1="${py(lo)}" x2="${W - R}" y2="${py(lo)}" stroke="rgba(255,255,255,0.06)"/>
      <text x="${L - 6}" y="${py(hi) + 4}" text-anchor="end" fill="var(--text3)" font-size="10">${esc(fmt(hi))}</text>
      <text x="${L - 6}" y="${py(lo) + 4}" text-anchor="end" fill="var(--text3)" font-size="10">${esc(fmt(lo))}</text>
      <text x="${L}" y="${H - 6}" fill="var(--text3)" font-size="10">${esc(points[0].x)}</text>
      <text x="${W - R}" y="${H - 6}" text-anchor="end" fill="var(--text3)" font-size="10">${points.length > 1 ? esc(points[points.length - 1].x) : ''}</text>
      ${points.length > 1 ? `<path d="${path}" fill="none" stroke="var(--gm)" stroke-width="2" stroke-linejoin="round"/>` : ''}
      ${dots}</svg>`
  }

  // items: [{label, value|null, n}]; value null = no data in that bucket
  function bars(items, opts = {}) {
    if (!items.some(i => i.value != null)) return empty(opts.empty || 'No data yet')
    const fmt = opts.fmt || (v => String(Math.round(v * 100) / 100))
    const max = opts.max != null ? opts.max : Math.max(...items.filter(i => i.value != null).map(i => i.value)) || 1
    const slot = (W - L - R) / items.length
    const bw = slot * 0.6
    const cols = items.map((it, i) => {
      const x = L + i * slot + (slot - bw) / 2
      const h = it.value == null ? 0 : Math.max(2, (it.value / max) * (H - T - B - 12))
      const y = H - B - h
      return `<g><title>${esc(it.label)}: ${it.value == null ? 'no data' : esc(fmt(it.value))} (${it.n} session${it.n === 1 ? '' : 's'})</title>
        ${it.value == null ? '' : `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="var(--gm)" opacity="0.85"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" fill="var(--text2)" font-size="10">${esc(fmt(it.value))}</text>`}
        <text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="var(--text3)" font-size="9.5">${esc(it.label)}</text></g>`
    }).join('')
    return `<svg class="gm-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'chart')}">${cols}</svg>`
  }

  // Frametime-style plot: one or more series of raw values (index on x, no dots),
  // sharing a 0-based y axis. series: [{label, color, values:[number]}].
  // opts.hline = {y, label} draws a dashed reference line (e.g. the spike threshold).
  function multi(series, opts = {}) {
    const all = series.flatMap(s => s.values)
    if (!all.length) return empty(opts.empty || 'No data yet')
    const fmt = opts.fmt || (v => String(Math.round(v * 10) / 10))
    const hi = Math.max(...all, opts.hline ? opts.hline.y : 0) * 1.05 || 1
    const py = v => T + (1 - v / hi) * (H - T - B)
    const paths = series.map(s => {
      const n = s.values.length
      const px = i => n === 1 ? L : L + i * (W - L - R) / (n - 1)
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
      return `<path d="${d}" fill="none" stroke="${s.color || 'var(--gm)'}" stroke-width="1.4" stroke-linejoin="round" opacity="0.9"/>`
    }).join('')
    const h = opts.hline ? `<line x1="${L}" y1="${py(opts.hline.y).toFixed(1)}" x2="${W - R}" y2="${py(opts.hline.y).toFixed(1)}" stroke="var(--amber)" stroke-dasharray="4 4" opacity="0.7"/>
      <text x="${W - R}" y="${(py(opts.hline.y) - 4).toFixed(1)}" text-anchor="end" fill="var(--amber)" font-size="10">${esc(opts.hline.label)}</text>` : ''
    const legend = series.length > 1 ? series.map((s, i) =>
      `<text x="${L + 6 + i * 150}" y="${T + 8}" fill="${s.color}" font-size="10.5">● ${esc(s.label)}</text>`).join('') : ''
    return `<svg class="gm-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'frametime graph')}">
      <line x1="${L}" y1="${py(0)}" x2="${W - R}" y2="${py(0)}" stroke="rgba(255,255,255,0.06)"/>
      <text x="${L - 6}" y="${py(0) + 4}" text-anchor="end" fill="var(--text3)" font-size="10">0</text>
      <text x="${L - 6}" y="${py(hi) + 12}" text-anchor="end" fill="var(--text3)" font-size="10">${esc(fmt(hi))} ms</text>
      <text x="${L}" y="${H - 6}" fill="var(--text3)" font-size="10">start</text>
      <text x="${W - R}" y="${H - 6}" text-anchor="end" fill="var(--text3)" font-size="10">end</text>
      ${h}${paths}${legend}</svg>`
  }

  G.charts = { line, bars, multi }
})()
