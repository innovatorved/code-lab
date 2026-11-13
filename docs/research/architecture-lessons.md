# Architecture Lessons from Mature Editors & Browser IDEs

> **Phase 0 Research Synthesis** — Clean-room study of public architecture documentation, source tree structures, and engineering write-ups across 10 reference editors/IDEs and 5 browser-runtime building blocks. All licensing details are recorded in [licenses.md](file:///Users/vedgupta/Desktop/code-lab/docs/licenses.md). Zero external code is copied.

---

## 1. Reference Editors & IDEs

### 1.1 VS Code (`microsoft/vscode`, MIT)

#### What They Do
1. **Two-Axis Source Layering (`src/vs/`)**:
   - **Vertical Layers (strict one-way DAG)**: `vs/base` (pure data structures, `IDisposable`, `Emitter`, `URI`, `CancellationToken`) → `vs/platform` (cross-cutting service interfaces & DI: `instantiation`, `configuration`, `commands`, `keybinding`, `contextkey`, `files`, `storage`, `log`) → `vs/editor` (standalone-capable text models & editor view) → `vs/workbench` (shell layout, panels, views, workbench services, contributions) → `vs/code` (host entrypoints).
   - **Horizontal Runtime Targets**: Every domain separates `common/` (pure JS/TS, no DOM or Node), `browser/` (DOM/Web APIs), and `worker/` (`DedicatedWorkerGlobalScope`).
   - **Automated Enforcement**: Custom AST lint rules (`code-layering`, `code-import-patterns`) and per-layer `tsconfig` checks fail CI whenever a lower layer imports from a higher layer or `common/` references `window`/`document`.
2. **Service Container & Dependency Injection (`InstantiationService`)**:
   - Services depend on interfaces identified by typed tokens (`createDecorator<IConfigurationService>('configurationService')`), stored in a `ServiceCollection` supporting both eager instances and lazy `SyncDescriptor`s with cycle detection and child-scope overrides (`createChild`).
3. **Disposables & Typed Event Bus (`IDisposable`, `DisposableStore`, `Emitter<T>` / `Event<T>`)**:
   - Every resource (listener, timer, worker, DOM handler, model) returns an `IDisposable` (`{ dispose(): void }`).
   - Classes hold a private `Emitter<T>` and expose only the read-only `Event<T>` (`(listener: (e: T) => void) => IDisposable`), preventing external callers from spoofing `.emit()` and eliminating untyped string event names.
4. **Contribution Points & `ContextKeyService` (`when` Clauses)**:
   - Features self-register into central registries (`ConfigurationRegistry`, `CommandsRegistry`, `KeybindingsRegistry`, `ViewsRegistry`) rather than hardcoding `if/else` branches inside a monolithic workbench class.
   - Keybindings and command availability are guarded by boolean `when` expressions (`editorFocus && !editorReadonly && activeLang == 'ts'`) evaluated against a reactive `ContextKeyService`.
5. **Layered Configuration System**:
   - Settings merge deterministically in precedence order: `defaults` (registered with JSON Schema) → `user` (`localStorage`/IndexedDB profile) → `workspace` (`.vscode/settings.json` in VFS) → `memory/override` (embed/URL options), plus `[language]` overrides.
   - Mutations emit `onDidChangeConfiguration(e)` where `e.affectsConfiguration('editor.fontSize')` lets subscribers react in $O(1)$ without full UI re-renders.
6. **Extension Host Isolation**:
   - Untrusted extensions run in a Web Worker (`WebWorkerExtensionHost`) over a structured RPC channel (`MainThread*` ↔ `ExtHost*`) and activate lazily on `activationEvents` (`onLanguage:python`, `onCommand:...`, `workspaceContains:...`).

#### Why It Works
Strict static layering prevents 10,000-line god classes from forming; `DisposableStore` + `Emitter<T>` makes listener/timer/model leaks structurally obvious; and declarative `Registry` contribution points allow both built-in features and external plugins to extend the IDE through the exact same seam.

#### What Is Realistically Adoptable for `code-lab`
- **Adopt Directly**:
  1. Enforced 4-layer one-way dependency graph (`core` → `platform` → `services` → `workbench/ui`) verified in `bun run lint` / boundary checker in CI.
  2. `IDisposable`, `DisposableStore`, `MutableDisposable`, and typed `Emitter<T>` / `Event<T>` in `@code-lab/core`.
  3. Decorator-free typed `ServiceContainer` (combining VS Code's `ServiceCollection` scoping with Lumino's standard-TS `ServiceId<T>` tokens so we need zero experimental TS decorators or `reflect-metadata`).
  4. Full layered configuration system (`defaults` → `user` → `.codelab/settings.json` workspace → `embed/URL overrides`) with JSON Schema validation, live reload, `affectsConfiguration()`, `.codelab/keybindings.json` with `when`-clause evaluation, and `.codelab/tasks.json`.
  5. Unified `PluginRegistry` / contribution points for commands, settings, keybindings, panels, and file/language handlers.
- **Skip / Defer**: Full VS Code `vscode.*` API binary compatibility (`vscode-uri` + 800-method `vscode.d.ts` RPC surface) is over-engineered for an embeddable 100 KB–scale core; a clean, well-typed `@code-lab` plugin API is far easier to learn and maintain.

---

### 1.2 Monaco Editor (`microsoft/monaco-editor`, MIT) & CodeMirror 6 (`codemirror/dev`, MIT)

#### What They Do
- **Monaco Editor**:
  - Cleanly separates `ITextModel` (URI-identified PieceTree text buffer, undo/redo stack, language ID, and diagnostic `IMarkerData`) from `ICodeEditor` (DOM viewport, cursor/scroll `ICodeEditorViewState`, keybindings).
  - Runs TypeScript/JavaScript/JSON/CSS/HTML semantic analysis inside Web Workers; `monaco.languages.json.jsonDefaults.setDiagnosticsOptions` binds JSON Schemas by `fileMatch` URI glob to provide instant autocomplete, hover docs, and validation squiggles in `.json` files.
  - Gotcha: `monaco.editor` models and themes live in a page-global singleton registry (`monaco.editor.getModel(uri)`, `monaco.editor.setTheme()`). Multiple editor instances on one page collide unless URIs are namespaced per workspace instance!
- **CodeMirror 6**:
  - Functional core (`EditorState` + immutable `Transaction`s + pure `StateField`s) paired with an imperative DOM shell (`EditorView`).
  - Uses `Facet<Input, Output>` for typed extension composition and `Compartment` (`compartment.reconfigure(extension)`) to hot-swap editor settings (tab size, word wrap, read-only, theme, language) in place without losing cursor state or undo history.

#### Why It Works
Separating document models (`ITextModel`) from view widgets (`ICodeEditor`) allows switching tabs, splitting editors side-by-side, and updating markers for background files without mounting hidden DOM editors. Compartment-style live reconfiguration keeps settings reactive without editor remount flicker.

#### What Is Realistically Adoptable for `code-lab`
- **Adopt Directly (`@code-lab/editor`)**:
  - Define a clean, editor-agnostic `IEditorService` / `IEditorAdapter` interface (`openDocument`, `updateOptions`, `setDiagnostics`, `setJsonSchemas`, `formatDocument`, `saveViewState`/`restoreViewState`, `onDidChangeContent`, `onDidChangeCursorPosition`, `dispose`).
  - Provide two swappable implementations out of the box:
    1. `MonacoEditorAdapter` — with **instance-scoped model URIs** (`file:///${instanceId}/workspace/${path}`), full model disposal tracking, `onDidChangeMarkers` → `DiagnosticsStore` synchronization, and live `jsonDefaults` schema registration for `.codelab/settings.json`, `.codelab/keybindings.json`, and `.codelab/tasks.json`.
    2. `LightweightEditorAdapter` — zero-dependency textarea/gutter fallback (and clean seam for swapping CodeMirror 6 in embeddable low-bandwidth environments) honoring the exact same `EditorConfiguration` options (`fontSize`, `fontFamily`, `tabSize`, `wordWrap`, `readOnly`, `lineNumbers`).

---

### 1.3 StackBlitz WebContainers (Proprietary Runtime / MIT SDK) & CodeSandbox Sandpack (`Apache-2.0`)

#### What They Do
- **StackBlitz WebContainers**: Runs a Rust/WASM POSIX syscall layer + Node.js across Web Workers backed by `SharedArrayBuffer` + `Atomics` synchronous VFS I/O and a Service Worker virtual TCP/HTTP relay on an isolated preview origin. Requires top-level `COOP: same-origin` + `COEP: require-corp`/`credentialless` headers, and its core runtime is closed-source proprietary.
- **CodeSandbox Sandpack**: Runs a zero-COOP/COEP in-browser ESM/CJS bundler inside an origin-isolated iframe, syncing files and streaming console logs, runtime error overlays, and navigation events back to the host workbench via structured `postMessage` packets.

#### Why Each Works & Trade-Offs
WebContainers runs unmodified Node CLIs synchronously via `SharedArrayBuffer`, but fails whenever host pages cannot set `COOP`/`COEP` headers (e.g., third-party embeds, blogs, ad/analytics pages) and cannot be open-sourced under MIT. Sandpack embeds anywhere without special headers under Apache-2.0, but lacks a POSIX shell, Node server APIs, C++20 WASI, or Python.

#### What Is Realistically Adoptable for `code-lab`
- **Adopt the Best of Both (Zero-COOP/COEP Required, Optional Progressive Enhancement)**:
  - Keep `code-lab` 100% MIT open-source and **zero-COOP/COEP-required** so `<code-lab>` embeds on any webpage.
  - Fix the host ↔ Worker VFS synchronization gap by transmitting **dirty-file diffs (`modifiedFiles`, `deletedPaths`)** and streaming stdout/stderr/test events cleanly over `postMessage`, while bridging virtual HTTP server ports cleanly.
  - Harden the **Dual-Mode Preview (`@code-lab/preview`)**:
    1. Embedded preview uses `<iframe sandbox="allow-scripts allow-forms allow-modals">` (strictly **no** `allow-same-origin` → opaque origin) with Sandpack-style `postMessage` shims (`console`, runtime error overlay, virtual `fetch` loopback, SPA history sync).
    2. Pop-out Service Worker (`preview-sw.js`) enforces `Content-Security-Policy` + `X-Content-Type-Options: nosniff` on **all** responses (not just string HTML), scopes clients by `instanceId` so multi-tab previews never cross-talk, and closes `MessageChannel` ports deterministically.

---

### 1.4 JupyterLab & Lumino (`BSD-3-Clause`), Eclipse Theia (`EPL-2.0`), Zed (`GPL-3.0`), OpenVSCode Server (`MIT`), Eclipse Che (`EPL-2.0`)

| System | Key Architectural Mechanism | Why It Works | What `code-lab` Adopts (Clean-Room) |
| :--- | :--- | :--- | :--- |
| **JupyterLab / Lumino** | `Token<T>` (`new Token<IService>('id')`) + declarative plugin objects `{ id, requires, optional, provides, activate }` sorted topologically at boot. | 100% standard TypeScript, zero `reflect-metadata`, zero experimental decorators, trivial unit-test mocking, deterministic startup order with cycle detection. | **Core DI & Plugin Activation model** in `@code-lab/core` (`createServiceId<T>`, `ServiceContainer`, `PluginDescriptor`). |
| **Eclipse Theia** | Multi-provider `ContributionProvider<T>` separating contribution contracts (`CommandContribution`, `KeybindingContribution`) from shell rendering. | Shell UI renders whatever is registered; adding a feature never edits shell code. Skip InversifyJS decorator bloat & respect EPL-2.0 (zero copied code). | Typed `ContributionRegistry` in `@code-lab/core` / `@code-lab/commands` / `@code-lab/settings`. |
| **Zed** | Central transactional state ownership + batched notifications; capability-scoped extension manifests. (Strict `GPL-3.0` on editor — conceptual study only.) | Prevents re-entrant state mutation cascades and uncoordinated DOM thrashing on keystrokes. | Batched event notifications (`batch()`) and debounced/serialized persistence queues in VFS & Settings. |
| **OpenVSCode Server** | Pluggable `IFileSystemProvider` backends (`memory`, `indexeddb`, `opfs`) behind a single URI/path VFS interface with `onDidChangeFile` events. | Decouples POSIX VFS semantics from browser storage durability and quota limits. | `@code-lab/fs` pluggable backends (`MemoryBackend`, `IndexedDbBackend`, `OpfsBackend`) with write-through caching. |
| **Eclipse Che** | Declarative workspace task/run manifest (`devfile` commands, auto-run tasks, exposed endpoints). | Makes projects self-configuring on clone/open without manual setup instructions. | `.codelab/tasks.json` schema (`run`, `build`, `test`, `dev` tasks + `runOnOpen` support). |

---

## 2. Browser-Runtime Building Blocks

### 2.1 Web Workers & `MessageChannel`
- **Dedicated Workers** provide hard preemption (`worker.terminate()`) for infinite `while(true)` loops without freezing the browser tab, and work across all desktop and mobile browsers (unlike `SharedWorker` on Android).
- **Critical Lessons Applied**:
  - Never build Worker source via fragile `Function.prototype.toString()` over a 9,500-line `@ts-nocheck` closure; compile modular TypeScript worker code cleanly with `esbuild` at build time.
  - Never silently re-run crashed/OOM worker code on the main UI thread (`worker.onerror` must fail cleanly with a structured `CodeLabError('E_RUNTIME', ...)`).
  - Always track and revoke `URL.createObjectURL(blob)` handles and terminate idle workers when `dispose()` is called.

### 2.2 Service Workers for Virtual Loopback Previews
- Service Workers are terminated by browsers after ~30s of idle time, wiping in-memory variables, and a single SW controls all tabs on an origin.
- **Critical Lessons Applied**:
  - Route preview requests with instance awareness (`/__preview/:instanceId/:port/*` + backward-compatible `/__preview/:port/*`), close `MessageChannel` ports in `finally` blocks, avoid hijacking top-level navigations on unrelated host paths via `Referer`, and attach CSP + `X-Content-Type-Options: nosniff` headers to **every** proxied response (including SVG, XML, JS, and binary buffers).

### 2.3 Virtual Filesystem Persistence: Memory + IndexedDB + OPFS
- **In-Memory Inode Tree**: Required for sub-microsecond synchronous `fs.readFileSync` / `writeFileSync` compatibility in Node/Bun shims and instant file-tree rendering.
- **OPFS (`navigator.storage.getDirectory()`)**: High-throughput native origin-private filesystem in modern Chromium/Firefox/Safari (`17+`), ideal as a high-capacity durable backend.
- **IndexedDB**: Universal asynchronous structured-clone storage fallback when OPFS is unavailable or restricted.
- **Critical Lessons Applied**:
  - `@code-lab/fs` separates synchronous POSIX VFS operations (authoritative in-memory `Uint8Array` inode tree — **never** forcing UTF-8 string conversion on binary files!) from pluggable async persistence adapters (`OpfsStorageBackend` → `IndexedDbStorageBackend` → `LocalStorageBackend` → `MemoryStorageBackend`), serialized through an ordered debounced write queue so concurrent saves can never resolve out of order.

### 2.4 `SharedArrayBuffer` & `COOP`/`COEP` Constraints
- `SharedArrayBuffer` + `Atomics.wait()` enables blocking synchronous `stdin` in Worker threads, **but** requires top-level `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`, which lacks full Safari parity). Requiring `COOP`/`COEP` breaks third-party embeds, external CDNs lacking CORP headers, and static hosts without custom header configuration.
- **Decision for `code-lab`**: Never *require* `SharedArrayBuffer` or `COOP`/`COEP`. Support pre-buffered `stdin` (via the Stdin drawer panel, shell pipelines, heredocs `<<`, and here-strings `<<<`) and interactive async `PTYTerminalEngine.readLine()` everywhere, while allowing `SharedArrayBuffer` ring-buffer `stdin` strictly as an optional progressive enhancement when `globalThis.crossOriginIsolated === true`.

### 2.5 WebAssembly / WASI Runtimes
- WASI Preview 1 (`wasi_snapshot_preview1`) maps cleanly onto `@code-lab/fs` file descriptors (`0: stdin`, `1: stdout`, `2: stderr`, `3: /workspace`), using `WasiExitSignal(code)` to unwind `proc_exit` cleanly.
- Binary safety invariant: All VFS ↔ WASI / Pyodide / Preview transfers must preserve raw `Uint8Array` bytes rather than round-tripping through UTF-8 strings.
