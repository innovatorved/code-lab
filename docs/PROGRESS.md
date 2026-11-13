# Refactor Progress & Milestone Tracker (`PROGRESS.md`)

## Baseline Snapshot (Before Refactor — `v0.3.2`)

- **Architecture**: Single-package monolith with 4 `@ts-nocheck` god files (`workbench.ts` 10,088 LOC, `runtime.ts` 9,805 LOC, `shell.ts` 8,767 LOC, `terminal.ts` 1,206 LOC), raw uncompiled string concatenation in `tools/bundle.js`, 9 dead/disconnected duplicate files, no DI container, and no layer boundary checks.
- **Bundle Size (`dist/code-lab.js`)**: `1.8 MB` unminified (embeds C++, Python, Guided Lab, and Zod inline).
- **Strict TypeScript Coverage**: 12 leaf files in `tsconfig.strict.json`; 0 workspace packages.
- **Dependency Vulnerabilities (`bun audit`)**: 2 in root (`1 high` in `zod`, `1 moderate` in `esbuild`), 32 in `examples/cloud-ide` (`1 critical`, `8 high`, `18 moderate`, `5 low` in `astro`/`sharp`/`vite`/`esbuild`/`zod`).
- **Configuration System**: None (no `.codelab/settings.json`, `keybindings.json`, `tasks.json`, JSON Schema validation, Settings UI, High-Contrast theme, or declarative contribution registry).
- **Test Baseline**: 43/43 Node/Bun suites passing (`41.11s`).

---

## Completed

