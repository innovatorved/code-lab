import { expect, type Dialog, type Locator, type Page } from '@playwright/test';

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ZeroErrorTrackerOptions {
  /** Allow browser `Failed to load resource` console error lines in deliberate negative HTTP 404/500 tests. */
  allowNetworkErrorStatus?: boolean;
  /** Additional regexes for explicitly expected console.error lines in negative error-handling tests. */
  allowConsolePatterns?: RegExp[];
}

export interface ZeroErrorTracker {
  readonly errors: string[];
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  assertNoErrors(): void;
}

/**
 * Installs hermetic offline stubs for Monaco & Pyodide CDN scripts so `#cl-fallback-editor`
 * activates immediately with zero external network calls and zero `net::ERR_FAILED` console noise.
 *
 * IMPORTANT: Never intercepts `https://cdn.jsdelivr.net/gh/**` so `github-mock.ts` Strategy B
 * rate-limit fallback works cleanly!
 */
export async function installOfflineCdnStubs(page: Page): Promise<void> {
  await page.route('https://cdn.jsdelivr.net/npm/monaco-editor*/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* hermetic offline stub */'
    })
  );
  await page.route('https://cdn.jsdelivr.net/npm/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* hermetic offline stub */'
    })
  );
  await page.route('https://cdn.jsdelivr.net/pyodide/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* hermetic offline stub */'
    })
  );
}

/**
 * Tracks uncaught `pageerror` exceptions and unexpected `console.error` events across a test.
 */
export function attachZeroErrorTracker(
  page: Page,
  opts: ZeroErrorTrackerOptions = {}
): ZeroErrorTracker {
  const errors: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => {
    const msg = `pageerror: ${err?.stack || err?.message || String(err)}`;
    pageErrors.push(msg);
    errors.push(msg);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const locUrl = msg.location()?.url || '';

    // Ignore Monaco/Pyodide offline loader fallbacks if any
    if (/monaco-editor|pyodide|AMD loader unavailable/i.test(text) || /monaco-editor|pyodide/i.test(locUrl)) {
      return;
    }

    if (
      opts.allowNetworkErrorStatus &&
      /Failed to load resource: the server responded with a status of (403|404|429|5\d\d)|net::ERR_CONNECTION_RESET/i.test(
        text
      )
    ) {
      return;
    }

    if (opts.allowConsolePatterns?.some((re) => re.test(text))) {
      return;
    }

    const formatted = `console.error: ${text}`;
    consoleErrors.push(formatted);
    errors.push(formatted);
  });

  return {
    errors,
    pageErrors,
    consoleErrors,
    assertNoErrors() {
      expect(errors).toEqual([]);
    }
  };
}

/**
 * Runs `fn()` while automatically accepting any native browser `window.alert` / `window.confirm` /
 * `window.prompt` dialog, and ALWAYS removes the listener in `finally` so unconsumed `dialog`
 * handlers never stack or leak into subsequent steps.
 */
export async function withAutoAcceptDialog<T>(
  page: Page,
  fn: () => Promise<T>
): Promise<T> {
  const pendingAccepts: Promise<void>[] = [];
  const handler = (dialog: Dialog): void => {
    pendingAccepts.push(dialog.accept().catch(() => {}));
  };
  page.on('dialog', handler);
  try {
    const result = await fn();
    if (pendingAccepts.length > 0) {
      await Promise.all(pendingAccepts);
    }
    await page
      .evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
      .catch(() => {});
    if (pendingAccepts.length > 0) {
      await Promise.all(pendingAccepts);
    }
    return result;
  } finally {
    page.off('dialog', handler);
  }
}

/**
 * Canonical contract-compliant region & control locators (`PROJECT.md § Interface Contracts §5`
 * and Spec Miner 3 `§4.1.A`). Scoped strictly inside their target architectural regions so legacy
 * modals cannot false-pass while valid attribute variants never false-fail.
 */
