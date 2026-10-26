/**
 * @innovatorved/code-lab — Inline Monaco Side-by-Side Diff Editor & Fallback Unified Diff
 */

import { CL_ICONS } from './icons';

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

export class CodeLabDiffEditorManager {
  private workbench: any;
  private diffEditor: any = null;
  private originalModel: any = null;
  private modifiedModel: any = null;
  public isActive = false;
  public activeFile = '';
  public currentTarget: 'starter' | 'solution' = 'solution';

  constructor(workbench: any) {
    this.workbench = workbench;
  }

  public openInlineDiff(file: string, target: 'starter' | 'solution' = 'solution'): boolean {
    const monaco = typeof window !== 'undefined' ? (window as any).monaco : null;
    this.activeFile = file;
    this.currentTarget = target;

    const editorHost = this.workbench.container?.querySelector('#cl-editor-host') || this.workbench.container?.querySelector('#cl-monaco-host');
    const fallbackTextarea = this.workbench.container?.querySelector('#cl-fallback-editor');
    if (!editorHost) return false;

    // Get reference code
    const isStarter = target === 'starter';
    const baseFiles = this.workbench._getBaseFilesForModeAndLang
      ? this.workbench._getBaseFilesForModeAndLang(isStarter ? 'guided' : 'sandbox', this.workbench.lang)
      : (isStarter ? (this.workbench.starterFiles || {}) : (this.workbench.solutionFiles || {}));

    const refCode = baseFiles[file] !== undefined ? baseFiles[file] : '';
    const currentCode = this.workbench.files[file] !== undefined ? this.workbench.files[file] : '';

    if (!monaco || !monaco.editor || typeof monaco.editor.createDiffEditor !== 'function') {
      // Fall back to modal diff if Monaco or createDiffEditor is not available
      if (typeof this.workbench.showDiffModalFallback === 'function') {
        this.workbench.showDiffModalFallback(file, target);
      }
      return false;
    }

    this.isActive = true;

    // Create or reuse diff container
    let diffContainer = this.workbench.container.querySelector('#cl-inline-diff-container');
    if (!diffContainer) {
      diffContainer = document.createElement('div');
      diffContainer.id = 'cl-inline-diff-container';
      diffContainer.className = 'codelab-diff-container';
      editorHost.parentElement.appendChild(diffContainer);
    }

    diffContainer.style.display = 'flex';
    if (editorHost) editorHost.style.display = 'none';
    if (fallbackTextarea) fallbackTextarea.style.display = 'none';

    if (this.diffEditor) {
      this.diffEditor.dispose();
      this.diffEditor = null;
    }
    if (this.originalModel) {
      this.originalModel.dispose();
      this.originalModel = null;
    }
    if (this.modifiedModel) {
      this.modifiedModel.dispose();
      this.modifiedModel = null;
    }

    const safeFile = escapeHtml(file);
    diffContainer.innerHTML = `
      <div class="codelab-diff-toolbar">
        <span style="font-weight:600;display:inline-flex;align-items:center;gap:6px;">
          ${CL_ICONS.diff}
          <span>Diff: <code>${safeFile}</code> (${isStarter ? 'Current vs Starter' : 'Current vs Solution'})</span>
        </span>
        <div class="codelab-segmented" style="margin-left:16px;">
          <button type="button" class="codelab-segmented__btn ${target === 'starter' ? 'active' : ''}" id="cl-diff-toggle-starter">Starter</button>
          <button type="button" class="codelab-segmented__btn ${target === 'solution' ? 'active' : ''}" id="cl-diff-toggle-solution">Solution</button>
        </div>
        <div style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;">
          <button type="button" class="codelab-btn codelab-btn--sm" id="cl-diff-revert-btn">${CL_ICONS.refresh} Revert File</button>
          <button type="button" class="codelab-btn codelab-btn--sm codelab-btn--primary" id="cl-diff-apply-btn">${CL_ICONS.check} Apply Solution</button>
          <button type="button" class="codelab-btn codelab-btn--sm" id="cl-diff-close-btn">${CL_ICONS.x} Close Diff</button>
        </div>
      </div>
      <div class="codelab-diff-host" id="cl-diff-editor-slot"></div>
    `;

    const slot = diffContainer.querySelector('#cl-diff-editor-slot');
    this.diffEditor = monaco.editor.createDiffEditor(slot, {
      readOnly: false,
      originalEditable: false,
      theme: this.workbench.theme === 'light' ? 'vs' : 'vs-dark',
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false }
    });

    const lang = file.endsWith('.ts') ? 'typescript' : file.endsWith('.cpp') ? 'cpp' : file.endsWith('.py') ? 'python' : 'javascript';
    this.originalModel = monaco.editor.createModel(refCode, lang);
    this.modifiedModel = monaco.editor.createModel(currentCode, lang);

    this.diffEditor.setModel({
      original: this.originalModel,
      modified: this.modifiedModel
    });

    // Wire modified model edits back to workbench
    this.modifiedModel.onDidChangeContent(() => {
      const val = this.modifiedModel.getValue();
      this.workbench.files[file] = val;
      if (typeof this.workbench._markDirty === 'function') {
        this.workbench._markDirty(file);
      }
    });

    // Wire buttons
    diffContainer.querySelector('#cl-diff-toggle-starter')?.addEventListener('click', () => {
      this.openInlineDiff(file, 'starter');
    });
    diffContainer.querySelector('#cl-diff-toggle-solution')?.addEventListener('click', () => {
      this.openInlineDiff(file, 'solution');
    });
    diffContainer.querySelector('#cl-diff-revert-btn')?.addEventListener('click', () => {
      const starterMap = this.workbench.starterFiles || (typeof this.workbench._getBaseFilesForModeAndLang === 'function' ? this.workbench._getBaseFilesForModeAndLang('guided', this.workbench.lang) : {});
      const starterCode = (starterMap && starterMap[file]) || '';
      this.workbench.files[file] = starterCode;
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
      this.workbench.files[file] = solutionCode;
      this.closeInlineDiff();
      this.workbench.openFile(file);
    });
    diffContainer.querySelector('#cl-diff-close-btn')?.addEventListener('click', () => {
      this.closeInlineDiff();
    });

    return true;
  }

  public closeInlineDiff(): void {
    this.isActive = false;
    const diffContainer = this.workbench.container?.querySelector('#cl-inline-diff-container');
    if (diffContainer) {
      diffContainer.style.display = 'none';
    }
    const editorHost = this.workbench.container?.querySelector('#cl-editor-host') || this.workbench.container?.querySelector('#cl-monaco-host');
    if (editorHost) {
      editorHost.style.display = '';
    }
    if (this.diffEditor) {
      this.diffEditor.dispose();
      this.diffEditor = null;
    }
    if (this.originalModel) {
      this.originalModel.dispose();
      this.originalModel = null;
    }
    if (this.modifiedModel) {
      this.modifiedModel.dispose();
      this.modifiedModel = null;
    }
  }
}
