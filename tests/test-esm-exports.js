'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Package Surface Integrity — Test Suite
 *
 * Guards the *published artifact* contract between the three module channels the
 * package advertises in `package.json#exports`:
 *
 *   1. CJS  (`require("@innovatorved/code-lab/runtime")`  -> dist/runtime.js)
 *   2. ESM  (`import  ...`                                -> dist/runtime.esm.js)
 *   3. Types (`.d.ts`)                                    -> dist/runtime.d.ts
 *
 * History: the ESM bundles used hand-maintained export lists that silently drifted
 * from the CJS bundles (`transpileForBrowser`, the `Virtual*` classes, `escapeHtml`
 * … were declared in the types and present in CJS but missing from ESM). This suite
 * fails loudly if that drift ever returns, and verifies every declared subpath
 * export actually resolves on disk.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PKG_DIR = path.join(__dirname, '..');
const DIST = path.join(PKG_DIR, 'dist');
const pkg = require(path.join(PKG_DIR, 'package.json'));

// CJS entry  ->  ESM entry for every dual-channel subpath.
const BUNDLES = [
  { name: 'code-lab', cjs: 'dist/code-lab.js', esm: 'dist/code-lab.esm.js', dts: 'dist/code-lab.d.ts' },
  { name: 'runtime', cjs: 'dist/runtime.js', esm: 'dist/runtime.esm.js', dts: 'dist/runtime.d.ts' },
  { name: 'shell', cjs: 'dist/shell.js', esm: 'dist/shell.esm.js', dts: 'dist/shell.d.ts' },
  { name: 'terminal', cjs: 'dist/terminal.js', esm: 'dist/terminal.esm.js', dts: 'dist/terminal.d.ts' }
];

function collectExportTargets(node, out) {
  if (typeof node === 'string') {
    if (node.startsWith('./')) out.add(node.slice(2));
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectExportTargets(v, out);
  }
  return out;
}

