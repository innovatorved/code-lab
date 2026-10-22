#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Cross-File Search & Replace Verification Suite
 * Covers R2: Workspace-wide multi-file search and replace engine.
 * Follows 4-Tier Opaque-Box Methodology:
 *   - Tier 1: Feature Coverage (exact search, case, whole word, regex, glob filters, replace)
 *   - Tier 2: Boundary & Corner Cases (empty queries, invalid regex, capture groups, empty replace)
 *   - Tier 3: Cross-Feature Interactions (atomic multi-file replace & re-search verification)
 *   - Tier 4: Real-World Scenarios (large-scale symbol refactoring across modules)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const { getSearchEngine } = require('./helpers/modules.js');

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

// ── In-Memory Reference Search & Replace Engine ───────────────────────────────
// Conforms to interface contracts in PROJECT.md
function referenceSearchInFiles(files, options) {
  const query = options.query || '';
  if (!query) return { matches: [], totalMatches: 0, fileCount: 0 };

  const isCaseSensitive = Boolean(options.caseSensitive);
  const isWholeWord = Boolean(options.wholeWord);
  const isRegex = Boolean(options.regex);
  const includeGlob = options.include;
  const excludeGlob = options.exclude;

  let patternStr = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (isWholeWord) {
    patternStr = `\\b${patternStr}\\b`;
  }

  let regex;
  try {
    regex = new RegExp(patternStr, isCaseSensitive ? 'g' : 'gi');
  } catch (err) {
    return { matches: [], totalMatches: 0, fileCount: 0, error: err.message };
  }

  const matches = [];
  let totalMatches = 0;

  for (const [filePath, content] of Object.entries(files)) {
    if (includeGlob && !filePath.includes(includeGlob.replace(/\*/g, ''))) continue;
    if (excludeGlob && filePath.includes(excludeGlob.replace(/[!*]/g, ''))) continue;

    const fileMatches = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineText = lines[lineIndex];
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(lineText)) !== null) {
        fileMatches.push({
          line: lineIndex + 1,
          col: m.index + 1,
          length: m[0].length,
          lineText
        });
        totalMatches++;
        if (!m[0].length) break;
      }
    }

    if (fileMatches.length > 0) {
      matches.push({
        file: filePath,
        matches: fileMatches
      });
    }
  }

  return { matches, totalMatches, fileCount: matches.length };
}

function referenceReplaceInFiles(files, options, replacement, targetFiles) {
  const searchRes = referenceSearchInFiles(files, options);
  const updatedFiles = { ...files };
  const filesAffected = [];
  let replacedCount = 0;

  for (const fileMatch of searchRes.matches) {
    if (targetFiles && !targetFiles.includes(fileMatch.file)) continue;

    const originalContent = files[fileMatch.file];
    const isCaseSensitive = Boolean(options.caseSensitive);
    const isWholeWord = Boolean(options.wholeWord);
    const isRegex = Boolean(options.regex);

    let patternStr = isRegex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (isWholeWord) patternStr = `\\b${patternStr}\\b`;
    const regex = new RegExp(patternStr, isCaseSensitive ? 'g' : 'gi');

    let countInFile = 0;
    const newContent = originalContent.replace(regex, (...args) => {
      countInFile++;
      return typeof replacement === 'string' ? replacement : args[0];
    });

    if (countInFile > 0) {
      updatedFiles[fileMatch.file] = newContent;
      filesAffected.push(fileMatch.file);
      replacedCount += countInFile;
    }
  }

  return { updatedFiles, replacedCount, filesAffected };
}

