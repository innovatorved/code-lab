'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 2 Test Suite: High-Fidelity GFM Markdown Rendering Engine
 *
 * Verifies:
 *   Tier 1: 8-Phase GFM Pipeline Core (Phases 0 through 7)
 *   Tier 2: Fenced Code Blocks, Syntax Highlighting Tokens & Copy Button
 *   Tier 3: GitHub Callout Alerts ([!NOTE], [!TIP], etc.) & Blockquotes
 *   Tier 4: GFM Tables with Column Alignments (:---, :---:, ---:) & Edge Cases
 *   Tier 5: Task Lists, Nested Lists, Sequential Indexing & Interactivity
 *   Tier 6: Typography, Strikethrough, Links, Rules & Snake Case Protection
 *   Tier 7: Interactive Event Handlers (Copy Feedback & File Task Mutation)
 *   Tier 8: SDK Exposure & Workbench Prototype Parity
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
    this.selectionStart = 0;
    this.selectionEnd = 0;
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

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { if (v) this.setAttribute('checked', ''); else this.removeAttribute('checked'); }

  get draggable() { return this.getAttribute('draggable') === 'true'; }
  set draggable(v) { this.setAttribute('draggable', String(v)); }

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
      stack[stack.length - 1].appendChild(new DOMTextNode(text, ownerDoc));
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

// Now load workbench module
const CodeLabSDK = require('./helpers/load').workbench;
const { setNavigator } = require('./helpers/globals');
const { renderSimpleMarkdown, renderMarkdown, CodeLabWorkbench } = CodeLabSDK;

