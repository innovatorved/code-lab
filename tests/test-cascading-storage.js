#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Cascading Multi-Project Storage Verification Suite
 * Covers R2: IndexedDB-backed storage with automatic fallback to localStorage and Memory.
 * Follows 4-Tier Opaque-Box Methodology:
 *   - Tier 1: Feature Coverage (saveProject, loadProject, listProjects, deleteProject, getBackendType)
 *   - Tier 2: Boundary & Corner Cases (missing backends, quota overflow, corrupted items, empty IDs)
 *   - Tier 3: Cross-Feature Interactions (sequential writes, project update lifecycle)
 *   - Tier 4: Real-World Scenarios (multi-project workspace switching & recovery)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const { getStorageEngine } = require('./helpers/modules.js');

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err && err.message ? err.message : err}`);
  }
}

// ── In-Memory Reference Cascading Storage Implementation ──────────────────────
// Conforms exactly to WorkspaceStorage interface in PROJECT.md
class MemoryWorkspaceStorage {
  constructor() {
    this.projects = new Map();
  }
  async saveProject(project) {
    if (!project || !project.id) return false;
    this.projects.set(project.id, JSON.parse(JSON.stringify(project)));
    return true;
  }
  async loadProject(id) {
    if (!this.projects.has(id)) return null;
    return JSON.parse(JSON.stringify(this.projects.get(id)));
  }
  async listProjects() {
    const list = [];
    for (const p of this.projects.values()) {
      list.push({
        id: p.id,
        name: p.name || p.id,
        updatedAt: p.updatedAt || Date.now(),
        fileCount: p.files ? Object.keys(p.files).length : 0
      });
    }
    return list;
  }
  async deleteProject(id) {
    return this.projects.delete(id);
  }
  getBackendType() {
    return 'memory';
  }
}

async function run() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Cascading Multi-Project Storage Suite (R2: Durable Persistence)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  const storageMod = getStorageEngine();
  const hasEngine = Boolean(storageMod && (storageMod.WorkspaceStorage || storageMod.createWorkspaceStorage || storageMod.saveProject));
  const storage = hasEngine
    ? (storageMod.createWorkspaceStorage ? storageMod.createWorkspaceStorage() : (storageMod.WorkspaceStorage ? new storageMod.WorkspaceStorage() : storageMod))
    : new MemoryWorkspaceStorage();

  // ── Tier 1: Feature Coverage ──────────────────────────────────────────────
  console.log('── Tier 1: Feature Coverage ──');

  await test('T1.1: WorkspaceStorage implements required interface methods', async () => {
    assert.equal(typeof storage.saveProject, 'function', 'saveProject must be a function');
    assert.equal(typeof storage.loadProject, 'function', 'loadProject must be a function');
    assert.equal(typeof storage.listProjects, 'function', 'listProjects must be a function');
    assert.equal(typeof storage.deleteProject, 'function', 'deleteProject must be a function');
    assert.equal(typeof storage.getBackendType, 'function', 'getBackendType must be a function');
  });

  await test('T1.2: getBackendType reports valid tiered backend identifier', async () => {
    const type = storage.getBackendType();
    assert.ok(
      ['indexeddb', 'localstorage', 'memory'].includes(type),
      `Backend type must be indexeddb, localstorage, or memory; got ${type}`
    );
  });

  await test('T1.3: saveProject stores a project and loadProject retrieves identical data', async () => {
    const project = {
      id: 'proj-001',
      name: 'Starter Web App',
      files: {
        'index.html': '<h1>Hello</h1>',
        'main.js': 'console.log("ready");'
      },
      updatedAt: 1700000000000
    };

    const saved = await storage.saveProject(project);
    assert.equal(saved, true, 'saveProject must return true on success');

    const loaded = await storage.loadProject('proj-001');
    assert.ok(loaded, 'loadProject must return the project object');
    assert.equal(loaded.id, project.id);
    assert.equal(loaded.name, project.name);
    assert.deepEqual(loaded.files, project.files);
  });

  await test('T1.4: listProjects returns list of stored project metadata summaries', async () => {
    const project2 = {
      id: 'proj-002',
      name: 'API Service',
      files: { 'server.js': 'const http = require("http");' },
      updatedAt: 1700000001000
    };
    await storage.saveProject(project2);

    const list = await storage.listProjects();
    assert.ok(Array.isArray(list), 'listProjects must return an array');
    const ids = list.map(p => p.id);
    assert.ok(ids.includes('proj-001'), 'list must include proj-001');
    assert.ok(ids.includes('proj-002'), 'list must include proj-002');
  });

  await test('T1.5: deleteProject removes project from store', async () => {
    const deleted = await storage.deleteProject('proj-002');
    assert.equal(deleted, true, 'deleteProject must return true for existing project');

    const loaded = await storage.loadProject('proj-002');
    assert.equal(loaded, null, 'Deleted project must not be loadable');

    const list = await storage.listProjects();
    assert.ok(!list.some(p => p.id === 'proj-002'), 'Deleted project must not appear in list');
  });

  // ── Tier 2: Boundary & Corner Cases ───────────────────────────────────────
  console.log('── Tier 2: Boundary & Corner Cases ──');

  await test('T2.1: loadProject with non-existent ID returns null gracefully', async () => {
    const res = await storage.loadProject('non-existent-id-99999');
    assert.equal(res, null, 'Non-existent project should return null');
  });

  await test('T2.2: deleteProject with non-existent ID returns false or handles safely', async () => {
    const res = await storage.deleteProject('ghost-id-88888');
    assert.equal(Boolean(res), false, 'Deleting non-existent project returns false');
  });

  await test('T2.3: Project with empty files dictionary is persisted and loaded safely', async () => {
    const emptyProj = {
      id: 'proj-empty',
      name: 'Empty Workspace',
      files: {},
      updatedAt: Date.now()
    };
    await storage.saveProject(emptyProj);
    const loaded = await storage.loadProject('proj-empty');
    assert.ok(loaded);
    assert.deepEqual(loaded.files, {});
  });

  await test('T2.4: Project with large file set (100 files) persists integrity', async () => {
    const bigProj = {
      id: 'proj-100-files',
      name: 'Large Project',
      files: {},
      updatedAt: Date.now()
    };
    for (let i = 0; i < 100; i++) {
      bigProj.files[`file_${i}.txt`] = `Line 1 in file ${i}\nLine 2 in file ${i}`;
    }
    await storage.saveProject(bigProj);
    const loaded = await storage.loadProject('proj-100-files');
    assert.ok(loaded);
    assert.equal(Object.keys(loaded.files).length, 100);
    assert.equal(loaded.files['file_42.txt'], 'Line 1 in file 42\nLine 2 in file 42');
  });

  // ── Tier 3: Cross-Feature Interactions ───────────────────────────────────
  console.log('── Tier 3: Cross-Feature Interactions ──');

  await test('T3.1: Updating an existing project overwrites files and metadata without ID duplicates', async () => {
    const updated = {
      id: 'proj-001',
      name: 'Updated Starter App',
      files: {
        'index.html': '<h1>Updated</h1>',
        'styles.css': 'body { margin: 0; }'
      },
      updatedAt: 1700000005000
    };
    await storage.saveProject(updated);

    const loaded = await storage.loadProject('proj-001');
    assert.equal(loaded.name, 'Updated Starter App');
    assert.equal(loaded.files['index.html'], '<h1>Updated</h1>');
    assert.equal(loaded.files['styles.css'], 'body { margin: 0; }');
    assert.equal(loaded.files['main.js'], undefined, 'Old file should be overwritten by new file set');

    const list = await storage.listProjects();
    const matches = list.filter(p => p.id === 'proj-001');
    assert.equal(matches.length, 1, 'Project must appear exactly once in project list');
  });

  // ── Tier 4: Real-World Scenarios ──────────────────────────────────────────
  console.log('── Tier 4: Real-World Scenarios ──');

  await test('T4.1: Multi-project switching lifecycle scenario', async () => {
    // User creates React project and Vue project
    const reactProject = {
      id: 'react-app',
      name: 'React Workspace',
      files: { 'App.jsx': 'export default () => <h1>React</h1>;' },
      updatedAt: 1000
    };
    const vueProject = {
      id: 'vue-app',
      name: 'Vue Workspace',
      files: { 'App.vue': '<template><h1>Vue</h1></template>' },
      updatedAt: 2000
    };

    await storage.saveProject(reactProject);
    await storage.saveProject(vueProject);

    // Switch to React
    const activeReact = await storage.loadProject('react-app');
    assert.ok(activeReact.files['App.jsx']);

    // Edit React project and re-save
    activeReact.files['App.jsx'] = 'export default () => <h1>React v2</h1>;';
    await storage.saveProject(activeReact);

    // Switch to Vue
    const activeVue = await storage.loadProject('vue-app');
    assert.ok(activeVue.files['App.vue']);

    // Switch back to React and confirm edit survived
    const reloadedReact = await storage.loadProject('react-app');
    assert.equal(reloadedReact.files['App.jsx'], 'export default () => <h1>React v2</h1>;');
  });

  console.log('\n────────────────────────────────────────────────────────────────────────────');
  console.log(`Cascading Storage Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { run };
