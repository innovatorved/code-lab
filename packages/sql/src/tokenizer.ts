import type { SqlDiagnostic, SqlDialect } from './types';

export type SqlTokenType =
  | 'keyword'
  | 'function'
  | 'type'
  | 'string'
  | 'number'
  | 'operator'
  | 'cast'
  | 'param'
  | 'identifier'
  | 'quoted-ident'
  | 'comment'
  | 'punctuation'
  | 'whitespace';

export interface SqlToken {
  readonly type: SqlTokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

const COMMON_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'TRUE', 'FALSE', 'AS', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL',
  'ON', 'USING', 'GROUP', 'BY', 'HAVING', 'WINDOW', 'QUALIFY', 'ORDER', 'ASC', 'DESC', 'NULLS',
  'FIRST', 'LAST', 'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'WITH', 'RECURSIVE',
  'UNION', 'ALL', 'INTERSECT', 'EXCEPT', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'INSERT', 'INTO', 'VALUES', 'DEFAULT', 'UPDATE', 'SET', 'DELETE', 'MERGE', 'CREATE', 'ALTER',
  'DROP', 'TRUNCATE', 'TABLE', 'TEMP', 'TEMPORARY', 'IF', 'VIEW', 'MATERIALIZED', 'INDEX',
  'UNIQUE', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'CASCADE',
  'RESTRICT', 'ADD', 'COLUMN', 'RENAME', 'TO', 'TRIGGER', 'BEFORE', 'AFTER', 'INSTEAD', 'OF',
  'EACH', 'ROW', 'FOR', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'TRANSACTION',
  'EXPLAIN', 'QUERY', 'PLAN', 'OVER', 'PARTITION', 'RANGE', 'GROUPS', 'UNBOUNDED', 'PRECEDING',
  'FOLLOWING', 'CURRENT', 'EXCLUDE', 'TIES', 'OTHERS', 'NO', 'ACTION', 'CONFLICT', 'DO', 'NOTHING',
  'REPLACE', 'ABORT', 'FAIL', 'IGNORE', 'CAST', 'COLLATE', 'ESCAPE', 'HAVING', 'ANY', 'SOME'
]);

const POSTGRES_KEYWORDS = new Set([
  'ILIKE', 'SIMILAR', 'LATERAL', 'RETURNING', 'FILTER', 'ANALYZE', 'BUFFERS', 'VERBOSE', 'COSTS',
  'SETTINGS', 'WAL', 'SUMMARY', 'TIMING', 'FORMAT', 'CONCURRENTLY', 'GENERATED', 'ALWAYS',
  'IDENTITY', 'OVERRIDING', 'SYSTEM', 'USER', 'VALUE', 'LOCK', 'SHARE', 'NOWAIT', 'SKIP', 'LOCKED',
  'EXTENSION', 'SCHEMA', 'SEQUENCE', 'DOMAIN', 'TYPE', 'ENUM', 'FUNCTION', 'PROCEDURE', 'LANGUAGE',
  'PLPGSQL', 'SQL', 'IMMUTABLE', 'STABLE', 'VOLATILE', 'PARALLEL', 'SAFE', 'TABLESAMPLE',
  'BERNOULLI', 'UNNEST', 'ORDINALITY', 'WITHIN', 'GROUPING', 'SETS', 'CUBE', 'ROLLUP'
]);

const SQLITE_KEYWORDS = new Set([
  'PRAGMA', 'WITHOUT', 'ROWID', 'STRICT', 'GLOB', 'REGEXP', 'MATCH', 'AUTOINCREMENT', 'VACUUM',
  'ATTACH', 'DETACH', 'DATABASE', 'REINDEX', 'INDEXED', 'RETURNING', 'FILTER', 'GENERATED',
  'ALWAYS', 'STORED', 'VIRTUAL'
]);

const SQL_TYPES = new Set([
  'INT', 'INTEGER', 'SMALLINT', 'BIGINT', 'SERIAL', 'SMALLSERIAL', 'BIGSERIAL', 'REAL', 'FLOAT',
  'DOUBLE', 'PRECISION', 'NUMERIC', 'DECIMAL', 'MONEY', 'TEXT', 'VARCHAR', 'CHAR', 'CHARACTER',
  'VARYING', 'BPCHAR', 'BYTEA', 'BLOB', 'BOOLEAN', 'BOOL', 'DATE', 'TIME', 'TIMETZ', 'TIMESTAMP',
  'TIMESTAMPTZ', 'INTERVAL', 'UUID', 'JSON', 'JSONB', 'XML', 'INET', 'CIDR', 'MACADDR', 'TSVECTOR',
  'TSQUERY', 'ARRAY', 'INT2', 'INT4', 'INT8', 'FLOAT4', 'FLOAT8', 'ANYARRAY'
]);

