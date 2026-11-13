export type SqlDialect = 'postgres' | 'sqlite';

export type SqlEditorMode = 'inline' | 'playground' | 'workbench';

export type SqlThemeMode = 'dark' | 'light' | 'auto';

export interface SqlColumnSchema {
  readonly name: string;
  readonly type: string;
  readonly pk?: boolean;
  readonly fk?: string;
  readonly nullable?: boolean;
  readonly comment?: string;
}

export interface SqlTableSchema {
  readonly name: string;
  readonly rowCount?: number;
  readonly columns: readonly SqlColumnSchema[];
}

export interface SqlFunctionSchema {
  readonly name: string;
  readonly signature: string;
  readonly description?: string;
}

export interface SqlSchema {
  readonly dialect: SqlDialect;
  readonly tables: readonly SqlTableSchema[];
  readonly functions?: readonly SqlFunctionSchema[];
}

export interface SqlDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly hint?: string;
  readonly line?: number;
  readonly column?: number;
  readonly fromOffset?: number;
  readonly toOffset?: number;
}

export interface SqlRunPayload {
  readonly sql: string;
  readonly selectedSql: string;
  readonly effectiveSql: string;
  readonly dialect: SqlDialect;
}

export interface SqlFormatOptions {
  readonly dialect?: SqlDialect;
  readonly indent?: number;
  readonly keywordCase?: 'upper' | 'lower' | 'preserve';
}

export type SqlCompletionKind = 'table' | 'column' | 'function' | 'keyword' | 'cte';

export interface SqlCompletionItem {
  readonly label: string;
  readonly insertText: string;
  readonly kind: SqlCompletionKind;
  readonly detail?: string;
  readonly badge?: string;
  readonly secondaryBadge?: string;
  readonly description?: string;
  readonly replaceFrom: number;
  readonly replaceTo: number;
}

export interface SqlEditorOptions {
  readonly value?: string;
  readonly dialect?: SqlDialect;
  readonly mode?: SqlEditorMode;
  readonly schema?: SqlSchema | null;
  readonly theme?: SqlThemeMode;
  readonly readOnly?: boolean;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
  readonly minLines?: number;
  readonly maxLines?: number;
  readonly showToolbar?: boolean;
  readonly onRun?: (payload: SqlRunPayload) => void | Promise<void>;
  readonly onExplain?: (payload: SqlRunPayload) => void | Promise<void>;
  readonly onChange?: (value: string) => void;
  readonly onFormat?: (formatted: string) => void;
}

export interface SqlEditorInstance {
  getValue(): string;
  setValue(sql: string): void;
  getSelection(): string;
  insertAtCursor(text: string): void;
  format(): string;
  setDialect(dialect: SqlDialect): void;
  getDialect(): SqlDialect;
  setSchema(schema: SqlSchema | null): void;
  getSchema(): SqlSchema | null;
  setDiagnostics(diagnostics: readonly SqlDiagnostic[]): void;
  clearDiagnostics(): void;
  getDiagnostics(): readonly SqlDiagnostic[];
  setTheme(theme: SqlThemeMode): void;
  getTheme(): SqlThemeMode;
  setReadOnly(readOnly: boolean): void;
  focus(): void;
  destroy(): void;
  /** Playground slot elements when `mode === 'playground'` */
  readonly slots?: {
    readonly header: HTMLElement | null;
    readonly footer: HTMLElement | null;
    readonly results: HTMLElement | null;
  };
}

export interface SqlRunnerStepInfo {
  readonly index: number;
  readonly id?: string;
  readonly title?: string;
}

export interface SqlRunnerRequest {
  readonly sql: string;
  readonly selectedSql: string;
  readonly effectiveSql: string;
  readonly dialect: SqlDialect;
  readonly step?: SqlRunnerStepInfo | null;
  readonly mode: 'run' | 'verify' | 'explain';
}

export interface SqlRunnerVerification {
  readonly passed: boolean;
  readonly message?: string;
  readonly details?: readonly string[];
}

export interface SqlRunnerResult {
  readonly columns?: readonly string[];
  readonly rows?: ReadonlyArray<ReadonlyArray<unknown> | Readonly<Record<string, unknown>>>;
  readonly rowCount?: number;
  readonly execMs?: number;
  readonly plan?: string | Readonly<Record<string, unknown>> | ReadonlyArray<unknown>;
  readonly verification?: SqlRunnerVerification;
  readonly error?: unknown;
}

export type SqlRunnerFn = (request: SqlRunnerRequest) => Promise<SqlRunnerResult> | SqlRunnerResult;
