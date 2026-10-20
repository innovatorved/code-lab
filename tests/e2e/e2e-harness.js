'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * E2E Test Infra Harness: code-lab v2.0.0
 * Zero-dependency virtual DOM, Monaco stub, schema loader, command runner,
 * and test assertion/reporting suite runner.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const child_process = require('node:child_process');

// ── Root Paths ───────────────────────────────────────────────────────────────

const CODE_LAB_ROOT = path.resolve(__dirname, '../..');
const SYSTEM_DESIGN_ROOT = path.resolve(CODE_LAB_ROOT, '../system-design');
const WIKI_ROOT = fs.existsSync('/tmp/code-lab-wiki-survey')
  ? '/tmp/code-lab-wiki-survey'
  : path.resolve(CODE_LAB_ROOT, '../code-lab.wiki');

// Tests that depend on the author's sibling repositories are skipped unless
// those repositories are actually present. The suite must be hermetic on a
// clean clone: no test may fail because an unrelated checkout is missing.
const HAS_SYSTEM_DESIGN = fs.existsSync(SYSTEM_DESIGN_ROOT);
const HAS_WIKI = fs.existsSync(WIKI_ROOT);

// ── Virtual DOM Implementation ──────────────────────────────────────────────

class DOMNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.parentElement = null;
    this.childNodes = [];
  }

  get children() {
    return this.childNodes.filter(n => n.nodeType === 1);
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    child.parentElement = this.nodeType === 1 ? this : null;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
      child.parentElement = null;
    }
    return child;
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx !== -1) {
      newNode.parentNode = this;
      newNode.parentElement = this.nodeType === 1 ? this : null;
      this.childNodes.splice(idx, 0, newNode);
    } else {
      this.appendChild(newNode);
    }
    return newNode;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
}

class DOMTextNode extends DOMNode {
  constructor(text, ownerDocument) {
    super(ownerDocument);
    this.nodeType = 3;
    this.nodeValue = String(text);
  }
  get textContent() { return this.nodeValue; }
  set textContent(v) { this.nodeValue = String(v); }
}

class DOMCommentNode extends DOMNode {
  constructor(text, ownerDocument) {
    super(ownerDocument);
    this.nodeType = 8;
    this.nodeValue = String(text);
  }
}

function splitBranch(branch) {
  const tokens = [];
  let cur = '';
  let i = 0;
  while (i < branch.length) {
    const ch = branch[i];
    if (ch === '>') {
      if (cur.trim()) tokens.push(cur.trim());
      tokens.push('>');
      cur = '';
    } else if (ch === ' ' || ch === '\t') {
      if (cur.trim()) tokens.push(cur.trim());
      tokens.push(' ');
      cur = '';
    } else if (ch === '[') {
      while (i < branch.length && branch[i] !== ']') {
        cur += branch[i];
        i++;
      }
      cur += ']';
    } else {
      cur += ch;
    }
    i++;
  }
  if (cur.trim()) tokens.push(cur.trim());
  return tokens.filter(t => t.length > 0 && t !== ' ');
}

