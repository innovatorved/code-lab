#!/usr/bin/env node
/**
 * Zero-dependency architectural & quality linter for @innovatorved/code-lab.
 *
 * Uses the already-installed TypeScript compiler AST + source checks to enforce:
 *   1. Zero empty or comment-only `catch` blocks across `src/`, `packages/`, and `apps/`.
 *   2. `@ts-nocheck` is restricted to the legacy allowlist (forbidden in all `packages/*` & `apps/*`).
 *   3. Strict modules (`tsconfig.strict.json`, `packages/*`, `apps/*`) must not use `any`.
 *   4. 4-layer one-way package DAG, `index.ts` encapsulation, 0 cycles, and 0 DOM globals in `core`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { checkBoundaries } = require('./check-boundaries');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'packages'),
  path.join(ROOT, 'apps')
];

const TS_NOCHECK_ALLOWLIST = new Set([
  'src/runtime.ts',
  'src/shell.ts',
  'src/terminal.ts',
  'src/workbench.ts'
]);

const EMPTY_CATCH_RE =
  /\bcatch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*\}/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(?:ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function lineAndCol(sourceFile, pos) {
  const lc = sourceFile.getLineAndCharacterOfPosition(pos);
  return `${lc.line + 1}:${lc.character + 1}`;
}

const strictConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tsconfig.strict.json'), 'utf8')
);
const strictExplicit = new Set(
  (Array.isArray(strictConfig.include) ? strictConfig.include : []).filter((p) => !p.includes('*'))
);

const violations = [];
const files = [];
for (const dir of SCAN_DIRS) {
  walk(dir, files);
}
files.sort();

let strictCheckedCount = 0;

for (const absPath of files) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const source = fs.readFileSync(absPath, 'utf8');

  // 1. @ts-nocheck allowlist check
  if (/@ts-nocheck\b/.test(source) && !TS_NOCHECK_ALLOWLIST.has(rel)) {
    violations.push(`${rel}:1:1: [no-ts-nocheck] @ts-nocheck is forbidden outside the legacy allowlist`);
  }

  // 2. Regex check for empty or comment-only catch blocks
  EMPTY_CATCH_RE.lastIndex = 0;
  let match;
  while ((match = EMPTY_CATCH_RE.exec(source)) !== null) {
    const before = source.slice(0, match.index);
    const line = before.split('\n').length;
    violations.push(`${rel}:${line}:1: [no-empty-catch] Empty or comment-only catch block`);
  }

  // 3. TypeScript AST checks
  const sf = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
    rel.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS
  );

  const isStrictModule =
    strictExplicit.has(rel) ||
    rel.startsWith('packages/') ||
    rel.startsWith('apps/');
  if (isStrictModule) strictCheckedCount++;

  function visit(node) {
    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      violations.push(
        `${rel}:${lineAndCol(sf, node.getStart(sf))}: [no-empty-catch] Catch block has 0 statements`
      );
    }
    if (isStrictModule && node.kind === ts.SyntaxKind.AnyKeyword) {
      violations.push(
        `${rel}:${lineAndCol(sf, node.getStart(sf))}: [no-explicit-any] 'any' is forbidden in strict module ${rel}`
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
}

const boundaryResult = checkBoundaries(ROOT);
if (!boundaryResult.ok) {
  violations.push(...boundaryResult.violations);
}

if (violations.length > 0) {
  console.error(`✗ Lint failed with ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log(
  `✓ Lint passed (${files.length} source files checked, 0 empty catches, ${strictCheckedCount} strict modules verified, ${boundaryResult.packageCount} workspace boundaries clean)`
);
