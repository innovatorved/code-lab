// @ts-nocheck
'use strict';
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
  commits: Array<{ hash: string; author: string; date: string; message: string }>;
  headSnapshot: Record<string, string>;
}

export interface ShellExecResult {
  code: number;
  exitCode?: number;
  ok?: boolean;
  stdout: string;
  stderr: string;
  controlFlow?: { type: string; count?: number; code?: number };
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

function __initShellModule(root: any) {

  'use strict';

  function getRuntimeModule() {
    if (typeof root !== 'undefined' && root && root.CodeLabRuntime) return root.CodeLabRuntime;
    if (typeof globalThis !== 'undefined' && globalThis.CodeLabRuntime) return globalThis.CodeLabRuntime;
    try {
      if (typeof require !== 'undefined') { try { return require('./runtime.js'); } catch (_) {} try { return require('./runtime'); } catch (_) {} try { return require('../dist/runtime.js'); } catch (_) {} }
    } catch (_) {}
    return null;
  }

  function hasVirtualRuntime() {
    const rm = getRuntimeModule();
    return Boolean(rm && typeof rm.executeInVirtualRuntime === 'function');
  }

  function executeInVirtualRuntime(...args) {
    const rm = getRuntimeModule();
    if (rm && typeof rm.executeInVirtualRuntime === 'function') {
      return rm.executeInVirtualRuntime(...args);
    }
    throw new Error('Virtual runtime engine is not available');
  }

  function createVirtualPortTable(...args) {
    const rm = getRuntimeModule();
    if (rm && typeof rm.createVirtualPortTable === 'function') {
      return rm.createVirtualPortTable(...args);
    }
    return null;
  }

  function transpileTS(code, filename) {
    const rm = getRuntimeModule();
    if (rm && typeof rm.transpileTS === 'function') {
      return rm.transpileTS(code, filename);
    }
    return String(code)
      .replace(/^\s*import\s+type\s+[^\n;]+;?\s*$/gm, '')
      .replace(/^\s*export\s+(?:interface|type)\s+[A-Za-z0-9_$]+[\s\S]*?(?:^\}|\n)/gm, '')
      .replace(/^\s*(?:interface|type)\s+[A-Za-z0-9_$]+[^;{]*\{[^}]*\}/gm, '')
      .replace(/:\s*[A-Za-z0-9_$<>\[\]|&\s]+(?=[,=)\n;{])/g, '');
  }

