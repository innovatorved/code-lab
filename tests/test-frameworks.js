'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Framework Support Matrix & Built-in Browser Preview — Test Suite
 *
 * Verifies that common JS/TS frameworks can actually install + run inside the
 * virtual runtime (JSX/TSX, ESM, custom pragmas, package shapes) and that the
 * built-in preview server can serve a project to a real browser (transpiling
 * TS/JSX to browser-native ESM and resolving bare imports via jsDelivr).
 *
 *   Suite A: Framework runtime support (React, Preact, Vue, Angular, ESM, plain JS)
 *   Suite B: Browser preview server (`serve`, import maps, SPA fallback, dev fallback)
 *
 * Pure Node.js, zero external dependencies, no network access.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');

const runtime = require('./helpers/load').runtime;
const shellModule = require('./helpers/load').shell;

const { createVirtualFs, createVirtualPortTable } = runtime;
const createPosixShell = shellModule.createPosixShell;

// ── A tiny React-compatible runtime used to prove the JSX pipeline bilaterally ──
const React = {
  Fragment: Symbol.for('react.fragment'),
  createElement(type, props, ...children) {
    const p = Object.assign({}, props);
    if (children.length === 1) p.children = children[0];
    else if (children.length > 1) p.children = children;
    return { type, props: p };
  }
};

function renderToString(node) {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderToString).join('');
  const { type, props } = node;
  if (typeof type === 'function') return renderToString(type(Object.assign({}, props)));
  if (type === React.Fragment) return renderToString(props && props.children);
  let attrs = '';
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'children' || k === 'key' || k === 'ref' || v === null || v === undefined || v === false) continue;
    const attr = k === 'className' ? 'class' : k;
    attrs += ` ${attr}="${String(v)}"`;
  }
  return `<${type}${attrs}>${renderToString(props && props.children)}</${type}>`;
}

