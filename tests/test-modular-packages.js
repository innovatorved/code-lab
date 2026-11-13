#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Phase 2/3/4 — Modular Workspace Packages & Kernel Integration Suite
 *
 * Exercises all shipped `@code-lab/*` packages via `dist/code-lab.js`:
 *   - @code-lab/core: ServiceContainer (singleton/transient/child/cycle/dispose),
 *     DisposableStore, Emitter + setGlobalEventMonitor, CodeLabError, Logger, PosixPath
 *   - @code-lab/fs: FileSystemService (MemoryBackend, IndexedDbBackend, OpfsBackend),
 *     binary Uint8Array round-trip, watchers, recursive delete, rename
 *   - @code-lab/settings: parseJsonc (comments, trailing commas, line/col errors),
 *     validateJsonSchema, 4-layer ConfigurationService (default < user < workspace < override,
 *     invalid setting fallback + SettingDiagnostic, profile export/import, URL param round-trip),
 *     parseTasksConfig, parseExtensionsConfig
 *   - @code-lab/commands: ContextKeyService (`when` parser), CommandRegistry,
 *     KeybindingService (`Mod+` chords, `-command` unbinding, `when` precedence)
 *   - @code-lab/ui: ThemeService (dark/light/high-contrast + custom JSON theme),
 *     PluginRegistry (declarative contributions, lazy activationEvents, full dispose),
 *     SettingsDialogController (`<dialog closedby="any">`, search, category filter),
 *     WorkbenchErrorBoundary (`role="alert"`), rankWorkspaceFiles fuzzy scorer
 *   - @code-lab/web: createCodeLabKernel full lifecycle & observability event log
 *   - tools/check-boundaries.js: negative tests proving cross-layer, DOM-in-core,
 *     deep-import, and circular-dependency violations are caught
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { doc } = require('./helpers/mock-dom.js');
const loader = require('./helpers/load.js');
const { checkBoundaries, PACKAGE_LAYERS } = require('../tools/check-boundaries.js');

const Modular = loader.modular;

