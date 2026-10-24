import { PythonExtensionOptions, PythonExtensionOptionsSchema, PythonToolchainProgress } from '../schemas';
import type { DiagnosticItem } from '../diagnostics';
import { CodeLabTestParser, type TestResultItem } from '../runtime/test-harness';

export const DEFAULT_PYTHON_CDN_BASE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';

export const PYTHON_TOOLCHAIN_PRESETS = {
  latest: 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/',
  v0_26: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
};

/**
 * Built-in Python modules seeded into `/usr/lib/python` inside the VirtualFS.
 */
export const BUILTIN_PYTHON_MODULES: Record<string, string> = {
  '/usr/lib/python/codelab_dsa.py': `# CodeLab <codelab_dsa.py> - Data Structures & Algorithms Utilities
from typing import Optional, List, Any

class ListNode:
    def __init__(self, val: int = 0, next: Optional['ListNode'] = None):
        self.val = val
        self.next = next

    def __repr__(self):
        vals = []
        curr = self
        while curr and len(vals) < 50:
            vals.append(str(curr.val))
            curr = curr.next
        if curr:
            vals.append("...")
        return "[" + " -> ".join(vals) + "]"

class TreeNode:
    def __init__(self, val: int = 0, left: Optional['TreeNode'] = None, right: Optional['TreeNode'] = None):
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self):
        return f"TreeNode({self.val})"

def build_linked_list(vals: List[int]) -> Optional[ListNode]:
    if not vals:
        return None
    dummy = ListNode(0)
    tail = dummy
    for v in vals:
        tail.next = ListNode(v)
        tail = tail.next
    return dummy.next

def linked_list_to_list(head: Optional[ListNode]) -> List[int]:
    out = []
    curr = head
    while curr is not None:
        out.append(curr.val)
        curr = curr.next
    return out

def build_binary_tree(vals: List[Optional[int]]) -> Optional[TreeNode]:
    if not vals or vals[0] is None:
        return None
    root = TreeNode(vals[0])
    queue = [root]
    i = 1
    while queue and i < len(vals):
        curr = queue.pop(0)
        if i < len(vals) and vals[i] is not None:
            curr.left = TreeNode(vals[i])
            queue.append(curr.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            curr.right = TreeNode(vals[i])
            queue.append(curr.right)
        i += 1
    return root

def binary_tree_to_list(root: Optional[TreeNode]) -> List[Optional[int]]:
    if not root:
        return []
    out = []
    queue = [root]
    while queue:
        curr = queue.pop(0)
        if curr is not None:
            out.append(curr.val)
            queue.append(curr.left)
            queue.append(curr.right)
        else:
            out.append(None)
    while out and out[-1] is None:
        out.pop()
    return out

import heapq

class MinHeap:
    def __init__(self, items: Optional[List[Any]] = None):
        self._data = list(items) if items else []
        heapq.heapify(self._data)

    def push(self, val: Any):
        heapq.heappush(self._data, val)

    def pop(self) -> Any:
        return heapq.heappop(self._data)

    def peek(self) -> Optional[Any]:
        return self._data[0] if self._data else None

    def __len__(self) -> int:
        return len(self._data)

class MaxHeap:
    def __init__(self, items: Optional[List[Any]] = None):
        self._data = [-x for x in items] if items else []
        heapq.heapify(self._data)

    def push(self, val: Any):
        heapq.heappush(self._data, -val)

    def pop(self) -> Any:
        return -heapq.heappop(self._data)

    def peek(self) -> Optional[Any]:
        return -self._data[0] if self._data else None

    def __len__(self) -> int:
        return len(self._data)
`,

  '/usr/lib/python/codelab_test.py': `# CodeLab <codelab_test.py> - Structured Test Harness
import json
import time
import sys
import traceback
from typing import Any, Callable

_SUITE_NAME = "Default Test Suite"
_PASSED_COUNT = 0
_FAILED_COUNT = 0
_TOTAL_COUNT = 0

def DESCRIBE(name: str):
    global _SUITE_NAME
    _SUITE_NAME = str(name)

def TEST(name: str, fn: Callable[[], Any]):
    global _PASSED_COUNT, _FAILED_COUNT, _TOTAL_COUNT
    _TOTAL_COUNT += 1
    start = time.perf_counter()
    err_obj = None
    passed = False
    try:
        fn()
        passed = True
        _PASSED_COUNT += 1
    except AssertionError as e:
        _FAILED_COUNT += 1
        msg = str(e) or "Assertion failed"
        err_obj = {"name": "AssertionError", "message": msg, "stack": traceback.format_exc()}
    except Exception as e:
        _FAILED_COUNT += 1
        err_obj = {"name": type(e).__name__, "message": str(e), "stack": traceback.format_exc()}
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        event = {
            "name": name,
            "passed": passed,
            "durationMs": duration_ms,
            "error": err_obj
        }
        print(f"__CODELAB_TEST__:{json.dumps(event)}", flush=True)

def ASSERT_TRUE(condition: bool, msg: str = "Expected condition to be True"):
    if not bool(condition):
        raise AssertionError(msg)

def ASSERT_FALSE(condition: bool, msg: str = "Expected condition to be False"):
    if bool(condition):
        raise AssertionError(msg)

def ASSERT_EQ(actual: Any, expected: Any, msg: str = None):
    if actual != expected:
        err = msg or f"Assertion failed: expected {expected!r}, got {actual!r}"
        raise AssertionError(err)

def ASSERT_NE(actual: Any, expected: Any, msg: str = None):
    if actual == expected:
        err = msg or f"Assertion failed: expected value not equal to {expected!r}"
        raise AssertionError(err)

def CODELAB_TEST_EXIT_CODE() -> int:
    return 0 if _FAILED_COUNT == 0 else 1

from contextlib import contextmanager

@contextmanager
def describe(name: str):
    DESCRIBE(name)
    yield

@contextmanager
def it(name: str):
    global _TOTAL_COUNT, _PASSED_COUNT, _FAILED_COUNT
    _TOTAL_COUNT += 1
    start = time.perf_counter()
    passed = False
    err_obj = None
    try:
        yield
        passed = True
        _PASSED_COUNT += 1
    except AssertionError as e:
        _FAILED_COUNT += 1
        err_obj = {"name": "AssertionError", "message": str(e) or "Assertion failed", "stack": traceback.format_exc()}
    except Exception as e:
        _FAILED_COUNT += 1
        err_obj = {"name": type(e).__name__, "message": str(e), "stack": traceback.format_exc()}
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        event = {"name": name, "passed": passed, "durationMs": duration_ms, "error": err_obj}
        print(f"__CODELAB_TEST__:{json.dumps(event)}", flush=True)

test = it
assert_equal = ASSERT_EQ
assert_true = ASSERT_TRUE
assert_false = ASSERT_FALSE
`
};

