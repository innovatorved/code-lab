import {
  CommandRegistry,
  ContextKeyService,
  ICommandRegistryId,
  IContextKeyServiceId,
  IKeybindingServiceId,
  KeybindingService,
  type ICommandRegistry,
  type IContextKeyService,
  type IKeybindingService
} from '@code-lab/commands';
import {
  DisposableStore,
  Logger,
  ServiceContainer,
  setGlobalEventMonitor,
  type EventTraceRecord,
  type IDisposable,
  type ILogger
} from '@code-lab/core';
import { EditorService, IEditorServiceId, type IEditorService } from '@code-lab/editor';
import {
  FileSystemService,
  IFileSystemServiceId,
  IndexedDbBackend,
  MemoryBackend,
  OpfsBackend,
  type IFsBackend,
  type IFileSystemService
} from '@code-lab/fs';
import { IPreviewServiceId, PreviewService, type IPreviewService } from '@code-lab/preview';
import {
  IRuntimeServiceId,
  WorkerHostSupervisor,
  type IRuntimeService,
  type RuntimeExecutorDelegate
} from '@code-lab/runtime';
import {
  ConfigurationService,
  IConfigurationServiceId,
  type IConfigurationService
} from '@code-lab/settings';
import { ITerminalServiceId, TerminalService, type ITerminalService } from '@code-lab/terminal';
import {
  IPluginRegistryId,
  IThemeServiceId,
  PluginRegistry,
  ThemeService,
  type IPluginRegistry,
  type IThemeService
} from '@code-lab/ui';

export interface CodeLabKernelOptions {
  readonly instanceId?: string;
  readonly fsBackend?: 'memory' | 'indexeddb' | 'opfs' | IFsBackend;
  readonly initialFiles?: Readonly<Record<string, string>>;
  readonly runtimeDelegate?: RuntimeExecutorDelegate;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

export interface CodeLabKernel extends IDisposable {
  readonly instanceId: string;
  readonly container: ServiceContainer;
  readonly logger: ILogger;
  readonly fs: IFileSystemService;
  readonly configuration: IConfigurationService;
  readonly contextKeys: IContextKeyService;
  readonly commands: ICommandRegistry;
  readonly keybindings: IKeybindingService;
  readonly editor: IEditorService;
  readonly runtime: IRuntimeService;
  readonly terminal: ITerminalService;
  readonly preview: IPreviewService;
  readonly themes: IThemeService;
  readonly plugins: IPluginRegistry;
  getRecentEvents(): readonly EventTraceRecord[];
}

const defaultNoopRuntime: RuntimeExecutorDelegate = async () => ({
  ok: true,
  exitCode: 0,
  stdout: '',
  stderr: '',
  durationMs: 0
});

export function createCodeLabKernel(options: CodeLabKernelOptions = {}): CodeLabKernel {
  const instanceId = options.instanceId ?? `cl-${Math.random().toString(36).slice(2, 10)}`;
  const disposables = new DisposableStore();
  const container = new ServiceContainer();
  const logger = new Logger({ scope: instanceId, level: options.logLevel ?? 'warn' });

  const recentEvents: EventTraceRecord[] = [];
  disposables.add(
    setGlobalEventMonitor((rec) => {
      recentEvents.push(rec);
      if (recentEvents.length > 100) {
        recentEvents.splice(0, recentEvents.length - 100);
      }
    })
  );

  let backend: IFsBackend;
  if (typeof options.fsBackend === 'object' && options.fsBackend !== null) {
    backend = options.fsBackend;
  } else if (options.fsBackend === 'indexeddb') {
    backend = new IndexedDbBackend(instanceId);
  } else if (options.fsBackend === 'opfs') {
    backend = new OpfsBackend(instanceId);
  } else {
    backend = new MemoryBackend(options.initialFiles);
  }

  container.registerSingleton(IFileSystemServiceId, () => {
    const svc = new FileSystemService(backend);
    if (options.initialFiles) {
      svc.loadRecord(options.initialFiles, '/workspace');
    }
    return svc;
  });
  container.registerSingleton(IConfigurationServiceId, () => new ConfigurationService(true));
  container.registerSingleton(IContextKeyServiceId, () => new ContextKeyService());
  container.registerSingleton(ICommandRegistryId, () => new CommandRegistry());
  container.registerSingleton(
    IKeybindingServiceId,
    (c) => new KeybindingService(c.get(IContextKeyServiceId))
  );
  container.registerSingleton(IEditorServiceId, () => new EditorService());
  container.registerSingleton(
    IRuntimeServiceId,
    (c) => new WorkerHostSupervisor(c.get(IFileSystemServiceId), options.runtimeDelegate ?? defaultNoopRuntime)
  );
  container.registerSingleton(ITerminalServiceId, () => new TerminalService());
  container.registerSingleton(IPreviewServiceId, () => new PreviewService(instanceId));
  container.registerSingleton(IThemeServiceId, () => new ThemeService());
  container.registerSingleton(
    IPluginRegistryId,
    (c) =>
      new PluginRegistry({
        commands: c.get(ICommandRegistryId),
        configuration: c.get(IConfigurationServiceId),
        keybindings: c.get(IKeybindingServiceId),
        themes: c.get(IThemeServiceId),
        logger
      })
  );

  const fs = container.get(IFileSystemServiceId);
  const configuration = container.get(IConfigurationServiceId);
  const contextKeys = container.get(IContextKeyServiceId);
  const commands = container.get(ICommandRegistryId);
  const keybindings = container.get(IKeybindingServiceId);
  const editor = container.get(IEditorServiceId);
  const runtime = container.get(IRuntimeServiceId);
  const terminal = container.get(ITerminalServiceId);
  const preview = container.get(IPreviewServiceId);
  const themes = container.get(IThemeServiceId);
  const plugins = container.get(IPluginRegistryId);

  // Sync theme changes automatically when `workbench.colorTheme` changes
  disposables.add(
    configuration.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('workbench.colorTheme')) {
        themes.setTheme(configuration.get<string>('workbench.colorTheme', 'dark'));
      }
      if (e.affectsConfiguration('editor')) {
        editor.syncFromConfiguration(configuration);
      }
    })
  );

  return {
    instanceId,
    container,
    logger,
    fs,
    configuration,
    contextKeys,
    commands,
    keybindings,
    editor,
    runtime,
    terminal,
    preview,
    themes,
    plugins,
    getRecentEvents(): readonly EventTraceRecord[] {
      return recentEvents.slice();
    },
    dispose(): void {
      disposables.dispose();
      container.dispose();
    }
  };
}
