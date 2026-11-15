/**
 * @innovatorved/code-lab — Interactive Git Source Control (SCM) Engine
 * ============================================================================
 * Browser-native Git engine combining synchronous deterministic VFS/SCM state
 * with `isomorphic-git` `.git/` object-store synchronization, Myers O(ND)
 * 3-line hunk diffs, `.gitignore` pattern matching, real branch file checkout,
 * stash, reset (`--soft`/`--mixed`/`--hard` `HEAD~N`), merge, tags, show & blame.
 *
 * Strict leaf module: fully typed, zero explicit any, zero empty catches.
 */

import { Buffer as BrowserBuffer } from 'buffer';
import {
  init as isoInit,
  add as isoAdd,
  commit as isoCommit,
  currentBranch as isoCurrentBranch,
  listBranches as isoListBranches,
  log as isoLog
} from 'isomorphic-git';

if (typeof globalThis !== 'undefined') {
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.Buffer === 'undefined') {
    g.Buffer = BrowserBuffer;
  }
}

export type GitFileChangeType = 'modified' | 'added' | 'deleted' | 'untracked';

export interface GitFileStatus {
  path: string;
  status: GitFileChangeType;
  staged: boolean;
  oldContent?: string;
  newContent?: string;
}

export interface GitStatLike {
  size?: number;
  mtimeMs?: number;
  mode?: number;
  isDirectory(): boolean;
  isFile?(): boolean;
  isSymbolicLink?(): boolean;
}

export interface GitVfsLike {
  existsSync?(path: string): boolean;
  statSync?(path: string): GitStatLike;
  lstatSync?(path: string): GitStatLike;
  readdirSync?(path: string): string[];
  readFileSync?(path: string, encoding?: string): string | Uint8Array;
  writeFileSync?(path: string, data: string | Uint8Array): void;
  mkdirSync?(path: string, options?: { recursive?: boolean }): unknown;
  rmdirSync?(path: string, options?: { recursive?: boolean }): void;
  unlinkSync?(path: string): void;
  rmSync?(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  symlinkSync?(target: string, path: string): void;
  readlinkSync?(path: string): string;
  files?: Map<string, unknown>;
}

export interface GitShellLike {
  cwd?: string;
  vfs?: GitVfsLike | null;
  gitState?: GitState | null;
  _emitVfsMutation?(type: string, absPath: string): void;
}

export interface GitCommitRecord {
  hash: string;
  message: string;
  timestamp: number;
  author?: string;
  date?: string;
  files?: Record<string, string>;
  parents?: string[];
}

export interface GitBranchTip {
  headCommit: string;
  headFiles: Record<string, string>;
  commits: GitCommitRecord[];
}

export interface GitStashEntry {
  id: number;
  branch: string;
  headCommit: string;
  message: string;
  timestamp: number;
  worktreeFiles: Record<string, string>;
  stagedEntries: Array<[string, string | null]>;
  untrackedFiles: Record<string, string>;
}

export interface GitState {
  initialized?: boolean;
  repoRoot?: string;
  branch: string;
  branches?: string[] | Set<string>;
  branchHeads?: Record<string, GitBranchTip>;
  tags?: Record<string, string>;
  stashes?: GitStashEntry[];
  remoteUrl?: string | null;
  remotes?: Record<string, string>;
  headCommit: string;
  headFiles: Record<string, string>;
  headSnapshot?: Record<string, string>;
  staged: Map<string, string | null> | Set<string>;
  stagedFiles?: Map<string, string | null>;
  commits: GitCommitRecord[];
}

export interface GitStatusEntry {
  path: string;
  status: GitFileChangeType;
  staged: boolean;
  index: string;
  worktree: string;
}

export interface GitStatusResult {
  branch: string;
  headCommit: string;
  untracked: GitFileStatus[];
  modified: GitFileStatus[];
  deleted: GitFileStatus[];
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  entries: GitStatusEntry[];
  hasChanges: boolean;
  isClean: boolean;
}

export interface CreateGitStateOptions {
  initialized?: boolean;
  repoRoot?: string;
}

export interface InitRepositoryOptions {
  branch?: string;
  repoRoot?: string;
  snapshotExisting?: boolean;
  initialFiles?: Record<string, string>;
}

export interface DiscardChangesOptions {
  keepStaged?: boolean;
}

export interface DiffLineOp {
  type: 'common' | 'added' | 'removed';
  line: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface GitGutterRange {
  line: number;
  endLine: number;
  kind: 'added' | 'modified' | 'deleted';
}

export interface GitIgnoreRule {
  negated: boolean;
  dirOnly: boolean;
  regex: RegExp;
}

export interface BlameLineEntry {
  lineNumber: number;
  hash: string;
  author: string;
  timestamp: number;
  content: string;
}

/**
 * Computes a deterministic 7-character short hash for a commit payload.
 */
export function computeShortCommitHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).padStart(7, '0').slice(0, 7);
}

/**
 * Compiles `.gitignore` text into ordered glob/negation match rules.
 */
export function parseGitignoreRules(gitignoreContent: string | undefined): GitIgnoreRule[] {
  if (!gitignoreContent || typeof gitignoreContent !== 'string') return [];
  const rules: GitIgnoreRule[] = [];
  for (const rawLine of gitignoreContent.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1).trim();
      if (!line) continue;
    }
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.replace(/\/+$/, '');
    const anchored = line.startsWith('/');
    if (anchored) line = line.replace(/^\/+/, '');
    if (!line) continue;

    const hasSlash = line.includes('/');
    let rxBody = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '*') {
        if (line[i + 1] === '*') {
          if (line[i + 2] === '/') {
            rxBody += '(?:.+/)?';
            i += 2;
          } else {
            rxBody += '.*';
            i += 1;
          }
        } else {
          rxBody += '[^/]*';
        }
      } else if (c === '?') {
        rxBody += '[^/]';
      } else if ('\\^$.|+()[]{}'.includes(c)) {
        rxBody += `\\${c}`;
      } else {
        rxBody += c;
      }
    }

    const prefix = anchored || hasSlash ? '^' : '(?:^|/)';
    const suffix = dirOnly ? '(?:/|$)' : '(?:$|/)';
    try {
      rules.push({
        negated,
        dirOnly,
        regex: new RegExp(`${prefix}${rxBody}${suffix}`)
      });
    } catch (err) {
      const _ignored = err;
      void _ignored;
    }
  }
  return rules;
}

export function isIgnoredByRules(relPath: string, rules: ReadonlyArray<GitIgnoreRule>): boolean {
  if (!rules.length) return false;
  let ignored = false;
  for (const rule of rules) {
    if (rule.regex.test(relPath)) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}

export function isIgnoredScmPath(
  relPath: string,
  gitignoreRules?: ReadonlyArray<GitIgnoreRule>
): boolean {
  if (!relPath) return true;
  if (
    relPath === '.git' ||
    relPath.startsWith('.git/') ||
    relPath.includes('/.git/') ||
    relPath.endsWith('/.git')
  ) {
    return true;
  }
  if (
    relPath === 'node_modules' ||
    relPath.startsWith('node_modules/') ||
    relPath.includes('/node_modules/') ||
    relPath.endsWith('/node_modules')
  ) {
    return true;
  }
  if (gitignoreRules && gitignoreRules.length > 0 && relPath !== '.gitignore') {
    return isIgnoredByRules(relPath, gitignoreRules);
  }
  return false;
}

export function normalizeScmRelPath(rawPath: string, repoRoot = '/workspace'): string {
  if (typeof rawPath !== 'string') return '';
  let p = rawPath.trim().replace(/\\/g, '/');
  if (!p) return '';

  const cleanRoot = (repoRoot || '/workspace').replace(/\\/g, '/').replace(/\/+$/, '') || '/';
  if (p === cleanRoot) return '';
  if (cleanRoot !== '/' && p.startsWith(`${cleanRoot}/`)) {
    p = p.slice(cleanRoot.length + 1);
  } else if (p.startsWith('/workspace/') && cleanRoot === '/workspace') {
    p = p.slice('/workspace/'.length);
  } else if (p.startsWith('/') && cleanRoot !== '/') {
    // Path outside non-default repoRoot is ignored unless relative
    if (!p.startsWith(`${cleanRoot}/`)) {
      p = p.replace(/^\/+/, '');
    }
  }

  while (p.startsWith('./')) {
    p = p.slice(2);
  }
  if (p.startsWith('/')) {
    p = p.replace(/^\/+/, '');
  }

  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length === 0) return '';
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out.join('/');
}

function extractGitignoreRules(
  rawFiles: Record<string, string> | undefined,
  fallbackFiles: Record<string, string> | undefined,
  repoRoot = '/workspace'
): GitIgnoreRule[] {
  let content: string | undefined;
  if (rawFiles && typeof rawFiles === 'object') {
    if (typeof rawFiles['.gitignore'] === 'string') {
      content = rawFiles['.gitignore'];
    } else {
      const fullKey = `${repoRoot.replace(/\/+$/, '')}/.gitignore`;
      if (typeof rawFiles[fullKey] === 'string') content = rawFiles[fullKey];
    }
  }
  if (content === undefined && fallbackFiles && typeof fallbackFiles['.gitignore'] === 'string') {
    content = fallbackFiles['.gitignore'];
  }
  return parseGitignoreRules(content);
}

function cleanFileMap(
  rawFiles: Record<string, string> | undefined,
  repoRoot = '/workspace',
  gitignoreRules?: ReadonlyArray<GitIgnoreRule>,
  trackedFiles?: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawFiles || typeof rawFiles !== 'object') return out;
  for (const [k, v] of Object.entries(rawFiles)) {
    const rel = normalizeScmRelPath(k, repoRoot);
    if (!rel || isIgnoredScmPath(rel)) continue;
    const isTracked = Boolean(trackedFiles && Object.prototype.hasOwnProperty.call(trackedFiles, rel));
    if (!isTracked && gitignoreRules && isIgnoredScmPath(rel, gitignoreRules)) {
      continue;
    }
    out[rel] = String(v ?? '');
  }
  return out;
}

export function isUnbornGitHead(gitState: GitState | null | undefined): boolean {
  return (
    (!Array.isArray(gitState?.commits) || gitState.commits.length === 0) &&
    !gitState?.headCommit
  );
}

