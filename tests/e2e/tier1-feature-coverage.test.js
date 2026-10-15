'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Tier 1: Feature Coverage (F1 to F10, >= 5 tests each, 50 tests total)
 * Opaque-box requirement-driven verification derived from ORIGINAL_REQUEST.md,
 * PROJECT.md, and TEST_INFRA.md.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CODE_LAB_ROOT,
  SYSTEM_DESIGN_ROOT,
  WIKI_ROOT,
  setupMockDOM,
  teardownMockDOM,
  loadSchemas,
  runCommand,
  createSuite
} = require('./e2e-harness');

const suite = createSuite('Tier 1', 'Feature Coverage (F1 through F10)');

// ─────────────────────────────────────────────────────────────────────────────
// F1: TypeScript Build & Typecheck (tsc --noEmit, esbuild)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F1.1', 'tsconfig.json exists with ES2022+, strict mode, and declaration emit', async () => {
  const tsconfigPath = path.resolve(CODE_LAB_ROOT, 'tsconfig.json');
  assert.ok(fs.existsSync(tsconfigPath), 'tsconfig.json must exist in repository root');
  const raw = fs.readFileSync(tsconfigPath, 'utf8');
  // Strip comments if any
  const cleaned = raw.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');
  const config = JSON.parse(cleaned);

  assert.ok(config.compilerOptions, 'compilerOptions must be defined');
  const co = config.compilerOptions;
  assert.equal(co.strict, true, 'compilerOptions.strict must be true');
  assert.ok(
    co.target && (co.target.toLowerCase().includes('es2022') || co.target.toLowerCase().includes('esnext')),
    `compilerOptions.target (${co.target}) must be ES2022 or higher`
  );
  assert.equal(co.declaration, true, 'compilerOptions.declaration must be true');
  assert.ok(
    config.include && config.include.some(pattern => pattern.includes('src')),
    'config.include must include src tree'
  );
});

