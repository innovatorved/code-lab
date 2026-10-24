/**
 * JavaScript Language Extension for CodeLab
 *
 * Enabled by default in CodeLab. Uses the browser's built-in JavaScript engine
 * and CodeLab's zero-dependency virtual Node.js + Bun runtime (`node`, `bun`, `npm`).
 */

export interface JavaScriptExtensionOptions {
  /**
   * Optional starter files to seed when JavaScript is selected.
   */
  files?: Record<string, string>;
  /**
   * Default entry file for JavaScript runs (e.g. 'src/demo.js' or 'index.js').
   */
  entry?: string;
}

export function javascriptExtension(workbench: any, options: JavaScriptExtensionOptions = {}) {
  if (!workbench) return workbench;

  if (!workbench.enabledLanguages || !(workbench.enabledLanguages instanceof Set)) {
    workbench.enabledLanguages = new Set(['js']);
  } else {
    workbench.enabledLanguages.add('js');
  }

  if (options.files && typeof options.files === 'object') {
    workbench.jsFiles = { ...(workbench.jsFiles || {}), ...options.files };
  }
  if (options.entry && !workbench.entry) {
    workbench.entry = options.entry;
  }

  workbench.hasMultipleLanguages = workbench.enabledLanguages.size > 1;

  if (typeof workbench._renderShell === 'function' && workbench.container) {
    workbench._renderShell();
    if (typeof workbench._bindEvents === 'function') workbench._bindEvents();
    if (typeof workbench._renderFileLists === 'function') workbench._renderFileLists();
  }

  return workbench;
}

export function createJavaScriptExtension(options: JavaScriptExtensionOptions = {}) {
  const plugin = (workbench: any) => javascriptExtension(workbench, options);
  plugin.extensionName = 'javascript';
  plugin.languageId = 'js' as const;
  return plugin;
}

export const jsExtension = javascriptExtension;
export default javascriptExtension;
