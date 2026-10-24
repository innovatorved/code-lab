# Changelog

All notable changes to `@innovatorved/code-lab` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-24

### Added
- **Real C++20 in WebAssembly Extension (`@innovatorved/code-lab/extensions/cpp`, `src/extensions/cpp.ts`)**:
  - Real ~35 MB Clang/LLVM + LLD (`wasm-ld`) + WASI C++20 Sysroot (`libc` + `libc++`) toolchain downloaded on demand only when `cppExtension` is used and cached persistently in `IndexedDB` (`codelab_cpp_toolchain_v1`).
  - Built-in Competitive Programming & DSA headers seeded into `/usr/include`: `<bits/stdc++.h>`, `<codelab/dsa.hpp>` (`ListNode`, `TreeNode`, `buildLinkedList`, `buildBinaryTree`, `printMatrix`, `BenchmarkTimer`), and `<codelab/test.hpp>` (`DESCRIBE`, `TEST`, `IT`, `ASSERT_EQ`, `ASSERT_NE`, `ASSERT_TRUE`, `ASSERT_FALSE`) emitting structured `__CODELAB_TEST__:{json}` markers to `code-lab`'s Test Suite drawer and Guided Lab `Verify Step`.
  - Pure TypeScript POSIX UStar `.tar` extractor and generator (`extractTarToVfs`, `createTarArchive`).
- **WASI Preview 1 Syscall Layer (`src/runtime.ts`)**:
  - Added `createVirtualWasi` (`wasi_snapshot_preview1`) and `executeWasiModule` backed by `VirtualFS` (`fd_read`, `fd_write`, `fd_seek`, `fd_close`, `path_open`, `path_create_directory`, `path_unlink_file`, `args_get`, `environ_get`, `clock_time_get`, `random_get`, `proc_exit` via `WasiExitSignal`).
  - `executeInVirtualRuntime` now supports `.wasm` and `.cpp` entrypoints directly and parses `__CODELAB_TEST__:{json}` lines into `testResults`.
- **POSIX Shell C++ Compiler & WASI Binary Execution (`src/shell.ts`)**:
  - Added `g++`, `clang++`, and `c++` commands (`67` total POSIX coreutils) plus direct `./<binary>` (`.wasm` magic byte `0x00 0x61 0x73 0x6d`) execution with `< input.txt` stdin and `> output.txt` / `>>` stdout redirection.
- **Modular Language Extensions (`@innovatorved/code-lab/extensions/{javascript,typescript,cpp}`)**:
  - **JavaScript (`javascriptExtension`)**: Enabled **by default out-of-the-box** using the browser's native JS engine and `code-lab`'s zero-dependency `node` & `bun` virtual runtime.
  - **TypeScript (`typescriptExtension`)**: Opt-in zero-dependency browser extension using `code-lab`'s built-in `transpileTS` + virtual `node`/`bun` runtime.
  - **C++ (`cppExtension`)**: Opt-in WebAssembly Clang/LLVM + WASI C++20 extension.
- **3-Way Language Switcher (`JS | TS | C++`) & Multi-Language Guided Labs (`src/workbench.ts`, `src/schemas.ts`)**:
  - Added `cppStarterFiles`, `cppSolutionFiles`, and `cppFiles` to `GuidedLabExtensionOptionsSchema` and `WorkbenchOptionsSchema`.
  - Workbench language switcher dynamically renders pills for the enabled languages (`wb.enabledLanguages`).

