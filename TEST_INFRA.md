# E2E Test Infra: CodeLab VS Code UI/UX Redesign & Production Readiness

## Test Philosophy

This end-to-end (E2E) test suite validates the `code-lab` VS Code UI/UX Redesign, Non-Destructive Workspace & Settings State Model, and Production Readiness workflows (`ORIGINAL_REQUEST.md` R1–R3 & `PROJECT.md` §1–§5) using **strictly opaque-box browser verification** in headless Chromium (`@playwright/test`):

1. **Opaque-Box & Requirement-Driven Purity**:
   - Every assertion exercises the application through real browser DOM interactions, ARIA roles/attributes, bounding-box layout geometry (`getBoundingClientRect()`), keyboard/pointer events, `localStorage` / `IndexedDB` persistence across page reloads, WCAG 2.1 relative luminance contrast math, and documented public `window.CodeLab` / `PROJECT.md §5` imperative APIs (`openSettings`, `showSearchModal`, `showScmModal`, `showProblemsModal`, `switchDrawerTab`, `WorkspaceStorage`).
   - Zero tests read or mutate private implementation internals (such as `_diagnosticsStore`, `_terminalSessions`, or `_editor`).
   - Region-scoped locators (e.g., `aside.codelab-sidebar` for `Explorer`, `Search`, and `Source Control`; `.codelab-workbench-main #cl-drawer` for `Problems` and `Terminal`; `.codelab-editor-col #cl-settings-host` + `[data-cl-tab="__settings__"]` for `Settings`) reject legacy blocking modal UIs so pre-redesign defects cannot false-pass, while supporting documented selector variants (`PROJECT.md §5`) so compliant implementations never false-fail.

2. **Systematic 4-Tier Methodology**:
   - **Tier 1 — Category-Partition Core Feature Coverage (`66` tests, `>= 5` per feature `F1`–`F12`)**: Validates primary user-facing partitions and happy-path workflows across both standalone SDK (`/workbench`) and Cloud IDE host shell (`/cloud-ide`).
   - **Tier 2 — Boundary Value Analysis, Negative & Corner-Case Suite (`64` tests, `>= 5` per feature `F1`–`F12`)**: Exercises splitter min/max clamping, narrow viewports, empty `{}` workspaces, collision/traversal guards, `Escape`/`Cancel`/backdrop dismissals, HTTP `403`/`404`/`429`/`500` & mid-blob aborts, invalid regexes, malformed `.codelab/*.json`, last-terminal-session kill, workspace-over-user settings snap-back prevention, viewport-clamped context menus, nested-button bans, and XSS escaping.
   - **Tier 3 — Pairwise Cross-Feature Interaction Suite (`20` tests)**: Verifies 2-way and 3-way interactions across Menu Bar, Activity Bar/Sidebar, Bottom Panel, Explorer VFS sync, Multi-Workspace Isolation, Clone Repo, Search & Replace, Source Control + CLI `git`, Problems Diagnostics, Multi-Session Terminal, Live Settings, and Theme Contrast.
   - **Tier 4 — Real-World Application Workloads & Explicit VS Code UI/UX Parity Checklist Audit (`10` scenarios)**: Executes multi-step developer sessions end-to-end and runs automated 11-point VS Code UI/UX Parity Checklist Audits against both `/workbench` and `/cloud-ide`.

---

## Feature Inventory

All `N = 12` features (`F1`–`F12`) from `ORIGINAL_REQUEST.md` and `PROJECT.md § Feature Inventory` are mapped below with exact Tier 1, Tier 2, Tier 3, and Tier 4 test coverage:

