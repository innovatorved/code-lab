import { test, expect } from '@playwright/test';

/**
 * Browser E2E spec verifying:
 * - Foreground `serve` holds the terminal until Ctrl+C and unregisters the port on SIGINT
 * - Multi-terminal session isolation (running state, Ctrl+C, and shell env vars)
 * - Customizable initial `settings` passed to `CodeLab.mount()` remain editable by the user
 */

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.goto('/tests/browser/fixtures/');
});

test('foreground serve holds terminal until Ctrl+C and isolates second terminal session', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).__codelabTest;
    t.unmount();
    t.mount({
      persistState: false,
      files: {
        'index.html': '<!doctype html><h1>Hello CodeLab</h1>'
      }
    });
    const ide = t.ide;
    const raw = ide._instance || ide;
    const sess1Id = raw._activeTerminalSessionId || 'session-1';

    // Start foreground serve in session 1 without awaiting completion
    let finished = false;
    const servePromise = raw._handleReplCommand('serve --port 4501', { sessionId: sess1Id }).then(() => {
      finished = true;
    });

    await new Promise((r) => setTimeout(r, 80));
    const heldWhileRunning = !finished;
    const sess1Busy = Boolean(raw.isRunning);
    const portUp = raw.portTable.listServers().some((s: any) => Number(s.port) === 4501);

    // Export an env var in session 2 and verify session 2 is NOT blocked by session 1's foreground server
    const sess2Id = raw.createTerminalSession('bash-2');
    const sess2Busy = Boolean(raw.isRunning);
    await raw._handleReplCommand('export SESSION_TAG=two', { sessionId: sess2Id });
    await raw._handleReplCommand('echo $SESSION_TAG', { sessionId: sess2Id });
    const sess2SawTwo = raw.terminalLogs.some((l: any) => String(l.text || '').includes('two'));

    // Ctrl+C in session 2 must NOT kill session 1's server
    raw._handleInterrupt({ sessionId: sess2Id });
    await new Promise((r) => setTimeout(r, 30));
    const stillUpAfterSess2CtrlC = raw.portTable.listServers().some((s: any) => Number(s.port) === 4501);

    // Switch back to session 1 and send Ctrl+C -> must stop the server and free port 4501
    raw.switchTerminalSession(sess1Id);
    const sess1EnvIsolated = raw.shell.env.SESSION_TAG === undefined;
    raw._handleInterrupt({ sessionId: sess1Id });
    await servePromise;
    const portClosedAfterCtrlC = !raw.portTable.listServers().some((s: any) => Number(s.port) === 4501);

    return {
      heldWhileRunning,
      sess1Busy,
      portUp,
      sess2Busy,
      sess2SawTwo,
      stillUpAfterSess2CtrlC,
      sess1EnvIsolated,
      portClosedAfterCtrlC
    };
  });

  expect(result.heldWhileRunning).toBe(true);
  expect(result.sess1Busy).toBe(true);
  expect(result.portUp).toBe(true);
  expect(result.sess2Busy).toBe(false);
  expect(result.sess2SawTwo).toBe(true);
  expect(result.stillUpAfterSess2CtrlC).toBe(true);
  expect(result.sess1EnvIsolated).toBe(true);
  expect(result.portClosedAfterCtrlC).toBe(true);
});

test('init settings passed to CodeLab.mount() apply immediately and remain user-editable', async ({ page }) => {
  const result = await page.evaluate(() => {
    const t = (window as any).__codelabTest;
    t.unmount();
    t.mount({
      persistState: false,
      settings: {
        'editor.fontSize': 16,
        'workbench.colorTheme': 'light'
      },
      files: {
        'index.js': 'console.log(1);'
      }
    });
    const raw = t.ide._instance || t.ide;
    const initialSize = raw.configuration.get('editor.fontSize');
    const initialTheme = raw.configuration.get('workbench.colorTheme');

    // End-user can still change settings seeded via options.settings
    raw.configuration.setUserSetting('editor.fontSize', 19);
    const updatedSize = raw.configuration.get('editor.fontSize');

    return { initialSize, initialTheme, updatedSize };
  });

  expect(result.initialSize).toBe(16);
  expect(result.initialTheme).toBe('light');
  expect(result.updatedSize).toBe(19);
});
