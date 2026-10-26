/**
 * @innovatorved/code-lab — Interactive Git Source Control (SCM) Engine
 * ============================================================================
 * Pure TypeScript in-browser Git status, staging, unstaging, and commit engine
 * backed by workspace VFS state. Powers both the interactive Source Control UI
 * and shell/CLI Git operations.
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

export interface GitCommitRecord {
  hash: string;
  message: string;
  timestamp: number;
  author?: string;
  files: Record<string, string>;
}

export interface GitState {
  branch: string;
  branches?: string[];
  headCommit: string;
  headFiles: Record<string, string>;
  headSnapshot?: Record<string, string>;
  staged: Map<string, string | null> | Set<string>;
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
 * Initializes a fresh in-memory Git repository state from initial VFS files.
 */
export function createGitState(
  initialFiles: Record<string, string> = {},
  branch = 'main'
): GitState {
  const headFiles: Record<string, string> = { ...initialFiles };
  const initialHash = computeShortCommitHash(JSON.stringify(headFiles) + ':init');
  return {
    branch,
    branches: [branch],
    headCommit: initialHash,
    headFiles,
    staged: new Map<string, string | null>(),
    commits: [
      {
        hash: initialHash,
        message: 'Initial commit',
        timestamp: Date.now(),
        files: { ...headFiles }
      }
    ]
  };
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
  let vfsFiles: Record<string, string>;
  let state: GitState;

  if (
    arg1 &&
    typeof arg1 === 'object' &&
    ('headFiles' in arg1 || 'headSnapshot' in arg1 || 'staged' in arg1 || 'commits' in arg1)
  ) {
    state = arg1 as GitState;
    vfsFiles = (arg2 && typeof arg2 === 'object' ? arg2 : {}) as Record<string, string>;
  } else {
    vfsFiles = (arg1 && typeof arg1 === 'object' ? arg1 : {}) as Record<string, string>;
    state = gitState || createGitState({});
  }

  const headFiles: Record<string, string> = state.headFiles || state.headSnapshot || {};
  const currentStaged = new Map<string, string | null>();
  if (state.staged instanceof Map) {
    for (const [k, v] of state.staged.entries()) {
      currentStaged.set(k, v);
    }
  } else if (state.staged instanceof Set) {
    for (const k of state.staged.values()) {
      const existsInVfs = Object.prototype.hasOwnProperty.call(vfsFiles, k);
      currentStaged.set(k, existsInVfs ? vfsFiles[k] : null);
    }
  }

  const untracked: GitFileStatus[] = [];
  const modified: GitFileStatus[] = [];
  const deleted: GitFileStatus[] = [];
  const staged: GitFileStatus[] = [];

  for (const [filePath, stagedContent] of currentStaged.entries()) {
    const inHead = Object.prototype.hasOwnProperty.call(headFiles, filePath);
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
        status: inHead ? 'modified' : 'added',
        staged: true,
        oldContent: inHead ? headFiles[filePath] : undefined,
        newContent: stagedContent
      });
    }
  }

  for (const [filePath, content] of Object.entries(vfsFiles || {})) {
    if (currentStaged.has(filePath)) {
      const stagedVal = currentStaged.get(filePath);
      if (stagedVal !== content) {
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

  const unstaged: GitFileStatus[] = [...modified, ...deleted];
  const entries: GitStatusEntry[] = [
    ...staged.map((s) => ({
      path: s.path,
      status: s.status,
      staged: true,
      index: s.status === 'added' ? 'A' : s.status === 'deleted' ? 'D' : 'M',
      worktree: ' '
    })),
    ...modified.map((m) => ({
      path: m.path,
      status: m.status,
      staged: false,
      index: ' ',
      worktree: 'M'
    })),
    ...deleted.map((d) => ({
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
  if (!(gitState.staged instanceof Map)) {
    gitState.staged = new Map<string, string | null>();
  }
  const normalizedContent = currentContent === undefined ? null : currentContent;
  const headFiles = gitState.headFiles || gitState.headSnapshot || {};
  if (
    normalizedContent === null &&
    !Object.prototype.hasOwnProperty.call(headFiles, relativePath) &&
    !gitState.staged.has(relativePath)
  ) {
    return;
  }
  gitState.staged.set(relativePath, normalizedContent);
}

/**
 * Removes a file from the staging index.
 */
export function unstageFile(gitState: GitState, relativePath: string): void {
  if (!gitState) return;
  if (gitState.staged instanceof Map) {
    gitState.staged.delete(relativePath);
  } else if (gitState.staged instanceof Set) {
    gitState.staged.delete(relativePath);
  }
}

/**
 * Commits all staged changes to `gitState`, advancing `headCommit` and `headFiles`,
 * and clearing the staging area. Throws if message is empty or staging area is empty.
 */
export function commitChanges(gitState: GitState, message: string): string {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed) {
    throw new Error('Commit message cannot be empty');
  }
  if (!gitState || !(gitState.staged instanceof Map) || gitState.staged.size === 0) {
    throw new Error('Nothing to commit (staging area is empty)');
  }

  const newHeadFiles: Record<string, string> = { ...(gitState.headFiles || gitState.headSnapshot || {}) };
  const diffSummaryParts: string[] = [];
  for (const [filePath, content] of gitState.staged.entries()) {
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
  const commit: GitCommitRecord = {
    hash,
    message: trimmed,
    timestamp,
    files: { ...newHeadFiles }
  };

  if (!Array.isArray(gitState.commits)) {
    gitState.commits = [];
  }
  gitState.commits.push(commit);
  gitState.headCommit = hash;
  gitState.headFiles = { ...newHeadFiles };
  gitState.staged.clear();

  return hash;
}

export default {
  createGitState,
  computeGitStatus,
  stageFile,
  unstageFile,
  commitChanges,
  computeShortCommitHash
};
