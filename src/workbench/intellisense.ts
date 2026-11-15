/**
 * @innovatorved/code-lab — Browser-Native Language Intelligence (100% Client-Side)
 *
 * Provides VS Code Dark/Light/HC Modern Monaco themes, normalized `file:///workspace/...`
 * eager multi-file TS/JS model synchronization, live `tsconfig.json` compiler sync,
 * cross-file F12 / Cmd+Click Go-to-Definition editor opener, Automatic Type Acquisition (ATA)
 * with IndexedDB caching + Node.js ambient `.d.ts`, JSON schemas (`package.json`, `tsconfig.json`),
 * HTML/JSX auto-closing tags + Emmet abbreviations, cross-file CSS custom property completions,
 * SQL schema-aware completions, and universal document/workspace symbol extraction for Outline,
 * Breadcrumbs, and Quick Open (`@` / `#`).
 */

export type SymbolKindName =
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'struct'
  | 'function'
  | 'method'
  | 'property'
  | 'variable'
  | 'constant'
  | 'heading'
  | 'table';

export interface CodeLabSymbolItem {
  name: string;
  kind: SymbolKindName;
  detail?: string;
  file: string;
  line: number;
  endLine: number;
  column: number;
  containerName?: string;
}

export interface WorkspaceFilesGetter {
  (): Record<string, string>;
}

export interface MonacoUriLike {
  path?: string;
  toString?: () => string;
}

export interface MonacoPositionLike {
  lineNumber: number;
  column: number;
}

export interface MonacoRangeLike {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface MonacoTextModelLike {
  getLineContent: (lineNumber: number) => string;
  getValue?: () => string;
  getLanguageId?: () => string;
  getWordUntilPosition: (pos: MonacoPositionLike) => { word: string; startColumn: number; endColumn: number };
  getWordAtPosition: (pos: MonacoPositionLike) => { word: string; startColumn: number; endColumn: number } | null;
}

export interface MonacoChangeEventLike {
  changes?: Array<{ text: string; range: MonacoRangeLike }>;
}

export interface MonacoEditorLike {
  onDidChangeModelContent?: (cb: (event: MonacoChangeEventLike) => void) => { dispose: () => void } | undefined;
  getModel?: () => MonacoTextModelLike | null;
  executeEdits: (source: string, edits: Array<{ range: MonacoRangeLike; text: string; forceMoveMarkers?: boolean }>) => void;
  setPosition: (pos: MonacoPositionLike) => void;
}

export interface MonacoTsDefaultsLike {
  setCompilerOptions?: (opts: Record<string, unknown>) => void;
  setEagerModelSync?: (value: boolean) => void;
  setDiagnosticsOptions?: (opts: Record<string, unknown>) => void;
  addExtraLib?: (content: string, filePath?: string) => { dispose?: () => void } | undefined;
}

export interface MonacoNamespaceLike {
  Uri?: {
    file?: (path: string) => MonacoUriLike;
    parse?: (uri: string) => MonacoUriLike;
  };
  Range?: new (startLine: number, startCol: number, endLine: number, endCol: number) => MonacoRangeLike;
  editor?: {
    defineTheme?: (name: string, data: Record<string, unknown>) => void;
    registerEditorOpener?: (opener: {
      openCodeEditor: (
        source: unknown,
        resource: MonacoUriLike | string,
        selectionOrPosition?: Partial<MonacoRangeLike & MonacoPositionLike>
      ) => boolean;
    }) => { dispose: () => void };
  };
  languages?: {
    CompletionItemKind?: Record<string, number>;
    CompletionItemInsertTextRule?: Record<string, number>;
    registerCompletionItemProvider?: (
      lang: string,
      provider: {
        triggerCharacters?: string[];
        provideCompletionItems: (model: MonacoTextModelLike, position: MonacoPositionLike) => { suggestions: Array<Record<string, unknown>> };
      }
    ) => { dispose: () => void };
    registerHoverProvider?: (
      lang: string,
      provider: {
        provideHover: (model: MonacoTextModelLike, position: MonacoPositionLike) => Record<string, unknown> | null;
      }
    ) => { dispose: () => void };
    typescript?: {
      ScriptTarget?: Record<string, number>;
      ModuleKind?: Record<string, number>;
      ModuleResolutionKind?: Record<string, number>;
      JsxEmit?: Record<string, number>;
      typescriptDefaults?: MonacoTsDefaultsLike;
      javascriptDefaults?: MonacoTsDefaultsLike;
    };
    json?: {
      jsonDefaults?: {
        setDiagnosticsOptions?: (opts: Record<string, unknown>) => void;
      };
    };
  };
}

const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

const BUILTIN_NODE_MODULES = new Set([
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'dns/promises',
  'domain', 'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
  'module', 'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'readline/promises', 'repl', 'sqlite',
  'stream', 'stream/consumers', 'stream/promises', 'stream/web', 'string_decoder',
  'sys', 'test', 'timers', 'timers/promises', 'tls', 'trace_events', 'tty', 'url',
  'util', 'util/types', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
]);

const NODE_AMBIENT_DTS = `
declare interface Buffer extends Uint8Array {
  toString(encoding?: string, start?: number, end?: number): string;
  write(str: string, offset?: number, length?: number, encoding?: string): number;
  slice(start?: number, end?: number): Buffer;
  equals(otherBuffer: Uint8Array): boolean;
}
declare var Buffer: {
  from(data: string | ArrayLike<number> | ArrayBufferLike, encoding?: string): Buffer;
  alloc(size: number, fill?: string | number): Buffer;
  allocUnsafe(size: number): Buffer;
  concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
  byteLength(string: string | Uint8Array, encoding?: string): number;
};
declare namespace NodeJS {
  interface ProcessEnv { [key: string]: string | undefined; NODE_ENV?: string; HOME?: string; PATH?: string; }
  interface ReadStream { on(event: string, listener: (...args: any[]) => void): this; resume(): this; pause(): this; setEncoding(enc: string): this; }
  interface WriteStream { write(chunk: string | Uint8Array): boolean; columns?: number; rows?: number; isTTY?: boolean; }
  interface Process {
    env: ProcessEnv;
    argv: string[];
    cwd(): string;
    chdir(directory: string): void;
    exit(code?: number): never;
    nextTick(callback: (...args: any[]) => void, ...args: any[]): void;
    hrtime: { (time?: [number, number]): [number, number]; bigint(): bigint };
    platform: string;
    version: string;
    versions: Record<string, string>;
    pid: number;
    stdout: WriteStream;
    stderr: WriteStream;
    stdin: ReadStream;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}
declare var process: NodeJS.Process;

declare module 'fs' {
  export interface Stats { isFile(): boolean; isDirectory(): boolean; size: number; mtimeMs: number; mtime: Date; }
  export function readFileSync(path: string, encoding?: string | { encoding?: string }): any;
  export function writeFileSync(path: string, data: string | Uint8Array, options?: any): void;
  export function appendFileSync(path: string, data: string | Uint8Array): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function readdirSync(path: string, options?: any): any[];
  export function statSync(path: string): Stats;
  export function lstatSync(path: string): Stats;
  export function unlinkSync(path: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function renameSync(oldPath: string, newPath: string): void;
  export function copyFileSync(src: string, dest: string): void;
  export const promises: typeof import('fs/promises');
}
declare module 'node:fs' { export * from 'fs'; }

declare module 'fs/promises' {
  import type { Stats } from 'fs';
  export function readFile(path: string, encoding?: string | { encoding?: string }): Promise<any>;
  export function writeFile(path: string, data: string | Uint8Array, options?: any): Promise<void>;
  export function appendFile(path: string, data: string | Uint8Array): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function readdir(path: string, options?: any): Promise<any[]>;
  export function stat(path: string): Promise<Stats>;
  export function unlink(path: string): Promise<void>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function copyFile(src: string, dest: string): Promise<void>;
}
declare module 'node:fs/promises' { export * from 'fs/promises'; }

declare module 'path' {
  export const sep: string;
  export const delimiter: string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function normalize(p: string): string;
  export function relative(from: string, to: string): string;
  export function isAbsolute(p: string): boolean;
  export function parse(p: string): { root: string; dir: string; base: string; ext: string; name: string };
}
declare module 'node:path' { export * from 'path'; }

declare module 'os' {
  export const EOL: string;
  export function platform(): string;
  export function arch(): string;
  export function homedir(): string;
  export function tmpdir(): string;
  export function cpus(): Array<{ model: string; speed: number }>;
  export function totalmem(): number;
  export function freemem(): number;
}
declare module 'node:os' { export * from 'os'; }

declare module 'events' {
  export class EventEmitter {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    emit(event: string | symbol, ...args: any[]): boolean;
    removeAllListeners(event?: string | symbol): this;
  }
  export default EventEmitter;
}
declare module 'node:events' { export * from 'events'; export { EventEmitter as default } from 'events'; }

declare module 'crypto' {
  export function randomUUID(): string;
  export function randomBytes(size: number): Buffer;
  export function createHash(algorithm: string): { update(data: string | Uint8Array): any; digest(encoding?: string): any };
  export function createHmac(algorithm: string, key: string | Uint8Array): { update(data: string | Uint8Array): any; digest(encoding?: string): any };
}
declare module 'node:crypto' { export * from 'crypto'; }

declare module 'http' {
  export interface IncomingMessage { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; on(event: string, cb: (...args: any[]) => void): this; }
  export interface ServerResponse { statusCode: number; setHeader(name: string, value: string | number | string[]): this; writeHead(statusCode: number, headers?: Record<string, any>): this; write(chunk: any): boolean; end(data?: any): this; }
  export interface Server { listen(port?: number, hostname?: string | (() => void), cb?: () => void): this; close(cb?: (err?: Error) => void): this; }
  export function createServer(handler?: (req: IncomingMessage, res: ServerResponse) => void): Server;
}
declare module 'node:http' { export * from 'http'; }

declare module 'readline' {
  export interface Interface {
    question(query: string, callback: (answer: string) => void): void;
    close(): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  export function createInterface(options: any): Interface;
}
declare module 'node:readline' { export * from 'readline'; }

declare module 'readline/promises' {
  export interface Interface {
    question(query: string, options?: { signal?: AbortSignal }): Promise<string>;
    close(): void;
  }
  export function createInterface(options: any): Interface;
}
declare module 'node:readline/promises' { export * from 'readline/promises'; }

declare module 'assert' {
  function assert(value: unknown, message?: string | Error): asserts value;
  namespace assert {
    export function ok(value: unknown, message?: string | Error): asserts value;
    export function equal(actual: unknown, expected: unknown, message?: string | Error): void;
    export function strictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    export function deepStrictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    export function throws(block: () => unknown, message?: RegExp | Function | string | Error): void;
    export function rejects(block: (() => Promise<unknown>) | Promise<unknown>, message?: RegExp | Function | string | Error): Promise<void>;
  }
  export = assert;
}
declare module 'node:assert' { import assert = require('assert'); export = assert; }

declare module 'node:test' {
  export function test(name: string, fn: (t: any) => void | Promise<void>): Promise<void>;
  export function describe(name: string, fn: () => void | Promise<void>): Promise<void>;
  export function it(name: string, fn: (t: any) => void | Promise<void>): Promise<void>;
  export function before(fn: () => void | Promise<void>): void;
  export function after(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export default test;
}

declare module 'node:sqlite' {
  export class StatementSync {
    all(...params: any[]): Record<string, any>[];
    get(...params: any[]): Record<string, any> | undefined;
    run(...params: any[]): { changes: number; lastInsertRowid: number };
  }
  export class DatabaseSync {
    constructor(location?: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
`;

const PACKAGE_JSON_SCHEMA = {
  uri: 'https://codelab.local/schemas/package.json',
  fileMatch: ['package.json', '**/package.json'],
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The name of the package.' },
      version: { type: 'string', description: 'Semantic version (semver) of the package.' },
      description: { type: 'string', description: 'Brief package summary.' },
      type: { type: 'string', enum: ['module', 'commonjs'], description: 'Module format for .js files.' },
      main: { type: 'string', description: 'Primary CommonJS entrypoint.' },
      module: { type: 'string', description: 'Primary ESM entrypoint.' },
      types: { type: 'string', description: 'TypeScript declaration entrypoint (.d.ts).' },
      private: { type: 'boolean', description: 'Prevent accidental npm publish when true.' },
      license: { type: 'string', description: 'SPDX license identifier (e.g. MIT, Apache-2.0).' },
      scripts: {
        type: 'object',
        description: 'Executable lifecycle and project scripts run via npm run <script>.',
        additionalProperties: { type: 'string' }
      },
      dependencies: {
        type: 'object',
        description: 'Runtime npm package dependencies.',
        additionalProperties: { type: 'string' }
      },
      devDependencies: {
        type: 'object',
        description: 'Development and build-time npm dependencies.',
        additionalProperties: { type: 'string' }
      }
    }
  }
};

