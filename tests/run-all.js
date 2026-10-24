#!/usr/bin/env node
'use strict';

/**
 * Unified test runner.
 *
 * Every suite is spawned as a separate process and its exit code is collected.
 * A failing suite never prevents the remaining suites from running, so one
 * failure cannot hide the rest of the picture (the old `&&` chain did).
 *
 * Usage:
 *   node tests/run-all.js                # everything
 *   node tests/run-all.js --filter=gfm   # only suites whose path matches
 *   node tests/run-all.js --bail         # stop after the first failure
 *   node tests/run-all.js --list         # print the suite list and exit
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SUITE_TIMEOUT_MS = 5 * 60 * 1000;

// Ordered fastest-first so a broken build fails early.
const SUITES = [
  'tests/test-dist-only-imports.js',
  'tests/test-all-builds.js',
  'tests/test-runtime-advanced.js',
  'tests/test-option1-shell-bun-http.js',
  'tests/test-frameworks.js',
  'tests/test-esm-exports.js',
  'tests/test-installer-integrity.js',
  'tests/test-coreutils-adversarial.js',
  'tests/test-stress-shell.js',
  'tests/test-workbench-ui.js',
  'tests/test-terminal-streaming.js',
  'tests/test-git-clone-streaming.js',
  'tests/test-streaming-clone.js',
  'tests/test-m1-adversarial-challenger.js',
  'tests/test-m1-adversarial-edge-cases.js',
  'tests/test-m1-challenger-stress.js',
  'tests/test-m1-interruption-lifecycle-stress.js',
  'tests/test-m2-adversarial-syntax.js',
  'tests/test-m2-adversarial-interactive.js',
  'tests/test-gfm-markdown.js',
  'tests/test-markdown-security.js',
  'tests/test-fuzz-schemas.js',
  'tests/test-stress-runtime.js',
  'tests/test-web-preview.js',
  'tests/test-preview-sw.js',
  'tests/test-preview-csp.js',
  'tests/test-preview-security.js',
  'tests/test-logger-save-errors.js',
  'tests/test-zip-engine.js',
  'tests/test-cascading-storage.js',
  'tests/test-search-replace.js',
  'tests/test-diagnostics-store.js',
  'tests/test-scm-engine.js',
  'tests/test-preview-live-bridge.js',
  'tests/test-terminal-multisession-cdn.js',
  'tests/test-system-design-tools.js',
  'tests/test-cpp-extension.js',
  'tests/test-version-sync.js',
  'tests/test-typescript-consolidation.js',
  'tests/test-untracked-dist.js',
  'tests/e2e/run-all-e2e.js'
];

function parseArgs(argv) {
  const opts = { filter: null, bail: false, list: false };
  for (const arg of argv) {
    if (arg === '--bail') opts.bail = true;
    else if (arg === '--list') opts.list = true;
    else if (arg.startsWith('--filter=')) opts.filter = arg.slice('--filter='.length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const suites = opts.filter
    ? SUITES.filter(s => s.toLowerCase().includes(opts.filter.toLowerCase()))
    : SUITES;

  if (opts.list) {
    for (const suite of suites) console.log(suite);
    return 0;
  }

  if (suites.length === 0) {
    console.error(`No suites matched filter "${opts.filter}"`);
    return 2;
  }

  // Every suite loads the built bundles, so a missing or stale `dist/` would
  // otherwise produce dozens of confusing failures. Fail once, clearly.
  if (!opts.list) {
    try {
      require('./helpers/load').assertFresh();
    } catch (err) {
      console.error('');
      console.error('✘ ' + String((err && err.message) || err));
      console.error('');
      return 2;
    }
  }

  console.log('='.repeat(78));
  console.log(`code-lab test run — ${suites.length} suite(s)`);
  console.log(`runtime: ${process.execPath}`);
  console.log('='.repeat(78));

  const results = [];
  const startedAt = Date.now();

  for (const suite of suites) {
    const start = Date.now();
    console.log('');
    console.log('-'.repeat(78));
    console.log(`▶ ${suite}`);
    console.log('-'.repeat(78));

    const child = spawnSync(process.execPath, [suite], {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: SUITE_TIMEOUT_MS,
      env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR || '1' }
    });

    let status = child.status;
    let reason = null;
    if (child.error && child.error.code === 'ETIMEDOUT') {
      status = 1;
      reason = `timed out after ${formatDuration(SUITE_TIMEOUT_MS)}`;
    } else if (child.signal) {
      status = 1;
      reason = `killed by signal ${child.signal}`;
    } else if (status === null) {
      status = 1;
      reason = 'no exit code';
    }

    const result = {
      suite,
      status,
      reason,
      durationMs: Date.now() - start
    };
    results.push(result);

    if (status !== 0) {
      console.log(`✘ FAIL ${suite}${reason ? ` (${reason})` : ''}`);
      if (opts.bail) break;
    } else {
      console.log(`✔ PASS ${suite}`);
    }
  }

  const failed = results.filter(r => r.status !== 0);
  const totalMs = Date.now() - startedAt;

  console.log('');
  console.log('='.repeat(78));
  console.log('SUMMARY');
  console.log('='.repeat(78));
  for (const r of results) {
    const mark = r.status === 0 ? '✔' : '✘';
    const reason = r.reason ? ` — ${r.reason}` : '';
    console.log(`${mark} ${r.suite.padEnd(58)} ${formatDuration(r.durationMs).padStart(8)}${reason}`);
  }
  console.log('-'.repeat(78));
  console.log(
    `${results.length - failed.length}/${results.length} suites passed in ${formatDuration(totalMs)}`
  );

  if (failed.length > 0) {
    console.log('');
    console.log(`FAILED (${failed.length}):`);
    for (const r of failed) console.log(`  - ${r.suite}${r.reason ? ` (${r.reason})` : ''}`);
    return 1;
  }

  console.log('All suites passed.');
  return 0;
}

process.exitCode = main();