export const CODELAB_PYTHON_LIBS = BUILTIN_PYTHON_MODULES;

export interface ExtendedPythonExtensionOptions extends PythonExtensionOptions {
  [key: string]: any;
}

export interface PythonCompileResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  peakMemoryBytes: number;
  durationMs: number;
  testResults?: TestResultItem[];
}

export interface PythonSymbolDoc {
  label: string;
  kind?: string;
  detail: string;
  documentation: string;
  insertText?: string;
  module?: string;
  complexity?: string;
}

export const PYTHON_COMPLETIONS_AND_HOVERS: Record<string, PythonSymbolDoc> = {
  'collections.deque': {
    label: 'collections.deque',
    detail: 'class collections.deque([iterable[, maxlen]])',
    documentation: 'Double-ended queue with $O(1)$ appends and pops from either end.\n\n- Module: `collections`\n- append/pop/appendleft/popleft: $O(1)$',
    insertText: 'from collections import deque\n${1:dq} = deque()',
    module: 'collections',
    complexity: 'O(1) end operations'
  },
  'collections.defaultdict': {
    label: 'collections.defaultdict',
    detail: 'class collections.defaultdict(default_factory=None, /[, ...])',
    documentation: 'Dict subclass that calls a factory function to supply missing values.\n\n- Module: `collections`',
    insertText: 'from collections import defaultdict\n${1:d} = defaultdict(${2:list})',
    module: 'collections',
    complexity: 'O(1) average lookup'
  },
  'collections.Counter': {
    label: 'collections.Counter',
    detail: 'class collections.Counter([iterable-or-mapping])',
    documentation: 'Dict subclass for counting hashable items.\n\n- Module: `collections`',
    insertText: 'from collections import Counter\n${1:counts} = Counter(${2:items})',
    module: 'collections',
    complexity: 'O(N) initialization'
  },
  'heapq.heappush': {
    label: 'heapq.heappush',
    detail: 'heapq.heappush(heap, item)',
    documentation: 'Pushes item onto heap, maintaining the min-heap invariant.\n\n- Module: `heapq`\n- Complexity: $O(\\log N)$',
    insertText: 'heapq.heappush(${1:heap}, ${2:item})',
    module: 'heapq',
    complexity: 'O(log N)'
  },
  'heapq.heappop': {
    label: 'heapq.heappop',
    detail: 'heapq.heappop(heap)',
    documentation: 'Pops and returns the smallest item from heap, maintaining invariant.\n\n- Module: `heapq`\n- Complexity: $O(\\log N)$',
    insertText: 'heapq.heappop(${1:heap})',
    module: 'heapq',
    complexity: 'O(log N)'
  },
  'bisect.bisect_left': {
    label: 'bisect.bisect_left',
    detail: 'bisect.bisect_left(a, x, lo=0, hi=len(a))',
    documentation: 'Locates the insertion point for x in a to maintain sorted order (leftmost index).\n\n- Module: `bisect`\n- Complexity: $O(\\log N)$',
    insertText: 'bisect.bisect_left(${1:a}, ${2:x})',
    module: 'bisect',
    complexity: 'O(log N)'
  },
  'functools.lru_cache': {
    label: 'functools.lru_cache',
    detail: '@functools.lru_cache(maxsize=128, typed=False)',
    documentation: 'Decorator to wrap a function with a memoizing callable that saves up to maxsize results.\n\n- Module: `functools`',
    insertText: '@lru_cache(maxsize=None)\ndef ${1:fn}(${2:args}):\n    pass',
    module: 'functools',
    complexity: 'O(1) cached lookup'
  },
  'codelab_dsa.ListNode': {
    label: 'ListNode',
    detail: 'class ListNode(val=0, next=None)',
    documentation: 'LeetCode / DSA standard singly-linked list node.\n\n- Module: `codelab_dsa`',
    insertText: 'ListNode(${1:val})',
    module: 'codelab_dsa',
    complexity: 'O(1)'
  },
  'codelab_dsa.TreeNode': {
    label: 'TreeNode',
    detail: 'class TreeNode(val=0, left=None, right=None)',
    documentation: 'LeetCode / DSA standard binary tree node.\n\n- Module: `codelab_dsa`',
    insertText: 'TreeNode(${1:val})',
    module: 'codelab_dsa',
    complexity: 'O(1)'
  },
  'codelab_dsa.build_linked_list': {
    label: 'build_linked_list',
    detail: 'build_linked_list(vals: list[int]) -> Optional[ListNode]',
    documentation: 'Builds a singly-linked list from a Python list of integers.\n\n- Module: `codelab_dsa`\n- Complexity: $O(N)$',
    insertText: 'build_linked_list([${1:1, 2, 3}])',
    module: 'codelab_dsa',
    complexity: 'O(N)'
  },
  'codelab_dsa.linked_list_to_list': {
    label: 'linked_list_to_list',
    detail: 'linked_list_to_list(head: Optional[ListNode]) -> list[int]',
    documentation: 'Traverses a linked list and collects values into a Python list.\n\n- Module: `codelab_dsa`\n- Complexity: $O(N)$',
    insertText: 'linked_list_to_list(${1:head})',
    module: 'codelab_dsa',
    complexity: 'O(N)'
  },
  'codelab_dsa.build_binary_tree': {
    label: 'build_binary_tree',
    detail: 'build_binary_tree(vals: list[Optional[int]]) -> Optional[TreeNode]',
    documentation: 'Constructs a binary tree level-by-level from a list containing None for null nodes.\n\n- Module: `codelab_dsa`\n- Complexity: $O(N)$',
    insertText: 'build_binary_tree([${1:1, 2, 3}])',
    module: 'codelab_dsa',
    complexity: 'O(N)'
  },
  'codelab_test.DESCRIBE': {
    label: 'DESCRIBE',
    detail: 'DESCRIBE(name: str)',
    documentation: 'Defines the active test suite description in CodeLab test harness.\n\n- Module: `codelab_test`',
    insertText: 'DESCRIBE("${1:Suite Name}")\n',
    module: 'codelab_test',
    complexity: 'Test Suite Header'
  },
  'codelab_test.TEST': {
    label: 'TEST',
    detail: 'TEST(name: str, fn: Callable)',
    documentation: 'Runs a single test case; emits structured __CODELAB_TEST__ telemetry.\n\n- Module: `codelab_test`',
    insertText: 'def test_${1:case}():\n    ASSERT_EQ(${2:actual}, ${3:expected})\n\nTEST("${4:description}", test_${1:case})',
    module: 'codelab_test',
    complexity: 'Test Case Runner'
  },
  'codelab_test.ASSERT_EQ': {
    label: 'ASSERT_EQ',
    detail: 'ASSERT_EQ(actual, expected, msg=None)',
    documentation: 'Asserts that actual == expected; logs failure message if not.\n\n- Module: `codelab_test`',
    insertText: 'ASSERT_EQ(${1:actual}, ${2:expected})',
    module: 'codelab_test',
    complexity: 'Assertion'
  },
  'codelab_test.ASSERT_TRUE': {
    label: 'ASSERT_TRUE',
    detail: 'ASSERT_TRUE(condition, msg=None)',
    documentation: 'Asserts condition is True.\n\n- Module: `codelab_test`',
    insertText: 'ASSERT_TRUE(${1:condition})',
    module: 'codelab_test',
    complexity: 'Assertion'
  },
  'codelab_test.ASSERT_FALSE': {
    label: 'ASSERT_FALSE',
    detail: 'ASSERT_FALSE(condition, msg=None)',
    documentation: 'Asserts condition is False.\n\n- Module: `codelab_test`',
    insertText: 'ASSERT_FALSE(${1:condition})',
    module: 'codelab_test',
    complexity: 'Assertion'
  },
  'codelab_test.CODELAB_TEST_EXIT_CODE': {
    label: 'CODELAB_TEST_EXIT_CODE',
    detail: 'CODELAB_TEST_EXIT_CODE() -> int',
    documentation: 'Returns 0 if all tests passed, 1 if any failed.\n\n- Module: `codelab_test`',
    insertText: 'sys.exit(CODELAB_TEST_EXIT_CODE())',
    module: 'codelab_test',
    complexity: 'Exit Code'
  }
};