const TSCONFIG_JSON_SCHEMA = {
  uri: 'https://codelab.local/schemas/tsconfig.json',
  fileMatch: ['tsconfig.json', '**/tsconfig.json', 'jsconfig.json', '**/jsconfig.json'],
  schema: {
    type: 'object',
    properties: {
      compilerOptions: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            enum: ['ES5', 'ES6', 'ES2015', 'ES2018', 'ES2020', 'ES2021', 'ES2022', 'ES2023', 'ESNext'],
            description: 'Set the JavaScript language version for emitted JavaScript.'
          },
          module: {
            type: 'string',
            enum: ['CommonJS', 'ES6', 'ES2015', 'ES2020', 'ES2022', 'ESNext', 'Node16', 'NodeNext', 'Bundler'],
            description: 'Specify what module code is generated.'
          },
          moduleResolution: {
            type: 'string',
            enum: ['classic', 'node', 'node10', 'node16', 'nodenext', 'bundler'],
            description: 'Specify how TypeScript looks up a file from a given module specifier.'
          },
          jsx: {
            type: 'string',
            enum: ['preserve', 'react', 'react-jsx', 'react-jsxdev', 'react-native'],
            description: 'Specify what JSX code is generated.'
          },
          strict: { type: 'boolean', description: 'Enable all strict type-checking options.' },
          noImplicitAny: { type: 'boolean', description: 'Enable error reporting for expressions with an implied any type.' },
          strictNullChecks: { type: 'boolean', description: 'Take null and undefined into account during type checking.' },
          allowJs: { type: 'boolean', description: 'Allow JavaScript files to be a part of your program.' },
          checkJs: { type: 'boolean', description: 'Enable error reporting in type-checked JavaScript files.' },
          noEmit: { type: 'boolean', description: 'Disable emitting files from a compilation.' },
          esModuleInterop: { type: 'boolean', description: 'Emit additional JavaScript to ease importing CommonJS modules.' },
          resolveJsonModule: { type: 'boolean', description: 'Enable importing .json files.' },
          skipLibCheck: { type: 'boolean', description: 'Skip type checking all .d.ts files.' },
          baseUrl: { type: 'string', description: 'Base directory to resolve non-relative module names.' },
          outDir: { type: 'string', description: 'Specify an output folder for all emitted files.' },
          rootDir: { type: 'string', description: 'Specify the root folder within your source files.' },
          lib: { type: 'array', items: { type: 'string' }, description: 'Bundled library declaration files.' }
        }
      },
      include: { type: 'array', items: { type: 'string' } },
      exclude: { type: 'array', items: { type: 'string' } }
    }
  }
};

const registeredMonacoInstances = new WeakSet<object>();

/**
 * Registers Charcoal Ink (Dark), Warm Paper (Light), and High Contrast themes on Monaco.
 */
