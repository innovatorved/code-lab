/**
 * @innovatorved/code-lab — Web Preview Content-Security-Policy builder
 * ============================================================================
 * One place that knows how a preview policy is assembled. Before this module
 * existed the policy was copy-pasted into `preview-sw.js` and `workbench.ts`
 * under a "keep both copies in sync" comment — the classic drift bug.
 *
 * Why the host origin appears literally instead of `'self'`:
 * previews are served in a sandboxed iframe (`allow-scripts`, deliberately
 * *without* `allow-same-origin`). A sandboxed document has an opaque origin, so
 * `'self'` matches no URL at all and the app's own `/__preview/<port>/app.js`
 * would be blocked. Naming the host origin keeps the app's assets loadable
 * while the sandbox keeps it away from host DOM and storage.
 *
 * Bundled as a classic script (`globalName: CodeLabCsp`) so the Service Worker
 * and the workbench can both consume it without a module loader.
 */

export type PreviewCspMode = 'strict' | 'balanced' | 'custom';

/** Per-directive network allowlist. Values are origins or CSP source keywords. */
export interface PreviewCspSources {
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
  frameSrc?: string[];
}

export interface PreviewCspConfig extends PreviewCspSources {
  mode?: PreviewCspMode | string;
}

export interface PreviewCspOptions extends PreviewCspConfig {
  /** Origin that serves `/__preview/*` (the host page). Falls back to `'self'`. */
  hostOrigin?: string;
  /** Value for `frame-ancestors`; defaults to `'self'`. */
  frameAncestors?: string;
}

export interface NormalizedPreviewCsp {
  mode: PreviewCspMode;
  allow: PreviewCspSources;
}

/** CDNs the built-in preview server itself resolves bare imports to. */
const IMPORT_MAP_CDNS = ['https://cdn.jsdelivr.net', 'https://esm.sh'];

/** Fonts commonly referenced by CDN-hosted CSS. */
const FONT_CDNS = ['https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'];

const PRESETS: Record<'strict' | 'balanced', PreviewCspSources> = {
  strict: {},
  balanced: {
    scriptSrc: IMPORT_MAP_CDNS.slice(),
    styleSrc: ['https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
    fontSrc: FONT_CDNS.slice(),
    connectSrc: IMPORT_MAP_CDNS.slice(),
    imgSrc: ['https://cdn.jsdelivr.net']
  }
};

const SOURCE_KEYS: Array<keyof PreviewCspSources> = [
  'scriptSrc',
  'styleSrc',
  'imgSrc',
  'fontSrc',
  'connectSrc',
  'mediaSrc',
  'workerSrc',
  'frameSrc'
];

const MAX_SOURCES = 64;
const MAX_SOURCE_LENGTH = 512;

/** HTML marker so the shim block is injected exactly once. */
export const PREVIEW_SHIM_MARKER = 'data-codelab-preview-shims';

/** Accepts `"https://a.example"` and returns its origin; `null` otherwise. */
export function normalizeOrigin(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    const parsed = new URL(String(raw));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch (_) {
    // Not an absolute URL (e.g. "preview.example.com" or a relative path).
    return null;
  }
}

function normalizeMode(raw: unknown): PreviewCspMode {
  if (raw === 'strict' || raw === 'custom') return raw;
  return 'balanced';
}

/**
 * CSP source keywords an author may name explicitly. Everything else has to be
 * a concrete http(s) URL, `data:` or `blob:`.
 */
const ALLOWED_KEYWORDS: ReadonlyArray<string> = [
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'wasm-unsafe-eval'",
  "'strict-dynamic'",
  "'unsafe-hashes'"
];

/**
 * `*`, `https:` and friends would silently disable the allowlist, and a `;`
 * would inject an extra directive. Only concrete sources survive.
 */
const SOURCE_PATTERN = /^(?:https?:\/\/[A-Za-z0-9._~%-]+(?::\d{1,5})?(?:\/[^\s;,'"]*)?|data:|blob:|filesystem:)$/;

function isSafeSource(source: string): boolean {
  return ALLOWED_KEYWORDS.indexOf(source) !== -1 || SOURCE_PATTERN.test(source);
}

function cleanSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const value of raw.slice(0, MAX_SOURCES)) {
    if (typeof value !== 'string') continue;
    const source = value.trim();
    if (!source || source.length > MAX_SOURCE_LENGTH) continue;
    if (!isSafeSource(source)) continue;
    if (out.indexOf(source) === -1) out.push(source);
  }
  return out;
}

function unique(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const value of list) {
      if (value && out.indexOf(value) === -1) out.push(value);
    }
  }
  return out;
}

