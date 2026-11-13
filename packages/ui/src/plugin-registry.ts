import {
  type CommandDescriptor,
  type ICommandRegistry,
  type IKeybindingService,
  type KeybindingRule
} from '@code-lab/commands';
import {
  CodeLabError,
  ContributionRegistry,
  createServiceId,
  DisposableStore,
  Emitter,
  type Event,
  type IDisposable,
  type ILogger
} from '@code-lab/core';
import type { IConfigurationService, SettingDescriptor } from '@code-lab/settings';
import type { IThemeService, ThemeDefinition } from './themes';

export interface PanelContribution {
  readonly id: string;
  readonly title: string;
  readonly location: 'drawer' | 'sidebar';
  readonly icon?: string;
  readonly render: (container: HTMLElement) => void | IDisposable;
}

export interface LanguageContribution {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly aliases?: readonly string[];
  readonly runFile?: (filePath: string, source: string) => Promise<{ ok: boolean; stdout: string; stderr: string }>;
}

export interface PluginContributions {
  readonly commands?: readonly CommandDescriptor[];
  readonly settings?: readonly SettingDescriptor[];
  readonly keybindings?: readonly KeybindingRule[];
  readonly themes?: readonly ThemeDefinition[];
  readonly panels?: readonly PanelContribution[];
  readonly languages?: readonly LanguageContribution[];
}

export interface PluginActivationContext {
  readonly subscriptions: DisposableStore;
  readonly commands: ICommandRegistry;
  readonly configuration: IConfigurationService;
  readonly keybindings: IKeybindingService;
  readonly themes: IThemeService;
  readonly logger: ILogger;
}

export interface CodeLabPluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly activationEvents?: readonly string[];
  readonly contributes?: PluginContributions;
  readonly activate?: (ctx: PluginActivationContext) => void | Promise<void> | IDisposable;
  readonly deactivate?: () => void | Promise<void>;
}

export interface RegisteredPluginInfo {
  readonly manifest: CodeLabPluginManifest;
  readonly active: boolean;
}

export interface IPluginRegistry extends IDisposable {
  readonly panels: ContributionRegistry<string, PanelContribution>;
  readonly languages: ContributionRegistry<string, LanguageContribution>;
  readonly onDidChangePlugins: Event<string>;
  registerPlugin(manifest: CodeLabPluginManifest): IDisposable;
  activatePlugin(id: string): Promise<void>;
  deactivatePlugin(id: string): Promise<void>;
  fireActivationEvent(eventName: string): Promise<void>;
  getPlugins(): RegisteredPluginInfo[];
  resolveLanguageForFile(filePath: string): LanguageContribution | undefined;
}

export const IPluginRegistryId = createServiceId<IPluginRegistry>('code-lab.plugins');

interface PluginRecord {
  manifest: CodeLabPluginManifest;
  active: boolean;
  manifestDisposables: DisposableStore;
  runtimeDisposables: DisposableStore;
}

export class PluginRegistry implements IPluginRegistry {
  public readonly panels = new ContributionRegistry<string, PanelContribution>('panels');
  public readonly languages = new ContributionRegistry<string, LanguageContribution>('languages');
  private readonly records = new Map<string, PluginRecord>();
  private readonly changeEmitter = new Emitter<string>({ name: 'plugins.change' });
  private readonly commands: ICommandRegistry;
  private readonly configuration: IConfigurationService;
  private readonly keybindings: IKeybindingService;
  private readonly themes: IThemeService;
  private readonly logger: ILogger;

  public constructor(deps: {
    commands: ICommandRegistry;
    configuration: IConfigurationService;
    keybindings: IKeybindingService;
    themes: IThemeService;
    logger: ILogger;
  }) {
    this.commands = deps.commands;
    this.configuration = deps.configuration;
    this.keybindings = deps.keybindings;
    this.themes = deps.themes;
    this.logger = deps.logger.child('plugins');
  }

  public get onDidChangePlugins(): Event<string> {
    return this.changeEmitter.event;
  }