export const workbenchLocators = {
  root: (page: Page): Locator => page.locator('.codelab.codelab-workbench'),
  topbar: (page: Page): Locator => page.locator('.codelab-topbar'),
  menubar: (page: Page): Locator => page.locator('.codelab-topbar [role="menubar"]'),
  menuTriggers: (page: Page): Locator =>
    page.locator('.codelab-topbar [role="menubar"] [role="menuitem"]'),
  menuTrigger: (page: Page, name: string): Locator =>
    page
      .locator('.codelab-topbar [role="menubar"] [role="menuitem"]')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, 'i') })
      .first(),
  openDropdownMenus: (page: Page): Locator =>
    page.locator(':is(.codelab-topbar, .codelab-workbench, body) [role="menu"]:visible'),
  commandCenterTrigger: (page: Page): Locator =>
    page.locator(
      '.codelab-topbar :is([data-cl-action="command-palette"], .codelab-cmd-trigger, button[aria-label*="Command" i], button[title*="Command" i])'
    ).first(),
  paletteInput: (page: Page): Locator => page.locator('#cl-palette-input'),

  activityBar: (page: Page): Locator =>
    page.locator(
      'nav.codelab-activitybar, [role="navigation"].codelab-activitybar, .codelab-activitybar[aria-label="Activity Bar"]'
    ).first(),
  activityItem: (page: Page, id: 'explorer' | 'search' | 'scm'): Locator =>
    page.locator(`.codelab-activitybar [data-cl-activity="${id}"]`).first(),
  activitySettingsGear: (page: Page): Locator =>
    page
      .locator(
        '.codelab-activitybar :is([data-cl-activity="settings"], [data-cl-action="open-settings"], button[aria-label*="Settings" i], button[aria-label*="Manage" i])'
      )
      .first(),

  sidebar: (page: Page): Locator =>
    page.locator('aside.codelab-sidebar, .codelab-body > .codelab-sidebar').first(),
  sidebarSplitter: (page: Page): Locator => page.locator('#cl-splitter-files'),
  explorerView: (page: Page): Locator =>
    page.locator('aside.codelab-sidebar :is(#cl-sidebar-explorer, .codelab-explorer, #cl-explorer-list)').first(),
  explorerList: (page: Page): Locator => page.locator('aside.codelab-sidebar #cl-explorer-list'),
  fileItem: (page: Page, filePath: string): Locator =>
    page.locator(`aside.codelab-sidebar .codelab-file-item[data-cl-file="${cssEscapeAttr(filePath)}"]`).first(),
  folderItem: (page: Page, folderPath: string): Locator =>
    page.locator(`aside.codelab-sidebar .codelab-folder-item[data-cl-folder="${cssEscapeAttr(folderPath)}"]`).first(),

  searchView: (page: Page): Locator =>
    page.locator('aside.codelab-sidebar :is(#cl-sidebar-search, [data-cl-view="search"], .codelab-search-view)').first(),
  searchInput: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is(#cl-search-input, #cl-search-query-input, input[type="search"], input[placeholder*="Search" i])'
      )
      .first(),
  replaceInput: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is(#cl-search-replace-input, #cl-replace-input, input[placeholder*="Replace" i])'
      )
      .first(),
  searchCaseToggle: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is([data-cl-search-opt="caseSensitive"], [data-search-opt="caseSensitive"], button[aria-label*="Case" i], button[title*="Case" i])'
      )
      .first(),
  searchWholeWordToggle: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is([data-cl-search-opt="wholeWord"], [data-search-opt="wholeWord"], button[aria-label*="Whole Word" i], button[title*="Whole Word" i])'
      )
      .first(),
  searchRegexToggle: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is([data-cl-search-opt="regex"], [data-search-opt="regex"], button[aria-label*="Regular Expression" i], button[aria-label*="Regex" i], button[title*="Regular Expression" i], button[title*="Regex" i])'
      )
      .first(),
  searchIncludeInput: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is(#cl-search-include, [data-cl-search-include], input[placeholder*="include" i])'
      )
      .first(),
  searchExcludeInput: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is(#cl-search-exclude, [data-cl-search-exclude], input[placeholder*="exclude" i])'
      )
      .first(),

  scmView: (page: Page): Locator =>
    page.locator('aside.codelab-sidebar :is(#cl-sidebar-scm, [data-cl-view="scm"], .codelab-scm-view)').first(),
  scmCommitInput: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is(#cl-scm-commit-input, textarea[placeholder*="Message" i], input[placeholder*="Message" i])'
      )
      .first(),
  scmCommitBtn: (page: Page): Locator =>
    page
      .locator(
        'aside.codelab-sidebar :is([data-cl-action="scm-commit"], #cl-scm-commit-btn, button:has-text("Commit"))'
      )
      .first(),

  editorCol: (page: Page): Locator => page.locator('.codelab-editor-col').first(),
  tabBar: (page: Page): Locator =>
    page.locator('.codelab-editor-col :is(#cl-tabs, #cl-file-tabs, .codelab-tabs[role="tablist"])').first(),
  tabs: (page: Page): Locator =>
    page.locator('.codelab-editor-col :is(#cl-tabs, #cl-file-tabs, .codelab-tabs) [role="tab"]'),
  fileTab: (page: Page, filePath: string): Locator =>
    page
      .locator(
        `.codelab-editor-col [role="tab"]:is([data-cl-file="${cssEscapeAttr(filePath)}"], [data-tab-file="${cssEscapeAttr(filePath)}"], [data-cl-tab="${cssEscapeAttr(filePath)}"])`
      )
      .first(),
  settingsTab: (page: Page): Locator =>
    page
      .locator(
        '.codelab-editor-col :is([data-cl-tab="__settings__"], [role="tab"][data-cl-file="__settings__"], [role="tab"][data-tab-file="__settings__"])'
      )
      .first(),
  settingsHost: (page: Page): Locator => page.locator('.codelab-editor-col #cl-settings-host'),

  drawer: (page: Page): Locator =>
    page
      .locator('.codelab-workbench-main #cl-drawer, .codelab-editor-panel-col #cl-drawer, #cl-drawer.codelab-drawer')
      .first(),
  drawerSplitter: (page: Page): Locator => page.locator('#cl-splitter-h'),
  drawerBody: (page: Page): Locator => page.locator('#cl-drawer #cl-drawer-body'),
  drawerTab: (page: Page, tabId: string): Locator =>
    page.locator(`#cl-drawer [role="tab"][data-cl-drawertab="${tabId}"], #cl-drawer [data-cl-drawertab="${tabId}"]`).first(),
  drawerMaximizeBtn: (page: Page): Locator =>
    page.locator('#cl-drawer [data-cl-action="maximize-drawer"]').first(),
  drawerCloseBtn: (page: Page): Locator =>
    page.locator('#cl-drawer :is([data-cl-action="close-drawer"], [data-cl-action="toggle-drawer"])').first(),

  problemItems: (page: Page): Locator =>
    page.locator('#cl-drawer-body :is(.codelab-problem-item, [data-cl-problem-file], [data-cl-diag-file])'),
  terminalSurface: (page: Page): Locator => page.locator('#cl-drawer #cl-terminal-surface'),
  terminalLog: (page: Page): Locator => page.locator('#cl-drawer #cl-terminal-log'),
  replInput: (page: Page): Locator => page.locator('#cl-drawer #cl-repl-input'),
  newTerminalBtn: (page: Page): Locator =>
    page.locator('#cl-drawer [data-cl-action="new-terminal-session"]').first(),
  terminalSessionPills: (page: Page): Locator =>
    page.locator('#cl-drawer [data-cl-action="switch-terminal-session"][data-session-id]'),
  closeTerminalSessionBtns: (page: Page): Locator =>
    page.locator(
      '#cl-drawer :is([data-cl-action="close-terminal-session"], [data-cl-action="kill-terminal-session"])'
    ),

  statusBar: (page: Page): Locator => page.locator('footer.codelab-statusbar, #cl-statusbar').first(),
  statusScmBtn: (page: Page): Locator => page.locator('[data-cl-action="statusbar-scm"]').first(),
  statusProblemsBtn: (page: Page): Locator => page.locator('[data-cl-action="statusbar-problems"]').first(),
  statusCursor: (page: Page): Locator => page.locator('#cl-status-cursor').first(),

  workspaceConfirmModal: (page: Page): Locator =>
    page.locator('[data-cl-modal="workspace-confirm"], #workspace-confirm-modal').first(),
  cloneSubmitButton: (page: Page): Locator =>
    page
      .locator(
        ':is(#landing-overlay:not(.hidden), #cl-modal-slot, [data-cl-modal*="clone"], [role="dialog"]:not([data-cl-modal="workspace-confirm"]):not(#workspace-confirm-modal):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *)) :is(#landing-clone-btn, [data-cl-action="confirm-clone-repo"], [data-cl-action="clone-submit"], button[type="submit"]):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible, :is(#landing-overlay:not(.hidden), #cl-modal-slot, [data-cl-modal*="clone"], [role="dialog"]:not([data-cl-modal="workspace-confirm"]):not(#workspace-confirm-modal):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *)):not(:has(:is(#landing-clone-btn, [data-cl-action="confirm-clone-repo"], [data-cl-action="clone-submit"], button[type="submit"]):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible)) button:has-text("Clone"):not([role="tab"]):not([data-repo]):not([data-demo]):not([data-cl-action="open-clone-repo"]):not([data-cl-action="open-clone-modal"]):not([data-cl-action="close-modal"]):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible'
      )
      .first(),
  cloneCancelButton: (page: Page): Locator =>
    page
      .locator(
        '[data-cl-action="cancel-clone"]:not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible, [data-cl-action="stop-execution"]:not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible:not([disabled]), :is(#landing-overlay:not(.hidden), #cl-modal-slot, [data-cl-modal*="clone"], [role="dialog"]:not([data-cl-modal="workspace-confirm"]):not(#workspace-confirm-modal):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *), .codelab-topbar, #cl-drawer):not(:has(:is([data-cl-action="cancel-clone"], [data-cl-action="stop-execution"]:not([disabled])):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible)) button:has-text("Cancel"):not([data-cl-modal="workspace-confirm"] *):not(#workspace-confirm-modal *):visible'
      )
      .first()
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cssEscapeAttr(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Opens a top-level Menu Bar dropdown (`File`, `Edit`, `Selection`, `View`, `Go`, `Run`, `Terminal`, `Help`).
 */
export async function openTopMenu(page: Page, menuName: string): Promise<Locator> {
  const trigger = workbenchLocators.menuTrigger(page, menuName);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = workbenchLocators.openDropdownMenus(page).first();
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * Opens a top-level Menu Bar dropdown and clicks an item matching `itemPattern`
 * (supporting optional nested submenu hover/click if `submenuItemPattern` is given).
 */
export async function clickMenuItem(
  page: Page,
  menuName: string,
  itemPattern: RegExp | string,
  submenuItemPattern?: RegExp | string
): Promise<void> {
  const menu = await openTopMenu(page, menuName);
  const matcher =
    typeof itemPattern === 'string' ? new RegExp(escapeRegExp(itemPattern), 'i') : itemPattern;
  const item = menu.locator('[role="menuitem"]').filter({ hasText: matcher }).first();
  await expect(item).toBeVisible();

  if (submenuItemPattern) {
    await item.hover();
    const subMatcher =
      typeof submenuItemPattern === 'string'
        ? new RegExp(escapeRegExp(submenuItemPattern), 'i')
        : submenuItemPattern;
    const subItem = page
      .locator('[role="menu"]:visible [role="menuitem"]')
      .filter({ hasText: subMatcher })
      .first();
    await expect(subItem).toBeVisible();
    await subItem.click();
    return;
  }

  await item.click();
}

/**
 * Opens the non-destructive Settings tab (`__settings__`) via the Activity Bar bottom gear
 * (supporting both direct open and VS Code Manage menu popup per Spec Miner 3 `§1.2 #2`).
 */
export async function openSettingsTabViaGear(page: Page): Promise<void> {
  const gear = workbenchLocators.activitySettingsGear(page);
  await expect(gear).toBeVisible();
  await gear.click();

  const settingsTab = workbenchLocators.settingsTab(page);
  if (!(await settingsTab.isVisible())) {
    const openMenu = workbenchLocators.openDropdownMenus(page).first();
    if (await openMenu.isVisible()) {
      const settingsMenuItem = openMenu
        .locator('[role="menuitem"]')
        .filter({ hasText: /^\s*Settings\b/i })
        .first();
      await settingsMenuItem.click();
    }
  }

  await expect(settingsTab).toBeVisible();
  await expect(workbenchLocators.settingsHost(page)).toBeVisible();
  await expect(page.locator('dialog.cl-settings-dialog[open]')).toHaveCount(0);
}

/**
 * Opens the Primary Sidebar to the Search view via Activity Bar icon and ensures it is non-modal.
 */
export async function openSearchSidebar(page: Page): Promise<Locator> {
  const searchBtn = workbenchLocators.activityItem(page, 'search');
  await expect(searchBtn).toBeVisible();
  await searchBtn.click();
  const sidebar = workbenchLocators.sidebar(page);
  if (!(await sidebar.isVisible())) {
    await searchBtn.click();
  }
  const searchView = workbenchLocators.searchView(page);
  await expect(searchView).toBeVisible();
  return searchView;
}

/**
 * Opens the Primary Sidebar to the Source Control view via Activity Bar icon.
 */
export async function openScmSidebar(page: Page): Promise<Locator> {
  const scmBtn = workbenchLocators.activityItem(page, 'scm');
  await expect(scmBtn).toBeVisible();
  await scmBtn.click();
  const sidebar = workbenchLocators.sidebar(page);
  if (!(await sidebar.isVisible())) {
    await scmBtn.click();
  }
  const scmView = workbenchLocators.scmView(page);
  await expect(scmView).toBeVisible();
  return scmView;
}

/**
 * Expands the Dedicated Bottom Panel (`#cl-drawer`) and activates the `problems` tab.
 */
export async function openProblemsPanel(page: Page): Promise<Locator> {
  const statusBtn = workbenchLocators.statusProblemsBtn(page);
  if (await statusBtn.isVisible()) {
    await statusBtn.click();
  } else {
    await workbenchLocators.drawerTab(page, 'problems').click();
  }
  const drawerBody = workbenchLocators.drawerBody(page);
  await expect(drawerBody).toBeVisible();
  await expect(page.locator('#cl-modal-slot .codelab-modal-backdrop')).toHaveCount(0);
  return drawerBody;
}

/**
 * Expands the Dedicated Bottom Panel (`#cl-drawer`) and activates the `terminal` tab.
 */
export async function openTerminalPanel(page: Page): Promise<Locator> {
  const termSurface = workbenchLocators.terminalSurface(page);
  if (!(await termSurface.isVisible())) {
    const termTab = workbenchLocators.drawerTab(page, 'terminal');
    if (await termTab.isVisible()) {
      await termTab.click();
    } else {
      await page.keyboard.press('Control+`');
    }
  }
  await expect(termSurface).toBeVisible();
  return termSurface;
}

/**
 * Asserts that a Bottom Panel (`#cl-drawer`) tab locator is active, accepting either
 * `aria-selected="true"` or active CSS class (`active` / `is-active`).
 */
export async function expectDrawerTabActive(tab: Locator): Promise<void> {
  await expect(tab).toBeVisible();
  await expect
    .poll(async () => {
      const ariaSelected = await tab.getAttribute('aria-selected').catch(() => null);
      if (ariaSelected === 'true') return true;
      const className = (await tab.getAttribute('class').catch(() => null)) ?? '';
      return /(^|\s)(is-active|active)(\s|$)/.test(className);
    })
    .toBe(true);
}

/**
 * Ensures a non-Markdown code file is created or opened as the active editor tab so `#cl-fallback-editor`
 * (or `.monaco-editor`) is editable (avoiding the read-only `.md` preview trap on `README.md`).
 */
export async function openOrCreateCodeFile(
  page: Page,
  filePath = 'app.js',
  initialContent?: string
): Promise<void> {
  const existingFiles = await getPublicWorkbenchFiles(page);
  const exists = Object.prototype.hasOwnProperty.call(existingFiles, filePath);

  if (!exists) {
    await page.evaluate(
      ({ p, c }) => {
        const ide = (window as any).__codelabIde || (window as any).__codelabTest?.ide;
        if (ide && typeof ide.createFile === 'function') {
          ide.createFile(p, c ?? '');
        } else if (ide && typeof ide.setFile === 'function') {
          ide.setFile(p, c ?? '');
        }
        if (ide && typeof ide.openFile === 'function') {
          ide.openFile(p);
        }
      },
      { p: filePath, c: initialContent ?? '' }
    );
  } else {
    const item = workbenchLocators.fileItem(page, filePath);
    if (await item.isVisible()) {
      await item.click();
    } else {
      await page.evaluate((p) => {
        const ide = (window as any).__codelabIde || (window as any).__codelabTest?.ide;
        if (ide && typeof ide.openFile === 'function') {
          ide.openFile(p);
        }
      }, filePath);
    }
    if (initialContent !== undefined) {
      await setActiveEditorText(page, initialContent);
    }
  }

  await expect(workbenchLocators.fileTab(page, filePath)).toBeVisible();
}

/**
 * Writes text into the currently active editor (dual-mode: `#cl-fallback-editor`, `.cl-sql-textarea`, or `.monaco-editor`).
 */
export async function setActiveEditorText(page: Page, nextText: string): Promise<void> {
  const fallback = page.locator('#cl-fallback-editor');
  if (await fallback.isVisible()) {
    await fallback.fill(nextText);
    return;
  }
  const sqlTextarea = page.locator('.cl-sql-textarea');
  if (await sqlTextarea.isVisible()) {
    await sqlTextarea.fill(nextText);
    return;
  }
  const monacoInput = page.locator('.monaco-editor textarea.inputarea').first();
  await page.locator('.monaco-editor .view-lines').first().click();
  await monacoInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await monacoInput.press('Backspace');
  await page.keyboard.insertText(nextText);
}

/**
 * Reads text from the currently active editor (dual-mode: `#cl-fallback-editor`, `.cl-sql-textarea`, or public `ide.getFile(ide.activeFile)`).
 */
export async function getActiveEditorText(page: Page): Promise<string> {
  const fallback = page.locator('#cl-fallback-editor');
  if (await fallback.isVisible()) {
    return fallback.inputValue();
  }
  const sqlTextarea = page.locator('.cl-sql-textarea');
  if (await sqlTextarea.isVisible()) {
    return sqlTextarea.inputValue();
  }
  return page.evaluate(() => {
    const ide = (window as any).__codelabIde || (window as any).__codelabTest?.ide;
    return ide && typeof ide.getFile === 'function' && ide.activeFile
      ? String(ide.getFile(ide.activeFile) ?? '')
      : '';
  });
}

/**
 * Reads `ide.getFiles()` through the documented public Workbench API (`window.__codelabIde.getFiles()`).
 */
export async function getPublicWorkbenchFiles(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const ide = (window as any).__codelabIde || (window as any).__codelabTest?.ide;
    if (!ide || typeof ide.getFiles !== 'function') return {};
    return { ...(ide.getFiles() || {}) };
  });
}

