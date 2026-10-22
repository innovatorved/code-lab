'use strict';

const assert = require('node:assert/strict');
const { cloneGitHubRepository } = require('./helpers/load').shell;
const { createVirtualFs } = require('./helpers/load').runtime;

(async () => {
  console.log('Testing cloneGitHubRepository streaming onProgress callback...');
  const vfs = createVirtualFs();
  const events = [];

  const mockFetch = async (url) => {
    const u = String(url);
    if (u.includes('api.github.com/repos/acme/demo-repo/git/trees/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tree: [
            { path: 'README.md', type: 'blob', size: 30 },
            { path: 'src/index.js', type: 'blob', size: 45 }
          ]
        })
      };
    }
    if (u.includes('api.github.com/repos/acme/demo-repo')) {
      return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
    }
    if (u.endsWith('/README.md')) {
      return { ok: true, status: 200, text: async () => '# Demo Repo\nStreaming clone test' };
    }
    if (u.endsWith('/src/index.js')) {
      return { ok: true, status: 200, text: async () => 'console.log("Streaming clone ready");' };
    }
    return { ok: false, status: 404 };
  };

  const res = await cloneGitHubRepository('https://github.com/acme/demo-repo.git', vfs, {
    targetDir: '/workspace/demo',
    fetchImpl: mockFetch,
    onProgress: (evt) => {
      events.push(evt);
    }
  });

  console.log('Recorded progress event phases:', events.map((e) => e.phase));

  // Verify all phases in order
  assert.strictEqual(events[0].phase, 'connecting');
  assert.strictEqual(events[1].phase, 'metadata');

  const downloadingEvents = events.filter((e) => e.phase === 'downloading');
  assert.ok(downloadingEvents.length >= 2, 'Must have multiple downloading events');
  assert.strictEqual(downloadingEvents[0].loaded, 0);
  assert.strictEqual(downloadingEvents[0].total, 2);
  assert.strictEqual(downloadingEvents[downloadingEvents.length - 1].loaded, 2);
  assert.strictEqual(downloadingEvents[downloadingEvents.length - 1].total, 2);

  const mountingEvents = events.filter((e) => e.phase === 'mounting');
  assert.strictEqual(mountingEvents.length, 1);
  assert.strictEqual(mountingEvents[0].loaded, 2);
  assert.strictEqual(mountingEvents[0].total, 2);

  const readyEvents = events.filter((e) => e.phase === 'ready');
  assert.strictEqual(readyEvents.length, 1);
  assert.strictEqual(readyEvents[0].loaded, 2);
  assert.strictEqual(readyEvents[0].total, 2);

  // Verify filesystem contents
  assert.strictEqual(vfs.readFileSync('/workspace/demo/README.md', 'utf8'), '# Demo Repo\nStreaming clone test');
  assert.strictEqual(vfs.readFileSync('/workspace/demo/src/index.js', 'utf8'), 'console.log("Streaming clone ready");');
  assert.ok(vfs.existsSync('/workspace/demo/.git/config'));

  // Test error phase reporting
  const errEvents = [];
  try {
    await cloneGitHubRepository('invalid://repo-url', vfs, {
      fetchImpl: mockFetch,
      onProgress: (evt) => errEvents.push(evt)
    });
    assert.fail('Expected invalid repository URL to reject');
  } catch (err) {
    assert.ok(errEvents.length >= 2);
    assert.strictEqual(errEvents[0].phase, 'connecting');
    assert.strictEqual(errEvents[errEvents.length - 1].phase, 'error');
    assert.ok(errEvents[errEvents.length - 1].message.includes('not a valid GitHub repository URL'));
  }

  console.log('✅ cloneGitHubRepository streaming onProgress verified 100%!');
})().catch((err) => {
  console.error('Streaming clone suite failed:', err);
  process.exitCode = 1;
});
