/**
 * @innovatorved/code-lab v2.0.0
 * Browser-native IDE, POSIX Shell, Web Worker Node.js/Bun Runtime, and Git Engine.
 */
export * from './schemas';
export * from './runtime';
export { createPosixShell, cloneGitHubRepository, parseGitHubRepoUrl, CodeLabShell } from './shell';
export * from './terminal';
export { guidedLabExtension } from './extensions/guided-lab';
declare const _default: any;
export default _default;
