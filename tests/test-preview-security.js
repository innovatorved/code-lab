#!/usr/bin/env node
'use strict';

/**
 * Web Preview hardening regression suite.
 *
 * Covers the P0-3 / N-01 contract:
 *   - Previews are sandboxed WITHOUT `allow-same-origin` (opaque origin), so
 *     preview code cannot reach host DOM or host storage.
 *   - Every preview document (iframe srcdoc fallback) carries the shared CSP,
 *     which names the host origin literally because `'self'` matches nothing in
 *     an opaque-origin document.
 *   - `previewCsp` selects strict/balanced/custom and is surfaced in the toolbar.
 *   - CSP violations from the preview are reported to the host and shown to the
 *     user; the host can subscribe via `on('preview-violation')`.
 *   - `previewOrigin` is validated, and *ignored with a warning* until the relay
 *     ships (a 503 would otherwise look like a broken preview).
 *
 * Service-worker responses are covered in tests/test-preview-sw.js.
 */

const assert = require('node:assert/strict');
const { doc, localStorageStore } = require('./helpers/mock-dom.js');
const { defineGlobal } = require('./helpers/globals.js');
const { CodeLabWorkbench } = require('./helpers/load').workbench;

const HOST_ORIGIN = 'https://host.example';

function makeContainer() {
  localStorageStore.clear();
  const container = doc.createElement('div');
  container.setAttribute('id', 'preview-security-root');
  return container;
}

function makeWorkbench(options = {}) {
  const wb = new CodeLabWorkbench(makeContainer(), {
    labId: `preview-sec-${Math.random().toString(36).slice(2)}`,
    files: { 'index.js': '' },
    ...options
  });
  return wb;
}

