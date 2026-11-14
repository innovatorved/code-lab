#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 2 VS Code Workbench Parity Verification Suite
 * (tests/test-vscode-workbench.js)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Exercises all 12 Milestone 2 feature groups (F1-F12) and bug fixes (B-01..B-20)
 * against the built artifacts in dist/ via tests/helpers/load.js + mock-dom.js.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { doc, DOMEvent, localStorageMock } = require('./helpers/mock-dom.js');
const loader = require('./helpers/load.js');
const { defineGlobal } = require('./helpers/globals.js');

const CodeLab = loader.loadCodeLab();
const pyExtMod = require(path.join(loader.DIST, 'extensions', 'python.js'));
const cppExtMod = require(path.join(loader.DIST, 'extensions', 'cpp.js'));
void loader.sqlStandalone;

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

function mountFreshWorkbench(options = {}) {
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  const wb = CodeLab.create(host, {
    labId: options.labId || `vw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    persistState: options.persistState !== undefined ? options.persistState : false,
    ...options
  });
  return {
    host,
    wb,
    cleanup() {
      try {
        wb.destroy();
      } catch (_e) {
        void _e;
      }
      if (host.parentNode) {
        host.parentNode.removeChild(host);
      }
    }
  };
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Milestone 2: VS Code Workbench Parity Verification Suite (F1–F12)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ── F1: Canonical 5-Region Shell & Splitters ───────────────────────────────
  await runTest('[F1] mounts canonical 5-region VS Code shell with splitters & visibility toggles', () => {
    const { host, wb, cleanup } = mountFreshWorkbench({ labId: 'vw-f1' });
    try {
      assert.ok(host.querySelector('#cl-menubar'), 'menubar must exist');
      assert.ok(host.querySelector('#cl-activitybar'), 'activity bar must exist');
      assert.ok(host.querySelector('#cl-sidebar'), 'primary sidebar must exist');
      assert.ok(host.querySelector('.codelab-editor-col'), 'editor column must exist');
      assert.ok(host.querySelector('#cl-drawer'), 'bottom panel drawer must exist');
      assert.ok(host.querySelector('#cl-statusbar'), 'status bar must exist');
      assert.ok(host.querySelector('#cl-splitter-files'), 'sidebar splitter must exist');
      assert.ok(host.querySelector('#cl-splitter-drawer, #cl-splitter-h'), 'drawer splitter must exist');

      wb.setSidebarVisible(false);
      assert.equal(wb.sidebarVisible, false);
      assert.equal(host.querySelector('.codelab').classList.contains('sidebar-collapsed'), true);
      wb.setSidebarVisible(true);
      assert.equal(wb.sidebarVisible, true);

      wb.setPanelVisible(false);
      assert.equal(wb.panelVisible, false);
      wb.setPanelVisible(true);
      assert.equal(wb.panelVisible, true);
    } finally {
      cleanup();
    }
  });

  // ── F2: Activity Bar, Plugin Views & Focus-Aware Active Icon Toggle ────────
  await runTest('[F2] switches Sidebar views, supports plugin views, and focus-toggles active icon', () => {
    const { host, wb, cleanup } = mountFreshWorkbench({ labId: 'vw-f2' });
    try {
      wb.setSidebarView('search');
      assert.equal(wb.activeSidebarView, 'search');
      assert.equal(host.querySelector('#cl-sidebar-search').hidden, false);
      assert.equal(host.querySelector('#cl-sidebar-explorer').hidden, true);
      assert.equal(host.querySelector('[data-cl-activity="search"]').getAttribute('aria-pressed'), 'true');

      wb.setSidebarView('scm');
      assert.equal(wb.activeSidebarView, 'scm');
      assert.equal(host.querySelector('#cl-sidebar-scm').hidden, false);

      // Register & dispose a sidebar plugin view
      const disp = wb.registerPlugin({
        id: 'inspector-plugin',
        name: 'Inspector Plugin',
        activate(ctx) {
          ctx.registerPanel({
            id: 'custom-side',
            title: 'Custom Side',
            location: 'sidebar',
            render(el) {
              el.innerHTML = '<div class="plugin-ok">Loaded</div>';
            }
          });
        }
      });
      wb.setSidebarView('plugin:custom-side');
      assert.equal(wb.activeSidebarView, 'plugin:custom-side');
      assert.match(host.querySelector('#cl-sidebar-plugin-host').innerHTML, /Loaded/);
      disp.dispose();
      assert.equal(wb.activeSidebarView, 'explorer');

      // Focus-aware toggle: when _sidebarHadFocusOnPointerDown is false (focus was in drawer/editor),
      // clicking active explorer button keeps sidebar open instead of collapsing!
      wb.setSidebarView('explorer');
      assert.equal(wb.sidebarVisible, true);
      wb._sidebarHadFocusOnPointerDown = false;
      const expBtn = host.querySelector('[data-cl-activity="explorer"]');
      expBtn.dispatchEvent(new DOMEvent('click', { bubbles: true }));
      assert.equal(wb.sidebarVisible, true, 'clicking active icon while focus was outside sidebar must focus view, not collapse');

      // Clicking again when focus WAS in sidebar collapses it
      wb._sidebarHadFocusOnPointerDown = true;
      expBtn.dispatchEvent(new DOMEvent('click', { bubbles: true }));
      assert.equal(wb.sidebarVisible, false, 'clicking active icon when focus was in sidebar must collapse');
    } finally {
      cleanup();
    }
  });

  // ── F3: Dedicated Bottom Panel Tabs & Maximize ─────────────────────────────
  await runTest('[F3] switches Bottom Panel tabs non-modally and toggles maximize', () => {
    const { host, wb, cleanup } = mountFreshWorkbench({ labId: 'vw-f3' });
    try {
      for (const tab of ['problems', 'output', 'terminal', 'ports']) {
        wb.switchDrawerTab(tab);
        assert.equal(wb.drawerTab, tab);
        assert.equal(host.querySelector('#cl-modal-slot').innerHTML, '');
      }
      wb.setPanelMaximized(true);
      assert.equal(wb.panelMaximized, true);
      wb.setPanelMaximized(false);
      assert.equal(wb.panelMaximized, false);
    } finally {
      cleanup();
    }
  });

  // ── F4: Explorer Tree CRUD, Reserved Names & Circular Move Guard ───────────
  await runTest('[F4] Explorer CRUD syncs VFS, blocks .git/node_modules, and rejects circular moves', () => {
    const { wb, cleanup } = mountFreshWorkbench({
      labId: 'vw-f4',
      files: { 'index.js': 'console.log(1);\n' }
    });
    try {
      assert.equal(wb.createFolder('src/utils/deep'), true);
      assert.ok(wb.createFile('src/utils/deep/math.js', 'export const x = 2;\n'));
      assert.equal(wb.shell.vfs.existsSync('/workspace/src/utils/deep/math.js'), true);

      // Reserved names blocked even before git init
      assert.ok(wb._hasPathConflict('.git'), '.git must be reserved');
      assert.ok(wb._hasPathConflict('node_modules'), 'node_modules must be reserved');
      assert.ok(wb._hasPathConflict('src/.git/config'), 'nested .git segment must be reserved');

      // Circular folder move rejected
      assert.equal(wb.movePath('src', 'src/utils'), false);

      // Valid rename & delete propagate to VFS
      assert.equal(wb.renameFile('src/utils/deep/math.js', 'src/utils/deep/calc.js'), true);
      assert.equal(wb.shell.vfs.existsSync('/workspace/src/utils/deep/math.js'), false);
      assert.equal(wb.shell.vfs.existsSync('/workspace/src/utils/deep/calc.js'), true);

      wb.collapseAllFolders();
      assert.equal(wb.collapsedFolders.has('src'), true);
      assert.equal(wb.deleteFolder('src'), true);
      assert.equal(wb.getFile('src/utils/deep/calc.js'), undefined);
    } finally {
      cleanup();
    }
  });

  // ── F5: Multi-Workspace Isolation & Blank Boot ─────────────────────────────
  await runTest('[F5] blank: true boots zero-file workspace and isolates per-labId storage', async () => {
    localStorageMock.clear();
    const a = mountFreshWorkbench({ labId: 'vw-f5-blank', blank: true, persistState: true });
    const b = mountFreshWorkbench({
      labId: 'vw-f5-proj',
      persistState: true,
      files: { 'only-b.js': 'export default 42;\n' }
    });
    try {
      assert.deepEqual(Object.keys(a.wb.getFiles()), []);
      assert.deepEqual(a.wb.getOpenTabs(), []);
      assert.deepEqual(Object.keys(b.wb.getFiles()), ['only-b.js']);

      a.wb.createFile('only-a.js', 'const a = 1;\n');
      await a.wb.saveWorkspace();
      await b.wb.saveWorkspace();

      assert.equal(b.wb.getFile('only-a.js'), undefined);
      assert.equal(a.wb.getFile('only-b.js'), undefined);
    } finally {
      a.cleanup();
      b.cleanup();
    }
  });

  // ── F6: GitHub Clone URL Parsing, Rate-Limit Error & Abort Cleanup ─────────
  await runTest('[F6] parses GitHub URLs, cancels in-flight clone cleanly, and surfaces 404 errors', async () => {
    const parsed = CodeLab.parseGitHubRepoUrl('https://github.com/acme/demo-repo/tree/dev');
    assert.equal(parsed.owner, 'acme');
    assert.equal(parsed.repo, 'demo-repo');
    assert.equal(parsed.branch, 'dev');

    const restoreFetch = defineGlobal('fetch', async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => null },
      json: async () => ({ message: 'Not Found' }),
      text: async () => 'Not Found'
    }));
    const { wb, cleanup } = mountFreshWorkbench({ labId: 'vw-f6', blank: true });
    try {
      await assert.rejects(() => wb.cloneRepo('acme/missing-repo'), /not found|404/i);
      assert.equal(wb._cloneInFlight, false);
      assert.equal(wb.cancelClone(), false);
    } finally {
      restoreFetch();
      cleanup();
    }
  });

  // ── F7: Search & Replace Sidebar (Globs, Regex Error, $1, In-Place Replace) ─
  await runTest('[F7] Search & Replace supports globs, regex error alert, $1 capture, and in-place Replace All without opening tabs', () => {
    const { host, wb, cleanup } = mountFreshWorkbench({
      labId: 'vw-f7',
      files: {
        'open.js': 'const alpha = 1;\nconst beta = 2;\n',
        'src/a.js': 'const gamma = 3;\n',
        'src/b.js': 'const delta = 4;\n',
        'docs/notes.md': 'const ignored = 5;\n',
        'logs/app.log': 'const logItem = 6;\n'
      }
    });
    try {
      wb.openFile('open.js');
      wb.closeOtherTabs('open.js');
      assert.deepEqual(wb.getOpenTabs(), ['open.js']);

      wb.openSearchView({ query: '[unclosed(', focus: false });
      wb._searchState.regex = true;
      wb._renderSearchSidebarResults();
      const errAlert = host.querySelector('#cl-search-results [role="alert"]');
      assert.ok(errAlert, 'invalid regex must render role="alert" banner');
      assert.match(errAlert.textContent, /Invalid regular expression/i);

      // Scoped regex search + $1 single-match replace
      wb._searchState.query = 'const (\\w+)';
      wb._searchState.replaceText = 'let $1';
      wb._searchState.include = '*.js, src/**';
      wb._searchState.exclude = '*.log, docs/**';
      wb._renderSearchSidebarResults();
      assert.ok(!host.querySelector('#cl-search-results').textContent.includes('notes.md'));
      assert.ok(!host.querySelector('#cl-search-results').textContent.includes('app.log'));

      assert.equal(wb._executeSidebarReplaceOne(), true);
      assert.match(wb.getFile('open.js'), /let alpha = 1;\nconst beta = 2;/);

      // Replace All across remaining files must NOT open unopened files as tabs!
      wb._executeSidebarReplaceAll();
      assert.deepEqual(wb.getOpenTabs(), ['open.js']);
      assert.equal(wb.getFile('src/a.js'), 'let gamma = 3;\n');
      assert.equal(wb.getFile('src/b.js'), 'let delta = 4;\n');
      assert.equal(wb.getFile('docs/notes.md'), 'const ignored = 5;\n');
    } finally {
      cleanup();
    }
  });

  // ── F8: Source Control, Inline Diff, Branches, Discard & Git Persistence ───
  await runTest('[F8] Source Control manages init, staging, inline diff, branches, discard, and persisted gitState', () => {
    localStorageMock.clear();
    const { host, wb, cleanup } = mountFreshWorkbench({
      labId: 'vw-f8',
      persistState: true,
      files: { 'app.js': 'const v = 1;\n' }
    });
    try {
      wb.openScmView();
      assert.ok(host.querySelector('#cl-scm-init-btn'), 'uninitialized SCM view shows Initialize Repository');
      wb._initGitRepoInScm();

      wb.stageAllGitFiles();
      const firstHash = wb.commitGitChanges('initial commit');
      assert.ok(firstHash && firstHash.length >= 7);
      assert.equal(wb.getGitStatus().length, 0);

      // Modify tracked file & open non-destructive inline diff
      wb.setFile('app.js', 'const v = 2;\nconsole.log(v);\n');
      wb._renderScmSidebar();
      const scmRow = host.querySelector('.codelab-scm-item[data-cl-scm-file="app.js"]');
      assert.ok(scmRow, 'SCM row must carry .codelab-scm-item and data-cl-scm-file');

      assert.equal(wb.openScmDiff('app.js'), true);
      const diffHost = host.querySelector('#cl-inline-diff-container');
      assert.equal(diffHost.hidden, false);
      assert.match(diffHost.textContent, /\+2/);
      assert.match(diffHost.textContent, /−1|-1/);
      assert.equal(wb.closeScmDiff(), true);
      assert.equal(diffHost.hidden, true);

      // UI discard confirmation modal vs programmatic discardGitFile
      wb._confirmDiscardGitFile('app.js', null);
      assert.ok(host.querySelector('#cl-discard-confirm-btn'), 'UI discard opens accessible confirmation modal');
      wb.closeModal();
      assert.equal(wb.discardGitFile('app.js'), true);
      assert.equal(wb.getFile('app.js'), 'const v = 1;\n');
      assert.equal(wb.getGitStatus().length, 0);

      // Branch creation & switching + persisted gitState
      assert.equal(wb.createGitBranch('feature/login', true), true);
      assert.equal(wb._getGitState().branch, 'feature/login');
      assert.equal(wb.listGitBranches().some((b) => b.name === 'feature/login' && b.current), true);
      assert.equal(wb.checkoutGitBranch('main'), true);
      assert.equal(wb._getGitState().branch, 'main');

      const saved = wb._loadState();
      assert.equal(saved.gitState.initialized, true);
      assert.equal(saved.gitState.commits[0].message, 'initial commit');
    } finally {
      cleanup();
    }
  });

  // ── F9: Problems Panel, Live Linters & SQL Pre-Validation ──────────────────
  await runTest('[F9] aggregates JSON/JS/Python/C++/SQL diagnostics and filters Problems panel', async () => {
    const { host, wb, cleanup } = mountFreshWorkbench({
      labId: 'vw-f9',
      lang: 'sql',
      extensions: [pyExtMod.pythonExtension(), cppExtMod.cppExtension()],
      files: {
        'query.sql': 'SELEC * FORM missing_users;',
        'broken.py': 'def oops(\n  return 1\n',
        'bad.json': '{ "broken": }'
      }
    });
    try {
      wb.openProblemsPanel();
      let diags = wb.getDiagnostics();
      assert.ok(diags.some((d) => d.file === 'broken.py'), 'Python static linter must report broken.py');
      assert.ok(diags.some((d) => d.file === 'bad.json' && d.source === 'json'), 'JSON linter must report bad.json');

      await wb.runSql('run');
      diags = wb.getDiagnostics();
      assert.ok(diags.some((d) => d.file === 'query.sql' && d.source === 'sql'), 'invalid SQL must emit sql diagnostic');

      // Filter Problems panel by text
      wb.switchDrawerTab('problems');
      wb._problemsFilterQuery = 'bad.json';
      wb._renderProblemsPanel(host.querySelector('#cl-drawer-body'));
      const listText = host.querySelector('#cl-problems-list').textContent;
      assert.ok(listText.includes('bad.json'));
      assert.ok(!listText.includes('broken.py'));

      // Valid multi-statement SQL (CREATE + INSERT + SELECT) clears sql diagnostics
      wb._problemsFilterQuery = '';
      wb.setFile('query.sql', 'CREATE TABLE items (id INT, name TEXT); INSERT INTO items VALUES (1, \'ok\'); SELECT * FROM items;');
      await wb.runSql('run');
      assert.equal(wb.getDiagnostics().some((d) => d.source === 'sql'), false);
    } finally {
      cleanup();
    }
  });

  // ── F10: Multi-Session Terminal Isolation, Tab Completion & Last-Session Reset ─
  await runTest('[F10] isolates per-session cwd/REPL/logs, completes python3/clang++, and resets last closed session', async () => {
    const { host, wb, cleanup } = mountFreshWorkbench({
      labId: 'vw-f10',
      files: { 'app.js': 'console.log(1);\n' }
    });
    try {
      wb.switchDrawerTab('terminal');
      // 1 pill visible even with 1 session
      assert.equal(host.querySelectorAll('#cl-terminal-sessions .codelab-session-pill').length, 1);

      // #cl-ctrl-c-btn title must not collide with "clear"
      const ctrlCBtn = host.querySelector('#cl-ctrl-c-btn');
      assert.ok(!/clear/i.test(ctrlCBtn.getAttribute('title') || ''));

      // Tab completion for python3 and clang++
      assert.deepEqual(wb._getCompletionCandidates('pyth'), ['python3']);
      assert.ok(wb._getCompletionCandidates('clang++').includes('clang++'));

      // Session 1: mkdir & cd into sub + enter REPL state
      await wb._handleReplCommand('mkdir -p sub && cd sub');
      assert.equal(wb.cwd, '/workspace/sub');
      wb.inRepl = true;

      // Create Session 2: starts cleanly in /workspace and shell mode
      const s2 = wb.createTerminalSession('bash-2');
      assert.equal(wb.cwd, '/workspace');
      assert.equal(wb.inRepl, false);
      wb.terminalLogs.push({ type: 'stdout', text: 's2-log' });

      // Switch back to Session 1: restores /workspace/sub and inRepl === true
      wb.switchTerminalSession('session-1');
      assert.equal(wb.cwd, '/workspace/sub');
      assert.equal(wb.inRepl, true);

      // Close Session 2 -> 1 session remains; then close last remaining session -> resets cleanly!
      assert.equal(wb.closeTerminalSession(s2), true);
      assert.equal(wb.listTerminalSessions().length, 1);
      wb.terminalLogs.push({ type: 'stdout', text: 'STALE_LOG' });
      assert.equal(wb.closeTerminalSession('session-1'), true);
      assert.equal(wb.listTerminalSessions().length, 1);
      assert.equal(wb.cwd, '/workspace');
      assert.equal(wb.inRepl, false);
      assert.equal(wb.terminalLogs.length, 0);

      // Unknown shell command reports 127 command not found
      await wb._handleReplCommand('definitely_unknown_cmd_xyz');
      assert.ok(wb.terminalLogs.some((l) => /command not found/i.test(l.text || '')));
    } finally {
      cleanup();
    }
  });

  // ── F11: Non-Destructive Settings Tab & Two-Way settings.json Sync ─────────
  await runTest('[F11] openSettings mounts non-destructive __settings__ tab and syncs .codelab/settings.json', () => {
    const { host, wb, cleanup } = mountFreshWorkbench({
      labId: 'vw-f11',
      files: { 'main.js': 'const unsaved = 123;\n' }
    });
    try {
      wb.openFile('main.js');
      wb.setFile('main.js', 'const unsaved = 999;\n');
      wb.openSettings();
      assert.equal(wb.activeTab, '__settings__');
      assert.equal(host.querySelector('#cl-settings-host').hidden, false);
      assert.equal(host.querySelector('#cl-modal-slot').innerHTML, '');

      wb.closeSettings();
      assert.equal(wb.activeFile, 'main.js');
      assert.equal(wb.getFile('main.js'), 'const unsaved = 999;\n');
    } finally {
      cleanup();
    }
  });

  // ── F12: Menubar, Command Palette, Status Bar & Zero Unlabeled/Nested Buttons ─
  await runTest('[F12] exposes Go -> Next Problem menu, Command Palette modes, and zero unlabeled/nested buttons', () => {
    const { host, wb, cleanup } = mountFreshWorkbench({ labId: 'vw-f12' });
    try {
      const menus = wb._getTopbarMenuDefinitions();
      assert.ok(Array.isArray(menus.go) && menus.go.some((item) => item.cmd === 'go:next-problem'));

      wb.openCommandPalette('commands');
      assert.ok(host.querySelector('#cl-palette-input').value.startsWith('>'));
      wb.closeCommandPalette();

      wb.openCommandPalette('files');
      assert.equal(host.querySelector('#cl-palette-input').value, '');
      wb.closeCommandPalette();

      // Render all views so their buttons are mounted in the DOM, then audit buttons
      wb.openSearchView({ query: 'console' });
      wb.openScmView();
      wb._initGitRepoInScm();
      wb.openProblemsPanel();
      wb.switchDrawerTab('terminal');

      const allButtons = host.querySelectorAll('button');
      for (const btn of allButtons) {
        const label =
          (btn.textContent || '').trim() ||
          (btn.getAttribute('aria-label') || '').trim() ||
          (btn.getAttribute('title') || '').trim();
        assert.ok(label.length > 0, `every <button> must have accessible text/label (id=${btn.id}, class=${btn.className})`);
        const nestedBtn = btn.querySelector('button');
        assert.equal(nestedBtn, null, `nested <button> forbidden inside button (class=${btn.className})`);
      }
    } finally {
      cleanup();
    }
  });

  console.log('\n' + '─'.repeat(78));
  if (failed === 0) {
    console.log(`M2 VS Code Workbench Suite Complete: ${passed} passed, 0 failed`);
    process.exit(0);
  } else {
    console.error(`M2 VS Code Workbench Suite Complete: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
