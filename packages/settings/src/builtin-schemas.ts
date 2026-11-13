import type { JsonSchema } from './schema';

export type SettingCategory =
  | 'Editor'
  | 'Workbench'
  | 'Files'
  | 'Terminal'
  | 'Preview'
  | 'Runtime'
  | 'SQL';

export interface SettingDescriptor<T = unknown> {
  readonly key: string;
  readonly category: SettingCategory;
  readonly title: string;
  readonly description: string;
  readonly defaultValue: T;
  readonly schema: JsonSchema;
}

export const BUILTIN_SETTINGS: readonly SettingDescriptor[] = [
  {
    key: 'editor.fontSize',
    category: 'Editor',
    title: 'Editor Font Size',
    description: 'Controls the font size in pixels in the code editor.',
    defaultValue: 13,
    schema: { type: 'integer', minimum: 10, maximum: 32, default: 13 }
  },
  {
    key: 'editor.tabSize',
    category: 'Editor',
    title: 'Tab Size',
    description: 'The number of spaces a tab is equal to.',
    defaultValue: 2,
    schema: { type: 'integer', minimum: 1, maximum: 8, default: 2 }
  },
  {
    key: 'editor.wordWrap',
    category: 'Editor',
    title: 'Word Wrap',
    description: 'Controls how lines should wrap in the editor.',
    defaultValue: 'off',
    schema: { type: 'string', enum: ['off', 'on', 'wordWrapColumn'], default: 'off' }
  },
  {
    key: 'editor.minimap.enabled',
    category: 'Editor',
    title: 'Minimap Enabled',
    description: 'Controls whether the editor minimap is shown.',
    defaultValue: false,
    schema: { type: 'boolean', default: false }
  },
  {
    key: 'editor.lineNumbers',
    category: 'Editor',
    title: 'Line Numbers',
    description: 'Controls the display of line numbers in the editor gutter.',
    defaultValue: 'on',
    schema: { type: 'string', enum: ['on', 'off', 'relative'], default: 'on' }
  },
  {
    key: 'editor.formatOnSave',
    category: 'Editor',
    title: 'Format On Save',
    description: 'Format a file automatically when saving.',
    defaultValue: false,
    schema: { type: 'boolean', default: false }
  },
  {
    key: 'workbench.colorTheme',
    category: 'Workbench',
    title: 'Color Theme',
    description: 'Specifies the color theme used in the workbench (`dark`, `light`, `high-contrast`, or a registered custom theme id).',
    defaultValue: 'dark',
    schema: { type: 'string', minLength: 1, default: 'dark' }
  },
  {
    key: 'workbench.sideBar.visible',
    category: 'Workbench',
    title: 'Sidebar Visible',
    description: 'Controls the visibility of the file explorer / activity sidebar.',
    defaultValue: true,
    schema: { type: 'boolean', default: true }
  },
  {
    key: 'workbench.panel.defaultTab',
    category: 'Workbench',
    title: 'Default Bottom Panel Tab',
    description: 'Default active tab in the bottom drawer.',
    defaultValue: 'console',
    schema: {
      type: 'string',
      enum: ['console', 'terminal', 'tests', 'problems', 'ports', 'network', 'observability'],
      default: 'console'
    }
  },
  {
    key: 'files.autoSave',
    category: 'Files',
    title: 'Auto Save',
    description: 'Controls automatic persistence of dirty files.',
    defaultValue: 'afterDelay',
    schema: { type: 'string', enum: ['afterDelay', 'off'], default: 'afterDelay' }
  },
  {
    key: 'files.autoSaveDelay',
    category: 'Files',
    title: 'Auto Save Delay (ms)',
    description: 'Controls the delay in milliseconds after which a dirty file is saved automatically.',
    defaultValue: 300,
    schema: { type: 'integer', minimum: 50, maximum: 30000, default: 300 }
  },
  {
    key: 'files.exclude',
    category: 'Files',
    title: 'Excluded File Globs',
    description: 'Configure glob patterns for excluding files and folders from the explorer and search.',
    defaultValue: ['**/node_modules/**', '**/.git/**'],
    schema: { type: 'array', items: { type: 'string' }, default: ['**/node_modules/**', '**/.git/**'] }
  },
  {
    key: 'terminal.fontSize',
    category: 'Terminal',
    title: 'Terminal Font Size',
    description: 'Controls the font size in pixels of the integrated PTY terminal.',
    defaultValue: 13,
    schema: { type: 'integer', minimum: 10, maximum: 28, default: 13 }
  },
  {
    key: 'terminal.scrollback',
    category: 'Terminal',
    title: 'Terminal Scrollback',
    description: 'Controls the maximum amount of lines the terminal keeps in its buffer.',
    defaultValue: 1000,
    schema: { type: 'integer', minimum: 100, maximum: 50000, default: 1000 }
  },
  {
    key: 'preview.autoReload',
    category: 'Preview',
    title: 'Preview Auto Reload',
    description: 'Automatically refresh the web preview iframe when workspace files change.',
    defaultValue: true,
    schema: { type: 'boolean', default: true }
  },
  {
    key: 'runtime.timeoutMs',
    category: 'Runtime',
    title: 'Execution Watchdog Timeout (ms)',
    description: 'Maximum execution time in milliseconds before terminating runaway sandbox workers.',
    defaultValue: 8000,
    schema: { type: 'integer', minimum: 500, maximum: 120000, default: 8000 }
  },
  {
    key: 'sql.defaultDialect',
    category: 'SQL',
    title: 'Default SQL Dialect',
    description: 'Default SQL dialect used for highlighting, formatting, and completions.',
    defaultValue: 'postgres',
    schema: { type: 'string', enum: ['postgres', 'sqlite'], default: 'postgres' }
  }
];

export function buildSettingsJsonSchema(descriptors: readonly SettingDescriptor[]): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  for (const d of descriptors) {
    properties[d.key] = {
      ...d.schema,
      title: d.title,
      description: d.description,
      default: d.defaultValue
    };
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'CodeLab Workspace & User Settings (.codelab/settings.json)',
    type: 'object',
    properties,
    additionalProperties: true
  };
}

export const KEYBINDINGS_JSON_SCHEMA: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CodeLab Keybindings (.codelab/keybindings.json)',
  type: 'array',
  items: {
    type: 'object',
    required: ['key', 'command'],
    properties: {
      key: { type: 'string', minLength: 1, description: 'Key chord such as Mod+Enter or Shift+Alt+F' },
      command: { type: 'string', minLength: 1, description: 'Command ID (prefix with - to unbind)' },
      when: { type: 'string', description: 'Optional context-key expression' }
    },
    additionalProperties: true
  }
};

export const TASKS_JSON_SCHEMA: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CodeLab Workspace Tasks (.codelab/tasks.json)',
  type: 'object',
  required: ['version', 'tasks'],
  properties: {
    version: { type: 'string', enum: ['1.0', '2.0.0'] },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'command'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string', minLength: 1 },
          command: { type: 'string', minLength: 1 },
          group: { type: 'string', enum: ['run', 'build', 'test', 'dev'] },
          runOn: { type: 'string', enum: ['manual', 'folderOpen'] },
          cwd: { type: 'string' }
        },
        additionalProperties: true
      }
    }
  },
  additionalProperties: true
};

export const EXTENSIONS_JSON_SCHEMA: JsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CodeLab Workspace Extensions (.codelab/extensions.json)',
  type: 'object',
  properties: {
    recommendations: { type: 'array', items: { type: 'string' } },
    autoActivate: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: true
};