let _monacoPyRegistered = false;

/**
 * Registers Monaco Python completion and hover providers.
 */
export function registerMonacoPythonLanguageService(monacoInstance: any): boolean {
  if (!monacoInstance || !monacoInstance.languages) return false;
  if (_monacoPyRegistered) return true;
  _monacoPyRegistered = true;

  try {
    monacoInstance.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.'],
      provideCompletionItems(model: any, position: any) {
        const wordInfo = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn
        };

        const suggestions = Object.keys(PYTHON_COMPLETIONS_AND_HOVERS).map((key) => {
          const item = PYTHON_COMPLETIONS_AND_HOVERS[key];
          return {
            label: item.label,
            kind: monacoInstance.languages.CompletionItemKind.Function,
            detail: item.detail,
            documentation: { value: item.documentation },
            insertText: item.insertText || item.label,
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
          };
        });

        return { suggestions };
      }
    });

    monacoInstance.languages.registerHoverProvider('python', {
      provideHover(model: any, position: any) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        let item: PythonSymbolDoc | null = null;
        for (const k of Object.keys(PYTHON_COMPLETIONS_AND_HOVERS)) {
          if (k === word.word || k.endsWith('.' + word.word)) {
            item = PYTHON_COMPLETIONS_AND_HOVERS[k];
            break;
          }
        }
        if (!item) return null;

        return {
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          },
          contents: [
            { value: `**${item.label}** — \`${item.detail}\`` },
            { value: item.documentation }
          ]
        };
      }
    });
    return true;
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Python Monaco Intelligence Error]:', err);
    }
    return false;
  }
}

