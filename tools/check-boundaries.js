#!/usr/bin/env node
/**
 * Architectural Boundary & Dependency Graph Enforcer (`tools/check-boundaries.js`)
 *
 * Enforces Phase 2's modular 4-layer architecture across `packages/*` and `apps/*`:
 *   1. Strict One-Way Layer DAG:
 *        Layer 0 (`core`)      : @code-lab/core
 *        Layer 1 (`platform`)  : @code-lab/fs, @code-lab/settings, @code-lab/commands
 *        Layer 2 (`services`)  : @code-lab/sql (2.0), @code-lab/runtime (2.1),
 *                                @code-lab/terminal (2.1), @code-lab/preview (2.1),
 *                                @code-lab/editor (2.2)
 *        Layer 3 (`workbench`) : @code-lab/ui
 *        Layer 4 (`apps`)      : @code-lab/web (`apps/web`)
 *   2. Public API Encapsulation:
 *        Cross-package imports MUST use bare `@code-lab/<pkg>` (`src/index.ts`),
 *        never deep subpaths (`@code-lab/fs/src/...`) or relative cross-package paths (`../../fs/...`).
 *   3. Zero Circular Imports:
 *        Tarjan's Strongly Connected Components (SCC) algorithm verifies 0 cycles across all files.
 *   4. Pure Headless Core:
 *        `packages/core/src/**` must reference zero browser DOM globals (`window`, `document`,
 *        `HTMLElement`, `localStorage`, `sessionStorage`, `navigator`, `MutationObserver`).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

const PACKAGE_LAYERS = {
  '@code-lab/core': { dir: 'packages/core', rank: 0, label: 'core' },
  '@code-lab/fs': { dir: 'packages/fs', rank: 1, label: 'platform' },
  '@code-lab/settings': { dir: 'packages/settings', rank: 1, label: 'platform' },
  '@code-lab/commands': { dir: 'packages/commands', rank: 1, label: 'platform' },
  '@code-lab/sql': { dir: 'packages/sql', rank: 2.0, label: 'services' },
  '@code-lab/runtime': { dir: 'packages/runtime', rank: 2.1, label: 'services' },
  '@code-lab/terminal': { dir: 'packages/terminal', rank: 2.1, label: 'services' },
  '@code-lab/preview': { dir: 'packages/preview', rank: 2.1, label: 'services' },
  '@code-lab/editor': { dir: 'packages/editor', rank: 2.2, label: 'services' },
  '@code-lab/ui': { dir: 'packages/ui', rank: 3, label: 'workbench' },
  '@code-lab/web': { dir: 'apps/web', rank: 4, label: 'apps' }
};

const FORBIDDEN_CORE_DOM_GLOBALS = new Set([
  'window',
  'document',
  'HTMLElement',
  'HTMLDialogElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'localStorage',
  'sessionStorage',
  'navigator',
  'MutationObserver',
  'CustomEvent'
]);

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractSpecifiers(sf) {
  const specs = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push({
        specifier: node.moduleSpecifier.text,
        pos: node.moduleSpecifier.getStart(sf)
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push({
        specifier: node.arguments[0].text,
        pos: node.arguments[0].getStart(sf)
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return specs;
}

function checkCoreDomGlobals(sf, relPath, violations) {
  function visit(node) {
    if (ts.isIdentifier(node) && FORBIDDEN_CORE_DOM_GLOBALS.has(node.text)) {
      const parent = node.parent;
      const isPropertyName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isPropertySignature(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node);
      if (!isPropertyName) {
        const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        violations.push(
          `${relPath}:${lc.line + 1}:${lc.character + 1}: [no-dom-in-core] Forbidden browser global "${node.text}" in Layer 0 (@code-lab/core)`
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

function resolveLocalImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, path.join(base, 'index.ts')];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return c;
    }
  }
  return null;
}

function findStronglyConnectedCycles(adjacency) {
  let index = 0;
  const indices = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const cycles = [];

  function strongConnect(v) {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) || []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), indices.get(w)));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      if (scc.length > 1) {
        cycles.push(scc.reverse());
      } else if (scc.length === 1 && (adjacency.get(v) || []).includes(v)) {
        cycles.push(scc);
      }
    }
  }

  for (const node of adjacency.keys()) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }
  return cycles;
}

function checkBoundaries(rootDir = ROOT) {
  const violations = [];
  const adjacency = new Map();
  let fileCount = 0;

  for (const [pkgName, meta] of Object.entries(PACKAGE_LAYERS)) {
    const pkgAbsDir = path.join(rootDir, meta.dir);
    const srcDir = path.join(pkgAbsDir, 'src');
    const entryIndex = path.join(srcDir, 'index.ts');

    if (!fs.existsSync(entryIndex)) {
      violations.push(`${meta.dir}: [missing-index] Package ${pkgName} must expose ${meta.dir}/src/index.ts`);
      continue;
    }

    const files = walkTsFiles(srcDir);
    for (const fileAbs of files) {
      fileCount++;
      const relPath = path.relative(rootDir, fileAbs).replace(/\\/g, '/');
      const source = fs.readFileSync(fileAbs, 'utf8');
      const sf = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

      if (pkgName === '@code-lab/core') {
        checkCoreDomGlobals(sf, relPath, violations);
      }

      const edges = [];
      const specs = extractSpecifiers(sf);
      for (const { specifier, pos } of specs) {
        const lc = sf.getLineAndCharacterOfPosition(pos);
        const loc = `${relPath}:${lc.line + 1}:${lc.character + 1}`;

        if (specifier.startsWith('@code-lab/')) {
          const parts = specifier.split('/');
          const targetPkg = `${parts[0]}/${parts[1]}`;
          if (parts.length > 2) {
            violations.push(
              `${loc}: [no-deep-package-import] Import "${specifier}" bypasses ${targetPkg}'s public index.ts`
            );
            continue;
          }
          const targetMeta = PACKAGE_LAYERS[targetPkg];
          if (!targetMeta) {
            violations.push(`${loc}: [unknown-workspace-pkg] Unknown package "${specifier}"`);
            continue;
          }
          if (targetPkg === pkgName) {
            violations.push(`${loc}: [self-package-import] Use relative imports within ${pkgName}`);
            continue;
          }
          if (targetMeta.rank >= meta.rank) {
            violations.push(
              `${loc}: [layer-violation] ${pkgName} (${meta.label}, rank ${meta.rank}) cannot import ${targetPkg} (${targetMeta.label}, rank ${targetMeta.rank})`
            );
            continue;
          }
          edges.push(path.join(rootDir, targetMeta.dir, 'src', 'index.ts'));
        } else if (specifier.startsWith('.')) {
          const resolved = resolveLocalImport(fileAbs, specifier);
          if (!resolved) {
            violations.push(`${loc}: [unresolved-import] Cannot resolve "${specifier}"`);
            continue;
          }
          if (!resolved.startsWith(srcDir + path.sep) && resolved !== entryIndex) {
            violations.push(
              `${loc}: [no-relative-cross-pkg] Relative import "${specifier}" escapes package root ${meta.dir}/src`
            );
            continue;
          }
          edges.push(resolved);
        }
      }

      adjacency.set(fileAbs, edges);
    }
  }

  const cycles = findStronglyConnectedCycles(adjacency);
  for (const scc of cycles) {
    const formatted = scc.map((f) => path.relative(rootDir, f).replace(/\\/g, '/')).join(' -> ');
    violations.push(`[circular-dependency] Cycle detected: ${formatted}`);
  }

  return { ok: violations.length === 0, violations, fileCount, packageCount: Object.keys(PACKAGE_LAYERS).length };
}

if (require.main === module) {
  const res = checkBoundaries(ROOT);
  if (!res.ok) {
    console.error(`✗ Architecture boundary check failed (${res.violations.length} violation(s)):`);
    for (const v of res.violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }
  console.log(
    `✓ Architecture boundaries verified (${res.packageCount} workspace packages, ${res.fileCount} TypeScript modules, 0 layer violations, 0 cycles)`
  );
}

module.exports = { checkBoundaries, PACKAGE_LAYERS };
