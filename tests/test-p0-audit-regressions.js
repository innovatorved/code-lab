#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Phase 1 Audit — P0 Regression Suite (P0-1 through P0-6)
 *
 * Regression tests for every P0 issue documented in `docs/research/audit.md`:
 *   - P0-1: Inline file/folder create & rename (`startInlineCreate`, `startInlineRename`, F2)
 *   - P0-2: Standalone Python default files & template newline escaping
 *   - P0-3: Public SDK, Custom Element, and `.d.ts` contract parity
 *   - P0-4: Worker VFS mutation sync, partial stream preservation, no main-thread re-run on crash
 *   - P0-5: Preview Service Worker CSP on XHTML/SVG/XML/untyped, 302 navigate isolation, config hardening
 *   - P0-6: Patched dependency versions (`zod` v4, `esbuild` >=0.25, `astro` >=6, no `puppeteer`)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { DOMEvent, doc, localStorageStore } = require('./helpers/mock-dom.js');
const { defineGlobal } = require('./helpers/globals.js');
const loader = require('./helpers/load.js');

const ROOT = loader.ROOT;
const CodeLab = loader.loadCodeLab();
const runtime = loader.runtime;
const shellMod = loader.shell;
const { CodeLabWorkbench } = CodeLab;

function makeContainer(id = 'p0-test-root') {
  localStorageStore.clear();
  const el = doc.createElement('div');
  el.setAttribute('id', id);
  doc.body.appendChild(el);
  return el;
}