suite.test('F1.2', 'package.json defines v2.0.0, TypeScript build scripts, and dependencies', async () => {
  const pkgPath = path.resolve(CODE_LAB_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.equal(pkg.version, '2.0.0', 'package.json version must be 2.0.0');
  assert.ok(pkg.scripts, 'scripts object must exist');
  assert.ok(pkg.scripts.build, 'scripts.build must be defined');
  assert.ok(pkg.scripts.typecheck, 'scripts.typecheck must be defined');
  assert.ok(pkg.scripts.typecheck.includes('tsc'), 'scripts.typecheck must run tsc');

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  assert.ok(allDeps.zod, 'zod must be in dependencies/devDependencies');
  assert.ok(allDeps.typescript, 'typescript must be in dependencies/devDependencies');
  assert.ok(allDeps.esbuild, 'esbuild must be in dependencies/devDependencies');
});

suite.test('F1.3', 'src/ contains TypeScript modules and zero legacy src/*.js files', async () => {
  const srcDir = path.resolve(CODE_LAB_ROOT, 'src');
  const files = fs.readdirSync(srcDir);

  const requiredTsModules = [
    'schemas.ts',
    'terminal.ts',
    'runtime.ts',
    'shell.ts',
    'workbench.ts',
    'index.ts'
  ];

  for (const mod of requiredTsModules) {
    const p = path.resolve(srcDir, mod);
    assert.ok(fs.existsSync(p), `Required TypeScript module src/${mod} must exist`);
  }

  const legacyJsFiles = files.filter(f => f.endsWith('.js'));
  assert.deepEqual(
    legacyJsFiles,
    [],
    `Legacy JavaScript source files remain in src/: ${legacyJsFiles.join(', ')}. All modules must be TypeScript (.ts).`
  );
});

suite.test('F1.4', 'Typecheck pipeline (tsc --noEmit) executes without TypeScript compiler errors', async () => {
  const res = runCommand('npm run typecheck || npx tsc --noEmit', { cwd: CODE_LAB_ROOT });
  assert.equal(res.status, 0, `Typecheck failed with exit code ${res.status}:\n${res.stderr}\n${res.stdout}`);
});

suite.test('F1.5', 'Production build outputs exist in dist/ with CJS, ESM, CSS, and .d.ts types', async () => {
  const distDir = path.resolve(CODE_LAB_ROOT, 'dist');
  assert.ok(fs.existsSync(distDir), 'dist/ directory must exist');

  const requiredOutputs = [
    'code-lab.js',
    'code-lab.esm.js',
    'code-lab.d.ts',
    'code-lab.css',
    'runtime.js',
    'runtime.esm.js',
    'shell.js',
    'shell.esm.js',
    'terminal.js',
    'terminal.esm.js',
    'extensions/guided-lab.js',
    'extensions/guided-lab.esm.js'
  ];

  for (const out of requiredOutputs) {
    const fullPath = path.resolve(distDir, out);
    assert.ok(fs.existsSync(fullPath), `Compiled bundle dist/${out} must exist`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 0, `dist/${out} must not be empty`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F2: Zod Schema Validation (src/schemas.ts)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F2.1', 'WorkbenchOptionsSchema validates valid config and sets default title to code-lab', async () => {
  const { WorkbenchOptionsSchema } = loadSchemas();
  assert.ok(WorkbenchOptionsSchema, 'WorkbenchOptionsSchema must be exported');

  const parsed = WorkbenchOptionsSchema.parse({
    files: { 'index.ts': 'console.log("hello");' }
  });

  assert.equal(parsed.title, 'code-lab', 'Default title must be "code-lab"');
  assert.equal(parsed.theme, 'auto', 'Default theme must be "auto"');
  assert.equal(parsed.persistState, true, 'Default persistState must be true');
  assert.deepEqual(parsed.files, { 'index.ts': 'console.log("hello");' });
});

suite.test('F2.2', 'GuidedLabExtensionOptionsSchema validates steps array and mode configuration', async () => {
  const { GuidedLabExtensionOptionsSchema } = loadSchemas();
  assert.ok(GuidedLabExtensionOptionsSchema, 'GuidedLabExtensionOptionsSchema must be exported');

  const parsed = GuidedLabExtensionOptionsSchema.parse({
    mode: 'guided',
    stepIndex: 1,
    steps: [
      { id: 'step-1', title: 'Step 1', instructions: 'Implement hash function' },
      { id: 'step-2', title: 'Step 2', instructions: 'Implement lookup' }
    ]
  });

  assert.equal(parsed.mode, 'guided');
  assert.equal(parsed.stepIndex, 1);
  assert.equal(parsed.steps.length, 2);
  assert.equal(parsed.steps[0].id, 'step-1');
});

suite.test('F2.3', 'GuidedStepSchema validates step definitions and rejects missing required fields', async () => {
  const { GuidedStepSchema } = loadSchemas();
  assert.ok(GuidedStepSchema, 'GuidedStepSchema must be exported');

  // Valid step
  const valid = GuidedStepSchema.safeParse({
    id: 'step-wal',
    title: 'Write-Ahead Log',
    instructions: 'Append entries to log before updating state'
  });
  assert.equal(valid.success, true, 'Valid step must pass');

  // Invalid: missing id
  const missingId = GuidedStepSchema.safeParse({
    title: 'Missing ID',
    instructions: 'Some instruction'
  });
  assert.equal(missingId.success, false, 'Step without id must be rejected');

  // Invalid: missing instructions
  const missingInstr = GuidedStepSchema.safeParse({
    id: 's1',
    title: 'Missing Instructions'
  });
  assert.equal(missingInstr.success, false, 'Step without instructions must be rejected');
});

suite.test('F2.4', 'GitHubCloneOptionsSchema sets defaults and validates onProgress callback', async () => {
  const { GitHubCloneOptionsSchema } = loadSchemas();
  assert.ok(GitHubCloneOptionsSchema, 'GitHubCloneOptionsSchema must be exported');

  const progressEvents = [];
  const parsed = GitHubCloneOptionsSchema.parse({
    onProgress: (ev) => progressEvents.push(ev)
  });

  assert.equal(parsed.intoRoot, true, 'Default intoRoot must be true');
  assert.equal(parsed.targetDir, '/workspace', 'Default targetDir must be /workspace');
  assert.equal(parsed.concurrency, 8, 'Default concurrency must be 8');
  assert.equal(typeof parsed.onProgress, 'function', 'onProgress must be a function');
});

suite.test('F2.5', 'RuntimeExecuteOptionsSchema and WorkspaceSnapshotSchema validate modes and structure', async () => {
  const { RuntimeExecuteOptionsSchema, WorkspaceSnapshotSchema } = loadSchemas();
  assert.ok(RuntimeExecuteOptionsSchema, 'RuntimeExecuteOptionsSchema must be exported');
  assert.ok(WorkspaceSnapshotSchema, 'WorkspaceSnapshotSchema must be exported');

  const exec = RuntimeExecuteOptionsSchema.parse({
    entry: 'main.ts',
    mode: 'test',
    timeoutMs: 15000
  });
  assert.equal(exec.mode, 'test');
  assert.equal(exec.timeoutMs, 15000);

  const snapshot = WorkspaceSnapshotSchema.parse({
    version: 1,
    files: { 'app.ts': 'export const x = 1;' },
    openTabs: ['app.ts'],
    activeFile: 'app.ts'
  });
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.activeFile, 'app.ts');
  assert.deepEqual(snapshot.openTabs, ['app.ts']);
});

// ─────────────────────────────────────────────────────────────────────────────
// F3: Pure Core IDE DOM Isolation (zero guided UI)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F3.1', 'Mounting pure Core Workbench creates pure IDE container with Monaco and explorer', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const { Workbench, mount } = require('../..');
    const ide = (mount || Workbench.mount)(mountEl, {
      files: { 'index.ts': '// pure ide' }
    });

    assert.ok(ide, 'Workbench instance must be returned');
    assert.ok(mountEl.querySelector('.codelab-workbench'), 'Workbench container must be rendered');
    assert.ok(mountEl.querySelector('.codelab-editor-pane') || mountEl.querySelector('.codelab-editor-wrap'), 'Editor pane must be rendered');
    assert.ok(mountEl.querySelector('.codelab-tree-pane') || mountEl.querySelector('.codelab-explorer'), 'Explorer pane must be rendered');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.2', 'DOM Invariant: strictly 0 .codelab-mode-switch elements exist in pure Core IDE', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const { Workbench, mount } = require('../..');
    (mount || Workbench.mount)(mountEl, {
      files: { 'demo.js': 'console.log(1);' }
    });

    const modeSwitches = mountEl.querySelectorAll('.codelab-mode-switch');
    assert.equal(
      modeSwitches.length,
      0,
      `Core IDE layout must contain zero .codelab-mode-switch elements, found ${modeSwitches.length}`
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.3', 'DOM Invariant: strictly 0 .codelab-lang-switch elements exist in pure Core IDE', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const { Workbench, mount } = require('../..');
    (mount || Workbench.mount)(mountEl, {
      files: { 'demo.js': 'console.log(1);' }
    });

    const langSwitches = mountEl.querySelectorAll('.codelab-lang-switch');
    assert.equal(
      langSwitches.length,
      0,
      `Core IDE layout must contain zero .codelab-lang-switch elements, found ${langSwitches.length}`
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.4', 'DOM Invariant: strictly 0 .codelab-guide elements exist in pure Core IDE', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const { Workbench, mount } = require('../..');
    (mount || Workbench.mount)(mountEl, {
      files: { 'demo.js': 'console.log(1);' }
    });

    const guides = mountEl.querySelectorAll('.codelab-guide');
    assert.equal(
      guides.length,
      0,
      `Core IDE layout must contain zero .codelab-guide elements, found ${guides.length}`
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F3.5', 'Pure Core Workbench provides extension slot containers (#cl-slot-*) in layout', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const { Workbench, mount } = require('../..');
    (mount || Workbench.mount)(mountEl, {
      files: { 'demo.js': 'console.log(1);' }
    });

    const topbarLeft = mountEl.querySelector('#cl-slot-topbar-left');
    const topbarActions = mountEl.querySelector('#cl-slot-topbar-actions');
    const sidebarLeft = mountEl.querySelector('#cl-slot-sidebar-left');

    assert.ok(topbarLeft, 'Slot #cl-slot-topbar-left must exist for modular extension mounting');
    assert.ok(topbarActions, 'Slot #cl-slot-topbar-actions must exist for custom action buttons');
    assert.ok(sidebarLeft, 'Slot #cl-slot-sidebar-left must exist for modular guide/panel extensions');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F4: Modular Guided Lab Extension (CodeLab.extensions.guidedLab)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F4.1', 'CodeLab.extensions.guidedLab is exported and implements extension contract', async () => {
  const CodeLab = require('../..');
  assert.ok(CodeLab.extensions, 'CodeLab.extensions object must exist');
  assert.ok(CodeLab.extensions.guidedLab, 'CodeLab.extensions.guidedLab must be defined');

  const ext = CodeLab.extensions.guidedLab;
  assert.equal(ext.name, 'guided-lab', 'Extension name must be "guided-lab"');
  assert.ok(
    typeof ext.mount === 'function' || typeof ext.install === 'function',
    'Extension must provide a mount or install method'
  );
});

suite.test('F4.2', 'Registering guidedLab extension mounts .codelab-mode-switch into #cl-slot-topbar-left', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: { 'demo.js': '' } });

    assert.equal(typeof ide.use, 'function', 'ide.use() method must be available');
    ide.use(CodeLab.extensions.guidedLab, {
      steps: [{ id: 's1', title: 'Step 1', instructions: 'Implement it' }],
      mode: 'guided'
    });

    const slot = mountEl.querySelector('#cl-slot-topbar-left');
    assert.ok(slot, '#cl-slot-topbar-left must exist');
    const modeSwitch = slot.querySelector('.codelab-mode-switch');
    assert.ok(modeSwitch, '.codelab-mode-switch must be mounted inside #cl-slot-topbar-left');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.3', 'Registering guidedLab extension mounts .codelab-lang-switch into #cl-slot-topbar-left', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: { 'demo.js': '' } });

    ide.use(CodeLab.extensions.guidedLab, {
      steps: [{ id: 's1', title: 'Step 1', instructions: 'Step 1' }],
      language: 'ts',
      tsFiles: { 'demo.ts': 'export const a = 1;' }
    });

    const slot = mountEl.querySelector('#cl-slot-topbar-left');
    const langSwitch = slot.querySelector('.codelab-lang-switch');
    assert.ok(langSwitch, '.codelab-lang-switch must be mounted inside #cl-slot-topbar-left');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.4', 'Registering guidedLab extension mounts .codelab-guide into #cl-slot-sidebar-left', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: { 'demo.js': '' } });

    ide.use(CodeLab.extensions.guidedLab, {
      steps: [
        { id: 'step-1', title: 'Step 1', instructions: 'Build core algorithm' },
        { id: 'step-2', title: 'Step 2', instructions: 'Verify edge cases' }
      ]
    });

    const sidebarSlot = mountEl.querySelector('#cl-slot-sidebar-left');
    assert.ok(sidebarSlot, '#cl-slot-sidebar-left must exist');
    const guide = sidebarSlot.querySelector('.codelab-guide');
    assert.ok(guide, '.codelab-guide must be mounted inside #cl-slot-sidebar-left');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F4.5', 'Registering guidedLab mounts Verify Step action button into #cl-slot-topbar-actions', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: { 'demo.js': '' } });

    ide.use(CodeLab.extensions.guidedLab, {
      steps: [{ id: 's1', title: 'Step 1', instructions: 'Build it' }]
    });

    const actionsSlot = mountEl.querySelector('#cl-slot-topbar-actions');
    assert.ok(actionsSlot, '#cl-slot-topbar-actions must exist');
    const verifyBtn = actionsSlot.querySelector('[data-action="verify-step"]') ||
                      actionsSlot.querySelector('#cl-btn-verify') ||
                      actionsSlot.querySelector('button');
    assert.ok(verifyBtn, 'Verify button must be mounted inside #cl-slot-topbar-actions');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F5: Cloud IDE Landing Screen & Blank Workspace
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F5.1', 'Cloud IDE app in examples/cloud-ide provides initial landing view card', async () => {
  const cloudIdeDir = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide');
  assert.ok(fs.existsSync(cloudIdeDir), 'examples/cloud-ide directory must exist');

  const indexAstro = path.resolve(cloudIdeDir, 'src/pages/index.astro');
  assert.ok(fs.existsSync(indexAstro), 'src/pages/index.astro must exist in examples/cloud-ide');

  const content = fs.readFileSync(indexAstro, 'utf8');
  assert.ok(
    content.includes('landing') || content.includes('repo-entry') || content.includes('card'),
    'index.astro must contain landing screen / repo-entry card container'
  );
});

suite.test('F5.2', 'Cloud IDE landing view contains repository input supporting owner/repo or URL', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  assert.ok(
    content.includes('repo-input') || content.includes('id="repo"') || content.includes('placeholder='),
    'Landing card must contain input for repository specification'
  );
});

