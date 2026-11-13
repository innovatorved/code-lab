export const SQL_EDITOR_CSS = `/* @innovatorved/code-lab/sql — Lightweight SQL Editor & Playground Styles */
.cl-sql-root {
  --cl-bg: var(--code-bg, var(--surface, #0a0a0a));
  --cl-fg: var(--code-fg, var(--fg, #f5f5f5));
  --cl-accent: var(--accent, #0284c7);
  --cl-border: var(--border, #262626);
  --cl-font-mono: var(--font-mono, 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  --cl-sql-gutter-bg: rgba(255, 255, 255, 0.025);
  --cl-sql-gutter-fg: #737373;
  --cl-sql-popup-bg: #141414;
  --cl-sql-popup-hover: rgba(2, 132, 199, 0.18);
  --cl-sql-kw: #38bdf8;
  --cl-sql-fn: #c084fc;
  --cl-sql-type: #2dd4bf;
  --cl-sql-str: #86efac;
  --cl-sql-num: #fbbf24;
  --cl-sql-op: #f472b6;
  --cl-sql-param: #fb923c;
  --cl-sql-qident: #93c5fd;
  --cl-sql-comment: #737373;
  --cl-sql-error: #ef4444;
  --cl-sql-warn: #f59e0b;
  --cl-sql-font-size: 13.5px;
  --cl-sql-line-height: 1.55;

  color-scheme: dark;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--cl-border);
  border-radius: 8px;
  background: var(--cl-bg);
  color: var(--cl-fg);
  accent-color: var(--cl-accent);
  font-family: var(--cl-font-mono);
  container-type: inline-size;
}

.cl-sql-root[data-cl-sql-theme="light"],
:root[data-theme="light"] .cl-sql-root:not([data-cl-sql-theme="dark"]) {
  --cl-bg: var(--code-bg, var(--surface, #ffffff));
  --cl-fg: var(--code-fg, var(--fg, #0f172a));
  --cl-accent: var(--accent, #0284c7);
  --cl-border: var(--border, #e2e8f0);
  --cl-sql-gutter-bg: #f8fafc;
  --cl-sql-gutter-fg: #64748b;
  --cl-sql-popup-bg: #ffffff;
  --cl-sql-popup-hover: rgba(2, 132, 199, 0.12);
  --cl-sql-kw: #0369a1;
  --cl-sql-fn: #7e22ce;
  --cl-sql-type: #0f766e;
  --cl-sql-str: #15803d;
  --cl-sql-num: #b45309;
  --cl-sql-op: #be185d;
  --cl-sql-param: #c2410c;
  --cl-sql-qident: #1d4ed8;
  --cl-sql-comment: #64748b;
  color-scheme: light;
  background: var(--cl-bg);
  color: var(--cl-fg);
  accent-color: var(--cl-accent);
}

.cl-sql-root *,
.cl-sql-root *::before,
.cl-sql-root *::after {
  box-sizing: border-box;
}

.cl-sql-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--cl-border);
  font-size: 12px;
  background: var(--cl-sql-gutter-bg);
  border-radius: 7px 7px 0 0;
}

.cl-sql-toolbar-left,
.cl-sql-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.cl-sql-dialect-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid var(--cl-border);
  color: var(--cl-accent);
}

.cl-sql-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 5px;
  border: 1px solid var(--cl-border);
  background: transparent;
  color: var(--cl-fg);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
}

.cl-sql-btn:hover {
  border-color: var(--cl-accent);
}

.cl-sql-btn-primary {
  background: var(--cl-accent);
  border-color: var(--cl-accent);
  color: #ffffff;
}

.cl-sql-btn:focus-visible {
  outline: 2px solid var(--cl-accent);
  outline-offset: 2px;
}

.cl-sql-playground-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  min-height: 240px;
}

@container (max-width: 767px) {
  .cl-sql-playground-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .cl-sql-results-slot {
    border-left: none !important;
    border-top: 1px solid var(--cl-border);
  }
}

@media (max-width: 767px) {
  .cl-sql-playground-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .cl-sql-results-slot {
    border-left: none !important;
    border-top: 1px solid var(--cl-border);
  }
}

.cl-sql-results-slot {
  border-left: 1px solid var(--cl-border);
  padding: 10px 12px;
  overflow: auto;
  font-size: 12.5px;
}

.cl-sql-ResultsEmpty {
  color: var(--cl-sql-gutter-fg);
  font-size: 12px;
}

.cl-sql-surface {
  position: relative;
  display: flex;
  width: 100%;
  overflow: hidden;
}

.cl-sql-gutter {
  flex: 0 0 auto;
  min-width: 38px;
  padding: 10px 8px 10px 6px;
  text-align: right;
  user-select: none;
  background: var(--cl-sql-gutter-bg);
  border-right: 1px solid var(--cl-border);
  color: var(--cl-sql-gutter-fg);
  font-size: var(--cl-sql-font-size);
  line-height: var(--cl-sql-line-height);
  overflow: hidden;
}

.cl-sql-gutter-line {
  position: relative;
  padding-left: 10px;
}

.cl-sql-gutter-line[data-diag="error"] {
  color: var(--cl-sql-error);
  font-weight: 700;
}

.cl-sql-gutter-line[data-diag="error"]::before,
.cl-sql-gutter-line[data-diag="warning"]::before {
  content: "";
  position: absolute;
  left: 1px;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translateY(-50%);
  background: var(--cl-sql-error);
}

.cl-sql-gutter-line[data-diag="warning"]::before {
  background: var(--cl-sql-warn);
}

.cl-sql-editor-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.cl-sql-backdrop,
.cl-sql-textarea {
  margin: 0;
  padding: 10px 12px;
  width: 100%;
  height: 100%;
  border: 0;
  font-family: var(--cl-font-mono);
  font-size: var(--cl-sql-font-size);
  line-height: var(--cl-sql-line-height);
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  letter-spacing: normal;
  font-variant-ligatures: none;
}

@media (pointer: coarse) {
  .cl-sql-root {
    --cl-sql-font-size: 16px;
  }
  .cl-sql-textarea,
  .cl-sql-backdrop,
  .cl-sql-gutter {
    font-size: max(16px, var(--cl-sql-font-size));
  }
}

.cl-sql-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: var(--cl-fg);
  background: transparent;
  z-index: 1;
}

.cl-sql-textarea {
  position: relative;
  display: block;
  z-index: 2;
  resize: none;
  color: transparent;
  caret-color: var(--cl-fg);
  background: transparent;
  outline: none;
  -webkit-text-fill-color: transparent;
}

.cl-sql-textarea::placeholder {
  color: var(--cl-sql-gutter-fg);
  -webkit-text-fill-color: var(--cl-sql-gutter-fg);
}

.cl-sql-textarea::selection {
  background: rgba(2, 132, 199, 0.32);
}

.cl-sql-textarea:focus-visible {
  box-shadow: inset 0 0 0 1px var(--cl-accent);
}

/* Token highlight colors */
.cl-sql-tok-kw { color: var(--cl-sql-kw); font-weight: 600; }
.cl-sql-tok-fn { color: var(--cl-sql-fn); }
.cl-sql-tok-type { color: var(--cl-sql-type); }
.cl-sql-tok-str { color: var(--cl-sql-str); }
.cl-sql-tok-num { color: var(--cl-sql-num); }
.cl-sql-tok-op { color: var(--cl-sql-op); }
.cl-sql-tok-param { color: var(--cl-sql-param); font-weight: 600; }
.cl-sql-tok-qident { color: var(--cl-sql-qident); }
.cl-sql-tok-comment { color: var(--cl-sql-comment); font-style: italic; }

/* Inline wavy diagnostic underlines */
.cl-sql-diag-error {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-color: var(--cl-sql-error);
  text-underline-offset: 3px;
  background: rgba(239, 68, 68, 0.14);
  border-radius: 2px;
}

.cl-sql-diag-warning {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-color: var(--cl-sql-warn);
  text-underline-offset: 3px;
  background: rgba(245, 158, 11, 0.14);
  border-radius: 2px;
}

.cl-sql-diag-info {
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--cl-accent);
}

.cl-sql-diagnostics {
  display: none;
  padding: 7px 12px;
  border-top: 1px solid var(--cl-border);
  font-size: 12px;
  line-height: 1.45;
  background: rgba(239, 68, 68, 0.09);
  color: var(--cl-fg);
}

.cl-sql-diagnostics[data-visible="true"] {
  display: block;
}

.cl-sql-diag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}

.cl-sql-diag-badge {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--cl-sql-error);
  color: #ffffff;
}

.cl-sql-diag-badge[data-severity="warning"] {
  background: var(--cl-sql-warn);
  color: #000000;
}

.cl-sql-diag-hint {
  width: 100%;
  margin-top: 2px;
  color: var(--cl-sql-gutter-fg);
  font-size: 11.5px;
}

/* Schema-aware completion popup */
.cl-sql-completions {
  display: none;
  position: absolute;
  left: 44px;
  bottom: 8px;
  z-index: 30;
  width: min(380px, calc(100% - 52px));
  max-height: 210px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--cl-border);
  border-radius: 7px;
  background: var(--cl-sql-popup-bg);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38);
  font-size: 12px;
}

.cl-sql-completions[data-open="true"] {
  display: block;
}

.cl-sql-completion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  touch-action: manipulation;
}

.cl-sql-completion-item[aria-selected="true"],
.cl-sql-completion-item:hover {
  background: var(--cl-sql-popup-hover);
}

.cl-sql-comp-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cl-sql-comp-kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(2, 132, 199, 0.16);
  color: var(--cl-accent);
  flex-shrink: 0;
}

.cl-sql-comp-label {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cl-sql-comp-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--cl-sql-gutter-fg);
}

.cl-sql-comp-badge {
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--cl-border);
  font-size: 10px;
}

.cl-sql-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 10px;
  border-top: 1px solid var(--cl-border);
  font-size: 11px;
  color: var(--cl-sql-gutter-fg);
}

.cl-sql-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .cl-sql-root,
  .cl-sql-root * {
    transition: none !important;
    animation: none !important;
  }
}
`;

const STYLE_TAG_ID = 'codelab-sql-inline-styles';

export function ensureSqlStylesInjected(doc?: Document): void {
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!targetDoc || !targetDoc.head) return;
  const existing =
    typeof targetDoc.getElementById === 'function'
      ? targetDoc.getElementById(STYLE_TAG_ID)
      : typeof targetDoc.head.querySelector === 'function'
        ? targetDoc.head.querySelector(`#${STYLE_TAG_ID}`)
        : null;
  if (existing) return;
  const styleEl = targetDoc.createElement('style');
  styleEl.id = STYLE_TAG_ID;
  styleEl.textContent = SQL_EDITOR_CSS;
  targetDoc.head.appendChild(styleEl);
}