export function registerCodeLabMonacoThemes(monaco: MonacoNamespaceLike | null | undefined): boolean {
  if (!monaco || !monaco.editor || typeof monaco.editor.defineTheme !== 'function') {
    return false;
  }
  try {
    monaco.editor.defineTheme('codelab-dark-modern', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8E8E97', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'F87171' },
        { token: 'keyword.control', foreground: 'F87171' },
        { token: 'keyword.operator', foreground: 'D4D4D8' },
        { token: 'storage', foreground: 'F87171' },
        { token: 'type', foreground: 'FB923C' },
        { token: 'type.identifier', foreground: 'FB923C' },
        { token: 'class', foreground: 'FB923C' },
        { token: 'interface', foreground: 'FB923C' },
        { token: 'function', foreground: 'C084FC' },
        { token: 'identifier.function', foreground: 'C084FC' },
        { token: 'variable', foreground: 'E4E4E7' },
        { token: 'variable.predefined', foreground: '93C5FD' },
        { token: 'constant', foreground: '93C5FD' },
        { token: 'string', foreground: '86EFAC' },
        { token: 'string.key.json', foreground: 'E4E4E7' },
        { token: 'string.value.json', foreground: '86EFAC' },
        { token: 'number', foreground: 'FCD34D' },
        { token: 'regexp', foreground: 'FCA5A5' },
        { token: 'tag', foreground: 'F87171' },
        { token: 'attribute.name', foreground: 'FCD34D' },
        { token: 'attribute.value', foreground: '86EFAC' },
        { token: 'delimiter', foreground: 'A1A1AA' }
      ],
      colors: {
        'editor.background': '#0f0f10',
        'editor.foreground': '#f4f4f5',
        'editorLineNumber.foreground': '#6e6e77',
        'editorLineNumber.activeForeground': '#f4f4f5',
        'editorCursor.foreground': '#f4f4f5',
        'editor.selectionBackground': '#28282b',
        'editor.inactiveSelectionBackground': '#1f1f22',
        'editor.lineHighlightBackground': '#18181a99',
        'editor.lineHighlightBorder': '#00000000',
        'editorGutter.background': '#0f0f10',
        'editorGutter.modifiedBackground': '#fbbf24',
        'editorGutter.addedBackground': '#34d399',
        'editorGutter.deletedBackground': '#f87171',
        'editorWidget.background': '#18181a',
        'editorWidget.border': '#27272a',
        'editorSuggestWidget.background': '#18181a',
        'editorSuggestWidget.border': '#27272a',
        'editorSuggestWidget.selectedBackground': '#28282b',
        'editorSuggestWidget.highlightForeground': '#ffffff',
        'editorHoverWidget.background': '#18181a',
        'editorHoverWidget.border': '#27272a',
        'editorIndentGuide.background1': '#27272a80',
        'editorIndentGuide.activeBackground1': '#3a3a3e',
        'editorBracketMatch.background': '#28282b80',
        'editorBracketMatch.border': '#71717a',
        'scrollbarSlider.background': '#3a3a3e66',
        'scrollbarSlider.hoverBackground': '#52525b99',
        'scrollbarSlider.activeBackground': '#71717acc',
        'diffEditor.insertedTextBackground': '#10b98124',
        'diffEditor.removedTextBackground': '#ef444424'
      }
    });

    monaco.editor.defineTheme('codelab-light-modern', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6E6A64', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C2410C' },
        { token: 'keyword.control', foreground: 'C2410C' },
        { token: 'type', foreground: '9A3412' },
        { token: 'type.identifier', foreground: '9A3412' },
        { token: 'function', foreground: '6D28D9' },
        { token: 'identifier.function', foreground: '6D28D9' },
        { token: 'variable', foreground: '18181B' },
        { token: 'constant', foreground: '1D4ED8' },
        { token: 'string', foreground: '067647' },
        { token: 'string.key.json', foreground: '18181B' },
        { token: 'string.value.json', foreground: '067647' },
        { token: 'number', foreground: 'B54708' },
        { token: 'tag', foreground: 'C2410C' },
        { token: 'attribute.name', foreground: '9A3412' },
        { token: 'attribute.value', foreground: '067647' },
        { token: 'delimiter', foreground: '52525B' }
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#18181b',
        'editorLineNumber.foreground': '#8a8680',
        'editorLineNumber.activeForeground': '#18181b',
        'editorCursor.foreground': '#18181b',
        'editor.selectionBackground': '#e6e4df',
        'editor.inactiveSelectionBackground': '#f1f1ee',
        'editor.lineHighlightBackground': '#f7f7f5',
        'editor.lineHighlightBorder': '#00000000',
        'editorGutter.background': '#ffffff',
        'editorGutter.modifiedBackground': '#b54708',
        'editorGutter.addedBackground': '#067647',
        'editorGutter.deletedBackground': '#b42318',
        'editorWidget.background': '#f7f7f5',
        'editorWidget.border': '#e6e4df',
        'editorSuggestWidget.background': '#f7f7f5',
        'editorSuggestWidget.border': '#e6e4df',
        'editorSuggestWidget.selectedBackground': '#ecebe7',
        'editorSuggestWidget.highlightForeground': '#09090b',
        'editorHoverWidget.background': '#f7f7f5',
        'editorHoverWidget.border': '#e6e4df',
        'editorIndentGuide.background1': '#e6e4df',
        'editorIndentGuide.activeBackground1': '#d3d0c9',
        'diffEditor.insertedTextBackground': '#0676471f',
        'diffEditor.removedTextBackground': '#b423181a'
      }
    });

    monaco.editor.defineTheme('codelab-hc-black', {
      base: 'hc-black',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#ffffff',
        'editor.selectionBackground': '#3f3f46',
        'contrastBorder': '#ffffff'
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function getMonacoThemeName(resolvedTheme: string, monaco?: MonacoNamespaceLike | null): string {
  const hasCustomThemes = monaco ? registerCodeLabMonacoThemes(monaco) : false;
  if (resolvedTheme === 'light') {
    return hasCustomThemes ? 'codelab-light-modern' : 'vs';
  }
  if (resolvedTheme === 'high-contrast') {
    return hasCustomThemes ? 'codelab-hc-black' : 'hc-black';
  }
  return hasCustomThemes ? 'codelab-dark-modern' : 'vs-dark';
}

/**
 * Maps a workspace filename to its exact Monaco language ID.
 */
export function getMonacoLanguageForFile(filePath: string, fallbackLang = 'javascript'): string {
  const raw = String(filePath || '').trim();
  if (!raw || raw === '__welcome__') return 'markdown';
  const base = raw.split('/').pop() || raw;
  const lower = base.toLowerCase();

  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
  if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile';
  if (lower === '.gitignore' || lower === '.npmrc' || lower.startsWith('.env')) return 'ini';

  const dotIdx = lower.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';

  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.json':
    case '.jsonc':
    case '.prettierrc':
    case '.eslintrc':
      return 'json';
    case '.css':
      return 'css';
    case '.scss':
      return 'scss';
    case '.less':
      return 'less';
    case '.html':
    case '.htm':
      return 'html';
    case '.md':
    case '.mdx':
    case '.markdown':
      return 'markdown';
    case '.py':
    case '.pyw':
      return 'python';
    case '.cpp':
    case '.cc':
    case '.cxx':
    case '.c':
    case '.h':
    case '.hpp':
    case '.hxx':
      return 'cpp';
    case '.sql':
      return 'sql';
    case '.sh':
    case '.bash':
    case '.zsh':
      return 'shell';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.xml':
    case '.svg':
      return 'xml';
    case '.toml':
    case '.ini':
    case '.conf':
      return 'ini';
    case '.txt':
    case '.log':
      return 'plaintext';
    default:
      if (fallbackLang === 'ts') return 'typescript';
      if (fallbackLang === 'py') return 'python';
      if (fallbackLang === 'cpp') return 'cpp';
      if (fallbackLang === 'sql') return 'sql';
      return 'javascript';
  }
}

/**
 * Human-readable VS Code Status Bar language mode label.
 */
export function getLanguageDisplayLabel(filePath: string, fallbackLang = 'js'): string {
  const raw = String(filePath || '').trim();
  if (!raw || raw === '__welcome__') return 'Welcome';
  const lower = (raw.split('/').pop() || raw).toLowerCase();
  if (lower.endsWith('.tsx')) return 'TypeScript JSX';
  if (lower.endsWith('.jsx')) return 'JavaScript JSX';
  if (lower.endsWith('.jsonc') || lower === 'tsconfig.json' || lower === 'jsconfig.json') return 'JSON with Comments';
  const langId = getMonacoLanguageForFile(raw, fallbackLang);
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    json: 'JSON',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    html: 'HTML',
    markdown: 'Markdown',
    python: 'Python',
    cpp: 'C++',
    sql: 'SQL',
    shell: 'Shell Script',
    yaml: 'YAML',
    xml: 'XML',
    ini: 'Properties',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    plaintext: 'Plain Text'
  };
  return labels[langId] || 'Plain Text';
}

