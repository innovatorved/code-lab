# @innovatorved/code-lab

> **Note:** This project is in active early development. APIs and sandbox internals may change between releases.

A small browser IDE and Web Worker runtime for running multi-file JavaScript and TypeScript labs without a backend server.

We built this to run the 15 from-scratch implementations in [System Design In Depth](https://system-design-in-depth.vedgupta.in), where labs need Node built-ins (`node:fs`, `node:http`, `node:net`, `node:crypto`) and unit tests running directly in the browser.

## Install

```bash
npm install @innovatorved/code-lab
```

Or load from a static script tag:

```html
<link rel="stylesheet" href="https://unpkg.com/@innovatorved/code-lab/dist/code-lab.css" />
<script src="https://unpkg.com/@innovatorved/code-lab/dist/code-lab.js"></script>
```

## Usage

### 1. JavaScript API

```js
import { CodeLab } from '@innovatorved/code-lab';
import '@innovatorved/code-lab/code-lab.css';

const lab = CodeLab.mount('#editor', {
  id: 'rate-limiter',
  title: 'Token Bucket',
  mode: 'guided',
  language: 'js',
  entry: 'demo.js',
  testEntry: 'test.js',
  starterFiles: {
    'limiter.js': 'class TokenBucket {\n  allow() { return false; }\n}\nmodule.exports = { TokenBucket };\n',
    'demo.js': 'const { TokenBucket } = require("./limiter");\nconsole.log(new TokenBucket().allow());\n',
    'test.js': 'const { test } = require("node:test");\nconst assert = require("node:assert/strict");\nconst { TokenBucket } = require("./limiter");\n\ntest("allows request", () => {\n  assert.equal(new TokenBucket().allow(), true);\n});\n'
  },
  steps: [
    {
      id: 'step-1',
      title: 'Allow requests within capacity',
      targetFile: 'limiter.js',
      targetSymbol: 'allow',
      instructions: 'Return `true` when tokens are available.',
      testNames: ['allows request']
    }
  ]
});
```

### 2. `<code-lab>` Custom Element

```html
<code-lab mode="sandbox" language="ts" style="height: 600px;">
  <script type="application/json">
    {
      "id": "demo-lab",
      "title": "Demo",
      "entry": "demo.ts",
      "files": {
        "demo.ts": "const msg: string = 'hello';\nconsole.log(msg);\n"
      }
    }
  </script>
</code-lab>
```

### 3. Headless Runtime (No UI)

Run untrusted JS/TS files and `node:test` suites inside the virtual runtime without mounting the editor:

```js
import { executeInWorker } from '@innovatorved/code-lab/runtime';

const res = await executeInWorker({
  mode: 'test',
  entry: 'test.js',
  files: {
    'math.js': 'module.exports = { add: (a, b) => a + b };',
    'test.js': 'const { test } = require("node:test");\nconst assert = require("node:assert/strict");\nconst { add } = require("./math");\ntest("adds numbers", () => assert.equal(add(2, 3), 5));'
  }
});

console.log(res.ok, res.testResults);
```

## What Works in the Sandbox

Code runs inside a dedicated Web Worker with an in-memory virtual filesystem (`/workspace` and `/tmp`) and loopback network stack:

- **Shimmed Node modules:** `fs`, `fs/promises`, `path`, `os`, `buffer`, `crypto` (SHA-256, MD5, HMAC, UUID), `zlib` (CRC-32), `events`, `stream`, `util`, `url`, `querystring`, `http` (in-memory loopback server/client), `net` (in-memory TCP sockets), `timers`, `perf_hooks`, `assert`, `node:test`, `child_process` (`execSync` for `node <script>`).
- **TypeScript:** Strips types and compiles TS `enum`, parameter properties, and ES modules to CommonJS in the worker.
- **Strict CSP fallback:** Works on sites without `'unsafe-eval'` by falling back to `Blob` + `importScripts` inside the worker.
- **Built-in terminal:** Supports basic shell commands (`ls`, `cd`, `pwd`, `cat`, `head`, `tail`, `wc`, `mkdir`, `touch`, `rm`, `cp`, `mv`, `clear`, `node <file>`, `npm test`) alongside JS/TS expression evaluation.

## Key Options (`CodeLab.mount(container, options)`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `'custom-lab'` | Key used to save edits in `localStorage`. |
| `title` | `string` | `id` | Header title. |
| `mode` | `'guided' \| 'sandbox'` | `'sandbox'` | `'guided'` shows step instructions; `'sandbox'` shows full files. |
| `language` | `'js' \| 'ts'` | `'js'` | Initial language tab. |
| `files` | `Record<string, string>` | `{}` | Reference / solution files. |
| `starterFiles` | `Record<string, string>` | `{}` | Initial files loaded in `'guided'` mode. |
| `steps` | `Array<Step>` | `[]` | Step definitions (`{ id, title, instructions, targetFile, targetSymbol, hint, testNames }`). |
| `entry` | `string` | `'demo.js'` | Entry file for **Run**. |
| `testEntry` | `string` | `'test.js'` | Entry file for **Verify / Run Tests**. |
| `onClose` | `() => void` | `null` | Shows the Close/Back button and runs when clicked. |

## Useful Instance Methods

- `lab.runDemo()` / `lab.runTests()` / `lab.stopExecution()`
- `lab.getFiles()` / `lab.setFiles(files)` / `lab.getFile(path)` / `lab.setFile(path, content)`
- `lab.openFile(path)` / `lab.closeTab(path)` / `lab.resetLab()`
- `lab.toggleFullscreen()` / `lab.destroy()`

## Local Development

```bash
# Rebuild dist/ bundles and system-design/js/code-lab.js
node tools/bundle.js

# Run tests
node test-all-builds.js
node test-runtime-advanced.js
node test-workbench-ui.js
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on how the worker runtime and VFS work.

## License

MIT © [Ved Gupta](https://vedgupta.in)
