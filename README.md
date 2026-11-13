# @innovatorved/code-lab

Modular browser-native IDE workbench (`v0.4.0`), Web Worker runtime (**Node.js**, **Bun**, **TypeScript**, **C++20 WASI**, **Python 3.12 WASI**), POSIX shell with 71 UNIX coreutils, and lightweight SQL playground (`@innovatorved/code-lab/sql`) built with strict TypeScript and Zod schemas — zero backend servers or `SharedArrayBuffer` headers required.

**Live Cloud IDE:** [code-lab-3dr.pages.dev](https://code-lab-3dr.pages.dev) · **Documentation Wiki:** [github.com/innovatorved/code-lab/wiki](https://github.com/innovatorved/code-lab/wiki)

---

## Highlights

- **Layered Modular Core**: 4-layer workspace architecture (`core` → `platform` → `services` → `ui`) with dependency injection, `.codelab/settings.json` + `.codelab/keybindings.json`, `<dialog>` Settings UI (`Cmd+,`), Dark / Light / High-Contrast themes, and declarative plugins.
- **SQL Editor & Playground (`~16.5 KB` gzipped)**: Standalone `@innovatorved/code-lab/sql` pack for `PostgreSQL 18` & `SQLite 3` (`inline` | `playground` | `workbench`), `formatSql`, schema-aware alias autocomplete, inline wavy diagnostics, and WCAG 2.1 AA keyboard navigation.
- **Node.js, Bun & WASI Toolchains**: Built-in JavaScript/JSX runtime with 50 built-in modules (50 Node.js built-ins) and Bun APIs (`Bun.serve`, `bun:test`, `bun:sqlite`), plus opt-in TypeScript, Clang/LLVM C++20 WASI, and Pyodide Python 3.12 extensions.
- **POSIX Shell & 71 Coreutils**: Interactive PTY terminal with pipelines, redirects, background `&` servers, `git clone` from public GitHub repos, `npm`/`pnpm`/`bun add`, and 71 UNIX commands (`grep`, `awk`, `jq`, `curl`, `hey`, `chaos`, `sqlite3`, `g++`, `pytest`, `serve`).
- **Guided Labs & Headless Grading**: Step-by-step coding & SQL challenges (`@innovatorved/code-lab/extensions/guided-lab`) with hints, Monaco side-by-side diffs, and zero-UI execution (`@innovatorved/code-lab/runtime`).

---

## Install

```bash
bun add @innovatorved/code-lab
# or
npm install @innovatorved/code-lab
```

Or load via CDN with zero build tools:

```html
<!-- Full IDE Workbench -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab.css" />
<script src="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab.js"></script>

<!-- Standalone SQL Pack (~16.5 KB gzipped JS + CSS) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab-sql.css" />
<script src="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab-sql.umd.js"></script>
```

---

## Quick Start

### Browser IDE Workbench

```ts
import CodeLab from '@innovatorved/code-lab';
import '@innovatorved/code-lab/code-lab.css';

const lab = CodeLab.mount('#editor', {
  id: 'http-demo',
  title: 'Bun HTTP Server',
  entry: 'server.ts',
  files: {
    'server.ts': 'Bun.serve({ port: 3000, fetch: () => Response.json({ ok: true }) });\n'
  }
});
```

### Lightweight SQL Inline Editor & Playground

```ts
import { createSqlEditor } from '@innovatorved/code-lab/sql';
import '@innovatorved/code-lab/sql.css';

const sql = createSqlEditor(document.getElementById('sql')!, {
  mode: 'inline', // 'inline' | 'playground'
  dialect: 'postgres',
  value: 'SELECT id, email FROM customers ORDER BY id LIMIT 10;',
  async onRun({ effectiveSql }) {
    console.log('Execute SQL:', effectiveSql);
  }
});
```

---

## Package Entrypoints

| Import Path | Purpose |
| :--- | :--- |
| `@innovatorved/code-lab` (+ `/code-lab.css`) | Full multi-file IDE workbench, POSIX terminal, Settings UI, plugins & Web Preview |
| `@innovatorved/code-lab/sql` (+ `/sql.css`) | Zero-dependency `PostgreSQL 18` + `SQLite 3` inline & playground editor (`~16.5 KB` gzip) |
| `@innovatorved/code-lab/runtime` | Headless Web Worker runtime for programmatic code & test execution |
| `@innovatorved/code-lab/shell` / `/terminal` | Pure-JS POSIX shell AST interpreter & 256-color PTY terminal engine |
| `@innovatorved/code-lab/schemas` | Zod runtime validation schemas & TypeScript types |
| `@innovatorved/code-lab/extensions/{guided-lab,typescript,cpp,python}` | Opt-in Guided Labs, TypeScript, C++20 WASI, and Python 3.12 WASI packs |
| `@innovatorved/code-lab/preview-sw.js` | Virtual loopback Service Worker (`/__preview/:port/*`) |

---

## Documentation (GitHub Wiki)

Full guides and API references live on the **[GitHub Wiki](https://github.com/innovatorved/code-lab/wiki)**:

- **[Home](https://github.com/innovatorved/code-lab/wiki)** — Overview & architecture diagram
- **[Quick Start](https://github.com/innovatorved/code-lab/wiki/Quick-Start)** — NPM, Bun, `<code-lab>` custom element, and CDN setup
- **[SQL Playground & Inline Editor](https://github.com/innovatorved/code-lab/wiki/SQL-Playground-and-Inline-Editor)** — `@innovatorved/code-lab/sql` reference
- **[Integration Guide](https://github.com/innovatorved/code-lab/wiki/Integration-Guide)** — React, Next.js (App Router), and Vite recipes
- **[Workbench Configuration](https://github.com/innovatorved/code-lab/wiki/Workbench-Configuration)** — Options, `.codelab/*` settings/keybindings, methods, events, and shortcuts
- **[Runtime APIs](https://github.com/innovatorved/code-lab/wiki/Runtime-APIs)** — Node.js v22, Bun v1.1, C++20 WASI, and Python 3.12 WASI
- **[POSIX Shell & Coreutils](https://github.com/innovatorved/code-lab/wiki/POSIX-Shell-and-Coreutils)** — Shell AST syntax and all 71 UNIX commands
- **[HTTP Servers & Networking](https://github.com/innovatorved/code-lab/wiki/HTTP-Servers-and-Networking)** — Loopback port table, background servers, `curl`, and Web Preview
- **[Headless Runtime](https://github.com/innovatorved/code-lab/wiki/Headless-Runtime)** — Zero-UI grading and programmatic test execution
- **[Authoring Guided Labs](https://github.com/innovatorved/code-lab/wiki/Authoring-Guided-Labs)** — Step-by-step challenges across JS, TS, C++20, Python 3.12, and SQL
- **[Plugin System](https://github.com/innovatorved/code-lab/wiki/Plugin-System)** — Declarative plugins, language packs, and event hooks
- **[Architecture & Monorepo](https://github.com/innovatorved/code-lab/wiki/Architecture-and-Monorepo)** — Workspace packages, DI container, and VFS storage backends

---

## Development

```bash
bun install
bun run build                  # Build all ESM/CJS/UMD bundles & .d.ts declarations
bun run check:boundaries       # Verify 4-layer package DAG & 0 circular imports
bun run check:size             # Enforce gzip bundle size budgets
bun run test:all               # Run all 47 suites + Playwright (Chromium, Firefox, WebKit)
node tests/run-all.js          # Run the same 47 suites under Node 20 / 22 / 24
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contribution guidelines.

---

## License

MIT © [Ved Gupta](https://vedgupta.in)
