import { test, expect } from '@playwright/test';
import {
  attachZeroErrorTracker,
  getActiveEditorText,
  getPublicWorkbenchFiles,
  installOfflineCdnStubs,
  openOrCreateCodeFile,
  openProblemsPanel,
  openScmSidebar,
  openSearchSidebar,
  openTerminalPanel,
  runTerminalCommand,
  seedPersistedWorkspace,
  setActiveEditorText,
  withAutoAcceptDialog,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

test.describe('Tier 1 — Search & Replace, Source Control, Problems Diagnostics & Multi-Session Terminal (F7–F10)', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page);
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F7: End-to-End Search & Replace Sidebar View (6 tests: T1-F7-01 .. T1-F7-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F7-01: Mod+Shift+F and Activity Bar Search open persistent Sidebar Search view rendering grouped file matches (zero undefined)', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f7-01',
      {
        'a.js': 'const targetToken = "alpha";\n',
        'src/b.js': '// header\nconst targetToken = "beta";\n'
      },
      { activeFile: 'a.js' }
    );
    await page.goto('/workbench?labId=t1-f7-01');

    await page.keyboard.press('ControlOrMeta+Shift+F');
    const searchView = workbenchLocators.searchView(page);
    await expect(searchView).toBeVisible();

    const searchInput = workbenchLocators.searchInput(page);
    await searchInput.fill('targetToken');
    await searchInput.press('Enter');

    await expect(searchView).toContainText('a.js');
    await expect(searchView).toContainText('src/b.js');
    const viewText = await searchView.innerText();
    expect(viewText).not.toContain('undefined');
  });

  test('T1-F7-02: Clicking a Search match opens the target file and jumps cursor to exact (line, col) WITHOUT closing Search Sidebar', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f7-02',
      {
        'a.js': 'const startHere = true;\n',
        'src/b.js': '// line 1\n// line 2\n// line 3\nconst x = jumpTargetToken;\n'
      },
      { activeFile: 'a.js', openTabs: ['a.js'] }
    );
    await page.goto('/workbench?labId=t1-f7-02');

    const searchView = await openSearchSidebar(page);
    const searchInput = workbenchLocators.searchInput(page);
    await searchInput.fill('jumpTargetToken');
    await searchInput.press('Enter');

    const matchRow = searchView
      .locator(
        ':is([data-cl-search-match], [data-cl-search-file="src/b.js"], [data-search-file="src/b.js"], .codelab-search-match, [role="treeitem"], [role="listitem"], [role="button"], button)'
      )
      .filter({ hasText: /jumpTargetToken/ })
      .first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();

    await expect(workbenchLocators.fileTab(page, 'src/b.js')).toBeVisible();
    await expect(workbenchLocators.statusCursor(page)).toContainText(/Ln\s*4\b.*Col\s*1[01]\b/i);
    // Search Sidebar MUST remain open with results preserved!
    await expect(searchView).toBeVisible();
    await expect(searchView).toContainText('jumpTargetToken');
  });

  test('T1-F7-03: Match Case (Aa), Match Whole Word (ab), and Regular Expression (.*) toggles filter search results accurately', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f7-03',
      {
        'lower.js': 'const foo = 1;\n',
        'upper.js': 'const FOO = 2;\n',
        'compound.js': 'const foobar = 3;\n',
        'digits.js': 'const foo_123 = 4;\n'
      },
      { activeFile: 'lower.js' }
    );
    await page.goto('/workbench?labId=t1-f7-03');

    const searchView = await openSearchSidebar(page);
    const searchInput = workbenchLocators.searchInput(page);
    await searchInput.fill('foo');

    // Enable Match Case (Aa): excludes FOO in upper.js
    await workbenchLocators.searchCaseToggle(page).click();
    await expect(searchView).toContainText('lower.js');
    await expect(searchView).not.toContainText('upper.js');

    // Enable Whole Word (ab): keeps only exact 'foo' in lower.js
    await workbenchLocators.searchWholeWordToggle(page).click();
    await expect(searchView).toContainText('lower.js');
    await expect(searchView).not.toContainText('compound.js');
    await expect(searchView).not.toContainText('digits.js');

    // Disable Whole Word, enable Regex (.*) with foo_\d+
    await workbenchLocators.searchWholeWordToggle(page).click();
    await workbenchLocators.searchRegexToggle(page).click();
    await searchInput.fill('foo_\\d+');
    await expect(searchView).toContainText('digits.js');
    await expect(searchView).not.toContainText('lower.js');
  });

  test('T1-F7-04: Include and Exclude glob inputs scope workspace search results', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f7-04',
      {
        'src/app.ts': 'export const SHARED_KEY = 1;\n',
        'src/app.js': 'export const SHARED_KEY = 2;\n',
        'vendor/lib.js': 'export const SHARED_KEY = 3;\n'
      },
      { activeFile: 'src/app.ts' }
    );
    await page.goto('/workbench?labId=t1-f7-04');

    const searchView = await openSearchSidebar(page);
    const detailsToggle = searchView.locator(
      '[data-cl-action*="search-files-toggle"], button[title*="files" i], button[aria-label*="files" i]'
    );
    if ((await detailsToggle.count()) > 0 && !(await workbenchLocators.searchIncludeInput(page).isVisible())) {
      await detailsToggle.first().click();
    }

    await workbenchLocators.searchInput(page).fill('SHARED_KEY');
    const includeInput = workbenchLocators.searchIncludeInput(page);
    const excludeInput = workbenchLocators.searchExcludeInput(page);
    await expect(includeInput).toBeVisible();
    await expect(excludeInput).toBeVisible();

    await includeInput.fill('src/*.ts');
    await includeInput.press('Enter');
    await expect(searchView).toContainText('src/app.ts');
    await expect(searchView).not.toContainText('src/app.js');
    await expect(searchView).not.toContainText('vendor/lib.js');

    await includeInput.fill('');
    await excludeInput.fill('vendor/**');
    await excludeInput.press('Enter');
    await expect(searchView).toContainText('src/app.ts');
    await expect(searchView).toContainText('src/app.js');
    await expect(searchView).not.toContainText('vendor/lib.js');
  });

  test('T1-F7-05: Single-match / per-file Replace updates file content and live editor buffer in place', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f7-05',
      {
        'index.js': 'const oldName = 10;\nconsole.log(oldName);\n'
      },
      { activeFile: 'index.js', openTabs: ['index.js'] }
    );
    await page.goto('/workbench?labId=t1-f7-05');

    const searchView = await openSearchSidebar(page);
    const toggleReplace = searchView.locator(
      '[data-cl-action*="toggle-replace"], button[aria-label*="Replace" i]'
    );
    if ((await toggleReplace.count()) > 0 && !(await workbenchLocators.replaceInput(page).isVisible())) {
      await toggleReplace.first().click();
    }

    await workbenchLocators.searchInput(page).fill('oldName');
    await workbenchLocators.replaceInput(page).fill('newName');

    const singleReplaceBtn = searchView
      .locator(
        '[data-cl-action="search-replace-one"], [data-cl-action="replace-match"], [data-cl-action="replace-file"], button[title*="Replace" i]:not([title*="All" i])'
      )
      .first();
    await expect(singleReplaceBtn).toBeVisible();
    await singleReplaceBtn.click();

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['index.js'])
      .toContain('newName');
    expect(await getActiveEditorText(page)).toContain('newName');
  });

  test('T1-F7-06: Replace All updates matches across 6 files WITHOUT opening unopened files as editor tabs', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f7-06',
      {
        'index.js': 'const api = "LEGACY_API";\n',
        'src/m1.js': 'export const m1 = "LEGACY_API";\n',
        'src/m2.js': 'export const m2 = "LEGACY_API";\n',
        'src/m3.js': 'export const m3 = "LEGACY_API";\n',
        'src/m4.js': 'export const m4 = "LEGACY_API";\n',
        'src/m5.js': 'export const m5 = "LEGACY_API";\n'
      },
      { activeFile: 'index.js', openTabs: ['index.js'] }
    );
    await page.goto('/workbench?labId=t1-f7-06');

    const searchView = await openSearchSidebar(page);
    if (!(await workbenchLocators.replaceInput(page).isVisible())) {
      const expandBtn = searchView
        .locator('[data-cl-action*="replace"], button[aria-label*="Replace" i]')
        .first();
      if (await expandBtn.isVisible()) await expandBtn.click();
    }

    await workbenchLocators.searchInput(page).fill('LEGACY_API');
    await workbenchLocators.replaceInput(page).fill('MODERN_API');

    const replaceAllBtn = searchView
      .locator(
        '[data-cl-action="search-replace-all"], [data-cl-action="replace-all"], #cl-search-replace-all-btn, button[title*="Replace All" i], button:has-text("Replace All")'
      )
      .first();
    await expect(replaceAllBtn).toBeVisible();
    await withAutoAcceptDialog(page, async () => {
      await replaceAllBtn.click();
    });

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['src/m5.js'])
      .toContain('MODERN_API');

    const allFiles = await getPublicWorkbenchFiles(page);
    for (const key of ['index.js', 'src/m1.js', 'src/m2.js', 'src/m3.js', 'src/m4.js', 'src/m5.js']) {
      expect(allFiles[key]).toContain('MODERN_API');
      expect(allFiles[key]).not.toContain('LEGACY_API');
    }

    const openTabs = await page.evaluate(() => (window as any).__codelabIde.getOpenTabs());
    expect(openTabs).toEqual(['index.js']);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F8: End-to-End Source Control (Git) Sidebar View (6 tests: T1-F8-01 .. T1-F8-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F8-01: Initialize Repository in a fresh non-git workspace creates /workspace/.git and transitions SCM Sidebar to active repo view', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f8-01&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'app.js', 'console.log("init repo");\n');

    const scmView = await openScmSidebar(page);
    const initBtn = scmView
      .locator('button:has-text("Initialize Repository"), [data-cl-action*="git-init"], [data-cl-action*="scm-init"]')
      .first();
    await expect(initBtn).toBeVisible();
    await initBtn.click();

    await expect(workbenchLocators.statusScmBtn(page)).toContainText(/main|master/i);
    await expect(scmView).toContainText('app.js');

    const headOut = await runTerminalCommand(page, 'cat .git/HEAD');
    expect(headOut).toMatch(/refs\/heads\/(main|master)/);
  });

  test('T1-F8-02: Stage, Unstage, and Stage All move files between Changes and Staged Changes while preserving typed commit draft', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f8-02&blank=1&empty=1');
    await runTerminalCommand(page, 'git init');
    await openOrCreateCodeFile(page, 'app.js', 'export const a = 1;\n');

    const scmView = await openScmSidebar(page);
    const commitInput = workbenchLocators.scmCommitInput(page);
    await expect(commitInput).toBeVisible();
    await commitInput.fill('feat: initial module');

    // Stage app.js
    const stageBtn = scmView
      .locator('[data-cl-action="scm-stage"], button[title*="Stage" i]:not([title*="Unstage" i]):not([title*="All" i])')
      .first();
    await expect(stageBtn).toBeVisible();
    await stageBtn.click();
    await expect(scmView).toContainText(/Staged Changes/i);
    await expect(commitInput).toHaveValue('feat: initial module');

    // Unstage app.js
    const unstageBtn = scmView
      .locator('[data-cl-action="scm-unstage"], button[title*="Unstage" i]:not([title*="All" i])')
      .first();
    await expect(unstageBtn).toBeVisible();
    await unstageBtn.click();
    await expect(commitInput).toHaveValue('feat: initial module');

    // Stage All
    const stageAllBtn = scmView
      .locator('[data-cl-action="scm-stage-all"], button[title*="Stage All" i], button:has-text("Stage All")')
      .first();
    await expect(stageAllBtn).toBeVisible();
    await stageAllBtn.click();
    await expect(scmView).toContainText(/Staged Changes/i);
    await expect(commitInput).toHaveValue('feat: initial module');
  });

  test('T1-F8-03: Clicking a modified file in Source Control opens HEAD vs working-tree Diff view in the Editor area', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f8-03&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'app.js', 'const version = "v1_head";\n');
    await runTerminalCommand(page, 'git init && git add app.js && git commit -m "init v1"');

    await openOrCreateCodeFile(page, 'app.js');
    await setActiveEditorText(page, 'const version = "v2_working_tree";\n');

    const scmView = await openScmSidebar(page);
    const fileEntry = scmView
      .locator(':is([data-cl-scm-file="app.js"], .codelab-scm-item, [role="listitem"])')
      .filter({ hasText: 'app.js' })
      .first();
    await expect(fileEntry).toBeVisible();
    await fileEntry.click();

    const editorArea = workbenchLocators.editorCol(page);
    await expect(editorArea).toContainText('v1_head');
    await expect(editorArea).toContainText('v2_working_tree');
    await expect(scmView).toBeVisible();
  });

  test('T1-F8-04: Committing staged changes clears status badge, updates HEAD, and appends to Commit Log', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f8-04&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'app.js', 'export const v = 2;\n');
    await runTerminalCommand(page, 'git init && git add app.js');

    const scmView = await openScmSidebar(page);
    const commitInput = workbenchLocators.scmCommitInput(page);
    await commitInput.fill('fix: update v2');
    await workbenchLocators.scmCommitBtn(page).click();

    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getGitStatus())).length)
      .toBe(0);

    await expect(scmView).toContainText('fix: update v2');
  });

  test('T1-F8-05: Branch creation and switching via SCM Sidebar / Status Bar updates Git branch state', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f8-05&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'app.js', 'const x = 1;\n');
    await runTerminalCommand(page, 'git init && git add app.js && git commit -m "init"');

    // Create & switch branch via UI branch control if interactive picker opens, or CLI synced to Status Bar & SCM
    const branchBtn = workbenchLocators.statusScmBtn(page);
    await expect(branchBtn).toBeVisible();
    await branchBtn.click();

    const paletteInput = workbenchLocators.paletteInput(page);
    if (await paletteInput.isVisible().catch(() => false)) {
      await paletteInput.fill('feat/ui');
      await paletteInput.press('Enter');
    } else {
      await runTerminalCommand(page, 'git checkout -b feat/ui');
    }

    await expect(workbenchLocators.statusScmBtn(page)).toContainText('feat/ui');
    const scmView = await openScmSidebar(page);
    await expect(scmView).toContainText('feat/ui');
  });

  test('T1-F8-06: Full CLI git <-> GUI Source Control bidirectional synchronization', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f8-06&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'a.js', 'const a = 1;\n');
    await openOrCreateCodeFile(page, 'b.js', 'const b = 1;\n');
    await runTerminalCommand(page, 'git init && git add . && git commit -m "base"');

    await openOrCreateCodeFile(page, 'a.js');
    await setActiveEditorText(page, 'const a = 2;\n');
    await openOrCreateCodeFile(page, 'b.js');
    await setActiveEditorText(page, 'const b = 2;\n');

    // Stage ONLY a.js via CLI git add
    await runTerminalCommand(page, 'git add a.js');

    const scmView = await openScmSidebar(page);
    await expect(scmView).toContainText(/Staged Changes/i);
    await expect(scmView).toContainText('a.js');
    await expect(scmView).toContainText('b.js');

    // Commit staged a.js from GUI
    await workbenchLocators.scmCommitInput(page).fill('feat: gui commit from cli stage');
    await workbenchLocators.scmCommitBtn(page).click();

    const logOut = await runTerminalCommand(page, 'git log -n 1');
    expect(logOut).toContain('feat: gui commit from cli stage');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F9: End-to-End Problems Panel & Live Diagnostics (5 tests: T1-F9-01 .. T1-F9-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F9-01: .codelab/settings.json schema validation populates Bottom Panel Problems & Status Bar badge without modal', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f9-01');
    await openOrCreateCodeFile(
      page,
      '.codelab/settings.json',
      '{\n  "editor.fontSize": "not-a-number"\n}\n'
    );

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('.codelab/settings.json');
    await expect(drawerBody).toContainText(/editor\.fontSize/i);
    await expect(workbenchLocators.statusProblemsBtn(page)).toContainText(/[1-9]/);
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  });

  test('T1-F9-02: Live Python & C++ static linters emit diagnostics on initial mount and code edits (180ms debounce)', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't1-f9-02',
      {
        'bad.py': 'def broken(:\n    pass\n',
        'index.js': 'console.log("ok");\n'
      },
      { activeFile: 'index.js', openTabs: ['index.js'] }
    );
    await page.goto('/workbench?labId=t1-f9-02');

    // 1. Verify initial-mount background indexing on seeded broken .py file
    await expect
      .poll(async () => {
        const diags = await page.evaluate(() => (window as any).__codelabIde.getDiagnostics());
        return diags.some((d: any) => d.file === 'bad.py');
      })
      .toBe(true);

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('bad.py');

    // 2. Open/create bad.cpp and type invalid C++ in editor to exercise live-edit debounced linting
    await openOrCreateCodeFile(page, 'bad.cpp', '');
    await setActiveEditorText(page, 'int main() {\n  return 0\n');

    await expect
      .poll(async () => {
        const diags = await page.evaluate(() => (window as any).__codelabIde.getDiagnostics());
        return diags.some((d: any) => d.file === 'bad.cpp');
      })
      .toBe(true);

    await expect(drawerBody).toContainText('bad.py');
    await expect(drawerBody).toContainText('bad.cpp');
  });

  test('T1-F9-03: SQL query syntax/engine errors populate Problems panel and clear automatically when fixed & re-run', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f9-03&lang=sql');
    await openOrCreateCodeFile(page, 'query.sql');
    await setActiveEditorText(page, 'SELEC * FORM missing_table;');

    await page.evaluate(() => (window as any).__codelabIde.runSql('run'));
    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('query.sql');

    // Fix SQL and re-run -> SQL diagnostic clears
    await openOrCreateCodeFile(page, 'query.sql');
    await setActiveEditorText(page, 'SELECT 1 AS ok;');
    await page.evaluate(() => (window as any).__codelabIde.runSql('run'));

    await expect
      .poll(async () => {
        const diags = await page.evaluate(() => (window as any).__codelabIde.getDiagnostics());
        return diags.filter((d: any) => d.file === 'query.sql').length;
      })
      .toBe(0);
  });

  test('T1-F9-04: Clicking a diagnostic row in Problems opens the file and jumps cursor to exact (line, col)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f9-04');
    await openOrCreateCodeFile(
      page,
      'src/service.py',
      '# line 1\n# line 2\n# line 3\n# line 4\ndef fail()\n    return 0\n'
    );
    await openOrCreateCodeFile(page, 'index.js');
    await expect
      .poll(async () => {
        const diags = await page.evaluate(() => (window as any).__codelabIde.getDiagnostics());
        return diags.some((d: any) => d.file === 'src/service.py');
      })
      .toBe(true);

    const drawerBody = await openProblemsPanel(page);
    const row = drawerBody
      .locator(':is(.codelab-problem-item, [data-cl-problem-file="src/service.py"], [data-cl-diag-file="src/service.py"])')
      .filter({ hasText: /service\.py|SyntaxError|expected|bracket/i })
      .first();
    await expect(row).toBeVisible();
    await row.click();

    await expect(workbenchLocators.fileTab(page, 'src/service.py')).toBeVisible();
    await expect(workbenchLocators.statusCursor(page)).toContainText(/Ln\s*5\b/i);
  });

  test('T1-F9-05: Problems severity (Errors / Warnings) and text filter controls filter displayed rows', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f9-05');
    // Error in alpha.py (unclosed bracket / missing colon)
    await openOrCreateCodeFile(page, 'alpha.py', 'def broken()\n    return 1\n');
    // Warning in beta.cpp (unknown header)
    await openOrCreateCodeFile(
      page,
      'beta.cpp',
      '#include <unknown_warning_hdr.hpp>\nint main() { return 0; }\n'
    );
    await expect
      .poll(async () => {
        const diags = await page.evaluate(() => (window as any).__codelabIde.getDiagnostics());
        return (
          diags.some((d: any) => d.file === 'alpha.py') &&
          diags.some((d: any) => d.file === 'beta.cpp')
        );
      })
      .toBe(true);

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('alpha.py');
    await expect(drawerBody).toContainText('beta.cpp');

    const filterInput = page
      .locator(
        '#cl-drawer :is([data-cl-problems-filter], #cl-problems-filter, input[placeholder*="Filter" i])'
      )
      .first();
    await expect(filterInput).toBeVisible();
    await filterInput.fill('beta');
    await expect(drawerBody).toContainText('beta.cpp');
    await expect(drawerBody).not.toContainText('alpha.py');

    await filterInput.fill('');
    const errorsFilterBtn = page
      .locator(
        '#cl-drawer :is([data-cl-severity-filter="error"], [data-problems-severity="error"], button:has-text("Errors"))'
      )
      .first();
    if (await errorsFilterBtn.isVisible()) {
      await errorsFilterBtn.click();
      await expect(drawerBody).toContainText('alpha.py');
      await expect(drawerBody).not.toContainText('beta.cpp');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F10: Multi-Session Terminal Panel (5 tests: T1-F10-01 .. T1-F10-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T1-F10-01: Interactive Terminal executes POSIX shell commands (pwd, echo, node) and syncs VFS files created via shell', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f10-01');

    const pwdOut = await runTerminalCommand(page, 'pwd');
    expect(pwdOut).toContain('/workspace');

    const nodeOut = await runTerminalCommand(
      page,
      'echo "module.exports = { x: 77 };" > generated.js && node -e "console.log(\'VAL=\' + require(\'./generated.js\').x)"'
    );
    expect(nodeOut).toContain('VAL=77');

    await expect(workbenchLocators.fileItem(page, 'generated.js')).toBeVisible();
    expect((await getPublicWorkbenchFiles(page))['generated.js']).toContain('77');
  });

  test('T1-F10-02: Multi-session Terminal (+ / Ctrl+Shift+`) isolates cwd, logs, inRepl, and replHistory per session', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f10-02');
    await runTerminalCommand(page, 'mkdir -p sub && cd sub && pwd');
    await expect(workbenchLocators.terminalLog(page)).toContainText('/workspace/sub');

    const newSessionBtn = workbenchLocators.newTerminalBtn(page);
    await expect(newSessionBtn).toBeVisible();
    await newSessionBtn.click();

    // Session 2 must start in fresh /workspace cwd with clean logs
    const s2Out = await runTerminalCommand(page, 'pwd');
    const lines = s2Out.trim().split('\n').map((l) => l.trim());
    expect(lines).toContain('/workspace');
    expect(s2Out).not.toContain('mkdir -p sub');

    // Switch back to Session 1 and confirm its cwd (/workspace/sub) & logs were preserved
    const pills = workbenchLocators.terminalSessionPills(page);
    expect(await pills.count()).toBeGreaterThanOrEqual(2);
    await pills.first().click();

    await expect(workbenchLocators.terminalLog(page)).toContainText('mkdir -p sub');
    const s1Pwd = await runTerminalCommand(page, 'pwd');
    expect(s1Pwd).toContain('/workspace/sub');
  });

  test('T1-F10-03: Closing a secondary Terminal session removes session pill and activates remaining session cleanly', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f10-03');
    await runTerminalCommand(page, 'echo "SESSION_ONE_MARKER"');

    await workbenchLocators.newTerminalBtn(page).click();
    await runTerminalCommand(page, 'echo "SESSION_TWO_MARKER"');
    expect(await workbenchLocators.terminalSessionPills(page).count()).toBe(2);

    const closeBtn = workbenchLocators.closeTerminalSessionBtns(page).last();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    expect(await workbenchLocators.terminalSessionPills(page).count()).toBe(1);
    await expect(workbenchLocators.terminalLog(page)).toContainText('SESSION_ONE_MARKER');
  });

  test('T1-F10-04: Terminal-specific header actions (#cl-terminal-sessions, +, Ctrl+C) hide when switching to non-terminal tabs', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f10-04');
    await openTerminalPanel(page);
    await expect(workbenchLocators.newTerminalBtn(page)).toBeVisible();

    await workbenchLocators.drawerTab(page, 'problems').click();
    await expect(workbenchLocators.newTerminalBtn(page)).toBeHidden();
    await expect(page.locator('#cl-drawer #cl-terminal-sessions')).toBeHidden();

    await workbenchLocators.drawerTab(page, 'ports').click();
    await expect(workbenchLocators.newTerminalBtn(page)).toBeHidden();

    await workbenchLocators.drawerTab(page, 'terminal').click();
    await expect(workbenchLocators.newTerminalBtn(page)).toBeVisible();
  });

  test('T1-F10-05: Terminal Tab completion completes expanded built-in commands (python3, git, clang++) and workspace filenames', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t1-f10-05');
    const termSurface = await openTerminalPanel(page);
    await termSurface.click();

    const replInput = workbenchLocators.replInput(page);
    await replInput.focus();
    await page.keyboard.type('pyth');
    await page.keyboard.press('Tab');
    await expect(replInput).toHaveValue(/^python3\s*$/);

    await replInput.fill('');
    await page.keyboard.type('cat ind');
    await page.keyboard.press('Tab');
    await expect(replInput).toHaveValue(/^cat index\.js\s*$/);
  });
});
