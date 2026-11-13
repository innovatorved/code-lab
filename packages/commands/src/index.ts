import {
  CodeLabError,
  createServiceId,
  Emitter,
  type Event,
  type IDisposable,
  toDisposable
} from '@code-lab/core';

export type ContextValue = string | number | boolean | null | undefined;

export interface IContextKeyService extends IDisposable {
  readonly onDidChangeContext: Event<string>;
  setContext(key: string, value: ContextValue): void;
  getContext(key: string): ContextValue;
  deleteContext(key: string): void;
  evaluateWhen(expression: string | undefined): boolean;
}

export const IContextKeyServiceId = createServiceId<IContextKeyService>('code-lab.contextKeys');

interface WhenToken {
  type: 'ident' | 'str' | 'num' | 'op' | 'lparen' | 'rparen';
  value: string;
}

function tokenizeWhen(expr: string): WhenToken[] {
  const tokens: WhenToken[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '==' || two === '!=' || two === '=~') {
      const three = expr.slice(i, i + 3);
      if (three === '===' || three === '!==') {
        tokens.push({ type: 'op', value: three.slice(0, 2) });
        i += 3;
      } else {
        tokens.push({ type: 'op', value: two });
        i += 2;
      }
      continue;
    }
    if (ch === '!') {
      tokens.push({ type: 'op', value: '!' });
      i++;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      const quote = ch;
      let val = '';
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          val += expr[i + 1];
          i += 2;
        } else {
          val += expr[i];
          i++;
        }
      }
      if (i < expr.length) i++;
      tokens.push({ type: 'str', value: val });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'num', value: num });
      continue;
    }
    let ident = '';
    while (i < expr.length && !/[\s()!&|=]/.test(expr[i])) {
      ident += expr[i++];
    }
    if (ident) {
      tokens.push({ type: 'ident', value: ident });
    } else {
      i++;
    }
  }
  return tokens;
}

export class ContextKeyService implements IContextKeyService {
  private readonly store = new Map<string, ContextValue>();
  private readonly changeEmitter = new Emitter<string>({ name: 'context.change' });

  public get onDidChangeContext(): Event<string> {
    return this.changeEmitter.event;
  }

  public setContext(key: string, value: ContextValue): void {
    if (this.store.get(key) === value) return;
    this.store.set(key, value);
    this.changeEmitter.fire(key);
  }

  public getContext(key: string): ContextValue {
    return this.store.get(key);
  }

  public deleteContext(key: string): void {
    if (this.store.delete(key)) {
      this.changeEmitter.fire(key);
    }
  }

  public evaluateWhen(expression: string | undefined): boolean {
    if (!expression || !expression.trim()) return true;
    const trimmed = expression.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    const tokens = tokenizeWhen(trimmed);
    let pos = 0;

    const resolveScalar = (tok: WhenToken | undefined): ContextValue => {
      if (!tok) return undefined;
      if (tok.type === 'str') return tok.value;
      if (tok.type === 'num') return Number(tok.value);
      if (tok.value === 'true') return true;
      if (tok.value === 'false') return false;
      if (tok.value === 'null') return null;
      return this.store.get(tok.value);
    };

    const parseOr = (): boolean => {
      let left = parseAnd();
      while (pos < tokens.length && tokens[pos].type === 'op' && tokens[pos].value === '||') {
        pos++;
        const right = parseAnd();
        left = left || right;
      }
      return left;
    };

    const parseAnd = (): boolean => {
      let left = parseUnary();
      while (pos < tokens.length && tokens[pos].type === 'op' && tokens[pos].value === '&&') {
        pos++;
        const right = parseUnary();
        left = left && right;
      }
      return left;
    };

    const parseUnary = (): boolean => {
      if (pos < tokens.length && tokens[pos].type === 'op' && tokens[pos].value === '!') {
        pos++;
        return !parseUnary();
      }
      return parsePrimary();
    };

    const parsePrimary = (): boolean => {
      const tok = tokens[pos];
      if (!tok) return false;
      if (tok.type === 'lparen') {
        pos++;
        const val = parseOr();
        if (pos < tokens.length && tokens[pos].type === 'rparen') pos++;
        return val;
      }
      pos++;
      const next = tokens[pos];
      if (next && next.type === 'op' && (next.value === '==' || next.value === '!=' || next.value === '=~')) {
        pos++;
        const rhsTok = tokens[pos++];
        const lhsVal = resolveScalar(tok);
        if (next.value === '=~' && rhsTok) {
          const patternRaw = rhsTok.value.replace(/^\/|\/[gimsuy]*$/g, '');
          try {
            return new RegExp(patternRaw).test(String(lhsVal ?? ''));
          } catch {
            return false;
          }
        }
        const rhsVal = resolveScalar(rhsTok);
        const eq = String(lhsVal ?? '') === String(rhsVal ?? '');
        return next.value === '==' ? eq : !eq;
      }
      return Boolean(resolveScalar(tok));
    };

    return parseOr();
  }

