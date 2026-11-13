import { DisposableStore, type IDisposable } from '@code-lab/core';
import type { IConfigurationService, SettingCategory, SettingDescriptor } from '@code-lab/settings';

function escapeAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SettingsDialogOptions {
  readonly configuration: IConfigurationService;
  readonly onOpenSettingsJson?: () => void;
  readonly onExportSettings?: (json: string) => void;
  readonly onImportSettings?: () => void;
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

export class SettingsDialogController implements IDisposable {
  private readonly disposables = new DisposableStore();
  private readonly config: IConfigurationService;
  private readonly options: SettingsDialogOptions;
  private dialogEl: HTMLDialogElement | null = null;
  private activeCategory: 'All' | SettingCategory = 'All';
  private searchQuery = '';

  public constructor(hostRoot: HTMLElement, options: SettingsDialogOptions) {
    this.config = options.configuration;
    this.options = options;
    this.mount(hostRoot);
  }

  private mount(hostRoot: HTMLElement): void {
    const doc = hostRoot.ownerDocument ?? document;
    const dialog = doc.createElement('dialog');
    dialog.className = 'codelab-dialog cl-settings-dialog';
    dialog.setAttribute('closedby', 'any');
    dialog.setAttribute('aria-labelledby', 'cl-settings-dialog-title');

    dialog.innerHTML =
      `<div class="cl-settings-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--cl-border,#262626);">` +
      `<h2 id="cl-settings-dialog-title" style="margin:0;font-size:15px;font-weight:600;">Settings</h2>` +
      `<div style="display:flex;align-items:center;gap:8px;">` +
      `<button type="button" class="codelab-btn" data-settings-action="open-json" title="Open .codelab/settings.json">Open settings.json</button>` +
      `<button type="button" class="codelab-btn" data-settings-action="export" title="Export Settings JSON">Export</button>` +
      `<button type="button" class="codelab-btn" data-settings-action="close" aria-label="Close Settings">✕</button>` +
      `</div>` +
      `</div>` +
      `<div style="padding:10px 16px;border-bottom:1px solid var(--cl-border,#262626);">` +
      `<input type="search" data-role="settings-search" aria-label="Search settings" placeholder="Search settings (e.g. fontSize, theme, wordWrap, autoSave)..." style="width:100%;padding:7px 10px;border-radius:6px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:13px;" />` +
      `</div>` +
      `<div class="cl-settings-body" style="display:grid;grid-template-columns:150px minmax(0,1fr);min-height:320px;max-height:62vh;">` +
      `<nav data-role="settings-categories" aria-label="Setting categories" style="border-right:1px solid var(--cl-border,#262626);padding:8px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;"></nav>` +
      `<div data-role="settings-list" style="padding:12px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;"></div>` +
      `</div>`;

    hostRoot.appendChild(dialog);
    this.dialogEl = dialog;

    // Reset returnValue on close + Safari fallback for `closedby="any"` light dismiss
    const onClose = (): void => {
      dialog.returnValue = '';
    };
    dialog.addEventListener('close', onClose);
    this.disposables.addFn(() => dialog.removeEventListener('close', onClose));

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
      this.disposables.addFn(() => dialog.removeEventListener('click', onBackdropClick));
    }

    const searchInput = dialog.querySelector('[data-role="settings-search"]') as HTMLInputElement | null;
    if (searchInput) {
      const onInput = (): void => {
        this.searchQuery = searchInput.value.trim().toLowerCase();
        this.renderItems();
      };
      searchInput.addEventListener('input', onInput);
      this.disposables.addFn(() => searchInput.removeEventListener('input', onInput));
    }

    const onClick = (evt: Event): void => {
      const target = (evt.target as HTMLElement | null)?.closest?.(
        '[data-settings-action],[data-settings-cat],[data-reset-key]'
      );
      if (!target) return;
      const action = target.getAttribute('data-settings-action');
      if (action === 'close') {
        this.close();
        return;
      }
      if (action === 'open-json') {
        this.close();
        this.options.onOpenSettingsJson?.();
        return;
      }
      if (action === 'export') {
        this.options.onExportSettings?.(this.config.exportProfile());
        return;
      }
      const cat = target.getAttribute('data-settings-cat') as ('All' | SettingCategory) | null;
      if (cat) {
        this.activeCategory = cat;
        this.renderCategories();
        this.renderItems();
        return;
      }
      const resetKey = target.getAttribute('data-reset-key');
      if (resetKey) {
        this.config.resetSetting(resetKey);
        this.renderItems();
      }
    };
    dialog.addEventListener('click', onClick);
    this.disposables.addFn(() => dialog.removeEventListener('click', onClick));

    const onChange = (evt: Event): void => {
      const el = evt.target as HTMLInputElement | HTMLSelectElement | null;
      if (!el) return;
      const key = el.getAttribute('data-setting-key');
      if (!key) return;
      const desc = this.config.getDescriptors().find((d) => d.key === key);
      if (!desc) return;

      if (desc.schema.type === 'boolean' && el instanceof HTMLInputElement) {
        this.config.setUserSetting(key, el.checked);
      } else if (desc.schema.type === 'integer' || desc.schema.type === 'number') {
        const num = Number(el.value);
        if (Number.isFinite(num)) {
          this.config.setUserSetting(key, desc.schema.type === 'integer' ? Math.trunc(num) : num);
        }
      } else if (desc.schema.type === 'array') {
        const items = el.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        this.config.setUserSetting(key, items);
      } else {
        this.config.setUserSetting(key, el.value);
      }
      this.renderItems();
    };
    dialog.addEventListener('change', onChange);
    this.disposables.addFn(() => dialog.removeEventListener('change', onChange));

    this.disposables.add(
      this.config.onDidChangeConfiguration(() => {
        if (this.isOpen) {
          this.renderItems();
        }
      })
    );
  }

  public get isOpen(): boolean {
    return Boolean(this.dialogEl && (this.dialogEl.open || this.dialogEl.hasAttribute('open')));
  }

  public open(): void {
    if (!this.dialogEl) return;
    this.renderCategories();
    this.renderItems();
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

  private renderCategories(): void {
    const nav = this.dialogEl?.querySelector('[data-role="settings-categories"]');
    if (!nav) return;
    nav.innerHTML = ALL_CATEGORIES.map((cat) => {
      const selected = cat === this.activeCategory;
      return (
        `<button type="button" data-settings-cat="${cat}" aria-current="${selected ? 'true' : 'false'}" ` +
        `style="text-align:left;padding:6px 10px;border-radius:5px;border:1px solid ${selected ? 'var(--cl-accent,#0284c7)' : 'transparent'};background:${selected ? 'rgba(2,132,199,0.15)' : 'transparent'};color:var(--cl-fg,#f5f5f5);cursor:pointer;font-size:12.5px;">` +
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
      return `<select data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" style="padding:5px 8px;border-radius:5px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:12.5px;">${opts}</select>`;
    }
    if (desc.schema.type === 'boolean') {
      const checked = Boolean(currentVal) ? ' checked' : '';
      return `<input type="checkbox" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}"${checked} />`;
    }
    if (desc.schema.type === 'integer' || desc.schema.type === 'number') {
      const min = desc.schema.minimum !== undefined ? ` min="${desc.schema.minimum}"` : '';
      const max = desc.schema.maximum !== undefined ? ` max="${desc.schema.maximum}"` : '';
      return `<input type="number" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(String(currentVal ?? ''))}"${min}${max} style="width:100px;padding:5px 8px;border-radius:5px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:12.5px;" />`;
    }
    if (desc.schema.type === 'array') {
      const joined = Array.isArray(currentVal) ? currentVal.join(', ') : '';
      return `<input type="text" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(joined)}" style="width:260px;padding:5px 8px;border-radius:5px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:12.5px;" />`;
    }
    return `<input type="text" data-setting-key="${keyAttr}" aria-label="${escapeAttr(desc.title)}" value="${escapeAttr(String(currentVal ?? ''))}" style="width:180px;padding:5px 8px;border-radius:5px;border:1px solid var(--cl-border,#262626);background:var(--cl-surface,#0a0a0a);color:var(--cl-fg,#f5f5f5);font-size:12.5px;" />`;
  }

  private renderItems(): void {
    const listEl = this.dialogEl?.querySelector('[data-role="settings-list"]');
    if (!listEl) return;
    const descriptors = this.config.getDescriptors().filter((d) => {
      if (this.activeCategory !== 'All' && d.category !== this.activeCategory) return false;
      if (!this.searchQuery) return true;
      const hay = `${d.key} ${d.title} ${d.description} ${d.category}`.toLowerCase();
      return hay.includes(this.searchQuery);
    });

    if (descriptors.length === 0) {
      listEl.innerHTML = `<div style="color:var(--cl-muted,#8e8e93);font-size:13px;">No matching settings found.</div>`;
      return;
    }

    listEl.innerHTML = descriptors
      .map((desc) => {
        const insp = this.config.inspect(desc.key);
        const isModified = insp.effectiveSource !== 'default';
        return (
          `<div class="cl-setting-item" data-setting-row="${escapeAttr(desc.key)}" style="padding:10px 12px;border:1px solid var(--cl-border,#262626);border-radius:7px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">` +
          `<div style="min-width:0;">` +
          `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">` +
          `<strong style="font-size:13px;">${escapeAttr(desc.title)}</strong>` +
          `<code style="font-size:11px;opacity:0.75;">${escapeAttr(desc.key)}</code>` +
          (isModified
            ? `<span style="font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(2,132,199,0.2);color:var(--cl-accent,#0284c7);">${escapeAttr(insp.effectiveSource)}</span>`
            : '') +
          `</div>` +
          `<div style="font-size:12px;color:var(--cl-muted,#8e8e93);margin-top:3px;">${escapeAttr(desc.description)}</div>` +
          `</div>` +
          `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">` +
          this.renderControl(desc, insp.effectiveValue) +
          (isModified
            ? `<button type="button" class="codelab-btn" data-reset-key="${escapeAttr(desc.key)}" title="Reset to Default (${escapeAttr(JSON.stringify(desc.defaultValue))})">Reset</button>`
            : '') +
          `</div>` +
          `</div>`
        );
      })
      .join('');
  }

  public dispose(): void {
    this.close();
    this.disposables.dispose();
    this.dialogEl?.remove();
    this.dialogEl = null;
  }
}