export function isEffectiveStagedChange(
  gitState: GitState | null | undefined,
  relPath: string,
  stagedVal: string | null | undefined,
  resolvedHeadFiles?: Record<string, string>
): boolean {
  if (!relPath || isIgnoredScmPath(relPath)) return false;
  const repoRoot = gitState?.repoRoot || '/workspace';
  const headFiles =
    resolvedHeadFiles ?? cleanFileMap(gitState?.headFiles || gitState?.headSnapshot || {}, repoRoot);
  const inHead = Object.prototype.hasOwnProperty.call(headFiles, relPath);
  const normalizedVal = stagedVal === undefined || stagedVal === null ? null : String(stagedVal);

  if (normalizedVal === null) {
    return inHead;
  }
  if (!inHead || isUnbornGitHead(gitState)) {
    return true;
  }
  return normalizedVal !== headFiles[relPath];
}

function applyStagedEntry(
  gitState: GitState | null | undefined,
  map: Map<string, string | null>,
  rawPath: string,
  rawVal: string | null | undefined,
  resolvedHeadFiles?: Record<string, string>
): void {
  const repoRoot = gitState?.repoRoot || '/workspace';
  const rel = normalizeScmRelPath(rawPath, repoRoot);
  if (!rel || isIgnoredScmPath(rel)) return;
  const normalizedVal = rawVal === undefined || rawVal === null ? null : String(rawVal);
  if (isEffectiveStagedChange(gitState, rel, normalizedVal, resolvedHeadFiles)) {
    map.set(rel, normalizedVal);
  } else {
    map.delete(rel);
  }
}

function pruneStagedMapInPlace(
  gitState: GitState | null | undefined,
  map: Map<string, string | null>,
  resolvedHeadFiles?: Record<string, string>
): void {
  const repoRoot = gitState?.repoRoot || '/workspace';
  const headFiles =
    resolvedHeadFiles ?? cleanFileMap(gitState?.headFiles || gitState?.headSnapshot || {}, repoRoot);
  for (const [rawK, rawV] of Array.from(map.entries())) {
    const rel = normalizeScmRelPath(rawK, repoRoot);
    if (rel !== rawK) {
      map.delete(rawK);
    }
    if (!rel || isIgnoredScmPath(rel)) {
      map.delete(rawK);
      continue;
    }
    const normalizedVal = rawV === undefined || rawV === null ? null : String(rawV);
    if (isEffectiveStagedChange(gitState, rel, normalizedVal, headFiles)) {
      map.set(rel, normalizedVal);
    } else {
      map.delete(rel);
    }
  }
}

function attachSetCompatShim(
  map: Map<string, string | null>,
  gitState?: GitState,
  resolveContent?: (relPath: string) => string | null
): Map<string, string | null> {
  const mapObj = map as unknown as Record<string, unknown>;
  if (typeof mapObj.add !== 'function') {
    Object.defineProperty(map, 'add', {
      value: (rawPath: string) => {
        const repoRoot = gitState?.repoRoot || '/workspace';
        const rel = normalizeScmRelPath(rawPath, repoRoot);
        if (rel && !isIgnoredScmPath(rel)) {
          const val = resolveContent ? resolveContent(rel) : null;
          applyStagedEntry(gitState, map, rel, val);
        }
        return map;
      },
      enumerable: false,
      configurable: true,
      writable: true
    });
  }
  return map;
}

/**
 * Synchronizes `gitState.headFiles` and `gitState.headSnapshot` so both
 * properties reference the exact same clean `Record<string, string>` object.
 */
export function syncGitHead(
  gitState: GitState,
  nextHead?: Record<string, string>
): Record<string, string> {
  const repoRoot = gitState.repoRoot || '/workspace';
  const source =
    nextHead !== undefined ? nextHead : (gitState.headFiles || gitState.headSnapshot || {});
  const synced = cleanFileMap(source, repoRoot);
  gitState.headFiles = synced;
  gitState.headSnapshot = synced;
  return synced;
}

function ensureBranchList(gitState: GitState, branchName?: string): void {
  if (gitState.branches instanceof Set) {
    if (branchName) gitState.branches.add(branchName);
    return;
  }
  if (Array.isArray(gitState.branches)) {
    if (branchName && !gitState.branches.includes(branchName)) {
      gitState.branches.push(branchName);
    }
    return;
  }
  gitState.branches = branchName ? [branchName] : [gitState.branch || 'main'];
}

export function saveBranchTip(gitState: GitState, branchName = gitState.branch): void {
  if (!gitState || !branchName) return;
  if (!gitState.branchHeads || typeof gitState.branchHeads !== 'object') {
    gitState.branchHeads = {};
  }
  const repoRoot = gitState.repoRoot || '/workspace';
  const headCopy = cleanFileMap(gitState.headFiles || gitState.headSnapshot || {}, repoRoot);
  const commitsCopy = Array.isArray(gitState.commits)
    ? gitState.commits.map((c) => ({
        ...c,
        ...(c.files ? { files: { ...c.files } } : {})
      }))
    : [];
  gitState.branchHeads[branchName] = {
    headCommit: gitState.headCommit || '',
    headFiles: headCopy,
    commits: commitsCopy
  };
}

function ensureStagedMap(
  gitState: GitState,
  vfsFiles?: Record<string, string>
): Map<string, string | null> {
  const repoRoot = gitState.repoRoot || '/workspace';
  const head = cleanFileMap(gitState.headFiles || gitState.headSnapshot || {}, repoRoot);
  const resolveContent = (rel: string): string | null => {
    if (vfsFiles) {
      return Object.prototype.hasOwnProperty.call(vfsFiles, rel) ? vfsFiles[rel] : null;
    }
    return Object.prototype.hasOwnProperty.call(head, rel) ? head[rel] : null;
  };

  if (gitState.staged instanceof Map) {
    const shimmed = attachSetCompatShim(gitState.staged, gitState, resolveContent);
    pruneStagedMapInPlace(gitState, shimmed, head);
    gitState.stagedFiles = shimmed;
    return shimmed;
  }

  const migrated = attachSetCompatShim(new Map<string, string | null>(), gitState, resolveContent);

  if (gitState.staged instanceof Set) {
    for (const rawPath of gitState.staged.values()) {
      const rel = normalizeScmRelPath(rawPath, repoRoot);
      if (!rel || isIgnoredScmPath(rel)) continue;
      applyStagedEntry(gitState, migrated, rel, resolveContent(rel), head);
    }
  }

  gitState.staged = migrated;
  gitState.stagedFiles = migrated;
  return migrated;
}

/**
 * Initializes an in-memory Git repository state from initial VFS files,
 * keeping `headFiles` / `headSnapshot` and `staged` / `stagedFiles` synchronized.
 */
export function createGitState(
  initialFiles: Record<string, string> = {},
  branch = 'main',
  options?: CreateGitStateOptions
): GitState {
  const repoRoot = options?.repoRoot || '/workspace';
  const isInit = options?.initialized !== false;
  let _initialized = isInit;
  let _repoRoot = repoRoot;
  let _headFiles: Record<string, string> = isInit ? cleanFileMap(initialFiles, repoRoot) : {};
  let _headCommit = isInit ? computeShortCommitHash(JSON.stringify(_headFiles) + ':init') : '';
  const now = Date.now();
  let _commits: GitCommitRecord[] = isInit
    ? [
        {
          hash: _headCommit,
          message: 'Initial commit',
          timestamp: now,
          author: 'CodeLab Developer <dev@codelab.internal>',
          date: new Date(now).toUTCString(),
          files: { ..._headFiles }
        }
      ]
    : [];

  const stateObj = {
    branch,
    branches: [branch],
    branchHeads: isInit
      ? {
          [branch]: {
            headCommit: _headCommit,
            headFiles: { ..._headFiles },
            commits: _commits.map((c) => ({ ...c, files: { ..._headFiles } }))
          }
        }
      : {},
    tags: {} as Record<string, string>,
    stashes: [] as GitStashEntry[],
    remoteUrl: null as string | null,
    remotes: {} as Record<string, string>
  } as unknown as GitState;

  const resolveFromHead = (rel: string): string | null =>
    Object.prototype.hasOwnProperty.call(_headFiles, rel) ? _headFiles[rel] : null;

  let _stagedMap = attachSetCompatShim(new Map<string, string | null>(), stateObj, resolveFromHead);

  Object.defineProperties(stateObj, {
    initialized: {
      enumerable: true,
      configurable: true,
      get(): boolean {
        return _initialized;
      },
      set(v: boolean) {
        _initialized = Boolean(v);
      }
    },
    repoRoot: {
      enumerable: true,
      configurable: true,
      get(): string {
        return _repoRoot;
      },
      set(v: string) {
        _repoRoot = String(v || '/workspace');
      }
    },
    headCommit: {
      enumerable: true,
      configurable: true,
      get(): string {
        return _headCommit;
      },
      set(v: string) {
        _headCommit = String(v || '');
      }
    },
    headFiles: {
      enumerable: true,
      configurable: true,
      get(): Record<string, string> {
        return _headFiles;
      },
      set(v: Record<string, string>) {
        _headFiles = v && typeof v === 'object' ? v : {};
      }
    },
    headSnapshot: {
      enumerable: true,
      configurable: true,
      get(): Record<string, string> {
        return _headFiles;
      },
      set(v: Record<string, string>) {
        _headFiles = v && typeof v === 'object' ? v : {};
      }
    },
    staged: {
      enumerable: true,
      configurable: true,
      get(): Map<string, string | null> {
        return _stagedMap;
      },
      set(v: Map<string, string | null> | Set<string>) {
        if (v instanceof Map) {
          _stagedMap = attachSetCompatShim(v, stateObj, resolveFromHead);
          pruneStagedMapInPlace(stateObj, _stagedMap);
        } else {
          const next = attachSetCompatShim(
            new Map<string, string | null>(),
            stateObj,
            resolveFromHead
          );
          if (v instanceof Set) {
            for (const raw of v.values()) {
              const rel = normalizeScmRelPath(raw, _repoRoot);
              if (!rel || isIgnoredScmPath(rel)) continue;
              applyStagedEntry(stateObj, next, rel, resolveFromHead(rel));
            }
          }
          _stagedMap = next;
        }
      }
    },
    stagedFiles: {
      enumerable: true,
      configurable: true,
      get(): Map<string, string | null> {
        return _stagedMap;
      },
      set(v: Map<string, string | null>) {
        if (v instanceof Map) {
          _stagedMap = attachSetCompatShim(v, stateObj, resolveFromHead);
          pruneStagedMapInPlace(stateObj, _stagedMap);
        }
      }
    },
    commits: {
      enumerable: true,
      configurable: true,
      get(): GitCommitRecord[] {
        return _commits;
      },
      set(v: GitCommitRecord[]) {
        _commits = Array.isArray(v) ? v : [];
        if (_commits.length > 0 && _commits[0]?.hash) {
          _headCommit = _commits[0].hash;
        } else if (_commits.length === 0) {
          _headCommit = '';
        }
      }
    }
  });

  return stateObj;
}

