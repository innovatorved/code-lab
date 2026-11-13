#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Phase 1 Audit — P1 & P2 Regression Suite (P1-2..P1-14, P2-1..P2-6)
 *
 * Regression tests verifying every P1 and P2 fix from `docs/research/audit.md`:
 *   - P1-2: Inline Diff Editor syncs edits/Revert/Apply to VFS, model, fallback & savedState
 *   - P1-3: HTTP Client HTML response iframe uses opaque `sandbox=""`, Monaco worker URL JSON-escaped
 *   - P1-4: Multi-instance Monaco model URI isolation (`instanceId`), FD leak cleanup, `destroy()` cleanup
 *   - P1-5: Debounced keystroke persistence + `flushState()`, compact `sd_codelab_` mirror, IDB hydration
 *   - P1-6: Network filter `#cl-net-search` updates `#cl-net-tbody` in-place without losing input focus
 *   - P1-7: Preview server binary `Uint8Array` asset passthrough & `</script>` importmap escaping
 *   - P1-8: Honest `pip` offline error when Python toolchain absent & Pyodide `<script>` dedup
 *   - P1-9: C++ string/comment/raw-string-aware brace delimiter check
 *   - P1-10: Shell `stdin`/`env`/`cwd` forwarding to `node` and `bun` (`fs.readFileSync(0)`)
 *   - P1-11: `curl` and `hey` route external non-loopback URLs to `fetch` / `fetchImpl`
 *   - P1-12: `transpileTS` nested `${...}` type stripping, nested callback `(...)` types, `export function*`, destructured `export const`, `SqliteDatabase` quote-aware `exec` + `transaction` rollback
 *   - P1-13: PTY `readLine()` resolves `null` on `Ctrl+C`, `AbortSignal`, and `destroy()`
 *   - P1-14: `mock-dom` single-quote attribute selector parsing (`[attr='value']`)
 *   - P2-3: Bounded shell `history`/`jobs` and PTY `history` ring buffers
 *   - P2-4: `CL_ICONS.layout`/`maximize` defined & `_toggleMarkdownTask` syncs via `writeFileSync`
 *   - P2-5: Light/High-Contrast `[data-cl-theme]` CSS rules + Monaco marker → `DiagnosticsStore` sync
 *   - P2-6: Binary (`\x00`) and large (`> 2 MB`) file guard with "Open File Anyway" override
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { DOMEvent, doc, localStorageStore } = require('./helpers/mock-dom.js');
const { defineGlobal } = require('./helpers/globals.js');
const loader = require('./helpers/load.js');

const ROOT = loader.ROOT;
const CodeLab = loader.loadCodeLab();
const runtime = loader.runtime;
const shellMod = loader.shell;
const terminalMod = loader.terminal;
const { CodeLabWorkbench } = CodeLab;

