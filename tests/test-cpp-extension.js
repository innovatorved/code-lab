#!/usr/bin/env node
'use strict';

/**
 * Real C++20 in WebAssembly (`wasi_snapshot_preview1`) & Modular Language Extensions Suite
 *
 * Exercises:
 * 1. `VirtualWasi` (`createVirtualWasi` & `executeWasiModule`):
 *    - Real WebAssembly binary instantiation (`_start`)
 *    - `fd_write` (stdout & stderr), `fd_read` (stdin)
 *    - `args_sizes_get` / `args_get`, `environ_sizes_get` / `environ_get`
 *    - `path_open`, `fd_write`, `fd_read`, `fd_seek`, `fd_close`, `path_unlink_file` on `VirtualFS`
 *    - `proc_exit` non-zero exit codes (`WasiExitSignal`)
 *    - `__CODELAB_TEST__:{json}` structured assertion telemetry from WASI stdout
 * 2. TAR archive creation/extraction (`createTarArchive`, `extractTarToVfs`) & C++ header seeding (`seedCppHeadersIntoVfs`):
 *    - `<bits/stdc++.h>`, `<codelab/dsa.hpp>`, `<codelab/test.hpp>`, and custom `extraHeaders`
 * 3. `CppToolchainManager` compilation pipeline:
 *    - `parseCppCompilerFlags` (`-std=c++20`, `-O2`, `-o`, `-I`, `--version`, `--help`)
 *    - 2-stage WASI Clang + LLD (`clang.wasm` -> `.o` -> `lld.wasm` -> `.wasm`)
 *    - Missing source file & non-zero compiler diagnostic handling
 * 4. POSIX Shell C++ toolchain (`g++`, `clang++`, `c++`, `./a.out < input.txt > output.txt`)
 * 5. Modular Language Extensions (`javascriptExtension`, `typescriptExtension`, `cppExtension`):
 *    - Zero-dependency JS + Node/Bun enabled by default (`['js']`)
 *    - Opt-in `typescriptExtension` (`['js', 'ts']`)
 *    - Opt-in `cppExtension` (`['js', 'ts', 'cpp']`), language switching (`setLanguage`), `runDemo()`, `runTests()`, and Guided Lab step verification
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCodeLab, runtime, shell, schemas, DIST } = require('./helpers/load');

const CodeLab = loadCodeLab();
const jsExtMod = require(path.join(DIST, 'extensions', 'javascript.js'));
const tsExtMod = require(path.join(DIST, 'extensions', 'typescript.js'));
const cppExtMod = require(path.join(DIST, 'extensions', 'cpp.js'));

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err && err.message ? err.message : err}`);
  }
}

// ── Minimal WebAssembly Binary Builder for WASI Tests ────────────────────────

function uleb128(val) {
  const out = [];
  let v = val >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

function sleb128(val) {
  const out = [];
  let v = val | 0;
  let more = true;
  while (more) {
    let byte = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (byte & 0x40) === 0) || (v === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    out.push(byte);
  }
  return out;
}

function encodeStr(str) {
  const bytes = Array.from(Buffer.from(str, 'utf8'));
  return [...uleb128(bytes.length), ...bytes];
}

function section(id, payload) {
  return [id, ...uleb128(payload.length), ...payload];
}

/**
 * Builds a valid WASI WebAssembly binary that writes `stdoutText` to fd 1 (and optionally
 * `stderrText` to fd 2) using `wasi_snapshot_preview1.fd_write`, and then calls `proc_exit(exitCode)`.
 */
