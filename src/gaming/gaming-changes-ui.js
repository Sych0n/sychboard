// Change Journal card: one row per setting changed while chasing smoothness, linked to the
// PresentMon captures taken before and after, with how it felt and a keep / revert verdict.
(function () {
  'use strict'
  const G = window.Gaming
  const Fmt = window.GamingChangesFmt
  const { opt, capLabel, deltaHtml, listHtml } = Fmt
  const esc = G.esc

  const api = () => window.sychboard && window.sychboard.gaming
  const pad = n => String(n).padStart(2, '0')
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

  // The form survives re-renders.
  const form = { date: '', what: '', before: '', after: '', felt: '', verdict: 'testing', notes: '' }

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
      if (!res.ok) { showMsg(res.error); return G.refreshCard('changes') } // reload so the dropdown shows what is stored
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
