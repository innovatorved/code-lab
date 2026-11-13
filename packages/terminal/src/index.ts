import {
  CodeLabError,
  createServiceId,
  Emitter,
  type Event,
  type IDisposable
} from '@code-lab/core';

export interface AnsiSegment {
  readonly text: string;
  readonly fg?: string;
  readonly bold?: boolean;
}

const SGR_COLORS: Readonly<Record<number, string>> = {
  30: '#525252',
  31: '#ef4444',
  32: '#22c55e',
  33: '#eab308',
  34: '#3b82f6',
  35: '#a855f7',
  36: '#06b6d4',
  37: '#e5e5e5',
  90: '#737373',
  91: '#f87171',
  92: '#4ade80',
  93: '#facc15',
  94: '#60a5fa',
  95: '#c084fc',
  96: '#22d3ee',
  97: '#ffffff'
};

export function parseAnsiSegments(input: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  // eslint-disable-next-line no-control-regex
  const sgrRegex = /\x1b\[([0-9;]*)m/g;
  let lastIdx = 0;
  let fg: string | undefined;
  let bold = false;
  let match: RegExpExecArray | null;

  while ((match = sgrRegex.exec(input)) !== null) {
    if (match.index > lastIdx) {
      segments.push({
        text: input.slice(lastIdx, match.index),
        ...(fg ? { fg } : {}),
        ...(bold ? { bold: true } : {})
      });
    }
    const codes = match[1] ? match[1].split(';').map((n) => Number(n)) : [0];
    for (const code of codes) {
      if (code === 0) {
        fg = undefined;
        bold = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 22) {
        bold = false;
      } else if (code === 39) {
        fg = undefined;
      } else if (SGR_COLORS[code]) {
        fg = SGR_COLORS[code];
      }
    }
    lastIdx = sgrRegex.lastIndex;
  }

  if (lastIdx < input.length) {
    segments.push({
      text: input.slice(lastIdx),
      ...(fg ? { fg } : {}),
      ...(bold ? { bold: true } : {})
    });
  }
  return segments;
}

export interface TerminalSession {
  readonly id: string;
  readonly title: string;
  readonly cwd: string;
  readonly lines: readonly string[];
  write(chunk: string): void;
  clear(): void;
}

export interface ITerminalService extends IDisposable {
  readonly activeSessionId: string | undefined;
  readonly onDidWrite: Event<{ sessionId: string; chunk: string }>;
  readonly onDidChangeSessions: Event<void>;
  createSession(options?: { title?: string; cwd?: string; maxScrollback?: number }): TerminalSession;
  getSessions(): TerminalSession[];
  setActiveSession(id: string): void;
  closeSession(id: string): void;
}

export const ITerminalServiceId = createServiceId<ITerminalService>('code-lab.terminal');

export class TerminalService implements ITerminalService {
  private readonly sessions = new Map<string, TerminalSession & { _setLines: (l: string[]) => void }>();
  private currentSessionId: string | undefined;
  private seq = 0;
  private readonly writeEmitter = new Emitter<{ sessionId: string; chunk: string }>({ name: 'terminal.write' });
  private readonly sessionsEmitter = new Emitter<void>({ name: 'terminal.sessions' });

  public get activeSessionId(): string | undefined {
    return this.currentSessionId;
  }

  public get onDidWrite(): Event<{ sessionId: string; chunk: string }> {
    return this.writeEmitter.event;
  }

  public get onDidChangeSessions(): Event<void> {
    return this.sessionsEmitter.event;
  }

  public createSession(
    options: { title?: string; cwd?: string; maxScrollback?: number } = {}
  ): TerminalSession {
    const id = `term-${++this.seq}`;
    const title = options.title ?? `zsh ${this.seq}`;
    const cwd = options.cwd ?? '/workspace';
    const maxScrollback = Math.max(50, options.maxScrollback ?? 1000);
    let buffer: string[] = [];

    const session: TerminalSession & { _setLines: (l: string[]) => void } = {
      id,
      title,
      cwd,
      get lines(): readonly string[] {
        return buffer;
      },
      write: (chunk: string): void => {
        const incoming = chunk.split('\n');
        buffer.push(...incoming);
        if (buffer.length > maxScrollback) {
          buffer = buffer.slice(buffer.length - maxScrollback);
        }
        this.writeEmitter.fire({ sessionId: id, chunk });
      },
      clear: (): void => {
        buffer = [];
      },
      _setLines: (l: string[]): void => {
        buffer = l;
      }
    };

    this.sessions.set(id, session);
    this.currentSessionId = id;
    this.sessionsEmitter.fire();
    return session;
  }

  public getSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  public setActiveSession(id: string): void {
    if (!this.sessions.has(id)) {
      throw new CodeLabError('ERR_INVALID_ARGUMENT', `Terminal session "${id}" does not exist`);
    }
    this.currentSessionId = id;
    this.sessionsEmitter.fire();
  }

  public closeSession(id: string): void {
    if (!this.sessions.delete(id)) return;
    if (this.currentSessionId === id) {
      this.currentSessionId = this.sessions.keys().next().value;
    }
    this.sessionsEmitter.fire();
  }

  public dispose(): void {
    this.sessions.clear();
    this.currentSessionId = undefined;
    this.writeEmitter.dispose();
    this.sessionsEmitter.dispose();
  }
}
