/**
 * @code-lab/core — Typed error hierarchy & central ring-buffered Logger.
 */

import { type Event, Emitter } from './events';

export type CodeLabErrorCode =
  | 'ERR_INVALID_ARGUMENT'
  | 'ERR_DISPOSED'
  | 'ERR_DI_MISSING'
  | 'ERR_DI_CYCLE'
  | 'ERR_FS_NOT_FOUND'
  | 'ERR_FS_EXISTS'
  | 'ERR_FS_IS_DIR'
  | 'ERR_FS_NOT_DIR'
  | 'ERR_FS_QUOTA'
  | 'ERR_CONFIG_PARSE'
  | 'ERR_CONFIG_SCHEMA'
  | 'ERR_COMMAND_NOT_FOUND'
  | 'ERR_RUNTIME_TIMEOUT'
  | 'ERR_RUNTIME_CRASH'
  | 'ERR_PLUGIN_INVALID'
  | 'ERR_SECURITY_POLICY';

export interface CodeLabErrorOptions {
  readonly cause?: unknown;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly recoverable?: boolean;
}

export class CodeLabError extends Error {
  public readonly code: CodeLabErrorCode;
  public readonly context: Readonly<Record<string, unknown>>;
  public readonly recoverable: boolean;

  public constructor(code: CodeLabErrorCode, message: string, options: CodeLabErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'CodeLabError';
    this.code = code;
    this.context = Object.freeze({ ...(options.context ?? {}) });
    this.recoverable = options.recoverable ?? true;
  }
}

export function isCodeLabError(value: unknown): value is CodeLabError {
  return value instanceof CodeLabError || (
    typeof value === 'object' &&
    value !== null &&
    (value as { name?: unknown }).name === 'CodeLabError' &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

export interface LogEntry {
  readonly timestamp: number;
  readonly level: Exclude<LogLevel, 'silent'>;
  readonly scope: string;
  readonly message: string;
  readonly data?: unknown;
}

export interface ILogger {
  readonly scope: string;
  readonly onDidLog: Event<LogEntry>;
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(subScope: string): ILogger;
  getRecentEntries(): readonly LogEntry[];
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

export interface LoggerOptions {
  readonly scope?: string;
  readonly level?: LogLevel;
  readonly maxEntries?: number;
  readonly sink?: (entry: LogEntry) => void;
}

export class Logger implements ILogger {
  public readonly scope: string;
  private level: LogLevel;
  private readonly maxEntries: number;
  private readonly buffer: LogEntry[];
  private readonly emitter: Emitter<LogEntry>;
  private readonly sink?: (entry: LogEntry) => void;

  public constructor(
    options: LoggerOptions = {},
    sharedState?: {
      buffer: LogEntry[];
      emitter: Emitter<LogEntry>;
      getLevel: () => LogLevel;
      setLevel: (l: LogLevel) => void;
      maxEntries: number;
      sink?: (entry: LogEntry) => void;
    }
  ) {
    this.scope = options.scope ?? 'codelab';
    this.level = options.level ?? 'warn';
    this.maxEntries = sharedState ? sharedState.maxEntries : (options.maxEntries ?? 200);
    this.buffer = sharedState ? sharedState.buffer : [];
    this.emitter = sharedState ? sharedState.emitter : new Emitter<LogEntry>({ name: 'logger' });
    this.sink = sharedState ? sharedState.sink : options.sink;
    if (sharedState) {
      this.getLevel = sharedState.getLevel;
      this.setLevel = sharedState.setLevel;
    }
  }

  public get onDidLog(): Event<LogEntry> {
    return this.emitter.event;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public getRecentEntries(): readonly LogEntry[] {
    return this.buffer.slice();
  }

  public debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  public error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }

  public child(subScope: string): ILogger {
    return new Logger(
      { scope: `${this.scope}:${subScope}` },
      {
        buffer: this.buffer,
        emitter: this.emitter,
        getLevel: () => this.getLevel(),
        setLevel: (l) => this.setLevel(l),
        maxEntries: this.maxEntries,
        sink: this.sink
      }
    );
  }

  private write(level: Exclude<LogLevel, 'silent'>, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      scope: this.scope,
      message,
      ...(data !== undefined ? { data } : {})
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxEntries) {
      this.buffer.splice(0, this.buffer.length - this.maxEntries);
    }
    this.emitter.fire(entry);
    if (LEVEL_RANK[level] < LEVEL_RANK[this.getLevel()]) {
      return;
    }
    if (this.sink) {
      this.sink(entry);
      return;
    }
    const formatted = `[CodeLab][${this.scope}] ${message}`;
    if (level === 'error') {
      if (data !== undefined) console.error(formatted, data);
      else console.error(formatted);
    } else if (level === 'warn') {
      if (data !== undefined) console.warn(formatted, data);
      else console.warn(formatted);
    } else if (level === 'info') {
      if (data !== undefined) console.info(formatted, data);
      else console.info(formatted);
    } else if (data !== undefined) {
      console.debug(formatted, data);
    } else {
      console.debug(formatted);
    }
  }
}
