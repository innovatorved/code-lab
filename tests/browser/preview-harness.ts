import type { Page } from '@playwright/test';

/**
 * Shared harness for the Web Preview browser specs.
 *
 * Previews are forced onto the **srcdoc** path by pointing the service worker
 * URL at a path that does not exist. The real served path
 * (`/__preview/:port/*` through `dist/preview-sw.js`) is covered by the VM
 * suite in `tests/test-preview-sw.js`, which can assert the injected bytes
 * exactly; here the goal is deterministic browser behaviour (sandbox, CSP,
 * shims, violation reporting) without depending on worker registration timing.
 *
 * Both paths share the same policy builder (`src/csp.ts`), the same shims and
 * the same sandbox attribute, so the security properties are identical.
 */

export const HOST_ORIGIN = 'http://127.0.0.1:4173';

declare global {
  interface Window {
    __codelabTest: {
      mount(options?: Record<string, unknown>): boolean;
      unmount(): void;
      ide: any;
    };
  }
}

export async function mount(page: Page, options: Record<string, unknown> = {}) {
  await page.evaluate(
    (extra) => {
      window.__codelabTest.mount({
        files: { 'index.js': '' },
        previewSwUrl: '/__no_preview_worker__.js',
        ...extra
      });
    },
    options
  );
}

/** Serve `html` on `port` from the in-browser runtime and open it in the pane. */
export async function openPreview(page: Page, html: string, port = 3000) {
  await page.evaluate(
    async ({ body, targetPort }) => {
      const ide = window.__codelabTest.ide;
      const existing = ide.portTable.listServers().some((s: any) => Number(s.port) === targetPort);
      if (existing) ide.portTable.unregisterServer(targetPort);
      ide.portTable.registerServer(targetPort, {
        name: 'http-server',
        pid: targetPort,
        fetch: () => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      });
      await ide._openWebPreview(targetPort);
    },
    { body: html, targetPort: port }
  );

  // `_openWebPreview` switches the drawer, which renders asynchronously.
  await page.waitForFunction(
    () => {
      const frame = document.querySelector('#cl-preview-iframe');
      return Boolean(frame && frame.getAttribute('srcdoc'));
    },
    null,
    { timeout: 10_000 }
  );
}

export async function mountPreview(page: Page, html: string, options: Record<string, unknown> = {}) {
  await mount(page, options);
  await openPreview(page, html);
}

/** Resolve with the first `{ type: <messageType> }` the preview frame posts. */
export function waitForPreviewMessage<T = any>(page: Page, messageType: string, timeoutMs = 5000) {
  return page.evaluate(
    ({ type, timeout }) =>
      new Promise<T | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), timeout);
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === type) {
            clearTimeout(timer);
            resolve(event.data as T);
          }
        });
      }),
    { type: messageType, timeout: timeoutMs }
  );
}

/** The CSP applied to the srcdoc preview document. */
export function readPreviewCsp(page: Page) {
  return page.evaluate(() => {
    const frame = document.querySelector('#cl-preview-iframe');
    return frame ? frame.getAttribute('srcdoc') || '' : '';
  });
}
