#!/usr/bin/env node
'use strict';

/**
 * Dedicated Zero-Dependency E2E HTTP Server for `tests/vscode-e2e/` (Port 4273).
 *
 * Routes:
 *   - GET /healthz    -> 200 JSON readiness probe `{"ok":true,"port":4273}`
 *   - GET /workbench  -> Full-viewport (100vw x 100vh) standalone CodeLab SDK host
 *                        supporting ?labId=, ?blank=1, ?empty=1, ?lang=, ?mode=,
 *                        ?persist=0|1, ?theme=, ?git=1, ?nomount=1
 *   - GET /cloud-ide  -> Serves built `examples/cloud-ide/dist/index.html` when present
 *                        and at least as fresh as `src/pages/index.astro` (unless `?_source=astro`);
 *                        otherwise strips YAML frontmatter & `is:inline`/`is:global` from `index.astro`
 *   - Static assets   -> `/dist/*` & `/packages/*` from repo root FIRST; `/_astro/*`,
 *                        `/fonts/*`, `/favicon.svg`, `/preview-sw.js` cascading across
 *                        `examples/cloud-ide/dist/` -> `examples/cloud-ide/public/` -> repo root,
 *                        with clean 204 fallback for missing `/favicon.ico` / `/favicon.svg`.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CLOUD_IDE_DIR = path.join(ROOT, 'examples', 'cloud-ide');
const CLOUD_IDE_DIST = path.join(CLOUD_IDE_DIR, 'dist');
const CLOUD_IDE_PUBLIC = path.join(CLOUD_IDE_DIR, 'public');
const CLOUD_IDE_DIST_INDEX = path.join(CLOUD_IDE_DIST, 'index.html');
const CLOUD_IDE_ASTRO_INDEX = path.join(CLOUD_IDE_DIR, 'src', 'pages', 'index.astro');

const HOST = process.env.VSCODE_E2E_HOST || '127.0.0.1';
const PORT = Number(process.env.VSCODE_E2E_PORT || 4273);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

const WORKBENCH_HTML = `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>code-lab VS Code E2E Workbench</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/dist/code-lab.css" />
    <link rel="stylesheet" href="/dist/code-lab-sql.css" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: #000000;
      }
      #app {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      }
      #app .codelab {
        width: 100%;
        height: 100%;
        max-height: none;
        border: none;
        border-radius: 0;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="/dist/code-lab.js"></script>
    <script src="/dist/code-lab-sql.umd.js"></script>
    <script src="/dist/extensions/typescript.js"></script>
    <script src="/dist/extensions/python.js"></script>
    <script src="/dist/extensions/cpp.js"></script>
    <script src="/dist/extensions/guided-lab.js"></script>
    <script>
      (function () {
        const params = new URLSearchParams(window.location.search);
        const themeParam = params.get('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', themeParam);

        function getDefaultExtensions() {
          return [
            window.CodeLabTypeScript && (window.CodeLabTypeScript.typescriptExtension || window.CodeLabTypeScript.default),
            window.CodeLabPython && (window.CodeLabPython.pythonExtension || window.CodeLabPython.default),
            window.CodeLabCpp && (window.CodeLabCpp.cppExtension || window.CodeLabCpp.default)
          ].filter(Boolean);
        }

        function buildOptionsFromQuery(overrides) {
          const isBlank = params.get('blank') === '1';
          const isEmpty = params.get('empty') === '1';
          const isSqlSingle = params.get('sqlSingle') === '1';
          const lang = params.get('lang') || (isSqlSingle ? 'sql' : 'js');
          const mode = params.get('mode') || (isSqlSingle ? 'guided' : 'sandbox');
          const persistParam = params.get('persist');
          const persistState = persistParam === '0' || persistParam === 'false' ? false : true;
          const labId = params.get('labId') || (isBlank ? 'blank-workspace' : 'vscode-e2e-lab');

          let defaultFiles;
          if (isEmpty || isBlank) {
            defaultFiles = {};
          } else if (lang === 'py') {
            defaultFiles = {
              'main.py': 'def greet(name: str) -> str:\\n    return f"Hello, {name}"\\n\\nprint(greet("code-lab"))\\n'
            };
          } else if (lang === 'cpp') {
            defaultFiles = {
              'main.cpp': '#include <iostream>\\nint main() { std::cout << "Hello C++\\\\n"; return 0; }\\n'
            };
          } else if (lang === 'ts') {
            defaultFiles = {
              'index.ts': 'export const label: string = "code-lab";\\nconsole.log(label);\\n'
            };
          } else if (lang === 'sql') {
            defaultFiles = isSqlSingle
              ? { 'query.sql': 'SELECT 1 AS ok;\\n' }
              : {
                  'schema.sql': 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\\nINSERT INTO users (id, name) VALUES (1, \\'Ada\\');\\n',
                  'query.sql': 'SELECT id, name FROM users;\\n'
                };
          } else {
            defaultFiles = {
              'index.js': 'const msg = "hello from code-lab";\\nconsole.log(msg);\\n',
              'src/utils.js': 'module.exports = { add: (a, b) => a + b };\\n'
            };
          }

          if (params.get('git') === '1' && !isEmpty && !isBlank) {
            defaultFiles['.git/HEAD'] = 'ref: refs/heads/main\\n';
          }

          const baseOptions = {
            labId,
            title: params.get('title') || 'code-lab',
            mode,
            lang,
            language: lang,
            theme: themeParam,
            persistState,
            showExplorer: !isSqlSingle,
            extensions: getDefaultExtensions(),
            files: defaultFiles
          };

          if (mode === 'guided') {
            baseOptions.hasGuidedLab = true;
            baseOptions.steps = [
              { id: 'step-1', title: 'Step 1', instructions: 'Implement the starter module.' },
              { id: 'step-2', title: 'Step 2', instructions: 'Verify output in terminal.' }
            ];
          }

          return Object.assign(baseOptions, overrides || {});
        }

        window.__codelabTest = {
          ide: null,
          mount(customOptions) {
            const el = document.getElementById('app');
            const opts = customOptions ? Object.assign(buildOptionsFromQuery(), customOptions) : buildOptionsFromQuery();
            const ide = window.CodeLab.mount(el, opts);
            window.__codelabTest.ide = ide;
            window.__codelabIde = ide;
            return ide;
          },
          unmount() {
            const el = document.getElementById('app');
            window.CodeLab.unmount(el);
            window.__codelabTest.ide = null;
            window.__codelabIde = null;
          }
        };

        if (params.get('nomount') !== '1') {
          window.__codelabTest.mount();
        }
      })();
    </script>
  </body>
</html>`;

function extractHtmlFromAstro(astroSource) {
  const withoutFrontmatter = astroSource.replace(/^\uFEFF?\s*---[\s\S]*?---\r?\n?/, '');
  return withoutFrontmatter.replace(/\s+is:(?:inline|global)(?:=(?:"[^"]*"|'[^']*'))?/g, '');
}

function serveCloudIdeIndex(reqUrl, res) {
  const parsed = new URL(reqUrl, `http://${HOST}:${PORT}`);
  const forceAstroFallback = parsed.searchParams.get('_source') === 'astro';

  let distStat = null;
  let astroStat = null;
  try { distStat = fs.statSync(CLOUD_IDE_DIST_INDEX); } catch (_) { distStat = null; }
  try { astroStat = fs.statSync(CLOUD_IDE_ASTRO_INDEX); } catch (_) { astroStat = null; }

  const useBuiltDist = Boolean(
    !forceAstroFallback &&
    distStat &&
    distStat.isFile() &&
    (!astroStat || distStat.mtimeMs >= astroStat.mtimeMs)
  );

  if (useBuiltDist) {
    const html = fs.readFileSync(CLOUD_IDE_DIST_INDEX, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Cloud-Ide-Source': 'astro-dist'
    });
    res.end(html);
    return;
  }

  if (astroStat && astroStat.isFile()) {
    const rawAstro = fs.readFileSync(CLOUD_IDE_ASTRO_INDEX, 'utf8');
    const html = extractHtmlFromAstro(rawAstro);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Cloud-Ide-Source': 'astro-fallback'
    });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Cloud IDE index not found in dist/ or src/pages/index.astro');
}

function safeJoin(baseDir, relPathname) {
  const cleanRel = relPathname.replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, cleanRel);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

function resolveStaticCandidates(pathname) {
  if (pathname.startsWith('/dist/') || pathname.startsWith('/packages/')) {
    return [
      safeJoin(ROOT, pathname),
      safeJoin(CLOUD_IDE_DIST, pathname),
      safeJoin(CLOUD_IDE_PUBLIC, pathname)
    ].filter(Boolean);
  }

  return [
    safeJoin(CLOUD_IDE_DIST, pathname),
    safeJoin(CLOUD_IDE_PUBLIC, pathname),
    safeJoin(ROOT, pathname)
  ].filter(Boolean);
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  let pathname = '/';
  try {
    pathname = decodeURIComponent(rawUrl.split('?')[0].split('#')[0]);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad Request');
    return;
  }

  if (pathname === '/healthz') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify({ ok: true, port: PORT }));
    return;
  }

  if (pathname === '/' || pathname === '/workbench' || pathname === '/workbench/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(WORKBENCH_HTML);
    return;
  }

  if (pathname === '/cloud-ide' || pathname === '/cloud-ide/' || pathname === '/cloud-ide/index.html') {
    serveCloudIdeIndex(rawUrl, res);
    return;
  }

  const normalizedPath = pathname.startsWith('/cloud-ide/')
    ? pathname.slice('/cloud-ide'.length)
    : pathname;

  const candidates = resolveStaticCandidates(normalizedPath);
  if (candidates.length === 0) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
    return;
  }

  for (const candidate of candidates) {
    try {
      const st = fs.statSync(candidate);
      if (st.isFile()) {
        const data = fs.readFileSync(candidate);
        const type = MIME[path.extname(candidate).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(data);
        return;
      }
    } catch (_) {
      // Try next candidate directory
    }
  }

  if (
    normalizedPath === '/favicon.ico' ||
    normalizedPath === '/favicon.svg' ||
    normalizedPath.startsWith('/fonts/')
  ) {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Not found: ${pathname}`);
});

server.listen(PORT, HOST, () => {
  console.log(`vscode-e2e server listening on http://${HOST}:${PORT}`);
});
