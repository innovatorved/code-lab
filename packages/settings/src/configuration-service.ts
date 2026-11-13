import {
  createServiceId,
  Emitter,
  type Event,
  type IDisposable,
  toDisposable
} from '@code-lab/core';
import {
  BUILTIN_SETTINGS,
  buildSettingsJsonSchema,
  EXTENSIONS_JSON_SCHEMA,
  TASKS_JSON_SCHEMA,
  type SettingDescriptor
} from './builtin-schemas';
import { parseJsonc } from './jsonc';
import { type JsonSchema, validateJsonSchema } from './schema';

export type ConfigurationTarget = 'default' | 'user' | 'workspace' | 'override';

export interface SettingDiagnostic {
  readonly file: string;
  readonly key?: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly severity: 'error' | 'warning';
}

export interface ConfigurationChangeEvent {
  readonly affectedKeys: ReadonlySet<string>;
  readonly source: ConfigurationTarget;
  readonly affectsConfiguration: (prefixOrKey: string) => boolean;
}

export interface SettingInspection<T = unknown> {
  readonly key: string;
  readonly defaultValue: T | undefined;
  readonly userValue: T | undefined;
  readonly workspaceValue: T | undefined;
  readonly overrideValue: T | undefined;
  readonly effectiveValue: T | undefined;
  readonly effectiveSource: ConfigurationTarget;
}

export interface WorkspaceTaskDefinition {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly group?: 'run' | 'build' | 'test' | 'dev';
  readonly runOn?: 'manual' | 'folderOpen';
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface WorkspaceExtensionsConfig {
  readonly recommendations: readonly string[];
  readonly autoActivate: readonly string[];
}

export interface IConfigurationService extends IDisposable {
  readonly onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
  readonly onDidChangeDiagnostics: Event<readonly SettingDiagnostic[]>;
  registerSetting(descriptor: SettingDescriptor): IDisposable;
  getDescriptors(): SettingDescriptor[];
  getJsonSchema(): JsonSchema;
  get<T = unknown>(key: string, fallback?: T): T;
  inspect<T = unknown>(key: string): SettingInspection<T>;
  getDiagnostics(): readonly SettingDiagnostic[];
  setUserSetting(key: string, value: unknown): boolean;
  resetSetting(key: string): void;
  setWorkspaceSetting(key: string, value: unknown): boolean;
  loadWorkspaceSettingsJson(rawJsonc: string, filePath?: string): readonly SettingDiagnostic[];
  setOverrides(overrides: Readonly<Record<string, unknown>>): void;
  toWorkspaceJsonString(): string;
  exportProfile(): string;
  importProfile(rawJsonc: string): readonly SettingDiagnostic[];
  toUrlParam(): string;
  applyUrlParam(encoded: string): readonly SettingDiagnostic[];
}

export const IConfigurationServiceId = createServiceId<IConfigurationService>('code-lab.configuration');

function findKeyLine(raw: string, key: string): number {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`"${escaped}"\\s*:`).exec(raw);
  if (!match) return 1;
  return raw.slice(0, match.index).split('\n').length;
}

export class ConfigurationService implements IConfigurationService {
  private readonly descriptors = new Map<string, SettingDescriptor>();
  private readonly userValues = new Map<string, unknown>();
  private readonly workspaceValues = new Map<string, unknown>();
  private readonly overrideValues = new Map<string, unknown>();
  private diagnostics: SettingDiagnostic[] = [];
  private readonly changeEmitter = new Emitter<ConfigurationChangeEvent>({ name: 'config.change' });
  private readonly diagEmitter = new Emitter<readonly SettingDiagnostic[]>({ name: 'config.diagnostics' });

  public constructor(includeBuiltins = true) {
    if (includeBuiltins) {
      for (const d of BUILTIN_SETTINGS) {
        this.descriptors.set(d.key, d);
      }
    }
  }

  public get onDidChangeConfiguration(): Event<ConfigurationChangeEvent> {
    return this.changeEmitter.event;
  }

  public get onDidChangeDiagnostics(): Event<readonly SettingDiagnostic[]> {
    return this.diagEmitter.event;
  }

  public registerSetting(descriptor: SettingDescriptor): IDisposable {
    this.descriptors.set(descriptor.key, descriptor);
    this.fireChange([descriptor.key], 'default');
    return toDisposable(() => {
      if (this.descriptors.get(descriptor.key) === descriptor) {
        this.descriptors.delete(descriptor.key);
        this.fireChange([descriptor.key], 'default');
      }
    });
  }