function buildWasiPrintWasm(stdoutText, exitCode = 0, stderrText = '') {
  const outBytes = Array.from(Buffer.from(stdoutText, 'utf8'));
  const errBytes = Array.from(Buffer.from(stderrText, 'utf8'));

  // Type section:
  // type 0: (i32, i32, i32, i32) -> i32   [fd_write]
  // type 1: (i32) -> ()                   [proc_exit]
  // type 2: () -> ()                      [_start]
  const typeSection = section(1, [
    3,
    0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f,
    0x60, 1, 0x7f, 0,
    0x60, 0, 0
  ]);

  // Import section:
  // func 0: wasi_snapshot_preview1.fd_write (type 0)
  // func 1: wasi_snapshot_preview1.proc_exit (type 1)
  const importSection = section(2, [
    2,
    ...encodeStr('wasi_snapshot_preview1'),
    ...encodeStr('fd_write'),
    0x00, 0,
    ...encodeStr('wasi_snapshot_preview1'),
    ...encodeStr('proc_exit'),
    0x00, 1
  ]);

  // Function section: 1 function (_start -> type 2)
  const funcSection = section(3, [1, 2]);

  // Memory section: 1 memory, min 1 page
  const memSection = section(5, [1, 0x00, 1]);

  // Export section: memory ("memory") + func 2 ("_start")
  const exportSection = section(7, [
    2,
    ...encodeStr('memory'), 0x02, 0,
    ...encodeStr('_start'), 0x00, 2
  ]);

  // Memory layout:
  // [0..3]: iovec.buf_ptr = 64
  // [4..7]: iovec.buf_len = outBytes.length
  // [8..11]: err_iovec.buf_ptr = 64 + outBytes.length
  // [12..15]: err_iovec.buf_len = errBytes.length
  // [16..19]: nwritten
  // [64..]: outBytes + errBytes
  const body = [
    0, // 0 locals
    // Store iovec[0] at offset 0: ptr=64, len=outBytes.length
    0x41, ...sleb128(0),
    0x41, ...sleb128(64),
    0x36, 2, 0, // i32.store
    0x41, ...sleb128(4),
    0x41, ...sleb128(outBytes.length),
    0x36, 2, 0, // i32.store
    // Call fd_write(1, 0, 1, 16)
    0x41, ...sleb128(1),
    0x41, ...sleb128(0),
    0x41, ...sleb128(1),
    0x41, ...sleb128(16),
    0x10, 0, // call func 0 (fd_write)
    0x1a // drop
  ];

  if (errBytes.length > 0) {
    body.push(
      0x41, ...sleb128(8),
      0x41, ...sleb128(64 + outBytes.length),
      0x36, 2, 0,
      0x41, ...sleb128(12),
      0x41, ...sleb128(errBytes.length),
      0x36, 2, 0,
      // Call fd_write(2, 8, 1, 16)
      0x41, ...sleb128(2),
      0x41, ...sleb128(8),
      0x41, ...sleb128(1),
      0x41, ...sleb128(16),
      0x10, 0,
      0x1a
    );
  }

  if (exitCode !== 0) {
    body.push(
      0x41, ...sleb128(exitCode),
      0x10, 1 // call func 1 (proc_exit)
    );
  }

  body.push(0x0b); // end

  const codeSection = section(10, [1, ...uleb128(body.length), ...body]);

  const combinedData = [...outBytes, ...errBytes];
  const dataSection = section(11, [
    1,
    0x00,
    0x41, ...sleb128(64), 0x0b,
    ...uleb128(combinedData.length),
    ...combinedData
  ]);

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...memSection,
    ...exportSection,
    ...codeSection,
    ...dataSection
  ]);
}

/**
 * Builds a WASI WebAssembly binary that reads up to 64 bytes from stdin (fd 0) via `fd_read`
 * and echoes them directly to stdout (fd 1) via `fd_write`.
 */
