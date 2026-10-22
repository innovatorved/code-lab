/**
 * ============================================================
 * @innovatorved/code-lab v0.1.7 — Standalone Browser Code IDE & Virtual Runtime
 * ============================================================
 * Features:
 *   - Sandboxed Web Worker Execution Engine with Multi-Instance Isolation & Watchdog Timer
 *   - First-Class Node.js and Bun Runtimes (Bun.serve, bun:test, bun:sqlite, Bun.*)
 *   - Full POSIX Shell AST & 55+ UNIX Coreutils (pipes, redirects, globs, env vars, git & git clone)
 *   - Interactive PTY Terminal Emulator with inline prompt, Tab completion & ANSI colors
 *   - Persistent HTTP/TCP Servers, CLI curl & Live Port/HTTP Preview
 *   - Modular VS Code Workbench: File Tree, Tabs, Command Palette, Diff Viewer
 *   - Modular Opt-In Guided Lab Extension (stepper, hints, solution diff, JS/TS switcher)
 *   - Zero-Auth Public GitHub Repository Cloning (git clone, workbench.cloneRepo, <code-lab repo="...">)
 *   - Third-Party Imperative SDK (getFiles, setFiles, getFile, setFile, cloneRepo, on, off, use, exportWorkspace)
 * ============================================================
 */

