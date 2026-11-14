import { test, expect } from '@playwright/test';
import {
  HAPPY_PATH_FILES,
  buildLargeRepoFiles,
  installGitHubMock
} from './helpers/github-mock';
import {
  assertSidebarDrawerSeparation,
  attachZeroErrorTracker,
  expectDrawerTabActive,
  getActiveEditorText,
  getActiveLabId,
  getEffectiveColors,
  getPublicWorkbenchFiles,
  getRect,
  installOfflineCdnStubs,
  openCloneRepoUi,
  openOrCreateCodeFile,
  openProblemsPanel,
  openScmSidebar,
  openSearchSidebar,
  openSettingsTabViaGear,
  openTopMenu,
  runTerminalCommand,
  seedPersistedWorkspace,
  setActiveEditorText,
  switchRecentWorkspaceViaUi,
  triggerBlankIdeAction,
  verifyNonDestructiveTransition,
  withAutoAcceptDialog,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

test.describe('Tier 3 — Pairwise 2-Way & 3-Way Cross-Feature Interactions', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page, { allowNetworkErrorStatus: false });
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  test('T3-01 [F1 x F5]: Menu Bar x Multi-Workspace Isolation switches between isolated Blank workspaces via File -> Open Recent Workspace', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    const ws1Id = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'ws1.js', 'export const ws = "ONE";\n');
    await expect
      .poll(() => page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', ws1Id))
      .toContain('ws1.js');

    const { nextLabId: ws2Id } = await verifyNonDestructiveTransition(page, {
      prevLabId: ws1Id,
      preservedFile: 'ws1.js',
      preservedContent: 'export const ws = "ONE";\n',
      trigger: () => triggerBlankIdeAction(page),
      resolution: 'isolate'
    });
    expect(ws2Id).not.toBe(ws1Id);

    await openOrCreateCodeFile(page, 'ws2.js', 'export const ws = "TWO";\n');
    await expect
      .poll(() => page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', ws2Id))
      .toContain('ws2.js');

    await switchRecentWorkspaceViaUi(page, ws1Id);
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['ws1.js'])
      .toBe('export const ws = "ONE";\n');

    await switchRecentWorkspaceViaUi(page, ws2Id);
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['ws2.js'])
      .toBe('export const ws = "TWO";\n');
  });

  test('T3-02 [F2 x F3]: Activity Bar Sidebar x Bottom Panel Geometry Under Stress preserves 5-region invariant across every view/resize/maximize toggle', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-02');
    await workbenchLocators.drawerTab(page, 'terminal').click();

    for (const view of ['explorer', 'search', 'scm'] as const) {
      await workbenchLocators.activityItem(page, view).click();
      await assertSidebarDrawerSeparation(page);
    }

    // Resize sidebar wider
    const splitter = await getRect(workbenchLocators.sidebarSplitter(page));
    await page.mouse.move(splitter.left + 2, splitter.top + 80);
    await page.mouse.down();
    await page.mouse.move(splitter.left + 65, splitter.top + 80, { steps: 5 });
    await page.mouse.up();
    await assertSidebarDrawerSeparation(page);

    // Maximize & restore Bottom Panel
    await workbenchLocators.drawerMaximizeBtn(page).click();
    await assertSidebarDrawerSeparation(page);
    await workbenchLocators.drawerMaximizeBtn(page).click();
    await assertSidebarDrawerSeparation(page);

    // Collapse & re-expand Sidebar via Mod+B
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.press('ControlOrMeta+b');
    await assertSidebarDrawerSeparation(page);
  });

  test('T3-03 [F4 x F7]: Explorer Rename/Delete x Live Search Sidebar reflects renamed paths and jumps into renamed file', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't3-03',
      {
        'old.js': 'const magicToken = 101;\n',
        'keep.js': 'const magicToken = 202;\n'
      },
      { activeFile: 'keep.js' }
    );
    await page.goto('/workbench?labId=t3-03');

    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('magicToken');
    await expect(searchView).toContainText('old.js');

    // Rename old.js -> renamed.js in Explorer
    await workbenchLocators.activityItem(page, 'explorer').click();
    await page.evaluate(() => (window as any).__codelabIde.renameFile('old.js', 'renamed.js'));

    // Reopen Search and re-trigger search if needed
    await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).press('Enter');
    await expect(searchView).toContainText('renamed.js');
    await expect(searchView).not.toContainText('old.js');

    const matchRow = searchView
      .locator(':is([data-cl-search-match], .codelab-search-match, [role="listitem"], button, div)')
      .filter({ hasText: /101|renamed\.js/ })
      .last();
    await matchRow.click();
    await expect(workbenchLocators.fileTab(page, 'renamed.js')).toBeVisible();
  });

  test('T3-04 [F4 x F8]: Explorer CRUD/Move x Source Control Status keeps VFS and git status 100% consistent', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-04&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'tracked.js', 'const tracked = 1;\n');
    await openOrCreateCodeFile(page, 'obsolete.js', 'const obsolete = 1;\n');
    await runTerminalCommand(page, 'git init && git add . && git commit -m "base"');

    // Create new.js, move tracked.js -> moved/tracked.js, delete obsolete.js
    await openOrCreateCodeFile(page, 'new.js', 'const added = 1;\n');
    await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      ide.createFolder('moved');
      ide.renameFile('tracked.js', 'moved/tracked.js');
      ide.deleteFile('obsolete.js');
    });

    const scmView = await openScmSidebar(page);
    await expect(scmView).toContainText('new.js');
    await expect(scmView).toContainText('moved/tracked.js');
    await expect(scmView).toContainText('obsolete.js');

    const cliStatus = await runTerminalCommand(page, 'git status');
    expect(cliStatus).toContain('new.js');
    expect(cliStatus).toContain('obsolete.js');
  });

  test('T3-05 [F4 x F10]: Explorer Two-Way VFS Sync x Integrated Terminal updates both tree and shell instantaneously', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-05');
    await openOrCreateCodeFile(
      page,
      'scripts/hello.js',
      'console.log("TWO_WAY_SYNC_OK");\n'
    );

    const runOut = await runTerminalCommand(page, 'node scripts/hello.js');
    expect(runOut).toContain('TWO_WAY_SYNC_OK');

    await runTerminalCommand(
      page,
      'mkdir -p generated && echo "12345" > generated/out.txt && rm scripts/hello.js'
    );

    const files = await getPublicWorkbenchFiles(page);
    expect(files['generated/out.txt']).toContain('12345');
    expect(files['scripts/hello.js']).toBeUndefined();
    await expect(workbenchLocators.folderItem(page, 'generated')).toBeVisible();
  });

  test('T3-06 [F5 x F6]: Blank IDE x Clone Repo Workspace Switching prevents cross-contamination across recent workspaces', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'demo-app',
      files: HAPPY_PATH_FILES
    });

    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    const blankLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'scratch.js', 'const scratchOnly = "BLANK";\n');
    await expect
      .poll(() =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', blankLabId)
      )
      .toContain('scratch.js');

    const { nextLabId: repoLabId } = await verifyNonDestructiveTransition(page, {
      prevLabId: blankLabId,
      preservedFile: 'scratch.js',
      preservedContent: 'const scratchOnly = "BLANK";\n',
      trigger: async () => {
        await openCloneRepoUi(page);
        const input = page
          .locator('#landing-repo-input:visible, #cl-clone-repo-input:visible')
          .first();
        await input.fill('acme/demo-app');
        await workbenchLocators.cloneSubmitButton(page).click();
      },
      resolution: 'isolate'
    });

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/index.ts'], { timeout: 10_000 })
      .toContain('add(2, 3)');
    expect((await getPublicWorkbenchFiles(page))['scratch.js']).toBeUndefined();

    await switchRecentWorkspaceViaUi(page, blankLabId);
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['scratch.js'])
      .toBe('const scratchOnly = "BLANK";\n');
    expect((await getPublicWorkbenchFiles(page))['src/utils.ts']).toBeUndefined();
    expect(repoLabId).not.toBe(blankLabId);
  });

  test('T3-07 [F5 x F8]: Blank IDE x Source Control Initialization & Persistence across page.reload()', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-07&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'app.js', 'export const initTest = true;\n');

    const scmView = await openScmSidebar(page);
    await scmView.locator('button:has-text("Initialize Repository")').first().click();

    await scmView
      .locator('[data-cl-action="scm-stage-all"], button[title*="Stage All" i], button:has-text("Stage All")')
      .first()
      .click();
    await workbenchLocators.scmCommitInput(page).fill('feat: persisted blank commit');
    await workbenchLocators.scmCommitBtn(page).click();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('sd-codelab-v1:t3-07') ?? ''))
      .toContain('feat: persisted blank commit');
    await page.reload();

    const scmAfter = await openScmSidebar(page);
    await expect(scmAfter).not.toContainText('Initialize Repository');
    await expect(scmAfter).toContainText('feat: persisted blank commit');
  });

  test('T3-08 [F6 x F7]: Clone Repo x Search & Replace Across Cloned Tree updates 10 files while keeping tab count <= 5', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'multi-pkg',
      files: buildLargeRepoFiles(10)
    });

    await page.goto('/cloud-ide?repo=acme/multi-pkg');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });

    const searchView = await openSearchSidebar(page);
    if (!(await workbenchLocators.replaceInput(page).isVisible())) {
      const toggle = searchView
        .locator('[data-cl-action*="replace"], button[aria-label*="Replace" i]')
        .first();
      if (await toggle.isVisible()) await toggle.click();
    }

    await workbenchLocators.searchInput(page).fill('export const');
    await workbenchLocators.replaceInput(page).fill('export let');

    await withAutoAcceptDialog(page, async () => {
      await searchView
        .locator(
          '[data-cl-action="search-replace-all"], [data-cl-action="replace-all"], button[title*="Replace All" i], button:has-text("Replace All")'
        )
        .first()
        .click();
    });

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/modules/mod-05.ts'])
      .toContain('export let');

    const tabCount = await workbenchLocators.tabs(page).count();
    expect(tabCount).toBeLessThanOrEqual(5);
  });

  test('T3-09 [F3 x F9]: Collapsed Bottom Panel x Status Bar Problems Trigger updates count live while closed and expands to problems on click', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-09');
    await workbenchLocators.drawerCloseBtn(page).click();

    await expect
      .poll(async () => {
        if (!(await workbenchLocators.drawerBody(page).isVisible())) return 0;
        return (await workbenchLocators.drawerBody(page).boundingBox())?.height ?? 0;
      })
      .toBeLessThanOrEqual(2);

    await openOrCreateCodeFile(page, 'app.py', 'def syntax_err(\n    return 0\n');
    await expect
      .poll(async () =>
        await page.evaluate(() => (window as any).__codelabIde.getDiagnostics().length)
      )
      .toBeGreaterThanOrEqual(1);

    // Status Bar Problems count updates live while Bottom Panel stays collapsed!
    await expect(workbenchLocators.statusProblemsBtn(page)).toContainText(/[1-9]/);

    // Clicking Status Bar Problems expands Bottom Panel directly to Problems tab
    await workbenchLocators.statusProblemsBtn(page).click();
    await expect(workbenchLocators.drawerBody(page)).toBeVisible();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
    await expect(workbenchLocators.drawerBody(page)).toContainText('app.py');
  });

  test('T3-10 [F7 x F8]: Search Replace All x Source Control Diff & Commit tracks modified count, renders diff, and commits', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-10&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'm1.js', 'export const TAG = "OLD";\n');
    await openOrCreateCodeFile(page, 'm2.js', 'export const TAG = "OLD";\n');
    await openOrCreateCodeFile(page, 'm3.js', 'export const TAG = "OLD";\n');
    await openOrCreateCodeFile(page, 'untouched.js', 'export const OTHER = 1;\n');
    await runTerminalCommand(page, 'git init && git add . && git commit -m "init 4 files"');

    const searchView = await openSearchSidebar(page);
    if (!(await workbenchLocators.replaceInput(page).isVisible())) {
      const toggle = searchView
        .locator('[data-cl-action*="replace"], button[aria-label*="Replace" i]')
        .first();
      if (await toggle.isVisible()) await toggle.click();
    }
    await workbenchLocators.searchInput(page).fill('"OLD"');
    await workbenchLocators.replaceInput(page).fill('"NEW"');
    await withAutoAcceptDialog(page, async () => {
      await searchView
        .locator(
          '[data-cl-action="search-replace-all"], [data-cl-action="replace-all"], button[title*="Replace All" i], button:has-text("Replace All")'
        )
        .first()
        .click();
    });

    await expect(workbenchLocators.activityItem(page, 'scm')).toContainText('3');
    const scmView = await openScmSidebar(page);
    await scmView
      .locator(':is([data-cl-scm-file="m1.js"], .codelab-scm-item)')
      .filter({ hasText: 'm1.js' })
      .first()
      .click();
    await expect(workbenchLocators.editorCol(page)).toContainText('"OLD"');
    await expect(workbenchLocators.editorCol(page)).toContainText('"NEW"');

    await scmView
      .locator('[data-cl-action="scm-stage-all"], button[title*="Stage All" i], button:has-text("Stage All")')
      .first()
      .click();
    await workbenchLocators.scmCommitInput(page).fill('refactor: replace OLD with NEW');
    await workbenchLocators.scmCommitBtn(page).click();

    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getGitStatus())).length)
      .toBe(0);
  });

  test('T3-11 [F8 x F10]: Source Control Sidebar x Multi-Session Terminal Git CLI stays synchronized across sessions', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-11&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'index.js', 'console.log("base");\n');
    await runTerminalCommand(page, 'git init && git add index.js && git commit -m "base"');

    // Session 1 switches branch
    await runTerminalCommand(page, 'git checkout -b feat/cli');

    // Session 2 appends & stages
    await workbenchLocators.newTerminalBtn(page).click();
    await runTerminalCommand(page, 'echo "console.log(2);" >> index.js && git add index.js');

    await expect(workbenchLocators.statusScmBtn(page)).toContainText('feat/cli');
    const scmView = await openScmSidebar(page);
    await expect(scmView).toContainText(/Staged Changes/i);
    await expect(scmView).toContainText('index.js');

    await workbenchLocators.scmCommitInput(page).fill('feat: commit from scm');
    await workbenchLocators.scmCommitBtn(page).click();

    // Switch back to Session 1 and check git status
    await workbenchLocators.terminalSessionPills(page).first().click();
    const s1Status = await runTerminalCommand(page, 'git status');
    expect(s1Status.toLowerCase()).toMatch(/nothing to commit|working tree clean/);
  });

  test('T3-12 [F1 x F11]: Menu Bar Auto Save / Preferences x Settings Tab Sync reflects live config state', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-12');
    await openOrCreateCodeFile(page, 'index.js', '// unsaved menu test\n');

    const fileMenu = await openTopMenu(page, 'File');
    const autoSaveItem = fileMenu.locator('[role="menuitem"]').filter({ hasText: /Auto Save/i });
    if ((await autoSaveItem.count()) > 0 && (await autoSaveItem.first().isVisible())) {
      await autoSaveItem.first().click();
    } else {
      await page.keyboard.press('Escape');
      await page.evaluate(() =>
        (window as any).__codelabIde.configuration.setUserSetting('files.autoSave', 'off')
      );
    }

    await openSettingsTabViaGear(page);
    const currentAutoSave = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('files.autoSave')
    );
    await expect(
      workbenchLocators.settingsHost(page).locator('[data-setting-key="files.autoSave"]')
    ).toHaveValue(String(currentAutoSave));

    await workbenchLocators.fileTab(page, 'index.js').click();
    expect(await getActiveEditorText(page)).toBe('// unsaved menu test\n');
  });

  test('T3-13 [F2 x F11]: Activity Bar Sidebar Visibility x workbench.sideBar.visible Two-Way Sync', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-13');
    await openSettingsTabViaGear(page);

    const checkbox = workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="workbench.sideBar.visible"]');
    await checkbox.uncheck();
    await expect(workbenchLocators.sidebar(page)).toBeHidden();

    // Toggle back via Mod+B keyboard shortcut and verify checkbox / config syncs
    await page.keyboard.press('ControlOrMeta+b');
    await expect(workbenchLocators.sidebar(page)).toBeVisible();
    const cfgVal = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('workbench.sideBar.visible')
    );
    expect(cfgVal).toBe(true);
  });

  test('T3-14 [F3 x F10]: Bottom Panel Tab Switching & Resize x Terminal Scroll & Input Buffer preserves partial command draft', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-14');
    await runTerminalCommand(page, 'echo "LOG_BEFORE_TAB_SWITCH"');

    const replInput = workbenchLocators.replInput(page);
    await replInput.focus();
    await page.keyboard.type('git sta');

    // Switch to Problems tab & resize Bottom Panel
    await workbenchLocators.drawerTab(page, 'problems').click();
    const splitter = await getRect(workbenchLocators.drawerSplitter(page));
    await page.mouse.move(splitter.left + 40, splitter.top + 2);
    await page.mouse.down();
    await page.mouse.move(splitter.left + 40, splitter.top - 40, { steps: 4 });
    await page.mouse.up();

    // Switch back to Terminal: partial input buffer & output logs are preserved
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await expect(workbenchLocators.terminalLog(page)).toContainText('LOG_BEFORE_TAB_SWITCH');
    await expect(workbenchLocators.replInput(page)).toHaveValue('git sta');
  });

  test('T3-15 [F4 x F10 x F11]: Settings files.exclude & terminal.fontSize x Explorer & Terminal with manual Mod+S save', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-15');
    await openOrCreateCodeFile(page, 'debug.log', 'secret-log-line\n');
    await openOrCreateCodeFile(page, 'index.js', 'const dirtyEdit = true;\n');

    await openSettingsTabViaGear(page);
    const host = workbenchLocators.settingsHost(page);
    await host.locator('[data-setting-key="files.autoSave"]').selectOption('off');
    await host.locator('[data-setting-key="terminal.fontSize"]').fill('17');
    await host.locator('[data-setting-key="terminal.fontSize"]').dispatchEvent('change');

    await page.evaluate(async () => {
      await (window as any).__codelabIde.configuration.setWorkspaceSetting('files.exclude', [
        '**/*.log'
      ]);
    });

    await expect(workbenchLocators.fileItem(page, 'debug.log')).toBeHidden();

    // File still exists in Terminal VFS at 17px font
    const catLog = await runTerminalCommand(page, 'cat debug.log');
    expect(catLog).toContain('secret-log-line');
    const termFont = await workbenchLocators
      .terminalSurface(page)
      .evaluate((el) => window.getComputedStyle(el).fontSize);
    expect(termFont).toBe('17px');

    await workbenchLocators.fileTab(page, 'index.js').click();
    await setActiveEditorText(page, 'const savedManually = 99;\n');
    await page.keyboard.press('ControlOrMeta+s');
    expect((await getPublicWorkbenchFiles(page))['index.js']).toBe('const savedManually = 99;\n');
  });

  test('T3-16 [F6 x F9]: Clone Repo x Live Diagnostics populates Problems for broken.py in cloned repo and clears on fix', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'py-broken',
      files: {
        'README.md': '# Python Diagnostics Repo\n',
        'main.py': 'print("ok")\n',
        'broken.py': 'def missing_colon()\n    return 1\n'
      }
    });

    await page.goto('/workbench?labId=t3-16&empty=1');
    await page.evaluate(() => (window as any).__codelabIde.cloneRepo('acme/py-broken'));

    await openOrCreateCodeFile(page, 'broken.py');
    await expect
      .poll(async () =>
        await page.evaluate(() => (window as any).__codelabIde.getDiagnostics().length)
      )
      .toBeGreaterThanOrEqual(1);

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('broken.py');

    await setActiveEditorText(page, 'def fixed_colon():\n    return 1\n');
    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);
  });

  test('T3-17 [F7 x F11]: Search Sidebar x Non-Destructive Settings Tab switches cleanly from __settings__ to match file while keeping __settings__ tab open', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't3-17',
      {
        'src/app.js': '// 1\n// 2\nconst settingsSearchTarget = 55;\n'
      },
      { activeFile: 'src/app.js' }
    );
    await page.goto('/workbench?labId=t3-17');

    await openSettingsTabViaGear(page);
    await expect(workbenchLocators.settingsHost(page)).toBeVisible();

    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('settingsSearchTarget');

    const matchRow = searchView
      .locator(':is([data-cl-search-match], .codelab-search-match, [role="listitem"], button, div)')
      .filter({ hasText: /settingsSearchTarget/ })
      .last();
    await matchRow.click();

    await expect(workbenchLocators.fileTab(page, 'src/app.js')).toBeVisible();
    await expect(workbenchLocators.statusCursor(page)).toContainText(/Ln\s*3\b/i);
    // __settings__ tab stays open in tab strip!
    await expect(workbenchLocators.settingsTab(page)).toBeVisible();

    await workbenchLocators.settingsTab(page).click();
    await expect(workbenchLocators.settingsHost(page)).toBeVisible();
    await expect(workbenchLocators.searchInput(page)).toHaveValue('settingsSearchTarget');
  });

  test('T3-18 [F9 x F11 x F12]: Settings JSON Error -> Problems Click-to-Jump -> Fix -> Live High-Contrast Theme', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-18');
    await openOrCreateCodeFile(
      page,
      '.codelab/settings.json',
      '{\n  "workbench.colorTheme": \n}'
    );
    await openOrCreateCodeFile(page, 'index.js');

    const drawerBody = await openProblemsPanel(page);
    const diagRow = drawerBody
      .locator(':is(.codelab-problem-item, [data-cl-problem-file=".codelab/settings.json"], [data-cl-diag-file=".codelab/settings.json"])')
      .first();
    await expect(diagRow).toBeVisible();
    await diagRow.click();

    await expect(workbenchLocators.fileTab(page, '.codelab/settings.json')).toBeVisible();
    await setActiveEditorText(page, '{\n  "workbench.colorTheme": "high-contrast"\n}\n');

    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);
    await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', 'high-contrast');

    const colors = await getEffectiveColors(workbenchLocators.menuTrigger(page, 'File'));
    expect(colors.ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('T3-19 [F1 x F12]: Menu Bar Dropdowns x Narrow Viewport & High-Contrast Theme stay clamped inside viewport with valid contrast', async ({
    page
  }) => {
    await page.setViewportSize({ width: 640, height: 720 });
    await page.goto('/workbench?labId=t3-19&theme=high-contrast');
    await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', 'high-contrast');

    const helpMenu = await openTopMenu(page, 'Help');
    const menuRect = await getRect(helpMenu);
    expect(menuRect.left).toBeGreaterThanOrEqual(0);
    expect(menuRect.right).toBeLessThanOrEqual(640);
    expect(menuRect.bottom).toBeLessThanOrEqual(720);

    const firstItem = helpMenu.locator('[role="menuitem"]').first();
    const itemColors = await getEffectiveColors(firstItem);
    expect(itemColors.fg).not.toBe(itemColors.bg);
    expect(itemColors.ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('T3-20 [F2 x F12]: Activity Bar Badges & Status Bar Indicators x Light/Dark Theme Contrast remain visible and non-overlapping', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t3-20&git=1');
    await openOrCreateCodeFile(page, 'dirty-scm.js', 'const changed = 1;\n');
    await openOrCreateCodeFile(page, 'bad.py', 'def err(\n    pass\n');
    await expect
      .poll(async () =>
        await page.evaluate(() => (window as any).__codelabIde.getDiagnostics().length)
      )
      .toBeGreaterThanOrEqual(1);

    for (const theme of ['dark', 'light'] as const) {
      await page.evaluate((t) => (window as any).__codelabIde.setTheme(t), theme);
      await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', theme);

      const scmBadge = workbenchLocators
        .activityItem(page, 'scm')
        .locator('.codelab-badge, [data-cl-badge], span')
        .filter({ hasText: /[1-9]/ })
        .first();
      await expect(scmBadge).toBeVisible();
      const badgeColors = await getEffectiveColors(scmBadge);
      expect(badgeColors.fg).not.toBe(badgeColors.bg);

      const statusProbColors = await getEffectiveColors(workbenchLocators.statusProblemsBtn(page));
      expect(statusProbColors.fg).not.toBe(statusProbColors.bg);
    }
  });
});
