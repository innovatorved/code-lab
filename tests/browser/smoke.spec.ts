import { test, expect } from '@playwright/test';

/**
 * Browser smoke tests.
 *
 * These run against the real built bundle in a real browser. They deliberately
 * block the Monaco CDN so the suite is hermetic and fast; the workbench must
 * fall back to its textarea editor.
 */

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/tests/browser/fixtures/');
});

test('mounts the workbench with its core layout', async ({ page }) => {
  await expect(page.locator('.codelab-workbench')).toBeVisible();
  await expect(page.locator('.codelab-topbar')).toBeVisible();
  await expect(page.locator('.codelab-explorer')).toBeVisible();
  await expect(page.locator('.codelab-editor-col')).toBeVisible();
});

test('exposes a semver SDK version', async ({ page }) => {
  const version = await page.evaluate(() => (window as any).CodeLab.version);
  expect(version).toMatch(/^\d+\.\d+\.\d+/);
});

test('exposes the markdown renderer to the browser SDK', async ({ page }) => {
  const html = await page.evaluate(() =>
    (window as any).CodeLab.renderMarkdown('# Title\n\nSome **bold** text.')
  );
  expect(html).toMatch(/<h[12][ >]/);
  expect(html).toContain('<strong>bold</strong>');
});
