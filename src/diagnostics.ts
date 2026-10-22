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

export class DiagnosticsStore {
  private readonly items: Map<string, DiagnosticItem> = new Map();
  private readonly listeners: Set<DiagnosticListener> = new Set();

  public add(item: DiagnosticItem): void {
    if (!item || typeof item.id !== 'string' || !item.id) return;
    const normalized: DiagnosticItem = {
      ...item,
      file: String(item.file || ''),
      line: typeof item.line === 'number' && item.line > 0 ? Math.floor(item.line) : 1,
      col: typeof item.col === 'number' && item.col > 0
        ? Math.floor(item.col)
        : (typeof item.column === 'number' && item.column > 0 ? Math.floor(item.column) : 1),
      message: String(item.message || ''),
      severity: item.severity || 'error'
    };
    this.items.set(normalized.id, normalized);
    this.notify();
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
    const out: DiagnosticItem[] = [];
    for (const item of this.items.values()) {
      if (item.file === file) {
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
  createDiagnosticsStore
};
