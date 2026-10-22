import { test, expect } from '@playwright/test';
import { mount, openPreview, waitForPreviewMessage } from './preview-harness';

/**
 * N-01: the preview CSP must not break CDN-based projects.
 *
 * The built-in preview server resolves bare imports to
 * `https://cdn.jsdelivr.net/npm/<pkg>@<ver>/+esm`, so a React/Vue project is
 * unusable under a `'self'`-only policy. The `balanced` default allows those
 * CDNs; `strict` blocks them and says so; `custom` allows exactly what the host
 * lists.
 *
 * CDN responses are fulfilled locally so the specs are deterministic and do not
 * depend on network access.
 */

const CDN_SCRIPT = 'parent.postMessage({ type: "code-lab-cdn-ran" }, "*");';

function withModuleImport(src: string) {
  return `<!doctype html><html><head><title>cdn</title></head><body>
    <script type="module">
      import ${JSON.stringify(src)};
    </script>
    <p>app</p>
  </body></html>`;
}

// Match only the spec's probe module: the IDE itself loads Monaco's worker from
// jsDelivr, and those requests are not part of what the preview CSP governs.
async function routeCdn(page: import('@playwright/test').Page, pattern: string, requested: string[]) {
  await page.route(pattern, async (route) => {
    requested.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: CDN_SCRIPT });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixtures/');
});

test('balanced (default) allows import-map CDN modules', async ({ page }) => {
  const requested: string[] = [];
  await routeCdn(page, 'https://cdn.jsdelivr.net/npm/probe@**', requested);

  const ran = waitForPreviewMessage(page, 'code-lab-cdn-ran');
  await mount(page);
  await openPreview(page, withModuleImport('https://cdn.jsdelivr.net/npm/probe@1.0.0/+esm'));

  expect(await ran).not.toBeNull();
  expect(requested.length).toBeGreaterThan(0);
  await expect(page.locator('#cl-preview-csp-status')).toBeHidden();
  await expect(page.locator('#cl-preview-csp-badge')).toContainText('cdn.jsdelivr.net');
});

test('strict blocks the CDN and surfaces the violation', async ({ page }) => {
  const requested: string[] = [];
  await routeCdn(page, 'https://cdn.jsdelivr.net/npm/probe@**', requested);

  const ran = waitForPreviewMessage(page, 'code-lab-cdn-ran', 2000);
  await mount(page, { previewCsp: 'strict' });
  await openPreview(page, withModuleImport('https://cdn.jsdelivr.net/npm/probe@1.0.0/+esm'));

  expect(await ran).toBeNull();
  expect(requested).toEqual([]);
  await expect(page.locator('#cl-preview-csp-status')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#cl-preview-csp-status')).toContainText('cdn.jsdelivr.net');
  await expect(page.locator('#cl-preview-csp-badge')).toHaveText('CSP: strict');
});

test('custom mode allows exactly the listed hosts', async ({ page }) => {
  const cdnRequests: string[] = [];
  const assetRequests: string[] = [];
  await routeCdn(page, 'https://cdn.jsdelivr.net/npm/probe@**', cdnRequests);
  await routeCdn(page, 'https://assets.example.com/**', assetRequests);

  const cdnRan = waitForPreviewMessage(page, 'code-lab-cdn-ran', 2000);
  await mount(page, { previewCsp: { mode: 'custom', scriptSrc: ['https://assets.example.com'] } });
  await openPreview(page, withModuleImport('https://cdn.jsdelivr.net/npm/probe@1.0.0/+esm'));
  expect(await cdnRan).toBeNull();
  expect(cdnRequests).toEqual([]);

  // The same workbench does allow the host it was told about.
  const assetRan = waitForPreviewMessage(page, 'code-lab-cdn-ran');
  await openPreview(page, withModuleImport('https://assets.example.com/lib.js'), 3003);
  expect(await assetRan).not.toBeNull();
  expect(assetRequests.length).toBeGreaterThan(0);
});

test('invalid allowlist entries are dropped instead of widening the policy', async ({ page }) => {
  await mount(page, { previewCsp: { mode: 'custom', scriptSrc: ['*', 'https:', 'https://ok.example.com; script-src *'] } });

  const policy = await page.evaluate(() => window.__codelabTest.ide._previewPolicy());
  expect(policy).not.toContain('script-src *');
  expect(policy).not.toMatch(/script-src[^;]*\*/);
  expect(await page.evaluate(() => window.__codelabTest.ide._previewNetworkHosts())).toEqual([]);
});
