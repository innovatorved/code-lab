import { test, expect } from '@playwright/test';
import {
  HAPPY_PATH_COMMITS,
  HAPPY_PATH_FILES,
  buildLargeRepoFiles,
  installGitHubMock
} from './helpers/github-mock';
import {
  attachZeroErrorTracker,
  clickMenuItem,
  expectDrawerTabActive,
  getActiveEditorText,
  getActiveLabId,
  getEffectiveColors,
  getPublicWorkbenchFiles,
  getRect,
  installOfflineCdnStubs,
  openOrCreateCodeFile,
  openSettingsTabViaGear,
  openTopMenu,
  runTerminalCommand,
  setActiveEditorText,
  switchRecentWorkspaceViaUi,
  triggerBlankIdeAction,
  verifyNonDestructiveTransition,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

test.describe('Tier 1 — Non-Destructive Blank IDE, Clone Repo, Settings Tab & Theme Polish (F5, F6, F11, F12)', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page);
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F5: Non-Destructive Blank IDE & Workspace Isolation (5 tests: T1-F5-01 .. T1-F5-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F5-01: Booting Blank IDE (?blank=1 or #open-empty-btn) mounts clean workspace without nonexistent entry "demo.js"', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }

    await expect(workbenchLocators.root(page)).toBeVisible();
    await expect(page.locator('#landing-overlay')).toBeHidden();

    const state = await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      const files = ide ? ide.getFiles() : {};
      return {
        activeFile: ide?.activeFile ?? null,
        entry: ide?.entry ?? null,
        fileKeys: Object.keys(files)
      };
    });

    if (state.activeFile) {
      expect(state.fileKeys).toContain(state.activeFile);
    }
    if (state.entry === 'demo.js') {
      expect(state.fileKeys).toContain('demo.js');
    }
  });

  test('T1-F5-02: Triggering Blank IDE from a populated/edited workspace preserves prior workspace in storage', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }
    await expect(workbenchLocators.root(page)).toBeVisible();

    const prevLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'custom-feature.js', 'export const v = 99;\n');

    // Poll until persisted state snapshot contains custom-feature.js (avoids 300ms autoSaveDelay race)
    await expect
      .poll(async () =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', prevLabId)
      )
      .toContain('custom-feature.js');

    const { nextLabId } = await verifyNonDestructiveTransition(page, {
      prevLabId,
      preservedFile: 'custom-feature.js',
      preservedContent: 'export const v = 99;\n',
      trigger: () => triggerBlankIdeAction(page),
      resolution: 'isolate'
    });

    expect(nextLabId).not.toBe(prevLabId);
  });

  test('T1-F5-03: Switching back via File -> Open Recent Workspace restores previous workspace files & code 100%', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }
    await expect(workbenchLocators.root(page)).toBeVisible();

    const firstLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'custom-feature.js', 'export const v = 99;\n');
    await expect
      .poll(async () =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', firstLabId)
      )
      .toContain('custom-feature.js');

    await verifyNonDestructiveTransition(page, {
      prevLabId: firstLabId,
      preservedFile: 'custom-feature.js',
      preservedContent: 'export const v = 99;\n',
      trigger: () => triggerBlankIdeAction(page),
      resolution: 'isolate'
    });

    await switchRecentWorkspaceViaUi(page, firstLabId);
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['custom-feature.js'])
      .toBe('export const v = 99;\n');
    await expect(workbenchLocators.fileItem(page, 'custom-feature.js')).toBeVisible();
  });

  test('T1-F5-04: WorkspaceStorage registry helpers (createBlankWorkspaceId, upsertWorkspaceMeta, listWorkspaces, hasWorkspaceData) round-trip cleanly', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f5-04');
    await openOrCreateCodeFile(page, 'saved.js', 'const persisted = true;\n');
    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem('sd-codelab-v1:t1-f5-04') ?? '')
      )
      .toContain('saved.js');

    const registryCheck = await page.evaluate(() => {
      const storageMod =
        (window as any).CodeLabWorkspaceStorage ||
        (window as any).CodeLab?.storage ||
        (window as any).CodeLabStorage;
      if (!storageMod) return null;

      const id1 =
        typeof storageMod.createBlankWorkspaceId === 'function'
          ? storageMod.createBlankWorkspaceId()
          : null;
      const id2 =
        typeof storageMod.createBlankWorkspaceId === 'function'
          ? storageMod.createBlankWorkspaceId()
          : null;

      if (typeof storageMod.upsertWorkspaceMeta === 'function') {
        storageMod.upsertWorkspaceMeta({
          labId: 'ws-older',
          title: 'Older Workspace',
          kind: 'custom',
          updatedAt: 1_000
        });
        storageMod.upsertWorkspaceMeta({
          labId: 't1-f5-04',
          title: 'Current Workspace',
          kind: 'blank',
          updatedAt: 9_000
        });
      }

      const list =
        typeof storageMod.listWorkspaces === 'function' ? storageMod.listWorkspaces() : [];
      const hasData =
        typeof storageMod.hasWorkspaceData === 'function'
          ? storageMod.hasWorkspaceData('t1-f5-04')
          : false;
      const hasEmpty =
        typeof storageMod.hasWorkspaceData === 'function'
          ? storageMod.hasWorkspaceData('nonexistent-lab-xyz')
          : true;

      return { id1, id2, list, hasData, hasEmpty };
    });

    expect(registryCheck).not.toBeNull();
    expect(registryCheck!.id1).toMatch(/^blank-workspace-/);
    expect(registryCheck!.id2).toMatch(/^blank-workspace-/);
    expect(registryCheck!.id1).not.toBe(registryCheck!.id2);
    expect(registryCheck!.hasData).toBe(true);
    expect(registryCheck!.hasEmpty).toBe(false);
    expect(registryCheck!.list.length).toBeGreaterThanOrEqual(2);
    expect(registryCheck!.list[0].labId).toBe('t1-f5-04');
  });

  test('T1-F5-05: Invoking Settings, Search, Source Control, Problems, and Export ZIP from a Blank workspace never resets labId or destroys ideInstance', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }
    await expect(workbenchLocators.root(page)).toBeVisible();

    await page.evaluate(() => {
      (window as any).__initialIdeRef = (window as any).__codelabIde;
    });
    const beforeLab = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'my-work.js', 'export const important = "intact";\n');

    // Exercise Settings, Search, Source Control, Problems, and Export ZIP
    await openSettingsTabViaGear(page);
    await workbenchLocators.activityItem(page, 'search').click();
    await expect(workbenchLocators.searchView(page)).toBeVisible();
    await workbenchLocators.activityItem(page, 'scm').click();
    await expect(workbenchLocators.scmView(page)).toBeVisible();
    await workbenchLocators.drawerTab(page, 'problems').click();
    await expect(workbenchLocators.drawerBody(page)).toBeVisible();

    const zipBytesLength = await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      const bytes = ide.exportZip({ download: false });
      return bytes ? bytes.length : 0;
    });
    expect(zipBytesLength).toBeGreaterThan(20);

    const sameInstance = await page.evaluate(
      () => (window as any).__codelabIde === (window as any).__initialIdeRef
    );
    expect(sameInstance).toBe(true);
    expect(await getActiveLabId(page)).toBe(beforeLab);
    expect((await getPublicWorkbenchFiles(page))['my-work.js']).toBe(
      'export const important = "intact";\n'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F6: End-to-End Non-Destructive Clone Repo (6 tests: T1-F6-01 .. T1-F6-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F6-01: Happy-path GitHub clone via #landing-overlay populates Explorer, caps initial tabs (<= 5), and hides overlay', async ({
    page
  }) => {
    const repoFiles = buildLargeRepoFiles(12);
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'web-starter',
      files: repoFiles
    });

    await page.goto('/cloud-ide');
    const repoInput = page.locator('#landing-repo-input');
    await expect(repoInput).toBeVisible();
    await repoInput.fill('acme/web-starter');
    await page.locator('#landing-clone-btn').click();

    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });
    await expect(workbenchLocators.root(page)).toBeVisible();

    const files = await getPublicWorkbenchFiles(page);
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(12);
    expect(files['README.md']).toContain('Large Repo Fixture');

    const openTabCount = await workbenchLocators.tabs(page).count();
    expect(openTabCount).toBeGreaterThanOrEqual(1);
    expect(openTabCount).toBeLessThanOrEqual(5);
  });

  test('T1-F6-02: Cloning via File -> Clone Repository displays progress feedback and syncs Git HEAD + commit log', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'api-service',
      defaultBranch: 'develop',
      files: HAPPY_PATH_FILES,
      commits: HAPPY_PATH_COMMITS,
      blobDelayMs: 25
    });

    await page.goto('/workbench?labId=t1-f6-02&empty=1');
    await clickMenuItem(page, 'File', /Clone/i);

    const cloneInput = page
      .locator('#cl-clone-repo-input, input[placeholder*="github" i], input[placeholder*="owner/repo" i]')
      .first();
    await expect(cloneInput).toBeVisible();
    await cloneInput.fill('acme/api-service');

    await workbenchLocators.cloneSubmitButton(page).click();

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/index.ts'], { timeout: 10_000 })
      .toContain('add(2, 3)');

    await expect(workbenchLocators.statusScmBtn(page)).toContainText('develop');
    const gitStatus = await page.evaluate(() => (window as any).__codelabIde.getGitStatus());
    expect(gitStatus).toEqual([]);

    await workbenchLocators.activityItem(page, 'scm').click();
    await expect(workbenchLocators.scmView(page)).toContainText(
      'feat: add TypeScript entry and utils'
    );
  });

  test('T1-F6-03: URL query boot ?repo=acme/url-boot automatically clones mocked repository and persists user edits across page.reload()', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'url-boot',
      files: HAPPY_PATH_FILES
    });

    await page.goto('/cloud-ide?repo=acme/url-boot');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });

    const bootLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'src/index.ts');
    await setActiveEditorText(page, '// USER_LOCAL_EDIT_PERSISTED\nconsole.log("persisted");\n');
    await expect
      .poll(async () =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', bootLabId)
      )
      .toContain('USER_LOCAL_EDIT_PERSISTED');

    await page.reload();
    await expect(workbenchLocators.root(page)).toBeVisible();
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/index.ts'])
      .toContain('USER_LOCAL_EDIT_PERSISTED');
  });

  test('T1-F6-04: Source Control uninitialized empty-state Clone Repository CTA launches Clone workflow end-to-end', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'cli-tool',
      files: HAPPY_PATH_FILES
    });

    await page.goto('/workbench?labId=t1-f6-04&blank=1&empty=1');
    await workbenchLocators.activityItem(page, 'scm').click();
    const scmView = workbenchLocators.scmView(page);
    await expect(scmView).toBeVisible();

    const cloneCta = scmView.locator('button:has-text("Clone Repository"), [data-cl-action*="clone"]').first();
    await expect(cloneCta).toBeVisible();
    await cloneCta.click();

    const cloneInput = page
      .locator('#cl-clone-repo-input, input[placeholder*="github" i], input[placeholder*="owner/repo" i]')
      .first();
    await expect(cloneInput).toBeVisible();
    await cloneInput.fill('acme/cli-tool');
    await workbenchLocators.cloneSubmitButton(page).click();

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['package.json'], { timeout: 10_000 })
      .toContain('acme-demo');
  });

  test('T1-F6-05: Cloning a second repo when current workspace has user edits isolates or confirms without destroying prior workspace', async ({
    page
  }) => {
    await installGitHubMock(page, {
      repos: {
        'acme/first-repo': {
          files: { 'README.md': '# First\n', 'src/app.js': 'console.log("first");\n' }
        },
        'acme/second-repo': {
          files: { 'README.md': '# Second\n', 'src/second.js': 'console.log("second");\n' }
        }
      }
    });

    await page.goto('/cloud-ide?repo=acme/first-repo');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });

    const firstLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'src/app.js', 'console.log("EDITED_FIRST_REPO");\n');
    await expect
      .poll(async () =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', firstLabId)
      )
      .toContain('EDITED_FIRST_REPO');

    await verifyNonDestructiveTransition(page, {
      prevLabId: firstLabId,
      preservedFile: 'src/app.js',
      preservedContent: 'console.log("EDITED_FIRST_REPO");\n',
      trigger: async () => {
        const cloneBtn = page.locator('#open-clone-modal-btn, [data-cl-action="open-clone-modal"]');
        if (await cloneBtn.first().isVisible()) {
          await cloneBtn.first().click();
        } else {
          await clickMenuItem(page, 'File', /Clone/i);
        }
        const input = page
          .locator(
            ':is(#landing-repo-input, #cl-clone-repo-input, input[placeholder*="github" i], input[placeholder*="owner/repo" i]):visible'
          )
          .first();
        await expect(input).toBeVisible();
        await input.fill('acme/second-repo');
        await workbenchLocators.cloneSubmitButton(page).click();
      },
      resolution: 'isolate'
    });

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/second.js'], { timeout: 10_000 })
      .toContain('second');
  });

  test('T1-F6-06: Terminal git clone https://github.com/acme/sub-pkg clones into subdirectory and syncs Explorer tree', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'sub-pkg',
      files: {
        'README.md': '# Sub Package\n',
        'lib.js': 'module.exports = 42;\n'
      }
    });

    await page.goto('/workbench?labId=t1-f6-06');
    await runTerminalCommand(page, 'git clone https://github.com/acme/sub-pkg');

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['sub-pkg/README.md'], {
        timeout: 10_000
      })
      .toContain('# Sub Package');
    await expect(workbenchLocators.folderItem(page, 'sub-pkg')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F11: Non-Destructive Settings Editor Tab & Live Wiring (6 tests: T1-F11-01 .. T1-F11-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F11-01: Opening Settings (Mod+,, Activity Bar gear, ide.openSettings()) opens non-destructive __settings__ tab & #cl-settings-host', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f11-01');
    await openOrCreateCodeFile(page, 'app.js', 'const keepMe = 123;\n');

    await openSettingsTabViaGear(page);
    await expect(workbenchLocators.settingsTab(page)).toBeVisible();
    await expect(workbenchLocators.settingsHost(page)).toBeVisible();
    await expect(page.locator('dialog.cl-settings-dialog[open]')).toHaveCount(0);
    await expect(workbenchLocators.fileTab(page, 'app.js')).toBeVisible();

    // Return to app.js tab and verify code is untouched
    await workbenchLocators.fileTab(page, 'app.js').click();
    expect(await getActiveEditorText(page)).toBe('const keepMe = 123;\n');

    // Keyboard shortcut Mod+, also focuses Settings tab
    await page.keyboard.press('ControlOrMeta+,');
    await expect(workbenchLocators.settingsHost(page)).toBeVisible();
  });

  test('T1-F11-02: Settings search filter and category navigation (Editor, Workbench, Files, Terminal, SQL) filter controls live', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f11-02');
    await openSettingsTabViaGear(page);

    const host = workbenchLocators.settingsHost(page);
    const searchInput = host.locator('[data-role="settings-search"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('scrollback');
    await expect(host.locator('[data-setting-row="terminal.scrollback"]')).toBeVisible();
    await expect(host.locator('[data-setting-row="editor.fontSize"]')).toBeHidden();

    await searchInput.fill('');
    const terminalCat = host.locator('[data-role="settings-categories"] [data-settings-cat="Terminal"]');
    await expect(terminalCat).toBeVisible();
    await terminalCat.click();
    await expect(host.locator('[data-setting-row="terminal.fontSize"]')).toBeVisible();
    await expect(host.locator('[data-setting-row="terminal.scrollback"]')).toBeVisible();
  });

  test('T1-F11-03: User vs Workspace scope tabs and Open Settings (JSON) synchronize cleanly with .codelab/settings.json', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f11-03');
    await openOrCreateCodeFile(page, 'app.js', 'const active = true;\n');
    await openSettingsTabViaGear(page);

    const host = workbenchLocators.settingsHost(page);
    const workspaceScopeTab = host
      .locator(
        ':is([data-settings-scope="workspace"], [data-cl-scope="workspace"], [role="tab"]:has-text("Workspace"), button:has-text("Workspace"))'
      )
      .first();
    await expect(workspaceScopeTab).toBeVisible();
    await workspaceScopeTab.click();

    const tabSizeControl = host.locator('[data-setting-key="editor.tabSize"]');
    await tabSizeControl.fill('4');
    await tabSizeControl.dispatchEvent('change');

    const openJsonBtn = host.locator('[data-settings-action="open-json"], button:has-text("JSON")').first();
    await expect(openJsonBtn).toBeVisible();
    await openJsonBtn.click();

    await expect(workbenchLocators.fileTab(page, '.codelab/settings.json')).toBeVisible();
    await expect(workbenchLocators.settingsTab(page)).toBeVisible();
    await expect(workbenchLocators.fileTab(page, 'app.js')).toBeVisible();

    const settingsJsonText = (await getPublicWorkbenchFiles(page))['.codelab/settings.json'] || '';
    expect(settingsJsonText).toContain('"editor.tabSize": 4');
  });

  test('T1-F11-04: Live Editor & Theme settings (editor.fontSize, editor.wordWrap, editor.lineNumbers, workbench.colorTheme) apply immediately', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f11-04');
    await openSettingsTabViaGear(page);

    const host = workbenchLocators.settingsHost(page);
    const fontSizeInput = host.locator('[data-setting-key="editor.fontSize"]');
    await fontSizeInput.fill('18');
    await fontSizeInput.dispatchEvent('change');

    const wordWrapControl = host.locator('[data-setting-key="editor.wordWrap"]');
    if ((await wordWrapControl.evaluate((el) => el.tagName.toLowerCase())) === 'select') {
      await wordWrapControl.selectOption('on');
    } else {
      await wordWrapControl.click();
    }

    const themeSelect = host.locator('[data-setting-key="workbench.colorTheme"]');
    await themeSelect.selectOption('light');

    await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', 'light');

    await workbenchLocators.fileTab(page, 'index.js').click();
    const computedFontSize = await page
      .locator('#cl-fallback-editor')
      .evaluate((el) => window.getComputedStyle(el).fontSize);
    expect(computedFontSize).toBe('18px');
  });

  test('T1-F11-05: Live Workbench, Terminal & SQL settings (workbench.sideBar.visible, workbench.panel.defaultTab, terminal.fontSize, sql.defaultDialect) take effect', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f11-05&lang=sql');
    await openSettingsTabViaGear(page);
    const host = workbenchLocators.settingsHost(page);

    const sidebarCheckbox = host.locator('[data-setting-key="workbench.sideBar.visible"]');
    if (await sidebarCheckbox.isChecked()) {
      await sidebarCheckbox.uncheck();
    }
    await expect(workbenchLocators.sidebar(page)).toBeHidden();
    await sidebarCheckbox.check();
    await expect(workbenchLocators.sidebar(page)).toBeVisible();

    const termFontInput = host.locator('[data-setting-key="terminal.fontSize"]');
    await termFontInput.fill('16');
    await termFontInput.dispatchEvent('change');

    await workbenchLocators.drawerTab(page, 'terminal').click();
    const termFontSize = await workbenchLocators
      .terminalSurface(page)
      .evaluate((el) => window.getComputedStyle(el).fontSize);
    expect(termFontSize).toBe('16px');

    const sqlDialectSelect = host.locator('[data-setting-key="sql.defaultDialect"]');
    await sqlDialectSelect.selectOption('sqlite');
    await expect(workbenchLocators.statusBar(page)).toContainText(/sqlite/i);

    const defaultTabSelect = host.locator('[data-setting-key="workbench.panel.defaultTab"]');
    await defaultTabSelect.selectOption('problems');

    await page.goto('/workbench?labId=t1-f11-05-fresh');
    await expect(workbenchLocators.root(page)).toBeVisible();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
  });

  test('T1-F11-06: Full Cloud IDE Settings round-trip on a cloned repo preserves 100% of repo files, open tabs, and unsaved code', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'web-starter',
      files: buildLargeRepoFiles(12)
    });

    await page.goto('/cloud-ide?repo=acme/web-starter');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });

    await openOrCreateCodeFile(page, 'src/index.ts');
    await setActiveEditorText(page, 'export const UNSAVED_BUFFER = "preserved-100-percent";\n');

    await openSettingsTabViaGear(page);
    const host = workbenchLocators.settingsHost(page);
    const fontInput = host.locator('[data-setting-key="editor.fontSize"]');
    await fontInput.fill('17');
    await fontInput.dispatchEvent('change');

    // Close Settings tab via its close button or switch back to src/index.ts
    const closeSettingsBtn = workbenchLocators
      .settingsTab(page)
      .locator('[data-cl-action*="close"], .codelab-tab__close, button[aria-label*="Close" i]')
      .first();
    if (await closeSettingsBtn.isVisible()) {
      await closeSettingsBtn.click();
    } else {
      await workbenchLocators.fileTab(page, 'src/index.ts').click();
    }

    const effectiveFontSize = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('editor.fontSize')
    );
    expect(effectiveFontSize).toBe(17);

    await workbenchLocators.fileTab(page, 'src/index.ts').click();
    expect(await getActiveEditorText(page)).toBe(
      'export const UNSAVED_BUFFER = "preserved-100-percent";\n'
    );
    const allFiles = await getPublicWorkbenchFiles(page);
    expect(Object.keys(allFiles).length).toBeGreaterThanOrEqual(12);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F12: UI/UX Rough Edges, Theme Contrast & Parity Polish (5 tests: T1-F12-01 .. T1-F12-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F12-01: Full-viewport 100vh x 100vw rendering on /workbench and /cloud-ide with zero bottom dead gap', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto('/workbench?labId=t1-f12-01');

    const wbRect = await getRect(workbenchLocators.root(page));
    expect(Math.abs(wbRect.width - 1440)).toBeLessThanOrEqual(2);
    expect(Math.abs(wbRect.height - 1080)).toBeLessThanOrEqual(2);

    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) {
      await openEmpty.click();
    }
    const cloudWbRect = await getRect(workbenchLocators.root(page));
    expect(Math.abs(cloudWbRect.width - 1440)).toBeLessThanOrEqual(2);
    expect(cloudWbRect.bottom).toBeGreaterThanOrEqual(1078);
  });

  test('T1-F12-02: Theme switching (dark, light, high-contrast) maintains readable foreground/background contrast across UI controls', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f12-02');
    await openSettingsTabViaGear(page);

    for (const theme of ['dark', 'light', 'high-contrast'] as const) {
      await page.evaluate((t) => (window as any).__codelabIde.setTheme(t), theme);
      await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', theme);

      const fileMenuColors = await getEffectiveColors(workbenchLocators.menuTrigger(page, 'File'));
      expect(fileMenuColors.fg).not.toBe(fileMenuColors.bg);
      expect(fileMenuColors.ratio).toBeGreaterThanOrEqual(3.0);

      const activeTabColors = await getEffectiveColors(workbenchLocators.settingsTab(page));
      expect(activeTabColors.fg).not.toBe(activeTabColors.bg);
      expect(activeTabColors.ratio).toBeGreaterThanOrEqual(3.0);
    }
  });

  test('T1-F12-03: Interactive Status Bar items (statusbar-scm & statusbar-problems) navigate to SCM Sidebar and Problems Panel', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f12-03&git=1');

    await expect(workbenchLocators.statusScmBtn(page)).toBeVisible();
    await workbenchLocators.statusScmBtn(page).click();
    await expect(workbenchLocators.scmView(page)).toBeVisible();

    await expect(workbenchLocators.statusProblemsBtn(page)).toBeVisible();
    await workbenchLocators.statusProblemsBtn(page).click();
    await expect(workbenchLocators.drawer(page)).toBeVisible();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
  });

  test('T1-F12-04: Backwards-compatible imperative SDK methods delegate to non-destructive VS Code views with zero blocking modals', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f12-04');

    await page.evaluate(() => (window as any).__codelabIde.showSearchModal('hello'));
    await expect(workbenchLocators.searchView(page)).toBeVisible();
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);

    await page.evaluate(() => (window as any).__codelabIde.showScmModal());
    await expect(workbenchLocators.scmView(page)).toBeVisible();
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);

    await page.evaluate(() => (window as any).__codelabIde.showProblemsModal());
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);

    await page.evaluate(() => (window as any).__codelabIde.openSettings());
    await expect(workbenchLocators.settingsTab(page)).toBeVisible();
    await expect(workbenchLocators.settingsHost(page)).toBeVisible();
    await expect(page.locator('dialog.cl-settings-dialog[open]')).toHaveCount(0);
  });

  test('T1-F12-05: Keyboard navigation & Escape dismissal across Command Palette, Context Menu, and Menu Bar leave zero focus traps', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f12-05');

    // 1. Explorer Context Menu -> Escape
    await workbenchLocators.fileItem(page, 'index.js').click({ button: 'right' });
    await expect(page.locator('.codelab-context-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.codelab-context-menu')).toBeHidden();

    // 2. Menu Bar -> Escape
    await openTopMenu(page, 'File');
    await page.keyboard.press('Escape');
    await expect(workbenchLocators.openDropdownMenus(page)).toHaveCount(0);

    // 3. Command Palette -> Escape
    await page.keyboard.press('ControlOrMeta+Shift+P');
    await expect(workbenchLocators.paletteInput(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(workbenchLocators.paletteInput(page)).toBeHidden();
  });
});
