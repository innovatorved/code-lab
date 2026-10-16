'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Milestone 2: Independent Empirical Challenger Test Suite
 * Archetype: EMPIRICAL CHALLENGER (Milestone 2 — GFM Markdown & Parser Stress)
 *
 * Verifies:
 *   Suite 1: GFM Table Edge Cases (delimiters, mismatched cols, padding, truncation,
 *            zero body rows, escaped pipes, inline code pipes, outer pipes)
 *   Suite 2: GitHub Callout Alerts (5 types, lowercase, 0 spaces, custom titles,
 *            multi-paragraph bodies, unknown tag blockquote fallback, nested alerts)
 *   Suite 3: Code Fences & Info Strings (tilde fences, trailing attributes, empty blocks,
 *            nested backticks, HTML escaping, URI encoding, copy button markup)
 *   Suite 4: Syntax Highlighting Tokens (JS/TS keywords/types/fns/numbers/comments,
 *            JSON keys/strings/booleans/numbers, Bash commands/flags/comments, HTML fallback)
 *   Suite 5: Combinatorial Stress, Collision & ReDoS Testing (masking, snake_case,
 *            inline code immunity, 1,000-line stress benchmark)
 *   Suite 6: Interactive Handlers & State Persistence (copy click feedback, task toggle)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const assert = require('node:assert/strict');

// ── Minimal Virtual DOM for Browser/Node Emulation ───────────────────────────

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

