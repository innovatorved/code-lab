'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Package Installer Integrity — Regression Suite
 *
 * Deterministic and fully offline (a canned CDN). Each check pins a real defect
 * that shipped in 0.1.x and was found while auditing the published artifact:
 *
 *   A. Transitive dependency *ranges* are honoured (not resolved as "latest"),
 *      so a deep tree (chalk → ansi-styles → color-convert) installs completely.
 *   B. A `main` that points at a directory resolves to `<dir>/index.js`.
 *   C. Directory `exports` targets (`"./lib/": "./libcjs/"`) are never fetched
 *      as files (this used to raise EISDIR / write an HTML listing as a module).
 *   D. A 200 + text/html directory-listing response is rejected for module URLs.
 *   E. Every declared `exports` subpath is seeded (no 25-entry cap).
 *   F. Array-form `exports` (`[{ default }, "./x.js"]`) resolves its target.
 *   G. Minified side-effect imports (`import"pkg"`) are transformed for CJS.
 *   H. Transient CDN failures are retried instead of silently truncating install.
 *   I. Node builtins required by popular packages are present (`tty`, `zlib`).
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const runtime = require('../src/runtime.js');
const shellModule = require('../src/shell.js');
const { createVirtualFs, executeInVirtualRuntime } = runtime;

// ── Canned CDN ───────────────────────────────────────────────────────────────
// Package -> published versions. Ranges are matched with a tiny semver subset
// (exact, `^x.y.z`, `~x.y.z`, `x`, `*`) which is all the fixtures need.
const VERSIONS = {
  root: ['1.0.0'],
  mid: ['1.0.0'],
  leaf: ['2.0.0', '3.0.0'],
  dirpkg: ['1.0.0'],
  htmlpkg: ['1.0.0'],
  manyex: ['1.0.0'],
  arrayex: ['1.0.0'],
  esmmin: ['1.0.0'],
  dep: ['1.0.0'],
  flakypkg: ['1.0.0']
};

const FILES = {
  'root@1.0.0/package.json': JSON.stringify({ name: 'root', version: '1.0.0', main: 'index.js', dependencies: { mid: '^1.0.0' } }),
  'root@1.0.0/index.js': 'const lib = require("./lib");\nconst mid = require("mid");\nmodule.exports = { lib, mid };\n',
  'root@1.0.0/lib/index.js': 'module.exports = "root-lib";\n',

  'mid@1.0.0/package.json': JSON.stringify({ name: 'mid', version: '1.0.0', main: 'lib', dependencies: { leaf: '^2.0.0' } }),
  'mid@1.0.0/lib/index.js': 'module.exports = require("leaf");\n',

  'leaf@2.0.0/package.json': JSON.stringify({ name: 'leaf', version: '2.0.0', main: 'index.js' }),
  'leaf@2.0.0/index.js': 'module.exports = "leaf-v2";\n',
  'leaf@3.0.0/package.json': JSON.stringify({ name: 'leaf', version: '3.0.0', main: 'index.js' }),
  'leaf@3.0.0/index.js': 'module.exports = "leaf-v3";\n',

  'dirpkg@1.0.0/package.json': JSON.stringify({
    name: 'dirpkg', version: '1.0.0', main: './libcjs/index.js',
    exports: { '.': { require: { default: './libcjs/index.js' } }, './lib/': { require: { default: './libcjs/' } } }
  }),
  'dirpkg@1.0.0/libcjs/index.js': 'module.exports = "dirpkg";\n',

  'htmlpkg@1.0.0/package.json': JSON.stringify({ name: 'htmlpkg', version: '1.0.0', main: 'index.js' }),
  'htmlpkg@1.0.0/index.js': 'try { require("./helper"); } catch (e) {}\nmodule.exports = "htmlpkg";\n',

  'manyex@1.0.0/package.json': JSON.stringify(Object.assign(
    { name: 'manyex', version: '1.0.0', main: 'index.js' },
    { exports: Object.assign({ '.': './index.js' }, Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`./s${i + 1}.js`, `./s${i + 1}.js`]))) }
  )),
  'manyex@1.0.0/index.js': 'module.exports = "manyex";\n',

  'arrayex@1.0.0/package.json': JSON.stringify({
    name: 'arrayex', version: '1.0.0', main: 'index.js',
    exports: { '.': './index.js', './shams': [{ types: './shams.d.ts', default: './shams.js' }, './shams.js'] }
  }),
  'arrayex@1.0.0/index.js': 'module.exports = "arrayex";\n',
  'arrayex@1.0.0/shams.js': 'module.exports = "shams";\n',

  'esmmin@1.0.0/package.json': JSON.stringify({ name: 'esmmin', version: '1.0.0', main: 'index.js', type: 'module', dependencies: { dep: '^1.0.0' } }),
  'esmmin@1.0.0/index.js': 'import"dep";export const value=41;\n',

  'dep@1.0.0/package.json': JSON.stringify({ name: 'dep', version: '1.0.0', main: 'index.js' }),
  'dep@1.0.0/index.js': 'module.exports = { sideEffect: true };\n',

  'flakypkg@1.0.0/package.json': JSON.stringify({ name: 'flakypkg', version: '1.0.0', main: 'index.js' }),
  'flakypkg@1.0.0/index.js': 'module.exports = "flaky";\n'
};

