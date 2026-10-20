#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Master E2E Test Runner: code-lab v2.0.0
 * Executes 4-tier requirement-driven opaque-box verification suite:
 *   - Tier 1: Feature Coverage (>= 50 tests, F1 to F10)
 *   - Tier 2: Boundary & Corner Cases (>= 50 tests, F1 to F10)
 *   - Tier 3: Pairwise Combinations (>= 10 tests)
 *   - Tier 4: Real-World Scenarios (>= 5 tests, S1 to S5)
 * Total: >= 115 tests
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const path = require('node:path');

const tierFiles = [
  { tier: 1, name: 'Tier 1: Feature Coverage (F1-F10)', path: './tier1-feature-coverage.test.js' },
  { tier: 2, name: 'Tier 2: Boundary & Corner Cases (F1-F10)', path: './tier2-boundary-corner.test.js' },
  { tier: 3, name: 'Tier 3: Pairwise Combinations', path: './tier3-pairwise-combinations.test.js' },
  { tier: 4, name: 'Tier 4: Real-World Scenarios (S1-S5)', path: './tier4-real-world-scenarios.test.js' }
];

async function main() {
  const args = process.argv.slice(2);
  let selectedTier = null;
  let reportOnly = false;

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      selectedTier = parseInt(arg.split('=')[1], 10);
    } else if (arg === '-t' && args[args.indexOf(arg) + 1]) {
      selectedTier = parseInt(args[args.indexOf(arg) + 1], 10);
    } else if (arg === '--report-only') {
      reportOnly = true;
    }
  }

  const targets = selectedTier
    ? tierFiles.filter(t => t.tier === selectedTier)
    : tierFiles;

  if (targets.length === 0) {
    console.error(`Invalid tier selection: ${selectedTier}. Valid tiers are 1, 2, 3, 4.`);
    process.exit(1);
  }

  console.log(`\n╔═══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║               code-lab v2.0.0 E2E Automated Test Suite                ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════════╝`);
  console.log(`Selected Tiers: ${targets.map(t => 'Tier ' + t.tier).join(', ')}`);
  console.log(`Start Time: ${new Date().toISOString()}\n`);

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  let grandSkipped = 0;
  const tierSummaries = [];
  const allErrors = [];
  const suiteStartTime = Date.now();

  for (const target of targets) {
    const suiteModule = require(target.path);
    const summary = await suiteModule.run();

    grandTotal += summary.total;
    grandPassed += summary.passed;
    grandFailed += summary.failed;
    grandSkipped += summary.skipped || 0;
    tierSummaries.push(summary);

    if (summary.errors && summary.errors.length > 0) {
      for (const err of summary.errors) {
        allErrors.push({ tier: target.tier, ...err });
      }
    }
  }

  const totalDuration = Date.now() - suiteStartTime;

  console.log(`\n╔═══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║                         E2E EXECUTION SUMMARY                         ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════════╝`);
  console.log(`┌──────────────────────────────────────────────┬───────┬──────┬──────┬──────┐`);
  console.log(`│ Test Tier                                    │ Total │ Pass │ Fail │ Skip │`);
  console.log(`├──────────────────────────────────────────────┼───────┼──────┼──────┼──────┤`);
  for (const s of tierSummaries) {
    const namePadded = s.name.padEnd(44, ' ').slice(0, 44);
    const tot = String(s.total).padStart(5, ' ');
    const pass = String(s.passed).padStart(4, ' ');
    const fail = String(s.failed).padStart(4, ' ');
    const skip = String(s.skipped || 0).padStart(4, ' ');
    console.log(`│ ${namePadded} │ ${tot} │ ${pass} │ ${fail} │ ${skip} │`);
  }
  console.log(`├──────────────────────────────────────────────┼───────┼──────┼──────┼──────┤`);
  const grandTotStr = String(grandTotal).padStart(5, ' ');
  const grandPassStr = String(grandPassed).padStart(4, ' ');
  const grandFailStr = String(grandFailed).padStart(4, ' ');
  const grandSkipStr = String(grandSkipped).padStart(4, ' ');
  console.log(`│ ${'OVERALL TOTAL'.padEnd(44, ' ')} │ ${grandTotStr} │ ${grandPassStr} │ ${grandFailStr} │ ${grandSkipStr} │`);
  console.log(`└──────────────────────────────────────────────┴───────┴──────┴──────┴──────┘`);
  console.log(`Total Duration: ${totalDuration}ms`);

  if (allErrors.length > 0) {
    console.log(`\nFailed Tests Diagnostic Summary (${allErrors.length}):`);
    for (const item of allErrors) {
      console.log(`  [Tier ${item.tier} - ${item.id}] ${item.name}`);
      console.log(`    Message: ${item.error.message}`);
    }
  }

  if (grandFailed === 0) {
    console.log(`\n🎉 ALL ${grandTotal} TESTS PASSED 100%! All requirements verified.\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${grandFailed} of ${grandTotal} tests failed.\n`);
    if (reportOnly) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}

module.exports = { main };