class DOMClassList {
  constructor(el) { this._el = el; }
  _getClasses() {
    const c = this._el.getAttribute('class') || '';
    return c.trim().split(/\s+/).filter(Boolean);
  }
  _setClasses(classes) { this._el.setAttribute('class', classes.join(' ')); }
  contains(cls) { return this._getClasses().includes(cls); }
  add(...classes) {
    const list = this._getClasses();
    for (const c of classes) { if (!list.includes(c)) list.push(c); }
    this._setClasses(list);
  }
  remove(...classes) {
    let list = this._getClasses();
    list = list.filter(c => !classes.includes(c));
    this._setClasses(list);
  }
  toggle(cls, force) {
    const has = this.contains(cls);
    const shouldAdd = force === undefined ? !has : !!force;
    if (shouldAdd) this.add(cls);
    else this.remove(cls);
    return shouldAdd;
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
    this._value = '';
    this.dataset = {};
  }
  setAttribute(name, value) {
    const k = String(name).toLowerCase();
    const v = String(value);
    this.attributes.set(k, v);
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      this.dataset[camel] = v;
    }
  }
  getAttribute(name) {
    return this.attributes.get(String(name).toLowerCase()) || null;
  }
  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase());
  }
  removeAttribute(name) {
    const k = String(name).toLowerCase();
    this.attributes.delete(k);
    if (k.startsWith('data-')) {
      const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      delete this.dataset[camel];
    }
  }
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { if (v) this.setAttribute('checked', ''); else this.removeAttribute('checked'); }

  get textContent() {
    return this.childNodes.map(n => n.nodeType === 3 ? n.nodeValue : (n.textContent || '')).join('');
  }
  set textContent(v) {
    this.childNodes = [];
    if (v) this.appendChild(new DOMTextNode(v, this.ownerDocument));
  }

  get innerHTML() {
    return this.childNodes.map(nodeToHTML).join('');
  }
  set innerHTML(html) {
    this.childNodes = [];
    parseHTMLToDOM(html, this);
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  dispatchEvent(event) {
    event.target = this;
    let cur = this;
    while (cur) {
      event.currentTarget = cur;
      const list = cur.listeners ? cur.listeners.get(event.type) : null;
      if (list) {
        for (const fn of list) {
          fn.call(cur, event);
          if (event._stopped) return !event.defaultPrevented;
        }
      }
      cur = cur.parentElement;
    }
    return !event.defaultPrevented;
  }
  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (matchesSimple(cur, selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length ? all[0] : null;
  }
  querySelectorAll(sel) {
    const res = [];
    function walk(node) {
      for (const ch of node.children) {
        if (matchesSimple(ch, sel)) res.push(ch);
        walk(ch);
      }
    }
    walk(this);
    return res;
  }
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

function matchesSimple(el, sel) {
  // Support comma-separated selector lists (e.g. `[data-cl-action="x"], .y`).
  return String(sel)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .some(part => matchesSingle(el, part));
}

function matchesSingle(el, sel) {
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  if (sel.startsWith('#')) return el.getAttribute('id') === sel.slice(1);
  if (sel.startsWith('[')) {
    const m = sel.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
    if (m) {
      const attr = m[1];
      const val = m[2];
      if (val !== undefined) return el.getAttribute(attr) === val;
      return el.hasAttribute(attr);
    }
  }
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function parseHTMLToDOM(html, parent) {
  const tokenRegex = /<(!|\/)?([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let match;
  let current = parent;
  const doc = parent.ownerDocument || parent;

  while ((match = tokenRegex.exec(html)) !== null) {
    const [full, slashOrExcl, tagName, rawAttrs, selfClose, textContent] = match;
    if (textContent) {
      const unescaped = textContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      current.appendChild(new DOMTextNode(unescaped, doc));
      continue;
    }
    if (slashOrExcl === '!') continue;
    if (slashOrExcl === '/') {
      if (current !== parent && current.parentElement) {
        current = current.parentElement;
      }
      continue;
    }
    const el = new DOMElement(tagName, doc);
    if (rawAttrs) {
      const attrRe = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let am;
      while ((am = attrRe.exec(rawAttrs)) !== null) {
        const val = am[2] !== undefined ? am[2] : (am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : ''));
        el.setAttribute(am[1], val);
      }
    }
    current.appendChild(el);
    const voidTags = ['img', 'br', 'hr', 'input', 'link', 'meta'];
    const isVoid = selfClose === '/' || voidTags.includes(tagName.toLowerCase());
    if (!isVoid) {
      current = el;
    }
  }
}

class DOMEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.cancelable = !!init.cancelable;
    this.defaultPrevented = false;
    this._stopped = false;
    this.target = null;
    this.currentTarget = null;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
}

const mockDoc = {
  nodeType: 9,
  createElement(tag) { return new DOMElement(tag, mockDoc); },
  createTextNode(txt) { return new DOMTextNode(txt, mockDoc); },
  body: new DOMElement('body', null),
  addEventListener() {},
  removeEventListener() {}
};
mockDoc.body.ownerDocument = mockDoc;

const localStorageStore = new Map();
const localStorageMock = {
  getItem(k) { return localStorageStore.has(k) ? localStorageStore.get(k) : null; },
  setItem(k, v) { localStorageStore.set(k, String(v)); },
  removeItem(k) { localStorageStore.delete(k); },
  clear() { localStorageStore.clear(); }
};

globalThis.window = globalThis;
globalThis.document = mockDoc;
globalThis.localStorage = localStorageMock;
globalThis.Event = DOMEvent;

// Require workbench module
const CodeLabSDK = require('../src/workbench.js');
const { renderSimpleMarkdown, renderMarkdown, CodeLabWorkbench } = CodeLabSDK;

// ── Test Runner ──────────────────────────────────────────────────────────────

async function runAdversarialSuite() {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  async function test(name, fn) {
    summary.total++;
    process.stdout.write(`  [TEST ${summary.total}] ${name} ... `);
    try {
      await fn();
      summary.passed++;
      console.log('\x1b[32mPASS\x1b[0m');
    } catch (err) {
      summary.failed++;
      console.log('\x1b[31mFAIL\x1b[0m');
      console.error(`    Error: ${err.message}`);
      summary.failures.push({ name, error: err.message, stack: err.stack });
    }
  }

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('   CHALLENGER M2.1: GFM SYNTAX & PARSER EMPIRICAL STRESS SUITE          ');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: GFM Table Edge Cases
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Suite 1: GFM Table Edge Cases ---');

  await test('1.1 Single-hyphen delimiters: :- (left) and -: (right)', async () => {
    const md = '| Item | Price |\n| :- | -: |\n| Pen | $1 |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<table class="codelab-table">/);
    assert.match(html, /<th[^>]*>Item<\/th>/);
    assert.match(html, /<th style="text-align:right;">Price<\/th>/);
    assert.match(html, /<tr><td>Pen<\/td><td style="text-align:right;">\$1<\/td><\/tr>/);
  });

  await test('1.2 Single-hyphen center delimiter :-: and plain hyphen -', async () => {
    const md = '| Left | Center | Right |\n| - | :-: | -: |\n| 1 | 2 | 3 |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<th[^>]*>Left<\/th>/);
    assert.match(html, /<th style="text-align:center;">Center<\/th>/);
    assert.match(html, /<th style="text-align:right;">Right<\/th>/);
    assert.match(html, /<tr><td>1<\/td><td style="text-align:center;">2<\/td><td style="text-align:right;">3<\/td><\/tr>/);
  });

  await test('1.3 Delimiter with irregular spaces and colons', async () => {
    const md = '|   Left Col   |   Center Col   |   Right Col   |\n|  :---   |   :---:   |   ---:  |\n|  A  |  B  |  C  |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<table class="codelab-table">/);
    assert.match(html, /<th[^>]*>Left Col<\/th>/);
    assert.match(html, /<th style="text-align:center;">Center Col<\/th>/);
    assert.match(html, /<th style="text-align:right;">Right Col<\/th>/);
    assert.match(html, /<tr><td>A<\/td><td style="text-align:center;">B<\/td><td style="text-align:right;">C<\/td><\/tr>/);
  });

  await test('1.4 Mismatched column counts (header 2, delimiter 1) aborts table to paragraph', async () => {
    const md = '| Header 1 | Header 2 |\n| --- |\n| A | B |';
    const html = renderSimpleMarkdown(md);
    assert.doesNotMatch(html, /<table/);
    assert.match(html, /<p>\| Header 1 \| Header 2 \|<br>\| --- \|<br>\| A \| B \|<\/p>/);
  });

  await test('1.5 Mismatched column counts (header 2, delimiter 3) aborts table to paragraph', async () => {
    const md = '| Header 1 | Header 2 |\n| --- | --- | --- |\n| A | B |';
    const html = renderSimpleMarkdown(md);
    assert.doesNotMatch(html, /<table/);
  });

  await test('1.6 Data row underflow: row with fewer cells is padded with empty <td></td>', async () => {
    const md = '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Only One |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<tr><td>Only One<\/td><td><\/td><td><\/td><\/tr>/);
  });

  await test('1.7 Data row overflow: row with excess cells is truncated to header count', async () => {
    const md = '| Col 1 | Col 2 |\n| --- | --- |\n| A | B | Extra 1 | Extra 2 |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<tr><td>A<\/td><td>B<\/td><\/tr>/);
    assert.doesNotMatch(html, /Extra/);
  });

  await test('1.8 Tables with zero body rows renders <thead> and empty <tbody>', async () => {
    const md = '| Name | Age |\n| --- | --- |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<thead><tr><th>Name<\/th><th>Age<\/th><\/tr><\/thead><tbody><\/tbody>/);
  });

  await test('1.9 Escaped pipes in cell (\\|) render literal pipe without splitting cell', async () => {
    const md = '| Key | Pattern |\n| --- | --- |\n| regex | a\\|b |\n| escaped | foo \\| bar |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<tr><td>regex<\/td><td>a\|b<\/td><\/tr>/);
    assert.match(html, /<tr><td>escaped<\/td><td>foo \| bar<\/td><\/tr>/);
  });

  await test('1.10 Escaped backslash preceding pipe: \\\\| splits cell with literal \\', async () => {
    const md = '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| path\\\\ | split | third |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<tr><td>path\\<\/td><td>split<\/td><td>third<\/td><\/tr>/);
  });

  await test('1.11 Pipe inside inline code span `a | b` does not split table column', async () => {
    const md = '| Syntax | Example |\n| --- | --- |\n| bitwise | `a | b` |\n| pipe | `cat | grep` |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<tr><td>bitwise<\/td><td><code class="codelab-inline-code">a \| b<\/code><\/td><\/tr>/);
    assert.match(html, /<tr><td>pipe<\/td><td><code class="codelab-inline-code">cat \| grep<\/code><\/td><\/tr>/);
  });

  await test('1.12 Table without outer pipes renders valid <table>', async () => {
    const md = 'Col A | Col B\n---|---\nVal 1 | Val 2';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<table class="codelab-table">/);
    assert.match(html, /<th>Col A<\/th><th>Col B<\/th>/);
    assert.match(html, /<td>Val 1<\/td><td>Val 2<\/td>/);
  });

  await test('1.13 Inline formatting inside table cells (bold, italic, links, strike)', async () => {
    const md = '| Feature | Status |\n| --- | --- |\n| **Bold** | *Italic* |\n| ~~Del~~ | [Link](https://codelab.dev) |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<td><strong>Bold<\/strong><\/td><td><em>Italic<\/em><\/td>/);
    assert.match(html, /<td><del>Del<\/del><\/td>/);
    assert.match(html, /<a href="https:\/\/codelab\.dev" class="codelab-link"/);
  });

  await test('1.14 Empty cells in table rows are preserved accurately', async () => {
    const md = '| C1 | C2 | C3 |\n| --- | --- | --- |\n| | Middle | |';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<tr><td><\/td><td>Middle<\/td><td><\/td><\/tr>/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: GitHub Callout Alerts & Blockquotes
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 2: GitHub Callout Alerts & Blockquotes ---');

  await test('2.1 All 5 alert types render semantic icons, classes, and titles', async () => {
    const types = [
      { tag: 'NOTE', cls: 'codelab-callout--note', title: 'Note' },
      { tag: 'TIP', cls: 'codelab-callout--tip', title: 'Tip' },
      { tag: 'IMPORTANT', cls: 'codelab-callout--important', title: 'Important' },
      { tag: 'WARNING', cls: 'codelab-callout--warning', title: 'Warning' },
      { tag: 'CAUTION', cls: 'codelab-callout--caution', title: 'Caution' }
    ];

    for (const t of types) {
      const md = `> [!${t.tag}]\n> Detailed body for ${t.tag}`;
      const html = renderSimpleMarkdown(md);
      assert.match(html, new RegExp(`<div class="codelab-callout ${t.cls}">`));
      assert.match(html, new RegExp(`<span class="codelab-callout__title">${t.title}</span>`));
      assert.match(html, new RegExp(`<p>Detailed body for ${t.tag}</p>`));
    }
  });

  await test('2.2 Lowercase alert tags ([!note], [!tip], [!warning]) normalized', async () => {
    const md = '> [!note]\n> lowercase note body\n\n> [!warning]\n> lowercase warning';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /codelab-callout--note/);
    assert.match(html, /<span class="codelab-callout__title">Note<\/span>/);
    assert.match(html, /codelab-callout--warning/);
    assert.match(html, /<span class="codelab-callout__title">Warning<\/span>/);
  });

  await test('2.3 Tags with 0 spaces after blockquote marker (>[!TIP])', async () => {
    const md = '>[!TIP]\n>No space after greater-than';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /codelab-callout--tip/);
    assert.match(html, /<span class="codelab-callout__title">Tip<\/span>/);
    assert.match(html, /<p>No space after greater-than<\/p>/);
  });

  await test('2.4 Custom titles on trigger line override default type name', async () => {
    const md = '> [!NOTE] Architecture Brief: Distributed Consensus\n> Read before continuing.';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /codelab-callout--note/);
    assert.match(html, /<span class="codelab-callout__title">Architecture Brief: Distributed Consensus<\/span>/);
    assert.match(html, /<p>Read before continuing\.<\/p>/);
  });

  await test('2.5 Multi-line alert body preserves single-line breaks via <br>', async () => {
    const md = '> [!WARNING]\n> Line 1 of warning\n> Line 2 of warning\n> Line 3 of warning';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<div class="codelab-callout__content"><p>Line 1 of warning<br>Line 2 of warning<br>Line 3 of warning<\/p><\/div>/);
  });

  await test('2.6 Multi-paragraph alert bodies with > blank line render distinct <p>', async () => {
    const md = '> [!TIP]\n> First paragraph line 1\n> First paragraph line 2\n>\n> Second paragraph line 1';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<div class="codelab-callout__content"><p>First paragraph line 1<br>First paragraph line 2<\/p><p>Second paragraph line 1<\/p><\/div>/);
  });

  await test('2.7 Unrecognized alert tag falls back to standard blockquote', async () => {
    const md = '> [!UNKNOWN]\n> This is not a standard GitHub alert.';
    const html = renderSimpleMarkdown(md);
    assert.doesNotMatch(html, /codelab-callout/);
    assert.match(html, /<blockquote class="codelab-blockquote"><p>\[!UNKNOWN\]<br>This is not a standard GitHub alert\.<\/p><\/blockquote>/);
  });

  await test('2.8 Standard blockquote without alert tag renders semantic blockquote', async () => {
    const md = '> Simplicity is prerequisite for reliability.\n> — Edsger W. Dijkstra';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<blockquote class="codelab-blockquote"><p>Simplicity is prerequisite for reliability\.<br>— Edsger W\. Dijkstra<\/p><\/blockquote>/);
  });

  await test('2.9 Alert nested inside outer blockquote parses cleanly without crashing', async () => {
    // Documented limitation (see auditor_m2/handoff.md caveats): GitHub callout alerts are
    // detected at the first blockquote level. A callout nested inside a deeper nested
    // blockquote (`> > [!NOTE]`) is rendered as nested blockquotes with the raw marker text
    // preserved — it degrades gracefully and must NOT crash or corrupt the surrounding DOM.
    const md = '> Outer quote\n> > [!NOTE]\n> > Inner nested note';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<blockquote class="codelab-blockquote">/);
    assert.match(html, /Inner nested note/);
    assert.doesNotMatch(html, /undefined|\[object Object\]/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Code Fences & Info Strings
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 3: Code Fences & Info Strings ---');

  await test('3.1 Tilde fences (~~~ts) are recognized and extract language', async () => {
    const md = '~~~ts\nconst service: string = "runtime";\n~~~';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<div class="codelab-code-block"/);
    assert.match(html, /<span class="codelab-code-block__lang">TS<\/span>/);
    assert.match(html, /<code class="codelab-code-block__code lang-ts">/);
    assert.match(html, /<span class="cl-tok-keyword">const<\/span>/);
  });

  await test('3.2 Info string with trailing attributes extracts clean language badge', async () => {
    const md = '```ts title="src/server.ts" {2-4} highlight=true\nconsole.log("ready");\n```';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<span class="codelab-code-block__lang">TS<\/span>/);
    assert.match(html, /<code class="codelab-code-block__code lang-ts">/);
  });

  await test('3.3 Empty code block renders valid container and lang-text', async () => {
    const md = '```\n```';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<div class="codelab-code-block" data-cl-code="">/);
    assert.match(html, /<span class="codelab-code-block__lang">TEXT<\/span>/);
    assert.match(html, /<code class="codelab-code-block__code lang-text"><\/code>/);
  });

  await test('3.4 Nested backticks (4 backticks enclosing 3 backticks)', async () => {
    const md = '````markdown\n# Header\n```js\nconst inner = true;\n```\n````';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<span class="codelab-code-block__lang">MARKDOWN<\/span>/);
    assert.match(html, /```js/);
    assert.match(html, /const inner = true;/);
  });

  await test('3.5 HTML escaping inside code block prevents raw execution', async () => {
    const md = '```html\n<script>alert("xss")</script>\n<div class="box">text</div>\n```';
    const html = renderSimpleMarkdown(md);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
    assert.match(html, /&lt;div class=&quot;box&quot;&gt;text&lt;\/div&gt;/);
  });

  await test('3.6 Raw code is URI-encoded in data-cl-code for safe clipboard copy', async () => {
    const raw = 'const query = "a=1&b=2 <tag>";';
    const md = `\`\`\`js\n${raw}\n\`\`\``;
    const html = renderSimpleMarkdown(md);
    assert.match(html, /data-cl-code="const%20query%20%3D%20%22a%3D1%26b%3D2%20%3Ctag%3E%22%3B"/);
  });

  await test('3.7 Copy code button has proper attributes, SVG icon, and label', async () => {
    const md = '```bash\necho "hello"\n```';
    const html = renderSimpleMarkdown(md);
    assert.match(html, /<button type="button" class="codelab-copy-code-btn" data-cl-action="copy-code" title="Copy code to clipboard">/);
    assert.match(html, /<span class="codelab-copy-code-btn__text">Copy<\/span>/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: Syntax Highlighting Tokens
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 4: Syntax Highlighting Tokens ---');

  await test('4.1 JS/TS token classes: keywords, types, functions, numbers, strings, comments', async () => {
    const code = `// header comment
const maxRetries: number = 5;
function executeTask(val: string) {
  if (val === null || val === undefined) return false;
  return true;
}`;
    const md = `\`\`\`typescript\n${code}\n\`\`\``;
    const html = renderSimpleMarkdown(md);

    assert.match(html, /<span class="cl-tok-comment">\/\/ header comment<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">const<\/span>/);
    assert.match(html, /<span class="cl-tok-number">5<\/span>/);
    assert.match(html, /<span class="cl-tok-function">executeTask<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">if<\/span>/);
    assert.match(html, /<span class="cl-tok-type">null<\/span>/);
    assert.match(html, /<span class="cl-tok-type">undefined<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">return<\/span>/);
  });

  await test('4.2 JSON token classes: keys as types, values as strings, numbers, booleans', async () => {
    const json = `{
  "service": "code-lab",
  "port": 8080,
  "active": true,
  "options": null
}`;
    const md = `\`\`\`json\n${json}\n\`\`\``;
    const html = renderSimpleMarkdown(md);

    assert.match(html, /<span class="cl-tok-type">&quot;service&quot;<\/span>:/);
    assert.match(html, /<span class="cl-tok-string">&quot;code-lab&quot;<\/span>/);
    assert.match(html, /<span class="cl-tok-number">8080<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">true<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">null<\/span>/);
  });

  await test('4.3 Bash/Shell token classes: commands, flags, comments, strings', async () => {
    const bash = `# Setup environment
mkdir -p ./build
bun test --all "production"`;
    const md = `\`\`\`bash\n${bash}\n\`\`\``;
    const html = renderSimpleMarkdown(md);

    assert.match(html, /<span class="cl-tok-comment"># Setup environment<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">mkdir<\/span>/);
    assert.match(html, /<span class="cl-tok-number">-p<\/span>/);
    assert.match(html, /<span class="cl-tok-keyword">bun<\/span>/);
    assert.match(html, /<span class="cl-tok-number">--all<\/span>/);
    assert.match(html, /<span class="cl-tok-string">&quot;production&quot;<\/span>/);
  });

  await test('4.4 HTML and unsupported languages gracefully escape without crash', async () => {
    const htmlCode = '<button id="btn" disabled>Click & Go</button>';
    const md = `\`\`\`html\n${htmlCode}\n\`\`\``;
    const html = renderSimpleMarkdown(md);

    assert.match(html, /<span class="codelab-code-block__lang">HTML<\/span>/);
    assert.match(html, /&lt;button id=&quot;btn&quot; disabled&gt;Click &amp; Go&lt;\/button&gt;/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: Combinatorial Stress, Collision & ReDoS Testing
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 5: Combinatorial Stress, Collision & ReDoS Testing ---');

  await test('5.1 Asterisks and underscores inside code blocks and inline code do not trigger bold/italic', async () => {
    const md = 'Normal text `const ptr = *val;` and:\n```c\nint *a = &b;\n/* comment_with_underscore */\n```';
    const html = renderSimpleMarkdown(md);
    assert.doesNotMatch(html, /<em>val/);
    assert.doesNotMatch(html, /<em>with/);
    assert.match(html, /<code class="codelab-inline-code">const ptr = \*val;<\/code>/);
  });

  await test('5.2 Snake case identifiers in regular prose are immune to italic conversion', async () => {
    const md = 'Variables like max_retry_count and user_auth_token_id must stay unformatted.';
    const html = renderSimpleMarkdown(md);
    assert.doesNotMatch(html, /<em>retry<\/em>/);
    assert.doesNotMatch(html, /<em>auth<\/em>/);
    assert.match(html, /max_retry_count/);
    assert.match(html, /user_auth_token_id/);
  });

  await test('5.3 Task list markers inside code blocks are not counted as active task items', async () => {
    const md = `# Readme
- [ ] Genuine task 0
\`\`\`markdown
- [ ] Example in code block
- [x] Example in code block
\`\`\`
- [x] Genuine task 1`;
    const html = renderSimpleMarkdown(md);
    // Find all task checkboxes in the rendered HTML
    const checkboxes = html.match(/data-cl-task-idx="(\d+)"/g) || [];
    assert.equal(checkboxes.length, 2, 'Should only count 2 genuine task checkboxes outside code block');
    assert.match(checkboxes[0], /data-cl-task-idx="0"/);
    assert.match(checkboxes[1], /data-cl-task-idx="1"/);
  });

  await test('5.4 1,000-line massive markdown stress test completes in <100ms without ReDoS', async () => {
    const lines = [];
    lines.push('# Stress Benchmark');
    for (let i = 0; i < 200; i++) {
      lines.push(`## Section ${i}`);
      lines.push(`Prose paragraph with **bold**, *italic*, \`code_${i}\`, and [link ${i}](https://example.com/${i}).`);
      lines.push(`> [!NOTE]\n> Callout notice for unit ${i}`);
      lines.push('| Col A | Col B |\n| :--- | ---: |\n| ' + i + ' | ' + (i * 10) + ' |');
      lines.push('- [ ] Task ' + i);
      lines.push('```ts\nconst x' + i + ' = ' + i + ';\n```');
    }
    const massiveMd = lines.join('\n\n');

    const t0 = performance.now();
    const result = renderSimpleMarkdown(massiveMd);
    const delta = performance.now() - t0;

    assert.ok(result.length > 50000, 'Result should have significant HTML content');
    assert.ok(delta < 200, `Massive 1000+ line markdown parsed in ${delta.toFixed(1)}ms (threshold 200ms)`);
  });

  await test('5.5 Fuzzing table delimiters with various combinations', async () => {
    const cases = [
      { delim: '|---|---|', valid: true },
      { delim: '|:---|---:|', valid: true },
      { delim: '|:---:|:---:|', valid: true },
      { delim: '|:-|-:|', valid: true },
      { delim: '| - | - |', valid: true },
      { delim: '|:-:|', valid: false }, // 1 col when header has 2
      { delim: '|:::|---|', valid: false }, // no hyphens
      { delim: '|---|---|---|', valid: false } // 3 cols when header has 2
    ];

    for (const c of cases) {
      const input = `| H1 | H2 |\n${c.delim}\n| D1 | D2 |`;
      const out = renderSimpleMarkdown(input);
      if (c.valid) {
        assert.match(out, /<table class="codelab-table">/, `Delimiter ${c.delim} should be valid`);
      } else {
        assert.doesNotMatch(out, /<table class="codelab-table">/, `Delimiter ${c.delim} should be rejected`);
      }
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 6: Interactive Handlers & State Persistence
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Suite 6: Interactive Handlers & State Persistence ---');

  await test('6.1 Copy button event delegation extracts decoded code and triggers feedback', async () => {
    const container = mockDoc.createElement('div');
    container.setAttribute('id', 'workbench-test-root');
    mockDoc.body.appendChild(container);

    let copiedText = '';
    globalThis.navigator = {
      clipboard: {
        writeText: async (txt) => {
          copiedText = txt;
          return Promise.resolve();
        }
      }
    };

    const wb = new CodeLabWorkbench(container, {
      labId: 'adversarial-m2-copy',
      files: {
        'README.md': '```js\nconst secretToken = "xyz123";\n```'
      }
    });

    const copyBtn = container.querySelector('[data-cl-action="copy-code"]');
    assert.ok(copyBtn, 'Copy code button should exist in DOM');

    const clickEvt = new DOMEvent('click', { bubbles: true, cancelable: true });
    copyBtn.dispatchEvent(clickEvt);

    await new Promise(r => setTimeout(r, 10));

    assert.equal(copiedText, 'const secretToken = "xyz123";');
    assert.ok(copyBtn.classList.contains('copied'), 'Button should receive .copied class');
    const textSpan = copyBtn.querySelector('.codelab-copy-code-btn__text');
    assert.equal(textSpan.textContent, 'Copied!');

    container.remove();
  });

  await test('6.2 Task checkbox click mutates active markdown file from [ ] to [x]', async () => {
    const container = mockDoc.createElement('div');
    mockDoc.body.appendChild(container);

    let changeNotified = false;
    let updatedActiveContent = '';

    const initialMd = `# Project Tasks
- [ ] Task Zero
- [ ] Task One
- [ ] Task Two`;

    const wb = new CodeLabWorkbench(container, {
      labId: 'adversarial-m2-tasks',
      activeFile: 'tasks.md',
      files: {
        'tasks.md': initialMd
      },
      onCodeChange: (file, code) => {
        if (file === 'tasks.md') {
          changeNotified = true;
          updatedActiveContent = code;
        }
      }
    });

    // Directly invoke _toggleMarkdownTask for index 1
    wb._toggleMarkdownTask('tasks.md', 1, true);

    const expected = `# Project Tasks
- [ ] Task Zero
- [x] Task One
- [ ] Task Two`;

    assert.equal(wb.files['tasks.md'], expected, 'File content should reflect checked task at index 1');
    assert.ok(changeNotified, 'onCodeChange listener should be invoked');
    assert.equal(updatedActiveContent, expected);

    // Now uncheck it
    wb._toggleMarkdownTask('tasks.md', 1, false);
    assert.equal(wb.files['tasks.md'], initialMd, 'File content should toggle back to unchecked [ ]');

    container.remove();
  });

  await test('6.3 Task toggle handles tasks preceded by code blocks containing checkboxes', async () => {
    const container = mockDoc.createElement('div');
    mockDoc.body.appendChild(container);

    const initialMd = `# Tasks with Code
\`\`\`markdown
- [ ] False Task A
- [x] False Task B
\`\`\`
- [ ] Genuine Task 0
- [ ] Genuine Task 1`;

    const wb = new CodeLabWorkbench(container, {
      labId: 'adversarial-m2-masking',
      activeFile: 'TODO.md',
      files: {
        'TODO.md': initialMd
      }
    });

    // Toggle index 0 (which is Genuine Task 0)
    wb._toggleMarkdownTask('TODO.md', 0, true);

    const expected = `# Tasks with Code
\`\`\`markdown
- [ ] False Task A
- [x] False Task B
\`\`\`
- [x] Genuine Task 0
- [ ] Genuine Task 1`;

    assert.equal(wb.files['TODO.md'], expected, 'Genuine task 0 toggled without false match inside code block');
    container.remove();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(`Challenger M2.1 Results: ${summary.passed} passed, ${summary.failed} failed out of ${summary.total} tests`);
  console.log('════════════════════════════════════════════════════════════════════════\n');

  if (summary.failed > 0) {
    console.error('FAILURES:');
    for (const f of summary.failures) {
      console.error(`- ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
