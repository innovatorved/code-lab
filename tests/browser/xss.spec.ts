import { test, expect } from '@playwright/test';

/**
 * Browser-level markdown XSS regression.
 *
 * These specs exercise the real Guide pane, which renders README and step
 * instructions through the markdown renderer and assigns the result to
 * `innerHTML`. That is the exact sink an attacker-controlled repository README
 * reaches.
 */

const XSS_README = [
  '# Project README',
  '',
  '<script>window.__xss = true</script>',
  '<img src=x onerror="window.__xss = true">',
  '<svg onload="window.__xss = true"></svg>',
  '<iframe src="javascript:window.__xss = true"></iframe>',
  '<details open ontoggle="window.__xss = true">details</details>',
  '[click me](javascript:window.__xss=true)',
  '[data link](data:text/html,<script>window.__xss=true</script>)',
  '<https://example.com>'
].join('\n\n');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    (window as any).__xss = false;
    // If a payload manages to execute, record it instead of opening a dialog.
    (window as any).alert = () => { (window as any).__xss = true; };
    (window as any).confirm = () => { (window as any).__xss = true; return false; };
    (window as any).prompt = () => { (window as any).__xss = true; return null; };
  });
  await page.goto('/tests/browser/fixtures/');
});

async function mountGuideWith(page: import('@playwright/test').Page, readme: string) {
  await page.evaluate((markdown) => {
    (window as any).__codelabTest.mount({
      hasGuidedLab: true,
      mode: 'guided',
      files: {
        'README.md': markdown,
        'index.js': 'console.log("safe");'
      },
      steps: [
        { id: 'step-1', title: 'Step 1', instructions: markdown }
      ]
    });
  }, readme);
}

test('malicious step instructions render as inert text', async ({ page }) => {
  await mountGuideWith(page, XSS_README);

  const guide = page.locator('#cl-guide-content');
  await expect(guide).toContainText('<script>');

  const result = await page.evaluate(() => {
    const root = document.getElementById('cl-guide-content');
    return {
      xss: (window as any).__xss,
      scripts: root ? root.querySelectorAll('script').length : -1,
      iframes: root ? root.querySelectorAll('iframe').length : -1,
      images: root ? root.querySelectorAll('img').length : -1,
      eventAttrs: root
        ? Array.from(root.querySelectorAll('*')).filter(el =>
            Array.from(el.attributes).some(attr => /^on/i.test(attr.name))
          ).length
        : -1,
      hrefs: root ? Array.from(root.querySelectorAll('a')).map(a => a.getAttribute('href') || '') : []
    };
  });

  expect(result.xss).toBe(false);
  expect(result.scripts).toBe(0);
  expect(result.iframes).toBe(0);
  expect(result.images).toBe(0);
  expect(result.eventAttrs).toBe(0);
  for (const href of result.hrefs) {
    expect(href.toLowerCase()).not.toContain('javascript:');
    expect(href.toLowerCase()).not.toContain('data:text/html');
  }
});

test('malicious README tab renders as inert text', async ({ page }) => {
  await mountGuideWith(page, XSS_README);

  await page.locator('[data-cl-guidetab="readme"]').click();

  const guide = page.locator('#cl-guide-content');
  await expect(guide).toContainText('<script>');
  await expect(guide).toContainText('click me');

  // Clicking the neutralized javascript: link must not execute anything.
  await page.locator('#cl-guide-content a', { hasText: 'click me' }).click();
  await page.waitForTimeout(100);

  const result = await page.evaluate(() => {
    const root = document.getElementById('cl-guide-content');
    const link = Array.from(root?.querySelectorAll('a') || []).find(a => a.textContent === 'click me');
    return {
      xss: (window as any).__xss,
      href: link ? link.getAttribute('href') : null,
      activeTag: document.activeElement ? document.activeElement.tagName.toLowerCase() : null
    };
  });

  expect(result.xss).toBe(false);
  expect(result.href).toBe('#');
});