suite.test('F5.3', 'Cloud IDE landing view contains Clone & Open button', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  assert.ok(
    content.includes('Clone & Open') || content.includes('clone-btn') || content.includes('Clone and Open'),
    'Landing card must include "Clone & Open" action button'
  );
});

suite.test('F5.4', 'Cloud IDE landing view contains Blank Workspace action', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  assert.ok(
    content.includes('Blank Workspace') || content.includes('blank-workspace') || content.includes('blank-btn'),
    'Landing card must include "Blank Workspace" button/link'
  );
});

suite.test('F5.5', 'Cloud IDE script recognizes ?repo= URL parameter to initialize repository target', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  assert.ok(
    content.includes('URLSearchParams') && content.includes('repo'),
    'Cloud IDE script must parse ?repo= parameter from location.search'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// F6: Streaming Git Clone Logs (onProgress events)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F6.1', 'cloneGitHubRepository accepts onProgress structured progress event callback', async () => {
  const { cloneGitHubRepository } = require('../../dist/shell.js') || require('../../src/shell');
  assert.equal(typeof cloneGitHubRepository, 'function', 'cloneGitHubRepository must be exported');
});

suite.test('F6.2', 'onProgress events conform to CloneProgressEventSchema with phase and message', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  assert.ok(CloneProgressEventSchema, 'CloneProgressEventSchema must be exported');

  const testEvent = {
    phase: 'connecting',
    message: 'Connecting to GitHub REST API...'
  };
  const parsed = CloneProgressEventSchema.parse(testEvent);
  assert.equal(parsed.phase, 'connecting');
  assert.equal(parsed.message, 'Connecting to GitHub REST API...');
});

