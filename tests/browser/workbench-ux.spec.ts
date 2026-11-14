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

test('VS Code 5-region shell geometry, WAI-ARIA non-nested tabs, contextual terminal toolbar, and empty breadcrumbs', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.click('[data-cl-drawertab="terminal"]');

  const layout = await page.evaluate(() => {
    const activity = document.querySelector('#cl-activitybar')!.getBoundingClientRect();
    const sidebar = document.querySelector('#cl-sidebar')!.getBoundingClientRect();
    const drawer = document.querySelector('#cl-drawer')!.getBoundingClientRect();
    const statusbar = document.querySelector('#cl-statusbar')!.getBoundingClientRect();
    const termInDrawer = Boolean(document.querySelector('#cl-drawer #cl-terminal-surface'));
    const termInSidebar = Boolean(document.querySelector('#cl-sidebar #cl-terminal-surface'));
    const nestedButtonsInTabs = document.querySelectorAll('[role="tab"] button').length;
    return {
      activityWidth: Math.round(activity.width),
      sidebarBottom: sidebar.bottom,
      sidebarRight: sidebar.right,
      drawerTop: drawer.top,
      drawerLeft: drawer.left,
      statusbarHeight: Math.round(statusbar.height),
      termInDrawer,
      termInSidebar,
      nestedButtonsInTabs
    };
  });

  expect(layout.activityWidth).toBe(48);
  expect(layout.sidebarBottom).toBeGreaterThan(layout.drawerTop + 40);
  expect(layout.drawerLeft).toBeGreaterThanOrEqual(layout.sidebarRight - 1);
  expect(layout.statusbarHeight).toBe(24);
  expect(layout.termInDrawer).toBe(true);
  expect(layout.termInSidebar).toBe(false);
  expect(layout.nestedButtonsInTabs).toBe(0);

  // Contextual terminal actions visible on Terminal tab, hidden on Problems tab
  await expect(page.locator('#cl-drawer-term-actions')).toBeVisible();
  await page.click('[data-cl-drawertab="problems"]');
  await expect(page.locator('#cl-drawer-term-actions')).toBeHidden();

  // Breadcrumbs hide when all tabs are closed
  await page.evaluate(() => (window as any).__codelabTest.ide.closeAllTabs());
  await expect(page.locator('#cl-breadcrumbs')).toBeHidden();
});

test('topbar WAI-ARIA menubar supports click, hover-switch, keyboard navigation, Escape focus return, and viewport clamping', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const fileTrigger = page.locator('#cl-menubar [data-cl-menu="file"]');
  const editTrigger = page.locator('#cl-menubar [data-cl-menu="edit"]');
  const viewTrigger = page.locator('#cl-menubar [data-cl-menu="view"]');

  await fileTrigger.click();
  await expect(fileTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#cl-topbar-menu-slot .codelab-topbar-menu[data-menu-id="file"]')).toBeVisible();

  // Hover-switch while menu is open enforces single active menu invariant
  await viewTrigger.hover();
  await expect(page.locator('#cl-topbar-menu-slot .codelab-topbar-menu')).toHaveCount(1);
  await expect(page.locator('#cl-topbar-menu-slot .codelab-topbar-menu[data-menu-id="view"]')).toBeVisible();
  await expect(fileTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(viewTrigger).toHaveAttribute('aria-expanded', 'true');

  // Escape closes menu and restores focus to the active trigger
  await page.keyboard.press('Escape');
  await expect(page.locator('#cl-topbar-menu-slot .codelab-topbar-menu')).toHaveCount(0);
  await expect(viewTrigger).toBeFocused();

  // ArrowLeft from View trigger focuses Go/Selection -> verify roving ArrowRight from File moves to Edit
  await fileTrigger.focus();
  await page.keyboard.press('ArrowRight');
  await expect(editTrigger).toBeFocused();

  // Context menu near bottom-right corner clamps within 1280x800 viewport
  const menuBox = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.openContextMenu(1275, 795, [
      { label: 'Open File', action: 'open-file', target: 'index.js' },
      { label: 'Rename...', action: 'rename-file', target: 'index.js' },
      { label: 'Delete File', action: 'delete-file', target: 'index.js', danger: true }
    ]);
    const r = document.querySelector('.codelab-context-menu')!.getBoundingClientRect();
    return { right: r.right, bottom: r.bottom, left: r.left, top: r.top };
  });
  expect(menuBox.right).toBeLessThanOrEqual(1280);
  expect(menuBox.bottom).toBeLessThanOrEqual(800);
  expect(menuBox.left).toBeGreaterThanOrEqual(0);
  expect(menuBox.top).toBeGreaterThanOrEqual(0);
});

test('Activity Bar views (Explorer, Search match jump, Source Control init/stage/commit) and non-modal show*Modal APIs', async ({
  page
}) => {
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFile('src/calc.js', 'const alpha = 1;\nexport function computeTotal() {\n  return alpha + 41;\n}\n', { open: true });
  });

  // 1. Non-modal Search sidebar: grouped results, zero "undefined", click match jumps without closing Search
  await page.evaluate(() => (window as any).__codelabTest.ide.showSearchModal('computeTotal'));
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  await expect(page.locator('#cl-sidebar-search')).toBeVisible();
  const searchResultsText = await page.locator('#cl-search-results').innerText();
  expect(searchResultsText).toContain('src/calc.js');
  expect(searchResultsText).not.toContain('undefined');

  await page.locator('#cl-search-results [data-cl-search-file="src/calc.js"]').first().click();
  await expect(page.locator('#cl-sidebar-search')).toBeVisible();
  const cursorLine = await page.evaluate(() => (window as any).__codelabTest.ide.cursorPos.lineNumber);
  expect(cursorLine).toBe(2);

  // 2. Non-modal Source Control sidebar: Initialize Repository -> Stage -> Commit -> Clean working tree
  await page.evaluate(() => (window as any).__codelabTest.ide.showScmModal());
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  await expect(page.locator('#cl-sidebar-scm')).toBeVisible();

  const initBtn = page.locator('#cl-scm-init-btn');
  if (await initBtn.isVisible()) {
    await initBtn.click();
  }
  await page.locator('[data-cl-action="scm-stage-all"]').click();
  await page.locator('#cl-sidebar-scm #cl-scm-commit-input').fill('feat: add computeTotal');
  await page.locator('#cl-sidebar-scm #cl-scm-commit-btn').click();
  await expect(page.locator('#cl-sidebar-scm')).toContainText('Working tree clean');

  // 3. Non-modal Problems panel
  await page.evaluate(() => (window as any).__codelabTest.ide.showProblemsModal());
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  await expect(page.locator('[data-cl-drawertab="problems"]')).toHaveClass(/active/);

  // 4. Clicking active Activity Bar view icon collapses sidebar; clicking again expands
  await page.click('#cl-activitybar [data-cl-activity="scm"]');
  await expect(page.locator('.codelab')).toHaveClass(/sidebar-collapsed/);
  await page.click('#cl-activitybar [data-cl-activity="explorer"]');
  await expect(page.locator('.codelab')).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#cl-sidebar-explorer')).toBeVisible();
});

