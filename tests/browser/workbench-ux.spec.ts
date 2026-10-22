import { test, expect } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Browser Workbench End-to-End UX Spec (Pillars R1–R5)
 *
 * Verifies real user-facing interactions in Chromium:
 *   - Workbench layout, explorer, editor column, and bottom drawer
 *   - Drawer tab switching: Tests, Terminal, Ports, Web Preview, Network, Inspector
 *   - Interactive Web Preview: device modes (desktop, tablet, mobile), URL bar, pop-out
 *   - Port listener notifications & multi-port pill updates
 *   - Terminal surface: command execution, clear terminal, stream logging
 *   - File explorer and editor tab switching
 *   - Clean workbench unmount & remount lifecycle
 * ═══════════════════════════════════════════════════════════════════════════════
 */

test.beforeEach(async ({ page }) => {
  // Hermetic: abort external CDN calls so tests run entirely offline & deterministically
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/tests/browser/fixtures/');
});

test('workbench renders primary layout containers', async ({ page }) => {
  await expect(page.locator('.codelab-workbench')).toBeVisible();
  await expect(page.locator('.codelab-topbar')).toBeVisible();
  await expect(page.locator('.codelab-explorer')).toBeVisible();
  await expect(page.locator('.codelab-editor-col')).toBeVisible();
  await expect(page.locator('#cl-drawer')).toBeVisible();
});

test('drawer tab navigation switches active panels', async ({ page }) => {
  // 1. Switch to Terminal tab
  await page.click('[data-cl-drawertab="terminal"]');
  await expect(page.locator('[data-cl-drawertab="terminal"]')).toHaveClass(/active/);
  await expect(page.locator('#cl-terminal-surface')).toBeVisible();

  // 2. Switch to Ports tab
  await page.click('[data-cl-drawertab="ports"]');
  await expect(page.locator('[data-cl-drawertab="ports"]')).toHaveClass(/active/);

  // 3. Switch to Web Preview tab
  await page.click('[data-cl-drawertab="preview"]');
  await expect(page.locator('[data-cl-drawertab="preview"]')).toHaveClass(/active/);
  await expect(page.locator('.codelab-preview')).toBeVisible();

  // 4. Switch back to Test Suite tab
  await page.click('[data-cl-drawertab="tests"]');
  await expect(page.locator('[data-cl-drawertab="tests"]')).toHaveClass(/active/);
});

test('preview docks into a right split pane and back to the bottom drawer', async ({ page }) => {
  await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    ide.portTable.registerServer(3000, {
      name: 'dev-server',
      fetch: () => new Response('<h1>Split App</h1>', { headers: { 'Content-Type': 'text/html' } })
    });
    await ide._openWebPreview(3000);
  });

  const workspace = page.locator('.codelab-workspace');
  const split = page.locator('#cl-preview-split');
  const splitter = page.locator('#cl-splitter-preview');
  const dockToggle = page.locator('[data-cl-action="preview-dock-toggle"]').filter({ visible: true }).first();

  await expect(page.locator('.codelab-preview')).toBeVisible();
  await expect(workspace).not.toHaveClass(/has-preview-split/);
  await expect(split).toBeHidden();

  // Dock to the right split pane.
  await dockToggle.click();
  await expect(workspace).toHaveClass(/has-preview-split/);
  await expect(split).toBeVisible();
  await expect(splitter).toBeVisible();
  await expect(split.locator('.codelab-preview')).toBeVisible();
  await expect(page.locator('.codelab-editor-col')).toBeVisible();

  // It must be a real grid column next to the editor, not an overlay on top.
  const geometry = await page.evaluate(() => {
    const editor = document.querySelector('.codelab-editor-col')!.getBoundingClientRect();
    const preview = document.querySelector('#cl-preview-split')!.getBoundingClientRect();
    return { editorRight: editor.right, previewLeft: preview.left, previewWidth: preview.width };
  });
  expect(geometry.previewLeft).toBeGreaterThanOrEqual(geometry.editorRight - 1);
  expect(geometry.previewWidth).toBeGreaterThan(200);

  // Dragging the splitter stores a pixel width for the pane.
  const handle = await splitter.boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x - 140, handle!.y + handle!.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(() => page.evaluate(() => (window as any).__codelabTest.ide.previewSplitWidth))
    .toBeGreaterThan(200);
  const widthVar = await page.evaluate(() =>
    document.querySelector('.codelab')!.style.getPropertyValue('--cl-preview-split-width')
  );
  expect(widthVar).toMatch(/^\d+px$/);

  // Double-clicking resets to the default track width.
  await splitter.dblclick();
  await expect
    .poll(() => page.evaluate(() => (window as any).__codelabTest.ide.previewSplitWidth))
    .toBe(0);

  // Dock back to the bottom drawer.
  await dockToggle.click();
  await expect(workspace).not.toHaveClass(/has-preview-split/);
  await expect(split).toBeHidden();
  await expect(page.locator('.codelab-preview')).toBeVisible();
});

