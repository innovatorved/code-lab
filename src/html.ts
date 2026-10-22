/**
 * @innovatorved/code-lab — Safe HTML Tagged Template & Escaping Primitives
 * ============================================================================
 * Strict TypeScript leaf module. Every interpolated value in `html\`...\`` is
 * HTML-escaped by default unless explicitly wrapped with `raw(...)` or
 * produced by nested `html\`...\`` calls.
 */

const SAFE_HTML_BRAND = Symbol.for('codelab.SafeHtml');

export interface SafeHtml {
  readonly [SAFE_HTML_BRAND]: true;
  readonly __html: string;
  toString(): string;
}

class SafeHtmlImpl implements SafeHtml {
  readonly [SAFE_HTML_BRAND] = true as const;
  readonly __html: string;

  constructor(trusted: string) {
    this.__html = String(trusted);
  }

  toString(): string {
    return this.__html;
  }
}

export function isSafeHtml(value: unknown): value is SafeHtml {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<symbol, unknown>)[SAFE_HTML_BRAND] === true &&
      typeof (value as { __html?: unknown }).__html === 'string'
  );
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (isSafeHtml(value)) return value.__html;
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(trustedHtml: string): SafeHtml {
  return new SafeHtmlImpl(trustedHtml);
}

function renderInterpolation(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (isSafeHtml(value)) return value.__html;
  if (Array.isArray(value)) {
    let out = '';
    for (let i = 0; i < value.length; i++) {
      out += renderInterpolation(value[i]);
    }
    return out;
  }
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) {
    out += renderInterpolation(values[i]);
    out += strings[i + 1] ?? '';
  }
  return new SafeHtmlImpl(out);
}

const _htmlNamespace = {
  escapeHtml,
  raw,
  isSafeHtml,
  html
};

const _globalRoot = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : null;
if (_globalRoot && !_globalRoot.CodeLabHtml) {
  _globalRoot.CodeLabHtml = _htmlNamespace;
}

export default _htmlNamespace;