### Breaking Changes & Migration Guide (`v0.1.x` $\rightarrow$ `v0.2.0`)
1. **Default Workbench Language Surface (`['js']` by default)**:
   - **Before (`v0.1.x`)**: Mounting a standalone workbench without language extensions exposed only JavaScript unless `guidedLabExtension` was configured with `ts*` files.
   - **Now (`v0.2.0`)**: JavaScript (`javascriptExtension`) + zero-dependency virtual `node` and `bun` remains enabled by default (`0 MB` extra download). To enable TypeScript or C++ in the workbench toolbar switcher (`JS | TS | C++`), register `typescriptExtension` and/or `cppExtension` via `.use()` or `extensions: [...]`:
     ```ts
     import CodeLab, {
       typescriptExtension,
       cppExtension,
       guidedLabExtension
     } from '@innovatorved/code-lab';

     const lab = CodeLab.mount('#editor', {
       id: 'dsa-binary-search',
       title: 'Binary Search in Depth',
       language: 'cpp'
     })
       .use(typescriptExtension)
       .use((wb) => cppExtension(wb, { std: 'c++20' }))
       .use((wb) =>
         guidedLabExtension(wb, {
           starterFiles: { 'src/solution.js': '...' },
           tsStarterFiles: { 'src/solution.ts': '...' },
           cppStarterFiles: { 'src/solution.cpp': '...' },
           steps: [...]
         })
       );
     ```
   - **Backward Compatibility**: Existing `guidedLabExtension(wb, { tsStarterFiles })` or `cppStarterFiles` configs automatically add `'ts'` / `'cpp'` to `wb.enabledLanguages`.
2. **`LanguageIdSchema` Enum Widened**:
   - `LanguageIdSchema` (`@innovatorved/code-lab/schemas`) is now `z.enum(['js', 'ts', 'cpp'])` (previously `z.enum(['js', 'ts'])`). TypeScript consumers switching exhaustively on `LanguageId` should handle `'cpp'`.

## [0.1.13] - 2026-10-23

### Added
- **System Design Chaos Engine & Port Telemetry (`src/runtime.ts`)**: Extended `VirtualPortTable` with per-port fault injection (`setChaos`, `getChaos`, `clearChaos`: latency/jitter injection, HTTP 503 error rate, and partitioned/down nodes) and rolling 60-second SLO telemetry (`recordMetric`, `getMetrics`, `getAllMetrics`: live RPS, `p50`/`p95`/`p99` latency, error rate, and upstream call graph edges).
- **4 System Design POSIX Coreutils (`src/shell.ts`)**: Added `hey` / `ab` / `wrk` (concurrent HTTP load generator with ASCII latency histograms and `p50`/`p90`/`p95`/`p99` percentiles), `chaos` (CLI fault injector for port latency, error rate, and partitions), `sqlite3` (interactive CLI with `.tables`, `.schema`, and `EXPLAIN QUERY PLAN`), and `redis-cli` (in-memory + VFS-persisted Redis server/CLI supporting strings, TTLs, atomic counters, lists, hashes, sets, and sorted sets).
- **VFS-Persisted SQLite with Secondary Indexes & Query Planner (`src/runtime.ts`)**: Added file-backed persistence (`/workspace/*.db`), `CREATE INDEX` / `DROP INDEX`, `PRAGMA index_list`, and `EXPLAIN QUERY PLAN` (`SCAN TABLE` vs `SEARCH TABLE ... USING INDEX`) to `bun:sqlite`.
- **Workbench SLO Telemetry Bar, Live Topology Graph & 1-Click Chaos Pills (`src/workbench.ts`, `src/code-lab.css`)**: Added live RPS/`p50`/`p95`/`p99`/Error% telemetry bar, interactive ASCII/SVG topology trace (`Client -> LB :3000 -> Worker :3001`), and 1-click Chaos pills (`+200ms Latency`, `25% HTTP 503`, `Kill Node`, `Run hey Load Test`) to the Ports & Networking panel.
- **Distributed System Cluster Presets (`examples/cloud-ide/src/pages/index.astro`)**: Added `Distributed Cluster & Chaos Lab` (`sd-cluster`) and `High-Scale URL Shortener` (`sd-shortener`) templates to the Cloud IDE.

## [0.1.10] - 2026-10-22