/**
 * Reads the current public `labId` of the mounted workbench instance.
 */
export async function getActiveLabId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const ide = (window as any).__codelabIde || (window as any).__codelabTest?.ide;
    return String(ide?.labId ?? '');
  });
}

/**
 * Types and executes a real command in the integrated Terminal (`#cl-terminal-surface` -> `#cl-repl-input`),
 * cleanly handling `_renderDrawerBody()` remounts and `data-busy="true"` locks.
 */
export async function runTerminalCommand(page: Page, command: string): Promise<string> {
  const termSurface = await openTerminalPanel(page);
  const idlePrompt = page.locator('#cl-drawer #cl-pty-active-line:not([data-busy="true"])');
  await expect(idlePrompt).toBeVisible();

  const prevCount = await page.locator('#cl-drawer #cl-terminal-log .codelab-log-line').count();

  await termSurface.click();
  await workbenchLocators.replInput(page).focus();
  await page.keyboard.type(command);
  await page.keyboard.press('Enter');

  await expect(idlePrompt).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () => page.locator('#cl-drawer #cl-terminal-log .codelab-log-line').count(), {
      timeout: 8_000
    })
    .toBeGreaterThan(prevCount);

  return (await workbenchLocators.terminalLog(page).innerText()) || '';
}

/**
 * Seeds a persisted workspace snapshot in `localStorage['sd-codelab-v1:' + labId]` prior to navigation,
 * using the nested `"${mode}:${lang}"` key schema required by `CodeLabWorkbench`.
 */