  public registerPlugin(manifest: CodeLabPluginManifest): IDisposable {
    if (!manifest.id || !manifest.name) {
      throw new CodeLabError('ERR_PLUGIN_INVALID', 'Plugin manifest requires non-empty id and name');
    }
    if (this.records.has(manifest.id)) {
      void this.deactivatePlugin(manifest.id);
      this.records.get(manifest.id)?.manifestDisposables.dispose();
    }

    const manifestDisposables = new DisposableStore();
    const contributes = manifest.contributes;

    // Declarative contributions are registered immediately without running plugin code
    if (contributes?.settings) {
      for (const s of contributes.settings) {
        manifestDisposables.add(this.configuration.registerSetting(s));
      }
    }
    if (contributes?.themes) {
      for (const t of contributes.themes) {
        manifestDisposables.add(this.themes.registerTheme(t));
      }
    }
    if (contributes?.commands) {
      for (const cmd of contributes.commands) {
        manifestDisposables.add(
          this.commands.registerCommand({
            ...cmd,
            handler: async (...args: unknown[]) => {
              await this.activatePlugin(manifest.id);
              return cmd.handler(...args);
            }
          })
        );
      }
    }
    if (contributes?.keybindings) {
      for (const kb of contributes.keybindings) {
        manifestDisposables.add(this.keybindings.registerKeybinding({ ...kb, source: 'plugin' }));
      }
    }
    if (contributes?.panels) {
      for (const panel of contributes.panels) {
        manifestDisposables.add(this.panels.register(panel.id, panel));
      }
    }
    if (contributes?.languages) {
      for (const lang of contributes.languages) {
        manifestDisposables.add(this.languages.register(lang.id, lang));
      }
    }

    const record: PluginRecord = {
      manifest,
      active: false,
      manifestDisposables,
      runtimeDisposables: new DisposableStore()
    };
    this.records.set(manifest.id, record);
    this.changeEmitter.fire(manifest.id);

    const events = manifest.activationEvents ?? ['*'];
    if (events.includes('*') || events.includes('onStartupFinished')) {
      void this.activatePlugin(manifest.id);
    }

    return {
      dispose: (): void => {
        void this.deactivatePlugin(manifest.id);
        record.manifestDisposables.dispose();
        this.records.delete(manifest.id);
        this.changeEmitter.fire(manifest.id);
      }
    };
  }

  public async activatePlugin(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record || record.active) return;
    record.active = true;
    record.runtimeDisposables = new DisposableStore();
    if (record.manifest.activate) {
      try {
        const ret = await record.manifest.activate({
          subscriptions: record.runtimeDisposables,
          commands: this.commands,
          configuration: this.configuration,
          keybindings: this.keybindings,
          themes: this.themes,
          logger: this.logger.child(id)
        });
        if (ret && typeof ret.dispose === 'function') {
          record.runtimeDisposables.add(ret);
        }
      } catch (err) {
        record.active = false;
        this.logger.error(`Plugin "${id}" failed to activate`, err);
        throw err;
      }
    }
    this.changeEmitter.fire(id);
  }

  public async deactivatePlugin(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record || !record.active) return;
    record.active = false;
    try {
      await record.manifest.deactivate?.();
    } catch (err) {
      this.logger.warn(`Plugin "${id}" threw during deactivate`, err);
    }
    record.runtimeDisposables.dispose();
    this.changeEmitter.fire(id);
  }

  public async fireActivationEvent(eventName: string): Promise<void> {
    for (const [id, rec] of this.records.entries()) {
      if (rec.active) continue;
      const events = rec.manifest.activationEvents ?? [];
      if (events.includes(eventName) || events.includes('*')) {
        await this.activatePlugin(id);
      }
    }
  }

  public getPlugins(): RegisteredPluginInfo[] {
    return Array.from(this.records.values()).map((r) => ({
      manifest: r.manifest,
      active: r.active
    }));
  }

  public resolveLanguageForFile(filePath: string): LanguageContribution | undefined {
    const dotIdx = filePath.lastIndexOf('.');
    const ext = dotIdx !== -1 ? filePath.slice(dotIdx).toLowerCase() : '';
    if (!ext) return undefined;
    for (const lang of this.languages.values()) {
      if (lang.extensions.some((e) => e.toLowerCase() === ext)) {
        return lang;
      }
    }
    return undefined;
  }

  public dispose(): void {
    for (const rec of this.records.values()) {
      rec.runtimeDisposables.dispose();
      rec.manifestDisposables.dispose();
    }
    this.records.clear();
    this.panels.dispose();
    this.languages.dispose();
    this.changeEmitter.dispose();
  }
}
