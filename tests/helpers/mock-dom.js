// Shared lightweight zero-dependency DOM/browser mock.
// Extracted from the M2 interactive challenger suite and reused by M3 tests.
'use strict';

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

module.exports = { DOMNode, DOMTextNode, DOMCommentNode, DOMClassList, DOMElement, DOMDocument, DOMEvent, doc, localStorageMock, localStorageStore };