export async function seedPersistedWorkspace(
  page: Page,
  labId: string,
  files: Record<string, string>,
  opts: {
    mode?: 'sandbox' | 'guided';
    lang?: 'js' | 'ts' | 'py' | 'cpp' | 'sql';
    activeFile?: string;
    openTabs?: string[];
  } = {}
): Promise<void> {
  const mode = opts.mode ?? 'sandbox';
  const lang = opts.lang ?? 'js';
  const activeFile = opts.activeFile ?? Object.keys(files)[0] ?? '';
  const openTabs = opts.openTabs ?? (activeFile ? [activeFile] : []);
  const slotKey = `${mode}:${lang}`;

  await page.addInitScript(
    ({ id, state }) => {
      localStorage.setItem(`sd-codelab-v1:${id}`, JSON.stringify(state));
    },
    {
      id: labId,
      state: {
        mode,
        lang,
        activeStepIndex: 0,
        completedSteps: [],
        customFiles: { [slotKey]: files },
        hasSnapshot: { [slotKey]: true },
        openTabs,
        activeFile,
        folders: [],
        collapsedFolders: []
      }
    }
  );
}

/**
 * Seeds User-scope settings into `localStorage['sd-codelab-v1:user-settings']` prior to navigation.
 */
export async function seedUserSettings(
  page: Page,
  userSettings: Record<string, unknown>
): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem(
      'sd-codelab-v1:user-settings',
      JSON.stringify({ version: 1, user, workspace: {} })
    );
  }, userSettings);
}

/**
 * Triggers `Blank IDE` through user-facing UI on `/cloud-ide` or `/workbench`
 * (Menu Bar `File -> New Blank Workspace` / `Blank IDE`, `#header-blank-btn`, or `#open-empty-btn`).
 */
export async function triggerBlankIdeAction(page: Page): Promise<void> {
  const openEmptyBtn = page.locator('#open-empty-btn');
  if (await openEmptyBtn.isVisible()) {
    await openEmptyBtn.click();
    return;
  }
  const headerBlank = page.locator('#header-blank-btn, [data-cl-action="new-blank-workspace"]');
  if (await headerBlank.first().isVisible()) {
    await headerBlank.first().click();
    return;
  }
  await clickMenuItem(page, 'File', /Blank|New Workspace/i);
}

/**
 * Opens the Clone Repository modal/overlay through user-facing UI (`#open-clone-modal-btn` or `File -> Clone Repository`).
 */
export async function openCloneRepoUi(page: Page): Promise<void> {
  const landingOverlay = page.locator('#landing-overlay:not(.hidden)');
  if (await landingOverlay.isVisible()) {
    return;
  }
  const headerClone = page.locator('#open-clone-modal-btn, [data-cl-action="open-clone-modal"]');
  if (await headerClone.first().isVisible()) {
    await headerClone.first().click();
    return;
  }
  await clickMenuItem(page, 'File', /Clone/i);
}

