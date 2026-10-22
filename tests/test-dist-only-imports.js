#!/usr/bin/env node
'use strict';

/**
 * Test-harness invariants (N-05).
 *
 * 1. Suites must load built artifacts, never raw TypeScript from `src/`.
 *    Raw `.ts` only loads under Bun's loader or Node's type-stripping
 *    (22.18+), so importing `src/` silently excluded Node 20 and produced the
 *    24/30 split recorded in the Phase 0 review.
 * 2. `globalThis.navigator` is a getter-only accessor from Node 21 onwards —
 *    assignments throw. Suites must use `tests/helpers/globals.js`.
 * 3. Every `tests/test-*.js` suite must be registered in `tests/run-all.js`,
 *    otherwise a suite can quietly stop running.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'fixtures') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(TESTS);
const rel = (f) => path.relative(ROOT, f);

// Infrastructure files legitimately contain the patterns under test.
const HELPERS = path.join(TESTS, 'helpers') + path.sep;
const SELF = path.join(TESTS, 'test-dist-only-imports.js');
const suiteFiles = files.filter((f) => f !== SELF && !f.startsWith(HELPERS));

// `require('.../src/foo.ts')` — module imports of TypeScript sources.
const SRC_REQUIRE = /require\(\s*(?:path\.(?:resolve|join)\([^)]*?['"]src['"][^)]*\)|['"][^'"]*\/src\/[^'"]+\.ts['"])\s*\)/;
// Test fixtures that are read as text (not imported) are fine: they exercise
// the transpiler with real source, e.g. tests/test-fuzz-schemas.js.

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log('   N-05: Portable Test Harness (built artifacts + Node globals)');
console.log('════════════════════════════════════════════════════════════════════════════\n');

test('no suite imports TypeScript from src/', () => {
  const offenders = suiteFiles
    .filter((f) => SRC_REQUIRE.test(fs.readFileSync(f, 'utf8')))
    .map(rel);
  assert.deepEqual(offenders, [], `these files still require src/*.ts: ${offenders.join(', ')}`);
});

test('suites load the shipped bundle through tests/helpers/load.js', () => {
  const loader = path.join(TESTS, 'helpers', 'load.js');
  assert.ok(fs.existsSync(loader), 'tests/helpers/load.js is missing');
  const src = fs.readFileSync(loader, 'utf8');
  assert.match(src, /dist['"],\s*'code-lab\.js'|code-lab\.js/, 'loader must resolve dist/code-lab.js');
  assert.match(src, /assertFresh/, 'loader must refuse a stale dist/');
});

test('no suite assigns globalThis.navigator directly', () => {
  const offenders = suiteFiles
    .filter((f) => /globalThis\.navigator\s*=(?!=)/.test(fs.readFileSync(f, 'utf8')))
    .map(rel);
  assert.deepEqual(
    offenders,
    [],
    `use setNavigator() from tests/helpers/globals.js (navigator is getter-only on Node 21+): ${offenders.join(', ')}`
  );
});

test('every test-*.js suite is registered in run-all.js', () => {
  const runner = fs.readFileSync(path.join(TESTS, 'run-all.js'), 'utf8');
  const suites = fs.readdirSync(TESTS)
    .filter((name) => /^test-.*\.js$/.test(name))
    .map((name) => `tests/${name}`);
  const missing = suites.filter((suite) => !runner.includes(`'${suite}'`));
  assert.deepEqual(missing, [], `not registered in tests/run-all.js: ${missing.join(', ')}`);
});

test('helpers are not accidentally treated as suites', () => {
  const helpers = fs.readdirSync(path.join(TESTS, 'helpers')).filter((n) => n.endsWith('.js'));
  assert.ok(helpers.length > 0, 'tests/helpers must contain shared helpers');
});

console.log('\n' + '─'.repeat(78));
if (failures.length === 0) {
  console.log(`Harness Invariants Complete: ${passed} passed, 0 failed`);
  process.exit(0);
}
console.log(`Harness Invariants Complete: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f.name}: ${f.err.message}`);
process.exit(1);