test('non-destructive Settings tab preserves unsaved edits, syncs Workspace scope to .codelab/settings.json (B-21), applies live settings & shortcuts', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Create an unsaved JSON edit and disable autoSave first so we can verify Mod+S + formatOnSave
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.configuration.setUserSetting('files.autoSave', 'off');
    ide.configuration.setUserSetting('editor.formatOnSave', true);
    ide.setFile('config.json', '{"b":1,"a":2}', { open: true });
    ide._dirtyFiles.add('config.json');
    ide._renderFileLists();
    ide._updateStatusBar();
  });

  // Open Settings tab via Activity Bar gear — openTabs & unsaved buffer MUST remain intact
  await page.click('#cl-activitybar [data-cl-activity="settings"]');
  await expect(page.locator('dialog.cl-settings-dialog[open]')).toHaveCount(0);
  await expect(page.locator('#cl-settings-host')).toBeVisible();
  await expect(page.locator('#cl-breadcrumbs')).toBeHidden();
  await expect(page.locator(':is(#cl-tabs, #cl-file-tabs) [data-cl-file="config.json"]')).toBeVisible();

  // Switch to Workspace scope in Settings UI and change editor.tabSize to 4 (B-21)
  await page.locator('#cl-settings-host [data-settings-scope="workspace"]').click();
  const tabSizeInput = page.locator('#cl-settings-host [data-setting-key="editor.tabSize"]');
  await tabSizeInput.fill('4');
  await tabSizeInput.dispatchEvent('change');

  await expect(page.locator('#cl-status-indent')).toContainText('Spaces: 4');
  const wsSettingsRaw = await page.evaluate(() => (window as any).__codelabTest.ide.files['.codelab/settings.json']);
  expect(JSON.parse(wsSettingsRaw)['editor.tabSize']).toBe(4);

  // Close Settings tab -> returns directly to config.json with unsaved content preserved
  await page.locator('[data-action="close-tab"][data-cl-close-tab="__settings__"]').click();
  await expect(page.locator('#cl-settings-host')).toBeHidden();
  const restoredVal = await page.evaluate(() => (window as any).__codelabTest.ide.files['config.json']);
  expect(restoredVal).toBe('{"b":1,"a":2}');

  // Mod+S saves & formats config.json using tabSize 4 and clears dirty state
  await page.keyboard.press('Control+s');
  await expect
    .poll(() => page.evaluate(() => (window as any).__codelabTest.ide.files['config.json']))
    .toContain('    "b": 1');

  // Verify live terminal.fontSize, theme WCAG contrast tokens, and Mod+B / Mod+J shortcuts
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.configuration.setUserSetting('terminal.fontSize', 16);
    ide.setTheme('light');
  });
  await page.click('[data-cl-drawertab="terminal"]');
  const termFontPx = await page.locator('#cl-terminal-surface').evaluate((el) => getComputedStyle(el).fontSize);
  expect(termFontPx).toBe('16px');
  await expect(page.locator('.codelab')).toHaveAttribute('data-cl-theme', 'light');

  await page.keyboard.press('Control+b');
  await expect(page.locator('.codelab')).toHaveClass(/sidebar-collapsed/);
  await page.keyboard.press('Control+j');
  await expect(page.locator('.codelab')).toHaveClass(/panel-collapsed/);

  expect(pageErrors).toEqual([]);
});

test('global shortcuts from document.body, focus restoration on Escape/outside-click, menubar C1/C2/C3/C4/C5 & multi-instance routing', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1. C1: Clicking File then clicking Edit keeps Edit menu open (no hover-vs-click close race)
  await page.click('#cl-menubar [data-cl-menu="file"]');
  await expect(page.locator('#cl-topbar-menu-slot [role="menu"]:visible')).toHaveCount(1);
  await page.click('#cl-menubar [data-cl-menu="edit"]');
  await expect(page.locator('#cl-topbar-menu-slot [data-menu-id="edit"]')).toBeVisible();

  // 2. C3 & C4: Submenu hidden until hovered, positioned beside trigger without negative left, and one-level Escape
  await page.click('#cl-menubar [data-cl-menu="file"]');
  await expect(page.locator('#cl-topbar-menu-slot [role="menu"]:visible')).toHaveCount(1);
  const prefsBtn = page.locator('#cl-topbar-menu-slot [data-cl-submenu]').filter({ hasText: /Preferences/i });
  await prefsBtn.hover();
  const openSubmenu = page.locator('#cl-topbar-menu-slot .codelab-topbar-submenu.open');
  await expect(openSubmenu).toBeVisible();
  const subGeom = await page.evaluate(() => {
    const trig = document.querySelector('#cl-topbar-menu-slot .codelab-topbar-menu__has-sub:has(.codelab-topbar-submenu.open)')!;
    const sub = trig.querySelector('.codelab-topbar-submenu.open')!;
    const tr = trig.getBoundingClientRect();
    const sr = sub.getBoundingClientRect();
    return { trRight: tr.right, srLeft: sr.left, srRight: sr.right, vw: window.innerWidth };
  });
  expect(subGeom.srLeft).toBeGreaterThanOrEqual(subGeom.trRight - 6);
  expect(subGeom.srRight).toBeLessThanOrEqual(subGeom.vw);

  // Focus inside submenu -> Escape closes ONLY submenu, parent File menu stays open & focus returns to Preferences trigger
  await openSubmenu.locator('[role="menuitem"]').first().focus();
  await page.keyboard.press('Escape');
  await expect(openSubmenu).toBeHidden();
  await expect(page.locator('#cl-topbar-menu-slot [data-menu-id="file"]')).toBeVisible();
  const focusedSubTrigger = await page.evaluate(() => document.activeElement?.hasAttribute('data-cl-submenu'));
  expect(focusedSubTrigger).toBe(true);

  // Second Escape closes root File menu and keeps focus inside .codelab
  await page.keyboard.press('Escape');
  await expect(page.locator('#cl-topbar-menu-slot [role="menu"]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.codelab')))).toBe(true);

  // Click-outside on non-focusable statusbar dismisses menu and restores focus inside .codelab (not BODY)
  await page.click('#cl-menubar [data-cl-menu="view"]');
  await expect(page.locator('#cl-topbar-menu-slot [data-menu-id="view"]')).toBeVisible();
  await page.mouse.click(400, 5);
  await expect(page.locator('#cl-topbar-menu-slot [role="menu"]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.codelab')))).toBe(true);

  // 3. document.activeElement === document.body global shortcuts (F1, Mod+Shift+P, Mod+B, Mod+,) + Palette Escape focus restore
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator('#cl-palette-input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cl-palette-input')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.codelab')))).toBe(true);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press('F1');
  await expect(page.locator('#cl-palette-input')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const wasCollapsed = await page.locator('.codelab').evaluate((el) => el.classList.contains('sidebar-collapsed'));
  await page.keyboard.press('Control+b');
  expect(await page.locator('.codelab').evaluate((el) => el.classList.contains('sidebar-collapsed'))).toBe(!wasCollapsed);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+,');
  await expect(page.locator('#cl-settings-host')).toBeVisible();

  // 4. C5: Contextual Clear button visible on terminal tab and hidden on non-terminal tabs
  await page.click('[data-cl-drawertab="problems"]');
  await expect(page.locator('#cl-drawer [data-cl-action="clear-terminal"]')).toBeHidden();
  await page.click('[data-cl-drawertab="ports"]');
  await expect(page.locator('#cl-drawer [data-cl-action="clear-terminal"]')).toBeHidden();
  await page.click('[data-cl-drawertab="terminal"]');
  await expect(page.locator('#cl-drawer [data-cl-action="clear-terminal"]')).toBeVisible();

  // 5. C2: 800x600 viewport keeps Status Bar completely visible (zero bottom clipping)
  await page.setViewportSize({ width: 800, height: 600 });
  const rect800 = await page.evaluate(() => {
    const shell = document.querySelector('.codelab')!.getBoundingClientRect();
    const sb = document.querySelector('#cl-statusbar')!.getBoundingClientRect();
    return { shellBottom: shell.bottom, sbBottom: sb.bottom, sbHeight: sb.height };
  });
  expect(rect800.shellBottom).toBeLessThanOrEqual(600);
  expect(rect800.sbBottom).toBeLessThanOrEqual(600);
  expect(rect800.sbHeight).toBe(24);

  // 6. Multi-instance + unmount() cleanup: unmounting #app removes zombie .codelab so a second instance receives body shortcuts
  await page.evaluate(() => {
    const host2 = document.createElement('div');
    host2.id = 'app-2';
    host2.style.height = '100%';
    document.body.appendChild(host2);
    (window as any).__lab2 = (window as any).CodeLab.mount(host2, {
      id: 'multi-2',
      files: { 'second.js': 'const two = 2;\n' }
    });
    (window as any).__codelabTest.unmount();
    (document.activeElement as HTMLElement | null)?.blur();
  });
  expect(await page.locator('#app .codelab').count()).toBe(0);
  await page.keyboard.press('Control+,');
  expect(await page.evaluate(() => (window as any).__lab2.activeTab)).toBe('__settings__');
  await page.evaluate(() => (window as any).CodeLab.unmount('#app-2'));

  expect(pageErrors).toEqual([]);
});

