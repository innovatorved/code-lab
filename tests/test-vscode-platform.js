#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 1 Platform Services Verification Suite (tests/test-vscode-platform.js)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Exercises all M1 contracts and bug fixes end-to-end against built artifacts:
 *   - D1: Settings Schemas (colorTheme, panel.defaultTab, sql.defaultDialect),
 *         getWorkspaceSettings, resetScopedSetting, resetAllSettings
 *   - D2: ThemeService WCAG 2.1 AA contrast tokens + pickContrastingFg +
 *         SettingsDialogController (modal + inline, scopes, B-21 snap-back fix,
 *         mock-dom checkbox safety, Open Settings JSON, Reset / Reset All)
 *   - D3: WorkspaceStorage multi-workspace registry & isolation helpers
 *   - D4: DiagnosticsStore.setFileDiagnostics (B-16 dual arg order, path norm,
 *         atomic source replacement, single notify) + Python/C++ linters (B-17)
 *   - D5: PosixShell & CodeLabScm gitState initialization (B-13), Map staging
 *         unification & CLI<->GUI interleaving (B-14), and discardChanges
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { doc, DOMEvent, localStorageMock } = require('./helpers/mock-dom.js');
const { loadCodeLab, runtime, shell: shellBundle, DIST } = require('./helpers/load.js');
const {
  getStorageEngine,
  getDiagnosticsStore,
  getScmEngine
} = require('./helpers/modules.js');

const CodeLab = loadCodeLab();
const Modular = CodeLab.CodeLabModular || globalThis.CodeLabModular;
assert.ok(Modular, 'CodeLabModular must be exported on built SDK');

let passed = 0;
let failed = 0;
const failures = [];

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.error(`  \x1b[31m✗\x1b[0m ${name}`);
    console.error(`    ${err && err.stack ? err.stack : err}`);
  }
}

