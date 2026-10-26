/**
 * Build script for @innovatorved/code-lab
 *
 * Concatenates modular source files in src/ into:
 *   1. dist/code-lab.js       (standalone UMD/IIFE bundle)
 *   2. dist/code-lab.esm.js   (standalone ESM bundle)
 *   3. dist/runtime.js        (headless runtime IIFE bundle)
 *   4. dist/runtime.esm.js    (headless runtime ESM bundle)
 *   5. dist/shell.js          (POSIX shell IIFE bundle)
 *   6. dist/shell.esm.js      (POSIX shell ESM bundle)
 *   7. dist/terminal.js       (PTY terminal IIFE bundle)
 *   8. dist/terminal.esm.js   (PTY terminal ESM bundle)
 *   9. dist/code-lab.css      (standalone stylesheet)
 *  10. dist/code-lab.d.ts     (TypeScript definitions)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PKG_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PKG_DIR, 'src');
const DIST_DIR = path.join(PKG_DIR, 'dist');

const PKG = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
const PKG_VERSION = PKG.version;
if (!PKG_VERSION || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(PKG_VERSION)) {
  throw new Error(`package.json has an invalid version: ${JSON.stringify(PKG_VERSION)}`);
}

const TS_MODULE_SURFACE = '// ── TypeScript module surface';

// Resolve project binaries from node_modules so the build is hermetic: no
// network, no dependency on whatever `npx` happens to download today.
function localBin(name) {
  const file = path.join(PKG_DIR, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  return fs.existsSync(file) ? file : name;
}

// The .ts sources end with a TypeScript-only export footer so `tsc` can emit
// declarations. Browser bundles are classic scripts, so strip that footer
// before concatenation.
function stripTypeScriptModuleSurface(code) {
  const marker = code.indexOf(TS_MODULE_SURFACE);
  return marker === -1 ? code : code.slice(0, marker);
}

const runtimeCode = stripTypeScriptModuleSurface(fs.readFileSync(path.join(SRC_DIR, 'runtime.ts'), 'utf8'));
const shellCode = stripTypeScriptModuleSurface(fs.readFileSync(path.join(SRC_DIR, 'shell.ts'), 'utf8'));
const terminalCode = stripTypeScriptModuleSurface(fs.readFileSync(path.join(SRC_DIR, 'terminal.ts'), 'utf8'));
let workbenchCode = stripTypeScriptModuleSurface(fs.readFileSync(path.join(SRC_DIR, 'workbench.ts'), 'utf8'));
const cssPath = path.join(SRC_DIR, 'code-lab.css');

// Single source of truth for the shipped SDK version. Fail the build if the
// injection point disappears rather than silently shipping a stale version.
const VERSION_SENTINEL = /const CODELAB_VERSION = '[^']*';/;
if (!VERSION_SENTINEL.test(workbenchCode)) {
  throw new Error('src/workbench.ts must declare `const CODELAB_VERSION = ...` for the build to inject package.json.version');
}
workbenchCode = workbenchCode.replace(VERSION_SENTINEL, `const CODELAB_VERSION = '${PKG_VERSION}';`);

// Shared preview-CSP module. Written as real, strict TypeScript and bundled to a
// classic script (`var CodeLabCsp`) that is embedded in BOTH the workbench
// bundle and the preview service worker — one policy implementation, no
// "keep this string in sync" comment.
let cspCode;
try {
  cspCode = execFileSync(
    localBin('esbuild'),
    ['src/csp.ts', '--bundle', '--format=iife', '--global-name=CodeLabCsp'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/csp.ts: ${err.message}`);
}

let loggerCode;
try {
  loggerCode = execFileSync(
    localBin('esbuild'),
    ['src/logger.ts', '--bundle', '--format=iife', '--global-name=CodeLabLogger'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/logger.ts: ${err.message}`);
}

let htmlCode;
try {
  htmlCode = execFileSync(
    localBin('esbuild'),
    ['src/html.ts', '--bundle', '--format=iife', '--global-name=CodeLabHtml'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/html.ts: ${err.message}`);
}

let zipCode;
try {
  zipCode = execFileSync(
    localBin('esbuild'),
    ['src/zip.ts', '--bundle', '--format=iife', '--global-name=CodeLabZip'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/zip.ts: ${err.message}`);
}

let storageCode;
try {
  storageCode = execFileSync(
    localBin('esbuild'),
    ['src/storage.ts', '--bundle', '--format=iife', '--global-name=CodeLabStorage'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/storage.ts: ${err.message}`);
}

let searchCode;
try {
  searchCode = execFileSync(
    localBin('esbuild'),
    ['src/search.ts', '--bundle', '--format=iife', '--global-name=CodeLabSearch'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/search.ts: ${err.message}`);
}

let diagnosticsCode;
try {
  diagnosticsCode = execFileSync(
    localBin('esbuild'),
    ['src/diagnostics.ts', '--bundle', '--format=iife', '--global-name=CodeLabDiagnostics'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/diagnostics.ts: ${err.message}`);
}

let scmCode;
try {
  scmCode = execFileSync(
    localBin('esbuild'),
    ['src/scm.ts', '--bundle', '--format=iife', '--global-name=CodeLabScm'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/scm.ts: ${err.message}`);
}

let workbenchComponentsCode;
try {
  workbenchComponentsCode = execFileSync(
    localBin('esbuild'),
    ['src/workbench/index.ts', '--bundle', '--format=iife', '--global-name=CodeLabWorkbenchComponents'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle src/workbench/index.ts: ${err.message}`);
}

let guidedLabExtCode;
let javascriptExtCode;
let typescriptExtCode;
let cppExtCode;
let pythonExtCode;
try {
  guidedLabExtCode = execFileSync(
    localBin('esbuild'),
    ['src/extensions/guided-lab.ts', '--bundle', '--format=iife', '--global-name=CodeLabGuidedLab'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
  javascriptExtCode = execFileSync(
    localBin('esbuild'),
    ['src/extensions/javascript.ts', '--bundle', '--format=iife', '--global-name=CodeLabJavaScript'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
  typescriptExtCode = execFileSync(
    localBin('esbuild'),
    ['src/extensions/typescript.ts', '--bundle', '--format=iife', '--global-name=CodeLabTypeScript'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
  cppExtCode = execFileSync(
    localBin('esbuild'),
    ['src/extensions/cpp.ts', '--bundle', '--format=iife', '--global-name=CodeLabCpp'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
  pythonExtCode = execFileSync(
    localBin('esbuild'),
    ['src/extensions/python.ts', '--bundle', '--format=iife', '--global-name=CodeLabPython'],
    { cwd: PKG_DIR, encoding: 'utf8' }
  );
} catch (err) {
  throw new Error(`Failed to bundle extensions for umbrella bundle: ${err.message}`);
}

const BANNER = `/**
 * ============================================================
 * @innovatorved/code-lab v${PKG_VERSION} — Standalone Browser Code IDE & Virtual Runtime
 * ============================================================
 * Features:
 *   - Sandboxed Web Worker Execution Engine with Multi-Instance Isolation & Watchdog Timer
 *   - First-Class Node.js and Bun Runtimes (Bun.serve, bun:test, bun:sqlite, Bun.*)
 *   - Full POSIX Shell AST & 71 UNIX Coreutils (pipes, redirects, globs, env vars, git & git clone)
 *   - Interactive PTY Terminal Emulator with inline prompt, Tab completion & ANSI colors
 *   - Persistent HTTP/TCP Servers, CLI curl & Live Port/HTTP Preview
 *   - Modular VS Code Workbench: File Tree, Tabs, Command Palette, Diff Viewer
 *   - Modular Opt-In Guided Lab Extension (stepper, hints, solution diff, JS/TS switcher)
 *   - Zero-Auth Public GitHub Repository Cloning (git clone, workbench.cloneRepo, <code-lab repo="...">)
 *   - Third-Party Imperative SDK (getFiles, setFiles, getFile, setFile, cloneRepo, on, off, use, exportWorkspace)
 * ============================================================
 */
