// Change Journal card: one row per setting changed while chasing smoothness, linked to the
// PresentMon captures taken before and after, with how it felt and a keep / revert verdict.
(function () {
  'use strict'
  const G = window.Gaming
  const F = window.GamingFrames
  const P = window.GamingPresent
  const esc = G.esc

  const api = () => window.sychboard && window.sychboard.gaming
  const pad = n => String(n).padStart(2, '0')
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

  // The form survives re-renders.
  const form = { date: '', what: '', before: '', after: '', felt: '', verdict: 'testing', notes: '' }

  const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1)
  const kindName = k => (k && P.KIND_LABEL[k]) || ''

  // A capture's headline, shaped like a saved capture row so F.compare can read it.
  function capRow(c, pre) {
    return c[pre + '_label'] == null ? null : {
      avg_fps: c[pre + '_avg_fps'], low1_fps: c[pre + '_low1_fps'], low01_fps: c[pre + '_low01_fps'], spikes: c[pre + '_spikes'],
      median_ms: c[pre + '_median_ms'], p99_ms: c[pre + '_p99_ms'], max_ms: c[pre + '_max_ms'], present_kind: c[pre + '_present_kind']
    }
  }

  // "avg 313.9 → 295.0 · 1% low 182.7 → 180.0 · spikes 11 → 3 · Direct flip → Composed flip", coloured by better / worse.
  function deltaHtml(b, a) {
    if (!b || !a) return ''
    const rows = F.compare(b, a)
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

  const changed = () => { try { if (typeof G.dataChanged === 'function') G.dataChanged() } catch (_) { /* never block the UI */ } }

  async function render(body) {
    const a = api()
    if (!a) { body.innerHTML = '<div class="empty">The change journal needs the desktop app (data is stored in SQLite).</div>'; return }
    const [cr, pr] = await Promise.all([a.changes.list(), a.captures.list()])
    for (const r of [cr, pr]) if (!r.ok) throw new Error(r.error)
    const changes = cr.data, caps = pr.data
    form.date = form.date || today()
    // Forget a capture the user has since deleted.
    for (const k of ['before', 'after']) if (form[k] && !caps.some(c => String(c.id) === String(form[k]))) form[k] = ''

    const capOpts = cur => opt('', cur, '— none —') + caps.map(c => opt(c.id, cur, capLabel(c))).join('')
    const bRow = caps.find(c => String(c.id) === String(form.before)), aRow = caps.find(c => String(c.id) === String(form.after))
    const live = bRow && aRow ? deltaHtml(bRow, aRow) : ''

    body.innerHTML = `
      <div class="gm-note" style="margin:0 0 10px">Change <b>one</b> thing, test it, then decide. Capture before and after in the Capture panel (Health Check card), link them here, and say how it felt.</div>
      <div class="gm-row">
        <div class="fg" style="flex:0 0 150px"><div class="fl">Date</div><input type="date" data-ch="date" value="${esc(form.date)}"></div>
        <div class="fg" style="flex:3"><div class="fl">What changed</div><input type="text" maxlength="200" data-ch="what" value="${esc(form.what)}" placeholder='e.g. "DP overclock off", "Valorant Max FPS 315 → 295"'></div>
      </div>
      <div class="gm-row">
        <div class="fg"><div class="fl">Capture before</div><select data-ch="before">${capOpts(form.before)}</select></div>
        <div class="fg"><div class="fl">Capture after</div><select data-ch="after">${capOpts(form.after)}</select></div>
        <div class="fg" style="flex:0 0 130px"><div class="fl">Felt</div><select data-ch="felt">${opt('', form.felt, '—')}${[1, 2, 3, 4, 5].map(n => opt(n, form.felt, n + (n === 1 ? ' – worse' : n === 5 ? ' – great' : ''))).join('')}</select></div>
        <div class="fg" style="flex:0 0 130px"><div class="fl">Verdict</div><select data-ch="verdict">${opt('testing', form.verdict, 'Testing')}${opt('keep', form.verdict, 'Keep')}${opt('revert', form.verdict, 'Revert')}</select></div>
      </div>
      ${live ? `<div class="gm-note" id="gm-ch-live" style="margin:0 0 10px">Before → after: ${live}</div>` : ''}
      <div class="gm-row">
        <div class="fg" style="flex:3"><div class="fl">Notes</div><input type="text" maxlength="1000" data-ch="notes" value="${esc(form.notes)}" placeholder="What did you notice? Which game / mode?"></div>
        <button class="btn btn-gm" data-ch-add>Log change</button>
      </div>
      <div class="gm-err" id="gm-ch-msg" style="display:none"></div>
      <div class="gm-sub">Journal</div>
      ${listHtml(changes)}`

    const msg = body.querySelector('#gm-ch-msg')
    const showMsg = t => { msg.textContent = t; msg.style.display = t ? '' : 'none' }

    body.querySelectorAll('[data-ch]').forEach(el => {
      const key = el.dataset.ch
      // Capture choices redraw so the live before → after line updates; typing never redraws.
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        form[key] = el.value
        if (key === 'before' || key === 'after') G.refreshCard('changes')
      })
    })

    body.querySelector('[data-ch-add]').addEventListener('click', async () => {
      const res = await a.changes.add({
        date: form.date, what: form.what, notes: form.notes, felt: form.felt, verdict: form.verdict,
        before_capture_id: form.before, after_capture_id: form.after
      })
      if (!res.ok) return showMsg(res.error)
      if (typeof toast === 'function') toast('Change logged')
      Object.assign(form, { what: '', before: '', after: '', felt: '', verdict: 'testing', notes: '' })
      changed()
      G.refreshCard('changes')
    })

    body.querySelectorAll('[data-ch-verdict]').forEach(sel => sel.addEventListener('change', async () => {
      const res = await a.changes.update(Number(sel.dataset.chVerdict), { verdict: sel.value })
      if (!res.ok) return showMsg(res.error)
      changed()
    }))

    body.querySelectorAll('[data-ch-del]').forEach(b => b.addEventListener('click', async () => {
      const res = await a.changes.remove(Number(b.dataset.chDel))
      if (!res.ok) return showMsg(res.error)
      changed()
      G.refreshCard('changes')
    }))
  }

  G.registerCard({ id: 'changes', title: 'Change Journal', order: 30, render })
})()
