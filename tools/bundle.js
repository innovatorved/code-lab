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
const { execSync } = require('child_process');

const PKG_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PKG_DIR, 'src');
const DIST_DIR = path.join(PKG_DIR, 'dist');

const runtimeCode = fs.readFileSync(path.join(SRC_DIR, 'runtime.js'), 'utf8');
const shellCode = fs.readFileSync(path.join(SRC_DIR, 'shell.js'), 'utf8');
const terminalCode = fs.readFileSync(path.join(SRC_DIR, 'terminal.js'), 'utf8');
const workbenchCode = fs.readFileSync(path.join(SRC_DIR, 'workbench.js'), 'utf8');
const cssPath = path.join(SRC_DIR, 'code-lab.css');

const BANNER = `/**
 * ============================================================
 * @innovatorved/code-lab v2.0.0 — Standalone Browser Code IDE & Virtual Runtime
 * ============================================================
 * Features:
 *   - Sandboxed Web Worker Execution Engine with Multi-Instance Isolation & Watchdog Timer
 *   - First-Class Node.js and Bun Runtimes (Bun.serve, bun:test, bun:sqlite, Bun.*)
 *   - Full POSIX Shell AST & 55+ UNIX Coreutils (pipes, redirects, globs, env vars, git & git clone)
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

  const CodeLab = root.CodeLab;
  const CodeLabWorkbench = root.CodeLabWorkbench;
  const CodeLabElement = root.CodeLabElement;

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
      createVirtualFs: CodeLabRuntime.createVirtualFs,
      createVirtualHttp: CodeLabRuntime.createVirtualHttp,
      createVirtualNet: CodeLabRuntime.createVirtualNet,
      createVirtualPortTable: CodeLabRuntime.createVirtualPortTable,
      default: CodeLab
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const ESM_BUNDLE = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};

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

const CodeLabRuntime = _root.CodeLabRuntime;
const CodeLabShell = _root.CodeLabShell;
const CodeLabTerminal = _root.CodeLabTerminal;
const CodeLabWorkbench = _root.CodeLabWorkbench;
const CodeLabElement = _root.CodeLabElement;
const CodeLab = _root.CodeLab;

const executeInVirtualRuntime = CodeLabRuntime.executeInVirtualRuntime;
const executeInWorker = CodeLabRuntime.executeInWorker;
const cancelWorkerExecution = CodeLabRuntime.cancelWorkerExecution;
const preloadNpmPackages = CodeLabRuntime.preloadNpmPackages;
const transpileTS = CodeLabRuntime.transpileTS;
const createVirtualFs = CodeLabRuntime.createVirtualFs;
const createVirtualHttp = CodeLabRuntime.createVirtualHttp;
const createVirtualNet = CodeLabRuntime.createVirtualNet;
const createVirtualPortTable = CodeLabRuntime.createVirtualPortTable;
const createPosixShell = CodeLabShell ? CodeLabShell.createPosixShell : null;
const cloneGitHubRepository = CodeLabShell ? CodeLabShell.cloneGitHubRepository : null;
const parseGitHubRepoUrl = CodeLabShell ? CodeLabShell.parseGitHubRepoUrl : null;
const createTerminal = CodeLabTerminal ? CodeLabTerminal.createTerminal : null;
const createPTYTerminalEngine = CodeLabTerminal ? CodeLabTerminal.createPTYTerminalEngine : null;
const PTYTerminalEngine = CodeLabTerminal ? CodeLabTerminal.PTYTerminalEngine : null;

const mount = CodeLab ? CodeLab.mount : null;
const create = CodeLab ? CodeLab.create : null;
const unmount = CodeLab ? CodeLab.unmount : null;
const version = CodeLab ? CodeLab.version : '1.4.0';

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
  createVirtualFs,
  createVirtualHttp,
  createVirtualNet,
  createVirtualPortTable
};
export default CodeLab;
`;

const RUNTIME_IIFE = `${BANNER}(function (root) {
  'use strict';
  (function () {
${runtimeCode}
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CodeLabRuntime;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const RUNTIME_ESM = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
(function () {
${runtimeCode}
})();

const CodeLabRuntime = _root.CodeLabRuntime;
const executeInVirtualRuntime = CodeLabRuntime.executeInVirtualRuntime;
const executeInWorker = CodeLabRuntime.executeInWorker;
const cancelWorkerExecution = CodeLabRuntime.cancelWorkerExecution;
const preloadNpmPackages = CodeLabRuntime.preloadNpmPackages;
const transpileTS = CodeLabRuntime.transpileTS;
const createVirtualFs = CodeLabRuntime.createVirtualFs;
const createVirtualHttp = CodeLabRuntime.createVirtualHttp;
const createVirtualNet = CodeLabRuntime.createVirtualNet;
const createVirtualPortTable = CodeLabRuntime.createVirtualPortTable;

export {
  CodeLabRuntime,
  executeInVirtualRuntime,
  executeInWorker,
  cancelWorkerExecution,
  preloadNpmPackages,
  transpileTS,
  createVirtualFs,
  createVirtualHttp,
  createVirtualNet,
  createVirtualPortTable
};
export default CodeLabRuntime;
`;

const SHELL_IIFE = `${BANNER}(function (root) {
  'use strict';
  (function () {
${shellCode}
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CodeLabShell;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const SHELL_ESM = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
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
  (function () {
${terminalCode}
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CodeLabTerminal;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const TERMINAL_ESM = `${BANNER}const _root = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
(function () {
${terminalCode}
})();

