/**
 * @innovatorved/code-lab — Inline Monaco Side-by-Side Diff Editor & Fallback Unified Diff
 */

import { CL_ICONS } from './icons';
import { getMonacoLanguageForFile, getMonacoThemeName } from './intellisense';

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface DiffComputeResult {
  hunks: Array<{ type: 'context' | 'add' | 'del'; text: string; oldLine: number | null; newLine: number | null }>;
  added: number;
  removed: number;
}

export interface GitDiffOpenOptions {
  staged?: boolean;
  originalText: string;
  modifiedText: string;
  label?: string;
  onStage?: () => void | Promise<void>;
  onUnstage?: () => void | Promise<void>;
  onDiscard?: () => void | Promise<void>;
}

export function computeSimpleDiff(oldText: string, newText: string): DiffComputeResult {
  const oldLines = String(oldText || '').split('\n');
  const newLines = String(newText || '').split('\n');
  const hunks: Array<{ type: 'context' | 'add' | 'del'; text: string; oldLine: number | null; newLine: number | null }> = [];
  let added = 0;
  let removed = 0;

  const m = oldLines.length;
  const n = newLines.length;
  let i = 0;
  let j = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      hunks.push({ type: 'context', text: oldLines[i], oldLine: oldLineNum++, newLine: newLineNum++ });
      i++;
      j++;
    } else {
      let matchIdx = -1;
      for (let k = j + 1; k < Math.min(n, j + 5); k++) {
        if (newLines[k] === oldLines[i]) {
          matchIdx = k;
          break;
        }
      }
      if (matchIdx !== -1) {
        while (j < matchIdx) {
          hunks.push({ type: 'add', text: newLines[j++], oldLine: null, newLine: newLineNum++ });
          added++;
        }
      } else {
        hunks.push({ type: 'del', text: oldLines[i++], oldLine: oldLineNum++, newLine: null });
        removed++;
      }
    }
  }

  while (i < m) {
    hunks.push({ type: 'del', text: oldLines[i++], oldLine: oldLineNum++, newLine: null });
    removed++;
  }
  while (j < n) {
    hunks.push({ type: 'add', text: newLines[j++], oldLine: null, newLine: newLineNum++ });
    added++;
  }

  return { hunks, added, removed };
}

function renderFallbackUnifiedDiffHtml(oldText: string, newText: string): string {
  const diff = computeSimpleDiff(oldText, newText);
  if (diff.added === 0 && diff.removed === 0) {
    return `<div class="codelab-diff-empty">No textual changes between versions.</div>`;
  }
  const rows = diff.hunks.map((h) => {
    const cls = h.type === 'add' ? 'is-add' : h.type === 'del' ? 'is-del' : 'is-ctx';
    const prefix = h.type === 'add' ? '+' : h.type === 'del' ? '-' : ' ';
    const oldNum = h.oldLine !== null ? String(h.oldLine) : '';
    const newNum = h.newLine !== null ? String(h.newLine) : '';
    return `<div class="codelab-diff-fallback-row ${cls}">` +
      `<span class="codelab-diff-ln">${oldNum}</span>` +
      `<span class="codelab-diff-ln">${newNum}</span>` +
      `<span class="codelab-diff-sign">${prefix}</span>` +
      `<span class="codelab-diff-code">${escapeHtml(h.text)}</span>` +
      `</div>`;
  }).join('');
  return `<div class="codelab-diff-fallback" role="region" aria-label="Unified diff view">${rows}</div>`;
}

export class CodeLabDiffEditorManager {
  private workbench: any;
  private diffEditor: any = null;
  private originalModel: any = null;
  private modifiedModel: any = null;
  public isActive = false;
  public activeFile = '';
  public currentTarget: 'starter' | 'solution' | 'git' = 'solution';

  constructor(workbench: any) {
    this.workbench = workbench;
  }