export function normalizeWorkspaceRelPath(filePath: string): string {
  let clean = String(filePath || '').replace(/\\/g, '/').trim();
  const wsMatch = clean.match(/^(?:file:\/\/)?\/workspace(?:-[^/]+)?\/(.*)$/);
  if (wsMatch) {
    clean = wsMatch[1];
  } else if (clean.startsWith('file:///')) {
    clean = clean.slice('file:///'.length);
  }
  return clean.replace(/^\/+/, '');
}

/**
 * Builds a canonical `file:///workspace[-instance]/<relPath>` Monaco Uri so multi-file TS/JS imports resolve cleanly.
 */
export function toWorkspaceModelUri(
  monaco: MonacoNamespaceLike | null | undefined,
  filePath: string,
  workspacePrefix = '/workspace'
): MonacoUriLike | undefined {
  const clean = normalizeWorkspaceRelPath(filePath);
  const normPrefix = ('/' + String(workspacePrefix || '/workspace').replace(/^\/+|\/+$/g, '')).replace(/\/+$/, '');
  if (!monaco || !monaco.Uri) return undefined;
  if (typeof monaco.Uri.file === 'function') {
    return monaco.Uri.file(`${normPrefix}/${clean}`);
  }
  if (typeof monaco.Uri.parse === 'function') {
    return monaco.Uri.parse(`file://${normPrefix}/${clean}`);
  }
  return undefined;
}

export function fromWorkspaceModelUri(
  uri: MonacoUriLike | string | null | undefined,
  workspacePrefix = '/workspace'
): string | null {
  if (!uri) return null;
  const raw = typeof uri === 'string' ? uri : String(uri.path || uri.toString?.() || '');
  if (raw.includes('/node_modules/')) return null;
  const normPrefix = ('/' + String(workspacePrefix || '/workspace').replace(/^\/+|\/+$/g, '')).replace(/\/+$/, '');
  if (raw.startsWith(`file://${normPrefix}/`)) {
    return raw.slice(`file://${normPrefix}/`.length).replace(/^\/+/, '');
  }
  if (raw.startsWith(`${normPrefix}/`)) {
    return raw.slice(`${normPrefix}/`.length).replace(/^\/+/, '');
  }
  const instMatch = raw.match(/^(?:file:\/\/)?\/workspace(?:-[^/]+)?\/(.+)$/);
  if (instMatch) {
    return instMatch[1].replace(/^\/+/, '');
  }
  if (raw.startsWith('file:///') && !raw.startsWith('file:///node_modules/')) {
    return raw.slice('file:///'.length).replace(/^\/+/, '');
  }
  if (raw.startsWith('/') && !raw.startsWith('/node_modules/')) {
    return raw.replace(/^\/+/, '');
  }
  return null;
}

/**
 * Strips `//` and `/* ... * /` comments + trailing commas so `tsconfig.json` (JSONC) parses cleanly.
 */
export function parseJsoncSafe(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  let out = '';
  let inStr = false;
  let esc = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < raw.length && raw[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  const withoutTrailingCommas = out.replace(/,\s*([}\]])/g, '$1');
  try {
    const parsed: unknown = JSON.parse(withoutTrailingCommas);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Synchronizes `/workspace/tsconfig.json` or `jsconfig.json` compiler options into Monaco's TS/JS workers.
 */
export function syncTsConfigToMonaco(
  monaco: MonacoNamespaceLike | null | undefined,
  files: Record<string, string>,
  workspaceRootUri = 'file:///workspace'
): void {
  const tsLang = monaco?.languages?.typescript;
  if (!tsLang) return;

  const cleanRootUri = String(workspaceRootUri || 'file:///workspace').replace(/\/+$/, '');
  const tsDefaults = tsLang.typescriptDefaults;
  const jsDefaults = tsLang.javascriptDefaults;
  const ST = tsLang.ScriptTarget || {};
  const MK = tsLang.ModuleKind || {};
  const MR = tsLang.ModuleResolutionKind || {};
  const JSX = tsLang.JsxEmit || {};

  const baseCompilerOptions: Record<string, unknown> = {
    target: ST.ESNext ?? ST.ES2020 ?? 99,
    module: MK.ESNext ?? 99,
    moduleResolution: MR.NodeJs ?? 2,
    jsx: JSX.ReactJSX ?? JSX.React ?? 4,
    allowNonTsExtensions: true,
    allowJs: true,
    checkJs: false,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true,
    isolatedModules: false,
    noEmit: true,
    skipLibCheck: true,
    baseUrl: cleanRootUri
  };

  const rawTsConfig = files['tsconfig.json'] ?? files['jsconfig.json'];
  const parsed = rawTsConfig ? parseJsoncSafe(rawTsConfig) : null;
  const userOpts =
    parsed && parsed.compilerOptions && typeof parsed.compilerOptions === 'object' && !Array.isArray(parsed.compilerOptions)
      ? (parsed.compilerOptions as Record<string, unknown>)
      : null;

  if (userOpts) {
    if (typeof userOpts.strict === 'boolean') baseCompilerOptions.strict = userOpts.strict;
    if (typeof userOpts.noImplicitAny === 'boolean') baseCompilerOptions.noImplicitAny = userOpts.noImplicitAny;
    if (typeof userOpts.strictNullChecks === 'boolean') baseCompilerOptions.strictNullChecks = userOpts.strictNullChecks;
    if (typeof userOpts.checkJs === 'boolean') baseCompilerOptions.checkJs = userOpts.checkJs;
    if (typeof userOpts.allowJs === 'boolean') baseCompilerOptions.allowJs = userOpts.allowJs;
    if (typeof userOpts.experimentalDecorators === 'boolean') {
      baseCompilerOptions.experimentalDecorators = userOpts.experimentalDecorators;
    }
    if (typeof userOpts.jsx === 'string') {
      const jsxLower = userOpts.jsx.toLowerCase();
      if (jsxLower === 'preserve' && JSX.Preserve !== undefined) baseCompilerOptions.jsx = JSX.Preserve;
      else if (jsxLower === 'react' && JSX.React !== undefined) baseCompilerOptions.jsx = JSX.React;
      else if (JSX.ReactJSX !== undefined) baseCompilerOptions.jsx = JSX.ReactJSX;
    }
    if (userOpts.paths && typeof userOpts.paths === 'object') {
      baseCompilerOptions.paths = userOpts.paths;
    }
    if (typeof userOpts.baseUrl === 'string') {
      const cleanBase = userOpts.baseUrl.replace(/^\.\/?/, '').replace(/^\/+/, '');
      baseCompilerOptions.baseUrl = cleanBase ? `${cleanRootUri}/${cleanBase}` : cleanRootUri;
    }
  }

  try {
    if (tsDefaults?.setCompilerOptions) tsDefaults.setCompilerOptions(baseCompilerOptions);
    if (tsDefaults?.setEagerModelSync) tsDefaults.setEagerModelSync(true);
    if (tsDefaults?.setDiagnosticsOptions) {
      tsDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false
      });
    }
    if (jsDefaults?.setCompilerOptions) {
      jsDefaults.setCompilerOptions({
        ...baseCompilerOptions,
        allowJs: true,
        checkJs: Boolean(userOpts?.checkJs)
      });
    }
    if (jsDefaults?.setEagerModelSync) jsDefaults.setEagerModelSync(true);
    if (jsDefaults?.setDiagnosticsOptions) {
      jsDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false
      });
    }
  } catch (_err) {
    void _err;
  }
}

/**
 * IndexedDB-backed Automatic Type Acquisition (ATA) controller for bare npm imports in TS/JS.
 */
const ATA_DB_NAME = 'codelab_ata_cache_v1';
const ATA_STORE_NAME = 'dts';

function readAtaCache(pkgName: string): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(ATA_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ATA_STORE_NAME)) {
          db.createObjectStore(ATA_STORE_NAME);
        }
      };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(ATA_STORE_NAME, 'readonly');
          const getReq = tx.objectStore(ATA_STORE_NAME).get(pkgName);
          getReq.onsuccess = () => resolve(typeof getReq.result === 'string' ? getReq.result : null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function writeAtaCache(pkgName: string, dts: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(ATA_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ATA_STORE_NAME)) {
          db.createObjectStore(ATA_STORE_NAME);
        }
      };
      req.onerror = () => resolve();
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(ATA_STORE_NAME, 'readwrite');
          tx.objectStore(ATA_STORE_NAME).put(dts, pkgName);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}