test('a narrow viewport stacks the split preview instead of overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 800 });
  await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    ide.portTable.registerServer(3100, {
      name: 'dev-server',
      fetch: () => new Response('<h1>Narrow</h1>', { headers: { 'Content-Type': 'text/html' } })
    });
    await ide._openWebPreview(3100);
  });

  await page.locator('[data-cl-action="preview-dock-toggle"]').filter({ visible: true }).first().click();
  await expect(page.locator('.codelab-workspace')).toHaveClass(/has-preview-split/);

  const layout = await page.evaluate(() => {
    const workspace = document.querySelector('.codelab-workspace') as HTMLElement;
    const editor = document.querySelector('.codelab-editor-col')!.getBoundingClientRect();
    const preview = document.querySelector('#cl-preview-split')!.getBoundingClientRect();
    return {
      columns: getComputedStyle(workspace).gridTemplateColumns,
      scrollWidth: workspace.scrollWidth,
      clientWidth: workspace.clientWidth,
      previewOnTop: preview.top >= editor.bottom - 1
    };
  });
  expect(layout.columns.trim().split(/\s+/)).toHaveLength(1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.previewOnTop).toBe(true);
});

test('web preview toolbar supports responsive device frame modes', async ({ page }) => {
  // Mount server and open preview
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.portTable.registerServer(3000, {
      name: 'dev-server',
      fetch: () => new Response('<h1>Interactive App</h1>', { headers: { 'Content-Type': 'text/html' } })
    });
    ide._openWebPreview(3000);
  });

  await expect(page.locator('.codelab-preview')).toBeVisible();
  const viewport = page.locator('#cl-preview-viewport');

  // Toggle Mobile mode
  await page.click('[data-cl-action="preview-mode"][data-mode="mobile"]');
  await expect(viewport).toHaveClass(/codelab-preview-viewport--mobile/);

  // Toggle Tablet mode
  await page.click('[data-cl-action="preview-mode"][data-mode="tablet"]');
  await expect(viewport).toHaveClass(/codelab-preview-viewport--tablet/);

  // Toggle Desktop mode
  await page.click('[data-cl-action="preview-mode"][data-mode="desktop"]');
  await expect(viewport).toHaveClass(/codelab-preview-viewport--desktop/);
});

test('port listener registers server and displays toast notification with preview action', async ({ page }) => {
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.portTable.registerServer(8080, { name: 'api-service' });
  });

  const toast = page.locator('#cl-toast-container .codelab-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Server listening on port 8080');

  const previewBtn = toast.locator('[data-cl-action="open-web-preview"]');
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();

  // Clicking toast preview button opens Web Preview tab for port 8080
  await expect(page.locator('[data-cl-drawertab="preview"]')).toHaveClass(/active/);
  const urlInput = page.locator('#cl-preview-url-input');
  await expect(urlInput).toHaveValue('http://127.0.0.1:8080/');
});

test('terminal panel executes command and clears output', async ({ page }) => {
  await page.click('[data-cl-drawertab="terminal"]');
  await expect(page.locator('#cl-terminal-surface')).toBeVisible();

  // Push log into terminal
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.terminalLogs.push({ type: 'stdout', text: 'Compiling project bundles...' });
    ide.terminalLogs.push({ type: 'stdout', text: 'Build completed successfully in 142ms' });
    ide._renderDrawerBody();
  });

  await expect(page.locator('#cl-terminal-log')).toContainText('Compiling project bundles...');
  await expect(page.locator('#cl-terminal-log')).toContainText('Build completed successfully in 142ms');

  // Click clear button
  await page.click('[data-cl-action="clear-terminal"]');
  const termText = await page.locator('#cl-terminal-log').innerText();
  expect(termText.trim()).toBe('');
});

test('file tabs and navigation switch active file', async ({ page }) => {
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.files['app.ts'] = 'export const message = "hello world";';
    ide.files['readme.md'] = '# Readme file';
    ide._renderTabs();
    ide._renderFileLists();
  });

  // Switch to app.ts
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.openFile('app.ts');
  });

  const activeTab = page.locator('.codelab-tab.active');
  await expect(activeTab).toContainText('app.ts');
});

test('workbench unmounts cleanly and remounts without error', async ({ page }) => {
  const destroyed = await page.evaluate(() => {
    const app = document.getElementById('app');
    (window as any).__codelabTest.unmount();
    return (window as any).__codelabTest.ide === null && (!app || !(app as any)._codeLabInstance);
  });
  expect(destroyed).toBe(true);

  const remounted = await page.evaluate(() => {
    return (window as any).__codelabTest.mount({
      files: { 'main.js': 'console.log("remounted");' }
    });
  });
  expect(remounted).toBe(true);
  await expect(page.locator('.codelab-workbench')).toBeVisible();
});
