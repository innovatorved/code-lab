import { tokenizeSql } from './tokenizer';
import type { SqlDiagnostic, SqlDialect } from './types';

function offsetToLineColumn(sql: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const clamped = Math.max(0, Math.min(offset, sql.length));
  for (let i = 0; i < clamped; i++) {
    if (sql[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function lineColumnToOffset(sql: string, line: number, column = 1): number {
  let curLine = 1;
  let idx = 0;
  while (idx < sql.length && curLine < line) {
    if (sql[idx] === '\n') curLine++;
    idx++;
  }
  return Math.min(sql.length, idx + Math.max(0, column - 1));
}

function expandTokenSpanAtOffset(
  sql: string,
  offset: number,
  dialect: SqlDialect
): { fromOffset: number; toOffset: number } {
  const clamped = Math.max(0, Math.min(offset, Math.max(0, sql.length - 1)));
  const tokens = tokenizeSql(sql, dialect);
  for (const tok of tokens) {
    if (tok.type !== 'whitespace' && clamped >= tok.start && clamped < tok.end) {
      return { fromOffset: tok.start, toOffset: tok.end };
    }
  }
  const lineEnd = sql.indexOf('\n', clamped);
  const end = lineEnd === -1 ? Math.min(sql.length, clamped + 1) : Math.max(clamped + 1, lineEnd);
  return { fromOffset: clamped, toOffset: end };
}

export function parseSqlEngineError(
  error: unknown,
  sql: string,
  dialect: SqlDialect = 'postgres'
): SqlDiagnostic {
  const errObj = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
  const rawMessage =
    errObj && typeof errObj.message === 'string'
      ? errObj.message
      : typeof error === 'string'
        ? error
        : String(error ?? 'SQL query failed');

  // Extract HINT line if embedded or provided on PGlite / Postgres Error object
  let hint: string | undefined =
    errObj && typeof errObj.hint === 'string' && errObj.hint.trim() ? errObj.hint.trim() : undefined;
  const hintMatch = /\bHINT:\s*([^\n]+)/i.exec(rawMessage);
  if (!hint && hintMatch) {
    hint = hintMatch[1].trim();
  }

  const cleanMsg = rawMessage
    .split('\n')
    .filter((l) => !/^\s*(LINE\s+\d+:|HINT:|\^)/i.test(l))
    .join(' ')
    .replace(/^ERROR:\s*/i, '')
    .trim() || rawMessage.trim();

  // 1. PostgreSQL / PGlite explicit 1-based character `position`
  const rawPos =
    errObj && (typeof errObj.position === 'number' || typeof errObj.position === 'string')
      ? Number(errObj.position)
      : (() => {
          const m = /\bat character\s+(\d+)/i.exec(rawMessage);
          return m ? Number(m[1]) : NaN;
        })();

  if (Number.isFinite(rawPos) && rawPos >= 1) {
    const zeroBased = Math.min(Math.max(0, rawPos - 1), Math.max(0, sql.length - 1));
    const span = expandTokenSpanAtOffset(sql, zeroBased, dialect);
    const lc = offsetToLineColumn(sql, span.fromOffset);
    return {
      severity: 'error',
      message: cleanMsg,
      ...(hint ? { hint } : {}),
      line: lc.line,
      column: lc.column,
      fromOffset: span.fromOffset,
      toOffset: span.toOffset
    };
  }

  // 2. PostgreSQL `LINE N:` + optional `^` caret line
  const lineMatch = /\bLINE\s+(\d+):/i.exec(rawMessage);
  if (lineMatch) {
    const lineNum = Math.max(1, Number(lineMatch[1]));
    let colNum = 1;
    const msgLines = rawMessage.split('\n');
    const lineHeaderIdx = msgLines.findIndex((l) => /\bLINE\s+\d+:/i.test(l));
    if (lineHeaderIdx !== -1 && lineHeaderIdx + 1 < msgLines.length) {
      const prefixMatch = /^(\s*LINE\s+\d+:\s*)/i.exec(msgLines[lineHeaderIdx]);
      const caretMatch = /^(\s*)\^/.exec(msgLines[lineHeaderIdx + 1]);
      if (prefixMatch && caretMatch) {
        colNum = Math.max(1, caretMatch[1].length - prefixMatch[1].length + 1);
      }
    }
    const offset = lineColumnToOffset(sql, lineNum, colNum);
    const span = expandTokenSpanAtOffset(sql, offset, dialect);
    return {
      severity: 'error',
      message: cleanMsg,
      ...(hint ? { hint } : {}),
      line: lineNum,
      column: colNum,
      fromOffset: span.fromOffset,
      toOffset: span.toOffset
    };
  }

  // 3. SQLite `near "TOKEN"` / `no such column: X` / `no such table: Y` / `ambiguous column name: Z`
  const tokenPatterns: Array<{ re: RegExp; defaultHint?: (tok: string) => string }> = [
    {
      re: /\bnear\s+"([^"]+)"/i,
      defaultHint: (tok) => `Check SQL syntax right before or around "${tok}".`
    },
    {
      re: /\bno such column:\s*([A-Za-z0-9_."`[\]]+)/i,
      defaultHint: (tok) => `Column "${tok}" does not exist on the referenced tables. Check spelling or table aliases.`
    },
    {
      re: /\bcolumn\s+"([^"]+)"\s+does not exist/i,
      defaultHint: (tok) => `Verify that column "${tok}" exists in the target table schema.`
    },
    {
      re: /\bno such table:\s*([A-Za-z0-9_."`[\]]+)/i,
      defaultHint: (tok) => `Table "${tok}" was not found in the active database schema.`
    },
    {
      re: /\brelation\s+"([^"]+)"\s+does not exist/i,
      defaultHint: (tok) => `Relation "${tok}" was not found in the database.`
    },
    {
      re: /\bambiguous column name:\s*([A-Za-z0-9_."`[\]]+)/i,
      defaultHint: (tok) => `Qualify "${tok}" with a table name or alias (e.g. t.${tok}).`
    }
  ];

  for (const pat of tokenPatterns) {
    const m = pat.re.exec(rawMessage);
    if (m && m[1]) {
      const needle = m[1];
      const tokens = tokenizeSql(sql, dialect);
      const matchedTok =
        tokens.find((t) => t.value === needle) ??
        tokens.find((t) => t.value.toLowerCase() === needle.toLowerCase());
      if (matchedTok) {
        const lc = offsetToLineColumn(sql, matchedTok.start);
        const derivedHint = hint ?? (pat.defaultHint ? pat.defaultHint(needle) : undefined);
        return {
          severity: 'error',
          message: cleanMsg,
          ...(derivedHint ? { hint: derivedHint } : {}),
          line: lc.line,
          column: lc.column,
          fromOffset: matchedTok.start,
          toOffset: matchedTok.end
        };
      }
      const rawIdx = sql.toLowerCase().indexOf(needle.toLowerCase());
      if (rawIdx !== -1) {
        const lc = offsetToLineColumn(sql, rawIdx);
        const derivedHint = hint ?? (pat.defaultHint ? pat.defaultHint(needle) : undefined);
        return {
          severity: 'error',
          message: cleanMsg,
          ...(derivedHint ? { hint: derivedHint } : {}),
          line: lc.line,
          column: lc.column,
          fromOffset: rawIdx,
          toOffset: rawIdx + needle.length
        };
      }
    }
  }

  return {
    severity: 'error',
    message: cleanMsg,
    ...(hint ? { hint } : {}),
    line: 1,
    column: 1,
    fromOffset: 0,
    toOffset: Math.min(sql.length, Math.max(1, sql.indexOf('\n') === -1 ? sql.length : sql.indexOf('\n')))
  };
}