  private _ensureDiffContainer(): { diffContainer: any; editorHost: any; fallbackTextarea: any } | null {
    const editorHost = this.workbench.container?.querySelector('#cl-editor-host')
      || this.workbench.container?.querySelector('#cl-monaco-host');
    const fallbackTextarea = this.workbench.container?.querySelector('#cl-fallback-editor');
    if (!editorHost) return null;

    let diffContainer = this.workbench.container.querySelector('#cl-inline-diff-container');
    if (!diffContainer) {
      diffContainer = document.createElement('div');
      diffContainer.id = 'cl-inline-diff-container';
      diffContainer.className = 'codelab-diff-container';
      editorHost.parentElement.appendChild(diffContainer);
    }

    const welcomeHost = this.workbench.container?.querySelector('#cl-welcome-host');
    if (welcomeHost) welcomeHost.style.display = 'none';

    diffContainer.hidden = false;
    diffContainer.style.display = 'flex';
    editorHost.style.display = 'none';
    if (fallbackTextarea) fallbackTextarea.style.display = 'none';

    this._disposeEditorModels();
    return { diffContainer, editorHost, fallbackTextarea };
  }

  private _disposeEditorModels(): void {
    if (this.diffEditor) {
      try { this.diffEditor.dispose(); } catch (_err) { void _err; }
      this.diffEditor = null;
    }
    if (this.originalModel) {
      try { this.originalModel.dispose(); } catch (_err) { void _err; }
      this.originalModel = null;
    }
    if (this.modifiedModel) {
      try { this.modifiedModel.dispose(); } catch (_err) { void _err; }
      this.modifiedModel = null;
    }
  }

  /**
   * Opens a VS Code Source Control side-by-side diff (`Working Tree` or `Index` vs `HEAD`).
   */
  public openGitDiff(file: string, opts: GitDiffOpenOptions): boolean {
    const monaco = typeof window !== 'undefined' ? (window as any).monaco : null;
    const hosts = this._ensureDiffContainer();
    if (!hosts) return false;

    const { diffContainer } = hosts;
    this.isActive = true;
    this.activeFile = file;
    this.currentTarget = 'git';

    const staged = Boolean(opts.staged);
    const titleLabel = opts.label || (staged ? `${file} (Index ↔ HEAD)` : `${file} (Working Tree)`);
    const safeTitle = escapeHtml(titleLabel);

    diffContainer.innerHTML = `
      <div class="codelab-diff-toolbar">
        <span class="codelab-diff-toolbar__title">
          ${CL_ICONS.diff}
          <span>${safeTitle}</span>
        </span>
        <div class="codelab-diff-toolbar__actions">
          ${staged
            ? (opts.onUnstage ? `<button type="button" class="codelab-btn codelab-btn--sm" id="cl-git-diff-unstage-btn" title="Unstage Changes">${CL_ICONS.minus || '−'} Unstage</button>` : '')
            : `${opts.onDiscard ? `<button type="button" class="codelab-btn codelab-btn--sm" id="cl-git-diff-discard-btn" title="Discard Changes">${CL_ICONS.discard || CL_ICONS.refresh} Discard</button>` : ''}
               ${opts.onStage ? `<button type="button" class="codelab-btn codelab-btn--sm codelab-btn--primary" id="cl-git-diff-stage-btn" title="Stage Changes">${CL_ICONS.plus || '+'} Stage</button>` : ''}`
          }
          <button type="button" class="codelab-btn codelab-btn--sm" id="cl-git-diff-open-file-btn" title="Open File">Open File</button>
          <button type="button" class="codelab-btn codelab-btn--sm" id="cl-diff-close-btn" title="Close Diff (Esc)">${CL_ICONS.x}</button>
        </div>
      </div>
      <div class="codelab-diff-host" id="cl-diff-editor-slot"></div>
    `;

    const slot = diffContainer.querySelector('#cl-diff-editor-slot');
    if (monaco?.editor && typeof monaco.editor.createDiffEditor === 'function' && slot) {
      const resolvedTheme = typeof this.workbench._resolvedTheme === 'function'
        ? this.workbench._resolvedTheme()
        : this.workbench.theme;
      const monacoTheme = getMonacoThemeName(resolvedTheme, monaco);
      const lang = getMonacoLanguageForFile(file, this.workbench.lang);

      this.diffEditor = monaco.editor.createDiffEditor(slot, {
        readOnly: staged,
        originalEditable: false,
        theme: monacoTheme,
        renderSideBySide: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: Number(this.workbench._editorFontSize) || 13
      });

      this.originalModel = monaco.editor.createModel(String(opts.originalText ?? ''), lang);
      this.modifiedModel = monaco.editor.createModel(String(opts.modifiedText ?? ''), lang);
      this.diffEditor.setModel({
        original: this.originalModel,
        modified: this.modifiedModel
      });

      if (!staged) {
        this.modifiedModel.onDidChangeContent(() => {
          this.syncFileToWorkbench(file, this.modifiedModel.getValue());
        });
      }
    } else if (slot) {
      slot.innerHTML = renderFallbackUnifiedDiffHtml(opts.originalText, opts.modifiedText);
    }

    diffContainer.querySelector('#cl-git-diff-stage-btn')?.addEventListener('click', async () => {
      await opts.onStage?.();
      this.closeInlineDiff();
    });
    diffContainer.querySelector('#cl-git-diff-unstage-btn')?.addEventListener('click', async () => {
      await opts.onUnstage?.();
      this.closeInlineDiff();
    });
    diffContainer.querySelector('#cl-git-diff-discard-btn')?.addEventListener('click', async () => {
      await opts.onDiscard?.();
      this.closeInlineDiff();
    });
    diffContainer.querySelector('#cl-git-diff-open-file-btn')?.addEventListener('click', () => {
      this.closeInlineDiff();
      if (typeof this.workbench.openFile === 'function') {
        this.workbench.openFile(file);
      }
    });
    diffContainer.querySelector('#cl-diff-close-btn')?.addEventListener('click', () => {
      this.closeInlineDiff();
    });

    return true;
  }

