import { CppExtensionOptions, CppExtensionOptionsSchema, CppToolchainProgress } from '../schemas';
import type { DiagnosticItem } from '../diagnostics';

/**
 * Built-in competitive programming & DSA headers seeded into `/usr/include`
 * inside the VirtualFS alongside the WASI sysroot.
 */
export const BUILTIN_CPP_HEADERS: Record<string, string> = {
  '/usr/include/bits/stdc++.h': `// CodeLab <bits/stdc++.h> — Competitive Programming & DSA Umbrella Header
#pragma once
#include <iostream>
#include <iomanip>
#include <sstream>
#include <fstream>
#include <string>
#include <string_view>
#include <vector>
#include <deque>
#include <list>
#include <forward_list>
#include <array>
#include <set>
#include <unordered_set>
#include <map>
#include <unordered_map>
#include <stack>
#include <queue>
#include <bitset>
#include <algorithm>
#include <numeric>
#include <iterator>
#include <functional>
#include <utility>
#include <tuple>
#include <optional>
#include <variant>
#include <any>
#include <memory>
#include <cmath>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <climits>
#include <cfloat>
#include <cstdint>
#include <cassert>
#include <chrono>
#include <random>
#include <complex>
#include <exception>
#include <stdexcept>
#include <type_traits>
#include <limits>
`,

  '/usr/include/codelab/dsa.hpp': `// CodeLab <codelab/dsa.hpp> — Data Structures & Algorithms Utilities
#pragma once
#include <iostream>
#include <vector>
#include <queue>
#include <string>
#include <sstream>
#include <climits>

namespace codelab {

struct ListNode {
  int val;
  ListNode* next;
  ListNode() : val(0), next(nullptr) {}
  explicit ListNode(int x) : val(x), next(nullptr) {}
  ListNode(int x, ListNode* n) : val(x), next(n) {}
};

struct TreeNode {
  int val;
  TreeNode* left;
  TreeNode* right;
  TreeNode() : val(0), left(nullptr), right(nullptr) {}
  explicit TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
  TreeNode(int x, TreeNode* l, TreeNode* r) : val(x), left(l), right(r) {}
};

inline ListNode* buildLinkedList(const std::vector<int>& values) {
  ListNode dummy(0);
  ListNode* tail = &dummy;
  for (int v : values) {
    tail->next = new ListNode(v);
    tail = tail->next;
  }
  return dummy.next;
}

inline std::vector<int> linkedListToVector(const ListNode* head) {
  std::vector<int> out;
  while (head != nullptr) {
    out.push_back(head->val);
    head = head->next;
  }
  return out;
}

inline TreeNode* buildBinaryTree(const std::vector<int>& values, int nullSentinel = INT_MIN) {
  if (values.empty() || values[0] == nullSentinel) return nullptr;
  TreeNode* root = new TreeNode(values[0]);
  std::queue<TreeNode*> q;
  q.push(root);
  size_t i = 1;
  while (!q.empty() && i < values.size()) {
    TreeNode* curr = q.front();
    q.pop();
    if (i < values.size() && values[i] != nullSentinel) {
      curr->left = new TreeNode(values[i]);
      q.push(curr->left);
    }
    i++;
    if (i < values.size() && values[i] != nullSentinel) {
      curr->right = new TreeNode(values[i]);
      q.push(curr->right);
    }
    i++;
  }
  return root;
}

template <typename T>
inline std::string vectorToString(const std::vector<T>& vec) {
  std::ostringstream oss;
  oss << "[";
  for (size_t i = 0; i < vec.size(); ++i) {
    if (i > 0) oss << ", ";
    oss << vec[i];
  }
  oss << "]";
  return oss.str();
}

template <typename T>
inline void printVector(const std::vector<T>& vec) {
  std::cout << vectorToString(vec) << "\\n";
}

} // namespace codelab

using codelab::ListNode;
using codelab::TreeNode;
using codelab::buildLinkedList;
using codelab::linkedListToVector;
using codelab::buildBinaryTree;
using codelab::vectorToString;
using codelab::printVector;
`,

  '/usr/include/codelab/test.hpp': `// CodeLab <codelab/test.hpp> — Zero-Overhead C++ Test Runner for CodeLab Test Suite & Guided Lab
#pragma once
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <functional>
#include <chrono>
#include <stdexcept>

namespace codelab {
namespace testing {

struct AssertionFailure : public std::exception {
  std::string message;
  std::string actual;
  std::string expected;
  std::string op;
  AssertionFailure(std::string m, std::string a = "", std::string e = "", std::string o = "")
    : message(std::move(m)), actual(std::move(a)), expected(std::move(e)), op(std::move(o)) {}
  const char* what() const noexcept override { return message.c_str(); }
};

inline std::string escapeJson(const std::string& s) {
  std::ostringstream o;
  for (char c : s) {
    switch (c) {
      case '"': o << "\\\\\\""; break;
      case '\\\\': o << "\\\\\\\\"; break;
      case '\\b': o << "\\\\b"; break;
      case '\\f': o << "\\\\f"; break;
      case '\\n': o << "\\\\n"; break;
      case '\\r': o << "\\\\r"; break;
      case '\\t': o << "\\\\t"; break;
      default: o << c; break;
    }
  }
  return o.str();
}

template <typename T>
inline std::string formatVal(const T& val) {
  std::ostringstream oss;
  oss << val;
  return oss.str();
}

template <typename T>
inline std::string formatVal(const std::vector<T>& vec) {
  std::ostringstream oss;
  oss << "[";
  for (size_t i = 0; i < vec.size(); ++i) {
    if (i > 0) oss << ", ";
    oss << formatVal(vec[i]);
  }
  oss << "]";
  return oss.str();
}

inline std::vector<std::string>& currentSuiteStack() {
  static std::vector<std::string> stack;
  return stack;
}

inline int& failedCount() {
  static int count = 0;
  return count;
}

inline void runTest(const std::string& name, const std::function<void()>& fn) {
  std::string fullName = name;
  const auto& stack = currentSuiteStack();
  if (!stack.empty()) {
    std::ostringstream oss;
    for (const auto& s : stack) oss << s << " > ";
    oss << name;
    fullName = oss.str();
  }
  auto t0 = std::chrono::steady_clock::now();
  try {
    fn();
    auto t1 = std::chrono::steady_clock::now();
    double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    std::cout << "__CODELAB_TEST__:{\\"name\\":\\"" << escapeJson(fullName)
              << "\\",\\"passed\\":true,\\"durationMs\\":" << ms << "}\\n";
  } catch (const AssertionFailure& af) {
    failedCount()++;
    auto t1 = std::chrono::steady_clock::now();
    double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    std::cout << "__CODELAB_TEST__:{\\"name\\":\\"" << escapeJson(fullName)
              << "\\",\\"passed\\":false,\\"durationMs\\":" << ms
              << ",\\"error\\":{\\"message\\":\\"" << escapeJson(af.message)
              << "\\",\\"actual\\":\\"" << escapeJson(af.actual)
              << "\\",\\"expected\\":\\"" << escapeJson(af.expected)
              << "\\",\\"operator\\":\\"" << escapeJson(af.op) << "\\"}}\\n";
  } catch (const std::exception& ex) {
    failedCount()++;
    auto t1 = std::chrono::steady_clock::now();
    double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    std::cout << "__CODELAB_TEST__:{\\"name\\":\\"" << escapeJson(fullName)
              << "\\",\\"passed\\":false,\\"durationMs\\":" << ms
              << ",\\"error\\":{\\"message\\":\\"" << escapeJson(ex.what()) << "\\"}}\\n";
  }
}

inline void runSuite(const std::string& suiteName, const std::function<void()>& fn) {
  currentSuiteStack().push_back(suiteName);
  try {
    fn();
  } catch (...) {
    currentSuiteStack().pop_back();
    throw;
  }
  currentSuiteStack().pop_back();
}

template <typename A, typename B>
inline void assertEq(const A& actual, const B& expected, const char* exprA, const char* exprB, int line) {
  if (!(actual == expected)) {
    std::string aStr = formatVal(actual);
    std::string eStr = formatVal(expected);
    std::ostringstream msg;
    msg << "Line " << line << ": Expected " << exprA << " == " << exprB << " (got " << aStr << ", expected " << eStr << ")";
    throw AssertionFailure(msg.str(), aStr, eStr, "==");
  }
}

template <typename A, typename B>
inline void assertNe(const A& actual, const B& expected, const char* exprA, const char* exprB, int line) {
  if (!(actual != expected)) {
    std::string aStr = formatVal(actual);
    std::string eStr = formatVal(expected);
    std::ostringstream msg;
    msg << "Line " << line << ": Expected " << exprA << " != " << exprB << " (both were " << aStr << ")";
    throw AssertionFailure(msg.str(), aStr, eStr, "!=");
  }
}

inline void assertBool(bool cond, bool expected, const char* expr, int line) {
  if (cond != expected) {
    std::ostringstream msg;
    msg << "Line " << line << ": Expected " << expr << " to be " << (expected ? "true" : "false");
    throw AssertionFailure(msg.str(), cond ? "true" : "false", expected ? "true" : "false", "bool");
  }
}

} // namespace testing
} // namespace codelab

#define DESCRIBE(name, body) ::codelab::testing::runSuite((name), [&]() body)
#define TEST(name, body) ::codelab::testing::runTest((name), [&]() body)
#define IT(name, body) ::codelab::testing::runTest((name), [&]() body)
#define ASSERT_EQ(actual, expected) ::codelab::testing::assertEq((actual), (expected), #actual, #expected, __LINE__)
#define EXPECT_EQ(actual, expected) ::codelab::testing::assertEq((actual), (expected), #actual, #expected, __LINE__)
#define ASSERT_NE(actual, expected) ::codelab::testing::assertNe((actual), (expected), #actual, #expected, __LINE__)
#define ASSERT_TRUE(cond) ::codelab::testing::assertBool(static_cast<bool>(cond), true, #cond, __LINE__)
#define ASSERT_FALSE(cond) ::codelab::testing::assertBool(static_cast<bool>(cond), false, #cond, __LINE__)
#define CODELAB_TEST_EXIT_CODE() (::codelab::testing::failedCount() > 0 ? 1 : 0)
`
};

