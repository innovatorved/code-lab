import { DisposableStore, type IDisposable } from '@code-lab/core';
import type { IConfigurationService, SettingCategory, SettingDescriptor } from '@code-lab/settings';

function escapeAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SettingsScope = 'user' | 'workspace';

export interface SettingsInlineMountOptions {
  readonly scope?: SettingsScope;
  readonly onOpenJson?: () => void;
  readonly onOpenSettingsJson?: () => void;
  readonly onWorkspaceSettingsMutated?: (nextWorkspaceSettings: Record<string, unknown>) => void;
}

export type SettingsOpenOptions = SettingsInlineMountOptions;

export interface SettingsDialogOptions {
  readonly configuration: IConfigurationService;
  readonly scope?: SettingsScope;
  readonly onOpenSettingsJson?: () => void;
  readonly onOpenJson?: () => void;
  readonly onExportSettings?: (json: string) => void;
  readonly onImportSettings?: () => void;
  readonly onWorkspaceSettingsMutated?: (nextWorkspaceSettings: Record<string, unknown>) => void;
}

const ALL_CATEGORIES: ReadonlyArray<'All' | SettingCategory> = [
  'All',
  'Editor',
  'Workbench',
  'Files',
  'Terminal',
  'Preview',
  'Runtime',
  'SQL'
];

const SETTINGS_STYLE_ID = 'codelab-ui-settings-styles';

