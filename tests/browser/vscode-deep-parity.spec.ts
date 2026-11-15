import { test, expect, type Page } from '@playwright/test';

interface TestWindow extends Window {
  monaco?: {
    editor: {
      getModels: () => Array<{ uri: { toString: () => string }; getValue: () => string }>;
      getModelMarkers: (filter: { owner?: string }) => Array<{
        message: string;
        severity: number;
      }>;
    };
    languages: {
      typescript: {
        typescriptDefaults: {
          getCompilerOptions: () => Record<string, unknown>;
        };
      };
    };
  };
  __codelabTest: {
    mount: (options?: Record<string, unknown>) => boolean;
    unmount: () => void;
    ide: Record<string, unknown> & {
      files: Record<string, string>;
      activeFile: string;
      drawerCollapsed: boolean;
      terminalSplitSessionId: string | null;
      vfs: {
        existsSync: (path: string) => boolean;
        readFileSync: (path: string, enc?: string) => string;
      };
      shell: {
        execute: (
          cmd: string,
          opts?: Record<string, unknown>
        ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
      };
      editor?: {
        getValue: () => string;
        setPosition: (pos: { lineNumber: number; column: number }) => void;
        trigger: (source: string, handlerId: string, payload: unknown) => void;
      };
      openFile: (path: string) => void;
      setFile: (path: string, content: string) => void;
      openSettings: () => void;
      setTheme: (theme: string) => void;
      toggleCommandPalette: (force?: boolean, prefix?: string) => void;
      interruptTerminal: () => boolean;
      splitActiveTerminalSession: () => unknown;
      setSidebarView: (view: string, opts?: Record<string, unknown>) => void;
      openScmDiff: (path: string) => boolean;
      _submitInteractiveTerminalStdin: (line: string | null) => boolean;
    };
  };
}

async function routeLocalMonaco(page: Page): Promise<void> {
  await page.route('https://cdn.jsdelivr.net/**', async (route, request) => {
    const url = request.url();
    const monacoPrefix = '/npm/monaco-editor@';
    const idx = url.indexOf(monacoPrefix);
    if (idx !== -1) {
      const afterVer = url.slice(idx + monacoPrefix.length);
      const slashIdx = afterVer.indexOf('/min/vs/');
      if (slashIdx !== -1) {
        const subPath = afterVer.slice(slashIdx); // "/min/vs/..."
        const localUrl = new URL(`/node_modules/monaco-editor${subPath}`, page.url()).toString();
        const resp = await page.request.get(localUrl);
        await route.fulfill({
          status: resp.status(),
          headers: resp.headers(),
          body: await resp.body()
        });
        return;
      }
    }
    await route.abort();
  });
}

test.describe('VS Code Browser-Native Deep Parity Suite', () => {
  test('bottom panel supports complete 0px collapse via close, status bar, shortcut, and splitter drag-down while keeping actions pinned', async ({
    page
  }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.setViewportSize({ width: 800, height: 700 });
    await page.goto('/tests/browser/fixtures/');

    const drawer = page.locator('#cl-drawer');
    await expect(drawer).toBeVisible();
    await page.click('[data-cl-drawertab="terminal"]');

    // Right-side panel action buttons remain pinned and visible even on 800px width
    const actionBounds = await page.evaluate(() => {
      const header = document.querySelector('.codelab-drawer__bar')!.getBoundingClientRect();
      const closeBtn = document.querySelector('#cl-close-drawer-btn')!.getBoundingClientRect();
      const maxBtn = document.querySelector('#cl-maximize-drawer-btn')!.getBoundingClientRect();
      const splitBtn = document.querySelector('#cl-split-terminal-btn')!.getBoundingClientRect();
      return {
        headerRight: header.right,
        closeRight: closeBtn.right,
        closeWidth: closeBtn.width,
        maxWidth: maxBtn.width,
        splitWidth: splitBtn.width
      };
    });
    expect(actionBounds.closeWidth).toBeGreaterThan(16);
    expect(actionBounds.maxWidth).toBeGreaterThan(16);
    expect(actionBounds.splitWidth).toBeGreaterThan(16);
    expect(actionBounds.closeRight).toBeLessThanOrEqual(actionBounds.headerRight + 2);

    // 1. Close button (x) collapses panel completely to 0px
    await page.click('#cl-close-drawer-btn');
    await expect(drawer).toBeHidden();
    const collapsedHeight = await page.evaluate(
      () => document.querySelector('#cl-drawer')!.getBoundingClientRect().height
    );
    expect(collapsedHeight).toBe(0);

    // 2. Status bar panel toggle reopens and re-collapses
    await page.click('#cl-status-panel-toggle');
    await expect(drawer).toBeVisible();
    await page.click('#cl-status-panel-toggle');
    await expect(drawer).toBeHidden();

    // 3. Ctrl+J / Meta+J keyboard shortcut toggles panel open
    await page.keyboard.press('Control+j');
    await expect(drawer).toBeVisible();

    // 4. Dragging #cl-splitter-h all the way down (< 56px) snaps panel completely closed
    const splitterBox = await page.locator('#cl-splitter-h').boundingBox();
    expect(splitterBox).not.toBeNull();
    await page.mouse.move(
      splitterBox!.x + splitterBox!.width / 2,
      splitterBox!.y + splitterBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(splitterBox!.x + splitterBox!.width / 2, 685, { steps: 8 });
    await page.mouse.up();

    await expect(drawer).toBeHidden();
    const snappedCollapsed = await page.evaluate(
      () => (window as unknown as TestWindow).__codelabTest.ide.drawerCollapsed
    );
    expect(snappedCollapsed).toBe(true);
  });

  test('top navbar hides JS|TS|PY|C++ switcher in IDE mode, updates status bar language per file, and keeps switcher in Guided Lab mode', async ({
    page
  }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.goto('/tests/browser/fixtures/');

    await page.evaluate(() => {
      const win = window as unknown as TestWindow;
      win.__codelabTest.unmount();
      win.__codelabTest.mount({
        files: {
          'index.js': 'console.log(1);\n',
          'utils.ts': 'export const x: number = 2;\n',
          'script.py': 'print(3)\n',
          'main.cpp': 'int main() { return 0; }\n'
        },
        entry: 'index.js'
      });
    });

    await expect(page.locator('.codelab-topbar .codelab-lang-switch')).toHaveCount(0);
    await expect(page.locator('#cl-status-lang')).toHaveText('JavaScript');

    await page.evaluate(() => (window as unknown as TestWindow).__codelabTest.ide.openFile('utils.ts'));
    await expect(page.locator('#cl-status-lang')).toHaveText('TypeScript');

    await page.evaluate(() => (window as unknown as TestWindow).__codelabTest.ide.openFile('script.py'));
    await expect(page.locator('#cl-status-lang')).toHaveText('Python');

    await page.evaluate(() => (window as unknown as TestWindow).__codelabTest.ide.openFile('main.cpp'));
    await expect(page.locator('#cl-status-lang')).toHaveText('C++');

    // Remount in Guided Lab mode -> switcher IS present
    await page.evaluate(() => {
      const win = window as unknown as TestWindow;
      win.__codelabTest.unmount();
      win.__codelabTest.mount({
        files: { 'solution.js': 'export function solve() {}\n' },
        filesTs: { 'solution.ts': 'export function solve(): void {}\n' },
        steps: [{ id: 's1', title: 'Step 1', instructions: 'Implement solve()' }]
      });
    });
    await expect(page.locator('.codelab-topbar .codelab-lang-switch')).toBeVisible();
  });

  test('real @xterm/xterm PTY, Worker Ctrl+C infinite loop termination, interactive read stdin, and split terminal panes', async ({
    page
  }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.goto('/tests/browser/fixtures/');

    await page.evaluate(() => {
      const win = window as unknown as TestWindow;
      win.__codelabTest.unmount();
      win.__codelabTest.mount({
        terminalEngine: 'xterm',
        drawerTab: 'terminal',
        files: {
          'index.js': 'console.log("ready");\n'
        }
      });
    });

    await expect(page.locator('#cl-terminal-surface.codelab-terminal--xterm')).toBeVisible();
    await expect(page.locator('#cl-terminal-surface .xterm-screen')).toBeVisible();

    // Split terminal creates 2 side-by-side terminal panes
    await page.click('#cl-split-terminal-btn');
    await expect(page.locator('.codelab-terminal-split-grid.is-split')).toBeVisible();
    await expect(page.locator('.codelab-terminal-split-pane')).toHaveCount(2);

    // Interactive `read` stdin round-trip
    const readResult = await page.evaluate(async () => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      const execPromise = ide.shell.execute('read -p "Name: " WHO && echo "HELLO_${WHO}"');
      await new Promise((r) => setTimeout(r, 40));
      ide._submitInteractiveTerminalStdin('CODELAB');
      return execPromise;
    });
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout).toContain('HELLO_CODELAB');

    // Worker-backed `node -e "while(true){}"` killed cleanly via interruptTerminal() (Ctrl+C)
    const interruptResult = await page.evaluate(async () => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      const startedAt = Date.now();
      const loopPromise = ide.shell.execute('node -e "while(true){}"');
      await new Promise((r) => setTimeout(r, 120));
      const interrupted = ide.interruptTerminal();
      const res = await loopPromise;
      return {
        interrupted,
        elapsedMs: Date.now() - startedAt,
        exitCode: res.exitCode
      };
    });
    expect(interruptResult.interrupted).toBe(true);
    expect(interruptResult.exitCode).toBe(130);
    expect(interruptResult.elapsedMs).toBeLessThan(3000);
  });

