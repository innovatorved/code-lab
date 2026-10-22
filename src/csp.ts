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
      var topBar = document.createElement('div');
      topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(248,113,113,0.28);';
      var header = document.createElement('div');
      header.style.cssText = 'color:#f87171;font-weight:700;font-size:14px;';
      header.textContent = 'Runtime Error: ' + String(msg || 'Uncaught Error');
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'Dismiss \u00d7';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.08);color:#e2e8f0;border:1px solid rgba(255,255,255,0.16);border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;';
      closeBtn.onclick = function () { if (existing && existing.parentNode) existing.parentNode.removeChild(existing); };
      topBar.appendChild(header);
      topBar.appendChild(closeBtn);
      var pre = document.createElement('pre');
      pre.style.cssText = 'white-space:pre-wrap;font-size:12px;color:#cbd5e1;margin:0;line-height:1.55;';
      pre.textContent = String(stack || msg || '');
      existing.appendChild(topBar);
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

  // Virtual loopback bridge for fetch/XHR, link navigation, and SPA history in srcdoc/sandbox mode
  var pendingFetches = new Map();
  var fetchSeq = 0;
  function parseLoopbackTarget(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    var trimmed = rawUrl.trim();
    if (!trimmed) return null;
    var lower = trimmed.toLowerCase();
    if (lower.indexOf('data:') === 0 || lower.indexOf('blob:') === 0 || lower.indexOf('mailto:') === 0 || lower.indexOf('tel:') === 0 || lower.indexOf('javascript:') === 0 || trimmed.charAt(0) === '#') return null;
    if (lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0) {
      try {
        var u = new URL(trimmed);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0') {
          return { port: u.port ? Number(u.port) : null, path: (u.pathname || '/') + (u.search || '') + (u.hash || '') };
        }
        if (u.pathname && u.pathname.indexOf('/__preview/') === 0) {
          var rest = u.pathname.slice('/__preview/'.length);
          var slashIdx = rest.indexOf('/');
          var portStr = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
          var subPath = slashIdx === -1 ? '/' : rest.slice(slashIdx);
          var portNum = Number(portStr);
          if (portNum > 0) {
            return { port: portNum, path: (subPath || '/') + (u.search || '') + (u.hash || '') };
          }
        }
      } catch (e) { void e; }
      return null;
    }
    if (trimmed.indexOf('/__preview/') === 0) {
      var restRel = trimmed.slice('/__preview/'.length);
      var sIdx = restRel.indexOf('/');
      var pStr = sIdx === -1 ? restRel : restRel.slice(0, sIdx);
      var sPath = sIdx === -1 ? '/' : restRel.slice(sIdx);
      var pNum = Number(pStr);
      if (pNum > 0) {
        return { port: pNum, path: sPath || '/' };
      }
    }
    var cleaned = trimmed.indexOf('./') === 0 ? trimmed.slice(2) : trimmed;
    var pathPart = cleaned.charAt(0) === '/' ? cleaned : '/' + cleaned;
    return { port: null, path: pathPart };
  }

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'codelab:preview-fetch-res' && data.reqId) {
      var entry = pendingFetches.get(data.reqId);
      if (!entry) return;
      pendingFetches.delete(data.reqId);
      entry.resolve(data);
    }
  });

  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var urlStr = typeof input === 'string' ? input : (input && typeof input.url === 'string' ? input.url : String(input || ''));
      var target = parseLoopbackTarget(urlStr);
      // Only bridge via postMessage when running inside a sandboxed/srcdoc document or targeting localhost
      var isOpaque = false;
      try {
        var lowerUrl = urlStr.toLowerCase();
        var isLocalTarget = lowerUrl.indexOf('http://localhost') === 0 || lowerUrl.indexOf('http://127.0.0.1') === 0 || lowerUrl.indexOf('http://0.0.0.0') === 0;
        isOpaque = (window.location.origin === 'null' || window.location.protocol === 'about:' || isLocalTarget);
      } catch (e) { isOpaque = true; void e; }
      if (!target || !isOpaque || window.parent === window) {
        return origFetch(input, init);
      }
      return new Promise(function (resolve, reject) {
        var reqId = 'clf_' + (++fetchSeq) + '_' + Date.now();
        var method = (init && init.method) || (input && input.method) || 'GET';
        var headersObj = {};
        try {
          var rawH = (init && init.headers) || (input && input.headers);
          if (rawH) {
            if (typeof rawH.forEach === 'function') {
              rawH.forEach(function (v, k) { headersObj[k] = v; });
            } else if (Array.isArray(rawH)) {
              rawH.forEach(function (pair) { if (pair && pair.length >= 2) headersObj[pair[0]] = pair[1]; });
            } else if (typeof rawH === 'object') {
              Object.keys(rawH).forEach(function (k) { headersObj[k] = String(rawH[k]); });
            }
          }
        } catch (e) { void e; }
        var bodyStr = (init && init.body !== undefined && init.body !== null) ? String(init.body) : undefined;
        var timer = setTimeout(function () {
          if (pendingFetches.has(reqId)) {
            pendingFetches.delete(reqId);
            origFetch(input, init).then(resolve, reject);
          }
        }, 5000);
        pendingFetches.set(reqId, {
          resolve: function (payload) {
            clearTimeout(timer);
            if (payload && payload.error) {
              reject(new TypeError(String(payload.error)));
              return;
            }
            var status = Number(payload && payload.status) || 200;
            var resHeaders = (payload && payload.headers) || { 'content-type': 'text/plain; charset=utf-8' };
            var body = payload && payload.body !== undefined ? String(payload.body) : '';
            try {
              resolve(new Response(body, { status: status, statusText: String(payload.statusText || 'OK'), headers: resHeaders }));
            } catch (err) {
              void err;
              resolve({
                ok: status >= 200 && status < 300,
                status: status,
                headers: { get: function (k) { return resHeaders[String(k).toLowerCase()] || resHeaders[k] || null; } },
                text: function () { return Promise.resolve(body); },
                json: function () { return Promise.resolve(JSON.parse(body)); }
              });
            }
          }
        });
        try {
          parent.postMessage({
            type: 'codelab:preview-fetch',
            reqId: reqId,
            port: target.port,
            path: target.path,
            method: String(method).toUpperCase(),
            headers: headersObj,
            body: bodyStr
          }, '*');
        } catch (err) {
          clearTimeout(timer);
          pendingFetches.delete(reqId);
          origFetch(input, init).then(resolve, reject);
        }
      });
    };
  }

  // Intercept relative <a href> clicks so multi-page navigation works inside srcdoc/preview
  document.addEventListener('click', function (event) {
    if (!event || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var el = event.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.getAttribute) return;
    var href = el.getAttribute('href');
    var targetAttr = el.getAttribute('target');
    if (!href || targetAttr === '_blank' || el.hasAttribute('download')) return;
    var lowerHref = href.toLowerCase();
    if (href.charAt(0) === '#' || lowerHref.indexOf('mailto:') === 0 || lowerHref.indexOf('tel:') === 0 || lowerHref.indexOf('javascript:') === 0 || lowerHref.indexOf('data:') === 0 || lowerHref.indexOf('blob:') === 0) return;
    var parsed = parseLoopbackTarget(href);
    if (!parsed) return;
    event.preventDefault();
    try {
      parent.postMessage({
        type: 'codelab:preview-navigate',
        port: parsed.port,
        path: parsed.path
      }, '*');
    } catch (e) { void e; }
  });

  // Sync SPA history.pushState / replaceState with the preview omni-address bar
  try {
    ['pushState', 'replaceState'].forEach(function (method) {
      var orig = history[method];
      if (typeof orig !== 'function') return;
      history[method] = function (state, title, url) {
        var ret;
        try { ret = orig.apply(history, arguments); } catch (e) { void e; }
        if (url !== undefined && url !== null) {
          var parsed = parseLoopbackTarget(String(url));
          if (parsed) {
            try {
              parent.postMessage({
                type: 'codelab:preview-url-change',
                path: parsed.path,
                replace: method === 'replaceState'
              }, '*');
            } catch (e) { void e; }
          }
        }
        return ret;
      };
    });
  } catch (e) { void e; }
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