export const SETTINGS_COMPONENT_CSS = `/* @innovatorved/code-lab/ui — Tokenized Settings & Control Components */
.cl-settings-dialog,
.cl-settings-editor {
  --cl-ui-sans: var(--cl-font-sans, var(--ds-font-sans, var(--font-sans, "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif)));
  --cl-ui-mono: var(--cl-font-mono, var(--ds-font-mono, var(--font-mono, "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace)));
  --cl-ui-text-2xs: var(--cl-text-2xs, var(--ds-text-2xs, 0.6875rem));
  --cl-ui-text-xs: var(--cl-text-xs, var(--ds-text-xs, 0.75rem));
  --cl-ui-text-sm: var(--cl-text-sm, var(--ds-text-sm, 0.8125rem));
  --cl-ui-text-base: var(--cl-text-base, var(--ds-text-base, 0.875rem));
  font-family: var(--cl-ui-sans);
  color: var(--cl-fg, #f4f4f5);
}

.cl-settings-editor.cl-settings-inline {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--cl-editor-bg, var(--cl-bg, #0f0f10));
}

.cl-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--cl-border, #27272a);
  background: var(--cl-surface, var(--cl-bg-elevated, #141415));
  flex-wrap: wrap;
}

.cl-settings-title {
  margin: 0;
  font-size: var(--cl-ui-text-base);
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--cl-fg-active, var(--cl-fg, #f4f4f5));
}

.cl-settings-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cl-settings-toolbar {
  padding: 12px 20px 0 20px;
  border-bottom: 1px solid var(--cl-border, #27272a);
  background: var(--cl-surface, var(--cl-bg-elevated, #141415));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cl-settings-search {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border-radius: var(--cl-radius-md, 6px);
  border: 1px solid var(--cl-input-border, var(--cl-border, #27272a));
  background: var(--cl-input-bg, var(--cl-bg, #0f0f10));
  color: var(--cl-fg, #f4f4f5);
  font-family: var(--cl-ui-sans);
  font-size: var(--cl-ui-text-sm);
  outline: none;
  transition: border-color 120ms ease;
}

.cl-settings-search::placeholder {
  color: var(--cl-fg-faint, var(--cl-fg-muted, #8e8e97));
}

.cl-settings-search:focus {
  border-color: var(--cl-focus-border, #a1a1aa);
}

.cl-settings-scopes {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
}

.cl-settings-scope-tab {
  flex: none;
  padding: 6px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--cl-fg-muted, #a1a1aa);
  font-family: var(--cl-ui-sans);
  font-size: var(--cl-ui-text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.cl-settings-scope-tab:hover {
  color: var(--cl-fg, #f4f4f5);
}

.cl-settings-scope-tab[aria-selected="true"] {
  color: var(--cl-fg-active, var(--cl-fg, #f4f4f5));
  font-weight: 600;
  border-bottom-color: var(--cl-accent, #f4f4f5);
}

.cl-settings-body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
}

.cl-settings-body--dialog {
  min-height: 320px;
  max-height: 62vh;
}

.cl-settings-body--inline {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.cl-settings-categories {
  border-right: 1px solid var(--cl-border, #27272a);
  background: var(--cl-surface, var(--cl-bg-elevated, #141415));
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.cl-settings-cat-btn {
  text-align: left;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: var(--cl-radius-md, 6px);
  background: transparent;
  color: var(--cl-fg-muted, #a1a1aa);
  font-family: var(--cl-ui-sans);
  font-size: var(--cl-ui-text-sm);
  font-weight: 500;
  line-height: 1.35;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.cl-settings-cat-btn:hover {
  background: var(--cl-list-hover, var(--cl-bg-hover, #1f1f22));
  color: var(--cl-fg, #f4f4f5);
}

.cl-settings-cat-btn[aria-current="true"] {
  background: var(--cl-list-active, var(--cl-bg-active, #28282b));
  color: var(--cl-list-active-fg, var(--cl-fg, #f4f4f5));
  font-weight: 600;
}

.cl-settings-list {
  padding: 14px 24px 28px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cl-settings-empty {
  padding: 16px 4px;
  color: var(--cl-fg-muted, #a1a1aa);
  font-size: var(--cl-ui-text-sm);
}

.cl-setting-item {
  padding: 14px 16px;
  border: 1px solid var(--cl-border, #27272a);
  border-radius: var(--cl-radius-lg, 8px);
  background: var(--cl-widget-bg, var(--cl-bg-panel, #18181a));
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 120ms ease;
}

.cl-setting-item--modified {
  border-color: var(--cl-border-strong, #3a3a3e);
}

.cl-setting-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cl-setting-item__heading {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.cl-setting-item__cat {
  font-size: var(--cl-ui-text-xs);
  color: var(--cl-fg-muted, #a1a1aa);
  font-weight: 500;
}

.cl-setting-item__title {
  font-size: var(--cl-ui-text-sm);
  font-weight: 600;
  color: var(--cl-fg-active, var(--cl-fg, #f4f4f5));
}

.cl-setting-item__key {
  font-family: var(--cl-ui-mono);
  font-size: var(--cl-ui-text-2xs);
  padding: 1px 5px;
  border-radius: var(--cl-radius-sm, 4px);
  border: 1px solid var(--cl-border, #27272a);
  background: var(--cl-input-bg, var(--cl-bg, #0f0f10));
  color: var(--cl-fg-muted, #a1a1aa);
}

.cl-setting-badge {
  font-family: var(--cl-ui-mono);
  font-size: var(--cl-ui-text-2xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--cl-btn-primary-bg, var(--cl-accent, #f4f4f5));
  color: var(--cl-btn-primary-fg, var(--cl-accent-fg, #0f0f10));
}

.cl-setting-item__desc {
  font-size: var(--cl-ui-text-xs);
  line-height: 1.5;
  color: var(--cl-fg-muted, #a1a1aa);
}

.cl-setting-item__control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.cl-ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--cl-radius-md, 6px);
  border: 1px solid var(--cl-input-border, var(--cl-border, #27272a));
  background: var(--cl-input-bg, var(--cl-bg, #0f0f10));
  color: var(--cl-fg, #f4f4f5);
  font-family: var(--cl-ui-sans);
  font-size: var(--cl-ui-text-xs);
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.cl-ui-btn:hover {
  background: var(--cl-list-hover, var(--cl-bg-hover, #1f1f22));
  border-color: var(--cl-border-strong, #3a3a3e);
}

.cl-ui-control {
  height: 30px;
  padding: 0 9px;
  border-radius: var(--cl-radius-md, 6px);
  border: 1px solid var(--cl-input-border, var(--cl-border, #27272a));
  background: var(--cl-input-bg, var(--cl-bg, #0f0f10));
  color: var(--cl-fg, #f4f4f5);
  font-family: var(--cl-ui-sans);
  font-size: var(--cl-ui-text-sm);
  outline: none;
  transition: border-color 120ms ease;
}

.cl-ui-control:focus {
  border-color: var(--cl-focus-border, #a1a1aa);
}

.cl-ui-control--num {
  width: 104px;
  font-family: var(--cl-ui-mono);
  font-variant-numeric: tabular-nums;
}

.cl-ui-control--array {
  width: min(280px, 100%);
  font-family: var(--cl-ui-mono);
  font-size: var(--cl-ui-text-xs);
}

.cl-ui-control--text {
  width: min(200px, 100%);
}

.cl-ui-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--cl-accent, #f4f4f5);
  cursor: pointer;
}

@media (max-width: 640px) {
  .cl-settings-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .cl-settings-categories {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--cl-border, #27272a);
    overflow-x: auto;
  }
}
`;