  public getDescriptors(): SettingDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  public getJsonSchema(): JsonSchema {
    return buildSettingsJsonSchema(this.getDescriptors());
  }

  public getDiagnostics(): readonly SettingDiagnostic[] {
    return this.diagnostics;
  }

  public inspect<T = unknown>(key: string): SettingInspection<T> {
    const defaultValue = this.descriptors.get(key)?.defaultValue as T | undefined;
    const userValue = this.userValues.get(key) as T | undefined;
    const workspaceValue = this.workspaceValues.get(key) as T | undefined;
    const overrideValue = this.overrideValues.get(key) as T | undefined;

    if (overrideValue !== undefined) {
      return {
        key,
        defaultValue,
        userValue,
        workspaceValue,
        overrideValue,
        effectiveValue: overrideValue,
        effectiveSource: 'override'
      };
    }
    if (workspaceValue !== undefined) {
      return {
        key,
        defaultValue,
        userValue,
        workspaceValue,
        overrideValue,
        effectiveValue: workspaceValue,
        effectiveSource: 'workspace'
      };
    }
    if (userValue !== undefined) {
      return {
        key,
        defaultValue,
        userValue,
        workspaceValue,
        overrideValue,
        effectiveValue: userValue,
        effectiveSource: 'user'
      };
    }
    return {
      key,
      defaultValue,
      userValue,
      workspaceValue,
      overrideValue,
      effectiveValue: defaultValue,
      effectiveSource: 'default'
    };
  }

  public get<T = unknown>(key: string, fallback?: T): T {
    const inspected = this.inspect<T>(key);
    if (inspected.effectiveValue !== undefined) {
      return inspected.effectiveValue;
    }
    return fallback as T;
  }

  private validateKeyValue(key: string, value: unknown): string | null {
    const desc = this.descriptors.get(key);
    if (!desc) return null; // allow plugin keys not yet registered
    const issues = validateJsonSchema(value, desc.schema, key);
    return issues.length > 0 ? issues[0].message : null;
  }

  public setUserSetting(key: string, value: unknown): boolean {
    const err = this.validateKeyValue(key, value);
    if (err) return false;
    this.userValues.set(key, value);
    this.fireChange([key], 'user');
    return true;
  }

  public setWorkspaceSetting(key: string, value: unknown): boolean {
    const err = this.validateKeyValue(key, value);
    if (err) return false;
    this.workspaceValues.set(key, value);
    this.fireChange([key], 'workspace');
    return true;
  }

  public resetSetting(key: string): void {
    const hadUser = this.userValues.delete(key);
    const hadWs = this.workspaceValues.delete(key);
    const hadOv = this.overrideValues.delete(key);
    if (hadUser || hadWs || hadOv) {
      this.fireChange([key], 'user');
    }
  }

  public loadWorkspaceSettingsJson(
    rawJsonc: string,
    filePath = '.codelab/settings.json'
  ): readonly SettingDiagnostic[] {
    const nextDiags: SettingDiagnostic[] = [];
    const affected = new Set<string>(this.workspaceValues.keys());

    if (!rawJsonc || !rawJsonc.trim()) {
      this.workspaceValues.clear();
      this.updateDiagnostics([]);
      if (affected.size > 0) this.fireChange(affected, 'workspace');
      return [];
    }

    const parsed = parseJsonc<Record<string, unknown>>(rawJsonc);
    for (const pe of parsed.errors) {
      nextDiags.push({
        file: filePath,
        message: `Invalid settings JSONC: ${pe.message}`,
        line: pe.line,
        column: pe.column,
        severity: 'error'
      });
    }

    if (parsed.value === undefined || typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
      if (parsed.errors.length === 0) {
        nextDiags.push({
          file: filePath,
          message: 'Settings root must be a JSON object',
          line: 1,
          column: 1,
          severity: 'error'
        });
      }
      // Keep safe defaults by clearing invalid workspace overrides
      this.workspaceValues.clear();
      this.updateDiagnostics(nextDiags);
      if (affected.size > 0) this.fireChange(affected, 'workspace');
      return nextDiags;
    }

    this.workspaceValues.clear();
    for (const [key, val] of Object.entries(parsed.value)) {
      affected.add(key);
      const schemaError = this.validateKeyValue(key, val);
      if (schemaError) {
        const fallback = this.userValues.has(key)
          ? this.userValues.get(key)
          : this.descriptors.get(key)?.defaultValue;
        nextDiags.push({
          file: filePath,
          key,
          message: `Invalid "${key}": ${schemaError}. Falling back to ${JSON.stringify(fallback)}.`,
          line: findKeyLine(rawJsonc, key),
          column: 3,
          severity: 'warning'
        });
      } else {
        this.workspaceValues.set(key, val);
      }
    }

    this.updateDiagnostics(nextDiags);
    if (affected.size > 0) {
      this.fireChange(affected, 'workspace');
    }
    return nextDiags;
  }

