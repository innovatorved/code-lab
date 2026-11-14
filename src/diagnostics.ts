/**
 * @innovatorved/code-lab — Unified Diagnostics & Problems Aggregator Store
 * ============================================================================
 * Aggregates diagnostics from Monaco TypeScript/JavaScript workers, runtime
 * execution exceptions, preview errors, and linters into a reactive store
 * driving editor markers and the bottom drawer Problems panel.
 *
 * Strict leaf module: fully typed, zero explicit any, zero empty catches.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface DiagnosticItem {
  id: string;
  file: string;
  line: number;
  col?: number;
  column?: number;
  endLine?: number;
  endCol?: number;
  endColumn?: number;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number;
  tags?: string[];
}

export type DiagnosticListener = (items: DiagnosticItem[]) => void;

export function normalizeDiagnosticFilePath(rawFile: string): string {
  let p = String(rawFile || '').trim().replace(/\\/g, '/');
  while (p.startsWith('./')) {
    p = p.slice(2);
  }
  if (!p || p === '/workspace' || p === '/workspace/') return '';
  if (p.startsWith('/workspace/')) {
    p = p.slice('/workspace/'.length);
  }
  while (p.startsWith('./')) {
    p = p.slice(2);
  }
  if (p.startsWith('/')) {
    p = p.replace(/^\/+/, '');
  }
  return p;
}

export class DiagnosticsStore {
  private readonly items: Map<string, DiagnosticItem> = new Map();
  private readonly listeners: Set<DiagnosticListener> = new Set();
  private batchDepth = 0;
  private batchDirty = false;

  private normalizeItem(item: DiagnosticItem): DiagnosticItem | null {
    if (!item || typeof item.id !== 'string' || !item.id) return null;
    const col = typeof item.col === 'number' && Number.isFinite(item.col) && item.col > 0
      ? Math.floor(item.col)
      : (typeof item.column === 'number' && Number.isFinite(item.column) && item.column > 0
        ? Math.floor(item.column)
        : 1);
    const endLine = typeof item.endLine === 'number' && Number.isFinite(item.endLine) && item.endLine > 0
      ? Math.floor(item.endLine)
      : undefined;
    const endCol = typeof item.endCol === 'number' && Number.isFinite(item.endCol) && item.endCol > 0
      ? Math.floor(item.endCol)
      : (typeof item.endColumn === 'number' && Number.isFinite(item.endColumn) && item.endColumn > 0
        ? Math.floor(item.endColumn)
        : undefined);
    return {
      ...item,
      file: normalizeDiagnosticFilePath(item.file || ''),
      line: typeof item.line === 'number' && Number.isFinite(item.line) && item.line > 0
        ? Math.floor(item.line)
        : 1,
      col,
      ...(endLine !== undefined ? { endLine } : {}),
      ...(endCol !== undefined ? { endCol } : {}),
      message: String(item.message || ''),
      severity: item.severity || 'error'
    };
  }

  public add(item: DiagnosticItem): void {
    const normalized = this.normalizeItem(item);
    if (!normalized) return;
    this.items.set(normalized.id, normalized);
    this.notify();
  }

  public setFileDiagnostics(
    file: string,
    sourceOrDiags: string | ReadonlyArray<Partial<DiagnosticItem>>,
    diagsOrSource?: ReadonlyArray<Partial<DiagnosticItem>> | string
  ): DiagnosticItem[] {
    const normalizedFile = normalizeDiagnosticFilePath(file);
    let resolvedSource: string;
    let rawDiags: ReadonlyArray<Partial<DiagnosticItem>>;

    if (typeof sourceOrDiags === 'string') {
      resolvedSource = sourceOrDiags || 'diagnostics';
      rawDiags = Array.isArray(diagsOrSource) ? diagsOrSource : [];
    } else if (Array.isArray(sourceOrDiags)) {
      rawDiags = sourceOrDiags;
      resolvedSource =
        typeof diagsOrSource === 'string' && diagsOrSource ? diagsOrSource : 'diagnostics';
    } else {
      resolvedSource =
        typeof diagsOrSource === 'string' && diagsOrSource ? diagsOrSource : 'diagnostics';
      rawDiags = [];
    }

    let changed = false;
    for (const [existingId, existingItem] of this.items.entries()) {
      if (existingItem.file === normalizedFile && existingItem.source === resolvedSource) {
        this.items.delete(existingId);
        changed = true;
      }
    }

    const inserted: DiagnosticItem[] = [];
    for (let idx = 0; idx < rawDiags.length; idx++) {
      const d = rawDiags[idx];
      if (!d || typeof d !== 'object') continue;

      const line =
        typeof d.line === 'number' && Number.isFinite(d.line) && d.line > 0
          ? Math.floor(d.line)
          : 1;
      const col =
        typeof d.col === 'number' && Number.isFinite(d.col) && d.col > 0
          ? Math.floor(d.col)
          : (typeof d.column === 'number' && Number.isFinite(d.column) && d.column > 0
            ? Math.floor(d.column)
            : 1);
      const endLine =
        typeof d.endLine === 'number' && Number.isFinite(d.endLine) && d.endLine > 0
          ? Math.floor(d.endLine)
          : undefined;
      const rawEndCol =
        typeof d.endCol === 'number' && Number.isFinite(d.endCol) && d.endCol > 0
          ? Math.floor(d.endCol)
          : (typeof d.endColumn === 'number' && Number.isFinite(d.endColumn) && d.endColumn > 0
            ? Math.floor(d.endColumn)
            : undefined);
      const severity: DiagnosticSeverity =
        d.severity === 'error' ||
        d.severity === 'warning' ||
        d.severity === 'info' ||
        d.severity === 'hint'
          ? d.severity
          : 'error';
      const message = String(d.message ?? '');
      const candidateId = typeof d.id === 'string' && d.id.trim() ? d.id.trim() : '';
      const id =
        candidateId && !this.items.has(candidateId)
          ? candidateId
          : `${resolvedSource}:${normalizedFile}:${candidateId || `${line}:${col}`}:${idx}`;

      const normalized: DiagnosticItem = {
        id,
        file: normalizedFile,
        source: resolvedSource,
        severity,
        message,
        line,
        col,
        ...(d.column !== undefined ? { column: col } : {}),
        ...(endLine !== undefined ? { endLine } : {}),
        ...(rawEndCol !== undefined ? { endCol: rawEndCol } : {}),
        ...(d.endColumn !== undefined && rawEndCol !== undefined ? { endColumn: rawEndCol } : {}),
        ...(d.code !== undefined ? { code: d.code } : {}),
        ...(Array.isArray(d.tags) ? { tags: [...d.tags] } : {})
      };

      this.items.set(id, normalized);
      inserted.push(normalized);
      changed = true;
    }

    if (changed) {
      this.notify();
    }

    return inserted;
  }

  public setMany(items: ReadonlyArray<DiagnosticItem>, clearSource?: string): void {
    this.batch(() => {
      if (clearSource !== undefined) {
        this.clear(clearSource);
      }
      for (const item of items) {
        const normalized = this.normalizeItem(item);
        if (normalized) {
          this.items.set(normalized.id, normalized);
          this.batchDirty = true;
        }
      }
    });
  }

  public batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.batchDirty) {
        this.batchDirty = false;
        this.notify();
      }
    }
  }

  public remove(id: string): void {
    if (this.items.delete(id)) {
      this.notify();
    }
  }

  public clear(source?: string): void {
    if (source !== undefined && source !== '') {
      let changed = false;
      for (const [id, item] of this.items.entries()) {
        if (item.source === source) {
          this.items.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.notify();
      }
    } else if (this.items.size > 0) {
      this.items.clear();
      this.notify();
    }
  }

  public getAll(): DiagnosticItem[] {
    return Array.from(this.items.values());
  }

  public getByFile(file: string): DiagnosticItem[] {
    const normalizedTarget = normalizeDiagnosticFilePath(file);
    const out: DiagnosticItem[] = [];
    for (const item of this.items.values()) {
      if (item.file === normalizedTarget || item.file === file) {
        out.push(item);
      }
    }
    return out;
  }

  public subscribe(listener: DiagnosticListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (this.batchDepth > 0) {
      this.batchDirty = true;
      return;
    }
    if (this.listeners.size === 0) return;
    const snapshot = this.getAll();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('[code-lab] diagnostics subscriber error:', err);
      }
    }
  }
}

export function createDiagnosticsStore(): DiagnosticsStore {
  return new DiagnosticsStore();
}

export default {
  DiagnosticsStore,
  createDiagnosticsStore,
  normalizeDiagnosticFilePath
};
