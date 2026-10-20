/**
 * @file test-m1-adversarial-edge-cases.js
 * Extreme Boundary & Adversarial Probing for cloneGitHubRepository & PosixShell
 */

'use strict';

const assert = require('node:assert/strict');
const { cloneGitHubRepository, createPosixShell } = require('../src/shell.ts');
const { createVirtualFs } = require('../src/runtime.ts');

(async () => {
  console.log('Testing extreme edge cases and failure modes...');

  // Edge case 1: cloneGitHubRepository with null vfs
  let threw = false;
  try {
    await cloneGitHubRepository('owner/repo', null);
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('virtual filesystem (vfs) is required'));
  }
  assert.ok(threw, 'Expected null vfs to throw');

  // Edge case 2: cloneGitHubRepository handles fetchImpl rejection cleanly
  const vfs = createVirtualFs();
  const events = [];
  try {
    await cloneGitHubRepository('owner/repo', vfs, {
      fetchImpl: () => Promise.reject('raw string error'),
      onProgress: (evt) => events.push(evt)
    });
    assert.fail('Should have failed');
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('not found or could not be fetched'));
    assert.strictEqual(events[events.length - 1].phase, 'error');
    assert.ok(events[events.length - 1].message.includes('not found or could not be fetched'));
  }

  // Edge case 3: cloneGitHubRepository with empty tree (0 files)
  const emptyMockFetch = async (url) => {
    const u = String(url);
    if (u.includes('/git/trees/')) {
      return { ok: true, status: 200, json: async () => ({ tree: [] }) };
    }
    if (u.includes('api.github.com/repos/empty/repo')) {
      return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
    }
    return { ok: false, status: 404 };
  };
  const emptyRes = await cloneGitHubRepository('empty/repo', vfs, {
    targetDir: '/workspace/empty-repo',
    fetchImpl: emptyMockFetch
  });
  assert.strictEqual(emptyRes.count, 0);
  assert.strictEqual(emptyRes.fileCount, 0);
  assert.ok(vfs.existsSync('/workspace/empty-repo/.git/HEAD'));

  // Edge case 4: Shell empty pipelines, dangling pipes, whitespace
  const shell = createPosixShell();
  let res = await shell.execute('   ');
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout, '');

  res = await shell.execute(';;');
  assert.strictEqual(res.code, 0);

  // Edge case 5: Shell pipeline with non-standard whitespace and comments
  res = await shell.execute('echo "a" |   # inline comment\n cat | tr a z');
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout.trim(), 'z');

  // Edge case 6: Shell variable expansion with default values
  res = await shell.execute('echo "${NON_EXISTENT_VAR:-fallback_value}"');
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout.trim(), 'fallback_value');

  // Edge case 7: Shell arithmetic evaluation
  res = await shell.execute('echo "$(( (2 + 3) * 4 ))"');
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout.trim(), '20');

  console.log('✅ All extreme boundary & adversarial checks passed!');
})().catch((err) => {
  console.error('Edge-case suite failed:', err);
  process.exitCode = 1;
});