async function runTestSuite() {
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
  console.log('   Milestone 2: High-Fidelity GFM Rendering Engine Verification Suite    ');
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 1: Normalization & Array Joining (Phase 0)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('=== Tier 1: Normalization & Array Inputs (Phase 0) ===');

  await test('[T1.1] Null, undefined, and whitespace-only inputs return empty string', () => {
    assert.equal(renderSimpleMarkdown(null), '');
    assert.equal(renderSimpleMarkdown(undefined), '');
    assert.equal(renderSimpleMarkdown(''), '');
    assert.equal(renderSimpleMarkdown('   \n\t  '), '');
  });

  await test('[T1.2] Array of strings joins with double newlines rather than commas', () => {
    const input = [
      '# Step 1: Initialize System',
      'This is the first instruction paragraph.',
      'This is the second instruction paragraph.'
    ];
    const html = renderSimpleMarkdown(input);
    assert.ok(html.includes('<h2>Step 1: Initialize System</h2>'));
    assert.ok(html.includes('<p>This is the first instruction paragraph.</p>'));
    assert.ok(html.includes('<p>This is the second instruction paragraph.</p>'));
    assert.ok(!html.includes('Initialize System,This is'), 'Array must not be joined with default comma');
  });

  await test('[T1.3] Array with null and undefined elements filters them safely', () => {
    const input = ['Valid paragraph 1', null, undefined, 'Valid paragraph 2'];
    const html = renderSimpleMarkdown(input);
    assert.ok(html.includes('<p>Valid paragraph 1</p>'));
    assert.ok(html.includes('<p>Valid paragraph 2</p>'));
    assert.ok(!html.includes('null'));
    assert.ok(!html.includes('undefined'));
  });

  await test('[T1.4] CRLF and CR line endings normalize to LF without layout corruption', () => {
    const input = 'Line 1\r\n\r\nLine 2\r\rLine 3';
    const html = renderSimpleMarkdown(input);
    assert.ok(html.includes('<p>Line 1</p>'));
    assert.ok(html.includes('<p>Line 2</p>'));
    assert.ok(html.includes('<p>Line 3</p>'));
  });

  await test('[T1.5] Custom <code-lab> tags are sanitized to prevent recursive execution', () => {
    const input = 'Here is a tag: <code-lab id="test-embed"></code-lab>';
    const html = renderSimpleMarkdown(input);
    assert.ok(html.includes('&lt;code-lab id="test-embed">'));
    assert.ok(!html.includes('<code-lab'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 2: Fenced Code Blocks & Syntax Highlighting (Phase 1)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 2: Fenced Code Blocks & Syntax Tokens (Phase 1) ===');

  await test('[T2.1] Fenced code blocks with backticks extract language, pre/code and copy button', () => {
    const md = '```typescript\nconst message: string = "hello";\nconsole.log(message);\n```';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('class="codelab-code-block"'));
    assert.ok(html.includes('<span class="codelab-code-block__lang">TYPESCRIPT</span>'));
    assert.ok(html.includes('data-cl-action="copy-code"'));
    assert.ok(html.includes('class="codelab-copy-code-btn"'));
    assert.ok(html.includes('<pre class="codelab-code-block__pre"><code class="codelab-code-block__code lang-typescript">'));
    assert.ok(html.includes('data-cl-code="const%20message%3A%20string%20%3D%20%22hello%22%3B%0Aconsole.log(message)%3B"'));
  });

  await test('[T2.2] Tilde fenced code blocks (~~~) are recognized identically', () => {
    const md = '~~~javascript\nconst a = 1;\n~~~';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('class="codelab-code-block"'));
    assert.ok(html.includes('<span class="codelab-code-block__lang">JAVASCRIPT</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">const</span>'));
  });

  await test('[T2.3] JavaScript/TypeScript syntax token classes are applied accurately', () => {
    const md = '```js\n// comment\nconst x = 42;\nfunction run() { return true; }\n```';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<span class="cl-tok-comment">// comment</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">const</span>'));
    assert.ok(html.includes('<span class="cl-tok-number">42</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">function</span>'));
    assert.ok(html.includes('<span class="cl-tok-function">run</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">return</span>'));
  });

  await test('[T2.4] JSON code blocks distinguish keys, string values, numbers, and booleans', () => {
    const md = '```json\n{\n  "service": "auth",\n  "port": 8080,\n  "enabled": true\n}\n```';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<span class="cl-tok-type">&quot;service&quot;</span>:'));
    assert.ok(html.includes('<span class="cl-tok-string">&quot;auth&quot;</span>'));
    assert.ok(html.includes('<span class="cl-tok-number">8080</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">true</span>'));
  });

  await test('[T2.5] Bash/Shell code blocks highlight commands, comments, and flags', () => {
    const md = '```bash\n# install dependencies\nbun test --all\ngit checkout -b feature\n```';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<span class="cl-tok-comment"># install dependencies</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">bun</span>'));
    assert.ok(html.includes('<span class="cl-tok-number">--all</span>'));
    assert.ok(html.includes('<span class="cl-tok-keyword">git</span>'));
    assert.ok(html.includes('<span class="cl-tok-number">-b</span>'));
  });

  await test('[T2.6] Code blocks with raw HTML characters are escaped preventing injection', () => {
    const md = '```html\n<div class="danger" onclick="alert(1)">Text & symbols</div>\n```';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('&lt;div class=&quot;danger&quot;'));
    assert.ok(html.includes('Text &amp; symbols'));
    assert.ok(!html.includes('<div class="danger" onclick='));
  });

  await test('[T2.7] Code block info string with extra attributes extracts clean language badge', () => {
    const md = '```ts title="server.ts" {1-3}\nexport const port = 3000;\n```';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<span class="codelab-code-block__lang">TS</span>'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 3: GitHub Callout Alerts & Blockquotes (Phase 3)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 3: GitHub Callout Alerts & Blockquotes (Phase 3) ===');

  await test('[T3.1] [!NOTE] alert renders with Note title, icon, and note class', () => {
    const md = '> [!NOTE]\n> Fast cache lookup with Redis.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('codelab-callout--note'));
    assert.ok(html.includes('class="codelab-callout__title">Note</span>'));
    assert.ok(html.includes('Fast cache lookup with Redis.'));
    assert.ok(html.includes('<span class="codelab-callout__icon">'));
  });

  await test('[T3.2] [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION] render corresponding variants', () => {
    const alerts = [
      { tag: 'TIP', cls: 'codelab-callout--tip', title: 'Tip' },
      { tag: 'IMPORTANT', cls: 'codelab-callout--important', title: 'Important' },
      { tag: 'WARNING', cls: 'codelab-callout--warning', title: 'Warning' },
      { tag: 'CAUTION', cls: 'codelab-callout--caution', title: 'Caution' }
    ];
    for (const a of alerts) {
      const html = renderSimpleMarkdown(`> [!${a.tag}]\n> Body text for ${a.tag}`);
      assert.ok(html.includes(a.cls), `Expected class ${a.cls}`);
      assert.ok(html.includes(`>${a.title}</span>`), `Expected title ${a.title}`);
      assert.ok(html.includes(`Body text for ${a.tag}`));
    }
  });

  await test('[T3.3] Custom alert titles on the tag line override default title', () => {
    const md = '> [!WARNING] Production Migration Warning\n> Ensure database backups exist.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('codelab-callout--warning'));
    assert.ok(html.includes('Production Migration Warning'));
    assert.ok(!html.includes('class="codelab-callout__title">Warning</span>'));
  });

  await test('[T3.4] Multi-line alert body preserves line breaks', () => {
    const md = '> [!NOTE]\n> Line 1\n> Line 2';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('Line 1<br>Line 2'));
  });

  await test('[T3.5] Multi-paragraph alert body creates distinct <p> paragraphs', () => {
    const md = '> [!TIP]\n> First tip paragraph.\n>\n> Second tip paragraph.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<p>First tip paragraph.</p>'));
    assert.ok(html.includes('<p>Second tip paragraph.</p>'));
  });

  await test('[T3.6] Lowercase alert tags ([!note], [!warning]) are normalized case-insensitively', () => {
    const md = '> [!note]\n> Lowercase tag note.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('codelab-callout--note'));
    assert.ok(html.includes('Lowercase tag note.'));
  });

  await test('[T3.7] Unrecognized alert tags fall back to standard blockquotes', () => {
    const md = '> [!UNKNOWN]\n> Standard text in quote.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<blockquote class="codelab-blockquote">'));
    assert.ok(html.includes('[!UNKNOWN]'));
    assert.ok(!html.includes('codelab-callout--'));
  });

  await test('[T3.8] Standard blockquote without alert tag renders semantic blockquote', () => {
    const md = '> Architecture is the art of how to waste space.\n> — Philip Johnson';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<blockquote class="codelab-blockquote">'));
    assert.ok(html.includes('Architecture is the art'));
    assert.ok(!html.includes('codelab-callout'));
  });

  await test('[T3.9] Alert nested inside blockquote parses cleanly without crashing', () => {
    const md = '> > [!NOTE]\n> > Nested alert note.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('codelab-callout--note'));
    assert.ok(html.includes('Nested alert note.'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 4: GFM Tables with Column Alignments (Phase 4)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 4: GFM Tables with Column Alignments (Phase 4) ===');

  await test('[T4.1] Standard table parses header, body, alignments, and wrapper', () => {
    const md = '| Name | Role | Status |\n| :--- | :---: | ---: |\n| Alice | Lead | Active |\n| Bob | QA | Pending |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<div class="codelab-table-wrap">'));
    assert.ok(html.includes('<table class="codelab-table">'));
    assert.ok(html.includes('<thead><tr>'));
    assert.ok(html.includes('<th>Name</th>'));
    assert.ok(html.includes('<th style="text-align:center;">Role</th>'));
    assert.ok(html.includes('<th style="text-align:right;">Status</th>'));
    assert.ok(html.includes('<td>Alice</td>'));
    assert.ok(html.includes('<td style="text-align:center;">Lead</td>'));
    assert.ok(html.includes('<td style="text-align:right;">Active</td>'));
  });

  await test('[T4.2] Table without leading and trailing outer pipes is supported', () => {
    const md = 'Col A | Col B\n---|---\nVal 1 | Val 2';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<table class="codelab-table">'));
    assert.ok(html.includes('<th>Col A</th>'));
    assert.ok(html.includes('<td>Val 1</td>'));
  });

  await test('[T4.3] Table delimiter row with single hyphens (:- and -:) is valid', () => {
    const md = '| Item | Price |\n| :- | -: |\n| Notebook | $3 |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<table class="codelab-table">'));
    assert.ok(html.includes('<th style="text-align:right;">Price</th>'));
    assert.ok(html.includes('<td style="text-align:right;">$3</td>'));
  });

  await test('[T4.4] Table data row underflow pads missing cells with empty <td></td>', () => {
    const md = '| H1 | H2 | H3 |\n| --- | --- | --- |\n| OnlyOne |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<tr><td>OnlyOne</td><td></td><td></td></tr>'));
  });

  await test('[T4.5] Table data row overflow truncates excess columns to match header count', () => {
    const md = '| H1 | H2 |\n| --- | --- |\n| D1 | D2 | D3 | D4 |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<tr><td>D1</td><td>D2</td></tr>'));
    assert.ok(!html.includes('<td>D3</td>'));
  });

  await test('[T4.6] Escaped pipe in cell (\\|) renders literal pipe without creating extra column', () => {
    const md = '| Syntax | Meaning |\n| --- | --- |\n| a \\| b | Logical OR |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<td>a | b</td>'));
    assert.ok(html.includes('<td>Logical OR</td>'));
  });

  await test('[T4.7] Pipe inside inline code span in table does not corrupt columns', () => {
    const md = '| Command | Description |\n| --- | --- |\n| `cat file | grep pattern` | Pipe output |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<code class="codelab-inline-code">cat file | grep pattern</code>'));
    assert.ok(html.includes('<td>Pipe output</td>'));
  });

  await test('[T4.8] Table with zero data rows renders valid <thead> and empty <tbody>', () => {
    const md = '| Header A | Header B |\n| --- | --- |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<thead><tr><th>Header A</th><th>Header B</th></tr></thead><tbody></tbody>'));
  });

  await test('[T4.9] Delimiter row cell count mismatch falls back to normal paragraph text', () => {
    const md = '| Col 1 | Col 2 |\n| --- |\n| Row 1 | Row 2 |';
    const html = renderSimpleMarkdown(md);
    assert.ok(!html.includes('<table class="codelab-table">'));
    assert.ok(html.includes('<p>'));
  });

  await test('[T4.10] Inline formatting (bold, italic, links, code) renders inside table cells', () => {
    const md = '| Feature | Spec |\n| --- | --- |\n| **Bold Key** | [Docs](https://example.com) with `token` |';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<td><strong>Bold Key</strong></td>'));
    assert.ok(html.includes('<a href="https://example.com" class="codelab-link" target="_blank" rel="noopener noreferrer">Docs</a>'));
    assert.ok(html.includes('<code class="codelab-inline-code">token</code>'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 5: Task Lists & Nested Lists (Phase 5)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 5: Task Lists, Nested Lists & Checkboxes (Phase 5) ===');

  await test('[T5.1] Unchecked and checked task items render checkbox with data-cl-task-idx', () => {
    const md = '- [ ] Task item 1\n- [x] Task item 2';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('class="codelab-task-list"'));
    assert.ok(html.includes('class="codelab-task-checkbox" data-cl-task-idx="0"'));
    assert.ok(html.includes('class="codelab-task-checkbox" data-cl-task-idx="1" checked'));
    assert.ok(html.includes('codelab-task-item--checked'));
  });

  await test('[T5.2] Uppercase [X] is recognized as checked task item', () => {
    const md = '* [X] Done with uppercase X';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('class="codelab-task-item codelab-task-item--checked"'));
    assert.ok(html.includes('checked'));
  });

  await test('[T5.3] Ordered list task markers (1. [ ]) parse correctly', () => {
    const md = '1. [ ] First numbered task\n2. [x] Second numbered task';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<ol class="codelab-task-list">'));
    assert.ok(html.includes('data-cl-task-idx="0"'));
    assert.ok(html.includes('data-cl-task-idx="1"'));
  });

  await test('[T5.4] Nested task lists create nested <ul> and maintain monotonic task index', () => {
    const md = '- [ ] Root 1\n  - [x] Child 1.1\n  - [ ] Child 1.2\n- [ ] Root 2';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('data-cl-task-idx="0"'));
    assert.ok(html.includes('data-cl-task-idx="1"'));
    assert.ok(html.includes('data-cl-task-idx="2"'));
    assert.ok(html.includes('data-cl-task-idx="3"'));
    assert.ok(html.includes('<ul class="codelab-task-list">'));
  });

  await test('[T5.5] Brackets without space like - [ ]NoSpace render as standard bullet item', () => {
    const md = '- [ ]NoSpace bullet item';
    const html = renderSimpleMarkdown(md);
    assert.ok(!html.includes('codelab-task-checkbox'));
    assert.ok(html.includes('<li>[ ]NoSpace bullet item</li>'));
  });

  await test('[T5.6] Standard lists without checkboxes render normal <ul> and <ol>', () => {
    const md = '- Bullet A\n- Bullet B\n\n1. Number 1\n2. Number 2';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<ul><li>Bullet A</li><li>Bullet B</li></ul>'));
    assert.ok(html.includes('<ol><li>Number 1</li><li>Number 2</li></ol>'));
    assert.ok(!html.includes('codelab-task-list'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 6: Inline Typography & Headings (Phases 2, 6, 7)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 6: Typography, Spans & Headings (Phases 2, 6, 7) ===');

  await test('[T6.1] Headings # and ## map to <h2> for sidebar layout balance, ### to <h3>, etc.', () => {
    const md = '# H1 Title\n## H2 Title\n### H3 Title\n#### H4 Title\n##### H5 Title\n###### H6 Title';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<h2>H1 Title</h2>'));
    assert.ok(html.includes('<h2>H2 Title</h2>'));
    assert.ok(html.includes('<h3>H3 Title</h3>'));
    assert.ok(html.includes('<h4>H4 Title</h4>'));
    assert.ok(html.includes('<h5>H5 Title</h5>'));
    assert.ok(html.includes('<h6>H6 Title</h6>'));
  });

  await test('[T6.2] Strikethrough (~~del~~) transforms to <del>', () => {
    const md = 'This feature is ~~deprecated~~ in v2.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<del>deprecated</del>'));
  });

  await test('[T6.3] Bold (**text**) and italic (*text*) render formatted spans', () => {
    const md = 'This is **bold** and *italic* and ***both***.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<strong>bold</strong>'));
    assert.ok(html.includes('<em>italic</em>'));
    assert.ok(html.includes('<strong><em>both</em></strong>'));
  });

  await test('[T6.4] Snake case identifiers with underscores are NOT converted to italics', () => {
    const md = 'Check the variable user_profile_id and account_balance_cents.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('user_profile_id'));
    assert.ok(html.includes('account_balance_cents'));
    assert.ok(!html.includes('user<em>profile</em>id'));
  });

  await test('[T6.5] Markdown links and autolinks render with target="_blank" and rel', () => {
    const md = 'Visit [Project Docs](https://github.com/innovatorved/code-lab "Doc Title") or <https://example.com>.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<a href="https://github.com/innovatorved/code-lab" class="codelab-link" target="_blank" rel="noopener noreferrer" title="Doc Title">Project Docs</a>'));
    assert.ok(html.includes('<a href="https://example.com" class="codelab-link" target="_blank" rel="noopener noreferrer">https://example.com</a>'));
  });

  await test('[T6.6] Horizontal rules (---, ***, ___) render <hr class="codelab-hr">', () => {
    const md = 'Section 1\n\n---\n\nSection 2';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<hr class="codelab-hr">'));
  });

  await test('[T6.7] Inline code span preserves exact text and wraps in codelab-inline-code', () => {
    const md = 'Use `const x: number = 10;` in your code.';
    const html = renderSimpleMarkdown(md);
    assert.ok(html.includes('<code class="codelab-inline-code">const x: number = 10;</code>'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 7: Interactive Event Handlers & State Synchronization
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 7: Interactive Event Handlers & Mutation ===');

  await test('[T7.1] _toggleMarkdownTask toggles target task item from [ ] to [x] in workbench state', () => {
    const container = document.createElement('div');
    const initialMd = '# Todos\n- [ ] Task A\n- [ ] Task B\n  - [ ] Task C';
    const bench = new CodeLabWorkbench(container, {
      files: {
        'TODO.md': initialMd
      },
      activeFile: 'TODO.md'
    });

    let codeChangedFile = null;
    let codeChangedContent = null;
    bench.onCodeChange = (file, code) => {
      codeChangedFile = file;
      codeChangedContent = code;
    };

    // Toggle Task B (index 1) to checked (true)
    bench._toggleMarkdownTask('TODO.md', 1, true);
    assert.equal(bench.files['TODO.md'], '# Todos\n- [ ] Task A\n- [x] Task B\n  - [ ] Task C');
    assert.equal(codeChangedFile, 'TODO.md');
    assert.equal(codeChangedContent, bench.files['TODO.md']);

    // Toggle Task B back to unchecked (false)
    bench._toggleMarkdownTask('TODO.md', 1, false);
    assert.equal(bench.files['TODO.md'], initialMd);
  });

  await test('[T7.2] _toggleMarkdownTask does not falsely increment index for task markers inside fenced code', () => {
    const container = document.createElement('div');
    const initialMd = '```markdown\n- [ ] Code sample task\n```\n- [ ] Real Task 0\n- [ ] Real Task 1';
    const bench = new CodeLabWorkbench(container, {
      files: { 'notes.md': initialMd },
      activeFile: 'notes.md'
    });

    // Toggle Real Task 0 (index 0)
    bench._toggleMarkdownTask('notes.md', 0, true);
    assert.ok(bench.files['notes.md'].includes('```markdown\n- [ ] Code sample task\n```\n- [x] Real Task 0\n- [ ] Real Task 1'));
  });

  await test('[T7.3] Clicking copy code button extracts raw decoded code and gives feedback', async () => {
    const container = document.createElement('div');
    const bench = new CodeLabWorkbench(container, {
      files: {
        'README.md': '```js\nconsole.log("copy test");\n```'
      },
      activeFile: 'README.md'
    });

    // Render markdown preview in container
    const preview = container.querySelector('#cl-md-preview');
    assert.ok(preview, 'Markdown preview container must exist');
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['README.md']);

    const copyBtn = preview.querySelector('[data-cl-action="copy-code"]');
    assert.ok(copyBtn, 'Copy code button must exist in rendered code block');

    let clipboardWrittenText = null;
    setNavigator({
      clipboard: {
        writeText: async (text) => {
          clipboardWrittenText = text;
        }
      }
    });

    copyBtn.click();
    // Allow microtask to resolve
    await new Promise(r => setTimeout(r, 10));

    assert.equal(clipboardWrittenText, 'console.log("copy test");');
    assert.ok(copyBtn.classList.contains('copied'));
    const textSpan = copyBtn.querySelector('.codelab-copy-code-btn__text');
    assert.equal(textSpan.textContent, 'Copied!');
  });

  await test('[T7.4] Delegated checkbox change inside active .md preview mutates file content', () => {
    const container = document.createElement('div');
    const initialMd = '- [ ] First Task\n- [ ] Second Task';
    const bench = new CodeLabWorkbench(container, {
      files: {
        'tasks.md': initialMd
      },
      activeFile: 'tasks.md'
    });

    const preview = container.querySelector('#cl-md-preview');
    assert.ok(preview);
    preview.style.display = 'block';
    preview.innerHTML = renderSimpleMarkdown(bench.files['tasks.md']);

    const checkboxes = preview.querySelectorAll('.codelab-task-checkbox');
    assert.equal(checkboxes.length, 2);

    // Simulate user clicking second checkbox
    checkboxes[1].checked = true;
    checkboxes[1].dispatchEvent(new Event('change', { bubbles: true }));

    assert.ok(bench.files['tasks.md'].includes('- [x] Second Task'));
    const taskItem = checkboxes[1].closest('.codelab-task-item');
    assert.ok(taskItem.classList.contains('codelab-task-item--checked'));
  });

  await test('[T7.5] Clicking checkbox in Guide sidebar updates visually without mutating active file', () => {
    const container = document.createElement('div');
    const bench = new CodeLabWorkbench(container, {
      hasGuidedLab: true,
      files: { 'main.js': 'console.log(1);' },
      activeFile: 'main.js'
    });

    const guide = container.querySelector('#cl-guide-content, .codelab-guide__content');
    assert.ok(guide);
    guide.innerHTML = `<div class="codelab-guide-prose">${renderSimpleMarkdown('- [ ] Guide step checklist item')}</div>`;

    const checkbox = guide.querySelector('.codelab-task-checkbox');
    assert.ok(checkbox);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    const taskItem = checkbox.closest('.codelab-task-item');
    assert.ok(taskItem.classList.contains('codelab-task-item--checked'));
    assert.equal(bench.files['main.js'], 'console.log(1);', 'Active file must remain unchanged');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Tier 8: SDK Exposure & Parity
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n=== Tier 8: SDK Exposure & Parity ===');

  await test('[T8.1] renderMarkdown and renderSimpleMarkdown are exposed on CodeLabSDK', () => {
    assert.equal(typeof CodeLabSDK.renderMarkdown, 'function');
    assert.equal(typeof CodeLabSDK.renderSimpleMarkdown, 'function');
    assert.equal(CodeLabSDK.renderMarkdown, CodeLabSDK.renderSimpleMarkdown);
  });

  await test('[T8.2] renderMarkdown and renderSimpleMarkdown are exposed on CodeLabWorkbench.prototype', () => {
    assert.equal(typeof CodeLabWorkbench.prototype.renderMarkdown, 'function');
    assert.equal(typeof CodeLabWorkbench.prototype.renderSimpleMarkdown, 'function');
    assert.equal(CodeLabWorkbench.prototype.renderMarkdown, renderSimpleMarkdown);
  });

  await test('[T8.3] Workbench instance inherits renderMarkdown and renderSimpleMarkdown', () => {
    const container = document.createElement('div');
    const bench = new CodeLabWorkbench(container, {});
    assert.equal(typeof bench.renderMarkdown, 'function');
    assert.equal(typeof bench.renderSimpleMarkdown, 'function');
    assert.ok(bench.renderMarkdown('**bold**').includes('<strong>bold</strong>'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════════');
  console.log(`Test Execution Complete: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
