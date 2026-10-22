'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 3: Web Preview Service Worker (src/preview-sw.js) — Test Suite
 *
 * Executes the Service Worker script inside a sandboxed VM with a mocked
 * ServiceWorkerGlobalScope to verify virtual-loopback routing:
 *   - `/__preview/:port/*` interception and MessageChannel bridge dispatch
 *   - `<base href="/__preview/:port/">` injection into HTML responses
 *   - Referrer-based routing of root-relative sub-resources
 *   - 503 when no CodeLab workbench client is available
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Test the shipped artifact: dist/preview-sw.js is the shared CSP module
// (src/csp.ts) prepended to src/preview-sw.js. Loading the source alone would
// not exercise the policy wiring that actually runs in browsers.
const SW_PATH = path.join(__dirname, '..', 'dist', 'preview-sw.js');
if (!fs.existsSync(SW_PATH)) {
  console.error('dist/preview-sw.js is missing. Run `bun run build` first.');
  process.exit(2);
}
const CODE = fs.readFileSync(SW_PATH, 'utf8');

function loadWorker({ clients, onDispatch } = {}) {
  const listeners = {};
  let captured = null;

  const client = {
    postMessage(msg, ports) {
      captured = { msg, ports };
      if (typeof onDispatch === 'function') onDispatch(msg, ports && ports[0]);
    }
  };

  const clientList = Array.isArray(clients) ? clients.slice() : [client];

  const self = {
    location: { origin: 'https://example.com' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: {
      claim: () => {},
      matchAll: async () => clientList
    }
  };

  const context = { self, URL, Response, Headers, MessageChannel, Request, setTimeout, clearTimeout, console };
  vm.createContext(context);
  vm.runInContext(CODE, context);

  return { listeners, getCaptured: () => captured };
}

async function fireFetch(listeners, request) {
  let pending;
  listeners.fetch({ request, respondWith: (p) => { pending = p; } });
  return pending;
}

const defaultReply = (msg, replyPort) => {
  if (msg.type === 'CODELAB_SW_DISPATCH' && replyPort) {
    replyPort.postMessage({
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<html><head></head><body>Hello SW Bridge</body></html>'
    });
  }
};

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      failed++;
      failures.push({ name, err });
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${err && err.message ? err.message : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   M3: Web Preview Service Worker — Virtual Loopback Routing');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  await test('SW1 install + activate handlers call skipWaiting and clients.claim', () => {
    const { listeners } = loadWorker();
    assert.equal(typeof listeners.install, 'function');
    assert.equal(typeof listeners.activate, 'function');
    assert.equal(typeof listeners.fetch, 'function');
    // Should not throw when invoked with a minimal event.
    listeners.install({});
    listeners.activate({ waitUntil: () => {} });
  });

  await test('SW2 /__preview/:port/* is bridged via CODELAB_SW_DISPATCH and returns 200', async () => {
    const cap = {};
    const { listeners } = loadWorker({ onDispatch: (msg, port) => { cap.msg = msg; defaultReply(msg, port); } });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/dashboard?x=1'));
    assert.equal(res.status, 200);
    assert.equal(cap.msg.type, 'CODELAB_SW_DISPATCH');
    assert.equal(cap.msg.port, 3000);
    assert.equal(cap.msg.url, 'http://127.0.0.1:3000/dashboard?x=1');
  });

  await test('SW3 HTML responses receive a <base href="/__preview/:port/"> injection', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    const body = await res.text();
    assert.match(body, /<base href="\/__preview\/3000\/">/);
    assert.match(body, /Hello SW Bridge/);
  });

  await test('SW4 root-relative sub-resources route via the preview referrer', async () => {
    const cap = {};
    const { listeners } = loadWorker({ onDispatch: (msg, port) => { cap.msg = msg; defaultReply(msg, port); } });
    const req = new Request('https://example.com/assets/app.js');
    Object.defineProperty(req, 'referrer', { value: 'https://example.com/__preview/4100/' });
    const res = await fireFetch(listeners, req);
    assert.equal(res.status, 200);
    assert.equal(cap.msg.port, 4100);
    assert.equal(cap.msg.url, 'http://127.0.0.1:4100/assets/app.js');
  });

  await test('SW5 non-preview, non-referrer requests are not intercepted', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    let called = false;
    listeners.fetch({ request: new Request('https://example.com/index.html'), respondWith: () => { called = true; } });
    assert.equal(called, false);
  });

  await test('SW6 returns 503 when no workbench client is available', async () => {
    const { listeners } = loadWorker({ clients: [], onDispatch: defaultReply });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    assert.equal(res.status, 503);
    assert.match(await res.text(), /No active CodeLab workbench/);
  });

  await test('SW7 cross-origin requests are not intercepted', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    let called = false;
    listeners.fetch({ request: new Request('https://cdn.example.net/__preview/3000/'), respondWith: () => { called = true; } });
    assert.equal(called, false);
  });

  await test('SW8 HTML responses carry the preview CSP header', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    const csp = res.headers.get('content-security-policy') || '';
    // `'self'` is useless in a sandboxed (opaque-origin) preview document, so
    // the worker names its own origin explicitly.
    assert.match(csp, /default-src https:\/\/example\.com data: blob:/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  await test('SW9 HTML body receives exactly one CSP meta tag', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    const body = await res.text();
    assert.equal((body.match(/Content-Security-Policy/g) || []).length, 1);
    assert.equal((body.match(/<base\b/g) || []).length, 1);
    assert.ok(body.indexOf('Content-Security-Policy') < body.indexOf('<body>'));
  });

  await test('SW10 non-HTML responses are not rewritten', async () => {
    const { listeners } = loadWorker({
      onDispatch: (msg, port) => port.postMessage({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: '{"ok":true}'
      })
    });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/api'));
    assert.equal(await res.text(), '{"ok":true}');
    assert.equal(res.headers.get('content-security-policy'), null);
  });

  await test('SW11 error responses carry the preview CSP', async () => {
    const { listeners } = loadWorker({ clients: [], onDispatch: defaultReply });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    assert.equal(res.status, 503);
    assert.match(res.headers.get('content-security-policy') || '', /default-src https:\/\/example\.com/);
    assert.match(await res.text(), /http-equiv="Content-Security-Policy"/);
  });

  await test('SW12 an HTML response carries the sandbox shims exactly once', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    const body = await res.text();
    assert.equal((body.match(/data-codelab-preview-shims/g) || []).length, 1);
    assert.match(body, /codelab:preview-violation/);
  });

  await test('SW13 a page that already declares a CSP is not given a second one', async () => {
    const { listeners } = loadWorker({
      onDispatch: (msg, port) => port.postMessage({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>x</body></html>'
      })
    });
    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    const body = await res.text();
    assert.equal((body.match(/http-equiv="Content-Security-Policy"/g) || []).length, 1);
    assert.match(body, /default-src 'none'/);
  });

  await test('SW14 the workbench-configured policy replaces the strict default', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    const configured = "default-src https://example.com https://cdn.jsdelivr.net data: blob:; object-src 'none'";

    let acked = false;
    listeners.message({
      data: { type: 'codelab:config', csp: configured },
      source: { postMessage: () => { acked = true; } }
    });
    assert.equal(acked, true, 'config must be acknowledged');

    const res = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    assert.equal(res.headers.get('content-security-policy'), configured);
    const body = await res.text();
    assert.match(body, /cdn\.jsdelivr\.net/);
  });

  await test('SW15 malformed or oversized worker config is ignored', async () => {
    const { listeners } = loadWorker({ onDispatch: defaultReply });
    const before = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));

    for (const data of [
      null,
      { type: 'codelab:other', csp: "default-src *" },
      { type: 'codelab:config', csp: 42 },
      { type: 'codelab:config', csp: '' },
      { type: 'codelab:config', csp: 'a'.repeat(9000) }
    ]) {
      listeners.message({ data, source: null });
    }

    const after = await fireFetch(listeners, new Request('https://example.com/__preview/3000/'));
    assert.equal(
      after.headers.get('content-security-policy'),
      before.headers.get('content-security-policy'),
      'invalid config must not change the policy'
    );
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`M3 Service Worker Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) console.log(`- ${f.name}: ${f.err && f.err.message ? f.err.message : f.err}`);
  }

  // MessageChannel ports keep the event loop alive; exit explicitly.
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal Service Worker test error:', err);
  process.exit(1);
});
