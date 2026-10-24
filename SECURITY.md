# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| `0.2.x` | :white_check_mark: |
| `< 0.2` | :x: |

## Threat Model & Sandbox Boundaries

`@innovatorved/code-lab` executes user-supplied JavaScript, TypeScript, C++20 (WebAssembly / WASI Preview 1), POSIX shell pipelines, and HTML/CSS/ESM web previews **entirely inside the visitor's browser**. There is no backend execution server.

### 1. Code Execution (`src/runtime.ts`)
- **Web Worker Isolation**: `executeInWorker()` runs untrusted code inside a dedicated `Blob`-backed Web Worker with no direct reference to the host `window` or `document`. Infinite loops and hung timers are preempted via `worker.terminate()` when `timeoutMs` expires.
- **Main-Thread Fallback**: `executeInVirtualRuntime()` executes inside a shadowed `new Function(...)` scope on the caller's thread. Host applications running untrusted multi-tenant code should prefer `executeInWorker()` so infinite loops cannot block the UI thread.

### 2. Web Preview (`src/workbench.ts`, `src/csp.ts`, `src/preview-sw.ts`)
- **Iframe Sandbox**: The embedded Web Preview iframe renders with `sandbox="allow-scripts allow-forms allow-modals"`, which strips `allow-same-origin` and assigns the preview document a unique opaque origin (`null`). Scripts inside the iframe cannot read host cookies, `localStorage`, or IndexedDB.
- **Pop-Out Service Worker Scope (`/__preview/:port/*`)**: When a user pops out a preview into a dedicated browser tab via `preview-sw.js`, the Service Worker serves virtual server responses under `/__preview/:port/*` on the registering origin unless hosted on a dedicated preview subdomain.
  - **Production Recommendation**: If your deployment hosts authenticated user sessions on the main origin and allows rendering untrusted third-party repositories in popped-out tabs, serve `preview-sw.js` from a dedicated sandbox origin (e.g., `*.preview.example.com`) so popped-out previews do not share an origin with authenticated cookies.
- **Content Security Policy (`previewCsp`)**: Every HTML response served to the embedded iframe or via `preview-sw.js` receives a `Content-Security-Policy` (`<meta http-equiv="Content-Security-Policy">` in `srcdoc` and a response header in `preview-sw.js`) built by `src/csp.ts`:
  - `'balanced'` *(default)*: Allows inline scripts/styles and ESM CDNs (`https://cdn.jsdelivr.net`, `https://esm.sh`, `https://unpkg.com`, `blob:`, `data:`), while locking `object-src 'none'`, `base-uri 'none'`, and `form-action 'self'`.
  - `'strict'`: Removes `'unsafe-inline'`, `'unsafe-eval'`, and wildcard network origins (`connect-src 'self'`, `script-src 'self' blob: https://cdn.jsdelivr.net`).
  - `'permissive'`: Legacy compatibility mode (`script-src * 'unsafe-inline' 'unsafe-eval' blob: data:`, `connect-src * blob: data:`).
  - Custom string: Pass a raw CSP directive string via `previewCsp` in `CodeLab.mount(el, { previewCsp })` or `<code-lab preview-csp="strict">`.
- **CSP Violation Diagnostics**: When a preview resource is blocked by CSP, the preview bridge posts a `codelab-preview-csp` message to the workbench, which emits a structured `csp-violation` event (`lab.on('csp-violation', ({ blockedURI, violatedDirective, effectiveDirective }) => ...)`).

### 3. Markdown & Terminal Rendering (`src/workbench.ts`, `src/html.ts`, `src/terminal.ts`)
- Markdown rendered in the Guide tab, hints, and `.md` previews is HTML-escaped before inline token expansion, restricts links and images to `http://`, `https://`, `mailto:`, `#`, and relative paths (blocking `javascript:`, `data:`, and `vbscript:` schemes, including URLs with balanced parentheses), and strips event-handler attributes.
- Internal DOM builders use the strict `html` tagged template (`src/html.ts`) and `escapeHtml` so untrusted values are escaped by default unless explicitly wrapped in `raw(...)`.

## Reporting a Vulnerability

Please report security vulnerabilities privately via [GitHub Security Advisories](https://github.com/innovatorved/code-lab/security/advisories/new) rather than opening a public issue. Include:

1. Affected version and component (`runtime`, `shell`, `workbench`, `preview-sw`, `csp`, or `markdown`).
2. Minimal reproduction steps or proof-of-concept payload.
3. Expected vs. actual security boundary behavior.

We aim to acknowledge reports within 48 hours and publish a fix and advisory once verified.