| # | Feature | Requirement & Contract Source | Tier 1 (`>= 5`) | Tier 2 (`>= 5`) | Tier 3 Pairwise | Tier 4 Real-World & Parity | Total |
|---|---------|-------------------------------|-----------------|-----------------|-----------------|----------------------------|:-----:|
| **F1** | **VS Code Title & Menu Bar Navigation** | `ORIGINAL_REQUEST` R1, AC #2; `PROJECT.md` §2, §5.1, F1 | `6` (`T1-F1-01..06` in `tier1-layout-menus-sidebar.spec.ts`) | `5` (`T2-F1-01..05` in `tier2-boundary-layout-explorer.spec.ts`) | `T3-01, T3-12, T3-19` | `T4-01, T4-08, T4-09, T4-10` | **18** |
| **F2** | **VS Code Activity Bar & Collapsible Primary Sidebar** | `ORIGINAL_REQUEST` R1, AC #2; `PROJECT.md` §2, §5.1, F2 | `5` (`T1-F2-01..05` in `tier1-layout-menus-sidebar.spec.ts`) | `5` (`T2-F2-01..05` in `tier2-boundary-layout-explorer.spec.ts`) | `T3-02, T3-13, T3-20` | `T4-02, T4-09, T4-10` | **16** |
| **F3** | **Dedicated Bottom Panel & Sidebar-Terminal Separation** | `ORIGINAL_REQUEST` R1, AC #1, #2; `PROJECT.md` §2, §5.1, F3 | `5` (`T1-F3-01..05` in `tier1-layout-menus-sidebar.spec.ts`) | `5` (`T2-F3-01..05` in `tier2-boundary-layout-explorer.spec.ts`) | `T3-02, T3-09, T3-14` | `T4-03, T4-09, T4-10` | **16** |
| **F4** | **Folder & File Explorer Sidebar** | `ORIGINAL_REQUEST` R1, R3, AC #1; `PROJECT.md` §2, §5.1, F4 | `6` (`T1-F4-01..06` in `tier1-layout-menus-sidebar.spec.ts`) | `6` (`T2-F4-01..06` in `tier2-boundary-layout-explorer.spec.ts`) | `T3-03, T3-04, T3-05, T3-15` | `T4-01, T4-04, T4-09, T4-10` | **20** |
| **F5** | **Non-Destructive `Blank IDE` & Workspace Isolation** | `ORIGINAL_REQUEST` R2, R3, AC #5, #6, #7; `PROJECT.md` §3, §2, §5.3, F5 | `5` (`T1-F5-01..05` in `tier1-workspaces-clone-settings.spec.ts`) | `5` (`T2-F5-01..05` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-01, T3-06, T3-07` | `T4-05, T4-08, T4-10` | **16** |
| **F6** | **End-to-End Non-Destructive `Clone Repo`** | `ORIGINAL_REQUEST` R2, R3, AC #6, #7; `PROJECT.md` §3.3, §5.3, F6 | `6` (`T1-F6-01..06` in `tier1-workspaces-clone-settings.spec.ts`) | `6` (`T2-F6-01..06` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-06, T3-08, T3-16` | `T4-01, T4-05, T4-06, T4-08, T4-10` | **20** |
| **F7** | **End-to-End `Search` & Replace Sidebar View** | `ORIGINAL_REQUEST` R3, AC #2, #5, #7; `PROJECT.md` §5.1, §5.2, F7 | `6` (`T1-F7-01..06` in `tier1-search-scm-problems-terminal.spec.ts`) | `5` (`T2-F7-01..05` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-03, T3-08, T3-10, T3-17` | `T4-01, T4-02, T4-04, T4-09, T4-10` | **20** |
| **F8** | **End-to-End `Source Control` (Git) Sidebar View** | `ORIGINAL_REQUEST` R3, AC #2, #5, #7; `PROJECT.md` §4, §5.1, §5.2, F8 | `6` (`T1-F8-01..06` in `tier1-search-scm-problems-terminal.spec.ts`) | `5` (`T2-F8-01..05` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-04, T3-07, T3-10, T3-11` | `T4-01, T4-02, T4-04, T4-09, T4-10` | **20** |
| **F9** | **End-to-End `Problems` Panel & Live Diagnostics** | `ORIGINAL_REQUEST` R3, AC #2, #5, #7; `PROJECT.md` §3, §5.1, §5.2, F9 | `5` (`T1-F9-01..05` in `tier1-search-scm-problems-terminal.spec.ts`) | `5` (`T2-F9-01..05` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-09, T3-16, T3-18` | `T4-02, T4-03, T4-07, T4-09, T4-10` | **18** |
| **F10** | **Multi-Session `Terminal` Panel** | `ORIGINAL_REQUEST` R1, AC #1, #2, #5; `PROJECT.md` §2, §5.1, §5.2, F10 | `5` (`T1-F10-01..05` in `tier1-search-scm-problems-terminal.spec.ts`) | `5` (`T2-F10-01..05` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-05, T3-11, T3-14, T3-15` | `T4-01, T4-02, T4-03, T4-06, T4-09, T4-10` | **20** |
| **F11** | **Non-Destructive `Settings` Editor Tab & Live Wiring** | `ORIGINAL_REQUEST` R2, R3, AC #4, #5, #7; `PROJECT.md` §1, §3.2, §5.1, F11 | `6` (`T1-F11-01..06` in `tier1-workspaces-clone-settings.spec.ts`) | `6` (`T2-F11-01..06` in `tier2-boundary-workflows-settings.spec.ts`) | `T3-12, T3-13, T3-15, T3-17, T3-18` | `T4-02, T4-05, T4-07, T4-09, T4-10` | **22** |
| **F12** | **UI/UX Rough Edges, Theme Contrast & Parity Polish** | `ORIGINAL_REQUEST` R1, R3, AC #3; `PROJECT.md` §1, §5.1, F12 | `5` (`T1-F12-01..05` in `tier1-workspaces-clone-settings.spec.ts`) | `6` (`T2-F12-01..06` in `tier2-boundary-layout-explorer.spec.ts`) | `T3-18, T3-19, T3-20` | `T4-07, T4-08, T4-09, T4-10` | **18** |

