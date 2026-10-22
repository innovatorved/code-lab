'use strict';

/**
 * Helper to dynamically load new Browser IDE modules.
 * Loads from dist/ if already bundled, or compiles from src/ using runtime.transpileTS,
 * ensuring complete compatibility across Node 20+, Bun, and test harness invariants.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadCodeLab, runtime } = require('./load.js');

function loadTsModule(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const tsCode = fs.readFileSync(fullPath, 'utf8');
  const jsCode = runtime.transpileTS(tsCode);
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', jsCode);
  fn(require, mod, mod.exports);
  return mod.exports;
}

let cachedZip = null;
function getZipEngine() {
  if (cachedZip) return cachedZip;
  const umbrella = loadCodeLab();
  if (umbrella.zip || umbrella.createZip) {
    cachedZip = umbrella.zip || umbrella;
    return cachedZip;
  }
  const fromSrc = loadTsModule('src/zip.ts');
  if (fromSrc) {
    cachedZip = fromSrc;
    return cachedZip;
  }
  return null;
}

let cachedStorage = null;
function getStorageEngine() {
  if (cachedStorage) return cachedStorage;
  const umbrella = loadCodeLab();
  if (umbrella.storage || umbrella.WorkspaceStorage) {
    cachedStorage = umbrella.storage || umbrella;
    return cachedStorage;
  }
  const fromSrc = loadTsModule('src/storage.ts');
  if (fromSrc) {
    cachedStorage = fromSrc;
    return cachedStorage;
  }
  return null;
}

let cachedSearch = null;
function getSearchEngine() {
  if (cachedSearch) return cachedSearch;
  const umbrella = loadCodeLab();
  if (umbrella.search || umbrella.searchInFiles) {
    cachedSearch = umbrella.search || umbrella;
    return cachedSearch;
  }
  const fromSrc = loadTsModule('src/search.ts');
  if (fromSrc) {
    cachedSearch = fromSrc;
    return cachedSearch;
  }
  return null;
}

let cachedDiagnostics = null;
function getDiagnosticsStore() {
  if (cachedDiagnostics) return cachedDiagnostics;
  const umbrella = loadCodeLab();
  if (umbrella.diagnostics || umbrella.DiagnosticsStore || umbrella.createDiagnosticsStore) {
    cachedDiagnostics = umbrella.diagnostics || umbrella;
    return cachedDiagnostics;
  }
  const fromSrc = loadTsModule('src/diagnostics.ts');
  if (fromSrc) {
    cachedDiagnostics = fromSrc;
    return cachedDiagnostics;
  }
  return null;
}

let cachedScm = null;
function getScmEngine() {
  if (cachedScm) return cachedScm;
  const umbrella = loadCodeLab();
  if (umbrella.scm || umbrella.computeGitStatus) {
    cachedScm = umbrella.scm || umbrella;
    return cachedScm;
  }
  const fromSrc = loadTsModule('src/scm.ts');
  if (fromSrc) {
    cachedScm = fromSrc;
    return cachedScm;
  }
  return null;
}

module.exports = {
  loadTsModule,
  getZipEngine,
  getStorageEngine,
  getSearchEngine,
  getDiagnosticsStore,
  getScmEngine
};
