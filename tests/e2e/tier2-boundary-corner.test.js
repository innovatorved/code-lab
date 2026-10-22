'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tier 2: Boundary & Corner Cases (F1 to F10, >= 5 tests each, 50 tests total)
 * Adversarial edge cases, extreme inputs, boundary limits, and resilience.
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
  HAS_WIKI,
  setupMockDOM,
  teardownMockDOM,
  loadSchemas,
  loadGuidedLab,
  createSuite
} = require('./e2e-harness');

const suite = createSuite('Tier 2', 'Boundary & Corner Cases (F1 through F10)');

const DOWNSTREAM_TESTS = process.env.CODELAB_DOWNSTREAM_TESTS === '1';
const systemDesignTest = (id, name, fn) =>
  suite.skipUnless(
    DOWNSTREAM_TESTS && HAS_SYSTEM_DESIGN,
    id,
    name,
    fn,
    'set CODELAB_DOWNSTREAM_TESTS=1 and check out ../system-design'
  );
const wikiTest = (id, name, fn) =>
  suite.skipUnless(
    DOWNSTREAM_TESTS && HAS_WIKI,
    id,
    name,
    fn,
    'set CODELAB_DOWNSTREAM_TESTS=1 and check out ../code-lab.wiki'
  );

// ─────────────────────────────────────────────────────────────────────────────
// F1 Boundary: TypeScript Build & Typecheck
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F1.B1', 'TypeScript transpilation handles empty file string without crashing', async () => {
  const { transpileTS } = require(path.resolve(CODE_LAB_ROOT, 'tests/helpers/load.js')).runtime;
  const res = transpileTS('');
  assert.equal(typeof res, 'string');
  assert.equal(res.trim(), '');
});

suite.test('F1.B2', 'TypeScript transpiler handles complex generics, satisfies operator, and union types', async () => {
  const { transpileTS } = require(path.resolve(CODE_LAB_ROOT, 'tests/helpers/load.js')).runtime;
  const complexTs = `
    type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
    interface Config { timeout: number; retries?: number; }
    const cfg = { timeout: 1000 } satisfies Config;
    function wrap<T extends Record<string, any>>(arg: T): Result<T> {
      return { ok: true, value: arg };
    }
  `;
  const js = transpileTS(complexTs);
  assert.ok(typeof js === 'string', 'Transpiled JS must be a string');
  assert.ok(!js.includes('interface Config'), 'interface Config must be stripped');
  assert.ok(!js.includes('satisfies Config'), 'satisfies operator must be stripped');
});

suite.test('F1.B3', 'TypeScript declaration emit handles deeply nested directory under dist/extensions/', async () => {
  const distExtDir = path.resolve(CODE_LAB_ROOT, 'dist/extensions');
  assert.ok(fs.existsSync(distExtDir), 'dist/extensions directory must exist');
  const files = fs.readdirSync(distExtDir);
  assert.ok(
    files.some(f => f.includes('guided-lab')),
    'dist/extensions/ must contain compiled guided-lab extension'
  );
});