/**
 * Tier-1 instant Python static AST and syntax checker.
 */
export function analyzePythonSource(source: string, filename = 'main.py'): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  if (!source || typeof source !== 'string') return diagnostics;

  const lines = source.split('\n');

  // 1. Bracket stack matching
  const stack: Array<{ char: string; line: number; col: number }> = [];
  const matching: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  let expectIndentAfterLine = 0;
  let expectIndentMin = 0;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const lineNum = l + 1;
    let inStr = false;
    let strChar = '';

    // Check mixed tab and space indentation
    const indentMatch = line.match(/^([ \t]+)/);
    const indentLen = indentMatch ? indentMatch[1].length : 0;
    if (indentMatch) {
      const indent = indentMatch[1];
      if (indent.includes('\t') && indent.includes(' ')) {
        diagnostics.push({
          id: `py-tab-space-mix-${lineNum}`,
          file: filename,
          line: lineNum,
          startLineNumber: lineNum,
          col: 1,
          startColumn: 1,
          severity: 'warning',
          message: 'Inconsistent use of tabs and spaces in indentation.',
          source: 'python-linter'
        } as any);
      }
    }

    const trimmed = line.trim();

    // Check expected indentation after ':'
    if (expectIndentAfterLine > 0 && trimmed && !trimmed.startsWith('#')) {
      if (indentLen <= expectIndentMin) {
        diagnostics.push({
          id: `py-indent-error-${lineNum}`,
          file: filename,
          line: lineNum,
          startLineNumber: lineNum,
          col: 1,
          startColumn: 1,
          severity: 'error',
          message: `IndentationError: expected an indented block after statement on line ${expectIndentAfterLine}.`,
          source: 'python-linter'
        } as any);
      }
      expectIndentAfterLine = 0;
    }

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (!inStr && ch === '#') break; // Comment

      if (ch === '"' || ch === '\'') {
        if (!inStr) {
          inStr = true;
          strChar = ch;
        } else if (strChar === ch && (c === 0 || line[c - 1] !== '\\')) {
          inStr = false;
        }
        continue;
      }

      if (inStr) continue;

      if (ch === '(' || ch === '[' || ch === '{') {
        stack.push({ char: ch, line: lineNum, col: c + 1 });
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const expected = matching[ch];
        const last = stack.pop();
        if (!last) {
          diagnostics.push({
            id: `py-bracket-unmatched-${lineNum}-${c + 1}`,
            file: filename,
            line: lineNum,
            startLineNumber: lineNum,
            col: c + 1,
            startColumn: c + 1,
            severity: 'error',
            message: `Unmatched closing bracket '${ch}'.`,
            source: 'python-linter'
          } as any);
        } else if (last.char !== expected) {
          diagnostics.push({
            id: `py-bracket-mismatch-${lineNum}-${c + 1}`,
            file: filename,
            line: lineNum,
            startLineNumber: lineNum,
            col: c + 1,
            startColumn: c + 1,
            severity: 'error',
            message: `Mismatched bracket: expected closing for '${last.char}' from line ${last.line}, found '${ch}'.`,
            source: 'python-linter'
          } as any);
        }
      }
    }

    if (inStr && !line.includes('"""') && !line.includes("'''")) {
      diagnostics.push({
        id: `py-eol-string-${lineNum}`,
        file: filename,
        line: lineNum,
        startLineNumber: lineNum,
        col: line.length,
        startColumn: line.length,
        severity: 'error',
        message: 'SyntaxError: EOL while scanning string literal.',
        source: 'python-linter'
      } as any);
    }

    // Check missing colon or setup expected indentation
    if (/^(?:def\b|class\b|if\b|elif\b|else\b|for\b|while\b|try\b|finally\b|except\b|with\b)/.test(trimmed)) {
      if (!trimmed.endsWith(':')) {
        diagnostics.push({
          id: `py-missing-colon-${lineNum}`,
          file: filename,
          line: lineNum,
          startLineNumber: lineNum,
          col: line.length,
          startColumn: line.length,
          severity: 'error',
          message: `SyntaxError: expected ':' at end of line.`,
          source: 'python-linter'
        } as any);
      } else if (trimmed.endsWith(':')) {
        expectIndentAfterLine = lineNum;
        expectIndentMin = indentLen;
      }
    }
  }

  for (const unclosed of stack) {
    diagnostics.push({
      id: `py-unclosed-bracket-${unclosed.line}-${unclosed.col}`,
      file: filename,
      line: unclosed.line,
      startLineNumber: unclosed.line,
      col: unclosed.col,
      startColumn: unclosed.col,
      severity: 'error',
      message: `SyntaxError: closing parenthesis does not match or unclosed bracket '${unclosed.char}' opened on line ${unclosed.line}.`,
      source: 'python-linter'
    } as any);
  }

  return diagnostics;
}

