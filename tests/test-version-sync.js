#!/usr/bin/env node
'use strict';

/**
 * Version-sync regression suite (P0-4).
 *
 * `package.json.version` is the single source of truth. The build injects it
 * into the browser bundle, the banner, and the TypeScript definitions. This
 * suite fails if any shipped surface drifts or if a stale major version
 * (`v2.0.0` / `v1.3.2`) survives in prose or headers.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

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

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log('   P0-4: Version Single Source of Truth');
console.log('════════════════════════════════════════════════════════════════════════════\n');

test('package.json uses the locked 0.1.x line', () => {
  assert.match(version, /^0\.1\.\d+(?:[-+].+)?$/, `unexpected version ${version}`);
});

test('source SDK version matches package.json', () => {
  const { version: sourceVersion } = require(path.join(ROOT, 'src', 'workbench.ts'));
  assert.equal(sourceVersion, version);
});

test('built CJS bundle version matches package.json', () => {
  const { version: builtVersion } = require(path.join(ROOT, 'dist', 'code-lab.js'));
  assert.equal(builtVersion, version);
});

test('built bundle contains the injected version literal', () => {
  const built = read('dist/code-lab.js');
  assert.ok(
    built.includes(`const CODELAB_VERSION = '${version}';`),
    'expected the build to inject package.json.version into CODELAB_VERSION'
  );
});

test('bundle banner carries the package version', () => {
  const built = read('dist/code-lab.js');
  assert.ok(built.includes(`@innovatorved/code-lab ${tag}`), `banner is missing ${tag}`);
});

test('ESM bundle fallback and header carry the package version', () => {
  const esm = read('dist/code-lab.esm.js');
  assert.ok(esm.includes(`CodeLab ? CodeLab.version : '${version}'`), 'ESM fallback is stale');
  assert.ok(esm.includes(`@innovatorved/code-lab ${tag}`), 'ESM banner is stale');
});

test('TypeScript definitions carry the package version', () => {
  const dts = read('dist/code-lab.d.ts');
  assert.ok(dts.includes(`@innovatorved/code-lab ${tag}`), 'd.ts header is stale');
});

test('README and ARCHITECTURE document the package version', () => {
  assert.ok(read('README.md').includes(`\`${tag}\``), `README is missing ${tag}`);
  assert.ok(read('ARCHITECTURE.md').includes(`(${tag})`), `ARCHITECTURE is missing ${tag}`);
});

test('no stale library versions remain in shipped source or docs', () => {
  const files = [
    'README.md',
    'ARCHITECTURE.md',
    'src/index.ts',
    'src/schemas.ts',
    'src/workbench.ts',
    'tools/bundle.js'
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.ok(!text.includes('v2.0.0'), `${rel} still mentions v2.0.0`);
    assert.ok(!text.includes('v1.3.2'), `${rel} still mentions v1.3.2`);
  }
});

test('build fails loudly if the injection sentinel disappears', () => {
  const src = read('src/workbench.ts');
  assert.match(src, /const CODELAB_VERSION = '[^']*';/);
  const bundle = read('tools/bundle.js');
  assert.ok(bundle.includes('VERSION_SENTINEL'), 'build must validate the sentinel');
  assert.ok(bundle.includes('PKG_VERSION'), 'build must read package.json.version');
});

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log(`P0-4 Version Sync Suite Complete: ${passed} passed, ${failures.length} failed`);
console.log('════════════════════════════════════════════════════════════════════════════\n');

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n[${failure.name}]`);
    console.error(failure.err.stack || failure.err.message);
  }
  process.exit(1);
}
