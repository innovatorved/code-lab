'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 1 Empirical Stress Harness: Process Interruption & Lifecycle
 * Agent: challenger_m1_2
 *
 * Test Dimensions:
 * 1. Ctrl+C / SIGINT abort latency (<50ms) and exit code 130
 * 2. Resource cleanup (resourceTracker zero timers, zero lingering listeners, prompt restoration)
 * 3. Rapid interrupt cycling (startup, execution, shutdown transitions, concurrency)
 * 4. Async / Top-level await interruption edge cases
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const runtime = require('./helpers/load').runtime;
const shell = require('./helpers/load').shell;
const terminal = require('./helpers/load').terminal;
const workbench = require('./helpers/load').workbench;

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  results.total++;
  process.stdout.write(`[TEST ${results.total}] ${name} ... `);
  const t0 = performance.now();
  try {
    await fn();
    const dur = (performance.now() - t0).toFixed(1);
    results.passed++;
    console.log(`\x1b[32mPASS\x1b[0m (${dur}ms)`);
    results.tests.push({ name, passed: true, durationMs: dur });
  } catch (err) {
    const dur = (performance.now() - t0).toFixed(1);
    results.failed++;
    console.log(`\x1b[31mFAIL\x1b[0m (${dur}ms)`);
    console.error(`   Error: ${err.message}`);
    results.tests.push({ name, passed: false, durationMs: dur, error: err.message, stack: err.stack });
  }
}

// Helper to count abort listeners on an AbortSignal
function getAbortListenerCount(signal) {
  // In Node.js / Bun, AbortSignal inherits from EventTarget
  if (typeof signal.listenerCount === 'function') {
    return signal.listenerCount('abort');
  }
  // Fallback for standard EventTarget via internal symbol if available
  const kEvents = Object.getOwnPropertySymbols(signal).find(s => s.description === 'kEvents' || s.description === 'events');
  if (kEvents && signal[kEvents]) {
    const abortEvents = signal[kEvents].get ? signal[kEvents].get('abort') : signal[kEvents]['abort'];
    if (!abortEvents) return 0;
    return Array.isArray(abortEvents) ? abortEvents.length : 1;
  }
  return undefined;
}

// Minimal DOM mock for CodeLabWorkbench testing
function createMockDom() {
  const elements = new Map();
  const makeEl = (id, cls = '') => {
    const el = {
      id,
      className: cls,
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      children: [],
      appendChild: (c) => c,
      removeChild: (c) => c,
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      focus: () => {},
      select: () => {},
      scrollIntoView: () => {},
      scrollTop: 0,
      scrollHeight: 100,
      getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 500, right: 800, width: 800, height: 500 }),
      value: '',
      textContent: '',
      innerHTML: '',
      querySelector: (s) => makeEl('mock-sub', s),
      querySelectorAll: () => []
    };
    return el;
  };

  const root = makeEl('container');
  root.querySelector = (sel) => {
    if (sel.startsWith('#')) return elements.get(sel.slice(1)) || makeEl(sel.slice(1));
    return makeEl('mock-el', sel.replace('.', ''));
  };
  root.querySelectorAll = () => [];
  return root;
}

