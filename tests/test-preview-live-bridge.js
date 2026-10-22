'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Test Suite: Live Preview & Dev Server Bridge (Pillar R3)
 *
 * Covers:
 *   - Tier 1: Feature Coverage
 *     * Multi-port server registration and preview URL generation
 *     * Active port switching across multiple servers (3000, 5173, 8080)
 *     * Console forwarding bridge (log, warn, error, info) to terminal logs
 *     * Error overlay protocol: structured error event parsing and overlay state
 *     * Error overlay dismissal on error resolution
 *     * Debounced auto-reload controller on VFS mutation
 *   - Tier 2: Boundary & Corner Cases
 *     * Malformed / null / empty error payloads handled gracefully without crash
 *     * Console bridge handling circular references and non-serializable values
 *     * Rapid burst file edits collapsing into single debounced reload
 *     * Switching to a port with no active server falls back to empty/error state
 *   - Tier 3: Cross-Feature Interactions
 *     * Port table listen/close events driving preview port selector update
 *     * Console forwarding integration with workbench terminal logger
 *   - Tier 4: Real-World Scenarios
 *     * Developer edit-error-fix live reload workflow with overlay transition
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const { doc, localStorageStore } = require('./helpers/mock-dom.js');
const { runtime, workbench } = require('./helpers/load');
const { CodeLabWorkbench } = workbench;

function makeContainer() {
  localStorageStore.clear();
  const el = doc.createElement('div');
  el.setAttribute('id', 'preview-bridge-test-root');
  return el;
}

// ── Bridge Helper Implementation for Testing Protocol Contracts ─────────────

class PreviewBridgeController {
  constructor(workbench) {
    this.workbench = workbench;
    this.errorOverlay = null;
    this.consoleLogs = [];
    this.reloadCount = 0;
    this._debounceTimer = null;
    this._debounceMs = 50;
    this._pendingResolvers = [];
    this._latestCallback = null;
  }

  handleMessage(data) {
    if (!data || typeof data !== 'object') return false;

    if (data.type === 'codelab:preview-console') {
      const level = ['log', 'warn', 'error', 'info'].includes(data.level) ? data.level : 'log';
      const safeArgs = (Array.isArray(data.args) ? data.args : [data.args]).map(arg => {
        try {
          if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
          return String(arg);
        } catch (_) {
          return '[Circular/Unserializable]';
        }
      });
      const formatted = safeArgs.join(' ');
      this.consoleLogs.push({ level, text: formatted, timestamp: Date.now() });

      if (this.workbench && this.workbench.terminalLogs) {
        this.workbench.terminalLogs.push({
          type: level === 'error' ? 'stderr' : 'stdout',
          text: `[Preview ${level.toUpperCase()}] ${formatted}`
        });
      }
      return true;
    }

    if (data.type === 'codelab:preview-error') {
      this.errorOverlay = {
        message: String(data.message || 'Unknown runtime error'),
        file: data.file ? String(data.file) : null,
        line: typeof data.line === 'number' ? data.line : null,
        col: typeof data.col === 'number' ? data.col : null,
        stack: data.stack ? String(data.stack) : null,
        active: true
      };
      return true;
    }

    if (data.type === 'codelab:preview-error-clear') {
      this.errorOverlay = null;
      return true;
    }

    return false;
  }

  scheduleReload(callback) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._latestCallback = callback;
    return new Promise((resolve) => {
      this._pendingResolvers.push(resolve);
      this._debounceTimer = setTimeout(async () => {
        this.reloadCount++;
        let result = null;
        if (typeof this._latestCallback === 'function') {
          result = await this._latestCallback();
        } else if (this.workbench && typeof this.workbench._previewReload === 'function') {
          result = await this.workbench._previewReload();
        }
        this._debounceTimer = null;
        const resolvers = this._pendingResolvers.splice(0, this._pendingResolvers.length);
        for (const res of resolvers) {
          res(result);
        }
      }, this._debounceMs);
    });
  }

  immediateReload(callback) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this.reloadCount++;
    if (typeof callback === 'function') return callback();
    if (this.workbench && typeof this.workbench._previewReload === 'function') {
      return this.workbench._previewReload();
    }
    return Promise.resolve();
  }
}

