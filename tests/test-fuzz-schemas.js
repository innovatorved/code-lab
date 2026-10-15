/**
 * Empirical Challenger Test Suite: Fuzzing & Boundary Testing for src/schemas.ts
 *
 * Validates:
 * 1. Valid minimal & fully-populated inputs for all 7+ schemas
 * 2. Invalid inputs, type mismatches, prototype injections
 * 3. Boundary values: empty strings (min(1)), negative/zero integers (positive(), nonnegative()), invalid enums
 * 4. Missing required fields & proper Zod error reporting
 * 5. Type coercion behavior
 * 6. Automated randomized mutation fuzzer (500+ iterations) ensuring .safeParse() never throws
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CODE_LAB_ROOT = path.resolve(__dirname, '..');

// Load schemas via runtime transpileTS
function loadSchemas() {
  const { transpileTS } = require(path.resolve(CODE_LAB_ROOT, 'src/runtime.js'));
  const tsCode = fs.readFileSync(path.resolve(CODE_LAB_ROOT, 'src/schemas.ts'), 'utf8');
  const jsCode = transpileTS(tsCode);
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', jsCode);
  fn(require, mod, mod.exports);
  return mod.exports;
}

const schemas = loadSchemas();
const {
  GuidedStepSchema,
  LanguageBundleSchema,
  GuidedLabExtensionOptionsSchema,
  CloneProgressPhaseSchema,
  CloneProgressEventSchema,
  GitHubCloneOptionsSchema,
  RuntimeExecuteOptionsSchema,
  WorkspaceSnapshotSchema,
  WorkbenchOptionsSchema
} = schemas;

let totalAsserts = 0;
let passedAsserts = 0;

function check(desc, fn) {
  totalAsserts++;
  try {
    fn();
    passedAsserts++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    console.error(`  ✗ ${desc}:`, err.message);
    throw err;
  }
}

console.log('======================================================================');
console.log('   CHALLENGER FUZZ & BOUNDARY SUITE: src/schemas.ts');
console.log('======================================================================\n');

// ── 1. GuidedStepSchema ─────────────────────────────────────────────────────
console.log('--- 1. GuidedStepSchema Tests ---');

check('GuidedStep: minimal valid input', () => {
  const res = GuidedStepSchema.safeParse({
    id: 'step-1',
    title: 'Initialize System',
    instructions: 'Write the code.'
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.id, 'step-1');
  assert.strictEqual(res.data.title, 'Initialize System');
  assert.strictEqual(res.data.instructions, 'Write the code.');
});

check('GuidedStep: instructions as array of strings', () => {
  const res = GuidedStepSchema.safeParse({
    id: 'step-2',
    title: 'Step 2',
    instructions: ['Line 1', 'Line 2'],
    hint: 'A hint',
    testNames: ['test 1', 'test 2'],
    targetSymbol: 'MyClass',
    symbol: 'MyClass'
  });
  assert.strictEqual(res.success, true);
  assert.deepStrictEqual(res.data.instructions, ['Line 1', 'Line 2']);
  assert.strictEqual(res.data.targetSymbol, 'MyClass');
});

check('GuidedStep: rejection on empty id (min(1) boundary)', () => {
  const res = GuidedStepSchema.safeParse({
    id: '',
    title: 'Valid Title',
    instructions: 'Valid'
  });
  assert.strictEqual(res.success, false);
  assert.ok(res.error.issues.some((i) => i.path.includes('id')));
});

check('GuidedStep: rejection on empty title (min(1) boundary)', () => {
  const res = GuidedStepSchema.safeParse({
    id: 'valid-id',
    title: '',
    instructions: 'Valid'
  });
  assert.strictEqual(res.success, false);
  assert.ok(res.error.issues.some((i) => i.path.includes('title')));
});

check('GuidedStep: rejection on missing required fields', () => {
  const res1 = GuidedStepSchema.safeParse({ title: 'T', instructions: 'I' });
  assert.strictEqual(res1.success, false);
  const res2 = GuidedStepSchema.safeParse({ id: 'ID', instructions: 'I' });
  assert.strictEqual(res2.success, false);
  const res3 = GuidedStepSchema.safeParse({ id: 'ID', title: 'T' });
  assert.strictEqual(res3.success, false);
});

check('GuidedStep: rejection on invalid instructions type (number/boolean)', () => {
  const res1 = GuidedStepSchema.safeParse({ id: 'ID', title: 'T', instructions: 123 });
  assert.strictEqual(res1.success, false);
  const res2 = GuidedStepSchema.safeParse({ id: 'ID', title: 'T', instructions: [1, 2, 3] });
  assert.strictEqual(res2.success, false);
});

// ── 2. LanguageBundleSchema ─────────────────────────────────────────────────
console.log('\n--- 2. LanguageBundleSchema Tests ---');

check('LanguageBundle: defaults applied for language & files', () => {
  const res = LanguageBundleSchema.safeParse({});
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.language, 'js');
  assert.deepStrictEqual(res.data.files, {});
});

check('LanguageBundle: full valid config with ts and custom files', () => {
  const res = LanguageBundleSchema.safeParse({
    language: 'ts',
    files: { 'index.ts': 'console.log(42);' },
    starterFiles: { 'index.ts': '// starter' },
    solutionFiles: { 'index.ts': '// solution' },
    entry: 'index.ts',
    testEntry: 'test.ts'
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.language, 'ts');
  assert.strictEqual(res.data.files['index.ts'], 'console.log(42);');
});

check('LanguageBundle: invalid language enum rejected', () => {
  const res = LanguageBundleSchema.safeParse({
    language: 'python'
  });
  assert.strictEqual(res.success, false);
  assert.ok(res.error.issues.some((i) => i.path.includes('language')));
});

check('LanguageBundle: files must be record of strings', () => {
  const res = LanguageBundleSchema.safeParse({
    files: { 'index.ts': 123 }
  });
  assert.strictEqual(res.success, false);
});

// ── 3. GuidedLabExtensionOptionsSchema ──────────────────────────────────────
console.log('\n--- 3. GuidedLabExtensionOptionsSchema Tests ---');

check('GuidedLabExtensionOptions: default values', () => {
  const res = GuidedLabExtensionOptionsSchema.safeParse({});
  assert.strictEqual(res.success, true);
  assert.deepStrictEqual(res.data.steps, []);
  assert.strictEqual(res.data.stepIndex, 0);
  assert.strictEqual(res.data.mode, 'guided');
});

check('GuidedLabExtensionOptions: negative stepIndex rejected (nonnegative boundary)', () => {
  const res = GuidedLabExtensionOptionsSchema.safeParse({
    stepIndex: -1
  });
  assert.strictEqual(res.success, false);
  assert.ok(res.error.issues.some((i) => i.path.includes('stepIndex')));
});

check('GuidedLabExtensionOptions: float stepIndex rejected (int boundary)', () => {
  const res = GuidedLabExtensionOptionsSchema.safeParse({
    stepIndex: 1.5
  });
  assert.strictEqual(res.success, false);
});

check('GuidedLabExtensionOptions: invalid mode enum rejected', () => {
  const res = GuidedLabExtensionOptionsSchema.safeParse({
    mode: 'freestyle'
  });
  assert.strictEqual(res.success, false);
});

check('GuidedLabExtensionOptions: accepts onStepComplete & onLabComplete functions', () => {
  const res = GuidedLabExtensionOptionsSchema.safeParse({
    onStepComplete: (step, idx) => {},
    onLabComplete: (labId) => {}
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(typeof res.data.onStepComplete, 'function');
  assert.strictEqual(typeof res.data.onLabComplete, 'function');
});

check('GuidedLabExtensionOptions: rejects non-function for callbacks', () => {
  const res = GuidedLabExtensionOptionsSchema.safeParse({
    onStepComplete: 'not-a-function'
  });
  assert.strictEqual(res.success, false);
});

// ── 4. CloneProgress & GitHubCloneOptionsSchema ──────────────────────────────
console.log('\n--- 4. GitHubCloneOptionsSchema Tests ---');

check('CloneProgressPhase: all 6 valid phases accepted', () => {
  const phases = ['connecting', 'metadata', 'downloading', 'mounting', 'ready', 'error'];
  for (const phase of phases) {
    const res = CloneProgressPhaseSchema.safeParse(phase);
    assert.strictEqual(res.success, true);
  }
  const invalid = CloneProgressPhaseSchema.safeParse('finished');
  assert.strictEqual(invalid.success, false);
});

check('CloneProgressEvent: requires phase and message', () => {
  const valid = CloneProgressEventSchema.safeParse({
    phase: 'downloading',
    message: 'Downloading file 3/10',
    loaded: 3,
    total: 10
  });
  assert.strictEqual(valid.success, true);
  assert.strictEqual(valid.data.loaded, 3);

  const missingMsg = CloneProgressEventSchema.safeParse({ phase: 'downloading' });
  assert.strictEqual(missingMsg.success, false);

  const missingPhase = CloneProgressEventSchema.safeParse({ message: 'hi' });
  assert.strictEqual(missingPhase.success, false);
});

check('GitHubCloneOptions: defaults applied correctly', () => {
  const res = GitHubCloneOptionsSchema.safeParse({});
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.intoRoot, true);
  assert.strictEqual(res.data.targetDir, '/workspace');
  assert.strictEqual(res.data.maxFiles, 2000);
  assert.strictEqual(res.data.concurrency, 8);
  assert.strictEqual(res.data.clearExisting, false);
});

check('GitHubCloneOptions: depth boundary values (positive int)', () => {
  const valid = GitHubCloneOptionsSchema.safeParse({ depth: 1 });
  assert.strictEqual(valid.success, true);

  const zeroDepth = GitHubCloneOptionsSchema.safeParse({ depth: 0 });
  assert.strictEqual(zeroDepth.success, false);

  const negDepth = GitHubCloneOptionsSchema.safeParse({ depth: -1 });
  assert.strictEqual(negDepth.success, false);

  const floatDepth = GitHubCloneOptionsSchema.safeParse({ depth: 2.5 });
  assert.strictEqual(floatDepth.success, false);
});

check('GitHubCloneOptions: maxFiles and concurrency positive boundaries', () => {
  const zeroFiles = GitHubCloneOptionsSchema.safeParse({ maxFiles: 0 });
  assert.strictEqual(zeroFiles.success, false);

  const zeroConcurrency = GitHubCloneOptionsSchema.safeParse({ concurrency: 0 });
  assert.strictEqual(zeroConcurrency.success, false);
});

// ── 5. RuntimeExecuteOptionsSchema ──────────────────────────────────────────
console.log('\n--- 5. RuntimeExecuteOptionsSchema Tests ---');

check('RuntimeExecuteOptions: defaults applied', () => {
  const res = RuntimeExecuteOptionsSchema.safeParse({});
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.mode, 'run');
  assert.strictEqual(res.data.timeoutMs, 30000);
  assert.strictEqual(res.data.maxOutputBytes, 262144);
  assert.strictEqual(res.data.maxConsoleCalls, 5000);
});

check('RuntimeExecuteOptions: testFilter string, array, null unions', () => {
  const s = RuntimeExecuteOptionsSchema.safeParse({ testFilter: 'test 1' });
  assert.strictEqual(s.success, true);
  assert.strictEqual(s.data.testFilter, 'test 1');

  const arr = RuntimeExecuteOptionsSchema.safeParse({ testFilter: ['t1', 't2'] });
  assert.strictEqual(arr.success, true);
  assert.deepStrictEqual(arr.data.testFilter, ['t1', 't2']);

  const nul = RuntimeExecuteOptionsSchema.safeParse({ testFilter: null });
  assert.strictEqual(nul.success, true);
  assert.strictEqual(nul.data.testFilter, null);

  const bad = RuntimeExecuteOptionsSchema.safeParse({ testFilter: 123 });
  assert.strictEqual(bad.success, false);
});

check('RuntimeExecuteOptions: timeoutMs and maxOutputBytes positive numbers', () => {
  const zeroTimeout = RuntimeExecuteOptionsSchema.safeParse({ timeoutMs: 0 });
  assert.strictEqual(zeroTimeout.success, false);

  const negOutput = RuntimeExecuteOptionsSchema.safeParse({ maxOutputBytes: -5 });
  assert.strictEqual(negOutput.success, false);
});

check('RuntimeExecuteOptions: argv accepts array of strings or null', () => {
  const valid = RuntimeExecuteOptionsSchema.safeParse({ argv: ['--flag', 'val'] });
  assert.strictEqual(valid.success, true);

  const validNull = RuntimeExecuteOptionsSchema.safeParse({ argv: null });
  assert.strictEqual(validNull.success, true);

  const invalid = RuntimeExecuteOptionsSchema.safeParse({ argv: 'flag' });
  assert.strictEqual(invalid.success, false);
});

// ── 6. WorkspaceSnapshotSchema ──────────────────────────────────────────────
console.log('\n--- 6. WorkspaceSnapshotSchema Tests ---');

check('WorkspaceSnapshot: requires files record', () => {
  const valid = WorkspaceSnapshotSchema.safeParse({
    files: { 'index.js': 'console.log(1);' }
  });
  assert.strictEqual(valid.success, true);
  assert.strictEqual(valid.data.version, 1);
  assert.deepStrictEqual(valid.data.openTabs, []);

  const missingFiles = WorkspaceSnapshotSchema.safeParse({});
  assert.strictEqual(missingFiles.success, false);
  assert.ok(missingFiles.error.issues.some((i) => i.path.includes('files')));
});

check('WorkspaceSnapshot: activeFile can be string or null', () => {
  const s = WorkspaceSnapshotSchema.safeParse({
    files: {},
    activeFile: 'demo.js'
  });
  assert.strictEqual(s.success, true);

  const n = WorkspaceSnapshotSchema.safeParse({
    files: {},
    activeFile: null
  });
  assert.strictEqual(n.success, true);

  const bad = WorkspaceSnapshotSchema.safeParse({
    files: {},
    activeFile: 123
  });
  assert.strictEqual(bad.success, false);
});

// ── 7. WorkbenchOptionsSchema ───────────────────────────────────────────────
console.log('\n--- 7. WorkbenchOptionsSchema Tests ---');

check('WorkbenchOptions: defaults applied correctly', () => {
  const res = WorkbenchOptionsSchema.safeParse({});
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.title, 'code-lab');
  assert.strictEqual(res.data.theme, 'auto');
  assert.strictEqual(res.data.persistState, true);
  assert.strictEqual(res.data.entry, 'demo.js');
  assert.strictEqual(res.data.testEntry, 'test.js');
  assert.strictEqual(res.data.backLabel, 'Back');
  assert.deepStrictEqual(res.data.files, {});
});

check('WorkbenchOptions: theme enum validation', () => {
  for (const t of ['dark', 'light', 'auto']) {
    const res = WorkbenchOptionsSchema.safeParse({ theme: t });
    assert.strictEqual(res.success, true);
  }
  const invalidTheme = WorkbenchOptionsSchema.safeParse({ theme: 'solarized' });
  assert.strictEqual(invalidTheme.success, false);
});

check('WorkbenchOptions: backward compatible steps & starterFiles', () => {
  const res = WorkbenchOptionsSchema.safeParse({
    steps: [
      { id: 's1', title: 'Step 1', instructions: 'Do it' }
    ],
    starterFiles: { 'starter.js': '// code' },
    tsFiles: { 'main.ts': '// ts' }
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.steps.length, 1);
});

// ── 8. Automated Mutation Fuzzer (600 iterations) ───────────────────────────
console.log('\n--- 8. Automated Mutation Fuzzer (600 Iterations) ---');

const primitives = [
  null, undefined, '', '   ', 'a'.repeat(5000), 0, -1, 1, 3.14159, -999999,
  true, false, [], [1, 2, 'three'], {}, { a: 1 }, { __proto__: { evil: true } },
  () => {}, NaN, Infinity, -Infinity
];

function getRandomPrimitive() {
  return primitives[Math.floor(Math.random() * primitives.length)];
}

let fuzzedCount = 0;
let fuzzedErrorsCaught = 0;

check('Fuzzing all schemas with random type mutations never throws unhandled exception', () => {
  const allSchemas = [
    { name: 'GuidedStepSchema', schema: GuidedStepSchema },
    { name: 'LanguageBundleSchema', schema: LanguageBundleSchema },
    { name: 'GuidedLabExtensionOptionsSchema', schema: GuidedLabExtensionOptionsSchema },
    { name: 'CloneProgressEventSchema', schema: CloneProgressEventSchema },
    { name: 'GitHubCloneOptionsSchema', schema: GitHubCloneOptionsSchema },
    { name: 'RuntimeExecuteOptionsSchema', schema: RuntimeExecuteOptionsSchema },
    { name: 'WorkspaceSnapshotSchema', schema: WorkspaceSnapshotSchema },
    { name: 'WorkbenchOptionsSchema', schema: WorkbenchOptionsSchema }
  ];

  for (let iter = 0; iter < 600; iter++) {
    const { schema } = allSchemas[iter % allSchemas.length];
    
    // Generate chaotic payload
    const payload = {};
    const keys = ['id', 'title', 'instructions', 'mode', 'theme', 'language', 'files', 'steps', 'timeoutMs', 'depth', 'phase', 'message', 'activeFile', 'argv'];
    const numKeys = Math.floor(Math.random() * 6) + 1;
    for (let k = 0; k < numKeys; k++) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      payload[key] = getRandomPrimitive();
    }

    try {
      const res = schema.safeParse(payload);
      fuzzedCount++;
      if (!res.success) {
        fuzzedErrorsCaught++;
        // Verify error is valid ZodError
        assert.ok(Array.isArray(res.error.issues));
        assert.ok(res.error.issues.length > 0);
      }
    } catch (unexpected) {
      assert.fail(`Schema threw unhandled exception on fuzz input: ${unexpected.message}`);
    }
  }

  console.log(`    Ran ${fuzzedCount} fuzz permutations; cleanly caught ${fuzzedErrorsCaught} validation rejections.`);
  assert.strictEqual(fuzzedCount, 600);
});

console.log('\n======================================================================');
console.log(`  FUZZ RESULTS: ${passedAsserts}/${totalAsserts} passed cleanly`);
console.log('======================================================================\n');
