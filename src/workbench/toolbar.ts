/**
 * @innovatorved/code-lab — Topbar Navigation & Contextual Execution Controls
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

export interface ToolbarRenderOptions {
  workbench: any;
  title: string;
  backLabel: string;
  hasGuidedLab: boolean;
  mode: string;
  activeFile: string | null;
  enabledLanguages: Set<string>;
  currentLang: string;
  hasWebContent: boolean;
  activeServerCount: number;
}

export function renderLanguageSwitcherHtml(workbench: any): string {
  const enabled = workbench.enabledLanguages || new Set(['js']);
  const showTs = enabled.has('ts');
  const showCpp = enabled.has('cpp');
  const showPy = enabled.has('py');

  const count = (enabled.has('js') ? 1 : 0) + (showTs ? 1 : 0) + (showCpp ? 1 : 0) + (showPy ? 1 : 0);
  if (count <= 1) return '';

  const activeLang = workbench.lang || 'js';

  return `
    <span class="codelab-toolbar__sep" aria-hidden="true"></span>
    <div class="codelab-lang-switch codelab-segmented" role="tablist" aria-label="Language">
      <button type="button" role="tab" aria-selected="${activeLang === 'js'}" class="codelab-segmented__btn ${activeLang === 'js' ? 'active' : ''}" data-cl-lang="js" title="JavaScript (Node.js &amp; Bun runtime)">JS</button>
      ${showTs ? `<button type="button" role="tab" aria-selected="${activeLang === 'ts'}" class="codelab-segmented__btn ${activeLang === 'ts' ? 'active' : ''}" data-cl-lang="ts" title="TypeScript (Instant in-browser transpile)">TS</button>` : ''}
      ${showCpp ? `<button type="button" role="tab" aria-selected="${activeLang === 'cpp'}" class="codelab-segmented__btn ${activeLang === 'cpp' ? 'active' : ''}" data-cl-lang="cpp" title="C++20 (WASI Clang/LLVM WebAssembly compiler)">C++</button>` : ''}
      ${showPy ? `<button type="button" role="tab" aria-selected="${activeLang === 'py'}" class="codelab-segmented__btn ${activeLang === 'py' ? 'active' : ''}" data-cl-lang="py" title="Python 3.12 (CPython WebAssembly via Pyodide)">PY</button>` : ''}
    </div>
  `;
}

export function renderToolbarHtml(opts: ToolbarRenderOptions): string {
  const { workbench, title, backLabel, hasGuidedLab, mode, activeFile, hasWebContent, activeServerCount } = opts;
  const isGuided = Boolean(hasGuidedLab && mode === 'guided');
  const brandLabel = escapeHtml(title || 'code-lab');
  const safeBackLabel = escapeHtml(backLabel);
  const safeActiveFile = escapeHtml(activeFile || 'active');

  const testFileExists = Boolean(
    workbench._findEntryFile && workbench._findEntryFile('test') !== null
  );

  return `
    <div class="codelab-topbar codelab-toolbar">
      <div class="codelab-topbar__left">
        ${workbench.onClose ? `
          <button type="button" class="codelab-btn codelab-btn--back" data-cl-action="close-lab" title="${safeBackLabel}">
            ${CL_ICONS.arrowLeft}
            <span>${safeBackLabel}</span>
          </button>
        ` : ''}
        <span class="codelab-brand ${workbench.onClose ? 'codelab-brand--with-back' : ''}" title="${brandLabel}">
          <span class="codelab-brand__dot"></span>
          <span>${brandLabel}</span>
        </span>

        ${hasGuidedLab ? `
        <span class="codelab-toolbar__sep" aria-hidden="true"></span>
        <div class="codelab-mode-switch" role="tablist" aria-label="Lab Mode">
          <button type="button" role="tab" aria-selected="${mode === 'guided'}" class="codelab-mode-btn ${mode === 'guided' ? 'active' : ''}" data-cl-mode="guided">
            ${CL_ICONS.target}
            <span>Guided Challenge</span>
          </button>
          <button type="button" role="tab" aria-selected="${mode === 'sandbox'}" class="codelab-mode-btn ${mode === 'sandbox' ? 'active' : ''}" data-cl-mode="sandbox">
            ${CL_ICONS.code}
            <span>Reference Sandbox</span>
          </button>
        </div>
        ` : ''}

        ${renderLanguageSwitcherHtml(workbench)}

        <span class="codelab-toolbar__sep" aria-hidden="true"></span>
        <button type="button" class="codelab-cmd-trigger" data-cl-action="command-palette" title="Open Command Palette (⌘K / ⇧⌘P)">
          ${CL_ICONS.search}
          <span>Command Palette</span>
          <kbd style="opacity:0.7">⇧⌘P</kbd>
        </button>
      </div>

      <div class="codelab-topbar__right">
        <button type="button" class="codelab-btn codelab-btn--stop" id="cl-stop-btn" data-cl-action="stop-run" title="Stop Running Execution" style="display:none">
          ${CL_ICONS.stop}
          <span>Stop</span>
        </button>

        ${isGuided ? `
          <button type="button" class="codelab-btn codelab-btn--run" data-cl-action="run-demo" title="Run Demo Script (⇧⌘↵)">
            ${CL_ICONS.play}
            <span>Run Demo</span>
            <span class="codelab-btn__kbd">⇧⌘↵</span>
          </button>
          <button type="button" class="codelab-btn codelab-btn--test" id="cl-primary-exec-btn" data-cl-action="verify-step" title="Verify Current Step (⌘↵)">
            ${CL_ICONS.check}
            <span>Verify Step</span>
            <span class="codelab-btn__kbd">⌘↵</span>
          </button>
        ` : `
          <div class="codelab-btn-split">
            <button type="button" class="codelab-btn codelab-btn--run codelab-btn-split__main" data-cl-action="run-code" title="Run Code (⌘↵)">
              ${CL_ICONS.play}
              <span>Run Code</span>
              <span class="codelab-btn__kbd">⌘↵</span>
            </button>
            <button type="button" class="codelab-btn codelab-btn--run codelab-btn-split__trigger" id="cl-split-run-trigger" title="More Execution Options" aria-haspopup="true">
              ${CL_ICONS.chevronDown}
            </button>
            <div class="codelab-split-menu" id="cl-split-run-menu">
              <button type="button" class="codelab-split-menu__item" data-cl-action="run-entry">
                <span>▶ Run Entry / Demo</span> <kbd style="opacity:0.6">⌘↵</kbd>
              </button>
              <button type="button" class="codelab-split-menu__item" data-cl-action="run-active-file">
                <span>▶ Run Active File (${safeActiveFile})</span> <kbd style="opacity:0.6">⇧⌘↵</kbd>
              </button>
              ${testFileExists ? `
              <button type="button" class="codelab-split-menu__item" data-cl-action="run-tests">
                <span>✓ Run Test Suite</span>
              </button>
              ` : ''}
              <button type="button" class="codelab-split-menu__item" data-cl-action="open-stdin">
                <span>⌨ Configure Stdin / Input...</span>
              </button>
            </div>
          </div>
        `}

        ${hasWebContent ? `
          <button type="button" class="codelab-btn codelab-btn--icon" id="cl-preview-app-btn" data-cl-action="preview-app" title="Run &amp; Preview in Browser" aria-label="Run and Preview in Browser">
            ${CL_ICONS.globe}
            ${activeServerCount > 0 ? `<span class="codelab-port-badge" style="position:absolute;top:2px;right:2px;font-size:9px;background:#007acc;color:#fff;border-radius:6px;padding:0 3px;">${activeServerCount}</span>` : ''}
          </button>
        ` : ''}

        <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="share-snapshot" title="Share Snapshot Link (#codelab=...)" aria-label="Share Snapshot Link">
          ${CL_ICONS.share}
        </button>

        <span class="codelab-toolbar__sep" aria-hidden="true"></span>

        ${hasGuidedLab ? `
        <button type="button" class="codelab-btn codelab-btn--icon" id="cl-toggle-guide-btn" data-cl-action="toggle-guide" title="Toggle Guide Panel" aria-label="Toggle Guide Panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
        </button>
        ` : ''}

        <button type="button" class="codelab-btn codelab-btn--icon" id="cl-toggle-drawer-btn" data-cl-action="toggle-drawer" title="Toggle Bottom Drawer" aria-label="Toggle Bottom Drawer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/></svg>
        </button>

        <button type="button" class="codelab-btn codelab-btn--icon" id="cl-fullscreen-btn" data-cl-action="toggle-fullscreen" title="Toggle Fullscreen IDE (Esc to exit)" aria-label="Toggle Fullscreen IDE">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>

        ${workbench.onClose ? `
          <button type="button" class="codelab-btn codelab-btn--exit-lab codelab-btn--close-ide" id="cl-close-ide-btn" data-cl-action="close-lab" title="Exit Lab" aria-label="Exit Lab">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span class="codelab-btn__label">Exit</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}
