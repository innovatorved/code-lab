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
  // Reject configuration attempts originating from preview tabs/frames themselves.
  if (event.source && event.source.url && /\/__preview\//.test(event.source.url)) return;
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

function escapeMetaAttr(val) {
  return String(val || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function previewErrorResponse(status, title, message) {
  const csp = previewPolicy();
  const safeCsp = escapeMetaAttr(csp);
  const body = `<!doctype html><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${safeCsp}">` +
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
  const safeCsp = escapeMetaAttr(csp);
  const shims = previewShims();
  const tags = [];
  const hasCsp = /<meta[^>]+http-equiv=["']?content-security-policy/i.test(html);
  const hasBase = /<base\b/i.test(html);
  const hasShims = html.indexOf('data-codelab-preview-shims') !== -1;

  if (!hasCsp) tags.push(`<meta http-equiv="Content-Security-Policy" content="${safeCsp}">`);
  if (!hasBase) tags.push(`<base href="${PREVIEW_PREFIX}${Number(port) || 3000}/">`);
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
  const workbenchClients = (clients || []).filter((c) => !c.url || !/\/__preview\//.test(c.url));
  if (!workbenchClients.length) {
    return previewErrorResponse(
      503,
      'No active CodeLab workbench',
      'Return to the CodeLab IDE tab so the virtual runtime can serve this preview.'
    );
  }

  const client = workbenchClients[0];
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

  // Decode Uint8Array / ArrayBuffer HTML bodies so head injection always applies.
  if (/text\/html/i.test(contentType) && responseBody && typeof responseBody !== 'string') {
    try {
      if (responseBody instanceof ArrayBuffer || ArrayBuffer.isView(responseBody)) {
        responseBody = new TextDecoder('utf-8').decode(responseBody);
      }
    } catch (err) {
      console.warn('[code-lab] preview-sw: failed to decode HTML buffer', err);
    }
  }

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