// 30th subpath file (manyex) — proves the exports cap is gone.
for (let i = 1; i <= 30; i++) FILES[`manyex@1.0.0/s${i}.js`] = `module.exports = "s${i}";\n`;

function parseVersion(v) {
  return v.split('.').map(Number);
}
function satisfies(version, range) {
  if (!range || range === '*' || range === '' || range === 'latest') return true;
  const [vMaj, vMin, vPat] = parseVersion(version);
  const m = String(range).trim();
  if (m.startsWith('^')) {
    const [mMaj, mMin, mPat] = parseVersion(m.slice(1));
    if (vMaj !== mMaj) return false;
    if (vMin !== mMin) return vMin > mMin;
    return vPat >= mPat;
  }
  if (m.startsWith('~')) {
    const [mMaj, mMin, mPat] = parseVersion(m.slice(1));
    return vMaj === mMaj && vMin === mMin && vPat >= mPat;
  }
  if (/^\d+$/.test(m)) return vMaj === Number(m);
  return version === m;
}
function resolveVersion(name, range) {
  const list = VERSIONS[name];
  if (!list) return null;
  const best = list.filter((v) => satisfies(v, range)).sort((a, b) => {
    const A = parseVersion(a), B = parseVersion(b);
    return B[0] - A[0] || B[1] - A[1] || B[2] - A[2];
  })[0];
  return best || null;
}

function makeCannedFetch(state) {
  return async function cannedFetch(url) {
    const prefix = 'https://cdn.jsdelivr.net/npm/';
    if (!url.startsWith(prefix)) return { ok: false, status: 404, headers: { get: () => '' }, text: async () => '' };
    let rest = url.slice(prefix.length);
    rest = rest.split('?')[0];

    // Flaky package: fail the manifest twice to exercise retry.
    if (rest === 'flakypkg@1.0.0/package.json' || rest === 'flakypkg/package.json') {
      state.flakyHits = (state.flakyHits || 0) + 1;
      if (state.flakyHits <= 2) {
        return { ok: false, status: 503, headers: { get: () => 'text/plain' }, text: async () => 'Service Unavailable' };
      }
    }

    // Split "<name>@<range|version>/<file>" or "<name>/<file>".
    let name, ref, file;
    const at = rest.indexOf('@');
    if (at !== -1) {
      name = rest.slice(0, at);
      const slash = rest.indexOf('/', at);
      ref = slash === -1 ? rest.slice(at + 1) : rest.slice(at + 1, slash);
      file = slash === -1 ? '' : rest.slice(slash + 1);
    } else {
      const slash = rest.indexOf('/');
      name = slash === -1 ? rest : rest.slice(0, slash);
      ref = null;
      file = slash === -1 ? '' : rest.slice(slash + 1);
    }
    // Scoped packages (@scope/name) are not exercised by this suite.
    if (!name || name.startsWith('@')) return { ok: false, status: 404, headers: { get: () => '' }, text: async () => '' };

    const isExactVersion = ref && /^\d+\.\d+\.\d+/.test(ref);
    const version = isExactVersion ? ref : resolveVersion(name, ref);
    if (!version) return { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => 'not found' };

    // jsDelivr answers a directory path with a 200 HTML listing.
    if (file === '' || file.endsWith('/')) {
      const dirKey = `${name}@${version}/${file.replace(/\/$/, '')}`;
      const hasChild = Object.keys(FILES).some((k) => k.startsWith(dirKey + '/'));
      if (file.endsWith('/') || !hasChild) {
        if (file.endsWith('/')) {
          return {
            ok: true, status: 200,
            headers: { get: () => 'text/html; charset=utf-8' },
            text: async () => '<!doctype html><html><head><title>Directory listing</title></head><body>files</body></html>'
          };
        }
      }
    }

    const key = `${name}@${version}/${file}`;
    if (Object.prototype.hasOwnProperty.call(FILES, key)) {
      return {
        ok: true, status: 200,
        headers: { get: () => (file.endsWith('.json') ? 'application/json' : 'application/javascript') },
        text: async () => FILES[key]
      };
    }
    // `/pkg/package.json` (range-less) resolves the manifest of the best version.
    return { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => 'not found' };
  };
}

