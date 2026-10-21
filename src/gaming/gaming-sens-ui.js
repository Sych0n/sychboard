// Sens Converter card. Maths lives in sens.js, persistence in store.js (via preload).
(function () {
  'use strict'
  const G = window.Gaming
  const S = window.GamingSens
  const esc = G.esc

  // Survives card re-renders (e.g. after saving a profile).
  const state = { game: 'valorant', sens: '0.4', dpi: '800', name: '' }

  const api = () => window.sychboard && window.sychboard.gaming && window.sychboard.gaming.sens

  const fmt = (n, d) => Number(n.toFixed(d)).toString()

  function resultsHtml() {
    let r
    try { r = S.convertAll(state.game, state.sens, state.dpi) } catch (e) {
      return `<div class="gm-err">${esc(e.message)}</div>`
    }
    const rows = r.games.map(g =>
      `<tr class="${g.key === state.game ? 'gm-src' : ''}"><td>${esc(g.name)}</td><td>${fmt(g.sens, 4)}</td><td>${fmt(g.eDpi, 1)}</td></tr>`).join('')
    return `
      <div class="gm-grid">
        <div class="metric"><div class="ml">cm / 360°</div><div class="mv">${fmt(r.cmPer360, 2)}</div></div>
        <div class="metric"><div class="ml">in / 360°</div><div class="mv">${fmt(r.inchesPer360, 2)}</div></div>
        <div class="metric"><div class="ml">eDPI</div><div class="mv">${fmt(r.eDpi, 1)}</div></div>
      </div>
      <table class="gm-table"><thead><tr><th>Game</th><th>Equivalent sens</th><th>eDPI</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="gm-note">Same DPI in every game. Equivalent sens = sens × yaw(source) ÷ yaw(target), so cm/360 is identical across the table.</div>`
  }

  async function profilesHtml() {
    const a = api()
    if (!a) return `<div class="gm-note">Saved profiles need the desktop app.</div>`
    const res = await a.list()
    if (!res.ok) return `<div class="gm-err">${esc(res.error)}</div>`
    if (!res.data.length) return `<div class="gm-note">No saved profiles yet. Name the current values and hit Save.</div>`
    return `<table class="gm-table"><tbody>${res.data.map(p => {
      let cm = ''
      try { cm = fmt(S.cmPer360(p.game, p.sens, p.dpi), 2) + ' cm/360' } catch (_) { /* unknown game: skip */ }
      return `<tr>
        <td><b>${esc(p.name)}</b><div class="gm-note" style="margin:2px 0 0">${esc((S.GAMES[p.game] || {}).name || p.game)} · ${p.sens} @ ${p.dpi} DPI · ${cm}</div></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" data-gm-load="${p.id}">Load</button>
          <button class="btn btn-sm btn-d" data-gm-del="${p.id}">Delete</button>
        </td></tr>`
    }).join('')}</tbody></table>`
  }

  async function render(body) {
    const gameOpts = Object.keys(S.GAMES).map(k =>
      `<option value="${k}"${k === state.game ? ' selected' : ''}>${esc(S.GAMES[k].name)}</option>`).join('')
    const profiles = await profilesHtml()
    body.innerHTML = `
      <div class="gm-row">
        <div class="fg"><div class="fl">Source game</div><select data-gm="game">${gameOpts}</select></div>
        <div class="fg"><div class="fl">Sensitivity</div><input type="number" step="any" min="0" data-gm="sens" value="${esc(state.sens)}"></div>
        <div class="fg"><div class="fl">Mouse DPI</div><input type="number" step="any" min="0" data-gm="dpi" value="${esc(state.dpi)}"></div>
      </div>
      <div id="gm-sens-results">${resultsHtml()}</div>
      <div class="gm-sub">Profiles</div>
      <div class="gm-row">
        <div class="fg"><div class="fl">Profile name</div><input type="text" maxlength="60" placeholder="e.g. Valorant main" data-gm="name" value="${esc(state.name)}"></div>
        <button class="btn btn-gm" data-gm-save>Save</button>
      </div>
      <div id="gm-sens-msg" class="gm-err" style="display:none"></div>
      <div id="gm-sens-profiles">${profiles}</div>`

    const msg = body.querySelector('#gm-sens-msg')
    const showMsg = t => { msg.textContent = t; msg.style.display = t ? '' : 'none' }

    // Live recalculation without re-rendering (keeps input focus).
    body.querySelectorAll('[data-gm]').forEach(el => el.addEventListener('input', () => {
      state[el.dataset.gm] = el.value
      if (el.dataset.gm !== 'name') body.querySelector('#gm-sens-results').innerHTML = resultsHtml()
    }))

    body.querySelector('[data-gm-save]').addEventListener('click', async () => {
      const a = api()
      if (!a) return showMsg('Saved profiles need the desktop app.')
      const res = await a.save({ name: state.name, game: state.game, sens: Number(state.sens), dpi: Number(state.dpi) })
      if (!res.ok) return showMsg(res.error)
      G.dataChanged()
      G.refreshCard('sens')
    })

    body.querySelectorAll('[data-gm-load]').forEach(btn => btn.addEventListener('click', async () => {
      const res = await api().list()
      const p = res.ok && res.data.find(x => x.id === Number(btn.dataset.gmLoad))
      if (!p) return
      Object.assign(state, { game: p.game, sens: String(p.sens), dpi: String(p.dpi), name: p.name })
      G.refreshCard('sens')
    }))

    body.querySelectorAll('[data-gm-del]').forEach(btn => btn.addEventListener('click', async () => {
      const res = await api().remove(Number(btn.dataset.gmDel))
      if (!res.ok) return showMsg(res.error)
      G.dataChanged()
      G.refreshCard('sens')
    }))
  }

  G.registerCard({ id: 'sens', title: 'Sens Converter', order: 10, render })
})()
