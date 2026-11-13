import { getDialectKeywords, getSqlBuiltinFunctions, tokenizeSql, type SqlToken } from './tokenizer';
import type {
  SqlColumnSchema,
  SqlCompletionItem,
  SqlDialect,
  SqlSchema,
  SqlTableSchema
} from './types';

const NON_ALIAS_KEYWORDS = new Set([
  'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'LATERAL',
  'ON', 'USING', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT',
  'EXCEPT', 'SET', 'VALUES', 'RETURNING', 'WINDOW', 'FETCH', 'FOR'
]);

const TABLE_CLAUSES = new Set(['FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE']);

function stripIdentifierQuotes(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith('`') && raw.endsWith('`')) ||
    (raw.startsWith('[') && raw.endsWith(']'))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

export interface ParsedSqlContext {
  readonly aliases: ReadonlyMap<string, string>;
  readonly referencedTables: ReadonlySet<string>;
  readonly cteNames: ReadonlySet<string>;
}

export function extractTableAliases(sql: string, dialect: SqlDialect = 'postgres'): ParsedSqlContext {
  const tokens = tokenizeSql(sql, dialect).filter(
    (t) => t.type !== 'whitespace' && t.type !== 'comment'
  );
  const aliases = new Map<string, string>();
  const referencedTables = new Set<string>();
  const cteNames = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const upper = tok.value.toUpperCase();

    // Detect `WITH [RECURSIVE] cte_name AS (` and `, cte2 AS (`
    if (upper === 'WITH') {
      let j = i + 1;
      if (j < tokens.length && tokens[j].value.toUpperCase() === 'RECURSIVE') j++;
      while (j < tokens.length) {
        const nameTok = tokens[j];
        const nextTok = tokens[j + 1];
        if (
          nameTok &&
          (nameTok.type === 'identifier' || nameTok.type === 'quoted-ident') &&
          nextTok &&
          nextTok.value.toUpperCase() === 'AS'
        ) {
          cteNames.add(stripIdentifierQuotes(nameTok.value));
        }
        // Advance past parenthesized CTE body if we see `(`
        let foundComma = false;
        let depth = 0;
        while (j < tokens.length) {
          if (tokens[j].value === '(') depth++;
          else if (tokens[j].value === ')') {
            depth = Math.max(0, depth - 1);
            if (depth === 0 && tokens[j + 1]?.value === ',') {
              j += 2;
              foundComma = true;
              break;
            } else if (depth === 0) {
              break;
            }
          }
          j++;
        }
        if (!foundComma) break;
      }
    }

    if (TABLE_CLAUSES.has(upper)) {
      let tableIdx = i + 1;
      if (tableIdx < tokens.length && tokens[tableIdx].value.toUpperCase() === 'ONLY') {
        tableIdx++;
      }
      const tableTok = tokens[tableIdx];
      if (!tableTok || (tableTok.type !== 'identifier' && tableTok.type !== 'quoted-ident')) {
        continue;
      }
      let tableName = stripIdentifierQuotes(tableTok.value);
      let afterTableIdx = tableIdx + 1;
      // Handle schema-qualified `public.orders`
      if (
        tokens[afterTableIdx]?.value === '.' &&
        tokens[afterTableIdx + 1] &&
        (tokens[afterTableIdx + 1].type === 'identifier' || tokens[afterTableIdx + 1].type === 'quoted-ident')
      ) {
        tableName = stripIdentifierQuotes(tokens[afterTableIdx + 1].value);
        afterTableIdx += 2;
      }
      referencedTables.add(tableName);
      aliases.set(tableName.toLowerCase(), tableName);

      let aliasTok: SqlToken | undefined = tokens[afterTableIdx];
      if (aliasTok && aliasTok.value.toUpperCase() === 'AS') {
        aliasTok = tokens[afterTableIdx + 1];
      }
      if (
        aliasTok &&
        (aliasTok.type === 'identifier' || aliasTok.type === 'quoted-ident') &&
        !NON_ALIAS_KEYWORDS.has(aliasTok.value.toUpperCase())
      ) {
        const aliasName = stripIdentifierQuotes(aliasTok.value);
        aliases.set(aliasName.toLowerCase(), tableName);
      }
    }
  }

  return { aliases, referencedTables, cteNames };
}

