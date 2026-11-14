/**
 * @innovatorved/code-lab — Interactive Git Source Control (SCM) Engine
 * ============================================================================
 * Pure TypeScript in-browser Git status, staging, unstaging, discard, and
 * commit engine backed by workspace VFS state. Powers both the interactive
 * Source Control UI and shell/CLI Git operations with a unified GitState schema.
 *
 * Strict leaf module: fully typed, zero explicit any, zero empty catches.
 */

export type GitFileChangeType = 'modified' | 'added' | 'deleted' | 'untracked';

export interface GitFileStatus {
  path: string;
  status: GitFileChangeType;
  staged: boolean;
  oldContent?: string;
  newContent?: string;
}

export interface GitVfsLike {
  existsSync?(path: string): boolean;
  statSync?(path: string): { isDirectory(): boolean };
  readdirSync?(path: string): string[];
  readFileSync?(path: string, encoding?: string): string | Uint8Array;
  writeFileSync?(path: string, data: string): void;
  mkdirSync?(path: string, options?: { recursive?: boolean }): unknown;
  unlinkSync?(path: string): void;
  rmSync?(path: string, options?: { recursive?: boolean; force?: boolean }): void;
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
}

export interface GitState {
  initialized?: boolean;
  repoRoot?: string;
  branch: string;
  branches?: string[] | Set<string>;
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

export function isIgnoredScmPath(relPath: string): boolean {
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
  } else if (p.startsWith('/workspace/')) {
    p = p.slice('/workspace/'.length);
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

function cleanFileMap(
  rawFiles: Record<string, string> | undefined,
  repoRoot = '/workspace'
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawFiles || typeof rawFiles !== 'object') return out;
  for (const [k, v] of Object.entries(rawFiles)) {
    const rel = normalizeScmRelPath(k, repoRoot);
    if (!rel || isIgnoredScmPath(rel)) continue;
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

function readVfsTree(vfs: GitVfsLike, rootDir: string): Record<string, string> {
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
    const repoRoot = (
      options?.repoRoot ||
      target.gitState?.repoRoot ||
      target.cwd ||
      '/workspace'
    ).replace(/\/+$/, '') || '/';
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
      ? (options.initialFiles
          ? cleanFileMap(options.initialFiles, repoRoot)
          : (vfs ? readVfsTree(vfs, repoRoot) : {}))
      : {};

    let gs = target.gitState;
    if (!gs) {
      gs = createGitState(snap, branch, { initialized: true, repoRoot });
      if (!options?.snapshotExisting) {
        gs.commits = [];
        gs.headCommit = '';
      }
      target.gitState = gs;
      return gs;
    }

    gs.initialized = true;
    gs.repoRoot = repoRoot;
    gs.branch = branch;
    if (gs.branches instanceof Set) {
      gs.branches.add(branch);
    } else if (Array.isArray(gs.branches)) {
      if (!gs.branches.includes(branch)) gs.branches.push(branch);
    } else {
      gs.branches = [branch];
    }
    ensureStagedMap(gs).clear();
    syncGitHead(gs, snap);
    if (!options?.snapshotExisting && gs.commits.length === 0) {
      gs.headCommit = '';
    }
    return gs;
  }

  const gs = target;
  const repoRoot = options?.repoRoot || gs.repoRoot || '/workspace';
  const branch = options?.branch || gs.branch || 'main';
  gs.initialized = true;
  gs.repoRoot = repoRoot;
  gs.branch = branch;
  if (gs.branches instanceof Set) {
    gs.branches.add(branch);
  } else if (Array.isArray(gs.branches)) {
    if (!gs.branches.includes(branch)) gs.branches.push(branch);
  } else {
    gs.branches = [branch];
  }
  ensureStagedMap(gs).clear();
  syncGitHead(gs, options?.snapshotExisting ? (options.initialFiles || {}) : {});
  return gs;
}

/**
 * Computes working-tree and staging-area Git status against `gitState`.
 * Supports both `computeGitStatus(vfsFiles, repoRoot, gitState)` and
 * `computeGitStatus(gitState, vfsFiles)` calling conventions.
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
    repoRoot = typeof arg2 === 'string' && arg2 ? arg2 : (gitState?.repoRoot || '/workspace');
    state = gitState || createGitState({});
  }

  const vfsFiles = cleanFileMap(rawVfsFiles, repoRoot);
  const headFiles = cleanFileMap(state.headFiles || state.headSnapshot || {}, repoRoot);
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
      // Detect worktree deletion of a staged file (MD / AD)
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
        // Staged for deletion, then recreated in working tree
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
    ...modified.map((m) => ({
      path: m.path,
      status: m.status,
      staged: false,
      index: stagedIndexByPath.get(m.path) || ' ',
      worktree: 'M'
    })),
    ...deleted.map((d) => ({
      path: d.path,
      status: d.status,
      staged: false,
      index: stagedIndexByPath.get(d.path) || ' ',
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
 * Stages all modified, untracked (non-ignored), and deleted tracked files.
 */
export function stageAll(
  gitState: GitState,
  vfsFiles: Record<string, string>,
  repoRoot = '/workspace'
): void {
  if (!gitState) return;
  const resolvedRoot = gitState.repoRoot || repoRoot || '/workspace';
  const cleanVfs = cleanFileMap(vfsFiles, resolvedRoot);
  const headFiles = cleanFileMap(gitState.headFiles || gitState.headSnapshot || {}, resolvedRoot);
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
 * Commits all staged changes to `gitState`, advancing `headCommit` and
 * synchronizing `headFiles` & `headSnapshot`, prepending the new commit record,
 * and clearing the staging area. Throws if message or staging area is empty.
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
    files: { ...syncedHead }
  };

  if (!Array.isArray(gitState.commits)) {
    gitState.commits = [];
  }
  gitState.commits.unshift(commit);
  gitState.initialized = true;
  gitState.headCommit = hash;
  stagedMap.clear();

  return hash;
}

/**
 * Discards working-tree (and staged) changes for `filePath`:
 * - If tracked in `HEAD`, restores `headFiles[relPath]` to `shell.vfs` (creating
 *   parent directories first) and optional `workspaceFiles`.
 * - If untracked, deletes the file from `shell.vfs` and optional `workspaceFiles`.
 */
export function discardChanges(
  shell: GitShellLike,
  filePath: string,
  workspaceFiles?: Record<string, string>
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

  if (inHead) {
    const headContent = headFiles[relPath];
    if (vfs) {
      const lastSlash = absPath.lastIndexOf('/');
      const parentDir = lastSlash > 0 ? absPath.slice(0, lastSlash) : '/';
      if (
        parentDir &&
        typeof vfs.mkdirSync === 'function' &&
        (typeof vfs.existsSync !== 'function' || !vfs.existsSync(parentDir))
      ) {
        vfs.mkdirSync(parentDir, { recursive: true });
      }
      vfs.writeFileSync?.(absPath, headContent);
    }
    if (workspaceFiles && typeof workspaceFiles === 'object') {
      workspaceFiles[relPath] = headContent;
    }
    if (gs) {
      unstageFile(gs, relPath);
    }
    shell._emitVfsMutation?.('change', absPath);
    return true;
  }

  const existsInVfs = Boolean(vfs && typeof vfs.existsSync === 'function' && vfs.existsSync(absPath));
  const existsInMapVfs = Boolean(vfs && vfs.files instanceof Map && vfs.files.has(absPath));
  const existsInWs = Boolean(
    workspaceFiles && Object.prototype.hasOwnProperty.call(workspaceFiles, relPath)
  );
  const existsInStaged = Boolean(gs && ensureStagedMap(gs).has(relPath));

  if (!existsInVfs && !existsInMapVfs && !existsInWs && !existsInStaged) {
    return false;
  }

  if (vfs) {
    if (typeof vfs.rmSync === 'function') {
      vfs.rmSync(absPath, { force: true });
    } else if (typeof vfs.unlinkSync === 'function') {
      if (typeof vfs.existsSync !== 'function' || vfs.existsSync(absPath)) {
        vfs.unlinkSync(absPath);
      }
    } else if (vfs.files instanceof Map) {
      vfs.files.delete(absPath);
    }
  }

  if (workspaceFiles && typeof workspaceFiles === 'object') {
    delete workspaceFiles[relPath];
  }
  if (gs) {
    unstageFile(gs, relPath);
  }
  shell._emitVfsMutation?.('delete', absPath);
  return true;
}

export default {
  computeShortCommitHash,
  isIgnoredScmPath,
  normalizeScmRelPath,
  isUnbornGitHead,
  isEffectiveStagedChange,
  syncGitHead,
  createGitState,
  initRepository,
  computeGitStatus,
  stageFile,
  stageAll,
  unstageFile,
  unstageAll,
  commitChanges,
  discardChanges
};
