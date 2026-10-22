import { test, expect } from '@playwright/test';
import { HOST_ORIGIN, mountPreview, openPreview, readPreviewCsp, waitForPreviewMessage } from './preview-harness';

/**
 * Browser-level Web Preview hardening (N-01).
 *
 * The preview document is sandboxed **without** `allow-same-origin`, so it has
 * an opaque origin. Two consequences these specs pin down:
 *
 *   1. `'self'` matches nothing inside the frame — the CSP must name the host
 *      origin literally or the app's own assets are blocked.
 *   2. Preview code cannot touch `parent.document` or host storage, while
 *      inline scripts, `postMessage` and shimmed storage keep working.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixtures/');
});

test('preview iframe is sandboxed without allow-same-origin', async ({ page }) => {
  await mountPreview(page, '<!doctype html><html><head><title>App</title></head><body>preview</body></html>');

  const attrs = await page.evaluate(() => {
    const iframe = document.querySelector('#cl-preview-iframe');
    return {
      sandbox: iframe ? iframe.getAttribute('sandbox') : null,
      allow: iframe ? iframe.getAttribute('allow') : null,
      referrerpolicy: iframe ? iframe.getAttribute('referrerpolicy') : null
    };
  });

  expect(attrs.sandbox).toContain('allow-scripts');
  expect(attrs.sandbox).toContain('allow-forms');
  // allow-scripts + allow-same-origin lets a preview rewrite its own sandbox.
  expect(attrs.sandbox).not.toContain('allow-same-origin');
  expect(attrs.allow).toContain('camera');
  expect(attrs.allow).toContain('geolocation');
  expect(attrs.referrerpolicy).toBe('no-referrer-when-downgrade');
});

test("preview CSP names the host origin because 'self' would be opaque", async ({ page }) => {
  await mountPreview(page, '<!doctype html><html><head></head><body>hello</body></html>');

  const policy = await page.evaluate(() => window.__codelabTest.ide._previewPolicy());
  expect(policy).toContain(`default-src ${HOST_ORIGIN} data: blob:`);
  expect(policy).toContain("object-src 'none'");
  const beforeAncestors = policy.slice(0, policy.indexOf('frame-ancestors'));
  expect(beforeAncestors).not.toContain("'self'");

  const srcdoc = await readPreviewCsp(page);
  expect(srcdoc).toContain('http-equiv="Content-Security-Policy"');
  expect(srcdoc).toContain('data-codelab-preview-shims');
  expect(srcdoc).toContain('<base href="/__preview/3000/">');
  // Exactly one policy and one set of shims.
  expect(srcdoc.match(/Content-Security-Policy/g)).toHaveLength(1);
  expect(srcdoc.match(/data-codelab-preview-shims/g)).toHaveLength(1);
});

test('inline scripts run inside the sandbox', async ({ page }) => {
  const message = waitForPreviewMessage(page, 'code-lab-inline-ran');
  await mountPreview(
    page,
    '<!doctype html><html><body><script>parent.postMessage({ type: "code-lab-inline-ran" }, "*");</script><p>hi</p></body></html>'
  );

  expect(await message).not.toBeNull();
});

test('a third-party script is blocked and reported in the toolbar', async ({ page }) => {
  const message = waitForPreviewMessage(page, 'code-lab-evil-ran', 2000);
  await mountPreview(
    page,
    '<!doctype html><html><body><script src="https://evil.example/x.js"></script><p>preview</p></body></html>'
  );

  expect(await message).toBeNull();
  await expect(page.locator('#cl-preview-csp-status')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#cl-preview-csp-status')).toContainText('evil.example');
});

test('a CSP violation is emitted to hosts via preview-violation', async ({ page }) => {
  await mountPreview(page, '<!doctype html><html><body><p>idle</p></body></html>');

  const detail = page.evaluate(
    () =>
      new Promise<any>((resolve) => {
        window.__codelabTest.ide.on('preview-violation', (value: any) => resolve(value));
      })
  );

  await openPreview(
    page,
    '<!doctype html><html><body><script src="https://evil.example/tracker.js"></script></body></html>',
    3001
  );

  const violation = await detail;
  expect(violation.blockedURI).toContain('evil.example');
  expect(violation.directive).toContain('script-src');
});