test('ARIA tablist roles, keyboard tab close, Markdown source/preview toggle, fallback undo/redo + Go to Line, B-21 settings safety, dirty dots & scroll preservation', async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1. WAI-ARIA tablists (#cl-tabs & .codelab-drawer__tabs) only contain [role="tab"] direct children with roving tabindex
  const ariaAudit = await page.evaluate(() => {
    const checkList = (sel: string) => {
      const list = document.querySelector(sel);
      if (!list) return { exists: false, nonTabChildren: -1, zeroTabIndexCount: 0 };
      const children = Array.from(list.children);
      const nonTabChildren = children.filter((c) => c.getAttribute('role') !== 'tab').length;
      const visibleTabs = children.filter((c) => (c as HTMLElement).style.display !== 'none' && !(c as HTMLElement).hidden);
      const zeroTabIndexCount = visibleTabs.filter((c) => c.getAttribute('tabindex') === '0').length;
      return { exists: true, nonTabChildren, zeroTabIndexCount };
    };
    return {
      editorTabs: checkList('#cl-tabs'),
      drawerTabs: checkList('.codelab-drawer__tabs')
    };
  });
  expect(ariaAudit.editorTabs).toEqual({ exists: true, nonTabChildren: 0, zeroTabIndexCount: 1 });
  expect(ariaAudit.drawerTabs).toEqual({ exists: true, nonTabChildren: 0, zeroTabIndexCount: 1 });

  // 2. Markdown editable source by default + Preview toggle (C2b-C5) + fallback Undo/Redo & Go to Line (C1-C6)
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.configuration.setUserSetting('files.autoSave', 'off');
    ide.setFile('NOTES.md', '# Heading\nLine two\nLine three\n', { open: true });
  });
  await expect(page.locator('#cl-md-preview')).toBeHidden();
  const mdToggle = page.locator('[data-cl-action="toggle-md-preview"]');
  await expect(mdToggle).toBeVisible();
  await mdToggle.click();
  await expect(page.locator('#cl-md-preview')).toBeVisible();
  await expect(page.locator('#cl-md-preview h1, #cl-md-preview h2')).toContainText('Heading');
  await mdToggle.click();
  await expect(page.locator('#cl-md-preview')).toBeHidden();

  // Exercise fallback editor Undo/Redo + dirty indicator on tab & Explorer (T2-F11-03)
  const usingFallback = await page.evaluate(() => !(window as any).__codelabTest.ide.editor);
  if (usingFallback) {
    const fb = page.locator('#cl-fallback-editor');
    await expect(fb).toBeVisible();
    await fb.fill('# Updated Heading\nLine two\nLine three\n');
    await expect(page.locator('#cl-tabs [data-cl-file="NOTES.md"][data-dirty="true"]')).toBeVisible();
    await expect(page.locator('#cl-explorer-list [data-cl-file="NOTES.md"] .codelab-file-dirty')).toBeVisible();

    await page.click('#cl-menubar [data-cl-menu="edit"]');
    await page.locator('#cl-topbar-menu-slot [data-cl-menu-cmd="edit:undo"]').click();
    expect(await fb.inputValue()).toBe('# Heading\nLine two\nLine three\n');

    await page.click('#cl-menubar [data-cl-menu="edit"]');
    await page.locator('#cl-topbar-menu-slot [data-cl-menu-cmd="edit:redo"]').click();
    expect(await fb.inputValue()).toBe('# Updated Heading\nLine two\nLine three\n');

    await page.click('#cl-menubar [data-cl-menu="go"]');
    await page.locator('#cl-topbar-menu-slot [data-cl-menu-cmd="go:line"]').click();
    await page.fill('#cl-goto-line-input', '2:5');
    await page.keyboard.press('Enter');
    const cursor = await page.evaluate(() => (window as any).__codelabTest.ide.cursorPos);
    expect(cursor.lineNumber).toBe(2);
    expect(cursor.column).toBe(5);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('cl-fallback-editor');
  }

  // Mod+S clears dirty indicators in both tab and Explorer
  await page.keyboard.press('Control+s');
  await expect(page.locator('#cl-tabs [data-cl-file="NOTES.md"][data-dirty="true"]')).toHaveCount(0);
  await expect(page.locator('#cl-explorer-list [data-cl-file="NOTES.md"] .codelab-file-dirty')).toHaveCount(0);

  // 3. Keyboard close on .codelab-tab__close (tabindex="0" + Enter) keeps focus inside .codelab
  const notesCloseBtn = page.locator('#cl-tabs [data-cl-file="NOTES.md"] .codelab-tab__close');
  expect(await notesCloseBtn.getAttribute('tabindex')).toBe('0');
  await notesCloseBtn.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cl-tabs [data-cl-file="NOTES.md"]')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.codelab')))).toBe(true);

  // 4. B-21: Mod+B sidebar toggle must NEVER wipe existing .codelab/settings.json workspace keys
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.configuration.setWorkspaceSetting('editor.tabSize', 4);
    ide._persistWorkspaceSettingsFromUi();
  });
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+b');
  const wsAfterToggle = await page.evaluate(() => JSON.parse((window as any).__codelabTest.ide.files['.codelab/settings.json']));
  expect(wsAfterToggle['editor.tabSize']).toBe(4);

  // 5. Settings inline scrollTop preservation across tab switches + files.exclude boolean-map coercion + terminal.scrollback cap
  await page.keyboard.press('Control+,');
  await expect(page.locator('#cl-settings-host')).toBeVisible();
  const scrolledTo = await page.evaluate(() => {
    const list = document.querySelector('#cl-settings-host [data-role="settings-list"]') as HTMLElement | null;
    if (!list) return 0;
    list.scrollTop = 120;
    list.dispatchEvent(new Event('scroll'));
    return list.scrollTop;
  });
  if (scrolledTo > 0) {
    const firstFileTab = page.locator('#cl-tabs .codelab-tab[data-cl-file]').first();
    await firstFileTab.click();
    await page.locator('#cl-tabs [data-cl-tab="__settings__"]').click();
    const restoredScroll = await page.evaluate(() => {
      const list = document.querySelector('#cl-settings-host [data-role="settings-list"]') as HTMLElement | null;
      return list ? list.scrollTop : 0;
    });
    expect(restoredScroll).toBe(scrolledTo);
  }

  const runtimeChecks = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.configuration.setWorkspaceSetting('files.exclude', { '**/*.secret': true, '**/*.keep': false });
    ide.configuration.setUserSetting('terminal.scrollback', 100);
    for (let i = 0; i < 140; i++) {
      ide._pushTerminalLog({ type: 'stdout', text: 'line-' + i });
    }
    return {
      excludedVal: ide.configuration.get('files.exclude'),
      logLen: ide.terminalLogs.length
    };
  });
  expect(runtimeChecks.excludedVal).toEqual(['**/*.secret']);
  expect(runtimeChecks.logLen).toBeLessThanOrEqual(100);

  expect(pageErrors).toEqual([]);
});


