import { CppExtensionOptions, CppExtensionOptionsSchema, CppToolchainProgress } from '../schemas';

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

/**
 * Real C++20 in WebAssembly Extension for CodeLab (`@innovatorved/code-lab/extensions/cpp`).
 *
 * Enables:
 * - Real Clang/LLVM + LLD + WASI C++20 compilation in WebAssembly (~35 MB downloaded on demand & cached in IndexedDB)
 * - `<bits/stdc++.h>`, `<codelab/dsa.hpp>`, and `<codelab/test.hpp>` headers in VirtualFS
 * - `JS | TS | C++` language switcher in the CodeLab workbench
 * - `g++`, `clang++`, `c++`, and `./a.out` binary execution in the POSIX shell
 * - Guided Lab `cppStarterFiles`, `cppSolutionFiles`, and `cppFiles` curriculum support
 */
export function cppExtension(workbench: any, options: ExtendedCppExtensionOptions = {}) {
  const toolchain = new CppToolchainManager(options);
  const compilerFn = registerCppCompilerOnRuntime(toolchain);

  if (!workbench) return toolchain;

  workbench.cppToolchain = toolchain;
  workbench.cppCompiler = compilerFn;
  workbench.cppOptions = toolchain.options;

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

  if (options.preload) {
    toolchain.ensureLoaded().catch((err) => {
      if (typeof workbench._appendTerminalOutput === 'function') {
        workbench._appendTerminalOutput('stderr', `[C++ Toolchain preload warning]: ${err.message || err}\n`);
      }
    });
  }

  if (options.activate && typeof workbench.setLanguage === 'function') {
    workbench.setLanguage('cpp');
  } else if (typeof workbench._renderShell === 'function' && workbench.container) {
    workbench._renderShell();
    if (typeof workbench._bindEvents === 'function') workbench._bindEvents();
    if (typeof workbench._renderFileLists === 'function') workbench._renderFileLists();
  }

  return workbench;
}

export function createCppExtension(options: ExtendedCppExtensionOptions = {}) {
  const plugin = (workbench: any) => cppExtension(workbench, options);
  plugin.extensionName = 'cpp';
  plugin.languageId = 'cpp' as const;
  return plugin;
}

export default cppExtension;