---

## Test Architecture

### Runner & CLI Interface
Execute the suite via `node tests/vscode-e2e/run-e2e.js`:

```bash
# Run all 4 tiers (160 tests)
node tests/vscode-e2e/run-e2e.js

# Run an individual tier (1, 2, 3, 4, or all)
node tests/vscode-e2e/run-e2e.js --tier=1
node tests/vscode-e2e/run-e2e.js --tier=2
node tests/vscode-e2e/run-e2e.js --tier=3
node tests/vscode-e2e/run-e2e.js --tier=4

# List discovered test cases without launching browsers
node tests/vscode-e2e/run-e2e.js --list
node tests/vscode-e2e/run-e2e.js --tier=1 --list

# Filter by test ID, feature code, or title regex
node tests/vscode-e2e/run-e2e.js --grep="T1-F6"
node tests/vscode-e2e/run-e2e.js --tier=4 --grep="T4-09|T4-10"
```

`run-e2e.js` invokes `node_modules/.bin/playwright test -c tests/vscode-e2e/playwright.vscode.config.ts` and propagates non-zero exit codes on any failure.

### Isolated Playwright Config & Dual-Host Zero-Dependency Server (`127.0.0.1:4273`)
- **`playwright.vscode.config.ts`**:
  - Binds exclusively to `http://127.0.0.1:4273` (`process.env.VSCODE_E2E_PORT || 4273`), completely isolated from `playwright.config.ts` (`4173`) and Astro (`4321`).
  - Configures headless Desktop Chromium at `1280x800` viewport and writes artifacts to `test-results/vscode-e2e/`.
