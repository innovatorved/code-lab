/**
 * TypeScript Language Extension for CodeLab
 *
 * Zero-dependency browser TypeScript extension powered by CodeLab's built-in
 * `transpileTS` compiler and virtual Node.js / Bun runtime.
 */

export interface TypeScriptExtensionOptions {
  /**
   * Optional TypeScript workspace files (`tsFiles`).
   */
  files?: Record<string, string>;
  /**
   * Optional Guided Lab TypeScript starter files (`tsStarterFiles`).
   */
  starterFiles?: Record<string, string>;
  /**
   * Optional Guided Lab TypeScript reference solution files (`tsSolutionFiles`).
   */
  solutionFiles?: Record<string, string>;
  /**
   * Optional entry file when TypeScript is active (e.g. 'src/demo.ts').
   */
  entry?: string;
  /**
   * Immediately switch the active workbench language to 'ts'.
   */
  activate?: boolean;
}

export function typescriptExtension(workbench: any, options: TypeScriptExtensionOptions = {}) {
  if (!workbench) return workbench;

  if (!workbench.enabledLanguages || !(workbench.enabledLanguages instanceof Set)) {
    workbench.enabledLanguages = new Set(['js', 'ts']);
  } else {
    workbench.enabledLanguages.add('ts');
  }

  if (options.files && typeof options.files === 'object') {
    workbench.tsFiles = { ...(workbench.tsFiles || {}), ...options.files };
    if (workbench.guidedConfig) {
      workbench.guidedConfig.tsFiles = { ...(workbench.guidedConfig.tsFiles || {}), ...options.files };
    }
  }
  if (options.starterFiles && typeof options.starterFiles === 'object') {
    if (!workbench.guidedConfig) workbench.guidedConfig = {};
    workbench.guidedConfig.tsStarterFiles = {
      ...(workbench.guidedConfig.tsStarterFiles || {}),
      ...options.starterFiles
    };
  }
  if (options.solutionFiles && typeof options.solutionFiles === 'object') {
    if (!workbench.guidedConfig) workbench.guidedConfig = {};
    workbench.guidedConfig.tsSolutionFiles = {
      ...(workbench.guidedConfig.tsSolutionFiles || {}),
      ...options.solutionFiles
    };
  }
  if (options.entry) {
    workbench.tsEntry = options.entry;
  }

  workbench.hasMultipleLanguages = workbench.enabledLanguages.size > 1;

  if (options.activate && typeof workbench.setLanguage === 'function') {
    workbench.setLanguage('ts');
  } else if (typeof workbench._renderShell === 'function' && workbench.container) {
    workbench._renderShell();
    if (typeof workbench._bindEvents === 'function') workbench._bindEvents();
    if (typeof workbench._renderFileLists === 'function') workbench._renderFileLists();
  }

  return workbench;
}

export function createTypeScriptExtension(options: TypeScriptExtensionOptions = {}) {
  const plugin = (workbench: any) => typescriptExtension(workbench, options);
  plugin.extensionName = 'typescript';
  plugin.languageId = 'ts' as const;
  return plugin;
}

export const tsExtension = typescriptExtension;
export default typescriptExtension;
