'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 3: Dual In-Browser Web Preview & Virtual Port Access — Test Suite
 *
 * Verifies:
 *   A. VirtualPortTable pub/sub: on / off / emit, listen & close events,
 *      unregister alias, killProcess single-close semantics, duplicate guard.
 *   B. Port toast notifications: "Open Web Preview" action, dismissal.
 *   C. Embedded Web Preview pane: simulated browser chrome, URL bar, port
 *      selector, device frame modes, iframe fallback loading via the virtual
 *      port table with <base> injection, pop-out to /__preview/:port/.
 *   D. Service Worker bridge: CODELAB_SW_DISPATCH message -> dispatched response.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');

// Shared DOM/browser mock (installs globalThis.document/window/localStorage/Event).
const { DOMEvent, DOMDocument, doc, localStorageStore } = require('./helpers/mock-dom.js');

const runtime = require('./helpers/load').runtime;
const CodeLabSDK = require('./helpers/load').workbench;
const { CodeLabWorkbench } = CodeLabSDK;

function makeContainer() {
  localStorageStore.clear();
  const container = doc.createElement('div');
  container.setAttribute('id', 'preview-test-root');
  return container;
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
  console.log('   M3: Dual In-Browser Web Preview & Virtual Port Access');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- Suite A: Virtual Port Table Pub/Sub ---');

  await test('A1 createVirtualPortTable exposes on/off/emit and unregister alias', () => {
    const pt = runtime.createVirtualPortTable();
    assert.equal(typeof pt.on, 'function');
    assert.equal(typeof pt.off, 'function');
    assert.equal(typeof pt.emit, 'function');
    assert.equal(typeof pt.unregister, 'function');
    assert.equal(typeof pt.unregisterServer, 'function');
  });

  await test('A2 registerServer emits "listen" with the server entry', () => {
    const pt = runtime.createVirtualPortTable();
    const seen = [];
    pt.on('listen', (entry) => seen.push(entry));
    const entry = pt.registerServer(3000, { name: 'http-server', pid: 42 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].port, 3000);
    assert.equal(seen[0].name, 'http-server');
    assert.equal(entry.port, 3000);
    assert.ok(seen[0].registeredAt > 0);
  });

  await test('A3 unregister alias removes the server and emits "close"', () => {
    const pt = runtime.createVirtualPortTable();
    const closes = [];
    pt.on('close', (port, entry) => closes.push([port, entry && entry.name]));
    pt.registerServer(4001, { name: 'bun' });
    assert.equal(pt.listServers().length, 1);
    const removed = pt.unregister(4001);
    assert.equal(removed, true);
    assert.equal(pt.listServers().length, 0);
    assert.deepEqual(closes, [[4001, 'bun']]);
  });

  await test('A4 off() and the returned unsubscribe both detach listeners', () => {
    const pt = runtime.createVirtualPortTable();
    let count = 0;
    const listener = () => { count++; };
    const unsub = pt.on('listen', listener);
    pt.on('listen', () => { count++; });
    pt.off('listen', listener);
    pt.registerServer(4002);
    assert.equal(count, 1, 'off() should remove the first listener');
    unsub();
    pt.registerServer(4003);
    assert.equal(count, 2, 'returned unsubscribe should be a no-op for already-removed listener');
  });

  await test('A5 killProcess emits exactly one "close" (no double emit)', () => {
    const pt = runtime.createVirtualPortTable();
    const closes = [];
    pt.on('close', (port) => closes.push(port));
    let closed = false;
    pt.registerServer(4100, { pid: 7, server: { close: () => { closed = true; pt.unregisterServer(4100); } } });
    const found = pt.killProcess(7);
    assert.equal(found, true);
    assert.equal(closed, true);
    assert.equal(closes.length, 1, 'close should be emitted once even though server.close() unregisters');
    assert.equal(pt.listServers().length, 0);
  });

  await test('A6 duplicate port registration throws EADDRINUSE-style error', () => {
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(4200);
    assert.throws(() => pt.registerServer(4200), /already in use/);
  });

  console.log('\n--- Suite B: Port Toast Notifications ---');

  await test('B1 registering a port shows a toast with an Open Web Preview action', () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-toast', files: { 'index.js': '' } });
    wb.portTable.registerServer(3000, { name: 'http-server', pid: 5 });
    const toastHost = wb.container.querySelector('#cl-toast-container');
    const toast = toastHost.querySelector('.codelab-toast');
    assert.ok(toast, 'toast element should be rendered');
    assert.match(toast.innerHTML, /Server listening on port 3000/);
    const action = toast.querySelector('[data-cl-action="open-web-preview"]');
    assert.ok(action, 'Open Web Preview button should be present');
    assert.equal(action.getAttribute('data-port'), '3000');
  });

  await test('B2 dismissing a toast removes it from the DOM', () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-toast-dismiss', files: { 'index.js': '' } });
    wb.portTable.registerServer(3001, { name: 'srv' });
    assert.equal(wb.container.querySelectorAll('.codelab-toast').length, 1);
    wb._dismissPortToast(3001);
    assert.equal(wb.container.querySelectorAll('.codelab-toast').length, 0);
  });

  await test('B3 closing a listening port dismisses its toast', () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-toast-close', files: { 'index.js': '' } });
    wb.portTable.registerServer(3002, { name: 'srv' });
    assert.equal(wb.container.querySelectorAll('.codelab-toast').length, 1);
    wb.portTable.unregister(3002);
    assert.equal(wb.container.querySelectorAll('.codelab-toast').length, 0);
  });

  console.log('\n--- Suite C: Embedded Web Preview Pane ---');

  function workbenchWithServer(labId, port, body, contentType = 'text/html') {
    const wb = new CodeLabWorkbench(makeContainer(), { labId, files: { 'index.js': '' } });
    wb.portTable.registerServer(port, {
      name: 'http-server',
      pid: 9,
      fetch: () => new Response(body, { headers: { 'Content-Type': contentType } })
    });
    return wb;
  }

  await test('C1 preview drawer tab exists in the drawer tab bar', () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-tab', files: { 'index.js': '' } });
    const tab = wb.container.querySelector('[data-cl-drawertab="preview"]');
    assert.ok(tab, 'Web Preview drawer tab should exist');
    assert.match(tab.innerHTML, /Web Preview/);
  });

  await test('C2 Open Web Preview switches to the preview tab and renders browser chrome', async () => {
    const wb = workbenchWithServer('m3-open', 3000, '<html><head><title>Hi</title></head><body>Hello Preview</body></html>');
    await wb._openWebPreview(3000);
    assert.equal(wb.drawerTab, 'preview');
    const chrome = wb.container.querySelector('.codelab-preview-chrome');
    assert.ok(chrome, 'browser chrome should render');
    assert.ok(wb.container.querySelector('[data-cl-action="preview-back"]'), 'back button');
    assert.ok(wb.container.querySelector('[data-cl-action="preview-forward"]'), 'forward button');
    assert.ok(wb.container.querySelector('[data-cl-action="preview-reload"]'), 'reload button');
    assert.ok(wb.container.querySelector('#cl-preview-url-input'), 'url bar');
    assert.ok(wb.container.querySelector('[data-cl-action="preview-popout"]'), 'pop-out button');
  });

  await test('C3 fallback iframe loads virtual server HTML and injects <base>', async () => {
    const wb = workbenchWithServer('m3-iframe', 3000, '<html><head><title>App</title></head><body>Hello Preview</body></html>');
    await wb._openWebPreview(3000);
    const iframe = wb.container.querySelector('#cl-preview-iframe');
    assert.ok(iframe, 'preview iframe should exist');
    const srcdoc = iframe.getAttribute('srcdoc') || '';
    assert.match(srcdoc, /Hello Preview/);
    assert.match(srcdoc, /<base href="\/__preview\/3000\/">/);
  });

  await test('C4 device frame modes toggle the viewport class', async () => {
    const wb = workbenchWithServer('m3-modes', 3000, '<html><head></head><body>x</body></html>');
    await wb._openWebPreview(3000);
    wb._previewSetFrameMode('mobile');
    let viewport = wb.container.querySelector('#cl-preview-viewport');
    assert.ok(viewport.classList.contains('codelab-preview-viewport--mobile'));
    wb._previewSetFrameMode('tablet');
    viewport = wb.container.querySelector('#cl-preview-viewport');
    assert.ok(viewport.classList.contains('codelab-preview-viewport--tablet'));
  });

  await test('C5 URL navigation updates preview state and re-dispatches', async () => {
    let lastUrl = '';
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-nav', files: { 'index.js': '' } });
    wb.portTable.registerServer(3000, {
      name: 'http-server',
      fetch: (req) => { lastUrl = req.url; return new Response('<html><head></head><body>ok</body></html>', { headers: { 'Content-Type': 'text/html' } }); }
    });
    await wb._previewGo('http://127.0.0.1:3000/status');
    assert.equal(wb.previewState.port, 3000);
    assert.equal(wb.previewState.path, '/status');
    assert.equal(lastUrl, 'http://127.0.0.1:3000/status');
  });

  await test('C6 pop-out returns the /__preview/:port/ virtual loopback URL', async () => {
    const wb = workbenchWithServer('m3-popout', 3000, '<html><head></head><body>x</body></html>');
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

  await test('C7 ports panel exposes a Preview action per listening port', () => {
    const wb = workbenchWithServer('m3-portspanel', 3000, '<html><head></head><body>x</body></html>');
    wb.switchDrawerTab('ports');
    const previewBtn = wb.container.querySelector('[data-cl-action="open-web-preview"][data-port="3000"]');
    assert.ok(previewBtn, 'ports panel should include a Preview button');
  });

  await test('C8 external URLs open in a new tab instead of the virtual frame', async () => {
    const wb = workbenchWithServer('m3-external', 3000, '<html><head></head><body>x</body></html>');
    await wb._openWebPreview(3000);
    const opened = [];
    const prevOpen = globalThis.window.open;
    globalThis.window.open = (url, target) => { opened.push({ url, target }); return {}; };
    try {
      await wb._previewGo('https://google.com');
      await wb._previewGo('example.com/docs');
      await wb._previewGo('www.github.com');
      // Loopback navigation must NOT spawn a new tab.
      await wb._previewGo('http://127.0.0.1:3000/status');
    } finally {
      globalThis.window.open = prevOpen;
    }
    assert.equal(opened.length, 3, 'each external URL should open exactly one tab');
    assert.equal(opened[0].url, 'https://google.com');
    assert.equal(opened[0].target, '_blank');
    assert.equal(opened[1].url, 'https://example.com/docs');
    assert.equal(opened[2].url, 'https://www.github.com');
    assert.equal(wb.previewState.port, 3000, 'external navigation leaves the virtual port untouched');
    assert.equal(wb.previewState.path, '/status', 'loopback navigation still loads in-frame');
  });

  await test('C9 previewApp() boots the built-in preview server for a project and opens it', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), {
      labId: 'm3-preview-app',
      files: {
        'index.html': '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/main.jsx"></script></body></html>',
        'main.jsx': 'import React from "react";\nconsole.log(<h1>hi</h1>);\n'
      }
    });
    assert.equal(wb.portTable.listServers().length, 0, 'nothing listening initially');
    const port = await wb.previewApp();
    assert.ok(port, 'previewApp resolves with a port');
    const servers = wb.portTable.listServers();
    assert.ok(servers.some((s) => Number(s.port) === Number(port)), 'built-in preview server is listening');
    assert.equal(wb.drawerTab, 'preview', 'drawer switches to the preview tab');

    const res = await wb.portTable.dispatchRequest(`http://127.0.0.1:${port}/`);
    const html = await res.text();
    assert.ok(html.includes('<script type="importmap">'), 'served HTML carries the import map');
  });

  await test('C10 previewApp() with no index.html explains how to preview instead of crashing', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-preview-empty', files: { 'demo.js': 'console.log(1);' } });
    const port = await wb.previewApp();
    assert.equal(port, null);
    assert.equal(wb.portTable.listServers().length, 0);
    assert.equal(wb.drawerTab, 'terminal');
    assert.ok(wb.terminalLogs.some((l) => /No index\.html found/.test(l.text)), 'shows guidance');
  });

  await test('C11 hardcoded CDN URLs are aliased to the project-resolved version', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), {
      labId: 'm3-preview-pinned-cdn',
      files: {
        'package.json': JSON.stringify({ dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' } }),
        'index.html': '<!doctype html><html><head></head><body>' +
          '<script type="module">' +
          'import React from "https://cdn.jsdelivr.net/npm/react@19.3.1/+esm";' +
          'import { createRoot } from "https://esm.sh/react-dom@19.3.1/client";' +
          'console.log(React, createRoot);' +
          '</script></body></html>'
      }
    });
    const port = await wb.previewApp();
    const res = await wb.portTable.dispatchRequest(`http://127.0.0.1:${port}/`);
    const html = await res.text();

    const importMapMatch = /<script type="importmap">\n([\s\S]*?)\n<\/script>/.exec(html);
    assert.ok(importMapMatch, 'served HTML carries an import map');
    const imports = JSON.parse(importMapMatch[1]).imports;

    // A pinned URL must resolve through the import map, otherwise it bypasses the
    // project's declared version and the multi-CDN fallback.
    assert.equal(
      imports['https://cdn.jsdelivr.net/npm/react@19.3.1/+esm'],
      'https://cdn.jsdelivr.net/npm/react@^19.0.0/+esm',
      'pinned React URL resolves to the declared version'
    );
    assert.equal(
      imports['https://esm.sh/react-dom@19.3.1/client'],
      'https://cdn.jsdelivr.net/npm/react-dom@^19.0.0/client/+esm',
      'pinned esm.sh subpath resolves to the declared version'
    );
  });

  await test('C12 without a package.json a pinned CDN URL keeps its pinned version', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), {
      labId: 'm3-preview-pinned-cdn-bare',
      files: {
        'index.html': '<!doctype html><html><head></head><body>' +
          '<script type="module">import React from "https://cdn.jsdelivr.net/npm/react@19.3.1/+esm";</script>' +
          '</body></html>'
      }
    });
    const port = await wb.previewApp();
    const res = await wb.portTable.dispatchRequest(`http://127.0.0.1:${port}/`);
    const html = await res.text();
    const importMapMatch = /<script type="importmap">\n([\s\S]*?)\n<\/script>/.exec(html);
    const imports = JSON.parse(importMapMatch[1]).imports;
    const mapped = imports['https://cdn.jsdelivr.net/npm/react@19.3.1/+esm'];
    assert.ok(
      mapped === undefined || mapped === 'https://cdn.jsdelivr.net/npm/react@19.3.1/+esm',
      `a pinned version must not be rewritten to @latest (got ${mapped})`
    );
  });


  console.log('\n--- Suite D: Service Worker Bridge ---');

  await test('D1 _handleServiceWorkerMessage dispatches via the port table and replies', async () => {
    const wb = workbenchWithServer('m3-sw', 3000, '<html><head><title>SW</title></head><body>Served via SW</body></html>');
    let reply = null;
    const replyPort = { postMessage: (data) => { reply = data; } };
    await wb._handleServiceWorkerMessage({
      data: { type: 'CODELAB_SW_DISPATCH', port: 3000, url: 'http://127.0.0.1:3000/', method: 'GET', headers: {} },
      ports: [replyPort]
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(reply, 'the workbench should reply on the message channel');
    assert.equal(reply.status, 200);
    assert.match(reply.body, /Served via SW/);
    assert.ok(reply.headers && /text\/html/i.test(reply.headers['content-type'] || reply.headers['Content-Type'] || ''), 'content-type header should round-trip');
  });

  await test('D2 _handleServiceWorkerMessage ignores unrelated messages', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-sw-ignore', files: { 'index.js': '' } });
    let replied = false;
    await wb._handleServiceWorkerMessage({ data: { type: 'SOMETHING_ELSE' }, ports: [{ postMessage: () => { replied = true; } }] });
    assert.equal(replied, false);
  });

  await test('D3 preview falls back gracefully when the port has no listener', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'm3-fallback', files: { 'index.js': '' } });
    // No server registered on 3999.
    await wb._openWebPreview(3999);
    const iframe = wb.container.querySelector('#cl-preview-iframe');
    const srcdoc = iframe.getAttribute('srcdoc') || '';
    assert.match(srcdoc, /Preview unavailable/i);
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`M3 Web Preview Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) {
      console.log(`- ${f.name}: ${f.err && f.err.message ? f.err.message : f.err}`);
    }
  }

  // The suite leaves a virtual server registration behind. Node exits anyway,
  // but Bun keeps the event loop alive, so the runner would hang after a green
  // run. Exit explicitly once the summary is written.
  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