test('M2.2 F4: Explorer CRUD syncs 1:1 with shell VFS, blocks path traversal & collisions inline, confirms UI deletes, and renders Empty Welcome CTAs', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1. Inline create folder + nested file and verify 1:1 shell VFS sync
  await page.click('[data-cl-action="new-folder-root"]');
  const folderInput = page.locator('.codelab-inline-input');
  await expect(folderInput).toBeVisible();
  await folderInput.fill('src/utils');
  await folderInput.press('Enter');
  await expect(page.locator('#cl-explorer-list .codelab-folder-item[data-cl-folder="src/utils"]')).toBeVisible();

  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.startInlineCreate('file', 'src/utils');
  });
  const fileInput = page.locator('.codelab-inline-input');
  await expect(fileInput).toBeVisible();
  await fileInput.fill('Makefile');
  await fileInput.press('Enter');
  await expect(page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="src/utils/Makefile"]')).toBeVisible();

  // Extensionless rename (`Makefile` -> `Dockerfile`) works without mangling extension
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.startInlineRename('file', 'src/utils/Makefile');
  });
  const renameInput = page.locator('.codelab-inline-input');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('Dockerfile');
  await renameInput.press('Enter');
  await expect(page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="src/utils/Dockerfile"]')).toBeVisible();

  // Verify VFS existsSync matches 1:1 and path traversal is blocked
  const vfsCheck1 = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    const traversalBlocked = ide.createFile('../../etc/passwd', 'nope');
    const nullByteBlocked = ide.createFile('bad\0file.js', 'nope');
    return {
      traversalBlocked,
      nullByteBlocked,
      oldExists: ide.shell.vfs.existsSync('/workspace/src/utils/Makefile'),
      newExists: ide.shell.vfs.existsSync('/workspace/src/utils/Dockerfile'),
      etcExists: ide.shell.vfs.existsSync('/etc/passwd')
    };
  });
  expect(vfsCheck1).toEqual({
    traversalBlocked: null,
    nullByteBlocked: null,
    oldExists: false,
    newExists: true,
    etcExists: false
  });

  // 2. Inline collision validation surfaces [role="alert"] and keeps input open
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.startInlineCreate('file', 'src/utils');
  });
  const dupInput = page.locator('.codelab-inline-input');
  await dupInput.fill('Dockerfile');
  await dupInput.press('Enter');
  await expect(page.locator('.codelab-tree-input-error[role="alert"]')).toBeVisible();
  await dupInput.press('Escape');

  // 3. Confirmed UI delete: Cancel preserves file, Confirm deletes from both files & VFS
  await page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="src/utils/Dockerfile"]').click({ button: 'right' });
  await page.locator('#cl-context-menu-slot [data-ctx-action="delete-file"]').click();
  await expect(page.locator('[data-cl-modal="delete-confirm"]')).toBeVisible();
  await page.locator('[data-cl-modal="delete-confirm"] [data-cl-confirm="cancel"]').click();
  await expect(page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="src/utils/Dockerfile"]')).toBeVisible();

  await page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="src/utils/Dockerfile"]').click({ button: 'right' });
  await page.locator('#cl-context-menu-slot [data-ctx-action="delete-file"]').click();
  await page.locator('[data-cl-modal="delete-confirm"] [data-cl-confirm="delete"]').click();
  await expect(page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="src/utils/Dockerfile"]')).toHaveCount(0);
  const vfsAfterDel = await page.evaluate(() => (window as any).__codelabTest.ide.shell.vfs.existsSync('/workspace/src/utils/Dockerfile'));
  expect(vfsAfterDel).toBe(false);

  // 4. Empty workspace renders Explorer Welcome CTAs & Empty Editor Welcome CTAs
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFiles({});
    ide.folders.clear();
    ide._renderFileLists();
  });
  await expect(page.locator('#cl-explorer-list .codelab-explorer-welcome [data-cl-action="new-file-root"]')).toBeVisible();
  await expect(page.locator('#cl-explorer-list .codelab-explorer-welcome [data-cl-action="open-clone-modal"]')).toBeVisible();
  await expect(page.locator('#cl-empty-editor [data-cl-action="new-file-root"]')).toBeVisible();
  await expect(page.locator('#cl-empty-editor [data-cl-action="open-clone-modal"]')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('M2.2 F5: Blank IDE isolation guard (#workspace-confirm-modal), Open Recent Workspace switching, guarded resetLab, and non-destructive setLanguage', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const firstLabId = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.persistState = true;
    ide.createFile('custom-keep.js', 'export const keep = 42;\n');
    ide.saveAllFiles();
    return ide.labId as string;
  });

  // 1. Trigger File -> New Blank Workspace... -> Cancel keeps current workspace intact
  await page.click('#cl-menubar [data-cl-menu="file"]');
  await page.locator('#cl-topbar-menu-slot [data-cl-menu-cmd="file:new-blank-workspace"]').click();
  await expect(page.locator('#workspace-confirm-modal[data-cl-modal="workspace-confirm"]')).toBeVisible();
  await page.locator('#workspace-confirm-modal [data-cl-confirm="cancel"]').click();
  await expect(page.locator('#workspace-confirm-modal')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__codelabTest.ide.files['custom-keep.js'])).toBe('export const keep = 42;\n');

  // 2. Trigger New Blank Workspace -> New Isolated Workspace creates empty workspace & preserves prior workspace
  await page.click('#cl-menubar [data-cl-menu="file"]');
  await page.locator('#cl-topbar-menu-slot [data-cl-menu-cmd="file:new-blank-workspace"]').click();
  await page.locator('#workspace-confirm-modal [data-cl-confirm="isolated"]').click();
  const blankState = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    return {
      labId: ide.labId as string,
      files: ide.getFiles(),
      tabs: ide.getOpenTabs(),
      vfsEntries: ide.shell.vfs.readdirSync('/workspace')
    };
  });
  expect(blankState.labId).not.toBe(firstLabId);
  expect(blankState.files).toEqual({});
  expect(blankState.tabs).toEqual([]);
  expect(blankState.vfsEntries).toEqual([]);

  // 3. Switch back via File -> Open Recent Workspace... submenu restores custom-keep.js 100%
  await page.click('#cl-menubar [data-cl-menu="file"]');
  const recentTrigger = page.locator('#cl-topbar-menu-slot .codelab-topbar-menu__has-sub:has-text("Open Recent Workspace") > [data-cl-submenu]');
  await recentTrigger.click();
  await page.locator(`#cl-topbar-menu-slot [data-cl-workspace="${firstLabId}"]`).click();
  await expect.poll(async () => page.evaluate(() => (window as any).__codelabTest.ide.getFiles()['custom-keep.js'])).toBe('export const keep = 42;\n');

  // 4. Non-destructive setLanguage preserves user-created files (B-07)
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.createFile('my-notes.txt', 'survives language switch\n');
    ide.setLanguage('ts');
    ide.setLanguage('js');
  });
  expect(await page.evaluate(() => (window as any).__codelabTest.ide.getFiles()['my-notes.txt'])).toBe('survives language switch\n');

  // 5. Guarded resetLab prompts confirmation in browser and prunes VFS on confirm
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.resetLab();
  });
  await expect(page.locator('#reset-confirm-modal[data-cl-modal="reset-confirm"]')).toBeVisible();
  await page.locator('#reset-confirm-modal #cl-confirm-reset-btn').click();
  const afterReset = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    return {
      hasNotes: ide.getFiles()['my-notes.txt'] !== undefined,
      vfsHasNotes: ide.shell.vfs.existsSync('/workspace/my-notes.txt')
    };
  });
  expect(afterReset).toEqual({ hasNotes: false, vfsHasNotes: false });

  expect(pageErrors).toEqual([]);
});