/**
 * Parses Python tracebacks and SyntaxErrors from stderr and pushes into DiagnosticsStore & Monaco markers.
 */
export function applyPythonTracebackDiagnostics(
  stderrText: string,
  diagnosticsStore?: any,
  monacoInstance?: any,
  activeModel?: any
): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  if (!stderrText || typeof stderrText !== 'string') return diagnostics;

  if (diagnosticsStore && typeof diagnosticsStore.clear === 'function') {
    diagnosticsStore.clear('python');
  }

  // Regex matching Python File ".../workspace/<file>.py", line <N>
  const tbRegex = /File\s+["'](?:(?:\/workspace\/)?([^"']+))["'],\s+line\s+(\d+)(?:,\s+in\s+([A-Za-z0-9_<>]+))?/g;
  let lastFile = 'main.py';
  let lastLine = 1;
  let match: RegExpExecArray | null;

  while ((match = tbRegex.exec(stderrText)) !== null) {
    lastFile = match[1].replace(/^\/workspace\//, '');
    lastLine = parseInt(match[2], 10) || 1;
  }

  // Look for exception line e.g. "NameError: name 'foo' is not defined" or "SyntaxError: invalid syntax"
  const lines = stderrText.trim().split('\n');
  const errLine = lines[lines.length - 1] || 'Python Execution Error';

  if (errLine.includes('Error:') || errLine.includes('Exception:') || errLine.includes('Error')) {
    const item: DiagnosticItem = {
      id: `python-error-${lastFile}-${lastLine}`,
      file: lastFile,
      line: lastLine,
      startLineNumber: lastLine,
      col: 1,
      startColumn: 1,
      severity: 'error',
      message: `[Python] ${errLine.trim()}`,
      source: 'python'
    } as any;
    diagnostics.push(item);
    if (diagnosticsStore && typeof diagnosticsStore.add === 'function') {
      diagnosticsStore.add(item);
    }
  }

  if (monacoInstance && activeModel && typeof monacoInstance.editor?.setModelMarkers === 'function') {
    const markers = diagnostics.map((d) => ({
      startLineNumber: d.line,
      startColumn: d.col || 1,
      endLineNumber: d.line,
      endColumn: 100,
      message: d.message,
      severity: monacoInstance.MarkerSeverity.Error
    }));
    monacoInstance.editor.setModelMarkers(activeModel, 'python', markers);
  }

  return diagnostics;
}

/**
 * Deterministic PEP 8 / 4-space indentation formatter.
 */
export function formatPythonSource(code: string): string {
  if (!code || typeof code !== 'string') return code;
  const lines = code.split('\n');
  const formatted: string[] = [];
  let indentLevel = 0;
  let emptyCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      emptyCount++;
      if (emptyCount <= 1 && formatted.length > 0) {
        formatted.push('');
      }
      continue;
    }
    emptyCount = 0;

    if (trimmed.startsWith('#')) {
      formatted.push('    '.repeat(indentLevel) + trimmed);
      continue;
    }

    // Dedent before checking line if it starts with dedent keywords
    if (/^(?:elif\b|else:|except\b|finally:|return\b|pass\b|raise\b)/.test(trimmed)) {
      if (/^(?:elif\b|else:|except\b|finally:)/.test(trimmed) && indentLevel > 0) {
        indentLevel--;
      }
    }

    formatted.push('    '.repeat(indentLevel) + trimmed);

    if (trimmed.endsWith(':')) {
      indentLevel++;
    }
  }

  while (formatted.length > 0 && formatted[formatted.length - 1] === '') {
    formatted.pop();
  }
  return formatted.join('\n') + '\n';
}

/**
 * Pyodide (CPython 3.12 WebAssembly) Toolchain Manager with IndexedDB cache.
 */
export class PythonToolchainManager {
  public readonly options: ExtendedPythonExtensionOptions;
  public pyodide: any = null;
  private _loadingPromise: Promise<any> | null = null;

  constructor(options: ExtendedPythonExtensionOptions = {}) {
    this.options = PythonExtensionOptionsSchema.parse(options);
  }

  public isLoaded(): boolean {
    return this.pyodide !== null;
  }

  public async preload(): Promise<any> {
    return this.ensureLoaded();
  }

