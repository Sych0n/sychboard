'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const H = require('./healthcheck')

const NOW = Date.parse('2026-10-20T12:00:00Z')

const GOOD = () => ({
  admin: true,
  deviceGuard: { vbsStatus: 2, running: [1, 2], configured: [1, 2], hvciPolicy: 1 },
  hypervisor: { present: true, features: { 'Microsoft-Hyper-V-All': 'Disabled' }, needsAdmin: false },
  power: 'Power Scheme GUID: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (High performance)',
  game: { autoGameMode: 1, allowAutoGameMode: 1, gameBar: 0, gameDvr: 0, appCapture: 0, policyDvr: null },
  monitors: [
    { device: '\\\\.\\DISPLAY1', name: 'Main 320Hz', width: 2560, height: 1440, hz: 320, maxHz: 320, primary: true },
    { device: '\\\\.\\DISPLAY2', name: 'Side', width: 1920, height: 1080, hz: 320, maxHz: 320, primary: false }
  ],
  gpu: { adapters: [{ name: 'AMD Radeon RX 7800 XT', driverVersion: '32.0.1', driverDate: '2026-08-01' }], radeonSoftware: '26.6.4' },
  chipset: { found: true, name: 'AMD Chipset Software', version: '7.06.02.123' },
  bios: { vendor: 'American Megatrends', version: 'F10', date: '2026-03-01', board: 'Gigabyte A620M GAMING X' },
  stability: { days: 60, unexpected: [], whea: 0, displayResets: 0 },
  memory: { modules: [{ gb: 16, rated: 6000, configured: 6000 }, { gb: 16, rated: 6000, configured: 6000 }] },
  apps: []
})

const by = (res, id) => res.checks.find(c => c.id === id)

test('a healthy system is all ✅', () => {
  const r = H.evaluate(GOOD(), { now: NOW })
  assert.equal(r.isAdmin, true)
  assert.deepEqual(r.checks.map(c => c.id), ['vbs', 'hvci', 'hypervisor', 'power', 'gamemode', 'gamedvr', 'monitors', 'gpu', 'chipset', 'bios', 'stability', 'memory', 'apps'])
  for (const c of r.checks) { assert.equal(c.status, 'ok', c.id + ' ' + c.value); assert.ok(c.why.length > 20, c.id + ' has a why') }
})

test('Valorant needs Memory Integrity: running VBS / HVCI / hypervisor is expected (ok), off is the warning', () => {
  const r = H.evaluate(GOOD(), { now: NOW })
  assert.equal(by(r, 'vbs').status, 'ok')
  assert.match(by(r, 'vbs').value, /Running.*needed for Valorant/)
  assert.equal(by(r, 'hvci').status, 'ok')
  assert.match(by(r, 'hvci').value, /required by Valorant/)
  assert.equal(by(r, 'hypervisor').status, 'ok')
  assert.match(by(r, 'hvci').why, /VAN:RESTRICTION 5/)
  const off = GOOD(); off.deviceGuard = { vbsStatus: 0, running: [], configured: [], hvciPolicy: null }
  const r2 = H.evaluate(off, { now: NOW })
  assert.equal(by(r2, 'vbs').status, 'warn')
  assert.equal(by(r2, 'hvci').status, 'warn')
  assert.match(by(r2, 'hvci').value, /Valorant will not launch/)
})

test('the Hyper-V role (not the hypervisor itself) is what gets flagged', () => {
  const raw = GOOD()
  raw.hypervisor = { present: true, features: { 'Microsoft-Hyper-V-All': 'Enabled', VirtualMachinePlatform: 'Enabled' }, needsAdmin: false }
  const c = by(H.evaluate(raw, { now: NOW }), 'hypervisor')
  assert.equal(c.status, 'warn')
  assert.match(c.value, /Microsoft-Hyper-V-All: Enabled/)
  assert.match(c.why, /Hyper-V role is enabled/)
})

test('HVCI configured but not running warns (Valorant would refuse to launch until a restart)', () => {
  const raw = GOOD()
  raw.deviceGuard = { vbsStatus: 1, running: [], configured: [2], hvciPolicy: 1 }
  const c = by(H.evaluate(raw, { now: NOW }), 'hvci')
  assert.equal(c.status, 'warn')
  assert.match(c.value, /not running/)
})