suite.test('F6.3', 'Progress phase enum includes connecting, metadata, downloading, mounting, ready, error', async () => {
  const { CloneProgressPhaseSchema } = loadSchemas();
  const validPhases = ['connecting', 'metadata', 'downloading', 'mounting', 'ready', 'error'];

  for (const ph of validPhases) {
    const res = CloneProgressPhaseSchema.safeParse(ph);
    assert.equal(res.success, true, `Phase "${ph}" must be valid in CloneProgressPhaseSchema`);
  }

  const invalid = CloneProgressPhaseSchema.safeParse('non-existent-phase');
  assert.equal(invalid.success, false, 'Invalid phase must be rejected');
});

suite.test('F6.4', 'Downloading progress event includes numeric loaded and total counters', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const downloadEvent = {
    phase: 'downloading',
    message: 'Downloading file 5 of 20...',
    loaded: 5,
    total: 20
  };

  const parsed = CloneProgressEventSchema.parse(downloadEvent);
  assert.equal(parsed.loaded, 5);
  assert.equal(parsed.total, 20);
});

suite.test('F6.5', 'Error phase event records error message and failure details', async () => {
  const { CloneProgressEventSchema } = loadSchemas();
  const errEvent = {
    phase: 'error',
    message: 'Repository not found or network unavailable'
  };

  const parsed = CloneProgressEventSchema.parse(errEvent);
  assert.equal(parsed.phase, 'error');
  assert.ok(parsed.message.includes('not found'));
});

