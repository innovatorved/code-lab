'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 2 Challenger Adversarial Test Suite:
 * Interactive Handlers & State Persistence (Task Checkboxes & Copy Code)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');

// ── Lightweight Zero-Dependency Virtual DOM & Browser Emulation ──────────────

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
  return tokens;
}

function matchesCompound(el, sel) {
  if (el.nodeType !== 1) return false;
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
    this._selected = false;
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }

  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }

  get value() { return this._value; }
  set value(v) { this._value = String(v); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { if (v) this.setAttribute('checked', ''); else this.removeAttribute('checked'); }

  get draggable() { return this.getAttribute('draggable') === 'true'; }
  set draggable(v) { this.setAttribute('draggable', String(v)); }

  select() {
    this._selected = true;
  }

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
    } else if (text !== undefined) {
      const decoded = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      stack[stack.length - 1].appendChild(new DOMTextNode(decoded, ownerDoc));
    } else if (isClosing) {
      const lowerTag = tagName.toLowerCase();
      while (stack.length > 1) {
        const popped = stack.pop();
        if (popped.tagName.toLowerCase() === lowerTag) break;
      }
    } else {
      const lowerTag = tagName.toLowerCase();
      const el = new DOMElement(lowerTag, ownerDoc);
      if (attrStr) {
        const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)|([^\s>]+)))?/g;
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
  createTextNode(txt) {
    return new DOMTextNode(txt, this);
  }
  execCommand(cmd) {
    return true;
  }
}

// ── Initialize Global Environment ───────────────────────────────────────────

const doc = new DOMDocument();
const localStorageStore = new Map();
const localStorageMock = {
  getItem(k) { return localStorageStore.has(k) ? localStorageStore.get(k) : null; },
  setItem(k, v) { localStorageStore.set(k, String(v)); },
  removeItem(k) { localStorageStore.delete(k); },
  clear() { localStorageStore.clear(); }
};

globalThis.window = globalThis;
globalThis.document = doc;
globalThis.localStorage = localStorageMock;
globalThis.Event = DOMEvent;