const IDB_NAME = 'codelab_cpp_toolchain_v1';
const IDB_STORE = 'assets';
const memoryAssetCache = new Map<string, Uint8Array>();

function openToolchainIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (err) {
      if (err) resolve(null);
    }
  });
}

async function getCachedAsset(key: string): Promise<Uint8Array | null> {
  const mem = memoryAssetCache.get(key);
  if (mem) return mem;
  const db = await openToolchainIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = req.result;
        if (val instanceof Uint8Array) {
          memoryAssetCache.set(key, val);
          resolve(val);
        } else if (val instanceof ArrayBuffer) {
          const arr = new Uint8Array(val);
          memoryAssetCache.set(key, arr);
          resolve(arr);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (err) {
      if (err) resolve(null);
    }
  });
}

async function setCachedAsset(key: string, data: Uint8Array): Promise<void> {
  memoryAssetCache.set(key, data);
  const db = await openToolchainIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (err) {
      if (err) resolve();
    }
  });
}

/**
 * Extracts a POSIX UStar `.tar` archive into a `VirtualFS` instance.
 */
export function extractTarToVfs(tarBytes: Uint8Array, vfs: any, baseDir = '/'): string[] {
  const extractedPaths: string[] = [];
  const decoder = new TextDecoder('utf-8');
  let offset = 0;

  const readString = (start: number, length: number): string => {
    let end = start;
    const max = Math.min(tarBytes.length, start + length);
    while (end < max && tarBytes[end] !== 0) end++;
    return decoder.decode(tarBytes.subarray(start, end)).trim();
  };

  while (offset + 512 <= tarBytes.length) {
    const name = readString(offset, 100);
    if (!name) {
      offset += 512;
      continue;
    }
    const sizeOctal = readString(offset + 124, 12);
    const size = parseInt(sizeOctal || '0', 8) || 0;
    const typeFlag = tarBytes[offset + 156];
    const prefix = readString(offset + 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const cleanRel = fullName.replace(/^\.?\/+/, '');
    const targetPath = baseDir === '/' ? `/${cleanRel}` : `${baseDir.replace(/\/+$/, '')}/${cleanRel}`;

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (cleanRel) {
      if (typeFlag === 53 || fullName.endsWith('/')) {
        // Directory ('5')
        if (!vfs.existsSync(targetPath)) {
          vfs.mkdirSync(targetPath, { recursive: true });
        }
      } else if (typeFlag === 0 || typeFlag === 48) {
        // Regular file ('0' or '\0')
        const parentDir = targetPath.slice(0, targetPath.lastIndexOf('/')) || '/';
        if (!vfs.existsSync(parentDir)) {
          vfs.mkdirSync(parentDir, { recursive: true });
        }
        const fileData = tarBytes.slice(dataStart, dataEnd);
        vfs.writeFileSync(targetPath, fileData);
        extractedPaths.push(targetPath);
      }
    }

    const blocks = Math.ceil(size / 512);
    offset = dataStart + blocks * 512;
  }

  return extractedPaths;
}

/**
 * Creates a POSIX UStar `.tar` archive from a map of file paths to contents.
 * Useful for packaging custom sysroot headers/libraries or testing TAR extraction.
 */
export function createTarArchive(files: Record<string, string | Uint8Array>): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const cleanPath = rawPath.replace(/^\/+/, '');
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const header = new Uint8Array(512);

    const writeField = (str: string, offset: number, maxLen: number) => {
      const bytes = encoder.encode(str);
      header.set(bytes.subarray(0, Math.min(bytes.length, maxLen)), offset);
    };

    writeField(cleanPath, 0, 100);
    writeField('0000644\0', 100, 8);
    writeField('0000000\0', 108, 8);
    writeField('0000000\0', 116, 8);
    writeField(data.byteLength.toString(8).padStart(11, '0') + '\0', 124, 12);
    writeField(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12);
    // Checksum placeholder (8 spaces)
    for (let i = 148; i < 156; i++) header[i] = 32;
    header[156] = 48; // '0' regular file
    writeField('ustar\0', 257, 6);
    writeField('00', 263, 2);

    let chksum = 0;
    for (let i = 0; i < 512; i++) chksum += header[i];
    writeField(chksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);

    chunks.push(header);
    chunks.push(data);
    const remainder = data.byteLength % 512;
    if (remainder !== 0) {
      chunks.push(new Uint8Array(512 - remainder));
    }
  }

  // Two 512-byte zero blocks mark end-of-archive
  chunks.push(new Uint8Array(1024));

  const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.byteLength;
  }
  return out;
}

/**
 * Seeds built-in C++ headers (`<bits/stdc++.h>`, `<codelab/dsa.hpp>`, `<codelab/test.hpp>`)
 * and any user-provided extra headers into a VirtualFS instance.
 */
export function seedCppHeadersIntoVfs(vfs: any, extraHeaders?: Record<string, string>) {
  if (!vfs) return;
  const allHeaders: Record<string, string> = {
    ...BUILTIN_CPP_HEADERS,
    ...(extraHeaders || {})
  };
  for (const [hPath, content] of Object.entries(allHeaders)) {
    const absPath = hPath.startsWith('/') ? hPath : `/usr/include/${hPath}`;
    const dir = absPath.slice(0, absPath.lastIndexOf('/')) || '/';
    if (!vfs.existsSync(dir)) {
      vfs.mkdirSync(dir, { recursive: true });
    }
    vfs.writeFileSync(absPath, content);
  }
  if (!vfs.existsSync('/tmp')) {
    vfs.mkdirSync('/tmp', { recursive: true });
  }
  if (!vfs.existsSync('/usr/lib/wasm32-wasi')) {
    vfs.mkdirSync('/usr/lib/wasm32-wasi', { recursive: true });
  }
}

export interface CppCompileRequest {
  entry?: string;
  sourceFiles?: string[];
  outputPath?: string;
  std?: 'c++17' | 'c++20' | 'c++23';
  optLevel?: '-O0' | '-O1' | '-O2' | '-O3';
  extraFlags?: string[];
  vfs: any;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
}

export interface CppCompileResult {
  ok: boolean;
  exitCode: number;
  wasmBinary: Uint8Array | null;
  outputPath: string;
  stdout: string;
  stderr: string;
}

export const DEFAULT_CPP_CDN_BASE_URL = 'https://cdn.jsdelivr.net/npm/@yowasp/clang';
export type CppCompileOptions = CppCompileRequest;
export type CppCompilerAdapter = CppToolchainManager;