// ─────────────────────────────────────────────────────────────────────────────
// F7: Same-Origin Asset Distribution (ide.cloneRepo presence)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F7.1', 'Cloud IDE HTML references same-origin /dist/code-lab.js and /dist/code-lab.css', async () => {
  const indexAstro = path.resolve(CODE_LAB_ROOT, 'examples/cloud-ide/src/pages/index.astro');
  const content = fs.readFileSync(indexAstro, 'utf8');

  assert.ok(
    content.includes('/dist/code-lab.js'),
    'index.astro must reference same-origin /dist/code-lab.js'
  );
  assert.ok(
    content.includes('/dist/code-lab.css'),
    'index.astro must reference same-origin /dist/code-lab.css'
  );
});

suite.test('F7.2', 'Mounted workbench instance exposes typeof ide.cloneRepo === "function"', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.equal(
      typeof ide.cloneRepo,
      'function',
      'ide.cloneRepo must be a function on mounted workbench instance'
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F7.3', 'ide.cloneRepo forwards onProgress callback to underlying clone engine', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    let receivedEvent = null;
    try {
      // Pass a dummy repo and capture onProgress invocation
      await ide.cloneRepo('dummy/repo-for-progress', {
        onProgress: (ev) => { receivedEvent = ev; },
        fetchImpl: async () => ({ ok: false, status: 404, statusText: 'Not Found' })
      });
    } catch (_) {
      // network failure is expected; progress callback or error is what we verify
    }

    assert.ok(
      receivedEvent !== null,
      'ide.cloneRepo must invoke onProgress callback during clone lifecycle'
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F7.4', 'Compiled dist/code-lab.js explicitly includes cloneRepo method export', async () => {
  const distBundlePath = path.resolve(CODE_LAB_ROOT, 'dist/code-lab.js');
  assert.ok(fs.existsSync(distBundlePath), 'dist/code-lab.js must exist');

  const bundle = fs.readFileSync(distBundlePath, 'utf8');
  assert.ok(
    bundle.includes('cloneRepo') || bundle.includes('cloneGitHubRepository'),
    'dist/code-lab.js bundle must export cloneRepo'
  );
});

suite.test('F7.5', 'Same-origin asset distribution prevents missing function runtime crash', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    const ide = CodeLab.mount(mountEl, { files: {} });

    assert.doesNotThrow(() => {
      if (typeof ide.cloneRepo !== 'function') {
        throw new TypeError('ide.cloneRepo is not a function');
      }
    }, 'Accessing ide.cloneRepo must not throw TypeError');
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F8: Minimal Header Branding
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F8.1', 'Brand title in workbench topbar defaults strictly to "code-lab"', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    (CodeLab.mount || CodeLab.Workbench.mount)(mountEl, { files: {} });

    const titleEl = mountEl.querySelector('.codelab-title') || mountEl.querySelector('.codelab-brand');
    assert.ok(titleEl, 'Title element must exist in topbar');
    assert.equal(titleEl.textContent.trim(), 'code-lab', 'Brand title must be strictly "code-lab"');
    assert.ok(
      !titleEl.textContent.includes('@innovatorved'),
      'Brand title must NOT include @innovatorved'
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.2', 'Topbar contains zero marketing badges (studio-badge or Git Clone SDK)', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    (CodeLab.mount || CodeLab.Workbench.mount)(mountEl, { files: {} });

    const badges = mountEl.querySelectorAll('.studio-badge');
    assert.equal(badges.length, 0, 'Zero .studio-badge marketing badges should exist in workbench');
    assert.ok(
      !mountEl.innerHTML.includes('Git Clone SDK'),
      'Layout must not contain marketing phrase "Git Clone SDK"'
    );
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.3', 'Topbar contains zero npm buttons or external package links', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    (CodeLab.mount || CodeLab.Workbench.mount)(mountEl, { files: {} });

    const npmBtns = mountEl.querySelectorAll('a[href*="npmjs.com"], button[id*="npm"]');
    assert.equal(npmBtns.length, 0, 'Zero npm buttons or npm links must exist in topbar');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.4', 'Quick Clone Public Repos sub-bar and preset pills are absent from header layout', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    (CodeLab.mount || CodeLab.Workbench.mount)(mountEl, { files: {} });

    const subbar = mountEl.querySelector('.studio-subbar');
    const pills = mountEl.querySelectorAll('.preset-pill');

    assert.equal(subbar, null, '.studio-subbar must be removed from layout');
    assert.equal(pills.length, 0, 'Preset pills must be removed from layout');
  } finally {
    teardownMockDOM();
  }
});

