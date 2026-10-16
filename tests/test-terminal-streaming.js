'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 1: Real-Time Terminal Command Streaming & Interruption Test Suite
 *
 * Requirements:
 * 1. Real-Time Streaming Output without Buffering (interval delta verification)
 * 2. Shell Compound AST Node Visitors (For, While, Until, If, test/[ built-in)
 * 3. Carriage Return (\r) In-Place Rewrites (line overwrite collapse)
 * 4. ANSI Escape Sequences Handling (\x1b[2K, \x1b[1A, \x1b[G, \x1b[2J, color preservation)
 * 5. Ctrl+C / SIGINT Interruption (<50ms termination, exitCode 130, timer cleanup)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const runtime = require('../src/runtime.js');
const shell = require('../src/shell.js');
const terminal = require('../src/terminal.js');
const workbench = require('../src/workbench.js');

async function runTestSuite() {
  let passed = 0;
  let failed = 0;
  const errors = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      errors.push({ name, err });
      console.error(`  ✗ ${name}`);
      console.error(`    ${err && err.stack ? err.stack : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Milestone 1: Real-Time Terminal Streaming & SIGINT Verification Suite    ');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 1: Real-Time Streaming Output without Buffering
  // ───────────────────────────────────────────────────────────────────────────
  console.log('=== Tier 1: Real-Time Streaming Output without Buffering ===');

  await test('[T1.1] Runtime emits chunks incrementally over time rather than batching at exit', async () => {
    const chunkTimestamps = [];
    const t0 = Date.now();

    const res = await runtime.executeInVirtualRuntime({
      entry: 'stream-test.js',
      files: {
        'stream-test.js': `
          let count = 0;
          const timer = setInterval(() => {
            console.log('chunk-' + count);
            count++;
            if (count >= 3) {
              clearInterval(timer);
            }
          }, 40);
        `
      },
      onStdout: (chunk) => {
        chunkTimestamps.push({ text: chunk.trim(), time: Date.now() - t0 });
      }
    });

    assert.equal(res.ok, true, res.stderr);
    assert.equal(chunkTimestamps.length >= 3, true, `Expected >= 3 chunks, got ${chunkTimestamps.length}`);

    // Verify time delta: first and last chunk must be spaced apart by interval (>60ms)
    const timeSpread = chunkTimestamps[chunkTimestamps.length - 1].time - chunkTimestamps[0].time;
    assert.equal(timeSpread >= 60, true, `Expected time spread >= 60ms between chunks, got ${timeSpread}ms (indicates batching)`);
    assert.equal(chunkTimestamps[0].text, 'chunk-0');
    assert.equal(chunkTimestamps[1].text, 'chunk-1');
  });

  await test('[T1.2] Shell execute routes streaming stdout in real time to onStdout callback', async () => {
    const posix = shell.createPosixShell();
    posix.vfs.writeFileSync('/workspace/counter.js', `
      let i = 0;
      const t = setInterval(() => {
        process.stdout.write('step:' + i + '\\n');
        i++;
        if (i >= 3) clearInterval(t);
      }, 35);
    `);

    const streamed = [];
    const res = await posix.execute('node counter.js', {
      onStdout: (chunk) => {
        streamed.push({ chunk: chunk.trim(), time: Date.now() });
      }
    });

    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(streamed.length >= 3, true, `Expected >= 3 chunks, received ${streamed.length}`);
    const spread = streamed[streamed.length - 1].time - streamed[0].time;
    assert.equal(spread >= 50, true, `Expected spread >= 50ms, got ${spread}ms`);
  });

  await test('[T1.3] Shell routes stderr stream chunks to onStderr callback separately', async () => {
    const posix = shell.createPosixShell();
    posix.vfs.writeFileSync('/workspace/err-stream.js', `
      console.log('out-1');
      console.error('err-1');
      console.log('out-2');
    `);

    const outChunks = [];
    const errChunks = [];

    const res = await posix.execute('node err-stream.js', {
      onStdout: (c) => outChunks.push(c.trim()),
      onStderr: (c) => errChunks.push(c.trim())
    });

    assert.equal(res.exitCode, 0);
    assert.equal(outChunks.includes('out-1'), true);
    assert.equal(outChunks.includes('out-2'), true);
    assert.equal(errChunks.includes('err-1'), true);
  });

  await test('[T1.4] Shell loop body streaming emits iteration chunks incrementally via onStdout', async () => {
    const posix = shell.createPosixShell();
    const timestamps = [];
    const t0 = Date.now();

    const res = await posix.execute('for i in 1 2 3; do echo "loop-$i"; sleep 0.04; done', {
      onStdout: (c) => {
        timestamps.push({ chunk: c.trim(), time: Date.now() - t0 });
      }
    });

    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(timestamps.length >= 3, true, `Expected >= 3 chunks, got ${timestamps.length}`);
    const spread = timestamps[timestamps.length - 1].time - timestamps[0].time;
    assert.equal(spread >= 50, true, `Expected spread >= 50ms, got ${spread}ms`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 2: Shell Compound AST Node Visitors
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 2: Shell Compound AST Node Visitors ===');

  await test('[T2.1] For loop executes sequentially and binds variable', async () => {
    const posix = shell.createPosixShell();
    const res = await posix.execute('for item in alpha beta gamma; do echo "got: $item"; done');
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout, 'got: alpha\ngot: beta\ngot: gamma\n');
  });

  await test('[T2.2] While loop with [ test builtin comparison terminates accurately', async () => {
    const posix = shell.createPosixShell();
    const cmd = 'val=0; while [ $val -lt 3 ]; do echo "tick-$val"; val=$((val + 1)); done';
    const res = await posix.execute(cmd);
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout, 'tick-0\ntick-1\ntick-2\n');
  });

  await test('[T2.3] Until loop executes until condition evaluates to true', async () => {
    const posix = shell.createPosixShell();
    const cmd = 'idx=0; until [ $idx -ge 3 ]; do echo "u-$idx"; idx=$((idx + 1)); done';
    const res = await posix.execute(cmd);
    assert.equal(res.exitCode, 0, res.stderr);
    assert.equal(res.stdout, 'u-0\nu-1\nu-2\n');
  });

  await test('[T2.4] If / then / elif / else branching logic executes correct branches', async () => {
    const posix = shell.createPosixShell();
    const res1 = await posix.execute('if [ 5 -gt 2 ]; then echo "greater"; else echo "less"; fi');
    assert.equal(res1.stdout.trim(), 'greater');

    const res2 = await posix.execute('if [ 2 -gt 5 ]; then echo "greater"; elif [ 2 -eq 2 ]; then echo "equal"; else echo "other"; fi');
    assert.equal(res2.stdout.trim(), 'equal');

    const res3 = await posix.execute('if [ "abc" = "xyz" ]; then echo "same"; else echo "diff"; fi');
    assert.equal(res3.stdout.trim(), 'diff');
  });

  await test('[T2.5] POSIX test and [ builtin supports string, int, and file operators', async () => {
    const posix = shell.createPosixShell();
    posix.vfs.writeFileSync('/workspace/sample.txt', 'hello world');
    posix.vfs.mkdirSync('/workspace/testdir', { recursive: true });

    // File operators
    const f1 = await posix.execute('[ -f /workspace/sample.txt ] && echo "is-file"');
    assert.equal(f1.stdout.trim(), 'is-file');

    const f2 = await posix.execute('[ -d /workspace/testdir ] && echo "is-dir"');
    assert.equal(f2.stdout.trim(), 'is-dir');

    const f3 = await posix.execute('[ ! -f /workspace/nonexistent.txt ] && echo "not-exists"');
    assert.equal(f3.stdout.trim(), 'not-exists');

    // String operators
    const s1 = await posix.execute('[ -z "" ] && echo "empty"');
    assert.equal(s1.stdout.trim(), 'empty');

    const s2 = await posix.execute('[ -n "nonempty" ] && echo "has-text"');
    assert.equal(s2.stdout.trim(), 'has-text');

    // Integer operators
    const i1 = await posix.execute('[ 42 -ge 42 ] && [ 10 -lt 20 ] && echo "math-ok"');
    assert.equal(i1.stdout.trim(), 'math-ok');
  });

  await test('[T2.6] For loop break and continue controls loop iteration', async () => {
    const posix = shell.createPosixShell();
    const resBreak = await posix.execute('for x in 1 2 3 4 5; do if [ $x -eq 3 ]; then break; fi; echo $x; done');
    assert.equal(resBreak.stdout.trim(), '1\n2');

    const resCont = await posix.execute('for x in 1 2 3 4; do if [ $x -eq 2 ]; then continue; fi; echo $x; done');
    assert.equal(resCont.stdout.trim(), '1\n3\n4');
  });

  await test('[T2.7] Case statement matches exact and wildcard branches', async () => {
    const posix = shell.createPosixShell();
    const res1 = await posix.execute('val="prod"; case $val in dev) echo "development";; prod) echo "production";; *) echo "unknown";; esac');
    assert.equal(res1.stdout.trim(), 'production');

    const res2 = await posix.execute('val="testing"; case $val in test*) echo "matched-prefix";; *) echo "fallback";; esac');
    assert.equal(res2.stdout.trim(), 'matched-prefix');
  });

  await test('[T2.8] Pipelines execute with stdout flowing into stdin', async () => {
    const posix = shell.createPosixShell();
    posix.vfs.writeFileSync('/workspace/list.txt', 'cherry\napple\nbanana\n');
    const res = await posix.execute('cat /workspace/list.txt | grep apple');
    assert.equal(res.stdout.trim(), 'apple');
  });

  await test('[T2.9] Functions definition and execution with positional arguments', async () => {
    const posix = shell.createPosixShell();
    const res = await posix.execute('greet() { echo "Hello, $1!"; }; greet Developer');
    assert.equal(res.stdout.trim(), 'Hello, Developer!');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 3: Carriage Return (\r) In-Place Rewrites
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 3: Carriage Return (\\r) In-Place Rewrites ===');

  await test('[T3.1] PTYTerminalEngine collapses multiple \\r progress updates into single line', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Loading: 10%\r');
    engine.writeStreamChunk('Loading: 50%\r');
    engine.writeStreamChunk('Loading: 100%\n');

    assert.equal(engine.logs.length, 1, `Expected exactly 1 log line, got ${engine.logs.length}`);
    assert.equal(engine.logs[0].text, 'Loading: 100%\n');
  });

  await test('[T3.2] resolveAnsiControlCodes overwrites buffer correctly upon \\r', () => {
    const fn = terminal.resolveAnsiControlCodes;
    assert.equal(typeof fn, 'function', 'resolveAnsiControlCodes must be exported');

    assert.equal(fn('Progress: 0%\rProgress: 50%\rProgress: 100%'), 'Progress: 100%');
    assert.equal(fn('hello\rworld'), 'world');
    assert.equal(fn('multi\r\nline\r\ntext'), 'multi\nline\ntext');
    assert.equal(fn('first line\rsecond\nthird'), 'second\nthird');
  });

  await test('[T3.3] Consecutive progress bars with \\n demarcations create clean discrete lines', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    // Task 1
    engine.writeStreamChunk('Task 1: 0%\r');
    engine.writeStreamChunk('Task 1: 100%\n');
    // Task 2
    engine.writeStreamChunk('Task 2: 0%\r');
    engine.writeStreamChunk('Task 2: 100%\n');

    assert.equal(engine.logs.length, 2, `Expected 2 log lines, got ${engine.logs.length}`);
    assert.equal(engine.logs[0].text, 'Task 1: 100%\n');
    assert.equal(engine.logs[1].text, 'Task 2: 100%\n');
  });

  await test('[T3.4] Workbench _appendTerminalStream collapses carriage return updates in-place', () => {
    const mockContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };

    const wb = new workbench.CodeLabWorkbench(mockContainer, { id: 'test-lab' });
    wb.terminalLogs = [];
    wb._appendTerminalStream('stdout', 'Installing 10%\r');
    wb._appendTerminalStream('stdout', 'Installing 50%\r');
    wb._appendTerminalStream('stdout', 'Installing 100%\n');
    wb._flushTerminalStream();

    assert.equal(wb.terminalLogs.length, 1, `Expected 1 line, got ${wb.terminalLogs.length}`);
    assert.equal(wb.terminalLogs[0].text, 'Installing 100%');
  });

  await test('[T3.5] Workbench streams newline-terminated chunks to the live DOM immediately', () => {
    const logDiv = {
      children: [],
      appendChild(el) { el.parentNode = this; this.children.push(el); },
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
      createElement: () => ({ innerHTML: '', className: '', parentNode: null, textContent: '' })
    };

    try {
      const wb = new workbench.CodeLabWorkbench(mockContainer, { id: 'stream-dom-lab' });
      // Production wires the PTY engine without a container, so the workbench is the renderer.
      assert.ok(wb.ptyEngine, 'ptyEngine should be initialised');
      assert.ok(!wb.ptyEngine.container, 'ptyEngine must not own the DOM in production wiring');

      wb._appendTerminalStream('stdout', 'Cloning into demo...\n');
      assert.equal(logDiv.children.length, 1, 'a newline-terminated chunk must render a DOM line immediately');
      assert.equal(logDiv.children[0].innerHTML, 'Cloning into demo...');

      wb._appendTerminalStream('stdout', 'Receiving objects: 50%\n');
      assert.equal(logDiv.children.length, 2, 'each completed line must append without waiting for the command to finish');

      // Carriage-return progress updates overwrite the active line in place (no new nodes).
      wb._appendTerminalStream('stdout', 'Receiving objects: 80%\r');
      wb._appendTerminalStream('stdout', 'Receiving objects: 100%\r');
      wb._appendTerminalStream('stdout', 'Receiving objects: 100% (10/10), done.\n');
      assert.equal(logDiv.children.length, 3, 'carriage-return updates must not accumulate extra DOM lines');
      assert.equal(logDiv.children[2].innerHTML, 'Receiving objects: 100% (10/10), done.');

      // A trailing partial line is shown, then reused when its newline arrives.
      wb._appendTerminalStream('stdout', 'Resolving deltas');
      assert.equal(logDiv.children.length, 4);
      assert.equal(logDiv.children[3].innerHTML, 'Resolving deltas');
      wb._appendTerminalStream('stdout', ': 100% done.\n');
      assert.equal(logDiv.children.length, 4, 'finishing a partial line must reuse the same node');
      assert.equal(logDiv.children[3].innerHTML, 'Resolving deltas: 100% done.');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 4: ANSI Escape Sequences Handling
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 4: ANSI Escape Sequences Handling ===');

  await test('[T4.1] \\x1b[2K clears entire current line', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Fatal error occurred\x1b[2KRetrying connection...\n');

    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Retrying connection...\n');

    const resolved = terminal.resolveAnsiControlCodes('Error\x1b[2KSuccess');
    assert.equal(resolved, 'Success');
  });

  await test('[T4.2] \\x1b[1A moves cursor up one line to rewrite previous committed line', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Original Line\n');
    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Original Line\n');

    engine.writeStreamChunk('\x1b[1AOverwritten Line\n');
    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Overwritten Line\n');
  });

  await test('[T4.3] \\x1b[2J clears all terminal logs', () => {
    const engine = terminal.createPTYTerminalEngine(null);
    engine.writeStreamChunk('Line 1\n');
    engine.writeStreamChunk('Line 2\n');
    assert.equal(engine.logs.length, 2);

    engine.writeStreamChunk('\x1b[2JFresh Line\n');
    assert.equal(engine.logs.length, 1);
    assert.equal(engine.logs[0].text, 'Fresh Line\n');
  });

  await test('[T4.4] ansiToHtml preserves color codes without breaking on control sequences', () => {
    const greenText = '\x1b[32mOK\x1b[0m';
    const html = terminal.ansiToHtml(greenText);
    assert.equal(html.includes('cl-ansi-green'), true, `Expected green color style in html: ${html}`);
    assert.equal(html.includes('OK'), true);

    const boldRed = '\x1b[1m\x1b[31mFAIL\x1b[0m';
    const boldHtml = terminal.ansiToHtml(boldRed);
    assert.equal(boldHtml.includes('FAIL'), true);
    assert.equal(boldHtml.includes('cl-ansi-red'), true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 5: Ctrl+C / SIGINT Interruption
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 5: Ctrl+C / SIGINT Interruption ===');

  await test('[T5.1] Virtual runtime execution halts immediately on signal abort with exitCode 130', async () => {
    const abortCtrl = new AbortController();
    const t0 = Date.now();

    // Schedule abort after 60ms
    setTimeout(() => {
      abortCtrl.abort('SIGINT');
    }, 60);

    const res = await runtime.executeInVirtualRuntime({
      entry: 'infinite.js',
      files: {
        'infinite.js': `
          setInterval(() => {
            console.log('alive');
          }, 100);
        `
      },
      signal: abortCtrl.signal,
      timeoutMs: 30000 // would hang for 30s without abort
    });

    const elapsed = Date.now() - t0;
    assert.equal(elapsed < 1000, true, `Expected execution to halt <1000ms, took ${elapsed}ms`);
    assert.equal(res.exitCode, 130, `Expected exitCode 130, got ${res.exitCode}`);
    assert.equal(res.cancelled, true, 'Expected res.cancelled to be true');
    assert.equal(res.ok, false);
  });

  await test('[T5.2] Shell sleep command aborts cleanly with exitCode 130 upon signal abort', async () => {
    const posix = shell.createPosixShell();
    const abortCtrl = new AbortController();
    const t0 = Date.now();

    setTimeout(() => {
      abortCtrl.abort('SIGINT');
    }, 50);

    const res = await posix.execute('sleep 10', {
      signal: abortCtrl.signal
    });

    const elapsed = Date.now() - t0;
    assert.equal(elapsed < 500, true, `Expected sleep to abort in <500ms, took ${elapsed}ms`);
    assert.equal(res.exitCode, 130, `Expected exitCode 130, got ${res.exitCode}`);
  });

  await test('[T5.3] Workbench _handleInterrupt terminates active execution and resets UI state', () => {
    // Create minimal mock DOM container
    const mockContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };

    const wb = new workbench.CodeLabWorkbench(mockContainer, {
      id: 'test-lab',
      files: { 'demo.js': 'console.log("demo");' }
    });

    const abortCtrl = new AbortController();
    wb._activeCommandAbortController = abortCtrl;
    wb.isRunning = true;

    assert.equal(abortCtrl.signal.aborted, false);
    assert.equal(wb.isRunning, true);

    // Trigger Ctrl+C / SIGINT interrupt
    wb._handleInterrupt();

    assert.equal(abortCtrl.signal.aborted, true, 'AbortController must be aborted');
    assert.equal(wb.isRunning, false, 'isRunning must be reset to false');
    assert.equal(wb._activeCommandAbortController, null, 'active controller must be cleared');

    const lastLog = wb.terminalLogs[wb.terminalLogs.length - 1];
    assert.equal(lastLog && lastLog.text, '^C', 'Last terminal log must be ^C');
  });

  await test('[T5.4] Aborting Virtual Runtime clears all active interval timers and immediately unblocks', async () => {
    const abortCtrl = new AbortController();
    const t0 = Date.now();

    setTimeout(() => {
      abortCtrl.abort('SIGINT');
    }, 40);

    const res = await runtime.executeInVirtualRuntime({
      entry: 'timer-clear.js',
      files: {
        'timer-clear.js': `
          let c = 0;
          setInterval(() => {
            c++;
          }, 10);
        `
      },
      signal: abortCtrl.signal,
      timeoutMs: 30000
    });

    const elapsed = Date.now() - t0;
    assert.equal(elapsed < 600, true, `Execution took ${elapsed}ms, expected <600ms`);
    assert.equal(res.cancelled, true, 'res.cancelled must be true');
    assert.equal(res.exitCode, 130, 'exitCode must be 130');
  });

  await test('[T5.5] _isAbortResult classifies cancelled/aborted/exit-130 results as aborts', () => {
    const mockContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
    const wb = new workbench.CodeLabWorkbench(mockContainer, {
      id: 'abort-classify',
      files: { 'demo.js': 'console.log(1);' }
    });

    assert.equal(wb._isAbortResult({ cancelled: true }, null), true, 'cancelled => abort');
    assert.equal(wb._isAbortResult({ aborted: true }, null), true, 'aborted => abort');
    assert.equal(wb._isAbortResult({ exitCode: 130 }, null), true, 'exitCode 130 => abort');
    assert.equal(wb._isAbortResult({ exitCode: 0, stdout: 'ok' }, null), false, 'normal result is not an abort');

    const ac = new AbortController();
    ac.abort('SIGINT');
    assert.equal(wb._isAbortResult(null, ac.signal), true, 'aborted signal => abort');
    assert.equal(wb._isAbortResult(null, new AbortController().signal), false, 'live signal => not abort');
  });

  await test('[T5.6] Interrupting a command prints exactly one ^C and no SIGINT/error spam', () => {
    const mockContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
    const wb = new workbench.CodeLabWorkbench(mockContainer, {
      id: 'abort-noise',
      files: { 'demo.js': 'console.log(1);' }
    });

    const abortCtrl = new AbortController();
    wb._activeCommandAbortController = abortCtrl;
    wb.isRunning = true;

    wb._handleInterrupt();

    const texts = wb.terminalLogs.map(l => l.text);
    assert.equal(texts.filter(t => t === '^C').length, 1, 'Exactly one ^C must be printed');
    assert.equal(
      texts.some(t => /SIGINT|Interrupted by user|Execution error|Test runner error/.test(String(t))),
      false,
      'Interrupt must not leak SIGINT / abort error noise into the terminal'
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`Test Execution Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('Failed test details:');
    for (const f of errors) {
      console.error(`- ${f.name}:`, f.err);
    }
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test suite failure:', err);
  process.exit(1);
});