// Load CodeLab SDK
const CodeLabSDK = require('../src/workbench.js');
const { renderSimpleMarkdown, renderMarkdown, CodeLabWorkbench } = CodeLabSDK;

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runAdversarialSuite() {
  let passed = 0;
  let failed = 0;
  const errors = [];

  async function test(name, fn) {
    localStorageStore.clear();
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      errors.push({ name, err });
      console.error(`  ✗ ${name}`);
      console.error(`    ${err && err.stack ? err.stack : err}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log('   M2 Adversarial Challenge Suite: Interactive Handlers & State Sync     ');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ───────────────────────────────────────────────────────────────────────────
  // Challenge Group 1: Task List Checkbox Toggling & Active File Mutation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('=== Suite 1: Task List Checkbox Toggling & Mutation Stress ===');

  await test('[ADV-1.1] Unchecked -> Checked -> Unchecked toggling preserves exact surrounding markdown', () => {
    const container = document.createElement('div');
    const initialMd = [
      '# Project Roadmap',
      '',
      'Introductory notes with special chars: <foo> & "bar".',
      '',
      '- [ ] Step 1: Database Setup',
      '- [x] Step 2: Authentication Service',
      '- [ ] Step 3: CI/CD Pipeline',
      '',
      'Closing summary.'
    ].join('\n');

    const bench = new CodeLabWorkbench(container, {
      files: { 'ROADMAP.md': initialMd },
      activeFile: 'ROADMAP.md'
    });

    let codeChangeEvents = [];
    bench.onCodeChange = (file, code) => {
      codeChangeEvents.push({ file, code });
    };

    // Toggle Step 1 (task index 0) from false to true
    bench._toggleMarkdownTask('ROADMAP.md', 0, true);
    assert.equal(codeChangeEvents.length, 1);
    assert.equal(codeChangeEvents[0].file, 'ROADMAP.md');
    assert.ok(bench.files['ROADMAP.md'].includes('- [x] Step 1: Database Setup'));
    assert.ok(bench.files['ROADMAP.md'].includes('- [x] Step 2: Authentication Service'));
    assert.ok(bench.files['ROADMAP.md'].includes('- [ ] Step 3: CI/CD Pipeline'));
    assert.ok(bench.files['ROADMAP.md'].includes('Introductory notes with special chars: <foo> & "bar".'));

    // Toggle Step 2 (task index 1) from true to false
    bench._toggleMarkdownTask('ROADMAP.md', 1, false);
    assert.equal(codeChangeEvents.length, 2);
    assert.ok(bench.files['ROADMAP.md'].includes('- [ ] Step 2: Authentication Service'));

    // Toggle Step 1 back to false
    bench._toggleMarkdownTask('ROADMAP.md', 0, false);
    // Toggle Step 2 back to true
    bench._toggleMarkdownTask('ROADMAP.md', 1, true);

    // Exact match with initial
    assert.equal(bench.files['ROADMAP.md'], initialMd);
  });

  await test('[ADV-1.2] Uppercase [X] task marker unchecking and rechecking', () => {
    const container = document.createElement('div');
    const initialMd = '* [X] Task with capital X\n+ [ ] Task with plus';
    const bench = new CodeLabWorkbench(container, {
      files: { 'tasks.md': initialMd },
      activeFile: 'tasks.md'
    });

    // Uncheck index 0
    bench._toggleMarkdownTask('tasks.md', 0, false);
    assert.equal(bench.files['tasks.md'], '* [ ] Task with capital X\n+ [ ] Task with plus');

    // Recheck index 0 (should become lowercase x)
    bench._toggleMarkdownTask('tasks.md', 0, true);
    assert.equal(bench.files['tasks.md'], '* [x] Task with capital X\n+ [ ] Task with plus');

    // Check index 1 (+ marker)
    bench._toggleMarkdownTask('tasks.md', 1, true);
    assert.equal(bench.files['tasks.md'], '* [x] Task with capital X\n+ [x] Task with plus');
  });

  await test('[ADV-1.3] Numbered list task markers (1. [ ], 2. [x], 10. [ ]) toggling', () => {
    const container = document.createElement('div');
    const initialMd = '1. [ ] First ordered\n2. [x] Second ordered\n10. [ ] Tenth ordered';
    const bench = new CodeLabWorkbench(container, {
      files: { 'ordered.md': initialMd },
      activeFile: 'ordered.md'
    });

    bench._toggleMarkdownTask('ordered.md', 2, true);
    assert.equal(bench.files['ordered.md'], '1. [ ] First ordered\n2. [x] Second ordered\n10. [x] Tenth ordered');

    bench._toggleMarkdownTask('ordered.md', 1, false);
    assert.equal(bench.files['ordered.md'], '1. [ ] First ordered\n2. [ ] Second ordered\n10. [x] Tenth ordered');
  });

  await test('[ADV-1.4] Deeply nested task lists (4 indentation levels) preserve indentation & monotonic indices', () => {
    const container = document.createElement('div');
    const initialMd = [
      '- [ ] Level 0 Item 0',
      '  - [ ] Level 1 Item 1',
      '    - [ ] Level 2 Item 2',
      '      - [ ] Level 3 Item 3',
      '  - [x] Level 1 Item 4',
      '- [ ] Level 0 Item 5'
    ].join('\n');

    const bench = new CodeLabWorkbench(container, {
      files: { 'nested.md': initialMd },
      activeFile: 'nested.md'
    });

    // Render markdown to verify DOM indexing
    const html = renderSimpleMarkdown(bench.files['nested.md']);
    assert.ok(html.includes('data-cl-task-idx="0"'));
    assert.ok(html.includes('data-cl-task-idx="1"'));
    assert.ok(html.includes('data-cl-task-idx="2"'));
    assert.ok(html.includes('data-cl-task-idx="3"'));
    assert.ok(html.includes('data-cl-task-idx="4"'));
    assert.ok(html.includes('data-cl-task-idx="5"'));

    // Toggle Deepest Level 3 (index 3) to checked
    bench._toggleMarkdownTask('nested.md', 3, true);
    assert.ok(bench.files['nested.md'].includes('      - [x] Level 3 Item 3'), '6-space indentation must be preserved');

    // Toggle Level 1 Item 4 (index 4) to unchecked
    bench._toggleMarkdownTask('nested.md', 4, false);
    assert.ok(bench.files['nested.md'].includes('  - [ ] Level 1 Item 4'), '2-space indentation must be preserved');

    // Toggle Root Level 0 Item 5 (index 5) to checked
    bench._toggleMarkdownTask('nested.md', 5, true);
    assert.ok(bench.files['nested.md'].includes('- [x] Level 0 Item 5'), '0-space indentation must be preserved');

    // Verify siblings and parents remained intact
    assert.ok(bench.files['nested.md'].includes('- [ ] Level 0 Item 0'));
    assert.ok(bench.files['nested.md'].includes('  - [ ] Level 1 Item 1'));
    assert.ok(bench.files['nested.md'].includes('    - [ ] Level 2 Item 2'));
  });

  await test('[ADV-1.5] Code fence masking: multiple code blocks with backticks & tildes do NOT count faux tasks', () => {
    const container = document.createElement('div');
    const complexMd = [
      '# Document with Code Samples',
      '',
      '- [ ] Real Task 0 (before fences)',
      '',
      '```markdown',
      '# Inside Backtick Fence 1',
      '- [ ] Faux Code Task 1',
      '- [x] Faux Code Task 2',
      '1. [ ] Faux Code Task 3',
      '```',
      '',
      '- [ ] Real Task 1 (between fences)',
      '',
      '~~~bash title="deploy.sh"',
      '# Inside Tilde Fence 2',
      '# - [ ] Faux Code Task 4',
      'echo "- [ ] not a task"',
      '~~~',
      '',
      '````markdown',
      'Nested 4-backtick fence:',
      '```',
      '- [ ] Faux Code Task 5 inside 4-ticks',
      '```',
      '````',
      '',
      '- [ ] Real Task 2 (after all fences)'
    ].join('\n');

    const bench = new CodeLabWorkbench(container, {
      files: { 'guide.md': complexMd },
      activeFile: 'guide.md'
    });

    // 1. Verify HTML rendering only generates 3 checkboxes
    const html = renderSimpleMarkdown(complexMd);
    const matches = html.match(/class="codelab-task-checkbox"/g) || [];
    assert.equal(matches.length, 3, 'Must render exactly 3 interactive checkboxes, ignoring all code fences');

    // 2. Toggle Real Task 1 (index 1) to checked
    bench._toggleMarkdownTask('guide.md', 1, true);

    const updated = bench.files['guide.md'];
    assert.ok(updated.includes('- [ ] Real Task 0 (before fences)'));
    assert.ok(updated.includes('- [x] Real Task 1 (between fences)'), 'Real Task 1 must be toggled');
    assert.ok(updated.includes('- [ ] Real Task 2 (after all fences)'));

    // Check code blocks were untouched byte-for-byte
    assert.ok(updated.includes('- [ ] Faux Code Task 1\n- [x] Faux Code Task 2\n1. [ ] Faux Code Task 3'));
    assert.ok(updated.includes('# - [ ] Faux Code Task 4\necho "- [ ] not a task"'));
    assert.ok(updated.includes('- [ ] Faux Code Task 5 inside 4-ticks'));

    // 3. Toggle Real Task 2 (index 2) to checked
    bench._toggleMarkdownTask('guide.md', 2, true);
    assert.ok(bench.files['guide.md'].includes('- [x] Real Task 2 (after all fences)'));

    // 4. Toggle Real Task 0 (index 0) to checked
    bench._toggleMarkdownTask('guide.md', 0, true);
    assert.ok(bench.files['guide.md'].includes('- [x] Real Task 0 (before fences)'));
  });

  await test('[ADV-1.6] Task toggling triggers _saveState() and persists to localStorage', () => {
    const container = document.createElement('div');
    const bench = new CodeLabWorkbench(container, {
      labId: 'test-lab-persistence',
      files: { 'notes.md': '- [ ] Item 1' },
      activeFile: 'notes.md'
    });

    bench._toggleMarkdownTask('notes.md', 0, true);

    // Canonical persistence contract: key = `sd-codelab-v1:<labId>`; files live under
    // `customFiles[mode:lang].files` in the serialized state object.
    const storedKey = 'sd-codelab-v1:test-lab-persistence';
    const saved = localStorage.getItem(storedKey);
    assert.ok(saved, 'State must be saved in localStorage under the canonical storage key');
    const parsed = JSON.parse(saved);
    // Shape: customFiles[mode:lang] === { '<file>': '<content>' }
    const fileSet = parsed.customFiles && Object.values(parsed.customFiles)[0];
    assert.ok(fileSet && typeof fileSet === 'object', 'Saved state should carry custom files');
    assert.equal(fileSet['notes.md'], '- [x] Item 1');
    // Host-app mirror key must also be written for progress trackers.
    assert.ok(localStorage.getItem('sd_codelab_test-lab-persistence'), 'Host mirror key should be written');
  });

  await test('[ADV-1.7] Task toggling synchronizes fallback textarea editor if present', () => {
    const container = document.createElement('div');
    const initialMd = '- [ ] First';
    const bench = new CodeLabWorkbench(container, {
      files: { 'fallback.md': initialMd },
      activeFile: 'fallback.md'
    });

    const fallbackEditor = container.querySelector('#cl-fallback-editor');
    if (fallbackEditor) {
      assert.equal(fallbackEditor.value, initialMd);
      bench._toggleMarkdownTask('fallback.md', 0, true);
      assert.equal(fallbackEditor.value, '- [x] First');
    }
  });

  await test('[ADV-1.8] Guide sidebar checkbox click updates visual state but does NOT mutate active workspace file', () => {
    const container = document.createElement('div');
    const activeFileContent = 'const original = true;';
    const bench = new CodeLabWorkbench(container, {
      hasGuidedLab: true,
      files: {
        'index.js': activeFileContent
      },
      activeFile: 'index.js'
    });

    let onCodeChangeCalled = false;
    bench.onCodeChange = () => { onCodeChangeCalled = true; };

    const guideContent = container.querySelector('#cl-guide-content, .codelab-guide__content');
    assert.ok(guideContent);
    guideContent.innerHTML = `<div class="codelab-guide-prose">${renderSimpleMarkdown('- [ ] Step 1 Verification')}</div>`;

    const checkbox = guideContent.querySelector('.codelab-task-checkbox');
    assert.ok(checkbox);
    const taskItem = checkbox.closest('.codelab-task-item');
    assert.ok(!taskItem.classList.contains('codelab-task-item--checked'));

    // Click checkbox inside guide
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify visual update occurred
    assert.ok(taskItem.classList.contains('codelab-task-item--checked'), 'Visual task item should toggle checked');

    // Verify active file was NOT changed
    assert.equal(bench.files['index.js'], activeFileContent, 'Workspace active file must not be mutated');
    assert.equal(onCodeChangeCalled, false, 'onCodeChange must not be dispatched for guide checkboxes');
  });

  await test('[ADV-1.9] Out-of-bounds or invalid task index does not throw or corrupt files', () => {
    const container = document.createElement('div');
    const initialMd = '- [ ] Only one task';
    const bench = new CodeLabWorkbench(container, {
      files: { 'safe.md': initialMd },
      activeFile: 'safe.md'
    });

    // Out of bounds index
    bench._toggleMarkdownTask('safe.md', 999, true);
    assert.equal(bench.files['safe.md'], initialMd);

    // Negative index
    bench._toggleMarkdownTask('safe.md', -1, true);
    assert.equal(bench.files['safe.md'], initialMd);

    // Non-existent file
    bench._toggleMarkdownTask('missing.md', 0, true);
    assert.equal(bench.files['missing.md'], undefined);
  });

  await test('[ADV-1.10] Tasks with complex inline formatting, quotes, and HTML entities preserve line content verbatim', () => {
    const container = document.createElement('div');
    const initialMd = '- [ ] Fix <div class="alert"> & "quote" with `code_snippet(1)` and **bold**';
    const bench = new CodeLabWorkbench(container, {
      files: { 'complex.md': initialMd },
      activeFile: 'complex.md'
    });

    bench._toggleMarkdownTask('complex.md', 0, true);
    assert.equal(bench.files['complex.md'], '- [x] Fix <div class="alert"> & "quote" with `code_snippet(1)` and **bold**');

    bench._toggleMarkdownTask('complex.md', 0, false);
    assert.equal(bench.files['complex.md'], initialMd);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Challenge Group 2: 1-Click Copy Code Button
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Suite 2: 1-Click Copy Code Button & Clipboard Stress ===');

  await test('[ADV-2.1] Modern navigator.clipboard.writeText copies unescaped raw code and applies 2000ms feedback', async () => {
    const container = document.createElement('div');
    const rawJs = 'const greet = (name) => `Hello, ${name}! <script>alert(1)</script>`;\nconsole.log(greet("world"));';
    const bench = new CodeLabWorkbench(container, {
      files: {
        'doc.md': '```javascript\n' + rawJs + '\n```'
      },
      activeFile: 'doc.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    assert.ok(preview);
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['doc.md']);

    let clipboardPayload = null;
    globalThis.navigator = {
      clipboard: {
        writeText: async (text) => {
          clipboardPayload = text;
        }
      }
    };

    const copyBtn = preview.querySelector('.codelab-copy-code-btn');
    assert.ok(copyBtn);
    const textSpan = copyBtn.querySelector('.codelab-copy-code-btn__text');
    assert.equal(textSpan.textContent, 'Copy');

    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Verify payload is unescaped raw code
    assert.equal(clipboardPayload, rawJs);
    assert.ok(copyBtn.classList.contains('copied'));
    assert.equal(textSpan.textContent, 'Copied!');
  });

  await test('[ADV-2.2] Clipboard fallback executes when navigator.clipboard is undefined', async () => {
    const container = document.createElement('div');
    const rawCode = 'SELECT * FROM users WHERE active = 1 AND name = "O\'Connor";';
    const bench = new CodeLabWorkbench(container, {
      files: {
        'query.md': '```sql\n' + rawCode + '\n```'
      },
      activeFile: 'query.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    assert.ok(preview);
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['query.md']);

    // Set navigator.clipboard to undefined
    globalThis.navigator = {};

    let execCommandCalled = false;
    let execCommandArg = null;
    let appendedTextarea = null;

    const originalAppendChild = doc.body.appendChild.bind(doc.body);
    const originalRemoveChild = doc.body.removeChild.bind(doc.body);

    doc.body.appendChild = (child) => {
      if (child.tagName === 'TEXTAREA') {
        appendedTextarea = child;
      }
      return originalAppendChild(child);
    };

    doc.execCommand = (cmd) => {
      execCommandCalled = true;
      execCommandArg = cmd;
      return true;
    };

    const copyBtn = preview.querySelector('.codelab-copy-code-btn');
    assert.ok(copyBtn);
    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(execCommandCalled, true, 'document.execCommand must be called on fallback');
    assert.equal(execCommandArg, 'copy', 'execCommand argument must be "copy"');
    assert.ok(appendedTextarea, 'Fallback <textarea> must have been created and appended');
    assert.equal(appendedTextarea.value, rawCode, 'Fallback <textarea> must contain exact raw code');
    assert.equal(appendedTextarea._selected, true, 'Fallback <textarea> must be selected');

    // Restore methods
    doc.body.appendChild = originalAppendChild;
    doc.body.removeChild = originalRemoveChild;

    // Verify visual feedback still occurred
    assert.ok(copyBtn.classList.contains('copied'));
    assert.equal(copyBtn.querySelector('.codelab-copy-code-btn__text').textContent, 'Copied!');
  });

  await test('[ADV-2.3] Clipboard fallback executes when navigator.clipboard.writeText rejects', async () => {
    const container = document.createElement('div');
    const rawCode = 'curl -X POST https://api.example.com -d "key=value"';
    const bench = new CodeLabWorkbench(container, {
      files: {
        'api.md': '```bash\n' + rawCode + '\n```'
      },
      activeFile: 'api.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['api.md']);

    // writeText rejects (e.g. permission denied)
    let fallbackUsed = false;
    globalThis.navigator = {
      clipboard: {
        writeText: async () => {
          throw new Error('NotAllowedError: Read/write permission denied');
        }
      }
    };

    doc.execCommand = (cmd) => {
      if (cmd === 'copy') fallbackUsed = true;
      return true;
    };

    const copyBtn = preview.querySelector('.codelab-copy-code-btn');
    copyBtn.click();
    await new Promise(r => setTimeout(r, 20));

    assert.equal(fallbackUsed, true, 'Fallback execCommand must be called when writeText rejects');
    assert.ok(copyBtn.classList.contains('copied'));
    assert.equal(copyBtn.querySelector('.codelab-copy-code-btn__text').textContent, 'Copied!');
  });

  await test('[ADV-2.4] Fast consecutive clicks reset timer without flicker or double-fires', async () => {
    const container = document.createElement('div');
    const bench = new CodeLabWorkbench(container, {
      files: { 'quick.md': '```js\nconst x = 1;\n```' },
      activeFile: 'quick.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['quick.md']);

    globalThis.navigator = {
      clipboard: {
        writeText: async () => {}
      }
    };

    const copyBtn = preview.querySelector('.codelab-copy-code-btn');
    const textSpan = copyBtn.querySelector('.codelab-copy-code-btn__text');

    // 1st click
    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));
    assert.ok(copyBtn.classList.contains('copied'));
    assert.equal(textSpan.textContent, 'Copied!');
    const firstTimeout = copyBtn._copyTimeout;
    assert.ok(firstTimeout, 'First click must schedule a timeout');

    // 2nd click 100ms later
    await new Promise(r => setTimeout(r, 100));
    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));
    const secondTimeout = copyBtn._copyTimeout;
    assert.notEqual(firstTimeout, secondTimeout, 'Second click must reset timeout');
    assert.ok(copyBtn.classList.contains('copied'));
    assert.equal(textSpan.textContent, 'Copied!');

    // 3rd click 50ms later
    await new Promise(r => setTimeout(r, 50));
    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));
    const thirdTimeout = copyBtn._copyTimeout;
    assert.notEqual(secondTimeout, thirdTimeout, 'Third click must reset timeout');

    // Clean up timeout
    clearTimeout(thirdTimeout);
  });

  await test('[ADV-2.5] Raw code payload unescaping: HTML entities (&, <, >, ", \') are NOT double-encoded or mangled', async () => {
    const container = document.createElement('div');
    const codeWithEntities = '<template id="test">\n  <div class="header" data-msg="Tom & Jerry">\n    <span>a < b && c > d</span>\n  </div>\n</template>';
    const bench = new CodeLabWorkbench(container, {
      files: { 'entities.md': '```html\n' + codeWithEntities + '\n```' },
      activeFile: 'entities.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['entities.md']);

    let clipboardText = null;
    globalThis.navigator = {
      clipboard: {
        writeText: async (t) => { clipboardText = t; }
      }
    };

    const copyBtn = preview.querySelector('.codelab-copy-code-btn');
    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(clipboardText, codeWithEntities, 'Clipboard payload must match exact unescaped characters');
  });

  await test('[ADV-2.6] Fallback to codeEl.textContent when data-cl-code attribute is stripped or missing', async () => {
    const container = document.createElement('div');
    const rawText = 'console.log("fallback textContent check");';
    const bench = new CodeLabWorkbench(container, {
      files: { 'manual.md': '```js\n' + rawText + '\n```' },
      activeFile: 'manual.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['manual.md']);

    const block = preview.querySelector('.codelab-code-block');
    // Deliberately remove data-cl-code
    block.removeAttribute('data-cl-code');

    let clipboardText = null;
    globalThis.navigator = {
      clipboard: {
        writeText: async (t) => { clipboardText = t; }
      }
    };

    const copyBtn = preview.querySelector('.codelab-copy-code-btn');
    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(clipboardText, rawText, 'Should fallback to codeEl.textContent cleanly');
  });

  await test('[ADV-2.7] Multiple code blocks in single document copy only their respective content', async () => {
    const container = document.createElement('div');
    const block1Code = 'const block1 = 1;';
    const block2Code = 'const block2 = 2;';
    const block3Code = 'const block3 = 3;';
    const md = [
      '```js\n' + block1Code + '\n```',
      'Text between blocks',
      '```js\n' + block2Code + '\n```',
      'More text',
      '```js\n' + block3Code + '\n```'
    ].join('\n\n');

    const bench = new CodeLabWorkbench(container, {
      files: { 'multi.md': md },
      activeFile: 'multi.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['multi.md']);

    const copyButtons = preview.querySelectorAll('.codelab-copy-code-btn');
    assert.equal(copyButtons.length, 3);

    let clipboardText = null;
    globalThis.navigator = {
      clipboard: {
        writeText: async (t) => { clipboardText = t; }
      }
    };

    // Click block 2
    copyButtons[1].click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(clipboardText, block2Code);
    assert.ok(copyButtons[1].classList.contains('copied'));
    assert.ok(!copyButtons[0].classList.contains('copied'));
    assert.ok(!copyButtons[2].classList.contains('copied'));

    // Click block 3
    copyButtons[2].click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(clipboardText, block3Code);
    assert.ok(copyButtons[2].classList.contains('copied'));
    assert.ok(!copyButtons[0].classList.contains('copied'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`Adversarial Suite Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal adversarial runner error:', err);
  process.exit(1);
});
