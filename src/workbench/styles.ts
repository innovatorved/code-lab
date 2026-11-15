/**
 * @innovatorved/code-lab — Workbench CSS Tokens, Themes & Styles
 */

export const WORKBENCH_STYLES = `
/* ── Split Run Button ── */
.codelab-btn-split {
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--cl-radius-md, 6px);
  overflow: visible;
  position: relative;
}
.codelab-btn-split .codelab-btn-split__main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.18);
}
.codelab-btn-split .codelab-btn-split__trigger {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0 6px;
  min-width: 24px;
}
.codelab-split-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--cl-bg-panel, #18181a);
  border: 1px solid var(--cl-border-strong, var(--cl-border, #27272a));
  border-radius: var(--cl-radius-md, 6px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  z-index: 1200;
  min-width: 220px;
  padding: 4px;
  display: none;
}
.codelab-split-menu.open,
.codelab-split-menu.active {
  display: block;
}
.codelab-split-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border-radius: var(--cl-radius-sm, 4px);
  background: none;
  border: none;
  color: var(--cl-fg, #f4f4f5);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs, 0.75rem);
  cursor: pointer;
  text-align: left;
}
.codelab-split-menu__item:hover,
.codelab-split-menu__item:focus-visible {
  background: var(--cl-list-active, #28282b);
  color: var(--cl-list-active-fg, #f4f4f5);
  outline: none;
}

/* ── Command Palette Trigger Pill ── */
.codelab-cmd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  min-width: 200px;
  justify-content: center;
  border-radius: var(--cl-radius-md, 6px);
  background: var(--cl-input-bg, #141415);
  border: 1px solid var(--cl-border, #27272a);
  color: var(--cl-fg-muted, #a1a1aa);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs, 0.75rem);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.codelab-cmd-trigger:hover,
.codelab-cmd-trigger:focus-visible {
  background: var(--cl-bg-hover, #1f1f22);
  color: var(--cl-fg, #f4f4f5);
  border-color: var(--cl-border-strong, #3a3a3e);
  outline: none;
}

/* ── HUD Telemetry Pill ── */
.codelab-hud-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--cl-bg-panel, #18181a);
  border: 1px solid var(--cl-border, #27272a);
  color: var(--cl-fg-muted, #a1a1aa);
  font-family: var(--cl-font-mono);
  font-size: var(--cl-text-2xs, 0.6875rem);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  margin-left: auto;
  user-select: none;
}
.codelab-hud-pill__metric {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ── Stdin / Custom Input Panel ── */
.codelab-stdin-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 12px;
  background: var(--cl-bg-editor, #0f0f10);
  box-sizing: border-box;
}
.codelab-stdin-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs, 0.75rem);
  color: var(--cl-fg-muted, #a1a1aa);
  font-weight: 500;
}
.codelab-stdin-panel__textarea {
  flex: 1;
  width: 100%;
  background: var(--cl-input-bg, #141415);
  border: 1px solid var(--cl-border, #27272a);
  border-radius: var(--cl-radius-md, 6px);
  color: var(--cl-fg, #f4f4f5);
  font-family: var(--cl-font-mono);
  font-size: var(--cl-text-xs, 0.75rem);
  line-height: 1.5;
  padding: 8px 10px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}
.codelab-stdin-panel__textarea:focus {
  border-color: var(--cl-focus-border, #a1a1aa);
}

/* ── Problems Drawer Tab ── */
.codelab-problems-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100%;
  padding: 4px 0;
}
.codelab-problem-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: var(--cl-text-xs, 0.75rem);
  font-family: var(--cl-font-mono);
  cursor: pointer;
  border-bottom: 1px solid var(--cl-border-subtle, #1d1d20);
}
.codelab-problem-item:hover {
  background: var(--cl-bg-hover, #1f1f22);
}
.codelab-problem-item--error {
  color: var(--cl-red, #f87171);
}
.codelab-problem-item--warning {
  color: var(--cl-amber, #fbbf24);
}
.codelab-problem-item--info {
  color: var(--cl-fg, #f4f4f5);
}
.codelab-problem-item__location {
  color: var(--cl-fg-muted, #a1a1aa);
  font-size: var(--cl-text-2xs, 0.6875rem);
  font-variant-numeric: tabular-nums;
  margin-left: auto;
}

/* ── Monaco Side-by-Side Diff Editor ── */
.codelab-diff-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--cl-bg-editor, #0f0f10);
}
.codelab-diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--cl-bg-elevated, #141415);
  border-bottom: 1px solid var(--cl-border, #27272a);
  font-family: var(--cl-font-sans);
  font-size: var(--cl-text-xs, 0.75rem);
}
.codelab-diff-host {
  flex: 1;
  width: 100%;
  height: calc(100% - 36px);
  position: relative;
}
`;