  public setOverrides(overrides: Readonly<Record<string, unknown>>): void {
    const affected = new Set<string>(this.overrideValues.keys());
    this.overrideValues.clear();
    for (const [key, val] of Object.entries(overrides)) {
      if (this.validateKeyValue(key, val) === null) {
        this.overrideValues.set(key, val);
        affected.add(key);
      }
    }
    if (affected.size > 0) {
      this.fireChange(affected, 'override');
    }
  }

  public toWorkspaceJsonString(): string {
    const out: Record<string, unknown> = {};
    const keys = Array.from(this.workspaceValues.keys()).sort();
    for (const k of keys) {
      out[k] = this.workspaceValues.get(k);
    }
    return JSON.stringify(out, null, 2) + '\n';
  }

  public exportProfile(): string {
    const userObj: Record<string, unknown> = {};
    for (const [k, v] of this.userValues.entries()) userObj[k] = v;
    const wsObj: Record<string, unknown> = {};
    for (const [k, v] of this.workspaceValues.entries()) wsObj[k] = v;
    return JSON.stringify(
      {
        version: 1,
        user: userObj,
        workspace: wsObj
      },
      null,
      2
    );
  }

  public importProfile(rawJsonc: string): readonly SettingDiagnostic[] {
    const parsed = parseJsonc<{ user?: Record<string, unknown>; workspace?: Record<string, unknown> }>(rawJsonc);
    if (!parsed.value || typeof parsed.value !== 'object') {
      return [
        {
          file: 'settings-profile.json',
          message: parsed.errors[0]?.message ?? 'Invalid settings profile JSON',
          line: 1,
          column: 1,
          severity: 'error'
        }
      ];
    }
    const diags: SettingDiagnostic[] = [];
    const affected = new Set<string>();
    const userIn = parsed.value.user ?? (
      !('workspace' in parsed.value) ? (parsed.value as unknown as Record<string, unknown>) : undefined
    );
    if (userIn && typeof userIn === 'object') {
      for (const [k, v] of Object.entries(userIn)) {
        const err = this.validateKeyValue(k, v);
        if (err) {
          diags.push({
            file: 'settings-profile.json',
            key: k,
            message: `Invalid "${k}": ${err}`,
            line: 1,
            column: 1,
            severity: 'warning'
          });
        } else {
          this.userValues.set(k, v);
          affected.add(k);
        }
      }
    }
    if (parsed.value.workspace && typeof parsed.value.workspace === 'object') {
      for (const [k, v] of Object.entries(parsed.value.workspace)) {
        const err = this.validateKeyValue(k, v);
        if (!err) {
          this.workspaceValues.set(k, v);
          affected.add(k);
        }
      }
    }
    if (affected.size > 0) this.fireChange(affected, 'user');
    return diags;
  }

  public toUrlParam(): string {
    const effectiveDiff: Record<string, unknown> = {};
    for (const desc of this.descriptors.values()) {
      const val = this.get(desc.key);
      if (JSON.stringify(val) !== JSON.stringify(desc.defaultValue)) {
        effectiveDiff[desc.key] = val;
      }
    }
    const json = JSON.stringify(effectiveDiff);
    if (typeof btoa === 'function') {
      return btoa(encodeURIComponent(json));
    }
    return encodeURIComponent(json);
  }

  public applyUrlParam(encoded: string): readonly SettingDiagnostic[] {
    if (!encoded) return [];
    let json = '';
    try {
      json = typeof atob === 'function' ? decodeURIComponent(atob(encoded)) : decodeURIComponent(encoded);
    } catch {
      try {
        json = decodeURIComponent(encoded);
      } catch {
        return [{ file: 'url', message: 'Invalid encoded URL settings', line: 1, column: 1, severity: 'warning' }];
      }
    }
    const parsed = parseJsonc<Record<string, unknown>>(json);
    if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
      return [{ file: 'url', message: 'URL settings must decode to an object', line: 1, column: 1, severity: 'warning' }];
    }
    this.setOverrides(parsed.value);
    return [];
  }

  private updateDiagnostics(next: SettingDiagnostic[]): void {
    this.diagnostics = next;
    this.diagEmitter.fire(this.diagnostics);
  }

  private fireChange(keys: Iterable<string>, source: ConfigurationTarget): void {
    const affectedKeys = new Set<string>(keys);
    this.changeEmitter.fire({
      affectedKeys,
      source,
      affectsConfiguration: (prefixOrKey: string) => {
        if (affectedKeys.has(prefixOrKey)) return true;
        const prefix = prefixOrKey.endsWith('.') ? prefixOrKey : `${prefixOrKey}.`;
        for (const k of affectedKeys) {
          if (k.startsWith(prefix)) return true;
        }
        return false;
      }
    });
  }

  public dispose(): void {
    this.descriptors.clear();
    this.userValues.clear();
    this.workspaceValues.clear();
    this.overrideValues.clear();
    this.changeEmitter.dispose();
    this.diagEmitter.dispose();
  }
}

