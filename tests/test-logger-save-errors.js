#!/usr/bin/env node
'use strict';

/**
 * P0-5: diagnostics and persistence-failure regression suite.
 *
 * Previously, storage failures, corrupt saved state, download failures, and
 * host-callback exceptions were swallowed by empty `catch` blocks. This suite
 * pins the replacement contract:
 *   - failures are reported through a leveled logger;
 *   - a failed save falls back to in-memory state and notifies the host once;
 *   - corrupt saved state is ignored with a warning instead of silently
 *     discarding all progress;
 *   - download/export failures are logged while still returning data.
 */

const assert = require('node:assert/strict');
const { doc, localStorageMock, localStorageStore } = require('./helpers/mock-dom.js');
const { CodeLabWorkbench } = require('./helpers/load').workbench;

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

let counter = 0;
function uniqueLabId(label) {
  return `${label}-${process.pid}-${++counter}`;
}

function makeContainer() {
  return doc.createElement('div');
}

function makeWorkbench(options = {}) {
  return new CodeLabWorkbench(makeContainer(), {
    files: { 'index.js': 'console.log(1);' },
    ...options
  });
}

function captureSink() {
  const entries = [];
  return {
    entries,
    sink: {
      debug: (...args) => entries.push(['debug', ...args]),
      info: (...args) => entries.push(['info', ...args]),
      warn: (...args) => entries.push(['warn', ...args]),
      error: (...args) => entries.push(['error', ...args])
    }
  };
}

const silentSink = { debug() {}, info() {}, warn() {}, error() {} };

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log('   P0-5: Persistence & Logger Diagnostics');
console.log('════════════════════════════════════════════════════════════════════════════\n');

test('L1 debug logging is opt-in and honours a host sink', () => {
  const { entries, sink } = captureSink();

  const quiet = makeWorkbench({ logger: sink });
  quiet.logger.debug('hidden');
  quiet.logger.info('visible');
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], 'info');

  entries.length = 0;
  const verbose = makeWorkbench({ logger: sink, debug: true });
  verbose.logger.debug('shown');
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], 'debug');
});

test('L2 a failing localStorage write warns once per key and keeps state in memory', () => {
  localStorageStore.clear();
  const { entries, sink } = captureSink();
  const labId = uniqueLabId('save-fail');
  const wb = makeWorkbench({ labId, logger: sink });

  const originalSetItem = localStorageMock.setItem;
  localStorageMock.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    wb._saveState();
    const firstCount = entries.filter(([level, msg]) => level === 'warn' && String(msg).includes('localStorage.setItem')).length;
    assert.equal(firstCount, 3, `expected one warning for each of the 3 keys, got ${firstCount}`);

    wb._saveState();
    const secondCount = entries.filter(([level, msg]) => level === 'warn' && String(msg).includes('localStorage.setItem')).length;
    assert.equal(secondCount, firstCount, 'repeated saves must not spam the log');
  } finally {
    localStorageMock.setItem = originalSetItem;
  }
});

test('L3 a failed save still restores from the in-memory fallback', () => {
  localStorageStore.clear();
  const labId = uniqueLabId('fallback');
  const wb = makeWorkbench({ labId, logger: silentSink });

  const originalSetItem = localStorageMock.setItem;
  localStorageMock.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    wb.files['index.js'] = 'console.log("survived");';
    wb._saveState();
  } finally {
    localStorageMock.setItem = originalSetItem;
  }

  const restored = makeWorkbench({ labId });
  assert.equal(restored.files['index.js'], 'console.log("survived");');
});

test('L4 persistence failure emits one host event per workbench', () => {
  localStorageStore.clear();
  const wb = makeWorkbench({ labId: uniqueLabId('event'), logger: silentSink });
  let events = 0;
  wb.on('persistence-error', () => { events++; });

  const originalSetItem = localStorageMock.setItem;
  localStorageMock.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    wb._saveState();
    wb._saveState();
  } finally {
    localStorageMock.setItem = originalSetItem;
  }

  assert.equal(events, 1);
});

test('L5 persistState:false skips storage entirely', () => {
  localStorageStore.clear();
  const wb = makeWorkbench({ labId: uniqueLabId('no-persist'), persistState: false });
  wb._saveState();
  assert.equal(localStorageStore.size, 0);
});

test('L6 corrupt saved state is ignored with a warning', () => {
  localStorageStore.clear();
  const { entries, sink } = captureSink();
  const labId = uniqueLabId('corrupt');
  localStorageMock.setItem(`sd-codelab-v1:${labId}`, '{not-json');

  const wb = makeWorkbench({ labId, logger: sink });
  assert.ok(wb.files['index.js'], 'workbench must start with default files');
  assert.ok(
    entries.some(([level, msg]) => level === 'warn' && String(msg).includes('Ignoring unreadable saved state')),
    'corrupt state must be reported'
  );
});

test('L7 a throwing localStorage read warns and falls back', () => {
  localStorageStore.clear();
  const { entries, sink } = captureSink();

  const originalGetItem = localStorageMock.getItem;
  localStorageMock.getItem = () => { throw new Error('SecurityError'); };
  try {
    makeWorkbench({ labId: uniqueLabId('read-fail'), logger: sink });
  } finally {
    localStorageMock.getItem = originalGetItem;
  }

  assert.ok(entries.some(([level, msg]) => level === 'warn' && String(msg).includes('localStorage.getItem')));
});

test('L8 download failure is logged but the file content is still returned', () => {
  const { entries, sink } = captureSink();
  const wb = makeWorkbench({ logger: sink });
  wb.files['index.js'] = 'download me';

  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = () => { throw new Error('Blob blocked'); };
  try {
    const content = wb.downloadFile('index.js');
    assert.equal(content, 'download me');
  } finally {
    URL.createObjectURL = originalCreate;
  }

  assert.ok(entries.some(([level, msg]) => level === 'error' && String(msg).includes('Failed to start download')));
});

test('L9 export failure is logged but the snapshot is still returned', () => {
  const { entries, sink } = captureSink();
  const wb = makeWorkbench({ logger: sink, labId: 'export-fail' });
  wb.files['index.js'] = 'export me';

  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = () => { throw new Error('Blob blocked'); };
  try {
    const snapshot = wb.exportWorkspace({ download: true });
    assert.equal(snapshot.files['index.js'], 'export me');
  } finally {
    URL.createObjectURL = originalCreate;
  }

  assert.ok(entries.some(([level, msg]) => level === 'error' && String(msg).includes('Failed to download workspace export')));
});

test('L10 host callback exceptions are logged and do not break events', () => {
  const { entries, sink } = captureSink();
  const wb = makeWorkbench({
    logger: sink,
    onCodeChange: () => { throw new Error('host callback exploded'); }
  });

  let events = 0;
  wb.on('codelab:change', () => { events++; });

  wb._notifyCodeChange('index.js', 'console.log(2);');

  assert.equal(events, 1);
  assert.ok(entries.some(([level, msg]) => level === 'error' && String(msg).includes('onCodeChange')));
});

console.log('\n════════════════════════════════════════════════════════════════════════════');
console.log(`P0-5 Persistence & Logger Suite Complete: ${passed} passed, ${failures.length} failed`);
console.log('════════════════════════════════════════════════════════════════════════════\n');

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n[${failure.name}]`);
    console.error(failure.err.stack || failure.err.message);
  }
  process.exit(1);
}
