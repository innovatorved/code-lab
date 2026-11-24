# `@innovatorved/code-lab` Roadmap

This roadmap tracks post-`v0.7.0` architectural and product milestones across the `code-lab` monorepo.

---

## Shipped in `v0.7.0`
- **SQL Studio & Relational Query Engine**: Built-in SQLite in-memory `JOIN`, table-alias, multi-column `GROUP BY`, and aggregate expression support alongside the `~17 KB` gzipped standalone SQL editor (`@innovatorved/code-lab/sql`).
- **Streamlined Workspace Architecture**: Consolidated to 7 active workspace packages (`@code-lab/{core,fs,settings,commands,sql,ui}` + `@code-lab/web`), minified extension & schema subpaths, and eliminated redundant bundle copies.
- **Workbench UI & Reliability Hardening**: Cleaned up topbar/breadcrumb/drawer density, fixed inline diff visibility, breadcrumb symbol detection, and container/Monaco listener lifecycle cleanup.

---

## Shipped in `v0.6.0`
- **Authentic VS Code Dark Modern & Light Modern Parity**: `vscode.dev` color tokens, Seti file icons, complete `0px` bottom-panel collapse across Close/shortcuts/status-bar/splitter drag, aligned Settings UI, and clean `35px` IDE topbar.
- **Real `@xterm/xterm` PTY & Split Terminal**: Full VT100 terminal emulator, side-by-side Split Terminal, clickable `file:line:col` links, interactive `stdin`, and `< 200ms` Worker `Ctrl+C` preemption.
- **Real `isomorphic-git` & Monaco Side-by-Side `DiffEditor`**: Durable IndexedDB `.git` object store, `.gitignore`, Myers hunk diffs, branch checkout/stash/reset/blame, and Monaco Side-by-Side/Inline `DiffEditor`.
- **Browser-Native Cross-File Language Intelligence**: Eager TypeScript multi-file sync, cross-file `F12`, Automatic Type Acquisition, JSON schemas, HTML/JSX auto-close, and CSS/SQL completions.

---

## Shipped in `v0.5.0`
- **VS Code 5-Region Layout Architecture**: Full layout fidelity with top Menu Bar / Title Bar, Activity Bar, Primary Side Bar, Editor Group with split tabs and breadcrumbs, Bottom Panel / Drawer, and Status Bar.
- **Strict Terminal Drawer Isolation & Non-Destructive Workspaces**: POSIX shell and PTY terminal isolated to `#cl-drawer`, plus dirty-workspace confirmation guards.

---

## Near-Term (`v0.8.x`)
- **Out-of-Process Plugin Host Worker**: Optional Web Worker sandbox for untrusted third-party plugins using structured RPC channels (`@code-lab/ui` + `@code-lab/core`).
- **OPFS Native Sync Access Handle Pool**: High-throughput synchronous `FileSystemSyncAccessHandle` bridge inside dedicated Web Workers for large SQLite/DuckDB database files (`> 100 MB`).
- **Visual `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` Flamegraph Widget**: Optional pluggable plan-tree renderer companion package (`@code-lab/sql-explain`).

---

## Medium-Term (`v0.9.x` — `v1.0.0`)
- **LSP-over-MessagePort Bridge**: Connect in-browser WASM language servers (TypeScript, Ruff/Pyright, SQLite/Postgres LSP) directly to editor diagnostics and completions.
- **Collaborative CRDT Buffer Sync**: Optional Yjs/Automerge adapter for multiplayer pair-programming labs.
- **`v1.0.0` API Freeze**: Stabilize `@innovatorved/code-lab` public APIs and subpath exports.
