# Changelog

All notable changes to `@innovatorved/code-lab` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
