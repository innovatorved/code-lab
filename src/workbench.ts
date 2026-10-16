// @ts-nocheck
/* ═══════════════════════════════════════════════════════════════════════════
   @innovatorved/code-lab — Interactive Monaco IDE Workbench & Guided Lab UI
   Supports <code-lab> Custom Element + window.CodeLab.mount() API
   ═══════════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  let terminalModule = null;
  let shellModule = null;
  let runtimeModule = null;
  if (typeof require === 'function') {
    try { terminalModule = require('./terminal.js'); } catch (_) {}
    try { shellModule = require('./shell.js'); } catch (_) {}
    try { runtimeModule = require('./runtime.js'); } catch (_) {}
  }
  const CodeLabTerminal = (root && root.CodeLabTerminal) || terminalModule || {};
  const CodeLabShell = (root && root.CodeLabShell) || shellModule || {};
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

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

    // Markdown Links: [label](url "title") or [label](url)
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
      const cleanUrl = url.trim();
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(cleanUrl)}" class="codelab-link" target="_blank" rel="noopener noreferrer"${titleAttr}>${label}</a>`;
    });

    // Autolinks: <https://...>
    text = text.replace(/<(https?:\/\/[^>]+)>/g, (_, url) => {
      return `<a href="${escapeHtml(url)}" class="codelab-link" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
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

    // Prevent raw custom elements from executing within markdown previews
    text = text.replace(/<\/?code-lab(\s[^>]*)?>/gi, (m) => escapeHtml(m));

    // Phase 1: Fenced Code Block Extraction
    const codeBlocks = [];
    text = text.replace(/(?:^|\n)(`{3,}|~{3,})([^\n`~]*)\n([\s\S]*?)\n?\1[ \t]*(?=\n|$)/g, (match, fence, info, code) => {
      const lang = (info || '').trim().split(/\s+/)[0] || '';
      const idx = codeBlocks.length;
      codeBlocks.push(renderCodeBlock(code || '', lang));
      return `\n\n\x00CODEBLOCK_${idx}\x00\n\n`;
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
      return `\x00INLINECODE_${idx}\x00`;
    });

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
      return `\n\n\x00CALLOUT_${idx}\x00\n\n`;
    });

    // Phase 4: GFM Tables with Column Alignments
    const tableBlocks = [];
    text = text.replace(/(?:^|\n)([ \t]*\|?[^\n]+\|[^\n]*\n[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*(?:\n[ \t]*\|?[^\n]+\|[^\n]*)*)(?=\n|$)/g, (match, tableText) => {
      const rendered = renderTable(tableText);
      if (rendered === tableText) return match;
      const idx = tableBlocks.length;
      tableBlocks.push(rendered);
      return `\n\n\x00TABLE_${idx}\x00\n\n`;
    });

    // Phase 5: Task Lists & Nested Lists
    const listBlocks = [];
    const taskCounter = { count: 0 };
    text = text.replace(/(?:^[ ]*(?:[-*+]|\d+\.)[ ]+[^\n]*(?:\n[ ]*(?:[-*+]|\d+\.)[ ]+[^\n]*|\n[ ]{2,}[^\n]*)*)+/gm, (match) => {
      const idx = listBlocks.length;
      listBlocks.push(renderListBlock(match, taskCounter));
      return `\n\n\x00LIST_${idx}\x00\n\n`;
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
      if (/^\x00(CODEBLOCK|CALLOUT|TABLE|LIST)_\d+\x00$/.test(trimmed)) return trimmed;
      return `<p>${renderInlineFormatting(trimmed).replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('\n');

    // Phase 7: Placeholder Restoration (Reverse order)
    let finalHtml = paras
      .replace(/\x00LIST_(\d+)\x00/g, (_, i) => listBlocks[Number(i)] || '')
      .replace(/\x00TABLE_(\d+)\x00/g, (_, i) => tableBlocks[Number(i)] || '')
      .replace(/\x00CALLOUT_(\d+)\x00/g, (_, i) => calloutBlocks[Number(i)] || '')
      .replace(/\x00CODEBLOCK_(\d+)\x00/g, (_, i) => codeBlocks[Number(i)] || '')
      .replace(/\x00INLINECODE_(\d+)\x00/g, (_, i) => inlineCodes[Number(i)] || '');

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
            self.MonacoEnvironment = { baseUrl: '${amdBaseUrl}' };
            importScripts('${baseUrl}/base/worker/workerMain.js');
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

  // Helper to convert JS file set to TS file set if explicit TS files aren't provided
  function mapFilesToLanguage(filesObj, lang, explicitTsFiles) {
    if (lang === 'ts' && explicitTsFiles && Object.keys(explicitTsFiles).length > 0) {
      return { ...explicitTsFiles };
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
    x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  let _workbenchInstanceCounter = 0;
  const _fallbackStorage = new Map();

  function safeStorageGet(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        return localStorage.getItem(key);
      }
    } catch (_) {}
    return _fallbackStorage.has(key) ? _fallbackStorage.get(key) : null;
  }

  function safeStorageSet(key, value) {
    const str = String(value);
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.setItem(key, str);
        return;
      }
    } catch (_) {}
    _fallbackStorage.set(key, str);
  }

  // ── CodeLabWorkbench Instance Class ──────────────────────────────────────
  class CodeLabWorkbench {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error('CodeLabWorkbench requires a valid DOM container element.');
      }
      this.options = options || {};
      this.instanceId = options.instanceId || (`cl-${++_workbenchInstanceCounter}`);
      this.labId = options.id || options.labId || options.buildId || 'custom-lab';
      this.title = options.title || this.labId;
      this.summary = options.summary || '';
      this.monacoUrl = options.monacoUrl || MONACO_BASE;
      this.themeOption = options.theme || 'auto'; // 'dark' | 'light' | 'auto'
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

      const rawRefFiles = options.solutionFiles || options.files || implData?.files || {};
      this.referenceFiles = Object.keys(rawRefFiles).length > 0 ? { ...rawRefFiles } : { ...DEFAULT_STANDALONE_FILES };

      this.guidedConfig = {
        ...(guidedData || {}),
        ...(options.guided || {}),
        ...(options.starterFiles ? { starterFiles: options.starterFiles } : {}),
        ...(options.tsStarterFiles ? { tsStarterFiles: options.tsStarterFiles } : {}),
        ...((options.tsSolutionFiles || options.tsFiles) ? { tsSolutionFiles: options.tsSolutionFiles || options.tsFiles } : {})
      };
      this.steps = options.steps || this.guidedConfig?.steps || [];
      this.hasGuidedLab = Boolean(
        options.hasGuidedLab ||
        options.guidedLab ||
        (this.steps && this.steps.length > 0)
      );
      this.hasMultipleLanguages = Boolean(
        options.hasMultipleLanguages ||
        options.languages ||
        this.guidedConfig.tsStarterFiles ||
        this.guidedConfig.tsSolutionFiles ||
        this.guidedConfig.tsFiles ||
        (this.hasGuidedLab && (options.lang || options.language))
      );

      // Load saved user state from localStorage (with in-memory fallback)
      this.savedState = this._loadState();

      this.mode = options.mode || this.savedState.mode || (this.hasGuidedLab ? 'guided' : 'sandbox');
      this.lang = options.language || options.lang || this.savedState.lang || 'js';
      this.activeStepIndex = typeof options.stepIndex === 'number' ? options.stepIndex : (this.savedState.activeStepIndex || 0);
      if (this.activeStepIndex >= this.steps.length || this.activeStepIndex < 0) this.activeStepIndex = 0;

      this.completedSteps = new Set(this.savedState.completedSteps || []);
      this.folders = new Set(this.savedState?.folders || []);
      this.collapsedFolders = new Set(this.savedState?.collapsedFolders || []);
      this.explorerFolder = this.savedState?.explorerFolder || ''; // '' = workspace root, else folder path scope
      this.folderSwitcherOpen = false;
      this.creatingItem = null; // { type: 'file' | 'folder', parentFolder: string } | null
      this.renamingItem = null;
      this._draggedFile = null;
      this.guideTab = 'steps'; // 'steps' | 'readme'
      this.drawerTab = 'tests'; // 'tests' | 'terminal' | 'ports' | 'preview' | 'network' | 'inspector'
      // ── Web Preview (M3) state ──
      this.previewState = {
        port: null,
        path: '/',
        url: '',
        frameMode: 'desktop', // 'desktop' | 'tablet' | 'mobile'
        loading: false,
        error: null,
        srcdoc: ''
      };
      this.previewHistory = [];
      this.previewHistoryIdx = -1;
      this._previewSwReady = false;
      this._previewSwRegistration = null;
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
      this.runtimeStatusText = 'Node.js v22 Worker · Idle';

      // Initialize working files for current mode & language
      this.files = this._computeInitialFiles();

      // Auto-populate folders from nested files
      Object.keys(this.files).forEach(f => {
        const parts = f.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      });

      // Decouple openTabs from files
      if (Array.isArray(this.savedState?.openTabs)) {
        this.openTabs = this.savedState.openTabs.filter(f => this.files[f] !== undefined);
      } else {
        this.openTabs = this._orderedFileNames();
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
        } catch (_) {}
      }

      this.shell = null;
      this._initShell();

      // Editor instances
      this.monaco = null;
      this.editor = null;
      this.models = new Map();

      this._renderShell();
      this._bindEvents();
      this._initEditor();

      if (Array.isArray(options.plugins)) {
        for (const plugin of options.plugins) {
          this.use(plugin);
        }
      }

      if (options.repo && typeof options.repo === 'string') {
        this.cloneRepo(options.repo, {
          intoRoot: options.cloneIntoRoot !== false,
          branch: options.branch || undefined,
          fetchImpl: options.fetchImpl || undefined
        }).catch(() => {});
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
        } catch (_) {}
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
          } catch (_) {}
          const method = String((init && init.method) || 'GET').toUpperCase();
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
            } catch (_) {}
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
            } catch (_) {}
            if (!Array.isArray(this.lastHttpTrace)) this.lastHttpTrace = [];
            this.lastHttpTrace.push({
              id: 'trace_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              timestamp: new Date().toLocaleTimeString(),
              method,
              url: reqPath,
              fullUrl,
              port: parsedPort,
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
            return res;
          } catch (err) {
            throw err;
          }
        };
      }
    }

    _syncFilesToShellVfs() {
      if (!this.shell || !this.shell.vfs) return;
      const vfs = this.shell.vfs;
      try {
        if (typeof vfs.mkdirSync === 'function') {
          vfs.mkdirSync('/workspace', { recursive: true });
          for (const folder of (this.folders || [])) {
            if (folder) vfs.mkdirSync('/workspace/' + folder.replace(/^\/+/, ''), { recursive: true });
          }
        }
        for (const [relPath, content] of Object.entries(this.files || {})) {
          const clean = String(relPath).replace(/^\/+/, '');
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
      } catch (_) {}
    }

    _emitEvent(name, detail) {
      const shortName = String(name).replace(/^codelab:/, '');
      const fullName = shortName === name ? `codelab:${name}` : name;
      if (this._eventListeners) {
        for (const key of new Set([name, shortName, fullName])) {
          const handlers = this._eventListeners.get(key);
          if (handlers) {
            for (const fn of Array.from(handlers)) {
              try { fn(detail); } catch (_) {}
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
      } catch (_) {}
    }

    _resolvedTheme() {
      if (this.themeOption === 'light' || this.themeOption === 'dark') {
        return this.themeOption;
      }
      if (typeof document !== 'undefined') {
        const docTheme = document.documentElement.getAttribute('data-theme');
        if (docTheme === 'light') return 'light';
      }
      return 'dark';
    }

    _storageKey() {
      return `${STORAGE_PREFIX}${this.labId}`;
    }

    _loadState() {
      if (this.options && this.options.persistState === false) {
        return {};
      }
      try {
        const raw = safeStorageGet(this._storageKey()) || safeStorageGet('sd_codelab_' + this.labId);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    _saveState() {
      try {
        const key = `${this.mode}:${this.lang}`;
        const customFiles = (this.savedState && this.savedState.customFiles) || {};
        customFiles[key] = { ...this.files };
        const completedArr = Array.from(this.completedSteps);
        const state = {
          mode: this.mode,
          lang: this.lang,
          activeStepIndex: this.activeStepIndex,
          completedSteps: completedArr,
          customFiles,
          openTabs: Array.isArray(this.openTabs) ? [...this.openTabs] : undefined,
          activeFile: this.activeFile,
          folders: Array.from(this.folders || []),
          collapsedFolders: Array.from(this.collapsedFolders || []),
          explorerFolder: this.explorerFolder || ''
        };
        this.savedState = state;
        if (this.options && this.options.persistState === false) {
          return;
        }
        const serialized = JSON.stringify(state);
        safeStorageSet(this._storageKey(), serialized);
        // Sync with host app sidebar & build overview progress trackers
        safeStorageSet('codelab_progress_' + this.labId, JSON.stringify(completedArr));
        safeStorageSet('sd_codelab_' + this.labId, serialized);
      } catch {}
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
        } catch (_) {}
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
      const dotEl = this.container.querySelector('#cl-status-dot');
      const textEl = this.container.querySelector('#cl-status-text');
      const fileEl = this.container.querySelector('#cl-status-file');
      const durEl = this.container.querySelector('#cl-status-duration');
      const curEl = this.container.querySelector('#cl-status-cursor');
      const langEl = this.container.querySelector('#cl-status-lang');

      if (dotEl) {
        dotEl.className = 'codelab-statusbar__dot' +
          (this.runtimeStatusState === 'running' || this.runtimeStatusState === 'fetching' ? ' is-running' :
           this.runtimeStatusState === 'error' ? ' is-error' : '');
      }
      if (textEl) textEl.textContent = this.runtimeStatusText;
      if (fileEl) fileEl.textContent = this.activeFile || 'workspace';
      if (durEl) {
        if (typeof this.lastRunDurationMs === 'number' && !Number.isNaN(this.lastRunDurationMs)) {
          durEl.style.display = 'inline-flex';
          durEl.textContent = `⚡ ${this.lastRunDurationMs.toFixed(1)}ms`;
        } else {
          durEl.style.display = 'none';
        }
      }
      if (curEl && this.cursorPos) {
        curEl.textContent = `Ln ${this.cursorPos.lineNumber || 1}, Col ${this.cursorPos.column || 1}`;
      }
      if (langEl) {
        langEl.textContent = this.lang === 'ts' ? 'TypeScript 5.x' : 'JavaScript (CJS/ESM)';
      }
    }

    _getBaseFilesForModeAndLang(mode, lang) {
      const baseJsSolution = { ...this.referenceFiles };
      const baseJsStarter = {
        ...this.referenceFiles,
        ...(this.guidedConfig?.starterFiles || {})
      };
      if (mode === 'guided' && this.guidedConfig?.starterFiles) {
        return mapFilesToLanguage(baseJsStarter, lang, this.guidedConfig?.tsStarterFiles);
      }
      return mapFilesToLanguage(baseJsSolution, lang, this.guidedConfig?.tsSolutionFiles);
    }

    _isUserCreatedFile(filename) {
      const base = this._getBaseFilesForModeAndLang(this.mode, this.lang);
      return !Object.prototype.hasOwnProperty.call(base, filename);
    }

    _computeInitialFiles() {
      const key = `${this.mode}:${this.lang}`;
      const saved = this.savedState.customFiles?.[key];
      const base = this._getBaseFilesForModeAndLang(this.mode, this.lang);
      if (saved && Object.keys(saved).length > 0) {
        return { ...base, ...saved };
      }
      return base;
    }

    _pickDefaultFile() {
      const names = Object.keys(this.files);
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

    _findEntryFile(kind) {
      const names = Object.keys(this.files);
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
      const pattern = kind === 'test' ? /(^|\/)test\.(js|ts)$/i : /(^|\/)demo\.(js|ts)$/i;
      const found = names.find(f => pattern.test(f));
      if (found) return found;
      if (kind === 'demo') {
        return names.find(f => /\.(js|ts)$/i.test(f) && !/(^|\/)test\.(js|ts)$/i.test(f)) || null;
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
      this.container.querySelectorAll('[data-cl-action="run-demo"], [data-cl-action="run-tests"], [data-cl-action="verify-step"]').forEach(btn => {
        btn.disabled = this.isRunning;
      });
    }

    // ── Render Workbench DOM ───────────────────────────────────────────────
    _renderShell() {
      if (this.themeOption !== 'auto') {
        this.container.setAttribute('data-theme', this.themeOption);
        this.container.classList.add(`codelab-workbench--${this.themeOption}`);
      }
      const themeAttr = this.themeOption !== 'auto' ? `data-theme="${escapeHtml(this.themeOption)}"` : '';
      const brandLabel = (this.title && this.title !== 'custom-lab' && this.title !== this.labId) ? this.title : 'code-lab';
      const isGuideCollapsed = !this.hasGuidedLab || this.mode === 'sandbox' || !this.steps.length;
      this.container.innerHTML = `
        <div class="codelab codelab-workbench ${isGuideCollapsed ? 'guide-collapsed' : ''}" id="codelab-${escapeHtml(this.labId)}" ${themeAttr}>
          <!-- Top Bar -->
          <div class="codelab-topbar codelab-toolbar">
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
              ${this.hasGuidedLab ? `
              <span class="codelab-toolbar__sep" aria-hidden="true"></span>
              <div class="codelab-mode-switch" role="tablist" aria-label="Lab Mode">
                <button type="button" role="tab" aria-selected="${this.mode === 'guided'}" class="codelab-mode-btn ${this.mode === 'guided' ? 'active' : ''}" data-cl-mode="guided">
                  ${CL_ICONS.target}
                  <span>Guided Challenge</span>
                </button>
                <button type="button" role="tab" aria-selected="${this.mode === 'sandbox'}" class="codelab-mode-btn ${this.mode === 'sandbox' ? 'active' : ''}" data-cl-mode="sandbox">
                  ${CL_ICONS.code}
                  <span>Reference Sandbox</span>
                </button>
              </div>
              ` : ''}
              ${this.hasMultipleLanguages ? `
              <div class="codelab-lang-switch" role="group" aria-label="Language Selector">
                <button type="button" class="codelab-lang-btn ${this.lang === 'js' ? 'active' : ''}" data-cl-lang="js" data-lang="js" aria-pressed="${this.lang === 'js'}">JS</button>
                <button type="button" class="codelab-lang-btn ${this.lang === 'ts' ? 'active' : ''}" data-cl-lang="ts" data-lang="ts" aria-pressed="${this.lang === 'ts'}">TS</button>
              </div>
              ` : ''}
            </div>

            <div class="codelab-topbar__right">
              <button type="button" class="codelab-btn codelab-btn--stop" id="cl-stop-btn" data-cl-action="stop-run" title="Stop Running Execution" style="display:none">
                ${CL_ICONS.stop}
                <span>Stop</span>
              </button>
              <button type="button" class="codelab-btn codelab-btn--run" data-cl-action="run-demo" title="Run demo.js (⌘+Shift+Enter)">
                ${CL_ICONS.play}
                <span>Run Demo</span>
                <span class="codelab-btn__kbd">⇧⌘↵</span>
              </button>
              <button type="button" class="codelab-btn codelab-btn--test" id="cl-primary-exec-btn" data-cl-action="${(this.hasGuidedLab && this.mode === 'guided') ? 'verify-step' : 'run-tests'}" title="${(this.hasGuidedLab && this.mode === 'guided') ? 'Verify Current Step (⌘+Enter)' : 'Run Test Suite (⌘+Enter)'}">
                ${CL_ICONS.check}
                <span>${(this.hasGuidedLab && this.mode === 'guided') ? 'Verify Step' : 'Run Tests'}</span>
                <span class="codelab-btn__kbd">⌘↵</span>
              </button>
              <span class="codelab-toolbar__sep" aria-hidden="true"></span>
              ${this.hasGuidedLab ? `
              <button type="button" class="codelab-btn codelab-btn--icon ${isGuideCollapsed ? '' : 'active'}" id="cl-toggle-guide-btn" data-cl-action="toggle-guide" title="Toggle Guide Panel" aria-label="Toggle Guide Panel" aria-pressed="${isGuideCollapsed ? 'false' : 'true'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
              </button>
              ` : ''}
              <button type="button" class="codelab-btn codelab-btn--icon" id="cl-toggle-drawer-btn" data-cl-action="toggle-drawer" title="Toggle Terminal Drawer" aria-label="Toggle Terminal Drawer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/></svg>
              </button>
              <button type="button" class="codelab-btn codelab-btn--icon" id="cl-fullscreen-btn" data-cl-action="toggle-fullscreen" title="Toggle Fullscreen IDE (Esc to exit)" aria-label="Toggle Fullscreen IDE">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              </button>
              ${this.onClose ? `
                <button type="button" class="codelab-btn codelab-btn--exit-lab codelab-btn--close-ide" id="cl-close-ide-btn" data-cl-action="close-lab" title="${escapeHtml(this.backLabel ? `Exit Lab (${this.backLabel})` : 'Exit Lab / Back to Build Guide')}" aria-label="Exit Lab">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span class="codelab-btn__label">Exit Lab</span>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Split Body -->
          <div class="codelab-body">
            ${this.hasGuidedLab ? `
            <!-- Left Pane: Guided Instructions / README -->
            <aside class="codelab-guide codelab-pane-left" aria-label="Guided Lab Instructions">
              <div class="codelab-guide__tabs" role="tablist" aria-label="Guide View">
                <button type="button" role="tab" aria-selected="${this.guideTab === 'steps'}" class="codelab-guide__tab ${this.guideTab === 'steps' ? 'active' : ''}" data-cl-guidetab="steps">
                  ${CL_ICONS.list}
                  <span>Guided Steps (${this.steps.length})</span>
                </button>
                <button type="button" role="tab" aria-selected="${this.guideTab === 'readme'}" class="codelab-guide__tab ${this.guideTab === 'readme' ? 'active' : ''}" data-cl-guidetab="readme">
                  ${CL_ICONS.book}
                  <span>Architecture Brief</span>
                </button>
                <button type="button" class="codelab-guide__collapse-btn" data-cl-action="toggle-guide" title="Collapse sidebar" aria-label="Collapse sidebar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              </div>
              <div class="codelab-guide__stepper" id="cl-step-pills"></div>
              <div class="codelab-guide__content" id="cl-guide-content"></div>
              <div class="codelab-guide__footer" id="cl-guide-footer"></div>
            </aside>

            <!-- Interactive Vertical Splitter -->
            <div class="codelab-splitter-v" id="cl-splitter-v" role="separator" aria-orientation="vertical" title="Drag to resize guide panel (double-click to reset)"></div>
            ` : ''}

            <!-- Right Pane: File Explorer + Editor + Bottom Drawer -->
            <div class="codelab-main">
              <div class="codelab-workspace">
                <!-- File Explorer -->
                <div class="codelab-explorer" aria-label="Workspace Files">
                  <div class="codelab-explorer__header">
                    <span>Workspace</span>
                    <div class="codelab-explorer__actions">
                      <button type="button" class="codelab-explorer__btn" data-cl-action="new-file-root" title="New File" aria-label="New File">${CL_ICONS.plus}</button>
                      <button type="button" class="codelab-explorer__btn" data-cl-action="new-folder-root" title="New Folder" aria-label="New Folder">${CL_ICONS.folder}</button>
                    </div>
                    <span id="cl-explorer-lang">${this.lang.toUpperCase()}</span>
                  </div>
                  <div class="codelab-explorer__list" id="cl-explorer-list"></div>
                </div>

                <!-- Editor Column -->
                <div class="codelab-editor-col">
                  <div class="codelab-tabs codelab-file-tabs" id="cl-file-tabs" role="tablist" aria-label="Open Files"></div>
                  <div class="codelab-breadcrumbs" id="cl-breadcrumbs" aria-label="Editor Breadcrumbs"></div>
                  <div class="codelab-editor-wrap">
                    <div class="codelab-monaco-host" id="cl-monaco-host"></div>
                    <div class="codelab-fallback-wrap" id="cl-fallback-wrap" style="display:none">
                      <div class="codelab-fallback-gutter" id="cl-fallback-gutter" aria-hidden="true">1</div>
                      <textarea class="codelab-fallback-editor" id="cl-fallback-editor" spellcheck="false" aria-label="Code Editor"></textarea>
                    </div>
                    <div class="codelab-md-preview prose" id="cl-md-preview" style="display:none"></div>
                    <div class="codelab-empty-editor" id="cl-empty-editor" style="display:none"></div>
                  </div>
                </div>
              </div>

              <!-- Interactive Horizontal Splitter -->
              <div class="codelab-splitter-h" id="cl-splitter-h" role="separator" aria-orientation="horizontal" title="Drag to resize console drawer (double-click to reset)"></div>

              <!-- Bottom Drawer -->
              <div class="codelab-drawer codelab-bottom" id="cl-drawer">
                <div class="codelab-drawer__bar">
                  <div class="codelab-drawer__tabs" role="tablist" aria-label="Execution Output Panels">
                    <button type="button" role="tab" aria-selected="${this.drawerTab === 'tests'}" class="codelab-drawer__tab ${this.drawerTab === 'tests' ? 'active' : ''}" data-cl-drawertab="tests">
                      ${CL_ICONS.check}
                      <span>Test Suite</span>
                      <span class="codelab-drawer__pill" id="cl-test-pill">Ready</span>
                    </button>
                    <button type="button" role="tab" aria-selected="${this.drawerTab === 'terminal'}" class="codelab-drawer__tab ${this.drawerTab === 'terminal' ? 'active' : ''}" data-cl-drawertab="terminal">
                      ${CL_ICONS.terminal}
                      <span>Terminal &amp; REPL</span>
                    </button>
                    <button type="button" role="tab" aria-selected="${this.drawerTab === 'ports'}" class="codelab-drawer__tab ${this.drawerTab === 'ports' ? 'active' : ''}" data-cl-drawertab="ports">
                      ${CL_ICONS.radio}
                      <span>Ports</span>
                      <span class="codelab-drawer__pill" id="cl-ports-pill">${this.portTable && typeof this.portTable.listServers === 'function' ? this.portTable.listServers().length : 0} open</span>
                    </button>
                    <button type="button" role="tab" aria-selected="${this.drawerTab === 'preview'}" class="codelab-drawer__tab ${this.drawerTab === 'preview' ? 'active' : ''}" data-cl-drawertab="preview" title="In-browser Web Preview">
                      ${CL_ICONS.externalLink || CL_ICONS.radio || ''}
                      <span>Web Preview</span>
                    </button>
                    <button type="button" role="tab" aria-selected="${this.drawerTab === 'network'}" class="codelab-drawer__tab ${this.drawerTab === 'network' ? 'active' : ''}" data-cl-drawertab="network">
                      ${CL_ICONS.activity}
                      <span>Network</span>
                      <span class="codelab-drawer__pill" id="cl-network-pill">${(this.lastHttpTrace || []).length} reqs</span>
                    </button>
                    <button type="button" role="tab" aria-selected="${this.drawerTab === 'inspector'}" class="codelab-drawer__tab ${this.drawerTab === 'inspector' ? 'active' : ''}" data-cl-drawertab="inspector">
                      ${CL_ICONS.database}
                      <span>Virtual Disk &amp; HTTP</span>
                      <span class="codelab-drawer__pill" id="cl-vfs-pill">0 files</span>
                    </button>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="clear-terminal" title="Clear Output" style="padding:2px 6px;font-size:11px;">Clear</button>
                    <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="toggle-drawer" title="Minimize/Expand Drawer" aria-label="Minimize or Expand Drawer" style="padding:2px 6px;font-size:11px;">${CL_ICONS.chevronsUpDown}</button>
                  </div>
                </div>
                <div class="codelab-drawer__body" id="cl-drawer-body"></div>
              </div>
            </div>
          </div>

          <!-- Status Bar Footer -->
          <footer class="codelab-statusbar" id="cl-statusbar" role="status" aria-live="polite">
            <div class="codelab-statusbar__left">
              <span class="codelab-statusbar__item" id="cl-status-runtime">
                <span class="codelab-statusbar__dot" id="cl-status-dot"></span>
                <span id="cl-status-text">Node.js v22 Worker · Idle</span>
              </span>
              <span class="codelab-statusbar__sep">·</span>
              <span class="codelab-statusbar__item" id="cl-status-file">${escapeHtml(this.activeFile || 'workspace')}</span>
            </div>
            <div class="codelab-statusbar__right">
              <span class="codelab-statusbar__item" id="cl-status-duration" style="display:none"></span>
              <span class="codelab-statusbar__item" id="cl-status-cursor">Ln 1, Col 1</span>
              <span class="codelab-statusbar__sep">·</span>
              <span class="codelab-statusbar__item">UTF-8</span>
              <span class="codelab-statusbar__sep">·</span>
              <span class="codelab-statusbar__item" id="cl-status-lang">${this.lang === 'ts' ? 'TypeScript 5.x' : 'JavaScript (CJS/ESM)'}</span>
            </div>
          </footer>

          <!-- Solution, Diff, Command Palette & Packages Modal Container -->
          <div id="cl-modal-slot"></div>
          <div id="cl-context-menu-slot"></div>
          <!-- Port / Web Preview Toast Notifications -->
          <div class="codelab-toast-container" id="cl-toast-container" role="status" aria-live="polite"></div>
        </div>
      `;

      this._renderStepPills();
      this._renderGuidePane();
      this._renderFileLists();
      this._renderBreadcrumbs();
      this._renderDrawerBody();
      this._updateStatusBar();
      this._updateRunStateUI();
    }

    _detectActiveSymbol(filePath) {
      if (!filePath || !this.files || typeof this.files[filePath] !== 'string') return '';
      if (this.mode === 'guided' && this.steps && this.steps.length > 0) {
        const step = this.steps[this.activeStepIndex];
        if (step) {
          const rawTarget = step.targetFile || '';
          const stepTarget = this.lang === 'ts' && rawTarget ? rawTarget.replace(/\.js$/, '.ts') : rawTarget;
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
      const targetFile = this.lang === 'ts' && step.targetFile ? step.targetFile.replace(/\.js$/, '.ts') : (step.targetFile || this._pickDefaultFile());
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
          if (folder) getOrCreateDirNode(folder);
        }
      }

      for (const filePath of this._orderedFileNames()) {
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash === -1) {
          rootNode.files.set(filePath, filePath);
        } else {
          const dirPath = filePath.slice(0, lastSlash);
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
          if (f) set.add(f);
        }
      }
      for (const filePath of this._orderedFileNames()) {
        const idx = filePath.lastIndexOf('/');
        if (idx <= 0) continue;
        const parts = filePath.slice(0, idx).split('/');
        let running = '';
        for (const p of parts) {
          running = running ? `${running}/${p}` : p;
          set.add(running);
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
      const explorerEl = this.container.querySelector('#cl-explorer-list');
      const tabsEl = this.container.querySelector('#cl-file-tabs');
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
          treeHtml += `
            <div class="codelab-folder-item ${isCollapsed ? 'collapsed' : 'expanded'}" data-cl-folder="${escapeHtml(fNode.fullPath)}" data-folder="${escapeHtml(fNode.fullPath)}" data-cl-drop-folder="${escapeHtml(fNode.fullPath)}" data-depth="${depth}" style="padding-left: ${indent}px;">
              <button type="button" class="codelab-chevron" data-cl-action="toggle-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="${isCollapsed ? 'Expand folder' : 'Collapse folder'}" aria-label="${isCollapsed ? 'Expand folder' : 'Collapse folder'}">
                ${isCollapsed ? CL_ICONS.chevronRight : CL_ICONS.chevronDown}
              </button>
              <span class="codelab-folder-icon">${CL_ICONS.folder}</span>
              <span class="codelab-folder-name" title="${escapeHtml(fNode.name)}">${escapeHtml(fNode.name)}</span>
              <div class="codelab-node-actions">
                <button type="button" class="codelab-node-action" data-cl-action="new-file-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="New File in ${escapeHtml(fNode.name)}">${CL_ICONS.plus}</button>
                <button type="button" class="codelab-node-action" data-cl-action="new-folder-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="New Folder in ${escapeHtml(fNode.name)}">${CL_ICONS.folder}</button>
                <button type="button" class="codelab-node-action" data-cl-action="delete-folder" data-cl-folder="${escapeHtml(fNode.fullPath)}" title="Delete Folder">${CL_ICONS.trash}</button>
              </div>
            </div>
          `;

          if (this.creatingItem && this.creatingItem.parentFolder === fNode.fullPath && !isCollapsed) {
            const createIndent = (depth + 1) * 14 + 10;
            treeHtml += `
              <div class="codelab-tree-create-row" style="padding-left: ${createIndent}px;">
                <span class="codelab-tree-create-icon">${this.creatingItem.type === 'folder' ? CL_ICONS.folder : CL_ICONS.file}</span>
                <input type="text" id="cl-tree-create-input" class="codelab-tree-input" placeholder="${this.creatingItem.type === 'folder' ? 'folder-name' : 'filename.' + this.lang}" autocomplete="off" spellcheck="false" />
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
          const badge = fullPath.endsWith('.md') ? 'DOC' : fullPath.endsWith('.json') ? 'PKG' : /(^|\/)test\./i.test(fullPath) ? 'TEST' : /(^|\/)demo\./i.test(fullPath) ? 'DEMO' : 'SRC';
          const ext = fullPath.endsWith('.ts') ? 'ts' : fullPath.endsWith('.js') ? 'js' : fullPath.endsWith('.json') ? 'json' : fullPath.endsWith('.md') ? 'md' : 'txt';
          const fileIcon = ext === 'json' ? CL_ICONS.database : ext === 'md' ? CL_ICONS.book : CL_ICONS.file;
          const indent = depth * 14 + 10;
          treeHtml += `
            <button type="button" class="codelab-file-item ${isActive ? 'active' : ''}" draggable="true" data-cl-file="${escapeHtml(fullPath)}" data-file="${escapeHtml(fullPath)}" data-depth="${depth}" style="padding-left: ${indent}px;">
              <span class="codelab-file-icon">${fileIcon}</span>
              <span class="codelab-file-name" title="${escapeHtml(baseName)}">${escapeHtml(baseName)}</span>
              <span class="codelab-file-badge">${badge}</span>
            </button>
          `;
        }
      };

      if (this.creatingItem && this.creatingItem.parentFolder === rootParent) {
        treeHtml += `
          <div class="codelab-tree-create-row" style="padding-left: 10px;">
            <span class="codelab-tree-create-icon">${this.creatingItem.type === 'folder' ? CL_ICONS.folder : CL_ICONS.file}</span>
            <input type="text" id="cl-tree-create-input" class="codelab-tree-input" placeholder="${this.creatingItem.type === 'folder' ? 'folder-name' : 'filename.' + this.lang}" autocomplete="off" spellcheck="false" />
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

      renderNode(renderRoot, 0);
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

      // Tree inline creation input listeners
      const treeInput = explorerEl.querySelector('#cl-tree-create-input');
      if (treeInput) {
        treeInput.focus();
        treeInput.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            this.creatingItem = null;
            this._renderFileLists();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const val = (treeInput.value || '').trim();
            const item = this.creatingItem;
            this.creatingItem = null;
            if (val && item) {
              const full = item.parentFolder ? `${item.parentFolder}/${val}` : val;
              if (item.type === 'folder') {
                this.createFolder(full);
              } else {
                this.createFile(full);
              }
            } else {
              this._renderFileLists();
            }
          }
        });
        treeInput.addEventListener('blur', () => {
          if (this.creatingItem) {
            this.creatingItem = null;
            this._renderFileLists();
          }
        });
      }

      // Tabs rendering
      const openTabs = Array.isArray(this.openTabs) ? this.openTabs : [];
      const tabsHtml = openTabs.map(f => {
        const isActive = f === this.activeFile;
        const ext = f.endsWith('.ts') ? 'ts' : f.endsWith('.js') ? 'js' : f.endsWith('.json') ? 'json' : f.endsWith('.md') ? 'md' : 'txt';
        return `
          <div role="tab" tabindex="0" aria-selected="${isActive}" class="codelab-tab ${isActive ? 'active' : ''}" data-cl-file="${escapeHtml(f)}" data-tab-file="${escapeHtml(f)}">
            <span class="codelab-tab__ext codelab-tab__ext--${ext}">${ext.toUpperCase()}</span>
            <span class="codelab-tab__label">${escapeHtml(f)}</span>
            <button type="button" class="codelab-tab__close" data-action="close-tab" data-cl-file="${escapeHtml(f)}" title="Close ${escapeHtml(f)}" aria-label="Close ${escapeHtml(f)}">×</button>
          </div>
        `;
      }).join('');

      const newFileControl = this.isCreatingFile
        ? `<form class="codelab-new-file-form" id="cl-new-file-form">
             <input type="text" class="codelab-new-file-input" id="cl-new-file-input" placeholder="helper.${this.lang}" autocomplete="off" spellcheck="false" aria-label="New file name" />
           </form>`
        : `<button type="button" class="codelab-tab-add" data-cl-action="new-file" title="Create New File in Workspace" aria-label="Create New File">+</button>`;

      const { npmPackages, builtinModules } = this._detectPackages();
      const pkgBadge = npmPackages.length > 0 ? `${npmPackages.length} npm` : `${builtinModules.length} std`;
      const pkgBtnHtml = `
        <button type="button" class="codelab-pkg-btn" data-cl-action="open-packages" title="Manage NPM Packages &amp; Node.js Built-ins">
          ${CL_ICONS.package}
          <span>Packages</span>
          <span class="codelab-drawer__pill" style="padding:0 5px;font-size:10px;">${pkgBadge}</span>
        </button>
      `;

      tabsEl.innerHTML = tabsHtml + newFileControl + pkgBtnHtml;

      if (this.isCreatingFile) {
        const input = tabsEl.querySelector('#cl-new-file-input');
        const form = tabsEl.querySelector('#cl-new-file-form');
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

    createFolder(folderPath) {
      let clean = String(folderPath).trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return false;
      const parts = clean.split('/');
      let cur = '';
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        this.folders.add(cur);
      }
      this._saveState();
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

    moveFile(srcPath, dest) {
      if (!srcPath || this.files[srcPath] === undefined) return false;
      const baseName = srcPath.split('/').pop();
      const cleanDest = String(dest || '').trim().replace(/^\/+|\/+$/g, '');
      const isDestFolder = cleanDest === '' || this.folders.has(cleanDest) || (!cleanDest.split('/').pop().includes('.') && this.files[cleanDest] === undefined);
      const targetPath = isDestFolder
        ? (cleanDest ? `${cleanDest}/${baseName}` : baseName)
        : cleanDest;

      if (targetPath === srcPath) return false;
      if (this.files[targetPath] !== undefined) return false;

      const parts = targetPath.split('/');
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        this.folders.add(cur);
        this.collapsedFolders.delete(cur);
      }

      const content = this.files[srcPath];
      delete this.files[srcPath];
      this.files[targetPath] = content;

      const oldModel = this.models.get(srcPath);
      if (oldModel) {
        oldModel.dispose();
        this.models.delete(srcPath);
      }
      this._getOrCreateModel(targetPath);

      if (Array.isArray(this.openTabs)) {
        const idx = this.openTabs.indexOf(srcPath);
        if (idx !== -1) {
          this.openTabs.splice(idx, 1, targetPath);
        }
      }

      if (this.activeFile === srcPath) {
        this.activeFile = targetPath;
      }

      this._saveState();
      this._syncActiveFileToView();
      return true;
    }

    renameFile(oldPath, newPath) {
      return this.moveFile(oldPath, newPath);
    }

    renameFolder(oldFolder, newFolder) {
      const oldPrefix = String(oldFolder).trim().replace(/^\/+|\/+$/g, '');
      const newPrefix = String(newFolder).trim().replace(/^\/+|\/+$/g, '');
      if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) return false;

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

      const fileRenames = [];
      for (const filePath of Object.keys(this.files)) {
        if (filePath.startsWith(oldPrefix + '/')) {
          const newFilePath = newPrefix + filePath.slice(oldPrefix.length);
          fileRenames.push({ oldPath: filePath, newPath: newFilePath, content: this.files[filePath] });
        }
      }

      for (const { oldPath, newPath, content } of fileRenames) {
        delete this.files[oldPath];
        this.files[newPath] = content;

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
        }
      }

      this._saveState();
      this._syncActiveFileToView();
      return true;
    }

    deleteFolder(folderPath) {
      const clean = String(folderPath).trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return false;

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

      const matchingFiles = Object.keys(this.files).filter(f => f.startsWith(clean + '/'));
      for (const f of matchingFiles) {
        delete this.files[f];
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

      if (this.activeFile && this.activeFile.startsWith(clean + '/')) {
        this.activeFile = this.openTabs && this.openTabs.length > 0 ? this.openTabs[0] : null;
      }

      this._saveState();
      this._syncActiveFileToView();
      return true;
    }

    createFile(rawName, initialContent = null) {
      let clean = String(rawName).trim().replace(/^\/+/, '');
      if (!clean) return;
      if (!/\.(js|ts|json|md|txt)$/i.test(clean) && !clean.includes('.')) {
        clean += `.${this.lang}`;
      }
      if (this.files[clean] !== undefined) {
        this.openFile(clean);
        return;
      }
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
          : `'use strict';\n\n// ${clean}\n`;
      }
      this._saveState();
      this._getOrCreateModel(clean);
      this._emitEvent('codelab:file-create', { labId: this.labId, filename: clean, content: this.files[clean] });
      this.openFile(clean);
    }

    duplicateFile(filename) {
      if (!filename || this.files[filename] === undefined) return null;
      const dotIdx = filename.lastIndexOf('.');
      const base = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
      const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
      let candidate = `${base}.copy${ext}`;
      let counter = 2;
      while (this.files[candidate] !== undefined) {
        candidate = `${base}.copy${counter}${ext}`;
        counter++;
      }
      this.createFile(candidate, this.files[filename]);
      return candidate;
    }

    closeTab(filename) {
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

      this._saveState();
      this._syncActiveFileToView();
    }

    closeOtherTabs(keepFilename) {
      if (!Array.isArray(this.openTabs)) return;
      if (keepFilename && this.files[keepFilename] !== undefined) {
        this.openTabs = [keepFilename];
        this.activeFile = keepFilename;
      }
      this._saveState();
      this._syncActiveFileToView();
    }

    closeAllTabs() {
      this.openTabs = [];
      this.activeFile = null;
      this._saveState();
      this._syncActiveFileToView();
    }

    deleteFile(filename) {
      if (!filename || this.files[filename] === undefined) return false;
      delete this.files[filename];
      const model = this.models.get(filename);
      if (model) {
        model.dispose();
        this.models.delete(filename);
      }
      let tabIdx = -1;
      if (Array.isArray(this.openTabs)) {
        tabIdx = this.openTabs.indexOf(filename);
        if (tabIdx !== -1) {
          this.openTabs.splice(tabIdx, 1);
        }
      }
      this._saveState();
      if (this.activeFile === filename) {
        if (this.openTabs && this.openTabs.length > 0) {
          this.activeFile = this.openTabs[Math.max(0, Math.min(tabIdx, this.openTabs.length - 1))];
        } else {
          this.activeFile = null;
        }
      }
      this._emitEvent('codelab:file-delete', { labId: this.labId, filename });
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
      });

      // Update pills
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

      if (this.drawerTab === 'terminal') {
        const logsHtml = this.terminalLogs
          .map(item => {
            const html = ansiToHtml ? ansiToHtml(item.text || '') : escapeHtml(item.text || '');
            return `<div class="codelab-log-line ${escapeHtml(item.type || '')}">${html}</div>`;
          })
          .join('');
        const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
        const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;
        bodyEl.innerHTML = `<div class="codelab-terminal" id="cl-terminal-surface" tabindex="0"><div class="codelab-terminal__log" id="cl-terminal-log">${logsHtml}</div><div class="codelab-pty__active-line" id="cl-pty-active-line"><span class="codelab-pty__prompt">${escapeHtml(promptLabel)} </span><span class="codelab-pty__before">${escapeHtml(this._ptyInputBeforeCursor || '')}</span><span class="codelab-pty__cursor blink">&#x2588;</span><span class="codelab-pty__after">${escapeHtml(this._ptyInputAfterCursor || '')}</span></div><form class="codelab-repl" id="cl-repl-form" style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;"><span class="codelab-repl__prompt">${escapeHtml(promptLabel)}</span><input type="text" class="codelab-repl__input" id="cl-repl-input" placeholder="ls, pwd, cat file.js, node demo.js, node test.js, or JS/TS expression…" autocomplete="off" spellcheck="false" aria-label="REPL command input"></form></div>`;
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
          input.value = (this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || '');
          input.addEventListener('input', () => {
            const val = input.value || '';
            const pos = (input.selectionStart !== undefined && input.selectionStart !== null) ? input.selectionStart : val.length;
            this._ptyInputBeforeCursor = val.slice(0, pos);
            this._ptyInputAfterCursor = val.slice(pos);
            this._updatePtyActiveLine();
          });
          input.addEventListener('keydown', e => {
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
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
              e.preventDefault();
              this._handleInterrupt();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
              e.preventDefault();
              if (this.inRepl) {
                this.inRepl = false;
                this.terminalLogs.push({ type: 'stdout', text: 'Exiting REPL...' });
                this._renderDrawerBody();
                const nextInput = this.container.querySelector('#cl-repl-input');
                if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
              }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
              e.preventDefault();
              this.terminalLogs = [];
              this._renderDrawerBody();
              const nextInput = this.container.querySelector('#cl-repl-input');
              if (nextInput && typeof nextInput.focus === 'function') nextInput.focus();
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
      }
    }

    _appendTerminalStream(type = 'stdout', chunk = '') {
      if (chunk === null || chunk === undefined || chunk === '') return;
      const rawText = String(chunk);

      if (this.ptyEngine && typeof this.ptyEngine.writeStreamChunk === 'function') {
        try {
          this.ptyEngine.writeStreamChunk(rawText, type);
        } catch (_) {}
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
      const commitActiveLine = () => {
        this.terminalLogs.push({ type: this._activeStreamType || type, text: this._activeStreamLine });
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

    _flushTerminalStream() {
      if (this._activeStreamLine) {
        this.terminalLogs.push({
          type: this._activeStreamType || 'stdout',
          text: this._activeStreamLine
        });
        this._activeStreamLine = '';
        this._activeStreamEl = null;
      }
    }

    _handleInterrupt() {
      const isCommandRunning = Boolean(this.isRunning || this._activeCommandAbortController);
      const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
      const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;

      if (isCommandRunning) {
        if (this._activeCommandAbortController) {
          try {
            this._activeCommandAbortController.abort('SIGINT');
          } catch (_) {}
          this._activeCommandAbortController = null;
        }

        if (typeof root.CodeLabRuntime?.cancelWorkerExecution === 'function') {
          try {
            root.CodeLabRuntime.cancelWorkerExecution('SIGINT: Interrupted by user (Ctrl+C)', this.instanceId);
          } catch (_) {}
        }

        this.isRunning = false;
        this._setRuntimeStatus('idle', 'Ready · Node v22 VFS');
        this._updateRunStateUI();

        this._flushTerminalStream();
        this.terminalLogs.push({ type: 'stdout', text: '^C' });
      } else {
        if (this.inRepl) {
          this.inRepl = false;
          this.terminalLogs.push({ type: 'stdout', text: '^C\nExiting REPL...' });
        } else {
          const currentInput = (this._ptyInputBeforeCursor || '') + (this._ptyInputAfterCursor || '');
          this.terminalLogs.push({ type: 'stdout', text: `${promptLabel} ${currentInput}^C` });
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
      const beforeEl = this.container.querySelector('.codelab-pty__before');
      const afterEl = this.container.querySelector('.codelab-pty__after');
      const promptEl = this.container.querySelector('.codelab-pty__prompt');
      const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
      const promptLabel = this.inRepl ? '> ' : `codelab:${cwdShort}$`;

      if (promptEl) promptEl.textContent = promptLabel + ' ';
      if (beforeEl) beforeEl.textContent = this._ptyInputBeforeCursor || '';
      if (afterEl) afterEl.textContent = this._ptyInputAfterCursor || '';
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
          this.terminalLogs.push({ type: 'system', text: `${promptLabel} ${currentInput}` });
          this.terminalLogs.push({ type: 'stdout', text: candidates.join('  ') });
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

    _getCompletionCandidates(currentInput) {
      const line = currentInput || '';
      const lastSpaceIdx = line.lastIndexOf(' ');
      const token = lastSpaceIdx === -1 ? line : line.slice(lastSpaceIdx + 1);
      const isFirstToken = lastSpaceIdx === -1;

      if (isFirstToken) {
        const commands = [
          'cat', 'cd', 'clear', 'cp', 'curl', 'echo', 'env', 'export', 'find',
          'grep', 'head', 'help', 'history', 'jobs', 'kill', 'ls', 'mkdir', 'mv',
          'node', 'npm', 'npx', 'ps', 'pwd', 'rm', 'sed', 'sort', 'tail', 'touch',
          'uniq', 'unset', 'wc', 'which', 'bun'
        ];
        return commands.filter(c => c.startsWith(token));
      } else {
        const vfsPaths = [];
        const cwd = this.cwd || '/workspace';
        const normCwd = cwd.endsWith('/') ? cwd : cwd + '/';

        for (const p of Object.keys(this.files || {})) {
          const fullPath = p.startsWith('/') ? p : normCwd + p;
          if (token.startsWith('/')) {
            vfsPaths.push(fullPath);
          } else if (fullPath.startsWith(normCwd)) {
            vfsPaths.push(fullPath.slice(normCwd.length));
          } else {
            vfsPaths.push(p);
          }
        }
        for (const folder of (this.folders || [])) {
          const fullFolder = folder.startsWith('/') ? folder : normCwd + folder;
          if (token.startsWith('/')) {
            vfsPaths.push(fullFolder + '/');
          } else if (fullFolder.startsWith(normCwd)) {
            vfsPaths.push(fullFolder.slice(normCwd.length) + '/');
          } else {
            vfsPaths.push(folder + '/');
          }
        }
        const unique = Array.from(new Set(vfsPaths));
        return unique.filter(p => p.startsWith(token));
      }
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
                  <th>Status</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${servers.map(s => `
                  <tr>
                    <td><span class="codelab-port-tag">${s.port}</span></td>
                    <td><a href="http://127.0.0.1:${s.port}/" target="_blank" class="codelab-port-link">http://127.0.0.1:${s.port}/</a></td>
                    <td><span class="codelab-badge">${escapeHtml(s.protocol || 'HTTP/1.1')}</span></td>
                    <td><code>${escapeHtml(s.service || (s.pid ? `PID ${s.pid}` : 'node'))}</code></td>
                    <td><span class="codelab-port-status codelab-port-status--listening"><span class="codelab-port-status-dot"></span>LISTENING</span></td>
                    <td style="text-align:right;white-space:nowrap;">
                      <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--primary" data-cl-action="open-web-preview" data-port="${s.port}" data-cl-port="${s.port}">Preview</button>
                      <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="open-port-client" data-port="${s.port}" data-cl-port="${s.port}">Open in Client</button>
                      <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--danger" data-cl-action="stop-port" data-port="${s.port}" data-cl-port="${s.port}">Stop</button>
                    </td>
                  </tr>
                `).join('')}
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
          responseBodyView = `<iframe class="codelab-response-iframe" sandbox="allow-same-origin" srcdoc="${escapeHtml(lastRes.body)}"></iframe>`;
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
              <span>${CL_ICONS.radio || ''} Active Port Listeners</span>
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

      const filtered = traces.filter(t => {
        if (filter.method && filter.method !== 'ALL' && (t.method || 'GET').toUpperCase() !== filter.method) return false;
        if (filter.status && filter.status !== 'ALL') {
          const s = Number(t.status || 0);
          if (filter.status === '2xx' && (s < 200 || s >= 300)) return false;
          if (filter.status === '3xx' && (s < 300 || s >= 400)) return false;
          if (filter.status === '4xx' && (s < 400 || s >= 500)) return false;
          if (filter.status === '5xx' && (s < 500 || s >= 600)) return false;
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
              ${traces.length === 0 ? 'No network requests recorded yet. Run a demo, tests, or send an HTTP request to inspect traffic.' : 'No network requests match the active filters.'}
            </td>
          </tr>
        `;
      } else {
        const maxDuration = Math.max(1, ...filtered.map(t => t.durationMs || 1));
        rowsHtml = filtered.map(t => {
          const status = Number(t.status || 200);
          const statusClass = status < 300 ? 'status-2xx' : (status < 400 ? 'status-3xx' : (status < 500 ? 'status-4xx' : 'status-5xx'));
          const widthPct = Math.min(100, Math.max(8, Math.round(((t.durationMs || 1) / maxDuration) * 100)));
          const isSelected = selectedTrace && String(selectedTrace.id) === String(t.id);
          return `
            <tr class="codelab-net-row ${isSelected ? 'selected' : ''}" data-cl-action="select-net-trace" data-trace-id="${escapeHtml(t.id || '')}" data-cl-trace-id="${escapeHtml(t.id || '')}">
              <td><span class="codelab-status-badge ${statusClass}">${status}</span></td>
              <td><span class="codelab-method-badge codelab-method-${(t.method || 'GET').toLowerCase()}">${escapeHtml(t.method || 'GET')}</span></td>
              <td class="codelab-net-path" title="${escapeHtml(t.url || '/')}">${escapeHtml(t.url || '/')}</td>
              <td><code>${t.port || 3000}</code></td>
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
          <div class="codelab-net-toolbar">
            <input type="text" class="codelab-input" id="cl-net-search" placeholder="Filter URL or method..." value="${escapeHtml(filter.search)}" aria-label="Filter network traces">
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
              <option value="5xx" ${filter.status === '5xx' ? 'selected' : ''}>5xx Server Error</option>
            </select>
            <button type="button" class="codelab-btn" data-cl-action="clear-net-traces">Clear</button>
            <span style="margin-left:auto;font-size:11.5px;color:var(--cl-fg-muted);">${filtered.length} of ${traces.length} requests</span>
          </div>
          <div class="codelab-net-main">
            <div class="codelab-net-table-container">
              <table class="codelab-net-table">
                <thead>
                  <tr>
                    <th style="width:55px;">Status</th>
                    <th style="width:65px;">Method</th>
                    <th>Path</th>
                    <th style="width:60px;">Port</th>
                    <th style="width:75px;">Time</th>
                    <th style="width:70px;">Size</th>
                    <th style="width:140px;">Waterfall</th>
                  </tr>
                </thead>
                <tbody>
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

    _bindNetworkEvents(bodyEl) {
      if (!bodyEl) return;
      const searchInput = bodyEl.querySelector('#cl-net-search');
      if (searchInput) {
        searchInput.addEventListener('input', e => {
          this.networkFilter.search = e.target.value;
          this._renderDrawerBody();
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
      } catch (_) {}

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

    switchDrawerTab(tab) {
      if (!tab) return;
      this.drawerTab = tab;
      this.container.querySelectorAll('[data-cl-drawertab]').forEach(b => {
        const active = b.dataset.clDrawertab === this.drawerTab;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
      });
      const drawer = this.container.querySelector('#cl-drawer');
      if (drawer) drawer.classList.remove('is-minimized');
      this._renderDrawerBody();
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
      } catch (_) {}
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
      const url = (this.options && this.options.previewSwUrl) || 'preview-sw.js';
      try {
        const onMessage = (event) => this._handleServiceWorkerMessage(event);
        if (typeof navigator.serviceWorker.addEventListener === 'function') {
          navigator.serviceWorker.addEventListener('message', onMessage);
        } else {
          navigator.serviceWorker.onmessage = onMessage;
        }
        navigator.serviceWorker.register(url, { scope: (this.options && this.options.previewSwScope) || './' })
          .then((reg) => { this._previewSwRegistration = reg; this._previewSwReady = true; })
          .catch(() => { this._previewSwReady = false; });
      } catch (_) {
        this._previewSwReady = false;
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
      } catch (_) {}
      let bodyText = '';
      try {
        bodyText = res && typeof res.text === 'function' ? await res.text() : String((res && res.body) || '');
      } catch (_) {}
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

    _openWebPreview(port, path = '/') {
      const p = Number(port) || this._firstListeningPort() || 3000;
      this.previewState.port = p;
      this.previewState.path = path || '/';
      this.previewState.url = `http://127.0.0.1:${p}${this.previewState.path}`;
      this.previewState.error = null;
      this.previewHistory = this.previewHistory.slice(0, this.previewHistoryIdx + 1);
      this.previewHistory.push(this.previewState.url);
      this.previewHistoryIdx = this.previewHistory.length - 1;
      this.switchDrawerTab('preview');
      return this._previewLoadPromise || Promise.resolve();
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
              try { win.opener = null; } catch (_) {}
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
      } catch (_) {}
      this.previewState.port = port;
      this.previewState.path = path;
      this.previewState.url = url;
      this.previewState.error = null;
      this.previewHistory = this.previewHistory.slice(0, this.previewHistoryIdx + 1);
      this.previewHistory.push(url);
      this.previewHistoryIdx = this.previewHistory.length - 1;
      this.switchDrawerTab('preview');
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
      } catch (_) {}
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
    }

    _popoutPreview() {
      const url = this._previewUrl();
      let popout = '/__preview/';
      try {
        const u = new URL(url);
        popout = `/__preview/${u.port}${u.pathname}${u.search || ''}`;
      } catch (_) {}
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        try { window.open(popout, '_blank', 'noopener'); } catch (_) {}
      }
      return popout;
    }

    _renderWebPreview(bodyEl) {
      if (!bodyEl) return;
      const renderKey = `${this.previewState.port}|${this.previewState.path}|${this.previewState.frameMode}|${this._previewSwReady}`;
      if (bodyEl.querySelector && bodyEl.querySelector('.codelab-preview') && this._previewRenderKey === renderKey) {
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

      bodyEl.innerHTML = `
        <div class="codelab-preview">
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
            <button type="button" class="codelab-btn codelab-btn--sm" data-cl-action="preview-popout" title="Open in a new browser tab">${CL_ICONS.externalLink || '↗'} <span>Pop Out</span></button>
          </div>
          <div class="codelab-preview-viewport codelab-preview-viewport--${this.previewState.frameMode}" id="cl-preview-viewport">
            <iframe class="codelab-preview-iframe" id="cl-preview-iframe" sandbox="allow-scripts allow-forms allow-same-origin allow-modals" title="Web Preview"></iframe>
          </div>
          <div class="codelab-preview-hint">${servers.length ? 'Serving from the in-browser virtual runtime. Use Pop Out for a standalone tab.' : 'No listening ports detected. Run a server (e.g. <code>node server.js &amp;</code>) to bind a virtual port.'}</div>
        </div>
      `;
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
      const fullUrl = this._previewUrl();
      this.previewState.loading = true;
      this.previewState.error = null;

      if (this._previewSwReady) {
        try {
          const u = new URL(fullUrl);
          if (typeof iframe.removeAttribute === 'function') iframe.removeAttribute('srcdoc');
          iframe.setAttribute('src', `/__preview/${u.port}${u.pathname}${u.search || ''}`);
          this.previewState.loading = false;
          return Promise.resolve();
        } catch (_) {}
      }

      // Fallback (no Service Worker): dispatch via the virtual port table and
      // inline the response with an injected <base> for relative asset URLs.
      return this._dispatchPreviewRequest({ port, url: fullUrl, method: 'GET' })
        .then((res) => {
          let body = res.body || '';
          const contentType = res.headers['content-type'] || res.headers['Content-Type'] || '';
          if (/text\/html/i.test(contentType) && /<head\b/i.test(body) && !/<base\b/i.test(body)) {
            body = body.replace(/<head\b[^>]*>/i, (m) => `${m}<base href="/__preview/${port}/">`);
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
          iframe.setAttribute('srcdoc', msg);
        });
    }

    _syncVfsSnapshot(fsSnapshot, syncDeletionsFromShell = false) {
      let changed = false;

      // 1. Sync from this.shell.vfs if available
      if (this.shell && this.shell.vfs) {
        const shellWorkspaceFiles = new Map();
        const shellWorkspaceFolders = new Set();

        if (this.shell.vfs.files instanceof Map) {
          for (const [p, fileObj] of this.shell.vfs.files.entries()) {
            if (p.startsWith('/workspace/')) {
              const rel = p.slice('/workspace/'.length);
              if (rel && !rel.startsWith('.git/') && !rel.startsWith('node_modules/')) {
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
                const rel = d.slice('/workspace/'.length);
                if (rel && !rel.startsWith('.git') && !rel.startsWith('node_modules')) {
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
              if (entry === '.git' || entry === 'node_modules') continue;
              const full = dir === '/' ? '/' + entry : dir + '/' + entry;
              const rel = relPrefix ? relPrefix + '/' + entry : entry;
              let isDir = false;
              try { isDir = vfs.statSync(full).isDirectory(); } catch (_) {}
              if (isDir) {
                shellWorkspaceFolders.add(rel);
                walk(full, rel);
              } else {
                try {
                  const content = String(vfs.readFileSync(full, 'utf8') ?? '');
                  shellWorkspaceFiles.set(rel, content);
                } catch (_) {}
              }
            }
          };
          walk('/workspace', '');
        }

        for (const folder of shellWorkspaceFolders) {
          if (!this.folders.has(folder)) {
            this.folders.add(folder);
            changed = true;
          }
        }

        // Additions & modifications
        let newFilesCount = 0;
        for (const [rel] of shellWorkspaceFiles.entries()) {
          if (this.files[rel] === undefined) newFilesCount++;
        }
        const autoOpenTab = newFilesCount <= 5;
        for (const [rel, content] of shellWorkspaceFiles.entries()) {
          if (this.files[rel] === undefined || this.files[rel] !== content) {
            this.files[rel] = content;
            if (autoOpenTab && !this.openTabs.includes(rel)) {
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
          }
        }

        // Deletions
        if (syncDeletionsFromShell) {
          for (const rel of Object.keys(this.files)) {
            if (!shellWorkspaceFiles.has(rel)) {
              delete this.files[rel];
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
                    this.activeFile = this.openTabs[Math.max(0, tabIdx - 1)] || this._pickDefaultFile() || null;
                  }
                }
              }
            }
          }
          for (const existingFolder of Array.from(this.folders)) {
            if (!shellWorkspaceFolders.has(existingFolder)) {
              this.folders.delete(existingFolder);
              changed = true;
            }
          }
        }
      }

      // 2. Also sync from snapshot array if provided
      if (Array.isArray(fsSnapshot) && fsSnapshot.length > 0) {
        for (const item of fsSnapshot) {
          if (!item || !item.path) continue;
          if (item.path.startsWith('/workspace/')) {
            const rel = item.path.slice('/workspace/'.length);
            if (!rel || rel.startsWith('.git/') || rel.startsWith('node_modules/')) continue;
            if (item.isDirectory) {
              if (!this.folders.has(rel)) {
                this.folders.add(rel);
                changed = true;
              }
            } else if (item.content !== undefined || item.preview !== undefined) {
              const content = item.content !== undefined ? item.content : (item.preview || '');
              if (this.files[rel] !== content) {
                this.files[rel] = content;
                if (!this.openTabs.includes(rel)) {
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
              }
            }
          }
        }
      }

      if (changed) {
        this._saveState();
        this._renderFileLists();
        this._renderTabs();
        this._syncActiveFileToView();
      }
    }

    _updateFallbackGutter() {
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      const gutterEl = this.container.querySelector('#cl-fallback-gutter');
      if (!fallbackEl || !gutterEl) return;
      const lineCount = Math.max(1, (fallbackEl.value || '').split('\n').length);
      const nums = [];
      for (let i = 1; i <= lineCount; i++) nums.push(i);
      gutterEl.textContent = nums.join('\n');
      gutterEl.scrollTop = fallbackEl.scrollTop;
    }

    // ── Initialize Monaco Editor (with Resilient Line-Numbered Fallback) ────
    _initEditor() {
      const fallbackWrap = this.container.querySelector('#cl-fallback-wrap');
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      const monacoHost = this.container.querySelector('#cl-monaco-host');

      if (fallbackEl) {
        fallbackEl.value = (this.activeFile && this.files[this.activeFile]) ? this.files[this.activeFile] : '';
        this._updateFallbackGutter();

        const updateFallbackCursor = () => {
          const val = fallbackEl.value || '';
          const sel = typeof fallbackEl.selectionStart === 'number' ? fallbackEl.selectionStart : 0;
          const upToCursor = val.slice(0, sel).split('\n');
          const lineNumber = upToCursor.length;
          const column = upToCursor[upToCursor.length - 1].length + 1;
          this.cursorPos = { lineNumber, column, ln: lineNumber, col: column };
          this._updateStatusBar();
          this._renderBreadcrumbs();
        };

        fallbackEl.addEventListener('scroll', () => {
          const gutterEl = this.container.querySelector('#cl-fallback-gutter');
          if (gutterEl) gutterEl.scrollTop = fallbackEl.scrollTop;
        });

        fallbackEl.addEventListener('keyup', updateFallbackCursor);
        fallbackEl.addEventListener('click', updateFallbackCursor);

        fallbackEl.addEventListener('input', () => {
          if (!this.editor && this.activeFile && !this.activeFile.endsWith('.md')) {
            this.files[this.activeFile] = fallbackEl.value;
            this._updateFallbackGutter();
            updateFallbackCursor();
            this._saveState();
            this._notifyCodeChange(this.activeFile, fallbackEl.value);
          }
        });

        fallbackEl.addEventListener('keydown', e => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = fallbackEl.selectionStart;
            const end = fallbackEl.selectionEnd;
            fallbackEl.value = fallbackEl.value.substring(0, start) + '  ' + fallbackEl.value.substring(end);
            fallbackEl.selectionStart = fallbackEl.selectionEnd = start + 2;
            if (this.activeFile) {
              this.files[this.activeFile] = fallbackEl.value;
              this._updateFallbackGutter();
              updateFallbackCursor();
              this._saveState();
              this._notifyCodeChange(this.activeFile, fallbackEl.value);
            }
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

      this._syncActiveFileToView();

      loadMonaco(this.monacoUrl).then(m => {
        this.monaco = m;
        if (!monacoHost) return;
        const isDark = this._resolvedTheme() !== 'light';

        // Create models for all code files
        this._syncAllModels();

        const currentModel = this.activeFile ? this._getOrCreateModel(this.activeFile) : null;
        this.editor = m.editor.create(monacoHost, {
          model: currentModel,
          theme: isDark ? 'codelab-dark' : 'codelab-light',
          fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontSize: 13,
          lineHeight: 20,
          tabSize: 2,
          insertSpaces: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderLineHighlight: 'all',
          bracketPairColorization: { enabled: true }
        });

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
            } else {
              this.runTests();
            }
          });
          this.editor.addCommand(m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.Enter, () => {
            this.runDemo();
          });
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
              this._renderBreadcrumbs();
            }
          });
        }

        if (fallbackWrap) fallbackWrap.style.display = 'none';
        this._syncActiveFileToView();

        // Watch theme changes on <html>
        if (typeof MutationObserver !== 'undefined') {
          this._themeObserver = new MutationObserver(() => {
            const dark = this._resolvedTheme() !== 'light';
            m.editor.setTheme(dark ? 'codelab-dark' : 'codelab-light');
          });
          this._themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
          });
        }
      }).catch(() => {
        // Fallback editor remains visible if offline / CDN blocked
        if (fallbackWrap && this.activeFile && !this.activeFile.endsWith('.md')) {
          fallbackWrap.style.display = 'flex';
          this._updateFallbackGutter();
        }
      });
    }

    _notifyCodeChange(filename, code) {
      if (this.onCodeChange) {
        try { this.onCodeChange(filename, code); } catch (_) {}
      }
      const detail = { labId: this.labId, filename, path: filename, code, content: code };
      this._emitEvent('codelab:change', detail);
      this._emitEvent('codelab:code-change', detail);
      this._updateStatusBar();
      this._renderBreadcrumbs();
    }

    _getOrCreateModel(filename) {
      if (!filename || !this.monaco || !this.monaco.editor) return null;
      const uriParser = (this.monaco.Uri && typeof this.monaco.Uri.parse === 'function')
        ? this.monaco.Uri
        : (this.monaco.editor.Uri && typeof this.monaco.editor.Uri.parse === 'function')
          ? this.monaco.editor.Uri
          : null;
      const rawUri = `file:///${this.labId}/${filename}`;
      const uri = uriParser ? uriParser.parse(rawUri) : { toString: () => rawUri };
      let model = typeof this.monaco.editor.getModel === 'function' ? this.monaco.editor.getModel(uri) : null;
      const lang = filename.endsWith('.ts') ? 'typescript' : filename.endsWith('.json') ? 'json' : filename.endsWith('.md') ? 'markdown' : 'javascript';
      if (!model) {
        model = this.monaco.editor.createModel(this.files[filename] || '', lang, uri);
        if (model && typeof model.onDidChangeContent === 'function') {
          model.onDidChangeContent(() => {
            const val = model.getValue();
            this.files[filename] = val;
            this._saveState();
            this._notifyCodeChange(filename, val);
          });
        }
      } else if (model.getValue() !== (this.files[filename] || '')) {
        model.setValue(this.files[filename] || '');
      }
      this.models.set(filename, model);
      return model;
    }

    _syncAllModels() {
      if (!this.monaco) return;
      for (const filename of Object.keys(this.files)) {
        this._getOrCreateModel(filename);
      }
    }

    _syncActiveFileToView() {
      const monacoHost = this.container.querySelector('#cl-monaco-host');
      const fallbackWrap = this.container.querySelector('#cl-fallback-wrap');
      const fallbackEl = this.container.querySelector('#cl-fallback-editor');
      const mdPreview = this.container.querySelector('#cl-md-preview');
      const emptyEl = this.container.querySelector('#cl-empty-editor');

      if (!this.activeFile || !this.openTabs || this.openTabs.length === 0) {
        if (monacoHost) monacoHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) mdPreview.style.display = 'none';
        if (this.editor) {
          try { this.editor.setModel(null); } catch (_) {}
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

      if (emptyEl) {
        emptyEl.style.display = 'none';
      }

      const isMd = this.activeFile.endsWith('.md');
      if (isMd) {
        if (monacoHost) monacoHost.style.display = 'none';
        if (fallbackWrap) fallbackWrap.style.display = 'none';
        if (mdPreview) {
          mdPreview.style.display = 'block';
          mdPreview.innerHTML = renderSimpleMarkdown(this.files[this.activeFile] || '');
        }
      } else {
        if (mdPreview) mdPreview.style.display = 'none';
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
          fallbackEl.value = this.files[this.activeFile] || '';
          this._updateFallbackGutter();
        }
      }
      this._renderFileLists();
      this._renderBreadcrumbs();
      this._updateStatusBar();
    }

    _renderEmptyEditorContent(emptyEl) {
      if (!emptyEl) return;
      const fileBtns = this._orderedFileNames().map(f => {
        const ext = f.endsWith('.ts') ? 'ts' : f.endsWith('.js') ? 'js' : f.endsWith('.json') ? 'json' : f.endsWith('.md') ? 'md' : 'txt';
        return `
          <button type="button" class="codelab-empty-file-btn" data-cl-file="${escapeHtml(f)}" title="Open ${escapeHtml(f)}">
            <span class="codelab-tab__ext codelab-tab__ext--${ext}">${ext.toUpperCase()}</span>
            <span>${escapeHtml(f)}</span>
          </button>
        `;
      }).join('');

      emptyEl.innerHTML = `
        <div class="codelab-empty-editor__inner">
          <div class="codelab-empty-editor__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <h2 class="codelab-empty-editor__title">No Open Editors</h2>
          <p class="codelab-empty-editor__subtitle">Select a file from the explorer on the left or click a workspace file below to open.</p>
          <div class="codelab-empty-editor__files" role="group" aria-label="Workspace Files">
            ${fileBtns}
          </div>
          <div class="codelab-empty-editor__actions">
            <button type="button" class="codelab-btn codelab-btn--run" data-cl-action="run-demo" title="Run demo.js (⇧⌘↵)">
              ${CL_ICONS.play}
              <span>Run Demo</span>
              <span class="codelab-btn__kbd">⇧⌘↵</span>
            </button>
            <button type="button" class="codelab-btn codelab-btn--test" data-cl-action="run-tests" title="Run Test Suite (⌘↵)">
              ${CL_ICONS.check}
              <span>Run Tests</span>
              <span class="codelab-btn__kbd">⌘↵</span>
            </button>
          </div>
        </div>
      `;
    }

    // ── Event Delegation & Interactive Splitters ───────────────────────────
    _bindEvents() {
      this._bindSplitters();

      this._escHandler = e => {
        if (e.key === 'Escape') {
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
      }

      this.container.addEventListener('keydown', e => {
        const keyLower = (e.key || '').toLowerCase();
        const previewInput = e.target && typeof e.target.closest === 'function'
          ? e.target.closest('#cl-preview-url-input')
          : null;
        if (previewInput && e.key === 'Enter') {
          e.preventDefault();
          this._previewGo(previewInput.value);
          return;
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
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && keyLower === 'p') {
          e.preventDefault();
          this.openCommandPalette('files');
          return;
        }
        if ((e.metaKey || e.ctrlKey) && keyLower === 'c') {
          const hasSelection = typeof window !== 'undefined' && window.getSelection && window.getSelection().toString().length > 0;
          if (!hasSelection && (this.isRunning || this._activeCommandAbortController)) {
            e.preventDefault();
            this._handleInterrupt();
            return;
          }
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            this.runDemo();
          } else if (this.mode === 'guided') {
            this.verifyCurrentStep();
          } else {
            this.runTests();
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
            { label: 'Rename...', shortcut: 'F2', action: 'rename-file', target: fname },
            { label: 'Duplicate File', action: 'duplicate-file', target: fname },
            { divider: true },
            { label: 'Compare with Solution', action: 'compare-solution', target: fname },
            { label: 'Compare with Starter', action: 'compare-starter', target: fname },
            { divider: true },
            { label: 'Download File', action: 'download-file', target: fname },
            { label: 'Delete File', action: 'delete-file', target: fname, danger: true }
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
            { label: 'Rename Folder...', action: 'rename-folder-ctx', target: folder },
            { label: 'Delete Folder', action: 'delete-folder-ctx', target: folder, danger: true }
          ]);
        }
      });

      const handleTabMiddleClick = e => {
        if (e.button === 1) {
          const tabEl = e.target.closest('.codelab-tab');
          if (tabEl && tabEl.dataset.clFile) {
            e.preventDefault();
            e.stopPropagation();
            this.closeTab(tabEl.dataset.clFile);
          }
        }
      };
      this.container.addEventListener('auxclick', handleTabMiddleClick);
      this.container.addEventListener('mousedown', handleTabMiddleClick);

      this.container.addEventListener('click', e => {
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
          else if (act === 'delete-file' && target) this.deleteFile(target);
          else if (act === 'new-file-in-folder') this.startInlineCreate('file', target);
          else if (act === 'new-subfolder') this.startInlineCreate('folder', target);
          else if (act === 'rename-folder-ctx' && target) this.startInlineRename('folder', target);
          else if (act === 'delete-folder-ctx' && target) this.deleteFolder(target);
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
          this.closeModal();
          return;
        }

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
            } catch (_) {}
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
          const fname = closeBtn.dataset.clFile || tabEl.dataset.clFile;
          if (fname) this.closeTab(fname);
          return;
        }

        const deleteBtn = e.target.closest('[data-cl-delete-file]');
        if (deleteBtn) {
          e.stopPropagation();
          this.deleteFile(deleteBtn.dataset.clDeleteFile);
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

        const fileBtn = e.target.closest('[data-cl-file]');
        if (fileBtn) {
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

        const drawerTabBtn = e.target.closest('[data-cl-drawertab]');
        if (drawerTabBtn) {
          this.switchDrawerTab(drawerTabBtn.dataset.clDrawertab);
          return;
        }

        const actionBtn = e.target.closest('[data-cl-action], [data-action]');
        if (actionBtn) {
          const action = actionBtn.dataset.clAction || actionBtn.dataset.action;
          if (action === 'run-demo') this.runDemo();
          else if (action === 'run-tests') this.runTests();
          else if (action === 'stop-run') this.stopExecution();
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
          else if (action === 'open-clone-repo') this.showCloneRepoModal();
          else if (action === 'confirm-clone-repo') {
            const input = this.container.querySelector('#cl-clone-repo-input');
            if (input && input.value.trim()) {
              const repoVal = input.value.trim();
              this.closeModal();
              this.cloneRepo(repoVal, { intoRoot: true }).catch(() => {});
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
          } else if (action === 'close-modal') this.closeModal();
          else if (action === 'apply-solution') this.applyReferenceSolution();
          else if (action === 'reset-lab') this.resetLab();
          else if (action === 'toggle-fullscreen') this.toggleFullscreen();
          else if (action === 'close-lab') {
            if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            }
            if (typeof this.onClose === 'function') this.onClose();
            else if (this.isFullscreen) this.toggleFullscreen();
          } else if (action === 'new-file') {
            this.isCreatingFile = true;
            this._renderFileLists();
          } else if (action === 'new-file-root') {
            this.creatingItem = { type: 'file', parentFolder: this.explorerFolder || '' };
            this._renderFileLists();
          } else if (action === 'new-folder-root') {
            this.creatingItem = { type: 'folder', parentFolder: this.explorerFolder || '' };
            this._renderFileLists();
          } else if (action === 'new-file-folder') {
            const folder = actionBtn.dataset.clFolder || '';
            this.collapsedFolders.delete(folder);
            this.creatingItem = { type: 'file', parentFolder: folder };
            this._renderFileLists();
          } else if (action === 'new-folder-folder') {
            const folder = actionBtn.dataset.clFolder || '';
            this.collapsedFolders.delete(folder);
            this.creatingItem = { type: 'folder', parentFolder: folder };
            this._renderFileLists();
          } else if (action === 'delete-folder') {
            const folder = actionBtn.dataset.clFolder;
            if (folder) this.deleteFolder(folder);
          } else if (action === 'rename-folder') {
            const folder = actionBtn.dataset.clFolder;
            if (folder) {
              const newName = typeof window !== 'undefined' && window.prompt ? window.prompt('New folder name:', folder) : null;
              if (newName && newName.trim() && newName.trim() !== folder) {
                this.renameFolder(folder, newName.trim());
              }
            }
          } else if (action === 'toggle-folder') {
            const folder = actionBtn.dataset.clFolder || (actionBtn.closest('[data-cl-folder]')?.dataset.clFolder);
            if (folder) this.toggleFolder(folder);
          } else if (action === 'toggle-guide') {
            this.toggleGuide();
          } else if (action === 'toggle-drawer') {
            const drawer = this.container.querySelector('#cl-drawer');
            if (drawer) drawer.classList.toggle('is-minimized');
            if (this.editor) setTimeout(() => this.editor.layout(), 50);
          } else if (action === 'clear-terminal') {
            this.terminalLogs = [];
            this.lastTestResults = [];
            this._renderDrawerBody();
          } else if (action === 'toggle-hint') {
            const box = this.container.querySelector('#cl-hint-box');
            if (box) box.classList.toggle('open');
          } else if (action === 'open-web-preview') {
            const port = Number(actionBtn.dataset.port || actionBtn.dataset.clPort);
            if (port) this._openWebPreview(port);
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
          } else if (action === 'open-port-client') {
            const port = actionBtn.dataset.port;
            if (port) {
              this.httpClientUrl = `http://localhost:${port}/`;
              this._renderDrawerBody();
            }
          } else if (action === 'stop-port') {
            const port = Number(actionBtn.dataset.port);
            if (port) {
              if (this.shell && this.shell.portTable && typeof this.shell.portTable.unregister === 'function') {
                this.shell.portTable.unregister(port);
              }
              this.activePorts = (this.activePorts || []).filter(p => Number(typeof p === 'object' ? p.port : p) !== port);
              this._renderDrawerBody();
            }
          } else if (action === 'http-send') {
            this._sendHttpClientRequest();
          } else if (action === 'http-tab') {
            this.httpActiveTab = actionBtn.dataset.httpTab || 'headers';
            this._renderDrawerBody();
          } else if (action === 'clear-net-traces') {
            this.lastHttpTrace = [];
            this.selectedNetTraceIdx = null;
            this._renderDrawerBody();
          } else if (action === 'select-net-trace') {
            const idx = Number(actionBtn.dataset.traceIdx);
            this.selectedNetTraceIdx = Number.isNaN(idx) ? null : idx;
            this._renderDrawerBody();
          } else if (action === 'close-net-detail') {
            this.selectedNetTraceIdx = null;
            this._renderDrawerBody();
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

    // ── Right-Click Context Menu ────────────────────────────────────────────
    openContextMenu(x, y, items = []) {
      const slot = this.container.querySelector('#cl-context-menu-slot');
      if (!slot) return;
      const safeX = Math.max(8, Number(x) || 80);
      const safeY = Math.max(8, Number(y) || 80);
      this._contextMenuItems = items;

      const itemsHtml = items.map(item => {
        if (item.divider) {
          return '<div class="codelab-context-menu__divider" role="separator"></div>';
        }
        return `
          <button type="button" class="codelab-context-menu__item ${item.danger ? 'is-danger' : ''}" role="menuitem" data-ctx-action="${escapeHtml(item.action || '')}" data-ctx-target="${escapeHtml(item.target || '')}">
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
    }

    closeContextMenu() {
      const slot = this.container.querySelector('#cl-context-menu-slot');
      if (slot) slot.innerHTML = '';
      this._contextMenuItems = null;
    }

    // ── VS Code Command Palette & Quick Open ────────────────────────────────
    _getPaletteCommands() {
      return [
        { id: 'run-demo', label: 'CodeLab: Run Demo Script', shortcut: '⇧⌘↵', action: () => this.runDemo() },
        { id: 'run-tests', label: 'CodeLab: Run Unit Tests', shortcut: '⌘↵', action: () => this.runTests() },
        { id: 'verify-step', label: 'CodeLab: Verify Current Guided Step', shortcut: '⌘↵', action: () => this.verifyCurrentStep() },
        { id: 'compare-solution', label: 'CodeLab: Compare Active File with Reference Solution (Diff)', action: () => this.showDiffModal(this.activeFile || this._pickDefaultFile(), 'solution') },
        { id: 'compare-starter', label: 'CodeLab: Compare Active File with Starter Template (Diff)', action: () => this.showDiffModal(this.activeFile || this._pickDefaultFile(), 'starter') },
        { id: 'apply-solution', label: 'CodeLab: Apply Reference Solution to Active File', action: () => this.applyReferenceSolution() },
        { id: 'new-file', label: 'File: New File...', action: () => this.startInlineCreate('file', '') },
        { id: 'new-folder', label: 'File: New Folder...', action: () => this.startInlineCreate('folder', '') },
        { id: 'rename-active', label: 'File: Rename Active File...', shortcut: 'F2', action: () => { if (this.activeFile) this.startInlineRename('file', this.activeFile); } },
        { id: 'delete-active', label: 'File: Delete Active File', action: () => { if (this.activeFile) this.deleteFile(this.activeFile); } },
        { id: 'export-workspace', label: 'Workspace: Export Workspace as JSON', action: () => this.exportWorkspace({ download: true }) },
        { id: 'reset-workspace', label: 'Workspace: Reset Workspace to Clean State', action: () => this.resetLab() },
        { id: 'switch-lang', label: 'Language: Switch JavaScript / TypeScript', action: () => this.setLanguage(this.lang === 'js' ? 'ts' : 'js') },
        { id: 'switch-mode', label: 'Mode: Switch Guided / Sandbox Mode', action: () => this.setMode(this.mode === 'guided' ? 'sandbox' : 'guided') },
        { id: 'toggle-guide', label: 'View: Toggle Guide Sidebar', action: () => this.toggleGuide() },
        { id: 'toggle-drawer', label: 'View: Toggle Bottom Drawer (Tests / Terminal / VFS)', action: () => {
          const drawer = this.container.querySelector('#cl-drawer');
          if (drawer) drawer.classList.toggle('is-minimized');
          if (this.editor) setTimeout(() => this.editor.layout(), 50);
        } },
        { id: 'toggle-fullscreen', label: 'View: Toggle Fullscreen Workbench', action: () => this.toggleFullscreen() },
        { id: 'open-packages', label: 'Packages: Manage NPM Dependencies & Runtime', action: () => this.showPackagesModal() },
        { id: 'git-clone', label: 'Git: Clone Public GitHub Repository...', action: () => this.showCloneRepoModal() }
      ];
    }

    openCommandPalette(mode = 'commands') {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
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
        input.focus();
        try {
          input.setSelectionRange(initialVal.length, initialVal.length);
        } catch (_) {}

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
        const files = this._orderedFileNames();
        items = files
          .filter(f => !query || f.toLowerCase().includes(query))
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
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;

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

    _bindSplitters() {
      const shell = this.container.querySelector('.codelab');
      const vSplitter = this.container.querySelector('#cl-splitter-v');
      const hSplitter = this.container.querySelector('#cl-splitter-h');
      if (!shell) return;

      if (vSplitter) {
        vSplitter.addEventListener('dblclick', () => {
          shell.style.setProperty('--cl-guide-width', '360px');
          if (this.editor) this.editor.layout();
        });

        vSplitter.addEventListener('pointerdown', e => {
          e.preventDefault();
          vSplitter.classList.add('is-dragging');
          shell.classList.add('is-resizing');
          vSplitter.setPointerCapture(e.pointerId);

          const onMove = ev => {
            const rect = shell.getBoundingClientRect();
            const minW = 240;
            const maxW = Math.max(minW, Math.floor(rect.width * 0.55));
            const nextW = Math.min(maxW, Math.max(minW, Math.round(ev.clientX - rect.left)));
            shell.style.setProperty('--cl-guide-width', `${nextW}px`);
            if (this.editor) this.editor.layout();
          };

          const onUp = ev => {
            vSplitter.classList.remove('is-dragging');
            shell.classList.remove('is-resizing');
            try { vSplitter.releasePointerCapture(ev.pointerId); } catch (_) {}
            vSplitter.removeEventListener('pointermove', onMove);
            vSplitter.removeEventListener('pointerup', onUp);
          };

          vSplitter.addEventListener('pointermove', onMove);
          vSplitter.addEventListener('pointerup', onUp);
        });
      }

      if (hSplitter) {
        hSplitter.addEventListener('dblclick', () => {
          const drawer = this.container.querySelector('#cl-drawer');
          if (drawer) drawer.classList.remove('is-minimized');
          shell.style.setProperty('--cl-drawer-height', '235px');
          if (this.editor) this.editor.layout();
        });

        hSplitter.addEventListener('pointerdown', e => {
          e.preventDefault();
          const mainEl = this.container.querySelector('.codelab-main');
          const drawer = this.container.querySelector('#cl-drawer');
          if (!mainEl) return;
          if (drawer) drawer.classList.remove('is-minimized');

          hSplitter.classList.add('is-dragging');
          shell.classList.add('is-resizing-row');
          hSplitter.setPointerCapture(e.pointerId);

          const onMove = ev => {
            const rect = mainEl.getBoundingClientRect();
            const minH = 110;
            const maxH = Math.max(minH, Math.floor(rect.height * 0.7));
            const nextH = Math.min(maxH, Math.max(minH, Math.round(rect.bottom - ev.clientY)));
            shell.style.setProperty('--cl-drawer-height', `${nextH}px`);
            if (this.editor) this.editor.layout();
          };

          const onUp = ev => {
            hSplitter.classList.remove('is-dragging');
            shell.classList.remove('is-resizing-row');
            try { hSplitter.releasePointerCapture(ev.pointerId); } catch (_) {}
            hSplitter.removeEventListener('pointermove', onMove);
            hSplitter.removeEventListener('pointerup', onUp);
          };

          hSplitter.addEventListener('pointermove', onMove);
          hSplitter.addEventListener('pointerup', onUp);
        });
      }
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
          const targetFile = this.lang === 'ts' && rawTarget ? rawTarget.replace(/\.js$/, '.ts') : rawTarget;
          this.openFile(targetFile, step.targetSymbol || `TODO (Step ${idx + 1})`);
        }
      }
      this._renderBreadcrumbs();
    }

    openFile(filename, symbolToFind = '') {
      if (!this.files || this.files[filename] === undefined) return;
      if (!Array.isArray(this.openTabs)) this.openTabs = [];
      if (!this.openTabs.includes(filename)) {
        this.openTabs.push(filename);
      }
      this.activeFile = filename;
      this._saveState();
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

    setMode(newMode) {
      if (newMode !== 'guided' && newMode !== 'sandbox') return;
      if (this.mode === newMode) return;
      this.mode = newMode;
      this.files = this._computeInitialFiles();
      this.openTabs = this._orderedFileNames();
      this.activeFile = this._pickDefaultFile();
      this._saveState();

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

    setLanguage(newLang) {
      if (newLang !== 'js' && newLang !== 'ts') return;
      if (this.lang === newLang) return;
      this.lang = newLang;
      this.files = this._computeInitialFiles();
      this.openTabs = this._orderedFileNames();
      this.activeFile = this._pickDefaultFile();
      this._saveState();

      this.container.querySelectorAll('[data-cl-lang]').forEach(btn => {
        const isActive = btn.dataset.clLang === this.lang;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      this._syncAllModels();
      this._syncActiveFileToView();
      this._renderGuidePane();
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
      if (lang === 'js' || lang === 'ts') {
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

    resetLab() {
      this.completedSteps = new Set();
      this.folders = new Set();
      this.collapsedFolders = new Set();
      this.files = this._getBaseFilesForModeAndLang(this.mode, this.lang);
      for (const filePath of Object.keys(this.files)) {
        const parts = filePath.split('/');
        for (let i = 1; i < parts.length; i++) {
          this.folders.add(parts.slice(0, i).join('/'));
        }
      }
      this.openTabs = this._orderedFileNames();
      this.activeFile = this._pickDefaultFile();
      const key = `${this.mode}:${this.lang}`;
      if (this.savedState.customFiles) {
        delete this.savedState.customFiles[key];
      }
      this._saveState();
      this._syncAllModels();
      this._syncActiveFileToView();
      this._renderStepPills();
      this.terminalLogs.push({ type: 'system', text: `↺ Reset workspace files to clean ${this.mode} (${this.lang.toUpperCase()}) state.` });
      this._renderDrawerBody();
    }

    showPackagesModal() {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
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
                    No external npm packages imported yet. Any <code>import ... from 'pkg'</code> or <code>require('pkg')</code> in your code is automatically resolved via <strong>esm.sh</strong> when you run or test.
                  </div>
                ` : `
                  <div style="display:flex;flex-direction:column;gap:6px;">
                    ${pkgs.map(p => `
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--cl-border);border-radius:var(--cl-radius-sm);background:var(--cl-bg);font-family:var(--cl-font-mono);font-size:12px;">
                        <span style="color:var(--cl-fg);font-weight:600;">${escapeHtml(p.name)}</span>
                        <span style="color:var(--cl-accent);">${escapeHtml(p.version)} · esm.sh</span>
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
        } catch (_) {}
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

    closeModal() {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (slot) slot.innerHTML = '';
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
    async _executeRuntime(execOptions) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const payload = {
        ...execOptions,
        instanceId: this.instanceId,
        onStdout: execOptions.onStdout || ((chunk) => this._appendTerminalStream('stdout', chunk)),
        onStderr: execOptions.onStderr || ((chunk) => this._appendTerminalStream('stderr', chunk)),
        signal: execOptions.signal || this._activeCommandAbortController?.signal
      };
      try {
        if (typeof root.CodeLabRuntime?.preloadNpmPackages === 'function' && payload && payload.files) {
          const rawDetected = this._detectPackages();
          const detectedList = Array.isArray(rawDetected)
            ? rawDetected
            : (rawDetected && Array.isArray(rawDetected.npmPackages) ? rawDetected.npmPackages : []);
          if (detectedList.length > 0) {
            this._setRuntimeStatus('fetching', `Fetching ${detectedList.map(d => typeof d === 'string' ? d : d.name).join(', ')}...`);
          }
          await root.CodeLabRuntime.preloadNpmPackages(payload.files, pkgName => {
            this._setRuntimeStatus('fetching', `Fetching ${pkgName} from esm.sh...`);
          });
        }
        this._setRuntimeStatus('running', `Running ${payload.entry || payload.mode || 'script'}...`);
        let res;
        if (typeof root.CodeLabRuntime?.executeInWorker === 'function') {
          res = await root.CodeLabRuntime.executeInWorker(payload);
        } else if (typeof root.CodeLabRuntime?.executeInVirtualRuntime === 'function') {
          res = await root.CodeLabRuntime.executeInVirtualRuntime(payload);
        } else {
          throw new Error('CodeLabRuntime is not loaded.');
        }
        const elapsed = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        this.lastRunDurationMs = res && typeof res.durationMs === 'number' ? res.durationMs : elapsed;
        this._setRuntimeStatus('idle', 'Ready · Node v22 VFS');
        return res;
      } catch (err) {
        this._setRuntimeStatus('error', 'Execution error');
        throw err;
      }
    }

    async runDemo() {
      if (this.isRunning) return;
      const entry = this._findEntryFile('demo');
      if (!entry) {
        this.terminalLogs.push({ type: 'stderr', text: 'No demo.js / demo.ts file found in this workspace.' });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }

      this.isRunning = true;
      this._updateRunStateUI();
      this.drawerTab = 'terminal';
      this.terminalLogs.push({ type: 'system', text: `\n$ node ${entry}` });
      this._renderDrawerBody();

      const abortCtrl = new AbortController();
      this._activeCommandAbortController = abortCtrl;
      let streamedStdout = false;
      let streamedStderr = false;

      try {
        const res = await this._executeRuntime({
          files: { ...this.files },
          entry,
          mode: 'run',
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
        this._flushTerminalStream();

        if (!streamedStdout && res.stdout) {
          this.terminalLogs.push({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
        }
        if (!streamedStderr && res.stderr) {
          this.terminalLogs.push({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (res.error) {
          this.terminalLogs.push({ type: 'stderr', text: formatErrorText(res.error) });
        }
        this.lastFsSnapshot = res.fsSnapshot || [];
        this.lastHttpTrace = res.httpTrace || [];

        if (this.onRun) {
          try { this.onRun(res); } catch (_) {}
        }
        this._emitEvent('codelab:run', { labId: this.labId, mode: 'run', entry, result: res });
      } catch (err) {
        this._flushTerminalStream();
        this.terminalLogs.push({ type: 'stderr', text: `Execution error: ${formatErrorText(err)}` });
      } finally {
        if (this._activeCommandAbortController === abortCtrl) {
          this._activeCommandAbortController = null;
        }
        this.isRunning = false;
        this._updateRunStateUI();
      }

      this._renderDrawerBody();
    }

    async runTests(filterTestNames = null) {
      if (this.isRunning) return;
      const entry = this._findEntryFile('test');
      if (!entry) {
        this.terminalLogs.push({ type: 'stderr', text: 'No test.js / test.ts file found in this workspace.' });
        this.drawerTab = 'terminal';
        this._renderDrawerBody();
        return;
      }

      this.isRunning = true;
      this._updateRunStateUI();
      this.drawerTab = 'tests';
      this.terminalLogs.push({ type: 'system', text: `\n$ node ${entry}` });

      const abortCtrl = new AbortController();
      this._activeCommandAbortController = abortCtrl;
      let streamedStdout = false;
      let streamedStderr = false;

      try {
        const res = await this._executeRuntime({
          files: { ...this.files },
          entry,
          mode: 'test',
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
        this._flushTerminalStream();

        this.lastTestResults = res.testResults || [];
        this.lastFsSnapshot = res.fsSnapshot || [];
        this.lastHttpTrace = res.httpTrace || [];

        if (!streamedStdout && res.stdout) {
          this.terminalLogs.push({ type: 'stdout', text: res.stdout.replace(/\n$/, '') });
        }
        if (!streamedStderr && res.stderr) {
          this.terminalLogs.push({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (res.error) {
          this.terminalLogs.push({ type: 'stderr', text: formatErrorText(res.error) });
        }

        if (this.onTestResult) {
          try { this.onTestResult(res); } catch (_) {}
        }
        if (this.onRun) {
          try { this.onRun(res); } catch (_) {}
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
                try { this.onStepComplete(step, sIdx); } catch (_) {}
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
              try { this.onLabComplete(this.labId); } catch (_) {}
            }
            this._emitEvent('codelab:lab-complete', {
              labId: this.labId,
              completedSteps: Array.from(this.completedSteps)
            });
          }
        }
      } catch (err) {
        this._flushTerminalStream();
        this.terminalLogs.push({ type: 'stderr', text: `Test runner error: ${formatErrorText(err)}` });
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
    }

    async verifyCurrentStep() {
      await this.runTests();
      const step = this.steps[this.activeStepIndex];
      if (step && this.completedSteps.has(step.id) && this.activeStepIndex < this.steps.length - 1) {
        // Advance to next step and jump to its target symbol/TODO
        this.selectStep(this.activeStepIndex + 1, true);
      }
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
      const trimmed = (cmd || '').trim();
      if (!trimmed) return;
      if (this.replHistory[this.replHistory.length - 1] !== trimmed) {
        this.replHistory.push(trimmed);
      }
      this.replHistoryIdx = -1;
      const cwdShort = (this.cwd || '/workspace').replace(/^\/workspace\/?/, '') || '~';
      const promptPrefix = this.inRepl ? '> ' : `codelab:${cwdShort}$ `;
      this.terminalLogs.push({ type: 'system', text: `${promptPrefix}${trimmed}` });

      if (this.inRepl) {
        if (trimmed === '.exit' || trimmed === 'exit') {
          this.inRepl = false;
          this.terminalLogs.push({ type: 'stdout', text: 'Exited Node.js REPL.' });
          this._renderDrawerBody();
          return;
        }
        if (trimmed === '.clear' || trimmed === 'clear') {
          this.terminalLogs = [];
          this._renderDrawerBody();
          return;
        }
        if (trimmed === '.help') {
          this.terminalLogs.push({
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
          const cleanStdout = res.stdout ? res.stdout.replace(/\n$/, '') : '';
          if (!streamedStdout && cleanStdout) this.terminalLogs.push({ type: 'stdout', text: cleanStdout });
          if (!streamedStderr && res.stderr) this.terminalLogs.push({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
          if (res.replValue !== undefined && cleanStdout !== String(res.replValue)) {
            this.terminalLogs.push({ type: 'success', text: `→ ${res.replValue}` });
          }
          if (res.error) this.terminalLogs.push({ type: 'stderr', text: formatErrorText(res.error) });
        } catch (err) {
          this._flushTerminalStream();
          this.terminalLogs.push({ type: 'stderr', text: formatErrorText(err) });
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
        this.terminalLogs = [];
        this._renderDrawerBody();
        return;
      }
      if (trimmed === 'node' || trimmed === 'node -i' || trimmed === 'node --interactive') {
        this.inRepl = true;
        this.terminalLogs.push({ type: 'stdout', text: 'Welcome to Node.js v22.0.0.\nType ".help" for more information, or ".exit" to return to POSIX shell.' });
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

      const looksLikeJsExpr = /^(const|let|var|function|class|await|return|typeof|instanceof|new\s+|Math\.|JSON\.|Object\.|Array\.|Promise\.|console\.|process\.|Buffer\.|require\s*\(|import\s*\(|[0-9]+\s*[\+\-\*\/\%]|['"`\[{])/.test(trimmed)
        || /^[a-zA-Z_$][\w$]*\s*(\.|===|!==|==|!=|<=|>=|\+=|-=|\*=|\(|\+\+|--)/.test(trimmed);

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
          this.cwd = this.shell.cwd || this.cwd;
          this._syncVfsSnapshot(null, true);

          if (shellRes && shellRes.clear) {
            this.terminalLogs = [];
            this._renderDrawerBody();
            return;
          }
          if (shellRes && shellRes.interactiveRepl) {
            this.inRepl = true;
            if (shellRes.stdout && !streamedStdout) {
              this.terminalLogs.push({ type: 'stdout', text: shellRes.stdout.replace(/\n$/, '') });
            }
            this._renderDrawerBody();
            return;
          }

          const isCmdNotFound = shellRes && shellRes.exitCode === 127 && typeof shellRes.stderr === 'string' && shellRes.stderr.includes('command not found');
          if (!isCmdNotFound) {
            if (shellRes && shellRes.stdout && !streamedStdout) {
              this.terminalLogs.push({ type: 'stdout', text: shellRes.stdout.replace(/\n$/, '') });
            }
            if (shellRes && shellRes.stderr && !streamedStderr) {
              this.terminalLogs.push({ type: 'stderr', text: shellRes.stderr.replace(/\n$/, '') });
            }
            this._renderDrawerBody();
            return;
          } else {
            // Roll back any temporary output from command not found so JS evaluation fallback can run cleanly
            this.terminalLogs.splice(logsCountBefore);
            this._activeStreamLine = '';
            this._activeStreamEl = null;
          }
        } catch (err) {
          this._flushTerminalStream();
          this.terminalLogs.push({ type: 'stderr', text: formatErrorText(err) });
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
        const cleanStdout = res.stdout ? res.stdout.replace(/\n$/, '') : '';
        if (!streamedFallbackStdout && cleanStdout) {
          this.terminalLogs.push({ type: 'stdout', text: cleanStdout });
        }
        if (!streamedFallbackStderr && res.stderr) {
          this.terminalLogs.push({ type: 'stderr', text: res.stderr.replace(/\n$/, '') });
        }
        if (res.replValue !== undefined && cleanStdout !== String(res.replValue)) {
          this.terminalLogs.push({ type: 'success', text: `→ ${res.replValue}` });
        }
        if (res.error) {
          const errStr = formatErrorText(res.error);
          if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && errStr.includes(`ReferenceError: ${trimmed} is not defined`)) {
            this.terminalLogs.push({ type: 'stderr', text: `codelab: ${trimmed}: command not found (type "help" for commands or enter a JS/TS expression)` });
          } else {
            this.terminalLogs.push({ type: 'stderr', text: errStr });
          }
        }
      } catch (err) {
        this._flushTerminalStream();
        this.terminalLogs.push({ type: 'stderr', text: formatErrorText(err) });
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
      } catch (_) {}
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
        } catch (_) {}
      }
      return snapshot;
    }

    importWorkspace(snapshotOrJson) {
      const data = typeof snapshotOrJson === 'string' ? JSON.parse(snapshotOrJson) : snapshotOrJson;
      if (!data || typeof data !== 'object') return false;
      if (data.mode === 'guided' || data.mode === 'sandbox') {
        this.mode = data.mode;
      }
      if (data.language === 'js' || data.language === 'ts') {
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

    getFiles() {
      return { ...this.files };
    }

    setFiles(filesMap) {
      if (!filesMap || typeof filesMap !== 'object') return;
      for (const model of this.models.values()) {
        try { model.dispose(); } catch (_) {}
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
      this.openTabs = this._orderedFileNames();
      if (!this.activeFile || this.files[this.activeFile] === undefined) {
        this.activeFile = this._pickDefaultFile();
      }
      this._saveState();
      this._syncAllModels();
      this._syncActiveFileToView();
    }

    getFile(path) {
      const clean = String(path || '').trim().replace(/^\/+/, '');
      return this.files[clean];
    }

    setFile(path, content, options = {}) {
      const clean = String(path || '').trim().replace(/^\/+/, '');
      if (!clean) return;
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
      }
      this._saveState();
      this._getOrCreateModel(clean);
      if (isNew) {
        this._emitEvent('codelab:file-create', { labId: this.labId, filename: clean, content: this.files[clean] });
      }
      this._notifyCodeChange(clean, this.files[clean]);
      this._syncActiveFileToView();
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
        if (this.shell && this.shell.vfs && typeof this.shell.vfs.writeFile === 'function') {
          try {
            this.shell.vfs.writeFile('/workspace/' + clean, updated);
          } catch (_) {}
        }
        this._notifyCodeChange(clean, updated);
      }
    }

    getOpenTabs() {
      return Array.isArray(this.openTabs) ? [...this.openTabs] : [];
    }

    showCloneRepoModal() {
      const slot = this.container.querySelector('#cl-modal-slot');
      if (!slot) return;
      slot.innerHTML = `
        <div class="codelab-modal-backdrop">
          <div class="codelab-modal" role="dialog" aria-modal="true" aria-label="Clone Public GitHub Repository">
            <div class="codelab-modal__header">
              <span style="display:inline-flex;align-items:center;gap:6px;">${CL_ICONS.terminal || CL_ICONS.folder}<span>Clone Public GitHub Repository</span></span>
              <button type="button" class="codelab-btn" data-cl-action="close-modal">Close (Esc)</button>
            </div>
            <div class="codelab-modal__body" style="font-family:var(--cl-font-sans);">
              <p style="margin:0 0 12px;font-size:12.5px;color:var(--cl-fg-muted);">
                Enter any public GitHub repository URL or <code>owner/repo</code> slug. Files will be cloned directly into the in-memory Virtual Filesystem (VFS) with zero authentication required.
              </p>
              <div style="display:flex;gap:8px;">
                <input id="cl-clone-repo-input" type="text" placeholder="e.g. innovatorved/code-lab or https://github.com/owner/repo" style="flex:1;height:34px;padding:0 10px;background:var(--cl-bg);border:1px solid var(--cl-border-strong);border-radius:var(--cl-radius-sm);color:var(--cl-fg);font-family:var(--cl-font-mono);font-size:12px;outline:none;" />
                <button type="button" class="codelab-btn codelab-btn--primary" data-cl-action="confirm-clone-repo">Clone Repo</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const input = slot.querySelector('#cl-clone-repo-input');
      if (input) {
        input.focus();
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();
            const val = input.value.trim();
            this.closeModal();
            this.cloneRepo(val, { intoRoot: true }).catch(() => {});
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.closeModal();
          }
        });
      }
    }

    async cloneRepo(repoInput, options = {}) {
      if (!parseGitHubRepoUrl || !cloneGitHubRepository) {
        throw new Error('CodeLabShell GitHub clone engine is not loaded');
      }
      const parsed = parseGitHubRepoUrl(repoInput);
      if (!parsed) {
        const errMsg = `fatal: repository '${repoInput}' does not exist or is not a valid GitHub repository URL`;
        this.terminalLogs.push({ type: 'stderr', text: errMsg });
        this._renderDrawerBody();
        throw new Error(errMsg);
      }

      if (!this.shell) {
        this._initShell();
      }

      const intoRoot = options.intoRoot !== false;
      const targetDir = intoRoot ? '/workspace' : `/workspace/${parsed.repo}`;
      const cmdDisplay = `git clone ${repoInput}${intoRoot ? ' .' : ''}`;
      this.terminalLogs.push({ type: 'cmd', text: cmdDisplay });
      this._renderDrawerBody();

      try {
        if (intoRoot && this.shell && this.shell.vfs) {
          // Clear previous workspace files before cloning into root
          if (this.shell.vfs.files instanceof Map) {
            for (const k of Array.from(this.shell.vfs.files.keys())) {
              if (k.startsWith('/workspace/')) this.shell.vfs.files.delete(k);
            }
          }
          if (this.shell.vfs.dirs instanceof Set) {
            for (const d of Array.from(this.shell.vfs.dirs)) {
              if (d.startsWith('/workspace/')) this.shell.vfs.dirs.delete(d);
            }
          }
        }

        const result = await cloneGitHubRepository(repoInput, this.shell.vfs, {
          targetDir,
          branch: options.branch || parsed.branch || null,
          maxFiles: options.maxFiles || 250,
          maxFileSize: options.maxFileSize || 512 * 1024,
          fetchImpl: options.fetchImpl || (this.shell && this.shell.options ? this.shell.options.fetchImpl : undefined),
          onProgress: options.onProgress
        });

        if (this.shell && this.shell.gitState) {
          const gs = this.shell.gitState;
          gs.branch = result.branch;
          if (!(gs.branches instanceof Set)) gs.branches = new Set();
          gs.branches.add(result.branch);
          gs.remoteUrl = result.url;
          gs.remotes = { origin: result.url };
          gs.repoRoot = targetDir;
          gs.headSnapshot = Object.assign({}, result.headSnapshot);
          gs.commits = result.commits;
          gs.staged = new Set();
        }

        if (intoRoot) {
          this.setFiles(result.headSnapshot);
          const preferred = [
            'README.md',
            'readme.md',
            'src/index.ts',
            'src/index.js',
            'index.ts',
            'index.js',
            'main.js',
            'app.js',
            'package.json'
          ];
          const allNames = Object.keys(this.files);
          const pick = preferred.find((p) => this.files[p] !== undefined) || allNames[0] || null;
          if (pick) {
            this.activeFile = pick;
          }
          this.openTabs = allNames.slice(0, 5);
          if (pick && !this.openTabs.includes(pick)) {
            this.openTabs.unshift(pick);
          }
          this._saveState();
          this._syncAllModels();
          this._syncActiveFileToView();
        } else {
          this._syncVfsSnapshot(null, false);
        }

        const count = Math.max(1, result.filesWritten);
        const kb = Math.max(0.1, result.totalBytes / 1024).toFixed(1);
        this.terminalLogs.push({
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
          count: result.filesWritten,
          fileCount: result.filesWritten,
          totalBytes: result.totalBytes
        };
        this._emitEvent('repo-clone', eventDetail);
        this._emitEvent('repo:cloned', eventDetail);
        return result;
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        this.terminalLogs.push({ type: 'stderr', text: msg });
        this._renderDrawerBody();
        throw err;
      }
    }

    reset() {
      return this.resetLab();
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
      }
      return this;
    }

    destroy() {
      this.stopExecution();
      if (this._escHandler && typeof document !== 'undefined') {
        document.removeEventListener('keydown', this._escHandler);
      }
      if (this._themeObserver) {
        this._themeObserver.disconnect();
      }
      if (this._editorResizeObserver) {
        this._editorResizeObserver.disconnect();
        this._editorResizeObserver = null;
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
    }
  }

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
          this._instance.theme = newVal || 'auto';
          const rootEl = this.querySelector('.codelab');
          if (rootEl) rootEl.setAttribute('data-cl-theme', this._instance._resolvedTheme());
        } else if (name === 'mode' && (newVal === 'guided' || newVal === 'sandbox')) {
          this._instance.switchMode(newVal);
        } else if ((name === 'language' || name === 'lang') && (newVal === 'js' || newVal === 'ts')) {
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
          } catch (_) {}
        }

        // Parse optional files JSON attribute
        let attrFiles = null;
        const filesAttr = this.getAttribute('files');
        if (filesAttr) {
          try {
            attrFiles = JSON.parse(filesAttr);
          } catch (_) {}
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
          ...(attrFiles ? { files: attrFiles } : {})
        });
      }

      getFiles() { return this._instance ? this._instance.getFiles() : {}; }
      setFiles(filesMap) { if (this._instance) this._instance.setFiles(filesMap); }
      getFile(path) { return this._instance ? this._instance.getFile(path) : undefined; }
      setFile(path, content, opts) { if (this._instance) this._instance.setFile(path, content, opts); }
      createFile(path, content) { if (this._instance) this._instance.createFile(path, content); }
      deleteFile(path) { return this._instance ? this._instance.deleteFile(path) : false; }
      renameFile(oldPath, newPath) { return this._instance ? this._instance.renameFile(oldPath, newPath) : false; }
      createFolder(path) { return this._instance ? this._instance.createFolder(path) : false; }
      deleteFolder(path) { return this._instance ? this._instance.deleteFolder(path) : false; }
      renameFolder(oldPath, newPath) { return this._instance ? this._instance.renameFolder(oldPath, newPath) : false; }
      openFile(path, sym) { if (this._instance) this._instance.openFile(path, sym); }
      closeTab(path) { if (this._instance) this._instance.closeTab(path); }
      getOpenTabs() { return this._instance ? this._instance.getOpenTabs() : []; }
      openCommandPalette(mode) { if (this._instance) this._instance.openCommandPalette(mode); }
      showDiffModal(file, target) { if (this._instance) this._instance.showDiffModal(file, target); }
      cloneRepo(repoInput, opts) { return this._instance ? this._instance.cloneRepo(repoInput, opts) : Promise.reject(new Error('Workbench not mounted')); }
      runDemo() { return this._instance ? this._instance.runDemo() : Promise.resolve(); }
      runTests(filter) { return this._instance ? this._instance.runTests(filter) : Promise.resolve(); }
      stopExecution() { if (this._instance) this._instance.stopExecution(); }
      reset() { if (this._instance) this._instance.reset(); }
      exportWorkspace(opts) { return this._instance ? this._instance.exportWorkspace(opts) : null; }
      importWorkspace(snap) { return this._instance ? this._instance.importWorkspace(snap) : false; }
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
    version: '2.0.0',
    Workbench: CodeLabWorkbench,
    CodeLabWorkbench,
    CodeLabElement: CodeLabElementClass,
    Runtime: root.CodeLabRuntime,
    Shell: root.CodeLabShell,
    Terminal: root.CodeLabTerminal,
    renderMarkdown: renderSimpleMarkdown,
    renderSimpleMarkdown: renderSimpleMarkdown,
    extensions: {
      guidedLab: null
    },
    parseGitHubRepoUrl,
    cloneRepo: cloneGitHubRepository,
    mount: mountCodeLab,
    create: mountCodeLab,
    unmount(container) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (el && el._codeLabInstance) {
        el._codeLabInstance.destroy();
        el._codeLabInstance = null;
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