/**
 * Polls up to `timeoutMs` (default `400ms`) for the optional non-destructive workspace confirmation
 * dialog (`[data-cl-modal="workspace-confirm"], #workspace-confirm-modal`) to appear asynchronously
 * (e.g., after an IndexedDB `hasWorkspaceData` check), breaking early if `opts.prevLabId` already
 * transitioned to a new isolated `labId`. Returns the visible modal `Locator`, or `null` if not shown.
 */
export async function waitForOptionalConfirmModal(
  page: Page,
  timeoutMs = 400,
  opts?: { prevLabId?: string }
): Promise<Locator | null> {
  const confirmModal = workbenchLocators.workspaceConfirmModal(page);
  const deadline = Date.now() + Math.max(0, timeoutMs);
  do {
    if (await confirmModal.isVisible().catch(() => false)) {
      return confirmModal;
    }
    if (opts?.prevLabId !== undefined) {
      const currentLabId = await getActiveLabId(page).catch(() => opts.prevLabId!);
      if (currentLabId && currentLabId !== opts.prevLabId) {
        return null;
      }
    }
    if (Date.now() >= deadline) break;
    await page.waitForTimeout(25);
  } while (Date.now() <= deadline);

  return (await confirmModal.isVisible().catch(() => false)) ? confirmModal : null;
}

/**
 * Verifies `PROJECT.md §5.3` Non-Destructive Workspace Transition under BOTH valid contract variants:
 *   - Variant A: Confirmation dialog (`[data-cl-modal="workspace-confirm"], #workspace-confirm-modal`)
 *     appears with `"New Isolated Workspace"`, `"Replace Current Workspace"`, and `"Cancel"` buttons.
 *   - Variant B: Immediately mounts a new isolated `labId` (`newLabId !== prevLabId`) while preserving
 *     the previous workspace intact in storage (`sd-codelab-v1:<prevLabId>` / `WorkspaceStorage.listWorkspaces()`).
 */