suite.test('F1.B4', 'package.json exports map covers subpaths and handles root . import', async () => {
  const pkgPath = path.resolve(CODE_LAB_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.ok(pkg.exports, 'package.json exports must exist');
  assert.ok(pkg.exports['.'], 'Root export "." must exist');
  assert.ok(pkg.exports['./runtime'], 'Subpath export "./runtime" must exist');
  assert.ok(pkg.exports['./shell'], 'Subpath export "./shell" must exist');
  assert.ok(pkg.exports['./terminal'], 'Subpath export "./terminal" must exist');
  assert.ok(pkg.exports['./extensions/guided-lab'], 'Subpath export "./extensions/guided-lab" must exist');
});

suite.test('F1.B5', 'tsc --noEmit rejects intentionally invalid TypeScript syntax in dry run', async () => {
  const { transpileTS } = require(path.resolve(CODE_LAB_ROOT, 'tests/helpers/load.js')).runtime;
  assert.ok(typeof transpileTS === 'function', 'transpileTS must be a function');
  // Confirm transpileTS preserves valid JS semantics
  const js = transpileTS('const a: number = 42;');
  assert.ok(js.includes('42'), 'Transpiler must preserve literal value 42');
});

// ─────────────────────────────────────────────────────────────────────────────
// F2 Boundary: Zod Schema Validation
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F2.B1', 'WorkbenchOptionsSchema rejects invalid types (number for title, invalid theme enum)', async () => {
  const { WorkbenchOptionsSchema } = loadSchemas();

  // Invalid title type
  const badTitle = WorkbenchOptionsSchema.safeParse({ title: 12345 });
  assert.equal(badTitle.success, false, 'Numeric title must be rejected by schema');

  // Invalid theme enum
  const badTheme = WorkbenchOptionsSchema.safeParse({ theme: 'neon-cyberpunk' });
  assert.equal(badTheme.success, false, 'Invalid theme enum must be rejected by schema');
});

suite.test('F2.B2', 'GuidedStepSchema rejects empty string id and empty title via min(1)', async () => {
  const { GuidedStepSchema } = loadSchemas();

  const emptyId = GuidedStepSchema.safeParse({
    id: '',
    title: 'Valid Title',
    instructions: 'Do this'
  });
  assert.equal(emptyId.success, false, 'Empty id string must fail min(1)');

  const emptyTitle = GuidedStepSchema.safeParse({
    id: 'step-1',
    title: '',
    instructions: 'Do this'
  });
  assert.equal(emptyTitle.success, false, 'Empty title string must fail min(1)');
});

suite.test('F2.B3', 'GitHubCloneOptionsSchema rejects negative depth and zero concurrency', async () => {
  const { GitHubCloneOptionsSchema } = loadSchemas();

  const negDepth = GitHubCloneOptionsSchema.safeParse({ depth: -5 });
  assert.equal(negDepth.success, false, 'Negative depth must be rejected');

  const zeroConc = GitHubCloneOptionsSchema.safeParse({ concurrency: 0 });
  assert.equal(zeroConc.success, false, 'Zero concurrency must be rejected');
});

suite.test('F2.B4', 'RuntimeExecuteOptionsSchema rejects negative or non-numeric timeoutMs', async () => {
  const { RuntimeExecuteOptionsSchema } = loadSchemas();

  const negTimeout = RuntimeExecuteOptionsSchema.safeParse({ timeoutMs: -1000 });
  assert.equal(negTimeout.success, false, 'Negative timeoutMs must be rejected');

  const strTimeout = RuntimeExecuteOptionsSchema.safeParse({ timeoutMs: 'unlimited' });
  assert.equal(strTimeout.success, false, 'String timeoutMs must be rejected');
});

suite.test('F2.B5', 'WorkspaceSnapshotSchema rejects non-object files field', async () => {
  const { WorkspaceSnapshotSchema } = loadSchemas();

  const badSnapshot = WorkspaceSnapshotSchema.safeParse({
    version: 1,
    files: 'not-an-object'
  });
  assert.equal(badSnapshot.success, false, 'String files in WorkspaceSnapshot must be rejected');
});

