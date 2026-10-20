'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { EventEmitter } = require('events')
const P = require('./presentmon')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-test-'))
const fakeExe = path.join(tmp, 'PresentMon-2.3.0-x64.exe')
fs.writeFileSync(fakeExe, 'not really an exe')

const HEADER = 'Application,ProcessID,SwapChainAddress,PresentRuntime,FrameType,FrameTime,CPUBusy'
const csv = rows => [HEADER, ...rows].join('\n')
const row = (app, ft, type = 'Application') => `${app},1,0x1,DXGI,${type},${ft},1`

test('validateExePath: only an existing presentmon*.exe', () => {
  assert.equal(P.validateExePath(fakeExe), path.normalize(fakeExe))
  assert.throws(() => P.validateExePath('PresentMon.exe'), /absolute/)
  const other = path.join(tmp, 'calc.exe'); fs.writeFileSync(other, 'x')
  assert.throws(() => P.validateExePath(other), /PresentMon/)
  assert.throws(() => P.validateExePath(path.join(tmp, 'PresentMon-missing.exe')), /not found/)
  assert.throws(() => P.validateExePath(null), /absolute/)
})

test('validateProcessName', () => {
  assert.equal(P.validateProcessName(''), '')
  assert.equal(P.validateProcessName('VALORANT-Win64-Shipping.exe'), 'VALORANT-Win64-Shipping.exe')
  assert.throws(() => P.validateProcessName('game.exe & calc'), /game\.exe/)
  assert.throws(() => P.validateProcessName('../x.exe'), /game\.exe/)
  assert.throws(() => P.validateProcessName('notanexe'), /game\.exe/)
})

test('clampSeconds', () => {
  assert.equal(P.clampSeconds(1), P.MIN_SECONDS)
  assert.equal(P.clampSeconds(9999), P.MAX_SECONDS)
  assert.equal(P.clampSeconds('30'), 30)
  assert.throws(() => P.clampSeconds('abc'), /number/)
})

test('buildArgs: timed, self-terminating, read-only flags', () => {
  const a = P.buildArgs({ outFile: 'C:\\t\\o.csv', seconds: 30, processName: 'game.exe' })
  assert.deepEqual(a.slice(0, 4), ['--output_file', 'C:\\t\\o.csv', '--timed', '30'])
  assert.ok(a.includes('--terminate_after_timed'))
  assert.deepEqual(a.slice(-2), ['--process_name', 'game.exe'])
  assert.ok(!P.buildArgs({ outFile: 'o', seconds: 5, processName: '' }).includes('--process_name'))
})

test('parseCsv picks the busiest app and skips generated frames', () => {
  const r = P.parseCsv(csv([
    row('dwm.exe', 16.6), row('dwm.exe', 16.7),
    row('game.exe', 3.1), row('game.exe', 3.2), row('game.exe', 3.0),
    row('game.exe', 1.5, 'AMD_AFMF')
  ]))
  assert.equal(r.app, 'game.exe')
  assert.deepEqual(r.frametimes, [3.1, 3.2, 3.0])
  assert.deepEqual(r.apps, [{ app: 'game.exe', frames: 3 }, { app: 'dwm.exe', frames: 2 }])
})

test('parseCsv honours an explicit process name (case-insensitive) and the 1.x column', () => {
  const v1 = 'Application,ProcessID,MsBetweenPresents\nGame.exe,1,4\nother.exe,2,9\nother.exe,2,9'
  const r = P.parseCsv(v1, 'game.exe')
  assert.equal(r.app, 'Game.exe')
  assert.deepEqual(r.frametimes, [4])
  assert.equal(P.parseCsv(v1, 'missing.exe').app, null)
})

test('parseCsv: quoted fields, bad rows, bad header', () => {
  const r = P.parseCsv('Application,FrameTime\n"my, game.exe",5\n"my, game.exe",abc\n"my, game.exe",-1\n')
  assert.equal(r.app, 'my, game.exe')
  assert.deepEqual(r.frametimes, [5])
  assert.throws(() => P.parseCsv('Foo,Bar\n1,2'), /Unrecognised/)
  assert.deepEqual(P.parseCsv('Application,FrameTime'), { app: null, frametimes: [], apps: [] })
})