export async function verifyNonDestructiveTransition(
  page: Page,
  opts: {
    prevLabId: string;
    preservedFile: string;
    preservedContent: string;
    trigger: () => Promise<void>;
    /** 'cancel' tests Escape/Cancel preservation; 'isolate' completes transition into isolated workspace. */
    resolution: 'cancel' | 'isolate';
  }
): Promise<{ variant: 'confirm-modal' | 'auto-isolated'; nextLabId: string }> {
  await opts.trigger();

  const raceTimeoutMs = opts.resolution === 'cancel' ? 600 : 5_000;
  const matchedModal = await waitForOptionalConfirmModal(page, raceTimeoutMs, {
    prevLabId: opts.prevLabId
  });
  const confirmModal = matchedModal ?? workbenchLocators.workspaceConfirmModal(page);
  const modalVisible = matchedModal !== null;

  if (modalVisible) {
    if (opts.resolution === 'cancel') {
      const cancelBtn = confirmModal
        .locator('[data-cl-confirm="cancel"], button:has-text("Cancel")')
        .first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await expect(confirmModal).toBeHidden();
      const afterLabId = await getActiveLabId(page);
      expect(afterLabId).toBe(opts.prevLabId);
      const files = await getPublicWorkbenchFiles(page);
      expect(files[opts.preservedFile]).toBe(opts.preservedContent);
      return { variant: 'confirm-modal', nextLabId: afterLabId };
    }

    const isolateBtn = confirmModal
      .locator('[data-cl-confirm="isolated"], button:has-text("Isolated"), button:has-text("New")')
      .first();
    await expect(isolateBtn).toBeVisible();
    await isolateBtn.click();
    await expect(confirmModal).toBeHidden();
  }

  // Wait for isolated workspace transition if not canceled
  if (opts.resolution === 'isolate') {
    await expect
      .poll(async () => await getActiveLabId(page))
      .not.toBe(opts.prevLabId);
  }

  // Regardless of Variant A or Variant B, previous workspace's saved data MUST remain intact in storage!
  const preservedInStorage = await page.evaluate(
    ({ labId, filePath }) => {
      const raw = localStorage.getItem(`sd-codelab-v1:${labId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const customFiles = parsed?.customFiles || {};
      for (const slot of Object.values(customFiles) as Array<Record<string, string>>) {
        if (slot && Object.prototype.hasOwnProperty.call(slot, filePath)) {
          return slot[filePath];
        }
      }
      return null;
    },
    { labId: opts.prevLabId, filePath: opts.preservedFile }
  );
  expect(preservedInStorage).toBe(opts.preservedContent);

  const nextLabId = await getActiveLabId(page);
  return {
    variant: modalVisible ? 'confirm-modal' : 'auto-isolated',
    nextLabId
  };
}

/**
 * Switches to a previously saved workspace via `File -> Open Recent Workspace` or host workspace switcher UI.
 * Checks `[data-cl-workspace="<target>"]:visible, [data-workspace-id="<target>"]:visible` FIRST so menus
 * rendering human-readable `WorkspaceMeta.title` (e.g. `"acme/project-alpha"`) with `labId` in data attributes
 * always match before falling back to text/slug matching.
 */
export async function switchRecentWorkspaceViaUi(
  page: Page,
  targetLabIdOrTitle: string
): Promise<void> {
  const resolvedInfo = await page
    .evaluate((target) => {
      const win = window as any;
      const storage = win.CodeLabWorkspaceStorage || win.CodeLabStorage || null;
      let list: Array<{ labId?: string; title?: string; repo?: string; updatedAt?: number }> = [];
      if (storage && typeof storage.listWorkspaces === 'function') {
        const raw = storage.listWorkspaces();
        if (Array.isArray(raw)) list = raw;
      } else if (typeof localStorage !== 'undefined') {
        try {
          const parsed = JSON.parse(localStorage.getItem('codelab:workspace-registry:v1') || '[]');
          if (Array.isArray(parsed)) {
            list = parsed
              .slice()
              .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
          }
        } catch {
          list = [];
        }
      }

      const ide = win.__codelabIde || win.__codelabTest?.ide;
      const activeLabId = String(
        (typeof ide?.getActiveLabId === 'function' ? ide.getActiveLabId() : '') ||
          ide?.labId ||
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('codelab:activeLabId') ||
              localStorage.getItem('codelab:active-workspace') ||
              localStorage.getItem('sd-codelab-v1:active-lab') ||
              ''
            : '')
      ).trim();

      const norm = target.trim().toLowerCase();
      const exactById = list.find((w) => (w.labId || '').trim().toLowerCase() === norm);
      const byRepoMatches = list.filter((w) => (w.repo || '').trim().toLowerCase() === norm);
      const byTitleMatches = list.filter((w) => (w.title || '').trim().toLowerCase() === norm);
      const fallbackMeta =
        storage && typeof storage.getWorkspaceMeta === 'function'
          ? storage.getWorkspaceMeta(target)
          : null;

      const matched =
        exactById ??
        (byRepoMatches.length === 1 ? byRepoMatches[0] : undefined) ??
        (byTitleMatches.length === 1 ? byTitleMatches[0] : undefined) ??
        fallbackMeta;

      const resolvedLabId =
        matched && typeof matched.labId === 'string' && matched.labId.trim()
          ? matched.labId.trim()
          : target;

      const matchedTitle =
        matched && typeof matched.title === 'string' && matched.title.trim()
          ? matched.title.trim()
          : '';

      const sameTitleLabIds = matchedTitle
        ? list
            .filter(
              (w) =>
                typeof w.labId === 'string' &&
                w.labId.trim().length > 0 &&
                (w.title || '').trim().toLowerCase() === matchedTitle.toLowerCase()
            )
            .map((w) => w.labId!.trim())
        : [];

      const uniqueHints: string[] = [];
      if (matchedTitle) {
        const count = list.filter(
          (w) => (w.title || '').trim().toLowerCase() === matchedTitle.toLowerCase()
        ).length;
        if (count <= 1) {
          uniqueHints.push(matchedTitle);
        }
      }
      if (matched && typeof matched.repo === 'string' && matched.repo.trim()) {
        const repoTrimmed = matched.repo.trim();
        const count = list.filter(
          (w) => (w.repo || '').trim().toLowerCase() === repoTrimmed.toLowerCase()
        ).length;
        if (count <= 1) {
          uniqueHints.push(repoTrimmed);
        }
      }

      return {
        resolvedLabId,
        matchedTitle,
        sameTitleLabIds,
        uniqueHints,
        activeLabId
      };
    }, targetLabIdOrTitle)
    .catch(() => ({
      resolvedLabId: targetLabIdOrTitle,
      matchedTitle: '',
      sameTitleLabIds: [] as string[],
      uniqueHints: [] as string[],
      activeLabId: ''
    }));

  const attrValues = Array.from(
    new Set([targetLabIdOrTitle, resolvedInfo.resolvedLabId].filter(Boolean))
  );
  const directAttrSelector = attrValues
    .flatMap((val) => {
      const esc = cssEscapeAttr(val);
      return [
        `[data-cl-workspace="${esc}"]:visible`,
        `[data-workspace-id="${esc}"]:visible`,
        `[data-lab-id="${esc}"]:visible`,
        `[data-recent-workspace="${esc}"]:visible`,
        `[data-ctx-target="${esc}"]:visible`,
        `[data-palette-id="${esc}"]:visible`,
        `[data-palette-id$=":${esc}"]:visible`,
        `[value="${esc}"]:visible`
      ];
    })
    .join(', ');

  const directVisible = page.locator(directAttrSelector).first();
  if (await directVisible.isVisible().catch(() => false)) {
    await directVisible.click();
    return;
  }

  const toBoundaryRegex = (token: string): RegExp =>
    new RegExp(`(?<![a-z0-9_/-])${escapeRegExp(token)}(?![a-z0-9_/-])`, 'i');

  const rawTokens: string[] = [
    resolvedInfo.resolvedLabId,
    targetLabIdOrTitle,
    ...resolvedInfo.uniqueHints
  ];
  for (const base of [resolvedInfo.resolvedLabId, targetLabIdOrTitle]) {
    const stripped = base.replace(/^repo-/i, '');
    if (stripped && stripped !== base) {
      rawTokens.push(stripped);
    }
  }
  const uniqueTokens = Array.from(new Set(rawTokens.map((t) => t.trim()).filter(Boolean)));

  const exactMatchers: RegExp[] = uniqueTokens.map(toBoundaryRegex);
  for (const base of [resolvedInfo.resolvedLabId, targetLabIdOrTitle]) {
    const stripped = base.replace(/^repo-/i, '');
    if (stripped && stripped !== base) {
      exactMatchers.push(
        new RegExp(
          `(?<![a-z0-9_/-])${stripped.split('-').map(escapeRegExp).join('[/-]')}(?![a-z0-9_/-])`,
          'i'
        )
      );
    }
  }
  const looseMatchers: RegExp[] = uniqueTokens.map((t) => new RegExp(escapeRegExp(t), 'i'));

  const nonWorkspaceCommandRe =
    /^\s*(?:Open\s+Recent(?:\s+Workspace)?(?:\.\.\.|…)?|Switch\s+Workspace(?:\.\.\.|…)?|New\s+Blank\s+Workspace(?:\.\.\.|…)?|New\s+Workspace(?:\.\.\.|…)?|New\s+File(?:\.\.\.|…)?|New\s+Folder(?:\.\.\.|…)?|Clone\s+Repository(?:\.\.\.|…)?|Clear\s+Recent(?:\s+Workspaces)?(?:\.\.\.|…)?)\s*$/i;
  const targetTrimmedLower = targetLabIdOrTitle.trim().toLowerCase();

  const clickMatchingCandidate = async (allowCustomButtons = false): Promise<boolean> => {
    // Stage 1: Direct attribute selector across targetLabIdOrTitle and resolvedLabId
    const attrItem = page.locator(directAttrSelector).first();
    if (await attrItem.isVisible().catch(() => false)) {
      await attrItem.click();
      return true;
    }

    const itemSelector = allowCustomButtons
      ? ':is([role="menu"]:visible [role="menuitem"], [data-cl-workspace]:visible, [data-workspace-id]:visible, [data-lab-id]:visible, [data-recent-workspace]:visible, [role="option"]:visible, .codelab-palette-item:visible, button:visible:not(#workspace-switcher-btn):not([data-cl-action="switch-workspace"]):not([role="menubar"] *))'
      : ':is([role="menu"]:visible [role="menuitem"], [data-cl-workspace]:visible, [data-workspace-id]:visible, [data-lab-id]:visible, [data-recent-workspace]:visible, [role="option"]:visible, .codelab-palette-item:visible)';

    const candidates = page.locator(itemSelector);
    const count = await candidates.count().catch(() => 0);
    if (count === 0) {
      return false;
    }

    const visibleCandidates: Array<{ locator: Locator; text: string }> = [];
    for (let i = 0; i < count; i++) {
      const loc = candidates.nth(i);
      if (!(await loc.isVisible().catch(() => false))) continue;
      const rawText = await loc
        .innerText()
        .catch(async () => (await loc.textContent().catch(() => '')) || '');
      const text = rawText.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (text.toLowerCase() !== targetTrimmedLower && nonWorkspaceCommandRe.test(text)) {
        continue;
      }
      visibleCandidates.push({ locator: loc, text });
    }

    if (visibleCandidates.length === 0) {
      return false;
    }

    // Stage 2: Scan ALL visible rows 0..count-1 against boundary-anchored exactMatchers FIRST
    for (const matcher of exactMatchers) {
      for (const cand of visibleCandidates) {
        if (matcher.test(cand.text)) {
          await cand.locator.click();
          return true;
        }
      }
    }

    // Stage 3a: Duplicate-title listWorkspaces() positional tie-breaker
    if (resolvedInfo.matchedTitle && resolvedInfo.sameTitleLabIds.length > 1) {
      const normTitle = resolvedInfo.matchedTitle.toLowerCase();
      const titleBoundaryRe = toBoundaryRegex(resolvedInfo.matchedTitle);
      const exactTitleItems = visibleCandidates.filter(
        (cand) => cand.text.toLowerCase() === normTitle
      );
      const matchingItems =
        exactTitleItems.length > 0
          ? exactTitleItems
          : visibleCandidates.filter((cand) => titleBoundaryRe.test(cand.text));

      if (matchingItems.length === resolvedInfo.sameTitleLabIds.length) {
        const idx = resolvedInfo.sameTitleLabIds.indexOf(resolvedInfo.resolvedLabId);
        if (idx >= 0 && idx < matchingItems.length) {
          await matchingItems[idx].locator.click();
          return true;
        }
      } else if (resolvedInfo.activeLabId) {
        const nonActiveSameTitleLabIds = resolvedInfo.sameTitleLabIds.filter(
          (id) => id !== resolvedInfo.activeLabId
        );
        if (matchingItems.length === nonActiveSameTitleLabIds.length) {
          const idx = nonActiveSameTitleLabIds.indexOf(resolvedInfo.resolvedLabId);
          if (idx >= 0 && idx < matchingItems.length) {
            await matchingItems[idx].locator.click();
            return true;
          }
        }
      }
    }

    // Stage 3b: Loose unanchored substring fallback on unique tokens only
    for (const matcher of looseMatchers) {
      for (const cand of visibleCandidates) {
        if (matcher.test(cand.text)) {
          await cand.locator.click();
          return true;
        }
      }
    }

    return false;
  };

  const wsTrigger = page
    .locator(
      '[data-cl-action="switch-workspace"], #workspace-switcher-btn, [aria-label*="Workspace" i][aria-haspopup]'
    )
    .first();
  if (await wsTrigger.isVisible().catch(() => false)) {
    await wsTrigger.click();
    await page
      .locator(
        '[role="menu"]:visible, [role="listbox"]:visible, .codelab-palette:visible, [data-cl-workspace]:visible, [data-workspace-id]:visible, [data-lab-id]:visible, [data-recent-workspace]:visible'
      )
      .first()
      .waitFor({ state: 'visible', timeout: 250 })
      .catch(() => {});

    if (await clickMatchingCandidate(true)) {
      return;
    }

    // Close wsTrigger popup cleanly before falling back to File -> Open Recent Workspace
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
  }

  const fileMenu = await openTopMenu(page, 'File');
  if (await clickMatchingCandidate(false)) {
    return;
  }

  const recentItem = fileMenu
    .locator('[role="menuitem"]')
    .filter({ hasText: /Open Recent|Switch Workspace/i })
    .first();
  await expect(recentItem).toBeVisible();
  await recentItem.hover();
  await page.waitForTimeout(60);

  if (await clickMatchingCandidate(false)) {
    return;
  }

  // Fallback if submenu/picker opens on click rather than hover
  if (await recentItem.isVisible().catch(() => false)) {
    await recentItem.click();
    await page.waitForTimeout(60);
    if (await clickMatchingCandidate(true)) {
      return;
    }
  }

  const fallbackMatcher =
    exactMatchers[0] ?? looseMatchers[0] ?? new RegExp(escapeRegExp(targetLabIdOrTitle), 'i');
  const fallbackLocator = page
    .locator(directAttrSelector)
    .or(
      page
        .locator(
          '[role="menu"]:visible [role="menuitem"], [role="option"]:visible, .codelab-palette-item:visible'
        )
        .filter({ hasText: fallbackMatcher })
    )
    .first();
  await expect(fallbackLocator).toBeVisible();
  await fallbackLocator.click();
}

/**
 * Parses CSS `rgb(...)`, `rgba(...)`, `color(srgb ...)`, `'transparent'`, or `#hex` color strings
 * into `[r, g, b, a]` (`0..255`, `a` in `0..1`).
 */
export function parseCssColor(css: string): [number, number, number, number] {
  const trimmed = (css || '').trim().toLowerCase();
  if (trimmed === 'transparent') {
    return [0, 0, 0, 0];
  }
  const srgbMatch = trimmed.match(
    /^color\(\s*srgb\s+([+-]?[\d.]+%?|none)\s+([+-]?[\d.]+%?|none)\s+([+-]?[\d.]+%?|none)(?:\s*\/\s*([+-]?[\d.]+%?|none))?\s*\)$/
  );
  if (srgbMatch) {
    const parseSrgbChannel = (tok: string): number => {
      if (tok === 'none') return 0;
      const v = tok.endsWith('%') ? Number(tok.slice(0, -1)) / 100 : Number(tok);
      return Math.max(0, Math.min(255, v * 255));
    };
    const r = parseSrgbChannel(srgbMatch[1]);
    const g = parseSrgbChannel(srgbMatch[2]);
    const b = parseSrgbChannel(srgbMatch[3]);
    let a = 1;
    if (srgbMatch[4] !== undefined) {
      if (srgbMatch[4] === 'none') {
        a = 0;
      } else {
        const rawA = srgbMatch[4].endsWith('%')
          ? Number(srgbMatch[4].slice(0, -1)) / 100
          : Number(srgbMatch[4]);
        a = Math.max(0, Math.min(1, rawA));
      }
    }
    return [r, g, b, a];
  }
  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
  );
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    let a = 1;
    if (rgbaMatch[4] !== undefined) {
      a = rgbaMatch[4].endsWith('%')
        ? Number(rgbaMatch[4].slice(0, -1)) / 100
        : Number(rgbaMatch[4]);
    }
    return [r, g, b, a];
  }
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1
      ];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      ];
    }
  }
  throw new Error(`Unsupported CSS color format: "${css}"`);
}

