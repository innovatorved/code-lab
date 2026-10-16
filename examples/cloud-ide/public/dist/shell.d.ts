/**
 * @innovatorved/code-lab - POSIX Shell Engine & UNIX Coreutils (TypeScript)
 *
 * Full-fidelity, CSP-safe POSIX shell AST interpreter and 35+ standard UNIX
 * coreutils operating directly on the in-memory virtual filesystem (VFS).
 *
 * (C) 2026 InnovatorVed / CodeLab. MIT License.
 */
import type { CloneProgressEvent, CloneProgressPhase, GitHubCloneOptions } from './schemas.js';
export type { CloneProgressEvent, CloneProgressPhase, GitHubCloneOptions };
export interface CloneResult {
    owner: string;
    repo: string;
    branch: string;
    url: string;
    targetDir: string;
    count: number;
    fileCount: number;
    filesWritten: number;
    totalBytes: number;
    commits: Array<{
        hash: string;
        author: string;
        date: string;
        message: string;
    }>;
    headSnapshot: Record<string, string>;
}
export interface ShellExecResult {
    code: number;
    exitCode?: number;
    ok?: boolean;
    stdout: string;
    stderr: string;
    controlFlow?: {
        type: string;
        count?: number;
        code?: number;
    };
    aborted?: boolean;
}
export interface ShellExecOptions {
    cwd?: string;
    env?: Record<string, string>;
    vfs?: any;
    portTable?: any;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    stdin?: string;
    fetchImpl?: any;
    onProgress?: (event: CloneProgressEvent) => void;
    signal?: AbortSignal;
}
declare const _hostShell: any;
export declare const createPosixShell: (options?: any) => any;
export declare const parseShellCommand: (cmd: string) => any;
export declare const tokenizeShell: (input: string) => any[];
export declare const PosixShell: any;
export declare const COREUTILS: Record<string, any>;
export declare const PosixPath: any;
export declare const expandGlob: (pattern: string, vfs: any, cwd?: string) => string[];
export declare const createVirtualPortTable: () => any;
export declare const parseGitHubRepoUrl: (input: string) => any;
export declare const cloneGitHubRepository: (repoInput: string, vfs: any, options?: GitHubCloneOptions) => Promise<CloneResult>;
export declare const CodeLabShell: any;
export default _hostShell;