export function extractBarePackageSpecifiers(files: Record<string, string>): string[] {
  const packages = new Set<string>();
  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;

  const normalizePkg = (spec: string): string | null => {
    const trimmed = String(spec || '').trim();
    if (!trimmed || trimmed.startsWith('.') || trimmed.startsWith('/') || trimmed.startsWith('http:') || trimmed.startsWith('https:') || trimmed.startsWith('node:')) {
      return null;
    }
    if (trimmed.startsWith('@')) {
      const parts = trimmed.split('/');
      if (parts.length < 2) return null;
      return `${parts[0]}/${parts[1]}`;
    }
    const root = trimmed.split('/')[0];
    if (!root || BUILTIN_NODE_MODULES.has(root)) return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(root)) return null;
    return root;
  };

  for (const [path, content] of Object.entries(files || {})) {
    const lower = path.toLowerCase();
    if (lower === 'package.json' || lower.endsWith('/package.json')) {
      const pkg = parseJsoncSafe(content);
      if (pkg) {
        for (const section of [pkg.dependencies, pkg.devDependencies]) {
          if (section && typeof section === 'object') {
            for (const name of Object.keys(section)) {
              const normalized = normalizePkg(name);
              if (normalized) packages.add(normalized);
            }
          }
        }
      }
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/i.test(lower)) continue;
    importRegex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(String(content || ''))) !== null) {
      const spec = m[1] || m[2] || m[3] || '';
      const normalized = normalizePkg(spec);
      if (normalized) packages.add(normalized);
    }
  }

  return Array.from(packages);
}

async function fetchPackageDtsFromCdn(pkgName: string): Promise<string | null> {
  if (typeof fetch !== 'function') return null;

  const fetchWithTimeout = async (url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Response | null> => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), 4500);
    try {
      const res = await fetch(url, { method, signal: ctrl?.signal });
      return res;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Strategy 1: esm.sh X-TypeScript-Types header
  const esmHead = await fetchWithTimeout(`https://esm.sh/${pkgName}`, 'GET');
  if (esmHead) {
    const typesUrl = esmHead.headers?.get?.('x-typescript-types') || esmHead.headers?.get?.('X-TypeScript-Types');
    if (typesUrl) {
      const resolvedUrl = typesUrl.startsWith('http') ? typesUrl : `https://esm.sh${typesUrl.startsWith('/') ? '' : '/'}${typesUrl}`;
      const dtsRes = await fetchWithTimeout(resolvedUrl, 'GET');
      if (dtsRes && dtsRes.ok) {
        const text = await dtsRes.text();
        if (text && text.length < 600_000) return text;
      }
    }
  }

  // Strategy 2: jsDelivr package.json -> types / typings or @types/<pkg>
  const tryJsDelivr = async (targetPkg: string): Promise<string | null> => {
    const pkgJsonRes = await fetchWithTimeout(`https://cdn.jsdelivr.net/npm/${targetPkg}/package.json`, 'GET');
    if (!pkgJsonRes || !pkgJsonRes.ok) return null;
    const meta = await pkgJsonRes.json().catch(() => null);
    if (!meta || typeof meta !== 'object') return null;
    const typesRel = String(meta.types || meta.typings || 'index.d.ts').replace(/^\.\//, '').replace(/^\/+/, '');
    const dtsRes = await fetchWithTimeout(`https://cdn.jsdelivr.net/npm/${targetPkg}/${typesRel}`, 'GET');
    if (dtsRes && dtsRes.ok) {
      const text = await dtsRes.text();
      if (text && text.length < 600_000) return text;
    }
    return null;
  };

  const direct = await tryJsDelivr(pkgName);
  if (direct) return direct;

  const typesPkgName = pkgName.startsWith('@')
    ? `@types/${pkgName.slice(1).replace('/', '__')}`
    : `@types/${pkgName}`;
  return tryJsDelivr(typesPkgName);
}

export class WorkspaceAtaController {
  private monaco: MonacoNamespaceLike | null | undefined;
  private acquired = new Set<string>();
  private inFlight = new Set<string>();
  private disposables: Array<{ dispose?: () => void }> = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(monaco: MonacoNamespaceLike | null | undefined) {
    this.monaco = monaco;
  }

  public scheduleScan(files: Record<string, string>, delayMs = 450): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.scanNow(files);
    }, delayMs);
  }

  public async scanNow(files: Record<string, string>): Promise<void> {
    const tsLang = this.monaco?.languages?.typescript;
    if (!tsLang?.typescriptDefaults?.addExtraLib) return;

    // Also inspect installed VFS /workspace/node_modules/<pkg>/.d.ts first if present in workspace map
    const specs = extractBarePackageSpecifiers(files);
    for (const pkgName of specs) {
      if (this.acquired.has(pkgName) || this.inFlight.has(pkgName)) continue;
      this.inFlight.add(pkgName);
      void this.acquireOne(pkgName).finally(() => {
        this.inFlight.delete(pkgName);
      });
    }
  }

  public registerLocalPackageTypes(pkgName: string, dtsContent: string): void {
    if (!pkgName || !dtsContent || this.acquired.has(pkgName)) return;
    this.injectExtraLib(pkgName, dtsContent);
  }

  private injectExtraLib(pkgName: string, rawDts: string): void {
    const tsLang = this.monaco?.languages?.typescript;
    if (!tsLang?.typescriptDefaults?.addExtraLib) return;
    this.acquired.add(pkgName);

    const hasDeclareModule = new RegExp(`declare\\s+module\\s+['"]${pkgName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(rawDts);
    const wrapped = hasDeclareModule
      ? rawDts
      : `${rawDts}\n;declare module '${pkgName}' { export * from 'file:///node_modules/${pkgName}/index'; }\n`;
    const fileUri = `file:///node_modules/${pkgName}/index.d.ts`;
    try {
      const d1 = tsLang.typescriptDefaults.addExtraLib(rawDts, fileUri);
      if (d1) this.disposables.push(d1);
      if (tsLang.javascriptDefaults?.addExtraLib) {
        const d2 = tsLang.javascriptDefaults.addExtraLib(wrapped, fileUri);
        if (d2) this.disposables.push(d2);
      }
    } catch (_err) {
      void _err;
    }
  }

  private async acquireOne(pkgName: string): Promise<void> {
    const cached = await readAtaCache(pkgName);
    if (cached) {
      this.injectExtraLib(pkgName, cached);
      return;
    }
    const fetched = await fetchPackageDtsFromCdn(pkgName);
    if (fetched) {
      await writeAtaCache(pkgName, fetched);
      this.injectExtraLib(pkgName, fetched);
    }
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const d of this.disposables) {
      try {
        d?.dispose?.();
      } catch (_err) {
        void _err;
      }
    }
    this.disposables = [];
  }
}

/**
 * Registers cross-file Go to Definition (`F12` / `Cmd+Click`) so Monaco switches tabs automatically.
 */
export function registerCrossFileEditorOpener(
  monaco: MonacoNamespaceLike | null | undefined,
  onOpenWorkspaceFile: (relPath: string, lineNumber?: number, column?: number) => boolean | void,
  workspacePrefix = '/workspace'
): { dispose: () => void } {
  if (!monaco?.editor || typeof monaco.editor.registerEditorOpener !== 'function') {
    return { dispose: () => {} };
  }
  return monaco.editor.registerEditorOpener({
    openCodeEditor(
      _source: unknown,
      resource: MonacoUriLike | string,
      selectionOrPosition?: Partial<MonacoRangeLike & MonacoPositionLike>
    ): boolean {
      const targetRel = fromWorkspaceModelUri(resource, workspacePrefix);
      if (!targetRel) return false;
      const line = selectionOrPosition?.startLineNumber ?? selectionOrPosition?.lineNumber ?? 1;
      const col = selectionOrPosition?.startColumn ?? selectionOrPosition?.column ?? 1;
      const handled = onOpenWorkspaceFile(targetRel, line, col);
      return handled !== false;
    }
  });
}

/**
 * Attaches HTML / JSX / TSX auto-closing tag insertion (`<div>` -> `<div>|</div>`) to a Monaco editor instance.
 */