async function runSuite() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      failed++;
      failures.push({ name, err });
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${err && err.message ? err.message : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Package Surface Integrity (CJS ⇄ ESM ⇄ .d.ts)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- Suite A: package.json#exports resolves on disk ---');

  await test('A1 every declared export target exists in dist/', () => {
    const targets = [...collectExportTargets(pkg.exports, new Set())];
    assert.ok(targets.length >= 12, `expected a rich exports map, found ${targets.length} targets`);
    const missing = targets.filter((t) => !fs.existsSync(path.join(PKG_DIR, t)));
    assert.deepEqual(missing, [], `export targets declared but not shipped: ${missing.join(', ')}`);
  });

  await test('A2 "." / "./runtime" / "./shell" / "./terminal" point at real cjs+esm files', () => {
    for (const sub of ['.', './runtime', './shell', './terminal']) {
      const e = pkg.exports[sub];
      assert.ok(e, `exports["${sub}"] missing`);
      assert.ok(fs.existsSync(path.join(PKG_DIR, e.require)), `${sub}.require -> ${e.require} missing`);
      assert.ok(fs.existsSync(path.join(PKG_DIR, e.import)), `${sub}.import -> ${e.import} missing`);
      assert.ok(fs.existsSync(path.join(PKG_DIR, e.types)), `${sub}.types -> ${e.types} missing`);
    }
  });

  await test('A3 "./package.json" is exported (tooling convenience)', () => {
    assert.equal(pkg.exports['./package.json'], './package.json');
    assert.ok(fs.existsSync(path.join(PKG_DIR, 'package.json')));
  });

  console.log('\n--- Suite B: ESM named exports ⊇ CJS named exports ---');

  for (const b of BUNDLES) {
    await test(`B/${b.name}: ESM exports cover every CJS export`, async () => {
      const cjsMod = require(path.join(PKG_DIR, b.cjs));
      const cjsKeys = Object.keys(cjsMod).filter((k) => k !== 'default');
      const esmMod = await import(pathToFileURL(path.join(PKG_DIR, b.esm)).href);
      const esmKeys = Object.keys(esmMod).filter((k) => k !== 'default');

      const missing = cjsKeys.filter((k) => !esmKeys.includes(k));
      assert.deepEqual(
        missing,
        [],
        `${b.name}.esm.js is missing named exports present in the CJS bundle: ${missing.join(', ')}`
      );

      // Sanity: ESM bundle must expose *something* and a default export.
      assert.ok(esmKeys.length > 0, `${b.name}.esm.js exports nothing`);
      assert.ok('default' in esmMod, `${b.name}.esm.js has no default export`);
    });
  }

  await test('B5 ESM bundles are genuine ES modules (contain export statements)', () => {
    for (const b of BUNDLES) {
      const src = fs.readFileSync(path.join(PKG_DIR, b.esm), 'utf8');
      assert.match(src, /export\s*\{/, `${b.esm} has no named export block`);
      assert.match(src, /export default/, `${b.esm} has no default export`);
    }
  });

  console.log('\n--- Suite C: Type declarations cover the runtime surface ---');

  await test('C1 runtime.d.ts declares transpileForBrowser (browser-ESM transpiler)', () => {
    const dts = fs.readFileSync(path.join(DIST, 'runtime.d.ts'), 'utf8');
    assert.match(dts, /transpileForBrowser/, 'transpileForBrowser is not declared in dist/runtime.d.ts');
  });

  await test('C2 code-lab.d.ts declares transpileForBrowser and transpileTS', () => {
    const dts = fs.readFileSync(path.join(DIST, 'code-lab.d.ts'), 'utf8');
    assert.match(dts, /transpileForBrowser/);
    assert.match(dts, /transpileTS/);
  });

  await test('C3 declared types match the real runtime exports (spot check)', () => {
    const runtime = require(path.join(PKG_DIR, 'dist/runtime.js'));
    const dts = fs.readFileSync(path.join(DIST, 'runtime.d.ts'), 'utf8');
    const expected = {
      transpileForBrowser: 'function',
      transpileTS: 'function',
      createVirtualPortTable: 'function',
      executeInVirtualRuntime: 'function',
      EventEmitter: 'function',
      VirtualPath: 'object'
    };
    for (const [name, kind] of Object.entries(expected)) {
      assert.equal(typeof runtime[name], kind, `runtime.${name} should be a ${kind}`);
      assert.match(dts, new RegExp(`\\b${name}\\b`), `runtime.d.ts should declare ${name}`);
    }
  });

  console.log('\n--- Suite D: ./schemas subpath (previously declared but unbuilt) ---');

  await test('D1 dist/schemas.js + schemas.esm.js are built and loadable', async () => {
    const cjsPath = path.join(DIST, 'schemas.js');
    const esmPath = path.join(DIST, 'schemas.esm.js');
    assert.ok(fs.existsSync(cjsPath), 'dist/schemas.js was never built');
    assert.ok(fs.existsSync(esmPath), 'dist/schemas.esm.js was never built');

    const cjs = require(cjsPath);
    const esm = await import(pathToFileURL(esmPath).href);
    assert.ok(Object.keys(cjs).length > 0, 'schemas.js exports nothing');
    assert.ok('GuidedStepSchema' in esm, 'schemas.esm.js should export GuidedStepSchema');
  });

  await test('D2 schemas really validate (zod round-trip through the built artifacts)', () => {
    const { GitHubCloneOptionsSchema, CloneProgressPhaseSchema } = require(path.join(DIST, 'schemas.js'));

    // Defaults are applied by the built schema.
    const parsed = GitHubCloneOptionsSchema.parse({ targetDir: '/repo' });
    assert.equal(parsed.intoRoot, true, 'default intoRoot should be true');
    assert.equal(parsed.maxFiles, 2000, 'default maxFiles should be applied');

    // Enum schemas actually reject bad values.
    assert.equal(CloneProgressPhaseSchema.parse('downloading'), 'downloading');
    assert.throws(
      () => CloneProgressPhaseSchema.parse('definitely-not-a-phase'),
      'invalid enum input should be rejected by the schema'
    );
  });

  console.log('\n--- Suite E: honest version metadata in the shipped declarations ---');

  await test('E1 code-lab.d.ts header carries the SDK version, not a stale 1.x string', () => {
    const dts = fs.readFileSync(path.join(DIST, 'code-lab.d.ts'), 'utf8');
    assert.doesNotMatch(dts, /v1\.4\.0/, 'stale v1.4.0 header leaked into dist/code-lab.d.ts');
    assert.match(dts, /@innovatorved\/code-lab v2\.0\.0/, 'expected the v2.0.0 SDK banner');
  });

  console.log('\n--- Suite F: ESM parity holds for the subpath maps the docs promise ---');

  await test('F1 runtime/shell/terminal ESM export counts match their CJS counterparts', async () => {
    for (const b of BUNDLES.slice(1)) {
      const cjsN = Object.keys(require(path.join(PKG_DIR, b.cjs))).filter((k) => k !== 'default').length;
      const esmMod = await import(pathToFileURL(path.join(PKG_DIR, b.esm)).href);
      const esmN = Object.keys(esmMod).filter((k) => k !== 'default').length;
      assert.ok(
        esmN >= cjsN,
        `${b.name}: ESM exposes ${esmN} named exports but CJS exposes ${cjsN} — ESM is behind`
      );
    }
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`Package Surface Integrity Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) {
      console.log(`- ${f.name}: ${f.err && f.err.message ? f.err.message : f.err}`);
    }
  }

  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
