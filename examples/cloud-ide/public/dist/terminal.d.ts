/**
 * @innovatorved/code-lab - Pure-JS/TS PTY Terminal Emulator Component
 *
 * High-fidelity, self-contained terminal emulator engine providing:
 * - Inline prompt with cwd awareness (codelab:${cwd}$ )
 * - Interactive REPL sub-mode (> ) with .exit and Ctrl+D/Ctrl+C
 * - Character-by-character editing with cursor navigation:
 *   ArrowLeft, ArrowRight, Home, End, Ctrl+A, Ctrl+E, Ctrl+U, Ctrl+K, Backspace, Delete
 * - Tab auto-completion for built-in commands and VFS filesystem paths
 * - History navigation (ArrowUp, ArrowDown)
 * - ANSI 16/256 SGR escape sequence translation to styled Geist HTML spans
 * - Headless DOM safety (defensive guards for Node.js test environments)
 *
 * (C) 2026 InnovatorVed / CodeLab. MIT License.
 */
export interface TerminalLogItem {
    text: string;
    type?: string;
}
export interface CompletionResult {
    matches: string[];
    token: string;
    tokenStart: number;
}
export interface TerminalOptions {
    container?: any;
    logs?: TerminalLogItem[];
    cwd?: string;
    replMode?: boolean;
    prompt?: string | null;
    history?: string[];
    onCommand?: ((command: string) => void) | null;
    getCompletions?: ((buffer: string, cursor: number) => CompletionResult | null) | null;
    onKey?: ((event: any) => boolean | void) | null;
    onInterrupt?: (() => void) | null;
}
export declare const ANSI_CODE_MAP: Record<number, string>;
export declare const ANSI_256_PALETTE: string[];
export declare function ansi256ToColor(n: number | string): string | null;
export declare function escapeHtml(str: any): string;
export declare function resolveAnsiControlCodes(raw: any): string;
export declare function ansiToHtml(str: any): string;
export declare const parseAnsiToHtml: typeof ansiToHtml;
export declare class PTYTerminalEngine {
    container: any;
    options: TerminalOptions;
    logs: TerminalLogItem[];
    cwd: string;
    replMode: boolean;
    promptOverride: string | null;
    history: string[];
    historyIdx: number;
    savedBuffer: string;
    buffer: string;
    cursor: number;
    searchMode: boolean;
    searchQuery: string;
    searchMatchIdx: number;
    _readLineQueue: Array<(line: string) => void>;
    onCommand: ((command: string) => void) | null;
    getCompletions: ((buffer: string, cursor: number) => CompletionResult | null) | null;
    onKey: ((event: any) => boolean | void) | null;
    onInterrupt: (() => void) | null;
    _activeLineCommitted: boolean;
    _cursorCol: number;
    _pendingEscape: string;
    _targetLineIdx: number;
    _needsRewrite: boolean;
    _activeLineEl: any;
    _mounted: boolean;
    _listeners: Array<any>;
    constructor(container?: any, options?: TerminalOptions);
    getPrompt(): string;
    setPrompt(p: string | null): void;
    setCwd(cwd: string): void;
    setReplMode(enabled: boolean): void;
    writeStreamChunk(data: any, type?: string): void;
    write(data: any, type?: string): void;
    writeln(data: any, type?: string): void;
    _getActiveLine(type: string): TerminalLogItem;
    _appendDomLine(line: TerminalLogItem): void;
    _updateActiveDomLine(): void;
    _getActiveLineSync(): TerminalLogItem | null;
    _scrollToBottom(): void;
    clear(): void;
    getHistory(): string[];
    readLine(promptText?: string): Promise<string>;
    focus(): void;
    mount(container: any): void;
    _cleanupListeners(): void;
    destroy(): void;
    _addListener(target: any, type: string, handler: any): void;
    _bindEvents(): void;
    _findReverseSearchMatch(query: string, startIdx?: number): number;
    handleKeyDown(e: any): void;
    autoComplete(): void;
    submitLine(): void;
    updateActiveLine(): void;
    render(): void;
}
export declare function createTerminal(container?: any, options?: TerminalOptions): PTYTerminalEngine;
export declare const createPTYTerminalEngine: typeof createTerminal;
