'use strict'
// Read-only system health check. healthcheck.ps1 gathers raw facts; evaluate()
// (pure, tested) turns them into ✅ / ⚠️ rows with a one-line "why this matters".
// Nothing here changes a setting — it only reports.
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const DAY = 86400000
const asArray = x => x == null ? [] : Array.isArray(x) ? x : [x]
const ADMIN_RE = /elevat|administrator|access is denied|privilege|not authorized/i

const ok = (id, title, value, why, needsAdmin = false) => ({ id, title, status: 'ok', value, why, needsAdmin })
const warn = (id, title, value, why, needsAdmin = false) => ({ id, title, status: 'warn', value, why, needsAdmin })

// A source that errored or returned nothing is reported, never silently skipped.
function unreadable(id, title, src, why) {
  const msg = src && src.error ? String(src.error) : 'no data returned'
  return warn(id, title, 'Could not read: ' + msg, why, ADMIN_RE.test(msg))
}
const bad = src => src == null || (typeof src === 'object' && !Array.isArray(src) && src.error)

function ageDays(dateStr, now) {
  const t = Date.parse(dateStr + 'T00:00:00Z')
  return Number.isNaN(t) ? null : Math.floor((now - t) / DAY)
}

function evaluate(raw, { now = Date.now() } = {}) {
  const checks = []

  // ── VBS / Memory Integrity ────────────────────────────────────────────────
  // Valorant's Vanguard REQUIRES Memory Integrity (HVCI): without it the game refuses to
  // launch (Riot error VAN:RESTRICTION 5). HVCI in turn needs VBS and a running hypervisor.
  // So "running" is the expected state for a Valorant player, and "off" is the problem.
  const dg = raw.deviceGuard
  const vbsWhy = 'Virtualization-based security runs Windows on a hypervisor and costs a little performance, but Valorant\'s Vanguard requires it (via Memory Integrity), so it should stay on.'
  const hvciWhy = 'Valorant\'s Vanguard requires Memory Integrity (HVCI) and refuses to launch without it (error VAN:RESTRICTION 5).'
  if (bad(dg)) {
    checks.push(unreadable('vbs', 'Virtualization-based security (VBS)', dg, vbsWhy))
    checks.push(unreadable('hvci', 'Memory Integrity (HVCI)', dg, hvciWhy))
  } else {
    const names = { 0: 'Off', 1: 'Enabled but not running', 2: 'Running' }
    const vbsLabel = names[dg.vbsStatus] || 'Unknown (' + dg.vbsStatus + ')'
    checks.push((dg.vbsStatus === 2 ? ok : warn)('vbs', 'Virtualization-based security (VBS)',
      dg.vbsStatus === 2 ? vbsLabel + ' (needed for Valorant)' : vbsLabel, vbsWhy))
    const running = asArray(dg.running), configured = asArray(dg.configured)
    const hvciRunning = running.includes(2)
    const hvciLabel = hvciRunning ? 'On (running) — required by Valorant'
      : (configured.includes(2) || dg.hvciPolicy === 1) ? 'Configured but not running (restart pending?)' : 'Off — Valorant will not launch'
    checks.push((hvciRunning ? ok : warn)('hvci', 'Memory Integrity (HVCI)', hvciLabel, hvciWhy))
  }

  // ── Hypervisor / Hyper-V ──────────────────────────────────────────────────
  // The hypervisor itself is required (see above). What isn't needed is the separate Hyper-V
  // role / virtual machines, which add extra overhead — that is what gets flagged here.
  const hv = raw.hypervisor
  const hvWhy = 'A hypervisor must be running for Memory Integrity (needed by Valorant). The optional Hyper-V role and virtual-machine features are not needed and add extra overhead.'
  if (bad(hv)) checks.push(unreadable('hypervisor', 'Hypervisor / Hyper-V', hv, hvWhy))
  else {
    const feats = Object.entries(hv.features || {}).map(([k, v]) => `${k}: ${v}`)
    const hyperVRole = (hv.features || {})['Microsoft-Hyper-V-All'] === 'Enabled'
    let value = hv.present ? 'Hypervisor is running (expected: needed for Valorant)' : 'No hypervisor running'
    if (feats.length) value += ' · ' + feats.join(', ')
    if (hv.needsAdmin) value += ' · optional-feature states need admin to read'
    checks.push((hyperVRole ? warn : ok)('hypervisor', 'Hypervisor / Hyper-V', value,
      hvWhy + (hyperVRole ? ' The Hyper-V role is enabled on this PC.' : ''), !!hv.needsAdmin))
  }

  // ── Power plan ────────────────────────────────────────────────────────────
  const pw = raw.power
  const pwWhy = 'The power plan controls how aggressively the CPU parks cores and drops clocks between frames; steadier clocks mean steadier frametimes.'
  if (typeof pw !== 'string' || !pw.trim()) checks.push(unreadable('power', 'Active power plan', typeof pw === 'object' ? pw : null, pwWhy))
  else {
    const m = /\(([^)]+)\)\s*$/.exec(pw.trim())
    const name = m ? m[1] : pw.trim()
    const slow = /power saver/i.test(name) || /^balanced$/i.test(name)
    checks.push((slow ? warn : ok)('power', 'Active power plan', name, pwWhy + (slow ? ' Consider a High / Ultimate Performance or AMD Ryzen plan (test one change at a time).' : '')))
  }

  // ── Game Mode ─────────────────────────────────────────────────────────────
  const gm = raw.game
  const gmWhy = 'Game Mode asks Windows to prioritise the foreground game and hold off background tasks such as driver and update installs.'
  if (bad(gm)) checks.push(unreadable('gamemode', 'Game Mode', gm, gmWhy))
  else {
    const off = gm.autoGameMode === 0 || gm.allowAutoGameMode === 0
    checks.push((off ? warn : ok)('gamemode', 'Game Mode', off ? 'Off' : (gm.autoGameMode == null ? 'On (default)' : 'On'), gmWhy))
  }

  // ── Xbox Game Bar / Game DVR ──────────────────────────────────────────────
  const dvrWhy = 'Background recording (Game DVR) keeps the GPU encoder and disk busy while you play; Game Bar itself is harmless when recording is off.'
  if (bad(gm)) checks.push(unreadable('gamedvr', 'Xbox Game Bar / Game DVR', gm, dvrWhy))
  else {
    const policyOff = gm.policyDvr === 0
    // HistoricalCaptureEnabled is the "Record what happened" switch — the thing that actually records
    // in the background. AppCaptureEnabled / GameDVR_Enabled only mean capture is *allowed* (e.g. a
    // manual hotkey clip), which costs nothing while idle, so they are shown but not flagged.
    const recording = !policyOff && gm.historical === 1
    const allowed = !policyOff && (gm.gameDvr === 1 || gm.appCapture === 1)
    const bar = gm.gameBar == null ? 'unknown' : gm.gameBar === 1 ? 'on' : 'off'
    const value = `Game Bar: ${bar} · background recording: ${recording ? 'ON' : 'off'} · manual capture: ${allowed ? 'allowed' : 'disabled'}${policyOff ? ' (disabled by policy)' : ''}`
    checks.push((recording ? warn : ok)('gamedvr', 'Xbox Game Bar / Game DVR', value, dvrWhy))
  }

  // ── Monitors ──────────────────────────────────────────────────────────────
  const mons = raw.monitors
  const monWhy = 'Windows composes every monitor together: a display running below its maximum refresh rate, or mixed refresh rates, can cap smoothness or cause stutter.'
  if (bad(mons) || !asArray(mons).length) checks.push(unreadable('monitors', 'Monitors & refresh rates', bad(mons) ? mons : null, monWhy))
  else {
    const list = asArray(mons)
    const lines = list.map(m =>
      `${String(m.device).replace('\\\\.\\', '')}${m.primary ? ' (main)' : ''} · ${m.name} · ${m.width}×${m.height} @ ${m.hz} Hz` + (m.maxHz > m.hz ? ` (supports up to ${m.maxHz} Hz)` : ''))
    const below = list.some(m => m.maxHz > m.hz)
    const mixed = new Set(list.map(m => m.hz)).size > 1
    const notes = []
    if (below) notes.push('a display is below its max refresh rate')
    if (mixed) notes.push('refresh rates differ between monitors')
    checks.push((below || mixed ? warn : ok)('monitors', 'Monitors & refresh rates', lines.join('\n'),
      monWhy + (notes.length ? ' Found: ' + notes.join('; ') + '.' : '')))
  }

  // ── GPU driver ────────────────────────────────────────────────────────────
  const gpu = raw.gpu
  const gpuWhy = 'Driver releases routinely fix frametime and stutter bugs; a very old driver is worth checking against current release notes.'
  const adapters = bad(gpu) ? [] : asArray(gpu.adapters).filter(a => !/basic render|remote display|virtual/i.test(a.name || ''))
  if (bad(gpu) || !adapters.length) checks.push(unreadable('gpu', 'GPU driver', bad(gpu) ? gpu : null, gpuWhy))
  else {
    const lines = adapters.map(a => [a.name, gpu.radeonSoftware && /amd|radeon/i.test(a.name) ? 'Adrenalin ' + gpu.radeonSoftware : null,
      a.driverVersion ? 'driver ' + a.driverVersion : null, a.driverDate].filter(Boolean).join(' · '))
    const ages = adapters.map(a => a.driverDate ? ageDays(a.driverDate, now) : null).filter(d => d != null)
    const old = ages.length && Math.max(...ages) > 180
    checks.push((old ? warn : ok)('gpu', 'GPU driver', lines.join('\n'), gpuWhy + (old ? ' This one is over 6 months old.' : '')))
  }

  // ── Chipset driver ────────────────────────────────────────────────────────
  const cs = raw.chipset
  const csWhy = 'The AMD chipset driver carries the Ryzen power-management and core-scheduling support Windows relies on for boost and parking behaviour.'
  if (bad(cs)) checks.push(unreadable('chipset', 'Chipset driver', cs, csWhy))
  else if (cs.found) checks.push(ok('chipset', 'Chipset driver', `${cs.name} ${cs.version || ''}`.trim(), csWhy))
  else checks.push(warn('chipset', 'Chipset driver', 'AMD chipset software not detected', csWhy + ' Windows may be using generic drivers.'))

  // ── BIOS ──────────────────────────────────────────────────────────────────
  const bios = raw.bios
  const biosWhy = 'BIOS / AGESA updates change memory training, EXPO stability and boost behaviour; a year-old BIOS is worth checking for updates.'
  if (bad(bios)) checks.push(unreadable('bios', 'BIOS', bios, biosWhy))
  else {
    const age = bios.date ? ageDays(bios.date, now) : null
    const old = age != null && age > 365
    const value = [bios.board, bios.vendor, bios.version, bios.date].filter(Boolean).join(' · ') + (age != null ? ` (${age} days old)` : '')
    checks.push((old ? warn : ok)('bios', 'BIOS', value, biosWhy + (old ? ' Yours is over a year old.' : '')))
  }

  // ── Stability (unexpected shutdowns, hardware errors, GPU driver resets) ──
  const stab = raw.stability
  const stabWhy = 'A shutdown with no crash code means power was lost or the PC froze and was reset with the power button. Repeats usually point at power delivery (PSU, cables, wall socket), heat, or unstable memory / overclock settings; hardware-error (WHEA) and display-driver resets point at the CPU, memory or GPU driver.'
  if (bad(stab)) checks.push(unreadable('stability', 'Stability (last 60 days)', stab, stabWhy))
  else {
    const events = asArray(stab.unexpected)
    const crashes = events.filter(e => e.bugcheck !== 0)
    const whea = stab.whea || 0, resets = stab.displayResets || 0
    const days = stab.days || 60
    if (!events.length && !whea && !resets) {
      checks.push(ok('stability', `Stability (last ${days} days)`, 'No unexpected shutdowns, hardware errors or display-driver resets', stabWhy))
    } else {
      const lines = []
      if (events.length) {
        const dates = events.slice(0, 5).map(e => e.time.slice(0, 10)).join(', ') + (events.length > 5 ? ` +${events.length - 5} more` : '')
        lines.push(`${events.length} unexpected shutdown${events.length === 1 ? '' : 's'} (${dates})` +
          (crashes.length ? ` · ${crashes.length} blue screen${crashes.length === 1 ? '' : 's'}` : ' · none with a crash code'))
      }
      if (whea) lines.push(`${whea} hardware error report${whea === 1 ? '' : 's'} (WHEA)`)
      if (resets) lines.push(`${resets} display-driver reset${resets === 1 ? '' : 's'}`)
      checks.push(warn('stability', `Stability (last ${days} days)`, lines.join('\n'), stabWhy))
    }
  }

  // ── Memory ────────────────────────────────────────────────────────────────
  const mem = raw.memory
  const memWhy = 'On Ryzen, memory speed sets how fast the CPU\'s memory controller runs and two sticks run in dual channel. A kit running below its rated speed usually means the EXPO / XMP profile is off; an aggressive profile can also be unstable, so errors in a memory test matter. Windows can report the active profile as the rating, so confirm EXPO / XMP in the BIOS if unsure.'
  const mods = bad(mem) ? [] : asArray(mem.modules)
  if (bad(mem) || !mods.length) checks.push(unreadable('memory', 'Memory', bad(mem) ? mem : null, memWhy))
  else {
    const total = mods.reduce((s, m) => s + (m.gb || 0), 0)
    const speeds = [...new Set(mods.map(m => m.configured || m.rated))]
    const below = mods.some(m => m.configured && m.rated && m.configured < m.rated)
    const notes = []
    if (mods.length === 1) notes.push('a single stick runs in single channel')
    if (below) notes.push('running below its rated speed')
    if (speeds.length > 1) notes.push('sticks run at different speeds')
    // Windows may report the active profile's speed as the module's rating, so a rating is only
    // shown when it differs from what the sticks are running at.
    const differs = mods.filter(m => m.rated && m.configured && m.rated !== m.configured)
    const value = `${mods.length} stick${mods.length === 1 ? '' : 's'} (${mods.map(m => m.gb).join(' + ')} GB = ${total} GB) · ${speeds.join(' / ')} MT/s` +
      (differs.length ? ` (module rating ${[...new Set(differs.map(m => m.rated))].join(' / ')})` : '')
    checks.push((notes.length ? warn : ok)('memory', 'Memory', value, memWhy + (notes.length ? ' Found: ' + notes.join('; ') + '.' : '')))
  }

  // ── Capture / overlay programs ────────────────────────────────────────────
  const apps = raw.apps
  const appsWhy = 'Recorders and overlays can make Windows composite the game instead of presenting it directly (more latency), and recorders use the GPU encoder. Fine day to day, but close them when testing smoothness — the Capture card shows which presentation path a game used.'
  if (bad(apps)) checks.push(unreadable('apps', 'Capture / overlay programs', apps, appsWhy))
  else {
    const NICE = {
      medal: 'Medal (clip recorder)', medalencoder: 'Medal (clip recorder)', obs64: 'OBS', obs32: 'OBS', 'streamlabs obs': 'Streamlabs',
      discord: 'Discord (overlay)', crosshairx: 'Crosshair X (overlay)', rtss: 'RivaTuner (overlay)', msiafterburner: 'MSI Afterburner',
      gamebarpresencewriter: 'Xbox Game Bar', overwolf: 'Overwolf (overlay)'
    }
    // Discord's overlay and Medal/Game Bar's always-on clip buffer sit in the background by
    // design — seeing them running isn't a sign anything is actively capturing. Only an app
    // the user deliberately opens to record (OBS, Streamlabs) is worth a warning.
    const RECORDERS = new Set(['obs64', 'obs32', 'streamlabs obs'])
    const list = asArray(apps)
    const names = [...new Set(list.map(n => NICE[String(n).toLowerCase()] || String(n)))]
    const recording = list.some(n => RECORDERS.has(String(n).toLowerCase()))
    checks.push((recording ? warn : ok)('apps', 'Capture / overlay programs',
      names.length ? 'Running now: ' + names.join(', ') : 'None running', appsWhy))
  }

  return { isAdmin: raw.admin === true, checks }
}

function readScript() {
  return fs.readFileSync(path.join(__dirname, 'healthcheck.ps1'), 'utf8')
}

function encodeCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

// Runs the PowerShell collector and evaluates it. Windows only.
function runHealthCheck({ platform = process.platform, exec = execFile, now = Date.now() } = {}) {
  if (platform !== 'win32') return Promise.reject(new Error('The health check is Windows-only'))
  const encoded = encodeCommand(readScript())
  return new Promise((resolve, reject) => {
    exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
        const s = String(stdout || '')
        const a = s.indexOf('{'), b = s.lastIndexOf('}')
        if (a < 0 || b < a) return reject(new Error(err ? 'PowerShell failed: ' + err.message : 'PowerShell returned no data'))
        let raw
        try { raw = JSON.parse(s.slice(a, b + 1)) } catch (e) { return reject(new Error('Could not parse health check output: ' + e.message)) }
        resolve({ ...evaluate(raw, { now }), ranAt: new Date(now).toISOString() })
      })
  })
}

module.exports = { evaluate, runHealthCheck, encodeCommand, readScript }
