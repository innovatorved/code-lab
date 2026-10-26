/**
 * @innovatorved/code-lab — Resizable Bottom Drawer, Contextual Tabs & Telemetry HUD
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

export interface DrawerTabOptions {
  workbench: any;
  drawerTab: string;
  hasGuidedLab: boolean;
  mode: string;
  hasWebContent: boolean;
  problemsCount: number;
  testSuiteVisible: boolean;
  lastDurationMs: number | null;
  lastPeakMemoryBytes: number | null;
}

export function formatTelemetryHud(durationMs: number | null, memoryBytes: number | null, lang: string): string {
  if (durationMs === null && memoryBytes === null) return '';

  const timeStr = durationMs !== null
    ? (durationMs < 1000 ? `${durationMs.toFixed(1)} ms` : `${(durationMs / 1000).toFixed(2)} s`)
    : '';

  let memStr = '';
  if (memoryBytes !== null && memoryBytes > 0) {
    const mb = memoryBytes / (1024 * 1024);
    const suffix = lang === 'cpp' ? 'Wasm' : lang === 'py' ? 'Heap' : 'Mem';
    memStr = `${mb < 0.1 ? (memoryBytes / 1024).toFixed(1) + ' KB' : mb.toFixed(1) + ' MB'} ${suffix}`;
  }

  return `
    <div class="codelab-hud-pill" id="cl-telemetry-hud" title="Last Execution Telemetry">
      ${timeStr ? `<span class="codelab-hud-pill__metric">${CL_ICONS.clock} <span>${timeStr}</span></span>` : ''}
      ${timeStr && memStr ? `<span style="opacity:0.4;">·</span>` : ''}
      ${memStr ? `<span class="codelab-hud-pill__metric">${CL_ICONS.memory} <span>${memStr}</span></span>` : ''}
    </div>
  `;
}

export function renderDrawerTabsHtml(opts: DrawerTabOptions): string {
  const { workbench, drawerTab, hasGuidedLab, mode, hasWebContent, problemsCount, testSuiteVisible, lastDurationMs, lastPeakMemoryBytes } = opts;
  const isGuided = Boolean(hasGuidedLab && mode === 'guided');
  const showTests = isGuided || testSuiteVisible || drawerTab === 'tests';

  return `
    <div class="codelab-drawer__header">
      <div class="codelab-drawer__tabs" role="tablist" aria-label="Terminal &amp; Diagnostics Panels">
        <button type="button" role="tab" aria-selected="${drawerTab === 'terminal'}" class="codelab-drawer__tab ${drawerTab === 'terminal' ? 'active' : ''}" data-cl-drawertab="terminal">
          ${CL_ICONS.terminal}
          <span>Terminal &amp; REPL</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'problems'}" class="codelab-drawer__tab ${drawerTab === 'problems' ? 'active' : ''}" data-cl-drawertab="problems" title="Compiler &amp; Runtime Problems">
          ${CL_ICONS.warning}
          <span>Problems</span>
          <span class="codelab-badge ${problemsCount > 0 ? 'codelab-badge--warn' : ''}" id="cl-problems-count" style="margin-left:4px;font-size:10px;padding:1px 5px;border-radius:10px;background:${problemsCount > 0 ? '#cca700' : 'rgba(255,255,255,0.1)'};color:#fff;">${problemsCount}</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'tests'}" class="codelab-drawer__tab ${drawerTab === 'tests' ? 'active' : ''}" data-cl-drawertab="tests">
          ${CL_ICONS.check}
          <span>Test Suite</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'stdin'}" class="codelab-drawer__tab ${drawerTab === 'stdin' ? 'active' : ''}" data-cl-drawertab="stdin" title="Standard Input / Competitive Programming Custom Input">
          ${CL_ICONS.keyboard}
          <span>Stdin</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'ports'}" class="codelab-drawer__tab ${drawerTab === 'ports' ? 'active' : ''}" data-cl-drawertab="ports">
          ${CL_ICONS.radio}
          <span>Ports</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'preview'}" class="codelab-drawer__tab ${drawerTab === 'preview' ? 'active' : ''}" data-cl-drawertab="preview" title="In-browser Web Preview">
          ${CL_ICONS.externalLink || CL_ICONS.globe}
          <span>Web Preview</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'network'}" class="codelab-drawer__tab ${drawerTab === 'network' ? 'active' : ''}" data-cl-drawertab="network">
          ${CL_ICONS.activity}
          <span>Network</span>
        </button>

        <button type="button" role="tab" aria-selected="${drawerTab === 'inspector'}" class="codelab-drawer__tab ${drawerTab === 'inspector' ? 'active' : ''}" data-cl-drawertab="inspector">
          ${CL_ICONS.database}
          <span>Virtual Disk &amp; HTTP</span>
        </button>
      </div>

      ${formatTelemetryHud(lastDurationMs, lastPeakMemoryBytes, workbench.lang || 'js')}

      <div class="codelab-drawer__actions" style="margin-left:8px;">
        <button type="button" class="codelab-btn codelab-btn--icon" data-cl-action="toggle-drawer" title="Minimize/Expand Drawer" aria-label="Minimize or Expand Drawer" style="padding:2px 6px;font-size:11px;">
          ${CL_ICONS.chevronsUpDown}
        </button>
      </div>
    </div>
  `;
}

export function renderProblemsPanelHtml(workbench: any): string {
  const store = workbench._diagnosticsStore;
  const items = store ? store.getAll() : [];

  if (items.length === 0) {
    return `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--cl-fg-muted, #858585);font-size:12px;gap:8px;">
        ${CL_ICONS.check}
        <span>No problems detected in workspace.</span>
      </div>
    `;
  }

  return `
    <div class="codelab-problems-list">
      ${items.map((item: any) => {
        const icon = item.severity === 'error' ? '✗' : (item.severity === 'warning' ? '⚠' : 'ℹ');
        const cls = item.severity === 'error' ? 'codelab-problem-item--error' : (item.severity === 'warning' ? 'codelab-problem-item--warning' : 'codelab-problem-item--info');
        const safeFile = escapeHtml(item.file);
        const safeMsg = escapeHtml(item.message);
        const safeLine = Number(item.line) || 1;
        const safeCol = Number(item.col) || 1;
        return `
          <div class="codelab-problem-item ${cls}" data-cl-problem-file="${safeFile}" data-cl-problem-line="${safeLine}" data-cl-problem-col="${safeCol}">
            <span style="font-weight:bold;">${icon}</span>
            <span>${safeMsg}</span>
            <span class="codelab-problem-item__location">${safeFile}:${safeLine}:${safeCol}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderStdinPanelHtml(workbench: any): string {
  const val = escapeHtml(workbench.customStdin || '');
  return `
    <div class="codelab-stdin-panel">
      <div class="codelab-stdin-panel__header">
        <span>Standard Input (std::cin / sys.stdin / process.stdin)</span>
        <button type="button" class="codelab-btn codelab-btn--sm" id="cl-stdin-clear-btn" style="padding:1px 6px;font-size:10px;">Clear</button>
      </div>
      <textarea class="codelab-stdin-panel__textarea" id="cl-stdin-textarea" placeholder="Paste custom input lines here for DSA / competitive programming...">${val}</textarea>
    </div>
  `;
}
