'use strict';

/**
 * Test module loader.
 *
 * Suites must exercise *the artifact we ship*, so every suite loads the built
 * bundles from `dist/` instead of `require()`-ing raw TypeScript from `src/`.
 *
 * Why a single umbrella bundle instead of `dist/runtime.js` + `dist/shell.js`:
 * each per-module bundle carries its own copy of the runtime internals, so a
 * VFS created by one bundle is not an instance of the class the other bundle
 * checks for. Loading `dist/code-lab.js` once gives every suite the same
 * instance graph, which is also what a real `<script>` consumer gets.
 *
 * Raw `.ts` also only loads under Bun's loader or Node's type-stripping
 * (22.18+), which silently excludes Node 20 and hides bugs like implicit
 * globals (`typeof CodeLabShell === 'undefined'`).
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const BUNDLE = path.join(DIST, 'code-lab.js');

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(?:ts|js|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function newestSource() {
  let newest = null;
  for (const file of walk(SRC)) {
    const st = fs.statSync(file);
    if (!newest || st.mtimeMs > newest.mtimeMs) newest = { file, mtimeMs: st.mtimeMs };
  }
  return newest;
}

/**
 * Fail loudly when `dist/` is missing or older than `src/`, so a suite can
 * never silently assert against last week's bundle.
 */
function assertFresh() {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(
      `Built bundle is missing: ${path.relative(ROOT, BUNDLE)}\n` +
      'Run `bun run build` before running the test suite.'
    );
  }
  const bundleMtime = fs.statSync(BUNDLE).mtimeMs;
  const source = newestSource();
  if (source && source.mtimeMs > bundleMtime) {
    throw new Error(
      'dist/ is stale: ' + path.relative(ROOT, source.file) + ' is newer than ' +
      path.relative(ROOT, BUNDLE) + '.\n' +
      'Run `bun run build` before running the test suite.'
    );
  }
}

let umbrella = null;

function loadCodeLab() {
  assertFresh();
  if (!umbrella) umbrella = require(BUNDLE);
  return umbrella;
}

function requireModule(name) {
  const api = loadCodeLab()[name];
  if (!api || (typeof api !== 'object' && typeof api !== 'function')) {
    throw new Error(`dist/code-lab.js did not expose ${name}; the bundle footer is out of sync with src/index.ts`);
  }
  return api;
}

module.exports = {
  ROOT,
  DIST,
  assertFresh,
  loadCodeLab,
  /** Complete virtual runtime API (`CodeLabRuntime`). */
  get runtime() { return requireModule('CodeLabRuntime'); },
  /** Complete POSIX shell API, including `COREUTILS` and `PosixPath`. */
  get shell() { return requireModule('CodeLabShell'); },
  /** Complete PTY terminal API. */
  get terminal() { return requireModule('CodeLabTerminal'); },
  /** Workbench SDK (has `CodeLabWorkbench`, `renderSimpleMarkdown`, `mount`, ...). */
  get workbench() { return loadCodeLab(); },
  /** Shared Web Preview CSP builder (`src/csp.ts`). */
  get csp() { return requireModule('CodeLabCsp'); },
  /** Zod-backed schema bundle (`dist/schemas.js`). */
  get schemas() {
    assertFresh();
    return require(path.join(DIST, 'schemas.js'));
  }
};
