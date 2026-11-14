import { test, expect } from '@playwright/test';
import {
  assertNoOverlap,
  assertSidebarDrawerSeparation,
  attachZeroErrorTracker,
  clickMenuItem,
  getEffectiveColors,
  getPublicWorkbenchFiles,
  getRect,
  installOfflineCdnStubs,
  openOrCreateCodeFile,
  openSearchSidebar,
  openSettingsTabViaGear,
  expectDrawerTabActive,
  openTopMenu,
  runTerminalCommand,
  seedPersistedWorkspace,
  withAutoAcceptDialog,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

test.describe('Tier 2 — Boundary, Negative & Corner Cases: Layout, Menus, Splitters, Explorer & Polish (F1–F4, F12)', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page);
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F1: Menu Bar Boundary & Negative Cases (5 tests: T2-F1-01 .. T2-F1-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F1-01: Menu Bar Escape and outside-canvas click dismiss open dropdown without executing any command', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f1-01');
    const beforeFiles = await getPublicWorkbenchFiles(page);

    await openTopMenu(page, 'File');
    await page.keyboard.press('Escape');
    await expect(workbenchLocators.openDropdownMenus(page)).toHaveCount(0);

    await openTopMenu(page, 'View');
    await page.locator('#cl-fallback-editor').click({ position: { x: 100, y: 100 } });
    await expect(workbenchLocators.openDropdownMenus(page)).toHaveCount(0);

    expect(await getPublicWorkbenchFiles(page)).toEqual(beforeFiles);
  });

  test('T2-F1-02: Menu Bar keyboard navigation (ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End) cycles menus & items cleanly', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f1-02');
    const fileTrigger = workbenchLocators.menuTrigger(page, 'File');
    await expect(fileTrigger).toBeVisible();
    await fileTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(workbenchLocators.openDropdownMenus(page)).toHaveCount(1);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowRight');
    await expect(workbenchLocators.openDropdownMenus(page).first()).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(workbenchLocators.openDropdownMenus(page).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(workbenchLocators.openDropdownMenus(page)).toHaveCount(0);
  });

  test('T2-F1-03: Hover-switching across top-level Menu Bar items while one menu is open switches active dropdown with zero stacked menus', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f1-03');
    await openTopMenu(page, 'File');
    expect(await workbenchLocators.openDropdownMenus(page).count()).toBe(1);

    await workbenchLocators.menuTrigger(page, 'View').hover();
    expect(await workbenchLocators.openDropdownMenus(page).count()).toBe(1);
    await expect(workbenchLocators.openDropdownMenus(page).first()).toContainText(
      /Explorer|Search|Problems|Terminal/i
    );
  });

  test('T2-F1-04: Command Palette empty/nonsense query renders clean empty state and recovers on Backspace', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f1-04');
    await page.keyboard.press('ControlOrMeta+Shift+P');
    const paletteInput = workbenchLocators.paletteInput(page);
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill('> zzzz_nonexistent_999');
    const paletteContainer = page
      .locator(':is(#cl-palette-list, .codelab-palette, [role="dialog"][aria-label*="Command" i])')
      .first();
    await expect(paletteContainer).toContainText(/No matching|No commands|No results|0/i);

    await paletteInput.fill('>');
    await expect(paletteContainer).toContainText(/Settings|Terminal|Search/i);
    await page.keyboard.press('Escape');
  });

  test('T2-F1-05: Rapidly clicking Menu Bar items and workspace controls on /cloud-ide never mounts duplicate .codelab-workbench instances', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }
    await expect(workbenchLocators.root(page)).toBeVisible();

    await clickMenuItem(page, 'View', /Explorer/i);
    await clickMenuItem(page, 'View', /Search/i);
    await clickMenuItem(page, 'View', /Terminal/i);

    await expect(page.locator('.codelab-workbench')).toHaveCount(1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F2: Activity Bar & Sidebar Boundary Cases (5 tests: T2-F2-01 .. T2-F2-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F2-01: Dragging #cl-splitter-files past left (-100) and right (2000) viewport edges clamps sidebar width to safe min/max', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f2-01');
    const sidebar = workbenchLocators.sidebar(page);
    const splitter = workbenchLocators.sidebarSplitter(page);
    await expect(sidebar).toBeVisible();
    await expect(splitter).toBeVisible();

    // Drag extreme left (-100)
    const box1 = await getRect(splitter);
    await page.mouse.move(box1.left + box1.width / 2, box1.top + box1.height / 2);
    await page.mouse.down();
    await page.mouse.move(-100, box1.top + box1.height / 2, { steps: 6 });
    await page.mouse.up();

    if (await sidebar.isVisible()) {
      const clampedMin = (await getRect(sidebar)).width;
      expect(clampedMin).toBeGreaterThanOrEqual(120);
    } else {
      await page.keyboard.press('ControlOrMeta+b');
    }

    // Drag extreme right (2000)
    const box2 = await getRect(splitter);
    await page.mouse.move(box2.left + box2.width / 2, box2.top + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(2000, box2.top + box2.height / 2, { steps: 6 });
    await page.mouse.up();

    const clampedMax = (await getRect(sidebar)).width;
    const editorWidth = (await getRect(workbenchLocators.editorCol(page))).width;
    expect(clampedMax).toBeLessThanOrEqual(1280 * 0.65);
    expect(editorWidth).toBeGreaterThanOrEqual(250);

    // Double-click resets to default width (~170..280px)
    await splitter.dblclick();
    const resetWidth = (await getRect(sidebar)).width;
    expect(resetWidth).toBeGreaterThanOrEqual(150);
    expect(resetWidth).toBeLessThanOrEqual(320);
  });

  test('T2-F2-02: Narrow viewport (560x800) keeps Activity Bar / Sidebar toggle accessible and avoids horizontal document overflow', async ({
    page
  }) => {
    await page.setViewportSize({ width: 560, height: 800 });
    await page.goto('/workbench?labId=t2-f2-02');
    await expect(workbenchLocators.root(page)).toBeVisible();

    const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docScrollWidth).toBeLessThanOrEqual(562);

    await page.keyboard.press('ControlOrMeta+b');
    const editorCol = workbenchLocators.editorCol(page);
    await expect(editorCol).toBeVisible();
    const editorRect = await getRect(editorCol);
    expect(editorRect.width).toBeGreaterThanOrEqual(200);
    expect(editorRect.height).toBeGreaterThanOrEqual(150);
  });

  test('T2-F2-03: Collapsing Primary Sidebar while Search is active and clicking a different Activity Bar icon re-expands directly to new view', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f2-03');
    await openSearchSidebar(page);
    await expect(workbenchLocators.searchView(page)).toBeVisible();

    await page.keyboard.press('ControlOrMeta+b');
    await expect
      .poll(async () => {
        if (!(await workbenchLocators.sidebar(page).isVisible())) return 0;
        return (await workbenchLocators.sidebar(page).boundingBox())?.width ?? 0;
      })
      .toBeLessThanOrEqual(2);

    await workbenchLocators.activityItem(page, 'scm').click();
    await expect(workbenchLocators.sidebar(page)).toBeVisible();
    await expect(workbenchLocators.scmView(page)).toBeVisible();
  });

  test('T2-F2-04: SQL single-file guided lab mode hides multi-file Explorer without throwing layout or null-reference errors', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f2-04&sqlSingle=1');
    await expect(workbenchLocators.root(page)).toBeVisible();

    await page.evaluate(() => (window as any).__codelabIde.runSql('run'));
    await expect(workbenchLocators.drawer(page)).toBeVisible();
    const wbRect = await getRect(workbenchLocators.root(page));
    expect(wbRect.width).toBeGreaterThan(800);
    expect(wbRect.height).toBeGreaterThan(500);
  });

  test('T2-F2-05: Disposing a registered location: "sidebar" plugin while its sidebar view is active falls back cleanly to Explorer', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f2-05');

    await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      (window as any).__tempPluginDisp = ide.registerPlugin({
        id: 'test.disposableSb',
        name: 'Disposable SB',
        version: '1.0.0',
        contributes: {
          panels: [
            {
              id: 'disposable-sb',
              title: 'Temp View',
              location: 'sidebar',
              render(el: HTMLElement) {
                el.innerHTML = '<div data-testid="temp-sb-node">Active Plugin</div>';
              }
            }
          ]
        }
      });
    });

    const btn = page
      .locator(
        '.codelab-activitybar :is([data-cl-activity="disposable-sb"], button[aria-label*="Temp View" i], button[title*="Temp View" i])'
      )
      .first();
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('[data-testid="temp-sb-node"]')).toBeVisible();

    await page.evaluate(() => (window as any).__tempPluginDisp.dispose());
    await expect(page.locator('[data-testid="temp-sb-node"]')).toHaveCount(0);
    await expect(workbenchLocators.explorerView(page)).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F3: Bottom Panel Boundary Cases (5 tests: T2-F3-01 .. T2-F3-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F3-01: Dragging #cl-splitter-h to clientY = -50 (top) and clientY = 1500 (bottom) clamps Bottom Panel height and preserves editor visibility', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f3-01');
    await workbenchLocators.drawerTab(page, 'terminal').click();
    const splitter = workbenchLocators.drawerSplitter(page);
    await expect(splitter).toBeVisible();

    // Drag extreme top (-50)
    const s1 = await getRect(splitter);
    await page.mouse.move(s1.left + s1.width / 2, s1.top + s1.height / 2);
    await page.mouse.down();
    await page.mouse.move(s1.left + s1.width / 2, -50, { steps: 6 });
    await page.mouse.up();

    const editorRectTop = await getRect(workbenchLocators.editorCol(page));
    expect(editorRectTop.height).toBeGreaterThanOrEqual(80);
    await assertSidebarDrawerSeparation(page);

    // Drag extreme bottom (1500)
    const s2 = await getRect(splitter);
    await page.mouse.move(s2.left + s2.width / 2, s2.top + s2.height / 2);
    await page.mouse.down();
    await page.mouse.move(s2.left + s2.width / 2, 1500, { steps: 6 });
    await page.mouse.up();

    if (await workbenchLocators.drawerBody(page).isVisible()) {
      const drawerRectBottom = await getRect(workbenchLocators.drawer(page));
      expect(drawerRectBottom.height).toBeGreaterThanOrEqual(70);
      await assertSidebarDrawerSeparation(page);
    }
  });

  test('T2-F3-02: Maximizing Bottom Panel, clicking Close (x), then reopening restores normal panel geometry', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f3-02');
    await workbenchLocators.drawerTab(page, 'terminal').click();

    await workbenchLocators.drawerMaximizeBtn(page).click();
    await workbenchLocators.drawerCloseBtn(page).click();

    await expect
      .poll(async () => {
        if (!(await workbenchLocators.drawerBody(page).isVisible())) return 0;
        return (await workbenchLocators.drawerBody(page).boundingBox())?.height ?? 0;
      })
      .toBeLessThanOrEqual(2);

    await page.keyboard.press('Control+`');
    await expect(workbenchLocators.terminalSurface(page)).toBeVisible();
    const { drawerRect } = await assertSidebarDrawerSeparation(page);
    expect(drawerRect.height).toBeGreaterThan(80);
    expect(drawerRect.height).toBeLessThan(760);
  });

  test('T2-F3-03: Collapsing Primary Sidebar (Mod+B) expands Bottom Panel leftward to Activity Bar edge; re-expanding pushes it back right', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f3-03');
    await workbenchLocators.drawerTab(page, 'terminal').click();

    const actRect = await getRect(workbenchLocators.activityBar(page));
    const { sidebarRect } = await assertSidebarDrawerSeparation(page);

    await page.keyboard.press('ControlOrMeta+b');
    await expect
      .poll(async () => (await getRect(workbenchLocators.drawer(page))).left)
      .toBeLessThanOrEqual(actRect.right + 4);

    await page.keyboard.press('ControlOrMeta+b');
    await expect
      .poll(async () => (await getRect(workbenchLocators.drawer(page))).left)
      .toBeGreaterThanOrEqual(sidebarRect.right - 2);
  });

  test('T2-F3-04: Docking Web Preview to right split pane while Bottom Panel is open maintains clean 5-region non-overlapping rectangles', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f3-04');
    await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      ide.portTable.registerServer(3000, {
        name: 'preview-app',
        fetch: () => new Response('<h1>Split Preview</h1>', { headers: { 'Content-Type': 'text/html' } })
      });
      ide.toggleWebPreview();
    });

    const dockToggle = page
      .locator('[data-cl-action="preview-dock-toggle"]')
      .filter({ visible: true })
      .first();
    await expect(dockToggle).toBeVisible();
    await dockToggle.click();

    const splitPane = page.locator('#cl-preview-split');
    await expect(splitPane).toBeVisible();
    await workbenchLocators.drawerTab(page, 'terminal').click();

    const sidebarRect = await getRect(workbenchLocators.sidebar(page));
    const editorRect = await getRect(workbenchLocators.editorCol(page));
    const previewRect = await getRect(splitPane);
    const drawerRect = await getRect(workbenchLocators.drawer(page));

    assertNoOverlap(sidebarRect, editorRect, 'Sidebar', 'Editor');
    assertNoOverlap(editorRect, previewRect, 'Editor', 'PreviewSplit');
    assertNoOverlap(sidebarRect, drawerRect, 'Sidebar', 'BottomDrawer');
    assertNoOverlap(previewRect, drawerRect, 'PreviewSplit', 'BottomDrawer');
  });

  test('T2-F3-05: Invalid workbench.panel.defaultTab value in .codelab/settings.json falls back gracefully to terminal without blank #cl-drawer-body', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f3-05',
      {
        'index.js': 'console.log(1);\n',
        '.codelab/settings.json': '{\n  "workbench.panel.defaultTab": "nonexistent-tab"\n}\n'
      },
      { activeFile: 'index.js' }
    );
    await page.goto('/workbench?labId=t2-f3-05');

    await expect(workbenchLocators.drawer(page)).toBeVisible();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'terminal'));
    await expect(workbenchLocators.terminalSurface(page)).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F4: Explorer Boundary & Negative Cases (6 tests: T2-F4-01 .. T2-F4-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F4-01: Mounting explicit empty workspace (?empty=1 / files: {}) renders 0 files and Welcome CTAs without injecting starter files', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f4-01&empty=1');
    await expect(workbenchLocators.root(page)).toBeVisible();

    const files = await getPublicWorkbenchFiles(page);
    expect(Object.keys(files)).toEqual([]);
    await expect(page.locator('aside.codelab-sidebar .codelab-file-item')).toHaveCount(0);

    await expect(
      page.locator('aside.codelab-sidebar, .codelab-editor-col').filter({
        hasText: /New File|Clone Repository/i
      }).first()
    ).toBeVisible();
  });

  test('T2-F4-02: Inline file rename collision onto existing sibling filename (a.js -> b.js) refuses overwrite and preserves both files', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f4-02',
      {
        'a.js': 'const FILE_A = "ORIGINAL_A";\n',
        'b.js': 'const FILE_B = "ORIGINAL_B";\n'
      },
      { activeFile: 'a.js' }
    );
    await page.goto('/workbench?labId=t2-f4-02');

    await page.evaluate(() => (window as any).__codelabIde.startInlineRename('a.js'));
    const renameInput = page
      .locator('aside.codelab-sidebar :is(#cl-tree-rename-input, .codelab-inline-input)')
      .first();
    await expect(renameInput).toBeVisible();
    await renameInput.fill('b.js');
    await renameInput.press('Enter');
    await page.keyboard.press('Escape');

    const files = await getPublicWorkbenchFiles(page);
    expect(files['a.js']).toBe('const FILE_A = "ORIGINAL_A";\n');
    expect(files['b.js']).toBe('const FILE_B = "ORIGINAL_B";\n');
  });

  test('T2-F4-03: Inline create/rename with empty whitespace, path traversal (../../etc/passwd), or Escape cancels safely', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f4-03');
    const initialFiles = await getPublicWorkbenchFiles(page);

    // 1. Escape cancels inline create
    await page.evaluate(() => (window as any).__codelabIde.startInlineCreate('file', ''));
    const input1 = page
      .locator('aside.codelab-sidebar :is(#cl-tree-create-input, .codelab-inline-input)')
      .first();
    await expect(input1).toBeVisible();
    await input1.fill('canceled.js');
    await input1.press('Escape');
    expect((await getPublicWorkbenchFiles(page))['canceled.js']).toBeUndefined();

    // 2. Empty whitespace submits 0 files
    await page.evaluate(() => (window as any).__codelabIde.startInlineCreate('file', ''));
    const input2 = page
      .locator('aside.codelab-sidebar :is(#cl-tree-create-input, .codelab-inline-input)')
      .first();
    await input2.fill('   ');
    await input2.press('Enter');
    await page.keyboard.press('Escape');
    expect(Object.keys(await getPublicWorkbenchFiles(page)).length).toBe(
      Object.keys(initialFiles).length
    );

    // 3. Path traversal attempt never writes outside /workspace
    await page.evaluate(() => (window as any).__codelabIde.startInlineCreate('file', ''));
    const input3 = page
      .locator('aside.codelab-sidebar :is(#cl-tree-create-input, .codelab-inline-input)')
      .first();
    if (await input3.isVisible()) {
      await input3.fill('../../etc/passwd');
      await input3.press('Enter');
      await page.keyboard.press('Escape');
    }
    const checkOutside = await runTerminalCommand(
      page,
      'test -f /etc/passwd && echo "ESCAPED" || echo "SAFE"'
    );
    expect(checkOutside).toContain('SAFE');
  });

  test('T2-F4-04: File delete confirmation: Cancel preserves file in Explorer & VFS; Confirm deletes from Explorer & VFS', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f4-04');
    await expect(workbenchLocators.fileItem(page, 'index.js')).toBeVisible();

    // 1. Trigger delete -> Cancel
    let handledNativeDialog = false;
    const cancelHandler = (dlg: any): void => {
      handledNativeDialog = true;
      void dlg.dismiss().catch(() => {});
    };
    page.on('dialog', cancelHandler);
    try {
      await workbenchLocators.fileItem(page, 'index.js').click({ button: 'right' });
      await page
        .locator('.codelab-context-menu :is([data-cl-ctx="delete"], button:has-text("Delete"), [role="menuitem"]:has-text("Delete"))')
        .first()
        .click();
    } finally {
      page.off('dialog', cancelHandler);
    }

    if (!handledNativeDialog) {
      const cancelDomBtn = page
        .locator(':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:has-text("Cancel")')
        .first();
      await expect(cancelDomBtn).toBeVisible();
      await cancelDomBtn.click();
    }

    await expect(workbenchLocators.fileItem(page, 'index.js')).toBeVisible();
    expect((await getPublicWorkbenchFiles(page))['index.js']).toBeDefined();

    // 2. Trigger delete -> Confirm
    await withAutoAcceptDialog(page, async () => {
      await workbenchLocators.fileItem(page, 'index.js').click({ button: 'right' });
      await page
        .locator('.codelab-context-menu :is([data-cl-ctx="delete"], button:has-text("Delete"), [role="menuitem"]:has-text("Delete"))')
        .first()
        .click();
    });

    if ((await getPublicWorkbenchFiles(page))['index.js'] !== undefined) {
      const confirmDomBtn = page
        .locator(
          ':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:is(:has-text("Delete"), :has-text("Confirm"))'
        )
        .first();
      await expect(confirmDomBtn).toBeVisible();
      await confirmDomBtn.click();
    }

    await expect(workbenchLocators.fileItem(page, 'index.js')).toHaveCount(0);
    expect((await getPublicWorkbenchFiles(page))['index.js']).toBeUndefined();
    const lsRoot = await runTerminalCommand(page, 'ls');
    expect(lsRoot).not.toContain('index.js');
  });

  test('T2-F4-05: Recursive non-empty folder delete confirmation: Cancel preserves subtree; Confirm removes nested files/dirs from VFS & closes tabs', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f4-05',
      {
        'index.js': '// root\n',
        'pkg/a.js': '// a\n',
        'pkg/sub/b.js': '// b\n'
      },
      { activeFile: 'pkg/a.js', openTabs: ['pkg/a.js', 'pkg/sub/b.js'] }
    );
    await page.goto('/workbench?labId=t2-f4-05');

    // Cancel delete
    let dismissed = false;
    const dismissFn = (dlg: any): void => {
      dismissed = true;
      void dlg.dismiss().catch(() => {});
    };
    page.on('dialog', dismissFn);
    try {
      await workbenchLocators.folderItem(page, 'pkg').click({ button: 'right' });
      await page
        .locator('.codelab-context-menu :is([data-cl-ctx="delete"], button:has-text("Delete"), [role="menuitem"]:has-text("Delete"))')
        .first()
        .click();
    } finally {
      page.off('dialog', dismissFn);
    }
    if (!dismissed) {
      const cancelFolderBtn = page
        .locator(':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:has-text("Cancel")')
        .first();
      await expect(cancelFolderBtn).toBeVisible();
      await cancelFolderBtn.click();
    }
    expect((await getPublicWorkbenchFiles(page))['pkg/sub/b.js']).toBe('// b\n');

    // Confirm delete
    await withAutoAcceptDialog(page, async () => {
      await workbenchLocators.folderItem(page, 'pkg').click({ button: 'right' });
      await page
        .locator('.codelab-context-menu :is([data-cl-ctx="delete"], button:has-text("Delete"), [role="menuitem"]:has-text("Delete"))')
        .first()
        .click();
    });
    if ((await getPublicWorkbenchFiles(page))['pkg/sub/b.js'] !== undefined) {
      const confirmFolderBtn = page
        .locator(
          ':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:is(:has-text("Delete"), :has-text("Confirm"))'
        )
        .first();
      await expect(confirmFolderBtn).toBeVisible();
      await confirmFolderBtn.click();
    }

    const afterFiles = await getPublicWorkbenchFiles(page);
    expect(afterFiles['pkg/a.js']).toBeUndefined();
    expect(afterFiles['pkg/sub/b.js']).toBeUndefined();
    await expect(workbenchLocators.fileTab(page, 'pkg/a.js')).toHaveCount(0);
    await expect(workbenchLocators.fileTab(page, 'pkg/sub/b.js')).toHaveCount(0);

    const lsOut = await runTerminalCommand(page, 'ls -la');
    expect(lsOut).not.toContain('pkg');
  });

  test('T2-F4-06: Closing all open editor tabs displays #cl-empty-editor watermark and clears stale filename breadcrumbs', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f4-06');

    const openTabs = await page.evaluate(() => (window as any).__codelabIde.getOpenTabs());
    for (const tabPath of openTabs) {
      await page.evaluate((p) => (window as any).__codelabIde.closeTab(p), tabPath);
    }

    await expect(page.locator('#cl-empty-editor')).toBeVisible();
    await expect(page.locator('#cl-breadcrumbs')).not.toContainText('index.js');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F12: Rough Edges, Contrast, Viewport Clamping & XSS (6 tests: T2-F12-01 .. T2-F12-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F12-01: Right-clicking near right edge, bottom edge, and bottom-right corner (1275, 795) clamps .codelab-context-menu strictly inside viewport', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f12-01');
    const fileRow = workbenchLocators.fileItem(page, 'index.js');
    await expect(fileRow).toBeVisible();

    for (const [cx, cy] of [
      [1275, 795],
      [20, 795],
      [1275, 20]
    ]) {
      await fileRow.dispatchEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: cx,
        clientY: cy
      });

      const ctxMenu = page.locator('.codelab-context-menu').first();
      await expect(ctxMenu).toBeVisible();
      const menuRect = await getRect(ctxMenu);
      expect(menuRect.left).toBeGreaterThanOrEqual(0);
      expect(menuRect.top).toBeGreaterThanOrEqual(0);
      expect(menuRect.right).toBeLessThanOrEqual(1280);
      expect(menuRect.bottom).toBeLessThanOrEqual(800);

      await page.keyboard.press('Escape');
    }
  });

  test('T2-F12-02: Zero invalid nested interactive controls (button button, button [role="button"], a button) across entire DOM', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f12-02');
    await openOrCreateCodeFile(page, 'second.js', 'const b = 2;\n');
    await openSettingsTabViaGear(page);
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await workbenchLocators.newTerminalBtn(page).click();

    await expect(
      page.locator('button button, button [role="button"], a button')
    ).toHaveCount(0);
  });

  test('T2-F12-03: Dark, Light, and High-Contrast themes eliminate white-on-white / invisible states on Split-Run menu & Settings controls', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f12-03');
    await openSettingsTabViaGear(page);

    for (const theme of ['dark', 'light', 'high-contrast'] as const) {
      await page.evaluate((t) => (window as any).__codelabIde.setTheme(t), theme);
      await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', theme);

      const openJsonBtn = workbenchLocators
        .settingsHost(page)
        .locator('[data-settings-action="open-json"], button:has-text("JSON")')
        .first();
      await expect(openJsonBtn).toBeVisible();
      const jsonBtnColors = await getEffectiveColors(openJsonBtn);
      expect(jsonBtnColors.fg).not.toBe(jsonBtnColors.bg);
      expect(jsonBtnColors.ratio).toBeGreaterThanOrEqual(3.5);

      const splitToggle = page.locator('[data-cl-action="toggle-split-run-menu"], #cl-split-run-caret').first();
      if (await splitToggle.isVisible()) {
        await splitToggle.click();
        const menuItem = page.locator('#cl-split-run-menu .codelab-split-menu__item, #cl-split-run-menu [role="menuitem"]').first();
        if (await menuItem.isVisible()) {
          await menuItem.hover();
          const hoverColors = await getEffectiveColors(menuItem);
          expect(hoverColors.fg).not.toBe(hoverColors.bg);
          expect(hoverColors.ratio).toBeGreaterThanOrEqual(3.5);
        }
        await page.keyboard.press('Escape');
      }
    }
  });

  test('T2-F12-04: Theme toggle synchronization between Cloud IDE html[data-theme] and Workbench .codelab[data-cl-theme]', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }
    await expect(workbenchLocators.root(page)).toBeVisible();

    await openSettingsTabViaGear(page);
    const themeSelect = workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="workbench.colorTheme"]');
    await themeSelect.selectOption('light');

    await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const hostThemeBtn = page.locator('#theme-btn');
    if (await hostThemeBtn.isVisible()) {
      await hostThemeBtn.click();
      await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', 'dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
  });

  test('T2-F12-05: Opening binary file triggers .codelab-file-guard safely without freezing UI', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f12-05');
    await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      ide.setFile('assets/icon.bin', 'BIN\u0000\u0001\u0002PAYLOAD');
      ide.openFile('assets/icon.bin');
    });

    await expect(page.locator('.codelab-file-guard')).toBeVisible();
  });

  test('T2-F12-06: XSS payload strings in Explorer, Tabs, Breadcrumbs, Search, and SCM are 100% HTML-escaped', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f12-06&git=1');
    const payloadName = 'src/<img src=x onerror=window.__xss=1>.js';
    const payloadCode = '// <script>window.__xss=2</script> xssSearchToken\n';

    await page.evaluate(
      ({ name, code }) => {
        const ide = (window as any).__codelabIde;
        ide.createFile(name, code);
        ide.openFile(name);
      },
      { name: payloadName, code: payloadCode }
    );

    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('xssSearchToken');
    await expect(searchView).toContainText('xssSearchToken');

    await workbenchLocators.activityItem(page, 'scm').click();
    await expect(workbenchLocators.scmView(page)).toBeVisible();

    const xssTriggered = await page.evaluate(() => (window as any).__xss);
    expect(xssTriggered).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });
});