let passed = 0;
const failures = [];

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err && err.stack ? err.stack : err}`);
  }
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Modular Architecture Suite (@code-lab/* Workspaces & Kernel)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  await runTest('[M1] DI ServiceContainer resolves singletons, instances, child scopes, and detects cycles', () => {
    const { ServiceContainer, createServiceId, isCodeLabError } = Modular;
    const IAlpha = createServiceId('test.alpha');
    const IBeta = createServiceId('test.beta');
    const IEnv = createServiceId('test.env');

    const root = new ServiceContainer();
    let disposedAlpha = 0;

    root.registerSingleton(IAlpha, () => ({
      tag: 'alpha-v1',
      dispose() {
        disposedAlpha++;
      }
    }));
    root.registerSingleton(IBeta, (c) => ({
      alphaTag: c.get(IAlpha).tag
    }));
    root.registerInstance(IEnv, { mode: 'production' });

    const a1 = root.get(IAlpha);
    const a2 = root.get(IAlpha);
    assert.equal(a1, a2, 'singleton must return identical instance');
    assert.equal(root.get(IBeta).alphaTag, 'alpha-v1');
    assert.equal(root.get(IEnv).mode, 'production');
    assert.equal(root.tryGet(createServiceId('missing.svc')), undefined);

    const child = root.createChild();
    assert.equal(child.get(IAlpha), a1, 'child inherits parent singleton');
    const IChildOnly = createServiceId('test.childOnly');
    child.registerInstance(IChildOnly, { ok: true });
    assert.equal(child.has(IChildOnly), true);
    assert.equal(root.has(IChildOnly), false);

    // Circular dependency detection: X -> Y -> X
    const cycleContainer = new ServiceContainer();
    const IX = createServiceId('cycle.X');
    const IY = createServiceId('cycle.Y');
    cycleContainer.registerSingleton(IX, (c) => ({ y: c.get(IY) }));
    cycleContainer.registerSingleton(IY, (c) => ({ x: c.get(IX) }));
    assert.throws(
      () => cycleContainer.get(IX),
      (err) => isCodeLabError(err) && err.message.includes('cycle.X') && err.message.includes('cycle.Y')
    );

    root.dispose();
    assert.equal(disposedAlpha, 1, 'disposing container must dispose singleton instances');
  });

  await runTest('[M2] DisposableStore, MutableDisposable, Emitter, and setGlobalEventMonitor leave zero leaks', () => {
    const { DisposableStore, MutableDisposable, Emitter, setGlobalEventMonitor, toDisposable } = Modular;
    const traces = [];
    const monitorDisp = setGlobalEventMonitor((rec) => traces.push(rec));

    const store = new DisposableStore();
    let cleaned = 0;
    store.add(toDisposable(() => { cleaned++; }));

    const mut = store.add(new MutableDisposable());
    let firstMutDisposed = false;
    mut.value = toDisposable(() => { firstMutDisposed = true; });
    mut.value = toDisposable(() => { cleaned += 10; });
    assert.equal(firstMutDisposed, true, 'reassigning MutableDisposable disposes previous value');

    const emitter = store.add(new Emitter({ name: 'test.ping' }));
    const received = [];
    const sub = emitter.event((payload) => received.push(payload));
    emitter.fire('hello');
    assert.deepEqual(received, ['hello']);
    assert.ok(traces.some((t) => t.channel === 'test.ping'), 'global monitor captures emitted events');

    sub.dispose();
    emitter.fire('after-sub-dispose');
    assert.deepEqual(received, ['hello'], 'disposed subscription must not fire');

    store.dispose();
    monitorDisp.dispose();
    assert.equal(cleaned, 11, 'all registered disposables cleaned up');
  });

  await runTest('[M3] FileSystemService supports text, binary Uint8Array, watchers, rename, and pluggable backends', async () => {
    const { FileSystemService, MemoryBackend, IndexedDbBackend, OpfsBackend } = Modular;
    const mem = new MemoryBackend({ '/workspace/readme.md': '# Hello' });
    const vfs = new FileSystemService(mem);
    await vfs.hydrate();

    assert.equal(vfs.exists('readme.md'), true);
    assert.equal(vfs.readFile('/workspace/readme.md'), '# Hello');

    const events = [];
    const sub = vfs.onDidChangeFile((ev) => events.push(`${ev.type}:${ev.path}`));

    const rawBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    vfs.writeFile('/workspace/bin/mod.wasm', rawBytes);
    assert.deepEqual(Array.from(vfs.readFileBytes('bin/mod.wasm')), Array.from(rawBytes));
    assert.equal(vfs.stat('bin/mod.wasm').size, 8);

    vfs.rename('bin/mod.wasm', 'bin/app.wasm');
    assert.equal(vfs.exists('bin/mod.wasm'), false);
    assert.equal(vfs.exists('bin/app.wasm'), true);

    vfs.deleteFile('/workspace/bin', { recursive: true });
    assert.equal(vfs.exists('bin/app.wasm'), false);
    assert.ok(events.includes('created:/workspace/bin/mod.wasm'));

    // IndexedDbBackend and OpfsBackend gracefully degrade when browser storage APIs are absent in Node
    const idb = new IndexedDbBackend('test-ns');
    await idb.writeEntry('/workspace/a.txt', new Uint8Array([65]));
    const idbLoaded = await idb.loadAll();
    assert.ok(idbLoaded instanceof Map);

    const opfs = new OpfsBackend('test-ns');
    await opfs.writeEntry('/workspace/b.txt', new Uint8Array([66]));
    const opfsLoaded = await opfs.loadAll();
    assert.ok(opfsLoaded instanceof Map);

    sub.dispose();
    vfs.dispose();
  });

  await runTest('[M4] JSONC parser, 4-layer ConfigurationService cascade, schema diagnostics, and URL/profile sync', () => {
    const { parseJsonc, ConfigurationService, parseTasksConfig, parseExtensionsConfig } = Modular;

    const parsed = parseJsonc(`{
      // Single-line comment with "//not-a-comment" inside string
      "editor.fontSize": 16, /* block comment */
      "url": "https://example.com/path",
      "arr": [1, 2, 3,],
    }`);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.value['editor.fontSize'], 16);
    assert.equal(parsed.value.url, 'https://example.com/path');
    assert.deepEqual(parsed.value.arr, [1, 2, 3]);

    const broken = parseJsonc('{\n  "editor.fontSize": \n}');
    assert.ok(broken.errors.length > 0 && broken.errors[0].line >= 2);

    // 4-layer cascade: default < user < workspace < override
    const cfg = new ConfigurationService(true);
    const defaultSize = cfg.get('editor.fontSize');
    assert.equal(typeof defaultSize, 'number');

    cfg.setUserSetting('editor.fontSize', 15);
    assert.equal(cfg.get('editor.fontSize'), 15);
    assert.equal(cfg.inspect('editor.fontSize').effectiveSource, 'user');

    const diagsValid = cfg.loadWorkspaceSettingsJson(`{
      // Workspace override
      "editor.fontSize": 18,
      "editor.tabSize": 4,
    }`);
    assert.equal(diagsValid.length, 0);
    assert.equal(cfg.get('editor.fontSize'), 18);
    assert.equal(cfg.inspect('editor.fontSize').effectiveSource, 'workspace');

    cfg.setOverrides({ 'editor.fontSize': 20 });
    assert.equal(cfg.get('editor.fontSize'), 20);
    assert.equal(cfg.inspect('editor.fontSize').effectiveSource, 'override');

    cfg.setOverrides({});
    assert.equal(cfg.get('editor.fontSize'), 18);

    // Invalid workspace setting produces diagnostic & falls back safely to user value (15)
    const diagsInvalid = cfg.loadWorkspaceSettingsJson(`{
      "editor.fontSize": "not-a-number"
    }`);
    assert.ok(diagsInvalid.length > 0, 'invalid type must emit SettingDiagnostic');
    assert.equal(cfg.get('editor.fontSize'), 15, 'invalid workspace value must fall back to user scope');

    // Profile export/import & URL query parameter round-trip
    const exported = cfg.exportProfile();
    const cfg2 = new ConfigurationService(true);
    assert.equal(cfg2.importProfile(exported).length, 0);
    assert.equal(cfg2.get('editor.fontSize'), 15);

    const encodedUrl = cfg.toUrlParam();
    const cfg3 = new ConfigurationService(true);
    assert.equal(cfg3.applyUrlParam(encodedUrl).length, 0);
    assert.equal(cfg3.get('editor.fontSize'), 15);

    // Tasks & Extensions workspace configs
    const tasksRes = parseTasksConfig(`{
      "version": "2.0.0",
      "tasks": [
        { "id": "test", "label": "Run Unit Tests", "command": "bun test", "group": "test", "runOn": "folderOpen" }
      ]
    }`);
    assert.equal(tasksRes.diagnostics.length, 0);
    assert.equal(tasksRes.tasks.length, 1);
    assert.equal(tasksRes.tasks[0].runOn, 'folderOpen');

    const extRes = parseExtensionsConfig(`{
      "recommendations": ["acme.sql-linter"],
      "autoActivate": ["acme.sql-linter"]
    }`);
    assert.equal(extRes.diagnostics.length, 0);
    assert.deepEqual(extRes.config.recommendations, ['acme.sql-linter']);

    cfg.dispose();
    cfg2.dispose();
    cfg3.dispose();
  });

  await runTest('[M5] ContextKeyService ("when" expressions), CommandRegistry, and KeybindingService (-command unbind)', async () => {
    const { ContextKeyService, CommandRegistry, KeybindingService } = Modular;
    const ctx = new ContextKeyService();
    ctx.setContext('editorFocus', true);
    ctx.setContext('resourceLangId', 'sql');
    ctx.setContext('readOnly', false);

    assert.equal(ctx.evaluateWhen("editorFocus && resourceLangId == 'sql' && !readOnly"), true);
    assert.equal(ctx.evaluateWhen("editorFocus && resourceLangId == 'python'"), false);
    assert.equal(ctx.evaluateWhen("(resourceLangId == 'ts' || resourceLangId == 'sql') && editorFocus"), true);

    const commands = new CommandRegistry();
    let ranArgs = null;
    commands.registerCommand({
      id: 'sql.runSelection',
      title: 'Run Selected SQL',
      when: "resourceLangId == 'sql'",
      handler: (arg) => {
        ranArgs = arg;
        return 'executed';
      }
    });
    assert.equal(await commands.executeCommand('sql.runSelection', { limit: 10 }), 'executed');
    assert.deepEqual(ranArgs, { limit: 10 });

    const kb = new KeybindingService(ctx);
    kb.registerKeybinding({ key: 'Mod+Enter', command: 'workbench.runCode' });
    kb.registerKeybinding({
      key: 'Mod+Enter',
      command: 'sql.runSelection',
      when: "editorFocus && resourceLangId == 'sql'"
    });

    // Contextual SQL rule overrides generic Mod+Enter when SQL editor is focused
    const resolvedSql = kb.resolve({ key: 'Enter', metaKey: true });
    assert.equal(resolvedSql && resolvedSql.command, 'sql.runSelection');

    // User keybindings can unbind via `-command`
    kb.setUserKeybindings([{ key: 'Mod+Enter', command: '-sql.runSelection' }]);
    const afterUnbind = kb.resolve({ key: 'Enter', ctrlKey: true });
    assert.equal(afterUnbind && afterUnbind.command, 'workbench.runCode');

    kb.dispose();
    commands.dispose();
    ctx.dispose();
  });

  await runTest('[M6] ThemeService, PluginRegistry (lazy activation + dispose), SettingsDialog, ErrorBoundary, and Fuzzy Quick Open', async () => {
    const {
      createCodeLabKernel,
      parseCustomTheme,
      SettingsDialogController,
      WorkbenchErrorBoundary,
      rankWorkspaceFiles
    } = Modular;

    const kernel = createCodeLabKernel({
      instanceId: 'modular-ui-test',
      initialFiles: {
        'src/index.ts': 'export const x = 1;',
        'src/db/queries.sql': 'SELECT 1;',
        'node_modules/pkg/index.js': 'module.exports = {};'
      }
    });

    // ThemeService: built-ins + custom JSON theme
    assert.equal(kernel.themes.setTheme('light').kind, 'light');
    assert.equal(kernel.themes.setTheme('high-contrast').kind, 'high-contrast');
    const customTheme = parseCustomTheme(
      JSON.stringify({
        id: 'solar-ink',
        label: 'Solar Ink',
        kind: 'dark',
        tokens: { '--cl-bg': '#002b36', '--cl-accent': '#2aa198' }
      })
    );
    assert.ok(customTheme);
    kernel.themes.registerTheme(customTheme);
    assert.equal(kernel.themes.setTheme('solar-ink').id, 'solar-ink');

    // PluginRegistry: declarative contribution BEFORE activation, then lazy activation on event
    let activatedCount = 0;
    let deactivatedCount = 0;
    const pluginDisp = kernel.plugins.registerPlugin({
      id: 'test.lazy-sql-helper',
      name: 'Lazy SQL Helper',
      version: '0.1.0',
      activationEvents: ['onLanguage:sql'],
      contributes: {
        settings: [
          {
            key: 'lazySql.maxRows',
            title: 'Max Rows',
            description: 'Maximum rows fetched',
            category: 'SQL',
            defaultValue: 250,
            schema: { type: 'number', minimum: 1, maximum: 5000 }
          }
        ],
        commands: [
          {
            id: 'lazySql.ping',
            title: 'Ping SQL Helper',
            handler: () => 'pong'
          }
        ]
      },
      activate(ctx) {
        activatedCount++;
        ctx.logger.info('Lazy SQL helper activated');
      },
      deactivate() {
        deactivatedCount++;
      }
    });

    assert.equal(activatedCount, 0, 'lazy plugin must not run activate() on registration');
    assert.equal(kernel.configuration.get('lazySql.maxRows'), 250, 'contributed setting available immediately');

    await kernel.plugins.fireActivationEvent('onLanguage:sql');
    assert.equal(activatedCount, 1, 'plugin activates when matching activationEvent fires');
    assert.equal(await kernel.commands.executeCommand('lazySql.ping'), 'pong');

    pluginDisp.dispose();
    assert.equal(deactivatedCount, 1, 'disposing plugin registration calls deactivate()');
    assert.equal(kernel.commands.hasCommand('lazySql.ping'), false, 'contributed command removed on dispose');

    // SettingsDialogController + WorkbenchErrorBoundary
    const host = doc.createElement('div');
    doc.body.appendChild(host);
    const dialogCtrl = new SettingsDialogController(host, {
      configuration: kernel.configuration
    });
    dialogCtrl.open();
    const dialogEl = host.querySelector('dialog.cl-settings-dialog');
    assert.ok(dialogEl, 'SettingsDialogController mounts native <dialog>');
    assert.equal(dialogEl.getAttribute('closedby'), 'any');
    dialogCtrl.close();
    dialogCtrl.dispose();

    const boundary = new WorkbenchErrorBoundary(host, kernel.logger);
    boundary.capture(new Error('Synthetic panel failure'), 'UnitTest');
    const alertEl = host.querySelector('[role="alert"]');
    assert.ok(alertEl && alertEl.textContent.includes('Synthetic panel failure'));

    // Fuzzy Quick Open file ranking with exclude patterns
    const ranked = rankWorkspaceFiles(
      ['src/index.ts', 'src/components/SqlResultTable.tsx', 'node_modules/pkg/index.js'],
      'sqlres',
      ['**/node_modules/**']
    );
    assert.deepEqual(ranked, ['src/components/SqlResultTable.tsx']);

    assert.ok(kernel.getRecentEvents().length > 0, 'kernel records event bus traces');
    kernel.dispose();
  });

  await runTest('[M7] Architecture boundary enforcer verifies live repo and rejects cross-layer, DOM-in-core, deep-import, and cycle violations', () => {
    const liveCheck = checkBoundaries(loader.ROOT);
    assert.equal(liveCheck.ok, true, `Live repo boundary violations: ${liveCheck.violations.join('; ')}`);
    assert.equal(liveCheck.packageCount, 11);

    // Build a synthetic mini-workspace in tmpdir with deliberate violations
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-boundary-test-'));
    try {
      for (const meta of Object.values(PACKAGE_LAYERS)) {
        const srcDir = path.join(tmpRoot, meta.dir, 'src');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const ok = 1;\n');
      }
      // 1. Layer 0 (@code-lab/core) illegally imports Layer 3 (@code-lab/ui) AND touches `window`
      fs.writeFileSync(
        path.join(tmpRoot, 'packages/core/src/index.ts'),
        `import { ok } from '@code-lab/ui';\nexport const href = window.location.href;\nexport { ok };\n`
      );
      // 2. Layer 1 (@code-lab/fs) uses forbidden deep package import + local cycle
      fs.writeFileSync(
        path.join(tmpRoot, 'packages/fs/src/index.ts'),
        `import { ok } from '@code-lab/core/src/internal';\nimport { b } from './b';\nexport const a = b + Number(ok);\n`
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'packages/fs/src/b.ts'),
        `import { a } from './index';\nexport const b = a + 1;\n`
      );

      const badRes = checkBoundaries(tmpRoot);
      assert.equal(badRes.ok, false, 'checkBoundaries must fail on synthetic violations');
      const joined = badRes.violations.join('\n');
      assert.match(joined, /\[layer-violation\]/);
      assert.match(joined, /\[no-dom-in-core\]/);
      assert.match(joined, /\[no-deep-package-import\]/);
      assert.match(joined, /\[circular-dependency\]/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  console.log('\n' + '─'.repeat(78));
  if (failures.length > 0) {
    console.error(`Modular Architecture Suite FAILED: ${passed} passed, ${failures.length} failed`);
    process.exit(1);
  }
  console.log(`Modular Architecture Suite PASSED: ${passed}/${passed} assertions green`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
