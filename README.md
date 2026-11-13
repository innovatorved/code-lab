# @innovatorved/code-lab

> **Note:** This project is in active development. APIs and sandbox internals are stable for production use.

Browser-native code IDE workbench, modular guided challenge engine (`@innovatorved/code-lab/extensions/guided-lab`), modular language extensions (`javascript`, `typescript`, real WebAssembly `cpp`, and WebAssembly `python`), POSIX shell with 71 UNIX coreutils, public GitHub repository cloner (`git clone`), and Web Worker execution runtime for **Node.js**, **Bun** (JavaScript & TypeScript), **C++20 (Clang/LLVM + WASI)**, and **Python 3.12 (CPython WASI)** with Zod type safety and zero backend server dependencies.

- **Live Cloud IDE & GitHub Repo Explorer**: **[https://code-lab-3dr.pages.dev](https://code-lab-3dr.pages.dev)** — Enter any public GitHub repository (`owner/repo` or URL) to clone and run it directly in your browser.
- **Built for**: [System Design In Depth](https://system-design-in-depth.vedgupta.in), SQL In Depth & Data Structures & Algorithms (DSA) In Depth

---

## Features

- **Modular 4-Layer Architecture (`v0.4.0`)**: Layered strict-TypeScript workspace architecture (`@code-lab/core` → `@code-lab/{fs,settings,commands}` → `@code-lab/{sql,editor,runtime,terminal,preview}` → `@code-lab/ui` → `apps/web`) enforced by `bun run check:boundaries`. Ships a full browser IDE (`@innovatorved/code-lab`) plus a standalone lightweight SQL playground & inline editor (`@innovatorved/code-lab/sql`, `~16.5 KB` gzipped JS + CSS). Additional languages (`@innovatorved/code-lab/extensions/typescript`, `@innovatorved/code-lab/extensions/cpp`, `@innovatorved/code-lab/extensions/python`) and curriculum features (`@innovatorved/code-lab/extensions/guided-lab`) are opt-in modular extensions.
- **First-Class SQL Playground & Inline Editor (`@innovatorved/code-lab/sql`)**: Zero-dependency `PostgreSQL 18` & `SQLite 3` editor (`mode: 'inline' | 'playground' | 'workbench'`), built-in SQL formatter (`formatSql`), schema-aware table-alias autocomplete (`SELECT o.` → `orders` columns with `PK`/`FK` badges), engine error parser (`parseSqlEngineError`) with inline wavy diagnostics, WCAG 2.1 AA keyboard escape (`Esc` → `Tab`), and Guided Lab `sqlRunner` integration.
- **VS Code-Style Settings, Keybindings & Declarative Plugins**: 4-scope `ConfigurationService` (`default < user < workspace < override`) with JSONC & JSON Schema validation, native `<dialog closedby="any">` Settings UI (`Cmd+,`), live `.codelab/{settings,keybindings,tasks,extensions}.json` workspace sync, Dark / Light / High-Contrast + custom JSON themes, and lazy-activated plugins ([`docs/PLUGINS.md`](./docs/PLUGINS.md)).
- **Real C++20 in WebAssembly (`@innovatorved/code-lab/extensions/cpp`)**: Compile and run real C++17/C++20/C++23 code natively in the browser via a WebAssembly Clang/LLVM + LLD (`wasm-ld`) + WASI `libc++` sysroot toolchain (~35 MB downloaded on demand only when the C++ extension is used and cached in `IndexedDB`). Features rich VS Code-style Monaco IntelliSense with auto-completions, header hovers, debounced static AST linting (`analyzeCppSource`), and live Clang compiler stderr error-squiggles (`applyClangStderrDiagnostics`). Includes `<bits/stdc++.h>`, `<codelab/dsa.hpp>` (`ListNode`, `TreeNode`, `buildLinkedList`, `buildBinaryTree`), and `<codelab/test.hpp>` (`DESCRIBE`, `TEST`, `ASSERT_EQ`) wired directly into the Test Suite drawer and Guided Lab step verification.
- **Python 3.12 WebAssembly Extension (`@innovatorved/code-lab/extensions/python`)**: Run pure CPython 3.12 WebAssembly via Pyodide with lazy-loaded CDN binaries and IndexedDB caching. Features bidirectional VFS sync, pre-seeded `/usr/lib/python/` standard DSA helpers (`codelab_dsa.py` with `ListNode`, `TreeNode`, `MinHeap`, `MaxHeap`) and structured test framework (`codelab_test.py` with `describe`, `it`, `assert_equal`), Monaco completion/hover intelligence, traceback-to-squiggle mapping (`applyPythonTracebackDiagnostics`), static linting (`analyzePythonSource`), and formatting (`formatPythonSource`).
- **Contextual Execution UI & Smooth Workbench**: Guided Challenge mode features a prominent primary `[✓ Verify Step (⌘↵)]` button with the `Test Suite` drawer tab visible by default. Normal/Sandbox mode provides a clean VS Code-style split button `[▶ Run Code (⌘↵) | ▾]` with dropdown options (`Run Entry`, `Run Active File`, `Run Tests`, `Configure Stdin`), with the drawer defaulting to `Terminal & REPL`. The topbar `Web Preview` globe button and bottom `Web Preview` drawer tab are contextual and stay neatly hidden unless the project contains web files or an active HTTP server.
- **High-Impact IDE Power Features**:
  - **Problems Drawer Tab**: Dedicated `⚠ Problems (N)` tab aggregating JS/TS, C++, and Python diagnostics with live counter badge and 1-click cursor jump to line and column.
  - **Execution Time & Peak Memory HUD Badge**: High-resolution performance telemetry pill (`⏱ 12.4 ms · 🧠 1.8 MB`) displayed in the drawer header and status bar across Node, Bun, WASI C++, and Pyodide.
  - **Collapsible Stdin / Custom Input Panel**: Monospace textarea in the drawer for passing competitive-programming / DSA input directly into `std::cin`, `sys.stdin`, and `process.stdin`.
  - **Native Monaco Side-by-Side Diff Editor**: Compare `Starter ↔ Current` and `Current ↔ Solution` with 1-click "Revert" and "Apply Solution" actions directly in Monaco.
  - **Visible Command Palette Pill & Format Document**: Clickable topbar `🔍 Command Palette (⇧⌘P)` pill trigger + `Format Document` (`⇧⌥F`) across all languages.
  - **Zero-Backend URL Workspace Snapshot**: URL hash snapshot compression (`#codelab=<base64url>`) powered by `CompressionStream('deflate-raw')` for instant zero-server workspace sharing.
- **End-to-End TypeScript & Zod Type Safety**: Written in TypeScript with strict runtime schemas and inferred types (`z.infer<typeof ...>`) for workbench options, guided labs, C++ toolchain options, runtime execution, and git cloning.
- **Public GitHub Repository Cloning (`git clone`)**: Clone any public GitHub repository (`git clone https://github.com/owner/repo` or `git clone owner/repo --branch main` in the terminal, or `await lab.cloneRepo('owner/repo')` via the SDK) directly into `/workspace` with zero authentication required (automatic GitHub Trees API + jsDelivr unlimited fallback). Clone progress (`remote: Enumerating objects…`, `Receiving objects: n%…`) streams into the terminal in real time as it downloads.
- **Interactive IDE Workbench**: Multi-file Monaco editor, collapsible hierarchical file tree with drag-and-drop, a workspace **folder switcher** (breadcrumb dropdown that scopes the explorer to any subfolder), decoupled editor tabs, Command Palette (`Cmd+Shift+P`), Quick Open (`Cmd+P`), breadcrumbs, and line-by-line solution diff viewer.
- **Interactive PTY Terminal & Multi-Session Tabs**: Real-time streaming stdout/stderr with **foreground command locking** (hiding the active prompt and blocking concurrent input until the running foreground command finishes or is interrupted via `Ctrl+C`), isolated background jobs (`cmd &`) that survive foreground `SIGINT`, multi-session terminal tabs (`createTerminalSession`, `switchTerminalSession`, `closeTerminalSession`), inline prompt (`codelab:/workspace$ `), cursor navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`), history (`Up`/`Down`), `Ctrl+R` reverse-i-search, `Tab` auto-completion, `Ctrl+L` clear, and 256-color / TrueColor ANSI support.
- **Interactive Workspace Search, Git SCM & ZIP Export/Import**:
  - **Workspace Search & Replace Modal (`Cmd+Shift+F`)**: Live regex/literal search across all workspace files with 1-click **Replace All** (`replaceInWorkspace`) and instant line/column navigation.
  - **Interactive Git Source Control Modal**: View modified/staged/untracked files (`getGitStatus`), stage/unstage individual files or **Stage All** (`stageGitFile`, `unstageGitFile`, `stageAllGitFiles`), and create commits (`commitGitChanges`) directly from the UI or POSIX `git` CLI.
  - **ZIP Archive & IndexedDB Persistence**: Export and import full workspaces as standard `.zip` archives (`exportZip`, `importZip`) with ZIP-bomb guards, and persist projects in `IndexedDB` (`saveProjectToStorage`, `loadProjectFromStorage`).
- **POSIX Shell & 71 Coreutils**: Full pure-JS AST interpreter supporting pipelines (`|`), redirects (`>`, `>>`, `<`, `2>&1`, `<<<`, `<<EOF`), control flow (`if`/`for`/`while`/`case`), functions, arithmetic `$((...))`, brace expansion `{1..5}`, and 71 UNIX commands (`g++`, `clang++`, `c++`, `python`, `python3`, `pytest`, `pip`, `git`, `ls`, `cat`, `grep`, `find`, `sed`, `awk`, `jq`, `tar`, `curl`, `hey`, `ab`, `wrk`, `chaos`, `sqlite3`, `redis-cli`, `nc`, `lsof`, `tsc`, etc.) plus direct `./a.out` WASI binary execution.
- **Dual Runtime Engines (Node.js v22 & Bun v1.1)**:
  - **Node.js**: 50 built-in modules (`fs`, `fs/promises`, `http`, `https`, `net`, `stream`, `events`, `crypto`, `zlib`, `vm`, `worker_threads`, `readline`, `module`, `node:test`, `assert`, etc.) with full Node.js built-ins support.
  - **Bun**: Native `.ts` transpilation, `Bun.serve()`, `Bun.file()`, `Bun.write()`, `Bun.spawn()`, `Bun.password`, `Bun.hash()`, `bun:test`, and VFS-backed `bun:sqlite`.
- **Persistent HTTP/TCP Servers & Dual Web Preview**: Start background servers (`node server.js &` or `bun run server.ts &`), query them with `curl http://localhost:3000` or global `fetch()`, and view live responses in the Ports table, an embedded **Web Preview** tab (URL bar, back/forward, device frames), or a popped-out browser tab backed by a virtual-loopback Service Worker (`/__preview/:port/*`). Public URLs (e.g. `https://example.com`) entered in the preview URL bar open in a real browser tab instead of the virtual frame.
- **Built-in Preview Server (`serve`) & Toolbar *Run & Preview***: Render a real app in the browser with no bundler — `serve [dir] [--port]`, the toolbar globe button, or `npm run dev` all start a static server that transpiles `.ts` / `.tsx` / `.jsx` to browser-native ESM, resolves extensionless relative imports, and injects a jsDelivr `+esm` **import map** for bare specifiers (`react`, `react-dom/client`, `@angular/core`, …). Vite/`ng`/Astro/Next scripts that need native binaries transparently fall back to it.
- **GitHub-Flavored Markdown Engine**: Zero-dependency GFM renderer (tables with column alignment, `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` callout alerts, task-list checkboxes, and syntax-highlighted code blocks with one-click copy) powering the Guide tab, hints, and `.md` file previews.
- **NPM, pnpm & Bun Package Management**: `npm i <pkg>` / `pnpm add <pkg>` / `bun add <pkg>` / `bun install` fetch the real package (and its transitive dependencies, honouring `exports` maps, subpaths and peer deps) from the jsDelivr CDN into virtual `/workspace/node_modules/<pkg>` and update `package.json` (`-D` / `--save-dev` writes to `devDependencies`); packages stay `require()`-able from `node`/`bun run`, with a bundled offline fallback for common demo packages. Framework JSX/TSX (`React.createElement`, custom `@jsx` pragmas) and ESM (including minified bundles) are handled by the runtime transpiler.
- **Guided Step-by-Step Challenges**: TutorialKit / Codedamn-style curriculum extension with targeted instructions, hints, automated test verification per step, and reference solutions.
- **Headless Runtime**: Programmatic execution engine (`@innovatorved/code-lab/runtime`) for grading, testing, or automated evaluation with zero UI.

---

## Install & Subpath Entrypoints

```bash
bun add @innovatorved/code-lab
# or
npm install @innovatorved/code-lab
```

Load the full IDE workbench or the standalone `< 35 KB` SQL pack via CDN:

```html
<!-- Full Browser IDE Workbench -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab.css" />
<script src="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab.js"></script>

<!-- Lightweight SQL Inline Editor & Playground (~16.5 KB gzipped JS + CSS, zero WASM boot) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab-sql.css" />
<script src="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab-sql.umd.js"></script>
```

| Subpath Export | Format | Gzip Size | Description |
| :--- | :--- | :--- | :--- |
| `@innovatorved/code-lab` | ESM + CJS/UMD + `.d.ts` | `~506 KB` (with CSS) | Full multi-file IDE workbench, POSIX shell, virtual runtime, Settings UI, plugins, and `CodeLab.createSqlEditor` |
| `@innovatorved/code-lab/code-lab.css` | CSS | — | Full IDE stylesheet (Dark, Light, High-Contrast + CSS custom properties) |
| `@innovatorved/code-lab/sql` | ESM + UMD + `.d.ts` | `~16.5 KB` (JS + CSS) | Standalone `PostgreSQL 18` + `SQLite 3` inline & playground SQL editor (`window.CodeLabSql`) |
| `@innovatorved/code-lab/sql.css` | CSS | — | Standalone SQL editor & playground stylesheet |
| `@innovatorved/code-lab/runtime` | ESM + CJS + `.d.ts` | `~83 KB` | Headless Node.js / Bun / WASI Web Worker execution engine |
| `@innovatorved/code-lab/shell` | ESM + CJS + `.d.ts` | — | Pure-JS POSIX shell AST interpreter & 71 UNIX coreutils |
| `@innovatorved/code-lab/terminal` | ESM + CJS + `.d.ts` | `~10.2 KB` | Interactive PTY terminal emulator with 256-color / TrueColor ANSI |
| `@innovatorved/code-lab/schemas` | ESM + CJS + `.d.ts` | — | Zod v4 runtime validation schemas & inferred TypeScript types |
| `@innovatorved/code-lab/extensions/guided-lab` | ESM + UMD + `.d.ts` | — | Step-by-step curriculum challenge stepper, hints, test verification & diff |
| `@innovatorved/code-lab/extensions/typescript` | ESM + UMD + `.d.ts` | — | TypeScript workspace language pack |
| `@innovatorved/code-lab/extensions/cpp` | ESM + UMD + `.d.ts` | — | Real C++17/20/23 Clang/LLVM + LLD WASI toolchain & DSA test headers |
| `@innovatorved/code-lab/extensions/python` | ESM + UMD + `.d.ts` | — | Python 3.12 WebAssembly (Pyodide) runtime, `pytest` & DSA helpers |
| `@innovatorved/code-lab/preview-sw.js` | Service Worker | — | Same-origin virtual loopback preview worker (`/__preview/:port/*`) |

---

## Usage

### 1. Mount Workbench in DOM

```js
import CodeLab from '@innovatorved/code-lab';
import '@innovatorved/code-lab/code-lab.css';

const lab = CodeLab.mount('#editor', {
  id: 'rate-limiter',
  title: 'Token Bucket Rate Limiter',
  mode: 'guided',
  language: 'js',
  entry: 'demo.js',
  testEntry: 'test.js',
  starterFiles: {
    'limiter.js': 'class TokenBucket {\n  allow() { return false; }\n}\nmodule.exports = { TokenBucket };\n',
    'demo.js': 'const { TokenBucket } = require("./limiter");\nconsole.log(new TokenBucket().allow());\n',
    'test.js': 'const { test } = require("node:test");\nconst assert = require("node:assert/strict");\nconst { TokenBucket } = require("./limiter");\n\ntest("allows request", () => {\n  assert.equal(new TokenBucket().allow(), true);\n});\n'
  },
  steps: [
    {
      id: 'step-1',
      title: 'Allow requests within capacity',
      targetFile: 'limiter.js',
      targetSymbol: 'allow',
      instructions: 'Return `true` when tokens are available.',
      testNames: ['allows request']
    }
  ]
});
```

### 2. `<code-lab>` Custom Element

```html
<code-lab mode="sandbox" language="ts" style="height: 600px;">
  <script type="application/json">
    {
      "id": "demo-lab",
      "title": "Bun HTTP Demo",
      "entry": "server.ts",
      "files": {
        "server.ts": "Bun.serve({ port: 3000, fetch: () => Response.json({ ok: true }) }); console.log('Listening on :3000');"
      }
    }
  </script>
</code-lab>
```

### 3. Headless Runtime (No UI)

```js
import { executeInWorker } from '@innovatorved/code-lab/runtime';

const res = await executeInWorker({
  mode: 'test',
  entry: 'test.js',
  files: {
    'math.js': 'module.exports = { add: (a, b) => a + b };',
    'test.js': 'const { test } = require("node:test");\nconst assert = require("node:assert/strict");\nconst { add } = require("./math");\ntest("adds numbers", () => assert.equal(add(2, 3), 5));'
  }
});

console.log(res.ok, res.testResults);
```

### 4. Modular Language Extensions (TypeScript, Real C++20 & Python 3.12 in WebAssembly)

JavaScript (`node` and `bun` zero-dependency browser runtime) is enabled out of the box. You can opt into TypeScript (`@innovatorved/code-lab/extensions/typescript`), Real C++20 in WebAssembly (`@innovatorved/code-lab/extensions/cpp`), and/or Python 3.12 in WebAssembly (`@innovatorved/code-lab/extensions/python`):

```js
import CodeLab from '@innovatorved/code-lab';
import { typescriptExtension } from '@innovatorved/code-lab/extensions/typescript';
import { cppExtension } from '@innovatorved/code-lab/extensions/cpp';
import { pythonExtension } from '@innovatorved/code-lab/extensions/python';
import { guidedLabExtension } from '@innovatorved/code-lab/extensions/guided-lab';

const lab = CodeLab.mount('#editor', {
  id: 'dsa-binary-search',
  title: 'Binary Search (JS / TS / C++20 / Python 3.12)',
  language: 'cpp'
})
  .use(typescriptExtension)
  .use((wb) => cppExtension(wb, { std: 'c++20', cacheInIndexedDB: true }))
  .use((wb) => pythonExtension(wb, { cacheInIndexedDB: true }))
  .use((wb) =>
    guidedLabExtension(wb, {
      starterFiles: { 'src/solution.js': 'module.exports = { search: () => -1 };\n' },
      tsStarterFiles: { 'src/solution.ts': 'export const search = (nums: number[], target: number): number => -1;\n' },
      cppStarterFiles: {
        'src/solution.hpp': '#pragma once\n#include <bits/stdc++.h>\nint search(const std::vector<int>& nums, int target) { return -1; }\n',
        'src/test.cpp': '#include <codelab/test.hpp>\n#include "solution.hpp"\nint main() {\n  DESCRIBE("Binary Search", {\n    TEST("finds target", {\n      ASSERT_EQ(search({-1, 0, 3, 5, 9, 12}, 9), 4);\n    });\n  });\n  return CODELAB_TEST_EXIT_CODE();\n}\n'
      },
      pyStarterFiles: {
        'src/solution.py': 'def search(nums: list[int], target: int) -> int:\n    return -1\n',
        'src/test_solution.py': 'from codelab_test import describe, it, assert_equal\nfrom solution import search\n\nwith describe("Binary Search"):\n    with it("finds target"):\n        assert_equal(search([-1, 0, 3, 5, 9, 12], 9), 4)\n'
      },
      steps: [
        {
          id: 'step-1',
          title: 'Implement O(log N) binary search',
          targetFile: 'src/solution.hpp',
          instructions: 'Return the index of `target` in `nums`, or `-1` if not found.',
          testNames: ['finds target']
        }
      ]
    })
  );
```

### 5. Lightweight SQL Inline Editor, Playground & Guided Labs (`@innovatorved/code-lab/sql`)

Mount 1–10 runnable `PostgreSQL 18` or `SQLite 3` blocks (`~16.5 KB` gzipped JS + CSS combined, zero WASM boot of its own) across three chrome modes (`'inline'`, `'playground'`, and `'workbench'`):

```js
import {
  createSqlEditor,
  formatSql,
  highlightSql,
  completeSql,
  parseSqlEngineError
} from '@innovatorved/code-lab/sql';
import '@innovatorved/code-lab/sql.css';

const editor = createSqlEditor(document.getElementById('sql-box'), {
  mode: 'playground', // 'inline' (lesson blocks) | 'playground' (split/stacked)
  dialect: 'postgres', // 'postgres' (PostgreSQL 18) | 'sqlite' (SQLite 3)
  theme: 'auto', // 'dark' | 'light' | 'auto' (live MutationObserver on <html data-theme>)
  minLines: 4,
  maxLines: 18,
  value: formatSql(
    'select o.id, o.total_cents from customers c join orders o on o.customer_id = c.id where o.total_cents > 1000;',
    { dialect: 'postgres', indent: 2, keywordCase: 'upper' }
  ),
  schema: {
    dialect: 'postgres',
    tables: [
      {
        name: 'customers',
        rowCount: 12000,
        columns: [
          { name: 'id', type: 'bigint', pk: true },
          { name: 'email', type: 'text' }
        ]
      },
      {
        name: 'orders',
        rowCount: 84000,
        columns: [
          { name: 'id', type: 'bigint', pk: true },
          { name: 'customer_id', type: 'bigint', fk: 'customers.id' },
          { name: 'total_cents', type: 'integer' }
        ]
      }
    ]
  },
  async onRun({ sql, selectedSql, effectiveSql }) {
    try {
      // Plug in PGlite, SQLite WASI/wa-sqlite, or any HTTP query runner:
      editor.clearDiagnostics();
      console.log('Executing SQL:', effectiveSql);
    } catch (err) {
      // Maps Postgres `position` / `LINE N:` and SQLite `near "..."` to wavy inline ranges
      editor.setDiagnostics([parseSqlEngineError(err, effectiveSql, 'postgres')]);
    }
  }
});

// Insert table/column identifiers from external clickable schema pills:
editor.insertAtCursor('orders.total_cents');
```

**SQL Keyboard Shortcuts & Accessibility (WCAG 2.1 AA)**:
- `Cmd/Ctrl + Enter` — Execute query (`selectedSql` when a selection is active, otherwise full `sql` via `effectiveSql`)
- `Shift + Alt + F` / `Cmd/Ctrl + Shift + F` — Format SQL (`formatSql`)
- `Cmd/Ctrl + /` — Toggle `-- ` line comments
- `Ctrl + Space` (or typing `alias.`) — Open schema & keyword `role="listbox"` autocomplete (`PK`/`FK` badges + row counts)
- `Esc` → `Tab` — Releases `Tab` indentation so keyboard focus moves cleanly to the next page control (no keyboard trap, WCAG 2.1.2)

For **3-step SQL Guided Labs** inside the full workbench (`mode: 'workbench'`), pass `lang: 'sql'` and a `sqlRunner` callback — single-file SQL labs automatically hide multi-file explorer and POSIX terminal chrome while keeping step instructions, hints, diff, and tabular result verification:

```js
import CodeLab from '@innovatorved/code-lab';
import '@innovatorved/code-lab/code-lab.css';

const sqlLab = CodeLab.mount('#sql-guided-lab', {
  lang: 'sql',
  sqlDialect: 'postgres',
  code: 'SELECT id, email FROM customers ORDER BY id;',
  steps: [
    { id: 'step-1', title: 'Order customers by ID', instructions: 'Return `id` and `email` ordered by `id`.' }
  ],
  async sqlRunner({ sql, mode }) {
    return {
      columns: ['id', 'email'],
      rows: [[1, 'ada@analytical.org'], [2, 'grace@compiler.org']],
      rowCount: 2,
      durationMs: 1.2,
      verification: { passed: true, message: 'All rows verified!' }
    };
  }
});
```

### 6. Workspace Settings, Keybindings, Themes & Plugins (`.codelab/*`)

Configure editor, theme, runtime, and SQL defaults per workspace using JSON with Comments (JSONC), open the native `<dialog closedby="any">` Settings UI via `lab.openSettings()` (`Cmd+,`), or register declarative plugins:

```jsonc
{
  // .codelab/settings.json (4-scope cascade: default < user < workspace < override)
  "workbench.colorTheme": "dark", // "dark" | "light" | "high-contrast"
  "editor.fontSize": 14,
  "editor.tabSize": 2,
  "editor.wordWrap": "on",
  "sql.dialect": "postgres"
}
```

```js
// Register a declarative plugin contributing commands, settings, or drawer panels
lab.registerPlugin({
  id: 'acme.query-plan',
  name: 'EXPLAIN Visualizer',
  version: '1.0.0',
  contributes: {
    panels: [
      {
        id: 'explain-plan',
        title: 'Query Plan',
        location: 'drawer',
        render(container) {
          container.textContent = 'Visual EXPLAIN plan ready.';
        }
      }
    ]
  }
});
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), [`docs/PLUGINS.md`](./docs/PLUGINS.md), [`docs/ROADMAP.md`](./docs/ROADMAP.md), and [`docs/DECISIONS.md`](./docs/DECISIONS.md) for deep-dive architecture and plugin guides.

---

## Documentation

Complete documentation is published on the [GitHub Wiki](https://github.com/innovatorved/code-lab/wiki):

- **[Quick Start](https://github.com/innovatorved/code-lab/wiki/Quick-Start)**: Setup, CDN, and quick examples.
- **[Integration Guide](https://github.com/innovatorved/code-lab/wiki/Integration-Guide)**: Embedding in React, Next.js, Vite, and HTML.
- **[Workbench Configuration](https://github.com/innovatorved/code-lab/wiki/Workbench-Configuration)**: Complete reference of options, methods, events, and shortcuts.
- **[POSIX Shell & Coreutils](https://github.com/innovatorved/code-lab/wiki/POSIX-Shell-and-Coreutils)**: Pipelines, redirects, background jobs, and 71 UNIX commands.
- **[Runtime APIs (Node & Bun)](https://github.com/innovatorved/code-lab/wiki/Runtime-APIs)**: 50 Node.js built-ins, Bun APIs, `bun:test`, `bun:sqlite`, and npm install.
- **[HTTP Servers & Networking](https://github.com/innovatorved/code-lab/wiki/HTTP-Servers-and-Networking)**: Virtual port table, background servers, `curl`, and Port Preview.
- **[Headless Runtime](https://github.com/innovatorved/code-lab/wiki/Headless-Runtime)**: Run code and tests programmatically with zero UI.
- **[Authoring Guided Labs](https://github.com/innovatorved/code-lab/wiki/Authoring-Guided-Labs)**: Schema and invariants for creating interactive coding challenges.
- **[Plugin System & Custom Extensions](https://github.com/innovatorved/code-lab/wiki/Plugin-System)**: Extend CodeLab with `.use(plugin)` and `.on()` event hooks.

---

## Local Development & Testing

```bash
# Install dependencies with Bun
bun install

# Rebuild all distribution bundles & verify size / architecture gates
bun run build
bun run check:boundaries                     # Enforce 4-layer workspace DAG & 0 circular dependencies
bun run check:size                           # Enforce gzip size budgets (@innovatorved/code-lab/sql < 35 KB)
bun run typecheck && bun run typecheck:strict
bun run lint

# Run the complete test suite (47 suites + Playwright cross-browser E2E)
bun run test:all
bun run tests/test-modular-packages.js       # DI, VFS backends, ConfigurationService, Keybindings, Themes, Plugins
bun run tests/test-sql-playground.js         # PostgreSQL 18 + SQLite 3 tokenizer, formatter, autocomplete, diagnostics
bun run tests/test-all-builds.js             # 20/20 builds & 241 unit tests
bun run tests/test-runtime-advanced.js       # Advanced runtime, VFS, HTTP/TCP
bun run tests/test-option1-shell-bun-http.js # Shell AST, Bun runtime, curl, ports, npm/pnpm
bun run tests/test-frameworks.js             # React/Preact/Vue/Angular support + browser preview server
bun run tests/test-coreutils-adversarial.js  # Adversarial stress tests on 71 coreutils
bun run tests/test-stress-shell.js           # Deep pipelines, redirections, large stdout
bun run tests/test-workbench-ui.js           # Workbench tabs, explorer, shortcuts
bun run tests/test-cpp-extension.js          # Real C++20 WASI runtime, g++, and language extensions
bun run tests/test-python-extension.js       # Python 3.12 WebAssembly runtime, pytest, and language service
bun run test:browser:all                     # Headless Playwright across Chromium, Firefox, and WebKit
```

Individual suites also run under Node 20, 22 and 24 — CI exercises all three:

```bash
bun run build && node tests/run-all.js       # same 47 suites, Node runtime
```

Suites load the built bundles from `dist/` (never raw TypeScript from `src/`), so
`dist/` must exist and be newer than `src/`. `tests/run-all.js` exits with code 2
and a "dist/ is stale" message otherwise; run `bun run build` first.

---

## License

MIT © [Ved Gupta](https://vedgupta.in)
