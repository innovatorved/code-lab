/**
 * @file test-m1-challenger-stress.js
 * Comprehensive Adversarial & Empirical Stress Test Suite for Milestone 1:
 * - cloneGitHubRepository: all onProgress callback phases, schemas, failure modes, rate limits, batching, filtering.
 * - POSIX Shell: pipeline cascades, exit code semantics, redirections, quoting, and complex coreutils.
 */

'use strict';

const assert = require('node:assert/strict');
const { cloneGitHubRepository, createPosixShell } = require('../src/shell.ts');
const { createVirtualFs } = require('../src/runtime.ts');
const { CloneProgressEventSchema } = require('../src/schemas.ts');

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

(async () => {
  console.log('======================================================================');
  console.log('  MILESTONE 1 EMPIRICAL CHALLENGER STRESS SUITE (challenger_m1_2)');
  console.log('======================================================================\n');

  // =========================================================================
  // SUITE 1: cloneGitHubRepository Progress Phases, Schemas & Edge Cases
  // =========================================================================
  console.log('--- Suite 1: cloneGitHubRepository Stress & Progress Verification ---');

  await test('1.1 Standard clone: all 5 progress phases in strict order, Zod validated', async () => {
    const vfs = createVirtualFs();
    const events = [];

    const mockFetch = async (url) => {
      const u = String(url);
      if (u.includes('api.github.com/repos/test-org/repo-a/git/trees/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tree: [
              { path: 'README.md', type: 'blob', size: 100 },
              { path: 'src/app.ts', type: 'blob', size: 250 },
              { path: 'package.json', type: 'blob', size: 180 }
            ]
          })
        };
      }
      if (u.includes('api.github.com/repos/test-org/repo-a')) {
        return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
      }
      if (u.endsWith('/README.md')) {
        return { ok: true, status: 200, text: async () => '# Repo A' };
      }
      if (u.endsWith('/src/app.ts')) {
        return { ok: true, status: 200, text: async () => 'export const app = "running";' };
      }
      if (u.endsWith('/package.json')) {
        return { ok: true, status: 200, text: async () => '{"name":"repo-a"}' };
      }
      return { ok: false, status: 404 };
    };

    const result = await cloneGitHubRepository('https://github.com/test-org/repo-a', vfs, {
      targetDir: '/workspace/repo-a',
      fetchImpl: mockFetch,
      onProgress: (evt) => {
        // Validate every single event with Zod schema:
        CloneProgressEventSchema.parse(evt);
        events.push(evt);
      }
    });

    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.branch, 'main');
    assert.strictEqual(vfs.readFileSync('/workspace/repo-a/README.md', 'utf8'), '# Repo A');
    assert.strictEqual(vfs.readFileSync('/workspace/repo-a/src/app.ts', 'utf8'), 'export const app = "running";');
    assert.strictEqual(vfs.readFileSync('/workspace/repo-a/package.json', 'utf8'), '{"name":"repo-a"}');

    // Verify phase transitions:
    // Expected phases: connecting -> metadata -> downloading (0) -> downloading (1) -> downloading (2) -> downloading (3) -> mounting -> ready
    assert.strictEqual(events[0].phase, 'connecting');
    assert.strictEqual(events[1].phase, 'metadata');

    const downloadEvents = events.filter((e) => e.phase === 'downloading');
    assert.strictEqual(downloadEvents.length, 4, 'Must have initial 0/3 plus 3 file download events');
    assert.strictEqual(downloadEvents[0].loaded, 0);
    assert.strictEqual(downloadEvents[0].total, 3);
    assert.strictEqual(downloadEvents[1].loaded, 1);
    assert.strictEqual(downloadEvents[2].loaded, 2);
    assert.strictEqual(downloadEvents[3].loaded, 3);
    assert.strictEqual(downloadEvents[3].total, 3);

    const mountingEvts = events.filter((e) => e.phase === 'mounting');
    assert.strictEqual(mountingEvts.length, 1);
    assert.strictEqual(mountingEvts[0].loaded, 3);
    assert.strictEqual(mountingEvts[0].total, 3);

    const readyEvts = events.filter((e) => e.phase === 'ready');
    assert.strictEqual(readyEvts.length, 1);
    assert.strictEqual(readyEvts[0].loaded, 3);
    assert.strictEqual(readyEvts[0].total, 3);

    // Verify .git metadata was created properly
    assert.ok(vfs.existsSync('/workspace/repo-a/.git/HEAD'));
    assert.strictEqual(vfs.readFileSync('/workspace/repo-a/.git/HEAD', 'utf8').trim(), 'ref: refs/heads/main');
    assert.ok(vfs.existsSync('/workspace/repo-a/.git/config'));
    assert.ok(vfs.readFileSync('/workspace/repo-a/.git/config', 'utf8').includes('test-org/repo-a'));
  });

  await test('1.2 jsDelivr fallback when GitHub API is rate-limited (HTTP 403 / 429)', async () => {
    const vfs = createVirtualFs();
    const events = [];

    const mockFetch = async (url) => {
      const u = String(url);
      // Simulate GitHub API rate limit (403 Forbidden)
      if (u.includes('api.github.com/')) {
        return { ok: false, status: 403, statusText: 'rate limit exceeded' };
      }
      // jsDelivr flat API fallback
      if (u.includes('data.jsdelivr.com/v1/package/gh/test-org/repo-fallback@main/flat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              { name: '/index.js', size: 40 },
              { name: '/docs/guide.md', size: 90 }
            ]
          })
        };
      }
      if (u.includes('cdn.jsdelivr.net/gh/test-org/repo-fallback@main/index.js')) {
        return { ok: true, status: 200, text: async () => 'console.log("fallback ok");' };
      }
      if (u.includes('cdn.jsdelivr.net/gh/test-org/repo-fallback@main/docs/guide.md')) {
        return { ok: true, status: 200, text: async () => '# Fallback Guide' };
      }
      return { ok: false, status: 404 };
    };

    const result = await cloneGitHubRepository('test-org/repo-fallback', vfs, {
      branch: 'main',
      targetDir: '/workspace/fallback',
      fetchImpl: mockFetch,
      onProgress: (evt) => {
        CloneProgressEventSchema.parse(evt);
        events.push(evt);
      }
    });

    assert.strictEqual(result.count, 2);
    assert.strictEqual(vfs.readFileSync('/workspace/fallback/index.js', 'utf8'), 'console.log("fallback ok");');
    assert.strictEqual(vfs.readFileSync('/workspace/fallback/docs/guide.md', 'utf8'), '# Fallback Guide');

    // Ensure phases fired correctly despite fallback
    assert.strictEqual(events[0].phase, 'connecting');
    assert.strictEqual(events[1].phase, 'metadata');
    assert.strictEqual(events[events.length - 1].phase, 'ready');
  });

  await test('1.3 Invalid repo URL formats emit error phase and reject', async () => {
    const vfs = createVirtualFs();
    const badUrls = [
      '',
      '   ',
      'invalid://domain.com/no/repo',
      'just-a-string-without-slash',
      'http:///missing-owner',
      'https://github.com/'
    ];

    for (const badUrl of badUrls) {
      const events = [];
      let threw = false;
      try {
        await cloneGitHubRepository(badUrl, vfs, {
          onProgress: (evt) => {
            CloneProgressEventSchema.parse(evt);
            events.push(evt);
          }
        });
      } catch (err) {
        threw = true;
        assert.ok(events.length >= 2, `Expected at least connecting & error events for ${badUrl}`);
        assert.strictEqual(events[0].phase, 'connecting');
        assert.strictEqual(events[events.length - 1].phase, 'error');
        assert.ok(events[events.length - 1].message.length > 0);
      }
      assert.ok(threw, `Expected ${badUrl} to throw`);
    }
  });

  await test('1.4 Missing repository 404 on both GitHub API and jsDelivr emits error phase', async () => {
    const vfs = createVirtualFs();
    const events = [];

    const mock404Fetch = async () => ({ ok: false, status: 404, statusText: 'Not Found' });

    let threw = false;
    try {
      await cloneGitHubRepository('github.com/ghost-owner/ghost-repo', vfs, {
        fetchImpl: mock404Fetch,
        onProgress: (evt) => {
          CloneProgressEventSchema.parse(evt);
          events.push(evt);
        }
      });
    } catch (err) {
      threw = true;
      assert.ok(events.length >= 3);
      assert.strictEqual(events[0].phase, 'connecting');
      assert.strictEqual(events[1].phase, 'metadata');
      assert.strictEqual(events[events.length - 1].phase, 'error');
      assert.ok(events[events.length - 1].message.includes('not found') || events[events.length - 1].message.includes('could not be fetched'));
    }
    assert.ok(threw, 'Expected 404 repo to throw');
  });

  await test('1.5 Binary & heavy files and oversize files are filtered out', async () => {
    const vfs = createVirtualFs();
    const mockFetch = async (url) => {
      const u = String(url);
      if (u.includes('api.github.com/repos/test-org/repo-filter/git/trees/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tree: [
              { path: 'code.js', type: 'blob', size: 100 },
              { path: 'image.png', type: 'blob', size: 500 }, // binary
              { path: 'archive.tar.gz', type: 'blob', size: 2000 }, // binary
              { path: 'video.mp4', type: 'blob', size: 9000 }, // binary
              { path: 'node_modules/dep/index.js', type: 'blob', size: 100 }, // node_modules
              { path: '.git/objects/abc', type: 'blob', size: 50 }, // .git
              { path: 'giant.txt', type: 'blob', size: 1024 * 1024 } // 1MB > 50KB maxFileSize
            ]
          })
        };
      }
      if (u.includes('api.github.com/repos/test-org/repo-filter')) {
        return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
      }
      if (u.endsWith('/code.js')) {
        return { ok: true, status: 200, text: async () => 'console.log("only text");' };
      }
      return { ok: false, status: 404 };
    };

    const res = await cloneGitHubRepository('test-org/repo-filter', vfs, {
      targetDir: '/workspace/filter',
      maxFileSize: 50 * 1024, // 50KB max
      fetchImpl: mockFetch
    });

    assert.strictEqual(res.count, 1, 'Only code.js should be downloaded');
    assert.strictEqual(vfs.readFileSync('/workspace/filter/code.js', 'utf8'), 'console.log("only text");');
    assert.strictEqual(vfs.existsSync('/workspace/filter/image.png'), false);
    assert.strictEqual(vfs.existsSync('/workspace/filter/archive.tar.gz'), false);
    assert.strictEqual(vfs.existsSync('/workspace/filter/giant.txt'), false);
    assert.strictEqual(vfs.existsSync('/workspace/filter/node_modules'), false);
  });

  await test('1.6 Batching stress: 50 files concurrent download batches (BATCH_SIZE=12)', async () => {
    const vfs = createVirtualFs();
    const totalFiles = 50;
    const filesMap = {};
    const tree = [];

    for (let i = 1; i <= totalFiles; i++) {
      const p = `src/file_${i.toString().padStart(3, '0')}.ts`;
      const content = `// Content of file ${i}\nexport const x${i} = ${i};`;
      filesMap[p] = content;
      tree.push({ path: p, type: 'blob', size: content.length });
    }

    const mockFetch = async (url) => {
      const u = String(url);
      if (u.includes('/git/trees/')) {
        return { ok: true, status: 200, json: async () => ({ tree }) };
      }
      if (u.includes('api.github.com/repos/test/batch-stress')) {
        return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
      }
      for (const [p, content] of Object.entries(filesMap)) {
        if (u.endsWith(p)) {
          return { ok: true, status: 200, text: async () => content };
        }
      }
      return { ok: false, status: 404 };
    };

    let lastLoaded = -1;
    const res = await cloneGitHubRepository('test/batch-stress', vfs, {
      targetDir: '/workspace/batch-test',
      maxFiles: 100,
      fetchImpl: mockFetch,
      onProgress: (evt) => {
        CloneProgressEventSchema.parse(evt);
        if (evt.phase === 'downloading') {
          assert.ok(evt.loaded >= lastLoaded, 'loaded count must advance monotonically');
          lastLoaded = evt.loaded;
          assert.strictEqual(evt.total, 50);
        }
      }
    });

    assert.strictEqual(res.count, 50);
    assert.strictEqual(lastLoaded, 50);
    for (let i = 1; i <= totalFiles; i++) {
      const p = `/workspace/batch-test/src/file_${i.toString().padStart(3, '0')}.ts`;
      assert.strictEqual(vfs.existsSync(p), true);
      assert.strictEqual(vfs.readFileSync(p, 'utf8'), filesMap[`src/file_${i.toString().padStart(3, '0')}.ts`]);
    }
  });

  await test('1.7 Subpath clone: owner/repo/tree/main/subfolder extracts only subtree', async () => {
    const vfs = createVirtualFs();
    const mockFetch = async (url) => {
      const u = String(url);
      if (u.includes('/git/trees/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tree: [
              { path: 'root.txt', type: 'blob', size: 10 },
              { path: 'packages/ui/index.ts', type: 'blob', size: 30 },
              { path: 'packages/ui/styles.css', type: 'blob', size: 40 },
              { path: 'packages/core/index.ts', type: 'blob', size: 50 }
            ]
          })
        };
      }
      if (u.includes('api.github.com/repos/mono/repo')) {
        return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
      }
      if (u.endsWith('packages/ui/index.ts')) {
        return { ok: true, status: 200, text: async () => 'export const UI = true;' };
      }
      if (u.endsWith('packages/ui/styles.css')) {
        return { ok: true, status: 200, text: async () => 'body { color: red; }' };
      }
      return { ok: false, status: 404 };
    };

    const res = await cloneGitHubRepository('https://github.com/mono/repo/tree/main/packages/ui', vfs, {
      targetDir: '/workspace/subpath',
      fetchImpl: mockFetch
    });

    assert.strictEqual(res.count, 2);
    assert.strictEqual(vfs.readFileSync('/workspace/subpath/index.ts', 'utf8'), 'export const UI = true;');
    assert.strictEqual(vfs.readFileSync('/workspace/subpath/styles.css', 'utf8'), 'body { color: red; }');
    assert.strictEqual(vfs.existsSync('/workspace/subpath/root.txt'), false);
    assert.strictEqual(vfs.existsSync('/workspace/subpath/packages'), false);
  });

  // =========================================================================
  // SUITE 2: POSIX Shell Pipeline Cascades & Exit Code Semantics
  // =========================================================================
  console.log('\n--- Suite 2: Shell Pipeline Cascades & Exit Code Semantics ---');

  await test('2.1 150-stage deep pipeline cascade data throughput', async () => {
    const shell = createPosixShell();
    const stages = 150;
    const cmd = 'echo "start-token" ' + '| cat '.repeat(stages) + '| tr a-z A-Z';
    const res = await shell.execute(cmd);
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'START-TOKEN');
  });

  await test('2.2 Pipeline exit code semantics: exit code of last command wins', async () => {
    const shell = createPosixShell();

    // true | false -> exit code 1
    let r = await shell.execute('true | false');
    assert.strictEqual(r.code, 1);

    // false | true -> exit code 0
    r = await shell.execute('false | true');
    assert.strictEqual(r.code, 0);

    // echo "hi" | grep "nonexistent" -> grep returns 1
    r = await shell.execute('echo "hi" | grep "nonexistent"');
    assert.strictEqual(r.code, 1);

    // echo "hi" | grep "nonexistent" | cat -> cat returns 0
    r = await shell.execute('echo "hi" | grep "nonexistent" | cat');
    assert.strictEqual(r.code, 0);
  });

  await test('2.3 High throughput pipeline stream (10,000 items)', async () => {
    const shell = createPosixShell();
    const res = await shell.execute('seq 1 10000 | tr 0 9 | grep 9999 | wc -l');
    assert.strictEqual(res.code, 0);
    const count = parseInt(res.stdout.trim(), 10);
    assert.ok(count >= 1, `Expected matches >= 1, got ${count}`);
  });

  await test('2.4 Pipeline combined with sort, uniq, awk, head, tail', async () => {
    const shell = createPosixShell();
    const cmd = `
      printf "banana\\napple\\nbanana\\ncherry\\napple\\nbanana\\n" | sort | uniq -c | sort -n
    `;
    const res = await shell.execute(cmd);
    assert.strictEqual(res.code, 0);
    const lines = res.stdout.trim().split('\n').map((l) => l.trim());
    assert.ok(lines.some((l) => l.includes('1 cherry')));
    assert.ok(lines.some((l) => l.includes('2 apple')));
    assert.ok(lines.some((l) => l.includes('3 banana')));
  });

  await test('2.5 Conditional operators && and || mixed with pipelines', async () => {
    const shell = createPosixShell();

    // false | false -> fails, so || branch triggers
    let res = await shell.execute('false | false || echo "recovered"');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'recovered');

    // true | true -> succeeds, so && branch triggers
    res = await shell.execute('echo "a" | cat && echo "b" | cat');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'a\nb');
  });

  // =========================================================================
  // SUITE 3: Shell Redirections & File Descriptors
  // =========================================================================
  console.log('\n--- Suite 3: Shell Redirection & File Descriptors ---');

  await test('3.1 Input and output redirection roundtrip across nested paths', async () => {
    const shell = createPosixShell();
    await shell.execute('mkdir -p /workspace/data');
    await shell.execute('echo "alpha beta gamma" > /workspace/data/in.txt');
    await shell.execute('tr " " "\\n" < /workspace/data/in.txt > /workspace/data/out.txt');
    const res = await shell.execute('cat /workspace/data/out.txt');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'alpha\nbeta\ngamma');
  });

  await test('3.2 Append redirection >> vs truncate >', async () => {
    const shell = createPosixShell();
    await shell.execute('echo "line 1" > /workspace/test.txt');
    await shell.execute('echo "line 2" >> /workspace/test.txt');
    await shell.execute('echo "line 3" >> /workspace/test.txt');
    let res = await shell.execute('cat /workspace/test.txt');
    assert.strictEqual(res.stdout.trim(), 'line 1\nline 2\nline 3');

    // Truncate
    await shell.execute('echo "new start" > /workspace/test.txt');
    res = await shell.execute('cat /workspace/test.txt');
    assert.strictEqual(res.stdout.trim(), 'new start');
  });

  await test('3.3 Stderr redirection 2> and merged redirection 2>&1', async () => {
    const shell = createPosixShell();

    // ls non-existent file with 2>
    await shell.execute('ls /does_not_exist 2> /workspace/err.log');
    let res = await shell.execute('cat /workspace/err.log');
    assert.ok(res.stdout.includes('No such file') || res.stdout.includes('does_not_exist'));

    // Combined 2>&1 into pipeline
    res = await shell.execute('ls /does_not_exist 2>&1 | tr a-z A-Z');
    assert.strictEqual(res.code, 0); // tr succeeds
    assert.ok(res.stdout.includes('NO SUCH FILE') || res.stdout.includes('DOES_NOT_EXIST'));
  });

  // =========================================================================
  // SUITE 4: Supported Coreutils & Shell Robustness
  // =========================================================================
  console.log('\n--- Suite 4: Supported Coreutils & Shell Robustness ---');

  await test('4.1 Find, diff, cut, tr in complex directory structures', async () => {
    const shell = createPosixShell();
    await shell.execute('mkdir -p /workspace/tree/a/b /workspace/tree/c');
    await shell.execute('echo "hello" > /workspace/tree/a/file1.txt');
    await shell.execute('echo "hello world" > /workspace/tree/a/b/file2.txt');
    await shell.execute('echo "differing content" > /workspace/tree/c/file3.txt');

    // find -name
    let res = await shell.execute('find /workspace/tree -name "*.txt" | sort');
    assert.strictEqual(res.code, 0);
    const files = res.stdout.trim().split('\n');
    assert.strictEqual(files.length, 3);

    // diff identical and differing files
    res = await shell.execute('diff /workspace/tree/a/file1.txt /workspace/tree/a/file1.txt');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), '');

    res = await shell.execute('diff /workspace/tree/a/file1.txt /workspace/tree/c/file3.txt');
    assert.strictEqual(res.code, 1);
    assert.ok(res.stdout.includes('hello'));
  });

  await test('4.2 Sed and Awk stream processing', async () => {
    const shell = createPosixShell();

    // sed regex substitution
    let res = await shell.execute('echo "foo 123 bar 456" | sed "s/[0-9]+/NUM/g"');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'foo NUM bar NUM');

    // sed line deletion
    res = await shell.execute('printf "line 1\\nline 2\\nline 3\\n" | sed "2d"');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'line 1\nline 3');

    // awk print fields and NR/NF
    const awkCmd = `printf "apple 10\\nbanana 25\\ncherry 15\\n" | awk "{print \\$2, \\$1, NR}"`;
    res = await shell.execute(awkCmd);
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), '10 apple 1\n25 banana 2\n15 cherry 3');
  });

  await test('4.3 Command substitution $(...) and arithmetic expansion $((...))', async () => {
    const shell = createPosixShell();

    let res = await shell.execute('echo "The sum is: $((10 * 5 + 3))"');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'The sum is: 53');

    res = await shell.execute('echo "Sub: $(echo inner | tr a-z A-Z)"');
    assert.strictEqual(res.code, 0);
    assert.strictEqual(res.stdout.trim(), 'Sub: INNER');
  });

  await test('4.4 Variable scoping, export, and $? exit code capture', async () => {
    const shell = createPosixShell();

    await shell.execute('MY_VAR="hello world"');
    let res = await shell.execute('echo "$MY_VAR"');
    assert.strictEqual(res.stdout.trim(), 'hello world');

    // Test $? after success and failure
    await shell.execute('true');
    res = await shell.execute('echo "code: $?"');
    assert.strictEqual(res.stdout.trim(), 'code: 0');

    await shell.execute('false');
    res = await shell.execute('echo "code: $?"');
    assert.strictEqual(res.stdout.trim(), 'code: 1');
  });

  console.log('\n======================================================================');
  console.log(`  CHALLENGER SUITE SUMMARY: ${summary.passed}/${summary.total} PASSED`);
  if (summary.failed > 0) {
    console.log(`  \x1b[31m${summary.failed} TESTS FAILED\x1b[0m`);
    process.exit(1);
  } else {
    console.log('  \x1b[32mALL TESTS PASSED WITH 100% SUCCESS!\x1b[0m');
    console.log('======================================================================');
  }
})();
