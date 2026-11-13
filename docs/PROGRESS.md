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

---

## In Progress

- [ ] **Milestone 3 — Phase 2 Target Modular Monorepo Architecture + `@code-lab/sql` (`@innovatorved/code-lab/sql`)**
  - [ ] Create Bun workspace packages (`@code-lab/core`, `@code-lab/fs`, `@code-lab/settings`, `@code-lab/commands`, `@code-lab/editor`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/runtime`, `@code-lab/ui`) + `apps/web`
  - [ ] Strict TypeScript (`strict: true`, `noImplicitAny: true`) across all `@code-lab/*` packages, explicit `index.ts` public APIs, per-package `README.md`
  - [ ] `ServiceContainer` DI, `IDisposable`/`DisposableStore`, typed `Emitter<T>`/`Event<T>`, central typed `CodeLabError` & logger
  - [ ] Pluggable `@code-lab/fs` backends (`MemoryBackend`, `IndexedDbBackend`, `OpfsBackend`)
  - [ ] AST boundary & circular-dependency gate (`tools/check-boundaries.js`) enforced in `bun run lint` & CI
  - [ ] Wire root `@innovatorved/code-lab` & workbench to modular packages, eliminate dead duplicate files, write `docs/ARCHITECTURE.md` with Mermaid diagrams
- [ ] **Milestone 4 — Phase 3 VS Code-Inspired Settings, Keybindings, Themes, Tasks & Plugin System**
  - [ ] Layered configuration (`defaults → user → .codelab/settings.json → URL/embed overrides`) with JSONC parser & JSON Schema validation
  - [ ] `.codelab/keybindings.json` with `when`-clause `ContextKeyService`
  - [ ] `.codelab/tasks.json` (run/build/test/dev + `runOn: "folderOpen"`) & `.codelab/extensions.json`
  - [ ] Live reload on editing `.codelab/*.json` in editor/VFS + Monaco JSON Schema autocomplete/hover/diagnostics + invalid-value fallback
  - [ ] Searchable grouped **Settings UI** (with Reset to Default + "Open `settings.json`" toggle), enhanced **Command Palette** (`Cmd/Ctrl+Shift+P`), and **Quick Open** (`Cmd/Ctrl+P`)
  - [ ] Token-based **Theme System** (`dark`, `light`, `high-contrast` built-in + custom JSON themes)
  - [ ] Settings export/import & URL sharing
  - [ ] Registry-based **Contribution Points** (commands, settings, keybindings, panels, file/language handlers) + `docs/PLUGINS.md`
  - [ ] Dev Observability Inspector panel (services, event log, settings layers, worker status)
- [ ] **Milestone 5 — Phase 4 & 5 Quality Engineering, E2E Browser Verification & Open-Source Readiness**
  - [ ] Unit + integration tests for all new packages & regression tests for every P0/P1 fix
  - [ ] Real-browser Playwright E2E suite (create/edit/save/rename file, run code, terminal, preview, change setting via UI & `.codelab/settings.json`, switch theme, reload & restore state) + manual browser console check
  - [ ] Bundle-size budget check, Prettier/ESLint/lint-staged/Changesets tooling, CI workflow (`typecheck`, `lint`, `check:boundaries`, `test`, `test:browser`, `build`, `size-budget`, `bun audit`)
  - [ ] Open-source docs (`README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`)
  - [ ] Re-run full self-audit, commit, push `refactor/modular-architecture`, merge to `main` (or open PR if branch-protected), and record final Before/After metrics.

---

## Known Issues

See [docs/research/audit.md](file:///Users/vedgupta/Desktop/code-lab/docs/research/audit.md) for the complete prioritized list of baseline issues currently being resolved.
