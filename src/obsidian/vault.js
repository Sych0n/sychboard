'use strict'
// Writes exported files into an Obsidian vault, safely.
//
// Rules (all enforced + tested):
//  * the target must be a real vault (a directory containing `.obsidian`)
//  * everything is written under <vault>/SychBoard/ only; a path that escapes it is refused
//  * an existing file is overwritten ONLY if it carries `source: sychboard` in its frontmatter
//    (otherwise it is skipped and reported — hand-written notes are never clobbered)
//  * unchanged files are not rewritten; writes are atomic (temp file + rename)
//  * nothing is ever deleted
const fs = require('fs')
const path = require('path')

const OWNED_RE = /^source:\s*sychboard\s*$/m

function isVault(p) {
  try { return typeof p === 'string' && fs.statSync(p).isDirectory() && fs.statSync(path.join(p, '.obsidian')).isDirectory() }
  catch (_) { return false }
}

function ownedBySychboard(file) {
  let head = ''
  try {
    const fd = fs.openSync(file, 'r')
    try { const buf = Buffer.alloc(2048); const n = fs.readSync(fd, buf, 0, 2048, 0); head = buf.toString('utf8', 0, n) } finally { fs.closeSync(fd) }
  } catch (_) { return false }
  if (!head.startsWith('---')) return false
  const end = head.indexOf('\n---', 3)
  return OWNED_RE.test(end === -1 ? head : head.slice(0, end))
}

function syncToVault(vaultPath, files) {
  if (!isVault(vaultPath)) throw new Error('Not an Obsidian vault (no .obsidian folder): ' + vaultPath)
  const root = path.resolve(vaultPath)
  const base = path.join(root, 'SychBoard')
  const result = { written: [], unchanged: [], skipped: [], errors: [] }
  for (const f of files) {
    try {
      const target = path.resolve(root, f.relPath)
      const rel = path.relative(base, target)
      if (rel.startsWith('..') || path.isAbsolute(rel) || rel === '') throw new Error('path escapes the SychBoard folder')
      if (typeof f.content !== 'string') throw new Error('no content')
      fs.mkdirSync(path.dirname(target), { recursive: true })
      if (fs.existsSync(target)) {
        if (!ownedBySychboard(target)) { result.skipped.push({ file: f.relPath, reason: 'a file with this name exists and was not created by SychBoard' }); continue }
        if (fs.readFileSync(target, 'utf8') === f.content) { result.unchanged.push(f.relPath); continue }
      }
      const tmp = target + '.sychboard-tmp'
      fs.writeFileSync(tmp, f.content, 'utf8')
      fs.renameSync(tmp, target)
      result.written.push(f.relPath)
    } catch (e) {
      result.errors.push({ file: f && f.relPath, error: e.message })
    }
  }
  return result
}

module.exports = { isVault, ownedBySychboard, syncToVault }