async function runSuite() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function check(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      failed++;
      failures.push({ name, err });
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${err && err.stack ? err.stack : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Framework Support Matrix & Built-in Browser Preview');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  console.log('--- Suite A: Framework runtime support ---');

  await check('A1 React + TSX: `node app.tsx` compiles JSX to createElement and renders', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.tsx',
      packages: { react: React, 'my-renderer': { render: renderToString } },
      files: {
        'app.tsx': `
          import React from 'react';
          import { render } from 'my-renderer';
          interface Props { name: string }
          function App({ name }: Props) {
            return <div className="card">Hello {name}!</div>;
          }
          console.log(render(<App name="CodeLab" />));
        `
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), '<div class="card">Hello CodeLab!</div>');
  });

  await check('A2 React: nested elements, fragments and list children render correctly', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.tsx',
      packages: { react: React, 'my-renderer': { render: renderToString } },
      files: {
        'app.tsx': `
          import React from 'react';
          import { render } from 'my-renderer';
          const items: string[] = ['a', 'b'];
          function App() {
            return <><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul><b/></>;
          }
          console.log(render(<App />));
        `
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), '<ul><li>a</li><li>b</li></ul><b></b>');
  });

  await check('A3 Preact-style custom pragma (/** @jsx h */) does not require React', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.jsx',
      packages: { preact: { h: React.createElement, render: renderToString } },
      files: {
        'app.jsx': `
          /** @jsx h */
          import { h, render } from 'preact';
          function App() { return <div><span>hi</span></div>; }
          console.log(render(<App />));
        `
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), '<div><span>hi</span></div>');
  });

  await check('A4 Vue-style package: require returns the module object with its version', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.js',
      packages: { vue: { version: '3.5.44', createApp() { return { mount() {} }; } } },
      files: {
        'app.js': `const vue = require('vue'); console.log('vue', vue.version);`
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), 'vue 3.5.44');
  });

  await check('A5 Angular-style scoped package: @angular/core resolves and exports are usable', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.js',
      packages: { '@angular/core': { Component() { return (t) => t; }, VERSION: { full: '19.2.0' } } },
      files: {
        'app.js': `const core = require('@angular/core'); console.log(typeof core.Component, core.VERSION.full);`
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), 'function 19.2.0');
  });

  await check('A6 Minified ESM package (export{a,b}) is transformed and requireable', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.js',
      files: {
        'node_modules/mini-esm/package.json': JSON.stringify({ name: 'mini-esm', version: '1.0.0', main: 'index.js' }),
        'node_modules/mini-esm/index.js': 'const a=1,b=2;export{a,b};',
        'app.js': `const m = require('mini-esm'); console.log(m.a, m.b);`
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), '1 2');
  });

  await check('A7 Plain large JS with prose comments is not corrupted by the TS transpiler', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.js',
      files: {
        'lib.js': `/* Used as ES2015 template strings in compiled output. */\nmodule.exports = function chunk(a, n) { return a.slice(0, n); };`,
        'app.js': `const chunk = require('./lib'); console.log(chunk([1, 2, 3], 2).join(','));`
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), '1,2');
  });

  await check('A8 react-dom/client + react-dom peer shape resolves through subpath exports', async () => {
    const res = await runtime.executeInVirtualRuntime({
      entry: 'app.js',
      files: {
        'node_modules/react-dom/package.json': JSON.stringify({
          name: 'react-dom',
          version: '19.2.0',
          exports: { '.': { require: './index.js' }, './client': { require: './client.js' } }
        }),
        'node_modules/react-dom/index.js': `module.exports = { version: '19.2.0' };`,
        'node_modules/react-dom/client.js': `module.exports = { createRoot(el) { return { render(v) { console.log('mounted', v); } }; } };`,
        'app.js': `const { createRoot } = require('react-dom/client'); createRoot({}).render('<App/>');`
      }
    });
    assert.equal(res.ok, true, res.stderr);
    assert.equal(res.stdout.trim(), 'mounted <App/>');
  });

  console.log('\n--- Suite B: Built-in browser preview server ---');

  const browserSource = [
    'import React from "react";',
    'import { createRoot } from "react-dom/client";',
    'interface P { name: string }',
    'export function App(props: P) { return <h1 className="t">Hi {props.name}</h1>; }',
    'createRoot(document.getElementById("root")).render(<App name="CodeLab" />);'
  ].join('\n');

  const projectFiles = {
    '/workspace/package.json': JSON.stringify({
      name: 'preview-demo',
      version: '1.0.0',
      dependencies: { react: '^19', 'react-dom': '^19' },
      scripts: { dev: 'vite' }
    }),
    '/workspace/index.html': '<!doctype html><html><head><title>Preview</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
    '/workspace/main.tsx': browserSource,
    '/workspace/style.css': 'h1 { color: teal; }'
  };

  function makeShell() {
    const vfs = createVirtualFs(projectFiles);
    const portTable = createVirtualPortTable();
    const shell = createPosixShell({ vfs, portTable, env: { PATH: '/bin', HOME: '/workspace', PWD: '/workspace' } });
    return { vfs, portTable, shell };
  }

  await check('B1 transpileForBrowser keeps ESM, strips TS, compiles JSX and injects React', () => {
    const out = runtime.transpileForBrowser(browserSource, 'main.tsx');
    assert.ok(out.includes('import { createRoot } from "react-dom/client"'), 'ESM imports preserved');
    assert.ok(out.includes('import React from "react"'), 'ESM React import preserved');
    assert.ok(out.includes('React.createElement("h1"'), 'JSX compiled to createElement');
    assert.ok(!out.includes('interface P'), 'TypeScript interface stripped');
    assert.ok(!out.includes('props: P') && !out.includes('props: P'), 'type annotation stripped');
  });

  await check('B2 transpileForBrowser leaves plain ESM untouched (native passthrough)', () => {
    const src = 'import { x } from "./x.js";\nexport const y = x + 1;\n';
    assert.equal(runtime.transpileForBrowser(src, 'plain.js'), src);
  });

  await check('B3 `serve` registers a virtual port and injects a jsDelivr import map', async () => {
    const { portTable, shell } = makeShell();
    const res = await shell.execute('serve --port 4321');
    assert.equal(res.code, 0, res.stderr);
    assert.ok(res.stdout.includes('http://127.0.0.1:4321/'), 'prints the local URL');

    const servers = portTable.listServers();
    assert.equal(servers.length, 1);
    assert.equal(servers[0].name, 'code-lab-serve');

    const htmlRes = await portTable.dispatchRequest('http://127.0.0.1:4321/');
    assert.equal(htmlRes.status, 200);
    assert.match(htmlRes.headers.get('content-type'), /text\/html/);
    const html = await htmlRes.text();
    assert.ok(html.includes('<script type="importmap">'), 'injects an import map');
    assert.ok(html.includes('"react": "https://cdn.jsdelivr.net/npm/react@^19/+esm"'), 'react resolves to jsDelivr ESM');
    assert.ok(html.includes('"react-dom/client": "https://cdn.jsdelivr.net/npm/react-dom@^19/client/+esm"'), 'subpath resolves to jsDelivr ESM');
    assert.ok(html.includes('window.__CODELAB_PREVIEW__'), 'injects the preview shim');
  });

  await check('B4 `serve` transpiles .tsx to browser ESM with a javascript content type', async () => {
    const { portTable, shell } = makeShell();
    await shell.execute('serve --port 4322');
    const res = await portTable.dispatchRequest('http://127.0.0.1:4322/main.tsx');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    const js = await res.text();
    assert.ok(js.includes('React.createElement("h1"'));
    assert.ok(js.includes('import { createRoot } from "react-dom/client"'));
    assert.ok(!js.includes('interface P'));
  });

  await check('B5 `serve` returns correct MIME for css, SPA-falls back, and 404s unknown files', async () => {
    const { portTable, shell } = makeShell();
    await shell.execute('serve --port 4323');

    const css = await portTable.dispatchRequest('http://127.0.0.1:4323/style.css');
    assert.match(css.headers.get('content-type'), /text\/css/);
    assert.equal((await css.text()).trim(), 'h1 { color: teal; }');

    const spa = await portTable.dispatchRequest('http://127.0.0.1:4323/some/client/route');
    assert.equal(spa.status, 200);
    assert.ok((await spa.text()).includes('id="root"'), 'SPA route falls back to index.html');

    const missing = await portTable.dispatchRequest('http://127.0.0.1:4323/nope.png');
    assert.equal(missing.status, 404);
  });

  await check('B6 `npm run dev` (vite) transparently falls back to the preview server', async () => {
    const { portTable, shell } = makeShell();
    const res = await shell.execute('npm run dev');
    assert.equal(res.code, 0, res.stderr);
    assert.ok(res.stdout.includes('vite is not available'), 'explains the fallback');
    const servers = portTable.listServers();
    assert.ok(servers.some((s) => Number(s.port) === 5173), 'starts on the Vite default port');
  });

  await check('B7 served script remains valid browser ESM (no require() leaks into JSX output)', async () => {
    const { portTable, shell } = makeShell();
    await shell.execute('serve --port 4324');
    const js = await (await portTable.dispatchRequest('http://127.0.0.1:4324/main.tsx')).text();
    assert.ok(!/\brequire\s*\(/.test(js), 'no CommonJS require in browser output');
    assert.ok(/^\s*import\s/m.test(js), 'top-level ESM import present');
  });

  await check('B8 extensionless relative imports resolve to the right source file', async () => {
    const vfs = createVirtualFs(Object.assign({}, projectFiles, {
      '/workspace/components/Counter.tsx': 'import React from "react";\nexport function Counter(){ return <div>c</div>; }\n'
    }));
    const portTable = createVirtualPortTable();
    const shell = createPosixShell({ vfs, portTable, env: { PATH: '/bin', HOME: '/workspace', PWD: '/workspace' } });
    await shell.execute('serve --port 4325');
    const res = await portTable.dispatchRequest('http://127.0.0.1:4325/components/Counter');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    const js = await res.text();
    assert.ok(js.includes('React.createElement("div"'), 'resolved the .tsx file rather than the SPA fallback');
    assert.ok(!/<!doctype html>/i.test(js), 'must not return index.html for a module import');
  });

  await check('B9 a native dev server typed directly (`ng serve`) falls back to the preview server', async () => {
    const { portTable, shell } = makeShell();
    const res = await shell.execute('ng serve --port 4200');
    assert.equal(res.code, 0, res.stderr);
    assert.ok(/preview server/i.test(res.stdout), 'explains the fallback');
    assert.ok(res.stdout.includes('http://127.0.0.1:4200/'), 'uses the requested port');
    assert.ok(portTable.listServers().some((s) => Number(s.port) === 4200), 'registered on the port table');
  });

  await check('B10 `astro dev` typed directly falls back on the Astro default port', async () => {
    const { portTable, shell } = makeShell();
    const res = await shell.execute('astro dev');
    assert.equal(res.code, 0, res.stderr);
    assert.ok(res.stdout.includes('http://127.0.0.1:4321/'), 'uses the Astro default port');
    assert.ok(portTable.listServers().some((s) => Number(s.port) === 4321));
  });

  await check('B11 genuinely unknown commands still report "command not found"', async () => {
    const { shell } = makeShell();
    const res = await shell.execute('definitely-not-a-tool');
    assert.notEqual(res.code, 0);
    assert.match(res.stderr, /command not found/);
  });

  console.log(`\n=== Framework Suite Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    for (const f of failures) console.error(`  FAILED: ${f.name}`);
    process.exit(1);
  }
}

runSuite();