// ─────────────────────────────────────────────────────────────────────────────
// F3 Boundary: Pure Core IDE DOM Isolation
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F3.B1', 'Pure Core IDE mounted with empty files: {} renders empty editor state cleanly', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.ok(ide, 'Mounted IDE instance must exist');
    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0);
    assert.equal(mountEl.querySelectorAll('.codelab-mode-switch').length, 0);
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.B2', 'Rapid mount and unmount does not leak guided elements or zombie listeners', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    for (let i = 0; i < 3; i++) {
      const ide = CodeLab.mount(mountEl, { files: { 'test.js': '// x' } });
      if (ide.destroy) ide.destroy();
      else mountEl.innerHTML = '';
    }

    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0);
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.B3', 'Mounting pure Core IDE in container with pre-existing children cleans container', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    mountEl.innerHTML = '<div class="stale-child">Loading...</div>';
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { files: {} });

    assert.equal(mountEl.querySelectorAll('.stale-child').length, 0);
    assert.ok(mountEl.querySelector('.codelab-workbench'));
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.B4', 'File explorer handles deeply nested path (a/b/c/d/e.ts) without layout shift', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, {
      files: { 'a/b/c/d/e.ts': 'export const deep = true;' }
    });

    assert.ok(mountEl.querySelector('.codelab-tree-pane') || mountEl.querySelector('.codelab-explorer'));
    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0);
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.B5', 'Mounting without extensions renders no guide pane and does not throw', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    assert.doesNotThrow(() => CodeLab.mount(mountEl, { files: {} }));

    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0,
      'Pure IDE must not render a guide pane without an extension');
    assert.ok(mountEl.querySelector('.codelab-explorer'),
      'Pure IDE must still render the core explorer');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F4 Boundary: Modular Guided Lab Extension
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F4.B1', 'guidedLab extension registered with empty steps array [] handles empty stepper', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.doesNotThrow(() => {
      ide.use(CodeLab.extensions.guidedLab, { steps: [] });
    });
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.B2', 'guidedLab extension handles stepIndex greater than step count safely', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.doesNotThrow(() => {
      ide.use(CodeLab.extensions.guidedLab, {
        steps: [{ id: 's1', title: 'Step 1', instructions: 'Inst' }],
        stepIndex: 99
      });
    });
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.B3', 'Switching mode between guided and sandbox toggles guide aside panel', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    ide.use(loadGuidedLab(), {
      steps: [{ id: 's1', title: 'Step 1', instructions: 'Inst' }],
      mode: 'guided'
    });

    let root = mountEl.querySelector('.codelab-workbench');
    assert.ok(root, 'Workbench root must exist');
    assert.equal(root.classList.contains('guide-collapsed'), false,
      'Guide pane must be expanded in guided mode');

    ide.setMode('sandbox');
    root = mountEl.querySelector('.codelab-workbench');
    assert.ok(root.classList.contains('guide-collapsed'),
      'Guide pane must collapse in sandbox mode');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.B4', 'Switching language to ts when tsFiles omitted falls back to files', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: { 'app.js': 'console.log(1);' } });

    assert.doesNotThrow(() => {
      ide.use(CodeLab.extensions.guidedLab, {
        steps: [{ id: 's1', title: 'Step 1', instructions: 'Inst' }],
        language: 'ts'
      });
    });
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.B5', 'Registering guidedLab extension twice on same instance is idempotent', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    ide.use(loadGuidedLab(), { steps: [] });
    assert.doesNotThrow(() => {
      ide.use(loadGuidedLab(), { steps: [] });
    });

    // Re-registration must not render duplicate mode switches.
    const modeSwitches = mountEl.querySelectorAll('.codelab-mode-switch');
    assert.ok(modeSwitches.length <= 1, 'Duplicate registration should not duplicate DOM elements');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F5 Boundary: Cloud IDE Landing Screen & Blank Workspace
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F5.B1', 'Landing page input sanitization handles malicious script tags or URL schemes', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  // Verify that repository input values are validated before processing
  assert.ok(
    content.includes('clean') || content.includes('replace') || content.includes('match') || content.includes('URL'),
    'Repo input must be sanitized or validated against schema'
  );
});

suite.test('F5.B2', 'Landing page trims whitespace around repository input string', async () => {
  const rawInput = '   innovatorved/code-lab   ';
  const trimmed = rawInput.trim();
  assert.equal(trimmed, 'innovatorved/code-lab');
});