export function parseTasksConfig(
  rawJsonc: string,
  filePath = '.codelab/tasks.json'
): { tasks: WorkspaceTaskDefinition[]; diagnostics: SettingDiagnostic[] } {
  const diagnostics: SettingDiagnostic[] = [];
  if (!rawJsonc || !rawJsonc.trim()) return { tasks: [], diagnostics };
  const parsed = parseJsonc<{ version?: string; tasks?: unknown[] }>(rawJsonc);
  for (const err of parsed.errors) {
    diagnostics.push({
      file: filePath,
      message: `Invalid tasks.json: ${err.message}`,
      line: err.line,
      column: err.column,
      severity: 'error'
    });
  }
  if (!parsed.value) return { tasks: [], diagnostics };
  const schemaIssues = validateJsonSchema(parsed.value, TASKS_JSON_SCHEMA, 'tasks');
  for (const issue of schemaIssues) {
    diagnostics.push({
      file: filePath,
      message: `${issue.path}: ${issue.message}`,
      line: 1,
      column: 1,
      severity: 'warning'
    });
  }
  const rawTasks = Array.isArray(parsed.value.tasks) ? parsed.value.tasks : [];
  const tasks: WorkspaceTaskDefinition[] = [];
  for (let i = 0; i < rawTasks.length; i++) {
    const item = rawTasks[i];
    if (typeof item === 'object' && item !== null) {
      const rec = item as Record<string, unknown>;
      if (typeof rec.label === 'string' && typeof rec.command === 'string' && rec.command.trim()) {
        tasks.push({
          id: typeof rec.id === 'string' && rec.id ? rec.id : `task-${i + 1}`,
          label: rec.label,
          command: rec.command,
          group:
            rec.group === 'run' || rec.group === 'build' || rec.group === 'test' || rec.group === 'dev'
              ? rec.group
              : undefined,
          runOn: rec.runOn === 'folderOpen' ? 'folderOpen' : 'manual',
          cwd: typeof rec.cwd === 'string' ? rec.cwd : undefined,
          env:
            typeof rec.env === 'object' && rec.env !== null && !Array.isArray(rec.env)
              ? (rec.env as Record<string, string>)
              : undefined
        });
      }
    }
  }
  return { tasks, diagnostics };
}

export function parseExtensionsConfig(
  rawJsonc: string,
  filePath = '.codelab/extensions.json'
): { config: WorkspaceExtensionsConfig; diagnostics: SettingDiagnostic[] } {
  const diagnostics: SettingDiagnostic[] = [];
  const empty: WorkspaceExtensionsConfig = { recommendations: [], autoActivate: [] };
  if (!rawJsonc || !rawJsonc.trim()) return { config: empty, diagnostics };
  const parsed = parseJsonc<Record<string, unknown>>(rawJsonc);
  for (const err of parsed.errors) {
    diagnostics.push({
      file: filePath,
      message: `Invalid extensions.json: ${err.message}`,
      line: err.line,
      column: err.column,
      severity: 'error'
    });
  }
  if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    return { config: empty, diagnostics };
  }
  for (const issue of validateJsonSchema(parsed.value, EXTENSIONS_JSON_SCHEMA, 'extensions')) {
    diagnostics.push({
      file: filePath,
      message: `${issue.path}: ${issue.message}`,
      line: 1,
      column: 1,
      severity: 'warning'
    });
  }
  const recs = Array.isArray(parsed.value.recommendations)
    ? parsed.value.recommendations.filter((x): x is string => typeof x === 'string')
    : [];
  const auto = Array.isArray(parsed.value.autoActivate)
    ? parsed.value.autoActivate.filter((x): x is string => typeof x === 'string')
    : [];
  return { config: { recommendations: recs, autoActivate: auto }, diagnostics };
}