function withServer(wb, port = 3000) {
  wb.portTable.registerServer(port, {
    name: 'http-server',
    pid: 7,
    fetch: () => new Response(
      '<!doctype html><html><head><title>App</title></head><body>Hello Preview</body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  });
  return wb;
}

async function runSuite() {
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
  console.log('   P0-3: Web Preview Hardening (CSP, previewOrigin, sandbox)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- previewOrigin plumbing ---');

  await test('P1 default preview URL stays on the host origin', () => {
    const wb = makeWorkbench();
    assert.equal(wb.previewOrigin, null);
    assert.equal(wb._previewFrameUrl(3000, '/'), '/__preview/3000/');
    assert.equal(wb._previewFrameUrl(4100, '/app?x=1'), '/__preview/4100/app?x=1');
  });

  await test('P2 previewOrigin is normalized but not used until the relay ships', () => {
    const wb = makeWorkbench({ previewOrigin: 'https://preview.example.com/some/path' });
    assert.equal(wb.previewOrigin, 'https://preview.example.com');
    // Cross-origin previews need a relay page + worker on that origin. Pointing
    // the iframe at it today yields a 503, which looks like a product bug.
    assert.equal(wb._previewFrameUrl(3000, '/app?x=1'), '/__preview/3000/app?x=1');
  });

  await test('P3 invalid previewOrigin is rejected without crashing', () => {
    const warnings = [];
    const prevWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      for (const bad of ['javascript:alert(1)', 'ftp://preview.example.com', 'not a url', '']) {
        const wb = makeWorkbench({ previewOrigin: bad });
        assert.equal(wb.previewOrigin, null, `previewOrigin ${bad} must be rejected`);
        assert.equal(wb._previewFrameUrl(3000, '/'), '/__preview/3000/');
      }
    } finally {
      console.warn = prevWarn;
    }
    assert.ok(warnings.some(w => w.includes('previewOrigin')), 'invalid values should warn');
  });

  await test('P4 the default preview does not warn: the sandbox already isolates it', async () => {
    const warnings = [];
    const prevWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const wb = withServer(makeWorkbench());
      await wb._openWebPreview(3000);
      await wb._openWebPreview(3000);
    } finally {
      console.warn = prevWarn;
    }
    assert.deepEqual(warnings, [], `unexpected warnings: ${warnings.join(' | ')}`);
  });

  await test('P5 an unusable previewOrigin warns exactly once per workbench', async () => {
    const warnings = [];
    const prevWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const wb = withServer(makeWorkbench({ previewOrigin: 'https://preview.example.com' }));
      await wb._openWebPreview(3000);
      await wb._openWebPreview(3000);
      assert.equal(wb._previewFrameUrl(3000, '/'), '/__preview/3000/');
    } finally {
      console.warn = prevWarn;
    }
    const ignored = warnings.filter(w => w.includes('previewOrigin') && w.includes('ignored'));
    assert.equal(ignored.length, 1, `expected one warning, got ${ignored.length}: ${warnings.join(' | ')}`);
  });

  console.log('\n--- iframe hardening ---');

  await test('P6 preview iframe is sandboxed and denies powerful features', async () => {
    const wb = withServer(makeWorkbench());
    await wb._openWebPreview(3000);
    const iframe = wb.container.querySelector('#cl-preview-iframe');
    assert.ok(iframe, 'preview iframe must exist');

    const sandbox = iframe.getAttribute('sandbox') || '';
    for (const token of ['allow-scripts', 'allow-forms', 'allow-modals']) {
      assert.ok(sandbox.includes(token), `sandbox must include ${token}`);
    }
    // `allow-scripts` + `allow-same-origin` lets a preview remove its own sandbox
    // and reach `parent.document` / host localStorage. Never ship both.
    assert.ok(
      !sandbox.includes('allow-same-origin'),
      'sandbox must NOT include allow-same-origin (preview isolation depends on an opaque origin)'
    );

    const allow = iframe.getAttribute('allow') || '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      assert.ok(allow.includes(feature), `permissions policy must mention ${feature}`);
    }

    // Root-relative sub-resources are attributed to their preview by the service
    // worker via the request referrer, which needs a non-empty referrer.
    assert.equal(iframe.getAttribute('referrerpolicy'), 'no-referrer-when-downgrade');
  });

  await test('P7 srcdoc fallback injects the shared CSP, <base> and storage shims', async () => {
    const restoreLocation = defineGlobal('location', { origin: HOST_ORIGIN });
    let srcdoc;
    try {
      const wb = withServer(makeWorkbench());
      await wb._openWebPreview(3000);
      const iframe = wb.container.querySelector('#cl-preview-iframe');
      srcdoc = iframe.getAttribute('srcdoc') || '';
    } finally {
      restoreLocation();
    }

    assert.match(srcdoc, /http-equiv="Content-Security-Policy"/);
    // `'self'` matches nothing inside an opaque-origin (sandboxed) document, so
    // the host origin must appear literally or the app's own assets are blocked.
    assert.match(srcdoc, new RegExp(`default-src ${HOST_ORIGIN} data: blob:`));
    assert.ok(!/script-src 'self'/.test(srcdoc), "script-src must not rely on 'self'");
    assert.match(srcdoc, /object-src 'none'/);
    assert.match(srcdoc, /frame-ancestors 'self'/);
    assert.match(srcdoc, /<base href="\/__preview\/3000\/">/);
    assert.match(srcdoc, /Hello Preview/);
    assert.match(srcdoc, /data-codelab-preview-shims/);
    assert.equal((srcdoc.match(/Content-Security-Policy/g) || []).length, 1);
    assert.equal((srcdoc.match(/<base\b/g) || []).length, 1);
    assert.equal((srcdoc.match(/data-codelab-preview-shims/g) || []).length, 1);
  });

  await test('P8 an existing CSP meta is not duplicated', () => {
    const wb = makeWorkbench();
    const html = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>x</body></html>';
    const out = wb._injectPreviewCsp(html, 3000);
    assert.equal((out.match(/Content-Security-Policy/g) || []).length, 1);
  });

  await test('P9 CSP is still injected when the document has no <head>', () => {
    const wb = makeWorkbench();
    const out = wb._injectPreviewCsp('<body>bare</body>', 3000);
    assert.match(out, /Content-Security-Policy/);
    assert.match(out, /<base href="\/__preview\/3000\/">/);
  });

  await test('P10 pop-out stays same-origin until the relay ships', async () => {
    const wb = withServer(makeWorkbench({ previewOrigin: 'https://preview.example.com' }));
    let opened = null;
    const prevOpen = globalThis.window.open;
    globalThis.window.open = (url) => { opened = url; };
    try {
      await wb._openWebPreview(3000);
      const popout = wb._popoutPreview();
      assert.equal(popout, '/__preview/3000/');
      assert.equal(opened, '/__preview/3000/');
    } finally {
      globalThis.window.open = prevOpen;
    }
  });

  console.log('\n--- previewCsp option ---');

  await test('P11 balanced (default) allows the import-map CDNs; strict blocks them', async () => {
    const balanced = withServer(makeWorkbench());
    const balancedPolicy = balanced._previewPolicy();
    assert.match(balancedPolicy, /https:\/\/cdn\.jsdelivr\.net/);
    assert.match(balancedPolicy, /https:\/\/esm\.sh/);
    assert.deepEqual(balanced._previewNetworkHosts().sort(), ['cdn.jsdelivr.net', 'esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com']);

    const strict = withServer(makeWorkbench({ previewCsp: 'strict' }));
    assert.equal(strict.previewCsp.mode, 'strict');
    assert.ok(!strict._previewPolicy().includes('jsdelivr'), 'strict must not allow jsDelivr');
    assert.deepEqual(strict._previewNetworkHosts(), []);
  });

  await test('P12 custom previewCsp extends the strict baseline with named hosts', async () => {
    const wb = withServer(makeWorkbench({
      previewCsp: { mode: 'custom', connectSrc: ['https://api.example.com'], imgSrc: ['https://images.example.com'] }
    }));
    const policy = wb._previewPolicy();
    assert.match(policy, /connect-src[^;]*https:\/\/api\.example\.com/);
    assert.match(policy, /img-src[^;]*https:\/\/images\.example\.com/);
    assert.ok(!policy.includes('jsdelivr'), 'custom must not inherit the balanced preset');
    assert.deepEqual(wb._previewNetworkHosts().sort(), ['api.example.com', 'images.example.com']);
  });

  await test('P13 a CSP violation updates the toolbar chip and emits preview-violation', async () => {
    const wb = withServer(makeWorkbench());
    const events = [];
    wb.on('preview-violation', (detail) => events.push(detail));

    const toasts = [];
    const prevToast = wb._showToast;
    wb._showToast = (message, kind) => { toasts.push({ message, kind }); };
    const listeners = [];
    const prevAdd = globalThis.window.addEventListener;
    globalThis.window.addEventListener = (type, handler) => { if (type === 'message') listeners.push(handler); };
    try {
      await wb._openWebPreview(3000);
      await wb._openWebPreview(3000);
      assert.equal(listeners.length, 1, 'exactly one message listener per workbench');

      const iframe = wb.container.querySelector('#cl-preview-iframe');
      iframe.contentWindow = { marker: 'preview-frame' };
      const handler = listeners[0];

      // Forged message from another window must be ignored.
      handler({ source: { marker: 'attacker' }, data: { type: 'codelab:preview-violation', directive: 'script-src-elem', blockedURI: 'https://evil.example/x.js' } });
      assert.equal(events.length, 0, 'messages from other windows must be ignored');

      handler({ source: iframe.contentWindow, data: { type: 'codelab:preview-violation', directive: 'script-src-elem', blockedURI: 'https://evil.example/x.js' } });
      assert.equal(events.length, 1);
      assert.equal(events[0].directive, 'script-src-elem');
      assert.equal(events[0].blockedURI, 'https://evil.example/x.js');
      assert.equal(wb.previewState.violations.length, 1);
      assert.equal(toasts.length, 1);
      assert.match(toasts[0].message, /Blocked by Content-Security-Policy: evil\.example\/x\.js/);

      const chip = wb.container.querySelector('#cl-preview-csp-status');
      assert.ok(chip, 'CSP status chip must exist in the preview toolbar');
      assert.equal(chip.hidden, false);
      assert.match(chip.textContent, /evil\.example/);

      // Duplicates do not spam the user or the host.
      handler({ source: iframe.contentWindow, data: { type: 'codelab:preview-violation', directive: 'script-src-elem', blockedURI: 'https://evil.example/x.js' } });
      assert.equal(events.length, 1);
      assert.equal(toasts.length, 1);
    } finally {
      globalThis.window.addEventListener = prevAdd;
      wb._showToast = prevToast;
      wb.destroy();
    }
  });

  await test('P14 destroy() removes the preview message listener', async () => {
    const wb = withServer(makeWorkbench());
    const removed = [];
    const prevAdd = globalThis.window.addEventListener;
    const prevRemove = globalThis.window.removeEventListener;
    globalThis.window.addEventListener = () => {};
    globalThis.window.removeEventListener = (type, handler) => removed.push({ type, handler });
    try {
      await wb._openWebPreview(3000);
      const handler = wb._previewViolationHandler;
      assert.ok(handler, 'listener must be installed');
      wb.destroy();
      assert.equal(removed.length, 1);
      assert.equal(removed[0].type, 'message');
      assert.equal(removed[0].handler, handler);
      assert.equal(wb._previewViolationHandler, null);
    } finally {
      globalThis.window.addEventListener = prevAdd;
      globalThis.window.removeEventListener = prevRemove;
    }
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`P0-3 Preview Security Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) {
      console.log(`- ${f.name}: ${f.err && f.err.stack ? f.err.stack : f.err}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('Fatal preview security test error:', err);
  process.exit(1);
});
