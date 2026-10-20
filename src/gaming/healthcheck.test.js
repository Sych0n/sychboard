'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const H = require('./healthcheck')

const NOW = Date.parse('2026-10-20T12:00:00Z')

const GOOD = () => ({
  admin: true,
  deviceGuard: { vbsStatus: 0, running: [], configured: [], hvciPolicy: null },
  hypervisor: { present: false, features: { 'Microsoft-Hyper-V-All': 'Disabled' }, needsAdmin: false },
  power: 'Power Scheme GUID: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (High performance)',
  game: { autoGameMode: 1, allowAutoGameMode: 1, gameBar: 0, gameDvr: 0, appCapture: 0, policyDvr: null },
  monitors: [
    { device: '\\\\.\\DISPLAY1', name: 'Main 320Hz', width: 2560, height: 1440, hz: 320, maxHz: 320, primary: true },
    { device: '\\\\.\\DISPLAY2', name: 'Side', width: 1920, height: 1080, hz: 320, maxHz: 320, primary: false }
  ],
  gpu: { adapters: [{ name: 'AMD Radeon RX 7800 XT', driverVersion: '32.0.1', driverDate: '2026-08-01' }], radeonSoftware: '26.6.4' },
  chipset: { found: true, name: 'AMD Chipset Software', version: '7.06.02.123' },
  bios: { vendor: 'American Megatrends', version: 'F10', date: '2026-03-01', board: 'Gigabyte A620M GAMING X' }
})

const by = (res, id) => res.checks.find(c => c.id === id)

test('a healthy system is all ✅', () => {
  const r = H.evaluate(GOOD(), { now: NOW })
  assert.equal(r.isAdmin, true)
  assert.deepEqual(r.checks.map(c => c.id), ['vbs', 'hvci', 'hypervisor', 'power', 'gamemode', 'gamedvr', 'monitors', 'gpu', 'chipset', 'bios'])
  for (const c of r.checks) { assert.equal(c.status, 'ok', c.id + ' ' + c.value); assert.ok(c.why.length > 20, c.id + ' has a why') }
})

test('VBS running + Memory Integrity + hypervisor are flagged', () => {
  const raw = GOOD()
  raw.deviceGuard = { vbsStatus: 2, running: [1, 2], configured: [1, 2], hvciPolicy: 1 }
  raw.hypervisor = { present: true, features: { 'Microsoft-Hyper-V-All': 'Enabled', VirtualMachinePlatform: 'Enabled' }, needsAdmin: false }
  const r = H.evaluate(raw, { now: NOW })
  assert.equal(by(r, 'vbs').status, 'warn')
  assert.equal(by(r, 'vbs').value, 'Running')
  assert.equal(by(r, 'hvci').status, 'warn')
  assert.equal(by(r, 'hypervisor').status, 'warn')
  assert.match(by(r, 'hypervisor').value, /Microsoft-Hyper-V-All: Enabled/)
})

test('HVCI configured but not running is not flagged (restart pending)', () => {
  const raw = GOOD()
  raw.deviceGuard = { vbsStatus: 1, running: [], configured: [2], hvciPolicy: 1 }
  const c = by(H.evaluate(raw, { now: NOW }), 'hvci')
  assert.equal(c.status, 'ok')
  assert.match(c.value, /not running/)
})

test('single-element arrays from PowerShell JSON (a bare number) are handled', () => {
  const raw = GOOD()
  raw.deviceGuard = { vbsStatus: 2, running: 2, configured: 2, hvciPolicy: null }
  assert.equal(by(H.evaluate(raw, { now: NOW }), 'hvci').status, 'warn')
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

test('game DVR: recording on warns, policy off wins, game bar alone is fine', () => {
  const r = GOOD(); r.game.gameBar = 1
  assert.equal(by(H.evaluate(r, { now: NOW }), 'gamedvr').status, 'ok')
  r.game.appCapture = 1
  const c = by(H.evaluate(r, { now: NOW }), 'gamedvr')
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
  assert.equal(r.checks.length, 10)
  assert.equal(by(r, 'vbs').status, 'warn')
  assert.equal(by(r, 'vbs').needsAdmin, true)
  assert.match(by(r, 'vbs').value, /Could not read: Access is denied/)
  assert.equal(by(r, 'hvci').status, 'warn')
  assert.equal(by(r, 'bios').status, 'warn')
  assert.equal(by(r, 'chipset').needsAdmin, false)
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
  assert.equal(res.checks.length, 10)
  assert.equal(res.ranAt, new Date(NOW).toISOString())
  await assert.rejects(H.runHealthCheck({ platform: 'win32', exec: (c, a, o, cb) => cb(new Error('spawn fail'), '') }), /PowerShell failed/)
  await assert.rejects(H.runHealthCheck({ platform: 'win32', exec: (c, a, o, cb) => cb(null, '{not json}') }), /parse/)
})

test('regression: display enumeration passes a real NULL (found on first live run — $null becomes "" in PowerShell)', () => {
  const s = H.readScript()
  assert.ok(/EnumDisplayDevices\(\[NullString\]::Value/.test(s))
  assert.ok(!/EnumDisplayDevices\(\$null/.test(s))
})
