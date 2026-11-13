import { test, expect } from '@playwright/test';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Real Chromium E2E Spec: Modular IDE Workbench & `@innovatorved/code-lab/sql`
 *
 * Verifies in real headless Chromium:
 *   1. Modular IDE Workbench:
 *      - File creation & renaming, running code, terminal command
 *      - Native `<dialog closedby="any">` Settings UI (`openSettings()`, search, live toggle)
 *      - Live `.codelab/settings.json` update changing editor `fontSize` & theme with zero reload
 *      - Command Palette (`Cmd/Ctrl+K`), Quick Open, reload persistence, Observability drawer,
 *        and declarative Plugin contribution
 *   2. Standalone `@innovatorved/code-lab/sql` (`/tests/browser/fixtures/sql.html`) & SQL Guided Lab:
 *      - `SELECT o.` with `FROM customers c JOIN orders o` alias completion listbox (`role="listbox"`)
 *      - Schema pill `insertAtCursor`
 *      - `Control+Enter` selected vs full SQL execution (`effectiveSql`)
 *      - Inline wavy error diagnostics + ARIA live status
 *      - `Escape` -> `Tab` moving focus cleanly to the next focusable button (WCAG 2.1.2)
 *      - Live `<html data-theme="light">` MutationObserver sync
 *      - Zero uncaught `pageerror` exceptions
 * ═══════════════════════════════════════════════════════════════════════════════
 */