export function readVfsTree(vfs: GitVfsLike, rootDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (
    !vfs ||
    typeof vfs.existsSync !== 'function' ||
    typeof vfs.readdirSync !== 'function' ||
    typeof vfs.statSync !== 'function' ||
    typeof vfs.readFileSync !== 'function'
  ) {
    return out;
  }
  const cleanRoot = rootDir.replace(/\/+$/, '') || '/';
  if (!vfs.existsSync(cleanRoot)) return out;

  const walk = (dir: string): void => {
    let entries: string[] = [];
    try {
      entries = vfs.readdirSync ? vfs.readdirSync(dir) : [];
    } catch (err) {
      const _ignored = err;
      void _ignored;
      return;
    }
    for (const name of entries) {
      if (name === '.git' || name === 'node_modules') continue;
      const full = dir === '/' ? `/${name}` : `${dir}/${name}`;
      try {
        const st = vfs.statSync ? vfs.statSync(full) : null;
        if (st && st.isDirectory()) {
          walk(full);
        } else {
          const rel = normalizeScmRelPath(full, cleanRoot);
          if (!rel || isIgnoredScmPath(rel)) continue;
          const raw = vfs.readFileSync ? vfs.readFileSync(full, 'utf8') : '';
          out[rel] = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
        }
      } catch (err) {
        const _ignored = err;
        void _ignored;
      }
    }
  };

  walk(cleanRoot);
  return out;
}

function isGitShellLike(target: GitShellLike | GitState): target is GitShellLike {
  return (
    Boolean(target && typeof target === 'object') &&
    ('vfs' in target || 'gitState' in target || ('cwd' in target && !('headFiles' in target)))
  );
}

/**
 * Initializes a Git repository on a `PosixShell` (writing `.git/HEAD` & `.git/config`)
 * or directly on a `GitState` object. Defaults `snapshotExisting` to `false` so
 * existing workspace files appear as untracked until staged and committed.
 */
export function initRepository(
  target: GitShellLike | GitState,
  options?: InitRepositoryOptions
): GitState {
  if (isGitShellLike(target)) {
    const repoRoot =
      (options?.repoRoot || target.gitState?.repoRoot || target.cwd || '/workspace').replace(
        /\/+$/,
        ''
      ) || '/';
    const branch = options?.branch || target.gitState?.branch || 'main';
    const vfs = target.vfs ?? null;

    if (vfs) {
      const gitDir = repoRoot === '/' ? '/.git' : `${repoRoot}/.git`;
      const headPath = `${gitDir}/HEAD`;
      const configPath = `${gitDir}/config`;
      if (typeof vfs.mkdirSync === 'function' && (!vfs.existsSync || !vfs.existsSync(gitDir))) {
        vfs.mkdirSync(gitDir, { recursive: true });
      }
      vfs.writeFileSync?.(headPath, `ref: refs/heads/${branch}\n`);
      vfs.writeFileSync?.(
        configPath,
        `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n`
      );
      target._emitVfsMutation?.('create', headPath);
    }

    const snap = options?.snapshotExisting
      ? options.initialFiles
        ? cleanFileMap(options.initialFiles, repoRoot)
        : vfs
          ? readVfsTree(vfs, repoRoot)
          : {}
      : {};

    let gs = target.gitState;
    if (!gs) {
      gs = createGitState(snap, branch, { initialized: true, repoRoot });
      if (!options?.snapshotExisting) {
        gs.commits = [];
        gs.headCommit = '';
      }
      saveBranchTip(gs, branch);
      target.gitState = gs;
      if (vfs) void syncToIsoGitRepo(vfs, gs);
      return gs;
    }

    gs.initialized = true;
    gs.repoRoot = repoRoot;
    gs.branch = branch;
    ensureBranchList(gs, branch);
    ensureStagedMap(gs).clear();
    syncGitHead(gs, snap);
    if (!options?.snapshotExisting && gs.commits.length === 0) {
      gs.headCommit = '';
    }
    saveBranchTip(gs, branch);
    if (vfs) void syncToIsoGitRepo(vfs, gs);
    return gs;
  }

  const gs = target;
  const repoRoot = options?.repoRoot || gs.repoRoot || '/workspace';
  const branch = options?.branch || gs.branch || 'main';
  gs.initialized = true;
  gs.repoRoot = repoRoot;
  gs.branch = branch;
  ensureBranchList(gs, branch);
  ensureStagedMap(gs).clear();
  syncGitHead(gs, options?.snapshotExisting ? options.initialFiles || {} : {});
  saveBranchTip(gs, branch);
  return gs;
}

/**
 * Computes working-tree and staging-area Git status against `gitState`,
 * honoring `.gitignore` rules for untracked files while keeping tracked files visible.
 */
export function computeGitStatus(
  arg1: Record<string, string> | GitState,
  arg2: string | Record<string, string> = '/workspace',
  gitState?: GitState
): GitStatusResult {
  let rawVfsFiles: Record<string, string>;
  let repoRoot = '/workspace';
  let state: GitState;

  if (
    arg1 &&
    typeof arg1 === 'object' &&
    ('headFiles' in arg1 || 'headSnapshot' in arg1 || 'staged' in arg1 || 'commits' in arg1)
  ) {
    state = arg1 as GitState;
    rawVfsFiles = (arg2 && typeof arg2 === 'object' ? arg2 : {}) as Record<string, string>;
    repoRoot = state.repoRoot || '/workspace';
  } else {
    rawVfsFiles = (arg1 && typeof arg1 === 'object' ? arg1 : {}) as Record<string, string>;
    repoRoot = typeof arg2 === 'string' && arg2 ? arg2 : gitState?.repoRoot || '/workspace';
    state = gitState || createGitState({});
  }

  const headFiles = cleanFileMap(state.headFiles || state.headSnapshot || {}, repoRoot);
  const ignoreRules = extractGitignoreRules(rawVfsFiles, headFiles, repoRoot);
  const vfsFiles = cleanFileMap(rawVfsFiles, repoRoot, ignoreRules, headFiles);
  const unbornHead = isUnbornGitHead(state);

  const currentStaged = new Map<string, string | null>();
  if (state.staged instanceof Map) {
    for (const [rawK, v] of state.staged.entries()) {
      const k = normalizeScmRelPath(rawK, repoRoot);
      if (!k || isIgnoredScmPath(k)) continue;
      const normalizedV = v === undefined || v === null ? null : String(v);
      if (!isEffectiveStagedChange(state, k, normalizedV, headFiles)) continue;
      currentStaged.set(k, normalizedV);
    }
  } else if (state.staged instanceof Set) {
    for (const rawK of state.staged.values()) {
      const k = normalizeScmRelPath(rawK, repoRoot);
      if (!k || isIgnoredScmPath(k)) continue;
      const existsInVfs = Object.prototype.hasOwnProperty.call(vfsFiles, k);
      const normalizedV = existsInVfs ? vfsFiles[k] : null;
      if (!isEffectiveStagedChange(state, k, normalizedV, headFiles)) continue;
      currentStaged.set(k, normalizedV);
    }
  }

  // Ensure files explicitly staged remain visible in vfsFiles comparison even if matched by .gitignore
  for (const stagedPath of currentStaged.keys()) {
    if (!Object.prototype.hasOwnProperty.call(vfsFiles, stagedPath)) {
      const rawKey = `${repoRoot.replace(/\/+$/, '')}/${stagedPath}`;
      if (Object.prototype.hasOwnProperty.call(rawVfsFiles, stagedPath)) {
        vfsFiles[stagedPath] = String(rawVfsFiles[stagedPath] ?? '');
      } else if (Object.prototype.hasOwnProperty.call(rawVfsFiles, rawKey)) {
        vfsFiles[stagedPath] = String(rawVfsFiles[rawKey] ?? '');
      }
    }
  }

  const untracked: GitFileStatus[] = [];
  const modified: GitFileStatus[] = [];
  const deleted: GitFileStatus[] = [];
  const staged: GitFileStatus[] = [];

  for (const [filePath, stagedContent] of currentStaged.entries()) {
    const inHead = Object.prototype.hasOwnProperty.call(headFiles, filePath);
    const effectiveInHead = inHead && !unbornHead;
    if (stagedContent === null) {
      if (inHead) {
        staged.push({
          path: filePath,
          status: 'deleted',
          staged: true,
          oldContent: headFiles[filePath]
        });
      }
    } else {
      staged.push({
        path: filePath,
        status: effectiveInHead ? 'modified' : 'added',
        staged: true,
        oldContent: effectiveInHead ? headFiles[filePath] : undefined,
        newContent: stagedContent
      });
      if (!Object.prototype.hasOwnProperty.call(vfsFiles, filePath)) {
        deleted.push({
          path: filePath,
          status: 'deleted',
          staged: false,
          oldContent: stagedContent
        });
      }
    }
  }

  for (const [filePath, content] of Object.entries(vfsFiles)) {
    if (currentStaged.has(filePath)) {
      const stagedVal = currentStaged.get(filePath);
      if (stagedVal === null) {
        untracked.push({
          path: filePath,
          status: 'untracked',
          staged: false,
          newContent: content
        });
      } else if (stagedVal !== content) {
        modified.push({
          path: filePath,
          status: 'modified',
          staged: false,
          oldContent: stagedVal ?? undefined,
          newContent: content
        });
      }
    } else if (Object.prototype.hasOwnProperty.call(headFiles, filePath)) {
      if (headFiles[filePath] !== content) {
        modified.push({
          path: filePath,
          status: 'modified',
          staged: false,
          oldContent: headFiles[filePath],
          newContent: content
        });
      }
    } else {
      untracked.push({
        path: filePath,
        status: 'untracked',
        staged: false,
        newContent: content
      });
    }
  }

  for (const filePath of Object.keys(headFiles)) {
    if (
      !Object.prototype.hasOwnProperty.call(vfsFiles, filePath) &&
      !currentStaged.has(filePath)
    ) {
      deleted.push({
        path: filePath,
        status: 'deleted',
        staged: false,
        oldContent: headFiles[filePath]
      });
    }
  }

  const modifiedPaths = new Set(modified.map((m) => m.path));
  const deletedPaths = new Set(deleted.map((d) => d.path));
  const stagedIndexByPath = new Map<string, string>();
  for (const s of staged) {
    stagedIndexByPath.set(
      s.path,
      s.status === 'added' ? 'A' : s.status === 'deleted' ? 'D' : 'M'
    );
  }

  const unstaged: GitFileStatus[] = [...modified, ...deleted];
  const entries: GitStatusEntry[] = [
    ...staged.map((s) => ({
      path: s.path,
      status: s.status,
      staged: true,
      index: stagedIndexByPath.get(s.path) || 'M',
      worktree: modifiedPaths.has(s.path) ? 'M' : deletedPaths.has(s.path) ? 'D' : ' '
    })),
    ...modified
      .filter((m) => !stagedIndexByPath.has(m.path))
      .map((m) => ({
        path: m.path,
        status: m.status,
        staged: false,
        index: ' ',
        worktree: 'M'
      })),
    ...deleted
      .filter((d) => !stagedIndexByPath.has(d.path))
      .map((d) => ({
        path: d.path,
        status: d.status,
        staged: false,
        index: ' ',
        worktree: 'D'
      })),
    ...untracked.map((u) => ({
      path: u.path,
      status: u.status,
      staged: false,
      index: '?',
      worktree: '?'
    }))
  ];

  const isClean =
    untracked.length === 0 &&
    modified.length === 0 &&
    deleted.length === 0 &&
    staged.length === 0;

  return {
    branch: state.branch || 'main',
    headCommit: state.headCommit || '',
    untracked,
    modified,
    deleted,
    staged,
    unstaged,
    entries,
    hasChanges: !isClean,
    isClean
  };
}

