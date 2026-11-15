/**
 * @innovatorved/code-lab — Browser-Native xterm.js PTY Adapter
 *
 * Mounts a real `@xterm/xterm` terminal instance (with `@xterm/addon-fit`,
 * `@xterm/addon-web-links`, and clickable `file:line:col` diagnostic navigation)
 * inside `#cl-terminal-surface`, while maintaining a synchronized hidden mirror
 * (`#cl-terminal-log`, `#cl-pty-active-line`, `#cl-repl-input`) so programmatic
 * consumers and E2E harnesses work seamlessly alongside interactive VT100 I/O.
 */

import type { Terminal, ITheme } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { WebLinksAddon } from '@xterm/addon-web-links';

interface XtermRuntimeClasses {
  Terminal: typeof Terminal;
  FitAddon: typeof FitAddon;
  WebLinksAddon: typeof WebLinksAddon;
}

let _cachedXtermClasses: XtermRuntimeClasses | null = null;

function getXtermRuntimeClasses(): XtermRuntimeClasses {
  if (!_cachedXtermClasses) {
    // Lazy-require ESM builds so esbuild wraps xterm in a deferred __esm/__commonJS factory
    // (keeping Node/Bun headless imports free of xterm's MessageChannel queue and ~38 KB smaller gzipped)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xtermMod = require('@xterm/xterm/lib/xterm.mjs') as { Terminal: typeof Terminal };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fitMod = require('@xterm/addon-fit/lib/addon-fit.mjs') as { FitAddon: typeof FitAddon };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const linksMod = require('@xterm/addon-web-links/lib/addon-web-links.mjs') as {
      WebLinksAddon: typeof WebLinksAddon;
    };
    _cachedXtermClasses = {
      Terminal: xtermMod.Terminal,
      FitAddon: fitMod.FitAddon,
      WebLinksAddon: linksMod.WebLinksAddon
    };
  }
  return _cachedXtermClasses;
}

interface SharedTerminalHelpers {
  ansiToHtml?: (text: string) => string;
  escapeHtml?: (str: string) => string;
  resolveAnsiControlCodes?: (text: string) => string;
}

function getTerminalHelpers(): SharedTerminalHelpers {
  const g = globalThis as unknown as { CodeLabTerminal?: SharedTerminalHelpers };
  return g.CodeLabTerminal || {};
}

function escapeHtml(str: string): string {
  const fn = getTerminalHelpers().escapeHtml;
  if (typeof fn === 'function') return fn(str);
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ansiToHtml(text: string): string {
  const fn = getTerminalHelpers().ansiToHtml;
  if (typeof fn === 'function') return fn(text);
  return escapeHtml(String(text == null ? '' : text).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
}

function resolveAnsiControlCodes(text: string): string {
  const fn = getTerminalHelpers().resolveAnsiControlCodes;
  if (typeof fn === 'function') return fn(text);
  return String(text == null ? '' : text);
}

export interface XtermAdapterOptions {
  cwd?: string;
  logs?: Array<{ type: string; text: string }>;
  history?: string[];
  theme?: 'dark' | 'light' | 'hc' | 'high-contrast';
  fontSize?: number;
  fontFamily?: string;
  onCommand?: (line: string) => Promise<unknown> | unknown;
  getCompletions?: (
    buffer: string,
    cursor: number
  ) => { matches: string[]; token: string; tokenStart: number } | null;
  onInterrupt?: () => void;
  onResize?: (cols: number, rows: number) => void;
  onOpenFileLink?: (filePath: string, line: number, column: number) => void;
  onOpenUrl?: (url: string) => boolean | void;
  maxScrollback?: number;
  initialLogs?: Array<{ type: string; text: string }>;
}

const VALID_LOG_TYPES = new Set([
  'stdout',
  'stderr',
  'system',
  'info',
  'warn',
  'error',
  'success'
]);

function sanitizeLogType(type?: string): string {
  const t = String(type || 'stdout').trim();
  return VALID_LOG_TYPES.has(t) ? t : 'stdout';
}

export function getXtermTheme(mode: string = 'dark'): ITheme {
  if (mode === 'light') {
    return {
      background: '#ffffff',
      foreground: '#18181b',
      cursor: '#18181b',
      cursorAccent: '#ffffff',
      selectionBackground: 'rgba(24, 24, 27, 0.14)',
      black: '#18181b',
      red: '#b42318',
      green: '#067647',
      yellow: '#b54708',
      blue: '#1d4ed8',
      magenta: '#6d28d9',
      cyan: '#0f766e',
      white: '#52525b',
      brightBlack: '#6e6a64',
      brightRed: '#dc2626',
      brightGreen: '#059669',
      brightYellow: '#d97706',
      brightBlue: '#2563eb',
      brightMagenta: '#7c3aed',
      brightCyan: '#0d9488',
      brightWhite: '#09090b'
    };
  }
  if (mode === 'hc' || mode === 'high-contrast') {
    return {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffffff',
      cursorAccent: '#000000',
      selectionBackground: 'rgba(255, 255, 255, 0.35)',
      black: '#000000',
      red: '#f87171',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#93c5fd',
      magenta: '#c084fc',
      cyan: '#2dd4bf',
      white: '#ffffff',
      brightBlack: '#a1a1aa',
      brightRed: '#f87171',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#93c5fd',
      brightMagenta: '#c084fc',
      brightCyan: '#2dd4bf',
      brightWhite: '#ffffff'
    };
  }
  return {
    background: '#0f0f10',
    foreground: '#f4f4f5',
    cursor: '#f4f4f5',
    cursorAccent: '#0f0f10',
    selectionBackground: 'rgba(244, 244, 245, 0.22)',
    black: '#18181a',
    red: '#f87171',
    green: '#34d399',
    yellow: '#fbbf24',
    blue: '#93c5fd',
    magenta: '#c084fc',
    cyan: '#2dd4bf',
    white: '#d4d4d8',
    brightBlack: '#8e8e97',
    brightRed: '#fca5a5',
    brightGreen: '#6ee7b7',
    brightYellow: '#fde047',
    brightBlue: '#bfdbfe',
    brightMagenta: '#d8b4fe',
    brightCyan: '#5eead4',
    brightWhite: '#ffffff'
  };
}

export function canUseXtermInEnvironment(container?: unknown): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof HTMLCanvasElement === 'undefined') return false;
  if (container !== undefined && (!container || typeof (container as Element).appendChild !== 'function')) {
    return false;
  }
  // Detect lightweight Node mock-DOMs that do not implement real Element layout APIs
  const probe = document.createElement('div');
  if (typeof probe.getBoundingClientRect !== 'function' || typeof window.getComputedStyle !== 'function') {
    return false;
  }
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    return false;
  }
  return true;
}