export function ensureSettingsStylesInjected(doc?: Document): void {
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!targetDoc || !targetDoc.head) return;
  const existing =
    typeof targetDoc.getElementById === 'function'
      ? targetDoc.getElementById(SETTINGS_STYLE_ID)
      : typeof targetDoc.head.querySelector === 'function'
        ? targetDoc.head.querySelector(`#${SETTINGS_STYLE_ID}`)
        : null;
  if (existing) return;
  if (typeof targetDoc.createElement !== 'function') return;
  const styleEl = targetDoc.createElement('style');
  styleEl.id = SETTINGS_STYLE_ID;
  styleEl.textContent = SETTINGS_COMPONENT_CSS;
  targetDoc.head.appendChild(styleEl);
}

function isDomHostElement(candidate: unknown): candidate is HTMLElement {
  return Boolean(
    candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as HTMLElement).appendChild === 'function'
  );
}

export class SettingsDialogController implements IDisposable {
  private readonly dialogDisposables = new DisposableStore();
  private readonly inlineDisposables = new DisposableStore();
  private readonly config: IConfigurationService;
  private readonly options: SettingsDialogOptions;
  private hostRoot: HTMLElement | null = null;
  private dialogEl: HTMLDialogElement | null = null;
  private inlineRootEl: HTMLElement | null = null;
  private runtimeCallbacks: SettingsOpenOptions | undefined;
  private inlineCallbacks: SettingsInlineMountOptions | undefined;
  private activeScope: SettingsScope;
  private activeCategory: 'All' | SettingCategory = 'All';
  private searchQuery = '';

  public constructor(hostRoot: HTMLElement, options: SettingsDialogOptions);
  public constructor(options: SettingsDialogOptions);
  public constructor(
    hostRootOrOptions: HTMLElement | SettingsDialogOptions,
    maybeOptions?: SettingsDialogOptions
  ) {
    if (isDomHostElement(hostRootOrOptions) && maybeOptions) {
      this.hostRoot = hostRootOrOptions;
      this.options = maybeOptions;
      this.config = maybeOptions.configuration;
      this.activeScope = maybeOptions.scope ?? 'user';
      this.mountDialog(hostRootOrOptions);
    } else {
      const opts = hostRootOrOptions as SettingsDialogOptions;
      this.options = opts;
      this.config = opts.configuration;
      this.activeScope = opts.scope ?? 'user';
    }
  }

