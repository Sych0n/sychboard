'use strict'
// Wrapper around Intel's PresentMon CLI (2.x flag syntax).
//
// PresentMon reads frame-presentation events from Windows ETW. It does not touch
// the game process, so there is nothing here that reads game memory, injects or
// overlays — but per GAMING_TAB_PLAN.md captures should still be done with games
// closed or in the practice range.
//
// SychBoard never downloads PresentMon: the user picks the exe they downloaded
// themselves, and only an exe named presentmon*.exe is ever launched.
const fs = require('fs')
const path = require('path')
const { spawn: nodeSpawn } = require('child_process')
const Frames = require('./framemetrics')

const MIN_SECONDS = 5
const MAX_SECONDS = 120
const SESSION_NAME = 'SychBoardCapture'

function validateExePath(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) throw new Error('PresentMon path must be absolute')
  if (!/^presentmon[\w.\-]*\.exe$/i.test(path.basename(p))) throw new Error('That does not look like a PresentMon executable (expected PresentMon*.exe)')
  let st
  try { st = fs.statSync(p) } catch (_) { throw new Error('PresentMon executable not found at ' + p) }
  if (!st.isFile()) throw new Error('PresentMon path is not a file')
  return path.normalize(p)
}

function validateProcessName(n) {
  const t = typeof n === 'string' ? n.trim() : ''
  if (!t) return ''
  if (!/^[\w.\-]{1,64}\.exe$/i.test(t)) throw new Error('Process name must look like game.exe')
  return t
}

function clampSeconds(s) {
  const n = Math.round(Number(s))
  if (!Number.isFinite(n)) throw new Error('Duration must be a number of seconds')
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n))
}

function buildArgs({ outFile, seconds, processName }) {
  const args = [
    '--output_file', outFile,
    '--timed', String(seconds),
    '--terminate_after_timed',
    '--no_console_stats',
    '--session_name', SESSION_NAME,
    '--stop_existing_session'
  ]
  if (processName) args.push('--process_name', processName)
  return args
}

function splitCsvLine(line) {
  const out = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

// Returns { app, frametimes, apps:[{app,frames}] }. With no processName the
// application with the most frames is used (a desktop has many presenting apps).
function parseCsv(text, processName) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { app: null, frametimes: [], apps: [] }
  const header = splitCsvLine(lines[0]).map(h => h.trim())
  const iApp = header.indexOf('Application')
  // 1.x calls it MsBetweenPresents, 2.x FrameTime.
  let iFt = header.indexOf('MsBetweenPresents')
  if (iFt < 0) iFt = header.indexOf('FrameTime')
  const iType = header.indexOf('FrameType')
  if (iApp < 0 || iFt < 0) throw new Error('Unrecognised PresentMon CSV (no Application / FrameTime columns) — is this PresentMon 2.x?')

  const byApp = new Map()
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i])
    // Generated frames (frame generation: AFMF etc.) are not rendered frames.
    if (iType >= 0 && c[iType] && c[iType].trim() !== 'Application') continue
    const ft = parseFloat(c[iFt])
    if (!Number.isFinite(ft) || ft <= 0) continue
    const app = (c[iApp] || '').trim()
    if (!byApp.has(app)) byApp.set(app, [])
    byApp.get(app).push(ft)
  }
  const apps = [...byApp.entries()].map(([app, f]) => ({ app, frames: f.length })).sort((a, b) => b.frames - a.frames)
  let chosen = null
  if (processName) chosen = apps.find(a => a.app.toLowerCase() === processName.toLowerCase()) || null
  else {
    // "<unknown>" is a catch-all for frames PresentMon couldn't attribute to a process
    // and dwm.exe is the compositor — neither is what you want to measure, so only
    // fall back to them when nothing else presented.
    const NOISE = new Set(['<unknown>', 'dwm.exe'])
    chosen = apps.find(a => !NOISE.has(a.app.toLowerCase())) || apps[0] || null
  }
  return { app: chosen ? chosen.app : null, frametimes: chosen ? byApp.get(chosen.app) : [], apps }
}

// Returns { promise, cancel }. The promise resolves to
// { app, apps, frametimes, metrics, seconds } or rejects with a user-readable Error.
function startCapture({ exe, seconds, processName, tempDir, spawn = nodeSpawn }) {
  const exePath = validateExePath(exe)
  const secs = clampSeconds(seconds)
  const proc = validateProcessName(processName)
  const outFile = path.join(tempDir, `sychboard-capture-${Date.now()}.csv`)

  let child = null, cancelled = false, timer = null
  const promise = new Promise((resolve, reject) => {
    let stderr = ''
    const cleanup = () => { clearTimeout(timer); fs.rm(outFile, { force: true }, () => {}) }
    try {
      child = spawn(exePath, buildArgs({ outFile, seconds: secs, processName: proc }), { windowsHide: true })
    } catch (e) { return reject(new Error('Could not start PresentMon: ' + e.message)) }

    const grab = d => { if (stderr.length < 4000) stderr += String(d) }
    if (child.stdout) child.stdout.on('data', grab)
    if (child.stderr) child.stderr.on('data', grab)
    // Safety net: --timed should end it; if not, don't leave an ETW session running.
    timer = setTimeout(() => { try { child.kill() } catch (_) {} }, (secs + 20) * 1000)

    child.on('error', e => {
      cleanup()
      reject(new Error('PresentMon could not start (' + e.message + '). It may need to be run as administrator, or your user added to the "Performance Log Users" group.'))
    })
    child.on('close', code => {
      if (cancelled) { cleanup(); return reject(new Error('Capture cancelled')) }
      let text = ''
      try { text = fs.readFileSync(outFile, 'utf8') } catch (_) { /* no file */ }
      cleanup()
      if (!text.trim()) {
        if (/access|privilege|elevat|administrator|Performance Log Users/i.test(stderr))
          return reject(new Error('PresentMon was denied access to ETW. Run SychBoard as administrator, or add your user to the "Performance Log Users" group.'))
        return reject(new Error(`PresentMon produced no data (exit code ${code}).${stderr.trim() ? ' ' + stderr.trim().slice(0, 300) : ''}`))
      }
      let parsed
      try { parsed = parseCsv(text, proc) } catch (e) { return reject(e) }
      const metrics = Frames.computeMetrics(parsed.frametimes)
      if (!metrics) {
        return reject(new Error(proc
          ? `No frames captured for ${proc}. Is it running and presenting frames?`
          : 'No frames captured. Make sure a game or app is actively presenting frames during the capture.'))
      }
      resolve({ app: parsed.app, apps: parsed.apps.slice(0, 8), frametimes: parsed.frametimes, metrics, seconds: secs })
    })
  })

  return { promise, cancel: () => { cancelled = true; try { child && child.kill() } catch (_) {} } }
}

module.exports = { MIN_SECONDS, MAX_SECONDS, validateExePath, validateProcessName, clampSeconds, buildArgs, splitCsvLine, parseCsv, startCapture }