interface ReadLineQueueItem {
  promptText: string;
  prevPrompt: string | null;
  _activated: boolean;
  cleanup: (() => void) | null;
  resolve: (value: string | null) => void;
}

const FILE_LINK_RE =
  /(?:\/workspace\/|\.\/)?([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|cpp|cc|cxx|h|hpp|sql|json|css|html|md))(?::(\d+)(?::(\d+))?|\((\d+),(\d+)\))/g;

export class XtermTerminalEngine {
  public container: HTMLElement | null;
  public options: XtermAdapterOptions;
  public logs: Array<{ type: string; text: string }>;
  public cwd: string;
  public replMode: boolean;
  public promptOverride: string | null;
  public history: string[];
  public historyIdx: number;
  public savedBuffer: string;
  public buffer: string;
  public cursor: number;
  public searchMode: boolean;
  public searchQuery: string;
  public searchMatchIdx: number;
  public isBusy: boolean;
  public maxScrollback: number;
  public maxHistory: number;
  public onCommand: ((line: string) => Promise<unknown> | unknown) | null;
  public getCompletions: XtermAdapterOptions['getCompletions'] | null;
  public onInterrupt: (() => void) | null;

  public xterm: Terminal | null = null;
  public fitAddon: FitAddon | null = null;

  private _readLineQueue: ReadLineQueueItem[] = [];
  private _themeMode: string;
  private _resizeObserver: ResizeObserver | null = null;
  private _fitRaf = 0;
  private _disposed = false;
  private _promptVisibleInXterm = false;
  private _pendingMirrorLine = '';
  private _activeMirrorEl: HTMLElement | null = null;
  private _domListeners: Array<{ target: EventTarget; type: string; fn: EventListener }> = [];

  constructor(container: HTMLElement | null, options: XtermAdapterOptions = {}) {
    this.container = container || null;
    this.options = options || {};
    this.maxScrollback =
      typeof options.maxScrollback === 'number' && Number.isFinite(options.maxScrollback) && options.maxScrollback > 0
        ? Math.floor(options.maxScrollback)
        : 3000;
    this.maxHistory = 1000;
    const seedLogs = Array.isArray(options.initialLogs)
      ? options.initialLogs
      : Array.isArray(options.logs)
        ? options.logs
        : [];
    this.logs = [...seedLogs];
    if (this.logs.length > this.maxScrollback) {
      this.logs.splice(0, this.logs.length - this.maxScrollback);
    }
    this.cwd = options.cwd || '/workspace';
    this.replMode = false;
    this.promptOverride = null;
    this.history = Array.isArray(options.history) ? options.history : [];
    this.historyIdx = -1;
    this.savedBuffer = '';
    this.buffer = '';
    this.cursor = 0;
    this.searchMode = false;
    this.searchQuery = '';
    this.searchMatchIdx = -1;
    this.isBusy = false;
    this._themeMode = options.theme || 'dark';
    this.onCommand = typeof options.onCommand === 'function' ? options.onCommand : null;
    this.getCompletions = typeof options.getCompletions === 'function' ? options.getCompletions : null;
    this.onInterrupt = typeof options.onInterrupt === 'function' ? options.onInterrupt : null;

    if (this.container) {
      this.mount(this.container);
    }
  }

  public getPrompt(): string {
    if (this.promptOverride !== null) return this.promptOverride;
    if (this.replMode) return '> ';
    const cwd = this.cwd || '/workspace';
    return `codelab:${cwd}$ `;
  }

  private _getColoredPrompt(): string {
    if (this.searchMode) {
      return `\x1b[36m(reverse-i-search)\x1b[0m\`${this.searchQuery}': `;
    }
    if (this.promptOverride !== null) {
      return this.promptOverride;
    }
    if (this.replMode) {
      return '\x1b[1;32m>\x1b[0m ';
    }
    const rawCwd = this.cwd || '/workspace';
    const displayCwd = rawCwd === '/home/codelab'
      ? '~'
      : rawCwd.startsWith('/home/codelab/')
        ? '~' + rawCwd.slice('/home/codelab'.length)
        : rawCwd;
    return `\x1b[1;32mcodelab\x1b[0m:\x1b[1m${displayCwd}\x1b[0m$ `;
  }

  public setPrompt(p: string | null): void {
    this.promptOverride = p;
    this.updateActiveLine();
  }

  public setCwd(cwd: string): void {
    this.cwd = cwd || '/workspace';
    this.updateActiveLine();
  }

  public setReplMode(enabled: boolean): void {
    this.replMode = Boolean(enabled);
    this.updateActiveLine();
  }

  public setTheme(mode: 'dark' | 'light' | 'hc' | 'high-contrast'): void {
    this._themeMode = mode;
    if (this.xterm) {
      this.xterm.options.theme = getXtermTheme(mode);
    }
  }

  public setFontSize(fontSize: number): void {
    if (Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 28) {
      this.options.fontSize = fontSize;
      const surface = this.container?.querySelector('#cl-terminal-surface') as HTMLElement | null;
      if (surface) surface.style.fontSize = `${fontSize}px`;
      if (this.xterm) {
        this.xterm.options.fontSize = fontSize;
        this.fit();
      }
    }
  }

  public setMaxScrollback(max: number): void {
    const clamped = Number.isFinite(max) && max > 0 ? Math.floor(max) : 3000;
    this.maxScrollback = clamped;
    this.options.maxScrollback = clamped;
    if (this.xterm) {
      this.xterm.options.scrollback = clamped;
    }
    if (this.logs.length > clamped) {
      this.logs.splice(0, this.logs.length - clamped);
    }
    const logEl = this.container?.querySelector('#cl-terminal-log');
    if (logEl) {
      while (logEl.children.length > clamped && logEl.firstChild) {
        logEl.removeChild(logEl.firstChild);
      }
    }
  }