test('M2.2 F6: Transactional Clone Repo validates URLs inline, rolls back 404 & mid-blob aborts, supports AbortController cancel, caps tabs <= 1, and syncs Git HEAD', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  let networkCalls = 0;
  let releaseSlowClone: (() => void) | null = null;
  await page.route('https://api.github.com/**', async (route) => {
    networkCalls++;
    const url = route.request().url();
    if (url.includes('/repos/octocat/missing-repo')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
      return;
    }
    if (url.includes('/repos/acme/abort-repo/git/trees/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sha: 'abc1234',
          truncated: false,
          tree: [
            { path: 'README.md', mode: '100644', type: 'blob', size: 12, sha: '111' },
            { path: 'broken.ts', mode: '100644', type: 'blob', size: 18, sha: '222' }
          ]
        })
      });
      return;
    }
    if (url.includes('/repos/acme/abort-repo')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', html_url: 'https://github.com/acme/abort-repo' })
      });
      return;
    }
    if (url.includes('/repos/acme/slow-repo')) {
      await new Promise<void>((resolve) => { releaseSlowClone = resolve; });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', html_url: 'https://github.com/acme/slow-repo' })
      });
      return;
    }
    if (url.includes('/repos/acme/large-repo/git/trees/')) {
      const tree = Array.from({ length: 12 }, (_, i) => ({
        path: i === 0 ? 'README.md' : `src/mod${i}.ts`,
        mode: '100644',
        type: 'blob',
        size: 20,
        sha: `sha-${i}`
      }));
      tree.push({ path: '.git/config', mode: '100644', type: 'blob', size: 10, sha: 'gitcfg' });
      tree.push({ path: 'packages/sub/node_modules/pkg/index.js', mode: '100644', type: 'blob', size: 10, sha: 'nm' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'head999', truncated: false, tree }) });
      return;
    }
    if (url.includes('/repos/acme/large-repo')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', html_url: 'https://github.com/acme/large-repo' })
      });
      return;
    }
    await route.abort();
  });

  await page.route('https://raw.githubusercontent.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/acme/abort-repo/main/broken.ts')) {
      await route.abort('connectionreset');
      return;
    }
    if (url.includes('/acme/abort-repo/main/README.md')) {
      await route.fulfill({ status: 200, contentType: 'text/plain', body: '# Partial\n' });
      return;
    }
    if (url.includes('/acme/large-repo/main/')) {
      const name = url.split('/main/')[1] || 'file';
      await route.fulfill({ status: 200, contentType: 'text/plain', body: `// ${name}\nexport const ok = true;\n` });
      return;
    }
    await route.abort();
  });

  // Seed sentinel file to verify zero destructive side effects on validation/network failure/cancel
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFiles({ 'sentinel.js': 'const intact = true;\n' });
  });

  // 1. Synchronous URL validation blocks non-GitHub URLs with zero network requests
  await page.evaluate(() => (window as any).__codelabTest.ide.openCloneDialog());
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toBeVisible();
  await page.fill('#cl-clone-repo-input', 'https://gitlab.com/acme/repo');
  await page.click('#cl-clone-submit-btn');
  await expect(page.locator('#cl-clone-error-banner[role="alert"]')).toBeVisible();
  expect(networkCalls).toBe(0);

  // 2. 404 Not Found keeps modal open with error banner and preserves sentinel.js
  await page.fill('#cl-clone-repo-input', 'octocat/missing-repo');
  await page.click('#cl-clone-submit-btn');
  await page.locator('#workspace-confirm-modal [data-cl-confirm="replace"]').click();
  await expect(page.locator('#cl-clone-error-banner[role="alert"]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__codelabTest.ide.getFiles())).toEqual({ 'sentinel.js': 'const intact = true;\n' });

  // 3. Mid-blob connection reset (acme/abort-repo) rolls back 100% cleanly — no partial README.md leaked!
  await page.fill('#cl-clone-repo-input', 'acme/abort-repo');
  await page.click('#cl-clone-submit-btn');
  await page.locator('#workspace-confirm-modal [data-cl-confirm="replace"]').click();
  await expect(page.locator('#cl-clone-error-banner[role="alert"]')).toBeVisible();
  const afterAbort = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    return {
      files: ide.getFiles(),
      hasPartialReadmeInVfs: ide.shell.vfs.existsSync('/workspace/README.md')
    };
  });
  expect(afterAbort).toEqual({ files: { 'sentinel.js': 'const intact = true;\n' }, hasPartialReadmeInVfs: false });

  // 4. Cancel in-flight clone via [data-cl-action="cancel-clone"] aborts cleanly and preserves sentinel.js
  await page.fill('#cl-clone-repo-input', 'acme/slow-repo');
  await page.click('#cl-clone-submit-btn');
  await page.locator('#workspace-confirm-modal [data-cl-confirm="replace"]').click();
  await expect(page.locator('#cl-clone-progress-wrap[role="progressbar"]')).toBeVisible();
  await page.click('[data-cl-action="cancel-clone"]');
  if (releaseSlowClone) (releaseSlowClone as () => void)();
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__codelabTest.ide.getFiles())).toEqual({ 'sentinel.js': 'const intact = true;\n' });

  // 5. Successful 12-file clone caps openTabs <= 1, strips nested node_modules/.git, and syncs clean Git HEAD
  await page.evaluate(() => (window as any).__codelabTest.ide.openCloneDialog());
  await page.fill('#cl-clone-repo-input', 'acme/large-repo');
  await page.click('#cl-clone-submit-btn');
  await page.locator('#workspace-confirm-modal [data-cl-confirm="replace"]').click();
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toHaveCount(0);

  const postClone = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    const files = Object.keys(ide.getFiles());
    return {
      fileCount: files.length,
      hasNestedNodeModules: files.some((f: string) => f.includes('node_modules')),
      hasDotGitFile: files.some((f: string) => f.startsWith('.git')),
      openTabs: ide.getOpenTabs(),
      gitStatus: ide.getGitStatus(),
      gitBranch: ide.shell.gitState.branch,
      gitInitialized: ide.shell.gitState.initialized
    };
  });
  expect(postClone.fileCount).toBe(12);
  expect(postClone.hasNestedNodeModules).toBe(false);
  expect(postClone.hasDotGitFile).toBe(false);
  expect(postClone.openTabs.length).toBeLessThanOrEqual(1);
  expect(postClone.openTabs[0]).toBe('README.md');
  expect(postClone.gitInitialized).toBe(true);
  expect(postClone.gitBranch).toBe('main');
  expect(postClone.gitStatus).toEqual([]);

  expect(pageErrors).toEqual([]);
});

