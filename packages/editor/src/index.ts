import {
  createServiceId,
  Emitter,
  type Event,
  type IDisposable,
  toDisposable
} from '@code-lab/core';
import type { IConfigurationService } from '@code-lab/settings';
import {
  createSqlEditor,
  type SqlDiagnostic,
  type SqlDialect,
  type SqlEditorInstance,
  type SqlSchema
} from '@code-lab/sql';

export interface EditorMarker {
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly hint?: string;
}

export interface EditorDisplayOptions {
  readonly fontSize?: number;
  readonly tabSize?: number;
  readonly wordWrap?: 'off' | 'on' | 'wordWrapColumn';
  readonly minimap?: boolean;
  readonly lineNumbers?: 'on' | 'off' | 'relative';
  readonly readOnly?: boolean;
  readonly theme?: 'dark' | 'light' | 'high-contrast';
}

export interface IEditorAdapter extends IDisposable {
  readonly kind: 'monaco' | 'sql' | 'lightweight';
  readonly onDidChangeValue: Event<string>;
  getValue(): string;
  setValue(value: string): void;
  getSelection(): string;
  insertAtCursor(text: string): void;
  setLanguage(languageId: string): void;
  setMarkers(markers: readonly EditorMarker[]): void;
  applyOptions(options: EditorDisplayOptions): void;
  focus(): void;
}

export interface MonacoEditorLike {
  getValue(): string;
  setValue(value: string): void;
  getModel(): { getValueInRange?: (range: unknown) => string } | null;
  getSelection(): unknown;
  executeEdits(source: string, edits: Array<{ range: unknown; text: string }>): void;
  updateOptions(opts: Record<string, unknown>): void;
  focus(): void;
  onDidChangeModelContent(cb: () => void): { dispose(): void };
  dispose(): void;
}

export class LightweightEditorAdapter implements IEditorAdapter {
  public readonly kind = 'lightweight' as const;
  private readonly textarea: HTMLTextAreaElement;
  private readonly changeEmitter = new Emitter<string>({ name: 'editor.lightweight.change' });
  private readonly cleanup: IDisposable;

  public constructor(container: HTMLElement, initialValue = '') {
    const doc = container.ownerDocument ?? document;
    this.textarea = doc.createElement('textarea');
    this.textarea.className = 'cl-lightweight-editor';
    this.textarea.value = initialValue;
    this.textarea.spellcheck = false;
    container.innerHTML = '';
    container.appendChild(this.textarea);

    const onInput = (): void => {
      this.changeEmitter.fire(this.textarea.value);
    };
    this.textarea.addEventListener('input', onInput);
    this.cleanup = toDisposable(() => this.textarea.removeEventListener('input', onInput));
  }

  public get onDidChangeValue(): Event<string> {
    return this.changeEmitter.event;
  }

  public getValue(): string {
    return this.textarea.value;
  }

  public setValue(value: string): void {
    this.textarea.value = value;
  }

  public getSelection(): string {
    const start = this.textarea.selectionStart ?? 0;
    const end = this.textarea.selectionEnd ?? 0;
    return end > start ? this.textarea.value.slice(start, end) : '';
  }

  public insertAtCursor(text: string): void {
    const start = this.textarea.selectionStart ?? this.textarea.value.length;
    const end = this.textarea.selectionEnd ?? start;
    const cur = this.textarea.value;
    this.textarea.value = cur.slice(0, start) + text + cur.slice(end);
    const pos = start + text.length;
    this.textarea.selectionStart = pos;
    this.textarea.selectionEnd = pos;
    this.changeEmitter.fire(this.textarea.value);
  }

  public setLanguage(_languageId: string): void {
    // Plain textarea has no syntax grammar
  }

  public setMarkers(_markers: readonly EditorMarker[]): void {
    // Markers handled externally in Problems panel for plain textarea
  }

  public applyOptions(options: EditorDisplayOptions): void {
    if (options.fontSize) {
      this.textarea.style.fontSize = `${options.fontSize}px`;
    }
    if (options.wordWrap) {
      this.textarea.style.whiteSpace = options.wordWrap === 'off' ? 'pre' : 'pre-wrap';
    }
    if (options.readOnly !== undefined) {
      this.textarea.readOnly = options.readOnly;
    }
  }

  public focus(): void {
    this.textarea.focus();
  }

  public dispose(): void {
    this.cleanup.dispose();
    this.changeEmitter.dispose();
    this.textarea.remove();
  }
}

export class SqlEditorAdapter implements IEditorAdapter {
  public readonly kind = 'sql' as const;
  private readonly sqlEditor: SqlEditorInstance;
  private readonly changeEmitter = new Emitter<string>({ name: 'editor.sql.change' });

  public constructor(
    container: HTMLElement,
    options: {
      value?: string;
      dialect?: SqlDialect;
      schema?: SqlSchema | null;
      onRun?: (sql: string, effectiveSql: string) => void;
    } = {}
  ) {
    this.sqlEditor = createSqlEditor(container, {
      value: options.value ?? '',
      dialect: options.dialect ?? 'postgres',
      mode: 'inline',
      schema: options.schema ?? null,
      onChange: (val) => this.changeEmitter.fire(val),
      onRun: (payload) => options.onRun?.(payload.sql, payload.effectiveSql)
    });
  }

  public get onDidChangeValue(): Event<string> {
    return this.changeEmitter.event;
  }