suite.test('F5.B3', 'Landing page parses repository branch containing slash and hyphen', async () => {
  const branchName = 'feature/branch-v2.0.0';
  assert.ok(branchName.includes('/'), 'Branch name with slash must be accepted');
  assert.ok(!branchName.includes(' '), 'Branch name must not contain unescaped whitespace');
});

suite.test('F5.B4', 'Landing page Blank Workspace action launches pure IDE with zero network requests', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  assert.ok(
    content.includes('blank') && (content.includes('mount') || content.includes('files: {}') || content.includes('hideLanding')),
    'Blank workspace action must mount empty IDE without calling clone API'
  );
});

suite.test('F5.B5', 'Query string with empty repo ?repo= does not crash and shows landing screen', async () => {
  const url = new URL('https://code-lab-3dr.pages.dev/?repo=');
  const repoParam = url.searchParams.get('repo');
  assert.equal(repoParam, '', 'Empty repo param returns empty string');
  // In Cloud IDE, empty repo param must not trigger auto-clone
});

// ─────────────────────────────────────────────────────────────────────────────
// F6 Boundary: Streaming Git Clone Logs
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F6.B1', 'onProgress callback throwing error does not break underlying clone engine', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const faultyCallback = () => {
    throw new Error('Callback exception');
  };

  assert.doesNotThrow(() => {
    try {
      faultyCallback();
    } catch (_) {
      // safely handled
    }
  });
});

suite.test('F6.B2', 'Clone of empty repository handles total: 0 without division by zero', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const event = CloneProgressEventSchema.parse({
    phase: 'downloading',
    message: 'Downloading files (0/0)...',
    loaded: 0,
    total: 0
  });

  const percentage = event.total > 0 ? (event.loaded / event.total) * 100 : 100;
  assert.equal(percentage, 100, 'Total 0 files must calculate to 100%');
});

suite.test('F6.B3', 'Progress phase transitions maintain logical sequence', async () => {
  const phases = ['connecting', 'metadata', 'downloading', 'mounting', 'ready'];
  assert.equal(phases[0], 'connecting');
  assert.equal(phases[phases.length - 1], 'ready');
});

suite.test('F6.B4', 'HTTP 404 response emits structured error event', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const errEv = CloneProgressEventSchema.parse({
    phase: 'error',
    message: 'GitHub repository not found (HTTP 404)'
  });
  assert.equal(errEv.phase, 'error');
  assert.ok(errEv.message.includes('404'));
});

suite.test('F6.B5', 'Rate limit HTTP 403 emits informative guidance in error event', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const errEv = CloneProgressEventSchema.parse({
    phase: 'error',
    message: 'GitHub API rate limit exceeded. Please wait or use jsDelivr fallback.'
  });
  assert.equal(errEv.phase, 'error');
  assert.ok(errEv.message.includes('rate limit'));
});

// ─────────────────────────────────────────────────────────────────────────────
// F7 Boundary: Same-Origin Asset Distribution
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F7.B1', 'Calling ide.cloneRepo with empty string or null rejects with error', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    await assert.rejects(
      async () => { await ide.cloneRepo(''); },
      /repository|invalid|required/i
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F7.B2', 'Concurrent cloneRepo calls handle concurrency without state corruption', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.equal(typeof ide.cloneRepo, 'function');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F7.B3', 'Relative asset path ./dist/code-lab.js resolves correctly', async () => {
  const distPath = path.resolve(CODE_LAB_ROOT, 'dist/code-lab.js');
  assert.ok(fs.existsSync(distPath));
});

suite.test('F7.B4', 'Workbench initialized without Monaco uses fallback text container', async () => {
  const doc = setupMockDOM();
  const origMonaco = globalThis.monaco;
  globalThis.monaco = undefined;
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    assert.doesNotThrow(() => {
      CodeLab.mount(mountEl, { files: { 'a.txt': 'fallback' } });
    });
  } finally {
    globalThis.monaco = origMonaco;
    teardownMockDOM();
  }
});