/**
 * Validate an author-supplied `previewCsp` option. Unknown modes fall back to
 * `balanced`; invalid source entries are dropped rather than shipped.
 */
export function normalizePreviewCspConfig(raw: unknown): NormalizedPreviewCsp {
  if (typeof raw === 'string') return { mode: normalizeMode(raw), allow: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { mode: 'balanced', allow: {} };
  }
  const input = raw as PreviewCspConfig;
  // Accept both the author-facing shape (`{ mode, scriptSrc }`) and the
  // normalized shape (`{ mode, allow: { scriptSrc } }`) so callers can pass a
  // stored `previewCsp` value straight back in.
  const nested = (input as { allow?: unknown }).allow;
  const sources = (nested && typeof nested === 'object' && !Array.isArray(nested))
    ? nested as PreviewCspSources
    : input;
  const allow: PreviewCspSources = {};
  for (const key of SOURCE_KEYS) {
    const list = cleanSources(sources[key]);
    if (list.length) allow[key] = list;
  }
  return { mode: normalizeMode(input.mode), allow };
}

function sourcesFor(mode: PreviewCspMode, allow: PreviewCspSources, key: keyof PreviewCspSources): string[] {
  const preset = mode === 'custom' ? {} : PRESETS[mode];
  // Clean here too: buildPreviewPolicy is public and must not splice unvalidated
  // strings into the policy even when the caller skipped normalization.
  return unique(preset[key], cleanSources(allow[key]));
}

/**
 * Build the policy string for one preview document.
 *
 * `unsafe-inline`/`unsafe-eval` stay enabled on purpose: previews are arbitrary
 * user code and inline import maps are part of how they run. Isolation comes
 * from the iframe sandbox (opaque origin), not from the CSP.
 */
export function buildPreviewPolicy(options: PreviewCspOptions = {}): string {
  const mode = normalizeMode(options.mode);
  const allow = options as PreviewCspSources;
  const host = normalizeOrigin(options.hostOrigin);
  // A `file://` preview has no usable origin; `'self'` is the least surprising
  // fallback and simply blocks remote assets.
  const self = host || "'self'";

  const directive = (name: string, parts: string[]): string => `${name} ${unique(parts).join(' ')}`;

  const script = (): string[] => [self, 'blob:', "'unsafe-inline'", "'unsafe-eval'"].concat(sourcesFor(mode, allow, 'scriptSrc'));
  const style = (): string[] => [self, "'unsafe-inline'"].concat(sourcesFor(mode, allow, 'styleSrc'));
  const withData = (key: keyof PreviewCspSources): string[] => [self, 'data:', 'blob:'].concat(sourcesFor(mode, allow, key));

  return [
    directive('default-src', [self, 'data:', 'blob:']),
    directive('base-uri', [self]),
    "object-src 'none'",
    directive('script-src', script()),
    directive('style-src', style()),
    directive('img-src', withData('imgSrc')),
    directive('font-src', [self, 'data:'].concat(sourcesFor(mode, allow, 'fontSrc'))),
    directive('connect-src', withData('connectSrc')),
    directive('media-src', withData('mediaSrc')),
    directive('worker-src', [self, 'blob:'].concat(sourcesFor(mode, allow, 'workerSrc'))),
    directive('frame-src', withData('frameSrc')),
    directive('form-action', [self]),
    directive('frame-ancestors', [options.frameAncestors || "'self'"])
  ].join('; ');
}

/**
 * Network hosts a preview may reach, for display in the Web Preview toolbar.
 * Returns remote origins only — the host origin and CSP keywords are omitted.
 */
