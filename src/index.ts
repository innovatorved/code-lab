/**
 * @innovatorved/code-lab v0.1.7
 * Browser-native IDE, POSIX Shell, Web Worker Node.js/Bun Runtime, and Git Engine.
 */

export * from './schemas';
export * from './logger';
export { SafeHtml, isSafeHtml, raw, html } from './html';
export * from './csp';
export * from './runtime';
export {
  createPosixShell,
  cloneGitHubRepository,
  parseGitHubRepoUrl,
  CodeLabShell
} from './shell';
export * from './terminal';
export { guidedLabExtension } from './extensions/guided-lab';

import { guidedLabExtension } from './extensions/guided-lab';

declare const globalThis: any;
const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

// Attach extensions to CodeLab SDK
if (root.CodeLab) {
  root.CodeLab.extensions = root.CodeLab.extensions || {};
  root.CodeLab.extensions.guidedLab = guidedLabExtension;
}

export default (root.CodeLab || {});