### Fixed
- **Live Browser Preview CSP & React ESM Deduplication (`src/csp.ts`, `src/shell.ts`)**: Added `data:` to `script-src` in `buildPreviewPolicy` so local `.ts`/`.tsx` modules mapped via import maps execute under the preview CSP, and deduplicated the React ESM URL in `buildHtmlPreviewResponse` so `react-dom/client` and local TSX modules share a single React instance.
- **Right Split-Pane Preview Grid & Drawer Layout Polish (`src/code-lab.css`, `src/workbench.ts`)**: Added `.codelab-workspace.has-preview-split` 5-column grid layout, preserved preview toolbar visibility in the bottom drawer (`min-height: 0` + scroll reset), widened the split-pane URL input, and refined the `.codelab-ports-panel` column ratios.

## [0.1.9] - 2026-10-22

### Added
- **StackBlitz-Grade Web Preview Engine & Split-Pane Dock (`src/csp.ts`, `src/shell.ts`, `src/workbench.ts`, `src/code-lab.css`)**: Right-hand split-pane preview dock (`#cl-preview-split`, `#cl-splitter-preview`), maximize toggle, inline collapsible preview console, dynamic HTML/React/TSX bundler and local asset inliner, and sandboxed iframe loopback bridge (`fetch()`, relative `<a href>` navigation, SPA `history.pushState`/`replaceState` URL sync).
- **Ports Manager, Mini HTTP Client & Network Inspector UI (`src/code-lab.css`, `src/workbench.ts`)**: Complete 2-column grid layout and styling for `.codelab-ports-panel`, `.codelab-http-client`, and `.codelab-network-panel`, plus fixed event handlers for HTTP header editing and network request filtering/selection.
- **Durable Browser Auto-Save & Page-Refresh State Persistence (`src/workbench.ts`, `examples/cloud-ide/src/pages/index.astro`)**: Added `hasSnapshot` tracking and IndexedDB mirroring so user edits, newly created files, and deleted default files persist across page reloads, with immediate state flushing on `visibilitychange`.

## [0.1.8] - 2026-10-22