var CodeLabCsp = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/csp.ts
  var csp_exports = {};
  __export(csp_exports, {
    PREVIEW_SHIM_MARKER: () => PREVIEW_SHIM_MARKER,
    buildPreviewPolicy: () => buildPreviewPolicy,
    buildPreviewShims: () => buildPreviewShims,
    default: () => csp_default,
    describePreviewNetwork: () => describePreviewNetwork,
    normalizeOrigin: () => normalizeOrigin,
    normalizePreviewCspConfig: () => normalizePreviewCspConfig
  });
  var IMPORT_MAP_CDNS = ["https://cdn.jsdelivr.net", "https://esm.sh"];
  var FONT_CDNS = ["https://cdn.jsdelivr.net", "https://fonts.gstatic.com"];
  var PRESETS = {
    strict: {},
    balanced: {
      scriptSrc: IMPORT_MAP_CDNS.slice(),
      styleSrc: ["https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: FONT_CDNS.slice(),
      connectSrc: IMPORT_MAP_CDNS.slice(),
      imgSrc: ["https://cdn.jsdelivr.net"]
    }
  };
  var SOURCE_KEYS = [
    "scriptSrc",
    "styleSrc",
    "imgSrc",
    "fontSrc",
    "connectSrc",
    "mediaSrc",
    "workerSrc",
    "frameSrc"
  ];
  var MAX_SOURCES = 64;
  var MAX_SOURCE_LENGTH = 512;
  var PREVIEW_SHIM_MARKER = "data-codelab-preview-shims";
  function normalizeOrigin(raw) {
    if (raw === null || raw === void 0 || raw === "") return null;
    try {
      const parsed = new URL(String(raw));
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.origin;
    } catch (_) {
      return null;
    }
  }
  function normalizeMode(raw) {
    if (raw === "strict" || raw === "custom") return raw;
    return "balanced";
  }
  var ALLOWED_KEYWORDS = [
    "'self'",
    "'none'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'wasm-unsafe-eval'",
    "'strict-dynamic'",
    "'unsafe-hashes'"
  ];
  var SOURCE_PATTERN = /^(?:https?:\/\/[A-Za-z0-9._~%-]+(?::\d{1,5})?(?:\/[^\s;,'"]*)?|data:|blob:|filesystem:)$/;
  function isSafeSource(source) {
    return ALLOWED_KEYWORDS.indexOf(source) !== -1 || SOURCE_PATTERN.test(source);
  }
  function cleanSources(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const value of raw.slice(0, MAX_SOURCES)) {
      if (typeof value !== "string") continue;
      const source = value.trim();
      if (!source || source.length > MAX_SOURCE_LENGTH) continue;
      if (!isSafeSource(source)) continue;
      if (out.indexOf(source) === -1) out.push(source);
    }
    return out;
  }
  function unique(...lists) {
    const out = [];
    for (const list of lists) {
      if (!list) continue;
      for (const value of list) {
        if (value && out.indexOf(value) === -1) out.push(value);
      }
    }
    return out;
  }
  function normalizePreviewCspConfig(raw) {
    if (typeof raw === "string") return { mode: normalizeMode(raw), allow: {} };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { mode: "balanced", allow: {} };
    }
    const input = raw;
    const nested = input.allow;
    const sources = nested && typeof nested === "object" && !Array.isArray(nested) ? nested : input;
    const allow = {};
    for (const key of SOURCE_KEYS) {
      const list = cleanSources(sources[key]);
      if (list.length) allow[key] = list;
    }
    return { mode: normalizeMode(input.mode), allow };
  }
  function sourcesFor(mode, allow, key) {
    const preset = mode === "custom" ? {} : PRESETS[mode];
    return unique(preset[key], cleanSources(allow[key]));
  }
  function buildPreviewPolicy(options = {}) {
    const mode = normalizeMode(options.mode);
    const allow = options;
    const host = normalizeOrigin(options.hostOrigin);
    const self = host || "'self'";
    const directive = (name, parts) => `${name} ${unique(parts).join(" ")}`;
    const script = () => [self, "blob:", "'unsafe-inline'", "'unsafe-eval'"].concat(sourcesFor(mode, allow, "scriptSrc"));
    const style = () => [self, "'unsafe-inline'"].concat(sourcesFor(mode, allow, "styleSrc"));
    const withData = (key) => [self, "data:", "blob:"].concat(sourcesFor(mode, allow, key));
    return [
      directive("default-src", [self, "data:", "blob:"]),
      directive("base-uri", [self]),
      "object-src 'none'",
      directive("script-src", script()),
      directive("style-src", style()),
      directive("img-src", withData("imgSrc")),
      directive("font-src", [self, "data:"].concat(sourcesFor(mode, allow, "fontSrc"))),
      directive("connect-src", withData("connectSrc")),
      directive("media-src", withData("mediaSrc")),
      directive("worker-src", [self, "blob:"].concat(sourcesFor(mode, allow, "workerSrc"))),
      directive("frame-src", withData("frameSrc")),
      directive("form-action", [self]),
      directive("frame-ancestors", [options.frameAncestors || "'self'"])
    ].join("; ");
  }
  function describePreviewNetwork(config) {
    const normalized = normalizePreviewCspConfig(config);
    if (normalized.mode === "strict") return [];
    const preset = normalized.mode === "custom" ? {} : PRESETS[normalized.mode];
    const hosts = [];
    for (const key of ["scriptSrc", "connectSrc", "imgSrc", "styleSrc", "fontSrc"]) {
      for (const source of unique(preset[key], normalized.allow[key])) {
        if (!/^https?:\/\//i.test(source)) continue;
        let host;
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
  function buildPreviewShims() {
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
    try {
      var existing = window[name];
      if (existing) { existing.getItem('__codelab_probe__'); return; }
    } catch (err) {
      // Expected on an opaque origin: the accessor itself throws.
    }
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
})();
<\/script>`;
  }
  var csp_default = {
    buildPreviewPolicy,
    buildPreviewShims,
    describePreviewNetwork,
    normalizePreviewCspConfig,
    normalizeOrigin,
    PREVIEW_SHIM_MARKER
  };
  return __toCommonJS(csp_exports);
})();

/**
 * @innovatorved/code-lab — Web Preview Virtual Loopback Service Worker (Milestone 3)
 * ============================================================================
 * Intercepts same-origin requests to `/__preview/:port/*`, forwards them to the
 * live CodeLab workbench window via a MessageChannel bridge, and streams the
 * in-browser virtual runtime's response back to the requesting tab.
 *
 * This enables "pop out to tab" Web Preview for virtual HTTP / Bun servers that
 * exist only inside the workbench's in-memory runtime (no real OS socket).
 *
 * The Content-Security-Policy, the storage shims and the violation reporter all
 * come from `src/csp.ts`, which the build prepends to this file. The workbench
 * embeds the same module, so the two can never drift.
 *
 * Zero dependencies. Plain Service Worker script (no module imports) so it can
 * be registered directly from any host origin.
 */

'use strict';

const PREVIEW_PREFIX = '/__preview/';
const DISPATCH_TIMEOUT_MS = 15000;
const MAX_CONFIG_LENGTH = 8192;

// Policy configured by the workbench via postMessage. The worker cannot read the
// host's options, so the host pushes the resolved policy after registering.
let configuredCsp = null;

function cspModule() {
  // `CodeLabCsp` is declared by the prepended csp bundle (src/csp.ts).
  return typeof CodeLabCsp !== 'undefined' ? CodeLabCsp : null;
}

function previewPolicy() {
  if (configuredCsp) return configuredCsp;
  const csp = cspModule();
  if (!csp) return "default-src 'self'; object-src 'none'";
  // The workbench pushes its resolved policy on registration, so this branch
  // only runs in the brief window before that message arrives. Use the
  // documented default (`balanced`) rather than a stricter one, otherwise the
  // very first preview of a CDN-based app can be blocked by a race.
  return csp.buildPreviewPolicy({ hostOrigin: self.location.origin, mode: 'balanced' });
}

function previewShims() {
  const csp = cspModule();
  return csp ? csp.buildPreviewShims() : '';
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data || data.type !== 'codelab:config') return;
  const csp = typeof data.csp === 'string' ? data.csp.trim() : '';
  if (!csp || csp.length > MAX_CONFIG_LENGTH) return;
  configuredCsp = csp;
  // Acknowledge so the host can wait for confirmation before loading a frame.
  try {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ type: 'codelab:config-ready' });
    } else if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage({ type: 'codelab:config-ready' });
    }
  } catch (err) {
    // The client may have navigated away between postMessage and reply.
    console.warn('[code-lab] preview-sw: config acknowledgement failed', err);
  }
});