- [x] **Phase 0 — Research & Codebase Mapping**
  - [x] Studied VS Code, Monaco, CodeMirror 6, WebContainers, Sandpack, Theia, Zed, JupyterLab/Lumino, OpenVSCode Server, Eclipse Che, and browser runtime primitives → [architecture-lessons.md](file:///Users/vedgupta/Desktop/code-lab/docs/research/architecture-lessons.md)
  - [x] Recorded clean-room attribution & permissive license policy → [licenses.md](file:///Users/vedgupta/Desktop/code-lab/docs/licenses.md)
  - [x] Read all of `code-lab` and mapped folder tree, line ranges, data flows, globals, and hidden couplings → [codebase-map.md](file:///Users/vedgupta/Desktop/code-lab/docs/research/codebase-map.md)
- [x] **Phase 1 — Honest Self-Audit**
  - [x] Audited codebase across Architecture, Correctness, Robustness, Security, Performance, DX, and Competitor Gaps (`6 P0`, `14 P1`, `6 P2` findings with exact `file:line` evidence) → [audit.md](file:///Users/vedgupta/Desktop/code-lab/docs/research/audit.md)
  - [x] Recorded core architectural trade-offs → [DECISIONS.md](file:///Users/vedgupta/Desktop/code-lab/docs/DECISIONS.md)
- [x] **Milestone 1 — Fix All P0 Critical Bugs, Security Issues & Dependency CVEs (with Regression Tests)**
  - [x] `P0-6`: Upgraded `zod@4.6.7`, `esbuild@0.28.2`, and `examples/cloud-ide` (`astro@7.4.11`, removed unused `puppeteer`) — `bun audit` passes with **0 vulnerabilities** across both root and `examples/cloud-ide`
  - [x] `P0-1`: Implemented `startInlineCreate` and `startInlineRename` (both signatures + `Enter`/`Escape`/`blur` + `F2`) on `CodeLabWorkbench`
  - [x] `P0-2`: Fixed double-escaped `\n` in `DEFAULT_STANDALONE_PYTHON_FILES` and `.py`/`.md` templates
  - [x] `P0-3`: Implemented all missing public methods on `CodeLabWorkbench`, `CodeLabElement`, and `dist/code-lab.d.ts` (`setTheme`, `getTheme`, `switchDrawerTab`, `exportZip`, `importZip`, `runProject`, `stopExecution`, `cancelExecution`, `movePath`, `toggleWebPreview`, `runSelectedCode`, `promptNewFile`, `promptNewFolder`, `closeCommandPalette`)
  - [x] `P0-4`: Fixed `executeInWorker` to preserve streamed `stdout`/`stderr`/`testResults` on timeout/cancel/error, sync dirty VFS mutations (`Uint8Array`-safe) back to `options.vfs` and workbench, and guard against re-executing crashed worker code on the main thread
  - [x] `P0-5`: Hardened `preview-sw.js` with `X-Content-Type-Options: nosniff` on all responses, `Content-Security-Policy` on all HTML/XHTML/SVG/XML/untyped responses, 302 navigate isolation into `/__preview/:port/...`, sender/CRLF validation on `codelab:config`, and `MessageChannel` port cleanup
  - [x] Added regression suite [test-p0-audit-regressions.js](file:///Users/vedgupta/Desktop/code-lab/tests/test-p0-audit-regressions.js) (44/44 suites green)
- [x] **Milestone 2 — Fix All P1 (& P2) Audit Findings (with Regression Tests)**
  - [x] `P1-2`: Inline diff editor state/VFS/model sync & theme fix
  - [x] `P1-3`: Removed `allow-same-origin` from `.codelab-response-iframe` & `JSON.stringify` URLs in `loadMonaco` worker shim
  - [x] `P1-4`: Multi-instance isolation (`instanceId`-scoped Monaco URIs & SW client routing, full `destroy()` disposable/model/timer/port/Blob cleanup, per-execution `cwd` & FD cleanup)
  - [x] `P1-5`: Debounced serialized persistence + IndexedDB read hydration on reload + rAF breadcrumb throttling + compact `sd_codelab_` metadata mirror
  - [x] `P1-6`: Preserved focus/input in `#cl-net-search` filter input via `#cl-net-tbody` in-place update
  - [x] `P1-7`: Binary-safe `Uint8Array` asset serving & escaped `\u003c/script>` import maps in `serve`
  - [x] `P1-8`: Binary-safe Python VFS sync, Pyodide `<script>` dedup, honest `pip` error when toolchain absent
  - [x] `P1-9`: C++ string/comment/raw-string-aware brace check & file-targeted Monaco lint markers
  - [x] `P1-10`: Shell `<<`/`<<-`/`<<<` heredocs & here-strings, `[[ ... ]]`, `exit`, `:`, and `stdin`/`env`/`cwd` forwarding to `node`/`bun`/`python3`
  - [x] `P1-11`: Shell `curl` & `hey` external URL routing vs loopback `portTable`
  - [x] `P1-12` & `P2-2`: `transpileTS` template-literal `${...}` & nested callback TS stripping, generator/destructured exports, and quote-aware `SqliteDatabase.exec` + `transaction` rollback
  - [x] `P1-13` & `P2-3`: `PTYTerminalEngine.readLine()` queue cleanup on `Ctrl+C`, `AbortSignal`, & `destroy()` + bounded shell/PTY history ring buffers
  - [x] `P1-14`, `P2-4..6`: Fixed `mock-dom.js` single-quote attribute regex, added `layout`/`maximize`/`settings` icons, binary/huge (`> 2 MB`) file guard, `[data-cl-theme]` light/high-contrast CSS rules, and regression suite [test-p1-audit-regressions.js](file:///Users/vedgupta/Desktop/code-lab/tests/test-p1-audit-regressions.js) (45/45 suites green)
- [x] **Milestone 3 — Phase 2 Target Modular Monorepo Architecture + `@code-lab/sql` (`@innovatorved/code-lab/sql`)**
  - [x] Created 11 Bun workspace packages (`@code-lab/core`, `@code-lab/fs`, `@code-lab/settings`, `@code-lab/commands`, `@code-lab/sql`, `@code-lab/editor`, `@code-lab/runtime`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/ui`) + `apps/web`
  - [x] 100% Strict TypeScript (`strict: true`, `noImplicitAny: true`, zero `any`, zero `@ts-nocheck`) across all 48 strict modules, explicit `src/index.ts` public APIs, per-package `README.md`
  - [x] Built standalone `@innovatorved/code-lab/sql` (`dist/code-lab-sql.{umd.js,esm.js,css,d.ts}`) at **16.51 KB gzipped (JS + CSS)** (< 35 KB budget), zero WASM boot of its own
  - [x] Deduplicated extension umbrella bundle (`dist/code-lab.js` reduced by 1.4 MB)
  - [x] Enforced 4-layer DAG, `index.ts`-only imports, 0 cycles, and 0 DOM globals in `core` via `tools/check-boundaries.js` & `tools/lint.js`

---

## Completed Milestones (All Phases Done — `v0.4.0`)

- [x] **Milestone 4 — Phase 3 VS Code-Inspired Settings, Keybindings, Themes, Tasks & Plugin System**
  - [x] Layered configuration (`defaults → user → .codelab/settings.json → URL/embed overrides`) with JSONC parser & JSON Schema validation
  - [x] `.codelab/keybindings.json` with `when`-clause `ContextKeyService` & `-command` unbinding
  - [x] `.codelab/tasks.json` (run/build/test/dev + `runOn: "folderOpen"`) & `.codelab/extensions.json`
  - [x] Live reload on editing `.codelab/*.json` in editor/VFS + invalid-value fallback & `SettingDiagnostic` reporting
  - [x] Searchable grouped `<dialog closedby="any">` **Settings UI** (`Cmd+,`), **Command Palette** (`Cmd/Ctrl+Shift+P`), and fuzzy **Quick Open** (`Cmd/Ctrl+P`)
  - [x] Token-based **Theme System** (`dark`, `light`, `high-contrast` built-in + custom JSON themes)
  - [x] Settings export/import & `?settings=` URL sharing
  - [x] Declarative **Plugin System** (`commands`, `settings`, `keybindings`, `themes`, `panels`, `languages`) + [PLUGINS.md](file:///Users/vedgupta/Desktop/code-lab/docs/PLUGINS.md) & [ARCHITECTURE.md](file:///Users/vedgupta/Desktop/code-lab/docs/ARCHITECTURE.md)
  - [x] Dev **Observability** drawer panel (services, event bus log, config diagnostics, worker status) + `WorkbenchErrorBoundary`
- [x] **Milestone 5 — Phase 4 & 5 Quality Engineering, E2E Browser Verification & Open-Source Readiness**
  - [x] Unit + integration suites [test-modular-packages.js](file:///Users/vedgupta/Desktop/code-lab/tests/test-modular-packages.js) & [test-sql-playground.js](file:///Users/vedgupta/Desktop/code-lab/tests/test-sql-playground.js) + regression suites [test-p0-audit-regressions.js](file:///Users/vedgupta/Desktop/code-lab/tests/test-p0-audit-regressions.js) & [test-p1-audit-regressions.js](file:///Users/vedgupta/Desktop/code-lab/tests/test-p1-audit-regressions.js) (47/47 suites passing in Bun & Node)
  - [x] Real-browser Playwright Chromium E2E suite [ide-and-sql.spec.ts](file:///Users/vedgupta/Desktop/code-lab/tests/browser/ide-and-sql.spec.ts) (30/30 Chromium specs passing with 0 `pageerror`s)
  - [x] Bundle-size budget gate [check-bundle-size.js](file:///Users/vedgupta/Desktop/code-lab/tools/check-bundle-size.js), Prettier, `lint-staged`, Changesets config, and hardened [ci.yml](file:///Users/vedgupta/Desktop/code-lab/.github/workflows/ci.yml)
  - [x] Complete open-source governance docs (`README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`)

---

## Final Engineering Metrics (Before `v0.3.2` vs After `v0.4.0`)

| Metric | Before (`v0.3.2`) | After (`v0.4.0`) |
| --- | --- | --- |
| **Workspace Packages** | 1 monolith package | **11 Bun workspaces** across 4 enforced DAG layers (`0` violations, `0` cycles) |
| **Strict TypeScript Modules (`strict: true`)** | 12 leaf files | **48 strict TypeScript modules** (`0` `any` leaks, `0` empty `catch` blocks) |
| **SQL Inline/Playground Bundle (`@innovatorved/code-lab/sql`)** | N/A (fell back to plain `<textarea>` or full 1.8 MB IDE) | **`16.57 KB` gzipped** (JS + CSS combined; `< 35 KB` budget, `0` WASM overhead) |
| **Audit Findings Open (`P0` / `P1` / `P2`)** | `6 P0`, `14 P1`, `6 P2` (26 open) | **`0` open** (`26/26` resolved with dedicated regression tests) |
| **Dependency Vulnerabilities (`bun audit`)** | 2 in root + 32 in `examples/cloud-ide` | **`0` vulnerabilities** across root and `examples/cloud-ide` |
| **Automated Node / Bun Test Suites** | 43 suites | **47 suites** (100% green in both Bun and Node) |
| **Playwright Real Chromium E2E Specs** | 27 tests | **30 tests** (100% green in headless Chromium, `0` uncaught page errors) |