// A stand-in for child_process.spawn: writes the CSV that PresentMon would, then exits.
function fakeSpawn({ csvText, code = 0, stderr = '', emitError } = {}) {
  const calls = []
  const fn = (exe, args, opts) => {
    calls.push({ exe, args, opts })
    const child = new EventEmitter()
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
    child.kill = () => { child.killed = true; setImmediate(() => child.emit('close', null)) }
    setImmediate(() => {
      if (emitError) return child.emit('error', new Error(emitError))
      if (stderr) child.stderr.emit('data', stderr)
      if (csvText != null) fs.writeFileSync(args[args.indexOf('--output_file') + 1], csvText)
      child.emit('close', code)
    })
    return child
  }
  fn.calls = calls
  return fn
}

test('startCapture: happy path computes metrics and cleans up the temp csv', async () => {
  const rows = []
  for (let i = 0; i < 200; i++) rows.push(row('game.exe', i === 100 ? 40 : 4))
  const spawn = fakeSpawn({ csvText: csv(rows) })
  const r = await P.startCapture({ exe: fakeExe, seconds: 10, processName: '', tempDir: tmp, spawn }).promise
  assert.equal(r.app, 'game.exe')
  assert.equal(r.metrics.frames, 200)
  assert.equal(r.metrics.spikes, 1)
  assert.equal(r.frametimes.length, 200)
  assert.equal(spawn.calls[0].opts.windowsHide, true)
  const outFile = spawn.calls[0].args[1]
  await new Promise(res => setTimeout(res, 50))
  assert.equal(fs.existsSync(outFile), false)
})

test('startCapture: access-denied is reported as an admin / ETW problem', async () => {
  const spawn = fakeSpawn({ csvText: null, code: 1, stderr: 'error: access denied, run as administrator' })
  await assert.rejects(P.startCapture({ exe: fakeExe, seconds: 5, tempDir: tmp, spawn }).promise, /administrator|Performance Log Users/)
})

test('startCapture: spawn error, no frames, cancel', async () => {
  await assert.rejects(P.startCapture({ exe: fakeExe, seconds: 5, tempDir: tmp, spawn: fakeSpawn({ emitError: 'spawn EACCES' }) }).promise, /could not start/)
  await assert.rejects(P.startCapture({ exe: fakeExe, seconds: 5, tempDir: tmp, spawn: fakeSpawn({ csvText: HEADER }) }).promise, /no data|No frames/i)
  await assert.rejects(P.startCapture({ exe: fakeExe, seconds: 5, processName: 'game.exe', tempDir: tmp, spawn: fakeSpawn({ csvText: csv([row('other.exe', 5)]) }) }).promise, /No frames captured for game\.exe/)
  const hang = fakeSpawn({ csvText: null })
  const h = (exe, args, o) => { const c = hang(exe, args, o); c.removeAllListeners(); return Object.assign(c, { kill() { setImmediate(() => c.emit('close', null)) } }) }
  const cap = P.startCapture({ exe: fakeExe, seconds: 5, tempDir: tmp, spawn: h })
  cap.cancel()
  await assert.rejects(cap.promise, /cancelled/)
})

test('startCapture rejects a bad exe before spawning anything', () => {
  const spawn = fakeSpawn()
  assert.throws(() => P.startCapture({ exe: 'C:\\Windows\\System32\\cmd.exe', seconds: 5, tempDir: tmp, spawn }), /PresentMon/)
  assert.equal(spawn.calls.length, 0)
})

test('auto-pick ignores <unknown> and dwm.exe unless nothing else presented (found on first live capture)', () => {
  const rows = [...Array(50).fill(0).map(() => row('<unknown>', 17)), ...Array(40).fill(0).map(() => row('dwm.exe', 16)), ...Array(10).fill(0).map(() => row('game.exe', 3))]
  assert.equal(P.parseCsv(csv(rows)).app, 'game.exe')
  const onlyNoise = [...Array(5).fill(0).map(() => row('<unknown>', 17)), row('dwm.exe', 16)]
  assert.equal(P.parseCsv(csv(onlyNoise)).app, '<unknown>')
})