  private buildSurfaceInnerHtml(mode: 'dialog' | 'inline'): string {
    const titleId = mode === 'dialog' ? 'cl-settings-dialog-title' : 'cl-settings-inline-title';
    const bodyModeClass = mode === 'dialog' ? 'cl-settings-body--dialog' : 'cl-settings-body--inline';
    const closeBtnHtml =
      mode === 'dialog'
        ? `<button type="button" class="codelab-btn cl-ui-btn" data-settings-action="close" aria-label="Close Settings">✕</button>`
        : '';

    return (
      `<div class="cl-settings-header">` +
      `<h2 id="${titleId}" class="cl-settings-title">Settings</h2>` +
      `<div class="cl-settings-actions">` +
      `<button type="button" class="codelab-btn cl-ui-btn" data-settings-action="open-json" aria-label="Open Settings (JSON)" title="Open .codelab/settings.json">Open Settings (JSON)</button>` +
      `<button type="button" class="codelab-btn cl-ui-btn" data-settings-action="reset-all" aria-label="Reset All Settings" title="Reset all settings to defaults">Reset All Settings</button>` +
      `<button type="button" class="codelab-btn cl-ui-btn" data-settings-action="export" title="Export Settings JSON">Export</button>` +
      closeBtnHtml +
      `</div>` +
      `</div>` +
      `<div class="cl-settings-toolbar">` +
      `<input type="search" class="cl-settings-search" data-role="settings-search" aria-label="Search settings" value="${escapeAttr(this.searchQuery)}" placeholder="Search settings…" />` +
      `<div role="tablist" aria-label="Settings scope" class="cl-settings-scopes" data-role="settings-scopes"></div>` +
      `</div>` +
      `<div class="cl-settings-body ${bodyModeClass}">` +
      `<nav class="cl-settings-categories" data-role="settings-categories" aria-label="Setting categories"></nav>` +
      `<div class="cl-settings-list" data-role="settings-list"></div>` +
      `</div>`
    );
  }