export function attachAutoCloseTagBehavior(
  monaco: MonacoNamespaceLike | null | undefined,
  editor: MonacoEditorLike | null | undefined
): { dispose: () => void } {
  if (!editor || typeof editor.onDidChangeModelContent !== 'function') {
    return { dispose: () => {} };
  }
  let isInserting = false;
  const sub = editor.onDidChangeModelContent((event: MonacoChangeEventLike) => {
    if (isInserting || !event || !Array.isArray(event.changes) || event.changes.length !== 1) return;
    const change = event.changes[0];
    if (change.text !== '>') return;

    const model = editor.getModel?.();
    if (!model) return;
    const langId = typeof model.getLanguageId === 'function' ? model.getLanguageId() : '';
    if (langId !== 'html' && langId !== 'javascript' && langId !== 'typescript' && langId !== 'xml') return;

    const lineNumber = change.range.startLineNumber;
    const afterCol = change.range.startColumn + 1;
    const linePrefix = String(model.getLineContent(lineNumber) || '').slice(0, afterCol - 1);

    // Ignore self-closing `/>`, closing `</tag>`, comments `-->`, or comparison operators `a >`
    if (linePrefix.endsWith('/>') || linePrefix.endsWith('-->') || linePrefix.endsWith('=>')) return;
    const tagMatch = linePrefix.match(/<([A-Za-z][A-Za-z0-9._:-]*)(?:\s+[^<>]*?)?>$/);
    if (!tagMatch) return;
    const tagName = tagMatch[1];
    if (VOID_HTML_TAGS.has(tagName.toLowerCase())) return;

    // Avoid duplicating if closing tag already immediately follows cursor
    const lineSuffix = String(model.getLineContent(lineNumber) || '').slice(afterCol - 1);
    if (lineSuffix.startsWith(`</${tagName}>`)) return;

    isInserting = true;
    try {
      const range = monaco?.Range
        ? new monaco.Range(lineNumber, afterCol, lineNumber, afterCol)
        : { startLineNumber: lineNumber, startColumn: afterCol, endLineNumber: lineNumber, endColumn: afterCol };
      editor.executeEdits('codelab-auto-close-tag', [{ range, text: `</${tagName}>`, forceMoveMarkers: false }]);
      editor.setPosition({ lineNumber, column: afterCol });
    } catch (_err) {
      void _err;
    } finally {
      isInserting = false;
    }
  });
  return sub || { dispose: () => {} };
}

function expandSimpleEmmet(abbr: string): string | null {
  const clean = abbr.trim();
  if (clean === '!' || clean === 'html:5') {
    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '  <title>${1:Document}</title>',
      '</head>',
      '<body>',
      '  $0',
      '</body>',
      '</html>'
    ].join('\n');
  }
  // Support tag#id.class1.class2*count and parent>child*count
  const parts = clean.split('>');
  if (parts.length > 3) return null;

  const parseSegment = (seg: string): { tag: string; id: string; classes: string[]; count: number } | null => {
    const m = seg.match(/^([a-zA-Z][a-zA-Z0-9-]*)?(?:#([a-zA-Z0-9_-]+))?((?:\.[a-zA-Z0-9_-]+)*)(?:\*(\d+))?$/);
    if (!m) return null;
    const tag = m[1] || (m[2] || m[3] ? 'div' : '');
    if (!tag) return null;
    const id = m[2] || '';
    const classes = m[3] ? m[3].slice(1).split('.').filter(Boolean) : [];
    const count = Math.min(12, Math.max(1, Number(m[4] || 1)));
    if (parts.length === 1 && !m[2] && classes.length === 0 && !m[4]) return null;
    return { tag, id, classes, count };
  };

  const parsed = parts.map(parseSegment);
  if (parsed.some((p) => !p)) return null;

  const renderNode = (idx: number, indent: string, tabStopRef: { n: number }): string => {
    const node = parsed[idx]!;
    const attrs = [
      node.id ? ` id="${node.id}"` : '',
      node.classes.length ? ` class="${node.classes.join(' ')}"` : ''
    ].join('');
    const lines: string[] = [];
    for (let i = 0; i < node.count; i++) {
      if (VOID_HTML_TAGS.has(node.tag.toLowerCase())) {
        lines.push(`${indent}<${node.tag}${attrs} />`);
      } else if (idx < parsed.length - 1) {
        lines.push(`${indent}<${node.tag}${attrs}>\n${renderNode(idx + 1, indent + '  ', tabStopRef)}\n${indent}</${node.tag}>`);
      } else {
        const stop = tabStopRef.n === 0 ? '$0' : `\${${tabStopRef.n}}`;
        tabStopRef.n++;
        lines.push(`${indent}<${node.tag}${attrs}>${stop}</${node.tag}>`);
      }
    }
    return lines.join('\n');
  };

  return renderNode(0, '', { n: 1 });
}

function collectCssVariables(files: Record<string, string>): Map<string, { value: string; file: string }> {
  const vars = new Map<string, { value: string; file: string }>();
  const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
  for (const [file, content] of Object.entries(files || {})) {
    if (!/\.(?:css|scss|less|html)$/i.test(file)) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(String(content || ''))) !== null) {
      if (!vars.has(m[1])) {
        vars.set(m[1], { value: m[2].trim(), file });
      }
    }
  }
  return vars;
}