const SQL_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'GREATEST', 'LEAST', 'ABS', 'ROUND',
  'CEIL', 'CEILING', 'FLOOR', 'MOD', 'POWER', 'SQRT', 'RANDOM', 'LENGTH', 'CHAR_LENGTH', 'LOWER',
  'UPPER', 'TRIM', 'LTRIM', 'RTRIM', 'SUBSTR', 'SUBSTRING', 'POSITION', 'STRPOS', 'CONCAT',
  'CONCAT_WS', 'SPLIT_PART', 'REGEXP_REPLACE', 'REGEXP_MATCHES', 'NOW', 'CURRENT_DATE',
  'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'CLOCK_TIMESTAMP', 'DATE_TRUNC', 'DATE_PART', 'EXTRACT',
  'AGE', 'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP', 'MAKE_INTERVAL', 'STRFTIME', 'DATETIME', 'JULIANDAY',
  'UNIXEPOCH', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'CUME_DIST', 'NTILE', 'LAG',
  'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE', 'ARRAY_AGG', 'STRING_AGG', 'GROUP_CONCAT',
  'BOOL_AND', 'BOOL_OR', 'JSON_AGG', 'JSONB_AGG', 'JSON_OBJECT', 'JSON_BUILD_OBJECT',
  'JSONB_BUILD_OBJECT', 'JSON_EXTRACT', 'JSONB_EXTRACT_PATH_TEXT', 'JSONB_SET', 'JSON_EACH',
  'JSONB_EACH', 'GENERATE_SERIES', 'PG_SLEEP', 'PG_SIZE_PRETTY', 'PG_TOTAL_RELATION_SIZE', 'IIF',
  'PRINTF', 'TYPEOF', 'TOTAL', 'CHANGES'
]);

export function getDialectKeywords(dialect: SqlDialect): ReadonlySet<string> {
  const out = new Set<string>(COMMON_KEYWORDS);
  const extra = dialect === 'postgres' ? POSTGRES_KEYWORDS : SQLITE_KEYWORDS;
  for (const k of extra) out.add(k);
  return out;
}

export function getSqlBuiltinFunctions(): ReadonlySet<string> {
  return SQL_FUNCTIONS;
}

function matchDollarQuoteTag(sql: string, pos: number): string | null {
  if (sql[pos] !== '$') return null;
  let end = pos + 1;
  if (end < sql.length && sql[end] === '$') {
    return '$$';
  }
  if (end < sql.length && /[A-Za-z_]/.test(sql[end])) {
    end++;
    while (end < sql.length && /[A-Za-z0-9_]/.test(sql[end])) {
      end++;
    }
    if (end < sql.length && sql[end] === '$') {
      return sql.slice(pos, end + 1);
    }
  }
  return null;
}

