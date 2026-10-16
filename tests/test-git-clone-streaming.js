'use strict';

/**
 * Regression test: `git clone` must stream progress to the terminal
 * incrementally (via onStdout) instead of dumping everything at the end.
 *
 * Covers the real shell path used by the interactive Terminal & REPL
 * (i.e. src/shell.js -> commands.git -> cmdCtx.onStdout).
 */

const assert = require('node:assert/strict');
const shellModule = require('../src/shell.js');
const runtimeModule = require('../src/runtime.js');

const createVirtualFs = runtimeModule.createVirtualFs || runtimeModule.default.createVirtualFs;

(async () => {
  console.log('Testing `git clone` incremental terminal streaming...');

  const vfs = createVirtualFs();
  const chunks = [];
  let settled = false;

  const mockFetch = async (url) => {
    const u = String(url);
    if (u.includes('/git/trees/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tree: [
            { path: 'README.md', type: 'blob', size: 30 },
            { path: 'src/index.js', type: 'blob', size: 45 },
            { path: 'src/util.js', type: 'blob', size: 40 },
            { path: 'src/deep/nested/file.js', type: 'blob', size: 20 }
          ]
        })
      };
    }
    if (u.includes('api.github.com/repos/')) {
      return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
    }
    if (u.endsWith('.js') || u.endsWith('.md')) {
      // Small artificial delay so ordering/streaming is observable.
      await new Promise((r) => setTimeout(r, 1));
      return { ok: true, status: 200, text: async () => '// file\n' };
    }
    return { ok: false, status: 404, text: async () => 'Not found' };
  };

  const shell = shellModule.createPosixShell({ vfs, fetchImpl: mockFetch });

  const res = await shell.execute('git clone https://github.com/acme/demo-repo.git', {
    onStdout: (chunk) => {
      chunks.push({ chunk, afterResolve: settled });
    }
  });
  settled = true;

  const streamed = chunks.map((c) => c.chunk).join('');

  assert.strictEqual(res.code, 0, res.stderr);
  assert.ok(streamed.includes("Cloning into 'demo-repo'"), 'must stream the "Cloning into" banner');
  assert.ok(streamed.includes('remote: Enumerating objects'), 'must stream the enumerating line');
  assert.ok(/Receiving objects: 100%/.test(streamed), 'must stream the final receiving line');
  assert.ok(chunks.length >= 3, `expected multiple incremental chunks, got ${chunks.length}`);
  assert.ok(
    chunks.every((c) => !c.afterResolve),
    'every chunk must be delivered before the clone promise resolves'
  );

  // Programmatic stdout must remain intact (canonical git lines).
  assert.ok(res.stdout.includes("Cloning into 'demo-repo'"), 'returned stdout keeps canonical output');

  console.log(`✅ git clone streamed ${chunks.length} incremental chunks; all arrived before completion`);
})().catch((err) => {
  console.error('❌ git clone streaming test failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation: an in-flight `git clone` must be interruptible (Ctrl+C) and
// resolve as aborted without leaking fatal/error noise.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Testing `git clone` cancellation via AbortSignal...');

  const vfs = createVirtualFs();
  const ac = new AbortController();

  const hangingFetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/git/trees/')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ tree: [{ path: 'src/index.js', type: 'blob', size: 10 }] })
      });
    }
    if (u.includes('api.github.com/repos/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ default_branch: 'main' }) });
    }
    // File download hangs until the signal aborts, simulating a long clone.
    return new Promise((resolve, reject) => {
      const sig = opts && opts.signal;
      const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      if (!sig) return;
      if (sig.aborted) return onAbort();
      sig.addEventListener('abort', onAbort, { once: true });
    });
  };

  const shell = shellModule.createPosixShell({ vfs, fetchImpl: hangingFetch });

  const clonePromise = shell.execute('git clone https://github.com/acme/hang-repo.git', {
    signal: ac.signal
  });

  await new Promise((r) => setTimeout(r, 25));
  ac.abort('SIGINT');

  const res = await clonePromise;
  assert.ok(
    res.aborted === true || res.exitCode === 130 || res.code === 130,
    `expected an aborted result, got ${JSON.stringify(res)}`
  );
  assert.ok(
    !/fatal: clone cancelled|AbortError/i.test(String(res.stderr || '')),
    'aborted clone must not leak fatal/AbortError text into stderr'
  );

  console.log('✅ git clone aborts cleanly on SIGINT (no orphaned download, no error spam)');
})().catch((err) => {
  console.error('❌ git clone cancellation test failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