  private getWorkspaceSnapshot(): Record<string, unknown> {
    if (typeof this.config.getWorkspaceSettings === 'function') {
      return this.config.getWorkspaceSettings();
    }
    try {
      const parsed = JSON.parse(this.config.toWorkspaceJsonString()) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (err) {
      const _ignored = err;
      void _ignored;
    }
    return {};
  }

  private notifyWorkspaceMutated(mode: 'dialog' | 'inline'): void {
    const snapshot = this.getWorkspaceSnapshot();
    const cb =
      mode === 'inline'
        ? (this.inlineCallbacks?.onWorkspaceSettingsMutated ??
          this.runtimeCallbacks?.onWorkspaceSettingsMutated ??
          this.options.onWorkspaceSettingsMutated)
        : (this.runtimeCallbacks?.onWorkspaceSettingsMutated ??
          this.inlineCallbacks?.onWorkspaceSettingsMutated ??
          this.options.onWorkspaceSettingsMutated);
    cb?.(snapshot);
  }

  private invokeOpenJsonCallback(mode: 'dialog' | 'inline'): void {
    const cb =
      mode === 'inline'
        ? (this.inlineCallbacks?.onOpenJson ??
          this.inlineCallbacks?.onOpenSettingsJson ??
          this.runtimeCallbacks?.onOpenJson ??
          this.runtimeCallbacks?.onOpenSettingsJson ??
          this.options.onOpenJson ??
          this.options.onOpenSettingsJson)
        : (this.runtimeCallbacks?.onOpenJson ??
          this.runtimeCallbacks?.onOpenSettingsJson ??
          this.inlineCallbacks?.onOpenJson ??
          this.inlineCallbacks?.onOpenSettingsJson ??
          this.options.onOpenJson ??
          this.options.onOpenSettingsJson);
    cb?.();
  }

  private bindSurfaceEvents(
    surfaceEl: HTMLElement,
    mode: 'dialog' | 'inline',
    store: DisposableStore
  ): void {
    const searchInput = surfaceEl.querySelector('[data-role="settings-search"]') as HTMLInputElement | null;
    if (searchInput) {
      const onInput = (): void => {
        this.searchQuery = searchInput.value.trim().toLowerCase();
        this.renderAllActiveSurfaces('items');
      };
      searchInput.addEventListener('input', onInput);
      store.addFn(() => searchInput.removeEventListener('input', onInput));
    }

    const onClick = (evt: Event): void => {
      const target = (evt.target as HTMLElement | null)?.closest?.(
        '[data-settings-action],[data-settings-cat],[data-settings-scope],[data-reset-key]'
      );
      if (!target) return;

      const scopeAttr = target.getAttribute('data-settings-scope');
      if (scopeAttr === 'user' || scopeAttr === 'workspace') {
        if (this.activeScope !== scopeAttr) {
          this.activeScope = scopeAttr;
          this.renderAllActiveSurfaces('all');
        }
        return;
      }

      const action = target.getAttribute('data-settings-action');
      if (action === 'close') {
        this.close();
        return;
      }
      if (action === 'open-json') {
        if (mode === 'dialog') {
          this.close();
        }
        this.invokeOpenJsonCallback(mode);
        return;
      }
      if (action === 'export') {
        this.options.onExportSettings?.(this.config.exportProfile());
        return;
      }
      if (action === 'reset-all') {
        const hadWs = Object.keys(this.getWorkspaceSnapshot()).length > 0;
        if (this.activeScope === 'workspace') {
          void this.config.resetAllSettings('workspace');
          this.notifyWorkspaceMutated(mode);
        } else {
          void this.config.resetAllSettings('all');
          if (hadWs) {
            this.notifyWorkspaceMutated(mode);
          }
        }
        this.renderAllActiveSurfaces('items');
        return;
      }

      const cat = target.getAttribute('data-settings-cat') as ('All' | SettingCategory) | null;
      if (cat) {
        this.activeCategory = cat;
        this.renderAllActiveSurfaces('categories-and-items');
        return;
      }

      const resetKey = target.getAttribute('data-reset-key');
      if (resetKey) {
        const hadWs = this.config.inspect(resetKey).workspaceValue !== undefined;
        if (this.activeScope === 'workspace') {
          void this.config.resetScopedSetting(resetKey, 'workspace');
          if (hadWs) {
            this.notifyWorkspaceMutated(mode);
          }
        } else {
          void this.config.resetScopedSetting(resetKey, 'all');
          if (hadWs) {
            this.notifyWorkspaceMutated(mode);
          }
        }
        this.renderAllActiveSurfaces('items');
      }
    };
    surfaceEl.addEventListener('click', onClick);
    store.addFn(() => surfaceEl.removeEventListener('click', onClick));

    const onChange = (evt: Event): void => {
      const el = evt.target as HTMLInputElement | HTMLSelectElement | null;
      if (!el || typeof el.getAttribute !== 'function') return;
      const key = el.getAttribute('data-setting-key');
      if (!key) return;
      const desc = this.config.getDescriptors().find((d) => d.key === key);
      if (!desc) return;

      let nextValue: unknown;
      let hasValidValue = true;

      if (desc.schema.type === 'boolean' && el.getAttribute('type') === 'checkbox') {
        nextValue = Boolean((el as HTMLInputElement).checked);
      } else if (desc.schema.type === 'integer' || desc.schema.type === 'number') {
        const num = Number(el.value);
        if (Number.isFinite(num)) {
          nextValue = desc.schema.type === 'integer' ? Math.trunc(num) : num;
        } else {
          hasValidValue = false;
        }
      } else if (desc.schema.type === 'array') {
        nextValue = el.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        nextValue = el.value;
      }

      let applied = false;
      if (hasValidValue) {
        if (this.activeScope === 'workspace') {
          applied = this.config.setWorkspaceSetting(key, nextValue);
          if (applied) {
            this.notifyWorkspaceMutated(mode);
          }
        } else {
          const hadWorkspaceOverride = this.config.inspect(key).workspaceValue !== undefined;
          applied = this.config.setUserSetting(key, nextValue);
          if (applied && hadWorkspaceOverride) {
            this.config.setWorkspaceSetting(key, nextValue);
            this.notifyWorkspaceMutated(mode);
          }
        }
      }
      if (!applied) {
        const min = desc.schema.minimum;
        const max = desc.schema.maximum;
        const rangeHint =
          min !== undefined && max !== undefined
            ? `Value must be between ${min} and ${max}.`
            : min !== undefined
              ? `Value must be at least ${min}.`
              : max !== undefined
                ? `Value must be at most ${max}.`
                : 'Invalid setting value.';
        if ('setCustomValidity' in el && typeof (el as HTMLInputElement).setCustomValidity === 'function') {
          (el as HTMLInputElement).setCustomValidity(rangeHint);
          if (typeof (el as HTMLInputElement).reportValidity === 'function') {
            (el as HTMLInputElement).reportValidity();
          }
          (el as HTMLInputElement).setCustomValidity('');
        }
      }
      this.renderAllActiveSurfaces('items');
    };
    surfaceEl.addEventListener('change', onChange);
    store.addFn(() => surfaceEl.removeEventListener('change', onChange));

    store.add(
      this.config.onDidChangeConfiguration(() => {
        if (mode === 'dialog' && this.isOpen && this.dialogEl) {
          this.renderItems(this.dialogEl);
        } else if (mode === 'inline' && this.isInlineMounted && this.inlineRootEl) {
          this.renderItems(this.inlineRootEl);
        }
      })
    );
  }

  private mountDialog(hostRoot: HTMLElement): void {
    this.dialogDisposables.clear();
    this.dialogEl?.remove();
    const doc = hostRoot.ownerDocument ?? document;
    ensureSettingsStylesInjected(doc);
    const dialog = doc.createElement('dialog');
    dialog.className = 'codelab-dialog cl-settings-dialog';
    dialog.setAttribute('closedby', 'any');
    dialog.setAttribute('aria-labelledby', 'cl-settings-dialog-title');
    dialog.innerHTML = this.buildSurfaceInnerHtml('dialog');

    hostRoot.appendChild(dialog);
    this.dialogEl = dialog;

    const onClose = (): void => {
      dialog.returnValue = '';
    };
    dialog.addEventListener('close', onClose);
    this.dialogDisposables.addFn(() => dialog.removeEventListener('close', onClose));

    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      const onBackdropClick = (evt: MouseEvent): void => {
        if (evt.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const outside =
          evt.clientX < rect.left ||
          evt.clientX > rect.right ||
          evt.clientY < rect.top ||
          evt.clientY > rect.bottom;
        if (outside) dialog.close();
      };
      dialog.addEventListener('click', onBackdropClick);
      this.dialogDisposables.addFn(() => dialog.removeEventListener('click', onBackdropClick));
    }

    this.bindSurfaceEvents(dialog, 'dialog', this.dialogDisposables);
  }

  public get isOpen(): boolean {
    return Boolean(this.dialogEl && (this.dialogEl.open || this.dialogEl.hasAttribute('open')));
  }

  public get isInlineMounted(): boolean {
    return Boolean(this.inlineRootEl && this.inlineRootEl.parentNode);
  }

  public open(options?: SettingsOpenOptions): void {
    if (options?.scope) {
      this.activeScope = options.scope;
    }
    if (options) {
      this.runtimeCallbacks = options;
    }
    if (!this.dialogEl) {
      const fallbackHost =
        this.hostRoot ?? (typeof document !== 'undefined' ? document.body : null);
      if (!fallbackHost) return;
      this.hostRoot = fallbackHost;
      this.mountDialog(fallbackHost);
    }
    if (!this.dialogEl) return;
    this.renderScopes(this.dialogEl);
    this.renderCategories(this.dialogEl);
    this.renderItems(this.dialogEl);
    if (typeof this.dialogEl.showModal === 'function') {
      if (!this.dialogEl.open) this.dialogEl.showModal();
    } else {
      this.dialogEl.setAttribute('open', '');
    }
    const searchInput = this.dialogEl.querySelector('[data-role="settings-search"]') as HTMLInputElement | null;
    searchInput?.focus();
  }

  public close(): void {
    if (!this.dialogEl) return;
    if (typeof this.dialogEl.close === 'function' && this.dialogEl.open) {
      this.dialogEl.close();
    } else {
      this.dialogEl.removeAttribute('open');
    }
  }

  public mountInline(container: HTMLElement, options?: SettingsInlineMountOptions): void {
    this.unmountInline();
    if (options?.scope) {
      this.activeScope = options.scope;
    }
    this.inlineCallbacks = options;

    const doc = container.ownerDocument ?? document;
    ensureSettingsStylesInjected(doc);
    const root = doc.createElement('div');
    root.className = 'cl-settings-editor cl-settings-inline';
    root.setAttribute('data-role', 'settings-inline-root');
    root.innerHTML = this.buildSurfaceInnerHtml('inline');

    container.appendChild(root);
    this.inlineRootEl = root;

    this.bindSurfaceEvents(root, 'inline', this.inlineDisposables);
    this.renderScopes(root);
    this.renderCategories(root);
    this.renderItems(root);
  }

  public unmountInline(): void {
    this.inlineDisposables.clear();
    this.inlineRootEl?.remove();
    this.inlineRootEl = null;
  }

  private renderAllActiveSurfaces(kind: 'all' | 'categories-and-items' | 'items'): void {
    const surfaces: HTMLElement[] = [];
    if (this.dialogEl) surfaces.push(this.dialogEl);
    if (this.inlineRootEl) surfaces.push(this.inlineRootEl);
    for (const root of surfaces) {
      if (kind === 'all') {
        this.renderScopes(root);
        this.renderCategories(root);
        this.renderItems(root);
      } else if (kind === 'categories-and-items') {
        this.renderCategories(root);
        this.renderItems(root);
      } else {
        this.renderItems(root);
      }
    }
  }

  private renderScopes(root: HTMLElement): void {
    const scopesEl = root.querySelector('[data-role="settings-scopes"]');
    if (!scopesEl) return;
    const tabs: ReadonlyArray<{ readonly id: SettingsScope; readonly label: string }> = [
      { id: 'user', label: 'User' },
      { id: 'workspace', label: 'Workspace (.codelab/settings.json)' }
    ];
    scopesEl.innerHTML = tabs
      .map((tab) => {
        const selected = this.activeScope === tab.id;
        return (
          `<button type="button" role="tab" class="cl-settings-scope-tab" data-settings-scope="${tab.id}" aria-selected="${selected ? 'true' : 'false'}">` +
          `${escapeAttr(tab.label)}` +
          `</button>`
        );
      })
      .join('');
  }

  private renderCategories(root: HTMLElement): void {
    const nav = root.querySelector('[data-role="settings-categories"]');
    if (!nav) return;
    nav.innerHTML = ALL_CATEGORIES.map((cat) => {
      const selected = cat === this.activeCategory;
      return (
        `<button type="button" class="cl-settings-cat-btn" data-settings-cat="${cat}" aria-current="${selected ? 'true' : 'false'}">` +
        `${escapeAttr(cat)}` +
        `</button>`
      );
    }).join('');
  }

  private renderControl(desc: SettingDescriptor, currentVal: unknown): string {
    const keyAttr = escapeAttr(desc.key);
    if (desc.schema.enum && desc.schema.enum.length > 0) {
      const opts = desc.schema.enum
        .map((opt) => {
          const str = String(opt);
          const sel = String(currentVal) === str ? ' selected' : '';
          return `<option value="${escapeAttr(str)}"${sel}>${escapeAttr(str)}</option>`;
        })
        .join('');
      return `<select class="cl-ui-control" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}">${opts}</select>`;
    }
    if (desc.schema.type === 'boolean') {
      const checked = Boolean(currentVal) ? ' checked' : '';
      return `<input type="checkbox" class="cl-ui-checkbox" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}"${checked} />`;
    }
    if (desc.schema.type === 'integer' || desc.schema.type === 'number') {
      const min = desc.schema.minimum !== undefined ? ` min="${desc.schema.minimum}"` : '';
      const max = desc.schema.maximum !== undefined ? ` max="${desc.schema.maximum}"` : '';
      return `<input type="number" class="cl-ui-control cl-ui-control--num" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(String(currentVal ?? ''))}"${min}${max} />`;
    }
    if (desc.schema.type === 'array') {
      const joined = Array.isArray(currentVal) ? currentVal.join(', ') : '';
      return `<input type="text" class="cl-ui-control cl-ui-control--array" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(joined)}" />`;
    }
    return `<input type="text" class="cl-ui-control cl-ui-control--text" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(String(currentVal ?? ''))}" />`;
  }

  private renderItems(root: HTMLElement): void {
    const listEl = root.querySelector('[data-role="settings-list"]');
    if (!listEl) return;
    const descriptors = this.config.getDescriptors().filter((d) => {
      if (this.activeCategory !== 'All' && d.category !== this.activeCategory) return false;
      if (!this.searchQuery) return true;
      const hay = `${d.key} ${d.title} ${d.description} ${d.category}`.toLowerCase();
      return hay.includes(this.searchQuery);
    });

    if (descriptors.length === 0) {
      listEl.innerHTML = `<div class="cl-settings-empty">No matching settings found.</div>`;
      return;
    }

    listEl.innerHTML = descriptors
      .map((desc) => {
        const insp = this.config.inspect(desc.key);
        const displayedVal =
          this.activeScope === 'workspace'
            ? (insp.workspaceValue !== undefined ? insp.workspaceValue : insp.effectiveValue)
            : insp.effectiveValue;
        const canReset =
          this.activeScope === 'workspace'
            ? insp.workspaceValue !== undefined
            : insp.effectiveSource !== 'default' || insp.userValue !== undefined;
        const badgeLabel =
          this.activeScope === 'workspace'
            ? (insp.workspaceValue !== undefined ? 'workspace' : '')
            : (insp.effectiveSource !== 'default' ? insp.effectiveSource : '');

        const hasWorkspaceOverrideNotice =
          this.activeScope === 'user' && insp.workspaceValue !== undefined;

        const modClass = canReset ? ' cl-setting-item--modified' : '';

        return (
          `<div class="cl-setting-item${modClass}" data-setting-row="${escapeAttr(desc.key)}">` +
          `<div class="cl-setting-item__top">` +
          `<div class="cl-setting-item__heading">` +
          `<span class="cl-setting-item__cat">${escapeAttr(desc.category)}:</span>` +
          `<strong class="cl-setting-item__title">${escapeAttr(desc.title)}</strong>` +
          `<code class="cl-setting-item__key">${escapeAttr(desc.key)}</code>` +
          (badgeLabel
            ? `<span class="cl-setting-badge" data-role="setting-badge">${escapeAttr(badgeLabel)}</span>`
            : '') +
          (hasWorkspaceOverrideNotice
            ? `<span class="cl-setting-badge" data-role="setting-workspace-override" title="Overridden in .codelab/settings.json">Modified in Workspace</span>`
            : '') +
          `</div>` +
          (canReset
            ? `<button type="button" class="codelab-btn cl-ui-btn" data-reset-key="${escapeAttr(desc.key)}" title="Reset to Default (${escapeAttr(JSON.stringify(desc.defaultValue))})">Reset</button>`
            : '') +
          `</div>` +
          `<div class="cl-setting-item__desc">${escapeAttr(desc.description)}</div>` +
          `<div class="cl-setting-item__control">` +
          this.renderControl(desc, displayedVal) +
          `</div>` +
          `</div>`
        );
      })
      .join('');
  }

  public dispose(): void {
    this.close();
    this.unmountInline();
    this.dialogDisposables.dispose();
    this.inlineDisposables.dispose();
    this.dialogEl?.remove();
    this.dialogEl = null;
    this.hostRoot = null;
  }
}