export function tokenizeSql(sql: string, dialect: SqlDialect = 'postgres'): SqlToken[] {
  const tokens: SqlToken[] = [];
  const keywords = getDialectKeywords(dialect);
  const len = sql.length;
  let i = 0;

  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    // 1. Whitespace
    if (/\s/.test(ch)) {
      const start = i;
      while (i < len && /\s/.test(sql[i])) i++;
      tokens.push({ type: 'whitespace', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 2. Single-line comment `-- ...`
    if (ch === '-' && next === '-') {
      const start = i;
      i += 2;
      while (i < len && sql[i] !== '\n') i++;
      tokens.push({ type: 'comment', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 3. Block comment `/* ... */` (supports nested Postgres block comments)
    if (ch === '/' && next === '*') {
      const start = i;
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      tokens.push({ type: 'comment', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 4. Postgres dollar-quoted strings `$$...$$` or `$tag$...$tag$`
    if (dialect === 'postgres' && ch === '$') {
      const tag = matchDollarQuoteTag(sql, i);
      if (tag) {
        const start = i;
        i += tag.length;
        const closeIdx = sql.indexOf(tag, i);
        if (closeIdx === -1) {
          i = len;
        } else {
          i = closeIdx + tag.length;
        }
        tokens.push({ type: 'string', value: sql.slice(start, i), start, end: i });
        continue;
      }
    }

    // 5. Positional/named parameters (`$1` in Postgres; `?1`, `:param`, `@param` in SQLite)
    if (ch === '$' && /[0-9]/.test(next ?? '')) {
      const start = i;
      i++;
      while (i < len && /[0-9]/.test(sql[i])) i++;
      tokens.push({ type: 'param', value: sql.slice(start, i), start, end: i });
      continue;
    }
    if (dialect === 'sqlite' && (ch === ':' || ch === '@') && /[A-Za-z_]/.test(next ?? '')) {
      const start = i;
      i++;
      while (i < len && /[A-Za-z0-9_]/.test(sql[i])) i++;
      tokens.push({ type: 'param', value: sql.slice(start, i), start, end: i });
      continue;
    }
    if (dialect === 'sqlite' && ch === '?' && /[0-9]/.test(next ?? '')) {
      const start = i;
      i++;
      while (i < len && /[0-9]/.test(sql[i])) i++;
      tokens.push({ type: 'param', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 6. Postgres `::type` cast
    if (dialect === 'postgres' && ch === ':' && next === ':') {
      const start = i;
      i += 2;
      while (i < len && /\s/.test(sql[i])) i++;
      while (i < len && /[A-Za-z0-9_[\]]/.test(sql[i])) i++;
      tokens.push({ type: 'cast', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 7. Single-quoted string (or Postgres E'...' / X'...')
    if (ch === '\'' || ((ch === 'E' || ch === 'e' || ch === 'X' || ch === 'x') && next === '\'')) {
      const start = i;
      const isEscaped = ch !== '\'';
      i += isEscaped ? 2 : 1;
      while (i < len) {
        if (isEscaped && sql[i] === '\\' && i + 1 < len) {
          i += 2;
          continue;
        }
        if (sql[i] === '\'') {
          if (sql[i + 1] === '\'') {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: 'string', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 8. Quoted identifiers (`"..."`, SQLite `` `...` `` or `[...]`)
    if (ch === '"' || (dialect === 'sqlite' && (ch === '`' || ch === '['))) {
      const start = i;
      const closeChar = ch === '[' ? ']' : ch;
      i++;
      while (i < len) {
        if (sql[i] === closeChar) {
          if (closeChar !== ']' && sql[i + 1] === closeChar) {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: 'quoted-ident', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 9. Numeric literals
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(next ?? ''))) {
      const start = i;
      if (ch === '0' && (next === 'x' || next === 'X')) {
        i += 2;
        while (i < len && /[0-9a-fA-F_]/.test(sql[i])) i++;
      } else {
        while (i < len && /[0-9_]/.test(sql[i])) i++;
        if (i < len && sql[i] === '.' && /[0-9]/.test(sql[i + 1] ?? '')) {
          i++;
          while (i < len && /[0-9_]/.test(sql[i])) i++;
        }
        if (i < len && (sql[i] === 'e' || sql[i] === 'E')) {
          i++;
          if (sql[i] === '+' || sql[i] === '-') i++;
          while (i < len && /[0-9]/.test(sql[i])) i++;
        }
      }
      tokens.push({ type: 'number', value: sql.slice(start, i), start, end: i });
      continue;
    }

    // 10. Multi-char JSONB & relational operators (`->>`, `#>>`, `->`, `#>`, `@>`, `<@`, `?|`, `?&`, `||`, `<>`, `!=`, `<=`, `>=`, `!~*`, `~*`)
    const three = sql.slice(i, i + 3);
    if (three === '->>' || three === '#>>' || three === '!~*') {
      tokens.push({ type: 'operator', value: three, start: i, end: i + 3 });
      i += 3;
      continue;
    }
    const two = sql.slice(i, i + 2);
    if (
      two === '->' || two === '#>' || two === '@>' || two === '<@' ||
      two === '?|' || two === '?&' || two === '||' || two === '<>' ||
      two === '!=' || two === '<=' || two === '>=' || two === '~*' ||
      two === '!~' || two === '<<' || two === '>>'
    ) {
      tokens.push({ type: 'operator', value: two, start: i, end: i + 2 });
      i += 2;
      continue;
    }

    // 11. Single-char punctuation vs operators
    if ('(),.;[]'.includes(ch)) {
      tokens.push({ type: 'punctuation', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if ('+-*/%=<>?&|~^!'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    // 12. Identifiers, Keywords, Types & Functions
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      i++;
      while (i < len && /[A-Za-z0-9_$]/.test(sql[i])) i++;
      const word = sql.slice(start, i);
      const upper = word.toUpperCase();

      let look = i;
      while (look < len && /\s/.test(sql[look])) look++;
      const followedByParen = sql[look] === '(';

      // Check previous non-whitespace token: if `.` precede this word, it's a column/member identifier
      let prevNonWs: SqlToken | undefined;
      for (let k = tokens.length - 1; k >= 0; k--) {
        if (tokens[k].type !== 'whitespace' && tokens[k].type !== 'comment') {
          prevNonWs = tokens[k];
          break;
        }
      }

      if (prevNonWs && prevNonWs.value === '.') {
        tokens.push({ type: 'identifier', value: word, start, end: i });
      } else if (followedByParen && SQL_FUNCTIONS.has(upper)) {
        tokens.push({ type: 'function', value: word, start, end: i });
      } else if (keywords.has(upper)) {
        tokens.push({ type: 'keyword', value: word, start, end: i });
      } else if (SQL_TYPES.has(upper)) {
        tokens.push({ type: 'type', value: word, start, end: i });
      } else {
        tokens.push({ type: 'identifier', value: word, start, end: i });
      }
      continue;
    }

    tokens.push({ type: 'punctuation', value: ch, start: i, end: i + 1 });
    i++;
  }

  return tokens;
}

export function escapeSqlHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tokenCssClass(type: SqlTokenType): string | null {
  switch (type) {
    case 'keyword':
      return 'cl-sql-tok-kw';
    case 'function':
      return 'cl-sql-tok-fn';
    case 'type':
    case 'cast':
      return 'cl-sql-tok-type';
    case 'string':
      return 'cl-sql-tok-str';
    case 'number':
      return 'cl-sql-tok-num';
    case 'operator':
      return 'cl-sql-tok-op';
    case 'param':
      return 'cl-sql-tok-param';
    case 'quoted-ident':
      return 'cl-sql-tok-qident';
    case 'comment':
      return 'cl-sql-tok-comment';
    default:
      return null;
  }
}

interface NormalizedDiagRange {
  readonly from: number;
  readonly to: number;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
}

function resolveDiagRanges(sql: string, diagnostics: readonly SqlDiagnostic[]): NormalizedDiagRange[] {
  if (diagnostics.length === 0) return [];
  const lineStarts: number[] = [0];
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '\n') lineStarts.push(i + 1);
  }
  const ranges: NormalizedDiagRange[] = [];
  for (const d of diagnostics) {
    let from = d.fromOffset;
    let to = d.toOffset;
    if (from === undefined && d.line !== undefined && d.line >= 1) {
      const lineIdx = Math.min(d.line - 1, lineStarts.length - 1);
      const lineStart = lineStarts[lineIdx];
      const nextNewline = sql.indexOf('\n', lineStart);
      const lineEnd = nextNewline === -1 ? sql.length : nextNewline;
      if (d.column !== undefined && d.column >= 1) {
        from = Math.min(lineStart + d.column - 1, lineEnd);
        let tokEnd = from;
        while (tokEnd < lineEnd && !/\s|[(),;]/.test(sql[tokEnd])) tokEnd++;
        to = tokEnd > from ? tokEnd : Math.min(from + 1, lineEnd);
      } else {
        from = lineStart;
        to = lineEnd;
      }
    }
    if (from !== undefined) {
      const safeFrom = Math.max(0, Math.min(from, sql.length));
      const safeTo = Math.max(safeFrom + 1, Math.min(to ?? safeFrom + 1, sql.length));
      if (safeFrom < sql.length) {
        ranges.push({
          from: safeFrom,
          to: safeTo,
          severity: d.severity,
          message: d.message
        });
      }
    }
  }
  return ranges;
}

export function highlightSql(
  sql: string,
  dialect: SqlDialect = 'postgres',
  diagnostics: readonly SqlDiagnostic[] = []
): string {
  const tokens = tokenizeSql(sql, dialect);
  const diagRanges = resolveDiagRanges(sql, diagnostics);
  const parts: string[] = [];

  for (const tok of tokens) {
    const cls = tokenCssClass(tok.type);
    const overlapping = diagRanges.find((r) => tok.start < r.to && tok.end > r.from);
    const escaped = escapeSqlHtml(tok.value);
    let rendered = cls ? `<span class="${cls}">${escaped}</span>` : escaped;
    if (overlapping && tok.type !== 'whitespace') {
      const diagCls =
        overlapping.severity === 'error'
          ? 'cl-sql-diag-error'
          : overlapping.severity === 'warning'
            ? 'cl-sql-diag-warning'
            : 'cl-sql-diag-info';
      rendered = `<span class="${diagCls}" title="${escapeSqlHtml(overlapping.message)}">${rendered}</span>`;
    }
    parts.push(rendered);
  }

  // Trailing newline keeps `<pre>` height matched with `<textarea>` when sql ends with `\n`
  if (sql.endsWith('\n') || sql.length === 0) {
    parts.push(' ');
  }
  return parts.join('');
}