- **`server.js`**:
  - `GET /healthz`: Readiness endpoint returning `200 {"ok":true,"port":4273}`.
  - `GET /workbench`: Full-bleed `100vw × 100vh` standalone SDK fixture loading `/dist/code-lab.{css,js}`, `/dist/code-lab-sql.{css,umd.js}`, and `/dist/extensions/{typescript,python,cpp,guided-lab}.js`, wiring `defaultExtensions`, supporting `?labId=`, `?blank=1`, `?empty=1` (`files: {}`), `?lang=`, `?mode=`, `?persist=0|1`, `?theme=`, `?git=1`, and `?nomount=1`, and exposing `window.__codelabIde` + `window.__codelabTest`.
  - `GET /cloud-ide`: Dual-mode Cloud IDE host serving `examples/cloud-ide/dist/index.html` when present and at least as fresh as `examples/cloud-ide/src/pages/index.astro` (`distStat.mtimeMs >= astroStat.mtimeMs`), or dynamically stripping Astro frontmatter (`--- ... ---`) and `is:inline` / `is:global` directives from `index.astro` when `index.astro` is newer or `?_source=astro` is requested.
  - Static asset cascade: Resolves `/dist/*` and `/packages/*` from repo root first so SDK builds are never shadowed; resolves `/_astro/*`, `/fonts/*`, `/favicon.svg`, and `/preview-sw.js` across `examples/cloud-ide/dist/ -> examples/cloud-ide/public/ -> ROOT/` with `204 No Content` fallback on missing favicons so zero spurious `404` console errors occur.

### Hermetic Offline Mocking & Helpers (`tests/vscode-e2e/helpers/`)
- **`workbench-helpers.ts`**:
  - Stubs `https://cdn.jsdelivr.net/npm/**` and `https://cdn.jsdelivr.net/pyodide/**` with offline JS stubs (`200 OK`) so `#cl-fallback-editor` activates deterministically with zero external internet traffic and zero `net::ERR_FAILED` console noise—while leaving `https://cdn.jsdelivr.net/gh/**` open for `github-mock.ts` Strategy B rate-limit fallback tests.
  - Attaches `attachZeroErrorTracker(page)` to assert zero uncaught `pageerror` exceptions and zero unexpected `console.error` logs in every test.
  - Provides contract-scoped locators (`PROJECT.md §5`), dual-mode editor helpers (`openOrCreateCodeFile`, `setActiveEditorText`, `getActiveEditorText`), `runTerminalCommand`, storage seeders (`seedPersistedWorkspace`, `seedUserSettings`), non-destructive workspace transition verifiers (`verifyNonDestructiveTransition` supporting both Variant A confirmation modal and Variant B automatic workspace isolation), WCAG 2.1 luminance contrast helpers (`computeContrastRatio`), bounding-box non-overlap & Sidebar-Drawer separation verifiers (`assertNoOverlap`, `assertSidebarDrawerSeparation`), and the 11-point VS Code UI/UX Parity Checklist runner.
- **`github-mock.ts`**:
  - Intercepts all 4 GitHub clone wire domains (`api.github.com`, `data.jsdelivr.com`, `raw.githubusercontent.com`, `cdn.jsdelivr.net/gh`) across `'happy'`, `'rate-limit-fallback'` (`403` / `429`), `'not-found'` (`404`), `'server-error'` (`500`), `'mid-blob-abort'`, `blobDelayMs`, `pauseAfterBlobs` (`waitForPausedBlobs()` / `releasePausedBlobs()`), and multi-repository routing.

### Directory Layout