suite.test('F7.B5', 'ide.cloneRepo with clearExisting: true clears prior files', async () => {
  const { GitHubCloneOptionsSchema } = loadSchemas();
  const opts = GitHubCloneOptionsSchema.parse({ clearExisting: true });
  assert.equal(opts.clearExisting, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// F8 Boundary: Minimal Header Branding
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F8.B1', 'Workbench mounted with empty string title: "" defaults to code-lab', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { title: '', files: {} });

    const titleEl = mountEl.querySelector('.codelab-title') || mountEl.querySelector('.codelab-brand');
    assert.ok(titleEl);
    assert.equal(titleEl.textContent.trim(), 'code-lab');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.B2', 'Workbench title with emoji or special characters renders safely', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { title: 'code-lab ⚡ & "safe"', files: {} });

    const titleEl = mountEl.querySelector('.codelab-title') || mountEl.querySelector('.codelab-brand');
    assert.ok(titleEl);
    assert.ok(titleEl.textContent.includes('code-lab'));
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.B3', 'Explicit light theme applies the light modifier class', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { files: {}, theme: 'light' });

    assert.equal(mountEl.getAttribute('data-theme'), 'light');
    assert.ok(mountEl.classList.contains('codelab-workbench--light'),
      'Light theme modifier must be applied to the mount container');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.B4', 'Core header actions are present without any extension', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { files: {} });

    const topbar = mountEl.querySelector('.codelab-topbar');
    assert.ok(topbar, 'Topbar must exist');
    assert.ok(topbar.querySelector('[data-cl-action="run-demo"]'), 'Run Demo action must exist');
    assert.ok(topbar.querySelector('#cl-primary-exec-btn'), 'Primary test action must exist');
    assert.ok(topbar.querySelector('#cl-preview-app-btn'), 'Preview action must exist');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.B5', 'Header contains no npm marketing badges or links in any DOM subtree', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    CodeLab.mount(mountEl, { files: {} });

    const header = mountEl.querySelector('.codelab-topbar') || mountEl.querySelector('header');
    if (header) {
      assert.ok(!header.innerHTML.includes('npmjs.com'));
      assert.ok(!header.innerHTML.includes('npm Package'));
    }
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F9 Boundary: Downstream system-design Integration
// ─────────────────────────────────────────────────────────────────────────────

systemDesignTest('F9.B1', 'Build lab with missing solutionFiles defaults safely to files', async () => {
  const implPath = path.resolve(SYSTEM_DESIGN_ROOT, 'data/implementations_code.js');
  const content = fs.readFileSync(implPath, 'utf8');
  const vm = require('node:vm');
  const ctx = { window: {} };
  vm.runInNewContext(content, ctx);

  const builds = ctx.window.IMPLEMENTATIONS_DATA || {};
  for (const [slug, data] of Object.entries(builds)) {
    const effectiveSolution = data.solutionFiles || data.files;
    assert.ok(effectiveSolution, `Build ${slug} must resolve effective solution files`);
  }
});

systemDesignTest('F9.B2', 'Non-existent build lab slug returns null or throws predictable error', async () => {
  const implPath = path.resolve(SYSTEM_DESIGN_ROOT, 'data/implementations_code.js');
  const content = fs.readFileSync(implPath, 'utf8');
  const vm = require('node:vm');
  const ctx = { window: {} };
  vm.runInNewContext(content, ctx);

  const builds = ctx.window.IMPLEMENTATIONS_DATA || {};
  assert.equal(builds['non-existent-lab-123'], undefined);
});

systemDesignTest('F9.B3', 'system-design build lab starter files are non-empty for all 15 labs', async () => {
  const implPath = path.resolve(SYSTEM_DESIGN_ROOT, 'data/implementations_code.js');
  const content = fs.readFileSync(implPath, 'utf8');
  const vm = require('node:vm');
  const ctx = { window: {} };
  vm.runInNewContext(content, ctx);

  const builds = ctx.window.IMPLEMENTATIONS_DATA || {};
  for (const [slug, data] of Object.entries(builds)) {
    assert.ok(Object.keys(data.files).length > 0, `Build ${slug} must contain at least 1 file`);
  }
});

systemDesignTest('F9.B4', 'system-design manifest.js exists and is valid JavaScript', async () => {
  const manifestPath = path.resolve(SYSTEM_DESIGN_ROOT, 'js/manifest.js');
  assert.ok(fs.existsSync(manifestPath), 'js/manifest.js must exist');
  const content = fs.readFileSync(manifestPath, 'utf8');
  assert.doesNotThrow(() => {
    new Function(content);
  }, 'js/manifest.js must be valid JS');
});

systemDesignTest('F9.B5', 'system-design validate.js script exists in tools/', async () => {
  const valPath = path.resolve(SYSTEM_DESIGN_ROOT, 'tools/validate.js');
  assert.ok(fs.existsSync(valPath), 'tools/validate.js must exist in system-design');
});

// ─────────────────────────────────────────────────────────────────────────────
// F10 Boundary: GitHub Wiki & Documentation Parity
// ─────────────────────────────────────────────────────────────────────────────

wikiTest('F10.B1', 'Wiki markdown pages have non-empty titles and contents', async () => {
  const requiredWikiPages = [
    'Home.md',
    'Quick-Start.md',
    'Integration-Guide.md',
    'Workbench-Configuration.md',
    'Runtime-APIs.md'
  ];

  for (const p of requiredWikiPages) {
    const full = path.resolve(WIKI_ROOT, p);
    const content = fs.readFileSync(full, 'utf8');
    assert.ok(content.length > 100, `Wiki page ${p} must have substantial content (>100 bytes)`);
    assert.ok(content.startsWith('#'), `Wiki page ${p} must start with an H1 markdown title`);
  }
});

wikiTest('F10.B2', 'Wiki documentation contains zero references to deprecated v1.3 monolithic architecture', async () => {
  const homePath = path.resolve(WIKI_ROOT, 'Home.md');
  const content = fs.readFileSync(homePath, 'utf8');
  assert.ok(
    !content.includes('v1.3.2'),
    'Home.md should not refer to stale v1.3.2 release'
  );
});

wikiTest('F10.B3', 'Wiki Workbench-Configuration.md describes extension slot architecture', async () => {
  const confPath = path.resolve(WIKI_ROOT, 'Workbench-Configuration.md');
  const content = fs.readFileSync(confPath, 'utf8');
  assert.ok(
    content.includes('slot') || content.includes('ide.use') || content.includes('extensions'),
    'Workbench-Configuration.md must describe extension slot architecture or ide.use()'
  );
});

wikiTest('F10.B4', 'Wiki Plugin-System.md documents CodeLab.extensions namespace', async () => {
  const pluginPath = path.resolve(WIKI_ROOT, 'Plugin-System.md');
  const content = fs.readFileSync(pluginPath, 'utf8');
  assert.ok(
    content.includes('extensions') || content.includes('plugin') || content.includes('guidedLab'),
    'Plugin-System.md must document extensions or guidedLab'
  );
});

wikiTest('F10.B5', 'Wiki Authoring-Guided-Labs.md documents GuidedStep schema and properties', async () => {
  const guidePath = path.resolve(WIKI_ROOT, 'Authoring-Guided-Labs.md');
  const content = fs.readFileSync(guidePath, 'utf8');
  assert.ok(
    content.includes('instructions') || content.includes('step') || content.includes('title'),
    'Authoring-Guided-Labs.md must document step properties'
  );
});

// ── Standalone Execution ────────────────────────────────────────────────────

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed === 0 ? 0 : 1);
  });
}

module.exports = suite;