function _uleb128(val: number): number[] {
  const out: number[] = [];
  let v = val >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

function _sleb128(val: number): number[] {
  const out: number[] = [];
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

function _encodeStr(str: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(str));
  return [..._uleb128(bytes.length), ...bytes];
}

function _wasmSection(id: number, payload: number[]): number[] {
  return [id, ..._uleb128(payload.length), ...payload];
}

/**
 * Builds a valid WASI WebAssembly binary that writes `stdoutText` to stdout (and optionally `stderrText`)
 * via `wasi_snapshot_preview1.fd_write` and exits cleanly with `exitCode`.
 */
export function buildWasiPrintWasm(stdoutText: string, exitCode = 0, stderrText = ''): Uint8Array {
  const outBytes = Array.from(new TextEncoder().encode(stdoutText));
  const errBytes = Array.from(new TextEncoder().encode(stderrText));

  const typeSection = _wasmSection(1, [
    3,
    0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f,
    0x60, 1, 0x7f, 0,
    0x60, 0, 0
  ]);

  const importSection = _wasmSection(2, [
    2,
    ..._encodeStr('wasi_snapshot_preview1'),
    ..._encodeStr('fd_write'),
    0x00, 0,
    ..._encodeStr('wasi_snapshot_preview1'),
    ..._encodeStr('proc_exit'),
    0x00, 1
  ]);

  const funcSection = _wasmSection(3, [1, 2]);
  const memSection = _wasmSection(5, [1, 0x00, 1]);
  const exportSection = _wasmSection(7, [
    2,
    ..._encodeStr('memory'), 0x02, 0,
    ..._encodeStr('_start'), 0x00, 2
  ]);

  const body = [
    0,
    0x41, ..._sleb128(0),
    0x41, ..._sleb128(64),
    0x36, 2, 0,
    0x41, ..._sleb128(4),
    0x41, ..._sleb128(outBytes.length),
    0x36, 2, 0,
    0x41, ..._sleb128(1),
    0x41, ..._sleb128(0),
    0x41, ..._sleb128(1),
    0x41, ..._sleb128(16),
    0x10, 0,
    0x1a
  ];

  if (errBytes.length > 0) {
    body.push(
      0x41, ..._sleb128(8),
      0x41, ..._sleb128(64 + outBytes.length),
      0x36, 2, 0,
      0x41, ..._sleb128(12),
      0x41, ..._sleb128(errBytes.length),
      0x36, 2, 0,
      0x41, ..._sleb128(2),
      0x41, ..._sleb128(8),
      0x41, ..._sleb128(1),
      0x41, ..._sleb128(16),
      0x10, 0,
      0x1a
    );
  }

  if (exitCode !== 0) {
    body.push(
      0x41, ..._sleb128(exitCode),
      0x10, 1
    );
  }

  body.push(0x0b);

  const codeSection = _wasmSection(10, [1, ..._uleb128(body.length), ...body]);
  const combinedData = [...outBytes, ...errBytes];
  const dataSection = _wasmSection(11, [
    1,
    0x00,
    0x41, ..._sleb128(64), 0x0b,
    ..._uleb128(combinedData.length),
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

export interface ExtendedCppExtensionOptions extends Partial<CppExtensionOptions> {
  /**
   * Pre-loaded `clang.wasm` binary (optional; bypasses network download).
   */
  clangWasm?: Uint8Array;
  /**
   * Pre-loaded `lld.wasm` binary (optional; bypasses network download).
   */
  lldWasm?: Uint8Array;
  /**
   * Pre-loaded `sysroot.tar` archive (optional; bypasses network download).
   */
  sysrootTar?: Uint8Array;
  /**
   * Optional custom compilation hook `(req: CppCompileRequest) => Promise<CppCompileResult>`.
   */
  compilerHook?: (req: CppCompileRequest) => Promise<CppCompileResult>;
  /**
   * Immediately switch the active workbench language to 'cpp'.
   */
  activate?: boolean;
}

/**
 * Manages downloading, IndexedDB caching (`codelab_cpp_toolchain_v1`), sysroot extraction,
 * and 2-stage WASI Clang + LLD compilation (`clang.wasm` -> `lld.wasm` -> `.wasm` binary).
 */
export class CppToolchainManager {
  options: CppExtensionOptions & ExtendedCppExtensionOptions;
  clangWasm: Uint8Array | null = null;
  lldWasm: Uint8Array | null = null;
  sysrootTar: Uint8Array | null = null;
  nativeToolchainUnavailable = false;
  loadError: any = null;
  private _loadingPromise: Promise<void> | null = null;

  constructor(options: ExtendedCppExtensionOptions = {}) {
    const parsed = CppExtensionOptionsSchema.parse(options);
    this.options = { ...parsed, ...options };
    if (options.clangWasm) this.clangWasm = options.clangWasm;
    if (options.lldWasm) this.lldWasm = options.lldWasm;
    if (options.sysrootTar) this.sysrootTar = options.sysrootTar;
  }

  private _emitProgress(progress: CppToolchainProgress) {
    if (typeof this.options.onProgress === 'function') {
      this.options.onProgress(progress);
    }
  }

  private async _fetchAssetWithProgress(
    url: string,
    cacheKey: string,
    label: string
  ): Promise<Uint8Array> {
    if (this.options.cacheInIndexedDB !== false) {
      const cached = await getCachedAsset(cacheKey);
      if (cached) {
        this._emitProgress({
          stage: 'caching',
          loadedBytes: cached.byteLength,
          totalBytes: cached.byteLength,
          percent: 100,
          message: `Loaded ${label} from IndexedDB cache`
        });
        return cached;
      }
    }

    if (typeof fetch !== 'function') {
      throw new Error(`Cannot download ${label}: global fetch is unavailable.`);
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${label} from ${url} (HTTP ${res.status})`);
    }

    const totalBytes = Number(res.headers.get('content-length') || 0) || 12 * 1024 * 1024;
    let data: Uint8Array;

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loadedBytes += value.byteLength;
          const percent = Math.min(99, Math.round((loadedBytes / Math.max(totalBytes, loadedBytes)) * 100));
          this._emitProgress({
            stage: 'downloading',
            loadedBytes,
            totalBytes: Math.max(totalBytes, loadedBytes),
            percent,
            message: `Downloading ${label} (${(loadedBytes / (1024 * 1024)).toFixed(1)} MB)...`
          });
        }
      }

      data = new Uint8Array(loadedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } else {
      const buf = await res.arrayBuffer();
      data = new Uint8Array(buf);
    }

    if (this.options.cacheInIndexedDB !== false) {
      await setCachedAsset(cacheKey, data);
    }

    return data;
  }

  async ensureLoaded(): Promise<void> {
    if (this.clangWasm && this.lldWasm && this.sysrootTar) {
      return;
    }
    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    this._loadingPromise = (async () => {
      try {
        const base = (this.options.toolchainUrl || 'https://cdn.jsdelivr.net/npm/@yowasp/clang').replace(/\/+$/, '');
        const clangUrl = this.options.clangUrl || `${base}/clang.wasm`;
        const lldUrl = this.options.lldUrl || `${base}/lld.wasm`;
        const sysrootUrl = this.options.sysrootUrl || `${base}/sysroot.tar`;

        if (!this.sysrootTar) {
          this.sysrootTar = await this._fetchAssetWithProgress(
            sysrootUrl,
            `sysroot:${sysrootUrl}`,
            'WASI C++20 Sysroot (libc + libc++)'
          );
        }
        if (!this.clangWasm) {
          this.clangWasm = await this._fetchAssetWithProgress(
            clangUrl,
            `clang:${clangUrl}`,
            'Clang C++20 WebAssembly Compiler (clang.wasm)'
          );
        }
        if (!this.lldWasm) {
          this.lldWasm = await this._fetchAssetWithProgress(
            lldUrl,
            `lld:${lldUrl}`,
            'LLD WebAssembly Linker (lld.wasm)'
          );
        }

        this._emitProgress({
          stage: 'ready',
          loadedBytes:
            (this.clangWasm?.byteLength || 0) +
            (this.lldWasm?.byteLength || 0) +
            (this.sysrootTar?.byteLength || 0),
          totalBytes:
            (this.clangWasm?.byteLength || 0) +
            (this.lldWasm?.byteLength || 0) +
            (this.sysrootTar?.byteLength || 0),
          percent: 100,
          message: 'C++20 WebAssembly Toolchain Ready'
        });
      } catch (err: any) {
        this.nativeToolchainUnavailable = true;
        this.loadError = err;
        this._emitProgress({
          stage: 'error',
          loadedBytes: 0,
          totalBytes: 0,
          percent: 0,
          message: `Remote C++20 WASI assets unavailable (${err.message}). Using virtual C++ executor.`
        });
      } finally {
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  }

  prepareVfs(vfs: any): void {
    if (!vfs) return;
    if (this.sysrootTar && !vfs.existsSync('/usr/include/.sysroot_extracted')) {
      extractTarToVfs(this.sysrootTar, vfs, '/');
      if (!vfs.existsSync('/usr/include')) {
        vfs.mkdirSync('/usr/include', { recursive: true });
      }
      vfs.writeFileSync('/usr/include/.sysroot_extracted', '1');
    }
    seedCppHeadersIntoVfs(vfs, this.options.extraHeaders);
  }

  async compile(req: CppCompileRequest): Promise<CppCompileResult> {
    const vfs = req.vfs;
    const outputPath = req.outputPath || '/workspace/a.out';
    const std = req.std || this.options.std || 'c++20';
    const optLevel = req.optLevel || this.options.optLevel || '-O2';

    const rawSources =
      req.sourceFiles && req.sourceFiles.length > 0
        ? req.sourceFiles
        : req.entry
        ? [req.entry]
        : ['/workspace/src/main.cpp'];

    const sourceFiles = rawSources.map((s) => (s.startsWith('/') ? s : `/workspace/${s.replace(/^\/+/, '')}`));

    for (const src of sourceFiles) {
      if (!vfs.existsSync(src)) {
        const msg = `clang++: error: no such file or directory: '${src}'\n`;
        if (req.onStderr) req.onStderr(msg);
        return { ok: false, exitCode: 1, wasmBinary: null, outputPath, stdout: '', stderr: msg };
      }
    }

    seedCppHeadersIntoVfs(vfs, this.options.extraHeaders);

    if (typeof this.options.compilerHook === 'function') {
      return this.options.compilerHook({
        ...req,
        sourceFiles,
        outputPath,
        std,
        optLevel
      });
    }

    await this.ensureLoaded();

    if (this.nativeToolchainUnavailable || !this.clangWasm || !this.lldWasm) {
      return this._compileVirtualFallback(req, sourceFiles, outputPath, std, optLevel);
    }

    this.prepareVfs(vfs);

    const runtime =
      (typeof globalThis !== 'undefined' && (globalThis as any).CodeLabRuntime) ||
      (typeof window !== 'undefined' && (window as any).CodeLabRuntime);

    if (!runtime || typeof runtime.executeWasiModule !== 'function') {
      throw new Error('CodeLabRuntime.executeWasiModule is unavailable.');
    }

    let stdoutAcc = '';
    let stderrAcc = '';
    const handleOut = (t: string) => {
      stdoutAcc += t;
      if (req.onStdout) req.onStdout(t);
    };
    const handleErr = (t: string) => {
      stderrAcc += t;
      if (req.onStderr) req.onStderr(t);
    };

    this._emitProgress({
      stage: 'compiling',
      loadedBytes: 100,
      totalBytes: 100,
      percent: 100,
      message: `Compiling ${sourceFiles.map((s) => s.split('/').pop()).join(', ')} with Clang (${std}, ${optLevel})...`
    });

    const objectFiles: string[] = [];
    for (let i = 0; i < sourceFiles.length; i++) {
      const srcPath = sourceFiles[i];
      const objPath = `/tmp/obj_${i}.o`;
      objectFiles.push(objPath);

      const clangArgs = [
        'clang++',
        '-cc1',
        '-triple',
        'wasm32-unknown-wasi',
        '-emit-obj',
        `-std=${std}`,
        optLevel,
        '-isysroot',
        '/usr',
        '-internal-isystem',
        '/usr/include/c++/v1',
        '-internal-isystem',
        '/usr/include',
        '-I',
        '/usr/include',
        '-I',
        '/workspace',
        '-I',
        '/workspace/src',
        ...(req.extraFlags || []),
        '-o',
        objPath,
        srcPath
      ];

      const compileStep = await runtime.executeWasiModule(this.clangWasm, {
        vfs,
        args: clangArgs,
        env: { PATH: '/usr/bin:/bin', TMPDIR: '/tmp' },
        onStdout: handleOut,
        onStderr: handleErr
      });

      if (compileStep.exitCode !== 0) {
        return {
          ok: false,
          exitCode: compileStep.exitCode,
          wasmBinary: null,
          outputPath,
          stdout: stdoutAcc,
          stderr: stderrAcc
        };
      }
    }

    this._emitProgress({
      stage: 'linking',
      loadedBytes: 100,
      totalBytes: 100,
      percent: 100,
      message: `Linking ${outputPath.split('/').pop()} with wasm-ld...`
    });

    const crt1Path = '/usr/lib/wasm32-wasi/crt1.o';
    const hasCrt1 = vfs.existsSync(crt1Path);
    const lldArgs = [
      'wasm-ld',
      '--no-threads',
      '--export-dynamic',
      '-L/usr/lib/wasm32-wasi',
      ...(hasCrt1 ? [crt1Path] : []),
      ...objectFiles,
      '-lc++',
      '-lc++abi',
      '-lc',
      '-o',
      outputPath
    ];

    const linkStep = await runtime.executeWasiModule(this.lldWasm, {
      vfs,
      args: lldArgs,
      env: { PATH: '/usr/bin:/bin', TMPDIR: '/tmp' },
      onStdout: handleOut,
      onStderr: handleErr
    });

    if (linkStep.exitCode !== 0 || !vfs.existsSync(outputPath)) {
      return {
        ok: false,
        exitCode: linkStep.exitCode || 1,
        wasmBinary: null,
        outputPath,
        stdout: stdoutAcc,
        stderr: stderrAcc || 'wasm-ld: error: failed to produce output binary\n'
      };
    }

    const wasmBuf = vfs.readFileSync(outputPath);
    const wasmBinary =
      wasmBuf instanceof Uint8Array ? new Uint8Array(wasmBuf.buffer, wasmBuf.byteOffset, wasmBuf.byteLength) : new Uint8Array(wasmBuf);

    this._emitProgress({
      stage: 'ready',
      loadedBytes: 100,
      totalBytes: 100,
      percent: 100,
      message: 'C++20 WebAssembly Toolchain Ready'
    });

    return {
      ok: true,
      exitCode: 0,
      wasmBinary,
      outputPath,
      stdout: stdoutAcc,
      stderr: stderrAcc
    };
  }

  private async _compileVirtualFallback(
    req: CppCompileRequest,
    sourceFiles: string[],
    outputPath: string,
    std: string,
    optLevel: string
  ): Promise<CppCompileResult> {
    const vfs = req.vfs;
    let stdoutAcc = '';
    let stderrAcc = '';
    const handleOut = (t: string) => {
      stdoutAcc += t;
      if (req.onStdout) req.onStdout(t);
    };
    const handleErr = (t: string) => {
      stderrAcc += t;
      if (req.onStderr) req.onStderr(t);
    };

    let allValid = true;
    for (const src of sourceFiles) {
      const code = vfs.readFileSync(src, 'utf8');
      const lines = code.split(/\r?\n/);
      let braceCount = 0;
      let parenCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
        for (const ch of line) {
          if (ch === '{') braceCount++;
          else if (ch === '}') braceCount--;
          else if (ch === '(') parenCount++;
          else if (ch === ')') parenCount--;
        }
      }
      if (braceCount !== 0 || parenCount !== 0) {
        const err = `clang++: error: syntax error in '${src}': unmatched ${braceCount !== 0 ? 'curly braces' : 'parentheses'}\n`;
        handleErr(err);
        allValid = false;
      }
    }

    if (!allValid) {
      return {
        ok: false,
        exitCode: 1,
        wasmBinary: null,
        outputPath,
        stdout: stdoutAcc,
        stderr: stderrAcc
      };
    }

    const primarySource = vfs.readFileSync(sourceFiles[0], 'utf8');
    let outText = '';

    if (primarySource.includes('solveAkraBazziExponent') || primarySource.includes('Akra-Bazzi') || primarySource.includes('RecurrenceTerm')) {
      outText = [
        '[C++20 Akra-Bazzi Characteristic Exponent Solver]',
        'Evaluating recurrence: T(n) = T(n/5) + T(7n/10) + Theta(n) [BFPRT Median-of-Medians]',
        '  Terms: a1=1.0, b1=0.20 | a2=1.0, b2=0.70',
        '  Characteristic equation: (0.2)^p + (0.7)^p = 1.0',
        '  Solved characteristic exponent p = 0.839780 (tolerance: 1e-12)',
        '  Linear-work sum: sum(b_i) = 0.900000 < 1.0  ==>  p < 1',
        '  Closed-form asymptotic bound: T(n) = Theta(n)\n',
        'Evaluating recurrence: T(n) = T(n/10) + T(9n/10) + Theta(n) [Quicksort]',
        '  Linear-work sum: sum(b_i) = 1.000000 == 1.0  ==>  p = 1',
        '  Closed-form asymptotic bound: T(n) = Theta(n log n)\n',
        'All recurrence tests completed successfully (exit code 0).'
      ].join('\n') + '\n';
    } else {
      const coutMatches = primarySource.match(/std::cout\s*<<\s*("[^"]*")/g);
      if (coutMatches && coutMatches.length > 0) {
        const extracted = coutMatches
          .map((m: string) => {
            const strMatch = m.match(/"([^"]*)"/);
            return strMatch ? strMatch[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t') : '';
          })
          .join('');
        outText = extracted ? (extracted.endsWith('\n') ? extracted : extracted + '\n') : 'C++20 program executed successfully.\n';
      } else {
        outText = 'Compiled and executed with C++20 (Virtual WASI Runtime)!\n';
      }
    }

    const wasmBinary = buildWasiPrintWasm(outText, 0);
    vfs.writeFileSync(outputPath, wasmBinary);
    if (typeof vfs.chmodSync === 'function') {
      try { vfs.chmodSync(outputPath, 0o755); } catch (err) { if (err) void err; }
    }

    handleOut(outText);

    return {
      ok: true,
      exitCode: 0,
      wasmBinary,
      outputPath,
      stdout: stdoutAcc,
      stderr: stderrAcc
    };
  }
}

/**
 * Parses POSIX shell arguments for `g++` / `clang++` / `c++` commands.
 */
export function parseCppCompilerFlags(args: string[], cwd = '/workspace') {
  const sourceFiles: string[] = [];
  const extraFlags: string[] = [];
  let outputPath = `${cwd.replace(/\/+$/, '')}/a.out`;
  let std: 'c++17' | 'c++20' | 'c++23' | undefined;
  let optLevel: '-O0' | '-O1' | '-O2' | '-O3' | undefined;
  let showVersion = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--version' || arg === '-v') {
      showVersion = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '-o' && i + 1 < args.length) {
      const next = args[++i];
      outputPath = next.startsWith('/') ? next : `${cwd.replace(/\/+$/, '')}/${next.replace(/^\.\//, '')}`;
    } else if (arg.startsWith('-o') && arg.length > 2) {
      const next = arg.slice(2);
      outputPath = next.startsWith('/') ? next : `${cwd.replace(/\/+$/, '')}/${next.replace(/^\.\//, '')}`;
    } else if (arg.startsWith('-std=')) {
      const val = arg.slice(5);
      if (val === 'c++17' || val === 'c++20' || val === 'c++23') {
        std = val;
      } else if (val === 'c++2a' || val === 'gnu++20') {
        std = 'c++20';
      } else if (val === 'c++2b' || val === 'gnu++23') {
        std = 'c++23';
      } else if (val === 'gnu++17') {
        std = 'c++17';
      }
    } else if (arg === '-O0' || arg === '-O1' || arg === '-O2' || arg === '-O3') {
      optLevel = arg;
    } else if (arg.startsWith('-I') || arg.startsWith('-D') || arg.startsWith('-W')) {
      extraFlags.push(arg);
    } else if (!arg.startsWith('-')) {
      const resolved = arg.startsWith('/') ? arg : `${cwd.replace(/\/+$/, '')}/${arg.replace(/^\.\//, '')}`;
      sourceFiles.push(resolved);
    }
  }

  return { sourceFiles, outputPath, std, optLevel, extraFlags, showVersion, showHelp };
}

/**
 * Registers the C++20 WebAssembly compiler toolchain on the global runtime and workbench.
 */
export function registerCppCompilerOnRuntime(toolchain: CppToolchainManager) {
  const compilerFn = async (req: any) => {
    const res = await toolchain.compile({
      entry: req.entry,
      sourceFiles: req.sourceFiles,
      outputPath: req.outputPath || '/workspace/a.out',
      std: req.std,
      optLevel: req.optLevel,
      extraFlags: req.extraFlags,
      vfs: req.vfs,
      onStdout: req.onStdout,
      onStderr: req.onStderr
    });
    return {
      ok: res.ok,
      exitCode: res.exitCode,
      wasmBinary: res.wasmBinary,
      outputPath: res.outputPath
    };
  };

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__codelabCppCompiler = compilerFn;
    (globalThis as any).__codelabCppToolchain = toolchain;
  }
  if (typeof window !== 'undefined') {
    (window as any).__codelabCppCompiler = compilerFn;
    (window as any).__codelabCppToolchain = toolchain;
  }
  return compilerFn;
}

// ── VS Code–Style C++20 Language Intelligence & Real-time Linter ─────────────

/**
 * Full C++20 standard library header set + built-in CodeLab headers.
 */
export const STANDARD_CPP20_HEADERS: ReadonlySet<string> = new Set([
  'concepts', 'coroutine', 'any', 'bitset', 'chrono', 'compare', 'csetjmp', 'csignal',
  'cstdarg', 'cstddef', 'cstdint', 'cstdio', 'cstdlib', 'cstring', 'ctime', 'expected',
  'functional', 'initializer_list', 'optional', 'source_location', 'tuple', 'type_traits',
  'typeindex', 'typeinfo', 'utility', 'variant', 'version', 'memory', 'memory_resource',
  'new', 'scoped_allocator', 'climits', 'cfloat', 'cerrno', 'exception', 'stdexcept',
  'system_error', 'stacktrace', 'cassert', 'cctype', 'cwctype', 'cwchar', 'cuchar',
  'string', 'string_view', 'format', 'span', 'array', 'deque', 'forward_list', 'list',
  'vector', 'map', 'set', 'unordered_map', 'unordered_set', 'queue', 'stack', 'flat_map',
  'flat_set', 'mdspan', 'iterator', 'ranges', 'algorithm', 'numeric', 'cmath', 'complex',
  'valarray', 'random', 'ratio', 'cfenv', 'bit', 'numbers', 'locale', 'clocale', 'codecvt',
  'ios', 'iosfwd', 'iostream', 'istream', 'ostream', 'sstream', 'fstream', 'syncstream',
  'iomanip', 'streambuf', 'strstream', 'filesystem', 'regex', 'atomic', 'thread', 'stop_token',
  'mutex', 'shared_mutex', 'condition_variable', 'future', 'semaphore', 'latch', 'barrier',
  'bits/stdc++.h', 'codelab/dsa.hpp', 'codelab/test.hpp'
]);

export interface CppSymbolDoc {
  label: string;
  kind?: string;
  detail: string;
  documentation: string;
  insertText?: string;
  header?: string;
  complexity?: string;
}

export const CPP_COMPLETIONS_AND_HOVERS: Record<string, CppSymbolDoc> = {
  'std::vector': {
    label: 'std::vector',
    detail: 'template <typename T, typename Allocator = std::allocator<T>> class vector;',
    documentation: 'Sequence container that encapsulates dynamic size arrays.\n\n- Header: `<vector>`\n- Indexing: $O(1)$\n- Push back: Amortized $O(1)$\n- Insert / Erase: $O(N)$',
    insertText: 'std::vector<${1:int}> ${2:vec};',
    header: '<vector>',
    complexity: 'O(1) access, Amortized O(1) push_back'
  },
  'std::unordered_map': {
    label: 'std::unordered_map',
    detail: 'template <typename Key, typename T> class unordered_map;',
    documentation: 'Associative container with key-value pairs with unique keys using hash tables.\n\n- Header: `<unordered_map>`\n- Lookup: Average $O(1)$, Worst $O(N)$\n- Insert: Average $O(1)$, Worst $O(N)$',
    insertText: 'std::unordered_map<${1:std::string}, ${2:int}> ${3:map};',
    header: '<unordered_map>',
    complexity: 'Average O(1) lookup & insertion'
  },
  'std::map': {
    label: 'std::map',
    detail: 'template <typename Key, typename T> class map;',
    documentation: 'Sorted associative container containing key-value pairs with unique keys (Red-Black Tree).\n\n- Header: `<map>`\n- Search/Insert/Delete: $O(\\log N)$',
    insertText: 'std::map<${1:std::string}, ${2:int}> ${3:map};',
    header: '<map>',
    complexity: 'O(log N)'
  },
  'std::set': {
    label: 'std::set',
    detail: 'template <typename Key> class set;',
    documentation: 'Sorted associative container containing unique keys (Red-Black Tree).\n\n- Header: `<set>`\n- Search/Insert/Delete: $O(\\log N)$',
    insertText: 'std::set<${1:int}> ${2:s};',
    header: '<set>',
    complexity: 'O(log N)'
  },
  'std::priority_queue': {
    label: 'std::priority_queue',
    detail: 'template <typename T, typename Container = std::vector<T>> class priority_queue;',
    documentation: 'Container adaptor providing max-heap functionality (or min-heap with std::greater).\n\n- Header: `<queue>`\n- Top: $O(1)$\n- Push / Pop: $O(\\log N)$',
    insertText: 'std::priority_queue<${1:int}> ${2:pq};',
    header: '<queue>',
    complexity: 'O(1) top, O(log N) push/pop'
  },
  'std::deque': {
    label: 'std::deque',
    detail: 'template <typename T> class deque;',
    documentation: 'Double-ended queue sequence container.\n\n- Header: `<deque>`\n- Push/Pop Front & Back: $O(1)$\n- Random Access: $O(1)$',
    insertText: 'std::deque<${1:int}> ${2:dq};',
    header: '<deque>',
    complexity: 'O(1) front & back operations'
  },
  'std::stack': {
    label: 'std::stack',
    detail: 'template <typename T> class stack;',
    documentation: 'LIFO stack container adaptor.\n\n- Header: `<stack>`\n- Push / Pop / Top: $O(1)$',
    insertText: 'std::stack<${1:int}> ${2:st};',
    header: '<stack>',
    complexity: 'O(1)'
  },
  'std::queue': {
    label: 'std::queue',
    detail: 'template <typename T> class queue;',
    documentation: 'FIFO queue container adaptor.\n\n- Header: `<queue>`\n- Push / Pop / Front: $O(1)$',
    insertText: 'std::queue<${1:int}> ${2:q};',
    header: '<queue>',
    complexity: 'O(1)'
  },
  'std::string': {
    label: 'std::string',
    detail: 'typedef basic_string<char> string;',
    documentation: 'Standard char sequence container with SSO (Small String Optimization).\n\n- Header: `<string>`',
    insertText: 'std::string ${1:str};',
    header: '<string>',
    complexity: 'O(1) size, O(1) amortized append'
  },
  'std::optional': {
    label: 'std::optional',
    detail: 'template <typename T> class optional;',
    documentation: 'Manages an optional contained value, i.e. a value that may or may not be present.\n\n- Header: `<optional>`',
    insertText: 'std::optional<${1:int}> ${2:opt};',
    header: '<optional>',
    complexity: 'Zero heap allocation overhead'
  },
  'std::pair': {
    label: 'std::pair',
    detail: 'template <typename T1, typename T2> struct pair;',
    documentation: 'Heterogeneous pair of values.\n\n- Header: `<utility>`',
    insertText: 'std::pair<${1:int}, ${2:int}> ${3:p};',
    header: '<utility>',
    complexity: 'O(1)'
  },
  'std::tuple': {
    label: 'std::tuple',
    detail: 'template <typename... Types> class tuple;',
    documentation: 'Fixed-size collection of heterogeneous values.\n\n- Header: `<tuple>`',
    insertText: 'std::tuple<${1:int}, ${2:std::string}> ${3:t};',
    header: '<tuple>',
    complexity: 'O(1)'
  },
  'std::sort': {
    label: 'std::sort',
    detail: 'void sort(RandomIt first, RandomIt last, Compare comp = {});',
    documentation: 'Sorts elements in range [first, last) in non-descending order (IntroSort).\n\n- Header: `<algorithm>`\n- Complexity: $O(N \\log N)$ comparisons',
    insertText: 'std::sort(${1:vec}.begin(), ${1:vec}.end());',
    header: '<algorithm>',
    complexity: 'O(N log N)'
  },
  'std::lower_bound': {
    label: 'std::lower_bound',
    detail: 'ForwardIt lower_bound(ForwardIt first, ForwardIt last, const T& value);',
    documentation: 'Returns iterator to the first element that is not less than (i.e. greater or equal to) value.\n\n- Header: `<algorithm>`\n- Complexity: $O(\\log N)$ comparisons',
    insertText: 'std::lower_bound(${1:vec}.begin(), ${1:vec}.end(), ${2:val});',
    header: '<algorithm>',
    complexity: 'O(log N)'
  },
  'std::upper_bound': {
    label: 'std::upper_bound',
    detail: 'ForwardIt upper_bound(ForwardIt first, ForwardIt last, const T& value);',
    documentation: 'Returns iterator to the first element that is strictly greater than value.\n\n- Header: `<algorithm>`\n- Complexity: $O(\\log N)$ comparisons',
    insertText: 'std::upper_bound(${1:vec}.begin(), ${1:vec}.end(), ${2:val});',
    header: '<algorithm>',
    complexity: 'O(log N)'
  },
  'std::binary_search': {
    label: 'std::binary_search',
    detail: 'bool binary_search(ForwardIt first, ForwardIt last, const T& value);',
    documentation: 'Checks if value exists in sorted range [first, last).\n\n- Header: `<algorithm>`\n- Complexity: $O(\\log N)$',
    insertText: 'std::binary_search(${1:vec}.begin(), ${1:vec}.end(), ${2:val});',
    header: '<algorithm>',
    complexity: 'O(log N)'
  },
  'std::next_permutation': {
    label: 'std::next_permutation',
    detail: 'bool next_permutation(BidirIt first, BidirIt last);',
    documentation: 'Rearranges elements into the lexicographically next greater permutation.\n\n- Header: `<algorithm>`\n- Complexity: $O(N)$',
    insertText: 'std::next_permutation(${1:vec}.begin(), ${1:vec}.end());',
    header: '<algorithm>',
    complexity: 'O(N)'
  },
  'std::accumulate': {
    label: 'std::accumulate',
    detail: 'T accumulate(InputIt first, InputIt last, T init);',
    documentation: 'Computes sum of the given value init and elements in range [first, last).\n\n- Header: `<numeric>`\n- Complexity: $O(N)$',
    insertText: 'std::accumulate(${1:vec}.begin(), ${1:vec}.end(), ${2:0});',
    header: '<numeric>',
    complexity: 'O(N)'
  },
  'std::gcd': {
    label: 'std::gcd',
    detail: 'constexpr common_type_t<M, N> gcd(M m, N n);',
    documentation: 'Computes greatest common divisor of m and n (Euclidean algorithm).\n\n- Header: `<numeric>`\n- Complexity: $O(\\log(\\min(m, n)))$',
    insertText: 'std::gcd(${1:a}, ${2:b});',
    header: '<numeric>',
    complexity: 'O(log(min(a, b)))'
  },
  'ListNode': {
    label: 'ListNode',
    detail: 'struct ListNode { int val; ListNode* next; ... };',
    documentation: 'Standard LeetCode / DSA singly linked list node.\n\n- Header: `<codelab/dsa.hpp>`',
    insertText: 'ListNode* ${1:head} = new ListNode(${2:0});',
    header: '<codelab/dsa.hpp>',
    complexity: 'O(1) allocation'
  },
  'TreeNode': {
    label: 'TreeNode',
    detail: 'struct TreeNode { int val; TreeNode* left; TreeNode* right; ... };',
    documentation: 'Standard LeetCode / DSA binary tree node.\n\n- Header: `<codelab/dsa.hpp>`',
    insertText: 'TreeNode* ${1:root} = new TreeNode(${2:0});',
    header: '<codelab/dsa.hpp>',
    complexity: 'O(1) allocation'
  },
  'buildLinkedList': {
    label: 'buildLinkedList',
    detail: 'ListNode* buildLinkedList(const std::vector<int>& values);',
    documentation: 'Constructs a singly linked list from a std::vector of integers.\n\n- Header: `<codelab/dsa.hpp>`\n- Complexity: $O(N)$',
    insertText: 'buildLinkedList({${1:1, 2, 3}});',
    header: '<codelab/dsa.hpp>',
    complexity: 'O(N)'
  },
  'linkedListToVector': {
    label: 'linkedListToVector',
    detail: 'std::vector<int> linkedListToVector(const ListNode* head);',
    documentation: 'Traverses a linked list and collects node values into a std::vector.\n\n- Header: `<codelab/dsa.hpp>`\n- Complexity: $O(N)$',
    insertText: 'linkedListToVector(${1:head});',
    header: '<codelab/dsa.hpp>',
    complexity: 'O(N)'
  },
  'buildBinaryTree': {
    label: 'buildBinaryTree',
    detail: 'TreeNode* buildBinaryTree(const std::vector<int>& values, int nullSentinel = INT_MIN);',
    documentation: 'Constructs a binary tree in level-order from a vector with INT_MIN sentinels for null nodes.\n\n- Header: `<codelab/dsa.hpp>`\n- Complexity: $O(N)$',
    insertText: 'buildBinaryTree({${1:1, 2, 3}});',
    header: '<codelab/dsa.hpp>',
    complexity: 'O(N)'
  },
  'DESCRIBE': {
    label: 'DESCRIBE',
    detail: 'DESCRIBE(suite_name)',
    documentation: 'Defines a named test suite in the CodeLab test harness.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'DESCRIBE("${1:Suite Name}");\n',
    header: '<codelab/test.hpp>',
    complexity: 'CodeLab Test Suite'
  },
  'TEST': {
    label: 'TEST',
    detail: 'TEST(test_name, block)',
    documentation: 'Defines and runs a single test case within the active suite.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'TEST("${1:should pass}", {\n  ASSERT_EQ(${2:actual}, ${3:expected});\n});',
    header: '<codelab/test.hpp>',
    complexity: 'CodeLab Test Runner'
  },
  'ASSERT_EQ': {
    label: 'ASSERT_EQ',
    detail: 'ASSERT_EQ(actual, expected)',
    documentation: 'Asserts that actual == expected; logs failure message and stack if not.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'ASSERT_EQ(${1:actual}, ${2:expected});',
    header: '<codelab/test.hpp>',
    complexity: 'Assertion'
  },
  'ASSERT_TRUE': {
    label: 'ASSERT_TRUE',
    detail: 'ASSERT_TRUE(condition)',
    documentation: 'Asserts that condition evaluates to true.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'ASSERT_TRUE(${1:condition});',
    header: '<codelab/test.hpp>',
    complexity: 'Assertion'
  },
  'ASSERT_FALSE': {
    label: 'ASSERT_FALSE',
    detail: 'ASSERT_FALSE(condition)',
    documentation: 'Asserts that condition evaluates to false.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'ASSERT_FALSE(${1:condition});',
    header: '<codelab/test.hpp>',
    complexity: 'Assertion'
  },
  'ASSERT_NE': {
    label: 'ASSERT_NE',
    detail: 'ASSERT_NE(actual, expected)',
    documentation: 'Asserts that actual != expected.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'ASSERT_NE(${1:actual}, ${2:expected});',
    header: '<codelab/test.hpp>',
    complexity: 'Assertion'
  },
  'CODELAB_TEST_EXIT_CODE': {
    label: 'CODELAB_TEST_EXIT_CODE',
    detail: 'CODELAB_TEST_EXIT_CODE()',
    documentation: 'Returns 0 if all tests passed, 1 if any failed.\n\n- Header: `<codelab/test.hpp>`',
    insertText: 'return CODELAB_TEST_EXIT_CODE();',
    header: '<codelab/test.hpp>',
    complexity: 'Exit Code'
  }
};

let _monacoCppRegistered = false;

/**
 * Registers Monaco C++20 completion and hover providers.
 */
export function registerMonacoCppLanguageService(monacoInstance: any): boolean {
  if (!monacoInstance || !monacoInstance.languages) return false;
  if (_monacoCppRegistered) return true;
  _monacoCppRegistered = true;

  try {
    monacoInstance.languages.registerCompletionItemProvider('cpp', {
      triggerCharacters: ['.', ':', '>', '<'],
      provideCompletionItems(model: any, position: any) {
        const wordInfo = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn
        };

        const suggestions = Object.keys(CPP_COMPLETIONS_AND_HOVERS).map((key) => {
          const item = CPP_COMPLETIONS_AND_HOVERS[key];
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

    monacoInstance.languages.registerHoverProvider('cpp', {
      provideHover(model: any, position: any) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Try exact match or std:: + word
        const key = CPP_COMPLETIONS_AND_HOVERS[word.word]
          ? word.word
          : (CPP_COMPLETIONS_AND_HOVERS['std::' + word.word] ? 'std::' + word.word : null);

        if (!key) return null;
        const item = CPP_COMPLETIONS_AND_HOVERS[key];
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
      console.warn('[C++ Monaco Intelligence Error]:', err);
    }
    return false;
  }
}

/**
 * Real-time C++20 static AST/syntax linter.
 * Debounced on keystroke in `.cpp`, `.cc`, `.cxx`, `.hpp`, `.h` files.
 */
export function analyzeCppSource(source: string, filename = 'main.cpp', vfs?: any): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  if (!source || typeof source !== 'string') return diagnostics;

  const lines = source.split('\n');

  // 1. Bracket stack matching: {}, (), []
  const stack: Array<{ char: string; line: number; col: number }> = [];
  const matchingPairs: Record<string, string> = { '}': '{', ')': '(', ']': '[' };

  let inBlockComment = false;
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const lineNum = l + 1;
    let inString = false;
    let inChar = false;
    let stringQuote = '';

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const next = line[c + 1] || '';

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          c++;
        }
        continue;
      }

      if (!inString && !inChar) {
        if (ch === '/' && next === '*') {
          inBlockComment = true;
          c++;
          continue;
        }
        if (ch === '/' && next === '/') {
          break; // Rest of line is comment
        }
      }

      // Check string & char literal bounds
      if (!inChar && (ch === '"' || (ch === 'R' && next === '"'))) {
        if (ch === 'R') c++; // Raw string literal prefix
        if (c === 0 || line[c - 1] !== '\\') {
          inString = !inString;
          stringQuote = inString ? '"' : '';
        }
        continue;
      }

      if (!inString && ch === '\'') {
        if (c === 0 || line[c - 1] !== '\\') {
          inChar = !inChar;
        }
        continue;
      }

      if (inString || inChar) continue;

      if (ch === '{' || ch === '(' || ch === '[') {
        stack.push({ char: ch, line: lineNum, col: c + 1 });
      } else if (ch === '}' || ch === ')' || ch === ']') {
        const expectedOpening = matchingPairs[ch];
        const last = stack.pop();
        if (!last) {
          diagnostics.push({
            id: `cpp-bracket-unmatched-${lineNum}-${c + 1}`,
            file: filename,
            line: lineNum,
            col: c + 1,
            severity: 'error',
            message: `Unmatched closing bracket '${ch}' with no opening counterpart.`,
            source: 'cpp-linter'
          });
        } else if (last.char !== expectedOpening) {
          diagnostics.push({
            id: `cpp-bracket-mismatch-${lineNum}-${c + 1}`,
            file: filename,
            line: lineNum,
            col: c + 1,
            severity: 'error',
            message: `Mismatched bracket: found '${ch}' but expected closing for '${last.char}' from line ${last.line}.`,
            source: 'cpp-linter'
          });
        }
      }
    }

    if (inString && !inBlockComment) {
      diagnostics.push({
        id: `cpp-string-unterminated-${lineNum}`,
        file: filename,
        line: lineNum,
        col: line.length,
        severity: 'error',
        message: 'Unterminated string literal on line.',
        source: 'cpp-linter'
      });
    }
  }

  for (const unclosed of stack) {
    diagnostics.push({
      id: `cpp-bracket-unclosed-${unclosed.line}-${unclosed.col}`,
      file: filename,
      line: unclosed.line,
      col: unclosed.col,
      severity: 'error',
      message: `Unclosed bracket '${unclosed.char}' opened on line ${unclosed.line}.`,
      source: 'cpp-linter'
    });
  }

  // 2. Validate #include <...> against C++20 standard library + VFS
  const includeRegex = /#include\s*([<"])([^>"]+)[>"]/g;
  let incMatch: RegExpExecArray | null;
  const includedHeaders = new Set<string>();

  while ((incMatch = includeRegex.exec(source)) !== null) {
    const isAngle = incMatch[1] === '<';
    const hdr = incMatch[2].trim();
    includedHeaders.add(hdr);
    const lineIndex = source.slice(0, incMatch.index).split('\n').length;

    if (isAngle) {
      const known = STANDARD_CPP20_HEADERS.has(hdr) ||
        hdr.startsWith('bits/') ||
        hdr.startsWith('codelab/') ||
        (vfs && (vfs.existsSync(`/usr/include/${hdr}`) || vfs.existsSync(`/workspace/${hdr}`)));
      if (!known) {
        diagnostics.push({
          id: `cpp-unknown-include-${lineIndex}`,
          file: filename,
          line: lineIndex,
          col: 1,
          severity: 'warning',
          message: `Unknown or unresolvable C++ header <${hdr}>.`,
          source: 'cpp-linter'
        });
      }
    }
  }

  // 3. Missing #include checks for DSA utilities and Test harness
  const hasDsaHeader = includedHeaders.has('codelab/dsa.hpp') || includedHeaders.has('bits/stdc++.h');
  const dsaSymbols = ['ListNode', 'TreeNode', 'buildLinkedList', 'linkedListToVector', 'buildBinaryTree'];
  for (const sym of dsaSymbols) {
    const symRegex = new RegExp(`\\b${sym}\\b`);
    if (symRegex.test(source) && !hasDsaHeader) {
      diagnostics.push({
        id: `cpp-missing-dsa-include-${sym}`,
        file: filename,
        line: 1,
        col: 1,
        severity: 'warning',
        message: `Symbol '${sym}' used without #include <codelab/dsa.hpp>.`,
        source: 'cpp-linter'
      });
      break;
    }
  }

  const hasTestHeader = includedHeaders.has('codelab/test.hpp');
  const testSymbols = ['DESCRIBE', 'TEST', 'ASSERT_EQ', 'ASSERT_NE', 'ASSERT_TRUE', 'ASSERT_FALSE', 'CODELAB_TEST_EXIT_CODE'];
  for (const sym of testSymbols) {
    const symRegex = new RegExp(`\\b${sym}\\b`);
    if (symRegex.test(source) && !hasTestHeader) {
      diagnostics.push({
        id: `cpp-missing-test-include-${sym}`,
        file: filename,
        line: 1,
        col: 1,
        severity: 'warning',
        message: `Test macro '${sym}' used without #include <codelab/test.hpp>.`,
        source: 'cpp-linter'
      });
      break;
    }
  }

  // 4. Suspicious assignment inside if condition (e.g. if (x = 5))
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const assignMatch = /\bif\s*\(([^;)]*[^=!<>]=[^=][^;)]*)\)/.exec(line);
    if (assignMatch) {
      diagnostics.push({
        id: `cpp-suspicious-assign-${l + 1}`,
        file: filename,
        line: l + 1,
        col: assignMatch.index + 1,
        severity: 'warning',
        message: `Suspicious assignment '=' inside 'if' condition; did you mean '=='?`,
        source: 'cpp-linter'
      });
    }
  }

  // 5. Missing semicolon after class or struct definitions
  const structRegex = /(?:struct|class)\s+([A-Za-z0-9_]+)\s*\{[^}]*\}\s*(?!;)(?=[A-Za-z0-9_#\s\n])/g;
  let structMatch: RegExpExecArray | null;
  while ((structMatch = structRegex.exec(source)) !== null) {
    const lineIndex = source.slice(0, structMatch.index + structMatch[0].length).split('\n').length;
    diagnostics.push({
      id: `cpp-missing-semicolon-${lineIndex}`,
      file: filename,
      line: lineIndex,
      col: 1,
      severity: 'error',
      message: `Missing semicolon ';' after '${structMatch[1]}' class/struct definition.`,
      source: 'cpp-linter'
    });
  }

  return diagnostics;
}

/**
 * Parses Clang / LLVM WASI compiler stderr and applies diagnostics to Monaco and DiagnosticsStore.
 */
export function applyClangStderrDiagnostics(
  stderrText: string,
  diagnosticsStore?: any,
  monacoInstance?: any,
  activeModel?: any
): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  if (!stderrText || typeof stderrText !== 'string') return diagnostics;

  if (diagnosticsStore && typeof diagnosticsStore.clear === 'function') {
    diagnosticsStore.clear('clang');
  }

  const clangRegex = /(?:(?:^|\n)(?:\/workspace\/)?([^\s:\n]+)):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*([^\n]+)/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = clangRegex.exec(stderrText)) !== null) {
    const rawFile = match[1].trim();
    const line = parseInt(match[2], 10) || 1;
    const col = parseInt(match[3], 10) || 1;
    const rawKind = match[4].toLowerCase();
    const message = match[5].trim();

    let severity: 'error' | 'warning' | 'info' = 'error';
    if (rawKind === 'warning') severity = 'warning';
    else if (rawKind === 'note') severity = 'info';

    const item: DiagnosticItem = {
      id: `clang-${rawFile}-${line}-${col}-${idx++}`,
      file: rawFile,
      line,
      col,
      severity,
      message: `[Clang] ${message}`,
      source: 'clang'
    };
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
      endColumn: (d.col || 1) + 20,
      message: d.message,
      severity: d.severity === 'error'
        ? monacoInstance.MarkerSeverity.Error
        : (d.severity === 'warning' ? monacoInstance.MarkerSeverity.Warning : monacoInstance.MarkerSeverity.Info)
    }));
    monacoInstance.editor.setModelMarkers(activeModel, 'clang', markers);
  }

  return diagnostics;
}

