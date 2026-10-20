// Frame-time statistics. Pure functions (renderer: window.GamingFrames, node: require).
//
//   avg FPS     = frames / total seconds            (= 1000 / mean frame time)
//   1% low FPS  = 1000 / mean of the slowest 1% of frames   (at least one frame)
//   0.1% low    = same with the slowest 0.1%
//   spike       = a frame slower than 2x the median frame time
// "Average of the slowest X%" is one of several 1%-low conventions; it is used
// consistently here so before/after captures are comparable with each other.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingFrames = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const SPIKE_FACTOR = 2

  function meanOfWorst(sortedDesc, fraction) {
    const k = Math.max(1, Math.ceil(sortedDesc.length * fraction))
    let s = 0
    for (let i = 0; i < k; i++) s += sortedDesc[i]
    return s / k
  }

  // frametimes: array of milliseconds. Non-finite / non-positive entries are dropped.
  function computeMetrics(frametimes) {
    const ft = frametimes.filter(v => Number.isFinite(v) && v > 0)
    if (!ft.length) return null
    const desc = ft.slice().sort((a, b) => b - a)
    const total = ft.reduce((s, v) => s + v, 0)
    const n = ft.length
    const median = n % 2 ? desc[(n - 1) / 2] : (desc[n / 2 - 1] + desc[n / 2]) / 2
    const spikeThresholdMs = median * SPIKE_FACTOR
    return {
      frames: n,
      durationSec: total / 1000,
      avgFps: (n / total) * 1000,
      low1Fps: 1000 / meanOfWorst(desc, 0.01),
      low01Fps: 1000 / meanOfWorst(desc, 0.001),
      medianMs: median,
      p99Ms: desc[Math.min(n - 1, Math.floor(n * 0.01))],
      maxMs: desc[0],
      spikeThresholdMs,
      spikes: ft.filter(v => v > spikeThresholdMs).length
    }
  }

  // Shrink a long series to ~maxPoints for drawing while keeping spikes visible
  // (each bucket keeps its slowest frame).
  function downsampleMax(values, maxPoints) {
    if (values.length <= maxPoints) return values.slice()
    const out = []
    const size = values.length / maxPoints
    for (let i = 0; i < maxPoints; i++) {
      const a = Math.floor(i * size), b = Math.min(values.length, Math.floor((i + 1) * size))
      let m = 0
      for (let j = a; j < Math.max(b, a + 1); j++) if (values[j] > m) m = values[j]
      out.push(m)
    }
    return out
  }

  // Rows to compare two saved captures (DB-shaped: avg_fps, low1_fps, ...). delta = b - a;
  // "better" accounts for direction (more FPS is better, fewer ms / spikes is better);
  // differences under 1% count as the same, since run-to-run noise is about that size.
  const COMPARE_FIELDS = [
    ['avg_fps', 'Avg FPS', true, 1],
    ['low1_fps', '1% low FPS', true, 1],
    ['low01_fps', '0.1% low FPS', true, 1],
    ['spikes', 'Spikes (> 2x median)', false, 0],
    ['median_ms', 'Median frametime (ms)', false, 2],
    ['p99_ms', '99th pct frametime (ms)', false, 2],
    ['max_ms', 'Worst frame (ms)', false, 1]
  ]
  function compare(a, b) {
    return COMPARE_FIELDS.map(([key, label, higherBetter, digits]) => {
      const delta = b[key] - a[key]
      const pct = a[key] ? (delta / a[key]) * 100 : null
      const same = pct != null ? Math.abs(pct) < 1 : delta === 0
      const better = same ? 'same' : ((delta > 0) === higherBetter ? 'b' : 'a')
      return { key, label, a: a[key], b: b[key], delta, pct, better, digits }
    })
  }

  return { SPIKE_FACTOR, computeMetrics, downsampleMax, compare }
})