  test('Git engine honors .gitignore, emits unified hunk diffs, stashes WIP, switches working-tree branches, and syncs .git', async ({
    page
  }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.goto('/tests/browser/fixtures/');

    const gitFlow = await page.evaluate(async () => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      ide.setFile('.gitignore', 'dist/\n*.log\n');
      ide.setFile('dist/out.js', 'ignored bundle\n');
      ide.setFile('debug.log', 'ignored log\n');
      ide.setFile('app.ts', 'export const v = 1;\nfoo();\nbar();\n');

      await ide.shell.execute('git init');
      const statusBeforeCommit = await ide.shell.execute('git status');
      await ide.shell.execute('git add .');
      await ide.shell.execute('git commit -m "initial commit"');

      // Modify app.ts and inspect unified hunk diff
      ide.setFile('app.ts', 'export const v = 2;\nfoo();\nbar();\n');
      const diffOut = await ide.shell.execute('git diff');

      // Stash WIP and pop it back
      await ide.shell.execute('git stash');
      const afterStashVal = ide.vfs.readFileSync('/workspace/app.ts', 'utf8');
      await ide.shell.execute('git stash pop');
      const afterPopVal = ide.vfs.readFileSync('/workspace/app.ts', 'utf8');

      // Discard WIP cleanly, create feature branch, add feature.ts, then switch back to main
      await ide.shell.execute('git checkout -- app.ts');
      await ide.shell.execute('git checkout -b feat/branch-isolation');
      ide.setFile('feature.ts', 'export const feature = true;\n');
      await ide.shell.execute('git add feature.ts');
      await ide.shell.execute('git commit -m "add feature"');
      const existsOnFeature = ide.vfs.existsSync('/workspace/feature.ts');

      await ide.shell.execute('git checkout main');
      const existsOnMain = ide.vfs.existsSync('/workspace/feature.ts');

      await ide.shell.execute('git checkout feat/branch-isolation');
      const restoredOnFeature = ide.vfs.existsSync('/workspace/feature.ts');

      return {
        statusStdout: statusBeforeCommit.stdout,
        diffStdout: diffOut.stdout,
        afterStashVal,
        afterPopVal,
        existsOnFeature,
        existsOnMain,
        restoredOnFeature,
        hasIsoGitHead: ide.vfs.existsSync('/workspace/.git/HEAD')
      };
    });

    expect(gitFlow.statusStdout).not.toContain('dist/out.js');
    expect(gitFlow.statusStdout).not.toContain('debug.log');
    expect(gitFlow.statusStdout).toContain('app.ts');
    expect(gitFlow.diffStdout).toContain('@@ -1,3 +1,3 @@');
    expect(gitFlow.diffStdout).toContain('-export const v = 1;');
    expect(gitFlow.diffStdout).toContain('+export const v = 2;');
    expect(gitFlow.afterStashVal).toContain('export const v = 1;');
    expect(gitFlow.afterPopVal).toContain('export const v = 2;');
    expect(gitFlow.existsOnFeature).toBe(true);
    expect(gitFlow.existsOnMain).toBe(false);
    expect(gitFlow.restoredOnFeature).toBe(true);
    expect(gitFlow.hasIsoGitHead).toBe(true);
  });

  test('browser-native Monaco intelligence: cross-file TS imports, live tsconfig sync, HTML auto-close tags, Monaco SCM diff, and fuzzy Command Palette', async ({
    page
  }) => {
    await routeLocalMonaco(page);
    await page.goto('/tests/browser/fixtures/');

    await page.evaluate(() => {
      const win = window as unknown as TestWindow;
      win.__codelabTest.unmount();
      win.__codelabTest.mount({
        files: {
          'tsconfig.json': JSON.stringify(
            {
              compilerOptions: {
                strict: true,
                target: 'ES2022',
                moduleResolution: 'bundler'
              }
            },
            null,
            2
          ),
          'math.ts': 'export function multiply(a: number, b: number): number {\n  return a * b;\n}\n',
          'main.ts': 'import { multiply } from "./math";\nexport const answer: number = multiply(6, 7);\n',
          'index.html': '<!doctype html>\n<body>\n  \n</body>\n'
        },
        entry: 'main.ts'
      });
    });

    // Wait for real Monaco models to hydrate
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const m = (window as unknown as TestWindow).monaco;
            return m ? m.editor.getModels().length : 0;
          }),
        { timeout: 15000 }
      )
      .toBeGreaterThanOrEqual(3);

    // Give TS worker a moment to validate cross-file import `./math` -> zero error markers!
    await page.waitForTimeout(800);
    const tsErrors = await page.evaluate(() => {
      const m = (window as unknown as TestWindow).monaco!;
      return m.editor
        .getModelMarkers({ owner: 'typescript' })
        .filter((mk) => mk.severity >= 8)
        .map((mk) => mk.message);
    });
    expect(tsErrors).toEqual([]);

    // Live tsconfig.json sync updates Monaco compiler options
    await page.evaluate(() => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      ide.setFile(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { strict: false, noImplicitAny: false } }, null, 2)
      );
    });
    const strictOpt = await page.evaluate(() => {
      const m = (window as unknown as TestWindow).monaco!;
      return m.languages.typescript.typescriptDefaults.getCompilerOptions().strict;
    });
    expect(strictOpt).toBe(false);

    // HTML auto-closing tag inserts </div> when typing > after <div
    await page.evaluate(() => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      ide.openFile('index.html');
      ide.editor!.setPosition({ lineNumber: 3, column: 3 });
      ide.editor!.trigger('keyboard', 'type', { text: '<div' });
      ide.editor!.trigger('keyboard', 'type', { text: '>' });
    });
    const htmlContent = await page.evaluate(() =>
      (window as unknown as TestWindow).__codelabTest.ide.editor!.getValue()
    );
    expect(htmlContent).toContain('<div></div>');

    // Monaco Side-by-Side DiffEditor in Source Control
    await page.evaluate(async () => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      await ide.shell.execute('git init && git add . && git commit -m "base"');
      ide.setFile('main.ts', 'import { multiply } from "./math";\nexport const answer: number = multiply(7, 8);\n');
      ide.setSidebarView('scm', { ensureOpen: true });
      ide.openScmDiff('main.ts');
    });
    await expect(page.locator('#cl-inline-diff-container .codelab-scm-diff-header')).toContainText('+1');
    await expect(page.locator('#cl-inline-diff-container .codelab-scm-monaco-diff .monaco-diff-editor')).toBeVisible();

    // Fuzzy Command Palette highlights matched characters & supports @ document symbols
    await page.evaluate(() => {
      const ide = (window as unknown as TestWindow).__codelabTest.ide;
      ide.openFile('math.ts');
      ide.toggleCommandPalette(true);
    });
    const paletteInput = page.locator('#cl-palette-input');
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill('> tglpnl');
    await expect(page.locator('#cl-palette-list')).toContainText('Toggle Panel');
    await expect(page.locator('#cl-palette-list mark.codelab-palette-hl').first()).toBeVisible();

    await paletteInput.fill('@');
    await expect(page.locator('#cl-palette-list')).toContainText('multiply');
  });

  test('Charcoal Ink & Warm Paper design system tokens, Geist typography, and Settings UI alignment', async ({
    page
  }) => {
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.goto('/tests/browser/fixtures/');

    await page.evaluate(() => (window as unknown as TestWindow).__codelabTest.ide.setTheme('dark'));
    const darkTokens = await page.evaluate(() => {
      const root = document.querySelector('.codelab')!;
      const cs = getComputedStyle(root);
      return {
        bgRoot: cs.getPropertyValue('--cl-bg').trim().toLowerCase(),
        bgPanel: cs.getPropertyValue('--cl-bg-elevated').trim().toLowerCase(),
        btnPrimary: cs.getPropertyValue('--cl-btn-primary-bg').trim().toLowerCase(),
        fontSans: cs.getPropertyValue('--cl-font-sans').trim()
      };
    });
    expect(darkTokens.bgRoot).toBe('#0f0f10');
    expect(darkTokens.bgPanel).toBe('#141415');
    expect(darkTokens.btnPrimary).toBe('#f4f4f5');
    expect(darkTokens.fontSans).toContain('Geist');

    // Open Settings tab and verify component-aligned container
    await page.evaluate(() => (window as unknown as TestWindow).__codelabTest.ide.openSettings());
    await expect(page.locator('#cl-settings-host .cl-settings-editor')).toBeVisible();

    // Switch to Warm Paper light theme and verify tokens
    await page.evaluate(() => (window as unknown as TestWindow).__codelabTest.ide.setTheme('light'));
    const lightTokens = await page.evaluate(() => {
      const root = document.querySelector('.codelab')!;
      const cs = getComputedStyle(root);
      return {
        bgRoot: cs.getPropertyValue('--cl-bg').trim().toLowerCase(),
        bgPanel: cs.getPropertyValue('--cl-bg-elevated').trim().toLowerCase(),
        btnPrimary: cs.getPropertyValue('--cl-btn-primary-bg').trim().toLowerCase()
      };
    });
    expect(lightTokens.bgRoot).toBe('#ffffff');
    expect(lightTokens.bgPanel).toBe('#f7f7f5');
    expect(lightTokens.btnPrimary).toBe('#18181b');
  });
});