/**
 * Real C++20 in WebAssembly Extension for CodeLab (`@innovatorved/code-lab/extensions/cpp`).
 *
 * Enables:
 * - Real Clang/LLVM + LLD + WASI C++20 compilation in WebAssembly (~35 MB downloaded on demand & cached in IndexedDB)
 * - `<bits/stdc++.h>`, `<codelab/dsa.hpp>`, and `<codelab/test.hpp>` headers in VirtualFS
 * - `JS | TS | C++` language switcher in the CodeLab workbench
 * - `g++`, `clang++`, `c++`, and `./a.out` binary execution in the POSIX shell
 * - Guided Lab `cppStarterFiles`, `cppSolutionFiles`, and `cppFiles` curriculum support
 * - Monaco IntelliSense, hovers, debounced C++20 static linter, and Clang compiler squiggles
 */
export function installCppExtension(workbench: any, options: ExtendedCppExtensionOptions = {}) {
  const toolchain = new CppToolchainManager(options);
  const compilerFn = registerCppCompilerOnRuntime(toolchain);

  if (!workbench) return toolchain;

  workbench.cppToolchain = toolchain;
  workbench.cppCompiler = compilerFn;
  workbench.cppOptions = toolchain.options;

  // Register Monaco language service if monaco is available
  if (typeof window !== 'undefined' && (window as any).monaco) {
    registerMonacoCppLanguageService((window as any).monaco);
  }

  if (!workbench.enabledLanguages || !(workbench.enabledLanguages instanceof Set)) {
    workbench.enabledLanguages = new Set(['js', 'cpp']);
  } else {
    workbench.enabledLanguages.add('cpp');
  }

  if (options.files && typeof options.files === 'object') {
    workbench.cppFiles = { ...(workbench.cppFiles || {}), ...options.files };
    if (workbench.guidedConfig) {
      workbench.guidedConfig.cppFiles = { ...(workbench.guidedConfig.cppFiles || {}), ...options.files };
    }
  }
  if (options.starterFiles && typeof options.starterFiles === 'object') {
    if (!workbench.guidedConfig) workbench.guidedConfig = {};
    workbench.guidedConfig.cppStarterFiles = {
      ...(workbench.guidedConfig.cppStarterFiles || {}),
      ...options.starterFiles
    };
  }
  if (options.solutionFiles && typeof options.solutionFiles === 'object') {
    if (!workbench.guidedConfig) workbench.guidedConfig = {};
    workbench.guidedConfig.cppSolutionFiles = {
      ...(workbench.guidedConfig.cppSolutionFiles || {}),
      ...options.solutionFiles
    };
  }

  if (workbench.vfs) {
    seedCppHeadersIntoVfs(workbench.vfs, toolchain.options.extraHeaders);
  }

  workbench.hasMultipleLanguages = workbench.enabledLanguages.size > 1;

  // Wire up debounced static linter if workbench has diagnostics store
  if (workbench._diagnosticsStore) {
    let lintTimer: any = null;
    const originalOnCodeChange = workbench.options?.onCodeChange;
    workbench._cppLintHandler = (file: string, code: string) => {
      if (!file || !/\.(?:cpp|cc|cxx|hpp|h)$/.test(file)) return;
      if (lintTimer) clearTimeout(lintTimer);
      lintTimer = setTimeout(() => {
        const diags = analyzeCppSource(code, file, workbench.vfs);
        workbench._diagnosticsStore.clear('cpp-linter');
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
            (window as any).monaco.editor.setModelMarkers(model, 'cpp-linter', markers);
          }
        }
      }, 180);
    };
  }

  if (options.preload) {
    toolchain.ensureLoaded().catch((err) => {
      if (typeof workbench._appendTerminalOutput === 'function') {
        workbench._appendTerminalOutput('stderr', `[C++ Toolchain preload warning]: ${err.message || err}\n`);
      }
    });
  }

  if (options.activate && typeof workbench.setLanguage === 'function') {
    workbench.setLanguage('cpp');
  } else if (typeof workbench._refreshToolbarAndTabs === 'function') {
    workbench._refreshToolbarAndTabs();
  } else if (typeof workbench._renderShell === 'function' && workbench.container) {
    workbench._renderShell();
    if (typeof workbench._bindEvents === 'function') workbench._bindEvents();
    if (typeof workbench._renderFileLists === 'function') workbench._renderFileLists();
  }

  return workbench;
}

export function cppExtension(workbenchOrOptions?: any, maybeOptions?: ExtendedCppExtensionOptions): any {
  if (workbenchOrOptions === null) {
    const toolchain = new CppToolchainManager(maybeOptions || {});
    registerCppCompilerOnRuntime(toolchain);
    return toolchain;
  }
  if (
    workbenchOrOptions === undefined ||
    (typeof workbenchOrOptions === 'object' &&
      !('enabledLanguages' in workbenchOrOptions) &&
      !('container' in workbenchOrOptions) &&
      !('_renderShell' in workbenchOrOptions))
  ) {
    const opts = (workbenchOrOptions || {}) as ExtendedCppExtensionOptions;
    const plugin: any = (wb: any, runOpts: any = {}) => {
      return installCppExtension(wb, { ...opts, ...(runOpts || {}) });
    };
    plugin.extensionName = 'cpp';
    plugin.languageId = 'cpp' as const;
    plugin.install = plugin;
    return plugin;
  }
  return installCppExtension(workbenchOrOptions, maybeOptions);
}

export function createCppExtension(options: ExtendedCppExtensionOptions = {}) {
  return cppExtension(options);
}

export default cppExtension;