function makeContainer(id = 'p1-test-root') {
  localStorageStore.clear();
  const el = doc.createElement('div');
  el.setAttribute('id', id);
  doc.body.appendChild(el);
  return el;
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
  console.log('   Phase 1 Audit — P1 & P2 Correctness, Security & Lifecycle Regressions');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ── P1-14: mock-dom single-quote attribute selector ────────────────────────
  await test('P1-14 mock-dom matches single-quoted attribute selectors [data-x=\'val\']', () => {
    const rootEl = makeContainer('p1-14-root');
    rootEl.innerHTML = `<button data-action='run-query' data-dialect="postgres">Run</button>`;
    const hit = rootEl.querySelector("[data-action='run-query']");
    assert.ok(hit, 'Expected single-quoted attribute selector to match');
    assert.equal(hit.getAttribute('data-dialect'), 'postgres');
  });

  // ── P1-3: Opaque HTTP Client response iframe sandbox & JSON-escaped Monaco worker
  await test('P1-3 HTTP client HTML preview uses opaque sandbox="" (never allow-same-origin)', () => {
    const el = makeContainer('p1-3-root');
    const wb = new CodeLabWorkbench(el, {
      id: 'p1-3-http-sandbox',
      files: { 'index.js': 'console.log(1);\n' }
    });
    wb.httpClientState.lastResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      body: '<html><body><script>parent.hacked=1</script><h1>Hello</h1></body></html>',
      durationMs: 2
    };
    wb.httpClientState.activeResponseTab = 'preview';
    wb.drawerTab = 'ports';
    wb._renderDrawerBody();
    const iframe = el.querySelector('.codelab-response-iframe');
    assert.ok(iframe, 'Expected .codelab-response-iframe to render');
    assert.equal(iframe.getAttribute('sandbox'), '', 'Response preview iframe must have opaque sandbox=""');
    wb.destroy();
  });

  // ── P1-4: Multi-instance Monaco model URI isolation + FD leak cleanup + destroy()
  await test('P1-4 Two workbenches sharing labId isolate Monaco model URIs by instanceId and clean up on destroy()', () => {
    const prevMonaco = globalThis.monaco;
    const modelRegistry = new Map();
    const fakeMonaco = {
      Uri: {
        parse(raw) {
          return { toString: () => raw, path: raw };
        }
      },
      editor: {
        getModel(uri) {
          return modelRegistry.get(uri.toString()) || null;
        },
        createModel(val, lang, uri) {
          const key = uri.toString();
          let current = val;
          const m = {
            uri,
            language: lang,
            getValue: () => current,
            setValue: (next) => { current = next; },
            onDidChangeContent: () => ({ dispose() {} }),
            dispose: () => {
              modelRegistry.delete(key);
            }
          };
          modelRegistry.set(key, m);
          return m;
        },
        getModelMarkers() {
          return [];
        }
      }
    };
    defineGlobal('monaco', fakeMonaco);
    try {
      const c1 = makeContainer('p1-4-a');
      const c2 = makeContainer('p1-4-b');
      const wb1 = new CodeLabWorkbench(c1, { id: 'shared-lab', files: { 'index.js': 'const a = 1;' } });
      const wb2 = new CodeLabWorkbench(c2, { id: 'shared-lab', files: { 'index.js': 'const b = 2;' } });
      wb1.monaco = fakeMonaco;
      wb2.monaco = fakeMonaco;
      const m1 = wb1._getOrCreateModel('index.js');
      const m2 = wb2._getOrCreateModel('index.js');
      assert.notEqual(m1.uri.toString(), m2.uri.toString(), 'Model URIs must be isolated per workbench instance');
      assert.equal(m1.getValue(), 'const a = 1;');
      assert.equal(m2.getValue(), 'const b = 2;');

      wb1.files['extra.js'] = 'export default 1;';
      wb1._getOrCreateModel('extra.js');
      assert.equal(wb1.models.has('extra.js'), true);
      delete wb1.files['extra.js'];
      wb1._syncAllModels();
      assert.equal(wb1.models.has('extra.js'), false, 'Stale model should be disposed and removed');

      wb1.destroy();
      wb2.destroy();
      assert.equal(modelRegistry.size, 0, 'All models must be disposed after destroy()');
    } finally {
      defineGlobal('monaco', prevMonaco);
    }
  });

  await test('P1-4b Virtual FS cleans up leaked open file descriptors after runtime execution', async () => {
    const vfs = runtime.createVirtualFs({ '/workspace/data.txt': 'hello' });
    const res = await runtime.executeInVirtualRuntime({
      entry: '/workspace/leak.js',
      files: {
        '/workspace/data.txt': 'hello',
        '/workspace/leak.js': `
          const fs = require('fs');
          const fd = fs.openSync('/workspace/data.txt', 'r');
          console.log('opened fd', fd);
        `
      },
      vfs
    });
    assert.equal(res.ok, true);
    assert.deepEqual(vfs._listOpenFds(), [], 'Leaked FDs opened during a run must be closed automatically');
  });

  // ── P1-2: Diff editor synchronization ──────────────────────────────────────
  await test('P1-2 CodeLabDiffEditorManager syncFileToWorkbench updates files, VFS, fallback & savedState', () => {
    const el = makeContainer('p1-2-root');
    const wb = new CodeLabWorkbench(el, {
      id: 'p1-2-diff',
      starterFiles: { 'app.js': 'const v = 1;\n' },
      solutionFiles: { 'app.js': 'const v = 42;\n' },
      steps: [{ id: 's1', title: 'Step 1', instructions: 'Set v = 42' }]
    });
    const DiffCls = CodeLab.CodeLabWorkbenchComponents && CodeLab.CodeLabWorkbenchComponents.CodeLabDiffEditorManager;
    assert.ok(DiffCls, 'Expected CodeLabDiffEditorManager to be exposed');
    const mgr = new DiffCls(wb);
    mgr.syncFileToWorkbench('app.js', 'const v = 99;\n');
    assert.equal(wb.files['app.js'], 'const v = 99;\n');
    assert.equal(wb.shell.vfs.readFileSync('/workspace/app.js', 'utf8'), 'const v = 99;\n');
    assert.equal(wb.savedState.customFiles[`${wb.mode}:${wb.lang}`]['app.js'], 'const v = 99;\n');
    wb.destroy();
  });

  // ── P1-5: Debounced keystroke save, flushState, compact sd_codelab_ mirror ─
  await test('P1-5 Keystroke input debounces localStorage writes, flushState() commits immediately, and sd_codelab_ omits full customFiles', () => {
    const el = makeContainer('p1-5-root');
    const wb = new CodeLabWorkbench(el, {
      id: 'p1-5-save',
      files: { 'main.js': 'let x = 1;\n' }
    });
    const fallback = el.querySelector('#cl-fallback-editor');
    assert.ok(fallback, 'Expected fallback editor');
    fallback.value = 'let x = 2;\n';
    fallback.dispatchEvent(new DOMEvent('input', { bubbles: true }));
    assert.equal(wb.files['main.js'], 'let x = 2;\n');
    assert.ok(wb._saveDebounceTimer, 'Expected debounce timer to be scheduled on keystroke input');
    wb.flushState();
    assert.equal(wb._saveDebounceTimer, null, 'flushState() must clear pending timer and write synchronously');
    const stored = JSON.parse(localStorageStore.get(wb._storageKey()));
    assert.equal(stored.customFiles['sandbox:js']['main.js'], 'let x = 2;\n');
    const mirror = JSON.parse(localStorageStore.get('sd_codelab_p1-5-save'));
    assert.equal(mirror.customFiles, undefined, 'Compact sd_codelab_ mirror must not duplicate full file contents');
    wb.destroy();
  });

  // ── P1-6: Network filter search preserves input element identity & focus ───
  await test('P1-6 Typing in #cl-net-search updates #cl-net-tbody in-place without replacing #cl-net-search', () => {
    const el = makeContainer('p1-6-root');
    const wb = new CodeLabWorkbench(el, {
      id: 'p1-6-net',
      files: { 'index.js': 'console.log(1);\n' }
    });
    wb.lastHttpTrace = [
      { id: '1', method: 'GET', url: '/users', port: 3000, status: 200, durationMs: 4.2, size: 120 },
      { id: '2', method: 'POST', url: '/orders', port: 3000, status: 201, durationMs: 8.1, size: 64 }
    ];
    wb.drawerTab = 'network';
    wb._renderDrawerBody();
    const searchBefore = el.querySelector('#cl-net-search');
    assert.ok(searchBefore, 'Expected #cl-net-search');
    searchBefore.value = '/orders';
    searchBefore.dispatchEvent(new DOMEvent('input', { bubbles: true }));
    const searchAfter = el.querySelector('#cl-net-search');
    assert.equal(searchAfter, searchBefore, '#cl-net-search DOM node must be preserved across input events');
    const tbody = el.querySelector('#cl-net-tbody');
    assert.ok(tbody.innerHTML.includes('/orders'));
    assert.ok(!tbody.innerHTML.includes('/users'));
    wb.destroy();
  });

  // ── P1-7: Preview binary asset Uint8Array serving & importmap </script> escape
  await test('P1-7 Preview serve command returns binary PNG as Uint8Array and escapes </script> in importmap', async () => {
    const shell = shellMod.createPosixShell({ files: {} });
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    shell.vfs.mkdirSync('/workspace/pub', { recursive: true });
    shell.vfs.writeFileSync('/workspace/pub/logo.png', pngBytes);
    shell.vfs.writeFileSync('/workspace/pub/index.html', '<!doctype html><html><head></head><body>Hi</body></html>');
    shell.vfs.writeFileSync('/workspace/package.json', JSON.stringify({
      dependencies: { 'evil</script><script>alert(1)//': '1.0.0' }
    }));
    const serveRes = await shell.execute('serve /workspace/pub --port 4173');
    assert.equal(serveRes.exitCode, 0, serveRes.stderr);

    const imgRes = await shell.portTable.dispatchRequest('http://localhost:4173/logo.png');
    assert.equal(imgRes.status, 200);
    const gotBytes = new Uint8Array(await imgRes.arrayBuffer());
    assert.deepEqual(Array.from(gotBytes), Array.from(pngBytes), 'Binary image bytes must not be UTF-8 mangled');

    const htmlRes = await shell.portTable.dispatchRequest('http://localhost:4173/index.html');
    const htmlStr = typeof htmlRes.text === 'function' ? await htmlRes.text() : String(htmlRes.body);
    assert.ok(!htmlStr.includes('</script><script>alert(1)'), 'Importmap JSON must escape </script> sequences');
  });

  // ── P1-8: Honest pip error when Python toolchain absent ────────────────────
  await test('P1-8 pip install returns non-zero diagnostic when Python runtime is not registered', async () => {
    const shell = shellMod.createPosixShell({ files: {} });
    const res = await shell.execute('pip install requests');
    assert.notEqual(res.exitCode, 0, 'pip install must fail honestly when Python extension is not loaded');
    assert.ok(/Python.*not enabled/i.test(res.stderr), `Unexpected stderr: ${res.stderr}`);
  });

  // ── P1-9: C++ brace checker ignores braces inside comments, strings, raw strings
  await test('P1-9 C++ extension brace scanner ignores unbalanced braces inside comments and string literals', () => {
    const cppExt = CodeLab.extensions && CodeLab.extensions.cpp;
    assert.ok(cppExt, 'Expected CodeLab.extensions.cpp');
    const el = makeContainer('p1-9-root');
    const wb = new CodeLabWorkbench(el, {
      id: 'p1-9-cpp',
      lang: 'cpp',
      files: {
        'main.cpp': [
          '#include <iostream>',
          '// unmatched { in line comment',
          '/* unmatched } in block comment */',
          'int main() {',
          '  const char* s = "hello { world";',
          '  const char* r = R"delim(raw {{{ string)delim";',
          '  std::cout << s << r << "\\n";',
          '  return 0;',
          '}'
        ].join('\n')
      }
    });
    wb.use(cppExt);
    if (typeof wb._cppLintHandler === 'function') {
      wb._cppLintHandler('main.cpp', wb.files['main.cpp']);
    }
    const diags = wb.getDiagnostics().filter(d => d.file === 'main.cpp');
    assert.equal(diags.length, 0, `Expected 0 false-positive brace errors, got: ${JSON.stringify(diags)}`);
    wb.destroy();
  });

  // ── P1-10 & P1-1: Shell stdin/env/cwd forwarding + heredoc + [[ ]] + exit ──
  await test('P1-10 & P1-1 Shell forwards piped stdin/env/cwd to node and supports << heredocs, <<< herestrings, [[ ]], and exit', async () => {
    const shell = shellMod.createPosixShell({
      files: {
        '/workspace/sub/echo-stdin.js': `
          const fs = require('fs');
          const data = fs.readFileSync(0, 'utf8').trim();
          console.log(process.cwd() + '|' + (process.env.GREETING || '') + '|' + data);
        `
      }
    });
    const pipeRes = await shell.execute('cd /workspace/sub && echo "world" | GREETING=hi node echo-stdin.js');
    assert.equal(pipeRes.exitCode, 0, pipeRes.stderr);
    assert.equal(pipeRes.stdout.trim(), '/workspace/sub|hi|world');

    const heredocRes = await shell.execute([
      'cat <<EOF',
      'alpha',
      'beta',
      'EOF'
    ].join('\n'));
    assert.equal(heredocRes.exitCode, 0);
    assert.equal(heredocRes.stdout.trim(), 'alpha\nbeta');

    const condRes = await shell.execute('[[ "postgres" == post* ]] && echo match');
    assert.equal(condRes.exitCode, 0);
    assert.equal(condRes.stdout.trim(), 'match');

    const exitRes = await shell.execute('exit 7');
    assert.equal(exitRes.exitCode, 7);
  });

  // ── P1-11: curl routes external URLs to fetch / fetchImpl ──────────────────
  await test('P1-11 curl routes external https:// URLs through fetchImpl instead of failing with virtual port error', async () => {
    let fetchedUrl = null;
    const shell = shellMod.createPosixShell({
      files: {},
      fetchImpl: async (url) => {
        fetchedUrl = String(url);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });
    const res = await shell.execute('curl -s https://api.example.com/health');
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(fetchedUrl, 'https://api.example.com/health');
    assert.equal(res.stdout.trim(), '{"ok":true}');
  });

  // ── P1-12 & P2-2: transpileTS nested templates, nested callbacks, export function*, destructured export, SqliteDatabase
  await test('P1-12 & P2-2 transpileTS handles typed ${expr as T}, nested callback types, export function*, destructured exports, and bun:sqlite transaction rollback', async () => {
    const runRes = await runtime.executeInVirtualRuntime({
      entry: '/workspace/mod.ts',
      files: {
        '/workspace/helper.ts': `
          export function* seq(): Generator<number> {
            yield 10;
            yield 20;
          }
          const pair = { alpha: 'A', beta: 'B' };
          export const { alpha, beta } = pair;
        `,
        '/workspace/mod.ts': `
          import { seq, alpha, beta } from './helper';
          import { Database } from 'bun:sqlite';
          const nums = Array.from(seq());
          const msg = \`\${(alpha as string)}-\${(beta as string)}:\${nums.join(',')}\`;
          const db = new Database(':memory:');
          db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT); INSERT INTO items (label) VALUES ('a;b');");
          const tx = db.transaction(() => {
            db.run("INSERT INTO items (label) VALUES (?)", ['temp']);
            throw new Error('boom');
          });
          try { tx(); } catch (err) { void err; }
          const rows = db.query("SELECT label FROM items").all();
          console.log(msg + '|' + rows.map((r: { label: string }) => r.label).join(','));
        `
      }
    });
    assert.equal(runRes.ok, true, runRes.stderr || runRes.error);
    assert.equal(runRes.stdout.trim(), 'A-B:10,20|a;b');
  });

  // ── P1-13 & P2-3: PTY readLine cancellation & bounded history ──────────────
  await test('P1-13 & P2-3 PTY readLine resolves null on Ctrl+C/AbortSignal/destroy() and caps history length', async () => {
    const pty = terminalMod.createPTYTerminalEngine(null, { maxHistory: 5 });
    for (let i = 0; i < 12; i++) {
      pty.buffer = `echo ${i}`;
      pty.submitLine();
    }
    assert.ok(pty.history.length <= 5, `Expected history <= 5, got ${pty.history.length}`);

    const ac = new AbortController();
    const abortedRead = pty.readLine('> ', { signal: ac.signal });
    ac.abort();
    assert.equal(await abortedRead, null, 'Aborted readLine() must resolve to null');

    const sigintRead = pty.readLine('> ');
    pty.handleKeyDown({ key: 'c', ctrlKey: true, preventDefault() {} });
    assert.equal(await sigintRead, null, 'Ctrl+C must resolve pending readLine() with null');

    const pendingOnDestroy = pty.readLine('> ');
    pty.destroy();
    assert.equal(await pendingOnDestroy, null, 'destroy() must resolve pending readLine() with null');
  });

  // ── P2-4, P2-5, P2-6: Markdown task VFS sync, CSS [data-cl-theme], Binary/Large file guard
  await test('P2-4..6 Markdown task checkbox syncs VFS, binary/huge files show safe guard, and CSS has [data-cl-theme] rules', () => {
    const cssText = fs.readFileSync(path.join(ROOT, 'dist', 'code-lab.css'), 'utf8');
    assert.ok(cssText.includes('[data-cl-theme="light"]'), 'dist/code-lab.css must style [data-cl-theme="light"]');
    assert.ok(cssText.includes('[data-cl-theme="high-contrast"]'), 'dist/code-lab.css must style [data-cl-theme="high-contrast"]');
    assert.ok(cssText.includes('.codelab-preview-console__bar'), 'dist/code-lab.css must define .codelab-preview-console__bar');

    const el = makeContainer('p2-guard-root');
    const wb = new CodeLabWorkbench(el, {
      id: 'p2-guard',
      files: {
        'README.md': '- [ ] Ship modular architecture\n',
        'image.bin': 'PNG\x00BINARYDATA',
        'huge.log': 'x'.repeat(2 * 1024 * 1024 + 64)
      }
    });
    wb._toggleMarkdownTask('README.md', 0, true);
    assert.ok(wb.shell.vfs.readFileSync('/workspace/README.md', 'utf8').includes('- [x] Ship modular architecture'));

    wb.openFile('image.bin');
    const emptyEl = el.querySelector('#cl-empty-editor');
    assert.ok(emptyEl.innerHTML.includes('Binary file'), 'Binary file must display non-blocking binary guard');

    wb.openFile('huge.log');
    assert.ok(emptyEl.innerHTML.includes('Open File Anyway'), 'Huge file must display guard with Open File Anyway button');
    wb.destroy();
  });

  console.log(`\n════════════════════════════════════════════════════════════════════════════`);
  console.log(`   P1/P2 Audit Regression Summary: ${passed} passed, ${failures.length} failed`);
  console.log(`════════════════════════════════════════════════════════════════════════════\n`);

  if (failures.length > 0) {
    process.exit(1);
  }
})();