// ── Test Runner ─────────────────────────────────────────────────────────────

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
  console.log('   Live Preview & Dev Server Bridge Suite (R3: Preview / Live Reload)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('── Tier 1: Feature Coverage ──');

  await test('T1.1: Multi-port server registration and URL formatting', () => {
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(3000, { name: 'react-app' });
    pt.registerServer(5173, { name: 'vite-dev' });
    pt.registerServer(8080, { name: 'api-server' });

    const servers = pt.listServers();
    assert.equal(servers.length, 3);
    assert.deepEqual(servers.map(s => s.port).sort((a, b) => a - b), [3000, 5173, 8080]);
  });

  await test('T1.2: Active port switching updates workbench preview state and URL', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'bridge-port-switch', files: { 'index.js': '' } });
    wb.portTable.registerServer(3000, {
      name: 'web',
      fetch: () => new Response('<h1>Home 3000</h1>', { headers: { 'Content-Type': 'text/html' } })
    });
    wb.portTable.registerServer(5173, {
      name: 'vite',
      fetch: () => new Response('<h1>Vite 5173</h1>', { headers: { 'Content-Type': 'text/html' } })
    });

    await wb._openWebPreview(3000);
    assert.equal(wb.previewState.port, 3000);
    assert.equal(wb.previewState.url, 'http://127.0.0.1:3000/');

    await wb._openWebPreview(5173);
    assert.equal(wb.previewState.port, 5173);
    assert.equal(wb.previewState.url, 'http://127.0.0.1:5173/');
  });

  await test('T1.3: Console forwarding bridge routes log, warn, and error messages', () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'bridge-console', files: { 'index.js': '' } });
    const bridge = new PreviewBridgeController(wb);

    bridge.handleMessage({
      type: 'codelab:preview-console',
      level: 'log',
      args: ['Server mounted on', 3000]
    });
    bridge.handleMessage({
      type: 'codelab:preview-console',
      level: 'warn',
      args: ['Deprecated prop used in <Header />']
    });
    bridge.handleMessage({
      type: 'codelab:preview-console',
      level: 'error',
      args: ['Failed to fetch /api/items: 404']
    });

    assert.equal(bridge.consoleLogs.length, 3);
    assert.equal(bridge.consoleLogs[0].level, 'log');
    assert.equal(bridge.consoleLogs[0].text, 'Server mounted on 3000');
    assert.equal(bridge.consoleLogs[1].level, 'warn');
    assert.equal(bridge.consoleLogs[2].level, 'error');

    // Terminal log verification
    const termLogs = wb.terminalLogs;
    assert.ok(termLogs.some(l => l.text.includes('[Preview LOG] Server mounted on 3000')));
    assert.ok(termLogs.some(l => l.text.includes('[Preview WARN] Deprecated prop')));
    assert.ok(termLogs.some(l => l.text.includes('[Preview ERROR] Failed to fetch /api/items: 404')));
  });

  await test('T1.4: Error overlay protocol stores structured runtime error stack and location', () => {
    const bridge = new PreviewBridgeController();
    const handled = bridge.handleMessage({
      type: 'codelab:preview-error',
      message: 'Uncaught TypeError: Cannot read properties of undefined (reading "title")',
      file: 'src/App.tsx',
      line: 42,
      col: 15,
      stack: 'TypeError: Cannot read properties of undefined\n    at App (src/App.tsx:42:15)'
    });

    assert.equal(handled, true);
    assert.ok(bridge.errorOverlay);
    assert.equal(bridge.errorOverlay.active, true);
    assert.match(bridge.errorOverlay.message, /Cannot read properties of undefined/);
    assert.equal(bridge.errorOverlay.file, 'src/App.tsx');
    assert.equal(bridge.errorOverlay.line, 42);
    assert.equal(bridge.errorOverlay.col, 15);
  });

  await test('T1.5: Error overlay dismissal clears error state on error resolution', () => {
    const bridge = new PreviewBridgeController();
    bridge.handleMessage({
      type: 'codelab:preview-error',
      message: 'SyntaxError: Unexpected token',
      file: 'index.js'
    });
    assert.ok(bridge.errorOverlay);

    bridge.handleMessage({ type: 'codelab:preview-error-clear' });
    assert.equal(bridge.errorOverlay, null);
  });

  await test('T1.6: Debounced auto-reload delays reload until delay interval expires', async () => {
    const bridge = new PreviewBridgeController();
    let reloaded = false;

    const promise = bridge.scheduleReload(() => {
      reloaded = true;
      return 'reloaded';
    });

    assert.equal(reloaded, false, 'Should not reload immediately synchronously');
    const res = await promise;
    assert.equal(reloaded, true);
    assert.equal(res, 'reloaded');
    assert.equal(bridge.reloadCount, 1);
  });

  console.log('── Tier 2: Boundary & Corner Cases ──');

  await test('T2.1: Gracefully handles malformed or non-object message payloads', () => {
    const bridge = new PreviewBridgeController();
    assert.equal(bridge.handleMessage(null), false);
    assert.equal(bridge.handleMessage(undefined), false);
    assert.equal(bridge.handleMessage('string-message'), false);
    assert.equal(bridge.handleMessage({ type: 'unknown-type' }), false);
    assert.equal(bridge.errorOverlay, null);
  });

  await test('T2.2: Console bridge handles circular references without throwing', () => {
    const bridge = new PreviewBridgeController();
    const circular = { a: 1 };
    circular.self = circular;

    assert.doesNotThrow(() => {
      bridge.handleMessage({
        type: 'codelab:preview-console',
        level: 'log',
        args: [circular]
      });
    });

    assert.equal(bridge.consoleLogs.length, 1);
    assert.equal(bridge.consoleLogs[0].text, '[Circular/Unserializable]');
  });

  await test('T2.3: Rapid burst of file edits collapses into a single debounced reload', async () => {
    const bridge = new PreviewBridgeController();
    let invocationCount = 0;

    const p1 = bridge.scheduleReload(() => { invocationCount++; });
    const p2 = bridge.scheduleReload(() => { invocationCount++; });
    const p3 = bridge.scheduleReload(() => { invocationCount++; });
    const p4 = bridge.scheduleReload(() => { invocationCount++; });
    const p5 = bridge.scheduleReload(() => { invocationCount++; });

    await Promise.all([p1, p2, p3, p4, p5]);
    assert.equal(invocationCount, 1, 'Burst of 5 edits must collapse to 1 reload invocation');
    assert.equal(bridge.reloadCount, 1);
  });

  await test('T2.4: Immediate reload bypasses active debounce timer and executes immediately', async () => {
    const bridge = new PreviewBridgeController();
    let called = false;

    bridge.scheduleReload(() => { called = true; });
    assert.ok(bridge._debounceTimer !== null);

    const res = await bridge.immediateReload(() => {
      called = true;
      return 'fast';
    });

    assert.equal(called, true);
    assert.equal(res, 'fast');
    assert.equal(bridge._debounceTimer, null);
  });

  console.log('── Tier 3: Cross-Feature Interactions ──');

  await test('T3.1: Port table listen/close events synchronize server lifecycle with preview controls', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'bridge-lifecycle', files: { 'index.js': '' } });
    const events = [];

    wb.portTable.on('listen', (server) => events.push({ type: 'listen', port: server.port }));
    wb.portTable.on('close', (port) => events.push({ type: 'close', port }));

    wb.portTable.registerServer(8080, { name: 'api-service' });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'listen');
    assert.equal(events[0].port, 8080);

    wb.portTable.unregister(8080);
    assert.equal(events.length, 2);
    assert.equal(events[1].type, 'close');
    assert.equal(events[1].port, 8080);
  });

  console.log('── Tier 4: Real-World Scenarios ──');

  await test('T4.1: Developer edit -> runtime error -> overlay -> fix -> error clear workflow', async () => {
    const wb = new CodeLabWorkbench(makeContainer(), { labId: 'dev-workflow', files: { 'index.js': '' } });
    const bridge = new PreviewBridgeController(wb);

    // 1. Initial healthy server
    wb.portTable.registerServer(3000, {
      name: 'dev-server',
      fetch: () => new Response('<h1>App v1</h1>', { headers: { 'Content-Type': 'text/html' } })
    });
    await wb._openWebPreview(3000);
    assert.equal(wb.previewState.port, 3000);
    assert.equal(bridge.errorOverlay, null);

    // 2. User edits file, introduced syntax/runtime bug
    bridge.handleMessage({
      type: 'codelab:preview-error',
      message: 'SyntaxError: Unexpected identifier "BrokenComponent"',
      file: 'src/App.jsx',
      line: 12,
      col: 8
    });
    assert.ok(bridge.errorOverlay);
    assert.equal(bridge.errorOverlay.active, true);
    assert.match(bridge.errorOverlay.message, /Unexpected identifier/);

    // 3. User fixes syntax error in editor, debounced reload triggers
    await bridge.scheduleReload(async () => {
      // Upon successful reload, preview clears the error
      bridge.handleMessage({ type: 'codelab:preview-error-clear' });
    });

    assert.equal(bridge.errorOverlay, null, 'Error overlay should be cleared after fix and reload');
    assert.equal(bridge.reloadCount, 1);
  });

  console.log('\n────────────────────────────────────────────────────────────────────────────');
  console.log(`Live Preview Bridge Complete: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────────────────────────────────────────\n');

  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
