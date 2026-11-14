import { test, expect } from '@playwright/test';
import {
  assertSidebarDrawerSeparation,
  attachZeroErrorTracker,
  clickMenuItem,
  expectDrawerTabActive,
  getActiveLabId,
  getPublicWorkbenchFiles,
  getRect,
  installOfflineCdnStubs,
  openOrCreateCodeFile,
  openSearchSidebar,
  openTopMenu,
  runTerminalCommand,
  withAutoAcceptDialog,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

test.describe('Tier 1 — VS Code Title/Menu Bar, Activity Bar, Bottom Panel & Explorer (F1–F4)', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page);
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F1: VS Code Title & Menu Bar Navigation (6 tests: T1-F1-01 .. T1-F1-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F1-01: Title/Menu Bar renders canonical VS Code [role="menubar"] menus', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f1-01');
    await expect(workbenchLocators.root(page)).toBeVisible();

    const menubar = workbenchLocators.menubar(page);
    await expect(menubar).toBeVisible();

    const expectedMenus = [
      'File',
      'Edit',
      'Selection',
      'View',
      'Go',
      'Run',
      'Terminal',
      'Help'
    ];
    for (const label of expectedMenus) {
      await expect(workbenchLocators.menuTrigger(page, label)).toBeVisible();
    }
  });

  test('T1-F1-02: File menu actions (New File, New Folder, Preferences/Settings) execute on active workbench', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f1-02');
    const initialLabId = await getActiveLabId(page);
    expect(initialLabId).toBe('t1-f1-02');

    // 1. File -> New File triggers inline file creation in Explorer without resetting workspace
    await clickMenuItem(page, 'File', /^New File\b/i);
    const createInput = page.locator(
      'aside.codelab-sidebar :is(#cl-tree-create-input, input[data-cl-inline-create], .codelab-inline-input)'
    );
    await expect(createInput.first()).toBeVisible();
    await createInput.first().fill('from-menu.js');
    await createInput.first().press('Enter');

    await expect(workbenchLocators.fileItem(page, 'from-menu.js')).toBeVisible();
    expect(await getActiveLabId(page)).toBe('t1-f1-02');

    // 2. File -> Settings (or Preferences -> Settings) opens non-destructive __settings__ tab
    const fileMenu = await openTopMenu(page, 'File');
    const prefsItem = fileMenu.locator('[role="menuitem"]').filter({ hasText: /Preferences/i });
    if ((await prefsItem.count()) > 0 && (await prefsItem.first().isVisible())) {
      await prefsItem.first().hover();
      await page
        .locator('[role="menu"]:visible [role="menuitem"]')
        .filter({ hasText: /^\s*Settings\b/i })
        .first()
        .click();
    } else {
      await fileMenu
        .locator('[role="menuitem"]')
        .filter({ hasText: /Settings/i })
        .first()
        .click();
    }

    await expect(workbenchLocators.settingsTab(page)).toBeVisible();
    await expect(workbenchLocators.settingsHost(page)).toBeVisible();
    expect(await getActiveLabId(page)).toBe('t1-f1-02');
  });

  test('T1-F1-03: View and Edit menu items switch Sidebar views and Bottom Panel tabs', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f1-03');

    // Edit -> Find in Files (or View -> Search) activates Sidebar Search
    const editMenu = await openTopMenu(page, 'Edit');
    const findInFiles = editMenu
      .locator('[role="menuitem"]')
      .filter({ hasText: /Find in Files|Search/i });
    if ((await findInFiles.count()) > 0) {
      await findInFiles.first().click();
    } else {
      await page.keyboard.press('Escape');
      await clickMenuItem(page, 'View', /^Search\b/i);
    }
    await expect(workbenchLocators.searchView(page)).toBeVisible();

    // View -> Source Control activates Sidebar Source Control
    await clickMenuItem(page, 'View', /Source Control/i);
    await expect(workbenchLocators.scmView(page)).toBeVisible();

    // View -> Problems expands Bottom Panel on Problems tab
    await clickMenuItem(page, 'View', /Problems/i);
    await expect(workbenchLocators.drawer(page)).toBeVisible();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
  });

  test('T1-F1-04: Run and Terminal menus execute code and create/toggle terminal sessions', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f1-04');
    await openOrCreateCodeFile(page, 'index.js', 'console.log("MENU_RUN_OK_42");\n');

    await clickMenuItem(page, 'Run', /Run/i);
    await expect(workbenchLocators.terminalLog(page)).toContainText('MENU_RUN_OK_42');

    const beforeCount = await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      return ide.listTerminalSessions().length;
    });
    await clickMenuItem(page, 'Terminal', /New Terminal/i);
    const afterCount = await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      return ide.listTerminalSessions().length;
    });
    expect(afterCount).toBe(beforeCount + 1);
  });

  test('T1-F1-05: Command Center (Mod+P / Mod+Shift+P) opens Quick Open & Command Palette', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f1-05');

    const cmdCenter = workbenchLocators.commandCenterTrigger(page);
    await expect(cmdCenter).toBeVisible();
    await cmdCenter.click();

    const paletteInput = workbenchLocators.paletteInput(page);
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill('utils.js');
    await paletteInput.press('Enter');
    await expect(workbenchLocators.fileTab(page, 'src/utils.js')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+Shift+P');
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill('>Settings');
    await expect(
      page.locator(':is(#cl-palette-list, [role="listbox"], .codelab-palette)').first()
    ).toContainText(/Settings/i);
    await page.keyboard.press('Escape');
    await expect(paletteInput).toBeHidden();
  });

  test('T1-F1-06: Cloud IDE removes destructive top-bar buttons and delegates navigation to Workbench Menu/Activity Bar', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }

    await expect(workbenchLocators.root(page)).toBeVisible();
    await expect(workbenchLocators.menubar(page)).toBeVisible();

    // Legacy workspace-destroying utility buttons must be absent or hidden
    for (const legacySelector of [
      '#header-search-btn',
      '#header-scm-btn',
      '#header-problems-btn',
      '#header-settings-btn',
      '#header-zip-btn'
    ]) {
      await expect(page.locator(legacySelector)).toBeHidden();
    }

    // Combined top navigation height must stay compact (single unified VS Code titlebar or slim bar <= 64px)
    const editorTop = (await getRect(workbenchLocators.editorCol(page))).top;
    expect(editorTop).toBeLessThanOrEqual(88);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F2: VS Code Activity Bar & Collapsible Primary Sidebar (5 tests: T1-F2-01 .. T1-F2-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F2-01: Activity Bar renders 48px full-height rail with Explorer, Search, SCM, and bottom Settings gear', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f2-01');
    const activityBar = workbenchLocators.activityBar(page);
    await expect(activityBar).toBeVisible();

    const barRect = await getRect(activityBar);
    expect(barRect.width).toBeGreaterThanOrEqual(36);
    expect(barRect.width).toBeLessThanOrEqual(60);
    expect(barRect.left).toBeLessThanOrEqual(2);

    const explorerBtn = workbenchLocators.activityItem(page, 'explorer');
    const searchBtn = workbenchLocators.activityItem(page, 'search');
    const scmBtn = workbenchLocators.activityItem(page, 'scm');
    const gearBtn = workbenchLocators.activitySettingsGear(page);

    await expect(explorerBtn).toBeVisible();
    await expect(searchBtn).toBeVisible();
    await expect(scmBtn).toBeVisible();
    await expect(gearBtn).toBeVisible();

    const scmRect = await getRect(scmBtn);
    const gearRect = await getRect(gearBtn);
    expect(gearRect.top).toBeGreaterThan(scmRect.bottom + 40);
  });

  test('T1-F2-02: Clicking Activity Bar icons switches Primary Sidebar views and clicking active icon collapses/expands Sidebar', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f2-02');
    const searchBtn = workbenchLocators.activityItem(page, 'search');
    const sidebar = workbenchLocators.sidebar(page);

    await searchBtn.click();
    await expect(workbenchLocators.searchView(page)).toBeVisible();

    // Clicking active Search icon again collapses Primary Sidebar and hides splitter
    await searchBtn.click();
    await expect
      .poll(async () => {
        const visible = await sidebar.isVisible();
        if (!visible) return 0;
        return (await sidebar.boundingBox())?.width ?? 0;
      })
      .toBeLessThanOrEqual(2);
    await expect(workbenchLocators.sidebarSplitter(page)).toBeHidden();

    // Clicking Search icon a third time restores Sidebar directly to Search view
    await searchBtn.click();
    await expect(sidebar).toBeVisible();
    await expect(workbenchLocators.searchView(page)).toBeVisible();
  });

  test('T1-F2-03: Mod+B and Mod+Shift+E keyboard shortcuts toggle Primary Sidebar and focus Explorer', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f2-03');
    const sidebar = workbenchLocators.sidebar(page);
    await openSearchSidebar(page);
    await expect(workbenchLocators.searchView(page)).toBeVisible();

    // Mod+B collapses Sidebar
    await page.keyboard.press('ControlOrMeta+b');
    await expect
      .poll(async () => {
        if (!(await sidebar.isVisible())) return 0;
        return (await sidebar.boundingBox())?.width ?? 0;
      })
      .toBeLessThanOrEqual(2);

    // Mod+B re-expands Sidebar
    await page.keyboard.press('ControlOrMeta+b');
    await expect(sidebar).toBeVisible();

    // Mod+Shift+E switches back from Search to Explorer
    await page.keyboard.press('ControlOrMeta+Shift+E');
    await expect(workbenchLocators.explorerView(page)).toBeVisible();
  });

  test('T1-F2-04: Primary Sidebar width resizes via #cl-splitter-files and persists across page.reload()', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f2-04');
    const sidebar = workbenchLocators.sidebar(page);
    const splitter = workbenchLocators.sidebarSplitter(page);
    await expect(sidebar).toBeVisible();
    await expect(splitter).toBeVisible();

    const initialWidth = (await getRect(sidebar)).width;
    const handle = await getRect(splitter);

    await page.mouse.move(handle.left + handle.width / 2, handle.top + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.left + 70, handle.top + handle.height / 2, { steps: 6 });
    await page.mouse.up();

    const resizedWidth = (await getRect(sidebar)).width;
    expect(resizedWidth).toBeGreaterThan(initialWidth + 40);

    await openSearchSidebar(page);
    await expect(workbenchLocators.searchView(page)).toBeVisible();

    await page.reload();
    await expect(workbenchLocators.sidebar(page)).toBeVisible();
    await expect(workbenchLocators.searchView(page)).toBeVisible();
    const persistedWidth = (await getRect(workbenchLocators.sidebar(page))).width;
    expect(Math.abs(persistedWidth - resizedWidth)).toBeLessThanOrEqual(12);
  });

  test('T1-F2-05: Plugin contribution with location: "sidebar" renders in Activity Bar & Primary Sidebar (not Bottom Panel)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f2-05');

    await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      ide.registerPlugin({
        id: 'test.customSidebarPlugin',
        name: 'Custom Sidebar Plugin',
        version: '1.0.0',
        contributes: {
          panels: [
            {
              id: 'custom-sb-panel',
              title: 'Custom SB',
              location: 'sidebar',
              render(container: HTMLElement) {
                container.innerHTML = '<div data-testid="custom-sb-mounted">Sidebar Plugin Content</div>';
              }
            }
          ]
        }
      });
    });

    // Must NOT appear in Bottom Drawer tab bar
    await expect(
      page.locator('#cl-drawer [data-cl-drawertab="custom-sb-panel"]')
    ).toHaveCount(0);

    const activityPluginBtn = page.locator(
      '.codelab-activitybar :is([data-cl-activity="custom-sb-panel"], button[aria-label*="Custom SB" i], button[title*="Custom SB" i])'
    );
    await expect(activityPluginBtn.first()).toBeVisible();
    await activityPluginBtn.first().click();

    await expect(
      workbenchLocators.sidebar(page).locator('[data-testid="custom-sb-mounted"]')
    ).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F3: Dedicated Bottom Panel & Sidebar-Terminal Separation (5 tests: T1-F3-01 .. T1-F3-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F3-01: 5-Region Geometry Invariant: Primary Sidebar spans full body height while Bottom Panel sits strictly right of Sidebar', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f3-01');
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await expect(workbenchLocators.terminalSurface(page)).toBeVisible();

    const { sidebarRect, drawerRect } = await assertSidebarDrawerSeparation(page);
    expect(sidebarRect.bottom).toBeGreaterThan(drawerRect.top + 40);
    expect(drawerRect.left).toBeGreaterThanOrEqual(sidebarRect.right - 1.5);
  });

  test('T1-F3-02: Bottom Panel switches cleanly across Problems, Terminal, Ports, and Output/Observability tabs', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f3-02');

    await workbenchLocators.drawerTab(page, 'problems').click();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));

    await workbenchLocators.drawerTab(page, 'terminal').click();
    await expect(workbenchLocators.terminalSurface(page)).toBeVisible();

    await workbenchLocators.drawerTab(page, 'ports').click();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'ports'));

    const outputOrObs = page
      .locator(
        '#cl-drawer :is([data-cl-drawertab="output"], [data-cl-drawertab="observability"])'
      )
      .first();
    await expect(outputOrObs).toBeVisible();
    await outputOrObs.click();
    await expectDrawerTabActive(outputOrObs);
  });

  test('T1-F3-03: Bottom Panel Maximize (^) and Restore toggle panel height strictly inside .codelab-workbench-main', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f3-03');
    await workbenchLocators.drawerTab(page, 'terminal').click();

    const sidebarBefore = await getRect(workbenchLocators.sidebar(page));
    const drawerBefore = await getRect(workbenchLocators.drawer(page));

    const maxBtn = workbenchLocators.drawerMaximizeBtn(page);
    await expect(maxBtn).toBeVisible();
    await maxBtn.click();

    const drawerMax = await getRect(workbenchLocators.drawer(page));
    const sidebarDuringMax = await getRect(workbenchLocators.sidebar(page));

    expect(drawerMax.height).toBeGreaterThan(drawerBefore.height + 120);
    expect(drawerMax.left).toBeGreaterThanOrEqual(sidebarDuringMax.right - 1.5);
    expect(Math.abs(sidebarDuringMax.height - sidebarBefore.height)).toBeLessThanOrEqual(2);

    // Click again to restore previous panel height
    await maxBtn.click();
    const drawerRestored = await getRect(workbenchLocators.drawer(page));
    expect(Math.abs(drawerRestored.height - drawerBefore.height)).toBeLessThanOrEqual(20);
  });

  test('T1-F3-04: Bottom Panel Close (x) and Mod+J / Ctrl+` collapse and reopen panel', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f3-04');
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await expect(workbenchLocators.terminalSurface(page)).toBeVisible();

    const closeBtn = workbenchLocators.drawerCloseBtn(page);
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect
      .poll(async () => {
        const bodyVisible = await workbenchLocators.drawerBody(page).isVisible();
        if (!bodyVisible) return 0;
        return (await workbenchLocators.drawerBody(page).boundingBox())?.height ?? 0;
      })
      .toBeLessThanOrEqual(2);

    await page.keyboard.press('Control+`');
    await expect(workbenchLocators.terminalSurface(page)).toBeVisible();
  });

  test('T1-F3-05: Dragging #cl-splitter-h resizes Bottom Panel without shrinking Primary Sidebar and persists across reload', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f3-05');
    await workbenchLocators.drawerTab(page, 'problems').click();

    const sidebarBefore = await getRect(workbenchLocators.sidebar(page));
    const drawerBefore = await getRect(workbenchLocators.drawer(page));
    const splitter = await getRect(workbenchLocators.drawerSplitter(page));

    await page.mouse.move(splitter.left + splitter.width / 2, splitter.top + splitter.height / 2);
    await page.mouse.down();
    await page.mouse.move(splitter.left + splitter.width / 2, splitter.top - 80, { steps: 6 });
    await page.mouse.up();

    const sidebarAfter = await getRect(workbenchLocators.sidebar(page));
    const drawerAfter = await getRect(workbenchLocators.drawer(page));

    expect(drawerAfter.height).toBeGreaterThan(drawerBefore.height + 45);
    expect(Math.abs(sidebarAfter.height - sidebarBefore.height)).toBeLessThanOrEqual(2);

    await page.reload();
    await expect(workbenchLocators.drawer(page)).toBeVisible();
    const persistedDrawer = await getRect(workbenchLocators.drawer(page));
    expect(Math.abs(persistedDrawer.height - drawerAfter.height)).toBeLessThanOrEqual(16);
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F4: Folder & File Explorer Sidebar (6 tests: T1-F4-01 .. T1-F4-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F4-01: Inline New File and New Folder creation in Explorer updates tree, opens editor tab, and syncs /workspace/* VFS', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f4-01');

    const newFolderBtn = page
      .locator(
        'aside.codelab-sidebar :is([data-cl-action="new-folder-root"], [data-cl-action="new-folder"], button[title*="New Folder" i])'
      )
      .first();
    await expect(newFolderBtn).toBeVisible();
    await newFolderBtn.click();

    const folderInput = page
      .locator('aside.codelab-sidebar :is(#cl-tree-create-input, .codelab-inline-input)')
      .first();
    await expect(folderInput).toBeVisible();
    await folderInput.fill('utils');
    await folderInput.press('Enter');
    await expect(workbenchLocators.folderItem(page, 'utils')).toBeVisible();

    // Create math.js inside utils
    await workbenchLocators.folderItem(page, 'utils').hover();
    const newFileInFolder = workbenchLocators
      .folderItem(page, 'utils')
      .locator('[data-cl-action="new-file-folder"], button[title*="New File" i]')
      .first();
    const usedFolderAction = await newFileInFolder.isVisible();
    if (usedFolderAction) {
      await newFileInFolder.click();
    } else {
      await page
        .locator(
          'aside.codelab-sidebar :is([data-cl-action="new-file-root"], [data-cl-action="new-file"], button[title*="New File" i])'
        )
        .first()
        .click();
    }

    const fileInput = page
      .locator('aside.codelab-sidebar :is(#cl-tree-create-input, .codelab-inline-input)')
      .first();
    await expect(fileInput).toBeVisible();
    const currentVal = await fileInput.inputValue();
    await fileInput.fill(
      usedFolderAction && !currentVal.startsWith('utils/') ? 'math.js' : 'utils/math.js'
    );
    await fileInput.press('Enter');

    await expect(workbenchLocators.fileItem(page, 'utils/math.js')).toBeVisible();
    await expect(workbenchLocators.fileTab(page, 'utils/math.js')).toBeVisible();

    const lsOut = await runTerminalCommand(page, 'ls utils');
    expect(lsOut).toContain('math.js');
  });

  test('T1-F4-02: Inline Rename (F2 / context menu) renames file and removes old path from shell.vfs', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f4-02');
    await openOrCreateCodeFile(page, 'utils/math.js', 'export const mul = (a, b) => a * b;\n');

    const fileRow = workbenchLocators.fileItem(page, 'utils/math.js');
    await expect(fileRow).toBeVisible();
    await fileRow.click({ button: 'right' });

    const renameItem = page
      .locator('.codelab-context-menu :is([data-cl-ctx="rename"], button:has-text("Rename"), [role="menuitem"]:has-text("Rename"))')
      .first();
    if (await renameItem.isVisible()) {
      await renameItem.click();
    } else {
      await fileRow.focus();
      await page.keyboard.press('F2');
    }

    const renameInput = page
      .locator('aside.codelab-sidebar :is(#cl-tree-rename-input, .codelab-inline-input)')
      .first();
    await expect(renameInput).toBeVisible();
    await renameInput.fill('calc.js');
    await renameInput.press('Enter');

    await expect(workbenchLocators.fileItem(page, 'utils/calc.js')).toBeVisible();
    await expect(workbenchLocators.fileItem(page, 'utils/math.js')).toHaveCount(0);
    await expect(workbenchLocators.fileTab(page, 'utils/calc.js')).toBeVisible();

    const files = await getPublicWorkbenchFiles(page);
    expect(files['utils/calc.js']).toContain('mul');
    expect(files['utils/math.js']).toBeUndefined();

    const lsOut = await runTerminalCommand(page, 'ls utils');
    expect(lsOut).toContain('calc.js');
    expect(lsOut).not.toContain('math.js');
  });

  test('T1-F4-03: Confirmed Delete removes file from Explorer, closes its tab, and deletes /workspace/<file> from VFS', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f4-03');
    await openOrCreateCodeFile(page, 'utils/temp-delete.js', 'console.log("bye");\n');

    const fileRow = workbenchLocators.fileItem(page, 'utils/temp-delete.js');
    await fileRow.click({ button: 'right' });
    const deleteMenuBtn = page
      .locator(
        '.codelab-context-menu :is([data-cl-ctx="delete"], [data-ctx-action="delete-file"], button:has-text("Delete"), [role="menuitem"]:has-text("Delete"))'
      )
      .first();
    await expect(deleteMenuBtn).toBeVisible();

    await withAutoAcceptDialog(page, async () => {
      await deleteMenuBtn.click();

      // Accept custom confirmation modal if workbench uses DOM modal instead of window.confirm
      const confirmBtn = page
        .locator(
          ':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:is(:has-text("Delete"), :has-text("Confirm"), [data-cl-action*="confirm-delete"])'
        )
        .first();
      const deadline = Date.now() + 250;
      while (Date.now() < deadline) {
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          break;
        }
        const filesNow = await getPublicWorkbenchFiles(page);
        if (!Object.prototype.hasOwnProperty.call(filesNow, 'utils/temp-delete.js')) {
          break;
        }
        await page.waitForTimeout(25);
      }
    });

    await expect(workbenchLocators.fileItem(page, 'utils/temp-delete.js')).toHaveCount(0);
    await expect(workbenchLocators.fileTab(page, 'utils/temp-delete.js')).toHaveCount(0);

    const lsOut = await runTerminalCommand(page, 'ls utils 2>&1 || true');
    expect(lsOut).not.toContain('temp-delete.js');
  });

  test('T1-F4-04: Drag-and-drop file into subfolder and back to workspace root syncs Explorer, tabs, and VFS', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f4-04');
    await expect(workbenchLocators.fileItem(page, 'index.js')).toBeVisible();
    await expect(workbenchLocators.folderItem(page, 'src')).toBeVisible();

    await workbenchLocators
      .fileItem(page, 'index.js')
      .dragTo(workbenchLocators.folderItem(page, 'src'));

    await expect(workbenchLocators.fileItem(page, 'src/index.js')).toBeVisible();
    const filesMoved = await getPublicWorkbenchFiles(page);
    expect(filesMoved['src/index.js']).toBeDefined();
    expect(filesMoved['index.js']).toBeUndefined();

    const rootList = workbenchLocators.explorerList(page);
    await workbenchLocators
      .fileItem(page, 'src/index.js')
      .dragTo(rootList, { targetPosition: { x: 20, y: 260 } });

    await expect(workbenchLocators.fileItem(page, 'index.js')).toBeVisible();
    const filesRestored = await getPublicWorkbenchFiles(page);
    expect(filesRestored['index.js']).toBeDefined();
  });

  test('T1-F4-05: Explorer Collapse All button collapses all expanded nested directories', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f4-05');
    await openOrCreateCodeFile(
      page,
      'src/components/Button.js',
      'export const Button = () => "<button/> ";\n'
    );
    await expect(workbenchLocators.fileItem(page, 'src/components/Button.js')).toBeVisible();

    const collapseAllBtn = page
      .locator(
        'aside.codelab-sidebar :is([data-cl-action="collapse-all-folders"], [data-cl-action="collapse-all"], button[title*="Collapse" i], button[aria-label*="Collapse" i])'
      )
      .first();
    await expect(collapseAllBtn).toBeVisible();
    await collapseAllBtn.click();

    await expect(workbenchLocators.fileItem(page, 'src/components/Button.js')).toBeHidden();
    await expect(workbenchLocators.folderItem(page, 'src')).toBeVisible();
  });

  test('T1-F4-06: files.exclude configuration dynamically hides matching files/folders in #cl-explorer-list', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f4-06');
    await openOrCreateCodeFile(page, 'build-cache/out.js', '// generated\n');
    await openOrCreateCodeFile(page, 'keep-visible.js', '// visible\n');

    await expect(workbenchLocators.fileItem(page, 'keep-visible.js')).toBeVisible();
    await expect(
      page.locator(
        'aside.codelab-sidebar :is([data-cl-folder="build-cache"], [data-cl-file="build-cache/out.js"])'
      ).first()
    ).toBeVisible();

    await page.evaluate(async () => {
      const ide = (window as any).__codelabIde;
      if (ide.configuration && typeof ide.configuration.setWorkspaceSetting === 'function') {
        await ide.configuration.setWorkspaceSetting('files.exclude', ['**/build-cache/**']);
      } else {
        ide.setFile(
          '.codelab/settings.json',
          JSON.stringify({ 'files.exclude': ['**/build-cache/**'] }, null, 2)
        );
      }
    });

    await expect(workbenchLocators.fileItem(page, 'keep-visible.js')).toBeVisible();
    await expect(workbenchLocators.fileItem(page, 'build-cache/out.js')).toBeHidden();
  });
});
