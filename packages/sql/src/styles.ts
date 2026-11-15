export const SQL_EDITOR_CSS = `/* @innovatorved/code-lab/sql — Lightweight SQL Editor & Playground Styles */
.cl-sql-root {
  --cl-bg: var(--code-bg, var(--ds-canvas, var(--bg, #0f0f10)));
  --cl-fg: var(--code-fg, var(--ds-ink, var(--fg, #f4f4f5)));
  --cl-accent: var(--brand-accent, var(--accent, #f4f4f5));
  --cl-accent-fg: var(--brand-accent-ink, var(--accent-fg, #0f0f10));
  --cl-border: var(--ds-border, var(--border, #27272a));
  --cl-font-sans: var(--ds-font-sans, var(--font-sans, "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif));
  --cl-font-mono: var(--ds-font-mono, var(--font-mono, "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace));
  --cl-text-2xs: var(--ds-text-2xs, 0.6875rem);
  --cl-text-xs: var(--ds-text-xs, 0.75rem);
  --cl-text-sm: var(--ds-text-sm, 0.8125rem);
  --cl-sql-gutter-bg: var(--ds-canvas-subtle, var(--bg-alt, #141415));
  --cl-sql-gutter-fg: var(--ds-ink-faint, #8e8e97);
  --cl-sql-popup-bg: var(--ds-surface, #18181a);
  --cl-sql-popup-hover: var(--ds-surface-active, #28282b);
  --cl-sql-selection: rgba(244, 244, 245, 0.18);
  --cl-sql-kw: #f87171;
  --cl-sql-fn: #c084fc;
  --cl-sql-type: #fb923c;
  --cl-sql-str: #86efac;
  --cl-sql-num: #fcd34d;
  --cl-sql-op: #d4d4d8;
  --cl-sql-param: #fbbf24;
  --cl-sql-qident: #e4e4e7;
  --cl-sql-comment: #8e8e97;
  --cl-sql-error: #f87171;
  --cl-sql-warn: #fbbf24;
  --cl-sql-font-size: 0.8125rem;
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
  font-family: var(--cl-font-sans);
  container-type: inline-size;
}

.cl-sql-root[data-cl-sql-theme="light"],
:root[data-theme="light"] .cl-sql-root:not([data-cl-sql-theme="dark"]) {
  --cl-bg: var(--code-bg, var(--ds-surface, var(--surface, #ffffff)));
  --cl-fg: var(--code-fg, var(--ds-ink, var(--fg, #18181b)));
  --cl-accent: var(--brand-accent, var(--accent, #18181b));
  --cl-accent-fg: var(--brand-accent-ink, var(--accent-fg, #ffffff));
  --cl-border: var(--ds-border, var(--border, #e6e4df));
  --cl-sql-gutter-bg: var(--ds-canvas, var(--bg, #f7f7f5));
  --cl-sql-gutter-fg: var(--ds-ink-faint, #6e6a64);
  --cl-sql-popup-bg: #ffffff;
  --cl-sql-popup-hover: #ecebe7;
  --cl-sql-selection: rgba(24, 24, 27, 0.14);
  --cl-sql-kw: #c2410c;
  --cl-sql-fn: #6d28d9;
  --cl-sql-type: #9a3412;
  --cl-sql-str: #067647;
  --cl-sql-num: #b54708;
  --cl-sql-op: #3f3f46;
  --cl-sql-param: #b54708;
  --cl-sql-qident: #18181b;
  --cl-sql-comment: #6e6a64;
  --cl-sql-error: #b42318;
  --cl-sql-warn: #b54708;
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
  font-size: var(--cl-text-xs);
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
  padding: 2px 8px;
  border-radius: 999px;
  font-family: var(--cl-font-mono);
  font-size: var(--cl-text-2xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  border: 1px solid var(--cl-border);
  color: var(--cl-fg);
}

.cl-sql-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--cl-border);
  background: transparent;
  color: var(--cl-fg);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs);
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}

.cl-sql-btn:hover {
  border-color: var(--cl-accent);
}

.cl-sql-btn-primary {
  background: var(--cl-accent);
  border-color: var(--cl-accent);
  color: var(--cl-accent-fg);
}

.cl-sql-btn:focus-visible {
  outline: 1px solid var(--cl-accent);
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
  font-size: var(--cl-text-sm);
}

.cl-sql-ResultsEmpty {
  color: var(--cl-sql-gutter-fg);
  font-size: var(--cl-text-xs);
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
  font-family: var(--cl-font-mono);
  font-variant-numeric: tabular-nums;
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
  background: var(--cl-sql-selection);
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
  padding: 8px 12px;
  border-top: 1px solid var(--cl-border);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs);
  line-height: 1.45;
  background: rgba(239, 68, 68, 0.08);
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
  font-family: var(--cl-font-mono);
  font-size: var(--cl-text-2xs);
  font-weight: 600;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--cl-sql-error);
  color: #ffffff;
}

.cl-sql-diag-badge[data-severity="warning"] {
  background: var(--cl-sql-warn);
  color: #09090b;
}

.cl-sql-diag-hint {
  width: 100%;
  margin-top: 2px;
  color: var(--cl-sql-gutter-fg);
  font-size: var(--cl-text-xs);
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
  border-radius: 8px;
  background: var(--cl-sql-popup-bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs);
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
  border-radius: 6px;
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
  font-family: var(--cl-font-mono);
  font-size: 10px;
  font-weight: 700;
  border: 1px solid var(--cl-border);
  background: var(--cl-sql-gutter-bg);
  color: var(--cl-fg);
  flex-shrink: 0;
}

.cl-sql-comp-label {
  font-family: var(--cl-font-mono);
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
  font-size: var(--cl-text-2xs);
  color: var(--cl-sql-gutter-fg);
}

.cl-sql-comp-badge {
  font-family: var(--cl-font-mono);
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--cl-border);
  font-size: 10px;
}

.cl-sql-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-top: 1px solid var(--cl-border);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-2xs);
  font-variant-numeric: tabular-nums;
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
