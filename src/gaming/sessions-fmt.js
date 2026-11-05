// Session Tracker formatting helpers, pulled out of gaming-sessions-ui.js so they're
// testable without a DOM. Pure functions (renderer: window.GamingSessionsFmt, node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingSessionsFmt = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const St = (typeof module === 'object' && module.exports)
    ? require('./stats')
    : (typeof self !== 'undefined' ? self : this).GamingStats
  const Charts = (typeof module === 'object' && module.exports)
    ? require('./gaming-charts')
    : (typeof self !== 'undefined' ? self : this).GamingCharts

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  const METRICS = {
    score: { label: 'Avg score', pick: b => b.avgScore, fmt: v => String(Math.round(v * 10) / 10) },
    win: { label: 'Win rate', pick: b => b.winRate == null ? null : b.winRate * 100, fmt: v => Math.round(v) + '%', max: 100 },
    smooth: { label: 'Avg smoothness', pick: b => b.avgSmooth, fmt: v => (Math.round(v * 10) / 10).toFixed(1), max: 5 }
  }

  const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`

  // Aim scenario names seen in the log, sorted for the dropdown.
  function scenariosOf(aimRows) {
    return [...new Set(aimRows.map(a => a.scenario))].sort((a, b) => a.localeCompare(b))
  }

  // Charts block. `scenario` need not be a scenario that still exists (e.g. after
  // the aim log is cleared) — this falls back to the first available one, same as
  // the dropdown's "selected" option, without mutating any caller state.
  function chartsHtml(sessions, aimRows, metric, scenario) {
    const tod = St.byTimeOfDay(sessions)
    const m = METRICS[metric]
    const scenarios = scenariosOf(aimRows)
    const effScenario = scenarios.includes(scenario) ? scenario : (scenarios[0] || '')
    return `
      <div class="gm-sub">Score over time</div>
      ${Charts.line(St.scoreSeries(sessions), { label: 'Score over time', empty: 'Log sessions with a score to see this chart.' })}
      <div class="gm-sub">Smoothness over time (1–5)</div>
      ${Charts.line(St.smoothSeries(sessions), { label: 'Smoothness over time', min: 1, max: 5, empty: 'Rate how smooth the game felt to see this chart.' })}
      <div class="gm-sub">Performance by time of day
        <select data-gs-metric style="margin-left:10px;padding:4px 8px;font-size:11px">${Object.entries(METRICS).map(([k, v]) => opt(k, metric, v.label)).join('')}</select></div>
      ${Charts.bars(tod.map(b => ({ label: b.label, value: m.pick(b), n: b.sessions })), { fmt: m.fmt, max: m.max, label: 'Performance by time of day', empty: 'Log sessions with a start time and ' + m.label.toLowerCase() + ' data.' })}
      <div class="gm-note">Based on session start time, 3-hour buckets. Hover a bar for the session count — small buckets are noisy.</div>
      <div class="gm-sub">Aim trainer
        ${scenarios.length ? `<select data-gs-scenario style="margin-left:10px;padding:4px 8px;font-size:11px">${scenarios.map(s => opt(s, effScenario, s)).join('')}</select>` : ''}</div>
      ${Charts.line(St.aimSeries(aimRows, effScenario), { label: 'Aim trainer scores', empty: 'Log an Aim Lab score to see this chart.' })}`
  }

  function historyHtml(sessions, aimRows) {
    const sRows = sessions.slice(0, 12).map(s => `<tr>
      <td>${esc(s.date)}${s.start_time ? ' <span style="color:var(--text3)">' + esc(s.start_time) + '</span>' : ''}</td>
      <td>${esc(s.game)}${s.mode ? ' · ' + esc(s.mode) : ''}</td>
      <td>${s.result ? esc(s.result) : '–'}</td>
      <td>${s.score != null ? s.score : '–'}</td>
      <td>${s.rank_change != null ? (s.rank_change > 0 ? '+' : '') + s.rank_change : '–'}</td>
      <td>${s.smoothness != null ? s.smoothness + '/5' : '–'}</td>
      <td style="text-align:right"><button class="btn btn-sm btn-d" data-gs-del-session="${s.id}" title="${s.notes ? esc(s.notes) : 'Delete'}">✕</button></td></tr>`).join('')
    const aRows = aimRows.slice(0, 8).map(a => `<tr>
      <td>${esc(a.date)}</td><td>${esc(a.scenario)}</td><td>${a.score}</td>
      <td style="text-align:right"><button class="btn btn-sm btn-d" data-gs-del-aim="${a.id}">✕</button></td></tr>`).join('')
    return `
      <div class="gm-sub">Recent sessions</div>
      ${sRows ? `<table class="gm-table"><thead><tr><th>When</th><th>Game</th><th>Result</th><th>Score</th><th>Rank Δ</th><th>Smooth</th><th></th></tr></thead><tbody>${sRows}</tbody></table>` : '<div class="gm-note">No sessions logged yet.</div>'}
      <div class="gm-sub">Recent aim scores</div>
      ${aRows ? `<table class="gm-table"><thead><tr><th>Date</th><th>Scenario</th><th>Score</th><th></th></tr></thead><tbody>${aRows}</tbody></table>` : '<div class="gm-note">No aim scores logged yet.</div>'}`
  }

  return { METRICS, opt, scenariosOf, chartsHtml, historyHtml }
})