function channelToLinear(c255: number): number {
  const s = Math.max(0, Math.min(255, c255)) / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.1 relative luminance (`0.0` darkest .. `1.0` lightest).
 */
export function computeRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb;
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/**
 * Computes WCAG 2.1 contrast ratio (`1.0` .. `21.0`) between foreground and background CSS colors.
 * Alpha-blends `fgCss` onto `bgCss` if `fgCss` is semi-transparent.
 */
export function computeContrastRatio(fgCss: string, bgCss: string): number {
  const [fr, fg, fb, fa] = parseCssColor(fgCss);
  const [br, bg, bb] = parseCssColor(bgCss);
  const effectiveFg: [number, number, number] = [
    fr * fa + br * (1 - fa),
    fg * fa + bg * (1 - fa),
    fb * fa + bb * (1 - fa)
  ];
  const lum1 = computeRelativeLuminance(effectiveFg);
  const lum2 = computeRelativeLuminance([br, bg, bb]);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Reads an element's computed `color` and effective rendered `backgroundColor`, resolving CSS Color 4
 * formats (`color(srgb ...)`, `color-mix(...)`, `oklch(...)`, etc.) via exact sRGB parsing + `1x1` 2D
 * `<canvas>` fallback and alpha-compositing semi-transparent ancestor backgrounds back-to-front onto the
 * active theme root canvas (`[255, 255, 255]` light vs `[0, 0, 0]` dark/high-contrast).
 */
export async function getEffectiveColors(
  locator: Locator
): Promise<{ fg: string; bg: string; ratio: number }> {
  const { fgRgba, bgRgb } = await locator.evaluate((el) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;

    const toRgba = (css: string): [number, number, number, number] => {
      const t = (css || '').trim().toLowerCase();
      if (!t || t === 'transparent') return [0, 0, 0, 0];
      const rgbaM = t.match(
        /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
      );
      if (rgbaM) {
        const a =
          rgbaM[4] === undefined
            ? 1
            : rgbaM[4].endsWith('%')
              ? Number(rgbaM[4].slice(0, -1)) / 100
              : Number(rgbaM[4]);
        return [
          Number(rgbaM[1]),
          Number(rgbaM[2]),
          Number(rgbaM[3]),
          Math.max(0, Math.min(1, a))
        ];
      }
      const srgbM = t.match(
        /^color\(\s*srgb\s+([+-]?[\d.]+%?|none)\s+([+-]?[\d.]+%?|none)\s+([+-]?[\d.]+%?|none)(?:\s*\/\s*([+-]?[\d.]+%?|none))?\s*\)$/
      );
      if (srgbM) {
        const ch = (tok: string): number =>
          tok === 'none'
            ? 0
            : Math.max(
                0,
                Math.min(255, (tok.endsWith('%') ? Number(tok.slice(0, -1)) / 100 : Number(tok)) * 255)
              );
        const a =
          srgbM[4] === undefined
            ? 1
            : srgbM[4] === 'none'
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    1,
                    srgbM[4].endsWith('%') ? Number(srgbM[4].slice(0, -1)) / 100 : Number(srgbM[4])
                  )
                );
        return [ch(srgbM[1]), ch(srgbM[2]), ch(srgbM[3]), a];
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };

    const fgRgba = toRgba(window.getComputedStyle(el).color);
    const layers: Array<[number, number, number, number]> = [];
    let cur: Element | null = el;
    while (cur) {
      const rgba = toRgba(window.getComputedStyle(cur).backgroundColor);
      if (rgba[3] > 0) {
        layers.push(rgba);
        if (rgba[3] >= 0.999) break;
      }
      cur = cur.parentElement;
    }

    const themeHost = el.closest(
      '[data-cl-theme], [data-theme], .cl-theme-light, .cl-theme-dark, .cl-theme-hc'
    );
    const explicitTheme =
      themeHost?.getAttribute('data-cl-theme') ||
      themeHost?.getAttribute('data-theme') ||
      (themeHost?.classList.contains('cl-theme-light')
        ? 'light'
        : themeHost?.classList.contains('cl-theme-dark') || themeHost?.classList.contains('cl-theme-hc')
          ? 'dark'
          : null) ||
      document.documentElement.getAttribute('data-cl-theme') ||
      document.documentElement.getAttribute('data-theme');
    const computedScheme =
      window.getComputedStyle(el).colorScheme ||
      window.getComputedStyle(document.documentElement).colorScheme;
    const isLight = explicitTheme === 'light' || (!explicitTheme && computedScheme === 'light');

    let base: [number, number, number] = isLight ? [255, 255, 255] : [0, 0, 0];
    for (let i = layers.length - 1; i >= 0; i--) {
      const [r, g, b, a] = layers[i];
      base = [
        Math.round(r * a + base[0] * (1 - a)),
        Math.round(g * a + base[1] * (1 - a)),
        Math.round(b * a + base[2] * (1 - a))
      ];
    }
    return { fgRgba, bgRgb: base };
  });

  const fg = `rgba(${Math.round(fgRgba[0])}, ${Math.round(fgRgba[1])}, ${Math.round(fgRgba[2])}, ${Number(fgRgba[3].toFixed(4))})`;
  const bg = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;
  return { fg, bg, ratio: computeContrastRatio(fg, bg) };
}

