#!/usr/bin/env node
'use strict';

/**
 * Web Preview hardening regression suite.
 *
 * Covers the P0-3 contract:
 *   - `previewOrigin` is validated and used for the iframe/pop-out URL.
 *   - Users are warned when the preview shares the host origin.
 *   - Every preview document (iframe srcdoc fallback) carries a CSP.
 *   - The iframe is sandboxed and denies powerful browser features.
 *
 * Service-worker responses are covered in tests/test-preview-sw.js.
 */

const assert = require('node:assert/strict');
const { doc, localStorageStore } = require('./helpers/mock-dom.js');
const { CodeLabWorkbench } = require('./helpers/load').workbench;

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

  await test('P2 previewOrigin is normalized to an origin and used in URLs', () => {
    const wb = makeWorkbench({ previewOrigin: 'https://preview.example.com/some/path' });
    assert.equal(wb.previewOrigin, 'https://preview.example.com');
    assert.equal(
      wb._previewFrameUrl(3000, '/app?x=1'),
      'https://preview.example.com/__preview/3000/app?x=1'
    );
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

  await test('P4 host-origin preview warns exactly once per workbench', async () => {
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
    const isolationWarnings = warnings.filter(w => w.includes('Web Preview runs on the host origin'));
    assert.equal(isolationWarnings.length, 1, `expected one warning, got ${isolationWarnings.length}`);
  });

  await test('P5 configured previewOrigin suppresses the isolation warning', async () => {
    const warnings = [];
    const prevWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const wb = withServer(makeWorkbench({ previewOrigin: 'https://preview.example.com' }));
      await wb._openWebPreview(3000);
    } finally {
      console.warn = prevWarn;
    }
    assert.equal(warnings.filter(w => w.includes('host origin')).length, 0);
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

    const allow = iframe.getAttribute('allow') || '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      assert.ok(allow.includes(feature), `permissions policy must mention ${feature}`);
    }

    assert.equal(iframe.getAttribute('referrerpolicy'), 'same-origin');
  });

  await test('P7 srcdoc fallback injects the preview CSP and <base>', async () => {
    const wb = withServer(makeWorkbench());
    await wb._openWebPreview(3000);
    const iframe = wb.container.querySelector('#cl-preview-iframe');
    const srcdoc = iframe.getAttribute('srcdoc') || '';

    assert.match(srcdoc, /http-equiv="Content-Security-Policy"/);
    assert.match(srcdoc, /default-src 'self' data: blob:/);
    assert.match(srcdoc, /object-src 'none'/);
    assert.match(srcdoc, /frame-ancestors 'self'/);
    assert.match(srcdoc, /<base href="\/__preview\/3000\/">/);
    assert.match(srcdoc, /Hello Preview/);
    assert.equal((srcdoc.match(/Content-Security-Policy/g) || []).length, 1);
    assert.equal((srcdoc.match(/<base\b/g) || []).length, 1);
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

  await test('P10 pop-out honours previewOrigin', async () => {
    const wb = withServer(makeWorkbench({ previewOrigin: 'https://preview.example.com' }));
    let opened = null;
    const prevOpen = globalThis.window.open;
    globalThis.window.open = (url) => { opened = url; };
    try {
      await wb._openWebPreview(3000);
      const popout = wb._popoutPreview();
      assert.equal(popout, 'https://preview.example.com/__preview/3000/');
      assert.equal(opened, 'https://preview.example.com/__preview/3000/');
    } finally {
      globalThis.window.open = prevOpen;
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