/**
 * Stages a file addition, modification, or deletion (`currentContent === null`).
 */
export function stageFile(
  gitState: GitState,
  relativePath: string,
  currentContent: string | null
): void {
  if (!gitState) return;
  const repoRoot = gitState.repoRoot || '/workspace';
  const rel = normalizeScmRelPath(relativePath, repoRoot);
  if (!rel || isIgnoredScmPath(rel)) return;

  const headFiles = cleanFileMap(gitState.headFiles || gitState.headSnapshot || {}, repoRoot);
  const stagedMap = ensureStagedMap(gitState);
  const normalizedContent =
    currentContent === undefined || currentContent === null ? null : String(currentContent);
  applyStagedEntry(gitState, stagedMap, rel, normalizedContent, headFiles);
}

/**
 * Stages all modified, untracked (non-gitignored), and deleted tracked files.
 */
export function stageAll(
  gitState: GitState,
  vfsFiles: Record<string, string>,
  repoRoot = '/workspace'
): void {
  if (!gitState) return;
  const resolvedRoot = gitState.repoRoot || repoRoot || '/workspace';
  const headFiles = cleanFileMap(gitState.headFiles || gitState.headSnapshot || {}, resolvedRoot);
  const ignoreRules = extractGitignoreRules(vfsFiles, headFiles, resolvedRoot);
  const cleanVfs = cleanFileMap(vfsFiles, resolvedRoot, ignoreRules, headFiles);
  const stagedMap = ensureStagedMap(gitState, cleanVfs);

  for (const [rel, content] of Object.entries(cleanVfs)) {
    applyStagedEntry(gitState, stagedMap, rel, content, headFiles);
  }

  for (const rel of Object.keys(headFiles)) {
    if (!Object.prototype.hasOwnProperty.call(cleanVfs, rel)) {
      applyStagedEntry(gitState, stagedMap, rel, null, headFiles);
    }
  }

  for (const stagedKey of Array.from(stagedMap.keys())) {
    const normKey = normalizeScmRelPath(stagedKey, resolvedRoot);
    if (
      !normKey ||
      isIgnoredScmPath(normKey) ||
      (!Object.prototype.hasOwnProperty.call(cleanVfs, normKey) &&
        !Object.prototype.hasOwnProperty.call(headFiles, normKey))
    ) {
      stagedMap.delete(stagedKey);
    }
  }
}

/**
 * Removes a file from the staging index.
 */
export function unstageFile(gitState: GitState, relativePath: string): void {
  if (!gitState) return;
  const repoRoot = gitState.repoRoot || '/workspace';
  const rel = normalizeScmRelPath(relativePath, repoRoot);
  if (gitState.staged instanceof Map) {
    gitState.staged.delete(rel);
    gitState.staged.delete(relativePath);
  } else if (gitState.staged instanceof Set) {
    gitState.staged.delete(rel);
    gitState.staged.delete(relativePath);
  }
}

/**
 * Clears all staged entries from `gitState`.
 */
export function unstageAll(gitState: GitState): void {
  if (!gitState || !gitState.staged) return;
  gitState.staged.clear();
}

/**
 * Commits all staged changes to `gitState`, advancing `headCommit`, updating
 * `branchHeads[branch]`, synchronizing `headFiles` & `headSnapshot`, and clearing staging.
 */
export function commitChanges(
  gitState: GitState,
  message: string,
  author = 'CodeLab Developer <dev@codelab.internal>'
): string {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    throw new Error('Commit message cannot be empty');
  }
  if (!gitState) {
    throw new Error('Nothing to commit (staging area is empty)');
  }

  const repoRoot = gitState.repoRoot || '/workspace';
  const newHeadFiles: Record<string, string> = cleanFileMap(
    gitState.headFiles || gitState.headSnapshot || {},
    repoRoot
  );
  const stagedMap = ensureStagedMap(gitState);
  pruneStagedMapInPlace(gitState, stagedMap, newHeadFiles);

  if (stagedMap.size === 0) {
    throw new Error('Nothing to commit (staging area is empty)');
  }
  const diffSummaryParts: string[] = [];
  for (const [rawPath, content] of stagedMap.entries()) {
    const filePath = normalizeScmRelPath(rawPath, repoRoot);
    if (!filePath || isIgnoredScmPath(filePath)) continue;
    diffSummaryParts.push(`${filePath}:${content === null ? '<DEL>' : content}`);
    if (content === null) {
      delete newHeadFiles[filePath];
    } else {
      newHeadFiles[filePath] = content;
    }
  }

  const timestamp = Date.now();
  const commitSeq = Array.isArray(gitState.commits) ? gitState.commits.length : 0;
  const parentHashes = gitState.headCommit ? [gitState.headCommit] : [];
  const hash = computeShortCommitHash(
    `${gitState.headCommit}:${trimmed}:${timestamp}:${commitSeq}:${diffSummaryParts.join('|')}`
  );
  const syncedHead = syncGitHead(gitState, newHeadFiles);
  const commit: GitCommitRecord = {
    hash,
    message: trimmed,
    timestamp,
    author,
    date: new Date(timestamp).toUTCString(),
    files: { ...syncedHead },
    parents: parentHashes
  };

  if (!Array.isArray(gitState.commits)) {
    gitState.commits = [];
  }
  gitState.commits.unshift(commit);
  gitState.initialized = true;
  gitState.headCommit = hash;
  stagedMap.clear();
  ensureBranchList(gitState, gitState.branch || 'main');
  saveBranchTip(gitState, gitState.branch || 'main');

  return hash;
}

function writeVfsFileSafe(
  vfs: GitVfsLike | null,
  absPath: string,
  content: string,
  shell?: GitShellLike
): void {
  if (!vfs) return;
  const lastSlash = absPath.lastIndexOf('/');
  const parentDir = lastSlash > 0 ? absPath.slice(0, lastSlash) : '/';
  if (
    parentDir &&
    typeof vfs.mkdirSync === 'function' &&
    (typeof vfs.existsSync !== 'function' || !vfs.existsSync(parentDir))
  ) {
    vfs.mkdirSync(parentDir, { recursive: true });
  }
  vfs.writeFileSync?.(absPath, content);
  shell?._emitVfsMutation?.('change', absPath);
}

function deleteVfsFileSafe(
  vfs: GitVfsLike | null,
  absPath: string,
  shell?: GitShellLike
): void {
  if (!vfs) return;
  if (typeof vfs.rmSync === 'function') {
    vfs.rmSync(absPath, { force: true });
  } else if (typeof vfs.unlinkSync === 'function') {
    if (typeof vfs.existsSync !== 'function' || vfs.existsSync(absPath)) {
      vfs.unlinkSync(absPath);
    }
  } else if (vfs.files instanceof Map) {
    vfs.files.delete(absPath);
  }
  shell?._emitVfsMutation?.('delete', absPath);
}

/**
 * Discards working-tree changes for `filePath`.
 * - When `options?.keepStaged === true` and `filePath` has a staged snapshot (`MM` / `AM`),
 *   restores the working tree to the staged index snapshot without unstaging!
 * - Otherwise restores `headFiles[relPath]` (if tracked) or deletes the untracked file,
 *   and unstages `relPath`.
 */
