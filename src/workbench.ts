// @ts-nocheck
/* ═══════════════════════════════════════════════════════════════════════════
   @innovatorved/code-lab — Interactive Monaco IDE Workbench & Guided Lab UI
   Supports <code-lab> Custom Element + window.CodeLab.mount() API
   ═══════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  const _sharedLoggerMod = (typeof CodeLabLogger !== 'undefined' && CodeLabLogger) ||
    (root && root.CodeLabLogger) ||
    null;
  const _bootDebug = (_sharedLoggerMod && _sharedLoggerMod.DEFAULT_LOGGER && typeof _sharedLoggerMod.DEFAULT_LOGGER.debug === 'function')
    ? (...args) => _sharedLoggerMod.DEFAULT_LOGGER.debug(...args)
    : () => {};

  let terminalModule = (root && root.CodeLabTerminal) || null;
  let shellModule = (root && root.CodeLabShell) || null;
  let runtimeModule = (root && root.CodeLabRuntime) || null;
  if (typeof require === 'function') {
    if (!terminalModule) {
      try { terminalModule = require('./terminal.js'); } catch (err) { _bootDebug('optional terminal.js require failed', err); }
    }
    if (!shellModule) {
      try { shellModule = require('./shell.js'); } catch (err) { _bootDebug('optional shell.js require failed', err); }
    }
    if (!runtimeModule) {
      try { runtimeModule = require('./runtime.js'); } catch (err) { _bootDebug('optional runtime.js require failed', err); }
    }
  }
  const CodeLabTerminal = (root && root.CodeLabTerminal) || terminalModule || {};
  const CodeLabShell = (root && root.CodeLabShell) || shellModule || {};
  let _cachedModularModule = null;
  const getModular = () => {
    if (typeof CodeLabModular !== 'undefined' && CodeLabModular) return CodeLabModular;
    if (root && root.CodeLabModular) return root.CodeLabModular;
    if (_cachedModularModule) return _cachedModularModule;
    if (typeof require === 'function') {
      try {
        _cachedModularModule = require('./modular-kernel');
        return _cachedModularModule;
      } catch (err) {
        void err;
      }
      try {
        _cachedModularModule = require('./modular-kernel.js');
        return _cachedModularModule;
      } catch (err) {
        void err;
      }
    }
    return null;
  };
  const getSqlPack = () =>
    (typeof CodeLabSql !== 'undefined' && CodeLabSql) ||
    (root && (root.CodeLabSql || (root.CodeLab && (root.CodeLab.sql || root.CodeLab.CodeLabSql)))) ||
    getModular() ||
    null;
  const createPTYTerminalEngine = CodeLabTerminal.createPTYTerminalEngine || CodeLabTerminal.createTerminal || CodeLabTerminal.PTYTerminalEngine || (root && (root.createPTYTerminalEngine || root.PTYTerminalEngine));
  const ansiToHtml = CodeLabTerminal.parseAnsiToHtml || CodeLabTerminal.ansiToHtml || (root && (root.parseAnsiToHtml || root.ansiToHtml));
  const createPosixShell = CodeLabShell.createPosixShell || (root && root.createPosixShell);
  const parseGitHubRepoUrl = CodeLabShell.parseGitHubRepoUrl || (root && root.parseGitHubRepoUrl);
  const cloneGitHubRepository = CodeLabShell.cloneGitHubRepository || (root && root.cloneGitHubRepository);
  const createVirtualPortTable = (root && root.createVirtualPortTable) ||
    (root && root.CodeLabRuntime && root.CodeLabRuntime.createVirtualPortTable) ||
    (shellModule && shellModule.createVirtualPortTable) ||
    (runtimeModule && runtimeModule.createVirtualPortTable) || null;

  function findCommonPrefix(arr) {
    if (!arr || arr.length === 0) return '';
    let prefix = arr[0];
    for (let i = 1; i < arr.length; i++) {
      while (!arr[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }

  const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs';
  const STORAGE_PREFIX = 'sd-codelab-v1:';

  // The bundler rewrites this literal from package.json at build time. Keeping
  // the fallback in sync lets tests require src/workbench.js directly.
  const CODELAB_VERSION = '0.4.0';

  // Ambient TypeScript declarations for Node.js built-ins inside Monaco
  const NODE_AMBIENT_DTS = `
declare var require: (id: string) => any;
declare var module: { exports: any };
declare var exports: any;
declare var __dirname: string;
declare var __filename: string;
declare var process: {
  env: Record<string, string | undefined>;
  argv: string[];
  version: string;
  versions: Record<string, string>;
  platform: string;
  arch: string;
  pid: number;
  cwd(): string;
  hrtime: { (time?: [number, number]): [number, number]; bigint(): bigint };
  nextTick(cb: (...args: any[]) => void, ...args: any[]): void;
  stdout: { write(chunk: any): boolean };
  stderr: { write(chunk: any): boolean };
};
declare class Buffer extends Uint8Array {
  static from(data: any, encoding?: string): Buffer;
  static alloc(size: number, fill?: any, encoding?: string): Buffer;
  static allocUnsafe(size: number): Buffer;
  static concat(list: Uint8Array[], totalLength?: number): Buffer;
  static isBuffer(obj: any): obj is Buffer;
  static byteLength(str: string | Uint8Array, encoding?: string): number;
  static compare(a: Uint8Array, b: Uint8Array): number;
  toString(encoding?: string, start?: number, end?: number): string;
  write(str: string, offset?: number, length?: number, encoding?: string): number;
  slice(start?: number, end?: number): Buffer;
  subarray(start?: number, end?: number): Buffer;
  equals(other: Uint8Array): boolean;
  copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  readUInt8(offset?: number): number;
  readUInt16BE(offset?: number): number;
  readUInt16LE(offset?: number): number;
  readUInt32BE(offset?: number): number;
  readUInt32LE(offset?: number): number;
  readInt32BE(offset?: number): number;
  readInt32LE(offset?: number): number;
  readBigUInt64BE(offset?: number): bigint;
  readBigInt64BE(offset?: number): bigint;
  writeUInt8(value: number, offset?: number): number;
  writeUInt16BE(value: number, offset?: number): number;
  writeUInt16LE(value: number, offset?: number): number;
  writeUInt32BE(value: number, offset?: number): number;
  writeUInt32LE(value: number, offset?: number): number;
  writeInt32BE(value: number, offset?: number): number;
  writeInt32LE(value: number, offset?: number): number;
  writeBigUInt64BE(value: bigint, offset?: number): number;
  writeBigInt64BE(value: bigint, offset?: number): number;
}
declare module 'node:test' {
  export function describe(name: string, fn: () => any): void;
  export function it(name: string, fn: () => any): void;
  export function test(name: string, fn: () => any): void;
  export function before(fn: () => any): void;
  export function after(fn: () => any): void;
  export function beforeEach(fn: () => any): void;
  export function afterEach(fn: () => any): void;
}
declare module 'test' { export * from 'node:test'; }
declare module 'node:assert' {
  function assert(value: any, message?: string | Error): void;
  namespace assert {
    function ok(value: any, message?: string | Error): void;
    function equal(actual: any, expected: any, message?: string | Error): void;
    function strictEqual(actual: any, expected: any, message?: string | Error): void;
    function notEqual(actual: any, expected: any, message?: string | Error): void;
    function notStrictEqual(actual: any, expected: any, message?: string | Error): void;
    function deepEqual(actual: any, expected: any, message?: string | Error): void;
    function deepStrictEqual(actual: any, expected: any, message?: string | Error): void;
    function throws(block: () => any, error?: any, message?: string): void;
    function doesNotThrow(block: () => any, error?: any, message?: string): void;
    function rejects(block: (() => Promise<any>) | Promise<any>, error?: any, message?: string): Promise<void>;
    function doesNotReject(block: (() => Promise<any>) | Promise<any>, error?: any, message?: string): Promise<void>;
    function match(string: string, regexp: RegExp, message?: string): void;
    function doesNotMatch(string: string, regexp: RegExp, message?: string): void;
    function fail(message?: string | Error): never;
  }
  export = assert;
}
declare module 'assert' { import assert = require('node:assert'); export = assert; }
declare module 'node:assert/strict' { import assert = require('node:assert'); export = assert; }
declare module 'assert/strict' { import assert = require('node:assert'); export = assert; }
declare module 'node:events' {
  export class EventEmitter {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    emit(event: string | symbol, ...args: any[]): boolean;
    listenerCount(event: string | symbol): number;
    listeners(event: string | symbol): Function[];
  }
  export default EventEmitter;
}
declare module 'events' { export * from 'node:events'; }
declare module 'node:crypto' {
  export function createHash(algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' | string): {
    update(data: string | Uint8Array): any;
    digest(encoding?: 'hex' | 'base64' | 'base64url'): any;
  };
  export function createHmac(algorithm: string, key: string | Uint8Array): {
    update(data: string | Uint8Array): any;
    digest(encoding?: 'hex' | 'base64' | 'base64url'): any;
  };
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
  export function randomUUID(): string;
  export function randomBytes(size: number): Buffer;
  export function randomInt(min: number, max?: number): number;
  export function pbkdf2Sync(password: any, salt: any, iterations: number, keylen: number, digest: string): Buffer;
  export function scryptSync(password: any, salt: any, keylen: number, options?: any): Buffer;
  export function createCipheriv(algorithm: string, key: any, iv: any): any;
  export function createDecipheriv(algorithm: string, key: any, iv: any): any;
}
declare module 'crypto' { export * from 'node:crypto'; }
declare module 'node:fs' {
  export function openSync(path: string, flags?: string): number;
  export function closeSync(fd: number): void;
  export function writeSync(fd: number, buffer: Uint8Array | string, offset?: number, length?: number, position?: number | null): number;
  export function readSync(fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null): number;
  export function fsyncSync(fd: number): void;
  export function fstatSync(fd: number): { size: number; isDirectory(): boolean; isFile(): boolean };
  export function statSync(path: string): { size: number; isDirectory(): boolean; isFile(): boolean };
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: any): void;
  export function mkdtempSync(prefix: string): string;
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, options?: any): any;
  export function writeFileSync(path: string, data: any, options?: any): void;
  export function appendFileSync(path: string, data: any, options?: any): void;
  export function copyFileSync(src: string, dest: string): void;
  export function truncateSync(path: string, len?: number): void;
  export function renameSync(oldPath: string, newPath: string): void;
  export function unlinkSync(path: string): void;
  export function rmSync(path: string, options?: any): void;
  export const promises: typeof import('node:fs/promises');
}
declare module 'fs' { export * from 'node:fs'; }
declare module 'node:fs/promises' {
  export function readFile(path: string, options?: any): Promise<any>;
  export function writeFile(path: string, data: any, options?: any): Promise<void>;
  export function appendFile(path: string, data: any, options?: any): Promise<void>;
  export function mkdir(path: string, options?: any): Promise<void>;
  export function readdir(path: string): Promise<string[]>;
  export function stat(path: string): Promise<{ size: number; isDirectory(): boolean; isFile(): boolean }>;
  export function unlink(path: string): Promise<void>;
  export function rm(path: string, options?: any): Promise<void>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
}
declare module 'fs/promises' { export * from 'node:fs/promises'; }
declare module 'node:path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function normalize(p: string): string;
  export function relative(from: string, to: string): string;
  export function isAbsolute(p: string): boolean;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function parse(p: string): { root: string; dir: string; base: string; ext: string; name: string };
  export function format(pObj: any): string;
  export const sep: string;
  export const delimiter: string;
}
declare module 'path' { export * from 'node:path'; }
declare module 'node:os' {
  export function tmpdir(): string;
  export function homedir(): string;
  export function hostname(): string;
  export function platform(): string;
  export function arch(): string;
  export function cpus(): any[];
  export const EOL: string;
}
declare module 'os' { export * from 'node:os'; }
declare module 'node:zlib' {
  export function crc32(data: string | Uint8Array, value?: number): number;
  export function gzipSync(buf: string | Uint8Array): Buffer;
  export function gunzipSync(buf: Uint8Array): Buffer;
  export function deflateSync(buf: string | Uint8Array): Buffer;
  export function inflateSync(buf: Uint8Array): Buffer;
}
declare module 'zlib' { export * from 'node:zlib'; }
declare module 'node:http' {
  export class Agent { constructor(opts?: any); destroy(): void; }
  export function createServer(handler: (req: any, res: any) => void): any;
  export function request(options: any, callback?: (res: any) => void): any;
  export function get(options: any, callback?: (res: any) => void): any;
}
declare module 'http' { export * from 'node:http'; }
declare module 'node:https' { export * from 'node:http'; }
declare module 'https' { export * from 'node:http'; }
declare module 'node:net' {
  export class Socket { constructor(opts?: any); connect(...args: any[]): this; write(data: any): boolean; end(data?: any): this; destroy(): this; on(ev: string, cb: (...args: any[]) => void): this; }
  export class Server { listen(...args: any[]): this; close(cb?: () => void): this; on(ev: string, cb: (...args: any[]) => void): this; address(): any; }
  export function createServer(fn?: (socket: Socket) => void): Server;
  export function createConnection(...args: any[]): Socket;
}
declare module 'net' { export * from 'node:net'; }
declare module 'node:stream' {
  import { EventEmitter } from 'node:events';
  export class Stream extends EventEmitter { pipe<T>(dest: T): T; }
  export class Readable extends Stream { constructor(opts?: any); push(chunk: any): boolean; read(size?: number): any; }
  export class Writable extends Stream { constructor(opts?: any); write(chunk: any, cb?: any): boolean; end(chunk?: any, cb?: any): this; }
  export class Duplex extends Readable { write(chunk: any, cb?: any): boolean; end(chunk?: any, cb?: any): this; }
  export class Transform extends Duplex {}
  export class PassThrough extends Transform {}
  export function pipeline(...streams: any[]): any;
}
declare module 'stream' { export * from 'node:stream'; }
declare module 'node:util' {
  export function format(fmt: any, ...args: any[]): string;
  export function inspect(obj: any, opts?: any): string;
  export function promisify(fn: Function): (...args: any[]) => Promise<any>;
  export function callbackify(fn: Function): (...args: any[]) => void;
  export function inherits(ctor: any, superCtor: any): void;
  export const types: Record<string, (val: any) => boolean>;
  export class TextEncoder { encode(input?: string): Uint8Array; }
  export class TextDecoder { decode(input?: Uint8Array): string; }
}
declare module 'util' { export * from 'node:util'; }
declare module 'node:url' {
  export { URL, URLSearchParams };
  export function parse(urlStr: string, parseQueryString?: boolean): any;
  export function format(urlObj: any): string;
}
declare module 'url' { export * from 'node:url'; }
declare module 'node:querystring' {
  export function parse(str: string): Record<string, any>;
  export function stringify(obj: Record<string, any>): string;
}
declare module 'querystring' { export * from 'node:querystring'; }
declare module 'node:perf_hooks' {
  export const performance: { now(): number; timeOrigin: number; mark(name: string): void; measure(name: string, start?: string, end?: string): void };
}
declare module 'perf_hooks' { export * from 'node:perf_hooks'; }
declare module 'node:timers' {
  export { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate };
}
declare module 'timers' { export * from 'node:timers'; }
declare module 'node:timers/promises' {
  export function setTimeout<T = void>(delay?: number, value?: T): Promise<T>;
  export function setImmediate<T = void>(value?: T): Promise<T>;
}
declare module 'timers/promises' { export * from 'node:timers/promises'; }
declare module 'node:string_decoder' {
  export class StringDecoder { constructor(encoding?: string); write(buf: Uint8Array): string; end(buf?: Uint8Array): string; }
}
declare module 'string_decoder' { export * from 'node:string_decoder'; }
declare module 'node:dns' {
  export function lookup(hostname: string, cb: (err: any, address: string, family: number) => void): void;
  export function resolve(hostname: string, cb: (err: any, records: string[]) => void): void;
}
declare module 'dns' { export * from 'node:dns'; }
declare module 'node:child_process' {
  export function execSync(cmd: string, opts?: any): Buffer | string;
  export function spawn(cmd: string, args?: string[], opts?: any): any;
}
declare module 'child_process' { export * from 'node:child_process'; }
declare module 'node:buffer' { export { Buffer }; }
declare module 'buffer' { export { Buffer }; }
declare const Bun: {
  version: string;
  revision: string;
  env: Record<string, string | undefined>;
  serve(options: { port?: number; hostname?: string; fetch(req: Request, server?: any): Response | Promise<Response>; error?(err: Error): Response | Promise<Response> }): { port: number; hostname: string; url: string; stop(closeActiveConnections?: boolean): void };
  file(path: string, options?: { type?: string }): { size: number; type: string; text(): Promise<string>; json(): Promise<any>; arrayBuffer(): Promise<ArrayBuffer>; bytes(): Promise<Uint8Array>; exists(): Promise<boolean> };
  write(dest: string | any, input: string | Uint8Array | ArrayBuffer | Response | any): Promise<number>;
  sleep(ms: number): Promise<void>;
  sleepSync(ms: number): void;
  hash(input: string | Uint8Array, seed?: number): number;
  deepEquals(a: any, b: any, strict?: boolean): boolean;
  inspect(val: any): string;
  nanoseconds(): number;
  which(bin: string): string | null;
  escapeHTML(str: string): string;
  stringWidth(str: string): number;
};
declare module 'bun' {
  export const version: string;
  export const env: Record<string, string | undefined>;
  export const serve: typeof Bun.serve;
  export const file: typeof Bun.file;
  export const write: typeof Bun.write;
  export const sleep: typeof Bun.sleep;
  export const sleepSync: typeof Bun.sleepSync;
  export const hash: typeof Bun.hash;
  export const deepEquals: typeof Bun.deepEquals;
  export const inspect: typeof Bun.inspect;
  export const nanoseconds: typeof Bun.nanoseconds;
  export const which: typeof Bun.which;
  export const escapeHTML: typeof Bun.escapeHTML;
  export const stringWidth: typeof Bun.stringWidth;
  export default Bun;
}
declare module 'bun:test' {
  export function test(name: string, fn: () => any, timeout?: number): Promise<void>;
  export function it(name: string, fn: () => any, timeout?: number): Promise<void>;
  export function describe(name: string, fn: () => void): void;
  export function beforeAll(fn: () => any): void;
  export function afterAll(fn: () => any): void;
  export function beforeEach(fn: () => any): void;
  export function afterEach(fn: () => any): void;
  export function expect(actual: any): any;
  export const mock: any;
  export const jest: any;
}
declare module 'bun:sqlite' {
  export class Database {
    constructor(filename?: string, options?: any);
    exec(sql: string): this;
    run(sql: string, ...params: any[]): { changes: number; lastInsertRowid: number };
    query(sql: string): { all(...params: any[]): any[]; get(...params: any[]): any; values(...params: any[]): any[][]; run(...params: any[]): { changes: number; lastInsertRowid: number } };
    prepare(sql: string): { all(...params: any[]): any[]; get(...params: any[]): any; values(...params: any[]): any[][]; run(...params: any[]): { changes: number; lastInsertRowid: number }; finalize(): void };
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }
  export default Database;
}
`;

  const _sharedHtmlMod = (typeof CodeLabHtml !== 'undefined' && CodeLabHtml) ||
    (root && root.CodeLabHtml) ||
    null;

  function escapeHtml(str) {
    if (_sharedHtmlMod && typeof _sharedHtmlMod.escapeHtml === 'function') {
      return _sharedHtmlMod.escapeHtml(str);
    }
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const isSafeHtml = (_sharedHtmlMod && _sharedHtmlMod.isSafeHtml) || ((v) => Boolean(v && typeof v === 'object' && typeof v.__html === 'string'));
  const raw = (_sharedHtmlMod && _sharedHtmlMod.raw) || ((trusted) => ({ __html: String(trusted), toString() { return this.__html; } }));
  const html = (_sharedHtmlMod && _sharedHtmlMod.html) || ((strings, ...values) => {
    let out = strings[0] || '';
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      out += (val == null || val === false) ? '' : (isSafeHtml(val) ? val.__html : escapeHtml(val));
      out += strings[i + 1] || '';
    }
    return raw(out);
  });

  // Schemes that may appear in a rendered href. Everything else
  // (javascript:, data:, vbscript:, blob:, file:, ...) becomes a dead link.
  const SAFE_LINK_SCHEMES = new Set(['http', 'https', 'mailto']);

  function sanitizeUrl(raw) {
    if (raw === null || raw === undefined) return '#';
    const trimmed = String(raw).trim();
    if (!trimmed) return '#';

    // Browsers ignore C0 controls and zero-width characters while resolving a
    // scheme, so `java\nscript:` and `java\u200Bscript:` still execute. Strip
    // them before deciding what the scheme is, but return the original value
    // when it is safe.
    const normalized = trimmed.replace(/[\u0000-\u0020\u007F\u200B-\u200D\uFEFF]/g, '');
    const schemeMatch = normalized.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);

    if (!schemeMatch) {
      // No scheme: a fragment, an absolute path, or a relative path.
      // Backslashes are treated as slashes by the URL parser and can turn a
      // "relative" URL into a protocol-relative one, so reject those.
      if (/^[\\/]{2}/.test(normalized) && !normalized.startsWith('/')) return '#';
      return trimmed;
    }

    return SAFE_LINK_SCHEMES.has(schemeMatch[1].toLowerCase()) ? trimmed : '#';
  }

  function formatErrorText(err) {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      const msg = err.message || err.name || '';
      const stack = err.stack || '';
      if (stack && (!msg || stack.includes(msg))) return String(stack);
      if (msg && stack) return `${msg}\n${stack}`;
      if (msg) return String(msg);
      try { return JSON.stringify(err, null, 2); } catch (_) { return String(err); }
    }
    return String(err);
  }

  function formatTestErrorHtml(err) {
    if (!err) return '';
    if (typeof err === 'string') {
      return `<div class="codelab-test-row__err">${escapeHtml(err)}</div>`;
    }
    const headline = err.message || err.name || 'Assertion failed';
    const hasDiff = err.expected !== undefined || err.actual !== undefined;
    const formatVal = v => {
      if (typeof v === 'string') return JSON.stringify(v);
      try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
    };
    const diffHtml = hasDiff ? `
      <div class="codelab-test-diff">
        ${err.expected !== undefined ? `<div class="codelab-test-diff__line codelab-test-diff__expected"><span class="codelab-test-diff__label">Expected ${err.operator ? `(${escapeHtml(err.operator)})` : ''}:</span> <code>${escapeHtml(formatVal(err.expected))}</code></div>` : ''}
        ${err.actual !== undefined ? `<div class="codelab-test-diff__line codelab-test-diff__actual"><span class="codelab-test-diff__label">Actual:</span> <code>${escapeHtml(formatVal(err.actual))}</code></div>` : ''}
      </div>
    ` : '';
    const stackLines = String(err.stack || '')
      .split('\n')
      .filter(l => l.trim() && !l.includes(headline))
      .slice(0, 4)
      .join('\n');
    return `
      <div class="codelab-test-row__err">
        <div class="codelab-test-row__err-msg">${escapeHtml(headline)}</div>
        ${diffHtml}
        ${stackLines ? `<div class="codelab-test-row__err-stack">${escapeHtml(stackLines)}</div>` : ''}
      </div>
    `;
  }

  const CALLOUT_META = {
    NOTE: {
      title: 'Note',
      cls: 'codelab-callout--note',
      svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    },
    TIP: {
      title: 'Tip',
      cls: 'codelab-callout--tip',
      svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>'
    },
    IMPORTANT: {
      title: 'Important',
      cls: 'codelab-callout--important',
      svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>'
    },
    WARNING: {
      title: 'Warning',
      cls: 'codelab-callout--warning',
      svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    },
    CAUTION: {
      title: 'Caution',
      cls: 'codelab-callout--caution',
      svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
    }
  };

  function highlightCode(code, lang) {
    if (!code) return '';
    const l = (lang || '').toLowerCase().trim();
    if (!['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx', 'mjs', 'cjs', 'json', 'sh', 'bash', 'shell', 'zsh'].includes(l)) {
      return escapeHtml(code);
    }

    if (['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx', 'mjs', 'cjs'].includes(l)) {
      const JS_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|try|catch|finally|async|await|typeof|instanceof|switch|case|default|break|continue|interface|type|enum|as|in|of)\b)|(\b(?:true|false|null|undefined|Promise|Set|Map|Array|Object|String|Number|Boolean|Error|console|process|document|window)\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b\d+(?:\.\d+)?\b)/g;
      let result = '';
      let lastIndex = 0;
      let match;
      while ((match = JS_RE.exec(code)) !== null) {
        result += escapeHtml(code.slice(lastIndex, match.index));
        const [m, comment, str, kw, type, fn, num] = match;
        if (comment) result += `<span class="cl-tok-comment">${escapeHtml(comment)}</span>`;
        else if (str) result += `<span class="cl-tok-string">${escapeHtml(str)}</span>`;
        else if (kw) result += `<span class="cl-tok-keyword">${escapeHtml(kw)}</span>`;
        else if (type) result += `<span class="cl-tok-type">${escapeHtml(type)}</span>`;
        else if (fn) result += `<span class="cl-tok-function">${escapeHtml(fn)}</span>`;
        else if (num) result += `<span class="cl-tok-number">${escapeHtml(num)}</span>`;
        else result += escapeHtml(m);
        lastIndex = JS_RE.lastIndex;
      }
      result += escapeHtml(code.slice(lastIndex));
      return result;
    }

    if (l === 'json') {
      const JSON_RE = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
      let result = '';
      let lastIndex = 0;
      let match;
      while ((match = JSON_RE.exec(code)) !== null) {
        result += escapeHtml(code.slice(lastIndex, match.index));
        const [m, str, isKey, bool] = match;
        if (str) {
          if (isKey) result += `<span class="cl-tok-type">${escapeHtml(str)}</span>:`;
          else result += `<span class="cl-tok-string">${escapeHtml(str)}</span>`;
        } else if (bool) {
          result += `<span class="cl-tok-keyword">${escapeHtml(bool)}</span>`;
        } else {
          result += `<span class="cl-tok-number">${escapeHtml(m)}</span>`;
        }
        lastIndex = JSON_RE.lastIndex;
      }
      result += escapeHtml(code.slice(lastIndex));
      return result;
    }

    if (['sh', 'bash', 'shell', 'zsh'].includes(l)) {
      const BASH_RE = /(#[^\n]*)|("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')|(\b(?:cd|ls|cat|mkdir|rm|cp|mv|echo|grep|find|curl|git|bun|node|npm|npx|deno|touch|chmod|chown|export)\b)|(-{1,2}[a-zA-Z0-9_-]+)/g;
      let result = '';
      let lastIndex = 0;
      let match;
      while ((match = BASH_RE.exec(code)) !== null) {
        result += escapeHtml(code.slice(lastIndex, match.index));
        const [m, comment, str, cmd, flag] = match;
        if (comment) result += `<span class="cl-tok-comment">${escapeHtml(comment)}</span>`;
        else if (str) result += `<span class="cl-tok-string">${escapeHtml(str)}</span>`;
        else if (cmd) result += `<span class="cl-tok-keyword">${escapeHtml(cmd)}</span>`;
        else if (flag) result += `<span class="cl-tok-number">${escapeHtml(flag)}</span>`;
        else result += escapeHtml(m);
        lastIndex = BASH_RE.lastIndex;
      }
      result += escapeHtml(code.slice(lastIndex));
      return result;
    }

    return escapeHtml(code);
  }

  function renderCodeBlock(code, lang) {
    const rawCode = (code || '').replace(/^\n+|\n+$/g, '');
    const highlighted = highlightCode(rawCode, lang);
    const langDisplay = (lang || 'TEXT').toUpperCase();
    const encodedRaw = encodeURIComponent(rawCode);

    return `<div class="codelab-code-block" data-cl-code="${encodedRaw}">` +
      `<div class="codelab-code-block__header">` +
        `<span class="codelab-code-block__lang">${escapeHtml(langDisplay)}</span>` +
        `<button type="button" class="codelab-copy-code-btn" data-cl-action="copy-code" title="Copy code to clipboard">` +
          `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
          `<span class="codelab-copy-code-btn__text">Copy</span>` +
        `</button>` +
      `</div>` +
      `<pre class="codelab-code-block__pre"><code class="codelab-code-block__code lang-${escapeHtml((lang || 'text').toLowerCase())}">${highlighted}</code></pre>` +
    `</div>`;
  }

  function splitTableRow(row) {
    const cells = [];
    let cur = '';
    let esc = false;
    const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (esc) {
        cur += c;
        esc = false;
      } else if (c === '\\') {
        esc = true;
      } else if (c === '|') {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    if (esc) cur += '\\';
    cells.push(cur.trim());
    return cells;
  }

  function renderInlineFormatting(str) {
    if (!str) return '';
    let text = String(str);

    // Markdown Links: [label](url "title") or [label](url) — stash anchors before emphasis regexes
    // so underscores/asterisks inside URLs or titles are not mangled, and use non-nested quantifiers.
    const inlineLinks = [];
    text = text.replace(/\[([^\]]+)\]\(([^\s()]+(?:\([^\s()]*\)[^\s()]*)*)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
      const cleanUrl = sanitizeUrl(url);
      const titleAttr = title ? raw(` title="${escapeHtml(title)}"`) : '';
      const formattedLabel = renderInlineFormatting(label);
      const idx = inlineLinks.length;
      inlineLinks.push(String(html`<a href="${cleanUrl}" class="codelab-link" target="_blank" rel="noopener noreferrer"${titleAttr}>${raw(formattedLabel)}</a>`));
      return `\x00CLLINK${idx}\x00`;
    });

    // Strikethrough: ~~del~~
    text = text.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');

    // Bold + Italic: ***text*** or ___text___
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');

    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ (ensure _ does not match inside words)
    text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    text = text.replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

    if (inlineLinks.length > 0) {
      text = text.replace(/\x00CLLINK(\d+)\x00/g, (_, i) => inlineLinks[Number(i)] || '');
    }

    return text;
  }

  function renderCallout(type, bodyMd, customTitle) {
    const meta = CALLOUT_META[type.toUpperCase()] || CALLOUT_META.NOTE;
    const title = customTitle || meta.title;
    const trimmed = (bodyMd || '').trim();
    let bodyHtml = '';
    if (trimmed) {
      bodyHtml = trimmed.split(/\n{2,}/).map(para => {
        const lineContent = para.trim().split('\n').map(l => renderInlineFormatting(l.trim())).join('<br>');
        return `<p>${lineContent}</p>`;
      }).join('');
    }
    return `<div class="codelab-callout ${meta.cls}">` +
      `<div class="codelab-callout__header">` +
        `<span class="codelab-callout__icon">${meta.svg}</span>` +
        `<span class="codelab-callout__title">${escapeHtml(title)}</span>` +
      `</div>` +
      `<div class="codelab-callout__content">${bodyHtml}</div>` +
    `</div>`;
  }

  function renderBlockquote(rawText) {
    const trimmed = (rawText || '').trim();
    if (!trimmed) return '<blockquote class="codelab-blockquote"></blockquote>';
    const paras = trimmed.split(/\n{2,}/).map(p => {
      const lineContent = p.trim().split('\n').map(l => renderInlineFormatting(l.trim())).join('<br>');
      return `<p>${lineContent}</p>`;
    }).join('');
    return `<blockquote class="codelab-blockquote">${paras}</blockquote>`;
  }

  function renderTable(tableText) {
    const rows = tableText.trim().split('\n').filter(r => r.trim().length > 0);
    if (rows.length < 2) return tableText;

    const headerCells = splitTableRow(rows[0]);
    const delimCells = splitTableRow(rows[1]);
    const bodyRows = rows.slice(2);

    const isDelimiter = delimCells.length === headerCells.length && delimCells.length > 0 && delimCells.every(c => /^[ \t]*:?-+:?[ \t]*$/.test(c.trim()));
    if (!isDelimiter) return tableText;

    const alignments = delimCells.map(c => {
      const s = c.trim();
      if (s.startsWith(':') && s.endsWith(':')) return 'center';
      if (s.endsWith(':')) return 'right';
      if (s.startsWith(':')) return 'left';
      return 'left';
    });

    const ths = headerCells.map((h, i) => {
      const align = alignments[i] || 'left';
      const style = align !== 'left' ? ` style="text-align:${align};"` : '';
      return `<th${style}>${renderInlineFormatting(h)}</th>`;
    }).join('');

    const trs = bodyRows.map(row => {
      const cells = splitTableRow(row);
      const tds = headerCells.map((_, i) => {
        const cellText = cells[i] !== undefined ? cells[i] : '';
        const align = alignments[i] || 'left';
        const style = align !== 'left' ? ` style="text-align:${align};"` : '';
        return `<td${style}>${renderInlineFormatting(cellText)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('\n');

    return `<div class="codelab-table-wrap">` +
      `<table class="codelab-table">` +
        `<thead><tr>${ths}</tr></thead>` +
        `<tbody>${trs}</tbody>` +
      `</table>` +
    `</div>`;
  }

  function renderListBlock(blockText, globalTaskCounter) {
    const rawLines = blockText.split('\n');
    const items = [];
    let currentItem = null;

    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      if (!rawLine.trim()) continue;
      const line = rawLine.replace(/\t/g, '  ');
      const match = line.match(/^([ ]*)([-*+]|\d+\.)[ ]+(.*)$/);
      if (match) {
        const indent = match[1].length;
        const marker = match[2];
        const rest = match[3];
        const isOrdered = /^\d+\.$/.test(marker);
        const listType = isOrdered ? 'ol' : 'ul';

        const taskMatch = rest.match(/^\[([ xX])\](?:[ ]+(.*))?$/);
        let isTask = false;
        let isChecked = false;
        let content = rest;
        if (taskMatch) {
          isTask = true;
          isChecked = taskMatch[1].toLowerCase() === 'x';
          content = taskMatch[2] || '';
        }

        currentItem = {
          indent,
          listType,
          isTask,
          isChecked,
          text: content
        };
        items.push(currentItem);
      } else if (currentItem) {
        currentItem.text += ' ' + line.trim();
      }
    }

    if (items.length === 0) return blockText;

    let html = '';
    const stack = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemIndent = item.indent;

      while (stack.length > 0 && stack[stack.length - 1].indent > itemIndent) {
        const popped = stack.pop();
        html += `</li></${popped.listType}>`;
      }

      if (stack.length === 0 || stack[stack.length - 1].indent < itemIndent) {
        const listClass = item.isTask ? ' class="codelab-task-list"' : '';
        html += `<${item.listType}${listClass}>`;
        stack.push({ listType: item.listType, indent: itemIndent, isTaskList: item.isTask });
      } else if (stack.length > 0 && stack[stack.length - 1].listType !== item.listType) {
        const popped = stack.pop();
        html += `</li></${popped.listType}>`;
        const listClass = item.isTask ? ' class="codelab-task-list"' : '';
        html += `<${item.listType}${listClass}>`;
        stack.push({ listType: item.listType, indent: itemIndent, isTaskList: item.isTask });
      } else {
        html += `</li>`;
      }

      if (item.isTask) {
        const taskIdx = globalTaskCounter.count++;
        const checkedAttr = item.isChecked ? ' checked' : '';
        const checkedCls = item.isChecked ? ' codelab-task-item--checked' : '';
        html += `<li class="codelab-task-item${checkedCls}">` +
          `<input type="checkbox" class="codelab-task-checkbox" data-cl-task-idx="${taskIdx}"${checkedAttr}>` +
          `<span>${renderInlineFormatting(item.text)}</span>`;
      } else {
        html += `<li>${renderInlineFormatting(item.text)}`;
      }
    }

    while (stack.length > 0) {
      const popped = stack.pop();
      html += `</li></${popped.listType}>`;
    }

    return html;
  }

  function renderSimpleMarkdown(md, options = {}) {
    // Phase 0: Normalization & Array Joining
    if (md === null || md === undefined) return '';
    let text = Array.isArray(md)
      ? md.filter(item => item !== null && item !== undefined).map(item => String(item)).join('\n\n')
      : String(md);

    if (!text.trim()) return '';

    // Normalize CRLF to LF
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // NUL delimits internal placeholders. Strip author-supplied NULs so
    // markdown cannot forge a code-block or autolink placeholder.
    text = text.replace(/\u0000/g, '');

    // Phase 1: Fenced Code Block Extraction
    const codeBlocks = [];
    text = text.replace(/(?:^|\n)(`{3,}|~{3,})([^\n`~]*)\n([\s\S]*?)\n?\1[ \t]*(?=\n|$)/g, (match, fence, info, code) => {
      const lang = (info || '').trim().split(/\s+/)[0] || '';
      const idx = codeBlocks.length;
      codeBlocks.push(renderCodeBlock(code || '', lang));
      return `\n\n\x00CLCODEBLOCK${idx}\x00\n\n`;
    });

    // Phase 2: Inline Code Span Extraction
    const inlineCodes = [];
    text = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (match, fence, code) => {
      let clean = code;
      if (clean.startsWith(' ') && clean.endsWith(' ') && clean.trim().length > 0) {
        clean = clean.slice(1, -1);
      }
      const idx = inlineCodes.length;
      inlineCodes.push(`<code class="codelab-inline-code">${escapeHtml(clean)}</code>`);
      return `\x00CLINLINECODE${idx}\x00`;
    });

    // Phase 2b: Autolinks are the only inline construct that uses angle
    // brackets. Extract them before raw HTML is neutralized, then restore the
    // anchors in Phase 7.
    const autolinks = [];
    text = text.replace(/<(https?:\/\/[^>\s]+)>/g, (_, url) => {
      const idx = autolinks.length;
      const safe = sanitizeUrl(url);
      autolinks.push(
        `<a href="${escapeHtml(safe)}" class="codelab-link" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
      );
      return `\x00CLAUTOLINK${idx}\x00`;
    });

    // Phase 2c: Neutralize all remaining raw HTML. Every tag needs a `<`, so
    // escaping that one character turns any author-supplied markup into text
    // without disturbing `>` blockquote syntax. From here on, every real tag
    // in the output is generated by this renderer.
    text = text.replace(/</g, '&lt;');

    // Phase 3: GitHub Callout Alerts & Blockquotes
    const calloutBlocks = [];
    text = text.replace(/(?:^[ \t]*>.*(?:\n|$))+/gm, (match) => {
      const lines = match.split('\n').map(l => l.replace(/^[ \t]*>[ \t]?/, ''));
      const rawBlock = lines.join('\n').trim();
      let unnested = rawBlock;
      let isNestedQuote = false;
      if (/^[ \t]*>/m.test(unnested)) {
        isNestedQuote = true;
        unnested = unnested.split('\n').map(l => l.replace(/^[ \t]*>[ \t]?/, '')).join('\n').trim();
      }
      const alertMatch = unnested.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([^\n]*)(?:\n([\s\S]*))?$/i);
      let blockHtml = '';
      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        const customTitle = (alertMatch[2] || '').trim();
        const body = alertMatch[3] || '';
        blockHtml = renderCallout(type, body, customTitle);
      } else {
        blockHtml = renderBlockquote(unnested);
      }
      if (isNestedQuote) {
        blockHtml = `<blockquote class="codelab-blockquote">${blockHtml}</blockquote>`;
      }
      const idx = calloutBlocks.length;
      calloutBlocks.push(blockHtml);
      return `\n\n\x00CLCALLOUT${idx}\x00\n\n`;
    });

    // Phase 4: GFM Tables with Column Alignments
    const tableBlocks = [];
    text = text.replace(/(?:^|\n)([ \t]*\|?[^\n]+\|[^\n]*\n[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*(?:\n[ \t]*\|?[^\n]+\|[^\n]*)*)(?=\n|$)/g, (match, tableText) => {
      const rendered = renderTable(tableText);
      if (rendered === tableText) return match;
      const idx = tableBlocks.length;
      tableBlocks.push(rendered);
      return `\n\n\x00CLTABLE${idx}\x00\n\n`;
    });

    // Phase 5: Task Lists & Nested Lists
    const listBlocks = [];
    const taskCounter = { count: 0 };
    text = text.replace(/(?:^[ ]*(?:[-*+]|\d+\.)[ ]+[^\n]*(?:\n[ ]*(?:[-*+]|\d+\.)[ ]+[^\n]*|\n[ ]{2,}[^\n]*)*)+/gm, (match) => {
      const idx = listBlocks.length;
      listBlocks.push(renderListBlock(match, taskCounter));
      return `\n\n\x00CLLIST${idx}\x00\n\n`;
    });

    // Phase 6: Headings, Horizontal Rules, Paragraphs & Inline Spans
    text = text
      .replace(/^######[ \t]+([^\n]+)$/gm, (_, h) => `<h6>${renderInlineFormatting(h)}</h6>`)
      .replace(/^#####[ \t]+([^\n]+)$/gm, (_, h) => `<h5>${renderInlineFormatting(h)}</h5>`)
      .replace(/^####[ \t]+([^\n]+)$/gm, (_, h) => `<h4>${renderInlineFormatting(h)}</h4>`)
      .replace(/^###[ \t]+([^\n]+)$/gm, (_, h) => `<h3>${renderInlineFormatting(h)}</h3>`)
      .replace(/^##[ \t]+([^\n]+)$/gm, (_, h) => `<h2>${renderInlineFormatting(h)}</h2>`)
      .replace(/^#[ \t]+([^\n]+)$/gm, (_, h) => `<h2>${renderInlineFormatting(h)}</h2>`)
      .replace(/^[ \t]*(?:---|\*\*\*|___)[ \t]*$/gm, '<hr class="codelab-hr">');

    // Isolate block elements with double newlines
    text = text
      .replace(/(<h[1-6]>[\s\S]*?<\/h[1-6]>)/gi, '\n\n$1\n\n')
      .replace(/(<hr[^>]*>)/gi, '\n\n$1\n\n');

    const paras = text.split(/\n{2,}/).map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|hr|pre|div|blockquote|table|ul|ol)/i.test(trimmed)) return trimmed;
      if (/^\x00CL(CODEBLOCK|CALLOUT|TABLE|LIST)\d+\x00$/.test(trimmed)) return trimmed;
      return `<p>${renderInlineFormatting(trimmed).replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('\n');

    // Phase 7: Placeholder Restoration (Reverse order)
    let finalHtml = paras
      .replace(/\x00CLLIST(\d+)\x00/g, (_, i) => listBlocks[Number(i)] || '')
      .replace(/\x00CLTABLE(\d+)\x00/g, (_, i) => tableBlocks[Number(i)] || '')
      .replace(/\x00CLCALLOUT(\d+)\x00/g, (_, i) => calloutBlocks[Number(i)] || '')
      .replace(/\x00CLCODEBLOCK(\d+)\x00/g, (_, i) => codeBlocks[Number(i)] || '')
      .replace(/\x00CLINLINECODE(\d+)\x00/g, (_, i) => inlineCodes[Number(i)] || '')
      .replace(/\x00CLAUTOLINK(\d+)\x00/g, (_, i) => autolinks[Number(i)] || '');

    return finalHtml;
  }

  // ── Singleton Monaco Loader ──────────────────────────────────────────────
  let monacoPromise = null;
  function loadMonaco(customBaseUrl) {
    const baseUrl = (customBaseUrl || MONACO_BASE).replace(/\/+$/, '');
    if (root.monaco && root.monaco.editor) return Promise.resolve(root.monaco);
    if (monacoPromise) return monacoPromise;

    monacoPromise = new Promise((resolve, reject) => {
      // Configure cross-origin Worker proxy via Blob URL
      const amdBaseUrl = baseUrl.replace(/\/vs\/?$/, '') + '/';
      root.MonacoEnvironment = {
        getWorkerUrl: function () {
          const blobCode = `
            self.MonacoEnvironment = { baseUrl: ${JSON.stringify(amdBaseUrl)} };
            importScripts(${JSON.stringify(baseUrl + '/base/worker/workerMain.js')});
          `;
          return URL.createObjectURL(new Blob([blobCode], { type: 'application/javascript' }));
        }
      };

      const configureMonaco = () => {
        const m = root.monaco;
        if (!m || !m.editor) {
          reject(new Error('Monaco failed to initialize'));
          return;
        }
        // Define custom themes synced with Ved Gupta Monochrome Neutral Design System (Geist)
        m.editor.defineTheme('codelab-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '666666', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff7b72' },
            { token: 'string', foreground: 'a5d6ff' },
            { token: 'number', foreground: '79c0ff' },
            { token: 'type', foreground: 'ffa657' }
          ],
          colors: {
            'editor.background': '#000000',
            'editor.foreground': '#f2f2f2',
            'editorGutter.background': '#000000',
            'editorLineNumber.foreground': '#525252',
            'editorLineNumber.activeForeground': '#ffffff',
            'editor.lineHighlightBackground': '#0a0a0a',
            'editor.lineHighlightBorder': '#171717',
            'editor.selectionBackground': '#262626',
            'editor.inactiveSelectionBackground': '#171717',
            'editorCursor.foreground': '#ffffff',
            'editorIndentGuide.background1': '#171717',
            'editorIndentGuide.activeBackground1': '#262626',
            'editorWidget.background': '#0a0a0a',
            'editorWidget.border': '#262626',
            'editorHoverWidget.background': '#0a0a0a',
            'editorHoverWidget.border': '#262626',
            'scrollbarSlider.background': '#26262680',
            'scrollbarSlider.hoverBackground': '#404040aa'
          }
        });

        m.editor.defineTheme('codelab-light', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '666666', fontStyle: 'italic' }
          ],
          colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#0a0a0a',
            'editorGutter.background': '#ffffff',
            'editorLineNumber.foreground': '#8f8f8f',
            'editorLineNumber.activeForeground': '#0a0a0a',
            'editor.lineHighlightBackground': '#fafafa',
            'editor.lineHighlightBorder': '#f5f5f5',
            'editor.selectionBackground': '#e5e5e5',
            'editor.inactiveSelectionBackground': '#f5f5f5',
            'editorCursor.foreground': '#000000',
            'editorIndentGuide.background1': '#f0f0f0',
            'editorIndentGuide.activeBackground1': '#d4d4d4',
            'editorWidget.background': '#fafafa',
            'editorWidget.border': '#e5e5e5',
            'editorHoverWidget.background': '#fafafa',
            'editorHoverWidget.border': '#e5e5e5'
          }
        });

        // Configure TS/JS defaults & ambient Node types
        if (m.languages && m.languages.typescript) {
          const tsDefaults = m.languages.typescript.typescriptDefaults;
          const jsDefaults = m.languages.typescript.javascriptDefaults;
          const compilerOpts = {
            target: m.languages.typescript.ScriptTarget.ES2020,
            module: m.languages.typescript.ModuleKind.CommonJS,
            moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs,
            allowNonTsExtensions: true,
            allowJs: true,
            checkJs: false,
            strict: false,
            noEmit: true,
            esModuleInterop: true
          };
          tsDefaults.setCompilerOptions(compilerOpts);
          jsDefaults.setCompilerOptions(compilerOpts);
          tsDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
          jsDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
          tsDefaults.addExtraLib(NODE_AMBIENT_DTS, 'file:///node-ambient.d.ts');
          jsDefaults.addExtraLib(NODE_AMBIENT_DTS, 'file:///node-ambient.d.ts');
        }

        resolve(m);
      };

      if (root.require && typeof root.require.config === 'function') {
        root.require.config({ paths: { vs: baseUrl } });
        root.require(['vs/editor/editor.main'], configureMonaco, reject);
        return;
      }

      const loaderScript = document.createElement('script');
      loaderScript.src = `${baseUrl}/loader.js`;
      loaderScript.async = true;
      loaderScript.onload = () => {
        if (root.require && typeof root.require.config === 'function') {
          root.require.config({ paths: { vs: baseUrl } });
          root.require(['vs/editor/editor.main'], configureMonaco, reject);
        } else {
          reject(new Error('AMD loader unavailable'));
        }
      };
      loaderScript.onerror = () => {
        monacoPromise = null;
        reject(new Error('Failed to load Monaco from CDN'));
      };
      document.head.appendChild(loaderScript);
    });

    return monacoPromise;
  }

  const DEFAULT_STANDALONE_CPP_FILES = {
    'solution.hpp': `#pragma once
#include <bits/stdc++.h>
#include <codelab/dsa.hpp>
using namespace std;

vector<int> twoSum(const vector<int>& nums, int target) {
  unordered_map<int, int> seen;
  for (int i = 0; i < (int)nums.size(); ++i) {
    int complement = target - nums[i];
    if (seen.count(complement)) return {seen[complement], i};
    seen[nums[i]] = i;
  }
  return {};
}
`,
    'main.cpp': `#include "solution.hpp"

int main() {
  vector<int> nums = {2, 7, 11, 15};
  codelab::dbg(twoSum(nums, 9));
  return 0;
}
`,
    'test.cpp': `#include <codelab/test.hpp>
#include "solution.hpp"

int main() {
  DESCRIBE("Standalone C++ Sandbox", [] {
    TEST("twoSum finds target pair indices", [] {
      ASSERT_EQ(twoSum({2, 7, 11, 15}, 9), (vector<int>{0, 1}));
      ASSERT_EQ(twoSum({3, 2, 4}, 6), (vector<int>{1, 2}));
    });
  });
  return codelab::test::exit_code();
}
`
  };

  const DEFAULT_STANDALONE_SQL_FILES = {
    'query.sql': `-- SQL Playground & Guided Lab\nSELECT 1 AS id, 'code-lab' AS engine;\n`
  };

  // Helper to convert JS file set to TS, C++, Python, or SQL file set if explicit language files aren't provided
  function mapFilesToLanguage(filesObj, lang, explicitTsFiles, explicitCppFiles, explicitPyFiles, explicitSqlFiles) {
    const preserveConfigFiles = (target) => {
      for (const [name, content] of Object.entries(filesObj || {})) {
        if (name.startsWith('.codelab/')) {
          target[name] = content;
        }
      }
      return target;
    };
    if (lang === 'sql') {
      if (explicitSqlFiles && Object.keys(explicitSqlFiles).length > 0) {
        return preserveConfigFiles({ ...explicitSqlFiles });
      }
      const existingSql = {};
      for (const [name, content] of Object.entries(filesObj || {})) {
        if (/\.(sql|md)$/i.test(name) || name.startsWith('.codelab/')) {
          existingSql[name] = content;
        }
      }
      if (Object.keys(existingSql).some(f => /\.sql$/i.test(f))) {
        return existingSql;
      }
      const outSql = { ...DEFAULT_STANDALONE_SQL_FILES };
      if (filesObj && filesObj['README.md']) {
        outSql['README.md'] = filesObj['README.md'];
      }
      return preserveConfigFiles(outSql);
    }
    if (lang === 'ts' && explicitTsFiles && Object.keys(explicitTsFiles).length > 0) {
      return preserveConfigFiles({ ...explicitTsFiles });
    }
    if (lang === 'cpp') {
      if (explicitCppFiles && Object.keys(explicitCppFiles).length > 0) {
        return preserveConfigFiles({ ...explicitCppFiles });
      }
      const existingCpp = {};
      for (const [name, content] of Object.entries(filesObj || {})) {
        if (/\.(cpp|cc|cxx|h|hpp|md)$/i.test(name) || name.startsWith('.codelab/')) {
          existingCpp[name] = content;
        }
      }
      if (Object.keys(existingCpp).some(f => /\.(cpp|cc|cxx)$/i.test(f))) {
        return existingCpp;
      }
      const outCpp = { ...DEFAULT_STANDALONE_CPP_FILES };
      if (filesObj && filesObj['README.md']) {
        outCpp['README.md'] = filesObj['README.md'];
      }
      return preserveConfigFiles(outCpp);
    }
    if (lang === 'py') {
      if (explicitPyFiles && Object.keys(explicitPyFiles).length > 0) {
        return preserveConfigFiles({ ...explicitPyFiles });
      }
      const existingPy = {};
      for (const [name, content] of Object.entries(filesObj || {})) {
        if (/\.(py|md)$/i.test(name) || name.startsWith('.codelab/')) {
          existingPy[name] = content;
        }
      }
      if (Object.keys(existingPy).some(f => /\.py$/i.test(f))) {
        return existingPy;
      }
      const outPy = { ...DEFAULT_STANDALONE_PYTHON_FILES };
      if (filesObj && filesObj['README.md']) {
        outPy['README.md'] = filesObj['README.md'];
      }
      return preserveConfigFiles(outPy);
    }
    const out = {};
    for (const [name, content] of Object.entries(filesObj || {})) {
      if (lang === 'ts' && name.endsWith('.js')) {
        const tsName = name.replace(/\.js$/, '.ts');
        // Update local require('.xyz.js') references so they resolve cleanly
        const tsContent = String(content).replace(/require\((['"])(\.[^'"]+?)\.js\1\)/g, 'require($1$2.ts$1)');
        out[tsName] = tsContent;
      } else {
        out[name] = content;
      }
    }
    return out;
  }

  const DEFAULT_STANDALONE_PYTHON_FILES = {
    'main.py': `"""\nStandalone Python 3.12 Sandbox with CPython WebAssembly.\n"""\nfrom codelab_test import describe, it, assert_equal\n\ndef solve(x):\n    return x\n\nif __name__ == '__main__':\n    print("Hello from Python 3.12 in CodeLab!")\n    print("Output:", solve({"status": "ok"}))\n`,
    'test.py': `from codelab_test import describe, it, assert_equal\nfrom main import solve\n\nwith describe("Python Sandbox Test Suite"):\n    with it("returns input value"):\n        assert_equal(solve(42), 42)\n`
  };

  const DEFAULT_STANDALONE_FILES = {
    'index.js': `'use strict';\n\nfunction solve(input) {\n  return input;\n}\n\nmodule.exports = { solve };\n`,
    'demo.js': `'use strict';\nconst { solve } = require('./index.js');\n\nconsole.log('Demo output:', solve({ status: 'ok', timestamp: Date.now() }));\n`,
    'test.js': `'use strict';\nconst { describe, it } = require('node:test');\nconst assert = require('node:assert/strict');\nconst { solve } = require('./index.js');\n\ndescribe('Standalone Sandbox', () => {\n  it('returns the input payload', () => {\n    assert.deepEqual(solve({ a: 1 }), { a: 1 });\n  });\n});\n`
  };

  const CL_ICONS = {
    arrowLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    target: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    code: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    stop: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    lightbulb: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
    list: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    book: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    file: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    terminal: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    database: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    globe: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    package: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
    chevronsUpDown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    folder: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    box: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
    search: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    diff: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M8 8H4v8h4"/><path d="M16 8h4v8h-4"/></svg>',
    command: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>',
    download: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    refresh: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    send: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    activity: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    radio: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
    arrowRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    monitor: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    tablet: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    smartphone: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    externalLink: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    memory: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19v2"/><path d="M10 19v2"/><path d="M14 19v2"/><path d="M18 19v2"/><path d="M6 3v2"/><path d="M10 3v2"/><path d="M14 3v2"/><path d="M18 3v2"/><rect x="2" y="5" width="20" height="14" rx="2"/></svg>',
    keyboard: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>',
    share: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    layout: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    maximize: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    settings: '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    files: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h6"/><path d="M5 8H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"/></svg>',
    gitBranch: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    sidebarLeft: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
    panelBottom: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',
    chevronUp: '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    collapseAll: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    close: '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  let _workbenchInstanceCounter = 0;
  const _fallbackStorage = new Map();

  // Preview CSP, storage shims and violation reporting live in src/csp.ts.
  // The build embeds that module in this bundle (and in dist/preview-sw.js), so
  // there is exactly one policy implementation shared by both sides.
  const PreviewCsp = (typeof CodeLabCsp !== 'undefined' && CodeLabCsp) ||
    (root && root.CodeLabCsp) ||
    null;

  function normalizePreviewCspOption(raw) {
    if (PreviewCsp && typeof PreviewCsp.normalizePreviewCspConfig === 'function') {
      return PreviewCsp.normalizePreviewCspConfig(raw);
    }
    return { mode: 'balanced', allow: {} };
  }

  // `previewOrigin` needs a relay page + service worker on that origin. Until
  // that ships, using it would silently *pretend* to isolate previews while the
  // iframe gets a 503 from a worker that has no clients on the preview origin.
  const PREVIEW_RELAY_AVAILABLE = false;

  function normalizePreviewOrigin(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    try {
      const parsed = new URL(String(raw));
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.origin;
    } catch (_) {
      return null;
    }
  }

  const LOG_PREFIX = (_sharedLoggerMod && _sharedLoggerMod.LOG_PREFIX) || '[code-lab]';
  const CodeLabError = (_sharedLoggerMod && _sharedLoggerMod.CodeLabError) || class CodeLabError extends Error {
    constructor(code, message, options = {}) {
      super(message);
      this.name = 'CodeLabError';
      this.code = code || 'E_CODELAB';
      this.module = options.module || 'workbench';
      this.context = options.context || {};
      if (options.cause !== undefined) this.cause = options.cause;
    }
  };
  const isCodeLabError = (_sharedLoggerMod && _sharedLoggerMod.isCodeLabError) || ((value) => Boolean(value && typeof value === 'object' && value.name === 'CodeLabError' && typeof value.code === 'string'));

  // Small leveled logger. Hosts can pass `options.logger` to route diagnostics
  // into their own telemetry; `options.debug` enables verbose output. Errors
  // are never silently discarded.
  function createLogger(options = {}) {
    if (_sharedLoggerMod && typeof _sharedLoggerMod.createLogger === 'function') {
      return _sharedLoggerMod.createLogger({ module: 'workbench', ...options });
    }
    const sink = options.logger;
    const debugEnabled = options.debug === true;

    const write = (level, args) => {
      if (level === 'debug' && !debugEnabled) return;
      if (sink && typeof sink[level] === 'function') {
        try {
          sink[level](...args);
          return;
        } catch (sinkErr) {
          const fallbackWarn = typeof console !== 'undefined' && typeof console.warn === 'function' ? console.warn : null;
          if (fallbackWarn) fallbackWarn(LOG_PREFIX, 'Host logger sink threw; falling back to console.', sinkErr);
        }
      }
      const fn = typeof console !== 'undefined' ? console[level] : null;
      if (typeof fn === 'function') fn(LOG_PREFIX, ...args);
    };

    return {
      debug: (...args) => write('debug', args),
      info: (...args) => write('info', args),
      warn: (...args) => write('warn', args),
      error: (...args) => write('error', args)
    };
  }

  const DEFAULT_LOGGER = createLogger();

  function safeStorageGet(key, logger = DEFAULT_LOGGER) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        const value = localStorage.getItem(key);
        if (value !== null && value !== undefined) return value;
      }
    } catch (err) {
      logger.warn(
        `localStorage.getItem("${key}") failed; using in-memory state.`,
        err && err.message ? err.message : err
      );
    }
    return _fallbackStorage.has(key) ? _fallbackStorage.get(key) : null;
  }

  function safeStorageSet(key, value, logger = DEFAULT_LOGGER, onError = null) {
    const str = String(value);
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.setItem(key, str);
        return true;
      }
    } catch (err) {
      if (typeof onError === 'function') {
        onError(err);
      }
      if (!safeStorageSet._warnedKeys) safeStorageSet._warnedKeys = new Set();
      if (!safeStorageSet._warnedKeys.has(key)) {
        safeStorageSet._warnedKeys.add(key);
        logger.warn(
          `localStorage.setItem("${key}") failed; keeping state in memory for this session.`,
          err && err.message ? err.message : err
        );
      }
    }
    _fallbackStorage.set(key, str);
    return false;
  }

  // ── CodeLabWorkbench Instance Class ──────────────────────────────────────
  class CodeLabWorkbench {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error('CodeLabWorkbench requires a valid DOM container element.');
      }
      if (!CodeLabWorkbench._instances) {
        CodeLabWorkbench._instances = new Set();
      }
      CodeLabWorkbench._instances.add(this);
      this.options = options || {};
      this.persistState = options.persistState !== false && options.persist !== false;
      this._explicitThemeOption = Boolean(options.theme);
      this._explicitDrawerTabOption = Boolean(options.drawerTab);
      this._explicitSqlDialectOption = Boolean(options.sqlDialect || options.dialect);
      this.logger = createLogger({ logger: options.logger, debug: options.debug });
      this._persistenceFailureReported = false;
      this.saveStatusState = 'saved';
      this.saveStatusError = null;
      this._dirtyFiles = new Set();
      this._userEditSeq = 0;
      this._savedSettingsScrollTop = 0;
      this._syncingModelFromFiles = false;
      this._syncingSqlEditorFromFiles = false;
      if (!CodeLabWorkbench._instances) CodeLabWorkbench._instances = new Set();
      CodeLabWorkbench._instances.add(this);
      this._syncingWorkspaceSettingsFile = false;
      this._applyingConfigTheme = false;
      this._applyingConfigSidebar = false;
      this._userSwitchedDrawerTab = false;
      this.outputLogs = [];
      this.instanceId = options.instanceId || (`cl-${++_workbenchInstanceCounter}`);
      this.labId = options.id || options.labId || options.buildId || (options.blank ? 'blank-workspace' : 'custom-lab');
      this.title = options.title || this.labId;
      this.summary = options.summary || '';
      this.monacoUrl = options.monacoUrl || MONACO_BASE;
      this.themeOption = options.theme || 'auto'; // 'dark' | 'light' | 'auto'
      this.previewOrigin = normalizePreviewOrigin(options.previewOrigin);
      this.previewCsp = normalizePreviewCspOption(options.previewCsp);
      this._previewIsolationWarned = false;
      if (options.previewOrigin && !this.previewOrigin) {
        this.logger.warn(
          'Ignoring invalid `previewOrigin`; expected an absolute http(s) origin ' +
          'such as "https://preview.example.com".'
        );
      }
      this.explicitEntry = options.entry || null;
      this.explicitTestEntry = options.testEntry || options.testFile || null;
      this.backLabel = options.backLabel || 'Back to Build Guide';
      this._eventListeners = new Map();

      // Callbacks
      this.onStepComplete = typeof options.onStepComplete === 'function' ? options.onStepComplete : null;
      this.onLabComplete = typeof options.onLabComplete === 'function' ? options.onLabComplete : null;
      this.onRun = typeof options.onRun === 'function' ? options.onRun : null;
      this.onTestResult = typeof options.onTestResult === 'function' ? options.onTestResult : null;
      this.onCodeChange = typeof options.onCodeChange === 'function' ? options.onCodeChange : null;
      this.onClose = typeof options.onClose === 'function' ? options.onClose : null;

      // Pull reference files from options or optional host adapters (window.IMPLEMENTATIONS_DATA / window.GUIDED_LABS_DATA)
      const implData = root.IMPLEMENTATIONS_DATA?.[this.labId];
      const guidedData = root.GUIDED_LABS_DATA?.[this.labId];

      const initLang = options.language || options.lang || 'js';
      const codeShorthandFile = typeof options.code === 'string'
        ? {
            [initLang === 'sql'
              ? 'query.sql'
              : initLang === 'py'
                ? 'main.py'
                : initLang === 'cpp'
                  ? 'main.cpp'
                  : initLang === 'ts'
                    ? 'index.ts'
                    : 'index.js']: options.code
          }
        : null;
      const hasExplicitFilesProp = Boolean(
        options &&
        (Object.prototype.hasOwnProperty.call(options, 'files') ||
          Object.prototype.hasOwnProperty.call(options, 'solutionFiles'))
      );
      this._hasExplicitFilesProp = hasExplicitFilesProp;
      const isExplicitBlank = Boolean(
        options && (
          options.blank === true ||
          (hasExplicitFilesProp &&
            !options.code &&
            !options.solutionFiles &&
            options.files &&
            typeof options.files === 'object' &&
            Object.keys(options.files).length === 0)
        )
      );
      this._isBlankBase = isExplicitBlank;
      const rawRefFiles = isExplicitBlank
        ? {}
        : (options.solutionFiles || options.files || codeShorthandFile || implData?.files || {});
      this.referenceFiles = (isExplicitBlank || hasExplicitFilesProp || Object.keys(rawRefFiles).length > 0)
        ? { ...rawRefFiles }
        : { ...DEFAULT_STANDALONE_FILES };

      this.guidedConfig = {
        ...(guidedData || {}),
        ...(options.guided || {}),
        ...(options.starterFiles ? { starterFiles: options.starterFiles } : {}),
        ...(options.tsStarterFiles ? { tsStarterFiles: options.tsStarterFiles } : {}),
        ...((options.tsSolutionFiles || options.tsFiles) ? { tsSolutionFiles: options.tsSolutionFiles || options.tsFiles } : {}),
        ...(options.cppStarterFiles ? { cppStarterFiles: options.cppStarterFiles } : {}),
        ...((options.cppSolutionFiles || options.cppFiles) ? { cppSolutionFiles: options.cppSolutionFiles || options.cppFiles } : {}),
        ...(options.pyStarterFiles ? { pyStarterFiles: options.pyStarterFiles } : {}),
        ...((options.pySolutionFiles || options.pyFiles) ? { pySolutionFiles: options.pySolutionFiles || options.pyFiles } : {}),
        ...(options.sqlStarterFiles ? { sqlStarterFiles: options.sqlStarterFiles } : {}),
        ...((options.sqlSolutionFiles || options.sqlFiles) ? { sqlSolutionFiles: options.sqlSolutionFiles || options.sqlFiles } : {})
      };
      this.steps = options.steps || this.guidedConfig?.steps || [];
      this.hasGuidedLab = Boolean(
        options.hasGuidedLab ||
        options.guidedLab ||
        (this.steps && this.steps.length > 0)
      );
      const isPureSqlInit = Boolean(
        (options.lang === 'sql' || options.language === 'sql') &&
        !options.languages &&
        !options.hasMultipleLanguages &&
        !this.guidedConfig.tsStarterFiles &&
        !this.guidedConfig.tsSolutionFiles &&
        !this.guidedConfig.tsFiles &&
        !this.guidedConfig.cppStarterFiles &&
        !this.guidedConfig.cppSolutionFiles &&
        !this.guidedConfig.pyStarterFiles &&
        !this.guidedConfig.pySolutionFiles
      );
      this.enabledLanguages = new Set(isPureSqlInit ? ['sql'] : ['js']);
      if (Array.isArray(options.languages)) {
        this.enabledLanguages = new Set();
        for (const l of options.languages) {
          if (l === 'js' || l === 'ts' || l === 'cpp' || l === 'py' || l === 'sql') this.enabledLanguages.add(l);
        }
        if (this.enabledLanguages.size === 0) this.enabledLanguages.add('js');
      }
      if (
        options.hasMultipleLanguages ||
        this.guidedConfig.tsStarterFiles ||
        this.guidedConfig.tsSolutionFiles ||
        this.guidedConfig.tsFiles ||
        options.lang === 'ts' ||
        options.language === 'ts'
      ) {
        this.enabledLanguages.add('ts');
      }
      if (
        this.guidedConfig.cppStarterFiles ||
        this.guidedConfig.cppSolutionFiles ||
        this.guidedConfig.cppFiles ||
        options.lang === 'cpp' ||
        options.language === 'cpp'
      ) {
        this.enabledLanguages.add('cpp');
      }
      if (
        this.guidedConfig.pyStarterFiles ||
        this.guidedConfig.pySolutionFiles ||
        this.guidedConfig.pyFiles ||
        options.lang === 'py' ||
        options.language === 'py'
      ) {
        this.enabledLanguages.add('py');
      }
      if (
        this.guidedConfig.sqlStarterFiles ||
        this.guidedConfig.sqlSolutionFiles ||
        this.guidedConfig.sqlFiles ||
        options.lang === 'sql' ||
        options.language === 'sql' ||
        typeof options.sqlRunner === 'function'
      ) {
        this.enabledLanguages.add('sql');
      }
      this.hasMultipleLanguages = Boolean(
        options.hasMultipleLanguages ||
        (Array.isArray(options.languages) && options.languages.length > 1) ||
        this.enabledLanguages.size > 1 ||
        this.guidedConfig.tsStarterFiles ||
        this.guidedConfig.tsSolutionFiles ||
        this.guidedConfig.tsFiles ||
        this.guidedConfig.cppStarterFiles ||
        this.guidedConfig.cppSolutionFiles ||
        this.guidedConfig.cppFiles ||
        this.guidedConfig.pyStarterFiles ||
        this.guidedConfig.pySolutionFiles ||
        this.guidedConfig.pyFiles ||
        (!isPureSqlInit && this.hasGuidedLab && (options.lang || options.language))
      );
      this.showWebPreviewOption = Boolean(options.showWebPreview);
      this._diffManager = null;

      // Load saved user state from localStorage (with in-memory fallback)
      this.savedState = this._loadState();

      this.mode = options.mode || this.savedState.mode || (this.hasGuidedLab ? 'guided' : 'sandbox');
      this.lang = options.language || options.lang || this.savedState.lang || 'js';
      this._initialLabId = this.labId;
      this._initialReferenceFiles = { ...this.referenceFiles };
      this._initialHasGuidedLab = this.hasGuidedLab;
      this._initialMode = this.mode;
      this._initialLang = this.lang;
      this.sqlDialect = (
        options.sqlDialect === 'sqlite' ||
        options.dialect === 'sqlite' ||
        (options.sqlSchema && options.sqlSchema.dialect === 'sqlite') ||
        (options.schema && options.schema.dialect === 'sqlite')
      ) ? 'sqlite' : 'postgres';
      this.sqlSchema = options.sqlSchema || options.schema || null;
      this.sqlRunner = typeof options.sqlRunner === 'function' ? options.sqlRunner : null;
      this.lastSqlResult = null;
      this._sqlWorkbenchEditor = null;
      this._forceShowExplorer = Boolean(options.showExplorer);
      this._workspaceTasks = [];
      this._settingsDialog = null;
      this._pluginPanelDisposables = [];

      this.activeStepIndex = typeof options.stepIndex === 'number' ? options.stepIndex : (this.savedState.activeStepIndex || 0);
      if (this.activeStepIndex >= this.steps.length || this.activeStepIndex < 0) this.activeStepIndex = 0;

      this.completedSteps = new Set(this.savedState.completedSteps || []);
      this.folders = new Set(this.savedState?.folders || []);
      this.collapsedFolders = new Set(this.savedState?.collapsedFolders || []);
      this.explorerFolder = this.savedState?.explorerFolder || ''; // '' = workspace root, else folder path scope
      this.explorerWidth = (typeof this.savedState?.explorerWidth === 'number' && this.savedState.explorerWidth >= 120)
        ? this.savedState.explorerWidth
        : 260;
      this.activeSidebarView = (typeof this.savedState?.activeSidebarView === 'string' && this.savedState.activeSidebarView)
        ? this.savedState.activeSidebarView
        : 'explorer';
      this.sidebarVisible = typeof options.sidebarVisible === 'boolean'
        ? options.sidebarVisible
        : (typeof this.savedState?.sidebarVisible === 'boolean' ? this.savedState.sidebarVisible : true);
      this.panelVisible = typeof options.panelVisible === 'boolean'
        ? options.panelVisible
        : (typeof this.savedState?.panelVisible === 'boolean' ? this.savedState.panelVisible : true);
      this.drawerCollapsed = !this.panelVisible;
      this.panelHeight = (typeof this.savedState?.panelHeight === 'number' && this.savedState.panelHeight >= 100)
        ? this.savedState.panelHeight
        : 220;
      this.panelMaximized = Boolean(this.savedState?.panelMaximized);
      this._activeTopMenu = null;
      this._activeSubmenu = null;
      this._topbarMenuOutsideHandler = null;
      this._searchState = {
        query: '',
        replaceText: '',
        regex: false,
        caseSensitive: false,
        wholeWord: false,
        includeGlob: '',
        excludeGlob: '',
        results: []
      };
      // 0 = use the default 44% track; otherwise a pixel width chosen by dragging
      // the preview splitter.
      this.previewSplitWidth = (typeof this.savedState?.previewSplitWidth === 'number' && this.savedState.previewSplitWidth >= 200)
        ? this.savedState.previewSplitWidth
        : 0;
      this.folderSwitcherOpen = false;
      this.creatingItem = null; // { type: 'file' | 'folder', parentFolder: string } | null
      this.renamingItem = null;
      this._draggedFile = null;
      this.guideTab = 'steps'; // 'steps' | 'readme'
      const savedDrawerTab = typeof this.savedState?.drawerTab === 'string' ? this.savedState.drawerTab : '';
      this.drawerTab = options.drawerTab || savedDrawerTab || (
        this.lang === 'sql'
          ? 'sql-results'
          : ((this.hasGuidedLab && this.mode === 'guided') ? 'tests' : 'terminal')
      );
      this.testSuiteVisible = Boolean(this.hasGuidedLab && this.mode === 'guided');
      this.lastDurationMs = null;
      this.lastPeakMemoryBytes = null;
      this.customStdin = (options && options.stdin) || '';
      this._eventsBound = false;
      // ── Web Preview (M3) state ──
      this.previewState = {
        port: null,
        path: '/',
        url: '',
        frameMode: 'desktop', // 'desktop' | 'tablet' | 'mobile'
        dockMode: (options && options.previewDock === 'split') ? 'split' : 'bottom', // 'bottom' | 'split'
        maximized: false,
        consoleOpen: false,
        consoleLogs: [],
        loading: false,
        error: null,
        srcdoc: '',
        violations: []
      };
      this.previewHistory = [];
      this.previewHistoryIdx = -1;
      this._previewSwReady = false;
      this._previewSwRegistration = null;
      this._previewViolationHandler = null;
      this._swMessageHandler = null;
      this._beforeUnloadHandler = null;
      this._portToasts = new Map();
      this.isFullscreen = false;
      this.isRunning = false;
      this.isCreatingFile = false;
      this.contextMenuOpen = false;
      this._contextMenuItems = [];
      this.paletteOpen = false;
      this.paletteMode = 'commands';
      this.paletteSelectedIndex = 0;
      this._paletteFilteredItems = [];
      this._diffState = null;
      this._stepDecorations = [];
      this.cursorPos = { lineNumber: 1, column: 1 };
      this.lastRunDurationMs = null;
      this.runtimeStatusState = 'idle';
      this.runtimeStatusText = this.lang === 'sql'
        ? `${this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18'} · Idle`
        : 'Node.js v22 Worker · Idle';

      // Initialize working files for current mode & language
      this.files = this._computeInitialFiles();
      this._savedSnapshot = { ...this.files };

      // Auto-populate folders from nested files
      Object.keys(this.files).forEach(f => {
        const parts = f.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      });

      // Decouple openTabs from files (cap large repositories/snapshots to <= 1 tab while preserving <= 8 starter tabs)
      if (Array.isArray(this.savedState?.openTabs)) {
        this.openTabs = this.savedState.openTabs.filter(f => this.files[f] !== undefined);
      } else {
        const allOrdered = this._orderedFileNames();
        const maxInitTabs = typeof options.maxInitialTabs === 'number'
          ? Math.max(0, options.maxInitialTabs)
          : (allOrdered.length > 8 ? 1 : allOrdered.length);
        if (allOrdered.length > maxInitTabs) {
          const primary = this._pickPrimaryCloneFile(allOrdered);
          this.openTabs = (maxInitTabs > 0 && primary) ? [primary] : allOrdered.slice(0, maxInitTabs);
        } else {
          this.openTabs = allOrdered;
        }
      }

      if (options.activeFile && this.files[options.activeFile] !== undefined) {
        if (!this.openTabs.includes(options.activeFile)) {
          this.openTabs.unshift(options.activeFile);
        }
        this.activeFile = options.activeFile;
      } else if (this.openTabs.length > 0) {
        if (this.savedState?.activeFile && this.openTabs.includes(this.savedState.activeFile)) {
          this.activeFile = this.savedState.activeFile;
        } else {
          const defaultPick = this._pickDefaultFile();
          this.activeFile = (defaultPick && this.openTabs.includes(defaultPick)) ? defaultPick : this.openTabs[0];
        }
      } else {
        this.activeFile = null;
      }
      this.settingsTabOpen = false;
      this.activeTab = this.activeFile;

      // Execution & shell state
      this.cwd = '/workspace';
      this.replHistory = [];
      this.replHistoryIdx = -1;
      this.lastTestResults = [];
      this.terminalLogs = [
        { type: 'system', text: `[CodeLab] Virtual Node.js v22 Runtime ready (${this.title}).` },
        { type: 'system', text: `Type "help", "ls", "pwd", "cat <file>", "node demo.js", "node test.js", or any JS/TS expression.` }
      ];
      this.lastFsSnapshot = [];
      this.lastHttpTrace = [];

      // Milestone 4: Ports, HTTP Client, Network Trace, PTY state
      this.portTable = options.portTable || (typeof createVirtualPortTable === 'function' ? createVirtualPortTable() : null);
      this.inRepl = false;
      this._ptyInputBeforeCursor = '';
      this._ptyInputAfterCursor = '';

      this.httpClientState = {
        method: 'GET',
        url: 'http://localhost:3000/',
        headers: 'Content-Type: application/json',
        body: '',
        activeResponseTab: 'preview',
        lastResponse: null,
        loading: false
      };

      this.networkFilter = {
        search: '',
        method: 'ALL',
        status: 'ALL',
        selectedTraceId: null
      };

      this._activeCommandAbortController = null;
      this._activeStreamLine = '';
      this._activeStreamType = 'stdout';
      this._activeStreamEl = null;

      this.ptyEngine = null;
      if (typeof createPTYTerminalEngine === 'function') {
        try {
          this.ptyEngine = createPTYTerminalEngine(null, {
            cwd: this.cwd,
            onCommand: (cmd) => this._handleReplCommand(cmd),
            onInterrupt: () => this._handleInterrupt()
          });
        } catch (err) {
          this.logger.debug('PTY engine initialization skipped.', err);
        }
      }

      this.shell = null;
      this._initShell();
      if (this.savedState && this.savedState.gitState) {
        this._restoreSavedGitState(this.savedState.gitState);
      }

      // Editor instances
      this.monaco = null;
      this.editor = null;
      this.models = new Map();
      this._forceOpenedLargeFiles = new Set();
      this._saveDebounceTimer = null;
      this._idbSaveChain = Promise.resolve();
      this._breadcrumbRafId = null;
      this._markerDisposable = null;
      this._destroyed = false;
      this._isBooting = true;
      this._editorInitialized = false;
      this._activeSplitterCleanup = null;
      this._mdPreviewOpen = false;
      this._fallbackHistory = new Map();
      this._activeCloneAbortController = null;
      this._cloneCancelledByUser = false;
      this._searchState = {
        query: '',
        replaceText: '',
        include: '',
        exclude: '',
        regex: false,
        caseSensitive: false,
        wholeWord: false
      };
      this._problemsFilterQuery = '';
      this._problemsSeverityFilter = 'all';
      this._collapsedProblemFiles = new Set();
      this._problemNavIdx = -1;
      this._lintDebounceTimer = null;
      this._activeScmDiffFile = null;
      this._activeScmDiffStaged = false;
      this._scmCreatingBranch = false;
      this._sidebarHadFocusOnPointerDown = undefined;

      this._ensureDiagnosticsStore();
      this._initKernel();
      this._syncDotCodelabConfig({ isInitialMount: false });
      this._applyInitialWorkbenchConfig();

      const initialPlugins = [
        ...(Array.isArray(options.extensions) ? options.extensions : []),
        ...(Array.isArray(options.plugins) ? options.plugins : [])
      ];
      for (const plugin of initialPlugins) {
        this.use(plugin);
      }

      this._isBooting = false;
      this._renderShell();
      this._bindEvents();
      this._initEditor();
      this._applyConfigurationChanges(null);
      this._lintAllWorkspaceFiles();
      this._runInitialFolderOpenTasks();
      this._checkUrlSnapshot();
      this._hydrateFromAsyncStorage();
      if (this.persistState && (this._isBlankBase || Object.keys(this.files || {}).length > 0)) {
        this._registerWorkspaceMetaInStorage();
      }

      if (this.plugins && typeof this.plugins.fireActivationEvent === 'function') {
        this.plugins.fireActivationEvent('onStartupFinished').catch((err) => {
          this.logger.debug('onStartupFinished plugin activation error.', err);
        });
      }

      if (options.repo && typeof options.repo === 'string') {
        this.cloneRepo(options.repo, {
          intoRoot: options.cloneIntoRoot !== false,
          branch: options.branch || undefined,
          fetchImpl: options.fetchImpl || undefined
        }).catch((err) => this.logger.warn('Initial cloneRepo failed.', err));
      }
    }

    get entry() {
      if (this.explicitEntry && this.files && Object.prototype.hasOwnProperty.call(this.files, this.explicitEntry)) {
        return this.explicitEntry;
      }
      return this._findEntryFile('demo') || null;
    }

    _initKernel() {
      const mod = getModular();
      if (!mod || typeof mod.createCodeLabKernel !== 'function') {
        this.kernel = null;
        this.configuration = null;
        this.commands = null;
        this.keybindings = null;
        this.themes = null;
        this.plugins = null;
        this.contextKeys = null;
        this._errorBoundary = null;
        return;
      }
      try {
        this.kernel = mod.createCodeLabKernel({
          instanceId: this.instanceId,
          initialFiles: this.files,
          runtimeDelegate: (opts) => this._executeRuntime(opts)
        });
        if (this.kernel && this.kernel.fs && typeof this.kernel.fs.mkdir === 'function' && this.folders) {
          try {
            this.kernel.fs.mkdir('/workspace');
            for (const folder of this.folders) {
              const cf = this._normalizeWorkspaceRelPath(folder);
              if (cf) {
                try { this.kernel.fs.mkdir('/workspace/' + cf); } catch (_e) { void _e; }
              }
            }
          } catch (_e) {
            void _e;
          }
        }
        this.configuration = this.kernel.configuration;
        this.commands = this.kernel.commands;
        this.keybindings = this.kernel.keybindings;
        this.themes = this.kernel.themes;
        this.plugins = this.kernel.plugins;
        this.contextKeys = this.kernel.contextKeys;
        this._errorBoundary = (this.container && mod.WorkbenchErrorBoundary)
          ? new mod.WorkbenchErrorBoundary(this.container, this.kernel.logger)
          : null;

        if (this.contextKeys) {
          this.contextKeys.setContext('editorLangId', this.lang);
          this.contextKeys.setContext('workbenchMode', this.mode);
          this.contextKeys.setContext('isGuidedLab', this.hasGuidedLab);
        }

        if (this.configuration && typeof this.configuration.registerSetting === 'function') {
          this.configuration.registerSetting({
            key: 'files.autoSave',
            category: 'Files',
            title: 'Auto Save',
            description: 'Controls auto save of dirty editors (off, afterDelay, or onFocusChange).',
            defaultValue: 'afterDelay',
            schema: {
              type: 'string',
              enum: ['afterDelay', 'onFocusChange', 'off'],
              default: 'afterDelay',
              description: 'Controls auto save of dirty editors.'
            }
          });
          this.configuration.registerSetting({
            key: 'workbench.panel.defaultTab',
            category: 'Workbench',
            title: 'Default Bottom Panel Tab',
            description: 'Default bottom drawer tab opened on startup.',
            defaultValue: 'terminal',
            schema: {
              type: 'string',
              enum: [
                'terminal',
                'output',
                'problems',
                'tests',
                'stdin',
                'ports',
                'preview',
                'network',
                'inspector',
                'observability',
                'sql-results'
              ],
              default: 'terminal',
              description: 'Default bottom drawer tab opened on startup.'
            }
          });

          const coerceExcludeMap = (val) => {
            if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
            const entries = Object.entries(val);
            if (!entries.every(([, v]) => typeof v === 'boolean')) return val;
            return entries.filter(([, enabled]) => enabled === true).map(([glob]) => glob.trim()).filter(Boolean);
          };
          const origSetWs = this.configuration.setWorkspaceSetting.bind(this.configuration);
          this.configuration.setWorkspaceSetting = (key, val) =>
            origSetWs(key, key === 'files.exclude' ? coerceExcludeMap(val) : val);
          const origSetUser = this.configuration.setUserSetting.bind(this.configuration);
          this.configuration.setUserSetting = (key, val) =>
            origSetUser(key, key === 'files.exclude' ? coerceExcludeMap(val) : val);
          if (typeof this.configuration.setOverrides === 'function') {
            const origSetOv = this.configuration.setOverrides.bind(this.configuration);
            this.configuration.setOverrides = (ov) => {
              if (ov && typeof ov === 'object' && Object.prototype.hasOwnProperty.call(ov, 'files.exclude')) {
                return origSetOv({ ...ov, 'files.exclude': coerceExcludeMap(ov['files.exclude']) });
              }
              return origSetOv(ov);
            };
          }
          if (typeof this.configuration.loadWorkspaceSettingsJson === 'function') {
            const origLoadWsJson = this.configuration.loadWorkspaceSettingsJson.bind(this.configuration);
            this.configuration.loadWorkspaceSettingsJson = (rawJsonc, filePath) => {
              if (rawJsonc && typeof rawJsonc === 'string' && rawJsonc.includes('"files.exclude"') && typeof mod.parseJsonc === 'function') {
                const parsed = mod.parseJsonc(rawJsonc);
                if (parsed && parsed.errors.length === 0 && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
                  const rawEx = parsed.value['files.exclude'];
                  const coerced = coerceExcludeMap(rawEx);
                  if (coerced !== rawEx) {
                    const cloned = { ...parsed.value, 'files.exclude': coerced };
                    return origLoadWsJson(JSON.stringify(cloned, null, 2), filePath);
                  }
                }
              }
              return origLoadWsJson(rawJsonc, filePath);
            };
          }
        }

        // Load persisted user settings from localStorage if available
        if (this.persistState && this.configuration) {
          const savedUserSettings = safeStorageGet(`${STORAGE_PREFIX}user-settings`, this.logger);
          if (savedUserSettings) {
            this.configuration.importProfile(savedUserSettings);
          }
        }

        // Apply URL ?settings= parameter if present
        if (typeof window !== 'undefined' && window.location && window.location.search && this.configuration) {
          try {
            const params = new URLSearchParams(window.location.search);
            const encoded = params.get('settings');
            if (encoded) {
              this.configuration.applyUrlParam(encoded);
            }
          } catch (err) {
            this.logger.debug('URL ?settings= parameter parse skipped.', err);
          }
        }

        // Apply constructor overrides onto Layer 4 if passed in options.settings
        if (this.options && this.options.settings && typeof this.options.settings === 'object' && this.configuration) {
          this.configuration.setOverrides(this.options.settings);
        }

        // Register built-in commands & keybindings
        if (this.commands) {
          this.commands.registerCommand({
            id: 'workbench.action.openSettings',
            title: 'Preferences: Open Settings (UI)',
            category: 'Preferences',
            handler: () => this.openSettings()
          });
          this.commands.registerCommand({
            id: 'workbench.action.files.save',
            title: 'File: Save',
            category: 'File',
            handler: () => this.saveActiveFile({ manual: true })
          });
          this.commands.registerCommand({
            id: 'workbench.action.files.saveAll',
            title: 'File: Save All',
            category: 'File',
            handler: () => this.saveWorkspace()
          });
          this.commands.registerCommand({
            id: 'workbench.action.toggleSidebarVisibility',
            title: 'View: Toggle Primary Side Bar Visibility',
            category: 'View',
            handler: () => this.toggleSidebar()
          });
          this.commands.registerCommand({
            id: 'workbench.action.togglePanel',
            title: 'View: Toggle Panel Visibility',
            category: 'View',
            handler: () => this.togglePanel()
          });
          this.commands.registerCommand({
            id: 'workbench.action.terminal.toggleTerminal',
            title: 'View: Toggle Terminal',
            category: 'Terminal',
            handler: () => this.toggleTerminal()
          });
          this.commands.registerCommand({
            id: 'workbench.action.terminal.new',
            title: 'Terminal: Create New Terminal',
            category: 'Terminal',
            handler: () => this.createTerminalSession()
          });
          this.commands.registerCommand({
            id: 'workbench.view.explorer',
            title: 'View: Show Explorer',
            category: 'View',
            handler: () => this.setSidebarView('explorer', { ensureOpen: true, focus: true })
          });
          this.commands.registerCommand({
            id: 'workbench.view.search',
            title: 'View: Show Search',
            category: 'View',
            handler: () => this.openSearchView()
          });
          this.commands.registerCommand({
            id: 'workbench.view.scm',
            title: 'View: Show Source Control',
            category: 'View',
            handler: () => this.openScmView()
          });
          this.commands.registerCommand({
            id: 'workbench.actions.view.problems',
            title: 'View: Focus Problems (Errors, Warnings, Infos)',
            category: 'View',
            handler: () => this.openProblemsPanel()
          });
          this.commands.registerCommand({
            id: 'workbench.action.gotoLine',
            title: 'Go: Go to Line/Column...',
            category: 'Go',
            handler: () => this.promptGoToLine()
          });
          this.commands.registerCommand({
            id: 'workbench.action.marker.next',
            title: 'Go: Next Problem (Error, Warning, Info)',
            category: 'Go',
            handler: () => this.goToNextProblem(false)
          });
          this.commands.registerCommand({
            id: 'workbench.action.marker.prev',
            title: 'Go: Previous Problem (Error, Warning, Info)',
            category: 'Go',
            handler: () => this.goToNextProblem(true)
          });
          this.commands.registerCommand({
            id: 'workbench.action.openWorkspaceSettingsJson',
            title: 'Preferences: Open Workspace Settings (JSON)',
            category: 'Preferences',
            handler: () => this.openWorkspaceSettingsJson()
          });
          this.commands.registerCommand({
            id: 'workbench.action.quickOpen',
            title: 'Go to File...',
            category: 'File',
            handler: () => this.openCommandPalette('files')
          });
          this.commands.registerCommand({
            id: 'workbench.action.showCommands',
            title: 'Show All Commands',
            category: 'View',
            handler: () => this.openCommandPalette('commands')
          });
          this.commands.registerCommand({
            id: 'workbench.action.openObservability',
            title: 'Developer: Open Observability & Services Inspector',
            category: 'Developer',
            handler: () => this.switchDrawerTab('observability')
          });
          this.commands.registerCommand({
            id: 'codeLab.runCode',
            title: 'CodeLab: Run Code',
            category: 'CodeLab',
            handler: () => this.runCode()
          });
          this.commands.registerCommand({
            id: 'codeLab.runTests',
            title: 'CodeLab: Run Tests',
            category: 'CodeLab',
            handler: () => this.runTests()
          });
          this.commands.registerCommand({
            id: 'codeLab.runSql',
            title: 'SQL: Run Query',
            category: 'SQL',
            when: "editorLangId == 'sql'",
            handler: () => this.runSql('run')
          });
          this.commands.registerCommand({
            id: 'codeLab.explainSql',
            title: 'SQL: Explain Query Plan',
            category: 'SQL',
            when: "editorLangId == 'sql'",
            handler: () => this.runSql('explain')
          });
          this.commands.registerCommand({
            id: 'codeLab.formatDocument',
            title: 'Editor: Format Document',
            category: 'Editor',
            handler: () => this.formatActiveDocument()
          });
          this.commands.registerCommand({
            id: 'tasks.runTask',
            title: 'Tasks: Run Workspace Task',
            category: 'Tasks',
            handler: (taskId) => this.runTask(taskId)
          });
        }

        if (this.keybindings) {
          const defaultBindings = [
            { key: 'Mod+,', command: 'workbench.action.openSettings' },
            { key: 'Mod+s', command: 'workbench.action.files.save' },
            { key: 'Mod+b', command: 'workbench.action.toggleSidebarVisibility' },
            { key: 'Mod+j', command: 'workbench.action.togglePanel' },
            { key: 'Ctrl+`', command: 'workbench.action.terminal.toggleTerminal' },
            { key: 'Ctrl+Shift+`', command: 'workbench.action.terminal.new' },
            { key: 'Mod+Shift+e', command: 'workbench.view.explorer' },
            { key: 'Mod+Shift+f', command: 'workbench.view.search' },
            { key: 'Ctrl+Shift+g', command: 'workbench.view.scm' },
            { key: 'Mod+Shift+m', command: 'workbench.actions.view.problems' },
            { key: 'F8', command: 'workbench.action.marker.next' },
            { key: 'Shift+F8', command: 'workbench.action.marker.prev' }
          ];
          for (const kb of defaultBindings) {
            this.keybindings.registerKeybinding(kb);
          }
        }

        if (this.configuration) {
          this.configuration.onDidChangeConfiguration((e) => {
            if (!this._destroyed) {
              this._applyConfigurationChanges(e);
              if (e.source === 'user' && this.persistState) {
                safeStorageSet(`${STORAGE_PREFIX}user-settings`, this.configuration.exportProfile(), this.logger);
              }
            }
          });
        }

        if (this.plugins) {
          this.plugins.onDidChangePlugins(() => {
            if (!this._destroyed) {
              this._refreshDrawerTabs();
              if (typeof this._refreshSidebarPluginContributions === 'function') {
                this._refreshSidebarPluginContributions();
              }
            }
          });
        }
      } catch (err) {
        this.logger.warn('Modular kernel initialization failed; continuing in standalone mode.', err);
      }
    }

    _initShell() {
      this._wrapPortTable();
      this._initPortListeners();
      this._registerPreviewServiceWorker();
      if (typeof createPosixShell === 'function') {
        try {
          this.shell = createPosixShell({
            cwd: this.cwd,
            files: this.files,
            portTable: this.portTable,
            env: {
              PWD: this.cwd || '/workspace',
              TERM: 'xterm-256color',
              COLORTERM: 'truecolor',
              USER: 'codelab',
              HOME: '/home/codelab',
              NODE_ENV: 'development',
              PATH: '/usr/local/bin:/usr/bin:/bin:/workspace/node_modules/.bin'
            }
          });
          this._syncFilesToShellVfs();
        } catch (err) {
          this.logger.debug('POSIX shell initialization skipped.', err);
        }
      }
    }

    _wrapPortTable() {
      if (!this.portTable || this.portTable._clWrapped) return;
      this.portTable._clWrapped = true;
      const origDispatch = typeof this.portTable.dispatchRequest === 'function'
        ? this.portTable.dispatchRequest.bind(this.portTable)
        : null;
      if (origDispatch) {
        this.portTable.dispatchRequest = async (url, init = {}) => {
          if (this._inHttpClientDispatch) {
            return origDispatch(url, init);
          }
          const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
          let parsedPort = 3000;
          let reqPath = '/';
          let fullUrl = String(url || 'http://127.0.0.1:3000/');
          if (!/^https?:\/\//i.test(fullUrl)) {
            fullUrl = `http://127.0.0.1:3000${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
          }
          try {
            const u = new URL(fullUrl);
            parsedPort = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
            reqPath = u.pathname + (u.search || '');
          } catch (err) {
            this.logger.debug('Could not parse portTable dispatch URL.', err);
          }
          const method = String((init && init.method) || 'GET').toUpperCase();
          const fromPort = (init && init._fromPort) ? Number(init._fromPort) : null;
          try {
            const res = await origDispatch(url, init);
            const durationMs = Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
            let bodyText = '';
            try {
              if (res && typeof res.clone === 'function') {
                bodyText = await res.clone().text();
              } else if (res && res.body !== undefined) {
                bodyText = String(res.body);
              }
            } catch (err) {
              this.logger.debug('Could not read response body for HTTP trace.', err);
            }
            const responseHeaders = {};
            if (res && res.headers) {
              if (typeof res.headers.forEach === 'function') {
                res.headers.forEach((v, k) => { responseHeaders[k] = v; });
              } else {
                Object.assign(responseHeaders, res.headers);
              }
            }
            let formattedBody = bodyText;
            try {
              formattedBody = JSON.stringify(JSON.parse(bodyText), null, 2);
            } catch (err) {
              this.logger.debug('Response body is not JSON.', err);
            }
            const chaosEffect = (res && res._chaosEffect) || responseHeaders['x-codelab-chaos'] || null;
            if (!Array.isArray(this.lastHttpTrace)) this.lastHttpTrace = [];
            this.lastHttpTrace.push({
              id: 'trace_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              timestamp: new Date().toLocaleTimeString(),
              method,
              url: reqPath,
              fullUrl,
              port: parsedPort,
              fromPort,
              chaosEffect,
              status: (res && res.status) || 200,
              statusText: (res && res.statusText) || 'OK',
              durationMs,
              size: bodyText.length,
              requestHeaders: (init && init.headers) || {},
              requestBody: (init && init.body) || '',
              responseHeaders,
              responseBody: bodyText,
              formattedBody
            });
            const netPill = this.container ? this.container.querySelector('#cl-network-pill') : null;
            if (netPill) netPill.textContent = `${this.lastHttpTrace.length} reqs`;
            return res;
          } catch (err) {
            const durationMs = Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
            if (!Array.isArray(this.lastHttpTrace)) this.lastHttpTrace = [];
            const errMsg = String((err && err.message) || err);
            this.lastHttpTrace.push({
              id: 'trace_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              timestamp: new Date().toLocaleTimeString(),
              method,
              url: reqPath,
              fullUrl,
              port: parsedPort,
              fromPort,
              chaosEffect: (err && err.chaosEffect) || (err && err.code) || 'ERROR',
              status: 0,
              statusText: (err && (err.chaosEffect || err.code)) || 'ERROR',
              durationMs,
              size: 0,
              requestHeaders: (init && init.headers) || {},
              requestBody: (init && init.body) || '',
              responseHeaders: {},
              responseBody: errMsg,
              formattedBody: errMsg
            });
            const netPill = this.container ? this.container.querySelector('#cl-network-pill') : null;
            if (netPill) netPill.textContent = `${this.lastHttpTrace.length} reqs`;
            throw err;
          }
        };
      }
    }

    _normalizeWorkspaceRelPath(rawPath) {
      if (typeof rawPath !== 'string') return null;
      const trimmed = rawPath.trim();
      if (!trimmed || trimmed.includes('\0')) return null;
      const unified = trimmed.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!unified) return null;
      const segments = unified.split('/');
      const out = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg || seg === '.' || seg === '..' || seg.trim() === '') return null;
        out.push(seg);
      }
      return out.length > 0 ? out.join('/') : null;
    }

    _vfsEnsureFolder(relFolder) {
      const clean = this._normalizeWorkspaceRelPath(relFolder);
      if (!clean) return;
      if (this.shell && this.shell.vfs && typeof this.shell.vfs.mkdirSync === 'function') {
        try {
          this.shell.vfs.mkdirSync('/workspace/' + clean, { recursive: true });
        } catch (err) {
          this.logger.debug('VFS mkdirSync failed.', err);
        }
      }
      if (this.kernel && this.kernel.fs && typeof this.kernel.fs.mkdir === 'function') {
        try {
          const segments = clean.split('/');
          let cur = '/workspace';
          for (const seg of segments) {
            if (!seg) continue;
            cur += '/' + seg;
            this.kernel.fs.mkdir(cur);
          }
        } catch (err) {
          void err;
        }
      }
    }

    _vfsWriteFile(relFile, content) {
      const clean = this._normalizeWorkspaceRelPath(relFile);
      if (!clean) return;
      const text = String(content ?? '');
      if (this.shell && this.shell.vfs) {
        const vfs = this.shell.vfs;
        const absPath = '/workspace/' + clean;
        const slashIdx = absPath.lastIndexOf('/');
        try {
          if (slashIdx > 0 && typeof vfs.mkdirSync === 'function') {
            vfs.mkdirSync(absPath.slice(0, slashIdx), { recursive: true });
          }
          if (typeof vfs.writeFileSync === 'function') {
            vfs.writeFileSync(absPath, text);
          }
        } catch (err) {
          this.logger.debug('VFS writeFileSync failed.', err);
        }
      }
      if (this.kernel && this.kernel.fs && typeof this.kernel.fs.writeFile === 'function') {
        try {
          this.kernel.fs.writeFile('/workspace/' + clean, text);
        } catch (err) {
          void err;
        }
      }
    }

    _clearDiagnosticsForPath(relPath, isFolder = false) {
      const store = this._diagnosticsStore;
      if (!store || typeof store.remove !== 'function') return;
      const clean = String(relPath || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .replace(/^(?:\.\/+)+/, '');
      if (!clean) return;
      let items = [];
      if (isFolder) {
        if (typeof store.getAll === 'function') {
          const prefix = clean + '/';
          items = store.getAll().filter((d) => d && typeof d.file === 'string' && (d.file === clean || d.file.startsWith(prefix)));
        }
      } else if (typeof store.getByFile === 'function') {
        items = store.getByFile(clean);
      } else if (typeof store.getAll === 'function') {
        items = store.getAll().filter((d) => d && d.file === clean);
      }
      if (!items.length) return;
      const run = () => {
        for (let i = 0; i < items.length; i++) {
          const d = items[i];
          if (d && d.id) store.remove(d.id);
        }
      };
      if (typeof store.batch === 'function') {
        store.batch(run);
      } else {
        run();
      }
    }

    _vfsDeleteFile(relFile) {
      const clean = String(relFile || '').replace(/^\/+/, '');
      if (!clean) return;
      if (this.shell && this.shell.vfs) {
        const vfs = this.shell.vfs;
        const absPath = '/workspace/' + clean;
        try {
          if (typeof vfs.rmSync === 'function') {
            vfs.rmSync(absPath, { force: true });
          } else if (typeof vfs.unlinkSync === 'function') {
            vfs.unlinkSync(absPath);
          }
        } catch (err) {
          this.logger.debug('VFS file delete skipped.', err);
        }
      }
      if (this.kernel && this.kernel.fs && typeof this.kernel.fs.deleteFile === 'function') {
        try {
          this.kernel.fs.deleteFile('/workspace/' + clean);
        } catch (err) {
          void err;
        }
      }
      this._clearDiagnosticsForPath(clean, false);
    }

    _vfsDeleteFolder(relFolder) {
      const clean = String(relFolder || '').replace(/^\/+|\/+$/g, '');
      if (!clean) return;
      if (this.shell && this.shell.vfs) {
        const vfs = this.shell.vfs;
        const absPath = '/workspace/' + clean;
        try {
          if (typeof vfs.rmSync === 'function') {
            vfs.rmSync(absPath, { recursive: true, force: true });
          } else if (typeof vfs.rmdirSync === 'function') {
            vfs.rmdirSync(absPath);
          }
        } catch (err) {
          this.logger.debug('VFS folder delete skipped.', err);
        }
      }
      if (this.kernel && this.kernel.fs && typeof this.kernel.fs.deleteFile === 'function') {
        try {
          this.kernel.fs.deleteFile('/workspace/' + clean, { recursive: true });
        } catch (err) {
          void err;
        }
      }
      this._clearDiagnosticsForPath(clean, true);
    }

    _vfsRenamePath(oldRel, newRel, isFolder = false) {
      const cleanOld = String(oldRel || '').replace(/^\/+|\/+$/g, '');
      const cleanNew = this._normalizeWorkspaceRelPath(newRel);
      if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;
      if (this.shell && this.shell.vfs) {
        const vfs = this.shell.vfs;
        const absOld = '/workspace/' + cleanOld;
        const absNew = '/workspace/' + cleanNew;
        const slashIdx = absNew.lastIndexOf('/');
        try {
          if (slashIdx > 0 && typeof vfs.mkdirSync === 'function') {
            vfs.mkdirSync(absNew.slice(0, slashIdx), { recursive: true });
          }
          if (typeof vfs.renameSync === 'function' && typeof vfs.existsSync === 'function' && vfs.existsSync(absOld)) {
            vfs.renameSync(absOld, absNew);
          } else if (!isFolder) {
            if (typeof vfs.writeFileSync === 'function') {
              vfs.writeFileSync(absNew, String(this.files[cleanNew] ?? ''));
            }
            if (typeof vfs.rmSync === 'function') {
              vfs.rmSync(absOld, { force: true });
            } else if (typeof vfs.unlinkSync === 'function') {
              vfs.unlinkSync(absOld);
            }
          }
        } catch (err) {
          this.logger.debug('VFS rename fallback executed.', err);
          if (isFolder) {
            this._vfsDeleteFolder(cleanOld);
            this._syncFilesToShellVfs();
          } else {
            this._vfsDeleteFile(cleanOld);
            this._vfsWriteFile(cleanNew, this.files[cleanNew]);
          }
        }
      }
      if (this.kernel && this.kernel.fs) {
        try {
          if (typeof this.kernel.fs.rename === 'function') {
            this.kernel.fs.rename('/workspace/' + cleanOld, '/workspace/' + cleanNew);
          } else if (typeof this.kernel.fs.loadRecord === 'function') {
            this.kernel.fs.loadRecord(this.files, '/workspace');
          }
        } catch (err) {
          void err;
        }
      }
    }

    _pruneWorkspaceVfs(keepGitDir = false) {
      if (this.shell && this.shell.vfs) {
        const vfs = this.shell.vfs;
        try {
          if (typeof vfs.readdirSync === 'function' && typeof vfs.existsSync === 'function') {
            if (!vfs.existsSync('/workspace')) {
              if (typeof vfs.mkdirSync === 'function') vfs.mkdirSync('/workspace', { recursive: true });
            } else {
              const entries = vfs.readdirSync('/workspace') || [];
              for (const entry of entries) {
                const name = typeof entry === 'string' ? entry : (entry && entry.name);
                if (!name) continue;
                if (keepGitDir && name === '.git') continue;
                const abs = '/workspace/' + name;
                if (typeof vfs.rmSync === 'function') {
                  vfs.rmSync(abs, { recursive: true, force: true });
                } else if (typeof vfs.unlinkSync === 'function') {
                  try { vfs.unlinkSync(abs); } catch (_e) { void _e; }
                }
              }
            }
          }
        } catch (err) {
          this.logger.debug('Could not prune /workspace VFS.', err);
        }
      }
      if (this.kernel && this.kernel.fs && typeof this.kernel.fs.deleteFile === 'function') {
        const kfs = this.kernel.fs;
        try {
          if (typeof kfs.readdir === 'function') {
            if (typeof kfs.exists === 'function' && !kfs.exists('/workspace')) {
              if (typeof kfs.mkdir === 'function') kfs.mkdir('/workspace');
            } else {
              const kEntries = kfs.readdir('/workspace') || [];
              for (const entry of kEntries) {
                const name = typeof entry === 'string' ? entry : (entry && entry.name);
                if (!name) continue;
                if (keepGitDir && name === '.git') continue;
                try {
                  kfs.deleteFile('/workspace/' + name, { recursive: true });
                } catch (_e) {
                  void _e;
                }
              }
            }
          } else if (typeof kfs.toRecord === 'function') {
            const existing = kfs.toRecord('/workspace') || {};
            for (const rel of Object.keys(existing)) {
              const clean = String(rel || '').replace(/^\/+/, '');
              if (!clean) continue;
              if (keepGitDir && (clean === '.git' || clean.startsWith('.git/'))) continue;
              if (!Object.prototype.hasOwnProperty.call(this.files || {}, clean)) {
                try {
                  kfs.deleteFile('/workspace/' + clean, { recursive: true });
                } catch (_e) {
                  void _e;
                }
              }
            }
          }
        } catch (err) {
          void err;
        }
      }
    }

    _copyVfsTree(srcVfs, dstVfs, srcDir) {
      if (!srcVfs || !dstVfs || srcVfs === dstVfs) return;
      if (typeof srcVfs.existsSync !== 'function' || !srcVfs.existsSync(srcDir)) return;
      const statFn = typeof srcVfs.lstatSync === 'function'
        ? (p) => srcVfs.lstatSync(p)
        : (typeof srcVfs.statSync === 'function' ? (p) => srcVfs.statSync(p) : null);
      if (!statFn || typeof srcVfs.readdirSync !== 'function') return;

      const walk = (curr) => {
        let st = null;
        try { st = statFn(curr); } catch (_e) { return; }
        if (!st) return;
        if (typeof st.isDirectory === 'function' && st.isDirectory()) {
          if (typeof dstVfs.mkdirSync === 'function') {
            try { dstVfs.mkdirSync(curr, { recursive: true }); } catch (_e) { void _e; }
          }
          let entries = [];
          try { entries = srcVfs.readdirSync(curr) || []; } catch (_e) { entries = []; }
          for (const entry of entries) {
            const name = typeof entry === 'string' ? entry : (entry && entry.name);
            if (!name || name === '.' || name === '..') continue;
            const child = curr === '/' ? `/${name}` : `${curr}/${name}`;
            walk(child);
          }
          return;
        }
        const slash = curr.lastIndexOf('/');
        if (slash > 0 && typeof dstVfs.mkdirSync === 'function') {
          try { dstVfs.mkdirSync(curr.slice(0, slash), { recursive: true }); } catch (_e) { void _e; }
        }
        if (typeof st.isSymbolicLink === 'function' && st.isSymbolicLink() && st.symlinkTarget && typeof dstVfs.symlinkSync === 'function') {
          try {
            dstVfs.symlinkSync(st.symlinkTarget, curr);
            if (st.mode !== undefined && typeof dstVfs.chmodSync === 'function') {
              dstVfs.chmodSync(curr, st.mode);
            }
            return;
          } catch (_e) { void _e; }
        }
        if (typeof srcVfs.readFileSync === 'function' && typeof dstVfs.writeFileSync === 'function') {
          try {
            const raw = srcVfs.readFileSync(curr);
            dstVfs.writeFileSync(curr, raw);
            if (st.mode !== undefined && typeof dstVfs.chmodSync === 'function') {
              dstVfs.chmodSync(curr, st.mode);
            }
          } catch (_e) { void _e; }
        }
      };

      const cleanRoot = String(srcDir || '/workspace').replace(/\/+$/, '') || '/';
      walk(cleanRoot);
    }

    _collectCleanVfsFolders(vfs, rootDir = '/workspace') {
      const out = [];
      if (!vfs || typeof vfs.readdirSync !== 'function' || typeof vfs.statSync !== 'function') return out;
      const hiddenVfsSegRe = /(?:^|\/)(?:\.git|node_modules)(?:\/|$)/;
      const walk = (dir, relPrefix) => {
        let entries = [];
        try { entries = vfs.readdirSync(dir) || []; } catch (_e) { return; }
        for (const entry of entries) {
          const name = typeof entry === 'string' ? entry : (entry && entry.name);
          if (!name || name === '.' || name === '..' || name === '.git' || name === 'node_modules') continue;
          const full = dir === '/' ? `/${name}` : `${dir}/${name}`;
          const rel = relPrefix ? `${relPrefix}/${name}` : name;
          if (hiddenVfsSegRe.test(rel)) continue;
          let isDir = false;
          try { isDir = vfs.statSync(full).isDirectory(); } catch (_e) { isDir = false; }
          if (isDir) {
            out.push(rel);
            walk(full, rel);
          }
        }
      };
      walk(rootDir, '');
      return out;
    }

    _syncFilesToShellVfs(opts = {}) {
      if (opts && opts.pruneExtraneous) {
        this._pruneWorkspaceVfs(Boolean(opts.keepGitDir));
      }
      if (this.shell && this.shell.vfs) {
        const vfs = this.shell.vfs;
        try {
          if (typeof vfs.mkdirSync === 'function') {
            vfs.mkdirSync('/workspace', { recursive: true });
            for (const folder of (this.folders || [])) {
              const cf = this._normalizeWorkspaceRelPath(folder);
              if (cf) vfs.mkdirSync('/workspace/' + cf, { recursive: true });
            }
          }
          for (const [relPath, content] of Object.entries(this.files || {})) {
            const clean = this._normalizeWorkspaceRelPath(relPath);
            if (!clean) continue;
            const absPath = '/workspace/' + clean;
            const slashIdx = absPath.lastIndexOf('/');
            if (slashIdx > 0 && typeof vfs.mkdirSync === 'function') {
              vfs.mkdirSync(absPath.slice(0, slashIdx), { recursive: true });
            }
            if (typeof vfs.writeFileSync === 'function') {
              vfs.writeFileSync(absPath, String(content ?? ''));
            }
          }
        } catch (err) {
          this.logger.debug('Could not sync files to shell VFS.', err);
        }
      }
      if (this.kernel && this.kernel.fs) {
        const kfs = this.kernel.fs;
        try {
          if (typeof kfs.mkdir === 'function') {
            kfs.mkdir('/workspace');
            for (const folder of (this.folders || [])) {
              const cf = this._normalizeWorkspaceRelPath(folder);
              if (cf) {
                try { kfs.mkdir('/workspace/' + cf); } catch (_e) { void _e; }
              }
            }
          }
          if (typeof kfs.loadRecord === 'function') {
            kfs.loadRecord(this.files || {}, '/workspace');
          } else if (typeof kfs.writeFile === 'function') {
            for (const [relPath, content] of Object.entries(this.files || {})) {
              const clean = this._normalizeWorkspaceRelPath(relPath);
              if (clean) {
                try { kfs.writeFile('/workspace/' + clean, String(content ?? '')); } catch (_e) { void _e; }
              }
            }
          }
        } catch (err) {
          this.logger.debug('Could not sync files to kernel VFS.', err);
        }
      }
    }

    _emitEvent(name, detail) {
      const shortName = String(name).replace(/^codelab:/, '');
      const fullName = shortName === name ? `codelab:${name}` : name;
      if (this._eventListeners) {
        for (const key of new Set([name, shortName, fullName])) {
          const handlers = this._eventListeners.get(key);
          if (handlers) {
            for (const fn of Array.from(handlers)) {
              try { fn(detail); } catch (err) { this.logger.error(`Listener for "${key}" threw.`, err); }
            }
          }
        }
      }
      if (!this.container || typeof CustomEvent === 'undefined') return;
      try {
        this.container.dispatchEvent(new CustomEvent(fullName, { detail, bubbles: true, composed: true }));
        if (shortName !== fullName) {
          this.container.dispatchEvent(new CustomEvent(shortName, { detail, bubbles: true, composed: true }));
        }
      } catch (err) {
        this.logger.debug(`CustomEvent dispatch for "${name}" failed.`, err);
      }
    }

    _resolvedTheme() {
      if (this.themeOption === 'light' || this.themeOption === 'dark' || this.themeOption === 'high-contrast') {
        return this.themeOption;
      }
      if (typeof document !== 'undefined' && document.documentElement && typeof document.documentElement.getAttribute === 'function') {
        const docTheme = document.documentElement.getAttribute('data-theme');
        if (docTheme === 'light' || docTheme === 'high-contrast') return docTheme;
        if (docTheme === 'dark') return 'dark';
      }
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        try {
          if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        } catch (err) {
          _bootDebug('matchMedia color-scheme check failed', err);
        }
      }
      return 'dark';
    }

    _normalizeDrawerTabId(rawTab) {
      const valid = new Set([
        'problems', 'output', 'terminal', 'ports', 'tests',
        'stdin', 'preview', 'network', 'inspector', 'observability', 'sql-results'
      ]);
      if (typeof rawTab === 'string' && valid.has(rawTab)) return rawTab;
      return 'terminal';
    }

    _resolveConfiguredSqlDialect() {
      if (!this.configuration || typeof this.configuration.inspect !== 'function') {
        return null;
      }
      const defInsp = this.configuration.inspect('sql.defaultDialect');
      const legInsp = this.configuration.inspect('sql.dialect');
      const candidates = [
        defInsp && defInsp.overrideValue,
        legInsp && legInsp.overrideValue,
        defInsp && defInsp.workspaceValue,
        legInsp && legInsp.workspaceValue,
        defInsp && defInsp.userValue,
        legInsp && legInsp.userValue
      ];
      for (const cand of candidates) {
        if (cand === 'sqlite' || cand === 'postgres') return cand;
      }
      return null;
    }

    _applyInitialWorkbenchConfig() {
      if (!this.configuration) return;
      if (!this._explicitThemeOption) {
        const themeInsp = typeof this.configuration.inspect === 'function'
          ? this.configuration.inspect('workbench.colorTheme')
          : null;
        if (themeInsp && themeInsp.effectiveSource !== 'default' && themeInsp.effectiveValue) {
          const ct = themeInsp.effectiveValue;
          if (ct === 'dark' || ct === 'light' || ct === 'high-contrast') {
            this.themeOption = ct;
          }
        }
      }
      if (typeof this.options.sidebarVisible !== 'boolean' && typeof this.savedState?.sidebarVisible !== 'boolean') {
        this.sidebarVisible = this.configuration.get('workbench.sideBar.visible', true) !== false;
      }
      if (!this._explicitDrawerTabOption && !this.savedState?.drawerTab) {
        const defTabInsp = typeof this.configuration.inspect === 'function'
          ? this.configuration.inspect('workbench.panel.defaultTab')
          : null;
        if (defTabInsp && defTabInsp.effectiveSource !== 'default' && defTabInsp.effectiveValue) {
          const candidate = this._normalizeDrawerTabId(String(defTabInsp.effectiveValue));
          if (candidate === 'sql-results' && this.lang !== 'sql') {
            this.drawerTab = 'terminal';
          } else {
            this.drawerTab = candidate;
          }
        }
      }
      if (!this._explicitSqlDialectOption) {
        const cfgDialect = this._resolveConfiguredSqlDialect();
        if (cfgDialect === 'sqlite' || cfgDialect === 'postgres') {
          this.sqlDialect = cfgDialect;
          if (this.lang === 'sql') {
            this.runtimeStatusText = `${this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18'} · Idle`;
          }
        }
      }
    }

    _runInitialFolderOpenTasks() {
      if (!Array.isArray(this._workspaceTasks) || this._workspaceTasks.length === 0) return;
      for (const t of this._workspaceTasks) {
        if (t && t.runOn === 'folderOpen' && (t.id || t.label)) {
          this.runTask(t.id || t.label).catch((err) => {
            this.logger.warn('folderOpen task failed.', err);
          });
        }
      }
    }

    setTheme(nextTheme) {
      const normalized = (nextTheme === 'light' || nextTheme === 'dark' || nextTheme === 'high-contrast' || nextTheme === 'auto')
        ? nextTheme
        : 'dark';
      this.themeOption = normalized;
      this.theme = normalized;
      const resolved = this._resolvedTheme();
      if (this.themes && typeof this.themes.setTheme === 'function' && !this._applyingThemeFromService) {
        try {
          this._applyingThemeFromService = true;
          this.themes.setTheme(resolved === 'light' ? 'light' : resolved === 'high-contrast' ? 'high-contrast' : 'dark');
        } catch (err) {
          this.logger.debug('themes.setTheme failed.', err);
        } finally {
          this._applyingThemeFromService = false;
        }
      }
      if (this.container) {
        const shellEl = this.container.querySelector('.codelab');
        if (shellEl) shellEl.classList.add('is-switching-theme');
        this.container.classList.remove('codelab-workbench--dark', 'codelab-workbench--light', 'codelab-workbench--high-contrast');
        if (normalized === 'auto') {
          if (typeof this.container.removeAttribute === 'function') this.container.removeAttribute('data-theme');
        } else {
          this.container.setAttribute('data-theme', normalized);
          this.container.classList.add(`codelab-workbench--${normalized}`);
        }
        if (shellEl) {
          shellEl.setAttribute('data-cl-theme', resolved);
          if (typeof document !== 'undefined' && document.documentElement && typeof document.documentElement.setAttribute === 'function') {
            try {
              document.documentElement.setAttribute('data-theme', resolved);
            } catch (_err) {
              void _err;
            }
          }
          if (normalized === 'auto') {
            if (typeof shellEl.removeAttribute === 'function') shellEl.removeAttribute('data-theme');
          } else {
            shellEl.setAttribute('data-theme', normalized);
            if (this.themes && typeof this.themes.applyToElement === 'function' && shellEl.style && typeof shellEl.style.setProperty === 'function') {
              try {
                this.themes.applyToElement(shellEl);
              } catch (err) {
                this.logger.debug('themes.applyToElement failed.', err);
              }
            }
          }
          if (shellEl.style) {
            const schemeVal = resolved === 'light' ? 'light' : 'dark';
            if (typeof shellEl.style.setProperty === 'function') {
              shellEl.style.setProperty('color-scheme', schemeVal);
            } else {
              shellEl.style.colorScheme = schemeVal;
            }
          }
          try {
            void shellEl.offsetWidth;
          } catch (err) {
            void err;
          }
          shellEl.classList.remove('is-switching-theme');
        }
      }
      if (this.monaco && this.monaco.editor && typeof this.monaco.editor.setTheme === 'function') {
        const monacoTheme = resolved === 'light'
          ? 'codelab-light'
          : resolved === 'high-contrast'
            ? 'codelab-hc-dark'
            : 'codelab-dark';
        try {
          this.monaco.editor.setTheme(monacoTheme);
        } catch (err) {
          this.logger.debug('monaco.editor.setTheme failed.', err);
        }
      }
      if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.setTheme === 'function') {
        try {
          this._sqlWorkbenchEditor.setTheme(resolved === 'light' ? 'light' : 'dark');
        } catch (err) {
          this.logger.debug('_sqlWorkbenchEditor.setTheme failed.', err);
        }
      }
      if (
        !this._applyingConfigTheme &&
        normalized !== 'auto' &&
        this.configuration &&
        typeof this.configuration.setUserSetting === 'function'
      ) {
        const curCfg = this.configuration.get('workbench.colorTheme', 'dark');
        if (curCfg !== normalized) {
          this._applyingConfigTheme = true;
          try {
            const hadWsOverride =
              typeof this.configuration.inspect === 'function' &&
              this.configuration.inspect('workbench.colorTheme').workspaceValue !== undefined;
            this.configuration.setUserSetting('workbench.colorTheme', normalized);
            if (hadWsOverride && typeof this.configuration.setWorkspaceSetting === 'function') {
              this.configuration.setWorkspaceSetting('workbench.colorTheme', normalized);
              this._persistWorkspaceSettingsFromUi();
            }
          } catch (err) {
            this.logger.debug('Syncing workbench.colorTheme failed.', err);
          } finally {
            this._applyingConfigTheme = false;
          }
        }
      }
      // Relay color-scheme/theme to preview iframes explicitly (Safari does not inherit color-scheme into iframes)
      if (this.container && typeof this.container.querySelectorAll === 'function') {
        const frames = this.container.querySelectorAll('.codelab-preview-frame, iframe[data-cl-preview-frame]');
        frames.forEach((frame) => {
          try {
            if (frame && frame.contentWindow && typeof frame.contentWindow.postMessage === 'function') {
              frame.contentWindow.postMessage({ type: 'codelab:theme-change', theme: resolved }, '*');
            }
          } catch (err) {
            this.logger.debug('Preview iframe theme postMessage skipped.', err);
          }
        });
      }
      this._emitEvent('theme-change', { theme: normalized, resolvedTheme: resolved });
      return this;
    }

    getTheme() {
      return this.themeOption || 'auto';
    }

    _storageKey() {
      return `${STORAGE_PREFIX}${this.labId}`;
    }

    _sessionStorageKey() {
      return `sd-codelab-session-v1:${this.labId}`;
    }

    _getWorkspaceStorageMod() {
      return root.CodeLabStorage || root.CodeLabWorkspaceStorage || null;
    }

    _registerWorkspaceMetaInStorage(metaOverrides = {}) {
      if (!this.persistState) return null;
      const wsMod = this._getWorkspaceStorageMod();
      if (!wsMod || typeof wsMod.upsertWorkspaceMeta !== 'function') return null;
      const fileCount = Object.keys(this.files || {}).length;
      const repoSlug = (metaOverrides && metaOverrides.repo) || this.repo || (this.options && this.options.repo) || undefined;
      const defaultKind = repoSlug
        ? 'repo'
        : (this._isBlankBase || String(this.labId || '').startsWith('workspace-') || String(this.labId || '').startsWith('blank-'))
          ? 'blank'
          : this.hasGuidedLab
            ? 'guided'
            : this.lang === 'sql'
              ? 'sql'
              : 'custom';
      try {
        return wsMod.upsertWorkspaceMeta({
          labId: this.labId,
          title: this.title || this.labId,
          kind: defaultKind,
          ...(typeof repoSlug === 'string' && repoSlug ? { repo: repoSlug } : {}),
          fileCount,
          updatedAt: Date.now(),
          ...metaOverrides
        });
      } catch (err) {
        this.logger.debug('upsertWorkspaceMeta skipped.', err);
        return null;
      }
    }

    _serializeGitState() {
      const gs = this.shell && this.shell.gitState ? this.shell.gitState : this._gitState;
      if (!gs || !gs.initialized) {
        return { initialized: false };
      }
      const stagedEntries = [];
      if (gs.staged instanceof Map) {
        for (const [k, v] of gs.staged.entries()) {
          stagedEntries.push([k, v === null ? null : String(v)]);
        }
      } else if (gs.staged && typeof gs.staged[Symbol.iterator] === 'function') {
        for (const item of gs.staged) {
          if (typeof item === 'string') {
            const cur = Object.prototype.hasOwnProperty.call(this.files || {}, item) ? this.files[item] : null;
            stagedEntries.push([item, cur]);
          } else if (Array.isArray(item) && item.length >= 2) {
            stagedEntries.push([item[0], item[1] === null ? null : String(item[1])]);
          }
        }
      }
      const branchHeads = {};
      if (gs.branchHeads && typeof gs.branchHeads === 'object') {
        for (const [bName, bInfo] of Object.entries(gs.branchHeads)) {
          if (bInfo && typeof bInfo === 'object') {
            branchHeads[bName] = {
              headCommit: String(bInfo.headCommit || ''),
              headSnapshot: { ...(bInfo.headSnapshot || {}) },
              commits: Array.isArray(bInfo.commits) ? bInfo.commits.slice(0, 50) : []
            };
          }
        }
      }
      return {
        initialized: true,
        branch: gs.branch || 'main',
        branches: gs.branches ? Array.from(gs.branches) : [gs.branch || 'main'],
        headCommit: gs.headCommit || '',
        headSnapshot: { ...(gs.headSnapshot || gs.headFiles || {}) },
        stagedEntries,
        commits: Array.isArray(gs.commits) ? gs.commits.slice(0, 50) : [],
        branchHeads,
        remoteUrl: gs.remoteUrl || null,
        remotes: gs.remotes ? { ...gs.remotes } : {}
      };
    }

    _syncGitHeadState(gs, nextSnapshot) {
      if (!gs || typeof gs !== 'object') return {};
      const scmMod = root.CodeLabScm;
      if (scmMod && typeof scmMod.syncGitHead === 'function') {
        return scmMod.syncGitHead(gs, nextSnapshot);
      }
      const src = nextSnapshot !== undefined
        ? (nextSnapshot && typeof nextSnapshot === 'object' ? nextSnapshot : {})
        : (gs.headFiles || gs.headSnapshot || {});
      const synced = { ...src };
      gs.headFiles = synced;
      gs.headSnapshot = synced;
      return synced;
    }

    _restoreSavedGitState(savedGit) {
      const gs = this.shell && this.shell.gitState ? this.shell.gitState : this._gitState;
      if (!gs) return;
      if (!savedGit || !savedGit.initialized) {
        if (this.shell && this.shell.vfs && typeof this.shell.vfs.rmSync === 'function') {
          try {
            this.shell.vfs.rmSync('/workspace/.git', { recursive: true, force: true });
          } catch (_e) { void _e; }
        }
        gs.initialized = false;
        gs.branch = 'main';
        gs.branches = new Set(['main']);
        gs.headCommit = '';
        this._syncGitHeadState(gs, {});
        if (gs.staged && typeof gs.staged.clear === 'function') gs.staged.clear();
        if (gs.stagedFiles && typeof gs.stagedFiles.clear === 'function') gs.stagedFiles.clear();
        gs.commits = [];
        gs.remoteUrl = null;
        gs.remotes = {};
        return;
      }
      const branch = savedGit.branch || 'main';
      if (this.shell && this.shell.vfs && typeof this.shell.vfs.mkdirSync === 'function' && typeof this.shell.vfs.writeFileSync === 'function') {
        try {
          this.shell.vfs.mkdirSync('/workspace/.git/refs/heads', { recursive: true });
          this.shell.vfs.writeFileSync('/workspace/.git/HEAD', `ref: refs/heads/${branch}\n`);
          if (savedGit.headCommit) {
            this.shell.vfs.writeFileSync(`/workspace/.git/refs/heads/${branch}`, `${savedGit.headCommit}\n`);
          }
        } catch (_e) { void _e; }
      }
      gs.initialized = true;
      gs.branch = branch;
      gs.branches = new Set(Array.isArray(savedGit.branches) && savedGit.branches.length > 0 ? savedGit.branches : [branch]);
      gs.headCommit = savedGit.headCommit || '';
      const rawHead = (savedGit.headSnapshot && typeof savedGit.headSnapshot === 'object')
        ? savedGit.headSnapshot
        : ((savedGit.headFiles && typeof savedGit.headFiles === 'object') ? savedGit.headFiles : {});
      this._syncGitHeadState(gs, rawHead);
      if (gs.staged && typeof gs.staged.clear === 'function') gs.staged.clear();
      if (gs.stagedFiles && typeof gs.stagedFiles.clear === 'function') gs.stagedFiles.clear();
      if (Array.isArray(savedGit.stagedEntries) && gs.staged) {
        if (gs.staged instanceof Map) {
          for (const entry of savedGit.stagedEntries) {
            if (Array.isArray(entry) && entry.length >= 2) {
              gs.staged.set(entry[0], entry[1]);
            }
          }
        } else if (typeof gs.staged.add === 'function') {
          for (const entry of savedGit.stagedEntries) {
            if (Array.isArray(entry) && entry[0]) gs.staged.add(entry[0]);
          }
        }
      }
      gs.commits = Array.isArray(savedGit.commits) ? savedGit.commits.slice() : [];
      gs.branchHeads = (savedGit.branchHeads && typeof savedGit.branchHeads === 'object')
        ? JSON.parse(JSON.stringify(savedGit.branchHeads))
        : {};
      gs.remoteUrl = savedGit.remoteUrl || null;
      gs.remotes = savedGit.remotes && typeof savedGit.remotes === 'object' ? { ...savedGit.remotes } : {};
    }

    _loadState() {
      if (!this.persistState || (this.options && this.options.persistState === false)) {
        return {};
      }
      let parsed = {};
      try {
        const raw = safeStorageGet(this._storageKey(), this.logger) || safeStorageGet('sd_codelab_' + this.labId, this.logger);
        parsed = raw ? JSON.parse(raw) : {};
      } catch (err) {
        this.logger.warn(
          `Ignoring unreadable saved state for "${this.labId}".`,
          err && err.message ? err.message : err
        );
        return {};
      }
      try {
        const lsUpdatedAt = (parsed && typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt))
          ? parsed.updatedAt
          : 0;
        if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.getItem === 'function') {
          const ssRaw = sessionStorage.getItem(this._sessionStorageKey());
          if (ssRaw) {
            const ssParsed = JSON.parse(ssRaw);
            const ssUpdatedAt = (ssParsed && typeof ssParsed.updatedAt === 'number' && Number.isFinite(ssParsed.updatedAt))
              ? ssParsed.updatedAt
              : 0;
            if (ssUpdatedAt > lsUpdatedAt) {
              const mirrorRaw = safeStorageGet('sd_codelab_' + this.labId, this.logger);
              const mirrorObj = mirrorRaw ? JSON.parse(mirrorRaw) : null;
              const mirrorUpdatedAt = (mirrorObj && typeof mirrorObj.updatedAt === 'number') ? mirrorObj.updatedAt : 0;
              if (mirrorUpdatedAt > 0 && ssUpdatedAt >= mirrorUpdatedAt) {
                return ssParsed;
              }
            }
          }
        }
      } catch (err) {
        void err;
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    }

    _reportPersistenceFailure(cause) {
      const error = isCodeLabError(cause)
        ? cause
        : new CodeLabError(
            'E_SAVE',
            'Workbench state could not be persisted; changes are kept in memory. Export your workspace to keep them.',
            { cause, recoverable: true, details: { labId: this.labId } }
          );
      this.saveStatusState = 'failed';
      this.saveStatusError = error;
      this._updateStatusBar();
      this._emitEvent('save-state', { status: 'failed', state: 'failed', labId: this.labId, error });
      if (this._persistenceFailureReported) return error;
      this._persistenceFailureReported = true;
      this.logger.warn(
        'Workbench state could not be persisted; changes are kept in memory. Export your workspace to keep them.'
      );
      this._emitEvent('persistence-error', { labId: this.labId, error });
      this._emitEvent('error', error);
      return error;
    }

    _buildSavedStateSnapshot(opts = {}) {
      const key = `${this.mode}:${this.lang}`;
      const autoSaveMode = this.configuration
        ? this.configuration.get('files.autoSave', 'afterDelay')
        : 'afterDelay';
      const flushFiles = Boolean(opts && opts.flushFiles) || (
        !(opts && opts.flushSnapshotOnly) &&
        autoSaveMode !== 'off' &&
        autoSaveMode !== 'onFocusChange'
      );
      if (flushFiles || !this._savedSnapshot) {
        this._savedSnapshot = { ...(this.files || {}) };
      }
      const customFiles = Object.assign({}, (this.savedState && this.savedState.customFiles) || {});
      customFiles[key] = { ...(this._savedSnapshot || {}) };
      const hasSnapshot = Object.assign(
        {},
        (this.savedState && this.savedState.hasSnapshot) || {},
        { [key]: true }
      );
      const completedArr = Array.from(this.completedSteps);
      const state = {
        mode: this.mode,
        lang: this.lang,
        isBlankBase: Boolean(this._isBlankBase),
        activeStepIndex: this.activeStepIndex,
        completedSteps: completedArr,
        customFiles,
        hasSnapshot,
        openTabs: Array.isArray(this.openTabs) ? [...this.openTabs] : undefined,
        activeFile: this.activeFile,
        folders: Array.from(this.folders || []),
        collapsedFolders: Array.from(this.collapsedFolders || []),
        explorerFolder: this.explorerFolder || '',
        explorerWidth: typeof this.explorerWidth === 'number' ? this.explorerWidth : undefined,
        previewSplitWidth: this.previewSplitWidth || undefined,
        activeSidebarView: this.activeSidebarView || 'explorer',
        sidebarVisible: typeof this.sidebarVisible === 'boolean' ? this.sidebarVisible : true,
        panelVisible: typeof this.panelVisible === 'boolean' ? this.panelVisible : true,
        panelHeight: typeof this.panelHeight === 'number' ? this.panelHeight : undefined,
        panelMaximized: Boolean(this.panelMaximized),
        drawerTab: this.drawerTab || undefined,
        gitState: this._serializeGitState(),
        updatedAt: Date.now()
      };
      this.savedState = state;
      return { state, completedArr };
    }

    _scheduleSaveState(delayMs = -1) {
      if (!this.persistState || (this.options && this.options.persistState === false)) {
        this._buildSavedStateSnapshot({ flushFiles: true });
        this.saveStatusState = 'saved';
        this.saveStatusError = null;
        this._updateStatusBar();
        return;
      }
      const autoSaveMode = this.configuration
        ? this.configuration.get('files.autoSave', 'afterDelay')
        : 'afterDelay';
      if (autoSaveMode === 'off' || autoSaveMode === 'onFocusChange') {
        this.saveStatusState = 'dirty';
        this._updateStatusBar();
        return;
      }
      this._buildSavedStateSnapshot({ flushFiles: true });
      const configuredDelay = this.configuration
        ? Math.max(50, Math.min(30000, Number(this.configuration.get('files.autoSaveDelay', 300)) || 300))
        : 180;
      const effectiveDelay = delayMs >= 0 ? delayMs : configuredDelay;
      if (this._saveDebounceTimer) {
        clearTimeout(this._saveDebounceTimer);
      }
      this._saveDebounceTimer = setTimeout(() => {
        this._saveDebounceTimer = null;
        if (!this._destroyed) {
          this._saveState({ flushFiles: true });
        }
      }, effectiveDelay);
    }

    _markFileDirty(filename) {
      if (!filename) return;
      if (!this._dirtyFiles) this._dirtyFiles = new Set();
      const wasDirty = this._dirtyFiles.has(filename);
      this._dirtyFiles.add(filename);
      if (!wasDirty) {
        this._renderFileLists();
        this._updateStatusBar();
      }
    }

    _clearFileDirty(filename) {
      if (!this._dirtyFiles || this._dirtyFiles.size === 0) return;
      let changed = false;
      if (filename === undefined || filename === null) {
        changed = this._dirtyFiles.size > 0;
        this._dirtyFiles.clear();
      } else {
        changed = this._dirtyFiles.delete(filename);
      }
      if (changed) {
        this._renderFileLists();
        this._updateStatusBar();
      }
    }

    saveActiveFile(opts = {}) {
      const manual = !opts || opts.manual !== false;
      const saveAll = Boolean(opts && opts.all);
      const targetFile = (!saveAll && this.activeTab !== '__settings__' && this.activeFile) ? this.activeFile : null;
      let formatPromise = null;
      if (manual && targetFile) {
        const formatOnSave = this.configuration
          ? Boolean(this.configuration.get('editor.formatOnSave', false))
          : false;
        if (formatOnSave && typeof this.formatActiveDocument === 'function') {
          try {
            formatPromise = this.formatActiveDocument();
          } catch (err) {
            this.logger.debug('formatOnSave skipped.', err);
          }
        }
      }
      if (targetFile && this.files[targetFile] !== undefined) {
        this._syncDotCodelabConfig();
        this._vfsWriteFile(targetFile, this.files[targetFile]);
      } else {
        this._syncFilesToShellVfs();
      }
      if (!this._savedSnapshot) this._savedSnapshot = {};
      const autoSaveMode = this.configuration
        ? this.configuration.get('files.autoSave', 'afterDelay')
        : 'afterDelay';
      if (saveAll || !targetFile || (autoSaveMode !== 'off' && autoSaveMode !== 'onFocusChange')) {
        this._savedSnapshot = { ...(this.files || {}) };
        this._clearFileDirty();
        this._saveState({ flushFiles: true });
      } else {
        if (this.files[targetFile] !== undefined) {
          this._savedSnapshot[targetFile] = this.files[targetFile];
        } else {
          delete this._savedSnapshot[targetFile];
        }
        this._clearFileDirty(targetFile);
        this._saveState({ flushSnapshotOnly: true });
      }
      if (formatPromise && typeof formatPromise.then === 'function') {
        formatPromise.then(() => {
          if (this._destroyed) return;
          if (targetFile && this.files[targetFile] !== undefined) {
            this._vfsWriteFile(targetFile, this.files[targetFile]);
            if (this._savedSnapshot) this._savedSnapshot[targetFile] = this.files[targetFile];
          }
          this._clearFileDirty(saveAll ? undefined : targetFile);
          this._saveState({ flushSnapshotOnly: true });
        }).catch((err) => {
          this.logger.debug('Async formatOnSave completion skipped.', err);
        });
      }
      if (manual && typeof this._showToast === 'function' && targetFile) {
        this._showToast(`Saved ${targetFile}`);
      }
      return true;
    }

    saveFile(filename) {
      const clean = this._normalizeWorkspaceRelPath(filename || this.activeFile || '');
      if (!clean) return this.saveActiveFile({ manual: true });
      if (this.files[clean] !== undefined) {
        this._vfsWriteFile(clean, this.files[clean]);
        if (!this._savedSnapshot) this._savedSnapshot = {};
        this._savedSnapshot[clean] = this.files[clean];
      }
      this._clearFileDirty(clean);
      this._saveState({ flushSnapshotOnly: true });
      return true;
    }

    saveAllFiles() {
      return this.saveActiveFile({ manual: true, all: true });
    }

    saveWorkspace() {
      return this.saveActiveFile({ manual: true, all: true });
    }

    flushState() {
      if (this._saveDebounceTimer) {
        clearTimeout(this._saveDebounceTimer);
        this._saveDebounceTimer = null;
        this._saveState({ flushFiles: true });
      }
    }

    _hydrateFromAsyncStorage(opts = {}) {
      if (!this.persistState || (this.options && this.options.persistState === false)) {
        return Promise.resolve(false);
      }
      const wsMod = this._getWorkspaceStorageMod();
      if (!wsMod || typeof wsMod.createWorkspaceStorage !== 'function') {
        return Promise.resolve(false);
      }
      const forceHydrate = Boolean(opts && opts.force);
      const hasSavedKeys = Boolean(this.savedState && Object.keys(this.savedState).length > 0);
      const savedUpdatedAt = (hasSavedKeys && typeof this.savedState.updatedAt === 'number' && Number.isFinite(this.savedState.updatedAt))
        ? this.savedState.updatedAt
        : 0;
      const hydrationStartSeq = this._userEditSeq || 0;
      const targetLabId = this.labId;
      try {
        if (!this._idbStorage) {
          this._idbStorage = wsMod.createWorkspaceStorage();
        }
        const loader = this._idbStorage && typeof this._idbStorage.loadProject === 'function'
          ? this._idbStorage.loadProject(targetLabId)
          : (this._idbStorage && typeof this._idbStorage.load === 'function' ? this._idbStorage.load(targetLabId) : null);
        if (!loader || typeof loader.then !== 'function') return Promise.resolve(false);
        return Promise.resolve(loader).then((project) => {
          if (this._destroyed || !project || this.labId !== targetLabId) return false;
          const hydratedFiles = project.files && typeof project.files === 'object' ? project.files : null;
          if (!hydratedFiles || Object.keys(hydratedFiles).length === 0) return false;
          const projUpdatedAt = (typeof project.updatedAt === 'number' && Number.isFinite(project.updatedAt))
            ? project.updatedAt
            : 0;
          if (!forceHydrate && hasSavedKeys) {
            if (projUpdatedAt <= 0 || (savedUpdatedAt > 0 && projUpdatedAt <= savedUpdatedAt)) {
              return false;
            }
          }
          // Never clobber post-mount user or programmatic content edits (T2-F11-06)
          if (
            !forceHydrate && (
              (this._userEditSeq || 0) !== hydrationStartSeq ||
              this._saveDebounceTimer ||
              (this._dirtyFiles && this._dirtyFiles.size > 0)
            )
          ) {
            return false;
          }
          this.files = (hasSavedKeys || forceHydrate) ? { ...hydratedFiles } : { ...this.files, ...hydratedFiles };
          this._savedSnapshot = { ...this.files };
          for (const f of Object.keys(this.files)) {
            const parts = f.split('/');
            for (let i = 1; i < parts.length; i++) {
              this.folders.add(parts.slice(0, i).join('/'));
            }
            if ((!hasSavedKeys || forceHydrate) && !this.openTabs.includes(f) && this.openTabs.length < 8) {
              this.openTabs.push(f);
            }
          }
          if (!this.activeFile && this.openTabs.length > 0) {
            this.activeFile = this._pickDefaultFile() || this.openTabs[0];
            if (this.activeTab !== '__settings__') this.activeTab = this.activeFile;
          }
          this._syncFilesToShellVfs({ pruneExtraneous: forceHydrate });
          this._buildSavedStateSnapshot({ flushFiles: true });
          this._syncAllModels();
          this._syncDotCodelabConfig();
          this._lintAllWorkspaceFiles();
          this._renderFileLists();
          this._syncActiveFileToView();
          this._emitEvent('hydrated', { labId: this.labId, files: Object.keys(hydratedFiles) });
          return true;
        }).catch((err) => {
          this.logger.debug('Async WorkspaceStorage hydration skipped.', err);
          return false;
        });
      } catch (err) {
        this.logger.debug('WorkspaceStorage hydration initialization skipped.', err);
        return Promise.resolve(false);
      }
    }

    _saveState(opts = {}) {
      try {
        if (this._saveDebounceTimer) {
          clearTimeout(this._saveDebounceTimer);
          this._saveDebounceTimer = null;
        }
        const autoSaveMode = this.configuration
          ? this.configuration.get('files.autoSave', 'afterDelay')
          : 'afterDelay';
        const shouldFlushFiles = Boolean(opts && opts.flushFiles) || (
          !(opts && opts.flushSnapshotOnly) &&
          autoSaveMode !== 'off' &&
          autoSaveMode !== 'onFocusChange'
        );
        const { state, completedArr } = this._buildSavedStateSnapshot(opts);
        if (!this.persistState || (this.options && this.options.persistState === false)) {
          if (shouldFlushFiles) this._clearFileDirty();
          this.saveStatusState = (this._dirtyFiles && this._dirtyFiles.size > 0) ? 'dirty' : 'saved';
          this.saveStatusError = null;
          this._updateStatusBar();
          return;
        }
        this._emitEvent('save-state', { status: 'saving', state: 'saving', labId: this.labId });
        const serialized = JSON.stringify(state);
        safeStorageSet._lastError = null;
        const recordErr = (err) => { safeStorageSet._lastError = err; };
        const savedAt = (typeof state.updatedAt === 'number' && Number.isFinite(state.updatedAt))
          ? state.updatedAt
          : Date.now();
        const hostMirrorSummary = JSON.stringify({
          mode: state.mode,
          lang: state.lang,
          activeStepIndex: state.activeStepIndex,
          completedSteps: completedArr,
          activeFile: state.activeFile,
          updatedAt: savedAt
        });
        const persisted = [
          safeStorageSet(this._storageKey(), serialized, this.logger, recordErr),
          // Sync lightweight step-completion progress & compact metadata with host app sidebar trackers
          safeStorageSet('codelab_progress_' + this.labId, JSON.stringify(completedArr), this.logger, recordErr),
          safeStorageSet('sd_codelab_' + this.labId, hostMirrorSummary, this.logger, recordErr)
        ];
        try {
          if (typeof sessionStorage !== 'undefined' && sessionStorage && typeof sessionStorage.setItem === 'function') {
            sessionStorage.setItem(this._sessionStorageKey(), serialized);
          }
        } catch (err) {
          void err;
        }
        const wsMod = this._getWorkspaceStorageMod();
        if (wsMod && typeof wsMod.createWorkspaceStorage === 'function') {
          try {
            if (!this._idbStorage) {
              this._idbStorage = wsMod.createWorkspaceStorage();
            }
            const filesSnapshot = { ...(this._savedSnapshot || {}) };
            const stateSnapshot = state;
            const targetLabId = this.labId;
            const targetTitle = this.title || this.labId;
            this._idbSaveChain = Promise.resolve(this._idbSaveChain).then(() => {
              if (this._idbStorage && typeof this._idbStorage.saveProject === 'function') {
                return this._idbStorage.saveProject({
                  id: targetLabId,
                  name: targetTitle,
                  files: filesSnapshot,
                  updatedAt: savedAt
                });
              }
              if (this._idbStorage && typeof this._idbStorage.save === 'function') {
                return this._idbStorage.save(targetLabId, stateSnapshot);
              }
              return undefined;
            }).catch((err) => {
              this.logger.debug('Async WorkspaceStorage save skipped.', err);
            });
          } catch (err) {
            this.logger.debug('WorkspaceStorage initialization skipped.', err);
          }
        }
        if (!persisted.includes(false)) {
          const fileCount = Object.keys(this._savedSnapshot || this.files || {}).length;
          if (fileCount > 0 || this._isBlankBase || Boolean(this.repo) || (this.labId && (String(this.labId).startsWith('workspace-') || String(this.labId).startsWith('blank-')))) {
            this._registerWorkspaceMetaInStorage({ updatedAt: savedAt, fileCount });
          }
        }
        if (persisted.includes(false)) {
          this._reportPersistenceFailure(safeStorageSet._lastError);
        } else {
          if (shouldFlushFiles) {
            this._clearFileDirty();
          }
          this.saveStatusState = (this._dirtyFiles && this._dirtyFiles.size > 0) ? 'dirty' : 'saved';
          this.saveStatusError = null;
          this._updateStatusBar();
          this._emitEvent('save-state', { status: this.saveStatusState, state: this.saveStatusState, labId: this.labId });
        }
      } catch (err) {
        this.logger.error(
          'Failed to save workbench state.',
          err && err.message ? err.message : err
        );
        this._reportPersistenceFailure(err);
      }
    }

    _detectPackages() {
      const builtins = new Set([
        'assert', 'assert/strict', 'buffer', 'child_process', 'crypto', 'dns',
        'events', 'fs', 'fs/promises', 'http', 'https', 'net', 'os', 'path',
        'perf_hooks', 'process', 'querystring', 'stream', 'string_decoder',
        'test', 'timers', 'timers/promises', 'url', 'util', 'zlib',
        'bun', 'bun:test', 'bun:sqlite'
      ]);
      const npmSet = new Set();
      const builtinSet = new Set();
      let pkgJsonDeps = {};

      if (this.files['package.json']) {
        try {
          const parsed = JSON.parse(this.files['package.json']);
          pkgJsonDeps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
          for (const [dep, ver] of Object.entries(pkgJsonDeps)) {
            npmSet.add(ver && ver !== '*' && ver !== 'latest' ? `${dep}@${String(ver).replace(/^[\^~]/, '')}` : dep);
          }
        } catch (err) {
          this.logger.debug('Malformed package.json while detecting dependencies.', err);
        }
      }

      const reqRe = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
      const impRe = /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?(['"])([^'"]+)\1/g;

      for (const [fname, content] of Object.entries(this.files || {})) {
        if (!/\.(js|ts|mjs|cjs)$/i.test(fname)) continue;
        const src = String(content || '');
        for (const regex of [reqRe, impRe]) {
          regex.lastIndex = 0;
          let m;
          while ((m = regex.exec(src)) !== null) {
            const spec = m[2].trim();
            if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue;
            if (spec.startsWith('node:') || spec.startsWith('bun:')) {
              builtinSet.add(spec);
            } else if (spec === 'bun') {
              builtinSet.add('bun');
            } else {
              const bare = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
              if (builtins.has(spec) || builtins.has(bare)) {
                builtinSet.add(`node:${spec}`);
              } else {
                npmSet.add(spec);
              }
            }
          }
        }
      }
      return {
        npmPackages: Array.from(npmSet),
        builtinModules: Array.from(builtinSet).sort(),
        pkgJsonDeps
      };
    }

    _setRuntimeStatus(state, text) {
      this.runtimeStatusState = state || 'idle';
      this.runtimeStatusText = text || 'Node.js v22 Worker · Idle';
      this._updateStatusBar();
    }

    _updateStatusBar() {
      if (!this.container) return;
      const dotEl = this.container.querySelector('#cl-status-dot');
      const textEl = this.container.querySelector('#cl-status-text');
      const fileEl = this.container.querySelector('#cl-status-file');
      const saveEl = this.container.querySelector('#cl-status-save');
      const durEl = this.container.querySelector('#cl-status-duration');
      const curEl = this.container.querySelector('#cl-status-cursor');
      const indentEl = this.container.querySelector('#cl-status-indent');
      const langEl = this.container.querySelector('#cl-status-lang');
      const scmTextEl = this.container.querySelector('#cl-status-scm-text');
      const probsTextEl = this.container.querySelector('#cl-status-problems-text');

      if (dotEl) {
        dotEl.className = 'codelab-statusbar__dot' +
          (this.runtimeStatusState === 'running' || this.runtimeStatusState === 'fetching' ? ' is-running' :
           this.runtimeStatusState === 'error' ? ' is-error' : '');
      }
      if (textEl) textEl.textContent = this.runtimeStatusText;
      if (fileEl) {
        fileEl.textContent = this.activeTab === '__settings__'
          ? 'Settings'
          : (this.activeFile || 'workspace');
      }
      if (scmTextEl) {
        const gs = typeof this._getGitState === 'function' ? this._getGitState() : (this.shell && this.shell.gitState);
        const gitBranch = gs && gs.initialized
          ? (gs.branch || 'main')
          : 'git';
        scmTextEl.textContent = gitBranch;
      }
      if (typeof this._updateScmActivityBadge === 'function') {
        this._updateScmActivityBadge();
      }
      if (probsTextEl) {
        let errs = 0;
        let warns = 0;
        if (this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function') {
          const storeItems = this._diagnosticsStore.getAll();
          for (const p of storeItems) {
            if (p && p.severity === 'error') errs++;
            else if (p && p.severity === 'warning') warns++;
          }
        }
        probsTextEl.textContent = `⊗ ${errs} ⚠ ${warns}`;
      }
      const hasDirty = Boolean((this._dirtyFiles && this._dirtyFiles.size > 0) || this.saveStatusState === 'dirty');
      if (saveEl) {
        if (this.saveStatusState === 'failed') {
          saveEl.style.display = 'inline-flex';
          saveEl.className = 'codelab-statusbar__item codelab-statusbar__save is-failed';
          saveEl.textContent = '⚠ Save failed (session-only)';
          const reason = this.saveStatusError && this.saveStatusError.message
            ? this.saveStatusError.message
            : 'localStorage is unavailable or quota exceeded';
          saveEl.setAttribute('title', `State is stored in memory only: ${reason}`);
          saveEl.setAttribute('data-save-state', 'failed');
        } else if (hasDirty) {
          saveEl.style.display = 'inline-flex';
          saveEl.className = 'codelab-statusbar__item codelab-statusbar__save is-dirty';
          saveEl.textContent = '● Unsaved';
          saveEl.setAttribute('title', 'Unsaved changes (Ctrl/Cmd+S to save)');
          saveEl.setAttribute('data-save-state', 'dirty');
        } else {
          saveEl.style.display = 'none';
          saveEl.className = 'codelab-statusbar__item codelab-statusbar__save';
          saveEl.textContent = '';
          saveEl.removeAttribute('title');
          saveEl.setAttribute('data-save-state', 'saved');
        }
      }
      if (durEl) {
        const ms = (typeof this.lastDurationMs === 'number' && !Number.isNaN(this.lastDurationMs))
          ? this.lastDurationMs
          : this.lastRunDurationMs;
        if (typeof ms === 'number' && !Number.isNaN(ms)) {
          durEl.style.display = 'inline-flex';
          durEl.textContent = `⚡ ${ms.toFixed(1)}ms`;
        } else {
          durEl.style.display = 'none';
        }
      }
      if (curEl) {
        const showCursor = Boolean(this.activeFile && this.openTabs && this.openTabs.length > 0 && this.activeTab !== '__settings__');
        curEl.style.display = showCursor ? 'inline-flex' : 'none';
        if (showCursor && this.cursorPos) {
          curEl.textContent = `Ln ${this.cursorPos.lineNumber || 1}, Col ${this.cursorPos.column || 1}`;
        }
      }
      if (indentEl) {
        const tabSize = this.configuration
          ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
          : 2;
        indentEl.textContent = `Spaces: ${tabSize}`;
      }
      if (langEl) {
        if (this.activeTab === '__settings__') {
          langEl.textContent = 'Settings (UI)';
        } else {
          langEl.textContent = this.lang === 'sql'
            ? (this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18')
            : this.lang === 'cpp'
              ? 'C++20 (Clang/WASI)'
              : this.lang === 'py'
                ? 'Python 3.12 (CPython WASI)'
                : this.lang === 'ts'
                  ? 'TypeScript 5.x'
                  : 'JavaScript (CJS/ESM)';
        }
      }
      if (typeof this._updateScmActivityBadge === 'function') {
        this._updateScmActivityBadge();
      }
      this._updateTelemetryHud();
    }

    _getBaseFilesForModeAndLang(mode, lang) {
      if (this._hasExplicitFilesProp && !this.hasGuidedLab && this.referenceFiles && Object.keys(this.referenceFiles).length > 0) {
        return { ...this.referenceFiles };
      }
      const baseJsSolution = { ...this.referenceFiles };
      const baseJsStarter = {
        ...this.referenceFiles,
        ...(this.guidedConfig?.starterFiles || {})
      };
      if (
        mode === 'guided' &&
        (
          this.guidedConfig?.starterFiles ||
          this.guidedConfig?.tsStarterFiles ||
          this.guidedConfig?.cppStarterFiles ||
          this.guidedConfig?.pyStarterFiles ||
          this.guidedConfig?.sqlStarterFiles
        )
      ) {
        return mapFilesToLanguage(
          baseJsStarter,
          lang,
          this.guidedConfig?.tsStarterFiles,
          this.guidedConfig?.cppStarterFiles,
          this.guidedConfig?.pyStarterFiles,
          this.guidedConfig?.sqlStarterFiles
        );
      }
      return mapFilesToLanguage(
        baseJsSolution,
        lang,
        this.guidedConfig?.tsSolutionFiles,
        this.guidedConfig?.cppSolutionFiles,
        this.guidedConfig?.pySolutionFiles,
        this.guidedConfig?.sqlSolutionFiles
      );
    }

    _isUserCreatedFile(filename) {
      const base = this._getBaseFilesForModeAndLang(this.mode, this.lang);
      return !Object.prototype.hasOwnProperty.call(base, filename);
    }

    _computeInitialFiles() {
      const key = `${this.mode}:${this.lang}`;
      const saved = this.savedState.customFiles?.[key];
      const base = this._getBaseFilesForModeAndLang(this.mode, this.lang);
      if (this.savedState && this.savedState.hasSnapshot && this.savedState.hasSnapshot[key] && saved && typeof saved === 'object') {
        return { ...saved };
      }
      if (saved && Object.keys(saved).length > 0) {
        return { ...base, ...saved };
      }
      return base;
    }

    _isSingleFileSqlMode() {
      if (this.lang !== 'sql' || this._forceShowExplorer) return false;
      const codeFiles = Object.keys(this.files || {}).filter(
        f => !f.startsWith('.codelab/') && !/^readme\.md$/i.test(f)
      );
      return codeFiles.length <= 1;
    }

    _pickDefaultFile() {
      const names = Object.keys(this.files);
      if (this.lang === 'sql') {
        if (this.guidedConfig?.mainFile) {
          const sqlMain = this.guidedConfig.mainFile.replace(/\.(js|ts|cpp|py)$/, '.sql');
          if (this.files[sqlMain]) return sqlMain;
          if (this.files[this.guidedConfig.mainFile]) return this.guidedConfig.mainFile;
        }
        if (this.files['query.sql']) return 'query.sql';
        if (this.files['solution.sql']) return 'solution.sql';
        if (this.files['main.sql']) return 'main.sql';
        if (this.files['schema.sql']) return 'schema.sql';
        const sqlImpl = names.find(f => /\.sql$/i.test(f) && !/test/i.test(f));
        return sqlImpl || names.find(f => /\.sql$/i.test(f)) || names.find(f => !f.endsWith('.md') && !f.startsWith('.codelab/')) || names[0] || '';
      }
      if (this.lang === 'py') {
        if (this.guidedConfig?.mainFile) {
          const pyMain = this.guidedConfig.mainFile.replace(/\.(js|ts|cpp)$/, '.py');
          if (this.files[pyMain]) return pyMain;
        }
        if (this.files['main.py']) return 'main.py';
        if (this.files['solution.py']) return 'solution.py';
        if (this.files['app.py']) return 'app.py';
        const pyImpl = names.find(f =>
          /\.py$/i.test(f) &&
          !/(^|\/)(demo|test.*|.*_test)\.py$/i.test(f)
        );
        return pyImpl || names.find(f => !f.endsWith('.md')) || names[0] || '';
      }
      if (this.lang === 'cpp') {
        if (this.guidedConfig?.mainFile) {
          const cppMain = this.guidedConfig.mainFile.replace(/\.(js|ts)$/, '.hpp');
          if (this.files[cppMain]) return cppMain;
          const cppMainSrc = this.guidedConfig.mainFile.replace(/\.(js|ts)$/, '.cpp');
          if (this.files[cppMainSrc]) return cppMainSrc;
        }
        if (this.files['solution.hpp']) return 'solution.hpp';
        if (this.files['main.cpp']) return 'main.cpp';
        const cppImpl = names.find(f =>
          /\.(cpp|cc|cxx|hpp|h)$/i.test(f) &&
          !/(^|\/)(demo|test)\.(cpp|cc|cxx)$/i.test(f)
        );
        return cppImpl || names.find(f => !f.endsWith('.md')) || names[0] || '';
      }
      const ext = this.lang === 'ts' ? '.ts' : '.js';
      if (this.guidedConfig?.mainFile) {
        const mainCandidate = this.lang === 'ts'
          ? this.guidedConfig.mainFile.replace(/\.js$/, '.ts')
          : this.guidedConfig.mainFile;
        if (this.files[mainCandidate]) return mainCandidate;
      }
      const implFile = names.find(f =>
        f.endsWith(ext) &&
        !/(^|\/)(demo|test)\.(js|ts)$/i.test(f)
      );
      return implFile || names.find(f => !f.endsWith('.md')) || names[0] || '';
    }

    _pickPrimaryCloneFile(filePaths) {
      const list = Array.isArray(filePaths) ? filePaths.filter(Boolean) : Object.keys(this.files || {});
      if (list.length === 0) return '';
      const priority = [
        /^readme\.md$/i,
        /^src\/index\.(ts|tsx|js|jsx)$/i,
        /^src\/main\.(ts|tsx|js|jsx|py|cpp)$/i,
        /^index\.(ts|tsx|js|jsx|html)$/i,
        /^main\.(ts|js|py|cpp|sql)$/i,
        /^app\.(ts|tsx|js|jsx|py)$/i,
        /^package\.json$/i,
      ];
      for (const re of priority) {
        const hit = list.find(p => re.test(p));
        if (hit) return hit;
      }
      return list.find(p => !p.startsWith('.')) || list[0] || '';
    }

    _findEntryFile(kind) {
      const names = Object.keys(this.files);
      if (this.lang === 'sql') {
        if (kind === 'test') {
          if (this.explicitTestEntry) {
            const sqlTest = this.explicitTestEntry.replace(/\.(js|ts|cpp|py)$/, '.sql');
            if (this.files[sqlTest]) return sqlTest;
            if (this.files[this.explicitTestEntry]) return this.explicitTestEntry;
          }
          if (this.files['test.sql']) return 'test.sql';
          return names.find(f => /(^|\/)(test.*|.*_test)\.sql$/i.test(f)) || null;
        }
        if (this.explicitEntry) {
          const sqlEntry = this.explicitEntry.replace(/\.(js|ts|cpp|py)$/, '.sql');
          if (this.files[sqlEntry]) return sqlEntry;
          if (this.files[this.explicitEntry]) return this.explicitEntry;
        }
        return (this.activeFile && /\.sql$/i.test(this.activeFile) ? this.activeFile : null) ||
          (this.files['query.sql'] ? 'query.sql' : null) ||
          (this.files['solution.sql'] ? 'solution.sql' : null) ||
          (this.files['main.sql'] ? 'main.sql' : null) ||
          names.find(f => /\.sql$/i.test(f)) ||
          null;
      }
      if (this.lang === 'py') {
        if (kind === 'test') {
          if (this.explicitTestEntry) {
            const pyTest = this.explicitTestEntry.replace(/\.(js|ts|cpp)$/, '.py');
            if (this.files[pyTest]) return pyTest;
            if (this.files[this.explicitTestEntry]) return this.explicitTestEntry;
          }
          if (this.files['test.py']) return 'test.py';
          if (this.files['test_main.py']) return 'test_main.py';
          return names.find(f => /(^|\/)(test.*|.*_test)\.py$/i.test(f)) || null;
        }
        if (this.explicitEntry) {
          const pyEntry = this.explicitEntry.replace(/\.(js|ts|cpp)$/, '.py');
          if (this.files[pyEntry]) return pyEntry;
          if (this.files[this.explicitEntry]) return this.explicitEntry;
        }
        if (this.files['main.py']) return 'main.py';
        if (this.files['demo.py']) return 'demo.py';
        if (this.files['app.py']) return 'app.py';
        return names.find(f => /(^|\/)(main|demo|app)\.py$/i.test(f)) ||
          names.find(f => /\.py$/i.test(f) && !/(^|\/)(test.*|.*_test)\.py$/i.test(f)) ||
          null;
      }
      if (this.lang === 'cpp') {
        if (kind === 'test') {
          if (this.explicitTestEntry) {
            const cppTest = this.explicitTestEntry.replace(/\.(js|ts)$/, '.cpp');
            if (this.files[cppTest]) return cppTest;
            if (this.files[this.explicitTestEntry]) return this.explicitTestEntry;
          }
          if (this.files['test.cpp']) return 'test.cpp';
          return names.find(f => /(^|\/)test\.(cpp|cc|cxx)$/i.test(f)) || null;
        }
        if (this.explicitEntry) {
          const cppEntry = this.explicitEntry.replace(/\.(js|ts)$/, '.cpp');
          if (this.files[cppEntry]) return cppEntry;
          if (this.files[this.explicitEntry]) return this.explicitEntry;
        }
        if (this.files['main.cpp']) return 'main.cpp';
        if (this.files['demo.cpp']) return 'demo.cpp';
        return names.find(f => /(^|\/)(main|demo)\.(cpp|cc|cxx)$/i.test(f)) ||
          names.find(f => /\.(cpp|cc|cxx)$/i.test(f) && !/(^|\/)test\.(cpp|cc|cxx)$/i.test(f)) ||
          null;
      }
      if (kind === 'test' && this.explicitTestEntry) {
        const candidate = this.lang === 'ts' ? this.explicitTestEntry.replace(/\.js$/, '.ts') : this.explicitTestEntry;
        if (this.files[candidate]) return candidate;
        if (this.files[this.explicitTestEntry]) return this.explicitTestEntry;
      }
      if (kind === 'demo' && this.explicitEntry) {
        const candidate = this.lang === 'ts' ? this.explicitEntry.replace(/\.js$/, '.ts') : this.explicitEntry;
        if (this.files[candidate]) return candidate;
        if (this.files[this.explicitEntry]) return this.explicitEntry;
      }
      const pattern = kind === 'test' ? /(^|\/)test\.(js|ts|cpp|cc|cxx|py)$/i : /(^|\/)(demo|main)\.(js|ts|cpp|cc|cxx|py)$/i;
      const found = names.find(f => pattern.test(f));
      if (found) return found;
      if (kind === 'demo') {
        const isConfigOrTest = f => /(^|\/)(test|.*\.(?:test|spec|config|d))\.(js|ts|mjs|cjs|cpp|cc|cxx|py)$/i.test(f) || /(^|\/)\.[^/]+$/i.test(f);
        const hasHtmlEntry = Boolean(this.files['index.html'] || this.files['public/index.html']);
        if (hasHtmlEntry) {
          return names.find(f => /(^|\/)(server|app|demo)\.(js|ts)$/i.test(f) && !/^src\//i.test(f)) || null;
        }
        return names.find(f => /\.(js|ts|cpp|cc|cxx|py)$/i.test(f) && !isConfigOrTest(f)) || null;
      }
      return null;
    }

    _orderedFileNames() {
      const rank = f => (/readme/i.test(f) ? 3 : /package\.json$/i.test(f) ? 2.5 : /(^|\/)demo\./i.test(f) ? 1 : /(^|\/)test\./i.test(f) ? 2 : 0);
      return Object.keys(this.files).sort((a, b) => rank(a) - rank(b));
    }

    _updateRunStateUI() {
      const stopBtn = this.container.querySelector('#cl-stop-btn');
      if (stopBtn) {
        stopBtn.style.display = this.isRunning ? 'inline-flex' : 'none';
      }
      const ctrlCBtn = this.container.querySelector('#cl-ctrl-c-btn');
      if (ctrlCBtn) {
        ctrlCBtn.classList.toggle('is-running', Boolean(this.isRunning));
        ctrlCBtn.title = this.isRunning
          ? 'Send Ctrl+C — interrupt the running command'
          : 'Send Ctrl+C — interrupt or cancel current input';
      }
      this.container.querySelectorAll('[data-cl-action="run-code"], [data-cl-action="run-entry"], [data-cl-action="run-active-file"], [data-cl-action="run-demo"], [data-cl-action="run-tests"], [data-cl-action="verify-step"]').forEach(btn => {
        btn.disabled = this.isRunning;
      });
      this._updatePtyActiveLine();
    }

    _hasWebContent() {
      if (this.showWebPreviewOption === true) return true;
      if (!this.files) return false;
      if (this.files['index.html'] || this.files['src/index.html'] || this.files['public/index.html']) return true;
      if (this.portTable && typeof this.portTable.listServers === 'function' && this.portTable.listServers().length > 0) return true;
      return false;
    }

    _renderLanguageSwitcherHtml() {
      const hasMulti = Boolean(
        this.hasMultipleLanguages ||
        (this.enabledLanguages && this.enabledLanguages.size > 1)
      );
      if (!hasMulti) return '';
      const showJs = Boolean(!this.enabledLanguages || this.enabledLanguages.has('js'));
      const showTs = Boolean(
        !this.enabledLanguages ||
        this.enabledLanguages.has('ts') ||
        (!this.enabledLanguages.has('cpp') && !this.enabledLanguages.has('py') && !this.enabledLanguages.has('sql'))
      );
      const showCpp = Boolean(this.enabledLanguages && this.enabledLanguages.has('cpp'));
      const showPy = Boolean(this.enabledLanguages && this.enabledLanguages.has('py'));
      const showSql = Boolean(this.enabledLanguages && this.enabledLanguages.has('sql'));
      return `
              <div class="codelab-lang-switch" role="group" aria-label="Language Selector">
                ${showJs ? `<button type="button" class="codelab-lang-btn ${this.lang === 'js' ? 'active' : ''}" data-cl-lang="js" data-lang="js" aria-pressed="${this.lang === 'js'}">JS</button>` : ''}
                ${showTs ? `<button type="button" class="codelab-lang-btn ${this.lang === 'ts' ? 'active' : ''}" data-cl-lang="ts" data-lang="ts" aria-pressed="${this.lang === 'ts'}">TS</button>` : ''}
                ${showCpp ? `<button type="button" class="codelab-lang-btn ${this.lang === 'cpp' ? 'active' : ''}" data-cl-lang="cpp" data-lang="cpp" aria-pressed="${this.lang === 'cpp'}">C++</button>` : ''}
                ${showPy ? `<button type="button" class="codelab-lang-btn ${this.lang === 'py' ? 'active' : ''}" data-cl-lang="py" data-lang="py" aria-pressed="${this.lang === 'py'}">PY</button>` : ''}
                ${showSql ? `<button type="button" class="codelab-lang-btn ${this.lang === 'sql' ? 'active' : ''}" data-cl-lang="sql" data-lang="sql" aria-pressed="${this.lang === 'sql'}">SQL</button>` : ''}
              </div>
      `;
    }

    _refreshLanguageSwitcher() {
      if (!this.container) return;
      const topLeft = this.container.querySelector('.codelab-topbar__left');
      if (!topLeft) return;
      const existing = topLeft.querySelector('.codelab-lang-switch');
      const htmlStr = this._renderLanguageSwitcherHtml().trim();
      if (existing) {
        if (htmlStr) {
          existing.outerHTML = htmlStr;
        } else {
          existing.remove();
        }
      } else if (htmlStr) {
        topLeft.insertAdjacentHTML('beforeend', htmlStr);
      }
    }

    _refreshToolbarAndTabs() {
      if (!this.container) return;
      this._refreshLanguageSwitcher();
      const topbar = this.container.querySelector('.codelab-topbar');
      if (topbar) {
        const previewBtn = topbar.querySelector('#cl-preview-app-btn');
        const hasWeb = this._hasWebContent();
        if (hasWeb) {
          if (!previewBtn) {
            const stopBtn = topbar.querySelector('#cl-stop-btn');
            if (stopBtn && stopBtn.parentElement) {
              const globeHtml = `<button type="button" class="codelab-btn codelab-btn--icon" id="cl-preview-app-btn" data-cl-action="preview-app" title="Run &amp; Preview in Browser" aria-label="Run and Preview in Browser">${CL_ICONS.globe}</button>`;
              stopBtn.insertAdjacentHTML('afterend', globeHtml);
            }
          } else {
            previewBtn.style.display = 'inline-flex';
          }
        } else if (previewBtn) {
          previewBtn.style.display = 'none';
        }
      }
      this._refreshDrawerTabs();
    }

    _refreshDrawerTabs() {
      if (!this.container) return;
      const drawerTabs = this.container.querySelector('.codelab-drawer__tabs');
      if (!drawerTabs) return;

      const isSingleSql = this._isSingleFileSqlMode();
      const showSqlTab = Boolean(this.lang === 'sql' || this.lastSqlResult);
      let problemsCount = 0;
      let hasProblemErrors = false;
      if (this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function') {
        const allDiag = this._diagnosticsStore.getAll();
        problemsCount = allDiag.length;
        hasProblemErrors = allDiag.some(d => d && d.severity === 'error');
      }

      const appendDrawerTabHtml = (parent, pos, htmlSnippet) => {
        if (parent && typeof parent.insertAdjacentHTML === 'function') {
          parent.insertAdjacentHTML(pos, htmlSnippet);
        } else if (parent && typeof parent.innerHTML === 'string') {
          parent.innerHTML = pos === 'afterbegin' ? (htmlSnippet + parent.innerHTML) : (parent.innerHTML + htmlSnippet);
        }
      };

      let sqlTab = drawerTabs.querySelector('[data-cl-drawertab="sql-results"]');
      if (!sqlTab && showSqlTab) {
        appendDrawerTabHtml(drawerTabs, 'afterbegin', `
          <button type="button" role="tab" aria-selected="${this.drawerTab === 'sql-results'}" class="codelab-drawer__tab ${this.drawerTab === 'sql-results' ? 'active' : ''}" data-cl-drawertab="sql-results" title="SQL Query Results &amp; EXPLAIN Plan">
            ${CL_ICONS.database}
            <span>Query Results</span>
          </button>
        `);
      } else if (sqlTab && sqlTab.style) {
        sqlTab.style.display = showSqlTab ? 'inline-flex' : 'none';
      }

      let probTab = drawerTabs.querySelector('[data-cl-drawertab="problems"]');
      const probBadgeClass = problemsCount > 0 ? (hasProblemErrors ? 'has-errors' : 'has-warnings') : '';
      if (!probTab) {
        const termTab = drawerTabs.querySelector('[data-cl-drawertab="terminal"]');
        if (termTab && typeof termTab.insertAdjacentHTML === 'function') {
          termTab.insertAdjacentHTML('beforebegin', `
            <button type="button" role="tab" aria-selected="${this.drawerTab === 'problems'}" class="codelab-drawer__tab ${this.drawerTab === 'problems' ? 'active' : ''}" data-cl-drawertab="problems" title="Compiler &amp; Runtime Problems">
              ${CL_ICONS.warning}
              <span>Problems</span>
              <span class="codelab-badge ${probBadgeClass}" id="cl-problems-count">${problemsCount}</span>
            </button>
          `);
        }
      } else {
        const countSpan = probTab.querySelector('#cl-problems-count');
        if (countSpan) {
          countSpan.textContent = String(problemsCount);
          countSpan.className = `codelab-badge ${probBadgeClass}`.trim();
        }
      }

      let outputTab = drawerTabs.querySelector('[data-cl-drawertab="output"]');
      if (!outputTab) {
        const anchorProb = drawerTabs.querySelector('[data-cl-drawertab="problems"]');
        if (anchorProb && typeof anchorProb.insertAdjacentHTML === 'function') {
          anchorProb.insertAdjacentHTML('afterend', `
            <button type="button" role="tab" aria-selected="${this.drawerTab === 'output'}" class="codelab-drawer__tab ${this.drawerTab === 'output' ? 'active' : ''}" data-cl-drawertab="output" title="Workbench &amp; Runtime Output" style="${isSingleSql ? 'display:none' : ''}">
              ${CL_ICONS.code}
              <span>Output</span>
            </button>
          `);
        }
      }

      let stdinTab = drawerTabs.querySelector('[data-cl-drawertab="stdin"]');
      if (!stdinTab) {
        const testTab = drawerTabs.querySelector('[data-cl-drawertab="tests"]');
        const afterTab = testTab || drawerTabs.querySelector('[data-cl-drawertab="problems"]') || drawerTabs.querySelector('[data-cl-drawertab="terminal"]');
        if (afterTab && typeof afterTab.insertAdjacentHTML === 'function') {
          afterTab.insertAdjacentHTML('afterend', `
            <button type="button" role="tab" aria-selected="${this.drawerTab === 'stdin'}" class="codelab-drawer__tab ${this.drawerTab === 'stdin' ? 'active' : ''}" data-cl-drawertab="stdin" title="Standard Input">
              ${CL_ICONS.keyboard}
              <span>Stdin</span>
            </button>
          `);
        }
      }

      let obsTab = drawerTabs.querySelector('[data-cl-drawertab="observability"]');
      if (!obsTab && this.kernel) {
        appendDrawerTabHtml(drawerTabs, 'beforeend', `
          <button type="button" role="tab" aria-selected="${this.drawerTab === 'observability'}" class="codelab-drawer__tab ${this.drawerTab === 'observability' ? 'active' : ''}" data-cl-drawertab="observability" title="Services, Settings &amp; Event Telemetry">
            ${CL_ICONS.activity}
            <span>Observability</span>
          </button>
        `);
      }

      const activeBottomPluginIds = new Set();
      if (this.plugins && this.plugins.panels && typeof this.plugins.panels.values === 'function') {
        for (const panel of this.plugins.panels.values()) {
          if (!panel || !panel.id || panel.location === 'sidebar') continue;
          activeBottomPluginIds.add(panel.id);
          const existingPanelTab = drawerTabs.querySelector(`[data-cl-drawertab="${panel.id}"]`);
          if (!existingPanelTab) {
            appendDrawerTabHtml(drawerTabs, 'beforeend', `
              <button type="button" role="tab" aria-selected="${this.drawerTab === panel.id}" class="codelab-drawer__tab ${this.drawerTab === panel.id ? 'active' : ''}" data-cl-drawertab="${escapeHtml(panel.id)}" data-cl-plugin-tab="true">
                <span>${escapeHtml(panel.title || panel.id)}</span>
              </button>
            `);
          }
        }
      }

      if (typeof drawerTabs.querySelectorAll === 'function') {
        drawerTabs.querySelectorAll('[data-cl-plugin-tab="true"]').forEach(el => {
          const id = el.getAttribute('data-cl-drawertab');
          if (id && !activeBottomPluginIds.has(id)) {
            if (typeof el.remove === 'function') el.remove();
            if (this.drawerTab === id) {
              this.drawerTab = 'terminal';
            }
          }
        });
      }

      const noisyTabs = ['output', 'terminal', 'stdin', 'ports', 'preview', 'network', 'inspector'];
      for (const noisyId of noisyTabs) {
        const el = drawerTabs.querySelector(`[data-cl-drawertab="${noisyId}"]`);
        if (el && el.style) {
          el.style.display = isSingleSql ? 'none' : '';
        }
      }
      const testsEl = drawerTabs.querySelector('[data-cl-drawertab="tests"]');
      if (testsEl && testsEl.style && isSingleSql && !this._findEntryFile('test')) {
        testsEl.style.display = 'none';
      } else if (testsEl && testsEl.style && !isSingleSql) {
        testsEl.style.display = '';
      }
      this._updateStatusBar();
    }

    // ── Render Workbench DOM (Canonical VS Code 5-Region Shell) ────────────
    _renderShell() {
      if (this._isBooting) return;
      if (typeof this._activeSplitterCleanup === 'function') {
        try { this._activeSplitterCleanup(); } catch (_err) { void _err; }
        this._activeSplitterCleanup = null;
      }
      const resolvedTheme = this._resolvedTheme();
      if (this.themeOption !== 'auto') {
        this.container.setAttribute('data-theme', this.themeOption);
        this.container.classList.add(`codelab-workbench--${this.themeOption}`);
      }
      const themeAttr = this.themeOption !== 'auto'
        ? `data-theme="${escapeHtml(this.themeOption)}" data-cl-theme="${escapeHtml(resolvedTheme)}"`
        : `data-cl-theme="${escapeHtml(resolvedTheme)}"`;
      const brandLabel = (this.title && this.title !== 'custom-lab' && this.title !== this.labId) ? this.title : 'code-lab';
      const isGuideCollapsed = !this.hasGuidedLab || this.mode === 'sandbox' || !this.steps.length;
      const isSingleSql = this._isSingleFileSqlMode();
      const showSqlTab = Boolean(this.lang === 'sql' || this.lastSqlResult);
      const sidebarRight = Boolean(
        this.configuration && this.configuration.get('workbench.sidebar.defaultLocation', 'left') === 'right'
      );
      const statusBarHidden = Boolean(
        this.configuration && this.configuration.get('workbench.statusBar.visible', true) === false
      );
      const pluginBottomPanelsHtml = (this.plugins && this.plugins.panels && typeof this.plugins.panels.values === 'function')
        ? Array.from(this.plugins.panels.values())
            .filter(panel => panel && panel.id && panel.location !== 'sidebar')
            .map((panel) => `
              <button type="button" role="tab" tabindex="${this.drawerTab === panel.id ? '0' : '-1'}" aria-selected="${this.drawerTab === panel.id}" class="codelab-drawer__tab ${this.drawerTab === panel.id ? 'active' : ''}" data-cl-drawertab="${escapeHtml(panel.id)}" data-cl-plugin-tab="true">
                <span>${escapeHtml(panel.title || panel.id)}</span>
              </button>
            `).join('')
        : '';
      const pluginSidebarBtnsHtml = (this.plugins && this.plugins.panels && typeof this.plugins.panels.values === 'function')
        ? Array.from(this.plugins.panels.values())
            .filter(panel => panel && panel.id && panel.location === 'sidebar')
            .map((panel) => {
              const viewId = `plugin:${panel.id}`;
              const isAct = Boolean(this.sidebarVisible && this.activeSidebarView === viewId);
              return `<button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${isAct ? 'active' : ''}" data-cl-activity="${escapeHtml(viewId)}" title="${escapeHtml(panel.title || panel.id)}" aria-label="${escapeHtml(panel.title || panel.id)}" aria-pressed="${isAct}">${CL_ICONS.box}</button>`;
            }).join('')
        : '';
      const shellClasses = [
        'codelab',
        'codelab-workbench',
        this.options && this.options.fullbleed ? 'codelab--fullbleed' : '',
        isGuideCollapsed ? 'guide-collapsed' : '',
        isSingleSql ? 'is-sql-single-file' : '',
        !this.sidebarVisible ? 'sidebar-collapsed files-collapsed' : '',
        !this.panelVisible ? 'panel-collapsed' : '',
        this.panelMaximized ? 'panel-maximized' : '',
        sidebarRight ? 'sidebar-right' : '',
        statusBarHidden ? 'statusbar-hidden' : ''
      ].filter(Boolean).join(' ');
      const shellVars = [
        `--cl-explorer-width:${Math.round(this.explorerWidth || 260)}px`,
        `--cl-drawer-height:${Math.round(this.panelHeight || 220)}px`
      ];
      if (this.previewSplitWidth) shellVars.push(`--cl-preview-split-width:${Math.round(this.previewSplitWidth)}px`);
      const explorerStyle = `style="${shellVars.join(';')}"`;
      const topMenus = [
        { id: 'file', label: 'File' },
        { id: 'edit', label: 'Edit' },
        { id: 'selection', label: 'Selection' },
        { id: 'view', label: 'View' },
        { id: 'go', label: 'Go' },
        { id: 'run', label: 'Run' },
        { id: 'terminal', label: 'Terminal' },
        { id: 'help', label: 'Help' }
      ];
      const menubarHtml = topMenus.map((m, idx) => `
        <button type="button" role="menuitem" tabindex="${idx === 0 ? '0' : '-1'}" aria-haspopup="menu" aria-expanded="false" class="codelab-menubar__trigger" data-cl-menu="${m.id}">${m.label}</button>
      `).join('');
      const isTermDrawer = this.drawerTab === 'terminal' && !isSingleSql;
      const tabSizeVal = this.configuration
        ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
        : 2;

      this.container.innerHTML = `
        <div class="${shellClasses}" id="codelab-${escapeHtml(this.labId)}" ${themeAttr} ${explorerStyle}>
          <!-- Region 1: Titlebar & Menubar -->
          <header class="codelab-topbar codelab-titlebar codelab-toolbar">
            <div class="codelab-topbar__left">
              ${this.onClose ? `
                <button type="button" class="codelab-btn codelab-btn--back" data-cl-action="close-lab" title="${escapeHtml(this.backLabel)}">
                  ${CL_ICONS.arrowLeft}
                  <span>${escapeHtml(this.backLabel)}</span>
                </button>
              ` : ''}
              <span class="codelab-brand ${this.onClose ? 'codelab-brand--with-back' : ''}" title="${escapeHtml(brandLabel)}">
                <span class="codelab-brand__dot"></span>
                <span>${escapeHtml(brandLabel)}</span>
              </span>
              <div class="codelab-menubar" id="cl-menubar" role="menubar" aria-label="Application Menu">
                ${menubarHtml}
              </div>
              ${this.hasGuidedLab ? `
              <span class="codelab-toolbar__sep" aria-hidden="true"></span>
              <div class="codelab-mode-switch" role="tablist" aria-label="Lab Mode">
                <button type="button" role="tab" tabindex="${this.mode === 'guided' ? '0' : '-1'}" aria-selected="${this.mode === 'guided'}" class="codelab-mode-btn ${this.mode === 'guided' ? 'active' : ''}" data-cl-mode="guided">
                  ${CL_ICONS.target}
                  <span>Guided Challenge</span>
                </button>
                <button type="button" role="tab" tabindex="${this.mode === 'sandbox' ? '0' : '-1'}" aria-selected="${this.mode === 'sandbox'}" class="codelab-mode-btn ${this.mode === 'sandbox' ? 'active' : ''}" data-cl-mode="sandbox">
                  ${CL_ICONS.code}
                  <span>Reference Sandbox</span>
                </button>
              </div>
              ` : ''}
              ${this._renderLanguageSwitcherHtml()}
            </div>

            <div class="codelab-topbar__center">
              <button type="button" class="codelab-cmd-trigger" data-cl-action="command-palette" title="Command Center — Go to File (⌘P) or Show Commands (⇧⌘P)" aria-label="Command Palette">
                ${CL_ICONS.search}
                <span>${escapeHtml(brandLabel)} — Go to File / Commands</span>
                <kbd>⇧⌘P</kbd>
              </button>
            </div>

            <div class="codelab-topbar__right">
              <button type="button" class="codelab-btn codelab-btn--stop" id="cl-stop-btn" data-cl-action="stop-run" title="Stop Running Execution" style="display:none">
                ${CL_ICONS.stop}
                <span>Stop</span>
              </button>
              ${(this.hasGuidedLab && this.mode === 'guided') ? `
                <button type="button" class="codelab-btn codelab-btn--run" data-cl-action="run-demo" title="${this.lang === 'sql' ? 'Run Query (⌘+Shift+Enter)' : 'Run demo.js (⌘+Shift+Enter)'}">
                  ${CL_ICONS.play}
                  <span>${this.lang === 'sql' ? 'Run Query' : 'Run Demo'}</span>
                  <span class="codelab-btn__kbd">⇧⌘↵</span>
                </button>
                <button type="button" class="codelab-btn codelab-btn--test" id="cl-primary-exec-btn" data-cl-action="verify-step" title="Verify Current Step (⌘+Enter)">
                  ${CL_ICONS.check}
                  <span>Verify Step</span>
                  <span class="codelab-btn__kbd">⌘↵</span>
                </button>
              ` : `
                <div class="codelab-btn-split">
                  <button type="button" class="codelab-btn codelab-btn--run codelab-btn-split__main" id="cl-primary-exec-btn" data-cl-action="run-code" title="${this.lang === 'sql' ? 'Run SQL Query (⌘↵)' : 'Run Code (⌘↵)'}">
                    ${CL_ICONS.play}
                    <span>${this.lang === 'sql' ? 'Run SQL' : 'Run Code'}</span>
                    <span class="codelab-btn__kbd">⌘↵</span>
                  </button>
                  <button type="button" class="codelab-btn codelab-btn--run codelab-btn-split__trigger" id="cl-split-run-trigger" title="More Execution Options" aria-haspopup="true">
                    ${CL_ICONS.chevronDown}
                  </button>
                  <div class="codelab-split-menu" id="cl-split-run-menu">
                    <button type="button" class="codelab-split-menu__item" data-cl-action="run-demo">
                      <span>▶ Run Entry / Demo</span> <kbd style="opacity:0.75">⌘↵</kbd>
                    </button>
                    <button type="button" class="codelab-split-menu__item" data-cl-action="run-active-file">
                      <span>▶ Run Active File (${escapeHtml(this.activeFile || 'active')})</span> <kbd style="opacity:0.75">⇧⌘↵</kbd>
                    </button>
                    ${this.lang === 'sql' ? `
                    <button type="button" class="codelab-split-menu__item" data-cl-action="explain-sql">
                      <span>⚡ Explain Query Plan</span>
                    </button>
                    ` : ''}
                    ${this._findEntryFile('test') ? `
                    <button type="button" class="codelab-split-menu__item" data-cl-action="run-tests">
                      <span>✓ Run Test Suite</span>
                    </button>
                    ` : ''}
                    <button type="button" class="codelab-split-menu__item" data-cl-action="open-stdin">
                      <span>⌨ Configure Stdin / Input...</span>
                    </button>
                  </div>
                </div>
              `}
              <button type="button" class="codelab-btn codelab-btn--icon" id="cl-preview-app-btn" data-cl-action="preview-app" title="Run &amp; Preview in Browser" aria-label="Run and Preview in Browser" style="display: ${this._hasWebContent() ? 'inline-flex' : 'none'}">
                ${CL_ICONS.globe}
              </button>
              <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="share-snapshot" title="Share Snapshot Link (#codelab=...)" aria-label="Share Snapshot Link">
                ${CL_ICONS.share}
              </button>
              <span class="codelab-toolbar__sep" aria-hidden="true"></span>
              ${this.hasGuidedLab ? `
              <button type="button" class="codelab-btn codelab-btn--icon ${isGuideCollapsed ? '' : 'active'}" id="cl-toggle-guide-btn" data-cl-action="toggle-guide" title="Toggle Guide Panel" aria-label="Toggle Guide Panel" aria-pressed="${isGuideCollapsed ? 'false' : 'true'}">
                ${CL_ICONS.book}
              </button>
              ` : ''}
              <button type="button" class="codelab-btn codelab-btn--icon ${this.sidebarVisible ? 'active' : ''}" id="cl-toggle-sidebar-btn" data-cl-action="toggle-sidebar" title="Toggle Primary Side Bar (⌘B)" aria-label="Toggle Primary Side Bar" aria-pressed="${this.sidebarVisible ? 'true' : 'false'}">
                ${CL_ICONS.sidebarLeft}
              </button>
              <button type="button" class="codelab-btn codelab-btn--icon ${this.panelVisible ? 'active' : ''}" id="cl-toggle-drawer-btn" data-cl-action="toggle-drawer" title="Toggle Panel (⌘J)" aria-label="Toggle Panel" aria-pressed="${this.panelVisible ? 'true' : 'false'}">
                ${CL_ICONS.panelBottom}
              </button>
              <button type="button" class="codelab-btn codelab-btn--icon" id="cl-settings-btn" data-cl-action="open-settings" title="Settings (⌘,)" aria-label="Open Settings">
                ${CL_ICONS.settings}
              </button>
              <button type="button" class="codelab-btn codelab-btn--icon" id="cl-fullscreen-btn" data-cl-action="toggle-fullscreen" title="Toggle Fullscreen IDE (Esc to exit)" aria-label="Toggle Fullscreen IDE">
                ${CL_ICONS.maximize}
              </button>
              ${this.onClose ? `
                <button type="button" class="codelab-btn codelab-btn--exit-lab codelab-btn--close-ide" id="cl-close-ide-btn" data-cl-action="close-lab" title="${escapeHtml(this.backLabel ? `Exit Lab (${this.backLabel})` : 'Exit Lab / Back to Build Guide')}" aria-label="Exit Lab">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span class="codelab-btn__label">Exit Lab</span>
                </button>
              ` : ''}
            </div>
          </header>

          <!-- Middle 5-Region Horizontal Flex Body -->
          <div class="codelab-body">
            <!-- Region 2: 48px Vertical Activity Bar -->
            <nav class="codelab-activitybar" id="cl-activitybar" aria-label="Activity Bar">
              <div class="codelab-activitybar__top">
                <button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${this.sidebarVisible && this.activeSidebarView === 'explorer' ? 'active' : ''}" data-cl-activity="explorer" title="Explorer (⇧⌘E)" aria-label="Explorer" aria-pressed="${this.sidebarVisible && this.activeSidebarView === 'explorer'}">
                  ${CL_ICONS.files}
                </button>
                <button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${this.sidebarVisible && this.activeSidebarView === 'search' ? 'active' : ''}" data-cl-activity="search" title="Search (⇧⌘F)" aria-label="Search" aria-pressed="${this.sidebarVisible && this.activeSidebarView === 'search'}">
                  ${CL_ICONS.search}
                </button>
                <button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${this.sidebarVisible && this.activeSidebarView === 'scm' ? 'active' : ''}" data-cl-activity="scm" title="Source Control (⌃⇧G)" aria-label="Source Control" aria-pressed="${this.sidebarVisible && this.activeSidebarView === 'scm'}">
                  ${CL_ICONS.gitBranch}
                  <span class="codelab-activitybar__badge" id="cl-activity-scm-badge" hidden>0</span>
                </button>
                <div class="codelab-activitybar__plugins" id="cl-activitybar-plugins">${pluginSidebarBtnsHtml}</div>
                ${this.hasGuidedLab ? `
                <button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${!isGuideCollapsed ? 'active' : ''}" data-cl-action="toggle-guide" title="Guided Lab Steps" aria-label="Guided Lab Steps" aria-pressed="${!isGuideCollapsed}">
                  ${CL_ICONS.book}
                </button>
                ` : ''}
              </div>
              <div class="codelab-activitybar__bottom">
                <button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${this.activeTab === '__settings__' ? 'active' : ''}" data-cl-activity="settings" data-cl-action="open-settings" title="Settings (⌘,)" aria-label="Settings" aria-pressed="${this.activeTab === '__settings__'}">
                  ${CL_ICONS.settings}
                </button>
              </div>
            </nav>

            ${this.hasGuidedLab ? `
            <!-- Optional Guided Instructions Pane -->
            <aside class="codelab-guide codelab-pane-left" id="cl-guide-pane" aria-label="Guided Lab Instructions">
              <div class="codelab-guide__bar">
                <div class="codelab-guide__tabs" role="tablist" aria-label="Guide View">
                  <button type="button" role="tab" tabindex="${this.guideTab === 'steps' ? '0' : '-1'}" aria-selected="${this.guideTab === 'steps'}" class="codelab-guide__tab ${this.guideTab === 'steps' ? 'active' : ''}" data-cl-guidetab="steps">
                    ${CL_ICONS.list}
                    <span>Guided Steps (${this.steps.length})</span>
                  </button>
                  <button type="button" role="tab" tabindex="${this.guideTab === 'readme' ? '0' : '-1'}" aria-selected="${this.guideTab === 'readme'}" class="codelab-guide__tab ${this.guideTab === 'readme' ? 'active' : ''}" data-cl-guidetab="readme">
                    ${CL_ICONS.book}
                    <span>Architecture Brief</span>
                  </button>
                </div>
                <button type="button" class="codelab-guide__collapse-btn" data-cl-action="toggle-guide" title="Collapse sidebar" aria-label="Collapse sidebar">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              </div>
              <div class="codelab-guide__stepper" id="cl-step-pills"></div>
              <div class="codelab-guide__content" id="cl-guide-content"></div>
              <div class="codelab-guide__footer" id="cl-guide-footer"></div>
            </aside>
            <div class="codelab-splitter-v" id="cl-splitter-v" role="separator" aria-orientation="vertical" title="Drag to resize guide panel (double-click to reset)"></div>
            ` : ''}

            <!-- Region 3: Full-Height Primary Side Bar (Explorer / Search / Source Control / Plugins) -->
            <aside class="codelab-sidebar codelab-explorer" id="cl-sidebar" aria-label="Primary Side Bar">
              <div class="codelab-sidebar__view" id="cl-sidebar-explorer" data-sidebar-view="explorer" ${this.activeSidebarView === 'explorer' ? '' : 'hidden'}>
                <div class="codelab-explorer__header">
                  <span>Explorer</span>
                  <div class="codelab-explorer__actions">
                    <button type="button" class="codelab-explorer__btn" data-cl-action="new-file-root" title="New File" aria-label="New File">${CL_ICONS.plus}</button>
                    <button type="button" class="codelab-explorer__btn" data-cl-action="new-folder-root" title="New Folder" aria-label="New Folder">${CL_ICONS.folder}</button>
                    <button type="button" class="codelab-explorer__btn" data-cl-action="collapse-all-folders" title="Collapse Folders in Explorer" aria-label="Collapse Folders">${CL_ICONS.collapseAll}</button>
                  </div>
                  <span id="cl-explorer-lang">${this.lang.toUpperCase()}</span>
                </div>
                <div class="codelab-explorer__list" id="cl-explorer-list"></div>
              </div>

              <div class="codelab-sidebar__view" id="cl-sidebar-search" data-sidebar-view="search" ${this.activeSidebarView === 'search' ? '' : 'hidden'}>
                <div class="codelab-explorer__header">
                  <span>Search</span>
                </div>
                <div class="codelab-sidebar__body">
                  <div class="codelab-sidebar-field">
                    <input type="search" class="codelab-sidebar-input" id="cl-search-input" placeholder="Search in files..." value="${escapeHtml(this._searchState?.query || '')}" aria-label="Search in workspace files" autocomplete="off" spellcheck="false" />
                  </div>
                  <div class="codelab-search-toggles" role="group" aria-label="Search Options">
                    <button type="button" class="codelab-search-toggle ${this._searchState?.caseSensitive ? 'active' : ''}" data-cl-search-opt="caseSensitive" aria-pressed="${Boolean(this._searchState?.caseSensitive)}" title="Match Case" aria-label="Match Case">Aa</button>
                    <button type="button" class="codelab-search-toggle ${this._searchState?.wholeWord ? 'active' : ''}" data-cl-search-opt="wholeWord" aria-pressed="${Boolean(this._searchState?.wholeWord)}" title="Match Whole Word" aria-label="Match Whole Word">ab</button>
                    <button type="button" class="codelab-search-toggle ${this._searchState?.regex ? 'active' : ''}" data-cl-search-opt="regex" aria-pressed="${Boolean(this._searchState?.regex)}" title="Use Regular Expression" aria-label="Use Regular Expression">.*</button>
                  </div>
                  <div class="codelab-sidebar-field codelab-search-replace-row">
                    <input type="text" class="codelab-sidebar-input" id="cl-search-replace-input" placeholder="Replace..." value="${escapeHtml(this._searchState?.replaceText || '')}" aria-label="Replace in workspace files" autocomplete="off" spellcheck="false" />
                    <div class="codelab-search-replace-actions" role="group" aria-label="Replace Actions">
                      <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="search-replace-one" title="Replace" aria-label="Replace next match">Replace</button>
                      <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="search-replace-all" title="Replace All" aria-label="Replace All">Replace All</button>
                    </div>
                  </div>
                  <div class="codelab-sidebar-field codelab-search-glob-fields">
                    <input type="text" class="codelab-sidebar-input codelab-sidebar-input--compact" id="cl-search-include" data-cl-search-include="true" placeholder="files to include (e.g. src/**)" value="${escapeHtml(this._searchState?.include || '')}" aria-label="Files to include" autocomplete="off" spellcheck="false" />
                    <input type="text" class="codelab-sidebar-input codelab-sidebar-input--compact" id="cl-search-exclude" data-cl-search-exclude="true" placeholder="files to exclude (e.g. *.log)" value="${escapeHtml(this._searchState?.exclude || '')}" aria-label="Files to exclude" autocomplete="off" spellcheck="false" />
                  </div>
                  <div class="codelab-search-results" id="cl-search-results" aria-live="polite"></div>
                </div>
              </div>

              <div class="codelab-sidebar__view" id="cl-sidebar-scm" data-sidebar-view="scm" ${this.activeSidebarView === 'scm' ? '' : 'hidden'}>
                <div class="codelab-explorer__header">
                  <span>Source Control</span>
                </div>
                <div class="codelab-sidebar__body" id="cl-scm-view-body"></div>
              </div>

              <div class="codelab-sidebar__view" id="cl-sidebar-plugin-host" data-sidebar-view="plugin" ${String(this.activeSidebarView || '').startsWith('plugin:') ? '' : 'hidden'}></div>
            </aside>

            <!-- Primary Side Bar Resize Splitter -->
            <div class="codelab-splitter-files" id="cl-splitter-files" role="separator" aria-orientation="vertical" title="Drag to resize side bar (double-click to reset)"></div>

            <!-- Region 4 + 5 Column: Editor Area on Top, Bottom Panel Strictly Beneath Editor -->
            <div class="codelab-workbench-main codelab-main">
              <div class="codelab-editor-row codelab-workspace">
                <div class="codelab-editor-col">
                  <div class="codelab-tabs-bar">
                    <div class="codelab-tabs codelab-file-tabs" id="cl-tabs" role="tablist" aria-label="Open Files"></div>
                    <div class="codelab-tabs-actions" id="cl-file-tabs-actions"></div>
                  </div>
                  <div class="codelab-breadcrumbs" id="cl-breadcrumbs" aria-label="Editor Breadcrumbs"></div>
                  <div class="codelab-editor-wrap">
                    <div class="codelab-monaco-host" id="cl-monaco-host"></div>
                    <div class="codelab-sql-host" id="cl-sql-editor-host" style="display:none"></div>
                    <div class="codelab-fallback-wrap" id="cl-fallback-wrap" style="display:none">
                      <div class="codelab-fallback-gutter" id="cl-fallback-gutter" aria-hidden="true">1</div>
                      <textarea class="codelab-fallback-editor" id="cl-fallback-editor" spellcheck="false" aria-label="Code Editor"></textarea>
                    </div>
                    <div class="codelab-md-preview prose" id="cl-md-preview" style="display:none"></div>
                    <div class="codelab-settings-host" id="cl-settings-host" role="region" aria-label="Settings Editor" hidden style="display:none"></div>
                    <div class="codelab-inline-diff-host" id="cl-inline-diff-container" data-role="scm-diff-host" role="region" aria-label="Source Control Diff View" hidden style="display:none"></div>
                    <div class="codelab-empty-editor" id="cl-empty-editor" style="display:none"></div>
                  </div>
                </div>

                <!-- Right-Hand Split Web Preview Pane -->
                <div class="codelab-splitter-preview" id="cl-splitter-preview" role="separator" aria-orientation="vertical" title="Drag to resize web preview (double-click to reset)" style="display:none"></div>
                <div class="codelab-preview-split" id="cl-preview-split" aria-label="In-Browser Web Preview" style="display:none"></div>
              </div>

              <!-- Interactive Horizontal Splitter -->
              <div class="codelab-splitter-h" id="cl-splitter-h" role="separator" aria-orientation="horizontal" title="Drag to resize bottom panel (double-click to reset)"></div>

              <!-- Region 5: Bottom Panel (Problems / Output / Terminal / Ports / ...) -->
              <section class="codelab-drawer codelab-bottom" id="cl-drawer" aria-label="Bottom Panel">
                <div class="codelab-drawer__bar">
                  <div class="codelab-drawer__tabs" role="tablist" aria-label="Execution Output Panels">
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'sql-results' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'sql-results'}" class="codelab-drawer__tab ${this.drawerTab === 'sql-results' ? 'active' : ''}" data-cl-drawertab="sql-results" title="SQL Query Results &amp; EXPLAIN Plan" style="display:${showSqlTab ? 'inline-flex' : 'none'}">
                      ${CL_ICONS.database}
                      <span>Query Results</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'problems' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'problems'}" class="codelab-drawer__tab ${this.drawerTab === 'problems' ? 'active' : ''}" data-cl-drawertab="problems" title="Compiler &amp; Runtime Problems">
                      ${CL_ICONS.warning}
                      <span>Problems</span>
                      <span class="codelab-badge" id="cl-problems-count">${this._diagnosticsStore ? this._diagnosticsStore.getAll().length : 0}</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'output' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'output'}" class="codelab-drawer__tab ${this.drawerTab === 'output' ? 'active' : ''}" data-cl-drawertab="output" title="Workbench &amp; Runtime Output" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.code}
                      <span>Output</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'terminal' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'terminal'}" class="codelab-drawer__tab ${this.drawerTab === 'terminal' ? 'active' : ''}" data-cl-drawertab="terminal" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.terminal}
                      <span>Terminal</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'ports' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'ports'}" class="codelab-drawer__tab ${this.drawerTab === 'ports' ? 'active' : ''}" data-cl-drawertab="ports" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.radio}
                      <span>Ports</span>
                      <span class="codelab-drawer__pill" id="cl-ports-pill">${this.portTable && typeof this.portTable.listServers === 'function' ? this.portTable.listServers().length : 0} open</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'tests' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'tests'}" class="codelab-drawer__tab ${this.drawerTab === 'tests' ? 'active' : ''}" data-cl-drawertab="tests" style="${(isSingleSql && !this._findEntryFile('test')) ? 'display:none' : ''}">
                      ${CL_ICONS.check}
                      <span>Test Suite</span>
                      <span class="codelab-drawer__pill" id="cl-test-pill">Ready</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'stdin' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'stdin'}" class="codelab-drawer__tab ${this.drawerTab === 'stdin' ? 'active' : ''}" data-cl-drawertab="stdin" title="Standard Input" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.keyboard}
                      <span>Stdin</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'preview' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'preview'}" class="codelab-drawer__tab ${this.drawerTab === 'preview' ? 'active' : ''}" data-cl-drawertab="preview" title="In-browser Web Preview" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.globe}
                      <span>Web Preview</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'network' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'network'}" class="codelab-drawer__tab ${this.drawerTab === 'network' ? 'active' : ''}" data-cl-drawertab="network" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.activity}
                      <span>Network</span>
                      <span class="codelab-drawer__pill" id="cl-network-pill">${(this.lastHttpTrace || []).length} reqs</span>
                    </button>
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'inspector' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'inspector'}" class="codelab-drawer__tab ${this.drawerTab === 'inspector' ? 'active' : ''}" data-cl-drawertab="inspector" style="${isSingleSql ? 'display:none' : ''}">
                      ${CL_ICONS.database}
                      <span>Virtual Disk &amp; HTTP</span>
                      <span class="codelab-drawer__pill" id="cl-vfs-pill">0 files</span>
                    </button>
                    ${this.kernel ? `
                    <button type="button" role="tab" tabindex="${this.drawerTab === 'observability' ? '0' : '-1'}" aria-selected="${this.drawerTab === 'observability'}" class="codelab-drawer__tab ${this.drawerTab === 'observability' ? 'active' : ''}" data-cl-drawertab="observability" title="Services, Settings &amp; Event Telemetry">
                      ${CL_ICONS.activity}
                      <span>Observability</span>
                    </button>
                    ` : ''}
                    ${pluginBottomPanelsHtml}
                  </div>
                  <div class="codelab-hud-pill" id="cl-telemetry-hud" style="display:none;" title="Last Execution Telemetry"></div>
                  <div class="codelab-drawer__actions">
                    <div class="codelab-drawer__term-actions" id="cl-drawer-term-actions" style="display:${isTermDrawer ? 'inline-flex' : 'none'}">
                      <div class="codelab-terminal-sessions" id="cl-terminal-sessions"></div>
                      <button type="button" class="codelab-btn codelab-btn--icon" id="cl-new-terminal-btn" data-cl-action="new-terminal-session" title="New Terminal (⌃⇧\`)" aria-label="New Terminal Session" style="padding:2px 6px;font-size:11px;">+</button>
                      <button type="button" class="codelab-btn codelab-btn--icon" id="cl-kill-terminal-btn" data-cl-action="kill-terminal-session" title="Kill Terminal" aria-label="Kill Active Terminal" style="padding:2px 6px;font-size:11px;">${CL_ICONS.trash}</button>
                      <button type="button" class="codelab-btn codelab-btn--icon codelab-btn--ctrl-c" id="cl-ctrl-c-btn" data-cl-action="interrupt" title="Send Ctrl+C — interrupt a running command" aria-label="Send Ctrl+C interrupt" style="padding:2px 8px;font-size:11px;font-family:var(--cl-font-mono);">Ctrl+C</button>
                      <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="clear-terminal" title="Clear Terminal" aria-label="Clear Terminal" style="padding:2px 6px;font-size:11px;">Clear</button>
                    </div>
                    <button type="button" class="codelab-btn codelab-btn--icon" id="cl-maximize-drawer-btn" data-cl-action="maximize-drawer" title="Maximize / Restore Panel Size" aria-label="Maximize or Restore Panel Size" aria-pressed="${this.panelMaximized ? 'true' : 'false'}" style="padding:2px 6px;font-size:11px;">${this.panelMaximized ? CL_ICONS.chevronDown : CL_ICONS.chevronUp}</button>
                    <button type="button" class="codelab-btn codelab-btn--icon" id="cl-close-drawer-btn" data-cl-action="close-drawer" title="Close Panel (⌘J)" aria-label="Close Panel" style="padding:2px 6px;font-size:11px;">${CL_ICONS.close}</button>
                  </div>
                </div>
                <div class="codelab-drawer__body" id="cl-drawer-body"></div>
              </section>
            </div>
          </div>

          <!-- Interactive 24px Status Bar Footer -->
          <footer class="codelab-statusbar" id="cl-statusbar" role="status" aria-live="polite">
            <div class="codelab-statusbar__left">
              <span class="codelab-statusbar__item" id="cl-status-runtime">
                <span class="codelab-statusbar__dot" id="cl-status-dot"></span>
                <span id="cl-status-text">${escapeHtml(this.runtimeStatusText || 'Node.js v22 Worker · Idle')}</span>
              </span>
              <span class="codelab-statusbar__sep" aria-hidden="true"></span>
              <button type="button" class="codelab-statusbar__btn" data-cl-action="statusbar-scm" title="Source Control (⌃⇧G)" aria-label="Source Control">
                ${CL_ICONS.gitBranch}
                <span id="cl-status-scm-text">git</span>
              </button>
              <button type="button" class="codelab-statusbar__btn" data-cl-action="statusbar-problems" title="Problems (⇧⌘M)" aria-label="Problems">
                <span id="cl-status-problems-text">⊗ 0 ⚠ 0</span>
              </button>
              <span class="codelab-statusbar__sep" aria-hidden="true"></span>
              <span class="codelab-statusbar__item" id="cl-status-file">${escapeHtml(this.activeFile || 'workspace')}</span>
              <span class="codelab-statusbar__item codelab-statusbar__save" id="cl-status-save" data-save-state="saved" style="display:none"></span>
            </div>
            <div class="codelab-statusbar__right">
              <span class="codelab-statusbar__item" id="cl-status-duration" style="display:none"></span>
              <button type="button" class="codelab-statusbar__btn" id="cl-status-cursor" data-cl-action="go-to-line" title="Go to Line/Column">Ln 1, Col 1</button>
              <button type="button" class="codelab-statusbar__btn" id="cl-status-indent" data-cl-action="open-settings" title="Select Indentation">Spaces: ${tabSizeVal}</button>
              <span class="codelab-statusbar__item">UTF-8</span>
              <button type="button" class="codelab-statusbar__btn" id="cl-status-lang" data-cl-action="open-settings" title="Language Mode">${this.lang === 'sql' ? (this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18') : this.lang === 'cpp' ? 'C++20 (Clang/WASI)' : this.lang === 'py' ? 'Python 3.12 (CPython WASI)' : this.lang === 'ts' ? 'TypeScript 5.x' : 'JavaScript (CJS/ESM)'}</button>
            </div>
          </footer>

          <!-- Fixed Overlay Slots (Strictly Outside .codelab-topbar!) -->
          <div id="cl-topbar-menu-slot"></div>
          <div id="cl-modal-slot"></div>
          <div id="cl-context-menu-slot"></div>
          <div id="cl-palette-slot"></div>
          <div class="codelab-toast-container" id="cl-toast-container" role="status" aria-live="polite"></div>
        </div>
      `;

      if (this.themeOption !== 'auto' && this.themes && typeof this.themes.applyToElement === 'function') {
        const shellEl = this.container.querySelector('.codelab');
        if (shellEl && shellEl.style && typeof shellEl.style.setProperty === 'function') {
          try {
            this.themes.setTheme(resolvedTheme === 'light' ? 'light' : resolvedTheme === 'high-contrast' ? 'high-contrast' : 'dark');
            this.themes.applyToElement(shellEl);
          } catch (err) {
            this.logger.debug('Initial theme applyToElement skipped.', err);
          }
        }
      }

      this._renderStepPills();
      this._renderGuidePane();
      this._renderFileLists();
      if (typeof this._renderSearchSidebarResults === 'function' && this.activeSidebarView === 'search') {
        this._renderSearchSidebarResults();
      }
      if (typeof this._renderScmSidebar === 'function' && this.activeSidebarView === 'scm') {
        this._renderScmSidebar();
      }
      if (typeof this._renderActiveSidebarPlugin === 'function' && String(this.activeSidebarView || '').startsWith('plugin:')) {
        this._renderActiveSidebarPlugin();
      }
      this._renderBreadcrumbs();
      this._renderDrawerBody();
      this._updateStatusBar();
      this._updateRunStateUI();

      if (this._eventsBound) {
        this._bindSplitters();
      }
      if (this._editorInitialized) {
        const liveMonacoHost = this.container.querySelector('#cl-monaco-host');
        if (this.editor && liveMonacoHost && typeof this.editor.getDomNode === 'function') {
          const editorDom = this.editor.getDomNode();
          if (editorDom && !liveMonacoHost.contains(editorDom)) {
            liveMonacoHost.appendChild(editorDom);
          }
          if (this._editorResizeObserver && typeof this._editorResizeObserver.observe === 'function') {
            try {
              this._editorResizeObserver.disconnect();
              this._editorResizeObserver.observe(liveMonacoHost);
            } catch (_err) {
              void _err;
            }
          }
        }
        this._bindFallbackEditorListeners();
        this._syncActiveFileToView();
      }
    }

    _resolveStepTargetFile(rawTarget) {
      if (!rawTarget) return '';
      if (this.lang === 'sql') {
        const asSql = rawTarget.replace(/\.(js|ts|cpp|py)$/, '.sql');
        if (this.files && this.files[asSql] !== undefined) return asSql;
        if (this.files && this.files[rawTarget] !== undefined) return rawTarget;
        if (this.files && this.files['query.sql'] !== undefined) return 'query.sql';
        if (this.files && this.files['solution.sql'] !== undefined) return 'solution.sql';
        return asSql;
      }
      if (this.lang === 'cpp') {
        const asHpp = rawTarget.replace(/\.(js|ts)$/, '.hpp');
        if (this.files && this.files[asHpp] !== undefined) return asHpp;
        const asCpp = rawTarget.replace(/\.(js|ts)$/, '.cpp');
        if (this.files && this.files[asCpp] !== undefined) return asCpp;
        if (this.files && this.files['solution.hpp'] !== undefined) return 'solution.hpp';
        if (this.files && this.files['main.cpp'] !== undefined) return 'main.cpp';
        return asCpp;
      }
      if (this.lang === 'ts') {
        return rawTarget.replace(/\.js$/, '.ts');
      }
      return rawTarget;
    }

    _detectActiveSymbol(filePath) {
      if (!filePath || !this.files || typeof this.files[filePath] !== 'string') return '';
      if (this.mode === 'guided' && this.steps && this.steps.length > 0) {
        const step = this.steps[this.activeStepIndex];
        if (step) {
          const rawTarget = step.targetFile || '';
          const stepTarget = rawTarget ? this._resolveStepTargetFile(rawTarget) : '';
          if ((!stepTarget || stepTarget === filePath) && (step.targetSymbol || step.symbol)) {
            return String(step.targetSymbol || step.symbol);
          }
        }
      }
      const code = this.files[filePath];
      const classMatch = code.match(/\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (classMatch) return classMatch[1];
      const fnMatch = code.match(/\b(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (fnMatch) return fnMatch[1];
      return '';
    }

    _renderBreadcrumbs() {
      const host = this.container.querySelector('#cl-breadcrumbs');
      if (!host) return;
      if (!this.activeFile || !this.openTabs || this.openTabs.length === 0 || this.activeTab === '__settings__') {
        host.innerHTML = '';
        host.hidden = true;
        if (host.style) host.style.display = 'none';
        return;
      }
      host.hidden = false;
      if (host.style) host.style.display = '';

      const expandBtnHtml = this.hasGuidedLab ? `
        <button type="button" class="codelab-guide__expand-btn" data-cl-action="toggle-guide" title="Expand sidebar" aria-label="Expand sidebar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
          </svg>
          <span>Guide</span>
        </button>
      ` : '';

      const folderOptions = this._listWorkspaceFolders();
      const scope = this.explorerFolder || '';
      const scopeLabel = scope ? scope.split('/').pop() : 'workspace';

      const switcherHtml = `
        <div class="codelab-folder-switcher ${this.folderSwitcherOpen ? 'is-open' : ''}">
          <button type="button" class="codelab-folder-switcher__toggle ${scope ? 'is-scoped' : ''}" data-cl-action="toggle-folder-switcher" aria-haspopup="true" aria-expanded="${this.folderSwitcherOpen ? 'true' : 'false'}" title="Switch workspace folder">
            ${CL_ICONS.folder}
            <span class="codelab-folder-switcher__label">${escapeHtml(scopeLabel)}</span>
            ${CL_ICONS.chevronDown}
          </button>
          ${this.folderSwitcherOpen ? `
            <div class="codelab-folder-switcher__menu" role="menu" aria-label="Workspace folders">
              <div class="codelab-folder-switcher__section">Switch Folder</div>
              <button type="button" role="menuitem" class="codelab-folder-switcher__option ${!scope ? 'active' : ''}" data-cl-folder-option="">
                <span class="codelab-folder-switcher__icon">${CL_ICONS.folder}</span>
                <span class="codelab-folder-switcher__name">workspace</span>
                <span class="codelab-folder-switcher__path">/</span>
              </button>
              ${folderOptions.map(f => {
                const fDepth = f.split('/').length;
                const fName = f.split('/').pop();
                return `
                  <button type="button" role="menuitem" class="codelab-folder-switcher__option ${scope === f ? 'active' : ''}" data-cl-folder-option="${escapeHtml(f)}" style="padding-left:${10 + (fDepth - 1) * 12}px;">
                    <span class="codelab-folder-switcher__icon">${CL_ICONS.folder}</span>
                    <span class="codelab-folder-switcher__name">${escapeHtml(fName)}</span>
                    <span class="codelab-folder-switcher__path">${escapeHtml(f)}</span>
                  </button>
                `;
              }).join('')}
              ${folderOptions.length ? '' : '<div class="codelab-folder-switcher__empty">No subfolders yet</div>'}
            </div>
          ` : ''}
        </div>
      `;

      let pathHtml = `<button type="button" class="codelab-breadcrumbs__item codelab-breadcrumbs__item--root" data-action="command-palette-files" data-cl-action="command-palette-files" title="Quick Open File (⌘P)">workspace</button>`;

      if (this.activeFile) {
        const segments = this.activeFile.split('/');
        for (let i = 0; i < segments.length - 1; i++) {
          const folderPath = segments.slice(0, i + 1).join('/');
          pathHtml += `<span class="codelab-breadcrumbs__sep" aria-hidden="true">›</span>`;
          pathHtml += `<button type="button" class="codelab-breadcrumbs__item codelab-breadcrumbs__item--folder" data-cl-breadcrumb-folder="${escapeHtml(folderPath)}" data-folder="${escapeHtml(folderPath)}" title="Scope explorer to ${escapeHtml(folderPath)}">${escapeHtml(segments[i])}</button>`;
        }
        const fileName = segments[segments.length - 1];
        pathHtml += `<span class="codelab-breadcrumbs__sep" aria-hidden="true">›</span>`;
        pathHtml += `<button type="button" class="codelab-breadcrumbs__item codelab-breadcrumbs__item--file active" data-cl-breadcrumb-file="${escapeHtml(this.activeFile)}" data-file="${escapeHtml(this.activeFile)}">${escapeHtml(fileName)}</button>`;

        const symbol = this._detectActiveSymbol(this.activeFile);
        if (symbol) {
          pathHtml += `<span class="codelab-breadcrumbs__sep" aria-hidden="true">›</span>`;
          pathHtml += `<span class="codelab-breadcrumbs__item codelab-breadcrumbs__item--symbol" data-cl-breadcrumb-symbol="${escapeHtml(symbol)}">ƒ ${escapeHtml(symbol)}</span>`;
        }
      }

      const hasSolutions = Boolean(
        this.hasGuidedLab && (
          (this.referenceFiles && Object.keys(this.referenceFiles).length > 0) ||
          (this.tsReferenceFiles && Object.keys(this.tsReferenceFiles).length > 0) ||
          (this.solutionFiles && Object.keys(this.solutionFiles).length > 0)
        )
      );

      const diffBtnHtml = hasSolutions ? `
          <button type="button" class="codelab-breadcrumb__btn" data-action="compare-diff" data-cl-action="compare-diff" title="Compare Active File with Solution">
            ${CL_ICONS.diff}
            <span>Compare Diff</span>
          </button>
      ` : '';

      host.innerHTML = `
        ${expandBtnHtml}
        <div class="codelab-breadcrumbs__left">
          ${switcherHtml}
          <div class="codelab-breadcrumbs__path">${pathHtml}</div>
        </div>
        <div class="codelab-breadcrumbs__actions">
          ${diffBtnHtml}
          <button type="button" class="codelab-breadcrumb__btn" data-action="command-palette" data-cl-action="command-palette" title="Open Command Palette (⌘⇧P)">
            ${CL_ICONS.command}
            <span>Command Palette</span>
            <kbd class="codelab-breadcrumb__kbd">⌘⇧P</kbd>
          </button>
          <button type="button" class="codelab-breadcrumb__btn" data-action="export-workspace" data-cl-action="export-workspace" title="Export Workspace Snapshot">
            ${CL_ICONS.download}
            <span>Export</span>
          </button>
        </div>
      `;
    }

    _renderStepPills() {
      const host = this.container.querySelector('#cl-step-pills');
      if (!host) return;
      if (!this.steps.length || this.guideTab === 'readme' || this.mode === 'sandbox') {
        host.innerHTML = '';
        host.style.display = 'none';
        return;
      }
      host.style.display = '';

      const existingPills = host.querySelectorAll('.codelab-step-pill');
      if (existingPills.length === this.steps.length) {
        existingPills.forEach((pill, idx) => {
          const step = this.steps[idx];
          const passed = step && this.completedSteps.has(step.id);
          const active = idx === this.activeStepIndex;
          pill.classList.toggle('active', active);
          pill.classList.toggle('passed', !!passed);
          pill.setAttribute('aria-selected', String(active));
          const numSpan = pill.querySelector('.codelab-step-pill__num');
          if (numSpan) numSpan.textContent = passed ? '✓' : String(idx + 1);
        });
        return;
      }

      host.innerHTML = `<div class="codelab-step-pills" role="tablist" aria-label="Guided Steps">
        ${this.steps.map((step, idx) => {
          const passed = this.completedSteps.has(step.id);
          const active = idx === this.activeStepIndex;
          return `<button type="button" role="tab" aria-selected="${active}" class="codelab-step-pill ${active ? 'active' : ''} ${passed ? 'passed' : ''}" data-cl-step="${idx}">
            <span class="codelab-step-pill__num">${passed ? '✓' : idx + 1}</span>
            <span class="codelab-step-pill__label">Step ${idx + 1}</span>
          </button>`;
        }).join('')}
      </div>`;
    }

    _renderGuidePane() {
      const contentEl = this.container.querySelector('#cl-guide-content');
      const footerEl = this.container.querySelector('#cl-guide-footer');
      if (!contentEl || !footerEl) return;

      // Update tab active states
      this.container.querySelectorAll('[data-cl-guidetab]').forEach(btn => {
        const isActive = btn.dataset.clGuidetab === this.guideTab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });

      this._renderStepPills();

      if (this.guideTab === 'readme' || !this.steps.length) {
        const readmeContent = this.files['README.md'] || this.referenceFiles['README.md'] || this.summary || 'No architecture brief available.';
        contentEl.innerHTML = `<div class="codelab-guide-prose">${renderSimpleMarkdown(readmeContent)}</div>`;
        footerEl.innerHTML = `
          <div class="codelab-guide__footer-row codelab-guide__footer-row--secondary">
            <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="run-tests" title="Run full test suite (⌘+Enter)">
              ${CL_ICONS.check}
              <span>All Tests</span>
            </button>
            <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="show-diff" title="Compare with Reference Solution">
              ${CL_ICONS.lightbulb}
              <span>Solution</span>
            </button>
            <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="reset-lab" title="Reset Lab Code to Starter State">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Reset</span>
            </button>
          </div>
          ${this.steps.length ? `
            <div class="codelab-guide__footer-row">
              <button type="button" class="codelab-btn" data-cl-guidetab="steps" style="width:100%;">Back to Steps →</button>
            </div>
          ` : `
            <div class="codelab-guide__footer-row">
              <span style="font-size:11.5px;color:var(--cl-fg-muted);">100% In-Browser Web Worker Sandbox</span>
            </div>
          `}
        `;
        return;
      }

      const step = this.steps[this.activeStepIndex] || this.steps[0];
      const isStepPassed = this.completedSteps.has(step.id);
      const targetFile = step.targetFile ? this._resolveStepTargetFile(step.targetFile) : this._pickDefaultFile();
      const progressPct = Math.round((this.completedSteps.size / Math.max(1, this.steps.length)) * 100);

      // Match step test results
      const stepResultsMap = new Map(this.lastTestResults.map(r => [r.name, r]));

      contentEl.innerHTML = `
        <div class="codelab-step-header">
          <div class="codelab-step-progress-bar" title="${this.completedSteps.size} of ${this.steps.length} steps completed">
            <div class="codelab-step-progress-bar__fill" style="width:${progressPct}%"></div>
          </div>
          <div class="codelab-step-eyebrow">
            <span>Step ${this.activeStepIndex + 1} of ${this.steps.length}</span>
            <span class="codelab-step-status ${isStepPassed ? 'passed' : ''}">${isStepPassed ? '✓ Completed' : 'In Progress'}</span>
          </div>
          <div class="codelab-step-title">${escapeHtml(step.title)}</div>
          ${targetFile ? `
            <button type="button" class="codelab-step-target" data-cl-jump-file="${escapeHtml(targetFile)}" data-cl-jump-symbol="${escapeHtml(step.targetSymbol || '')}">
              ${CL_ICONS.file}
              <span>${escapeHtml(targetFile)}</span>
              ${step.targetSymbol ? `<span style="opacity:0.75">→ ${escapeHtml(step.targetSymbol)}</span>` : ''}
            </button>
          ` : ''}
        </div>

        ${step.concept ? `
          <div class="codelab-step-concept">
            <div class="codelab-step-concept__label">Architecture Concept</div>
            <div>${escapeHtml(step.concept)}</div>
          </div>
        ` : ''}

        <div class="codelab-guide-prose">
          ${renderSimpleMarkdown(step.instructions)}
        </div>

        ${Array.isArray(step.testNames) && step.testNames.length ? `
          <div class="codelab-step-checks">
            <div class="codelab-step-checks__title">Step Verification Tests (${step.testNames.length})</div>
            ${step.testNames.map(tName => {
              const res = stepResultsMap.get(tName);
              const statusClass = res ? (res.status === 'pass' ? 'pass' : 'fail') : '';
              const icon = res ? (res.status === 'pass' ? '✓' : '✖') : '○';
              return `
                <div class="codelab-check-item ${statusClass}">
                  <span class="codelab-check-icon">${icon}</span>
                  <span>${escapeHtml(tName)}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${step.hint ? `
          <div class="codelab-hint-box" id="cl-hint-box">
            <button type="button" class="codelab-hint-toggle" data-cl-action="toggle-hint">
              <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.lightbulb}<span>Need a hint for Step ${this.activeStepIndex + 1}?</span></span>
              <span>Show ▾</span>
            </button>
            <div class="codelab-hint-body codelab-guide-prose">
              ${renderSimpleMarkdown(step.hint)}
            </div>
          </div>
        ` : ''}
      `;

      const hasPrev = this.activeStepIndex > 0;
      const hasNext = this.activeStepIndex < this.steps.length - 1;
      footerEl.innerHTML = `
        <div class="codelab-guide__footer-row">
          <button type="button" class="codelab-btn" data-cl-step="${this.activeStepIndex - 1}" ${!hasPrev ? 'disabled' : ''}>← Prev</button>
          <button type="button" class="codelab-btn codelab-btn--test" data-cl-action="verify-step">
            ${CL_ICONS.check}
            <span>Verify Step ${this.activeStepIndex + 1}</span>
          </button>
          <button type="button" class="codelab-btn" data-cl-step="${this.activeStepIndex + 1}" ${!hasNext ? 'disabled' : ''}>Next →</button>
        </div>
        <div class="codelab-guide__footer-row codelab-guide__footer-row--secondary">
          <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="run-tests" title="Run full test suite across all steps (⌘+Enter)">
            ${CL_ICONS.check}
            <span>All Tests</span>
          </button>
          <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="show-diff" title="Compare with Reference Solution">
            ${CL_ICONS.lightbulb}
            <span>Solution</span>
          </button>
          <button type="button" class="codelab-btn codelab-btn--subtle" data-cl-action="reset-lab" title="Reset Lab Code to Starter State">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>Reset</span>
          </button>
        </div>
      `;
    }

    _globToRegExp(globStr) {
      let pat = String(globStr || '').trim().replace(/^\/+/, '');
      if (!pat) return null;
      let regex = '^';
      let i = 0;
      while (i < pat.length) {
        const c = pat[i];
        if (c === '*' && pat[i + 1] === '*') {
          if (pat[i + 2] === '/') {
            regex += '(?:.+/)?';
            i += 3;
          } else {
            regex += '.*';
            i += 2;
          }
        } else if (c === '*') {
          regex += '[^/]*';
          i++;
        } else if (c === '?') {
          regex += '[^/]';
          i++;
        } else if ('.+^${}()|[]\\'.includes(c)) {
          regex += '\\' + c;
          i++;
        } else {
          regex += c;
          i++;
        }
      }
      regex += '$';
      try {
        return new RegExp(regex);
      } catch (err) {
        void err;
        return null;
      }
    }

    _getExcludePatterns() {
      if (!this.configuration) return [];
      const raw = this.configuration.get('files.exclude', []);
      const patterns = [];
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          if (typeof entry === 'string' && entry.trim()) patterns.push(entry.trim());
        }
      } else if (raw && typeof raw === 'object') {
        for (const [glob, enabled] of Object.entries(raw)) {
          if (enabled && glob && glob.trim()) patterns.push(glob.trim());
        }
      }
      return patterns;
    }

    _isPathExcluded(relPath) {
      if (!relPath) return false;
      const clean = String(relPath).replace(/^\/+|\/+$/g, '');
      if (!clean) return false;
      if (clean === '.git' || clean.startsWith('.git/')) return true;
      const patterns = this._getExcludePatterns();
      if (!patterns.length) return false;
      const segments = clean.split('/');
      const baseName = segments[segments.length - 1] || clean;
      for (const pat of patterns) {
        const re = this._globToRegExp(pat);
        if (!re) continue;
        if (re.test(clean) || re.test(clean + '/')) return true;
        if (!pat.includes('/') && re.test(baseName)) return true;
        let prefix = '';
        for (let i = 0; i < segments.length - 1; i++) {
          prefix = prefix ? `${prefix}/${segments[i]}` : segments[i];
          if (re.test(prefix) || re.test(prefix + '/')) return true;
          if (!pat.includes('/') && re.test(segments[i])) return true;
        }
      }
      return false;
    }

    _buildFileTree() {
      const rootNode = {
        name: '',
        fullPath: '',
        folders: new Map(),
        files: new Map()
      };

      const getOrCreateDirNode = (dirPath) => {
        if (!dirPath) return rootNode;
        const segments = dirPath.split('/');
        let current = rootNode;
        let runningPath = '';
        for (const seg of segments) {
          runningPath = runningPath ? `${runningPath}/${seg}` : seg;
          if (!current.folders.has(seg)) {
            current.folders.set(seg, {
              name: seg,
              fullPath: runningPath,
              folders: new Map(),
              files: new Map()
            });
          }
          current = current.folders.get(seg);
        }
        return current;
      };

      if (this.folders) {
        for (const folder of this.folders) {
          if (folder && !this._isPathExcluded(folder)) getOrCreateDirNode(folder);
        }
      }

      for (const filePath of this._orderedFileNames()) {
        if (this._isPathExcluded(filePath)) continue;
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash === -1) {
          rootNode.files.set(filePath, filePath);
        } else {
          const dirPath = filePath.slice(0, lastSlash);
          if (this._isPathExcluded(dirPath)) continue;
          const baseName = filePath.slice(lastSlash + 1);
          const dirNode = getOrCreateDirNode(dirPath);
          dirNode.files.set(baseName, filePath);
        }
      }

      return rootNode;
    }

    _listWorkspaceFolders() {
      const set = new Set();
      if (this.folders) {
        for (const f of this.folders) {
          if (f && !this._isPathExcluded(f)) set.add(f);
        }
      }
      for (const filePath of this._orderedFileNames()) {
        if (this._isPathExcluded(filePath)) continue;
        const idx = filePath.lastIndexOf('/');
        if (idx <= 0) continue;
        const parts = filePath.slice(0, idx).split('/');
        let running = '';
        for (const p of parts) {
          running = running ? `${running}/${p}` : p;
          if (!this._isPathExcluded(running)) set.add(running);
        }
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }

    _resolveFolderNode(rootNode, folderPath) {
      if (!rootNode || !folderPath) return null;
      let current = rootNode;
      for (const seg of folderPath.split('/')) {
        if (!current || !current.folders || !current.folders.has(seg)) return null;
        current = current.folders.get(seg);
      }
      return current || null;
    }

    _renderFileLists() {
      if (this._isBooting) return;
      const shell = this.container.querySelector('.codelab');
      if (shell && shell.classList) {
        shell.classList.toggle('is-sql-single-file', this._isSingleFileSqlMode());
      }
      const explorerEl = this.container.querySelector('#cl-explorer-list');
      const tabsEl = this.container.querySelector('#cl-tabs, #cl-file-tabs');
      const explorerLangEl = this.container.querySelector('#cl-explorer-lang');
      if (explorerLangEl) explorerLangEl.textContent = this.lang.toUpperCase();
      if (!explorerEl || !tabsEl) return;

      const treeRoot = this._buildFileTree();
      if (this.explorerFolder && !this._resolveFolderNode(treeRoot, this.explorerFolder)) {
        this.explorerFolder = '';
      }
      const scope = this.explorerFolder || '';
      const renderRoot = scope ? this._resolveFolderNode(treeRoot, scope) : treeRoot;
      const rootParent = scope;
      let treeHtml = '';

      const renderNode = (node, depth) => {
        const sortedFolders = Array.from(node.folders.values()).sort((a, b) => a.name.localeCompare(b.name));
        for (const fNode of sortedFolders) {
          const isCollapsed = this.collapsedFolders.has(fNode.fullPath);
          const indent = depth * 14 + 10;
          const isRenamingFolder = Boolean(
            this.renamingItem &&
            this.renamingItem.type === 'folder' &&
            this.renamingItem.targetPath === fNode.fullPath
          );
          if (isRenamingFolder) {
            treeHtml += `
              <div class="codelab-tree-create-wrap">
                <div class="codelab-tree-create-row codelab-tree-rename-row" style="padding-left: ${indent}px;">
                  <span class="codelab-tree-create-icon">${CL_ICONS.folder}</span>
                  <input type="text" id="cl-tree-rename-input" class="codelab-tree-input codelab-inline-input" value="${escapeHtml(fNode.name)}" aria-label="Rename folder ${escapeHtml(fNode.name)}" aria-invalid="false" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
                </div>
                <div id="cl-tree-input-error" class="codelab-tree-input-error" role="alert" hidden></div>
              </div>
            `;
          } else {
            treeHtml += `
              <div class="codelab-folder-item ${isCollapsed ? 'collapsed' : 'expanded'}" tabindex="0" data-cl-folder="${escapeHtml(fNode.fullPath)}" data-folder="${escapeHtml(fNode.fullPath)}" data-cl-drop-folder="${escapeHtml(fNode.fullPath)}" data-depth="${depth}" style="padding-left: ${indent}px;">
                <button type="button" class="codelab-chevron" data-cl-action="toggle-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="${isCollapsed ? 'Expand folder' : 'Collapse folder'}" aria-label="${isCollapsed ? 'Expand folder' : 'Collapse folder'}">
                  ${isCollapsed ? CL_ICONS.chevronRight : CL_ICONS.chevronDown}
                </button>
                <span class="codelab-folder-icon">${CL_ICONS.folder}</span>
                <span class="codelab-folder-name" title="${escapeHtml(fNode.name)}">${escapeHtml(fNode.name)}</span>
                <div class="codelab-node-actions">
                  <button type="button" class="codelab-node-action" data-cl-action="new-file-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="New File in ${escapeHtml(fNode.name)}">${CL_ICONS.plus}</button>
                  <button type="button" class="codelab-node-action" data-cl-action="new-folder-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="New Folder in ${escapeHtml(fNode.name)}">${CL_ICONS.folder}</button>
                  <button type="button" class="codelab-node-action" data-cl-action="rename-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="Rename Folder" aria-label="Rename Folder ${escapeHtml(fNode.name)}">✎</button>
                  <button type="button" class="codelab-node-action" data-cl-action="delete-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="Delete Folder">${CL_ICONS.trash}</button>
                </div>
              </div>
            `;
          }

          if (this.creatingItem && this.creatingItem.parentFolder === fNode.fullPath && !isCollapsed) {
            const createIndent = (depth + 1) * 14 + 10;
            treeHtml += `
              <div class="codelab-tree-create-wrap">
                <div class="codelab-tree-create-row" style="padding-left: ${createIndent}px;">
                  <span class="codelab-tree-create-icon">${this.creatingItem.type === 'folder' ? CL_ICONS.folder : CL_ICONS.file}</span>
                  <input type="text" id="cl-tree-create-input" class="codelab-tree-input codelab-inline-input" placeholder="${this.creatingItem.type === 'folder' ? 'folder-name' : 'filename.' + this.lang}" aria-label="${this.creatingItem.type === 'folder' ? 'New folder name' : 'New file name'}" aria-invalid="false" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
                </div>
                <div id="cl-tree-input-error" class="codelab-tree-input-error" role="alert" hidden></div>
              </div>
            `;
          }

          if (!isCollapsed) {
            renderNode(fNode, depth + 1);
          }
        }

        const sortedFiles = Array.from(node.files.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [baseName, fullPath] of sortedFiles) {
          const isActive = fullPath === this.activeFile;
          const badge = fullPath.endsWith('.md') ? 'DOC' : fullPath.endsWith('.json') ? 'PKG' : /\.sql$/i.test(fullPath) ? 'SQL' : /(^|\/)test\./i.test(fullPath) ? 'TEST' : /(^|\/)(demo|main)\./i.test(fullPath) ? 'DEMO' : /\.(hpp|h)$/i.test(fullPath) ? 'HDR' : 'SRC';
          const ext = /\.(cpp|cc|cxx|hpp|h)$/i.test(fullPath) ? 'cpp' : /\.sql$/i.test(fullPath) ? 'sql' : fullPath.endsWith('.py') ? 'py' : fullPath.endsWith('.ts') ? 'ts' : fullPath.endsWith('.js') ? 'js' : fullPath.endsWith('.json') ? 'json' : fullPath.endsWith('.md') ? 'md' : 'txt';
          const fileIcon = (ext === 'json' || ext === 'sql') ? CL_ICONS.database : ext === 'md' ? CL_ICONS.book : CL_ICONS.file;
          const indent = depth * 14 + 10;
          const isRenamingFile = Boolean(
            this.renamingItem &&
            this.renamingItem.type === 'file' &&
            this.renamingItem.targetPath === fullPath
          );
          if (isRenamingFile) {
            treeHtml += `
              <div class="codelab-tree-create-wrap">
                <div class="codelab-tree-create-row codelab-tree-rename-row" style="padding-left: ${indent}px;">
                  <span class="codelab-tree-create-icon">${fileIcon}</span>
                  <input type="text" id="cl-tree-rename-input" class="codelab-tree-input codelab-inline-input" value="${escapeHtml(baseName)}" aria-label="Rename file ${escapeHtml(baseName)}" aria-invalid="false" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
                </div>
                <div id="cl-tree-input-error" class="codelab-tree-input-error" role="alert" hidden></div>
              </div>
            `;
          } else {
            const isFileDirty = Boolean(this._dirtyFiles && this._dirtyFiles.has(fullPath));
            treeHtml += `
              <button type="button" class="codelab-file-item ${isActive ? 'active' : ''}"${isFileDirty ? ' data-dirty="true"' : ''} draggable="true" data-cl-file="${escapeHtml(fullPath)}" data-file="${escapeHtml(fullPath)}" data-depth="${depth}" style="padding-left: ${indent}px;">
                <span class="codelab-file-icon">${fileIcon}</span>
                <span class="codelab-file-name" title="${escapeHtml(baseName)}">${escapeHtml(baseName)}</span>
                ${isFileDirty ? '<span class="codelab-file-dirty" title="Unsaved changes" aria-hidden="true"></span>' : ''}
                <span class="codelab-file-badge">${badge}</span>
              </button>
            `;
          }
        }
      };

      if (this.creatingItem && this.creatingItem.parentFolder === rootParent) {
        treeHtml += `
          <div class="codelab-tree-create-wrap">
            <div class="codelab-tree-create-row" style="padding-left: 10px;">
              <span class="codelab-tree-create-icon">${this.creatingItem.type === 'folder' ? CL_ICONS.folder : CL_ICONS.file}</span>
              <input type="text" id="cl-tree-create-input" class="codelab-tree-input codelab-inline-input" placeholder="${this.creatingItem.type === 'folder' ? 'folder-name' : 'filename.' + this.lang}" aria-label="${this.creatingItem.type === 'folder' ? 'New folder name' : 'New file name'}" aria-invalid="false" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
            </div>
            <div id="cl-tree-input-error" class="codelab-tree-input-error" role="alert" hidden></div>
          </div>
        `;
      }

      if (scope) {
        treeHtml += `
          <button type="button" class="codelab-scope-up" data-cl-folder-option="" title="Back to workspace root">
            <span class="codelab-scope-up__arrow">←</span>
            <span class="codelab-scope-up__label">workspace</span>
          </button>
        `;
      }

      if (renderRoot) {
        renderNode(renderRoot, 0);
      }

      if (!this.creatingItem && !this.renamingItem && !scope && renderRoot && renderRoot.folders.size === 0 && renderRoot.files.size === 0) {
        treeHtml = `
          <div class="codelab-explorer-empty codelab-explorer-welcome" data-cl-empty-state="explorer">
            <p class="codelab-explorer-welcome__text">No files in workspace yet.</p>
            <div class="codelab-explorer-welcome__actions">
              <button type="button" class="codelab-btn codelab-btn--primary" data-cl-action="new-file-root">New File</button>
              <button type="button" class="codelab-btn" data-cl-action="open-clone-modal">Clone Repository</button>
            </div>
          </div>
        `;
      }

      explorerEl.innerHTML = treeHtml;

      // Attach file drag events
      explorerEl.querySelectorAll('.codelab-file-item').forEach(el => {
        el.addEventListener('dragstart', ev => {
          this._draggedFile = el.dataset.clFile;
          if (ev.dataTransfer) {
            ev.dataTransfer.setData('text/plain', el.dataset.clFile || '');
            ev.dataTransfer.effectAllowed = 'move';
          }
        });
        el.addEventListener('dragend', () => {
          this._draggedFile = null;
        });
      });

      // Attach folder drop events
      explorerEl.querySelectorAll('.codelab-folder-item').forEach(el => {
        el.addEventListener('dragover', ev => {
          ev.preventDefault();
          if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
          el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => {
          el.classList.remove('drag-over');
        });
        el.addEventListener('drop', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          el.classList.remove('drag-over');
          const fileToMove = this._draggedFile || (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
          const folder = el.dataset.clFolder;
          if (fileToMove && folder !== undefined) {
            this.moveFile(fileToMove, folder);
          }
        });
      });

      // Explorer container drop target (for moving to workspace root)
      if (!explorerEl._dragBound) {
        explorerEl._dragBound = true;
        explorerEl.addEventListener('dragover', ev => {
          ev.preventDefault();
        });
        explorerEl.addEventListener('drop', ev => {
          if (ev.target.closest && ev.target.closest('.codelab-folder-item')) return;
          ev.preventDefault();
          const fileToMove = this._draggedFile || (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
          if (fileToMove) {
            this.moveFile(fileToMove, '');
          }
        });
      }

      const showInlineTreeError = (inputEl, msg) => {
        const errEl = explorerEl.querySelector('#cl-tree-input-error');
        if (errEl) {
          errEl.textContent = msg;
          errEl.hidden = false;
        }
        if (inputEl) {
          inputEl.setAttribute('aria-invalid', 'true');
          inputEl.setAttribute('aria-describedby', 'cl-tree-input-error');
          if (typeof inputEl.focus === 'function') inputEl.focus();
        }
      };

      const clearInlineTreeError = (inputEl) => {
        const errEl = explorerEl.querySelector('#cl-tree-input-error');
        if (errEl) {
          errEl.textContent = '';
          errEl.hidden = true;
        }
        if (inputEl) {
          inputEl.setAttribute('aria-invalid', 'false');
          inputEl.removeAttribute('aria-describedby');
        }
      };

      // Tree inline creation input listeners
      const treeInput = explorerEl.querySelector('#cl-tree-create-input');
      if (treeInput) {
        let createSettled = false;
        let hasInlineError = false;
        treeInput.focus();
        treeInput.addEventListener('input', () => {
          hasInlineError = false;
          clearInlineTreeError(treeInput);
        });
        treeInput.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            createSettled = true;
            this.creatingItem = null;
            this._renderFileLists();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.isComposing || e.keyCode === 229) return;
            if (createSettled) return;
            const val = (treeInput.value || '').trim();
            const item = this.creatingItem;
            if (!item) return;
            if (!val) {
              hasInlineError = true;
              showInlineTreeError(treeInput, 'A file or folder name must be provided.');
              return;
            }
            const rawFull = item.parentFolder ? `${item.parentFolder}/${val}` : val;
            const normalized = this._normalizeWorkspaceRelPath(rawFull);
            if (!normalized) {
              hasInlineError = true;
              showInlineTreeError(treeInput, 'Invalid path: relative traversal ("..") or empty segments are not allowed.');
              return;
            }
            if (item.type === 'folder') {
              const conflict = this._hasPathConflict(normalized, { kind: 'folder' });
              if (conflict) {
                hasInlineError = true;
                showInlineTreeError(
                  treeInput,
                  conflict === 'reserved-name'
                    ? `"${normalized}" is a reserved directory name (.git / node_modules).`
                    : conflict === 'ancestor-is-file'
                      ? `Cannot create "${normalized}" inside an existing file.`
                      : `A file or folder "${normalized}" already exists at this location.`
                );
                return;
              }
              createSettled = true;
              this.creatingItem = null;
              this.createFolder(normalized);
            } else {
              const resolvedFile = this._resolveCreatedFilename(normalized);
              if (!resolvedFile) {
                hasInlineError = true;
                showInlineTreeError(treeInput, 'Invalid file name.');
                return;
              }
              const conflict = this._hasPathConflict(resolvedFile, { kind: 'file' });
              if (conflict) {
                hasInlineError = true;
                showInlineTreeError(
                  treeInput,
                  conflict === 'reserved-name'
                    ? `"${resolvedFile}" uses a reserved directory name (.git / node_modules).`
                    : conflict === 'ancestor-is-file'
                      ? `Cannot create "${resolvedFile}" inside an existing file.`
                      : `A file or folder "${resolvedFile}" already exists at this location.`
                );
                return;
              }
              createSettled = true;
              this.creatingItem = null;
              this.createFile(resolvedFile, '');
            }
          }
        });
        treeInput.addEventListener('blur', () => {
          if (createSettled) return;
          if (hasInlineError) return;
          createSettled = true;
          if (this.creatingItem) {
            const val = (treeInput.value || '').trim();
            const item = this.creatingItem;
            this.creatingItem = null;
            if (val && item) {
              const rawFull = item.parentFolder ? `${item.parentFolder}/${val}` : val;
              const normalized = this._normalizeWorkspaceRelPath(rawFull);
              if (normalized) {
                if (item.type === 'folder') {
                  if (!this._hasPathConflict(normalized, { kind: 'folder' })) {
                    this.createFolder(normalized);
                    return;
                  }
                } else {
                  const resolvedFile = this._resolveCreatedFilename(normalized);
                  if (resolvedFile && !this._hasPathConflict(resolvedFile, { kind: 'file' })) {
                    this.createFile(resolvedFile, '');
                    return;
                  }
                }
              }
            }
            this._renderFileLists();
          }
        });
      }

      // Tree inline rename input listeners
      const renameInput = explorerEl.querySelector('#cl-tree-rename-input');
      if (renameInput) {
        let renameSettled = false;
        let hasRenameError = false;
        renameInput.focus();
        if (typeof renameInput.setSelectionRange === 'function') {
          try {
            const val = renameInput.value || '';
            const dotIdx = this.renamingItem && this.renamingItem.type === 'file' ? val.lastIndexOf('.') : -1;
            renameInput.setSelectionRange(0, dotIdx > 0 ? dotIdx : val.length);
          } catch (err) {
            _bootDebug('renameInput.setSelectionRange failed', err);
          }
        }
        renameInput.addEventListener('input', () => {
          hasRenameError = false;
          clearInlineTreeError(renameInput);
        });
        const commitRename = (fromBlur) => {
          if (renameSettled) return;
          const rawVal = (renameInput.value || '').trim().replace(/^\/+|\/+$/g, '');
          const item = this.renamingItem;
          if (!item) return;
          if (!rawVal) {
            if (fromBlur) {
              renameSettled = true;
              this.renamingItem = null;
              this._renderFileLists();
              return;
            }
            hasRenameError = true;
            showInlineTreeError(renameInput, 'A file or folder name must be provided.');
            return;
          }
          const lastSlash = item.targetPath.lastIndexOf('/');
          const parentDir = lastSlash > 0 ? item.targetPath.slice(0, lastSlash) : '';
          const candidatePath = rawVal.includes('/')
            ? rawVal
            : (parentDir ? `${parentDir}/${rawVal}` : rawVal);
          const nextPath = this._normalizeWorkspaceRelPath(candidatePath);
          if (!nextPath) {
            if (fromBlur) {
              renameSettled = true;
              this.renamingItem = null;
              this._renderFileLists();
              return;
            }
            hasRenameError = true;
            showInlineTreeError(renameInput, 'Invalid path: relative traversal ("..") is not allowed.');
            return;
          }
          if (nextPath === item.targetPath) {
            renameSettled = true;
            this.renamingItem = null;
            this._renderFileLists();
            return;
          }
          const itemKind = item.type === 'folder' ? 'folder' : 'file';
          const conflict = this._hasPathConflict(nextPath, {
            kind: itemKind,
            ignorePath: item.targetPath,
            ignoreKind: itemKind
          });
          if (conflict) {
            if (fromBlur) {
              renameSettled = true;
              this.renamingItem = null;
              this._renderFileLists();
              return;
            }
            hasRenameError = true;
            showInlineTreeError(
              renameInput,
              conflict === 'reserved-name'
                ? `"${nextPath}" is a reserved directory name (.git / node_modules).`
                : conflict === 'ancestor-is-file'
                  ? `Cannot move "${nextPath}" inside an existing file.`
                  : conflict === 'self-subtree'
                    ? `Cannot move "${item.targetPath}" into a subdirectory of itself.`
                    : `A file or folder "${nextPath}" already exists at this location.`
            );
            return;
          }
          renameSettled = true;
          this.renamingItem = null;
          const ok = item.type === 'folder'
            ? this.renameFolder(item.targetPath, nextPath)
            : this.renameFile(item.targetPath, nextPath);
          if (!ok) {
            this._renderFileLists();
          }
        };
        renameInput.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            renameSettled = true;
            this.renamingItem = null;
            this._renderFileLists();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.isComposing || e.keyCode === 229) return;
            commitRename(false);
          }
        });
        renameInput.addEventListener('blur', () => {
          if (hasRenameError) return;
          commitRename(true);
        });
      }

      // Tabs rendering (strictly WAI-ARIA compliant: zero nested <button> inside [role="tab"]!)
      const openTabs = Array.isArray(this.openTabs) ? this.openTabs : [];
      const effectiveActiveTab = this.settingsTabOpen && this.activeTab === '__settings__'
        ? '__settings__'
        : this.activeFile;
      const tabsHtml = openTabs.map(f => {
        const isActive = f === effectiveActiveTab;
        const isDirty = Boolean(this._dirtyFiles && this._dirtyFiles.has(f));
        const ext = /\.(cpp|cc|cxx|hpp|h)$/i.test(f) ? 'cpp' : /\.sql$/i.test(f) ? 'sql' : f.endsWith('.py') ? 'py' : f.endsWith('.ts') ? 'ts' : f.endsWith('.js') ? 'js' : f.endsWith('.json') ? 'json' : f.endsWith('.md') ? 'md' : 'txt';
        return `
          <div role="tab" tabindex="${isActive ? '0' : '-1'}" aria-selected="${isActive}"${isDirty ? ' data-dirty="true"' : ''} class="codelab-tab ${isActive ? 'active' : ''}" data-cl-file="${escapeHtml(f)}" data-tab-file="${escapeHtml(f)}">
            <span class="codelab-tab__ext codelab-tab__ext--${ext}">${ext === 'cpp' ? 'C++' : ext.toUpperCase()}</span>
            <span class="codelab-tab__label">${escapeHtml(f)}</span>
            ${isDirty ? '<span class="codelab-tab__dirty" title="Unsaved changes" aria-hidden="true"></span>' : ''}
            <span role="button" tabindex="0" class="codelab-tab__close" data-action="close-tab" data-cl-close-file="${escapeHtml(f)}" title="Close ${escapeHtml(f)}" aria-label="Close ${escapeHtml(f)}">×</span>
          </div>
        `;
      }).join('');
      const settingsTabHtml = this.settingsTabOpen
        ? `
          <div role="tab" tabindex="${effectiveActiveTab === '__settings__' ? '0' : '-1'}" aria-selected="${effectiveActiveTab === '__settings__'}" class="codelab-tab ${effectiveActiveTab === '__settings__' ? 'active' : ''}" data-cl-tab="__settings__" data-tab-file="__settings__">
            <span class="codelab-tab__ext codelab-tab__ext--json">${CL_ICONS.settings}</span>
            <span class="codelab-tab__label">Settings</span>
            <span role="button" tabindex="0" class="codelab-tab__close" data-action="close-tab" data-cl-close-tab="__settings__" title="Close Settings" aria-label="Close Settings">×</span>
          </div>
        `
        : '';

      const newFileControl = this.isCreatingFile
        ? `<form class="codelab-new-file-form" id="cl-new-file-form">
             <input type="text" class="codelab-new-file-input" id="cl-new-file-input" placeholder="helper.${this.lang}" autocomplete="off" spellcheck="false" aria-label="New file name" />
           </form>`
        : `<button type="button" class="codelab-tab-add" data-cl-action="new-file" title="Create New File in Workspace" aria-label="Create New File">+</button>`;

      const { npmPackages, builtinModules } = this._detectPackages();
      const pkgBadge = npmPackages.length > 0 ? `${npmPackages.length} npm` : `${builtinModules.length} std`;
      const pkgBtnHtml = `
        <button type="button" class="codelab-pkg-btn" data-cl-action="open-packages" title="Manage Dependencies &amp; Built-ins">
          ${CL_ICONS.package}
          <span>Packages</span>
          <span class="codelab-drawer__pill" style="padding:0 5px;font-size:10px;">${pkgBadge}</span>
        </button>
      `;

      const mdToggleHtml = (this.activeFile && /\.md$/i.test(this.activeFile) && effectiveActiveTab !== '__settings__')
        ? `<button type="button" class="codelab-pkg-btn ${this._mdPreviewOpen ? 'active' : ''}" data-cl-action="toggle-md-preview" aria-pressed="${Boolean(this._mdPreviewOpen)}" title="${this._mdPreviewOpen ? 'Edit Markdown Source' : 'Open Markdown Preview'}">
            <span>${this._mdPreviewOpen ? 'Edit Source' : 'Preview'}</span>
          </button>`
        : '';

      tabsEl.innerHTML = tabsHtml + settingsTabHtml;
      const tabsActionsEl = this.container.querySelector('#cl-file-tabs-actions');
      if (tabsActionsEl) {
        tabsActionsEl.innerHTML = mdToggleHtml + newFileControl + pkgBtnHtml;
      }

      if (this.isCreatingFile) {
        const actionHost = tabsActionsEl || tabsEl;
        const input = actionHost.querySelector('#cl-new-file-input');
        const form = actionHost.querySelector('#cl-new-file-form');
        if (input) {
          input.focus();
          input.addEventListener('keydown', ev => {
            if (ev.key === 'Escape') {
              ev.stopPropagation();
              this.isCreatingFile = false;
              this._renderFileLists();
            }
          });
          input.addEventListener('blur', () => {
            if (this.isCreatingFile) {
              this.isCreatingFile = false;
              this._renderFileLists();
            }
          });
        }
        if (form) {
          form.addEventListener('submit', ev => {
            ev.preventDefault();
            const rawName = (input?.value || '').trim();
            this.isCreatingFile = false;
            if (rawName) {
              this.createFile(rawName);
            } else {
              this._renderFileLists();
            }
          });
        }
      }
    }

    _renderTabs() {
      this._renderFileLists();
    }

    _resolveCreatedFilename(rawPath) {
      const clean = this._normalizeWorkspaceRelPath(rawPath);
      if (!clean) return null;
      const baseOnly = clean.split('/').pop() || '';
      const isKnownExtensionless = /^(Makefile|Dockerfile|Containerfile|LICENSE|COPYING|NOTICE|AUTHORS|Procfile|Gemfile|Rakefile|Vagrantfile|Justfile|Brewfile)$/i.test(baseOnly);
      if (
        !isKnownExtensionless &&
        !/\.(js|ts|jsx|tsx|mjs|cjs|py|cpp|cc|cxx|hpp|h|html|css|json|md|txt|sh|sql|yaml|yml)$/i.test(clean) &&
        !baseOnly.includes('.')
      ) {
        return `${clean}.${this.lang}`;
      }
      return clean;
    }

    _getAllKnownFolders(ignoreFolderPrefix = '') {
      const set = new Set();
      const cleanIgnore = ignoreFolderPrefix ? (this._normalizeWorkspaceRelPath(ignoreFolderPrefix) || '') : '';
      const isIgnored = (p) => Boolean(cleanIgnore && (p === cleanIgnore || p.startsWith(cleanIgnore + '/')));
      if (this.folders) {
        for (const f of this.folders) {
          const cf = this._normalizeWorkspaceRelPath(f);
          if (!cf) continue;
          const parts = cf.split('/');
          let cur = '';
          for (let i = 0; i < parts.length; i++) {
            cur = cur ? `${cur}/${parts[i]}` : parts[i];
            if (!isIgnored(cur)) set.add(cur);
          }
        }
      }
      for (const filePath of Object.keys(this.files || {})) {
        if (cleanIgnore && (filePath === cleanIgnore || filePath.startsWith(cleanIgnore + '/'))) continue;
        const idx = filePath.lastIndexOf('/');
        if (idx <= 0) continue;
        const parts = filePath.slice(0, idx).split('/');
        let cur = '';
        for (let i = 0; i < parts.length; i++) {
          cur = cur ? `${cur}/${parts[i]}` : parts[i];
          if (!isIgnored(cur)) set.add(cur);
        }
      }
      const hasGit = Boolean(
        (this.shell && this.shell.gitState && this.shell.gitState.initialized) ||
        (this.shell && this.shell.vfs && typeof this.shell.vfs.existsSync === 'function' && this.shell.vfs.existsSync('/workspace/.git'))
      );
      if (hasGit && !isIgnored('.git')) {
        set.add('.git');
      }
      return set;
    }

    _hasPathConflict(candidatePath, opts = {}) {
      const clean = this._normalizeWorkspaceRelPath(candidatePath);
      if (!clean) return 'invalid';
      const ignoreKind = opts && opts.ignoreKind === 'folder' ? 'folder' : 'file';
      const cleanIgnore = (opts && opts.ignorePath) ? (this._normalizeWorkspaceRelPath(opts.ignorePath) || '') : '';
      if (cleanIgnore && clean.startsWith(cleanIgnore + '/')) return 'self-subtree';
      const knownFolders = this._getAllKnownFolders(ignoreKind === 'folder' ? cleanIgnore : '');
      const filesObj = this.files || {};
      const isIgnoredFile = (fp) => {
        if (!cleanIgnore) return false;
        return ignoreKind === 'folder'
          ? (fp === cleanIgnore || fp.startsWith(cleanIgnore + '/'))
          : fp === cleanIgnore;
      };
      const segments = clean.split('/');
      if (segments.includes('.git') || segments.includes('node_modules')) {
        return 'reserved-name';
      }
      let ancestor = '';
      for (let i = 0; i < segments.length - 1; i++) {
        ancestor = ancestor ? `${ancestor}/${segments[i]}` : segments[i];
        if (filesObj[ancestor] !== undefined && !isIgnoredFile(ancestor)) {
          return 'ancestor-is-file';
        }
      }
      if (filesObj[clean] !== undefined && !isIgnoredFile(clean)) {
        return 'exists-file';
      }
      if (knownFolders.has(clean)) {
        return 'exists-folder';
      }
      const descPrefix = clean + '/';
      for (const fp of Object.keys(filesObj)) {
        if (!isIgnoredFile(fp) && fp.startsWith(descPrefix)) {
          return 'has-descendants';
        }
      }
      for (const fd of knownFolders) {
        if (fd.startsWith(descPrefix)) {
          return 'has-descendants';
        }
      }
      return null;
    }

    createFolder(folderPath) {
      const clean = this._normalizeWorkspaceRelPath(folderPath);
      if (!clean) return false;
      if (this._hasPathConflict(clean, { kind: 'folder' })) return false;
      this._userEditSeq = (this._userEditSeq || 0) + 1;
      const parts = clean.split('/');
      let cur = '';
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        this.folders.add(cur);
      }
      this._vfsEnsureFolder(clean);
      this._saveState({ flushSnapshotOnly: true });
      this._renderFileLists();
      return true;
    }

    toggleFolder(folderPath) {
      const clean = String(folderPath).trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return;
      if (this.collapsedFolders.has(clean)) {
        this.collapsedFolders.delete(clean);
      } else {
        this.collapsedFolders.add(clean);
      }
      this._saveState();
      this._renderFileLists();
    }

    moveFile(srcPath, dest, opts = {}) {
      const cleanSrc = this._normalizeWorkspaceRelPath(srcPath);
      if (!cleanSrc || this.files[cleanSrc] === undefined) return false;
      const baseName = cleanSrc.split('/').pop();
      const rawDest = String(dest ?? '').trim();
      const destExact = Boolean(opts && opts.destIsExactFilePath);
      let cleanDest = '';
      if (rawDest !== '' && rawDest !== '/') {
        const normalizedDest = this._normalizeWorkspaceRelPath(rawDest);
        if (!normalizedDest) return false;
        cleanDest = normalizedDest;
      } else if (destExact) {
        return false;
      }

      const knownFolders = this._getAllKnownFolders();
      const isDestFolder = destExact
        ? false
        : (cleanDest === '' || this.folders.has(cleanDest) || knownFolders.has(cleanDest) || (!cleanDest.split('/').pop().includes('.') && this.files[cleanDest] === undefined));
      const targetPath = isDestFolder
        ? (cleanDest ? `${cleanDest}/${baseName}` : baseName)
        : cleanDest;

      if (!targetPath || targetPath === cleanSrc) return false;
      if (this._hasPathConflict(targetPath, { kind: 'file', ignorePath: cleanSrc, ignoreKind: 'file' })) return false;

      this._userEditSeq = (this._userEditSeq || 0) + 1;
      const parts = targetPath.split('/');
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        this.folders.add(cur);
        this.collapsedFolders.delete(cur);
      }

      const content = this.files[cleanSrc];
      delete this.files[cleanSrc];
      this.files[targetPath] = content;

      const wasDirty = Boolean(this._dirtyFiles && this._dirtyFiles.has(cleanSrc));
      if (this._dirtyFiles) {
        this._dirtyFiles.delete(cleanSrc);
        if (wasDirty) this._dirtyFiles.add(targetPath);
      }
      if (this._savedSnapshot) {
        const hadSaved = Object.prototype.hasOwnProperty.call(this._savedSnapshot, cleanSrc);
        const savedVal = hadSaved ? this._savedSnapshot[cleanSrc] : content;
        delete this._savedSnapshot[cleanSrc];
        this._savedSnapshot[targetPath] = wasDirty ? savedVal : content;
      }

      this._vfsRenamePath(cleanSrc, targetPath, false);
      this._clearDiagnosticsForPath(cleanSrc, false);

      const oldModel = this.models.get(cleanSrc);
      if (oldModel) {
        oldModel.dispose();
        this.models.delete(cleanSrc);
      }
      this._getOrCreateModel(targetPath);

      if (Array.isArray(this.openTabs)) {
        const idx = this.openTabs.indexOf(cleanSrc);
        if (idx !== -1) {
          this.openTabs.splice(idx, 1, targetPath);
        }
      }

      if (this.activeFile === cleanSrc) {
        this.activeFile = targetPath;
        if (this.activeTab !== '__settings__') {
          this.activeTab = targetPath;
        }
      }

      this._lintFile(targetPath);
      if (cleanSrc.startsWith('.codelab/') || targetPath.startsWith('.codelab/')) {
        this._syncDotCodelabConfig({ isInitialMount: false });
      }
      this._saveState({ flushSnapshotOnly: true });
      this._syncActiveFileToView();
      return true;
    }

    renameFile(oldPath, newPath) {
      const ok = this.moveFile(oldPath, newPath, { destIsExactFilePath: true });
      if (ok) {
        this._emitEvent('codelab:file-rename', { labId: this.labId, oldPath, newPath });
      }
      return ok;
    }

    movePath(sourcePath, targetFolder = '') {
      const cleanSrc = this._normalizeWorkspaceRelPath(sourcePath);
      if (!cleanSrc) return false;
      const rawDest = String(targetFolder ?? '').trim();
      let cleanDest = '';
      if (rawDest !== '' && rawDest !== '/') {
        const normDest = this._normalizeWorkspaceRelPath(rawDest);
        if (!normDest) return false;
        cleanDest = normDest;
      }
      const allFolders = this._listWorkspaceFolders();
      if (allFolders.includes(cleanSrc)) {
        const baseName = cleanSrc.split('/').pop();
        const nextFolder = cleanDest ? `${cleanDest}/${baseName}` : baseName;
        if (nextFolder === cleanSrc || nextFolder.startsWith(cleanSrc + '/')) return false;
        return this.renameFolder(cleanSrc, nextFolder);
      }
      return this.moveFile(cleanSrc, cleanDest);
    }

    startInlineCreate(type = 'file', folderPrefix = '') {
      const kind = type === 'folder' ? 'folder' : 'file';
      const cleanFolder = folderPrefix ? (this._normalizeWorkspaceRelPath(folderPrefix) || '') : '';
      if (cleanFolder) {
        const parts = cleanFolder.split('/');
        let cur = '';
        for (const p of parts) {
          cur = cur ? `${cur}/${p}` : p;
          this.folders.add(cur);
          this.collapsedFolders.delete(cur);
        }
        if (this.explorerFolder && cleanFolder !== this.explorerFolder && !cleanFolder.startsWith(this.explorerFolder + '/')) {
          this.explorerFolder = '';
        }
      }
      this.renamingItem = null;
      this.isCreatingFile = false;
      this.creatingItem = {
        type: kind,
        parentFolder: cleanFolder || (this.explorerFolder || '')
      };
      this._renderFileLists();
    }

    startInlineRename(typeOrPath, maybeTargetOrIsFolder) {
      let kind = 'file';
      let rawTarget = '';
      if ((typeOrPath === 'file' || typeOrPath === 'folder') && typeof maybeTargetOrIsFolder === 'string') {
        kind = typeOrPath;
        rawTarget = maybeTargetOrIsFolder;
      } else {
        rawTarget = String(typeOrPath || '');
        const normalizedProbe = rawTarget.trim().replace(/^\/+|\/+$/g, '');
        if (typeof maybeTargetOrIsFolder === 'boolean') {
          kind = maybeTargetOrIsFolder ? 'folder' : 'file';
        } else if (this._listWorkspaceFolders().includes(normalizedProbe) && this.files[normalizedProbe] === undefined) {
          kind = 'folder';
        } else {
          kind = 'file';
        }
      }

      const cleanTarget = this._normalizeWorkspaceRelPath(rawTarget);
      if (!cleanTarget) return;
      if (kind === 'file' && this.files[cleanTarget] === undefined) return;
      if (kind === 'folder' && !this._listWorkspaceFolders().includes(cleanTarget)) return;

      const parts = cleanTarget.split('/');
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        this.collapsedFolders.delete(cur);
      }
      if (this.explorerFolder && cleanTarget !== this.explorerFolder && !cleanTarget.startsWith(this.explorerFolder + '/')) {
        this.explorerFolder = '';
      }

      this.creatingItem = null;
      this.isCreatingFile = false;
      this.renamingItem = { type: kind, targetPath: cleanTarget };
      this._renderFileLists();
    }

    promptNewFile(folderPrefix = '') {
      this.startInlineCreate('file', folderPrefix);
    }

    promptNewFolder(folderPrefix = '') {
      this.startInlineCreate('folder', folderPrefix);
    }

    renameFolder(oldFolder, newFolder) {
      const oldPrefix = this._normalizeWorkspaceRelPath(oldFolder);
      const newPrefix = this._normalizeWorkspaceRelPath(newFolder);
      if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) return false;
      if (oldPrefix === '.git' || oldPrefix.startsWith('.git/')) return false;
      if (newPrefix.startsWith(oldPrefix + '/')) return false;
      const knownFolders = this._getAllKnownFolders();
      if (!knownFolders.has(oldPrefix)) return false;
      if (this._hasPathConflict(newPrefix, { kind: 'folder', ignorePath: oldPrefix, ignoreKind: 'folder' })) return false;

      const fileRenames = [];
      for (const filePath of Object.keys(this.files)) {
        if (filePath.startsWith(oldPrefix + '/')) {
          const newFilePath = newPrefix + filePath.slice(oldPrefix.length);
          if (this.files[newFilePath] !== undefined) return false;
          fileRenames.push({ oldPath: filePath, newPath: newFilePath, content: this.files[filePath] });
        }
      }

      this._userEditSeq = (this._userEditSeq || 0) + 1;
      const updatedFolders = new Set();
      for (const f of this.folders) {
        if (f === oldPrefix) {
          updatedFolders.add(newPrefix);
        } else if (f.startsWith(oldPrefix + '/')) {
          updatedFolders.add(newPrefix + f.slice(oldPrefix.length));
        } else {
          updatedFolders.add(f);
        }
      }
      const parts = newPrefix.split('/');
      let cur = '';
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        updatedFolders.add(cur);
      }
      this.folders = updatedFolders;

      const updatedCollapsed = new Set();
      for (const cf of this.collapsedFolders) {
        if (cf === oldPrefix) {
          updatedCollapsed.add(newPrefix);
        } else if (cf.startsWith(oldPrefix + '/')) {
          updatedCollapsed.add(newPrefix + cf.slice(oldPrefix.length));
        } else {
          updatedCollapsed.add(cf);
        }
      }
      this.collapsedFolders = updatedCollapsed;

      for (const { oldPath, newPath, content } of fileRenames) {
        delete this.files[oldPath];
        this.files[newPath] = content;

        const wasDirty = Boolean(this._dirtyFiles && this._dirtyFiles.has(oldPath));
        if (this._dirtyFiles) {
          this._dirtyFiles.delete(oldPath);
          if (wasDirty) this._dirtyFiles.add(newPath);
        }
        if (this._savedSnapshot) {
          const hadSaved = Object.prototype.hasOwnProperty.call(this._savedSnapshot, oldPath);
          const savedVal = hadSaved ? this._savedSnapshot[oldPath] : content;
          delete this._savedSnapshot[oldPath];
          this._savedSnapshot[newPath] = wasDirty ? savedVal : content;
        }

        const oldModel = this.models.get(oldPath);
        if (oldModel) {
          oldModel.dispose();
          this.models.delete(oldPath);
        }
        this._getOrCreateModel(newPath);

        if (Array.isArray(this.openTabs)) {
          const idx = this.openTabs.indexOf(oldPath);
          if (idx !== -1) {
            this.openTabs.splice(idx, 1, newPath);
          }
        }

        if (this.activeFile === oldPath) {
          this.activeFile = newPath;
          if (this.activeTab !== '__settings__') {
            this.activeTab = newPath;
          }
        }
      }

      this._vfsRenamePath(oldPrefix, newPrefix, true);
      this._clearDiagnosticsForPath(oldPrefix, true);
      for (const { newPath } of fileRenames) {
        this._lintFile(newPath);
      }
      if (oldPrefix === '.codelab' || newPrefix === '.codelab' || oldPrefix.startsWith('.codelab/') || newPrefix.startsWith('.codelab/')) {
        this._syncDotCodelabConfig({ isInitialMount: false });
      }
      this._saveState({ flushSnapshotOnly: true });
      this._syncActiveFileToView();
      this._emitEvent('codelab:folder-rename', { labId: this.labId, oldFolder: oldPrefix, newFolder: newPrefix });
      return true;
    }

    _confirmDeletePath(kind, rawTarget) {
      const cleanTarget = this._normalizeWorkspaceRelPath(rawTarget);
      if (!cleanTarget) return Promise.resolve(false);
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) {
        const ok = kind === 'folder'
          ? this.deleteFolder(cleanTarget, { force: true })
          : this.deleteFile(cleanTarget, { force: true });
        return Promise.resolve(Boolean(ok));
      }
      this._captureModalReturnFocus();
      const isFolder = kind === 'folder';
      const childCount = isFolder
        ? Object.keys(this.files || {}).filter(f => f.startsWith(cleanTarget + '/')).length
        : 0;
      const titleText = isFolder ? `Delete Folder "${cleanTarget}"?` : `Delete "${cleanTarget}"?`;
      const descText = isFolder
        ? (childCount > 0
          ? `Are you sure you want to permanently delete "${cleanTarget}" and its ${childCount} nested file${childCount === 1 ? '' : 's'} from the workspace?`
          : `Are you sure you want to delete the folder "${cleanTarget}" from the workspace?`)
        : `Are you sure you want to permanently delete "${cleanTarget}" from the workspace?`;

      return new Promise((resolve) => {
        let settled = false;
        const finish = (confirmed) => {
          if (settled) return;
          settled = true;
          this._onModalClosedCallback = null;
          this.closeModal();
          if (confirmed) {
            if (isFolder) {
              this.deleteFolder(cleanTarget, { force: true });
            } else {
              this.deleteFile(cleanTarget, { force: true });
            }
          }
          resolve(Boolean(confirmed));
        };
        this._onModalClosedCallback = () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        };

        slot.innerHTML = `
          <div class="codelab-modal-backdrop" data-cl-backdrop="delete-confirm">
            <div class="codelab-modal codelab-confirm-modal" id="delete-confirm-modal" data-cl-modal="delete-confirm" role="dialog" aria-modal="true" aria-labelledby="cl-delete-modal-title" aria-describedby="cl-delete-modal-desc" style="max-width:440px;">
              <div class="codelab-modal__header">
                <h3 id="cl-delete-modal-title" class="codelab-modal__title">${escapeHtml(titleText)}</h3>
                <button type="button" class="codelab-modal__close" data-cl-action="close-modal" aria-label="Close dialog">×</button>
              </div>
              <div class="codelab-modal__body">
                <p id="cl-delete-modal-desc" class="codelab-confirm-modal__desc">${escapeHtml(descText)}</p>
                <div class="codelab-confirm-modal__actions">
                  <button type="button" class="codelab-btn" data-cl-action="cancel-delete" data-cl-confirm="cancel" autofocus>Cancel</button>
                  <button type="button" class="codelab-btn codelab-btn--danger" data-cl-action="confirm-delete" data-cl-confirm="delete">Delete</button>
                </div>
              </div>
            </div>
          </div>
        `;

        const backdrop = slot.querySelector('.codelab-modal-backdrop');
        let pointerStartedOnBackdrop = false;
        if (backdrop) {
          backdrop.addEventListener('pointerdown', (ev) => {
            pointerStartedOnBackdrop = ev.target === backdrop;
          });
          backdrop.addEventListener('click', (ev) => {
            if (ev.target === backdrop && pointerStartedOnBackdrop) {
              finish(false);
            }
            pointerStartedOnBackdrop = false;
          });
        }
        const cancelBtn = slot.querySelector('[data-cl-action="cancel-delete"]');
        const confirmBtn = slot.querySelector('[data-cl-action="confirm-delete"]');
        const closeBtn = slot.querySelector('[data-cl-action="close-modal"]');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => finish(false));
          if (typeof cancelBtn.focus === 'function') cancelBtn.focus();
        }
        if (closeBtn) {
          closeBtn.addEventListener('click', () => finish(false));
        }
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => finish(true));
        }
      });
    }

    deleteFolder(folderPath, opts = {}) {
      const clean = this._normalizeWorkspaceRelPath(folderPath);
      if (!clean) return false;
      if (clean === '.git' || clean.startsWith('.git/')) return false;
      if (opts && opts.confirm === true && !opts.force) {
        return this._confirmDeletePath('folder', clean);
      }
      const allFolders = this._listWorkspaceFolders();
      const knownFolders = this._getAllKnownFolders();
      const matchingFiles = Object.keys(this.files).filter(f => f.startsWith(clean + '/'));
      if (!knownFolders.has(clean) && !allFolders.includes(clean) && !this.folders.has(clean) && matchingFiles.length === 0) {
        return false;
      }
      this._userEditSeq = (this._userEditSeq || 0) + 1;

      for (const f of Array.from(this.folders)) {
        if (f === clean || f.startsWith(clean + '/')) {
          this.folders.delete(f);
        }
      }

      for (const cf of Array.from(this.collapsedFolders)) {
        if (cf === clean || cf.startsWith(clean + '/')) {
          this.collapsedFolders.delete(cf);
        }
      }

      for (const f of matchingFiles) {
        delete this.files[f];
        if (this._dirtyFiles) this._dirtyFiles.delete(f);
        if (this._savedSnapshot) delete this._savedSnapshot[f];
        const model = this.models.get(f);
        if (model) {
          model.dispose();
          this.models.delete(f);
        }
        if (Array.isArray(this.openTabs)) {
          const idx = this.openTabs.indexOf(f);
          if (idx !== -1) {
            this.openTabs.splice(idx, 1);
          }
        }
      }

      this._vfsDeleteFolder(clean);

      if (this.activeFile && this.activeFile.startsWith(clean + '/')) {
        this.activeFile = this.openTabs && this.openTabs.length > 0 ? this.openTabs[0] : null;
        if (this.activeTab !== '__settings__') {
          this.activeTab = this.activeFile;
        }
      }

      if (clean === '.codelab' || matchingFiles.some(f => f.startsWith('.codelab/'))) {
        this._syncDotCodelabConfig();
      }

      this._updateProblemsBadge();
      this._saveState({ flushSnapshotOnly: true });
      this._syncActiveFileToView();
      this._emitEvent('codelab:folder-delete', { labId: this.labId, folder: clean });
      return true;
    }

    createFile(rawName, initialContent = null) {
      const clean = this._resolveCreatedFilename(rawName);
      if (!clean) return null;
      if (this.files[clean] !== undefined) {
        this.openFile(clean);
        return clean;
      }
      if (this._hasPathConflict(clean, { kind: 'file' })) {
        return null;
      }
      this._userEditSeq = (this._userEditSeq || 0) + 1;
      const parts = clean.split('/');
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        this.folders.add(cur);
      }
      if (typeof initialContent === 'string') {
        this.files[clean] = initialContent;
      } else {
        this.files[clean] = clean.endsWith('.json')
          ? '{\n  "name": "' + this.labId + '",\n  "dependencies": {}\n}\n'
          : clean.endsWith('.py')
            ? `# ${clean}\n`
            : clean.endsWith('.md')
              ? `# ${clean}\n`
              : /\.(hpp|h)$/i.test(clean)
                ? `#pragma once\n#include <bits/stdc++.h>\n\n// ${clean}\n`
                : /\.(cpp|cc|cxx)$/i.test(clean)
                  ? `#include <bits/stdc++.h>\nusing namespace std;\n\n// ${clean}\nint main() {\n    return 0;\n}\n`
                  : `'use strict';\n\n// ${clean}\n`;
      }
      if (!this._savedSnapshot) this._savedSnapshot = {};
      this._savedSnapshot[clean] = this.files[clean];
      this._vfsWriteFile(clean, this.files[clean]);
      this._saveState({ flushSnapshotOnly: true });
      this._getOrCreateModel(clean);
      this._lintFile(clean);
      this._emitEvent('codelab:file-create', { labId: this.labId, filename: clean, content: this.files[clean] });
      this._notifyCodeChange(clean, this.files[clean]);
      this.openFile(clean);
      return clean;
    }

    duplicateFile(filename) {
      if (!filename || this.files[filename] === undefined) return null;
      const dotIdx = filename.lastIndexOf('.');
      const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
      const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
      let candidate = `${base}.copy${ext}`;
      let counter = 2;
      while (this._hasPathConflict(candidate, { kind: 'file' })) {
        candidate = `${base}.copy${counter}${ext}`;
        counter++;
      }
      this.createFile(candidate, this.files[filename]);
      return candidate;
    }

    closeTab(filename) {
      if (filename === '__settings__') {
        this.closeSettings();
        return;
      }
      if (!Array.isArray(this.openTabs) || !this.openTabs.includes(filename)) {
        return;
      }
      const idx = this.openTabs.indexOf(filename);
      this.openTabs.splice(idx, 1);

      if (this.activeFile === filename) {
        if (this.openTabs.length > 0) {
          const nextIdx = Math.min(idx, this.openTabs.length - 1);
          this.activeFile = this.openTabs[nextIdx];
        } else {
          this.activeFile = null;
        }
      }
      if (this.activeTab !== '__settings__') {
        this.activeTab = this.activeFile;
      }

      this._saveState();
      this._syncActiveFileToView();
    }

    closeOtherTabs(keepFilename) {
      if (keepFilename === '__settings__') {
        this.openTabs = [];
        this.activeFile = null;
        this.activeTab = '__settings__';
        this._saveState();
        this._syncActiveFileToView();
        return;
      }
      if (!Array.isArray(this.openTabs)) return;
      if (keepFilename && this.files[keepFilename] !== undefined) {
        this.openTabs = [keepFilename];
        this.activeFile = keepFilename;
        this.settingsTabOpen = false;
        this.activeTab = keepFilename;
        if (this._settingsDialog && typeof this._settingsDialog.unmountInline === 'function') {
          this._settingsDialog.unmountInline();
        }
      }
      this._saveState();
      this._syncActiveFileToView();
    }

    closeAllTabs() {
      this.openTabs = [];
      this.activeFile = null;
      this.settingsTabOpen = false;
      this.activeTab = null;
      if (this._settingsDialog && typeof this._settingsDialog.unmountInline === 'function') {
        this._settingsDialog.unmountInline();
      }
      this._saveState();
      this._syncActiveFileToView();
    }

    deleteFile(filename, opts = {}) {
      const clean = this._normalizeWorkspaceRelPath(filename);
      if (!clean || this.files[clean] === undefined) return false;
      if (opts && opts.confirm === true && !opts.force) {
        return this._confirmDeletePath('file', clean);
      }
      this._userEditSeq = (this._userEditSeq || 0) + 1;
      delete this.files[clean];
      if (this._dirtyFiles) this._dirtyFiles.delete(clean);
      if (this._savedSnapshot) delete this._savedSnapshot[clean];
      const model = this.models.get(clean);
      if (model) {
        model.dispose();
        this.models.delete(clean);
      }
      let tabIdx = -1;
      if (Array.isArray(this.openTabs)) {
        tabIdx = this.openTabs.indexOf(clean);
        if (tabIdx !== -1) {
          this.openTabs.splice(tabIdx, 1);
        }
      }
      this._vfsDeleteFile(clean);
      if (clean.startsWith('.codelab/')) {
        this._syncDotCodelabConfig();
      }
      this._updateProblemsBadge();
      if (this.activeFile === clean) {
        if (this.openTabs && this.openTabs.length > 0) {
          this.activeFile = this.openTabs[Math.max(0, Math.min(tabIdx, this.openTabs.length - 1))];
        } else {
          this.activeFile = null;
        }
      }
      if (this.activeTab !== '__settings__') {
        this.activeTab = this.activeFile;
      }
      this._saveState({ flushSnapshotOnly: true });
      this._emitEvent('codelab:file-delete', { labId: this.labId, filename: clean });
      this._syncActiveFileToView();
      return true;
    }

    toggleGuide() {
      const shell = this.container.querySelector('.codelab');
      const guide = this.container.querySelector('.codelab-guide');
      if (shell) shell.classList.toggle('guide-collapsed');
      if (guide) guide.classList.toggle('collapsed');
      const isCollapsed = guide ? guide.classList.contains('collapsed') : (shell ? shell.classList.contains('guide-collapsed') : false);

      const toggleBtn = this.container.querySelector('#cl-toggle-guide-btn');
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', !isCollapsed);
        toggleBtn.setAttribute('aria-pressed', String(!isCollapsed));
      }

      if (this.editor && typeof this.editor.layout === 'function') {
        this.editor.layout();
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
          });
        }
        setTimeout(() => {
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        }, 100);
      }
    }

    _renderDrawerBody() {
      const bodyEl = this.container.querySelector('#cl-drawer-body');
      const testPill = this.container.querySelector('#cl-test-pill');
      const vfsPill = this.container.querySelector('#cl-vfs-pill');
      const portsPill = this.container.querySelector('#cl-ports-pill');
      const networkPill = this.container.querySelector('#cl-network-pill');
      if (!bodyEl) return;

      // Update drawer tab active state
      this.container.querySelectorAll('[data-cl-drawertab]').forEach(btn => {
        const isActive = btn.dataset.clDrawertab === this.drawerTab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      // Update pills
      const problemsCountEl = this.container.querySelector('#cl-problems-count');
      if (problemsCountEl) {
        const count = this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function'
          ? this._diagnosticsStore.getAll().length
          : 0;
        problemsCountEl.textContent = String(count);
      }
      this._updateTelemetryHud();

      if (testPill) {
        if (!this.lastTestResults.length) {
          testPill.textContent = 'Ready';
          testPill.className = 'codelab-drawer__pill';
        } else {
          const passed = this.lastTestResults.filter(t => t.status === 'pass').length;
          const total = this.lastTestResults.length;
          testPill.textContent = `${passed}/${total} Passed`;
          testPill.className = `codelab-drawer__pill ${passed === total ? 'pass' : 'fail'}`;
        }
      }
      if (portsPill) {
        const portCount = (this.portTable && typeof this.portTable.listServers === 'function')
          ? this.portTable.listServers().length
          : 0;
        portsPill.textContent = `${portCount} open`;
      }
      if (networkPill) {
        const netCount = (this.lastHttpTrace || []).length;
        networkPill.textContent = `${netCount} reqs`;
      }
      if (vfsPill) {
        const diskCount = this.lastFsSnapshot.length;
        const httpCount = this.lastHttpTrace.length;
        vfsPill.textContent = httpCount > 0 ? `${diskCount} files · ${httpCount} reqs` : `${diskCount} files`;
      }

      if (this.drawerTab === 'problems') {
        this._renderProblemsPanel(bodyEl);
        return;
      }

      if (this.drawerTab === 'stdin') {
        bodyEl.innerHTML = `
          <div class="codelab-stdin-panel" style="padding:10px;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;color:var(--cl-fg-muted);">
              <span>Standard Input (std::cin / sys.stdin / process.stdin)</span>
              <button type="button" class="codelab-btn codelab-btn--sm" id="cl-stdin-clear-btn" style="padding:2px 8px;font-size:11px;">Clear</button>
            </div>
            <textarea id="cl-stdin-textarea" class="codelab-stdin-textarea" style="flex:1;width:100%;background:var(--cl-bg-input, #1e1e1e);color:var(--cl-fg, #d4d4d4);border:1px solid var(--cl-border, #333);border-radius:4px;padding:8px;font-family:var(--cl-font-mono, monospace);font-size:12px;resize:none;outline:none;box-sizing:border-box;" placeholder="Enter or paste custom stdin here (used by std::cin, sys.stdin, fs.readFileSync(0))...">${escapeHtml(this.customStdin || '')}</textarea>
          </div>
        `;
        const ta = bodyEl.querySelector('#cl-stdin-textarea');
        if (ta) {
          ta.addEventListener('input', () => {
            this.customStdin = ta.value;
          });
        }
        const clearBtn = bodyEl.querySelector('#cl-stdin-clear-btn');
        if (clearBtn && ta) {
          clearBtn.addEventListener('click', () => {
            this.customStdin = '';
            ta.value = '';
          });
        }
        return;
      }

      if (this.drawerTab === 'tests') {
        if (!this.lastTestResults.length) {
          bodyEl.innerHTML = `
            <div style="color:var(--cl-fg-muted);padding:12px 4px;">
              Click <strong>Run Tests</strong> (<kbd>⌘+Enter</kbd>) or <strong>Verify Step</strong> to execute the unit test suite in the Virtual Node Worker.
            </div>
          `;
          return;
        }
        const passed = this.lastTestResults.filter(t => t.status === 'pass').length;
        const total = this.lastTestResults.length;
        const totalMs = this.lastTestResults.reduce((acc, r) => acc + (r.durationMs || 0), 0).toFixed(1);

        bodyEl.innerHTML = `
          <div class="codelab-test-summary ${passed === total ? 'all-pass' : 'has-fail'}">
            <div>
              <strong>${passed === total ? `All ${total} Tests Passing` : `${passed} of ${total} Tests Passing`}</strong>
              ${this.steps.length ? `<span style="margin-left:8px;font-size:12px;opacity:0.8;">(${this.completedSteps.size}/${this.steps.length} Guided Steps Complete)</span>` : ''}
            </div>
            <span style="font-family:var(--cl-font-mono);font-size:12px;">${totalMs} ms</span>
          </div>
          <div class="codelab-test-list">
            ${this.lastTestResults.map(t => `
              <div class="codelab-test-row ${t.status}">
                <div class="codelab-test-row__head">
                  <div class="codelab-test-row__name">
                    <span style="color:${t.status === 'pass' ? 'var(--cl-green)' : 'var(--cl-red)'};font-weight:700;">
                      ${t.status === 'pass' ? '✓ PASS' : '✖ FAIL'}
                    </span>
                    <span>${escapeHtml(t.name)}</span>
                  </div>
                  <span class="codelab-test-row__time">${(t.durationMs || 0).toFixed(2)} ms</span>
                </div>
                ${t.error ? formatTestErrorHtml(t.error) : ''}
              </div>
            `).join('')}
          </div>
        `;
        return;
      }

      if (this.drawerTab === 'output') {
        this._trimTerminalLogs();
        const outEntries = (Array.isArray(this.outputLogs) && this.outputLogs.length > 0)
          ? this.outputLogs
          : this.terminalLogs.filter(item => item && (item.type === 'stdout' || item.type === 'stderr' || item.type === 'system'));
        const termFontPx = this.configuration
          ? Math.max(10, Math.min(28, Number(this.configuration.get('terminal.fontSize', 13)) || 13))
          : 13;
        const linesHtml = outEntries.length > 0
          ? outEntries.map(item => {
              const html = ansiToHtml ? ansiToHtml(item.text || '') : escapeHtml(item.text || '');
              return `<div class="codelab-log-line ${escapeHtml(item.type || '')}">${html}</div>`;
            }).join('')
          : `<div style="color:var(--cl-fg-muted);font-size:12px;">No output messages yet. Run your code or workspace tasks to inspect output logs.</div>`;
        bodyEl.innerHTML = `<div class="codelab-output-panel" id="cl-output-surface" style="font-size:${termFontPx}px;line-height:1.5;">${linesHtml}</div>`;
        bodyEl.scrollTop = bodyEl.scrollHeight;
        return;
      }

      if (this.drawerTab === 'terminal') {
        this._trimTerminalLogs();
        this._renderTerminalSessionsBar();
        const termFontPx = this.configuration
          ? Math.max(10, Math.min(28, Number(this.configuration.get('terminal.fontSize', 13)) || 13))
          : 13;
        const logsHtml = this.terminalLogs
          .map(item => {
            const html = ansiToHtml ? ansiToHtml(item.text || '') : escapeHtml(item.text || '');
            return `<div class="codelab-log-line ${escapeHtml(item.type || '')}">${html}</div>`;
          })
          .join('');
        const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
        const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;
        const busyAttr = this.isRunning ? ' data-busy="true" style="display:none;"' : '';
        const promptHtml = this.isRunning ? '' : `${escapeHtml(promptLabel)} `;
        const beforeHtml = this.isRunning ? '' : escapeHtml(this._ptyInputBeforeCursor || '');
        const afterHtml = this.isRunning ? '' : escapeHtml(this._ptyInputAfterCursor || '');
        const cursorClass = this.isRunning ? 'codelab-pty__cursor' : 'codelab-pty__cursor blink';
        const cursorCharHtml = this.isRunning ? '' : '&#x2588;';
        bodyEl.innerHTML = `<div class="codelab-terminal" id="cl-terminal-surface" tabindex="0" style="font-size:${termFontPx}px;"><div class="codelab-terminal__log" id="cl-terminal-log">${logsHtml}</div><div class="codelab-pty__active-line" id="cl-pty-active-line"${busyAttr} style="font-size:${termFontPx}px;"><span class="codelab-pty__prompt">${promptHtml}</span><span class="codelab-pty__before">${beforeHtml}</span><span class="${cursorClass}">${cursorCharHtml}</span><span class="codelab-pty__after">${afterHtml}</span></div><form class="codelab-repl" id="cl-repl-form" style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;"><span class="codelab-repl__prompt">${escapeHtml(promptLabel)}</span><input type="text" class="codelab-repl__input" id="cl-repl-input" placeholder="ls, pwd, cat file.js, node demo.js, node test.js, or JS/TS expression…" autocomplete="off" spellcheck="false" aria-label="REPL command input"></form></div>`;
        bodyEl.scrollTop = bodyEl.scrollHeight;
        const termSurface = bodyEl.querySelector('#cl-terminal-surface');
        const input = bodyEl.querySelector('#cl-repl-input');
        if (termSurface && input) {
          termSurface.addEventListener('click', e => {
            if (e.target === input) return;
            const sel = typeof window !== 'undefined' && window.getSelection ? String(window.getSelection()) : '';
            if (!sel && typeof input.focus === 'function') input.focus();
          });
        }
        if (input) {
          input.value = this.isRunning ? '' : ((this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || ''));
          const syncCaretFromInput = () => {
            if (this.isRunning) {
              input.value = '';
              return;
            }
            const val = input.value || '';
            const pos = (input.selectionStart !== undefined && input.selectionStart !== null) ? input.selectionStart : val.length;
            this._ptyInputBeforeCursor = val.slice(0, pos);
            this._ptyInputAfterCursor = val.slice(pos);
            this._updatePtyActiveLine();
          };
          input.addEventListener('input', syncCaretFromInput);
          input.addEventListener('click', syncCaretFromInput);
          input.addEventListener('keyup', e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
              syncCaretFromInput();
            }
          });
          input.addEventListener('keydown', e => {
            if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c') {
              e.preventDefault();
              this._handleInterrupt();
              return;
            }
            if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'l') {
              e.preventDefault();
              this._clearTerminalLogs();
              this._renderDrawerBody();
              const nextInput = this.container.querySelector('#cl-repl-input');
              if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
              return;
            }
            if (this.isRunning) {
              e.preventDefault();
              return;
            }
            if (e.key === 'Tab') {
              e.preventDefault();
              this._handlePtyTabCompletion(input);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!this.replHistory.length) return;
              if (this.replHistoryIdx < 0) this.replHistoryIdx = this.replHistory.length - 1;
              else if (this.replHistoryIdx > 0) this.replHistoryIdx--;
              const histVal = this.replHistory[this.replHistoryIdx] || '';
              input.value = histVal;
              this._ptyInputBeforeCursor = histVal;
              this._ptyInputAfterCursor = '';
              this._updatePtyActiveLine();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!this.replHistory.length || this.replHistoryIdx < 0) return;
              if (this.replHistoryIdx < this.replHistory.length - 1) {
                this.replHistoryIdx++;
                const histVal = this.replHistory[this.replHistoryIdx] || '';
                input.value = histVal;
                this._ptyInputBeforeCursor = histVal;
                this._ptyInputAfterCursor = '';
                this._updatePtyActiveLine();
              } else {
                this.replHistoryIdx = -1;
                input.value = '';
                this._ptyInputBeforeCursor = '';
                this._ptyInputAfterCursor = '';
                this._updatePtyActiveLine();
              }
            } else if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
              e.preventDefault();
              if (this.inRepl) {
                this.inRepl = false;
                this._pushTerminalLog({ type: 'stdout', text: 'Exiting REPL...' });
                this._renderDrawerBody();
                const nextInput = this.container.querySelector('#cl-repl-input');
                if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
              }
            } else if (e.ctrlKey && e.key.toLowerCase() === 'u') {
              e.preventDefault();
              this._ptyInputBeforeCursor = '';
              input.value = this._ptyInputAfterCursor || '';
              this._updatePtyActiveLine();
            } else if (e.ctrlKey && e.key.toLowerCase() === 'k') {
              e.preventDefault();
              this._ptyInputAfterCursor = '';
              input.value = this._ptyInputBeforeCursor || '';
              this._updatePtyActiveLine();
            } else if (e.ctrlKey && e.key.toLowerCase() === 'a') {
              e.preventDefault();
              this._ptyInputAfterCursor = (this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || '');
              this._ptyInputBeforeCursor = '';
              if (input && typeof input.setSelectionRange === 'function') input.setSelectionRange(0, 0);
              this._updatePtyActiveLine();
            } else if (e.ctrlKey && e.key.toLowerCase() === 'e') {
              e.preventDefault();
              this._ptyInputBeforeCursor = (this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || '');
              this._ptyInputAfterCursor = '';
              const len = this._ptyInputBeforeCursor.length;
              if (input && typeof input.setSelectionRange === 'function') input.setSelectionRange(len, len);
              this._updatePtyActiveLine();
            }
          });
        }
        const replForm = bodyEl.querySelector('#cl-repl-form');
        if (replForm) {
          replForm.addEventListener('submit', e => {
            e.preventDefault();
            if (this.isRunning) return;
            const rawCmd = (input && input.value !== undefined ? input.value : '') ||
              ((this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || ''));
            const cmd = rawCmd.trim();
            if (!cmd) return;
            if (input) input.value = '';
            this._ptyInputBeforeCursor = '';
            this._ptyInputAfterCursor = '';
            this._updatePtyActiveLine();
            this._handleReplCommand(cmd).then(() => {
              const nextInput = this.container.querySelector('#cl-repl-input');
              if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
            });
          });
        }
        return;
      }

      if (this.drawerTab === 'ports') {
        this._renderPortsPanel(bodyEl);
        return;
      }

      if (this.drawerTab === 'preview') {
        bodyEl.scrollTop = 0;
        this._renderWebPreview(bodyEl);
        return;
      }

      if (this.drawerTab === 'network') {
        this._renderNetworkPanel(bodyEl);
        return;
      }

      if (this.drawerTab === 'inspector') {
        const tmpFiles = this.lastFsSnapshot.filter(f => !f.isDirectory);
        bodyEl.innerHTML = `
          <div class="codelab-inspector-grid">
            <div class="codelab-inspector-card">
              <div class="codelab-inspector-card__title">
                <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.database}<span>Virtual POSIX File System (${tmpFiles.length} files)</span></span>
                <span>In-Memory VFS</span>
              </div>
              ${tmpFiles.length === 0 ? `<div style="color:var(--cl-fg-muted);font-size:12px;">Run Demo or Tests to inspect virtual files (e.g. /tmp WAL segments &amp; SSTables).</div>` : ''}
              ${tmpFiles.map(f => `
                <div class="codelab-vfs-item">
                  <div class="codelab-vfs-item__head">
                    <span>${escapeHtml(f.path)}</span>
                    <span>${f.size} bytes</span>
                  </div>
                  ${f.hexPreview ? `<div class="codelab-vfs-item__hex">HEX: ${escapeHtml(f.hexPreview)}</div>` : ''}
                  ${f.preview ? `<div class="codelab-vfs-item__hex">TXT: ${escapeHtml(f.preview.slice(0, 120).replace(/\n/g, '↵'))}</div>` : ''}
                </div>
              `).join('')}
            </div>

            <div class="codelab-inspector-card">
              <div class="codelab-inspector-card__title">
                <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.globe}<span>Virtual Loopback HTTP Trace (${this.lastHttpTrace.length} requests)</span></span>
                <span>127.0.0.1</span>
              </div>
              ${this.lastHttpTrace.length === 0 ? `<div style="color:var(--cl-fg-muted);font-size:12px;">Virtual HTTP loopback requests (e.g., Layer-7 Load Balancer traffic &amp; active health probes) appear here.</div>` : ''}
              ${this.lastHttpTrace.map(req => `
                <div class="codelab-vfs-item">
                  <div class="codelab-vfs-item__head">
                    <span>${escapeHtml(req.method || 'GET')} 127.0.0.1:${escapeHtml(req.port)}${escapeHtml(req.url || '/')}</span>
                    <span style="color:${req.status >= 200 && req.status < 400 ? 'var(--cl-green)' : 'var(--cl-red)'}">
                      HTTP ${escapeHtml(req.status || 'ERR')} · ${(req.durationMs || 0).toFixed(1)}ms
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        return;
      }

      if (this.drawerTab === 'sql-results') {
        const res = this.lastSqlResult;
        if (!res) {
          bodyEl.innerHTML = `
            <div style="color:var(--cl-fg-muted);padding:16px;">
              Press <strong>⌘+Enter</strong> or click <strong>${this.hasGuidedLab && this.mode === 'guided' ? 'Verify Step' : 'Run SQL'}</strong> to execute the SQL query (${this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18'}).
            </div>
          `;
          return;
        }
        const verificationHtml = res.verification
          ? `<div class="codelab-test-summary ${res.verification.passed ? 'all-pass' : 'has-fail'}" style="margin-bottom:10px;">
               <div>
                 <strong>${res.verification.passed ? '✓ Step Verification Passed' : '✖ Step Verification Failed'}</strong>
                 ${res.verification.message ? `<span style="margin-left:8px;font-size:12px;">${escapeHtml(res.verification.message)}</span>` : ''}
               </div>
               <span style="font-family:var(--cl-font-mono);font-size:12px;">${typeof res.durationMs === 'number' ? `${res.durationMs.toFixed(1)} ms` : ''}</span>
             </div>`
          : '';
        const errHtml = res.error
          ? `<div role="alert" style="padding:10px 12px;margin-bottom:10px;border-radius:6px;border:1px solid rgba(239,68,68,0.45);background:rgba(239,68,68,0.12);color:var(--cl-red,#f87171);font-family:var(--cl-font-mono);font-size:12px;white-space:pre-wrap;">${escapeHtml(typeof res.error === 'string' ? res.error : (res.error.message || String(res.error)))}</div>`
          : '';
        const cols = Array.isArray(res.columns) ? res.columns : [];
        const rows = Array.isArray(res.rows) ? res.rows : [];
        const captionId = `cl-sql-cap-${escapeHtml(this.instanceId)}`;
        const rowSummary = `${rows.length} row${rows.length === 1 ? '' : 's'}${typeof res.durationMs === 'number' ? ` · ${res.durationMs.toFixed(1)} ms` : ''}`;
        const tableHtml = cols.length > 0
          ? `<div tabindex="0" role="region" aria-labelledby="${captionId}" class="cl-sql-results-wrapper">
               <table class="cl-sql-results-table">
                 <caption id="${captionId}" class="cl-sql-results-caption">Query Result (${escapeHtml(rowSummary)})</caption>
                 <thead>
                   <tr>
                     ${cols.map(c => `<th scope="col">${escapeHtml(String(c))}</th>`).join('')}
                   </tr>
                 </thead>
                 <tbody>
                   ${rows.length === 0
                     ? `<tr><td colspan="${cols.length}" style="color:var(--cl-fg-muted);font-style:italic;">0 rows returned</td></tr>`
                     : rows.map(row => {
                         const cells = Array.isArray(row)
                           ? cols.map((_, idx) => row[idx])
                           : cols.map(c => (row && typeof row === 'object' ? row[c] : undefined));
                         return `<tr>${cells.map((val, idx) => {
                           const colLabel = String(cols[idx] ?? '').replace(/['"\\]/g, '');
                           const display = val === null || val === undefined
                             ? '<span style="opacity:0.5;font-style:italic;">NULL</span>'
                             : escapeHtml(typeof val === 'object' ? JSON.stringify(val) : String(val));
                           return `<td style="--col-label: '${escapeHtml(colLabel)}'">${display}</td>`;
                         }).join('')}</tr>`;
                       }).join('')}
                 </tbody>
               </table>
             </div>`
          : (!res.error
              ? `<div style="color:var(--cl-fg-muted);font-size:12px;padding:8px 2px;">Statement executed (${escapeHtml(rowSummary)}).</div>`
              : '');
        const planHtml = res.plan
          ? `<div style="margin-top:10px;">
               <div style="font-size:11px;font-weight:600;color:var(--cl-fg-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Query Execution Plan</div>
               <pre style="margin:0;padding:10px;border-radius:6px;border:1px solid var(--cl-border,#262626);background:var(--cl-bg,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-family:var(--cl-font-mono);font-size:11.5px;overflow:auto;">${escapeHtml(typeof res.plan === 'string' ? res.plan : JSON.stringify(res.plan, null, 2))}</pre>
             </div>`
          : '';
        bodyEl.innerHTML = `<div style="padding:10px;">${verificationHtml}${errHtml}${tableHtml}${planHtml}</div>`;
        return;
      }

      if (this.drawerTab === 'observability') {
        const mod = getModular();
        if (this.kernel && mod && typeof mod.renderObservabilityPanelHtml === 'function') {
          bodyEl.innerHTML = mod.renderObservabilityPanelHtml({
            container: this.kernel.container,
            configuration: this.configuration,
            plugins: this.plugins,
            logger: this.kernel.logger,
            recentEvents: this.kernel.getRecentEvents(),
            workerStatus: this.runtimeStatusText || 'Idle'
          });
        } else {
          bodyEl.innerHTML = `<div style="padding:14px;color:var(--cl-fg-muted);font-size:12px;">Observability kernel is not initialized.</div>`;
        }
        return;
      }

      if (this.plugins && this.plugins.panels && typeof this.plugins.panels.get === 'function') {
        const contributedPanel = this.plugins.panels.get(this.drawerTab);
        if (contributedPanel && typeof contributedPanel.render === 'function') {
          while (this._pluginPanelDisposables && this._pluginPanelDisposables.length > 0) {
            const d = this._pluginPanelDisposables.pop();
            if (d && typeof d.dispose === 'function') {
              try { d.dispose(); } catch (err) { this.logger.debug('Plugin panel dispose skipped.', err); }
            }
          }
          bodyEl.innerHTML = '';
          try {
            const disp = contributedPanel.render(bodyEl);
            if (disp && typeof disp.dispose === 'function') {
              this._pluginPanelDisposables.push(disp);
            }
          } catch (err) {
            this.logger.error(`Plugin panel "${this.drawerTab}" render threw.`, err);
            bodyEl.innerHTML = `<div role="alert" style="padding:12px;color:var(--cl-red);">Failed to render plugin panel: ${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
          }
          return;
        }
      }
    }

    _appendTerminalStream(type = 'stdout', chunk = '') {
      if (chunk === null || chunk === undefined || chunk === '') return;
      const rawText = String(chunk);

      if (this.ptyEngine && this.ptyEngine.container && typeof this.ptyEngine.writeStreamChunk === 'function') {
        try {
          this.ptyEngine.writeStreamChunk(rawText, type);
        } catch (err) {
          this.logger.debug('ptyEngine.writeStreamChunk failed.', err);
        }
      }

      this._activeStreamType = type;
      const termLogEl = this.container ? this.container.querySelector('#cl-terminal-log') : null;
      const termSurface = this.container ? this.container.querySelector('#cl-terminal-surface') : null;
      const drawerBody = this.container ? this.container.querySelector('.codelab-drawer__body') : null;

      // The workbench owns live terminal rendering. Only defer when an attached PTY
      // engine is itself rendering into the DOM (it is created with a null container in
      // production, so this remains the sole renderer there).
      const ptyOwnsDom = Boolean(this.ptyEngine && this.ptyEngine.container);
      const canPatchDom = Boolean(termLogEl && typeof document !== 'undefined' && !ptyOwnsDom);

      // Write a single logical line into the live terminal DOM immediately, so output
      // streams in as it is produced instead of appearing only when the command ends and
      // the whole drawer is re-rendered. Reuses the current partial-line element when it
      // is still attached (carriage-return overwrites / keep-alive updates).
      const patchLineInDom = (text) => {
        if (!canPatchDom) return;
        const html = ansiToHtml ? ansiToHtml(text) : escapeHtml(text);
        if (this._activeStreamEl && this._activeStreamEl.parentNode === termLogEl) {
          this._activeStreamEl.className = 'codelab-log-line ' + escapeHtml(this._activeStreamType || type);
          this._activeStreamEl.innerHTML = html;
        } else {
          const newEl = document.createElement('div');
          newEl.className = 'codelab-log-line ' + escapeHtml(this._activeStreamType || type);
          newEl.innerHTML = html;
          termLogEl.appendChild(newEl);
          this._activeStreamEl = newEl;
        }
      };

      // A newline completes the current line: commit it to the log + DOM, then begin a fresh line.
      const maxScrollback = this._getTerminalScrollback();
      const commitActiveLine = () => {
        const entry = { type: this._activeStreamType || type, text: this._activeStreamLine };
        this._pushTerminalLog(entry);
        if (Array.isArray(this.outputLogs)) {
          this.outputLogs.push(entry);
          if (this.outputLogs.length > maxScrollback) {
            this.outputLogs.splice(0, this.outputLogs.length - maxScrollback);
          }
        }
        if (this.terminalLogs.length > maxScrollback) {
          this.terminalLogs.splice(0, this.terminalLogs.length - maxScrollback);
          if (canPatchDom && termLogEl) {
            while (termLogEl.childElementCount > maxScrollback && termLogEl.firstElementChild) {
              termLogEl.removeChild(termLogEl.firstElementChild);
            }
          }
        }
        patchLineInDom(this._activeStreamLine);
        this._activeStreamLine = '';
        this._activeStreamEl = null;
      };

      let i = 0;
      while (i < rawText.length) {
        if (rawText.startsWith('\x1b[2K', i)) {
          this._activeStreamLine = '';
          if (this._activeStreamEl) {
            this._activeStreamEl.textContent = '';
          }
          i += 4;
          continue;
        }
        if (rawText.startsWith('\x1b[0K', i)) {
          i += 4;
          continue;
        }
        if (rawText.startsWith('\x1b[K', i)) {
          i += 3;
          continue;
        }
        if (rawText.startsWith('\x1b[1A', i)) {
          if (this._activeStreamLine === '' && this.terminalLogs.length > 0) {
            const last = this.terminalLogs.pop();
            this._activeStreamLine = last.text || '';
            this._activeStreamType = last.type || 'stdout';
            if (termLogEl && termLogEl.lastElementChild) {
              this._activeStreamEl = termLogEl.lastElementChild;
            }
          }
          i += 4;
          continue;
        }

        const ch = rawText[i];
        if (ch === '\r') {
          if (i + 1 < rawText.length && rawText[i + 1] === '\n') {
            commitActiveLine();
            i += 2;
            continue;
          } else {
            // Bare carriage return: flush the current text into the active line, then
            // keep overwriting that same DOM node (no extra line is appended).
            const rendered = this._activeStreamLine;
            if (rendered || this._activeStreamEl) {
              patchLineInDom(rendered);
            }
            this._activeStreamLine = '';
            i++;
            continue;
          }
        } else if (ch === '\n') {
          commitActiveLine();
          i++;
          continue;
        } else {
          this._activeStreamLine += ch;
          i++;
        }
      }

      // Render the still-open partial line so incremental progress stays visible.
      if (this._activeStreamLine) {
        patchLineInDom(this._activeStreamLine);
      }

      if (termSurface) {
        termSurface.scrollTop = termSurface.scrollHeight;
      }
      if (drawerBody && this.drawerTab === 'terminal') {
        drawerBody.scrollTop = drawerBody.scrollHeight;
      }
    }

    _getTerminalScrollback() {
      if (!this.configuration) return 1000;
      const val = Number(this.configuration.get('terminal.scrollback', 1000));
      if (Number.isNaN(val)) return 1000;
      return Math.max(100, Math.min(50000, Math.floor(val)));
    }

    _trimTerminalLogs() {
      const maxSb = this._getTerminalScrollback();
      let trimmed = false;
      if (Array.isArray(this.terminalLogs) && this.terminalLogs.length > maxSb) {
        this.terminalLogs.splice(0, this.terminalLogs.length - maxSb);
        trimmed = true;
      }
      if (Array.isArray(this._terminalSessions)) {
        for (const s of this._terminalSessions) {
          if (s && Array.isArray(s.logs) && s.logs !== this.terminalLogs && s.logs.length > maxSb) {
            s.logs.splice(0, s.logs.length - maxSb);
          }
        }
      }
      if (Array.isArray(this.outputLogs) && this.outputLogs.length > maxSb) {
        this.outputLogs.splice(0, this.outputLogs.length - maxSb);
        trimmed = true;
      }
      return trimmed;
    }

    _pushTerminalLog(entry) {
      if (!entry) return;
      if (Array.isArray(this.terminalLogs)) {
        Array.prototype.push.call(this.terminalLogs, entry);
      }
      this._trimTerminalLogs();
    }

    _log(type = 'stdout', text = '') {
      this._pushTerminalLog({ type, text: String(text ?? '') });
      if (this.drawerTab === 'terminal' || this.drawerTab === 'output') {
        this._renderDrawerBody();
      }
    }

    _flushTerminalStream() {
      if (this._activeStreamLine) {
        const entry = {
          type: this._activeStreamType || 'stdout',
          text: this._activeStreamLine
        };
        this._pushTerminalLog(entry);
        const maxScrollback = this._getTerminalScrollback();
        if (this.terminalLogs.length > maxScrollback) {
          this.terminalLogs.splice(0, this.terminalLogs.length - maxScrollback);
        }
        if (Array.isArray(this.outputLogs)) {
          this.outputLogs.push(entry);
          if (this.outputLogs.length > maxScrollback) {
            this.outputLogs.splice(0, this.outputLogs.length - maxScrollback);
          }
        }
        this._activeStreamLine = '';
        this._activeStreamEl = null;
      }
    }

    _updateTelemetryHud() {
      const hud = this.container ? this.container.querySelector('#cl-telemetry-hud') : null;
      if (!hud) return;
      if (this.lastDurationMs === null && this.lastPeakMemoryBytes === null) {
        hud.style.display = 'none';
        return;
      }
      hud.style.display = 'inline-flex';
      let timeStr = '';
      if (this.lastDurationMs !== null) {
        timeStr = this.lastDurationMs < 1000
          ? `${this.lastDurationMs.toFixed(1)} ms`
          : `${(this.lastDurationMs / 1000).toFixed(2)} s`;
      }
      let memStr = '';
      if (this.lastPeakMemoryBytes !== null && this.lastPeakMemoryBytes > 0) {
        const mb = this.lastPeakMemoryBytes / (1024 * 1024);
        const suffix = this.lang === 'cpp' ? 'Wasm' : this.lang === 'py' ? 'Heap' : 'Mem';
        memStr = `${mb < 0.1 ? (this.lastPeakMemoryBytes / 1024).toFixed(1) + ' KB' : mb.toFixed(1) + ' MB'} ${suffix}`;
      }
      hud.innerHTML = `
        ${timeStr ? `<span class="codelab-hud-pill__metric">${CL_ICONS.clock} <span>${timeStr}</span></span>` : ''}
        ${timeStr && memStr ? `<span style="opacity:0.4;">·</span>` : ''}
        ${memStr ? `<span class="codelab-hud-pill__metric">${CL_ICONS.memory} <span>${memStr}</span></span>` : ''}
      `;
    }

    _handleInterrupt() {
      if (this._cloneInFlight || this._activeCloneAbortController) {
        this.cancelClone();
      }
      const isCommandRunning = Boolean(this.isRunning || this._activeCommandAbortController);
      const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
      const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;

      if (isCommandRunning) {
        if (this._activeCommandAbortController) {
          try {
            this._activeCommandAbortController.abort('SIGINT');
          } catch (err) {
            this.logger.debug('AbortController.abort failed.', err);
          }
          this._activeCommandAbortController = null;
        }

        if (typeof root.CodeLabRuntime?.cancelWorkerExecution === 'function') {
          try {
            root.CodeLabRuntime.cancelWorkerExecution('SIGINT: Interrupted by user (Ctrl+C)', this.instanceId);
          } catch (err) {
            this.logger.debug('cancelWorkerExecution failed.', err);
          }
        }

        this.isRunning = false;
        this._setRuntimeStatus('idle', 'Ready · Node v22 VFS');
        this._updateRunStateUI();

        this._flushTerminalStream();
        this._pushTerminalLog({ type: 'stdout', text: '^C' });
      } else {
        if (this.inRepl) {
          this.inRepl = false;
          this._pushTerminalLog({ type: 'stdout', text: '^C\nExiting REPL...' });
        } else {
          const currentInput = (this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || '');
          this._pushTerminalLog({ type: 'stdout', text: `${promptLabel} ${currentInput}^C` });
        }
      }

      this._ptyInputBeforeCursor = '';
      this._ptyInputAfterCursor = '';
      this.replHistoryIdx = -1;

      this._renderDrawerBody();
      const nextInput = this.container?.querySelector?.('#cl-repl-input');
      if (nextInput && typeof nextInput.focus === 'function') {
        nextInput.value = '';
        nextInput.focus();
      }
    }

    _updatePtyActiveLine() {
      if (!this.container) return;
      const activeLine = this.container.querySelector('#cl-pty-active-line');
      const beforeEl = this.container.querySelector('.codelab-pty__before');
      const afterEl = this.container.querySelector('.codelab-pty__after');
      const promptEl = this.container.querySelector('.codelab-pty__prompt');
      const cursorEl = this.container.querySelector('.codelab-pty__cursor');
      const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
      const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;

      if (this.isRunning) {
        if (activeLine) {
          activeLine.setAttribute('data-busy', 'true');
          if (activeLine.style) activeLine.style.display = 'none';
        }
        if (promptEl) promptEl.textContent = '';
        if (beforeEl) beforeEl.textContent = '';
        if (cursorEl) {
          cursorEl.textContent = '';
          if (cursorEl.classList) cursorEl.classList.remove('blink');
        }
        if (afterEl) afterEl.textContent = '';
      } else {
        if (activeLine) {
          activeLine.removeAttribute('data-busy');
          if (activeLine.style) activeLine.style.display = '';
        }
        if (promptEl) promptEl.textContent = promptLabel + ' ';
        if (beforeEl) beforeEl.textContent = this._ptyInputBeforeCursor || '';
        if (cursorEl) {
          if (!cursorEl.textContent) cursorEl.textContent = '\u2588';
          if (cursorEl.classList) cursorEl.classList.add('blink');
        }
        if (afterEl) afterEl.textContent = this._ptyInputAfterCursor || '';
      }
    }

    _handlePtyTabCompletion(input) {
      const currentInput = (input && input.value !== undefined) ? input.value : ((this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || ''));
      const candidates = this._getCompletionCandidates(currentInput);
      if (!candidates || candidates.length === 0) return;

      const lastSpaceIdx = currentInput.lastIndexOf(' ');
      const prefix = lastSpaceIdx === -1 ? '' : currentInput.slice(0, lastSpaceIdx + 1);
      const token = lastSpaceIdx === -1 ? currentInput : currentInput.slice(lastSpaceIdx + 1);

      if (candidates.length === 1) {
        const completed = prefix + candidates[0] + (candidates[0].endsWith('/') ? '' : ' ');
        if (input) input.value = completed;
        this._ptyInputBeforeCursor = completed;
        this._ptyInputAfterCursor = '';
        this._updatePtyActiveLine();
      } else {
        const common = findCommonPrefix(candidates);
        if (common && common.length > token.length) {
          const completed = prefix + common;
          if (input) input.value = completed;
          this._ptyInputBeforeCursor = completed;
          this._ptyInputAfterCursor = '';
          this._updatePtyActiveLine();
        } else {
          const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
          const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;
          this._pushTerminalLog({ type: 'system', text: `${promptLabel} ${currentInput}` });
          this._pushTerminalLog({ type: 'stdout', text: candidates.join('  ') });
          this._renderDrawerBody();
          const nextInput = this.container.querySelector('#cl-repl-input');
          if (nextInput) {
            nextInput.value = currentInput;
            this._ptyInputBeforeCursor = currentInput;
            this._ptyInputAfterCursor = '';
            this._updatePtyActiveLine();
            if (typeof nextInput.focus === 'function') nextInput.focus();
          }
        }
      }
    }

    _getFilteredProblems(allProblems) {
      const list = Array.isArray(allProblems) ? allProblems : [];
      const sevFilter = this._problemsSeverityFilter || 'all';
      const rawQuery = String(this._problemsFilterQuery || '').trim().toLowerCase();
      return list.filter((p) => {
        if (!p) return false;
        const sev = p.severity === 'error' ? 'error' : (p.severity === 'warning' ? 'warning' : 'info');
        if (sevFilter !== 'all' && sev !== sevFilter) return false;
        if (!rawQuery) return true;
        const hay = `${p.file || ''} ${p.message || ''} ${p.source || ''} ${p.code || ''}`.toLowerCase();
        return hay.includes(rawQuery);
      });
    }

    _renderProblemsListHtml(allProblems) {
      const total = Array.isArray(allProblems) ? allProblems.length : 0;
      const filtered = this._getFilteredProblems(allProblems);
      if (total === 0) {
        return `
          <div class="codelab-problems-empty" style="color:var(--cl-fg-muted);padding:16px;text-align:center;">
            ${CL_ICONS.check} No problems detected in workspace.
          </div>
        `;
      }
      if (filtered.length === 0) {
        return `
          <div class="codelab-problems-empty" style="color:var(--cl-fg-muted);padding:16px;text-align:center;">
            No problems match the current filter.
          </div>
        `;
      }
      if (!this._collapsedProblemFiles) this._collapsedProblemFiles = new Set();
      const grouped = new Map();
      for (const p of filtered) {
        const fKey = String(p.file || 'workspace');
        if (!grouped.has(fKey)) grouped.set(fKey, []);
        grouped.get(fKey).push(p);
      }
      const groupsHtml = [];
      for (const [fileKey, items] of grouped.entries()) {
        if (!items || items.length === 0) continue;
        const isCollapsed = this._collapsedProblemFiles.has(fileKey);
        const rowsHtml = isCollapsed ? '' : items.map((p) => {
          const sev = p.severity === 'error' ? 'error' : (p.severity === 'warning' ? 'warning' : 'info');
          const sevLabel = sev === 'error' ? 'Error' : (sev === 'warning' ? 'Warning' : 'Info');
          const icon = sev === 'error' ? '✖' : (sev === 'warning' ? '⚠' : 'ℹ');
          const cls = sev === 'error'
            ? 'codelab-problem-item--error'
            : (sev === 'warning' ? 'codelab-problem-item--warning' : 'codelab-problem-item--info');
          const ln = Math.max(1, Number(p.line || 1));
          const col = Math.max(1, Number(p.col || p.column || 1));
          const srcTag = p.source ? `<span class="codelab-problem-item__source">[${escapeHtml(String(p.source))}]</span>` : '';
          return `
            <div class="codelab-problem-item codelab-problem-row ${cls}" data-cl-problem-file="${escapeHtml(p.file || '')}" data-problem-file="${escapeHtml(p.file || '')}" data-cl-diag-file="${escapeHtml(p.file || '')}" data-cl-problem-line="${ln}" data-cl-problem-col="${col}" role="button" tabindex="0" aria-label="${escapeHtml(`${sevLabel} in ${p.file || 'workspace'} at line ${ln}, column ${col}: ${p.message || ''}`)}">
              <span class="codelab-problem-item__icon" aria-hidden="true">${icon}</span>
              <span class="codelab-problem-item__msg">${escapeHtml(p.message || '')}</span>
              ${srcTag}
              <span class="codelab-problem-item__location codelab-problem-item__loc">[Ln ${ln}, Col ${col}]</span>
            </div>
          `;
        }).join('');
        groupsHtml.push(`
          <div class="codelab-problems-group ${isCollapsed ? 'is-collapsed' : ''}" data-problem-group-file="${escapeHtml(fileKey)}">
            <button type="button" class="codelab-problems-group__header" data-cl-action="toggle-problem-group" data-problem-group="${escapeHtml(fileKey)}" aria-expanded="${!isCollapsed}" title="Toggle ${escapeHtml(fileKey)} problems">
              <span class="codelab-problems-group__chevron" aria-hidden="true">${isCollapsed ? '▸' : '▾'}</span>
              <span class="codelab-problems-group__file">${escapeHtml(fileKey)}</span>
              <span class="codelab-badge">${items.length}</span>
            </button>
            <div class="codelab-problems-group__items" ${isCollapsed ? 'hidden' : ''}>${rowsHtml}</div>
          </div>
        `);
      }
      return groupsHtml.join('');
    }

    _bindProblemItemKeyboard(scopeEl) {
      if (!scopeEl || typeof scopeEl.querySelectorAll !== 'function') return;
      scopeEl.querySelectorAll('.codelab-problem-item').forEach((item) => {
        if (item._clKeyBound) return;
        item._clKeyBound = true;
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
          }
        });
      });
    }

    _renderProblemsPanel(bodyEl) {
      if (!bodyEl) return;
      const store = this._ensureDiagnosticsStore();
      const allProblems = store && typeof store.getAll === 'function' ? store.getAll() : [];
      let errCount = 0;
      let warnCount = 0;
      let infoCount = 0;
      for (const p of allProblems) {
        if (!p) continue;
        if (p.severity === 'error') errCount++;
        else if (p.severity === 'warning') warnCount++;
        else infoCount++;
      }
      const totalCount = allProblems.length;
      const sevFilter = this._problemsSeverityFilter || 'all';
      const filterVal = String(this._problemsFilterQuery || '');

      const existingFilter = typeof bodyEl.querySelector === 'function' ? bodyEl.querySelector('#cl-problems-filter') : null;
      const existingList = typeof bodyEl.querySelector === 'function' ? bodyEl.querySelector('#cl-problems-list') : null;
      const filterHasFocus = Boolean(
        existingFilter &&
        typeof document !== 'undefined' &&
        document.activeElement === existingFilter
      );

      if (existingFilter && existingList && filterHasFocus) {
        existingList.innerHTML = this._renderProblemsListHtml(allProblems);
        this._bindProblemItemKeyboard(existingList);
        const updateSevBtn = (sev, text) => {
          const btn = bodyEl.querySelector(`[data-cl-severity-filter="${sev}"]`);
          if (btn) {
            const active = sevFilter === sev;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
            btn.textContent = text;
          }
        };
        updateSevBtn('all', `All (${totalCount})`);
        updateSevBtn('error', `Errors (${errCount})`);
        updateSevBtn('warning', `Warnings (${warnCount})`);
        updateSevBtn('info', `Info (${infoCount})`);
        return;
      }

      bodyEl.innerHTML = `
        <div class="codelab-problems-panel">
          <div class="codelab-problems-toolbar" role="toolbar" aria-label="Problems Filter Controls">
            <input type="search" id="cl-problems-filter" class="codelab-sidebar-input codelab-problems-filter-input" data-cl-problems-filter="true" placeholder="Filter (e.g. text, file, source)..." value="${escapeHtml(filterVal)}" aria-label="Filter problems" autocomplete="off" spellcheck="false" />
            <div class="codelab-problems-severity" role="group" aria-label="Filter by severity">
              <button type="button" class="codelab-problems-sev-btn ${sevFilter === 'all' ? 'active' : ''}" data-cl-severity-filter="all" data-problems-severity="all" aria-pressed="${sevFilter === 'all'}" title="Show All Problems">All (${totalCount})</button>
              <button type="button" class="codelab-problems-sev-btn ${sevFilter === 'error' ? 'active' : ''}" data-cl-severity-filter="error" data-problems-severity="error" aria-pressed="${sevFilter === 'error'}" title="Show Errors Only">Errors (${errCount})</button>
              <button type="button" class="codelab-problems-sev-btn ${sevFilter === 'warning' ? 'active' : ''}" data-cl-severity-filter="warning" data-problems-severity="warning" aria-pressed="${sevFilter === 'warning'}" title="Show Warnings Only">Warnings (${warnCount})</button>
              <button type="button" class="codelab-problems-sev-btn ${sevFilter === 'info' ? 'active' : ''}" data-cl-severity-filter="info" data-problems-severity="info" aria-pressed="${sevFilter === 'info'}" title="Show Info Only">Info (${infoCount})</button>
            </div>
          </div>
          <div class="codelab-problems-list" id="cl-problems-list">
            ${this._renderProblemsListHtml(allProblems)}
          </div>
        </div>
      `;

      const filterInp = typeof bodyEl.querySelector === 'function' ? bodyEl.querySelector('#cl-problems-filter') : null;
      const listContainer = typeof bodyEl.querySelector === 'function' ? bodyEl.querySelector('#cl-problems-list') : null;
      if (filterInp && listContainer) {
        filterInp.addEventListener('input', () => {
          this._problemsFilterQuery = filterInp.value || '';
          const latest = store && typeof store.getAll === 'function' ? store.getAll() : [];
          listContainer.innerHTML = this._renderProblemsListHtml(latest);
          this._bindProblemItemKeyboard(listContainer);
        });
      }
      this._bindProblemItemKeyboard(bodyEl);
    }

    _revealLineColInActiveEditor(rawLine, rawCol) {
      const line = Math.max(1, Math.floor(Number(rawLine) || 1));
      const col = Math.max(1, Math.floor(Number(rawCol) || 1));
      this.cursorPos = { lineNumber: line, column: col, ln: line, col };
      if (this.editor && typeof this.editor.revealLineInCenter === 'function') {
        try {
          this.editor.revealLineInCenter(line);
          if (typeof this.editor.setPosition === 'function') {
            this.editor.setPosition({ lineNumber: line, column: col });
          }
          if (typeof this.editor.focus === 'function') {
            this.editor.focus();
          }
        } catch (err) {
          void err;
        }
      } else if (this.container && typeof this.container.querySelector === 'function') {
        const sqlHost = this.container.querySelector('#cl-sql-editor-host');
        const sqlTa = (sqlHost && (!sqlHost.style || sqlHost.style.display !== 'none'))
          ? sqlHost.querySelector('.cl-sql-textarea')
          : null;
        const targetTa = sqlTa || this.container.querySelector('#cl-fallback-editor');
        if (targetTa && typeof targetTa.value === 'string') {
          const lines = targetTa.value.split('\n');
          const clampedIdx = Math.min(Math.max(0, line - 1), Math.max(0, lines.length - 1));
          let offset = 0;
          for (let i = 0; i < clampedIdx; i++) {
            offset += lines[i].length + 1;
          }
          const lineLen = lines[clampedIdx] ? lines[clampedIdx].length : 0;
          offset += Math.min(Math.max(0, col - 1), lineLen);
          if (typeof targetTa.setSelectionRange === 'function') {
            try { targetTa.setSelectionRange(offset, offset); } catch (err) { void err; }
          }
          if (typeof targetTa.focus === 'function') {
            targetTa.focus();
          }
          if (!sqlTa && typeof this._updateFallbackGutter === 'function') {
            this._updateFallbackGutter();
          }
        }
      }
      this._updateStatusBar();
      this._scheduleBreadcrumbs();
    }

    goToNextProblem(reverse = false) {
      const store = this._ensureDiagnosticsStore();
      const all = store && typeof store.getAll === 'function' ? store.getAll() : [];
      const list = this._getFilteredProblems(all);
      if (!list.length) return null;
      const len = list.length;
      if (typeof this._problemNavIdx !== 'number' || this._problemNavIdx < 0 || this._problemNavIdx >= len) {
        this._problemNavIdx = reverse ? len - 1 : 0;
      } else {
        this._problemNavIdx = (this._problemNavIdx + (reverse ? -1 : 1) + len) % len;
      }
      const target = list[this._problemNavIdx];
      if (target && target.file && Object.prototype.hasOwnProperty.call(this.files || {}, target.file)) {
        this.openFile(target.file);
        this._revealLineColInActiveEditor(target.line || 1, target.col || target.column || 1);
      }
      return target || null;
    }

    _getCompletionCandidates(currentInput) {
      const line = currentInput || '';
      const lastSpaceIdx = line.lastIndexOf(' ');
      const token = lastSpaceIdx === -1 ? line : line.slice(lastSpaceIdx + 1);
      const isFirstToken = lastSpaceIdx === -1;

      if (isFirstToken && !token.includes('/')) {
        const commands = [
          'ab', 'awk', 'bun', 'cat', 'cd', 'chaos', 'clang++', 'clear', 'cp', 'curl',
          'diff', 'echo', 'env', 'export', 'find', 'g++', 'git', 'grep', 'head', 'help',
          'hey', 'history', 'jobs', 'kill', 'ls', 'mkdir', 'mv', 'node', 'npm', 'npx',
          'ports', 'ps', 'pwd', 'pytest', 'python3', 'redis-cli', 'rm', 'sed', 'serve',
          'sort', 'sqlite3', 'tail', 'touch', 'tree', 'uniq', 'unset', 'wc', 'which', 'wrk'
        ];
        return commands.filter(c => c.startsWith(token));
      }

      const candidates = new Set();
      const rawCwd = String(this.cwd || '/workspace').replace(/\/+$/, '') || '/workspace';
      const normCwd = rawCwd + '/';
      const isAbsToken = token.startsWith('/');
      const lastSlash = token.lastIndexOf('/');
      const dirPrefix = lastSlash === -1 ? '' : token.slice(0, lastSlash + 1);

      const addCandidateFromAbs = (absPath, isFolder) => {
        const cleanAbs = String(absPath || '').replace(/\/+$/, '');
        if (!cleanAbs) return;
        let candidate = '';
        if (isAbsToken) {
          candidate = isFolder ? (cleanAbs + '/') : cleanAbs;
        } else if (cleanAbs.startsWith(normCwd)) {
          const rel = cleanAbs.slice(normCwd.length);
          if (!rel) return;
          candidate = isFolder ? (rel + '/') : rel;
        } else {
          return;
        }
        if (!candidate.startsWith(token)) return;
        const remainder = candidate.slice(dirPrefix.length);
        const subSlash = remainder.indexOf('/');
        if (subSlash !== -1 && subSlash < remainder.length - 1) {
          candidates.add(dirPrefix + remainder.slice(0, subSlash + 1));
        } else {
          candidates.add(candidate);
        }
      };

      for (const p of Object.keys(this.files || {})) {
        const absFile = p.startsWith('/') ? p : ('/workspace/' + p);
        addCandidateFromAbs(absFile, false);
      }
      for (const folder of (this.folders || [])) {
        const absFolder = folder.startsWith('/') ? folder : ('/workspace/' + folder);
        addCandidateFromAbs(absFolder, true);
      }
      if (this.shell && this.shell.vfs && typeof this.shell.vfs.readdirSync === 'function') {
        const lookupDir = isAbsToken
          ? (dirPrefix ? dirPrefix.replace(/\/+$/, '') || '/' : '/')
          : (dirPrefix ? (normCwd + dirPrefix).replace(/\/+$/, '') : rawCwd);
        try {
          const entries = this.shell.vfs.readdirSync(lookupDir);
          if (Array.isArray(entries)) {
            for (const ent of entries) {
              const name = typeof ent === 'string' ? ent : (ent && ent.name ? ent.name : '');
              if (!name || name === '.' || name === '..') continue;
              const childAbs = (lookupDir === '/' ? '' : lookupDir) + '/' + name;
              let isDir = false;
              if (this.shell.vfs && typeof this.shell.vfs.statSync === 'function') {
                try {
                  const st = this.shell.vfs.statSync(childAbs);
                  isDir = Boolean(st && typeof st.isDirectory === 'function' && st.isDirectory());
                } catch (_e) { void _e; }
              }
              addCandidateFromAbs(childAbs, isDir);
            }
          }
        } catch (_e) {
          void _e;
        }
      }
      return Array.from(candidates).sort();
    }

    _renderPortsPanel(bodyEl) {
      if (!bodyEl) return;
      const servers = (this.portTable && typeof this.portTable.listServers === 'function')
        ? this.portTable.listServers()
        : [];
      const httpState = this.httpClientState;
      const lastRes = httpState.lastResponse;

      let serversHtml = '';
      if (servers.length === 0) {
        serversHtml = `
          <div class="codelab-ports-empty">
            <p style="margin:0 0 6px 0;font-weight:500;">No active port listeners</p>
            <span style="font-size:12px;color:var(--cl-fg-muted);">
              Run an HTTP or WebSocket server in the terminal (e.g. <code>node server.js &amp;</code> or <code>bun run server.ts &amp;</code>) to bind a virtual port.
            </span>
          </div>
        `;
      } else {
        serversHtml = `
          <div class="codelab-ports-table-wrapper">
            <table class="codelab-ports-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Host / URL</th>
                  <th>Protocol</th>
                  <th>Process / Service</th>
                  <th>Status &amp; Chaos</th>
                  <th style="text-align:right;">Chaos Injection &amp; Actions</th>
                </tr>
              </thead>
              <tbody>
                ${servers.map(s => {
                  const rule = (this.portTable && typeof this.portTable.getChaosRule === 'function')
                    ? this.portTable.getChaosRule(s.port)
                    : null;
                  const isCrashed = Boolean(rule && rule.crashed);
                  const hasLat = Boolean(rule && rule.latencyMs > 0);
                  const hasErr = Boolean(rule && rule.errorRate > 0);
                  const hasDrop = Boolean(rule && rule.dropRate > 0);
                  const hasAnyChaos = isCrashed || hasLat || hasErr || hasDrop || Boolean(rule && rule.partitionFromPorts && rule.partitionFromPorts.length);
                  const chaosPills = [];
                  if (isCrashed) chaosPills.push(`<span class="codelab-chaos-badge codelab-chaos-badge--danger">CRASHED</span>`);
                  if (hasLat) chaosPills.push(`<span class="codelab-chaos-badge codelab-chaos-badge--warn">+${rule.latencyMs}ms</span>`);
                  if (hasErr) chaosPills.push(`<span class="codelab-chaos-badge codelab-chaos-badge--danger">${Math.round(rule.errorRate * 100)}% HTTP ${rule.errorStatus || 503}</span>`);
                  if (hasDrop) chaosPills.push(`<span class="codelab-chaos-badge codelab-chaos-badge--danger">${Math.round(rule.dropRate * 100)}% DROP</span>`);
                  return `
                  <tr>
                    <td><span class="codelab-port-tag">${s.port}</span></td>
                    <td><a href="http://127.0.0.1:${s.port}/" target="_blank" class="codelab-port-link">http://127.0.0.1:${s.port}/</a></td>
                    <td><span class="codelab-badge">${escapeHtml(s.protocol || 'HTTP/1.1')}</span></td>
                    <td><code>${escapeHtml(s.service || (s.pid ? `PID ${s.pid}` : 'node'))}</code></td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span class="codelab-port-status ${isCrashed ? 'codelab-port-status--crashed' : 'codelab-port-status--listening'}">
                          <span class="codelab-port-status-dot"></span>${isCrashed ? 'CRASHED' : 'LISTENING'}
                        </span>
                        ${chaosPills.join('')}
                      </div>
                    </td>
                    <td style="text-align:right;white-space:nowrap;">
                      <span class="codelab-chaos-btn-group" title="Inject network faults on port :${s.port}">
                        <button type="button" class="codelab-btn codelab-btn--sm ${hasLat ? 'codelab-btn--chaos-active' : ''}" data-cl-action="chaos-latency" data-port="${s.port}" title="Toggle +200ms network latency on :${s.port}">+200ms</button>
                        <button type="button" class="codelab-btn codelab-btn--sm ${hasErr ? 'codelab-btn--chaos-active' : ''}" data-cl-action="chaos-error" data-port="${s.port}" title="Toggle 25% HTTP 503 error rate on :${s.port}">25% 503</button>
                        <button type="button" class="codelab-btn codelab-btn--sm ${isCrashed ? 'codelab-btn--danger' : ''}" data-cl-action="chaos-crash" data-port="${s.port}" title="Simulate node crash (ECONNREFUSED) on :${s.port}">${isCrashed ? 'Recover' : 'Crash'}</button>
                        ${hasAnyChaos ? `<button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="chaos-heal" data-port="${s.port}" title="Heal all chaos rules on :${s.port}">Heal</button>` : ''}
                      </span>
                      <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--primary" data-cl-action="open-web-preview" data-port="${s.port}" data-cl-port="${s.port}">Preview</button>
                      <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="open-port-client" data-port="${s.port}" data-cl-port="${s.port}">Open in Client</button>
                      <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--danger" data-cl-action="stop-port" data-port="${s.port}" data-cl-port="${s.port}">Stop</button>
                    </td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      const methodOptions = methods.map(m => `<option value="${m}" ${httpState.method === m ? 'selected' : ''}>${m}</option>`).join('');

      let responseBodyView = '';
      if (httpState.loading) {
        responseBodyView = `<div class="codelab-response-placeholder">Sending virtual loopback request...</div>`;
      } else if (!lastRes) {
        responseBodyView = `<div class="codelab-response-placeholder">No response received yet. Send a request above to inspect loopback traffic.</div>`;
      } else if (httpState.activeResponseTab === 'preview') {
        const isHtml = lastRes.headers && Object.entries(lastRes.headers).some(([k, v]) => k.toLowerCase() === 'content-type' && String(v).includes('text/html'));
        if (isHtml || lastRes.body.includes('<html') || lastRes.body.includes('<!DOCTYPE') || lastRes.body.includes('<div') || lastRes.body.includes('<body')) {
          responseBodyView = `<iframe class="codelab-response-iframe" title="HTTP response HTML preview" sandbox="" srcdoc="${escapeHtml(lastRes.body)}"></iframe>`;
        } else {
          responseBodyView = `<pre class="codelab-response-raw"><code>${escapeHtml(lastRes.formattedBody || lastRes.body)}</code></pre>`;
        }
      } else if (httpState.activeResponseTab === 'raw') {
        responseBodyView = `<pre class="codelab-response-raw"><code>${escapeHtml(lastRes.formattedBody || lastRes.body)}</code></pre>`;
      } else if (httpState.activeResponseTab === 'headers') {
        const headerRows = Object.entries(lastRes.headers || {})
          .map(([k, v]) => `<tr><td class="codelab-header-key">${escapeHtml(k)}:</td><td class="codelab-header-val">${escapeHtml(String(v))}</td></tr>`)
          .join('');
        responseBodyView = `
          <table class="codelab-headers-table">
            <tbody>
              ${headerRows || '<tr><td colspan="2" style="color:var(--cl-fg-muted);">No headers present</td></tr>'}
            </tbody>
          </table>
        `;
      }

      let responseHeaderMeta = '';
      if (lastRes) {
        const statusClass = lastRes.status < 300 ? 'status-2xx' : (lastRes.status < 400 ? 'status-3xx' : (lastRes.status < 500 ? 'status-4xx' : 'status-5xx'));
        responseHeaderMeta = `
          <div class="codelab-response-meta">
            <span class="codelab-status-badge ${statusClass}">HTTP ${lastRes.status} ${escapeHtml(lastRes.statusText || '')}</span>
            <span class="codelab-meta-item">${(lastRes.durationMs || 0).toFixed(1)} ms</span>
            <span class="codelab-meta-item">${lastRes.size} bytes</span>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div class="codelab-ports-panel">
          <div class="codelab-panel-section">
            <div class="codelab-section-title">
              <span>${CL_ICONS.radio || ''} Active Port Listeners &amp; Chaos Controls</span>
              <span class="codelab-badge">${servers.length} listening</span>
            </div>
            ${serversHtml}
          </div>

          <div class="codelab-panel-section">
            <div class="codelab-section-title">
              <span>${CL_ICONS.send || ''} Mini HTTP Client</span>
              <span style="font-size:11px;color:var(--cl-fg-muted);">Virtual Loopback (127.0.0.1)</span>
            </div>
            <div class="codelab-http-client">
              <div class="codelab-http-url-bar">
                <select class="codelab-select" id="cl-http-method" aria-label="HTTP Method">${methodOptions}</select>
                <input type="text" class="codelab-input" id="cl-http-url" value="${escapeHtml(httpState.url)}" placeholder="http://localhost:3000/" aria-label="Request URL">
                <button type="button" class="codelab-btn codelab-btn--primary" id="cl-http-send-btn" data-cl-action="http-send">${CL_ICONS.send || ''} <span>Send</span></button>
              </div>
              <div class="codelab-http-editors">
                <div class="codelab-http-editor-group">
                  <label for="cl-http-headers" class="codelab-label">Headers (Key: Value):</label>
                  <textarea class="codelab-textarea" id="cl-http-headers" rows="2" placeholder="Content-Type: application/json">${escapeHtml(httpState.headers)}</textarea>
                </div>
                <div class="codelab-http-editor-group">
                  <label for="cl-http-body" class="codelab-label">Request Body:</label>
                  <textarea class="codelab-textarea" id="cl-http-body" rows="2" placeholder='{"key":"value"}'>${escapeHtml(httpState.body)}</textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="codelab-panel-section" style="flex:1;display:flex;flex-direction:column;min-height:200px;">
            <div class="codelab-section-title" style="justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:12px;">
                <span>Response Viewer</span>
                <div class="codelab-subtabs" role="tablist">
                  <button type="button" role="tab" class="codelab-subtab ${httpState.activeResponseTab === 'preview' ? 'active' : ''}" data-cl-action="http-tab" data-tab="preview" data-cl-http-tab="preview">Preview</button>
                  <button type="button" role="tab" class="codelab-subtab ${httpState.activeResponseTab === 'raw' ? 'active' : ''}" data-cl-action="http-tab" data-tab="raw" data-cl-http-tab="raw">Raw / JSON</button>
                  <button type="button" role="tab" class="codelab-subtab ${httpState.activeResponseTab === 'headers' ? 'active' : ''}" data-cl-action="http-tab" data-tab="headers" data-cl-http-tab="headers">Headers</button>
                </div>
              </div>
              ${responseHeaderMeta}
            </div>
            <div class="codelab-response-body-wrapper">
              ${responseBodyView}
            </div>
          </div>
        </div>
      `;

      this._bindPortsEvents(bodyEl);
    }

    _bindPortsEvents(bodyEl) {
      if (!bodyEl) return;
      const methodSelect = bodyEl.querySelector('#cl-http-method');
      if (methodSelect) {
        methodSelect.addEventListener('change', e => {
          this.httpClientState.method = e.target.value;
        });
      }
      const urlInput = bodyEl.querySelector('#cl-http-url');
      if (urlInput) {
        urlInput.addEventListener('input', e => {
          this.httpClientState.url = e.target.value;
        });
      }
      const headersArea = bodyEl.querySelector('#cl-http-headers');
      if (headersArea) {
        headersArea.addEventListener('input', e => {
          this.httpClientState.headers = e.target.value;
        });
      }
      const bodyArea = bodyEl.querySelector('#cl-http-body');
      if (bodyArea) {
        bodyArea.addEventListener('input', e => {
          this.httpClientState.body = e.target.value;
        });
      }
    }

    _renderNetworkPanel(bodyEl) {
      if (!bodyEl) return;
      const traces = Array.isArray(this.lastHttpTrace) ? this.lastHttpTrace : [];
      const filter = this.networkFilter;

      // Compute SLO & Latency Percentiles across all captured traces
      const totalReqs = traces.length;
      let count2xx = 0;
      let count429 = 0;
      let count5xxOrErr = 0;
      const sortedDurations = traces.map(t => Number(t.durationMs || 0)).sort((a, b) => a - b);
      for (const t of traces) {
        const st = Number(t.status || 0);
        if (st >= 200 && st < 300) count2xx++;
        else if (st === 429) count429++;
        else if (st >= 500 || st === 0) count5xxOrErr++;
      }
      const pctLat = (p) => {
        if (!sortedDurations.length) return '0.0';
        const idx = Math.min(sortedDurations.length - 1, Math.floor((p / 100) * sortedDurations.length));
        return sortedDurations[idx].toFixed(1);
      };
      const okPct = totalReqs > 0 ? ((count2xx / totalReqs) * 100).toFixed(1) : '100.0';
      const p50Ms = pctLat(50);
      const p95Ms = pctLat(95);
      const p99Ms = pctLat(99);

      // Build Live Service Topology & Chaos Map
      const servers = (this.portTable && typeof this.portTable.listServers === 'function')
        ? this.portTable.listServers()
        : [];
      const edgeMap = new Map();
      for (const t of traces) {
        const src = t.fromPort ? `:${t.fromPort}` : 'Client';
        const dst = `:${t.port || 3000}`;
        const key = `${src}→${dst}`;
        const cur = edgeMap.get(key) || { src, dst, targetPort: Number(t.port || 3000), count: 0, errCount: 0, totalMs: 0 };
        cur.count++;
        if (Number(t.status || 0) >= 500 || Number(t.status || 0) === 0) cur.errCount++;
        cur.totalMs += Number(t.durationMs || 0);
        edgeMap.set(key, cur);
      }

      let topologyHtml = '';
      if (servers.length > 0 || edgeMap.size > 0) {
        const edgePills = Array.from(edgeMap.values()).map(e => {
          const avg = (e.totalMs / Math.max(1, e.count)).toFixed(1);
          const hasErrors = e.errCount > 0;
          return `
            <span class="codelab-topo-edge ${hasErrors ? 'codelab-topo-edge--err' : ''}">
              <strong>${escapeHtml(e.src)}</strong>
              <span class="codelab-topo-arrow">──(${e.count} req · ${avg}ms${hasErrors ? ` · ${e.errCount} err` : ''})──▶</span>
              <strong>${escapeHtml(e.dst)}</strong>
            </span>
          `;
        }).join('');

        const nodePills = servers.map(s => {
          const rule = (this.portTable && typeof this.portTable.getChaosRule === 'function')
            ? this.portTable.getChaosRule(s.port)
            : null;
          const isCrashed = Boolean(rule && rule.crashed);
          const hasLat = Boolean(rule && rule.latencyMs > 0);
          const hasErr = Boolean(rule && rule.errorRate > 0);
          return `
            <span class="codelab-topo-node ${isCrashed ? 'is-crashed' : (hasLat || hasErr ? 'is-degraded' : 'is-healthy')}">
              <span class="codelab-port-status-dot"></span>
              <code>:${s.port}</code>
              <span>${escapeHtml(s.service || 'node')}</span>
              ${isCrashed ? '<span class="codelab-chaos-badge codelab-chaos-badge--danger">CRASHED</span>' : ''}
              ${hasLat ? `<span class="codelab-chaos-badge codelab-chaos-badge--warn">+${rule.latencyMs}ms</span>` : ''}
              ${hasErr ? `<span class="codelab-chaos-badge codelab-chaos-badge--danger">${Math.round(rule.errorRate * 100)}% ${rule.errorStatus || 503}</span>` : ''}
            </span>
          `;
        }).join('');

        topologyHtml = `
          <div class="codelab-topo-bar">
            <div class="codelab-topo-nodes">${nodePills || '<span style="font-size:11px;color:var(--cl-fg-muted);">No listening servers</span>'}</div>
            ${edgePills ? `<div class="codelab-topo-edges">${edgePills}</div>` : ''}
          </div>
        `;
      }

      const filtered = traces.filter(t => {
        if (filter.method && filter.method !== 'ALL' && (t.method || 'GET').toUpperCase() !== filter.method) return false;
        if (filter.status && filter.status !== 'ALL') {
          const s = Number(t.status || 0);
          if (filter.status === '2xx' && (s < 200 || s >= 300)) return false;
          if (filter.status === '3xx' && (s < 300 || s >= 400)) return false;
          if (filter.status === '4xx' && (s < 400 || s >= 500)) return false;
          if (filter.status === '5xx' && (s < 500 && s !== 0)) return false;
        }
        if (filter.search) {
          const query = filter.search.toLowerCase();
          const urlMatch = String(t.url || '').toLowerCase().includes(query);
          const methodMatch = String(t.method || '').toLowerCase().includes(query);
          const portMatch = String(t.port || '').includes(query);
          if (!urlMatch && !methodMatch && !portMatch) return false;
        }
        return true;
      });

      const selectedTrace = traces.find(t => String(t.id) === String(filter.selectedTraceId)) || null;

      let rowsHtml = '';
      if (filtered.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="7" style="text-align:center;padding:32px;color:var(--cl-fg-muted);">
              ${traces.length === 0 ? 'No network requests recorded yet. Run a demo, click "⚡ Load Test", or run `hey -n 50 http://localhost:3000` in the terminal.' : 'No network requests match the active filters.'}
            </td>
          </tr>
        `;
      } else {
        const maxDuration = Math.max(1, ...filtered.map(t => t.durationMs || 1));
        rowsHtml = filtered.map(t => {
          const status = Number(t.status || 0);
          const statusLabel = status === 0 ? (t.statusText || 'ERR') : String(status);
          const statusClass = status === 0 ? 'status-5xx' : (status < 300 ? 'status-2xx' : (status < 400 ? 'status-3xx' : (status < 500 ? 'status-4xx' : 'status-5xx')));
          const widthPct = Math.min(100, Math.max(8, Math.round(((t.durationMs || 1) / maxDuration) * 100)));
          const isSelected = selectedTrace && String(selectedTrace.id) === String(t.id);
          const hopLabel = t.fromPort ? `:${t.fromPort}→:${t.port || 3000}` : `:${t.port || 3000}`;
          const chaosChip = t.chaosEffect ? `<span class="codelab-chaos-badge codelab-chaos-badge--warn" style="margin-left:4px;">${escapeHtml(String(t.chaosEffect))}</span>` : '';
          return `
            <tr class="codelab-net-row ${isSelected ? 'selected' : ''}" data-cl-action="select-net-trace" data-trace-id="${escapeHtml(t.id || '')}" data-cl-trace-id="${escapeHtml(t.id || '')}">
              <td><span class="codelab-status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>${chaosChip}</td>
              <td><span class="codelab-method-badge codelab-method-${(t.method || 'GET').toLowerCase()}">${escapeHtml(t.method || 'GET')}</span></td>
              <td class="codelab-net-path" title="${escapeHtml(t.url || '/')}">${escapeHtml(t.url || '/')}</td>
              <td><code>${escapeHtml(hopLabel)}</code></td>
              <td style="white-space:nowrap;font-family:var(--cl-font-mono);font-size:11.5px;">${(t.durationMs || 0).toFixed(1)} ms</td>
              <td style="white-space:nowrap;font-family:var(--cl-font-mono);font-size:11.5px;">${t.size != null ? t.size : 0} B</td>
              <td class="codelab-waterfall-cell">
                <div class="codelab-waterfall-track">
                  <div class="codelab-waterfall-bar" style="width:${widthPct}%;"></div>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      let detailHtml = '';
      if (selectedTrace) {
        const reqHeaders = typeof selectedTrace.requestHeaders === 'string'
          ? selectedTrace.requestHeaders
          : JSON.stringify(selectedTrace.requestHeaders || {}, null, 2);
        const resHeaders = typeof selectedTrace.responseHeaders === 'string'
          ? selectedTrace.responseHeaders
          : JSON.stringify(selectedTrace.responseHeaders || {}, null, 2);
        detailHtml = `
          <div class="codelab-net-detail">
            <div class="codelab-net-detail__head">
              <span style="font-weight:600;display:flex;align-items:center;gap:8px;">
                <span class="codelab-method-badge codelab-method-${(selectedTrace.method || 'GET').toLowerCase()}">${escapeHtml(selectedTrace.method || 'GET')}</span>
                <span>${escapeHtml(selectedTrace.url || '/')}</span>
              </span>
              <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="close-net-detail">Close</button>
            </div>
            <div class="codelab-net-detail__body">
              <div class="codelab-net-detail__section">
                <div class="codelab-detail-label">General</div>
                <div class="codelab-detail-kv"><strong>URL:</strong> 127.0.0.1:${selectedTrace.port}${escapeHtml(selectedTrace.url || '/')}</div>
                ${selectedTrace.fromPort ? `<div class="codelab-detail-kv"><strong>Caller Port:</strong> :${selectedTrace.fromPort}</div>` : ''}
                ${selectedTrace.chaosEffect ? `<div class="codelab-detail-kv"><strong>Chaos Fault:</strong> ${escapeHtml(String(selectedTrace.chaosEffect))}</div>` : ''}
                <div class="codelab-detail-kv"><strong>Status:</strong> ${selectedTrace.status} ${escapeHtml(selectedTrace.statusText || '')}</div>
                <div class="codelab-detail-kv"><strong>Duration:</strong> ${(selectedTrace.durationMs || 0).toFixed(2)} ms</div>
                <div class="codelab-detail-kv"><strong>Size:</strong> ${selectedTrace.size || 0} bytes</div>
              </div>
              <div class="codelab-net-detail__section">
                <div class="codelab-detail-label">Request Headers</div>
                <pre class="codelab-detail-pre"><code>${escapeHtml(reqHeaders || '(empty)')}</code></pre>
              </div>
              ${selectedTrace.requestBody ? `
                <div class="codelab-net-detail__section">
                  <div class="codelab-detail-label">Request Body</div>
                  <pre class="codelab-detail-pre"><code>${escapeHtml(selectedTrace.requestBody)}</code></pre>
                </div>
              ` : ''}
              <div class="codelab-net-detail__section">
                <div class="codelab-detail-label">Response Headers</div>
                <pre class="codelab-detail-pre"><code>${escapeHtml(resHeaders || '(empty)')}</code></pre>
              </div>
              <div class="codelab-net-detail__section">
                <div class="codelab-detail-label">Response Body</div>
                <pre class="codelab-detail-pre"><code>${escapeHtml(selectedTrace.formattedBody || selectedTrace.responseBody || '(empty)')}</code></pre>
              </div>
            </div>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div class="codelab-network-panel ${selectedTrace ? 'has-detail' : ''}">
          <div class="codelab-slo-bar" role="region" aria-label="SLO and Latency Telemetry">
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">Requests</span>
              <span class="codelab-slo-val">${totalReqs}</span>
            </div>
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">2xx SLO</span>
              <span class="codelab-slo-val ${Number(okPct) < 95 && totalReqs > 0 ? 'is-warn' : 'is-ok'}">${okPct}%</span>
            </div>
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">429 Throttled</span>
              <span class="codelab-slo-val ${count429 > 0 ? 'is-warn' : ''}">${count429}</span>
            </div>
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">5xx / Faults</span>
              <span class="codelab-slo-val ${count5xxOrErr > 0 ? 'is-err' : ''}">${count5xxOrErr}</span>
            </div>
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">p50</span>
              <span class="codelab-slo-val">${p50Ms} ms</span>
            </div>
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">p95</span>
              <span class="codelab-slo-val">${p95Ms} ms</span>
            </div>
            <div class="codelab-slo-metric">
              <span class="codelab-slo-label">p99</span>
              <span class="codelab-slo-val">${p99Ms} ms</span>
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
              <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--primary" data-cl-action="run-quick-loadtest" title="Run 50 concurrent requests (hey -n 50 -c 10) against active server">⚡ Load Test (50 reqs)</button>
            </div>
          </div>
          ${topologyHtml}
          <div class="codelab-net-toolbar">
            <input type="text" class="codelab-input" id="cl-net-search" placeholder="Filter URL, port, or method..." value="${escapeHtml(filter.search)}" aria-label="Filter network traces">
            <select class="codelab-select" id="cl-net-method" aria-label="Filter by method">
              <option value="ALL" ${filter.method === 'ALL' ? 'selected' : ''}>All Methods</option>
              <option value="GET" ${filter.method === 'GET' ? 'selected' : ''}>GET</option>
              <option value="POST" ${filter.method === 'POST' ? 'selected' : ''}>POST</option>
              <option value="PUT" ${filter.method === 'PUT' ? 'selected' : ''}>PUT</option>
              <option value="DELETE" ${filter.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
              <option value="PATCH" ${filter.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
            </select>
            <select class="codelab-select" id="cl-net-status" aria-label="Filter by status">
              <option value="ALL" ${filter.status === 'ALL' ? 'selected' : ''}>All Status</option>
              <option value="2xx" ${filter.status === '2xx' ? 'selected' : ''}>2xx Success</option>
              <option value="3xx" ${filter.status === '3xx' ? 'selected' : ''}>3xx Redirect</option>
              <option value="4xx" ${filter.status === '4xx' ? 'selected' : ''}>4xx Client Error</option>
              <option value="5xx" ${filter.status === '5xx' ? 'selected' : ''}>5xx / Network Fault</option>
            </select>
            <button type="button" class="codelab-btn" data-cl-action="clear-net-traces">Clear</button>
            <span id="cl-net-count" style="margin-left:auto;font-size:11.5px;color:var(--cl-fg-muted);">${filtered.length} of ${traces.length} requests</span>
          </div>
          <div class="codelab-net-main">
            <div class="codelab-net-table-container">
              <table class="codelab-net-table">
                <thead>
                  <tr>
                    <th scope="col" style="width:85px;">Status</th>
                    <th scope="col" style="width:65px;">Method</th>
                    <th scope="col">Path</th>
                    <th scope="col" style="width:95px;">Route</th>
                    <th scope="col" style="width:75px;">Time</th>
                    <th scope="col" style="width:70px;">Size</th>
                    <th scope="col" style="width:140px;">Waterfall</th>
                  </tr>
                </thead>
                <tbody id="cl-net-tbody">
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
            ${detailHtml}
          </div>
        </div>
      `;

      this._bindNetworkEvents(bodyEl);
    }

    _updateNetworkRowsInPlace(bodyEl) {
      if (!bodyEl) return false;
      const tbody = bodyEl.querySelector('#cl-net-tbody');
      const countEl = bodyEl.querySelector('#cl-net-count');
      if (!tbody) return false;
      const traces = this.lastHttpTrace || [];
      const filter = this.networkFilter;
      const filtered = traces.filter(t => {
        if (filter.method !== 'ALL' && (t.method || 'GET').toUpperCase() !== filter.method) return false;
        if (filter.status !== 'ALL') {
          const s = Number(t.status || 0);
          if (filter.status === '2xx' && (s < 200 || s >= 300)) return false;
          if (filter.status === '3xx' && (s < 300 || s >= 400)) return false;
          if (filter.status === '4xx' && (s < 400 || s >= 500)) return false;
          if (filter.status === '5xx' && (s < 500 && s !== 0)) return false;
        }
        if (filter.search) {
          const query = filter.search.toLowerCase();
          const urlMatch = String(t.url || '').toLowerCase().includes(query);
          const methodMatch = String(t.method || '').toLowerCase().includes(query);
          const portMatch = String(t.port || '').includes(query);
          if (!urlMatch && !methodMatch && !portMatch) return false;
        }
        return true;
      });
      const selectedTrace = traces.find(t => String(t.id) === String(filter.selectedTraceId)) || null;
      if (countEl) {
        countEl.textContent = `${filtered.length} of ${traces.length} requests`;
      }
      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:32px;color:var(--cl-fg-muted);">
              ${traces.length === 0 ? 'No network requests recorded yet. Run a demo, click "⚡ Load Test", or run `hey -n 50 http://localhost:3000` in the terminal.' : 'No network requests match the active filters.'}
            </td>
          </tr>
        `;
      } else {
        const maxDuration = Math.max(1, ...filtered.map(t => t.durationMs || 1));
        tbody.innerHTML = filtered.map(t => {
          const status = Number(t.status || 0);
          const statusLabel = status === 0 ? (t.statusText || 'ERR') : String(status);
          const statusClass = status === 0 ? 'status-5xx' : (status < 300 ? 'status-2xx' : (status < 400 ? 'status-3xx' : (status < 500 ? 'status-4xx' : 'status-5xx')));
          const widthPct = Math.min(100, Math.max(8, Math.round(((t.durationMs || 1) / maxDuration) * 100)));
          const isSelected = selectedTrace && String(selectedTrace.id) === String(t.id);
          const hopLabel = t.fromPort ? `:${t.fromPort}→:${t.port || 3000}` : `:${t.port || 3000}`;
          const chaosChip = t.chaosEffect ? `<span class="codelab-chaos-badge codelab-chaos-badge--warn" style="margin-left:4px;">${escapeHtml(String(t.chaosEffect))}</span>` : '';
          return `
            <tr class="codelab-net-row ${isSelected ? 'selected' : ''}" data-cl-action="select-net-trace" data-trace-id="${escapeHtml(t.id || '')}" data-cl-trace-id="${escapeHtml(t.id || '')}">
              <td><span class="codelab-status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>${chaosChip}</td>
              <td><span class="codelab-method-badge codelab-method-${(t.method || 'GET').toLowerCase()}">${escapeHtml(t.method || 'GET')}</span></td>
              <td class="codelab-net-path" title="${escapeHtml(t.url || '/')}">${escapeHtml(t.url || '/')}</td>
              <td><code>${escapeHtml(hopLabel)}</code></td>
              <td style="white-space:nowrap;font-family:var(--cl-font-mono);font-size:11.5px;">${(t.durationMs || 0).toFixed(1)} ms</td>
              <td style="white-space:nowrap;font-family:var(--cl-font-mono);font-size:11.5px;">${t.size != null ? t.size : 0} B</td>
              <td class="codelab-waterfall-cell">
                <div class="codelab-waterfall-track">
                  <div class="codelab-waterfall-bar" style="width:${widthPct}%;"></div>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
      return true;
    }

    _bindNetworkEvents(bodyEl) {
      if (!bodyEl) return;
      const searchInput = bodyEl.querySelector('#cl-net-search');
      if (searchInput) {
        searchInput.addEventListener('input', e => {
          this.networkFilter.search = e.target.value;
          if (!this._updateNetworkRowsInPlace(bodyEl)) {
            this._renderDrawerBody();
          }
        });
      }
      const methodSelect = bodyEl.querySelector('#cl-net-method');
      if (methodSelect) {
        methodSelect.addEventListener('change', e => {
          this.networkFilter.method = e.target.value;
          this._renderDrawerBody();
        });
      }
      const statusSelect = bodyEl.querySelector('#cl-net-status');
      if (statusSelect) {
        statusSelect.addEventListener('change', e => {
          this.networkFilter.status = e.target.value;
          this._renderDrawerBody();
        });
      }
    }

    async dispatchHttpClientRequest() {
      const method = this.httpClientState.method || 'GET';
      let url = this.httpClientState.url || 'http://localhost:3000/';
      const headersRaw = this.httpClientState.headers || '';
      const body = this.httpClientState.body || '';

      this.httpClientState.loading = true;
      this._renderDrawerBody();

      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let status = 0;
      let statusText = '';
      let responseHeaders = {};
      let responseBody = '';
      let parsedPort = 3000;
      let reqPath = '/';

      try {
        if (!/^https?:\/\//i.test(url)) {
          url = `http://127.0.0.1:3000${url.startsWith('/') ? '' : '/'}${url}`;
        }
        const parsedUrl = new URL(url);
        parsedPort = Number(parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80));
        reqPath = parsedUrl.pathname + (parsedUrl.search || '');

        const reqHeaders = {};
        for (const line of headersRaw.split('\n')) {
          const idx = line.indexOf(':');
          if (idx > 0) {
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            if (k) reqHeaders[k] = v;
          }
        }

        const init = {
          method,
          headers: reqHeaders
        };
        if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
          init.body = body;
        }

        let response = null;
        if (this.portTable && typeof this.portTable.dispatchRequest === 'function') {
          this._inHttpClientDispatch = true;
          try {
            response = await this.portTable.dispatchRequest(url, init);
          } finally {
            this._inHttpClientDispatch = false;
          }
        } else {
          const err = new Error(`connect ECONNREFUSED 127.0.0.1:${parsedPort}`);
          err.code = 'ECONNREFUSED';
          throw err;
        }

        status = response.status;
        statusText = response.statusText || (status >= 200 && status < 300 ? 'OK' : 'Error');
        if (response.headers && typeof response.headers.forEach === 'function') {
          response.headers.forEach((v, k) => { responseHeaders[k] = v; });
        } else if (response.headers) {
          responseHeaders = { ...response.headers };
        }
        responseBody = await response.text();
      } catch (err) {
        status = 502;
        statusText = 'Bad Gateway / Connection Refused';
        responseBody = String(err.message || err);
        responseHeaders = { 'content-type': 'text/plain' };
      }

      const durationMs = Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      const size = responseBody.length;

      let formattedBody = responseBody;
      try {
        const parsed = JSON.parse(responseBody);
        formattedBody = JSON.stringify(parsed, null, 2);
      } catch (_) {
        formattedBody = responseBody;
      }

      const traceId = 'trace_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const traceItem = {
        id: traceId,
        timestamp: new Date().toLocaleTimeString(),
        method,
        url: reqPath,
        fullUrl: url,
        port: parsedPort,
        status,
        statusText,
        durationMs,
        size,
        requestHeaders: headersRaw,
        requestBody: body,
        responseHeaders,
        responseBody,
        formattedBody
      };

      if (!Array.isArray(this.lastHttpTrace)) {
        this.lastHttpTrace = [];
      }
      this.lastHttpTrace.push(traceItem);

      this.httpClientState.lastResponse = {
        status,
        statusText,
        durationMs,
        size,
        headers: responseHeaders,
        body: responseBody,
        formattedBody
      };
      this.httpClientState.loading = false;
      this._renderDrawerBody();
    }

    _sendHttpClientRequest() {
      return this.dispatchHttpClientRequest();
    }

    switchDrawerTab(tab, opts = {}) {
      if (!tab) return;
      if (!opts || !opts.fromConfig) {
        this._userSwitchedDrawerTab = true;
      }
      this.drawerTab = tab;
      if (opts && opts.ensureVisible !== false) {
        this.setPanelVisible(true, { skipRender: true });
      }
      if (this.container) {
        this.container.querySelectorAll('[data-cl-drawertab]').forEach(b => {
          const active = b.dataset.clDrawertab === this.drawerTab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
          b.setAttribute('tabindex', active ? '0' : '-1');
          if (active && typeof b.scrollIntoView === 'function') {
            try {
              const scrollOpts = { block: 'nearest', inline: 'nearest', container: 'nearest' };
              b['scrollIntoView'](scrollOpts);
            } catch (err) {
              void err;
            }
          }
        });
        const termActions = this.container.querySelector('#cl-drawer-term-actions');
        if (termActions && termActions.style) {
          const showTermActions = this.drawerTab === 'terminal' && !this._isSingleFileSqlMode();
          termActions.style.display = showTermActions ? 'inline-flex' : 'none';
        }
        const drawer = this.container.querySelector('#cl-drawer');
        if (drawer) drawer.classList.remove('is-minimized');
      }
      this._renderDrawerBody();
      if (opts && opts.focus && this.drawerTab === 'terminal' && this.container) {
        const termInput = this.container.querySelector('#cl-repl-input');
        if (termInput && typeof termInput.focus === 'function') termInput.focus();
      }
      if (!opts || (!opts.fromConfig && !opts.skipSave)) {
        this._saveState();
      }
    }

    setPanelVisible(visible, opts = {}) {
      const next = Boolean(visible);
      this.panelVisible = next;
      this.drawerCollapsed = !next;
      if (!next) {
        this.panelMaximized = false;
      }
      if (this.container) {
        const shell = this.container.querySelector('.codelab');
        if (shell && shell.classList) {
          shell.classList.toggle('panel-collapsed', !next);
          if (!next) shell.classList.remove('panel-maximized');
        }
        const drawer = this.container.querySelector('#cl-drawer');
        if (drawer && drawer.classList) {
          drawer.classList.toggle('is-minimized', !next);
        }
        const toggleBtn = this.container.querySelector('#cl-toggle-drawer-btn');
        if (toggleBtn) {
          toggleBtn.classList.toggle('active', next);
          toggleBtn.setAttribute('aria-pressed', String(next));
        }
      }
      if (this.editor && typeof this.editor.layout === 'function') {
        this.editor.layout();
        setTimeout(() => {
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        }, 50);
      }
      if (!opts || !opts.skipRender) {
        if (next) this._renderDrawerBody();
        this._saveState();
      }
      return this.panelVisible;
    }

    togglePanel() {
      return this.setPanelVisible(!this.panelVisible);
    }

    toggleDrawer() {
      return this.togglePanel();
    }

    setPanelMaximized(maximized) {
      const next = Boolean(maximized);
      if (next && !this.panelVisible) {
        this.setPanelVisible(true, { skipRender: true });
      }
      this.panelMaximized = next;
      if (this.container) {
        const shell = this.container.querySelector('.codelab');
        if (shell && shell.classList) {
          shell.classList.toggle('panel-maximized', next);
        }
        const maxBtn = this.container.querySelector('#cl-maximize-drawer-btn');
        if (maxBtn) {
          maxBtn.setAttribute('aria-pressed', String(next));
          maxBtn.innerHTML = next ? CL_ICONS.chevronDown : CL_ICONS.chevronUp;
        }
      }
      if (this.editor && typeof this.editor.layout === 'function') {
        this.editor.layout();
        setTimeout(() => {
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        }, 50);
      }
      this._saveState();
      return this.panelMaximized;
    }

    toggleTerminal() {
      if (this.panelVisible && this.drawerTab === 'terminal') {
        this.setPanelVisible(false);
        if (this.editor && typeof this.editor.focus === 'function' && this.activeTab !== '__settings__') {
          this.editor.focus();
        }
        return false;
      }
      this.switchDrawerTab('terminal', { ensureVisible: true, focus: true });
      return true;
    }

    // ── M3: Virtual port listeners, toast notifications & dual Web Preview ────

    _initPortListeners() {
      if (!this.portTable || typeof this.portTable.on !== 'function' || this._portListenersBound) return;
      this._portListenersBound = true;
      this._portListenerUnsubs = [];
      try {
        this._portListenerUnsubs.push(this.portTable.on('listen', (entry) => {
          this._updatePortsPill();
          if (this.drawerTab === 'ports') this._renderDrawerBody();
          if (entry && entry.port !== undefined) this._showPortToast(entry);
        }));
        this._portListenerUnsubs.push(this.portTable.on('close', (port) => {
          this._updatePortsPill();
          if (this.drawerTab === 'ports') this._renderDrawerBody();
          this._dismissPortToast(port);
        }));
        this._portListenerUnsubs.push(this.portTable.on('chaos', () => {
          if (this.drawerTab === 'ports' || this.drawerTab === 'network') this._renderDrawerBody();
        }));
      } catch (err) {
        this.logger.warn('Failed to attach portTable event listeners.', err);
      }
    }

    _updatePortsPill() {
      const pill = this.container ? this.container.querySelector('#cl-ports-pill') : null;
      if (!pill) return;
      const count = (this.portTable && typeof this.portTable.listServers === 'function')
        ? this.portTable.listServers().length
        : 0;
      pill.textContent = `${count} open`;
    }

    _showPortToast(entry) {
      const toastHost = this.container ? this.container.querySelector('#cl-toast-container') : null;
      if (!toastHost) return;
      const port = Number(entry.port);
      this._dismissPortToast(port);
      const toast = document.createElement('div');
      toast.className = 'codelab-toast codelab-toast--port';
      toast.setAttribute('data-cl-port', String(port));
      toast.innerHTML = `
        <div class="codelab-toast__icon">${CL_ICONS.radio || ''}</div>
        <div class="codelab-toast__body">
          <div class="codelab-toast__title">Server listening on port ${port}</div>
          <div class="codelab-toast__meta">${escapeHtml(entry.name || 'http-server')} · http://127.0.0.1:${port}/</div>
          <div class="codelab-toast__actions">
            <button type="button" class="codelab-btn codelab-btn--primary codelab-btn--sm" data-cl-action="open-web-preview" data-port="${port}">Open Web Preview</button>
          </div>
        </div>
        <button type="button" class="codelab-toast__close" data-cl-action="dismiss-toast" data-port="${port}" aria-label="Dismiss notification">${CL_ICONS.x || '×'}</button>
      `;
      toastHost.appendChild(toast);
      const timer = setTimeout(() => this._dismissPortToast(port), 8000);
      this._portToasts.set(port, { toast, timer });
    }

    _dismissPortToast(port) {
      const p = Number(port);
      const rec = this._portToasts.get(p);
      if (!rec) return;
      if (rec.timer) clearTimeout(rec.timer);
      if (rec.toast && typeof rec.toast.remove === 'function') rec.toast.remove();
      else if (rec.toast && rec.toast.parentNode) rec.toast.parentNode.removeChild(rec.toast);
      this._portToasts.delete(p);
    }

    _showToast(message, kind = 'info') {
      const toastHost = this.container ? this.container.querySelector('#cl-toast-container') : null;
      if (!toastHost || typeof document === 'undefined') return;
      const toast = document.createElement('div');
      toast.className = `codelab-toast codelab-toast--${kind === 'error' ? 'error' : 'info'}`;
      const icon = kind === 'error' ? (CL_ICONS.x || '⚠') : (CL_ICONS.externalLink || CL_ICONS.radio || '');
      toast.innerHTML = `
        <div class="codelab-toast__icon">${icon}</div>
        <div class="codelab-toast__body">
          <div class="codelab-toast__meta">${escapeHtml(message)}</div>
        </div>
        <button type="button" class="codelab-toast__close" aria-label="Dismiss notification">${CL_ICONS.x || '×'}</button>
      `;
      const closeBtn = toast.querySelector('.codelab-toast__close');
      const remove = () => {
        if (typeof toast.remove === 'function') toast.remove();
        else if (toast.parentNode) toast.parentNode.removeChild(toast);
      };
      if (closeBtn) closeBtn.addEventListener('click', remove);
      toastHost.appendChild(toast);
      setTimeout(remove, 5000);
    }

    _registerPreviewServiceWorker() {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof navigator.serviceWorker.register !== 'function') return;
      try {
        const onMessage = (event) => this._handleServiceWorkerMessage(event);
        this._swMessageHandler = onMessage;
        if (typeof navigator.serviceWorker.addEventListener === 'function') {
          navigator.serviceWorker.addEventListener('message', onMessage);
        } else {
          navigator.serviceWorker.onmessage = onMessage;
        }
        if (this.options && (this.options.previewSwUrl === false || this.options.previewSw === false)) {
          this._previewSwReady = false;
          return;
        }
        const explicitSwUrl = this.options && typeof this.options.previewSwUrl === 'string' && this.options.previewSwUrl.trim()
          ? this.options.previewSwUrl.trim()
          : '';
        const pathname = (typeof location !== 'undefined' && location && typeof location.pathname === 'string')
          ? location.pathname
          : '/';
        if (!explicitSwUrl && !(this.options && this.options.useServiceWorkerForIframe === true) && /^\/(apps|tests)\//.test(pathname)) {
          this._previewSwReady = false;
          return;
        }
        const url = explicitSwUrl || '/preview-sw.js';
        const scope = (this.options && this.options.previewSwScope) || (explicitSwUrl ? './' : '/');
        navigator.serviceWorker.register(url, { scope })
          .then((reg) => {
            this._previewSwRegistration = reg;
            this._previewSwReady = true;
            this._pushPreviewCsp(reg);
          })
          .catch((err) => {
            this._previewSwReady = false;
            this.logger.warn('Preview service worker registration failed; using the srcdoc fallback.', err);
          });
      } catch (err) {
        this._previewSwReady = false;
        this.logger.warn('Preview service worker is unavailable in this context.', err);
      }
    }

    /**
     * The service worker cannot read workbench options, so the resolved policy
     * is pushed to it. Without this, `previewCsp: 'strict'` would only change
     * the srcdoc fallback and silently not the served previews.
     */
    _pushPreviewCsp(registration) {
      const policy = this._previewPolicy();
      const send = (worker) => {
        if (!worker || typeof worker.postMessage !== 'function') return;
        try {
          worker.postMessage({ type: 'codelab:config', csp: policy });
        } catch (err) {
          this.logger.warn('Could not deliver the preview CSP to the service worker.', err);
        }
      };

      if (registration) {
        send(registration.active);
        send(registration.installing);
        send(registration.waiting);
      }

      const sw = (typeof navigator !== 'undefined' && navigator.serviceWorker) ? navigator.serviceWorker : null;
      if (sw && sw.ready && typeof sw.ready.then === 'function') {
        sw.ready
          .then((readyReg) => { if (readyReg) send(readyReg.active); })
          .catch((err) => this.logger.warn('Preview service worker never became ready.', err));
      }
    }

    _handleServiceWorkerMessage(event) {
      const data = event && event.data;
      if (!data || data.type !== 'CODELAB_SW_DISPATCH') return;
      const replyPort = event.ports && event.ports[0];
      if (!replyPort) return;
      this._dispatchPreviewRequest(data)
        .then((res) => replyPort.postMessage(res))
        .catch((err) => replyPort.postMessage({
          status: 500,
          statusText: 'Workbench Error',
          headers: { 'Content-Type': 'text/plain' },
          body: `Virtual dispatch failed: ${String((err && err.message) || err)}`
        }));
    }

    async _dispatchPreviewRequest({ port, url, method = 'GET', headers = {}, body = null }) {
      const targetUrl = url || `http://127.0.0.1:${port}/`;
      const init = { method, headers: headers || {} };
      if (body !== null && body !== undefined && !['GET', 'HEAD'].includes(String(method).toUpperCase())) {
        init.body = body;
      }
      const res = await this.portTable.dispatchRequest(targetUrl, init);
      const outHeaders = {};
      try {
        if (res && res.headers && typeof res.headers.forEach === 'function') {
          res.headers.forEach((v, k) => { outHeaders[k] = v; });
        } else if (res && res.headers) {
          Object.assign(outHeaders, res.headers);
        }
      } catch (err) {
        this.logger.debug('Could not copy response headers in _dispatchPreviewRequest.', err);
      }
      let bodyText = '';
      try {
        bodyText = res && typeof res.text === 'function' ? await res.text() : String((res && res.body) || '');
      } catch (err) {
        this.logger.debug('Could not read response body in _dispatchPreviewRequest.', err);
      }
      return {
        status: (res && res.status) || 200,
        statusText: (res && res.statusText) || 'OK',
        headers: outHeaders,
        body: bodyText
      };
    }

    _firstListeningPort() {
      const servers = (this.portTable && typeof this.portTable.listServers === 'function')
        ? this.portTable.listServers()
        : [];
      return servers.length ? Number(servers[0].port) : null;
    }

    _previewUrl() {
      const st = this.previewState;
      const port = st.port || this._firstListeningPort() || 3000;
      const path = st.path && st.path.startsWith('/') ? st.path : '/' + (st.path || '');
      return `http://127.0.0.1:${port}${path}`;
    }

    _previewFrameUrl(port, pathAndQuery = '/') {
      const p = Number(port) || 3000;
      const rawPath = pathAndQuery || '/';
      const path = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
      // Same-origin loopback by default. `previewOrigin` is only honoured once a
      // relay exists on that origin; pretending otherwise yields a 503.
      const base = (PREVIEW_RELAY_AVAILABLE && this.previewOrigin) ? this.previewOrigin : '';
      return `${base}/__preview/${p}${path}`;
    }

    /** Resolved CSP for preview documents served by this workbench. */
    _previewPolicy() {
      const origin = (typeof location !== 'undefined' && location && location.origin) ? location.origin : '';
      if (!PreviewCsp || typeof PreviewCsp.buildPreviewPolicy !== 'function') {
        return "default-src 'self'; object-src 'none'";
      }
      return PreviewCsp.buildPreviewPolicy(
        Object.assign({ hostOrigin: origin }, this.previewCsp.allow, { mode: this.previewCsp.mode })
      );
    }

    /** Remote origins the current policy allows, for the preview toolbar. */
    _previewNetworkHosts() {
      if (!PreviewCsp || typeof PreviewCsp.describePreviewNetwork !== 'function') return [];
      return PreviewCsp.describePreviewNetwork(this.previewCsp);
    }

    _warnPreviewIsolation() {
      if (!this.previewOrigin || this._previewIsolationWarned) return;
      this._previewIsolationWarned = true;
      if (PREVIEW_RELAY_AVAILABLE) return;
      this.logger.warn(
        '`previewOrigin` was ignored: cross-origin previews need the preview relay ' +
        '(apps/preview-origin), which has not shipped yet. Previews run sandboxed on ' +
        'the host origin: no host DOM, no host storage.'
      );
    }

    _injectPreviewCsp(html, port) {
      if (typeof html !== 'string' || !html) return html;

      const escapeAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rawPolicy = String(this._previewPolicy() || '');
      // W3C CSP3 §6.5.1: frame-ancestors, report-uri, and sandbox are ignored in <meta>
      // and trigger browser console errors if placed inside <meta content="...">.
      const metaPolicy = rawPolicy
        .split(';')
        .map((dir) => dir.trim())
        .filter((dir) => dir && !/^(frame-ancestors|report-uri|sandbox)\b/i.test(dir))
        .join('; ');
      const escapedMetaCsp = escapeAttr(metaPolicy);
      const escapedHttpCsp = escapeAttr(rawPolicy);
      const tags = [];
      if (!/<meta[^>]+http-equiv=["']?content-security-policy/i.test(html)) {
        tags.push(`<meta http-equiv="Content-Security-Policy" content="${escapedMetaCsp}" data-codelab-http-policy="${escapedHttpCsp}">`);
      }
      if (!/<base\b/i.test(html)) {
        tags.push(`<base href="/__preview/${Number(port) || 3000}/">`);
      }
      if (html.indexOf('data-codelab-preview-shims') === -1 &&
          PreviewCsp && typeof PreviewCsp.buildPreviewShims === 'function') {
        tags.push(PreviewCsp.buildPreviewShims());
      }
      if (tags.length === 0) return html;

      const injection = tags.join('');
      if (/<head\b[^>]*>/i.test(html)) {
        return html.replace(/<head\b[^>]*>/i, (match) => match + injection);
      }
      if (/<html\b[^>]*>/i.test(html)) {
        return html.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
      }
      return `<head>${injection}</head>${html}`;
    }

    /**
     * Preview documents are sandboxed (opaque origin), so `event.origin` is the
     * string `"null"` and cannot be used to authenticate the sender. Match the
     * message source against the preview frame instead.
     */
    _installPreviewViolationListener() {
      if (this._previewViolationHandler) return;
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

      this._previewViolationHandler = (event) => {
        const data = event && event.data;
        if (!data || typeof data.type !== 'string') return;
        const iframe = this.container ? this.container.querySelector('#cl-preview-iframe') : null;
        if (!iframe) return;
        // `contentWindow` is unavailable on the mock DOM used by unit tests.
        if (iframe.contentWindow && event.source !== iframe.contentWindow) return;

        if (data.type === 'codelab:preview-violation') {
          this._reportPreviewViolation(data);
        } else if (data.type === 'codelab:preview-console') {
          const level = ['log', 'warn', 'error', 'info'].includes(data.level) ? data.level : 'log';
          const args = Array.isArray(data.args) ? data.args : [data.args];
          const text = args.map((a) => String(a ?? '')).join(' ');
          this._pushTerminalLog({
            type: level === 'error' ? 'stderr' : 'stdout',
            text: `[Preview ${level.toUpperCase()}] ${text}`
          });
          if (!Array.isArray(this.previewState.consoleLogs)) this.previewState.consoleLogs = [];
          this.previewState.consoleLogs.push({ level, text, timestamp: new Date().toLocaleTimeString() });
          if (this.previewState.consoleLogs.length > 200) this.previewState.consoleLogs.shift();
          this._updatePreviewConsoleUI();
          this._emitEvent('preview-console', { level, text, args });
        } else if (data.type === 'codelab:preview-error') {
          const msg = String(data.message || 'Uncaught runtime error');
          this.previewState.runtimeError = {
            message: msg,
            file: data.file ? String(data.file) : null,
            line: typeof data.line === 'number' ? data.line : null,
            col: typeof data.col === 'number' ? data.col : null,
            stack: data.stack ? String(data.stack) : null
          };
          this._pushTerminalLog({
            type: 'stderr',
            text: `[Preview ERROR] ${msg}${data.stack ? '\n' + String(data.stack) : ''}`
          });
          if (!Array.isArray(this.previewState.consoleLogs)) this.previewState.consoleLogs = [];
          this.previewState.consoleLogs.push({
            level: 'error',
            text: `${msg}${data.stack ? '\n' + String(data.stack) : ''}`,
            timestamp: new Date().toLocaleTimeString()
          });
          this._updatePreviewConsoleUI();
          this._emitEvent('preview-error', this.previewState.runtimeError);
        } else if (data.type === 'codelab:preview-error-clear') {
          this.previewState.runtimeError = null;
        } else if (data.type === 'codelab:preview-fetch') {
          const reqId = data.reqId || data.id;
          const targetPort = Number(data.port) || this.previewState.port || this._firstListeningPort() || 3000;
          const reqPath = data.path ? (String(data.path).startsWith('/') ? String(data.path) : '/' + String(data.path)) : '/';
          const targetUrl = String(data.url || `http://127.0.0.1:${targetPort}${reqPath}`);
          this._dispatchPreviewRequest({
            port: targetPort,
            url: targetUrl,
            method: data.method || 'GET',
            headers: data.headers || {},
            body: data.body !== undefined ? data.body : null
          })
            .then((res) => {
              const netPill = this.container ? this.container.querySelector('#cl-network-pill') : null;
              if (netPill) netPill.textContent = `${(this.lastHttpTrace || []).length} reqs`;
              if (this.drawerTab === 'network') this._renderDrawerBody();
              if (iframe && iframe.contentWindow && typeof iframe.contentWindow.postMessage === 'function') {
                iframe.contentWindow.postMessage({
                  type: 'codelab:preview-fetch-res',
                  reqId,
                  id: reqId,
                  status: res.status || 200,
                  statusText: res.statusText || 'OK',
                  headers: res.headers || {},
                  body: res.body || ''
                }, '*');
              }
            })
            .catch((err) => {
              if (iframe && iframe.contentWindow && typeof iframe.contentWindow.postMessage === 'function') {
                iframe.contentWindow.postMessage({
                  type: 'codelab:preview-fetch-res',
                  reqId,
                  id: reqId,
                  error: String((err && err.message) || err)
                }, '*');
              }
            });
        } else if (data.type === 'codelab:preview-navigate') {
          const navHref = data.href || (data.path ? (data.port ? `http://127.0.0.1:${data.port}${data.path}` : String(data.path)) : '');
          if (navHref) {
            this._previewGo(String(navHref));
          }
        } else if (data.type === 'codelab:preview-url-change') {
          if (data.path && typeof data.path === 'string') {
            this.previewState.path = data.path.startsWith('/') ? data.path : '/' + data.path;
            this.previewState.url = this._previewUrl();
            const input = this.container ? this.container.querySelector('#cl-preview-url-input') : null;
            if (input) input.value = this.previewState.url;
          }
        }
      };
      window.addEventListener('message', this._previewViolationHandler);
    }

    _reportPreviewViolation(violation) {
      const blockedURI = String((violation && violation.blockedURI) || 'unknown');
      const directive = String((violation && violation.directive) || '');
      const key = `${directive}|${blockedURI}`;
      const state = this.previewState;
      state.violations = state.violations || [];
      if (state.violations.length < 20 && !state.violations.some((v) => v.key === key)) {
        state.violations.push({ key, directive, blockedURI });
        this._showToast(`Blocked by Content-Security-Policy: ${this._shortPreviewUrl(blockedURI)}`, 'error');
        this._emitEvent('preview-violation', { directive, blockedURI, violations: state.violations.slice() });
      }
      this._updatePreviewCspStatus();
    }

    _shortPreviewUrl(raw) {
      const value = String(raw || '');
      try {
        const parsed = new URL(value);
        const path = parsed.pathname.length > 32 ? `${parsed.pathname.slice(0, 32)}…` : parsed.pathname;
        return `${parsed.host}${path === '/' ? '' : path}`;
      } catch (_) {
        // Not a URL (e.g. "inline" or "eval"); show it verbatim, truncated.
        return value.length > 48 ? `${value.slice(0, 48)}…` : value;
      }
    }

    /** Update (or create) the CSP status chip in the preview toolbar. */
    _updatePreviewCspStatus() {
      if (!this.container) return;
      const chip = this.container.querySelector('#cl-preview-csp-status');
      if (!chip) return;
      const violations = (this.previewState && this.previewState.violations) || [];
      if (!violations.length) {
        chip.hidden = true;
        chip.textContent = '';
        chip.removeAttribute('title');
        return;
      }
      const last = violations[violations.length - 1];
      chip.hidden = false;
      chip.textContent = `Blocked: ${this._shortPreviewUrl(last.blockedURI)}`;
      chip.title = violations
        .map((v) => `${v.directive} → ${v.blockedURI}`)
        .join('\n');
    }

    _openWebPreview(port, path = '/') {
      const p = Number(port) || this._firstListeningPort() || 3000;
      this._warnPreviewIsolation();
      this._installPreviewViolationListener();
      this.previewState.port = p;
      this.previewState.path = path || '/';
      this.previewState.url = `http://127.0.0.1:${p}${this.previewState.path}`;
      this.previewState.error = null;
      this.previewState.violations = [];
      this.previewHistory = this.previewHistory.slice(0, this.previewHistoryIdx + 1);
      this.previewHistory.push(this.previewState.url);
      this.previewHistoryIdx = this.previewHistory.length - 1;
      if (this.previewState.dockMode === 'split') {
        const splitHost = this.container ? this.container.querySelector('#cl-preview-split') : null;
        if (splitHost) this._renderWebPreview(splitHost);
      } else {
        this.switchDrawerTab('preview');
      }
      return this._previewLoadPromise || Promise.resolve();
    }

    // One-click "run the app in a browser": if nothing is listening yet, start the
    // built-in preview server (which transpiles TS/JSX to browser-native ESM and
    // resolves bare imports via jsDelivr) and then open the Web Preview.
    async previewApp() {
      const existing = this._firstListeningPort();
      if (existing) {
        this._openWebPreview(existing);
        return existing;
      }

      const htmlCandidates = ['public/index.html', 'index.html', 'site/index.html', 'src/index.html'];
      if (!htmlCandidates.some((f) => this.files && this.files[f])) {
        this.drawerTab = 'terminal';
        this._pushTerminalLog({
          type: 'system',
          text: '\nNo index.html found. Add an `index.html` (or run `serve <dir>` in the terminal) to preview your app.'
        });
        this._renderDrawerBody();
        return null;
      }

      const hasSrcScripts = Boolean(this.files && Object.keys(this.files).some((f) => /^src\/.+\.(?:[cm]?jsx?|tsx?)$/i.test(f)));
      const rootDir = this.files['index.html'] ? '/workspace'
        : (this.files['public/index.html'] && !hasSrcScripts) ? '/workspace/public'
        : this.files['site/index.html'] ? '/workspace/site'
        : '/workspace';

      if (!this.shell || typeof this.shell.execute !== 'function') return null;
      this._syncFilesToShellVfs();
      this.shell.cwd = this.cwd || '/workspace';
      this.drawerTab = 'terminal';
      this._pushTerminalLog({ type: 'system', text: `\n$ serve ${rootDir}` });
      this._renderDrawerBody();

      try {
        const res = await this.shell.execute(`serve ${rootDir}`, {});
        if (res && res.stdout) this._pushTerminalLog({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
        if (res && res.stderr) this._pushTerminalLog({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
      } catch (err) {
        this._pushTerminalLog({ type: 'stderr', text: String((err && err.message) || err) });
      }
      this._renderDrawerBody();

      const port = this._firstListeningPort();
      if (port) {
        this._openWebPreview(port);
        return port;
      }
      return null;
    }

    _previewGo(urlOrPath) {
      let url = String(urlOrPath || '').trim();
      if (!url) return Promise.resolve();

      const loopbackPort = this.previewState.port || this._firstListeningPort() || 3000;
      const localHostRe = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/.*)?$/i;

      // Normalize the input into an absolute URL.
      if (!/^https?:\/\//i.test(url)) {
        if (localHostRe.test(url)) {
          url = `http://${url}`;
        } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#].*)?$/i.test(url)) {
          // Bare public domain, e.g. "google.com" or "example.com/path".
          url = `https://${url}`;
        } else {
          url = `http://127.0.0.1:${loopbackPort}${url.startsWith('/') ? '' : '/'}${url}`;
        }
      }

      // Public (non-loopback) URLs cannot be served by the virtual loopback Service
      // Worker, so open them in a real browser tab instead of the in-browser frame.
      let isExternal = false;
      try {
        const u = new URL(url);
        const host = (u.hostname || '').toLowerCase();
        isExternal = !(host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host === '[::1]');
      } catch (_) { isExternal = false; }

      if (isExternal) {
        let opened = false;
        if (typeof window !== 'undefined' && typeof window.open === 'function') {
          try {
            const win = window.open(url, '_blank');
            if (win) {
              try { win.opener = null; } catch (err) { this.logger.debug('Could not clear win.opener.', err); }
              opened = true;
            }
          } catch (_) { opened = false; }
        }
        if (typeof this._showToast === 'function') {
          this._showToast(
            opened ? `Opened ${url} in a new tab` : `Could not open ${url} — allow pop-ups and try again`,
            opened ? 'info' : 'error'
          );
        }
        const inputEl = this.container.querySelector('#cl-preview-url-input');
        if (inputEl) inputEl.value = this.previewState.url || inputEl.value;
        return Promise.resolve();
      }

      let port = this.previewState.port;
      let path = '/';
      try {
        const u = new URL(url);
        port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
        path = u.pathname + (u.search || '') + (u.hash || '');
      } catch (err) {
        this.logger.debug('Failed to parse preview URL; using fallback port/path.', err);
      }
      this.previewState.port = port;
      this.previewState.path = path;
      this.previewState.url = url;
      this.previewState.error = null;
      this.previewHistory = this.previewHistory.slice(0, this.previewHistoryIdx + 1);
      this.previewHistory.push(url);
      this.previewHistoryIdx = this.previewHistory.length - 1;
      if (this.previewState.dockMode === 'split') {
        const splitHost = this.container ? this.container.querySelector('#cl-preview-split') : null;
        if (splitHost) this._renderWebPreview(splitHost);
      } else {
        this.switchDrawerTab('preview');
      }
      return this._previewLoadPromise || Promise.resolve();
    }

    _previewBack() {
      if (this.previewHistoryIdx <= 0) return;
      this.previewHistoryIdx -= 1;
      this._applyPreviewHistory();
    }

    _previewForward() {
      if (this.previewHistoryIdx >= this.previewHistory.length - 1) return;
      this.previewHistoryIdx += 1;
      this._applyPreviewHistory();
    }

    _applyPreviewHistory() {
      const url = this.previewHistory[this.previewHistoryIdx];
      if (!url) return;
      this.previewState.url = url;
      try {
        const u = new URL(url);
        this.previewState.port = Number(u.port || 80);
        this.previewState.path = u.pathname + (u.search || '');
      } catch (err) {
        this.logger.debug('Failed to parse preview history URL.', err);
      }
      const input = this.container.querySelector('#cl-preview-url-input');
      if (input) input.value = url;
      this._renderWebPreviewControls();
      return this._loadPreviewFrame();
    }

    _previewReload() {
      return this._loadPreviewFrame();
    }

    _previewSetFrameMode(mode) {
      if (!['desktop', 'tablet', 'mobile'].includes(mode)) return;
      this.previewState.frameMode = mode;
      this._renderDrawerBody();
      if (this.previewState.dockMode === 'split') {
        const splitHost = this.container ? this.container.querySelector('#cl-preview-split') : null;
        if (splitHost) this._renderWebPreview(splitHost);
      }
    }

    _togglePreviewDock() {
      this.previewState.dockMode = this.previewState.dockMode === 'split' ? 'bottom' : 'split';
      this._previewRenderKey = null;
      const ws = this.container ? this.container.querySelector('.codelab-workspace') : null;
      const splitHost = this.container ? this.container.querySelector('#cl-preview-split') : null;
      const splitBar = this.container ? this.container.querySelector('#cl-splitter-preview') : null;
      if (this.previewState.dockMode === 'split') {
        if (ws) ws.classList.add('has-preview-split');
        if (splitBar) splitBar.style.display = 'block';
        if (splitHost) {
          splitHost.style.display = 'flex';
          this._renderWebPreview(splitHost);
        }
        if (this.drawerTab === 'preview') {
          this.switchDrawerTab('terminal');
        } else {
          this._renderDrawerBody();
        }
      } else {
        if (ws) ws.classList.remove('has-preview-split');
        if (splitBar) splitBar.style.display = 'none';
        if (splitHost) {
          splitHost.style.display = 'none';
          splitHost.innerHTML = '';
        }
        this.switchDrawerTab('preview');
      }
      if (this.editor && typeof this.editor.layout === 'function') {
        setTimeout(() => {
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        }, 30);
      }
    }

    _togglePreviewMaximize() {
      this.previewState.maximized = !this.previewState.maximized;
      const previewEl = this.container ? this.container.querySelector('.codelab-preview') : null;
      if (previewEl) {
        previewEl.classList.toggle('is-maximized', Boolean(this.previewState.maximized));
      }
      const maxBtn = this.container ? this.container.querySelector('[data-cl-action="preview-maximize"]') : null;
      if (maxBtn) {
        maxBtn.classList.toggle('active', Boolean(this.previewState.maximized));
      }
    }

    _togglePreviewConsole() {
      this.previewState.consoleOpen = !this.previewState.consoleOpen;
      this._updatePreviewConsoleUI();
    }

    _clearPreviewConsole() {
      this.previewState.consoleLogs = [];
      this._updatePreviewConsoleUI();
    }

    _updatePreviewConsoleUI() {
      if (!this.container) return;
      const consoleDrawer = this.container.querySelector('#cl-preview-console');
      const consoleBody = this.container.querySelector('#cl-preview-console-body');
      const consolePill = this.container.querySelector('#cl-preview-console-pill');
      const consoleBtn = this.container.querySelector('[data-cl-action="preview-console-toggle"]');
      const logs = Array.isArray(this.previewState.consoleLogs) ? this.previewState.consoleLogs : [];
      if (consolePill) {
        consolePill.textContent = String(logs.length);
      }
      if (consoleBtn) {
        consoleBtn.classList.toggle('active', Boolean(this.previewState.consoleOpen));
      }
      if (consoleDrawer) {
        consoleDrawer.style.display = this.previewState.consoleOpen ? 'flex' : 'none';
      }
      if (consoleBody) {
        if (logs.length === 0) {
          consoleBody.innerHTML = `<div class="codelab-preview-console__empty">No console output from preview frame yet.</div>`;
        } else {
          consoleBody.innerHTML = logs.map((entry) => `
            <div class="codelab-preview-console__row codelab-preview-console__row--${escapeHtml(entry.level || 'log')}">
              <span class="codelab-preview-console__time">${escapeHtml(entry.timestamp || '')}</span>
              <span class="codelab-preview-console__text">${escapeHtml(entry.text || '')}</span>
            </div>
          `).join('');
          consoleBody.scrollTop = consoleBody.scrollHeight;
        }
      }
    }

    _renderWebPreviewControls() {
      const viewport = this.container.querySelector('#cl-preview-viewport');
      if (viewport) {
        viewport.className = `codelab-preview-viewport codelab-preview-viewport--${this.previewState.frameMode}`;
      }
      const backBtn = this.container.querySelector('[data-cl-action="preview-back"]');
      if (backBtn) backBtn.disabled = this.previewHistoryIdx <= 0;
      const fwdBtn = this.container.querySelector('[data-cl-action="preview-forward"]');
      if (fwdBtn) fwdBtn.disabled = this.previewHistoryIdx >= this.previewHistory.length - 1;
      this._updatePreviewConsoleUI();
    }

    _popoutPreview() {
      const url = this._previewUrl();
      let popout = this._previewFrameUrl(this.previewState.port || 3000, '/');
      try {
        const u = new URL(url);
        popout = this._previewFrameUrl(u.port, `${u.pathname}${u.search || ''}`);
      } catch (err) {
        this.logger.debug('Failed to parse popout preview URL.', err);
      }
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        try { window.open(popout, '_blank', 'noopener'); } catch (err) { this.logger.warn('window.open failed for preview popout.', err); }
      }
      return popout;
    }

    _renderWebPreview(bodyEl) {
      if (!bodyEl) return;
      this._warnPreviewIsolation();
      const splitHost = this.container ? this.container.querySelector('#cl-preview-split') : null;
      const splitBar = this.container ? this.container.querySelector('#cl-splitter-preview') : null;
      const ws = this.container ? this.container.querySelector('.codelab-workspace') : null;

      let targetHost = bodyEl;
      if (this.previewState.dockMode === 'split' && splitHost) {
        if (ws) ws.classList.add('has-preview-split');
        if (splitBar) splitBar.style.display = 'block';
        splitHost.style.display = 'flex';
        if (bodyEl !== splitHost) {
          bodyEl.innerHTML = `
            <div class="codelab-preview-split-notice">
              <span>Web Preview is docked to the right split pane.</span>
              <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="preview-dock-toggle">Dock to Bottom Drawer</button>
            </div>
          `;
        }
        targetHost = splitHost;
      } else {
        if (ws) ws.classList.remove('has-preview-split');
        if (splitBar) splitBar.style.display = 'none';
        if (splitHost && bodyEl !== splitHost) {
          splitHost.style.display = 'none';
          splitHost.innerHTML = '';
        }
      }

      const renderKey = `${this.previewState.port}|${this.previewState.path}|${this.previewState.frameMode}|${this.previewState.dockMode}|${this._previewSwReady}`;
      if (targetHost.querySelector && targetHost.querySelector('.codelab-preview') && this._previewRenderKey === renderKey) {
        this._renderWebPreviewControls();
        return;
      }
      this._previewRenderKey = renderKey;

      const servers = (this.portTable && typeof this.portTable.listServers === 'function')
        ? this.portTable.listServers()
        : [];
      if (!this.previewState.port) {
        this.previewState.port = servers.length ? Number(servers[0].port) : null;
      }
      this.previewState.url = this._previewUrl();

      const portOptions = servers.length
        ? servers.map(s => `<option value="${s.port}" ${Number(s.port) === Number(this.previewState.port) ? 'selected' : ''}>Port ${s.port} · ${escapeHtml(s.name || 'server')}</option>`).join('')
        : `<option value="${this.previewState.port || 3000}">Port ${this.previewState.port || 3000}</option>`;

      const cspMode = (this.previewCsp && this.previewCsp.mode) || 'balanced';
      const cspHosts = this._previewNetworkHosts();
      const cspBadge = cspMode === 'strict'
        ? 'CSP: strict'
        : !cspHosts.length
          ? 'CSP: custom'
          : cspHosts.length === 1
            ? `CSP: ${cspHosts[0]}`
            : `CSP: ${cspHosts[0]} +${cspHosts.length - 1}`;
      const cspBadgeTitle = cspMode === 'strict'
        ? 'Strict Content-Security-Policy: previews cannot reach any remote host.'
        : `Previews may load scripts, fonts and data from: ${cspHosts.join(', ') || 'no remote hosts'}. Use previewCsp: 'strict' to block remote hosts.`;

      const logsCount = Array.isArray(this.previewState.consoleLogs) ? this.previewState.consoleLogs.length : 0;
      const isSplit = this.previewState.dockMode === 'split';

      targetHost.innerHTML = `
        <div class="codelab-preview ${this.previewState.maximized ? 'is-maximized' : ''}">
          <div class="codelab-preview-chrome">
            <div class="codelab-preview-nav">
              <button type="button" class="codelab-preview-btn" data-cl-action="preview-back" title="Back" ${this.previewHistoryIdx <= 0 ? 'disabled' : ''}>${CL_ICONS.arrowLeft || '←'}</button>
              <button type="button" class="codelab-preview-btn" data-cl-action="preview-forward" title="Forward" ${this.previewHistoryIdx >= this.previewHistory.length - 1 ? 'disabled' : ''}>${CL_ICONS.arrowRight || '→'}</button>
              <button type="button" class="codelab-preview-btn" data-cl-action="preview-reload" title="Reload">${CL_ICONS.refresh || '⟳'}</button>
            </div>
            <select class="codelab-preview-port-select" data-cl-action="preview-port-change" aria-label="Preview port">${portOptions}</select>
            <input type="text" class="codelab-preview-url-input" id="cl-preview-url-input" value="${escapeHtml(this.previewState.url)}" placeholder="127.0.0.1:3000/ or https://example.com" aria-label="Preview URL" title="Localhost/virtual ports load in-frame; public URLs open in a new tab" />
            <div class="codelab-preview-modes">
              <button type="button" class="codelab-preview-btn ${this.previewState.frameMode === 'desktop' ? 'active' : ''}" data-cl-action="preview-mode" data-mode="desktop" title="Desktop">${CL_ICONS.monitor || '▭'}</button>
              <button type="button" class="codelab-preview-btn ${this.previewState.frameMode === 'tablet' ? 'active' : ''}" data-cl-action="preview-mode" data-mode="tablet" title="Tablet">${CL_ICONS.tablet || '▢'}</button>
              <button type="button" class="codelab-preview-btn ${this.previewState.frameMode === 'mobile' ? 'active' : ''}" data-cl-action="preview-mode" data-mode="mobile" title="Mobile">${CL_ICONS.smartphone || '▯'}</button>
            </div>
            <span class="codelab-preview-csp" id="cl-preview-csp-badge" title="${escapeHtml(cspBadgeTitle)}">${escapeHtml(cspBadge)}</span>
            <span class="codelab-preview-csp codelab-preview-csp--blocked" id="cl-preview-csp-status" role="status" hidden></span>
            <button type="button" class="codelab-preview-btn ${this.previewState.consoleOpen ? 'active' : ''}" data-cl-action="preview-console-toggle" title="Toggle Preview Console">
              ${CL_ICONS.terminal || '>_'} <span class="codelab-preview-console-pill" id="cl-preview-console-pill">${logsCount}</span>
            </button>
            <button type="button" class="codelab-preview-btn ${isSplit ? 'active' : ''}" data-cl-action="preview-dock-toggle" title="${isSplit ? 'Dock Preview to Bottom Drawer' : 'Dock Preview to Right Split Pane'}">
              ${CL_ICONS.layout || '◫'}
            </button>
            <button type="button" class="codelab-preview-btn ${this.previewState.maximized ? 'active' : ''}" data-cl-action="preview-maximize" title="Maximize / Restore Preview">
              ${CL_ICONS.maximize || '⛶'}
            </button>
            <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="preview-popout" title="Open in a new browser tab">${CL_ICONS.externalLink || '↗'} <span>Pop Out</span></button>
          </div>
          <div class="codelab-preview-viewport codelab-preview-viewport--${this.previewState.frameMode}" id="cl-preview-viewport">
            <iframe class="codelab-preview-iframe" id="cl-preview-iframe" sandbox="allow-scripts allow-forms allow-modals" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'" referrerpolicy="no-referrer-when-downgrade" title="Web Preview"></iframe>
          </div>
          <div class="codelab-preview-console" id="cl-preview-console" style="display:${this.previewState.consoleOpen ? 'flex' : 'none'}">
            <div class="codelab-preview-console__bar">
              <span>Preview Console</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="preview-console-clear">Clear</button>
                <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="preview-console-toggle">Close</button>
              </div>
            </div>
            <div class="codelab-preview-console__body" id="cl-preview-console-body"></div>
          </div>
          ${servers.length
            ? `<div class="codelab-preview-hint">Serving from the in-browser virtual runtime. Use Pop Out for a standalone tab.</div>`
            : `<div class="codelab-preview-empty">
                 <div class="codelab-preview-empty__icon">${CL_ICONS.globe || '🌐'}</div>
                 <div class="codelab-preview-empty__title">No server running</div>
                 <div class="codelab-preview-empty__text">Start the built-in preview server to render your <code>index.html</code>. TypeScript, TSX and JSX are transpiled for the browser automatically &mdash; no bundler required.</div>
                 <button type="button" class="codelab-btn codelab-btn--primary codelab-btn--sm" data-cl-action="preview-app">${CL_ICONS.play || '▶'} <span>Run &amp; Preview</span></button>
                 <div class="codelab-preview-empty__hint">or run <code>serve</code> in the terminal</div>
               </div>`}
        </div>
      `;
      this._updatePreviewCspStatus();
      this._updatePreviewConsoleUI();
      this._loadPreviewFrame();
    }

    _loadPreviewFrame() {
      this._previewLoadPromise = this._performPreviewLoad();
      return this._previewLoadPromise;
    }

    _performPreviewLoad() {
      const iframe = this.container.querySelector('#cl-preview-iframe');
      if (!iframe) return Promise.resolve();
      const port = this.previewState.port;
      if (!port) {
        this.previewState.error = 'No port selected';
        return Promise.resolve();
      }
      this._syncFilesToShellVfs();
      const fullUrl = this._previewUrl();
      this.previewState.loading = true;
      this.previewState.error = null;

      if (this.options && this.options.useServiceWorkerForIframe === true && this._previewSwReady) {
        try {
          const u = new URL(fullUrl);
          if (typeof iframe.removeAttribute === 'function') iframe.removeAttribute('srcdoc');
          iframe.setAttribute('src', this._previewFrameUrl(u.port, u.pathname + (u.search || '')));
          this.previewState.loading = false;
          return Promise.resolve();
        } catch (err) {
          this.logger.warn('Failed to set Service Worker preview URL; falling back to srcdoc.', err);
        }
      }

      // Direct virtual dispatch + srcdoc injection guarantees zero Service Worker
      // race conditions and 100% deterministic loading inside sandboxed iframes.
      return this._dispatchPreviewRequest({ port, url: fullUrl, method: 'GET' })
        .then((res) => {
          let body = res.body || '';
          const contentType = res.headers['content-type'] || res.headers['Content-Type'] || '';
          if (/text\/html/i.test(contentType)) {
            body = this._injectPreviewCsp(body, port);
          }
          this.previewState.srcdoc = body;
          this.previewState.loading = false;
          if (typeof iframe.removeAttribute === 'function') iframe.removeAttribute('src');
          iframe.setAttribute('srcdoc', body);
          return res;
        })
        .catch((err) => {
          this.previewState.loading = false;
          this.previewState.error = String((err && err.message) || err);
          const msg = `<body style="font-family:system-ui;padding:24px;color:#888"><h2>Preview unavailable</h2><p>${escapeHtml(this.previewState.error)}</p></body>`;
          iframe.setAttribute('srcdoc', this._injectPreviewCsp(msg, port));
        });
    }

    _syncVfsSnapshot(fsSnapshot, syncDeletionsFromShell = false, opts = {}) {
      let changed = false;
      const hiddenVfsSegRe = /(?:^|\/)(?:\.git|node_modules)(?:\/|$)/;
      const suppressAuto = Boolean(opts && opts.suppressAutoOpenTabs);

      // 1. Sync from this.shell.vfs if available
      if (this.shell && this.shell.vfs) {
        const shellWorkspaceFiles = new Map();
        const shellWorkspaceFolders = new Set();

        if (this.shell.vfs.files instanceof Map) {
          for (const [p, fileObj] of this.shell.vfs.files.entries()) {
            if (p.startsWith('/workspace/')) {
              const rel = p.slice('/workspace/'.length);
              if (rel && !hiddenVfsSegRe.test(rel)) {
                const content = typeof fileObj.data === 'string'
                  ? fileObj.data
                  : (fileObj.data ? (fileObj.data.toString ? fileObj.data.toString('utf8') : String(fileObj.data)) : '');
                shellWorkspaceFiles.set(rel, content);
              }
            }
          }
          if (this.shell.vfs.dirs instanceof Set) {
            for (const d of this.shell.vfs.dirs) {
              if (d.startsWith('/workspace/')) {
                const rel = d.slice('/workspace/'.length).replace(/\/+$/, '');
                if (rel && !hiddenVfsSegRe.test(rel)) {
                  shellWorkspaceFolders.add(rel);
                }
              }
            }
          }
        } else if (typeof this.shell.vfs.readdirSync === 'function') {
          const vfs = this.shell.vfs;
          const walk = (dir, relPrefix) => {
            let entries = [];
            try { entries = vfs.readdirSync(dir); } catch (_) { return; }
            for (const entry of entries) {
              const name = typeof entry === 'string' ? entry : (entry && entry.name);
              if (!name || name === '.git' || name === 'node_modules') continue;
              const full = dir === '/' ? '/' + name : dir + '/' + name;
              const rel = relPrefix ? relPrefix + '/' + name : name;
              if (hiddenVfsSegRe.test(rel)) continue;
              let isDir = false;
              try { isDir = vfs.statSync(full).isDirectory(); } catch (_) { isDir = false; }
              if (isDir) {
                shellWorkspaceFolders.add(rel);
                walk(full, rel);
              } else {
                try {
                  const content = String(vfs.readFileSync(full, 'utf8') ?? '');
                  shellWorkspaceFiles.set(rel, content);
                } catch (err) {
                  this.logger.debug(`Could not read VFS file "${full}" during snapshot sync.`, err);
                }
              }
            }
          };
          walk('/workspace', '');
        }

        for (const folder of shellWorkspaceFolders) {
          if (!this.folders.has(folder)) {
            this.folders.add(folder);
            if (this.kernel && this.kernel.fs && typeof this.kernel.fs.mkdir === 'function') {
              try { this.kernel.fs.mkdir('/workspace/' + folder); } catch (_e) { void _e; }
            }
            changed = true;
          }
        }

        // Additions & modifications
        const newlyAddedRels = [];
        for (const [rel] of shellWorkspaceFiles.entries()) {
          if (this.files[rel] === undefined) newlyAddedRels.push(rel);
        }
        const newFilesCount = newlyAddedRels.length;
        const autoOpenSingle = !suppressAuto && newFilesCount === 1 && Array.isArray(this.openTabs) && this.openTabs.length < 8;
        for (const [rel, content] of shellWorkspaceFiles.entries()) {
          if (this.files[rel] === undefined || this.files[rel] !== content) {
            this.files[rel] = content;
            if (this._savedSnapshot) {
              this._savedSnapshot[rel] = content;
            }
            if (this.kernel && this.kernel.fs && typeof this.kernel.fs.writeFile === 'function') {
              try {
                this.kernel.fs.writeFile('/workspace/' + rel, content);
              } catch (_e) {
                void _e;
              }
            }
            if (autoOpenSingle && !this.openTabs.includes(rel) && this.openTabs.length < 8) {
              this.openTabs.push(rel);
            }
            changed = true;
            const parts = rel.split('/');
            let cur = '';
            for (let i = 0; i < parts.length - 1; i++) {
              cur = cur ? `${cur}/${parts[i]}` : parts[i];
              this.folders.add(cur);
            }
            const model = this.models.get(rel);
            if (model && typeof model.getValue === 'function') {
              if (model.getValue() !== content) {
                model.setValue(content);
              }
            } else {
              this._getOrCreateModel(rel);
            }
            this._lintFile(rel);
          }
        }
        if (!suppressAuto && newlyAddedRels.length >= 1 && Array.isArray(this.openTabs)) {
          if (this.openTabs.length === 0) {
            const pick = this._pickPrimaryCloneFile(newlyAddedRels) || newlyAddedRels[0];
            if (pick) {
              this.openTabs.push(pick);
              this.activeFile = pick;
              this.activeTab = (this.settingsTabOpen && this.activeTab === '__settings__') ? '__settings__' : pick;
            }
          } else if (newFilesCount === 1 && !this.activeFile && this.openTabs.length > 0) {
            this.activeFile = this.openTabs[0];
            this.activeTab = (this.settingsTabOpen && this.activeTab === '__settings__') ? '__settings__' : this.activeFile;
          }
        }

        // Deletions
        if (syncDeletionsFromShell) {
          for (const rel of Object.keys(this.files)) {
            if (!shellWorkspaceFiles.has(rel)) {
              delete this.files[rel];
              if (this._dirtyFiles) this._dirtyFiles.delete(rel);
              if (this._savedSnapshot) delete this._savedSnapshot[rel];
              if (this.kernel && this.kernel.fs && typeof this.kernel.fs.deleteFile === 'function') {
                try { this.kernel.fs.deleteFile('/workspace/' + rel); } catch (_e) { void _e; }
              }
              this._clearDiagnosticsForPath(rel, false);
              changed = true;
              const model = this.models.get(rel);
              if (model) {
                model.dispose();
                this.models.delete(rel);
              }
              if (Array.isArray(this.openTabs)) {
                const tabIdx = this.openTabs.indexOf(rel);
                if (tabIdx !== -1) {
                  this.openTabs.splice(tabIdx, 1);
                  if (this.activeFile === rel) {
                    this.activeFile = this.openTabs[Math.max(0, tabIdx - 1)] || null;
                    if (this.activeTab !== '__settings__') {
                      this.activeTab = this.activeFile;
                    }
                  }
                }
              }
            }
          }
          const remainingFiles = Object.keys(this.files);
          for (const existingFolder of Array.from(this.folders)) {
            const hasDescendantFile = remainingFiles.some(f => f.startsWith(existingFolder + '/'));
            if (!shellWorkspaceFolders.has(existingFolder) && !hasDescendantFile) {
              this.folders.delete(existingFolder);
              if (this.kernel && this.kernel.fs && typeof this.kernel.fs.deleteFile === 'function') {
                try { this.kernel.fs.deleteFile('/workspace/' + existingFolder, { recursive: true }); } catch (_e) { void _e; }
              }
              changed = true;
            }
          }
        }
      }

      // 2. Also sync from snapshot array if provided
      if (Array.isArray(fsSnapshot) && fsSnapshot.length > 0) {
        const snapNewFiles = [];
        for (const item of fsSnapshot) {
          if (!item || !item.path || !item.path.startsWith('/workspace/')) continue;
          const rel = item.path.slice('/workspace/'.length).replace(/\/+$/, '');
          if (!rel || hiddenVfsSegRe.test(rel)) continue;
          if (!item.isDirectory && (item.content !== undefined || item.preview !== undefined) && this.files[rel] === undefined) {
            snapNewFiles.push(rel);
          }
        }
        const allowAutoSingle = !suppressAuto && snapNewFiles.length === 1;
        for (const item of fsSnapshot) {
          if (!item || !item.path) continue;
          if (item.path.startsWith('/workspace/')) {
            const rel = item.path.slice('/workspace/'.length).replace(/\/+$/, '');
            if (!rel || hiddenVfsSegRe.test(rel)) continue;
            if (item.isDirectory) {
              if (!this.folders.has(rel)) {
                this.folders.add(rel);
                if (this.kernel && this.kernel.fs && typeof this.kernel.fs.mkdir === 'function') {
                  try { this.kernel.fs.mkdir('/workspace/' + rel); } catch (_e) { void _e; }
                }
                changed = true;
              }
            } else if (item.content !== undefined || item.preview !== undefined) {
              const content = item.content !== undefined ? item.content : (item.preview || '');
              if (this.files[rel] !== content) {
                this.files[rel] = content;
                if (this._savedSnapshot) {
                  this._savedSnapshot[rel] = content;
                }
                if (this.kernel && this.kernel.fs && typeof this.kernel.fs.writeFile === 'function') {
                  try { this.kernel.fs.writeFile('/workspace/' + rel, content); } catch (_e) { void _e; }
                }
                if (allowAutoSingle && Array.isArray(this.openTabs) && !this.openTabs.includes(rel) && this.openTabs.length < 8) {
                  this.openTabs.push(rel);
                }
                changed = true;
                const parts = rel.split('/');
                for (let i = 1; i < parts.length; i++) {
                  this.folders.add(parts.slice(0, i).join('/'));
                }
                const model = this.models.get(rel);
                if (model && typeof model.getValue === 'function') {
                  if (model.getValue() !== content) model.setValue(content);
                } else {
                  this._getOrCreateModel(rel);
                }
                this._lintFile(rel);
              }
            }
          }
        }
        if (!suppressAuto && snapNewFiles.length >= 1 && Array.isArray(this.openTabs) && this.openTabs.length === 0) {
          const pick = this._pickPrimaryCloneFile(snapNewFiles) || snapNewFiles[0];
          if (pick) {
            this.openTabs.push(pick);
            this.activeFile = pick;
            this.activeTab = (this.settingsTabOpen && this.activeTab === '__settings__') ? '__settings__' : pick;
          }
        }
      }

      if (changed) {
        this._saveState({ flushSnapshotOnly: true });
        this._renderFileLists();
        this._renderTabs();
        this._syncActiveFileToView();
      }
    }

    _updateFallbackGutter() {
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      const gutterEl = this.container.querySelector('#cl-fallback-gutter');
      if (!fallbackEl || !gutterEl) return;
      const lineMode = this.configuration
        ? String(this.configuration.get('editor.lineNumbers', 'on'))
        : 'on';
      if (lineMode === 'off') {
        if (gutterEl.style) gutterEl.style.display = 'none';
        return;
      }
      if (gutterEl.style) gutterEl.style.display = '';
      const lineCount = Math.max(1, (fallbackEl.value || '').split('\n').length);
      const curLn = (this.cursorPos && this.cursorPos.lineNumber) ? this.cursorPos.lineNumber : 1;
      const nums = [];
      for (let i = 1; i <= lineCount; i++) {
        if (lineMode === 'relative') {
          nums.push(i === curLn ? i : Math.abs(i - curLn));
        } else {
          nums.push(i);
        }
      }
      gutterEl.textContent = nums.join('\n');
      gutterEl.scrollTop = fallbackEl.scrollTop;
    }

    _applyEditorSettingsToFallback() {
      if (!this.container) return;
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      const gutterEl = this.container.querySelector('#cl-fallback-gutter');
      if (!fallbackEl) return;
      const fontSize = this.configuration
        ? Math.max(10, Math.min(32, Number(this.configuration.get('editor.fontSize', 13)) || 13))
        : 13;
      const tabSize = this.configuration
        ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
        : 2;
      const wordWrap = this.configuration
        ? String(this.configuration.get('editor.wordWrap', 'off'))
        : 'off';
      if (fallbackEl.style) {
        fallbackEl.style.fontSize = `${fontSize}px`;
        fallbackEl.style.tabSize = String(tabSize);
        fallbackEl.style.whiteSpace = wordWrap === 'off' ? 'pre' : 'pre-wrap';
        fallbackEl.style.wordBreak = wordWrap === 'off' ? 'normal' : 'break-word';
      }
      if (gutterEl && gutterEl.style) {
        gutterEl.style.fontSize = `${fontSize}px`;
      }
      this._updateFallbackGutter();
    }

    _ensureFallbackHistoryEntry(filePath) {
      if (!this._fallbackHistory) this._fallbackHistory = new Map();
      let entry = this._fallbackHistory.get(filePath);
      if (!entry) {
        const initVal = (filePath && this.files && typeof this.files[filePath] === 'string') ? this.files[filePath] : '';
        entry = { undo: [], redo: [], current: initVal, selStart: 0, selEnd: 0 };
        this._fallbackHistory.set(filePath, entry);
      }
      return entry;
    }

    _recordFallbackEdit(filePath, nextVal, selStart, selEnd) {
      if (!filePath) return;
      const entry = this._ensureFallbackHistoryEntry(filePath);
      if (entry.current === nextVal) return;
      entry.undo.push({
        value: entry.current,
        selStart: typeof entry.selStart === 'number' ? entry.selStart : entry.current.length,
        selEnd: typeof entry.selEnd === 'number' ? entry.selEnd : entry.current.length
      });
      if (entry.undo.length > 100) entry.undo.shift();
      entry.redo.length = 0;
      entry.current = nextVal;
      entry.selStart = typeof selStart === 'number' ? selStart : nextVal.length;
      entry.selEnd = typeof selEnd === 'number' ? selEnd : nextVal.length;
    }

    _applyFallbackHistoryStep(direction) {
      if (!this.activeFile || !this.container) return false;
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      if (!fallbackEl) return false;
      const entry = this._ensureFallbackHistoryEntry(this.activeFile);
      const fromStack = direction === 'redo' ? entry.redo : entry.undo;
      const toStack = direction === 'redo' ? entry.undo : entry.redo;
      if (!fromStack.length) return false;
      const curSelStart = typeof fallbackEl.selectionStart === 'number' ? fallbackEl.selectionStart : entry.current.length;
      const curSelEnd = typeof fallbackEl.selectionEnd === 'number' ? fallbackEl.selectionEnd : curSelStart;
      toStack.push({ value: entry.current, selStart: curSelStart, selEnd: curSelEnd });
      const snap = fromStack.pop();
      entry.current = snap.value;
      entry.selStart = snap.selStart;
      entry.selEnd = snap.selEnd;
      fallbackEl.value = snap.value;
      if (typeof fallbackEl.focus === 'function') fallbackEl.focus();
      if (typeof fallbackEl.setSelectionRange === 'function') {
        try { fallbackEl.setSelectionRange(snap.selStart, snap.selEnd); } catch (_err) { void _err; }
      } else {
        fallbackEl.selectionStart = snap.selStart;
        fallbackEl.selectionEnd = snap.selEnd;
      }
      this.files[this.activeFile] = snap.value;
      this._userEditSeq = (this._userEditSeq || 0) + 1;
      this._markFileDirty(this.activeFile);
      this._updateFallbackGutter();
      const upToCursor = (snap.value || '').slice(0, snap.selStart || 0).split('\n');
      const lineNumber = upToCursor.length;
      const column = upToCursor[upToCursor.length - 1].length + 1;
      this.cursorPos = { lineNumber, column, ln: lineNumber, col: column };
      this._updateStatusBar();
      this._renderBreadcrumbs();
      this._scheduleSaveState();
      this._notifyCodeChange(this.activeFile, snap.value);
      return true;
    }

    _bindFallbackEditorListeners() {
      const fallbackEl = this.container ? this.container.querySelector('#cl-fallback-editor') : null;
      if (!fallbackEl) return;
      fallbackEl.value = (this.activeFile && this.files[this.activeFile]) ? this.files[this.activeFile] : '';
      if (this.activeFile) {
        const hist = this._ensureFallbackHistoryEntry(this.activeFile);
        hist.current = fallbackEl.value;
      }
      this._applyEditorSettingsToFallback();
      if (fallbackEl._clFallbackBound) return;
      fallbackEl._clFallbackBound = true;

      const updateFallbackCursor = () => {
        const val = fallbackEl.value || '';
        const sel = typeof fallbackEl.selectionStart === 'number' ? fallbackEl.selectionStart : 0;
        if (this.activeFile) {
          const hist = this._ensureFallbackHistoryEntry(this.activeFile);
          hist.selStart = sel;
          hist.selEnd = typeof fallbackEl.selectionEnd === 'number' ? fallbackEl.selectionEnd : sel;
        }
        const upToCursor = val.slice(0, sel).split('\n');
        const lineNumber = upToCursor.length;
        const column = upToCursor[upToCursor.length - 1].length + 1;
        this.cursorPos = { lineNumber, column, ln: lineNumber, col: column };
        this._updateStatusBar();
        this._renderBreadcrumbs();
      };

      const commitFallbackValue = () => {
        if (this.editor || !this.activeFile) return;
        const nextVal = fallbackEl.value;
        const selStart = typeof fallbackEl.selectionStart === 'number' ? fallbackEl.selectionStart : nextVal.length;
        const selEnd = typeof fallbackEl.selectionEnd === 'number' ? fallbackEl.selectionEnd : selStart;
        this._recordFallbackEdit(this.activeFile, nextVal, selStart, selEnd);
        this.files[this.activeFile] = nextVal;
        this._userEditSeq = (this._userEditSeq || 0) + 1;
        this._markFileDirty(this.activeFile);
        this._updateFallbackGutter();
        updateFallbackCursor();
        this._scheduleSaveState();
        this._notifyCodeChange(this.activeFile, nextVal);
      };

      fallbackEl.addEventListener('scroll', () => {
        const gutterEl = this.container.querySelector('#cl-fallback-gutter');
        if (gutterEl) gutterEl.scrollTop = fallbackEl.scrollTop;
      });

      fallbackEl.addEventListener('keyup', updateFallbackCursor);
      fallbackEl.addEventListener('click', updateFallbackCursor);

      fallbackEl.addEventListener('blur', () => {
        if (
          this.configuration &&
          this.configuration.get('files.autoSave', 'afterDelay') === 'onFocusChange' &&
          ((this._dirtyFiles && this._dirtyFiles.size > 0) || this.saveStatusState === 'dirty')
        ) {
          this.saveActiveFile({ manual: false });
        }
      });

      fallbackEl.addEventListener('input', () => {
        commitFallbackValue();
      });

      fallbackEl.addEventListener('keydown', e => {
        const keyLower = (e.key || '').toLowerCase();
        if ((e.metaKey || e.ctrlKey) && !e.altKey && keyLower === 'z') {
          e.preventDefault();
          this._applyFallbackHistoryStep(e.shiftKey ? 'redo' : 'undo');
          return;
        }
        if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && keyLower === 'y') {
          e.preventDefault();
          this._applyFallbackHistoryStep('redo');
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const tabSize = this.configuration
            ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
            : 2;
          const spaces = ' '.repeat(tabSize);
          const start = fallbackEl.selectionStart;
          const end = fallbackEl.selectionEnd;
          fallbackEl.value = fallbackEl.value.substring(0, start) + spaces + fallbackEl.value.substring(end);
          fallbackEl.selectionStart = fallbackEl.selectionEnd = start + tabSize;
          commitFallbackValue();
        } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
          e.preventDefault();
          this.runDemo();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (this.mode === 'guided') {
            this.verifyCurrentStep();
          } else {
            this.runTests();
          }
        }
      });
    }

    // ── Initialize Monaco Editor (with Resilient Line-Numbered Fallback) ────
    _initEditor() {
      this._editorInitialized = true;
      this._bindFallbackEditorListeners();
      this._syncActiveFileToView();

      loadMonaco(this.monacoUrl).then(m => {
        if (this._destroyed || !this.container) return;
        this.monaco = m;
        if (this._diagnosticsStore && typeof this._diagnosticsStore.setFileDiagnostics === 'function' && this.files) {
          for (const fn of Object.keys(this.files)) {
            if (/\.(?:m?js|cjs|ts)$/i.test(fn)) {
              this._diagnosticsStore.setFileDiagnostics(fn, [], /\.ts$/i.test(fn) ? 'ts' : 'js');
            }
          }
        }
        const monacoHost = this.container.querySelector('#cl-monaco-host');
        if (!monacoHost) return;
        if (m.editor && typeof m.editor.defineTheme === 'function') {
          try {
            m.editor.defineTheme('codelab-hc-dark', {
              base: 'hc-black',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#000000',
                'editor.foreground': '#ffffff'
              }
            });
          } catch (err) {
            this.logger.debug('defineTheme codelab-hc-dark skipped.', err);
          }
        }
        const mod = getModular();
        if (m.languages && m.languages.json && m.languages.json.jsonDefaults && typeof m.languages.json.jsonDefaults.setDiagnosticsOptions === 'function' && this.configuration && mod) {
          try {
            m.languages.json.jsonDefaults.setDiagnosticsOptions({
              validate: true,
              allowComments: true,
              trailingCommas: 'ignore',
              schemas: [
                {
                  uri: 'https://code-lab.dev/schemas/settings.json',
                  fileMatch: ['**/.codelab/settings.json', '.codelab/settings.json'],
                  schema: this.configuration.getJsonSchema()
                },
                {
                  uri: 'https://code-lab.dev/schemas/keybindings.json',
                  fileMatch: ['**/.codelab/keybindings.json', '.codelab/keybindings.json'],
                  schema: mod.KEYBINDINGS_JSON_SCHEMA
                },
                {
                  uri: 'https://code-lab.dev/schemas/tasks.json',
                  fileMatch: ['**/.codelab/tasks.json', '.codelab/tasks.json'],
                  schema: mod.TASKS_JSON_SCHEMA
                },
                {
                  uri: 'https://code-lab.dev/schemas/extensions.json',
                  fileMatch: ['**/.codelab/extensions.json', '.codelab/extensions.json'],
                  schema: mod.EXTENSIONS_JSON_SCHEMA
                }
              ]
            });
          } catch (err) {
            this.logger.debug('Monaco JSON schema registration skipped.', err);
          }
        }

        const resolvedInitTheme = this._resolvedTheme();
        const initMonacoTheme = resolvedInitTheme === 'light'
          ? 'codelab-light'
          : resolvedInitTheme === 'high-contrast'
            ? 'codelab-hc-dark'
            : 'codelab-dark';

        // Create models for all code files
        this._syncAllModels();

        const currentModel = this.activeFile ? this._getOrCreateModel(this.activeFile) : null;
        this.editor = m.editor.create(monacoHost, {
          model: currentModel,
          theme: initMonacoTheme,
          fontFamily: this.configuration ? this.configuration.get('editor.fontFamily', '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace') : '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontSize: this.configuration ? this.configuration.get('editor.fontSize', 13) : 13,
          lineHeight: 20,
          tabSize: this.configuration ? this.configuration.get('editor.tabSize', 2) : 2,
          insertSpaces: true,
          wordWrap: this.configuration ? this.configuration.get('editor.wordWrap', 'off') : 'off',
          lineNumbers: this.configuration ? this.configuration.get('editor.lineNumbers', 'on') : 'on',
          minimap: { enabled: this.configuration ? Boolean(this.configuration.get('editor.minimap.enabled', false)) : false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderLineHighlight: 'all',
          bracketPairColorization: { enabled: true }
        });

        this._applyConfigurationChanges(null);

        if (typeof this.editor.onDidBlurEditorWidget === 'function') {
          this.editor.onDidBlurEditorWidget(() => {
            if (
              this.configuration &&
              this.configuration.get('files.autoSave', 'afterDelay') === 'onFocusChange' &&
              ((this._dirtyFiles && this._dirtyFiles.size > 0) || this.saveStatusState === 'dirty')
            ) {
              this.saveActiveFile({ manual: false });
            }
          });
        }

        // Dynamic ResizeObserver to guarantee 100% width on layout shifts
        if (typeof ResizeObserver !== 'undefined' && monacoHost) {
          this._editorResizeObserver = new ResizeObserver(() => {
            if (this.editor && typeof this.editor.layout === 'function') {
              this.editor.layout();
            }
          });
          this._editorResizeObserver.observe(monacoHost);
        }

        // Keyboard shortcuts inside Monaco
        if (m.KeyMod && m.KeyCode && typeof this.editor.addCommand === 'function') {
          this.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => {
            if (this.mode === 'guided') {
              this.verifyCurrentStep();
            } else if (this.lang === 'sql' || (this.activeFile && /\.sql$/i.test(this.activeFile))) {
              this.runSql('run');
            } else {
              this.runTests();
            }
          });
          this.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.Enter, () => {
            this.runDemo();
          });
          if (m.KeyCode.Comma) {
            this.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Comma, () => {
              this.openSettings();
            });
          }
          if (m.KeyCode.KeyP) {
            this.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.KeyP, () => {
              this.openCommandPalette('commands');
            });
            this.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyP, () => {
              this.openCommandPalette('files');
            });
          }
          if (m.KeyCode.F1) {
            this.editor.addCommand(m.KeyCode.F1, () => {
              this.openCommandPalette('commands');
            });
          }
        }

        if (typeof this.editor.onDidChangeCursorPosition === 'function') {
          this.editor.onDidChangeCursorPosition(e => {
            if (e && e.position) {
              this.cursorPos = {
                lineNumber: e.position.lineNumber,
                column: e.position.column,
                ln: e.position.lineNumber,
                col: e.position.column
              };
              this._updateStatusBar();
              this._scheduleBreadcrumbs();
            }
          });
        }

        if (m.editor && typeof m.editor.onDidChangeMarkers === 'function') {
          this._markerDisposable = m.editor.onDidChangeMarkers(() => {
            this._syncMonacoMarkersToDiagnostics();
          });
        }

        const liveFallbackWrap = this.container.querySelector('#cl-fallback-wrap');
        if (liveFallbackWrap) liveFallbackWrap.style.display = 'none';
        this._syncActiveFileToView();

        // Watch theme changes on <html>
        if (typeof MutationObserver !== 'undefined') {
          this._themeObserver = new MutationObserver(() => {
            const rt = this._resolvedTheme();
            const targetMonacoTheme = rt === 'light'
              ? 'codelab-light'
              : rt === 'high-contrast'
                ? 'codelab-hc-dark'
                : 'codelab-dark';
            m.editor.setTheme(targetMonacoTheme);
          });
          this._themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
          });
        }
      }).catch(() => {
        if (this._destroyed || !this.container) return;
        // Fallback editor remains visible if offline / CDN blocked
        const liveFallbackWrap = this.container.querySelector('#cl-fallback-wrap');
        if (liveFallbackWrap && this.activeFile && !(this.activeFile.endsWith('.md') && this._mdPreviewOpen)) {
          this._syncActiveFileToView();
        }
      });
    }

    _notifyCodeChange(filename, code) {
      const cleanRel = filename ? String(filename).replace(/^\/+/, '') : '';
      if (this.shell && this.shell.vfs && cleanRel && typeof this.shell.vfs.writeFileSync === 'function') {
        try {
          const parts = cleanRel.split('/');
          if (parts.length > 1 && typeof this.shell.vfs.mkdirSync === 'function') {
            this.shell.vfs.mkdirSync('/workspace/' + parts.slice(0, -1).join('/'), { recursive: true });
          }
          this.shell.vfs.writeFileSync('/workspace/' + cleanRel, String(code ?? ''));
        } catch (err) {
          this.logger.debug(`Could not sync "${filename}" to shell VFS on edit.`, err);
        }
      }
      if (this.kernel && this.kernel.fs && cleanRel && typeof this.kernel.fs.writeFile === 'function') {
        try {
          Promise.resolve(this.kernel.fs.writeFile('/workspace/' + cleanRel, String(code ?? ''))).catch((err) => {
            this.logger.debug(`Could not sync "${cleanRel}" to kernel VFS.`, err);
          });
        } catch (err) {
          this.logger.debug(`Could not sync "${cleanRel}" to kernel VFS.`, err);
        }
      }
      if (cleanRel.startsWith('.codelab/') && !this._syncingWorkspaceSettingsFile) {
        this._syncDotCodelabConfig({ isInitialMount: false });
      }
      if (this._lintDebounceTimer) {
        clearTimeout(this._lintDebounceTimer);
      }
      this._lintDebounceTimer = setTimeout(() => {
        this._lintDebounceTimer = null;
        if (!this._destroyed && this.files && Object.prototype.hasOwnProperty.call(this.files, cleanRel)) {
          this._runStaticLintersForFile(cleanRel, this.files[cleanRel]);
        }
      }, 150);
      if (this.activeSidebarView === 'scm' && typeof this._renderScmSidebar === 'function') {
        this._renderScmSidebar();
      }
      const allowPreviewReload = !this.configuration || this.configuration.get('preview.autoReload', true) !== false;
      if (allowPreviewReload && (this.drawerTab === 'preview' || (this.previewState && this.previewState.dockMode === 'split')) && this.previewState && this.previewState.port) {
        if (this._previewReloadTimer) {
          clearTimeout(this._previewReloadTimer);
        }
        this._previewReloadTimer = setTimeout(() => {
          this._previewReloadTimer = null;
          this._previewReload();
        }, 300);
      }
      if (this.onCodeChange) {
        try { this.onCodeChange(filename, code); } catch (err) { this.logger.error('onCodeChange callback threw.', err); }
      }
      const detail = { labId: this.labId, filename, path: filename, code, content: code };
      this._emitEvent('codelab:change', detail);
      this._emitEvent('codelab:code-change', detail);
      this._updateStatusBar();
      this._renderBreadcrumbs();
    }

    _scheduleBreadcrumbs() {
      if (typeof requestAnimationFrame !== 'function') {
        this._renderBreadcrumbs();
        return;
      }
      if (this._breadcrumbRafId) return;
      this._breadcrumbRafId = requestAnimationFrame(() => {
        this._breadcrumbRafId = null;
        if (!this._destroyed) {
          this._renderBreadcrumbs();
        }
      });
    }

    _syncMonacoMarkersToDiagnostics() {
      if (!this.monaco || !this.monaco.editor || typeof this.monaco.editor.getModelMarkers !== 'function') return;
      this._ensureDiagnosticsStore();
      if (!this._diagnosticsStore || typeof this._diagnosticsStore.setFileDiagnostics !== 'function') return;
      const prefix = `file:///${encodeURIComponent(this.instanceId)}/`;
      for (const [filename, model] of this.models.entries()) {
        const uri = model && model.uri ? model.uri : null;
        let markers = [];
        try {
          markers = uri
            ? this.monaco.editor.getModelMarkers({ resource: uri })
            : this.monaco.editor.getModelMarkers({}).filter(mk => String(mk.resource || '').startsWith(prefix) && String(mk.resource || '').endsWith('/' + filename));
        } catch (err) {
          this.logger.debug('getModelMarkers failed during diagnostics sync.', err);
        }
        const mapped = (markers || []).map(mk => ({
          file: filename,
          line: mk.startLineNumber || 1,
          column: mk.startColumn || 1,
          endLine: mk.endLineNumber || mk.startLineNumber || 1,
          endColumn: mk.endColumn || mk.startColumn || 1,
          severity: mk.severity === 8 ? 'error' : mk.severity === 4 ? 'warning' : 'info',
          message: String(mk.message || ''),
          source: String(mk.source || 'monaco')
        }));
        this._diagnosticsStore.setFileDiagnostics(filename, mapped, 'monaco');
      }
      const badgeEl = this.container ? this.container.querySelector('#cl-problems-count') : null;
      if (badgeEl && typeof this._diagnosticsStore.getAll === 'function') {
        const total = this._diagnosticsStore.getAll().length;
        badgeEl.textContent = String(total);
        badgeEl.style.display = total > 0 ? 'inline-block' : 'none';
      }
      if (this.drawerTab === 'problems') {
        this._renderDrawerBody();
      }
    }

    _getOrCreateModel(filename) {
      if (!filename || !this.monaco || !this.monaco.editor) return null;
      const uriParser = (this.monaco.Uri && typeof this.monaco.Uri.parse === 'function')
        ? this.monaco.Uri
        : (this.monaco.editor.Uri && typeof this.monaco.editor.Uri.parse === 'function')
          ? this.monaco.editor.Uri
          : null;
      const rawUri = `file:///${encodeURIComponent(this.instanceId)}/${filename}`;
      const uri = uriParser ? uriParser.parse(rawUri) : { toString: () => rawUri };
      let model = typeof this.monaco.editor.getModel === 'function' ? this.monaco.editor.getModel(uri) : null;
      const lang = /\.(cpp|cc|cxx|hpp|h)$/i.test(filename)
        ? 'cpp'
        : /\.py$/i.test(filename)
          ? 'python'
          : /\.sql$/i.test(filename)
            ? 'sql'
            : filename.endsWith('.ts')
              ? 'typescript'
              : filename.endsWith('.json')
                ? 'json'
                : filename.endsWith('.html')
                  ? 'html'
                  : filename.endsWith('.css')
                    ? 'css'
                    : filename.endsWith('.md')
                      ? 'markdown'
                      : 'javascript';
      const configuredTabSize = this.configuration
        ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
        : 2;
      if (!model) {
        model = this.monaco.editor.createModel(this.files[filename] || '', lang, uri);
        if (model && typeof model.updateOptions === 'function') {
          try {
            model.updateOptions({ tabSize: configuredTabSize, insertSpaces: true });
          } catch (err) {
            void err;
          }
        }
        if (model && typeof model.onDidChangeContent === 'function') {
          model.onDidChangeContent(() => {
            const val = model.getValue();
            this.files[filename] = val;
            if (!this._syncingWorkspaceSettingsFile && !this._syncingModelFromFiles) {
              this._userEditSeq = (this._userEditSeq || 0) + 1;
              this._markFileDirty(filename);
            }
            this._scheduleSaveState();
            this._notifyCodeChange(filename, val);
          });
        }
      } else {
        if (typeof model.updateOptions === 'function') {
          try {
            model.updateOptions({ tabSize: configuredTabSize, insertSpaces: true });
          } catch (err) {
            void err;
          }
        }
        if (model.getValue() !== (this.files[filename] || '')) {
          this._syncingModelFromFiles = true;
          try {
            model.setValue(this.files[filename] || '');
          } finally {
            this._syncingModelFromFiles = false;
          }
        }
      }
      this.models.set(filename, model);
      return model;
    }

    _syncAllModels() {
      if (!this.monaco) return;
      const activeSet = new Set(Object.keys(this.files || {}));
      for (const [filename, model] of Array.from(this.models.entries())) {
        if (!activeSet.has(filename)) {
          if (model && typeof model.dispose === 'function') {
            try { model.dispose(); } catch (err) { this.logger.debug('Stale model dispose skipped.', err); }
          }
          this.models.delete(filename);
        }
      }
      for (const filename of activeSet) {
        const content = String(this.files[filename] || '');
        if (content.length <= 2 * 1024 * 1024 && !content.includes('\x00')) {
          this._getOrCreateModel(filename);
        }
      }
    }

    _syncActiveFileToView() {
      const monacoHost = this.container.querySelector('#cl-monaco-host');
      const sqlHost = this.container.querySelector('#cl-sql-editor-host');
      const fallbackWrap = this.container.querySelector('#cl-fallback-wrap');
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      const mdPreview = this.container.querySelector('#cl-md-preview');
      const settingsHost = this.container.querySelector('#cl-settings-host');
      const inlineDiffHost = this.container.querySelector('#cl-inline-diff-container');
      const emptyEl = this.container.querySelector('#cl-empty-editor');

      // Non-destructive Settings Tab: hide code surfaces via display:none WITHOUT calling editor.setModel(null) or disposing!
      if (this.settingsTabOpen && this.activeTab === '__settings__') {
        this._activeScmDiffFile = null;
        if (monacoHost) monacoHost.style.display = 'none';
        if (sqlHost) sqlHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) mdPreview.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (inlineDiffHost) {
          inlineDiffHost.hidden = true;
          if (inlineDiffHost.style) inlineDiffHost.style.display = 'none';
        }
        if (settingsHost) {
          settingsHost.hidden = false;
          if (settingsHost.style) settingsHost.style.display = 'block';
          if (typeof this._mountSettingsInline === 'function') {
            this._mountSettingsInline(settingsHost);
          }
          const listEl = settingsHost.querySelector('[data-role="settings-list"]');
          if (listEl && typeof this._savedSettingsScrollTop === 'number' && this._savedSettingsScrollTop > 0) {
            listEl.scrollTop = this._savedSettingsScrollTop;
          }
        }
        const actSettingsBtn = this.container.querySelector('[data-cl-activity="settings"]');
        if (actSettingsBtn) {
          actSettingsBtn.classList.add('active');
          actSettingsBtn.setAttribute('aria-pressed', 'true');
        }
        this._renderFileLists();
        this._renderBreadcrumbs();
        this._updateStatusBar();
        return;
      }

      if (settingsHost) {
        if (!settingsHost.hidden && (!settingsHost.style || settingsHost.style.display !== 'none')) {
          const listEl = settingsHost.querySelector('[data-role="settings-list"]');
          if (listEl) this._savedSettingsScrollTop = listEl.scrollTop;
        }
        settingsHost.hidden = true;
        if (settingsHost.style) settingsHost.style.display = 'none';
      }
      const actSettingsBtn = this.container.querySelector('[data-cl-activity="settings"]');
      if (actSettingsBtn) {
        actSettingsBtn.classList.remove('active');
        actSettingsBtn.setAttribute('aria-pressed', 'false');
      }

      // Non-destructive Source Control Inline Diff: hide sibling editor hosts via display:none WITHOUT mutating models/buffers!
      if (this._activeScmDiffFile && inlineDiffHost) {
        if (monacoHost) monacoHost.style.display = 'none';
        if (sqlHost) sqlHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) mdPreview.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        inlineDiffHost.hidden = false;
        if (inlineDiffHost.style) inlineDiffHost.style.display = 'flex';
        this._renderInlineScmDiff(inlineDiffHost);
        this._renderFileLists();
        this._renderBreadcrumbs();
        this._updateStatusBar();
        return;
      }
      if (inlineDiffHost) {
        inlineDiffHost.hidden = true;
        if (inlineDiffHost.style) inlineDiffHost.style.display = 'none';
      }

      if (!this.activeFile || !this.openTabs || this.openTabs.length === 0) {
        if (monacoHost) monacoHost.style.display = 'none';
        if (sqlHost) sqlHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) mdPreview.style.display = 'none';
        if (this.editor) {
          try { this.editor.setModel(null); } catch (err) { this.logger.debug('editor.setModel(null) failed.', err); }
        }
        if (emptyEl) {
          emptyEl.style.display = 'flex';
          this._renderEmptyEditorContent(emptyEl);
        }
        this._renderFileLists();
        this._renderBreadcrumbs();
        this._updateStatusBar();
        return;
      }

      const activeContent = String(this.files[this.activeFile] ?? '');
      const isBinaryContent = activeContent.includes('\x00') || /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|wasm|pdf|zip)$/i.test(this.activeFile);
      const isHugeContent = activeContent.length > 2 * 1024 * 1024;
      if ((isBinaryContent || isHugeContent) && !(this._forceOpenedLargeFiles && this._forceOpenedLargeFiles.has(this.activeFile))) {
        if (monacoHost) monacoHost.style.display = 'none';
        if (sqlHost) sqlHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) mdPreview.style.display = 'none';
        if (this.editor) {
          try { this.editor.setModel(null); } catch (err) { this.logger.debug('editor.setModel(null) failed.', err); }
        }
        if (emptyEl) {
          emptyEl.style.display = 'flex';
          const sizeKb = (activeContent.length / 1024).toFixed(1);
          emptyEl.innerHTML = `
            <div class="codelab-file-guard" role="status">
              <strong>${escapeHtml(this.activeFile)}</strong>
              <span>${isBinaryContent
                ? `Binary file (${sizeKb} KB) cannot be displayed as plain text.`
                : `Large file (${sizeKb} KB) paused before rendering to keep the editor responsive.`}</span>
              ${!isBinaryContent
                ? `<button type="button" class="codelab-btn codelab-btn--primary" data-cl-action="open-large-file-anyway" data-cl-file="${escapeHtml(this.activeFile)}">Open File Anyway</button>`
                : ''}
            </div>
          `;
        }
        this._renderFileLists();
        this._renderBreadcrumbs();
        this._updateStatusBar();
        return;
      }

      if (emptyEl) {
        emptyEl.style.display = 'none';
      }

      const isMd = /\.md$/i.test(this.activeFile);
      const isSqlFile = /\.sql$/i.test(this.activeFile);
      const sqlPack = getSqlPack();
      const useLightweightSqlEditor = Boolean(
        isSqlFile &&
        sqlHost &&
        sqlPack &&
        typeof sqlPack.createSqlEditor === 'function' &&
        (!this.editor || (this.options && this.options.editorEngine !== 'monaco'))
      );

      if (isMd && this._mdPreviewOpen) {
        if (monacoHost) monacoHost.style.display = 'none';
        if (sqlHost) sqlHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) {
          mdPreview.style.display = 'block';
          mdPreview.innerHTML = renderSimpleMarkdown(this.files[this.activeFile] || '');
        }
      } else if (useLightweightSqlEditor) {
        if (mdPreview) mdPreview.style.display = 'none';
        if (monacoHost) monacoHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        sqlHost.style.display = 'block';
        const hasLiveSqlDom = Boolean(
          this._sqlWorkbenchEditor &&
          typeof sqlHost.querySelector === 'function' &&
          sqlHost.querySelector('.cl-sql-root, .cl-sql-textarea')
        );
        if (!hasLiveSqlDom) {
          if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.destroy === 'function') {
            try { this._sqlWorkbenchEditor.destroy(); } catch (_err) { void _err; }
          }
          this._sqlWorkbenchEditor = null;
          sqlHost.innerHTML = '';
          this._sqlWorkbenchEditor = sqlPack.createSqlEditor(sqlHost, {
            value: this.files[this.activeFile] || '',
            mode: 'inline',
            dialect: this.sqlDialect,
            schema: this.sqlSchema || undefined,
            theme: this._resolvedTheme() === 'light' ? 'light' : 'dark',
            minLines: 10,
            maxLines: 200,
            ariaLabel: `SQL Editor (${this.activeFile})`,
            onChange: (nextVal) => {
              if (this._syncingSqlEditorFromFiles) return;
              if (this.activeFile && /\.sql$/i.test(this.activeFile)) {
                this.files[this.activeFile] = nextVal;
                this._userEditSeq = (this._userEditSeq || 0) + 1;
                this._markFileDirty(this.activeFile);
                this._scheduleSaveState();
                this._notifyCodeChange(this.activeFile, nextVal);
              }
            },
            onRun: (payload) => {
              if (this.mode === 'guided') {
                this.verifyCurrentStep(payload);
              } else {
                this.runSql('run', payload);
              }
            },
            onExplain: (payload) => {
              this.runSql('explain', payload);
            }
          });
        } else {
          const desired = this.files[this.activeFile] || '';
          if (this._sqlWorkbenchEditor.getValue() !== desired) {
            this._syncingSqlEditorFromFiles = true;
            try {
              this._sqlWorkbenchEditor.setValue(desired);
            } finally {
              this._syncingSqlEditorFromFiles = false;
            }
          }
        }
      } else {
        if (mdPreview) {
          mdPreview.style.display = 'none';
          if (isMd) {
            mdPreview.innerHTML = renderSimpleMarkdown(this.files[this.activeFile] || '');
          }
        }
        if (sqlHost) sqlHost.style.display = 'none';
        if (this.editor && this.monaco) {
          if (monacoHost) monacoHost.style.display = 'block';
          if (fallbackWrap) fallbackWrap.style.display = 'none';
          const model = this._getOrCreateModel(this.activeFile);
          if (model && this.editor.getModel() !== model) {
            this.editor.setModel(model);
          }
          const pos = typeof this.editor.getPosition === 'function' ? this.editor.getPosition() : null;
          if (pos) {
            this.cursorPos = {
              lineNumber: pos.lineNumber,
              column: pos.column,
              ln: pos.lineNumber,
              col: pos.column
            };
          }
          if (typeof this.editor.layout === 'function') this.editor.layout();
        } else if (fallbackWrap && fallbackEl) {
          fallbackWrap.style.display = 'flex';
          const desiredVal = this.files[this.activeFile] || '';
          fallbackEl.value = desiredVal;
          const hist = this._ensureFallbackHistoryEntry(this.activeFile);
          hist.current = desiredVal;
          this._updateFallbackGutter();
        }
      }
      this._renderFileLists();
      this._renderBreadcrumbs();
      this._updateStatusBar();
    }

    _renderEmptyEditorContent(emptyEl) {
      if (!emptyEl) return;
      emptyEl.innerHTML = `
        <div class="codelab-empty-editor__inner">
          <div class="codelab-empty-editor__watermark" aria-hidden="true">code-lab</div>
          <div class="codelab-empty-editor__shortcuts" role="group" aria-label="Quick actions">
            <button type="button" class="codelab-empty-shortcut" data-cl-action="new-file-root">
              <span>New File</span><kbd>⌘N</kbd>
            </button>
            <button type="button" class="codelab-empty-shortcut" data-cl-action="open-clone-modal">
              <span>Clone Repository</span><kbd>⌘⇧G</kbd>
            </button>
            <button type="button" class="codelab-empty-shortcut" data-cl-action="command-palette-files">
              <span>Go to File</span><kbd>⌘P</kbd>
            </button>
            <button type="button" class="codelab-empty-shortcut" data-cl-action="command-palette">
              <span>Show All Commands</span><kbd>⌘⇧P</kbd>
            </button>
          </div>
          <p class="codelab-empty-editor__subtitle">No editors open. Create a file, clone a repository, or select a file from the Explorer.</p>
        </div>
      `;
    }

    // ── Event Delegation & Interactive Splitters ───────────────────────────
    _bindEvents() {
      if (this._isBooting || this._eventsBound) return;
      this._eventsBound = true;

      this._bindSplitters();

      this._escHandler = e => {
        if (!e || e.defaultPrevented) return;
        if (e.key === 'Escape') {
          if (this._activeTopMenu) {
            const openSub = e.target && typeof e.target.closest === 'function'
              ? e.target.closest('.codelab-topbar-submenu.open')
              : null;
            if (openSub && this.container && typeof this.container.contains === 'function' && this.container.contains(openSub)) {
              e.preventDefault();
              openSub.classList.remove('open');
              const parentWrap = openSub.closest('.codelab-topbar-menu__has-sub');
              const parentBtn = parentWrap ? parentWrap.querySelector('[data-cl-submenu]') : null;
              if (parentBtn) {
                parentBtn.setAttribute('aria-expanded', 'false');
                if (typeof parentBtn.focus === 'function') parentBtn.focus();
              }
              return;
            }
            this._closeTopbarMenu({ restoreFocus: true });
            return;
          }
          const ctxSlot = this.container.querySelector('#cl-context-menu-slot');
          if (ctxSlot && ctxSlot.innerHTML.trim() !== '') {
            this.closeContextMenu();
            return;
          }
          if (this.creatingItem) {
            this.creatingItem = null;
            this._renderFileLists();
            return;
          }
          if (this.renamingItem) {
            this.renamingItem = null;
            this._renderFileLists();
            return;
          }
          if (this.isCreatingFile) {
            this.isCreatingFile = false;
            this._renderFileLists();
            return;
          }
          const modalSlot = this.container.querySelector('#cl-modal-slot');
          if (modalSlot && modalSlot.innerHTML.trim() !== '') {
            if (this._cloneInFlight || this._activeCloneAbortController) {
              this.cancelClone();
            }
            this.closeModal();
            return;
          }
          if (this.isFullscreen) {
            this.toggleFullscreen();
          }
        }
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('keydown', this._escHandler);
        this._beforeUnloadHandler = () => {
          if (document.visibilityState === 'hidden') {
            try {
              this._saveState();
            } catch (err) {
              void err;
            }
          }
        };
        document.addEventListener('visibilitychange', this._beforeUnloadHandler);
        this._topbarMenuOutsideHandler = (ev) => {
          if (!this._activeTopMenu) return;
          const t = ev && ev.target;
          const insideMenuTrigger = t && typeof t.closest === 'function' && t.closest('.codelab-menubar__trigger[data-cl-menu]');
          const insideSlot = t && typeof t.closest === 'function' && t.closest('#cl-topbar-menu-slot');
          if (!insideMenuTrigger && !insideSlot) {
            const prior = this._menuReturnFocusEl || null;
            const clickedOtherCodelab = Boolean(
              t && typeof t.closest === 'function' && t.closest('.codelab') &&
              !(this.container && typeof this.container.contains === 'function' && this.container.contains(t))
            );
            this._closeTopbarMenu({ restoreFocus: false });
            if (!clickedOtherCodelab && typeof document !== 'undefined') {
              const restoreIfBody = () => {
                if (this._destroyed || !this.container) return;
                const ae = document.activeElement;
                if (!ae || ae === document.body || ae === document.documentElement) {
                  this._restoreWorkbenchFocus(prior);
                }
              };
              restoreIfBody();
              let safetyTimer = null;
              const cleanup = () => {
                document.removeEventListener('mouseup', onPointerFinish, true);
                document.removeEventListener('click', onFollowUpClick, true);
                if (safetyTimer !== null) {
                  clearTimeout(safetyTimer);
                  safetyTimer = null;
                }
              };
              const onPointerFinish = () => {
                if (safetyTimer !== null) {
                  clearTimeout(safetyTimer);
                  safetyTimer = null;
                }
                restoreIfBody();
              };
              const onFollowUpClick = () => {
                cleanup();
                restoreIfBody();
              };
              document.addEventListener('mouseup', onPointerFinish, true);
              document.addEventListener('click', onFollowUpClick, true);
              safetyTimer = setTimeout(() => {
                cleanup();
              }, 120);
            }
          }
        };
        document.addEventListener('pointerdown', this._topbarMenuOutsideHandler);
      }

      // Capture-phase keydown handler so Monaco / inputs do not swallow core VS Code workbench shortcuts
      this._captureKeydownHandler = e => {
        if (!e) return;
        const keyLower = (e.key || '').toLowerCase();
        const mod = Boolean(e.metaKey || e.ctrlKey);
        const tgt = e.target;
        const inCustomContentEditable = Boolean(
          tgt &&
          (tgt.isContentEditable || (typeof tgt.closest === 'function' && tgt.closest('[contenteditable="true"]'))) &&
          !(typeof tgt.closest === 'function' && tgt.closest('#cl-monaco-host, .monaco-editor'))
        );
        if (inCustomContentEditable && mod && !e.shiftKey && !e.altKey && keyLower === 'b') {
          return;
        }
        if (mod && !e.shiftKey && !e.altKey && keyLower === 's') {
          e.preventDefault();
          e.stopPropagation();
          this.saveActiveFile({ manual: true });
          return;
        }
        if (mod && !e.shiftKey && !e.altKey && e.key === ',') {
          e.preventDefault();
          e.stopPropagation();
          this.openSettings();
          return;
        }
        if (mod && !e.shiftKey && !e.altKey && keyLower === 'b') {
          e.preventDefault();
          e.stopPropagation();
          this.toggleSidebar();
          return;
        }
        if (mod && !e.shiftKey && !e.altKey && keyLower === 'j') {
          e.preventDefault();
          e.stopPropagation();
          this.togglePanel();
          return;
        }
        if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '`' || e.code === 'Backquote' || (e.shiftKey && e.key === '~'))) {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            this.setPanelVisible(true, { skipRender: true });
            this.createTerminalSession();
            this.switchDrawerTab('terminal', { ensureVisible: true });
            const termInp = this.container ? this.container.querySelector('#cl-repl-input') : null;
            if (termInp && typeof termInp.focus === 'function') termInp.focus();
          } else {
            this.toggleTerminal();
          }
          return;
        }
        if (!mod && !e.altKey && e.key === 'F8') {
          e.preventDefault();
          e.stopPropagation();
          this.goToNextProblem(Boolean(e.shiftKey));
          return;
        }
        if (mod && e.shiftKey && !e.altKey && keyLower === 'e') {
          e.preventDefault();
          e.stopPropagation();
          this.setSidebarView('explorer', { ensureOpen: true, focus: true });
          return;
        }
        if (mod && e.shiftKey && !e.altKey && keyLower === 'f') {
          e.preventDefault();
          e.stopPropagation();
          this.openSearchView();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && keyLower === 'g') {
          e.preventDefault();
          e.stopPropagation();
          this.openScmView();
          return;
        }
        if (mod && e.shiftKey && !e.altKey && keyLower === 'm') {
          e.preventDefault();
          e.stopPropagation();
          this.openProblemsPanel();
          return;
        }
        if ((!mod && !e.shiftKey && !e.altKey && e.key === 'F1') || (mod && e.shiftKey && !e.altKey && keyLower === 'p')) {
          e.preventDefault();
          e.stopPropagation();
          this.openCommandPalette('commands');
          return;
        }
        if (mod && !e.shiftKey && !e.altKey && keyLower === 'p') {
          e.preventDefault();
          e.stopPropagation();
          this.openCommandPalette('files');
          return;
        }
      };
      this.container.addEventListener('keydown', this._captureKeydownHandler, true);
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        this._documentKeydownHandler = e => {
          if (!e || e.defaultPrevented || this._destroyed) return;
          const t = e.target;
          if (t && typeof t.closest === 'function' && t.closest('.codelab')) {
            return;
          }
          if (t && (
            t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' ||
            t.isContentEditable ||
            (typeof t.closest === 'function' && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))
          )) {
            return;
          }
          if (!CodeLabWorkbench._isInstanceVisible(this)) return;
          let targetWb = CodeLabWorkbench._isInstanceVisible(CodeLabWorkbench._lastActiveInstance)
            ? CodeLabWorkbench._lastActiveInstance
            : null;
          if (!targetWb && typeof document.querySelectorAll === 'function' && CodeLabWorkbench._instances) {
            const shells = Array.from(document.querySelectorAll('.codelab'));
            for (const sh of shells) {
              for (const inst of CodeLabWorkbench._instances) {
                if (inst && inst.container && inst.container.querySelector('.codelab') === sh && CodeLabWorkbench._isInstanceVisible(inst)) {
                  targetWb = inst;
                  break;
                }
              }
              if (targetWb) break;
            }
          }
          if (!targetWb && CodeLabWorkbench._instances) {
            for (const inst of CodeLabWorkbench._instances) {
              if (CodeLabWorkbench._isInstanceVisible(inst)) {
                targetWb = inst;
                break;
              }
            }
          }
          if (targetWb !== this) return;
          if (this._captureKeydownHandler) {
            this._captureKeydownHandler(e);
          }
        };
        document.addEventListener('keydown', this._documentKeydownHandler);
      }

      this.container.addEventListener('pointerdown', e => {
        if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('#cl-activitybar [data-cl-activity]')) {
          const ae = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
          const focusInOtherRegion = Boolean(
            ae &&
            typeof ae.closest === 'function' &&
            (ae.closest('#cl-drawer') || ae.closest('.codelab-editor-col') || ae.closest('#cl-statusbar'))
          );
          this._sidebarHadFocusOnPointerDown = !focusInOtherRegion;
        } else {
          this._sidebarHadFocusOnPointerDown = undefined;
        }
      }, true);

      this.container.addEventListener('pointerdown', e => {
        CodeLabWorkbench._lastActiveInstance = this;
        this._lastBackdropPointerDownTarget = (e && e.target) ? e.target : null;
        if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('.codelab-menubar__trigger[data-cl-menu]')) {
          this._menuOpenBeforePointerDown = this._activeTopMenu;
        } else {
          this._menuOpenBeforePointerDown = undefined;
        }
      });
      this.container.addEventListener('focusin', () => {
        CodeLabWorkbench._lastActiveInstance = this;
      });

      this.container.addEventListener('mouseover', e => {
        if (!e || !e.target || typeof e.target.closest !== 'function') return;
        if (this._activeTopMenu) {
          const trigger = e.target.closest('.codelab-menubar__trigger[data-cl-menu]');
          if (trigger && trigger.dataset.clMenu && trigger.dataset.clMenu !== this._activeTopMenu) {
            this._openTopbarMenu(trigger.dataset.clMenu, { focusFirstItem: false, viaHover: true });
            return;
          }
          const subWrap = e.target.closest('.codelab-topbar-menu__has-sub');
          if (subWrap) {
            const subMenu = subWrap.querySelector('.codelab-topbar-submenu');
            this._closeSiblingSubmenus(subMenu);
            if (subMenu) {
              if (!subMenu.classList.contains('open')) {
                subMenu._openedViaHoverAt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
                  ? performance.now()
                  : Date.now();
              }
              subMenu.classList.add('open');
              const subBtn = subWrap.querySelector('[data-cl-submenu]');
              if (subBtn) subBtn.setAttribute('aria-expanded', 'true');
              this._positionSubmenu(subWrap, subMenu);
            }
            return;
          }
          const plainItem = e.target.closest('.codelab-topbar-menu__item');
          if (plainItem && !plainItem.closest('.codelab-topbar-submenu') && !plainItem.hasAttribute('data-cl-submenu')) {
            this._closeSiblingSubmenus(null);
          }
        }
      });

      this.container.addEventListener('input', e => {
        if (!e || !e.target) return;
        const t = e.target;
        if (t.id === 'cl-search-input') {
          if (!this._searchState) {
            this._searchState = { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
          }
          this._searchState.query = t.value || '';
          this._renderSearchSidebarResults();
          return;
        }
        if (t.id === 'cl-search-replace-input') {
          if (this._searchState) {
            this._searchState.replaceText = t.value || '';
          }
          return;
        }
        if (t.id === 'cl-search-include') {
          if (!this._searchState) {
            this._searchState = { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
          }
          this._searchState.include = t.value || '';
          this._renderSearchSidebarResults();
          return;
        }
        if (t.id === 'cl-search-exclude') {
          if (!this._searchState) {
            this._searchState = { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
          }
          this._searchState.exclude = t.value || '';
          this._renderSearchSidebarResults();
          return;
        }
        if (t.id === 'cl-scm-commit-input' && typeof t.closest === 'function' && t.closest('#cl-sidebar-scm')) {
          const commitBtn = this.container.querySelector('#cl-sidebar-scm #cl-scm-commit-btn');
          if (commitBtn) {
            const hasStaged = this.getGitStatus().some(s => s && s.staged);
            commitBtn.disabled = !(hasStaged && String(t.value || '').trim().length > 0);
          }
        }
      });

      this.container.addEventListener('change', e => {
        if (!e || !e.target) return;
        const t = e.target;
        if (t.id === 'cl-scm-branch-select' && typeof t.value === 'string' && t.value) {
          this.checkoutGitBranch(t.value);
          this._renderScmSidebar();
          this._updateStatusBar();
        }
      });

      this.container.addEventListener('keydown', e => {
        const keyLower = (e.key || '').toLowerCase();
        const target = e.target;
        const hasClosest = Boolean(target && typeof target.closest === 'function');

        // WAI-ARIA Menubar keyboard navigation
        if (hasClosest && target.closest('#cl-menubar')) {
          const menubar = this.container.querySelector('#cl-menubar');
          const triggers = menubar ? Array.from(menubar.querySelectorAll('.codelab-menubar__trigger')) : [];
          if (triggers.length > 0) {
            const curTrigger = target.closest('.codelab-menubar__trigger') || triggers[0];
            const idx = Math.max(0, triggers.indexOf(curTrigger));
            const moveTriggerFocus = (nextIdx) => {
              triggers.forEach((btn, i) => btn.setAttribute('tabindex', i === nextIdx ? '0' : '-1'));
              const nextBtn = triggers[nextIdx];
              if (nextBtn && typeof nextBtn.focus === 'function') nextBtn.focus();
              if (this._activeTopMenu && nextBtn && nextBtn.dataset.clMenu) {
                this._openTopbarMenu(nextBtn.dataset.clMenu, { focusFirstItem: false });
              }
            };
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              moveTriggerFocus((idx + 1) % triggers.length);
              return;
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              moveTriggerFocus((idx - 1 + triggers.length) % triggers.length);
              return;
            }
            if (e.key === 'Home') {
              e.preventDefault();
              moveTriggerFocus(0);
              return;
            }
            if (e.key === 'End') {
              e.preventDefault();
              moveTriggerFocus(triggers.length - 1);
              return;
            }
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (curTrigger && curTrigger.dataset.clMenu) {
                this._openTopbarMenu(curTrigger.dataset.clMenu, { focusFirstItem: true });
              }
              return;
            }
            if (e.key === 'Escape' && this._activeTopMenu) {
              e.preventDefault();
              e.stopPropagation();
              this._closeTopbarMenu({ restoreFocus: true });
              return;
            }
          }
        }

        // WAI-ARIA Open Dropdown Menu keyboard navigation (#cl-topbar-menu-slot)
        if (hasClosest && target.closest('#cl-topbar-menu-slot')) {
          const slot = this.container.querySelector('#cl-topbar-menu-slot');
          const inSubmenu = target.closest('.codelab-topbar-submenu');
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (inSubmenu && inSubmenu.classList.contains('open')) {
              inSubmenu.classList.remove('open');
              const parentWrap = inSubmenu.closest('.codelab-topbar-menu__has-sub');
              const parentBtn = parentWrap ? parentWrap.querySelector('[data-cl-submenu]') : null;
              if (parentBtn) {
                parentBtn.setAttribute('aria-expanded', 'false');
                if (typeof parentBtn.focus === 'function') parentBtn.focus();
              }
              return;
            }
            this._closeTopbarMenu({ restoreFocus: true });
            return;
          }
          if (e.key === 'Tab') {
            this._closeTopbarMenu({ restoreFocus: false });
            return;
          }
          const menuScope = inSubmenu || (slot && slot.querySelector('.codelab-topbar-menu'));
          const allItems = menuScope
            ? Array.from(menuScope.querySelectorAll('.codelab-topbar-menu__item')).filter(el => {
                if (el.disabled) return false;
                if (!inSubmenu && el.closest('.codelab-topbar-submenu')) return false;
                return true;
              })
            : [];
          const curItem = target.closest('.codelab-topbar-menu__item');
          const curIdx = curItem ? allItems.indexOf(curItem) : -1;

          if (e.key === 'ArrowDown' && allItems.length > 0) {
            e.preventDefault();
            const next = allItems[(curIdx + 1) % allItems.length];
            if (next && typeof next.focus === 'function') next.focus();
            return;
          }
          if (e.key === 'ArrowUp' && allItems.length > 0) {
            e.preventDefault();
            const prev = allItems[(curIdx <= 0 ? allItems.length - 1 : curIdx - 1)];
            if (prev && typeof prev.focus === 'function') prev.focus();
            return;
          }
          if (e.key === 'Home' && allItems.length > 0) {
            e.preventDefault();
            if (typeof allItems[0].focus === 'function') allItems[0].focus();
            return;
          }
          if (e.key === 'End' && allItems.length > 0) {
            e.preventDefault();
            const last = allItems[allItems.length - 1];
            if (last && typeof last.focus === 'function') last.focus();
            return;
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (curItem && curItem.hasAttribute('data-cl-submenu')) {
              const wrap = curItem.closest('.codelab-topbar-menu__has-sub');
              const sm = wrap ? wrap.querySelector('.codelab-topbar-submenu') : null;
              if (sm) {
                this._closeSiblingSubmenus(sm);
                sm.classList.add('open');
                curItem.setAttribute('aria-expanded', 'true');
                this._positionSubmenu(wrap, sm);
                const firstSub = sm.querySelector('.codelab-topbar-menu__item');
                if (firstSub && typeof firstSub.focus === 'function') firstSub.focus();
                return;
              }
            }
            const menubar = this.container.querySelector('#cl-menubar');
            const triggers = menubar ? Array.from(menubar.querySelectorAll('.codelab-menubar__trigger')) : [];
            const activeTriggerIdx = triggers.findIndex(b => b.dataset.clMenu === this._activeTopMenu);
            if (triggers.length > 0) {
              const nextTrigger = triggers[(activeTriggerIdx + 1) % triggers.length];
              if (nextTrigger && nextTrigger.dataset.clMenu) {
                this._openTopbarMenu(nextTrigger.dataset.clMenu, { focusFirstItem: true });
              }
            }
            return;
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (inSubmenu) {
              inSubmenu.classList.remove('open');
              const parentWrap = inSubmenu.closest('.codelab-topbar-menu__has-sub');
              const parentBtn = parentWrap ? parentWrap.querySelector('[data-cl-submenu]') : null;
              if (parentBtn) {
                parentBtn.setAttribute('aria-expanded', 'false');
                if (typeof parentBtn.focus === 'function') parentBtn.focus();
              }
              return;
            }
            const menubar = this.container.querySelector('#cl-menubar');
            const triggers = menubar ? Array.from(menubar.querySelectorAll('.codelab-menubar__trigger')) : [];
            const activeTriggerIdx = triggers.findIndex(b => b.dataset.clMenu === this._activeTopMenu);
            if (triggers.length > 0) {
              const prevTrigger = triggers[(activeTriggerIdx - 1 + triggers.length) % triggers.length];
              if (prevTrigger && prevTrigger.dataset.clMenu) {
                this._openTopbarMenu(prevTrigger.dataset.clMenu, { focusFirstItem: true });
              }
            }
            return;
          }
          if ((e.key === 'Enter' || e.key === ' ') && curItem) {
            e.preventDefault();
            if (curItem.hasAttribute('data-cl-submenu')) {
              const wrap = curItem.closest('.codelab-topbar-menu__has-sub');
              const sm = wrap ? wrap.querySelector('.codelab-topbar-submenu') : null;
              if (sm) {
                const willOpen = !sm.classList.contains('open');
                this._closeSiblingSubmenus(willOpen ? sm : null);
                sm.classList.toggle('open', willOpen);
                curItem.setAttribute('aria-expanded', String(willOpen));
                if (willOpen) {
                  this._positionSubmenu(wrap, sm);
                  const firstSub = sm.querySelector('.codelab-topbar-menu__item');
                  if (firstSub && typeof firstSub.focus === 'function') {
                    firstSub.focus();
                  }
                }
              }
              return;
            }
            const cmd = curItem.dataset.clMenuCmd;
            if (cmd && !curItem.disabled) {
              this._closeTopbarMenu({ restoreFocus: false });
              this._executeTopbarMenuCommand(cmd);
            }
            return;
          }
        }

        // WAI-ARIA Editor Tab Strip keyboard navigation (#cl-tabs, #cl-file-tabs)
        if (hasClosest && target.closest('#cl-tabs, #cl-file-tabs')) {
          const tabStrip = this.container.querySelector('#cl-tabs, #cl-file-tabs');
          const closeSpan = target.closest('[data-action="close-tab"], .codelab-tab__close');
          if (closeSpan && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            const ownerTab = closeSpan.closest('.codelab-tab');
            const beforeTabs = tabStrip ? Array.from(tabStrip.querySelectorAll('.codelab-tab')) : [];
            const closedIdx = ownerTab ? Math.max(0, beforeTabs.indexOf(ownerTab)) : 0;
            const tabKey = closeSpan.dataset.clCloseTab || (ownerTab && ownerTab.dataset.clTab);
            if (tabKey === '__settings__') {
              this.closeSettings();
            } else {
              const fname = closeSpan.dataset.clCloseFile || (ownerTab && ownerTab.dataset.clFile);
              if (fname) this.closeTab(fname);
            }
            const afterStrip = this.container.querySelector('#cl-tabs, #cl-file-tabs');
            const afterTabs = afterStrip ? Array.from(afterStrip.querySelectorAll('.codelab-tab')) : [];
            const nextTab = afterTabs[Math.min(closedIdx, afterTabs.length - 1)];
            if (nextTab && typeof nextTab.focus === 'function') nextTab.focus();
            else this._restoreWorkbenchFocus(null);
            return;
          }
          const tabEl = target.closest('.codelab-tab');
          const tabs = tabStrip ? Array.from(tabStrip.querySelectorAll('.codelab-tab')) : [];
          if (tabEl && tabs.length > 0) {
            const idx = Math.max(0, tabs.indexOf(tabEl));
            const activateTabAt = (nextIdx) => {
              const nextEl = tabs[nextIdx];
              if (!nextEl) return;
              if (nextEl.dataset.clTab === '__settings__') {
                this.activeTab = '__settings__';
                this._syncActiveFileToView();
              } else if (nextEl.dataset.clFile) {
                this.openFile(nextEl.dataset.clFile);
              }
              const refreshedStrip = this.container.querySelector('#cl-tabs, #cl-file-tabs');
              const refreshedTabs = refreshedStrip ? Array.from(refreshedStrip.querySelectorAll('.codelab-tab')) : [];
              const matchEl = refreshedTabs[nextIdx] || refreshedTabs[0];
              if (matchEl && typeof matchEl.focus === 'function') matchEl.focus();
            };
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              activateTabAt((idx + 1) % tabs.length);
              return;
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              activateTabAt((idx - 1 + tabs.length) % tabs.length);
              return;
            }
            if (e.key === 'Home') {
              e.preventDefault();
              activateTabAt(0);
              return;
            }
            if (e.key === 'End') {
              e.preventDefault();
              activateTabAt(tabs.length - 1);
              return;
            }
            if (e.key === 'Delete') {
              e.preventDefault();
              if (tabEl.dataset.clTab === '__settings__') {
                this.closeSettings();
              } else if (tabEl.dataset.clFile) {
                this.closeTab(tabEl.dataset.clFile);
              }
              const afterStrip = this.container.querySelector('#cl-tabs, #cl-file-tabs');
              const afterTabs = afterStrip ? Array.from(afterStrip.querySelectorAll('.codelab-tab')) : [];
              const nextTab = afterTabs[Math.min(idx, afterTabs.length - 1)];
              if (nextTab && typeof nextTab.focus === 'function') nextTab.focus();
              else this._restoreWorkbenchFocus(null);
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              activateTabAt(idx);
              return;
            }
          }
        }

        // WAI-ARIA Bottom Panel Tab Strip keyboard navigation (.codelab-drawer__tabs)
        if (hasClosest && target.closest('.codelab-drawer__tabs')) {
          const drawerStrip = target.closest('.codelab-drawer__tabs');
          const visibleDrawerTabs = drawerStrip
            ? Array.from(drawerStrip.querySelectorAll('[role="tab"][data-cl-drawertab]')).filter(btn => {
                if (btn.hidden || btn.disabled) return false;
                if (btn.style && btn.style.display === 'none') return false;
                if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
                  try {
                    if (window.getComputedStyle(btn).display === 'none') return false;
                  } catch (err) {
                    void err;
                  }
                }
                return true;
              })
            : [];
          const curDrawerBtn = target.closest('[role="tab"][data-cl-drawertab]');
          if (curDrawerBtn && visibleDrawerTabs.length > 0) {
            const idx = Math.max(0, visibleDrawerTabs.indexOf(curDrawerBtn));
            const moveDrawerTab = (nextIdx) => {
              const nextBtn = visibleDrawerTabs[nextIdx];
              if (!nextBtn || !nextBtn.dataset.clDrawertab) return;
              this.switchDrawerTab(nextBtn.dataset.clDrawertab, { focus: false });
              if (typeof nextBtn.focus === 'function') nextBtn.focus();
            };
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              moveDrawerTab((idx + 1) % visibleDrawerTabs.length);
              return;
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              moveDrawerTab((idx - 1 + visibleDrawerTabs.length) % visibleDrawerTabs.length);
              return;
            }
            if (e.key === 'Home') {
              e.preventDefault();
              moveDrawerTab(0);
              return;
            }
            if (e.key === 'End') {
              e.preventDefault();
              moveDrawerTab(visibleDrawerTabs.length - 1);
              return;
            }
          }
        }

        // WAI-ARIA Guided Lab Tab Strip & Mode Switch keyboard navigation
        if (hasClosest && (target.closest('.codelab-guide__tabs') || target.closest('.codelab-mode-switch'))) {
          const strip = target.closest('.codelab-guide__tabs') || target.closest('.codelab-mode-switch');
          const roleTabs = strip ? Array.from(strip.querySelectorAll('[role="tab"]')).filter(btn => !btn.hidden && !btn.disabled) : [];
          const curBtn = target.closest('[role="tab"]');
          if (curBtn && roleTabs.length > 0) {
            const idx = Math.max(0, roleTabs.indexOf(curBtn));
            const moveRoleTab = (nextIdx) => {
              roleTabs.forEach((b, i) => b.setAttribute('tabindex', i === nextIdx ? '0' : '-1'));
              const nextBtn = roleTabs[nextIdx];
              if (!nextBtn) return;
              if (typeof nextBtn.click === 'function') nextBtn.click();
              const liveStrip = strip.classList.contains('codelab-guide__tabs')
                ? this.container.querySelector('.codelab-guide__tabs')
                : this.container.querySelector('.codelab-mode-switch');
              const liveTabs = liveStrip ? Array.from(liveStrip.querySelectorAll('[role="tab"]')).filter(b => !b.hidden && !b.disabled) : [];
              const liveBtn = liveTabs[nextIdx] || nextBtn;
              if (liveBtn && typeof liveBtn.focus === 'function') liveBtn.focus();
            };
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              moveRoleTab((idx + 1) % roleTabs.length);
              return;
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              moveRoleTab((idx - 1 + roleTabs.length) % roleTabs.length);
              return;
            }
            if (e.key === 'Home') {
              e.preventDefault();
              moveRoleTab(0);
              return;
            }
            if (e.key === 'End') {
              e.preventDefault();
              moveRoleTab(roleTabs.length - 1);
              return;
            }
          }
        }

        // Sidebar Search & SCM input Enter shortcuts
        if (target && (target.id === 'cl-search-input' || target.id === 'cl-search-include' || target.id === 'cl-search-exclude') && e.key === 'Enter' && hasClosest && target.closest('#cl-sidebar-search')) {
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          this._renderSearchSidebarResults();
          return;
        }
        if (target && target.id === 'cl-search-replace-input' && e.key === 'Enter' && hasClosest && target.closest('#cl-sidebar-search')) {
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          this._executeSidebarReplaceAll();
          return;
        }
        if (target && target.id === 'cl-scm-new-branch-input' && hasClosest && target.closest('#cl-sidebar-scm')) {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this._scmCreatingBranch = false;
            this._renderScmSidebar();
            return;
          }
          if (e.key === 'Enter') {
            if (e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            const bName = String(target.value || '').trim();
            if (bName && this.createGitBranch(bName, true)) {
              this._scmCreatingBranch = false;
              this._renderScmSidebar();
              this._updateStatusBar();
            }
            return;
          }
        }
        if (target && (e.key === 'Enter' || e.key === ' ') && hasClosest && target.closest('.codelab-session-pill')) {
          const pillAct = target.closest('[data-cl-action]');
          if (pillAct && typeof pillAct.click === 'function') {
            e.preventDefault();
            pillAct.click();
            return;
          }
        }
        if (target && target.id === 'cl-scm-commit-input' && e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey) && hasClosest && target.closest('#cl-sidebar-scm')) {
          if (e.isComposing || e.keyCode === 229) return;
          const msg = String(target.value || '').trim();
          if (msg) {
            e.preventDefault();
            const hash = this.commitGitChanges(msg);
            if (hash) {
              target.value = '';
              this._renderScmSidebar();
              this._updateStatusBar();
            }
          }
          return;
        }

        const previewInput = hasClosest
          ? target.closest('#cl-preview-url-input')
          : null;
        if (previewInput && e.key === 'Enter') {
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          this._previewGo(previewInput.value);
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === ',') {
          e.preventDefault();
          this.openSettings();
          return;
        }
        if (this.keybindings && this.commands && typeof this.keybindings.resolve === 'function') {
          const kbRule = this.keybindings.resolve(e);
          if (kbRule && this.commands.hasCommand(kbRule.command)) {
            const activeTag = e.target && e.target.tagName ? String(e.target.tagName).toUpperCase() : '';
            const hasMod = Boolean(e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/i.test(e.key || ''));
            if (hasMod || (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA')) {
              e.preventDefault();
              const cmdArgs = Array.isArray(kbRule.args) ? kbRule.args : (kbRule.args !== undefined ? [kbRule.args] : []);
              this.commands.executeCommand(kbRule.command, ...cmdArgs).catch((err) => {
                this.logger.warn(`Keybinding command "${kbRule.command}" failed.`, err);
              });
              return;
            }
          }
        }
        if (e.key === 'Escape' && this.folderSwitcherOpen) {
          this.folderSwitcherOpen = false;
          this._renderBreadcrumbs();
          return;
        }
        if (e.key === 'F1' || ((e.metaKey || e.ctrlKey) && e.shiftKey && keyLower === 'p')) {
          e.preventDefault();
          this.openCommandPalette('commands');
          return;
        }
        if (e.key === 'F2' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const activeTag = e.target && e.target.tagName ? String(e.target.tagName).toUpperCase() : '';
          const inMonaco = e.target && typeof e.target.closest === 'function' && Boolean(e.target.closest('.monaco-editor'));
          if (!inMonaco && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            const focusedFolderEl = e.target && typeof e.target.closest === 'function'
              ? e.target.closest('.codelab-folder-item[data-cl-folder]')
              : null;
            if (focusedFolderEl && focusedFolderEl.dataset.clFolder) {
              e.preventDefault();
              this.startInlineRename('folder', focusedFolderEl.dataset.clFolder);
              return;
            }
            const focusedFileEl = e.target && typeof e.target.closest === 'function'
              ? e.target.closest('.codelab-file-item[data-cl-file]')
              : null;
            if (focusedFileEl && focusedFileEl.dataset.clFile) {
              e.preventDefault();
              this.startInlineRename('file', focusedFileEl.dataset.clFile);
              return;
            }
            if (this.activeFile) {
              e.preventDefault();
              this.startInlineRename('file', this.activeFile);
              return;
            }
          }
        }
        if ((e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) && !e.altKey) {
          const activeTag = e.target && e.target.tagName ? String(e.target.tagName).toUpperCase() : '';
          const inExplorer = e.target && typeof e.target.closest === 'function' && Boolean(e.target.closest('#cl-explorer-list'));
          if (inExplorer && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            const focusedFolderEl = e.target.closest('.codelab-folder-item[data-cl-folder]');
            if (focusedFolderEl && focusedFolderEl.dataset.clFolder) {
              e.preventDefault();
              this._confirmDeletePath('folder', focusedFolderEl.dataset.clFolder);
              return;
            }
            const focusedFileEl = e.target.closest('.codelab-file-item[data-cl-file]');
            if (focusedFileEl && focusedFileEl.dataset.clFile) {
              e.preventDefault();
              this._confirmDeletePath('file', focusedFileEl.dataset.clFile);
              return;
            }
          }
        }
        if ((e.metaKey || e.ctrlKey) && keyLower === 'k') {
          e.preventDefault();
          this.openCommandPalette('commands');
          return;
        }
        if (e.altKey && e.shiftKey && keyLower === 'f') {
          e.preventDefault();
          this.formatActiveDocument();
          return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && keyLower === 'p') {
          e.preventDefault();
          this.openCommandPalette('files');
          return;
        }
        if (e.ctrlKey && !e.metaKey && keyLower === 'c') {
          const hasSelection = typeof window !== 'undefined' && window.getSelection && window.getSelection().toString().length > 0;
          if (!hasSelection && (this.isRunning || this._activeCommandAbortController)) {
            e.preventDefault();
            this._handleInterrupt();
            return;
          }
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          if (e.defaultPrevented || (e.target && typeof e.target.closest === 'function' && e.target.closest('#cl-sql-editor-host'))) {
            return;
          }
          e.preventDefault();
          if (e.shiftKey) {
            if (this.mode === 'guided') {
              this.runDemo();
            } else {
              this.runActiveFile();
            }
          } else if (this.mode === 'guided') {
            this.verifyCurrentStep();
          } else {
            this.runCode();
          }
        }
      });

      this.container.addEventListener('contextmenu', e => {
        const tabEl = e.target.closest('.codelab-tab');
        if (tabEl && (tabEl.dataset.clFile || tabEl.dataset.tabFile)) {
          e.preventDefault();
          const fname = tabEl.dataset.clFile || tabEl.dataset.tabFile;
          const x = e.clientX || 120;
          const y = e.clientY || 80;
          this.openContextMenu(x, y, [
            { label: 'Close', shortcut: '⌘W', action: 'close-tab', target: fname },
            { label: 'Close Others', action: 'close-other-tabs', target: fname },
            { label: 'Close All', action: 'close-all-tabs', target: fname },
            { divider: true },
            { label: 'Compare with Solution', action: 'compare-solution', target: fname },
            { label: 'Compare with Starter', action: 'compare-starter', target: fname }
          ]);
          return;
        }

        const fileEl = e.target.closest('.codelab-file-item');
        if (fileEl && (fileEl.dataset.clFile || fileEl.dataset.file)) {
          e.preventDefault();
          const fname = fileEl.dataset.clFile || fileEl.dataset.file;
          const x = e.clientX || 120;
          const y = e.clientY || 120;
          this.openContextMenu(x, y, [
            { label: 'Open File', action: 'open-file', target: fname },
            { label: 'Rename...', shortcut: 'F2', action: 'rename-file', ctx: 'rename', target: fname },
            { label: 'Duplicate File', action: 'duplicate-file', target: fname },
            { divider: true },
            { label: 'Compare with Solution', action: 'compare-solution', target: fname },
            { label: 'Compare with Starter', action: 'compare-starter', target: fname },
            { divider: true },
            { label: 'Download File', action: 'download-file', target: fname },
            { label: 'Delete File', action: 'delete-file', ctx: 'delete', target: fname, danger: true }
          ]);
          return;
        }

        const folderEl = e.target.closest('.codelab-folder-item');
        if (folderEl && (folderEl.dataset.clFolder || folderEl.dataset.folder)) {
          e.preventDefault();
          const folder = folderEl.dataset.clFolder || folderEl.dataset.folder;
          const x = e.clientX || 120;
          const y = e.clientY || 120;
          this.openContextMenu(x, y, [
            { label: 'New File in Folder...', action: 'new-file-in-folder', target: folder },
            { label: 'New Subfolder...', action: 'new-subfolder', target: folder },
            { divider: true },
            { label: 'Rename Folder...', shortcut: 'F2', action: 'rename-folder-ctx', ctx: 'rename', target: folder },
            { label: 'Delete Folder', action: 'delete-folder-ctx', ctx: 'delete', target: folder, danger: true }
          ]);
        }
      });

      const handleTabMiddleClick = e => {
        if (e.button === 1) {
          const tabEl = e.target.closest('.codelab-tab');
          if (tabEl && tabEl.dataset.clTab === '__settings__') {
            e.preventDefault();
            e.stopPropagation();
            this.closeSettings();
          } else if (tabEl && tabEl.dataset.clFile) {
            e.preventDefault();
            e.stopPropagation();
            this.closeTab(tabEl.dataset.clFile);
          }
        }
      };
      this.container.addEventListener('auxclick', handleTabMiddleClick);
      this.container.addEventListener('mousedown', handleTabMiddleClick);

      this.container.addEventListener('click', e => {
        const menuCmdBtn = e.target.closest('[data-cl-menu-cmd]');
        if (menuCmdBtn) {
          e.stopPropagation();
          if (menuCmdBtn.disabled) return;
          const cmd = menuCmdBtn.dataset.clMenuCmd;
          this._closeTopbarMenu({ restoreFocus: false });
          if (cmd) this._executeTopbarMenuCommand(cmd);
          return;
        }

        const subTrigger = e.target.closest('[data-cl-submenu]');
        if (subTrigger) {
          e.stopPropagation();
          const wrap = subTrigger.closest('.codelab-topbar-menu__has-sub');
          const sm = wrap ? wrap.querySelector('.codelab-topbar-submenu') : null;
          if (sm) {
            const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
              ? performance.now()
              : Date.now();
            const justHoverOpened = sm.classList.contains('open') && sm._openedViaHoverAt && (now - sm._openedViaHoverAt < 500);
            sm._openedViaHoverAt = 0;
            const willOpen = justHoverOpened ? true : !sm.classList.contains('open');
            this._closeSiblingSubmenus(willOpen ? sm : null);
            sm.classList.toggle('open', willOpen);
            subTrigger.setAttribute('aria-expanded', String(willOpen));
            if (willOpen) this._positionSubmenu(wrap, sm);
          }
          return;
        }

        const menuTrigger = e.target.closest('.codelab-menubar__trigger[data-cl-menu]');
        if (menuTrigger) {
          e.stopPropagation();
          const menuId = menuTrigger.dataset.clMenu;
          const now = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
          const justHoverSwitched = this._activeTopMenu === menuId
            && this._activeTopMenuOpenedViaHover
            && (now - (this._activeTopMenuOpenedAt || 0) < 500);
          const openedDuringPress = this._menuOpenBeforePointerDown !== undefined
            && this._menuOpenBeforePointerDown !== menuId;
          this._menuOpenBeforePointerDown = undefined;
          if (this._activeTopMenu === menuId && !justHoverSwitched && !openedDuringPress) {
            this._closeTopbarMenu({ restoreFocus: true });
          } else if (menuId) {
            this._activeTopMenuOpenedViaHover = false;
            if (this._activeTopMenu !== menuId) {
              this._openTopbarMenu(menuId, { focusFirstItem: true, viaHover: false });
            } else {
              const firstBtn = this.container.querySelector('#cl-topbar-menu-slot .codelab-topbar-menu > .codelab-topbar-menu__item, #cl-topbar-menu-slot .codelab-topbar-menu__item');
              if (firstBtn && typeof firstBtn.focus === 'function') firstBtn.focus();
            }
          }
          return;
        }

        if (this._activeTopMenu && !e.target.closest('#cl-topbar-menu-slot')) {
          const prior = this._menuReturnFocusEl || null;
          this._closeTopbarMenu({ restoreFocus: false });
          if (typeof document !== 'undefined') {
            const ae = document.activeElement;
            if (!ae || ae === document.body || ae === document.documentElement) {
              this._restoreWorkbenchFocus(prior);
            }
          }
        }

        const ctxBtn = e.target.closest('[data-ctx-action]');
        if (ctxBtn) {
          e.stopPropagation();
          const act = ctxBtn.dataset.ctxAction;
          const target = ctxBtn.dataset.ctxTarget || '';
          this.closeContextMenu();
          if (act === 'open-file' && target) this.openFile(target);
          else if (act === 'rename-file' && target) this.startInlineRename('file', target);
          else if (act === 'duplicate-file' && target) this.duplicateFile(target);
          else if (act === 'compare-solution' && target) {
            this.openFile(target);
            this.showDiffModal(target, 'solution');
          } else if (act === 'compare-starter' && target) {
            this.openFile(target);
            this.showDiffModal(target, 'starter');
          } else if (act === 'download-file' && target) this.downloadFile(target);
          else if (act === 'delete-file' && target) this._confirmDeletePath('file', target);
          else if (act === 'new-file-in-folder') this.startInlineCreate('file', target);
          else if (act === 'new-subfolder') this.startInlineCreate('folder', target);
          else if (act === 'rename-folder-ctx' && target) this.startInlineRename('folder', target);
          else if (act === 'delete-folder-ctx' && target) this._confirmDeletePath('folder', target);
          else if (act === 'close-tab' && target) this.closeTab(target);
          else if (act === 'close-other-tabs' && target) this.closeOtherTabs(target);
          else if (act === 'close-all-tabs') this.closeAllTabs();
          return;
        }

        // Dismiss context menu on outside click
        const ctxSlot = this.container.querySelector('#cl-context-menu-slot');
        if (ctxSlot && ctxSlot.innerHTML.trim() !== '' && !e.target.closest('.codelab-context-menu')) {
          this.closeContextMenu();
        }

        const paletteItem = e.target.closest('[data-palette-idx]');
        if (paletteItem) {
          e.stopPropagation();
          const idx = Number(paletteItem.dataset.paletteIdx);
          this._executePaletteSelection(idx);
          return;
        }

        if (e.target.classList && (e.target.classList.contains('codelab-palette-backdrop') || e.target.classList.contains('codelab-modal-backdrop'))) {
          const pointerDownTarget = this._lastBackdropPointerDownTarget;
          this._lastBackdropPointerDownTarget = null;
          if (pointerDownTarget && pointerDownTarget !== e.target) return;
          if (this._cloneInFlight) return;
          this.closeModal();
          return;
        }
        this._lastBackdropPointerDownTarget = null;

        const copyBtn = e.target.closest('[data-cl-action="copy-code"], .codelab-copy-code-btn');
        if (copyBtn) {
          e.stopPropagation();
          const block = copyBtn.closest('.codelab-code-block');
          let rawCode = '';
          if (block && block.dataset.clCode) {
            try {
              rawCode = decodeURIComponent(block.dataset.clCode);
            } catch (_) {
              rawCode = block.dataset.clCode;
            }
          } else if (block) {
            const codeEl = block.querySelector('code');
            rawCode = codeEl ? codeEl.textContent : '';
          }

          const doSuccessFeedback = () => {
            copyBtn.classList.add('copied');
            const textSpan = copyBtn.querySelector('.codelab-copy-code-btn__text');
            const originalText = textSpan ? textSpan.textContent : 'Copy';
            if (textSpan) textSpan.textContent = 'Copied!';
            if (copyBtn._copyTimeout) clearTimeout(copyBtn._copyTimeout);
            copyBtn._copyTimeout = setTimeout(() => {
              copyBtn.classList.remove('copied');
              if (textSpan) textSpan.textContent = originalText;
              copyBtn._copyTimeout = null;
            }, 2000);
          };

          const copyFallback = (text) => {
            try {
              const textarea = document.createElement('textarea');
              textarea.value = text;
              textarea.style.position = 'fixed';
              textarea.style.top = '-9999px';
              textarea.style.left = '-9999px';
              textarea.style.opacity = '0';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
            } catch (err) {
              this.logger.warn('Clipboard fallback (execCommand) failed.', err);
            }
          };

          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(rawCode).then(doSuccessFeedback).catch(() => {
              copyFallback(rawCode);
              doSuccessFeedback();
            });
          } else {
            copyFallback(rawCode);
            doSuccessFeedback();
          }
          return;
        }

        const fsToggle = e.target.closest('[data-cl-action="toggle-folder-switcher"]');
        if (fsToggle) {
          e.stopPropagation();
          this.folderSwitcherOpen = !this.folderSwitcherOpen;
          this._renderBreadcrumbs();
          return;
        }

        const fsOption = e.target.closest('[data-cl-folder-option]');
        if (fsOption) {
          e.stopPropagation();
          const scopeVal = fsOption.dataset.clFolderOption || '';
          this.explorerFolder = scopeVal;
          if (scopeVal) this.collapsedFolders.delete(scopeVal);
          this.folderSwitcherOpen = false;
          this._renderFileLists();
          this._renderBreadcrumbs();
          return;
        }

        if (this.folderSwitcherOpen && !e.target.closest('.codelab-folder-switcher')) {
          this.folderSwitcherOpen = false;
          this._renderBreadcrumbs();
        }

        const bcFolder = e.target.closest('[data-cl-breadcrumb-folder]');
        if (bcFolder) {
          const folder = bcFolder.dataset.clBreadcrumbFolder;
          if (folder) {
            this.collapsedFolders.delete(folder);
            this.explorerFolder = folder;
            this._renderFileLists();
            this._renderBreadcrumbs();
          }
          return;
        }

        const bcFile = e.target.closest('[data-cl-breadcrumb-file]');
        if (bcFile) {
          const fname = bcFile.dataset.clBreadcrumbFile;
          if (fname) this.openFile(fname);
          return;
        }

        const closeBtn = e.target.closest('[data-action="close-tab"], .codelab-tab__close');
        if (closeBtn) {
          e.stopPropagation();
          const tabEl = closeBtn.closest('.codelab-tab') || closeBtn;
          const tabKey = closeBtn.dataset.clCloseTab || closeBtn.dataset.clTab || tabEl.dataset.clTab;
          if (tabKey === '__settings__') {
            this.closeSettings();
            return;
          }
          const fname = closeBtn.dataset.clCloseFile || closeBtn.dataset.clFile || tabEl.dataset.clFile;
          if (fname) this.closeTab(fname);
          return;
        }

        const settingsTabBtn = e.target.closest('[data-cl-tab="__settings__"]');
        if (settingsTabBtn) {
          this._activeScmDiffFile = null;
          this.activeTab = '__settings__';
          this._syncActiveFileToView();
          return;
        }

        const activityBtn = e.target.closest('[data-cl-activity]');
        if (activityBtn) {
          const actId = activityBtn.dataset.clActivity;
          if (actId === 'settings') {
            this.openSettings();
            return;
          }
          if (actId) {
            const hadSidebarFocus = this._sidebarHadFocusOnPointerDown !== undefined
              ? this._sidebarHadFocusOnPointerDown
              : !(typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.closest === 'function' && (document.activeElement.closest('#cl-drawer') || document.activeElement.closest('.codelab-editor-col') || document.activeElement.closest('#cl-statusbar')));
            this._sidebarHadFocusOnPointerDown = undefined;
            if (this.sidebarVisible && this.activeSidebarView === actId && hadSidebarFocus) {
              this.setSidebarVisible(false);
            } else {
              this.setSidebarView(actId, { ensureOpen: true, focus: true });
            }
            return;
          }
        }

        const sevFilterBtn = e.target.closest('[data-cl-severity-filter]');
        if (sevFilterBtn) {
          this._problemsSeverityFilter = sevFilterBtn.dataset.clSeverityFilter || 'all';
          const bodyEl = this.container.querySelector('#cl-drawer-body');
          if (bodyEl && this.drawerTab === 'problems') {
            this._renderProblemsPanel(bodyEl);
          }
          return;
        }

        const scmRowTarget = e.target.closest('.codelab-scm-entry[data-scm-path]');
        if (scmRowTarget && !e.target.closest('button, [data-cl-action], [data-action]')) {
          const p = scmRowTarget.dataset.scmPath;
          const staged = scmRowTarget.dataset.scmStaged === 'true';
          if (p) {
            this.openScmDiff(p, { staged });
            return;
          }
        }

        const searchOptBtn = e.target.closest('[data-cl-search-opt]');
        if (searchOptBtn) {
          const opt = searchOptBtn.dataset.clSearchOpt;
          if (opt && this._searchState && Object.prototype.hasOwnProperty.call(this._searchState, opt)) {
            this._searchState[opt] = !this._searchState[opt];
            const active = Boolean(this._searchState[opt]);
            searchOptBtn.classList.toggle('active', active);
            searchOptBtn.setAttribute('aria-pressed', String(active));
            this._renderSearchSidebarResults();
          }
          return;
        }

        const deleteBtn = e.target.closest('[data-cl-delete-file]');
        if (deleteBtn) {
          e.stopPropagation();
          this._confirmDeletePath('file', deleteBtn.dataset.clDeleteFile);
          return;
        }

        const modeBtn = e.target.closest('[data-cl-mode]');
        if (modeBtn) {
          this.setMode(modeBtn.dataset.clMode);
          return;
        }

        const langBtn = e.target.closest('[data-cl-lang]');
        if (langBtn) {
          this.setLanguage(langBtn.dataset.clLang);
          return;
        }

        // CRITICAL: Handle [data-cl-search-file] BEFORE [data-cl-file] so search matches jump to (line, col) without closing Search sidebar!
        const searchMatch = e.target.closest('[data-cl-search-file]');
        if (searchMatch) {
          e.stopPropagation();
          const sFile = searchMatch.dataset.clSearchFile;
          const sLine = Math.max(1, Number(searchMatch.dataset.clSearchLine || 1));
          const sCol = Math.max(1, Number(searchMatch.dataset.clSearchCol || 1));
          if (searchMatch.closest('#cl-modal-slot')) {
            this.closeModal();
          }
          if (sFile) {
            this.openFile(sFile);
            this._revealLineColInActiveEditor(sLine, sCol);
          }
          return;
        }

        const fileBtn = e.target.closest('[data-cl-file]');
        if (fileBtn) {
          this._activeScmDiffFile = null;
          this.openFile(fileBtn.dataset.clFile);
          return;
        }

        const jumpBtn = e.target.closest('[data-cl-jump-file]');
        if (jumpBtn) {
          this.openFile(jumpBtn.dataset.clJumpFile, jumpBtn.dataset.clJumpSymbol);
          return;
        }

        const stepBtn = e.target.closest('[data-cl-step]');
        if (stepBtn && !stepBtn.disabled) {
          const idx = Number(stepBtn.dataset.clStep);
          if (!Number.isNaN(idx) && idx >= 0 && idx < this.steps.length) {
            this.selectStep(idx, true);
          }
          return;
        }

        const guideTabBtn = e.target.closest('[data-cl-guidetab]');
        if (guideTabBtn) {
          this.guideTab = guideTabBtn.dataset.clGuidetab;
          this._renderGuidePane();
          return;
        }

        const splitTrigger = e.target.closest('#cl-split-run-trigger');
        if (splitTrigger) {
          e.stopPropagation();
          const menu = this.container.querySelector('#cl-split-run-menu');
          if (menu) {
            const isOpen = !(menu.classList.contains('active') || menu.classList.contains('open'));
            menu.classList.toggle('active', isOpen);
            menu.classList.toggle('open', isOpen);
            if (isOpen && typeof menu.getBoundingClientRect === 'function' && typeof window !== 'undefined' && menu.style) {
              menu.style.right = '0';
              menu.style.left = 'auto';
              const r = menu.getBoundingClientRect();
              if (r.left < 8) {
                menu.style.right = 'auto';
                menu.style.left = '0';
              }
            }
          }
          return;
        }

        const splitMenu = this.container.querySelector('#cl-split-run-menu');
        if (splitMenu && (splitMenu.classList.contains('active') || splitMenu.classList.contains('open')) && !e.target.closest('.codelab-btn-split')) {
          splitMenu.classList.remove('active');
          splitMenu.classList.remove('open');
        }

        const problemItem = e.target.closest('[data-cl-problem-file], [data-problem-file]');
        if (problemItem) {
          e.stopPropagation();
          const pFile = problemItem.dataset.clProblemFile || problemItem.dataset.problemFile;
          const pLine = Number(problemItem.dataset.clProblemLine || problemItem.dataset.problemLine || 1);
          const pCol = Number(problemItem.dataset.clProblemCol || problemItem.dataset.problemCol || 1);
          if (problemItem.closest('#cl-modal-slot')) {
            this.closeModal();
          }
          if (pFile) {
            this.openFile(pFile);
            this._revealLineColInActiveEditor(pLine, pCol);
          }
          return;
        }

        const drawerTabBtn = e.target.closest('[data-cl-drawertab]');
        if (drawerTabBtn) {
          this.switchDrawerTab(drawerTabBtn.dataset.clDrawertab);
          return;
        }

        const actionBtn = e.target.closest('[data-cl-action], [data-action]');
        if (actionBtn) {
          if (splitMenu && (splitMenu.classList.contains('active') || splitMenu.classList.contains('open'))) {
            splitMenu.classList.remove('active');
            splitMenu.classList.remove('open');
          }
          const action = actionBtn.dataset.clAction || actionBtn.dataset.action;
          if (action === 'run-code') this.runCode();
          else if (action === 'run-entry') this.runEntry();
          else if (action === 'run-active-file') this.runActiveFile();
          else if (action === 'explain-sql') this.runSql('explain');
          else if (action === 'open-settings') this.openSettings();
          else if (action === 'open-settings-json') this.openWorkspaceSettingsJson();
          else if (action === 'open-stdin') this.switchDrawerTab('stdin');
          else if (action === 'share-snapshot') this.shareSnapshot();
          else if (action === 'run-demo') this.runDemo();
          else if (action === 'run-tests') this.runTests();
          else if (action === 'stop-run') this.stopExecution();
          else if (action === 'interrupt') this._handleInterrupt();
          else if (action === 'verify-step') this.verifyCurrentStep();
          else if (action === 'show-diff') this.showSolutionModal();
          else if (action === 'compare-diff') {
            const target = actionBtn.dataset.diffTarget || 'solution';
            const file = actionBtn.dataset.diffFile || this.activeFile || this._pickDefaultFile();
            this.showDiffModal(file, target);
          } else if (action === 'diff-mode') {
            this.diffViewMode = actionBtn.dataset.diffMode === 'split' ? 'split' : 'unified';
            const target = actionBtn.dataset.diffTarget || this._lastDiffTarget || 'solution';
            const file = actionBtn.dataset.diffFile || this._lastDiffFile || this.activeFile || this._pickDefaultFile();
            this.showDiffModal(file, target);
          } else if (action === 'apply-diff-solution') {
            this.applyReferenceSolution();
          } else if (action === 'command-palette') {
            this.openCommandPalette('commands');
          } else if (action === 'command-palette-files') {
            this.openCommandPalette('files');
          } else if (action === 'export-workspace') {
            this.exportWorkspace({ download: true });
          } else if (action === 'open-packages') this.showPackagesModal();
          else if (action === 'open-clone-repo' || action === 'open-clone-modal') this.openCloneDialog();
          else if (action === 'cancel-clone') {
            this.cancelClone();
            this.closeModal();
          } else if (action === 'new-blank-workspace') {
            this.openBlankWorkspace();
          } else if (action === 'confirm-clone-repo') {
            const form = this.container.querySelector('#cl-clone-repo-form');
            if (form && typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            } else {
              const input = this.container.querySelector('#cl-clone-repo-input');
              if (input && typeof this._submitCloneModal === 'function') {
                this._submitCloneModal();
              }
            }
          } else if (action === 'add-package') {
            const input = this.container.querySelector('#cl-pkg-input');
            if (input && input.value.trim()) {
              this.addNpmPackage(input.value.trim());
            }
          } else if (action === 'open-package-json') {
            this.closeModal();
            if (!this.files['package.json']) {
              this.files['package.json'] = JSON.stringify({ name: this.labId, version: '1.0.0', dependencies: {} }, null, 2) + '\n';
              this._saveState();
              this._syncAllModels();
            }
            this.openFile('package.json');
          } else if (action === 'close-modal') {
            if (this._cloneInFlight || this._activeCloneAbortController) {
              this.cancelClone();
            }
            this.closeModal();
          }
          else if (action === 'apply-solution') this.applyReferenceSolution();
          else if (action === 'reset-lab') this.resetLab({ ui: true });
          else if (action === 'toggle-fullscreen') this.toggleFullscreen();
          else if (action === 'close-lab') {
            if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            }
            if (typeof this.onClose === 'function') this.onClose();
            else if (this.isFullscreen) this.toggleFullscreen();
          } else if (action === 'new-file' || action === 'new-file-root') {
            if (!this.sidebarVisible || this.activeSidebarView !== 'explorer') {
              this.setSidebarView('explorer', { ensureOpen: true, focus: false });
            }
            this.startInlineCreate('file', this.explorerFolder || '');
          } else if (action === 'new-folder-root') {
            if (!this.sidebarVisible || this.activeSidebarView !== 'explorer') {
              this.setSidebarView('explorer', { ensureOpen: true, focus: false });
            }
            this.startInlineCreate('folder', this.explorerFolder || '');
          } else if (action === 'new-file-folder') {
            const folder = actionBtn.dataset.clFolder || '';
            this.startInlineCreate('file', folder);
          } else if (action === 'new-folder-folder') {
            const folder = actionBtn.dataset.clFolder || '';
            this.startInlineCreate('folder', folder);
          } else if (action === 'delete-folder') {
            const folder = actionBtn.dataset.clFolder;
            if (folder) this._confirmDeletePath('folder', folder);
          } else if (action === 'delete-file') {
            const file = actionBtn.dataset.clFile || this.activeFile;
            if (file) this._confirmDeletePath('file', file);
          } else if (action === 'rename-folder') {
            const folder = actionBtn.dataset.clFolder;
            if (folder) this.startInlineRename('folder', folder);
          } else if (action === 'rename-file') {
            const file = actionBtn.dataset.clFile || this.activeFile;
            if (file) this.startInlineRename('file', file);
          } else if (action === 'toggle-folder') {
            const folder = actionBtn.dataset.clFolder || (actionBtn.closest('[data-cl-folder]')?.dataset.clFolder);
            if (folder) this.toggleFolder(folder);
          } else if (action === 'toggle-guide') {
            this.toggleGuide();
          } else if (action === 'toggle-sidebar') {
            this.toggleSidebar();
          } else if (action === 'toggle-drawer') {
            this.togglePanel();
          } else if (action === 'close-drawer') {
            this.setPanelVisible(false);
          } else if (action === 'maximize-drawer') {
            this.setPanelMaximized(!this.panelMaximized);
          } else if (action === 'collapse-all-folders') {
            this.collapseAllFolders();
          } else if (action === 'statusbar-scm') {
            this.openScmView();
          } else if (action === 'statusbar-problems') {
            this.openProblemsPanel();
          } else if (action === 'go-to-line') {
            this.promptGoToLine();
          } else if (action === 'toggle-problem-group') {
            const fKey = actionBtn.dataset.problemGroup;
            if (fKey) {
              if (!this._collapsedProblemFiles) this._collapsedProblemFiles = new Set();
              if (this._collapsedProblemFiles.has(fKey)) this._collapsedProblemFiles.delete(fKey);
              else this._collapsedProblemFiles.add(fKey);
              const bodyEl = this.container.querySelector('#cl-drawer-body');
              if (bodyEl && this.drawerTab === 'problems') {
                this._renderProblemsPanel(bodyEl);
              }
            }
          } else if (action === 'search-replace-one') {
            this._executeSidebarReplaceOne();
          } else if (action === 'search-replace-all') {
            this._executeSidebarReplaceAll();
          } else if (action === 'replace-match') {
            e.stopPropagation();
            this._executeSidebarReplaceMatch(
              actionBtn.dataset.clSearchTargetFile,
              Number(actionBtn.dataset.clSearchLine || 1),
              Number(actionBtn.dataset.clSearchCol || 1),
              Number(actionBtn.dataset.clSearchLen || 0)
            );
          } else if (action === 'replace-file') {
            e.stopPropagation();
            this._executeSidebarReplaceFile(actionBtn.dataset.clSearchTargetFile);
          } else if (action === 'clear-terminal') {
            if (this.drawerTab === 'output' && Array.isArray(this.outputLogs)) {
              this.outputLogs.length = 0;
            } else if (this.drawerTab === 'terminal') {
              this._clearTerminalLogs();
            }
            this._renderDrawerBody();
          } else if (action === 'new-terminal-session') {
            this.createTerminalSession();
            if (this.drawerTab !== 'terminal') this.switchDrawerTab('terminal');
          } else if (action === 'kill-terminal-session') {
            this.killActiveTerminalSession();
          } else if (action === 'switch-terminal-session') {
            const sid = actionBtn.dataset.sessionId;
            if (sid) this.switchTerminalSession(sid);
          } else if (action === 'close-terminal-session') {
            e.stopPropagation();
            const sid = actionBtn.dataset.sessionId;
            if (sid) this.closeTerminalSession(sid);
          } else if (action === 'scm-init') {
            this._initGitRepoInScm();
          } else if (action === 'scm-stage-file' || action === 'scm-stage') {
            e.stopPropagation();
            const p = actionBtn.dataset.scmPath || (actionBtn.closest('[data-scm-path]')?.dataset.scmPath);
            if (p) {
              this.stageGitFile(p);
              this._renderScmSidebar();
              this._updateStatusBar();
            }
          } else if (action === 'scm-unstage-file' || action === 'scm-unstage') {
            e.stopPropagation();
            const p = actionBtn.dataset.scmPath || (actionBtn.closest('[data-scm-path]')?.dataset.scmPath);
            if (p) {
              this.unstageGitFile(p);
              this._renderScmSidebar();
              this._updateStatusBar();
            }
          } else if (action === 'scm-discard-file' || action === 'scm-discard') {
            e.stopPropagation();
            const p = actionBtn.dataset.scmPath || (actionBtn.closest('[data-scm-path]')?.dataset.scmPath);
            if (p) {
              this._confirmDiscardGitFile(p, actionBtn);
            }
          } else if (action === 'scm-stage-all') {
            this.stageAllGitFiles();
            this._renderScmSidebar();
            this._updateStatusBar();
          } else if (action === 'scm-unstage-all') {
            this.unstageAllGitFiles();
            this._renderScmSidebar();
            this._updateStatusBar();
          } else if (action === 'scm-commit') {
            const msgInput = this.container.querySelector('#cl-scm-commit-input');
            const msg = msgInput ? msgInput.value.trim() : '';
            if (msg) {
              const hash = this.commitGitChanges(msg);
              if (hash && msgInput) msgInput.value = '';
              this._renderScmSidebar();
              this._updateStatusBar();
            }
          } else if (action === 'scm-open-file') {
            e.stopPropagation();
            const p = actionBtn.dataset.scmPath || (actionBtn.closest('[data-scm-path]')?.dataset.scmPath);
            const row = actionBtn.closest('[data-scm-staged]');
            const staged = Boolean(row && row.dataset.scmStaged === 'true');
            if (actionBtn.closest('#cl-modal-slot')) {
              this.closeModal();
            }
            if (p) {
              this.openScmDiff(p, { staged });
            }
          } else if (action === 'scm-diff-open-editor') {
            const p = actionBtn.dataset.scmPath || this._activeScmDiffFile;
            this.closeScmDiff();
            if (p && Object.prototype.hasOwnProperty.call(this.files, p)) {
              this.openFile(p);
            }
          } else if (action === 'scm-close-diff') {
            this.closeScmDiff();
          } else if (action === 'scm-new-branch-toggle') {
            this._scmCreatingBranch = !this._scmCreatingBranch;
            this._renderScmSidebar();
            if (this._scmCreatingBranch) {
              const bInp = this.container.querySelector('#cl-scm-new-branch-input');
              if (bInp && typeof bInp.focus === 'function') bInp.focus();
            }
          } else if (action === 'scm-create-branch-submit') {
            const bInp = this.container.querySelector('#cl-scm-new-branch-input');
            const bName = bInp ? String(bInp.value || '').trim() : '';
            if (bName && this.createGitBranch(bName, true)) {
              this._scmCreatingBranch = false;
              this._renderScmSidebar();
              this._updateStatusBar();
            }
          } else if (action === 'scm-create-branch-cancel') {
            this._scmCreatingBranch = false;
            this._renderScmSidebar();
          } else if (action === 'toggle-hint') {
            const box = this.container.querySelector('#cl-hint-box');
            if (box) box.classList.toggle('open');
          } else if (action === 'open-web-preview') {
            const port = Number(actionBtn.dataset.port || actionBtn.dataset.clPort);
            if (port) this._openWebPreview(port);
          } else if (action === 'preview-app') {
            this.previewApp();
          } else if (action === 'dismiss-toast') {
            this._dismissPortToast(actionBtn.dataset.port);
          } else if (action === 'preview-back') {
            this._previewBack();
          } else if (action === 'preview-forward') {
            this._previewForward();
          } else if (action === 'preview-reload') {
            this._previewReload();
          } else if (action === 'preview-mode') {
            this._previewSetFrameMode(actionBtn.dataset.mode);
          } else if (action === 'preview-popout') {
            this._popoutPreview();
          } else if (action === 'preview-dock-toggle') {
            this._togglePreviewDock();
          } else if (action === 'preview-maximize') {
            this._togglePreviewMaximize();
          } else if (action === 'preview-console-toggle') {
            this._togglePreviewConsole();
          } else if (action === 'preview-console-clear') {
            this._clearPreviewConsole();
          } else if (action === 'open-port-client') {
            const port = actionBtn.dataset.port || actionBtn.dataset.clPort;
            if (port) {
              this.httpClientUrl = `http://localhost:${port}/`;
              if (this.httpClientState) {
                this.httpClientState.url = `http://localhost:${port}/`;
              }
              this._renderDrawerBody();
            }
          } else if (action === 'stop-port') {
            const port = Number(actionBtn.dataset.port || actionBtn.dataset.clPort);
            if (port) {
              if (this.portTable && typeof this.portTable.closeServer === 'function') {
                this.portTable.closeServer(port);
              }
              if (this.shell && this.shell.portTable && typeof this.shell.portTable.unregister === 'function') {
                this.shell.portTable.unregister(port);
              }
              this.activePorts = (this.activePorts || []).filter(p => Number(typeof p === 'object' ? p.port : p) !== port);
              this._renderDrawerBody();
            }
          } else if (action === 'http-send') {
            this._sendHttpClientRequest();
          } else if (action === 'http-tab') {
            const nextTab = actionBtn.dataset.tab || actionBtn.dataset.clHttpTab || actionBtn.dataset.httpTab || 'preview';
            this.httpActiveTab = nextTab;
            if (this.httpClientState) {
              this.httpClientState.activeResponseTab = nextTab;
            }
            this._renderDrawerBody();
          } else if (action === 'clear-net-traces') {
            this.lastHttpTrace = [];
            this.selectedNetTraceIdx = null;
            if (this.networkFilter) {
              this.networkFilter.selectedTraceId = null;
            }
            this._renderDrawerBody();
          } else if (action === 'select-net-trace') {
            const traceId = actionBtn.dataset.traceId || actionBtn.dataset.clTraceId || null;
            const idx = Number(actionBtn.dataset.traceIdx);
            this.selectedNetTraceIdx = Number.isNaN(idx) ? null : idx;
            if (this.networkFilter) {
              this.networkFilter.selectedTraceId = traceId;
            }
            this._renderDrawerBody();
          } else if (action === 'close-net-detail') {
            this.selectedNetTraceIdx = null;
            if (this.networkFilter) {
              this.networkFilter.selectedTraceId = null;
            }
            this._renderDrawerBody();
          } else if (action === 'chaos-latency' || action === 'chaos-error' || action === 'chaos-crash' || action === 'chaos-heal') {
            const port = Number(actionBtn.dataset.port || actionBtn.dataset.clPort);
            if (port && this.portTable && typeof this.portTable.setChaosRule === 'function') {
              const cur = (typeof this.portTable.getChaosRule === 'function' ? this.portTable.getChaosRule(port) : null) || {};
              if (action === 'chaos-latency') {
                const nextLat = cur.latencyMs > 0 ? 0 : 200;
                this.portTable.setChaosRule(port, { latencyMs: nextLat, jitterMs: nextLat ? 40 : 0 });
                this._showToast(nextLat ? `Injected +200ms latency (±40ms jitter) on :${port}` : `Removed latency injection on :${port}`, 'info');
              } else if (action === 'chaos-error') {
                const nextErr = cur.errorRate > 0 ? 0 : 0.25;
                this.portTable.setChaosRule(port, { errorRate: nextErr, errorStatus: 503 });
                this._showToast(nextErr ? `Injected 25% HTTP 503 error rate on :${port}` : `Removed HTTP 503 fault injection on :${port}`, nextErr ? 'error' : 'info');
              } else if (action === 'chaos-crash') {
                const nextCrash = !cur.crashed;
                this.portTable.setChaosRule(port, { crashed: nextCrash });
                this._showToast(nextCrash ? `Port :${port} marked CRASHED (ECONNREFUSED)` : `Port :${port} recovered`, nextCrash ? 'error' : 'info');
              } else if (action === 'chaos-heal') {
                this.portTable.clearChaosRules(port);
                this._showToast(`Port :${port} healed (all fault rules cleared)`, 'info');
              }
              this._renderDrawerBody();
            }
          } else if (action === 'run-quick-loadtest') {
            const targetPort = this._firstListeningPort() || 3000;
            const targetUrl = `http://127.0.0.1:${targetPort}/`;
            if (this.shell && typeof this.shell.execute === 'function') {
              this._showToast(`Running load test: hey -n 50 -c 10 ${targetUrl}`, 'info');
              this.shell.execute(`hey -n 50 -c 10 ${targetUrl}`, {}).then((res) => {
                if (res && res.stdout) {
                  this._pushTerminalLog({ type: 'system', text: `\n$ hey -n 50 -c 10 ${targetUrl}` });
                  this._pushTerminalLog({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
                }
                this._renderDrawerBody();
              }).catch((err) => {
                this.logger.debug('Quick load test failed.', err);
              });
            }
          } else if (action === 'open-large-file-anyway') {
            const targetFile = actionBtn.dataset.clFile || this.activeFile;
            if (targetFile) {
              this._forceOpenedLargeFiles.add(targetFile);
              this._syncActiveFileToView();
            }
          } else if (action === 'toggle-md-preview') {
            this.toggleMarkdownPreview();
          }
          return;
        }

        const folderItem = e.target.closest('.codelab-folder-item');
        if (folderItem && !e.target.closest('.codelab-node-action, [data-cl-action]')) {
          const folder = folderItem.dataset.clFolder;
          if (folder) this.toggleFolder(folder);
          return;
        }
      });

      this.container.addEventListener('change', e => {
        const previewPortSelect = e.target && typeof e.target.closest === 'function'
          ? e.target.closest('[data-cl-action="preview-port-change"]')
          : null;
        if (previewPortSelect) {
          this._openWebPreview(Number(previewPortSelect.value));
          return;
        }
        const checkbox = e.target.closest('.codelab-task-checkbox');
        if (checkbox) {
          const isChecked = checkbox.checked;
          const taskItem = checkbox.closest('.codelab-task-item');
          if (taskItem) {
            taskItem.classList.toggle('codelab-task-item--checked', isChecked);
          }

          if (this.activeFile && this.activeFile.endsWith('.md') && checkbox.closest('#cl-md-preview')) {
            const taskIdx = Number(checkbox.dataset.clTaskIdx);
            if (!Number.isNaN(taskIdx)) {
              this._toggleMarkdownTask(this.activeFile, taskIdx, isChecked);
            }
          }
        }
      });
    }

    _clampMenuToViewport(menuEl, preferredX, preferredY) {
      if (!menuEl || !menuEl.style) return;
      const vw = (typeof window !== 'undefined' && Number(window.innerWidth)) || 1280;
      const vh = (typeof window !== 'undefined' && Number(window.innerHeight)) || 800;
      const pad = 8;
      let rect = { width: 220, height: 180 };
      if (typeof menuEl.getBoundingClientRect === 'function') {
        try {
          const r = menuEl.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) rect = r;
        } catch (err) {
          void err;
        }
      }
      const clampedLeft = Math.max(pad, Math.min(preferredX, vw - rect.width - pad));
      const clampedTop = Math.max(pad, Math.min(preferredY, vh - rect.height - pad));
      menuEl.style.left = `${Math.round(clampedLeft)}px`;
      menuEl.style.top = `${Math.round(clampedTop)}px`;
    }

    _closeSiblingSubmenus(exceptSubMenu = null) {
      if (!this.container) return;
      const slot = this.container.querySelector('#cl-topbar-menu-slot');
      if (!slot) return;
      slot.querySelectorAll('.codelab-topbar-submenu.open').forEach(sm => {
        if (sm !== exceptSubMenu) {
          sm.classList.remove('open');
          const wrap = sm.closest('.codelab-topbar-menu__has-sub');
          const btn = wrap ? wrap.querySelector('[data-cl-submenu]') : null;
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    _positionSubmenu(triggerWrap, subMenu) {
      if (!triggerWrap || !subMenu || !subMenu.style) return;
      const vw = (typeof window !== 'undefined' && Number(window.innerWidth)) || 1280;
      const vh = (typeof window !== 'undefined' && Number(window.innerHeight)) || 800;
      const pad = 8;
      subMenu.style.right = 'auto';
      subMenu.style.bottom = 'auto';
      subMenu.style.left = '0px';
      subMenu.style.top = '0px';
      let tr = { left: 120, right: 320, top: 80, bottom: 108, width: 200, height: 28 };
      if (typeof triggerWrap.getBoundingClientRect === 'function') {
        try {
          const r = triggerWrap.getBoundingClientRect();
          if (r && (r.width > 0 || r.height > 0)) tr = r;
        } catch (err) {
          void err;
        }
      }
      let subRect = { width: 210, height: 140 };
      if (typeof subMenu.getBoundingClientRect === 'function') {
        try {
          const sr = subMenu.getBoundingClientRect();
          if (sr && sr.width > 0 && sr.height > 0) subRect = sr;
        } catch (err) {
          void err;
        }
      }
      let nextLeft;
      if (tr.right - 2 + subRect.width <= vw - pad) {
        nextLeft = tr.right - 2;
      } else if (tr.left - subRect.width + 2 >= pad) {
        nextLeft = tr.left - subRect.width + 2;
      } else {
        nextLeft = Math.max(pad, Math.min(tr.right - 2, vw - subRect.width - pad));
      }
      const nextTop = Math.max(pad, Math.min(tr.top - 4, vh - subRect.height - pad));
      subMenu.style.left = `${Math.round(nextLeft)}px`;
      subMenu.style.top = `${Math.round(nextTop)}px`;
    }

    _captureModalReturnFocus() {
      if (typeof document === 'undefined' || !this.container) return;
      const ae = document.activeElement;
      if (
        ae &&
        ae !== document.body &&
        ae !== document.documentElement &&
        typeof this.container.contains === 'function' &&
        this.container.contains(ae) &&
        (!ae.closest || !ae.closest('#cl-modal-slot, #cl-context-menu-slot, #cl-topbar-menu-slot'))
      ) {
        this._modalReturnFocusEl = ae;
      }
    }

    _restoreWorkbenchFocus(preferredEl = null) {
      if (this._destroyed || !this.container) return;
      if (
        preferredEl &&
        typeof preferredEl.focus === 'function' &&
        (typeof preferredEl.isConnected !== 'boolean' || preferredEl.isConnected) &&
        typeof this.container.contains === 'function' &&
        this.container.contains(preferredEl) &&
        (!preferredEl.closest || !preferredEl.closest('#cl-modal-slot, #cl-context-menu-slot, #cl-topbar-menu-slot'))
      ) {
        try {
          preferredEl.focus();
          if (typeof document !== 'undefined' && document.activeElement && this.container.contains(document.activeElement)) {
            return;
          }
        } catch (err) {
          void err;
        }
      }
      if (this.activeTab === '__settings__') {
        const settingsInput = this.container.querySelector('#cl-settings-host input, #cl-settings-host select, #cl-settings-host button');
        if (settingsInput && typeof settingsInput.focus === 'function') {
          try {
            settingsInput.focus({ preventScroll: true });
            return;
          } catch (_err) {
            void _err;
            settingsInput.focus();
            return;
          }
        }
      }
      if (this.editor && typeof this.editor.focus === 'function') {
        const monacoHost = this.container.querySelector('#cl-monaco-host');
        if (monacoHost && (!monacoHost.style || monacoHost.style.display !== 'none')) {
          try {
            this.editor.focus();
            if (typeof document !== 'undefined' && document.activeElement && this.container.contains(document.activeElement)) {
              return;
            }
          } catch (err) {
            void err;
          }
        }
      }
      const fbWrap = this.container.querySelector('#cl-fallback-wrap');
      const fb = this.container.querySelector('#cl-fallback-editor');
      if (fb && fbWrap && fbWrap.style && fbWrap.style.display !== 'none' && typeof fb.focus === 'function') {
        fb.focus();
        return;
      }
      const sqlHost = this.container.querySelector('#cl-sql-editor-host');
      if (sqlHost && sqlHost.style && sqlHost.style.display !== 'none') {
        const sqlTa = sqlHost.querySelector('textarea');
        if (sqlTa && typeof sqlTa.focus === 'function') {
          sqlTa.focus();
          return;
        }
      }
      const fallbackTarget = this.container.querySelector(
        '#cl-tabs .codelab-tab.active, #cl-file-tabs .codelab-tab.active, #cl-menubar .codelab-menubar__trigger[tabindex="0"], #cl-menubar .codelab-menubar__trigger, .codelab-activitybar__btn'
      );
      if (fallbackTarget && typeof fallbackTarget.focus === 'function') {
        fallbackTarget.focus();
        return;
      }
      const shell = this.container.querySelector('.codelab');
      if (shell && typeof shell.focus === 'function') {
        if (!shell.hasAttribute('tabindex')) shell.setAttribute('tabindex', '-1');
        shell.focus();
      }
    }

    // ── Right-Click Context Menu ────────────────────────────────────────────
    openContextMenu(x, y, items = []) {
      const slot = this.container.querySelector('#cl-context-menu-slot');
      if (!slot) return;
      if (typeof document !== 'undefined') {
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae !== document.documentElement && typeof this.container.contains === 'function' && this.container.contains(ae) && (!ae.closest || !ae.closest('#cl-context-menu-slot'))) {
          this._contextMenuReturnFocusEl = ae;
        }
      }
      const safeX = Math.max(8, Number(x) || 80);
      const safeY = Math.max(8, Number(y) || 80);
      this._contextMenuItems = items;

      const itemsHtml = items.map(item => {
        if (item.divider) {
          return '<div class="codelab-context-menu__divider" role="separator"></div>';
        }
        return `
          <button type="button" class="codelab-context-menu__item ${item.danger ? 'is-danger' : ''}" role="menuitem" data-ctx-action="${escapeHtml(item.action || '')}"${item.ctx ? ` data-cl-ctx="${escapeHtml(item.ctx)}"` : ''} data-ctx-target="${escapeHtml(item.target || '')}">
            <span class="codelab-context-menu__label">${escapeHtml(item.label || '')}</span>
            ${item.shortcut ? `<span class="codelab-context-menu__kbd">${escapeHtml(item.shortcut)}</span>` : ''}
          </button>
        `;
      }).join('');

      slot.innerHTML = `
        <div class="codelab-context-menu" role="menu" aria-label="Context Menu" style="left:${safeX}px;top:${safeY}px;">
          ${itemsHtml}
        </div>
      `;
      const menuEl = slot.querySelector('.codelab-context-menu');
      if (menuEl) {
        this._clampMenuToViewport(menuEl, safeX, safeY);
      }
    }

    closeContextMenu(opts = {}) {
      const slot = this.container ? this.container.querySelector('#cl-context-menu-slot') : null;
      const hadMenu = Boolean(slot && slot.innerHTML && slot.innerHTML.trim() !== '');
      const prior = this._contextMenuReturnFocusEl || null;
      this._contextMenuReturnFocusEl = null;
      if (slot) slot.innerHTML = '';
      this._contextMenuItems = null;
      if (hadMenu && (!opts || opts.restoreFocus !== false) && typeof document !== 'undefined') {
        const ae = document.activeElement;
        if (!ae || ae === document.body || ae === document.documentElement) {
          this._restoreWorkbenchFocus(prior);
        }
      }
    }

    // ── VS Code Command Palette & Quick Open ────────────────────────────────
    _getPaletteCommands() {
      const builtin = [
        { id: 'run-code', label: 'CodeLab: Run Code (Entry or Active File)', shortcut: '⌘↵', action: () => this.runCode() },
        { id: 'run-active', label: 'CodeLab: Run Active File', shortcut: '⇧⌘↵', action: () => this.runActiveFile() },
        { id: 'run-demo', label: 'CodeLab: Run Demo Script', shortcut: '⇧⌘↵', action: () => this.runDemo() },
        { id: 'run-tests', label: 'CodeLab: Run Unit Tests', shortcut: '⌘↵', action: () => this.runTests() },
        { id: 'verify-step', label: 'CodeLab: Verify Current Guided Step', shortcut: '⌘↵', action: () => this.verifyCurrentStep() },
        { id: 'sql-run', label: 'SQL: Run Query', shortcut: '⌘↵', action: () => this.runSql('run') },
        { id: 'sql-explain', label: 'SQL: Explain Query Plan', action: () => this.runSql('explain') },
        { id: 'format-document', label: 'Editor: Format Document', shortcut: '⇧⌥F', action: () => this.formatActiveDocument() },
        { id: 'open-settings', label: 'Preferences: Open Settings (UI)', shortcut: '⌘,', action: () => this.openSettings() },
        { id: 'open-settings-json', label: 'Preferences: Open Workspace Settings (.codelab/settings.json)', action: () => this.openWorkspaceSettingsJson() },
        { id: 'theme-dark', label: 'Preferences: Color Theme — Dark', action: () => this.setTheme('dark') },
        { id: 'theme-light', label: 'Preferences: Color Theme — Light', action: () => this.setTheme('light') },
        { id: 'theme-hc', label: 'Preferences: Color Theme — High Contrast', action: () => this.setTheme('high-contrast') },
        { id: 'open-observability', label: 'Developer: Open Observability & Services Inspector', action: () => this.switchDrawerTab('observability') },
        { id: 'share-snapshot', label: 'CodeLab: Share Snapshot Link (#codelab=...)', action: () => this.shareSnapshot() },
        { id: 'open-stdin', label: 'View: Open Stdin / Custom Input Panel', action: () => this.switchDrawerTab('stdin') },
        { id: 'view-problems-tab', label: 'View: Focus Problems Drawer Tab', action: () => this.switchDrawerTab('problems') },
        { id: 'compare-solution', label: 'CodeLab: Compare Active File with Reference Solution (Diff)', action: () => this.showDiffModal(this.activeFile || this._pickDefaultFile(), 'solution') },
        { id: 'compare-starter', label: 'CodeLab: Compare Active File with Starter Template (Diff)', action: () => this.showDiffModal(this.activeFile || this._pickDefaultFile(), 'starter') },
        { id: 'apply-solution', label: 'CodeLab: Apply Reference Solution to Active File', action: () => this.applyReferenceSolution() },
        { id: 'new-file', label: 'File: New File...', action: () => this.startInlineCreate('file', '') },
        { id: 'new-folder', label: 'File: New Folder...', action: () => this.startInlineCreate('folder', '') },
        { id: 'rename-active', label: 'File: Rename Active File...', shortcut: 'F2', action: () => { if (this.activeFile) this.startInlineRename('file', this.activeFile); } },
        { id: 'delete-active', label: 'File: Delete Active File', action: () => { if (this.activeFile) this._confirmDeletePath('file', this.activeFile); } },
        { id: 'new-blank-workspace', label: 'File: New Blank Workspace...', action: () => this.openBlankWorkspace() },
        { id: 'open-recent-workspace', label: 'File: Open Recent Workspace...', action: () => this.showOpenRecentWorkspaceModal() },
        { id: 'export-workspace', label: 'Workspace: Export Workspace as JSON', action: () => this.exportWorkspace({ download: true }) },
        { id: 'export-workspace-zip', label: 'Workspace: Export Project as ZIP Archive', action: () => this.exportProjectZip({ download: true }) },
        { id: 'reset-workspace', label: 'Workspace: Reset Workspace to Clean State', action: () => this.resetLab({ ui: true }) },
        { id: 'switch-lang', label: 'Language: Switch JavaScript / TypeScript / C++ / Python / SQL', action: () => {
          const order = ['js', 'ts'];
          if (this.enabledLanguages && this.enabledLanguages.has('cpp')) order.push('cpp');
          if (this.enabledLanguages && this.enabledLanguages.has('py')) order.push('py');
          if (this.enabledLanguages && this.enabledLanguages.has('sql')) order.push('sql');
          const next = order[(order.indexOf(this.lang) + 1) % order.length] || 'js';
          this.setLanguage(next);
        } },
        { id: 'switch-mode', label: 'Mode: Switch Guided / Sandbox Mode', action: () => this.setMode(this.mode === 'guided' ? 'sandbox' : 'guided') },
        { id: 'toggle-sidebar', label: 'View: Toggle Primary Side Bar Visibility', shortcut: '⌘B', action: () => this.toggleSidebar() },
        { id: 'toggle-guide', label: 'View: Toggle Guide Sidebar', action: () => this.toggleGuide() },
        { id: 'toggle-drawer', label: 'View: Toggle Panel Visibility', shortcut: '⌘J', action: () => this.togglePanel() },
        { id: 'toggle-terminal', label: 'View: Toggle Terminal', shortcut: '⌃`', action: () => this.toggleTerminal() },
        { id: 'toggle-fullscreen', label: 'View: Toggle Fullscreen Workbench', action: () => this.toggleFullscreen() },
        { id: 'search-workspace', label: 'Search: Find & Replace Across Files...', shortcut: '⇧⌘F', action: () => this.openSearchView() },
        { id: 'open-scm', label: 'Git: Source Control (Status, Stage & Commit)...', shortcut: '⌃⇧G', action: () => this.openScmView() },
        { id: 'open-problems', label: 'View: Show Problems & Diagnostics...', shortcut: '⇧⌘M', action: () => this.openProblemsPanel() },
        { id: 'next-problem', label: 'Go: Next Problem (Error, Warning, Info)', shortcut: 'F8', action: () => this.goToNextProblem(false) },
        { id: 'prev-problem', label: 'Go: Previous Problem (Error, Warning, Info)', shortcut: '⇧F8', action: () => this.goToNextProblem(true) },
        { id: 'open-packages', label: 'Packages: Manage NPM Dependencies & Runtime', action: () => this.showPackagesModal() },
        { id: 'git-clone', label: 'Git: Clone Public GitHub Repository...', action: () => this.openCloneDialog() }
      ];

      if (Array.isArray(this._workspaceTasks)) {
        for (const task of this._workspaceTasks) {
          builtin.push({
            id: `task:${task.id}`,
            label: `Tasks: Run ${task.label} (${task.command})`,
            shortcut: '',
            action: () => this.runTask(task.id)
          });
        }
      }

      if (this.commands && typeof this.commands.getCommands === 'function') {
        const builtinIds = new Set([
          ...builtin.map((b) => b.id),
          'workbench.action.openSettings',
          'workbench.action.openWorkspaceSettingsJson',
          'workbench.action.quickOpen',
          'workbench.action.showCommands',
          'workbench.action.openObservability',
          'codeLab.runCode',
          'codeLab.runTests',
          'codeLab.runSql',
          'codeLab.explainSql',
          'codeLab.formatDocument',
          'tasks.runTask'
        ]);
        const contributed = this.commands.getCommands(this.contextKeys || undefined);
        const mod = getModular();
        for (const cmd of contributed) {
          if (builtinIds.has(cmd.id)) continue;
          const kbRaw = this.keybindings ? this.keybindings.lookupKeybinding(cmd.id) : undefined;
          const shortcut = kbRaw && mod && typeof mod.formatShortcutBadge === 'function'
            ? mod.formatShortcutBadge(kbRaw, true)
            : (kbRaw || '');
          builtin.push({
            id: cmd.id,
            label: cmd.category ? `${cmd.category}: ${cmd.title}` : cmd.title,
            shortcut,
            action: () => {
              this.commands.executeCommand(cmd.id).catch((err) => {
                this.logger.warn(`Command "${cmd.id}" threw.`, err);
              });
            }
          });
        }
      }

      return builtin;
    }

    openCommandPalette(mode = 'commands') {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
      this._captureModalReturnFocus();
      this.paletteMode = mode === 'files' ? 'files' : 'commands';
      this.paletteSelectedIndex = 0;
      const initialVal = this.paletteMode === 'commands' ? '> ' : '';

      slot.innerHTML = `
        <div class="codelab-palette-backdrop">
          <div class="codelab-palette" role="dialog" aria-modal="true" aria-label="Command Palette">
            <div class="codelab-palette__header">
              <span class="codelab-palette__icon">${CL_ICONS.search}</span>
              <input id="cl-palette-input" class="codelab-palette__input" type="text" value="${escapeHtml(initialVal)}" placeholder="${this.paletteMode === 'commands' ? 'Type a command or remove > to search files…' : 'Search files by name (type > for commands)…'}" autocomplete="off" spellcheck="false" aria-label="Command Palette Input" />
              <span class="codelab-palette__hint">ESC to close</span>
            </div>
            <div id="cl-palette-list" class="codelab-palette__list" role="listbox"></div>
          </div>
        </div>
      `;

      this._renderPaletteList(initialVal);

      const input = slot.querySelector('#cl-palette-input');
      if (input) {
        input.value = initialVal;
        input.focus();
        try {
          input.setSelectionRange(initialVal.length, initialVal.length);
        } catch (err) {
          this.logger.debug('input.setSelectionRange failed in command palette.', err);
        }

        input.addEventListener('input', () => {
          this.paletteSelectedIndex = 0;
          this._renderPaletteList(input.value);
        });

        input.addEventListener('keydown', e => {
          const items = this._currentPaletteItems || [];
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
              this.paletteSelectedIndex = (this.paletteSelectedIndex + 1) % items.length;
              this._renderPaletteList(input.value);
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
              this.paletteSelectedIndex = (this.paletteSelectedIndex - 1 + items.length) % items.length;
              this._renderPaletteList(input.value);
            }
          } else if (e.key === 'Enter') {
            if (e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            this._executePaletteSelection(this.paletteSelectedIndex);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.closeModal();
          }
        });
      }
    }

    _renderPaletteList(rawValue = '') {
      const listEl = this.container.querySelector('#cl-palette-list');
      if (!listEl) return;
      const trimmed = String(rawValue || '').trim();
      const isCommandQuery = trimmed.startsWith('>') || (this.paletteMode === 'commands' && rawValue.startsWith('>'));
      const query = (trimmed.startsWith('>') ? trimmed.slice(1) : trimmed).trim().toLowerCase();

      let items = [];
      if (isCommandQuery) {
        const cmds = this._getPaletteCommands();
        items = cmds
          .filter(c => !query || c.label.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
          .map(c => ({
            type: 'command',
            id: c.id,
            label: c.label,
            shortcut: c.shortcut || '',
            action: c.action
          }));
      } else {
        const files = this._orderedFileNames().filter(f => !this._isPathExcluded(f));
        const mod = getModular();
        const searchExcl = this.configuration ? this.configuration.get('search.exclude', []) : [];
        const excludePatterns = [
          ...(Array.isArray(searchExcl) ? searchExcl : []),
          ...this._getExcludePatterns()
        ];
        const ranked = (mod && typeof mod.rankWorkspaceFiles === 'function')
          ? mod.rankWorkspaceFiles(files, query, excludePatterns)
          : files.filter(f => !query || f.toLowerCase().includes(query));
        items = ranked
          .map(f => ({
            type: 'file',
            id: f,
            label: f,
            shortcut: f === this.activeFile ? 'Active' : '',
            action: () => this.openFile(f)
          }));
      }

      this._currentPaletteItems = items;
      if (this.paletteSelectedIndex >= items.length) {
        this.paletteSelectedIndex = 0;
      }

      if (items.length === 0) {
        listEl.innerHTML = `<div class="codelab-palette__empty">No matching ${isCommandQuery ? 'commands' : 'files'} found</div>`;
        return;
      }

      listEl.innerHTML = items.map((item, idx) => `
        <button type="button" class="codelab-palette__item ${idx === this.paletteSelectedIndex ? 'is-selected' : ''}" role="option" aria-selected="${idx === this.paletteSelectedIndex}" data-palette-idx="${idx}" data-palette-id="${escapeHtml(item.id)}">
          <span class="codelab-palette__item-label">${escapeHtml(item.label)}</span>
          ${item.shortcut ? `<span class="codelab-palette__item-kbd">${escapeHtml(item.shortcut)}</span>` : ''}
        </button>
      `).join('');
    }

    _executePaletteSelection(index) {
      const items = this._currentPaletteItems || [];
      const item = items[index];
      if (!item) return;
      this.closeModal();
      if (typeof item.action === 'function') {
        item.action();
      }
    }

    // ── Inline & Side-by-Side Diff Viewer ───────────────────────────────────
    _computeLineDiff(oldText, newText) {
      const oldLines = String(oldText || '').split('\n');
      const newLines = String(newText || '').split('\n');
      const m = oldLines.length;
      const n = newLines.length;

      // LCS dynamic programming matrix
      const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
      for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
          if (oldLines[i] === newLines[j]) {
            dp[i][j] = 1 + dp[i + 1][j + 1];
          } else {
            dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
          }
        }
      }

      const hunks = [];
      let i = 0;
      let j = 0;
      let oldLineNum = 1;
      let newLineNum = 1;
      let added = 0;
      let removed = 0;

      while (i < m && j < n) {
        if (oldLines[i] === newLines[j]) {
          hunks.push({ type: 'same', text: oldLines[i], oldLine: oldLineNum++, newLine: newLineNum++ });
          i++;
          j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          hunks.push({ type: 'del', text: oldLines[i], oldLine: oldLineNum++, newLine: null });
          removed++;
          i++;
        } else {
          hunks.push({ type: 'add', text: newLines[j], oldLine: null, newLine: newLineNum++ });
          added++;
          j++;
        }
      }
      while (i < m) {
        hunks.push({ type: 'del', text: oldLines[i++], oldLine: oldLineNum++, newLine: null });
        removed++;
      }
      while (j < n) {
        hunks.push({ type: 'add', text: newLines[j++], oldLine: null, newLine: newLineNum++ });
        added++;
      }

      return { hunks, added, removed };
    }

    showDiffModal(targetFile = null, compareTarget = 'solution') {
      const file = targetFile || this.activeFile || this._pickDefaultFile();
      if (!this._diffManager) {
        let DiffManagerCls = (root && root.CodeLabWorkbenchComponents && root.CodeLabWorkbenchComponents.CodeLabDiffEditorManager) ||
          (typeof globalThis !== 'undefined' && globalThis.CodeLabWorkbenchComponents && globalThis.CodeLabWorkbenchComponents.CodeLabDiffEditorManager) ||
          null;
        if (!DiffManagerCls && typeof require === 'function') {
          try {
            const mod = require('./workbench/diff-editor');
            DiffManagerCls = mod.CodeLabDiffEditorManager;
          } catch (err) {
            void err;
          }
        }
        if (DiffManagerCls) {
          this._diffManager = new DiffManagerCls(this);
        }
      }
      if (this._diffManager && typeof window !== 'undefined' && window.monaco && window.monaco.editor && typeof window.monaco.editor.createDiffEditor === 'function') {
        const ok = this._diffManager.openInlineDiff(file, compareTarget);
        if (ok) return;
      }
      this.showDiffModalFallback(file, compareTarget);
    }

    showDiffModalFallback(targetFile = null, compareTarget = 'solution') {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
      this._captureModalReturnFocus();

      const file = targetFile || this.activeFile || this._pickDefaultFile();
      const isStarter = compareTarget === 'starter';
      const baseFiles = this._getBaseFilesForModeAndLang(isStarter ? 'guided' : 'sandbox', this.lang);
      const refCode = baseFiles[file] !== undefined ? baseFiles[file] : '';
      const currentCode = this.files[file] !== undefined ? this.files[file] : '';

      // When comparing with starter: old = starter, new = current editor code
      // When comparing with solution: old = current editor code, new = reference solution
      const leftText = isStarter ? refCode : currentCode;
      const rightText = isStarter ? currentCode : refCode;
      const leftLabel = isStarter ? `Starter (${file})` : `Current Editor (${file})`;
      const rightLabel = isStarter ? `Current Editor (${file})` : `Reference Solution (${file})`;

      const diff = this._computeLineDiff(leftText, rightText);
      const viewMode = this.diffViewMode === 'split' ? 'split' : 'unified';
      this._lastDiffFile = file;
      this._lastDiffTarget = compareTarget;

      let diffBodyHtml = '';
      if (viewMode === 'unified') {
        diffBodyHtml = `
          <div class="codelab-diff-unified">
            ${diff.hunks.map(h => {
              const cls = h.type === 'add' ? 'codelab-diff-line--add' : h.type === 'del' ? 'codelab-diff-line--del' : 'codelab-diff-line--same';
              const prefix = h.type === 'add' ? '+' : h.type === 'del' ? '-' : ' ';
              return `
                <div class="codelab-diff-line ${cls}">
                  <span class="codelab-diff-gutter">${h.oldLine || ''}</span>
                  <span class="codelab-diff-gutter">${h.newLine || ''}</span>
                  <span class="codelab-diff-prefix">${prefix}</span>
                  <span class="codelab-diff-code">${escapeHtml(h.text)}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        const leftRows = diff.hunks.filter(h => h.type !== 'add');
        const rightRows = diff.hunks.filter(h => h.type !== 'del');
        diffBodyHtml = `
          <div class="codelab-diff-split">
            <div class="codelab-diff-pane">
              <div class="codelab-diff-pane__title">${escapeHtml(leftLabel)}</div>
              ${leftRows.map(h => `
                <div class="codelab-diff-line ${h.type === 'del' ? 'codelab-diff-line--del' : 'codelab-diff-line--same'}">
                  <span class="codelab-diff-gutter">${h.oldLine || ''}</span>
                  <span class="codelab-diff-prefix">${h.type === 'del' ? '-' : ' '}</span>
                  <span class="codelab-diff-code">${escapeHtml(h.text)}</span>
                </div>
              `).join('')}
            </div>
            <div class="codelab-diff-pane">
              <div class="codelab-diff-pane__title">${escapeHtml(rightLabel)}</div>
              ${rightRows.map(h => `
                <div class="codelab-diff-line ${h.type === 'add' ? 'codelab-diff-line--add' : 'codelab-diff-line--same'}">
                  <span class="codelab-diff-gutter">${h.newLine || ''}</span>
                  <span class="codelab-diff-prefix">${h.type === 'add' ? '+' : ' '}</span>
                  <span class="codelab-diff-code">${escapeHtml(h.text)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal codelab-diff-modal" role="dialog" aria-modal="true" aria-label="Diff Viewer — ${escapeHtml(file)}">
            <div class="codelab-modal__header">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.diff}<span>Diff — ${escapeHtml(file)} (${isStarter ? 'vs Starter' : 'vs Solution'})</span></span>
                <span class="codelab-diff-stats">
                  <span class="codelab-diff-stat--add">+${diff.added}</span>
                  <span class="codelab-diff-stat--del">-${diff.removed}</span>
                </span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="codelab-seg" role="group" aria-label="Diff View Mode">
                  <button type="button" class="codelab-seg__btn ${viewMode === 'unified' ? 'active' : ''}" data-cl-action="diff-mode" data-diff-mode="unified" data-diff-file="${escapeHtml(file)}" data-diff-target="${escapeHtml(compareTarget)}">Unified</button>
                  <button type="button" class="codelab-seg__btn ${viewMode === 'split' ? 'active' : ''}" data-cl-action="diff-mode" data-diff-mode="split" data-diff-file="${escapeHtml(file)}" data-diff-target="${escapeHtml(compareTarget)}">Split</button>
                </div>
                <button type="button" class="codelab-btn codelab-btn--test" data-cl-action="apply-diff-solution">Apply Reference Solution</button>
                <button type="button" class="codelab-btn" data-cl-action="close-modal">Close (Esc)</button>
              </div>
            </div>
            <div class="codelab-modal__body codelab-diff-body">
              ${diffBodyHtml}
            </div>
          </div>
        </div>
      `;
    }

    _setShellCssVar(shell, prop, val) {
      if (!shell || !shell.style) return;
      if (typeof shell.style.setProperty === 'function') {
        if (val === null) {
          if (typeof shell.style.removeProperty === 'function') shell.style.removeProperty(prop);
        } else {
          shell.style.setProperty(prop, val);
        }
      } else if (val === null) {
        delete shell.style[prop];
      } else {
        shell.style[prop] = val;
      }
    }

    _attachSplitterDrag(splitterEl, { resizeClass, onStart, onMove, onEnd }) {
      if (!splitterEl || splitterEl._clSplitterBound) return;
      splitterEl._clSplitterBound = true;

      splitterEl.addEventListener('pointerdown', e => {
        if (typeof this._activeSplitterCleanup === 'function') {
          try { this._activeSplitterCleanup(); } catch (_err) { void _err; }
          this._activeSplitterCleanup = null;
        }
        const shell = this.container ? this.container.querySelector('.codelab') : null;
        if (!shell) return;
        if (onStart && onStart(e, shell) === false) return;

        e.preventDefault();
        splitterEl.classList.add('is-dragging');
        if (resizeClass) shell.classList.add(resizeClass);
        try {
          if (typeof splitterEl.setPointerCapture === 'function') {
            splitterEl.setPointerCapture(e.pointerId);
          }
        } catch (err) {
          this.logger.debug('setPointerCapture failed.', err);
        }

        const moveTarget = (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
          ? window
          : (typeof document !== 'undefined' && typeof document.addEventListener === 'function' ? document : splitterEl);
        let ended = false;

        const handleMove = ev => {
          if (ended) return;
          onMove(ev, shell);
        };

        const cleanup = ev => {
          if (ended) return;
          ended = true;
          splitterEl.classList.remove('is-dragging');
          if (resizeClass) shell.classList.remove(resizeClass);
          try {
            if (ev && ev.pointerId !== undefined && typeof splitterEl.releasePointerCapture === 'function') {
              splitterEl.releasePointerCapture(ev.pointerId);
            }
          } catch (err) {
            this.logger.debug('releasePointerCapture failed.', err);
          }
          if (moveTarget && typeof moveTarget.removeEventListener === 'function') {
            moveTarget.removeEventListener('pointermove', handleMove);
            moveTarget.removeEventListener('pointerup', cleanup);
            moveTarget.removeEventListener('pointercancel', cleanup);
          }
          if (moveTarget !== splitterEl) {
            splitterEl.removeEventListener('pointermove', handleMove);
            splitterEl.removeEventListener('pointerup', cleanup);
            splitterEl.removeEventListener('pointercancel', cleanup);
          }
          if (this._activeSplitterCleanup === cleanup) {
            this._activeSplitterCleanup = null;
          }
          if (onEnd && ev) onEnd(ev, shell);
        };

        this._activeSplitterCleanup = cleanup;
        if (moveTarget && typeof moveTarget.addEventListener === 'function') {
          moveTarget.addEventListener('pointermove', handleMove);
          moveTarget.addEventListener('pointerup', cleanup);
          moveTarget.addEventListener('pointercancel', cleanup);
        }
        if (moveTarget !== splitterEl) {
          splitterEl.addEventListener('pointermove', handleMove);
          splitterEl.addEventListener('pointerup', cleanup);
          splitterEl.addEventListener('pointercancel', cleanup);
        }
      });
    }

    _bindSplitters() {
      if (!this.container) return;
      const shell = this.container.querySelector('.codelab');
      if (!shell) return;

      const vSplitter = this.container.querySelector('#cl-splitter-v');
      if (vSplitter && !vSplitter._clDblBound) {
        vSplitter._clDblBound = true;
        vSplitter.addEventListener('dblclick', () => {
          const curShell = this.container.querySelector('.codelab');
          if (curShell) this._setShellCssVar(curShell, '--cl-guide-width', '360px');
          if (this.editor) this.editor.layout();
        });
      }
      this._attachSplitterDrag(vSplitter, {
        resizeClass: 'is-resizing',
        onMove: (ev, curShell) => {
          const shellRect = curShell.getBoundingClientRect();
          const guideEl = this.container.querySelector('#cl-guide-pane, .codelab-guide');
          const leftEdge = guideEl ? guideEl.getBoundingClientRect().left : shellRect.left;
          const minW = 220;
          const maxW = Math.max(minW, Math.floor(shellRect.width * 0.55));
          const nextW = Math.min(maxW, Math.max(minW, Math.round(ev.clientX - leftEdge)));
          this._setShellCssVar(curShell, '--cl-guide-width', `${nextW}px`);
          if (this.editor) this.editor.layout();
        }
      });

      const hSplitter = this.container.querySelector('#cl-splitter-h');
      if (hSplitter && !hSplitter._clDblBound) {
        hSplitter._clDblBound = true;
        hSplitter.addEventListener('dblclick', () => {
          const curShell = this.container.querySelector('.codelab');
          this.panelHeight = 220;
          this.panelMaximized = false;
          if (curShell) curShell.classList.remove('panel-maximized');
          this.setPanelVisible(true, { skipRender: true });
          if (curShell) this._setShellCssVar(curShell, '--cl-drawer-height', '220px');
          if (this.editor) this.editor.layout();
          this._saveState();
        });
      }
      this._attachSplitterDrag(hSplitter, {
        resizeClass: 'is-resizing-row',
        onStart: (_e, curShell) => {
          const mainEl = this.container.querySelector('.codelab-workbench-main, .codelab-main');
          if (!mainEl) return false;
          const drawer = this.container.querySelector('#cl-drawer');
          if (drawer) drawer.classList.remove('is-minimized');
          this.panelMaximized = false;
          curShell.classList.remove('panel-maximized');
          return true;
        },
        onMove: (ev, curShell) => {
          const mainEl = this.container.querySelector('.codelab-workbench-main, .codelab-main');
          if (!mainEl) return;
          const rect = mainEl.getBoundingClientRect();
          const minH = 110;
          const maxH = Math.max(minH, Math.floor(rect.height * 0.75));
          const nextH = Math.min(maxH, Math.max(minH, Math.round(rect.bottom - ev.clientY)));
          this.panelHeight = nextH;
          this._setShellCssVar(curShell, '--cl-drawer-height', `${nextH}px`);
          if (this.editor) this.editor.layout();
        },
        onEnd: () => {
          this._saveState();
        }
      });

      const fSplitter = this.container.querySelector('#cl-splitter-files');
      const applyExplorerWidth = (w, curShell) => {
        this.explorerWidth = Math.round(w);
        if (curShell) this._setShellCssVar(curShell, '--cl-explorer-width', `${this.explorerWidth}px`);
        if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
      };
      if (fSplitter && !fSplitter._clDblBound) {
        fSplitter._clDblBound = true;
        fSplitter.addEventListener('dblclick', () => {
          applyExplorerWidth(260, this.container.querySelector('.codelab'));
          this._saveState();
        });
      }
      this._attachSplitterDrag(fSplitter, {
        resizeClass: 'is-resizing',
        onMove: (ev, curShell) => {
          const bodyEl = this.container.querySelector('.codelab-body');
          const sidebarEl = this.container.querySelector('#cl-sidebar, .codelab-sidebar');
          const bodyRect = (bodyEl || curShell).getBoundingClientRect();
          const sbRect = sidebarEl ? sidebarEl.getBoundingClientRect() : bodyRect;
          const minW = 150;
          const maxW = Math.max(minW, Math.floor(bodyRect.width * 0.5));
          const isRight = curShell.classList.contains('sidebar-right');
          const rawW = isRight ? (sbRect.right - ev.clientX) : (ev.clientX - sbRect.left);
          const nextW = Math.min(maxW, Math.max(minW, Math.round(rawW)));
          applyExplorerWidth(nextW, curShell);
        },
        onEnd: () => {
          this._saveState();
        }
      });

      const pSplitter = this.container.querySelector('#cl-splitter-preview');
      if (pSplitter && !pSplitter._clDblBound) {
        pSplitter._clDblBound = true;
        pSplitter.addEventListener('dblclick', () => {
          const curShell = this.container.querySelector('.codelab');
          this.previewSplitWidth = 0;
          if (curShell) this._setShellCssVar(curShell, '--cl-preview-split-width', null);
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
          this._saveState();
        });
      }
      this._attachSplitterDrag(pSplitter, {
        resizeClass: 'is-resizing',
        onMove: (ev, curShell) => {
          const ws = this.container.querySelector('.codelab-workspace');
          const rect = (ws || curShell).getBoundingClientRect();
          const minW = 240;
          const maxW = Math.max(minW, Math.floor(rect.width * 0.65));
          const nextW = Math.min(maxW, Math.max(minW, Math.round(rect.right - ev.clientX)));
          this.previewSplitWidth = nextW;
          this._setShellCssVar(curShell, '--cl-preview-split-width', `${nextW}px`);
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        },
        onEnd: () => {
          this._saveState();
        }
      });
    }

    selectStep(idx, shouldJump = true) {
      if (idx < 0 || idx >= this.steps.length) return;
      this.activeStepIndex = idx;
      this.guideTab = 'steps';
      this._saveState();
      this._renderStepPills();
      this._renderGuidePane();

      if (shouldJump) {
        const step = this.steps[idx];
        if (step) {
          const rawTarget = step.targetFile || this._pickDefaultFile();
          const targetFile = rawTarget ? this._resolveStepTargetFile(rawTarget) : this._pickDefaultFile();
          this.openFile(targetFile, step.targetSymbol || `TODO (Step ${idx + 1})`);
        }
      }
      this._renderBreadcrumbs();
    }

    openFile(filename, symbolToFind = '') {
      if (!this.files || this.files[filename] === undefined) return;
      this._activeScmDiffFile = null;
      if (
        this.activeFile &&
        this.activeFile !== filename &&
        this.configuration &&
        this.configuration.get('files.autoSave', 'afterDelay') === 'onFocusChange' &&
        ((this._dirtyFiles && this._dirtyFiles.size > 0) || this.saveStatusState === 'dirty')
      ) {
        this.saveActiveFile({ manual: false });
      }
      if (!Array.isArray(this.openTabs)) this.openTabs = [];
      if (!this.openTabs.includes(filename)) {
        this.openTabs.push(filename);
      }
      this.activeFile = filename;
      this.activeTab = filename;
      this._saveState();
      this._lintFile(filename);
      this._syncActiveFileToView();
      this._emitEvent('codelab:file-open', { labId: this.labId, filename });

      if (symbolToFind && this.editor && this.monaco) {
        const model = this.editor.getModel();
        if (model) {
          const candidates = [
            `TODO (Step ${this.activeStepIndex + 1})`,
            symbolToFind
          ];
          const firstPart = symbolToFind.split('/')[0].trim();
          if (firstPart && firstPart !== symbolToFind) candidates.push(firstPart);
          if (firstPart.includes('.')) candidates.push(firstPart.split('.').pop().trim());
          for (const cand of candidates) {
            if (!cand) continue;
            const matches = model.findMatches(cand, false, false, false, null, true);
            if (matches && matches.length > 0) {
              const range = matches[0].range;
              this.editor.revealLineInCenter(range.startLineNumber);
              this.editor.setPosition({ lineNumber: range.startLineNumber, column: range.startColumn });
              this._stepDecorations = this.editor.deltaDecorations(this._stepDecorations || [], [
                {
                  range: new this.monaco.Range(range.startLineNumber, 1, range.startLineNumber, 1),
                  options: { isWholeLine: true, className: 'codelab-target-line-highlight' }
                }
              ]);
              this.editor.focus();
              break;
            }
          }
        }
      }
    }

    _flushCurrentSlotSnapshot() {
      const curKey = `${this.mode}:${this.lang}`;
      if (!this.savedState) this.savedState = {};
      if (!this.savedState.customFiles) this.savedState.customFiles = {};
      if (!this.savedState.hasSnapshot) this.savedState.hasSnapshot = {};
      this.savedState.customFiles[curKey] = { ...(this.files || {}) };
      this.savedState.hasSnapshot[curKey] = true;
    }

    setMode(newMode) {
      if (newMode !== 'guided' && newMode !== 'sandbox') return;
      if (this.mode === newMode) return;
      const prevMode = this.mode;
      const prevFiles = { ...(this.files || {}) };
      const prevBase = this._getBaseFilesForModeAndLang(prevMode, this.lang);
      const prevTabs = Array.isArray(this.openTabs) ? [...this.openTabs] : [];
      const prevActive = this.activeFile;
      this._flushCurrentSlotSnapshot();
      this.mode = newMode;
      if (this.contextKeys) {
        this.contextKeys.setContext('workbenchMode', this.mode);
      }
      const computed = this._computeInitialFiles();
      const merged = { ...computed };
      if (!this.hasGuidedLab) {
        for (const [fPath, fContent] of Object.entries(prevFiles)) {
          if (merged[fPath] === undefined || prevFiles[fPath] !== prevBase[fPath]) {
            merged[fPath] = fContent;
          }
        }
        for (const baseKey of Object.keys(prevBase)) {
          if (!Object.prototype.hasOwnProperty.call(prevFiles, baseKey) && merged[baseKey] === prevBase[baseKey]) {
            delete merged[baseKey];
          }
        }
      } else {
        for (const [fPath, fContent] of Object.entries(prevFiles)) {
          if (!Object.prototype.hasOwnProperty.call(prevBase, fPath) && merged[fPath] === undefined) {
            merged[fPath] = fContent;
          }
        }
      }
      this.files = merged;
      for (const filePath of Object.keys(this.files)) {
        const parts = filePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      }
      if (!this._savedSnapshot) this._savedSnapshot = {};
      for (const [k, v] of Object.entries(this.files)) {
        if (!this._dirtyFiles || !this._dirtyFiles.has(k)) {
          this._savedSnapshot[k] = v;
        }
      }
      const ordered = this._orderedFileNames();
      const preservedTabs = prevTabs.filter(t => this.files[t] !== undefined);
      this.openTabs = ordered.length === 0 ? [] : (ordered.length > 8 ? [this._pickPrimaryCloneFile(ordered)].filter(Boolean) : (preservedTabs.length > 0 ? Array.from(new Set([...preservedTabs, ...ordered])) : ordered));
      this.activeFile = (!this.hasGuidedLab && prevActive && this.files[prevActive] !== undefined)
        ? prevActive
        : (this._pickDefaultFile() || (this.openTabs[0] || null));
      this.activeTab = this.settingsTabOpen && this.activeTab === '__settings__' ? '__settings__' : this.activeFile;
      this._saveState({ flushSnapshotOnly: true });
      this._syncFilesToShellVfs({ pruneExtraneous: true, keepGitDir: true });
      this._syncDotCodelabConfig({ isInitialMount: false });
      this._lintAllWorkspaceFiles();

      this.container.querySelectorAll('[data-cl-mode]').forEach(btn => {
        const isActive = btn.dataset.clMode === this.mode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });

      const primaryBtn = this.container.querySelector('#cl-primary-exec-btn');
      if (primaryBtn) {
        if (this.mode === 'guided') {
          primaryBtn.setAttribute('data-cl-action', 'verify-step');
          primaryBtn.setAttribute('title', 'Verify Current Step (⌘+Enter)');
          primaryBtn.innerHTML = `${CL_ICONS.check}<span>Verify Step</span><span class="codelab-btn__kbd">⌘↵</span>`;
        } else if (this.lang === 'sql') {
          primaryBtn.setAttribute('data-cl-action', 'run-code');
          primaryBtn.setAttribute('title', 'Run SQL Query (⌘+Enter)');
          primaryBtn.innerHTML = `${CL_ICONS.play}<span>Run Query</span><span class="codelab-btn__kbd">⌘↵</span>`;
        } else {
          primaryBtn.setAttribute('data-cl-action', 'run-tests');
          primaryBtn.setAttribute('title', 'Run Test Suite (⌘+Enter)');
          primaryBtn.innerHTML = `${CL_ICONS.check}<span>Run Tests</span><span class="codelab-btn__kbd">⌘↵</span>`;
        }
      }

      this._syncAllModels();
      this._syncActiveFileToView();
      this._renderGuidePane();

      const shell = this.container.querySelector('.codelab');
      if (shell) {
        const isGuideCollapsed = !this.hasGuidedLab || this.mode === 'sandbox' || !this.steps.length;
        shell.classList.toggle('guide-collapsed', isGuideCollapsed);
        const toggleBtn = this.container.querySelector('#cl-toggle-guide-btn');
        if (toggleBtn) {
          toggleBtn.classList.toggle('active', !isGuideCollapsed);
          toggleBtn.setAttribute('aria-pressed', String(!isGuideCollapsed));
        }
      }
      if (this.editor && typeof this.editor.layout === 'function') {
        this.editor.layout();
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
          });
        }
        setTimeout(() => {
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        }, 100);
      }
    }

    get language() {
      return this.lang;
    }

    set language(newLang) {
      this.setLanguage(newLang);
    }

    setLanguage(newLang) {
      if (newLang !== 'js' && newLang !== 'ts' && newLang !== 'cpp' && newLang !== 'py' && newLang !== 'sql') return;
      if (this.lang === newLang) return;
      const prevLang = this.lang;
      const prevFiles = { ...(this.files || {}) };
      const prevBase = this._getBaseFilesForModeAndLang(this.mode, prevLang);
      const prevActive = this.activeFile;
      const prevTabs = Array.isArray(this.openTabs) ? [...this.openTabs] : [];
      this._flushCurrentSlotSnapshot();
      this.lang = newLang;
      if (this.enabledLanguages instanceof Set) {
        this.enabledLanguages.add(newLang);
      }
      if (this.contextKeys) {
        this.contextKeys.setContext('editorLangId', this.lang);
      }
      if (this.plugins && typeof this.plugins.fireActivationEvent === 'function') {
        this.plugins.fireActivationEvent(`onLanguage:${this.lang}`).catch(() => {});
      }
      const computed = this._computeInitialFiles();
      const merged = { ...computed };
      if (!this.hasGuidedLab) {
        for (const [fPath, fContent] of Object.entries(prevFiles)) {
          if (merged[fPath] === undefined || prevFiles[fPath] !== prevBase[fPath]) {
            merged[fPath] = fContent;
          }
        }
      } else {
        for (const [fPath, fContent] of Object.entries(prevFiles)) {
          const wasCustom = !Object.prototype.hasOwnProperty.call(prevBase, fPath);
          const wasModified = Object.prototype.hasOwnProperty.call(prevBase, fPath) && prevBase[fPath] !== fContent;
          if ((wasCustom || wasModified) && merged[fPath] === undefined) {
            merged[fPath] = fContent;
          }
        }
      }
      this.files = merged;
      for (const filePath of Object.keys(this.files)) {
        const parts = filePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      }
      if (!this._savedSnapshot) this._savedSnapshot = {};
      for (const [k, v] of Object.entries(this.files)) {
        if (!this._dirtyFiles || !this._dirtyFiles.has(k)) {
          this._savedSnapshot[k] = v;
        }
      }
      const defaultNext = this._pickDefaultFile();
      const validPrevTabs = prevTabs.filter(t => this.files[t] !== undefined);
      if (Object.keys(this.files).length === 0) {
        this.openTabs = [];
        this.activeFile = null;
      } else {
        const nextTabs = [...validPrevTabs];
        if (defaultNext && !nextTabs.includes(defaultNext)) {
          nextTabs.push(defaultNext);
        }
        if (nextTabs.length === 0) {
          const ordered = this._orderedFileNames();
          this.openTabs = ordered.length > 8 ? [this._pickPrimaryCloneFile(ordered)].filter(Boolean) : ordered;
        } else {
          this.openTabs = nextTabs;
        }
        this.activeFile = (this._isBlankBase && prevActive && this.files[prevActive] !== undefined)
          ? prevActive
          : (defaultNext || this.openTabs[0] || null);
      }
      this.activeTab = this.settingsTabOpen && this.activeTab === '__settings__' ? '__settings__' : this.activeFile;
      if (this.lang === 'sql') {
        this.drawerTab = 'sql-results';
      }
      this._saveState({ flushSnapshotOnly: true });
      this._syncFilesToShellVfs({ pruneExtraneous: true, keepGitDir: true });
      this._syncDotCodelabConfig({ isInitialMount: false });
      this._lintAllWorkspaceFiles();

      if (typeof this._refreshToolbarAndTabs === 'function') {
        this._refreshToolbarAndTabs();
      } else {
        this._refreshLanguageSwitcher();
      }
      this._refreshDrawerTabs();
      this.container.querySelectorAll('[data-cl-lang]').forEach(btn => {
        const isActive = btn.dataset.clLang === this.lang;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      this._syncAllModels();
      this._syncActiveFileToView();
      this._renderGuidePane();
      this._renderDrawerBody();
      this._updateStatusBar();
    }

    switchLang(newLang) {
      return this.setLanguage(newLang);
    }

    switchMode(newMode) {
      return this.setMode(newMode);
    }

    configure({ mode, lang, stepIndex, onClose } = {}) {
      if (typeof onClose === 'function') {
        this.onClose = onClose;
        const rightBar = this.container.querySelector('.codelab-topbar__right');
        if (rightBar && !rightBar.querySelector('#cl-close-ide-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'codelab-btn codelab-btn--exit-lab codelab-btn--close-ide';
          btn.id = 'cl-close-ide-btn';
          btn.setAttribute('data-cl-action', 'close-lab');
          btn.title = this.backLabel ? `Exit Lab (${this.backLabel})` : 'Exit Lab / Back to Build Guide';
          btn.setAttribute('aria-label', 'Exit Lab');
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span class="codelab-btn__label">Exit Lab</span>';
          rightBar.appendChild(btn);
        }
      }
      if (mode === 'guided' || mode === 'sandbox') {
        this.setMode(mode);
      }
      if (lang === 'js' || lang === 'ts' || lang === 'cpp' || lang === 'py' || lang === 'sql') {
        this.setLanguage(lang);
      }
      if (typeof stepIndex === 'number' && !Number.isNaN(stepIndex)) {
        this.selectStep(stepIndex, true);
      }
      const shell = this.container.querySelector('.codelab');
      if (shell) {
        const isGuideCollapsed = !this.hasGuidedLab || this.mode === 'sandbox' || !this.steps.length;
        shell.classList.toggle('guide-collapsed', isGuideCollapsed);
        const toggleBtn = this.container.querySelector('#cl-toggle-guide-btn');
        if (toggleBtn) {
          toggleBtn.classList.toggle('active', !isGuideCollapsed);
          toggleBtn.setAttribute('aria-pressed', String(!isGuideCollapsed));
        }
      }
      if (this.editor && typeof this.editor.layout === 'function') {
        this.editor.layout();
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
          });
        }
        setTimeout(() => {
          if (this.editor && typeof this.editor.layout === 'function') this.editor.layout();
        }, 100);
      }
    }

    toggleFullscreen() {
      const shell = this.container.querySelector('.codelab');
      if (!shell) return;
      this.isFullscreen = !this.isFullscreen;
      shell.classList.toggle('is-fullscreen', this.isFullscreen);
      const fsBtn = this.container.querySelector('#cl-fullscreen-btn');
      if (fsBtn) {
        fsBtn.classList.toggle('active', this.isFullscreen);
        fsBtn.title = this.isFullscreen ? 'Exit Fullscreen (Esc)' : 'Toggle Fullscreen';
      }
      if (typeof document !== 'undefined') {
        const target = this.container.closest('.build-lab-overlay') || shell;
        if (this.isFullscreen && !document.fullscreenElement && target && typeof target.requestFullscreen === 'function') {
          target.requestFullscreen().catch(() => {});
        } else if (!this.isFullscreen && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().catch(() => {});
        }
      }
      if (this.editor) setTimeout(() => this.editor.layout(), 50);
    }

    stopExecution() {
      this._handleInterrupt();
    }

    cancelExecution() {
      this.stopExecution();
    }

    toggleWebPreview() {
      if (this.previewState && this.previewState.dockMode === 'split') {
        this._togglePreviewDock();
        if (this.drawerTab === 'preview') {
          this.switchDrawerTab('terminal');
        }
        return;
      }
      if (this.drawerTab === 'preview') {
        this.switchDrawerTab('terminal');
        return;
      }
      const existingPort = (this.previewState && this.previewState.port) || this._firstListeningPort();
      if (existingPort) {
        this._openWebPreview(existingPort);
      } else if (this._hasWebContent()) {
        this.previewApp();
      } else {
        this._openWebPreview(3000);
      }
    }

    _isRealBrowserDom() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return false;
      if (typeof process !== 'undefined' && process && process.versions && (process.versions.node || process.versions.bun)) {
        return false;
      }
      return Boolean(this.container && typeof this.container.querySelector === 'function' && this.container.querySelector('#cl-modal-slot'));
    }

    _hasModifiedOrCustomFiles() {
      if (this._dirtyFiles && this._dirtyFiles.size > 0) return true;
      const base = this._getBaseFilesForModeAndLang(this.mode, this.lang) || {};
      const curKeys = Object.keys(this.files || {});
      const baseKeys = Object.keys(base);
      if (curKeys.length !== baseKeys.length) return true;
      for (const k of curKeys) {
        if (!Object.prototype.hasOwnProperty.call(base, k)) return true;
        if (this.files[k] !== base[k]) return true;
      }
      return false;
    }

    resetLab(opts = {}) {
      const force = Boolean(opts && opts.force);
      const isInteractiveBrowser = Boolean((opts && opts.ui) || this._isRealBrowserDom());
      if (!force && isInteractiveBrowser && this._hasModifiedOrCustomFiles()) {
        const slot = this.container.querySelector('#cl-modal-slot');
        if (slot) {
          this._captureModalReturnFocus();
          slot.innerHTML = `
            <div class="codelab-modal-backdrop" data-cl-backdrop="reset-confirm">
              <div class="codelab-modal codelab-confirm-modal" id="reset-confirm-modal" data-cl-modal="reset-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cl-reset-confirm-title" aria-describedby="cl-reset-confirm-desc" style="max-width:440px;">
                <div class="codelab-modal__header">
                  <span id="cl-reset-confirm-title">Reset Workspace</span>
                  <button type="button" class="codelab-btn" data-cl-action="close-modal" aria-label="Close">✕</button>
                </div>
                <div class="codelab-modal__body">
                  <p id="cl-reset-confirm-desc" style="margin:0 0 16px;color:var(--cl-fg);line-height:1.5;">
                    Resetting this workspace will discard all custom files, folders, and unsaved edits and restore the starter state. This action cannot be undone.
                  </p>
                  <div class="codelab-modal__footer" style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" class="codelab-btn" data-cl-confirm="cancel" data-cl-action="close-modal" autofocus>Cancel</button>
                    <button type="button" class="codelab-btn codelab-btn--danger" data-cl-confirm="reset" id="cl-confirm-reset-btn">Reset Workspace</button>
                  </div>
                </div>
              </div>
            </div>
          `;
          const confirmBtn = slot.querySelector('#cl-confirm-reset-btn');
          if (confirmBtn) {
            confirmBtn.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              this.closeModal({ restoreFocus: false });
              this.resetLab({ force: true });
            });
          }
          const cancelBtn = slot.querySelector('[data-cl-confirm="cancel"]');
          if (cancelBtn && typeof cancelBtn.focus === 'function') {
            cancelBtn.focus();
          }
          return false;
        }
      }

      this._userEditSeq = (this._userEditSeq || 0) + 1;
      if (this._dirtyFiles) this._dirtyFiles.clear();
      if (this._fallbackHistory) this._fallbackHistory.clear();
      if (this._diagnosticsStore && typeof this._diagnosticsStore.clear === 'function') {
        try { this._diagnosticsStore.clear(); } catch (_err) { void _err; }
      }
      this._mdPreviewOpen = false;
      this.completedSteps = new Set();
      this.folders = new Set();
      this.collapsedFolders = new Set();
      this.files = this._getBaseFilesForModeAndLang(this.mode, this.lang);
      this._savedSnapshot = { ...(this.files || {}) };
      for (const filePath of Object.keys(this.files)) {
        const parts = filePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      }
      const ordered = this._orderedFileNames();
      this.openTabs = ordered.length === 0 ? [] : (ordered.length > 8 ? [this._pickPrimaryCloneFile(ordered)].filter(Boolean) : ordered);
      this.activeFile = ordered.length === 0 ? null : (this._pickDefaultFile() || this.openTabs[0] || null);
      this.activeTab = this.activeFile;
      const key = `${this.mode}:${this.lang}`;
      if (this.savedState.customFiles) {
        delete this.savedState.customFiles[key];
      }
      if (this.savedState.hasSnapshot) {
        delete this.savedState.hasSnapshot[key];
      }
      this._syncFilesToShellVfs({ pruneExtraneous: true });
      this._saveState({ flushFiles: true });
      this._syncDotCodelabConfig({ isInitialMount: false });
      this._syncAllModels();
      this._lintAllWorkspaceFiles();
      this._syncActiveFileToView();
      this._renderStepPills();
      this._pushTerminalLog({ type: 'system', text: `↺ Reset workspace files to clean ${this.mode} (${this.lang.toUpperCase()}) state.` });
      this._renderDrawerBody();
      return true;
    }

    showPackagesModal() {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
      this._captureModalReturnFocus();
      const rawDetected = this._detectPackages();
      const rawPkgs = Array.isArray(rawDetected)
        ? rawDetected
        : (rawDetected && Array.isArray(rawDetected.npmPackages) ? rawDetected.npmPackages : []);
      const pkgs = rawPkgs.map(p => {
        if (typeof p === 'string') {
          const atIdx = p.lastIndexOf('@');
          if (atIdx > 0) {
            return { name: p.slice(0, atIdx), version: p.slice(atIdx + 1) || 'latest' };
          }
          return { name: p, version: (rawDetected && rawDetected.pkgJsonDeps && rawDetected.pkgJsonDeps[p]) || 'latest' };
        }
        return p;
      });
      const builtins = [
        'node:fs', 'node:path', 'node:crypto', 'node:events', 'node:http',
        'node:net', 'node:stream', 'node:buffer', 'node:util', 'node:test', 'node:assert'
      ];

      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-label="Packages & Node Runtime">
            <div class="codelab-modal__header">
              <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.box}<span>Packages &amp; Virtual Node Runtime</span></span>
              <div style="display:flex;gap:8px;">
                <button type="button" class="codelab-btn" data-cl-action="open-package-json">Edit package.json</button>
                <button type="button" class="codelab-btn" data-cl-action="close-modal">Close (Esc)</button>
              </div>
            </div>
            <div class="codelab-modal__body" style="font-family:var(--cl-font-sans);">
              <div style="display:flex;gap:8px;margin-bottom:16px;">
                <input id="cl-pkg-input" type="text" placeholder="Add npm package (e.g. zod, lru-cache, nanoid@5.0.0)..." style="flex:1;height:32px;padding:0 10px;background:var(--cl-bg);border:1px solid var(--cl-border-strong);border-radius:var(--cl-radius-sm);color:var(--cl-fg);font-family:var(--cl-font-mono);font-size:12px;outline:none;" />
                <button type="button" class="codelab-btn codelab-btn--primary" data-cl-action="add-package">+ Add Dependency</button>
              </div>
              <div style="margin-bottom:16px;">
                <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--cl-fg-muted);margin-bottom:8px;">
                  External NPM Packages (${pkgs.length})
                </div>
                ${pkgs.length === 0 ? `
                  <div style="padding:12px;border:1px solid var(--cl-border);border-radius:var(--cl-radius-sm);background:var(--cl-bg);color:var(--cl-fg-muted);font-size:12.5px;">
                    No external npm packages imported yet. Any <code>import ... from 'pkg'</code> or <code>require('pkg')</code> in your code is automatically resolved via <strong>jsDelivr</strong> when you run or test.
                  </div>
                ` : `
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    ${pkgs.map(p => `
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--cl-border);border-radius:var(--cl-radius-sm);background:var(--cl-bg);font-family:var(--cl-font-mono);font-size:12px;">
                        <span style="color:var(--cl-fg);font-weight:600;">${escapeHtml(p.name)}</span>
                        <span style="color:var(--cl-accent);">${escapeHtml(p.version)} · jsDelivr</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
              <div>
                <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--cl-fg-muted);margin-bottom:8px;">
                  Built-in Virtual Node.js Modules (Zero-Latency In-Memory VFS)
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${builtins.map(b => `
                    <span style="padding:3px 8px;border:1px solid var(--cl-border);border-radius:4px;background:var(--cl-bg);font-family:var(--cl-font-mono);font-size:11px;color:var(--cl-fg-muted);">${b}</span>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const input = slot.querySelector('#cl-pkg-input');
      if (input) {
        input.focus();
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && input.value.trim()) {
            if (e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            this.addNpmPackage(input.value.trim());
          }
        });
      }
    }

    addNpmPackage(rawSpec) {
      const spec = rawSpec.trim();
      if (!spec) return;
      let name = spec;
      let version = 'latest';
      const atIdx = spec.lastIndexOf('@');
      if (atIdx > 0) {
        name = spec.slice(0, atIdx);
        version = spec.slice(atIdx + 1) || 'latest';
      }
      let pkgJson = { name: this.labId, version: '1.0.0', dependencies: {} };
      if (this.files['package.json']) {
        try {
          pkgJson = JSON.parse(this.files['package.json']);
        } catch (err) {
          this.logger.warn('Malformed package.json when adding dependency; reinitializing.', err);
        }
      }
      if (!pkgJson.dependencies || typeof pkgJson.dependencies !== 'object') {
        pkgJson.dependencies = {};
      }
      pkgJson.dependencies[name] = version;
      this.files['package.json'] = JSON.stringify(pkgJson, null, 2) + '\n';
      this._saveState();
      this._syncAllModels();
      this._renderFileLists();
      this._updateStatusBar();
      this.showPackagesModal();
    }

    showSolutionModal() {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
      this._captureModalReturnFocus();
      const refFiles = this._getBaseFilesForModeAndLang('sandbox', this.lang);
      const targetFile = refFiles[this.activeFile] ? this.activeFile : this._pickDefaultFile();
      const refCode = refFiles[targetFile] || '// Reference solution not found';

      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-label="Reference Solution">
            <div class="codelab-modal__header">
              <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.lightbulb}<span>Reference Solution — ${escapeHtml(targetFile)}</span></span>
              <div style="display:flex;gap:8px;">
                <button type="button" class="codelab-btn" data-cl-action="compare-diff" data-diff-target="solution" data-diff-file="${escapeHtml(targetFile)}">
                  ${CL_ICONS.diff}<span>Compare Diff</span>
                </button>
                <button type="button" class="codelab-btn codelab-btn--test" data-cl-action="apply-solution">
                  Apply Solution to Editor
                </button>
                <button type="button" class="codelab-btn" data-cl-action="close-modal">Close (Esc)</button>
              </div>
            </div>
            <div class="codelab-modal__body">
              <pre style="margin:0;white-space:pre-wrap;color:var(--cl-fg);">${escapeHtml(refCode)}</pre>
            </div>
          </div>
        </div>
      `;
    }

    closeModal(opts = {}) {
      this._lastBackdropPointerDownTarget = null;
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      const hadModal = Boolean(slot && slot.innerHTML && slot.innerHTML.trim() !== '');
      const prior = this._modalReturnFocusEl || null;
      this._modalReturnFocusEl = null;
      const onCloseCb = this._onModalClosedCallback || null;
      this._onModalClosedCallback = null;
      if (slot) slot.innerHTML = '';
      if (typeof onCloseCb === 'function') {
        try { onCloseCb(); } catch (_err) { void _err; }
      }
      if (hadModal && (!opts || opts.restoreFocus !== false)) {
        this._restoreWorkbenchFocus(prior);
      }
    }

    closeCommandPalette() {
      this.closeModal();
    }

    applyReferenceSolution() {
      const refFiles = this._getBaseFilesForModeAndLang('sandbox', this.lang);
      const targetFile = refFiles[this.activeFile] ? this.activeFile : this._pickDefaultFile();
      if (refFiles[targetFile]) {
        this.files[targetFile] = refFiles[targetFile];
        this._saveState();
        this._syncAllModels();
        this._syncActiveFileToView();
      }
      this.closeModal();
      this.runTests();
    }

    // ── Execution Engine (Web Worker + Virtual Node Runtime) ───────────────
    _isAbortResult(res, signal) {
      if (signal && signal.aborted) return true;
      if (!res || typeof res !== 'object') return false;
      return Boolean(res.cancelled || res.aborted || res.exitCode === 130);
    }

    async _executeRuntime(execOptions) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const configuredTimeoutMs = this.configuration
        ? Math.max(500, Math.min(120000, Number(this.configuration.get('runtime.timeoutMs', 8000)) || 8000))
        : 8000;
      const payload = {
        ...execOptions,
        timeoutMs: execOptions && execOptions.timeoutMs !== undefined ? execOptions.timeoutMs : configuredTimeoutMs,
        instanceId: this.instanceId,
        stdin: execOptions.stdin !== undefined ? execOptions.stdin : (this.customStdin || ''),
        cppCompiler: execOptions.cppCompiler || this.cppCompiler,
        onStdout: execOptions.onStdout || ((chunk) => this._appendTerminalStream('stdout', chunk)),
        onStderr: execOptions.onStderr || ((chunk) => this._appendTerminalStream('stderr', chunk)),
        signal: execOptions.signal || this._activeCommandAbortController?.signal
      };
      try {
        const isCppEntry = Boolean(payload && typeof payload.entry === 'string' && /\.(cpp|cc|cxx|wasm)$/i.test(payload.entry));
        const isPyEntry = Boolean(payload && typeof payload.entry === 'string' && /\.py$/i.test(payload.entry));
        if (!isCppEntry && !isPyEntry && typeof root.CodeLabRuntime?.preloadNpmPackages === 'function' && payload && payload.files) {
          const rawDetected = this._detectPackages();
          const detectedList = Array.isArray(rawDetected)
            ? rawDetected
            : (rawDetected && Array.isArray(rawDetected.npmPackages) ? rawDetected.npmPackages : []);
          if (detectedList.length > 0) {
            this._setRuntimeStatus('fetching', `Fetching ${detectedList.map(d => typeof d === 'string' ? d : d.name).join(', ')}...`);
          }
          const preloaded = await root.CodeLabRuntime.preloadNpmPackages(payload.files, pkgName => {
            this._setRuntimeStatus('fetching', `Fetching ${pkgName} from jsDelivr CDN...`);
          });
          // Hand the fetched module sources to the runtime so the Web Worker
          // (which has an isolated module cache) can resolve them from node_modules.
          if (preloaded && typeof preloaded === 'object' && Object.keys(preloaded).length > 0) {
            payload.packages = Object.assign({}, preloaded, payload.packages || {});
          }
        }
        this._setRuntimeStatus('running', isCppEntry ? `Compiling & Running ${payload.entry}...` : isPyEntry ? `Running Python 3.12: ${payload.entry}...` : `Running ${payload.entry || payload.mode || 'script'}...`);
        let res;
        const pyRunner = this.pythonCompiler || (typeof globalThis !== 'undefined' && globalThis.__codelabPythonCompiler) || (typeof root !== 'undefined' && root.__codelabPythonCompiler);
        if ((isPyEntry || this.lang === 'py') && pyRunner) {
          res = await pyRunner(payload);
        } else if (isPyEntry || this.lang === 'py') {
          this._setRuntimeStatus('error', 'Python 3.12 extension not loaded');
          return {
            ok: false,
            exitCode: 1,
            stdout: '',
            stderr: 'Python WebAssembly toolchain is not registered. Enable pythonExtension from "@innovatorved/code-lab/extensions/python" to run Python files.\n',
            durationMs: 0,
            peakMemoryBytes: 0
          };
        } else if (isCppEntry && typeof root.CodeLabRuntime?.executeInVirtualRuntime === 'function') {
          res = await root.CodeLabRuntime.executeInVirtualRuntime(payload);
        } else if (typeof root.CodeLabRuntime?.executeInWorker === 'function') {
          res = await root.CodeLabRuntime.executeInWorker(payload);
        } else if (typeof root.CodeLabRuntime?.executeInVirtualRuntime === 'function') {
          res = await root.CodeLabRuntime.executeInVirtualRuntime(payload);
        } else {
          throw new Error('CodeLabRuntime is not loaded.');
        }
        const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        this.lastRunDurationMs = res && typeof res.durationMs === 'number' ? res.durationMs : elapsed;
        this.lastDurationMs = this.lastRunDurationMs;
        this.lastPeakMemoryBytes = res && typeof res.peakMemoryBytes === 'number' ? res.peakMemoryBytes : null;
        if (res && res.vfsChanges) {
          this._applyWorkerVfsDiffToWorkspace(res.vfsChanges);
        }
        this._updateTelemetryHud();
        this._setRuntimeStatus('idle', 'Ready · Node v22 VFS');
        return res;
      } catch (err) {
        if (payload.signal && payload.signal.aborted) {
          this._setRuntimeStatus('idle', 'Ready · Node v22 VFS');
        } else {
          this._setRuntimeStatus('error', 'Execution error');
        }
        throw err;
      }
    }

    _applyWorkerVfsDiffToWorkspace(vfsChanges) {
      if (!vfsChanges || typeof vfsChanges !== 'object') return;
      const { createdDirs = [], modifiedFiles = {}, deletedFiles = [] } = vfsChanges;
      let changed = false;

      if (Array.isArray(createdDirs)) {
        for (const dir of createdDirs) {
          if (typeof dir === 'string' && dir.startsWith('/workspace/')) {
            const relDir = dir.slice('/workspace/'.length);
            if (relDir && !relDir.startsWith('.git') && !relDir.startsWith('node_modules')) {
              if (!this.folders.has(relDir)) {
                this.folders.add(relDir);
                changed = true;
              }
            }
          }
          if (this.shell && this.shell.vfs && typeof this.shell.vfs.mkdirSync === 'function') {
            try {
              this.shell.vfs.mkdirSync(dir, { recursive: true });
            } catch (err) {
              _bootDebug('_applyWorkerVfsDiffToWorkspace mkdirSync failed', dir, err);
            }
          }
        }
      }

      if (modifiedFiles && typeof modifiedFiles === 'object') {
        const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;
        for (const [absPath, rawData] of Object.entries(modifiedFiles)) {
          if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFileSync === 'function') {
            try {
              const slashIdx = absPath.lastIndexOf('/');
              if (slashIdx > 0 && typeof this.shell.vfs.mkdirSync === 'function') {
                this.shell.vfs.mkdirSync(absPath.slice(0, slashIdx), { recursive: true });
              }
              this.shell.vfs.writeFileSync(absPath, rawData);
            } catch (err) {
              _bootDebug('_applyWorkerVfsDiffToWorkspace writeFileSync failed', absPath, err);
            }
          }
          if (absPath.startsWith('/workspace/')) {
            const rel = absPath.slice('/workspace/'.length);
            if (!rel || rel.startsWith('.git/') || rel.startsWith('node_modules/')) continue;
            let textVal = '';
            let isLikelyBinary = false;
            if (typeof rawData === 'string') {
              textVal = rawData;
            } else if (rawData instanceof Uint8Array || ArrayBuffer.isView(rawData)) {
              const bytes = rawData instanceof Uint8Array
                ? rawData
                : new Uint8Array(rawData.buffer, rawData.byteOffset, rawData.byteLength);
              const probeLen = Math.min(bytes.length, 512);
              for (let i = 0; i < probeLen; i++) {
                if (bytes[i] === 0) {
                  isLikelyBinary = true;
                  break;
                }
              }
              if (!isLikelyBinary) {
                textVal = decoder ? decoder.decode(bytes) : String.fromCharCode(...bytes);
              }
            }
            if (!isLikelyBinary && this.files[rel] !== textVal) {
              this.files[rel] = textVal;
              const parts = rel.split('/');
              let cur = '';
              for (let i = 0; i < parts.length - 1; i++) {
                cur = cur ? `${cur}/${parts[i]}` : parts[i];
                this.folders.add(cur);
              }
              const model = this.models.get(rel);
              if (model && typeof model.getValue === 'function' && model.getValue() !== textVal) {
                model.setValue(textVal);
              }
              changed = true;
            }
          }
        }
      }

      if (Array.isArray(deletedFiles)) {
        for (const absPath of deletedFiles) {
          if (this.shell && this.shell.vfs && typeof this.shell.vfs.unlinkSync === 'function') {
            try {
              this.shell.vfs.unlinkSync(absPath);
            } catch (err) {
              _bootDebug('_applyWorkerVfsDiffToWorkspace unlinkSync failed', absPath, err);
            }
          }
          if (absPath.startsWith('/workspace/')) {
            const rel = absPath.slice('/workspace/'.length);
            if (rel && Object.prototype.hasOwnProperty.call(this.files, rel)) {
              delete this.files[rel];
              const model = this.models.get(rel);
              if (model) {
                model.dispose();
                this.models.delete(rel);
              }
              if (Array.isArray(this.openTabs)) {
                const idx = this.openTabs.indexOf(rel);
                if (idx !== -1) this.openTabs.splice(idx, 1);
              }
              if (this.activeFile === rel) {
                this.activeFile = (this.openTabs && this.openTabs[0]) || null;
              }
              changed = true;
            }
          }
        }
      }

      if (changed) {
        this._saveState();
        this._renderFileLists();
      }
    }

    async runCode() {
      if (this.lang === 'sql' || (this.activeFile && /\.sql$/i.test(this.activeFile))) {
        return this.runSql('run');
      }
      const entry = this._findEntryFile('demo') || this.activeFile || this._pickDefaultFile();
      if (!entry) {
        this._pushTerminalLog({ type: 'stderr', text: 'No entry file or active file to run.' });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }
      if (/\.sql$/i.test(entry)) {
        return this.runSql('run');
      }
      return this._executeEntryFile(entry);
    }

    async runProject() {
      if (this.lang === 'sql') {
        return this.runSql('run');
      }
      const entry = this._findEntryFile('demo');
      if (!entry && this._hasWebContent() && typeof this.previewApp === 'function') {
        return this.previewApp();
      }
      return this.runCode();
    }

    async runSelectedCode() {
      if (this.isRunning) return null;
      if (this.lang === 'sql' || (this.activeFile && /\.sql$/i.test(this.activeFile))) {
        const fullSql = (this.activeFile && typeof this.files[this.activeFile] === 'string') ? this.files[this.activeFile] : '';
        const selectedSql = this._sqlWorkbenchEditor ? this._sqlWorkbenchEditor.getSelection() : '';
        return this.runSql('run', {
          sql: fullSql,
          selectedSql,
          effectiveSql: (selectedSql && selectedSql.trim()) ? selectedSql : fullSql,
          dialect: this.sqlDialect
        });
      }
      let selectedText = '';
      if (this.editor && typeof this.editor.getSelection === 'function' && typeof this.editor.getModel === 'function') {
        const sel = this.editor.getSelection();
        const model = this.editor.getModel();
        if (sel && model && typeof model.getValueInRange === 'function') {
          selectedText = model.getValueInRange(sel) || '';
        }
      }
      if (!selectedText && this.container) {
        const fallback = this.container.querySelector('#cl-fallback-editor');
        if (fallback && typeof fallback.selectionStart === 'number' && typeof fallback.selectionEnd === 'number') {
          selectedText = String(fallback.value || '').slice(fallback.selectionStart, fallback.selectionEnd);
        }
      }
      if (!selectedText && this.activeFile && typeof this.files[this.activeFile] === 'string') {
        selectedText = this.files[this.activeFile];
      }
      const trimmed = String(selectedText || '').trim();
      if (!trimmed) return null;

      this.isRunning = true;
      this._updateRunStateUI();
      this.drawerTab = 'terminal';
      this._pushTerminalLog({ type: 'system', text: '\n$ node -e "<selection>"' });
      this._renderDrawerBody();

      const abortCtrl = new AbortController();
      this._activeCommandAbortController = abortCtrl;
      let streamedStdout = false;
      let streamedStderr = false;
      try {
        const res = await this._executeRuntime({
          files: { ...this.files },
          mode: 'repl',
          replCode: trimmed,
          signal: abortCtrl.signal,
          onStdout: (c) => { streamedStdout = true; this._appendTerminalStream('stdout', c); },
          onStderr: (c) => { streamedStderr = true; this._appendTerminalStream('stderr', c); }
        });
        this._flushTerminalStream();
        if (!streamedStdout && res && res.stdout) {
          this._pushTerminalLog({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
        }
        if (!streamedStderr && res && res.stderr) {
          this._pushTerminalLog({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (res && res.replValue !== undefined) {
          this._pushTerminalLog({ type: 'success', text: `→ ${res.replValue}` });
        }
        this._renderDrawerBody();
        return res;
      } finally {
        if (this._activeCommandAbortController === abortCtrl) {
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        this._updateRunStateUI();
      }
    }

    async runEntry() {
      return this.runCode();
    }

    async runActiveFile() {
      const file = this.activeFile || this._pickDefaultFile();
      if (!file) {
        this._pushTerminalLog({ type: 'stderr', text: 'No active file to run.' });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }
      if (/\.sql$/i.test(file) || this.lang === 'sql') {
        return this.runSql('run');
      }
      return this._executeEntryFile(file);
    }

    async _executeEntryFile(entry) {
      if (this.isRunning) return;
      if (!entry || this.files[entry] === undefined) {
        this._pushTerminalLog({ type: 'stderr', text: `File not found: ${entry || 'entry'}` });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }

      this.isRunning = true;
      this._updateRunStateUI();
      this.drawerTab = 'terminal';
      const isCpp = /\.(cpp|cc|cxx)$/i.test(entry);
      const isPy = /\.py$/i.test(entry);
      const cmdText = isCpp
        ? `\n$ g++ -std=c++20 ${entry} -o a.out && ./a.out`
        : isPy
        ? `\n$ python3 ${entry}`
        : `\n$ node ${entry}`;
      this._pushTerminalLog({ type: 'system', text: cmdText });
      this._renderDrawerBody();

      let abortCtrl = new AbortController();
      this._activeCommandAbortController = abortCtrl;
      let streamedStdout = false;
      let streamedStderr = false;
      let lastRes = null;

      try {
        const res = await this._executeRuntime({
          files: { ...this.files },
          entry,
          mode: 'run',
          stdin: this.customStdin || '',
          signal: abortCtrl.signal,
          onStdout: (c) => {
            streamedStdout = true;
            this._appendTerminalStream('stdout', c);
          },
          onStderr: (c) => {
            streamedStderr = true;
            this._appendTerminalStream('stderr', c);
          }
        });
        lastRes = res;
        this._flushTerminalStream();
        const aborted = this._isAbortResult(res, abortCtrl.signal);

        if (!aborted && !streamedStdout && res.stdout) {
          this._pushTerminalLog({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
        }
        if (!aborted && !streamedStderr && res.stderr) {
          this._pushTerminalLog({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (!aborted && res.error) {
          this._pushTerminalLog({ type: 'stderr', text: formatErrorText(res.error) });
        }
        if (!aborted) {
          this.lastFsSnapshot = res.fsSnapshot || [];
          this.lastHttpTrace = res.httpTrace || [];
          if (res.durationMs !== undefined) this.lastDurationMs = res.durationMs;
          if (res.peakMemoryBytes !== undefined) this.lastPeakMemoryBytes = res.peakMemoryBytes;
          this._updateTelemetryHud();
        }

        if (this.onRun) {
          try { this.onRun(res); } catch (err) { this.logger.error('onRun callback threw.', err); }
        }
        this._emitEvent('codelab:run', { labId: this.labId, mode: 'run', entry, result: res });
      } catch (err) {
        this._flushTerminalStream();
        if (!(abortCtrl.signal.aborted || (err && err.name === 'AbortError'))) {
          this._pushTerminalLog({ type: 'stderr', text: `Execution error: ${formatErrorText(err)}` });
        }
      } finally {
        if (this._activeCommandAbortController === abortCtrl) {
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        this._updateRunStateUI();
      }

      this._renderDrawerBody();
      return lastRes;
    }

    async runDemo() {
      if (this.isRunning) return;
      if (this.lang === 'sql') {
        return this.runSql('run');
      }
      const entry = this._findEntryFile('demo') || this._findEntryFile('entry') || this.activeFile;
      if (!entry) {
        if ((this.files['index.html'] || this.files['public/index.html']) && typeof this.previewApp === 'function') {
          return this.previewApp();
        }
        this._pushTerminalLog({ type: 'stderr', text: 'No entry or demo file found in this workspace.' });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }
      if (/\.sql$/i.test(entry)) {
        return this.runSql('run');
      }
      return this._executeEntryFile(entry);
    }

    async formatActiveDocument() {
      if (!this.activeFile) return;
      const file = this.activeFile;
      const code = this.files[file] || '';
      if (!code) return;

      const syncFormattedToEditors = (formatted) => {
        if (formatted === code) return;
        this.files[file] = formatted;
        if (this.editor && this.editor.getModel()) {
          this.editor.setValue(formatted);
        }
        if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.setValue === 'function' && /\.sql$/i.test(file)) {
          if (typeof this._sqlWorkbenchEditor.getValue !== 'function' || this._sqlWorkbenchEditor.getValue() !== formatted) {
            this._sqlWorkbenchEditor.setValue(formatted);
          }
        }
        const fb = this.container ? this.container.querySelector('#cl-fallback-editor') : null;
        if (fb && this.activeFile === file) {
          fb.value = formatted;
          const hist = this._ensureFallbackHistoryEntry(file);
          hist.current = formatted;
          this._updateFallbackGutter();
        }
        this._saveState();
        this._notifyCodeChange(file, formatted);
      };

      if (file.endsWith('.json')) {
        try {
          const tabSize = this.configuration
            ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
            : 2;
          const parsed = JSON.parse(code);
          const formatted = JSON.stringify(parsed, null, tabSize) + '\n';
          syncFormattedToEditors(formatted);
        } catch (err) {
          void err;
        }
        return;
      }

      if (file.endsWith('.sql')) {
        const sqlPack = getSqlPack();
        const tabSize = this.configuration ? this.configuration.get('editor.tabSize', 2) : 2;
        const formatted = this._sqlWorkbenchEditor
          ? this._sqlWorkbenchEditor.format()
          : (sqlPack && typeof sqlPack.formatSql === 'function'
              ? sqlPack.formatSql(code, { dialect: this.sqlDialect, indent: Number(tabSize) || 2, keywordCase: 'upper' })
              : code);
        syncFormattedToEditors(formatted);
        return;
      }

      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx')) {
        if (this.editor && typeof this.editor.getAction === 'function') {
          const action = this.editor.getAction('editor.action.formatDocument');
          if (action && typeof action.run === 'function') {
            await action.run();
            const newCode = this.editor.getValue();
            syncFormattedToEditors(newCode);
            return;
          }
        }
        // Lightweight indentation/trailing-whitespace normalization fallback when Monaco formatter is unavailable
        const normalized = code.split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n');
        syncFormattedToEditors(normalized.endsWith('\n') ? normalized : (normalized + '\n'));
      } else if (file.endsWith('.cpp') || file.endsWith('.hpp') || file.endsWith('.cc') || file.endsWith('.h')) {
        let formatter = (root && root.CodeLabWorkbenchComponents && root.CodeLabWorkbenchComponents.formatCppSource) ||
          (typeof globalThis !== 'undefined' && globalThis.CodeLabWorkbenchComponents && globalThis.CodeLabWorkbenchComponents.formatCppSource) ||
          null;
        if (!formatter && typeof require === 'function') {
          try {
            const mod = require('./workbench/editor');
            formatter = mod.formatCppSource;
          } catch (err) {
            void err;
          }
        }
        if (formatter) {
          syncFormattedToEditors(formatter(code));
        }
      } else if (file.endsWith('.py')) {
        let formatter = (root && root.CodeLabPython && root.CodeLabPython.formatPythonSource) ||
          (typeof globalThis !== 'undefined' && globalThis.CodeLabPython && globalThis.CodeLabPython.formatPythonSource) ||
          null;
        if (!formatter && typeof require === 'function') {
          try {
            const mod = require('./extensions/python');
            formatter = mod.formatPythonSource;
          } catch (err) {
            void err;
          }
        }
        if (formatter) {
          syncFormattedToEditors(formatter(code));
        }
      }
    }

    async shareSnapshot() {
      let compressor = (root && root.CodeLabWorkbenchComponents && root.CodeLabWorkbenchComponents.compressWorkspaceSnapshot) ||
        (typeof globalThis !== 'undefined' && globalThis.CodeLabWorkbenchComponents && globalThis.CodeLabWorkbenchComponents.compressWorkspaceSnapshot) ||
        null;
      if (!compressor && typeof require === 'function') {
        try {
          const mod = require('./workbench/share');
          compressor = mod.compressWorkspaceSnapshot;
        } catch (err) {
          void err;
        }
      }
      if (!compressor) {
        this._showToast('Snapshot compression not available', 'error');
        return;
      }
      try {
        const payload = {
          lang: this.lang,
          activeFile: this.activeFile,
          files: { ...this.files },
          stdin: this.customStdin || ''
        };
        const token = await compressor(payload);
        if (typeof window !== 'undefined' && window.location) {
          const newUrl = `${window.location.origin}${window.location.pathname}#codelab=${token}`;
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState(null, '', newUrl);
          } else {
            window.location.hash = `codelab=${token}`;
          }
          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(newUrl);
            this._showToast('Snapshot link copied to clipboard! (#codelab=...)', 'success');
          } else {
            this._showToast('Snapshot link generated in URL hash (#codelab=...)', 'success');
          }
        }
      } catch (err) {
        this.logger.error('Failed to create snapshot.', err);
        this._showToast('Failed to create snapshot', 'error');
      }
    }

    async _checkUrlSnapshot() {
      if (typeof window === 'undefined' || !window.location || !window.location.hash) return;
      const hash = window.location.hash;
      const match = hash.match(/#(?:codelab|snapshot)=([A-Za-z0-9_-]+)/);
      if (!match) return;
      const token = match[1];
      let decompressor = (root && root.CodeLabWorkbenchComponents && root.CodeLabWorkbenchComponents.decompressWorkspaceSnapshot) ||
        (typeof globalThis !== 'undefined' && globalThis.CodeLabWorkbenchComponents && globalThis.CodeLabWorkbenchComponents.decompressWorkspaceSnapshot) ||
        null;
      if (!decompressor && typeof require === 'function') {
        try {
          const mod = require('./workbench/share');
          decompressor = mod.decompressWorkspaceSnapshot;
        } catch (err) {
          void err;
        }
      }
      if (!decompressor) return;
      try {
        const snapshot = await decompressor(token);
        if (snapshot && snapshot.files && typeof snapshot.files === 'object') {
          this.files = { ...snapshot.files };
          if (snapshot.lang && (snapshot.lang === 'js' || snapshot.lang === 'ts' || snapshot.lang === 'cpp' || snapshot.lang === 'py' || snapshot.lang === 'sql')) {
            this.lang = snapshot.lang;
          }
          if (snapshot.stdin) {
            this.customStdin = snapshot.stdin;
          }
          if (snapshot.activeFile && this.files[snapshot.activeFile]) {
            this.activeFile = snapshot.activeFile;
          }
          this.openTabs = Object.keys(this.files);
          this._renderFileLists();
          this._renderBreadcrumbs();
          this._syncAllModels();
          if (this.activeFile) this.openFile(this.activeFile);
          this._showToast('Restored workspace from snapshot URL', 'success');
        }
      } catch (err) {
        this.logger.warn('Failed to decompress URL snapshot.', err);
      }
    }

    async runTests(filterTestNames = null) {
      if (this.isRunning) return;
      const entry = this._findEntryFile('test');
      if (!entry && this.lang === 'sql') {
        return this.runSql('verify');
      }
      if (entry && /\.sql$/i.test(entry)) {
        return this.runSql('verify');
      }
      if (!entry) {
        this._pushTerminalLog({ type: 'stderr', text: 'No test file (test.js, test.ts, test.cpp, test.py) found in this workspace.' });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }

      this.isRunning = true;
      this.testSuiteVisible = true;
      this.drawerTab = 'tests';
      this._refreshDrawerTabs();
      this._updateRunStateUI();
      const isCppTest = /\.(cpp|cc|cxx)$/i.test(entry);
      const isPyTest = /\.py$/i.test(entry);
      this._pushTerminalLog({
        type: 'system',
        text: isCppTest
          ? `\n$ g++ -std=c++20 ${entry} -o a.out && ./a.out`
          : isPyTest
          ? `\n$ pytest ${entry}`
          : `\n$ node ${entry}`
      });

      let abortCtrl = new AbortController();
      this._activeCommandAbortController = abortCtrl;
      let streamedStdout = false;
      let streamedStderr = false;
      let lastRes = null;

      try {
        const res = await this._executeRuntime({
          files: { ...this.files },
          entry,
          mode: 'test',
          stdin: this.customStdin || '',
          testFilter: filterTestNames,
          signal: abortCtrl.signal,
          onStdout: (c) => {
            streamedStdout = true;
            this._appendTerminalStream('stdout', c);
          },
          onStderr: (c) => {
            streamedStderr = true;
            this._appendTerminalStream('stderr', c);
          }
        });
        lastRes = res;
        this._flushTerminalStream();
        const aborted = this._isAbortResult(res, abortCtrl.signal);

        if (!aborted) {
          this.lastTestResults = res.testResults || [];
          this.lastFsSnapshot = res.fsSnapshot || [];
          this.lastHttpTrace = res.httpTrace || [];
          if (res.durationMs !== undefined) this.lastDurationMs = res.durationMs;
          if (res.peakMemoryBytes !== undefined) this.lastPeakMemoryBytes = res.peakMemoryBytes;
          this._updateTelemetryHud();
        }

        if (!aborted && !streamedStdout && res.stdout) {
          this._pushTerminalLog({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
        }
        if (!aborted && !streamedStderr && res.stderr) {
          this._pushTerminalLog({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (!aborted && res.error) {
          this._pushTerminalLog({ type: 'stderr', text: formatErrorText(res.error) });
        }

        if (this.onTestResult) {
          try { this.onTestResult(res); } catch (err) { this.logger.error('onTestResult callback threw.', err); }
        }
        if (this.onRun) {
          try { this.onRun(res); } catch (err) { this.logger.error('onRun callback threw.', err); }
        }
        this._emitEvent('codelab:run', { labId: this.labId, mode: 'test', entry, result: res });

        // Check guided step completion
        const resultMap = new Map(this.lastTestResults.map(r => [r.name, r.status === 'pass']));
        let newlyCompleted = false;
        this.steps.forEach((step, sIdx) => {
          if (Array.isArray(step.testNames) && step.testNames.length > 0) {
            const allStepPass = step.testNames.every(tName => resultMap.get(tName) === true);
            if (allStepPass && !this.completedSteps.has(step.id)) {
              this.completedSteps.add(step.id);
              newlyCompleted = true;
              if (this.onStepComplete) {
                try { this.onStepComplete(step, sIdx); } catch (err) { this.logger.error('onStepComplete callback threw.', err); }
              }
              const stepDetail = {
                labId: this.labId,
                step,
                stepId: step.id,
                stepIndex: sIdx,
                index: sIdx,
                completedSteps: Array.from(this.completedSteps)
              };
              this._emitEvent('codelab:step-complete', stepDetail);
              this._emitEvent('codelab:step:pass', stepDetail);
            }
          }
        });
        if (newlyCompleted) {
          this._saveState();
          if (this.steps.length > 0 && this.completedSteps.size >= this.steps.length) {
            if (this.onLabComplete) {
              try { this.onLabComplete(this.labId); } catch (err) { this.logger.error('onLabComplete callback threw.', err); }
            }
            this._emitEvent('codelab:lab-complete', {
              labId: this.labId,
              completedSteps: Array.from(this.completedSteps)
            });
          }
        }
      } catch (err) {
        this._flushTerminalStream();
        if (!(abortCtrl.signal.aborted || (err && err.name === 'AbortError'))) {
          this._pushTerminalLog({ type: 'stderr', text: `Test runner error: ${formatErrorText(err)}` });
        }
      } finally {
        if (this._activeCommandAbortController === abortCtrl) {
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        this._updateRunStateUI();
      }

      this._renderStepPills();
      this._renderGuidePane();
      this._renderDrawerBody();
      return lastRes;
    }

    async verifyCurrentStep(payloadOverride = null) {
      if (this.lang === 'sql' && !this._findEntryFile('test')) {
        await this.runSql('verify', payloadOverride);
      } else {
        await this.runTests();
      }
      const step = this.steps[this.activeStepIndex];
      if (step && this.completedSteps.has(step.id) && this.activeStepIndex < this.steps.length - 1) {
        // Advance to next step and jump to its target symbol/TODO
        this.selectStep(this.activeStepIndex + 1, true);
      }
    }

    setSqlSchema(schema) {
      this.sqlSchema = schema || null;
      if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.setSchema === 'function') {
        this._sqlWorkbenchEditor.setSchema(this.sqlSchema);
      }
      return this;
    }

    setSqlDialect(dialect) {
      this.sqlDialect = dialect === 'sqlite' ? 'sqlite' : 'postgres';
      if (this.lang === 'sql') {
        this.runtimeStatusText = `Ready · ${this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18'}`;
      }
      if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.setDialect === 'function') {
        this._sqlWorkbenchEditor.setDialect(this.sqlDialect);
      }
      this._updateStatusBar();
      return this;
    }

    async runSql(modeOverride = 'run', payloadOverride = null) {
      if (this.isRunning) return null;
      const runMode = (modeOverride === 'verify' || modeOverride === 'explain') ? modeOverride : 'run';
      const targetFile = (this.activeFile && /\.sql$/i.test(this.activeFile))
        ? this.activeFile
        : (this._findEntryFile('demo') || this._pickDefaultFile() || 'query.sql');
      const fullSql = (payloadOverride && typeof payloadOverride.sql === 'string')
        ? payloadOverride.sql
        : String(this.files[targetFile] ?? '');
      const selectedSql = (payloadOverride && typeof payloadOverride.selectedSql === 'string')
        ? payloadOverride.selectedSql
        : (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.getSelection === 'function'
            ? this._sqlWorkbenchEditor.getSelection()
            : '');
      const effectiveSql = (payloadOverride && typeof payloadOverride.effectiveSql === 'string')
        ? payloadOverride.effectiveSql
        : ((selectedSql && selectedSql.trim()) ? selectedSql : fullSql);

      const stepObj = (this.steps && this.steps[this.activeStepIndex]) ? this.steps[this.activeStepIndex] : null;
      const stepInfo = stepObj
        ? { index: this.activeStepIndex, id: stepObj.id, title: stepObj.title }
        : null;

      this.isRunning = true;
      this._updateRunStateUI();
      this._setRuntimeStatus('running', runMode === 'explain' ? 'Explaining SQL plan...' : 'Running SQL query...');
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const sqlPack = getSqlPack();

      let res = null;
      let caughtErr = null;
      try {
        if (typeof this.sqlRunner === 'function') {
          res = await this.sqlRunner({
            sql: fullSql,
            selectedSql,
            effectiveSql,
            dialect: this.sqlDialect,
            mode: runMode,
            step: stepInfo
          });
        } else if (root.CodeLabRuntime && typeof root.CodeLabRuntime.createSqliteDatabase === 'function') {
          const SqliteDb = root.CodeLabRuntime.createSqliteDatabase(this.shell ? this.shell.vfs : null, () => this.cwd || '/workspace');
          const db = new SqliteDb(':memory:');
          if (this.files['schema.sql'] && targetFile !== 'schema.sql') {
            db.exec(this.files['schema.sql']);
          }
          if (this.files['seed.sql'] && targetFile !== 'seed.sql') {
            db.exec(this.files['seed.sql']);
          }
          const trimmedSql = String(effectiveSql || '').trim();
          if (!trimmedSql) {
            res = { columns: [], rows: [], rowCount: 0, execMs: 0 };
          } else if (runMode === 'explain') {
            const innerSql = trimmedSql.replace(/^EXPLAIN(?:\s+QUERY\s+PLAN)?\s+/i, '').replace(/;\s*$/, '').trim();
            if (innerSql) {
              this._validateSqlStatement(innerSql, db);
            }
            const explainStmt = /^EXPLAIN\b/i.test(trimmedSql)
              ? trimmedSql
              : `EXPLAIN QUERY PLAN ${trimmedSql.replace(/;\s*$/, '')}`;
            const planRows = db.query(explainStmt).all();
            const planText = planRows.map((r) => r.detail || JSON.stringify(r)).join('\n');
            res = {
              columns: planRows.length > 0 ? Object.keys(planRows[0]) : ['id', 'parent', 'detail'],
              rows: planRows,
              rowCount: planRows.length,
              plan: planText
            };
          } else {
            const stmts = this._splitSqlStatements(trimmedSql);
            let lastRows = [];
            for (let i = 0; i < stmts.length; i++) {
              const st = stmts[i];
              this._validateSqlStatement(st, db);
              if (/^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(st)) {
                lastRows = db.query(st).all();
              } else {
                db.run(st);
              }
            }
            const columns = lastRows.length > 0 ? Object.keys(lastRows[0]) : [];
            res = {
              columns,
              rows: lastRows,
              rowCount: lastRows.length
            };
          }
        } else {
          throw new Error('No SQL runner configured and built-in SQLite engine is unavailable.');
        }
      } catch (err) {
        caughtErr = err;
      } finally {
        this.isRunning = false;
        this._updateRunStateUI();
      }

      const elapsed = Math.max(0, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0));
      const rawError = caughtErr || (res && res.error ? res.error : null);

      this._ensureDiagnosticsStore();

      if (rawError) {
        const parsedDiag = (sqlPack && typeof sqlPack.parseSqlEngineError === 'function')
          ? sqlPack.parseSqlEngineError(rawError, effectiveSql, this.sqlDialect)
          : {
              severity: 'error',
              message: rawError && rawError.message ? String(rawError.message) : String(rawError),
              line: 1,
              column: 1
            };
        if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.setDiagnostics === 'function') {
          this._sqlWorkbenchEditor.setDiagnostics([parsedDiag]);
        }
        if (this._diagnosticsStore && typeof this._diagnosticsStore.setFileDiagnostics === 'function') {
          this._diagnosticsStore.setFileDiagnostics(targetFile, [{
            file: targetFile,
            line: parsedDiag.line || 1,
            column: parsedDiag.column || 1,
            severity: 'error',
            message: parsedDiag.hint ? `${parsedDiag.message} (Hint: ${parsedDiag.hint})` : parsedDiag.message,
            source: 'sql'
          }], 'sql');
        }
        this.lastSqlResult = {
          columns: [],
          rows: [],
          rowCount: 0,
          execMs: (res && typeof res.execMs === 'number') ? res.execMs : elapsed,
          error: parsedDiag.hint ? `${parsedDiag.message}\nHint: ${parsedDiag.hint}` : parsedDiag.message,
          verification: res && res.verification ? res.verification : undefined
        };
        this._setRuntimeStatus('error', 'SQL query error');
      } else {
        if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.clearDiagnostics === 'function') {
          this._sqlWorkbenchEditor.clearDiagnostics();
        }
        if (this._diagnosticsStore && typeof this._diagnosticsStore.setFileDiagnostics === 'function') {
          this._diagnosticsStore.setFileDiagnostics(targetFile, [], 'sql');
        }
        const rows = (res && Array.isArray(res.rows)) ? res.rows : [];
        let cols = (res && Array.isArray(res.columns)) ? [...res.columns] : [];
        if (cols.length === 0 && rows.length > 0 && rows[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
          cols = Object.keys(rows[0]);
        }
        const normalizedRows = rows.map((r) => {
          if (Array.isArray(r)) return r;
          if (r && typeof r === 'object') return cols.map((c) => r[c]);
          return [r];
        });
        this.lastSqlResult = {
          columns: cols,
          rows: normalizedRows,
          rowCount: (res && typeof res.rowCount === 'number') ? res.rowCount : normalizedRows.length,
          execMs: (res && typeof res.execMs === 'number') ? res.execMs : elapsed,
          plan: res && res.plan !== undefined
            ? (typeof res.plan === 'string' ? res.plan : JSON.stringify(res.plan, null, 2))
            : undefined,
          verification: res && res.verification ? res.verification : undefined,
          error: null
        };
        this._setRuntimeStatus('idle', `Ready · ${this.sqlDialect === 'sqlite' ? 'SQLite 3' : 'PostgreSQL 18'}`);
      }

      this.lastRunDurationMs = this.lastSqlResult.execMs;
      this.lastDurationMs = this.lastSqlResult.execMs;
      this.drawerTab = 'sql-results';
      this._refreshDrawerTabs();
      this._updateTelemetryHud();

      if (
        !rawError &&
        (runMode === 'verify' || (this.hasGuidedLab && this.mode === 'guided')) &&
        stepObj &&
        (!this.lastSqlResult.verification || this.lastSqlResult.verification.passed !== false)
      ) {
        if (!this.completedSteps.has(stepObj.id)) {
          this.completedSteps.add(stepObj.id);
          this._saveState();
          if (this.onStepComplete) {
            try { this.onStepComplete(stepObj, this.activeStepIndex); } catch (cbErr) { this.logger.error('onStepComplete callback threw.', cbErr); }
          }
          const stepDetail = {
            labId: this.labId,
            step: stepObj,
            stepId: stepObj.id,
            stepIndex: this.activeStepIndex,
            index: this.activeStepIndex,
            completedSteps: Array.from(this.completedSteps)
          };
          this._emitEvent('codelab:step-complete', stepDetail);
          this._emitEvent('codelab:step:pass', stepDetail);
          if (this.steps.length > 0 && this.completedSteps.size >= this.steps.length) {
            if (this.onLabComplete) {
              try { this.onLabComplete(this.labId); } catch (cbErr) { this.logger.error('onLabComplete callback threw.', cbErr); }
            }
            this._emitEvent('codelab:lab-complete', {
              labId: this.labId,
              completedSteps: Array.from(this.completedSteps)
            });
          }
        }
      }

      this._renderStepPills();
      this._renderGuidePane();
      this._renderDrawerBody();
      this._updateStatusBar();

      if (this.onRun) {
        try { this.onRun(this.lastSqlResult); } catch (cbErr) { this.logger.error('onRun callback threw.', cbErr); }
      }
      this._emitEvent('codelab:sql-run', { labId: this.labId, mode: runMode, result: this.lastSqlResult });
      this._emitEvent('codelab:run', { labId: this.labId, mode: runMode, entry: targetFile, result: this.lastSqlResult });
      return this.lastSqlResult;
    }

    _splitSqlStatements(sqlText) {
      const src = String(sqlText || '');
      const out = [];
      let cur = '';
      let inSingle = false;
      let inDouble = false;
      let inBacktick = false;
      let inLineComment = false;
      let inBlockComment = false;
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        const next = src[i + 1] || '';
        if (inLineComment) {
          if (ch === '\n') {
            inLineComment = false;
            cur += '\n';
          }
          continue;
        }
        if (inBlockComment) {
          if (ch === '*' && next === '/') {
            inBlockComment = false;
            i++;
          } else if (ch === '\n') {
            cur += '\n';
          }
          continue;
        }
        if (!inSingle && !inDouble && !inBacktick) {
          if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
          }
          if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
          }
          if (ch === ';') {
            const trimmed = cur.trim();
            if (trimmed) out.push(trimmed);
            cur = '';
            continue;
          }
        }
        if (ch === "'" && !inDouble && !inBacktick) {
          if (inSingle && next === "'") {
            cur += "''";
            i++;
            continue;
          }
          inSingle = !inSingle;
        } else if (ch === '"' && !inSingle && !inBacktick) {
          if (inDouble && next === '"') {
            cur += '""';
            i++;
            continue;
          }
          inDouble = !inDouble;
        } else if (ch === '`' && !inSingle && !inDouble) {
          inBacktick = !inBacktick;
        }
        cur += ch;
      }
      if (inSingle || inDouble || inBacktick) {
        throw new Error('SQL syntax error: unterminated quoted literal');
      }
      if (inBlockComment) {
        throw new Error('SQL syntax error: unterminated block comment');
      }
      const tail = cur.trim();
      if (tail) out.push(tail);
      return out;
    }

    _validateSqlStatement(rawStmt, db) {
      const stmt = String(rawStmt || '').trim();
      if (!stmt) return;

      // Mask string literals and strip comments for structural analysis
      let masked = '';
      let inSingle = false;
      let inDouble = false;
      let inBacktick = false;
      let inBracket = false;
      let parenDepth = 0;
      for (let i = 0; i < stmt.length; i++) {
        const ch = stmt[i];
        const next = stmt[i + 1] || '';
        if (inSingle) {
          if (ch === "'" && next === "'") { i++; continue; }
          if (ch === "'") { inSingle = false; masked += "'s'"; }
          continue;
        }
        if (inDouble) {
          if (ch === '"' && next === '"') { i++; continue; }
          if (ch === '"') { inDouble = false; } else { masked += ch; }
          continue;
        }
        if (inBacktick) {
          if (ch === '`') { inBacktick = false; } else { masked += ch; }
          continue;
        }
        if (inBracket) {
          if (ch === ']') { inBracket = false; } else { masked += ch; }
          continue;
        }
        if (ch === '-' && next === '-') {
          while (i < stmt.length && stmt[i] !== '\n') i++;
          masked += ' ';
          continue;
        }
        if (ch === '/' && next === '*') {
          i += 2;
          while (i < stmt.length && !(stmt[i] === '*' && stmt[i + 1] === '/')) i++;
          i++;
          masked += ' ';
          continue;
        }
        if (ch === "'") { inSingle = true; continue; }
        if (ch === '"') { inDouble = true; continue; }
        if (ch === '`') { inBacktick = true; continue; }
        if (ch === '[') { inBracket = true; continue; }
        if (ch === '(') parenDepth++;
        else if (ch === ')') {
          parenDepth--;
          if (parenDepth < 0) {
            throw new Error('SQL syntax error near ")": unbalanced parentheses');
          }
        }
        masked += ch;
      }
      if (inSingle || inDouble || inBacktick || inBracket) {
        throw new Error('SQL syntax error: unterminated string or identifier');
      }
      if (parenDepth !== 0) {
        throw new Error('SQL syntax error: unbalanced parentheses');
      }

      const norm = masked.replace(/\s+/g, ' ').trim();
      if (!norm) return;

      const verbMatch = norm.match(/^([A-Za-z_]\w*)/);
      const verb = verbMatch ? verbMatch[1].toUpperCase() : '';
      const validVerbs = new Set([
        'SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
        'PRAGMA', 'EXPLAIN', 'BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT',
        'RELEASE', 'VACUUM', 'ANALYZE', 'REINDEX', 'ATTACH', 'DETACH', 'REPLACE', 'VALUES'
      ]);
      if (!verb || !validVerbs.has(verb)) {
        throw new Error(`SQL syntax error near "${verb || stmt.slice(0, 16)}": unrecognized SQL statement`);
      }

      // Common clause typos outside strings
      if (/\bFORM\b/i.test(norm)) {
        throw new Error('SQL syntax error near "FORM": did you mean FROM?');
      }
      if (/\b(?:WHRE|WHER)\b/i.test(norm)) {
        throw new Error('SQL syntax error: malformed WHERE clause');
      }
      if (/\b(?:GRUP|ORDRE)\s+BY\b/i.test(norm)) {
        throw new Error('SQL syntax error: malformed GROUP BY or ORDER BY clause');
      }

      const hasTableInDb = (rawTbl) => {
        if (!db || !(db.tables instanceof Map)) return true;
        const cleanTbl = String(rawTbl || '').replace(/^["`[]|["`\]]$/g, '').split('.').pop() || '';
        if (!cleanTbl) return true;
        const lower = cleanTbl.toLowerCase();
        if (
          lower === 'sqlite_master' ||
          lower === 'sqlite_schema' ||
          lower === 'sqlite_temp_master' ||
          lower === 'dual' ||
          lower.startsWith('pragma_') ||
          lower.startsWith('json_') ||
          lower === 'generate_series'
        ) {
          return true;
        }
        if (db.tables.has(cleanTbl) || db.tables.has(lower)) return true;
        for (const k of db.tables.keys()) {
          if (String(k).toLowerCase() === lower) return true;
        }
        return false;
      };

      const cteNames = new Set();
      if (verb === 'WITH') {
        const cteRe = /\b([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s+AS\s*\(/gi;
        let cm;
        while ((cm = cteRe.exec(norm)) !== null) {
          cteNames.add(cm[1].toLowerCase());
        }
      }

      if (verb === 'SELECT' || verb === 'WITH') {
        const selectIdx = verb === 'SELECT' ? 0 : norm.toUpperCase().lastIndexOf('SELECT ');
        if (selectIdx === -1 && !/\b(?:INSERT|UPDATE|DELETE)\b/i.test(norm)) {
          throw new Error('SQL syntax error: WITH clause must be followed by SELECT, INSERT, UPDATE, or DELETE');
        }
        if (selectIdx !== -1) {
          const selTail = norm.slice(selectIdx);
          if (/^SELECT\s*(?:$|FROM\b)/i.test(selTail)) {
            throw new Error('SQL syntax error near "FROM": missing SELECT column list');
          }
          if (/^SELECT\s+(?:DISTINCT\s+|ALL\s+)?\*\s+(?!FROM\b|WHERE\b|GROUP\b|HAVING\b|ORDER\b|LIMIT\b|OFFSET\b|UNION\b|INTERSECT\b|EXCEPT\b|,)[A-Za-z_]\w*/i.test(selTail)) {
            throw new Error('SQL syntax error: missing FROM keyword');
          }
        }
        const tblRe = /\b(?:FROM|JOIN)\s+([A-Za-z_][\w.]*)/gi;
        let tm;
        while ((tm = tblRe.exec(norm)) !== null) {
          const tbl = tm[1];
          const upperTbl = tbl.toUpperCase();
          if (upperTbl === 'SELECT' || upperTbl === 'VALUES' || upperTbl === 'LATERAL') continue;
          if (cteNames.has(tbl.toLowerCase())) continue;
          if (!hasTableInDb(tbl)) {
            throw new Error(`SQL error: no such table: ${tbl}`);
          }
        }
      } else if (verb === 'INSERT' || verb === 'REPLACE') {
        const im = norm.match(/^(?:INSERT(?:\s+OR\s+\w+)?|REPLACE)\s+INTO\s+([A-Za-z_][\w.]*)/i);
        if (!im) {
          throw new Error(`SQL syntax error near "${verb}": expected INTO <table>`);
        }
        if (!/\b(?:VALUES|SELECT|DEFAULT\s+VALUES)\b/i.test(norm)) {
          throw new Error(`SQL syntax error near "${verb}": expected VALUES or SELECT`);
        }
        if (!hasTableInDb(im[1])) {
          throw new Error(`SQL error: no such table: ${im[1]}`);
        }
      } else if (verb === 'UPDATE') {
        const um = norm.match(/^UPDATE(?:\s+OR\s+\w+)?\s+([A-Za-z_][\w.]*)\s+SET\b/i);
        if (!um) {
          throw new Error('SQL syntax error near "UPDATE": expected UPDATE <table> SET ...');
        }
        if (!hasTableInDb(um[1])) {
          throw new Error(`SQL error: no such table: ${um[1]}`);
        }
      } else if (verb === 'DELETE') {
        const dm = norm.match(/^DELETE\s+FROM\s+([A-Za-z_][\w.]*)/i);
        if (!dm) {
          throw new Error('SQL syntax error near "DELETE": expected DELETE FROM <table>');
        }
        if (!hasTableInDb(dm[1])) {
          throw new Error(`SQL error: no such table: ${dm[1]}`);
        }
      } else if (verb === 'CREATE') {
        if (!/^CREATE\s+(?:TEMP(?:ORARY)?\s+)?(?:UNIQUE\s+)?(?:TABLE|VIEW|INDEX|TRIGGER)\b/i.test(norm)) {
          throw new Error('SQL syntax error near "CREATE": expected TABLE, VIEW, INDEX, or TRIGGER');
        }
      } else if (verb === 'DROP') {
        const dropMatch = norm.match(/^DROP\s+(TABLE|VIEW|INDEX|TRIGGER)(\s+IF\s+EXISTS)?\s+([A-Za-z_][\w.]*)/i);
        if (!dropMatch) {
          throw new Error('SQL syntax error near "DROP": expected DROP TABLE|VIEW|INDEX|TRIGGER <name>');
        }
        if (dropMatch[1].toUpperCase() === 'TABLE' && !dropMatch[2] && !hasTableInDb(dropMatch[3])) {
          throw new Error(`SQL error: no such table: ${dropMatch[3]}`);
        }
      }
    }

    _lintJsonFile(cleanPath, text) {
      const store = this._ensureDiagnosticsStore();
      if (!store || typeof store.setFileDiagnostics !== 'function') return;
      const raw = String(text ?? '');
      if (!raw.trim()) {
        store.setFileDiagnostics(cleanPath, [], 'json');
        return;
      }
      const allowComments = /(?:^|\/)(?:tsconfig|jsconfig).*\.json$/i.test(cleanPath) || cleanPath.startsWith('.codelab/');
      const mod = getModular();
      if (allowComments && mod && typeof mod.parseJsonc === 'function') {
        const res = mod.parseJsonc(raw);
        const errs = Array.isArray(res && res.errors) ? res.errors : [];
        store.setFileDiagnostics(
          cleanPath,
          errs.map((e) => ({
            file: cleanPath,
            line: e.line || 1,
            column: e.column || 1,
            severity: 'error',
            message: String(e.message || 'Invalid JSON syntax'),
            source: 'json'
          })),
          'json'
        );
        return;
      }
      try {
        JSON.parse(raw);
        store.setFileDiagnostics(cleanPath, [], 'json');
      } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Invalid JSON syntax';
        let line = 1;
        let col = 1;
        const posMatch = msg.match(/position\s+(\d+)/i);
        if (posMatch) {
          const offset = Math.max(0, Math.min(raw.length, Number(posMatch[1]) || 0));
          for (let i = 0; i < offset; i++) {
            if (raw[i] === '\n') {
              line++;
              col = 1;
            } else {
              col++;
            }
          }
        } else {
          const lcMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
          if (lcMatch) {
            line = Math.max(1, Number(lcMatch[1]) || 1);
            col = Math.max(1, Number(lcMatch[2]) || 1);
          }
        }
        store.setFileDiagnostics(
          cleanPath,
          [{ file: cleanPath, line, column: col, severity: 'error', message: msg, source: 'json' }],
          'json'
        );
      }
    }

    _lintLexicalJsTs(filename, code) {
      const store = this._ensureDiagnosticsStore();
      if (!store || typeof store.setFileDiagnostics !== 'function') return;
      const cleanPath = String(filename || '').replace(/^\/+/, '');
      const srcTag = /\.ts$/i.test(cleanPath) ? 'ts' : 'js';
      const text = String(code ?? '');
      if (!text.trim()) {
        store.setFileDiagnostics(cleanPath, [], srcTag);
        return;
      }
      const diags = [];
      const stack = [];
      const templateBraceDepths = [];
      let line = 1;
      let col = 1;
      let i = 0;
      let canStartRegex = true;
      const len = text.length;
      const regexKeywords = new Set([
        'return', 'throw', 'case', 'typeof', 'void', 'delete',
        'in', 'instanceof', 'new', 'yield', 'await', 'of', 'else', 'do'
      ]);

      const advance = (ch) => {
        if (ch === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
      };

      while (i < len) {
        const ch = text[i];
        const next = i + 1 < len ? text[i + 1] : '';

        if (i === 0 && ch === '#' && next === '!') {
          while (i < len && text[i] !== '\n') {
            advance(text[i]);
            i++;
          }
          continue;
        }

        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
          advance(ch);
          i++;
          continue;
        }

        if (ch === '/' && next === '/') {
          while (i < len && text[i] !== '\n') {
            advance(text[i]);
            i++;
          }
          continue;
        }

        if (ch === '/' && next === '*') {
          const startLine = line;
          const startCol = col;
          advance(text[i++]);
          advance(text[i++]);
          let closed = false;
          while (i < len) {
            if (text[i] === '*' && text[i + 1] === '/') {
              advance(text[i++]);
              advance(text[i++]);
              closed = true;
              break;
            }
            advance(text[i++]);
          }
          if (!closed) {
            diags.push({ file: cleanPath, line: startLine, column: startCol, severity: 'error', message: 'Unterminated block comment', source: srcTag });
            break;
          }
          continue;
        }

        if (ch === '\'' || ch === '"') {
          const quote = ch;
          const startLine = line;
          const startCol = col;
          advance(text[i++]);
          let closed = false;
          while (i < len) {
            const c = text[i];
            if (c === '\\') {
              advance(text[i++]);
              if (i < len) advance(text[i++]);
              continue;
            }
            if (c === '\n' || c === '\r') {
              break;
            }
            advance(text[i++]);
            if (c === quote) {
              closed = true;
              break;
            }
          }
          if (!closed) {
            diags.push({ file: cleanPath, line: startLine, column: startCol, severity: 'error', message: 'Unterminated string literal', source: srcTag });
            break;
          }
          canStartRegex = false;
          continue;
        }

        if (ch === '`') {
          const consumeTemplateBody = () => {
            while (i < len) {
              const c = text[i];
              if (c === '\\') {
                advance(text[i++]);
                if (i < len) advance(text[i++]);
                continue;
              }
              if (c === '`') {
                advance(text[i++]);
                canStartRegex = false;
                return 'closed';
              }
              if (c === '$' && text[i + 1] === '{') {
                const exprLine = line;
                const exprCol = col;
                advance(text[i++]);
                advance(text[i++]);
                stack.push({ ch: '{', expected: '}', line: exprLine, col: exprCol, isTemplateExpr: true });
                templateBraceDepths.push(stack.length);
                canStartRegex = true;
                return 'expr';
              }
              advance(text[i++]);
            }
            return 'unterminated';
          };
          const startLine = line;
          const startCol = col;
          advance(text[i++]);
          const state = consumeTemplateBody();
          if (state === 'unterminated') {
            diags.push({ file: cleanPath, line: startLine, column: startCol, severity: 'error', message: 'Unterminated template literal', source: srcTag });
            break;
          }
          continue;
        }

        if (ch === '/' && canStartRegex) {
          let probe = i + 1;
          let inClass = false;
          let foundEnd = -1;
          while (probe < len) {
            const pc = text[probe];
            if (pc === '\n' || pc === '\r') break;
            if (pc === '\\') {
              probe += 2;
              continue;
            }
            if (pc === '[') inClass = true;
            else if (pc === ']') inClass = false;
            else if (pc === '/' && !inClass) {
              foundEnd = probe;
              break;
            }
            probe++;
          }
          if (foundEnd > i + 1) {
            let endIdx = foundEnd + 1;
            while (endIdx < len && /[dgimsuvy]/.test(text[endIdx])) endIdx++;
            while (i < endIdx) {
              advance(text[i++]);
            }
            canStartRegex = false;
            continue;
          }
        }

        if (ch === '(' || ch === '[' || ch === '{') {
          const expected = ch === '(' ? ')' : (ch === '[' ? ']' : '}');
          stack.push({ ch, expected, line, col, isTemplateExpr: false });
          advance(text[i++]);
          canStartRegex = true;
          continue;
        }

        if (ch === ')' || ch === ']' || ch === '}') {
          const curLine = line;
          const curCol = col;
          advance(text[i++]);
          if (stack.length === 0) {
            diags.push({ file: cleanPath, line: curLine, column: curCol, severity: 'error', message: `Unexpected closing '${ch}'`, source: srcTag });
            break;
          }
          const top = stack.pop();
          if (top.expected !== ch) {
            diags.push({ file: cleanPath, line: curLine, column: curCol, severity: 'error', message: `Expected '${top.expected}' to match '${top.ch}' at line ${top.line}, found '${ch}'`, source: srcTag });
            break;
          }
          if (ch === '}' && top.isTemplateExpr && templateBraceDepths.length > 0) {
            templateBraceDepths.pop();
            const resumeLine = curLine;
            const resumeCol = curCol;
            let closedTpl = false;
            while (i < len) {
              const c = text[i];
              if (c === '\\') {
                advance(text[i++]);
                if (i < len) advance(text[i++]);
                continue;
              }
              if (c === '`') {
                advance(text[i++]);
                canStartRegex = false;
                closedTpl = true;
                break;
              }
              if (c === '$' && text[i + 1] === '{') {
                const exprLine = line;
                const exprCol = col;
                advance(text[i++]);
                advance(text[i++]);
                stack.push({ ch: '{', expected: '}', line: exprLine, col: exprCol, isTemplateExpr: true });
                templateBraceDepths.push(stack.length);
                canStartRegex = true;
                closedTpl = true;
                break;
              }
              advance(text[i++]);
            }
            if (!closedTpl) {
              diags.push({ file: cleanPath, line: resumeLine, column: resumeCol, severity: 'error', message: 'Unterminated template literal', source: srcTag });
              break;
            }
            continue;
          }
          canStartRegex = ch === '}';
          continue;
        }

        if (/[A-Za-z_$]/.test(ch)) {
          let word = '';
          while (i < len && /[A-Za-z0-9_$]/.test(text[i])) {
            word += text[i];
            advance(text[i++]);
          }
          canStartRegex = regexKeywords.has(word);
          continue;
        }

        if (/[0-9]/.test(ch)) {
          while (i < len && /[0-9a-fA-FxXoObBn_.]/.test(text[i])) {
            advance(text[i++]);
          }
          canStartRegex = false;
          continue;
        }

        if ((ch === '+' && next === '+') || (ch === '-' && next === '-')) {
          advance(text[i++]);
          advance(text[i++]);
          canStartRegex = false;
          continue;
        }

        advance(text[i++]);
        canStartRegex = ch !== '.';
      }

      if (diags.length === 0 && stack.length > 0) {
        const unclosed = stack[stack.length - 1];
        diags.push({
          file: cleanPath,
          line: unclosed.line,
          column: unclosed.col,
          severity: 'error',
          message: `Unclosed '${unclosed.ch}' — expected '${unclosed.expected}'`,
          source: srcTag
        });
      }
      store.setFileDiagnostics(cleanPath, diags, srcTag);
    }

    _runStaticLintersForFile(filename, code) {
      if (!filename) return;
      const clean = String(filename).replace(/^\/+/, '');
      if (/\.py$/i.test(clean) && typeof this._pyLintHandler === 'function') {
        this._ensureDiagnosticsStore();
        this._pyLintHandler(clean, String(code ?? ''));
      } else if (/\.(cpp|cc|cxx|c|hpp|h)$/i.test(clean) && typeof this._cppLintHandler === 'function') {
        this._ensureDiagnosticsStore();
        this._cppLintHandler(clean, String(code ?? ''));
      } else if (/\.json$/i.test(clean) && clean !== '.codelab/settings.json' && clean !== '.codelab/tasks.json') {
        this._lintJsonFile(clean, code);
      } else if (/\.(?:m?js|cjs|ts)$/i.test(clean) && !this.monaco) {
        this._lintLexicalJsTs(clean, code);
      }
    }

    _lintFile(filename) {
      if (!filename || !this.files || this.files[filename] === undefined) return;
      this._runStaticLintersForFile(filename, this.files[filename]);
    }

    _updateProblemsBadge() {
      if (this._destroyed || !this.container) return;
      const badgeEl = typeof this.container.querySelector === 'function'
        ? this.container.querySelector('#cl-problems-count')
        : null;
      if (badgeEl) {
        const total = (this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function')
          ? this._diagnosticsStore.getAll().length
          : 0;
        badgeEl.textContent = String(total);
        if (badgeEl.style) badgeEl.style.display = total > 0 ? 'inline-block' : 'none';
      }
      if (this.drawerTab === 'problems') {
        this._renderDrawerBody();
      }
      this._updateStatusBar();
    }

    _lintAllWorkspaceFiles() {
      if (!this.files || typeof this.files !== 'object') return;
      const names = Object.keys(this.files);
      if (!names.length) return;
      const store = this._ensureDiagnosticsStore();
      const run = () => {
        for (let i = 0; i < names.length; i++) {
          const fn = names[i];
          const code = this.files[fn];
          if (typeof code === 'string' && code.length <= 512 * 1024) {
            this._runStaticLintersForFile(fn, code);
          }
        }
      };
      if (store && typeof store.batch === 'function') {
        store.batch(run);
      } else {
        run();
      }
    }

    _ensureDiagnosticsStore() {
      const diagMod = root.CodeLabDiagnostics;
      if (!this._diagnosticsStore && diagMod && typeof diagMod.createDiagnosticsStore === 'function') {
        this._diagnosticsStore = diagMod.createDiagnosticsStore();
        if (typeof this._diagnosticsStore.subscribe === 'function') {
          this._diagnosticsStore.subscribe(() => {
            if (this._destroyed || !this.container) return;
            const badgeEl = this.container.querySelector('#cl-problems-count');
            if (badgeEl && typeof this._diagnosticsStore.getAll === 'function') {
              const total = this._diagnosticsStore.getAll().length;
              badgeEl.textContent = String(total);
              badgeEl.style.display = total > 0 ? 'inline-block' : 'none';
            }
            if (this.drawerTab === 'problems') {
              this._renderDrawerBody();
            }
            this._updateStatusBar();
          });
        }
      }
      return this._diagnosticsStore;
    }

    _syncDotCodelabConfig({ isInitialMount = false } = {}) {
      const mod = getModular();
      if (!mod || !this.configuration) return;

      this._ensureDiagnosticsStore();

      // 1. .codelab/settings.json
      const hasSettingsFile = Object.prototype.hasOwnProperty.call(this.files, '.codelab/settings.json');
      const rawSettings = hasSettingsFile ? this.files['.codelab/settings.json'] : '';
      if (!hasSettingsFile && this.kernel && this.kernel.fs && typeof this.kernel.fs.deleteFile === 'function') {
        try {
          const kPath = '/workspace/.codelab/settings.json';
          if (typeof this.kernel.fs.exists !== 'function' || this.kernel.fs.exists(kPath)) {
            this.kernel.fs.deleteFile(kPath);
          }
        } catch (err) {
          void err;
        }
      }
      const settingsDiags = this.configuration.loadWorkspaceSettingsJson(rawSettings || '', '.codelab/settings.json');
      if (this._diagnosticsStore && typeof this._diagnosticsStore.setFileDiagnostics === 'function') {
        this._diagnosticsStore.setFileDiagnostics(
          '.codelab/settings.json',
          settingsDiags.map((d) => ({
            file: d.file || '.codelab/settings.json',
            line: d.line || 1,
            column: d.column || 1,
            severity: d.severity || 'warning',
            message: d.message,
            source: 'settings'
          })),
          'settings'
        );
      }

      // 2. .codelab/keybindings.json
      if (this.keybindings && typeof this.keybindings.setUserKeybindings === 'function') {
        const rawKb = Object.prototype.hasOwnProperty.call(this.files, '.codelab/keybindings.json')
          ? this.files['.codelab/keybindings.json']
          : '';
        if (rawKb && rawKb.trim() && typeof mod.parseJsonc === 'function') {
          const parsedKb = mod.parseJsonc(rawKb);
          if (Array.isArray(parsedKb.value)) {
            const validRules = parsedKb.value.filter(
              (r) => r && typeof r === 'object' && typeof r.key === 'string' && typeof r.command === 'string'
            );
            this.keybindings.setUserKeybindings(validRules);
          }
        } else {
          this.keybindings.setUserKeybindings([]);
        }
      }

      // 3. .codelab/tasks.json
      const rawTasks = Object.prototype.hasOwnProperty.call(this.files, '.codelab/tasks.json')
        ? this.files['.codelab/tasks.json']
        : '';
      if (rawTasks && rawTasks.trim() && typeof mod.parseTasksConfig === 'function') {
        const parsedTasks = mod.parseTasksConfig(rawTasks, '.codelab/tasks.json');
        this._workspaceTasks = parsedTasks.tasks || [];
        if (this._diagnosticsStore && typeof this._diagnosticsStore.setFileDiagnostics === 'function') {
          this._diagnosticsStore.setFileDiagnostics(
            '.codelab/tasks.json',
            (parsedTasks.diagnostics || []).map((d) => ({
              file: '.codelab/tasks.json',
              line: d.line || 1,
              column: d.column || 1,
              severity: d.severity || 'warning',
              message: d.message,
              source: 'tasks'
            })),
            'tasks'
          );
        }
        if (isInitialMount) {
          for (const task of this._workspaceTasks) {
            if (task.runOn === 'folderOpen' && task.command) {
              Promise.resolve().then(() => this.runTask(task.id)).catch((err) => {
                this.logger.warn(`Auto-task "${task.label}" failed on folderOpen.`, err);
              });
            }
          }
        }
      } else {
        this._workspaceTasks = [];
        if (this._diagnosticsStore && typeof this._diagnosticsStore.setFileDiagnostics === 'function') {
          this._diagnosticsStore.setFileDiagnostics('.codelab/tasks.json', [], 'tasks');
        }
      }

      // 4. .codelab/extensions.json
      const rawExt = Object.prototype.hasOwnProperty.call(this.files, '.codelab/extensions.json')
        ? this.files['.codelab/extensions.json']
        : '';
      if (rawExt && rawExt.trim() && typeof mod.parseExtensionsConfig === 'function' && this.plugins) {
        const parsedExt = mod.parseExtensionsConfig(rawExt, '.codelab/extensions.json');
        const toActivate = [
          ...(parsedExt.config.autoActivate || []),
          ...(parsedExt.config.recommendations || [])
        ];
        for (const pluginId of toActivate) {
          this.plugins.activatePlugin(pluginId).catch((err) => { void err; });
        }
      }

      if (this.container && !this._isBooting) {
        const badgeEl = this.container.querySelector('#cl-problems-count');
        if (badgeEl && this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function') {
          const total = this._diagnosticsStore.getAll().length;
          badgeEl.textContent = String(total);
          badgeEl.style.display = total > 0 ? 'inline-block' : 'none';
        }
        if (this.drawerTab === 'problems') {
          this._renderDrawerBody();
        }
        this._updateStatusBar();
      }
    }

    _applyConfigurationChanges(changeEvent) {
      if (!this.configuration) return;
      const affects = (key) => !changeEvent || typeof changeEvent.affectsConfiguration !== 'function' || changeEvent.affectsConfiguration(key);

      const safeSetStyleVar = (el, name, val) => {
        if (!el || !el.style) return;
        if (typeof el.style.setProperty === 'function') {
          el.style.setProperty(name, val);
        } else {
          el.style[name] = val;
        }
      };

      if (affects('workbench.colorTheme') && changeEvent && !this._applyingConfigTheme) {
        const rawTheme = String(this.configuration.get('workbench.colorTheme', 'dark'));
        const mapped = (rawTheme === 'light' || rawTheme === 'codelab-light')
          ? 'light'
          : (rawTheme === 'high-contrast' || rawTheme === 'hc-dark' || rawTheme === 'codelab-hc-dark')
            ? 'high-contrast'
            : (rawTheme === 'auto' ? 'auto' : 'dark');
        this._applyingConfigTheme = true;
        try {
          this.setTheme(mapped);
        } finally {
          this._applyingConfigTheme = false;
        }
      }

      if (affects('workbench.sidebar.defaultLocation')) {
        const loc = String(this.configuration.get('workbench.sidebar.defaultLocation', 'left'));
        const shellEl = this.container ? this.container.querySelector('.codelab') : null;
        if (shellEl) {
          shellEl.classList.toggle('sidebar-right', loc === 'right');
        }
        if (this.editor && typeof this.editor.layout === 'function') {
          this.editor.layout();
        }
      }

      if (affects('workbench.sideBar.visible') && changeEvent) {
        const vis = this.configuration.get('workbench.sideBar.visible', true) !== false;
        this.setSidebarVisible(vis, { fromConfig: true });
      }

      if (affects('workbench.statusBar.visible')) {
        const sbVis = this.configuration.get('workbench.statusBar.visible', true) !== false;
        const shellEl = this.container ? this.container.querySelector('.codelab') : null;
        if (shellEl) {
          shellEl.classList.toggle('statusbar-hidden', !sbVis);
        }
        const sbEl = this.container ? this.container.querySelector('#cl-statusbar') : null;
        if (sbEl && sbEl.style) {
          sbEl.style.display = sbVis ? '' : 'none';
        }
        if (this.editor && typeof this.editor.layout === 'function') {
          this.editor.layout();
        }
      }

      if (affects('workbench.panel.defaultTab')) {
        const rawTab = String(this.configuration.get('workbench.panel.defaultTab', 'terminal') || 'terminal');
        const validTabs = new Set(['terminal', 'problems', 'output', 'ports', 'tests', 'stdin', 'preview', 'network', 'inspector', 'observability', 'sql-results']);
        const normTab = validTabs.has(rawTab) ? rawTab : 'terminal';
        if (changeEvent) {
          this.switchDrawerTab(normTab, { fromConfig: true, ensureVisible: this.panelVisible });
        } else if (!this._userSwitchedDrawerTab && !this._explicitDrawerTabOption && !this.savedState?.drawerTab && !this._isSingleFileSqlMode()) {
          const defTabInsp = typeof this.configuration.inspect === 'function'
            ? this.configuration.inspect('workbench.panel.defaultTab')
            : null;
          if (defTabInsp && defTabInsp.effectiveSource !== 'default') {
            this.switchDrawerTab(normTab, { fromConfig: true, ensureVisible: false });
          }
        }
      }

      if (affects('editor')) {
        const fontSize = Math.max(8, Math.min(36, Number(this.configuration.get('editor.fontSize', 13)) || 13));
        const fontFamily = String(this.configuration.get('editor.fontFamily', '') || '');
        const tabSize = Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2));
        const wordWrap = String(this.configuration.get('editor.wordWrap', 'off'));
        const lineNumbers = String(this.configuration.get('editor.lineNumbers', 'on'));
        const minimapEnabled = Boolean(this.configuration.get('editor.minimap.enabled', false));

        const shellEl = this.container ? this.container.querySelector('.codelab') : null;
        if (shellEl) {
          safeSetStyleVar(shellEl, '--cl-editor-font-size', `${fontSize}px`);
          if (fontFamily) {
            safeSetStyleVar(shellEl, '--cl-editor-font-family', fontFamily);
          }
        }
        if (typeof this._applyEditorSettingsToFallback === 'function') {
          this._applyEditorSettingsToFallback();
        }
        if (this.models && typeof this.models.values === 'function') {
          for (const model of this.models.values()) {
            if (model && typeof model.updateOptions === 'function') {
              try {
                model.updateOptions({ tabSize, insertSpaces: true });
              } catch (err) {
                void err;
              }
            }
          }
        }
        if (this.editor && typeof this.editor.updateOptions === 'function') {
          this.editor.updateOptions({
            fontSize,
            ...(fontFamily ? { fontFamily } : {}),
            tabSize,
            wordWrap,
            lineNumbers,
            minimap: { enabled: minimapEnabled }
          });
        }
        this._updateStatusBar();
      }

      if (affects('terminal.fontSize') || affects('terminal.scrollback')) {
        const termFontSize = Math.max(10, Math.min(28, Number(this.configuration.get('terminal.fontSize', 13)) || 13));
        const shellEl = this.container ? this.container.querySelector('.codelab') : null;
        if (shellEl) {
          safeSetStyleVar(shellEl, '--cl-terminal-font-size', `${termFontSize}px`);
        }
        const termSurface = this.container ? this.container.querySelector('#cl-terminal-surface') : null;
        if (termSurface && termSurface.style) {
          termSurface.style.fontSize = `${termFontSize}px`;
        }
        const termLog = this.container ? this.container.querySelector('#cl-terminal-log') : null;
        if (termLog && termLog.style) {
          termLog.style.fontSize = `${termFontSize}px`;
        }
        const replInput = this.container ? this.container.querySelector('#cl-repl-input') : null;
        if (replInput && replInput.style) {
          replInput.style.fontSize = `${termFontSize}px`;
        }
        const outSurface = this.container ? this.container.querySelector('#cl-output-surface') : null;
        if (outSurface && outSurface.style) {
          outSurface.style.fontSize = `${termFontSize}px`;
        }
        const trimmedLogs = this._trimTerminalLogs();
        if (trimmedLogs && (this.drawerTab === 'terminal' || this.drawerTab === 'output')) {
          this._renderDrawerBody();
        }
      }

      if (affects('files.autoSave') || affects('files.autoSaveDelay')) {
        const mode = String(this.configuration.get('files.autoSave', 'afterDelay'));
        if (mode === 'afterDelay' && this._dirtyFiles && this._dirtyFiles.size > 0) {
          this._scheduleSaveState();
        } else if (mode !== 'afterDelay' && this._autoSaveTimer) {
          clearTimeout(this._autoSaveTimer);
          this._autoSaveTimer = null;
        }
        this._updateStatusBar();
      }

      if (affects('files.exclude') && changeEvent) {
        this._renderFileLists();
        this._renderBreadcrumbs();
        if (this.activeSidebarView === 'search') {
          this._renderSearchSidebarResults();
        }
      }

      if ((affects('sql.defaultDialect') || affects('sql.dialect')) && changeEvent) {
        const cfgDialect = this._resolveConfiguredSqlDialect()
          || (this._explicitSqlDialectOption ? this.sqlDialect : 'postgres');
        if (cfgDialect === 'postgres' || cfgDialect === 'sqlite') {
          this.setSqlDialect(cfgDialect);
        }
      }
    }

    _persistWorkspaceSettingsFromUi(nextWsRecord) {
      if (this._syncingWorkspaceSettingsFile) return;
      this._syncingWorkspaceSettingsFile = true;
      try {
        const sourceRecord = nextWsRecord !== undefined
          ? nextWsRecord
          : (this.configuration && typeof this.configuration.getWorkspaceSettings === 'function'
            ? this.configuration.getWorkspaceSettings()
            : null);
        const cleanObj = {};
        if (sourceRecord && typeof sourceRecord === 'object') {
          for (const [k, v] of Object.entries(sourceRecord)) {
            if (v !== undefined) cleanObj[k] = v;
          }
        }
        this._userEditSeq = (this._userEditSeq || 0) + 1;
        const tabSize = this.configuration
          ? Math.max(1, Math.min(8, Number(this.configuration.get('editor.tabSize', 2)) || 2))
          : 2;
        const jsonStr = JSON.stringify(cleanObj, null, tabSize) + '\n';
        const hadFile = Object.prototype.hasOwnProperty.call(this.files, '.codelab/settings.json');
        if (Object.keys(cleanObj).length === 0 && !hadFile) {
          return;
        }
        this.folders.add('.codelab');
        this.files['.codelab/settings.json'] = jsonStr;
        const existingModel = this.models && this.models.get('.codelab/settings.json');
        if (existingModel && typeof existingModel.getValue === 'function' && existingModel.getValue() !== jsonStr) {
          this._syncingModelFromFiles = true;
          try {
            existingModel.setValue(jsonStr);
          } finally {
            this._syncingModelFromFiles = false;
          }
        }
        const fb = this.container ? this.container.querySelector('#cl-fallback-editor') : null;
        if (fb && this.activeFile === '.codelab/settings.json' && this.activeTab !== '__settings__') {
          fb.value = jsonStr;
          const hist = this._ensureFallbackHistoryEntry('.codelab/settings.json');
          hist.current = jsonStr;
          this._updateFallbackGutter();
        }
        if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFileSync === 'function') {
          try {
            if (typeof this.shell.vfs.mkdirSync === 'function') {
              this.shell.vfs.mkdirSync('/workspace/.codelab', { recursive: true });
            }
            this.shell.vfs.writeFileSync('/workspace/.codelab/settings.json', jsonStr);
          } catch (err) {
            void err;
          }
        }
        if (this.kernel && this.kernel.fs && typeof this.kernel.fs.writeFile === 'function') {
          try {
            Promise.resolve(this.kernel.fs.writeFile('/workspace/.codelab/settings.json', jsonStr)).catch((err) => {
              void err;
            });
          } catch (err) {
            void err;
          }
        }
        this._clearFileDirty('.codelab/settings.json');
        this._saveState();
        this._renderFileLists();
      } finally {
        this._syncingWorkspaceSettingsFile = false;
      }
    }

    _mountSettingsInline(settingsHost) {
      if (!settingsHost) return;
      const mod = getModular();
      if (!mod || typeof mod.SettingsDialogController !== 'function' || !this.configuration) {
        return;
      }
      if (!this._settingsDialog) {
        this._settingsDialog = new mod.SettingsDialogController({
          configuration: this.configuration,
          onOpenSettingsJson: () => this.openWorkspaceSettingsJson(),
          onWorkspaceSettingsMutated: (wsRecord) => this._persistWorkspaceSettingsFromUi(wsRecord),
          onExportSettings: (jsonStr) => {
            if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              navigator.clipboard.writeText(jsonStr).catch((err) => {
                void err;
              });
            }
            this._showToast('Settings profile copied to clipboard', 'success');
          }
        });
      }
      if (typeof this._settingsDialog.mountInline === 'function') {
        const existingRoot = settingsHost.querySelector('[data-role="settings-inline-root"], .cl-settings-inline');
        if (!this._settingsDialog.isInlineMounted || !existingRoot) {
          this._settingsDialog.mountInline(settingsHost);
          const listEl = settingsHost.querySelector('[data-role="settings-list"]');
          if (listEl && !listEl._clScrollBound) {
            listEl._clScrollBound = true;
            listEl.addEventListener('scroll', () => {
              if (this.activeTab === '__settings__' && (!settingsHost.style || settingsHost.style.display !== 'none')) {
                this._savedSettingsScrollTop = listEl.scrollTop;
              }
            }, { passive: true });
          }
        }
      }
    }

    openSettings(opts = {}) {
      const mod = getModular();
      if (!mod || typeof mod.SettingsDialogController !== 'function' || !this.configuration) {
        return this.openWorkspaceSettingsJson();
      }
      this._activeScmDiffFile = null;
      this.settingsTabOpen = true;
      this.activeTab = '__settings__';
      this._syncActiveFileToView();
      const settingsHost = this.container ? this.container.querySelector('#cl-settings-host') : null;
      if (settingsHost) {
        const searchInput = settingsHost.querySelector('[data-role="settings-search"]');
        if (searchInput) {
          if (opts && typeof opts.query === 'string') {
            searchInput.value = opts.query;
            if (typeof Event === 'function') {
              try {
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              } catch (err) {
                void err;
              }
            }
          }
          if (!opts || opts.focusSearch !== false) {
            if (typeof searchInput.focus === 'function') {
              try {
                searchInput.focus({ preventScroll: true });
              } catch (_err) {
                void _err;
                searchInput.focus();
              }
            }
          }
        }
      }
    }

    closeSettings() {
      if (!this.settingsTabOpen && this.activeTab !== '__settings__') return;
      this.settingsTabOpen = false;
      this._savedSettingsScrollTop = 0;
      if (this._settingsDialog && typeof this._settingsDialog.unmountInline === 'function') {
        this._settingsDialog.unmountInline();
      }
      const nextFile = (this.activeFile && Array.isArray(this.openTabs) && this.openTabs.includes(this.activeFile))
        ? this.activeFile
        : (Array.isArray(this.openTabs) && this.openTabs.length > 0 ? this.openTabs[0] : null);
      this.activeFile = nextFile;
      this.activeTab = nextFile;
      this._syncActiveFileToView();
      if (this.editor && typeof this.editor.focus === 'function') {
        try {
          this.editor.focus();
        } catch (err) {
          void err;
        }
      } else if (this.container) {
        const fb = this.container.querySelector('#cl-fallback-editor');
        const activeTabEl = this.container.querySelector('#cl-tabs .codelab-tab.active, #cl-file-tabs .codelab-tab.active');
        const focusTarget = (fb && (!fb.style || fb.style.display !== 'none')) ? fb : activeTabEl;
        if (focusTarget && typeof focusTarget.focus === 'function') {
          focusTarget.focus();
        }
      }
    }

    openWorkspaceSettingsJson() {
      if (!Object.prototype.hasOwnProperty.call(this.files, '.codelab/settings.json')) {
        const defaultContent = this.configuration && typeof this.configuration.toWorkspaceJsonString === 'function'
          ? this.configuration.toWorkspaceJsonString()
          : '{\n}\n';
        this.setFile('.codelab/settings.json', defaultContent, { open: true });
      } else {
        this.openFile('.codelab/settings.json');
      }
    }

    async runTask(idOrLabel) {
      const tasks = Array.isArray(this._workspaceTasks) ? this._workspaceTasks : [];
      const found = tasks.find((t) => t.id === idOrLabel || t.label === idOrLabel);
      const commandStr = found ? found.command : (typeof idOrLabel === 'string' ? idOrLabel : '');
      if (!commandStr) return null;
      this.switchDrawerTab('terminal');
      return this._handleReplCommand(commandStr);
    }

    registerPlugin(manifest) {
      if (!manifest || !this.plugins || typeof this.plugins.registerPlugin !== 'function') {
        return { dispose() {} };
      }
      const disp = this.plugins.registerPlugin(manifest);
      const events = Array.isArray(manifest.activationEvents) ? manifest.activationEvents : ['*'];
      if (events.includes(`onLanguage:${this.lang}`)) {
        this.plugins.activatePlugin(manifest.id).catch((err) => {
          void err;
        });
      }
      this._refreshDrawerTabs();
      if (typeof this._refreshSidebarPluginContributions === 'function') {
        this._refreshSidebarPluginContributions();
      }
      return {
        dispose: () => {
          disp.dispose();
          this._refreshDrawerTabs();
          if (typeof this._refreshSidebarPluginContributions === 'function') {
            this._refreshSidebarPluginContributions();
          }
        }
      };
    }

    _resolveShellPath(rawPath) {
      if (!rawPath || rawPath === '.') return this.cwd || '/workspace';
      if (rawPath === '~') return '/workspace';
      let p = rawPath.startsWith('/') ? rawPath : `${this.cwd || '/workspace'}/${rawPath}`;
      const parts = p.split('/');
      const stack = [];
      for (const part of parts) {
        if (!part || part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
      }
      return '/' + stack.join('/');
    }

    _toWorkspaceRelPath(absOrRel) {
      const abs = this._resolveShellPath(absOrRel);
      if (abs === '/workspace') return '';
      if (abs.startsWith('/workspace/')) return abs.slice('/workspace/'.length);
      return abs.replace(/^\/+/, '');
    }

    async _handleReplCommand(cmd) {
      if (this.isRunning) return;
      const trimmed = (cmd || '').trim();
      if (!trimmed) return;
      if (this.replHistory[this.replHistory.length - 1] !== trimmed) {
        this.replHistory.push(trimmed);
      }
      this.replHistoryIdx = -1;
      const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
      const promptPrefix = this.inRepl ? '> ' : `codelab:${cwdShort}$ `;
      const echoLine = `${promptPrefix}${trimmed}`;
      this._pushTerminalLog({ type: 'system', text: echoLine });
      const maxSbEcho = this._getTerminalScrollback();
      if (this.terminalLogs.length > maxSbEcho) {
        this.terminalLogs.splice(0, this.terminalLogs.length - maxSbEcho);
      }
      const termLogEl = this.container ? this.container.querySelector('#cl-terminal-log') : null;
      const ptyOwnsDom = Boolean(this.ptyEngine && this.ptyEngine.container);
      if (termLogEl && typeof document !== 'undefined' && !ptyOwnsDom) {
        const echoEl = document.createElement('div');
        echoEl.className = 'codelab-log-line system';
        echoEl.innerHTML = ansiToHtml ? ansiToHtml(echoLine) : escapeHtml(echoLine);
        termLogEl.appendChild(echoEl);
      }

      if (this.inRepl) {
        if (trimmed === '.exit' || trimmed === 'exit') {
          this.inRepl = false;
          this._pushTerminalLog({ type: 'stdout', text: 'Exited Node.js REPL.' });
          this._renderDrawerBody();
          return;
        }
        if (trimmed === '.clear' || trimmed === 'clear') {
          this._clearTerminalLogs();
          this._renderDrawerBody();
          return;
        }
        if (trimmed === '.help') {
          this._pushTerminalLog({
            type: 'stdout',
            text: '.clear    Clear terminal output\n.exit     Exit the Node.js REPL\n.help     Print this help message'
          });
          this._renderDrawerBody();
          return;
        }
        const abortCtrl = new AbortController();
        this._activeCommandAbortController = abortCtrl;
        this.isRunning = true;
        this._updateRunStateUI();
        let streamedStdout = false;
        let streamedStderr = false;
        try {
          const res = await this._executeRuntime({
            files: { ...this.files },
            mode: 'repl',
            replCode: trimmed,
            signal: abortCtrl.signal,
            onStdout: (c) => { streamedStdout = true; this._appendTerminalStream('stdout', c); },
            onStderr: (c) => { streamedStderr = true; this._appendTerminalStream('stderr', c); }
          });
          this._flushTerminalStream();
          const aborted = this._isAbortResult(res, abortCtrl.signal);
          const cleanStdout = res.stdout ? res.stdout.replace(/\n$/, '') : '';
          if (!aborted && !streamedStdout && cleanStdout) this._pushTerminalLog({ type: 'stdout', text: cleanStdout });
          if (!aborted && !streamedStderr && res.stderr) this._pushTerminalLog({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
          if (!aborted && res.replValue !== undefined && cleanStdout !== String(res.replValue)) {
            this._pushTerminalLog({ type: 'success', text: `→ ${res.replValue}` });
          }
          if (!aborted && res.error) this._pushTerminalLog({ type: 'stderr', text: formatErrorText(res.error) });
        } catch (err) {
          this._flushTerminalStream();
          if (!(abortCtrl.signal.aborted || (err && err.name === 'AbortError'))) {
            this._pushTerminalLog({ type: 'stderr', text: formatErrorText(err) });
          }
        } finally {
          if (this._activeCommandAbortController === abortCtrl) {
            this._activeCommandAbortController = null;
          }
          this.isRunning = false;
          this._updateRunStateUI();
        }
        this._renderDrawerBody();
        return;
      }

      if (trimmed === 'clear' || trimmed === 'cls') {
        this._clearTerminalLogs();
        this._renderDrawerBody();
        return;
      }
      if (trimmed === 'node' || trimmed === 'node -i' || trimmed === 'node --interactive') {
        this.inRepl = true;
        this._pushTerminalLog({ type: 'stdout', text: 'Welcome to Node.js v22.0.0.\nType ".help" for more information, or ".exit" to return to POSIX shell.' });
        this._renderDrawerBody();
        return;
      }
      if (trimmed === 'run' || trimmed === 'npm start' || trimmed === 'npm run demo') {
        await this.runDemo();
        return;
      }
      if (trimmed === 'test' || trimmed === 'npm test' || trimmed === 'npm t') {
        await this.runTests();
        return;
      }

      const firstWord = (trimmed.split(/\s+/)[0] || '').replace(/^.*\//, '');
      const shellKnowsCommand = Boolean(
        firstWord &&
        this.shell &&
        typeof this.shell.hasCommand === 'function' &&
        this.shell.hasCommand(firstWord)
      );
      const looksLikeJsExpr = !shellKnowsCommand && (
        /^(const|let|var|function|class|await|return|typeof|instanceof|new\s+|Math\.|JSON\.|Object\.|Array\.|Promise\.|console\.|process\.|Buffer\.|require\s*\(|import\s*\(|[0-9]+\s*[\+\-\*\/\%]|['"`\[{])/.test(trimmed)
        || /^[a-zA-Z_$][\w$]*\s*(\.|===|!==|==|!=|<=|>=|\+=|-=|\*=|\(|\+\+|--)/.test(trimmed)
      );

      if (this.shell && typeof this.shell.execute === 'function' && !looksLikeJsExpr) {
        const abortCtrl = new AbortController();
        this._activeCommandAbortController = abortCtrl;
        this.isRunning = true;
        this._updateRunStateUI();
        let streamedStdout = false;
        let streamedStderr = false;
        const logsCountBefore = this.terminalLogs.length;

        try {
          this._syncFilesToShellVfs();
          this.shell.cwd = this.cwd || '/workspace';
          const shellRes = await this.shell.execute(trimmed, {
            onStdout: (c) => {
              streamedStdout = true;
              this._appendTerminalStream('stdout', c);
            },
            onStderr: (c) => {
              streamedStderr = true;
              this._appendTerminalStream('stderr', c);
            },
            signal: abortCtrl.signal
          });
          this._flushTerminalStream();
          const aborted = this._isAbortResult(shellRes, abortCtrl.signal);
          this.cwd = this.shell.cwd || this.cwd;
          this._syncVfsSnapshot(null, true);
          if (/^\s*git\b/.test(trimmed) || (this.shell && this.shell.gitState && this.shell.gitState.initialized)) {
            this._saveState();
          }
          if (this.activeSidebarView === 'scm' && typeof this._renderScmSidebar === 'function') {
            this._renderScmSidebar();
          }
          this._updateStatusBar();

          if (shellRes && shellRes.clear) {
            this._clearTerminalLogs();
            this._renderDrawerBody();
            return;
          }
          if (shellRes && shellRes.interactiveRepl) {
            this.inRepl = true;
            if (shellRes.stdout && !streamedStdout) {
              this._pushTerminalLog({ type: 'stdout', text: shellRes.stdout.replace(/\n$/, '') });
            }
            this._renderDrawerBody();
            return;
          }

          if (!aborted && shellRes && shellRes.stdout && !streamedStdout) {
            this._pushTerminalLog({ type: 'stdout', text: shellRes.stdout.replace(/\n$/, '') });
          }
          if (!aborted && shellRes && shellRes.stderr && !streamedStderr) {
            this._pushTerminalLog({ type: 'stderr', text: shellRes.stderr.replace(/\n$/, '') });
          }
          this._renderDrawerBody();
          return;
        } catch (err) {
          this._flushTerminalStream();
          if (!(abortCtrl.signal.aborted || (err && err.name === 'AbortError'))) {
            this._pushTerminalLog({ type: 'stderr', text: formatErrorText(err) });
          }
          this._renderDrawerBody();
          return;
        } finally {
          if (this._activeCommandAbortController === abortCtrl) {
            this._activeCommandAbortController = null;
          }
          this.isRunning = false;
          this._updateRunStateUI();
        }
      }

      // Fallback: Evaluate arbitrary JS/TS expression in the Virtual Runtime
      const fallbackAbortCtrl = new AbortController();
      this._activeCommandAbortController = fallbackAbortCtrl;
      this.isRunning = true;
      this._updateRunStateUI();
      let streamedFallbackStdout = false;
      let streamedFallbackStderr = false;

      try {
        const res = await this._executeRuntime({
          files: { ...this.files },
          mode: 'repl',
          replCode: trimmed,
          signal: fallbackAbortCtrl.signal,
          onStdout: (c) => {
            streamedFallbackStdout = true;
            this._appendTerminalStream('stdout', c);
          },
          onStderr: (c) => {
            streamedFallbackStderr = true;
            this._appendTerminalStream('stderr', c);
          }
        });
        this._flushTerminalStream();
        const aborted = this._isAbortResult(res, fallbackAbortCtrl.signal);
        const cleanStdout = res.stdout ? res.stdout.replace(/\n$/, '') : '';
        if (!aborted && !streamedFallbackStdout && cleanStdout) {
          this._pushTerminalLog({ type: 'stdout', text: cleanStdout });
        }
        if (!aborted && !streamedFallbackStderr && res.stderr) {
          this._pushTerminalLog({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (!aborted && res.replValue !== undefined && cleanStdout !== String(res.replValue)) {
          this._pushTerminalLog({ type: 'success', text: `→ ${res.replValue}` });
        }
        if (!aborted && res.error) {
          const errStr = formatErrorText(res.error);
          if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && errStr.includes(`ReferenceError: ${trimmed} is not defined`)) {
            this._pushTerminalLog({ type: 'stderr', text: `codelab: ${trimmed}: command not found (type "help" for commands or enter a JS/TS expression)` });
          } else {
            this._pushTerminalLog({ type: 'stderr', text: errStr });
          }
        }
      } catch (err) {
        this._flushTerminalStream();
        if (!(fallbackAbortCtrl.signal.aborted || (err && err.name === 'AbortError'))) {
          this._pushTerminalLog({ type: 'stderr', text: formatErrorText(err) });
        }
      } finally {
        if (this._activeCommandAbortController === fallbackAbortCtrl) {
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        this._updateRunStateUI();
      }
      this._renderDrawerBody();
    }

    // ── Workspace Export / Import & Imperative Third-Party SDK APIs ────────
    downloadFile(filename) {
      if (!filename || this.files[filename] === undefined) return false;
      const content = this.files[filename];
      try {
        if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined') {
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename.split('/').pop() || filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 500);
        }
      } catch (err) {
        this.logger.error(
          `Failed to start download for "${filename}".`,
          err && err.message ? err.message : err
        );
      }
      return content;
    }

    exportWorkspace(options = {}) {
      const snapshot = {
        labId: this.labId,
        title: this.title,
        mode: this.mode,
        language: this.lang,
        activeFile: this.activeFile,
        openTabs: Array.isArray(this.openTabs) ? [...this.openTabs] : [],
        folders: Array.from(this.folders),
        files: { ...this.files },
        completedSteps: Array.from(this.completedSteps),
        exportedAt: new Date().toISOString()
      };
      if (options && options.download) {
        try {
          if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined') {
            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.labId || 'workspace'}.codelab.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 500);
          }
        } catch (err) {
          this.logger.error(
            'Failed to download workspace export.',
            err && err.message ? err.message : err
          );
        }
      }
      return snapshot;
    }

    importWorkspace(snapshotOrJson) {
      const data = typeof snapshotOrJson === 'string' ? JSON.parse(snapshotOrJson) : snapshotOrJson;
      if (!data || typeof data !== 'object') return false;
      if (data.mode === 'guided' || data.mode === 'sandbox') {
        this.mode = data.mode;
      }
      if (data.language === 'js' || data.language === 'ts' || data.language === 'cpp' || data.language === 'py' || data.language === 'sql') {
        this.lang = data.language;
      }
      if (data.files && typeof data.files === 'object') {
        this.setFiles(data.files);
      }
      if (Array.isArray(data.folders)) {
        for (const f of data.folders) {
          if (f) this.folders.add(f);
        }
      }
      if (Array.isArray(data.openTabs)) {
        this.openTabs = data.openTabs.filter(f => this.files[f] !== undefined);
      }
      if (data.activeFile && this.files[data.activeFile] !== undefined) {
        this.activeFile = data.activeFile;
      }
      this._saveState();
      this._syncAllModels();
      this._syncActiveFileToView();
      return true;
    }

    exportProjectZip(options = {}) {
      const zipMod = root.CodeLabZip;
      if (!zipMod || typeof zipMod.createZip !== 'function') {
        throw new Error('CodeLabZip engine is not loaded');
      }
      const bytes = zipMod.createZip(this.files || {});
      if (options && options.download) {
        try {
          if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined') {
            const blob = new Blob([bytes], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.labId || 'workspace'}.zip`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 500);
          }
        } catch (err) {
          this.logger.error('Failed to download project ZIP export.', err);
        }
      }
      return bytes;
    }

    exportZip(options = {}) {
      return this.exportProjectZip(options);
    }

    importProjectZip(zipBytes, options = {}) {
      const zipMod = root.CodeLabZip;
      if (!zipMod || typeof zipMod.extractZip !== 'function') {
        throw new Error('CodeLabZip engine is not loaded');
      }
      const extracted = zipMod.extractZip(zipBytes);
      if (!extracted || typeof extracted !== 'object') return false;
      this.setFiles(extracted, options);
      this._syncFilesToShellVfs();
      return true;
    }

    importZip(zipBytes, options = {}) {
      const zipMod = root.CodeLabZip;
      if (!zipMod || typeof zipMod.extractZip !== 'function') {
        throw new Error('CodeLabZip engine is not loaded');
      }
      const extracted = zipMod.extractZip(zipBytes);
      if (!extracted || typeof extracted !== 'object') return 0;
      this.setFiles(extracted, options);
      this._syncFilesToShellVfs();
      return Object.keys(extracted).length;
    }

    async saveProjectToStorage(id) {
      if (!root.CodeLabStorage || typeof root.CodeLabStorage.createWorkspaceStorage !== 'function') {
        return false;
      }
      if (!this._idbStorage) {
        this._idbStorage = root.CodeLabStorage.createWorkspaceStorage();
      }
      const projectId = id || this.labId || 'workspace';
      return this._idbStorage.saveProject({
        id: projectId,
        name: this.title || projectId,
        files: { ...(this.files || {}) },
        updatedAt: Date.now()
      });
    }

    async loadProjectFromStorage(id) {
      if (!root.CodeLabStorage || typeof root.CodeLabStorage.createWorkspaceStorage !== 'function') {
        return null;
      }
      if (!this._idbStorage) {
        this._idbStorage = root.CodeLabStorage.createWorkspaceStorage();
      }
      const projectId = id || this.labId || 'workspace';
      const loaded = await this._idbStorage.loadProject(projectId);
      if (loaded && loaded.files && typeof loaded.files === 'object') {
        this.setFiles(loaded.files);
        this._syncFilesToShellVfs();
      }
      return loaded;
    }

    searchWorkspace(options) {
      const searchMod = root.CodeLabSearch;
      if (!searchMod || typeof searchMod.searchInFiles !== 'function') {
        throw new Error('CodeLabSearch engine is not loaded');
      }
      const cfgExclude = typeof this._getExcludePatterns === 'function' ? this._getExcludePatterns() : [];
      const optObj = options && typeof options === 'object' ? { ...options } : { query: String(options || '') };
      if (cfgExclude.length > 0) {
        const existingEx = optObj.exclude
          ? (Array.isArray(optObj.exclude) ? optObj.exclude : String(optObj.exclude).split(',').map(s => s.trim()).filter(Boolean))
          : [];
        optObj.exclude = Array.from(new Set([...existingEx, ...cfgExclude]));
      }
      return searchMod.searchInFiles(this.files || {}, optObj);
    }

    _applyInPlaceWorkspaceUpdates(nextFiles, affectedList) {
      if (!nextFiles || typeof nextFiles !== 'object') return;
      const changed = Array.isArray(affectedList) && affectedList.length > 0
        ? affectedList
        : Object.keys(nextFiles).filter((k) => nextFiles[k] !== this.files[k]);
      if (changed.length === 0) return;

      for (const relPath of changed) {
        if (!Object.prototype.hasOwnProperty.call(nextFiles, relPath)) continue;
        const content = String(nextFiles[relPath] ?? '');
        this.files[relPath] = content;
        if (typeof this._markFileDirty === 'function') {
          this._markFileDirty(relPath);
        }
        if (this.models && typeof this.models.has === 'function' && this.models.has(relPath)) {
          const m = this.models.get(relPath);
          if (m && typeof m.getValue === 'function' && m.getValue() !== content) {
            this._syncingModelFromFiles = true;
            try {
              m.setValue(content);
            } finally {
              this._syncingModelFromFiles = false;
            }
          }
        }
        if (relPath === this.activeFile && this.container && !this.editor) {
          const fb = this.container.querySelector('#cl-fallback-editor');
          if (fb && fb.value !== content) {
            fb.value = content;
            if (typeof this._updateFallbackGutter === 'function') {
              this._updateFallbackGutter();
            }
          }
          const sqlTa = this.container.querySelector('#cl-sql-editor-host .cl-sql-textarea');
          if (sqlTa && sqlTa.value !== content) {
            sqlTa.value = content;
          }
        }
        const cleanRel = String(relPath).replace(/^\/+/, '');
        const absPath = `/workspace/${cleanRel}`;
        if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFileSync === 'function') {
          try {
            const slash = absPath.lastIndexOf('/');
            if (slash > 0 && typeof this.shell.vfs.mkdirSync === 'function') {
              this.shell.vfs.mkdirSync(absPath.slice(0, slash), { recursive: true });
            }
            this.shell.vfs.writeFileSync(absPath, content);
          } catch (_err) {
            void _err;
          }
        }
        if (this.kernel && this.kernel.fs && typeof this.kernel.fs.writeFileSync === 'function') {
          try {
            this.kernel.fs.writeFileSync(absPath, content);
          } catch (_err) {
            void _err;
          }
        }
        if (cleanRel === '.codelab/settings.json' || cleanRel === '.codelab/tasks.json') {
          this._syncDotCodelabConfig({ isInitialMount: false });
        } else {
          this._lintFile(cleanRel);
        }
      }
      this._renderFileLists();
      if (this.activeSidebarView === 'scm') {
        this._renderScmSidebar();
      }
      if (this._activeScmDiffFile && changed.includes(this._activeScmDiffFile)) {
        this._syncActiveFileToView();
      }
      this._updateStatusBar();
      this._saveState();
    }

    replaceInWorkspace(options) {
      const searchMod = root.CodeLabSearch;
      if (!searchMod || typeof searchMod.replaceInFiles !== 'function') {
        throw new Error('CodeLabSearch engine is not loaded');
      }
      const cfgExclude = typeof this._getExcludePatterns === 'function' ? this._getExcludePatterns() : [];
      const optObj = options && typeof options === 'object' ? { ...options } : { query: '' };
      if (cfgExclude.length > 0) {
        const existingEx = optObj.exclude
          ? (Array.isArray(optObj.exclude) ? optObj.exclude : String(optObj.exclude).split(',').map(s => s.trim()).filter(Boolean))
          : [];
        optObj.exclude = Array.from(new Set([...existingEx, ...cfgExclude]));
      }
      const res = searchMod.replaceInFiles(this.files || {}, optObj, optObj.replacement);
      const nextFiles = res && (res.updatedFiles || res.files);
      const modifiedCount = res && (typeof res.filesModified === 'number' ? res.filesModified : (Array.isArray(res.filesAffected) ? res.filesAffected.length : 0));
      if (nextFiles && modifiedCount > 0) {
        this._applyInPlaceWorkspaceUpdates(nextFiles, res.filesAffected);
      }
      return res;
    }

    _getGitState() {
      const scmMod = root.CodeLabScm;
      if (this.shell && this.shell.gitState) {
        return this.shell.gitState;
      }
      if (!this._gitState && scmMod && typeof scmMod.createGitState === 'function') {
        this._gitState = scmMod.createGitState(this.files || {});
      }
      return this._gitState || null;
    }

    getGitStatus() {
      const scmMod = root.CodeLabScm;
      if (!scmMod || typeof scmMod.computeGitStatus !== 'function') {
        return [];
      }
      const gs = this._getGitState() || scmMod.createGitState(this.files || {});
      const res = scmMod.computeGitStatus(this.files || {}, '/workspace', gs);
      return res && Array.isArray(res.entries) ? res.entries : (Array.isArray(res) ? res : []);
    }

    stageGitFile(relPath) {
      if (!relPath) return false;
      const gs = this._getGitState();
      if (!gs) return false;
      const scmMod = root.CodeLabScm;
      if (scmMod && typeof scmMod.stageFile === 'function' && (gs.stagedFiles instanceof Map || gs.staged instanceof Map || (this.shell && this.shell.gitState === gs))) {
        const currentContent = Object.prototype.hasOwnProperty.call(this.files, relPath) ? this.files[relPath] : null;
        scmMod.stageFile(gs, relPath, currentContent);
        this._saveState();
        return true;
      }
      if (gs.staged instanceof Set) {
        gs.staged.add(relPath);
      } else if (scmMod && typeof scmMod.stageFile === 'function') {
        const currentContent = Object.prototype.hasOwnProperty.call(this.files, relPath) ? this.files[relPath] : null;
        scmMod.stageFile(gs, relPath, currentContent);
      }
      this._saveState();
      return true;
    }

    unstageGitFile(relPath) {
      if (!relPath) return false;
      const gs = this._getGitState();
      if (!gs) return false;
      const scmMod = root.CodeLabScm;
      if (scmMod && typeof scmMod.unstageFile === 'function') {
        scmMod.unstageFile(gs, relPath);
      }
      if (gs.staged && typeof gs.staged.delete === 'function') {
        gs.staged.delete(relPath);
      }
      this._saveState();
      return true;
    }

    stageAllGitFiles() {
      const entries = this.getGitStatus();
      for (const entry of entries) {
        if (!entry.staged) {
          this.stageGitFile(entry.path);
        }
      }
      this._saveState();
      return true;
    }

    unstageAllGitFiles() {
      const gs = this._getGitState();
      if (!gs) return false;
      const scmMod = root.CodeLabScm;
      if (scmMod && typeof scmMod.unstageAll === 'function') {
        scmMod.unstageAll(gs);
      }
      if (gs.staged && typeof gs.staged.clear === 'function') {
        gs.staged.clear();
      }
      this._saveState();
      return true;
    }

    discardGitFile(relPath) {
      if (!relPath) return false;
      const cleanRel = String(relPath).replace(/^\/+/, '');
      const gs = this._getGitState();
      const scmMod = root.CodeLabScm;
      let ok = false;
      if (scmMod && typeof scmMod.discardChanges === 'function') {
        ok = scmMod.discardChanges(this.shell || { gitState: gs, cwd: '/workspace' }, cleanRel, this.files);
      } else if (gs) {
        const headMap = gs.headFiles || gs.headSnapshot || {};
        if (Object.prototype.hasOwnProperty.call(headMap, cleanRel)) {
          this.files[cleanRel] = headMap[cleanRel];
          ok = true;
        } else if (Object.prototype.hasOwnProperty.call(this.files, cleanRel)) {
          delete this.files[cleanRel];
          ok = true;
        }
        this.unstageGitFile(cleanRel);
      }
      if (ok) {
        if (!Object.prototype.hasOwnProperty.call(this.files, cleanRel)) {
          if (Array.isArray(this.openTabs)) {
            this.openTabs = this.openTabs.filter(t => t !== cleanRel);
          }
          if (this._dirtyFiles) this._dirtyFiles.delete(cleanRel);
          if (this._savedSnapshot) delete this._savedSnapshot[cleanRel];
          if (this.models && this.models.has(cleanRel)) {
            const m = this.models.get(cleanRel);
            if (m && typeof m.dispose === 'function') {
              try { m.dispose(); } catch (_err) { void _err; }
            }
            this.models.delete(cleanRel);
          }
          this._vfsDeleteFile(cleanRel);
          if (this.activeFile === cleanRel) {
            this.activeFile = (this.openTabs && this.openTabs[0]) || null;
            if (this.activeTab === cleanRel) this.activeTab = this.activeFile;
          }
        } else {
          const restored = String(this.files[cleanRel] ?? '');
          if (this._dirtyFiles) this._dirtyFiles.delete(cleanRel);
          if (this._savedSnapshot) this._savedSnapshot[cleanRel] = restored;
          if (this.kernel && this.kernel.fs && typeof this.kernel.fs.writeFileSync === 'function') {
            try {
              this.kernel.fs.writeFileSync(`/workspace/${cleanRel}`, restored);
            } catch (_err) {
              void _err;
            }
          }
          if (cleanRel === '.codelab/settings.json' || cleanRel === '.codelab/tasks.json') {
            this._syncDotCodelabConfig({ isInitialMount: false });
          } else {
            this._lintFile(cleanRel);
          }
        }
        if (this._dirtyFiles && this._dirtyFiles.size === 0) {
          this.saveStatusState = 'saved';
        }
        if (this._activeScmDiffFile === cleanRel) {
          this._activeScmDiffFile = null;
        }
        this._syncFilesToShellVfs({ pruneExtraneous: true, keepGitDir: true });
        this._syncAllModels();
        if (this.activeFile === cleanRel && this.container && !this.editor && Object.prototype.hasOwnProperty.call(this.files, cleanRel)) {
          const fb = this.container.querySelector('#cl-fallback-editor');
          if (fb) fb.value = this.files[cleanRel];
          const sqlTa = this.container.querySelector('#cl-sql-editor-host .cl-sql-textarea');
          if (sqlTa) sqlTa.value = this.files[cleanRel];
        }
        this._saveState();
        this._syncActiveFileToView();
        if (this.activeSidebarView === 'scm') {
          this._renderScmSidebar();
        }
        this._updateStatusBar();
      }
      return ok;
    }

    _confirmDiscardGitFile(relPath, triggerEl) {
      if (!relPath || !this.container) return;
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) {
        this.discardGitFile(relPath);
        return;
      }
      this._captureModalReturnFocus();
      if (triggerEl && typeof triggerEl.focus === 'function') {
        this._modalReturnFocusEl = triggerEl;
      }
      const cleanRel = String(relPath).replace(/^\/+/, '');
      const gs = this._getGitState();
      const headMap = (gs && (gs.headFiles || gs.headSnapshot)) || {};
      const isUntracked = !Object.prototype.hasOwnProperty.call(headMap, cleanRel);
      const desc = isUntracked
        ? `Are you sure you want to delete untracked file "${cleanRel}"? This action cannot be undone.`
        : `Are you sure you want to discard all working-tree changes in "${cleanRel}" and restore HEAD?`;

      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-labelledby="cl-discard-modal-title" aria-describedby="cl-discard-modal-desc" style="max-width:420px;">
            <div class="codelab-modal__header">
              <span id="cl-discard-modal-title">Discard Changes</span>
              <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="close-modal" title="Close" aria-label="Close">&times;</button>
            </div>
            <div class="codelab-modal__body">
              <p id="cl-discard-modal-desc" style="margin:0 0 14px;font-size:13px;line-height:1.5;">${escapeHtml(desc)}</p>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button type="button" class="codelab-btn" id="cl-discard-cancel-btn" data-cl-action="close-modal">Cancel</button>
                <button type="button" class="codelab-btn codelab-btn--danger" id="cl-discard-confirm-btn">Discard Changes</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const cancelBtn = slot.querySelector('#cl-discard-cancel-btn');
      const confirmBtn = slot.querySelector('#cl-discard-confirm-btn');
      if (cancelBtn && typeof cancelBtn.focus === 'function') {
        cancelBtn.focus();
      }
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          this.discardGitFile(cleanRel);
          this.closeModal();
          const scmRoot = this.container ? this.container.querySelector('#cl-sidebar-scm #cl-scm-commit-input, #cl-sidebar-scm') : null;
          if (scmRoot && typeof scmRoot.focus === 'function') {
            scmRoot.focus();
          }
        });
      }
    }

    commitGitChanges(message) {
      const msg = typeof message === 'string' ? message.trim() : '';
      if (!msg) return null;
      const gs = this._getGitState();
      if (!gs) return null;
      const scmMod = root.CodeLabScm;
      let committedHash = null;
      if (scmMod && typeof scmMod.commitChanges === 'function' && (gs.stagedFiles instanceof Map || gs.staged instanceof Map || (this.shell && this.shell.gitState === gs))) {
        try {
          committedHash = scmMod.commitChanges(gs, msg);
          this._syncGitHeadState(gs);
        } catch (err) {
          void err;
          return null;
        }
      } else if (gs.staged instanceof Set) {
        if (gs.staged.size === 0) return null;
        const nextHead = { ...(gs.headSnapshot || gs.headFiles || {}) };
        for (const relPath of gs.staged) {
          if (Object.prototype.hasOwnProperty.call(this.files, relPath)) {
            nextHead[relPath] = this.files[relPath];
          } else {
            delete nextHead[relPath];
          }
        }
        const synced = this._syncGitHeadState(gs, nextHead);
        const hash = scmMod && typeof scmMod.computeShortCommitHash === 'function'
          ? scmMod.computeShortCommitHash(`${gs.branch || 'main'}:${msg}:${Date.now()}`)
          : Math.random().toString(16).slice(2, 9);
        if (!Array.isArray(gs.commits)) gs.commits = [];
        gs.commits.unshift({
          hash,
          author: 'CodeLab Developer <dev@codelab.internal>',
          date: new Date().toUTCString(),
          timestamp: Date.now(),
          message: msg,
          files: { ...synced }
        });
        gs.headCommit = hash;
        gs.staged.clear();
        committedHash = hash;
      } else if (scmMod && typeof scmMod.commitChanges === 'function') {
        try {
          committedHash = scmMod.commitChanges(gs, msg);
          this._syncGitHeadState(gs);
        } catch (err) {
          void err;
          return null;
        }
      }
      if (committedHash) {
        const curBranch = gs.branch || 'main';
        if (!gs.branchHeads || typeof gs.branchHeads !== 'object') gs.branchHeads = {};
        gs.branchHeads[curBranch] = {
          headCommit: gs.headCommit || committedHash,
          headSnapshot: { ...(gs.headSnapshot || gs.headFiles || {}) },
          commits: Array.isArray(gs.commits) ? gs.commits.slice() : []
        };
        if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFileSync === 'function') {
          try {
            if (typeof this.shell.vfs.mkdirSync === 'function') {
              this.shell.vfs.mkdirSync('/workspace/.git/refs/heads', { recursive: true });
            }
            this.shell.vfs.writeFileSync(`/workspace/.git/refs/heads/${curBranch}`, `${committedHash}\n`);
          } catch (_err) {
            void _err;
          }
        }
        if (this._activeScmDiffFile) {
          const remaining = this.getGitStatus();
          if (!remaining.some((e) => e && e.path === this._activeScmDiffFile)) {
            this._activeScmDiffFile = null;
            this._syncActiveFileToView();
          } else {
            this._syncActiveFileToView();
          }
        }
        this._syncFilesToShellVfs({ keepGitDir: true });
        this._saveState();
      }
      return committedHash;
    }

    listGitBranches() {
      const gs = this._getGitState();
      if (!gs) return [];
      const cur = gs.branch || 'main';
      if (!(gs.branches instanceof Set)) {
        gs.branches = new Set(Array.isArray(gs.branches) ? gs.branches : [cur]);
      }
      gs.branches.add(cur);
      return Array.from(gs.branches).map((name) => ({
        name,
        current: name === cur
      }));
    }

    createGitBranch(name, checkout = true) {
      const cleanName = String(name || '').trim().replace(/\s+/g, '-');
      if (!cleanName || cleanName.startsWith('-') || cleanName.includes('..')) return false;
      const gs = this._getGitState();
      if (!gs) return false;
      if (!(gs.branches instanceof Set)) {
        gs.branches = new Set(Array.isArray(gs.branches) ? gs.branches : [gs.branch || 'main']);
      }
      if (!gs.branchHeads || typeof gs.branchHeads !== 'object') gs.branchHeads = {};
      const curBranch = gs.branch || 'main';
      gs.branchHeads[curBranch] = {
        headCommit: gs.headCommit || '',
        headSnapshot: { ...(gs.headSnapshot || gs.headFiles || {}) },
        commits: Array.isArray(gs.commits) ? gs.commits.slice() : []
      };
      gs.branches.add(cleanName);
      if (!gs.branchHeads[cleanName]) {
        gs.branchHeads[cleanName] = {
          headCommit: gs.headCommit || '',
          headSnapshot: { ...(gs.headSnapshot || gs.headFiles || {}) },
          commits: Array.isArray(gs.commits) ? gs.commits.slice() : []
        };
      }
      if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFileSync === 'function') {
        try {
          if (typeof this.shell.vfs.mkdirSync === 'function') {
            this.shell.vfs.mkdirSync('/workspace/.git/refs/heads', { recursive: true });
          }
          if (gs.headCommit) {
            this.shell.vfs.writeFileSync(`/workspace/.git/refs/heads/${cleanName}`, `${gs.headCommit}\n`);
          }
        } catch (_err) {
          void _err;
        }
      }
      if (checkout) {
        return this.checkoutGitBranch(cleanName);
      }
      this._saveState();
      this._renderScmSidebar();
      this._updateStatusBar();
      return true;
    }

    checkoutGitBranch(name) {
      const cleanName = String(name || '').trim();
      if (!cleanName) return false;
      const gs = this._getGitState();
      if (!gs) return false;
      if (!(gs.branches instanceof Set)) {
        gs.branches = new Set(Array.isArray(gs.branches) ? gs.branches : [gs.branch || 'main']);
      }
      if (!gs.branches.has(cleanName)) return false;
      if (!gs.branchHeads || typeof gs.branchHeads !== 'object') gs.branchHeads = {};
      const prevBranch = gs.branch || 'main';
      if (prevBranch !== cleanName) {
        gs.branchHeads[prevBranch] = {
          headCommit: gs.headCommit || '',
          headSnapshot: { ...(gs.headSnapshot || gs.headFiles || {}) },
          commits: Array.isArray(gs.commits) ? gs.commits.slice() : []
        };
        const targetInfo = gs.branchHeads[cleanName];
        if (targetInfo && typeof targetInfo === 'object') {
          gs.headCommit = targetInfo.headCommit || '';
          this._syncGitHeadState(gs, targetInfo.headSnapshot || {});
          gs.commits = Array.isArray(targetInfo.commits) ? targetInfo.commits.slice() : [];
        }
      }
      gs.branch = cleanName;
      if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFileSync === 'function') {
        try {
          if (typeof this.shell.vfs.mkdirSync === 'function') {
            this.shell.vfs.mkdirSync('/workspace/.git/refs/heads', { recursive: true });
          }
          this.shell.vfs.writeFileSync('/workspace/.git/HEAD', `ref: refs/heads/${cleanName}\n`);
        } catch (_err) {
          void _err;
        }
      }
      this._saveState();
      if (this.activeSidebarView === 'scm') {
        this._renderScmSidebar();
      }
      if (this._activeScmDiffFile) {
        this._syncActiveFileToView();
      }
      this._updateStatusBar();
      return true;
    }

    getGitLog(limit = 20) {
      const gs = this._getGitState();
      if (!gs || !Array.isArray(gs.commits)) return [];
      const max = Math.max(1, Number(limit) || 20);
      return gs.commits.slice(0, max).map((c) => ({
        hash: String(c.hash || ''),
        message: String(c.message || ''),
        author: String(c.author || 'CodeLab Developer <dev@codelab.internal>'),
        date: String(c.date || ''),
        timestamp: Number(c.timestamp || 0)
      }));
    }

    openScmDiff(relPath, opts = {}) {
      const cleanRel = String(relPath || '').trim().replace(/^\/+/, '');
      if (!cleanRel) return false;
      if (this.activeTab === '__settings__') {
        this.activeTab = this.activeFile || null;
      }
      this._activeScmDiffFile = cleanRel;
      this._activeScmDiffStaged = Boolean(opts && opts.staged);
      this._syncActiveFileToView();
      return true;
    }

    closeScmDiff() {
      if (!this._activeScmDiffFile) return false;
      this._activeScmDiffFile = null;
      this._activeScmDiffStaged = false;
      this._syncActiveFileToView();
      return true;
    }

    _renderInlineScmDiff(hostEl) {
      if (!hostEl || !this._activeScmDiffFile) return;
      const relPath = this._activeScmDiffFile;
      const isStaged = Boolean(this._activeScmDiffStaged);
      const gs = this._getGitState();
      const headMap = (gs && (gs.headFiles || gs.headSnapshot)) || {};
      const leftText = Object.prototype.hasOwnProperty.call(headMap, relPath) ? String(headMap[relPath] ?? '') : '';
      let rightText = '';
      if (isStaged && gs && (gs.staged instanceof Map || gs.stagedFiles instanceof Map)) {
        const sMap = gs.staged instanceof Map ? gs.staged : gs.stagedFiles;
        if (sMap.has(relPath)) {
          const val = sMap.get(relPath);
          rightText = val === null || val === undefined ? '' : String(val);
        } else {
          rightText = Object.prototype.hasOwnProperty.call(this.files, relPath) ? String(this.files[relPath] ?? '') : '';
        }
      } else {
        rightText = Object.prototype.hasOwnProperty.call(this.files, relPath) ? String(this.files[relPath] ?? '') : '';
      }
      const leftLabel = Object.prototype.hasOwnProperty.call(headMap, relPath) ? `HEAD:${relPath}` : `${relPath} (Untracked)`;
      const rightLabel = isStaged ? `Index (Staged): ${relPath}` : `Working Tree: ${relPath}`;
      const diff = this._computeLineDiff(leftText, rightText);
      const hasFileInWorktree = Object.prototype.hasOwnProperty.call(this.files, relPath);

      const linesHtml = diff.hunks.map((h) => {
        const cls = h.type === 'add'
          ? 'codelab-diff-line--add codelab-scm-diff-line--add'
          : (h.type === 'del' ? 'codelab-diff-line--del codelab-scm-diff-line--del' : 'codelab-diff-line--same');
        const prefix = h.type === 'add' ? '+' : (h.type === 'del' ? '-' : ' ');
        return `
          <div class="codelab-diff-line ${cls}" data-diff-type="${h.type}">
            <span class="codelab-diff-gutter">${h.oldLine || ''}</span>
            <span class="codelab-diff-gutter">${h.newLine || ''}</span>
            <span class="codelab-diff-prefix">${prefix}</span>
            <span class="codelab-diff-code">${escapeHtml(h.text)}</span>
          </div>
        `;
      }).join('');

      hostEl.innerHTML = `
        <div class="codelab-scm-diff-header">
          <div class="codelab-scm-diff-header__title">
            <strong>${escapeHtml(relPath)}</strong>
            <span class="codelab-scm-diff-header__meta">${escapeHtml(leftLabel)} &rarr; ${escapeHtml(rightLabel)}</span>
            <span class="codelab-scm-diff-stats">
              <span class="codelab-scm-diff-stats__add">+${diff.added}</span>
              <span class="codelab-scm-diff-stats__del">−${diff.removed}</span>
            </span>
          </div>
          <div class="codelab-scm-diff-header__actions">
            ${hasFileInWorktree ? `<button type="button" class="codelab-btn" data-cl-action="scm-diff-open-editor" data-scm-path="${escapeHtml(relPath)}" title="Open File in Editor">Open File</button>` : ''}
            <button type="button" class="codelab-btn" data-cl-action="scm-close-diff" title="Close Diff View" aria-label="Close Diff">Close Diff</button>
          </div>
        </div>
        <div class="codelab-scm-diff-body codelab-diff-unified">
          ${linesHtml || '<div class="codelab-sidebar-empty">No line differences.</div>'}
        </div>
      `;
    }

    getDiagnostics() {
      this._ensureDiagnosticsStore();
      if (this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function') {
        return this._diagnosticsStore.getAll();
      }
      return [];
    }

    // ── Primary Side Bar, Activity Bar & Non-Modal View Controllers ─────────
    setSidebarVisible(visible, opts = {}) {
      const next = Boolean(visible);
      this.sidebarVisible = next;
      const shellEl = this.container ? this.container.querySelector('.codelab') : null;
      if (shellEl) {
        shellEl.classList.toggle('sidebar-collapsed', !next);
        shellEl.classList.toggle('files-collapsed', !next);
      }
      const toggleBtn = this.container ? this.container.querySelector('#cl-toggle-sidebar-btn') : null;
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', next);
        toggleBtn.setAttribute('aria-pressed', String(next));
      }
      this._syncSidebarDom();
      if (!opts || !opts.fromConfig) {
        if (this.configuration && typeof this.configuration.setUserSetting === 'function') {
          try {
            const curCfg = this.configuration.get('workbench.sideBar.visible', true);
            if (Boolean(curCfg) !== next) {
              const hadWs =
                typeof this.configuration.inspect === 'function' &&
                this.configuration.inspect('workbench.sideBar.visible').workspaceValue !== undefined;
              this.configuration.setUserSetting('workbench.sideBar.visible', next);
              if (hadWs && typeof this.configuration.setWorkspaceSetting === 'function') {
                this.configuration.setWorkspaceSetting('workbench.sideBar.visible', next);
                this._persistWorkspaceSettingsFromUi();
              }
            }
          } catch (err) {
            void err;
          }
        }
      }
      if (this.editor && typeof this.editor.layout === 'function') {
        this.editor.layout();
      }
    }

    toggleSidebar() {
      this.setSidebarVisible(!this.sidebarVisible);
    }

    setSidebarView(viewId, opts = {}) {
      const target = String(viewId || 'explorer');
      if (target === 'settings') {
        this.openSettings();
        return;
      }
      this.activeSidebarView = target;
      if (!opts || opts.ensureOpen !== false) {
        this.setSidebarVisible(true);
      } else {
        this._syncSidebarDom();
      }
      if (target === 'search') {
        this._renderSearchSidebarResults();
        if (opts && opts.focus !== false) {
          const inp = this.container ? this.container.querySelector('#cl-search-input') : null;
          if (inp && typeof inp.focus === 'function') inp.focus();
        }
      } else if (target === 'scm') {
        this._renderScmSidebar();
        if (opts && opts.focus !== false) {
          const inp = this.container ? this.container.querySelector('#cl-sidebar-scm #cl-scm-commit-input, #cl-sidebar-scm #cl-scm-init-btn') : null;
          if (inp && typeof inp.focus === 'function') inp.focus();
        }
      } else if (target.startsWith('plugin:')) {
        this._renderActiveSidebarPlugin();
      } else {
        this._renderFileLists();
        if (opts && opts.focus) {
          const firstItem = this.container
            ? this.container.querySelector('#cl-explorer-list .codelab-file-item, #cl-explorer-list .codelab-folder-item, #cl-sidebar-explorer [data-cl-action="new-file-root"]')
            : null;
          if (firstItem && typeof firstItem.focus === 'function') firstItem.focus();
        }
      }
    }

    _syncSidebarDom() {
      if (!this.container) return;
      const view = this.activeSidebarView || 'explorer';
      const isPlugin = view.startsWith('plugin:');
      const explorerEl = this.container.querySelector('#cl-sidebar-explorer');
      const searchEl = this.container.querySelector('#cl-sidebar-search');
      const scmEl = this.container.querySelector('#cl-sidebar-scm');
      const pluginEl = this.container.querySelector('#cl-sidebar-plugin-host');

      const setHidden = (el, hide) => {
        if (!el) return;
        el.hidden = hide;
        if (el.style) el.style.display = hide ? 'none' : '';
      };
      setHidden(explorerEl, view !== 'explorer');
      setHidden(searchEl, view !== 'search');
      setHidden(scmEl, view !== 'scm');
      setHidden(pluginEl, !isPlugin);

      this.container.querySelectorAll('#cl-activitybar [data-cl-activity]').forEach(btn => {
        const id = btn.dataset.clActivity;
        if (id === 'settings') {
          const sAct = Boolean(this.settingsTabOpen && this.activeTab === '__settings__');
          btn.classList.toggle('active', sAct);
          btn.setAttribute('aria-pressed', String(sAct));
        } else {
          const active = Boolean(this.sidebarVisible && id === view);
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-pressed', String(active));
        }
      });
    }

    collapseAllFolders() {
      const allFolders = new Set(Array.from(this.folders || []));
      for (const fname of Object.keys(this.files || {})) {
        const parts = fname.split('/');
        for (let i = 1; i < parts.length; i++) {
          allFolders.add(parts.slice(0, i).join('/'));
        }
      }
      for (const f of allFolders) {
        this.collapsedFolders.add(f);
      }
      this._renderFileLists();
    }

    _refreshSidebarPluginContributions() {
      if (!this.container) return;
      const slot = this.container.querySelector('#cl-activitybar-plugins');
      const activeSidebarPanels = [];
      if (this.plugins && this.plugins.panels && typeof this.plugins.panels.values === 'function') {
        for (const panel of this.plugins.panels.values()) {
          if (panel && panel.id && panel.location === 'sidebar') {
            activeSidebarPanels.push(panel);
          }
        }
      }
      if (slot) {
        slot.innerHTML = activeSidebarPanels.map((panel) => {
          const viewId = `plugin:${panel.id}`;
          const isAct = Boolean(this.sidebarVisible && this.activeSidebarView === viewId);
          return `<button type="button" class="codelab-activitybar__btn codelab-activitybar__item ${isAct ? 'active' : ''}" data-cl-activity="${escapeHtml(viewId)}" title="${escapeHtml(panel.title || panel.id)}" aria-label="${escapeHtml(panel.title || panel.id)}" aria-pressed="${isAct}">${CL_ICONS.box}</button>`;
        }).join('');
      }
      if (String(this.activeSidebarView || '').startsWith('plugin:')) {
        const activeId = String(this.activeSidebarView).slice('plugin:'.length);
        const stillExists = activeSidebarPanels.some(p => p.id === activeId);
        if (!stillExists) {
          const hostEl = this.container.querySelector('#cl-sidebar-plugin-host');
          if (hostEl) hostEl.innerHTML = '';
          this.setSidebarView('explorer', { ensureOpen: this.sidebarVisible, focus: false });
          return;
        }
        this._renderActiveSidebarPlugin();
      }
    }

    _renderActiveSidebarPlugin() {
      if (!this.container) return;
      const hostEl = this.container.querySelector('#cl-sidebar-plugin-host');
      if (!hostEl) return;
      const view = String(this.activeSidebarView || '');
      if (!view.startsWith('plugin:')) return;
      const panelId = view.slice('plugin:'.length);
      const panel = (this.plugins && this.plugins.panels && typeof this.plugins.panels.get === 'function')
        ? this.plugins.panels.get(panelId)
        : null;
      if (!panel) return;
      hostEl.innerHTML = `
        <div class="codelab-explorer__header">
          <span>${escapeHtml(panel.title || panel.id)}</span>
        </div>
        <div class="codelab-sidebar__body" id="cl-sidebar-plugin-mount"></div>
      `;
      const mountEl = hostEl.querySelector('#cl-sidebar-plugin-mount') || hostEl;
      if (typeof panel.render === 'function') {
        try {
          const rendered = panel.render(mountEl);
          if (typeof rendered === 'string') {
            mountEl.innerHTML = rendered;
          }
        } catch (err) {
          mountEl.innerHTML = `<div class="codelab-sidebar-empty">Plugin view error: ${escapeHtml(String((err && err.message) || err))}</div>`;
        }
      }
    }

    _updateScmActivityBadge() {
      if (!this.container) return;
      const badgeEl = this.container.querySelector('#cl-activity-scm-badge');
      if (!badgeEl) return;
      const gs = this._getGitState();
      const isInit = Boolean(gs && (gs.initialized || (gs.commits && gs.commits.length > 0) || (gs.staged && gs.staged.size > 0)));
      const count = isInit ? this.getGitStatus().length : 0;
      badgeEl.textContent = String(count);
      badgeEl.hidden = count <= 0;
      if (badgeEl.style) {
        badgeEl.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    }

    _renderSearchSidebarResults() {
      if (!this.container) return;
      const resultsEl = this.container.querySelector('#cl-search-results');
      if (!resultsEl) return;
      const state = this._searchState || { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
      const queryText = String(state.query || '');
      if (!queryText) {
        resultsEl.innerHTML = '<div class="codelab-sidebar-empty">Type a search term to find matches across workspace files.</div>';
        return;
      }
      let res;
      try {
        res = this.searchWorkspace({
          query: queryText,
          isRegex: Boolean(state.regex),
          caseSensitive: Boolean(state.caseSensitive),
          wholeWord: Boolean(state.wholeWord),
          include: state.include ? String(state.include).trim() : undefined,
          exclude: state.exclude ? String(state.exclude).trim() : undefined
        });
      } catch (err) {
        resultsEl.innerHTML = `<div class="codelab-search-error" role="alert">Invalid regular expression: ${escapeHtml(String((err && err.message) || err))}</div>`;
        return;
      }
      if (res && res.error) {
        resultsEl.innerHTML = `<div class="codelab-search-error" role="alert">Invalid regular expression: ${escapeHtml(String(res.error))}</div>`;
        return;
      }
      const groups = (res && Array.isArray(res.matches)) ? res.matches : [];
      if (groups.length === 0) {
        resultsEl.innerHTML = '<div class="codelab-sidebar-empty">No results found.</div>';
        return;
      }
      const totalMatches = typeof res.totalMatches === 'number' ? res.totalMatches : groups.reduce((acc, g) => acc + (Array.isArray(g.matches) ? g.matches.length : 1), 0);
      const filesCount = typeof res.filesMatched === 'number'
        ? res.filesMatched
        : (typeof res.fileCount === 'number' ? res.fileCount : groups.length);
      const summaryHtml = `<div class="codelab-search-summary">${totalMatches} result${totalMatches === 1 ? '' : 's'} in ${filesCount} file${filesCount === 1 ? '' : 's'}</div>`;

      const groupsHtml = groups.map((group) => {
        const fileName = String(group.file || '');
        const innerMatches = Array.isArray(group.matches)
          ? group.matches
          : [{ line: group.line || 1, col: group.col || group.column || 1, length: group.length || 0, lineText: group.lineText || '' }];
        const rowsHtml = innerMatches.map((m) => {
          const ln = Number(m.line || 1);
          const col = Number(m.col || m.column || 1);
          const lineStr = String(m.lineText !== undefined && m.lineText !== null ? m.lineText : '');
          const matchLen = Math.max(0, Number(m.length || 0));
          let snippetHtml = escapeHtml(lineStr.trim());
          if (matchLen > 0 && col >= 1 && col - 1 + matchLen <= lineStr.length) {
            const before = lineStr.slice(0, col - 1).trimStart();
            const mid = lineStr.slice(col - 1, col - 1 + matchLen);
            const after = lineStr.slice(col - 1 + matchLen).trimEnd();
            snippetHtml = `${escapeHtml(before)}<mark class="codelab-search-highlight">${escapeHtml(mid)}</mark>${escapeHtml(after)}`;
          }
          return `
            <div class="codelab-search-match" role="listitem">
              <button type="button" class="codelab-search-match__jump" data-cl-search-file="${escapeHtml(fileName)}" data-cl-search-line="${ln}" data-cl-search-col="${col}" title="${escapeHtml(fileName)}:${ln}:${col}">
                <span class="codelab-search-match__loc">${ln}:${col}</span>
                <span class="codelab-search-match__text">${snippetHtml}</span>
              </button>
              <button type="button" class="codelab-explorer__btn codelab-search-match__replace" data-cl-action="replace-match" data-cl-search-target-file="${escapeHtml(fileName)}" data-cl-search-line="${ln}" data-cl-search-col="${col}" data-cl-search-len="${matchLen}" title="Replace Match" aria-label="Replace match in ${escapeHtml(fileName)} at line ${ln}">⇄</button>
            </div>
          `;
        }).join('');
        return `
          <div class="codelab-search-group" data-search-group-file="${escapeHtml(fileName)}">
            <div class="codelab-search-group__header">
              <span class="codelab-search-group__file">${escapeHtml(fileName)}</span>
              <span class="codelab-search-group__actions">
                <button type="button" class="codelab-explorer__btn codelab-search-group__replace" data-cl-action="replace-file" data-cl-search-target-file="${escapeHtml(fileName)}" title="Replace All in File" aria-label="Replace all matches in ${escapeHtml(fileName)}">⇄</button>
                <span class="codelab-badge">${innerMatches.length}</span>
              </span>
            </div>
            <div class="codelab-search-group__items" role="list">${rowsHtml}</div>
          </div>
        `;
      }).join('');

      resultsEl.innerHTML = summaryHtml + groupsHtml;
    }

    _executeSidebarReplaceAll() {
      const state = this._searchState || { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
      const q = String(state.query || '');
      if (!q) return null;
      const res = this.replaceInWorkspace({
        query: q,
        replacement: String(state.replaceText || ''),
        isRegex: Boolean(state.regex),
        caseSensitive: Boolean(state.caseSensitive),
        wholeWord: Boolean(state.wholeWord),
        include: state.include ? String(state.include).trim() : undefined,
        exclude: state.exclude ? String(state.exclude).trim() : undefined
      });
      this._renderSearchSidebarResults();
      return res;
    }

    _executeSidebarReplaceFile(targetFile) {
      if (!targetFile) return null;
      const state = this._searchState || { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
      const q = String(state.query || '');
      if (!q) return null;
      const res = this.replaceInWorkspace({
        query: q,
        replacement: String(state.replaceText || ''),
        isRegex: Boolean(state.regex),
        caseSensitive: Boolean(state.caseSensitive),
        wholeWord: Boolean(state.wholeWord),
        targetFiles: [String(targetFile)]
      });
      this._renderSearchSidebarResults();
      return res;
    }

    _executeSidebarReplaceMatch(targetFile, line, col, matchLen) {
      if (!targetFile || !this.files || !Object.prototype.hasOwnProperty.call(this.files, targetFile)) {
        return false;
      }
      const state = this._searchState || { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
      const q = String(state.query || '');
      if (!q) return false;
      const raw = String(this.files[targetFile] ?? '');
      const lines = raw.split('\n');
      const lineIdx = Math.max(0, Number(line || 1) - 1);
      if (lineIdx >= lines.length) return false;
      const lineStr = lines[lineIdx];
      const startColIdx = Math.max(0, Number(col || 1) - 1);
      const sliceLen = Math.max(0, Number(matchLen || 0));
      if (startColIdx > lineStr.length) return false;
      const matchedSlice = lineStr.slice(startColIdx, startColIdx + sliceLen);
      const repStr = String(state.replaceText || '');
      let computedRep = repStr;
      if (state.regex) {
        try {
          const searchMod = root.CodeLabSearch;
          const escFn = searchMod && typeof searchMod.escapeRegex === 'function'
            ? searchMod.escapeRegex
            : (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          void escFn;
          const pat = state.wholeWord ? `\\b${q}\\b` : q;
          const rx = new RegExp(pat, state.caseSensitive ? '' : 'i');
          computedRep = matchedSlice.replace(rx, repStr);
        } catch (_err) {
          void _err;
          return false;
        }
      }
      lines[lineIdx] = lineStr.slice(0, startColIdx) + computedRep + lineStr.slice(startColIdx + sliceLen);
      const nextContent = lines.join('\n');
      this._applyInPlaceWorkspaceUpdates({ ...this.files, [targetFile]: nextContent }, [targetFile]);
      this._renderSearchSidebarResults();
      return true;
    }

    _executeSidebarReplaceOne() {
      const state = this._searchState || { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
      const q = String(state.query || '');
      if (!q) return false;
      let res;
      try {
        res = this.searchWorkspace({
          query: q,
          isRegex: Boolean(state.regex),
          caseSensitive: Boolean(state.caseSensitive),
          wholeWord: Boolean(state.wholeWord),
          include: state.include ? String(state.include).trim() : undefined,
          exclude: state.exclude ? String(state.exclude).trim() : undefined
        });
      } catch (_err) {
        void _err;
        return false;
      }
      if (!res || res.error || !Array.isArray(res.matches) || res.matches.length === 0) {
        return false;
      }
      const firstGroup = res.matches[0];
      const firstMatch = firstGroup && Array.isArray(firstGroup.matches) ? firstGroup.matches[0] : null;
      if (!firstGroup || !firstMatch) return false;
      return this._executeSidebarReplaceMatch(
        firstGroup.file,
        firstMatch.line || 1,
        firstMatch.col || firstMatch.column || 1,
        firstMatch.length || 0
      );
    }

    openSearchView(opts = {}) {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (slot && slot.innerHTML) slot.innerHTML = '';
      if (!this._searchState) {
        this._searchState = { query: '', replaceText: '', include: '', exclude: '', regex: false, caseSensitive: false, wholeWord: false };
      }
      if (typeof opts === 'string') {
        this._searchState.query = opts;
      } else if (opts && typeof opts.query === 'string') {
        this._searchState.query = opts.query;
      }
      if (opts && typeof opts.replaceText === 'string') {
        this._searchState.replaceText = opts.replaceText;
      }
      if (opts && typeof opts.include === 'string') {
        this._searchState.include = opts.include;
      }
      if (opts && typeof opts.exclude === 'string') {
        this._searchState.exclude = opts.exclude;
      }
      const inp = this.container ? this.container.querySelector('#cl-search-input') : null;
      if (inp) inp.value = this._searchState.query || '';
      const repInp = this.container ? this.container.querySelector('#cl-search-replace-input') : null;
      if (repInp && opts && typeof opts.replaceText === 'string') repInp.value = this._searchState.replaceText;
      const incInp = this.container ? this.container.querySelector('#cl-search-include') : null;
      if (incInp) incInp.value = this._searchState.include || '';
      const excInp = this.container ? this.container.querySelector('#cl-search-exclude') : null;
      if (excInp) excInp.value = this._searchState.exclude || '';
      this.setSidebarView('search', { ensureOpen: true, focus: !opts || opts.focus !== false });
    }

    showSearchModal(initialQuery = '') {
      this.openSearchView({ query: String(initialQuery || '') });
    }

    _initGitRepoInScm() {
      const scmMod = root.CodeLabScm;
      this._syncFilesToShellVfs();
      if (scmMod && typeof scmMod.initRepository === 'function') {
        if (this.shell) {
          scmMod.initRepository(this.shell, { snapshotExisting: false });
        } else {
          const gs = this._getGitState();
          if (gs) scmMod.initRepository(gs, { snapshotExisting: false });
        }
      } else {
        const gs = this._getGitState();
        if (gs) gs.initialized = true;
      }
      this._saveState();
      this._renderScmSidebar();
      this._updateStatusBar();
    }

    _renderScmSidebar() {
      if (!this.container) return;
      const bodyEl = this.container.querySelector('#cl-scm-view-body');
      if (!bodyEl) return;
      const gs = this._getGitState();
      const isInitialized = Boolean(
        gs && (gs.initialized || (Array.isArray(gs.commits) && gs.commits.length > 0) || (gs.staged && gs.staged.size > 0))
      );

      if (!isInitialized) {
        bodyEl.innerHTML = `
          <div class="codelab-scm-empty">
            <p class="codelab-sidebar-empty">The current workspace does not have an active Git repository.</p>
            <button type="button" class="codelab-btn codelab-btn--primary" id="cl-scm-init-btn" data-cl-action="scm-init" style="width:100%;justify-content:center;">
              Initialize Repository
            </button>
            <button type="button" class="codelab-btn" id="cl-scm-clone-btn" data-cl-action="open-clone-modal" style="width:100%;justify-content:center;margin-top:8px;">
              Clone Repository
            </button>
          </div>
        `;
        this._updateScmActivityBadge();
        return;
      }

      const branch = (gs && gs.branch) ? gs.branch : 'main';
      const branches = this.listGitBranches();
      const statusList = this.getGitStatus();
      const stagedEntries = statusList.filter(e => e && e.staged);
      const unstagedEntries = statusList.filter(e => e && !e.staged);
      const existingInput = bodyEl.querySelector('#cl-scm-commit-input');
      const hadCommitFocus = Boolean(
        existingInput &&
        typeof document !== 'undefined' &&
        document.activeElement === existingInput
      );
      const selStart = existingInput && typeof existingInput.selectionStart === 'number' ? existingInput.selectionStart : null;
      const selEnd = existingInput && typeof existingInput.selectionEnd === 'number' ? existingInput.selectionEnd : null;
      const draftMsg = existingInput ? existingInput.value : '';

      const renderEntryRow = (entry, isStaged) => {
        const codeChar = isStaged
          ? (entry.index && entry.index !== ' ' ? entry.index : 'M')
          : (entry.worktree && entry.worktree !== ' ' ? entry.worktree : (entry.index || 'U'));
        return `
          <div class="codelab-scm-entry codelab-scm-item" role="listitem" data-cl-scm-file="${escapeHtml(entry.path)}" data-scm-path="${escapeHtml(entry.path)}" data-scm-staged="${isStaged}">
            <button type="button" class="codelab-scm-entry__file" data-cl-action="scm-open-file" data-scm-path="${escapeHtml(entry.path)}" title="View Diff for ${escapeHtml(entry.path)}">
              <span>${escapeHtml(entry.path)}</span>
            </button>
            <span class="codelab-scm-entry__actions">
              ${isStaged
                ? `<button type="button" class="codelab-explorer__btn" data-cl-action="scm-unstage-file" data-scm-path="${escapeHtml(entry.path)}" title="Unstage Changes" aria-label="Unstage ${escapeHtml(entry.path)}">&minus;</button>`
                : `<button type="button" class="codelab-explorer__btn" data-cl-action="scm-discard-file" data-scm-path="${escapeHtml(entry.path)}" title="Discard Changes" aria-label="Discard ${escapeHtml(entry.path)}">&#x21BA;</button>
                   <button type="button" class="codelab-explorer__btn" data-cl-action="scm-stage-file" data-scm-path="${escapeHtml(entry.path)}" title="Stage Changes" aria-label="Stage ${escapeHtml(entry.path)}">+</button>`}
              <span class="codelab-scm-entry__status" title="${escapeHtml(entry.status || '')}">${escapeHtml(codeChar)}</span>
            </span>
          </div>
        `;
      };

      const commits = this.getGitLog(10);
      const totalCommits = (gs && Array.isArray(gs.commits)) ? gs.commits.length : commits.length;
      const commitsHtml = commits.length > 0
        ? `
          <div class="codelab-scm-section" data-scm-section="commits">
            <div class="codelab-scm-section__header">
              <span>Commit History (${totalCommits})</span>
            </div>
            <div class="codelab-scm-commits" role="list">
              ${commits.map(c => `
                <div class="codelab-scm-commit-row" role="listitem">
                  <code>${escapeHtml(String(c.hash || '').slice(0, 7))}</code>
                  <span>${escapeHtml(c.message || '')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `
        : '';

      const branchOptionsHtml = branches.map(b =>
        `<option value="${escapeHtml(b.name)}"${b.current ? ' selected' : ''}>${escapeHtml(b.name)}</option>`
      ).join('');

      const newBranchFormHtml = this._scmCreatingBranch
        ? `
          <div class="codelab-scm-new-branch-row">
            <input id="cl-scm-new-branch-input" class="codelab-sidebar-input" type="text" placeholder="New branch name..." aria-label="New branch name" autocomplete="off" />
            <button type="button" class="codelab-btn codelab-btn--primary" data-cl-action="scm-create-branch-submit" title="Create and Switch Branch">Create</button>
            <button type="button" class="codelab-btn" data-cl-action="scm-create-branch-cancel" title="Cancel Branch Creation">Cancel</button>
          </div>
        `
        : '';

      bodyEl.innerHTML = `
        <div class="codelab-scm-branch-bar">
          ${CL_ICONS.gitBranch}
          <select id="cl-scm-branch-select" class="codelab-scm-branch-select" aria-label="Switch Git Branch" title="Active Git Branch">
            ${branchOptionsHtml}
          </select>
          <button type="button" class="codelab-explorer__btn" data-cl-action="scm-new-branch-toggle" title="Create New Branch" aria-label="Create New Git Branch">+</button>
        </div>
        ${newBranchFormHtml}
        <div class="codelab-sidebar-field codelab-scm-commit-box">
          <textarea id="cl-scm-commit-input" class="codelab-sidebar-input codelab-scm-commit-textarea" rows="2" placeholder="Message (⌘Enter to commit on '${escapeHtml(branch)}')" aria-label="Commit message">${escapeHtml(draftMsg)}</textarea>
          <button type="button" id="cl-scm-commit-btn" class="codelab-btn codelab-btn--primary" data-cl-action="scm-commit" ${stagedEntries.length > 0 && draftMsg.trim().length > 0 ? '' : 'disabled'} style="width:100%;justify-content:center;">
            Commit
          </button>
        </div>
        ${stagedEntries.length > 0 ? `
          <div class="codelab-scm-section" data-scm-section="staged">
            <div class="codelab-scm-section__header">
              <span>Staged Changes (${stagedEntries.length})</span>
              <button type="button" class="codelab-explorer__btn" data-cl-action="scm-unstage-all" title="Unstage All Changes" aria-label="Unstage All Changes">&minus;</button>
            </div>
            <div class="codelab-scm-list" id="cl-scm-staged-list" role="list">${stagedEntries.map(e => renderEntryRow(e, true)).join('')}</div>
          </div>
        ` : ''}
        <div class="codelab-scm-section" data-scm-section="unstaged">
          <div class="codelab-scm-section__header">
            <span>Changes (${unstagedEntries.length})</span>
            ${unstagedEntries.length > 0 ? `<button type="button" class="codelab-explorer__btn" data-cl-action="scm-stage-all" title="Stage All Changes" aria-label="Stage All Changes">+</button>` : ''}
          </div>
          <div class="codelab-scm-list" id="cl-scm-status-list" role="list">
            ${unstagedEntries.length > 0
              ? unstagedEntries.map(e => renderEntryRow(e, false)).join('')
              : (stagedEntries.length === 0 ? '<div class="codelab-sidebar-empty">Working tree clean.</div>' : '<div class="codelab-sidebar-empty">No unstaged changes.</div>')}
          </div>
        </div>
        ${commitsHtml}
      `;
      const restoredInput = bodyEl.querySelector('#cl-scm-commit-input');
      if (restoredInput) {
        if (restoredInput.value !== draftMsg) {
          restoredInput.value = draftMsg;
        }
        if (hadCommitFocus && typeof restoredInput.focus === 'function') {
          restoredInput.focus();
          if (selStart !== null && selEnd !== null && typeof restoredInput.setSelectionRange === 'function') {
            try { restoredInput.setSelectionRange(selStart, selEnd); } catch (_err) { void _err; }
          }
        }
      }
      this._updateScmActivityBadge();
    }

    openScmView() {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (slot && slot.innerHTML) slot.innerHTML = '';
      this.setSidebarView('scm', { ensureOpen: true, focus: true });
    }

    showScmModal() {
      this.openScmView();
    }

    openProblemsPanel() {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (slot && slot.innerHTML) slot.innerHTML = '';
      this.setPanelVisible(true, { skipRender: true });
      this.switchDrawerTab('problems', { ensureVisible: true });
    }

    showProblemsModal() {
      this.openProblemsPanel();
    }

    killActiveTerminalSession() {
      this._ensureTerminalSessions();
      return this.closeTerminalSession(this._activeTerminalSessionId);
    }

    // ── Topbar Menubar & Dropdown Engine (#cl-topbar-menu-slot) ─────────────
    _getTopbarMenuDefinitions() {
      let recentWorkspaces = [];
      const wsMod = this._getWorkspaceStorageMod();
      if (wsMod && typeof wsMod.listWorkspaces === 'function') {
        try {
          recentWorkspaces = wsMod.listWorkspaces().slice(0, 10);
        } catch (err) {
          void err;
        }
      }
      const recentSubmenu = recentWorkspaces.length > 0
        ? [
            ...recentWorkspaces.map(ws => ({
              label: `${ws.title || ws.labId}${ws.labId === this.labId ? ' (Current)' : ''}`,
              cmd: `workspace:open:${ws.labId}`,
              workspaceId: ws.labId
            })),
            { divider: true },
            { label: 'More Recent Workspaces...', cmd: 'file:open-recent-picker' }
          ]
        : [{ label: 'No Recent Workspaces', disabled: true }];

      const autoSaveMode = this.configuration
        ? String(this.configuration.get('files.autoSave', 'afterDelay'))
        : 'afterDelay';
      const autoSaveOn = autoSaveMode !== 'off';

      return {
        file: [
          { label: 'New File...', shortcut: '', cmd: 'file:new-file' },
          { label: 'New Folder...', shortcut: '', cmd: 'file:new-folder' },
          { divider: true },
          { label: 'New Blank Workspace...', cmd: 'file:new-blank-workspace' },
          { label: 'Clone Repository...', cmd: 'file:clone-repo' },
          { label: 'Open Recent Workspace...', submenu: recentSubmenu },
          { divider: true },
          { label: 'Save', shortcut: '⌘S', cmd: 'file:save' },
          { label: 'Save All', cmd: 'file:save-all' },
          { label: `${autoSaveOn ? '✓ ' : ''}Auto Save`, cmd: 'file:toggle-autosave' },
          { divider: true },
          {
            label: 'Preferences',
            submenu: [
              { label: 'Settings', shortcut: '⌘,', cmd: 'file:settings' },
              { label: 'Open Workspace Settings (JSON)', cmd: 'file:settings-json' },
              { label: 'Color Theme: Dark', cmd: 'view:theme-dark' },
              { label: 'Color Theme: Light', cmd: 'view:theme-light' },
              { label: 'Color Theme: High Contrast', cmd: 'view:theme-hc' }
            ]
          },
          { divider: true },
          { label: 'Export Workspace as ZIP', cmd: 'file:export-zip' },
          { label: 'Reset Workspace...', cmd: 'file:reset-workspace' }
        ],
        edit: [
          { label: 'Undo', shortcut: '⌘Z', cmd: 'edit:undo' },
          { label: 'Redo', shortcut: '⇧⌘Z', cmd: 'edit:redo' },
          { divider: true },
          { label: 'Find', shortcut: '⌘F', cmd: 'edit:find' },
          { label: 'Replace', shortcut: '⌥⌘F', cmd: 'edit:replace' },
          { divider: true },
          { label: 'Find in Files', shortcut: '⇧⌘F', cmd: 'edit:find-in-files' },
          { label: 'Format Document', shortcut: '⇧⌥F', cmd: 'edit:format' }
        ],
        selection: [
          { label: 'Select All', shortcut: '⌘A', cmd: 'selection:select-all' }
        ],
        view: [
          { label: 'Command Palette...', shortcut: '⇧⌘P', cmd: 'view:command-palette' },
          { divider: true },
          { label: 'Explorer', shortcut: '⇧⌘E', cmd: 'view:explorer' },
          { label: 'Search', shortcut: '⇧⌘F', cmd: 'view:search' },
          { label: 'Source Control', shortcut: '⌃⇧G', cmd: 'view:scm' },
          { divider: true },
          { label: 'Problems', shortcut: '⇧⌘M', cmd: 'view:problems' },
          { label: 'Output', cmd: 'view:output' },
          { label: 'Terminal', shortcut: '⌃`', cmd: 'view:terminal' },
          { divider: true },
          { label: 'Toggle Primary Side Bar', shortcut: '⌘B', cmd: 'view:toggle-sidebar' },
          { label: 'Toggle Panel', shortcut: '⌘J', cmd: 'view:toggle-panel' },
          {
            label: 'Appearance',
            submenu: [
              { label: 'Full Screen', cmd: 'view:fullscreen' },
              { label: 'Move Primary Side Bar Left / Right', cmd: 'view:toggle-sidebar-side' },
              { label: 'Toggle Status Bar', cmd: 'view:toggle-statusbar' },
              { divider: true },
              { label: 'Dark Theme', cmd: 'view:theme-dark' },
              { label: 'Light Theme', cmd: 'view:theme-light' },
              { label: 'High Contrast Theme', cmd: 'view:theme-hc' }
            ]
          }
        ],
        go: [
          { label: 'Go to File...', shortcut: '⌘P', cmd: 'go:file' },
          { label: 'Go to Line/Column...', shortcut: '⌃G', cmd: 'go:line' },
          { divider: true },
          { label: 'Next Problem', shortcut: 'F8', cmd: 'go:next-problem' },
          { label: 'Previous Problem', shortcut: '⇧F8', cmd: 'go:prev-problem' }
        ],
        run: [
          { label: 'Run Code', shortcut: '⌘↵', cmd: 'run:code' },
          { label: 'Run Active File', shortcut: '⇧⌘↵', cmd: 'run:active' },
          { label: 'Run Tests', cmd: 'run:tests' },
          { label: 'Stop Execution', cmd: 'run:stop' }
        ],
        terminal: [
          { label: 'New Terminal', shortcut: '⌃⇧`', cmd: 'terminal:new' },
          { label: 'Focus Terminal', shortcut: '⌃`', cmd: 'terminal:focus' },
          { divider: true },
          { label: 'Clear Terminal', cmd: 'terminal:clear' },
          { label: 'Kill Terminal', cmd: 'terminal:kill' }
        ],
        help: [
          { label: 'Welcome', cmd: 'help:welcome' },
          { label: 'Keyboard Shortcuts Reference', cmd: 'help:shortcuts' },
          { divider: true },
          { label: 'About CodeLab', cmd: 'help:about' }
        ]
      };
    }

    _openTopbarMenu(menuId, opts = {}) {
      if (!this.container) return;
      const defs = this._getTopbarMenuDefinitions();
      const items = defs[menuId];
      if (!items) return;
      const slot = this.container.querySelector('#cl-topbar-menu-slot');
      const menubar = this.container.querySelector('#cl-menubar');
      if (!slot || !menubar) return;

      if (!this._activeTopMenu && typeof document !== 'undefined' && this.container) {
        const ae = document.activeElement;
        if (
          ae &&
          ae !== document.body &&
          ae !== document.documentElement &&
          typeof this.container.contains === 'function' &&
          this.container.contains(ae) &&
          (!ae.closest || !ae.closest('#cl-menubar, #cl-topbar-menu-slot'))
        ) {
          this._menuReturnFocusEl = ae;
        }
      }
      this._activeTopMenu = menuId;
      this._activeTopMenuOpenedViaHover = Boolean(opts && opts.viaHover);
      this._activeTopMenuOpenedAt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
      const triggers = Array.from(menubar.querySelectorAll('.codelab-menubar__trigger'));
      let activeTrigger = null;
      triggers.forEach(btn => {
        const isTarget = btn.dataset.clMenu === menuId;
        btn.classList.toggle('active', isTarget);
        btn.setAttribute('aria-expanded', String(isTarget));
        if (isTarget) {
          btn.setAttribute('tabindex', '0');
          activeTrigger = btn;
        } else {
          btn.setAttribute('tabindex', '-1');
        }
      });

      const renderMenuItems = (list) => list.map(entry => {
        if (entry.divider) {
          return '<div class="codelab-topbar-menu__sep" role="separator"></div>';
        }
        if (Array.isArray(entry.submenu)) {
          return `<div class="codelab-topbar-menu__has-sub"><button type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" class="codelab-topbar-menu__item" data-cl-submenu="true"><span class="codelab-topbar-menu__label">${escapeHtml(entry.label)}</span> <span class="codelab-topbar-menu__arrow" aria-hidden="true">▸</span></button><div class="codelab-topbar-submenu" role="menu" aria-label="${escapeHtml(entry.label)}">${renderMenuItems(entry.submenu)}</div></div>`;
        }
        return `<button type="button" role="menuitem" class="codelab-topbar-menu__item" data-cl-menu-cmd="${escapeHtml(entry.cmd || '')}"${entry.workspaceId ? ` data-cl-workspace="${escapeHtml(entry.workspaceId)}"` : ''} ${entry.disabled ? 'disabled' : ''}><span class="codelab-topbar-menu__label">${escapeHtml(entry.label)}</span>${entry.shortcut ? ` <span class="codelab-topbar-menu__kbd" aria-hidden="true">${escapeHtml(entry.shortcut)}</span>` : ''}</button>`;
      }).join('');

      let prefX = 48;
      let prefY = 38;
      if (activeTrigger && typeof activeTrigger.getBoundingClientRect === 'function') {
        try {
          const r = activeTrigger.getBoundingClientRect();
          if (r && (r.width > 0 || r.height > 0)) {
            prefX = r.left;
            prefY = r.bottom + 2;
          }
        } catch (err) {
          void err;
        }
      }

      slot.innerHTML = `
        <div class="codelab-topbar-menu" role="menu" data-menu-id="${escapeHtml(menuId)}" aria-label="${escapeHtml(menuId)} menu" style="left:${Math.round(prefX)}px;top:${Math.round(prefY)}px;">
          ${renderMenuItems(items)}
        </div>
      `;
      const menuEl = slot.querySelector('.codelab-topbar-menu');
      if (menuEl) {
        this._clampMenuToViewport(menuEl, prefX, prefY);
        if (opts && opts.focusFirstItem) {
          const firstBtn = menuEl.querySelector('.codelab-topbar-menu__item');
          if (firstBtn && typeof firstBtn.focus === 'function') {
            firstBtn.focus();
          }
        }
      }
    }

    _closeTopbarMenu(opts = {}) {
      const prevMenu = this._activeTopMenu;
      this._activeTopMenu = null;
      if (!this.container) return;
      const slot = this.container.querySelector('#cl-topbar-menu-slot');
      if (slot) slot.innerHTML = '';
      const menubar = this.container.querySelector('#cl-menubar');
      if (menubar) {
        let triggerToFocus = null;
        menubar.querySelectorAll('.codelab-menubar__trigger').forEach(btn => {
          btn.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
          if (prevMenu && btn.dataset.clMenu === prevMenu) {
            triggerToFocus = btn;
          }
        });
        if (opts && opts.restoreFocus && triggerToFocus && typeof triggerToFocus.focus === 'function') {
          triggerToFocus.focus();
        }
      }
    }

    _executeTopbarMenuCommand(cmd) {
      if (!cmd) return;
      if (cmd.startsWith('workspace:open:')) {
        const targetLabId = cmd.slice('workspace:open:'.length);
        if (targetLabId) this.switchWorkspace(targetLabId);
        return;
      }
      if (cmd === 'file:new-file') {
        this.setSidebarView('explorer', { ensureOpen: true, focus: false });
        this.startInlineCreate('file', this.explorerFolder || '');
      } else if (cmd === 'file:new-folder') {
        this.setSidebarView('explorer', { ensureOpen: true, focus: false });
        this.startInlineCreate('folder', this.explorerFolder || '');
      } else if (cmd === 'file:new-blank-workspace') {
        this.openBlankWorkspace();
      } else if (cmd === 'file:clone-repo') {
        this.openCloneDialog();
      } else if (cmd === 'file:open-recent-picker') {
        this.showOpenRecentWorkspaceModal();
      } else if (cmd === 'file:save') {
        this.saveActiveFile({ manual: true });
      } else if (cmd === 'file:save-all') {
        this.saveWorkspace();
      } else if (cmd === 'file:toggle-autosave') {
        if (this.configuration && typeof this.configuration.setUserSetting === 'function') {
          const cur = String(this.configuration.get('files.autoSave', 'afterDelay'));
          const next = cur === 'off' ? 'afterDelay' : 'off';
          this.configuration.setUserSetting('files.autoSave', next);
          if (next !== 'off' && ((this._dirtyFiles && this._dirtyFiles.size > 0) || this.saveStatusState === 'dirty')) {
            this.saveActiveFile({ manual: false, all: true });
          }
          this._updateStatusBar();
        }
      } else if (cmd === 'file:settings') {
        this.openSettings();
      } else if (cmd === 'file:settings-json') {
        this.openWorkspaceSettingsJson();
      } else if (cmd === 'file:export-zip') {
        this.exportProjectZip({ download: true });
      } else if (cmd === 'file:reset-workspace') {
        this.resetLab({ ui: true });
      } else if (cmd === 'edit:undo') {
        if (this.editor && typeof this.editor.trigger === 'function') {
          this.editor.focus();
          this.editor.trigger('menubar', 'undo', null);
        } else {
          const sqlTa = this.container ? this.container.querySelector('#cl-sql-editor-host .cl-sql-textarea') : null;
          const sqlHost = this.container ? this.container.querySelector('#cl-sql-editor-host') : null;
          if (sqlTa && sqlHost && sqlHost.style && sqlHost.style.display !== 'none') {
            if (typeof sqlTa.focus === 'function') sqlTa.focus();
            try { document.execCommand('undo'); } catch (_err) { void _err; }
          } else if (!this._applyFallbackHistoryStep('undo') && this.container) {
            const fb = this.container.querySelector('#cl-fallback-editor');
            if (fb && typeof fb.focus === 'function') {
              fb.focus();
              try { document.execCommand('undo'); } catch (_err) { void _err; }
            }
          }
        }
      } else if (cmd === 'edit:redo') {
        if (this.editor && typeof this.editor.trigger === 'function') {
          this.editor.focus();
          this.editor.trigger('menubar', 'redo', null);
        } else {
          const sqlTa = this.container ? this.container.querySelector('#cl-sql-editor-host .cl-sql-textarea') : null;
          const sqlHost = this.container ? this.container.querySelector('#cl-sql-editor-host') : null;
          if (sqlTa && sqlHost && sqlHost.style && sqlHost.style.display !== 'none') {
            if (typeof sqlTa.focus === 'function') sqlTa.focus();
            try { document.execCommand('redo'); } catch (_err) { void _err; }
          } else if (!this._applyFallbackHistoryStep('redo') && this.container) {
            const fb = this.container.querySelector('#cl-fallback-editor');
            if (fb && typeof fb.focus === 'function') {
              fb.focus();
              try { document.execCommand('redo'); } catch (_err) { void _err; }
            }
          }
        }
      } else if (cmd === 'edit:find') {
        if (this.editor && typeof this.editor.getAction === 'function') {
          const act = this.editor.getAction('actions.find');
          if (act && typeof act.run === 'function') {
            act.run();
            return;
          }
        }
        this.openSearchView();
      } else if (cmd === 'edit:replace') {
        if (this.editor && typeof this.editor.getAction === 'function') {
          const act = this.editor.getAction('editor.action.startFindReplaceAction');
          if (act && typeof act.run === 'function') {
            act.run();
            return;
          }
        }
        this.openSearchView();
      } else if (cmd === 'edit:find-in-files') {
        this.openSearchView();
      } else if (cmd === 'edit:format') {
        this.formatActiveDocument();
      } else if (cmd === 'selection:select-all') {
        if (this.editor && this.editor.getModel && this.editor.getModel()) {
          const m = this.editor.getModel();
          const fullRange = m.getFullModelRange ? m.getFullModelRange() : null;
          if (fullRange && typeof this.editor.setSelection === 'function') {
            this.editor.setSelection(fullRange);
            this.editor.focus();
            return;
          }
        }
        const fb = this.container ? this.container.querySelector('#cl-fallback-editor') : null;
        if (fb && typeof fb.select === 'function') {
          fb.focus();
          fb.select();
        }
      } else if (cmd === 'view:command-palette') {
        this.openCommandPalette('commands');
      } else if (cmd === 'view:explorer') {
        this.setSidebarView('explorer', { ensureOpen: true, focus: true });
      } else if (cmd === 'view:search') {
        this.openSearchView();
      } else if (cmd === 'view:scm') {
        this.openScmView();
      } else if (cmd === 'view:problems') {
        this.openProblemsPanel();
      } else if (cmd === 'view:output') {
        this.switchDrawerTab('output');
      } else if (cmd === 'view:terminal') {
        this.switchDrawerTab('terminal');
      } else if (cmd === 'view:toggle-sidebar') {
        this.toggleSidebar();
      } else if (cmd === 'view:toggle-panel') {
        this.togglePanel();
      } else if (cmd === 'view:fullscreen') {
        this.toggleFullscreen();
      } else if (cmd === 'view:toggle-sidebar-side') {
        if (this.configuration && typeof this.configuration.setUserSetting === 'function') {
          const cur = this.configuration.get('workbench.sidebar.defaultLocation', 'left');
          const nextLoc = cur === 'right' ? 'left' : 'right';
          const hadWs =
            typeof this.configuration.inspect === 'function' &&
            this.configuration.inspect('workbench.sidebar.defaultLocation').workspaceValue !== undefined;
          this.configuration.setUserSetting('workbench.sidebar.defaultLocation', nextLoc);
          if (hadWs && typeof this.configuration.setWorkspaceSetting === 'function') {
            this.configuration.setWorkspaceSetting('workbench.sidebar.defaultLocation', nextLoc);
            this._persistWorkspaceSettingsFromUi();
          }
        }
      } else if (cmd === 'view:toggle-statusbar') {
        if (this.configuration && typeof this.configuration.setUserSetting === 'function') {
          const cur = this.configuration.get('workbench.statusBar.visible', true) !== false;
          const nextVis = !cur;
          const hadWs =
            typeof this.configuration.inspect === 'function' &&
            this.configuration.inspect('workbench.statusBar.visible').workspaceValue !== undefined;
          this.configuration.setUserSetting('workbench.statusBar.visible', nextVis);
          if (hadWs && typeof this.configuration.setWorkspaceSetting === 'function') {
            this.configuration.setWorkspaceSetting('workbench.statusBar.visible', nextVis);
            this._persistWorkspaceSettingsFromUi();
          }
        }
      } else if (cmd === 'view:theme-dark') {
        this.setTheme('dark');
      } else if (cmd === 'view:theme-light') {
        this.setTheme('light');
      } else if (cmd === 'view:theme-hc') {
        this.setTheme('high-contrast');
      } else if (cmd === 'go:file') {
        this.openCommandPalette('files');
      } else if (cmd === 'go:line') {
        this.promptGoToLine();
      } else if (cmd === 'go:next-problem') {
        this.goToNextProblem(false);
      } else if (cmd === 'go:prev-problem') {
        this.goToNextProblem(true);
      } else if (cmd === 'run:code') {
        this.runCode();
      } else if (cmd === 'run:active') {
        this.runActiveFile();
      } else if (cmd === 'run:tests') {
        this.runTests();
      } else if (cmd === 'run:stop') {
        this.stopExecution();
      } else if (cmd === 'terminal:new') {
        this.createTerminalSession();
        this.switchDrawerTab('terminal');
      } else if (cmd === 'terminal:focus') {
        this.switchDrawerTab('terminal');
      } else if (cmd === 'terminal:clear') {
        this._clearTerminalLogs();
        this._renderDrawerBody();
      } else if (cmd === 'terminal:kill') {
        this.killActiveTerminalSession();
      } else if (cmd === 'help:welcome') {
        this.closeAllTabs();
      } else if (cmd === 'help:shortcuts') {
        this.showKeyboardShortcutsReference();
      } else if (cmd === 'help:about') {
        this.showAboutModal();
      }
    }

    _needsWorkspaceConfirm() {
      if (this._dirtyFiles && this._dirtyFiles.size > 0) return true;
      return Object.keys(this.files || {}).length > 0;
    }

    _showWorkspaceConfirmModal(opts = {}) {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) return Promise.resolve('isolated');
      const titleText = opts.title || 'Open New Workspace';
      const descText = opts.message || 'Your current workspace contains files or unsaved changes. Would you like to open a new isolated workspace (preserving your current work in Recent Workspaces) or replace the current workspace?';
      const isolateLabel = opts.isolateLabel || 'New Isolated Workspace';
      const replaceLabel = opts.replaceLabel || 'Replace Current Workspace';
      this._captureModalReturnFocus();
      return new Promise((resolve) => {
        let settled = false;
        const finish = (choice) => {
          if (settled) return;
          settled = true;
          this._onModalClosedCallback = null;
          resolve(choice);
        };
        this._onModalClosedCallback = () => finish('cancel');
        slot.innerHTML = `
          <div class="codelab-modal-backdrop" data-cl-backdrop="workspace-confirm">
            <div class="codelab-modal codelab-confirm-modal" id="workspace-confirm-modal" data-cl-modal="workspace-confirm" role="dialog" aria-modal="true" aria-labelledby="cl-ws-confirm-title" aria-describedby="cl-ws-confirm-desc" style="max-width:480px;">
              <div class="codelab-modal__header">
                <span id="cl-ws-confirm-title">${escapeHtml(titleText)}</span>
                <button type="button" class="codelab-btn" data-cl-action="close-modal" aria-label="Close">✕</button>
              </div>
              <div class="codelab-modal__body">
                <p id="cl-ws-confirm-desc" style="margin:0 0 16px;color:var(--cl-fg);line-height:1.5;">
                  ${escapeHtml(descText)}
                </p>
                <div class="codelab-modal__footer codelab-confirm-modal__actions">
                  <button type="button" class="codelab-btn" data-cl-confirm="cancel" data-cl-action="close-modal">Cancel</button>
                  <button type="button" class="codelab-btn codelab-btn--danger" data-cl-confirm="replace">${escapeHtml(replaceLabel)}</button>
                  <button type="button" class="codelab-btn codelab-btn--primary" data-cl-confirm="isolated">${escapeHtml(isolateLabel)}</button>
                </div>
              </div>
            </div>
          </div>
        `;
        const isoBtn = slot.querySelector('[data-cl-confirm="isolated"]');
        const repBtn = slot.querySelector('[data-cl-confirm="replace"]');
        const canBtn = slot.querySelector('[data-cl-confirm="cancel"]');
        if (isoBtn) {
          isoBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this._onModalClosedCallback = null;
            this.closeModal({ restoreFocus: false });
            finish('isolated');
          });
          if (typeof isoBtn.focus === 'function') isoBtn.focus();
        }
        if (repBtn) {
          repBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this._onModalClosedCallback = null;
            this.closeModal({ restoreFocus: false });
            finish('replace');
          });
        }
        if (canBtn) {
          canBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this._onModalClosedCallback = null;
            this.closeModal({ restoreFocus: true });
            finish('cancel');
          });
        }
      });
    }

    showOpenRecentWorkspaceModal() {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) return;
      const wsMod = this._getWorkspaceStorageMod();
      const list = (wsMod && typeof wsMod.listWorkspaces === 'function') ? wsMod.listWorkspaces() : [];
      this._captureModalReturnFocus();
      const rowsHtml = list.length > 0
        ? list.map((ws) => `
            <button type="button" class="codelab-recent-ws-item" data-cl-workspace="${escapeHtml(ws.labId)}" style="display:flex;width:100%;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--cl-border);border-radius:var(--cl-radius-sm);background:var(--cl-surface);color:var(--cl-fg);cursor:pointer;text-align:left;">
              <span>
                <strong>${escapeHtml(ws.title || ws.labId)}</strong>
                ${ws.labId === this.labId ? '<span style="opacity:0.7;margin-left:6px;">(Current)</span>' : ''}
              </span>
              <code style="font-size:11px;opacity:0.75;">${escapeHtml(ws.labId)}</code>
            </button>
          `).join('')
        : '<p style="margin:0;color:var(--cl-fg-muted);">No saved workspaces found yet.</p>';
      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" data-cl-modal="recent-workspaces" role="dialog" aria-modal="true" aria-labelledby="cl-recent-ws-title" style="max-width:480px;">
            <div class="codelab-modal__header">
              <span id="cl-recent-ws-title">Open Recent Workspace</span>
              <button type="button" class="codelab-btn" data-cl-action="close-modal" aria-label="Close">✕</button>
            </div>
            <div class="codelab-modal__body" style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto;">
              ${rowsHtml}
            </div>
          </div>
        </div>
      `;
      slot.querySelectorAll('[data-cl-workspace]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const targetId = btn.getAttribute('data-cl-workspace');
          this.closeModal({ restoreFocus: false });
          if (targetId) this.switchWorkspace(targetId);
        });
      });
    }

    _updateWorkspaceUrlParam(workspaceId) {
      if (typeof window !== 'undefined' && window.location && window.history && typeof window.history.replaceState === 'function') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('workspace', workspaceId);
          window.history.replaceState(null, '', url.toString());
        } catch (err) {
          void err;
        }
      }
    }

    _updateTopbarBrandTitle() {
      const brandSpan = this.container ? this.container.querySelector('.codelab-brand span:last-child') : null;
      if (brandSpan) {
        brandSpan.textContent = (this.title && this.title !== 'custom-lab' && this.title !== this.labId) ? this.title : 'code-lab';
      }
    }

    _createIsolatedBlankWorkspace(titleOverride) {
      this._saveState({ flushFiles: true });
      const wsMod = this._getWorkspaceStorageMod();
      const nextId = (wsMod && typeof wsMod.createBlankWorkspaceId === 'function')
        ? wsMod.createBlankWorkspaceId()
        : `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      this.labId = nextId;
      this.title = (typeof titleOverride === 'string' && titleOverride.trim()) ? titleOverride.trim() : 'Blank Workspace';
      this.repo = null;
      if (this.options && typeof this.options === 'object') {
        delete this.options.repo;
        this.options.blank = true;
      }
      this._isBlankBase = true;
      this.hasGuidedLab = false;
      this.referenceFiles = {};
      this.storageKey = `${STORAGE_PREFIX}${this.labId}`;
      this.savedState = this._loadState();
      this.settingsTabOpen = false;
      this.activeTab = null;
      if (this._dirtyFiles) this._dirtyFiles.clear();
      if (this._diagnosticsStore && typeof this._diagnosticsStore.clear === 'function') {
        try { this._diagnosticsStore.clear(); } catch (_err) { void _err; }
      }
      this.openTabs = [];
      this.activeFile = null;
      this.setFiles({}, { preserveBlankFlag: true });
      this._restoreSavedGitState({ initialized: false });
      this._renderScmSidebar();
      this._updateWorkspaceUrlParam(nextId);
      this._updateTopbarBrandTitle();
      this._registerWorkspaceMetaInStorage({ kind: 'blank', title: this.title, fileCount: 0 });
      this._saveState({ flushFiles: true });
      this._emitEvent('workspace:switched', { labId: nextId, kind: 'blank' });
      this._showToast(`Created blank workspace (${nextId})`, 'info');
      return nextId;
    }

    _replaceCurrentWithBlankWorkspace(titleOverride) {
      if (typeof titleOverride === 'string' && titleOverride.trim()) {
        this.title = titleOverride.trim();
      }
      this.repo = null;
      if (this.options && typeof this.options === 'object') {
        delete this.options.repo;
        this.options.blank = true;
      }
      this._isBlankBase = true;
      this.hasGuidedLab = false;
      this.referenceFiles = {};
      if (this.labId === this._initialLabId) {
        this._initialReferenceFiles = {};
        this._initialHasGuidedLab = false;
      }
      this.settingsTabOpen = false;
      this.activeTab = null;
      if (this._dirtyFiles) this._dirtyFiles.clear();
      if (this._diagnosticsStore && typeof this._diagnosticsStore.clear === 'function') {
        try { this._diagnosticsStore.clear(); } catch (_err) { void _err; }
      }
      this.openTabs = [];
      this.activeFile = null;
      this.setFiles({}, { preserveBlankFlag: true });
      this._restoreSavedGitState({ initialized: false });
      this._renderScmSidebar();
      this._updateTopbarBrandTitle();
      this._registerWorkspaceMetaInStorage({ kind: 'blank', title: this.title || this.labId, fileCount: 0 });
      this._saveState({ flushFiles: true });
      this._emitEvent('workspace:switched', { labId: this.labId, kind: 'blank', replaced: true });
      this._showToast('Replaced workspace with empty workspace', 'info');
      return this.labId;
    }

    async openBlankWorkspace(opts = {}) {
      const force = Boolean(opts && opts.force);
      const isInteractiveBrowser = Boolean((opts && opts.ui) || this._isRealBrowserDom());
      if (!force && isInteractiveBrowser && this._needsWorkspaceConfirm()) {
        const choice = await this._showWorkspaceConfirmModal({
          title: 'New Blank Workspace',
          message: 'Your current workspace contains files or unsaved edits. Create a new isolated blank workspace (preserving your current work in Recent Workspaces) or replace the current workspace?',
          isolateLabel: 'New Isolated Workspace',
          replaceLabel: 'Replace Current Workspace'
        });
        if (choice === 'cancel') return null;
        if (choice === 'replace') {
          return this._replaceCurrentWithBlankWorkspace(opts && opts.title);
        }
      }
      return this._createIsolatedBlankWorkspace(opts && opts.title);
    }

    newBlankWorkspace(titleOverride) {
      if (titleOverride && typeof titleOverride === 'object') {
        return this.openBlankWorkspace(titleOverride);
      }
      return this._createIsolatedBlankWorkspace(titleOverride);
    }

    async switchWorkspace(targetLabId, opts = {}) {
      const cleanId = String(targetLabId || '').trim();
      if (!cleanId) return false;
      if (cleanId === this.labId && !(opts && opts.forceReload)) return true;
      this._saveState({ flushFiles: true });
      if (this._idbSaveChain) {
        try { await Promise.resolve(this._idbSaveChain); } catch (_err) { void _err; }
      }
      if (this._destroyed) return false;

      const wsMod = this._getWorkspaceStorageMod();
      const meta = (wsMod && typeof wsMod.getWorkspaceMeta === 'function')
        ? wsMod.getWorkspaceMeta(cleanId)
        : null;
      this.labId = cleanId;
      this.storageKey = `${STORAGE_PREFIX}${this.labId}`;
      this.title = (meta && meta.title) ? meta.title : cleanId;
      this.repo = (meta && meta.repo) ? meta.repo : null;
      this.settingsTabOpen = false;
      this.activeTab = null;
      if (this._dirtyFiles) this._dirtyFiles.clear();
      if (this._diagnosticsStore && typeof this._diagnosticsStore.clear === 'function') {
        try { this._diagnosticsStore.clear(); } catch (_err) { void _err; }
      }

      const snap = this._loadState();
      this.savedState = snap || {};

      if (snap && typeof snap.isBlankBase === 'boolean') {
        this._isBlankBase = snap.isBlankBase;
      } else {
        this._isBlankBase = Boolean(
          (meta && meta.kind === 'blank') ||
          cleanId.startsWith('blank-') ||
          cleanId.startsWith('workspace-')
        );
      }
      const guidedForTarget = root.GUIDED_LABS_DATA && root.GUIDED_LABS_DATA[cleanId];
      this.hasGuidedLab = (!this._isBlankBase && !this.repo)
        ? (cleanId === this._initialLabId
            ? Boolean(this._initialHasGuidedLab)
            : Boolean(guidedForTarget && Array.isArray(guidedForTarget.steps) && guidedForTarget.steps.length > 0))
        : false;
      if (this._isBlankBase || this.repo) {
        this.referenceFiles = {};
      } else if (cleanId === this._initialLabId && this._initialReferenceFiles) {
        this.referenceFiles = { ...this._initialReferenceFiles };
      } else {
        const implForTarget = root.IMPLEMENTATIONS_DATA && root.IMPLEMENTATIONS_DATA[cleanId];
        this.referenceFiles = (implForTarget && implForTarget.files && Object.keys(implForTarget.files).length > 0)
          ? { ...implForTarget.files }
          : { ...DEFAULT_STANDALONE_FILES };
      }

      if (snap && (snap.mode === 'guided' || snap.mode === 'sandbox')) {
        this.mode = snap.mode;
      } else {
        this.mode = this.hasGuidedLab ? 'guided' : 'sandbox';
      }
      const snapLang = (snap && (snap.lang === 'js' || snap.lang === 'ts' || snap.lang === 'cpp' || snap.lang === 'py' || snap.lang === 'sql'))
        ? snap.lang
        : null;
      this.lang = snapLang || ((meta && meta.kind === 'sql') ? 'sql' : ((cleanId === this._initialLabId && this._initialLang) ? this._initialLang : 'js'));
      if (this.enabledLanguages instanceof Set) {
        this.enabledLanguages.add(this.lang);
      }
      if (this.contextKeys) {
        this.contextKeys.setContext('workbenchMode', this.mode);
        this.contextKeys.setContext('editorLangId', this.lang);
        this.contextKeys.setContext('isGuidedLab', this.hasGuidedLab);
      }
      if (this.plugins && typeof this.plugins.fireActivationEvent === 'function') {
        this.plugins.fireActivationEvent(`onLanguage:${this.lang}`).catch(() => {});
      }

      const slotKey = `${this.mode}:${this.lang}`;
      let targetFiles = null;
      if (snap && snap.customFiles && typeof snap.customFiles === 'object') {
        if (snap.hasSnapshot && snap.hasSnapshot[slotKey] && snap.customFiles[slotKey] && typeof snap.customFiles[slotKey] === 'object') {
          targetFiles = { ...snap.customFiles[slotKey] };
        } else if (snap.customFiles[slotKey] && Object.keys(snap.customFiles[slotKey]).length > 0) {
          targetFiles = { ...snap.customFiles[slotKey] };
        } else {
          for (const [k, filesObj] of Object.entries(snap.customFiles)) {
            if (filesObj && typeof filesObj === 'object' && (Object.keys(filesObj).length > 0 || (snap.hasSnapshot && snap.hasSnapshot[k]))) {
              targetFiles = { ...filesObj };
              break;
            }
          }
        }
      }
      if (!targetFiles && snap && snap.files && typeof snap.files === 'object') {
        targetFiles = { ...snap.files };
      }
      const loadedFromSnap = targetFiles !== null;
      const snapUpdatedAt = (snap && typeof snap.updatedAt === 'number' && Number.isFinite(snap.updatedAt))
        ? snap.updatedAt
        : 0;

      let loadedFromIdb = false;
      let idbLoadFailed = false;
      if (wsMod && typeof wsMod.createWorkspaceStorage === 'function') {
        try {
          if (!this._idbStorage) {
            this._idbStorage = wsMod.createWorkspaceStorage();
          }
          if (this._idbStorage && typeof this._idbStorage.loadProject === 'function') {
            const proj = await this._idbStorage.loadProject(cleanId);
            if (this._destroyed || this.labId !== cleanId) return false;
            const projFiles = (proj && proj.files && typeof proj.files === 'object') ? proj.files : null;
            const projUpdatedAt = (proj && typeof proj.updatedAt === 'number' && Number.isFinite(proj.updatedAt))
              ? proj.updatedAt
              : 0;
            if (projFiles) {
              const projHasFiles = Object.keys(projFiles).length > 0;
              if (!targetFiles && (projHasFiles || this._isBlankBase)) {
                targetFiles = { ...projFiles };
                loadedFromIdb = true;
              } else if (targetFiles && projHasFiles && projUpdatedAt > snapUpdatedAt) {
                targetFiles = { ...projFiles };
                loadedFromIdb = true;
              }
            }
          }
        } catch (_err) {
          idbLoadFailed = true;
          void _err;
        }
      }
      if (!targetFiles) {
        targetFiles = this._isBlankBase ? {} : this._getBaseFilesForModeAndLang(this.mode, this.lang);
      }

      this.setFiles(targetFiles, {
        preserveBlankFlag: true,
        skipSave: true,
        folders: (snap && Array.isArray(snap.folders)) ? snap.folders : undefined
      });
      if (snap && Array.isArray(snap.openTabs)) {
        const validSavedTabs = snap.openTabs.filter(f => this.files[f] !== undefined);
        if (validSavedTabs.length > 0 || Object.keys(this.files).length === 0) {
          this.openTabs = validSavedTabs;
        }
      }
      if (snap && typeof snap.activeFile === 'string' && this.files[snap.activeFile] !== undefined) {
        this.activeFile = snap.activeFile;
        this.activeTab = snap.activeFile;
      } else if (Object.keys(this.files).length === 0) {
        this.activeFile = null;
        this.activeTab = null;
      }

      this._restoreSavedGitState(snap ? snap.gitState : null);
      if (typeof this._refreshToolbarAndTabs === 'function') {
        this._refreshToolbarAndTabs();
      } else if (typeof this._refreshLanguageSwitcher === 'function') {
        this._refreshLanguageSwitcher();
      }
      if (this.container) {
        this.container.querySelectorAll('[data-cl-lang]').forEach(btn => {
          const isActive = btn.dataset.clLang === this.lang;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-pressed', String(isActive));
        });
        this.container.querySelectorAll('[data-cl-mode]').forEach(btn => {
          const isActive = btn.dataset.clMode === this.mode;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', String(isActive));
        });
        const shell = this.container.querySelector('.codelab');
        if (shell) {
          const isGuideCollapsed = !this.hasGuidedLab || this.mode === 'sandbox' || !this.steps.length;
          shell.classList.toggle('guide-collapsed', isGuideCollapsed);
        }
      }
      this._renderGuidePane();
      this._renderScmSidebar();
      this._syncAllModels();
      this._syncActiveFileToView();
      this._updateWorkspaceUrlParam(cleanId);
      this._updateTopbarBrandTitle();
      this._registerWorkspaceMetaInStorage({ updatedAt: Date.now(), fileCount: Object.keys(this.files).length });

      const hadExpectedSavedData = Boolean(
        meta && (meta.kind === 'repo' || (typeof meta.fileCount === 'number' && meta.fileCount > 0))
      );
      if ((loadedFromIdb && !loadedFromSnap) || (!loadedFromSnap && !loadedFromIdb && (idbLoadFailed || hadExpectedSavedData))) {
        this._buildSavedStateSnapshot({ flushSnapshotOnly: true });
        this.saveStatusState = 'saved';
        this.saveStatusError = null;
        this._updateStatusBar();
      } else {
        this._saveState({ flushSnapshotOnly: true });
      }
      this._emitEvent('workspace:switched', { labId: cleanId });
      this._showToast(`Switched workspace to ${this.title || cleanId}`, 'info');
      return true;
    }

    openCloneDialog(opts) {
      return this.showCloneRepoModal(opts);
    }

    openCloneWorkspaceDialog(opts) {
      return this.showCloneRepoModal(opts);
    }

    promptGoToLine() {
      if (this.editor && typeof this.editor.getAction === 'function') {
        const act = this.editor.getAction('editor.action.gotoLine');
        if (act && typeof act.run === 'function') {
          this.editor.focus();
          act.run();
          return;
        }
      }
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) return;
      this._captureModalReturnFocus();
      const curLn = (this.cursorPos && (this.cursorPos.lineNumber || this.cursorPos.ln)) || 1;
      const curCol = (this.cursorPos && (this.cursorPos.column || this.cursorPos.col)) || 1;
      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-label="Go to Line and Column" style="max-width:380px;">
            <div class="codelab-modal__header">
              <span>Go to Line/Column</span>
              <button type="button" class="codelab-btn" data-cl-action="close-modal">Close</button>
            </div>
            <div class="codelab-modal__body">
              <form id="cl-goto-line-form" style="display:flex;gap:8px;align-items:center;">
                <input id="cl-goto-line-input" class="codelab-modal-input" type="text" value="${curLn}:${curCol}" placeholder="line[:column]" aria-label="Line and optional column" />
                <button type="submit" class="codelab-btn codelab-btn--primary">Go</button>
              </form>
            </div>
          </div>
        </div>
      `;
      const form = slot.querySelector('#cl-goto-line-form');
      const input = slot.querySelector('#cl-goto-line-input');
      if (input && typeof input.focus === 'function') {
        input.focus();
        if (typeof input.select === 'function') input.select();
      }
      if (form && input) {
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const parts = String(input.value || '').split(':');
          const ln = Math.max(1, parseInt(parts[0], 10) || 1);
          const col = Math.max(1, parseInt(parts[1], 10) || 1);
          this.closeModal();
          if (this.editor && typeof this.editor.setPosition === 'function') {
            this.cursorPos = { lineNumber: ln, column: col, ln, col };
            this.editor.revealLineInCenter(ln);
            this.editor.setPosition({ lineNumber: ln, column: col });
            this.editor.focus();
          } else if (this.container) {
            const sqlHost = this.container.querySelector('#cl-sql-editor-host');
            const sqlTa = (sqlHost && sqlHost.style && sqlHost.style.display !== 'none')
              ? sqlHost.querySelector('.cl-sql-textarea')
              : null;
            const fb = sqlTa || this.container.querySelector('#cl-fallback-editor');
            if (fb && typeof fb.value === 'string') {
              const lines = fb.value.split('\n');
              const clampedLn = Math.min(Math.max(1, ln), Math.max(1, lines.length));
              let offset = 0;
              for (let i = 0; i < clampedLn - 1; i++) {
                offset += lines[i].length + 1;
              }
              const lineText = lines[clampedLn - 1] || '';
              const clampedCol = Math.min(Math.max(1, col), lineText.length + 1);
              const pos = offset + (clampedCol - 1);
              this.cursorPos = { lineNumber: clampedLn, column: clampedCol, ln: clampedLn, col: clampedCol };
              if (typeof fb.focus === 'function') fb.focus();
              if (typeof fb.setSelectionRange === 'function') {
                try { fb.setSelectionRange(pos, pos); } catch (_err) { void _err; }
              } else {
                fb.selectionStart = pos;
                fb.selectionEnd = pos;
              }
              const lineHeightPx = parseFloat((fb.style && fb.style.lineHeight) || '') || 20;
              const nextScroll = Math.max(0, (clampedLn - 3) * lineHeightPx);
              fb.scrollTop = nextScroll;
              const gutterEl = this.container.querySelector('#cl-fallback-gutter');
              if (gutterEl && fb.id === 'cl-fallback-editor') gutterEl.scrollTop = nextScroll;
            } else {
              this.cursorPos = { lineNumber: ln, column: col, ln, col };
            }
          } else {
            this.cursorPos = { lineNumber: ln, column: col, ln, col };
          }
          this._updateStatusBar();
          this._renderBreadcrumbs();
        });
      }
    }

    showKeyboardShortcutsReference() {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) return;
      this._captureModalReturnFocus();
      const rows = [
        ['Show All Commands', '⇧⌘P / F1'],
        ['Go to File', '⌘P'],
        ['Save Active File', '⌘S / Ctrl+S'],
        ['Open Settings', '⌘, / Ctrl+,'],
        ['Toggle Primary Side Bar', '⌘B / Ctrl+B'],
        ['Toggle Panel', '⌘J / Ctrl+J'],
        ['Toggle Terminal', '⌃`'],
        ['New Terminal', '⌃⇧`'],
        ['Focus Explorer', '⇧⌘E'],
        ['Search in Files', '⇧⌘F'],
        ['Source Control', '⌃⇧G'],
        ['Show Problems', '⇧⌘M'],
        ['Run Code', '⌘↵']
      ];
      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">
            <div class="codelab-modal__header">
              <span>Keyboard Shortcuts</span>
              <button type="button" class="codelab-btn" data-cl-action="close-modal">Close (Esc)</button>
            </div>
            <div class="codelab-modal__body">
              <div style="display:grid;grid-template-columns:1fr auto;gap:6px 16px;font-size:12px;">
                ${rows.map(([label, kbd]) => `<span>${escapeHtml(label)}</span><kbd style="font-family:var(--cl-font-mono);">${escapeHtml(kbd)}</kbd>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
      const closeBtn = slot.querySelector('[data-cl-action="close-modal"]');
      if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
    }

    showAboutModal() {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) return;
      this._captureModalReturnFocus();
      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-label="About CodeLab" style="max-width:420px;">
            <div class="codelab-modal__header">
              <span>About CodeLab</span>
              <button type="button" class="codelab-btn" data-cl-action="close-modal">Close (Esc)</button>
            </div>
            <div class="codelab-modal__body" style="font-size:13px;line-height:1.5;">
              <p style="margin:0 0 8px;"><strong>@innovatorved/code-lab</strong> — Full-featured in-browser IDE &amp; runtime workbench.</p>
              <p style="margin:0;color:var(--cl-fg-muted);font-size:12px;">Node.js v22 Worker · TypeScript 5.x · C++20 WASI · Python 3.12 WASI · SQLite / PostgreSQL</p>
            </div>
          </div>
        </div>
      `;
      const closeBtn = slot.querySelector('[data-cl-action="close-modal"]');
      if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
    }

    _clearTerminalLogs() {
      const fresh = [];
      this.terminalLogs = fresh;
      if (Array.isArray(this._terminalSessions)) {
        const active = this._terminalSessions.find((s) => s.id === this._activeTerminalSessionId);
        if (active) {
          active.logs = fresh;
        }
      }
    }

    _renderTerminalSessionsBar() {
      if (!this.container || typeof this.container.querySelector !== 'function') return;
      const bar = this.container.querySelector('#cl-terminal-sessions');
      if (!bar) return;
      const sessions = this._ensureTerminalSessions();
      if (sessions.length === 0) {
        bar.innerHTML = '';
        return;
      }
      bar.innerHTML = sessions.map((s) => {
        const isActive = s.id === this._activeTerminalSessionId;
        return `
          <span class="codelab-session-pill ${isActive ? 'active' : ''}" data-cl-action="switch-terminal-session" data-session-id="${escapeHtml(s.id)}" role="button" tabindex="0" aria-pressed="${isActive}" title="Switch to ${escapeHtml(s.name)}">
            <span>${escapeHtml(s.name)}</span>
            <span data-cl-action="close-terminal-session" data-session-id="${escapeHtml(s.id)}" role="button" tabindex="0" title="Close ${escapeHtml(s.name)}" aria-label="Close ${escapeHtml(s.name)}" style="margin-left:2px;opacity:0.75;">&times;</span>
          </span>
        `;
      }).join('');
    }

    _saveActiveTerminalSessionState() {
      if (!Array.isArray(this._terminalSessions)) return;
      const active = this._terminalSessions.find((s) => s.id === this._activeTerminalSessionId);
      if (!active) return;
      active.cwd = this.cwd || (this.shell && this.shell.cwd) || '/workspace';
      active.inRepl = Boolean(this.inRepl);
      active.replLang = this.replLang || 'node';
      active.replHistory = Array.isArray(this.replHistory) ? this.replHistory.slice() : [];
      active.replHistoryIdx = typeof this.replHistoryIdx === 'number' ? this.replHistoryIdx : -1;
      active.beforeCursor = this._ptyInputBeforeCursor || '';
      active.afterCursor = this._ptyInputAfterCursor || '';
      if (Array.isArray(this.terminalLogs)) {
        active.logs = this.terminalLogs;
      }
    }

    _applyTerminalSessionState(target) {
      if (!target) return;
      this._activeTerminalSessionId = target.id;
      if (!Array.isArray(target.logs)) target.logs = [];
      this.terminalLogs = target.logs;
      this.cwd = target.cwd || '/workspace';
      if (this.shell) {
        this.shell.cwd = this.cwd;
        if (this.shell.env && typeof this.shell.env === 'object') {
          this.shell.env.PWD = this.cwd;
        }
      }
      this.inRepl = Boolean(target.inRepl);
      this.replLang = target.replLang || 'node';
      this.replHistory = Array.isArray(target.replHistory) ? target.replHistory.slice() : [];
      this.replHistoryIdx = typeof target.replHistoryIdx === 'number' ? target.replHistoryIdx : -1;
      this._ptyInputBeforeCursor = target.beforeCursor || '';
      this._ptyInputAfterCursor = target.afterCursor || '';
    }

    _ensureTerminalSessions() {
      if (!Array.isArray(this._terminalSessions) || this._terminalSessions.length === 0) {
        this._terminalSessions = [
          {
            id: 'session-1',
            name: 'bash-1',
            cwd: this.cwd || (this.shell && this.shell.cwd) || '/workspace',
            logs: Array.isArray(this.terminalLogs) ? this.terminalLogs : (this.terminalLogs = []),
            inRepl: Boolean(this.inRepl),
            replLang: this.replLang || 'node',
            replHistory: Array.isArray(this.replHistory) ? this.replHistory.slice() : [],
            replHistoryIdx: typeof this.replHistoryIdx === 'number' ? this.replHistoryIdx : -1,
            beforeCursor: this._ptyInputBeforeCursor || '',
            afterCursor: this._ptyInputAfterCursor || ''
          }
        ];
        this._activeTerminalSessionId = 'session-1';
      }
      return this._terminalSessions;
    }

    listTerminalSessions() {
      this._saveActiveTerminalSessionState();
      const sessions = this._ensureTerminalSessions();
      return sessions.map((s) => ({
        id: s.id,
        name: s.name,
        cwd: s.cwd || '/workspace',
        inRepl: Boolean(s.inRepl),
        active: s.id === this._activeTerminalSessionId,
        logCount: Array.isArray(s.logs) ? s.logs.length : 0
      }));
    }

    createTerminalSession(name) {
      const sessions = this._ensureTerminalSessions();
      this._saveActiveTerminalSessionState();
      const nextNum = sessions.length + 1;
      const id = `session-${Date.now()}-${nextNum}`;
      const label = name ? String(name).trim() : `bash-${nextNum}`;
      const newSession = {
        id,
        name: label,
        cwd: '/workspace',
        logs: [],
        inRepl: false,
        replLang: 'node',
        replHistory: [],
        replHistoryIdx: -1,
        beforeCursor: '',
        afterCursor: ''
      };
      sessions.push(newSession);
      this._applyTerminalSessionState(newSession);
      this._renderDrawerBody();
      return id;
    }

    switchTerminalSession(id) {
      const sessions = this._ensureTerminalSessions();
      const target = sessions.find((s) => s.id === id || s.name === id);
      if (!target) return false;
      if (target.id !== this._activeTerminalSessionId) {
        this._saveActiveTerminalSessionState();
        this._applyTerminalSessionState(target);
      }
      this._renderDrawerBody();
      return true;
    }

    closeTerminalSession(id) {
      const sessions = this._ensureTerminalSessions();
      const idx = id
        ? sessions.findIndex((s) => s.id === id || s.name === id)
        : sessions.findIndex((s) => s.id === this._activeTerminalSessionId);
      if (idx === -1) return false;

      if (sessions.length === 1) {
        if (this._activeCommandAbortController) {
          try { this._activeCommandAbortController.abort(); } catch (_err) { void _err; }
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        const freshSession = {
          id: 'session-1',
          name: 'bash-1',
          cwd: '/workspace',
          logs: [],
          inRepl: false,
          replLang: 'node',
          replHistory: [],
          replHistoryIdx: -1,
          beforeCursor: '',
          afterCursor: ''
        };
        sessions[0] = freshSession;
        this._applyTerminalSessionState(freshSession);
        if (typeof this._updateRunStateUI === 'function') {
          this._updateRunStateUI();
        }
        this._renderDrawerBody();
        return true;
      }

      this._saveActiveTerminalSessionState();
      const removed = sessions.splice(idx, 1)[0];
      if (this._activeTerminalSessionId === removed.id) {
        if (this._activeCommandAbortController) {
          try { this._activeCommandAbortController.abort(); } catch (_err) { void _err; }
          this._activeCommandAbortController = null;
          this.isRunning = false;
          if (typeof this._updateRunStateUI === 'function') {
            this._updateRunStateUI();
          }
        }
        const next = sessions[Math.max(0, idx - 1)] || sessions[0];
        this._applyTerminalSessionState(next);
      }
      this._renderDrawerBody();
      return true;
    }

    getFiles() {
      return { ...this.files };
    }

    setFiles(filesMap, opts = {}) {
      if (!filesMap || typeof filesMap !== 'object') return;
      this._userEditSeq = (this._userEditSeq || 0) + 1;
      if (this._fallbackHistory) this._fallbackHistory.clear();
      for (const model of this.models.values()) {
        try { model.dispose(); } catch (err) { this.logger.debug('model.dispose failed during setFiles.', err); }
      }
      this.models.clear();
      this.files = {};
      this.folders = new Set();
      for (const [rawPath, content] of Object.entries(filesMap)) {
        const clean = String(rawPath).trim().replace(/^\/+/, '');
        if (!clean) continue;
        this.files[clean] = String(content ?? '');
        const parts = clean.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      }
      if (opts && Array.isArray(opts.folders)) {
        for (const rawFolder of opts.folders) {
          const cf = this._normalizeWorkspaceRelPath(rawFolder);
          if (!cf) continue;
          const parts = cf.split('/');
          let cur = '';
          for (let i = 0; i < parts.length; i++) {
            cur = cur ? `${cur}/${parts[i]}` : parts[i];
            this.folders.add(cur);
          }
        }
      }
      this._savedSnapshot = { ...this.files };
      if (this._dirtyFiles) {
        for (const df of Array.from(this._dirtyFiles)) {
          if (this.files[df] === undefined) this._dirtyFiles.delete(df);
        }
      }
      const ordered = this._orderedFileNames();
      if (ordered.length === 0) {
        this.openTabs = [];
        this.activeFile = null;
        this.activeTab = this.settingsTabOpen && this.activeTab === '__settings__' ? '__settings__' : null;
      } else if (ordered.length > 8) {
        const primary = this._pickPrimaryCloneFile(ordered);
        this.openTabs = primary ? [primary] : [ordered[0]];
        if (!this.activeFile || this.files[this.activeFile] === undefined || !this.openTabs.includes(this.activeFile)) {
          this.activeFile = this.openTabs[0] || null;
        }
        this.activeTab = this.settingsTabOpen && this.activeTab === '__settings__' ? '__settings__' : this.activeFile;
      } else {
        this.openTabs = ordered;
        if (!this.activeFile || this.files[this.activeFile] === undefined) {
          this.activeFile = this._pickDefaultFile() || ordered[0] || null;
        }
        this.activeTab = this.settingsTabOpen && this.activeTab === '__settings__' ? '__settings__' : this.activeFile;
      }
      this._syncFilesToShellVfs({ pruneExtraneous: true, keepGitDir: Boolean(opts && opts.keepGitDir) });
      if (!(opts && opts.skipSave)) {
        this._saveState({ flushFiles: true });
      }
      if (this._diagnosticsStore && typeof this._diagnosticsStore.getAll === 'function' && typeof this._diagnosticsStore.remove === 'function') {
        const stale = this._diagnosticsStore.getAll().filter((d) => d && d.file && !Object.prototype.hasOwnProperty.call(this.files, d.file));
        if (stale.length > 0) {
          const pruneFn = () => {
            for (const d of stale) {
              if (d && d.id) this._diagnosticsStore.remove(d.id);
            }
          };
          if (typeof this._diagnosticsStore.batch === 'function') {
            this._diagnosticsStore.batch(pruneFn);
          } else {
            pruneFn();
          }
        }
      }
      this._syncDotCodelabConfig({ isInitialMount: false });
      this._syncAllModels();
      this._lintAllWorkspaceFiles();
      this._syncActiveFileToView();
    }

    getFile(path) {
      const clean = String(path || '').trim().replace(/^\/+/, '');
      return this.files ? this.files[clean] : undefined;
    }

    setFile(path, content, options = {}) {
      const clean = String(path || '').trim().replace(/^\/+/, '');
      if (!clean) return;
      this._userEditSeq = (this._userEditSeq || 0) + 1;
      const isNew = this.files[clean] === undefined;
      const parts = clean.split('/');
      for (let i = 1; i < parts.length; i++) {
        this.folders.add(parts.slice(0, i).join('/'));
      }
      this.files[clean] = String(content ?? '');
      if (options.open !== false && Array.isArray(this.openTabs) && !this.openTabs.includes(clean)) {
        this.openTabs.push(clean);
      }
      if (options.open === true) {
        this.activeFile = clean;
        this.activeTab = clean;
      }
      this._saveState();
      this._getOrCreateModel(clean);
      if (isNew) {
        this._emitEvent('codelab:file-create', { labId: this.labId, filename: clean, content: this.files[clean] });
      }
      this._notifyCodeChange(clean, this.files[clean]);
      this._syncActiveFileToView();
    }

    toggleMarkdownPreview(force) {
      this._mdPreviewOpen = typeof force === 'boolean' ? force : !this._mdPreviewOpen;
      this._syncActiveFileToView();
      if (!this._mdPreviewOpen) {
        if (this.editor && typeof this.editor.focus === 'function') {
          this.editor.focus();
        } else if (this.container) {
          const fb = this.container.querySelector('#cl-fallback-editor');
          if (fb && typeof fb.focus === 'function') fb.focus();
        }
      }
      return this._mdPreviewOpen;
    }

    _toggleMarkdownTask(filename, targetTaskIdx, newCheckedState) {
      const clean = String(filename || '').trim().replace(/^\/+/, '');
      let content = this.files[clean] || '';

      // Mask fenced code blocks so code snippets don't falsely increment task index
      const codeFenceBlocks = [];
      const maskedContent = content.replace(/(?:^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n?\1[ \t]*(?=\n|$)/g, (m) => {
        const id = codeFenceBlocks.length;
        codeFenceBlocks.push(m);
        return `\x00MASKED_CODE_${id}\x00`;
      });

      let currentIdx = 0;
      const updatedMasked = maskedContent.replace(/^([ \t]*(?:[-*+]|\d+\.)[ \t]+\[)([ xX])(\][ \t]+.*)$/gm, (match, prefix, state, suffix) => {
        if (currentIdx === targetTaskIdx) {
          currentIdx++;
          return `${prefix}${newCheckedState ? 'x' : ' '}${suffix}`;
        }
        currentIdx++;
        return match;
      });

      const updated = updatedMasked.replace(/\x00MASKED_CODE_(\d+)\x00/g, (_, i) => codeFenceBlocks[Number(i)]);

      if (updated !== content) {
        this.files[clean] = updated;
        this._saveState();
        const model = this._getOrCreateModel(clean);
        if (model && typeof model.setValue === 'function' && model.getValue() !== updated) {
          model.setValue(updated);
        }
        const fallbackEl = this.container ? this.container.querySelector('#cl-fallback-editor') : null;
        if (fallbackEl && this.activeFile === clean) {
          fallbackEl.value = updated;
        }
        if (this.shell && this.shell.vfs && (typeof this.shell.vfs.writeFileSync === 'function' || typeof this.shell.vfs.writeFile === 'function')) {
          try {
            if (typeof this.shell.vfs.writeFileSync === 'function') {
              this.shell.vfs.writeFileSync('/workspace/' + clean, updated);
            } else {
              this.shell.vfs.writeFile('/workspace/' + clean, updated);
            }
          } catch (err) {
            this.logger.warn(`Failed to sync markdown task toggle for "${clean}" to VFS.`, err);
          }
        }
        this._notifyCodeChange(clean, updated);
      }
    }

    getOpenTabs() {
      return Array.isArray(this.openTabs) ? [...this.openTabs] : [];
    }

    cancelClone() {
      const wasInFlight = Boolean(this._cloneInFlight || this._activeCloneAbortController);
      this._cloneCancelledByUser = true;
      if (this._activeCloneAbortController) {
        try {
          this._activeCloneAbortController.abort('Cancelled by user');
        } catch (_err) {
          void _err;
        }
        this._activeCloneAbortController = null;
      }
      this._cloneInFlight = false;
      return wasInFlight;
    }

    _parseSafeGitHubRepo(rawInput, branchOverride = '') {
      if (!parseGitHubRepoUrl || typeof rawInput !== 'string') return null;
      const raw = rawInput.trim();
      if (!raw) return null;
      if (/[\x00-\x1f\x7f\\\s]/.test(raw) || /%(?:2e|2f|5c|00)/i.test(raw)) return null;
      const strippedProto = raw.replace(/^https?:\/\//i, '');
      const rawSegs = strippedProto.split(/[/:@#?]/);
      for (const seg of rawSegs) {
        if (seg === '.' || seg === '..') return null;
      }

      const parsed = parseGitHubRepoUrl(raw);
      if (!parsed || typeof parsed.owner !== 'string' || typeof parsed.repo !== 'string') return null;

      const isValidSlug = (s, isOwner) => {
        if (!s || s.length > 100) return false;
        if (s === '.' || s === '..' || s.startsWith('.') || s.endsWith('.')) return false;
        if (isOwner && (s.startsWith('-') || s.endsWith('-'))) return false;
        if (s.includes('..') || s.includes('/') || s.includes('\\') || s.includes('\0')) return false;
        return /^[A-Za-z0-9_.-]+$/.test(s);
      };
      if (!isValidSlug(parsed.owner, true) || !isValidSlug(parsed.repo, false)) return null;

      const isSafeRefOrSubpath = (val, isRef) => {
        if (val === null || val === undefined || val === '') return true;
        if (typeof val !== 'string') return false;
        const t = val.trim();
        if (!t) return true;
        if (/[\x00-\x1f\x7f\\]/.test(t) || /%(?:2e|2f|5c|00)/i.test(t)) return false;
        if (t.includes('..') || t.startsWith('/') || t.endsWith('/') || t.includes('//')) return false;
        if (isRef && (t.startsWith('-') || t.startsWith('.') || t.endsWith('.') || t.endsWith('.lock') || /\s|[~^:?*[\]@{]/.test(t))) {
          return false;
        }
        for (const seg of t.split('/')) {
          if (!seg || seg === '.' || seg === '..') return false;
        }
        return true;
      };

      if (!isSafeRefOrSubpath(parsed.branch, true)) return null;
      if (!isSafeRefOrSubpath(parsed.subpath, false)) return null;
      if (!isSafeRefOrSubpath(branchOverride, true)) return null;
      return parsed;
    }

    showCloneRepoModal(initialOpts = {}) {
      const slot = this.container ? this.container.querySelector('#cl-modal-slot') : null;
      if (!slot) return;
      if (initialOpts && initialOpts.returnFocusEl) {
        this._modalReturnFocusEl = initialOpts.returnFocusEl;
      } else if (!initialOpts || !initialOpts.skipReturnFocusCapture) {
        this._captureModalReturnFocus();
      }
      const presetRepo = (initialOpts && typeof initialOpts.repo === 'string') ? initialOpts.repo : '';
      const presetBranch = (initialOpts && typeof initialOpts.branch === 'string') ? initialOpts.branch : '';

      slot.innerHTML = `
        <div class="codelab-modal-backdrop" data-cl-backdrop="clone-repo">
          <div class="codelab-modal codelab-clone-modal" data-cl-modal="clone-repo" role="dialog" aria-modal="true" aria-labelledby="cl-clone-modal-title" aria-describedby="cl-clone-modal-desc" style="max-width:520px;">
            <div class="codelab-modal__header">
              <span id="cl-clone-modal-title" style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.gitBranch || CL_ICONS.terminal || CL_ICONS.folder}<span>Clone Public GitHub Repository</span></span>
              <button type="button" class="codelab-btn" id="cl-clone-close-btn" data-cl-action="close-modal" aria-label="Close">✕</button>
            </div>
            <div class="codelab-modal__body" style="font-family:var(--cl-font-sans);">
              <p id="cl-clone-modal-desc" style="margin:0 0 12px;font-size:12.5px;color:var(--cl-fg-muted);line-height:1.45;">
                Enter a public GitHub repository URL or <code>owner/repo</code> slug. Files are cloned transactionally into the Virtual Filesystem (VFS).
              </p>
              <form id="cl-clone-repo-form" class="codelab-clone-form" novalidate>
                <div class="codelab-clone-field">
                  <label for="cl-clone-repo-input" class="codelab-clone-label">Repository URL or owner/repo</label>
                  <input id="cl-clone-repo-input" name="repo" type="text" value="${escapeHtml(presetRepo)}" placeholder="e.g. octocat/Hello-World or https://github.com/owner/repo" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" aria-invalid="false" class="codelab-clone-input" />
                </div>
                <div class="codelab-clone-field" style="margin-top:10px;">
                  <label for="cl-clone-branch-input" class="codelab-clone-label">Branch / Tag (optional)</label>
                  <input id="cl-clone-branch-input" name="branch" type="text" value="${escapeHtml(presetBranch)}" placeholder="Default branch (e.g. main)" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" aria-invalid="false" class="codelab-clone-input" />
                </div>
                <div id="cl-clone-error-banner" class="codelab-clone-error" role="alert" hidden></div>
                <div id="cl-clone-progress-wrap" class="codelab-clone-progress" role="progressbar" aria-label="Cloning repository" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>
                  <div class="codelab-clone-progress__bar"><div class="codelab-clone-progress__fill" id="cl-clone-progress-fill" style="width:12%;"></div></div>
                  <div class="codelab-clone-progress__status" id="cl-clone-progress-text" aria-live="polite">Connecting to GitHub...</div>
                </div>
                <div class="codelab-modal__footer codelab-clone-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
                  <button type="button" class="codelab-btn" id="cl-clone-cancel-btn" data-cl-action="close-modal">Cancel</button>
                  <button type="submit" class="codelab-btn codelab-btn--primary" id="cl-clone-submit-btn">Clone Repository</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      const form = slot.querySelector('#cl-clone-repo-form');
      const repoInputEl = slot.querySelector('#cl-clone-repo-input');
      const branchInputEl = slot.querySelector('#cl-clone-branch-input');
      const errBanner = slot.querySelector('#cl-clone-error-banner');
      const progWrap = slot.querySelector('#cl-clone-progress-wrap');
      const progFill = slot.querySelector('#cl-clone-progress-fill');
      const progText = slot.querySelector('#cl-clone-progress-text');
      const cancelBtn = slot.querySelector('#cl-clone-cancel-btn');
      const closeBtn = slot.querySelector('#cl-clone-close-btn');
      const submitBtn = slot.querySelector('#cl-clone-submit-btn');

      const setError = (msg, targetEl = null) => {
        if (!errBanner || !repoInputEl) return;
        if (!msg) {
          errBanner.hidden = true;
          errBanner.textContent = '';
          repoInputEl.setAttribute('aria-invalid', 'false');
          repoInputEl.removeAttribute('aria-describedby');
          if (branchInputEl) {
            branchInputEl.setAttribute('aria-invalid', 'false');
            branchInputEl.removeAttribute('aria-describedby');
          }
        } else {
          errBanner.textContent = String(msg);
          errBanner.hidden = false;
          const invalidTarget = targetEl || repoInputEl;
          if (invalidTarget === branchInputEl && branchInputEl) {
            repoInputEl.setAttribute('aria-invalid', 'false');
            repoInputEl.removeAttribute('aria-describedby');
            branchInputEl.setAttribute('aria-invalid', 'true');
            branchInputEl.setAttribute('aria-describedby', 'cl-clone-error-banner');
          } else {
            repoInputEl.setAttribute('aria-invalid', 'true');
            repoInputEl.setAttribute('aria-describedby', 'cl-clone-error-banner');
            if (branchInputEl) {
              branchInputEl.setAttribute('aria-invalid', 'false');
              branchInputEl.removeAttribute('aria-describedby');
            }
          }
        }
      };

      const setInFlightUi = (inFlight) => {
        if (repoInputEl) repoInputEl.disabled = inFlight;
        if (branchInputEl) branchInputEl.disabled = inFlight;
        if (submitBtn) {
          submitBtn.disabled = inFlight;
          submitBtn.textContent = inFlight ? 'Cloning...' : 'Clone Repository';
        }
        if (progWrap) {
          progWrap.hidden = !inFlight;
        }
        if (cancelBtn) {
          cancelBtn.setAttribute('data-cl-action', inFlight ? 'cancel-clone' : 'close-modal');
          cancelBtn.textContent = inFlight ? 'Cancel Clone' : 'Cancel';
        }
        if (closeBtn) {
          closeBtn.setAttribute('data-cl-action', inFlight ? 'cancel-clone' : 'close-modal');
        }
      };

      const executeModalClone = async (repoVal, branchVal, resolution) => {
        setError('');
        setInFlightUi(true);
        try {
          await this.cloneRepo(repoVal, {
            intoRoot: true,
            branch: branchVal || undefined,
            force: true,
            isolate: resolution === 'isolated',
            replace: resolution === 'replace',
            onProgress: (info) => {
              if (!progWrap || progWrap.hidden) return;
              const done = Number((info && (info.completed ?? info.done ?? info.loaded)) || 0);
              const total = Number((info && (info.total ?? info.count)) || 0);
              const pct = total > 0 ? Math.min(98, Math.max(10, Math.round((done / total) * 100))) : 35;
              progWrap.setAttribute('aria-valuenow', String(pct));
              if (progFill) progFill.style.width = `${pct}%`;
              if (progText) {
                const fileLabel = (info && (info.path || info.file)) ? ` — ${info.path || info.file}` : '';
                progText.textContent = total > 0
                  ? `Downloading files (${done}/${total})${fileLabel}`
                  : `Fetching repository tree${fileLabel}...`;
              }
            }
          });
          if (!this._cloneCancelledByUser) {
            this.closeModal({ restoreFocus: false });
          }
        } catch (err) {
          if (this._cloneCancelledByUser) {
            return;
          }
          setInFlightUi(false);
          const msg = err && err.message ? err.message : String(err);
          setError(msg);
          if (repoInputEl && typeof repoInputEl.focus === 'function') {
            repoInputEl.focus();
          }
        }
      };

      this._submitCloneModal = async () => {
        if (this._cloneInFlight) return;
        const repoVal = repoInputEl ? repoInputEl.value.trim() : '';
        const branchVal = branchInputEl ? branchInputEl.value.trim() : '';
        if (!repoVal) {
          setError('Please enter a GitHub repository URL or owner/repo slug (for example, octocat/Hello-World).');
          if (repoInputEl) repoInputEl.focus();
          return;
        }
        const parsed = this._parseSafeGitHubRepo(repoVal, branchVal);
        if (!parsed) {
          const badBranchOnly = Boolean(branchVal && this._parseSafeGitHubRepo(repoVal, '') && !this._parseSafeGitHubRepo(repoVal, branchVal));
          const targetInput = badBranchOnly && branchInputEl ? branchInputEl : repoInputEl;
          setError(
            badBranchOnly
              ? `Invalid branch or tag "${branchVal}". Branch names cannot contain ".." or invalid ref characters.`
              : `Invalid GitHub repository "${repoVal}". Enter a valid https://github.com/owner/repo URL or owner/repo slug.`,
            targetInput
          );
          if (targetInput && typeof targetInput.focus === 'function') targetInput.focus();
          return;
        }
        setError('');
        let resolution = 'replace';
        if (this._needsWorkspaceConfirm()) {
          const savedReturnFocus = this._modalReturnFocusEl || null;
          const choice = await this._showWorkspaceConfirmModal({
            title: 'Clone Repository Into Workspace',
            message: `Your current workspace contains files or unsaved edits. Clone "${parsed.owner}/${parsed.repo}" into a new isolated workspace or replace the current workspace?`,
            isolateLabel: 'New Isolated Workspace',
            replaceLabel: 'Replace Current Workspace'
          });
          if (choice === 'cancel') {
            this.showCloneRepoModal({ repo: repoVal, branch: branchVal, skipReturnFocusCapture: true, returnFocusEl: savedReturnFocus });
            return;
          }
          resolution = choice;
          this.showCloneRepoModal({ repo: repoVal, branch: branchVal, skipReturnFocusCapture: true, returnFocusEl: savedReturnFocus });
          const nextSubmit = this._activeCloneModalExecute;
          if (typeof nextSubmit === 'function') {
            await nextSubmit(repoVal, branchVal, resolution);
          }
          return;
        }
        await executeModalClone(repoVal, branchVal, resolution);
      };
      this._activeCloneModalExecute = executeModalClone;

      if (repoInputEl) {
        repoInputEl.addEventListener('input', () => {
          if (errBanner && !errBanner.hidden) {
            setError('');
          }
        });
        repoInputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            if (this._cloneInFlight) this.cancelClone();
            this.closeModal();
          }
        });
        if (!initialOpts || initialOpts.autoFocus !== false) {
          repoInputEl.focus();
        }
      }
      if (branchInputEl) {
        branchInputEl.addEventListener('input', () => {
          if (errBanner && !errBanner.hidden) {
            setError('');
          }
        });
        branchInputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            if (this._cloneInFlight) this.cancelClone();
            this.closeModal();
          }
        });
      }
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this._submitCloneModal();
        });
      }
    }

    async cloneRepo(repoInput, options = {}) {
      if (!parseGitHubRepoUrl || !cloneGitHubRepository) {
        throw new Error('CodeLabShell GitHub clone engine is not loaded');
      }
      const cleanInput = String(repoInput || '').trim();
      const branchOpt = (options && options.branch !== undefined && options.branch !== null) ? String(options.branch) : '';
      const parsed = this._parseSafeGitHubRepo(cleanInput, branchOpt);
      if (!parsed) {
        const errMsg = `fatal: repository '${cleanInput}' does not exist or is not a valid GitHub repository URL`;
        this._pushTerminalLog({ type: 'stderr', text: errMsg });
        this._renderDrawerBody();
        throw new Error(errMsg);
      }

      const intoRoot = options.intoRoot !== false;
      let shouldIsolate = Boolean(options && options.isolate);
      const isInteractiveBrowser = Boolean(
        options &&
        options.confirm === true &&
        !options.force &&
        intoRoot &&
        this._isRealBrowserDom()
      );
      if (isInteractiveBrowser && this._needsWorkspaceConfirm()) {
        const choice = await this._showWorkspaceConfirmModal({
          title: 'Clone Repository Into Workspace',
          message: `Your current workspace contains files or unsaved edits. Clone "${parsed.owner}/${parsed.repo}" into a new isolated workspace or replace the current workspace?`,
          isolateLabel: 'New Isolated Workspace',
          replaceLabel: 'Replace Current Workspace'
        });
        if (choice === 'cancel') {
          const cancelErr = new Error('Clone cancelled by user');
          cancelErr.name = 'AbortError';
          throw cancelErr;
        }
        shouldIsolate = choice === 'isolated';
      }

      if (!this.shell) {
        this._initShell();
      }

      const targetDir = intoRoot ? '/workspace' : `/workspace/${parsed.repo}`;
      const cmdDisplay = `git clone ${cleanInput}${intoRoot ? ' .' : ''}`;
      this.drawerTab = 'terminal';
      this._pushTerminalLog({ type: 'cmd', text: cmdDisplay });
      this.isRunning = true;
      this._cloneInFlight = true;
      this._cloneCancelledByUser = false;
      const abortCtrl = new AbortController();
      this._activeCloneAbortController = abortCtrl;
      this._activeCommandAbortController = abortCtrl;
      if (options.signal && typeof options.signal.addEventListener === 'function') {
        if (options.signal.aborted) {
          this._cloneCancelledByUser = true;
          abortCtrl.abort();
        } else {
          options.signal.addEventListener('abort', () => {
            this._cloneCancelledByUser = true;
            abortCtrl.abort();
          }, { once: true });
        }
      }
      this._renderDrawerBody();
      this._updateRunStateUI();

      // Transactional Staging VFS: NEVER mutate live workspace files/VFS/gitState until clone succeeds 100%
      const stagingShell = typeof createPosixShell === 'function'
        ? createPosixShell({ cwd: '/workspace', files: {} })
        : null;
      const stagingVfs = (stagingShell && stagingShell.vfs) ? stagingShell.vfs : this.shell.vfs;

      const baseFetch = options.fetchImpl
        || (this.shell && this.shell.options && this.shell.options.fetchImpl)
        || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

      let failedBlobs = 0;
      let blobAbortError = null;
      const wrappedFetch = baseFetch ? async (url, init = {}) => {
        const urlStr = String(url || '');
        const isJsDelivrFallback = urlStr.includes('cdn.jsdelivr.net/gh/');
        try {
          const res = await baseFetch(url, { ...init, signal: abortCtrl.signal });
          if (isJsDelivrFallback && (!res || !res.ok)) {
            failedBlobs++;
            blobAbortError = new Error(`Network error while downloading repository blob (${res ? res.status : 'failed'}). Workspace rolled back cleanly.`);
            try { abortCtrl.abort(); } catch (_e) { void _e; }
            return res;
          }
          if (isJsDelivrFallback && res && res.ok && typeof res.text === 'function') {
            const origText = res.text.bind(res);
            const guardedText = async () => {
              try {
                return await origText();
              } catch (streamErr) {
                if (!this._cloneCancelledByUser) {
                  failedBlobs++;
                  blobAbortError = new Error(`Network stream interrupted while downloading repository blob: ${(streamErr && streamErr.message) || streamErr}. Workspace rolled back cleanly.`);
                  try { abortCtrl.abort(); } catch (_e) { void _e; }
                }
                throw streamErr;
              }
            };
            try {
              Object.defineProperty(res, 'text', { value: guardedText, configurable: true, writable: true });
              return res;
            } catch (_defErr) {
              return new Proxy({}, {
                get(_target, prop) {
                  if (prop === 'text') return guardedText;
                  const val = Reflect.get(res, prop, res);
                  return typeof val === 'function' ? val.bind(res) : val;
                }
              });
            }
          }
          return res;
        } catch (fetchErr) {
          if (isJsDelivrFallback && !this._cloneCancelledByUser) {
            failedBlobs++;
            blobAbortError = new Error(`Network connection interrupted while cloning repository: ${(fetchErr && fetchErr.message) || fetchErr}. Workspace rolled back cleanly.`);
            try { abortCtrl.abort(); } catch (_e) { void _e; }
          }
          throw fetchErr;
        }
      } : undefined;

      try {
        const result = await cloneGitHubRepository(cleanInput, stagingVfs, {
          targetDir,
          branch: options.branch || parsed.branch || null,
          maxFiles: options.maxFiles || 250,
          maxFileSize: options.maxFileSize || 512 * 1024,
          fetchImpl: wrappedFetch,
          signal: abortCtrl.signal,
          onProgress: options.onProgress
        });

        if (failedBlobs > 0) {
          throw blobAbortError || new Error('Repository clone failed mid-transfer. Workspace rolled back cleanly.');
        }
        if (this._cloneCancelledByUser || abortCtrl.signal.aborted) {
          const abortErr = new Error('Clone cancelled by user');
          abortErr.name = 'AbortError';
          throw abortErr;
        }

        const hiddenVfsSegRe = /(?:^|\/)(?:\.git|node_modules)(?:\/|$)/;
        const cleanSnapshot = {};
        for (const [rawPath, content] of Object.entries(result.headSnapshot || {})) {
          const rel = String(rawPath || '').replace(/^\/+/, '');
          if (!rel || hiddenVfsSegRe.test(rel)) continue;
          cleanSnapshot[rel] = String(content ?? '');
        }

        if (shouldIsolate && intoRoot) {
          this._saveState({ flushFiles: true });
          const slugSafe = `${parsed.owner}-${parsed.repo}`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
          const nextId = `repo-${slugSafe}-${Date.now().toString(36)}`;
          this.labId = nextId;
          this.storageKey = `${STORAGE_PREFIX}${this.labId}`;
          this.savedState = {};
          this.settingsTabOpen = false;
          this._updateWorkspaceUrlParam(nextId);
        }

        if (intoRoot) {
          this.repo = `${parsed.owner}/${parsed.repo}`;
          this.title = `${parsed.owner}/${parsed.repo}`;
          this._isBlankBase = false;
          this.hasGuidedLab = false;
          this.referenceFiles = {};
          if (this.labId === this._initialLabId) {
            this._initialReferenceFiles = {};
            this._initialHasGuidedLab = false;
          }
          if (this._dirtyFiles) this._dirtyFiles.clear();
          if (this._diagnosticsStore && typeof this._diagnosticsStore.clear === 'function') {
            try { this._diagnosticsStore.clear(); } catch (_err) { void _err; }
          }

          const stagedCleanFolders = this._collectCleanVfsFolders(stagingVfs, '/workspace');
          if (stagingVfs !== this.shell.vfs && this.shell && this.shell.vfs) {
            this._pruneWorkspaceVfs(false);
            this._copyVfsTree(stagingVfs, this.shell.vfs, '/workspace');
          }

          this.setFiles(cleanSnapshot, {
            keepGitDir: true,
            folders: stagedCleanFolders,
            skipSave: true
          });
          const allNames = Object.keys(this.files);
          const pick = this._pickPrimaryCloneFile(allNames);
          this.openTabs = pick ? [pick] : [];
          this.activeFile = pick || null;
          this.activeTab = this.activeFile;

          const gs = this._getGitState();
          if (gs) {
            gs.initialized = true;
            gs.branch = result.branch || 'main';
            gs.branches = new Set([gs.branch]);
            gs.remoteUrl = result.url;
            gs.remotes = { origin: result.url };
            gs.repoRoot = targetDir;
            gs.headCommit = (Array.isArray(result.commits) && result.commits[0] && result.commits[0].hash) ? result.commits[0].hash : '';
            this._syncGitHeadState(gs, cleanSnapshot);
            if (gs.staged && typeof gs.staged.clear === 'function') gs.staged.clear();
            else gs.staged = new Map();
            if (gs.stagedFiles && typeof gs.stagedFiles.clear === 'function') gs.stagedFiles.clear();
            gs.commits = Array.isArray(result.commits) ? result.commits : [];
          }

          this._updateTopbarBrandTitle();
          this._registerWorkspaceMetaInStorage({
            kind: 'repo',
            repo: `${parsed.owner}/${parsed.repo}`,
            title: `${parsed.owner}/${parsed.repo}`,
            fileCount: allNames.length
          });
          this._saveState({ flushFiles: true });
          this._syncAllModels();
          this._syncActiveFileToView();
          this._renderScmSidebar();
          this._updateStatusBar();
        } else {
          const hadOpenTabs = Array.isArray(this.openTabs) && this.openTabs.length > 0;
          if (stagingVfs !== this.shell.vfs && this.shell && this.shell.vfs) {
            if (
              targetDir.startsWith('/workspace/') &&
              targetDir !== '/workspace' &&
              typeof this.shell.vfs.existsSync === 'function' &&
              this.shell.vfs.existsSync(targetDir) &&
              typeof this.shell.vfs.rmSync === 'function'
            ) {
              try { this.shell.vfs.rmSync(targetDir, { recursive: true, force: true }); } catch (_e) { void _e; }
            }
            this._copyVfsTree(stagingVfs, this.shell.vfs, targetDir);
          }
          this._syncVfsSnapshot(null, false, { suppressAutoOpenTabs: true });
          if (!hadOpenTabs) {
            const subPrefix = `${parsed.repo}/`;
            const subRels = Object.keys(this.files).filter((f) => f.startsWith(subPrefix));
            const stripped = subRels.map((f) => f.slice(subPrefix.length));
            const primaryRel = this._pickPrimaryCloneFile(stripped);
            const pick = primaryRel ? `${subPrefix}${primaryRel}` : (subRels[0] || null);
            this.openTabs = pick ? [pick] : [];
            this.activeFile = pick || null;
            this.activeTab = (this.settingsTabOpen && this.activeTab === '__settings__') ? '__settings__' : this.activeFile;
            this._renderTabs();
            this._syncActiveFileToView();
          }
          this._lintAllWorkspaceFiles();
        }

        const count = Math.max(1, result.filesWritten);
        const kb = Math.max(0.1, result.totalBytes / 1024).toFixed(1);
        this._pushTerminalLog({
          type: 'stdout',
          text:
            `Cloning into '${intoRoot ? '.' : parsed.repo}'...\n` +
            `remote: Enumerating objects: ${count}, done.\n` +
            `remote: Counting objects: 100% (${count}/${count}), done.\n` +
            `Receiving objects: 100% (${count}/${count}), ${kb} KiB, done.`
        });
        this._renderDrawerBody();

        const eventDetail = {
          owner: result.owner,
          repo: result.repo,
          branch: result.branch,
          url: result.url,
          targetDir: result.targetDir,
          labId: this.labId,
          count: result.filesWritten,
          fileCount: result.filesWritten,
          totalBytes: result.totalBytes
        };
        this._emitEvent('repo-clone', eventDetail);
        this._emitEvent('repo:cloned', eventDetail);
        return result;
      } catch (err) {
        if (failedBlobs > 0 && blobAbortError) {
          this._pushTerminalLog({ type: 'stderr', text: blobAbortError.message });
          this._renderDrawerBody();
          throw blobAbortError;
        }
        if (this._cloneCancelledByUser || abortCtrl.signal.aborted || (err && err.name === 'AbortError')) {
          this._pushTerminalLog({ type: 'stderr', text: '^C Clone cancelled. Previous workspace preserved.' });
          this._renderDrawerBody();
          const abortErr = err && err.name === 'AbortError' ? err : new Error('Clone cancelled by user');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        const msg = err && err.message ? err.message : String(err);
        this._pushTerminalLog({ type: 'stderr', text: msg });
        this._renderDrawerBody();
        throw err;
      } finally {
        this._cloneInFlight = false;
        if (this._activeCloneAbortController === abortCtrl) {
          this._activeCloneAbortController = null;
        }
        if (this._activeCommandAbortController === abortCtrl) {
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        this._updateRunStateUI();
      }
    }

    reset(opts) {
      return this.resetLab(opts);
    }

    on(eventName, handler) {
      if (!eventName || typeof handler !== 'function') return () => {};
      const key = String(eventName).trim();
      if (!this._eventListeners.has(key)) {
        this._eventListeners.set(key, new Set());
      }
      this._eventListeners.get(key).add(handler);
      return () => this.off(key, handler);
    }

    off(eventName, handler) {
      if (!eventName) return;
      const key = String(eventName).trim();
      const set = this._eventListeners.get(key);
      if (set) {
        if (handler) set.delete(handler);
        else set.clear();
      }
    }

    use(plugin, pluginOptions = {}) {
      if (!plugin) return this;
      if (typeof plugin === 'function') {
        plugin(this, pluginOptions);
      } else if (typeof plugin === 'object' && typeof plugin.install === 'function') {
        plugin.install(this, pluginOptions);
      } else if (typeof plugin === 'object' && typeof plugin.id === 'string' && typeof plugin.name === 'string') {
        this.registerPlugin(plugin);
      }
      if (this.enabledLanguages instanceof Set && this.enabledLanguages.size > 1) {
        this.hasMultipleLanguages = true;
      }
      if (typeof this._refreshToolbarAndTabs === 'function') {
        this._refreshToolbarAndTabs();
      } else {
        this._refreshLanguageSwitcher();
      }
      if (!this._isBooting) {
        this._lintAllWorkspaceFiles();
      }
      return this;
    }

    destroy() {
      this._destroyed = true;
      if (typeof this._activeSplitterCleanup === 'function') {
        try { this._activeSplitterCleanup(); } catch (_err) { void _err; }
        this._activeSplitterCleanup = null;
      }
      this.flushState();
      this.stopExecution();
      if (this._settingsDialog && typeof this._settingsDialog.dispose === 'function') {
        try { this._settingsDialog.dispose(); } catch (err) { this.logger.debug('settingsDialog dispose skipped.', err); }
        this._settingsDialog = null;
      }
      if (this._sqlWorkbenchEditor && typeof this._sqlWorkbenchEditor.destroy === 'function') {
        try { this._sqlWorkbenchEditor.destroy(); } catch (err) { this.logger.debug('sqlWorkbenchEditor destroy skipped.', err); }
        this._sqlWorkbenchEditor = null;
      }
      if (Array.isArray(this._pluginPanelDisposables)) {
        for (const d of this._pluginPanelDisposables) {
          if (d && typeof d.dispose === 'function') {
            try { d.dispose(); } catch (_err) { void _err; }
          }
        }
        this._pluginPanelDisposables = [];
      }
      if (this._errorBoundary && typeof this._errorBoundary.clear === 'function') {
        this._errorBoundary.clear();
        this._errorBoundary = null;
      }
      if (this.kernel && typeof this.kernel.dispose === 'function') {
        try { this.kernel.dispose(); } catch (err) { this.logger.debug('kernel dispose skipped.', err); }
        this.kernel = null;
      }
      if (this._saveDebounceTimer) {
        clearTimeout(this._saveDebounceTimer);
        this._saveDebounceTimer = null;
      }
      if (this._autoSaveTimer) {
        clearTimeout(this._autoSaveTimer);
        this._autoSaveTimer = null;
      }
      if (this._lintDebounceTimer) {
        clearTimeout(this._lintDebounceTimer);
        this._lintDebounceTimer = null;
      }
      if (this._breadcrumbRafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._breadcrumbRafId);
        this._breadcrumbRafId = null;
      }
      if (this._previewReloadTimer) {
        clearTimeout(this._previewReloadTimer);
        this._previewReloadTimer = null;
      }
      if (Array.isArray(this._portListenerUnsubs)) {
        for (const unsub of this._portListenerUnsubs) {
          if (typeof unsub === 'function') {
            try { unsub(); } catch (err) { this.logger.debug('portTable listener unsubscribe skipped.', err); }
          }
        }
        this._portListenerUnsubs = [];
        this._portListenersBound = false;
      }
      if (this._portToasts instanceof Map) {
        for (const entry of this._portToasts.values()) {
          if (entry && entry.timer) clearTimeout(entry.timer);
          if (entry && entry.el && typeof entry.el.remove === 'function') entry.el.remove();
        }
        this._portToasts.clear();
      }
      if (this._markerDisposable && typeof this._markerDisposable.dispose === 'function') {
        try { this._markerDisposable.dispose(); } catch (err) { this.logger.debug('markerDisposable dispose skipped.', err); }
        this._markerDisposable = null;
      }
      if (this._escHandler && typeof document !== 'undefined') {
        document.removeEventListener('keydown', this._escHandler);
      }
      if (this._topbarMenuOutsideHandler && typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', this._topbarMenuOutsideHandler);
        this._topbarMenuOutsideHandler = null;
      }
      if (this._captureKeydownHandler && this.container && typeof this.container.removeEventListener === 'function') {
        this.container.removeEventListener('keydown', this._captureKeydownHandler, true);
        this._captureKeydownHandler = null;
      }
      if (this._documentKeydownHandler && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('keydown', this._documentKeydownHandler);
        this._documentKeydownHandler = null;
      }
      if (this._beforeUnloadHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this._beforeUnloadHandler);
      }
      this._beforeUnloadHandler = null;
      if (this._previewViolationHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('message', this._previewViolationHandler);
      }
      this._previewViolationHandler = null;
      if (this._swMessageHandler && typeof navigator !== 'undefined' && navigator.serviceWorker &&
          typeof navigator.serviceWorker.removeEventListener === 'function') {
        navigator.serviceWorker.removeEventListener('message', this._swMessageHandler);
      }
      this._swMessageHandler = null;
      if (this._themeObserver) {
        this._themeObserver.disconnect();
      }
      if (this._editorResizeObserver) {
        this._editorResizeObserver.disconnect();
        this._editorResizeObserver = null;
      }
      if (this._diffManager && typeof this._diffManager.closeInlineDiff === 'function') {
        try {
          this._diffManager.closeInlineDiff();
        } catch (err) {
          this.logger.debug('diffManager.closeInlineDiff failed during destroy.', err);
        }
      }
      if (this.editor) {
        this.editor.dispose();
        this.editor = null;
      }
      for (const model of this.models.values()) {
        model.dispose();
      }
      this.models.clear();
      if (this._eventListeners) {
        this._eventListeners.clear();
      }
      if (CodeLabWorkbench._instances) {
        CodeLabWorkbench._instances.delete(this);
      }
      if (CodeLabWorkbench._lastActiveInstance === this) {
        CodeLabWorkbench._lastActiveInstance = null;
      }
      if (this.container) {
        const shellEl = typeof this.container.querySelector === 'function' ? this.container.querySelector('.codelab') : null;
        if (shellEl && typeof shellEl.remove === 'function') {
          shellEl.remove();
        } else if ('innerHTML' in this.container) {
          this.container.innerHTML = '';
        }
        if (this.container._codeLabInstance === this) {
          this.container._codeLabInstance = null;
        }
      }
    }
  }

  CodeLabWorkbench._instances = new Set();
  CodeLabWorkbench._lastActiveInstance = null;
  CodeLabWorkbench._isInstanceVisible = (wb) => {
    if (!wb || wb._destroyed || !wb.container) return false;
    const shell = typeof wb.container.querySelector === 'function' ? wb.container.querySelector('.codelab') : null;
    if (!shell) return false;
    if (typeof shell.isConnected === 'boolean' && !shell.isConnected) return false;
    if (typeof shell.offsetParent !== 'undefined' && shell.offsetParent === null) {
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
          const cs = window.getComputedStyle(shell);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (cs.position !== 'fixed') return false;
          let anc = wb.container;
          while (anc && anc.nodeType === 1) {
            const acs = window.getComputedStyle(anc);
            if (acs.display === 'none' || acs.visibility === 'hidden') return false;
            anc = anc.parentElement;
          }
        } catch (err) {
          void err;
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  };

  // ── Register <code-lab> Custom Element ───────────────────────────────────
  let CodeLabElementClass = null;
  if (typeof HTMLElement !== 'undefined') {
    CodeLabElementClass = class CodeLabElement extends HTMLElement {
      static get observedAttributes() {
        return ['theme', 'mode', 'language', 'lang', 'title', 'repo'];
      }

      attributeChangedCallback(name, oldVal, newVal) {
        if (!this._instance || oldVal === newVal) return;
        if (name === 'theme') {
          this._instance.setTheme(newVal || 'auto');
        } else if (name === 'mode' && (newVal === 'guided' || newVal === 'sandbox')) {
          this._instance.switchMode(newVal);
        } else if ((name === 'language' || name === 'lang') && (newVal === 'js' || newVal === 'ts' || newVal === 'cpp' || newVal === 'py' || newVal === 'sql')) {
          this._instance.switchLang(newVal);
        } else if (name === 'title' && newVal) {
          this._instance.title = newVal;
        } else if (name === 'repo' && newVal) {
          this._instance.cloneRepo(newVal, { intoRoot: true }).catch(() => {});
        }
      }

      connectedCallback() {
        if (this._instance) return;

        // Prevent recursive initialization if a <code-lab> tag appears inside markdown previews or prose of another CodeLab instance
        if (typeof this.closest === 'function' && (this.closest('.codelab') || this.closest('.codelab-workbench') || this.closest('#cl-md-preview'))) {
          return;
        }

        // Parse optional declarative <script type="application/json"> child config
        let inlineConfig = {};
        const jsonScript = this.querySelector('script[type="application/json"]');
        if (jsonScript && jsonScript.textContent) {
          try {
            inlineConfig = JSON.parse(jsonScript.textContent);
          } catch (err) {
            DEFAULT_LOGGER.warn('Failed to parse <script type="application/json"> inside <code-lab>.', err);
          }
        }

        // Parse optional files JSON attribute
        let attrFiles = null;
        const filesAttr = this.getAttribute('files');
        if (filesAttr) {
          try {
            attrFiles = JSON.parse(filesAttr);
          } catch (err) {
            DEFAULT_LOGGER.warn('Failed to parse files="" attribute on <code-lab>.', err);
          }
        }

        const labId = this.getAttribute('lab-id') || this.getAttribute('build-id') || this.dataset.labId || this.dataset.buildId || inlineConfig.id || inlineConfig.labId || 'custom-lab';

        this._instance = new CodeLabWorkbench(this, {
          ...inlineConfig,
          labId,
          title: this.getAttribute('title') || inlineConfig.title || undefined,
          mode: this.getAttribute('mode') || inlineConfig.mode || undefined,
          language: this.getAttribute('language') || this.getAttribute('lang') || inlineConfig.language || undefined,
          theme: this.getAttribute('theme') || inlineConfig.theme || undefined,
          entry: this.getAttribute('entry') || inlineConfig.entry || undefined,
          testEntry: this.getAttribute('test-entry') || inlineConfig.testEntry || undefined,
          repo: this.getAttribute('repo') || inlineConfig.repo || undefined,
          branch: this.getAttribute('branch') || inlineConfig.branch || undefined,
          fullbleed: this.hasAttribute('fullbleed') || Boolean(inlineConfig.fullbleed),
          ...(attrFiles ? { files: attrFiles } : {})
        });
      }

      getFiles() { return this._instance ? this._instance.getFiles() : {}; }
      setFiles(filesMap, opts) { return this._instance ? this._instance.setFiles(filesMap, opts) : undefined; }
      getFile(path) { return this._instance ? this._instance.getFile(path) : null; }
      setFile(path, content, opts) { return this._instance ? this._instance.setFile(path, content, opts) : undefined; }
      createFile(path, content) { return this._instance ? this._instance.createFile(path, content) : null; }
      deleteFile(path, opts) { return this._instance ? this._instance.deleteFile(path, opts) : false; }
      renameFile(oldPath, newPath) { return this._instance ? this._instance.renameFile(oldPath, newPath) : false; }
      createFolder(path) { return this._instance ? this._instance.createFolder(path) : false; }
      deleteFolder(path, opts) { return this._instance ? this._instance.deleteFolder(path, opts) : false; }
      renameFolder(oldPath, newPath) { return this._instance ? this._instance.renameFolder(oldPath, newPath) : false; }
      moveFile(oldPath, newPath) { return this._instance ? this._instance.moveFile(oldPath, newPath) : false; }
      movePath(sourcePath, targetFolder) { return this._instance ? this._instance.movePath(sourcePath, targetFolder) : false; }
      startInlineCreate(type, folderPrefix) { if (this._instance) this._instance.startInlineCreate(type, folderPrefix); }
      startInlineRename(typeOrPath, maybeTarget) { if (this._instance) this._instance.startInlineRename(typeOrPath, maybeTarget); }
      promptNewFile(folderPrefix) { if (this._instance) this._instance.promptNewFile(folderPrefix); }
      promptNewFolder(folderPrefix) { if (this._instance) this._instance.promptNewFolder(folderPrefix); }
      openFile(path, sym) { if (this._instance) this._instance.openFile(path, sym); }
      closeTab(path) { if (this._instance) this._instance.closeTab(path); }
      getOpenTabs() { return this._instance ? this._instance.getOpenTabs() : []; }
      setTheme(theme) { return this._instance ? this._instance.setTheme(theme) : undefined; }
      getTheme() { return this._instance ? this._instance.getTheme() : 'auto'; }
      setLanguage(lang) { if (this._instance) this._instance.setLanguage(lang); }
      setMode(mode) { if (this._instance) this._instance.setMode(mode); }
      switchDrawerTab(tab) { if (this._instance) this._instance.switchDrawerTab(tab); }
      toggleWebPreview() { if (this._instance) this._instance.toggleWebPreview(); }
      openCommandPalette(mode) { if (this._instance) this._instance.openCommandPalette(mode); }
      closeCommandPalette() { if (this._instance) this._instance.closeCommandPalette(); }
      showDiffModal(file, target) { if (this._instance) this._instance.showDiffModal(file, target); }
      openCloneDialog(opts) { if (this._instance) this._instance.openCloneDialog(opts); }
      showCloneRepoModal(opts) { if (this._instance) this._instance.showCloneRepoModal(opts); }
      cancelClone() { return this._instance ? this._instance.cancelClone() : false; }
      cloneRepo(repoInput, opts) { return this._instance ? this._instance.cloneRepo(repoInput, opts) : Promise.reject(new Error('Workbench not mounted')); }
      runCode() { return this._instance ? this._instance.runCode() : Promise.resolve(); }
      runProject() { return this._instance ? this._instance.runProject() : Promise.resolve(); }
      runEntry() { return this._instance ? this._instance.runEntry() : Promise.resolve(); }
      runActiveFile() { return this._instance ? this._instance.runActiveFile() : Promise.resolve(); }
      runSelectedCode() { return this._instance ? this._instance.runSelectedCode() : Promise.resolve(null); }
      runDemo() { return this._instance ? this._instance.runDemo() : Promise.resolve(); }
      runTests(filter) { return this._instance ? this._instance.runTests(filter) : Promise.resolve(); }
      formatActiveDocument() { return this._instance ? this._instance.formatActiveDocument() : Promise.resolve(); }
      shareSnapshot() { return this._instance ? this._instance.shareSnapshot() : Promise.resolve(); }
      previewApp() { return this._instance ? this._instance.previewApp() : Promise.resolve(null); }
      stopExecution() { if (this._instance) this._instance.stopExecution(); }
      cancelExecution() { if (this._instance) this._instance.cancelExecution(); }
      reset(opts) { return this._instance ? this._instance.reset(opts) : undefined; }
      resetLab(opts) { return this._instance ? this._instance.resetLab(opts) : undefined; }
      exportWorkspace(opts) { return this._instance ? this._instance.exportWorkspace(opts) : null; }
      importWorkspace(snap) { return this._instance ? this._instance.importWorkspace(snap) : false; }
      exportProjectZip(opts) { return this._instance ? this._instance.exportProjectZip(opts) : null; }
      importProjectZip(bytes, opts) { return this._instance ? this._instance.importProjectZip(bytes, opts) : false; }
      exportZip(opts) { return this._instance ? this._instance.exportZip(opts) : null; }
      importZip(bytes, opts) { return this._instance ? this._instance.importZip(bytes, opts) : 0; }
      searchWorkspace(opts) { return this._instance ? this._instance.searchWorkspace(opts) : null; }
      replaceInWorkspace(opts) { return this._instance ? this._instance.replaceInWorkspace(opts) : null; }
      getGitStatus() { return this._instance ? this._instance.getGitStatus() : []; }
      stageGitFile(p) { return this._instance ? this._instance.stageGitFile(p) : false; }
      unstageGitFile(p) { return this._instance ? this._instance.unstageGitFile(p) : false; }
      stageAllGitFiles() { return this._instance ? this._instance.stageAllGitFiles() : false; }
      unstageAllGitFiles() { return this._instance ? this._instance.unstageAllGitFiles() : false; }
      discardGitFile(p) { return this._instance ? this._instance.discardGitFile(p) : false; }
      commitGitChanges(msg) { return this._instance ? this._instance.commitGitChanges(msg) : null; }
      listGitBranches() { return this._instance ? this._instance.listGitBranches() : []; }
      createGitBranch(name, checkout) { return this._instance ? this._instance.createGitBranch(name, checkout) : false; }
      checkoutGitBranch(name) { return this._instance ? this._instance.checkoutGitBranch(name) : false; }
      getGitLog(limit) { return this._instance ? this._instance.getGitLog(limit) : []; }
      openScmDiff(p, opts) { return this._instance ? this._instance.openScmDiff(p, opts) : false; }
      closeScmDiff() { return this._instance ? this._instance.closeScmDiff() : false; }
      getDiagnostics() { return this._instance ? this._instance.getDiagnostics() : []; }
      goToNextProblem(rev) { return this._instance ? this._instance.goToNextProblem(rev) : false; }
      openSearchView(opts) { if (this._instance) this._instance.openSearchView(opts); }
      openScmView() { if (this._instance) this._instance.openScmView(); }
      openProblemsPanel() { if (this._instance) this._instance.openProblemsPanel(); }
      showSearchModal(q) { if (this._instance) this._instance.showSearchModal(q); }
      showScmModal() { if (this._instance) this._instance.showScmModal(); }
      showProblemsModal() { if (this._instance) this._instance.showProblemsModal(); }
      setSidebarVisible(vis) { if (this._instance) this._instance.setSidebarVisible(vis); }
      toggleSidebar() { if (this._instance) this._instance.toggleSidebar(); }
      setSidebarView(viewId, opts) { if (this._instance) this._instance.setSidebarView(viewId, opts); }
      setPanelVisible(vis) { if (this._instance) this._instance.setPanelVisible(vis); }
      togglePanel() { if (this._instance) this._instance.togglePanel(); }
      toggleDrawer() { if (this._instance) this._instance.toggleDrawer(); }
      setPanelMaximized(max) { if (this._instance) this._instance.setPanelMaximized(max); }
      toggleTerminal() { if (this._instance) this._instance.toggleTerminal(); }
      listTerminalSessions() { return this._instance ? this._instance.listTerminalSessions() : []; }
      createTerminalSession(name) { return this._instance ? this._instance.createTerminalSession(name) : null; }
      switchTerminalSession(id) { return this._instance ? this._instance.switchTerminalSession(id) : false; }
      closeTerminalSession(id) { return this._instance ? this._instance.closeTerminalSession(id) : false; }
      killActiveTerminalSession() { return this._instance ? this._instance.killActiveTerminalSession() : false; }
      saveActiveFile(opts) { return this._instance ? this._instance.saveActiveFile(opts) : Promise.resolve(false); }
      saveFile(path) { return this._instance ? this._instance.saveFile(path) : false; }
      saveAllFiles() { return this._instance ? this._instance.saveAllFiles() : false; }
      saveWorkspace() { return this._instance ? this._instance.saveWorkspace() : Promise.resolve(false); }
      openBlankWorkspace(opts) { return this._instance ? this._instance.openBlankWorkspace(opts) : Promise.resolve(null); }
      newBlankWorkspace(title) { return this._instance ? this._instance.newBlankWorkspace(title) : null; }
      switchWorkspace(id, opts) { return this._instance ? this._instance.switchWorkspace(id, opts) : Promise.resolve(false); }
      openSettings(opts) { if (this._instance) this._instance.openSettings(opts); }
      closeSettings() { if (this._instance) this._instance.closeSettings(); }
      openWorkspaceSettingsJson() { if (this._instance) this._instance.openWorkspaceSettingsJson(); }
      runSql(mode, payload) { return this._instance ? this._instance.runSql(mode, payload) : Promise.resolve(null); }
      setSqlSchema(schema) { if (this._instance) this._instance.setSqlSchema(schema); return this; }
      setSqlDialect(dialect) { if (this._instance) this._instance.setSqlDialect(dialect); return this; }
      runTask(idOrLabel) { return this._instance ? this._instance.runTask(idOrLabel) : Promise.resolve(null); }
      registerPlugin(manifest) { return this._instance ? this._instance.registerPlugin(manifest) : { dispose() {} }; }
      on(ev, fn) { return this._instance ? this._instance.on(ev, fn) : () => {}; }
      off(ev, fn) { if (this._instance) this._instance.off(ev, fn); }
      use(plugin, opts) { if (this._instance) this._instance.use(plugin, opts); return this; }

      disconnectedCallback() {
        if (this._instance) {
          this._instance.destroy();
          this._instance = null;
        }
      }
    };

    if (typeof customElements !== 'undefined' && !customElements.get('code-lab')) {
      customElements.define('code-lab', CodeLabElementClass);
    }
  }

  // ── Public SDK API ───────────────────────────────────────────────────────
  function mountCodeLab(container, options = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return null;
    if (el._codeLabInstance) {
      el._codeLabInstance.destroy();
    }
    const instance = new CodeLabWorkbench(el, options);
    el._codeLabInstance = instance;
    return instance;
  }

  const CodeLabSDK = {
    version: CODELAB_VERSION,
    Workbench: CodeLabWorkbench,
    CodeLabWorkbench,
    CodeLabElement: CodeLabElementClass,
    CodeLabError,
    isCodeLabError,
    createLogger,
    Logger: _sharedLoggerMod || { LOG_PREFIX, CodeLabError, isCodeLabError, createLogger, DEFAULT_LOGGER },
    html,
    raw,
    isSafeHtml,
    escapeHtml,
    Html: _sharedHtmlMod || { html, raw, isSafeHtml, escapeHtml },
    Runtime: root.CodeLabRuntime,
    Shell: root.CodeLabShell,
    Terminal: root.CodeLabTerminal,
    Modular: getModular(),
    sql: getSqlPack(),
    createSqlEditor: getSqlPack() ? getSqlPack().createSqlEditor : null,
    formatSql: getSqlPack() ? getSqlPack().formatSql : null,
    zip: root.CodeLabZip || null,
    createZip: root.CodeLabZip ? root.CodeLabZip.createZip : null,
    extractZip: root.CodeLabZip ? root.CodeLabZip.extractZip : null,
    computeCrc32: root.CodeLabZip ? root.CodeLabZip.computeCrc32 : null,
    sanitizeZipPath: root.CodeLabZip ? root.CodeLabZip.sanitizeZipPath : null,
    storage: root.CodeLabStorage || null,
    WorkspaceStorage: root.CodeLabStorage ? root.CodeLabStorage.WorkspaceStorage : null,
    createWorkspaceStorage: root.CodeLabStorage ? root.CodeLabStorage.createWorkspaceStorage : null,
    search: root.CodeLabSearch || null,
    searchInFiles: root.CodeLabSearch ? root.CodeLabSearch.searchInFiles : null,
    replaceInFiles: root.CodeLabSearch ? root.CodeLabSearch.replaceInFiles : null,
    matchesGlob: root.CodeLabSearch ? root.CodeLabSearch.matchesGlob : null,
    escapeRegex: root.CodeLabSearch ? root.CodeLabSearch.escapeRegex : null,
    normalizeSearchPath: root.CodeLabSearch ? root.CodeLabSearch.normalizeSearchPath : null,
    diagnostics: root.CodeLabDiagnostics || null,
    DiagnosticsStore: root.CodeLabDiagnostics ? root.CodeLabDiagnostics.DiagnosticsStore : null,
    createDiagnosticsStore: root.CodeLabDiagnostics ? root.CodeLabDiagnostics.createDiagnosticsStore : null,
    scm: root.CodeLabScm || null,
    createGitState: root.CodeLabScm ? root.CodeLabScm.createGitState : null,
    computeGitStatus: root.CodeLabScm ? root.CodeLabScm.computeGitStatus : null,
    stageFile: root.CodeLabScm ? root.CodeLabScm.stageFile : null,
    unstageFile: root.CodeLabScm ? root.CodeLabScm.unstageFile : null,
    commitChanges: root.CodeLabScm ? root.CodeLabScm.commitChanges : null,
    computeShortCommitHash: root.CodeLabScm ? root.CodeLabScm.computeShortCommitHash : null,
    renderMarkdown: renderSimpleMarkdown,
    renderSimpleMarkdown: renderSimpleMarkdown,
    extensions: {
      guidedLab: null,
      javascript: null,
      typescript: null,
      cpp: null,
      python: null
    },
    parseGitHubRepoUrl,
    cloneRepo: cloneGitHubRepository,
    mount: mountCodeLab,
    create: mountCodeLab,
    unmount(container) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;
      if (el._codeLabInstance) {
        el._codeLabInstance.destroy();
        el._codeLabInstance = null;
      }
      if ('innerHTML' in el) {
        el.innerHTML = '';
      }
    }
  };

  CodeLabWorkbench.prototype.renderMarkdown = renderSimpleMarkdown;
  CodeLabWorkbench.prototype.renderSimpleMarkdown = renderSimpleMarkdown;

  root.CodeLab = CodeLabSDK;
  root.CodeLabWorkbench = CodeLabWorkbench;
  if (CodeLabElementClass) {
    root.CodeLabElement = CodeLabElementClass;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeLabSDK;
  }
})(typeof window !== 'undefined' ? window : globalThis);

// ── TypeScript module surface (stripped from browser bundles) ──────────────
const _hostWorkbench: any = (typeof globalThis !== 'undefined' ? (globalThis as any).CodeLabWorkbench : undefined)
  || (typeof window !== 'undefined' ? (window as any).CodeLabWorkbench : undefined)
  || (typeof module !== 'undefined' && module.exports && (module.exports.CodeLabWorkbench || module.exports) ? (module.exports.CodeLabWorkbench || module.exports) : undefined);

const _hostElement: any = (typeof globalThis !== 'undefined' ? (globalThis as any).CodeLabElement : undefined)
  || (typeof window !== 'undefined' ? (window as any).CodeLabElement : undefined)
  || (typeof module !== 'undefined' && module.exports ? module.exports.CodeLabElement : undefined);

const _hostSDK: any = (typeof globalThis !== 'undefined' ? (globalThis as any).CodeLab : undefined)
  || (typeof window !== 'undefined' ? (window as any).CodeLab : undefined)
  || (typeof module !== 'undefined' && module.exports ? module.exports : {});

export const CodeLabWorkbench: any = _hostWorkbench;
export const Workbench: any = _hostWorkbench;
export const CodeLabElement: any = _hostElement;
export const CodeLab: any = _hostSDK;
export default _hostSDK;
