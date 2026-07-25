// Minimal MCP (Model Context Protocol) stdio client for the main process.
// Talks newline-delimited JSON-RPC to sychboard-mcp/server.js — deliberately
// dependency-free so the Electron build is unaffected. Only implements the
// slice of MCP the assistant needs: initialize, tools/list, tools/call.
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const SERVER_DIR = path.join(__dirname, 'sychboard-mcp')
const SERVER_JS = path.join(SERVER_DIR, 'server.js')
const RPC_TIMEOUT_MS = 45000

let child = null
let nextId = 1
let pending = new Map() // id -> {resolve, reject, timer}
let readyPromise = null

function readPermissions() {
  try {
    return JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'permissions.json'), 'utf8')).tools || {}
  } catch (e) {
    console.error('[mcp] cannot read permissions.json:', e.message)
    return {}
  }
}

function teardown(reason) {
  for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error(reason)) }
  pending.clear()
  child = null
  readyPromise = null
}

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    if (!child || child.killed) return reject(new Error('MCP server not running'))
    const id = nextId++
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`MCP ${method} timed out`))
    }, RPC_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

function ensureStarted() {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    if (!fs.existsSync(SERVER_JS)) throw new Error(`sychboard-mcp not found at ${SERVER_JS}`)
    if (!fs.existsSync(path.join(SERVER_DIR, 'node_modules'))) {
      throw new Error('sychboard-mcp has no node_modules — run "npm install" inside sychboard-mcp/')
    }
    // process.execPath + ELECTRON_RUN_AS_NODE runs the server with Electron's
    // bundled Node, so this works even in packaged builds with no system node.
    child = spawn(process.execPath, [SERVER_JS], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    child.on('error', (err) => { console.error('[mcp] spawn error:', err.message); teardown('MCP server failed to start') })
    child.on('exit', (code) => { console.error('[mcp] server exited with code', code); teardown('MCP server exited') })
    child.stderr.on('data', (d) => console.log('[mcp-server]', String(d).trim()))

    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d.toString()
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        const p = msg.id !== undefined && pending.get(msg.id)
        if (!p) continue
        pending.delete(msg.id)
        clearTimeout(p.timer)
        if (msg.error) p.reject(new Error(msg.error.message || 'MCP error'))
        else p.resolve(msg.result)
      }
    })

    await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'sychboard-app', version: '1.0.17' }
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    console.log('[mcp] connected to sychboard-mcp')
  })()
  readyPromise.catch(() => teardown('MCP startup failed'))
  return readyPromise
}

// Returns [{name, description, inputSchema, mode}] — mode comes from
// permissions.json so the renderer knows which tools need an approval prompt.
async function listTools() {
  await ensureStarted()
  const perms = readPermissions()
  const res = await rpc('tools/list', {})
  return (res.tools || []).map((t) => ({
    name: t.name,
    description: t.description || '',
    inputSchema: t.inputSchema || { type: 'object', properties: {} },
    mode: perms[t.name]?.mode || 'missing'
  }))
}

// approved=true means the renderer showed the user an Allow/Deny prompt and
// they allowed it. Enforcement lives here (main process), not in the renderer:
// no permissions entry or unknown mode → refused; confirm without approval → refused.
async function callTool(name, args, approved) {
  const perms = readPermissions()
  const mode = perms[name]?.mode
  if (mode !== 'auto' && mode !== 'confirm') {
    return { isError: true, text: `Tool "${name}" is not permitted (mode: ${mode || 'no entry'} in permissions.json).` }
  }
  if (mode === 'confirm' && approved !== true) {
    return { isError: true, text: `Tool "${name}" requires user approval and none was given.` }
  }
  await ensureStarted()
  const res = await rpc('tools/call', { name, arguments: args || {} })
  const text = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  return { isError: !!res.isError, text: text || '(empty result)' }
}

function stop() {
  if (child && !child.killed) child.kill()
  teardown('MCP client stopped')
}

module.exports = { listTools, callTool, stop }
