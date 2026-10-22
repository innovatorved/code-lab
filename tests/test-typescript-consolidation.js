#!/usr/bin/env node
'use strict';

/**
 * P0-6: TypeScript consolidation regression suite.
 *
 * Historically the repository shipped two copies of every engine:
 * `src/*.js` (used by the bundler and tests) and `src/*.ts` (used by `tsc`).
 * The copies drifted: fixes landed in one and not the other.
 *
 * The shipping implementation now lives only in `src/*.ts`. This suite pins
 * that layout so a second copy cannot reintroduce the drift.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENGINES = ['runtime', 'shell', 'terminal', 'workbench'];

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

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log('   P0-6: TypeScript Consolidation');
console.log('════════════════════════════════════════════════════════════════════════════\n');

test('each engine has exactly one shipping source, and it is TypeScript', () => {
  for (const engine of ENGINES) {
    assert.ok(exists(`src/${engine}.ts`), `src/${engine}.ts must exist`);
    assert.ok(!exists(`src/${engine}.js`), `src/${engine}.js is a duplicate source; delete it`);
  }
});

test('the bundler reads the TypeScript sources', () => {
  const bundle = read('tools/bundle.js');
  for (const engine of ENGINES) {
    assert.ok(
      bundle.includes(`SRC_DIR, '${engine}.ts'`),
      `tools/bundle.js must read src/${engine}.ts`
    );
    assert.ok(
      !bundle.includes(`SRC_DIR, '${engine}.js'`),
      `tools/bundle.js still reads src/${engine}.js`
    );
  }
});

test('TypeScript-only export footers are stripped before bundling', () => {
  const bundle = read('tools/bundle.js');
  assert.ok(bundle.includes('TS_MODULE_SURFACE'), 'missing export-footer marker');
  assert.ok(bundle.includes('stripTypeScriptModuleSurface'), 'missing footer stripper');

  const built = read('dist/code-lab.js');
  assert.ok(!built.includes('TypeScript module surface'), 'footer leaked into the browser bundle');
  assert.ok(!/^export\s/m.test(built), 'ES export syntax leaked into the browser bundle');
});

test('the shipping workbench contains the current hardening work', () => {
  const source = read('src/workbench.ts');
  for (const marker of [
    'CODELAB_VERSION',
    'sanitizeUrl',
    'PreviewCsp',
    'createLogger',
    '_reportPersistenceFailure',
    'previewOrigin'
  ]) {
    assert.ok(source.includes(marker), `src/workbench.ts is missing ${marker}`);
  }
});

test('preview policy lives in exactly one module, shared with the service worker', () => {
  assert.ok(exists('src/csp.ts'), 'src/csp.ts must exist');

  const workbench = read('src/workbench.ts');
  assert.ok(workbench.includes('PreviewCsp.buildPreviewPolicy'), 'workbench must build the policy from src/csp.ts');
  assert.ok(
    !/default-src 'self' data: blob:/.test(workbench),
    'workbench must not inline its own preview policy'
  );

  const worker = read('src/preview-sw.js');
  assert.ok(worker.includes('CodeLabCsp'), 'preview-sw.js must use the shared CSP module');
  assert.ok(
    !/const PREVIEW_CSP = \[/.test(worker),
    'preview-sw.js must not inline its own preview policy'
  );

  const built = read('dist/preview-sw.js');
  assert.ok(built.includes('var CodeLabCsp'), 'dist/preview-sw.js must embed the shared CSP module');
  assert.ok(
    built.indexOf('var CodeLabCsp') < built.indexOf('codelab:config'),
    'the CSP module must be bundled before the worker body'
  );
});

test('the shared CSP module is compiled under strict TypeScript', () => {
  const strictConfig = JSON.parse(read('tsconfig.strict.json'));
  assert.equal(strictConfig.compilerOptions.strict, true, 'tsconfig.strict.json must enable strict');
  assert.ok(
    strictConfig.include.includes('src/csp.ts'),
    'src/csp.ts must be typechecked under strict mode'
  );

  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts['typecheck:strict'], 'package.json must expose typecheck:strict');
});

test('the engines keep their public implementation markers', () => {
  const runtime = read('src/runtime.ts');
  for (const marker of ['__initVirtualRuntime', 'executeInVirtualRuntime', 'transpileForBrowser']) {
    assert.ok(runtime.includes(marker), `runtime.ts is missing ${marker}`);
  }
  const shell = read('src/shell.ts');
  for (const marker of ['cloneGitHubRepository', "phase: 'error'"]) {
    assert.ok(shell.includes(marker), `shell.ts is missing ${marker}`);
  }
  const terminal = read('src/terminal.ts');
  for (const marker of ['PTYTerminalEngine', 'createTerminal', 'parseAnsiToHtml']) {
    assert.ok(terminal.includes(marker), `terminal.ts is missing ${marker}`);
  }
});

test('tests import the consolidated TypeScript sources', () => {
  const walk = (dir) => {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walk(full));
      else if (/\.(js|ts)$/.test(entry.name)) files.push(full);
    }
    return files;
  };

  for (const file of walk(path.join(ROOT, 'tests'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const engine of ENGINES) {
      const stale = new RegExp(`src[/\\\\]${engine}\\.js`);
      assert.ok(
        !stale.test(source),
        `${path.relative(ROOT, file)} still imports src/${engine}.js`
      );
    }
  }
});

test('the service worker stays a plain JavaScript file', () => {
  assert.ok(exists('src/preview-sw.js'), 'preview-sw.js must remain plain JS');
  assert.ok(!exists('src/preview-sw.ts'), 'preview-sw must not be converted to TS');
});

test('tsconfig type-checks every TypeScript source', () => {
  const tsconfig = JSON.parse(read('tsconfig.json'));
  assert.ok(tsconfig.include.includes('src/**/*.ts'));
  assert.equal(tsconfig.compilerOptions.allowJs, true);
});

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log(`P0-6 TypeScript Consolidation Suite Complete: ${passed} passed, ${failures.length} failed`);
console.log('════════════════════════════════════════════════════════════════════════════\n');

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n[${failure.name}]`);
    console.error(failure.err.stack || failure.err.message);
  }
  process.exit(1);
}