  private _emitProgress(evt: PythonToolchainProgress) {
    if (typeof this.options.onProgress === 'function') {
      try {
        this.options.onProgress(evt);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Python progress callback warning]:', err);
        }
      }
    }
  }

  public async ensureLoaded(): Promise<any> {
    if (this.pyodide) return this.pyodide;
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      this._emitProgress({
        stage: 'downloading',
        percent: 10,
        message: 'Initializing CPython 3.12 WebAssembly (Pyodide)...'
      });

      // Browser environment: load pyodide.js from CDN
      if (typeof window !== 'undefined') {
        const cdn = this.options.cdnBaseUrl || DEFAULT_PYTHON_CDN_BASE_URL;
        if (!(window as any).loadPyodide) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${cdn.replace(/\/+$/, '')}/pyodide.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load pyodide.js from ${script.src}`));
            document.head.appendChild(script);
          });
        }

        this._emitProgress({
          stage: 'extracting',
          percent: 50,
          message: 'Bootstrapping Python runtime environment...'
        });

        const loadPyodideFn = (window as any).loadPyodide;
        this.pyodide = await loadPyodideFn({
          indexURL: cdn
        });
      } else {
        // Node / Bun headless mock toolchain for hermetic offline test runs
        this.pyodide = {
          FS: {
            files: new Map<string, string>(),
            writeFile(p: string, content: any) {
              this.files.set(p, typeof content === 'string' ? content : String(content));
            },
            readFile(p: string, opts?: any) {
              return this.files.get(p) || '';
            },
            unlink(p: string) {
              this.files.delete(p);
            },
            mkdirTree(_p: string) {}
          },
          runPythonAsync: async (code: string) => {
            return `Execution mock: ${code.slice(0, 30)}`;
          }
        };
      }

      // Preload specified packages if any
      if (this.options.preloadPackages && Array.isArray(this.options.preloadPackages)) {
        for (const pkg of this.options.preloadPackages) {
          try {
            if (typeof this.pyodide.loadPackage === 'function') {
              await this.pyodide.loadPackage(pkg);
            }
          } catch (err) {
            void err;
          }
        }
      }

      this._emitProgress({
        stage: 'ready',
        percent: 100,
        message: 'Python 3.12 WebAssembly Toolchain Ready'
      });

      return this.pyodide;
    })();

    return this._loadingPromise;
  }

  public async installPackages(packages: string[]): Promise<{ ok: boolean; installed: string[]; error?: string }> {
    const pyodide = await this.ensureLoaded();
    const installed: string[] = [];
    for (const pkg of packages) {
      if (!pkg || pkg.startsWith('-')) continue;
      try {
        if (typeof pyodide.loadPackage === 'function') {
          await pyodide.loadPackage(pkg);
          installed.push(pkg);
        } else if (pyodide.FS) {
          installed.push(pkg);
        }
      } catch (err: any) {
        return { ok: false, installed, error: err?.message || String(err) };
      }
    }
    return { ok: true, installed };
  }

  public async execute(req: {
    entry?: string;
    source?: string;
    vfs?: any;
    stdin?: string;
    testFilter?: string | string[];
    onStdout?: (msg: string) => void;
    onStderr?: (msg: string) => void;
  }): Promise<PythonCompileResult> {
    const start = performance.now();
    let stdoutAcc = '';
    let stderrAcc = '';
    const testResults: TestResultItem[] = [];
    const testParser = new CodeLabTestParser((item) => {
      testResults.push(item);
    });

    const handleOut = (msg: string) => {
      stdoutAcc += msg;
      const lines = msg.split('\n');
      for (const line of lines) {
        testParser.parseLine(line);
      }
      if (req.onStdout) req.onStdout(msg);
    };

    const handleErr = (msg: string) => {
      stderrAcc += msg;
      if (req.onStderr) req.onStderr(msg);
    };

    const pyodide = await this.ensureLoaded();

    // 1. Sync VFS files into Pyodide FS
    if (req.vfs && pyodide.FS) {
      try {
        const vfsEntries = req.vfs.readdirSync('/workspace', { recursive: true });
        for (const entry of vfsEntries) {
          const fullPath = `/workspace/${entry}`;
          if (!req.vfs.statSync(fullPath).isDirectory()) {
            const content = req.vfs.readFileSync(fullPath, 'utf8');
            pyodide.FS.mkdirTree('/workspace');
            pyodide.FS.writeFile(fullPath, content);
          }
        }
      } catch (err) {
        void err;
      }
    }

    // Seed builtin /usr/lib/python modules
    if (pyodide.FS) {
      try {
        pyodide.FS.mkdirTree('/usr/lib/python');
        for (const [p, content] of Object.entries(BUILTIN_PYTHON_MODULES)) {
          pyodide.FS.writeFile(p, content);
        }
      } catch (err) {
        void err;
      }
    }

    let codeToRun = req.source;
    if (!codeToRun && req.entry && req.vfs) {
      try {
        codeToRun = req.vfs.readFileSync(req.entry.startsWith('/') ? req.entry : `/workspace/${req.entry}`, 'utf8');
      } catch (err: any) {
        handleErr(`FileNotFoundError: [Errno 2] No such file or directory: '${req.entry}'\n`);
        return {
          ok: false,
          exitCode: 1,
          stdout: stdoutAcc,
          stderr: stderrAcc,
          peakMemoryBytes: 0,
          durationMs: performance.now() - start
        };
      }
    }

    codeToRun = codeToRun || '';

    let peakMemoryBytes = 1024 * 1024; // 1 MB default estimate
    let exitCode = 0;

    try {
      if (typeof window !== 'undefined' && pyodide.setStdout) {
        pyodide.setStdout({ batched: (msg: string) => handleOut(msg + '\n') });
        pyodide.setStderr({ batched: (msg: string) => handleErr(msg + '\n') });
        if (req.stdin && pyodide.setStdin) {
          let pos = 0;
          pyodide.setStdin({
            stdin: () => {
              if (pos < req.stdin!.length) {
                return req.stdin!.charCodeAt(pos++);
              }
              return null;
            }
          });
        }

        const rawLines = codeToRun.split('\n');
        const futureImports: string[] = [];
        const bodyLines: string[] = [];
        let inDocstring = false;
        let docChar = '';

        for (const l of rawLines) {
          const t = l.trim();
          if (!inDocstring && (t.startsWith('"""') || t.startsWith("'''"))) {
            if (t.length > 3 && (t.endsWith('"""') || t.endsWith("'''"))) {
              bodyLines.push(l);
              continue;
            }
            inDocstring = true;
            docChar = t.slice(0, 3);
            bodyLines.push(l);
            continue;
          }
          if (inDocstring) {
            if (t.endsWith(docChar)) inDocstring = false;
            bodyLines.push(l);
            continue;
          }
          if (/^from\s+__future__\s+import\s+/.test(t)) {
            futureImports.push(t);
          } else {
            bodyLines.push(l);
          }
        }

        const runnerWrapper = `
${futureImports.join('\n')}
import sys, tracemalloc
if '/usr/lib/python' not in sys.path:
    sys.path.insert(0, '/usr/lib/python')
if '/workspace' not in sys.path:
    sys.path.insert(0, '/workspace')

tracemalloc.start()
try:
${bodyLines.map((l) => '    ' + l).join('\n')}
finally:
    _, _peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
`;
        await pyodide.runPythonAsync(runnerWrapper);
        if (pyodide.globals && typeof pyodide.globals.get === 'function') {
          try {
            const rawPeak = pyodide.globals.get('_peak');
            if (typeof rawPeak === 'number' && rawPeak > 0) {
              peakMemoryBytes = rawPeak;
            }
          } catch (err) {
            void err;
          }
        }
      } else {
        // Mock Node/Bun execution
        if (req.source && /sys\.exit\(\s*(\d+)?\s*\)/.test(req.source)) {
          const m = req.source.match(/sys\.exit\(\s*(\d+)?\s*\)/);
          exitCode = m && m[1] !== undefined ? parseInt(m[1], 10) : 0;
          if (exitCode !== 0) {
            handleErr(`SystemExit: ${exitCode}\n`);
          }
        } else {
          handleOut(`[Python 3.12 Wasm]: Executed ${req.entry || 'snippet'}\n`);
        }
      }
    } catch (err: any) {
      const errMsg = err && err.message ? err.message : String(err);
      const isSystemExit = /SystemExit(?::\s*([0-9]+|None)?)?/.test(errMsg);
      if (isSystemExit) {
        const match = errMsg.match(/SystemExit(?::\s*([0-9]+))?/);
        exitCode = match && match[1] !== undefined ? parseInt(match[1], 10) : 0;
        if (exitCode !== 0) {
          handleErr(errMsg + '\n');
        }
      } else {
        exitCode = 1;
        handleErr(errMsg + '\n');
      }
    }

    // 2. Sync back files from Pyodide FS into VFS
    if (req.vfs && pyodide.FS && typeof pyodide.FS.readdir === 'function') {
      try {
        const files = pyodide.FS.readdir('/workspace');
        for (const f of files) {
          if (f !== '.' && f !== '..') {
            const p = `/workspace/${f}`;
            try {
              const content = pyodide.FS.readFile(p, { encoding: 'utf8' });
              req.vfs.writeFileSync(p, content);
            } catch (err) {
              void err;
            }
          }
        }
      } catch (err) {
        void err;
      }
    }

    const durationMs = performance.now() - start;

    return {
      ok: exitCode === 0,
      exitCode,
      stdout: stdoutAcc,
      stderr: stderrAcc,
      peakMemoryBytes,
      durationMs,
      testResults
    };
  }
}

/**
 * Seeds `/usr/lib/python` headers and libraries into the VirtualFS.
 */
export function seedPythonModulesIntoVfs(vfs: any) {
  if (!vfs) return;
  for (const [p, content] of Object.entries(BUILTIN_PYTHON_MODULES)) {
    const withoutSlash = p.replace(/^\//, '');
    if (typeof vfs.writeFileSync === 'function') {
      try {
        if (typeof vfs.mkdirSync === 'function') {
          vfs.mkdirSync('/usr/lib/python', { recursive: true });
        }
      } catch (err) {
        void err;
      }
      try {
        vfs.writeFileSync(p, content);
      } catch (err) {
        void err;
      }
    }
    if (vfs.files && typeof vfs.files === 'object') {
      vfs.files[p] = content;
      vfs.files[withoutSlash] = content;
    }
    if (typeof vfs === 'object' && typeof vfs.writeFileSync !== 'function') {
      vfs[p] = content;
      vfs[withoutSlash] = content;
    }
  }
}

/**
 * Registers the Python compiler toolchain on the global runtime.
 */
export function registerPythonCompilerOnRuntime(toolchain: PythonToolchainManager) {
  const compilerFn = async (req: any) => {
    return toolchain.execute(req);
  };

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__codelabPythonCompiler = compilerFn;
    (globalThis as any).__codelabPythonToolchain = toolchain;
  }
  if (typeof window !== 'undefined') {
    (window as any).__codelabPythonCompiler = compilerFn;
    (window as any).__codelabPythonToolchain = toolchain;
  }
  return compilerFn;
}

function installPythonExtension(workbench: any, options: ExtendedPythonExtensionOptions = {}) {
  const toolchain = new PythonToolchainManager(options);
  const compilerFn = registerPythonCompilerOnRuntime(toolchain);

  if (!workbench) return toolchain;

  workbench.pythonToolchain = toolchain;
  workbench.pythonCompiler = compilerFn;
  workbench.pythonOptions = toolchain.options;
  if (workbench.shell && workbench.shell.options) {
    workbench.shell.options.pythonCompiler = compilerFn;
    workbench.shell.options.pythonToolchain = toolchain;
  }

  if (typeof window !== 'undefined' && (window as any).monaco) {
    registerMonacoPythonLanguageService((window as any).monaco);
  }

  if (!workbench.enabledLanguages || !(workbench.enabledLanguages instanceof Set)) {
    workbench.enabledLanguages = new Set(['js', 'py']);
  } else {
    workbench.enabledLanguages.add('py');
  }

  if (options.files && typeof options.files === 'object') {
    workbench.pyFiles = { ...(workbench.pyFiles || {}), ...options.files };
    if (workbench.guidedConfig) {
      workbench.guidedConfig.pyFiles = { ...(workbench.guidedConfig.pyFiles || {}), ...options.files };
    }
  }
  if (options.starterFiles && typeof options.starterFiles === 'object') {
    if (!workbench.guidedConfig) workbench.guidedConfig = {};
    workbench.guidedConfig.pyStarterFiles = {
      ...(workbench.guidedConfig.pyStarterFiles || {}),
      ...options.starterFiles
    };
  }
  if (options.solutionFiles && typeof options.solutionFiles === 'object') {
    if (!workbench.guidedConfig) workbench.guidedConfig = {};
    workbench.guidedConfig.pySolutionFiles = {
      ...(workbench.guidedConfig.pySolutionFiles || {}),
      ...options.solutionFiles
    };
  }

  if (workbench.vfs) {
    seedPythonModulesIntoVfs(workbench.vfs);
  }

  workbench.hasMultipleLanguages = workbench.enabledLanguages.size > 1;

  // Debounced static syntax & traceback linter
  if (workbench._diagnosticsStore) {
    let pyLintTimer: any = null;
    workbench._pyLintHandler = (file: string, code: string) => {
      if (!file || !file.endsWith('.py')) return;
      if (pyLintTimer) clearTimeout(pyLintTimer);
      pyLintTimer = setTimeout(() => {
        const diags = analyzePythonSource(code, file);
        workbench._diagnosticsStore.clear('python-linter');
        for (const d of diags) {
          workbench._diagnosticsStore.add(d);
        }
        if (typeof window !== 'undefined' && (window as any).monaco && workbench.editor) {
          const model = workbench.editor.getModel();
          if (model) {
            const markers = diags.map((d) => ({
              startLineNumber: d.line,
              startColumn: d.col || 1,
              endLineNumber: d.line,
              endColumn: (d.col || 1) + 20,
              message: d.message,
              severity: d.severity === 'error'
                ? (window as any).monaco.MarkerSeverity.Error
                : (window as any).monaco.MarkerSeverity.Warning
            }));
            (window as any).monaco.editor.setModelMarkers(model, 'python-linter', markers);
          }
        }
      }, 180);
    };
  }

  if (options.preload) {
    toolchain.ensureLoaded().catch((err) => {
      if (typeof workbench._appendTerminalOutput === 'function') {
        workbench._appendTerminalOutput('stderr', `[Python Toolchain preload warning]: ${err.message || err}\n`);
      }
    });
  }

  if (options.activate && typeof workbench.setLanguage === 'function') {
    workbench.setLanguage('py');
  } else if (typeof workbench._refreshToolbarAndTabs === 'function') {
    workbench._refreshToolbarAndTabs();
  } else if (typeof workbench._renderShell === 'function' && workbench.container) {
    workbench._renderShell();
    if (typeof workbench._bindEvents === 'function') workbench._bindEvents();
    if (typeof workbench._renderFileLists === 'function') workbench._renderFileLists();
  }

  return toolchain;
}

/**
 * Real Python 3.12 (CPython WebAssembly via Pyodide) Extension for CodeLab.
 */
export function pythonExtension(workbenchOrOptions?: any, maybeOptions?: ExtendedPythonExtensionOptions): any {
  if (workbenchOrOptions === null) {
    const toolchain = new PythonToolchainManager(maybeOptions || {});
    registerPythonCompilerOnRuntime(toolchain);
    return toolchain;
  }
  if (
    workbenchOrOptions === undefined ||
    (typeof workbenchOrOptions === 'object' &&
      !('enabledLanguages' in workbenchOrOptions) &&
      !('container' in workbenchOrOptions) &&
      !('_renderShell' in workbenchOrOptions))
  ) {
    const opts = (workbenchOrOptions || {}) as ExtendedPythonExtensionOptions;
    const plugin: any = (wb: any, runOpts: any = {}) => {
      return installPythonExtension(wb, { ...opts, ...(runOpts || {}) });
    };
    plugin.extensionName = 'python';
    plugin.languageId = 'py';
    plugin.install = plugin;
    return plugin;
  }
  return installPythonExtension(workbenchOrOptions, maybeOptions);
}

export function createPythonExtension(options: ExtendedPythonExtensionOptions = {}) {
  return pythonExtension(options);
}

export default pythonExtension;
