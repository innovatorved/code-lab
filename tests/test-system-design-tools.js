'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * System Design Tooling & Chaos Engineering — Verification Suite
 *
 * Verifies:
 *   A. VirtualPortTable Chaos Engine (latencyMs, errorRate, crashed, partitionFromPorts, dropRate).
 *   B. File-backed & In-Memory SQLite Engine (VFS persistence, CREATE INDEX, EXPLAIN QUERY PLAN, PRAGMA).
 *   C. System Design Shell Coreutils (hey/ab/wrk, chaos, sqlite3, redis-cli).
 *   D. Workbench Live SLO Telemetry Bar, Service Topology Map & 1-Click Chaos Controls.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const { doc, localStorageStore } = require('./helpers/mock-dom.js');
const runtime = require('./helpers/load').runtime;
const shellMod = require('./helpers/load').shell;
const CodeLabSDK = require('./helpers/load').workbench;
const { CodeLabWorkbench } = CodeLabSDK;

function makeContainer() {
  localStorageStore.clear();
  const container = doc.createElement('div');
  container.setAttribute('id', 'sd-tools-test-root');
  return container;
}

async function runSuite() {
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

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   System Design Tooling: Chaos Engine, Load Tester, SQLite & Redis CLI');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- Suite A: VirtualPortTable Chaos & Fault Injection Engine ---');

  await test('A1 setChaosRule, getChaosRule, listChaosRules, clearChaosRules lifecycle', () => {
    const pt = runtime.createVirtualPortTable();
    assert.equal(typeof pt.setChaosRule, 'function');
    const rule = pt.setChaosRule(3001, { latencyMs: 120, jitterMs: 30, errorRate: 0.25, errorStatus: 503 });
    assert.equal(rule.port, 3001);
    assert.equal(rule.latencyMs, 120);
    assert.equal(rule.errorRate, 0.25);
    assert.equal(pt.listChaosRules().length, 1);
    pt.clearChaosRules(3001);
    assert.equal(pt.listChaosRules().length, 0);
  });

  await test('A2 crashed rule rejects dispatchRequest with ECONNREFUSED and chaosEffect="CRASHED"', async () => {
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(3001, { name: 'http', fetch: async () => new Response('ok', { status: 200 }) });
    pt.setChaosRule(3001, { crashed: true });
    await assert.rejects(
      async () => pt.dispatchRequest('http://localhost:3001/', { method: 'GET' }),
      (err) => err && err.code === 'ECONNREFUSED' && err.chaosEffect === 'CRASHED'
    );
  });

  await test('A3 partitionFromPorts blocks traffic from partitioned source port with EHOSTUNREACH', async () => {
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(3002, { name: 'http', fetch: async () => new Response('ok', { status: 200 }) });
    pt.setChaosRule(3002, { partitionFromPorts: [3000] });

    // Traffic from 3000 is partitioned
    await assert.rejects(
      async () => pt.dispatchRequest('http://localhost:3002/', { method: 'GET', _fromPort: 3000 }),
      (err) => err && err.code === 'EHOSTUNREACH' && /PARTITION/.test(err.chaosEffect)
    );

    // Direct traffic from client (no _fromPort) still succeeds
    const res = await pt.dispatchRequest('http://localhost:3002/', { method: 'GET' });
    assert.equal(res.status, 200);
  });

  await test('A4 errorRate=1 injects HTTP 503 fault response with x-codelab-chaos header', async () => {
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(3003, { name: 'http', fetch: async () => new Response('ok', { status: 200 }) });
    pt.setChaosRule(3003, { errorRate: 1.0, statusCode: 503 });
    const res = await pt.dispatchRequest('http://localhost:3003/health', { method: 'GET' });
    assert.equal(res.status, 503);
    assert.equal(res._chaosEffect, 'ERROR_503');
    assert.equal(res.headers.get('x-codelab-chaos'), 'ERROR_503');
  });

  await test('A5 latencyMs delays dispatchRequest by at least the configured latency', async () => {
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(3004, { name: 'http', fetch: async () => new Response('delayed', { status: 200 }) });
    pt.setChaosRule(3004, { latencyMs: 45 });
    const start = Date.now();
    const res = await pt.dispatchRequest('http://localhost:3004/', { method: 'GET' });
    const elapsed = Date.now() - start;
    assert.equal(res.status, 200);
    assert.ok(elapsed >= 35, `expected >=35ms delay, got ${elapsed}ms`);
  });

  console.log('\n--- Suite B: VFS-Backed SQLite Engine (CREATE INDEX, EXPLAIN, PRAGMA) ---');

  await test('B1 file-backed Database persists tables and indexes to VFS and reloads across instances', () => {
    const vfs = runtime.createVirtualFs({ '/workspace/readme.txt': 'hi' });
    const SqliteDatabase = runtime.createSqliteDatabase(vfs, () => '/workspace');
    const db1 = new SqliteDatabase('cluster.db');
    db1.exec('CREATE TABLE urls (code TEXT PRIMARY KEY, target TEXT, hits INTEGER DEFAULT 0)');
    db1.exec('CREATE INDEX idx_urls_target ON urls (target)');
    db1.exec("INSERT INTO urls (code, target, hits) VALUES ('sd', 'https://system-design-in-depth.vedgupta.in', 42), ('cl', 'https://code-lab-3dr.pages.dev', 7)");

    // Verify file exists in VFS
    assert.ok(vfs.existsSync('/workspace/cluster.db'));

    // Open a brand new Database instance backed by the same VFS file
    const db2 = new SqliteDatabase('/workspace/cluster.db');
    const row = db2.query('SELECT code, target, hits FROM urls WHERE code = ?').get('sd');
    assert.equal(row.code, 'sd');
    assert.equal(row.hits, 42);

    // Verify EXPLAIN QUERY PLAN reports the secondary index
    const plan = db2.query("EXPLAIN QUERY PLAN SELECT * FROM urls WHERE target = 'https://code-lab-3dr.pages.dev'").all();
    assert.ok(plan.length > 0);
    assert.match(plan[0].detail, /idx_urls_target/);

    // Verify PRAGMA index_list and table_info
    const cols = db2.query('PRAGMA table_info(urls)').all();
    assert.equal(cols.length, 3);
    const idxs = db2.query('PRAGMA index_list(urls)').all();
    assert.equal(idxs.length, 1);
    assert.equal(idxs[0].name, 'idx_urls_target');
  });

  console.log('\n--- Suite C: System Design Shell Coreutils (hey, chaos, sqlite3, redis-cli) ---');

  await test('C1 hey load generator benchmarks virtual HTTP server and prints latency histogram', async () => {
    const vfs = runtime.createVirtualFs({});
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(4000, {
      name: 'http',
      fetch: async (req) => new Response(JSON.stringify({ ok: true, url: req.url }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    });
    const sh = shellMod.createPosixShell({ vfs, portTable: pt });
    const res = await sh.execute('hey -n 20 -c 5 http://localhost:4000/api/ping');
    assert.equal(res.exitCode, 0);
    assert.match(res.stdout, /Requests\/sec:/);
    assert.match(res.stdout, /Latency distribution:/);
    assert.match(res.stdout, /\(p99\)/);
    assert.match(res.stdout, /\[200\]\s+20 responses/);
  });

  await test('C2 chaos CLI configures and resets VirtualPortTable fault rules', async () => {
    const vfs = runtime.createVirtualFs({});
    const pt = runtime.createVirtualPortTable();
    pt.registerServer(4001, { name: 'http', fetch: async () => new Response('ok', { status: 200 }) });
    const sh = shellMod.createPosixShell({ vfs, portTable: pt });

    await sh.execute('chaos latency 4001 150 --jitter 25');
    assert.equal(pt.getChaosRule(4001).latencyMs, 150);

    await sh.execute('chaos crash 4001');
    assert.equal(pt.getChaosRule(4001).crashed, true);

    const statusRes = await sh.execute('chaos status');
    assert.match(statusRes.stdout, /:4001/);
    assert.match(statusRes.stdout, /CRASHED/);

    await sh.execute('chaos reset');
    assert.equal(pt.listChaosRules().length, 0);
  });

  await test('C3 sqlite3 CLI executes DDL/DML and formats table, json, and csv outputs', async () => {
    const vfs = runtime.createVirtualFs({});
    const pt = runtime.createVirtualPortTable();
    const sh = shellMod.createPosixShell({ vfs, portTable: pt });

    await sh.execute('sqlite3 app.db "CREATE TABLE nodes (id INTEGER PRIMARY KEY, region TEXT, rps INTEGER)"');
    await sh.execute("sqlite3 app.db \"INSERT INTO nodes (region, rps) VALUES ('us-east', 1200), ('eu-west', 850)\"");

    const jsonRes = await sh.execute('sqlite3 --json app.db "SELECT region, rps FROM nodes ORDER BY rps DESC"');
    assert.equal(jsonRes.exitCode, 0);
    const parsed = JSON.parse(jsonRes.stdout);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].region, 'us-east');
    assert.equal(parsed[0].rps, 1200);
  });

  await test('C4 redis-cli supports strings, TTLs, hashes, lists, sets, sorted sets, and token-bucket Lua EVAL', async () => {
    const vfs = runtime.createVirtualFs({});
    const pt = runtime.createVirtualPortTable();
    const sh = shellMod.createPosixShell({ vfs, portTable: pt });

    assert.match((await sh.execute('redis-cli PING')).stdout, /PONG/);
    await sh.execute('redis-cli SET rate:user1 10 EX 60');
    assert.match((await sh.execute('redis-cli INCRBY rate:user1 5')).stdout, /\(integer\) 15/);
    assert.match((await sh.execute('redis-cli GET rate:user1')).stdout, /"15"/);

    await sh.execute('redis-cli ZADD leaderboard 100 alice 250 bob');
    const zrange = await sh.execute('redis-cli ZREVRANGE leaderboard 0 -1 WITHSCORES');
    assert.match(zrange.stdout, /bob/);

    const evalRes = await sh.execute('redis-cli EVAL "token_bucket" 1 bucket:api 5 10');
    assert.match(evalRes.stdout, /1\)\s+\(integer\)\s+1/);
  });

  console.log('\n--- Suite D: Workbench SLO Telemetry Bar & Service Topology ---');

  await test('D1 Workbench Ports & Network panels render SLO metrics, topology edges, and Chaos controls', async () => {
    const container = makeContainer();
    const wb = new CodeLabWorkbench(container, {
      labId: 'sd-workbench-test',
      persistState: false,
      files: { 'demo.js': 'console.log("ok");' }
    });

    wb.portTable.registerServer(3000, {
      name: 'gateway',
      fetch: async () => {
        // Forward to 3001 to create a multi-hop service topology edge (:3000 -> :3001)
        const up = await wb.portTable.dispatchRequest('http://localhost:3001/work', { method: 'GET', _fromPort: 3000 });
        return new Response(await up.text(), { status: up.status });
      }
    });
    wb.portTable.registerServer(3001, {
      name: 'worker-1',
      fetch: async () => new Response('worker-ok', { status: 200 })
    });

    await wb.portTable.dispatchRequest('http://localhost:3000/api', { method: 'GET' });

    const portsBody = doc.createElement('div');
    wb._renderPortsPanel(portsBody);
    const portsHtml = portsBody.innerHTML;
    assert.match(portsHtml, /chaos-latency/);
    assert.match(portsHtml, /chaos-error/);
    assert.match(portsHtml, /chaos-crash/);

    const netBody = doc.createElement('div');
    wb._renderNetworkPanel(netBody);
    const netHtml = netBody.innerHTML;
    assert.match(netHtml, /codelab-slo-bar/);
    assert.match(netHtml, /2xx SLO/);
    assert.match(netHtml, /run-quick-loadtest/);
    assert.match(netHtml, /codelab-topo-bar/);
    assert.match(netHtml, /:3000→:3001/);

    wb.destroy();
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`System Design Tooling Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