test('single-element arrays from PowerShell JSON (a bare number) are handled', () => {
  const raw = GOOD()
  raw.deviceGuard = { vbsStatus: 2, running: 2, configured: 2, hvciPolicy: null }
  assert.equal(by(H.evaluate(raw, { now: NOW }), 'hvci').status, 'ok') // a bare 2 still means HVCI is running
  raw.monitors = raw.monitors[0] // single object instead of [object]
  assert.equal(by(H.evaluate(raw, { now: NOW }), 'monitors').status, 'ok')
})

test('power plan: balanced / power saver warn, ryzen + ultimate ok', () => {
  const plan = n => { const r = GOOD(); r.power = `Power Scheme GUID: abc  (${n})`; return by(H.evaluate(r, { now: NOW }), 'power') }
  assert.equal(plan('Balanced').status, 'warn')
  assert.equal(plan('Power saver').status, 'warn')
  assert.equal(plan('Ultimate Performance').status, 'ok')
  assert.equal(plan('AMD Ryzen Balanced').status, 'ok')
  assert.equal(plan('Balanced').value, 'Balanced')
})

test('game mode: default (unset) is on, explicit 0 is off', () => {
  const r = GOOD(); r.game.autoGameMode = null; r.game.allowAutoGameMode = null
  assert.equal(by(H.evaluate(r, { now: NOW }), 'gamemode').value, 'On (default)')
  r.game.autoGameMode = 0
  assert.equal(by(H.evaluate(r, { now: NOW }), 'gamemode').status, 'warn')
})

test('game DVR: only background recording (HistoricalCaptureEnabled) warns; "capture allowed" alone is fine; policy off wins', () => {
  const r = GOOD(); r.game.gameBar = 1
  assert.equal(by(H.evaluate(r, { now: NOW }), 'gamedvr').status, 'ok')
  // The real-world state after turning "Record what happened" off: capture still allowed, not recording.
  r.game.appCapture = 1; r.game.gameDvr = 1; r.game.historical = 0
  let c = by(H.evaluate(r, { now: NOW }), 'gamedvr')
  assert.equal(c.status, 'ok')
  assert.match(c.value, /background recording: off · manual capture: allowed/)
  r.game.historical = 1
  c = by(H.evaluate(r, { now: NOW }), 'gamedvr')
  assert.equal(c.status, 'warn')
  assert.match(c.value, /recording: ON/)
  r.game.policyDvr = 0
  assert.equal(by(H.evaluate(r, { now: NOW }), 'gamedvr').status, 'ok')
})

test('monitors: below-max and mixed refresh rates both warn and are explained', () => {
  const r = GOOD(); r.monitors[0].hz = 60
  let c = by(H.evaluate(r, { now: NOW }), 'monitors')
  assert.equal(c.status, 'warn')
  assert.match(c.why, /below its max/)
  assert.match(c.value, /supports up to 320 Hz/)
  const r2 = GOOD(); r2.monitors[1].hz = 165; r2.monitors[1].maxHz = 165
  c = by(H.evaluate(r2, { now: NOW }), 'monitors')
  assert.equal(c.status, 'warn')
  assert.match(c.why, /differ between monitors/)
  assert.match(c.value, /DISPLAY1 \(main\)/)
})

test('driver / bios age thresholds', () => {
  const r = GOOD()
  r.gpu.adapters[0].driverDate = '2026-01-01' // 292 days
  assert.equal(by(H.evaluate(r, { now: NOW }), 'gpu').status, 'warn')
  r.bios.date = '2025-01-01'
  const b = by(H.evaluate(r, { now: NOW }), 'bios')
  assert.equal(b.status, 'warn')
  assert.match(b.value, /days old/)
})

test('GPU value includes the Adrenalin version; virtual adapters are ignored', () => {
  const r = GOOD(); r.gpu.adapters.push({ name: 'Microsoft Basic Render Driver', driverVersion: '1', driverDate: '2000-01-01' })
  const c = by(H.evaluate(r, { now: NOW }), 'gpu')
  assert.equal(c.status, 'ok')
  assert.match(c.value, /Adrenalin 26\.6\.4/)
  assert.ok(!/Basic Render/.test(c.value))
})

