export {
  type JsoncParseError,
  type JsoncParseResult,
  stripJsonCommentsAndTrailingCommas,
  parseJsonc
} from './jsonc';

export {
  type JsonSchemaType,
  type JsonSchema,
  type SchemaValidationIssue,
  validateJsonSchema
} from './schema';

export {
  type SettingCategory,
  type SettingDescriptor,
  BUILTIN_SETTINGS,
  buildSettingsJsonSchema,
  KEYBINDINGS_JSON_SCHEMA,
  TASKS_JSON_SCHEMA,
  EXTENSIONS_JSON_SCHEMA
} from './builtin-schemas';

export {
  type ConfigurationTarget,
  type SettingDiagnostic,
  type ConfigurationChangeEvent,
  type SettingInspection,
  type WorkspaceTaskDefinition,
  type WorkspaceExtensionsConfig,
  type IConfigurationService,
  IConfigurationServiceId,
  ConfigurationService,
  parseTasksConfig,
  parseExtensionsConfig
} from './configuration-service';