  public dispose(): void {
    this.store.clear();
    this.changeEmitter.dispose();
  }
}

export type CommandHandler<Args extends unknown[] = unknown[], Result = unknown> = (
  ...args: Args
) => Result | Promise<Result>;

export interface CommandDescriptor {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
  readonly when?: string;
  readonly icon?: string;
  readonly handler: CommandHandler;
}

export interface CommandExecutionEvent {
  readonly id: string;
  readonly args: readonly unknown[];
}

export interface ICommandRegistry extends IDisposable {
  readonly onDidChangeCommands: Event<string>;
  readonly onDidExecuteCommand: Event<CommandExecutionEvent>;
  registerCommand(descriptor: CommandDescriptor): IDisposable;
  hasCommand(id: string): boolean;
  getCommand(id: string): CommandDescriptor | undefined;
  getCommands(contextKeys?: IContextKeyService): CommandDescriptor[];
  executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T>;
}

export const ICommandRegistryId = createServiceId<ICommandRegistry>('code-lab.commands');

export class CommandRegistry implements ICommandRegistry {
  private readonly commands = new Map<string, CommandDescriptor>();
  private readonly changeEmitter = new Emitter<string>({ name: 'commands.change' });
  private readonly execEmitter = new Emitter<CommandExecutionEvent>({ name: 'commands.exec' });

  public get onDidChangeCommands(): Event<string> {
    return this.changeEmitter.event;
  }

  public get onDidExecuteCommand(): Event<CommandExecutionEvent> {
    return this.execEmitter.event;
  }

  public registerCommand(descriptor: CommandDescriptor): IDisposable {
    if (!descriptor.id) {
      throw new CodeLabError('ERR_INVALID_ARGUMENT', 'Command id must be non-empty');
    }
    this.commands.set(descriptor.id, descriptor);
    this.changeEmitter.fire(descriptor.id);
    return toDisposable(() => {
      if (this.commands.get(descriptor.id) === descriptor) {
        this.commands.delete(descriptor.id);
        this.changeEmitter.fire(descriptor.id);
      }
    });
  }

  public hasCommand(id: string): boolean {
    return this.commands.has(id);
  }

  public getCommand(id: string): CommandDescriptor | undefined {
    return this.commands.get(id);
  }

  public getCommands(contextKeys?: IContextKeyService): CommandDescriptor[] {
    const all = Array.from(this.commands.values());
    if (!contextKeys) return all;
    return all.filter((cmd) => contextKeys.evaluateWhen(cmd.when));
  }

  public async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
    const cmd = this.commands.get(id);
    if (!cmd) {
      throw new CodeLabError('ERR_COMMAND_NOT_FOUND', `Command '${id}' is not registered`, {
        context: { id }
      });
    }
    this.execEmitter.fire({ id, args });
    return (await cmd.handler(...args)) as T;
  }

  public dispose(): void {
    this.commands.clear();
    this.changeEmitter.dispose();
    this.execEmitter.dispose();
  }
}

export interface KeybindingRule {
  readonly key: string;
  readonly command: string;
  readonly when?: string;
  readonly args?: unknown;
  readonly source?: 'default' | 'user' | 'plugin';
}