function collectSqlSchemaTables(files: Record<string, string>, currentContent = ''): Array<{ table: string; columns: Array<{ name: string; type: string }> }> {
  const tables = new Map<string, Array<{ name: string; type: string }>>();
  const sources = [...Object.entries(files || {}).filter(([f]) => /\.sql$/i.test(f)).map(([, c]) => c), currentContent];
  const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s*\(([\s\S]*?)\)\s*;/gi;

  for (const src of sources) {
    if (!src) continue;
    createTableRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = createTableRe.exec(src)) !== null) {
      const tableName = m[1];
      const body = m[2];
      const cols: Array<{ name: string; type: string }> = [];
      for (const rawLine of body.split(',')) {
        const trimmed = rawLine.trim();
        if (!trimmed || /^(?:PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) continue;
        const colMatch = trimmed.match(/^["`[]?([A-Za-z_][A-Za-z0-9_]*)["`\]]?\s+([A-Za-z0-9_()]+)/);
        if (colMatch) {
          cols.push({ name: colMatch[1], type: colMatch[2].toUpperCase() });
        }
      }
      tables.set(tableName, cols);
    }
  }

  return Array.from(tables.entries()).map(([table, columns]) => ({ table, columns }));
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
  'CREATE TABLE', 'CREATE INDEX', 'DROP TABLE', 'ALTER TABLE', 'JOIN', 'LEFT JOIN',
  'INNER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
  'AS', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS NULL', 'IS NOT NULL', 'PRIMARY KEY',
  'FOREIGN KEY', 'REFERENCES', 'AUTOINCREMENT', 'DEFAULT', 'UNIQUE', 'BEGIN TRANSACTION', 'COMMIT'
];

const SQL_FUNCTIONS: Array<{ name: string; sig: string; doc: string }> = [
  { name: 'COUNT', sig: 'COUNT(expr) -> INTEGER', doc: 'Returns the number of rows matching the query.' },
  { name: 'SUM', sig: 'SUM(expr) -> NUMERIC', doc: 'Returns the sum of non-NULL values in a group.' },
  { name: 'AVG', sig: 'AVG(expr) -> REAL', doc: 'Returns the average value of non-NULL values.' },
  { name: 'MIN', sig: 'MIN(expr) -> ANY', doc: 'Returns the minimum non-NULL value.' },
  { name: 'MAX', sig: 'MAX(expr) -> ANY', doc: 'Returns the maximum non-NULL value.' },
  { name: 'COALESCE', sig: 'COALESCE(x, y, ...) -> ANY', doc: 'Returns the first non-NULL argument.' },
  { name: 'LOWER', sig: 'LOWER(str) -> TEXT', doc: 'Converts ASCII string characters to lowercase.' },
  { name: 'UPPER', sig: 'UPPER(str) -> TEXT', doc: 'Converts ASCII string characters to uppercase.' },
  { name: 'ROUND', sig: 'ROUND(num, digits?) -> REAL', doc: 'Rounds a floating-point value to the specified precision.' },
  { name: 'DATETIME', sig: "DATETIME('now', modifier...) -> TEXT", doc: 'Returns formatted ISO-8601 date and time.' }
];

/**
 * Configures Monaco language services once per `monaco` global instance:
 * - VS Code Modern themes
 * - Node.js ambient `.d.ts` + `tsconfig.json` compiler options
 * - JSON schemas (`package.json`, `tsconfig.json`, `jsconfig.json`)
 * - HTML Emmet completions, CSS cross-file variable completions/hovers, SQL schema completions/hovers
 */
export function initializeMonacoIntelligence(
  monaco: MonacoNamespaceLike | null | undefined,
  getWorkspaceFiles: WorkspaceFilesGetter
): void {
  if (!monaco || typeof monaco !== 'object') return;
  registerCodeLabMonacoThemes(monaco);
  syncTsConfigToMonaco(monaco, getWorkspaceFiles() || {});

  if (registeredMonacoInstances.has(monaco)) return;
  registeredMonacoInstances.add(monaco);

  // 1. Node.js / Web ambient declarations
  try {
    const tsLang = monaco.languages?.typescript;
    if (tsLang?.typescriptDefaults?.addExtraLib) {
      tsLang.typescriptDefaults.addExtraLib(NODE_AMBIENT_DTS, 'file:///node_modules/@types/node/index.d.ts');
    }
    if (tsLang?.javascriptDefaults?.addExtraLib) {
      tsLang.javascriptDefaults.addExtraLib(NODE_AMBIENT_DTS, 'file:///node_modules/@types/node/index.d.ts');
    }
  } catch (_err) {
    void _err;
  }

  // 2. JSON Schemas (`package.json`, `tsconfig.json`, `jsconfig.json`)
  try {
    const jsonDefaults = monaco.languages?.json?.jsonDefaults;
    if (jsonDefaults?.setDiagnosticsOptions) {
      jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        trailingCommas: 'ignore',
        enableSchemaRequest: false,
        schemas: [PACKAGE_JSON_SCHEMA, TSCONFIG_JSON_SCHEMA]
      });
    }
  } catch (_err) {
    void _err;
  }

  if (!monaco.languages?.registerCompletionItemProvider) return;
  const CIK = monaco.languages.CompletionItemKind || {};
  const CITR = monaco.languages.CompletionItemInsertTextRule || {};

  // 3. HTML Emmet abbreviation expansion
  monaco.languages.registerCompletionItemProvider('html', {
    triggerCharacters: ['!', '.', '#', '*', '>'],
    provideCompletionItems(model: MonacoTextModelLike, position: MonacoPositionLike) {
      const linePrefix = String(model.getLineContent(position.lineNumber) || '').slice(0, position.column - 1);
      const abbrMatch = linePrefix.match(/(?:^|\s)(!|html:5|[a-zA-Z.#][a-zA-Z0-9.#*>-]*)$/);
      if (!abbrMatch) return { suggestions: [] };
      const abbr = abbrMatch[1];
      const expanded = expandSimpleEmmet(abbr);
      if (!expanded) return { suggestions: [] };
      const startCol = position.column - abbr.length;
      return {
        suggestions: [{
          label: `${abbr} (Emmet)`,
          kind: CIK.Snippet ?? 27,
          detail: 'Emmet Abbreviation',
          documentation: { value: '```html\n' + expanded.replace(/\$\{\d+:?([^}]*)\}|\$0/g, '$1') + '\n```' },
          insertText: expanded,
          insertTextRules: CITR.InsertAsSnippet ?? 4,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: startCol,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        }]
      };
    }
  });

  // 4. Cross-file CSS Custom Property (`--var`) completions & hover
  for (const cssLang of ['css', 'scss', 'less']) {
    monaco.languages.registerCompletionItemProvider(cssLang, {
      triggerCharacters: ['-'],
      provideCompletionItems(model: MonacoTextModelLike, position: MonacoPositionLike) {
        const linePrefix = String(model.getLineContent(position.lineNumber) || '').slice(0, position.column - 1);
        if (!/(?:var\(\s*|--)[a-zA-Z0-9_-]*$/.test(linePrefix)) return { suggestions: [] };
        const vars = collectCssVariables(getWorkspaceFiles() || {});
        const word = model.getWordUntilPosition(position);
        const startCol = Math.max(1, linePrefix.lastIndexOf('--') + 1 || word.startColumn);
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: startCol,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        };
        return {
          suggestions: Array.from(vars.entries()).map(([name, info]) => ({
            label: name,
            kind: CIK.Variable ?? 5,
            detail: `${info.value} (${info.file})`,
            insertText: name,
            range
          }))
        };
      }
    });

    if (monaco.languages.registerHoverProvider) {
      monaco.languages.registerHoverProvider(cssLang, {
        provideHover(model: MonacoTextModelLike, position: MonacoPositionLike) {
          const line = String(model.getLineContent(position.lineNumber) || '');
          const re = /--[a-zA-Z0-9_-]+/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) {
            const start = m.index + 1;
            const end = start + m[0].length;
            if (position.column >= start && position.column <= end) {
              const info = collectCssVariables(getWorkspaceFiles() || {}).get(m[0]);
              if (!info) return null;
              const hoverRange = monaco.Range
                ? new monaco.Range(position.lineNumber, start, position.lineNumber, end)
                : { startLineNumber: position.lineNumber, startColumn: start, endLineNumber: position.lineNumber, endColumn: end };
              return {
                range: hoverRange,
                contents: [
                  { value: `\`\`\`css\n${m[0]}: ${info.value};\n\`\`\`` },
                  { value: `Defined in \`${info.file}\`` }
                ]
              };
            }
          }
          return null;
        }
      });
    }
  }

  // 5. SQL Schema-Aware Completion & Hover Provider
  monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems(model: MonacoTextModelLike, position: MonacoPositionLike) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn
      };
      const tables = collectSqlSchemaTables(getWorkspaceFiles() || {}, model.getValue?.() || '');
      const linePrefix = String(model.getLineContent(position.lineNumber) || '').slice(0, position.column - 1);
      const dotMatch = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z0-9_]*$/);

      if (dotMatch) {
        const tableObj = tables.find((t) => t.table.toLowerCase() === dotMatch[1].toLowerCase());
        if (tableObj) {
          return {
            suggestions: tableObj.columns.map((col) => ({
              label: col.name,
              kind: CIK.Field ?? 4,
              detail: `${tableObj.table}.${col.name} (${col.type})`,
              insertText: col.name,
              range
            }))
          };
        }
      }

      const suggestions: Array<Record<string, unknown>> = [];
      for (const kw of SQL_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: CIK.Keyword ?? 17,
          detail: 'SQL Keyword',
          insertText: kw,
          range
        });
      }
      for (const fn of SQL_FUNCTIONS) {
        suggestions.push({
          label: fn.name,
          kind: CIK.Function ?? 1,
          detail: fn.sig,
          documentation: fn.doc,
          insertText: `${fn.name}($0)`,
          insertTextRules: CITR.InsertAsSnippet ?? 4,
          range
        });
      }
      for (const t of tables) {
        suggestions.push({
          label: t.table,
          kind: CIK.Struct ?? 6,
          detail: `Table (${t.columns.map((c) => c.name).join(', ')})`,
          insertText: t.table,
          range
        });
        for (const col of t.columns) {
          suggestions.push({
            label: col.name,
            kind: CIK.Field ?? 4,
            detail: `${t.table}.${col.name}: ${col.type}`,
            insertText: col.name,
            range
          });
        }
      }
      return { suggestions };
    }
  });

  if (monaco.languages.registerHoverProvider) {
    monaco.languages.registerHoverProvider('sql', {
      provideHover(model: MonacoTextModelLike, position: MonacoPositionLike) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        const upper = word.word.toUpperCase();
        const fn = SQL_FUNCTIONS.find((f) => f.name === upper);
        if (fn) {
          const fnRange = monaco.Range
            ? new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
            : { startLineNumber: position.lineNumber, startColumn: word.startColumn, endLineNumber: position.lineNumber, endColumn: word.endColumn };
          return {
            range: fnRange,
            contents: [{ value: `\`\`\`sql\n${fn.sig}\n\`\`\`` }, { value: fn.doc }]
          };
        }
        const tables = collectSqlSchemaTables(getWorkspaceFiles() || {}, model.getValue?.() || '');
        const table = tables.find((t) => t.table.toLowerCase() === word.word.toLowerCase());
        if (table) {
          const cols = table.columns.map((c) => `  ${c.name} ${c.type}`).join(',\n');
          const tblRange = monaco.Range
            ? new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
            : { startLineNumber: position.lineNumber, startColumn: word.startColumn, endLineNumber: position.lineNumber, endColumn: word.endColumn };
          return {
            range: tblRange,
            contents: [{ value: `\`\`\`sql\nTABLE ${table.table} (\n${cols}\n)\n\`\`\`` }]
          };
        }
        return null;
      }
    });
  }
}