test('chipset not found warns', () => {
  const r = GOOD(); r.chipset = { found: false }
  assert.equal(by(H.evaluate(r, { now: NOW }), 'chipset').status, 'warn')
})

test('without admin: optional-feature state is flagged as needing admin, not hidden', () => {
  const r = GOOD(); r.admin = false
  r.hypervisor = { present: false, features: {}, needsAdmin: true }
  const res = H.evaluate(r, { now: NOW })
  assert.equal(res.isAdmin, false)
  assert.equal(by(res, 'hypervisor').needsAdmin, true)
  assert.match(by(res, 'hypervisor').value, /need admin/)
})

test('errored / missing sources become ⚠ rows (admin-flagged when relevant), never silent', () => {
  const raw = GOOD()
  raw.deviceGuard = { error: 'Access is denied.' }
  delete raw.bios
  raw.chipset = { error: 'boom' }
  const r = H.evaluate(raw, { now: NOW })
  assert.equal(r.checks.length, 13)
  assert.equal(by(r, 'vbs').status, 'warn')
  assert.equal(by(r, 'vbs').needsAdmin, true)
  assert.match(by(r, 'vbs').value, /Could not read: Access is denied/)
  assert.equal(by(r, 'hvci').status, 'warn')
  assert.equal(by(r, 'bios').status, 'warn')
  assert.equal(by(r, 'chipset').needsAdmin, false)
})

test('stability: clean log is ok; unexpected shutdowns, WHEA and display resets each warn and are itemised', () => {
  const raw = GOOD()
  raw.stability = { days: 60, unexpected: [{ time: '2026-10-11 21:47', bugcheck: 0 }], whea: 0, displayResets: 0 }
  let c = by(H.evaluate(raw, { now: NOW }), 'stability')
  assert.equal(c.status, 'warn')
  assert.match(c.value, /1 unexpected shutdown \(2026-10-11\) · none with a crash code/)

  const many = Array.from({ length: 7 }, (_, i) => ({ time: `2026-09-0${i + 1} 10:00`, bugcheck: i === 0 ? 278 : 0 }))
  raw.stability = { days: 60, unexpected: many, whea: 3, displayResets: 1 }
  c = by(H.evaluate(raw, { now: NOW }), 'stability')
  assert.match(c.value, /7 unexpected shutdowns \(.*\+2 more\) · 1 blue screen/)
  assert.match(c.value, /3 hardware error reports \(WHEA\)/)
  assert.match(c.value, /1 display-driver reset\b/)

  raw.stability = { days: 60, unexpected: [], whea: 0, displayResets: 0 }
  assert.equal(by(H.evaluate(raw, { now: NOW }), 'stability').status, 'ok')
  // a lone event object (PowerShell unwraps one-element arrays) still works
  raw.stability = { days: 60, unexpected: { time: '2026-10-01 09:00', bugcheck: 0 }, whea: 0, displayResets: 0 }
  assert.match(by(H.evaluate(raw, { now: NOW }), 'stability').value, /1 unexpected shutdown/)
})

test('memory: dual channel at rated speed is ok; single stick, below rated, mixed speeds warn', () => {
  const raw = GOOD()
  let c = by(H.evaluate(raw, { now: NOW }), 'memory')
  assert.equal(c.status, 'ok')
  assert.equal(c.value, '2 sticks (16 + 16 GB = 32 GB) · 6000 MT/s')
  raw.memory = { modules: [{ gb: 32, rated: 6000, configured: 6000 }] }
  c = by(H.evaluate(raw, { now: NOW }), 'memory'); assert.equal(c.status, 'warn'); assert.match(c.why, /single channel/)
  raw.memory = { modules: [{ gb: 16, rated: 6000, configured: 4800 }, { gb: 16, rated: 6000, configured: 4800 }] }
  c = by(H.evaluate(raw, { now: NOW }), 'memory'); assert.equal(c.status, 'warn'); assert.match(c.why, /below its rated speed/)
  assert.match(c.value, /4800 MT\/s \(module rating 6000\)/)
  raw.memory = { modules: [{ gb: 16, rated: 6000, configured: 6000 }, { gb: 16, rated: 5600, configured: 5600 }] }
  c = by(H.evaluate(raw, { now: NOW }), 'memory'); assert.equal(c.status, 'warn'); assert.match(c.why, /different speeds/)
  raw.memory = { modules: [] }
  assert.match(by(H.evaluate(raw, { now: NOW }), 'memory').value, /Could not read/)
})

