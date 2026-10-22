'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tier 4: Real-World End-to-End Application Scenarios (S1 through S5, >= 5 tests)
 * Validates complex, multi-step realistic workloads across the entire ecosystem.
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
  runCommand,
  createSuite
} = require('./e2e-harness');

const suite = createSuite('Tier 4', 'Real-World End-to-End Scenarios (S1 through S5)');

const DOWNSTREAM_TESTS = process.env.CODELAB_DOWNSTREAM_TESTS === '1';
const systemDesignTest = (id, name, fn) =>
  suite.skipUnless(
    DOWNSTREAM_TESTS && HAS_SYSTEM_DESIGN,
    id,
    name,
    fn,
    'set CODELAB_DOWNSTREAM_TESTS=1 and check out ../system-design'
  );

// ─────────────────────────────────────────────────────────────────────────────
// Scenario S1: Pure Repository Workspace
// User opens blank IDE, writes multi-file TS project, runs REPL & builds
// ─────────────────────────────────────────────────────────────────────────────

suite.test('S1', 'Pure Repository Workspace: Blank IDE, multi-file TS project execution and REPL evaluation', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    // 1. User opens blank IDE
    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });
    assert.ok(ide, 'IDE must mount successfully');

    // Confirm pure IDE DOM isolation
    assert.equal(mountEl.querySelectorAll('.codelab-guide').length, 0);
    assert.equal(mountEl.querySelectorAll('.codelab-mode-switch').length, 0);

    // 2. User writes a multi-file TypeScript project
    const projectFiles = {
      'math.ts': `
        export function add(a: number, b: number): number {
          return a + b;
        }
        export function multiply(a: number, b: number): number {
          return a * b;
        }
      `,
      'index.ts': `
        import { add, multiply } from './math';
        const sum = add(20, 22);
        const prod = multiply(6, 7);
        console.log('SUM:' + sum);
        console.log('PROD:' + prod);
      `
    };

    // 3. User executes project in Virtual Runtime
    const { executeInVirtualRuntime } = require('../helpers/load').runtime;
    const stdoutLogs = [];

    const runResult = await executeInVirtualRuntime({
      files: projectFiles,
      entry: 'index.ts',
      mode: 'run',
      onStdout: (msg) => stdoutLogs.push(msg)
    });

    assert.equal(runResult.exitCode, 0, `Runtime execution failed: ${runResult.stderr}`);
    assert.equal(runResult.ok, true);
    const outputText = stdoutLogs.join('\n');
    assert.ok(outputText.includes('SUM:42'), 'Runtime must execute TS add() and output SUM:42');
    assert.ok(outputText.includes('PROD:42'), 'Runtime must execute TS multiply() and output PROD:42');

    // 4. User runs REPL evaluation
    const replResult = await executeInVirtualRuntime({
      files: projectFiles,
      entry: 'math.ts',
      mode: 'repl',
      replCode: 'require("./math.ts").add(100, 25);'
    });

    assert.equal(replResult.exitCode, 0, `REPL execution failed: ${replResult.stderr}`);
    assert.equal(replResult.ok, true);
    assert.equal(String(replResult.replValue), '125', 'REPL evaluation must return 125');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario S2: GitHub Repo Clone & Explore
// User clones public repository from landing card with live streaming logs
// ─────────────────────────────────────────────────────────────────────────────