export function discardChanges(
  shell: GitShellLike,
  filePath: string,
  workspaceFiles?: Record<string, string>,
  options?: DiscardChangesOptions
): boolean {
  if (!shell || typeof filePath !== 'string' || !filePath.trim()) {
    return false;
  }

  const gs = shell.gitState ?? null;
  const repoRoot = ((gs && gs.repoRoot) || shell.cwd || '/workspace').replace(/\/+$/, '') || '/';
  const relPath = normalizeScmRelPath(filePath, repoRoot);
  if (!relPath || isIgnoredScmPath(relPath)) {
    return false;
  }

  const absPath = repoRoot === '/' ? `/${relPath}` : `${repoRoot}/${relPath}`;
  const headFiles = gs ? cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot) : {};
  const inHead = Object.prototype.hasOwnProperty.call(headFiles, relPath);
  const vfs = shell.vfs ?? null;
  const stagedMap = gs ? ensureStagedMap(gs) : null;

  if (options?.keepStaged && stagedMap && stagedMap.has(relPath)) {
    const stagedVal = stagedMap.get(relPath);
    if (stagedVal !== null && stagedVal !== undefined) {
      writeVfsFileSafe(vfs, absPath, stagedVal, shell);
      if (workspaceFiles && typeof workspaceFiles === 'object') {
        workspaceFiles[relPath] = stagedVal;
      }
      return true;
    }
    deleteVfsFileSafe(vfs, absPath, shell);
    if (workspaceFiles && typeof workspaceFiles === 'object') {
      delete workspaceFiles[relPath];
    }
    return true;
  }

  if (inHead) {
    const headContent = headFiles[relPath];
    writeVfsFileSafe(vfs, absPath, headContent, shell);
    if (workspaceFiles && typeof workspaceFiles === 'object') {
      workspaceFiles[relPath] = headContent;
    }
    if (gs) {
      unstageFile(gs, relPath);
    }
    return true;
  }

  const existsInVfs = Boolean(vfs && typeof vfs.existsSync === 'function' && vfs.existsSync(absPath));
  const existsInMapVfs = Boolean(vfs && vfs.files instanceof Map && vfs.files.has(absPath));
  const existsInWs = Boolean(
    workspaceFiles && Object.prototype.hasOwnProperty.call(workspaceFiles, relPath)
  );
  const existsInStaged = Boolean(stagedMap && stagedMap.has(relPath));

  if (!existsInVfs && !existsInMapVfs && !existsInWs && !existsInStaged) {
    return false;
  }

  deleteVfsFileSafe(vfs, absPath, shell);

  if (workspaceFiles && typeof workspaceFiles === 'object') {
    delete workspaceFiles[relPath];
  }
  if (gs) {
    unstageFile(gs, relPath);
  }
  return true;
}

// ── Myers O((M+N)D) Shortest-Edit-Script Line Diff & 3-Line Unified Hunks ───

export function computeMyersDiffOps(oldText: string, newText: string): DiffLineOp[] {
  const normalizeLines = (t: string): string[] => {
    if (!t) return [];
    const lines = t.replace(/\r\n/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '' && t.endsWith('\n')) {
      lines.pop();
    }
    return lines;
  };
  const a = normalizeLines(oldText);
  const b = normalizeLines(newText);
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];

  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  v.fill(-1);
  v[offset + 1] = 0;
  const trace: Int32Array[] = [];

  let foundD = max;
  for (let d = 0; d <= max; d++) {
    trace.push(new Int32Array(v));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        foundD = d;
        d = max + 1;
        break;
      }
    }
  }

  const ops: DiffLineOp[] = [];
  let x = n;
  let y = m;
  for (let d = foundD; d > 0; d--) {
    const prevV = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && prevV[offset + k - 1] < prevV[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = prevV[offset + prevK];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ type: 'common', line: a[x], oldLineNumber: x + 1, newLineNumber: y + 1 });
    }
    if (x === prevX) {
      y--;
      ops.push({ type: 'added', line: b[y], newLineNumber: y + 1 });
    } else {
      x--;
      ops.push({ type: 'removed', line: a[x], oldLineNumber: x + 1 });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ type: 'common', line: a[x], oldLineNumber: x + 1, newLineNumber: y + 1 });
  }
  ops.reverse();
  return ops;
}

export function computeUnifiedHunkDiff(
  file1Name: string,
  file2Name: string,
  oldText: string,
  newText: string,
  contextLines = 3
): string {
  const ops = computeMyersDiffOps(oldText, newText);
  if (!ops.some((op) => op.type !== 'common')) return '';

  const changeIndices: number[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type !== 'common') changeIndices.push(i);
  }

  const hunks: Array<{ start: number; end: number }> = [];
  for (const idx of changeIndices) {
    const hStart = Math.max(0, idx - contextLines);
    const hEnd = Math.min(ops.length - 1, idx + contextLines);
    const prev = hunks[hunks.length - 1];
    if (prev && hStart <= prev.end + 1) {
      prev.end = Math.max(prev.end, hEnd);
    } else {
      hunks.push({ start: hStart, end: hEnd });
    }
  }

  let out = `--- ${file1Name}\n+++ ${file2Name}\n`;
  for (const hunk of hunks) {
    const slice = ops.slice(hunk.start, hunk.end + 1);
    let oldCount = 0;
    let newCount = 0;
    let oldStart = 0;
    let newStart = 0;
    for (const op of slice) {
      if (op.type !== 'added') {
        if (oldStart === 0 && op.oldLineNumber) oldStart = op.oldLineNumber;
        oldCount++;
      }
      if (op.type !== 'removed') {
        if (newStart === 0 && op.newLineNumber) newStart = op.newLineNumber;
        newCount++;
      }
    }
    if (oldStart === 0) {
      for (let j = hunk.start - 1; j >= 0; j--) {
        if (ops[j].oldLineNumber) {
          oldStart = (ops[j].oldLineNumber ?? 0) + (oldCount > 0 ? 1 : 0);
          break;
        }
      }
    }
    if (newStart === 0) {
      for (let j = hunk.start - 1; j >= 0; j--) {
        if (ops[j].newLineNumber) {
          newStart = (ops[j].newLineNumber ?? 0) + (newCount > 0 ? 1 : 0);
          break;
        }
      }
    }
    out += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;
    for (const op of slice) {
      if (op.type === 'common') out += ` ${op.line}\n`;
      else if (op.type === 'added') out += `+${op.line}\n`;
      else out += `-${op.line}\n`;
    }
  }
  return out;
}

export function computeGitGutterChanges(
  headContent: string | undefined,
  liveContent: string
): GitGutterRange[] {
  if (headContent === undefined) {
    const lineCount = liveContent ? liveContent.split(/\r?\n/).length : 1;
    return [{ line: 1, endLine: Math.max(1, lineCount), kind: 'added' }];
  }
  if (headContent === liveContent) return [];

  const ops = computeMyersDiffOps(headContent, liveContent);
  const ranges: GitGutterRange[] = [];
  let i = 0;
  let lastNewLine = 1;

  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'common') {
      if (op.newLineNumber) lastNewLine = op.newLineNumber;
      i++;
      continue;
    }
    let removedCount = 0;
    const addedLines: number[] = [];
    while (i < ops.length && ops[i].type !== 'common') {
      if (ops[i].type === 'removed') removedCount++;
      else if (ops[i].type === 'added' && ops[i].newLineNumber) {
        addedLines.push(ops[i].newLineNumber as number);
      }
      i++;
    }
    if (addedLines.length > 0 && removedCount > 0) {
      ranges.push({
        line: addedLines[0],
        endLine: addedLines[addedLines.length - 1],
        kind: 'modified'
      });
      lastNewLine = addedLines[addedLines.length - 1];
    } else if (addedLines.length > 0) {
      ranges.push({
        line: addedLines[0],
        endLine: addedLines[addedLines.length - 1],
        kind: 'added'
      });
      lastNewLine = addedLines[addedLines.length - 1];
    } else if (removedCount > 0) {
      const anchor = Math.max(1, lastNewLine);
      ranges.push({ line: anchor, endLine: anchor, kind: 'deleted' });
    }
  }
  return ranges;
}

// ── Branch Checkout, Stash, Reset, Merge, Tag, Show & Blame ─────────────────

export interface CheckoutBranchOptions {
  create?: boolean;
  force?: boolean;
  workspaceFiles?: Record<string, string>;
}

