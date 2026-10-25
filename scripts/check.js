'use strict';

// Syntax-checks the app's main process / shared files plus every gaming and
// obsidian module, then runs the test suite. See HANDOFF.md section 5 (B3).

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const FIXED_FILES = [
  'main.js',
  'preload.js',
  'mcp-client.js',
  'src/db.js',
  'src/renderer.js',
];

function jsFilesIn(dir) {
  return fs
    .readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(dir, name))
    .sort();
}

const files = [...FIXED_FILES, ...jsFilesIn('src/gaming'), ...jsFilesIn('src/obsidian')];

let failed = false;
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  try {
    execFileSync(process.execPath, ['--check', abs], { stdio: 'inherit' });
  } catch {
    failed = true;
    console.error(`node --check failed: ${rel}`);
  }
}

if (failed) {
  console.error(`check: syntax errors found in ${files.length} files checked`);
  process.exit(1);
}

console.log(`check: ${files.length} files OK`);
