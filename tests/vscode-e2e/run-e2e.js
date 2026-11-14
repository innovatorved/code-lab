#!/usr/bin/env node
'use strict';

/**
 * CLI Runner for VS Code UI/UX Redesign & Non-Destructive State Playwright E2E Suite.
 *
 * Usage:
 *   node tests/vscode-e2e/run-e2e.js                     # runs all tiers
 *   node tests/vscode-e2e/run-e2e.js --tier=1            # runs Tier 1 specs only
 *   node tests/vscode-e2e/run-e2e.js --tier=2 --list     # lists Tier 2 test cases
 *   node tests/vscode-e2e/run-e2e.js --tier=all --grep="F11"
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const E2E_DIR = __dirname;
const ROOT_DIR = path.resolve(E2E_DIR, '../..');
const CONFIG_PATH = path.join(E2E_DIR, 'playwright.vscode.config.ts');

const TIER_SPEC_MAP = {
  '1': [
    'tier1-layout-menus-sidebar.spec.ts',
    'tier1-workspaces-clone-settings.spec.ts',
    'tier1-search-scm-problems-terminal.spec.ts'
  ],
  '2': [
    'tier2-boundary-layout-explorer.spec.ts',
    'tier2-boundary-workflows-settings.spec.ts'
  ],
  '3': [
    'tier3-cross-feature.spec.ts'
  ],
  '4': [
    'tier4-real-world-and-parity-audit.spec.ts'
  ]
};

function resolveSpecsForTier(tier) {
  if (tier === 'all') {
    return fs
      .readdirSync(E2E_DIR)
      .filter((f) => f.endsWith('.spec.ts'))
      .sort()
      .map((f) => path.posix.join('tests/vscode-e2e', f));
  }

  if (tier === '5') {
    return fs
      .readdirSync(E2E_DIR)
      .filter((f) => f.startsWith('tier5-') && f.endsWith('.spec.ts'))
      .sort()
      .map((f) => path.posix.join('tests/vscode-e2e', f));
  }

  const canonical = TIER_SPEC_MAP[tier];
  if (!canonical) {
    console.error(
      `Invalid --tier="${tier}". Expected one of: 1, 2, 3, 4, 5, all.`
    );
    process.exit(2);
  }

  const dynamic = fs
    .readdirSync(E2E_DIR)
    .filter((f) => f.startsWith(`tier${tier}-`) && f.endsWith('.spec.ts'));
  const merged = Array.from(new Set([...canonical, ...dynamic]));
  return merged.map((f) => path.posix.join('tests/vscode-e2e', f));
}

function main() {
  const rawArgs = process.argv.slice(2);
  let tier = 'all';
  const passthroughArgs = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--tier=')) {
      const val = arg.slice('--tier='.length).trim().toLowerCase();
      if (!val) {
        console.error('Invalid --tier="". Expected one of: 1, 2, 3, 4, 5, all.');
        process.exit(2);
      }
      tier = val;
    } else if (arg === '--tier') {
      if (i + 1 >= rawArgs.length) {
        console.error('Missing value for --tier. Expected one of: 1, 2, 3, 4, 5, all.');
        process.exit(2);
      }
      const val = String(rawArgs[++i]).trim().toLowerCase();
      if (!val || val.startsWith('-')) {
        console.error(`Invalid --tier="${val}". Expected one of: 1, 2, 3, 4, 5, all.`);
        process.exit(2);
      }
      tier = val;
    } else if (arg.startsWith('--grep=')) {
      passthroughArgs.push('--grep', arg.slice('--grep='.length));
    } else {
      passthroughArgs.push(arg);
    }
  }

  const specFiles = resolveSpecsForTier(tier);
  if (specFiles.length === 0) {
    console.error(`No spec files found for --tier=${tier} in ${E2E_DIR}`);
    process.exit(1);
  }

  const localPlaywrightBin = path.join(
    ROOT_DIR,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
  );

  const cmd = fs.existsSync(localPlaywrightBin) ? localPlaywrightBin : 'npx';
  const cmdArgs = fs.existsSync(localPlaywrightBin)
    ? ['test', '-c', CONFIG_PATH, ...specFiles, ...passthroughArgs]
    : ['playwright', 'test', '-c', CONFIG_PATH, ...specFiles, ...passthroughArgs];

  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: process.env
  });

  if (res.error) {
    console.error('Failed to launch Playwright:', res.error.message);
    process.exit(1);
  }

  process.exit(typeof res.status === 'number' ? res.status : 1);
}

main();
