#!/usr/bin/env node
'use strict';

/**
 * Bundle Size Budget Enforcer (`tools/check-bundle-size.js`)
 *
 * Enforces strict gzip size budgets on shipped artifacts so regressions fail CI:
 *   - `@innovatorved/code-lab/sql` (`dist/code-lab-sql.umd.js` + `dist/code-lab-sql.css`): < 35 KB gzipped
 *   - `dist/terminal.js`: < 45 KB gzipped
 *   - `dist/runtime.js`: < 250 KB gzipped
 *   - `dist/code-lab.js` (full umbrella IDE + Node/Bun + POSIX shell + SQL): < 650 KB gzipped
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const DIST = path.resolve(__dirname, '..', 'dist');

function gzipSize(relFile) {
  const full = path.join(DIST, relFile);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing build artifact: dist/${relFile}. Run "bun run build" first.`);
  }
  const raw = fs.readFileSync(full);
  const gz = zlib.gzipSync(raw, { level: 9 });
  return { rawBytes: raw.byteLength, gzBytes: gz.byteLength };
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

const BUDGETS = [
  {
    label: '@innovatorved/code-lab/sql (JS + CSS combined)',
    files: ['code-lab-sql.umd.js', 'code-lab-sql.css'],
    maxGzipKb: 35
  },
  {
    label: '@innovatorved/code-lab/sql (ESM JS + CSS combined)',
    files: ['code-lab-sql.esm.js', 'code-lab-sql.css'],
    maxGzipKb: 35
  },
  {
    label: '@innovatorved/code-lab/terminal',
    files: ['terminal.js'],
    maxGzipKb: 45
  },
  {
    label: '@innovatorved/code-lab/runtime',
    files: ['runtime.js'],
    maxGzipKb: 250
  },
  {
    label: '@innovatorved/code-lab (Full Umbrella IDE + CSS)',
    files: ['code-lab.js', 'code-lab.css'],
    maxGzipKb: 650
  }
];

let failed = false;
console.log('Bundle Size Report (gzip level 9):');
console.log('─'.repeat(76));

for (const entry of BUDGETS) {
  let rawTotal = 0;
  let gzTotal = 0;
  for (const f of entry.files) {
    const stats = gzipSize(f);
    rawTotal += stats.rawBytes;
    gzTotal += stats.gzBytes;
  }
  const maxBytes = entry.maxGzipKb * 1024;
  const ok = gzTotal <= maxBytes;
  if (!ok) failed = true;
  const badge = ok ? '✓' : '✗';
  console.log(
    `${badge} ${entry.label.padEnd(48)} raw: ${fmtKb(rawTotal).padStart(10)} | gzip: ${fmtKb(gzTotal).padStart(9)} / ${entry.maxGzipKb}.00 KB`
  );
}

console.log('─'.repeat(76));
if (failed) {
  console.error('✗ Bundle size budget exceeded!');
  process.exit(1);
}
console.log('✓ All bundle size budgets satisfied.');