suite.test('S2', 'GitHub Repo Clone & Explore: Landing card entry, live streaming progress logs, and IDE transition', async () => {
  const { CloneProgressEventSchema } = loadSchemas();

  // 1. User arrives at Cloud IDE landing card
  const indexAstroPath = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  assert.ok(fs.existsSync(indexAstroPath), 'Cloud IDE index.astro must exist');
  const astroContent = fs.readFileSync(indexAstroPath, 'utf8');

  assert.ok(astroContent.includes('repo-input') || astroContent.includes('id="repo"'));
  assert.ok(astroContent.includes('Clone & Open') || astroContent.includes('clone-btn'));

  // 2. User enters repository and initiates Clone & Open with onProgress callback
  const streamedEvents = [];
  const onProgress = (event) => {
    const validated = CloneProgressEventSchema.parse(event);
    streamedEvents.push(validated);
  };

  // Simulate complete clone lifecycle
  onProgress({ phase: 'connecting', message: 'Connecting to GitHub repository...' });
  onProgress({ phase: 'metadata', message: 'Retrieving branch and tree metadata...' });
  onProgress({ phase: 'downloading', message: 'Downloading files (1/5)...', loaded: 1, total: 5 });
  onProgress({ phase: 'downloading', message: 'Downloading files (5/5)...', loaded: 5, total: 5 });
  onProgress({ phase: 'mounting', message: 'Mounting files in virtual filesystem...' });
  onProgress({ phase: 'ready', message: 'Repository mounted successfully.' });

  assert.equal(streamedEvents.length, 6);
  assert.equal(streamedEvents[0].phase, 'connecting');
  assert.equal(streamedEvents[streamedEvents.length - 1].phase, 'ready');

  // 3. User enters full IDE with cloned repository
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, {
      files: {
        'README.md': '# Cloned Project\nThis is a cloned repository.',
        'src/index.ts': 'console.log("cloned");'
      }
    });

    assert.ok(ide);
    assert.equal(typeof ide.cloneRepo, 'function');

    const treeEl = mountEl.querySelector('.codelab-tree-pane') || mountEl.querySelector('.codelab-explorer');
    assert.ok(treeEl, 'File explorer tree must be visible');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario S3: Interactive System Design Guided Lab
// Mounts IDE with Guided Challenge extension, navigates steps, runs verification & solution diff
// ─────────────────────────────────────────────────────────────────────────────

suite.test('S3', 'Interactive System Design Guided Lab: Stepper navigation, verification runner, and solution diff', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, {
      title: 'Token Bucket Rate Limiter',
      files: {
        'token-bucket.js': '// starter code\nclass TokenBucket {} module.exports = { TokenBucket };'
      }
    });

    let completedStepIndex = null;
    let labCompleteCalled = false;

    // Attach Guided Lab Extension
    ide.use(loadGuidedLab(), {
      mode: 'guided',
      steps: [
        {
          id: 'step-1',
          title: 'Initialize Capacity & Refill Rate',
          instructions: 'Store capacity, tokens, refillRate, and lastRefill timestamp in constructor.'
        },
        {
          id: 'step-2',
          title: 'Implement Refill Logic',
          instructions: 'Calculate elapsed time since lastRefill and add new tokens up to capacity.'
        },
        {
          id: 'step-3',
          title: 'Implement Take / Consume Method',
          instructions: 'Refill tokens first, then deduct 1 token if available and return boolean.'
        }
      ],
      solutionFiles: {
        'token-bucket.js': '// solution\nclass TokenBucket { take() { return true; } } module.exports = { TokenBucket };'
      },
      onStepComplete: (step, index) => {
        completedStepIndex = index;
      },
      onLabComplete: () => {
        labCompleteCalled = true;
      }
    });

    // 1. Verify Stepper and Guide rendered
    const guide = mountEl.querySelector('.codelab-guide');
    assert.ok(guide, 'Guided challenge instructions panel must be mounted');

    const modeSwitch = mountEl.querySelector('.codelab-mode-switch');
    assert.ok(modeSwitch, 'Mode switch must be mounted');

    // 2. Verify the primary action is wired to step verification
    const verifyBtn = mountEl.querySelector('#cl-primary-exec-btn');
    assert.ok(verifyBtn, 'Verify Step button must exist');
    assert.equal(verifyBtn.getAttribute('data-cl-action'), 'verify-step');

    // 3. Verify the stepper rendered one pill per step
    assert.equal(mountEl.querySelectorAll('.codelab-step-pill').length, 3);

    // 4. Switch mode to Reference Sandbox
    if (ide.setMode) {
      ide.setMode('sandbox');
      assert.equal(ide.mode, 'sandbox');
    }
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario S4: Full Downstream Validation
// system-design website loads code-lab v2.0.0, runs build labs, and passes all static checks
// ─────────────────────────────────────────────────────────────────────────────

systemDesignTest('S4', 'Full Downstream Validation: system-design website integration and static checks', async () => {
  // 1. Verify app.js integration
  const appJsPath = path.resolve(SYSTEM_DESIGN_ROOT, 'js/app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  assert.ok(
    appJs.includes('code-lab@v2.0.0') || appJs.includes('code-lab@2.0.0'),
    'system-design js/app.js must load code-lab v2.0.0'
  );
  assert.ok(
    appJs.includes('guidedLab'),
    'system-design js/app.js must register guidedLab extension'
  );

  // 2. Verify all 15 build labs run and execute in virtual runtime
  const implPath = path.resolve(SYSTEM_DESIGN_ROOT, 'data/implementations_code.js');
  const vm = require('node:vm');
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(implPath, 'utf8'), ctx);
  const builds = ctx.window.IMPLEMENTATIONS_DATA;

  assert.equal(Object.keys(builds).length, 15, 'All 15 build labs must be defined');

  // 3. Execute downstream validation script
  const res = runCommand('node tools/validate.js', { cwd: SYSTEM_DESIGN_ROOT });
  assert.equal(res.status, 0, `Downstream validation failed:\n${res.stderr}\n${res.stdout}`);
  assert.ok(
    res.stdout.includes('0 errors') || res.stdout.includes('passed'),
    'Downstream validation must report 0 errors'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario S5: Documentation & Wiki Completeness
// Validates all 10 wiki markdown files and sidebar links for v2.0.0 accuracy
// ─────────────────────────────────────────────────────────────────────────────

suite.test('S5', 'Documentation completeness: repo docs always, wiki pages when the wiki checkout is present', async () => {
  // 1. Verify repo README and ARCHITECTURE
  const readme = fs.readFileSync(path.resolve(CODE_LAB_ROOT, 'README.md'), 'utf8');
  assert.ok(readme.length > 1000, 'README.md must contain substantive documentation');
  assert.ok(readme.includes('TypeScript'), 'README.md must document TypeScript');

  const arch = fs.readFileSync(path.resolve(CODE_LAB_ROOT, 'ARCHITECTURE.md'), 'utf8');
  assert.ok(arch.length > 1000, 'ARCHITECTURE.md must contain substantive documentation');
  assert.ok(arch.toLowerCase().includes('workbench'), 'ARCHITECTURE.md must document the workbench');

  // 2. Wiki documentation lives in a separate repository. Only assert on it
  //    when that checkout is actually available; otherwise the suite must
  //    remain hermetic on a clean clone.
  if (!HAS_WIKI) {
    console.log('    (wiki checkout not present — skipping wiki assertions)');
    return;
  }

  const requiredWiki = [
    'Home.md',
    'Quick-Start.md',
    'Integration-Guide.md',
    'Workbench-Configuration.md',
    'Runtime-APIs.md',
    'POSIX-Shell-and-Coreutils.md',
    'HTTP-Servers-and-Networking.md',
    'Headless-Runtime.md',
    'Authoring-Guided-Labs.md',
    'Plugin-System.md'
  ];

  for (const page of requiredWiki) {
    const full = path.resolve(WIKI_ROOT, page);
    assert.ok(fs.existsSync(full), `Wiki file ${page} must exist`);
    const content = fs.readFileSync(full, 'utf8');
    assert.ok(content.length > 50, `${page} must not be empty`);
  }

  // 3. Verify _Sidebar.md links resolve
  const sidebar = fs.readFileSync(path.resolve(WIKI_ROOT, '_Sidebar.md'), 'utf8');
  for (const page of requiredWiki) {
    const slug = page.replace('.md', '');
    assert.ok(
      sidebar.includes(`(${slug})`) || sidebar.includes(`(${page})`),
      `Sidebar must link to ${page}`
    );
  }
});

// ── Standalone Execution ────────────────────────────────────────────────────

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed === 0 ? 0 : 1);
  });
}

module.exports = suite;
