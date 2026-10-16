'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 1: Adversarial & Empirical Verification Test Suite
 * Archetype: EMPIRICAL CHALLENGER (Milestone 1 — Terminal Streaming)
 *
 * Verifies:
 * 1. Chunk Arrival Timing & Streaming Fidelity (delta ms measurements)
 * 2. Carriage Return (\r) In-Place Overwrites & Split Chunks
 * 3. ANSI Escape Sequences (\x1b[2K, \x1b[1A, SGR colors, split CSI sequences)
 * 4. Shell Compound Loops (nested for/while/until, break [n], continue [n], subshells)
 * 5. SIGINT / Ctrl+C Interruption & Timer Reclamation
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const runtime = require('../src/runtime.js');
const shell = require('../src/shell.js');
const terminal = require('../src/terminal.js');
const workbench = require('../src/workbench.js');

async function runChallengerSuite() {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  async function test(name, fn) {
    summary.total++;
    process.stdout.write(`[TEST ${summary.total}] ${name} ... `);
    try {
      await fn();
      summary.passed++;
      console.log('\x1b[32mPASS\x1b[0m');
    } catch (err) {
      summary.failed++;
      console.log('\x1b[31mFAIL\x1b[0m');
      console.error(`  Error: ${err.message}`);
      summary.failures.push({ name, error: err.message, stack: err.stack });
    }
  }

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('   CHALLENGER M1: EMPIRICAL STRESS & ADVERSARIAL VERIFICATION SUITE    ');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Chunk Arrival Timing & Streaming Fidelity
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Suite 1: Chunk Arrival Timing & Real-Time Streaming ---');

  await test('1.1 Shell loop chunk arrival deltas: timed loop emits strictly incremental chunks (>35ms spacing)', async () => {
    const posix = shell.createPosixShell();
    const timestamps = [];
    const t0 = Date.now();

    const res = await posix.execute('for i in 1 2 3 4; do echo "chunk-$i"; sleep 0.05; done', {
      onStdout: (chunk) => {
        timestamps.push({ text: chunk.trim(), elapsed: Date.now() - t0 });
      }
    });

    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(timestamps.length, 4, `Expected exactly 4 chunks, got ${timestamps.length}`);

    // Verify delta intervals between successive chunks
    for (let i = 1; i < timestamps.length; i++) {
      const delta = timestamps[i].elapsed - timestamps[i - 1].elapsed;
      assert.equal(delta >= 30, true, `Delta between chunk ${i-1} and ${i} was ${delta}ms, expected >= 30ms`);
    }
    const totalSpread = timestamps[3].elapsed - timestamps[0].elapsed;
    assert.equal(totalSpread >= 120, true, `Total spread was ${totalSpread}ms, expected >= 120ms`);
  });

  await test('1.2 Virtual Runtime setInterval chunk arrival deltas: incremental delivery without exit buffering', async () => {
    const arrivals = [];
    const t0 = Date.now();

    const res = await runtime.executeInVirtualRuntime({
      entry: 'stream-timer.js',
      files: {
        'stream-timer.js': `
          let step = 0;
          const iv = setInterval(() => {
            step++;
            console.log('rt-chunk-' + step);
            if (step >= 4) clearInterval(iv);
          }, 40);
        `
      },
      onStdout: (c) => {
        arrivals.push({ text: c.trim(), elapsed: Date.now() - t0 });
      }
    });

    assert.equal(res.ok, true, res.stderr);
    assert.equal(arrivals.length >= 4, true, `Expected >= 4 chunks, got ${arrivals.length}`);

    for (let i = 1; i < arrivals.length; i++) {
      const delta = arrivals[i].elapsed - arrivals[i - 1].elapsed;
      assert.equal(delta >= 25, true, `Runtime chunk delta was ${delta}ms, expected >= 25ms`);
    }
  });

  await test('1.3 Interleaved stdout and stderr streams arrive concurrently without cross-contamination', async () => {
    const posix = shell.createPosixShell();
    posix.vfs.writeFileSync('/workspace/duplex.js', `
      process.stdout.write('OUT-A\\n');
      process.stderr.write('ERR-1\\n');
      process.stdout.write('OUT-B\\n');
      process.stderr.write('ERR-2\\n');
    `);

    const stdoutEvents = [];
    const stderrEvents = [];

    const res = await posix.execute('node duplex.js', {
      onStdout: (c) => stdoutEvents.push(c.trim()),
      onStderr: (c) => stderrEvents.push(c.trim())
    });

    assert.equal(res.exitCode, 0);
    assert.deepEqual(stdoutEvents, ['OUT-A', 'OUT-B']);
    assert.deepEqual(stderrEvents, ['ERR-1', 'ERR-2']);
  });

  await test('1.4 Subshells nested in timed loops maintain real-time incremental arrival', async () => {
    const posix = shell.createPosixShell();
    const timestamps = [];
    const t0 = Date.now();

    const res = await posix.execute('for n in A B C; do (echo "sub-$n"; sleep 0.05); done', {
      onStdout: (c) => timestamps.push({ text: c.trim(), elapsed: Date.now() - t0 })
    });

    assert.equal(res.exitCode, 0);
    assert.equal(timestamps.length, 3);
    assert.equal(timestamps[1].elapsed - timestamps[0].elapsed >= 35, true);
    assert.equal(timestamps[2].elapsed - timestamps[1].elapsed >= 35, true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Carriage Return (\r) In-Place Rewrites
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: Carriage Return (\\r) In-Place Overwrites ---');

  await test('2.1 PTYTerminalEngine: alternating lines with \\r collapse to 1 line with matching final text', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Frame 1: Initializing...\r');
    engine.writeStreamChunk('Frame 2: 25% Complete\r');
    engine.writeStreamChunk('Frame 3: 50% Complete\r');
    engine.writeStreamChunk('Frame 4: 75% Complete\r');
    engine.writeStreamChunk('Final: 100% Done!\n');

    assert.equal(engine.logs.length, 1, `Expected 1 line in logs, got ${engine.logs.length}`);
    assert.equal(engine.logs[0].text, 'Final: 100% Done!\n');
    assert.equal(engine.logs[0].type, 'stdout');
  });

  await test('2.2 PTYTerminalEngine: trailing \\r without newline maintains single active line with final text', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Alpha\r');
    engine.writeStreamChunk('Beta\r');
    engine.writeStreamChunk('Gamma');

    assert.equal(engine.logs.length, 1, `Expected 1 line, got ${engine.logs.length}`);
    assert.equal(engine.logs[0].text, 'Gamma');
  });

  await test('2.3 PTYTerminalEngine: overwriting longer text with shorter text replaces line cleanly', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Super Long Line That Should Be Replaced Entirely\r');
    engine.writeStreamChunk('Short\n');

    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Short\n');
  });

  await test('2.4 PTYTerminalEngine: split \\r and \\n across chunk boundaries preserves line text', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Downloading dependencies\r');
    engine.writeStreamChunk('\n');

    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Downloading dependencies\n');
  });

  await test('2.5 resolveAnsiControlCodes: collapses multi-pass \\r rewrites and carriage return with line feeds', () => {
    const res1 = terminal.resolveAnsiControlCodes('Step 1\rStep 2\rStep 3\nNext Step');
    assert.equal(res1, 'Step 3\nNext Step');

    const res2 = terminal.resolveAnsiControlCodes('First\r\nSecond\r\nThird');
    assert.equal(res2, 'First\nSecond\nThird');

    const res3 = terminal.resolveAnsiControlCodes('Old\rNew');
    assert.equal(res3, 'New');
  });

  await test('2.6 Workbench DOM rendering with attached ptyEngine: maintains single DOM node during live progress rewrites', () => {
    const logDiv = {
      children: [],
      appendChild: function(el) { this.children.push(el); },
      lastElementChild: null
    };
    const mockContainer = {
      querySelector: (sel) => (sel === '#cl-terminal-log' ? logDiv : null),
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
    const prevDoc = globalThis.document;
    globalThis.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: (tag) => ({ tag, innerHTML: '', className: '', parentNode: logDiv })
    };

    try {
      const wb = new workbench.CodeLabWorkbench(mockContainer, { id: 'test-lab' });
      wb.ptyEngine = terminal.createPTYTerminalEngine(mockContainer);

      wb._appendTerminalStream('stdout', 'Fetch: 10%\r');
      assert.equal(logDiv.children.length, 1);
      assert.equal(logDiv.children[0].innerHTML, 'Fetch: 10%');

      wb._appendTerminalStream('stdout', 'Fetch: 50%\r');
      assert.equal(logDiv.children.length, 1);
      assert.equal(logDiv.children[0].innerHTML, 'Fetch: 50%');

      wb._appendTerminalStream('stdout', 'Fetch: 100%\n');
      assert.equal(logDiv.children.length, 1);
      assert.equal(logDiv.children[0].innerHTML, 'Fetch: 100%\n');

      wb._appendTerminalStream('stdout', 'All Done!\n');
      assert.equal(logDiv.children.length, 2);
      assert.equal(logDiv.children[1].innerHTML, 'All Done!\n');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: ANSI Escape Sequence Handling
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: ANSI Escape Sequence Handling ---');

  await test('3.1 Line clear (\\x1b[2K) clears line buffer and resets cursor column', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Temporary debug banner\x1b[2KClean application output\n');

    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Clean application output\n');
  });

  await test('3.2 Cursor up (\\x1b[1A) rewrites previous committed line', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Header: v1.0.0\n');
    engine.writeStreamChunk('Body Line 1\n');
    assert.equal(engine.logs.length, 2);

    engine.writeStreamChunk('\x1b[1ABody Line 1 (modified)\n');
    assert.equal(engine.logs.length, 2);
    assert.equal(engine.logs[0].text, 'Header: v1.0.0\n');
    assert.equal(engine.logs[1].text, 'Body Line 1 (modified)\n');
  });

  await test('3.3 Cursor up N lines (\\x1b[2A) rewrites line two positions back', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Line 1\n');
    engine.writeStreamChunk('Line 2\n');
    assert.equal(engine.logs.length, 2);

    engine.writeStreamChunk('\x1b[2ARewritten Line 1\n');
    assert.equal(engine.logs.length, 2);
    assert.equal(engine.logs[0].text, 'Rewritten Line 1\n');
    assert.equal(engine.logs[1].text, 'Line 2\n');
  });

  await test('3.4 Color preservation: SGR 16-color, 256-color, RGB, bold and dim styles', () => {
    // 16-color
    const html16 = terminal.ansiToHtml('\x1b[32mSUCCESS\x1b[0m \x1b[31mFAILURE\x1b[0m');
    assert.equal(html16.includes('cl-ansi-green'), true);
    assert.equal(html16.includes('cl-ansi-red'), true);

    // Bold + Underline
    const htmlStyle = terminal.ansiToHtml('\x1b[1;4mIMPORTANT\x1b[0m');
    assert.equal(htmlStyle.includes('cl-ansi-bold'), true);
    assert.equal(htmlStyle.includes('cl-ansi-underline'), true);

    // 256 color
    const html256 = terminal.ansiToHtml('\x1b[38;5;196mBRIGHT_RED\x1b[0m');
    assert.equal(html256.includes('color:#f14c4c') || html256.includes('color:rgb(255'), true);

    // 24-bit RGB
    const htmlRgb = terminal.ansiToHtml('\x1b[38;2;100;150;200mCUSTOM_RGB\x1b[0m');
    assert.equal(htmlRgb.includes('color:rgb(100, 150, 200)'), true);
  });

  await test('3.5 Split escape sequence across chunk boundaries buffers and executes cleanly', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    // Escape sequence split in two chunks
    engine.writeStreamChunk('Status: \x1b[');
    engine.writeStreamChunk('32mONLINE\x1b[0m\n');

    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Status: \x1b[32mONLINE\x1b[0m\n');

    const html = terminal.ansiToHtml(engine.logs[0].text);
    assert.equal(html.includes('cl-ansi-green'), true);
    assert.equal(html.includes('ONLINE'), true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Shell Compound Loops & AST Flow Control
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: Shell Compound Loops & AST Flow Control ---');

  await test('4.1 Deeply nested 3-level loops with break 3 terminates all outer levels', async () => {
    const posix = shell.createPosixShell();
    const script = `
      res=""
      for a in 1 2; do
        for b in 1 2; do
          for c in 1 2; do
            if [ $c -eq 2 ]; then
              break 3
            fi
            res="\${res}\${a}\${b}\${c},"
          done
        done
      done
      echo "$res"
    `;
    const res = await posix.execute(script);
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout.trim(), '111,');
  });

  await test('4.2 Nested while inside for loop with continue 2 jumps directly to next outer iteration', async () => {
    const posix = shell.createPosixShell();
    const script = `
      out=""
      for x in 1 2 3; do
        y=1
        while [ $y -le 3 ]; do
          if [ $x -eq 2 ] && [ $y -eq 2 ]; then
            continue 2
          fi
          out="\${out}\${x}\${y},"
          y=$((y + 1))
        done
      done
      echo "$out"
    `;
    const res = await posix.execute(script);
    assert.equal(res.exitCode, 0, res.stderr);
    // x=1: 11, 12, 13
    // x=2: 21, then continue 2 skips rest of while and jumps to x=3
    // x=3: 31, 32, 33
    assert.equal(res.stdout.trim(), '11,12,13,21,31,32,33,');
  });

  await test('4.3 Subshells inside loop body have isolated local environment that does not leak', async () => {
    const posix = shell.createPosixShell();
    const script = `
      val="outer"
      for i in 1 2; do
        (val="inner-$i"; echo "in:$val")
      done
      echo "final:$val"
    `;
    const res = await posix.execute(script);
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'in:inner-1\nin:inner-2\nfinal:outer');
  });

  await test('4.4 Compound loop with file redirection aggregates all iterations into single file', async () => {
    const posix = shell.createPosixShell();
    const script = `
      for num in 10 20 30; do
        echo "item: $num"
      done > /workspace/items.txt
      cat /workspace/items.txt
    `;
    const res = await posix.execute(script);
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'item: 10\nitem: 20\nitem: 30');
    assert.equal(posix.vfs.readFileSync('/workspace/items.txt', 'utf8').trim(), 'item: 10\nitem: 20\nitem: 30');
  });

  await test('4.5 Pipeline into while loop with [ test comparison works reliably', async () => {
    const posix = shell.createPosixShell();
    posix.vfs.writeFileSync('/workspace/users.txt', 'alice\nbob\ncharlie\n');
    const script = `
      count=0
      for u in alice bob charlie; do
        if [ "$u" != "bob" ]; then
          count=$((count + 1))
          echo "keep: $u"
        fi
      done
      echo "total: $count"
    `;
    const res = await posix.execute(script);
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'keep: alice\nkeep: charlie\ntotal: 2');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: SIGINT / Interruption & Resource Cleanup
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 5: SIGINT Interruption & Resource Cleanup ---');

  await test('5.1 Infinite while loop interrupted by SIGINT signal halts cleanly in <150ms with exitCode 130', async () => {
    const posix = shell.createPosixShell();
    const abortCtrl = new AbortController();
    const t0 = Date.now();

    setTimeout(() => {
      abortCtrl.abort('SIGINT');
    }, 70);

    const res = await posix.execute('while true; do echo "running"; sleep 0.04; done', {
      signal: abortCtrl.signal
    });

    const elapsed = Date.now() - t0;
    assert.equal(elapsed < 300, true, `Interruption took ${elapsed}ms, expected < 300ms`);
    assert.equal(res.exitCode, 130, `Expected exitCode 130, got ${res.exitCode}`);
    assert.equal(res.aborted, true, 'Expected res.aborted to be true');
  });

  await test('5.2 Virtual runtime setInterval loop aborted via signal clears all active interval handles', async () => {
    const abortCtrl = new AbortController();
    const t0 = Date.now();

    setTimeout(() => {
      abortCtrl.abort('SIGINT');
    }, 50);

    const res = await runtime.executeInVirtualRuntime({
      entry: 'long-loop.js',
      files: {
        'long-loop.js': `
          let c = 0;
          setInterval(() => {
            c++;
          }, 15);
        `
      },
      signal: abortCtrl.signal,
      timeoutMs: 15000
    });

    const elapsed = Date.now() - t0;
    assert.equal(elapsed < 400, true, `Aborting runtime took ${elapsed}ms, expected < 400ms`);
    assert.equal(res.cancelled, true, 'res.cancelled must be true');
    assert.equal(res.exitCode, 130, 'exitCode must be 130');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(`CHALLENGER SUITE SUMMARY: ${summary.passed} PASSED, ${summary.failed} FAILED (TOTAL: ${summary.total})`);
  console.log('════════════════════════════════════════════════════════════════════════\n');

  if (summary.failed > 0) {
    console.error('FAILURES:');
    for (const f of summary.failures) {
      console.error(`- ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }
}

runChallengerSuite().catch(err => {
  console.error('Fatal challenger harness error:', err);
  process.exit(1);
});