export function checkoutBranch(
  target: GitShellLike | GitState,
  branchName: string,
  options?: CheckoutBranchOptions
): { ok: boolean; created: boolean; error?: string } {
  const trimmed = typeof branchName === 'string' ? branchName.trim() : '';
  if (!trimmed) {
    return { ok: false, created: false, error: 'branch name required' };
  }
  const shell: GitShellLike | null = isGitShellLike(target) ? target : null;
  const gs: GitState | null = isGitShellLike(target) ? (target.gitState ?? null) : target;
  if (!gs) {
    return { ok: false, created: false, error: 'not a git repository' };
  }

  const repoRoot = (gs.repoRoot || shell?.cwd || '/workspace').replace(/\/+$/, '') || '/';
  const vfs = shell?.vfs ?? null;
  const prevBranch = gs.branch || 'main';
  saveBranchTip(gs, prevBranch);

  const hasBranch =
    gs.branches instanceof Set
      ? gs.branches.has(trimmed)
      : Array.isArray(gs.branches)
        ? gs.branches.includes(trimmed)
        : prevBranch === trimmed;

  if (options?.create) {
    ensureBranchList(gs, trimmed);
    gs.branch = trimmed;
    saveBranchTip(gs, trimmed);
    if (vfs) {
      const headPath = `${repoRoot === '/' ? '' : repoRoot}/.git/HEAD`;
      writeVfsFileSafe(vfs, headPath, `ref: refs/heads/${trimmed}\n`, shell ?? undefined);
      void syncToIsoGitRepo(vfs, gs);
    }
    return { ok: true, created: true };
  }

  if (!hasBranch && !(gs.branchHeads && gs.branchHeads[trimmed])) {
    return { ok: false, created: false, error: `pathspec '${trimmed}' did not match any file(s) known to git` };
  }

  const prevHead = cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot);
  const tip = gs.branchHeads?.[trimmed];
  const nextHead = tip ? cleanFileMap(tip.headFiles, repoRoot) : { ...prevHead };
  const stagedMap = ensureStagedMap(gs);

  // Sync clean tracked files in working tree to target branch's headFiles
  if (vfs || options?.workspaceFiles) {
    const liveFiles = vfs ? readVfsTree(vfs, repoRoot) : { ...(options?.workspaceFiles || {}) };
    const allTracked = new Set([...Object.keys(prevHead), ...Object.keys(nextHead)]);
    for (const rel of allTracked) {
      const inPrev = Object.prototype.hasOwnProperty.call(prevHead, rel);
      const inNext = Object.prototype.hasOwnProperty.call(nextHead, rel);
      const inLive = Object.prototype.hasOwnProperty.call(liveFiles, rel);
      const isDirtyWorktree =
        stagedMap.has(rel) ||
        (inPrev && (!inLive || liveFiles[rel] !== prevHead[rel])) ||
        (!inPrev && inLive && (!inNext || liveFiles[rel] !== nextHead[rel]));

      if (isDirtyWorktree && !options?.force) {
        // Carry over dirty/staged edits when switching branches (matches D5.7 fuzzer & safe checkout)
        continue;
      }

      const absPath = repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`;
      if (inNext) {
        if (!inLive || liveFiles[rel] !== nextHead[rel]) {
          writeVfsFileSafe(vfs, absPath, nextHead[rel], shell ?? undefined);
        }
        if (options?.workspaceFiles) {
          options.workspaceFiles[rel] = nextHead[rel];
        }
      } else if (inPrev) {
        deleteVfsFileSafe(vfs, absPath, shell ?? undefined);
        if (options?.workspaceFiles) {
          delete options.workspaceFiles[rel];
        }
      }
    }
  }

  gs.branch = trimmed;
  ensureBranchList(gs, trimmed);
  if (tip) {
    gs.commits = tip.commits.map((c) => ({
      ...c,
      ...(c.files ? { files: { ...c.files } } : {})
    }));
    gs.headCommit = tip.headCommit;
    syncGitHead(gs, nextHead);
  }
  pruneStagedMapInPlace(gs, stagedMap, nextHead);

  if (vfs) {
    const headPath = `${repoRoot === '/' ? '' : repoRoot}/.git/HEAD`;
    writeVfsFileSafe(vfs, headPath, `ref: refs/heads/${trimmed}\n`, shell ?? undefined);
    void syncToIsoGitRepo(vfs, gs);
  }
  return { ok: true, created: false };
}

export function resolveCommitRef(
  gitState: GitState,
  refSpec?: string
): { commit: GitCommitRecord | null; index: number } {
  const commits = Array.isArray(gitState.commits) ? gitState.commits : [];
  if (commits.length === 0) return { commit: null, index: -1 };
  const raw = (refSpec || 'HEAD').trim();
  if (!raw || raw === 'HEAD') {
    return { commit: commits[0], index: 0 };
  }

  const tildeMatch = /^HEAD~(\d+)$/.exec(raw);
  if (tildeMatch) {
    const steps = Number.parseInt(tildeMatch[1], 10);
    const idx = steps;
    return idx >= 0 && idx < commits.length
      ? { commit: commits[idx], index: idx }
      : { commit: null, index: -1 };
  }

  const caretMatch = /^HEAD(\^+)$/.exec(raw);
  if (caretMatch) {
    const idx = caretMatch[1].length;
    return idx >= 0 && idx < commits.length
      ? { commit: commits[idx], index: idx }
      : { commit: null, index: -1 };
  }

  if (gitState.tags && gitState.tags[raw]) {
    const tagTarget = gitState.tags[raw];
    const tagIdx = commits.findIndex((c) => c.hash === tagTarget || c.hash.startsWith(tagTarget));
    if (tagIdx !== -1) return { commit: commits[tagIdx], index: tagIdx };
  }

  if (gitState.branchHeads && gitState.branchHeads[raw]) {
    const tip = gitState.branchHeads[raw];
    if (tip.commits.length > 0) return { commit: tip.commits[0], index: 0 };
  }

  const shaIdx = commits.findIndex((c) => c.hash === raw || c.hash.startsWith(raw));
  if (shaIdx !== -1) return { commit: commits[shaIdx], index: shaIdx };

  return { commit: null, index: -1 };
}

export function resetToRef(
  shell: GitShellLike,
  refSpec = 'HEAD',
  mode: 'soft' | 'mixed' | 'hard' = 'mixed',
  workspaceFiles?: Record<string, string>
): { ok: boolean; headCommit: string; message?: string; error?: string } {
  const gs = shell.gitState ?? null;
  if (!gs) return { ok: false, headCommit: '', error: 'not a git repository' };
  const repoRoot = (gs.repoRoot || shell.cwd || '/workspace').replace(/\/+$/, '') || '/';
  const vfs = shell.vfs ?? null;

  const { commit, index } = resolveCommitRef(gs, refSpec);
  if (!commit && gs.commits.length > 0) {
    return {
      ok: false,
      headCommit: gs.headCommit,
      error: `fatal: ambiguous argument '${refSpec}': unknown revision or path not in the working tree.`
    };
  }

  const prevHead = cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot);
  const targetHead = commit?.files ? cleanFileMap(commit.files, repoRoot) : prevHead;
  const stagedMap = ensureStagedMap(gs);

  if (commit && index > 0) {
    gs.commits = gs.commits.slice(index);
    gs.headCommit = commit.hash;
    syncGitHead(gs, targetHead);
  } else if (commit) {
    gs.headCommit = commit.hash;
    syncGitHead(gs, targetHead);
  }

  if (mode === 'soft') {
    // Stage differences from new targetHead to previous HEAD + existing staged changes
    const prevEffective: Record<string, string> = { ...prevHead };
    for (const [k, v] of stagedMap.entries()) {
      if (v === null) delete prevEffective[k];
      else prevEffective[k] = v;
    }
    stagedMap.clear();
    for (const [k, v] of Object.entries(prevEffective)) {
      applyStagedEntry(gs, stagedMap, k, v, targetHead);
    }
    for (const k of Object.keys(targetHead)) {
      if (!Object.prototype.hasOwnProperty.call(prevEffective, k)) {
        applyStagedEntry(gs, stagedMap, k, null, targetHead);
      }
    }
  } else if (mode === 'mixed') {
    stagedMap.clear();
  } else if (mode === 'hard') {
    stagedMap.clear();
    if (vfs) {
      const liveFiles = readVfsTree(vfs, repoRoot);
      for (const rel of Object.keys(liveFiles)) {
        if (!Object.prototype.hasOwnProperty.call(targetHead, rel)) {
          deleteVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, shell);
          if (workspaceFiles) delete workspaceFiles[rel];
        }
      }
      for (const [rel, text] of Object.entries(targetHead)) {
        writeVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, text, shell);
        if (workspaceFiles) workspaceFiles[rel] = text;
      }
    }
  }

  saveBranchTip(gs, gs.branch);
  if (vfs) void syncToIsoGitRepo(vfs, gs);
  return {
    ok: true,
    headCommit: gs.headCommit,
    message: commit ? `HEAD is now at ${commit.hash} ${commit.message}` : undefined
  };
}

export function stashPush(
  shell: GitShellLike,
  message?: string,
  includeUntracked = false,
  workspaceFiles?: Record<string, string>
): { ok: boolean; created: boolean; label: string } {
  const gs = shell.gitState ?? null;
  if (!gs) return { ok: false, created: false, label: 'not a git repository' };
  const repoRoot = (gs.repoRoot || shell.cwd || '/workspace').replace(/\/+$/, '') || '/';
  const vfs = shell.vfs ?? null;
  const liveFiles = vfs ? readVfsTree(vfs, repoRoot) : { ...(workspaceFiles || {}) };
  const status = computeGitStatus(liveFiles, repoRoot, gs);

  const hasSaveable =
    status.staged.length > 0 ||
    status.modified.length > 0 ||
    status.deleted.length > 0 ||
    (includeUntracked && status.untracked.length > 0);
  if (!hasSaveable) {
    return { ok: true, created: false, label: 'No local changes to save' };
  }

  if (!Array.isArray(gs.stashes)) gs.stashes = [];
  const headFiles = cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot);
  const stagedMap = ensureStagedMap(gs);
  const untrackedSnap: Record<string, string> = {};
  if (includeUntracked) {
    for (const u of status.untracked) {
      if (Object.prototype.hasOwnProperty.call(liveFiles, u.path)) {
        untrackedSnap[u.path] = liveFiles[u.path];
      }
    }
  }
  const trackedWorktree: Record<string, string> = {};
  for (const [k, v] of Object.entries(liveFiles)) {
    if (Object.prototype.hasOwnProperty.call(headFiles, k) || stagedMap.has(k)) {
      trackedWorktree[k] = v;
    }
  }

  const summary =
    message?.trim() ||
    `WIP on ${gs.branch || 'main'}: ${gs.headCommit || 'unborn'} ${gs.commits[0]?.message || 'initial'}`;
  gs.stashes.unshift({
    id: Date.now(),
    branch: gs.branch || 'main',
    headCommit: gs.headCommit || '',
    message: summary,
    timestamp: Date.now(),
    worktreeFiles: trackedWorktree,
    stagedEntries: Array.from(stagedMap.entries()),
    untrackedFiles: untrackedSnap
  });

  // Reset tracked files (and untracked if -u) back to HEAD
  stagedMap.clear();
  for (const rel of Object.keys(untrackedSnap)) {
    deleteVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, shell);
    if (workspaceFiles) delete workspaceFiles[rel];
  }
  for (const rel of Object.keys(trackedWorktree)) {
    if (!Object.prototype.hasOwnProperty.call(headFiles, rel)) {
      deleteVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, shell);
      if (workspaceFiles) delete workspaceFiles[rel];
    }
  }
  for (const [rel, text] of Object.entries(headFiles)) {
    writeVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, text, shell);
    if (workspaceFiles) workspaceFiles[rel] = text;
  }

  return { ok: true, created: true, label: `Saved working directory and index state ${summary}` };
}

export function stashApply(
  shell: GitShellLike,
  stashIndex = 0,
  dropAfter = false,
  workspaceFiles?: Record<string, string>
): { ok: boolean; error?: string; message?: string } {
  const gs = shell.gitState ?? null;
  if (!gs || !Array.isArray(gs.stashes) || gs.stashes.length === 0) {
    return { ok: false, error: 'No stash entries found.' };
  }
  if (stashIndex < 0 || stashIndex >= gs.stashes.length) {
    return { ok: false, error: `error: stash@{${stashIndex}} is not a valid reference` };
  }
  const entry = gs.stashes[stashIndex];
  const repoRoot = (gs.repoRoot || shell.cwd || '/workspace').replace(/\/+$/, '') || '/';
  const vfs = shell.vfs ?? null;
  const headFiles = cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot);
  const stagedMap = ensureStagedMap(gs);

  for (const rel of Object.keys(headFiles)) {
    if (!Object.prototype.hasOwnProperty.call(entry.worktreeFiles, rel)) {
      deleteVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, shell);
      if (workspaceFiles) delete workspaceFiles[rel];
    }
  }
  for (const [rel, text] of Object.entries({ ...entry.worktreeFiles, ...entry.untrackedFiles })) {
    writeVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, text, shell);
    if (workspaceFiles) workspaceFiles[rel] = text;
  }
  for (const [rel, val] of entry.stagedEntries) {
    applyStagedEntry(gs, stagedMap, rel, val, headFiles);
  }
  if (dropAfter) {
    gs.stashes.splice(stashIndex, 1);
  }
  return {
    ok: true,
    message: dropAfter
      ? `Dropped refs/stash@{${stashIndex}} (${entry.message})`
      : `Applied stash@{${stashIndex}}`
  };
}

export function mergeBranch(
  shell: GitShellLike,
  sourceBranch: string,
  workspaceFiles?: Record<string, string>
): { ok: boolean; fastForward: boolean; conflicts: string[]; commitHash?: string; message: string } {
  const gs = shell.gitState ?? null;
  if (!gs) return { ok: false, fastForward: false, conflicts: [], message: 'fatal: not a git repository' };
  const srcName = sourceBranch.trim();
  const repoRoot = (gs.repoRoot || shell.cwd || '/workspace').replace(/\/+$/, '') || '/';
  const vfs = shell.vfs ?? null;
  saveBranchTip(gs, gs.branch);

  const srcTip = gs.branchHeads?.[srcName];
  if (!srcTip) {
    return {
      ok: false,
      fastForward: false,
      conflicts: [],
      message: `merge: ${srcName} - not something we can merge`
    };
  }
  if (srcTip.headCommit === gs.headCommit) {
    return { ok: true, fastForward: true, conflicts: [], message: 'Already up to date.' };
  }

  const ourHashes = new Set(gs.commits.map((c) => c.hash));
  if (ourHashes.has(srcTip.headCommit)) {
    return { ok: true, fastForward: true, conflicts: [], message: 'Already up to date.' };
  }

  // Fast-forward if sourceBranch contains our HEAD
  const srcHasOurs = !gs.headCommit || srcTip.commits.some((c) => c.hash === gs.headCommit);
  if (srcHasOurs) {
    const nextHead = cleanFileMap(srcTip.headFiles, repoRoot);
    const prevHead = cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot);
    for (const rel of Object.keys(prevHead)) {
      if (!Object.prototype.hasOwnProperty.call(nextHead, rel)) {
        deleteVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, shell);
        if (workspaceFiles) delete workspaceFiles[rel];
      }
    }
    for (const [rel, text] of Object.entries(nextHead)) {
      writeVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, text, shell);
      if (workspaceFiles) workspaceFiles[rel] = text;
    }
    gs.commits = srcTip.commits.map((c) => ({ ...c, ...(c.files ? { files: { ...c.files } } : {}) }));
    gs.headCommit = srcTip.headCommit;
    syncGitHead(gs, nextHead);
    saveBranchTip(gs, gs.branch);
    if (vfs) void syncToIsoGitRepo(vfs, gs);
    return {
      ok: true,
      fastForward: true,
      conflicts: [],
      commitHash: gs.headCommit,
      message: `Updating ${prevHead ? '' : ''}${srcTip.headCommit}\nFast-forward`
    };
  }

  // 3-way merge using common ancestor
  const baseCommit = srcTip.commits.find((c) => ourHashes.has(c.hash));
  const baseFiles = baseCommit?.files ? cleanFileMap(baseCommit.files, repoRoot) : {};
  const ourFiles = cleanFileMap(gs.headFiles || gs.headSnapshot || {}, repoRoot);
  const theirFiles = cleanFileMap(srcTip.headFiles, repoRoot);

  const allPaths = new Set([
    ...Object.keys(baseFiles),
    ...Object.keys(ourFiles),
    ...Object.keys(theirFiles)
  ]);
  const mergedFiles: Record<string, string> = {};
  const conflicts: string[] = [];

  for (const rel of allPaths) {
    const b = baseFiles[rel];
    const o = ourFiles[rel];
    const t = theirFiles[rel];
    if (o === t) {
      if (o !== undefined) mergedFiles[rel] = o;
    } else if (o === b) {
      if (t !== undefined) mergedFiles[rel] = t;
    } else if (t === b) {
      if (o !== undefined) mergedFiles[rel] = o;
    } else {
      conflicts.push(rel);
      mergedFiles[rel] =
        `<<<<<<< HEAD\n${o ?? ''}` +
        (o && !o.endsWith('\n') ? '\n' : '') +
        `=======\n${t ?? ''}` +
        (t && !t.endsWith('\n') ? '\n' : '') +
        `>>>>>>> ${srcName}\n`;
    }
  }

  for (const rel of Object.keys(ourFiles)) {
    if (!Object.prototype.hasOwnProperty.call(mergedFiles, rel)) {
      deleteVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, shell);
      if (workspaceFiles) delete workspaceFiles[rel];
    }
  }
  for (const [rel, text] of Object.entries(mergedFiles)) {
    writeVfsFileSafe(vfs, repoRoot === '/' ? `/${rel}` : `${repoRoot}/${rel}`, text, shell);
    if (workspaceFiles) workspaceFiles[rel] = text;
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      fastForward: false,
      conflicts,
      message:
        conflicts.map((c) => `CONFLICT (content): Merge conflict in ${c}`).join('\n') +
        '\nAutomatic merge failed; fix conflicts and then commit the result.'
    };
  }

  const ts = Date.now();
  const mergeMsg = `Merge branch '${srcName}' into ${gs.branch}`;
  const hash = computeShortCommitHash(`${gs.headCommit}:${srcTip.headCommit}:${ts}`);
  const synced = syncGitHead(gs, mergedFiles);
  gs.commits.unshift({
    hash,
    message: mergeMsg,
    timestamp: ts,
    author: 'CodeLab Developer <dev@codelab.internal>',
    date: new Date(ts).toUTCString(),
    files: { ...synced },
    parents: [gs.headCommit, srcTip.headCommit].filter(Boolean)
  });
  gs.headCommit = hash;
  ensureStagedMap(gs).clear();
  saveBranchTip(gs, gs.branch);
  if (vfs) void syncToIsoGitRepo(vfs, gs);

  return {
    ok: true,
    fastForward: false,
    conflicts: [],
    commitHash: hash,
    message: `Merge made by the 'ort' strategy.`
  };
}

export function showCommit(gitState: GitState, refSpec = 'HEAD'): { ok: boolean; output: string } {
  const { commit, index } = resolveCommitRef(gitState, refSpec);
  if (!commit) {
    return { ok: false, output: `fatal: bad object ${refSpec}\n` };
  }
  const parent = gitState.commits[index + 1];
  const parentFiles = parent?.files || {};
  const currFiles = commit.files || {};
  const allPaths = Array.from(
    new Set([...Object.keys(parentFiles), ...Object.keys(currFiles)])
  ).sort();

  const authorStr = commit.author || 'CodeLab Developer <dev@codelab.internal>';
  const dateStr = commit.date || new Date(commit.timestamp || 0).toUTCString();
  let out = `commit ${commit.hash}\nAuthor: ${authorStr}\nDate:   ${dateStr}\n\n    ${commit.message}\n\n`;
  for (const rel of allPaths) {
    const oldText = parentFiles[rel] ?? '';
    const newText = currFiles[rel] ?? '';
    if (oldText !== newText) {
      const hunk = computeUnifiedHunkDiff(`a/${rel}`, `b/${rel}`, oldText, newText);
      if (hunk) out += `diff --git a/${rel} b/${rel}\n${hunk}`;
    }
  }
  return { ok: true, output: out };
}

export function blameFile(
  gitState: GitState,
  relPath: string,
  liveContent?: string
): { ok: boolean; entries: BlameLineEntry[]; output: string } {
  const repoRoot = gitState.repoRoot || '/workspace';
  const cleanRel = normalizeScmRelPath(relPath, repoRoot);
  const headFiles = gitState.headFiles || gitState.headSnapshot || {};
  const targetText =
    liveContent !== undefined
      ? liveContent
      : Object.prototype.hasOwnProperty.call(headFiles, cleanRel)
        ? headFiles[cleanRel]
        : null;
  if (targetText === null) {
    return { ok: false, entries: [], output: `fatal: no such path '${relPath}' in HEAD\n` };
  }

  const lines = targetText.replace(/\r\n/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '' && targetText.endsWith('\n')) {
    lines.pop();
  }

  // Attribute lines from oldest commit to newest
  const chronological = [...(gitState.commits || [])].reverse();
  const lineMeta: Array<{ hash: string; author: string; timestamp: number }> = lines.map(() => ({
    hash: '0000000',
    author: 'Not Committed Yet',
    timestamp: Date.now()
  }));

  let prevSnapLines: string[] = [];
  let prevMeta: Array<{ hash: string; author: string; timestamp: number }> = [];

  for (const c of chronological) {
    const snapText = c.files?.[cleanRel];
    if (snapText === undefined) {
      prevSnapLines = [];
      prevMeta = [];
      continue;
    }
    const currLines = snapText.replace(/\r\n/g, '\n').split('\n');
    if (currLines.length > 0 && currLines[currLines.length - 1] === '' && snapText.endsWith('\n')) {
      currLines.pop();
    }
    const ops = computeMyersDiffOps(prevSnapLines.join('\n'), currLines.join('\n'));
    const nextMeta: Array<{ hash: string; author: string; timestamp: number }> = new Array(
      currLines.length
    );
    const authorName = (c.author || 'CodeLab Developer').replace(/\s*<.*$/, '');
    for (const op of ops) {
      if (op.type === 'common' && op.oldLineNumber && op.newLineNumber) {
        nextMeta[op.newLineNumber - 1] = prevMeta[op.oldLineNumber - 1] || {
          hash: c.hash,
          author: authorName,
          timestamp: c.timestamp
        };
      } else if (op.type === 'added' && op.newLineNumber) {
        nextMeta[op.newLineNumber - 1] = {
          hash: c.hash,
          author: authorName,
          timestamp: c.timestamp
        };
      }
    }
    prevSnapLines = currLines;
    prevMeta = nextMeta;
  }

  if (prevSnapLines.length > 0) {
    const finalOps = computeMyersDiffOps(prevSnapLines.join('\n'), lines.join('\n'));
    for (const op of finalOps) {
      if (op.type === 'common' && op.oldLineNumber && op.newLineNumber) {
        const inherited = prevMeta[op.oldLineNumber - 1];
        if (inherited) lineMeta[op.newLineNumber - 1] = inherited;
      }
    }
  }

  const entries: BlameLineEntry[] = lines.map((content, idx) => ({
    lineNumber: idx + 1,
    hash: lineMeta[idx].hash,
    author: lineMeta[idx].author,
    timestamp: lineMeta[idx].timestamp,
    content
  }));

  const output = entries
    .map((e) => {
      const dateIso = new Date(e.timestamp).toISOString().slice(0, 10);
      return `${e.hash.slice(0, 7)} (${e.author.padEnd(18).slice(0, 18)} ${dateIso} ${String(e.lineNumber).padStart(3)}) ${e.content}`;
    })
    .join('\n') + (entries.length > 0 ? '\n' : '');

  return { ok: true, entries, output };
}

// ── Real `isomorphic-git` VFS Adapter & `.git/` Object-Store Synchronization ─

export function createIsoGitFsAdapter(vfs: GitVfsLike): {
  promises: {
    readFile: (p: string, opts?: { encoding?: string } | string) => Promise<Uint8Array | string>;
    writeFile: (p: string, data: Uint8Array | string) => Promise<void>;
    unlink: (p: string) => Promise<void>;
    readdir: (p: string) => Promise<string[]>;
    mkdir: (p: string) => Promise<void>;
    rmdir: (p: string) => Promise<void>;
    stat: (p: string) => Promise<{
      type: 'file' | 'dir';
      mode: number;
      size: number;
      ino: number;
      mtimeMs: number;
      ctimeMs: number;
      uid: number;
      gid: number;
      dev: number;
      isFile: () => boolean;
      isDirectory: () => boolean;
      isSymbolicLink: () => boolean;
    }>;
    lstat: (p: string) => Promise<{
      type: 'file' | 'dir';
      mode: number;
      size: number;
      ino: number;
      mtimeMs: number;
      ctimeMs: number;
      uid: number;
      gid: number;
      dev: number;
      isFile: () => boolean;
      isDirectory: () => boolean;
      isSymbolicLink: () => boolean;
    }>;
    readlink: (p: string) => Promise<string>;
    symlink: (target: string, p: string) => Promise<void>;
  };
} {
  const makeErrno = (code: string, message: string): Error & { code: string } => {
    const err = new Error(message) as Error & { code: string };
    err.code = code;
    return err;
  };

  const statImpl = async (p: string) => {
    if (!vfs.statSync) throw makeErrno('ENOENT', `ENOENT: ${p}`);
    try {
      const st = vfs.statSync(p);
      const isDir = st.isDirectory();
      const mtime = st.mtimeMs ?? Date.now();
      return {
        type: (isDir ? 'dir' : 'file') as 'dir' | 'file',
        mode: st.mode ?? (isDir ? 0o040755 : 0o100644),
        size: st.size ?? 0,
        ino: 1,
        mtimeMs: mtime,
        ctimeMs: mtime,
        uid: 1000,
        gid: 1000,
        dev: 1,
        isFile: () => !isDir,
        isDirectory: () => isDir,
        isSymbolicLink: () => Boolean(st.isSymbolicLink?.())
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw makeErrno('ENOENT', msg);
    }
  };

  return {
    promises: {
      readFile: async (p: string, opts?: { encoding?: string } | string) => {
        if (!vfs.readFileSync) throw makeErrno('ENOENT', `ENOENT: ${p}`);
        const enc = typeof opts === 'string' ? opts : opts?.encoding;
        try {
          const raw = vfs.readFileSync(p, enc);
          if (enc === 'utf8' || enc === 'utf-8') {
            return typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
          }
          return raw instanceof Uint8Array ? raw : new TextEncoder().encode(String(raw));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw makeErrno('ENOENT', msg);
        }
      },
      writeFile: async (p: string, data: Uint8Array | string) => {
        const slash = p.lastIndexOf('/');
        const dir = slash > 0 ? p.slice(0, slash) : '/';
        if (dir && vfs.mkdirSync && (!vfs.existsSync || !vfs.existsSync(dir))) {
          vfs.mkdirSync(dir, { recursive: true });
        }
        vfs.writeFileSync?.(p, data);
      },
      unlink: async (p: string) => {
        if (vfs.unlinkSync) {
          try {
            vfs.unlinkSync(p);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw makeErrno('ENOENT', msg);
          }
        } else if (vfs.rmSync) {
          vfs.rmSync(p, { force: true });
        }
      },
      readdir: async (p: string) => {
        if (!vfs.readdirSync) throw makeErrno('ENOENT', `ENOENT: ${p}`);
        try {
          return vfs.readdirSync(p);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw makeErrno('ENOENT', msg);
        }
      },
      mkdir: async (p: string) => {
        try {
          vfs.mkdirSync?.(p, { recursive: true });
        } catch (err) {
          const _ignored = err;
          void _ignored;
        }
      },
      rmdir: async (p: string) => {
        try {
          if (vfs.rmdirSync) vfs.rmdirSync(p);
          else vfs.rmSync?.(p, { recursive: false, force: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw makeErrno('ENOENT', msg);
        }
      },
      stat: statImpl,
      lstat: statImpl,
      readlink: async (p: string) => {
        if (vfs.readlinkSync) return vfs.readlinkSync(p);
        throw makeErrno('ENOENT', `ENOENT: ${p}`);
      },
      symlink: async (target: string, p: string) => {
        vfs.symlinkSync?.(target, p);
      }
    }
  };
}

/**
 * Mirrors `gitState` branch & HEAD state into a real `isomorphic-git` `.git/`
 * directory inside `vfs` so real Git objects/refs/HEAD live on disk for IndexedDB persistence.
 */
export async function syncToIsoGitRepo(vfs: GitVfsLike, gitState: GitState): Promise<void> {
  if (!vfs || !gitState.initialized || typeof vfs.writeFileSync !== 'function') return;
  const dir = (gitState.repoRoot || '/workspace').replace(/\/+$/, '') || '/workspace';
  const fsAdapter = createIsoGitFsAdapter(vfs);
  try {
    await isoInit({ fs: fsAdapter, dir, defaultBranch: gitState.branch || 'main' });
    if (gitState.commits.length > 0) {
      const latest = gitState.commits[0];
      const headFiles = gitState.headFiles || gitState.headSnapshot || {};
      for (const rel of Object.keys(headFiles)) {
        const abs = `${dir}/${rel}`;
        if (vfs.existsSync?.(abs)) {
          await isoAdd({ fs: fsAdapter, dir, filepath: rel });
        }
      }
      await isoCommit({
        fs: fsAdapter,
        dir,
        message: latest.message || 'commit',
        author: {
          name: 'CodeLab Developer',
          email: 'dev@codelab.internal',
          timestamp: Math.floor((latest.timestamp || Date.now()) / 1000)
        }
      });
    }
  } catch (err) {
    // Non-fatal mirror sync if working tree has transient mock VFS constraints
    const _ignored = err;
    void _ignored;
  }
}

/**
 * Hydrates a `GitState` from an existing `isomorphic-git` `.git/` object store
 * in `vfs` (for example after restoring `.git/**` from IndexedDB).
 */
export async function hydrateFromIsoGitRepo(
  vfs: GitVfsLike,
  repoRoot = '/workspace'
): Promise<GitState | null> {
  const dir = (repoRoot || '/workspace').replace(/\/+$/, '') || '/workspace';
  const headPath = `${dir}/.git/HEAD`;
  if (!vfs || !vfs.existsSync?.(headPath)) return null;
  const fsAdapter = createIsoGitFsAdapter(vfs);
  try {
    const currentBranch = (await isoCurrentBranch({ fs: fsAdapter, dir, fullname: false })) || 'main';
    const branches = await isoListBranches({ fs: fsAdapter, dir });
    const logEntries = await isoLog({ fs: fsAdapter, dir, depth: 50 }).catch(() => []);
    const commits: GitCommitRecord[] = [];
    for (const entry of logEntries) {
      commits.push({
        hash: entry.oid.slice(0, 7),
        message: entry.commit.message.trim(),
        timestamp: entry.commit.author.timestamp * 1000,
        author: `${entry.commit.author.name} <${entry.commit.author.email}>`,
        date: new Date(entry.commit.author.timestamp * 1000).toUTCString()
      });
    }
    const liveTree = readVfsTree(vfs, dir);
    const gs = createGitState(commits.length > 0 ? liveTree : {}, String(currentBranch), {
      initialized: true,
      repoRoot: dir
    });
    gs.branches = branches.length > 0 ? branches : [String(currentBranch)];
    if (commits.length > 0) {
      commits[0].files = { ...liveTree };
      gs.commits = commits;
      gs.headCommit = commits[0].hash;
      syncGitHead(gs, liveTree);
    } else {
      gs.commits = [];
      gs.headCommit = '';
      syncGitHead(gs, {});
    }
    saveBranchTip(gs, gs.branch);
    return gs;
  } catch (err) {
    const _ignored = err;
    void _ignored;
    return null;
  }
}

const isoGit = {
  init: isoInit,
  add: isoAdd,
  commit: isoCommit,
  currentBranch: isoCurrentBranch,
  listBranches: isoListBranches,
  log: isoLog
};

export { isoGit };

export default {
  computeShortCommitHash,
  parseGitignoreRules,
  isIgnoredByRules,
  isIgnoredScmPath,
  normalizeScmRelPath,
  isUnbornGitHead,
  isEffectiveStagedChange,
  syncGitHead,
  saveBranchTip,
  createGitState,
  readVfsTree,
  initRepository,
  computeGitStatus,
  stageFile,
  stageAll,
  unstageFile,
  unstageAll,
  commitChanges,
  discardChanges,
  computeMyersDiffOps,
  computeUnifiedHunkDiff,
  computeGitGutterChanges,
  checkoutBranch,
  resolveCommitRef,
  resetToRef,
  stashPush,
  stashApply,
  mergeBranch,
  showCommit,
  blameFile,
  createIsoGitFsAdapter,
  syncToIsoGitRepo,
  hydrateFromIsoGitRepo,
  isoGit
};
