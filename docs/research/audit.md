# Honest Self-Audit of `@innovatorved/code-lab` (`v0.3.2`)

> **Phase 1 Harsh Engineering Review** — Every finding below was verified directly against source files with exact file and line numbers before any code changes were made. Every `P0` and `P1` issue requires a dedicated regression test when fixed.

---

## Summary Scorecard (Baseline `v0.3.2`)

| Severity | Count | Summary |
| :--- | ---: | :--- |
| **P0 (Critical — Crashes, Data Loss, Security Bypass, CVEs)** | **6** | Missing methods crashing Rename/New File (`TypeError`), broken default Python template (`SyntaxError`), broken Cloud IDE / `sample.html` methods, Worker execution dropping VFS writes & partial stdout + main-thread re-run on crash, same-origin SW non-HTML CSP bypass, High/Critical dependency CVEs (`zod`, `astro`, `sharp`, `esbuild`). |
| **P1 (High — Architecture, Leaks, Races, Corruptions)** | **14** | 4 `@ts-nocheck` god files (~30k LOC) + raw uncompiled concatenation + dead shadow modules, Diff editor state loss, Mini HTTP iframe `allow-same-origin` + `monaco-url` script injection, Multi-instance Monaco URI & SW collisions + model/timer/Blob leaks, Keystroke triple-`localStorage` + asymmetric IndexedDB loss, Network filter input self-destruction, `serve` & Pyodide binary corruption + deleted-file resurrection + sticky test failure counter, C++ silent mock regex fallback, Shell heredoc/`[[`/`exit`/`node` pipe & env drops, `curl` external URL failure, `transpileTS` template-literal TS bug, `PTYTerminalEngine.readLine` hang on `Ctrl+C`, Playwright 0% Monaco/SW browser coverage & broken `mock-dom.js` regex. |
| **P2 (Medium — Polish, Bounds, CSS, A11y, Parity)** | **6** | Extension global clobbering & tab-switch lint marker race, SQLite `;`-split & missing transaction rollback, unbounded histories/jobs + $O(m \cdot n)$ diff memory + global `window.*` pollution, `<code-lab>` `lang="py"` & `theme` attribute bugs, CSS light-theme fallbacks & class mismatches, modal focus traps & ARIA keyboard navigation. |

---

## P0 Findings (Must Fix First)