/**
 * Returns a normalized `BoundingRect` (`left`, `top`, `right`, `bottom`, `width`, `height`) for a visible locator.
 */
export async function getRect(locator: Locator): Promise<BoundingRect> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x,
    y: box!.y,
    width: box!.width,
    height: box!.height,
    left: box!.x,
    top: box!.y,
    right: box!.x + box!.width,
    bottom: box!.y + box!.height
  };
}

/**
 * Asserts two sibling layout regions do NOT overlap (`tolerancePx` defaults to `1.5px` subpixel rounding).
 */
export function assertNoOverlap(
  rectA: BoundingRect,
  rectB: BoundingRect,
  labelA = 'RegionA',
  labelB = 'RegionB',
  tolerancePx = 1.5
): void {
  const separatedHorizontally =
    rectA.right <= rectB.left + tolerancePx || rectB.right <= rectA.left + tolerancePx;
  const separatedVertically =
    rectA.bottom <= rectB.top + tolerancePx || rectB.bottom <= rectA.top + tolerancePx;

  expect(
    separatedHorizontally || separatedVertically,
    `Expected ${labelA} (${JSON.stringify(rectA)}) and ${labelB} (${JSON.stringify(rectB)}) not to overlap`
  ).toBe(true);
}

/**
 * Asserts `PROJECT.md §5.1` 5-Region Sidebar–Bottom Panel Geometry Invariant:
 *   1. `sidebarRect.bottom > drawerRect.top` (Sidebar spans full vertical height down to Status Bar)
 *   2. `drawerRect.left >= sidebarRect.right - 1.5` (Bottom Panel sits strictly to the right of Sidebar)
 *   3. `#cl-terminal-surface` NEVER renders inside `aside.codelab-sidebar`
 */
export async function assertSidebarDrawerSeparation(page: Page): Promise<{
  sidebarRect: BoundingRect;
  drawerRect: BoundingRect;
}> {
  const sidebar = workbenchLocators.sidebar(page);
  const drawer = workbenchLocators.drawer(page);
  await expect(sidebar).toBeVisible();
  await expect(drawer).toBeVisible();

  await expect(sidebar.locator('#cl-terminal-surface')).toHaveCount(0);

  const sidebarRect = await getRect(sidebar);
  const drawerRect = await getRect(drawer);

  expect(sidebarRect.bottom).toBeGreaterThan(drawerRect.top + 20);
  expect(drawerRect.left).toBeGreaterThanOrEqual(sidebarRect.right - 1.5);
  assertNoOverlap(sidebarRect, drawerRect, 'PrimarySidebar', 'BottomDrawer');

  return { sidebarRect, drawerRect };
}
