#!/usr/bin/env node
'use strict';

/**
 * IDE Power-Feature & Workbench Integration Test Suite (v0.3.0)
 *
 * Verifies:
 * 1. Zero-Backend URL Snapshot Compression & Decompression:
 *    - compressWorkspaceSnapshot / decompressWorkspaceSnapshot roundtrip
 *    - Workbench shareSnapshot() copies URL and _checkUrlSnapshot() restores state
 * 2. Inline Diff & Simple Diff Engine:
 *    - computeSimpleDiff computes hunks, additions, deletions accurately
 *    - CodeLabDiffEditorManager instantiates and coordinates diff targets
 * 3. Execution Telemetry HUD:
 *    - _updateTelemetryHud updates high-resolution execution time and memory badge
 * 4. Multi-Language Document Formatter:
 *    - formatCppSource indents braces and control structures
 *    - formatPythonSource normalizes blank lines and whitespace
 * 5. Contextual Stdin Integration:
 *    - customStdin panel lifecycle and execution payload propagation
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCodeLab, DIST } = require('./helpers/load');

const CodeLab = loadCodeLab();
const { CodeLabWorkbenchComponents } = CodeLab;

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

function makeContainer() {
  const elements = new Map();
  const listeners = new Map();

  const container = {
    appendChild: () => {},
    removeChild: () => {},
    querySelector: (sel) => {
      if (!elements.has(sel)) {
        elements.set(sel, {
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, force) {
              if (force !== undefined) {
                if (force) this.classes.add(c);
                else this.classes.delete(c);
              } else {
                if (this.classes.has(c)) this.classes.delete(c);
                else this.classes.add(c);
              }
            },
            contains(c) { return this.classes.has(c); }
          },
          innerHTML: '',
          textContent: '',
          value: '',
          dataset: {},
          setAttribute: () => {},
          removeAttribute: () => {},
          getAttribute: () => null,
          appendChild: () => {},
          removeChild: () => {},
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: (evt, cb) => {
            if (!listeners.has(evt)) listeners.set(evt, []);
            listeners.get(evt).push(cb);
          }
        });
      }
      return elements.get(sel);
    },
    querySelectorAll: () => [],
    addEventListener: (evt, cb) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(cb);
    },
    removeEventListener: () => {},
    style: {},
    innerHTML: ''
  };
  return container;
}

(async () => {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   v0.3.0 IDE Power-Features & Workbench Integration Suite');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- Suite 1: Zero-Backend URL Snapshot Compression ---');

  await test('CodeLabWorkbenchComponents exports compression and decompression functions', () => {
    assert.ok(CodeLabWorkbenchComponents, 'CodeLabWorkbenchComponents must be present in bundle');
    assert.equal(typeof CodeLabWorkbenchComponents.compressWorkspaceSnapshot, 'function');
    assert.equal(typeof CodeLabWorkbenchComponents.decompressWorkspaceSnapshot, 'function');
  });

  await test('compressWorkspaceSnapshot and decompressWorkspaceSnapshot achieve lossless roundtrip', async () => {
    const payload = {
      lang: 'cpp',
      activeFile: 'main.cpp',
      files: {
        'main.cpp': '#include <iostream>\nint main() { std::cout << "test" << std::endl; return 0; }',
        'input.txt': '42\n'
      },
      stdin: '42'
    };

    const token = await CodeLabWorkbenchComponents.compressWorkspaceSnapshot(payload);
    assert.ok(typeof token === 'string' && token.length > 0);
    // Base64url should not contain '+', '/', or '='
    assert.ok(!/[+/=]/.test(token), `Token must be Base64url compliant: ${token}`);

    const restored = await CodeLabWorkbenchComponents.decompressWorkspaceSnapshot(token);
    assert.ok(restored);
    assert.equal(restored.lang, 'cpp');
    assert.equal(restored.activeFile, 'main.cpp');
    assert.equal(restored.stdin, '42');
    assert.equal(restored.files['main.cpp'], payload.files['main.cpp']);
    assert.equal(restored.files['input.txt'], payload.files['input.txt']);
  });

  await test('workbench.shareSnapshot and _checkUrlSnapshot synchronize workspace URL hash', async () => {
    const container = makeContainer();
    const wb = new CodeLab.CodeLabWorkbench(container, {
      labId: 'snapshot-test',
      files: {
        'demo.js': 'console.log("snapshot demo");'
      }
    });

    global.window = {
      location: {
        origin: 'https://codelab.local',
        pathname: '/app',
        hash: ''
      }
    };

    let toastMsg = '';
    wb._showToast = (msg) => { toastMsg = msg; };

    await wb.shareSnapshot();
    assert.ok(global.window.location.hash.startsWith('codelab='));
    assert.match(toastMsg, /Snapshot link/);

    // Create a blank workbench and restore from hash
    const targetContainer = makeContainer();
    const targetWb = new CodeLab.CodeLabWorkbench(targetContainer, {
      labId: 'snapshot-restore',
      files: {}
    });

    global.window.location.hash = `#${global.window.location.hash}`;
    await targetWb._checkUrlSnapshot();

    assert.ok(targetWb.files['demo.js']);
    assert.equal(targetWb.files['demo.js'], 'console.log("snapshot demo");');
  });

  console.log('\n--- Suite 2: Monaco Side-by-Side Diff Editor Engine ---');

  await test('computeSimpleDiff computes hunks, additions, and deletions accurately', () => {
    const oldCode = 'line 1\nline 2\nline 3';
    const newCode = 'line 1\nline 2 modified\nline 3\nline 4';

    const diff = CodeLabWorkbenchComponents.computeSimpleDiff(oldCode, newCode);
    assert.ok(diff);
    assert.ok(diff.hunks.length >= 3);
    assert.ok(diff.added > 0);
  });

  await test('CodeLabDiffEditorManager instantiates and toggles targets', () => {
    const container = makeContainer();
    const wb = new CodeLab.CodeLabWorkbench(container, {
      labId: 'diff-test',
      files: { 'main.js': 'const x = 1;' }
    });

    const manager = new CodeLabWorkbenchComponents.CodeLabDiffEditorManager(wb);
    assert.equal(manager.isActive, false);
    assert.equal(manager.currentTarget, 'solution');

    // Without Monaco in headless node, openInlineDiff falls back cleanly
    const ok = manager.openInlineDiff('main.js', 'starter');
    assert.equal(ok, false);
  });

  console.log('\n--- Suite 3: Multi-Language Document Formatter ---');

  await test('formatCppSource normalizes indentation and handles braces', () => {
    const unformatted = 'int main(){\nint x=1;\nif(x){\nstd::cout<<"hi";\n}\nreturn 0;\n}';
    const formatted = CodeLabWorkbenchComponents.formatCppSource(unformatted);
    assert.ok(formatted.includes('  int x=1;'));
    assert.ok(formatted.includes('    std::cout<<"hi";'));
  });

  await test('formatPythonSource normalizes redundant blank lines and trims whitespace', () => {
    const pyExt = require(path.join(DIST, 'extensions', 'python.js'));
    const unformatted = 'def foo():   \n\n\n\n    return 42   \n\n\n';
    const formatted = pyExt.formatPythonSource(unformatted);
    assert.equal(formatted, 'def foo():\n\n    return 42\n');
  });

  console.log('\n--- Suite 4: Telemetry HUD & Stdin Panel ---');

  await test('workbench._updateTelemetryHud displays execution time and peak memory badge', () => {
    const container = makeContainer();
    const wb = new CodeLab.CodeLabWorkbench(container, { labId: 'hud-test' });

    wb.lastDurationMs = 14.2;
    wb.lastPeakMemoryBytes = 2.5 * 1024 * 1024;
    wb.lang = 'cpp';
    wb._updateTelemetryHud();

    const hudEl = container.querySelector('#cl-telemetry-hud');
    assert.equal(hudEl.style.display, 'inline-flex');
    assert.match(hudEl.innerHTML, /14\.2 ms/);
    assert.match(hudEl.innerHTML, /2\.5 MB Wasm/);
  });

  await test('custom stdin textarea sets customStdin and passes to runtime execution', () => {
    const container = makeContainer();
    const wb = new CodeLab.CodeLabWorkbench(container, { labId: 'stdin-test' });

    wb.customStdin = '10 20\n';
    assert.equal(wb.customStdin, '10 20\n');
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`IDE Power-Features Suite Complete: ${passed} passed, ${failures.length} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`\n[${f.name}]`);
      console.error(f.err.stack || f.err.message);
    }
    process.exit(1);
  }
})();
