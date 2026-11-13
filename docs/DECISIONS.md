# Architectural Decisions Record (`DECISIONS.md`)

> Every non-trivial architectural, tooling, or design trade-off made during the transformation of `innovatorved/code-lab` into a modular open-source IDE core is recorded here with **Context**, **Decision**, **Why**, and **Alternatives Rejected**.

---

## ADR-001: Bun Workspaces Monorepo + Preserving Root `@innovatorved/code-lab` SDK Exports

- **Context**: Phase 2 calls for splitting the codebase into layered workspace packages (`@code-lab/core`, `@code-lab/fs`, `@code-lab/runtime`, `@code-lab/editor`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/settings`, `@code-lab/commands`, `@code-lab/ui`, plus `apps/web`). Meanwhile, the repository already specifies `"packageManager": "bun@1.4.3"`, uses `bun.lock` in CI across Ubuntu + Node 20/22/24, `pnpm` is not installed in the local environment, and 43 existing test suites verify the published `@innovatorved/code-lab` package and its `dist/*` subpath exports (`./runtime`, `./shell`, `./terminal`, `./extensions/*`, `./schemas`, `./css`, `./preview-sw.js`).
- **Decision**:
  1. Use **Bun Workspaces** (`"workspaces": ["packages/*", "apps/*"]` in root `package.json`) with a deterministic topological build/check runner rather than introducing `pnpm` or `turborepo`.
  2. Keep the root package `@innovatorved/code-lab` as the backward-compatible published umbrella SDK & Web Component bundle composing the `@code-lab/*` workspace packages, while moving/mirroring the standalone web application into `apps/web` (preserving `examples/cloud-ide/public/dist` compatibility for existing CI hash/untracked-dist checks).
- **Why**:
  - Zero new global toolchain requirement (`bun install --frozen-lockfile` continues to work natively in CI and locally).
  - Satisfies the Strangler Pattern & "don't delete features without a replacement": all existing consumers (`import CodeLab from '@innovatorved/code-lab'`, `<code-lab>`, CDN script tags) and all 43 existing test suites continue passing without regression, while contributors and embedders gain clean, small, strictly typed `@code-lab/*` modular packages.
- **Alternatives Rejected**:
  - *Switching to `pnpm` + `turborepo`*: `pnpm` is not installed in the dev environment, would invalidate `bun.lock` and CI's `oven-sh/setup-bun` workflow, and adds unnecessary binary overhead when Bun natively supports workspaces.
  - *Breaking root `@innovatorved/code-lab` exports*: Would break existing users, CDN links, and `tests/test-all-builds.js` / `tests/test-esm-exports.js` / `tests/test-version-sync.js`.

---

## ADR-002: 4-Layer One-Way Dependency Graph Enforced by Static AST Linter

- **Context**: Without static enforcement, UI helpers, storage adapters, and runtime internals inevitably import each other, creating circular dependencies and DOM leaks in headless/worker packages.
- **Decision**: Enforce a strict 4-layer DAG across packages and modules via an automated TypeScript AST boundary & cycle checker (`tools/check-boundaries.js`, invoked by `bun run lint` and `bun run check:boundaries` in CI):
  1. **Layer 0 — `core` (`@code-lab/core`)**: Pure TypeScript primitives — `IDisposable`, `DisposableStore`, `Emitter<T>`/`Event<T>`, `ServiceContainer` (`createServiceId<T>`), `CodeLabError`/`Logger`, `SafeHtml`, `ContributionRegistry`, URI/path/glob helpers. **Zero DOM, zero browser storage, zero upward imports.**
  2. **Layer 1 — `platform` (`@code-lab/fs`, `@code-lab/settings`, `@code-lab/commands`)**: Pluggable filesystem backends (`MemoryBackend`, `IndexedDbBackend`, `OpfsBackend`) + POSIX VFS contract, layered configuration & JSON Schema validator, command registry + `when`-clause `ContextKeyService` + keybinding resolver. May import **Layer 0 (`core`)** only.
  3. **Layer 2 — `services` (`@code-lab/runtime`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/editor`)**: Execution sandbox/worker host & POSIX shell service, PTY terminal engine, preview CSP/SW/iframe coordinator, and swappable editor service (`MonacoEditorAdapter` + `LightweightEditorAdapter`). May import **Layer 0–1** only.
  4. **Layer 3 — `workbench` (`@code-lab/ui`, root `@innovatorved/code-lab`, `apps/web`)**: Visual workbench components (Settings UI, Command Palette, Quick Open, Theme Manager, Activity/Drawer panels, Dev Observability Inspector) and host web shell. May import **Layer 0–2**.
- **Why**: Using TypeScript's own compiler AST (already in `devDependencies`) gives zero-CVE, sub-100ms verification of: (a) layer ordering, (b) package public-API boundary (`@code-lab/pkg` imports only via `index.ts`, never deep internal paths), (c) zero circular imports (Tarjan SCC detection), and (d) zero DOM globals inside `core`.
- **Alternatives Rejected**:
  - *`dependency-cruiser` npm package*: Pulls ~60 transitive packages into `node_modules` (expanding attack surface for `bun audit`) to do an AST graph traversal we can write cleanly in ~180 lines using the `typescript` compiler API with unit tests covering violation cases.

---

## ADR-003: Decorator-Free `ServiceId<T>` Dependency Injection + `DisposableStore`

- **Context**: Phase 2 requires a service container / DI system so every service depends on interfaces rather than concrete implementations and can be mocked cleanly in unit tests.
- **Decision**: Adopt a JupyterLab/Lumino + VS Code hybrid: `createServiceId<T>(id)` tokens registered in a hierarchical `ServiceContainer` (`registerSingleton`, `registerInstance`, `get`, `tryGet`, `createChild`, `dispose`) with deterministic cycle detection, paired with `IDisposable` / `DisposableStore` and private `Emitter<T>` / public `Event<T>`.
- **Why**: Works in 100% strict standard TypeScript (`strict: true`, `noImplicitAny: true`) across `esbuild`, `tsc`, Bun, and Node 20–24 without `experimentalDecorators`, `emitDecoratorMetadata`, or `reflect-metadata`. Mocking any service in a unit test is a 1-line `container.registerInstance(IFileSystemService, mockFs)`.
- **Alternatives Rejected**:
  - *InversifyJS / `reflect-metadata`*: Adds runtime bundle weight, requires legacy TS compiler flags (`emitDecoratorMetadata`), and complicates tree-shaking.
  - *Module-level singletons*: Causes cross-instance state pollution when multiple `<code-lab>` elements are mounted on a single page (audit finding `P1-4`).

---

## ADR-004: Layered Configuration System & `.codelab/*` Workspace Files

- **Context**: Phase 3 requires a VS Code-inspired configuration system with clear precedence, editable `.codelab/` workspace files, JSON Schema autocomplete/validation, live reload, invalid-value diagnostics with safe fallback, themes, and a searchable Settings UI.
- **Decision**:
  1. **Precedence Order (lowest → highest)**:
     `defaults` (contributed via `SettingsRegistry` with JSON Schema) → `user` (persisted in browser user profile storage) → `workspace` (`.codelab/settings.json` inside VFS) → `override` (URL query/hash & programmatic embed options).
  2. **Workspace Config Files**:
     - `.codelab/settings.json` — Editor, Workbench/Theme, Files/Autosave, Terminal, Preview, and Runtime settings (supports JSON with Comments `JSONC` so developer comments don't break parsing!).
     - `.codelab/keybindings.json` — Array of `{ key, command, when?, args? }` bindings overriding or unbinding (`-command`) default shortcuts.
     - `.codelab/tasks.json` — `{ version: "1.0", tasks: [{ id, label, command, group?: "run"|"build"|"test"|"dev", runOn?: "folderOpen"|"manual", env?, cwd? }] }`.
     - `.codelab/extensions.json` — `{ recommendations: string[], autoActivate?: string[] }`.
  3. **Validation & Resilience**: Validate every setting value against its registered JSON Schema descriptor (built-in lightweight validator in `@code-lab/settings` so core bundles stay small without requiring `ajv`). Invalid properties emit structured `DiagnosticItem`s into `DiagnosticsStore` (appearing immediately in the **Problems** panel and Monaco JSON squiggles) while automatically falling back that specific key to the next valid lower layer (`user` or `default`)!
- **Why**: Matches VS Code's exact mental model, keeps `.codelab/*.json` human-friendly with JSONC comments, never crashes or bricks the editor on a typo in `settings.json`, and keeps the runtime zero-bloat.
- **Alternatives Rejected**:
  - *Bundling `ajv`*: `ajv` uses `new Function` codegen (blocked under strict host CSPs) and adds ~120 KB; a clean recursive JSON Schema Draft-07 subset validator in `@code-lab/settings` is <4 KB, CSP-safe, and 100% strict TypeScript.

---

## ADR-005: Incremental Strangler Refactor Strategy for Monolithic Core Files

- **Context**: `src/workbench.ts` (10,088 LOC), `src/runtime.ts` (9,805 LOC), and `src/shell.ts` (8,767 LOC) have extensive behavioral surface covered by 43 existing suites (including `test-version-sync.js`, which checks exact coreutils/builtin counts and version sentinels). Rewriting 30,000 lines from scratch in one big bang risks subtle regressions.
- **Decision**: Execute the refactor incrementally via the **Strangler Fig Pattern**:
  1. **Milestone 1**: Fix all 6 `P0` issues (including dependency CVEs) + high-risk `P1` correctness/security bugs first, with dedicated regression tests, keeping all 43 suites green.
  2. **Milestone 2**: Stand up the Bun workspace packages (`@code-lab/core`, `@code-lab/fs`, `@code-lab/settings`, `@code-lab/commands`, `@code-lab/editor`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/runtime`, `@code-lab/ui`, plus `apps/web`), all written under `strict: true` TypeScript with 100% enforced layer boundaries and zero circular imports.
  3. **Milestone 3**: Wire the Workbench, Runtime, Shell, Terminal, and Preview layers to consume the `@code-lab/*` services via `ServiceContainer` & `DisposableStore`, delete disconnected shadow duplicates, integrate Phase 3 Settings UI / `.codelab/*.json` live reload / Themes / Command Palette / Quick Open / Tasks / Plugin Contributions / Dev Observability panel, and minify production browser bundles while keeping source maps / clean ESM exports.
  4. **Milestone 4**: Expand unit, integration, and real-browser Playwright E2E coverage, enforce bundle-size budgets + `bun audit` + boundary checks in CI, and complete all open-source documentation.
- **Why**: Guarantees a green build after every commit, zero lost capabilities, full backward compatibility for `@innovatorved/code-lab` consumers, and genuinely clean, small, strictly typed `@code-lab/*` modular packages.
- **Alternatives Rejected**:
  - *Big-bang rewrite discarding existing runtime/shell*: Would risk breaking dozens of POSIX coreutils, Node/Bun built-ins, WASI, or Guided Lab contracts tested by the 43 suites.

---

## ADR-006: Zero-COOP/COEP Default Execution + Hardened Same-Origin SW Preview

- **Context**: Requiring `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` breaks `<code-lab>` embeds on blogs, documentation sites, and third-party pages. Meanwhile, popped-out previews served via `preview-sw.js` share the host origin.
- **Decision**:
  - Keep `code-lab` zero-COOP/COEP-required across all features.
  - Enforce `Content-Security-Policy` + `X-Content-Type-Options: nosniff` on **every** response proxied by `preview-sw.js` (regardless of `Content-Type` or binary `ArrayBuffer`/`Uint8Array` body), scope SW client routing by workbench `instanceId`, close `MessageChannel` ports deterministically, and keep embedded previews strictly in `sandbox="allow-scripts allow-forms allow-modals"` (**never** `allow-same-origin`).
- **Why**: Preserves universal embeddability while closing the SVG/XHTML/binary CSP bypass (`P0-5`) and multi-tab SW cross-talk (`P1-4`).
- **Alternatives Rejected**:
  - *Requiring `SharedArrayBuffer` / `COOP`+`COEP`*: Breaks embeddability on static hosts and third-party sites.