### P0-1 [Correctness] Crash (`TypeError`) on File/Folder Rename & New File/Folder in Context Menu and Command Palette
- **Evidence**:
  - [workbench.ts:6656](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L6656), [workbench.ts:6666-6668](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L6666-L6668), [workbench.ts:7267-7269](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L7267-L7269), and [command-palette.ts:83-95](file:///Users/vedgupta/Desktop/code-lab/src/workbench/command-palette.ts#L83-L95) invoke `this.startInlineCreate(...)` and `this.startInlineRename(...)`.
  - **Neither method exists anywhere on `CodeLabWorkbench`!** Even [bundle.js:1204-1205](file:///Users/vedgupta/Desktop/code-lab/tools/bundle.js#L1204-L1205) declares them in the hand-written `code-lab.d.ts`, while `// @ts-nocheck` hid their absence. Right-clicking any file/folder to rename or create a nested item throws `TypeError: this.startInlineRename is not a function`.
- **Proposed Fix**: Implement `startInlineCreate(type, folderPrefix)` and `startInlineRename(type, targetPath)` (with inline input rendering in `_renderFileLists` committing via `renameFile` / `renameFolder`), remove `@ts-nocheck`, and add unit + Playwright E2E regression tests.

### P0-2 [Correctness] Default Standalone Python Sandbox Crashes Immediately with `SyntaxError`
- **Evidence**:
  - [workbench.ts:1204-1207](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L1204-L1207) defines `DEFAULT_STANDALONE_PYTHON_FILES` using template backticks containing double-escaped `\\n` (`"""\\nStandalone Python 3.12...\\n"""\\nfrom codelab_test...`).
  - This emits literal `\n` characters outside strings into `main.py` and `test.py`, causing Python to fail immediately on Run with `SyntaxError: unexpected character after line continuation character`.
- **Proposed Fix**: Fix `DEFAULT_STANDALONE_PYTHON_FILES` to emit real newlines (`\n`) and add a regression test parsing/executing the default standalone files for every supported language (`js`, `ts`, `cpp`, `py`).

### P0-3 [Correctness] Shipped Examples (`examples/cloud-ide`, `src/sample.html`) & `.d.ts` Call Non-Existent Workbench Methods
- **Evidence**:
  - [examples/cloud-ide/src/pages/index.astro:1036](file:///Users/vedgupta/Desktop/code-lab/examples/cloud-ide/src/pages/index.astro#L1036) calls `ide.exportZip()` (only `exportProjectZip` exists on `CodeLabWorkbench`).
  - [examples/cloud-ide/src/pages/index.astro:1070](file:///Users/vedgupta/Desktop/code-lab/examples/cloud-ide/src/pages/index.astro#L1070) calls `ideInstance.setTheme(next)` (does not exist anywhere in `workbench.ts`).
  - [examples/cloud-ide/src/pages/index.astro:902](file:///Users/vedgupta/Desktop/code-lab/examples/cloud-ide/src/pages/index.astro#L902) & `L971` call `ide.runProject()` (defined on `CodeLabElement`, missing on `CodeLabWorkbench`).
  - [sample.html:296](file:///Users/vedgupta/Desktop/code-lab/src/sample.html#L296) calls `workbench.switchDrawerTab('terminal')` (missing on `CodeLabWorkbench`).
  - [bundle.js:1190-1236](file:///Users/vedgupta/Desktop/code-lab/tools/bundle.js#L1190-L1236) advertises 11 methods in `dist/code-lab.d.ts` that do not exist at runtime (`stopExecution`, `cancelExecution`, `movePath`, `startInlineCreate`, `startInlineRename`, `promptNewFile`, `promptNewFolder`, `switchDrawerTab`, `toggleWebPreview`, `runSelectedCode`, `exportZip`, `importZip`).
- **Proposed Fix**: Implement all advertised public methods consistently across `CodeLabWorkbench` and `CodeLabElement` (`setTheme`, `switchDrawerTab`, `exportZip`, `importZip`, `runProject`, `stopExecution`, `cancelExecution`, `movePath`, `toggleWebPreview`, `runSelectedCode`, `promptNewFile`, `promptNewFolder`), generate `.d.ts` from real TypeScript types, and add API contract tests.

### P0-4 [Correctness / Reliability] `executeInWorker` Drops VFS Mutations, Loses Partial Output on Timeout/Cancel/Error, and Re-Runs Crashed Code on the Main UI Thread
- **Evidence**:
  - [runtime.ts:9725-9747](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9725-L9747): `executeInWorker` sends plain `files` to the Worker; any `fs.writeFileSync` / `unlinkSync` / SQLite writes inside the Worker mutate an ephemeral VFS that is discarded (`fsSnapshot` at `L8786` returns only `{ path, size }` metadata).
  - [runtime.ts:9637-9641](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9637-L9641), [L9659-L9662](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9659-L9662), [L9707-L9711](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9707-L9711): On timeout, cancel, or worker error, `executeInWorker` returns `stdout: ''` and `testResults: []`, discarding all chunks already streamed before termination!
  - [runtime.ts:9717-9723](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9717-L9723): `worker.onerror` calls `resolve(_hostRuntime.executeInVirtualRuntime(options))` — **re-running crashed/OOM user code a second time on the UI main thread**, duplicating side effects and freezing the browser tab!
- **Proposed Fix**: Accumulate streamed `stdout`, `stderr`, and `testResults` on the host side so timeout/cancel/error preserves partial output; return dirty file diffs (`modifiedFiles`, `deletedPaths`) from the Worker and sync them back into `options.vfs`; fail cleanly on `worker.onerror` with structured error reporting instead of re-executing untrusted code on the UI thread (only fall back when `Worker` construction itself is unsupported in headless environments before user code starts).

### P0-5 [Security] Same-Origin Preview Service Worker Serves Non-HTML Responses (`image/svg+xml`, `application/xhtml+xml`) Without Any CSP Header
- **Evidence**:
  - [preview-sw.js:212-216](file:///Users/vedgupta/Desktop/code-lab/src/preview-sw.js#L212-L216) attaches `Content-Security-Policy` and `X-Content-Type-Options: nosniff` **only** when `/text\/html/i.test(contentType) && typeof responseBody === 'string'`.
  - Any virtual server response with `Content-Type: image/svg+xml`, `application/xhtml+xml`, or `text/xml` executes inline `<script>` on the **host origin** with zero CSP! Furthermore, if loaded via the `Referer` fallback ([preview-sw.js:248-254](file:///Users/vedgupta/Desktop/code-lab/src/preview-sw.js#L248-L254)), its URL lacks `/__preview/`, bypassing [preview-sw.js:62](file:///Users/vedgupta/Desktop/code-lab/src/preview-sw.js#L62) and allowing it to overwrite `configuredCsp` via `postMessage({ type: 'codelab:config' })`.
- **Proposed Fix**: Attach `Content-Security-Policy` and `X-Content-Type-Options: nosniff` to **every** response returned by `proxyVirtualRequest` regardless of `Content-Type` or body representation, inject head shims for XHTML/HTML MIME types, and restrict `codelab:config` updates to authenticated workbench client registrations.

### P0-6 [Security] Direct Dependency Vulnerabilities Flagged by `bun audit` (`zod` HIGH, `esbuild` MODERATE, `examples/cloud-ide` `astro` CRITICAL)
- **Evidence**:
  - Root `bun audit`: `zod@3.25.76` (**HIGH**, `GHSA-mrhx-c7xc-m3w5`) and `esbuild@0.24.2` (**MODERATE**, `GHSA-67mh-4wv8-2f99`).
  - `examples/cloud-ide` `bun audit`: 32 vulnerabilities (1 **CRITICAL** `GHSA-26w7-cxv4-gfx2` in `astro@4.16.19`, 8 **HIGH** in `astro`/`sharp`/`vite`/`zod`, 18 **MODERATE**, 5 **LOW**).
  - CI ([ci.yml](file:///Users/vedgupta/Desktop/code-lab/.github/workflows/ci.yml)) currently has no `bun audit` gate.
- **Proposed Fix**: Upgrade `zod`, `esbuild`, `astro`, and transitive dependencies across workspaces so `bun audit` passes with **0 vulnerabilities**, and enforce `bun audit` in CI.

---

## P1 Findings (High Priority — Architecture, Correctness, Security & Performance)

### P1-1 [Architecture] Monolithic `@ts-nocheck` God Files (~30k LOC), Raw Uncompiled String Concatenation & Dead Shadow Modules
- **Evidence**:
  - [workbench.ts:1](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L1) (10,088 LOC), [runtime.ts:1](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L1) (9,805 LOC), [shell.ts:1](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L1) (8,767 LOC), and [terminal.ts:1](file:///Users/vedgupta/Desktop/code-lab/src/terminal.ts#L1) (1,206 LOC) use `// @ts-nocheck` and are concatenated verbatim as raw strings by [bundle.js:43-51](file:///Users/vedgupta/Desktop/code-lab/tools/bundle.js#L43-L51).
  - Public TS signatures actively contradict runtime implementations: [shell.ts:8761](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L8761) swaps `(vfs, cwd)` on `expandGlob` vs `L624`; [runtime.ts:9786-9787](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9786-L9787) declares wrong parameters for `createVirtualHttp` and `createVirtualNet`.
  - 7 of 10 files in `src/workbench/`, [test-harness.ts](file:///Users/vedgupta/Desktop/code-lab/src/runtime/test-harness.ts), and [compilers-cli.ts](file:///Users/vedgupta/Desktop/code-lab/src/shell/coreutils/compilers-cli.ts) are dead/disconnected duplicates, while `tools/bundle.js` embeds `cpp.js` + `python.js` + `guided-lab.js` + `zod` inside a 1.8 MB unminified `dist/code-lab.js`.
- **Proposed Fix**: Refactor into layered workspace packages (`@code-lab/core`, `@code-lab/fs`, `@code-lab/settings`, `@code-lab/commands`, `@code-lab/runtime`, `@code-lab/terminal`, `@code-lab/preview`, `@code-lab/editor`, `@code-lab/ui`, plus `apps/web` and backward-compatible root `@innovatorved/code-lab`), compile all code via `esbuild`/`tsc` with strict TypeScript and enforced layer boundaries, eliminate dead duplicate files, and lazy-load heavy extensions.

### P1-2 [Correctness] Inline Diff Editor Loses Edits on Close/Reload & Desyncs Main Monaco Model
- **Evidence**: [diff-editor.ts:180-186](file:///Users/vedgupta/Desktop/code-lab/src/workbench/diff-editor.ts#L180-L186) calls non-existent `this.workbench._markDirty(file)` and never updates `this.workbench.models.get(file)`, `shell.vfs`, or `_saveState()`. Closing diff reverts the visible editor to pre-diff content.
- **Proposed Fix**: Sync diff edits through `setFile` / model + VFS + persistence pipeline, and resolve diff editor theme via `_resolvedTheme()`.

### P1-3 [Security] Mini HTTP Client Response Iframe Uses `sandbox="allow-same-origin"` & `loadMonaco` Unescaped Worker URL Interpolation
- **Evidence**:
  - [workbench.ts:4487](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L4487) renders `<iframe class="codelab-response-iframe" sandbox="allow-same-origin" srcdoc="...">`, granting same-origin access instead of an opaque sandbox origin.
  - [workbench.ts:982-986](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L982-L986) interpolates `baseUrl` into `importScripts('${baseUrl}/...')` without `JSON.stringify` escaping.
- **Proposed Fix**: Set `sandbox=""` (opaque origin, zero script/same-origin privilege) on `.codelab-response-iframe` and `JSON.stringify` URLs in `getWorkerUrl`.

### P1-4 [Robustness / Leaks] Multi-Instance Collisions (Monaco URIs, SW Dispatch) & Uncleaned Disposables/Timers/Blob URLs
- **Evidence**:
  - [workbench.ts:6337](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L6337) creates Monaco models at `file:///${this.labId}/${filename}` (`labId` defaults to `'custom-lab'`), causing two `<code-lab>` elements on one page to overwrite and dispose each other's models.
  - [workbench.ts:6378-6383](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L6378-L6383) leaks Monaco models when switching languages/resetting; [workbench.ts:9803-9850](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L9803-L9850) (`destroy()`) leaks `_portListenerUnsubs`, toast timers, `navigator.serviceWorker.onmessage`, and worker Blob URLs; [preview-sw.js:143-193](file:///Users/vedgupta/Desktop/code-lab/src/preview-sw.js#L143-L193) always picks `workbenchClients[0]`, hijacks top-level navigations via `Referer` (`L248-254`), and never closes `channel.port1`.
  - [runtime.ts:896](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L896) & `L6368` overwrite global `_activeCwdGetter` across concurrent runs and leak unclosed FDs in shared `vfs.fdTable`.
- **Proposed Fix**: Namespace Monaco URIs and SW dispatches by unique `instanceId`, manage all listeners/timers/models/workers through `DisposableStore`, close `channel.port1`, restrict SW `Referer` fallback to non-navigation subresources, and scope `cwd` + FD cleanup per runtime execution.

### P1-5 [Performance / Persistence] Keystroke Triple-`localStorage` Write, Unordered IndexedDB Race & Asymmetric IndexedDB Reload Loss
- **Evidence**:
  - [workbench.ts:1922-2003](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L1922-L2003) synchronously `JSON.stringify`s the workspace twice to `localStorage` (`sd-codelab-v1:` + legacy `sd_codelab_`) on **every keystroke**, fires unserialized `saveProject()` promises to IndexedDB, and [workbench.ts:1884-1898](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L1884-L1898) (`_loadState`) **never reads back from IndexedDB** (losing any workspace >5 MB on reload!).
  - [workbench.ts:6261-6272](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L6261-L6272) rebuilds breadcrumb DOM & folder lists on every cursor move.
- **Proposed Fix**: Debounce persistence (250ms + immediate flush on `pagehide`/`visibilitychange`/`destroy`), serialize async backend writes, hydrate from IndexedDB/OPFS when newer or larger than `localStorage`, drop redundant legacy writes, and `requestAnimationFrame`-throttle breadcrumb updates.

### P1-6 [Correctness / UX] Network Filter Input Destroys Itself on First Keystroke
- **Evidence**: [workbench.ts:4880-4884](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L4880-L4884) calls `this._renderDrawerBody()` on `#cl-net-search` `input`, replacing `bodyEl.innerHTML` (`L4794`) and destroying the focused input element after 1 character.
- **Proposed Fix**: Re-render only the filtered network rows list while keeping `#cl-net-search` mounted and focused.

### P1-7 [Correctness / Security] Built-In Preview Server (`serve`) Corrupts Binary Assets & Leaves `</script>` Unescaped in Import Maps
- **Evidence**: [shell.ts:3170](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L3170) & [L3398](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L3398) read `.png`/`.jpg`/`.ico`/`.woff2` with `readFileSync(p, 'utf8')`, corrupting all binary bytes with `\uFFFD`; [shell.ts:3142](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L3142) injects `JSON.stringify({ imports })` into `<script type="importmap">` without escaping `</script>`.
- **Proposed Fix**: Serve binary MIME types as raw `Uint8Array` buffers, escape `<` as `\u003c` inside `<script type="importmap">`, and validate JSON module wrappers.

### P1-8 [Correctness] Python Extension Corrupts Binary VFS Files, Resurrects Deleted Files, Latches Failed Test Counts Forever & Fakes `pip`
- **Evidence**: [python.ts:947](file:///Users/vedgupta/Desktop/code-lab/src/extensions/python.ts#L947) & [L1090](file:///Users/vedgupta/Desktop/code-lab/src/extensions/python.ts#L1090) force `'utf8'` on all `/workspace` files; `syncBackPyodideDir` (`L1067`) resurrects files deleted in VFS; `codelab_test.py` (`L141-143`) caches `_FAILED_COUNT` in `sys.modules` across runs so once 1 test fails, all future passing runs exit with code `1`; [shell.ts:6308](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L6308) fakes `Successfully installed` when Python toolchain is absent.
- **Proposed Fix**: Sync raw `Uint8Array` bytes with bidirectional deletion tracking, reset `codelab_test` state and execute in a fresh `__main__` dict per run, deduplicate Pyodide `<script>` injection, and fail honestly when `pip` has no loaded Python toolchain.

### P1-9 [Correctness] C++ Extension Silently Masks Clang Load Errors Behind a Regex `std::cout` Mock Fallback
- **Evidence**: [cpp.ts:876-880](file:///Users/vedgupta/Desktop/code-lab/src/extensions/cpp.ts#L876-L880) & [L943-945](file:///Users/vedgupta/Desktop/code-lab/src/extensions/cpp.ts#L943-L945) catch CDN errors, latch `nativeToolchainUnavailable = true`, and run `_compileVirtualFallback` (`L1109-1211`) which regex-scrapes literals from `std::cout` unless explicitly configured. (Note: existing offline fallback behavior in `e0837b8` is tested by `test-cpp-extension.js`, so we must check exact test expectations and emit an explicit warning/diagnostic + allow retry on transient network failure while preserving documented offline fallback semantics where explicitly requested!).
- **Proposed Fix**: Reset `loadPromise` so transient failures can retry, surface clear compiler warnings/diagnostics when offline virtual fallback is active, and fix brace/comment scanning in fallback mode so strings/comments with `{`/`}` don't trigger false syntax errors.

### P1-10 [Correctness] Shell Drops Heredocs (`<<`), Here-Strings (`<<<`), `[[ ... ]]`, `exit`, `:`, and `node`/`bun`/`python3` `stdin`/`env`/`cwd`
- **Evidence**: [shell.ts:7944-7957](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L7944-L7957) & [L8489-8502](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L8489-L8502) ignore parsed `<<` and `<<<` redirects; `[[` (`L1495`) has no command handler (`127`); `exit` is missing (breaking `npm test` default script at `L6553`); `COREUTILS.node` (`L5991`), `bun` (`L6425`), and `python3` (`L6240`) omit `stdin: ctx.stdin`, `env: ctx.env`, and `cwd: ctx.cwd`.
- **Proposed Fix**: Execute `<<`/`<<-`/`<<<` redirects, implement `[[`, `exit`, and `:`, and forward `stdin`, `env`, and `cwd` into `node`, `bun`, `python3`, and `./binary`.

### P1-11 [Correctness] Shell `curl` and `hey` Fail on All External HTTPS URLs
- **Evidence**: [shell.ts:6805](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L6805) & [L6919](file:///Users/vedgupta/Desktop/code-lab/src/shell.ts#L6919) route all URLs to `portTable.dispatchRequest` instead of checking for loopback hostnames (`localhost` / `127.0.0.1` / `0.0.0.0`), failing external `https://...` calls with local `:443` `ECONNREFUSED`.
- **Proposed Fix**: Route loopback hosts to `portTable.dispatchRequest` and external hosts to `fetchImpl`.

### P1-12 [Correctness] `transpileTS` Corrupts TypeScript Inside Template Literals & Fails on Destructured/Generator Exports
- **Evidence**: [runtime.ts:4691-4705](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L4691-L4705) masks entire `` `...${expr as T}...` `` literals as opaque strings, leaving inner TS syntax unstripped; [runtime.ts:5230-5242](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L5230-L5242) leaves `export const { a, b } = obj` and `export function* gen()` with raw `export` in CJS mode.
- **Proposed Fix**: Recursively transpile `${...}` template expressions and rewrite destructured `export const/let/var` and `export [async] function*` declarations cleanly.

### P1-13 [Robustness] `PTYTerminalEngine.readLine()` Promises Hang Forever on `Ctrl+C` or `destroy()`
- **Evidence**: [terminal.ts:619-631](file:///Users/vedgupta/Desktop/code-lab/src/terminal.ts#L619-L631), [L669-672](file:///Users/vedgupta/Desktop/code-lab/src/terminal.ts#L669-L672), [L750-766](file:///Users/vedgupta/Desktop/code-lab/src/terminal.ts#L750-L766) never drain `_readLineQueue` or clear `promptOverride` on `Ctrl+C` or `destroy()`, leaking promises and swallowing the user's next command.
- **Proposed Fix**: Drain `_readLineQueue` and reset `promptOverride` cleanly on `Ctrl+C`, `AbortSignal`, and `destroy()`.

### P1-14 [DX / Testing] Broken Single-Quote Attribute Regex in `mock-dom.js` & Missing Real-Browser E2E Flows
- **Evidence**: [mock-dom.js:455](file:///Users/vedgupta/Desktop/code-lab/tests/helpers/mock-dom.js#L455) has `/... '([^']*) .../` missing its closing `'`, corrupting single-quoted attributes; Playwright tests lack E2E coverage for Settings UI, `.codelab/settings.json` live reload, Command Palette, Quick Open, file create/rename/save/reload state restoration, and Service Worker preview CSP on non-HTML responses.
- **Proposed Fix**: Fix `mock-dom.js:455` and add comprehensive Playwright real-browser E2E specs covering create/edit/save/rename, code execution, terminal, preview + SW security, settings UI + `.codelab/settings.json` live reload, themes, Command Palette, Quick Open, and full reload persistence.

---

## P2 Findings (Quality, Bounds, CSS & Accessibility)

- **P2-1**: Extension global clobbering (`__codelabCppCompiler` / `__codelabPythonCompiler`) and 180ms lint timer stamping markers onto the wrong Monaco model on rapid tab switch ([cpp.ts:2010](file:///Users/vedgupta/Desktop/code-lab/src/extensions/cpp.ts#L2010), [python.ts:1232](file:///Users/vedgupta/Desktop/code-lab/src/extensions/python.ts#L1232)).
- **P2-2**: `bun:sqlite` naive `sql.split(';')` breaking semicolons in string literals and `db.transaction(fn)` lacking rollback on exception ([runtime.ts:9186-9194](file:///Users/vedgupta/Desktop/code-lab/src/runtime.ts#L9186-L9194)).
- **P2-3**: Unbounded `history` / `jobs` arrays, dead `expandBraces` in `shell.ts:205`, $O(m \cdot n)$ `Int32Array` diff memory spike on large files, and bare global `window.*` pollution in `shell.ts` / `terminal.ts`.
- **P2-4**: `<code-lab>` `lang="py"` & `theme` attribute handling gaps, `.py` new-file JS template bug, missing `CL_ICONS.layout`/`maximize`, and `_toggleMarkdownTask` async VFS call ([workbench.ts:3570, 5858, 9572, 9863](file:///Users/vedgupta/Desktop/code-lab/src/workbench.ts#L9863)).
- **P2-5**: Undefined light-theme CSS variables falling back to dark hexes (`#1e1e1e`, `#252526`) and `.codelab-preview-console__bar` class mismatch ([code-lab.css:5355-5565](file:///Users/vedgupta/Desktop/code-lab/src/code-lab.css#L5355-L5565)).
- **P2-6**: Missing modal `Tab` focus traps, ARIA splitter keyboard controls, large/binary file editor guards, and Monaco TS/JS `onDidChangeMarkers` → `DiagnosticsStore` synchronization.

---

## Feature-by-Feature Gap Matrix vs. VS Code & StackBlitz (Prioritized by Value / Effort)

| Priority | Feature | VS Code / StackBlitz | `code-lab` `v0.3.2` Baseline | Target State in Refactor |
| :---: | :--- | :--- | :--- | :--- |
| **1 (High Value / Med Effort)** | **Layered Configuration & `.codelab/settings.json`** | `defaults → user → .vscode/settings.json` with JSON Schema & live reload | Hardcoded options; no config file or schema | `@code-lab/settings`: `defaults → user → .codelab/settings.json → URL/embed`, JSON Schema autocomplete/diagnostics, live reload + fallback |
| **2 (High Value / Low Effort)** | **Custom Keybindings (`.codelab/keybindings.json`)** | `keybindings.json` with `when` context expressions | Hardcoded `if (e.key === ...)` in `workbench.ts` | `@code-lab/commands`: `KeybindingRegistry` + `ContextKeyService` (`when` evaluator) + live `.codelab/keybindings.json` |
| **3 (High Value / Med Effort)** | **Searchable Settings UI** | Grouped settings editor with Reset & "Open `settings.json`" | Missing | Searchable Settings UI panel/view with category groups, modified indicators, Reset to Default, and 1-click `.codelab/settings.json` toggle |
| **4 (High Value / Low Effort)** | **Token-Based Themes & High-Contrast** | Dark, Light, High-Contrast + JSON custom themes | Dark & Light CSS only (with dark hex leaks in light mode) | Tokenized Theme Service (`dark`, `light`, `high-contrast` built-in + custom JSON theme tokens in settings) |
| **5 (High Value / Low Effort)** | **Workspace Tasks (`.codelab/tasks.json`)** | `tasks.json` / `launch.json` + `runOn: folderOpen` | Hardcoded `entry` / `testEntry` | `.codelab/tasks.json` with JSON Schema, Command Palette task runner, and `runOnOpen` support |
| **6 (High Value / Med Effort)** | **Contribution Points & Plugin Registry** | Unified `contributes` (`commands`, `configuration`, `keybindings`, `views`, `languages`) | Imperative `wb.use(fn)` mutating private fields | Declarative `PluginRegistry` + `ServiceContainer` contribution points + `docs/PLUGINS.md` |
| **7 (High Value / Low Effort)** | **Live Editor Diagnostics in Problems Panel** | All language markers stream into Problems panel | Only C++/Py & runtime errors reach `DiagnosticsStore` | Sync Monaco `onDidChangeMarkers` + JSON config schema diagnostics into `DiagnosticsStore` |
| **8 (Med Value / Low Effort)** | **OPFS Filesystem Backend & Large/Binary File Guard** | OPFS / IndexedDB backends + binary/size guard | IndexedDB/localStorage string map only | `@code-lab/fs` pluggable `MemoryBackend`, `IndexedDbBackend`, and `OpfsBackend` + binary/large-file guard |
| **9 (Med Value / Low Effort)** | **Dev Observability / Service Inspector** | Developer: Toggle Running Extensions / Log Viewer | Console logs only | Built-in Dev Observability command/panel inspecting registered services, event bus activity, settings layers, and worker status |
| **10 (Future Roadmap)** | **Split Editor Groups & Multi-Root Workspaces** | Arbitrary N-way editor grid & `.code-workspace` | Single active code editor + inline diff + split preview | Documented in `docs/ROADMAP.md` (with clean `IEditorService` model/view split ready for multi-group views) |
