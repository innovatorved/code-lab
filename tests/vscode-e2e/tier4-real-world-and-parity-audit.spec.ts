import { test, expect, type Page } from '@playwright/test';
import {
  HAPPY_PATH_COMMITS,
  HAPPY_PATH_FILES,
  installGitHubMock
} from './helpers/github-mock';
import {
  assertNoOverlap,
  assertSidebarDrawerSeparation,
  attachZeroErrorTracker,
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
  setActiveEditorText,
  switchRecentWorkspaceViaUi,
  triggerBlankIdeAction,
  verifyNonDestructiveTransition,
  waitForOptionalConfirmModal,
  withAutoAcceptDialog,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

/**
 * Executes the complete 11-point VS Code UI/UX Parity Checklist Audit (`ORIGINAL_REQUEST` AC #1, #2, #3):
 *   1. `[role="menubar"]` with `File..Help` menus & keyboard open/Escape
 *   2. `48px` `nav.codelab-activitybar` (`Explorer`, `Search`, `SCM`, bottom `Settings` gear)
 *   3. Full-height `aside.codelab-sidebar` (`sidebarRect.bottom > drawerRect.top`)
 *   4. Dedicated `#cl-drawer` strictly right of Sidebar (`drawerRect.left >= sidebarRect.right - 1.5`, zero `#cl-terminal-surface` in `.codelab-sidebar`)
 *   5. Non-modal Sidebar `Search` & `SCM`, Bottom Panel `Problems` & `Terminal`, and Editor tab `__settings__`
 *   6. Working vertical & horizontal splitters + collapse/maximize/close toggles
 *   7. Status Bar branch + problems + cursor items
 *   8. Zero clipped primary controls (`rect` strictly within `[0..viewportWidth, 0..viewportHeight]`)
 *   9. Zero overlapping sibling regions (Topbar, ActivityBar, Sidebar, EditorCol, Drawer, StatusBar)
 *  10. Zero nested `<button>`s & zero dead/unlabeled visible buttons
 *  11. WCAG contrast pass across `dark`, `light`, and `high-contrast` themes
 */
async function executeElevenPointParityChecklistAudit(page: Page): Promise<void> {
  const viewport = page.viewportSize() || { width: 1280, height: 800 };

  // ── Item 1: Canonical Title/Menu Bar (`File..Help`) & keyboard dismissal ──
  await expect(workbenchLocators.menubar(page)).toBeVisible();
  for (const menuName of ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help']) {
    await expect(workbenchLocators.menuTrigger(page, menuName)).toBeVisible();
  }
  await openTopMenu(page, 'File');
  await page.keyboard.press('Escape');
  await expect(workbenchLocators.openDropdownMenus(page)).toHaveCount(0);

  // ── Item 2: Fixed ~48px Left Activity Bar with top view icons & bottom Settings gear ──
  const actBar = workbenchLocators.activityBar(page);
  await expect(actBar).toBeVisible();
  const actRect = await getRect(actBar);
  expect(actRect.width).toBeGreaterThanOrEqual(36);
  expect(actRect.width).toBeLessThanOrEqual(60);
  expect(actRect.left).toBeLessThanOrEqual(2);
  const scmRect = await getRect(workbenchLocators.activityItem(page, 'scm'));
  const gearRect = await getRect(workbenchLocators.activitySettingsGear(page));
  expect(gearRect.top).toBeGreaterThan(scmRect.bottom + 40);

  // ── Item 3 & Item 4: Full-Height Primary Sidebar + Separate Dedicated Bottom Panel ──
  await workbenchLocators.activityItem(page, 'explorer').click();
  if (!(await workbenchLocators.sidebar(page).isVisible())) {
    await workbenchLocators.activityItem(page, 'explorer').click();
  }
  await workbenchLocators.drawerTab(page, 'terminal').click();
  await expect(workbenchLocators.terminalSurface(page)).toBeVisible();

  const { sidebarRect, drawerRect } = await assertSidebarDrawerSeparation(page);
  expect(sidebarRect.bottom).toBeGreaterThan(drawerRect.top + 30);
  expect(drawerRect.left).toBeGreaterThanOrEqual(sidebarRect.right - 1.5);

  // ── Item 5: Non-modal Sidebar Search & SCM, Bottom Panel Problems & Terminal, Editor __settings__ ──
  await openSearchSidebar(page);
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  await openScmSidebar(page);
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  await openProblemsPanel(page);
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  await openSettingsTabViaGear(page);
  await expect(workbenchLocators.settingsHost(page)).toBeVisible();
  await expect(page.locator('dialog.cl-settings-dialog[open]')).toHaveCount(0);

  // Return to Explorer & Terminal open state for geometry checks
  await workbenchLocators.activityItem(page, 'explorer').click();
  await workbenchLocators.drawerTab(page, 'terminal').click();

  // ── Item 6: Working vertical & horizontal splitters + collapse/maximize/close toggles ──
  const vSplit = await getRect(workbenchLocators.sidebarSplitter(page));
  await page.mouse.move(vSplit.left + 2, vSplit.top + 60);
  await page.mouse.down();
  await page.mouse.move(vSplit.left + 30, vSplit.top + 60, { steps: 4 });
  await page.mouse.up();
  expect((await getRect(workbenchLocators.sidebar(page))).width).toBeGreaterThan(
    sidebarRect.width + 10
  );
  await workbenchLocators.sidebarSplitter(page).dblclick();

  await workbenchLocators.drawerMaximizeBtn(page).click();
  expect((await getRect(workbenchLocators.drawer(page))).height).toBeGreaterThan(
    drawerRect.height + 80
  );
  await workbenchLocators.drawerMaximizeBtn(page).click();

  await workbenchLocators.drawerCloseBtn(page).click();
  await page.keyboard.press('Control+`');
  await expect(workbenchLocators.terminalSurface(page)).toBeVisible();

  // ── Item 7: Status Bar branch, problems, and cursor items ──
  await expect(workbenchLocators.statusBar(page)).toBeVisible();
  await expect(workbenchLocators.statusProblemsBtn(page)).toBeVisible();
  await openOrCreateCodeFile(page, 'parity-check.js', 'const parity = true;\n');
  await expect(workbenchLocators.statusCursor(page)).toBeVisible();

  // ── Item 8: Zero clipped primary regions/controls within viewport ──
  for (const [label, loc] of [
    ['Topbar', workbenchLocators.topbar(page)],
    ['ActivityBar', workbenchLocators.activityBar(page)],
    ['PrimarySidebar', workbenchLocators.sidebar(page)],
    ['EditorCol', workbenchLocators.editorCol(page)],
    ['BottomDrawer', workbenchLocators.drawer(page)],
    ['StatusBar', workbenchLocators.statusBar(page)]
  ] as const) {
    const r = await getRect(loc);
    expect(r.left, `${label} left >= 0`).toBeGreaterThanOrEqual(-1);
    expect(r.top, `${label} top >= 0`).toBeGreaterThanOrEqual(-1);
    expect(r.right, `${label} right <= viewport.width`).toBeLessThanOrEqual(viewport.width + 1.5);
    expect(r.bottom, `${label} bottom <= viewport.height`).toBeLessThanOrEqual(
      viewport.height + 1.5
    );
  }

  // ── Item 9: Zero overlapping sibling layout regions ──
  const topRect = await getRect(workbenchLocators.topbar(page));
  const actRectNow = await getRect(workbenchLocators.activityBar(page));
  const sbRectNow = await getRect(workbenchLocators.sidebar(page));
  const edRectNow = await getRect(workbenchLocators.editorCol(page));
  const drRectNow = await getRect(workbenchLocators.drawer(page));
  const stRectNow = await getRect(workbenchLocators.statusBar(page));

  assertNoOverlap(topRect, actRectNow, 'Topbar', 'ActivityBar');
  assertNoOverlap(topRect, sbRectNow, 'Topbar', 'Sidebar');
  assertNoOverlap(topRect, edRectNow, 'Topbar', 'EditorCol');
  assertNoOverlap(actRectNow, sbRectNow, 'ActivityBar', 'Sidebar');
  assertNoOverlap(sbRectNow, edRectNow, 'Sidebar', 'EditorCol');
  assertNoOverlap(sbRectNow, drRectNow, 'Sidebar', 'BottomDrawer');
  assertNoOverlap(edRectNow, drRectNow, 'EditorCol', 'BottomDrawer');
  assertNoOverlap(sbRectNow, stRectNow, 'Sidebar', 'StatusBar');
  assertNoOverlap(drRectNow, stRectNow, 'BottomDrawer', 'StatusBar');

  // ── Item 10: Zero nested <button> markup & every visible button has accessible name/text ──
  await expect(page.locator('button button, button [role="button"], a button')).toHaveCount(0);
  const unlabeledButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.codelab-workbench button'));
    return btns
      .filter((b) => {
        const st = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        if (st.display === 'none' || st.visibility === 'hidden' || r.width === 0 || r.height === 0) {
          return false;
        }
        const label =
          (b.textContent || '').trim() ||
          b.getAttribute('aria-label') ||
          b.getAttribute('title') ||
          b.getAttribute('aria-labelledby');
        return !label;
      })
      .map((b) => b.outerHTML.slice(0, 120));
  });
  expect(unlabeledButtons).toEqual([]);

  // ── Item 11: WCAG Contrast Pass across dark, light, and high-contrast ──
  for (const theme of ['dark', 'light', 'high-contrast'] as const) {
    await page.evaluate((t) => (window as any).__codelabIde.setTheme(t), theme);
    await expect(workbenchLocators.root(page)).toHaveAttribute('data-cl-theme', theme);

    const menuContrast = await getEffectiveColors(workbenchLocators.menuTrigger(page, 'File'));
    expect(menuContrast.fg).not.toBe(menuContrast.bg);
    expect(menuContrast.ratio).toBeGreaterThanOrEqual(3.0);

    const tabContrast = await getEffectiveColors(
      workbenchLocators.fileTab(page, 'parity-check.js')
    );
    expect(tabContrast.fg).not.toBe(tabContrast.bg);
    expect(tabContrast.ratio).toBeGreaterThanOrEqual(3.0);
  }

  await page.evaluate(() => (window as any).__codelabIde.setTheme('dark'));
}

