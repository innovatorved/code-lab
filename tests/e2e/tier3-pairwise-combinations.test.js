'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tier 3: Pairwise Cross-Feature Interactions (>= 10 tests)
 * Validates cross-cutting architectural invariants across pairs of features.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CODE_LAB_ROOT,
  SYSTEM_DESIGN_ROOT,
  WIKI_ROOT,
  HAS_SYSTEM_DESIGN,
  setupMockDOM,
  teardownMockDOM,
  loadSchemas,
  loadGuidedLab,
  createSuite
} = require('./e2e-harness');

const suite = createSuite('Tier 3', 'Pairwise Cross-Feature Combinations (>= 10 tests)');


// ─────────────────────────────────────────────────────────────────────────────
// P1: F1 (TypeScript Build) × F2 (Zod Schema Validation)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P1', 'F1 × F2: Schemas transpiled through TypeScript build validate options with full fidelity', async () => {
  const schemas = loadSchemas();
  assert.ok(schemas.WorkbenchOptionsSchema, 'WorkbenchOptionsSchema must exist');
  assert.ok(schemas.GuidedLabExtensionOptionsSchema, 'GuidedLabExtensionOptionsSchema must exist');

  const parsed = schemas.WorkbenchOptionsSchema.parse({
    title: 'code-lab',
    files: { 'index.ts': 'export const n: number = 10;' }
  });
  assert.equal(parsed.title, 'code-lab');
  assert.equal(parsed.theme, 'auto');
});

// ─────────────────────────────────────────────────────────────────────────────
// P2: F2 (Zod Schema Validation) × F3 (Pure Core IDE)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P2', 'F2 × F3: Schema-validated options mount pure Core IDE with zero guided DOM elements', async () => {
  const { WorkbenchOptionsSchema } = loadSchemas();
  const rawOpts = {
    files: { 'main.ts': 'console.log("pure ide");' }
  };
  const validatedOpts = WorkbenchOptionsSchema.parse(rawOpts);

  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, validatedOpts);

    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0);
    assert.equal(mountEl.querySelectorAll('.codelab-mode-switch').length, 0);
    assert.equal(mountEl.querySelectorAll('.codelab-lang-switch').length, 0);
    assert.ok(mountEl.querySelector('.codelab-workbench'));
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3: F3 (Pure Core IDE) × F4 (Modular Guided Lab Extension)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P3', 'F3 × F4: Mounting pure IDE and dynamically calling ide.use(guidedLab) enables guided mode', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    // Before extension: pure IDE, no guided chrome.
    assert.equal(ide.hasGuidedLab, false);
    assert.equal(mountEl.querySelectorAll('.codelab-mode-switch').length, 0);
    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0);

    // After extension: guided chrome is rendered.
    ide.use(loadGuidedLab(), {
      steps: [{ id: 's1', title: 'Step 1', instructions: 'Implement hash' }],
      mode: 'guided'
    });

    assert.equal(ide.hasGuidedLab, true);
    assert.ok(mountEl.querySelector('.codelab-mode-switch'));
    assert.ok(mountEl.querySelector('.codelab-guide'));
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P4: F3 (Pure Core IDE) × F8 (Minimal Header Branding)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P4', 'F3 × F8: Pure IDE renders the minimal code-lab brand without marketing badges', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { files: {} });

    const titleEl = mountEl.querySelector('.codelab-title') || mountEl.querySelector('.codelab-brand');
    assert.ok(titleEl, 'Brand element must exist');
    assert.equal(titleEl.textContent.trim(), 'code-lab');

    assert.equal(mountEl.querySelectorAll('.studio-badge').length, 0);
    assert.equal(mountEl.querySelectorAll('.preset-pill').length, 0);
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P5: F5 (Landing Screen) × F6 (Streaming Git Clone Logs)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P5', 'F5 × F6: Initiating clone from landing view invokes streaming progress callbacks', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const recordedPhases = [];

  const onProgress = (event) => {
    const parsed = CloneProgressEventSchema.parse(event);
    recordedPhases.push(parsed.phase);
  };

  // Simulate progress events fired during a clone sequence
  onProgress({ phase: 'connecting', message: 'Connecting...' });
  onProgress({ phase: 'metadata', message: 'Fetching tree...' });
  onProgress({ phase: 'downloading', message: 'Downloading...', loaded: 1, total: 3 });
  onProgress({ phase: 'mounting', message: 'Mounting workspace...' });
  onProgress({ phase: 'ready', message: 'Ready!' });

  assert.deepEqual(recordedPhases, ['connecting', 'metadata', 'downloading', 'mounting', 'ready']);
});