function parseHexToLinearLuminance(hex) {
  const clean = String(hex).trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean.slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function wcagContrastRatio(hexA, hexB) {
  const l1 = parseHexToLinearLuminance(hexA);
  const l2 = parseHexToLinearLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Milestone 1: Platform Services Verification Suite');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ── Deliverable 1: Settings Schema & Scoped Precedence ─────────────────────
  console.log('── Deliverable 1: @code-lab/settings Schemas & Scoped Reset ──');

  await runTest('[D1.1] BUILTIN_SETTINGS defines exact enums and defaults for colorTheme, panel.defaultTab, and sql.defaultDialect', () => {
    const { BUILTIN_SETTINGS, ConfigurationService } = Modular;
    const byKey = new Map(BUILTIN_SETTINGS.map((d) => [d.key, d]));

    const colorTheme = byKey.get('workbench.colorTheme');
    assert.ok(colorTheme, 'workbench.colorTheme descriptor exists');
    assert.equal(colorTheme.defaultValue, 'dark');
    assert.equal(colorTheme.schema.type, 'string');
    assert.deepEqual(colorTheme.schema.enum, ['dark', 'light', 'high-contrast']);

    const defaultTab = byKey.get('workbench.panel.defaultTab');
    assert.ok(defaultTab, 'workbench.panel.defaultTab descriptor exists');
    assert.equal(defaultTab.defaultValue, 'terminal');
    assert.equal(defaultTab.schema.type, 'string');
    assert.deepEqual(defaultTab.schema.enum, [
      'terminal',
      'problems',
      'tests',
      'stdin',
      'ports',
      'preview',
      'network',
      'inspector',
      'observability',
      'sql-results'
    ]);

    const sqlDialect = byKey.get('sql.defaultDialect');
    assert.ok(sqlDialect, 'sql.defaultDialect descriptor exists');
    assert.equal(sqlDialect.defaultValue, 'postgres');
    assert.equal(sqlDialect.schema.type, 'string');
    assert.deepEqual(sqlDialect.schema.enum, ['postgres', 'sqlite']);

    const cfg = new ConfigurationService();
    assert.equal(cfg.get('workbench.panel.defaultTab'), 'terminal');
    assert.equal(cfg.setUserSetting('workbench.panel.defaultTab', 'console'), false, 'legacy console tab rejected');
    assert.equal(cfg.setUserSetting('workbench.panel.defaultTab', 'problems'), true);
    assert.equal(cfg.setUserSetting('workbench.colorTheme', 'invalid-theme'), false);
    assert.equal(cfg.setUserSetting('workbench.colorTheme', 'high-contrast'), true);
    cfg.dispose();
  });

  await runTest('[D1.2] ConfigurationService.getWorkspaceSettings, resetScopedSetting, and resetAllSettings preserve unregistered keys & emit exact sources', async () => {
    const { ConfigurationService } = Modular;
    const cfg = new ConfigurationService();
    const events = [];
    cfg.onDidChangeConfiguration((e) => {
      events.push({ source: e.source, keys: Array.from(e.affectedKeys).sort() });
    });

    const diags = cfg.loadWorkspaceSettingsJson(
      JSON.stringify({
        'editor.fontSize': 16,
        'sql.dialect': 'sqlite',
        'editor.tabSize': 4
      })
    );
    assert.equal(diags.length, 0);
    cfg.setUserSetting('editor.fontSize', 20);
    cfg.setUserSetting('editor.wordWrap', 'on');
    cfg.setOverrides({ 'terminal.fontSize': 15 });

    // Workspace snapshot preserves unregistered legacy `sql.dialect`
    const wsSnap = cfg.getWorkspaceSettings();
    assert.deepEqual(wsSnap, {
      'editor.fontSize': 16,
      'editor.tabSize': 4,
      'sql.dialect': 'sqlite'
    });
    wsSnap['editor.fontSize'] = 999;
    assert.equal(cfg.get('editor.fontSize'), 16, 'getWorkspaceSettings returns defensive copy');

    // Reset workspace scope only -> reveals userValue (20), emits source: 'workspace'
    events.length = 0;
    await cfg.resetScopedSetting('editor.fontSize', 'workspace');
    assert.equal(cfg.get('editor.fontSize'), 20);
    assert.equal(cfg.inspect('editor.fontSize').workspaceValue, undefined);
    assert.equal(events.length, 1);
    assert.equal(events[0].source, 'workspace');
    assert.deepEqual(events[0].keys, ['editor.fontSize']);

    // Repeat workspace reset when already absent -> no-op, 0 events
    await cfg.resetScopedSetting('editor.fontSize', 'workspace');
    assert.equal(events.length, 1);

    // Reset user scope only -> reveals default (13), emits source: 'user'
    await cfg.resetScopedSetting('editor.fontSize', 'user');
    assert.equal(cfg.get('editor.fontSize'), 13);
    assert.equal(events[1].source, 'user');

    // Reset 'all' scope clears user, workspace, and override for key
    cfg.setUserSetting('terminal.fontSize', 18);
    cfg.setWorkspaceSetting('terminal.fontSize', 19);
    events.length = 0;
    await cfg.resetScopedSetting('terminal.fontSize', 'all');
    assert.equal(cfg.get('terminal.fontSize'), 13);
    assert.equal(events.length, 1);
    assert.equal(events[0].source, 'user');

    // resetAllSettings('workspace') clears workspace values & diagnostics while keeping user values
    cfg.loadWorkspaceSettingsJson('{ "editor.fontSize": "bad-type", "editor.tabSize": 8 }');
    assert.ok(cfg.getDiagnostics().length > 0);
    events.length = 0;
    await cfg.resetAllSettings('workspace');
    assert.deepEqual(cfg.getWorkspaceSettings(), {});
    assert.equal(cfg.getDiagnostics().length, 0);
    assert.equal(cfg.get('editor.wordWrap'), 'on', 'user setting preserved');
    assert.equal(events[0].source, 'workspace');

    // resetAllSettings('all') clears remaining user + workspace + override values
    cfg.setWorkspaceSetting('editor.tabSize', 6);
    cfg.setOverrides({ 'editor.lineNumbers': 'relative' });
    events.length = 0;
    await cfg.resetAllSettings();
    assert.equal(cfg.get('editor.wordWrap'), 'off');
    assert.equal(cfg.get('editor.tabSize'), 2);
    assert.equal(cfg.get('editor.lineNumbers'), 'on');
    assert.equal(events[0].source, 'user');

    cfg.dispose();
  });

  // ── Deliverable 2: ThemeService Contrast & SettingsDialogController ────────
  console.log('── Deliverable 2: @code-lab/ui Theme Contrast & Inline/Modal Settings ──');

  await runTest('[D2.1] ThemeService built-in & custom themes meet WCAG 2.1 AA (>= 4.5:1) contrast on --cl-accent / --cl-accent-fg / --cl-fg-muted', () => {
    const {
      DARK_THEME,
      LIGHT_THEME,
      HIGH_CONTRAST_THEME,
      pickContrastingFg,
      parseCustomTheme,
      ThemeService
    } = Modular;

    for (const theme of [DARK_THEME, LIGHT_THEME, HIGH_CONTRAST_THEME]) {
      assert.ok(theme.colors['--cl-accent'], `${theme.id} defines --cl-accent`);
      assert.ok(theme.colors['--cl-accent-fg'], `${theme.id} defines --cl-accent-fg`);
      assert.ok(theme.colors['--cl-fg-muted'], `${theme.id} defines --cl-fg-muted`);

      const buttonContrast = wcagContrastRatio(
        theme.colors['--cl-accent'],
        theme.colors['--cl-accent-fg']
      );
      const accentSurfaceContrast = wcagContrastRatio(
        theme.colors['--cl-accent'],
        theme.colors['--cl-surface']
      );
      const mutedSurfaceContrast = wcagContrastRatio(
        theme.colors['--cl-fg-muted'],
        theme.colors['--cl-surface']
      );

      assert.ok(
        buttonContrast >= 4.5,
        `${theme.id} accent vs accent-fg contrast ${buttonContrast.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        accentSurfaceContrast >= 4.5,
        `${theme.id} accent vs surface contrast ${accentSurfaceContrast.toFixed(2)} must be >= 4.5`
      );
      assert.ok(
        mutedSurfaceContrast >= 4.5,
        `${theme.id} fg-muted vs surface contrast ${mutedSurfaceContrast.toFixed(2)} must be >= 4.5`
      );
    }

    // pickContrastingFg across spectrum & fallback
    for (const sample of ['#000000', '#0369a1', '#0284c7', '#757575', '#767676', '#0ea5e9', '#facc15', '#ffffff']) {
      const fg = pickContrastingFg(sample);
      const cr = wcagContrastRatio(sample, fg);
      assert.ok(cr >= 4.5, `pickContrastingFg(${sample}) -> ${fg} yields ${cr.toFixed(2)}:1 >= 4.5`);
    }
    assert.equal(pickContrastingFg('var(--dynamic)', '#ffffff'), '#ffffff');

    // Custom theme with bright yellow accent auto-picks black fg; dark navy accent auto-picks white fg
    const brightCustom = parseCustomTheme(
      JSON.stringify({ id: 'amber', kind: 'dark', tokens: { '--cl-accent': '#facc15' } })
    );
    assert.equal(brightCustom.colors['--cl-accent-fg'], '#000000');

    const darkCustom = parseCustomTheme(
      JSON.stringify({ id: 'navy', kind: 'light', colors: { accent: '#1e3a8a', muted: '#334155' } })
    );
    assert.equal(darkCustom.colors['--cl-accent-fg'], '#ffffff');
    assert.equal(darkCustom.colors['--cl-fg-muted'], '#334155');

    // applyToElement works on mock-dom element without style.setProperty AND with style.setProperty
    const svc = new ThemeService();
    svc.setTheme('light');
    const mockEl = doc.createElement('div');
    svc.applyToElement(mockEl);
    assert.equal(mockEl.getAttribute('data-cl-theme'), 'light');
    assert.equal(mockEl.style['--cl-accent-fg'], '#ffffff');
    assert.equal(mockEl.style['--cl-fg-muted'], '#52525b');

    const propMap = new Map();
    const browserLikeEl = doc.createElement('div');
    browserLikeEl.style = {
      setProperty(k, v) {
        propMap.set(k, v);
      }
    };
    svc.setTheme('dark');
    svc.applyToElement(browserLikeEl);
    assert.equal(propMap.get('--cl-accent'), '#f4f4f5');
    assert.equal(propMap.get('--cl-accent-fg'), '#0f0f10');
    svc.dispose();
  });

  await runTest('[D2.2] SettingsDialogController supports inline mount, re-mount cleanup, User/Workspace scopes, B-21 snap-back fix, mock-dom checkboxes, and modal open()', () => {
    const { ConfigurationService, SettingsDialogController } = Modular;
    assert.equal(typeof globalThis.HTMLInputElement, 'undefined', 'mock-dom omits HTMLInputElement');

    const cfg = new ConfigurationService();
    cfg.loadWorkspaceSettingsJson(
      JSON.stringify({
        'editor.fontSize': 14,
        'sql.dialect': 'sqlite'
      })
    );

    const mutatedSnapshots = [];
    let openJsonCount = 0;

    // 1-arg constructor + mountInline
    const inlineHost = doc.createElement('div');
    doc.body.appendChild(inlineHost);
    const ctrl = new SettingsDialogController({ configuration: cfg });
    assert.equal(ctrl.isInlineMounted, false);

    ctrl.mountInline(inlineHost, {
      scope: 'user',
      onOpenJson: () => {
        openJsonCount++;
      },
      onWorkspaceSettingsMutated: (next) => {
        mutatedSnapshots.push(next);
      }
    });
    assert.equal(ctrl.isInlineMounted, true);

    // Re-mounting onto the same container cleans up prior root & listeners (no duplicate callbacks)
    ctrl.mountInline(inlineHost, {
      scope: 'user',
      onOpenJson: () => {
        openJsonCount++;
      },
      onWorkspaceSettingsMutated: (next) => {
        mutatedSnapshots.push(next);
      }
    });
    assert.equal(inlineHost.querySelectorAll('[data-role="settings-inline-root"]').length, 1);

    // Verify User / Workspace tabs and <select> controls for enum settings
    const userTab = inlineHost.querySelector('[data-settings-scope="user"]');
    const wsTab = inlineHost.querySelector('[data-settings-scope="workspace"]');
    assert.ok(userTab && wsTab, 'Both User and Workspace scope tabs render');
    assert.equal(userTab.getAttribute('aria-selected'), 'true');
    assert.equal(wsTab.getAttribute('aria-selected'), 'false');

    const themeSelect = inlineHost.querySelector('select[data-setting-key="workbench.colorTheme"]');
    const tabSelect = inlineHost.querySelector('select[data-setting-key="workbench.panel.defaultTab"]');
    const sqlSelect = inlineHost.querySelector('select[data-setting-key="sql.defaultDialect"]');
    assert.ok(themeSelect, 'workbench.colorTheme renders as <select>');
    assert.ok(tabSelect, 'workbench.panel.defaultTab renders as <select>');
    assert.ok(sqlSelect, 'sql.defaultDialect renders as <select>');

    // Verify zero hardcoded legacy dark sky hexes or bare #fff
    const renderedHtml = inlineHost.innerHTML;
    assert.equal(renderedHtml.includes('#0284c7'), false, 'zero #0284c7');
    assert.equal(renderedHtml.includes('rgba(2,132,199'), false, 'zero rgba(2,132,199,...)');
    assert.equal(/#fff(?![0-9a-fA-F])/i.test(renderedHtml), false, 'zero bare #fff');

    // BUG B-21 FIX: Editing workspace-overridden key (`editor.fontSize`: 14) in User scope
    // updates BOTH user & workspace values so it takes immediate effect without snapping back!
    const fontInput = inlineHost.querySelector('[data-setting-key="editor.fontSize"]');
    assert.ok(fontInput);
    assert.equal(fontInput.getAttribute('value'), '14');
    fontInput.value = '18';
    fontInput.dispatchEvent(new DOMEvent('change', { bubbles: true }));

    assert.equal(cfg.get('editor.fontSize'), 18, 'effective value immediately updated to 18 (no snap-back)');
    assert.equal(cfg.inspect('editor.fontSize').userValue, 18);
    assert.equal(cfg.inspect('editor.fontSize').workspaceValue, 18);
    assert.equal(
      inlineHost.querySelector('[data-setting-key="editor.fontSize"]').getAttribute('value'),
      '18'
    );
    assert.equal(mutatedSnapshots.length, 1, 're-mounted listener fired exactly once');
    assert.deepEqual(mutatedSnapshots[0], {
      'editor.fontSize': 18,
      'sql.dialect': 'sqlite'
    });

    // Boolean checkbox toggle in mock-dom (no HTMLInputElement ReferenceError!)
    const minimapCheckbox = inlineHost.querySelector('[data-setting-key="editor.minimap.enabled"]');
    assert.ok(minimapCheckbox);
    minimapCheckbox.checked = true;
    minimapCheckbox.dispatchEvent(new DOMEvent('change', { bubbles: true }));
    assert.equal(cfg.get('editor.minimap.enabled'), true);

    // Switch to Workspace scope and edit `editor.tabSize` -> updates workspace only
    wsTab.click();
    assert.equal(
      inlineHost.querySelector('[data-settings-scope="workspace"]').getAttribute('aria-selected'),
      'true'
    );
    const tabSizeInput = inlineHost.querySelector('[data-setting-key="editor.tabSize"]');
    tabSizeInput.value = '4';
    tabSizeInput.dispatchEvent(new DOMEvent('change', { bubbles: true }));
    assert.equal(cfg.inspect('editor.tabSize').workspaceValue, 4);
    assert.equal(cfg.inspect('editor.tabSize').userValue, undefined);
    assert.equal(mutatedSnapshots.length, 2);
    assert.equal(mutatedSnapshots[1]['editor.tabSize'], 4);

    // Per-item Reset in Workspace scope clears workspace override & notifies host
    const resetTabSizeBtn = inlineHost.querySelector('[data-reset-key="editor.tabSize"]');
    assert.ok(resetTabSizeBtn);
    resetTabSizeBtn.click();
    assert.equal(cfg.inspect('editor.tabSize').workspaceValue, undefined);
    assert.equal(mutatedSnapshots.length, 3);
    assert.equal('editor.tabSize' in mutatedSnapshots[2], false);

    // Open Settings (JSON) in inline mode fires callback and keeps inline view mounted
    const openJsonBtn = inlineHost.querySelector('[data-settings-action="open-json"]');
    openJsonBtn.click();
    assert.equal(openJsonCount, 1);
    assert.equal(ctrl.isInlineMounted, true);

    // Switch back to User scope and click Reset All Settings -> clears user + workspace overrides
    inlineHost.querySelector('[data-settings-scope="user"]').click();
    inlineHost.querySelector('[data-settings-action="reset-all"]').click();
    assert.equal(cfg.get('editor.fontSize'), 13);
    assert.equal(cfg.get('editor.minimap.enabled'), false);
    assert.deepEqual(cfg.getWorkspaceSettings(), {});

    ctrl.unmountInline();
    assert.equal(ctrl.isInlineMounted, false);

    // Backwards-compatible 2-arg modal open() + close()
    const modalHost = doc.createElement('div');
    doc.body.appendChild(modalHost);
    let modalOpenJsonCount = 0;
    const modalCtrl = new SettingsDialogController(modalHost, {
      configuration: cfg,
      onOpenSettingsJson: () => {
        modalOpenJsonCount++;
      }
    });
    modalCtrl.open();
    assert.equal(modalCtrl.isOpen, true);
    const dlg = modalHost.querySelector('dialog.cl-settings-dialog');
    assert.ok(dlg);
    assert.equal(dlg.getAttribute('closedby'), 'any');
    dlg.querySelector('[data-settings-action="open-json"]').click();
    assert.equal(modalOpenJsonCount, 1);
    assert.equal(modalCtrl.isOpen, false);

    modalCtrl.dispose();
    ctrl.dispose();
    cfg.dispose();
  });

  // ── Deliverable 3: Workspace Storage Registry & Isolation ──────────────────
  console.log('── Deliverable 3: Workspace Registry & Multi-Workspace Isolation ──');

  await runTest('[D3.1] Workspace registry CRUD, collision-free createBlankWorkspaceId, corrupt JSON recovery, and hasWorkspaceData across all surfaces', async () => {
    localStorageMock.clear();
    const storageMod = getStorageEngine();
    const { WorkspaceStorage } = storageMod;
    const wsInstance = new WorkspaceStorage({ preferredBackend: 'localstorage' });

    // Verify all 4 surfaces expose identical registry helpers
    for (const surface of [
      storageMod,
      CodeLab.storage,
      WorkspaceStorage,
      wsInstance,
      globalThis.CodeLabWorkspaceStorage
    ]) {
      assert.ok(surface, 'storage surface exists');
      assert.equal(typeof surface.listWorkspaces, 'function');
      assert.equal(typeof surface.getWorkspaceMeta, 'function');
      assert.equal(typeof surface.upsertWorkspaceMeta, 'function');
      assert.equal(typeof surface.removeWorkspaceMeta, 'function');
      assert.equal(typeof surface.hasWorkspaceData, 'function');
      assert.equal(typeof surface.createBlankWorkspaceId, 'function');
    }

    // 250 synchronous blank IDs -> 0 collisions even within same millisecond
    const ids = new Set();
    for (let i = 0; i < 250; i++) {
      const id = storageMod.createBlankWorkspaceId();
      assert.ok(id.startsWith('blank-workspace-'), `valid prefix: ${id}`);
      ids.add(id);
    }
    assert.equal(ids.size, 250, 'createBlankWorkspaceId must never collide in tight loop');

    // Upsert, deduplicate, sort descending by updatedAt, get, and remove
    storageMod.upsertWorkspaceMeta({
      labId: 'ws-alpha',
      title: 'Alpha Project',
      kind: 'custom',
      updatedAt: 1000,
      fileCount: 3
    });
    storageMod.upsertWorkspaceMeta({
      labId: 'ws-repo',
      title: 'astro-demo',
      kind: 'repo',
      repo: 'withastro/astro',
      updatedAt: 3000,
      fileCount: 12
    });
    storageMod.upsertWorkspaceMeta({
      labId: 'ws-blank-1',
      title: 'Untitled Workspace',
      kind: 'blank',
      updatedAt: 2000
    });
    // Update ws-alpha with newer timestamp
    wsInstance.upsertWorkspaceMeta({
      labId: 'ws-alpha',
      title: 'Alpha Project v2',
      kind: 'custom',
      updatedAt: 5000,
      fileCount: 4
    });

    const listed = globalThis.CodeLabWorkspaceStorage.listWorkspaces();
    assert.deepEqual(
      listed.map((w) => w.labId),
      ['ws-alpha', 'ws-repo', 'ws-blank-1']
    );
    assert.equal(storageMod.getWorkspaceMeta('ws-alpha').title, 'Alpha Project v2');
    assert.equal(storageMod.getWorkspaceMeta('ws-repo').repo, 'withastro/astro');

    storageMod.removeWorkspaceMeta('ws-blank-1');
    assert.equal(storageMod.getWorkspaceMeta('ws-blank-1'), null);
    assert.equal(storageMod.listWorkspaces().length, 2);

    // Corrupted JSON in localStorage never throws and returns []
    localStorageMock.setItem(storageMod.WORKSPACE_REGISTRY_KEY, '{corrupt-json');
    assert.deepEqual(storageMod.listWorkspaces(), []);
    localStorageMock.clear();

    // hasWorkspaceData accurately distinguishes populated vs empty/metadata-only payloads
    assert.equal(storageMod.hasWorkspaceData('fresh-blank'), false);

    localStorageMock.setItem(
      'sd-codelab-v1:empty-meta',
      JSON.stringify({ openTabs: [], activeFile: null, customFiles: { 'sandbox:js': {} } })
    );
    localStorageMock.setItem(
      'sd_codelab_empty-meta',
      JSON.stringify({ mode: 'sandbox', lang: 'js', updatedAt: Date.now() })
    );
    assert.equal(storageMod.hasWorkspaceData('empty-meta'), false);

    localStorageMock.setItem(
      'sd-codelab-v1:populated-wb',
      JSON.stringify({
        customFiles: { 'sandbox:js': { 'index.js': 'console.log(42);\n' } }
      })
    );
    assert.equal(storageMod.hasWorkspaceData('populated-wb'), true);

    await wsInstance.saveProject({
      id: 'proj-empty',
      name: 'Empty',
      files: {},
      updatedAt: Date.now()
    });
    assert.equal(wsInstance.hasWorkspaceData('proj-empty'), false);

    await wsInstance.saveProject({
      id: 'proj-code',
      name: 'Populated',
      files: { 'main.py': 'print(1)\n' },
      updatedAt: Date.now()
    });
    assert.equal(wsInstance.hasWorkspaceData('proj-code'), true);
    assert.equal(storageMod.hasWorkspaceData('proj-code'), true);

    // Headless memory-only WorkspaceStorage also reports hasWorkspaceData accurately
    const memStorage = new WorkspaceStorage({ preferredBackend: 'memory' });
    await memStorage.saveProject({
      id: 'mem-only-ws',
      name: 'Memory WS',
      files: { 'a.ts': 'export const a = 1;' },
      updatedAt: Date.now()
    });
    assert.equal(memStorage.hasWorkspaceData('mem-only-ws'), true);
    assert.equal(storageMod.hasWorkspaceData('mem-only-ws'), true);
    await memStorage.deleteProject('mem-only-ws');
    assert.equal(storageMod.hasWorkspaceData('mem-only-ws'), false);
    localStorageMock.clear();
  });

  // ── Deliverable 4: DiagnosticsStore & Extension Linters (B-16 & B-17) ──────
  console.log('── Deliverable 4: Live DiagnosticsStore & Extension Linters ──');

  await runTest('[D4.1] Bug B-16: DiagnosticsStore.setFileDiagnostics supports both arg orders, normalizes paths, prevents ID collisions, and notifies once', () => {
    const { createDiagnosticsStore, normalizeDiagnosticFilePath } = getDiagnosticsStore();
    assert.equal(normalizeDiagnosticFilePath('/workspace/src/app.py'), 'src/app.py');
    assert.equal(normalizeDiagnosticFilePath('./src/app.py'), 'src/app.py');
    assert.equal(normalizeDiagnosticFilePath('/workspace/./.codelab/settings.json'), '.codelab/settings.json');
    assert.equal(normalizeDiagnosticFilePath('.codelab/tasks.json'), '.codelab/tasks.json');

    const store = createDiagnosticsStore();
    let notifyCount = 0;
    store.subscribe(() => {
      notifyCount++;
    });

    // Order 1 (PROJECT.md §3): setFileDiagnostics(file, source, diags)
    const pyInserted = store.setFileDiagnostics('/workspace/a.py', 'python-linter', [
      { id: 'py-eol-string-1', line: 3, col: 5, severity: 'error', message: 'EOL while scanning' },
      { id: 'py-indent-2', line: 6, col: 1, severity: 'warning', message: 'Bad indent' }
    ]);
    assert.equal(pyInserted.length, 2);
    assert.equal(notifyCount, 1, 'fires subscriber exactly once for batch file update');

    // Second Python file emitting the SAME raw diagnostic ID must NOT overwrite a.py!
    store.setFileDiagnostics('./b.py', 'python-linter', [
      { id: 'py-eol-string-1', line: 1, col: 2, severity: 'error', message: 'EOL in b.py' }
    ]);
    assert.equal(store.getByFile('a.py').length, 2);
    assert.equal(store.getByFile('/workspace/a.py').length, 2);
    assert.equal(store.getByFile('b.py').length, 1);

    // Order 2 (src/workbench.ts callers): setFileDiagnostics(file, diags, source)
    // Raw Monaco marker has `source: 'ts'`, which must be stored under resolved `'monaco'` source!
    store.setFileDiagnostics(
      '/workspace/a.py',
      [{ line: 1, column: 4, endLine: 1, endColumn: 9, severity: 'warning', message: 'Hint', source: 'ts' }],
      'monaco'
    );
    assert.equal(store.getByFile('a.py').length, 3, 'both python-linter and monaco sources coexist on a.py');

    // Clearing `'monaco'` on `a.py` removes ONLY monaco items on `a.py`
    const prevNotify = notifyCount;
    store.setFileDiagnostics('a.py', [], 'monaco');
    assert.equal(notifyCount, prevNotify + 1);
    assert.equal(store.getByFile('a.py').length, 2);
    assert.equal(store.getByFile('b.py').length, 1);

    // Clearing already-empty (file, source) fires 0 notifications
    store.setFileDiagnostics('a.py', 'monaco', []);
    assert.equal(notifyCount, prevNotify + 1);

    // .codelab/settings.json preserves leading dot
    store.setFileDiagnostics('.codelab/settings.json', [{ line: 2, column: 3, message: 'Bad setting' }], 'settings');
    assert.equal(store.getByFile('.codelab/settings.json').length, 1);
    assert.equal(store.getByFile('/workspace/.codelab/settings.json').length, 1);
  });

  await runTest('[D4.2] Bug B-17: Python & C++ extensions attach lint handlers before _diagnosticsStore exists and populate store synchronously once attached', () => {
    const { createDiagnosticsStore } = getDiagnosticsStore();
    const pyExtMod = require(path.join(DIST, 'extensions', 'python.js'));
    const cppExtMod = require(path.join(DIST, 'extensions', 'cpp.js'));
    assert.equal(typeof pyExtMod.pythonExtension, 'function');
    assert.equal(typeof cppExtMod.cppExtension, 'function');

    const mockWb = {
      enabledLanguages: new Set(['js']),
      files: {},
      vfs: runtime.createVirtualFs(),
      _diagnosticsStore: undefined
    };

    pyExtMod.pythonExtension(mockWb);
    cppExtMod.cppExtension(mockWb);

    assert.equal(typeof mockWb._pyLintHandler, 'function', '_pyLintHandler attached unconditionally');
    assert.equal(typeof mockWb._cppLintHandler, 'function', '_cppLintHandler attached unconditionally');

    // Invoking before _diagnosticsStore is created must be a safe no-op
    assert.doesNotThrow(() => {
      mockWb._pyLintHandler('first.py', 'msg = "unterminated\n');
      mockWb._cppLintHandler('main.cpp', 'int main() {\n  if (x = 1) return 0;\n}\n');
    });

    // Attach _diagnosticsStore later and lint multiple files synchronously
    const store = createDiagnosticsStore();
    mockWb._diagnosticsStore = store;

    mockWb._pyLintHandler('/workspace/first.py', 'msg = "unterminated\n');
    mockWb._pyLintHandler('/workspace/second.py', 'def broken(\n');
    assert.ok(store.getByFile('first.py').length >= 1, 'first.py diagnostics recorded synchronously');
    assert.ok(store.getByFile('second.py').length >= 1, 'second.py diagnostics recorded without wiping first.py');

    // Fixing first.py clears only first.py while keeping second.py intact
    mockWb._pyLintHandler('/workspace/first.py', 'msg = "valid"\nprint(msg)\n');
    assert.equal(store.getByFile('first.py').length, 0);
    assert.ok(store.getByFile('second.py').length >= 1);

    mockWb._cppLintHandler('/workspace/main.cpp', '#include <nonexistent_header_xyz.h>\nint main() { return 0; }\n');
    assert.ok(store.getByFile('main.cpp').length >= 1, 'main.cpp diagnostics recorded synchronously');
    mockWb._cppLintHandler('/workspace/main.cpp', 'int main() {\n  return 0;\n}\n');
    assert.equal(store.getByFile('main.cpp').length, 0, 'clean main.cpp clears cpp-linter diagnostics');
  });

  // ── Deliverable 5: PosixShell & CodeLabScm Unification (B-13 & B-14) ───────
  console.log('── Deliverable 5: Unified PosixShell & CodeLabScm Git Engine ──');

  await runTest('[D5.1] Bug B-13: Blank PosixShell starts uninitialized (no fake a1b2c3d, exit 128 on git status) while .git in VFS or gitInitialized:true initializes cleanly', async () => {
    const vfsBlank = runtime.createVirtualFs({ '/workspace/index.js': 'console.log(1);\n' });
    const shBlank = shellBundle.createPosixShell({ vfs: vfsBlank });

    assert.equal(shBlank.gitState.initialized, false, 'blank shell must not pretend to be a git repo');
    assert.equal(shBlank.gitState.headCommit, '');
    assert.equal(shBlank.gitState.commits.length, 0);
    assert.deepEqual(shBlank.gitState.headFiles, {});
    assert.equal(shBlank.gitState.headFiles, shBlank.gitState.headSnapshot);
    assert.ok(shBlank.gitState.staged instanceof Map);

    for (const cmd of ['git status', 'git log', 'git diff', 'git add .', 'git commit -m "nope"']) {
      const res = await shBlank.execute(cmd);
      assert.equal(res.code, 128, `${cmd} must exit 128 when uninitialized`);
      assert.ok(res.stderr.includes('not a git repository'), `${cmd} prints fatal not a git repository`);
    }

    const verRes = await shBlank.execute('git --version');
    assert.equal(verRes.code, 0);

    // Seeding `.git/HEAD` via `options.files` on strict `createVirtualFs()` creates parent `.git` dir without ENOENT
    const strictVfs = runtime.createVirtualFs();
    const shWithDotGit = shellBundle.createPosixShell({
      vfs: strictVfs,
      files: {
        '.git/HEAD': 'ref: refs/heads/develop\n',
        'src/main.ts': 'export const ok = true;\n'
      }
    });
    assert.equal(shWithDotGit.gitState.initialized, true);
    assert.equal(shWithDotGit.gitState.branch, 'develop');
    assert.notEqual(shWithDotGit.gitState.headCommit, 'a1b2c3d');
    assert.equal(shWithDotGit.gitState.commits.length, 1);
    const stRes = await shWithDotGit.execute('git status');
    assert.equal(stRes.code, 0);
    assert.ok(stRes.stdout.includes('On branch develop'));
    assert.ok(stRes.stdout.includes('working tree clean'));

    // Subshell command substitution shares parent shell gitState
    await shWithDotGit.execute('git checkout -b feature/subshell');
    const subRes = await shWithDotGit.execute('echo "branch=$(git branch)"');
    assert.ok(subRes.stdout.includes('* feature/subshell'));
  });

  await runTest('[D5.2] Bug B-14: CLI git <-> CodeLabScm GUI interleaving, Set assignment immunity, headSnapshot===headFiles sync, and git reset/restore/rm', async () => {
    const scm = getScmEngine();
    const vfs = runtime.createVirtualFs({
      '/workspace/a.js': 'const a = 1;\n',
      '/workspace/b.js': 'const b = 1;\n'
    });
    const sh = shellBundle.createPosixShell({ vfs });
    assert.equal(sh.gitState.initialized, false);

    // GUI Initialize Repository leaves existing workspace files untracked (snapshotExisting: false)
    scm.initRepository(sh);
    assert.equal(sh.gitState.initialized, true);
    assert.ok(vfs.existsSync('/workspace/.git/HEAD'));

    const initCliStatus = await sh.execute('git status');
    assert.equal(initCliStatus.code, 0);
    assert.ok(initCliStatus.stdout.includes('Untracked files:'));
    assert.ok(initCliStatus.stdout.includes('a.js'));

    // GUI computeGitStatus ignores `.git/HEAD` & `node_modules/*` if passed in workspace file map
    const guiStatus0 = scm.computeGitStatus(
      {
        '.git/HEAD': 'ref: refs/heads/main\n',
        'node_modules/pkg/index.js': 'module.exports = {};',
        'a.js': 'const a = 1;\n',
        'b.js': 'const b = 1;\n'
      },
      '/workspace',
      sh.gitState
    );
    assert.deepEqual(
      guiStatus0.untracked.map((u) => u.path).sort(),
      ['a.js', 'b.js']
    );

    // Interleave: stage `a.js` via GUI `stageFile`, then stage `b.js` via CLI `git add b.js` -> ZERO TypeError!
    scm.stageFile(sh.gitState, 'a.js', 'const a = 1;\n');
    const addB = await sh.execute('git add b.js');
    assert.equal(addB.code, 0);
    assert.equal(sh.gitState.staged.size, 2);

    // Commit via GUI `commitChanges` -> syncs headSnapshot === headFiles and prepends commit for `git log -n 1`
    const firstHash = scm.commitChanges(sh.gitState, 'feat: initial workspace commit');
    assert.ok(firstHash);
    assert.equal(sh.gitState.headSnapshot, sh.gitState.headFiles, 'headSnapshot === headFiles');
    assert.equal(sh.gitState.headCommit, firstHash);

    const log1 = await sh.execute('git log -n 1');
    assert.equal(log1.code, 0);
    assert.ok(log1.stdout.includes('feat: initial workspace commit'));
    assert.equal(log1.stdout.includes('undefined'), false, 'Author and Date are never undefined');

    const cleanCheck = await sh.execute('git status');
    assert.ok(cleanCheck.stdout.includes('working tree clean'));

    // Simulate legacy Set assignment (`gs.staged = new Set(['a.js'])`) -> auto-converts to shimmed Map!
    vfs.writeFileSync('/workspace/a.js', 'const a = 2;\n');
    vfs.writeFileSync('/workspace/b.js', 'const b = 2;\n');
    sh.gitState.staged = new Set(['a.js']);
    assert.ok(sh.gitState.staged instanceof Map, 'Set assignment converted to Map');
    assert.equal(sh.gitState.staged.get('a.js'), 'const a = 2;\n');

    // Both CLI `git add b.js` and GUI `unstageFile` / `commitChanges` work seamlessly
    await sh.execute('git add b.js');
    await sh.execute('git reset HEAD b.js');
    assert.equal(sh.gitState.staged.has('b.js'), false);
    assert.equal(sh.gitState.staged.has('a.js'), true);

    // Edit `a.js` again in VFS to test `MM` (staged v2, worktree v3) in both GUI & CLI `git status -s`
    vfs.writeFileSync('/workspace/a.js', 'const a = 3;\n');
    const shortStatus = await sh.execute('git status -s');
    assert.ok(shortStatus.stdout.includes('MM a.js'), `expected MM a.js, got: ${shortStatus.stdout}`);
    const mmGui = scm.computeGitStatus(
      { 'a.js': 'const a = 3;\n', 'b.js': 'const b = 2;\n' },
      '/workspace',
      sh.gitState
    );
    assert.equal(mmGui.staged.length, 1);
    assert.equal(mmGui.modified.length, 2);

    // Commit staged v2 via CLI `git commit -m` -> commits staged index (`const a = 2;\n`), leaving v3 modified
    const cliCommit = await sh.execute('git commit -m "feat: commit staged v2"');
    assert.equal(cliCommit.code, 0);
    assert.equal(sh.gitState.headFiles['a.js'], 'const a = 2;\n');
    assert.equal(sh.gitState.headSnapshot, sh.gitState.headFiles);
    assert.equal(sh.gitState.commits[0].message, 'feat: commit staged v2');

    // CLI `git rm b.js` removes from VFS and stages deletion (`null`)
    const rmRes = await sh.execute('git rm b.js');
    assert.equal(rmRes.code, 0);
    assert.equal(vfs.existsSync('/workspace/b.js'), false);
    assert.equal(sh.gitState.staged.get('b.js'), null);

    // CLI `git reset --hard` restores HEAD (`a.js` -> v2, `b.js` -> v1)
    const hardReset = await sh.execute('git reset --hard');
    assert.equal(hardReset.code, 0);
    assert.equal(vfs.readFileSync('/workspace/a.js', 'utf8'), 'const a = 2;\n');
    assert.equal(vfs.readFileSync('/workspace/b.js', 'utf8'), 'const b = 1;\n');
  });

  await runTest('[D5.3] CodeLabScm.discardChanges restores modified/deleted nested tracked files (mkdirSync safe) and removes untracked files', async () => {
    const scm = getScmEngine();
    const vfs = runtime.createVirtualFs({
      '/workspace/src/deep/module.ts': 'export const v = 1;\n'
    });
    const sh = shellBundle.createPosixShell({ vfs, gitInitialized: true });
    const workspaceFiles = {
      'src/deep/module.ts': 'export const v = 1;\n'
    };

    // 1. Modify tracked file + stage it -> discardChanges restores HEAD and unstages
    vfs.writeFileSync('/workspace/src/deep/module.ts', 'export const v = 999;\n');
    workspaceFiles['src/deep/module.ts'] = 'export const v = 999;\n';
    scm.stageFile(sh.gitState, 'src/deep/module.ts', 'export const v = 999;\n');

    assert.equal(scm.discardChanges(sh, 'src/deep/module.ts', workspaceFiles), true);
    assert.equal(vfs.readFileSync('/workspace/src/deep/module.ts', 'utf8'), 'export const v = 1;\n');
    assert.equal(workspaceFiles['src/deep/module.ts'], 'export const v = 1;\n');
    assert.equal(sh.gitState.staged.has('src/deep/module.ts'), false);

    // 2. Delete entire `/workspace/src` directory on strict VirtualFs -> discardChanges recreates parent dirs!
    vfs.rmSync('/workspace/src', { recursive: true, force: true });
    delete workspaceFiles['src/deep/module.ts'];
    assert.equal(vfs.existsSync('/workspace/src'), false);

    assert.equal(scm.discardChanges(sh, '/workspace/src/deep/module.ts', workspaceFiles), true);
    assert.equal(vfs.readFileSync('/workspace/src/deep/module.ts', 'utf8'), 'export const v = 1;\n');
    assert.equal(workspaceFiles['src/deep/module.ts'], 'export const v = 1;\n');

    // 3. Create untracked file + stage it -> discardChanges deletes it from VFS, workspaceFiles, and staging
    vfs.writeFileSync('/workspace/scratch.js', 'temp();\n');
    workspaceFiles['scratch.js'] = 'temp();\n';
    scm.stageFile(sh.gitState, 'scratch.js', 'temp();\n');

    assert.equal(scm.discardChanges(sh, 'scratch.js', workspaceFiles), true);
    assert.equal(vfs.existsSync('/workspace/scratch.js'), false);
    assert.equal('scratch.js' in workspaceFiles, false);
    assert.equal(sh.gitState.staged.has('scratch.js'), false);

    // 4. Discarding non-existent untracked file or .git path returns false safely
    assert.equal(scm.discardChanges(sh, 'does-not-exist.js', workspaceFiles), false);
    assert.equal(scm.discardChanges(sh, '.git/HEAD', workspaceFiles), false);
  });

  await runTest('[D5.4] CodeLabScm.stageAll / unstageAll, git restore (--staged & worktree), and git init vs git init --empty-head', async () => {
    const scm = getScmEngine();
    const vfs = runtime.createVirtualFs({
      '/workspace/one.js': 'const one = 1;\n',
      '/workspace/two.js': 'const two = 2;\n'
    });
    const sh = shellBundle.createPosixShell({ vfs });

    // `git init --empty-head` creates repo with empty HEAD so existing files remain untracked
    const emptyInit = await sh.execute('git init --empty-head');
    assert.equal(emptyInit.code, 0);
    assert.equal(sh.gitState.initialized, true);
    assert.deepEqual(sh.gitState.headFiles, {});

    // Stage all via GUI `stageAll` (modified + untracked + deleted)
    const filesMap = {
      '.git/HEAD': 'ref: refs/heads/main\n',
      'one.js': 'const one = 1;\n',
      'two.js': 'const two = 2;\n'
    };
    scm.stageAll(sh.gitState, filesMap, '/workspace');
    assert.equal(sh.gitState.staged.size, 2);

    // Unstage all via GUI `unstageAll`
    scm.unstageAll(sh.gitState);
    assert.equal(sh.gitState.staged.size, 0);

    // Stage all again and commit baseline
    scm.stageAll(sh.gitState, filesMap, '/workspace');
    const baseCommit = scm.commitChanges(sh.gitState, 'chore: baseline');
    assert.ok(baseCommit);

    // Modify `one.js`, stage via CLI, unstage via `git restore --staged one.js`, then revert via `git restore one.js`
    vfs.writeFileSync('/workspace/one.js', 'const one = 99;\n');
    await sh.execute('git add one.js');
    assert.equal(sh.gitState.staged.has('one.js'), true);

    const unstageRes = await sh.execute('git restore --staged one.js');
    assert.equal(unstageRes.code, 0);
    assert.equal(sh.gitState.staged.has('one.js'), false);
    assert.equal(vfs.readFileSync('/workspace/one.js', 'utf8'), 'const one = 99;\n');

    const restoreRes = await sh.execute('git restore one.js');
    assert.equal(restoreRes.code, 0);
    assert.equal(vfs.readFileSync('/workspace/one.js', 'utf8'), 'const one = 1;\n');
  });

  await runTest('[D5.5 / T12] Challenge 1 Guard: edit -> stage -> revert to HEAD via stageFile / Set shim / .add(nonexistent) / null untracked / raw Map keeps CLI & GUI clean and blocks phantom no-op commits', async () => {
    const scm = getScmEngine();
    const vfs = runtime.createVirtualFs({
      '/workspace/a.js': 'v1\n'
    });
    const sh = shellBundle.createPosixShell({ vfs, gitInitialized: true });
    assert.equal(sh.gitState.commits.length, 1);

    const assertCleanAndNoPhantomCommit = async (label) => {
      const stCli = await sh.execute('git status');
      const stShort = await sh.execute('git status -s');
      const stGui = scm.computeGitStatus({ 'a.js': 'v1\n' }, '/workspace', sh.gitState);
      assert.equal(stCli.stdout.includes('working tree clean'), true, `${label}: CLI git status must be clean`);
      assert.equal(stShort.stdout.trim(), '', `${label}: git status -s must be empty`);
      assert.equal(stGui.isClean, true, `${label}: GUI computeGitStatus must be clean`);
      assert.equal(stGui.staged.length, 0, `${label}: GUI staged must be empty`);
      assert.equal(stGui.entries.length, 0, `${label}: GUI entries must be empty`);

      const cmCli = await sh.execute('git commit -m "ghost"');
      assert.equal(cmCli.code, 1, `${label}: git commit must reject no-op index with code 1`);
      assert.throws(
        () => scm.commitChanges(sh.gitState, 'ghost'),
        /Nothing to commit/,
        `${label}: scm.commitChanges must reject no-op index`
      );
      assert.equal(sh.gitState.commits.length, 1, `${label}: commit count must remain 1`);
      assert.equal(sh.gitState.headSnapshot, sh.gitState.headFiles, `${label}: headSnapshot === headFiles`);
    };

    // 1. Edit -> stage -> revert to HEAD -> stageFile(gs, 'a.js', 'v1\n')
    vfs.writeFileSync('/workspace/a.js', 'v2\n');
    scm.stageFile(sh.gitState, 'a.js', 'v2\n');
    assert.equal(scm.computeGitStatus({ 'a.js': 'v2\n' }, '/workspace', sh.gitState).isClean, false);
    vfs.writeFileSync('/workspace/a.js', 'v1\n');
    scm.stageFile(sh.gitState, 'a.js', 'v1\n');
    assert.equal(sh.gitState.staged.has('a.js'), false);
    await assertCleanAndNoPhantomCommit('vector-1-stageFile-reverted');

    // 2. Legacy Set assignment + .add('a.js') + .add('nonexistent.json')
    sh.gitState.staged = new Set(['a.js', 'nonexistent.json']);
    sh.gitState.staged.add('a.js');
    sh.gitState.staged.add('nonexistent.json');
    await assertCleanAndNoPhantomCommit('vector-2-set-shim-and-nonexistent');

    // 3. Stage new untracked file -> delete from VFS -> stageFile(gs, 'untracked.js', null)
    vfs.writeFileSync('/workspace/untracked.js', 'temp\n');
    scm.stageFile(sh.gitState, 'untracked.js', 'temp\n');
    assert.equal(sh.gitState.staged.has('untracked.js'), true);
    vfs.rmSync('/workspace/untracked.js', { force: true });
    scm.stageFile(sh.gitState, 'untracked.js', null);
    assert.equal(sh.gitState.staged.has('untracked.js'), false);
    await assertCleanAndNoPhantomCommit('vector-3-stageFile-null-untracked');

    // 4. Direct raw Map.prototype.set with unchanged HEAD value and null non-HEAD path
    sh.gitState.staged.set('a.js', 'v1\n');
    sh.gitState.staged.set('ghost.js', null);
    await assertCleanAndNoPhantomCommit('vector-4-raw-map-set-noop');
  });

  await runTest('[D5.6 / T13] Challenge 2 Guard: git init + git add + git commit succeeds on post-boot files, boot-seeded files (preserving initial clean status), and GUI initRepository(sh)', async () => {
    const scm = getScmEngine();

    // 1. Blank shell + post-boot file creation -> `git init && git add app.js && git commit -m "init v1"`
    const vfsPost = runtime.createVirtualFs();
    const shPost = shellBundle.createPosixShell({ vfs: vfsPost });
    vfsPost.writeFileSync('/workspace/app.js', 'const v = 1;\n');
    const resPost = await shPost.execute('git init && git add app.js && git commit -m "init v1"');
    assert.equal(resPost.code, 0, `expected exit 0, got ${resPost.code}: ${resPost.stdout} ${resPost.stderr}`);
    assert.equal(shPost.gitState.initialized, true);
    assert.equal(shPost.gitState.commits.length, 1);
    assert.equal(shPost.gitState.commits[0].message, 'init v1');
    assert.equal(shPost.gitState.headFiles['app.js'], 'const v = 1;\n');
    assert.equal(shPost.gitState.headSnapshot, shPost.gitState.headFiles);

    // Verify step-by-step post-boot `git init` shows file as untracked (`??`) in both CLI and GUI before `git add`
    const vfsPostStep = runtime.createVirtualFs();
    const shPostStep = shellBundle.createPosixShell({ vfs: vfsPostStep });
    vfsPostStep.writeFileSync('/workspace/app.js', 'const step = 1;\n');
    await shPostStep.execute('git init');
    const postInitShort = await shPostStep.execute('git status -s');
    const postInitGui = scm.computeGitStatus({ 'app.js': 'const step = 1;\n' }, '/workspace', shPostStep.gitState);
    assert.equal(postInitShort.stdout, '?? app.js\n');
    assert.equal(postInitGui.isClean, false);
    assert.deepEqual(postInitGui.untracked.map((u) => u.path), ['app.js']);

    // 2. Boot-seeded file -> `git init` starts clean, AND `git add . && git commit -m "first"` succeeds with commits.length === 1
    const vfsBoot = runtime.createVirtualFs({
      '/workspace/file.js': 'console.log("boot");\n'
    });
    const shBoot = shellBundle.createPosixShell({ vfs: vfsBoot });
    const bootInit = await shBoot.execute('git init');
    assert.equal(bootInit.code, 0);
    assert.equal(shBoot.gitState.commits.length, 0);

    const bootCleanCli = await shBoot.execute('git status');
    const bootCleanGui = scm.computeGitStatus({ 'file.js': 'console.log("boot");\n' }, '/workspace', shBoot.gitState);
    assert.equal(bootCleanCli.stdout.includes('working tree clean'), true);
    assert.equal(bootCleanGui.isClean, true);

    const bootAdd = await shBoot.execute('git add .');
    assert.equal(bootAdd.code, 0);
    const bootStagedShort = await shBoot.execute('git status -s');
    const bootStagedGui = scm.computeGitStatus({ 'file.js': 'console.log("boot");\n' }, '/workspace', shBoot.gitState);
    assert.equal(bootStagedShort.stdout, 'A  file.js\n');
    assert.equal(bootStagedGui.isClean, false);
    assert.equal(bootStagedGui.staged.length, 1);
    assert.equal(bootStagedGui.staged[0].status, 'added');

    const bootCommit = await shBoot.execute('git commit -m "first"');
    assert.equal(bootCommit.code, 0);
    assert.equal(shBoot.gitState.commits.length, 1);
    assert.equal(shBoot.gitState.commits[0].message, 'first');
    assert.equal(shBoot.gitState.headSnapshot, shBoot.gitState.headFiles);

    // Re-running `git init` on an already-initialized repo is non-destructive
    const reInit = await shBoot.execute('git init');
    assert.equal(reInit.code, 0);
    assert.equal(shBoot.gitState.commits.length, 1);
    assert.equal(shBoot.gitState.headFiles['file.js'], 'console.log("boot");\n');

    // 3. GUI `scm.initRepository(sh)` (`snapshotExisting: false` default) -> untracked, stageable, committable
    const vfsGui = runtime.createVirtualFs({
      '/workspace/existing.ts': 'export const x = 42;\n'
    });
    const shGui = shellBundle.createPosixShell({ vfs: vfsGui });
    scm.initRepository(shGui);
    assert.equal(shGui.gitState.initialized, true);
    assert.equal(shGui.gitState.commits.length, 0);
    assert.deepEqual(shGui.gitState.headFiles, {});

    const guiUntrackedCli = await shGui.execute('git status -s');
    const guiUntrackedSt = scm.computeGitStatus({ 'existing.ts': 'export const x = 42;\n' }, '/workspace', shGui.gitState);
    assert.equal(guiUntrackedCli.stdout, '?? existing.ts\n');
    assert.deepEqual(guiUntrackedSt.untracked.map((u) => u.path), ['existing.ts']);

    scm.stageFile(shGui.gitState, 'existing.ts', 'export const x = 42;\n');
    const guiHash = scm.commitChanges(shGui.gitState, 'feat: gui initial commit');
    assert.ok(guiHash);
    assert.equal(shGui.gitState.commits.length, 1);
    assert.equal(shGui.gitState.headSnapshot, shGui.gitState.headFiles);
    assert.equal((await shGui.execute('git status')).stdout.includes('working tree clean'), true);
    assert.equal(scm.computeGitStatus({ 'existing.ts': 'export const x = 42;\n' }, '/workspace', shGui.gitState).isClean, true);
  });

  await runTest('[D5.7 / T14] Deterministic 100-step CLI <-> GUI differential fuzzer verifies cliIsClean === gui.isClean, XY short-status parity, and headSnapshot === headFiles on every step', async () => {
    const scm = getScmEngine();
    let seed = 0xc0de1ab1 >>> 0;
    const nextRand = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (arr) => arr[Math.floor(nextRand() * arr.length)];

    const trackedPool = ['src/a.js', 'src/sub/b.ts', 'README.md', 'config/app.json', '.env'];
    const vfs = runtime.createVirtualFs({
      '/workspace/src/a.js': 'export const a = 0;\n',
      '/workspace/README.md': '# Seed Repo\n'
    });
    const sh = shellBundle.createPosixShell({ vfs, gitInitialized: true });

    const writeVfsRel = (relPath, content) => {
      const abs = `/workspace/${relPath}`;
      const slash = abs.lastIndexOf('/');
      const dir = slash > 0 ? abs.slice(0, slash) : '/workspace';
      if (!vfs.existsSync(dir)) {
        vfs.mkdirSync(dir, { recursive: true });
      }
      vfs.writeFileSync(abs, content);
    };

    const readLiveWorktree = () => {
      const out = {};
      const walk = (dir) => {
        if (!vfs.existsSync(dir)) return;
        for (const name of vfs.readdirSync(dir)) {
          if (name === '.git' || name === 'node_modules') continue;
          const full = `${dir}/${name}`;
          if (vfs.statSync(full).isDirectory()) {
            walk(full);
          } else {
            out[full.slice('/workspace/'.length)] = String(vfs.readFileSync(full, 'utf8'));
          }
        }
      };
      walk('/workspace');
      return out;
    };

    for (let step = 1; step <= 100; step++) {
      const p = pick(trackedPool);
      const abs = `/workspace/${p}`;
      const op = step <= 20 ? step - 1 : Math.floor(nextRand() * 20);
      const head = sh.gitState.headFiles || {};

      if (op === 0) {
        writeVfsRel(p, `// content step ${step}\n`);
      } else if (op === 1) {
        if (Object.prototype.hasOwnProperty.call(head, p)) {
          writeVfsRel(p, head[p]);
          scm.stageFile(sh.gitState, p, head[p]);
        } else {
          writeVfsRel(p, `// created ${step}\n`);
          scm.stageFile(sh.gitState, p, `// created ${step}\n`);
        }
      } else if (op === 2) {
        sh.gitState.staged = new Set([p, 'nonexistent.json', 'packages/x/node_modules/y.js']);
        sh.gitState.staged.add('src/./a.js');
      } else if (op === 3) {
        const live = readLiveWorktree();
        const val = Object.prototype.hasOwnProperty.call(live, p) ? live[p] : null;
        scm.stageFile(sh.gitState, p, val);
      } else if (op === 4) {
        writeVfsRel('packages/x/node_modules/y.js', 'module.exports = 1;\n');
        await sh.execute(`git add "${p}" packages/x/node_modules/y.js`);
      } else if (op === 5) {
        await sh.execute('git add -A');
      } else if (op === 6) {
        scm.stageAll(
          sh.gitState,
          {
            ...readLiveWorktree(),
            '.git/HEAD': `ref: refs/heads/${sh.gitState.branch}\n`,
            'node_modules/pkg/index.js': 'module.exports = {};\n'
          },
          '/workspace'
        );
      } else if (op === 7) {
        scm.unstageFile(sh.gitState, p);
      } else if (op === 8) {
        await sh.execute(`git restore --staged "${p}"`);
      } else if (op === 9) {
        await sh.execute('git restore --staged src');
      } else if (op === 10) {
        await sh.execute(`git rm "${p}"`);
      } else if (op === 11) {
        await sh.execute(`git rm --cached "${p}"`);
      } else if (op === 12) {
        scm.discardChanges(sh, p);
      } else if (op === 13) {
        await sh.execute(`git restore "${p}"`);
      } else if (op === 14) {
        await sh.execute(nextRand() < 0.5 ? 'git checkout -b feat/diff-fuzz' : 'git checkout main');
      } else if (op === 15) {
        if (p === 'src/sub/b.ts' && vfs.existsSync('/workspace/src/sub')) {
          vfs.rmSync('/workspace/src/sub', { recursive: true, force: true });
        } else if (vfs.existsSync(abs)) {
          vfs.rmSync(abs, { force: true });
        }
      } else if (op === 16) {
        if (Object.prototype.hasOwnProperty.call(head, p) && sh.gitState.commits.length > 0) {
          sh.gitState.staged.set(p, head[p]);
        }
        sh.gitState.staged.set('ghost-untracked.js', null);
      } else if (op === 17) {
        await sh.execute('git init');
      } else if (op === 18) {
        const preGui = scm.computeGitStatus(readLiveWorktree(), '/workspace', sh.gitState);
        const cm = await sh.execute(`git commit -m "cli-step-${step}"`);
        assert.equal(cm.code === 0, preGui.staged.length > 0, `step ${step}: CLI commit exit vs preGui.staged`);
      } else {
        const preGui = scm.computeGitStatus(readLiveWorktree(), '/workspace', sh.gitState);
        if (preGui.staged.length === 0) {
          assert.throws(() => scm.commitChanges(sh.gitState, `gui-step-${step}`), /Nothing to commit/);
        } else {
          const hash = scm.commitChanges(sh.gitState, `gui-step-${step}`);
          assert.ok(hash);
        }
      }

      const liveAfter = readLiveWorktree();
      const guiInput = {
        ...liveAfter,
        '.git/HEAD': `ref: refs/heads/${sh.gitState.branch}\n`,
        'node_modules/pkg/index.js': 'module.exports = 1;\n',
        'packages/x/node_modules/y.js': 'module.exports = 2;\n'
      };
      const stLong = await sh.execute('git status');
      const stShort = await sh.execute('git status -s');
      const gui = scm.computeGitStatus(guiInput, '/workspace', sh.gitState);

      assert.equal(stLong.code, 0, `step ${step} (op=${op}): git status exit 0`);
      assert.equal(stShort.code, 0, `step ${step} (op=${op}): git status -s exit 0`);
      assert.equal(
        sh.gitState.headSnapshot,
        sh.gitState.headFiles,
        `step ${step} (op=${op}): gs.headSnapshot === gs.headFiles`
      );
      assert.ok(sh.gitState.staged instanceof Map, `step ${step} (op=${op}): staged instanceof Map`);
      assert.equal(sh.gitState.staged, sh.gitState.stagedFiles, `step ${step} (op=${op}): staged === stagedFiles`);

      const cliIsClean = stLong.stdout.includes('working tree clean');
      const cliShortClean = stShort.stdout.trim() === '';
      assert.equal(cliIsClean, cliShortClean, `step ${step} (op=${op}): CLI long vs short clean`);
      assert.equal(cliIsClean, gui.isClean, `step ${step} (op=${op}): cliIsClean === gui.isClean`);
      assert.equal(gui.hasChanges, !gui.isClean, `step ${step} (op=${op}): hasChanges === !isClean`);

      const cliHasStaged = stLong.stdout.includes('Changes to be committed:');
      assert.equal(cliHasStaged, gui.staged.length > 0, `step ${step} (op=${op}): staged presence match`);

      for (const s of gui.staged) {
        if (s.status === 'modified') {
          assert.notEqual(
            s.oldContent,
            s.newContent,
            `step ${step} (op=${op}): staged modified ${s.path} must have oldContent !== newContent`
          );
        }
      }

      const cliShortSet = new Set(stShort.stdout.split('\n').filter((line) => line.length > 0));
      const guiShortSet = new Set(gui.entries.map((e) => `${e.index}${e.worktree} ${e.path}`));
      assert.deepEqual(
        guiShortSet,
        cliShortSet,
        `step ${step} (op=${op}): exact XY path parity between GUI computeGitStatus and CLI git status -s`
      );
    }
  });

  console.log('\n────────────────────────────────────────────────────────────────────────────');
  console.log(`Milestone 1 Platform Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error in test-vscode-platform:', err);
    process.exit(1);
  });
}

module.exports = { main };
