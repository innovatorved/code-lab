# Project: CodeLab VS Code UI/UX Redesign, Non-Destructive Workspace State & End-to-End Production Readiness

## Architecture

### 1. System Overview & Surfaces
`code-lab` consists of:
1. **Strict 4-Layer TypeScript Packages (`packages/*`, `apps/web`)**:
   - Layer 0 (`@code-lab/core`): DI, disposables, typed events, POSIX path utilities (zero DOM globals).
   - Layer 1 (`@code-lab/fs`, `@code-lab/settings`, `@code-lab/commands`): `FileSystemService`, `ConfigurationService` (User vs Workspace vs Default scope resolution), command/keybinding registries.
   - Layer 2 (`@code-lab/sql`, `@code-lab/runtime`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/editor`): execution, SQL, terminal, preview, text model services.
   - Layer 3 (`@code-lab/ui`): `ThemeService`, `PluginRegistry`, `SettingsDialogController` / inline Settings Editor UI.
   - Layer 4 (`apps/web`): `createCodeLabKernel()` (`CodeLabModular`) and standalone full-viewport Vite web app shell (`apps/web/index.html`).
2. **Core Workbench SDK (`src/workbench.ts`, `src/code-lab.css`, `src/{shell,scm,search,diagnostics,storage,runtime,terminal}.ts`, `src/workbench/*.ts`, `src/extensions/*.ts`)**:
   - Bundled via `tools/bundle.js` (`bun run build`) into `dist/code-lab.{js,umd.js,esm.js,css,d.ts}` and automatically synced to `examples/cloud-ide/public/dist/`.
3. **Cloud IDE Host Application (`examples/cloud-ide/src/pages/index.astro`)**:
   - Standalone static Astro application mounting `window.CodeLab` with URL query routing (`?repo=`, `?blank=1`), workspace switching, quick-start demos, and repository cloning.

### 2. Target VS Code 5-Region Workbench Architecture (R1)
`CodeLabWorkbench._renderShell()` and `src/code-lab.css` implement VS Code's canonical 5-region spatial hierarchy across all hosts (`examples/cloud-ide`, `apps/web`, standalone SDK):

```text
div.codelab.codelab-workbench
├── 1. header.codelab-topbar.codelab-titlebar     [Menu Bar (File, Edit, Selection, View, Go, Run, Terminal, Help) | Command Center (⌘P / ⇧⌘P) | Run & Layout Toggles (Toggle Sidebar, Toggle Panel)]
├── 2. div.codelab-body                           [flex: 1; display: flex; min-height: 0; overflow: hidden]
│   ├── A. nav.codelab-activitybar                [48px fixed rail, full vertical height: Explorer, Search, Source Control (with badge), Guided/Extensions; bottom: Manage/Settings ⚙️]
│   ├── B. aside.codelab-sidebar                  [Full vertical height between Titlebar & Statusbar; switches between #cl-sidebar-explorer, #cl-sidebar-search, #cl-sidebar-scm, sidebar plugins; NEVER hosts Terminal]
│   ├── C. div#cl-splitter-files                  [Full-height vertical resize sash; hidden when Primary Sidebar collapsed]
│   └── D. div.codelab-workbench-main             [flex: 1; min-width: 0; display: flex; flex-direction: column]
│       ├── div.codelab-editor-row                [flex: 1; min-height: 0; display: flex: Editor Group (.codelab-editor-col with File Tabs + Settings Tab + Diff View + Breadcrumbs + Monaco/Fallback/SQL/Markdown/Settings hosts) + optional Split Preview]
│       ├── div#cl-splitter-h                     [Horizontal resize sash strictly inside .codelab-workbench-main, never spanning under .codelab-sidebar]
│       └── section#cl-drawer.codelab-drawer      [Dedicated Bottom Panel: PROBLEMS | OUTPUT | TERMINAL | PORTS (+ contextual Tests/SQL/Preview) + contextual actions + Maximize (^) + Close (×)]
└── 3. footer.codelab-statusbar                   [24px Status Bar: Runtime + Git Branch (⎇) + Problems (⊗/⚠) | Cursor Ln/Col + Spaces + UTF-8 + Language + Save Status]
```

### 3. Non-Destructive Workspace & Settings State Model (R2)
1. **Active Instance Preservation**: Host actions (`Settings`, `Search`, `Source Control`, `Problems`, `Export ZIP`, `Menu` actions) ALWAYS operate on the currently mounted `CodeLabWorkbench` instance—`ensureIde()` NEVER defaults `labId` to `'cloud-ide'` or calls `destroy()` unless performing an explicit, user-confirmed or isolated workspace switch.
2. **Non-Destructive `Settings` Editor Tab & Scope Synchronization**:
   - Opening Settings (`Mod+,`, Activity Bar gear, or `File → Preferences → Settings`) opens/focuses a non-destructive `Settings` tab (`__settings__`) in the editor tab bar, hiding `#cl-monaco-host` via `display: none` while keeping all Monaco `ITextModel`s, open tabs, unsaved buffers, cursor/scroll positions, and workspace files 100% intact.
   - `Settings` supports `User` and `Workspace (.codelab/settings.json)` scopes. Editing any key that is also present in `.codelab/settings.json` (or editing in `Workspace` scope) updates both `ConfigurationService` and `.codelab/settings.json` so changes take immediate live effect and never snap back.
3. **Workspace Registry & Non-Destructive `Blank IDE` / `Clone Repo`**:
   - `WorkspaceStorage` (`src/storage.ts`) maintains a persistent workspace registry (`listWorkspaces`, `getWorkspaceMeta`, `upsertWorkspaceMeta`, `createBlankWorkspaceId`) in `localStorage`/`IndexedDB`.
   - Triggering `Blank IDE` or `Clone Repo` when workspace files or unsaved edits exist NEVER silently deletes or overwrites user code: users can either open an **isolated workspace** (preserving the existing workspace intact in storage and reachable via `File → Open Recent Workspace`) or **explicitly confirm** overwriting/resetting, or **Cancel** (`✕`, `Escape`, backdrop click).
   - `cloneRepo()` performs a **transactional VFS fetch**: network tree/blob downloads complete before replacing `/workspace/*`, so failed/cancelled clones leave existing files 100% untouched.

---

## Feature Inventory

Every feature discovered during the 3-Explorer Phase 0 Survey and specified in `ORIGINAL_REQUEST.md` is cataloged below with an explicit Milestone assignment.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | **VS Code Title & Menu Bar Navigation** | Unified top Title/Menu Bar inside `CodeLabWorkbench` (`File`, `Edit`, `Selection`, `View`, `Go`, `Run`, `Terminal`, `Help` dropdowns, Command Center, layout toggles); removal of workspace-replacing top-bar buttons in `examples/cloud-ide`. | M2, M3 | R1, Survey 1/2/3 (`B-01`, `B-02`) |
| F2 | **VS Code Activity Bar & Collapsible Primary Sidebar** | Full-height `48px` left Activity Bar (`Explorer`, `Search`, `Source Control` w/ badge, bottom `Settings` gear/Manage menu) + full-height resizable/collapsible Primary Sidebar (`Mod+B`, `workbench.sideBar.visible`, sidebar plugin contributions, persisted state). | M2 | R1, Survey 2/3 (`B-02`) |
| F3 | **Dedicated Bottom Panel & Sidebar-Terminal Separation** | Terminal and Problems live strictly in a dedicated resizable/collapsible/maximizable Bottom Panel beneath the Editor column—never inside or under the Primary Sidebar; includes Maximize (`^`), Close (`×`), and persisted panel height/tab/visibility. | M2 | R1, Survey 2/3 (`B-02`, `B-19`) |
| F4 | **Folder & File Explorer Sidebar** | Dedicated workspace file/folder tree with inline create/rename, confirmed delete, drag-and-drop move, full VFS + `kernel.fs` sync on delete/rename/move, dirty (`●`) indicators + `Mod+S` save, `files.exclude` filtering, Collapse All, and Empty Workspace Welcome actions. | M2 | R1, R3, Survey 2/3 (`B-08`, `B-09`) |
| F5 | **Non-Destructive `Blank IDE` & Workspace Isolation** | Persistent multi-workspace registry (`src/storage.ts`), non-destructive `ensureIde()`, isolated Blank IDE creation (`blank-workspace-<id>`) + explicit confirmation before resetting/replacing populated or dirty workspaces, support for explicit empty `{}` workspace without forced `demo.js` mismatch, and non-destructive `setLanguage`/`setMode`/`resetLab` guards. | M1, M2, M3 | R2, R3, Survey 1/3 (`B-01`, `B-06`, `B-07`) |
| F6 | **End-to-End Non-Destructive `Clone Repo`** | Dismissible Clone Repo modal & `#landing-overlay` (`✕`, `Escape`, backdrop click), live GitHub URL validation, progress bar + inline error banner + Cancel, transactional clone (zero VFS wipe before fetch succeeds), confirmation/isolation before overwriting existing files or saved repo edits (`forceClone` guard), opening only primary README/entry tab (not 250 tabs), and Git HEAD sync. | M1, M2, M3 | R2, R3, Survey 1/3 (`B-03`, `B-04`, `B-05`) |
| F7 | **End-to-End `Search` & Replace Sidebar View** | Persistent Primary Sidebar `Search` view (`Mod+Shift+F`) rendering grouped `{ file, matches }` results (`file:line:col` + highlighted match snippet, no `undefined`), exact `(line, col)` click-to-jump in editor without closing Search, in-place Replace / Replace All without opening extra tabs, and `Aa` / `ab` / `.*` + include/exclude glob controls. | M2 | R3, Survey 2/3 (`B-10`, `B-11`, `B-12`) |
| F8 | **End-to-End `Source Control` (Git) Sidebar View** | Accurate git detection (`Blank IDE` starts uninitialized with `Initialize Repository` & `Clone Repository` CTAs unless `.git` exists), unified `gitState` schema across `src/scm.ts` & `src/shell.ts` CLI `git`, persistent Sidebar `Source Control` view (`Ctrl+Shift+G`) with preserved commit input, `Staged Changes` / `Changes` groups, Stage/Unstage/Stage All/Discard, click-to-Diff (`HEAD` vs working tree), branch switcher, and commit log. | M1, M2 | R3, Survey 2/3 (`B-13`, `B-14`, `B-15`) |
| F9 | **End-to-End `Problems` Panel & Live Diagnostics** | `DiagnosticsStore.setFileDiagnostics` implementation, constructor initialization before extension linters + live Python/C++/Monaco/SQL/`.codelab` diagnostics wiring, Bottom Panel `Problems` view (`Mod+Shift+M`) + Status Bar `⊗/⚠` badge (no redundant blocking modal), severity/text filters, and exact `(line, col)` jump on click. | M1, M2 | R3, Survey 2/3 (`B-16`, `B-17`, `B-18`) |
| F10 | **Multi-Session `Terminal` Panel** | Dedicated Bottom Panel `Terminal` (`` Ctrl+` ``, `Ctrl+Shift+\``) with per-session isolated `{ id, name, logs, cwd, inRepl, replHistory, inputBuffer }`, kill/reset support including last session, terminal-only header actions hidden on other tabs, live `terminal.fontSize` & `terminal.scrollback`, and expanded CLI tab completion. | M2 | R1, R3, Survey 2/3 (`B-19`, `B-20`) |
| F11 | **Non-Destructive `Settings` Editor Tab & Live Wiring** | `Settings` opens as a non-destructive editor tab (`__settings__`) preserving 100% of files, open tabs, unsaved code, and state; `User` vs `Workspace` scope tabs + `Open Settings (JSON)` + `Reset` / `Reset All` fixing workspace-over-user snap-back; all 17 built-in settings wired live across Monaco models, fallback editor, SQL, Terminal, Explorer, Preview, Runtime, and Theme. | M1, M2, M3 | R2, R3, Survey 1/2/3 (`B-21`, `B-22`) |
| F12 | **UI/UX Rough Edges, Theme Contrast & Parity Polish** | Fix `--cl-accent` / `--cl-accent-fg` white-on-white contrast across dark/light/high-contrast themes, clamp context menus & dropdowns to viewport bounds, remove invalid nested interactive `<button>` markup, make `apps/web` & `examples/cloud-ide` full-bleed `100vh`, add interactive Status Bar items, and pass explicit VS Code UI/UX Parity Audit with zero high/medium defects. | M1, M2, M3, M4 | R1, R3, Survey 2/3 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| **M1** | **Platform Services: Settings Scope Sync, Workspace Registry, Diagnostics & Unified Git/Shell Engine** | Fix `ConfigurationService` & `BUILTIN_SETTINGS` (`packages/settings`), upgrade `SettingsDialogController` & `ThemeService` (`packages/ui`) with inline editor mount + User/Workspace scope sync + contrast fixes, add Workspace Registry (`src/storage.ts`), implement `DiagnosticsStore.setFileDiagnostics` + Python/C++ linter readiness (`src/diagnostics.ts`, `src/extensions/{python,cpp}.ts`), and fix `PosixShell`/`CodeLabScm` `gitState` initialization & schema unification (`src/shell.ts`, `src/scm.ts`). | none | DONE (`sub_orch_m1_gen2/handoff.md`: Iter 2 Gate PASS, Auditor CLEAN, `48/48` suites) |
| **M2** | **Core Workbench VS Code UI/UX Redesign & End-to-End View/Panel Workflows** | Refactor `src/workbench.ts`, `src/code-lab.css`, `src/workbench/*.ts`, and `apps/web/**` to VS Code's 5-region layout (Title/Menu Bar, Activity Bar, full-height Primary Sidebar [`Explorer`, `Search`, `Source Control`], Editor Tab Bar w/ non-destructive `Settings` tab & Diff view, separate Bottom Panel [`Problems`, `Output`, `Terminal`, `Ports`], interactive Status Bar) + end-to-end fixes for Explorer VFS sync, Search, Source Control, Problems, Terminal session isolation, transactional Clone Repo, non-destructive Blank/Language/Reset guards, all 17 live settings, shortcuts, and UI polish. | M1 | IN_PROGRESS (`sub_orch_m2`: `d6187683-9e2e-411d-85f3-fc1cd96f7a08`) |
| **M3** | **Cloud IDE Host Shell Redesign & Non-Destructive Multi-Workspace Lifecycle** | Refactor `examples/cloud-ide/src/pages/index.astro`: fix `ensureIde()` so active workspaces are never destroyed by utility actions, remove workspace-replacing top-bar buttons in favor of VS Code workbench menus/views + slim workspace switcher, make `#landing-overlay`/Clone modal dismissible (`✕`/`Escape`/backdrop), add non-destructive confirmation & workspace isolation for `Blank IDE` and `Clone Repo` (`forceClone` guard), cap initial clone tabs, sync theme, and verify `astro build`. | M2 | PLANNED |
| **E2E** | **E2E Testing Track (Tiers 1–4 Opaque-Box Browser & Workflow Suite)** | Design `TEST_INFRA.md` and implement comprehensive 4-tier automated Playwright/E2E test suite (`tests/vscode-e2e/**`, >=146 test cases across F1–F12 covering both standalone workbench and Cloud IDE host shell, bounding-box layout verification, state preservation, and all 6 core workflows); publish `TEST_READY.md`. | none (runs in parallel) | DONE (`sub_orch_e2e_gen1/handoff.md`: Iter 3 Gate PASS, Auditor CLEAN, `160` tests, `TEST_READY.md` published) |
| **M4** | **Final Milestone: E2E Tiers 1–4 100% Pass, VS Code Parity Audit & Tier 5 Adversarial Hardening** | **Phase 1**: Sequential pass of E2E Tiers 1 → 2 → 3 → 4 (`TEST_READY.md`), wire E2E suite into project test scripts, and pass explicit VS Code UI/UX Parity Checklist Audit with zero high/medium defects. **Phase 2**: Tier 5 white-box adversarial coverage hardening (`Challenger → Worker → Reviewer` loop until zero gaps) + 100% pass of all build/lint/typecheck/unit/browser suites. | M3, E2E | PLANNED |

---

## Interface Contracts

### 1. Settings & UI Service Contract (`packages/settings` ↔ `packages/ui` ↔ `src/workbench.ts`)
- `BUILTIN_SETTINGS` (`packages/settings/src/builtin-schemas.ts`):
  - `workbench.colorTheme`: `enum: ['dark', 'light', 'high-contrast']`, default `'dark'`.
  - `workbench.panel.defaultTab`: `enum: ['terminal', 'problems', 'tests', 'stdin', 'ports', 'preview', 'network', 'inspector', 'observability', 'sql-results']`, default `'terminal'`.
  - `sql.defaultDialect`: `enum: ['postgres', 'sqlite']`, default `'postgres'` (`src/workbench.ts` supports both `sql.defaultDialect` and legacy `sql.dialect` in `.codelab/settings.json`).
- `ConfigurationService` (`packages/settings/src/configuration-service.ts`):
  - Preserves existing methods (`get`, `inspect`, `setUserSetting`, `setWorkspaceSettings`, `setWorkspaceSetting`, `resetSetting`, `onDidChangeConfiguration`).
  - Adds `resetScopedSetting(key: string, scope: 'user' | 'workspace' | 'all'): Promise<void>` and `resetAllSettings(scope?: 'user' | 'workspace' | 'all'): Promise<void>`.
- `SettingsDialogController` (`packages/ui/src/settings-dialog.ts`):
  - Preserves modal `open()` for backwards compatibility AND adds `mountInline(container: HTMLElement, options?: { scope?: 'user' | 'workspace'; onOpenJson?: () => void; onWorkspaceSettingsMutated?: (nextWorkspaceSettings: Record<string, unknown>) => void }): void` so `CodeLabWorkbench` renders Settings directly inside `#cl-settings-host` as a non-destructive editor tab (`__settings__`).
  - Supports `User` and `Workspace` scope tabs. When editing a key in `User` scope that is currently overridden in `workspaceValues`, either updates the workspace override via `onWorkspaceSettingsMutated` or clearly syncs effective value so user edits ALWAYS take immediate effect without snapping back.
- `ThemeService` (`packages/ui/src/themes.ts`):
  - Always sets `--cl-accent-fg` alongside `--cl-accent` so buttons/hover states using `background: var(--cl-accent); color: var(--cl-accent-fg)` maintain WCAG AA contrast in `'dark'`, `'light'`, and `'high-contrast'`.

### 2. Workspace Storage & Isolation Contract (`src/storage.ts` ↔ `src/workbench.ts` & `examples/cloud-ide`)
- `WorkspaceStorage` (`src/storage.ts` / `window.CodeLabWorkspaceStorage`):
  - Adds registry helpers:
    - `listWorkspaces(): WorkspaceMeta[]` (`{ labId: string; title: string; kind: 'blank' | 'repo' | 'demo' | 'custom'; repo?: string; updatedAt: number; fileCount?: number }`)
    - `upsertWorkspaceMeta(meta: WorkspaceMeta): void`
    - `removeWorkspaceMeta(labId: string): void`
    - `hasWorkspaceData(labId: string): boolean` (checks `sd-codelab-v1:${labId}` and `codelab:project:${labId}` for non-empty saved files/edits)
    - `createBlankWorkspaceId(): string` (returns unique `'blank-workspace-' + timestamp/shortId`)

### 3. Diagnostics Contract (`src/diagnostics.ts` & `src/extensions/{python,cpp}.ts` ↔ `src/workbench.ts`)
- `DiagnosticsStore` (`src/diagnostics.ts`):
  - Implements `setFileDiagnostics(file: string, source: string, diags: Array<Partial<DiagnosticItem>>): DiagnosticItem[]` which normalizes `file` (stripping leading `/workspace/` or `./`), atomically removes prior diagnostics matching `(item.file === normalizedFile && item.source === source)`, inserts `diags` with normalized `{ file, source, severity, message, line, col, endLine, endCol, code }`, and fires subscribers once.
- `src/extensions/python.ts` & `src/extensions/cpp.ts`:
  - Attach `_pyLintHandler` / `_cppLintHandler` unconditionally on `workbench` even if `workbench._diagnosticsStore` is created after `setup()`, resolving `workbench._diagnosticsStore` dynamically at lint invocation time.

### 4. Source Control & PosixShell Git Contract (`src/shell.ts` ↔ `src/scm.ts` ↔ `src/workbench.ts`)
- `PosixShell` (`src/shell.ts`):
  - `this.gitState.initialized` defaults to `true` **only** if `/workspace/.git` exists in initial VFS or `options.gitInitialized === true`; otherwise `initialized = false`, `commits = []`, `headSnapshot = {}`, `headFiles = {}`. (`git init` and `cloneGitHubRepository` set `initialized = true` and write `/workspace/.git/HEAD`).
  - Canonical synchronized `gitState` properties:
    - Both `gs.headSnapshot` and `gs.headFiles` reference the exact same `Record<string, string>` object (kept in sync via helper `syncGitHead(gs, snapshot)`).
    - Staging helper supports both CLI (`git add`, `git reset`, `git status`, `git commit`) and `CodeLabScm` (`stageFile`, `unstageFile`, `stageAll`, `unstageAll`, `computeGitStatus`, `commitChanges`, `discardChanges(shell, filePath)`) without `Set` vs `Map` `TypeError` crashes (e.g., maintaining `stagedFiles: Map<string, string | null>` for index content + keeping `staged` compatible or migrating all `src/shell.ts` & `src/scm.ts` callers to a unified helper API while preserving all `tests/test-scm-engine.js` and `tests/test-shell*.js` assertions).

### 5. User-Facing UI, DOM & Accessibility Contract (`src/workbench.ts` & `examples/cloud-ide` ↔ E2E Testing Track)
Both the Implementation Track (`M2`, `M3`) and the E2E Testing Track (`E2E`) MUST adhere to these user-facing selectors, ARIA roles, and behaviors:
1. **Regions & Geometry**:
   - Title / Menu Bar: `.codelab-topbar` containing `[role="menubar"]` with `[role="menuitem"]` triggers for `File`, `Edit`, `Selection`, `View`, `Go`, `Run`, `Terminal`, `Help`.
   - Activity Bar: `nav.codelab-activitybar` (`aria-label="Activity Bar"`) with buttons `[data-cl-activity="explorer"]` (`aria-label="Explorer"`), `[data-cl-activity="search"]` (`aria-label="Search"`), `[data-cl-activity="scm"]` (`aria-label="Source Control"`), and `[data-cl-action="open-settings"]` / `[data-cl-activity="settings"]` (`aria-label="Settings"` / Manage gear at bottom).
   - Primary Sidebar: `aside.codelab-sidebar` (also carrying `.codelab-explorer` or containing `#cl-sidebar-explorer`, `#cl-sidebar-search`, `#cl-sidebar-scm` for backwards compatibility). **Geometry invariant**: `sidebarRect.bottom > drawerRect.top` when both Sidebar and Bottom Panel are open (Sidebar spans full body height down to Status Bar; `#cl-drawer` NEVER renders inside `.codelab-sidebar` and `drawerRect.left >= sidebarRect.right`).
   - Editor Area & Tabs: `.codelab-editor-col` with `#cl-tabs [role="tab"]` for open files and `[data-cl-tab="__settings__"]` when `Settings` is open, plus `#cl-settings-host` inside `.codelab-editor-wrap`.
   - Separate Bottom Panel: `#cl-drawer` (`.codelab-drawer`) inside `.codelab-workbench-main` (right of Sidebar), with `[role="tab"][data-cl-drawertab="problems"]`, `[role="tab"][data-cl-drawertab="terminal"]`, Maximize button `[data-cl-action="maximize-drawer"]`, and Close button `[data-cl-action="close-drawer"]` / `[data-cl-action="toggle-drawer"]`.
   - Status Bar: `.codelab-statusbar` with branch button `[data-cl-action="statusbar-scm"]` and Problems button `[data-cl-action="statusbar-problems"]` displaying error/warning counts.
2. **Backwards-Compatible Imperative Workbench API**:
   - `ide.openSettings()` → opens/focuses the non-destructive `Settings` editor tab (`__settings__`).
   - `ide.showSearchModal()` / `ide.openSearchView()` → opens Primary Sidebar to `search` view and focuses search input (`#cl-search-input`).
   - `ide.showScmModal()` / `ide.openScmView()` → opens Primary Sidebar to `scm` view.
   - `ide.showProblemsModal()` / `ide.openProblemsPanel()` → expands Bottom Panel (`#cl-drawer`) and activates `problems` tab (`#cl-drawer-body`).
   - `ide.switchDrawerTab('terminal')` / `ide.toggleTerminal()` → expands Bottom Panel and activates `terminal` tab (`#cl-terminal-surface`).
3. **Non-Destructive Confirmation & Isolation Contract**:
   - Triggering `Blank IDE` or `Clone Repo` when workspace has user-created/modified files or unsaved edits either opens a confirmation dialog (`[data-cl-modal="workspace-confirm"]` / `#workspace-confirm-modal` with explicit `"New Isolated Workspace"`, `"Replace Current Workspace"`, and `"Cancel"` buttons) or creates a new isolated workspace while preserving the prior workspace in storage (`File → Open Recent Workspace`). Pressing `Escape` or `Cancel` leaves current files, open tabs, and editor buffers 100% untouched.

---

## Code Layout

Strict exclusive write-ownership rules prevent file collisions across tracks and milestones:

| Milestone / Track | Exclusive Write Paths | Forbidden Paths & Port Rules |
|---|---|---|
| **M1 (Platform Services)** | `packages/settings/src/**`<br>`packages/ui/src/**`<br>`src/storage.ts`<br>`src/diagnostics.ts`<br>`src/extensions/python.ts`<br>`src/extensions/cpp.ts`<br>`src/scm.ts`<br>`src/shell.ts`<br>`tests/test-vscode-platform.js` | Must NOT edit `src/workbench.ts`, `src/code-lab.css`, `examples/cloud-ide/**`, or `tests/vscode-e2e/**`. |
| **M2 (Core Workbench UI/UX & Workflows)** | `src/workbench.ts`<br>`src/code-lab.css`<br>`src/workbench/*.ts`<br>`src/search.ts` *(if helper needed)*<br>`apps/web/**`<br>`tools/bundle.js` *(only if new `src/workbench/*` leaf added)*<br>`tests/test-vscode-workbench.js`<br>`tests/run-all.js` & `README.md` *(suite registration & suite-count sync only)*<br>`tests/browser/{workbench-ux,ide-and-sql}.spec.ts` *(only if updating legacy modal assertions to new non-destructive views)*<br>`dist/**` & `examples/cloud-ide/public/dist/**` *(via `bun run build`)* | Must NOT edit `examples/cloud-ide/src/**` (`tools/bundle.js` auto-copies `dist/` to `examples/cloud-ide/public/dist/`) or `tests/vscode-e2e/**`. Uses Playwright port `4173`. |
| **M3 (Cloud IDE Host Shell)** | `examples/cloud-ide/src/**`<br>`examples/cloud-ide/public/**` *(via `astro build` if applicable)*<br>`examples/cloud-ide/package.json`<br>`tests/test-cloud-ide-host.js`<br>`tests/run-all.js` & `README.md` *(suite registration & suite-count sync only)* | Must NOT edit `src/**`, `packages/**`, or `tests/vscode-e2e/**`. Uses Astro dev/preview port `4321`. |
| **E2E Testing Track (`E2E`)** | `/Users/vedgupta/Desktop/code-lab/TEST_INFRA.md`<br>`/Users/vedgupta/Desktop/code-lab/TEST_READY.md`<br>`tests/vscode-e2e/**` | Must NOT edit `src/**`, `packages/**`, `apps/**`, `examples/**`, `tools/**`, `playwright.config.ts`, or existing `tests/test-*.js` / `tests/browser/*.spec.ts`. Must NOT run `bun run build` while M1–M3 are active; uses dedicated test server port `4273` (`4274` for Cloud IDE static preview if needed). |
| **M4 (Final Milestone: Tiers 1–5 & Parity Audit)** | Full repository integration rights (`src/**`, `packages/**`, `apps/**`, `examples/**`, `tests/**`, `package.json`, `playwright.config.ts`) — runs ONLY after M1, M2, M3, and E2E have completed! | Single-track execution (Tiers 1 → 2 → 3 → 4 → Parity Audit → Tier 5). |