function formatRowCount(rowCount: number | undefined): string | undefined {
  if (rowCount === undefined || !Number.isFinite(rowCount)) return undefined;
  return `${rowCount.toLocaleString('en-US')} rows`;
}

function columnSecondaryBadge(col: SqlColumnSchema): string | undefined {
  const parts: string[] = [];
  if (col.pk || col.primaryKey) parts.push('PK');
  const fkTarget = col.fk ?? col.references;
  if (fkTarget) parts.push(`FK→${fkTarget}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function findTableCaseInsensitive(
  schema: SqlSchema | null | undefined,
  name: string
): SqlTableSchema | undefined {
  if (!schema) return undefined;
  const target = name.toLowerCase();
  return schema.tables.find((t) => t.name.toLowerCase() === target);
}

export function completeSql(
  sql: string,
  cursorOffset: number,
  schema?: SqlSchema | null,
  dialectOverride?: SqlDialect,
  maxItems = 40
): SqlCompletionItem[] {
  const dialect: SqlDialect = dialectOverride ?? schema?.dialect ?? 'postgres';
  const safeCursor = Math.max(0, Math.min(cursorOffset, sql.length));
  const beforeCursor = sql.slice(0, safeCursor);

  // Do not trigger inside comments or string literals
  const prefixTokens = tokenizeSql(beforeCursor, dialect);
  const lastRaw = prefixTokens[prefixTokens.length - 1];
  if (lastRaw && (lastRaw.type === 'comment' || lastRaw.type === 'string')) {
    return [];
  }

  const parsedCtx = extractTableAliases(sql, dialect);

  // 1. Check for `qualifier.partial` (e.g., `o.` or `orders.tot`)
  const dotMatch = /([A-Za-z_][A-Za-z0-9_$]*|"[^"]+")\.([A-Za-z0-9_$]*)$/.exec(beforeCursor);
  if (dotMatch) {
    const rawQualifier = stripIdentifierQuotes(dotMatch[1]);
    const partial = dotMatch[2];
    const partialLower = partial.toLowerCase();
    const replaceFrom = safeCursor - partial.length;
    const resolvedTableName =
      parsedCtx.aliases.get(rawQualifier.toLowerCase()) ?? rawQualifier;
    const tableSchema = findTableCaseInsensitive(schema, resolvedTableName);
    if (!tableSchema) return [];

    const items: SqlCompletionItem[] = [];
    for (const col of tableSchema.columns) {
      if (!partial || col.name.toLowerCase().startsWith(partialLower)) {
        items.push({
          label: col.name,
          insertText: col.name,
          kind: 'column',
          detail: col.type,
          badge: tableSchema.name,
          secondaryBadge: columnSecondaryBadge(col),
          description: col.comment,
          replaceFrom,
          replaceTo: safeCursor
        });
      }
    }
    return items.slice(0, maxItems);
  }

  // Extract current word prefix before cursor
  const wordMatch = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(beforeCursor);
  const prefix = wordMatch ? wordMatch[1] : '';
  const prefixLower = prefix.toLowerCase();
  const replaceFrom = safeCursor - prefix.length;

  // Determine active SQL clause before cursor
  const nonWsTokens = prefixTokens.filter((t) => t.type !== 'whitespace' && t.type !== 'comment');
  const searchEnd = prefix ? nonWsTokens.length - 2 : nonWsTokens.length - 1;
  let activeClause = '';
  const prevWord = searchEnd >= 0 ? nonWsTokens[searchEnd]?.value.toUpperCase() : '';
  for (let i = searchEnd; i >= 0; i--) {
    const u = nonWsTokens[i].value.toUpperCase();
    if (
      TABLE_CLAUSES.has(u) ||
      u === 'SELECT' || u === 'WHERE' || u === 'ON' || u === 'HAVING' ||
      u === 'GROUP' || u === 'ORDER' || u === 'SET' || u === 'RETURNING' || u === 'FILTER'
    ) {
      activeClause = u;
      break;
    }
    if (nonWsTokens[i].value === ';') break;
  }

  const matchesPrefix = (candidate: string): boolean => {
    if (!prefix) return true;
    return candidate.toLowerCase().startsWith(prefixLower);
  };

  const results: SqlCompletionItem[] = [];
  const seen = new Set<string>();
  const pushUnique = (item: SqlCompletionItem): void => {
    const key = `${item.kind}:${item.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  // 2. Immediately after `FROM`, `JOIN`, `UPDATE`, `INTO`, `TABLE`: prioritize tables & CTEs
  if (TABLE_CLAUSES.has(prevWord) || (TABLE_CLAUSES.has(activeClause) && prevWord === ',')) {
    if (schema) {
      for (const tbl of schema.tables) {
        if (matchesPrefix(tbl.name)) {
          pushUnique({
            label: tbl.name,
            insertText: tbl.name,
            kind: 'table',
            detail: 'table',
            badge: formatRowCount(tbl.rowCount),
            replaceFrom,
            replaceTo: safeCursor
          });
        }
      }
    }
    for (const cte of parsedCtx.cteNames) {
      if (matchesPrefix(cte)) {
        pushUnique({
          label: cte,
          insertText: cte,
          kind: 'cte',
          detail: 'CTE',
          replaceFrom,
          replaceTo: safeCursor
        });
      }
    }
    return results.slice(0, maxItems);
  }

  // If no prefix typed and not right after `FROM`/`JOIN`/`.`, don't spam popup unprompted
  if (!prefix) {
    return [];
  }

  // 3. Expression clauses (`SELECT`, `WHERE`, `ON`, `GROUP`, `HAVING`, `ORDER`, `SET`, `RETURNING`, `FILTER`):
  //    Suggest columns from referenced tables first, then other schema tables/columns, then functions, then keywords.
  if (schema) {
    const refLower = new Set(Array.from(parsedCtx.referencedTables, (t) => t.toLowerCase()));
    const prioritizedTables = [
      ...schema.tables.filter((t) => refLower.has(t.name.toLowerCase())),
      ...schema.tables.filter((t) => !refLower.has(t.name.toLowerCase()))
    ];

    for (const tbl of prioritizedTables) {
      for (const col of tbl.columns) {
        if (matchesPrefix(col.name)) {
          pushUnique({
            label: col.name,
            insertText: col.name,
            kind: 'column',
            detail: col.type,
            badge: tbl.name,
            secondaryBadge: columnSecondaryBadge(col),
            description: col.comment,
            replaceFrom,
            replaceTo: safeCursor
          });
        }
      }
    }

    for (const tbl of schema.tables) {
      if (matchesPrefix(tbl.name)) {
        pushUnique({
          label: tbl.name,
          insertText: tbl.name,
          kind: 'table',
          detail: 'table',
          badge: formatRowCount(tbl.rowCount),
          replaceFrom,
          replaceTo: safeCursor
        });
      }
    }

    if (schema.functions) {
      for (const fn of schema.functions) {
        if (matchesPrefix(fn.name)) {
          pushUnique({
            label: fn.name,
            insertText: `${fn.name}(`,
            kind: 'function',
            detail: fn.signature,
            description: fn.description,
            replaceFrom,
            replaceTo: safeCursor
          });
        }
      }
    }
  }

  // 4. Built-in SQL functions
  for (const fnName of getSqlBuiltinFunctions()) {
    if (matchesPrefix(fnName)) {
      pushUnique({
        label: fnName,
        insertText: `${fnName}(`,
        kind: 'function',
        detail: 'SQL function',
        replaceFrom,
        replaceTo: safeCursor
      });
    }
  }

  // 5. Dialect keywords
  for (const kw of getDialectKeywords(dialect)) {
    if (matchesPrefix(kw)) {
      pushUnique({
        label: kw,
        insertText: kw,
        kind: 'keyword',
        detail: dialect === 'postgres' ? 'PostgreSQL' : 'SQLite',
        replaceFrom,
        replaceTo: safeCursor
      });
    }
  }

  return results.slice(0, maxItems);
}
