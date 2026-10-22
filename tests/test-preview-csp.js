#!/usr/bin/env node
'use strict';

/**
 * Web Preview CSP builder unit suite (src/csp.ts → CodeLabCsp).
 *
 * The builder is the single source of truth for the policy used by both the
 * workbench (srcdoc fallback) and the preview service worker. These tests pin
 * the parts that must never regress:
 *
 *   - `'self'` is not usable in a sandboxed (opaque-origin) document, so the
 *     host origin is always named literally.
 *   - `strict` blocks every remote host; `balanced` allows only the CDNs the
 *     preview server itself resolves bare imports to.
 *   - Author-supplied allowlists are validated, never spliced in unchecked.
 *   - The injected shims do not contain a `</script>` terminator.
 */

const assert = require('node:assert/strict');
const { csp } = require('./helpers/load.js');

const HOST = 'https://ide.example.com';

function policies() {
  return {
    strict: csp.buildPreviewPolicy({ hostOrigin: HOST, mode: 'strict' }),
    balanced: csp.buildPreviewPolicy({ hostOrigin: HOST, mode: 'balanced' })
  };
}

function directiveOf(policy, name) {
  const match = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  return match ? match.slice(name.length + 1).trim() : null;
}

async function runSuite() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      failed++;
      failures.push({ name, err });
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${err && err.message ? err.message : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   N-01: Web Preview CSP builder');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  await test('C1 the module is exported from the shipped bundle', () => {
    for (const fn of ['buildPreviewPolicy', 'buildPreviewShims', 'describePreviewNetwork', 'normalizePreviewCspConfig', 'normalizeOrigin']) {
      assert.equal(typeof csp[fn], 'function', `CodeLabCsp.${fn} must be exported`);
    }
    assert.equal(typeof csp.PREVIEW_SHIM_MARKER, 'string');
  });

  await test('C2 the host origin is named literally and replaces \'self\'', () => {
    const { balanced } = policies();
    assert.match(directiveOf(balanced, 'default-src'), /^https:\/\/ide\.example\.com /);

    // Everything except frame-ancestors must avoid 'self': inside a sandboxed
    // iframe (opaque origin) 'self' matches no URL at all.
    const withoutAncestors = directiveOf(balanced, 'frame-ancestors')
      ? balanced.slice(0, balanced.indexOf('frame-ancestors'))
      : balanced;
    assert.ok(!withoutAncestors.includes("'self'"), `policy still relies on 'self': ${balanced}`);
  });

  await test('C3 without a usable origin the policy falls back to \'self\'', () => {
    for (const hostOrigin of [undefined, '', 'not a url', 'javascript:alert(1)', 'file:///tmp/x']) {
      const policy = csp.buildPreviewPolicy({ hostOrigin });
      assert.match(directiveOf(policy, 'default-src'), /^'self' /, `hostOrigin ${hostOrigin} should fall back`);
    }
  });

  await test('C4 strict blocks every remote host', () => {
    const { strict } = policies();
    assert.ok(!strict.includes('jsdelivr'), 'strict must not allow jsDelivr');
    assert.ok(!strict.includes('esm.sh'), 'strict must not allow esm.sh');
    const remote = strict.split(/[\s;]+/).filter((part) => /^https:\/\//.test(part) && part !== HOST);
    assert.deepEqual(remote, [], 'strict must not contain any remote https source');
    assert.deepEqual(csp.describePreviewNetwork('strict'), []);
    assert.equal(directiveOf(strict, 'object-src'), "'none'");
    assert.equal(directiveOf(strict, 'frame-ancestors'), "'self'");
  });

  await test('C5 balanced allows exactly the import-map CDNs for scripts and connects', () => {
    const { balanced } = policies();
    const script = directiveOf(balanced, 'script-src');
    assert.ok(script.includes('https://cdn.jsdelivr.net'), 'jsDelivr must be allowed for scripts');
    assert.ok(script.includes('https://esm.sh'), 'esm.sh must be allowed for scripts');
    assert.ok(!script.includes('https://unpkg.com'), 'unrelated CDNs must not be allowed');

    const connect = directiveOf(balanced, 'connect-src');
    assert.ok(connect.includes('https://cdn.jsdelivr.net'));
    assert.ok(connect.includes('https://esm.sh'));

    // Images must not get a blanket https: allowance (exfiltration channel).
    const img = directiveOf(balanced, 'img-src');
    assert.ok(!/\shttps:(\s|$)/.test(img), 'img-src must not allow every https host');

    // Local preview modules are served as data: URLs by the import map, so
    // dropping data: from script-src breaks every multi-file project.
    assert.ok(script.split(' ').includes('data:'), 'script-src must allow data: module URLs');
    assert.ok(!script.split(' ').includes('*'), 'script-src must not allow every host');
  });

  await test('C6 author allowlists are merged, de-duplicated, and validated', () => {
    const policy = csp.buildPreviewPolicy({
      hostOrigin: HOST,
      mode: 'custom',
      scriptSrc: ['https://cdn.example.com', 'https://cdn.example.com', 42, '', '   ', null],
      imgSrc: ['https://img.example.com'],
      bogusDirective: ['https://evil.example.com']
    });

    const script = directiveOf(policy, 'script-src');
    assert.equal((script.match(/https:\/\/cdn\.example\.com/g) || []).length, 1, 'duplicates must be collapsed');
    assert.ok(script.includes('https://img.example.com') === false, 'directives must not leak into each other');
    assert.ok(!policy.includes('evil.example.com'), 'unknown directives must be ignored');
    assert.ok(!policy.includes('42'), 'non-string entries must be dropped');
    assert.ok(!policy.includes('jsdelivr'), 'custom must not inherit the balanced preset');
  });

  await test('C7 normalizePreviewCspConfig accepts modes and rejects junk', () => {
    assert.deepEqual(csp.normalizePreviewCspConfig('strict'), { mode: 'strict', allow: {} });
    assert.deepEqual(csp.normalizePreviewCspConfig('balanced'), { mode: 'balanced', allow: {} });
    assert.deepEqual(csp.normalizePreviewCspConfig(undefined), { mode: 'balanced', allow: {} });
    assert.deepEqual(csp.normalizePreviewCspConfig({ mode: 'nonsense' }).mode, 'balanced');
    assert.deepEqual(csp.normalizePreviewCspConfig([1, 2, 3]), { mode: 'balanced', allow: {} });
    assert.deepEqual(csp.normalizePreviewCspConfig('custom').mode, 'custom');
    assert.deepEqual(
      csp.normalizePreviewCspConfig({ mode: 'strict', connectSrc: ['https://api.example.com'] }).allow,
      { connectSrc: ['https://api.example.com'] }
    );
  });

  await test('C8 source lists are capped so a hostile config cannot balloon the policy', () => {
    const many = Array.from({ length: 200 }, (_, i) => `https://h${i}.example.com`);
    const normalized = csp.normalizePreviewCspConfig({ mode: 'custom', scriptSrc: many });
    assert.equal(normalized.allow.scriptSrc.length, 64);

    const long = csp.normalizePreviewCspConfig({ mode: 'custom', scriptSrc: ['https://a.example/' + 'x'.repeat(600)] });
    assert.equal(long.allow.scriptSrc, undefined, 'oversized sources must be dropped entirely');
  });

  await test('C9 describePreviewNetwork reports remote hosts for the toolbar', () => {
    const hosts = csp.describePreviewNetwork({ mode: 'custom', connectSrc: ['https://api.example.com/v1'], imgSrc: ['https://cdn.example.com'] });
    assert.deepEqual(hosts, ['api.example.com', 'cdn.example.com']);
    assert.deepEqual(csp.describePreviewNetwork('strict'), []);
  });

  await test('C10 normalizeOrigin accepts http(s) origins only', () => {
    assert.equal(csp.normalizeOrigin('https://a.example/path?x=1'), 'https://a.example');
    assert.equal(csp.normalizeOrigin('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
    for (const bad of ['javascript:alert(1)', 'ftp://a.example', 'a.example', '/relative', '', null, undefined, 42]) {
      assert.equal(csp.normalizeOrigin(bad), null, `${bad} must be rejected`);
    }
  });

  await test('C10b directive injection and blanket wildcards are rejected', () => {
    const policy = csp.buildPreviewPolicy({
      hostOrigin: HOST,
      mode: 'custom',
      scriptSrc: ['https://ok.example.com; script-src *', '*', 'https:', '"unsafe-inline"'],
      connectSrc: ['https://ok.example.com']
    });
    assert.ok(!policy.includes('script-src *'), 'semicolon injection must be rejected');
    assert.ok(!/script-src[^;]*\*/.test(policy), 'wildcards must be rejected');
    assert.ok(!/script-src[^;]*https:(\s|;)/.test(policy), 'scheme-only sources must be rejected');
    assert.ok(!policy.includes('"unsafe-inline"'), 'malformed keywords must be rejected');
    assert.ok(directiveOf(policy, 'connect-src').includes('https://ok.example.com'), 'valid sources still work');
  });

  await test('C11 frame-ancestors can be overridden for embed scenarios', () => {
    const policy = csp.buildPreviewPolicy({ hostOrigin: HOST, frameAncestors: 'https://embed.example.com' });
    assert.equal(directiveOf(policy, 'frame-ancestors'), 'https://embed.example.com');
  });

  await test('C12 the injected shims are safe to embed and cannot terminate their <script>', () => {
    const shims = csp.buildPreviewShims();
    assert.ok(shims.includes(csp.PREVIEW_SHIM_MARKER), 'marker must be present for idempotent injection');
    assert.ok(shims.trimStart().startsWith('<script'), 'shims must be a script block');
    assert.ok(shims.trimEnd().endsWith('</script>'));
    assert.equal((shims.match(/<\/script>/g) || []).length, 1, 'shims must contain exactly one closing tag');
    assert.ok(shims.includes("shim('localStorage')"), 'host storage must be replaced on an opaque origin');
    assert.ok(shims.includes("shim('sessionStorage')"));
    assert.ok(shims.includes('securitypolicyviolation'), 'violations must be reported to the host');
    assert.ok(shims.includes('codelab:preview-violation'));
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`N-01 Preview CSP Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) {
      console.log(`- ${f.name}: ${f.err && f.err.stack ? f.err.stack : f.err}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('Fatal preview CSP test error:', err);
  process.exit(1);
});