```text
tests/vscode-e2e/
├── playwright.vscode.config.ts                     # Isolated Chromium config on 127.0.0.1:4273 (1280x800)
├── server.js                                       # Zero-dep HTTP server (/healthz, /workbench, /cloud-ide, /dist/*)
├── run-e2e.js                                      # Tier-aware CLI test runner (--tier=1|2|3|4|all, --list, --grep)
├── helpers/
│   ├── github-mock.ts                              # Deterministic 4-domain GitHub & jsDelivr clone interceptor
│   └── workbench-helpers.ts                        # Scoped locators, error tracker, geometry, contrast & VFS helpers
├── tier1-layout-menus-sidebar.spec.ts              # Tier 1: F1 (6), F2 (5), F3 (5), F4 (6) — 22 tests
├── tier1-workspaces-clone-settings.spec.ts         # Tier 1: F5 (5), F6 (6), F11 (6), F12 (5) — 22 tests
├── tier1-search-scm-problems-terminal.spec.ts      # Tier 1: F7 (6), F8 (6), F9 (5), F10 (5) — 22 tests
├── tier2-boundary-layout-explorer.spec.ts          # Tier 2: F1 (5), F2 (5), F3 (5), F4 (6), F12 (6) — 27 tests
├── tier2-boundary-workflows-settings.spec.ts       # Tier 2: F5 (5), F6 (6), F7 (5), F8 (5), F9 (5), F10 (5), F11 (6) — 37 tests
├── tier3-cross-feature.spec.ts                     # Tier 3: Pairwise 2-way & 3-way feature interactions — 20 tests
└── tier4-real-world-and-parity-audit.spec.ts       # Tier 4: Real-world sessions + 11-point VS Code Parity Audits — 10 tests
```

---

## Real-World Application Scenarios (Tier 4)

