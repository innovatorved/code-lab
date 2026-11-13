# `@code-lab/sql` (`@innovatorved/code-lab/sql`)

Zero-dependency lightweight SQL playground & inline editor (`< 35 KB` gzipped JS + CSS combined, zero WASM boot of its own) built for **PostgreSQL 18** and **SQLite 3**.

## Features

- **Chrome Modes**: `'inline'` (compact auto-height lesson blocks, safe for 5+ mounts per page) and `'playground'` (responsive split pane stacking `< 768px`, `>= 16px` touch font size on `pointer: coarse` devices).
- **Dialect Language Pack**: PostgreSQL 18 (`::type`, `$1`, `$$` dollar quotes, `ILIKE`, `LATERAL`, `RETURNING`, `FILTER`, JSONB `->`/`->>`/`@>`) and SQLite 3 (`PRAGMA`, `WITHOUT ROWID`, `ON CONFLICT DO UPDATE`, `GLOB`, backtick/bracket identifiers).
- **Zero-Dep Formatter**: `formatSql(sql, { dialect, indent: 2, keywordCase: 'upper' })`.
- **Schema-Aware Alias Autocomplete**: Resolves `FROM customers c JOIN orders o` so typing `o.` suggests `orders` columns with `type`, `PK`, and `FK→...` badges.
- **Inline Error Diagnostics**: `parseSqlEngineError(err, sql, dialect)` + `setDiagnostics()` renders wavy token underlines, gutter dots, and `aria-describedby` / `aria-invalid` status banners.
- **WCAG 2.1 AA Keyboard Navigation**: `Esc` toggles `Tab moves focus` mode (zero keyboard trap) + IME-safe `Enter` handling.