  public syncDomMirrorWithLogs(externalLogs?: Array<{ type: string; text: string }>): void {
    if (Array.isArray(externalLogs) && externalLogs !== this.logs) {
      this.logs.splice(0, this.logs.length, ...externalLogs);
    }
    if (this.logs.length > this.maxScrollback) {
      this.logs.splice(0, this.logs.length - this.maxScrollback);
    }
    const logEl = this.container?.querySelector('#cl-terminal-log');
    if (!logEl) return;
    if (logEl.children.length !== this.logs.length) {
      const prevCount = logEl.children.length;
      logEl.innerHTML = this.logs
        .map((item) => `<div class="codelab-log-line ${sanitizeLogType(item.type)}">${ansiToHtml(item.text)}</div>`)
        .join('');
      if (this.xterm) {
        if (this.logs.length === 0) {
          this.xterm.reset();
          this._promptVisibleInXterm = false;
          this.updateActiveLine();
        } else if (this.logs.length > prevCount) {
          this._eraseXtermPromptIfVisible();
          for (let i = prevCount; i < this.logs.length; i++) {
            const txt = String(this.logs[i]?.text || '');
            if (!txt) continue;
            const withNl = txt.endsWith('\n') ? txt : txt + '\n';
            this.xterm.write(this._toCrLf(withNl));
          }
          this._redrawXtermPromptLine();
        }
      }
    }
  }

  public isCommandRunning(): boolean {
    return Boolean(this.isBusy && this._readLineQueue.length === 0);
  }