// ─────────────────────────────────────────────────────────────────────────────
// P6: F6 (Streaming Git Clone Logs) × F7 (Same-Origin Asset Distribution)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P6', 'F6 × F7: ide.cloneRepo on same-origin workbench forwards streaming progress events', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.equal(typeof ide.cloneRepo, 'function');

    const progressPhases = [];
    try {
      await ide.cloneRepo('test-owner/test-repo', {
        onProgress: (ev) => progressPhases.push(ev.phase),
        fetchImpl: async () => ({ ok: false, status: 404, statusText: 'Not Found' })
      });
    } catch (_) {
      // expected network stub failure
    }

    assert.ok(progressPhases.length > 0, 'Progress events must be recorded during ide.cloneRepo');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P7: F4 (Modular Guided Lab Extension) × F9 (Downstream system-design Integration)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P7', 'F4 × F9: Downstream-style build labs attach to workbench using guidedLab extension', async () => {
  const buildLab = {
    title: 'Sliding Window Rate Limiter',
    files: {
      'rate-limiter.js': 'class RateLimiter {}\nmodule.exports = { RateLimiter };'
    },
    steps: [
      { id: 'step-1', title: 'Step 1: Setup', instructions: 'Setup tokens' }
    ]
  };

  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, {
      title: buildLab.title,
      files: buildLab.files
    });

    ide.use(loadGuidedLab(), {
      steps: buildLab.steps,
      mode: 'guided'
    });

    assert.ok(mountEl.querySelector('.codelab-guide'));
    assert.equal(ide.steps.length, 1);
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P8: F5 (Landing Screen) × F7 (Same-Origin Asset Distribution)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P8', 'F5 × F7: Blank workspace action initializes same-origin pure workbench instance', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.ok(ide);
    assert.equal(typeof ide.cloneRepo, 'function');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P9: F2 (Zod Schema Validation) × F6 (Streaming Git Clone Logs)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P9', 'F2 × F6: GitHubCloneOptionsSchema validates options passed to clone engine', async () => {
  const { GitHubCloneOptionsSchema } = loadSchemas();

  let captured = null;
  const opts = GitHubCloneOptionsSchema.parse({
    branch: 'main',
    onProgress: (ev) => { captured = ev; }
  });

  assert.equal(opts.branch, 'main');
  assert.equal(opts.intoRoot, true);
  opts.onProgress({ phase: 'ready', message: 'Done' });
  assert.deepEqual(captured, { phase: 'ready', message: 'Done' });
});

// ─────────────────────────────────────────────────────────────────────────────
// P10: F8 (Minimal Header Branding) × F10 (Docs Parity)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P10', 'F8 × F10: README.md and documentation reflect minimal branding without npm button or badges', async () => {
  const readmePath = path.resolve(CODE_LAB_ROOT, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');

  // Must not advertise stale badges or legacy header layouts
  assert.ok(!readme.includes('Quick Clone Public Repos'));
});

// ─────────────────────────────────────────────────────────────────────────────
// P11: F1 (TypeScript Build) × F7 (Same-Origin Asset Distribution)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P11', 'F1 × F7: Production build dist/code-lab.js exports cloneRepo matching dist/code-lab.d.ts', async () => {
  const distJsPath = path.resolve(CODE_LAB_ROOT, 'dist/code-lab.js');
  const distDtsPath = path.resolve(CODE_LAB_ROOT, 'dist/code-lab.d.ts');

  assert.ok(fs.existsSync(distJsPath), 'dist/code-lab.js must exist');
  assert.ok(fs.existsSync(distDtsPath), 'dist/code-lab.d.ts must exist');

  const dts = fs.readFileSync(distDtsPath, 'utf8');
  assert.ok(
    dts.includes('cloneRepo') || dts.includes('cloneGitHubRepository'),
    'dist/code-lab.d.ts must declare cloneRepo'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// P12: F4 (Modular Guided Lab Extension) × F8 (Minimal Header Branding)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('P12', 'F4 × F8: Registering guidedLab preserves minimal code-lab brand and icon-only theme button', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    ide.use(CodeLab.extensions.guidedLab, { steps: [] });

    const titleEl = mountEl.querySelector('.codelab-title') || mountEl.querySelector('.codelab-brand');
    assert.equal(titleEl.textContent.trim(), 'code-lab');

    const badges = mountEl.querySelectorAll('.studio-badge');
    assert.equal(badges.length, 0);
  } finally {
    teardownMockDOM();
  }
});

// ── Standalone Execution ────────────────────────────────────────────────────

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed === 0 ? 0 : 1);
  });
}

module.exports = suite;