const CodeLabTerminal = _root.CodeLabTerminal;
const PTYTerminalEngine = CodeLabTerminal.PTYTerminalEngine;
const createTerminal = CodeLabTerminal.createTerminal;
const createPTYTerminalEngine = CodeLabTerminal.createPTYTerminalEngine;
const ansiToHtml = CodeLabTerminal.ansiToHtml;
const parseAnsiToHtml = CodeLabTerminal.parseAnsiToHtml;

export {
  CodeLabTerminal,
  PTYTerminalEngine,
  createTerminal,
  createPTYTerminalEngine,
  ansiToHtml,
  parseAnsiToHtml
};
export default CodeLabTerminal;
`;

const DTS_CONTENT = `/**
 * TypeScript Definitions for @innovatorved/code-lab v1.4.0
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

export interface CodeLabOptions {
  /** Unique identifier used for localStorage persistence */
  id?: string;
  labId?: string;
  buildId?: string;
  /** Title displayed in the IDE header */
  title?: string;
  /** Subtitle / summary displayed in the guide panel when README.md is absent */
  summary?: string;
  /** Initial workbench mode ('guided' | 'sandbox') */
  mode?: 'guided' | 'sandbox';
  /** Initial workspace language ('js' | 'ts') */
  language?: 'js' | 'ts';
  lang?: 'js' | 'ts';
  /** Explicit theme override ('dark' | 'light' | 'auto') */
  theme?: 'dark' | 'light' | 'auto';
  /** Set to false to disable localStorage persistence and use in-memory state only */
  persistState?: boolean;
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
  /** Ordered guided steps */
  steps?: CodeLabStep[];
  /** Guided configuration object */
  guided?: {
    starterFiles?: Record<string, string>;
    tsStarterFiles?: Record<string, string>;
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
  lang: 'js' | 'ts';
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
  setLanguage(newLang: 'js' | 'ts'): void;
  switchDrawerTab(tabName: 'tests' | 'terminal' | 'ports' | 'network' | 'inspector'): void;
  configure(opts?: { mode?: 'guided' | 'sandbox'; lang?: 'js' | 'ts'; stepIndex?: number }): void;
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
  getFiles(): Record<string, string>;
  setFiles(filesMap: Record<string, string>, options?: { merge?: boolean }): this;
  getFile(path: string): string | null;
  setFile(path: string, content: string, options?: { open?: boolean }): this;
  getOpenTabs(): string[];
  reset(): this;
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
  cloneRepo(repoUrlOrSlug: string, options?: CodeLabCloneOptions): Promise<any>;
}

export interface CodeLabRuntimeAPI {
  executeInVirtualRuntime(options?: CodeLabExecutionOptions): Promise<CodeLabExecutionResult>;
  executeInWorker(options?: CodeLabExecutionOptions): Promise<CodeLabExecutionResult>;
  cancelWorkerExecution(reason?: string, instanceId?: string): boolean;
  preloadNpmPackages(files?: Record<string, string>, existingCache?: Map<string, string>): Promise<Record<string, string>>;
  transpileTS(source: string, filename?: string): string;
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
}

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

// 2c. Copy preview-sw.js to dist/preview-sw.js and to the host public root
//     (root scope so `/__preview/:port/*` pop-out routing works).
const previewSwPath = path.join(SRC_DIR, 'preview-sw.js');
if (fs.existsSync(previewSwPath)) {
  fs.copyFileSync(previewSwPath, path.join(DIST_DIR, 'preview-sw.js'));
  const CLOUD_IDE_PUBLIC_ROOT = path.join(PKG_DIR, 'examples/cloud-ide/public');
  if (fs.existsSync(CLOUD_IDE_PUBLIC_ROOT)) {
    fs.copyFileSync(previewSwPath, path.join(CLOUD_IDE_PUBLIC_ROOT, 'preview-sw.js'));
  }
}

// 3. Build Extensions (guided-lab)
const EXT_DIR = path.join(DIST_DIR, 'extensions');
fs.mkdirSync(EXT_DIR, { recursive: true });

try {
  execSync('npx esbuild src/extensions/guided-lab.ts --bundle --format=iife --global-name=CodeLabGuidedLab --outfile=dist/extensions/guided-lab.js', { stdio: 'inherit', cwd: PKG_DIR });
  execSync('npx esbuild src/extensions/guided-lab.ts --bundle --format=esm --outfile=dist/extensions/guided-lab.esm.js', { stdio: 'inherit', cwd: PKG_DIR });
  console.log('✓ Built dist/extensions/guided-lab.js & guided-lab.esm.js');
} catch (e) {
  console.error('Failed to bundle guided-lab extension:', e.message);
}

// 4. Emit TypeScript Declarations (.d.ts)
try {
  execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit', cwd: PKG_DIR });
  console.log('✓ Generated TypeScript declaration files in dist/');
} catch (e) {
  console.warn('tsc warning:', e.message);
}

// 5. Sync dist/ to examples/cloud-ide/public/dist
const CLOUD_IDE_PUBLIC_DIST = path.join(PKG_DIR, 'examples/cloud-ide/public/dist');
if (fs.existsSync(CLOUD_IDE_PUBLIC_DIST)) {
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