// ── Harness ──────────────────────────────────────────────────────────────────
function makeShell(fetchImpl) {
  const vfs = createVirtualFs();
  const shell = shellModule.createPosixShell({
    vfs,
    fetchImpl,
    env: { PATH: '/bin:/usr/bin:/workspace/node_modules/.bin', HOME: '/workspace', PWD: '/workspace', SHELL: '/bin/sh' }
  });
  return { vfs, shell };
}
function nmList(vfs) {
  try { return vfs.readdirSync('/workspace/node_modules'); } catch { return []; }
}
function readJSON(vfs, p) {
  try { return JSON.parse(vfs.readFileSync(p, 'utf8')); } catch { return null; }
}
function walk(vfs, dir, out) {
  let e = [];
  try { e = vfs.readdirSync(dir); } catch { return out; }
  for (const n of e) {
    const f = dir === '/' ? '/' + n : dir + '/' + n;
    let isDir = false;
    try { isDir = vfs.statSync(f).isDirectory(); } catch {}
    if (isDir) walk(vfs, f, out);
    else { try { out[f] = vfs.readFileSync(f, 'utf8'); } catch {} }
  }
  return out;
}

async function runSuite() {
  let passed = 0, failed = 0;
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
  console.log('   Package Installer Integrity (offline / canned CDN)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- A. transitive ranges, directory mains & directory exports ---');

  await test('A1 transitive ranges are honoured (leaf stays on ^2, not latest 3)', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    const r = await shell.execute('npm install root');
    assert.equal(r.exitCode, 0, `install failed: ${r.stderr}`);
    const nm = nmList(vfs);
    assert.ok(nm.includes('root') && nm.includes('mid') && nm.includes('leaf'), 'expected root+mid+leaf, got: ' + nm.join(','));
    const leaf = readJSON(vfs, '/workspace/node_modules/leaf/package.json');
    assert.equal(leaf.version, '2.0.0', `leaf should resolve to ^2.0.0 (2.0.0), got ${leaf.version}`);
  });

  await test('A2 a directory `main` resolves to <dir>/index.js (mid: main="lib")', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install mid');
    assert.ok(vfs.existsSync('/workspace/node_modules/mid/lib/index.js'), 'mid/lib/index.js should be installed');
  });

  await test('A3 a relative directory require (`./lib`) fetches lib/index.js', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install root');
    assert.ok(vfs.existsSync('/workspace/node_modules/root/lib/index.js'), 'root/lib/index.js should be installed');
  });

  await test('A4 directory `exports` target (`"./lib/": "./libcjs/"`) never errors / never writes an HTML file', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    const r = await shell.execute('npm install dirpkg');
    assert.equal(r.exitCode, 0, `install must not crash: ${r.stderr}`);
    assert.ok(vfs.existsSync('/workspace/node_modules/dirpkg/libcjs/index.js'), 'dirpkg/libcjs/index.js should be installed');
    assert.ok(!vfs.existsSync('/workspace/node_modules/dirpkg/libcjs') || vfs.statSync('/workspace/node_modules/dirpkg/libcjs').isDirectory(),
      'a stray file must not replace the libcjs directory');
  });

  console.log('\n--- B. response hygiene & exports coverage ---');

  await test('B1 a 200 + text/html directory listing is rejected for a module URL', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install htmlpkg');
    const files = walk(vfs, '/workspace/node_modules/htmlpkg', {});
    assert.ok(!Object.prototype.hasOwnProperty.call(files, '/workspace/node_modules/htmlpkg/helper'),
      'the HTML directory listing must not be written as a module named "helper"');
    for (const [p, body] of Object.entries(files)) {
      assert.ok(!/<!doctype html|<html/i.test(body), `${p} should not contain an HTML listing`);
    }
  });

  await test('B2 every declared exports subpath is seeded (30th entry survives)', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install manyex');
    assert.ok(vfs.existsSync('/workspace/node_modules/manyex/s1.js'), 'manyex/s1.js should be installed');
    assert.ok(vfs.existsSync('/workspace/node_modules/manyex/s30.js'), 'manyex/s30.js should be installed (cap removed)');
  });

  await test('B3 array-form exports (`[{ default }, "./x.js"]`) resolve', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install arrayex');
    assert.ok(vfs.existsSync('/workspace/node_modules/arrayex/shams.js'), 'arrayex/shams.js should be installed');
  });

  await test('B4 transient CDN failures are retried (503 twice, then success)', async () => {
    const state = {};
    const { vfs, shell } = makeShell(makeCannedFetch(state));
    const r = await shell.execute('npm install flakypkg');
    assert.equal(r.exitCode, 0, `install should succeed after retries: ${r.stderr}`);
    assert.ok(vfs.existsSync('/workspace/node_modules/flakypkg/index.js'), 'flakypkg/index.js should be installed');
    assert.ok(state.flakyHits >= 3, 'the flaky manifest should have been retried');
  });

  console.log('\n--- C. runtime module semantics ---');

  await test('C1 minified side-effect import (`import"pkg"`) is transformed and executes', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install esmmin');
    const files = walk(vfs, '/', {});
    files['/workspace/main.js'] = 'const m = require("esmmin"); console.log("RESULT:" + m.value);';
    const r = await executeInVirtualRuntime({ files, entry: '/workspace/main.js', mode: 'run', timeoutMs: 20000 });
    assert.equal(r.exitCode, 0, `execution failed: ${r.stderr}`);
    assert.match(r.stdout, /RESULT:41/, `expected the ESM export to be visible, got: ${r.stdout}`);
  });

  await test('C2 installed packages are requireable end to end (root → mid → leaf)', async () => {
    const { vfs, shell } = makeShell(makeCannedFetch({}));
    await shell.execute('npm install root');
    const files = walk(vfs, '/', {});
    files['/workspace/main.js'] = 'const r = require("root"); console.log("RESULT:" + r.mid + ":" + r.lib);';
    const r = await executeInVirtualRuntime({ files, entry: '/workspace/main.js', mode: 'run', timeoutMs: 20000 });
    assert.equal(r.exitCode, 0, `execution failed: ${r.stderr}`);
    assert.match(r.stdout, /RESULT:leaf-v2:root-lib/, `got: ${r.stdout}`);
  });

  await test('C3 Node builtins needed by popular packages exist (tty, zlib.constants)', async () => {
    const { vfs } = makeShell(makeCannedFetch({}));
    const files = {
      '/workspace/main.js': 'const z = require("zlib"); const t = require("tty"); const vt = require("node:tty"); console.log("RESULT:" + z.constants.Z_SYNC_FLUSH + ":" + t.isatty(1) + ":" + (typeof vt.WriteStream));'
    };
    const r = await executeInVirtualRuntime({ files, entry: '/workspace/main.js', mode: 'run', timeoutMs: 20000 });
    assert.equal(r.exitCode, 0, `execution failed: ${r.stderr}`);
    assert.match(r.stdout, /RESULT:2:false:function/, `got: ${r.stdout}`);
  });

  await test('C4 `module.createRequire` and `isBuiltin` are available', async () => {
    const files = {
      '/workspace/main.js': 'const m = require("module"); const req = m.createRequire("/workspace/x.js"); const path = req("path"); console.log("RESULT:" + (typeof path.join) + ":" + m.isBuiltin("fs") + ":" + m.isBuiltin("nope"));'
    };
    const r = await executeInVirtualRuntime({ files, entry: '/workspace/main.js', mode: 'run', timeoutMs: 20000 });
    assert.equal(r.exitCode, 0, `execution failed: ${r.stderr}`);
    assert.match(r.stdout, /RESULT:function:true:false/, `got: ${r.stdout}`);
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`Package Installer Integrity Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) console.log(`- ${f.name}: ${f.err && f.err.message ? f.err.message : f.err}`);
  }
  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => { console.error('Fatal test error:', err); process.exit(1); });
