// Change Journal formatting helpers, pulled out of gaming-changes-ui.js so they're
// testable without a DOM. Pure functions (renderer: window.GamingChangesFmt, node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingChangesFmt = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  const Frames = (typeof module === 'object' && module.exports)
    ? require('./framemetrics')
    : (typeof self !== 'undefined' ? self : this).GamingFrames
  const Present = (typeof module === 'object' && module.exports)
    ? require('./presentpath')
    : (typeof self !== 'undefined' ? self : this).GamingPresent

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }

  const f1 = v => (Math.round(v * 10) / 10).toFixed(1)
  const kindName = k => (k && Present.KIND_LABEL[k]) || ''
  const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`

  // A capture's headline, shaped like a saved capture row so Frames.compare can read it.
  function capRow(c, pre) {
    return c[pre + '_label'] == null ? null : {
      avg_fps: c[pre + '_avg_fps'], low1_fps: c[pre + '_low1_fps'], low01_fps: c[pre + '_low01_fps'], spikes: c[pre + '_spikes'],
      median_ms: c[pre + '_median_ms'], p99_ms: c[pre + '_p99_ms'], max_ms: c[pre + '_max_ms'], present_kind: c[pre + '_present_kind']
    }
  }

  // "avg 313.9 → 295.0 · 1% low 182.7 → 180.0 · spikes 11 → 3 · Direct flip → Composed flip", coloured by better / worse.
  function deltaHtml(b, a) {
    if (!b || !a) return ''
    const rows = Frames.compare(b, a)
    const pick = key => rows.find(r => r.key === key)
    const part = (label, r, fmt) => {
      const col = r.better === 'b' ? 'var(--green)' : r.better === 'a' ? 'var(--red)' : 'var(--text2)'
      return `${label} ${fmt(r.a)} → <span style="color:${col}">${fmt(r.b)}</span>`
    }
    const bits = [part('avg', pick('avg_fps'), f1), part('1% low', pick('low1_fps'), f1), part('spikes', pick('spikes'), v => String(Math.round(v)))]
    if (b.present_kind && a.present_kind) {
      bits.push(b.present_kind === a.present_kind ? esc(kindName(a.present_kind)) : `${esc(kindName(b.present_kind))} → <b>${esc(kindName(a.present_kind))}</b>`)
    }
    return bits.join(' · ')
  }

  function capLabel(c) {
    return `${c.label} · ${f1(c.avg_fps)} fps${c.present_kind ? ' · ' + kindName(c.present_kind) : ''}`
  }

  function listHtml(changes) {
    if (!changes.length) return '<div class="gm-note">No changes logged yet. Log the first one above — one change at a time.</div>'
    const rows = changes.map(c => {
      const d = deltaHtml(capRow(c, 'b'), capRow(c, 'a'))
      const links = [c.b_label != null ? 'before: ' + esc(c.b_label) : null, c.a_label != null ? 'after: ' + esc(c.a_label) : null].filter(Boolean).join(' · ')
      return `<tr>
        <td style="white-space:nowrap">${esc(c.date)}</td>
        <td><b>${esc(c.what)}</b>${links ? `<div class="gm-note" style="margin:2px 0 0">${links}</div>` : ''}${d ? `<div class="gm-note" style="margin:2px 0 0">${d}</div>` : ''}${c.notes ? `<div class="gm-note" style="margin:2px 0 0">${esc(c.notes)}</div>` : ''}</td>
        <td>${c.felt != null ? c.felt + '/5' : '–'}</td>
        <td><select data-ch-verdict="${c.id}" style="padding:4px 8px;font-size:12px">${opt('testing', c.verdict, 'Testing')}${opt('keep', c.verdict, 'Keep')}${opt('revert', c.verdict, 'Revert')}</select></td>
        <td style="text-align:right"><button class="btn btn-sm btn-d" data-ch-del="${c.id}" title="Delete">✕</button></td></tr>`
    }).join('')
    return `<table class="gm-table"><thead><tr><th>Date</th><th>Change</th><th>Felt</th><th>Verdict</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
  }

  return { opt, capRow, deltaHtml, capLabel, listHtml }
})
