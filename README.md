# @innovatorved/code-lab

> **Note:** This project is in active development. APIs and sandbox internals are stable for production use.

Browser-native code IDE workbench, modular guided challenge engine (`@innovatorved/code-lab/extensions/guided-lab`), POSIX shell with 58 UNIX coreutils, public GitHub repository cloner (`git clone`), and Web Worker execution runtime for **Node.js** and **Bun** (JavaScript & TypeScript) with Zod type safety and zero backend server dependencies.

- **Live Cloud IDE & GitHub Repo Explorer**: **[https://code-lab-3dr.pages.dev](https://code-lab-3dr.pages.dev)** — Enter any public GitHub repository (`owner/repo` or URL) to clone and run it directly in your browser.
- **Built for**: [System Design In Depth](https://system-design-in-depth.vedgupta.in)

---

## Features

- **Modular Architecture (`v0.1.7`)**: Pure, general-purpose browser IDE (`code-lab`) by default with File Explorer, Monaco Editor, and PTY Terminal. Curriculum features (Guided Steps, Mode Switcher, and JS/TS switcher) are encapsulated in an opt-in modular extension (`@innovatorved/code-lab/extensions/guided-lab`).
- **End-to-End TypeScript & Zod Type Safety**: Written in TypeScript with strict runtime schemas and inferred types (`z.infer<typeof ...>`) for workbench options, guided labs, runtime execution, and git cloning.
- **Public GitHub Repository Cloning (`git clone`)**: Clone any public GitHub repository (`git clone https://github.com/owner/repo` or `git clone owner/repo --branch main` in the terminal, or `await lab.cloneRepo('owner/repo')` via the SDK) directly into `/workspace` with zero authentication required (automatic GitHub Trees API + jsDelivr unlimited fallback). Clone progress (`remote: Enumerating objects…`, `Receiving objects: n%…`) streams into the terminal in real time as it downloads.
- **Interactive IDE Workbench**: Multi-file Monaco editor, collapsible hierarchical file tree with drag-and-drop, a workspace **folder switcher** (breadcrumb dropdown that scopes the explorer to any subfolder), decoupled editor tabs, Command Palette (`Cmd+Shift+P`), Quick Open (`Cmd+P`), breadcrumbs, and line-by-line solution diff viewer.
- **Interactive PTY Terminal**: Inline prompt (`codelab:/workspace$ `), cursor navigation, history (`Up`/`Down`), `Ctrl+R` reverse-i-search, `Tab` auto-completion, `Ctrl+C` interrupt, `Ctrl+L` clear, and 256-color / TrueColor ANSI support.
- **POSIX Shell & 58 Coreutils**: Full pure-JS AST interpreter supporting pipelines (`|`), redirects (`>`, `>>`, `2>&1`, `<<<`, `<<EOF`), control flow (`if`/`for`/`while`/`case`), functions, arithmetic `$((...))`, brace expansion `{1..5}`, and 58 UNIX commands (`git`, `ls`, `cat`, `grep`, `find`, `sed`, `awk`, `jq`, `tar`, `curl`, `nc`, `lsof`, `tsc`, etc.).
- **Dual Runtime Engines (Node.js v22 & Bun v1.1)**:
  - **Node.js**: 50 built-in modules (`fs`, `fs/promises`, `http`, `https`, `net`, `stream`, `events`, `crypto`, `zlib`, `vm`, `worker_threads`, `readline`, `module`, `node:test`, `assert`, etc.).
  - **Bun**: Native `.ts` transpilation, `Bun.serve()`, `Bun.file()`, `Bun.write()`, `Bun.spawn()`, `Bun.password`, `Bun.hash()`, `bun:test`, and VFS-backed `bun:sqlite`.
- **Persistent HTTP/TCP Servers & Dual Web Preview**: Start background servers (`node server.js &` or `bun run server.ts &`), query them with `curl http://localhost:3000` or global `fetch()`, and view live responses in the Ports table, an embedded **Web Preview** tab (URL bar, back/forward, device frames), or a popped-out browser tab backed by a virtual-loopback Service Worker (`/__preview/:port/*`). Public URLs (e.g. `https://example.com`) entered in the preview URL bar open in a real browser tab instead of the virtual frame.
- **Built-in Preview Server (`serve`) & Toolbar *Run & Preview***: Render a real app in the browser with no bundler — `serve [dir] [--port]`, the toolbar globe button, or `npm run dev` all start a static server that transpiles `.ts` / `.tsx` / `.jsx` to browser-native ESM, resolves extensionless relative imports, and injects a jsDelivr `+esm` **import map** for bare specifiers (`react`, `react-dom/client`, `@angular/core`, …). Vite/`ng`/Astro/Next scripts that need native binaries transparently fall back to it.
- **GitHub-Flavored Markdown Engine**: Zero-dependency GFM renderer (tables with column alignment, `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` callout alerts, task-list checkboxes, and syntax-highlighted code blocks with one-click copy) powering the Guide tab, hints, and `.md` file previews.
- **NPM, pnpm & Bun Package Management**: `npm i <pkg>` / `pnpm add <pkg>` / `bun add <pkg>` / `bun install` fetch the real package (and its transitive dependencies, honouring `exports` maps, subpaths and peer deps) from the jsDelivr CDN into virtual `/workspace/node_modules/<pkg>` and update `package.json` (`-D` / `--save-dev` writes to `devDependencies`); packages stay `require()`-able from `node`/`bun run`, with a bundled offline fallback for common demo packages. Framework JSX/TSX (`React.createElement`, custom `@jsx` pragmas) and ESM (including minified bundles) are handled by the runtime transpiler.
- **Guided Step-by-Step Challenges**: TutorialKit / Codedamn-style curriculum extension with targeted instructions, hints, automated test verification per step, and reference solutions.
- **Headless Runtime**: Programmatic execution engine (`@innovatorved/code-lab/runtime`) for grading, testing, or automated evaluation with zero UI.

---

## Install

```bash
bun add @innovatorved/code-lab
# or
npm install @innovatorved/code-lab
```

Or load from a static script tag via CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab.css" />
<script src="https://cdn.jsdelivr.net/npm/@innovatorved/code-lab/dist/code-lab.js"></script>
```

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

---

## Documentation

Complete documentation is published on the [GitHub Wiki](https://github.com/innovatorved/code-lab/wiki):

- **[Quick Start](https://github.com/innovatorved/code-lab/wiki/Quick-Start)**: Setup, CDN, and quick examples.
- **[Integration Guide](https://github.com/innovatorved/code-lab/wiki/Integration-Guide)**: Embedding in React, Next.js, Vite, and HTML.
- **[Workbench Configuration](https://github.com/innovatorved/code-lab/wiki/Workbench-Configuration)**: Complete reference of options, methods, events, and shortcuts.
- **[POSIX Shell & Coreutils](https://github.com/innovatorved/code-lab/wiki/POSIX-Shell-and-Coreutils)**: Pipelines, redirects, background jobs, and 58 UNIX commands.
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

# Rebuild all distribution bundles
bun run build

# Run the complete test suite
bun run test:all
bun run tests/test-all-builds.js             # 15/15 builds & 226 unit tests
bun run tests/test-runtime-advanced.js       # Advanced runtime, VFS, HTTP/TCP
bun run tests/test-option1-shell-bun-http.js # Shell AST, Bun runtime, curl, ports, npm/pnpm
bun run tests/test-frameworks.js             # React/Preact/Vue/Angular support + browser preview server
bun run tests/test-coreutils-adversarial.js  # Adversarial stress tests on 58 coreutils
bun run tests/test-stress-shell.js           # Deep pipelines, redirections, large stdout
bun run tests/test-workbench-ui.js           # Workbench tabs, explorer, shortcuts
```

Individual suites also run under Node 20, 22 and 24 — CI exercises all three:

```bash
bun run build && node tests/run-all.js       # same 32 suites, Node runtime
```

Suites load the built bundles from `dist/` (never raw TypeScript from `src/`), so
`dist/` must exist and be newer than `src/`. `tests/run-all.js` exits with code 2
and a "dist/ is stale" message otherwise; run `bun run build` first.

---

## License

MIT © [Ved Gupta](https://vedgupta.in)