  /**
   * Mounts a side-by-side (or inline) Monaco DiffEditor directly into an existing slot element
   * without overwriting the surrounding `.codelab-scm-diff-header` toolbar.
   */
  public mountMonacoDiffIntoSlot(
    slotEl: HTMLElement,
    opts: {
      relPath: string;
      originalContent: string;
      modifiedContent: string;
      sideBySide?: boolean;
      readOnly?: boolean;
    }
  ): boolean {
    const monaco = this.workbench?.monaco || (typeof window !== 'undefined' ? (window as any).monaco : null);
    if (!slotEl || !monaco?.editor || typeof monaco.editor.createDiffEditor !== 'function') {
      return false;
    }
    this._disposeEditorModels();
    this.isActive = true;
    this.activeFile = opts.relPath;
    this.currentTarget = 'git';

    const resolvedTheme = typeof this.workbench?._resolvedTheme === 'function'
      ? this.workbench._resolvedTheme()
      : (this.workbench?.theme || 'dark');
    const monacoTheme = getMonacoThemeName(resolvedTheme, monaco);
    const lang = getMonacoLanguageForFile(opts.relPath, this.workbench?.lang);

    slotEl.innerHTML = '';
    this.diffEditor = monaco.editor.createDiffEditor(slotEl, {
      readOnly: opts.readOnly !== false,
      originalEditable: false,
      theme: monacoTheme,
      renderSideBySide: opts.sideBySide !== false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: Number(this.workbench?._editorFontSize) || 13
    });

    this.originalModel = monaco.editor.createModel(String(opts.originalContent ?? ''), lang);
    this.modifiedModel = monaco.editor.createModel(String(opts.modifiedContent ?? ''), lang);
    this.diffEditor.setModel({
      original: this.originalModel,
      modified: this.modifiedModel
    });
    return true;
  }