  public get underlying(): SqlEditorInstance {
    return this.sqlEditor;
  }

  public getValue(): string {
    return this.sqlEditor.getValue();
  }

  public setValue(value: string): void {
    this.sqlEditor.setValue(value);
  }

  public getSelection(): string {
    return this.sqlEditor.getSelection();
  }

  public insertAtCursor(text: string): void {
    this.sqlEditor.insertAtCursor(text);
  }

  public setLanguage(languageId: string): void {
    if (languageId === 'sqlite') {
      this.sqlEditor.setDialect('sqlite');
    } else if (languageId === 'postgres' || languageId === 'sql') {
      this.sqlEditor.setDialect('postgres');
    }
  }

  public setMarkers(markers: readonly EditorMarker[]): void {
    const mapped: SqlDiagnostic[] = markers.map((m) => ({
      severity: m.severity,
      message: m.message,
      hint: m.hint,
      line: m.line,
      column: m.column
    }));
    this.sqlEditor.setDiagnostics(mapped);
  }

  public applyOptions(options: EditorDisplayOptions): void {
    if (options.readOnly !== undefined) {
      this.sqlEditor.setReadOnly(options.readOnly);
    }
    if (options.theme) {
      this.sqlEditor.setTheme(options.theme === 'light' ? 'light' : 'dark');
    }
  }

  public focus(): void {
    this.sqlEditor.focus();
  }

  public dispose(): void {
    this.sqlEditor.destroy();
    this.changeEmitter.dispose();
  }
}

export class MonacoEditorAdapter implements IEditorAdapter {
  public readonly kind = 'monaco' as const;
  private readonly editor: MonacoEditorLike;
  private readonly changeEmitter = new Emitter<string>({ name: 'editor.monaco.change' });
  private readonly modelSub: { dispose(): void };

  public constructor(editorInstance: MonacoEditorLike) {
    this.editor = editorInstance;
    this.modelSub = this.editor.onDidChangeModelContent(() => {
      this.changeEmitter.fire(this.editor.getValue());
    });
  }

  public get onDidChangeValue(): Event<string> {
    return this.changeEmitter.event;
  }

  public getValue(): string {
    return this.editor.getValue();
  }

  public setValue(value: string): void {
    if (this.editor.getValue() !== value) {
      this.editor.setValue(value);
    }
  }

  public getSelection(): string {
    const model = this.editor.getModel();
    const sel = this.editor.getSelection();
    if (model && typeof model.getValueInRange === 'function' && sel) {
      return model.getValueInRange(sel);
    }
    return '';
  }

  public insertAtCursor(text: string): void {
    const sel = this.editor.getSelection();
    if (sel) {
      this.editor.executeEdits('codelab', [{ range: sel, text }]);
    }
  }

  public setLanguage(_languageId: string): void {
    // Language set on Monaco ITextModel via monaco.editor.setModelLanguage
  }

  public setMarkers(_markers: readonly EditorMarker[]): void {
    // Markers synced via monaco.editor.setModelMarkers
  }

  public applyOptions(options: EditorDisplayOptions): void {
    const opts: Record<string, unknown> = {};
    if (options.fontSize !== undefined) opts.fontSize = options.fontSize;
    if (options.tabSize !== undefined) opts.tabSize = options.tabSize;
    if (options.wordWrap !== undefined) opts.wordWrap = options.wordWrap;
    if (options.minimap !== undefined) opts.minimap = { enabled: options.minimap };
    if (options.lineNumbers !== undefined) opts.lineNumbers = options.lineNumbers;
    if (options.readOnly !== undefined) opts.readOnly = options.readOnly;
    this.editor.updateOptions(opts);
  }

  public focus(): void {
    this.editor.focus();
  }

  public dispose(): void {
    this.modelSub.dispose();
    this.changeEmitter.dispose();
    this.editor.dispose();
  }
}

export interface IEditorService extends IDisposable {
  readonly activeAdapter: IEditorAdapter | undefined;
  setActiveAdapter(adapter: IEditorAdapter): void;
  syncFromConfiguration(config: IConfigurationService): void;
}

export const IEditorServiceId = createServiceId<IEditorService>('code-lab.editor');

export class EditorService implements IEditorService {
  private current: IEditorAdapter | undefined;

  public get activeAdapter(): IEditorAdapter | undefined {
    return this.current;
  }

  public setActiveAdapter(adapter: IEditorAdapter): void {
    if (this.current && this.current !== adapter) {
      this.current.dispose();
    }
    this.current = adapter;
  }

  public syncFromConfiguration(config: IConfigurationService): void {
    if (!this.current) return;
    const themeRaw = config.get<string>('workbench.colorTheme', 'dark');
    const theme =
      themeRaw === 'light' ? 'light' : themeRaw === 'high-contrast' ? 'high-contrast' : 'dark';
    this.current.applyOptions({
      fontSize: config.get<number>('editor.fontSize', 13),
      tabSize: config.get<number>('editor.tabSize', 2),
      wordWrap: config.get<'off' | 'on' | 'wordWrapColumn'>('editor.wordWrap', 'off'),
      minimap: config.get<boolean>('editor.minimap.enabled', false),
      lineNumbers: config.get<'on' | 'off' | 'relative'>('editor.lineNumbers', 'on'),
      theme
    });
  }

  public dispose(): void {
    if (this.current) {
      this.current.dispose();
      this.current = undefined;
    }
  }
}