function matchesCompound(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  let rem = sel.trim();
  const tagMatch = rem.match(/^[a-zA-Z0-9_-]+/);
  if (tagMatch) {
    if (el.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
    rem = rem.slice(tagMatch[0].length);
  }
  const tokenRegex = /(?:#([a-zA-Z0-9_-]+))|(?:\.([a-zA-Z0-9_-]+))|(?:\[([a-zA-Z0-9_:-]+)(?:([*^$]?=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\])/g;
  let m;
  let parsedLen = 0;
  while ((m = tokenRegex.exec(rem)) !== null) {
    parsedLen += m[0].length;
    if (m[1]) {
      if (el.id !== m[1]) return false;
    } else if (m[2]) {
      if (!el.classList.contains(m[2])) return false;
    } else if (m[3]) {
      const attrName = m[3];
      const op = m[4];
      const val = m[5] !== undefined ? m[5] : m[6] !== undefined ? m[6] : m[7];
      if (!el.hasAttribute(attrName)) return false;
      if (op) {
        const actual = el.getAttribute(attrName);
        if (op === '=' && actual !== val) return false;
        if (op === '*=' && !actual.includes(val)) return false;
        if (op === '^=' && !actual.startsWith(val)) return false;
        if (op === '$=' && !actual.endsWith(val)) return false;
      }
    }
  }
  return parsedLen === rem.length;
}

function matchesSelector(el, selector) {
  if (el.nodeType !== 1) return false;
  const branches = selector.split(',').map(s => s.trim()).filter(Boolean);
  for (const branch of branches) {
    const tokens = splitBranch(branch);
    if (!tokens.length) continue;
    let p = tokens.length - 1;
    if (!matchesCompound(el, tokens[p])) continue;
    let cur = el;
    p--;
    let branchFailed = false;
    while (p >= 0) {
      if (tokens[p] === '>') {
        p--;
        cur = cur.parentElement;
        if (!cur || !matchesCompound(cur, tokens[p])) {
          branchFailed = true;
          break;
        }
        p--;
      } else {
        const target = tokens[p];
        cur = cur.parentElement;
        let matched = false;
        while (cur) {
          if (matchesCompound(cur, target)) {
            matched = true;
            break;
          }
          cur = cur.parentElement;
        }
        if (!matched) {
          branchFailed = true;
          break;
        }
        p--;
      }
    }
    if (!branchFailed) return true;
  }
  return false;
}

class DOMClassList {
  constructor(el) {
    this._el = el;
  }
  _getClasses() {
    const c = this._el.getAttribute('class') || '';
    return c.trim().split(/\s+/).filter(Boolean);
  }
  _setClasses(classes) {
    this._el.setAttribute('class', classes.join(' '));
  }
  contains(cls) {
    return this._getClasses().includes(cls);
  }
  add(...classes) {
    const list = this._getClasses();
    for (const c of classes) {
      if (!list.includes(c)) list.push(c);
    }
    this._setClasses(list);
  }
  remove(...classes) {
    let list = this._getClasses();
    list = list.filter(c => !classes.includes(c));
    this._setClasses(list);
  }
  toggle(cls, force) {
    const list = this._getClasses();
    const idx = list.indexOf(cls);
    if (force === true || (force === undefined && idx === -1)) {
      if (idx === -1) list.push(cls);
      this._setClasses(list);
      return true;
    } else {
      if (idx !== -1) list.splice(idx, 1);
      this._setClasses(list);
      return false;
    }
  }
}

class DOMElement extends DOMNode {
  constructor(tagName, ownerDocument) {
    super(ownerDocument);
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new DOMClassList(this);
    this.listeners = new Map();
    this.style = {};
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this._value = '';
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }

  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }

  get value() { return this._value; }
  set value(v) { this._value = String(v); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }

  getAttribute(name) {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }
  setAttribute(name, val) {
    this.attributes.set(name.toLowerCase(), String(val));
  }
  removeAttribute(name) {
    this.attributes.delete(name.toLowerCase());
  }
  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  get dataset() {
    const self = this;
    return new Proxy({}, {
      get(_, prop) {
        const attrName = 'data-' + String(prop).replace(/([A-Z])/g, '-$1').toLowerCase();
        return self.getAttribute(attrName);
      },
      set(_, prop, val) {
        const attrName = 'data-' + String(prop).replace(/([A-Z])/g, '-$1').toLowerCase();
        self.setAttribute(attrName, val);
        return true;
      }
    });
  }

  get textContent() {
    let out = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 3) out += child.nodeValue;
      else if (child.nodeType === 1) out += child.textContent;
    }
    return out;
  }
  set textContent(v) {
    this.childNodes = [];
    this.appendChild(new DOMTextNode(v, this.ownerDocument));
  }

  get innerHTML() {
    return this.childNodes.map(nodeToHTML).join('');
  }
  set innerHTML(html) {
    this.childNodes = [];
    parseHTMLTo(html, this, this.ownerDocument);
  }

  matches(sel) { return matchesSelector(this, sel); }
  closest(sel) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  querySelector(sel) {
    function dfs(node) {
      for (const child of node.children) {
        if (child.matches(sel)) return child;
        const res = dfs(child);
        if (res) return res;
      }
      return null;
    }
    return dfs(this);
  }

  querySelectorAll(sel) {
    const list = [];
    function dfs(node) {
      for (const child of node.children) {
        if (child.matches(sel)) list.push(child);
        dfs(child);
      }
    }
    dfs(this);
    return list;
  }

  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  addEventListener(type, fn, opts) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ fn, once: opts && opts.once });
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(type, list.filter(l => l.fn !== fn));
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    let cur = this;
    while (cur) {
      event.currentTarget = cur;
      const list = cur.listeners.get(event.type);
      if (list) {
        for (const item of [...list]) {
          item.fn.call(cur, event);
          if (item.once) cur.removeEventListener(event.type, item.fn);
          if (event._stopped) return !event.defaultPrevented;
        }
      }
      if (!event.bubbles) break;
      cur = cur.parentElement;
    }
    return !event.defaultPrevented;
  }

  click() {
    const ev = new DOMEvent('click', { bubbles: true, cancelable: true });
    this.dispatchEvent(ev);
  }
  focus() {}
  blur() {}
  getBoundingClientRect() {
    return { top: 0, left: 0, width: 800, height: 600, right: 800, bottom: 600 };
  }
}

class DOMEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.bubbles = opts.bubbles !== undefined ? !!opts.bubbles : true;
    this.cancelable = opts.cancelable !== undefined ? !!opts.cancelable : true;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this._stopped = false;
    this.button = opts.button || 0;
    this.key = opts.key || '';
    this.metaKey = !!opts.metaKey;
    this.ctrlKey = !!opts.ctrlKey;
    this.shiftKey = !!opts.shiftKey;
    this.altKey = !!opts.altKey;
    this.detail = opts.detail || null;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
  stopImmediatePropagation() { this._stopped = true; }
}

function nodeToHTML(node) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType === 8) return `<!--${node.nodeValue}-->`;
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  let attrs = '';
  for (const [k, v] of node.attributes) {
    attrs += ` ${k}="${String(v).replace(/"/g, '&quot;')}"`;
  }
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  if (voidTags.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${node.childNodes.map(nodeToHTML).join('')}</${tag}>`;
}

function parseHTMLTo(html, parent, ownerDoc) {
  const tagRegex = /<!--([\s\S]*?)-->|<(\/)?([a-zA-Z0-9:-]+)((?:\s+[^=>\s/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/)?>|([^<]+)/g;
  let match;
  const stack = [parent];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const svgSelfClosing = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);

  while ((match = tagRegex.exec(html)) !== null) {
    const [full, comment, isClosing, tagName, attrStr, isSelfClosingTag, text] = match;
    if (comment !== undefined) {
      stack[stack.length - 1].appendChild(new DOMCommentNode(comment, ownerDoc));
      continue;
    }
    if (text !== undefined) {
      if (text.length > 0) {
        stack[stack.length - 1].appendChild(new DOMTextNode(text, ownerDoc));
      }
      continue;
    }
    const lowerTag = tagName.toLowerCase();
    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName.toLowerCase() === lowerTag) {
          stack.length = i;
          break;
        }
      }
    } else {
      const el = new DOMElement(lowerTag, ownerDoc);
      if (attrStr) {
        const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
          const attrName = attrMatch[1];
          const attrVal = attrMatch[2] !== undefined ? attrMatch[2] :
                          attrMatch[3] !== undefined ? attrMatch[3] :
                          attrMatch[4] !== undefined ? attrMatch[4] : '';
          el.setAttribute(attrName, attrVal);
        }
      }
      stack[stack.length - 1].appendChild(el);
      const isVoid = voidTags.has(lowerTag) || isSelfClosingTag === '/' || (svgSelfClosing.has(lowerTag) && isSelfClosingTag === '/');
      if (!isVoid) {
        stack.push(el);
      }
    }
  }
}

class DOMDocument extends DOMElement {
  constructor() {
    super('DOCUMENT', null);
    this.nodeType = 9;
    this.ownerDocument = this;
    this.head = new DOMElement('head', this);
    this.body = new DOMElement('body', this);
    this.appendChild(this.head);
    this.appendChild(this.body);
  }
  createElement(tag) {
    return new DOMElement(tag, this);
  }
}

// ── Global DOM Mock Setup / Teardown ────────────────────────────────────────

const savedGlobals = {};
let activeDoc = null;
const localStorageStore = new Map();

const localStorageMock = {
  getItem(k) { return localStorageStore.has(k) ? localStorageStore.get(k) : null; },
  setItem(k, v) { localStorageStore.set(k, String(v)); },
  removeItem(k) { localStorageStore.delete(k); },
  clear() { localStorageStore.clear(); }
};

const createdMonacoModels = new Map();
const mockMonaco = {
  editor: {
    defineTheme: () => {},
    create: (container, opts) => {
      let currentModel = null;
      return {
        layout: () => {},
        setModel: (m) => { currentModel = m; },
        getModel: () => currentModel,
        setValue: (v) => { if (currentModel) currentModel.setValue(v); },
        getValue: () => currentModel ? currentModel.getValue() : '',
        dispose: () => {},
        onDidChangeModelContent: () => ({ dispose: () => {} }),
        onDidChangeCursorPosition: () => ({ dispose: () => {} }),
        addAction: () => {},
        addCommand: () => {},
        focus: () => {}
      };
    },
    createModel: (val, lang, uri) => {
      const uriStr = uri ? uri.toString() : 'uri';
      const model = {
        _value: val,
        _uri: uriStr,
        isDisposed: false,
        getValue: () => model._value,
        setValue: (v) => { model._value = v; },
        dispose: () => { model.isDisposed = true; },
        uri: uri || { toString: () => uriStr }
      };
      createdMonacoModels.set(uriStr, model);
      return model;
    },
    getModel: (uri) => {
      const uriStr = uri ? uri.toString() : 'uri';
      const m = createdMonacoModels.get(uriStr);
      return m && !m.isDisposed ? m : null;
    },
    Uri: { parse: (u) => ({ toString: () => u }) }
  },
  languages: {
    typescript: {
      typescriptDefaults: { setCompilerOptions: () => {}, addExtraLib: () => {} },
      javascriptDefaults: { setCompilerOptions: () => {}, addExtraLib: () => {} }
    }
  }
};

function setupMockDOM() {
  activeDoc = new DOMDocument();
  savedGlobals.window = globalThis.window;
  savedGlobals.document = globalThis.document;
  savedGlobals.localStorage = globalThis.localStorage;
  savedGlobals.Event = globalThis.Event;
  savedGlobals.CustomEvent = globalThis.CustomEvent;
  savedGlobals.monaco = globalThis.monaco;

  globalThis.window = globalThis;
  globalThis.document = activeDoc;
  globalThis.localStorage = localStorageMock;
  globalThis.Event = DOMEvent;
  globalThis.CustomEvent = DOMEvent;
  globalThis.monaco = mockMonaco;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  localStorageMock.clear();
  return activeDoc;
}

function teardownMockDOM() {
  if (savedGlobals.window !== undefined) globalThis.window = savedGlobals.window;
  if (savedGlobals.document !== undefined) globalThis.document = savedGlobals.document;
  if (savedGlobals.localStorage !== undefined) globalThis.localStorage = savedGlobals.localStorage;
  if (savedGlobals.Event !== undefined) globalThis.Event = savedGlobals.Event;
  if (savedGlobals.CustomEvent !== undefined) globalThis.CustomEvent = savedGlobals.CustomEvent;
  if (savedGlobals.monaco !== undefined) globalThis.monaco = savedGlobals.monaco;
  activeDoc = null;
}

// ── Module Loaders ──────────────────────────────────────────────────────────

let cachedSchemas = null;
function loadSchemas() {
  if (cachedSchemas) return cachedSchemas;

  const distPath = path.resolve(CODE_LAB_ROOT, 'dist/schemas.js');
  if (fs.existsSync(distPath)) {
    cachedSchemas = require(distPath);
    return cachedSchemas;
  }

  const srcTsPath = path.resolve(CODE_LAB_ROOT, 'src/schemas.ts');
  if (fs.existsSync(srcTsPath)) {
    const { transpileTS } = require(path.resolve(CODE_LAB_ROOT, 'src/runtime.ts'));
    const tsCode = fs.readFileSync(srcTsPath, 'utf8');
    const jsCode = transpileTS(tsCode);
    const mod = { exports: {} };
    const fn = new Function('require', 'module', 'exports', jsCode);
    fn(require, mod, mod.exports);
    cachedSchemas = mod.exports;
    return cachedSchemas;
  }

  throw new Error(`Cannot locate schemas at ${distPath} or ${srcTsPath}`);
}

function loadWorkbench() {
  const wbPath = path.resolve(CODE_LAB_ROOT, 'src/workbench.ts');
  const distPath = path.resolve(CODE_LAB_ROOT, 'dist/code-lab.js');
  if (fs.existsSync(distPath)) {
    return require(distPath);
  }
  if (fs.existsSync(wbPath)) {
    return require(wbPath);
  }
  throw new Error(`Cannot locate workbench module`);
}

function runCommand(command, opts = {}) {
  try {
    const stdout = child_process.execSync(command, {
      cwd: opts.cwd || CODE_LAB_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 30000,
      env: { ...process.env, ...opts.env }
    });
    return { ok: true, status: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      ok: false,
      status: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message
    };
  }
}

// ── Test Suite Runner ───────────────────────────────────────────────────────

function createSuite(tierName, description) {
  const tests = [];
  const skipped = [];

  return {
    test(id, name, fn) {
      tests.push({ id, name, fn });
    },
    skip(id, name, reason) {
      skipped.push({ id, name, reason });
    },
    skipUnless(condition, id, name, fn, reason) {
      if (condition) this.test(id, name, fn);
      else this.skip(id, name, reason || 'prerequisite not available');
    },
    async run() {
      console.log(`\n═══════════════════════════════════════════════════════════════════════`);
      console.log(`▶ ${tierName}: ${description}`);
      console.log(`═══════════════════════════════════════════════════════════════════════`);

      for (const s of skipped) {
        console.log(`  ○ [${s.id}] ${s.name} — skipped: ${s.reason}`);
      }

      let passed = 0;
      let failed = 0;
      const errors = [];
      const startTime = Date.now();

      for (const t of tests) {
        const testStart = Date.now();
        try {
          await t.fn();
          const dur = Date.now() - testStart;
          passed++;
          console.log(`  ✔ [${t.id}] ${t.name} (${dur}ms)`);
        } catch (err) {
          const dur = Date.now() - testStart;
          failed++;
          console.error(`  ✘ [${t.id}] ${t.name} (${dur}ms)`);
          console.error(`      Error: ${err.message}`);
          errors.push({ id: t.id, name: t.name, error: err });
        }
      }

      const totalDur = Date.now() - startTime;
      console.log(`───────────────────────────────────────────────────────────────────────`);
      console.log(`Tier Results: ${passed} passed, ${failed} failed, ${skipped.length} skipped (${tests.length} executed, ${totalDur}ms)`);
      if (failed > 0) {
        console.log(`Errors summary:`);
        for (const e of errors) {
          console.log(`  - [${e.id}] ${e.name}: ${e.error.message}`);
        }
      }
      console.log(`───────────────────────────────────────────────────────────────────────\n`);

      return {
        name: tierName,
        total: tests.length,
        passed,
        failed,
        skipped: skipped.length,
        skipDetails: skipped,
        errors,
        durationMs: totalDur
      };
    }
  };
}

// ── Extension Loader ────────────────────────────────────────────────────────

let cachedGuidedLab = null;

/**
 * Loads the separately-bundled guided-lab extension.
 *
 * The extension is deliberately not part of `dist/code-lab.js` (it pulls in
 * Zod); it ships as `dist/extensions/guided-lab.js`. That IIFE exposes
 * `CodeLabGuidedLab`, so evaluate it in a VM context instead of relying on
 * CommonJS interop.
 */
function loadGuidedLab() {
  if (cachedGuidedLab) return cachedGuidedLab;

  const distPath = path.resolve(CODE_LAB_ROOT, 'dist/extensions/guided-lab.js');
  if (!fs.existsSync(distPath)) {
    throw new Error(`Missing guided-lab bundle at ${distPath}. Run \`bun run build\`.`);
  }

  const vm = require('node:vm');
  const sandbox = { module: { exports: {} }, exports: {}, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(distPath, 'utf8'), sandbox, { filename: distPath });

  const mod = sandbox.CodeLabGuidedLab || sandbox.module.exports || {};
  const extension = mod.guidedLabExtension || mod.default;
  if (typeof extension !== 'function') {
    throw new Error('guided-lab bundle did not export a guidedLabExtension function');
  }
  cachedGuidedLab = extension;
  return cachedGuidedLab;
}

module.exports = {
  CODE_LAB_ROOT,
  SYSTEM_DESIGN_ROOT,
  WIKI_ROOT,
  HAS_SYSTEM_DESIGN,
  HAS_WIKI,
  DOMDocument,
  DOMElement,
  DOMEvent,
  setupMockDOM,
  teardownMockDOM,
  mockMonaco,
  loadSchemas,
  loadWorkbench,
  loadGuidedLab,
  runCommand,
  createSuite
};
