import { tokenizeSql, type SqlToken } from './tokenizer';
import type { SqlDialect, SqlFormatOptions } from './types';

const MAJOR_CLAUSES = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'WINDOW', 'QUALIFY', 'ORDER',
  'LIMIT', 'OFFSET', 'FETCH', 'VALUES', 'SET', 'RETURNING', 'UNION', 'INTERSECT',
  'EXCEPT', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'EXPLAIN'
]);

const JOIN_MODIFIERS = new Set(['LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'NATURAL', 'LATERAL']);

function applyCase(word: string, mode: 'upper' | 'lower' | 'preserve'): string {
  if (mode === 'upper') return word.toUpperCase();
  if (mode === 'lower') return word.toLowerCase();
  return word;
}

export function formatSql(sql: string, options: SqlFormatOptions = {}): string {
  const dialect: SqlDialect = options.dialect ?? 'postgres';
  const indentSize = Math.max(1, Math.min(options.indent ?? 2, 8));
  const keywordCase = options.keywordCase ?? 'upper';
  const padUnit = ' '.repeat(indentSize);

  const rawTokens = tokenizeSql(sql, dialect);
  const meaningful: SqlToken[] = rawTokens.filter((t) => t.type !== 'whitespace');
  if (meaningful.length === 0) return '';

  const lines: string[] = [];
  let currentLine = '';
  let parenDepth = 0;
  let inSelectList = false;
  let pendingIndent = 0;

  const flushLine = (): void => {
    const trimmed = currentLine.replace(/[ \t]+$/g, '');
    if (trimmed.length > 0) {
      lines.push(trimmed);
    }
    currentLine = '';
  };

  const ensureIndent = (extra = 0): void => {
    if (currentLine.length === 0) {
      currentLine = padUnit.repeat(Math.max(0, parenDepth + extra));
    }
  };

  const appendSpaceIfNeeded = (): void => {
    if (
      currentLine.length > 0 &&
      !/[\s([\].]$/.test(currentLine) &&
      !currentLine.endsWith('::')
    ) {
      currentLine += ' ';
    }
  };

  for (let i = 0; i < meaningful.length; i++) {
    const tok = meaningful[i];
    const next = meaningful[i + 1];
    const upper = tok.value.toUpperCase();

    if (tok.type === 'comment') {
      if (tok.value.startsWith('--')) {
        appendSpaceIfNeeded();
        currentLine += tok.value;
        flushLine();
      } else {
        appendSpaceIfNeeded();
        currentLine += tok.value;
      }
      continue;
    }

    if (tok.type === 'punctuation') {
      if (tok.value === '(') {
        const prev = meaningful[i - 1];
        const prevIsFuncOrCast =
          prev && (prev.type === 'function' || prev.type === 'identifier' || prev.type === 'type');
        if (!prevIsFuncOrCast) {
          appendSpaceIfNeeded();
        }
        currentLine += '(';
        parenDepth++;
        if (next && next.type === 'keyword' && (next.value.toUpperCase() === 'SELECT' || next.value.toUpperCase() === 'WITH')) {
          flushLine();
        }
        continue;
      }
      if (tok.value === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        currentLine = currentLine.replace(/[ \t]+$/g, '');
        currentLine += ')';
        continue;
      }
      if (tok.value === ',') {
        currentLine = currentLine.replace(/[ \t]+$/g, '');
        currentLine += ',';
        if (inSelectList && parenDepth === 0) {
          flushLine();
          pendingIndent = 1;
        } else {
          currentLine += ' ';
        }
        continue;
      }
      if (tok.value === ';') {
        currentLine = currentLine.replace(/[ \t]+$/g, '');
        currentLine += ';';
        inSelectList = false;
        pendingIndent = 0;
        flushLine();
        if (next) lines.push('');
        continue;
      }
      if (tok.value === '.') {
        currentLine = currentLine.replace(/[ \t]+$/g, '');
        currentLine += '.';
        continue;
      }
    }

    if (tok.type === 'cast') {
      currentLine = currentLine.replace(/[ \t]+$/g, '');
      const castBody = tok.value.slice(2).trim();
      currentLine += '::' + applyCase(castBody, keywordCase === 'upper' ? 'lower' : keywordCase);
      continue;
    }

    if (tok.type === 'keyword') {
      const formattedKw = applyCase(tok.value, keywordCase);

      // Multi-word JOIN (`LEFT JOIN`, `LEFT OUTER JOIN`, `INNER JOIN`, `CROSS JOIN`, `LATERAL JOIN`)
      if (JOIN_MODIFIERS.has(upper)) {
        let lookIdx = i + 1;
        let sawJoin = false;
        while (lookIdx < meaningful.length && lookIdx <= i + 3) {
          const w = meaningful[lookIdx].value.toUpperCase();
          if (w === 'JOIN') {
            sawJoin = true;
            break;
          }
          if (w !== 'OUTER' && !JOIN_MODIFIERS.has(w)) break;
          lookIdx++;
        }
        if (sawJoin && parenDepth === 0) {
          inSelectList = false;
          pendingIndent = 0;
          flushLine();
          ensureIndent(0);
          currentLine += formattedKw;
          continue;
        }
      }

      if (upper === 'JOIN' && parenDepth === 0) {
        const prev = meaningful[i - 1];
        const prevUpper = prev ? prev.value.toUpperCase() : '';
        if (prevUpper !== 'OUTER' && !JOIN_MODIFIERS.has(prevUpper)) {
          inSelectList = false;
          pendingIndent = 0;
          flushLine();
        }
        ensureIndent(0);
        appendSpaceIfNeeded();
        currentLine += formattedKw;
        continue;
      }

      // `ON CONFLICT` in Postgres / SQLite
      if (upper === 'ON' && next && next.value.toUpperCase() === 'CONFLICT' && parenDepth === 0) {
        inSelectList = false;
        pendingIndent = 0;
        flushLine();
        ensureIndent(0);
        currentLine += formattedKw;
        continue;
      }

      // `AND` / `OR` inside top-level WHERE / HAVING / ON
      if ((upper === 'AND' || upper === 'OR') && parenDepth === 0) {
        // Do not split `BETWEEN x AND y`
        let isBetweenAnd = false;
        if (upper === 'AND') {
          for (let back = i - 1; back >= Math.max(0, i - 5); back--) {
            const bw = meaningful[back].value.toUpperCase();
            if (bw === 'BETWEEN') {
              isBetweenAnd = true;
              break;
            }
            if (MAJOR_CLAUSES.has(bw)) break;
          }
        }
        if (!isBetweenAnd) {
          flushLine();
          ensureIndent(1);
          currentLine += formattedKw;
          continue;
        }
      }

      // Major top-level SQL clauses (`SELECT`, `FROM`, `WHERE`, `GROUP BY`, `ORDER BY`, ...)
      if (MAJOR_CLAUSES.has(upper) && parenDepth <= 1) {
        // Avoid breaking `GROUP` or `ORDER` if preceded by `WITHIN` or `OVER (`
        const prev = meaningful[i - 1];
        const prevUpper = prev ? prev.value.toUpperCase() : '';
        const insideWindow =
          parenDepth > 0 && (upper === 'ORDER' || upper === 'PARTITION' || prevUpper === '(');
        if (!insideWindow && prevUpper !== 'WITHIN' && prevUpper !== 'DISTINCT') {
          if (currentLine.trim().length > 0) {
            flushLine();
          }
          inSelectList = upper === 'SELECT';
          pendingIndent = 0;
          ensureIndent(0);
          currentLine += formattedKw;
          if (upper === 'SELECT' && !(next && next.value.toUpperCase() === 'DISTINCT')) {
            flushLine();
            pendingIndent = 1;
          }
          continue;
        }
      }

      if (upper === 'DISTINCT' && inSelectList && parenDepth === 0) {
        ensureIndent(0);
        appendSpaceIfNeeded();
        currentLine += formattedKw;
        if (!(next && next.value.toUpperCase() === 'ON')) {
          flushLine();
          pendingIndent = 1;
        }
        continue;
      }

      ensureIndent(pendingIndent);
      appendSpaceIfNeeded();
      currentLine += formattedKw;
      continue;
    }

    if (tok.type === 'function' || tok.type === 'type') {
      ensureIndent(pendingIndent);
      appendSpaceIfNeeded();
      currentLine += applyCase(tok.value, keywordCase);
      continue;
    }

    ensureIndent(pendingIndent);
    if (tok.type === 'operator' && (tok.value === '->' || tok.value === '->>' || tok.value === '#>' || tok.value === '#>>')) {
      currentLine = currentLine.replace(/[ \t]+$/g, '');
      currentLine += tok.value;
      continue;
    }
    const prevTok = meaningful[i - 1];
    if (
      prevTok &&
      prevTok.type === 'operator' &&
      (prevTok.value === '->' || prevTok.value === '->>' || prevTok.value === '#>' || prevTok.value === '#>>')
    ) {
      currentLine += tok.value;
      continue;
    }

    appendSpaceIfNeeded();
    currentLine += tok.value;
  }

  flushLine();
  return lines.join('\n');
}
