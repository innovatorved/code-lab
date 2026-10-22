# Changelog

All notable changes to `@innovatorved/code-lab` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Shared Preview CSP Builder (`src/csp.ts`)**: Added `buildPreviewCsp`, `injectCspMeta`, `resolvePreviewCspMode`, and the `previewCsp` workbench option / `preview-csp` HTML attribute supporting `'strict'`, `'balanced'` (new default), `'permissive'`, or a custom CSP policy string across both the embedded `srcdoc` iframe and `preview-sw.js`.
- **Preview CSP Violation Reporting**: Injected a `securitypolicyviolation` listener into the preview bridge that forwards blocked resource details (`blockedURI`, `violatedDirective`, `effectiveDirective`, `sourceFile`, `lineNumber`) to the host workbench (`csp-violation` event and structured logger warning).
- **Structured Diagnostics & Error Taxonomy (`src/logger.ts`)**: Added `CodeLabError` (`code`, `context`, `cause`), `isCodeLabError`, `createLogger`, and the `logLevel` workbench option (`'silent' | 'error' | 'warn' | 'info' | 'debug'`).
- **Save-State Events & Quota Indicator**: Emits `save-state` (`{ state: 'saving' | 'saved' | 'failed', status, labId, error }`) and `error` (`CodeLabError('E_SAVE', ...)`) when `localStorage` persistence fails, updating `#cl-status-save` to `⚠ Save failed (session-only)` instead of falsely displaying `Saved`.
- **Strict SafeHtml Template Tag (`src/html.ts`)**: Added `SafeHtml`, `html`, `raw`, `isSafeHtml`, and `escapeHtml` with `Symbol.for('codelab.SafeHtml')` branding to prevent accidental unescaped DOM interpolation.
- **Strict TypeScript Ratchet & Empty-Catch Lint Gate**: Added `tsconfig.strict.json` (`bun run typecheck:strict`) covering `src/csp.ts`, `src/logger.ts`, and `src/html.ts`, plus `tools/lint.js` (`bun run lint`) enforcing zero empty `catch` blocks and strict module coverage in CI.
- **Repository Governance**: Added `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/dependabot.yml`, and `.github/workflows/release.yml` (tag-triggered npm provenance publishing).

### Fixed
- **Markdown Balanced-Parenthesis Link Parsing**: `renderInlineFormatting` in `src/workbench.ts` now parses balanced parentheses inside Markdown `[text](url)` destinations (e.g., Wikipedia URLs like `https://en.wikipedia.org/wiki/B-tree_(data_structure)`) and blocks `javascript:alert(1)` links without leaving trailing `)` characters in the output.
- **Portable Bundle-First Test Suites**: All 32 test suites now load built artifacts from `dist/` via `tests/helpers/load.js` (`assertFresh()`) and run identically under Bun and Node 20/22/24.
- **Documentation Capability Counts**: Synchronized `README.md` and `ARCHITECTURE.md` counts (`58` POSIX coreutils, `50` Node.js built-in modules, `32` test suites, `6-Tab Bottom Drawer`) with automated regression checks in `tests/test-version-sync.js`.

## [0.1.7] - 2026-04-19

### Added
- Consolidated TypeScript source tree under `src/*.ts` with deterministic single-source version injection from `package.json` (`tools/bundle.js`).
- Added headless runtime, POSIX shell (58 coreutils, streaming `git clone`), PTY terminal engine, and 6-tab IDE workbench with embedded and Service Worker pop-out Web Preview.
