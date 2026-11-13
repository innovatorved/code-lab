# Authoring `@innovatorved/code-lab` Plugins

Code-Lab features a VS Code-inspired declarative contribution & lazy activation plugin system (`PluginRegistry` in `@code-lab/ui`, surfaced directly on `CodeLab.use(manifest)`, `workbench.registerPlugin(manifest)`, and `CodeLabOptions.plugins`).

---

## 1. Design Principles

1. **Zero-Cost Declarative Contributions**: Settings, themes, commands, keybindings, drawer panels, and file-extension mappings in `contributes` are registered *immediately* without executing your plugin's `activate()` hook.
2. **Lazy Event-Driven Activation**: Your `activate(ctx)` callback only runs when one of its `activationEvents` fires (e.g., `onLanguage:sql`, `onCommand:myPlugin.format`, `onStartupFinished`, or `*`).
3. **Guaranteed Disposable Teardown**: Every registration returns an `IDisposable`, and `ctx.subscriptions` (`DisposableStore`) automatically cleans up listeners, commands, themes, and panels when the plugin is deactivated or the workbench is destroyed.

---

## 2. Plugin Manifest Reference (`CodeLabPluginManifest`)

```ts
export interface CodeLabPluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  /**
   * Lazy activation triggers:
   * - '*' or 'onStartupFinished' (eager after shell boot)
   * - 'onLanguage:<langId>' (e.g. 'onLanguage:sql', 'onLanguage:python')
   * - 'onCommand:<commandId>'
   */
  readonly activationEvents?: readonly string[];
  readonly contributes?: {
    readonly commands?: readonly CommandDescriptor[];
    readonly settings?: readonly SettingDescriptor[];
    readonly keybindings?: readonly KeybindingRule[];
    readonly themes?: readonly ThemeDefinition[];
    readonly panels?: readonly PanelContribution[];
    readonly languages?: readonly LanguageContribution[];
  };
  readonly activate?: (ctx: PluginActivationContext) => void | Promise<void> | IDisposable;
  readonly deactivate?: () => void | Promise<void>;
}
```

### Contribution Points
| Point | Description |
| --- | --- |
| `contributes.settings` | Registers typed settings (`boolean`, `number`, `string`, enum) that automatically appear in the `<dialog>` Settings UI (`Cmd+,`) and validate `.codelab/settings.json`. |
| `contributes.commands` | Adds commands to the Command Palette (`Cmd+K` / `Cmd+Shift+P`). Invoking a contributed command automatically activates the owning plugin first. |
| `contributes.keybindings` | Binds keyboard chords (`Mod+Shift+L`) gated by `when` context expressions (`editorFocus && resourceLangId == 'sql'`). |
| `contributes.themes` | Registers custom Dark, Light, or High-Contrast CSS-token themes selectable via `workbench.theme`. |
| `contributes.panels` | Adds custom tabs to the bottom drawer (`location: 'drawer'`) or sidebar (`location: 'sidebar'`). |
| `contributes.languages` | Associates file extensions (`.prql`, `.graphql`) with language IDs and optional custom `runFile(path, source)` executors. |

---

## 3. Complete Working Example: Query Cost & Explain Advisor Plugin

```ts
import type { CodeLabPluginManifest } from '@innovatorved/code-lab';

export const queryAdvisorPlugin: CodeLabPluginManifest = {
  id: 'acme.query-advisor',
  name: 'SQL Query Cost Advisor',
  version: '1.0.0',
  description: 'Flags SELECT * and missing LIMIT clauses in SQL sandboxes.',
  activationEvents: ['onLanguage:sql', 'onCommand:queryAdvisor.check'],

  contributes: {
    settings: [
      {
        key: 'queryAdvisor.maxLimit',
        title: 'Default Row Limit Warning Threshold',
        description: 'Warn when a SELECT query omits LIMIT above this threshold.',
        category: 'SQL',
        schema: { type: 'number', default: 500, minimum: 10, maximum: 10000 }
      }
    ],
    commands: [
      {
        id: 'queryAdvisor.check',
        title: 'Run SQL Cost Check',
        category: 'SQL Advisor',
        handler: () => {
          console.info('[QueryAdvisor] Running static query check...');
        }
      }
    ],
    keybindings: [
      {
        key: 'Mod+Shift+A',
        command: 'queryAdvisor.check',
        when: 'editorFocus'
      }
    ],
    panels: [
      {
        id: 'query-advisor',
        title: 'Advisor',
        location: 'drawer',
        render(container) {
          container.innerHTML = `
            <div style="padding: 12px; font-size: 13px;">
              <strong>SQL Query Advisor Ready</strong>
              <p>Press <kbd>Cmd/Ctrl+Shift+A</kbd> to audit your active query.</p>
            </div>
          `;
          return {
            dispose() {
              container.innerHTML = '';
            }
          };
        }
      }
    ]
  },

  activate(ctx) {
    ctx.logger.info('SQL Query Cost Advisor activated', {
      maxLimit: ctx.configuration.get<number>('queryAdvisor.maxLimit')
    });

    ctx.subscriptions.add(
      ctx.configuration.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('queryAdvisor.maxLimit')) {
          ctx.logger.info('Updated maxLimit', {
            maxLimit: ctx.configuration.get<number>('queryAdvisor.maxLimit')
          });
        }
      })
    );
  },

  deactivate() {
    // Any external cleanup; ctx.subscriptions is disposed automatically.
  }
};
```

---

## 4. Registering Plugins

### Option A — Per Workbench Instance (`CodeLab.mount`)
```js
const ide = CodeLab.mount('#ide', {
  lang: 'sql',
  code: 'SELECT id, total_cents FROM orders LIMIT 25;',
  plugins: [queryAdvisorPlugin]
});

// Or dynamically at runtime (returns an IDisposable):
const pluginHandle = ide.registerPlugin(queryAdvisorPlugin);
// Later, to unload cleanly:
pluginHandle.dispose();
```

### Option B — Global SDK Registration (`CodeLab.use`)
```js
CodeLab.use(queryAdvisorPlugin);
```

### Option C — Workspace Recommendations (`.codelab/extensions.json`)
Include `.codelab/extensions.json` in your `files` map to auto-activate registered workspace plugins:
```jsonc
{
  // Automatically activated when this workspace loads
  "recommendations": ["acme.query-advisor"],
  "unwantedRecommendations": []
}
```
