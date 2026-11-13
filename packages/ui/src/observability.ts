import type { EventTraceRecord, ILogger, IServiceContainer, LogEntry } from '@code-lab/core';
import type { IConfigurationService } from '@code-lab/settings';
import type { IPluginRegistry } from './plugin-registry';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function scoreFuzzyFileMatch(candidatePath: string, query: string): number {
  if (!query) return 1;
  const cleanQuery = query.toLowerCase().replace(/\s+/g, '');
  const lowerPath = candidatePath.toLowerCase();
  if (lowerPath === cleanQuery) return 1000;
  const baseIdx = lowerPath.lastIndexOf('/');
  const baseName = baseIdx === -1 ? lowerPath : lowerPath.slice(baseIdx + 1);
  if (baseName.startsWith(cleanQuery)) return 500 - baseName.length;
  if (lowerPath.includes(cleanQuery)) return 300 - lowerPath.length;

  let qIdx = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < lowerPath.length && qIdx < cleanQuery.length; i++) {
    if (lowerPath[i] === cleanQuery[qIdx]) {
      qIdx++;
      streak++;
      score += 10 + streak * 4;
    } else {
      streak = 0;
    }
  }
  return qIdx === cleanQuery.length ? score : -1;
}

export function rankWorkspaceFiles(
  filePaths: readonly string[],
  query: string,
  excludePatterns: readonly string[] = []
): string[] {
  const filtered = filePaths.filter((p) => {
    for (const ex of excludePatterns) {
      const token = ex.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^\/+|\/+$/g, '');
      if (token && p.includes(token)) return false;
    }
    return true;
  });
  const scored: Array<{ path: string; score: number }> = [];
  for (const p of filtered) {
    const score = scoreFuzzyFileMatch(p, query);
    if (score >= 0) scored.push({ path: p, score });
  }
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored.map((s) => s.path);
}

export interface ObservabilitySnapshotInput {
  readonly container: IServiceContainer;
  readonly configuration: IConfigurationService;
  readonly plugins: IPluginRegistry;
  readonly logger: ILogger;
  readonly recentEvents: readonly EventTraceRecord[];
  readonly workerStatus?: string;
}

export function renderObservabilityPanelHtml(input: ObservabilitySnapshotInput): string {
  const serviceIds = input.container.listRegisteredIds();
  const plugins = input.plugins.getPlugins();
  const logs: readonly LogEntry[] = input.logger.getRecentEntries().slice(-15).reverse();
  const events = input.recentEvents.slice(-15).reverse();
  const configDiags = input.configuration.getDiagnostics();

  return (
    `<div class="cl-observability-panel" style="padding:10px 14px;font-size:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">` +
    `<section style="border:1px solid var(--cl-border,#262626);border-radius:6px;padding:8px 10px;">` +
    `<strong>Services & Runtime (${serviceIds.length})</strong>` +
    `<div style="margin-top:4px;color:var(--cl-muted,#8e8e93);">Worker Host: <code>${escapeHtml(input.workerStatus ?? 'ready')}</code></div>` +
    `<ul style="margin:6px 0 0;padding-left:16px;">` +
    serviceIds.map((id) => `<li><code>${escapeHtml(id)}</code></li>`).join('') +
    `</ul>` +
    `</section>` +
    `<section style="border:1px solid var(--cl-border,#262626);border-radius:6px;padding:8px 10px;">` +
    `<strong>Plugins (${plugins.length}) & Config Diagnostics (${configDiags.length})</strong>` +
    `<ul style="margin:6px 0 0;padding-left:16px;">` +
    (plugins.length > 0
      ? plugins
          .map(
            (p) =>
              `<li><code>${escapeHtml(p.manifest.id)}</code> v${escapeHtml(p.manifest.version)} — ${p.active ? 'active' : 'lazy'}</li>`
          )
          .join('')
      : `<li>No external plugins registered</li>`) +
    `</ul>` +
    (configDiags.length > 0
      ? `<div style="margin-top:6px;color:#f59e0b;">` +
        configDiags.map((d) => `<div>⚠ ${escapeHtml(d.message)}</div>`).join('') +
        `</div>`
      : '') +
    `</section>` +
    `<section style="border:1px solid var(--cl-border,#262626);border-radius:6px;padding:8px 10px;">` +
    `<strong>Recent Event Bus (${events.length})</strong>` +
    `<ul style="margin:6px 0 0;padding-left:16px;max-height:130px;overflow-y:auto;">` +
    (events.length > 0
      ? events
          .map(
            (e) =>
              `<li><code>${escapeHtml(e.channel)}</code> (${e.listenerCount}) — ${escapeHtml(e.payloadSummary)}</li>`
          )
          .join('')
      : `<li>No events recorded yet</li>`) +
    `</ul>` +
    `</section>` +
    `<section style="border:1px solid var(--cl-border,#262626);border-radius:6px;padding:8px 10px;">` +
    `<strong>Recent Logs (${logs.length})</strong>` +
    `<ul style="margin:6px 0 0;padding-left:16px;max-height:130px;overflow-y:auto;">` +
    (logs.length > 0
      ? logs
          .map(
            (l) =>
              `<li><strong>[${escapeHtml(l.level)}]</strong> <code>${escapeHtml(l.scope)}</code>: ${escapeHtml(l.message)}</li>`
          )
          .join('')
      : `<li>No log entries</li>`) +
    `</ul>` +
    `</section>` +
    `</div>`
  );
}

export class WorkbenchErrorBoundary {
  private readonly host: HTMLElement;
  private readonly logger: ILogger;
  private bannerEl: HTMLElement | null = null;

  public constructor(host: HTMLElement, logger: ILogger) {
    this.host = host;
    this.logger = logger.child('error-boundary');
  }

  public capture(error: unknown, contextLabel = 'Workbench operation'): void {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`${contextLabel} failed: ${msg}`, error);
    const doc = this.host.ownerDocument ?? document;
    if (!this.bannerEl) {
      this.bannerEl = doc.createElement('div');
      this.bannerEl.className = 'cl-error-boundary-banner';
      this.bannerEl.setAttribute('role', 'alert');
      this.bannerEl.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;background:rgba(239,68,68,0.15);border-bottom:1px solid #ef4444;color:var(--cl-fg,#f5f5f5);font-size:12px;';
      if (typeof this.host.prepend === 'function') {
        this.host.prepend(this.bannerEl);
      } else {
        this.host.appendChild(this.bannerEl);
      }
    }
    this.bannerEl.innerHTML =
      `<span><strong>${escapeHtml(contextLabel)}:</strong> ${escapeHtml(msg)}</span>` +
      `<button type="button" class="codelab-btn" data-dismiss-error="1" style="padding:2px 8px;font-size:11px;">Dismiss</button>`;
    const dismissBtn = this.bannerEl.querySelector('[data-dismiss-error]');
    dismissBtn?.addEventListener(
      'click',
      () => {
        this.clear();
      },
      { once: true }
    );
  }

  public clear(): void {
    this.bannerEl?.remove();
    this.bannerEl = null;
  }
}
