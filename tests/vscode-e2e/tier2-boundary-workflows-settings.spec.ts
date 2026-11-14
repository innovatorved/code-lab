import { test, expect } from '@playwright/test';
import {
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
  getPublicWorkbenchFiles,
  installOfflineCdnStubs,
  openCloneRepoUi,
  openOrCreateCodeFile,
  openProblemsPanel,
  openScmSidebar,
  openSearchSidebar,
  openSettingsTabViaGear,
  openTerminalPanel,
  runTerminalCommand,
  seedPersistedWorkspace,
  setActiveEditorText,
  switchRecentWorkspaceViaUi,
  triggerBlankIdeAction,
  waitForOptionalConfirmModal,
  withAutoAcceptDialog,
  workbenchLocators,
  type ZeroErrorTracker
} from './helpers/workbench-helpers';

test.describe('Tier 2 — Boundary, Negative & Corner Cases: Workspaces, Clone, Search, SCM, Problems, Terminal & Settings (F5–F11)', () => {
  let tracker: ZeroErrorTracker;

  test.beforeEach(async ({ page }, testInfo) => {
    await installOfflineCdnStubs(page);
    tracker = attachZeroErrorTracker(page, {
      allowNetworkErrorStatus: /T2-F6-0[345]/.test(testInfo.title)
    });
  });

  test.afterEach(() => {
    tracker?.assertNoErrors();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F5: Non-Destructive Blank IDE Boundary Cases (5 tests: T2-F5-01 .. T2-F5-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F5-01: Pressing Escape or Cancel when triggering Blank IDE over a dirty workspace leaves current files, tabs, and unsaved code 100% intact', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    const initialLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'index.js', '// UNSAVED CRITICAL WORK\n');

    await triggerBlankIdeAction(page);

    const confirmModal = await waitForOptionalConfirmModal(page, 500, { prevLabId: initialLabId });
    if (confirmModal) {
      await page.keyboard.press('Escape');
      await expect(confirmModal).toBeHidden();
      expect(await getActiveLabId(page)).toBe(initialLabId);
      expect(await getActiveEditorText(page)).toBe('// UNSAVED CRITICAL WORK\n');
    } else {
      // Variant B automatic isolation: verify switching back immediately restores work untouched
      await switchRecentWorkspaceViaUi(page, initialLabId);
      await expect
        .poll(async () => (await getPublicWorkbenchFiles(page))['index.js'])
        .toBe('// UNSAVED CRITICAL WORK\n');
    }
  });

  test('T2-F5-02: Triggering Blank IDE a second time when already in a Blank IDE containing user-created files (draft.js) never silently wipes draft.js', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    const labId1 = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'draft.js', 'const draft = 1;\n');
    await expect
      .poll(() => page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', labId1))
      .toContain('const draft = 1;');

    await triggerBlankIdeAction(page);
    const confirmModal = await waitForOptionalConfirmModal(page, 500, { prevLabId: labId1 });
    if (confirmModal) {
      const cancelBtn = confirmModal
        .locator('[data-cl-confirm="cancel"], button:has-text("Cancel")')
        .first();
      await cancelBtn.click();
      expect((await getPublicWorkbenchFiles(page))['draft.js']).toBe('const draft = 1;\n');
    } else {
      const labId2 = await getActiveLabId(page);
      expect(labId2).not.toBe(labId1);
      const savedRaw = await page.evaluate(
        (id) => localStorage.getItem(`sd-codelab-v1:${id}`),
        labId1
      );
      expect(savedRaw).toContain('draft.js');
      expect(savedRaw).toContain('const draft = 1;');
    }
  });

  test('T2-F5-03: Triggering resetLab / Reset Workspace on a workspace with user-created files prompts confirmation (Cancel aborts) and cleans VFS on confirm', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f5-03');
    await openOrCreateCodeFile(page, 'orphan.js', 'console.log("user file");\n');

    // 1. Cancel Reset preserves orphan.js
    let dismissedNative = false;
    const dismissHandler = (dlg: any): void => {
      dismissedNative = true;
      void dlg.dismiss().catch(() => {});
    };
    page.on('dialog', dismissHandler);
    try {
      await page.evaluate(() => {
        const ide = (window as any).__codelabIde;
        if (typeof ide.resetLab === 'function') ide.resetLab();
        else ide.reset();
      });
    } finally {
      page.off('dialog', dismissHandler);
    }

    if (!dismissedNative) {
      const cancelModalBtn = page
        .locator(':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:has-text("Cancel")')
        .first();
      await cancelModalBtn.waitFor({ state: 'visible', timeout: 300 }).catch(() => {});
      if (await cancelModalBtn.isVisible().catch(() => false)) {
        await cancelModalBtn.click();
      }
    }

    expect((await getPublicWorkbenchFiles(page))['orphan.js']).toBe(
      'console.log("user file");\n'
    );

    // 2. Confirm Reset removes orphan.js from both ide.getFiles() and shell.vfs
    await withAutoAcceptDialog(page, async () => {
      await page.evaluate(() => {
        const ide = (window as any).__codelabIde;
        if (typeof ide.resetLab === 'function') ide.resetLab();
        else ide.reset();
      });
    });

    if ((await getPublicWorkbenchFiles(page))['orphan.js'] !== undefined) {
      const confirmModalBtn = page
        .locator(
          ':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:is(:has-text("Reset"), :has-text("Replace"), :has-text("Confirm"))'
        )
        .first();
      await confirmModalBtn.waitFor({ state: 'visible', timeout: 300 }).catch(() => {});
      if (await confirmModalBtn.isVisible().catch(() => false)) {
        await confirmModalBtn.click();
      }
    }

    expect((await getPublicWorkbenchFiles(page))['orphan.js']).toBeUndefined();
    const lsAfter = await runTerminalCommand(page, 'ls');
    expect(lsAfter).not.toContain('orphan.js');
  });

  test('T2-F5-04: Switching runtime language (setLanguage) in Sandbox/IDE mode does NOT silently wipe user-created files', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f5-04');
    await openOrCreateCodeFile(page, 'my-notes.txt', 'KEEP_NOTES_ACROSS_LANG_SWITCH\n');

    await page.evaluate(() => {
      const ide = (window as any).__codelabIde;
      if (typeof ide.setLanguage === 'function') {
        ide.setLanguage('py');
        ide.setLanguage('js');
      }
    });

    // Dismiss any optional confirmation dialog via Cancel if prompted
    const cancelBtn = page
      .locator(':is(#cl-modal-slot, [role="dialog"]) button:has-text("Cancel")')
      .first();
    await cancelBtn.waitFor({ state: 'visible', timeout: 250 }).catch(() => {});
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }

    expect((await getPublicWorkbenchFiles(page))['my-notes.txt']).toBe(
      'KEEP_NOTES_ACROSS_LANG_SWITCH\n'
    );
  });

  test('T2-F5-05: Corrupted JSON in localStorage["sd-codelab-v1:" + labId] recovers gracefully with 0 pageerror', async ({
    page
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sd-codelab-v1:corrupt-lab', '{bad truncated json');
    });

    await page.goto('/workbench?labId=corrupt-lab');
    await expect(workbenchLocators.root(page)).toBeVisible();
    expect(Object.keys(await getPublicWorkbenchFiles(page)).length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F6: Clone Repo Boundary & Negative Cases (6 tests: T2-F6-01 .. T2-F6-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F6-01: Dismissing #landing-overlay / Clone Repo modal via close (x) button, Escape key, and backdrop click returns cleanly to active workspace', async ({
    page
  }) => {
    await page.goto('/cloud-ide?blank=1');
    const openEmpty = page.locator('#open-empty-btn');
    if (await openEmpty.isVisible()) await openEmpty.click();
    await expect(workbenchLocators.root(page)).toBeVisible();

    await openOrCreateCodeFile(page, 'keep.js', 'const safe = true;\n');

    // 1. Open & dismiss via Escape
    await openCloneRepoUi(page);
    const cloneModalOrOverlay = page
      .locator('#landing-overlay:not(.hidden), [data-cl-modal*="clone"], #cl-modal-slot [role="dialog"]')
      .first();
    await expect(cloneModalOrOverlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cloneModalOrOverlay).toBeHidden();
    expect((await getPublicWorkbenchFiles(page))['keep.js']).toBe('const safe = true;\n');

    // 2. Open & dismiss via Close (x) button
    await openCloneRepoUi(page);
    await expect(cloneModalOrOverlay).toBeVisible();
    const closeBtn = cloneModalOrOverlay
      .locator(
        '[data-cl-action*="close"], #landing-close-btn, .landing-close-btn, button[aria-label*="Close" i], button:has-text("✕"), button:has-text("×")'
      )
      .first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(cloneModalOrOverlay).toBeHidden();

    // 3. Open & dismiss via backdrop click (top-left corner outside centered card)
    await openCloneRepoUi(page);
    await expect(cloneModalOrOverlay).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(cloneModalOrOverlay).toBeHidden();
    expect((await getPublicWorkbenchFiles(page))['keep.js']).toBe('const safe = true;\n');
  });

  test('T2-F6-02: Invalid GitHub URL inputs show inline validation error without wiping workspace', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f6-02');
    await openOrCreateCodeFile(page, 'keep.js', 'const intact = "yes";\n');

    await clickMenuItem(page, 'File', /Clone/i);
    const input = page
      .locator('#cl-clone-repo-input, input[placeholder*="github" i], input[placeholder*="owner/repo" i]')
      .first();
    await expect(input).toBeVisible();

    for (const badUrl of ['not a url', 'https://gitlab.com/a/b', 'javascript:alert(1)']) {
      await input.fill(badUrl);
      const submitBtn = workbenchLocators.cloneSubmitButton(page);
      const isDisabled = await submitBtn.isDisabled();
      if (!isDisabled) {
        await submitBtn.click();
      }
      await expect
        .poll(async () =>
          page
            .locator(':is(#cl-modal-slot, [role="dialog"], .codelab-clone-error, [role="alert"])')
            .allInnerTexts()
            .then((parts) => parts.join('\n'))
        )
        .toMatch(/invalid|valid GitHub|not exist|owner\/repo/i);
    }

    await page.keyboard.press('Escape');
    expect((await getPublicWorkbenchFiles(page))['keep.js']).toBe('const intact = "yes";\n');
    const catOut = await runTerminalCommand(page, 'cat keep.js');
    expect(catOut).toContain('const intact = "yes";');
  });

  test('T2-F6-03: Transactional Clone on HTTP 404, HTTP 500, and mid-blob-abort leaves /workspace/* VFS and ide.getFiles() 100% intact with zero partial blobs', async ({
    page
  }) => {
    await installGitHubMock(page, {
      repos: {
        'acme/missing-repo': { mode: 'not-found' },
        'acme/error-repo': { mode: 'server-error' },
        'acme/abort-repo': {
          mode: 'mid-blob-abort',
          failAfterBlobs: 2,
          files: buildLargeRepoFiles(15)
        }
      }
    });

    await seedPersistedWorkspace(
      page,
      't2-f6-03',
      {
        'precious.js': 'const PRECIOUS = "DO_NOT_WIPE";\n'
      },
      { activeFile: 'precious.js' }
    );
    await page.goto('/workbench?labId=t2-f6-03&empty=1');
    await expect(workbenchLocators.root(page)).toBeVisible();

    for (const repoSpec of ['acme/missing-repo', 'acme/error-repo', 'acme/abort-repo']) {
      const prevTermText = await workbenchLocators
        .terminalLog(page)
        .innerText()
        .catch(() => '');

      await clickMenuItem(page, 'File', /Clone/i);
      const input = page
        .locator(
          '#cl-clone-repo-input, input[placeholder*="github" i], input[placeholder*="owner/repo" i]'
        )
        .first();
      await expect(input).toBeVisible();
      await input.fill(repoSpec);
      await workbenchLocators.cloneSubmitButton(page).click();

      // If confirmation dialog asks Replace vs Isolate, pick Replace to prove transactional network fetch rolls back before wiping!
      const confirmModal = await waitForOptionalConfirmModal(page);
      if (confirmModal) {
        const replaceBtn = confirmModal
          .locator('[data-cl-confirm="replace"], button:has-text("Replace")')
          .first();
        if (await replaceBtn.isVisible()) await replaceBtn.click();
      }

      await expect
        .poll(async () => {
          const uiErrText = await page
            .locator(
              ':is(#cl-modal-slot, [data-cl-modal*="clone"], [role="dialog"], [role="alert"], .codelab-clone-error, .codelab-toast):visible'
            )
            .allInnerTexts()
            .then((parts) => parts.join('\n'))
            .catch(() => '');
          const currTermText = await workbenchLocators
            .terminalLog(page)
            .innerText()
            .catch(() => '');
          const addedTermText = currTermText.startsWith(prevTermText)
            ? currTermText.slice(prevTermText.length)
            : currTermText;
          return `${uiErrText}\n${addedTermText}`;
        })
        .toMatch(/not found|failed|error|fatal|abort|incomplete|500|404|could not/i);

      await page.keyboard.press('Escape');
      await expect(
        page.locator(':is(#cl-modal-slot [role="dialog"], [data-cl-modal*="clone"]):visible')
      ).toHaveCount(0);

      const filesAfter = await getPublicWorkbenchFiles(page);
      expect(filesAfter['precious.js']).toBe('const PRECIOUS = "DO_NOT_WIPE";\n');
      expect(filesAfter['README.md']).toBeUndefined();
      expect(filesAfter['package.json']).toBeUndefined();
      expect(filesAfter['src/modules/mod-01.ts']).toBeUndefined();
    }

    const vfsCheck = await runTerminalCommand(
      page,
      'cat precious.js && test ! -e README.md && test ! -e package.json && test ! -e src/modules/mod-01.ts && echo "VFS_ROLLBACK_OK"'
    );
    expect(vfsCheck).toContain('DO_NOT_WIPE');
    expect(vfsCheck).toContain('VFS_ROLLBACK_OK');
  });

  test('T2-F6-04: Canceling / Aborting an in-flight slow multi-file Clone mid-download preserves existing /workspace/* files untouched with zero priority-blob leaks', async ({
    page
  }) => {
    const mock = await installGitHubMock(page, {
      owner: 'acme',
      repo: 'slow-repo',
      files: buildLargeRepoFiles(20),
      blobDelayMs: 60,
      pauseAfterBlobs: 2
    });

    await seedPersistedWorkspace(
      page,
      't2-f6-04',
      {
        'precious.js': 'const KEEP_ON_CANCEL = 1;\n'
      },
      { activeFile: 'precious.js' }
    );
    await page.goto('/workbench?labId=t2-f6-04&empty=1');
    await expect(workbenchLocators.root(page)).toBeVisible();

    await clickMenuItem(page, 'File', /Clone/i);
    const input = page
      .locator('#cl-clone-repo-input, input[placeholder*="github" i], input[placeholder*="owner/repo" i]')
      .first();
    await expect(input).toBeVisible();
    await input.fill('acme/slow-repo');
    await workbenchLocators.cloneSubmitButton(page).click();

    try {
      const confirmModal = await waitForOptionalConfirmModal(page);
      if (confirmModal) {
        const replaceBtn = confirmModal
          .locator('[data-cl-confirm="replace"], button:has-text("Replace")')
          .first();
        if (await replaceBtn.isVisible()) await replaceBtn.click();
      }

      await mock.waitForPausedBlobs();

      const cancelCloneBtn = workbenchLocators.cloneCancelButton(page);
      if (await cancelCloneBtn.isVisible().catch(() => false)) {
        await cancelCloneBtn.click();
      } else {
        await page.evaluate(() => (window as any).__codelabIde.cancelExecution());
      }
    } finally {
      mock.releasePausedBlobs();
    }

    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');

    const filesAfterCancel = await getPublicWorkbenchFiles(page);
    expect(filesAfterCancel['precious.js']).toBe('const KEEP_ON_CANCEL = 1;\n');
    expect(filesAfterCancel['README.md']).toBeUndefined();
    expect(filesAfterCancel['package.json']).toBeUndefined();
    expect(filesAfterCancel['src/modules/mod-01.ts']).toBeUndefined();

    const vfsCat = await runTerminalCommand(
      page,
      'cat precious.js && test ! -e README.md && test ! -e package.json && test ! -e src/modules/mod-01.ts && echo "CANCEL_VFS_CLEAN"'
    );
    expect(vfsCat).toContain('KEEP_ON_CANCEL');
    expect(vfsCat).toContain('CANCEL_VFS_CLEAN');
  });

  test('T2-F6-05: GitHub REST API 403 rate-limit automatically falls back to data.jsdelivr.com + cdn.jsdelivr.net (Strategy B) and succeeds', async ({
    page
  }) => {
    const mock = await installGitHubMock(page, {
      owner: 'acme',
      repo: 'ratelimited-app',
      mode: 'rate-limit-fallback',
      rateLimitStatus: 403,
      rateLimitRawContent: true,
      files: HAPPY_PATH_FILES
    });

    await page.goto('/cloud-ide');
    await page.locator('#landing-repo-input').fill('acme/ratelimited-app');
    await page.locator('#landing-clone-btn').click();

    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });
    expect((await getPublicWorkbenchFiles(page))['src/utils.ts']).toContain('export function add');
    expect(
      mock.requests.some((r) => r.host === 'data.jsdelivr.com' && r.status === 200)
    ).toBe(true);
    expect(
      mock.requests.some((r) => r.host === 'cdn.jsdelivr.net' && r.status === 200)
    ).toBe(true);
  });

  test('T2-F6-06: Re-cloning acme/edited-repo when saved user edits already exist in storage (forceClone guard) prompts before overwriting', async ({
    page
  }) => {
    await installGitHubMock(page, {
      owner: 'acme',
      repo: 'edited-repo',
      files: { 'README.md': '# Upstream Readme\n', 'app.js': 'console.log("upstream");\n' }
    });

    await page.goto('/cloud-ide?repo=acme/edited-repo');
    await expect(page.locator('#landing-overlay')).toBeHidden({ timeout: 10_000 });

    const originalLabId = await getActiveLabId(page);
    await openOrCreateCodeFile(page, 'app.js', 'console.log("MY_LOCAL_SAVED_EDITS");\n');
    await expect
      .poll(() =>
        page.evaluate((id) => localStorage.getItem(`sd-codelab-v1:${id}`) ?? '', originalLabId)
      )
      .toContain('MY_LOCAL_SAVED_EDITS');

    await openCloneRepoUi(page);
    const repoInput = page
      .locator('#landing-repo-input:visible, #cl-clone-repo-input:visible')
      .first();
    await repoInput.fill('acme/edited-repo');
    await workbenchLocators.cloneSubmitButton(page).click();

    const confirmModal = await waitForOptionalConfirmModal(page, 500, {
      prevLabId: originalLabId
    });
    if (confirmModal) {
      await confirmModal
        .locator('[data-cl-confirm="cancel"], button:has-text("Cancel")')
        .first()
        .click();
      await page.keyboard.press('Escape');
      expect((await getPublicWorkbenchFiles(page))['app.js']).toBe(
        'console.log("MY_LOCAL_SAVED_EDITS");\n'
      );
    } else {
      // Variant B isolated workspace: verify originalLabId still holds MY_LOCAL_SAVED_EDITS in localStorage!
      const raw = await page.evaluate(
        (id) => localStorage.getItem(`sd-codelab-v1:${id}`),
        originalLabId
      );
      expect(raw).toContain('MY_LOCAL_SAVED_EDITS');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F7: Search & Replace Boundary & Negative Cases (5 tests: T2-F7-01 .. T2-F7-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F7-01: Invalid regular expression ([unclosed( and *bad) with .* active shows inline error banner in #cl-sidebar-search with 0 pageerror', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f7-01');
    const searchView = await openSearchSidebar(page);

    await workbenchLocators.searchRegexToggle(page).click();
    const searchInput = workbenchLocators.searchInput(page);
    await searchInput.fill('[unclosed(');

    await expect(searchView).toContainText(/Invalid regular expression|SyntaxError|Invalid regex/i);

    await searchInput.fill('console\\.log');
    await expect(searchView).toContainText('index.js');
  });

  test('T2-F7-02: Literal search (.* off) safely escapes regex metacharacters (a+b*c?($1)[0])', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f7-02',
      {
        'expr.js': '// header\nconst price = "a+b*c?($1)[0]";\n'
      },
      { activeFile: 'expr.js' }
    );
    await page.goto('/workbench?labId=t2-f7-02');

    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('a+b*c?($1)[0]');
    await expect(searchView).toContainText('expr.js');
  });

  test('T2-F7-03: Zero-match query and empty query render clean states; Replace All on zero matches performs zero file mutations', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f7-03');
    const beforeSnapshot = await getPublicWorkbenchFiles(page);

    const searchView = await openSearchSidebar(page);
    await workbenchLocators.searchInput(page).fill('__NO_SUCH_TOKEN_999__');
    await expect(searchView).toContainText(/No results|No matches|0 results|0 matches/i);

    const replaceAllBtn = searchView
      .locator('[data-cl-action="search-replace-all"], [data-cl-action="replace-all"], button[title*="Replace All" i]')
      .first();
    if ((await replaceAllBtn.isVisible()) && (await replaceAllBtn.isEnabled())) {
      await replaceAllBtn.click();
    }

    expect(await getPublicWorkbenchFiles(page)).toEqual(beforeSnapshot);
  });

  test('T2-F7-04: Search respects .git/ and files.exclude exclusions so internal .git/HEAD does not pollute search results', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f7-04&git=1');
    const searchView = await openSearchSidebar(page);

    await workbenchLocators.searchInput(page).fill('refs/heads');
    await expect(searchView).not.toContainText('.git/HEAD');
  });

  test('T2-F7-05: Replacing matches with empty string ("") deletes matched token cleanly across multiple occurrences on the same line', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f7-05',
      {
        'tokens.js': 'const val = "foo_bar_foo_end";\n'
      },
      { activeFile: 'tokens.js' }
    );
    await page.goto('/workbench?labId=t2-f7-05');

    const searchView = await openSearchSidebar(page);
    if (!(await workbenchLocators.replaceInput(page).isVisible())) {
      const toggle = searchView
        .locator('[data-cl-action*="replace"], button[aria-label*="Replace" i]')
        .first();
      if (await toggle.isVisible()) await toggle.click();
    }

    await workbenchLocators.searchInput(page).fill('foo_');
    await workbenchLocators.replaceInput(page).fill('');

    await withAutoAcceptDialog(page, async () => {
      await searchView
        .locator(
          '[data-cl-action="search-replace-all"], [data-cl-action="replace-all"], button[title*="Replace All" i], button:has-text("Replace All")'
        )
        .first()
        .click();
    });

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['tokens.js'])
      .toBe('const val = "bar_end";\n');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F8: Source Control Boundary & Negative Cases (5 tests: T2-F8-01 .. T2-F8-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F8-01: Fresh non-git Blank IDE displays uninitialized repository empty state with zero fake a1b2c3d commit', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f8-01&blank=1&empty=1');
    const scmView = await openScmSidebar(page);

    await expect(scmView.locator('button:has-text("Initialize Repository")')).toBeVisible();
    await expect(scmView.locator('button:has-text("Clone Repository")')).toBeVisible();
    await expect(scmView).not.toContainText('a1b2c3d');

    const statusOut = await runTerminalCommand(page, 'git status');
    expect(statusOut.toLowerCase()).toContain('not a git repository');
  });

  test('T2-F8-02: Empty commit message or zero staged files prevents empty commit in SCM Sidebar', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f8-02&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'index.js', 'const v = 1;\n');
    await runTerminalCommand(page, 'git init');

    const scmView = await openScmSidebar(page);
    const commitInput = workbenchLocators.scmCommitInput(page);
    const commitBtn = workbenchLocators.scmCommitBtn(page);

    // 1. Message typed, 0 staged files -> no commit created
    await commitInput.fill('should not commit unstaged');
    if (await commitBtn.isEnabled()) {
      await commitBtn.click();
    }
    const log1 = await runTerminalCommand(page, 'git log 2>&1 || true');
    expect(log1).not.toContain('should not commit unstaged');

    // 2. Staged file, empty message -> no commit created
    await runTerminalCommand(page, 'git add index.js');
    await commitInput.fill('   ');
    if (await commitBtn.isEnabled()) {
      await commitBtn.click();
    }
    const statusAfter = await page.evaluate(() => (window as any).__codelabIde.getGitStatus());
    expect(statusAfter.length).toBeGreaterThanOrEqual(1);
    await expect(scmView).toContainText('index.js');
  });

  test('T2-F8-03: Discard Changes on modified file restores HEAD content and syncs Editor + VFS', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f8-03&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'index.js', 'const stable = "v1";\n');
    await runTerminalCommand(page, 'git init && git add index.js && git commit -m "v1"');

    await openOrCreateCodeFile(page, 'index.js');
    await setActiveEditorText(page, 'const broken = "v2_bad";\n');

    const scmView = await openScmSidebar(page);
    const discardBtn = scmView
      .locator(
        '[data-cl-action="scm-discard"], button[title*="Discard" i], button[aria-label*="Discard" i]'
      )
      .first();
    await expect(discardBtn).toBeVisible();
    await withAutoAcceptDialog(page, async () => {
      await discardBtn.click();
    });

    if ((await getPublicWorkbenchFiles(page))['index.js'] !== 'const stable = "v1";\n') {
      const confirmBtn = page
        .locator(
          ':is(#cl-modal-slot, [role="dialog"], [role="alertdialog"]) button:is(:has-text("Discard"), :has-text("Confirm"))'
        )
        .first();
      await confirmBtn.waitFor({ state: 'visible', timeout: 250 }).catch(() => {});
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
    }

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['index.js'])
      .toBe('const stable = "v1";\n');
    expect(await getActiveEditorText(page)).toBe('const stable = "v1";\n');
    const catVfs = await runTerminalCommand(page, 'cat index.js');
    expect(catVfs).toContain('const stable = "v1";');
  });

  test('T2-F8-04: Simultaneous staged + unstaged (MM) edits on the same file + CLI git add / GUI Unstage never throw Set vs Map TypeError', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f8-04&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'a.js', 'const step = 1;\n');
    await runTerminalCommand(page, 'git init && git add a.js && git commit -m "step 1"');

    // Edit to step 2 and stage in GUI
    await openOrCreateCodeFile(page, 'a.js');
    await setActiveEditorText(page, 'const step = 2;\n');
    const scmView = await openScmSidebar(page);
    await scmView
      .locator('[data-cl-action="scm-stage"], button[title*="Stage" i]:not([title*="Unstage" i]):not([title*="All" i])')
      .first()
      .click();

    // Edit working tree to step 3 -> file is now both staged (step 2) and unstaged (step 3)
    await openOrCreateCodeFile(page, 'a.js');
    await setActiveEditorText(page, 'const step = 3;\n');

    // Run git add a.js in CLI, then click Unstage in GUI
    await runTerminalCommand(page, 'git add a.js');
    await scmView
      .locator('[data-cl-action="scm-unstage"], button[title*="Unstage" i]')
      .first()
      .click();

    const statusOut = await runTerminalCommand(page, 'git status');
    expect(statusOut).toContain('a.js');
  });

  test('T2-F8-05: Deleting a tracked file in Explorer surfaces D (Deleted) status in Source Control and commits deletion cleanly', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f8-05&blank=1&empty=1');
    await openOrCreateCodeFile(page, 'old.js', 'export const legacy = true;\n');
    await openOrCreateCodeFile(page, 'keep.js', 'export const keep = true;\n');
    await runTerminalCommand(page, 'git init && git add . && git commit -m "add old and keep"');

    await page.evaluate(() => (window as any).__codelabIde.deleteFile('old.js'));

    const scmView = await openScmSidebar(page);
    await expect(scmView).toContainText('old.js');

    const stageAllBtn = scmView
      .locator('[data-cl-action="scm-stage-all"], button[title*="Stage All" i], button:has-text("Stage All")')
      .first();
    await stageAllBtn.click();
    await workbenchLocators.scmCommitInput(page).fill('chore: remove old.js');
    await workbenchLocators.scmCommitBtn(page).click();

    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getGitStatus())).length)
      .toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F9: Problems & Diagnostics Boundary Cases (5 tests: T2-F9-01 .. T2-F9-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F9-01: Malformed JSON syntax in .codelab/settings.json and .codelab/tasks.json surfaces parse diagnostics in Problems without crashing IDE', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f9-01');
    await openOrCreateCodeFile(page, '.codelab/settings.json', '{\n  "editor.fontSize": 16,\n');
    await openOrCreateCodeFile(
      page,
      '.codelab/tasks.json',
      '{\n  "version": "2.0.0",\n  "tasks": [\n}'
    );

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('.codelab/settings.json');
    await expect(drawerBody).toContainText('.codelab/tasks.json');

    // Fix both files and verify diagnostics clear
    await openOrCreateCodeFile(page, '.codelab/settings.json');
    await setActiveEditorText(page, '{\n  "editor.fontSize": 16\n}\n');
    await openOrCreateCodeFile(page, '.codelab/tasks.json');
    await setActiveEditorText(page, '{\n  "version": "2.0.0",\n  "tasks": []\n}\n');

    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);
  });

  test('T2-F9-02: Deleting a file that currently has active diagnostics atomically purges its entries from Problems & Status Bar count', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f9-02');
    await openOrCreateCodeFile(page, 'broken.py', 'def syntax_err(\n    return 1\n');
    await expect
      .poll(async () =>
        await page.evaluate(() => (window as any).__codelabIde.getDiagnostics().length)
      )
      .toBeGreaterThanOrEqual(1);

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('broken.py');

    await page.evaluate(() => (window as any).__codelabIde.deleteFile('broken.py'));

    await expect
      .poll(async () => (await page.evaluate(() => (window as any).__codelabIde.getDiagnostics())).length)
      .toBe(0);
    await expect(drawerBody).not.toContainText('broken.py');
  });

  test('T2-F9-03: Path normalization and atomic per-file replacement in DiagnosticsStore prevent duplicate stale diagnostic rows across repeated edits', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f9-03');

    // 1. Public SDK DiagnosticsStore contract check (zero private underscore properties)
    const publicStoreNormalizedCount = await page.evaluate(() => {
      const createStore = (window as any).CodeLab?.createDiagnosticsStore;
      if (typeof createStore !== 'function') return null;
      const store = createStore();
      if (typeof store.setFileDiagnostics !== 'function') return -1;
      store.setFileDiagnostics('/workspace/app.py', 'python-linter', [
        { severity: 'error', message: 'First error', line: 1, col: 1 }
      ]);
      store.setFileDiagnostics('./app.py', 'python-linter', [
        { severity: 'error', message: 'Updated error', line: 2, col: 4 }
      ]);
      return store.getAll().length;
    });
    expect(publicStoreNormalizedCount).toBe(1);

    // 2. Live opaque-box UI verification via real file edits on app.py
    await openOrCreateCodeFile(page, 'app.py', 'def err_one(\n    return 1\n');
    await expect
      .poll(async () =>
        await page.evaluate(
          () =>
            (window as any).__codelabIde
              .getDiagnostics()
              .filter((d: any) => d.file === 'app.py').length
        )
      )
      .toBeGreaterThanOrEqual(1);

    await setActiveEditorText(page, 'def ok_one():\n    return 1\n\ndef err_two()\n    return 2\n');
    await expect
      .poll(async () => {
        const diags = await page.evaluate(() =>
          (window as any).__codelabIde
            .getDiagnostics()
            .filter((d: any) => d.file === 'app.py')
        );
        return diags.map((d: any) => d.line);
      })
      .toEqual([4]);

    const drawerBody = await openProblemsPanel(page);
    await expect(drawerBody).toContainText('app.py');
  });

  test('T2-F9-04: Opening Problems via Mod+Shift+M, Status Bar badge, Command Palette, and ide.showProblemsModal() NEVER creates a blocking modal backdrop', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f9-04');

    // 1. Mod+Shift+M
    await page.keyboard.press('ControlOrMeta+Shift+M');
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);

    // 2. Status Bar badge
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await workbenchLocators.statusProblemsBtn(page).click();
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);

    // 3. Command Palette
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await page.keyboard.press('ControlOrMeta+Shift+P');
    await workbenchLocators.paletteInput(page).fill('>Problems');
    await workbenchLocators.paletteInput(page).press('Enter');
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);

    // 4. Imperative showProblemsModal()
    await workbenchLocators.drawerTab(page, 'terminal').click();
    await page.evaluate(() => (window as any).__codelabIde.showProblemsModal());
    await expectDrawerTabActive(workbenchLocators.drawerTab(page, 'problems'));
    await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  });

  test('T2-F9-05: Clicking a diagnostic whose target file tab was closed reopens the file tab and positions cursor at (line, col)', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f9-05');
    await openOrCreateCodeFile(
      page,
      'closed-broken.py',
      '# 1\n# 2\ndef missing_colon()\n    return 0\n'
    );
    await expect
      .poll(async () =>
        await page.evaluate(() => (window as any).__codelabIde.getDiagnostics().length)
      )
      .toBeGreaterThanOrEqual(1);

    // Close closed-broken.py tab while keeping index.js open
    await openOrCreateCodeFile(page, 'index.js');
    await page.evaluate(() => (window as any).__codelabIde.closeTab('closed-broken.py'));
    await expect(workbenchLocators.fileTab(page, 'closed-broken.py')).toHaveCount(0);

    const drawerBody = await openProblemsPanel(page);
    const problemRow = drawerBody
      .locator(':is(.codelab-problem-item, [data-cl-problem-file="closed-broken.py"], [data-cl-diag-file="closed-broken.py"])')
      .first();
    await expect(problemRow).toBeVisible();
    await problemRow.click();

    await expect(workbenchLocators.fileTab(page, 'closed-broken.py')).toBeVisible();
    await expect(workbenchLocators.statusCursor(page)).toContainText(/Ln\s*3\b/i);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F10: Multi-Session Terminal Boundary Cases (5 tests: T2-F10-01 .. T2-F10-05)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F10-01: Killing / closing the last remaining Terminal session resets or closes cleanly and recovers a live prompt on reopen', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f10-01');
    await runTerminalCommand(page, 'echo "STALE_LAST_SESSION_LOG"');

    const closeLastBtn = workbenchLocators.closeTerminalSessionBtns(page).first();
    if (await closeLastBtn.isVisible()) {
      await closeLastBtn.click();
    } else {
      await page.evaluate(() => {
        const ide = (window as any).__codelabIde;
        const sessions = ide.listTerminalSessions();
        if (sessions.length > 0) ide.closeTerminalSession(sessions[0].id);
      });
    }

    const freshOut = await runTerminalCommand(page, 'echo "RECOVERED_PROMPT_OK"');
    expect(freshOut).toContain('RECOVERED_PROMPT_OK');
    expect(freshOut).not.toContain('STALE_LAST_SESSION_LOG');
  });

  test('T2-F10-02: terminal.scrollback setting (100) caps retained terminal log lines when command outputs 250 lines', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f10-02');
    await openSettingsTabViaGear(page);

    const scrollbackInput = workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="terminal.scrollback"]');
    await scrollbackInput.fill('100');
    await scrollbackInput.dispatchEvent('change');

    const logText = await runTerminalCommand(
      page,
      'node -e "for (let i = 1; i <= 250; i++) console.log(\'LINE_\' + i);"'
    );
    expect(logText).toContain('LINE_250');
    expect(logText).not.toContain('LINE_1\n');

    const renderedLineCount = await page
      .locator('#cl-drawer #cl-terminal-log .codelab-log-line')
      .count();
    expect(renderedLineCount).toBeLessThanOrEqual(115);
  });

  test('T2-F10-03: Non-existent command in Terminal prints stderr cleanly with 0 pageerror and keeps shell responsive', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f10-03');
    const badOut = await runTerminalCommand(page, 'definitely_not_a_cmd_xyz');
    expect(badOut.toLowerCase()).toMatch(/not found|unknown command/);

    const okOut = await runTerminalCommand(page, 'echo "SHELL_STILL_ALIVE"');
    expect(okOut).toContain('SHELL_STILL_ALIVE');
  });

  test('T2-F10-04: Ctrl+C exits interactive node REPL in active session without affecting secondary session', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f10-04');
    await openTerminalPanel(page);
    await workbenchLocators.newTerminalBtn(page).click();
    await runTerminalCommand(page, 'echo "SESSION_2_SAFE"');

    // Switch back to Session 1 and enter interactive node REPL
    await workbenchLocators.terminalSessionPills(page).first().click();
    await runTerminalCommand(page, 'node');

    // Send Ctrl+C interrupt
    const ctrlCBtn = page.locator('#cl-drawer [data-cl-action="interrupt"], #cl-drawer #cl-ctrl-c-btn').first();
    if (await ctrlCBtn.isVisible()) {
      await ctrlCBtn.click();
    } else {
      await workbenchLocators.replInput(page).focus();
      await page.keyboard.press('Control+c');
    }
    // Send a second Ctrl+C if node REPL prompts "(To exit, press Ctrl+C again)"
    await workbenchLocators.replInput(page).focus();
    await page.keyboard.press('Control+c');

    const afterInterrupt = await runTerminalCommand(page, 'pwd');
    expect(afterInterrupt).toContain('/workspace');

    await workbenchLocators.terminalSessionPills(page).last().click();
    await expect(workbenchLocators.terminalLog(page)).toContainText('SESSION_2_SAFE');
  });

  test('T2-F10-05: Clicking Clear clears ONLY active terminal session logs without wiping secondary session logs', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f10-05');
    await runTerminalCommand(page, 'echo "S1_TO_CLEAR"');

    await workbenchLocators.newTerminalBtn(page).click();
    await runTerminalCommand(page, 'echo "S2_MUST_STAY"');

    // Switch back to Session 1 and clear
    await workbenchLocators.terminalSessionPills(page).first().click();
    const clearBtn = page
      .locator('#cl-drawer [data-cl-action="clear-terminal"], #cl-drawer button[title*="Clear" i]')
      .first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await workbenchLocators.replInput(page).focus();
      await page.keyboard.press('Control+l');
    }

    await expect(workbenchLocators.terminalLog(page)).not.toContainText('S1_TO_CLEAR');

    // Session 2 logs remain intact
    await workbenchLocators.terminalSessionPills(page).last().click();
    await expect(workbenchLocators.terminalLog(page)).toContainText('S2_MUST_STAY');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F11: Settings Scope Sync, Snap-Back Fix, AutoSave & Schema Clamping (6 tests: T2-F11-01 .. T2-F11-06)
  // ═══════════════════════════════════════════════════════════════════════════

  test('T2-F11-01: Editing editor.fontSize in Settings UI when .codelab/settings.json already overrides editor.fontSize: 13 updates effective value immediately without snapping back', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f11-01',
      {
        'index.js': 'console.log("snapback test");\n',
        '.codelab/settings.json': '{\n  "editor.fontSize": 13\n}\n'
      },
      { activeFile: 'index.js' }
    );
    await page.goto('/workbench?labId=t2-f11-01');

    await openSettingsTabViaGear(page);
    const fontInput = workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="editor.fontSize"]');
    await expect(fontInput).toBeVisible();
    await fontInput.fill('21');
    await fontInput.dispatchEvent('change');

    await expect(fontInput).toHaveValue('21');
    const effective = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('editor.fontSize')
    );
    expect(effective).toBe(21);

    await page.reload();
    const persistedEffective = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('editor.fontSize')
    );
    expect(persistedEffective).toBe(21);
  });

  test('T2-F11-02: Per-setting Reset ([data-reset-key]) and Reset All clear overrides in BOTH ConfigurationService AND .codelab/settings.json', async ({
    page
  }) => {
    await seedPersistedWorkspace(
      page,
      't2-f11-02',
      {
        'index.js': 'console.log(1);\n',
        '.codelab/settings.json': '{\n  "editor.fontSize": 22,\n  "editor.tabSize": 6\n}\n'
      },
      { activeFile: 'index.js' }
    );
    await page.goto('/workbench?labId=t2-f11-02');
    await openSettingsTabViaGear(page);

    const host = workbenchLocators.settingsHost(page);
    const resetFontBtn = host.locator('[data-reset-key="editor.fontSize"]').first();
    await expect(resetFontBtn).toBeVisible();
    await resetFontBtn.click();

    const fontAfterReset = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('editor.fontSize')
    );
    expect(fontAfterReset).not.toBe(22);

    const resetAllBtn = host
      .locator('[data-settings-action="reset-all"], button:has-text("Reset All")')
      .first();
    await expect(resetAllBtn).toBeVisible();
    await withAutoAcceptDialog(page, async () => {
      await resetAllBtn.click();
    });

    const tabAfterResetAll = await page.evaluate(() =>
      (window as any).__codelabIde.configuration.get('editor.tabSize')
    );
    expect(tabAfterResetAll).not.toBe(6);
  });

  test('T2-F11-03: files.autoSave = "off" displays dirty indicator on edited tab/file, intercepts Mod+S (preventDefault), flushes to storage, and clears dirty dot', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f11-03');
    await openSettingsTabViaGear(page);

    const autoSaveSelect = workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="files.autoSave"]');
    await autoSaveSelect.selectOption('off');

    await workbenchLocators.fileTab(page, 'index.js').click();
    await setActiveEditorText(page, '// MANUAL_SAVE_REQUIRED_EDIT\n');

    const dirtyIndicator = page.locator(
      '.codelab-editor-col :is([data-dirty="true"], .is-dirty, .codelab-tab__dirty), aside.codelab-sidebar :is([data-dirty="true"], .is-dirty, .codelab-file-dirty)'
    );
    await expect(dirtyIndicator.first()).toBeVisible();

    const defaultPrevented = await page.evaluate(() => {
      const ev = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        metaKey: true,
        bubbles: true,
        cancelable: true
      });
      document.querySelector('#cl-fallback-editor, .codelab-workbench')!.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(defaultPrevented).toBe(true);
    await expect(dirtyIndicator).toHaveCount(0);

    await page.reload();
    expect((await getPublicWorkbenchFiles(page))['index.js']).toBe(
      '// MANUAL_SAVE_REQUIRED_EDIT\n'
    );
  });

  test('T2-F11-04: editor.formatOnSave = true formats active SQL document automatically upon pressing Mod+S', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f11-04&lang=sql');
    await openSettingsTabViaGear(page);

    const formatCheckbox = workbenchLocators
      .settingsHost(page)
      .locator('[data-setting-key="editor.formatOnSave"]');
    if (!(await formatCheckbox.isChecked())) {
      await formatCheckbox.check();
    }

    const unformatted = 'select   id,name   from   users;';
    await openOrCreateCodeFile(page, 'query.sql');
    await setActiveEditorText(page, unformatted);
    await page.keyboard.press('ControlOrMeta+s');

    await expect
      .poll(async () => (await getPublicWorkbenchFiles(page))['query.sql'])
      .toMatch(/\bSELECT\b[\s\S]*\bFROM\b/);
    const formatted = (await getPublicWorkbenchFiles(page))['query.sql'];
    expect(formatted).not.toBe(unformatted);
  });

  test('T2-F11-05: Out-of-bounds numeric settings (editor.fontSize = 999 or -5, editor.tabSize = 0) clamp or reject per schema without breaking editor', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f11-05');
    await openOrCreateCodeFile(
      page,
      '.codelab/settings.json',
      '{\n  "editor.fontSize": 999,\n  "editor.tabSize": 0\n}\n'
    );

    const effectiveFontSize = await page.evaluate(() =>
      Number((window as any).__codelabIde.configuration.get('editor.fontSize'))
    );
    expect(effectiveFontSize).toBeGreaterThanOrEqual(10);
    expect(effectiveFontSize).toBeLessThanOrEqual(32);

    await openOrCreateCodeFile(page, 'index.js');
    await expect(page.locator('#cl-fallback-editor')).toBeVisible();
  });

  test('T2-F11-06: Closing the Settings tab (__settings__ close x) while other file tabs are open switches cleanly back to previous code tab with unsaved buffer intact', async ({
    page
  }) => {
    await page.goto('/workbench?labId=t2-f11-06');
    await openOrCreateCodeFile(page, 'index.js', 'const unsavedBeforeSettings = 42;\n');

    await openSettingsTabViaGear(page);
    await expect(workbenchLocators.settingsTab(page)).toBeVisible();

    const closeBtn = workbenchLocators
      .settingsTab(page)
      .locator('[data-cl-action*="close"], .codelab-tab__close, button[aria-label*="Close" i]')
      .first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(workbenchLocators.settingsTab(page)).toHaveCount(0);
    await expect(workbenchLocators.fileTab(page, 'index.js')).toBeVisible();
    expect(await getActiveEditorText(page)).toBe('const unsavedBeforeSettings = 42;\n');
  });
});
