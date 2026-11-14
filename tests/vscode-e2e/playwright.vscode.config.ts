import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.VSCODE_E2E_PORT || 4273);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROOT_DIR = path.resolve(__dirname, '../..');

function resolveChromiumLaunchOptions(): { executablePath?: string } {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH };
  }

  try {
    const defaultExec = chromium.executablePath();
    if (defaultExec && fs.existsSync(defaultExec)) {
      return {};
    }
  } catch {
    // Fall through to local Playwright cache / system Chrome discovery
  }

  const cacheRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright')
  ].filter((p): p is string => Boolean(p && fs.existsSync(p)));

  for (const cacheRoot of cacheRoots) {
    const entries = fs
      .readdirSync(cacheRoot)
      .filter((d) => d.startsWith('chromium_headless_shell-') || d.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const dir of entries) {
      const candidates = [
        path.join(cacheRoot, dir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
        path.join(cacheRoot, dir, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell'),
        path.join(cacheRoot, dir, 'chrome-headless-shell-linux', 'chrome-headless-shell'),
        path.join(
          cacheRoot,
          dir,
          'chrome-mac-arm64',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing'
        ),
        path.join(cacheRoot, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(cacheRoot, dir, 'chrome-linux', 'chrome')
      ];
      const found = candidates.find((c) => fs.existsSync(c));
      if (found) {
        return { executablePath: found };
      }
    }
  }

  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(macChrome)) {
    return { executablePath: macChrome };
  }

  return {};
}

const launchOptions = resolveChromiumLaunchOptions();

export default defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.ts',
  outputDir: path.join(ROOT_DIR, 'test-results', 'vscode-e2e'),
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    launchOptions
  },
  webServer: {
    command: `node "${path.join(__dirname, 'server.js')}"`,
    url: `${BASE_URL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    cwd: ROOT_DIR
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions
      }
    }
  ]
});