### Added
- **Project ZIP Export & Import (`src/zip.ts`)**: Pure TypeScript IEEE 802.3 CRC-32 + PKWARE ZIP v2.0 archive generator/extractor (`createZip`, `extractZip`, `wb.exportProjectZip()`, `wb.importProjectZip()`) with Zip-Slip path sanitization.
- **Cascading Workspace Storage (`src/storage.ts`)**: Durable multi-project workspace persistence cascading `IndexedDB` $\rightarrow$ `localStorage` $\rightarrow$ in-memory fallback (`WorkspaceStorage`, `createWorkspaceStorage`) with automatic quota-exceeded recovery.
- **Workspace-Wide Search & Replace (`src/search.ts`)**: Regex, case-sensitive, whole-word, and glob-filtered search/replace (`searchInFiles`, `replaceInFiles`, `wb.searchWorkspace()`, `wb.replaceInWorkspace()`, `wb.showSearchModal()`, `⇧⌘F`).
- **Diagnostics & Problems Panel (`src/diagnostics.ts`)**: Structured workspace diagnostics store (`DiagnosticsStore`, `createDiagnosticsStore`, `wb.getDiagnostics()`, `wb.showProblemsModal()`).
- **Source Control (SCM) Engine (`src/scm.ts`)**: Porcelain Git status, staging, unstaging, and commit creation (`createGitState`, `computeGitStatus`, `stageFile`, `unstageFile`, `commitChanges`, `wb.getGitStatus()`, `wb.showScmModal()`).
- **Live Preview Console Bridge, Error Overlay & Debounced Auto-Reload**: In-preview runtime error overlay (`#codelab-preview-error-overlay`), console/error `postMessage` bridge (`codelab:preview-console`, `codelab:preview-error`), 300ms debounced preview reload on editor edits, and multi-port server selector.
- **Multi-Session Terminal & Multi-CDN Package Fallback**: Multi-session terminal management (`createTerminalSession`, `switchTerminalSession`, `closeTerminalSession`, `listTerminalSessions`), cascading npm CDN resolution (`jsDelivr` $\rightarrow$ `unpkg` $\rightarrow$ `esm.sh`), and deterministic `/workspace/package-lock.json` v3 generation.
- **Shared Preview CSP Builder (`src/csp.ts`)**: Added `buildPreviewCsp`, `injectCspMeta`, `resolvePreviewCspMode`, and the `previewCsp` workbench option / `preview-csp` HTML attribute supporting `'strict'`, `'balanced'` (new default), `'permissive'`, or a custom CSP policy string across both the embedded `srcdoc` iframe and `preview-sw.js`.
- **Preview CSP Violation Reporting**: Injected a `securitypolicyviolation` listener into the preview bridge that forwards blocked resource details (`blockedURI`, `violatedDirective`, `effectiveDirective`, `sourceFile`, `lineNumber`) to the host workbench (`csp-violation` event and structured logger warning).
- **Structured Diagnostics & Error Taxonomy (`src/logger.ts`)**: Added `CodeLabError` (`code`, `context`, `cause`), `isCodeLabError`, `createLogger`, and the `logLevel` workbench option (`'silent' | 'error' | 'warn' | 'info' | 'debug'`).
- **Save-State Events & Quota Indicator**: Emits `save-state` (`{ state: 'saving' | 'saved' | 'failed', status, labId, error }`) and `error` (`CodeLabError('E_SAVE', ...)`) when `localStorage` persistence fails, updating `#cl-status-save` to `⚠ Save failed (session-only)` instead of falsely displaying `Saved`.
- **Strict SafeHtml Template Tag (`src/html.ts`)**: Added `SafeHtml`, `html`, `raw`, `isSafeHtml`, and `escapeHtml` with `Symbol.for('codelab.SafeHtml')` branding to prevent accidental unescaped DOM interpolation.
- **Strict TypeScript Ratchet & Empty-Catch Lint Gate**: Added `tsconfig.strict.json` (`bun run typecheck:strict`) covering all 8 strict leaf modules (`src/csp.ts`, `src/logger.ts`, `src/html.ts`, `src/zip.ts`, `src/storage.ts`, `src/search.ts`, `src/diagnostics.ts`, `src/scm.ts`), plus `tools/lint.js` (`bun run lint`) enforcing zero empty `catch` blocks and strict module coverage in CI.
- **Repository Governance**: Added `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/dependabot.yml`, and `.github/workflows/release.yml` (tag-triggered npm provenance publishing).

### Fixed
- **Markdown Balanced-Parenthesis Link Parsing**: `renderInlineFormatting` in `src/workbench.ts` now parses balanced parentheses inside Markdown `[text](url)` destinations (e.g., Wikipedia URLs like `https://en.wikipedia.org/wiki/B-tree_(data_structure)`) and blocks `javascript:alert(1)` links without leaving trailing `)` characters in the output.
- **Portable Bundle-First Test Suites**: All 39 test suites now load built artifacts from `dist/` via `tests/helpers/load.js` (`assertFresh()`) and run identically under Bun and Node 20/22/24.
- **Documentation Capability Counts**: Synchronized `README.md` and `ARCHITECTURE.md` counts (`58` POSIX coreutils, `50` Node.js built-in modules, `39` test suites, `6-Tab Bottom Drawer`) with automated regression checks in `tests/test-version-sync.js`.

## [0.1.7] - 2026-04-19

### Added
- Consolidated TypeScript source tree under `src/*.ts` with deterministic single-source version injection from `package.json` (`tools/bundle.js`).
- Added headless runtime, POSIX shell (58 coreutils, streaming `git clone`), PTY terminal engine, and 6-tab IDE workbench with embedded and Service Worker pop-out Web Preview.
