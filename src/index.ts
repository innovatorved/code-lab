/**
 * @innovatorved/code-lab v0.2.0
 * Browser-native IDE, POSIX Shell, Web Worker Node.js/Bun Runtime, WASI C++20 Toolchain, and Git Engine.
 */

export * from './schemas';
export * from './logger';
export { SafeHtml, isSafeHtml, raw, html } from './html';
export * from './csp';
export * from './zip';
export {
  type StorageBackendType,
  type ProjectSummary,
  type WorkspaceStorageOptions,
  WorkspaceStorage,
  createWorkspaceStorage
} from './storage';
export {
  type SearchMatchItem,
  type SearchMatchGroup,
  type SearchResult,
  type ReplaceResult,
  escapeRegex,
  normalizeSearchPath,
  matchesGlob,
  searchInFiles,
  replaceInFiles
} from './search';
export {
  type DiagnosticListener,
  DiagnosticsStore,
  createDiagnosticsStore
} from './diagnostics';
export {
  type GitCommitRecord,
  type GitState,
  type GitStatusResult,
  computeShortCommitHash,
  createGitState,
  computeGitStatus,
  stageFile,
  unstageFile,
  commitChanges
} from './scm';
export * from './runtime';
export {
  createPosixShell,
  cloneGitHubRepository,
  parseGitHubRepoUrl,
  CodeLabShell
} from './shell';
export * from './terminal';
export { guidedLabExtension } from './extensions/guided-lab';
export {
  type JavaScriptExtensionOptions,
  javascriptExtension,
  createJavaScriptExtension
} from './extensions/javascript';
export {
  type TypeScriptExtensionOptions,
  typescriptExtension,
  createTypeScriptExtension
} from './extensions/typescript';
export {
  type CppCompileOptions,
  type CppCompileResult,
  type CppCompilerAdapter,
  DEFAULT_CPP_CDN_BASE_URL,
  BUILTIN_CPP_HEADERS,
  extractTarToVfs,
  createTarArchive,
  seedCppHeadersIntoVfs,
  parseCppCompilerFlags,
  CppToolchainManager,
  registerCppCompilerOnRuntime,
  cppExtension,
  createCppExtension
} from './extensions/cpp';

import { guidedLabExtension } from './extensions/guided-lab';
import { javascriptExtension } from './extensions/javascript';
import { typescriptExtension } from './extensions/typescript';
import { cppExtension } from './extensions/cpp';

declare const globalThis: any;
const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

// Attach extensions to CodeLab SDK
if (root.CodeLab) {
  root.CodeLab.extensions = root.CodeLab.extensions || {};
  root.CodeLab.extensions.guidedLab = guidedLabExtension;
  root.CodeLab.extensions.javascript = javascriptExtension;
  root.CodeLab.extensions.typescript = typescriptExtension;
  root.CodeLab.extensions.cpp = cppExtension;
}

export default (root.CodeLab || {});
