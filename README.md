# @innovatorved/code-lab

Modular browser-native IDE workbench (`v0.4.0`), Web Worker runtime for Node.js, Bun, TypeScript, C++20 WebAssembly, and Python 3.12 WebAssembly, POSIX shell with 71 UNIX coreutils, and lightweight SQL playground built with strict TypeScript and Zod schemas — zero backend servers or cross-origin isolation headers required.

**Live Cloud IDE:** [code-lab-3dr.pages.dev](https://code-lab-3dr.pages.dev) · **Documentation Wiki:** [github.com/innovatorved/code-lab/wiki](https://github.com/innovatorved/code-lab/wiki)

---

## Highlights

- **Layered Modular Core**: Four-layer workspace architecture with dependency injection, workspace settings and custom keybindings, a visual Settings dialog, Dark, Light, and High-Contrast themes, and lazy-loaded plugins.
- **SQL Editor & Playground (~16.5 KB gzipped)**: Standalone PostgreSQL 18 and SQLite 3 editor supporting inline lesson blocks, split-pane query studios, SQL formatting, schema-aware alias autocomplete, inline wavy diagnostics, and accessible keyboard navigation.
- **Node.js, Bun & WebAssembly Toolchains**: Built-in JavaScript and JSX runtime with 50 built-in modules (50 Node.js built-ins) and native Bun APIs, plus opt-in TypeScript, Clang/LLVM C++20 WebAssembly, and Pyodide Python 3.12 extensions.
- **POSIX Shell & 71 Coreutils**: Multi-session terminal with pipelines, stream redirection, background servers, public GitHub repository cloning, package installation, HTTP load testing, and 71 UNIX commands.
- **Guided Labs & Headless Grading**: Step-by-step coding and SQL challenges with progressive hints, side-by-side solution diffs, and zero-UI headless worker execution.

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
  mode: 'inline',
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
| `@innovatorved/code-lab` | Full multi-file IDE workbench, POSIX terminal, Settings UI, plugins, and Web Preview |
| `@innovatorved/code-lab/code-lab.css` | Main workbench stylesheet |
| `@innovatorved/code-lab/sql` | Zero-dependency PostgreSQL 18 and SQLite 3 inline and playground editor (~16.5 KB gzipped) |
| `@innovatorved/code-lab/sql.css` | Standalone SQL editor stylesheet |
| `@innovatorved/code-lab/runtime` | Headless Web Worker runtime for programmatic code and test execution |
| `@innovatorved/code-lab/shell` | Pure-JavaScript POSIX shell interpreter and 71 UNIX utilities |
| `@innovatorved/code-lab/terminal` | 256-color PTY terminal emulator engine |
| `@innovatorved/code-lab/schemas` | Zod runtime validation schemas and TypeScript types |
| `@innovatorved/code-lab/extensions/*` | Opt-in extensions for Guided Labs, TypeScript, C++20 WebAssembly, and Python 3.12 WebAssembly |
| `@innovatorved/code-lab/preview-sw.js` | Virtual loopback Service Worker for standalone browser preview tabs |

---

## Documentation (GitHub Wiki)

Full guides and API references live on the **[GitHub Wiki](https://github.com/innovatorved/code-lab/wiki)**:

- **[Home](https://github.com/innovatorved/code-lab/wiki)** — Overview and architecture diagram
- **[Quick Start](https://github.com/innovatorved/code-lab/wiki/Quick-Start)** — Package installation, custom HTML element, and CDN setup
- **[SQL Playground & Inline Editor](https://github.com/innovatorved/code-lab/wiki/SQL-Playground-and-Inline-Editor)** — Inline blocks, playgrounds, PostgreSQL and SQLite dialects, and autocomplete
- **[Integration Guide](https://github.com/innovatorved/code-lab/wiki/Integration-Guide)** — React, Next.js App Router, and Vite integration recipes
- **[Workbench Configuration](https://github.com/innovatorved/code-lab/wiki/Workbench-Configuration)** — Mount options, workspace settings, methods, and keyboard shortcuts
- **[Runtime APIs](https://github.com/innovatorved/code-lab/wiki/Runtime-APIs)** — Node.js v22, Bun v1.1, C++20 WebAssembly, and Python 3.12 WebAssembly
- **[POSIX Shell & Coreutils](https://github.com/innovatorved/code-lab/wiki/POSIX-Shell-and-Coreutils)** — Shell syntax and all 71 built-in UNIX commands
- **[HTTP Servers & Networking](https://github.com/innovatorved/code-lab/wiki/HTTP-Servers-and-Networking)** — Loopback port table, background servers, load testing, and Web Preview
- **[Headless Runtime](https://github.com/innovatorved/code-lab/wiki/Headless-Runtime)** — Zero-UI grading and programmatic test execution
- **[Authoring Guided Labs](https://github.com/innovatorved/code-lab/wiki/Authoring-Guided-Labs)** — Step-by-step challenges across JavaScript, TypeScript, C++20, Python 3.12, and SQL
- **[Plugin System](https://github.com/innovatorved/code-lab/wiki/Plugin-System)** — Declarative plugins, language packs, and lifecycle hooks
- **[Architecture & Monorepo](https://github.com/innovatorved/code-lab/wiki/Architecture-and-Monorepo)** — Workspace layers, dependency injection, and virtual filesystem backends

---

## Development

```bash
bun install
bun run build                  # Build all ESM, CJS, UMD bundles and TypeScript declarations
bun run check:boundaries       # Verify 4-layer package boundaries and zero circular imports
bun run check:size             # Enforce gzip bundle size budgets
bun run test:all               # Run all 47 suites plus Playwright browser tests
node tests/run-all.js          # Run the same 47 suites under Node 20, 22, and 24
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

---

## License

MIT © [Ved Gupta](https://vedgupta.in)