test.describe('Modular IDE Workbench in Chromium', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  });

  test('settings <dialog>, live .codelab/settings.json sync, command palette, observability, and plugins work with 0 page errors', async ({
    page
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/tests/browser/fixtures/');
    await expect(page.locator('.codelab-workbench')).toBeVisible();

    // 1. Open native <dialog> Settings UI, filter settings, and close cleanly
    await page.evaluate(() => (window as any).__codelabTest.ide.openSettings());
    const dialog = page.locator('dialog.cl-settings-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('closedby', 'any');

    const searchInput = dialog.locator('[data-role="settings-search"]');
    await searchInput.fill('fontSize');
    await expect(dialog.locator('[data-role="settings-list"]')).toContainText('Font Size');

    await dialog.locator('[data-settings-action="close"]').click();
    await expect(dialog).toBeHidden();

    // 2. Live .codelab/settings.json edit updates editor fontSize & theme without page reload
    await page.evaluate(() => {
      const ide = (window as any).__codelabTest.ide;
      ide.createFile(
        '.codelab/settings.json',
        JSON.stringify(
          {
            'editor.fontSize': 19,
            'workbench.colorTheme': 'light'
          },
          null,
          2
        )
      );
      ide._syncDotCodelabConfig();
    });

    const fontSizeAfter = await page.evaluate(() =>
      (window as any).__codelabTest.ide.configuration.get('editor.fontSize')
    );
    expect(fontSizeAfter).toBe(19);
    await expect(page.locator('.codelab')).toHaveAttribute('data-cl-theme', 'light');

    // 3. File create + rename + run code + Command Palette + Quick Open + Observability panel
    await page.evaluate(async () => {
      const ide = (window as any).__codelabTest.ide;
      ide.createFile('utils.js', 'module.exports = { answer: 42 };\n');
      ide.renameFile('utils.js', 'math-utils.js');
      ide.files['index.js'] = 'const { answer } = require("./math-utils.js");\nconsole.log("ANSWER=" + answer);\n';
      await ide.runDemo();
    });

    const hasRenamed = await page.evaluate(() =>
      Boolean((window as any).__codelabTest.ide.files['math-utils.js'])
    );
    expect(hasRenamed).toBe(true);

    // Command palette & Quick Open
    await page.evaluate(() => (window as any).__codelabTest.ide.openCommandPalette('files'));
    await expect(page.locator('#cl-palette-input')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as any).__codelabTest.ide.openCommandPalette('commands'));
    await expect(page.locator('#cl-palette-input')).toBeVisible();
    await page.keyboard.press('Escape');

    // Register a custom plugin contributing a drawer tab & switch to Observability tab
    await page.evaluate(() => {
      const ide = (window as any).__codelabTest.ide;
      ide.registerPlugin({
        id: 'e2e.metrics-plugin',
        name: 'E2E Metrics Plugin',
        version: '1.0.0',
        contributes: {
          panels: [
            {
              id: 'e2e-custom-panel',
              title: 'E2E Panel',
              location: 'drawer',
              render(el: HTMLElement) {
                el.innerHTML = '<div id="e2e-plugin-rendered">Plugin Drawer Ready</div>';
              }
            }
          ]
        }
      });
      ide.switchDrawerTab('e2e-custom-panel');
    });
    await expect(page.locator('#e2e-plugin-rendered')).toHaveText('Plugin Drawer Ready');

    await page.click('[data-cl-drawertab="observability"]');
    await expect(page.locator('.cl-observability-panel')).toContainText('e2e.metrics-plugin');

    // 4. Reload persistence check
    await page.reload();
    await expect(page.locator('.codelab-workbench')).toBeVisible();
    const persistedAfterReload = await page.evaluate(() =>
      Boolean((window as any).__codelabTest.ide.files['math-utils.js'])
    );
    expect(persistedAfterReload).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('SQL Guided Lab workbench hides multi-file chrome and verifies steps via sqlRunner', async ({
    page
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/tests/browser/fixtures/');
    await page.evaluate(() => {
      (window as any).__codelabTest.unmount();
      (window as any).__codelabTest.mount({
        lang: 'sql',
        sqlDialect: 'postgres',
        persistState: false,
        code: 'SELECT id, email FROM customers ORDER BY id;',
        steps: [
          { id: 's1', title: 'List Customers', instructions: 'Select id and email ordered by id.' }
        ],
        sqlRunner: async () => ({
          columns: ['id', 'email'],
          rows: [
            [1, 'ada@ analytical.org'],
            [2, 'grace@compiler.org']
          ],
          rowCount: 2,
          durationMs: 1.4,
          verification: { passed: true, message: 'All customers returned!' }
        })
      });
    });

    await expect(page.locator('.codelab.is-sql-single-file')).toBeVisible();
    await expect(page.locator('.codelab-explorer')).toBeHidden();

    await page.evaluate(() => (window as any).__codelabTest.ide.runSql('verify'));
    await expect(page.locator('.cl-sql-results-table')).toBeVisible();
    await expect(page.locator('.cl-sql-results-table')).toContainText('grace@compiler.org');
    expect(pageErrors).toEqual([]);
  });
});

test.describe('Standalone @innovatorved/code-lab/sql in Chromium', () => {
  test('alias autocomplete, schema pill insert, selection execution, wavy diagnostics, Esc->Tab focus escape, and theme sync', async ({
    page
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/tests/browser/fixtures/sql.html');
    const textarea = page.locator('.cl-sql-textarea');
    await expect(textarea).toBeVisible();

    // 1. Typing `SELECT o.` with `FROM customers c JOIN orders o` opens alias completion popup
    await page.evaluate(() => {
      (window as any).__sqlEditor.setValue('SELECT  FROM customers c JOIN orders o ON o.customer_id = c.id;');
    });
    await textarea.focus();
    await page.evaluate(() => {
      const ta = document.querySelector('.cl-sql-textarea') as HTMLTextAreaElement;
      ta.selectionStart = 7;
      ta.selectionEnd = 7;
    });
    await page.keyboard.type('o.');

    const listbox = page.locator('.cl-sql-completions[data-open="true"]');
    await expect(listbox).toBeVisible();
    await expect(listbox).toContainText('total_cents');
    await expect(listbox).toContainText('PK');

    // Accept completion with Tab or Enter, or close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('.cl-sql-completions')).toHaveAttribute('data-open', 'false');

    // 2. Clickable schema pill inserts column at cursor
    await page.click('#pill-total-cents');
    const valAfterPill = await page.evaluate(() => (window as any).__sqlEditor.getValue());
    expect(valAfterPill).toContain('o.total_cents');

    // 3. Ctrl+Enter with selected SQL executes ONLY the selection
    await page.evaluate(() => {
      const ed = (window as any).__sqlEditor;
      ed.setValue('SELECT 1 AS first_q;\nSELECT 2 AS second_q;');
      const ta = document.querySelector('.cl-sql-textarea') as HTMLTextAreaElement;
      ta.focus();
      ta.selectionStart = 'SELECT 1 AS first_q;\n'.length;
      ta.selectionEnd = ed.getValue().length;
    });
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#run-log')).toHaveText('SELECT 2 AS second_q;');

    // 4. Inline wavy error diagnostic + ARIA status banner
    await page.evaluate(() => {
      const ed = (window as any).__sqlEditor;
      const sql = 'SELECT missing_col FROM orders;';
      ed.setValue(sql);
      const diag = (window as any).CodeLabSql.parseSqlEngineError(
        { message: 'ERROR: column "missing_col" does not exist', position: '8' },
        sql,
        'postgres'
      );
      ed.setDiagnostics([diag]);
    });
    await expect(page.locator('.cl-sql-diag-error')).toBeVisible();
    await expect(page.locator('.cl-sql-diagnostics')).toContainText('missing_col');

    // 5. WCAG 2.1.2 No Keyboard Trap: Escape -> Tab moves focus cleanly out of editor
    await textarea.focus();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(textarea).not.toBeFocused();
    await expect(page.locator('#next-focusable-input')).toBeFocused();

    // 6. Live <html data-theme="light"> MutationObserver sync when editor theme is 'auto'
    await page.evaluate(() => {
      (window as any).__sqlEditor.setTheme('auto');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await expect(page.locator('.cl-sql-root')).toHaveAttribute('data-cl-sql-theme', 'light');

    expect(pageErrors).toEqual([]);
  });
});