test.describe('Tier 4 — Real-World Developer Workloads & Explicit 11-Point VS Code UI/UX Parity Audits', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }, testInfo) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page, {
      allowNetworkErrorStatus: testInfo.title.includes('T4-06')
    });
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  test('T4-01: Full GitHub Maintainer Lifecycle (Clone -> Explore -> Search -> Edit -> Diff -> Commit -> Reload)', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'fullstack-app',
      files: {
        'README.md': '# Fullstack App\n',
        'package.json': '{"name":"fullstack-app","version":"1.0.0"}\n',
        'src/config.ts': 'export const APP_NAME = "acme";\nexport const API_VERSION = "v1";\n',
        'src/server.ts': 'import { API_VERSION } from "./config";\nconsole.log(API_VERSION);\n'
      },
      commits: HAPPY_PATH_COMMITS
    });

    await page.goto('/cloud-ide');
    await page.locator('#landing-repo-input').fill('acme/fullstack-app');
    await page.locator('#landing-clone-btn').click();
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });

    // Explore & Search for API_VERSION
    await expect(workbenchLocators.folderItem(page, 'src')).toBeVisible();
    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('API_VERSION');
    await expect(searchView).toContainText('src/config.ts');

    const configMatch = searchView
      .locator(':is([data-cl-search-match], .codelab-search-match, [role="listitem"], button, div)')
      .filter({ hasText: /v1/ })
      .last();
    await configMatch.click();
    await expect(workbenchLocators.fileTab(page, 'src/config.ts')).toBeVisible();

    // Edit API_VERSION -> v2
    await setActiveEditorText(
      page,
      'export const APP_NAME = "acme";\nexport const API_VERSION = "v2";\n'
    );

    // Open Source Control, inspect Diff, stage & commit
    const scmView = await openScmSidebar(page);
    await scmView
      .locator(':is([data-cl-scm-file="src/config.ts"], .codelab-scm-item)')
      .filter({ hasText: 'config.ts' })
      .first()
      .click();
    await expect(workbenchLocators.editorCol(page)).toContainText('"v1"');
    await expect(workbenchLocators.editorCol(page)).toContainText('"v2"');

    await scmView
      .locator('[data-cl-action="scm-stage-all"], button[title*="Stage All" i], button:has-text("Stage All")')
      .first()
      .click();
    await workbenchLocators.scmCommitInput(page).fill('chore: bump API_VERSION');
    await workbenchLocators.scmCommitBtn(page).click();

    const gitLog = await runTerminalCommand(page, 'git log -n 1');
    expect(gitLog).toContain('chore: bump API_VERSION');

    const fullstackLabId = await getActiveLabId(page);
    await expect
      .poll(() =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', fullstackLabId)
      )
      .toContain('src/config.ts');
    await page.reload();
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/config.ts'])
      .toContain('"v2"');
  });

  test('T4-02: All-Views State Preservation Gauntlet (ORIGINAL_REQUEST AC #4 & #5)', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    await openSettingsTabViaGear(page);
    await workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="files.autoSave"]')
      .selectOption('off');

    await openOrCreateCodeFile(page, 'src/feature.js', 'export const feat = "ready";\n');
    await page.keyboard.press('ControlOrMeta+s');

    await openOrCreateCodeFile(page, 'index.js', 'const base = 1;\n');
    await page.keyboard.press('ControlOrMeta+s');
    // Leave unsaved edit in index.js while visiting EVERY view!
    await setActiveEditorText(page, 'const unsavedGauntletCode = "SURVIVED_ALL_VIEWS";\n');

    // 1. Explorer
    await workbenchLocators.activityItem(page, 'explorer').click();
    await expect(workbenchLocators.explorerView(page)).toBeVisible();

    // 2. Search
    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('feat');
    await expect(searchView).toContainText('src/feature.js');

    // 3. Source Control
    await openScmSidebar(page);

    // 4. Problems
    await openProblemsPanel(page);

    // 5. Terminal
    const lsOut = await runTerminalCommand(page, 'ls');
    expect(lsOut).toContain('index.js');

    // 6. Settings (change fontSize & theme)
    await openSettingsTabViaGear(page);
    const host = workbenchLocators.settingsHost(page);
    await host.locator('[data-setting-key="editor.fontSize"]').fill('16');
    await host.locator('[data-setting-key="editor.fontSize"]').dispatchEvent('change');
    await host.locator('[data-setting-key="workbench.colorTheme"]').selectOption('light');

    // Return to index.js tab and verify 0 loss of files, tabs, terminal logs, or unsaved code!
    await workbenchLocators.fileTab(page, 'index.js').click();
    expect(await getActiveEditorText(page)).toBe(
      'const unsavedGauntletCode = "SURVIVED_ALL_VIEWS";\n'
    );
    expect((await getPublicWorkbenchFiles(page))['src/feature.js']).toBe(
      'export const feat = "ready";\n'
    );

    await page.keyboard.press('ControlOrMeta+s');
    await page.reload();
    expect((await getPublicWorkbenchFiles(page))['index.js']).toBe(
      'const unsavedGauntletCode = "SURVIVED_ALL_VIEWS";\n'
    );
  });

  test('T4-03: Polyglot Debugging & Multi-Terminal Workflow (Python + JS + Problems + 2 Terminals)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t4-03');
    await openOrCreateCodeFile(
      page,
      'analyzer.py',
      '# 1\n# 2\ndef compute()\n    return 42\n'
    );
    await openOrCreateCodeFile(
      page,
      'writer.js',
      'const fs = require("fs");\nfs.mkdirSync("out", { recursive: true });\nfs.writeFileSync("out/report.txt", "REPORT_OK");\nconsole.log("WROTE_REPORT");\n'
    );
    await expect
      .poll(async () =>
        await page.evaluate(() => (window as any).__codelabIde.getDiagnostics().length)
      )
      .toBeGreaterThanOrEqual(1);

    // Observe error in Status Bar & Problems, click to jump to analyzer.py
    await expect(workbenchLocators.statusProblemsBtn(page)).toContainText(/[1-9]/);
    const drawerBody = await openProblemsPanel(page);
    await drawerBody
      .locator(':is(.codelab-problem-item, [data-cl-problem-file="analyzer.py"], [data-cl-diag-file="analyzer.py"])')
      .first()
      .click();
    await expect(workbenchLocators.fileTab(page, 'analyzer.py')).toBeVisible();

    // Fix Python syntax error -> diagnostics drop to 0
    await setActiveEditorText(page, '# 1\n# 2\ndef compute():\n    return 42\n');
    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);

    // Run writer.js in Terminal Session 1
    const s1Out = await runTerminalCommand(page, 'node writer.js');
    expect(s1Out).toContain('WROTE_REPORT');

    // Spawn Terminal Session 2, cd out, verify report.txt while Session 1 stays at /workspace
    await workbenchLocators.newTerminalBtn(page).click();
    const s2Out = await runTerminalCommand(page, 'cd out && cat report.txt');
    expect(s2Out).toContain('REPORT_OK');

    await workbenchLocators.drawerMaximizeBtn(page).click();
    await assertSidebarDrawerSeparation(page);
    await workbenchLocators.drawerMaximizeBtn(page).click();
  });

  test('T4-04: Multi-File Refactoring & Accidental Change Recovery (Explorer + Search Replace All + SCM Discard)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t4-04&blank=1&empty=1');
    await openOrCreateCodeFile(
      page,
      'src/helpers.js',
      'module.exports = { greet: () => "HELLO_REFACTOR" };\n'
    );
    await openOrCreateCodeFile(
      page,
      'src/a.js',
      'const h = require("./helpers");\nmodule.exports = h.greet();\n'
    );
    await openOrCreateCodeFile(
      page,
      'src/b.js',
      'const h = require("./helpers");\nmodule.exports = h.greet();\n'
    );
    await openOrCreateCodeFile(
      page,
      'src/entry.js',
      'console.log(require("./a"), require("./b"));\n'
    );
    await openOrCreateCodeFile(
      page,
      'src/do-not-touch.js',
      'module.exports = "CLEAN_ORIGINAL";\n'
    );
    await runTerminalCommand(page, 'git init && git add . && git commit -m "initial 5 modules"');

    // Rename src/helpers.js -> src/utils.js
    await page.evaluate(() =>
      (window as any).__codelabIde.renameFile('src/helpers.js', 'src/utils.js')
    );

    // Replace All "./helpers" -> "./utils" across workspace
    const searchView = await openSearchSidebar(page);
    if (!(await workbenchLocators.replaceInput(page).isVisible())) {
      const toggle = searchView
        .locator('[data-cl-action*="replace"], button[aria-label*="Replace" i]')
        .first();
      if (await toggle.isVisible()) await toggle.click();
    }
    await workbenchLocators.searchInput(page).fill('./helpers');
    await workbenchLocators.replaceInput(page).fill('./utils');
    await withAutoAcceptDialog(page, async () => {
      await searchView
        .locator(
          '[data-cl-action="search-replace-all"], [data-cl-action="replace-all"], button[title*="Replace All" i], button:has-text("Replace All")'
        )
        .first()
        .click();
    });

    // Accidentally corrupt src/do-not-touch.js, then Discard Changes on it in SCM
    await openOrCreateCodeFile(page, 'src/do-not-touch.js');
    await setActiveEditorText(page, 'module.exports = "ACCIDENTAL_CORRUPTION";\n');

    const scmView = await openScmSidebar(page);
    const accidentalRow = scmView
      .locator(':is([data-cl-scm-file="src/do-not-touch.js"], .codelab-scm-item)')
      .filter({ hasText: 'do-not-touch.js' })
      .first();
    const discardBtn = accidentalRow
      .locator('[data-cl-action="scm-discard"], button[title*="Discard" i]')
      .first();
    await withAutoAcceptDialog(page, async () => {
      await discardBtn.click();
    });
    if (
      (await getPublicWorkbenchFiles(page))['src/do-not-touch.js'] !==
      'module.exports = "CLEAN_ORIGINAL";\n'
    ) {
      const confirmModalBtn = page
        .locator(':is(#cl-modal-slot, [role="dialog"]) button:is(:has-text("Discard"), :has-text("Confirm"))')
        .first();
      await confirmModalBtn.waitFor({ state: 'visible', timeout: 250 }).catch(() => {});
      if (await confirmModalBtn.isVisible().catch(() => false)) {
        await confirmModalBtn.click();
      }
    }

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/do-not-touch.js'])
      .toBe('module.exports = "CLEAN_ORIGINAL";\n');

    // Stage All & Commit remaining refactored files, then execute src/entry.js
    await scmView
      .locator('[data-cl-action="scm-stage-all"], button[title*="Stage All" i], button:has-text("Stage All")')
      .first()
      .click();
    await workbenchLocators.scmCommitInput(page).fill('refactor: helpers -> utils');
    await workbenchLocators.scmCommitBtn(page).click();

    const runOut = await runTerminalCommand(page, 'node src/entry.js');
    expect(runOut).toContain('HELLO_REFACTOR HELLO_REFACTOR');
  });

  test('T4-05: Non-Destructive Multi-Workspace Juggling (ORIGINAL_REQUEST AC #6: Clone <-> Blank IDE <-> Cancel <-> Recent)', async ({
    page
  }) => {
    await installGitHubMock(page, {
      repos: {
        'acme/project-alpha': {
          files: { 'README.md': '# Alpha\n', 'alpha.js': 'export const alpha = 1;\n' }
        },
        'acme/project-beta': {
          files: { 'README.md': '# Beta\n', 'beta.js': 'export const beta = 2;\n' }
        }
      }
    });

    // 1. Clone project-alpha and make local edits
    await page.goto('/cloud-ide?repo=acme/project-alpha');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });
    const alphaLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'alpha.js', 'export const alpha = "LOCAL_ALPHA_EDIT";\n');
    await expect
      .poll(() =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', alphaLabId)
      )
      .toContain('LOCAL_ALPHA_EDIT');

    // 2. Open Clone Repo & press Escape -> zero change
    await openCloneRepoUi(page);
    await page.keyboard.press('Escape');
    expect(await getActiveLabId(page)).toBe(alphaLabId);
    expect((await getPublicWorkbenchFiles(page))['alpha.js']).toBe(
      'export const alpha = "LOCAL_ALPHA_EDIT";\n'
    );

    // 3. Isolate into Blank IDE and write prototype.js
    const { nextLabId: blankLabId } = await verifyNonDestructiveTransition(page, {
      prevLabId: alphaLabId,
      preservedFile: 'alpha.js',
      preservedContent: 'export const alpha = "LOCAL_ALPHA_EDIT";\n',
      trigger: () => triggerBlankIdeAction(page),
      resolution: 'isolate'
    });
    await openOrCreateCodeFile(page, 'prototype.js', 'export const proto = "BLANK_PROTO";\n');
    await expect
      .poll(() =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', blankLabId)
      )
      .toContain('BLANK_PROTO');

    // 4. Isolate into project-beta
    const { nextLabId: betaLabId } = await verifyNonDestructiveTransition(page, {
      prevLabId: blankLabId,
      preservedFile: 'prototype.js',
      preservedContent: 'export const proto = "BLANK_PROTO";\n',
      trigger: async () => {
        await openCloneRepoUi(page);
        const input = page
          .locator('#landing-repo-input:visible, #cl-clone-repo-input:visible')
          .first();
        await input.fill('acme/project-beta');
        await workbenchLocators.cloneSubmitButton(page).click();
      },
      resolution: 'isolate'
    });
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['beta.js'], { timeout: 10_000 })
      .toContain('beta = 2');
    expect(betaLabId).not.toBe(alphaLabId);

    // 5. Switch back to BOTH alphaLabId and blankLabId verifying 100% survival across all 3!
    await switchRecentWorkspaceViaUi(page, alphaLabId);
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['alpha.js'])
      .toBe('export const alpha = "LOCAL_ALPHA_EDIT";\n');

    await switchRecentWorkspaceViaUi(page, blankLabId);
    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['prototype.js'])
      .toBe('export const proto = "BLANK_PROTO";\n');
  });

  test('T4-06: Network Fault Resilience During Clone (500 Transactional Rollback + 403 Rate-Limit jsDelivr Fallback)', async ({
    page
  }) => {
    const mock = await installGitHubMock(page, {
      repos: {
        'acme/broken-500': {
          mode: 'server-error'
        },
        'acme/ratelimited-repo': {
          mode: 'rate-limit-fallback',
          rateLimitStatus: 403,
          rateLimitRawContent: true,
          files: {
            'README.md': '# Rate Limited Repo\n',
            'run.js': 'console.log("FALLBACK_EXEC_OK");\n'
          }
        }
      }
    });

    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    const initialLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'important.js', 'const MUST_SURVIVE_500 = true;\n');
    await expect
      .poll(() =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', initialLabId)
      )
      .toContain('MUST_SURVIVE_500');

    // 1. Attempt clone of broken-500 -> fails cleanly without wiping important.js
    await openCloneRepoUi(page);
    const input1 = page
      .locator('#landing-repo-input:visible, #cl-clone-repo-input:visible')
      .first();
    await input1.fill('acme/broken-500');
    await workbenchLocators.cloneSubmitButton(page).click();

    const confirm1 = await waitForOptionalConfirmModal(page, 500, { prevLabId: initialLabId });
    if (confirm1) {
      const rep = confirm1.locator('[data-cl-confirm="replace"], button:has-text("Replace")').first();
      if (await rep.isVisible()) await rep.click();
    }

    await expect
      .poll(() => mock.requests.some((r) => r.url.includes('broken-500') && r.status === 500))
      .toBe(true);
    await page.keyboard.press('Escape');
    const savedInitialRaw = await page.evaluate(
      (id) => localStorage.getItem(`sd-codelab-v1:${id}`),
      initialLabId
    );
    expect(savedInitialRaw).toContain('MUST_SURVIVE_500');

    // 2. Clone acme/ratelimited-repo via HTTP 403 -> Strategy B jsDelivr fallback
    await openCloneRepoUi(page);
    const input2 = page
      .locator('#landing-repo-input:visible, #cl-clone-repo-input:visible')
      .first();
    await input2.fill('acme/ratelimited-repo');
    await workbenchLocators.cloneSubmitButton(page).click();

    const confirm2 = await waitForOptionalConfirmModal(page, 500, { prevLabId: initialLabId });
    if (confirm2) {
      await confirm2
        .locator('[data-cl-confirm="isolated"], button:has-text("Isolated"), button:has-text("Replace")')
        .first()
        .click();
    }

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['run.js'], { timeout: 10_000 })
      .toContain('FALLBACK_EXEC_OK');
    expect(
      mock.requests.some((r) => r.host === 'data.jsdelivr.com' && r.status === 200)
    ).toBe(true);

    const execOut = await runTerminalCommand(page, 'node run.js && git status');
    expect(execOut).toContain('FALLBACK_EXEC_OK');
  });

  test('T4-07: SQL Studio & Configuration Live Tuning Workflow (Settings + .codelab/settings.json + SQL Diagnostics)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t4-07&lang=sql');

    await openSettingsTabViaGear(page);
    const host = workbenchLocators.settingsHost(page);
    await host.locator('[data-setting-key="sql.defaultDialect"]').selectOption('sqlite');
    await host.locator('[data-setting-key="editor.fontSize"]').fill('16');
    await host.locator('[data-setting-key="editor.fontSize"]').dispatchEvent('change');

    // Open Settings JSON, introduce syntax error, jump via Problems, fix JSON
    await host.locator('[data-settings-action="open-json"], button:has-text("JSON")').first().click();
    await expect(workbenchLocators.fileTab(page, '.codelab/settings.json')).toBeVisible();
    await setActiveEditorText(page, '{\n  "sql.defaultDialect": "sqlite",\n');

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('.codelab/settings.json');
    await setActiveEditorText(
      page,
      '{\n  "sql.defaultDialect": "sqlite",\n  "editor.fontSize": 16\n}\n'
    );
    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);

    // Run broken SQL -> diagnostic appears; fix SQL -> diagnostic clears & returns results
    await openOrCreateCodeFile(page, 'query.sql');
    await setActiveEditorText(page, 'SELEC * FORM users;');
    await page.evaluate(() => (window as any).__codelabIde.runSql('run'));
    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBeGreaterThanOrEqual(1);

    await setActiveEditorText(
      page,
      'CREATE TABLE items (id INT, title TEXT); INSERT INTO items VALUES (1, \'Book\'); SELECT title FROM items;'
    );
    await page.evaluate(() => (window as any).__codelabIde.runSql('run'));
    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);
    await expect(workbenchLocators.drawer(page)).toContainText('Book');
  });

  test('T4-08: Demo Environment -> Utility Views -> Export ZIP Non-Destructive Workflow (Survey B-01 Regression Proof)', async ({
    page
  }) => {
    await page.goto('/cloud-ide');
    const demoChip = page.locator('[data-demo="sd-shortener"], [data-demo="react"]').first();
    await expect(demoChip).toBeVisible();
    await demoChip.click();

    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });
    await expect(workbenchLocators.root(page)).toBeVisible();

    const demoLabId = await getActiveLabId(page);
    expect(demoLabId).not.toBe('cloud-ide');

    await openOrCreateCodeFile(
      page,
      'custom-export-marker.js',
      '// CUSTOM_USER_EDIT_IN_DEMO_ZIP\nexport const ok = true;\n'
    );

    // Open Search, Source Control, Problems, and Settings
    await openSearchSidebar(page);
    await openScmSidebar(page);
    await openProblemsPanel(page);
    await openSettingsTabViaGear(page);

    expect(await getActiveLabId(page)).toBe(demoLabId);

    const extractedHasMarker = await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      const zipBytes = ide.exportZip({ download: false });
      const extractFn = (window as any).CodeLab?.extractZip;
      if (typeof extractFn === 'function' && zipBytes) {
        const extracted = extractFn(zipBytes);
        return String(extracted['custom-export-marker.js'] || '').includes(
          'CUSTOM_USER_EDIT_IN_DEMO_ZIP'
        );
      }
      const decoder = new TextDecoder();
      return decoder.decode(zipBytes).includes('custom-export-marker.js');
    });
    expect(extractedHasMarker).toBe(true);
  });

  test('T4-09: Explicit 11-Point VS Code UI/UX Parity Checklist Audit — Standalone Workbench (/workbench)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t4-09-parity&git=1');
    await expect(workbenchLocators.root(page)).toBeVisible();

    await executeElevenPointParityChecklistAudit(page);
  });

  test('T4-10: Explicit 11-Point VS Code UI/UX Parity Checklist Audit — Cloud IDE Host Shell (/cloud-ide)', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'parity-repo',
      files: HAPPY_PATH_FILES
    });

    await page.goto('/cloud-ide?repo=acme/parity-repo');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });
    await expect(workbenchLocators.root(page)).toBeVisible();

    // Cloud IDE specific full-bleed & legacy-header removal checks
    const wbRect = await getRect(workbenchLocators.root(page));
    expect(Math.abs(wbRect.width - 1280)).toBeLessThanOrEqual(2);
    expect(wbRect.bottom).toBeGreaterThanOrEqual(798);

    for (const removedId of [
      '#header-search-btn',
      '#header-scm-btn',
      '#header-problems-btn',
      '#header-settings-btn',
      '#header-zip-btn'
    ]) {
      await expect(page.locator(removedId)).toBeHidden();
    }

    // Verify Clone/Landing modal is dismissible via Escape & Close (x) button
    await openCloneRepoUi(page);
    const cloneDialog = page
      .locator('#landing-overlay:not(.hidden), [data-cl-modal*="clone"], #cl-modal-slot [role="dialog"]')
      .first();
    await expect(cloneDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cloneDialog).toBeHidden();

    await executeElevenPointParityChecklistAudit(page);
  });
});
