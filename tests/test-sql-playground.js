#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * First-Class SQL Playground & Inline Editor Suite (`@innovatorved/code-lab/sql`)
 *
 * Verifies every requirement for `sql-in-depth` integration:
 *   1. Bundle budget: `dist/code-lab-sql.umd.js` + `dist/code-lab-sql.css` < 35 KB gzipped,
 *      zero WASM binaries bundled, CJS/UMD + global `CodeLab.createSqlEditor` parity
 *   2. PostgreSQL 18 & SQLite 3 tokenizer + HTML syntax highlighter
 *   3. Zero-dependency `formatSql` formatter (keyword case, indentation, idempotence)
 *   4. Schema-aware `extractTableAliases` & `completeSql` (`SELECT o.` -> `orders` columns,
 *      PK/FK badges, CTEs, no completions inside strings/comments)
 *   5. `parseSqlEngineError` for PostgreSQL/PGlite (`position`, `LINE N:`, `HINT:`)
 *      and SQLite (`near "..."`)
 *   6. `createSqlEditor` (`inline` x 5 instances + `playground` mode): `Cmd+Enter`
 *      selection vs full query (`effectiveSql`), `Shift+Alt+F` format, `Cmd+/` comment
 *      toggle, `Esc` -> `Tab` focus escape (WCAG 2.1.2), `insertAtCursor`, wavy
 *      diagnostics + ARIA live announcement, light/dark theme sync
 *   7. `CodeLabWorkbench` Guided Lab (`lang: 'sql'`): single-file explorer hiding,
 *      custom `sqlRunner` 3-step verification, and built-in SQLite fallback
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { DOMEvent, doc, localStorageStore } = require('./helpers/mock-dom.js');
const loader = require('./helpers/load.js');

const CodeLab = loader.loadCodeLab();
const CodeLabSql = loader.sqlStandalone;
const { CodeLabWorkbench } = CodeLab;

const ECOMMERCE_SCHEMA = {
  dialect: 'postgres',
  tables: [
    {
      name: 'customers',
      rowCount: 12500,
      columns: [
        { name: 'id', type: 'bigint', primaryKey: true, nullable: false },
        { name: 'email', type: 'text', nullable: false },
        { name: 'tier', type: 'text', nullable: true }
      ]
    },
    {
      name: 'orders',
      rowCount: 84000,
      columns: [
        { name: 'id', type: 'bigint', primaryKey: true, nullable: false },
        { name: 'customer_id', type: 'bigint', references: 'customers.id', nullable: false },
        { name: 'total_cents', type: 'integer', nullable: false },
        { name: 'payload', type: 'jsonb', nullable: true },
        { name: 'created_at', type: 'timestamptz', nullable: false }
      ]
    }
  ],
  functions: [
    { name: 'date_trunc', signature: 'date_trunc(field, source)', returnType: 'timestamptz', description: 'Truncate timestamp' }
  ]
};