function parsePreviewPath(pathname) {
  const match = pathname.match(/^\/__preview\/(\d+)(\/.*)?$/);
  if (!match) return null;
  return { port: Number(match[1]), path: match[2] || '/' };
}

function previewErrorResponse(status, title, message) {
  const csp = previewPolicy();
  const body = `<!doctype html><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<title>${title}</title>` +
    `<body style="font-family:system-ui,-apple-system,sans-serif;padding:32px;color:#666;background:#0a0a0a">` +
    `<h1 style="color:#e5e5e5;font-size:18px">${title}</h1><p>${message}</p></body>`;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

/** Inject the policy, a base URL and the sandbox shims into an HTML response. */
function injectPreviewHead(html, port) {
  const csp = previewPolicy();
  const shims = previewShims();
  const tags = [];
  const hasCsp = /<meta[^>]+http-equiv=["']?content-security-policy/i.test(html);
  const hasBase = /<base\b/i.test(html);
  const hasShims = html.indexOf('data-codelab-preview-shims') !== -1;

  if (!hasCsp) tags.push(`<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  if (!hasBase) tags.push(`<base href="${PREVIEW_PREFIX}${port}/">`);
  if (!hasShims && shims) tags.push(shims);
  if (tags.length === 0) return html;

  const injection = tags.join('');
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (match) => match + injection);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
  }
  return `<head>${injection}</head>${html}`;
}

async function proxyVirtualRequest(event, port, targetPath) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!clients || !clients.length) {
    return previewErrorResponse(
      503,
      'No active CodeLab workbench',
      'Return to the CodeLab IDE tab so the virtual runtime can serve this preview.'
    );
  }

  const client = clients[0];
  const channel = new MessageChannel();
  const request = event.request;
  const method = request.method || 'GET';

  const headers = {};
  try {
    for (const [key, value] of request.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }
  } catch (err) {
    // Opaque or unsupported header collection; forward without request headers.
    console.warn('[code-lab] preview-sw: could not read request headers', err);
  }

  let body = null;
  if (!['GET', 'HEAD'].includes(method)) {
    try {
      body = await request.arrayBuffer();
    } catch (err) {
      console.warn('[code-lab] preview-sw: could not read request body', err);
    }
  }

  const response = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>504 Gateway Timeout</h1><p>The virtual workbench did not respond in time.</p>'
      });
    }, DISPATCH_TIMEOUT_MS);

    channel.port1.onmessage = (messageEvent) => {
      clearTimeout(timer);
      resolve(messageEvent.data);
    };

    client.postMessage(
      {
        type: 'CODELAB_SW_DISPATCH',
        port,
        url: `http://127.0.0.1:${port}${targetPath}`,
        method,
        headers,
        body
      },
      [channel.port2]
    );
  });

  let responseBody = response && response.body;
  const responseHeaders = new Headers((response && response.headers) || {});
  const contentType = responseHeaders.get('content-type') || '';

  // Inject the policy and a <base> so relative asset URLs in HTML responses
  // resolve under the `/__preview/:port/` namespace rather than the host root.
  if (/text\/html/i.test(contentType) && typeof responseBody === 'string') {
    responseBody = injectPreviewHead(responseBody, port);
    responseHeaders.set('Content-Security-Policy', previewPolicy());
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
  }

  return new Response(responseBody, {
    status: (response && response.status) || 200,
    statusText: (response && response.statusText) || 'OK',
    headers: responseHeaders
  });
}

self.addEventListener('fetch', (event) => {
  let url;
  try {
    url = new URL(event.request.url);
  } catch (err) {
    // Non-standard request URL; let the network handle it.
    console.warn('[code-lab] preview-sw: unparsable request URL', err);
    return;
  }

  // Only handle requests on this origin (never proxy third-party traffic).
  if (url.origin !== self.location.origin) return;

  const direct = parsePreviewPath(url.pathname);
  if (direct) {
    const targetPath = (direct.path || '/') + (url.search || '');
    event.respondWith(proxyVirtualRequest(event, direct.port, targetPath));
    return;
  }

  // Secondary route: root-relative sub-resources requested by a preview page
  // (e.g. `/app.js` referenced from `/__preview/3000/`) are attributed to the
  // originating preview tab via the request referrer.
  const referrer = event.request.referrer || '';
  const refMatch = referrer.match(/\/__preview\/(\d+)/);
  if (refMatch) {
    event.respondWith(
      proxyVirtualRequest(event, Number(refMatch[1]), url.pathname + (url.search || ''))
    );
  }
});