function loadPreviewSw({ clients, onDispatch } = {}) {
  const swPath = path.join(ROOT, 'dist', 'preview-sw.js');
  const code = fs.readFileSync(swPath, 'utf8');
  const listeners = {};

  const defaultClient = {
    url: 'https://ide.example.com/workspace',
    postMessage(msg, ports) {
      if (typeof onDispatch === 'function') onDispatch(msg, ports && ports[0]);
    }
  };
  const clientList = Array.isArray(clients) ? clients.slice() : [defaultClient];

  const self = {
    location: { origin: 'https://ide.example.com' },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    skipWaiting() {},
    clients: {
      claim() {},
      matchAll: async () => clientList
    }
  };

  const context = {
    self,
    URL,
    Response,
    Headers,
    MessageChannel,
    Request,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    setTimeout,
    clearTimeout,
    console
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { listeners };
}

async function fireSwFetch(listeners, request) {
  let pending;
  listeners.fetch({
    request,
    respondWith(p) {
      pending = p;
    }
  });
  return pending;
}

(async () => {
  let passed = 0;
  const failures = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      failures.push({ name, err });
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${err && err.message ? err.message : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Phase 1 Audit — P0 Security, Correctness & API Contract Regressions');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ── P0-1: Explorer inline create & rename ──────────────────────────────────
  console.log('--- P0-1: Explorer Inline Create & Rename ---');

  await test('P0-1a startInlineCreate("file") and startInlineCreate("folder") mount inline input without TypeError', () => {
    const container = makeContainer('p0-1a');
    const wb = new CodeLabWorkbench(container, {
      instanceId: 'p0-1a',
      files: { 'index.js': 'console.log(1);\n' }
    });
    assert.equal(typeof wb.startInlineCreate, 'function');
    wb.startInlineCreate('folder', '');
    let inlineInput = container.querySelector('#cl-tree-create-input');
    assert.ok(inlineInput, 'expected #cl-tree-create-input for folder creation');

    inlineInput.value = 'utils';
    inlineInput.dispatchEvent(new DOMEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.ok(wb.folders.has('utils'), 'expected folder "utils" to be created');

    wb.startInlineCreate('file', 'utils');
    inlineInput = container.querySelector('#cl-tree-create-input');
    assert.ok(inlineInput, 'expected #cl-tree-create-input inside utils/');
    inlineInput.value = 'math.js';
    inlineInput.dispatchEvent(new DOMEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.ok(Object.prototype.hasOwnProperty.call(wb.files, 'utils/math.js'), 'expected utils/math.js to exist');
    wb.destroy();
  });

  await test('P0-1b startInlineRename supports both ("file", path) and (path, isFolder) signatures + Enter/Escape', () => {
    const container = makeContainer('p0-1b');
    const wb = new CodeLabWorkbench(container, {
      instanceId: 'p0-1b',
      files: { 'index.js': 'console.log("hi");\n', 'src/helper.js': 'export default 1;\n' }
    });
    assert.equal(typeof wb.startInlineRename, 'function');

    // Escape cancels rename without mutating file
    wb.startInlineRename('file', 'index.js');
    let renameInput = container.querySelector('#cl-tree-rename-input');
    assert.ok(renameInput, 'expected #cl-tree-rename-input when renaming index.js');
    renameInput.value = 'aborted.js';
    renameInput.dispatchEvent(new DOMEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.ok(Object.prototype.hasOwnProperty.call(wb.files, 'index.js'), 'Escape must keep index.js');
    assert.ok(!Object.prototype.hasOwnProperty.call(wb.files, 'aborted.js'), 'Escape must not create aborted.js');

    // Enter commits file rename inside subfolder
    wb.startInlineRename('src/helper.js', false);
    renameInput = container.querySelector('#cl-tree-rename-input');
    assert.ok(renameInput, 'expected #cl-tree-rename-input for src/helper.js');
    renameInput.value = 'renamed.js';
    renameInput.dispatchEvent(new DOMEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.ok(Object.prototype.hasOwnProperty.call(wb.files, 'src/renamed.js'), 'Enter must rename to src/renamed.js');
    assert.ok(!Object.prototype.hasOwnProperty.call(wb.files, 'src/helper.js'), 'old path src/helper.js must be removed');

    // Folder rename moves nested files
    wb.startInlineRename('folder', 'src');
    renameInput = container.querySelector('#cl-tree-rename-input');
    assert.ok(renameInput, 'expected #cl-tree-rename-input for folder src');
    renameInput.value = 'lib';
    renameInput.dispatchEvent(new DOMEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.ok(Object.prototype.hasOwnProperty.call(wb.files, 'lib/renamed.js'), 'folder rename must move lib/renamed.js');
    wb.destroy();
  });

  // ── P0-2: Standalone Python default files & templates ──────────────────────
  console.log('\n--- P0-2: Standalone Python Default Files & Templates ---');

  await test('P0-2a Standalone Python mode initializes valid multi-line main.py and test.py (no literal \\n corruption)', () => {
    const container = makeContainer('p0-2a');
    const wb = new CodeLabWorkbench(container, {
      instanceId: 'p0-2a',
      lang: 'py'
    });
    assert.ok(wb.files['main.py'], 'expected main.py in standalone Python workspace');
    assert.ok(wb.files['test.py'], 'expected test.py in standalone Python workspace');
    assert.ok(wb.files['main.py'].split('\n').length >= 5, 'main.py must contain real newline characters');
    assert.ok(!wb.files['main.py'].includes('-> str:\\n'), 'main.py must not contain double-escaped \\n outside string literals');
    assert.ok(wb.files['test.py'].split('\n').length >= 5, 'test.py must contain real newline characters');

    wb.createFile('extra.py');
    assert.equal(wb.files['extra.py'], '# extra.py\n');
    wb.createFile('README.md');
    assert.equal(wb.files['README.md'], '# README.md\n');
    wb.destroy();
  });

  // ── P0-3: Public SDK, Custom Element & .d.ts Contract Parity ───────────────
  console.log('\n--- P0-3: Public SDK & Custom Element Contract Parity ---');

  await test('P0-3a CodeLabWorkbench implements all public methods documented in d.ts, sample.html & Cloud IDE', async () => {
    const container = makeContainer('p0-3a');
    const wb = new CodeLabWorkbench(container, {
      instanceId: 'p0-3a',
      files: { 'index.js': 'console.log("p0-3a");\n' }
    });

    const requiredMethods = [
      'setTheme',
      'getTheme',
      'runProject',
      'stopExecution',
      'cancelExecution',
      'switchDrawerTab',
      'exportZip',
      'importZip',
      'movePath',
      'promptNewFile',
      'promptNewFolder',
      'toggleWebPreview',
      'runSelectedCode',
      'openCommandPalette',
      'closeCommandPalette'
    ];
    for (const method of requiredMethods) {
      assert.equal(typeof wb[method], 'function', `CodeLabWorkbench.${method} must be a function`);
    }

    wb.setTheme('light');
    assert.equal(wb.getTheme(), 'light');
    assert.equal(container.getAttribute('data-theme'), 'light');

    wb.setTheme('high-contrast');
    assert.equal(wb.getTheme(), 'high-contrast');
    assert.equal(container.getAttribute('data-theme'), 'high-contrast');

    wb.movePath('index.js', 'app/main.js');
    assert.ok(Object.prototype.hasOwnProperty.call(wb.files, 'app/main.js'), 'movePath should relocate index.js to app/main.js');

    const zipBytes = wb.exportZip();
    assert.ok(zipBytes instanceof Uint8Array && zipBytes.byteLength > 20, 'exportZip must return non-empty Uint8Array');

    wb.setFile('extra.txt', 'temp');
    const importedCount = await wb.importZip(zipBytes, { merge: false });
    assert.equal(importedCount, 1, 'importZip should return count of imported files');
    assert.ok(!Object.prototype.hasOwnProperty.call(wb.files, 'extra.txt'), 'importZip with merge:false should replace workspace');
    assert.ok(Object.prototype.hasOwnProperty.call(wb.files, 'app/main.js'), 'importZip should restore app/main.js');

    wb.toggleWebPreview();
    assert.equal(wb.drawerTab, 'preview', 'first toggleWebPreview() should open preview drawer tab');
    wb.toggleWebPreview();
    assert.equal(wb.drawerTab, 'terminal', 'second toggleWebPreview() should return to terminal drawer tab');

    wb.openCommandPalette();
    wb.closeCommandPalette();

    const dts = fs.readFileSync(path.join(ROOT, 'dist', 'code-lab.d.ts'), 'utf8');
    for (const method of ['setTheme(', 'runProject(', 'switchDrawerTab(', 'exportZip(', 'importZip(', 'stopExecution(']) {
      assert.ok(dts.includes(method), `dist/code-lab.d.ts must declare ${method}`);
    }
    wb.destroy();
  });

  // ── P0-4: Worker VFS Sync, Stream Preservation & Crash Guard ───────────────
  console.log('\n--- P0-4: Worker Execution Isolation, Stream Preservation & VFS Sync ---');

  await test('P0-4a executeInWorker syncs VFS writes/deletes (including Uint8Array) back onto options.vfs', async () => {
    const sh = shellMod.createPosixShell({
      files: {
        'old.txt': 'remove-me',
        'keep.txt': 'v1'
      }
    });
    const vfs = sh.vfs;

    const restoreBlob = defineGlobal('Blob', class MockBlob {
      constructor(parts) { this.parts = parts; }
    });
    const origCreateUrl = URL.createObjectURL;
    const origRevokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:codelab-test-p0-4a';
    URL.revokeObjectURL = () => {};

    const restoreWorker = defineGlobal('Worker', class MockWorker {
      postMessage(payload) {
        queueMicrotask(() => {
          if (this.onmessage) {
            this.onmessage({ data: { requestId: payload.requestId, type: 'started' } });
            this.onmessage({ data: { requestId: payload.requestId, type: 'stdout', text: 'worker-line\n' } });
            this.onmessage({
              data: {
                requestId: payload.requestId,
                type: 'complete',
                result: {
                  ok: true,
                  exitCode: 0,
                  stdout: 'worker-line\n',
                  stderr: '',
                  testResults: [{ name: 't1', passed: true, durationMs: 1 }],
                  vfsChanges: {
                    createdDirs: ['/workspace/generated'],
                    modifiedFiles: {
                      '/workspace/generated/out.bin': new Uint8Array([0, 255, 42]),
                      '/workspace/keep.txt': new TextEncoder().encode('v2')
                    },
                    deletedFiles: ['/workspace/old.txt']
                  }
                }
              }
            });
          }
        });
      }
      terminate() {}
    });

    try {
      const res = await runtime.executeInWorker({
        code: 'console.log("worker-line")',
        entry: 'index.js',
        vfs
      });
      assert.equal(res.exitCode, 0);
      assert.equal(res.stdout, 'worker-line\n');
      assert.equal(vfs.existsSync('/workspace/old.txt'), false, 'deleted file must be removed from host VFS');
      assert.equal(vfs.readFileSync('/workspace/keep.txt', 'utf8'), 'v2', 'modified file must update host VFS');
      const bin = vfs.readFileSync('/workspace/generated/out.bin');
      assert.deepEqual(Array.from(bin), [0, 255, 42], 'binary Uint8Array must roundtrip intact');
    } finally {
      if (typeof runtime.destroyWorkerPool === 'function') runtime.destroyWorkerPool();
      restoreWorker();
      restoreBlob();
      URL.createObjectURL = origCreateUrl;
      URL.revokeObjectURL = origRevokeUrl;
    }
  });

  await test('P0-4b executeInWorker preserves partial stdout/stderr/testResults on timeout & crash, and never re-runs crashed code on main thread', async () => {
    const restoreBlob = defineGlobal('Blob', class MockBlob {
      constructor(parts) { this.parts = parts; }
    });
    const origCreateUrl = URL.createObjectURL;
    const origRevokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:codelab-test-p0-4b';
    URL.revokeObjectURL = () => {};

    // 1. Timeout preserves streamed output
    let restoreWorker = defineGlobal('Worker', class HangingWorker {
      postMessage(payload) {
        queueMicrotask(() => {
          if (this.onmessage) {
            this.onmessage({ data: { requestId: payload.requestId, type: 'started' } });
            this.onmessage({ data: { requestId: payload.requestId, type: 'stdout', text: 'before-hang\n' } });
            this.onmessage({
              data: {
                requestId: payload.requestId,
                type: 'test-result',
                testResult: { name: 'passing-before-hang', passed: true, durationMs: 2 }
              }
            });
          }
        });
      }
      terminate() {}
    });

    try {
      const timeoutRes = await runtime.executeInWorker({
        code: 'while(true){}',
        timeoutMs: 20
      });
      assert.equal(timeoutRes.exitCode, 124);
      assert.equal(timeoutRes.timedOut, true);
      assert.equal(timeoutRes.stdout, 'before-hang\n', 'partial stdout must survive worker timeout');
      assert.equal(timeoutRes.testResults.length, 1, 'partial testResults must survive worker timeout');
    } finally {
      if (typeof runtime.destroyWorkerPool === 'function') runtime.destroyWorkerPool();
      restoreWorker();
    }

    // 2. Crash AFTER 'started' must NOT re-execute code on the main thread
    let mainThreadSideEffect = 0;
    globalThis.__p04bSideEffect = () => { mainThreadSideEffect++; };
    restoreWorker = defineGlobal('Worker', class CrashingWorker {
      postMessage(payload) {
        queueMicrotask(() => {
          if (this.onmessage) {
            this.onmessage({ data: { requestId: payload.requestId, type: 'started' } });
            this.onmessage({ data: { requestId: payload.requestId, type: 'stdout', text: 'partial-before-crash\n' } });
          }
          queueMicrotask(() => {
            if (this.onerror) this.onerror({ message: 'RangeError: Maximum call stack size exceeded' });
          });
        });
      }
      terminate() {}
    });

    try {
      const crashRes = await runtime.executeInWorker({
        code: 'globalThis.__p04bSideEffect();'
      });
      assert.equal(crashRes.exitCode, 1);
      assert.equal(mainThreadSideEffect, 0, 'crashed worker code MUST NOT re-run on the main UI thread');
      assert.equal(crashRes.stdout, 'partial-before-crash\n', 'partial stdout before worker crash must be preserved');
      assert.match(crashRes.stderr, /Maximum call stack size exceeded/);
    } finally {
      delete globalThis.__p04bSideEffect;
      if (typeof runtime.destroyWorkerPool === 'function') runtime.destroyWorkerPool();
      restoreWorker();
      restoreBlob();
      URL.createObjectURL = origCreateUrl;
      URL.revokeObjectURL = origRevokeUrl;
    }
  });

  // ── P0-5: Preview Service Worker Security Hardening ────────────────────────
  console.log('\n--- P0-5: Preview Service Worker Security Hardening ---');

  await test('P0-5a SVG, XHTML, XML, and untyped responses receive CSP + X-Content-Type-Options: nosniff', async () => {
    const cases = [
      { mime: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' },
      { mime: 'application/xhtml+xml', body: '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>ok</body></html>' },
      { mime: 'text/xml', body: '<?xml version="1.0"?><root/>' },
      { mime: '', body: '<html><script>alert(1)</script></html>' }
    ];

    for (const c of cases) {
      const headers = c.mime ? { 'Content-Type': c.mime } : {};
      const { listeners } = loadPreviewSw({
        onDispatch: (_msg, replyPort) => {
          replyPort.postMessage({ status: 200, statusText: 'OK', headers, body: c.body });
        }
      });
      const res = await fireSwFetch(listeners, new Request('https://ide.example.com/__preview/3000/payload'));
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', `missing nosniff for mime="${c.mime}"`);
      const csp = res.headers.get('content-security-policy');
      assert.ok(csp && csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'self'"), `expected CSP header for mime="${c.mime}", got: ${csp}`);
      if (c.mime === 'application/xhtml+xml') {
        const html = await res.text();
        assert.ok(html.includes('<base href="/__preview/3000/">'), 'XHTML must receive <base> injection');
      }
    }
  });

  await test('P0-5b Top-level navigate requests via Referer fallback 302-redirect into /__preview/:port/...', async () => {
    const { listeners } = loadPreviewSw({
      onDispatch: () => {
        throw new Error('navigate Referer fallback must redirect before dispatching outside /__preview/');
      }
    });
    const navReq = {
      url: 'https://ide.example.com/admin/panel?tab=1',
      method: 'GET',
      mode: 'navigate',
      referrer: 'https://ide.example.com/__preview/3000/index.html',
      headers: new Headers()
    };
    const res = await fireSwFetch(listeners, navReq);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://ide.example.com/__preview/3000/admin/panel?tab=1');
  });

  await test('P0-5c codelab:config rejects preview/blob senders and CRLF header-injection payloads', async () => {
    const { listeners } = loadPreviewSw({
      onDispatch: (_msg, replyPort) => {
        replyPort.postMessage({
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html' },
          body: '<html><head></head><body>ok</body></html>'
        });
      }
    });

    // Attempt from a preview iframe client MUST be ignored
    listeners.message({
      source: { url: 'https://ide.example.com/__preview/3000/evil.html' },
      data: { type: 'codelab:config', csp: "default-src * 'unsafe-inline' https://evil.example.com; object-src 'none'" }
    });
    // Attempt from blob: frame MUST be ignored
    listeners.message({
      source: { url: 'blob:https://ide.example.com/1234' },
      data: { type: 'codelab:config', csp: "default-src https://blob-evil.example.com; object-src 'none'" }
    });
    // Attempt with CRLF header injection MUST be rejected
    listeners.message({
      source: { url: 'https://ide.example.com/app' },
      data: { type: 'codelab:config', csp: "default-src 'self'\r\nSet-Cookie: pwn=1" }
    });
    // Valid host configuration MUST apply
    listeners.message({
      source: { url: 'https://ide.example.com/app' },
      data: {
        type: 'codelab:config',
        csp: "default-src 'self'; connect-src 'self' https://api.valid.example.com; object-src 'none'; frame-ancestors 'self'"
      }
    });

    const res = await fireSwFetch(listeners, new Request('https://ide.example.com/__preview/3000/index.html'));
    const csp = res.headers.get('content-security-policy') || '';
    assert.ok(!csp.includes('evil.example.com'), 'preview client must not be able to overwrite configuredCsp');
    assert.ok(!csp.includes('blob-evil.example.com'), 'blob client must not be able to overwrite configuredCsp');
    assert.ok(!csp.includes('Set-Cookie'), 'CRLF header injection must be rejected');
    assert.ok(csp.includes('https://api.valid.example.com'), 'valid host CSP config must apply');
  });

  // ── P0-6: Dependency Vulnerability Remediation Invariants ──────────────────
  console.log('\n--- P0-6: Dependency Security Invariants ---');

  await test('P0-6a Root and Cloud IDE manifests pin patched zod, esbuild, and astro releases', () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const cloudPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'cloud-ide', 'package.json'), 'utf8'));

    const zodSpec = rootPkg.dependencies && rootPkg.dependencies.zod;
    assert.ok(zodSpec && /^\^?4\./.test(zodSpec), `expected zod v4.x in package.json, got ${zodSpec}`);

    const esbuildSpec = rootPkg.devDependencies && rootPkg.devDependencies.esbuild;
    assert.ok(esbuildSpec && /^\^?0\.(?:2[5-9]|[3-9]\d)\./.test(esbuildSpec), `expected esbuild >=0.25 in package.json, got ${esbuildSpec}`);

    const astroSpec = cloudPkg.dependencies && cloudPkg.dependencies.astro;
    assert.ok(astroSpec && /^\^?[6-9]\./.test(astroSpec), `expected astro >=6 in examples/cloud-ide/package.json, got ${astroSpec}`);
    assert.ok(
      !cloudPkg.devDependencies || !cloudPkg.devDependencies.puppeteer,
      'unused vulnerable puppeteer devDependency must remain removed from examples/cloud-ide'
    );
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`P0 Audit Regressions Complete: ${passed} passed, ${failures.length} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`\n[${f.name}]`);
      console.error(f.err && (f.err.stack || f.err.message || f.err));
    }
    process.exit(1);
  }
})();
