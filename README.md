# @innovatorved/code-lab

[![CI](https://github.com/innovatorved/code-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/innovatorved/code-lab/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@innovatorved/code-lab.svg)](https://www.npmjs.com/package/@innovatorved/code-lab)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live Cloud IDE](https://img.shields.io/badge/Live_Demo-code--lab.vedgupta.in-000000)](https://code-lab.vedgupta.in/)

Modular browser-native IDE workbench (`v0.7.0`), Web Worker runtime for Node.js, Bun, TypeScript, C++20 WebAssembly, and Python 3.12 WebAssembly, POSIX shell with 73 UNIX coreutils, and lightweight SQL playground built with strict TypeScript and Zod schemas — zero backend servers or cross-origin isolation headers required.

**[Try the Live Cloud IDE →](https://code-lab.vedgupta.in/)**


## Highlights

- **Layered Modular Core**: Four-layer workspace architecture with dependency injection, workspace settings and custom keybindings, a visual Settings dialog, Dark, Light, and High-Contrast themes, and lazy-loaded plugins.
- **SQL Editor & Playground (~16.5 KB gzipped)**: Standalone PostgreSQL 18 and SQLite 3 editor supporting inline lesson blocks, split-pane query studios, SQL formatting, schema-aware alias autocomplete, inline wavy diagnostics, and accessible keyboard navigation.
- **Node.js, Bun & WebAssembly Toolchains**: Built-in JavaScript and JSX runtime with 50 built-in modules (50 Node.js built-ins) and native Bun APIs, plus opt-in TypeScript, Clang/LLVM C++20 WebAssembly, and Pyodide Python 3.12 extensions.
- **POSIX Shell & 73 Coreutils**: Multi-session terminal with pipelines, stream redirection, background servers, public GitHub repository cloning, package installation, HTTP load testing, and 73 UNIX commands.
- **Guided Labs & Headless Grading**: Step-by-step coding and SQL challenges with progressive hints, side-by-side solution diffs, and zero-UI headless worker execution.


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
  lang: 'ts', // 'js' | 'ts' | 'sql' | 'py' | 'cpp'
  showLanguageSelector: true,
  entry: 'server.ts',
  // Pass user-customizable settings on init (or use `overrides` / `lockSettings: true` to lock them)
  settings: {
    'workbench.colorTheme': 'dark',
    'editor.fontSize': 14,
    'terminal.fontSize': 13,
    'sql.defaultDialect': 'postgres'
  },
  files: {
    'server.ts': 'Bun.serve({ port: 3000, fetch: () => Response.json({ ok: true }) });\n'
  }
});
```

Foreground servers started in the terminal (`serve`, `npm run dev`, `node server.js`, `bun run server.ts`) hold the terminal open until `Ctrl+C` (`SIGINT`) and automatically free their virtual port on exit. Append `&` (e.g., `node server.js &`) or open a second terminal session (`+`) to run commands concurrently.

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


## Package Entrypoints

| Import Path | Purpose |
| :--- | :--- |
| `@innovatorved/code-lab` | Full multi-file IDE workbench, POSIX terminal, Settings UI, plugins, and Web Preview |
| `@innovatorved/code-lab/code-lab.css` | Main workbench stylesheet |
| `@innovatorved/code-lab/sql` | Zero-dependency PostgreSQL 18 and SQLite 3 inline and playground editor (~16.5 KB gzipped) |
| `@innovatorved/code-lab/sql.css` | Standalone SQL editor stylesheet |
| `@innovatorved/code-lab/runtime` | Headless Web Worker runtime for programmatic code and test execution |
| `@innovatorved/code-lab/shell` | Pure-JavaScript POSIX shell interpreter and 73 UNIX utilities |
| `@innovatorved/code-lab/terminal` | 256-color PTY terminal emulator engine |
| `@innovatorved/code-lab/schemas` | Zod runtime validation schemas and TypeScript types |
| `@innovatorved/code-lab/extensions/*` | Opt-in extensions for Guided Labs, TypeScript, C++20 WebAssembly, and Python 3.12 WebAssembly |
| `@innovatorved/code-lab/preview-sw.js` | Virtual loopback Service Worker for standalone browser preview tabs |


Full guides and API references live on the **[GitHub Wiki](https://github.com/innovatorved/code-lab/wiki)**.


## Embed Examples

Ready-to-copy starters live in `examples/`:
- [`examples/vanilla-embed.html`](./examples/vanilla-embed.html) — Zero-build CDN embed with customizable `settings`, language switcher, and Bun/TS server.
- [`examples/react-embed.tsx`](./examples/react-embed.tsx) — Reusable React / Next.js client component wrapper.
- [`examples/guided-lab-embed.html`](./examples/guided-lab-embed.html) — Step-by-step Guided Lab with hints, starter/solution files, and tests.
- [`examples/sql-playground-embed.html`](./examples/sql-playground-embed.html) — Standalone PostgreSQL / SQLite playground (~17 KB gzipped).

## Repository Layout

```text
├── packages/          # Layered workspace packages (core, fs, settings, commands, editor, terminal, runtime, preview, ui, sql)
├── src/               # Workbench shell, POSIX shell, virtual runtime, SCM, search, diagnostics & language extensions
├── apps/web/          # Reference browser workbench entrypoint
├── examples/cloud-ide # Full Astro Cloud IDE demo app
├── tests/             # 48 unit/integration suites, E2E suites, and Playwright browser specs
└── tools/             # Build bundler, linter, architecture boundary checker, and gzip size guard
```

## Development

```bash
bun install
bun run build                  # Build all ESM, CJS, UMD bundles and TypeScript declarations
bun run check:boundaries       # Verify 4-layer package boundaries and zero circular imports
bun run check:size             # Enforce gzip bundle size budgets
bun run test:all               # Run all 49 suites plus Playwright browser tests
node tests/run-all.js          # Run the same 49 suites under Node 20, 22, and 24
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT © [Ved Gupta](https://vedgupta.in)
