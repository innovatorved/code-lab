/**
 * @innovatorved/code-lab — Shared Leveled Logger & Typed Error Hierarchy
 * ============================================================================
 * Bundled as `CodeLabLogger` into the runtime, shell, terminal, and workbench
 * bundles so no subsystem needs empty `catch` blocks or ad-hoc console calls.
 */

export const LOG_PREFIX = '[code-lab]';

export type CodeLabLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface CodeLabLogSink {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

export interface CodeLabLoggerOptions {
  logger?: CodeLabLogSink | null;
  debug?: boolean;
  prefix?: string;
}

export interface CodeLabLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export type CodeLabErrorCode =
  | 'E_SAVE'
  | 'E_PERSISTENCE'
  | 'E_INSTALL'
  | 'E_PREVIEW'
  | 'E_RUNTIME'
  | 'E_SHELL'
  | 'E_CLONE'
  | 'E_CONFIG';

export interface CodeLabErrorOptions {
  cause?: unknown;
  recoverable?: boolean;
  details?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Structured error surfaced through `wb.on('error', ...)` and `wb.on('save-state', ...)`.
 */
export class CodeLabError extends Error {
  readonly code: CodeLabErrorCode;
  readonly options: CodeLabErrorOptions;
  override readonly cause?: unknown;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;
  readonly context?: Record<string, unknown>;

  constructor(code: CodeLabErrorCode, message: string, options: CodeLabErrorOptions = {}) {
    super(message);
    this.name = 'CodeLabError';
    this.code = code;
    this.options = options;
    this.cause = options.cause;
    this.recoverable = options.recoverable !== false;
    const meta = options.details ?? options.context;
    if (meta !== undefined) {
      this.details = meta;
      this.context = meta;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isCodeLabError(value: unknown): value is CodeLabError {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value instanceof CodeLabError ||
      ((value as { name?: unknown }).name === 'CodeLabError' &&
        typeof (value as { code?: unknown }).code === 'string'))
  );
}

/**
 * Small leveled logger. Hosts can pass `options.logger` to route diagnostics
 * into their own telemetry; `options.debug` enables verbose output. Errors and
 * warnings are never silently discarded.
 */
export function createLogger(options: CodeLabLoggerOptions = {}): CodeLabLogger {
  const sink = options.logger ?? null;
  const debugEnabled = options.debug === true;
  const prefix = options.prefix || LOG_PREFIX;

  const write = (level: CodeLabLogLevel, args: unknown[]): void => {
    if (level === 'debug' && !debugEnabled) return;
    if (sink && typeof sink[level] === 'function') {
      let sinkError: unknown = null;
      try {
        (sink[level] as (...a: unknown[]) => void)(...args);
        return;
      } catch (err) {
        // A broken host logger must not break the IDE; fall through to console.
        sinkError = err;
      }
      void sinkError;
    }
    const consoleObj = typeof console !== 'undefined' ? console : null;
    const fn = consoleObj ? consoleObj[level] : null;
    if (typeof fn === 'function') {
      fn.call(consoleObj, prefix, ...args);
    }
  };

  return {
    debug: (...args: unknown[]) => write('debug', args),
    info: (...args: unknown[]) => write('info', args),
    warn: (...args: unknown[]) => write('warn', args),
    error: (...args: unknown[]) => write('error', args)
  };
}

export const DEFAULT_LOGGER: CodeLabLogger = createLogger();

const _loggerNamespace = {
  LOG_PREFIX,
  CodeLabError,
  isCodeLabError,
  createLogger,
  DEFAULT_LOGGER
};

const _globalRoot = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : null;
if (_globalRoot && !_globalRoot.CodeLabLogger) {
  _globalRoot.CodeLabLogger = _loggerNamespace;
}

export default _loggerNamespace;