function buildWasiEchoStdinWasm() {
  // type 0: (i32, i32, i32, i32) -> i32  [fd_read, fd_write]
  // type 1: () -> ()                     [_start]
  const typeSection = section(1, [
    2,
    0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f,
    0x60, 0, 0
  ]);

  const importSection = section(2, [
    2,
    ...encodeStr('wasi_snapshot_preview1'),
    ...encodeStr('fd_read'),
    0x00, 0,
    ...encodeStr('wasi_snapshot_preview1'),
    ...encodeStr('fd_write'),
    0x00, 0
  ]);

  const funcSection = section(3, [1, 1]);
  const memSection = section(5, [1, 0x00, 1]);
  const exportSection = section(7, [
    2,
    ...encodeStr('memory'), 0x02, 0,
    ...encodeStr('_start'), 0x00, 2
  ]);

  // Memory layout:
  // [0..3]: iov.buf = 128
  // [4..7]: iov.len = 64 (updated to nread at [16..19] before fd_write)
  // [16..19]: nread / nwritten
  const body = [
    0,
    0x41, ...sleb128(0),
    0x41, ...sleb128(128),
    0x36, 2, 0,
    0x41, ...sleb128(4),
    0x41, ...sleb128(64),
    0x36, 2, 0,
    // fd_read(0, 0, 1, 16)
    0x41, ...sleb128(0),
    0x41, ...sleb128(0),
    0x41, ...sleb128(1),
    0x41, ...sleb128(16),
    0x10, 0,
    0x1a,
    // Copy nread from [16] into iov.len at [4]
    0x41, ...sleb128(4),
    0x41, ...sleb128(16),
    0x28, 2, 0, // i32.load
    0x36, 2, 0, // i32.store
    // fd_write(1, 0, 1, 20)
    0x41, ...sleb128(1),
    0x41, ...sleb128(0),
    0x41, ...sleb128(1),
    0x41, ...sleb128(20),
    0x10, 1,
    0x1a,
    0x0b
  ];

  const codeSection = section(10, [1, ...uleb128(body.length), ...body]);

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...typeSection,
    ...importSection,
    ...funcSection,
    ...memSection,
    ...exportSection,
    ...codeSection
  ]);
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Real C++20 in WebAssembly (WASI) & Modular Language Extensions Suite');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ── 1. VirtualWasi & executeWasiModule ────────────────────────────────────
  console.log('--- 1. VirtualWasi (wasi_snapshot_preview1) & WebAssembly Execution ---');

  await test('1.1 executeWasiModule runs a real WebAssembly binary and captures stdout', async () => {
    const vfs = runtime.createVirtualFs();
    const wasmBytes = buildWasiPrintWasm('Hello from Real C++20 WASI!\n', 0);
    let out = '';
    const res = await runtime.executeWasiModule(wasmBytes, {
      vfs,
      args: ['a.out'],
      onStdout: (s) => { out += s; }
    });
    assert.equal(res.exitCode, 0);
    assert.equal(out, 'Hello from Real C++20 WASI!\n');
    assert.equal(res.stdout, 'Hello from Real C++20 WASI!\n');
  });

  await test('1.2 executeWasiModule handles proc_exit with non-zero exit code & stderr', async () => {
    const vfs = runtime.createVirtualFs();
    const wasmBytes = buildWasiPrintWasm('partial output\n', 42, 'fatal assertion error\n');
    const res = await runtime.executeWasiModule(wasmBytes, {
      vfs,
      args: ['a.out']
    });
    assert.equal(res.exitCode, 42);
    assert.equal(res.stdout, 'partial output\n');
    assert.equal(res.stderr, 'fatal assertion error\n');
  });

  await test('1.3 executeWasiModule streams stdin via fd_read to stdout via fd_write', async () => {
    const vfs = runtime.createVirtualFs();
    const wasmBytes = buildWasiEchoStdinWasm();
    const res = await runtime.executeWasiModule(wasmBytes, {
      vfs,
      args: ['echo-stdin'],
      stdin: '5\n10 20 30 40 50\n'
    });
    assert.equal(res.exitCode, 0);
    assert.equal(res.stdout, '5\n10 20 30 40 50\n');
  });

  await test('1.4 createVirtualWasi supports VFS path_open, fd_write, fd_seek, fd_read, and path_unlink_file', () => {
    const vfs = runtime.createVirtualFs();
    const wasi = runtime.createVirtualWasi({
      vfs,
      args: ['prog', '--flag', 'value'],
      env: { USER: 'codelab', LANG: 'C.UTF-8' }
    });
    const mem = new WebAssembly.Memory({ initial: 1 });
    wasi.bindMemory(mem);
    const view = new DataView(mem.buffer);
    const u8 = new Uint8Array(mem.buffer);
    const imp = wasi.wasiImport;

    // args_sizes_get & args_get
    assert.equal(imp.args_sizes_get(0, 4), 0);
    assert.equal(view.getUint32(0, true), 3);
    assert.equal(imp.args_get(16, 64), 0);

    // environ_sizes_get & environ_get
    assert.equal(imp.environ_sizes_get(0, 4), 0);
    assert.equal(view.getUint32(0, true), 2);
    assert.equal(imp.environ_get(16, 128), 0);

    // clock_time_get & random_get
    assert.equal(imp.clock_time_get(0, 0n, 256), 0);
    assert.ok(view.getBigUint64(256, true) > 0n);
    assert.equal(imp.random_get(300, 16), 0);

    // path_open (create /workspace/test-wasi.txt)
    const relPath = 'test-wasi.txt';
    u8.set(Buffer.from(relPath, 'utf8'), 400);
    assert.equal(imp.path_open(3, 0, 400, relPath.length, 1 /* O_CREAT */, 0n, 0n, 0, 500), 0);
    const openedFd = view.getUint32(500, true);
    assert.ok(openedFd >= 5);

    // Write "DSA-WASI" to openedFd
    const payload = Buffer.from('DSA-WASI', 'utf8');
    u8.set(payload, 600);
    view.setUint32(512, 600, true);
    view.setUint32(516, payload.length, true);
    assert.equal(imp.fd_write(openedFd, 512, 1, 520), 0);
    assert.equal(view.getUint32(520, true), payload.length);
    assert.equal(imp.fd_close(openedFd), 0);
    assert.equal(vfs.readFileSync('/workspace/test-wasi.txt', 'utf8'), 'DSA-WASI');

    // Unlink file via path_unlink_file
    assert.equal(imp.path_unlink_file(3, 400, relPath.length), 0);
    assert.equal(vfs.existsSync('/workspace/test-wasi.txt'), false);
  });

  await test('1.5 executeInVirtualRuntime parses __CODELAB_TEST__ JSON lines from WASI .wasm execution', async () => {
    const testOutput = [
      'Running C++20 DSA Suite...',
      '__CODELAB_TEST__:{"name":"Binary Search › finds target in sorted vector","status":"passed","durationMs":1.2}',
      '__CODELAB_TEST__:{"name":"Dijkstra › computes shortest path","status":"passed","durationMs":2.4}',
      ''
    ].join('\n');
    const wasmBytes = buildWasiPrintWasm(testOutput, 0);
    const vfs = runtime.createVirtualFs();
    vfs.writeFileSync('/workspace/a.out', wasmBytes);

    const res = await runtime.executeInVirtualRuntime({
      mode: 'test',
      entry: '/workspace/a.out',
      vfs
    });

    assert.equal(res.ok, true);
    assert.equal(res.testResults.length, 2);
    assert.equal(res.testResults[0].name, 'Binary Search › finds target in sorted vector');
    assert.equal(res.testResults[0].passed, true);
    assert.equal(res.testResults[1].name, 'Dijkstra › computes shortest path');
    // Raw __CODELAB_TEST__ lines should be stripped from user-facing console stdout
    assert.ok(!res.stdout.includes('__CODELAB_TEST__'));
    assert.ok(res.stdout.includes('Running C++20 DSA Suite...'));
  });

  // ── 2. TAR Sysroot Extraction & Built-in C++ Headers ──────────────────────
  console.log('\n--- 2. Sysroot TAR Extraction & Built-in C++ Headers ---');

  await test('2.1 createTarArchive and extractTarToVfs round-trip sysroot headers and libraries', () => {
    const vfs = runtime.createVirtualFs();
    const tarBytes = cppExtMod.createTarArchive({
      'usr/include/c++/v1/vector': '// libc++ <vector>\n#pragma once\n',
      'usr/lib/wasm32-wasi/crt1.o': new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    });

    const extracted = cppExtMod.extractTarToVfs(tarBytes, vfs, '/');
    assert.equal(extracted.length, 2);
    assert.ok(vfs.existsSync('/usr/include/c++/v1/vector'));
    assert.equal(vfs.readFileSync('/usr/include/c++/v1/vector', 'utf8'), '// libc++ <vector>\n#pragma once\n');
    assert.ok(vfs.existsSync('/usr/lib/wasm32-wasi/crt1.o'));
  });

  await test('2.2 seedCppHeadersIntoVfs populates <bits/stdc++.h>, <codelab/dsa.hpp>, and <codelab/test.hpp>', () => {
    const vfs = runtime.createVirtualFs();
    cppExtMod.seedCppHeadersIntoVfs(vfs, {
      'custom/graph.hpp': '#pragma once\nstruct Graph {};\n'
    });

    assert.ok(vfs.existsSync('/usr/include/bits/stdc++.h'));
    assert.ok(vfs.existsSync('/usr/include/codelab/dsa.hpp'));
    assert.ok(vfs.existsSync('/usr/include/codelab/test.hpp'));
    assert.ok(vfs.existsSync('/usr/include/custom/graph.hpp'));

    const dsaHeader = vfs.readFileSync('/usr/include/codelab/dsa.hpp', 'utf8');
    assert.match(dsaHeader, /struct ListNode/);
    assert.match(dsaHeader, /struct TreeNode/);
    assert.match(dsaHeader, /buildLinkedList/);
    assert.match(dsaHeader, /buildBinaryTree/);

    const testHeader = vfs.readFileSync('/usr/include/codelab/test.hpp', 'utf8');
    assert.match(testHeader, /#define DESCRIBE/);
    assert.match(testHeader, /#define TEST/);
    assert.match(testHeader, /#define ASSERT_EQ/);
    assert.match(testHeader, /__CODELAB_TEST__:/);
  });

  // ── 3. CppToolchainManager & Compiler Pipeline ────────────────────────────
  console.log('\n--- 3. CppToolchainManager & Compiler Pipeline ---');

  await test('3.1 parseCppCompilerFlags parses standard, optimization, output, and include flags', () => {
    const parsed = cppExtMod.parseCppCompilerFlags(
      ['-std=c++23', '-O3', '-Wall', '-I/workspace/include', 'src/main.cpp', 'src/utils.cpp', '-o', 'bin/solver'],
      '/workspace'
    );
    assert.equal(parsed.std, 'c++23');
    assert.equal(parsed.optLevel, '-O3');
    assert.equal(parsed.outputPath, '/workspace/bin/solver');
    assert.deepEqual(parsed.sourceFiles, ['/workspace/src/main.cpp', '/workspace/src/utils.cpp']);
    assert.deepEqual(parsed.extraFlags, ['-Wall', '-I/workspace/include']);
  });

  await test('3.2 CppToolchainManager compiles C++ sources and produces executable .wasm binary', async () => {
    const vfs = runtime.createVirtualFs();
    vfs.mkdirSync('/workspace/src', { recursive: true });
    vfs.writeFileSync(
      '/workspace/src/main.cpp',
      '#include <bits/stdc++.h>\nint main() { std::cout << "Kruskal MST weight = 14\\n"; return 0; }\n'
    );

    const progressEvents = [];
    const expectedWasm = buildWasiPrintWasm('Kruskal MST weight = 14\n', 0);

    const toolchain = new cppExtMod.CppToolchainManager({
      std: 'c++20',
      onProgress: (ev) => progressEvents.push(ev),
      compilerHook: async (req) => {
        const src = req.vfs.readFileSync(req.sourceFiles[0], 'utf8');
        assert.match(src, /Kruskal MST/);
        req.vfs.writeFileSync(req.outputPath, expectedWasm);
        return {
          ok: true,
          exitCode: 0,
          wasmBinary: expectedWasm,
          outputPath: req.outputPath,
          stdout: '',
          stderr: ''
        };
      }
    });

    const compileRes = await toolchain.compile({
      entry: '/workspace/src/main.cpp',
      outputPath: '/workspace/a.out',
      vfs
    });

    assert.equal(compileRes.ok, true);
    assert.equal(compileRes.exitCode, 0);
    assert.ok(vfs.existsSync('/workspace/a.out'));

    // Register toolchain on runtime so `.cpp` entry compiles & runs automatically
    cppExtMod.registerCppCompilerOnRuntime(toolchain);
    const directCppRes = await runtime.executeInVirtualRuntime({
      mode: 'run',
      entry: '/workspace/src/main.cpp',
      vfs
    });
    assert.equal(directCppRes.ok, true);
    assert.ok(directCppRes.stdout.includes('Kruskal MST weight = 14'));
  });

  await test('3.3 CppToolchainManager reports clear compiler errors when source file is missing or invalid', async () => {
    const vfs = runtime.createVirtualFs();
    const toolchain = new cppExtMod.CppToolchainManager({});
    const res = await toolchain.compile({
      entry: '/workspace/src/nonexistent.cpp',
      vfs
    });
    assert.equal(res.ok, false);
    assert.equal(res.exitCode, 1);
    assert.match(res.stderr, /no such file or directory/);
  });

  // ── 4. POSIX Shell g++ / clang++ / c++ & ./a.out Redirection ──────────────
  console.log('\n--- 4. POSIX Shell g++ / clang++ / c++ & ./a.out Execution ---');

  await test('4.1 POSIX shell supports g++ --version and compiles + runs ./solver with < and > redirection', async () => {
    const vfs = runtime.createVirtualFs();
    vfs.writeFileSync('/workspace/solution.cpp', '#include <iostream>\nint main() { int n; std::cin >> n; std::cout << n * 2 << "\\n"; }\n');
    vfs.writeFileSync('/workspace/input.txt', '21 -> 42\n');

    const echoWasm = buildWasiEchoStdinWasm();
    const toolchain = new cppExtMod.CppToolchainManager({
      compilerHook: async (req) => {
        req.vfs.writeFileSync(req.outputPath, echoWasm);
        return {
          ok: true,
          exitCode: 0,
          wasmBinary: echoWasm,
          outputPath: req.outputPath,
          stdout: '',
          stderr: ''
        };
      }
    });
    cppExtMod.registerCppCompilerOnRuntime(toolchain);

    const sh = shell.createPosixShell({ vfs });

    const verRes = await sh.executeCommand('g++ --version');
    assert.equal(verRes.exitCode, 0);
    assert.match(verRes.stdout, /clang version .* wasm32-unknown-wasi/);

    const buildAndRun = await sh.executeCommand('g++ -std=c++20 -O2 solution.cpp -o solver && ./solver < input.txt > output.txt');
    assert.equal(buildAndRun.exitCode, 0);
    assert.ok(vfs.existsSync('/workspace/solver'));
    assert.ok(vfs.existsSync('/workspace/output.txt'));
    assert.equal(vfs.readFileSync('/workspace/output.txt', 'utf8'), '21 -> 42\n');
  });

  // ── 5. Modular Language Extensions & Workbench Integration ────────────────
  console.log('\n--- 5. Modular Language Extensions (JS default, TS & C++ opt-in) ---');

  await test('5.1 CodeLab.extensions exposes guidedLab, javascript, typescript, and cpp extensions', () => {
    assert.equal(typeof CodeLab.extensions.guidedLab, 'function');
    assert.equal(typeof CodeLab.extensions.javascript, 'function');
    assert.equal(typeof CodeLab.extensions.typescript, 'function');
    assert.equal(typeof CodeLab.extensions.cpp, 'function');
    assert.equal(typeof jsExtMod.javascriptExtension, 'function');
    assert.equal(typeof tsExtMod.typescriptExtension, 'function');
    assert.equal(typeof cppExtMod.cppExtension, 'function');
  });

  await test('5.2 Workbench supports JavaScript by default and enables TS & C++ via .use()', async () => {
    const mockContainer = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      appendChild: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      style: {}
    };
    const wb = new CodeLab.CodeLabWorkbench(mockContainer, {
      id: 'dsa-cpp-lab',
      title: 'Binary Search in C++20',
      mode: 'sandbox'
    });

    // Default: JavaScript enabled out of the box
    assert.ok(wb.enabledLanguages.has('js'));
    assert.equal(wb.enabledLanguages.has('cpp'), false);

    // Enable TypeScript extension
    wb.use(tsExtMod.createTypeScriptExtension());
    assert.ok(wb.enabledLanguages.has('ts'));

    // Enable C++ extension with custom test/demo compiler hook
    const demoWasm = buildWasiPrintWasm('Binary Search index = 3\n', 0);
    const testWasm = buildWasiPrintWasm(
      '__CODELAB_TEST__:{"name":"Binary Search › locates existing key","status":"passed","durationMs":0.8}\n' +
      '__CODELAB_TEST__:{"name":"Binary Search › returns -1 for missing key","status":"passed","durationMs":0.5}\n',
      0
    );

    wb.use(
      cppExtMod.createCppExtension({
        activate: true,
        compilerHook: async (req) => {
          const isTest = req.sourceFiles.some((f) => f.includes('test'));
          const bin = isTest ? testWasm : demoWasm;
          req.vfs.writeFileSync(req.outputPath, bin);
          return {
            ok: true,
            exitCode: 0,
            wasmBinary: bin,
            outputPath: req.outputPath,
            stdout: '',
            stderr: ''
          };
        }
      })
    );

    assert.ok(wb.enabledLanguages.has('cpp'));
    assert.equal(wb.language, 'cpp');
    assert.ok(wb.files['src/main.cpp'] || wb.files['main.cpp']);

    const demoRes = await wb.runDemo();
    assert.equal(demoRes.ok, true);
    assert.ok(demoRes.stdout.includes('Binary Search index = 3'));

    const testRes = await wb.runTests();
    assert.equal(testRes.ok, true);
    assert.equal(testRes.testResults.length, 2);
    assert.equal(testRes.testResults[0].passed, true);
    assert.equal(testRes.testResults[1].passed, true);
  });

  await test('5.3 Zod schemas validate LanguageId ("js" | "ts" | "cpp") and CppExtensionOptions', () => {
    assert.equal(schemas.LanguageIdSchema.parse('js'), 'js');
    assert.equal(schemas.LanguageIdSchema.parse('ts'), 'ts');
    assert.equal(schemas.LanguageIdSchema.parse('cpp'), 'cpp');
    assert.throws(() => schemas.LanguageIdSchema.parse('python'));

    const parsedCppOpts = schemas.CppExtensionOptionsSchema.parse({
      std: 'c++20',
      cacheInIndexedDB: true
    });
    assert.equal(parsedCppOpts.std, 'c++20');
    assert.equal(parsedCppOpts.optLevel, '-O2');
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`C++20 WASI & Language Extensions Suite Complete: ${passed} passed, ${failures.length} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`\n[${f.name}]`);
      console.error(f.err && f.err.stack ? f.err.stack : f.err);
    }
    process.exit(1);
  }
}

main();