suite.test('F8.5', 'Theme toggle button is icon-only (SVG) with no text node "Theme"', async () => {
  const doc = setupMockDOM();
  try {
    const mountEl = doc.createElement('div');
    doc.body.appendChild(mountEl);

    const CodeLab = require('../..');
    (CodeLab.mount || CodeLab.Workbench.mount)(mountEl, { files: {} });

    const themeBtn = mountEl.querySelector('#cl-btn-theme') || mountEl.querySelector('#theme-toggle-btn');
    assert.ok(themeBtn, 'Theme button must exist');
    assert.notEqual(themeBtn.textContent.trim(), 'Theme', 'Theme button must not have text "Theme"');
    assert.ok(
      themeBtn.innerHTML.includes('<svg') || themeBtn.querySelector('svg'),
      'Theme button must render an SVG icon'
    );
  } finally {
    teardownMockDOM();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// F9: Downstream system-design Integration (15 build labs)
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F9.1', 'system-design js/app.js configures code-lab v2.0.0 CDN links', async () => {
  const appJsPath = path.resolve(SYSTEM_DESIGN_ROOT, 'js/app.js');
  assert.ok(fs.existsSync(appJsPath), 'system-design/js/app.js must exist');

  const content = fs.readFileSync(appJsPath, 'utf8');
  assert.ok(
    content.includes('code-lab@v2.0.0') || content.includes('code-lab@2.0.0'),
    'system-design/js/app.js must load code-lab v2.0.0 CDN target'
  );
});

suite.test('F9.2', 'system-design js/app.js registers CodeLab.extensions.guidedLab', async () => {
  const appJsPath = path.resolve(SYSTEM_DESIGN_ROOT, 'js/app.js');
  const content = fs.readFileSync(appJsPath, 'utf8');

  assert.ok(
    content.includes('guidedLab') && (content.includes('activeCodeLab.use(') || content.includes('ide.use(')),
    'system-design/js/app.js must register CodeLab.extensions.guidedLab via ide.use()'
  );
});

suite.test('F9.3', 'system-design defines all 15 interactive build labs in implementations_code.js', async () => {
  const implPath = path.resolve(SYSTEM_DESIGN_ROOT, 'data/implementations_code.js');
  assert.ok(fs.existsSync(implPath), 'data/implementations_code.js must exist');

  const content = fs.readFileSync(implPath, 'utf8');
  const vm = require('node:vm');
  const ctx = { window: {} };
  vm.runInNewContext(content, ctx);

  const builds = ctx.window.IMPLEMENTATIONS_DATA || {};
  const slugs = Object.keys(builds);
  assert.equal(slugs.length, 15, `Must define exactly 15 build labs, found ${slugs.length}`);

  const requiredSlugs = [
    'load-balancer-from-scratch',
    'consistent-hashing-ring',
    'sliding-window-rate-limiter',
    'lru-cache',
    'ttl-cache-reaper',
    'bloom-filter-membership',
    'snowflake-id-generator',
    'keyset-pagination-cursors',
    'write-ahead-log',
    'lsm-tree-kv-store',
    'lease-leader-election',
    'gossip-protocol',
    'merkle-anti-entropy',
    'hyperloglog-cardinality',
    'tiny-search-engine'
  ];

  for (const s of requiredSlugs) {
    assert.ok(builds[s], `Build lab "${s}" must exist in implementations_code.js`);
    assert.ok(builds[s].files, `Build lab "${s}" must contain files record`);
  }
});

suite.test('F9.4', 'system-design static validator passes with 0 errors, 0 warnings', async () => {
  const res = runCommand('node tools/validate.js', { cwd: SYSTEM_DESIGN_ROOT });
  assert.equal(res.status, 0, `Validation failed with exit code ${res.status}:\n${res.stderr}\n${res.stdout}`);
  assert.ok(
    res.stdout.includes('0 errors') || res.stdout.includes('0 warning') || res.stdout.includes('passed'),
    'Validation output must confirm 0 errors'
  );
});

suite.test('F9.5', 'system-design data/projects.js and notices record v2.0.0', async () => {
  const projectsJs = path.resolve(SYSTEM_DESIGN_ROOT, 'data/projects.js');
  const noticesMd = path.resolve(SYSTEM_DESIGN_ROOT, 'THIRD_PARTY_NOTICES.md');

  const pContent = fs.readFileSync(projectsJs, 'utf8');
  assert.ok(
    pContent.includes('v2.0.0'),
    'data/projects.js must record code-lab as v2.0.0'
  );

  const nContent = fs.readFileSync(noticesMd, 'utf8');
  assert.ok(
    nContent.includes('v2.0.0') || nContent.includes('2.0.0'),
    'THIRD_PARTY_NOTICES.md must record code-lab as v2.0.0'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// F10: GitHub Wiki & Documentation Parity
// ─────────────────────────────────────────────────────────────────────────────

suite.test('F10.1', 'code-lab README.md documents v2.0.0, TypeScript, Zod, and pure IDE architecture', async () => {
  const readmePath = path.resolve(CODE_LAB_ROOT, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.ok(readme.includes('2.0.0'), 'README.md must reference version 2.0.0');
  assert.ok(
    readme.includes('TypeScript') || readme.includes('tsconfig'),
    'README.md must document TypeScript architecture'
  );
  assert.ok(
    readme.includes('Zod') || readme.includes('schemas'),
    'README.md must document Zod schema validation'
  );
});

suite.test('F10.2', 'code-lab ARCHITECTURE.md documents modular Core IDE vs guidedLab extension', async () => {
  const archPath = path.resolve(CODE_LAB_ROOT, 'ARCHITECTURE.md');
  const arch = fs.readFileSync(archPath, 'utf8');

  assert.ok(
    arch.includes('guidedLab') || arch.includes('extensions/guided-lab'),
    'ARCHITECTURE.md must document modular guidedLab extension'
  );
  assert.ok(
    arch.includes('slot') || arch.includes('use('),
    'ARCHITECTURE.md must document slot mounting architecture'
  );
});

suite.test('F10.3', 'All 10 Wiki markdown pages exist in wiki documentation repository', async () => {
  const requiredWikiPages = [
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

  for (const page of requiredWikiPages) {
    const pagePath = path.resolve(WIKI_ROOT, page);
    assert.ok(
      fs.existsSync(pagePath),
      `Wiki documentation page ${page} must exist in ${WIKI_ROOT}`
    );
  }
});

suite.test('F10.4', 'Wiki _Sidebar.md contains 0 broken navigation links', async () => {
  const sidebarPath = path.resolve(WIKI_ROOT, '_Sidebar.md');
  assert.ok(fs.existsSync(sidebarPath), '_Sidebar.md must exist in wiki');

  const content = fs.readFileSync(sidebarPath, 'utf8');
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  let linkCount = 0;

  while ((m = linkRegex.exec(content)) !== null) {
    linkCount++;
    const linkTarget = m[2].trim();
    // External links or anchors are ignored
    if (linkTarget.startsWith('http') || linkTarget.startsWith('#')) continue;

    const slug = linkTarget.replace(/\.md$/, '');
    const targetMd = path.resolve(WIKI_ROOT, `${slug}.md`);
    assert.ok(
      fs.existsSync(targetMd),
      `Broken sidebar link target: ${linkTarget} (expected file ${targetMd})`
    );
  }

  assert.ok(linkCount >= 10, `Sidebar must contain links to all wiki pages (found ${linkCount})`);
});

suite.test('F10.5', 'Wiki documentation details ide.cloneRepo() and onProgress streaming options', async () => {
  const wbDocPath = path.resolve(WIKI_ROOT, 'Workbench-Configuration.md');
  const content = fs.readFileSync(wbDocPath, 'utf8');

  assert.ok(
    content.includes('cloneRepo') || content.includes('onProgress'),
    'Workbench-Configuration.md must document cloneRepo and streaming onProgress events'
  );
});

// ── Standalone Execution ────────────────────────────────────────────────────

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed === 0 ? 0 : 1);
  });
}

module.exports = suite;