  public openInlineDiff(file: string, target: 'starter' | 'solution' = 'solution'): boolean {
    const monaco = typeof window !== 'undefined' ? (window as any).monaco : null;
    this.activeFile = file;
    this.currentTarget = target;

    const editorHost = this.workbench.container?.querySelector('#cl-editor-host') || this.workbench.container?.querySelector('#cl-monaco-host');
    const fallbackTextarea = this.workbench.container?.querySelector('#cl-fallback-editor');
    if (!editorHost) return false;

    const isStarter = target === 'starter';
    const baseFiles = this.workbench._getBaseFilesForModeAndLang
      ? this.workbench._getBaseFilesForModeAndLang(isStarter ? 'guided' : 'sandbox', this.workbench.lang)
      : (isStarter ? (this.workbench.starterFiles || {}) : (this.workbench.solutionFiles || {}));

    const refCode = baseFiles[file] !== undefined ? baseFiles[file] : '';
    const currentCode = this.workbench.files[file] !== undefined ? this.workbench.files[file] : '';

    if (!monaco || !monaco.editor || typeof monaco.editor.createDiffEditor !== 'function') {
      if (typeof this.workbench.showDiffModalFallback === 'function') {
        this.workbench.showDiffModalFallback(file, target);
      }
      return false;
    }

    const hosts = this._ensureDiffContainer();
    if (!hosts) return false;
    const { diffContainer } = hosts;
    this.isActive = true;

    const safeFile = escapeHtml(file);
    diffContainer.innerHTML = `
      <div class="codelab-diff-toolbar">
        <span class="codelab-diff-toolbar__title">
          ${CL_ICONS.diff}
          <span>Diff: <code>${safeFile}</code> (${isStarter ? 'Current vs Starter' : 'Current vs Solution'})</span>
        </span>
        <div class="codelab-segmented" style="margin-left:12px;">
          <button type="button" class="codelab-segmented__btn ${target === 'starter' ? 'active' : ''}" id="cl-diff-toggle-starter">Starter</button>
          <button type="button" class="codelab-segmented__btn ${target === 'solution' ? 'active' : ''}" id="cl-diff-toggle-solution">Solution</button>
        </div>
        <div class="codelab-diff-toolbar__actions">
          <button type="button" class="codelab-btn codelab-btn--sm" id="cl-diff-revert-btn">${CL_ICONS.refresh} Revert File</button>
          <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--primary" id="cl-diff-apply-btn">${CL_ICONS.check} Apply Solution</button>
          <button type="button" class="codelab-btn codelab-btn--sm" id="cl-diff-close-btn">${CL_ICONS.x} Close Diff</button>
        </div>
      </div>
      <div class="codelab-diff-host" id="cl-diff-editor-slot"></div>
    `;

    const slot = diffContainer.querySelector('#cl-diff-editor-slot');
    const resolvedTheme = typeof this.workbench._resolvedTheme === 'function'
      ? this.workbench._resolvedTheme()
      : this.workbench.theme;
    const monacoTheme = getMonacoThemeName(resolvedTheme, monaco);
    this.diffEditor = monaco.editor.createDiffEditor(slot, {
      readOnly: false,
      originalEditable: false,
      theme: monacoTheme,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: Number(this.workbench._editorFontSize) || 13
    });

    const lang = getMonacoLanguageForFile(file, this.workbench.lang);
    this.originalModel = monaco.editor.createModel(refCode, lang);
    this.modifiedModel = monaco.editor.createModel(currentCode, lang);

    this.diffEditor.setModel({
      original: this.originalModel,
      modified: this.modifiedModel
    });

    this.modifiedModel.onDidChangeContent(() => {
      this.syncFileToWorkbench(file, this.modifiedModel.getValue());
    });

    diffContainer.querySelector('#cl-diff-toggle-starter')?.addEventListener('click', () => {
      this.openInlineDiff(file, 'starter');
    });
    diffContainer.querySelector('#cl-diff-toggle-solution')?.addEventListener('click', () => {
      this.openInlineDiff(file, 'solution');
    });
    diffContainer.querySelector('#cl-diff-revert-btn')?.addEventListener('click', () => {
      const starterMap = this.workbench.starterFiles || (typeof this.workbench._getBaseFilesForModeAndLang === 'function' ? this.workbench._getBaseFilesForModeAndLang('guided', this.workbench.lang) : {});
      const starterCode = (starterMap && starterMap[file]) || '';
      if (typeof this.workbench.setFile === 'function') {
        this.workbench.setFile(file, starterCode);
      } else {
        this.syncFileToWorkbench(file, starterCode);
      }
      this.closeInlineDiff();
      this.workbench.openFile(file);
    });
    diffContainer.querySelector('#cl-diff-apply-btn')?.addEventListener('click', () => {
      if (typeof this.workbench.applyReferenceSolution === 'function') {
        this.closeInlineDiff();
        this.workbench.applyReferenceSolution();
        return;
      }
      const solutionMap = this.workbench.solutionFiles || (typeof this.workbench._getBaseFilesForModeAndLang === 'function' ? this.workbench._getBaseFilesForModeAndLang('sandbox', this.workbench.lang) : {});
      const solutionCode = (solutionMap && solutionMap[file]) || '';
      if (typeof this.workbench.setFile === 'function') {
        this.workbench.setFile(file, solutionCode);
      } else {
        this.syncFileToWorkbench(file, solutionCode);
      }
      this.closeInlineDiff();
      this.workbench.openFile(file);
    });
    diffContainer.querySelector('#cl-diff-close-btn')?.addEventListener('click', () => {
      this.closeInlineDiff();
    });

    return true;
  }

