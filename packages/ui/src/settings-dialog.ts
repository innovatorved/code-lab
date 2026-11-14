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

const BTN_STYLE =
  'padding:5px 10px;border-radius:5px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);cursor:pointer;font-size:12px;';

const CONTROL_STYLE =
  'padding:5px 8px;border-radius:5px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:12.5px;';

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
    const bodyHeightStyle =
      mode === 'dialog'
        ? 'min-height:320px;max-height:62vh;'
        : 'flex:1;min-height:0;overflow:hidden;';
    const closeBtnHtml =
      mode === 'dialog'
        ? `<button type="button" class="codelab-btn" data-settings-action="close" aria-label="Close Settings" style="${BTN_STYLE}">✕</button>`
        : '';

    return (
      `<div class="cl-settings-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--cl-border,#262626);flex-wrap:wrap;">` +
      `<h2 id="${titleId}" style="margin:0;font-size:15px;font-weight:600;color:var(--cl-fg,#f5f5f5);">Settings</h2>` +
      `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">` +
      `<button type="button" class="codelab-btn" data-settings-action="open-json" aria-label="Open Settings (JSON)" title="Open .codelab/settings.json" style="${BTN_STYLE}">Open Settings (JSON)</button>` +
      `<button type="button" class="codelab-btn" data-settings-action="reset-all" aria-label="Reset All Settings" title="Reset all settings to defaults" style="${BTN_STYLE}">Reset All Settings</button>` +
      `<button type="button" class="codelab-btn" data-settings-action="export" title="Export Settings JSON" style="${BTN_STYLE}">Export</button>` +
      closeBtnHtml +
      `</div>` +
      `</div>` +
      `<div style="padding:10px 16px 0 16px;border-bottom:1px solid var(--cl-border,#262626);display:flex;flex-direction:column;gap:8px;">` +
      `<input type="search" data-role="settings-search" aria-label="Search settings" value="${escapeAttr(this.searchQuery)}" placeholder="Search settings (e.g. fontSize, theme, wordWrap, autoSave)..." style="width:100%;padding:7px 10px;border-radius:6px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:13px;" />` +
      `<div role="tablist" aria-label="Settings scope" data-role="settings-scopes" style="display:flex;align-items:center;gap:4px;overflow-x:auto;"></div>` +
      `</div>` +
      `<div class="cl-settings-body" style="display:grid;grid-template-columns:150px minmax(0,1fr);${bodyHeightStyle}">` +
      `<nav data-role="settings-categories" aria-label="Setting categories" style="border-right:1px solid var(--cl-border,#262626);padding:8px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;"></nav>` +
      `<div data-role="settings-list" style="padding:12px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;"></div>` +
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

      if (hasValidValue) {
        if (this.activeScope === 'workspace') {
          if (this.config.setWorkspaceSetting(key, nextValue)) {
            this.notifyWorkspaceMutated(mode);
          }
        } else {
          const hadWorkspaceOverride = this.config.inspect(key).workspaceValue !== undefined;
          if (this.config.setUserSetting(key, nextValue) && hadWorkspaceOverride) {
            this.config.setWorkspaceSetting(key, nextValue);
            this.notifyWorkspaceMutated(mode);
          }
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
    const dialog = doc.createElement('dialog');
    dialog.className = 'codelab-dialog cl-settings-dialog';
    dialog.setAttribute('closedby', 'any');
    dialog.setAttribute('aria-labelledby', 'cl-settings-dialog-title');
    dialog.innerHTML = this.buildSurfaceInnerHtml('dialog');

    hostRoot.appendChild(dialog);
    this.dialogEl = dialog;

    // Reset returnValue on close + Safari fallback for `closedby="any"` light dismiss
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
    const root = doc.createElement('div');
    root.className = 'cl-settings-editor cl-settings-inline';
    root.setAttribute('data-role', 'settings-inline-root');
    root.setAttribute(
      'style',
      'display:flex;flex-direction:column;height:100%;min-height:0;background:var(--cl-bg,#000000);color:var(--cl-fg,#f5f5f5);'
    );
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
          `<button type="button" role="tab" data-settings-scope="${tab.id}" aria-selected="${selected ? 'true' : 'false'}" ` +
          `style="flex:none;padding:6px 12px;border-top:1px solid transparent;border-left:1px solid transparent;border-right:1px solid transparent;border-bottom:2px solid ${selected ? 'var(--cl-accent,#0369a1)' : 'transparent'};background:${selected ? 'var(--cl-surface,#0a0a0a)' : 'transparent'};color:${selected ? 'var(--cl-fg,#f5f5f5)' : 'var(--cl-fg-muted,var(--cl-muted,#64748b))'};cursor:pointer;font-size:12.5px;font-weight:500;">` +
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
        `<button type="button" data-settings-cat="${cat}" aria-current="${selected ? 'true' : 'false'}" ` +
        `style="text-align:left;padding:6px 10px;border-radius:5px;border:1px solid ${selected ? 'var(--cl-accent,#0369a1)' : 'transparent'};background:${selected ? 'var(--cl-accent,#0369a1)' : 'transparent'};color:${selected ? 'var(--cl-accent-fg,#ffffff)' : 'var(--cl-fg,#f5f5f5)'};cursor:pointer;font-size:12.5px;font-weight:500;">` +
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
      return `<select data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" style="${CONTROL_STYLE}">${opts}</select>`;
    }
    if (desc.schema.type === 'boolean') {
      const checked = Boolean(currentVal) ? ' checked' : '';
      return `<input type="checkbox" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}"${checked} />`;
    }
    if (desc.schema.type === 'integer' || desc.schema.type === 'number') {
      const min = desc.schema.minimum !== undefined ? ` min="${desc.schema.minimum}"` : '';
      const max = desc.schema.maximum !== undefined ? ` max="${desc.schema.maximum}"` : '';
      return `<input type="number" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(String(currentVal ?? ''))}"${min}${max} style="width:100px;${CONTROL_STYLE}" />`;
    }
    if (desc.schema.type === 'array') {
      const joined = Array.isArray(currentVal) ? currentVal.join(', ') : '';
      return `<input type="text" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(joined)}" style="width:260px;${CONTROL_STYLE}" />`;
    }
    return `<input type="text" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(String(currentVal ?? ''))}" style="width:180px;${CONTROL_STYLE}" />`;
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
      listEl.innerHTML = `<div style="color:var(--cl-fg-muted,var(--cl-muted,#64748b));font-size:13px;">No matching settings found.</div>`;
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

        return (
          `<div class="cl-setting-item" data-setting-row="${escapeAttr(desc.key)}" style="padding:10px 12px;border:1px solid var(--cl-border,#262626);border-radius:7px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">` +
          `<div style="min-width:0;">` +
          `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">` +
          `<strong style="font-size:13px;color:var(--cl-fg,#f5f5f5);">${escapeAttr(desc.title)}</strong>` +
          `<code style="font-size:11px;color:var(--cl-fg-muted,var(--cl-muted,#64748b));">${escapeAttr(desc.key)}</code>` +
          (badgeLabel
            ? `<span data-role="setting-badge" style="font-size:10px;padding:1px 6px;border-radius:4px;background:var(--cl-accent,#0369a1);color:var(--cl-accent-fg,#ffffff);font-weight:600;">${escapeAttr(badgeLabel)}</span>`
            : '') +
          `</div>` +
          `<div style="font-size:12px;color:var(--cl-fg-muted,var(--cl-muted,#64748b));margin-top:3px;">${escapeAttr(desc.description)}</div>` +
          `</div>` +
          `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">` +
          this.renderControl(desc, displayedVal) +
          (canReset
            ? `<button type="button" class="codelab-btn" data-reset-key="${escapeAttr(desc.key)}" title="Reset to Default (${escapeAttr(JSON.stringify(desc.defaultValue))})" style="${BTN_STYLE}">Reset</button>`
            : '') +
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