  // =========================================================================
  // 1. POSIX PATH UTILITIES (Virtual Filesystem Path Normalizer)
  // =========================================================================
  const PosixPath = {
    normalize(p) {
      if (typeof p !== 'string' || !p) return '/';
      const isAbs = p.startsWith('/');
      const parts = p.split('/').filter(Boolean);
      const stack = [];
      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
          if (stack.length > 0) stack.pop();
        } else {
          stack.push(part);
        }
      }
      const res = (isAbs ? '/' : '') + stack.join('/');
      return res || (isAbs ? '/' : '.');
    },

    resolve(cwd, ...paths) {
      let resolved = cwd.startsWith('/') ? cwd : '/' + cwd;
      for (const p of paths) {
        if (!p) continue;
        if (p.startsWith('/')) {
          resolved = p;
        } else if (p === '~' || p.startsWith('~/')) {
          resolved = '/home/user' + p.slice(1);
        } else {
          resolved = resolved.endsWith('/') ? resolved + p : resolved + '/' + p;
        }
      }
      return PosixPath.normalize(resolved);
    },

    dirname(p) {
      const norm = PosixPath.normalize(p);
      if (norm === '/' || norm === '.') return norm;
      const idx = norm.lastIndexOf('/');
      if (idx === -1) return '.';
      if (idx === 0) return '/';
      return norm.slice(0, idx);
    },

    basename(p, ext) {
      const norm = PosixPath.normalize(p);
      if (norm === '/') return '/';
      const idx = norm.lastIndexOf('/');
      let base = idx === -1 ? norm : norm.slice(idx + 1);
      if (ext && base.endsWith(ext) && base !== ext) {
        base = base.slice(0, -ext.length);
      }
      return base;
    },

    join(...parts) {
      return PosixPath.normalize(parts.filter(Boolean).join('/'));
    }
  };

  // =========================================================================
  // 2. GLOB, BRACE & ARITHMETIC EXPANSION UTILITIES (Zero-eval Pure JS)
  // =========================================================================
  function globToRegExp(glob, isPath = true) {
    let regStr = '^';
    let i = 0;
    while (i < glob.length) {
      const c = glob[i];
      if (c === '*' && glob[i + 1] === '*' && (glob[i + 2] === '/' || i + 2 === glob.length)) {
        regStr += '(?:.+/)?';
        i += glob[i + 2] === '/' ? 3 : 2;
      } else if (c === '*' && glob[i + 1] === '*') {
        regStr += '.*';
        i += 2;
      } else if (c === '*') {
        regStr += isPath ? '[^/]*' : '.*';
        i++;
      } else if (c === '?') {
        regStr += isPath ? '[^/]' : '.';
        i++;
      } else if (c === '[') {
        const close = glob.indexOf(']', i + 1);
        if (close !== -1) {
          let inner = glob.slice(i + 1, close);
          if (inner.startsWith('!')) inner = '^' + inner.slice(1);
          regStr += '[' + inner + ']';
          i = close + 1;
        } else {
          regStr += '\\[';
          i++;
        }
      } else if (['.', '$', '^', '+', '(', ')', '{', '}', '|', '\\'].includes(c)) {
        regStr += '\\' + c;
        i++;
      } else {
        regStr += c;
        i++;
      }
    }
    regStr += '$';
    return new RegExp(regStr);
  }

  function expandBraces(str) {
    if (typeof str !== 'string' || !str.includes('{') || !str.includes('}')) {
      return [str];
    }

    // Find first top-level balanced brace pair that contains a comma or range '..'
    let openIdx = -1;
    let closeIdx = -1;
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\\') { i++; continue; }
      if (str[i] === '{') {
        if (depth === 0) openIdx = i;
        depth++;
      } else if (str[i] === '}') {
        if (depth > 0) {
          depth--;
          if (depth === 0) {
            const inner = str.slice(openIdx + 1, i);
            if (hasTopLevelComma(inner) || /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(inner) || /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(inner)) {
              closeIdx = i;
              break;
            }
          }
        }
      }
    }

    if (openIdx === -1 || closeIdx === -1) return [str];

    const prefix = str.slice(0, openIdx);
    const body = str.slice(openIdx + 1, closeIdx);
    const suffix = str.slice(closeIdx + 1);

    let options = [];
    const numMatch = body.match(/^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/);
    const charMatch = body.match(/^([a-zA-Z])\.\.([a-zA-Z])(?:\.\.(-?\d+))?$/);

    if (numMatch && !hasTopLevelComma(body)) {
      const rawStart = numMatch[1];
      const rawEnd = numMatch[2];
      const start = parseInt(rawStart, 10);
      const end = parseInt(rawEnd, 10);
      let step = numMatch[3] !== undefined ? parseInt(numMatch[3], 10) : (start <= end ? 1 : -1);
      if (step === 0) step = 1;
      if ((start <= end && step < 0) || (start > end && step > 0)) step = -step;
      const padWidth = (rawStart.startsWith('0') && rawStart.length > 1) || (rawEnd.startsWith('0') && rawEnd.length > 1)
        ? Math.max(rawStart.length, rawEnd.length)
        : 0;
      for (let v = start; step > 0 ? v <= end : v >= end; v += step) {
        let s = String(Math.abs(v));
        if (padWidth > 0) s = s.padStart(padWidth - (v < 0 ? 1 : 0), '0');
        options.push(v < 0 ? '-' + s : s);
      }
    } else if (charMatch && !hasTopLevelComma(body)) {
      const startCode = charMatch[1].charCodeAt(0);
      const endCode = charMatch[2].charCodeAt(0);
      let step = charMatch[3] !== undefined ? Math.abs(parseInt(charMatch[3], 10)) || 1 : 1;
      if (startCode > endCode) step = -step;
      for (let c = startCode; step > 0 ? c <= endCode : c >= endCode; c += step) {
        options.push(String.fromCharCode(c));
      }
    } else {
      options = splitTopLevelComma(body);
    }

    const results = [];
    for (const opt of options) {
      for (const expandedOpt of expandBraces(opt)) {
        for (const expandedRest of expandBraces(suffix)) {
          results.push(prefix + expandedOpt + expandedRest);
        }
      }
    }
    return results;
  }

  function hasTopLevelComma(s) {
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\') { i++; continue; }
      if (s[i] === '{') d++;
      else if (s[i] === '}') d = Math.max(0, d - 1);
      else if (s[i] === ',' && d === 0) return true;
    }
    return false;
  }

  function splitTopLevelComma(s) {
    const parts = [];
    let cur = '';
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\' && i + 1 < s.length) {
        cur += s[i] + s[i + 1];
        i++;
        continue;
      }
      if (s[i] === '{') { d++; cur += s[i]; }
      else if (s[i] === '}') { d = Math.max(0, d - 1); cur += s[i]; }
      else if (s[i] === ',' && d === 0) {
        parts.push(cur);
        cur = '';
      } else {
        cur += s[i];
      }
    }
    parts.push(cur);
    return parts;
  }

  /**
   * Pure-JS CSP-safe arithmetic evaluator for $(( ... ))
   */
  function evaluateArithmetic(exprStr, env = {}, shellEnv = null) {
    const src = String(exprStr || '').trim();
    if (!src) return 0;

    // Tokenize arithmetic expression
    const tokens = [];
    let i = 0;
    const len = src.length;

    while (i < len) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }

      // Multi-char operators
      const three = src.slice(i, i + 3);
      if (three === '<<=' || three === '>>=') {
        tokens.push({ type: 'OP', value: three });
        i += 3;
        continue;
      }
      const two = src.slice(i, i + 2);
      if (['**', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|='].includes(two)) {
        tokens.push({ type: 'OP', value: two });
        i += 2;
        continue;
      }
      if ('+-*/%<>&|^!~?:=,()'.includes(ch)) {
        tokens.push({ type: 'OP', value: ch });
        i++;
        continue;
      }

      // Variable with leading $: ${VAR} or $VAR
      if (ch === '$') {
        i++;
        let vName = '';
        if (src[i] === '{') {
          i++;
          while (i < len && src[i] !== '}') vName += src[i++];
          if (src[i] === '}') i++;
        } else {
          while (i < len && /[a-zA-Z0-9_?#]/.test(src[i])) vName += src[i++];
        }
        const rawVal = env[vName] !== undefined ? env[vName] : (shellEnv && shellEnv[vName] !== undefined ? shellEnv[vName] : '0');
        const parsed = Number(rawVal);
        tokens.push({ type: 'NUM', value: Number.isFinite(parsed) ? Math.trunc(parsed) : 0, name: vName });
        continue;
      }

      // Number literal (hex, octal, binary, decimal)
      if (/[0-9]/.test(ch)) {
        let numStr = '';
        while (i < len && /[0-9a-fA-FxXbBoO_]/.test(src[i])) {
          if (src[i] !== '_') numStr += src[i];
          i++;
        }
        let val = 0;
        if (/^0[xX]/.test(numStr)) val = parseInt(numStr.slice(2), 16) || 0;
        else if (/^0[bB]/.test(numStr)) val = parseInt(numStr.slice(2), 2) || 0;
        else if (/^0[oO]/.test(numStr)) val = parseInt(numStr.slice(2), 8) || 0;
        else if (numStr.length > 1 && numStr.startsWith('0') && /^[0-7]+$/.test(numStr)) val = parseInt(numStr, 8) || 0;
        else val = parseInt(numStr, 10) || 0;
        tokens.push({ type: 'NUM', value: val });
        continue;
      }

      // Identifier (variable name)
      if (/[a-zA-Z_]/.test(ch)) {
        let ident = '';
        while (i < len && /[a-zA-Z0-9_]/.test(src[i])) ident += src[i++];
        tokens.push({ type: 'IDENT', name: ident });
        continue;
      }

      i++;
    }

    let pos = 0;
    const peek = () => tokens[pos] || null;
    const next = () => tokens[pos++] || null;

    function getVar(name) {
      const v = env[name] !== undefined ? env[name] : (shellEnv && shellEnv[name] !== undefined ? shellEnv[name] : 0);
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    }

    function setVar(name, val) {
      const iv = Math.trunc(Number(val) || 0);
      env[name] = String(iv);
      if (shellEnv) shellEnv[name] = String(iv);
      return iv;
    }

    function parseComma() {
      let v = parseAssign();
      while (peek() && peek().type === 'OP' && peek().value === ',') {
        next();
        v = parseAssign();
      }
      return v;
    }

    function parseAssign() {
      if (peek() && (peek().type === 'IDENT' || (peek().type === 'NUM' && peek().name))) {
        const nextTok = tokens[pos + 1];
        if (nextTok && nextTok.type === 'OP' && ['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|='].includes(nextTok.value)) {
          const ident = next().name;
          const op = next().value;
          const rhs = parseAssign();
          const cur = getVar(ident);
          if (op === '=') return setVar(ident, rhs);
          if (op === '+=') return setVar(ident, cur + rhs);
          if (op === '-=') return setVar(ident, cur - rhs);
          if (op === '*=') return setVar(ident, cur * rhs);
          if (op === '/=') return setVar(ident, rhs === 0 ? 0 : Math.trunc(cur / rhs));
          if (op === '%=') return setVar(ident, rhs === 0 ? 0 : cur % rhs);
          if (op === '<<=') return setVar(ident, cur << rhs);
          if (op === '>>=') return setVar(ident, cur >> rhs);
          if (op === '&=') return setVar(ident, cur & rhs);
          if (op === '^=') return setVar(ident, cur ^ rhs);
          if (op === '|=') return setVar(ident, cur | rhs);
        }
      }
      return parseTernary();
    }

    function parseTernary() {
      const cond = parseLogicalOr();
      if (peek() && peek().type === 'OP' && peek().value === '?') {
        next();
        const yes = parseAssign();
        if (peek() && peek().type === 'OP' && peek().value === ':') next();
        const no = parseAssign();
        return cond !== 0 ? yes : no;
      }
      return cond;
    }

    function parseLogicalOr() {
      let left = parseLogicalAnd();
      while (peek() && peek().type === 'OP' && peek().value === '||') {
        next();
        const right = parseLogicalAnd();
        left = (left !== 0 || right !== 0) ? 1 : 0;
      }
      return left;
    }

    function parseLogicalAnd() {
      let left = parseBitOr();
      while (peek() && peek().type === 'OP' && peek().value === '&&') {
        next();
        const right = parseBitOr();
        left = (left !== 0 && right !== 0) ? 1 : 0;
      }
      return left;
    }

    function parseBitOr() {
      let left = parseBitXor();
      while (peek() && peek().type === 'OP' && peek().value === '|') {
        next();
        left = left | parseBitXor();
      }
      return left;
    }

    function parseBitXor() {
      let left = parseBitAnd();
      while (peek() && peek().type === 'OP' && peek().value === '^') {
        next();
        left = left ^ parseBitAnd();
      }
      return left;
    }

    function parseBitAnd() {
      let left = parseEquality();
      while (peek() && peek().type === 'OP' && peek().value === '&') {
        next();
        left = left & parseEquality();
      }
      return left;
    }

    function parseEquality() {
      let left = parseRelational();
      while (peek() && peek().type === 'OP' && (peek().value === '==' || peek().value === '!=')) {
        const op = next().value;
        const right = parseRelational();
        left = op === '==' ? (left === right ? 1 : 0) : (left !== right ? 1 : 0);
      }
      return left;
    }

    function parseRelational() {
      let left = parseShift();
      while (peek() && peek().type === 'OP' && ['<', '<=', '>', '>='].includes(peek().value)) {
        const op = next().value;
        const right = parseShift();
        if (op === '<') left = left < right ? 1 : 0;
        else if (op === '<=') left = left <= right ? 1 : 0;
        else if (op === '>') left = left > right ? 1 : 0;
        else if (op === '>=') left = left >= right ? 1 : 0;
      }
      return left;
    }

    function parseShift() {
      let left = parseAdd();
      while (peek() && peek().type === 'OP' && (peek().value === '<<' || peek().value === '>>')) {
        const op = next().value;
        const right = parseAdd();
        left = op === '<<' ? (left << right) : (left >> right);
      }
      return left;
    }

    function parseAdd() {
      let left = parseMul();
      while (peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const op = next().value;
        const right = parseMul();
        left = op === '+' ? (left + right) : (left - right);
      }
      return left;
    }

    function parseMul() {
      let left = parsePow();
      while (peek() && peek().type === 'OP' && ['*', '/', '%'].includes(peek().value)) {
        const op = next().value;
        const right = parsePow();
        if (op === '*') left = left * right;
        else if (op === '/') left = right === 0 ? 0 : Math.trunc(left / right);
        else if (op === '%') left = right === 0 ? 0 : (left % right);
      }
      return left;
    }

    function parsePow() {
      const base = parseUnary();
      if (peek() && peek().type === 'OP' && peek().value === '**') {
        next();
        const exp = parsePow();
        return Math.trunc(Math.pow(base, exp));
      }
      return base;
    }

    function parseUnary() {
      const t = peek();
      if (t && t.type === 'OP') {
        if (t.value === '+') { next(); return +parseUnary(); }
        if (t.value === '-') { next(); return -parseUnary(); }
        if (t.value === '!') { next(); return parseUnary() === 0 ? 1 : 0; }
        if (t.value === '~') { next(); return ~parseUnary(); }
        if (t.value === '++' || t.value === '--') {
          const op = next().value;
          const target = peek();
          if (target && (target.type === 'IDENT' || target.name)) {
            next();
            const cur = getVar(target.name);
            return setVar(target.name, op === '++' ? cur + 1 : cur - 1);
          }
          return parseUnary();
        }
      }
      return parsePostfix();
    }

    function parsePostfix() {
      const t = peek();
      if (!t) return 0;
      if (t.type === 'OP' && t.value === '(') {
        next();
        const val = parseComma();
        if (peek() && peek().type === 'OP' && peek().value === ')') next();
        return val;
      }
      if (t.type === 'IDENT') {
        next();
        const cur = getVar(t.name);
        if (peek() && peek().type === 'OP' && (peek().value === '++' || peek().value === '--')) {
          const op = next().value;
          setVar(t.name, op === '++' ? cur + 1 : cur - 1);
        }
        return cur;
      }
      if (t.type === 'NUM') {
        next();
        if (t.name && peek() && peek().type === 'OP' && (peek().value === '++' || peek().value === '--')) {
          const op = next().value;
          setVar(t.name, op === '++' ? t.value + 1 : t.value - 1);
        }
        return t.value;
      }
      next();
      return 0;
    }

    return Math.trunc(parseComma() || 0);
  }

  function expandGlob(pattern, cwd, vfs) {
    if (!vfs) return [pattern];
    // Check if pattern contains wildcard characters outside quotes
    if (!/[*?\[]/.test(pattern)) {
      return [pattern];
    }

    const isAbs = pattern.startsWith('/');
    const searchRoot = isAbs ? '/' : cwd;
    const allPaths = [];

    // Helper to traverse VFS tree recursively
    function traverse(currentDir, relPrefix) {
      let entries = [];
      try {
        if (typeof vfs.readdirSync === 'function') {
          entries = vfs.readdirSync(currentDir);
        }
      } catch (_) {
        return;
      }

      for (const entry of entries) {
        const full = currentDir === '/' ? '/' + entry : currentDir + '/' + entry;
        const rel = relPrefix ? relPrefix + '/' + entry : entry;
        allPaths.push({ full, rel });

        let isDir = false;
        try {
          if (typeof vfs.statSync === 'function') {
            isDir = vfs.statSync(full).isDirectory();
          }
        } catch (_) {}

        if (isDir) {
          traverse(full, rel);
        }
      }
    }

    traverse(searchRoot, '');

    const targetGlob = isAbs ? pattern : (pattern.startsWith('./') ? pattern.slice(2) : pattern);
    const regex = globToRegExp(targetGlob, true);

    const matches = [];
    for (const item of allPaths) {
      const candidate = isAbs ? item.full : item.rel;
      if (regex.test(candidate)) {
        // POSIX dotfile protection: * wildcard must NOT match dotfiles starting with .
        // unless pattern component explicitly starts with .
        const candParts = candidate.split('/').filter(Boolean);
        const patParts = targetGlob.split('/').filter(Boolean);
        let dotMismatch = false;
        for (let idx = 0; idx < candParts.length; idx++) {
          const cp = candParts[idx];
          const pp = patParts[idx] !== undefined ? patParts[idx] : patParts[patParts.length - 1];
          if (cp && cp.startsWith('.') && pp && !pp.startsWith('.')) {
            dotMismatch = true;
            break;
          }
        }
        if (!dotMismatch) {
          matches.push(isAbs ? item.full : (pattern.startsWith('./') ? './' + item.rel : item.rel));
        }
      }
    }

    matches.sort();
    return matches.length > 0 ? matches : [pattern];
  }

  // =========================================================================
  // 3. POSIX SHELL LEXER & TOKENIZER
  // =========================================================================
  /**
   * Tokenizes a POSIX shell command string into structured tokens:
   * Words with segment types (literal, single_quoted, double_quoted, variable, subshell, arith)
   * Operators: &&, ||, |, ;, ;;, &, >, >>, <, <<, <<-, <<<, 2>, 2>>, 2>&1, 1>&2, &>, (, )
   */
  function tokenizeShell(commandLine) {
    if (typeof commandLine !== 'string') return [];
    const tokens = [];
    const len = commandLine.length;
    let i = 0;
    let pendingHeredocEnd = -1;

    while (i < len) {
      const ch = commandLine[i];

      // Newline: treated as command separator (equivalent to semicolon), jumping over consumed heredocs
      if (ch === '\n') {
        if (pendingHeredocEnd > i) {
          i = pendingHeredocEnd;
          pendingHeredocEnd = -1;
        } else {
          i++;
        }
        if (tokens.length > 0) {
          const lastType = tokens[tokens.length - 1].type;
          if (lastType !== 'SEMICOLON' && lastType !== 'DSEMI' && lastType !== 'AND' && lastType !== 'OR' && lastType !== 'PIPE' && lastType !== 'LPAREN') {
            tokens.push({ type: 'SEMICOLON', raw: ';' });
          }
        }
        continue;
      }

      // Whitespace (excluding newline)
      if (/[ \t\r\f\v]/.test(ch)) {
        i++;
        continue;
      }

      // Comments: # until end of line
      if (ch === '#') {
        while (i < len && commandLine[i] !== '\n') i++;
        continue;
      }

      // Double semicolon ';;' (for case clauses)
      if (ch === ';' && commandLine[i + 1] === ';') {
        tokens.push({ type: 'DSEMI', raw: ';;' });
        i += 2;
        continue;
      }

      // Semicolon ';'
      if (ch === ';') {
        tokens.push({ type: 'SEMICOLON', raw: ';' });
        i++;
        continue;
      }

      // Subshell / grouping / function parens '(' and ')'
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', raw: '(' });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', raw: ')' });
        i++;
        continue;
      }

      // Logical AND '&&'
      if (ch === '&' && commandLine[i + 1] === '&') {
        tokens.push({ type: 'AND', raw: '&&' });
        i += 2;
        continue;
      }

      // Logical OR '||'
      if (ch === '|' && commandLine[i + 1] === '|') {
        tokens.push({ type: 'OR', raw: '||' });
        i += 2;
        continue;
      }

      // Pipeline '|'
      if (ch === '|') {
        tokens.push({ type: 'PIPE', raw: '|' });
        i++;
        continue;
      }

      // Both stdout & stderr redirect '&>'
      if (ch === '&' && commandLine[i + 1] === '>') {
        tokens.push({ type: 'REDIRECT', op: '&>', sourceFd: 'all', raw: '&>' });
        i += 2;
        continue;
      }

      // Background job '&'
      if (ch === '&') {
        tokens.push({ type: 'BACKGROUND', raw: '&' });
        i++;
        continue;
      }

      // Redirection: 2>&1 or 1>&2 or 2>> or 2> or 1>> or 1> or 0<
      if ((ch === '1' || ch === '2' || ch === '0') && (commandLine[i + 1] === '>' || commandLine[i + 1] === '<')) {
        const fd = parseInt(ch, 10);
        const opChar = commandLine[i + 1];

        if (opChar === '>' && commandLine[i + 2] === '&' && (commandLine[i + 3] === '1' || commandLine[i + 3] === '2')) {
          const targetFd = parseInt(commandLine[i + 3], 10);
          tokens.push({ type: 'REDIRECT_FD', sourceFd: fd, targetFd, raw: `${fd}>&${targetFd}` });
          i += 4;
          continue;
        }

        if (opChar === '>' && commandLine[i + 2] === '>') {
          tokens.push({ type: 'REDIRECT', op: '>>', sourceFd: fd, raw: `${fd}>>` });
          i += 3;
          continue;
        }

        tokens.push({ type: 'REDIRECT', op: opChar, sourceFd: fd, raw: `${fd}${opChar}` });
        i += 2;
        continue;
      }

      // Redirection: >> or >&1 or >&2 or >
      if (ch === '>') {
        if (commandLine[i + 1] === '&' && (commandLine[i + 2] === '1' || commandLine[i + 2] === '2')) {
          const targetFd = parseInt(commandLine[i + 2], 10);
          tokens.push({ type: 'REDIRECT_FD', sourceFd: 1, targetFd, raw: `>&${targetFd}` });
          i += 3;
          continue;
        }
        if (commandLine[i + 1] === '>') {
          tokens.push({ type: 'REDIRECT', op: '>>', sourceFd: 1, raw: '>>' });
          i += 2;
          continue;
        }
        tokens.push({ type: 'REDIRECT', op: '>', sourceFd: 1, raw: '>' });
        i++;
        continue;
      }

      // Input redirection: <<< (here-string), <<- / << (here-document), or <
      if (ch === '<') {
        if (commandLine[i + 1] === '<' && commandLine[i + 2] === '<') {
          tokens.push({ type: 'REDIRECT', op: '<<<', sourceFd: 0, raw: '<<<' });
          i += 3;
          continue;
        }
        if (commandLine[i + 1] === '<') {
          const stripTabs = commandLine[i + 2] === '-';
          i += stripTabs ? 3 : 2;
          while (i < len && (commandLine[i] === ' ' || commandLine[i] === '\t')) i++;

          let delim = '';
          let quoted = false;
          while (i < len && !/[\s;|&<>()]/.test(commandLine[i])) {
            if (commandLine[i] === "'" || commandLine[i] === '"') {
              const q = commandLine[i++];
              quoted = true;
              while (i < len && commandLine[i] !== q) delim += commandLine[i++];
              if (i < len && commandLine[i] === q) i++;
            } else if (commandLine[i] === '\\' && i + 1 < len) {
              quoted = true;
              i++;
              delim += commandLine[i++];
            } else {
              delim += commandLine[i++];
            }
          }

          const searchStart = pendingHeredocEnd > i ? pendingHeredocEnd : commandLine.indexOf('\n', i);
          let body = '';
          if (searchStart !== -1 && searchStart < len) {
            let lineStart = searchStart + 1;
            while (lineStart <= len) {
              let lineEnd = commandLine.indexOf('\n', lineStart);
              if (lineEnd === -1) lineEnd = len;
              const rawLine = commandLine.slice(lineStart, lineEnd).replace(/\r$/, '');
              const checkLine = stripTabs ? rawLine.replace(/^\t+/, '') : rawLine;
              if (checkLine === delim) {
                pendingHeredocEnd = lineEnd < len ? lineEnd + 1 : len;
                break;
              }
              body += (stripTabs ? rawLine.replace(/^\t+/, '') : rawLine) + '\n';
              if (lineEnd === len) {
                pendingHeredocEnd = len;
                break;
              }
              lineStart = lineEnd + 1;
            }
          }

          tokens.push({
            type: 'REDIRECT',
            op: '<<',
            sourceFd: 0,
            stripTabs,
            quoted,
            body,
            delim,
            raw: stripTabs ? '<<-' : '<<'
          });
          continue;
        }
        tokens.push({ type: 'REDIRECT', op: '<', sourceFd: 0, raw: '<' });
        i++;
        continue;
      }

      // Otherwise, parse a WORD token (may contain quotes, variables, escapes, subshells, arith)
      const segments = [];
      let rawWord = '';
      let hasWildcard = false;
      let hasBraces = false;

      while (i < len) {
        const c = commandLine[i];
        if (/\s/.test(c) || c === '|' || c === '&' || c === ';' || c === '<' || c === '>' || c === '(' || c === ')') {
          break;
        }

        // Single quotes '...'
        if (c === "'") {
          i++;
          let literal = '';
          while (i < len && commandLine[i] !== "'") {
            literal += commandLine[i];
            i++;
          }
          if (i < len && commandLine[i] === "'") i++; // skip closing quote
          segments.push({ type: 'single_quoted', value: literal });
          rawWord += `'${literal}'`;
          continue;
        }

        // Double quotes "..."
        if (c === '"') {
          const dqStart = i;
          i++;
          const dqParts = [];
          let currentLit = '';
          while (i < len && commandLine[i] !== '"') {
            const dc = commandLine[i];
            if (dc === '\\' && i + 1 < len) {
              const nextC = commandLine[i + 1];
              if (nextC === '"' || nextC === '\\' || nextC === '$' || nextC === '`') {
                currentLit += nextC;
                i += 2;
                continue;
              }
              if (nextC === 'n') { currentLit += '\n'; i += 2; continue; }
              if (nextC === 't') { currentLit += '\t'; i += 2; continue; }
              currentLit += '\\' + nextC;
              i += 2;
              continue;
            }

            // Arithmetic expansion inside double quotes: $((...))
            if (dc === '$' && commandLine[i + 1] === '(' && commandLine[i + 2] === '(') {
              if (currentLit) { dqParts.push({ type: 'literal', value: currentLit }); currentLit = ''; }
              i += 3;
              let depth = 2;
              let expr = '';
              while (i < len && depth > 0) {
                if (commandLine[i] === '(') {
                  depth++;
                  expr += '(';
                  i++;
                } else if (commandLine[i] === ')') {
                  if (depth === 2 && commandLine[i + 1] === ')') {
                    depth = 0;
                    i += 2;
                    break;
                  }
                  depth--;
                  if (depth > 0) expr += ')';
                  i++;
                } else {
                  expr += commandLine[i++];
                }
              }
              dqParts.push({ type: 'arith', expr });
              continue;
            }

            // Command substitution inside double quotes: $(...)
            if (dc === '$' && commandLine[i + 1] === '(') {
              if (currentLit) { dqParts.push({ type: 'literal', value: currentLit }); currentLit = ''; }
              i += 2;
              let depth = 1;
              let subCmd = '';
              while (i < len && depth > 0) {
                if (commandLine[i] === '(') depth++;
                else if (commandLine[i] === ')') depth--;
                if (depth > 0) subCmd += commandLine[i];
                i++;
              }
              dqParts.push({ type: 'subshell', command: subCmd });
              continue;
            }

            // Backtick substitution inside double quotes: `...`
            if (dc === '`') {
              if (currentLit) { dqParts.push({ type: 'literal', value: currentLit }); currentLit = ''; }
              i++;
              let subCmd = '';
              while (i < len && commandLine[i] !== '`') {
                subCmd += commandLine[i++];
              }
              if (i < len && commandLine[i] === '`') i++;
              dqParts.push({ type: 'subshell', command: subCmd });
              continue;
            }

            // Variable inside double quotes: ${VAR} or $VAR
            if (dc === '$') {
              if (currentLit) { dqParts.push({ type: 'literal', value: currentLit }); currentLit = ''; }
              i++;
              if (commandLine[i] === '{') {
                i++;
                let varName = '';
                let bDepth = 1;
                while (i < len && bDepth > 0) {
                  if (commandLine[i] === '{') bDepth++;
                  else if (commandLine[i] === '}') bDepth--;
                  if (bDepth > 0) varName += commandLine[i];
                  i++;
                }
                dqParts.push({ type: 'variable', name: varName });
              } else if (/[0-9?!$#@*]/.test(commandLine[i])) {
                const varName = commandLine[i++];
                dqParts.push({ type: 'variable', name: varName });
              } else if (/[a-zA-Z_]/.test(commandLine[i])) {
                let varName = '';
                while (i < len && /[a-zA-Z0-9_]/.test(commandLine[i])) {
                  varName += commandLine[i++];
                }
                dqParts.push({ type: 'variable', name: varName });
              } else {
                currentLit += '$';
              }
              continue;
            }

            currentLit += dc;
            i++;
          }
          if (i < len && commandLine[i] === '"') i++;
          if (currentLit) dqParts.push({ type: 'literal', value: currentLit });
          segments.push({ type: 'double_quoted', parts: dqParts });
          rawWord += commandLine.slice(dqStart, i);
          continue;
        }

        // Backslash outside quotes
        if (c === '\\' && i + 1 < len) {
          segments.push({ type: 'literal', value: commandLine[i + 1], escaped: true });
          rawWord += '\\' + commandLine[i + 1];
          i += 2;
          continue;
        }

        // Arithmetic expansion $((...)) outside quotes
        if (c === '$' && commandLine[i + 1] === '(' && commandLine[i + 2] === '(') {
          i += 3;
          let depth = 2;
          let expr = '';
          while (i < len && depth > 0) {
            if (commandLine[i] === '(') {
              depth++;
              expr += '(';
              i++;
            } else if (commandLine[i] === ')') {
              if (depth === 2 && commandLine[i + 1] === ')') {
                depth = 0;
                i += 2;
                break;
              }
              depth--;
              if (depth > 0) expr += ')';
              i++;
            } else {
              expr += commandLine[i++];
            }
          }
          segments.push({ type: 'arith', expr });
          rawWord += `$((${expr}))`;
          continue;
        }

        // Command substitution $(...) outside quotes
        if (c === '$' && commandLine[i + 1] === '(') {
          i += 2;
          let depth = 1;
          let subCmd = '';
          while (i < len && depth > 0) {
            if (commandLine[i] === '(') depth++;
            else if (commandLine[i] === ')') depth--;
            if (depth > 0) subCmd += commandLine[i];
            i++;
          }
          segments.push({ type: 'subshell', command: subCmd });
          rawWord += `$(${subCmd})`;
          continue;
        }

        // Backtick command substitution `...`
        if (c === '`') {
          i++;
          let subCmd = '';
          while (i < len && commandLine[i] !== '`') {
            subCmd += commandLine[i];
            i++;
          }
          if (i < len && commandLine[i] === '`') i++;
          segments.push({ type: 'subshell', command: subCmd });
          rawWord += `\`${subCmd}\``;
          continue;
        }

        // Variable ${VAR} or $VAR outside quotes
        if (c === '$') {
          i++;
          if (commandLine[i] === '{') {
            i++;
            let varName = '';
            let bDepth = 1;
            while (i < len && bDepth > 0) {
              if (commandLine[i] === '{') bDepth++;
              else if (commandLine[i] === '}') bDepth--;
              if (bDepth > 0) varName += commandLine[i];
              i++;
            }
            segments.push({ type: 'variable', name: varName });
            rawWord += `\${${varName}}`;
          } else if (/[0-9?!$#@*]/.test(commandLine[i])) {
            const varName = commandLine[i++];
            segments.push({ type: 'variable', name: varName });
            rawWord += `$${varName}`;
          } else if (/[a-zA-Z_]/.test(commandLine[i])) {
            let varName = '';
            while (i < len && /[a-zA-Z0-9_]/.test(commandLine[i])) {
              varName += commandLine[i++];
            }
            segments.push({ type: 'variable', name: varName });
            rawWord += `$${varName}`;
          } else {
            segments.push({ type: 'literal', value: '$' });
            rawWord += '$';
          }
          continue;
        }

        // Wildcard and brace detection
        if (c === '*' || c === '?' || c === '[') {
          hasWildcard = true;
        }
        if (c === '{' || c === '}') {
          hasBraces = true;
        }

        // Normal character outside quotes
        segments.push({ type: 'literal', value: c });
        rawWord += c;
        i++;
      }

      tokens.push({
        type: 'WORD',
        segments,
        raw: rawWord,
        hasWildcard,
        hasBraces
      });
    }

    return tokens;
  }

  // =========================================================================
  // 4. POSIX SHELL AST PARSER
  // =========================================================================
  /**
   * Parses token stream into an executable AST:
   * Sequence -> Logical (&&, ||) -> Pipeline (|) -> Compound / SimpleCommand
   */
  function parseShellCommand(input) {
    const tokens = typeof input === 'string' ? tokenizeShell(input) : input;
    let pos = 0;

    function peek() {
      return tokens[pos] || null;
    }

    function next() {
      return tokens[pos++] || null;
    }

    function isWord(tok, ...vals) {
      return Boolean(tok && tok.type === 'WORD' && vals.includes(tok.raw));
    }

    function skipSeps() {
      while (peek() && peek().type === 'SEMICOLON') next();
    }

    function parseSequence(stopWords = []) {
      const items = [];
      while (pos < tokens.length) {
        skipSeps();
        const t = peek();
        if (!t) break;
        if (t.type === 'RPAREN' || t.type === 'DSEMI') break;
        if (stopWords.length > 0 && isWord(t, ...stopWords)) break;

        const logicalNode = parseLogical(stopWords);
        if (!logicalNode) break;

        let background = false;
        if (peek() && peek().type === 'BACKGROUND') {
          next();
          background = true;
        } else if (peek() && peek().type === 'SEMICOLON') {
          next();
        }

        items.push({ node: logicalNode, background });
      }

      return {
        type: 'Sequence',
        items
      };
    }

    function parseLogical(stopWords = []) {
      let left = parsePipeline(stopWords);
      if (!left) return null;

      while (peek() && (peek().type === 'AND' || peek().type === 'OR')) {
        const opToken = next();
        skipSeps();
        const right = parsePipeline(stopWords);
        if (!right) break;
        left = {
          type: 'Logical',
          op: opToken.type === 'AND' ? '&&' : '||',
          left,
          right
        };
      }

      return left;
    }

    function parsePipeline(stopWords = []) {
      let negated = false;
      if (isWord(peek(), '!')) {
        next();
        negated = true;
      }

      const commands = [];
      const first = parseCommand(stopWords);
      if (!first) return null;
      commands.push(first);

      while (peek() && peek().type === 'PIPE') {
        next();
        skipSeps();
        const nextCmd = parseCommand(stopWords);
        if (nextCmd) commands.push(nextCmd);
      }

      if (commands.length === 1 && !negated) return commands[0];
      return {
        type: 'Pipeline',
        negated,
        commands
      };
    }

    function parseTrailingRedirects() {
      const redirects = [];
      while (peek() && (peek().type === 'REDIRECT' || peek().type === 'REDIRECT_FD')) {
        const token = next();
        if (token.type === 'REDIRECT') {
          if (token.op === '<<') {
            redirects.push({
              type: '<<',
              sourceFd: token.sourceFd,
              body: token.body,
              quoted: token.quoted,
              stripTabs: token.stripTabs
            });
          } else {
            let target = null;
            if (peek() && peek().type === 'WORD') target = next();
            redirects.push({
              type: token.op,
              sourceFd: token.sourceFd,
              target
            });
          }
        } else {
          redirects.push({
            type: '>&',
            sourceFd: token.sourceFd,
            targetFd: token.targetFd
          });
        }
      }
      return redirects;
    }

    function parseCommand(stopWords = []) {
      const tok = peek();
      if (!tok) return null;
      if (tok.type === 'RPAREN' || tok.type === 'DSEMI') return null;
      if (stopWords.length > 0 && isWord(tok, ...stopWords)) return null;

      // 1. Subshell: ( list )
      if (tok.type === 'LPAREN') {
        next();
        const body = parseSequence([]);
        if (peek() && peek().type === 'RPAREN') next();
        return {
          type: 'Subshell',
          body,
          redirects: parseTrailingRedirects()
        };
      }

      // 2. Brace group: { list; }
      if (isWord(tok, '{')) {
        next();
        const body = parseSequence(['}']);
        if (isWord(peek(), '}')) next();
        return {
          type: 'BraceGroup',
          body,
          redirects: parseTrailingRedirects()
        };
      }

      // 3. If / elif / else / fi
      if (isWord(tok, 'if')) {
        next();
        const branches = [];
        const cond = parseSequence(['then']);
        if (isWord(peek(), 'then')) next();
        const body = parseSequence(['elif', 'else', 'fi']);
        branches.push({ cond, body });

        while (isWord(peek(), 'elif')) {
          next();
          const elifCond = parseSequence(['then']);
          if (isWord(peek(), 'then')) next();
          const elifBody = parseSequence(['elif', 'else', 'fi']);
          branches.push({ cond: elifCond, body: elifBody });
        }

        let elseBody = null;
        if (isWord(peek(), 'else')) {
          next();
          elseBody = parseSequence(['fi']);
        }
        if (isWord(peek(), 'fi')) next();
        return {
          type: 'If',
          branches,
          elseBody,
          redirects: parseTrailingRedirects()
        };
      }

      // 4. For loop: for var [in words...]; do list; done
      if (isWord(tok, 'for')) {
        next();
        const varTok = next();
        const varName = varTok ? varTok.raw : 'i';
        let items = null;
        if (isWord(peek(), 'in')) {
          next();
          items = [];
          while (peek() && peek().type === 'WORD' && !isWord(peek(), 'do')) {
            items.push(next());
          }
        }
        skipSeps();
        if (isWord(peek(), 'do')) next();
        const body = parseSequence(['done']);
        if (isWord(peek(), 'done')) next();
        return {
          type: 'For',
          varName,
          items,
          body,
          redirects: parseTrailingRedirects()
        };
      }

      // 5. While / Until loop: while cond; do list; done
      if (isWord(tok, 'while', 'until')) {
        const kw = next().raw;
        const cond = parseSequence(['do']);
        if (isWord(peek(), 'do')) next();
        const body = parseSequence(['done']);
        if (isWord(peek(), 'done')) next();
        return {
          type: kw === 'while' ? 'While' : 'Until',
          cond,
          body,
          redirects: parseTrailingRedirects()
        };
      }

      // 6. Case statement: case word in [ ( ] pat [ | pat ] ) list ;; ... esac
      if (isWord(tok, 'case')) {
        next();
        const word = next();
        skipSeps();
        if (isWord(peek(), 'in')) next();
        skipSeps();
        const clauses = [];
        while (pos < tokens.length && !isWord(peek(), 'esac')) {
          skipSeps();
          if (isWord(peek(), 'esac')) break;
          if (peek() && peek().type === 'LPAREN') next();
          const patterns = [];
          while (pos < tokens.length && peek().type !== 'RPAREN' && !isWord(peek(), 'esac')) {
            if (peek().type === 'PIPE') { next(); continue; }
            patterns.push(next());
          }
          if (peek() && peek().type === 'RPAREN') next();
          const body = parseSequence(['esac']);
          if (peek() && peek().type === 'DSEMI') next();
          skipSeps();
          clauses.push({ patterns, body });
        }
        if (isWord(peek(), 'esac')) next();
        return {
          type: 'Case',
          word,
          clauses,
          redirects: parseTrailingRedirects()
        };
      }

      // 7. Function definition: function name[()] { ... } or name() { ... }
      if (isWord(tok, 'function')) {
        next();
        const nameTok = next();
        const fnName = nameTok ? nameTok.raw : '';
        if (peek() && peek().type === 'LPAREN') {
          next();
          if (peek() && peek().type === 'RPAREN') next();
        }
        skipSeps();
        const body = parseCommand(stopWords);
        return {
          type: 'FunctionDef',
          name: fnName,
          body
        };
      }
      if (tok.type === 'WORD' && tokens[pos + 1] && tokens[pos + 1].type === 'LPAREN' && tokens[pos + 2] && tokens[pos + 2].type === 'RPAREN') {
        const fnName = next().raw;
        next(); // (
        next(); // )
        skipSeps();
        const body = parseCommand(stopWords);
        return {
          type: 'FunctionDef',
          name: fnName,
          body
        };
      }

      // 8. Simple Command: leading ENV=val, name, args, redirections
      const envVars = [];
      const words = [];
      const redirects = [];

      while (pos < tokens.length) {
        const token = peek();
        if (!token) break;

        // Special handling inside [[ ... ]]: consume operators as literal word tokens until ]]
        if (words.length >= 1 && words[0].raw === '[[') {
          if (token.type === 'WORD' && token.raw === ']]') {
            words.push(next());
            break;
          }
          if (token.type === 'SEMICOLON') break;
          const t = next();
          if (t.type === 'WORD') {
            words.push(t);
          } else {
            const rawOp = t.raw || t.op || '';
            words.push({ type: 'WORD', segments: [{ type: 'literal', value: rawOp }], raw: rawOp, hasWildcard: false });
          }
          continue;
        }

        if (token.type === 'PIPE' || token.type === 'AND' || token.type === 'OR' ||
            token.type === 'SEMICOLON' || token.type === 'DSEMI' || token.type === 'BACKGROUND' ||
            token.type === 'LPAREN' || token.type === 'RPAREN') {
          break;
        }

        // Redirection: >, >>, <, <<, <<<, 2>, 2>>
        if (token.type === 'REDIRECT') {
          next();
          if (token.op === '<<') {
            redirects.push({
              type: '<<',
              sourceFd: token.sourceFd,
              body: token.body,
              quoted: token.quoted,
              stripTabs: token.stripTabs
            });
            continue;
          }
          const targetToken = peek();
          let target = null;
          if (targetToken && targetToken.type === 'WORD') {
            target = next();
          }
          redirects.push({
            type: token.op,
            sourceFd: token.sourceFd,
            target
          });
          continue;
        }

        // Redirection FD duplicate: 2>&1, 1>&2
        if (token.type === 'REDIRECT_FD') {
          next();
          redirects.push({
            type: '>&',
            sourceFd: token.sourceFd,
            targetFd: token.targetFd
          });
          continue;
        }

        // Word token
        if (token.type === 'WORD') {
          // If no command name yet, check if this is an environment assignment: KEY=value
          if (words.length === 0 && token.raw.includes('=')) {
            const eqIdx = token.raw.indexOf('=');
            const key = token.raw.slice(0, eqIdx);
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              envVars.push({ key, rawVal: token.raw.slice(eqIdx + 1), token });
              next();
              continue;
            }
          }

          words.push(next());
          continue;
        }

        next();
      }

      if (words.length === 0 && envVars.length === 0 && redirects.length === 0) {
        return null;
      }

      return {
        type: 'Command',
        name: words[0] || null,
        args: words.slice(1),
        envVars,
        redirects
      };
    }

    return parseSequence([]);
  }

  // =========================================================================
  // 5. IN-MEMORY VFS FALLBACK SHIM (For Standalone Zero-Config Usability)
  // =========================================================================
  function createFallbackVfs() {
    const files = new Map();
    const dirs = new Set(['/', '/tmp', '/workspace', '/etc', '/home', '/home/user']);

    function norm(p) {
      return PosixPath.normalize(p.startsWith('/') ? p : '/workspace/' + p);
    }

    const emitter = {
      _listeners: new Map(),
      on(evt, fn) {
        if (!this._listeners.has(evt)) this._listeners.set(evt, []);
        this._listeners.get(evt).push(fn);
      },
      emit(evt, ...args) {
        const fns = this._listeners.get(evt) || [];
        for (const fn of fns) fn(...args);
      }
    };

    return {
      ...emitter,
      existsSync(p) {
        const np = norm(p);
        return dirs.has(np) || files.has(np);
      },
      statSync(p) {
        const np = norm(p);
        if (dirs.has(np)) {
          return { size: 0, mtimeMs: Date.now(), isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, mode: 0o40755 };
        }
        const f = files.get(np);
        if (f) {
          return {
            size: f.data.length,
            mtimeMs: f.mtimeMs,
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => Boolean(f.symlinkTarget),
            symlinkTarget: f.symlinkTarget || null,
            mode: f.mode !== undefined ? f.mode : 0o100644
          };
        }
        const err = new Error(`ENOENT: no such file or directory, stat '${p}'`);
        err.code = 'ENOENT';
        throw err;
      },
      lstatSync(p) {
        return this.statSync(p);
      },
      symlinkSync(target, p) {
        const np = norm(p);
        const targetAbs = norm(target);
        const content = files.has(targetAbs) ? files.get(targetAbs).data : '';
        files.set(np, { data: content, mtimeMs: Date.now(), mode: 0o120777, symlinkTarget: target });
      },
      chmodSync(p, mode) {
        const np = norm(p);
        if (dirs.has(np)) return;
        const f = files.get(np);
        if (!f) {
          const err = new Error(`ENOENT: no such file or directory, chmod '${p}'`);
          err.code = 'ENOENT';
          throw err;
        }
        const parsedMode = typeof mode === 'string' ? parseInt(mode, 8) : Number(mode);
        const currentType = (f.mode !== undefined ? f.mode : 0o100644) & ~0o777;
        f.mode = currentType | (parsedMode & 0o777);
      },
      readdirSync(p) {
        const np = norm(p);
        if (!dirs.has(np)) {
          const err = new Error(`ENOTDIR: not a directory, scandir '${p}'`);
          err.code = 'ENOTDIR';
          throw err;
        }
        const prefix = np === '/' ? '/' : np + '/';
        const children = new Set();
        for (const d of dirs) {
          if (d !== np && d.startsWith(prefix)) {
            const rest = d.slice(prefix.length).split('/')[0];
            if (rest) children.add(rest);
          }
        }
        for (const f of files.keys()) {
          if (f.startsWith(prefix)) {
            const rest = f.slice(prefix.length);
            if (!rest.includes('/')) children.add(rest);
          }
        }
        return Array.from(children).sort();
      },
      readFileSync(p) {
        const np = norm(p);
        const f = files.get(np);
        if (!f) {
          const err = new Error(`ENOENT: no such file or directory, open '${p}'`);
          err.code = 'ENOENT';
          throw err;
        }
        return f.data;
      },
      writeFileSync(p, data) {
        const np = norm(p);
        const parent = PosixPath.dirname(np);
        if (!dirs.has(parent)) {
          const parts = parent.split('/').filter(Boolean);
          let cur = '';
          for (const pt of parts) { cur += '/' + pt; dirs.add(cur); }
        }
        const str = typeof data === 'string' ? data : (data.toString ? data.toString('utf8') : String(data));
        const prevMode = files.has(np) ? files.get(np).mode : 0o100644;
        files.set(np, { data: str, mtimeMs: Date.now(), mode: prevMode });
      },
      appendFileSync(p, data) {
        const np = norm(p);
        const prev = files.has(np) ? files.get(np).data : '';
        const str = typeof data === 'string' ? data : (data.toString ? data.toString('utf8') : String(data));
        this.writeFileSync(np, prev + str);
      },
      mkdirSync(p, opts = {}) {
        const np = norm(p);
        const recursive = Boolean(opts && opts.recursive);
        if (files.has(np)) throw new Error(`EEXIST: file already exists, mkdir '${p}'`);
        if (dirs.has(np)) return;
        const parent = PosixPath.dirname(np);
        if (!dirs.has(parent)) {
          if (!recursive) throw new Error(`ENOENT: no such file or directory, mkdir '${p}'`);
          const parts = np.split('/').filter(Boolean);
          let cur = '';
          for (const pt of parts) { cur += '/' + pt; dirs.add(cur); }
          return;
        }
        dirs.add(np);
      },
      rmdirSync(p, opts = {}) {
        const np = norm(p);
        const recursive = Boolean(opts && opts.recursive);
        if (!dirs.has(np)) {
          const err = new Error(`ENOENT: no such file or directory, rmdir '${p}'`);
          err.code = 'ENOENT';
          throw err;
        }
        if (!recursive) {
          const prefix = np === '/' ? '/' : np + '/';
          for (const f of files.keys()) {
            if (f.startsWith(prefix)) {
              const err = new Error(`ENOTEMPTY: directory not empty, rmdir '${p}'`);
              err.code = 'ENOTEMPTY';
              throw err;
            }
          }
          for (const d of dirs) {
            if (d !== np && d.startsWith(prefix)) {
              const err = new Error(`ENOTEMPTY: directory not empty, rmdir '${p}'`);
              err.code = 'ENOTEMPTY';
              throw err;
            }
          }
          if (np !== '/' && np !== '/workspace' && np !== '/tmp') dirs.delete(np);
          return;
        }
        this.rmSync(p, { ...opts, recursive: true });
      },
      unlinkSync(p) {
        const np = norm(p);
        if (!files.has(np)) throw new Error(`ENOENT: no such file or directory, unlink '${p}'`);
        files.delete(np);
      },
      rmSync(p, opts = {}) {
        const np = norm(p);
        const recursive = Boolean(opts && opts.recursive);
        const force = Boolean(opts && opts.force);
        if (files.has(np)) { files.delete(np); return; }
        if (dirs.has(np)) {
          if (!recursive) {
            const err = new Error(`EISDIR: illegal operation on a directory, rm '${p}'`);
            err.code = 'EISDIR';
            throw err;
          }
          const prefix = np === '/' ? '/' : np + '/';
          for (const f of Array.from(files.keys())) {
            if (f.startsWith(prefix)) files.delete(f);
          }
          for (const d of Array.from(dirs)) {
            if (d.startsWith(prefix) && d !== '/' && d !== '/workspace' && d !== '/tmp') dirs.delete(d);
          }
          if (np !== '/' && np !== '/workspace' && np !== '/tmp') dirs.delete(np);
          return;
        }
        if (!force) throw new Error(`ENOENT: no such file or directory, rm '${p}'`);
      },
      renameSync(oldP, newP) {
        const src = norm(oldP);
        const dst = norm(newP);
        if (files.has(src)) {
          files.set(dst, files.get(src));
          files.delete(src);
        } else if (dirs.has(src)) {
          const prefix = src === '/' ? '/' : src + '/';
          dirs.add(dst);
          if (src !== '/' && src !== '/workspace' && src !== '/tmp') dirs.delete(src);
          for (const d of Array.from(dirs)) {
            if (d.startsWith(prefix)) {
              dirs.add(dst + '/' + d.slice(prefix.length));
              dirs.delete(d);
            }
          }
          for (const [f, val] of Array.from(files.entries())) {
            if (f.startsWith(prefix)) {
              files.set(dst + '/' + f.slice(prefix.length), val);
              files.delete(f);
            }
          }
        } else {
          throw new Error(`ENOENT: no such file or directory, rename '${oldP}' -> '${newP}'`);
        }
      },
      copyFileSync(src, dst) {
        const s = norm(src);
        const d = norm(dst);
        if (!files.has(s)) throw new Error(`ENOENT: no such file or directory, copy '${src}'`);
        files.set(d, { data: files.get(s).data, mtimeMs: Date.now() });
      }
    };
  }

  // =========================================================================
  // 6. DIFF & LCS UTILITIES (For `diff -u` and `git diff`)
  // =========================================================================
  function computeUnifiedDiff(file1Name, file2Name, text1, text2) {
    const lines1 = text1.length > 0 ? text1.split('\n') : [];
    const lines2 = text2.length > 0 ? text2.split('\n') : [];

    // LCS table
    const m = lines1.length;
    const n = lines2.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (lines1[i - 1] === lines2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build diff ops
    const edits = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
        edits.push({ type: 'common', line: lines1[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        edits.push({ type: 'added', line: lines2[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        edits.push({ type: 'removed', line: lines1[i - 1] });
        i--;
      }
    }
    edits.reverse();

    if (!edits.some(e => e.type !== 'common')) {
      return ''; // identical
    }

    let diffOutput = `--- ${file1Name}\n+++ ${file2Name}\n@@ -1,${m} +1,${n} @@\n`;
    for (const e of edits) {
      if (e.type === 'common') diffOutput += ` ${e.line}\n`;
      else if (e.type === 'added') diffOutput += `+${e.line}\n`;
      else if (e.type === 'removed') diffOutput += `-${e.line}\n`;
    }
    return diffOutput;
  }

  // =========================================================================
  // 6b. GIT & PUBLIC GITHUB CLONE ENGINE (Zero-Auth CORS-Friendly API + CDN)
  // =========================================================================
  function parseGitHubRepoUrl(input) {
    if (!input || typeof input !== 'string') return null;
    let raw = input.trim();
    if (!raw) return null;

    let owner = null;
    let repo = null;
    let branch = null;
    let subpath = null;

    // Extract optional #branch fragment (e.g. https://github.com/owner/repo#branch or owner/repo#branch)
    const hashIdx = raw.indexOf('#');
    if (hashIdx !== -1) {
      const hashBranch = raw.slice(hashIdx + 1).trim();
      raw = raw.slice(0, hashIdx).trim();
      if (hashBranch) branch = hashBranch;
    }

    // 1. SSH format: git@github.com:owner/repo(.git)
    const sshMatch = raw.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
    if (sshMatch) {
      owner = sshMatch[1];
      repo = sshMatch[2];
      return {
        owner,
        repo,
        branch,
        subpath: null,
        fullName: `${owner}/${repo}`,
        httpsUrl: `https://github.com/${owner}/${repo}`,
        gitUrl: `https://github.com/${owner}/${repo}.git`,
        url: `https://github.com/${owner}/${repo}.git`
      };
    }

    // 2. HTTPS / HTTP / github.com format
    const httpMatch = raw.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)(?:\/(.+?))?)?\/?$/);
    if (httpMatch) {
      owner = httpMatch[1];
      repo = httpMatch[2];
      branch = httpMatch[4] || branch || null;
      subpath = httpMatch[5] ? httpMatch[5].replace(/^\/+|\/+$/g, '') : null;
      return {
        owner,
        repo,
        branch,
        subpath,
        fullName: `${owner}/${repo}`,
        httpsUrl: `https://github.com/${owner}/${repo}`,
        gitUrl: `https://github.com/${owner}/${repo}.git`,
        url: `https://github.com/${owner}/${repo}.git`
      };
    }

    // 3. Shorthand format: owner/repo or owner/repo@branch (where owner has no dots)
    const shortMatch = raw.match(/^([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:@([A-Za-z0-9_./-]+))?$/);
    if (shortMatch && !shortMatch[1].startsWith('-')) {
      owner = shortMatch[1];
      repo = shortMatch[2];
      branch = shortMatch[3] || branch || null;
      return {
        owner,
        repo,
        branch,
        subpath: null,
        fullName: `${owner}/${repo}`,
        httpsUrl: `https://github.com/${owner}/${repo}`,
        gitUrl: `https://github.com/${owner}/${repo}.git`,
        url: `https://github.com/${owner}/${repo}.git`
      };
    }

    return null;
  }

  function snapshotWorktree(vfs, rootDir) {
    const snap = {};
    if (!vfs || !rootDir || !vfs.existsSync(rootDir)) return snap;
    const base = PosixPath.normalize(rootDir);

    function walk(currDir) {
      let entries = [];
      try {
        entries = vfs.readdirSync(currDir);
      } catch (_) {
        return;
      }
      for (const name of entries) {
        if (name === '.git' || name === 'node_modules') continue;
        const full = PosixPath.join(currDir, name);
        let st;
        try {
          st = vfs.statSync(full);
        } catch (_) {
          continue;
        }
        if (st.isDirectory()) {
          walk(full);
        } else {
          const rel = full.startsWith(base === '/' ? '/' : base + '/')
            ? full.slice(base === '/' ? 1 : base.length + 1)
            : name;
          try {
            snap[rel] = String(vfs.readFileSync(full, 'utf8'));
          } catch (_) {}
        }
      }
    }

    walk(base);
    return snap;
  }

  const BINARY_OR_HEAVY_EXT_RE = /\.(png|jpg|jpeg|gif|webp|ico|bmp|tiff|woff|woff2|ttf|eot|otf|mp3|mp4|wav|ogg|webm|avi|mov|pdf|zip|tar|gz|tgz|bz2|7z|rar|exe|dll|so|dylib|wasm|pyc|pyo|class|jar|war|ear|bin|dat|iso|dmg|pkg|deb|rpm|o|a|lib|DS_Store)$/i;

  function scoreRepoFilePriority(relPath) {
    const lower = relPath.toLowerCase();
    const base = PosixPath.basename(lower);
    const depth = relPath.split('/').length;
    if (base === 'readme.md' || base === 'package.json' || base === 'cargo.toml' || base === 'go.mod' || base === 'pyproject.toml') return 0;
    if (depth === 1 && /\.(js|ts|jsx|tsx|mjs|cjs|py|go|rs|json|md|yml|yaml|toml|sh)$/.test(lower)) return 1;
    if (lower.startsWith('src/') || lower.startsWith('lib/') || lower.startsWith('app/')) return 2 + depth * 0.1;
    if (lower.startsWith('test/') || lower.startsWith('tests/') || lower.startsWith('examples/')) return 5 + depth * 0.1;
    return 10 + depth * 0.1;
  }

  async function cloneGitHubRepository(repoInput, vfs, options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    try {
      if (onProgress) {
        onProgress({
          phase: 'connecting',
          message: `Connecting to repository '${repoInput}'...`
        });
      }

      const parsed = parseGitHubRepoUrl(repoInput);
      if (!parsed) {
        throw new Error(`fatal: repository '${repoInput}' does not exist or is not a valid GitHub repository URL`);
      }
      if (!vfs) {
        throw new Error('fatal: virtual filesystem (vfs) is required to clone repository');
      }

      const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (!fetchFn) {
        throw new Error('fatal: global fetch API is unavailable in this environment');
      }

      const targetDir = PosixPath.normalize(options.targetDir || '/workspace');
      const maxFiles = options.maxFiles || 250;
      const maxFileSize = options.maxFileSize || 512 * 1024;
      const requestedBranch = options.branch || parsed.branch || null;
      const { owner, repo } = parsed;

      const signal = options.signal || null;
      const throwIfAborted = () => {
        if (signal && signal.aborted) {
          const abortErr = new Error('fatal: clone cancelled (SIGINT)');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      };
      throwIfAborted();

      if (onProgress) {
        onProgress({
          phase: 'metadata',
          message: `Fetching repository metadata for ${owner}/${repo}...`
        });
      }

      let resolvedBranch = requestedBranch;
      let rawTreeEntries = null;
      let repoNotFound = false;

      // Strategy A: GitHub REST API (with automatic fallback if rate-limited)
      try {
        if (!resolvedBranch) {
          const metaRes = await fetchFn(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Accept: 'application/vnd.github.v3+json' },
            signal
          });
          if (metaRes.status === 404) {
            repoNotFound = true;
          } else if (metaRes.ok) {
            const metaJson = await metaRes.json();
            if (metaJson && metaJson.default_branch) {
              resolvedBranch = metaJson.default_branch;
            }
          }
        }

        if (!repoNotFound) {
          const branchCandidates = requestedBranch
            ? [requestedBranch]
            : Array.from(new Set([resolvedBranch, 'main', 'master'].filter(Boolean)));

          for (const cand of branchCandidates) {
            throwIfAborted();
            const treeRes = await fetchFn(
              `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(cand)}?recursive=1`,
              { headers: { Accept: 'application/vnd.github.v3+json' }, signal }
            );
            if (treeRes.ok) {
              const treeJson = await treeRes.json();
              if (treeJson && Array.isArray(treeJson.tree)) {
                resolvedBranch = cand;
                rawTreeEntries = treeJson.tree
                  .filter((item) => item && item.type === 'blob' && item.path)
                  .map((item) => ({ path: item.path.replace(/^\/+/, ''), size: item.size || 0 }));
                break;
              }
            }
          }
        }
      } catch (_) {
        // Network or rate limit error on api.github.com; proceed to Strategy B
      }

      // Strategy B: jsDelivr Data API (Zero rate limits, fast global edge cache)
      if (!rawTreeEntries && !repoNotFound) {
        try {
          const branchCandidates = requestedBranch
            ? [requestedBranch]
            : Array.from(new Set([resolvedBranch, 'main', 'master'].filter(Boolean)));

          for (const cand of branchCandidates) {
            throwIfAborted();
            const flatRes = await fetchFn(
              `https://data.jsdelivr.com/v1/package/gh/${owner}/${repo}@${encodeURIComponent(cand)}/flat`,
              { signal }
            );
            if (flatRes && flatRes.ok) {
              const flatJson = await flatRes.json();
              if (flatJson && Array.isArray(flatJson.files) && flatJson.files.length > 0) {
                resolvedBranch = cand;
                rawTreeEntries = flatJson.files
                  .filter((f) => f && f.name)
                  .map((f) => ({ path: f.name.replace(/^\/+/, ''), size: f.size || 0 }));
                break;
              }
            }
          }
        } catch (_) {}
      }

      if (repoNotFound || !rawTreeEntries) {
        throw new Error(`fatal: repository '${parsed.url}' not found or could not be fetched`);
      }

      // Filter subpath if specified (e.g. /tree/main/examples)
      const subPrefix = parsed.subpath ? parsed.subpath.replace(/^\/+|\/+$/g, '') + '/' : null;
      const filtered = [];
      for (const item of rawTreeEntries) {
        let destPath = item.path;
        if (subPrefix) {
          if (item.path === parsed.subpath) {
            destPath = PosixPath.basename(item.path);
          } else if (item.path.startsWith(subPrefix)) {
            destPath = item.path.slice(subPrefix.length);
          } else {
            continue;
          }
        }
        if (!destPath || destPath.startsWith('.git/') || destPath.includes('/node_modules/') || destPath.startsWith('node_modules/')) {
          continue;
        }
        if (BINARY_OR_HEAVY_EXT_RE.test(destPath)) {
          continue;
        }
        if (item.size && item.size > maxFileSize) {
          continue;
        }
        filtered.push({
          repoPath: item.path,
          destPath,
          size: item.size || 0,
          priority: scoreRepoFilePriority(destPath)
        });
      }

      filtered.sort((a, b) => a.priority - b.priority || a.destPath.localeCompare(b.destPath));
      const selectedFiles = filtered.slice(0, maxFiles);
      const totalToDownload = selectedFiles.length;

      if (onProgress) {
        onProgress({
          phase: 'downloading',
          message: `Downloading files (0/${totalToDownload})...`,
          loaded: 0,
          total: totalToDownload
        });
      }

      if (!vfs.existsSync(targetDir)) {
        vfs.mkdirSync(targetDir, { recursive: true });
      }

      const headSnapshot = {};
      let filesWritten = 0;
      let totalBytes = 0;
      const BATCH_SIZE = 12;

      for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
        throwIfAborted();
        const batch = selectedFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (entry) => {
            throwIfAborted();
            const encodedPath = entry.repoPath.split('/').map(encodeURIComponent).join('/');
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(resolvedBranch)}/${encodedPath}`;
            const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${encodeURIComponent(resolvedBranch)}/${encodedPath}`;

            let text = null;
            try {
              const r1 = await fetchFn(rawUrl, { signal });
              if (r1 && r1.ok) {
                text = await r1.text();
              }
            } catch (_) {
              if (signal && signal.aborted) throw _;
            }

            if (text === null) {
              try {
                const r2 = await fetchFn(cdnUrl, { signal });
                if (r2 && r2.ok) {
                  text = await r2.text();
                }
              } catch (_) {
                if (signal && signal.aborted) throw _;
              }
            }

            if (text !== null && text.length <= maxFileSize) {
              const absPath = PosixPath.join(targetDir, entry.destPath);
              const parentDir = PosixPath.dirname(absPath);
              if (!vfs.existsSync(parentDir)) {
                vfs.mkdirSync(parentDir, { recursive: true });
              }
              vfs.writeFileSync(absPath, text);
              headSnapshot[entry.destPath] = text;
              filesWritten++;
              totalBytes += text.length;

              if (onProgress) {
                onProgress({
                  phase: 'downloading',
                  message: `Downloading files (${filesWritten}/${totalToDownload}): ${entry.destPath}`,
                  loaded: filesWritten,
                  total: totalToDownload
                });
              }

              if (typeof options.onFile === 'function') {
                options.onFile(absPath, text, entry.destPath);
              }
            }
          })
        );
      }

      throwIfAborted();

      if (onProgress) {
        onProgress({
          phase: 'mounting',
          message: `Mounting files and writing Git metadata into ${targetDir}...`,
          loaded: filesWritten,
          total: totalToDownload
        });
      }

      // Write .git metadata inside targetDir
      const gitDir = PosixPath.join(targetDir, '.git');
      if (!vfs.existsSync(gitDir)) {
        vfs.mkdirSync(gitDir, { recursive: true });
      }
      vfs.writeFileSync(PosixPath.join(gitDir, 'HEAD'), `ref: refs/heads/${resolvedBranch}\n`);
      vfs.writeFileSync(
        PosixPath.join(gitDir, 'config'),
        `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = ${parsed.url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "${resolvedBranch}"]\n\tremote = origin\n\tmerge = refs/heads/${resolvedBranch}\n`
      );

      // Fetch recent commits (best-effort)
      let commits = [];
      try {
        const commitsRes = await fetchFn(
          `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(resolvedBranch)}&per_page=10`,
          { headers: { Accept: 'application/vnd.github.v3+json' }, signal }
        );
        if (commitsRes && commitsRes.ok) {
          const commitsJson = await commitsRes.json();
          if (Array.isArray(commitsJson) && commitsJson.length > 0) {
            commits = commitsJson.map((c) => ({
              hash: String(c.sha || 'a1b2c3d').slice(0, 7),
              author:
                c.commit && c.commit.author
                  ? `${c.commit.author.name || owner} <${c.commit.author.email || `${owner}@users.noreply.github.com`}>`
                  : `${owner} <${owner}@users.noreply.github.com>`,
              date:
                c.commit && c.commit.author && c.commit.author.date
                  ? new Date(c.commit.author.date).toUTCString()
                  : new Date().toUTCString(),
              message: c.commit && c.commit.message ? String(c.commit.message).split('\n')[0] : 'Commit'
            }));
          }
        }
      } catch (_) {}

      if (commits.length === 0) {
        commits = [
          {
            hash: 'a1b2c3d',
            author: `${owner} <${owner}@users.noreply.github.com>`,
            date: new Date().toUTCString(),
            message: `Clone ${owner}/${repo} (${resolvedBranch})`
          }
        ];
      }

      if (onProgress) {
        onProgress({
          phase: 'ready',
          message: `Repository cloned successfully (${filesWritten} files).`,
          loaded: filesWritten,
          total: totalToDownload
        });
      }

      return {
        owner,
        repo,
        branch: resolvedBranch,
        url: parsed.url,
        targetDir,
        count: filesWritten,
        fileCount: filesWritten,
        filesWritten,
        totalBytes,
        commits,
        headSnapshot
      };
    } catch (err) {
      if (onProgress) {
        onProgress({
          phase: 'error',
          message: err && err.message ? err.message : String(err)
        });
      }
      throw err;
    }
  }

  // =========================================================================
  // Package Management Helpers (npm / bun virtual modules & scripts)
  // =========================================================================
  function findPackageJsonPath(vfs, cwd) {
    const cwdPkg = PosixPath.join(cwd || '/workspace', 'package.json');
    if (vfs.existsSync(cwdPkg)) return cwdPkg;
    const wsPkg = '/workspace/package.json';
    if (vfs.existsSync(wsPkg)) return wsPkg;
    return cwdPkg;
  }

  function readPackageJson(vfs, cwd) {
    const p = findPackageJsonPath(vfs, cwd);
    if (vfs.existsSync(p)) {
      try {
        const parsed = JSON.parse(vfs.readFileSync(p, 'utf8'));
        return { path: p, data: parsed };
      } catch (_) {}
    }
    return { path: p, data: { name: 'app', dependencies: {}, devDependencies: {}, scripts: {} } };
  }

  function writePackageJson(vfs, pkgPath, data, emitMutation) {
    const dir = PosixPath.dirname(pkgPath);
    if (!vfs.existsSync(dir)) {
      vfs.mkdirSync(dir, { recursive: true });
    }
    const jsonStr = JSON.stringify(data, null, 2) + '\n';
    vfs.writeFileSync(pkgPath, jsonStr);
    if (typeof emitMutation === 'function') emitMutation('change', pkgPath);
  }

  function ensureDirSync(vfs, dir, emitMutation) {
    if (!vfs.existsSync(dir)) {
      vfs.mkdirSync(dir, { recursive: true });
      if (typeof emitMutation === 'function') emitMutation('create', dir);
    }
  }

  function removeDirRecursive(vfs, dirPath, emitMutation) {
    if (!vfs.existsSync(dirPath)) return;
    try {
      if (typeof vfs.rmSync === 'function') {
        vfs.rmSync(dirPath, { recursive: true, force: true });
      } else {
        const entries = vfs.readdirSync(dirPath);
        for (const entry of entries) {
          const full = PosixPath.join(dirPath, entry);
          const st = vfs.statSync(full);
          if (st.isDirectory()) {
            removeDirRecursive(vfs, full, emitMutation);
          } else {
            vfs.unlinkSync(full);
          }
        }
        vfs.rmdirSync(dirPath);
      }
      if (typeof emitMutation === 'function') emitMutation('delete', dirPath);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Real npm package installation via the jsDelivr CDN
  // ---------------------------------------------------------------------------
  const CDN_NPM_BASE = 'https://cdn.jsdelivr.net/npm';

  // Minimal offline registry, used only when the CDN is unreachable so common
  // demos still resolve without network access.
  const OFFLINE_PACKAGE_FALLBACKS = {
    'is-even': 'module.exports = function isEven(n) { return (Number(n) % 2) === 0; };\n',
    'tiny-invariant': 'module.exports = function invariant(condition, message) { if (!condition) throw new Error(message || "Invariant failed"); };\n',
    'lodash': 'module.exports = { isArray: Array.isArray, isObject: function (v) { return v !== null && typeof v === "object"; } };\n',
    'left-pad': 'module.exports = function leftPad(str, len, ch) { str = String(str); ch = (ch === undefined ? " " : String(ch)); while (str.length < len) str = ch + str; return str.slice(-len); };\n'
  };

  function packageCtxFetch(ctx) {
    if (ctx && ctx.shell && ctx.shell.options && typeof ctx.shell.options.fetchImpl === 'function') {
      return ctx.shell.options.fetchImpl;
    }
    if (typeof fetch === 'function') return fetch.bind(globalThis);
    return null;
  }

  function parsePackageSpec(spec) {
    const raw = String(spec || '').trim();
    if (!raw) return { name: '', range: null };
    if (raw.startsWith('@')) {
      const at = raw.indexOf('@', 1);
      if (at === -1) return { name: raw, range: null };
      return { name: raw.slice(0, at), range: raw.slice(at + 1) || null };
    }
    const at = raw.indexOf('@');
    if (at <= 0) return { name: raw, range: null };
    return { name: raw.slice(0, at), range: raw.slice(at + 1) || null };
  }

  function resolveEntryRelPath(pkgJson) {
    let entry = pkgJson.main || pkgJson.module ||
      (typeof pkgJson.browser === 'string' ? pkgJson.browser : '') || 'index.js';
    entry = String(entry).replace(/^[./]+/, '');
    return entry || 'index.js';
  }

  function stripRelPath(rel) {
    return String(rel || '').replace(/^[./]+/, '');
  }

  function extractRelativeSpecifiers(code) {
    const out = new Set();
    const re = /(?:\brequire\s*\(\s*|\bimport\s+[\s\S]{0,120}?\bfrom\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(code)) !== null) out.add(m[1]);
    return Array.from(out);
  }

  function normalizeRelPath(baseDir, rel) {
    const parts = String(baseDir || '').split('/').filter(Boolean);
    for (const seg of String(rel).split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  }

  async function fetchTextFromCdn(fetchImpl, url) {
    try {
      const res = await fetchImpl(url);
      if (!res) return null;
      const ok = (res.ok === true) || res.status === 200 || res.status === undefined;
      if (!ok) return null;
      if (typeof res.text === 'function') return await res.text();
      return String(res.body != null ? res.body : '');
    } catch (_) {
      return null;
    }
  }

  async function resolvePackageMetadata(fetchImpl, name, range) {
    const urls = range
      ? [`${CDN_NPM_BASE}/${name}@${range}/package.json`, `${CDN_NPM_BASE}/${name}/package.json`]
      : [`${CDN_NPM_BASE}/${name}/package.json`];
    for (const url of urls) {
      const text = await fetchTextFromCdn(fetchImpl, url);
      if (!text) continue;
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.version) return parsed;
      } catch (_) {}
    }
    return null;
  }

  // Download a package's entry module, its relative submodules and record its
  // declared dependencies so the caller can resolve them transitively.
  async function downloadPackageFiles(fetchImpl, name, range, seen) {
    const meta = await resolvePackageMetadata(fetchImpl, name, range);
    if (!meta) {
      const fallback = OFFLINE_PACKAGE_FALLBACKS[name];
      if (fallback) {
        const v = range ? range.replace(/^[\^~>=<\s]+/, '') || '1.0.0' : '1.0.0';
        return { ok: true, offline: true, version: v, entry: 'index.js', files: [{ rel: 'index.js', content: fallback }], deps: [] };
      }
      return { ok: false, reason: `${name}: package metadata not found on the registry (offline?)` };
    }

    const version = meta.version;
    const key = `${name}@${version}`;
    if (seen.has(key)) {
      return { ok: true, deduped: true, version, entry: resolveEntryRelPath(meta), files: [], deps: [] };
    }
    seen.add(key);

    const entry = resolveEntryRelPath(meta);
    const files = [];
    const visited = new Set();
    const queue = [entry];
    while (queue.length > 0) {
      const rel = stripRelPath(queue.shift());
      if (!rel || visited.has(rel)) continue;
      visited.add(rel);
      const text = await fetchTextFromCdn(fetchImpl, `${CDN_NPM_BASE}/${name}@${version}/${rel}`);
      if (text === null) continue;
      files.push({ rel, content: text });
      const baseDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      for (const spec of extractRelativeSpecifiers(text)) {
        const target = normalizeRelPath(baseDir, spec);
        for (const cand of [target, `${target}.js`, `${target}.json`, `${target}/index.js`]) {
          const c = stripRelPath(cand);
          if (c && !visited.has(c)) { queue.push(cand); break; }
        }
      }
    }
    // The declared entry may be missing on the CDN; fall back to index.js.
    if (!files.some(f => f.rel === entry)) {
      const idxText = await fetchTextFromCdn(fetchImpl, `${CDN_NPM_BASE}/${name}@${version}/index.js`);
      if (idxText !== null) files.push({ rel: 'index.js', content: idxText });
    }

    return { ok: true, version, entry, files, deps: Object.keys(meta.dependencies || {}) };
  }

  function installTargetDirs(ctx, name) {
    const dirs = ['/workspace/node_modules/' + name];
    const cwdTarget = PosixPath.join(ctx.cwd || '/workspace', 'node_modules', name);
    if (!dirs.includes(cwdTarget)) dirs.push(cwdTarget);
    return dirs;
  }

  function writeInstalledPackageFiles(ctx, dirs, name, info) {
    for (const dir of dirs) {
      ensureDirSync(ctx.vfs, dir, ctx.emitMutation);
      for (const f of info.files) {
        const full = PosixPath.join(dir, f.rel);
        ensureDirSync(ctx.vfs, PosixPath.dirname(full), ctx.emitMutation);
        ctx.vfs.writeFileSync(full, f.content);
        if (typeof ctx.emitMutation === 'function') ctx.emitMutation('create', full);
      }
      const modPkgPath = PosixPath.join(dir, 'package.json');
      const modPkg = { name, version: info.version || '1.0.0', main: './' + (info.entry || 'index.js') };
      ctx.vfs.writeFileSync(modPkgPath, JSON.stringify(modPkg, null, 2) + '\n');
      if (typeof ctx.emitMutation === 'function') ctx.emitMutation('create', modPkgPath);
    }
  }

  async function installPackage(pkgSpec, ctx) {
    const { name: pkgName, range } = parsePackageSpec(pkgSpec);
    if (!pkgName) return { name: null, ok: false, installed: [], warning: null };

    const { path: pkgPath, data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
    if (!pkgData.dependencies) pkgData.dependencies = {};

    const fetchImpl = packageCtxFetch(ctx);
    const seen = (ctx.shell && ctx.shell._cdnSeen)
      ? ctx.shell._cdnSeen
      : (ctx.shell ? (ctx.shell._cdnSeen = new Set()) : new Set());

    const queue = [{ name: pkgName, range, direct: true }];
    const requested = new Set([pkgName]);
    const installed = [];
    let warning = null;
    let directVersion = null;

    while (queue.length > 0) {
      const item = queue.shift();
      const info = fetchImpl
        ? await downloadPackageFiles(fetchImpl, item.name, item.range, seen)
        : { ok: false, reason: `${item.name}: no fetch implementation available` };

      if (!info.ok) {
        // Final fallback: an empty stub so offline demos still resolve the module.
        writeInstalledPackageFiles(ctx, installTargetDirs(ctx, item.name), item.name, {
          version: '0.0.0', entry: 'index.js', files: [{ rel: 'index.js', content: 'module.exports = {};\n' }]
        });
        if (!warning) warning = info.reason;
        installed.push({ name: item.name, version: '0.0.0' });
        continue;
      }

      writeInstalledPackageFiles(ctx, installTargetDirs(ctx, item.name), item.name, info);
      installed.push({ name: item.name, version: info.version || '1.0.0' });
      if (item.direct) directVersion = info.version || null;

      for (const dep of (info.deps || [])) {
        const parsed = parsePackageSpec(dep);
        if (parsed.name && !requested.has(parsed.name)) {
          requested.add(parsed.name);
          queue.push({ name: parsed.name, range: null, direct: false });
        }
      }
    }

    pkgData.dependencies[pkgName] = range || (directVersion ? `^${directVersion}` : (pkgData.dependencies[pkgName] || 'latest'));
    writePackageJson(ctx.vfs, pkgPath, pkgData, ctx.emitMutation);

    return { name: pkgName, ok: true, version: directVersion, installed, warning };
  }

  function uninstallPackage(pkgName, ctx) {
    const { path: pkgPath, data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
    let changed = false;
    if (pkgData.dependencies && pkgName in pkgData.dependencies) {
      delete pkgData.dependencies[pkgName];
      changed = true;
    }
    if (pkgData.devDependencies && pkgName in pkgData.devDependencies) {
      delete pkgData.devDependencies[pkgName];
      changed = true;
    }
    if (changed) {
      writePackageJson(ctx.vfs, pkgPath, pkgData, ctx.emitMutation);
    }

    const targetDirs = ['/workspace/node_modules/' + pkgName];
    const cwdTarget = PosixPath.join(ctx.cwd || '/workspace', 'node_modules', pkgName);
    if (!targetDirs.includes(cwdTarget)) targetDirs.push(cwdTarget);

    for (const modDir of targetDirs) {
      removeDirRecursive(ctx.vfs, modDir, ctx.emitMutation);
    }
  }

  function listDependencies(ctx) {
    const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
    const deps = Object.assign({}, pkgData.dependencies || {});
    let out = `${pkgData.name || 'project'}@${pkgData.version || '1.0.0'} ${ctx.cwd || '/workspace'}\n`;
    const keys = Object.keys(deps);
    if (keys.length === 0) {
      out += '└── (empty)\n';
    } else {
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = String(deps[k]).replace(/^[\^~]/, '');
        const prefix = (i === keys.length - 1) ? '└── ' : '├── ';
        out += `${prefix}${k}@${v}\n`;
      }
    }
    return out;
  }

  async function runPackageScript(scriptName, scriptArgs, ctx) {
    const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
    if (!pkgData.scripts || !pkgData.scripts[scriptName]) {
      return { code: 1, stdout: '', stderr: `npm ERR! Missing script: "${scriptName}"\n` };
    }
    let cmd = pkgData.scripts[scriptName];
    if (scriptArgs && scriptArgs.length > 0) {
      cmd += ' ' + scriptArgs.join(' ');
    }
    return await ctx.shell.execute(cmd, { cwd: ctx.cwd, env: ctx.env });
  }

  function evaluatePosixTest(args, ctx) {
    const cleanArgs = [...args];
    if (cleanArgs.length > 0 && cleanArgs[cleanArgs.length - 1] === ']') {
      cleanArgs.pop();
    }
    if (cleanArgs.length === 0) return 1;

    if (cleanArgs[0] === '!') {
      return evaluatePosixTest(cleanArgs.slice(1), ctx) === 0 ? 1 : 0;
    }

    if (cleanArgs.length === 1) {
      return cleanArgs[0] ? 0 : 1;
    }

    if (cleanArgs.length === 2) {
      const [op, val] = cleanArgs;
      if (op === '-z') return val.length === 0 ? 0 : 1;
      if (op === '-n') return val.length > 0 ? 0 : 1;
      if (op === '-e' || op === '-f' || op === '-d' || op === '-s') {
        const p = ctx.resolvePath(val);
        if (!ctx.vfs.existsSync(p)) return 1;
        if (op === '-e') return 0;
        const st = ctx.vfs.statSync(p);
        if (op === '-f') return (typeof st.isFile === 'function' ? (st.isFile() ? 0 : 1) : (st.isFile ? 0 : 1));
        if (op === '-d') return (typeof st.isDirectory === 'function' ? (st.isDirectory() ? 0 : 1) : (st.isDirectory ? 0 : 1));
        if (op === '-s') return (st.size > 0 ? 0 : 1);
      }
    }

    if (cleanArgs.length === 3) {
      const [left, op, right] = cleanArgs;
      if (op === '=' || op === '==') return left === right ? 0 : 1;
      if (op === '!=') return left !== right ? 0 : 1;
      const lNum = parseInt(left, 10);
      const rNum = parseInt(right, 10);
      if (op === '-eq') return lNum === rNum ? 0 : 1;
      if (op === '-ne') return lNum !== rNum ? 0 : 1;
      if (op === '-lt') return lNum < rNum ? 0 : 1;
      if (op === '-le') return lNum <= rNum ? 0 : 1;
      if (op === '-gt') return lNum > rNum ? 0 : 1;
      if (op === '-ge') return lNum >= rNum ? 0 : 1;
    }

    return 1;
  }

  // =========================================================================
  // 7. 40+ UNIX COREUTILS LIBRARY (POSIX Virtual Filesystem Implementations)
  // =========================================================================
  const COREUTILS = {
    // -----------------------------------------------------------------------
    // Navigation & Inspection: pwd, cd, ls, stat
    // -----------------------------------------------------------------------
    async pwd(args, ctx) {
      const dir = ctx.shell ? ctx.shell.cwd : ctx.cwd;
      return { code: 0, stdout: dir + '\n', stderr: '' };
    },

    async cd(args, ctx) {
      let target = args[0];
      if (!target || target === '~') {
        target = ctx.env.HOME || '/workspace';
      } else if (target === '-') {
        target = ctx.env.OLDPWD || ctx.cwd;
      }

      const resolved = ctx.resolvePath(target);
      if (!ctx.vfs.existsSync(resolved)) {
        return { code: 1, stdout: '', stderr: `cd: ${target}: No such file or directory\n` };
      }

      let isDir = false;
      try {
        isDir = ctx.vfs.statSync(resolved).isDirectory();
      } catch (_) {}

      if (!isDir) {
        return { code: 1, stdout: '', stderr: `cd: ${target}: Not a directory\n` };
      }

      const oldPwd = ctx.cwd;
      ctx.cwd = resolved;
      ctx.env.OLDPWD = oldPwd;
      ctx.env.PWD = resolved;
      if (ctx.shell) {
        ctx.shell.cwd = resolved;
        ctx.shell.env.OLDPWD = oldPwd;
        ctx.shell.env.PWD = resolved;
      }
      return { code: 0, stdout: '', stderr: '' };
    },

    async ls(args, ctx) {
      let showAll = false;
      let longFormat = false;
      let humanReadable = false;
      let reverse = false;
      let sortByTime = false;
      let onePerLine = false;
      let recursive = false;
      let dirOnly = false;
      const paths = [];

      for (const arg of args) {
        if (arg.startsWith('-') && arg.length > 1) {
          for (let j = 1; j < arg.length; j++) {
            const flag = arg[j];
            if (flag === 'a' || flag === 'A') showAll = true;
            else if (flag === 'l') longFormat = true;
            else if (flag === 'h') humanReadable = true;
            else if (flag === 'r') reverse = true;
            else if (flag === 't') sortByTime = true;
            else if (flag === '1') onePerLine = true;
            else if (flag === 'R') recursive = true;
            else if (flag === 'd') dirOnly = true;
          }
        } else {
          paths.push(arg);
        }
      }

      if (paths.length === 0) paths.push('.');

      function formatSize(bytes) {
        if (!humanReadable) return String(bytes).padStart(6, ' ');
        if (bytes < 1024) return `${bytes}B`.padStart(5, ' ');
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`.padStart(5, ' ');
        return `${(bytes / (1024 * 1024)).toFixed(1)}M`.padStart(5, ' ');
      }

      function formatDate(ms) {
        const d = new Date(ms || Date.now());
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const m = months[d.getMonth()];
        const day = String(d.getDate()).padStart(2, ' ');
        const hr = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${m} ${day} ${hr}:${min}`;
      }

      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      function listDir(rawP, absP, showHeader) {
        if (showHeader) {
          stdout += (stdout.length > 0 ? '\n' : '') + `${rawP}:\n`;
        }

        let entries = [];
        try {
          entries = ctx.vfs.readdirSync(absP);
        } catch (err) {
          stderr += `ls: cannot open directory '${rawP}': ${err.message}\n`;
          exitCode = 2;
          return;
        }

        if (showAll) {
          entries = ['.', '..', ...entries];
        } else {
          entries = entries.filter(e => !e.startsWith('.'));
        }

        const items = entries.map(name => {
          const itemPath = absP === '/' ? '/' + name : absP + '/' + name;
          let isDirectory = false;
          let size = 0;
          let mtimeMs = Date.now();
          try {
            const st = ctx.vfs.statSync(itemPath);
            isDirectory = st.isDirectory();
            size = st.size;
            mtimeMs = st.mtimeMs || Date.now();
          } catch (_) {}
          return { name, isDirectory, size, mtimeMs, absPath: itemPath };
        });

        if (sortByTime) {
          items.sort((a, b) => b.mtimeMs - a.mtimeMs);
        } else {
          items.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (reverse) items.reverse();

        if (longFormat) {
          let totalBlocks = 0;
          for (const it of items) totalBlocks += Math.ceil(it.size / 512);
          stdout += `total ${totalBlocks}\n`;
          for (const it of items) {
            const mode = it.isDirectory ? 'drwxr-xr-x' : '-rw-r--r--';
            stdout += `${mode} 1 ${ctx.env.USER || 'codelab'} ${ctx.env.USER || 'codelab'} ${formatSize(it.size)} ${formatDate(it.mtimeMs)} ${it.name}\n`;
          }
        } else if (onePerLine) {
          for (const it of items) stdout += `${it.name}\n`;
        } else {
          stdout += items.map(it => it.name).join('  ') + (items.length > 0 ? '\n' : '');
        }

        if (recursive) {
          for (const it of items) {
            if (it.isDirectory && it.name !== '.' && it.name !== '..') {
              const childRaw = rawP === '/' ? '/' + it.name : rawP.replace(/\/+$/, '') + '/' + it.name;
              listDir(childRaw, it.absPath, true);
            }
          }
        }
      }

      for (let pIdx = 0; pIdx < paths.length; pIdx++) {
        const rawP = paths[pIdx];
        const absP = ctx.resolvePath(rawP);

        if (!ctx.vfs.existsSync(absP)) {
          stderr += `ls: cannot access '${rawP}': No such file or directory\n`;
          exitCode = 2;
          continue;
        }

        let stat;
        try { stat = ctx.vfs.statSync(absP); } catch (e) {
          stderr += `ls: cannot access '${rawP}': ${e.message}\n`;
          exitCode = 2;
          continue;
        }

        if (stat.isFile() || dirOnly) {
          if (longFormat) {
            stdout += `-rw-r--r-- 1 ${ctx.env.USER || 'codelab'} ${ctx.env.USER || 'codelab'} ${formatSize(stat.size)} ${formatDate(stat.mtimeMs)} ${rawP}\n`;
          } else {
            stdout += `${rawP}\n`;
          }
          continue;
        }

        listDir(rawP, absP, paths.length > 1 || recursive);
      }

      return { code: exitCode, stdout, stderr };
    },

    async stat(args, ctx) {
      if (args.length === 0) {
        return { code: 1, stdout: '', stderr: 'stat: missing operand\n' };
      }
      let stdout = '';
      let stderr = '';
      let code = 0;

      for (const arg of args) {
        const abs = ctx.resolvePath(arg);
        if (!ctx.vfs.existsSync(abs)) {
          stderr += `stat: cannot stat '${arg}': No such file or directory\n`;
          code = 1;
          continue;
        }
        const st = ctx.vfs.statSync(abs);
        const isDir = st.isDirectory();
        const d = new Date(st.mtimeMs || Date.now());
        stdout += `  File: ${arg}\n`;
        stdout += `  Size: ${st.size}\tBlocks: ${Math.ceil(st.size / 512)}\tIO Block: 4096\t${isDir ? 'directory' : 'regular file'}\n`;
        stdout += `Device: 1h/1d\tInode: 100\tLinks: 1\n`;
        stdout += `Access: (${isDir ? '0755/drwxr-xr-x' : '0644/-rw-r--r--'})\tUid: (1000/${ctx.env.USER || 'codelab'})\tGid: (1000/${ctx.env.USER || 'codelab'})\n`;
        stdout += `Access: ${d.toISOString()}\n`;
        stdout += `Modify: ${d.toISOString()}\n`;
        stdout += `Change: ${d.toISOString()}\n`;
        stdout += ` Birth: ${d.toISOString()}\n`;
      }
      return { code, stdout, stderr };
    },

    // -----------------------------------------------------------------------
    // Content Display: cat, head, tail, echo, printf
    // -----------------------------------------------------------------------
    async cat(args, ctx) {
      let numberLines = false;
      let numberNonBlank = false;
      let squeezeBlank = false;
      const files = [];

      for (const arg of args) {
        if (arg === '-n') numberLines = true;
        else if (arg === '-b') numberNonBlank = true;
        else if (arg === '-s') squeezeBlank = true;
        else files.push(arg);
      }

      let rawContent = '';
      let code = 0;
      let stderr = '';

      if (files.length === 0 || (files.length === 1 && files[0] === '-')) {
        rawContent = ctx.stdin || '';
      } else {
        for (const file of files) {
          if (file === '-') {
            rawContent += ctx.stdin || '';
            continue;
          }
          const abs = ctx.resolvePath(file);
          if (!ctx.vfs.existsSync(abs)) {
            stderr += `cat: ${file}: No such file or directory\n`;
            code = 1;
            continue;
          }
          try {
            rawContent += ctx.vfs.readFileSync(abs, 'utf8');
          } catch (err) {
            stderr += `cat: ${file}: ${err.message}\n`;
            code = 1;
          }
        }
      }

      if (!numberLines && !numberNonBlank && !squeezeBlank) {
        return { code, stdout: rawContent, stderr };
      }

      const lines = rawContent.split('\n');
      let outLines = [];
      let lineNum = 1;
      let prevWasBlank = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isBlank = line.trim() === '';
        if (squeezeBlank && isBlank && prevWasBlank) continue;
        prevWasBlank = isBlank;

        if (numberNonBlank) {
          if (!isBlank) {
            outLines.push(`${String(lineNum++).padStart(6, ' ')}\t${line}`);
          } else {
            outLines.push(line);
          }
        } else if (numberLines) {
          outLines.push(`${String(lineNum++).padStart(6, ' ')}\t${line}`);
        } else {
          outLines.push(line);
        }
      }

      return { code, stdout: outLines.join('\n'), stderr };
    },

    async head(args, ctx) {
      let numLines = 10;
      const files = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-n' && i + 1 < args.length) {
          const parsed = parseInt(args[++i], 10);
          numLines = isNaN(parsed) ? 10 : parsed;
        } else if (/^-\d+$/.test(a)) {
          const parsed = parseInt(a.slice(1), 10);
          numLines = isNaN(parsed) ? 10 : parsed;
        } else {
          files.push(a);
        }
      }

      function processText(text) {
        if (numLines <= 0) return '';
        const lines = text.split('\n');
        return lines.slice(0, numLines).join('\n') + (lines.length > 0 ? '\n' : '');
      }

      if (files.length === 0) {
        return { code: 0, stdout: processText(ctx.stdin || ''), stderr: '' };
      }

      let stdout = '';
      let stderr = '';
      let code = 0;

      for (const f of files) {
        const abs = ctx.resolvePath(f);
        if (!ctx.vfs.existsSync(abs)) {
          stderr += `head: cannot open '${f}' for reading: No such file or directory\n`;
          code = 1;
          continue;
        }
        if (ctx.vfs.statSync && ctx.vfs.statSync(abs).isDirectory()) {
          stderr += `head: error reading '${f}': Is a directory\n`;
          code = 1;
          continue;
        }
        try {
          const text = ctx.vfs.readFileSync(abs, 'utf8');
          stdout += processText(text);
        } catch (err) {
          stderr += `head: ${err.message}\n`;
          code = 1;
        }
      }

      return { code, stdout, stderr };
    },

    async tail(args, ctx) {
      let numLines = 10;
      const files = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-n' && i + 1 < args.length) {
          const parsed = parseInt(args[++i], 10);
          numLines = isNaN(parsed) ? 10 : parsed;
        } else if (/^-\d+$/.test(a)) {
          const parsed = parseInt(a.slice(1), 10);
          numLines = isNaN(parsed) ? 10 : parsed;
        } else {
          files.push(a);
        }
      }

      function processText(text) {
        if (numLines <= 0) return '';
        const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
        const slice = lines.slice(Math.max(0, lines.length - numLines));
        return slice.join('\n') + '\n';
      }

      if (files.length === 0) {
        return { code: 0, stdout: processText(ctx.stdin || ''), stderr: '' };
      }

      let stdout = '';
      let stderr = '';
      let code = 0;

      for (const f of files) {
        const abs = ctx.resolvePath(f);
        if (!ctx.vfs.existsSync(abs)) {
          stderr += `tail: cannot open '${f}' for reading: No such file or directory\n`;
          code = 1;
          continue;
        }
        if (ctx.vfs.statSync && ctx.vfs.statSync(abs).isDirectory()) {
          stderr += `tail: error reading '${f}': Is a directory\n`;
          code = 1;
          continue;
        }
        try {
          const text = ctx.vfs.readFileSync(abs, 'utf8');
          stdout += processText(text);
        } catch (err) {
          stderr += `tail: ${err.message}\n`;
          code = 1;
        }
      }

      return { code, stdout, stderr };
    },

    async echo(args, ctx) {
      let omitNewline = false;
      let interpretEscapes = false;
      let startIdx = 0;

      while (startIdx < args.length && args[startIdx].startsWith('-')) {
        const flag = args[startIdx];
        if (flag === '-n') omitNewline = true;
        else if (flag === '-e') interpretEscapes = true;
        else if (flag === '-ne' || flag === '-en') { omitNewline = true; interpretEscapes = true; }
        else break;
        startIdx++;
      }

      let out = args.slice(startIdx).join(' ');
      if (interpretEscapes) {
        out = out
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r')
          .replace(/\\b/g, '\b')
          .replace(/\\f/g, '\f')
          .replace(/\\\\/g, '\\');
      }

      return { code: 0, stdout: out + (omitNewline ? '' : '\n'), stderr: '' };
    },

    async printf(args, ctx) {
      if (args.length === 0) return { code: 0, stdout: '', stderr: '' };
      let fmt = args[0]
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\');

      let argIdx = 1;
      const formatted = fmt.replace(/%([-+0 #]*)(\d+)?(?:\.(\d+))?([sdifxX%])/g, (match, flags, width, prec, type) => {
        if (type === '%') return '%';
        const val = args[argIdx++];
        if (val === undefined) return '';
        let s = '';
        if (type === 's') {
          s = String(val);
          if (prec !== undefined && prec !== '') s = s.slice(0, parseInt(prec, 10));
        } else if (type === 'd' || type === 'i') {
          s = String(parseInt(val, 10) || 0);
        } else if (type === 'f') {
          const num = parseFloat(val) || 0;
          s = prec !== undefined && prec !== '' ? num.toFixed(parseInt(prec, 10)) : String(num);
        } else if (type === 'x') {
          s = (Number(val) || 0).toString(16);
        } else if (type === 'X') {
          s = (Number(val) || 0).toString(16).toUpperCase();
        } else {
          return match;
        }

        if (width) {
          const w = parseInt(width, 10);
          if (flags && flags.includes('0') && (type === 'd' || type === 'i')) {
            const isNeg = s.startsWith('-');
            if (isNeg) s = s.slice(1);
            s = s.padStart(w - (isNeg ? 1 : 0), '0');
            if (isNeg) s = '-' + s;
          } else if (flags && flags.includes('-')) {
            s = s.padEnd(w, ' ');
          } else {
            s = s.padStart(w, ' ');
          }
        }
        return s;
      });

      return { code: 0, stdout: formatted, stderr: '' };
    },

    // -----------------------------------------------------------------------
    // Search & Matching: grep, find
    // -----------------------------------------------------------------------
    async grep(args, ctx) {
      let ignoreCase = false;
      let invertMatch = false;
      let lineNumbers = false;
      let countOnly = false;
      let filesOnly = false;
      let recursive = false;
      let extendedRegex = false;
      let pattern = null;
      const fileArgs = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('-') && arg.length > 1) {
          for (let j = 1; j < arg.length; j++) {
            const flag = arg[j];
            if (flag === 'i') ignoreCase = true;
            else if (flag === 'v') invertMatch = true;
            else if (flag === 'n') lineNumbers = true;
            else if (flag === 'c') countOnly = true;
            else if (flag === 'l') filesOnly = true;
            else if (flag === 'r' || flag === 'R') recursive = true;
            else if (flag === 'E') extendedRegex = true;
          }
        } else if (pattern === null) {
          pattern = arg;
        } else {
          fileArgs.push(arg);
        }
      }

      if (!pattern) {
        return { code: 2, stdout: '', stderr: 'grep: missing pattern\n' };
      }

      let regex;
      try {
        regex = new RegExp(pattern, ignoreCase ? 'i' : '');
      } catch (e) {
        return { code: 2, stdout: '', stderr: `grep: invalid pattern: ${e.message}\n` };
      }

      // Collect target files
      const targets = [];
      if (recursive) {
        const roots = fileArgs.length > 0 ? fileArgs : ['.'];
        for (const root of roots) {
          const absRoot = ctx.resolvePath(root);
          function walk(dir) {
            try {
              const entries = ctx.vfs.readdirSync(dir);
              for (const e of entries) {
                const full = dir === '/' ? '/' + e : dir + '/' + e;
                const st = ctx.vfs.statSync(full);
                if (st.isDirectory()) walk(full);
                else targets.push(full);
              }
            } catch (_) {}
          }
          if (ctx.vfs.existsSync(absRoot)) {
            const st = ctx.vfs.statSync(absRoot);
            if (st.isDirectory()) walk(absRoot);
            else targets.push(absRoot);
          }
        }
      } else {
        for (const f of fileArgs) {
          targets.push(ctx.resolvePath(f));
        }
      }

      let stdout = '';
      let stderr = '';
      let totalMatches = 0;
      let hasFileError = false;

      function checkText(text, label) {
        const lines = text.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
        let fileMatchCount = 0;
        let fileOutput = '';

        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const line = lines[lIdx];
          const matched = regex.test(line);
          const shouldInclude = invertMatch ? !matched : matched;

          if (shouldInclude) {
            fileMatchCount++;
            totalMatches++;
            if (filesOnly) {
              stdout += `${label}\n`;
              return;
            }
            if (!countOnly) {
              const prefix = label ? `${label}:` : '';
              const numPrefix = lineNumbers ? `${lIdx + 1}:` : '';
              fileOutput += `${prefix}${numPrefix}${line}\n`;
            }
          }
        }

        if (countOnly) {
          const prefix = label ? `${label}:` : '';
          stdout += `${prefix}${fileMatchCount}\n`;
        } else {
          stdout += fileOutput;
        }
      }

      if (targets.length === 0) {
        checkText(ctx.stdin || '', '');
      } else {
        const multiple = targets.length > 1;
        for (const t of targets) {
          if (!ctx.vfs.existsSync(t)) {
            stderr += `grep: ${t}: No such file or directory\n`;
            hasFileError = true;
            continue;
          }
          try {
            const content = ctx.vfs.readFileSync(t, 'utf8');
            const displayLabel = multiple ? PosixPath.normalize(t.replace('/workspace/', '')) : '';
            checkText(content, displayLabel);
          } catch (e) {
            stderr += `grep: ${t}: ${e.message}\n`;
            hasFileError = true;
          }
        }
      }

      let exitCode = 1;
      if (totalMatches > 0) exitCode = 0;
      else if (hasFileError) exitCode = 2;

      return { code: exitCode, stdout, stderr };
    },

    async find(args, ctx) {
      let root = '.';
      let namePattern = null;
      let typeFilter = null; // 'f' or 'd'
      let maxDepth = Infinity;

      let i = 0;
      if (args[0] && !args[0].startsWith('-')) {
        root = args[0];
        i = 1;
      }

      while (i < args.length) {
        const opt = args[i];
        if (opt === '-name' && i + 1 < args.length) {
          namePattern = args[++i];
        } else if (opt === '-type' && i + 1 < args.length) {
          typeFilter = args[++i];
        } else if (opt === '-maxdepth' && i + 1 < args.length) {
          const parsedDepth = parseInt(args[++i], 10);
          maxDepth = isNaN(parsedDepth) ? Infinity : parsedDepth;
        }
        i++;
      }

      const nameRegex = namePattern ? globToRegExp(namePattern, false) : null;
      const absRoot = ctx.resolvePath(root);
      const results = [];

      function walk(dirPath, depth) {
        if (depth > maxDepth) return;
        let entries = [];
        try {
          entries = ctx.vfs.readdirSync(dirPath);
        } catch (_) {
          return;
        }

        for (const entry of entries) {
          const full = dirPath === '/' ? '/' + entry : dirPath + '/' + entry;
          let isDir = false;
          try {
            isDir = ctx.vfs.statSync(full).isDirectory();
          } catch (_) {}

          const relPath = root === '.'
            ? './' + full.replace(absRoot.endsWith('/') ? absRoot : absRoot + '/', '')
            : full;

          let matches = true;
          if (typeFilter === 'f' && isDir) matches = false;
          if (typeFilter === 'd' && !isDir) matches = false;
          if (nameRegex && !nameRegex.test(entry)) matches = false;

          if (matches) results.push(relPath);
          if (isDir) walk(full, depth + 1);
        }
      }

      // Root itself check
      if (ctx.vfs.existsSync(absRoot)) {
        let isDir = false;
        try { isDir = ctx.vfs.statSync(absRoot).isDirectory(); } catch (_) {}
        if (!typeFilter || (typeFilter === 'd' && isDir) || (typeFilter === 'f' && !isDir)) {
          if (!nameRegex || nameRegex.test(PosixPath.basename(root))) {
            results.push(root);
          }
        }
        if (isDir) walk(absRoot, 1);
      } else {
        return { code: 1, stdout: '', stderr: `find: '${root}': No such file or directory\n` };
      }

      results.sort();
      return { code: 0, stdout: results.join('\n') + (results.length > 0 ? '\n' : ''), stderr: '' };
    },

    // -----------------------------------------------------------------------
    // Text Manipulation: wc, sort, uniq, sed, awk, cut, tr, diff
    // -----------------------------------------------------------------------
    async wc(args, ctx) {
      let countLines = false;
      let countWords = false;
      let countBytes = false;
      const files = [];

      for (const arg of args) {
        if (arg === '-l') countLines = true;
        else if (arg === '-w') countWords = true;
        else if (arg === '-c' || arg === '-m') countBytes = true;
        else files.push(arg);
      }

      if (!countLines && !countWords && !countBytes) {
        countLines = true;
        countWords = true;
        countBytes = true;
      }

      function countText(text) {
        const lines = text.length === 0 ? 0 : (text.match(/\n/g) || []).length;
        const words = (text.trim().match(/\S+/g) || []).length;
        const bytes = typeof Buffer !== 'undefined'
          ? Buffer.byteLength(text, 'utf8')
          : (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length);
        return { lines, words, bytes };
      }

      function formatCounts(c, label) {
        let parts = [];
        if (countLines) parts.push(String(c.lines).padStart(4, ' '));
        if (countWords) parts.push(String(c.words).padStart(4, ' '));
        if (countBytes) parts.push(String(c.bytes).padStart(4, ' '));
        if (label) parts.push(label);
        return parts.join(' ') + '\n';
      }

      if (files.length === 0) {
        const c = countText(ctx.stdin || '');
        return { code: 0, stdout: formatCounts(c, ''), stderr: '' };
      }

      let stdout = '';
      let stderr = '';
      let code = 0;
      let total = { lines: 0, words: 0, bytes: 0 };

      for (const f of files) {
        const abs = ctx.resolvePath(f);
        if (!ctx.vfs.existsSync(abs)) {
          stderr += `wc: ${f}: No such file or directory\n`;
          code = 1;
          continue;
        }
        try {
          const st = ctx.vfs.statSync(abs);
          if (st.isDirectory()) {
            stderr += `wc: ${f}: Is a directory\n`;
            code = 1;
            continue;
          }
          const content = ctx.vfs.readFileSync(abs, 'utf8');
          const c = countText(content);
          total.lines += c.lines;
          total.words += c.words;
          total.bytes += c.bytes;
          stdout += formatCounts(c, f);
        } catch (e) {
          stderr += `wc: ${f}: ${e.message}\n`;
          code = 1;
        }
      }

      if (files.length > 1) {
        stdout += formatCounts(total, 'total');
      }

      return { code, stdout, stderr };
    },

    async sort(args, ctx) {
      let reverse = false;
      let numeric = false;
      let unique = false;
      let ignoreCase = false;
      let keyCol = null;
      let delim = null;
      const files = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-k' && i + 1 < args.length) {
          keyCol = parseInt(args[++i], 10) - 1;
        } else if (a === '-t' && i + 1 < args.length) {
          delim = args[++i];
        } else if (a.startsWith('-') && a.length > 1 && !a.startsWith('--')) {
          for (let j = 1; j < a.length; j++) {
            const ch = a[j];
            if (ch === 'r') reverse = true;
            else if (ch === 'n') numeric = true;
            else if (ch === 'u') unique = true;
            else if (ch === 'f') ignoreCase = true;
            else {
              files.push(a);
              break;
            }
          }
        } else {
          files.push(a);
        }
      }

      let text = '';
      if (files.length === 0) {
        text = ctx.stdin || '';
      } else {
        for (const f of files) {
          const abs = ctx.resolvePath(f);
          if (!ctx.vfs.existsSync(abs)) {
            return { code: 1, stdout: '', stderr: `sort: cannot read '${f}': No such file or directory\n` };
          }
          try {
            const st = ctx.vfs.statSync(abs);
            if (st.isDirectory()) {
              return { code: 1, stdout: '', stderr: `sort: read failed: ${f}: Is a directory\n` };
            }
            text += ctx.vfs.readFileSync(abs, 'utf8');
          } catch (err) {
            return { code: 1, stdout: '', stderr: `sort: cannot read '${f}': ${err.message}\n` };
          }
        }
      }

      let lines = text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

      lines.sort((a, b) => {
        let valA = a;
        let valB = b;
        if (keyCol !== null) {
          const partsA = delim ? a.split(delim) : a.trim().split(/\s+/);
          const partsB = delim ? b.split(delim) : b.trim().split(/\s+/);
          valA = partsA[keyCol] || '';
          valB = partsB[keyCol] || '';
        }
        if (numeric) {
          const numA = parseFloat(valA) || 0;
          const numB = parseFloat(valB) || 0;
          return numA - numB;
        }
        if (ignoreCase) {
          return valA.toLowerCase().localeCompare(valB.toLowerCase());
        }
        return valA.localeCompare(valB);
      });

      if (reverse) lines.reverse();
      if (unique) {
        lines = Array.from(new Set(lines));
      }

      return { code: 0, stdout: lines.join('\n') + (lines.length > 0 ? '\n' : ''), stderr: '' };
    },

    async uniq(args, ctx) {
      let count = false;
      let duplicatesOnly = false;
      let uniqueOnly = false;
      let ignoreCase = false;
      const files = [];

      for (const a of args) {
        if (a.startsWith('-') && a.length > 1 && !a.startsWith('--')) {
          for (let j = 1; j < a.length; j++) {
            const ch = a[j];
            if (ch === 'c') count = true;
            else if (ch === 'd') duplicatesOnly = true;
            else if (ch === 'u') uniqueOnly = true;
            else if (ch === 'i') ignoreCase = true;
            else {
              files.push(a);
              break;
            }
          }
        } else {
          files.push(a);
        }
      }

      let text = ctx.stdin || '';
      if (files.length > 0) {
        const abs = ctx.resolvePath(files[0]);
        if (!ctx.vfs.existsSync(abs)) {
          return { code: 1, stdout: '', stderr: `uniq: ${files[0]}: No such file or directory\n` };
        }
        try {
          const st = ctx.vfs.statSync(abs);
          if (st.isDirectory()) {
            return { code: 1, stdout: '', stderr: `uniq: error reading '${files[0]}': Is a directory\n` };
          }
          text = ctx.vfs.readFileSync(abs, 'utf8');
        } catch (err) {
          return { code: 1, stdout: '', stderr: `uniq: error reading '${files[0]}': ${err.message}\n` };
        }
      }

      const lines = text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

      const grouped = [];
      let currentLine = null;
      let currentCount = 0;

      for (const l of lines) {
        const cmp = ignoreCase ? l.toLowerCase() : l;
        const curCmp = ignoreCase && currentLine !== null ? currentLine.toLowerCase() : currentLine;
        if (cmp === curCmp) {
          currentCount++;
        } else {
          if (currentLine !== null) grouped.push({ line: currentLine, count: currentCount });
          currentLine = l;
          currentCount = 1;
        }
      }
      if (currentLine !== null) grouped.push({ line: currentLine, count: currentCount });

      let stdout = '';
      for (const g of grouped) {
        if (duplicatesOnly && g.count === 1) continue;
        if (uniqueOnly && g.count > 1) continue;
        if (count) {
          stdout += `${String(g.count).padStart(4, ' ')} ${g.line}\n`;
        } else {
          stdout += `${g.line}\n`;
        }
      }

      return { code: 0, stdout, stderr: '' };
    },

    async sed(args, ctx) {
      let inPlace = false;
      let script = null;
      const files = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-i') {
          inPlace = true;
        } else if (a === '-e' && i + 1 < args.length) {
          script = args[++i];
        } else if (!script) {
          script = a;
        } else {
          files.push(a);
        }
      }

      if (!script) {
        return { code: 1, stdout: '', stderr: 'sed: missing expression\n' };
      }

      function splitWithEscape(str, d) {
        const parts = [];
        let cur = '';
        let esc = false;
        for (let idx = 0; idx < str.length; idx++) {
          const ch = str[idx];
          if (esc) {
            if (ch === d) {
              cur += d;
            } else {
              cur += '\\' + ch;
            }
            esc = false;
          } else if (ch === '\\') {
            esc = true;
          } else if (ch === d) {
            parts.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
        parts.push(cur);
        return parts;
      }

      function applyScript(content) {
        // Substitute command: s/find/replace/flags (supports custom delimiters like s|foo|bar|g)
        if (script.startsWith('s')) {
          const delim = script[1];
          const parts = splitWithEscape(script.slice(2), delim);
          if (parts.length >= 2) {
            const find = parts[0];
            const repl = parts[1];
            const flags = parts[2] || '';
            const regex = new RegExp(find, flags.includes('g') ? 'g' : '');
            return content.split('\n').map(line => line.replace(regex, repl)).join('\n');
          }
        }
        // Delete command: /pattern/d or 1d
        if (script.endsWith('d')) {
          const addr = script.slice(0, -1);
          if (/^\d+$/.test(addr)) {
            const targetLine = parseInt(addr, 10);
            return content.split('\n').filter((_, idx) => idx + 1 !== targetLine).join('\n');
          }
          if (addr.startsWith('/') && addr.endsWith('/')) {
            const pattern = addr.slice(1, -1);
            const regex = new RegExp(pattern);
            return content.split('\n').filter(line => !regex.test(line)).join('\n');
          }
        }
        return content;
      }

      if (files.length === 0) {
        try {
          return { code: 0, stdout: applyScript(ctx.stdin || ''), stderr: '' };
        } catch (err) {
          return { code: 1, stdout: '', stderr: `sed: ${err.message}\n` };
        }
      }

      let stdout = '';
      let stderr = '';
      let code = 0;

      for (const f of files) {
        const abs = ctx.resolvePath(f);
        if (!ctx.vfs.existsSync(abs)) {
          stderr += `sed: can't read ${f}: No such file or directory\n`;
          code = 1;
          continue;
        }
        try {
          const st = ctx.vfs.statSync(abs);
          if (st.isDirectory()) {
            stderr += `sed: couldn't edit ${f}: is a directory\n`;
            code = 1;
            continue;
          }
          const text = ctx.vfs.readFileSync(abs, 'utf8');
          const modified = applyScript(text);
          if (inPlace) {
            ctx.vfs.writeFileSync(abs, modified);
            ctx.emitMutation('change', abs);
          } else {
            stdout += modified;
          }
        } catch (err) {
          stderr += `sed: ${err.message}\n`;
          code = 1;
        }
      }

      return { code, stdout, stderr };
    },

    async awk(args, ctx) {
      let delim = null;
      let script = null;
      const files = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-F' && i + 1 < args.length) {
          delim = args[++i];
        } else if (a.startsWith('-F') && a.length > 2) {
          delim = a.slice(2);
        } else if (!script) {
          script = a;
        } else {
          files.push(a);
        }
      }

      if (!script) return { code: 1, stdout: '', stderr: 'awk: missing script\n' };

      let text = ctx.stdin || '';
      if (files.length > 0) {
        text = '';
        for (const f of files) {
          const abs = ctx.resolvePath(f);
          if (!ctx.vfs.existsSync(abs)) {
            return { code: 1, stdout: '', stderr: `awk: cannot open ${f} (No such file or directory)\n` };
          }
          try {
            const st = ctx.vfs.statSync(abs);
            if (st.isDirectory()) {
              return { code: 1, stdout: '', stderr: `awk: ${f}: Is a directory\n` };
            }
            text += ctx.vfs.readFileSync(abs, 'utf8');
          } catch (err) {
            return { code: 1, stdout: '', stderr: `awk: ${f}: ${err.message}\n` };
          }
        }
      }

      const lines = text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

      let stdout = '';
      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const line = lines[lIdx];
        const cols = delim ? (delim.length === 1 ? line.split(delim) : line.split(new RegExp(delim))) : line.trim().split(/\s+/);
        const NR = lIdx + 1;
        const NF = cols.length;

        // Basic {print $1, $2, ...} parser
        const printMatch = script.match(/print\s+(.+)}/);
        if (printMatch) {
          const exprs = printMatch[1].split(',').map(s => s.trim());
          const vals = exprs.map(e => {
            if (e === '$0') return line;
            if (e === '$NF') return cols[cols.length - 1] || '';
            if (e.startsWith('$')) {
              const colIdx = parseInt(e.slice(1), 10) - 1;
              return cols[colIdx] || '';
            }
            if (e === 'NR') return String(NR);
            if (e === 'NF') return String(NF);
            if (e.startsWith('"') && e.endsWith('"')) return e.slice(1, -1);
            return e;
          });
          stdout += vals.join(' ') + '\n';
        } else {
          stdout += line + '\n';
        }
      }

      return { code: 0, stdout, stderr: '' };
    },

    async cut(args, ctx) {
      let delim = '\t';
      let fields = null;
      let chars = null;
      const files = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-d' && i + 1 < args.length) {
          delim = args[++i];
        } else if (a.startsWith('-d')) {
          delim = a.slice(2);
        } else if (a === '-f' && i + 1 < args.length) {
          fields = args[++i];
        } else if (a.startsWith('-f')) {
          fields = a.slice(2);
        } else if (a === '-c' && i + 1 < args.length) {
          chars = args[++i];
        } else if (a.startsWith('-c')) {
          chars = a.slice(2);
        } else {
          files.push(a);
        }
      }

      function parseRanges(spec) {
        return spec.split(',').map(part => {
          if (part.includes('-')) {
            const [sStr, eStr] = part.split('-');
            const start = sStr ? Math.max(1, parseInt(sStr, 10)) - 1 : 0;
            const end = eStr ? parseInt(eStr, 10) : Infinity;
            return { start, end };
          }
          const idx = Math.max(1, parseInt(part, 10)) - 1;
          return { start: idx, end: idx + 1 };
        });
      }

      let text = ctx.stdin || '';
      if (files.length > 0) {
        text = '';
        for (const f of files) {
          const abs = ctx.resolvePath(f);
          if (!ctx.vfs.existsSync(abs)) {
            return { code: 1, stdout: '', stderr: `cut: ${f}: No such file or directory\n` };
          }
          try {
            const st = ctx.vfs.statSync(abs);
            if (st.isDirectory()) {
              return { code: 1, stdout: '', stderr: `cut: ${f}: Is a directory\n` };
            }
            text += ctx.vfs.readFileSync(abs, 'utf8');
          } catch (e) {
            return { code: 1, stdout: '', stderr: `cut: ${f}: ${e.message}\n` };
          }
        }
      }

      const lines = text.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

      if (chars) {
        const ranges = parseRanges(chars);
        const out = lines.map(line => {
          let res = '';
          for (const r of ranges) {
            res += line.slice(r.start, r.end === Infinity ? undefined : r.end);
          }
          return res;
        });
        return { code: 0, stdout: out.join('\n') + (out.length > 0 ? '\n' : ''), stderr: '' };
      }

      const fieldRanges = fields ? parseRanges(fields) : [];
      const out = lines.map(line => {
        if (fieldRanges.length === 0) return line;
        const parts = line.split(delim);
        const chosen = [];
        for (const r of fieldRanges) {
          const endIdx = Math.min(parts.length, r.end);
          for (let c = r.start; c < endIdx; c++) {
            chosen.push(parts[c] !== undefined ? parts[c] : '');
          }
        }
        return chosen.join(delim);
      });

      return { code: 0, stdout: out.join('\n') + (out.length > 0 ? '\n' : ''), stderr: '' };
    },

    async tr(args, ctx) {
      let deleteMode = false;
      let squeezeMode = false;
      let set1 = '';
      let set2 = '';

      for (const a of args) {
        if (a === '-d') deleteMode = true;
        else if (a === '-s') squeezeMode = true;
        else if (a === '-ds' || a === '-sd') { deleteMode = true; squeezeMode = true; }
        else if (!set1) set1 = a;
        else if (!set2) set2 = a;
      }

      function expandSet(s) {
        if (!s) return '';
        if (s === '[:lower:]') return 'abcdefghijklmnopqrstuvwxyz';
        if (s === '[:upper:]') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (s === '[:digit:]') return '0123456789';
        if (s === '[:space:]') return ' \t\n\r\f\v';
        let res = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
        res = res.replace(/(.)-(.)/g, (_, start, end) => {
          const c1 = start.charCodeAt(0);
          const c2 = end.charCodeAt(0);
          if (c1 > c2) return start + '-' + end;
          let r = '';
          for (let c = c1; c <= c2; c++) r += String.fromCharCode(c);
          return r;
        });
        return res;
      }

      const fromChars = expandSet(set1);
      const toChars = expandSet(set2);
      const squeezeChars = squeezeMode ? (toChars || fromChars) : '';
      const text = ctx.stdin || '';
      let out = '';
      let lastOutChar = '';

      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const idx = fromChars.indexOf(c);
        let mapped = c;
        if (idx !== -1) {
          if (deleteMode) continue;
          if (toChars.length > 0) {
            mapped = toChars[idx] || toChars[toChars.length - 1];
          }
        }
        if (squeezeMode && squeezeChars.includes(mapped) && mapped === lastOutChar) {
          continue;
        }
        out += mapped;
        lastOutChar = mapped;
      }

      return { code: 0, stdout: out, stderr: '' };
    },

    async diff(args, ctx) {
      let unified = false;
      const files = [];

      for (const a of args) {
        if (a === '-u') unified = true;
        else files.push(a);
      }

      if (files.length < 2) {
        return { code: 2, stdout: '', stderr: 'diff: missing operand\n' };
      }

      const abs1 = ctx.resolvePath(files[0]);
      const abs2 = ctx.resolvePath(files[1]);

      if (!ctx.vfs.existsSync(abs1)) return { code: 2, stdout: '', stderr: `diff: ${files[0]}: No such file or directory\n` };
      if (!ctx.vfs.existsSync(abs2)) return { code: 2, stdout: '', stderr: `diff: ${files[1]}: No such file or directory\n` };

      const st1 = ctx.vfs.statSync(abs1);
      if (st1.isDirectory()) return { code: 2, stdout: '', stderr: `diff: ${files[0]}: Is a directory\n` };
      const st2 = ctx.vfs.statSync(abs2);
      if (st2.isDirectory()) return { code: 2, stdout: '', stderr: `diff: ${files[1]}: Is a directory\n` };

      const text1 = ctx.vfs.readFileSync(abs1, 'utf8');
      const text2 = ctx.vfs.readFileSync(abs2, 'utf8');

      if (text1 === text2) {
        return { code: 0, stdout: '', stderr: '' };
      }

      const diffResult = computeUnifiedDiff(files[0], files[1], text1, text2);
      return { code: 1, stdout: diffResult, stderr: '' };
    },

    // -----------------------------------------------------------------------
    // File & Directory Operations: cp, mv, rm, mkdir, touch, chmod, tree
    // -----------------------------------------------------------------------
    async mkdir(args, ctx) {
      let recursive = false;
      const dirs = [];

      for (const a of args) {
        if (a === '-p') recursive = true;
        else dirs.push(a);
      }

      if (dirs.length === 0) {
        return { code: 1, stdout: '', stderr: 'mkdir: missing operand\n' };
      }

      let code = 0;
      let stderr = '';

      for (const d of dirs) {
        const abs = ctx.resolvePath(d);
        try {
          if (recursive) {
            const parts = abs.split('/').filter(Boolean);
            let cur = '';
            for (const part of parts) {
              cur += '/' + part;
              if (!ctx.vfs.existsSync(cur)) {
                ctx.vfs.mkdirSync(cur, { recursive: true });
                ctx.emitMutation('create', cur);
              }
            }
          } else {
            ctx.vfs.mkdirSync(abs, { recursive });
            ctx.emitMutation('create', abs);
          }
        } catch (err) {
          stderr += `mkdir: cannot create directory '${d}': ${err.message}\n`;
          code = 1;
        }
      }

      return { code, stdout: '', stderr };
    },

    async touch(args, ctx) {
      if (args.length === 0) {
        return { code: 1, stdout: '', stderr: 'touch: missing file operand\n' };
      }

      let code = 0;
      let stderr = '';

      for (const f of args) {
        if (f.startsWith('-')) continue;
        const abs = ctx.resolvePath(f);
        try {
          if (!ctx.vfs.existsSync(abs)) {
            ctx.vfs.writeFileSync(abs, '');
            ctx.emitMutation('create', abs);
          } else {
            // update timestamp if exists
            const prev = ctx.vfs.readFileSync(abs, 'utf8');
            ctx.vfs.writeFileSync(abs, prev);
            ctx.emitMutation('change', abs);
          }
        } catch (err) {
          stderr += `touch: cannot touch '${f}': ${err.message}\n`;
          code = 1;
        }
      }

      return { code, stdout: '', stderr };
    },

    async rm(args, ctx) {
      let recursive = false;
      let force = false;
      const targets = [];

      for (const a of args) {
        if (a === '-r' || a === '-R' || a === '-rf' || a === '-fr') recursive = true;
        if (a === '-f' || a === '-rf' || a === '-fr') force = true;
        if (!a.startsWith('-')) targets.push(a);
      }

      if (targets.length === 0) {
        if (force) return { code: 0, stdout: '', stderr: '' };
        return { code: 1, stdout: '', stderr: 'rm: missing operand\n' };
      }

      let code = 0;
      let stderr = '';

      for (const t of targets) {
        const abs = ctx.resolvePath(t);
        if (!ctx.vfs.existsSync(abs)) {
          if (!force) {
            stderr += `rm: cannot remove '${t}': No such file or directory\n`;
            code = 1;
          }
          continue;
        }

        const st = ctx.vfs.statSync(abs);
        if (st.isDirectory() && !recursive) {
          stderr += `rm: cannot remove '${t}': Is a directory\n`;
          code = 1;
          continue;
        }

        try {
          if (typeof ctx.vfs.rmSync === 'function') {
            ctx.vfs.rmSync(abs, { recursive, force });
          } else {
            if (st.isDirectory()) ctx.vfs.rmdirSync(abs, { recursive });
            else ctx.vfs.unlinkSync(abs);
          }
          ctx.emitMutation('delete', abs);
        } catch (err) {
          if (!force) {
            stderr += `rm: cannot remove '${t}': ${err.message}\n`;
            code = 1;
          }
        }
      }

      return { code, stdout: '', stderr };
    },

    async cp(args, ctx) {
      let recursive = false;
      const paths = [];

      for (const a of args) {
        if (a === '-r' || a === '-R') recursive = true;
        else if (!a.startsWith('-')) paths.push(a);
      }

      if (paths.length < 2) {
        return { code: 1, stdout: '', stderr: 'cp: missing destination file operand\n' };
      }

      const dest = ctx.resolvePath(paths[paths.length - 1]);
      const sources = paths.slice(0, -1);

      function copyRecursive(srcAbs, destAbs) {
        const st = ctx.vfs.statSync(srcAbs);
        if (st.isDirectory()) {
          ctx.vfs.mkdirSync(destAbs, { recursive: true });
          const entries = ctx.vfs.readdirSync(srcAbs);
          for (const e of entries) {
            copyRecursive(srcAbs + '/' + e, destAbs + '/' + e);
          }
        } else {
          if (typeof ctx.vfs.copyFileSync === 'function') {
            ctx.vfs.copyFileSync(srcAbs, destAbs);
          } else {
            const data = ctx.vfs.readFileSync(srcAbs);
            ctx.vfs.writeFileSync(destAbs, data);
          }
          ctx.emitMutation('create', destAbs);
        }
      }

      for (const src of sources) {
        const srcAbs = ctx.resolvePath(src);
        if (!ctx.vfs.existsSync(srcAbs)) {
          return { code: 1, stdout: '', stderr: `cp: cannot stat '${src}': No such file or directory\n` };
        }
        const st = ctx.vfs.statSync(srcAbs);
        if (st.isDirectory() && !recursive) {
          return { code: 1, stdout: '', stderr: `cp: -r not specified; omitting directory '${src}'\n` };
        }
        try {
          let targetDest = dest;
          if (ctx.vfs.existsSync(dest) && ctx.vfs.statSync(dest).isDirectory()) {
            targetDest = dest === '/' ? '/' + PosixPath.basename(srcAbs) : dest + '/' + PosixPath.basename(srcAbs);
          }
          copyRecursive(srcAbs, targetDest);
        } catch (e) {
          return { code: 1, stdout: '', stderr: `cp: ${e.message}\n` };
        }
      }

      return { code: 0, stdout: '', stderr: '' };
    },

    async mv(args, ctx) {
      const paths = args.filter(a => !a.startsWith('-'));
      if (paths.length < 2) {
        return { code: 1, stdout: '', stderr: 'mv: missing destination file operand\n' };
      }

      const src = ctx.resolvePath(paths[0]);
      let dest = ctx.resolvePath(paths[1]);

      if (!ctx.vfs.existsSync(src)) {
        return { code: 1, stdout: '', stderr: `mv: cannot stat '${paths[0]}': No such file or directory\n` };
      }

      try {
        if (ctx.vfs.existsSync(dest) && ctx.vfs.statSync(dest).isDirectory()) {
          dest = dest === '/' ? '/' + PosixPath.basename(src) : dest + '/' + PosixPath.basename(src);
        }
        if (typeof ctx.vfs.renameSync === 'function') {
          ctx.vfs.renameSync(src, dest);
        } else {
          const data = ctx.vfs.readFileSync(src);
          ctx.vfs.writeFileSync(dest, data);
          ctx.vfs.unlinkSync(src);
        }
        ctx.emitMutation('rename', dest);
      } catch (err) {
        return { code: 1, stdout: '', stderr: `mv: ${err.message}\n` };
      }

      return { code: 0, stdout: '', stderr: '' };
    },

    async chmod(args, ctx) {
      if (args.length < 2) {
        return { code: 1, stdout: '', stderr: 'chmod: missing operand\n' };
      }
      const modeStr = args[0];
      for (let i = 1; i < args.length; i++) {
        const target = args[i];
        const abs = ctx.resolvePath(target);
        if (!ctx.vfs.existsSync(abs)) {
          return { code: 1, stdout: '', stderr: `chmod: cannot access '${target}': No such file or directory\n` };
        }
        if (typeof ctx.vfs.chmodSync === 'function') {
          try {
            ctx.vfs.chmodSync(abs, modeStr);
          } catch (err) {
            return { code: 1, stdout: '', stderr: `chmod: ${err.message}\n` };
          }
        }
      }
      return { code: 0, stdout: '', stderr: '' };
    },

    async tree(args, ctx) {
      let showAll = false;
      let maxLevel = Infinity;
      let root = '.';

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-a') showAll = true;
        else if (a === '-L' && i + 1 < args.length) maxLevel = parseInt(args[++i], 10) || Infinity;
        else if (!a.startsWith('-')) root = a;
      }

      const absRoot = ctx.resolvePath(root);
      if (!ctx.vfs.existsSync(absRoot)) {
        return { code: 1, stdout: '', stderr: `tree: '${root}': No such file or directory\n` };
      }

      let stdout = `${root}\n`;
      let dirCount = 0;
      let fileCount = 0;

      function renderTree(dirPath, prefix, level) {
        if (level > maxLevel) return;
        let entries = [];
        try { entries = ctx.vfs.readdirSync(dirPath); } catch (_) { return; }
        if (!showAll) entries = entries.filter(e => !e.startsWith('.'));
        entries.sort();

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const isLast = i === entries.length - 1;
          const full = dirPath === '/' ? '/' + entry : dirPath + '/' + entry;
          let isDir = false;
          try { isDir = ctx.vfs.statSync(full).isDirectory(); } catch (_) {}

          stdout += `${prefix}${isLast ? '└── ' : '├── '}${entry}\n`;

          if (isDir) {
            dirCount++;
            renderTree(full, prefix + (isLast ? '    ' : '│   '), level + 1);
          } else {
            fileCount++;
          }
        }
      }

      renderTree(absRoot, '', 1);
      stdout += `\n${dirCount} directories, ${fileCount} files\n`;
      return { code: 0, stdout, stderr: '' };
    },

    // -----------------------------------------------------------------------
    // System, Environment & Process Control: env, export, unset, which,
    // whoami, uname, date, sleep, true, false, clear, history, ps, jobs, kill
    // -----------------------------------------------------------------------
    async env(args, ctx) {
      const keys = Object.keys(ctx.env).sort();
      let stdout = '';
      for (const k of keys) {
        if (k !== '?' && !k.startsWith('__')) {
          stdout += `${k}=${ctx.env[k]}\n`;
        }
      }
      return { code: 0, stdout, stderr: '' };
    },

    async export(args, ctx) {
      const targetEnv = ctx.shell ? ctx.shell.env : ctx.env;
      if (args.length === 0) {
        const keys = Object.keys(targetEnv).filter(k => k !== '?' && !k.startsWith('__')).sort();
        let stdout = '';
        for (const k of keys) {
          stdout += `declare -x ${k}="${targetEnv[k]}"\n`;
        }
        return { code: 0, stdout, stderr: '' };
      }

      for (const arg of args) {
        const eqIdx = arg.indexOf('=');
        if (eqIdx !== -1) {
          const key = arg.slice(0, eqIdx);
          const val = arg.slice(eqIdx + 1);
          ctx.env[key] = val;
          if (ctx.shell) ctx.shell.env[key] = val;
        } else {
          const existing = ctx.shell && ctx.shell.env[arg] !== undefined ? ctx.shell.env[arg] : (ctx.env[arg] || '');
          ctx.env[arg] = existing;
          if (ctx.shell) ctx.shell.env[arg] = existing;
        }
      }

      return { code: 0, stdout: '', stderr: '' };
    },

    async unset(args, ctx) {
      for (const arg of args) {
        delete ctx.env[arg];
        if (ctx.shell) delete ctx.shell.env[arg];
      }
      return { code: 0, stdout: '', stderr: '' };
    },

    async which(args, ctx) {
      if (args.length === 0) return { code: 1, stdout: '', stderr: '' };
      let stdout = '';
      let code = 0;

      for (const cmd of args) {
        if (COREUTILS[cmd]) {
          stdout += `/usr/bin/${cmd}\n`;
        } else {
          code = 1;
        }
      }

      return { code, stdout, stderr: '' };
    },

    async whoami(args, ctx) {
      return { code: 0, stdout: `${ctx.env.USER || 'codelab'}\n`, stderr: '' };
    },

    async uname(args, ctx) {
      const a = args.includes('-a');
      if (a) {
        return { code: 0, stdout: 'Linux code-lab 6.5.0-codelab #1 SMP PREEMPT x86_64 GNU/Linux\n', stderr: '' };
      }
      return { code: 0, stdout: 'Linux\n', stderr: '' };
    },

    async date(args, ctx) {
      const now = new Date();
      if (args.length > 0 && args[0].startsWith('+')) {
        const fmt = args[0].slice(1);
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = fmt
          .replace(/%Y/g, now.getFullYear())
          .replace(/%m/g, pad(now.getMonth() + 1))
          .replace(/%d/g, pad(now.getDate()))
          .replace(/%H/g, pad(now.getHours()))
          .replace(/%M/g, pad(now.getMinutes()))
          .replace(/%S/g, pad(now.getSeconds()))
          .replace(/%s/g, Math.floor(now.getTime() / 1000));
        return { code: 0, stdout: formatted + '\n', stderr: '' };
      }
      return { code: 0, stdout: now.toUTCString() + '\n', stderr: '' };
    },

    async sleep(args, ctx) {
      const sec = parseFloat(args[0]) || 0;
      const ms = Math.max(0, sec * 1000);
      if (ms <= 0) return { code: 0, stdout: '', stderr: '' };
      if (ctx && ctx.signal && ctx.signal.aborted) {
        return { code: 130, stdout: '', stderr: '' };
      }
      await new Promise((resolve) => {
        let timer = null;
        const onAbort = () => {
          if (timer) clearTimeout(timer);
          resolve();
        };
        if (ctx && ctx.signal) {
          ctx.signal.addEventListener('abort', onAbort, { once: true });
        }
        timer = setTimeout(() => {
          if (ctx && ctx.signal) {
            ctx.signal.removeEventListener('abort', onAbort);
          }
          resolve();
        }, ms);
      });
      if (ctx && ctx.signal && ctx.signal.aborted) {
        return { code: 130, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    },

    async '['(args, ctx) {
      const code = evaluatePosixTest(args, ctx);
      return { code, stdout: '', stderr: '' };
    },

    async test(args, ctx) {
      const code = evaluatePosixTest(args, ctx);
      return { code, stdout: '', stderr: '' };
    },

    async true() {
      return { code: 0, stdout: '', stderr: '' };
    },

    async false() {
      return { code: 1, stdout: '', stderr: '' };
    },

    async clear() {
      return { code: 0, stdout: '\x1b[2J\x1b[H', stderr: '' };
    },

    async history(args, ctx) {
      if (args[0] === '-c') {
        ctx.shell.history.length = 0;
        return { code: 0, stdout: '', stderr: '' };
      }
      let stdout = '';
      for (let i = 0; i < ctx.shell.history.length; i++) {
        stdout += `${String(i + 1).padStart(5, ' ')}  ${ctx.shell.history[i]}\n`;
      }
      return { code: 0, stdout, stderr: '' };
    },

    async ps(args, ctx) {
      let stdout = '  PID TTY          TIME CMD\n';
      stdout += '    1 ?        00:00:00 sh\n';
      for (const [jobId, job] of ctx.shell.jobs.entries()) {
        if (job.status === 'Running') {
          stdout += `${String(job.pid).padStart(5, ' ')} ?        00:00:00 ${job.command}\n`;
        }
      }
      return { code: 0, stdout, stderr: '' };
    },

    async jobs(args, ctx) {
      let stdout = '';
      for (const [id, job] of ctx.shell.jobs.entries()) {
        const cleanCmd = String(job.command || '').replace(/\s*&\s*$/, '');
        stdout += `[${id}]+  ${job.status}                       ${cleanCmd} &\n`;
      }
      return { code: 0, stdout, stderr: '' };
    },

    async kill(args, ctx) {
      if (args.length === 0) return { code: 1, stdout: '', stderr: 'kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...\n' };
      const target = args[args.length - 1];
      const pid = parseInt(target.replace('%', ''), 10);
      if (isNaN(pid)) {
        return { code: 1, stdout: '', stderr: `kill: ${target}: arguments must be process or job IDs\n` };
      }

      let killedJob = false;
      for (const [id, job] of ctx.shell.jobs.entries()) {
        if (job.pid === pid || id === pid) {
          job.status = 'Terminated';
          if (typeof job.abort === 'function') job.abort();
          killedJob = true;
          break;
        }
      }

      let killedPort = false;
      if (ctx.shell.portTable) {
        if (typeof ctx.shell.portTable.killProcess === 'function') {
          killedPort = ctx.shell.portTable.killProcess(pid) || killedPort;
        }
        if (typeof ctx.shell.portTable.unregisterByPid === 'function') {
          killedPort = ctx.shell.portTable.unregisterByPid(pid) || killedPort;
        }
        if (typeof ctx.shell.portTable.listServers === 'function' && typeof ctx.shell.portTable.unregisterServer === 'function') {
          for (const s of ctx.shell.portTable.listServers()) {
            if (s.pid !== undefined && String(s.pid) === String(pid)) {
              if (s.server && typeof s.server.close === 'function') {
                try { s.server.close(); } catch (_) {}
              }
              if (typeof s.stop === 'function') {
                try { s.stop(); } catch (_) {}
              }
              ctx.shell.portTable.unregisterServer(s.port);
              killedPort = true;
            }
          }
        }
      }

      if (killedJob || killedPort) {
        return { code: 0, stdout: '', stderr: '' };
      }

      return { code: 1, stdout: '', stderr: `kill: (${target}) - No such process\n` };
    },

    // -----------------------------------------------------------------------
    // Additional Utilities: dirname, basename, seq, tee
    // -----------------------------------------------------------------------
    async dirname(args) {
      const p = args[0] || '.';
      return { code: 0, stdout: PosixPath.dirname(p) + '\n', stderr: '' };
    },

    async basename(args) {
      const p = args[0] || '';
      const ext = args[1] || '';
      return { code: 0, stdout: PosixPath.basename(p, ext) + '\n', stderr: '' };
    },

    async seq(args) {
      let first = 1;
      let step = 1;
      let last = 1;

      if (args.length === 1) {
        last = parseFloat(args[0]) || 1;
      } else if (args.length === 2) {
        first = parseFloat(args[0]) || 1;
        last = parseFloat(args[1]) || 1;
      } else if (args.length >= 3) {
        first = parseFloat(args[0]) || 1;
        step = parseFloat(args[1]) || 1;
        last = parseFloat(args[2]) || 1;
      }

      let stdout = '';
      for (let cur = first; step > 0 ? cur <= last : cur >= last; cur += step) {
        stdout += `${cur}\n`;
      }
      return { code: 0, stdout, stderr: '' };
    },

    async tee(args, ctx) {
      let append = false;
      const files = [];

      for (const a of args) {
        if (a === '-a') append = true;
        else if (!a.startsWith('-')) files.push(a);
      }

      const input = ctx.stdin || '';
      for (const f of files) {
        const abs = ctx.resolvePath(f);
        if (ctx.vfs.existsSync(abs)) {
          const st = ctx.vfs.statSync(abs);
          if (st.isDirectory()) {
            return { code: 1, stdout: '', stderr: `tee: ${f}: Is a directory\n` };
          }
        }
        if (append) {
          ctx.vfs.appendFileSync(abs, input);
          ctx.emitMutation('change', abs);
        } else {
          ctx.vfs.writeFileSync(abs, input);
          ctx.emitMutation('create', abs);
        }
      }

      return { code: 0, stdout: input, stderr: '' };
    },

    // -----------------------------------------------------------------------
    // Full-Fledged VCS & Public GitHub Clone Engine: git
    // -----------------------------------------------------------------------
    async git(args, ctx) {
      const subcmd = args[0] || 'status';
      const gitState = ctx.shell.gitState;
      if (!(gitState.branches instanceof Set)) {
        gitState.branches = new Set(Array.isArray(gitState.branches) ? gitState.branches : [gitState.branch || 'main']);
      }
      if (!gitState.headSnapshot) {
        gitState.headSnapshot = snapshotWorktree(ctx.vfs, gitState.repoRoot || ctx.cwd);
      }
      if (!gitState.remotes) {
        gitState.remotes = gitState.remoteUrl ? { origin: gitState.remoteUrl } : {};
      }

      const repoRoot = PosixPath.normalize(gitState.repoRoot || ctx.cwd);
      const toRepoRel = (p) => {
        const abs = ctx.resolvePath(p);
        const prefix = repoRoot === '/' ? '/' : repoRoot + '/';
        if (abs === repoRoot) return '.';
        if (abs.startsWith(prefix)) return abs.slice(prefix.length);
        return p.replace(/^\.\//, '');
      };

      if (subcmd === 'clone') {
        let branchOpt = null;
        const positional = [];
        for (let i = 1; i < args.length; i++) {
          const a = args[i];
          if ((a === '-b' || a === '--branch') && i + 1 < args.length) {
            branchOpt = args[++i];
          } else if (a.startsWith('--branch=')) {
            branchOpt = a.slice('--branch='.length);
          } else if ((a === '--depth' || a === '-o' || a === '--origin') && i + 1 < args.length) {
            i++;
          } else if (a.startsWith('-')) {
            // ignore other flags like --single-branch, -q
          } else {
            positional.push(a);
          }
        }

        const repoArg = positional[0];
        const dirArg = positional[1];
        if (!repoArg) {
          return { code: 128, stdout: '', stderr: 'fatal: You must specify a repository to clone.\n' };
        }

        const parsed = parseGitHubRepoUrl(repoArg);
        if (!parsed) {
          return {
            code: 128,
            stdout: '',
            stderr: `fatal: repository '${repoArg}' does not exist or is not a valid GitHub repository URL\n`
          };
        }

        let targetDir;
        let dirDisplayName;
        if (dirArg === '.') {
          targetDir = ctx.cwd;
          dirDisplayName = '.';
        } else if (dirArg) {
          targetDir = ctx.resolvePath(dirArg);
          dirDisplayName = dirArg;
        } else {
          targetDir = PosixPath.join(ctx.cwd, parsed.repo);
          dirDisplayName = parsed.repo;
        }

        // Stream clone progress to the terminal as it happens (no end-of-run buffering).
        const canStream = typeof ctx.onStdout === 'function';
        const streamLine = (text) => { if (canStream && text) ctx.onStdout(text); };
        streamLine(`Cloning into '${dirDisplayName}'...\n`);
        let enumeratedEmitted = false;
        let lastProgressPct = -1;

        try {
          const result = await cloneGitHubRepository(repoArg, ctx.vfs, {
            targetDir,
            branch: branchOpt,
            fetchImpl: ctx.shell && ctx.shell.options ? ctx.shell.options.fetchImpl : undefined,
            signal: ctx.signal,
            onFile: (absPath) => ctx.emitMutation('create', absPath),
            onProgress: (ev) => {
              if (!ev) return;
              if (ev.phase === 'downloading' && !enumeratedEmitted && typeof ev.total === 'number' && ev.total > 0) {
                enumeratedEmitted = true;
                streamLine(`remote: Enumerating objects: ${ev.total}, done.\n`);
                streamLine(`remote: Counting objects: 100% (${ev.total}/${ev.total}), done.\n`);
              }
              if (ev.phase === 'downloading' && typeof ev.total === 'number' && ev.total > 0 && typeof ev.loaded === 'number' && ev.loaded < ev.total) {
                const pct = Math.min(100, Math.max(0, Math.floor((ev.loaded / ev.total) * 100)));
                if (pct >= lastProgressPct + 10) {
                  lastProgressPct = pct;
                  streamLine(`Receiving objects: ${pct}% (${ev.loaded}/${ev.total})\n`);
                }
              }
              if (ev.phase === 'mounting') {
                streamLine(`Resolving deltas: 100% (${ev.total || 0}/${ev.total || 0}), done.\n`);
              }
            }
          });

          gitState.branch = result.branch;
          gitState.branches.add(result.branch);
          gitState.remoteUrl = result.url;
          gitState.remotes.origin = result.url;
          gitState.repoRoot = targetDir;
          gitState.headSnapshot = Object.assign({}, result.headSnapshot);
          gitState.commits = result.commits;
          gitState.staged.clear();

          const count = Math.max(1, result.filesWritten);
          const kb = Math.max(0.1, result.totalBytes / 1024).toFixed(1);
          streamLine(`Receiving objects: 100% (${count}/${count}), ${kb} KiB, done.\n`);
          const stdout =
            `Cloning into '${dirDisplayName}'...\n` +
            `remote: Enumerating objects: ${count}, done.\n` +
            `remote: Counting objects: 100% (${count}/${count}), done.\n` +
            `Receiving objects: 100% (${count}/${count}), ${kb} KiB, done.\n`;
          return { code: 0, stdout, stderr: '' };
        } catch (err) {
          if (ctx.signal && ctx.signal.aborted) {
            return { code: 130, stdout: '', stderr: '', aborted: true };
          }
          const msg = err && err.message ? err.message : String(err);
          if (canStream) streamLine(msg.endsWith('\n') ? msg : msg + '\n');
          return { code: 128, stdout: '', stderr: (msg.endsWith('\n') ? msg : msg + '\n') };
        }
      }

      if (subcmd === 'init') {
        const initDir = args[1] && !args[1].startsWith('-') ? ctx.resolvePath(args[1]) : ctx.cwd;
        const gitDir = PosixPath.join(initDir, '.git');
        ensureDirSync(ctx.vfs, gitDir, ctx.emitMutation);
        const branchName = gitState.branch || 'main';
        ctx.vfs.writeFileSync(PosixPath.join(gitDir, 'HEAD'), `ref: refs/heads/${branchName}\n`);
        ctx.vfs.writeFileSync(
          PosixPath.join(gitDir, 'config'),
          `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n`
        );
        ctx.emitMutation('create', PosixPath.join(gitDir, 'HEAD'));
        gitState.repoRoot = initDir;
        gitState.headSnapshot = snapshotWorktree(ctx.vfs, initDir);
        gitState.staged.clear();
        return { code: 0, stdout: `Initialized empty Git repository in ${gitDir}/\n`, stderr: '' };
      }

      if (subcmd === 'status') {
        const isShort = args.includes('-s') || args.includes('--short');
        const liveFiles = snapshotWorktree(ctx.vfs, repoRoot);
        const headFiles = gitState.headSnapshot || {};

        const stagedList = [];
        for (const relPath of gitState.staged) {
          const inHead = Object.prototype.hasOwnProperty.call(headFiles, relPath);
          const inLive = Object.prototype.hasOwnProperty.call(liveFiles, relPath);
          if (!inHead && inLive) {
            stagedList.push({ status: 'new file', short: 'A ', path: relPath });
          } else if (inHead && !inLive) {
            stagedList.push({ status: 'deleted', short: 'D ', path: relPath });
          } else {
            stagedList.push({ status: 'modified', short: 'M ', path: relPath });
          }
        }

        const unstagedList = [];
        for (const relPath of Object.keys(headFiles).sort()) {
          if (gitState.staged.has(relPath)) continue;
          if (!Object.prototype.hasOwnProperty.call(liveFiles, relPath)) {
            unstagedList.push({ status: 'deleted', short: ' D', path: relPath });
          } else if (liveFiles[relPath] !== headFiles[relPath]) {
            unstagedList.push({ status: 'modified', short: ' M', path: relPath });
          }
        }

        const untrackedList = [];
        for (const relPath of Object.keys(liveFiles).sort()) {
          if (!Object.prototype.hasOwnProperty.call(headFiles, relPath) && !gitState.staged.has(relPath)) {
            untrackedList.push(relPath);
          }
        }

        if (isShort) {
          let sOut = '';
          for (const item of stagedList) sOut += `${item.short} ${item.path}\n`;
          for (const item of unstagedList) sOut += `${item.short} ${item.path}\n`;
          for (const p of untrackedList) sOut += `?? ${p}\n`;
          return { code: 0, stdout: sOut, stderr: '' };
        }

        let stdout = `On branch ${gitState.branch}\n`;
        if (gitState.remoteUrl) {
          stdout += `Your branch is up to date with 'origin/${gitState.branch}'.\n\n`;
        }
        if (stagedList.length > 0) {
          stdout += 'Changes to be committed:\n';
          for (const item of stagedList) {
            stdout += `\t${item.status}:   ${item.path}\n`;
          }
          stdout += '\n';
        }
        if (unstagedList.length > 0) {
          stdout += 'Changes not staged for commit:\n';
          for (const item of unstagedList) {
            stdout += `\t${item.status}:   ${item.path}\n`;
          }
          stdout += '\n';
        }
        if (untrackedList.length > 0) {
          stdout += 'Untracked files:\n';
          for (const p of untrackedList) {
            stdout += `\t${p}\n`;
          }
          stdout += '\n';
        }
        if (stagedList.length === 0 && unstagedList.length === 0 && untrackedList.length === 0) {
          stdout += 'nothing to commit, working tree clean\n';
        }
        return { code: 0, stdout, stderr: '' };
      }

      if (subcmd === 'diff') {
        const isStaged = args.includes('--staged') || args.includes('--cached');
        const fileFilters = args.slice(1).filter((a) => !a.startsWith('-')).map(toRepoRel);
        const liveFiles = snapshotWorktree(ctx.vfs, repoRoot);
        const headFiles = gitState.headSnapshot || {};
        const allKeys = Array.from(new Set([...Object.keys(headFiles), ...Object.keys(liveFiles)])).sort();

        let stdout = '';
        for (const relPath of allKeys) {
          if (fileFilters.length > 0 && !fileFilters.includes(relPath)) continue;
          if (isStaged && !gitState.staged.has(relPath)) continue;
          if (!isStaged && !Object.prototype.hasOwnProperty.call(headFiles, relPath) && !gitState.staged.has(relPath)) {
            continue;
          }
          const oldText = Object.prototype.hasOwnProperty.call(headFiles, relPath) ? headFiles[relPath] : '';
          const newText = Object.prototype.hasOwnProperty.call(liveFiles, relPath) ? liveFiles[relPath] : '';
          if (oldText !== newText) {
            const uDiff = computeUnifiedDiff(`a/${relPath}`, `b/${relPath}`, oldText, newText);
            if (uDiff) {
              stdout += `diff --git a/${relPath} b/${relPath}\n${uDiff}`;
            }
          }
        }
        return { code: 0, stdout, stderr: '' };
      }

      if (subcmd === 'add') {
        const targets = args.slice(1);
        const liveFiles = snapshotWorktree(ctx.vfs, repoRoot);
        const headFiles = gitState.headSnapshot || {};

        if (targets.includes('.') || targets.includes('-A') || targets.includes('--all') || targets.includes('-u')) {
          const includeUntracked = !targets.includes('-u');
          for (const relPath of Object.keys(liveFiles)) {
            const inHead = Object.prototype.hasOwnProperty.call(headFiles, relPath);
            if (!inHead && includeUntracked) {
              gitState.staged.add(relPath);
            } else if (inHead && liveFiles[relPath] !== headFiles[relPath]) {
              gitState.staged.add(relPath);
            }
          }
          for (const relPath of Object.keys(headFiles)) {
            if (!Object.prototype.hasOwnProperty.call(liveFiles, relPath)) {
              gitState.staged.add(relPath);
            }
          }
        } else {
          for (const f of targets) {
            if (f.startsWith('-')) continue;
            const rel = toRepoRel(f);
            if (rel === '.') {
              for (const k of Object.keys(liveFiles)) {
                if (liveFiles[k] !== headFiles[k]) gitState.staged.add(k);
              }
            } else {
              const dirPrefix = rel.replace(/\/+$/, '') + '/';
              const matchedSubfiles = Object.keys(liveFiles).filter((k) => k.startsWith(dirPrefix));
              if (matchedSubfiles.length > 0) {
                for (const k of matchedSubfiles) gitState.staged.add(k);
              } else {
                gitState.staged.add(rel);
              }
            }
          }
        }
        return { code: 0, stdout: '', stderr: '' };
      }

      if (subcmd === 'commit') {
        const liveFiles = snapshotWorktree(ctx.vfs, repoRoot);
        const headFiles = gitState.headSnapshot || {};
        if (args.includes('-a') || args.includes('-am')) {
          for (const relPath of Object.keys(headFiles)) {
            if (liveFiles[relPath] !== headFiles[relPath]) {
              gitState.staged.add(relPath);
            }
          }
        }

        let msg = 'Commit changes';
        const mIdx = args.findIndex((a) => a === '-m' || a === '-am');
        if (mIdx !== -1 && mIdx + 1 < args.length) msg = args[mIdx + 1];

        for (const relPath of gitState.staged) {
          if (Object.prototype.hasOwnProperty.call(liveFiles, relPath)) {
            gitState.headSnapshot[relPath] = liveFiles[relPath];
          } else {
            delete gitState.headSnapshot[relPath];
          }
        }

        const hash = Math.random().toString(16).slice(2, 9);
        gitState.commits.unshift({
          hash,
          author: `${ctx.env.USER || 'codelab'} <dev@codelab.internal>`,
          date: new Date().toUTCString(),
          message: msg
        });
        const count = gitState.staged.size || 1;
        gitState.staged.clear();
        return { code: 0, stdout: `[${gitState.branch} ${hash}] ${msg}\n ${count} file changed\n`, stderr: '' };
      }

      if (subcmd === 'branch') {
        const dIdx = args.findIndex((a) => a === '-d' || a === '-D');
        if (dIdx !== -1 && dIdx + 1 < args.length) {
          const target = args[dIdx + 1];
          if (target === gitState.branch) {
            return { code: 1, stdout: '', stderr: `error: Cannot delete branch '${target}' checked out\n` };
          }
          gitState.branches.delete(target);
          return { code: 0, stdout: `Deleted branch ${target}.\n`, stderr: '' };
        }
        const mIdx = args.findIndex((a) => a === '-m' || a === '-M');
        if (mIdx !== -1 && mIdx + 1 < args.length) {
          const newName = args[mIdx + 1];
          gitState.branches.delete(gitState.branch);
          gitState.branch = newName;
          gitState.branches.add(newName);
          return { code: 0, stdout: '', stderr: '' };
        }
        const nonFlags = args.slice(1).filter((a) => !a.startsWith('-'));
        if (nonFlags.length > 0) {
          for (const bName of nonFlags) {
            gitState.branches.add(bName);
          }
          return { code: 0, stdout: '', stderr: '' };
        }

        const showAll = args.includes('-a') || args.includes('--all');
        let stdout = '';
        for (const b of gitState.branches) {
          stdout += b === gitState.branch ? `* ${b}\n` : `  ${b}\n`;
        }
        if (showAll && gitState.remoteUrl) {
          stdout += `  remotes/origin/${gitState.branch}\n`;
        }
        return { code: 0, stdout, stderr: '' };
      }

      if (subcmd === 'checkout' || subcmd === 'switch') {
        const bIdx = args.findIndex((a) => a === '-b' || a === '-B' || a === '-c' || a === '-C');
        if (bIdx !== -1 && bIdx + 1 < args.length) {
          const newBranch = args[bIdx + 1];
          gitState.branches.add(newBranch);
          gitState.branch = newBranch;
          return { code: 0, stdout: `Switched to a new branch '${newBranch}'\n`, stderr: '' };
        }

        const target = args.slice(1).find((a) => a !== '--' && !a.startsWith('-'));
        if (!target) {
          return { code: 1, stdout: '', stderr: 'error: branch or path required\n' };
        }

        if (gitState.branches.has(target) && !args.includes('--')) {
          gitState.branch = target;
          return { code: 0, stdout: `Switched to branch '${target}'\n`, stderr: '' };
        }

        const rel = toRepoRel(target);
        if (gitState.headSnapshot && Object.prototype.hasOwnProperty.call(gitState.headSnapshot, rel)) {
          const abs = PosixPath.join(repoRoot, rel);
          ctx.vfs.writeFileSync(abs, gitState.headSnapshot[rel]);
          ctx.emitMutation('change', abs);
          return { code: 0, stdout: `Updated 1 path from the index\n`, stderr: '' };
        }

        return { code: 1, stdout: '', stderr: `error: pathspec '${target}' did not match any file(s) known to git\n` };
      }

      if (subcmd === 'restore') {
        const isStaged = args.includes('--staged') || args.includes('-S');
        const targets = args.slice(1).filter((a) => !a.startsWith('-'));
        for (const t of targets) {
          const rel = toRepoRel(t);
          if (isStaged) {
            gitState.staged.delete(rel);
          } else if (gitState.headSnapshot && Object.prototype.hasOwnProperty.call(gitState.headSnapshot, rel)) {
            const abs = PosixPath.join(repoRoot, rel);
            ctx.vfs.writeFileSync(abs, gitState.headSnapshot[rel]);
            ctx.emitMutation('change', abs);
          }
        }
        return { code: 0, stdout: '', stderr: '' };
      }

      if (subcmd === 'remote') {
        const sub = args[1];
        if (!sub) {
          const names = Object.keys(gitState.remotes);
          return { code: 0, stdout: names.length > 0 ? names.join('\n') + '\n' : '', stderr: '' };
        }
        if (sub === '-v' || sub === '--verbose') {
          let stdout = '';
          for (const [rName, rUrl] of Object.entries(gitState.remotes)) {
            stdout += `${rName}\t${rUrl} (fetch)\n${rName}\t${rUrl} (push)\n`;
          }
          return { code: 0, stdout, stderr: '' };
        }
        if ((sub === 'add' || sub === 'set-url') && args[2] && args[3]) {
          gitState.remotes[args[2]] = args[3];
          if (args[2] === 'origin') gitState.remoteUrl = args[3];
          return { code: 0, stdout: '', stderr: '' };
        }
        if (sub === 'get-url' && args[2]) {
          const u = gitState.remotes[args[2]];
          if (!u) return { code: 2, stdout: '', stderr: `fatal: No such remote '${args[2]}'\n` };
          return { code: 0, stdout: `${u}\n`, stderr: '' };
        }
        if ((sub === 'remove' || sub === 'rm') && args[2]) {
          delete gitState.remotes[args[2]];
          if (args[2] === 'origin') gitState.remoteUrl = null;
          return { code: 0, stdout: '', stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }

      if (subcmd === 'pull' || subcmd === 'fetch') {
        const remoteUrl = gitState.remoteUrl || gitState.remotes.origin;
        if (!remoteUrl) {
          return { code: 1, stdout: '', stderr: 'fatal: No remote repository specified.\n' };
        }
        if (subcmd === 'fetch') {
          return { code: 0, stdout: `From ${remoteUrl.replace(/\.git$/, '')}\n * branch            ${gitState.branch} -> FETCH_HEAD\n`, stderr: '' };
        }
        try {
          const result = await cloneGitHubRepository(remoteUrl, ctx.vfs, {
            targetDir: repoRoot,
            branch: gitState.branch,
            fetchImpl: ctx.shell && ctx.shell.options ? ctx.shell.options.fetchImpl : undefined,
            signal: ctx.signal,
            onFile: (absPath) => ctx.emitMutation('change', absPath)
          });
          gitState.headSnapshot = Object.assign({}, result.headSnapshot);
          return {
            code: 0,
            stdout: `From ${remoteUrl.replace(/\.git$/, '')}\n * branch            ${result.branch} -> FETCH_HEAD\nAlready up to date.\n`,
            stderr: ''
          };
        } catch (err) {
          if (ctx.signal && ctx.signal.aborted) {
            return { code: 130, stdout: '', stderr: '', aborted: true };
          }
          const msg = err && err.message ? err.message : String(err);
          return { code: 1, stdout: '', stderr: (msg.endsWith('\n') ? msg : msg + '\n') };
        }
      }

      if (subcmd === 'log') {
        const oneline = args.includes('--oneline');
        let limit = gitState.commits.length;
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '-n' && args[i + 1]) limit = parseInt(args[++i], 10) || limit;
          else if (/^-\d+$/.test(args[i])) limit = parseInt(args[i].slice(1), 10) || limit;
        }
        let stdout = '';
        for (const c of gitState.commits.slice(0, limit)) {
          if (oneline) {
            stdout += `${c.hash} ${c.message}\n`;
          } else {
            stdout += `commit ${c.hash}\n`;
            stdout += `Author: ${c.author}\n`;
            stdout += `Date:   ${c.date}\n\n`;
            stdout += `    ${c.message}\n\n`;
          }
        }
        return { code: 0, stdout, stderr: '' };
      }

      return { code: 0, stdout: `git: '${subcmd}' executed\n`, stderr: '' };
    },

    // -----------------------------------------------------------------------
    // Interactive Help: help
    // -----------------------------------------------------------------------
    async help(args, ctx) {
      let stdout = 'CodeLab POSIX Shell & UNIX Coreutils (Pure-JS Engine)\n\n';
      stdout += 'Filesystem:\n';
      stdout += '  ls [-l -a -la -lh]     List directory contents\n';
      stdout += '  cd [dir]               Change current directory\n';
      stdout += '  pwd                    Print working directory\n';
      stdout += '  mkdir [-p] [dir...]    Create directories\n';
      stdout += '  touch [file...]        Update timestamp or create empty file\n';
      stdout += '  rm [-r -f] [path...]   Remove files or directories\n';
      stdout += '  cp [-r] [src] [dst]    Copy files or directories\n';
      stdout += '  mv [src] [dst]         Move / rename files\n';
      stdout += '  stat [file...]         Display file status\n';
      stdout += '  tree [-a -L n] [dir]   Visual directory hierarchy\n\n';
      stdout += 'Text & Search:\n';
      stdout += '  cat [-n] [file...]     Concatenate and print files\n';
      stdout += '  head [-n n] [file...]  Output first lines\n';
      stdout += '  tail [-n n] [file...]  Output last lines\n';
      stdout += '  grep [-n -i -r -v -E]  Search lines matching regex\n';
      stdout += '  find [path] [-name pat] Search files in directory tree\n';
      stdout += '  wc [-l -w -c]          Count lines, words, bytes\n';
      stdout += '  sort [-r -n -u]        Sort lines\n';
      stdout += '  uniq [-c -d -u]        Filter repeated lines\n';
      stdout += '  sed [-i] s/pat/rep/g   Stream editor\n';
      stdout += '  awk [-F sep] "{print}" Pattern scanning language\n';
      stdout += '  cut [-d sep -f list]   Cut out selected fields\n';
      stdout += '  tr [-d] set1 set2      Translate or delete characters\n';
      stdout += '  diff [-u] f1 f2        Compare files line by line\n\n';
      stdout += 'System & Shell:\n';
      stdout += '  echo [-n -e] [args...] Print arguments\n';
      stdout += '  printf format [args..] Formatted output\n';
      stdout += '  env, export, unset     Environment variable manipulation\n';
      stdout += '  which, whoami, uname   System identification\n';
      stdout += '  date, sleep, clear     Date, delay, terminal screen control\n';
      stdout += '  history, ps, jobs, kill Process and job management\n';
      stdout += '  git [status diff log]  Built-in version control\n';
      stdout += '  node, bun, npm, npx, bunx CLI runtime and package shims\n';
      stdout += '  ports, curl            Port table inspection & HTTP requests\n';
      return { code: 0, stdout, stderr: '' };
    },

    // -----------------------------------------------------------------------
    // Language Runtimes & Package Managers: node, bun, npm, npx, bunx
    // -----------------------------------------------------------------------
    async node(args, ctx) {
      if (!hasVirtualRuntime()) {
        return { code: 1, stdout: '', stderr: 'node: Virtual runtime engine is not available\n' };
      }
      if (args.length === 0 || args[0] === '-v' || args[0] === '--version') {
        if (args[0] === '-v' || args[0] === '--version') return { code: 0, stdout: 'v22.0.0\n', stderr: '' };
        return { code: 0, stdout: 'Welcome to Node.js v22.0.0.\nType ".help" for more information.\n', stderr: '' };
      }

      if (args[0] === '-e' || args[0] === '--eval') {
        const code = args[1] || '';
        const res = await executeInVirtualRuntime({
          mode: 'repl',
          replCode: code,
          printReplResult: false,
          vfs: ctx.vfs,
          activePortTable: ctx.shell.portTable,
          pid: ctx.pid,
          isBackground: ctx.isBackground,
          onStdout: ctx.onStdout,
          onStderr: ctx.onStderr,
          signal: ctx.signal
        });
        return { code: res.ok ? 0 : (res.exitCode || 1), stdout: res.stdout, stderr: res.stderr };
      }

      if (args[0] === '-p' || args[0] === '--print') {
        const code = args[1] || '';
        const res = await executeInVirtualRuntime({
          mode: 'repl',
          replCode: code,
          printReplResult: true,
          vfs: ctx.vfs,
          activePortTable: ctx.shell.portTable,
          pid: ctx.pid,
          isBackground: ctx.isBackground,
          onStdout: ctx.onStdout,
          onStderr: ctx.onStderr,
          signal: ctx.signal
        });
        return { code: res.ok ? 0 : (res.exitCode || 1), stdout: res.stdout, stderr: res.stderr };
      }

      if (args[0] === '--test') {
        const testFile = args[1] ? ctx.resolvePath(args[1]) : null;
        let filesToRun = [];
        if (testFile) {
          filesToRun.push(testFile);
        } else {
          const findTests = (dir) => {
            if (!ctx.vfs.existsSync(dir)) return;
            for (const item of ctx.vfs.readdirSync(dir)) {
              const full = PosixPath.join(dir, item);
              const st = ctx.vfs.statSync(full);
              if (st.isDirectory() && item !== 'node_modules') {
                findTests(full);
              } else if (item.endsWith('.test.js') || item.endsWith('.test.ts') || item === 'test.js') {
                filesToRun.push(full);
              }
            }
          };
          findTests(ctx.cwd);
        }

        let combinedOut = '';
        let combinedErr = '';
        let allOk = true;
        for (const f of filesToRun) {
          const res = await executeInVirtualRuntime({
            mode: 'test',
            entry: f,
            vfs: ctx.vfs,
            activePortTable: ctx.shell.portTable,
            pid: ctx.pid,
            isBackground: ctx.isBackground,
            onStdout: ctx.onStdout,
            onStderr: ctx.onStderr,
            signal: ctx.signal
          });
          combinedOut += res.stdout;
          combinedErr += res.stderr;
          if (!res.ok) allOk = false;
        }
        return { code: allOk ? 0 : 1, stdout: combinedOut, stderr: combinedErr };
      }

      const scriptFile = ctx.resolvePath(args[0]);
      if (!ctx.vfs.existsSync(scriptFile)) {
        return { code: 1, stdout: '', stderr: `node: cannot find module '${args[0]}'\n` };
      }

      const scriptArgs = args.slice(1);
      const res = await executeInVirtualRuntime({
        mode: 'run',
        entry: scriptFile,
        argv: ['node', scriptFile, ...scriptArgs],
        vfs: ctx.vfs,
        activePortTable: ctx.shell.portTable,
        pid: ctx.pid,
        isBackground: ctx.isBackground,
        onStdout: ctx.onStdout,
        onStderr: ctx.onStderr,
        signal: ctx.signal
      });
      return { code: res.ok ? 0 : (res.exitCode || 1), stdout: res.stdout, stderr: res.stderr };
    },

    async bun(args, ctx) {
      if (args.length === 0) {
        return { code: 0, stdout: 'Bun v1.1.20\n', stderr: '' };
      }

      const sub = args[0];

      if (sub === '--version' || sub === '-v' || sub === '--revision') {
        return { code: 0, stdout: '1.1.20\n', stderr: '' };
      }

      if (sub === '--help' || sub === '-h') {
        return {
          code: 0,
          stdout: 'Bun v1.1.20\nUsage: bun <command> [flags]\n\nCommands:\n  run <file|script>    Run a file or package script\n  install, i, add      Install dependencies\n  remove, rm           Remove dependencies\n  test                 Run tests\n  init                 Scaffold a new project\n  -e <code>            Evaluate JavaScript\n',
          stderr: ''
        };
      }

      if (sub === 'init') {
        const pkgPath = PosixPath.join(ctx.cwd, 'package.json');
        const dirName = PosixPath.basename(ctx.cwd) || 'app';
        if (!ctx.vfs.existsSync(pkgPath)) {
          ctx.vfs.writeFileSync(pkgPath, JSON.stringify({
            name: dirName,
            module: 'index.ts',
            type: 'module',
            devDependencies: {
              '@types/bun': 'latest'
            },
            peerDependencies: {
              typescript: '^5.0.0'
            }
          }, null, 2) + '\n');
          if (typeof ctx.emitMutation === 'function') ctx.emitMutation('create', pkgPath);
        }
        const indexTsPath = PosixPath.join(ctx.cwd, 'index.ts');
        if (!ctx.vfs.existsSync(indexTsPath)) {
          ctx.vfs.writeFileSync(indexTsPath, 'console.log("Hello via Bun!");\n');
          if (typeof ctx.emitMutation === 'function') ctx.emitMutation('create', indexTsPath);
        }
        const tsconfigPath = PosixPath.join(ctx.cwd, 'tsconfig.json');
        if (!ctx.vfs.existsSync(tsconfigPath)) {
          ctx.vfs.writeFileSync(tsconfigPath, JSON.stringify({
            compilerOptions: {
              lib: ['ESNext'],
              module: 'esnext',
              target: 'esnext',
              moduleResolution: 'bundler',
              moduleDetection: 'force',
              allowImportingTsExtensions: true,
              noEmit: true,
              composite: true,
              strict: true,
              downlevelIteration: true,
              skipLibCheck: true,
              jsx: 'react-jsx',
              allowSyntheticDefaultImports: true,
              forceConsistentCasingInFileNames: true,
              allowJs: true,
              types: ['bun-types']
            }
          }, null, 2) + '\n');
          if (typeof ctx.emitMutation === 'function') ctx.emitMutation('create', tsconfigPath);
        }
        return { code: 0, stdout: 'Done! A package.json file was created in ' + ctx.cwd + '\n', stderr: '' };
      }

      if (sub === 'install' || sub === 'i' || sub === 'ci') {
        const pkgs = args.slice(1).filter(a => !a.startsWith('-'));
        if (pkgs.length === 0) {
          const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
          const deps = Object.keys(pkgData.dependencies || {});
          const results = [];
          for (const p of deps) results.push(await installPackage(p, ctx));
          const warning = results.map(r => r && r.warning).filter(Boolean)[0];
          return { code: 0, stdout: deps.length === 0 ? 'up to date\n' : `installed ${deps.length} package(s)\n`, stderr: warning ? `bun warn ${warning}\n` : '' };
        }
        const results = [];
        for (const p of pkgs) results.push(await installPackage(p, ctx));
        const warning = results.map(r => r && r.warning).filter(Boolean)[0];
        return { code: 0, stdout: `saved ${results.filter(r => r && r.name).length} package(s)\n`, stderr: warning ? `bun warn ${warning}\n` : '' };
      }

      if (sub === 'add') {
        const pkgs = args.slice(1).filter(a => !a.startsWith('-'));
        const results = [];
        for (const p of pkgs) results.push(await installPackage(p, ctx));
        const warning = results.map(r => r && r.warning).filter(Boolean)[0];
        return { code: 0, stdout: `saved ${results.filter(r => r && r.name).length} package(s)\n`, stderr: warning ? `bun warn ${warning}\n` : '' };
      }

      if (sub === 'remove' || sub === 'rm') {
        const pkgs = args.slice(1).filter(a => !a.startsWith('-'));
        for (const p of pkgs) {
          uninstallPackage(p, ctx);
        }
        return { code: 0, stdout: `removed ${pkgs.length} package(s)\n`, stderr: '' };
      }

      if (sub === 'pm') {
        if (args[1] === 'ls') {
          return { code: 0, stdout: listDependencies(ctx), stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }

      if (sub === '-e') {
        const code = args[1] || '';
        const res = await executeInVirtualRuntime({
          mode: 'repl',
          replCode: code,
          printReplResult: false,
          vfs: ctx.vfs,
          activePortTable: ctx.shell.portTable,
          pid: ctx.pid,
          isBackground: ctx.isBackground,
          onStdout: ctx.onStdout,
          onStderr: ctx.onStderr,
          signal: ctx.signal
        });
        return { code: res.ok ? 0 : (res.exitCode || 1), stdout: res.stdout, stderr: res.stderr };
      }

      if (sub === 'test') {
        const testTarget = args[1] ? ctx.resolvePath(args[1]) : null;
        let filesToRun = [];
        if (testTarget) {
          filesToRun.push(testTarget);
        } else {
          const findTests = (dir) => {
            if (!ctx.vfs.existsSync(dir)) return;
            for (const item of ctx.vfs.readdirSync(dir)) {
              const full = PosixPath.join(dir, item);
              const st = ctx.vfs.statSync(full);
              if (st.isDirectory() && item !== 'node_modules') {
                findTests(full);
              } else if (item.endsWith('.test.js') || item.endsWith('.test.ts')) {
                filesToRun.push(full);
              }
            }
          };
          findTests(ctx.cwd);
        }

        let combinedOut = '';
        let combinedErr = '';
        let allOk = true;
        for (const f of filesToRun) {
          const res = await executeInVirtualRuntime({
            mode: 'test',
            entry: f,
            vfs: ctx.vfs,
            activePortTable: ctx.shell.portTable,
            pid: ctx.pid,
            isBackground: ctx.isBackground,
            onStdout: ctx.onStdout,
            onStderr: ctx.onStderr,
            signal: ctx.signal
          });
          combinedOut += res.stdout;
          combinedErr += res.stderr;
          if (!res.ok) allOk = false;
        }
        return { code: allOk ? 0 : 1, stdout: combinedOut, stderr: combinedErr };
      }

      if (sub === 'run') {
        const target = args[1];
        if (!target) {
          return { code: 0, stdout: listDependencies(ctx), stderr: '' };
        }
        const resolved = ctx.resolvePath(target);
        if (ctx.vfs.existsSync(resolved)) {
          const scriptArgs = args.slice(2);
          const res = await executeInVirtualRuntime({
            mode: 'run',
            entry: resolved,
            argv: ['bun', resolved, ...scriptArgs],
            vfs: ctx.vfs,
            activePortTable: ctx.shell.portTable,
            pid: ctx.pid,
            isBackground: ctx.isBackground,
            onStdout: ctx.onStdout,
            onStderr: ctx.onStderr,
            signal: ctx.signal
          });
          return { code: res.ok ? 0 : (res.exitCode || 1), stdout: res.stdout, stderr: res.stderr };
        }
        const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
        if (pkgData.scripts && pkgData.scripts[target]) {
          return await runPackageScript(target, args.slice(2), ctx);
        }
        return { code: 1, stdout: '', stderr: `error: Script or file not found "${target}"\n` };
      }

      const resolved = ctx.resolvePath(sub);
      if (ctx.vfs.existsSync(resolved)) {
        const scriptArgs = args.slice(1);
        const res = await executeInVirtualRuntime({
          mode: 'run',
          entry: resolved,
          argv: ['bun', resolved, ...scriptArgs],
          vfs: ctx.vfs,
          activePortTable: ctx.shell.portTable,
          pid: ctx.pid,
          isBackground: ctx.isBackground,
          onStdout: ctx.onStdout,
          onStderr: ctx.onStderr,
          signal: ctx.signal
        });
        return { code: res.ok ? 0 : (res.exitCode || 1), stdout: res.stdout, stderr: res.stderr };
      }

      const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
      if (pkgData.scripts && pkgData.scripts[sub]) {
        return await runPackageScript(sub, args.slice(1), ctx);
      }

      return { code: 1, stdout: '', stderr: `bun: file or command not found: ${sub}\n` };
    },

    async npm(args, ctx) {
      if (args.length === 0) {
        return { code: 0, stdout: 'npm v10.2.0\n', stderr: '' };
      }
      const sub = args[0];

      if (sub === 'init') {
        const pkgPath = PosixPath.join(ctx.cwd, 'package.json');
        if (!ctx.vfs.existsSync(pkgPath)) {
          ctx.vfs.writeFileSync(pkgPath, JSON.stringify({
            name: PosixPath.basename(ctx.cwd) || 'app',
            version: '1.0.0',
            description: '',
            main: 'index.js',
            scripts: {
              test: 'echo "Error: no test specified" && exit 1'
            },
            keywords: [],
            author: '',
            license: 'ISC'
          }, null, 2) + '\n');
          if (typeof ctx.emitMutation === 'function') ctx.emitMutation('create', pkgPath);
        }
        return { code: 0, stdout: 'Wrote to ' + pkgPath + '\n', stderr: '' };
      }

      if (sub === 'i' || sub === 'install' || sub === 'add') {
        const pkgs = args.slice(1).filter(a => !a.startsWith('-'));
        if (pkgs.length === 0) {
          const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
          const results = [];
          for (const p of Object.keys(pkgData.dependencies || {})) {
            results.push(await installPackage(p, ctx));
          }
          const warning = results.map(r => r && r.warning).filter(Boolean)[0];
          return { code: 0, stdout: 'up to date\n', stderr: warning ? `npm warn ${warning}\n` : '' };
        }
        const results = [];
        for (const p of pkgs) {
          results.push(await installPackage(p, ctx));
        }
        const warning = results.map(r => r && r.warning).filter(Boolean)[0];
        return { code: 0, stdout: `added ${results.filter(r => r && r.name).length} package(s) in 0.1s\n`, stderr: warning ? `npm warn ${warning}\n` : '' };
      }

      if (sub === 'uninstall' || sub === 'remove' || sub === 'rm') {
        const pkgs = args.slice(1).filter(a => !a.startsWith('-'));
        for (const p of pkgs) {
          uninstallPackage(p, ctx);
        }
        return { code: 0, stdout: `removed ${pkgs.length} package(s) in 0.1s\n`, stderr: '' };
      }

      if (sub === 'list' || sub === 'ls') {
        return { code: 0, stdout: listDependencies(ctx), stderr: '' };
      }

      if (sub === 'run' || sub === 'run-script') {
        const scriptName = args[1];
        if (!scriptName) {
          return { code: 1, stdout: '', stderr: 'npm ERR! missing script name\n' };
        }
        return await runPackageScript(scriptName, args.slice(2), ctx);
      }

      if (sub === 'test') {
        return await runPackageScript('test', args.slice(1), ctx);
      }

      const { data: pkgData } = readPackageJson(ctx.vfs, ctx.cwd);
      if (pkgData.scripts && pkgData.scripts[sub]) {
        return await runPackageScript(sub, args.slice(1), ctx);
      }

      return { code: 1, stdout: '', stderr: `npm ERR! Unknown command: "${sub}"\n` };
    },

    async npx(args, ctx) {
      if (args.length === 0) {
        return { code: 1, stdout: '', stderr: 'npx: missing command\n' };
      }
      const cmd = args[0];
      const cmdArgs = args.slice(1);
      const binPath = PosixPath.join('/workspace/node_modules/.bin', cmd);
      if (ctx.vfs.existsSync(binPath)) {
        return await ctx.commands.node([binPath, ...cmdArgs], ctx);
      }
      return await ctx.shell.execute(cmd + (cmdArgs.length ? ' ' + cmdArgs.join(' ') : ''));
    },

    async bunx(args, ctx) {
      return await this.npx(args, ctx);
    },

    // -----------------------------------------------------------------------
    // Port Table & HTTP Inspection: ports, curl
    // -----------------------------------------------------------------------
    async ports(args, ctx) {
      const portTable = ctx.shell && ctx.shell.portTable;
      if (!portTable || typeof portTable.listServers !== 'function') {
        return { code: 0, stdout: 'PORT     PID     NAME\n', stderr: '' };
      }
      const servers = portTable.listServers();
      let out = 'PORT     PID     NAME\n';
      for (const s of servers) {
        const portStr = String(s.port || '').padEnd(8, ' ');
        const pidStr = String(s.pid !== undefined ? s.pid : '-').padEnd(8, ' ');
        const nameStr = s.name || s.type || 'server';
        out += `${portStr} ${pidStr} ${nameStr}\n`;
      }
      return { code: 0, stdout: out, stderr: '' };
    },

    async curl(args, ctx) {
      let method = null;
      const headers = {};
      let data = null;
      let includeHeaders = false;
      let url = null;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-X' || arg === '--request') {
          method = args[++i];
        } else if (arg === '-H' || arg === '--header') {
          const h = args[++i] || '';
          const colon = h.indexOf(':');
          if (colon !== -1) {
            headers[h.slice(0, colon).trim().toLowerCase()] = h.slice(colon + 1).trim();
          }
        } else if (arg === '-d' || arg === '--data' || arg === '--data-raw') {
          data = args[++i];
          if (!method) method = 'POST';
        } else if (arg === '-i' || arg === '--include' || arg === '-v' || arg === '--verbose') {
          includeHeaders = true;
        } else if (arg === '-s' || arg === '--silent') {
          // silent
        } else if (!arg.startsWith('-')) {
          url = arg;
        }
      }

      if (!url) {
        return { code: 1, stdout: '', stderr: 'curl: no URL specified!\n' };
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      if (!method) method = 'GET';

      const portTable = (ctx.shell && ctx.shell.portTable) || null;
      let resp = null;
      let lastErr = null;

      for (let attempt = 0; attempt < 25; attempt++) {
        try {
          if (portTable) {
            resp = await portTable.dispatchRequest(url, {
              method,
              headers,
              body: data
            });
            lastErr = null;
            break;
          } else {
            resp = await fetch(url, {
              method,
              headers,
              body: data
            });
            lastErr = null;
            break;
          }
        } catch (err) {
          lastErr = err;
          await new Promise(r => setTimeout(r, 15));
        }
      }

      if (!resp) {
        return { code: 7, stdout: '', stderr: `curl: (7) Failed to connect to host: ${lastErr ? lastErr.message : 'Connection refused'}\n` };
      }

      const bodyText = typeof resp.text === 'function' ? await resp.text() : String(resp.body || '');
      let output = '';

      if (includeHeaders) {
        output += `HTTP/1.1 ${resp.status || 200} ${resp.statusText || 'OK'}\r\n`;
        if (resp.headers) {
          if (typeof resp.headers.forEach === 'function') {
            resp.headers.forEach((val, key) => {
              output += `${key}: ${val}\r\n`;
            });
          } else if (typeof resp.headers.entries === 'function') {
            for (const [k, v] of resp.headers.entries()) {
              output += `${k}: ${v}\r\n`;
            }
          } else {
            for (const [k, v] of Object.entries(resp.headers)) {
              output += `${k}: ${v}\r\n`;
            }
          }
        }
        output += '\r\n';
      }

      output += bodyText;
      return { code: 0, stdout: output, stderr: '' };
    }
  };

  // =========================================================================
  // 8. POSIX SHELL EXECUTION ENGINE
  // =========================================================================
  class PosixShell {
    constructor(options = {}) {
      this.options = options;
      this.portTable = options.portTable || (typeof createVirtualPortTable === 'function' ? createVirtualPortTable() : null);
      this.vfs = options.vfs || createFallbackVfs();
      this.env = Object.assign({
        PATH: '/usr/local/bin:/usr/bin:/bin',
        PWD: '/workspace',
        HOME: '/home/user',
        USER: 'codelab',
        SHELL: '/bin/sh',
        TERM: 'xterm-256color',
        '?': '0'
      }, options.env || {});
      this.cwd = this.env.PWD || '/workspace';
      if (options.files && typeof options.files === 'object') {
        for (const [k, v] of Object.entries(options.files)) {
          const abs = PosixPath.resolve(this.cwd, k);
          if (typeof this.vfs.writeFileSync === 'function') {
            this.vfs.writeFileSync(abs, String(v ?? ''));
          }
        }
      }
      this.history = [];
      this.jobs = new Map();
      this.nextJobId = 1;
      this.nextPid = 100;
      this.commands = Object.assign({}, COREUTILS, options.commands || {});

      this.gitState = {
        branch: 'main',
        branches: new Set(['main']),
        remoteUrl: null,
        remotes: {},
        repoRoot: this.cwd,
        headSnapshot: snapshotWorktree(this.vfs, this.cwd),
        staged: new Set(),
        commits: [
          {
            hash: 'a1b2c3d',
            author: 'CodeLab Developer <dev@codelab.internal>',
            date: new Date().toUTCString(),
            message: 'Initial project commit'
          }
        ]
      };
    }

    resolvePath(p) {
      if (!p) return this.cwd;
      return PosixPath.resolve(this.cwd, p);
    }

    // True when `name` resolves to a shell function or coreutil (used by the
    // workbench to route recognised commands straight to the shell instead of
    // treating flag-looking input such as `node --version` as a JS expression).
    hasCommand(name) {
      if (!name) return false;
      const n = String(name);
      if (this.functions && Object.prototype.hasOwnProperty.call(this.functions, n)) return true;
      return !!this.commands && Object.prototype.hasOwnProperty.call(this.commands, n);
    }

    _emitVfsMutation(type, absPath) {
      if (!this.vfs) return;
      const evt = { type, path: absPath, timestamp: Date.now() };
      if (typeof this.vfs.emit === 'function') {
        this.vfs.emit('mutation', evt);
        this.vfs.emit('change', evt);
      } else if (typeof this.vfs._emit === 'function') {
        this.vfs._emit('mutation', evt);
        this.vfs._emit('change', evt);
      }
      if (typeof this.options.onFsChange === 'function') {
        this.options.onFsChange(evt);
      }
    }

    // Evaluate Word token to string (with variable expansion & command substitution)
    async evaluateWord(wordToken, env) {
      if (!wordToken) return '';
      if (typeof wordToken === 'string') return wordToken;

      let result = '';
      for (const seg of wordToken.segments) {
        if (seg.type === 'literal' || seg.type === 'single_quoted') {
          result += seg.value;
        } else if (seg.type === 'variable') {
          result += this._expandVariable(seg.name, env);
        } else if (seg.type === 'arith') {
          result += evaluateArithmetic(seg.expr, env, this.env);
        } else if (seg.type === 'subshell') {
          result += await this._executeSubshell(seg.command, env);
        } else if (seg.type === 'double_quoted') {
          for (const part of seg.parts) {
            if (part.type === 'literal') result += part.value;
            else if (part.type === 'variable') result += this._expandVariable(part.name, env);
            else if (part.type === 'arith') result += evaluateArithmetic(part.expr, env, this.env);
            else if (part.type === 'subshell') result += await this._executeSubshell(part.command, env);
          }
        }
      }
      return result;
    }

    // Evaluate Word token to argument list (includes glob expansion against VFS)
    async evaluateWordToArgs(wordToken, env) {
      const raw = await this.evaluateWord(wordToken, env);
      if (wordToken.hasWildcard) {
        return expandGlob(raw, this.cwd, this.vfs);
      }
      return [raw];
    }

    _expandVariable(name, env) {
      if (name === '?') return env['?'] !== undefined ? String(env['?']) : '0';
      if (name === '$') return '1';
      if (name === 'PWD') return this.cwd;
      if (name === 'OLDPWD') return env.OLDPWD || this.cwd;

      if (name.startsWith('#') && name.length > 1) {
        const k = name.slice(1);
        const val = env[k] !== undefined ? String(env[k]) : '';
        return String(val.length);
      }

      // Handle parameter expansion defaults: ${VAR:=default}, ${VAR:-default}, ${VAR:+alt}, ${VAR-default}, ${VAR=default}
      if (name.includes(':=')) {
        const idx = name.indexOf(':=');
        const k = name.slice(0, idx);
        const def = name.slice(idx + 2);
        if (env[k] === undefined || env[k] === '') {
          env[k] = def;
          this.env[k] = def;
        }
        return String(env[k]);
      }
      if (name.includes(':-')) {
        const idx = name.indexOf(':-');
        const k = name.slice(0, idx);
        const def = name.slice(idx + 2);
        return (env[k] !== undefined && env[k] !== '') ? String(env[k]) : def;
      }
      if (name.includes(':+')) {
        const idx = name.indexOf(':+');
        const k = name.slice(0, idx);
        const alt = name.slice(idx + 2);
        return (env[k] !== undefined && env[k] !== '') ? alt : '';
      }
      if (name.includes('=')) {
        const idx = name.indexOf('=');
        const k = name.slice(0, idx);
        const def = name.slice(idx + 1);
        if (env[k] === undefined) {
          env[k] = def;
          this.env[k] = def;
        }
        return String(env[k]);
      }
      if (name.includes('-')) {
        const idx = name.indexOf('-');
        const k = name.slice(0, idx);
        const def = name.slice(idx + 1);
        return env[k] !== undefined ? String(env[k]) : def;
      }

      return env[name] !== undefined ? String(env[name]) : '';
    }

    async _executeSubshell(commandStr, env) {
      const subShell = new PosixShell({
        ...this.options,
        vfs: this.vfs,
        portTable: this.portTable,
        env: { ...env, PWD: this.cwd }
      });
      subShell.cwd = this.cwd;
      const res = await subShell.execute(commandStr);
      // POSIX removes trailing newlines from command substitution
      return res.stdout.replace(/\r?\n+$/, '');
    }

    // Main execute entrypoint
    async execute(commandLine, execOptions = {}) {
      const trimmed = (commandLine || '').trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return { code: 0, exitCode: 0, stdout: '', stderr: '', ok: true };
      }

      this.history.push(trimmed);

      const cwd = execOptions.cwd ? this.resolvePath(execOptions.cwd) : this.cwd;
      this.cwd = cwd;
      this.env.PWD = cwd;

      let currentEnv = Object.assign({}, this.env, execOptions.env || {});
      const ast = parseShellCommand(trimmed);
      let combinedStdout = '';
      let combinedStderr = '';
      let lastCode = 0;

      for (const item of ast.items) {
        if (execOptions.signal && execOptions.signal.aborted) {
          return { code: 130, exitCode: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
        }
        if (item.background) {
          const pid = this.nextPid++;
          const jobId = this.nextJobId++;
          const job = {
            id: jobId,
            pid,
            command: trimmed,
            status: 'Running',
            startTime: Date.now()
          };
          this.jobs.set(jobId, job);
          if (typeof this.options.onJobStart === 'function') this.options.onJobStart(job);

          // Run in background promise
          this._executeAstNode(item.node, { ...execOptions, env: Object.assign({}, this.env, currentEnv), cwd: this.cwd, pid, isBackground: true })
            .then(res => {
              if (job.status !== 'Terminated') {
                job.status = 'Done';
                job.exitCode = res.code;
                if (typeof this.options.onJobEnd === 'function') this.options.onJobEnd(job);
              }
            })
            .catch(err => {
              if (job.status !== 'Terminated') {
                job.status = 'Failed';
                job.error = err;
                if (typeof this.options.onJobEnd === 'function') this.options.onJobEnd(job);
              }
            });

          const bgMsg = `[${jobId}] ${pid}\n`;
          combinedStdout += bgMsg;
          lastCode = 0;
          if (execOptions.onStdout) execOptions.onStdout(bgMsg);
        } else {
          const runContext = { ...execOptions, env: Object.assign({}, this.env, currentEnv), cwd: this.cwd };
          const res = await this._executeAstNode(item.node, runContext);
          combinedStdout += res.stdout || '';
          combinedStderr += res.stderr || '';
          lastCode = res.code !== undefined ? res.code : 0;
          this.env['?'] = String(lastCode);
          Object.assign(currentEnv, this.env);
          if (res.aborted || (execOptions.signal && execOptions.signal.aborted)) {
            return { code: 130, exitCode: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
          }
        }
      }

      return { code: lastCode, exitCode: lastCode, stdout: combinedStdout, stderr: combinedStderr, ok: lastCode === 0 };
    }

    async _executeWithRedirects(redirects, context, execFn) {
      if (!redirects || redirects.length === 0) {
        return execFn(context);
      }

      const cmdEnv = Object.assign({}, this.env, context.env);
      let fd1 = { type: 'stdout' };
      let fd2 = { type: 'stderr' };
      let effectiveStdin = context.stdin || '';

      for (const red of redirects) {
        if (red.type === '<') {
          const target = await this.evaluateWord(red.target, cmdEnv);
          const absTarget = this.resolvePath(target);
          if (!this.vfs.existsSync(absTarget)) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: No such file or directory\n` };
          }
          try {
            effectiveStdin = this.vfs.readFileSync(absTarget, 'utf8');
          } catch (err) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: ${err.message}\n` };
          }
        }
      }

      for (const red of redirects) {
        if (red.type === '<') continue;
        if (red.type === '>' || red.type === '>>' || red.type === '&>') {
          const target = await this.evaluateWord(red.target, cmdEnv);
          const abs = this.resolvePath(target);
          const parentDir = PosixPath.dirname(abs);
          if (!this.vfs.existsSync(parentDir)) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: No such file or directory\n` };
          }
          if (red.type === '>') {
            this.vfs.writeFileSync(abs, '');
            this._emitVfsMutation('create', abs);
            const dest = { type: 'file', path: abs, append: true };
            if (red.sourceFd === 2) fd2 = dest;
            else fd1 = dest;
          } else if (red.type === '>>') {
            if (!this.vfs.existsSync(abs)) {
              this.vfs.writeFileSync(abs, '');
              this._emitVfsMutation('create', abs);
            }
            const dest = { type: 'file', path: abs, append: true };
            if (red.sourceFd === 2) fd2 = dest;
            else fd1 = dest;
          } else if (red.type === '&>') {
            this.vfs.writeFileSync(abs, '');
            this._emitVfsMutation('create', abs);
            const dest = { type: 'file', path: abs, append: true };
            fd1 = dest;
            fd2 = dest;
          }
        } else if (red.type === '>&') {
          if (red.sourceFd === 2 && red.targetFd === 1) fd2 = { ...fd1 };
          else if (red.sourceFd === 1 && red.targetFd === 2) fd1 = { ...fd2 };
        }
      }

      let finalStdout = '';
      let finalStderr = '';

      const routeChunk = (fd, text) => {
        if (!text) return;
        if (fd.type === 'stdout') {
          finalStdout += text;
          if (context.onStdout) context.onStdout(text);
        } else if (fd.type === 'stderr') {
          finalStderr += text;
          if (context.onStderr) context.onStderr(text);
        } else if (fd.type === 'file') {
          this.vfs.appendFileSync(fd.path, text);
          this._emitVfsMutation('change', fd.path);
        }
      };

      const childContext = {
        ...context,
        stdin: effectiveStdin,
        onStdout: (c) => routeChunk(fd1, c),
        onStderr: (c) => routeChunk(fd2, c)
      };

      const res = await execFn(childContext);
      return {
        ...res,
        stdout: finalStdout,
        stderr: finalStderr
      };
    }

    async _executeAstNode(node, context) {
      if (!node) return { code: 0, stdout: '', stderr: '' };
      if (context.signal && context.signal.aborted) {
        return { code: 130, stdout: '', stderr: '', aborted: true };
      }

      // 1. Sequence
      if (node.type === 'Sequence') {
        let combinedStdout = '';
        let combinedStderr = '';
        let lastCode = 0;
        let controlFlow = null;

        for (const item of (node.items || [])) {
          if (context.signal && context.signal.aborted) {
            return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
          }
          if (item.background) {
            const pid = this.nextPid++;
            const jobId = this.nextJobId++;
            const job = {
              id: jobId,
              pid,
              command: 'background',
              status: 'Running',
              startTime: Date.now()
            };
            this.jobs.set(jobId, job);
            if (typeof this.options.onJobStart === 'function') this.options.onJobStart(job);

            this._executeAstNode(item.node, { ...context, pid, isBackground: true })
              .then(res => {
                if (job.status !== 'Terminated') {
                  job.status = 'Done';
                  job.exitCode = res.code;
                  if (typeof this.options.onJobEnd === 'function') this.options.onJobEnd(job);
                }
              })
              .catch(err => {
                if (job.status !== 'Terminated') {
                  job.status = 'Failed';
                  job.error = err;
                  if (typeof this.options.onJobEnd === 'function') this.options.onJobEnd(job);
                }
              });

            const bgMsg = `[${jobId}] ${pid}\n`;
            combinedStdout += bgMsg;
            lastCode = 0;
            if (context.onStdout) context.onStdout(bgMsg);
          } else {
            const res = await this._executeAstNode(item.node, context);
            combinedStdout += res.stdout || '';
            combinedStderr += res.stderr || '';
            lastCode = res.code !== undefined ? res.code : 0;
            this.env['?'] = String(lastCode);
            if (context.env) context.env['?'] = String(lastCode);
            if (res.controlFlow) {
              controlFlow = res.controlFlow;
              break;
            }
            if (res.aborted || (context.signal && context.signal.aborted)) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
          }
        }
        return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow };
      }

      // 2. Logical (&&, ||)
      if (node.type === 'Logical') {
        const leftRes = await this._executeAstNode(node.left, context);
        if (leftRes.aborted || (context.signal && context.signal.aborted)) {
          return { ...leftRes, code: 130, aborted: true };
        }
        if (leftRes.controlFlow) return leftRes;
        if (node.op === '&&') {
          if (leftRes.code === 0) {
            const nextContext = {
              ...context,
              cwd: this.cwd,
              env: Object.assign({}, this.env)
            };
            const rightRes = await this._executeAstNode(node.right, nextContext);
            return {
              code: rightRes.code,
              stdout: (leftRes.stdout || '') + (rightRes.stdout || ''),
              stderr: (leftRes.stderr || '') + (rightRes.stderr || ''),
              controlFlow: rightRes.controlFlow,
              aborted: rightRes.aborted
            };
          }
          return leftRes;
        } else if (node.op === '||') {
          if (leftRes.code !== 0) {
            const nextContext = {
              ...context,
              cwd: this.cwd,
              env: Object.assign({}, this.env)
            };
            const rightRes = await this._executeAstNode(node.right, nextContext);
            return {
              code: rightRes.code,
              stdout: (leftRes.stdout || '') + (rightRes.stdout || ''),
              stderr: (leftRes.stderr || '') + (rightRes.stderr || ''),
              controlFlow: rightRes.controlFlow,
              aborted: rightRes.aborted
            };
          }
          return leftRes;
        }
      }

      // 3. Pipeline (|)
      if (node.type === 'Pipeline') {
        return this._executePipeline(node, context);
      }

      // 4. Command
      if (node.type === 'Command') {
        return this._executeSimpleCommand(node, context);
      }

      // 5. FunctionDef
      if (node.type === 'FunctionDef') {
        if (!this.functions) this.functions = {};
        this.functions[node.name] = node;
        return { code: 0, stdout: '', stderr: '' };
      }

      // 6. For loop
      if (node.type === 'For') {
        return this._executeWithRedirects(node.redirects, context, async (innerCtx) => {
          let combinedStdout = '';
          let combinedStderr = '';
          let lastCode = 0;
          const wordItems = [];
          if (node.items) {
            for (const itemTok of node.items) {
              const expanded = await this.evaluateWordToArgs(itemTok, innerCtx.env);
              wordItems.push(...expanded);
            }
          } else {
            wordItems.push(...(innerCtx.positionalArgs || []));
          }

          for (const val of wordItems) {
            if (innerCtx.signal && innerCtx.signal.aborted) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            innerCtx.env[node.varName] = val;
            this.env[node.varName] = val;
            const stepRes = await this._executeAstNode(node.body, innerCtx);
            combinedStdout += stepRes.stdout || '';
            combinedStderr += stepRes.stderr || '';
            lastCode = stepRes.code !== undefined ? stepRes.code : 0;
            this.env['?'] = String(lastCode);
            if (innerCtx.env) innerCtx.env['?'] = String(lastCode);
            if (stepRes.aborted || (innerCtx.signal && innerCtx.signal.aborted)) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            if (stepRes.controlFlow) {
              if (stepRes.controlFlow.type === 'break') {
                const count = stepRes.controlFlow.count || 1;
                if (count > 1) {
                  return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow: { type: 'break', count: count - 1 } };
                }
                break;
              } else if (stepRes.controlFlow.type === 'continue') {
                const count = stepRes.controlFlow.count || 1;
                if (count > 1) {
                  return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow: { type: 'continue', count: count - 1 } };
                }
                continue;
              } else {
                return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow: stepRes.controlFlow };
              }
            }
          }
          return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr };
        });
      }

      // 7. While & Until loops
      if (node.type === 'While' || node.type === 'Until') {
        return this._executeWithRedirects(node.redirects, context, async (innerCtx) => {
          const isWhile = node.type === 'While';
          let combinedStdout = '';
          let combinedStderr = '';
          let lastCode = 0;

          while (true) {
            if (innerCtx.signal && innerCtx.signal.aborted) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            const condRes = await this._executeAstNode(node.cond, innerCtx);
            combinedStdout += condRes.stdout || '';
            combinedStderr += condRes.stderr || '';
            if (condRes.aborted || (innerCtx.signal && innerCtx.signal.aborted)) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            if (condRes.controlFlow) {
              return { code: condRes.code, stdout: combinedStdout, stderr: combinedStderr, controlFlow: condRes.controlFlow };
            }
            const condSuccess = (condRes.code === 0);
            if (isWhile ? !condSuccess : condSuccess) {
              break;
            }
            if (innerCtx.signal && innerCtx.signal.aborted) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            const bodyRes = await this._executeAstNode(node.body, innerCtx);
            combinedStdout += bodyRes.stdout || '';
            combinedStderr += bodyRes.stderr || '';
            lastCode = bodyRes.code !== undefined ? bodyRes.code : 0;
            this.env['?'] = String(lastCode);
            if (innerCtx.env) innerCtx.env['?'] = String(lastCode);
            if (bodyRes.aborted || (innerCtx.signal && innerCtx.signal.aborted)) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            if (bodyRes.controlFlow) {
              if (bodyRes.controlFlow.type === 'break') {
                const count = bodyRes.controlFlow.count || 1;
                if (count > 1) {
                  return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow: { type: 'break', count: count - 1 } };
                }
                break;
              } else if (bodyRes.controlFlow.type === 'continue') {
                const count = bodyRes.controlFlow.count || 1;
                if (count > 1) {
                  return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow: { type: 'continue', count: count - 1 } };
                }
                continue;
              } else {
                return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr, controlFlow: bodyRes.controlFlow };
              }
            }
          }
          return { code: lastCode, stdout: combinedStdout, stderr: combinedStderr };
        });
      }

      // 8. If conditional
      if (node.type === 'If') {
        return this._executeWithRedirects(node.redirects, context, async (innerCtx) => {
          let combinedStdout = '';
          let combinedStderr = '';
          for (const branch of (node.branches || [])) {
            if (innerCtx.signal && innerCtx.signal.aborted) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            const condRes = await this._executeAstNode(branch.cond, innerCtx);
            combinedStdout += condRes.stdout || '';
            combinedStderr += condRes.stderr || '';
            if (condRes.aborted || (innerCtx.signal && innerCtx.signal.aborted)) {
              return { code: 130, stdout: combinedStdout, stderr: combinedStderr, aborted: true };
            }
            if (condRes.code === 0) {
              const bodyRes = await this._executeAstNode(branch.body, innerCtx);
              combinedStdout += bodyRes.stdout || '';
              combinedStderr += bodyRes.stderr || '';
              return {
                code: bodyRes.code,
                stdout: combinedStdout,
                stderr: combinedStderr,
                controlFlow: bodyRes.controlFlow,
                aborted: bodyRes.aborted
              };
            }
          }
          if (node.elseBody) {
            const elseRes = await this._executeAstNode(node.elseBody, innerCtx);
            combinedStdout += elseRes.stdout || '';
            combinedStderr += elseRes.stderr || '';
            return {
              code: elseRes.code,
              stdout: combinedStdout,
              stderr: combinedStderr,
              controlFlow: elseRes.controlFlow,
              aborted: elseRes.aborted
            };
          }
          return { code: 0, stdout: combinedStdout, stderr: combinedStderr };
        });
      }

      // 9. Brace Group
      if (node.type === 'BraceGroup') {
        return this._executeWithRedirects(node.redirects, context, (innerCtx) => {
          return this._executeAstNode(node.body, innerCtx);
        });
      }

      // 10. Subshell
      if (node.type === 'Subshell') {
        return this._executeWithRedirects(node.redirects, context, async (innerCtx) => {
          const subShell = new PosixShell({
            ...this.options,
            vfs: this.vfs,
            portTable: this.portTable,
            env: Object.assign({}, this.env, innerCtx.env || {})
          });
          subShell.cwd = innerCtx.cwd || this.cwd;
          const subContext = {
            ...innerCtx,
            env: Object.assign({}, this.env, innerCtx.env || {}),
            cwd: subShell.cwd
          };
          return subShell._executeAstNode(node.body, subContext);
        });
      }

      // 11. Case statement
      if (node.type === 'Case') {
        return this._executeWithRedirects(node.redirects, context, async (innerCtx) => {
          const targetWord = await this.evaluateWord(node.word, innerCtx.env);
          for (const clause of (node.clauses || [])) {
            let matched = false;
            for (const patTok of (clause.patterns || [])) {
              const patStr = await this.evaluateWord(patTok, innerCtx.env);
              if (patStr === '*' || patStr === targetWord) {
                matched = true;
                break;
              }
              const reg = new RegExp('^' + patStr.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
              if (reg.test(targetWord)) {
                matched = true;
                break;
              }
            }
            if (matched) {
              return this._executeAstNode(clause.body, innerCtx);
            }
          }
          return { code: 0, stdout: '', stderr: '' };
        });
      }

      return { code: 0, stdout: '', stderr: '' };
    }

    async _executePipeline(pipelineNode, context) {
      const commands = pipelineNode.commands || [];
      let currentStdin = context.stdin || '';
      let combinedStderr = '';
      let lastResult = { code: 0, stdout: '', stderr: '' };

      for (let i = 0; i < commands.length; i++) {
        if (context.signal && context.signal.aborted) {
          return {
            code: 130,
            stdout: lastResult.stdout || '',
            stderr: combinedStderr,
            aborted: true
          };
        }

        const cmd = commands[i];
        const isLast = (i === commands.length - 1);

        const cmdContext = {
          ...context,
          stdin: currentStdin,
          // Only forward to external onStdout if it's the last command and not redirected
          onStdout: isLast ? context.onStdout : null,
          onStderr: context.onStderr
        };

        const res = await this._executeAstNode(cmd, cmdContext);
        currentStdin = res.stdout || '';
        combinedStderr += (res.stderr || '');
        lastResult = res;

        if (res.aborted || (context.signal && context.signal.aborted)) {
          return {
            code: 130,
            stdout: lastResult.stdout || '',
            stderr: combinedStderr,
            aborted: true
          };
        }
      }

      let finalCode = lastResult.code !== undefined ? lastResult.code : 0;
      if (pipelineNode.negated && !lastResult.aborted) {
        finalCode = (finalCode === 0) ? 1 : 0;
      }

      return {
        code: finalCode,
        stdout: lastResult.stdout || '',
        stderr: combinedStderr,
        controlFlow: lastResult.controlFlow,
        aborted: Boolean(lastResult.aborted || (context.signal && context.signal.aborted))
      };
    }

    async _executeSimpleCommand(cmdNode, context) {
      // 1. Process local environment assignments
      const cmdEnv = Object.assign({}, this.env, context.env);
      for (const envAssign of cmdNode.envVars) {
        const val = await this.evaluateWord(envAssign.token, cmdEnv);
        const eqIdx = val.indexOf('=');
        if (eqIdx !== -1) {
          const k = val.slice(0, eqIdx);
          const v = val.slice(eqIdx + 1);
          cmdEnv[k] = v;
          if (!cmdNode.name) {
            this.env[k] = v; // persistent if assignment-only
            context.env[k] = v;
          }
        }
      }

      if (!cmdNode.name) {
        Object.assign(context.env, this.env);
        return { code: 0, stdout: '', stderr: '' };
      }

      // 2. Evaluate command name and arguments
      const cmdName = await this.evaluateWord(cmdNode.name, cmdEnv);
      const args = [];
      for (const argToken of cmdNode.args) {
        const expanded = await this.evaluateWordToArgs(argToken, cmdEnv);
        args.push(...expanded);
      }

      // 3. Built-in flow control
      if (cmdName === 'break') {
        const count = parseInt(args[0], 10) || 1;
        return { code: 0, stdout: '', stderr: '', controlFlow: { type: 'break', count } };
      }
      if (cmdName === 'continue') {
        const count = parseInt(args[0], 10) || 1;
        return { code: 0, stdout: '', stderr: '', controlFlow: { type: 'continue', count } };
      }
      if (cmdName === 'return') {
        const code = parseInt(args[0], 10) || 0;
        return { code, stdout: '', stderr: '', controlFlow: { type: 'return', code } };
      }

      if (context.signal && context.signal.aborted) {
        return { code: 130, stdout: '', stderr: '', aborted: true };
      }

      // 4. Process input redirection (<, 0<)
      let effectiveStdin = context.stdin || '';
      for (const red of cmdNode.redirects) {
        if (red.type === '<') {
          const target = await this.evaluateWord(red.target, cmdEnv);
          const absTarget = this.resolvePath(target);
          if (!this.vfs.existsSync(absTarget)) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: No such file or directory\n` };
          }
          try {
            effectiveStdin = this.vfs.readFileSync(absTarget, 'utf8');
          } catch (err) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: ${err.message}\n` };
          }
        }
      }

      // 5. Validate output redirections and setup file descriptors
      let fd1 = { type: 'stdout' };
      let fd2 = { type: 'stderr' };

      for (const red of cmdNode.redirects) {
        if (red.type === '<') continue;
        if (red.type === '>' || red.type === '>>' || red.type === '&>') {
          const target = await this.evaluateWord(red.target, cmdEnv);
          const abs = this.resolvePath(target);
          const parentDir = PosixPath.dirname(abs);
          if (!this.vfs.existsSync(parentDir)) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: No such file or directory\n` };
          }
          const parentSt = this.vfs.statSync(parentDir);
          if (!parentSt.isDirectory()) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: Not a directory\n` };
          }
          if (this.vfs.existsSync(abs) && this.vfs.statSync(abs).isDirectory()) {
            return { code: 1, stdout: '', stderr: `shell: ${target}: Is a directory\n` };
          }

          if (red.type === '>') {
            this.vfs.writeFileSync(abs, '');
            this._emitVfsMutation('create', abs);
            const dest = { type: 'file', path: abs, append: true };
            if (red.sourceFd === 2) {
              fd2 = dest;
            } else {
              fd1 = dest;
            }
          } else if (red.type === '>>') {
            if (!this.vfs.existsSync(abs)) {
              this.vfs.writeFileSync(abs, '');
              this._emitVfsMutation('create', abs);
            }
            const dest = { type: 'file', path: abs, append: true };
            if (red.sourceFd === 2) {
              fd2 = dest;
            } else {
              fd1 = dest;
            }
          } else if (red.type === '&>') {
            this.vfs.writeFileSync(abs, '');
            this._emitVfsMutation('create', abs);
            const dest = { type: 'file', path: abs, append: true };
            fd1 = dest;
            fd2 = dest;
          }
        } else if (red.type === '>&') {
          if (red.sourceFd === 2 && red.targetFd === 1) {
            fd2 = { ...fd1 };
          } else if (red.sourceFd === 1 && red.targetFd === 2) {
            fd1 = { ...fd2 };
          }
        }
      }

      // 6. Setup output routing with stream tracking
      let stdoutOut = '';
      let stderrOut = '';
      let streamedStdoutBytes = 0;
      let streamedStderrBytes = 0;

      const routeOutput = (fd, text, isStreamChunk = false) => {
        if (!text) return;
        if (fd.type === 'stdout') {
          stdoutOut += text;
          if (isStreamChunk && context.onStdout) context.onStdout(text);
        } else if (fd.type === 'stderr') {
          stderrOut += text;
          if (isStreamChunk && context.onStderr) context.onStderr(text);
        } else if (fd.type === 'file') {
          this.vfs.appendFileSync(fd.path, text);
          this._emitVfsMutation('change', fd.path);
        }
      };

      const cmdCtx = {
        vfs: this.vfs,
        shell: this,
        portTable: this.portTable,
        cwd: this.cwd,
        env: cmdEnv,
        stdin: effectiveStdin,
        pid: context.pid || 1000,
        isBackground: Boolean(context.isBackground),
        resolvePath: (p) => this.resolvePath(p),
        emitMutation: (type, p) => this._emitVfsMutation(type, p),
        signal: context.signal,
        onStdout: (chunk) => {
          if (!chunk) return;
          streamedStdoutBytes += chunk.length;
          routeOutput(fd1, chunk, true);
        },
        onStderr: (chunk) => {
          if (!chunk) return;
          streamedStderrBytes += chunk.length;
          routeOutput(fd2, chunk, true);
        }
      };

      // 7. Command execution dispatch
      let res;
      if (this.functions && this.functions[cmdName]) {
        const fnDef = this.functions[cmdName];
        const fnEnv = Object.assign({}, cmdEnv);
        args.forEach((a, i) => { fnEnv[String(i + 1)] = a; });
        fnEnv['#'] = String(args.length);
        fnEnv['@'] = args.join(' ');
        fnEnv['*'] = args.join(' ');
        const fnRes = await this._executeAstNode(fnDef.body, { ...context, env: fnEnv, positionalArgs: args });
        res = {
          code: fnRes.controlFlow?.type === 'return' ? fnRes.controlFlow.code : (fnRes.code || 0),
          stdout: fnRes.stdout || '',
          stderr: fnRes.stderr || ''
        };
      } else if (this.commands[cmdName]) {
        res = await this.commands[cmdName](args, cmdCtx);
        if (cmdName === 'export' || cmdName === 'unset' || cmdName === 'cd') {
          for (const k of Object.keys(context.env)) {
            if (!(k in this.env)) delete context.env[k];
          }
          Object.assign(context.env, this.env);
          context.cwd = this.cwd;
        }
      } else if (typeof this.options.onProcessSpawn === 'function') {
        const spawned = await this.options.onProcessSpawn(cmdName, args, {
          cwd: this.cwd,
          env: cmdEnv,
          stdin: effectiveStdin,
          onStdout: cmdCtx.onStdout,
          onStderr: cmdCtx.onStderr,
          signal: context.signal
        });
        if (spawned !== undefined && spawned !== null) {
          res = spawned;
        } else {
          res = { code: 127, stdout: '', stderr: `shell: ${cmdName}: command not found\n` };
        }
      } else {
        res = { code: 127, stdout: '', stderr: `shell: ${cmdName}: command not found\n` };
      }

      if (!res) res = { code: 0, stdout: '', stderr: '' };

      // Route any remaining unstreamed output
      if (res.stdout) {
        if (streamedStdoutBytes > 0) {
          if (res.stdout.length > streamedStdoutBytes) {
            routeOutput(fd1, res.stdout.slice(streamedStdoutBytes), true);
          }
        } else {
          routeOutput(fd1, res.stdout, false);
          if (context.onStdout && stdoutOut) context.onStdout(stdoutOut);
        }
      }
      if (res.stderr) {
        if (streamedStderrBytes > 0) {
          if (res.stderr.length > streamedStderrBytes) {
            routeOutput(fd2, res.stderr.slice(streamedStderrBytes), true);
          }
        } else {
          routeOutput(fd2, res.stderr, false);
          if (context.onStderr && stderrOut) context.onStderr(stderrOut);
        }
      }

      return {
        code: res.code !== undefined ? res.code : 0,
        stdout: stdoutOut,
        stderr: stderrOut,
        controlFlow: res.controlFlow,
        aborted: res.aborted || (context.signal && context.signal.aborted)
      };
    }
  }

  function createPosixShell(options = {}) {
    return new PosixShell(options);
  }

  // Return public API
  return {
    createPosixShell,
    parseShellCommand,
    tokenizeShell,
    PosixShell,
    COREUTILS,
    PosixPath,
    expandGlob,
    createVirtualPortTable,
    parseGitHubRepoUrl,
    cloneGitHubRepository
  };

}

const _hostShell: any = __initShellModule(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof globalThis !== 'undefined') {
  (globalThis as any).CodeLabShell = _hostShell;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _hostShell;
}

export const createPosixShell: (options?: any) => any = _hostShell.createPosixShell;
export const parseShellCommand: (cmd: string) => any = _hostShell.parseShellCommand;
export const tokenizeShell: (input: string) => any[] = _hostShell.tokenizeShell;
export const PosixShell: any = _hostShell.PosixShell;
export const COREUTILS: Record<string, any> = _hostShell.COREUTILS;
export const PosixPath: any = _hostShell.PosixPath;
export const expandGlob: (pattern: string, vfs: any, cwd?: string) => string[] = _hostShell.expandGlob;
export const createVirtualPortTable: () => any = _hostShell.createVirtualPortTable;
export const parseGitHubRepoUrl: (input: string) => any = _hostShell.parseGitHubRepoUrl;
export const cloneGitHubRepository: (repoInput: string, vfs: any, options?: GitHubCloneOptions) => Promise<CloneResult> = _hostShell.cloneGitHubRepository;
export const CodeLabShell: any = _hostShell;

export default _hostShell;
