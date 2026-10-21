// How frames reach the screen, from PresentMon's PresentMode column. Pure functions
// (renderer: window.GamingPresent, node: require).
//
//   direct          Independent Flip / legacy flip: the game's frames go straight to the
//                   display, bypassing Windows' desktop compositor (DWM). Lowest latency.
//   composed-flip   "Composed: Flip": DWM still composes the frame with the desktop. A
//                   little extra latency; usual with an overlay or a window on top.
//   composed-copy   "Composed: Copy ...": the frame is copied into DWM's surface first.
//                   Slowest path; typical for OpenGL and older windowed games.
//   copy            "Hardware: Legacy Copy to front buffer".
//   unknown         anything else (or no PresentMode column).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingPresent = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const KIND_LABEL = {
    direct: 'Direct flip',
    'composed-flip': 'Composed flip',
    'composed-copy': 'Composed copy',
    copy: 'Legacy copy',
    unknown: 'Unknown'
  }

  function classify(mode) {
    const m = typeof mode === 'string' ? mode.trim() : ''
    if (/independent flip/i.test(m) || /^Hardware:\s*Legacy Flip/i.test(m)) return 'direct'
    if (/^Composed:\s*Flip/i.test(m)) return 'composed-flip'
    if (/^Composed:\s*Copy/i.test(m)) return 'composed-copy'
    if (/Legacy Copy/i.test(m)) return 'copy'
    return 'unknown'
  }

  function percentile(sortedAsc, p) {
    if (!sortedAsc.length) return null
    return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p))]
  }

  function stat(values) {
    const v = values.filter(x => Number.isFinite(x) && x >= 0).sort((a, b) => a - b)
    if (!v.length) return null
    const n = v.length
    const median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2
    return { median, p95: percentile(v, 0.95), max: v[n - 1], count: n }
  }

  // rows: [{ mode, tearing, syncInterval, displayLatency, clickToPhoton, displayed }] for the
  // captured app (numbers may be NaN/null where PresentMon wrote NA). Returns null if there
  // is no PresentMode data at all.
  function summarize(rows) {
    const withMode = rows.filter(r => r.mode)
    if (!withMode.length) return null
    const byMode = new Map()
    for (const r of withMode) byMode.set(r.mode, (byMode.get(r.mode) || 0) + 1)
    const modes = [...byMode.entries()]
      .map(([mode, frames]) => ({ mode, kind: classify(mode), frames, pct: (frames / withMode.length) * 100 }))
      .sort((a, b) => b.frames - a.frames)
    const byKind = new Map()
    for (const m of modes) byKind.set(m.kind, (byKind.get(m.kind) || 0) + m.pct)
    const kind = [...byKind.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const tearing = withMode.filter(r => r.tearing === true).length
    const sync = new Map()
    // PresentMon writes -1 when the interval is unknown (seen on OpenGL games).
    for (const r of withMode) if (Number.isFinite(r.syncInterval) && r.syncInterval >= 0) sync.set(r.syncInterval, (sync.get(r.syncInterval) || 0) + 1)
    const syncInterval = sync.size ? [...sync.entries()].sort((a, b) => b[1] - a[1])[0][0] : null
    return {
      frames: withMode.length,
      kind,
      kindPct: byKind.get(kind),
      modes: modes.slice(0, 5),
      tearingPct: (tearing / withMode.length) * 100,
      syncInterval,
      displayLatency: stat(rows.map(r => r.displayLatency)),
      clickToPhoton: stat(rows.map(r => r.clickToPhoton)),
      displayed: stat(rows.map(r => r.displayed))
    }
  }

  // Rebuilds a summary from untrusted data (a restored backup): only known fields, finite
  // numbers, capped strings. Returns null if it is not recognisably a summary.
  function sanitize(p) {
    if (!p || typeof p !== 'object' || !Object.prototype.hasOwnProperty.call(KIND_LABEL, p.kind) || !Array.isArray(p.modes)) return null
    const n = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    const st = s => (s && typeof s === 'object' && n(s.median) !== null && n(s.count) !== null
      ? { median: s.median, p95: n(s.p95), max: n(s.max), count: s.count } : null)
    const modes = p.modes.slice(0, 5).filter(m => m && typeof m.mode === 'string' && n(m.frames) !== null && n(m.pct) !== null)
      .map(m => ({ mode: m.mode.slice(0, 80), kind: classify(m.mode), frames: m.frames, pct: m.pct }))
    if (!modes.length || n(p.frames) === null) return null
    return {
      frames: p.frames, kind: p.kind, kindPct: n(p.kindPct) ?? 100, modes,
      tearingPct: n(p.tearingPct) ?? 0, syncInterval: n(p.syncInterval),
      displayLatency: st(p.displayLatency), clickToPhoton: st(p.clickToPhoton), displayed: st(p.displayed)
    }
  }

  // What the summary means in plain words. level: good | warn | info.
  // The wording stays hedged: PresentMon says HOW frames are presented, not WHY.
  function verdict(s) {
    if (!s) return { level: 'info', title: 'No presentation data', text: 'This capture has no PresentMode column (older PresentMon, or saved before this feature).' }
    const mixed = s.kindPct < 95
    const tail = mixed ? ` Only ${s.kindPct.toFixed(0)}% of frames used this path, so the path changed during the capture.` : ''
    switch (s.kind) {
      case 'direct':
        return { level: mixed ? 'warn' : 'good', title: 'Direct to display', text: 'Frames go straight to the display and skip the Windows compositor — the lowest-latency path.' + tail }
      case 'composed-flip':
        return { level: 'warn', title: 'Composed by Windows (flip)', text: 'Windows (DWM) is composing your game with the desktop, adding a little latency. Common causes: an overlay (Discord, Steam, Medal, AMD), a window sitting on top of the game, or a capture/recording tool. Try again with overlays off.' + tail }
      case 'composed-copy':
        return { level: 'warn', title: 'Composed by Windows (copy)', text: 'Each frame is copied into the desktop compositor first — the slowest path. Typical of OpenGL and older windowed games; borderless/exclusive fullscreen or a different renderer (if the game offers one) may help.' + tail }
      case 'copy':
        return { level: 'warn', title: 'Legacy copy', text: 'Frames are copied to the front buffer (an old-style presentation path).' + tail }
      default:
        return { level: 'info', title: 'Presentation path not recognised', text: 'PresentMon reported: ' + (s.modes[0] ? s.modes[0].mode : 'nothing') + '.' }
    }
  }

  return { KIND_LABEL, classify, summarize, sanitize, verdict }
})
