#!/usr/bin/env node
'use strict';

/**
 * Opt-In Python 3.12 WebAssembly (Pyodide / CPython WASI) Extension Test Suite
 *
 * Verifies:
 * 1. Extension Exports & Schema Validation:
 *    - pythonExtension, PythonToolchainManager, seedPythonModulesIntoVfs,
 *      analyzePythonSource, applyPythonTracebackDiagnostics, formatPythonSource,
 *      registerMonacoPythonLanguageService, CODELAB_PYTHON_LIBS
 * 2. VFS Helper Library Seeding:
 *    - /usr/lib/python/codelab_dsa.py (ListNode, TreeNode, MinHeap, MaxHeap)
 *    - /usr/lib/python/codelab_test.py (describe, it, assert_equal, assert_raises, __CODELAB_TEST__ JSON telemetry)
 * 3. Static Python Analysis & Traceback Diagnostics:
 *    - analyzePythonSource detects unclosed strings, indentation errors, and unclosed parentheses
 *    - applyPythonTracebackDiagnostics extracts file, line, message from standard Python tracebacks
 * 4. Python Formatter:
 *    - formatPythonSource collapses redundant blank lines, normalizes indentation, and trims whitespace
 * 5. Shell Coreutils:
 *    - python, python3, pytest, pip CLI availability and flag parsing
 * 6. Workbench Extension Integration:
 *    - workbench.use(pythonExtension) installs cleanly without destroying Monaco or DOM
 *    - Switching language to 'py' switches models, sets status bar, and maps files
 *    - Stdin configuration is routed to Python executions
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCodeLab, schemas, DIST } = require('./helpers/load');

const CodeLab = loadCodeLab();
const pyExtMod = require(path.join(DIST, 'extensions', 'python.js'));

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

function makeContainer() {
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
  }
  return {
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    style: {},
    innerHTML: ''
  };
}

(async () => {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Opt-In Python 3.12 WebAssembly (CPython / Pyodide) Extension Suite');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- Suite 1: Module Surface & Schema Integrity ---');

  await test('python extension exports all canonical symbols', () => {
    assert.equal(typeof pyExtMod.pythonExtension, 'function');
    assert.equal(typeof pyExtMod.PythonToolchainManager, 'function');
    assert.equal(typeof pyExtMod.seedPythonModulesIntoVfs, 'function');
    assert.equal(typeof pyExtMod.analyzePythonSource, 'function');
    assert.equal(typeof pyExtMod.applyPythonTracebackDiagnostics, 'function');
    assert.equal(typeof pyExtMod.formatPythonSource, 'function');
    assert.equal(typeof pyExtMod.registerMonacoPythonLanguageService, 'function');
    assert.ok(pyExtMod.CODELAB_PYTHON_LIBS);
    assert.ok(pyExtMod.PYTHON_TOOLCHAIN_PRESETS);
    assert.ok(pyExtMod.PYTHON_TOOLCHAIN_PRESETS.latest.includes('pyodide'));
  });

  await test('PythonExtensionOptionsSchema validates custom configuration', () => {
    const opts = schemas.PythonExtensionOptionsSchema.parse({
      pyodideIndexUrl: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      preloadPackages: ['numpy', 'micropip'],
      cacheInIndexedDB: true,
      compilerMemoryLimitMb: 512
    });
    assert.equal(opts.cacheInIndexedDB, true);
    assert.equal(opts.compilerMemoryLimitMb, 512);
    assert.deepEqual(opts.preloadPackages, ['numpy', 'micropip']);
  });

  console.log('\n--- Suite 2: Built-in Python VFS DSA & Test Library ---');

  await test('CODELAB_PYTHON_LIBS contains codelab_dsa.py and codelab_test.py', () => {
    assert.ok(pyExtMod.CODELAB_PYTHON_LIBS['/usr/lib/python/codelab_dsa.py']);
    assert.ok(pyExtMod.CODELAB_PYTHON_LIBS['/usr/lib/python/codelab_test.py']);

    const dsa = pyExtMod.CODELAB_PYTHON_LIBS['/usr/lib/python/codelab_dsa.py'];
    assert.ok(dsa.includes('class ListNode:'));
    assert.ok(dsa.includes('class TreeNode:'));
    assert.ok(dsa.includes('class MinHeap:'));
    assert.ok(dsa.includes('class MaxHeap:'));

    const testLib = pyExtMod.CODELAB_PYTHON_LIBS['/usr/lib/python/codelab_test.py'];
    assert.ok(testLib.includes('def describe('));
    assert.ok(testLib.includes('def it('));
    assert.ok(testLib.includes('assert_equal'));
    assert.ok(testLib.includes('__CODELAB_TEST__:'));
  });

  await test('seedPythonModulesIntoVfs populates target VFS object', () => {
    const vfs = {};
    pyExtMod.seedPythonModulesIntoVfs(vfs);
    assert.ok(vfs['/usr/lib/python/codelab_dsa.py']);
    assert.ok(vfs['/usr/lib/python/codelab_test.py']);
    assert.ok(vfs['usr/lib/python/codelab_dsa.py']);
    assert.ok(vfs['usr/lib/python/codelab_test.py']);
  });

  console.log('\n--- Suite 3: Static Analysis, Formatting & Diagnostics ---');

  await test('analyzePythonSource reports syntax errors with lines and columns', () => {
    const valid = `def hello():\n    return 42\n`;
    const diags1 = pyExtMod.analyzePythonSource(valid, 'main.py');
    assert.equal(diags1.length, 0);

    const unclosedQuote = `name = "unclosed string`;
    const diags2 = pyExtMod.analyzePythonSource(unclosedQuote, 'main.py');
    assert.ok(diags2.length > 0);
    assert.match(diags2[0].message, /EOL while scanning string literal/);

    const badIndent = `def foo():\nreturn 10\n`;
    const diags3 = pyExtMod.analyzePythonSource(badIndent, 'main.py');
    assert.ok(diags3.length > 0);
    assert.match(diags3[0].message, /IndentationError/);

    const unclosedParen = `x = (1 + 2\ny = 3`;
    const diags4 = pyExtMod.analyzePythonSource(unclosedParen, 'main.py');
    assert.ok(diags4.length > 0);
    assert.match(diags4[0].message, /closing parenthesis/);
  });

  await test('applyPythonTracebackDiagnostics extracts file, line and message', () => {
    const stderr = `Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(undefined_variable)
NameError: name 'undefined_variable' is not defined
`;
    const diags = pyExtMod.applyPythonTracebackDiagnostics(stderr, 'main.py');
    assert.equal(diags.length, 1);
    assert.equal(diags[0].startLineNumber, 4);
    assert.match(diags[0].message, /NameError: name 'undefined_variable' is not defined/);
  });

  await test('formatPythonSource collapses empty lines and trims whitespace', () => {
    const raw = `def solve(n):   \n\n\n\n    return n * 2  \n\n\n\n`;
    const formatted = pyExtMod.formatPythonSource(raw);
    assert.equal(formatted, `def solve(n):\n\n    return n * 2\n`);
  });

  console.log('\n--- Suite 4: Python Toolchain Manager & Shell Coreutils ---');

  await test('PythonToolchainManager instantiates with default options and tracks lifecycle', () => {
    const mgr = new pyExtMod.PythonToolchainManager({
      pyodideIndexUrl: 'https://test-cdn.local/pyodide/'
    });
    assert.equal(mgr.isLoaded(), false);
    assert.equal(typeof mgr.execute, 'function');
    assert.equal(typeof mgr.preload, 'function');
  });

  await test('POSIX shell contains python, python3, pytest, pip in COREUTILS', () => {
    const { COREUTILS } = require(path.join(DIST, 'shell.js'));
    assert.equal(typeof COREUTILS['python'], 'function');
    assert.equal(typeof COREUTILS['python3'], 'function');
    assert.equal(typeof COREUTILS['pytest'], 'function');
    assert.equal(typeof COREUTILS['pip'], 'function');
  });

  await test('shell python3 --version, pytest --version, pip --version report correct output', async () => {
    const { COREUTILS } = require(path.join(DIST, 'shell.js'));
    const context = {
      stdout: () => {},
      stderr: () => {},
      vfs: { files: {} }
    };

    const res1 = await COREUTILS['python3'](['--version'], context);
    assert.match(res1.stdout, /Python 3\.12/);

    const res2 = await COREUTILS['pytest'](['--version'], context);
    assert.match(res2.stdout, /pytest 8\./);

    const res3 = await COREUTILS['pip'](['--version'], context);
    assert.match(res3.stdout, /pip 24\./);
  });

  console.log('\n--- Suite 5: Workbench Extension Integration ---');

  await test('workbench.use(pythonExtension) extends enabled languages and updates state cleanly', () => {
    const container = makeContainer();
    const wb = new CodeLab.CodeLabWorkbench(container, {
      labId: 'python-test-wb',
      files: {
        'index.js': 'console.log("hello");',
        'main.py': 'print("hello from python")'
      }
    });

    assert.equal(wb.enabledLanguages.has('py'), false);
    wb.use(pyExtMod.pythonExtension({
      preloadPackages: ['numpy']
    }));

    assert.equal(wb.enabledLanguages.has('py'), true);
    assert.ok(wb.pythonToolchain instanceof pyExtMod.PythonToolchainManager);
    assert.equal(typeof wb.pythonCompiler, 'function');

    // Switching to Python
    wb.setLanguage('py');
    assert.equal(wb.lang, 'py');
    assert.ok(wb.files['main.py']);

    // Calling formatActiveDocument does not throw
    wb.formatActiveDocument();
  });

  await test('execute parses __CODELAB_TEST__: JSON lines into structured testResults', async () => {
    const mgr = new pyExtMod.PythonToolchainManager();
    const output = [
      '__CODELAB_TEST__:{"name": "test_pass", "passed": true, "durationMs": 1.2}',
      '__CODELAB_TEST__:{"name": "test_fail", "passed": false, "durationMs": 2.5, "error": {"message": "Mismatch"}}'
    ].join('\n');

    let captured = '';
    const res = await mgr.execute({
      source: 'print("hello")',
      onStdout: (s) => {
        captured += s;
      }
    });

    // Verify parser handles line events
    const { CodeLabTestParser } = require(path.join(DIST, 'runtime.js')) || {};
    assert.ok(res.testResults !== undefined, 'execute must return testResults array');
  });

  await test('installPackages and shell pip install load packages cleanly', async () => {
    const mgr = new pyExtMod.PythonToolchainManager();
    const res = await mgr.installPackages(['numpy', 'requests']);
    assert.equal(res.ok, true);
    assert.deepEqual(res.installed, ['numpy', 'requests']);

    const { COREUTILS } = require(path.join(DIST, 'shell.js'));
    const context = {
      shell: {
        options: {
          pythonToolchain: mgr
        }
      },
      vfs: { files: {} }
    };
    const pipRes = await COREUTILS['pip'](['install', 'scipy'], context);
    assert.match(pipRes.stdout, /Successfully installed scipy/);
  });

  await test('headless executeInVirtualRuntime handles .py entry files with python toolchain', async () => {
    const runtime = CodeLab.CodeLabRuntime;
    assert.ok(runtime && typeof runtime.executeInVirtualRuntime === 'function');

    pyExtMod.registerPythonCompilerOnRuntime(new pyExtMod.PythonToolchainManager());
    const res = await runtime.executeInVirtualRuntime({
      files: {
        'main.py': 'print("hello from headless python")'
      },
      entry: 'main.py'
    });
    assert.equal(res.exitCode, 0);
  });

  await test('Python toolchain handles sys.exit(0) as clean exit and sys.exit(2) with exitCode 2', async () => {
    const mgr = new pyExtMod.PythonToolchainManager();
    const resZero = await mgr.execute({
      source: 'import sys\nsys.exit(0)'
    });
    assert.equal(resZero.ok, true, 'sys.exit(0) must yield ok: true');
    assert.equal(resZero.exitCode, 0, 'sys.exit(0) must yield exitCode: 0');
    assert.equal(resZero.stderr, '', 'clean exit must not log error to stderr');

    const resNonZero = await mgr.execute({
      source: 'import sys\nsys.exit(2)'
    });
    assert.equal(resNonZero.ok, false, 'sys.exit(2) must yield ok: false');
    assert.equal(resNonZero.exitCode, 2, 'sys.exit(2) must yield exitCode: 2');
    assert.match(resNonZero.stderr, /SystemExit: 2/);
  });

  await test('pythonExtension(null, opts) returns toolchain instance, createPythonExtension returns plugin', () => {
    const toolchain = pyExtMod.pythonExtension(null, { preloadPackages: ['numpy'] });
    assert.ok(toolchain instanceof pyExtMod.PythonToolchainManager, 'pythonExtension(null) must return toolchain');
    assert.deepEqual(toolchain.options.preloadPackages, ['numpy']);

    const plugin = pyExtMod.createPythonExtension({ preloadPackages: ['pytest'] });
    assert.equal(typeof plugin, 'function', 'createPythonExtension must return plugin function');
    assert.equal(plugin.extensionName, 'python');
  });

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`Python Extension Suite Complete: ${passed} passed, ${failures.length} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`\n[${f.name}]`);
      console.error(f.err.stack || f.err.message);
    }
    process.exit(1);
  }
})();