/**
 * Extracts structured symbols from any workspace file for Explorer OUTLINE,
 * cursor-aware Breadcrumbs, and Quick Open `@symbol` / `#workspaceSymbol`.
 */
export function extractDocumentSymbols(filePath: string, content: string): CodeLabSymbolItem[] {
  const symbols: CodeLabSymbolItem[] = [];
  const text = String(content || '');
  if (!text) return symbols;
  const lines = text.split('\n');
  const lang = getMonacoLanguageForFile(filePath);

  if (lang === 'markdown') {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
      if (m) {
        symbols.push({
          name: m[2],
          kind: 'heading',
          detail: `H${m[1].length}`,
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: 1
        });
      }
    }
    return symbols;
  }

  if (lang === 'python') {
    let activeClass: { name: string; indent: number; idx: number } | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = (line.match(/^(\s*)/)?.[1] || '').length;
      if (activeClass && line.trim() && !line.trim().startsWith('#') && indent <= activeClass.indent) {
        symbols[activeClass.idx].endLine = Math.max(symbols[activeClass.idx].line, i);
        activeClass = null;
      }
      const clsMatch = line.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (clsMatch) {
        const idx = symbols.push({
          name: clsMatch[1],
          kind: 'class',
          file: filePath,
          line: i + 1,
          endLine: lines.length,
          column: line.indexOf(clsMatch[1]) + 1
        }) - 1;
        activeClass = { name: clsMatch[1], indent, idx };
        continue;
      }
      const defMatch = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      if (defMatch) {
        symbols.push({
          name: defMatch[1],
          kind: activeClass && indent > activeClass.indent ? 'method' : 'function',
          detail: `(${defMatch[2].trim()})`,
          containerName: activeClass && indent > activeClass.indent ? activeClass.name : undefined,
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: line.indexOf(defMatch[1]) + 1
        });
      }
    }
    return symbols;
  }

  if (lang === 'cpp') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
      const typeMatch = line.match(/^\s*(class|struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[2],
          kind: typeMatch[1] === 'struct' ? 'struct' : typeMatch[1] === 'enum' ? 'enum' : 'class',
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: line.indexOf(typeMatch[2]) + 1
        });
        continue;
      }
      const fnMatch = line.match(/^\s*(?:template\s*<[^>]+>\s*)?(?:inline\s+|static\s+|virtual\s+|constexpr\s+)*[A-Za-z_][A-Za-z0-9_:<>,&\s*]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^;{}]*)\)\s*(?:const\s*)?(?:noexcept\s*)?\{?/);
      if (fnMatch && !/^(?:if|for|while|switch|catch|return)$/.test(fnMatch[1])) {
        symbols.push({
          name: fnMatch[1],
          kind: 'function',
          detail: `(${fnMatch[2].trim()})`,
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: line.indexOf(fnMatch[1]) + 1
        });
      }
    }
    return symbols;
  }

  if (lang === 'sql') {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?(TABLE|VIEW|INDEX|TRIGGER)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?([A-Za-z_][A-Za-z0-9_]*)/i);
      if (m) {
        symbols.push({
          name: m[2],
          kind: 'table',
          detail: m[1].toUpperCase(),
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: lines[i].indexOf(m[2]) + 1
        });
      }
    }
    return symbols;
  }

  if (lang === 'css' || lang === 'scss' || lang === 'less') {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*([.#@][A-Za-z0-9_.:[\]="\s>-]+?)\s*\{/);
      if (m) {
        symbols.push({
          name: m[1].trim(),
          kind: 'property',
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: 1
        });
      }
    }
    return symbols;
  }

  if (lang === 'json') {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s{1,4}"([^"]+)"\s*:/);
      if (m) {
        symbols.push({
          name: m[1],
          kind: 'property',
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: lines[i].indexOf(m[1]) + 1
        });
      }
    }
    return symbols;
  }

  // Default: TypeScript / JavaScript
  let activeContainer: { name: string; braceDepth: number; idx: number } | null = null;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      const classMatch = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(class|interface|enum|type)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
      if (classMatch) {
        const kind = classMatch[1] as SymbolKindName;
        const idx = symbols.push({
          name: classMatch[2],
          kind,
          file: filePath,
          line: i + 1,
          endLine: i + 1,
          column: line.indexOf(classMatch[2]) + 1
        }) - 1;
        if (kind === 'class' || kind === 'interface' || kind === 'enum') {
          activeContainer = { name: classMatch[2], braceDepth, idx };
        }
      } else {
        const fnMatch = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/);
        if (fnMatch) {
          symbols.push({
            name: fnMatch[1],
            kind: 'function',
            detail: `(${fnMatch[2].trim()})`,
            file: filePath,
            line: i + 1,
            endLine: i + 1,
            column: line.indexOf(fnMatch[1]) + 1
          });
        } else {
          const arrowMatch = line.match(/^\s*(?:export\s+)?(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][A-Za-z0-9_$]*))\s*=>/);
          if (arrowMatch) {
            symbols.push({
              name: arrowMatch[2],
              kind: 'function',
              detail: `(${(arrowMatch[3] ?? arrowMatch[4] ?? '').trim()}) =>`,
              file: filePath,
              line: i + 1,
              endLine: i + 1,
              column: line.indexOf(arrowMatch[2]) + 1
            });
          } else if (activeContainer && braceDepth === activeContainer.braceDepth + 1) {
            const methodMatch = line.match(/^\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+|get\s+|set\s+)*([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::[^{;]+)?\{/);
            if (methodMatch && !/^(?:if|for|while|switch|catch)$/.test(methodMatch[1])) {
              symbols.push({
                name: methodMatch[1],
                kind: 'method',
                detail: `(${methodMatch[2].trim()})`,
                containerName: activeContainer.name,
                file: filePath,
                line: i + 1,
                endLine: i + 1,
                column: line.indexOf(methodMatch[1]) + 1
              });
            }
          } else if (braceDepth === 0) {
            const constMatch = line.match(/^\s*(?:export\s+)?(const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*([^=;]+))?\s*=/);
            if (constMatch) {
              symbols.push({
                name: constMatch[2],
                kind: constMatch[1] === 'const' ? 'constant' : 'variable',
                detail: constMatch[3]?.trim(),
                file: filePath,
                line: i + 1,
                endLine: i + 1,
                column: line.indexOf(constMatch[2]) + 1
              });
            }
          }
        }
      }
    }

    for (let c = 0; c < line.length; c++) {
      if (line[c] === '{') braceDepth++;
      else if (line[c] === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
        if (activeContainer && braceDepth <= activeContainer.braceDepth) {
          symbols[activeContainer.idx].endLine = i + 1;
          activeContainer = null;
        }
      }
    }
  }

  for (let s = 0; s < symbols.length; s++) {
    if (symbols[s].endLine <= symbols[s].line) {
      const nextLine = symbols[s + 1] ? symbols[s + 1].line - 1 : lines.length;
      symbols[s].endLine = Math.max(symbols[s].line, nextLine);
    }
  }

  return symbols;
}

export function extractWorkspaceSymbols(files: Record<string, string>): CodeLabSymbolItem[] {
  const all: CodeLabSymbolItem[] = [];
  for (const [filePath, content] of Object.entries(files || {})) {
    if (!filePath || filePath === '__welcome__' || filePath.startsWith('.git/')) continue;
    const docSymbols = extractDocumentSymbols(filePath, content);
    for (const sym of docSymbols) all.push(sym);
  }
  return all;
}

export function findEnclosingSymbolAtLine(symbols: CodeLabSymbolItem[], lineNumber: number): CodeLabSymbolItem | null {
  let best: CodeLabSymbolItem | null = null;
  for (const sym of symbols) {
    if (lineNumber >= sym.line && lineNumber <= sym.endLine) {
      if (!best || sym.line >= best.line) {
        best = sym;
      }
    }
  }
  return best;
}