let passed = 0;
const failures = [];

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err && err.stack ? err.stack : err}`);
  }
}

function fireKey(target, init) {
  const ev = new DOMEvent('keydown', { bubbles: true, cancelable: true });
  Object.assign(ev, {
    key: init.key,
    ctrlKey: Boolean(init.ctrlKey),
    metaKey: Boolean(init.metaKey),
    shiftKey: Boolean(init.shiftKey),
    altKey: Boolean(init.altKey),
    isComposing: Boolean(init.isComposing),
    keyCode: init.keyCode || 0
  });
  target.dispatchEvent(ev);
  return ev;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   SQL Playground & Inline Editor Suite (@innovatorved/code-lab/sql)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  await runTest('[S1] Standalone SQL bundle gzip size is < 35 KB (JS + CSS combined) with zero WASM overhead', () => {
    const jsPath = path.join(loader.DIST, 'code-lab-sql.umd.js');
    const esmPath = path.join(loader.DIST, 'code-lab-sql.esm.js');
    const cssPath = path.join(loader.DIST, 'code-lab-sql.css');
    const dtsPath = path.join(loader.DIST, 'code-lab-sql.d.ts');

    assert.ok(fs.existsSync(jsPath), 'dist/code-lab-sql.umd.js exists');
    assert.ok(fs.existsSync(esmPath), 'dist/code-lab-sql.esm.js exists');
    assert.ok(fs.existsSync(cssPath), 'dist/code-lab-sql.css exists');
    assert.ok(fs.existsSync(dtsPath), 'dist/code-lab-sql.d.ts exists');

    const jsRaw = fs.readFileSync(jsPath);
    const cssRaw = fs.readFileSync(cssPath);
    const combinedGzipBytes = zlib.gzipSync(jsRaw).byteLength + zlib.gzipSync(cssRaw).byteLength;
    const combinedKb = combinedGzipBytes / 1024;
    console.log(`      → code-lab-sql gzipped (UMD JS + CSS): ${combinedKb.toFixed(2)} KB (budget: 35.00 KB)`);
    assert.ok(combinedGzipBytes < 35 * 1024, `Expected < 35 KB gzipped, got ${combinedKb.toFixed(2)} KB`);

    const jsText = jsRaw.toString('utf8');
    assert.equal(jsText.includes('WebAssembly.instantiate'), false, 'SQL editor bundle must not boot WASM');
    assert.equal(typeof CodeLab.createSqlEditor, 'function', 'Umbrella attaches CodeLab.createSqlEditor');
    assert.equal(typeof CodeLabSql.createSqlEditor, 'function', 'Standalone exposes CodeLabSql.createSqlEditor');
    assert.equal(typeof CodeLabSql.formatSql, 'function', 'Standalone exposes CodeLabSql.formatSql');
  });

  await runTest('[S2] PostgreSQL 18 and SQLite 3 tokenizers accurately classify dialect-specific syntax', () => {
    const pgSql = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH RECURSIVE regional AS (
        SELECT o.id::text, o.payload->>'region' AS reg, $1::int AS min_total, $$raw$dollar$$ AS tag
        FROM orders o
        LEFT JOIN LATERAL (SELECT 1) sub ON true
        WHERE o.payload @> '{"vip":true}' AND o.payload->>'email' ILIKE '%@acme.io'
      )
      SELECT COUNT(*) FILTER (WHERE min_total > 0) OVER (PARTITION BY reg ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
      FROM regional RETURNING *;
    `;
    const pgTokens = CodeLabSql.tokenizeSql(pgSql, 'postgres');
    assert.ok(pgTokens.some((t) => t.type === 'cast' && t.value === '::text'), 'Postgres ::type cast token');
    assert.ok(pgTokens.some((t) => t.type === 'param' && t.value === '$1'), 'Postgres $1 parameter token');
    assert.ok(pgTokens.some((t) => t.type === 'string' && t.value === '$$raw$dollar$$'), 'Postgres $$ dollar string');
    assert.ok(pgTokens.some((t) => t.type === 'operator' && t.value === '->>'), 'Postgres ->> JSONB operator');
    assert.ok(pgTokens.some((t) => t.type === 'operator' && t.value === '@>'), 'Postgres @> JSONB operator');
    assert.ok(pgTokens.some((t) => t.type === 'keyword' && t.value.toUpperCase() === 'LATERAL'), 'Postgres LATERAL');
    assert.ok(pgTokens.some((t) => t.type === 'keyword' && t.value.toUpperCase() === 'ILIKE'), 'Postgres ILIKE');

    const sqliteSql = `
      PRAGMA foreign_keys = ON;
      EXPLAIN QUERY PLAN
      CREATE TABLE \`kv_cache\` ([item_key] TEXT PRIMARY KEY, val BLOB) WITHOUT ROWID;
      INSERT INTO \`kv_cache\` VALUES ('k1', x'cafe') ON CONFLICT(item_key) DO UPDATE SET val = excluded.val
      WHERE item_key GLOB 'k*';
    `;
    const liteTokens = CodeLabSql.tokenizeSql(sqliteSql, 'sqlite');
    assert.ok(liteTokens.some((t) => t.type === 'keyword' && t.value.toUpperCase() === 'PRAGMA'), 'SQLite PRAGMA');
    assert.ok(liteTokens.some((t) => t.type === 'keyword' && t.value.toUpperCase() === 'GLOB'), 'SQLite GLOB');
    assert.ok(liteTokens.some((t) => t.type === 'quoted-ident' && t.value === '`kv_cache`'), 'SQLite backtick ident');
    assert.ok(liteTokens.some((t) => t.type === 'quoted-ident' && t.value === '[item_key]'), 'SQLite bracket ident');

    const html = CodeLabSql.highlightSql("SELECT '<script>alert(1)</script>' FROM orders;", 'postgres');
    assert.equal(html.includes('<script>'), false, 'highlightSql escapes HTML entities safely');
  });

  await runTest('[S3] Built-in SQL formatter uppercases keywords, indents clauses, preserves literals, and is idempotent', () => {
    const messy = "select c.email, count(o.id) as order_cnt from customers c inner join orders o on o.customer_id = c.id where c.tier = 'select from where' group by c.email order by order_cnt desc limit 10;";
    const formattedOnce = CodeLabSql.formatSql(messy, { dialect: 'postgres', indent: 2, keywordCase: 'upper' });
    const formattedTwice = CodeLabSql.formatSql(formattedOnce, { dialect: 'postgres', indent: 2, keywordCase: 'upper' });

    assert.equal(formattedOnce, formattedTwice, 'formatSql must be idempotent');
    assert.match(formattedOnce, /^SELECT\b/);
    assert.match(formattedOnce, /\nFROM customers c/);
    assert.match(formattedOnce, /\nINNER JOIN orders o/);
    assert.match(formattedOnce, /\nWHERE c\.tier = 'select from where'/);
    assert.match(formattedOnce, /\nGROUP BY c\.email/);
    assert.match(formattedOnce, /\nORDER BY order_cnt DESC/);
  });

  await runTest('[S4] Schema-aware autocomplete resolves table aliases (SELECT o.), CTEs, PK/FK badges, and suppresses in strings/comments', () => {
    const query = 'WITH recent_cte AS (SELECT 1) SELECT o. FROM customers c JOIN orders o ON o.customer_id = c.id';
    const dotOffset = query.indexOf('o.') + 2;

    const items = CodeLabSql.completeSql(query, dotOffset, ECOMMERCE_SCHEMA, 'postgres');
    const labels = items.map((it) => it.label);
    assert.deepEqual(
      labels,
      ['id', 'customer_id', 'total_cents', 'payload', 'created_at'],
      'typing o. must resolve alias o -> orders columns'
    );
    const pkCol = items.find((it) => it.label === 'id');
    const fkCol = items.find((it) => it.label === 'customer_id');
    assert.equal(pkCol.secondaryBadge, 'PK');
    assert.equal(fkCol.secondaryBadge, 'FK→customers.id');

    // FROM clause suggests schema tables + CTEs
    const fromQuery = 'WITH active_users AS (SELECT 1) SELECT * FROM ';
    const fromItems = CodeLabSql.completeSql(fromQuery, fromQuery.length, ECOMMERCE_SCHEMA, 'postgres');
    assert.ok(fromItems.some((it) => it.kind === 'table' && it.label === 'orders'));
    assert.ok(fromItems.some((it) => it.kind === 'cte' && it.label === 'active_users'));

    // Never suggest inside string literal or line comment
    const inStr = "SELECT 'o.";
    assert.equal(CodeLabSql.completeSql(inStr, inStr.length, ECOMMERCE_SCHEMA, 'postgres').length, 0);
    const inComment = 'SELECT 1 -- o.';
    assert.equal(CodeLabSql.completeSql(inComment, inComment.length, ECOMMERCE_SCHEMA, 'postgres').length, 0);
  });

  await runTest('[S5] parseSqlEngineError maps PostgreSQL/PGlite POSITION + HINT and SQLite near "..." to exact token spans', () => {
    const badPg = 'SELECT id,\n       totl_cents\nFROM orders;';
    const pos = badPg.indexOf('totl_cents') + 1; // 1-based Postgres position
    const pgDiag = CodeLabSql.parseSqlEngineError(
      {
        message: 'ERROR: column "totl_cents" does not exist\nHINT: Perhaps you meant to reference the column "orders.total_cents".',
        position: String(pos)
      },
      badPg,
      'postgres'
    );
    assert.equal(pgDiag.line, 2);
    assert.equal(badPg.slice(pgDiag.fromOffset, pgDiag.toOffset), 'totl_cents');
    assert.match(pgDiag.hint || '', /orders\.total_cents/);

    const badSqlite = 'SELECT id FORM orders;';
    const liteDiag = CodeLabSql.parseSqlEngineError(
      new Error('SQLITE_ERROR: near "FORM": syntax error'),
      badSqlite,
      'sqlite'
    );
    assert.equal(liteDiag.line, 1);
    assert.equal(badSqlite.slice(liteDiag.fromOffset, liteDiag.toOffset), 'FORM');
  });

  await runTest('[S6] createSqlEditor mounts 5+ inline instances safely and handles Cmd+Enter selection, format, comment toggle, Esc->Tab, and diagnostics', () => {
    // Mount 5 inline SQL editors on the same page simultaneously
    const inlineInstances = [];
    for (let i = 0; i < 5; i++) {
      const box = doc.createElement('div');
      doc.body.appendChild(box);
      const ed = CodeLabSql.createSqlEditor(box, {
        mode: 'inline',
        dialect: 'postgres',
        value: `SELECT ${i + 1} AS step_num;`,
        minLines: 2,
        maxLines: 8
      });
      inlineInstances.push(ed);
      assert.equal(box.querySelectorAll('.cl-sql-textarea').length, 1);
      assert.equal(box.querySelectorAll('.cl-sql-toolbar').length, 0, 'inline mode hides heavy toolbar by default');
    }
    assert.equal(inlineInstances[4].getValue(), 'SELECT 5 AS step_num;');
    for (const ed of inlineInstances) ed.destroy();

    // Full playground editor ergonomics & accessibility test
    const host = doc.createElement('div');
    doc.body.appendChild(host);
    const runCalls = [];
    const editor = CodeLabSql.createSqlEditor(host, {
      mode: 'playground',
      dialect: 'postgres',
      schema: ECOMMERCE_SCHEMA,
      theme: 'light',
      value: 'select id from customers;\nselect count(*) from orders;',
      onRun: (payload) => runCalls.push(payload)
    });

    const rootEl = host.querySelector('.cl-sql-root');
    const textarea = host.querySelector('.cl-sql-textarea');
    assert.equal(rootEl.getAttribute('data-theme'), 'light');
    assert.equal(textarea.getAttribute('role'), 'textbox');
    assert.equal(textarea.getAttribute('aria-multiline'), 'true');

    // 1. Cmd+Enter with selection runs ONLY selectedSql as effectiveSql
    const fullVal = editor.getValue();
    const secondStmtStart = fullVal.indexOf('select count(*)');
    textarea.selectionStart = secondStmtStart;
    textarea.selectionEnd = fullVal.length;
    fireKey(textarea, { key: 'Enter', metaKey: true });
    assert.equal(runCalls.length, 1);
    assert.equal(runCalls[0].selectedSql, 'select count(*) from orders;');
    assert.equal(runCalls[0].effectiveSql, 'select count(*) from orders;');
    assert.equal(runCalls[0].sql, fullVal);

    // 2. IME composition guard: Enter while composing must NOT trigger run
    fireKey(textarea, { key: 'Enter', metaKey: true, isComposing: true });
    assert.equal(runCalls.length, 1, 'IME composition Enter must not submit query');

    // 3. Shift+Alt+F formats SQL
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;
    fireKey(textarea, { key: 'F', shiftKey: true, altKey: true });
    assert.match(editor.getValue(), /^SELECT\s+id\nFROM customers;/);

    // 4. Cmd+/ toggles `-- ` line comment on and off
    textarea.selectionStart = 0;
    textarea.selectionEnd = 6;
    fireKey(textarea, { key: '/', metaKey: true });
    assert.match(editor.getValue(), /^-- SELECT/);
    fireKey(textarea, { key: '/', metaKey: true });
    assert.match(editor.getValue(), /^SELECT/);

    // 5. Esc enables Tab-moves-focus mode (WCAG 2.1.2 no keyboard trap)
    fireKey(textarea, { key: 'Escape' });
    const tabAfterEsc = fireKey(textarea, { key: 'Tab' });
    assert.equal(tabAfterEsc.defaultPrevented, false, 'After Esc, Tab must not preventDefault so focus leaves editor');

    // 6. Diagnostics wavy underline + ARIA live region + clearDiagnostics
    const diag = CodeLabSql.parseSqlEngineError(
      new Error('SQLITE_ERROR: near "customers": table missing'),
      editor.getValue(),
      'sqlite'
    );
    editor.setDiagnostics([diag]);
    assert.ok(host.querySelector('.cl-sql-diag-error'), 'backdrop renders wavy error span');
    const diagBanner = host.querySelector('.cl-sql-diagnostics');
    assert.equal(diagBanner.getAttribute('data-visible'), 'true');
    editor.clearDiagnostics();
    assert.equal(diagBanner.getAttribute('data-visible'), 'false');

    // 7. insertAtCursor for clickable schema pills
    editor.setValue('SELECT  FROM orders;');
    textarea.selectionStart = 7;
    textarea.selectionEnd = 7;
    editor.insertAtCursor('total_cents');
    assert.equal(editor.getValue(), 'SELECT total_cents FROM orders;');

    editor.destroy();
  });

  await runTest('[S7] CodeLabWorkbench supports SQL Guided Labs (single-file chrome, custom sqlRunner, and built-in SQLite fallback)', async () => {
    localStorageStore.clear();
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const runnerRequests = [];
    const wb = new CodeLabWorkbench(mountEl, {
      lang: 'sql',
      sqlDialect: 'postgres',
      persistState: false,
      code: 'SELECT id, total_cents FROM orders WHERE total_cents > 1000;',
      steps: [
        { id: 'step-1', title: 'Filter High-Value Orders', instructions: 'Select orders above 1000 cents.' },
        { id: 'step-2', title: 'Aggregate by Customer', instructions: 'Group totals by customer_id.' }
      ],
      sqlRunner: async (req) => {
        runnerRequests.push(req);
        return {
          columns: ['id', 'total_cents'],
          rows: [[101, 4500], [102, 8900]],
          rowCount: 2,
          durationMs: 1.8,
          verification: {
            passed: true,
            message: 'Step 1 verified: 2 high-value orders returned.'
          }
        };
      }
    });

    assert.equal(
      mountEl.classList.contains('is-sql-single-file') ||
        Boolean(mountEl.querySelector('.is-sql-single-file')),
      true,
      'single-file SQL workbench hides multi-file explorer noise'
    );

    const res = await wb.runSql('verify');
    assert.equal(runnerRequests.length, 1);
    assert.equal(runnerRequests[0].dialect, 'postgres');
    assert.equal(runnerRequests[0].mode, 'verify');
    assert.equal(res.rowCount, 2);
    assert.equal(wb.completedSteps.has('step-1'), true, 'passing sqlRunner verification marks Guided Lab step complete');

    const tableHtml = mountEl.innerHTML;
    assert.ok(tableHtml.includes('cl-sql-results-table'), 'workbench renders semantic SQL results table');
    assert.ok(tableHtml.includes('4500') && tableHtml.includes('8900'), 'SQL result cells rendered');
    wb.destroy();

    // Built-in SQLite fallback when no custom `sqlRunner` is supplied
    const fallbackEl = doc.createElement('div');
    doc.body.appendChild(fallbackEl);
    const wbFallback = new CodeLabWorkbench(fallbackEl, {
      lang: 'sql',
      sqlDialect: 'sqlite',
      persistState: false,
      code: `
        CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);
        INSERT INTO items (id, name) VALUES (1, 'B-Tree'), (2, 'WAL');
        SELECT id, name FROM items ORDER BY id;
      `
    });
    const fallbackRes = await wbFallback.runSql('run');
    assert.equal(fallbackRes.rowCount, 2);
    assert.deepEqual(fallbackRes.columns, ['id', 'name']);
    wbFallback.destroy();
  });

  console.log('\n' + '─'.repeat(78));
  if (failures.length > 0) {
    console.error(`SQL Playground Suite FAILED: ${passed} passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`SQL Playground Suite PASSED: ${passed}/${passed} assertions green`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