`;

const IIFE_BUNDLE = `${BANNER}(function (root) {
  'use strict';

  // --- Module 0: Preview CSP, Structured Logger, Safe HTML & Leaf Engines ---
${cspCode}
${loggerCode}
${htmlCode}
${zipCode}
${storageCode}
${searchCode}
${diagnosticsCode}
${scmCode}
${workbenchComponentsCode}
  root.CodeLabZip = CodeLabZip;
  root.CodeLabStorage = CodeLabStorage;
  root.CodeLabSearch = CodeLabSearch;
  root.CodeLabDiagnostics = CodeLabDiagnostics;
  root.CodeLabScm = CodeLabScm;
  root.CodeLabWorkbenchComponents = CodeLabWorkbenchComponents;

  // --- Module 1: Runtime Engine ---
  (function () {
${runtimeCode}
  })();

  const CodeLabRuntime = root.CodeLabRuntime;

  // --- Module 2: POSIX Shell & Coreutils ---
  (function () {
${shellCode}
  })();

  const CodeLabShell = root.CodeLabShell;

  // --- Module 3: PTY Terminal Engine ---
  (function () {
${terminalCode}
  })();

  const CodeLabTerminal = root.CodeLabTerminal;

  // --- Module 4: IDE Workbench & Web Component ---
  (function () {
${workbenchCode}
  })();

  // --- Module 5: Modular Language & Guided Lab Extensions ---
${guidedLabExtCode}
${javascriptExtCode}
${typescriptExtCode}
${cppExtCode}
${pythonExtCode}

  const CodeLab = root.CodeLab;
  const CodeLabWorkbench = root.CodeLabWorkbench;
  const CodeLabElement = root.CodeLabElement;
  if (CodeLab && CodeLab.extensions) {
    CodeLab.extensions.guidedLab = CodeLabGuidedLab.guidedLabExtension;
    CodeLab.extensions.javascript = CodeLabJavaScript.javascriptExtension;
    CodeLab.extensions.typescript = CodeLabTypeScript.typescriptExtension;
    CodeLab.extensions.cpp = CodeLabCpp.cppExtension;
    CodeLab.extensions.python = CodeLabPython.pythonExtension;
  }

  // Support CommonJS / Node.js / Bundlers
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Object.assign({}, CodeLab, {
      CodeLab: CodeLab,
      CodeLabWorkbench: CodeLabWorkbench,
      CodeLabElement: CodeLabElement,
      CodeLabRuntime: CodeLabRuntime,
      CodeLabShell: CodeLabShell,
      CodeLabTerminal: CodeLabTerminal,
      createPosixShell: CodeLabShell ? CodeLabShell.createPosixShell : null,
      cloneGitHubRepository: CodeLabShell ? CodeLabShell.cloneGitHubRepository : null,
      parseGitHubRepoUrl: CodeLabShell ? CodeLabShell.parseGitHubRepoUrl : null,
      createTerminal: CodeLabTerminal ? CodeLabTerminal.createTerminal : null,
      createPTYTerminalEngine: CodeLabTerminal ? CodeLabTerminal.createPTYTerminalEngine : null,
      PTYTerminalEngine: CodeLabTerminal ? CodeLabTerminal.PTYTerminalEngine : null,
      executeInVirtualRuntime: CodeLabRuntime.executeInVirtualRuntime,
      executeInWorker: CodeLabRuntime.executeInWorker,
      cancelWorkerExecution: CodeLabRuntime.cancelWorkerExecution,
      preloadNpmPackages: CodeLabRuntime.preloadNpmPackages,
      transpileTS: CodeLabRuntime.transpileTS,
      transpileForBrowser: CodeLabRuntime.transpileForBrowser,
      createVirtualFs: CodeLabRuntime.createVirtualFs,
      createVirtualHttp: CodeLabRuntime.createVirtualHttp,
      createVirtualNet: CodeLabRuntime.createVirtualNet,
      createVirtualPortTable: CodeLabRuntime.createVirtualPortTable,
      createVirtualWasi: CodeLabRuntime.createVirtualWasi,
      executeWasiModule: CodeLabRuntime.executeWasiModule,
      WasiExitSignal: CodeLabRuntime.WasiExitSignal,
      createSqliteDatabase: CodeLabRuntime.createSqliteDatabase,
      createWorkerRuntimeSource: CodeLabRuntime.createWorkerRuntimeSource,
      CodeLabCsp: CodeLabCsp,
      CodeLabLogger: CodeLabLogger,
      CodeLabHtml: CodeLabHtml,
      html: CodeLabHtml.html,
      raw: CodeLabHtml.raw,
      isSafeHtml: CodeLabHtml.isSafeHtml,
      escapeHtml: CodeLabHtml.escapeHtml,
      CodeLabError: CodeLabLogger.CodeLabError,
      isCodeLabError: CodeLabLogger.isCodeLabError,
      createLogger: CodeLabLogger.createLogger,
      DEFAULT_LOGGER: CodeLabLogger.DEFAULT_LOGGER,
      LOG_PREFIX: CodeLabLogger.LOG_PREFIX,
      CodeLabZip: CodeLabZip,
      zip: CodeLabZip,
      createZip: CodeLabZip.createZip,
      extractZip: CodeLabZip.extractZip,
      computeCrc32: CodeLabZip.computeCrc32,
      sanitizeZipPath: CodeLabZip.sanitizeZipPath,
      CodeLabStorage: CodeLabStorage,
      storage: CodeLabStorage,
      WorkspaceStorage: CodeLabStorage.WorkspaceStorage,
      createWorkspaceStorage: CodeLabStorage.createWorkspaceStorage,
      CodeLabSearch: CodeLabSearch,
      search: CodeLabSearch,
      searchInFiles: CodeLabSearch.searchInFiles,
      replaceInFiles: CodeLabSearch.replaceInFiles,
      matchesGlob: CodeLabSearch.matchesGlob,
      escapeRegex: CodeLabSearch.escapeRegex,
      normalizeSearchPath: CodeLabSearch.normalizeSearchPath,
      CodeLabDiagnostics: CodeLabDiagnostics,
      diagnostics: CodeLabDiagnostics,
      DiagnosticsStore: CodeLabDiagnostics.DiagnosticsStore,
      createDiagnosticsStore: CodeLabDiagnostics.createDiagnosticsStore,
      CodeLabScm: CodeLabScm,
      scm: CodeLabScm,
      createGitState: CodeLabScm.createGitState,
      computeGitStatus: CodeLabScm.computeGitStatus,
      stageFile: CodeLabScm.stageFile,
      unstageFile: CodeLabScm.unstageFile,
      commitChanges: CodeLabScm.commitChanges,
      computeShortCommitHash: CodeLabScm.computeShortCommitHash,
      CodeLabWorkbenchComponents: CodeLabWorkbenchComponents,
      default: CodeLab
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const ESM_BUNDLE = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};

// --- Module 0: Preview CSP, Structured Logger, Safe HTML & Leaf Engines ---
${cspCode}
${loggerCode}
${htmlCode}
${zipCode}
${storageCode}
${searchCode}
${diagnosticsCode}
${scmCode}
${workbenchComponentsCode}
_root.CodeLabZip = CodeLabZip;
_root.CodeLabStorage = CodeLabStorage;
_root.CodeLabSearch = CodeLabSearch;
_root.CodeLabDiagnostics = CodeLabDiagnostics;
_root.CodeLabScm = CodeLabScm;
_root.CodeLabWorkbenchComponents = CodeLabWorkbenchComponents;

// --- Module 1: Runtime Engine ---
(function () {
${runtimeCode}
})();

// --- Module 2: POSIX Shell & Coreutils ---
(function () {
${shellCode}
})();

// --- Module 3: PTY Terminal Engine ---
(function () {
${terminalCode}
})();

// --- Module 4: IDE Workbench & Web Component ---
(function () {
${workbenchCode}
})();

// --- Module 5: Modular Language & Guided Lab Extensions ---
${guidedLabExtCode}
${javascriptExtCode}
${typescriptExtCode}
${cppExtCode}
${pythonExtCode}

const CodeLabRuntime = _root.CodeLabRuntime;
const CodeLabShell = _root.CodeLabShell;
const CodeLabTerminal = _root.CodeLabTerminal;
const CodeLabWorkbench = _root.CodeLabWorkbench;
const CodeLabElement = _root.CodeLabElement;
const CodeLab = _root.CodeLab;
if (CodeLab && CodeLab.extensions) {
  CodeLab.extensions.guidedLab = CodeLabGuidedLab.guidedLabExtension;
  CodeLab.extensions.javascript = CodeLabJavaScript.javascriptExtension;
  CodeLab.extensions.typescript = CodeLabTypeScript.typescriptExtension;
  CodeLab.extensions.cpp = CodeLabCpp.cppExtension;
  CodeLab.extensions.python = CodeLabPython.pythonExtension;
}

const executeInVirtualRuntime = CodeLabRuntime.executeInVirtualRuntime;
const executeInWorker = CodeLabRuntime.executeInWorker;
const cancelWorkerExecution = CodeLabRuntime.cancelWorkerExecution;
const preloadNpmPackages = CodeLabRuntime.preloadNpmPackages;
const transpileTS = CodeLabRuntime.transpileTS;
const transpileForBrowser = CodeLabRuntime.transpileForBrowser;
const createVirtualFs = CodeLabRuntime.createVirtualFs;
const createVirtualHttp = CodeLabRuntime.createVirtualHttp;
const createVirtualNet = CodeLabRuntime.createVirtualNet;
const createVirtualPortTable = CodeLabRuntime.createVirtualPortTable;
const createVirtualWasi = CodeLabRuntime.createVirtualWasi;
const executeWasiModule = CodeLabRuntime.executeWasiModule;
const WasiExitSignal = CodeLabRuntime.WasiExitSignal;
const createSqliteDatabase = CodeLabRuntime.createSqliteDatabase;
const createWorkerRuntimeSource = CodeLabRuntime.createWorkerRuntimeSource;
const createPosixShell = CodeLabShell ? CodeLabShell.createPosixShell : null;
const cloneGitHubRepository = CodeLabShell ? CodeLabShell.cloneGitHubRepository : null;
const parseGitHubRepoUrl = CodeLabShell ? CodeLabShell.parseGitHubRepoUrl : null;
const createTerminal = CodeLabTerminal ? CodeLabTerminal.createTerminal : null;
const createPTYTerminalEngine = CodeLabTerminal ? CodeLabTerminal.createPTYTerminalEngine : null;
const PTYTerminalEngine = CodeLabTerminal ? CodeLabTerminal.PTYTerminalEngine : null;

const mount = CodeLab ? CodeLab.mount : null;
const create = CodeLab ? CodeLab.create : null;
const unmount = CodeLab ? CodeLab.unmount : null;
const version = CodeLab ? CodeLab.version : '${PKG_VERSION}';
const renderMarkdown = CodeLab ? CodeLab.renderMarkdown : null;
const renderSimpleMarkdown = CodeLab ? CodeLab.renderSimpleMarkdown : null;
const cloneRepo = CodeLab ? CodeLab.cloneRepo : null;
const extensions = CodeLab ? CodeLab.extensions : null;
const CodeLabError = CodeLabLogger.CodeLabError;
const isCodeLabError = CodeLabLogger.isCodeLabError;
const createLogger = CodeLabLogger.createLogger;
const DEFAULT_LOGGER = CodeLabLogger.DEFAULT_LOGGER;
const LOG_PREFIX = CodeLabLogger.LOG_PREFIX;
const Logger = CodeLab ? CodeLab.Logger : CodeLabLogger;
const html = CodeLabHtml.html;
const raw = CodeLabHtml.raw;
const isSafeHtml = CodeLabHtml.isSafeHtml;
const escapeHtml = CodeLabHtml.escapeHtml;
const Html = CodeLab ? CodeLab.Html : CodeLabHtml;
const zip = CodeLabZip;
const createZip = CodeLabZip.createZip;
const extractZip = CodeLabZip.extractZip;
const computeCrc32 = CodeLabZip.computeCrc32;
const sanitizeZipPath = CodeLabZip.sanitizeZipPath;
const storage = CodeLabStorage;
const WorkspaceStorage = CodeLabStorage.WorkspaceStorage;
const createWorkspaceStorage = CodeLabStorage.createWorkspaceStorage;
const search = CodeLabSearch;
const searchInFiles = CodeLabSearch.searchInFiles;
const replaceInFiles = CodeLabSearch.replaceInFiles;
const matchesGlob = CodeLabSearch.matchesGlob;
const escapeRegex = CodeLabSearch.escapeRegex;
const normalizeSearchPath = CodeLabSearch.normalizeSearchPath;
const diagnostics = CodeLabDiagnostics;
const DiagnosticsStore = CodeLabDiagnostics.DiagnosticsStore;
const createDiagnosticsStore = CodeLabDiagnostics.createDiagnosticsStore;
const scm = CodeLabScm;
const createGitState = CodeLabScm.createGitState;
const computeGitStatus = CodeLabScm.computeGitStatus;
const stageFile = CodeLabScm.stageFile;
const unstageFile = CodeLabScm.unstageFile;
const commitChanges = CodeLabScm.commitChanges;
const computeShortCommitHash = CodeLabScm.computeShortCommitHash;

export {
  CodeLab,
  CodeLabWorkbench,
  CodeLabWorkbench as Workbench,
  CodeLabElement,
  CodeLabRuntime,
  CodeLabRuntime as Runtime,
  CodeLabShell,
  CodeLabShell as Shell,
  CodeLabTerminal,
  CodeLabTerminal as Terminal,
  mount,
  create,
  unmount,
  version,
  renderMarkdown,
  renderSimpleMarkdown,
  cloneRepo,
  extensions,
  CodeLabCsp,
  CodeLabLogger,
  Logger,
  CodeLabHtml,
  Html,
  html,
  raw,
  isSafeHtml,
  escapeHtml,
  CodeLabError,
  isCodeLabError,
  createLogger,
  DEFAULT_LOGGER,
  LOG_PREFIX,
  CodeLabZip,
  zip,
  createZip,
  extractZip,
  computeCrc32,
  sanitizeZipPath,
  CodeLabStorage,
  storage,
  WorkspaceStorage,
  createWorkspaceStorage,
  CodeLabSearch,
  search,
  searchInFiles,
  replaceInFiles,
  matchesGlob,
  escapeRegex,
  normalizeSearchPath,
  CodeLabDiagnostics,
  diagnostics,
  DiagnosticsStore,
  createDiagnosticsStore,
  CodeLabScm,
  scm,
  createGitState,
  computeGitStatus,
  stageFile,
  unstageFile,
  commitChanges,
  computeShortCommitHash,
  createPosixShell,
  cloneGitHubRepository,
  parseGitHubRepoUrl,
  createTerminal,
  createPTYTerminalEngine,
  PTYTerminalEngine,
  executeInVirtualRuntime,
  executeInWorker,
  cancelWorkerExecution,
  preloadNpmPackages,
  transpileTS,
  transpileForBrowser,
  createVirtualFs,
  createVirtualHttp,
  createVirtualNet,
  createVirtualPortTable,
  createVirtualWasi,
  executeWasiModule,
  WasiExitSignal,
  createSqliteDatabase,
  createWorkerRuntimeSource,
  CodeLabWorkbenchComponents
};
export default CodeLab;
`;

const RUNTIME_IIFE = `${BANNER}(function (root) {
  'use strict';
${loggerCode}
  (function () {
${runtimeCode}
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CodeLabRuntime;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const RUNTIME_ESM = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
${loggerCode}
(function () {
${runtimeCode}
})();

const CodeLabRuntime = _root.CodeLabRuntime;
const VirtualBuffer = CodeLabRuntime.VirtualBuffer;
const VirtualCrypto = CodeLabRuntime.VirtualCrypto;
const VirtualZlib = CodeLabRuntime.VirtualZlib;
const VirtualPath = CodeLabRuntime.VirtualPath;
const VirtualOs = CodeLabRuntime.VirtualOs;
const VirtualAssert = CodeLabRuntime.VirtualAssert;
const EventEmitter = CodeLabRuntime.EventEmitter;
const VirtualUtil = CodeLabRuntime.VirtualUtil;
const VirtualUrl = CodeLabRuntime.VirtualUrl;
const VirtualQuerystring = CodeLabRuntime.VirtualQuerystring;
const VirtualStream = CodeLabRuntime.VirtualStream;
const VirtualStreamPromises = CodeLabRuntime.VirtualStreamPromises;
const VirtualStringDecoder = CodeLabRuntime.VirtualStringDecoder;
const VirtualDns = CodeLabRuntime.VirtualDns;
const createVirtualFs = CodeLabRuntime.createVirtualFs;
const createVirtualHttp = CodeLabRuntime.createVirtualHttp;
const createVirtualNet = CodeLabRuntime.createVirtualNet;
const transpileTS = CodeLabRuntime.transpileTS;
const transpileForBrowser = CodeLabRuntime.transpileForBrowser;
const preloadNpmPackages = CodeLabRuntime.preloadNpmPackages;
const createVirtualPortTable = CodeLabRuntime.createVirtualPortTable;
const createVirtualWasi = CodeLabRuntime.createVirtualWasi;
const executeWasiModule = CodeLabRuntime.executeWasiModule;
const WasiExitSignal = CodeLabRuntime.WasiExitSignal;
const createSqliteDatabase = CodeLabRuntime.createSqliteDatabase;
const executeInVirtualRuntime = CodeLabRuntime.executeInVirtualRuntime;
const createWorkerRuntimeSource = CodeLabRuntime.createWorkerRuntimeSource;
const cancelWorkerExecution = CodeLabRuntime.cancelWorkerExecution;
const executeInWorker = CodeLabRuntime.executeInWorker;

export {
  CodeLabRuntime,
  VirtualBuffer,
  VirtualCrypto,
  VirtualZlib,
  VirtualPath,
  VirtualOs,
  VirtualAssert,
  EventEmitter,
  VirtualUtil,
  VirtualUrl,
  VirtualQuerystring,
  VirtualStream,
  VirtualStreamPromises,
  VirtualStringDecoder,
  VirtualDns,
  createVirtualFs,
  createVirtualHttp,
  createVirtualNet,
  transpileTS,
  transpileForBrowser,
  preloadNpmPackages,
  createVirtualPortTable,
  createVirtualWasi,
  executeWasiModule,
  WasiExitSignal,
  createSqliteDatabase,
  executeInVirtualRuntime,
  createWorkerRuntimeSource,
  cancelWorkerExecution,
  executeInWorker
};
export default CodeLabRuntime;
`;

const SHELL_IIFE = `${BANNER}(function (root) {
  'use strict';
${loggerCode}
  (function () {
${shellCode}
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CodeLabShell;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const SHELL_ESM = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
${loggerCode}
(function () {
${shellCode}
})();

const CodeLabShell = _root.CodeLabShell;
const createPosixShell = CodeLabShell.createPosixShell;
const PosixShell = CodeLabShell.PosixShell;
const parseShellCommand = CodeLabShell.parseShellCommand;
const tokenizeShell = CodeLabShell.tokenizeShell;
const COREUTILS = CodeLabShell.COREUTILS;
const PosixPath = CodeLabShell.PosixPath;
const expandGlob = CodeLabShell.expandGlob;
const createVirtualPortTable = CodeLabShell.createVirtualPortTable;
const parseGitHubRepoUrl = CodeLabShell.parseGitHubRepoUrl;
const cloneGitHubRepository = CodeLabShell.cloneGitHubRepository;

export {
  CodeLabShell,
  createPosixShell,
  PosixShell,
  parseShellCommand,
  tokenizeShell,
  COREUTILS,
  PosixPath,
  expandGlob,
  createVirtualPortTable,
  parseGitHubRepoUrl,
  cloneGitHubRepository
};
export default CodeLabShell;
`;

const TERMINAL_IIFE = `${BANNER}(function (root) {
  'use strict';
${loggerCode}
  (function () {
${terminalCode}
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CodeLabTerminal;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const TERMINAL_ESM = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
${loggerCode}
(function () {
${terminalCode}
})();

const CodeLabTerminal = _root.CodeLabTerminal;
const PTYTerminalEngine = CodeLabTerminal.PTYTerminalEngine;
const createTerminal = CodeLabTerminal.createTerminal;
const createPTYTerminalEngine = CodeLabTerminal.createPTYTerminalEngine;
const ansiToHtml = CodeLabTerminal.ansiToHtml;
const parseAnsiToHtml = CodeLabTerminal.parseAnsiToHtml;
const escapeHtml = CodeLabTerminal.escapeHtml;
const ANSI_CODE_MAP = CodeLabTerminal.ANSI_CODE_MAP;
const resolveAnsiControlCodes = CodeLabTerminal.resolveAnsiControlCodes;

export {
  CodeLabTerminal,
  PTYTerminalEngine,
  createTerminal,
  createPTYTerminalEngine,
  ansiToHtml,
  parseAnsiToHtml,
  escapeHtml,
  ANSI_CODE_MAP,
  resolveAnsiControlCodes
};
export default CodeLabTerminal;
`;

const DTS_CONTENT = `/**
 * TypeScript Definitions for @innovatorved/code-lab v${PKG_VERSION}
 */

export interface CodeLabStep {
  id: string;
  title: string;
  concept?: string;
  targetFile?: string;
  targetSymbol?: string;
  instructions: string | string[];
  hint?: string;
  testNames?: string[];
}

export interface CodeLabTestError {
  name: string;
  message: string;
  stack: string;
  actual?: string;
  expected?: string;
  operator?: string;
}

export interface CodeLabTestResultItem {
  index: number;
  name: string;
  status: 'pass' | 'fail';
  passed: boolean;
  durationMs: number;
  error: CodeLabTestError | null;
}

export interface CodeLabFsSnapshotItem {
  path: string;
  size: number;
  isDirectory: boolean;
  mtimeMs: number;
  preview?: string;
  hexPreview?: string;
}

export interface CodeLabHttpTraceItem {
  protocol?: string;
  method?: string;
  port: number;
  url?: string;
  status?: number;
  durationMs: number;
}

export interface CodeLabExecutionOptions {
  files?: Record<string, string>;
  entry?: string;
  mode?: 'run' | 'test' | 'repl';
  replCode?: string;
  printReplResult?: boolean;
  testFilter?: string | string[] | null;
  timeoutMs?: number;
  maxOutputBytes?: number;
  maxConsoleCalls?: number;
  instanceId?: string;
  concurrent?: boolean;
  argv?: string[] | null;
  pid?: number;
  isBackground?: boolean;
  vfs?: any;
  activePortTable?: any;
  packages?: Record<string, any>;
  npmModules?: Record<string, any>;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  onTestResult?: (testResult: CodeLabTestResultItem) => void;
}

export interface CodeLabExecutionResult {
  ok: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  outputTruncated?: boolean;
  timedOut?: boolean;
  cancelled?: boolean;
  error?: { message: string; stack?: string };
  testResults: CodeLabTestResultItem[];
  testSummary?: {
    total: number;
    passed: number;
    failed: number;
  };
  fsSnapshot: CodeLabFsSnapshotItem[];
  httpTrace: CodeLabHttpTraceItem[];
  replValue?: string;
  replResult?: string;
}

export interface CodeLabCloneOptions {
  intoRoot?: boolean;
  targetDir?: string;
  branch?: string;
  depth?: number;
  maxFiles?: number;
  maxFileSize?: number;
  concurrency?: number;
  clearExisting?: boolean;
  signal?: AbortSignal;
}

/** Per-directive allowlists for the Web Preview Content-Security-Policy. */
export interface CodeLabPreviewCspSources {
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
  frameSrc?: string[];
}

export interface CodeLabPreviewCsp extends CodeLabPreviewCspSources {
  /**
   * - balanced (default) allows the CDNs the built-in preview server resolves
   *   bare imports to (jsDelivr, esm.sh), plus fonts.googleapis.com.
   * - strict blocks every remote host; only same-origin, data: and blob:.
   * - custom uses only the allowlists you provide.
   */
  mode?: 'strict' | 'balanced' | 'custom';
}

/** Payload emitted when a preview document violates its Content-Security-Policy. */
export interface CodeLabPreviewViolation {
  directive: string;
  blockedURI: string;
}

/**
 * Build, validate and describe Web Preview Content-Security-Policies.
 * Bundled into both the workbench and dist/preview-sw.js.
 */
export interface CodeLabCspAPI {
  buildPreviewPolicy(options?: {
    mode?: 'strict' | 'balanced' | 'custom';
    hostOrigin?: string;
    frameAncestors?: string;
  } & CodeLabPreviewCspSources): string;
  normalizePreviewCspConfig(raw: unknown): {
    mode: 'strict' | 'balanced' | 'custom';
    allow: CodeLabPreviewCspSources;
  };
  describePreviewNetwork(config: unknown): string[];
  buildPreviewShims(): string;
  normalizeOrigin(raw: unknown): string | null;
  PREVIEW_SHIM_MARKER: string;
}

export declare const CodeLabCsp: CodeLabCspAPI;

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export type CodeLabErrorCode =
  | 'E_PERSISTENCE'
  | 'E_WORKER_TIMEOUT'
  | 'E_WORKER_CRASH'
  | 'E_WORKER_INIT'
  | 'E_CSP_VIOLATION'
  | 'E_PREVIEW_SW'
  | 'E_PREVIEW_RENDER'
  | 'E_NETWORK_BLOCKED'
  | 'E_VFS'
  | 'E_SHELL'
  | 'E_TERMINAL'
  | 'E_MONACO_LOAD'
  | 'E_PACKAGE_FETCH'
  | 'E_CLONE_FAILED'
  | 'E_EXTENSION';

export interface CodeLabErrorOptions {
  cause?: unknown;
  context?: Record<string, unknown>;
}

export declare class CodeLabError extends Error {
  readonly code: CodeLabErrorCode;
  readonly context?: Record<string, unknown>;
  readonly cause?: unknown;
  constructor(code: CodeLabErrorCode, message: string, options?: CodeLabErrorOptions);
}

export interface Logger {
  readonly level: LogLevel;
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export interface CreateLoggerOptions {
  level?: LogLevel;
  scope?: string;
  sink?: Partial<Record<Exclude<LogLevel, 'silent'>, (line: string, meta?: unknown) => void>>;
}

export declare function isCodeLabError(value: unknown): value is CodeLabError;
export declare function createLogger(input?: LogLevel | CreateLoggerOptions | Logger): Logger;
export declare const DEFAULT_LOGGER: Logger;
export declare const LOG_PREFIX = '[code-lab]';

export interface SafeHtml {
  readonly __html: string;
  toString(): string;
}

export declare function escapeHtml(value: unknown): string;
export declare function raw(trustedHtml: string): SafeHtml;
export declare function isSafeHtml(value: unknown): value is SafeHtml;
export declare function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml;

export declare function computeCrc32(data: string | Uint8Array): number;
export declare function sanitizeZipPath(rawPath: string): string;
export declare function createZip(files: Record<string, string | Uint8Array>): Uint8Array;
export declare function extractZip(archive: Uint8Array): Record<string, Uint8Array>;
export declare const CodeLabZip: {
  computeCrc32: typeof computeCrc32;
  sanitizeZipPath: typeof sanitizeZipPath;
  createZip: typeof createZip;
  extractZip: typeof extractZip;
};

export interface WorkspaceProjectData {
  id: string;
  name?: string;
  files?: Record<string, string>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface WorkspaceProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  fileCount: number;
}

export declare class WorkspaceStorage {
  constructor(options?: Record<string, unknown>);
  getBackendType(): 'indexeddb' | 'localstorage' | 'memory';
  saveProject(project: WorkspaceProjectData): Promise<boolean>;
  loadProject(id: string): Promise<WorkspaceProjectData | null>;
  listProjects(): Promise<WorkspaceProjectSummary[]>;
  deleteProject(id: string): Promise<boolean>;
}
export declare function createWorkspaceStorage(options?: Record<string, unknown>): WorkspaceStorage;
export declare const CodeLabStorage: {
  WorkspaceStorage: typeof WorkspaceStorage;
  createWorkspaceStorage: typeof createWorkspaceStorage;
};

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  include?: string;
  exclude?: string;
}

export declare function searchInFiles(files: Record<string, string>, options: SearchOptions): any;
export declare function replaceInFiles(files: Record<string, string>, options: SearchOptions, replacement: string): any;
export declare function matchesGlob(filePath: string, globPattern?: string): boolean;
export declare function escapeRegex(literal: string): string;
export declare function normalizeSearchPath(rawPath: string): string;
export declare const CodeLabSearch: {
  searchInFiles: typeof searchInFiles;
  replaceInFiles: typeof replaceInFiles;
  matchesGlob: typeof matchesGlob;
  escapeRegex: typeof escapeRegex;
  normalizeSearchPath: typeof normalizeSearchPath;
};

export declare class DiagnosticsStore {
  add(item: any): void;
  remove(id: string): void;
  clear(source?: string): void;
  getAll(filter?: any): any[];
  getByFile(file: string): any[];
  subscribe(listener: (items: any[]) => void): () => void;
}
export declare function createDiagnosticsStore(): DiagnosticsStore;
export declare const CodeLabDiagnostics: {
  DiagnosticsStore: typeof DiagnosticsStore;
  createDiagnosticsStore: typeof createDiagnosticsStore;
};

export declare function createGitState(initialFiles?: Record<string, string>, branch?: string): any;
export declare function computeGitStatus(vfsFiles: Record<string, string>, repoRoot: string, gitState: any): any;
export declare function stageFile(path: string, vfsFiles: Record<string, string>, gitState: any): boolean;
export declare function unstageFile(path: string, gitState: any): boolean;
export declare function commitChanges(message: string, author: string | undefined, gitState: any): any;
export declare function computeShortCommitHash(input: string): string;
export declare const CodeLabScm: {
  createGitState: typeof createGitState;
  computeGitStatus: typeof computeGitStatus;
  stageFile: typeof stageFile;
  unstageFile: typeof unstageFile;
  commitChanges: typeof commitChanges;
  computeShortCommitHash: typeof computeShortCommitHash;
};

export interface CodeLabSaveStateEvent {
  state: 'saved' | 'failed';
  key: string;
  error?: CodeLabError;
}

export interface CodeLabOptions {
  /** Unique identifier used for localStorage persistence */
  id?: string;
  labId?: string;
  buildId?: string;
  /** Title displayed in the IDE header */
  title?: string;
  /** Subtitle / summary displayed in the guide panel when README.md is absent */
  summary?: string;
  /** Content-Security-Policy applied to Web Preview documents */
  previewCsp?: CodeLabPreviewCsp | 'strict' | 'balanced' | 'custom';
  /**
   * Origin used to serve previews from a different origin than the IDE.
   * Requires the preview relay (apps/preview-origin), which has not shipped
   * yet: the option is currently ignored with a console warning rather than
   * silently returning 503s.
   */
  previewOrigin?: string;
  /** Initial workbench mode ('guided' | 'sandbox') */
  mode?: 'guided' | 'sandbox';
  /** Initial workspace language ('js' | 'ts' | 'cpp' | 'py') */
  language?: 'js' | 'ts' | 'cpp' | 'py';
  lang?: 'js' | 'ts' | 'cpp' | 'py';
  /** Enabled languages in the language switcher */
  languages?: Array<'js' | 'ts' | 'cpp' | 'py'>;
  /** Explicit theme override ('dark' | 'light' | 'auto') */
  theme?: 'dark' | 'light' | 'auto';
  /** Set to false to disable localStorage persistence and use in-memory state only */
  persistState?: boolean;
  /** Structured logger or log level ('silent' | 'error' | 'warn' | 'info' | 'debug', default: 'warn') */
  logger?: LogLevel | CreateLoggerOptions | Logger;
  /** Shortcut for setting logger level */
  logLevel?: LogLevel;
  /** Public GitHub repository URL or owner/repo shorthand to automatically clone on mount */
  repo?: string;
  githubRepo?: string;
  /** Optional GitHub branch/tag/SHA to clone when repo is specified */
  branch?: string;
  /** Reference/solution files map (filename -> source content) */
  files?: Record<string, string>;
  /** Explicit reference solution files map (JavaScript) */
  solutionFiles?: Record<string, string>;
  /** Initial starter files map for guided mode (JavaScript) */
  starterFiles?: Record<string, string>;
  /** Explicit TypeScript files map for sandbox mode */
  tsFiles?: Record<string, string>;
  tsSolutionFiles?: Record<string, string>;
  /** Explicit TypeScript starter files map for guided mode */
  tsStarterFiles?: Record<string, string>;
  /** Explicit C++ files map for sandbox mode */
  cppFiles?: Record<string, string>;
  cppSolutionFiles?: Record<string, string>;
  /** Explicit C++ starter files map for guided mode */
  cppStarterFiles?: Record<string, string>;
  /** Explicit Python files map for sandbox mode */
  pyFiles?: Record<string, string>;
  pySolutionFiles?: Record<string, string>;
  /** Explicit Python starter files map for guided mode */
  pyStarterFiles?: Record<string, string>;
  /** Python toolchain configuration */
  python?: {
    preloadPackages?: string[];
    cdnBaseUrl?: string;
  };
  /** Modular extensions or plugins to install on mount */
  extensions?: Array<any>;
  plugins?: Array<any>;
  /** Ordered guided steps */
  steps?: CodeLabStep[];
  /** Guided configuration object */
  guided?: {
    starterFiles?: Record<string, string>;
    tsStarterFiles?: Record<string, string>;
    cppStarterFiles?: Record<string, string>;
    pyStarterFiles?: Record<string, string>;
    steps?: CodeLabStep[];
  };
  /** Initial active step index (0-based) */
  stepIndex?: number;
  /** Demo entry point file to execute on runDemo() (default: 'demo.js' / 'demo.ts') */
  entry?: string;
  /** Test suite entry point file to execute on runTests() (default: 'test.js' / 'test.ts') */
  testEntry?: string;
  testFile?: string;
  /** Label for the back button when onClose is provided */
  backLabel?: string;
  /** Custom Monaco AMD loader base URL */
  monacoUrl?: string;
  /** Callback fired when the back/close button is clicked */
  onClose?: () => void;
  /** Callback fired when a guided step passes all its testNames */
  onStepComplete?: (step: CodeLabStep, stepIndex: number) => void;
  /** Callback fired when all guided steps in the lab are completed */
  onLabComplete?: (labId: string) => void;
  /** Callback fired whenever runDemo() or runTests() finishes */
  onRun?: (result: CodeLabExecutionResult) => void;
  /** Callback fired when runTests() finishes */
  onTestResult?: (result: CodeLabExecutionResult) => void;
  /** Callback fired whenever a file is edited */
  onCodeChange?: (filename: string, code: string) => void;
}

export declare class CodeLabWorkbench {
  instanceId: string;
  container: HTMLElement;
  labId: string;
  title: string;
  summary: string;
  options: CodeLabOptions;
  files: Record<string, string>;
  openTabs: string[];
  activeFile: string | null;
  mode: 'guided' | 'sandbox';
  lang: 'js' | 'ts' | 'cpp' | 'py';
  enabledLanguages: Set<'js' | 'ts' | 'cpp' | 'py'>;
  activeStepIndex: number;
  completedSteps: Set<string>;
  steps: CodeLabStep[];
  cursorPos: { lineNumber: number; column: number; ln: number; col: number };
  isRunning: boolean;
  isFullscreen: boolean;
  constructor(container: HTMLElement | string, options?: CodeLabOptions);
  runDemo(): Promise<void>;
  runTests(filterTestNames?: string | string[] | null): Promise<void>;
  verifyCurrentStep(): Promise<void>;
  stopExecution(): void;
  cancelExecution(): void;
  selectStep(idx: number, shouldJump?: boolean): void;
  openFile(filename: string, symbolToFind?: string): void;
  closeTab(filename: string): void;
  closeOtherTabs(keepPath: string): void;
  closeAllTabs(): void;
  createFile(rawName: string): string | null;
  createFolder(rawFolderPath: string): boolean;
  renameFile(oldPath: string, newPath: string): boolean;
  renameFolder(oldPrefix: string, newPrefix: string): boolean;
  duplicateFile(path: string): string | null;
  moveFile(oldPath: string, newPath: string): boolean;
  movePath(sourcePath: string, targetFolder: string): boolean;
  startInlineCreate(type: 'file' | 'folder', folderPrefix?: string): void;
  startInlineRename(oldPath: string, isFolder?: boolean): void;
  promptNewFile(folderPrefix?: string): void;
  promptNewFolder(folderPrefix?: string): void;
  deleteFile(filename: string): boolean;
  deleteFolder(folderPrefix: string): boolean;
  setMode(newMode: 'guided' | 'sandbox'): void;
  setLanguage(newLang: 'js' | 'ts' | 'cpp' | 'py'): void;
  switchDrawerTab(tabName: 'tests' | 'terminal' | 'ports' | 'network' | 'inspector'): void;
  configure(opts?: { mode?: 'guided' | 'sandbox'; lang?: 'js' | 'ts' | 'cpp' | 'py'; stepIndex?: number }): void;
  runCode(): Promise<void>;
  runActiveFile(): Promise<void>;
  shareSnapshot(): Promise<void>;
  formatActiveDocument(): Promise<void>;
  toggleWebPreview(): void;
  runSelectedCode(): Promise<void>;
  openCommandPalette(mode?: 'commands' | 'files'): void;
  closeCommandPalette(): void;
  openContextMenu(x: number, y: number, items: Array<{ label?: string; action?: () => void; danger?: boolean; separator?: boolean }>): void;
  closeContextMenu(): void;
  showPackagesModal(): void;
  addNpmPackage(rawSpec: string): void;
  showCloneRepoModal(): void;
  cloneRepo(repoUrlOrSlug: string, options?: CodeLabCloneOptions): Promise<any>;
  showSolutionModal(): void;
  showDiffModal(targetFile?: string, compareTarget?: 'solution' | 'starter'): void;
  applyReferenceSolution(): void;
  downloadFile(path?: string): { filename: string; content: string } | null;
  exportWorkspace(options?: { download?: boolean }): Record<string, any>;
  importWorkspace(snapshotOrJson: string | Record<string, any>): boolean;
  exportZip(options?: { download?: boolean; filename?: string }): Uint8Array | null;
  importZip(archiveBytes: Uint8Array, options?: { merge?: boolean }): number;
  showSearchModal(initialQuery?: string): void;
  showScmModal(): void;
  getDiagnostics(filter?: { file?: string; severity?: 'error' | 'warning' | 'info'; source?: string }): any[];
  showProblemsModal(): void;
  listTerminalSessions(): Array<{ id: string; name: string; active: boolean }>;
  createTerminalSession(name?: string): string;
  switchTerminalSession(id: string): boolean;
  closeTerminalSession(id: string): boolean;
  saveProjectToStorage(projectId?: string): Promise<boolean>;
  loadProjectFromStorage(projectId?: string): Promise<boolean>;
  getFiles(): Record<string, string>;
  setFiles(filesMap: Record<string, string>, options?: { merge?: boolean }): this;
  getFile(path: string): string | null;
  setFile(path: string, content: string, options?: { open?: boolean }): this;
  getOpenTabs(): string[];
  reset(): this;
  previewOrigin: string | null;
  previewCsp: { mode: 'strict' | 'balanced' | 'custom'; allow: CodeLabPreviewCspSources };
  logger: Logger;
  saveStatusState: 'saved' | 'failed';
  lastSaveError: CodeLabError | null;
  on(event: 'preview-violation', handler: (detail: CodeLabPreviewViolation) => void): () => void;
  on(event: 'save-state', handler: (detail: CodeLabSaveStateEvent) => void): () => void;
  on(event: 'error', handler: (detail: CodeLabError) => void): () => void;
  on(event: string, handler: (detail: any) => void): () => void;
  off(event: string, handler: (detail: any) => void): this;
  use(plugin: (workbench: CodeLabWorkbench, options?: any) => any, options?: any): this;
  closeModal(): void;
  resetLab(): void;
  toggleFullscreen(): void;
  destroy(): void;
}

export declare class CodeLabElement extends HTMLElement {
  static observedAttributes: string[];
  _instance: CodeLabWorkbench | null;
  getFiles(): Record<string, string>;
  setFiles(filesMap: Record<string, string>, options?: { merge?: boolean }): CodeLabWorkbench | undefined;
  getFile(path: string): string | null;
  setFile(path: string, content: string, options?: { open?: boolean }): CodeLabWorkbench | undefined;
  deleteFile(path: string): boolean;
  getOpenTabs(): string[];
  reset(): CodeLabWorkbench | undefined;
  on(event: string, handler: (detail: any) => void): (() => void) | undefined;
  off(event: string, handler: (detail: any) => void): CodeLabWorkbench | undefined;
  use(plugin: (workbench: CodeLabWorkbench, options?: any) => any, options?: any): CodeLabWorkbench | undefined;
  openCommandPalette(mode?: 'commands' | 'files'): void;
  showDiffModal(targetFile?: string, compareTarget?: 'solution' | 'starter'): void;
  exportWorkspace(options?: { download?: boolean }): Record<string, any> | null;
  importWorkspace(snapshotOrJson: string | Record<string, any>): boolean;
  exportZip(options?: { download?: boolean; filename?: string }): Uint8Array | null;
  importZip(archiveBytes: Uint8Array, options?: { merge?: boolean }): number;
  showSearchModal(initialQuery?: string): void;
  showScmModal(): void;
  getDiagnostics(filter?: { file?: string; severity?: 'error' | 'warning' | 'info'; source?: string }): any[];
  showProblemsModal(): void;
  listTerminalSessions(): Array<{ id: string; name: string; active: boolean }>;
  createTerminalSession(name?: string): string | null;
  switchTerminalSession(id: string): boolean;
  closeTerminalSession(id: string): boolean;
  cloneRepo(repoUrlOrSlug: string, options?: CodeLabCloneOptions): Promise<any>;
}

export interface CodeLabRuntimeAPI {
  executeInVirtualRuntime(options?: CodeLabExecutionOptions): Promise<CodeLabExecutionResult>;
  executeInWorker(options?: CodeLabExecutionOptions): Promise<CodeLabExecutionResult>;
  cancelWorkerExecution(reason?: string, instanceId?: string): boolean;
  preloadNpmPackages(files?: Record<string, string>, onProgress?: (pkg: string) => void): Promise<Record<string, string>>;
  preloadNpmPackages(files: Record<string, string> | undefined, existingCache: Map<string, string>, onProgress?: (pkg: string) => void): Promise<Record<string, string>>;
  transpileTS(source: string, filename?: string): string;
  transpileForBrowser(source: string, filename?: string): string;
  createVirtualFs(initialFiles?: Record<string, string>): any;
  createVirtualHttp(resourceTracker?: any, sharedTrace?: any[], activePortTable?: any): any;
  createVirtualNet(resourceTracker?: any, sharedTrace?: any[], activePortTable?: any): any;
  createVirtualPortTable(): any;
}

export declare const CodeLabRuntime: CodeLabRuntimeAPI;
export declare const executeInVirtualRuntime: CodeLabRuntimeAPI['executeInVirtualRuntime'];
export declare const executeInWorker: CodeLabRuntimeAPI['executeInWorker'];
export declare const cancelWorkerExecution: CodeLabRuntimeAPI['cancelWorkerExecution'];
export declare const preloadNpmPackages: CodeLabRuntimeAPI['preloadNpmPackages'];
export declare const transpileTS: CodeLabRuntimeAPI['transpileTS'];
export declare const transpileForBrowser: CodeLabRuntimeAPI['transpileForBrowser'];
export declare const createVirtualFs: CodeLabRuntimeAPI['createVirtualFs'];
export declare const createVirtualHttp: CodeLabRuntimeAPI['createVirtualHttp'];
export declare const createVirtualNet: CodeLabRuntimeAPI['createVirtualNet'];
export declare const createVirtualPortTable: CodeLabRuntimeAPI['createVirtualPortTable'];

export interface CodeLabShellAPI {
  createPosixShell(options?: any): any;
  PosixShell: any;
  parseShellCommand(cmd: string): any;
  tokenizeShell(cmd: string): any;
  COREUTILS: Record<string, any>;
  PosixPath: any;
  expandGlob(pattern: string, cwd: string, vfs: any): string[];
  createVirtualPortTable(): any;
  parseGitHubRepoUrl(input: string): {
    owner: string;
    repo: string;
    branch: string | null;
    subpath: string;
    fullName: string;
    httpsUrl: string;
    gitUrl: string;
  } | null;
  cloneGitHubRepository(repoInput: string, vfs: any, options?: CodeLabCloneOptions): Promise<any>;
}

export interface CodeLabTerminalAPI {
  PTYTerminalEngine: any;
  createTerminal(container?: HTMLElement | string | Record<string, any>, options?: any): any;
  createPTYTerminalEngine(container?: HTMLElement | string | Record<string, any>, options?: any): any;
  ansiToHtml(text: string): string;
  parseAnsiToHtml(text: string): string;
}

export declare const CodeLabShell: CodeLabShellAPI;
export declare const CodeLabTerminal: CodeLabTerminalAPI;
export declare const createPosixShell: CodeLabShellAPI['createPosixShell'];
export declare const parseGitHubRepoUrl: CodeLabShellAPI['parseGitHubRepoUrl'];
export declare const cloneGitHubRepository: CodeLabShellAPI['cloneGitHubRepository'];
export declare const createTerminal: CodeLabTerminalAPI['createTerminal'];
export declare const createPTYTerminalEngine: CodeLabTerminalAPI['createPTYTerminalEngine'];
export declare const PTYTerminalEngine: any;

export interface CodeLabStatic {
  version: string;
  Workbench: typeof CodeLabWorkbench;
  CodeLabWorkbench: typeof CodeLabWorkbench;
  CodeLabElement: typeof CodeLabElement;
  Runtime: CodeLabRuntimeAPI;
  Shell: CodeLabShellAPI;
  Terminal: CodeLabTerminalAPI;
  create(container: HTMLElement | string, options?: CodeLabOptions): CodeLabWorkbench | null;
  mount(container: HTMLElement | string, options?: CodeLabOptions): CodeLabWorkbench | null;
  unmount(container: HTMLElement | string): void;
  cloneRepo(vfsOrWorkbench: any, repoInput: string, options?: CodeLabCloneOptions): Promise<any>;
  parseGitHubRepoUrl: CodeLabShellAPI['parseGitHubRepoUrl'];
  CodeLabError: typeof CodeLabError;
  isCodeLabError: typeof isCodeLabError;
  createLogger: typeof createLogger;
  Logger: {
    CodeLabError: typeof CodeLabError;
    isCodeLabError: typeof isCodeLabError;
    createLogger: typeof createLogger;
    DEFAULT_LOGGER: Logger;
    LOG_PREFIX: typeof LOG_PREFIX;
  };
  html: typeof html;
  raw: typeof raw;
  isSafeHtml: typeof isSafeHtml;
  escapeHtml: typeof escapeHtml;
  Html: {
    html: typeof html;
    raw: typeof raw;
    isSafeHtml: typeof isSafeHtml;
    escapeHtml: typeof escapeHtml;
  };
}

export declare const CodeLabWorkbenchComponents: any;
export declare const CodeLab: CodeLabStatic;
export default CodeLab;
`;

fs.mkdirSync(DIST_DIR, { recursive: true });

// 1. Write to dist/*
fs.writeFileSync(path.join(DIST_DIR, 'code-lab.js'), IIFE_BUNDLE, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'code-lab.esm.js'), ESM_BUNDLE, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'runtime.js'), RUNTIME_IIFE, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'runtime.esm.js'), RUNTIME_ESM, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'shell.js'), SHELL_IIFE, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'shell.esm.js'), SHELL_ESM, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'terminal.js'), TERMINAL_IIFE, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'terminal.esm.js'), TERMINAL_ESM, 'utf8');
fs.writeFileSync(path.join(DIST_DIR, 'code-lab.d.ts'), DTS_CONTENT, 'utf8');

// 2. Copy CSS to dist/code-lab.css
if (fs.existsSync(cssPath)) {
  fs.copyFileSync(cssPath, path.join(DIST_DIR, 'code-lab.css'));
}

// 2b. Copy sample.html to dist/sample.html
const sampleHtmlPath = path.join(SRC_DIR, 'sample.html');
if (fs.existsSync(sampleHtmlPath)) {
  fs.copyFileSync(sampleHtmlPath, path.join(DIST_DIR, 'sample.html'));
  const CLOUD_IDE_PUBLIC_DIST = path.join(PKG_DIR, 'examples/cloud-ide/public/dist');
  if (fs.existsSync(CLOUD_IDE_PUBLIC_DIST)) {
    fs.copyFileSync(sampleHtmlPath, path.join(CLOUD_IDE_PUBLIC_DIST, 'sample.html'));
  }
}

// 2c. Build preview-sw.js: the shared CSP module + the worker script, so the
//     worker and the workbench can never disagree about the policy.
const previewSwPath = path.join(SRC_DIR, 'preview-sw.js');
if (fs.existsSync(previewSwPath)) {
  const swSource = fs.readFileSync(previewSwPath, 'utf8');
  const swBundle = `${BANNER}\n${cspCode}\n${swSource}`;
  fs.writeFileSync(path.join(DIST_DIR, 'preview-sw.js'), swBundle, 'utf8');
  const CLOUD_IDE_PUBLIC_ROOT = path.join(PKG_DIR, 'examples/cloud-ide/public');
  if (fs.existsSync(CLOUD_IDE_PUBLIC_ROOT)) {
    fs.writeFileSync(path.join(CLOUD_IDE_PUBLIC_ROOT, 'preview-sw.js'), swBundle, 'utf8');
  }
}

// 3. Build Extensions (guided-lab, javascript, typescript, cpp)
const EXT_DIR = path.join(DIST_DIR, 'extensions');
fs.mkdirSync(EXT_DIR, { recursive: true });

try {
  const umdFooter = (globalName) =>
    `--footer:js=if(typeof module!=="undefined"&&module.exports)module.exports=${globalName};if(typeof globalThis!=="undefined")globalThis.${globalName}=${globalName};`;
  execFileSync(localBin('esbuild'), ['src/extensions/guided-lab.ts', '--bundle', '--format=iife', '--global-name=CodeLabGuidedLab', umdFooter('CodeLabGuidedLab'), '--outfile=dist/extensions/guided-lab.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/guided-lab.ts', '--bundle', '--format=esm', '--outfile=dist/extensions/guided-lab.esm.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/javascript.ts', '--bundle', '--format=iife', '--global-name=CodeLabJavaScript', umdFooter('CodeLabJavaScript'), '--outfile=dist/extensions/javascript.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/javascript.ts', '--bundle', '--format=esm', '--outfile=dist/extensions/javascript.esm.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/typescript.ts', '--bundle', '--format=iife', '--global-name=CodeLabTypeScript', umdFooter('CodeLabTypeScript'), '--outfile=dist/extensions/typescript.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/typescript.ts', '--bundle', '--format=esm', '--outfile=dist/extensions/typescript.esm.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/cpp.ts', '--bundle', '--format=iife', '--global-name=CodeLabCpp', umdFooter('CodeLabCpp'), '--outfile=dist/extensions/cpp.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/cpp.ts', '--bundle', '--format=esm', '--outfile=dist/extensions/cpp.esm.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/python.ts', '--bundle', '--format=iife', '--global-name=CodeLabPython', umdFooter('CodeLabPython'), '--outfile=dist/extensions/python.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/extensions/python.ts', '--bundle', '--format=esm', '--outfile=dist/extensions/python.esm.js'], { stdio: 'inherit', cwd: PKG_DIR });
  console.log('✓ Built dist/extensions/{guided-lab,javascript,typescript,cpp,python}.{js,esm.js}');
} catch (e) {
  console.error('Failed to bundle extensions:', e.message);
  process.exit(1);
}

// 3b. Bundle Zod schemas (the `./schemas` subpath export)
try {
  execFileSync(localBin('esbuild'), ['src/schemas.ts', '--bundle', '--format=cjs', '--outfile=dist/schemas.js'], { stdio: 'inherit', cwd: PKG_DIR });
  execFileSync(localBin('esbuild'), ['src/schemas.ts', '--bundle', '--format=esm', '--outfile=dist/schemas.esm.js'], { stdio: 'inherit', cwd: PKG_DIR });
  console.log('✓ Built dist/schemas.js & schemas.esm.js');
} catch (e) {
  console.error('Failed to bundle schemas:', e.message);
  process.exit(1);
}

// 4. Emit TypeScript Declarations (.d.ts)
try {
  execFileSync(localBin('tsc'), ['--emitDeclarationOnly'], { stdio: 'inherit', cwd: PKG_DIR });
  console.log('✓ Generated TypeScript declaration files in dist/');
} catch (e) {
  console.error('tsc declaration emit failed:', e.message);
  process.exit(1);
}

// 5. Sync dist/ to examples/cloud-ide/public/dist
const CLOUD_IDE_PUBLIC_ROOT = path.join(PKG_DIR, 'examples/cloud-ide/public');
const CLOUD_IDE_PUBLIC_DIST = path.join(CLOUD_IDE_PUBLIC_ROOT, 'dist');
if (fs.existsSync(CLOUD_IDE_PUBLIC_ROOT)) {
  fs.mkdirSync(CLOUD_IDE_PUBLIC_DIST, { recursive: true });
  fs.cpSync(DIST_DIR, CLOUD_IDE_PUBLIC_DIST, { recursive: true });
  console.log('✓ Synced dist/ into examples/cloud-ide/public/dist/');
}

console.log('✓ Built dist/code-lab.js (UMD/IIFE, ' + ( Buffer.byteLength(IIFE_BUNDLE) / 1024 ).toFixed(1) + ' KB)');
console.log('✓ Built dist/code-lab.esm.js (ESM)');
console.log('✓ Built dist/runtime.js & runtime.esm.js');
console.log('✓ Built dist/shell.js & shell.esm.js');
console.log('✓ Built dist/terminal.js & terminal.esm.js');
console.log('✓ Built dist/code-lab.d.ts');
console.log('✓ Synced dist/code-lab.css');
console.log('✓ Synced dist/sample.html');
console.log('✓ Synced dist/preview-sw.js (Web Preview virtual loopback Service Worker)');