export interface KeyboardEventLike {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

export interface IKeybindingService extends IDisposable {
  readonly onDidChangeKeybindings: Event<void>;
  registerKeybinding(rule: KeybindingRule): IDisposable;
  setUserKeybindings(rules: readonly KeybindingRule[]): void;
  resolve(event: KeyboardEventLike): KeybindingRule | undefined;
  lookupKeybinding(commandId: string): string | undefined;
  getEffectiveRules(): KeybindingRule[];
}

export const IKeybindingServiceId = createServiceId<IKeybindingService>('code-lab.keybindings');

export function normalizeKeyChord(raw: string): string {
  const parts = raw
    .split('+')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  let mod = false;
  let alt = false;
  let shift = false;
  let key = '';
  for (const p of parts) {
    if (p === 'mod' || p === 'cmd' || p === 'meta' || p === 'ctrl' || p === 'control' || p === 'cmdorctrl') {
      mod = true;
    } else if (p === 'alt' || p === 'option' || p === 'opt') {
      alt = true;
    } else if (p === 'shift') {
      shift = true;
    } else if (p === 'esc') {
      key = 'escape';
    } else if (p === 'space') {
      key = ' ';
    } else {
      key = p;
    }
  }
  const mods: string[] = [];
  if (mod) mods.push('mod');
  if (alt) mods.push('alt');
  if (shift) mods.push('shift');
  mods.push(key);
  return mods.join('+');
}

export function eventToChord(event: KeyboardEventLike): string {
  const mod = Boolean(event.metaKey || event.ctrlKey);
  const alt = Boolean(event.altKey);
  const shift = Boolean(event.shiftKey);
  const rawKey = (event.key || '').toLowerCase();
  const key = rawKey === 'esc' ? 'escape' : rawKey;
  const mods: string[] = [];
  if (mod) mods.push('mod');
  if (alt) mods.push('alt');
  if (shift) mods.push('shift');
  mods.push(key);
  return mods.join('+');
}

export function formatShortcutBadge(rawKey: string, isMac = false): string {
  const norm = normalizeKeyChord(rawKey);
  const parts = norm.split('+');
  return parts
    .map((p) => {
      if (p === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (p === 'alt') return isMac ? '⌥' : 'Alt';
      if (p === 'shift') return isMac ? '⇧' : 'Shift';
      if (p === 'enter') return '↵';
      if (p === 'escape') return 'Esc';
      return p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1);
    })
    .join(isMac ? '' : '+');
}

export class KeybindingService implements IKeybindingService {
  private readonly baseRules: KeybindingRule[] = [];
  private userRules: KeybindingRule[] = [];
  private readonly contextKeys: IContextKeyService;
  private readonly changeEmitter = new Emitter<void>({ name: 'keybindings.change' });

  public constructor(contextKeys: IContextKeyService) {
    this.contextKeys = contextKeys;
  }

  public get onDidChangeKeybindings(): Event<void> {
    return this.changeEmitter.event;
  }

  public registerKeybinding(rule: KeybindingRule): IDisposable {
    const entry: KeybindingRule = { ...rule, source: rule.source ?? 'default' };
    this.baseRules.push(entry);
    this.changeEmitter.fire();
    return toDisposable(() => {
      const idx = this.baseRules.indexOf(entry);
      if (idx !== -1) {
        this.baseRules.splice(idx, 1);
        this.changeEmitter.fire();
      }
    });
  }

  public setUserKeybindings(rules: readonly KeybindingRule[]): void {
    this.userRules = rules.map((r) => ({ ...r, source: 'user' as const }));
    this.changeEmitter.fire();
  }

  public getEffectiveRules(): KeybindingRule[] {
    const disabled = new Set<string>();
    for (const r of this.userRules) {
      if (r.command.startsWith('-')) {
        disabled.add(`${normalizeKeyChord(r.key)}::${r.command.slice(1)}`);
      }
    }
    const merged: KeybindingRule[] = [];
    for (const r of this.baseRules) {
      const sig = `${normalizeKeyChord(r.key)}::${r.command}`;
      if (!disabled.has(sig)) merged.push(r);
    }
    for (const r of this.userRules) {
      if (!r.command.startsWith('-')) merged.push(r);
    }
    return merged;
  }

  public resolve(event: KeyboardEventLike): KeybindingRule | undefined {
    const chord = eventToChord(event);
    const rules = this.getEffectiveRules();
    // VS Code precedence: later rules override earlier rules when `when` matches
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i];
      if (normalizeKeyChord(rule.key) !== chord) continue;
      if (this.contextKeys.evaluateWhen(rule.when)) {
        return rule;
      }
    }
    return undefined;
  }

  public lookupKeybinding(commandId: string): string | undefined {
    const rules = this.getEffectiveRules();
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i].command === commandId) {
        return rules[i].key;
      }
    }
    return undefined;
  }

  public dispose(): void {
    this.baseRules.length = 0;
    this.userRules.length = 0;
    this.changeEmitter.dispose();
  }
}