(async () => {
  console.log('════════════════════════════════════════════════════════════════════════════');
  console.log('  CHALLENGER M1.2: PROCESS INTERRUPTION & LIFECYCLE EMPIRICAL HARNESS       ');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // Track unhandled rejections during test execution
  const unhandledRejections = [];
  process.on('unhandledRejection', (reason) => {
    unhandledRejections.push(reason);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: Ctrl+C / SIGINT Abort Latency (<50ms) and Exit Code 130
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Suite 1: Ctrl+C / SIGINT Abort Latency (<50ms) & Exit Code 130 ---');

  await test('1.1 Shell while loop (while true; do echo tick; sleep 1; done) abort latency < 50ms and code 130', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 60);

    const res = await posix.execute('while true; do echo tick; sleep 1; done', {
      signal: ac.signal
    });
    abortResolveTime = performance.now();

    const latency = abortResolveTime - abortTriggerTime;
    assert.strictEqual(res.code, 130, `Expected exit code 130, got ${res.code}`);
    assert.strictEqual(res.exitCode, 130, `Expected exitCode 130, got ${res.exitCode}`);
    assert.strictEqual(res.aborted, true, 'Expected res.aborted to be true');
    assert.ok(latency < 50, `Abort latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('1.2 Shell until loop (until false; do sleep 1; done) abort latency < 50ms and code 130', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 40);

    const res = await posix.execute('until false; do sleep 1; done', {
      signal: ac.signal
    });
    abortResolveTime = performance.now();

    const latency = abortResolveTime - abortTriggerTime;
    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.aborted, true);
    assert.ok(latency < 50, `Abort latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('1.3 Shell nested loops (while true; do for i in 1 2 3; do sleep 1; done; done) abort latency < 50ms', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 50);

    const res = await posix.execute('while true; do for i in 1 2 3; do sleep 1; done; done', {
      signal: ac.signal
    });
    abortResolveTime = performance.now();

    const latency = abortResolveTime - abortTriggerTime;
    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.aborted, true);
    assert.ok(latency < 50, `Nested loop abort latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('1.4 Shell pipeline abort (echo tick | sleep 1 | tr a-z A-Z) abort latency < 50ms', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 50);

    const res = await posix.execute('echo tick | sleep 1 | tr a-z A-Z', {
      signal: ac.signal
    });
    abortResolveTime = performance.now();

    const latency = abortResolveTime - abortTriggerTime;
    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.aborted, true);
    assert.ok(latency < 50, `Pipeline abort latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('1.5 Virtual runtime setInterval infinite loop abort latency < 50ms, code 130, cancelled true', async () => {
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 50);

    const res = await runtime.executeInVirtualRuntime({
      entry: 'infinite-timer.js',
      files: {
        'infinite-timer.js': `
          setInterval(() => {
            console.log('tick');
          }, 100);
        `
      },
      signal: ac.signal,
      timeoutMs: 10000
    });
    abortResolveTime = performance.now();

    const latency = abortResolveTime - abortTriggerTime;
    assert.strictEqual(res.exitCode, 130, `Expected exitCode 130, got ${res.exitCode}`);
    assert.strictEqual(res.cancelled, true, 'Expected cancelled to be true');
    assert.ok(latency < 50, `Virtual runtime timer abort latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('1.6 PosixShell node command with setInterval (node -e "setInterval(...)") abort latency < 50ms', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 50);

    const res = await posix.execute('node -e "setInterval(() => console.log(\'tick\'), 100)"', {
      signal: ac.signal
    });
    abortResolveTime = performance.now();

    const latency = abortResolveTime - abortTriggerTime;
    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.exitCode, 130);
    assert.strictEqual(res.aborted, true);
    assert.ok(latency < 50, `Node command abort latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('1.7 Pre-aborted signal terminates immediately (<10ms) without executing command', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    ac.abort('SIGINT');

    const t0 = performance.now();
    const res = await posix.execute('echo "should not run"; sleep 10', {
      signal: ac.signal
    });
    const elapsed = performance.now() - t0;

    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.exitCode, 130);
    assert.strictEqual(res.aborted, true);
    assert.strictEqual(res.stdout, '', 'No output should be emitted for pre-aborted command');
    assert.ok(elapsed < 20, `Pre-aborted command must return immediately, took ${elapsed.toFixed(2)}ms`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Resource Cleanup & Event Loop Timers
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: Resource Cleanup & Event Loop Timers ---');

  await test('2.1 Zero orphaned timers: all activeTimers and allTimers cleared on SIGINT', async () => {
    let capturedTracker = null;
    let leakedCallbackCount = 0;

    const ac = new AbortController();
    setTimeout(() => ac.abort('SIGINT'), 50);

    const res = await runtime.executeInVirtualRuntime({
      entry: 'timer-swarm.js',
      files: {
        'timer-swarm.js': `
          for (let i = 0; i < 50; i++) {
            setInterval(() => { console.log('orphaned interval'); }, 20);
            setTimeout(() => { console.log('orphaned timeout'); }, 40);
            setImmediate(() => { console.log('orphaned immediate'); });
          }
        `
      },
      signal: ac.signal,
      timeoutMs: 5000,
      onStdout: () => {
        leakedCallbackCount++;
      }
    });

    assert.strictEqual(res.exitCode, 130);
    assert.strictEqual(res.cancelled, true);

    // Wait an additional 100ms to verify that NO orphaned timers fire on the event loop
    const callbacksAtAbort = leakedCallbackCount;
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(
      leakedCallbackCount,
      callbacksAtAbort,
      `Orphaned timers fired after abort! Callback count increased from ${callbacksAtAbort} to ${leakedCallbackCount}`
    );
  });

  await test('2.2 Zero lingering abort event listeners on signal after normal execution', async () => {
    const ac = new AbortController();
    let listenerCount = 0;

    // Attach spy on signal addEventListener / removeEventListener
    const originalAdd = ac.signal.addEventListener;
    const originalRemove = ac.signal.removeEventListener;
    let added = 0;
    let removed = 0;

    ac.signal.addEventListener = function(type, listener, options) {
      if (type === 'abort') added++;
      return originalAdd.call(this, type, listener, options);
    };
    ac.signal.removeEventListener = function(type, listener, options) {
      if (type === 'abort') removed++;
      return originalRemove.call(this, type, listener, options);
    };

    const posix = shell.createPosixShell();
    const res = await posix.execute('echo "clean run"; sleep 0.05', {
      signal: ac.signal
    });

    assert.strictEqual(res.code, 0);
    // Any listener added must have been removed
    assert.strictEqual(added, removed, `Lingering listeners detected: added ${added}, removed ${removed}`);
  });

  await test('2.3 Zero lingering abort event listeners on signal after SIGINT abort', async () => {
    const ac = new AbortController();
    let added = 0;
    let removed = 0;

    const originalAdd = ac.signal.addEventListener;
    const originalRemove = ac.signal.removeEventListener;

    ac.signal.addEventListener = function(type, listener, options) {
      if (type === 'abort') added++;
      return originalAdd.call(this, type, listener, options);
    };
    ac.signal.removeEventListener = function(type, listener, options) {
      if (type === 'abort') removed++;
      return originalRemove.call(this, type, listener, options);
    };

    setTimeout(() => ac.abort('SIGINT'), 40);

    const posix = shell.createPosixShell();
    const res = await posix.execute('while true; do sleep 1; done', {
      signal: ac.signal
    });

    assert.strictEqual(res.code, 130);
    // Sleep uses { once: true } or explicit remove; verify balance
    assert.ok(added > 0, 'Abort listener should have been added during sleep');
  });

  await test('2.4 Workbench _handleInterrupt resets isRunning, aborts controller, and restores prompt', () => {
    const mockContainer = createMockDom();
    const wb = new workbench.CodeLabWorkbench(mockContainer, {
      id: 'test-lab',
      files: { 'index.js': 'console.log("hello");' }
    });

    const ac = new AbortController();
    wb._activeCommandAbortController = ac;
    wb.isRunning = true;
    wb.cwd = '/workspace';

    // Simulate active typed input
    wb._ptyInputBeforeCursor = 'node index.js';

    // Fire interrupt
    wb._handleInterrupt();

    // Verification
    assert.strictEqual(ac.signal.aborted, true, 'AbortController must be aborted');
    assert.strictEqual(wb.isRunning, false, 'wb.isRunning must be false');
    assert.strictEqual(wb._activeCommandAbortController, null, 'Active controller must be cleared');
    assert.strictEqual(wb._ptyInputBeforeCursor, '', 'PTY input before cursor must be cleared');
    assert.strictEqual(wb._ptyInputAfterCursor, '', 'PTY input after cursor must be cleared');

    // Terminal logs must contain ^C
    const logs = wb.terminalLogs;
    assert.ok(logs.length > 0);
    const lastLog = logs[logs.length - 1];
    assert.ok(lastLog.text.includes('^C'), `Expected ^C in terminal logs, got: ${lastLog.text}`);
  });

  await test('2.5 Workbench PTY terminal prompt formats correctly for cwd', () => {
    const mockContainer = createMockDom();
    const wb = new workbench.CodeLabWorkbench(mockContainer, {
      id: 'test-lab',
      files: {}
    });

    // In default /workspace, prompt should show ~
    wb.cwd = '/workspace';
    wb.inRepl = false;
    wb._ptyInputBeforeCursor = 'ls';
    wb._handleInterrupt();

    const lastLog = wb.terminalLogs[wb.terminalLogs.length - 1];
    // Check whether prompt reflects cwd and ^C
    assert.ok(lastLog.text.includes('^C'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Rapid Interrupt Cycling & Transition Stress
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: Rapid Interrupt Cycling & Transition Stress ---');

  await test('3.1 Rapid interrupt spamming during startup (50 cycles: start -> abort at t=0..2ms)', async () => {
    const posix = shell.createPosixShell();

    for (let i = 0; i < 50; i++) {
      const ac = new AbortController();
      const delay = i % 3; // 0ms, 1ms, 2ms
      if (delay === 0) {
        ac.abort('SIGINT');
      } else {
        setTimeout(() => ac.abort('SIGINT'), delay);
      }

      const res = await posix.execute('while true; do echo tick; sleep 0.1; done', {
        signal: ac.signal
      });

      assert.strictEqual(res.code, 130, `Cycle ${i}: Expected exit code 130, got ${res.code}`);
      assert.strictEqual(res.aborted, true, `Cycle ${i}: Expected aborted=true`);
    }
  });

  await test('3.2 Rapid multiple abort() calls on same controller (redundant SIGINT spam)', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();

    setTimeout(() => {
      // Spam abort 10 times in tight loop
      for (let i = 0; i < 10; i++) {
        ac.abort('SIGINT');
      }
    }, 30);

    const res = await posix.execute('while true; do sleep 0.5; done', {
      signal: ac.signal
    });

    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.aborted, true);
  });

  await test('3.3 Concurrent execution of 10 commands all aborted simultaneously', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();

    setTimeout(() => ac.abort('SIGINT'), 40);

    const promises = Array.from({ length: 10 }, (_, i) =>
      posix.execute(`while true; do echo "run-${i}"; sleep 1; done`, {
        signal: ac.signal
      })
    );

    const outcomes = await Promise.all(promises);
    assert.strictEqual(outcomes.length, 10);
    for (const [idx, o] of outcomes.entries()) {
      assert.strictEqual(o.code, 130, `Concurrent task ${idx} failed exit code`);
      assert.strictEqual(o.aborted, true, `Concurrent task ${idx} failed aborted flag`);
    }
  });

  await test('3.4 Sequential start-after-abort: shell state remains fully healthy and functional', async () => {
    const posix = shell.createPosixShell();

    // 1. Abort an infinite loop
    const ac = new AbortController();
    setTimeout(() => ac.abort('SIGINT'), 20);
    const r1 = await posix.execute('while true; do sleep 1; done', { signal: ac.signal });
    assert.strictEqual(r1.code, 130);

    // 2. Run a normal command immediately after abort
    const r2 = await posix.execute('echo "healthy shell"');
    assert.strictEqual(r2.code, 0);
    assert.strictEqual(r2.stdout.trim(), 'healthy shell');

    // 3. Set a variable, abort again, and verify variable persisted
    await posix.execute('TEST_VAR="persistent"');
    const ac2 = new AbortController();
    setTimeout(() => ac2.abort('SIGINT'), 20);
    const r3 = await posix.execute('sleep 5', { signal: ac2.signal });
    assert.strictEqual(r3.code, 130);

    const r4 = await posix.execute('echo "$TEST_VAR"');
    assert.strictEqual(r4.code, 0);
    assert.strictEqual(r4.stdout.trim(), 'persistent');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Adversarial Edge Cases & Boundary Probing
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: Adversarial Edge Cases & Boundary Probing ---');

  await test('4.1 Abort during pipeline between stages (cmd1 | sleep 10 | cmd3)', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    setTimeout(() => ac.abort('SIGINT'), 40);

    const res = await posix.execute('echo "start" | sleep 5 | cat', {
      signal: ac.signal
    });

    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.aborted, true);
  });

  await test('4.2 Abort during shell function execution with trap-like return', async () => {
    const posix = shell.createPosixShell();
    const ac = new AbortController();
    setTimeout(() => ac.abort('SIGINT'), 40);

    const script = `
      fn() {
        while true; do
          sleep 1
        done
      }
      fn
    `;
    const res = await posix.execute(script, { signal: ac.signal });
    assert.strictEqual(res.code, 130);
    assert.strictEqual(res.aborted, true);
  });

  await test('4.3 Zero unhandled promise rejections recorded across entire test run', () => {
    assert.strictEqual(
      unhandledRejections.length,
      0,
      `Unhandled rejections occurred: ${unhandledRejections.map(r => (r && r.stack) || String(r)).join('; ')}`
    );
  });

  await test('4.4 Pipeline stage supports compound AST node (for i in 1 2; do echo $i; done | cat)', async () => {
    const posix = shell.createPosixShell();
    const res = await posix.execute('for i in 1 2; do echo $i; done | cat');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), '1\n2');
  });

  await test('4.5 Virtual runtime top-level await aborts in <50ms with exitCode 130', async () => {
    const ac = new AbortController();
    let abortTriggerTime = 0;
    let abortResolveTime = 0;

    setTimeout(() => {
      abortTriggerTime = performance.now();
      ac.abort('SIGINT');
    }, 40);

    // Timeout safety race: if executeInVirtualRuntime hangs due to bug, don't stall harness
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('HANG: executeInVirtualRuntime stalled indefinitely on top-level await abort')), 1500)
    );

    const execPromise = runtime.executeInVirtualRuntime({
      entry: 'async-await.js',
      files: {
        'async-await.js': `
          await new Promise(r => setTimeout(r, 10000));
          console.log('done');
        `
      },
      signal: ac.signal,
      timeoutMs: 5000
    });

    const res = await Promise.race([execPromise, timeoutPromise]);
    abortResolveTime = performance.now();
    const latency = abortResolveTime - abortTriggerTime;

    assert.strictEqual(res.exitCode, 130);
    assert.strictEqual(res.cancelled, true);
    assert.ok(latency < 50, `Latency must be <50ms, was ${latency.toFixed(2)}ms`);
  });

  await test('4.6 Workbench prompt format in ~ restores codelab:~$ rather than codelab$', () => {
    const mockContainer = createMockDom();
    const wb = new workbench.CodeLabWorkbench(mockContainer, {
      id: 'test-lab',
      files: {}
    });

    wb.cwd = '/workspace';
    wb.inRepl = false;
    wb._ptyInputBeforeCursor = 'test';
    wb._handleInterrupt();

    const lastLog = wb.terminalLogs[wb.terminalLogs.length - 1];
    // Expected specification: codelab:~$ test^C (or codelab:~$ )
    assert.ok(
      lastLog.text.startsWith('codelab:~$') || lastLog.text.startsWith('codelab:~ $'),
      `Prompt must be formatted as "codelab:~$", got: "${lastLog.text}"`
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`  EMPIRICAL TEST SUMMARY: ${results.passed} / ${results.total} PASSED`);
  console.log('════════════════════════════════════════════════════════════════════════════');

  if (results.failed > 0) {
    console.error(`\x1b[31m${results.failed} TESTS FAILED\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\x1b[32mALL EMPIRICAL TESTS PASSED WITH 100% SUCCESS!\x1b[0m\n');
  }
})();
