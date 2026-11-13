# Open-Source Licenses & Clean-Room Attribution

`@innovatorved/code-lab` is licensed under the **MIT License** ([LICENSE](file:///Users/vedgupta/Desktop/code-lab/LICENSE)).

## 1. Clean-Room Architectural Research Policy

During architectural design and refactoring (see [architecture-lessons.md](file:///Users/vedgupta/Desktop/code-lab/docs/research/architecture-lessons.md)), public documentation, architecture blog posts, and repository layouts of mature editors and cloud IDEs were studied to learn industry-standard patterns.

**Strict Clean-Room Rules:**
1. **Zero Copied Source Code:** No source code was copied or translated from any external editor or runtime repository. Every module in `@innovatorved/code-lab` and `@code-lab/*` is an original clean-room TypeScript implementation.
2. **Permissive Dependency Policy:** Direct runtime and build dependencies must use permissive SPDX licenses (`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`).
3. **Optional CDN / WebAssembly Runtime Assets:** Optional language extensions (`@code-lab/ext-cpp` / `@innovatorved/code-lab/extensions/cpp` and `@code-lab/ext-python` / `@innovatorved/code-lab/extensions/python`) load unmodified WebAssembly toolchains on demand in the user's browser from public CDNs (or user-configured self-hosted URLs). Their upstream licenses are documented in Section 3.
4. **Forbidden Licenses:** Dependencies or copied code under strong copyleft (`GPL-*`, `AGPL-*`, `SSPL`) or closed-source proprietary terms (`@webcontainer/api` runtime) are strictly prohibited.

---

## 2. Direct Repository Dependencies

| Package | Role | SPDX License | Repository |
| :--- | :--- | :--- | :--- |
| `zod` | Runtime schema validation (`@innovatorved/code-lab/schemas`, `@code-lab/settings`) | `MIT` | `https://github.com/colinhacks/zod` |
| `typescript` | Dev/Build — TypeScript compiler & AST boundary/lint checks | `Apache-2.0` | `https://github.com/microsoft/TypeScript` |
| `esbuild` | Dev/Build — Fast bundler & minifier | `MIT` | `https://github.com/evanw/esbuild` |
| `@playwright/test` | Dev/Test — Real Chromium/Firefox/WebKit E2E browser testing | `Apache-2.0` | `https://github.com/microsoft/playwright` |
| `@types/node` | Dev/Build — Node.js TypeScript definitions for build/test scripts | `MIT` | `https://github.com/DefinitelyTyped/DefinitelyTyped` |
| `astro` | Example App (`apps/web` / `examples/cloud-ide`) — Static site builder | `MIT` | `https://github.com/withastro/astro` |

---

## 3. Optional Runtime CDN Assets (Loaded On-Demand in Browser)

These assets are **not bundled** inside `@innovatorved/code-lab` or `@code-lab/*` npm packages; they are fetched dynamically at runtime when enabled or configured by the host application:

| Asset | Loaded By | SPDX License | Upstream & Attribution Notes |
| :--- | :--- | :--- | :--- |
| **Monaco Editor** (`monaco-editor`) | `@code-lab/editor` / Workbench | `MIT` | Copyright (c) Microsoft Corporation (`https://github.com/microsoft/monaco-editor`). Loaded via configurable `monacoUrl` or host-provided `window.monaco`. |
| **Pyodide + CPython 3.12 Wasm** | `@innovatorved/code-lab/extensions/python` | `MPL-2.0` & `PSF-2.0` | Pyodide (`https://github.com/pyodide/pyodide`, MPL-2.0) bundling CPython (`https://github.com/python/cpython`, PSF-2.0). Loaded unmodified from CDN when the optional Python extension is activated. MPL-2.0 is file-level weak copyleft and permits loading unmodified distributions alongside MIT applications. |
| **YoWASP Clang / LLVM + WASI Sysroot** | `@innovatorved/code-lab/extensions/cpp` | `ISC` / `Apache-2.0 WITH LLVM-exception` / `MIT` | `@yowasp/clang` (`https://github.com/yowasp/clang`, ISC packaging) bundling LLVM/Clang/LLD (`Apache-2.0 WITH LLVM-exception`) and `wasi-libc` (`Apache-2.0 WITH LLVM-exception` / `MIT` / `BSD-2-Clause`). Compiled user outputs carry zero LLVM license obligations. |

---

## 4. Architectural Reference Systems (Ideas & Patterns Only — Zero Code Copied)

| Project | Upstream | SPDX License | Borrowed Architectural Concepts (Clean-Room) |
| :--- | :--- | :--- | :--- |
| **VS Code (`Code - OSS`)** | `microsoft/vscode` | `MIT` | Strictly layered DAG (`core` -> `platform` -> `services` -> `workbench`), `IDisposable` / `DisposableStore`, typed `Emitter<T>` / `Event<T>`, `ContextKey` `when`-clause expressions, layered `ConfigurationRegistry` (`default` -> `user` -> `workspace` -> `override`) with JSON Schema diagnostics, and `ContributionRegistry` (`commands`, `keybindings`, `settings`, `views`, `languages`). |
| **Monaco Editor** | `microsoft/monaco-editor` | `MIT` | Separation of `ITextModel` (URI-addressed text buffer + markers) from editor view instances, per-instance URI namespacing, and `jsonDefaults.setDiagnosticsOptions` schema binding for `.codelab/*.json`. |
| **CodeMirror 6** | `codemirror/dev` | `MIT` | State vs. view separation and live compartment-style dynamic editor reconfiguration (applying font, tabSize, wordWrap, minimap, and theme diffs without destroying undo history or cursor state). |
| **JupyterLab & Lumino** | `jupyterlab/jupyterlab`, `jupyterlab/lumino` | `BSD-3-Clause` | Decorator-free `ServiceId<T>` (`Token<T>`) dependency injection and declarative plugin activation (`{ id, requires, optional, activate }`) without `reflect-metadata`. |
| **JupyterLite** | `jupyterlite/jupyterlite` | `BSD-3-Clause` | Zero-backend browser kernel & storage architecture using Web Workers + IndexedDB/OPFS persistence. |
| **CodeSandbox Sandpack** | `codesandbox/sandpack` | `Apache-2.0` | COOP/COEP-free preview iframe `postMessage` bridge (console forwarding, runtime error overlay, opaque-origin sandbox isolation). |
| **OpenVSCode Server** | `gitpod-io/openvscode-server` | `MIT` | Pluggable async/sync `IFileSystemBackend` seam (`memory`, `indexeddb`, `opfs`) behind a unified workspace VFS contract. |
| **Eclipse Theia** | `eclipse-theia/theia` | `EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0` | Studied strictly as literature for multi-contribution registries. **Zero code copied.** |
| **Eclipse Che** | `eclipse-che/che` | `EPL-2.0` | Studied strictly as literature for declarative workspace task/run configuration (`.codelab/tasks.json`). **Zero code copied.** |
| **Zed** | `zed-industries/zed` | `GPL-3.0-or-later` (`gpui`: `Apache-2.0`) | Studied strictly from public engineering blog posts on transactional state updates and capability-scoped extensions. **Zero code copied or translated.** |
| **StackBlitz WebContainers** | `stackblitz/core` | Proprietary (`@webcontainer/api` wrappers `MIT`) | Studied strictly from public blog posts on virtual localhost Service Worker routing and `SharedArrayBuffer` trade-offs. **`@webcontainer/api` is NOT used.** |
