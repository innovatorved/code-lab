/**
 * @innovatorved/code-lab — Workbench CSS Tokens, Themes & Styles
 */

export const WORKBENCH_STYLES = `
/* ── Split Run Button ── */
.codelab-btn-split {
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--cl-radius, 6px);
  overflow: visible;
  position: relative;
}
.codelab-btn-split .codelab-btn-split__main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.25);
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
  background: var(--cl-bg-elevated, #252526);
  border: 1px solid var(--cl-border-strong, var(--cl-border, #3c3c3c));
  border-radius: var(--cl-radius, 6px);
  box-shadow: var(--cl-shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.45));
  z-index: 1200;
  min-width: 220px;
  padding: 4px 0;
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
  padding: 6px 12px;
  background: none;
  border: none;
  color: var(--cl-fg, #cccccc);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.codelab-split-menu__item:hover,
.codelab-split-menu__item:focus-visible {
  background: var(--cl-accent, #38bdf8);
  color: var(--cl-accent-fg, #06131f);
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
  border-radius: var(--cl-radius, 6px);
  background: var(--cl-bg-hover, rgba(128, 128, 128, 0.12));
  border: 1px solid var(--cl-border, #3c3c3c);
  color: var(--cl-fg-muted, #858585);
  font-size: 11.5px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.codelab-cmd-trigger:hover,
.codelab-cmd-trigger:focus-visible {
  background: var(--cl-bg-active, rgba(128, 128, 128, 0.2));
  color: var(--cl-fg, #cccccc);
  border-color: var(--cl-accent, #38bdf8);
  outline: none;
}

/* ── HUD Telemetry Pill ── */
.codelab-hud-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 10px;
  border-radius: 12px;
  background: var(--cl-hud-bg, rgba(0, 122, 204, 0.15));
  border: 1px solid var(--cl-hud-border, rgba(0, 122, 204, 0.35));
  color: var(--cl-hud-fg, #4fc1ff);
  font-family: var(--cl-font-mono, monospace);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
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
  background: var(--cl-bg-editor, #1e1e1e);
  box-sizing: border-box;
}
.codelab-stdin-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--cl-fg-muted, #858585);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.codelab-stdin-panel__textarea {
  flex: 1;
  width: 100%;
  background: var(--cl-input-bg, #252526);
  border: 1px solid var(--cl-border, #3c3c3c);
  border-radius: var(--cl-radius, 4px);
  color: var(--cl-fg, #cccccc);
  font-family: var(--cl-font-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  padding: 8px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}
.codelab-stdin-panel__textarea:focus {
  border-color: var(--cl-accent, #007acc);
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
  font-size: 12px;
  font-family: var(--cl-font-mono, monospace);
  cursor: pointer;
  border-bottom: 1px solid var(--cl-border, rgba(128, 128, 128, 0.12));
}
.codelab-problem-item:hover {
  background: var(--cl-bg-hover, rgba(128, 128, 128, 0.1));
}
.codelab-problem-item--error {
  color: var(--cl-danger, #ef4444);
}
.codelab-problem-item--warning {
  color: var(--cl-warn, #f59e0b);
}
.codelab-problem-item--info {
  color: var(--cl-accent, #38bdf8);
}
.codelab-problem-item__location {
  color: var(--cl-fg-muted, #858585);
  font-size: 11px;
  margin-left: auto;
}

/* ── Monaco Side-by-Side Diff Editor ── */
.codelab-diff-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--cl-bg-editor, #1e1e1e);
}
.codelab-diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--cl-bg-panel, #252526);
  border-bottom: 1px solid var(--cl-border, #3c3c3c);
  font-size: 12px;
}
.codelab-diff-host {
  flex: 1;
  width: 100%;
  height: calc(100% - 36px);
  position: relative;
}
`;
