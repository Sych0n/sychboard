// Chart data for the session tracker. Pure functions over session rows so they can
// be unit-tested (renderer: window.GamingStats, node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingStats = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const BUCKET_HOURS = 3 // 8 buckets: 00-03, 03-06 ... — "does my aim die at 3am"

  const isNum = v => typeof v === 'number' && Number.isFinite(v)
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length

  // Chronological order by date, then start time (rows without a time sort first that day).
  function chrono(rows) {
    return rows.slice().sort((a, b) =>
      (a.date + ' ' + (a.start_time || '')).localeCompare(b.date + ' ' + (b.start_time || '')) || a.id - b.id)
  }

  function series(rows, field) {
    return chrono(rows).filter(r => isNum(r[field])).map(r => ({ x: r.date, y: r[field], id: r.id }))
  }

  const scoreSeries = rows => series(rows, 'score')
  const smoothSeries = rows => series(rows, 'smoothness')

  function bucketLabel(i) {
    const p = n => String(n).padStart(2, '0')
    return `${p(i * BUCKET_HOURS)}–${p((i + 1) * BUCKET_HOURS)}`
  }

  // Per time-of-day bucket: session count, avg score, win rate (of sessions with a
  // win/loss result), avg smoothness. A metric with no data in a bucket is null.
  function byTimeOfDay(rows) {
    const n = 24 / BUCKET_HOURS
    const buckets = Array.from({ length: n }, (_, i) => ({ label: bucketLabel(i), sessions: 0, scores: [], wins: 0, decided: 0, smooth: [] }))
    for (const r of rows) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(r.start_time || '')
      if (!m) continue
      const h = Number(m[1])
      if (h > 23) continue
      const b = buckets[Math.floor(h / BUCKET_HOURS)]
      b.sessions++
      if (isNum(r.score)) b.scores.push(r.score)
      if (r.result === 'win' || r.result === 'loss') { b.decided++; if (r.result === 'win') b.wins++ }
      if (isNum(r.smoothness)) b.smooth.push(r.smoothness)
    }
    return buckets.map(b => ({
      label: b.label,
      sessions: b.sessions,
      avgScore: b.scores.length ? mean(b.scores) : null,
      winRate: b.decided ? b.wins / b.decided : null,
      avgSmooth: b.smooth.length ? mean(b.smooth) : null
    }))
  }

  // Aim trainer scores for one scenario, oldest first.
  function aimSeries(rows, scenario) {
    return chrono(rows).filter(r => r.scenario === scenario && isNum(r.score)).map(r => ({ x: r.date, y: r.score, id: r.id }))
  }

  return { BUCKET_HOURS, scoreSeries, smoothSeries, byTimeOfDay, aimSeries, chrono }
})