export function describePreviewNetwork(config: unknown): string[] {
  const normalized = normalizePreviewCspConfig(config);
  if (normalized.mode === 'strict') return [];
  const preset = normalized.mode === 'custom' ? {} : PRESETS[normalized.mode];
  const hosts: string[] = [];
  for (const key of ['scriptSrc', 'connectSrc', 'imgSrc', 'styleSrc', 'fontSrc'] as Array<keyof PreviewCspSources>) {
    for (const source of unique(preset[key], normalized.allow[key])) {
      if (!/^https?:\/\//i.test(source)) continue;
      let host: string;
      try {
        host = new URL(source).host;
      } catch (_) {
        continue;
      }
      if (hosts.indexOf(host) === -1) hosts.push(host);
    }
  }
  return hosts;
}

/**
 * Scripts injected into every preview document:
 *
 * 1. In-memory `localStorage`/`sessionStorage` — a sandboxed (opaque origin)
 *    document throws `SecurityError` on access, which breaks any preview that
 *    touches storage at module top level. In-memory equivalents keep the app
 *    running; sub-resource loading is unaffected.
 * 2. A `securitypolicyviolation` reporter that forwards to the host via
 *    `postMessage`. The host validates `event.source` (the document origin is
 *    opaque, so `event.origin` is the string `"null"` and is not usable).
 */
export function buildPreviewShims(): string {
  return `<script ${PREVIEW_SHIM_MARKER}>
(function () {
  'use strict';
  function memoryStorage() {
    var data = new Map();
    return {
      getItem: function (k) { k = String(k); return data.has(k) ? data.get(k) : null; },
      setItem: function (k, v) { data.set(String(k), String(v)); },
      removeItem: function (k) { data.delete(String(k)); },
      clear: function () { data.clear(); },
      key: function (i) { return Array.from(data.keys())[i] || null; },
      get length() { return data.size; }
    };
  }
  function shim(name) {
    var blocked = false;
    try {
      var existing = window[name];
      if (existing) { existing.getItem('__codelab_probe__'); return; }
    } catch (err) {
      // Expected on an opaque origin: the accessor itself throws.
      blocked = Boolean(err);
    }
    void blocked;
    try {
      Object.defineProperty(window, name, { configurable: true, value: memoryStorage() });
    } catch (err) {
      console.warn('[code-lab] preview: unable to shim ' + name, err);
    }
  }
  shim('localStorage');
  shim('sessionStorage');
  document.addEventListener('securitypolicyviolation', function (event) {
    try {
      parent.postMessage({
        type: 'codelab:preview-violation',
        directive: event.effectiveDirective || event.violatedDirective || '',
        blockedURI: event.blockedURI || '',
        sourceFile: event.sourceFile || '',
        line: event.lineNumber || 0
      }, '*');
    } catch (err) {
      console.warn('[code-lab] preview: could not report CSP violation', err);
    }
  });
  function serializeArg(arg) {
    if (typeof arg !== 'object' || arg === null) return String(arg);
    try {
      return JSON.stringify(arg);
    } catch (err) {
      void err;
      return '[Circular/Unserializable]';
    }
  }
  ['log', 'warn', 'error', 'info'].forEach(function (level) {
    var orig = console[level];
    if (typeof orig !== 'function') return;
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      try {
        parent.postMessage({
          type: 'codelab:preview-console',
          level: level,
          args: args.map(serializeArg)
        }, '*');
      } catch (err) {
        void err;
      }
      return orig.apply(console, args);
    };
  });
  function showPreviewErrorOverlay(msg, stack) {
    try {
      if (!document || !document.body) return;
      var existing = document.getElementById('codelab-preview-error-overlay');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'codelab-preview-error-overlay';
        existing.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,0.94);color:#f8fafc;font-family:ui-monospace,monospace;padding:24px;overflow:auto;';
        document.body.appendChild(existing);
      }
      existing.textContent = '';
      var header = document.createElement('div');
      header.style.cssText = 'color:#f87171;font-weight:700;font-size:15px;margin-bottom:12px;';
      header.textContent = 'Runtime Error: ' + String(msg || 'Uncaught Error');
      var pre = document.createElement('pre');
      pre.style.cssText = 'white-space:pre-wrap;font-size:12px;color:#cbd5e1;margin:0;';
      pre.textContent = String(stack || msg || '');
      existing.appendChild(header);
      existing.appendChild(pre);
    } catch (err) {
      void err;
    }
  }
  window.addEventListener('error', function (event) {
    var msg = (event && event.message) ? event.message : 'Uncaught runtime error';
    var stack = (event && event.error && event.error.stack) ? String(event.error.stack) : '';
    showPreviewErrorOverlay(msg, stack);
    try {
      parent.postMessage({
        type: 'codelab:preview-error',
        message: msg,
        file: (event && event.filename) || null,
        line: (event && event.lineno) || null,
        col: (event && event.colno) || null,
        stack: stack || null
      }, '*');
    } catch (err) {
      void err;
    }
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event ? event.reason : null;
    var msg = reason && reason.message ? String(reason.message) : String(reason || 'Unhandled Promise Rejection');
    var stack = reason && reason.stack ? String(reason.stack) : '';
    showPreviewErrorOverlay(msg, stack);
    try {
      parent.postMessage({
        type: 'codelab:preview-error',
        message: msg,
        file: null,
        line: null,
        col: null,
        stack: stack || null
      }, '*');
    } catch (err) {
      void err;
    }
  });
})();
</script>`;
}

/** Default export keeps the IIFE global (`CodeLabCsp`) shaped like the sources. */
export default {
  buildPreviewPolicy,
  buildPreviewShims,
  describePreviewNetwork,
  normalizePreviewCspConfig,
  normalizeOrigin,
  PREVIEW_SHIM_MARKER
};