test('capture / overlay programs: none is ok; always-on overlay/buffer apps are informational, deliberate recorders warn (named in plain words; a lone name from PowerShell works too)', () => {
  const raw = GOOD()
  assert.equal(by(H.evaluate(raw, { now: NOW }), 'apps').status, 'ok')
  raw.apps = ['Discord', 'Medal', 'MedalEncoder']
  let c = by(H.evaluate(raw, { now: NOW }), 'apps')
  assert.equal(c.status, 'ok') // background overlay + always-on clip buffer, not a deliberate capture
  assert.equal(c.value, 'Running now: Discord (overlay), Medal (clip recorder)') // Medal + its encoder are one program
  raw.apps = 'obs64'
  c = by(H.evaluate(raw, { now: NOW }), 'apps')
  assert.equal(c.status, 'warn') // the user deliberately opened a recorder
  assert.equal(c.value, 'Running now: OBS')
  delete raw.apps
  assert.match(by(H.evaluate(raw, { now: NOW }), 'apps').value, /Could not read/)
})

test('the collector script is read-only', () => {
  const s = H.readScript()
  // No cmdlet that modifies state. (Add-Type only compiles the display-query shim.)
  assert.ok(!/\b(Set|New|Remove|Enable|Disable|Install|Uninstall|Start|Stop|Restart|Clear|Write)-(?!Object\b|Host\b)[A-Za-z]+/.test(s.replace(/#.*$/gm, '')), 'no mutating cmdlets')
  assert.ok(!/powercfg\s+\/(s|setactive|change|x|import|delete)/i.test(s))
  assert.ok(!/\bnet\s+(stop|start)|\bsc\s+(stop|config)|bcdedit|reg\s+(add|delete)|Set-ItemProperty|New-ItemProperty|Remove-ItemProperty/i.test(s))
  assert.ok(/powercfg \/getactivescheme/.test(s))
})

test('encoded command stays under the Windows command-line limit', () => {
  const enc = H.encodeCommand(H.readScript())
  assert.ok(enc.length < 30000, 'encoded length ' + enc.length)
  assert.equal(Buffer.from(enc, 'base64').toString('utf16le'), H.readScript())
})

test('runHealthCheck: Windows only; parses output despite stderr noise; reports failures', async () => {
  await assert.rejects(H.runHealthCheck({ platform: 'linux' }), /Windows-only/)
  const raw = JSON.stringify(GOOD())
  const exec = (cmd, args, opts, cb) => {
    assert.equal(cmd, 'powershell.exe')
    assert.ok(args.includes('-NoProfile') && args.includes('-EncodedCommand'))
    assert.ok(!args.includes('-ExecutionPolicy'), 'must not touch execution policy')
    cb(null, 'noise before\n' + raw + '\n')
  }
  const res = await H.runHealthCheck({ platform: 'win32', exec, now: NOW })
  assert.equal(res.checks.length, 13)
  assert.equal(res.ranAt, new Date(NOW).toISOString())
  await assert.rejects(H.runHealthCheck({ platform: 'win32', exec: (c, a, o, cb) => cb(new Error('spawn fail'), '') }), /PowerShell failed/)
  await assert.rejects(H.runHealthCheck({ platform: 'win32', exec: (c, a, o, cb) => cb(null, '{not json}') }), /parse/)
})

test('regression: display enumeration passes a real NULL (found on first live run — $null becomes "" in PowerShell)', () => {
  const s = H.readScript()
  assert.ok(/EnumDisplayDevices\(\[NullString\]::Value/.test(s))
  assert.ok(!/EnumDisplayDevices\(\$null/.test(s))
})