  public fit(): void {
    if (this._disposed || !this.fitAddon || !this.xterm || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;
    try {
      this.fitAddon.fit();
      if (typeof this.options.onResize === 'function') {
        this.options.onResize(this.xterm.cols, this.xterm.rows);
      }
    } catch (_err) {
      void _err;
    }
  }

  private _scheduleFit(): void {
    if (this._disposed || typeof requestAnimationFrame !== 'function') return;
    if (this._fitRaf) cancelAnimationFrame(this._fitRaf);
    this._fitRaf = requestAnimationFrame(() => {
      this._fitRaf = 0;
      this.fit();
    });
  }

  private _toCrLf(raw: string): string {
    return raw.replace(/\r?\n/g, '\r\n');
  }

  private _eraseXtermPromptIfVisible(): void {
    if (this.xterm && this._promptVisibleInXterm) {
      this.xterm.write('\r\x1b[2K');
      this._promptVisibleInXterm = false;
    }
  }

  private _redrawXtermPromptLine(): void {
    if (!this.xterm) return;
    if (this.isCommandRunning()) {
      this._promptVisibleInXterm = false;
      return;
    }
    const coloredPrompt = this._getColoredPrompt();
    const afterLen = Math.max(0, this.buffer.length - this.cursor);
    const moveBack = afterLen > 0 ? `\x1b[${afterLen}D` : '';
    this.xterm.write(`\r\x1b[2K${coloredPrompt}${this.buffer}${moveBack}`);
    this._promptVisibleInXterm = true;
  }

  private _pushMirrorLog(type: string, text: string): { type: string; text: string } {
    const entry = { type: sanitizeLogType(type), text };
    this.logs.push(entry);
    if (this.logs.length > this.maxScrollback) {
      const excess = this.logs.length - this.maxScrollback;
      this.logs.splice(0, excess);
    }
    if (this.container) {
      const logEl = this.container.querySelector('#cl-terminal-log');
      if (logEl) {
        const lineEl = document.createElement('div');
        lineEl.className = 'codelab-log-line ' + entry.type;
        lineEl.innerHTML = ansiToHtml(entry.text);
        logEl.appendChild(lineEl);
        while (logEl.children.length > this.maxScrollback && logEl.firstChild) {
          logEl.removeChild(logEl.firstChild);
        }
      }
    }
    return entry;
  }

  private _appendMirrorStream(chunk: string, type: string): void {
    const combined = this._pendingMirrorLine + chunk;
    const clearIdx2 = combined.lastIndexOf('\x1b[2J');
    const clearIdx3 = combined.lastIndexOf('\x1b[3J');
    const clearRis = combined.lastIndexOf('\x1bc');
    const lastClear = Math.max(clearIdx2, clearIdx3, clearRis);
    let working = combined;
    if (lastClear !== -1) {
      const skipLen = lastClear === clearRis ? 2 : 4;
      working = combined.slice(lastClear + skipLen).replace(/^(?:\x1b\[[23]J|\x1b\[(?:\d+;\d+)?H)+/, '');
      this._clearMirrorDomOnly();
    }

    const normalized = working.replace(/\r\n/g, '\n');
    const parts = normalized.split('\n');
    for (let i = 0; i < parts.length - 1; i++) {
      const resolved = resolveAnsiControlCodes(parts[i]);
      if (this._activeMirrorEl && this.logs.length > 0) {
        this.logs[this.logs.length - 1].text = resolved + '\n';
        this._activeMirrorEl.innerHTML = ansiToHtml(resolved);
        this._activeMirrorEl = null;
      } else {
        this._pushMirrorLog(type, resolved + '\n');
      }
    }
    const tail = parts[parts.length - 1];
    this._pendingMirrorLine = tail;
    if (tail.length > 0) {
      const resolvedTail = resolveAnsiControlCodes(tail);
      if (this._activeMirrorEl && this.logs.length > 0) {
        this.logs[this.logs.length - 1].text = resolvedTail;
        this._activeMirrorEl.innerHTML = ansiToHtml(resolvedTail);
      } else {
        this._pushMirrorLog(type, resolvedTail);
        const logEl = this.container?.querySelector('#cl-terminal-log');
        this._activeMirrorEl = (logEl?.lastElementChild as HTMLElement) || null;
      }
    }
  }

  private _clearMirrorDomOnly(): void {
    this.logs.length = 0;
    this._pendingMirrorLine = '';
    this._activeMirrorEl = null;
    const logEl = this.container?.querySelector('#cl-terminal-log');
    if (logEl) logEl.innerHTML = '';
  }

  public writeStreamChunk(data: string, type: string = 'stdout'): void {
    const str = String(data ?? '');
    if (!str) return;

    this._eraseXtermPromptIfVisible();

    // Check if chunk contains screen-clear control codes (\x1b[2J, \x1b[3J, \x1bc)
    const clearIdx2 = str.lastIndexOf('\x1b[2J');
    const clearIdx3 = str.lastIndexOf('\x1b[3J');
    const clearRis = str.lastIndexOf('\x1bc');
    const lastClear = Math.max(clearIdx2, clearIdx3, clearRis);

    if (lastClear !== -1 && this.xterm) {
      const skipLen = lastClear === clearRis ? 2 : 4;
      const afterClear = str
        .slice(lastClear + skipLen)
        .replace(/^(?:\x1b\[[23]J|\x1b\[(?:\d+;\d+)?H)+/, '');
      this.xterm.reset();
      this._clearMirrorDomOnly();
      if (afterClear) {
        const colored = type === 'stderr' && !afterClear.includes('\x1b[')
          ? `\x1b[31m${this._toCrLf(afterClear)}\x1b[0m`
          : this._toCrLf(afterClear);
        this.xterm.write(colored);
        this._appendMirrorStream(afterClear, type);
      }
    } else {
      if (this.xterm) {
        const formatted = type === 'stderr' && !str.includes('\x1b[')
          ? `\x1b[31m${this._toCrLf(str)}\x1b[0m`
          : this._toCrLf(str);
        this.xterm.write(formatted);
      }
      this._appendMirrorStream(str, type);
    }

    if (!this.isCommandRunning()) {
      // Ensure prompt appears on a fresh line if streamed output did not end with \n
      if (this.xterm && this._pendingMirrorLine.length > 0) {
        this.xterm.write('\r\n');
        this._pendingMirrorLine = '';
        this._activeMirrorEl = null;
      }
      this._redrawXtermPromptLine();
    }
  }

  public write(data: string, type: string = 'stdout'): void {
    this.writeStreamChunk(data, type);
  }

  public writeln(data: string, type: string = 'stdout'): void {
    this.writeStreamChunk(String(data ?? '') + '\n', type);
  }

  public clear(): void {
    this._clearMirrorDomOnly();
    this._promptVisibleInXterm = false;
    if (this.xterm) {
      this.xterm.reset();
    }
    this.updateActiveLine();
  }

  public getHistory(): string[] {
    return [...this.history];
  }

  private _activateNextReadLine(): void {
    if (this._readLineQueue.length === 0) return;
    const head = this._readLineQueue[0];
    if (head && !head._activated) {
      head._activated = true;
      head.prevPrompt = this.promptOverride;
      this.promptOverride = head.promptText;
    }
  }

  private _drainReadLineQueue(result: string | null = null): void {
    if (this._readLineQueue.length === 0) return;
    const queued = this._readLineQueue.splice(0, this._readLineQueue.length);
    let restoredPrompt: string | null | undefined = undefined;
    for (const entry of queued) {
      if (entry._activated && restoredPrompt === undefined) {
        restoredPrompt = entry.prevPrompt;
      }
      if (entry.cleanup) entry.cleanup();
    }
    if (restoredPrompt !== undefined) {
      this.promptOverride = restoredPrompt;
    }
    for (const entry of queued) {
      try {
        entry.resolve(result);
      } catch (_err) {
        void _err;
      }
    }
  }

  public readLine(promptText: string = '', options: { signal?: AbortSignal } = {}): Promise<string | null> {
    if (options.signal?.aborted) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const item: ReadLineQueueItem = {
        promptText: String(promptText ?? ''),
        prevPrompt: null,
        _activated: false,
        cleanup: null,
        resolve
      };
      if (options.signal) {
        const onAbort = () => {
          const idx = this._readLineQueue.indexOf(item);
          if (idx !== -1) {
            this._readLineQueue.splice(idx, 1);
            if (item._activated) {
              this.promptOverride = item.prevPrompt;
              this._activateNextReadLine();
            }
            this.updateActiveLine();
            resolve(null);
          }
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
        item.cleanup = () => {
          options.signal?.removeEventListener('abort', onAbort);
        };
      }
      this._readLineQueue.push(item);
      this._activateNextReadLine();
      this.updateActiveLine();
    });
  }

  public focus(): void {
    if (this.xterm) {
      try {
        this.xterm.focus();
        return;
      } catch (_err) {
        void _err;
      }
    }
    const input = this.container?.querySelector('#cl-repl-input') as HTMLInputElement | null;
    input?.focus();
  }

  private _addDomListener(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this._domListeners.push({ target, type, fn });
  }

  private _cleanupDomListeners(): void {
    for (const l of this._domListeners) {
      try {
        l.target.removeEventListener(l.type, l.fn);
      } catch (_err) {
        void _err;
      }
    }
    this._domListeners = [];
  }

  public mount(container: HTMLElement): void {
    this.destroy();
    this._disposed = false;
    this.container = container;

    const initialLogsHtml = this.logs
      .map((item) => `<div class="codelab-log-line ${sanitizeLogType(item.type)}">${ansiToHtml(item.text)}</div>`)
      .join('');

    const fontPx = this.options.fontSize || 13;
    this.container.innerHTML = `
      <div class="codelab-terminal codelab-terminal--xterm" id="cl-terminal-surface" tabindex="0" style="font-size:${fontPx}px;">
        <div class="codelab-xterm-mount" id="cl-xterm-mount"></div>
        <div class="codelab-terminal__mirror" aria-hidden="true">
          <div class="codelab-terminal__log" id="cl-terminal-log">${initialLogsHtml}</div>
          <div class="codelab-pty__active-line" id="cl-pty-active-line">
            <span class="codelab-pty__prompt">${escapeHtml(this.getPrompt())}</span><span class="codelab-pty__before"></span><span class="codelab-pty__cursor blink"> </span><span class="codelab-pty__after"></span>
          </div>
        </div>
        <form class="codelab-repl" id="cl-repl-form" style="position:absolute;opacity:0;width:1px;height:1px;overflow:hidden;">
          <input type="text" class="codelab-repl__input" id="cl-repl-input" autocomplete="off" spellcheck="false" aria-label="Terminal command input" value="${escapeHtml(this.buffer)}">
        </form>
      </div>
    `;

    const xtermMount = this.container.querySelector('#cl-xterm-mount') as HTMLElement | null;
    const replInput = this.container.querySelector('#cl-repl-input') as HTMLInputElement | null;
    const replForm = this.container.querySelector('#cl-repl-form') as HTMLFormElement | null;
    const surface = this.container.querySelector('#cl-terminal-surface') as HTMLElement | null;

    if (xtermMount && canUseXtermInEnvironment(xtermMount)) {
      const { Terminal: XtermTerminal, FitAddon: XtermFitAddon, WebLinksAddon: XtermWebLinksAddon } =
        getXtermRuntimeClasses();
      const computedMono =
        typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
          ? window.getComputedStyle(xtermMount).getPropertyValue('--cl-font-mono').trim()
          : '';
      const term = new XtermTerminal({
        fontFamily:
          this.options.fontFamily ||
          computedMono ||
          '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: this.options.fontSize || 13,
        lineHeight: 1.35,
        cursorBlink: true,
        cursorStyle: 'block',
        convertEol: true,
        scrollback: this.maxScrollback,
        allowProposedApi: true,
        theme: getXtermTheme(this._themeMode)
      });

      const fitAddon = new XtermFitAddon();
      term.loadAddon(fitAddon);

      const webLinksAddon = new XtermWebLinksAddon((_event, uri) => {
        if (this.options.onOpenUrl) {
          const handled = this.options.onOpenUrl(uri);
          if (handled === true) return;
        }
        if (typeof window !== 'undefined') {
          window.open(uri, '_blank', 'noopener,noreferrer');
        }
      });
      term.loadAddon(webLinksAddon);

      // Register file:line:col clickable diagnostic links
      term.registerLinkProvider({
        provideLinks: (bufferLineNumber, callback) => {
          const line = term.buffer.active.getLine(bufferLineNumber - 1);
          if (!line) {
            callback(undefined);
            return;
          }
          const lineText = line.translateToString(true);
          const links: Array<{
            range: { start: { x: number; y: number }; end: { x: number; y: number } };
            text: string;
            activate: () => void;
          }> = [];
          FILE_LINK_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = FILE_LINK_RE.exec(lineText)) !== null) {
            const fullMatch = m[0];
            const relFile = m[1];
            const lineNum = Number(m[2] || m[4] || 1);
            const colNum = Number(m[3] || m[5] || 1);
            const startX = m.index + 1;
            const endX = m.index + fullMatch.length;
            links.push({
              range: {
                start: { x: startX, y: bufferLineNumber },
                end: { x: endX, y: bufferLineNumber }
              },
              text: fullMatch,
              activate: () => {
                if (this.options.onOpenFileLink) {
                  this.options.onOpenFileLink(relFile, lineNum, colNum);
                }
              }
            });
          }
          callback(links.length > 0 ? links : undefined);
        }
      });

      term.attachCustomKeyEventHandler((ev: KeyboardEvent) => {
        if (ev.type !== 'keydown') return true;
        const isMetaOnly = ev.metaKey && !ev.ctrlKey;
        const isCtrlOnly = ev.ctrlKey && !ev.metaKey;
        // Cmd+C (macOS) or Ctrl+Shift+C copies selection when present
        if ((isMetaOnly && (ev.key === 'c' || ev.key === 'C')) || (isCtrlOnly && ev.shiftKey && (ev.key === 'c' || ev.key === 'C'))) {
          if (term.hasSelection() && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          }
          return false;
        }
        // Cmd+K clears terminal on macOS
        if (isMetaOnly && (ev.key === 'k' || ev.key === 'K')) {
          ev.preventDefault();
          this.clear();
          return false;
        }
        // Allow workbench toggle shortcuts (Ctrl+`, Cmd+J, Cmd+P, Cmd+Shift+P) to bubble to workbench
        if (ev.ctrlKey && ev.key === '`') {
          return false;
        }
        if (isMetaOnly && (ev.key === 'p' || ev.key === 'P' || ev.key === 'j' || ev.key === 'J')) {
          return false;
        }
        return true;
      });

      term.open(xtermMount);
      this.xterm = term;
      this.fitAddon = fitAddon;

      // Replay initial logs if session already had history before remount
      for (const entry of this.logs) {
        const txt = String(entry.text || '');
        if (!txt) continue;
        const withNewline = txt.endsWith('\n') ? txt : txt + '\n';
        term.write(this._toCrLf(withNewline));
      }

      term.onData((data) => {
        this._handleXtermData(data);
      });

      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          this._scheduleFit();
        });
        this._resizeObserver.observe(xtermMount);
      }

      this._scheduleFit();
      this.updateActiveLine();
    }