  public syncFileToWorkbench(file: string, nextVal: string): void {
    this.workbench.files[file] = nextVal;
    const mainModel = this.workbench.models instanceof Map ? this.workbench.models.get(file) : null;
    if (mainModel && typeof mainModel.getValue === 'function' && mainModel.getValue() !== nextVal) {
      mainModel.setValue(nextVal);
    }
    const fallbackEl = this.workbench.container?.querySelector('#cl-fallback-editor');
    if (fallbackEl && this.workbench.activeFile === file) {
      fallbackEl.value = nextVal;
    }
    if (this.workbench.shell?.vfs && typeof this.workbench.shell.vfs.writeFileSync === 'function') {
      try {
        this.workbench.shell.vfs.writeFileSync('/workspace/' + String(file).replace(/^\/+/, ''), nextVal);
      } catch (err) {
        if (this.workbench.logger && typeof this.workbench.logger.debug === 'function') {
          this.workbench.logger.debug('Diff VFS sync skipped.', err);
        }
      }
    }
    if (typeof this.workbench._saveState === 'function') {
      this.workbench._saveState();
    }
    if (typeof this.workbench._markDirty === 'function') {
      this.workbench._markDirty(file);
    }
    if (typeof this.workbench._refreshGitDecorations === 'function') {
      this.workbench._refreshGitDecorations();
    }
  }

  public closeInlineDiff(): void {
    this.isActive = false;
    const diffContainer = this.workbench.container?.querySelector('#cl-inline-diff-container');
    if (diffContainer) {
      diffContainer.hidden = true;
      diffContainer.style.display = 'none';
    }
    const isWelcomeActive = this.workbench.activeFile === '__welcome__';
    const welcomeHost = this.workbench.container?.querySelector('#cl-welcome-host');
    const editorHost = this.workbench.container?.querySelector('#cl-editor-host') || this.workbench.container?.querySelector('#cl-monaco-host');
    if (isWelcomeActive && welcomeHost) {
      welcomeHost.style.display = 'flex';
    } else if (editorHost) {
      editorHost.style.display = '';
    }
    this._disposeEditorModels();
  }
}
