import { test, expect } from '@playwright/test';
import { mountPreview, openPreview, waitForPreviewMessage } from './preview-harness';

/**
 * Preview isolation (N-02, first slice).
 *
 * Previews run in a sandboxed iframe with `allow-scripts` but **no**
 * `allow-same-origin`. The document therefore has an opaque origin:
 *
 *   - `parent.document` / host `localStorage` throw `SecurityError`
 *   - `location.origin` is the string `"null"`
 *   - the storage shim keeps apps that touch `localStorage` at import time alive
 *
 * The cross-origin relay (a real second origin) is not shipped yet; when it
 * lands, these assertions must keep holding for the relayed mode too.
 */

const PROBE = `<!doctype html>
<html>
  <head><title>probe</title></head>
  <body>
    <script>
      var results = { origin: String(window.origin), locationOrigin: String(location.origin) };

      try { results.parentDocument = Boolean(parent.document); }
      catch (err) { results.parentDocument = err.name; }

      try { results.hostStorage = Boolean(parent.localStorage); }
      catch (err) { results.hostStorage = err.name; }

      try {
        localStorage.setItem('probe', 'ok');
        results.ownStorage = localStorage.getItem('probe');
      } catch (err) {
        results.ownStorage = err.name;
      }

      parent.postMessage({ type: 'code-lab-isolation-probe', results: results }, '*');
    </script>
  </body>
</html>`;

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixtures/');
});

test('preview code cannot reach the host document or host storage', async ({ page }) => {
  const probe = waitForPreviewMessage<{ results: any }>(page, 'code-lab-isolation-probe');
  await mountPreview(page, PROBE);
  const message = await probe;

  expect(message).not.toBeNull();
  const results = message!.results;
  expect(results.parentDocument).toBe('SecurityError');
  expect(results.hostStorage).toBe('SecurityError');
  // Opaque origin: postMessage still works, but the origin cannot be used to
  // authenticate the sender — the host matches `event.source` instead.
  expect(results.origin).toBe('null');
  expect(results.locationOrigin).toBe('null');
});

test('the storage shim keeps previews that use localStorage alive', async ({ page }) => {
  const probe = waitForPreviewMessage<{ results: any }>(page, 'code-lab-isolation-probe');
  await mountPreview(page, PROBE);
  const results = (await probe)!.results;

  // Without the injected shim this would be "SecurityError", and any app that
  // reads localStorage during module evaluation would fail to boot.
  expect(results.ownStorage).toBe('ok');
});

test('a forged message from another window is ignored', async ({ page }) => {
  await mountPreview(page, '<!doctype html><html><body><p>idle</p></body></html>');

  const seen = await page.evaluate(async () => {
    const ide = window.__codelabTest.ide;
    const violations: any[] = [];
    ide.on('preview-violation', (value: any) => violations.push(value));
    // Same payload the preview shim sends, but from this window, not the frame.
    window.postMessage(
      { type: 'codelab:preview-violation', directive: 'script-src', blockedURI: 'https://forged.example/x.js' },
      '*'
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    return violations;
  });

  expect(seen).toEqual([]);
  await expect(page.locator('#cl-preview-csp-status')).toBeHidden();
});

test('reopening the preview resets the violation indicator', async ({ page }) => {
  await mountPreview(
    page,
    '<!doctype html><html><body><script src="https://evil.example/x.js"></script></body></html>'
  );
  await expect(page.locator('#cl-preview-csp-status')).toBeVisible({ timeout: 5000 });

  await openPreview(page, '<!doctype html><html><body><p>clean</p></body></html>', 3002);
  await expect(page.locator('#cl-preview-csp-status')).toBeHidden();
});