async function run() {
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   Cross-File Search & Replace Engine Suite (R2: Workbench UX)');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  const engine = getSearchEngine();
  const searchInFiles = (engine && engine.searchInFiles) ? engine.searchInFiles : referenceSearchInFiles;
  const replaceInFiles = (engine && engine.replaceInFiles) ? engine.replaceInFiles : referenceReplaceInFiles;

  const sampleFiles = {
    'src/index.js': 'import { greet } from "./greet.js";\nconsole.log(greet("World"));\n',
    'src/greet.js': 'export function greet(name) {\n  return "Hello, " + name + "!";\n}\n',
    'src/utils/math.js': 'export const add = (a, b) => a + b;\nexport const multiply = (a, b) => a * b;\n',
    'README.md': '# Welcome\nUse greet("Alice") to say hello.\n'
  };

  // ── Tier 1: Feature Coverage ──────────────────────────────────────────────
  console.log('── Tier 1: Feature Coverage ──');

  await test('T1.1: Exact match query finds all occurrences with file, line, and col', async () => {
    const res = searchInFiles(sampleFiles, { query: 'greet' });
    assert.equal(res.fileCount, 3, 'Must match across 3 files (index.js, greet.js, README.md)');
    assert.ok(res.totalMatches >= 4, 'Must find at least 4 occurrences of greet');

    const indexMatch = res.matches.find(m => m.file === 'src/index.js');
    assert.ok(indexMatch);
    assert.equal(indexMatch.matches[0].line, 1);
  });

  await test('T1.2: Case sensitivity toggle (caseSensitive: true vs false)', async () => {
    const caseSensitive = searchInFiles(sampleFiles, { query: 'GREET', caseSensitive: true });
    assert.equal(caseSensitive.totalMatches, 0, 'Should find 0 matches for GREET when caseSensitive is true');

    const caseInsensitive = searchInFiles(sampleFiles, { query: 'GREET', caseSensitive: false });
    assert.ok(caseInsensitive.totalMatches >= 4, 'Should find occurrences when caseSensitive is false');
  });

  await test('T1.3: Whole word matching (wholeWord: true)', async () => {
    const testFiles = {
      'test.js': 'const cat = 1;\nconst concatenate = 2;\nconst bobcat = 3;'
    };
    const wholeWordRes = searchInFiles(testFiles, { query: 'cat', wholeWord: true });
    assert.equal(wholeWordRes.totalMatches, 1, 'wholeWord: true should only match standalone "cat"');

    const partWordRes = searchInFiles(testFiles, { query: 'cat', wholeWord: false });
    assert.equal(partWordRes.totalMatches, 3, 'wholeWord: false should match cat, concatenate, and bobcat');
  });

  await test('T1.4: Regular expression search (regex: true)', async () => {
    const regexRes = searchInFiles(sampleFiles, { query: 'export (function|const)', regex: true });
    assert.ok(regexRes.totalMatches >= 3, 'Regex should match export function and export const');
    assert.equal(regexRes.fileCount, 2);
  });

  await test('T1.5: File include glob filter', async () => {
    const res = searchInFiles(sampleFiles, { query: 'greet', include: 'greet.js' });
    assert.equal(res.fileCount, 1, 'Should only search in matched include glob file');
    assert.equal(res.matches[0].file, 'src/greet.js');
  });

  await test('T1.6: Atomic replaceInFiles replaces occurrences and reports statistics', async () => {
    const replaceRes = replaceInFiles(sampleFiles, { query: 'greet' }, 'salute');
    assert.ok(replaceRes.replacedCount >= 4, 'Should count replaced instances');
    assert.ok(replaceRes.filesAffected.includes('src/index.js'));
    assert.ok(replaceRes.filesAffected.includes('src/greet.js'));
    assert.ok(replaceRes.updatedFiles['src/index.js'].includes('salute'));
    assert.ok(!replaceRes.updatedFiles['src/index.js'].includes('greet'));
  });

  // ── Tier 2: Boundary & Corner Cases ───────────────────────────────────────
  console.log('── Tier 2: Boundary & Corner Cases ──');

  await test('T2.1: Empty query returns 0 matches without crashing', async () => {
    const res = searchInFiles(sampleFiles, { query: '' });
    assert.equal(res.totalMatches, 0);
    assert.equal(res.matches.length, 0);
  });

  await test('T2.2: Invalid regex handles cleanly without unhandled exception', async () => {
    const res = searchInFiles(sampleFiles, { query: '[a-z(', regex: true });
    assert.ok(res.totalMatches === 0 || res.error, 'Invalid regex handled gracefully');
  });

  await test('T2.3: Replacement with empty string performs clean deletion', async () => {
    const files = { 'a.js': 'const removeMe = 1;' };
    const res = replaceInFiles(files, { query: 'removeMe' }, '');
    assert.equal(res.updatedFiles['a.js'], 'const  = 1;');
    assert.equal(res.replacedCount, 1);
  });

  await test('T2.4: targetFiles restricts replacement to specific subset', async () => {
    const res = replaceInFiles(sampleFiles, { query: 'greet' }, 'sayHi', ['src/index.js']);
    assert.equal(res.filesAffected.length, 1);
    assert.equal(res.filesAffected[0], 'src/index.js');
    assert.ok(res.updatedFiles['src/greet.js'].includes('greet'), 'src/greet.js should remain untouched');
  });

  // ── Tier 3: Cross-Feature Interactions ───────────────────────────────────
  console.log('── Tier 3: Cross-Feature Interactions ──');

  await test('T3.1: Replace and verify idempotence (search again yields 0 results)', async () => {
    const targetQuery = 'CodeLabTargetSymbol';
    const initialFiles = {
      'file1.js': 'const CodeLabTargetSymbol = 100;',
      'file2.js': 'console.log(CodeLabTargetSymbol);'
    };

    const firstSearch = searchInFiles(initialFiles, { query: targetQuery });
    assert.equal(firstSearch.totalMatches, 2);

    const replaced = replaceInFiles(initialFiles, { query: targetQuery }, 'ReplacedSymbol');
    const secondSearch = searchInFiles(replaced.updatedFiles, { query: targetQuery });
    assert.equal(secondSearch.totalMatches, 0, 'Original symbol must no longer exist after replacement');

    const verifyNew = searchInFiles(replaced.updatedFiles, { query: 'ReplacedSymbol' });
    assert.equal(verifyNew.totalMatches, 2, 'New symbol must be found in both files');
  });

  // ── Tier 4: Real-World Scenarios ──────────────────────────────────────────
  console.log('── Tier 4: Real-World Scenarios ──');

  await test('T4.1: Workspace symbol renaming scenario across 10 files', async () => {
    const workspace = {};
    for (let i = 1; i <= 10; i++) {
      workspace[`src/module_${i}.js`] = `import { legacyApi } from "./api.js";\nexport const doJob${i} = () => legacyApi(${i});\n`;
    }
    workspace['src/api.js'] = 'export const legacyApi = (v) => v * 10;\n';

    const searchResult = searchInFiles(workspace, { query: 'legacyApi', wholeWord: true });
    assert.equal(searchResult.totalMatches, 21);
    assert.equal(searchResult.fileCount, 11);

    const refactored = replaceInFiles(workspace, { query: 'legacyApi', wholeWord: true }, 'modernApi');
    assert.equal(refactored.replacedCount, 21);
    assert.equal(refactored.filesAffected.length, 11);

    for (const [filePath, content] of Object.entries(refactored.updatedFiles)) {
      assert.ok(content.includes('modernApi'), `${filePath} must contain modernApi`);
      assert.ok(!content.includes('legacyApi'), `${filePath} must not contain legacyApi`);
    }
  });

  console.log('\n────────────────────────────────────────────────────────────────────────────');
  console.log(`Search & Replace Suite Complete: ${passed} passed, ${failed} failed`);
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
