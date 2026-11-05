// Session Tracker card: log sessions + aim trainer scores, charts, recent history.
(function () {
  'use strict'
  const G = window.Gaming
  const Fmt = window.GamingSessionsFmt
  const esc = G.esc

  const api = () => window.sychboard && window.sychboard.gaming
  const pad = n => String(n).padStart(2, '0')
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

  // Form + chart choices survive re-renders.
  const form = { date: '', start_time: '', end_time: '', game: 'Valorant', mode: 'Competitive', result: '', score: '', rank_change: '', smoothness: '', sens_profile_id: '', notes: '' }
  const aim = { date: '', scenario: '', score: '' }
  const view = { metric: 'score', scenario: '' }

  const opt = Fmt.opt

  function notify(res, what) {
    const x = res.data && res.data.xp
    if (x && x.awarded && typeof showXpToast === 'function') showXpToast(`+${x.awarded} XP · ${what} logged`)
    else if (typeof toast === 'function') toast(x && x.capped ? `${what} logged (daily XP cap reached)` : `${what} logged`)
    if (x && x.leveledUp && typeof toast === 'function') toast(`Level up! You are now level ${x.newLevel}`)
  }

  async function render(body) {
    const a = api()
    if (!a) { body.innerHTML = '<div class="empty">Session tracking needs the desktop app (data is stored in SQLite).</div>'; return }
    const [sr, ar, pr] = await Promise.all([a.sessions.list(), a.aim.list(), a.sens.list()])
    for (const r of [sr, ar, pr]) if (!r.ok) throw new Error(r.error)
    const sessions = sr.data, aimRows = ar.data, profiles = pr.data
    form.date = form.date || today()
    aim.date = aim.date || today()

    const f = (k, type, label, extra = '') => `<div class="fg"><div class="fl">${label}</div><input type="${type}" ${extra} data-gs="${k}" value="${esc(form[k])}"></div>`
    body.innerHTML = `
      <div class="gm-sub" style="margin-top:0">Log a session <span style="font-weight:500;text-transform:none;letter-spacing:0">· +20 XP, first 3 a day</span></div>
      <div class="gm-row">
        ${f('date', 'date', 'Date')}${f('start_time', 'time', 'Start')}${f('end_time', 'time', 'End')}
      </div>
      <div class="gm-row">
        ${f('game', 'text', 'Game', 'maxlength="40" list="gm-games"')}${f('mode', 'text', 'Mode', 'maxlength="40" placeholder="Competitive, Deathmatch…"')}
        <div class="fg"><div class="fl">Result</div><select data-gs="result">${opt('', form.result, '—')}${opt('win', form.result, 'Win')}${opt('loss', form.result, 'Loss')}${opt('draw', form.result, 'Draw')}</select></div>
      </div>
      <div class="gm-row">
        ${f('score', 'number', 'Score', 'step="any" placeholder="ACS, K/D, kills…"')}${f('rank_change', 'number', 'Rank change', 'step="1" placeholder="+21 RR"')}
        <div class="fg"><div class="fl">Felt smooth</div><select data-gs="smoothness">${opt('', form.smoothness, '—')}${[1, 2, 3, 4, 5].map(n => opt(n, form.smoothness, n + (n === 1 ? ' – choppy' : n === 5 ? ' – butter' : ''))).join('')}</select></div>
        <div class="fg"><div class="fl">Sens profile</div><select data-gs="sens_profile_id">${opt('', form.sens_profile_id, '—')}${profiles.map(p => opt(p.id, form.sens_profile_id, p.name)).join('')}</select></div>
      </div>
      <div class="gm-row">${f('notes', 'text', 'Notes', 'maxlength="1000" placeholder="What changed? How did it feel?"')}<button class="btn btn-gm" data-gs-log>Log session</button></div>
      <datalist id="gm-games">${Object.values(window.GamingSens.GAMES).map(g => `<option value="${esc(g.name)}">`).join('')}</datalist>

      <div class="gm-sub">Log an aim trainer score <span style="font-weight:500;text-transform:none;letter-spacing:0">· +5 XP, first 3 a day</span></div>
      <div class="gm-row">
        <div class="fg"><div class="fl">Date</div><input type="date" data-ga="date" value="${esc(aim.date)}"></div>
        <div class="fg"><div class="fl">Scenario</div><input type="text" maxlength="80" list="gm-scenarios" data-ga="scenario" value="${esc(aim.scenario)}" placeholder="e.g. Gridshot Ultimate"></div>
        <div class="fg"><div class="fl">Score</div><input type="number" step="any" data-ga="score" value="${esc(aim.score)}"></div>
        <button class="btn btn-gm" data-ga-log>Log score</button>
      </div>
      <datalist id="gm-scenarios">${[...new Set(aimRows.map(x => x.scenario))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>
      <div class="gm-err" id="gm-sess-msg" style="display:none"></div>
      <div id="gm-sess-charts">${Fmt.chartsHtml(sessions, aimRows, view.metric, view.scenario)}</div>
      ${Fmt.historyHtml(sessions, aimRows)}`

    const msg = body.querySelector('#gm-sess-msg')
    const showMsg = t => { msg.textContent = t; msg.style.display = t ? '' : 'none' }
    const redraw = () => { body.querySelector('#gm-sess-charts').innerHTML = Fmt.chartsHtml(sessions, aimRows, view.metric, view.scenario); bindChartControls() }

    body.querySelectorAll('[data-gs]').forEach(el => el.addEventListener('input', () => { form[el.dataset.gs] = el.value }))
    body.querySelectorAll('[data-ga]').forEach(el => el.addEventListener('input', () => { aim[el.dataset.ga] = el.value }))

    function bindChartControls() {
      const m = body.querySelector('[data-gs-metric]'), s = body.querySelector('[data-gs-scenario]')
      if (m) m.addEventListener('change', () => { view.metric = m.value; redraw() })
      if (s) s.addEventListener('change', () => { view.scenario = s.value; redraw() })
    }
    bindChartControls()

    body.querySelector('[data-gs-log]').addEventListener('click', async () => {
      const res = await a.sessions.add({ ...form })
      if (!res.ok) return showMsg(res.error)
      notify(res, 'Session')
      Object.assign(form, { score: '', rank_change: '', result: '', smoothness: '', notes: '', start_time: '', end_time: '' })
      G.dataChanged()
      G.refreshCard('sessions')
    })
    body.querySelector('[data-ga-log]').addEventListener('click', async () => {
      const res = await a.aim.add({ ...aim })
      if (!res.ok) return showMsg(res.error)
      notify(res, 'Aim score')
      aim.score = ''
      G.dataChanged()
      G.refreshCard('sessions')
    })
    body.querySelectorAll('[data-gs-del-session]').forEach(b => b.addEventListener('click', async () => {
      const res = await a.sessions.remove(Number(b.dataset.gsDelSession)); if (!res.ok) return showMsg(res.error); G.dataChanged(); G.refreshCard('sessions')
    }))
    body.querySelectorAll('[data-gs-del-aim]').forEach(b => b.addEventListener('click', async () => {
      const res = await a.aim.remove(Number(b.dataset.gsDelAim)); if (!res.ok) return showMsg(res.error); G.dataChanged(); G.refreshCard('sessions')
    }))
  }

  G.registerCard({ id: 'sessions', title: 'Session Tracker', order: 40, render })
})()