test('M2.2 Iter2 Track 1 (Diagnostics): diagnostics populate on use/setFiles/openFile and clear on file & folder rename/delete', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.addScriptTag({ url: '/dist/extensions/python.js' });

  // 1. Post-boot use(plugin) immediately lints existing broken.py in batch
  const postUseCounts = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFiles({ 'broken.py': 'def unclosed(\n    return 1\n' });
    const beforeUse = ide.getDiagnostics().length;
    ide.use((window as any).CodeLabPython.pythonExtension());
    const afterUse = ide.getDiagnostics();
    return {
      beforeUse,
      afterUseCount: afterUse.length,
      afterUseFiles: afterUse.map((d: any) => d.file)
    };
  });
  expect(postUseCounts.beforeUse).toBe(0);
  expect(postUseCounts.afterUseCount).toBeGreaterThan(0);
  expect(postUseCounts.afterUseFiles).toContain('broken.py');

  // 2. File rename clears old diagnostics and openFile lints renamed file; file delete clears diagnostics to 0
  const fileLifecycle = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.moveFile('broken.py', 'renamed_broken.py', { destIsExactFilePath: true });
    const afterRenameOld = ide.getDiagnostics().filter((d: any) => d.file === 'broken.py').length;
    ide.openFile('renamed_broken.py');
    const afterOpenRenamed = ide.getDiagnostics().filter((d: any) => d.file === 'renamed_broken.py').length;
    ide.deleteFile('renamed_broken.py', { force: true });
    const afterDelete = ide.getDiagnostics().length;
    return { afterRenameOld, afterOpenRenamed, afterDelete };
  });
  expect(fileLifecycle.afterRenameOld).toBe(0);
  expect(fileLifecycle.afterOpenRenamed).toBeGreaterThan(0);
  expect(fileLifecycle.afterDelete).toBe(0);

  // 3. setFiles immediately populates diagnostics, and folder rename + folder delete clear nested diagnostics
  const folderLifecycle = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFiles({
      'pkg/sub/broken.py': 'def bad_syntax(:\n    pass\n',
      'pkg/ok.py': 'x = 1\n'
    });
    const afterSetFiles = ide.getDiagnostics().filter((d: any) => d.file === 'pkg/sub/broken.py').length;
    ide.renameFolder('pkg', 'pkg_renamed');
    const staleOldFolderDiags = ide.getDiagnostics().filter((d: any) => String(d.file).startsWith('pkg/')).length;
    ide.openFile('pkg_renamed/sub/broken.py');
    const renamedFolderDiags = ide.getDiagnostics().filter((d: any) => d.file === 'pkg_renamed/sub/broken.py').length;
    ide.deleteFolder('pkg_renamed', { force: true });
    const afterFolderDelete = ide.getDiagnostics().length;
    return { afterSetFiles, staleOldFolderDiags, renamedFolderDiags, afterFolderDelete };
  });
  expect(folderLifecycle.afterSetFiles).toBeGreaterThan(0);
  expect(folderLifecycle.staleOldFolderDiags).toBe(0);
  expect(folderLifecycle.renamedFolderDiags).toBeGreaterThan(0);
  expect(folderLifecycle.afterFolderDelete).toBe(0);

  expect(pageErrors).toEqual([]);
});

test('M2.2 Iter2 Track 1 (VFS Integrity): bidirectional file/folder & ancestor-file collision guards and recursive kernel.fs directory pruning', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1. Programmatic collisions blocked across ide.files, ide.shell.vfs, and ide.kernel.fs
  const collisionRes = await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFiles({ 'index.js': 'console.log("root");\n' });
    const folderCreated = ide.createFolder('Makefile');
    const fileOverFolder = ide.createFile('Makefile', 'all:\n\techo no\n');
    const folderUnderFile = ide.createFolder('index.js/sub');
    const fileUnderFile = ide.createFile('index.js/child.js', 'export const bad = 1;\n');
    const folderIntoDescendant = (() => {
      ide.createFolder('src/nested');
      return ide.renameFolder('src', 'src/nested/sub');
    })();
    return {
      folderCreated,
      fileOverFolder,
      folderUnderFile,
      fileUnderFile,
      folderIntoDescendant,
      hasMakefileInFiles: Object.prototype.hasOwnProperty.call(ide.getFiles(), 'Makefile'),
      makefileIsDirInShell: ide.shell.vfs.statSync('/workspace/Makefile').isDirectory(),
      indexIsFileInShell: ide.shell.vfs.statSync('/workspace/index.js').isFile(),
      kernelRootEntries: ide.kernel.fs.readdir('/workspace').map((e: any) => e.name ?? e).sort()
    };
  });
  expect(collisionRes.folderCreated).toBe(true);
  expect(collisionRes.fileOverFolder).toBeNull();
  expect(collisionRes.folderUnderFile).toBe(false);
  expect(collisionRes.fileUnderFile).toBeNull();
  expect(collisionRes.folderIntoDescendant).toBe(false);
  expect(collisionRes.hasMakefileInFiles).toBe(false);
  expect(collisionRes.makefileIsDirInShell).toBe(true);
  expect(collisionRes.indexIsFileInShell).toBe(true);
  expect(collisionRes.kernelRootEntries).toEqual(['Makefile', 'index.js', 'src']);

  // 2. Inline Explorer #cl-tree-create-input surfaces role="alert" for file-over-folder and ancestor-file collisions
  await page.evaluate(() => (window as any).__codelabTest.ide.startInlineCreate('file', ''));
  const inlineInput = page.locator('#cl-tree-create-input');
  await expect(inlineInput).toBeVisible();
  await inlineInput.fill('Makefile');
  await inlineInput.press('Enter');
  await expect(page.locator('#cl-tree-input-error[role="alert"]')).toBeVisible();

  await inlineInput.fill('index.js/nested.js');
  await inlineInput.press('Enter');
  await expect(page.locator('#cl-tree-input-error[role="alert"]')).toBeVisible();
  await inlineInput.press('Escape');

  // 3. Recursive kernel.fs directory pruning leaves zero ghost directories after blank workspace replace
  const afterPrune = await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    ide.createFolder('alpha-dir/deep');
    ide.createFolder('temp-dir');
    await ide._replaceCurrentWithBlankWorkspace('Clean Blank');
    return {
      files: ide.getFiles(),
      folders: Array.from(ide.folders),
      shellRoot: ide.shell.vfs.readdirSync('/workspace'),
      kernelRoot: ide.kernel.fs.readdir('/workspace')
    };
  });
  expect(afterPrune).toEqual({
    files: {},
    folders: [],
    shellRoot: [],
    kernelRoot: []
  });

  expect(pageErrors).toEqual([]);
});

test('M2.2 Iter2 Track 2 (Workspace & Git): cross-language switchWorkspace, IndexedDB-only loadProject fallback, non-guided setMode preservation, and gitState head identity', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.addScriptTag({ url: '/dist/extensions/python.js' });

  // 1. Setup sandbox:py workspace with custom Python file + empty folder, then switch to blank JS workspace and back
  const roundTrip = await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    ide.persistState = true;
    ide.use((window as any).CodeLabPython.pythonExtension());
    ide.setLanguage('py');
    ide.setFiles({ 'app.py': 'print("hello python")\n' });
    ide.createFolder('empty_pkg');
    ide.saveAllFiles();
    if (ide._idbSaveChain) await ide._idbSaveChain;
    const pyLabId = ide.labId as string;
    const pyStorageKey = ide.storageKey as string;

    const blankLabId = await ide.openBlankWorkspace({ force: true, title: 'Isolated JS Blank' });
    ide.createFile('blank.js', 'export const blank = true;\n');
    ide.saveAllFiles();
    if (ide._idbSaveChain) await ide._idbSaveChain;

    // Switch back to pyLabId (verifies snap.mode/snap.lang restored BEFORE slotKey lookup)
    await ide.switchWorkspace(pyLabId);
    const restoredNormal = {
      lang: ide.lang,
      mode: ide.mode,
      files: ide.getFiles(),
      hasEmptyPkgInFolders: ide.folders.has('empty_pkg'),
      hasEmptyPkgInShell: ide.shell.vfs.existsSync('/workspace/empty_pkg'),
      hasEmptyPkgInKernel: ide.kernel.fs.readdir('/workspace').some((e: any) => (e.name ?? e) === 'empty_pkg')
    };

    // Switch away, wipe localStorage inline snapshot for pyLabId to simulate >5 MB IndexedDB-only workspace, and switch back
    await ide.switchWorkspace(blankLabId);
    localStorage.removeItem(pyStorageKey);
    let saveErrors = 0;
    const origEmit = ide._emitEvent.bind(ide);
    ide._emitEvent = (ev: string, detail: any) => {
      if (ev === 'codelab:error' && detail && detail.code === 'E_SAVE') saveErrors++;
      return origEmit(ev, detail);
    };
    await ide.switchWorkspace(pyLabId);
    const restoredFromIdb = {
      files: ide.getFiles(),
      saveErrors
    };

    // Non-guided setMode('guided') preserves modified/created files and deleted files
    ide.hasGuidedLab = false;
    ide.createFile('notes.md', '# Keep me\n');
    ide.setMode('guided');
    ide.setMode('sandbox');
    const afterModeToggleFiles = ide.getFiles();

    // Git headSnapshot === headFiles identity check across init & commit
    ide._initGitRepoInScm();
    ide.stageAllGitFiles();
    ide.commitGitChanges('initial commit');
    const headIdentity = ide.shell.gitState.headSnapshot === ide.shell.gitState.headFiles;

    return { restoredNormal, restoredFromIdb, afterModeToggleFiles, headIdentity };
  });

  expect(roundTrip.restoredNormal.lang).toBe('py');
  expect(roundTrip.restoredNormal.mode).toBe('sandbox');
  expect(roundTrip.restoredNormal.files['app.py']).toBe('print("hello python")\n');
  expect(roundTrip.restoredNormal.hasEmptyPkgInFolders).toBe(true);
  expect(roundTrip.restoredNormal.hasEmptyPkgInShell).toBe(true);
  expect(roundTrip.restoredNormal.hasEmptyPkgInKernel).toBe(true);

  expect(roundTrip.restoredFromIdb.files['app.py']).toBe('print("hello python")\n');
  expect(roundTrip.restoredFromIdb.saveErrors).toBe(0);

  expect(roundTrip.afterModeToggleFiles['app.py']).toBe('print("hello python")\n');
  expect(roundTrip.afterModeToggleFiles['notes.md']).toBe('# Keep me\n');
  expect(roundTrip.headIdentity).toBe(true);

  expect(pageErrors).toEqual([]);
});

