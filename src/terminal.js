/**
 * @innovatorved/code-lab - Pure-JS PTY Terminal Emulator Component
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

(function (root, factory) {
  const exports = factory();
  if (root) {
    root.CodeLabTerminal = exports;
    root.PTYTerminalEngine = exports.PTYTerminalEngine;
    root.createPTYTerminalEngine = exports.createPTYTerminalEngine;
    root.createTerminal = exports.createTerminal;
    root.ansiToHtml = exports.ansiToHtml;
    root.parseAnsiToHtml = exports.parseAnsiToHtml;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return exports; });
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  const ANSI_CODE_MAP = {
    1: 'cl-ansi-bold',
    2: 'cl-ansi-dim',
    3: 'cl-ansi-italic',
    4: 'cl-ansi-underline',
    30: 'cl-ansi-black',
    31: 'cl-ansi-red',
    32: 'cl-ansi-green',
    33: 'cl-ansi-yellow',
    34: 'cl-ansi-blue',
    35: 'cl-ansi-magenta',
    36: 'cl-ansi-cyan',
    37: 'cl-ansi-white',
    90: 'cl-ansi-gray',
    91: 'cl-ansi-bright-red',
    92: 'cl-ansi-bright-green',
    93: 'cl-ansi-bright-yellow',
    94: 'cl-ansi-bright-blue',
    95: 'cl-ansi-bright-magenta',
    96: 'cl-ansi-bright-cyan',
    97: 'cl-ansi-bright-white',
    40: 'cl-ansi-bg-black',
    41: 'cl-ansi-bg-red',
    42: 'cl-ansi-bg-green',
    43: 'cl-ansi-bg-yellow',
    44: 'cl-ansi-bg-blue',
    45: 'cl-ansi-bg-magenta',
    46: 'cl-ansi-bg-cyan',
    47: 'cl-ansi-bg-white',
    100: 'cl-ansi-bg-bright-black',
    101: 'cl-ansi-bg-bright-red',
    102: 'cl-ansi-bg-bright-green',
    103: 'cl-ansi-bg-bright-yellow',
    104: 'cl-ansi-bg-bright-blue',
    105: 'cl-ansi-bg-bright-magenta',
    106: 'cl-ansi-bg-bright-cyan',
    107: 'cl-ansi-bg-bright-white'
  };

  const ANSI_256_PALETTE = [
    '#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
    '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff'
  ];

  function ansi256ToColor(n) {
    const idx = Number(n);
    if (!Number.isFinite(idx) || idx < 0 || idx > 255) return null;
    if (idx < 16) return ANSI_256_PALETTE[idx];
    if (idx < 232) {
      const c = idx - 16;
      const r = Math.floor(c / 36);
      const g = Math.floor((c % 36) / 6);
      const b = c % 6;
      const toChannel = v => (v === 0 ? 0 : 55 + v * 40);
      return `rgb(${toChannel(r)}, ${toChannel(g)}, ${toChannel(b)})`;
    }
    const gray = 8 + (idx - 232) * 10;
    return `rgb(${gray}, ${gray}, ${gray})`;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveAnsiControlCodes(raw) {
    if (!raw) return '';
    const s = String(raw);
    if (!s.includes('\x1b') && !s.includes('\r')) return s;

    let text = s;
    const lastClearScreen = text.lastIndexOf('\x1b[2J');
    if (lastClearScreen !== -1) {
      text = text.slice(lastClearScreen + 4);
      text = text.replace(/^\x1b\[(?:1;1)?H/, '');
    }

    text = text.replace(/\r\n/g, '\n');
    const rawLines = text.split('\n');
    const resolvedLines = [];

    for (let l = 0; l < rawLines.length; l++) {
      let line = rawLines[l];

      while (/\x1b\[(?:1)?A/.test(line)) {
        const upMatch = /\x1b\[(?:1)?A/.exec(line);
        const beforeUp = line.slice(0, upMatch.index);
        let afterUp = line.slice(upMatch.index + upMatch[0].length);
        if (resolvedLines.length > 0) {
          if (afterUp.includes('\x1b[2K')) {
            afterUp = afterUp.slice(afterUp.lastIndexOf('\x1b[2K') + 4);
            resolvedLines[resolvedLines.length - 1] = afterUp;
          } else if (afterUp.includes('\r')) {
            const parts = afterUp.split('\r');
            resolvedLines[resolvedLines.length - 1] = parts[parts.length - 1];
          } else {
            resolvedLines[resolvedLines.length - 1] = afterUp;
          }
          line = beforeUp;
        } else {
          line = beforeUp + afterUp;
        }
      }

      if (line.includes('\x1b[2K')) {
        const idx = line.lastIndexOf('\x1b[2K');
        line = line.slice(idx + 4);
      }

      if (line.includes('\r')) {
        const parts = line.split('\r');
        line = parts[parts.length - 1];
      }

      line = line.replace(/\x1b\[[0]?K/g, '');
      line = line.replace(/\x1b\[(?:1)?G/g, '');
      resolvedLines.push(line);
    }

    return resolvedLines.join('\n');
  }

  function ansiToHtml(str) {
    if (!str) return '';
    const resolved = resolveAnsiControlCodes(String(str));
    if (!resolved.includes('\x1b[')) {
      return escapeHtml(resolved);
    }

    // Strip non-color cursor control sequences without stripping lowercase 'm' SGR codes
    const cleaned = resolved.replace(/\x1b\[[0-9;?]*(?!m)[A-Za-z]/g, '');

    const tokenRegex = /\x1b\[([0-9;]*)m/g;
    let result = '';
    let lastIdx = 0;
    let match;

    const state = {
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      fgClass: null,
      bgClass: null,
      fgColor: null,
      bgColor: null
    };

    const resetState = () => {
      state.bold = false;
      state.dim = false;
      state.italic = false;
      state.underline = false;
      state.fgClass = null;
      state.bgClass = null;
      state.fgColor = null;
      state.bgColor = null;
    };

    const renderChunk = (rawText) => {
      if (!rawText) return '';
      const escaped = escapeHtml(rawText);
      const classes = [];
      if (state.bold) classes.push('cl-ansi-bold');
      if (state.dim) classes.push('cl-ansi-dim');
      if (state.italic) classes.push('cl-ansi-italic');
      if (state.underline) classes.push('cl-ansi-underline');
      if (state.fgClass) classes.push(state.fgClass);
      if (state.bgClass) classes.push(state.bgClass);

      const styles = [];
      if (state.fgColor) styles.push(`color:${state.fgColor}`);
      if (state.bgColor) styles.push(`background-color:${state.bgColor}`);

      if (classes.length === 0 && styles.length === 0) {
        return escaped;
      }
      const classAttr = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
      const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
      return `<span${classAttr}${styleAttr}>${escaped}</span>`;
    };

    while ((match = tokenRegex.exec(cleaned)) !== null) {
      const rawText = cleaned.slice(lastIdx, match.index);
      if (rawText) result += renderChunk(rawText);
      lastIdx = tokenRegex.lastIndex;

      const codes = match[1] ? match[1].split(';').map(Number) : [0];
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        if (code === 0 || Number.isNaN(code)) {
          resetState();
        } else if (code === 1) {
          state.bold = true;
        } else if (code === 2) {
          state.dim = true;
        } else if (code === 3) {
          state.italic = true;
        } else if (code === 4) {
          state.underline = true;
        } else if (code === 22) {
          state.bold = false;
          state.dim = false;
        } else if (code === 23) {
          state.italic = false;
        } else if (code === 24) {
          state.underline = false;
        } else if (code === 39) {
          state.fgClass = null;
          state.fgColor = null;
        } else if (code === 49) {
          state.bgClass = null;
          state.bgColor = null;
        } else if ((code === 38 || code === 48) && codes[i + 1] === 5 && i + 2 < codes.length) {
          const color = ansi256ToColor(codes[i + 2]);
          if (color) {
            if (code === 38) {
              state.fgClass = null;
              state.fgColor = color;
            } else {
              state.bgClass = null;
              state.bgColor = color;
            }
          }
          i += 2;
        } else if ((code === 38 || code === 48) && codes[i + 1] === 2 && i + 4 < codes.length) {
          const r = Math.max(0, Math.min(255, Number(codes[i + 2]) || 0));
          const g = Math.max(0, Math.min(255, Number(codes[i + 3]) || 0));
          const b = Math.max(0, Math.min(255, Number(codes[i + 4]) || 0));
          const color = `rgb(${r}, ${g}, ${b})`;
          if (code === 38) {
            state.fgClass = null;
            state.fgColor = color;
          } else {
            state.bgClass = null;
            state.bgColor = color;
          }
          i += 4;
        } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
          state.fgClass = ANSI_CODE_MAP[code] || null;
          state.fgColor = null;
        } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
          state.bgClass = ANSI_CODE_MAP[code] || null;
          state.bgColor = null;
        }
      }
    }

    const remaining = cleaned.slice(lastIdx);
    if (remaining) result += renderChunk(remaining);
    return result;
  }

  const parseAnsiToHtml = ansiToHtml;

  class PTYTerminalEngine {
    constructor(container, options = {}) {
      if (
        container &&
        typeof container === 'object' &&
        typeof container.querySelector !== 'function' &&
        typeof container.appendChild !== 'function' &&
        arguments.length === 1
      ) {
        options = container;
        container = options.container || null;
      }
      this.container = container || null;
      this.options = options || {};
      this.logs = Array.isArray(this.options.logs) ? this.options.logs : [];
      this.cwd = this.options.cwd || '/workspace';
      this.replMode = Boolean(this.options.replMode);
      this.promptOverride = this.options.prompt || null;
      this.history = Array.isArray(this.options.history) ? this.options.history : [];
      this.historyIdx = -1;
      this.savedBuffer = '';
      this.buffer = '';
      this.cursor = 0;
      this.searchMode = false;
      this.searchQuery = '';
      this.searchMatchIdx = -1;
      this._readLineQueue = [];
      this.onCommand = typeof this.options.onCommand === 'function' ? this.options.onCommand : null;
      this.getCompletions = typeof this.options.getCompletions === 'function' ? this.options.getCompletions : null;
      this.onKey = typeof this.options.onKey === 'function' ? this.options.onKey : null;
      this.onInterrupt = typeof this.options.onInterrupt === 'function' ? this.options.onInterrupt : null;

      // Stream & active line buffering state
      this._activeLineCommitted = true;
      this._cursorCol = 0;
      this._pendingEscape = '';
      this._targetLineIdx = -1;
      this._needsRewrite = false;
      this._activeLineEl = null;

      this._mounted = false;
      this._listeners = [];

      if (this.container) {
        this.mount(this.container);
      }
    }

    getPrompt() {
      if (this.promptOverride) return this.promptOverride;
      if (this.replMode) return '> ';
      const cwd = this.cwd || '/workspace';
      return `codelab:${cwd}$ `;
    }

    setPrompt(p) {
      this.promptOverride = p;
      this.updateActiveLine();
    }

    setCwd(cwd) {
      this.cwd = cwd;
      this.updateActiveLine();
    }

    setReplMode(enabled) {
      this.replMode = Boolean(enabled);
      this.updateActiveLine();
    }

    writeStreamChunk(data, type = 'stdout') {
      let str = String(data != null ? data : '');
      if (!str) return;

      if (this._pendingEscape) {
        str = this._pendingEscape + str;
        this._pendingEscape = '';
      }

      let modified = false;
      let i = 0;

      while (i < str.length) {
        if (str[i] === '\x1b') {
          const rest = str.slice(i);
          if (/^\x1b(?:\[[0-9;?]*)?$/.test(rest)) {
            this._pendingEscape = rest;
            break;
          }

          const csiMatch = /^\x1b\[([0-9;?]*)([A-Za-z])/.exec(rest);
          if (csiMatch) {
            const params = csiMatch[1];
            const cmd = csiMatch[2];
            const seq = csiMatch[0];
            i += seq.length;

            if (cmd === 'K') {
              const cur = this._getActiveLine(type);
              if (params === '2') {
                cur.text = '';
                this._cursorCol = 0;
                this._needsRewrite = false;
              } else {
                cur.text = cur.text.slice(0, this._cursorCol);
                this._needsRewrite = false;
              }
              modified = true;
            } else if (cmd === 'A') {
              const count = parseInt(params, 10) || 1;
              if (this.logs.length > 0) {
                const baseIdx = this._activeLineCommitted ? this.logs.length : this.logs.length - 1;
                this._targetLineIdx = Math.max(0, baseIdx - count);
                this._activeLineCommitted = false;
                this._cursorCol = 0;
                this._needsRewrite = false;
                const targetLine = this.logs[this._targetLineIdx];
                if (targetLine) targetLine.text = '';
                this._activeLineEl = null;
              }
            } else if (cmd === 'G') {
              this._cursorCol = 0;
              this._needsRewrite = true;
            } else if (cmd === 'J' && params === '2') {
              this.clear();
            } else if (cmd === 'm') {
              const cur = this._getActiveLine(type);
              cur.text += seq;
              modified = true;
            }
            continue;
          }
        }

        const ch = str[i];
        if (ch === '\r') {
          this._cursorCol = 0;
          this._needsRewrite = true;
          i++;
        } else if (ch === '\n') {
          const cur = this._getActiveLine(type);
          cur.text += '\n';
          this._activeLineCommitted = true;
          this._cursorCol = 0;
          this._targetLineIdx = -1;
          this._needsRewrite = false;
          this._activeLineEl = null;
          modified = true;
          i++;
        } else {
          const cur = this._getActiveLine(type);
          if (this._needsRewrite && this._cursorCol === 0 && cur.text.length > 0 && !cur.text.endsWith('\n')) {
            cur.text = ch;
            this._needsRewrite = false;
          } else {
            cur.text += ch;
          }
          this._cursorCol++;
          modified = true;
          i++;
        }
      }

      if (modified) {
        this._updateActiveDomLine();
      }
      this._scrollToBottom();
    }

    write(data, type = 'stdout') {
      this.writeStreamChunk(data, type);
    }

    writeln(data, type = 'stdout') {
      this.writeStreamChunk(String(data) + '\n', type);
    }

    _getActiveLine(type) {
      if (this._targetLineIdx >= 0 && this._targetLineIdx < this.logs.length) {
        return this.logs[this._targetLineIdx];
      }
      if (this._activeLineCommitted || this.logs.length === 0) {
        const newLine = { text: '', type };
        this.logs.push(newLine);
        this._activeLineCommitted = false;
        this._cursorCol = 0;
        this._targetLineIdx = this.logs.length - 1;
        this._needsRewrite = false;
        this._appendDomLine(newLine);
        return newLine;
      }
      this._targetLineIdx = this.logs.length - 1;
      return this.logs[this.logs.length - 1];
    }

    _appendDomLine(line) {
      if (!this.container || typeof document === 'undefined') return;
      const logEl = this.container.querySelector('#cl-terminal-log');
      if (!logEl) return;
      const lineEl = document.createElement('div');
      lineEl.className = 'codelab-log-line ' + (line.type || 'stdout');
      lineEl.innerHTML = ansiToHtml(line.text);
      logEl.appendChild(lineEl);
      this._activeLineEl = lineEl;
    }

    _updateActiveDomLine() {
      if (!this.container || typeof document === 'undefined') return;
      const line = this._getActiveLineSync();
      if (!line) return;
      let lineEl = this._activeLineEl;
      if (!lineEl || !lineEl.parentNode) {
        const logEl = this.container.querySelector('#cl-terminal-log');
        if (logEl) {
          if (this._targetLineIdx >= 0 && this._targetLineIdx < logEl.children.length) {
            lineEl = logEl.children[this._targetLineIdx];
          } else {
            lineEl = logEl.children[logEl.children.length - 1];
          }
          this._activeLineEl = lineEl;
        }
      }
      if (lineEl) {
        lineEl.className = 'codelab-log-line ' + (line.type || 'stdout');
        lineEl.innerHTML = ansiToHtml(line.text);
      }
    }

    _getActiveLineSync() {
      if (this._targetLineIdx >= 0 && this._targetLineIdx < this.logs.length) {
        return this.logs[this._targetLineIdx];
      }
      return this.logs[this.logs.length - 1] || null;
    }

    _scrollToBottom() {
      if (!this.container) return;
      const surface = this.container.querySelector('#cl-terminal-surface') || this.container;
      if (surface && typeof surface.scrollTop === 'number' && typeof surface.scrollHeight === 'number') {
        surface.scrollTop = surface.scrollHeight;
      }
    }

    clear() {
      this.logs.length = 0;
      this._activeLineCommitted = true;
      this._cursorCol = 0;
      this._targetLineIdx = -1;
      this._needsRewrite = false;
      this._activeLineEl = null;
      if (this.container && typeof this.container.querySelector === 'function') {
        const logEl = this.container.querySelector('#cl-terminal-log');
        if (logEl) {
          logEl.innerHTML = '';
        }
      }
    }

    getHistory() {
      return [...this.history];
    }

    readLine(promptText = '') {
      const prevPrompt = this.promptOverride;
      if (promptText) {
        this.setPrompt(promptText);
      }
      return new Promise((resolve) => {
        this._readLineQueue.push((line) => {
          this.promptOverride = prevPrompt;
          this.updateActiveLine();
          resolve(line);
        });
      });
    }

    focus() {
      if (!this.container || typeof this.container.querySelector !== 'function') return;
      const input = this.container.querySelector('#cl-repl-input');
      if (input && typeof input.focus === 'function') {
        try { input.focus(); } catch (_) {}
      }
    }

    mount(container) {
      if (typeof container === 'string' && typeof document !== 'undefined') {
        container = document.querySelector(container);
      }
      this.container = container || null;
      if (!this.container || typeof this.container.querySelector !== 'function') {
        this._mounted = false;
        return;
      }
      this._mounted = true;
      this.render();
    }

    _cleanupListeners() {
      if (!Array.isArray(this._listeners)) {
        this._listeners = [];
        return;
      }
      for (const entry of this._listeners) {
        if (typeof entry === 'function') {
          try { entry(); } catch (_) {}
        } else if (entry && entry.target && typeof entry.target.removeEventListener === 'function') {
          try { entry.target.removeEventListener(entry.type, entry.handler); } catch (_) {}
        }
      }
      this._listeners = [];
    }

    destroy() {
      this._cleanupListeners();
      this._mounted = false;
    }

    _addListener(target, type, handler) {
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener(type, handler);
        this._listeners.push({ target, type, handler });
      }
    }

    _bindEvents() {
      this._cleanupListeners();
      if (!this.container || typeof this.container.querySelector !== 'function') return;
      const termSurface = this.container.querySelector('#cl-terminal-surface') || this.container;
      const input = this.container.querySelector('#cl-repl-input');
      const form = this.container.querySelector('#cl-repl-form');

      if (termSurface) {
        this._addListener(termSurface, 'click', (e) => {
          if (e && e.target === input) return;
          const hasSelection = typeof window !== 'undefined' && window.getSelection && String(window.getSelection());
          if (!hasSelection) this.focus();
        });
      }

      if (input) {
        this._addListener(input, 'keydown', (e) => this.handleKeyDown(e));
        this._addListener(input, 'input', () => {
          if (input.value !== this.buffer) {
            this.buffer = input.value;
            this.cursor = typeof input.selectionStart === 'number' ? input.selectionStart : this.buffer.length;
            this.updateActiveLine();
          }
        });
      }

      if (form) {
        this._addListener(form, 'submit', (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          this.submitLine();
        });
      }
    }

    _findReverseSearchMatch(query, startIdx) {
      if (!query || !this.history.length) return -1;
      const from = typeof startIdx === 'number' ? Math.min(startIdx, this.history.length - 1) : this.history.length - 1;
      for (let i = from; i >= 0; i--) {
        if (this.history[i] && this.history[i].includes(query)) {
          return i;
        }
      }
      return -1;
    }

    handleKeyDown(e) {
      if (!e) return;
      if (this.onKey) {
        try {
          const res = this.onKey(e);
          if (res === false) return;
        } catch (_) {}
      }

      const key = e.key;
      const isCtrl = Boolean(e.ctrlKey || e.metaKey);

      if (isCtrl && (key === 'r' || key === 'R')) {
        if (e.preventDefault) e.preventDefault();
        if (!this.searchMode) {
          this.searchMode = true;
          this.searchQuery = '';
          this.searchMatchIdx = -1;
        } else if (this.searchQuery) {
          const nextStart = this.searchMatchIdx > 0 ? this.searchMatchIdx - 1 : this.history.length - 1;
          const matchIdx = this._findReverseSearchMatch(this.searchQuery, nextStart);
          if (matchIdx !== -1) {
            this.searchMatchIdx = matchIdx;
            this.buffer = this.history[matchIdx];
            this.cursor = this.buffer.length;
          }
        }
        this.updateActiveLine();
        return;
      }

      if (this.searchMode) {
        if (key === 'Escape' || (isCtrl && (key === 'g' || key === 'G'))) {
          if (e.preventDefault) e.preventDefault();
          this.searchMode = false;
          this.searchQuery = '';
          this.searchMatchIdx = -1;
          this.updateActiveLine();
          return;
        }
        if (key === 'Backspace') {
          if (e.preventDefault) e.preventDefault();
          this.searchQuery = this.searchQuery.slice(0, -1);
          const matchIdx = this._findReverseSearchMatch(this.searchQuery, this.history.length - 1);
          this.searchMatchIdx = matchIdx;
          if (matchIdx !== -1) {
            this.buffer = this.history[matchIdx];
            this.cursor = this.buffer.length;
          }
          this.updateActiveLine();
          return;
        }
        if (key === 'Enter') {
          if (e.preventDefault) e.preventDefault();
          this.searchMode = false;
          this.searchQuery = '';
          this.searchMatchIdx = -1;
          this.submitLine();
          return;
        }
        if (key && key.length === 1 && !isCtrl && !e.altKey) {
          if (e.preventDefault) e.preventDefault();
          this.searchQuery += key;
          const matchIdx = this._findReverseSearchMatch(this.searchQuery, this.history.length - 1);
          this.searchMatchIdx = matchIdx;
          if (matchIdx !== -1) {
            this.buffer = this.history[matchIdx];
            this.cursor = this.buffer.length;
          }
          this.updateActiveLine();
          return;
        }
        this.searchMode = false;
        this.searchQuery = '';
        this.searchMatchIdx = -1;
      }

      if (key === 'ArrowLeft') {
        if (e.preventDefault) e.preventDefault();
        if (this.cursor > 0) {
          this.cursor--;
          this.updateActiveLine();
        }
        return;
      }

      if (key === 'ArrowRight') {
        if (e.preventDefault) e.preventDefault();
        if (this.cursor < this.buffer.length) {
          this.cursor++;
          this.updateActiveLine();
        }
        return;
      }

      if (key === 'Home' || (isCtrl && (key === 'a' || key === 'A'))) {
        if (e.preventDefault) e.preventDefault();
        this.cursor = 0;
        this.updateActiveLine();
        return;
      }

      if (key === 'End' || (isCtrl && (key === 'e' || key === 'E'))) {
        if (e.preventDefault) e.preventDefault();
        this.cursor = this.buffer.length;
        this.updateActiveLine();
        return;
      }

      if (isCtrl && (key === 'u' || key === 'U')) {
        if (e.preventDefault) e.preventDefault();
        this.buffer = this.buffer.slice(this.cursor);
        this.cursor = 0;
        this.updateActiveLine();
        return;
      }

      if (isCtrl && (key === 'k' || key === 'K')) {
        if (e.preventDefault) e.preventDefault();
        this.buffer = this.buffer.slice(0, this.cursor);
        this.updateActiveLine();
        return;
      }

      if (key === 'Backspace') {
        if (e.preventDefault) e.preventDefault();
        if (this.cursor > 0) {
          this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
          this.cursor--;
          this.updateActiveLine();
        }
        return;
      }

      if (key === 'Delete') {
        if (e.preventDefault) e.preventDefault();
        if (this.cursor < this.buffer.length) {
          this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
          this.updateActiveLine();
        }
        return;
      }

      if (isCtrl && (key === 'l' || key === 'L')) {
        if (e.preventDefault) e.preventDefault();
        this.clear();
        return;
      }

      if (isCtrl && (key === 'c' || key === 'C')) {
        if (e.preventDefault) e.preventDefault();
        this.logs.push({ type: 'system', text: `${this.getPrompt()}${this.buffer}^C` });
        this.buffer = '';
        this.cursor = 0;
        this.historyIdx = -1;
        if (this.replMode) {
          this.replMode = false;
        }
        if (this.onInterrupt) {
          try { this.onInterrupt(); } catch (_) {}
        }
        this.render();
        return;
      }

      if (isCtrl && (key === 'd' || key === 'D')) {
        if (this.buffer === '') {
          if (e.preventDefault) e.preventDefault();
          if (this.replMode) {
            this.logs.push({ type: 'system', text: `${this.getPrompt()}.exit` });
            this.replMode = false;
            this.render();
            return;
          }
        }
      }

      if (key === 'ArrowUp') {
        if (e.preventDefault) e.preventDefault();
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

      if (key === 'ArrowDown') {
        if (e.preventDefault) e.preventDefault();
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

      if (key === 'Tab') {
        if (e.preventDefault) e.preventDefault();
        this.autoComplete();
        return;
      }

      if (key === 'Enter') {
        if (e.preventDefault) e.preventDefault();
        this.submitLine();
        return;
      }

      // Printable character
      if (key && key.length === 1 && !isCtrl && !e.altKey) {
        if (e.preventDefault) e.preventDefault();
        this.buffer = this.buffer.slice(0, this.cursor) + key + this.buffer.slice(this.cursor);
        this.cursor++;
        this.updateActiveLine();
      }
    }

    autoComplete() {
      if (!this.getCompletions) return;
      const res = this.getCompletions(this.buffer, this.cursor);
      if (!res || !Array.isArray(res.matches) || res.matches.length === 0) return;

      const matches = res.matches;
      if (matches.length === 1) {
        const match = matches[0];
        const isDir = match.endsWith('/');
        const appendChar = isDir ? '' : ' ';
        const before = this.buffer.slice(0, res.tokenStart);
        const after = this.buffer.slice(this.cursor);
        this.buffer = before + match + appendChar + after;
        this.cursor = before.length + match.length + appendChar.length;
        this.updateActiveLine();
      } else {
        // Find longest common prefix
        let lcp = matches[0];
        for (let i = 1; i < matches.length; i++) {
          let j = 0;
          while (j < lcp.length && j < matches[i].length && lcp[j] === matches[i][j]) {
            j++;
          }
          lcp = lcp.slice(0, j);
        }

        if (lcp.length > res.token.length) {
          const before = this.buffer.slice(0, res.tokenStart);
          const after = this.buffer.slice(this.cursor);
          this.buffer = before + lcp + after;
          this.cursor = before.length + lcp.length;
        }

        // Print candidate matches
        this.logs.push({ type: 'system', text: `${this.getPrompt()}${this.buffer}` });
        this.logs.push({ type: 'stdout', text: matches.join('  ') });
        this.render();
      }
    }

    submitLine() {
      const line = this.buffer;
      this.buffer = '';
      this.cursor = 0;
      this.historyIdx = -1;
      this.searchMode = false;
      this.searchQuery = '';
      this.searchMatchIdx = -1;

      if (line.trim()) {
        if (this.history[this.history.length - 1] !== line.trim()) {
          this.history.push(line.trim());
        }
      }

      if (this._readLineQueue && this._readLineQueue.length > 0) {
        const resolver = this._readLineQueue.shift();
        this.updateActiveLine();
        resolver(line);
        return;
      }

      this.updateActiveLine();
      if (this.onCommand) {
        this.onCommand(line);
      }
    }

    updateActiveLine() {
      if (!this.container || typeof this.container.querySelector !== 'function') return;
      const input = this.container.querySelector('#cl-repl-input');
      if (input && input.value !== this.buffer) {
        input.value = this.buffer;
      }
      const lineEl = this.container.querySelector('#cl-pty-active-line');
      if (!lineEl) return;

      const prompt = this.searchMode
        ? `(reverse-i-search)\`${this.searchQuery}\`: `
        : this.getPrompt();
      const before = this.buffer.slice(0, this.cursor);
      const cursorChar = this.cursor < this.buffer.length ? this.buffer[this.cursor] : ' ';
      const after = this.cursor < this.buffer.length ? this.buffer.slice(this.cursor + 1) : '';

      lineEl.innerHTML = `<span class="codelab-pty__prompt">${escapeHtml(prompt)}</span><span class="codelab-pty__before">${escapeHtml(before)}</span><span class="codelab-pty__cursor blink">${escapeHtml(cursorChar)}</span><span class="codelab-pty__after">${escapeHtml(after)}</span>`;
    }

    render() {
      if (!this.container || typeof this.container.querySelector !== 'function') return;
      const prevInput = this.container.querySelector('#cl-repl-input');
      const hadFocus = Boolean(
        prevInput &&
        typeof document !== 'undefined' &&
        document.activeElement === prevInput
      );

      const logsHtml = this.logs
        .map(item => `<div class="codelab-log-line ${escapeHtml(item.type || '')}">${ansiToHtml(item.text)}</div>`)
        .join('');

      const prompt = this.searchMode
        ? `(reverse-i-search)\`${this.searchQuery}\`: `
        : this.getPrompt();
      const before = this.buffer.slice(0, this.cursor);
      const cursorChar = this.cursor < this.buffer.length ? this.buffer[this.cursor] : ' ';
      const after = this.cursor < this.buffer.length ? this.buffer.slice(this.cursor + 1) : '';

      this.container.innerHTML = `
        <div class="codelab-terminal" id="cl-terminal-surface" tabindex="0">
          <div class="codelab-terminal__log" id="cl-terminal-log">${logsHtml}</div>
          <div class="codelab-pty__active-line" id="cl-pty-active-line">
            <span class="codelab-pty__prompt">${escapeHtml(prompt)}</span><span class="codelab-pty__before">${escapeHtml(before)}</span><span class="codelab-pty__cursor blink">${escapeHtml(cursorChar)}</span><span class="codelab-pty__after">${escapeHtml(after)}</span>
          </div>
          <form class="codelab-repl" id="cl-repl-form" style="position:absolute;opacity:0;pointer-events:none;height:0;overflow:hidden;">
            <input type="text" class="codelab-repl__input" id="cl-repl-input" autocomplete="off" spellcheck="false" aria-label="Terminal command input" value="${escapeHtml(this.buffer)}">
          </form>
        </div>
      `;

      this._scrollToBottom();

      this._bindEvents();

      if (hadFocus) {
        const nextInput = this.container.querySelector('#cl-repl-input');
        if (nextInput && typeof nextInput.focus === 'function') {
          try {
            nextInput.focus();
            if (typeof nextInput.setSelectionRange === 'function') {
              nextInput.setSelectionRange(this.cursor, this.cursor);
            }
          } catch (_) {}
        }
      }
    }
  }

  function createTerminal(container, options = {}) {
    return new PTYTerminalEngine(container, options);
  }

  const createPTYTerminalEngine = createTerminal;

  return {
    PTYTerminalEngine,
    createPTYTerminalEngine,
    createTerminal,
    ansiToHtml,
    parseAnsiToHtml,
    escapeHtml,
    ANSI_CODE_MAP,
    resolveAnsiControlCodes
  };
});