| ID | Host | Scenario Title | Features Exercised | End-to-End Verification Summary |
|---|---|---|---|---|
| `T4-01` | `/cloud-ide` | Full GitHub Maintainer Lifecycle (`Clone → Explore → Search → Edit → Diff → Commit → Reload`) | F1, F4, F6, F7, F8, F10 | Clones `acme/fullstack-app` via `#landing-overlay`, navigates Explorer, searches `API_VERSION` (`Mod+Shift+F`) and jumps to `src/config.ts`, edits code, inspects SCM Diff, stages & commits, verifies `git log -n 1` in Terminal, and confirms persistence across `page.reload()`. |
| `T4-02` | `/cloud-ide` | All-Views State Preservation Gauntlet (`ORIGINAL_REQUEST` AC #4 & #5) | F2, F7, F8, F9, F10, F11 | Creates `src/feature.js` and leaves unsaved edits in `index.js` (`files.autoSave = 'off'`), cycles `Explorer → Search → Source Control → Problems → Terminal → Settings` (mutating `editor.fontSize` & `workbench.colorTheme`), returns to `index.js` verifying zero file/buffer/tab loss, and flushes via `Mod+S`. |
| `T4-03` | `/workbench` | Polyglot Debugging & Multi-Terminal Workflow (`Python + JS + Problems + 2 Terminals`) | F3, F9, F10 | Introduces Python syntax error in `analyzer.py`, observes live Status Bar `⊗` & `Problems` row, clicks diagnostic to jump to offending line, fixes error (`⊗ 0`), executes script in Terminal Session 1, verifies output in isolated Terminal Session 2 (`cwd` separation), and maximizes/restores Bottom Panel. |
| `T4-04` | `/workbench` | Multi-File Refactoring & Accidental Change Recovery (`Explorer + Search Replace All + SCM Discard`) | F4, F7, F8 | Initializes Git repo with 5 modules, renames `src/helpers.js → src/utils.js` in Explorer, runs `Replace All` in Search Sidebar without tab explosion, discards unintended edit on 1 file in SCM while staging & committing the other 4, and executes entry script. |
| `T4-05` | `/cloud-ide` | Non-Destructive Multi-Workspace Juggling (`ORIGINAL_REQUEST` AC #6) | F5, F6, F11 | Clones `acme/project-alpha` and edits code; verifies `Escape`/`Cancel` on Clone & Blank IDE leave workspace untouched; opens isolated Blank IDE (`prototype.js`) and isolated `acme/project-beta`; switches across all 3 workspaces via `File → Open Recent Workspace` verifying 100% preservation. |
| `T4-06` | `/cloud-ide` | Network Fault Resilience During Clone (`500 Rollback + 403 jsDelivr Fallback`) | F6, F10 | Verifies failed HTTP `500` clone leaves populated workspace (`important.js` & `/workspace/*` VFS) 100% untouched, then clones `acme/ratelimited-repo` via HTTP `403` → jsDelivr Strategy B fallback and verifies clean Git status in Terminal. |
| `T4-07` | `/workbench` | SQL Studio & Configuration Live Tuning Workflow (`Settings + JSON Diagnostics + SQL`) | F9, F11, F12 | Tunes `sql.defaultDialect` and `editor.fontSize` in `Settings` tab, opens `.codelab/settings.json` via `Open Settings (JSON)`, triggers and resolves a JSON diagnostic via `Problems`, and transitions from SQL error diagnostic to valid `Query Results`. |
| `T4-08` | `/cloud-ide` | Demo Environment → Utility Views → Export ZIP Non-Destructive Workflow | F1, F5, F6, F12 | Launches a Featured Demo from `#landing-overlay`, adds custom user code, opens `Search`, `Source Control`, `Problems`, and `Settings`, exports workspace ZIP, and verifies active `labId` never resets to `'cloud-ide'` and ZIP archive contains the custom edit. |
| `T4-09` | `/workbench` | Explicit 11-Point VS Code UI/UX Parity Checklist Audit — Standalone Workbench | F1–F4, F7–F12 | Audits all 11 VS Code parity invariants on `/workbench`: `[role="menubar"]`, `48px` Activity Bar, full-height Primary Sidebar (`sidebarRect.bottom > drawerRect.top`), separate Bottom Panel (`drawerRect.left >= sidebarRect.right - 1`, zero terminal in sidebar), non-modal views/Settings tab, splitters/toggles, Status Bar items, viewport clamping, non-overlapping regions, zero nested/dead buttons, and WCAG contrast across `dark`/`light`/`high-contrast`. |
| `T4-10` | `/cloud-ide` | Explicit 11-Point VS Code UI/UX Parity Checklist Audit — Cloud IDE Host Shell | F1–F12 | Audits all 11 VS Code parity invariants on `/cloud-ide`, plus full-bleed `100vh × 100vw` geometry, removal of workspace-replacing top-bar buttons (`#header-search-btn`, `#header-scm-btn`, `#header-problems-btn`, `#header-settings-btn`, `#header-zip-btn`), dismissible Clone/Landing modal (`✕` + `Escape`), and zero console/page errors. |

---

## Coverage Thresholds

For `N = 12` cataloged features (`F1`–`F12`), minimum required thresholds vs. actual authored test counts are:

| Tier | Formula (`N = 12`) | Minimum Threshold | Authored Count | Per-Feature Floor Check | Status |
|------|--------------------|:-----------------:|:--------------:|-------------------------|:------:|
| **Tier 1 (Core Happy-Path)** | `>= 5 × N` | `60` (`>= 5` / feature) | **`66`** | Min `5`, Max `6` across `F1`–`F12` | Meets & Exceeds |
| **Tier 2 (Boundary & Negative)** | `>= 5 × N` | `60` (`>= 5` / feature) | **`64`** | Min `5`, Max `6` across `F1`–`F12` | Meets & Exceeds |
| **Tier 3 (Pairwise Interactions)** | `>= ceil(1.5 × N)` | `18` | **`20`** | Every feature `F1`–`F12` participates in `>= 3` pairs | Meets & Exceeds |
| **Tier 4 (Real-World & Parity Audit)** | `>= 8` (`+ 2 Parity Audits`) | `8` | **`10`** | Includes `T4-09` (`/workbench`) & `T4-10` (`/cloud-ide`) 11-point Parity Audits | Meets & Exceeds |
| **Total Suite (Tiers 1–4)** | Sum of Tiers 1–4 | **`146`** | **`160`** | Zero `skip`/`fixme`, zero private internals, zero console/pageerror leaks | **160 / 146** |
