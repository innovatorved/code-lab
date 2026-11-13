# `@innovatorved/code-lab` Roadmap

This roadmap tracks post-`v0.4.0` architectural and product milestones across the `code-lab` monorepo.

---

## Shipped in `v0.4.0`
- **4-Layer Modular Monorepo (`packages/*` + `apps/web`)**: `core` → `platform (fs, settings, commands)` → `services (sql, editor, runtime, terminal, preview)` → `ui` → `apps/web`, enforced by `tools/check-boundaries.js`.
- **First-Class SQL Playground & Inline Editor (`@innovatorved/code-lab/sql`)**: `~16.5 KB` gzipped (JS + CSS), `PostgreSQL 18` & `SQLite 3` dialects, zero-dependency SQL formatter, schema-aware table-alias autocomplete, inline wavy error diagnostics, WCAG 2.1 AA keyboard escape (`Esc` → `Tab`), and Guided Lab `sqlRunner` integration.
- **4-Scope Configuration & Workspace Protocol (`.codelab/*`)**: JSONC parser, JSON Schema validator, `<dialog closedby="any">` Settings UI (`Cmd+,`), `.codelab/settings.json`, `.codelab/keybindings.json`, `.codelab/tasks.json`, and `.codelab/extensions.json`.
- **Declarative Plugin System & Observability**: Lazy `activationEvents`, `contributes.{commands,settings,keybindings,themes,panels,languages}`, error boundaries, and live event-bus/log inspector.

---

## Near-Term (`v0.5.x`)
- **Out-of-Process Plugin Host Worker**: Optional Web Worker sandbox for untrusted third-party plugins using structured RPC channels (`@code-lab/ui` + `@code-lab/core`).
- **OPFS Native Sync Access Handle Pool**: High-throughput synchronous `FileSystemSyncAccessHandle` bridge inside dedicated Web Workers for large SQLite/DuckDB database files (`> 100 MB`).
- **Visual `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` Flamegraph Widget**: Optional pluggable plan-tree renderer companion package (`@code-lab/sql-explain`).

---

## Medium-Term (`v0.6.x` — `v1.0.0`)
- **LSP-over-MessagePort Bridge**: Connect in-browser WASM language servers (TypeScript, Ruff/Pyright, SQLite/Postgres LSP) directly to `IEditorService` diagnostics and completions.
- **Collaborative CRDT Buffer Sync**: Optional Yjs/Automerge adapter on `EditorModel` (`@code-lab/editor`) for multiplayer pair-programming labs.
- **`v1.0.0` API Freeze**: Stabilize `@code-lab/*` workspace package exports as independently versioned public npm packages.