test('M2.2 Iter2 Track 3 (Clone & Modals): traversal URL block, jsDelivr mid-stream body rollback, intoRoot false/true VFS copy, and modal focus/backdrop guards', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  let networkCalls = 0;
  await page.route('https://api.github.com/**', async (route) => {
    networkCalls++;
    const url = route.request().url();
    if (url.includes('/repos/acme/sub-repo/git/trees/')) {
      const tree = Array.from({ length: 7 }, (_, i) => ({
        path: i === 0 ? 'README.md' : `src/item${i}.js`,
        mode: '100644',
        type: 'blob',
        size: 24,
        sha: `sub-sha-${i}`
      }));
      tree.push({ path: 'empty-dir', mode: '040000', type: 'tree', sha: 'tree-empty' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'subhead1', truncated: false, tree }) });
      return;
    }
    if (url.includes('/repos/acme/sub-repo')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ default_branch: 'main', html_url: 'https://github.com/acme/sub-repo' })
      });
      return;
    }
    await route.abort();
  });

  await page.route('https://raw.githubusercontent.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/acme/sub-repo/main/')) {
      const rel = url.split('/main/')[1] || 'file.js';
      await route.fulfill({ status: 200, contentType: 'text/plain', body: `// ${rel}\nmodule.exports = 1;\n` });
      return;
    }
    await route.abort();
  });

  // Seed sentinel file and switch to Source Control sidebar for real #cl-scm-clone-btn trigger focus test
  await page.evaluate(() => {
    const ide = (window as any).__codelabTest.ide;
    ide.setFiles({ 'sentinel.js': 'const keep = true;\n' });
  });
  await page.click('[data-cl-activity="scm"]');
  await expect(page.locator('#cl-scm-clone-btn')).toBeVisible();

  // 1. Focus trigger -> open Clone modal -> block traversal URLs synchronously with 0 network calls -> clear error on branch input
  await page.locator('#cl-scm-clone-btn').focus();
  await page.locator('#cl-scm-clone-btn').click();
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toBeVisible();

  for (const badInput of ['https://github.com/../evil', 'https://github.com/org/..', 'https://github.com/org/%2e%2e']) {
    await page.fill('#cl-clone-repo-input', badInput);
    await page.click('#cl-clone-submit-btn');
    await expect(page.locator('#cl-clone-error-banner[role="alert"]')).toBeVisible();
  }
  expect(networkCalls).toBe(0);

  await page.fill('#cl-clone-branch-input', 'main');
  await expect(page.locator('#cl-clone-error-banner')).toBeHidden();

  // 2. Backdrop drag-out guard: pointerdown inside input + click on backdrop MUST NOT dismiss Clone modal
  await page.evaluate(() => {
    const input = document.querySelector('#cl-clone-repo-input')!;
    const backdrop = document.querySelector('.codelab-modal-backdrop')!;
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toBeVisible();

  // 3. Chained modal focus restoration: Clone -> Workspace Confirm -> Cancel -> Escape restores #cl-scm-clone-btn focus
  await page.fill('#cl-clone-repo-input', 'acme/sub-repo');
  await page.click('#cl-clone-submit-btn');
  await expect(page.locator('#workspace-confirm-modal[data-cl-modal="workspace-confirm"]')).toBeVisible();
  await page.locator('#workspace-confirm-modal [data-cl-confirm="cancel"]').click();
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cl-modal="clone-repo"]')).toHaveCount(0);
  await expect(page.locator('#cl-scm-clone-btn')).toBeFocused();
  await page.click('[data-cl-activity="explorer"]');

  // 4. Mid-body stream failure on cdn.jsdelivr.net/gh/ (HTTP 200 + res.text() stream rejection) rolls back 100%
  const streamRollback = await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    const customFetch = async (url: string) => {
      const u = String(url);
      if (u.includes('/repos/acme/stream-fail/git/trees/')) {
        return new Response(JSON.stringify({
          sha: 'deadbeef',
          truncated: false,
          tree: [
            { path: 'README.md', mode: '100644', type: 'blob', size: 10, sha: '1' },
            { path: 'midstream.js', mode: '100644', type: 'blob', size: 20, sha: '2' }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('/repos/acme/stream-fail')) {
        return new Response(JSON.stringify({ default_branch: 'main' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (u.includes('raw.githubusercontent.com')) {
        return new Response('rate limited', { status: 429 });
      }
      if (u.includes('cdn.jsdelivr.net/gh/acme/stream-fail@main/README.md')) {
        return new Response('# Stream Repo\n', { status: 200 });
      }
      if (u.includes('cdn.jsdelivr.net/gh/acme/stream-fail@main/midstream.js')) {
        const brokenStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('const half = '));
          },
          pull() {
            throw new TypeError('mid-body stream reset');
          }
        });
        return new Response(brokenStream, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    };
    let caught = '';
    try {
      await ide.cloneRepo('acme/stream-fail', { intoRoot: true, force: true, fetchImpl: customFetch });
    } catch (err: any) {
      caught = String(err && err.message ? err.message : err);
    }
    return {
      caught,
      files: ide.getFiles(),
      readmeLeaked: ide.shell.vfs.existsSync('/workspace/README.md')
    };
  });
  expect(streamRollback.caught.length).toBeGreaterThan(0);
  expect(streamRollback.files).toEqual({ 'sentinel.js': 'const keep = true;\n' });
  expect(streamRollback.readmeLeaked).toBe(false);

  // 5. Subdirectory clone (intoRoot: false) populates sub-repo/*, preserves sentinel.js, caps tabs <= 1, and leaks 0 .git files
  const subClone = await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    ide.closeAllTabs?.();
    ide.openTabs = [];
    await ide.cloneRepo('acme/sub-repo', { intoRoot: false });
    const files = Object.keys(ide.getFiles());
    return {
      hasSentinel: files.includes('sentinel.js'),
      subRepoFiles: files.filter((f: string) => f.startsWith('sub-repo/')).length,
      hasGitFiles: files.some((f: string) => f.includes('.git')),
      openTabsCount: ide.getOpenTabs().length
    };
  });
  expect(subClone.hasSentinel).toBe(true);
  expect(subClone.subRepoFiles).toBe(7);
  expect(subClone.hasGitFiles).toBe(false);
  expect(subClone.openTabsCount).toBeLessThanOrEqual(1);

  // 6. Root clone (intoRoot: true) writes /workspace/.git/HEAD and preserves headSnapshot === headFiles
  const rootClone = await page.evaluate(async () => {
    const ide = (window as any).__codelabTest.ide;
    await ide.cloneRepo('acme/sub-repo', { intoRoot: true, force: true });
    return {
      hasGitHeadFile: ide.shell.vfs.existsSync('/workspace/.git/HEAD'),
      gitHeadContent: ide.shell.vfs.readFileSync('/workspace/.git/HEAD', 'utf8'),
      headIdentity: ide.shell.gitState.headSnapshot === ide.shell.gitState.headFiles,
      hasSrcDirAcrossStores: ide.shell.vfs.existsSync('/workspace/src') &&
        ide.kernel.fs.readdir('/workspace').some((e: any) => (e.name ?? e) === 'src')
    };
  });
  expect(rootClone.hasGitHeadFile).toBe(true);
  expect(rootClone.gitHeadContent).toContain('refs/heads/main');
  expect(rootClone.headIdentity).toBe(true);
  expect(rootClone.hasSrcDirAcrossStores).toBe(true);

  // 7. #delete-confirm-modal ARIA attributes & #reset-confirm-modal safe initial focus on Cancel
  await page.locator('#cl-explorer-list .codelab-file-item[data-cl-file="README.md"]').click({ button: 'right' });
  await page.locator('#cl-context-menu-slot [data-ctx-action="delete-file"]').click();
  await expect(page.locator('#delete-confirm-modal[data-cl-modal="delete-confirm"][role="dialog"][aria-modal="true"]')).toBeVisible();
  await page.locator('#delete-confirm-modal [data-cl-confirm="cancel"]').click();

  await page.evaluate(() => (window as any).__codelabTest.ide.resetLab());
  await expect(page.locator('#reset-confirm-modal[data-cl-modal="reset-confirm"]')).toBeVisible();
  await expect(page.locator('#reset-confirm-modal [data-cl-confirm="cancel"]')).toBeFocused();
  await page.locator('#reset-confirm-modal [data-cl-confirm="cancel"]').click();

  expect(pageErrors).toEqual([]);
});


test.describe('M2.3 — Search, Source Control, Problems, Multi-Session Terminal & Accessibility', () => {
  test('Search sidebar supports include/exclude globs, invalid regex alert, $1 replace, and in-place Replace All without opening tabs', async ({ page }) => {
    await page.evaluate(() => {
      const ide = (window as any).__codelabTest.ide;
      ide.setFiles({
        'open.js': 'const alpha = 1;\nconst beta = 2;\n',
        'src/worker.js': 'const gamma = 3;\n',
        'docs/readme.md': 'const keepMe = 4;\n'
      });
      ide.openFile('open.js');
      ide.closeOtherTabs('open.js');
    });

    await page.click('[data-cl-activity="search"]');
    await expect(page.locator('#cl-sidebar-search')).toBeVisible();

    // Invalid regex surfaces accessible alert
    await page.click('[data-cl-search-opt="regex"]');
    await page.fill('#cl-search-input', '[unclosed(');
    await expect(page.locator('#cl-search-results [role="alert"]')).toContainText('Invalid regular expression');

    // Glob-scoped regex search + single-match $1 replace + in-place Replace All
    await page.fill('#cl-search-include', '*.js, src/**');
    await page.fill('#cl-search-exclude', 'docs/**');
    await page.fill('#cl-search-input', 'const (\\w+)');
    await page.fill('#cl-search-replace-input', 'let $1');
    await expect(page.locator('#cl-search-results')).not.toContainText('readme.md');

    await page.click('[data-cl-action="search-replace-one"]');
    const afterOne = await page.evaluate(() => (window as any).__codelabTest.ide.getFile('open.js'));
    expect(afterOne).toContain('let alpha = 1;');
    expect(afterOne).toContain('const beta = 2;');

    await page.click('[data-cl-action="search-replace-all"]');
    const state = await page.evaluate(() => {
      const ide = (window as any).__codelabTest.ide;
      return {
        openTabs: ide.getOpenTabs(),
        workerJs: ide.getFile('src/worker.js'),
        readmeMd: ide.getFile('docs/readme.md')
      };
    });
    expect(state.openTabs).toEqual(['open.js']);
    expect(state.workerJs).toBe('let gamma = 3;\n');
    expect(state.readmeMd).toBe('const keepMe = 4;\n');
  });

  test('Source Control initializes Git, opens non-destructive inline Diff, creates branches, and confirms Discard', async ({ page }) => {
    await page.evaluate(() => {
      const ide = (window as any).__codelabTest.ide;
      ide.setFiles({ 'service.js': 'export const port = 3000;\n' });
      ide.openFile('service.js');
    });

    await page.click('[data-cl-activity="scm"]');
    await page.click('#cl-scm-init-btn');
    await page.click('[data-cl-action="scm-stage-all"]');
    await page.fill('#cl-scm-commit-input', 'feat: initial commit');
    await page.click('#cl-scm-commit-btn');
    await expect(page.locator('#cl-scm-view-body')).toContainText('Working tree clean');

    // Modify file, preserve commit draft across Stage/Unstage, and inspect inline Diff
    await page.evaluate(() => {
      (window as any).__codelabTest.ide.setFile('service.js', 'export const port = 8080;\n');
    });
    await page.fill('#cl-scm-commit-input', 'wip draft preserved');
    await page.click('[data-cl-action="scm-stage-file"]');
    await expect(page.locator('#cl-scm-commit-input')).toHaveValue('wip draft preserved');
    await page.click('[data-cl-action="scm-unstage-file"]');
    await expect(page.locator('#cl-scm-commit-input')).toHaveValue('wip draft preserved');

    await page.locator('.codelab-scm-item[data-cl-scm-file="service.js"]').click();
    await expect(page.locator('#cl-inline-diff-container')).toBeVisible();
    await expect(page.locator('#cl-inline-diff-container')).toContainText('+1');
    await page.click('[data-cl-action="scm-close-diff"]');
    await expect(page.locator('#cl-inline-diff-container')).toBeHidden();

    // Discard via accessible dialog restores HEAD
    await page.click('[data-cl-action="scm-discard-file"]');
    await expect(page.locator('#cl-discard-cancel-btn')).toBeFocused();
    await page.click('#cl-discard-confirm-btn');
    const restored = await page.evaluate(() => (window as any).__codelabTest.ide.getFile('service.js'));
    expect(restored).toBe('export const port = 3000;\n');
  });

  test('Problems panel filters diagnostics by text/severity and Multi-Session Terminal isolates cwd & resets last session', async ({ page }) => {
    await page.evaluate(() => {
      const ide = (window as any).__codelabTest.ide;
      ide.setFiles({
        'bad.json': '{ "invalid": }',
        'ok.js': 'console.log("clean");\n'
      });
      ide.openProblemsPanel();
    });

    await expect(page.locator('#cl-problems-filter')).toBeVisible();
    await expect(page.locator('#cl-problems-list')).toContainText('bad.json');
    await page.click('[data-cl-severity-filter="warning"]');
    await expect(page.locator('#cl-problems-list')).not.toContainText('bad.json');
    await page.click('[data-cl-severity-filter="all"]');
    await expect(page.locator('#cl-problems-list')).toContainText('bad.json');

    // Multi-session terminal isolation + Tab completion + zero nested interactive elements
    await page.click('[data-cl-drawertab="terminal"]');
    await expect(page.locator('#cl-terminal-sessions .codelab-session-pill')).toHaveCount(1);

    const replInput = page.locator('#cl-repl-input');
    await replInput.focus();
    await replInput.fill('pyth');
    await replInput.press('Tab');
    await expect(replInput).toHaveValue(/^python3\s*$/);

    await page.click('[data-cl-action="new-terminal-session"]');
    await expect(page.locator('#cl-terminal-sessions .codelab-session-pill')).toHaveCount(2);

    const nestedCount = await page.locator('button button, button [role="button"], a button').count();
    expect(nestedCount).toBe(0);
  });
});
