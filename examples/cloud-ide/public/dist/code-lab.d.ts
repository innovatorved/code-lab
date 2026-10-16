/**
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