    if (surface) {
      this._addDomListener(surface, 'click', (e) => {
        if (e.target === replInput) return;
        if (this.xterm && this.xterm.hasSelection()) return;
        this.focus();
      });
    }

    if (replInput) {
      const syncFromReplInput = () => {
        if (this.isCommandRunning()) {
          replInput.value = '';
          return;
        }
        const nextVal = replInput.value || '';
        const nextPos = typeof replInput.selectionStart === 'number' ? replInput.selectionStart : nextVal.length;
        if (nextVal !== this.buffer || nextPos !== this.cursor) {
          this.buffer = nextVal;
          this.cursor = nextPos;
          this.updateActiveLine();
        }
      };
      this._addDomListener(replInput, 'keydown', (e) => {
        this.handleKeyDown(e as KeyboardEvent);
      });
      this._addDomListener(replInput, 'paste', (e) => {
        const ce = e as ClipboardEvent;
        const text = ce.clipboardData?.getData('text/plain') || '';
        if (text && text.includes('\n')) {
          ce.preventDefault();
          void this.pasteText(text);
        }
      });
      this._addDomListener(replInput, 'input', syncFromReplInput);
      this._addDomListener(replInput, 'change', syncFromReplInput);
      this._addDomListener(replInput, 'click', syncFromReplInput);
      this._addDomListener(replInput, 'keyup', (e) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'ArrowLeft' || ke.key === 'ArrowRight' || ke.key === 'Home' || ke.key === 'End') {
          syncFromReplInput();
        }
      });
    }

    if (replForm) {
      this._addDomListener(replForm, 'submit', (e) => {
        e.preventDefault();
        this.submitLine();
      });
    }
  }

  private _findReverseSearchMatch(query: string, startIdx?: number): number {
    if (!query || !this.history.length) return -1;
    const from = typeof startIdx === 'number' ? Math.min(startIdx, this.history.length - 1) : this.history.length - 1;
    for (let i = from; i >= 0; i--) {
      if (this.history[i] && this.history[i].includes(query)) return i;
    }
    return -1;
  }

  private _handleInterrupt(): void {
    const wasBusy = this.isBusy || this._readLineQueue.length > 0;
    this.isBusy = false;
    if (this.xterm) {
      this.xterm.write('^C\r\n');
      this._promptVisibleInXterm = false;
    }
    this._pushMirrorLog('system', wasBusy ? '^C' : `${this.getPrompt()}${this.buffer}^C`);
    this.buffer = '';
    this.cursor = 0;
    this.historyIdx = -1;
    this.searchMode = false;
    this.searchQuery = '';
    this.searchMatchIdx = -1;
    this._drainReadLineQueue(null);
    if (this.replMode) this.replMode = false;
    if (this.onInterrupt) {
      try {
        this.onInterrupt();
      } catch (_err) {
        void _err;
      }
    }
    this.updateActiveLine();
  }

  private _handleXtermData(data: string): void {
    if (!data) return;

    // Multi-char paste without ESC prefix
    if (data.length > 1 && !data.startsWith('\x1b')) {
      if (data.includes('\x03')) {
        this._handleInterrupt();
        return;
      }
      void this.pasteText(data);
      return;
    }

    // Ctrl+C
    if (data === '\x03') {
      this._handleInterrupt();
      return;
    }

    // Ctrl+L
    if (data === '\x0c') {
      this.clear();
      return;
    }

    if (this.isCommandRunning()) {
      return;
    }

    // Ctrl+R (reverse history search)
    if (data === '\x12') {
      if (!this.searchMode) {
        this.searchMode = true;
        this.searchQuery = '';
        this.searchMatchIdx = -1;
      } else if (this.searchQuery) {
        const nextStart = this.searchMatchIdx > 0 ? this.searchMatchIdx - 1 : this.history.length - 1;
        const mIdx = this._findReverseSearchMatch(this.searchQuery, nextStart);
        if (mIdx !== -1) {
          this.searchMatchIdx = mIdx;
          this.buffer = this.history[mIdx];
          this.cursor = this.buffer.length;
        }
      }
      this.updateActiveLine();
      return;
    }

    if (this.searchMode) {
      if (data === '\x1b' || data === '\x07') {
        this.searchMode = false;
        this.searchQuery = '';
        this.searchMatchIdx = -1;
        this.updateActiveLine();
        return;
      }
      if (data === '\x7f' || data === '\b') {
        this.searchQuery = this.searchQuery.slice(0, -1);
        const mIdx = this._findReverseSearchMatch(this.searchQuery, this.history.length - 1);
        this.searchMatchIdx = mIdx;
        if (mIdx !== -1) {
          this.buffer = this.history[mIdx];
          this.cursor = this.buffer.length;
        }
        this.updateActiveLine();
        return;
      }
      if (data === '\r' || data === '\n') {
        this.searchMode = false;
        this.searchQuery = '';
        this.searchMatchIdx = -1;
        this.submitLine();
        return;
      }
      if (data >= ' ' && !data.startsWith('\x1b')) {
        this.searchQuery += data;
        const mIdx = this._findReverseSearchMatch(this.searchQuery, this.history.length - 1);
        this.searchMatchIdx = mIdx;
        if (mIdx !== -1) {
          this.buffer = this.history[mIdx];
          this.cursor = this.buffer.length;
        }
        this.updateActiveLine();
        return;
      }
      this.searchMode = false;
      this.searchQuery = '';
      this.searchMatchIdx = -1;
    }

    // Enter
    if (data === '\r' || data === '\n') {
      this.submitLine();
      return;
    }

    // Ctrl+D (EOF on empty buffer)
    if (data === '\x04') {
      if (this.buffer === '') {
        if (this._readLineQueue.length > 0) {
          if (this.xterm) {
            this.xterm.write('\r\n');
            this._promptVisibleInXterm = false;
          }
          this._drainReadLineQueue(null);
          this.updateActiveLine();
          return;
        }
        if (this.replMode) {
          this.replMode = false;
          if (this.xterm) {
            this.xterm.write('\r\n');
            this._promptVisibleInXterm = false;
          }
          this.updateActiveLine();
          return;
        }
      }
      return;
    }

    // Backspace
    if (data === '\x7f' || data === '\b') {
      if (this.cursor > 0) {
        this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
        this.cursor--;
        this.updateActiveLine();
      }
      return;
    }

    // Delete
    if (data === '\x1b[3~') {
      if (this.cursor < this.buffer.length) {
        this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
        this.updateActiveLine();
      }
      return;
    }

    // Tab
    if (data === '\t') {
      this.autoComplete();
      return;
    }

    // ArrowUp / ArrowDown
    if (data === '\x1b[A') {
      if (!this.history.length) return;
      if (this.historyIdx === -1) {
        this.savedBuffer = this.buffer;
        this.historyIdx = this.history.length - 1;
      } else if (this.historyIdx > 0) {
        this.historyIdx--;
      }
      this.buffer = this.history[this.historyIdx] || '';
      this.cursor = this.buffer.length;
      this.updateActiveLine();
      return;
    }
    if (data === '\x1b[B') {
      if (this.historyIdx !== -1) {
        if (this.historyIdx < this.history.length - 1) {
          this.historyIdx++;
          this.buffer = this.history[this.historyIdx] || '';
        } else {
          this.historyIdx = -1;
          this.buffer = this.savedBuffer || '';
        }
        this.cursor = this.buffer.length;
        this.updateActiveLine();
      }
      return;
    }

    // ArrowLeft / ArrowRight
    if (data === '\x1b[D') {
      if (this.cursor > 0) {
        this.cursor--;
        this.updateActiveLine();
      }
      return;
    }
    if (data === '\x1b[C') {
      if (this.cursor < this.buffer.length) {
        this.cursor++;
        this.updateActiveLine();
      }
      return;
    }

    // Word backward / forward (Alt+B / Alt+Left / Ctrl+Left, Alt+F / Alt+Right / Ctrl+Right)
    if (data === '\x1bb' || data === '\x1b[1;3D' || data === '\x1b[1;5D') {
      let pos = this.cursor;
      while (pos > 0 && /\s/.test(this.buffer[pos - 1])) pos--;
      while (pos > 0 && !/\s/.test(this.buffer[pos - 1])) pos--;
      this.cursor = pos;
      this.updateActiveLine();
      return;
    }
    if (data === '\x1bf' || data === '\x1b[1;3C' || data === '\x1b[1;5C') {
      let pos = this.cursor;
      while (pos < this.buffer.length && /\s/.test(this.buffer[pos])) pos++;
      while (pos < this.buffer.length && !/\s/.test(this.buffer[pos])) pos++;
      this.cursor = pos;
      this.updateActiveLine();
      return;
    }

    // Home / Ctrl+A
    if (data === '\x01' || data === '\x1b[H' || data === '\x1bOH' || data === '\x1b[1~') {
      this.cursor = 0;
      this.updateActiveLine();
      return;
    }

    // End / Ctrl+E
    if (data === '\x05' || data === '\x1b[F' || data === '\x1bOF' || data === '\x1b[4~') {
      this.cursor = this.buffer.length;
      this.updateActiveLine();
      return;
    }

    // Ctrl+U (kill before cursor)
    if (data === '\x15') {
      this.buffer = this.buffer.slice(this.cursor);
      this.cursor = 0;
      this.updateActiveLine();
      return;
    }

    // Ctrl+K (kill after cursor)
    if (data === '\x0b') {
      this.buffer = this.buffer.slice(0, this.cursor);
      this.updateActiveLine();
      return;
    }

    // Ctrl+W / Alt+Backspace (delete word backward)
    if (data === '\x17' || data === '\x1b\x7f') {
      let pos = this.cursor;
      while (pos > 0 && /\s/.test(this.buffer[pos - 1])) pos--;
      while (pos > 0 && !/\s/.test(this.buffer[pos - 1])) pos--;
      this.buffer = this.buffer.slice(0, pos) + this.buffer.slice(this.cursor);
      this.cursor = pos;
      this.updateActiveLine();
      return;
    }

    // Printable character
    if (data >= ' ' && !data.startsWith('\x1b')) {
      this.buffer = this.buffer.slice(0, this.cursor) + data + this.buffer.slice(this.cursor);
      this.cursor += data.length;
      this.updateActiveLine();
    }
  }

  public handleKeyDown(e: KeyboardEvent): void {
    if (!e) return;
    const key = e.key;
    const isCtrlOnly = Boolean(e.ctrlKey && !e.metaKey);
    const isMetaOnly = Boolean(e.metaKey && !e.ctrlKey);
    const isCtrl = Boolean(e.ctrlKey || e.metaKey);
    const isFromReplInput = Boolean(e.target && (e.target as HTMLElement).id === 'cl-repl-input');

    if ((isCtrl && (key === 'l' || key === 'L')) || (isMetaOnly && (key === 'k' || key === 'K'))) {
      e.preventDefault?.();
      this.clear();
      return;
    }
    if (isMetaOnly && (key === 'c' || key === 'C' || key === 'v' || key === 'V' || key === 'a' || key === 'A' || key === 'x' || key === 'X')) {
      return;
    }
    if (isCtrlOnly && (key === 'c' || key === 'C')) {
      if (e.shiftKey) return;
      e.preventDefault?.();
      this._handleInterrupt();
      return;
    }
    if (this.isCommandRunning()) {
      e.preventDefault?.();
      return;
    }
    if (isCtrl && (key === 'r' || key === 'R')) {
      e.preventDefault?.();
      this._handleXtermData('\x12');
      return;
    }
    if (key === 'Enter') {
      e.preventDefault?.();
      this._handleXtermData('\r');
      return;
    }
    if (key === 'Tab') {
      e.preventDefault?.();
      this._handleXtermData('\t');
      return;
    }
    if (key === 'ArrowUp') {
      e.preventDefault?.();
      this._handleXtermData('\x1b[A');
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault?.();
      this._handleXtermData('\x1b[B');
      return;
    }
    if (isCtrlOnly && (key === 'u' || key === 'U')) {
      e.preventDefault?.();
      this._handleXtermData('\x15');
      return;
    }
    if (isCtrlOnly && (key === 'k' || key === 'K')) {
      e.preventDefault?.();
      this._handleXtermData('\x0b');
      return;
    }
    if (isCtrlOnly && (key === 'w' || key === 'W')) {
      e.preventDefault?.();
      this._handleXtermData('\x17');
      return;
    }
    if (isCtrlOnly && (key === 'd' || key === 'D')) {
      e.preventDefault?.();
      this._handleXtermData('\x04');
      return;
    }
    if (key === 'Escape') {
      e.preventDefault?.();
      this._handleXtermData('\x1b');
      return;
    }
    if (isFromReplInput) {
      // Allow native HTMLInputElement editing (typing, Backspace, Delete, SelectAll + fill(''), caret arrows)
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault?.();
      this._handleXtermData(e.altKey ? '\x1b\x7f' : '\x7f');
      return;
    }
    if (key === 'Delete') {
      e.preventDefault?.();
      this._handleXtermData('\x1b[3~');
      return;
    }
    if (key === 'ArrowLeft') {
      e.preventDefault?.();
      this._handleXtermData(e.altKey || isCtrlOnly ? '\x1b[1;5D' : '\x1b[D');
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault?.();
      this._handleXtermData(e.altKey || isCtrlOnly ? '\x1b[1;5C' : '\x1b[C');
      return;
    }
    if (key === 'Home' || (isCtrlOnly && (key === 'a' || key === 'A'))) {
      e.preventDefault?.();
      this._handleXtermData('\x01');
      return;
    }
    if (key === 'End' || (isCtrlOnly && (key === 'e' || key === 'E'))) {
      e.preventDefault?.();
      this._handleXtermData('\x05');
      return;
    }
    if (e.altKey && (key === 'b' || key === 'B')) {
      e.preventDefault?.();
      this._handleXtermData('\x1bb');
      return;
    }
    if (e.altKey && (key === 'f' || key === 'F')) {
      e.preventDefault?.();
      this._handleXtermData('\x1bf');
      return;
    }
    if (key && key.length === 1 && !isCtrl && !e.altKey) {
      e.preventDefault?.();
      this._handleXtermData(key);
    }
  }

  public autoComplete(): void {
    if (!this.getCompletions) return;
    const res = this.getCompletions(this.buffer, this.cursor);
    if (!res || !Array.isArray(res.matches) || res.matches.length === 0) return;

    const matches = res.matches;
    if (matches.length === 1) {
      const match = matches[0];
      const appendChar = match.endsWith('/') ? '' : ' ';
      const before = this.buffer.slice(0, res.tokenStart);
      const after = this.buffer.slice(this.cursor);
      this.buffer = before + match + appendChar + after;
      this.cursor = before.length + match.length + appendChar.length;
      this.updateActiveLine();
      return;
    }

    let lcp = matches[0];
    for (let i = 1; i < matches.length; i++) {
      let j = 0;
      while (j < lcp.length && j < matches[i].length && lcp[j] === matches[i][j]) j++;
      lcp = lcp.slice(0, j);
    }
    if (lcp.length > res.token.length) {
      const before = this.buffer.slice(0, res.tokenStart);
      const after = this.buffer.slice(this.cursor);
      this.buffer = before + lcp + after;
      this.cursor = before.length + lcp.length;
    }

    const candidatesLine = matches.join('  ');
    if (this.xterm) {
      this.xterm.write(`\r\n${candidatesLine}\r\n`);
      this._promptVisibleInXterm = false;
    }
    this._pushMirrorLog('system', `${this.getPrompt()}${this.buffer}`);
    this._pushMirrorLog('stdout', candidatesLine);
    this.updateActiveLine();
  }

  public async pasteText(rawText: string): Promise<void> {
    if (!rawText || this.isCommandRunning()) return;
    const normalized = String(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!normalized.includes('\n')) {
      this.buffer = this.buffer.slice(0, this.cursor) + normalized + this.buffer.slice(this.cursor);
      this.cursor += normalized.length;
      this.updateActiveLine();
      return;
    }
    const parts = normalized.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (i < parts.length - 1) {
        this.buffer = this.buffer.slice(0, this.cursor) + seg + this.buffer.slice(this.cursor);
        this.cursor = this.buffer.length;
        this.updateActiveLine();
        this.submitLine();
        while (this.isCommandRunning()) {
          await new Promise((r) => setTimeout(r, 10));
        }
      } else if (seg.length > 0) {
        this.buffer = seg;
        this.cursor = seg.length;
        this.updateActiveLine();
      }
    }
  }

  public submitLine(): void {
    // 1. Resolve interactive stdin readLine request if one is waiting
    if (this._readLineQueue.length > 0) {
      const line = this.buffer;
      const promptSnap = this.getPrompt();
      if (this.xterm) {
        this._redrawXtermPromptLine();
        this.xterm.write('\r\n');
        this._promptVisibleInXterm = false;
      }
      this._pushMirrorLog('system', `${promptSnap}${line}`);
      this.buffer = '';
      this.cursor = 0;
      this.historyIdx = -1;
      this.searchMode = false;
      this.searchQuery = '';
      this.searchMatchIdx = -1;

      const entry = this._readLineQueue.shift();
      if (entry) {
        entry.cleanup?.();
        this.promptOverride = entry.prevPrompt;
        this._activateNextReadLine();
        this.updateActiveLine();
        entry.resolve(line);
      }
      return;
    }

    if (this.isBusy) return;

    const line = this.buffer;
    const promptSnap = this.getPrompt();
    if (this.xterm) {
      this._redrawXtermPromptLine();
      this.xterm.write('\r\n');
      this._promptVisibleInXterm = false;
    }

    this.buffer = '';
    this.cursor = 0;
    this.historyIdx = -1;
    this.searchMode = false;
    this.searchQuery = '';
    this.searchMatchIdx = -1;
    this._pendingMirrorLine = '';
    this._activeMirrorEl = null;

    this._pushMirrorLog('system', `${promptSnap}${line}`);

    const trimmed = line.trim();
    if (trimmed && this.history[this.history.length - 1] !== trimmed) {
      this.history.push(trimmed);
      if (this.history.length > this.maxHistory) {
        this.history.splice(0, this.history.length - this.maxHistory);
      }
    }

    if (!this.onCommand) {
      this.updateActiveLine();
      return;
    }

    if (!trimmed) {
      this.updateActiveLine();
      return;
    }

    this.isBusy = true;
    this.updateActiveLine();

    let cmdRes: unknown;
    try {
      cmdRes = this.onCommand(line);
    } catch (err) {
      this.isBusy = false;
      this.updateActiveLine();
      throw err;
    }

    if (cmdRes && typeof (cmdRes as Promise<unknown>).then === 'function') {
      Promise.resolve(cmdRes)
        .catch(() => {})
        .finally(() => {
          if (this._disposed) return;
          if (this.xterm && this._pendingMirrorLine.length > 0) {
            this.xterm.write('\r\n');
            this._pendingMirrorLine = '';
            this._activeMirrorEl = null;
          }
          this.isBusy = false;
          this.updateActiveLine();
        });
    } else {
      if (this.xterm && this._pendingMirrorLine.length > 0) {
        this.xterm.write('\r\n');
        this._pendingMirrorLine = '';
        this._activeMirrorEl = null;
      }
      this.isBusy = false;
      this.updateActiveLine();
    }
  }

  public updateActiveLine(): void {
    this._redrawXtermPromptLine();

    if (!this.container) return;
    const input = this.container.querySelector('#cl-repl-input') as HTMLInputElement | null;
    if (input) {
      if (input.value !== this.buffer) {
        input.value = this.buffer;
      }
      if (typeof document !== 'undefined' && document.activeElement === input && typeof input.setSelectionRange === 'function') {
        try {
          input.setSelectionRange(this.cursor, this.cursor);
        } catch (_err) {
          void _err;
        }
      }
    }
    const lineEl = this.container.querySelector('#cl-pty-active-line') as HTMLElement | null;
    if (!lineEl) return;

    if (this.isCommandRunning()) {
      lineEl.setAttribute('data-busy', 'true');
      lineEl.style.display = 'none';
      lineEl.innerHTML =
        '<span class="codelab-pty__prompt"></span><span class="codelab-pty__before"></span><span class="codelab-pty__cursor"></span><span class="codelab-pty__after"></span>';
      return;
    }

    lineEl.removeAttribute('data-busy');
    lineEl.style.display = '';
    const prompt = this.searchMode
      ? `(reverse-i-search)\`${this.searchQuery}\`: `
      : this.getPrompt();
    const before = this.buffer.slice(0, this.cursor);
    const cursorChar = this.cursor < this.buffer.length ? this.buffer[this.cursor] : ' ';
    const after = this.cursor < this.buffer.length ? this.buffer.slice(this.cursor + 1) : '';
    lineEl.innerHTML = `<span class="codelab-pty__prompt">${escapeHtml(prompt)}</span><span class="codelab-pty__before">${escapeHtml(before)}</span><span class="codelab-pty__cursor blink">${escapeHtml(cursorChar)}</span><span class="codelab-pty__after">${escapeHtml(after)}</span>`;
  }

  public render(): void {
    if (this.container && !this.xterm) {
      this.mount(this.container);
      return;
    }
    this.updateActiveLine();
    this._scheduleFit();
  }

  public destroy(): void {
    this._disposed = true;
    this._drainReadLineQueue(null);
    this._cleanupDomListeners();
    if (this._fitRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._fitRaf);
      this._fitRaf = 0;
    }
    if (this._resizeObserver) {
      try {
        this._resizeObserver.disconnect();
      } catch (_err) {
        void _err;
      }
      this._resizeObserver = null;
    }
    if (this.xterm) {
      try {
        this.xterm.dispose();
      } catch (_err) {
        void _err;
      }
      this.xterm = null;
    }
    this.fitAddon = null;
    this._promptVisibleInXterm = false;
  }
}

export function createXtermTerminalEngine(
  container: HTMLElement | null,
  options: XtermAdapterOptions = {}
): XtermTerminalEngine {
  return new XtermTerminalEngine(container, options);
}
