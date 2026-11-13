import { completeSql } from './completions';
import { formatSql } from './formatter';
import { ensureSqlStylesInjected } from './styles';
import { escapeSqlHtml, highlightSql } from './tokenizer';
import type {
  SqlCompletionItem,
  SqlDiagnostic,
  SqlDialect,
  SqlEditorInstance,
  SqlEditorMode,
  SqlEditorOptions,
  SqlRunPayload,
  SqlSchema,
  SqlThemeMode
} from './types';

let instanceSeq = 0;

const AUTO_INDENT_CLAUSES = /\b(SELECT|FROM|WHERE|JOIN|LEFT\s+JOIN|INNER\s+JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|VALUES|SET|BEGIN)\s*$/i;
const PAIR_MAP: Readonly<Record<string, string>> = {
  '(': ')',
  '\'': '\'',
  '"': '"'
};

function kindAbbrev(kind: SqlCompletionItem['kind']): string {
  switch (kind) {
    case 'table':
      return 'T';
    case 'column':
      return 'C';
    case 'function':
      return 'ƒ';
    case 'cte':
      return 'W';
    case 'keyword':
      return 'K';
  }
}

export function createSqlEditor(
  containerEl: HTMLElement,
  options: SqlEditorOptions = {}
): SqlEditorInstance {
  if (!containerEl) {
    throw new Error('createSqlEditor requires a valid container element');
  }

  const ownerDoc = containerEl.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
  ensureSqlStylesInjected(ownerDoc);

  const uid = `cl-sql-${++instanceSeq}`;
  const diagId = `${uid}-diagnostics`;
  const listboxId = `${uid}-completions`;
  const statusId = `${uid}-a11y-status`;

  let currentValue = options.value ?? '';
  let dialect: SqlDialect = options.dialect ?? options.schema?.dialect ?? 'postgres';
  const mode: SqlEditorMode = options.mode ?? 'inline';
  let schema: SqlSchema | null = options.schema ?? null;
  let theme: SqlThemeMode = options.theme ?? 'auto';
  let readOnly = Boolean(options.readOnly);
  let diagnostics: SqlDiagnostic[] = [];
  let completions: SqlCompletionItem[] = [];
  let activeCompletionIdx = 0;
  let tabMovesFocus = false;
  let destroyed = false;

  const minLines = Math.max(1, options.minLines ?? (mode === 'playground' ? 10 : 3));
  const maxLines = Math.max(minLines, options.maxLines ?? (mode === 'playground' ? 28 : 16));
  const showToolbar = options.showToolbar ?? (mode === 'playground');

  const docFactory = ownerDoc ?? document;
  const rootEl = docFactory.createElement('div');
  rootEl.className = 'cl-sql-root';
  rootEl.setAttribute('data-cl-sql-mode', mode);

  // Optional header / toolbar
  let headerSlot: HTMLElement | null = null;
  let dialectPillEl: HTMLElement | null = null;
  if (showToolbar) {
    headerSlot = docFactory.createElement('div');
    headerSlot.className = 'cl-sql-toolbar';
    headerSlot.innerHTML =
      `<div class="cl-sql-toolbar-left">` +
      `<span class="cl-sql-dialect-pill" data-role="dialect-pill">${dialect === 'postgres' ? 'PostgreSQL 18' : 'SQLite 3'}</span>` +
      `</div>` +
      `<div class="cl-sql-toolbar-right">` +
      `<button type="button" class="cl-sql-btn" data-action="format" title="Format SQL (Shift+Alt+F)">Format</button>` +
      (options.onExplain
        ? `<button type="button" class="cl-sql-btn" data-action="explain" title="Explain Query Plan">Explain</button>`
        : '') +
      `<button type="button" class="cl-sql-btn cl-sql-btn-primary" data-action="run" title="Run Query (Cmd/Ctrl+Enter)">Run ↵</button>` +
      `</div>`;
    dialectPillEl = headerSlot.querySelector('[data-role="dialect-pill"]');
    rootEl.appendChild(headerSlot);
  }

  // Editor surface (gutter + backdrop `<pre>` + `<textarea>`)
  const surfaceEl = docFactory.createElement('div');
  surfaceEl.className = 'cl-sql-surface';

  const gutterEl = docFactory.createElement('div');
  gutterEl.className = 'cl-sql-gutter';
  gutterEl.setAttribute('aria-hidden', 'true');

  const editorWrapEl = docFactory.createElement('div');
  editorWrapEl.className = 'cl-sql-editor-wrap';

  const backdropEl = docFactory.createElement('pre');
  backdropEl.className = 'cl-sql-backdrop';
  backdropEl.setAttribute('aria-hidden', 'true');

  const textareaEl = docFactory.createElement('textarea');
  textareaEl.className = 'cl-sql-textarea';
  textareaEl.setAttribute('role', 'textbox');
  textareaEl.setAttribute('aria-multiline', 'true');
  textareaEl.setAttribute('aria-label', options.ariaLabel ?? `${dialect.toUpperCase()} SQL Editor`);
  textareaEl.setAttribute('aria-autocomplete', 'list');
  textareaEl.setAttribute('aria-controls', listboxId);
  textareaEl.setAttribute('spellcheck', 'false');
  textareaEl.setAttribute('autocapitalize', 'off');
  textareaEl.setAttribute('autocomplete', 'off');
  textareaEl.setAttribute('autocorrect', 'off');
  if (options.placeholder) {
    textareaEl.setAttribute('placeholder', options.placeholder);
  }
  if (readOnly) {
    textareaEl.readOnly = true;
    textareaEl.setAttribute('aria-readonly', 'true');
  }
  textareaEl.value = currentValue;

  editorWrapEl.appendChild(backdropEl);
  editorWrapEl.appendChild(textareaEl);
  surfaceEl.appendChild(gutterEl);
  surfaceEl.appendChild(editorWrapEl);

  // Completion listbox
  const completionListEl = docFactory.createElement('ul');
  completionListEl.id = listboxId;
  completionListEl.className = 'cl-sql-completions';
  completionListEl.setAttribute('role', 'listbox');
  completionListEl.setAttribute('aria-label', 'SQL Completions');
  surfaceEl.appendChild(completionListEl);

  // Playground split wrapper or direct inline mount
  let resultsSlot: HTMLElement | null = null;
  if (mode === 'playground') {
    const splitEl = docFactory.createElement('div');
    splitEl.className = 'cl-sql-playground-layout';
    splitEl.appendChild(surfaceEl);
    resultsSlot = docFactory.createElement('div');
    resultsSlot.className = 'cl-sql-results-slot';
    resultsSlot.innerHTML = `<div class="cl-sql-ResultsEmpty">Press Cmd/Ctrl+Enter to run query.</div>`;
    splitEl.appendChild(resultsSlot);
    rootEl.appendChild(splitEl);
  } else {
    rootEl.appendChild(surfaceEl);
  }

  // Diagnostic banner (`aria-describedby` target)
  const diagBannerEl = docFactory.createElement('div');
  diagBannerEl.id = diagId;
  diagBannerEl.className = 'cl-sql-diagnostics';
  diagBannerEl.setAttribute('role', 'status');
  diagBannerEl.setAttribute('aria-live', 'polite');
  rootEl.appendChild(diagBannerEl);

  // Screen-reader status & optional footer
  const srStatusEl = docFactory.createElement('div');
  srStatusEl.id = statusId;
  srStatusEl.className = 'cl-sql-sr-only';
  srStatusEl.setAttribute('aria-live', 'polite');
  rootEl.appendChild(srStatusEl);

  let footerSlot: HTMLElement | null = null;
  if (mode === 'playground') {
    footerSlot = docFactory.createElement('div');
    footerSlot.className = 'cl-sql-footer';
    footerSlot.innerHTML =
      `<span data-role="shortcut-hint">Cmd/Ctrl+Enter Run · Shift+Alt+F Format · Esc toggles Tab focus</span>` +
      `<span data-role="tab-mode-indicator"></span>`;
    rootEl.appendChild(footerSlot);
  }

  containerEl.innerHTML = '';
  containerEl.appendChild(rootEl);

  const cleanups: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(
    el: EventTarget,
    evt: K | string,
    fn: EventListenerOrEventListenerObject
  ): void => {
    el.addEventListener(evt, fn);
    cleanups.push(() => el.removeEventListener(evt, fn));
  };

  const resolveEffectiveTheme = (): 'dark' | 'light' => {
    if (theme === 'dark' || theme === 'light') return theme;
    const docRoot = ownerDoc?.documentElement;
    if (docRoot) {
      const hostAttr = docRoot.getAttribute('data-theme') || docRoot.getAttribute('data-cl-theme');
      if (hostAttr === 'light') return 'light';
      if (hostAttr === 'dark') return 'dark';
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      if (mql && mql.matches) return 'light';
    }
    return 'dark';
  };

  const applyResolvedTheme = (): void => {
    const resolved = resolveEffectiveTheme();
    rootEl.setAttribute('data-cl-sql-theme', resolved);
  };

  // Watch host `<html data-theme="...">` and system `prefers-color-scheme`
  if (typeof MutationObserver === 'function' && ownerDoc?.documentElement) {
    const mo = new MutationObserver(() => {
      if (theme === 'auto') applyResolvedTheme();
    });
    mo.observe(ownerDoc.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-cl-theme', 'class']
    });
    cleanups.push(() => mo.disconnect());
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql && typeof mql.addEventListener === 'function') {
      const listener = (): void => {
        if (theme === 'auto') applyResolvedTheme();
      };
      mql.addEventListener('change', listener);
      cleanups.push(() => mql.removeEventListener('change', listener));
    }
  }

  const updateHeightAndGutter = (): void => {
    const lineCount = Math.max(1, currentValue.split('\n').length);
    const clampedLines = Math.max(minLines, Math.min(maxLines, lineCount));
    const lineHeightPx = 21;
    const targetHeight = Math.round(clampedLines * lineHeightPx + 20);
    surfaceEl.style.height = `${targetHeight}px`;

    // Compute per-line diagnostics for gutter dots
    const lineSeverity = new Map<number, 'error' | 'warning'>();
    for (const d of diagnostics) {
      let line = d.line;
      if (line === undefined && d.fromOffset !== undefined) {
        line = currentValue.slice(0, Math.max(0, d.fromOffset)).split('\n').length;
      }
      if (line !== undefined && line >= 1) {
        const prev = lineSeverity.get(line);
        if (d.severity === 'error' || (!prev && d.severity === 'warning')) {
          lineSeverity.set(line, d.severity === 'error' ? 'error' : 'warning');
        }
      }
    }

    const gutterHtml: string[] = [];
    for (let ln = 1; ln <= lineCount; ln++) {
      const sev = lineSeverity.get(ln);
      gutterHtml.push(
        `<div class="cl-sql-gutter-line"${sev ? ` data-diag="${sev}"` : ''}>${ln}</div>`
      );
    }
    gutterEl.innerHTML = gutterHtml.join('');
  };

  const renderDiagnosticsBanner = (): void => {
    if (diagnostics.length === 0) {
      diagBannerEl.setAttribute('data-visible', 'false');
      diagBannerEl.innerHTML = '';
      textareaEl.removeAttribute('aria-describedby');
      textareaEl.removeAttribute('aria-invalid');
      return;
    }
    diagBannerEl.setAttribute('data-visible', 'true');
    const hasError = diagnostics.some((d) => d.severity === 'error');
    if (hasError) {
      textareaEl.setAttribute('aria-invalid', 'true');
    } else {
      textareaEl.removeAttribute('aria-invalid');
    }
    textareaEl.setAttribute('aria-describedby', diagId);

    diagBannerEl.innerHTML = diagnostics
      .map((d) => {
        const loc = d.line ? ` (line ${d.line}${d.column ? `:${d.column}` : ''})` : '';
        return (
          `<div class="cl-sql-diag-row">` +
          `<span class="cl-sql-diag-badge" data-severity="${escapeSqlHtml(d.severity)}">${escapeSqlHtml(d.severity)}</span>` +
          `<span>${escapeSqlHtml(d.message)}${escapeSqlHtml(loc)}</span>` +
          (d.hint ? `<div class="cl-sql-diag-hint">Hint: ${escapeSqlHtml(d.hint)}</div>` : '') +
          `</div>`
        );
      })
      .join('');
  };

  const renderHighlight = (): void => {
    backdropEl.innerHTML = highlightSql(currentValue, dialect, diagnostics);
    updateHeightAndGutter();
  };

  const closeCompletions = (): void => {
    completions = [];
    activeCompletionIdx = 0;
    completionListEl.setAttribute('data-open', 'false');
    completionListEl.innerHTML = '';
    textareaEl.removeAttribute('aria-activedescendant');
  };

  const applyCompletion = (item: SqlCompletionItem): void => {
    const before = currentValue.slice(0, item.replaceFrom);
    const after = currentValue.slice(item.replaceTo);
    const nextVal = before + item.insertText + after;
    const nextCursor = before.length + item.insertText.length;
    currentValue = nextVal;
    textareaEl.value = nextVal;
    textareaEl.selectionStart = nextCursor;
    textareaEl.selectionEnd = nextCursor;
    closeCompletions();
    renderHighlight();
    options.onChange?.(currentValue);
    textareaEl.focus();
  };

  const renderCompletions = (): void => {
    if (completions.length === 0 || readOnly) {
      closeCompletions();
      return;
    }
    completionListEl.setAttribute('data-open', 'true');
    const activeId = `${uid}-opt-${activeCompletionIdx}`;
    textareaEl.setAttribute('aria-activedescendant', activeId);

    completionListEl.innerHTML = completions
      .map((item, idx) => {
        const optId = `${uid}-opt-${idx}`;
        const selected = idx === activeCompletionIdx ? 'true' : 'false';
        const badges: string[] = [];
        if (item.secondaryBadge) {
          badges.push(`<span class="cl-sql-comp-badge">${escapeSqlHtml(item.secondaryBadge)}</span>`);
        }
        if (item.badge) {
          badges.push(`<span class="cl-sql-comp-badge">${escapeSqlHtml(item.badge)}</span>`);
        }
        return (
          `<li id="${optId}" role="option" aria-selected="${selected}" data-comp-idx="${idx}" class="cl-sql-completion-item">` +
          `<span class="cl-sql-comp-main">` +
          `<span class="cl-sql-comp-kind" aria-hidden="true">${kindAbbrev(item.kind)}</span>` +
          `<span class="cl-sql-comp-label">${escapeSqlHtml(item.label)}</span>` +
          `</span>` +
          `<span class="cl-sql-comp-meta">` +
          (item.detail ? `<span>${escapeSqlHtml(item.detail)}</span>` : '') +
          badges.join('') +
          `</span>` +
          `</li>`
        );
      })
      .join('');
  };

  const updateCompletionsFromCursor = (): void => {
    if (readOnly || !schema) {
      // Still allow dot-less keyword/function completion if schema is absent only when >=2 chars,
      // or full completion when schema is provided
      if (!schema) {
        closeCompletions();
        return;
      }
    }
    const cursor = textareaEl.selectionStart ?? currentValue.length;
    if ((textareaEl.selectionEnd ?? cursor) !== cursor) {
      closeCompletions();
      return;
    }
    const items = completeSql(currentValue, cursor, schema, dialect, 24);
    // Avoid showing single exact match identical to what user already typed
    if (
      items.length === 1 &&
      currentValue.slice(items[0].replaceFrom, items[0].replaceTo) === items[0].insertText
    ) {
      closeCompletions();
      return;
    }
    completions = items;
    activeCompletionIdx = 0;
    renderCompletions();
  };

  const buildRunPayload = (): SqlRunPayload => {
    const start = textareaEl.selectionStart ?? 0;
    const end = textareaEl.selectionEnd ?? 0;
    const rawSel = end > start ? currentValue.slice(start, end) : '';
    const trimmedSel = rawSel.trim();
    return {
      sql: currentValue,
      selectedSql: rawSel,
      effectiveSql: trimmedSel.length > 0 ? rawSel : currentValue,
      dialect
    };
  };

  const triggerRun = (): void => {
    closeCompletions();
    options.onRun?.(buildRunPayload());
  };

  const triggerExplain = (): void => {
    closeCompletions();
    options.onExplain?.(buildRunPayload());
  };

  const toggleLineComments = (): void => {
    if (readOnly) return;
    const start = textareaEl.selectionStart ?? 0;
    const end = textareaEl.selectionEnd ?? start;
    const lineStart = currentValue.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextNewline = currentValue.indexOf('\n', end);
    const lineEnd = nextNewline === -1 ? currentValue.length : nextNewline;
    const block = currentValue.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const allCommented = lines.every((l) => l.trim().length === 0 || /^\s*--/.test(l));
    const updatedLines = lines.map((l) => {
      if (allCommented) {
        return l.replace(/^(\s*)--\s?/, '$1');
      }
      return l.length > 0 ? `-- ${l}` : '--';
    });
    const replacement = updatedLines.join('\n');
    currentValue = currentValue.slice(0, lineStart) + replacement + currentValue.slice(lineEnd);
    textareaEl.value = currentValue;
    textareaEl.selectionStart = lineStart;
    textareaEl.selectionEnd = lineStart + replacement.length;
    renderHighlight();
    options.onChange?.(currentValue);
  };

  const setTabFocusIndicator = (enabled: boolean): void => {
    tabMovesFocus = enabled;
    rootEl.setAttribute('data-tab-moves-focus', enabled ? 'true' : 'false');
    srStatusEl.textContent = enabled
      ? 'Tab moves focus mode enabled. Press Tab to leave the SQL editor.'
      : 'Tab inserts indentation.';
    const indicator = footerSlot?.querySelector('[data-role="tab-mode-indicator"]');
    if (indicator) {
      indicator.textContent = enabled ? 'Tab moves focus' : '';
    }
  };

  // Sync scroll between `<textarea>`, `<pre>`, and gutter
  on(textareaEl, 'scroll', () => {
    backdropEl.scrollTop = textareaEl.scrollTop;
    backdropEl.scrollLeft = textareaEl.scrollLeft;
    gutterEl.scrollTop = textareaEl.scrollTop;
  });

  on(textareaEl, 'input', () => {
    currentValue = textareaEl.value;
    if (tabMovesFocus) setTabFocusIndicator(false);
    renderHighlight();
    updateCompletionsFromCursor();
    options.onChange?.(currentValue);
  });

  on(textareaEl, 'blur', () => {
    // Delay slightly so touch/mousedown on completion item fires first
    setTimeout(() => {
      if (!destroyed) closeCompletions();
    }, 120);
  });

  on(completionListEl, 'mousedown', (rawEvt) => {
    const evt = rawEvt as MouseEvent;
    const target = (evt.target as HTMLElement | null)?.closest?.('[data-comp-idx]');
    if (!target) return;
    evt.preventDefault();
    const idx = Number(target.getAttribute('data-comp-idx'));
    if (completions[idx]) {
      applyCompletion(completions[idx]);
    }
  });

  if (headerSlot) {
    on(headerSlot, 'click', (rawEvt) => {
      const target = (rawEvt.target as HTMLElement | null)?.closest?.('[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      if (action === 'run') triggerRun();
      else if (action === 'format') instance.format();
      else if (action === 'explain') triggerExplain();
    });
  }

  on(textareaEl, 'keydown', (rawEvt) => {
    const event = rawEvt as KeyboardEvent;

    // IME-safe guard: never intercept composition keystrokes (e.g. CJK input Enter/Arrow)
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    const mod = event.metaKey || event.ctrlKey;

    // 1. `Cmd/Ctrl + Enter` -> Run query (selection or full SQL)
    if (mod && event.key === 'Enter') {
      event.preventDefault();
      triggerRun();
      return;
    }

    // 2. `Shift + Alt + F` or `Cmd/Ctrl + Shift + F` -> Format SQL
    if (
      (event.shiftKey && event.altKey && (event.key === 'F' || event.key === 'f')) ||
      (mod && event.shiftKey && (event.key === 'F' || event.key === 'f'))
    ) {
      event.preventDefault();
      if (!readOnly) instance.format();
      return;
    }

    // 3. `Cmd/Ctrl + /` -> Toggle `-- ` line comments
    if (mod && event.key === '/') {
      event.preventDefault();
      toggleLineComments();
      return;
    }

    // 4. Autocomplete navigation when popup is open
    if (completions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeCompletionIdx = (activeCompletionIdx + 1) % completions.length;
        renderCompletions();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeCompletionIdx = (activeCompletionIdx - 1 + completions.length) % completions.length;
        renderCompletions();
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        applyCompletion(completions[activeCompletionIdx]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCompletions();
        return;
      }
    }

    // 5. WCAG 2.1 AA Keyboard Escape: `Esc` enables "Tab moves focus" mode so `Esc` -> `Tab` always leaves editor
    if (event.key === 'Escape') {
      event.preventDefault();
      setTabFocusIndicator(!tabMovesFocus);
      return;
    }

    if (event.key === 'Tab') {
      if (tabMovesFocus || readOnly) {
        // Do NOT preventDefault — let browser move focus naturally out of the editor!
        return;
      }
      event.preventDefault();
      const start = textareaEl.selectionStart ?? 0;
      const end = textareaEl.selectionEnd ?? start;
      if (event.shiftKey) {
        const lineStart = currentValue.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        if (currentValue.slice(lineStart, lineStart + 2) === '  ') {
          currentValue = currentValue.slice(0, lineStart) + currentValue.slice(lineStart + 2);
          textareaEl.value = currentValue;
          const nextPos = Math.max(lineStart, start - 2);
          textareaEl.selectionStart = nextPos;
          textareaEl.selectionEnd = Math.max(lineStart, end - 2);
          renderHighlight();
          options.onChange?.(currentValue);
        }
      } else {
        currentValue = currentValue.slice(0, start) + '  ' + currentValue.slice(end);
        textareaEl.value = currentValue;
        textareaEl.selectionStart = start + 2;
        textareaEl.selectionEnd = start + 2;
        renderHighlight();
        options.onChange?.(currentValue);
      }
      return;
    }

    if (readOnly) return;

    // 6. Smart auto-indent on `Enter`
    if (event.key === 'Enter' && !mod && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const start = textareaEl.selectionStart ?? 0;
      const end = textareaEl.selectionEnd ?? start;
      const lineStart = currentValue.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const currentLineBefore = currentValue.slice(lineStart, start);
      const leadingSpaces = /^([ \t]*)/.exec(currentLineBefore)?.[1] ?? '';
      const trimmedBefore = currentLineBefore.trim();
      const shouldIndentExtra =
        trimmedBefore.endsWith('(') || AUTO_INDENT_CLAUSES.test(trimmedBefore);
      const nextIndent = leadingSpaces + (shouldIndentExtra ? '  ' : '');
      const insert = '\n' + nextIndent;
      currentValue = currentValue.slice(0, start) + insert + currentValue.slice(end);
      textareaEl.value = currentValue;
      const pos = start + insert.length;
      textareaEl.selectionStart = pos;
      textareaEl.selectionEnd = pos;
      renderHighlight();
      options.onChange?.(currentValue);
      return;
    }

    // 7. Bracket & quote auto-pairing (`()`, `''`, `""`)
    if (!mod && !event.altKey && event.key in PAIR_MAP) {
      const openChar = event.key;
      const closeChar = PAIR_MAP[openChar];
      const start = textareaEl.selectionStart ?? 0;
      const end = textareaEl.selectionEnd ?? start;
      if (end > start) {
        event.preventDefault();
        const selected = currentValue.slice(start, end);
        currentValue = currentValue.slice(0, start) + openChar + selected + closeChar + currentValue.slice(end);
        textareaEl.value = currentValue;
        textareaEl.selectionStart = start + 1;
        textareaEl.selectionEnd = end + 1;
        renderHighlight();
        options.onChange?.(currentValue);
        return;
      }
      // Skip over closing quote/paren if already right ahead
      if ((openChar === '\'' || openChar === '"') && currentValue[start] === closeChar) {
        event.preventDefault();
        textareaEl.selectionStart = start + 1;
        textareaEl.selectionEnd = start + 1;
        return;
      }
      const nextCh = currentValue[start] ?? '';
      if (!nextCh || /[\s),;]/.test(nextCh)) {
        event.preventDefault();
        currentValue = currentValue.slice(0, start) + openChar + closeChar + currentValue.slice(end);
        textareaEl.value = currentValue;
        textareaEl.selectionStart = start + 1;
        textareaEl.selectionEnd = start + 1;
        renderHighlight();
        options.onChange?.(currentValue);
        return;
      }
    }

    if (event.key === ')' && !mod && !event.altKey) {
      const start = textareaEl.selectionStart ?? 0;
      const end = textareaEl.selectionEnd ?? start;
      if (start === end && currentValue[start] === ')') {
        event.preventDefault();
        textareaEl.selectionStart = start + 1;
        textareaEl.selectionEnd = start + 1;
      }
    }
  });

  // Initial render
  applyResolvedTheme();
  renderHighlight();
  renderDiagnosticsBanner();

  const instance: SqlEditorInstance = {
    getValue(): string {
      return currentValue;
    },

    setValue(sql: string): void {
      currentValue = String(sql ?? '');
      textareaEl.value = currentValue;
      closeCompletions();
      renderHighlight();
    },

    getSelection(): string {
      const start = textareaEl.selectionStart ?? 0;
      const end = textareaEl.selectionEnd ?? 0;
      return end > start ? currentValue.slice(start, end) : '';
    },

    insertAtCursor(text: string): void {
      if (readOnly) return;
      const ins = String(text ?? '');
      const start = textareaEl.selectionStart ?? currentValue.length;
      const end = textareaEl.selectionEnd ?? start;
      currentValue = currentValue.slice(0, start) + ins + currentValue.slice(end);
      textareaEl.value = currentValue;
      const nextPos = start + ins.length;
      textareaEl.selectionStart = nextPos;
      textareaEl.selectionEnd = nextPos;
      renderHighlight();
      options.onChange?.(currentValue);
      textareaEl.focus();
    },

    format(): string {
      const formatted = formatSql(currentValue, { dialect, indent: 2, keywordCase: 'upper' });
      currentValue = formatted;
      textareaEl.value = formatted;
      closeCompletions();
      renderHighlight();
      options.onFormat?.(formatted);
      options.onChange?.(formatted);
      return formatted;
    },

    setDialect(nextDialect: SqlDialect): void {
      dialect = nextDialect === 'sqlite' ? 'sqlite' : 'postgres';
      if (dialectPillEl) {
        dialectPillEl.textContent = dialect === 'postgres' ? 'PostgreSQL 18' : 'SQLite 3';
      }
      renderHighlight();
    },

    getDialect(): SqlDialect {
      return dialect;
    },

    setSchema(nextSchema: SqlSchema | null): void {
      schema = nextSchema;
      if (nextSchema?.dialect) {
        instance.setDialect(nextSchema.dialect);
      }
    },

    getSchema(): SqlSchema | null {
      return schema;
    },

    setDiagnostics(nextDiagnostics: readonly SqlDiagnostic[]): void {
      diagnostics = Array.from(nextDiagnostics);
      renderHighlight();
      renderDiagnosticsBanner();
    },

    clearDiagnostics(): void {
      diagnostics = [];
      renderHighlight();
      renderDiagnosticsBanner();
    },

    getDiagnostics(): readonly SqlDiagnostic[] {
      return diagnostics.slice();
    },

    setTheme(nextTheme: SqlThemeMode): void {
      theme = nextTheme;
      applyResolvedTheme();
    },

    getTheme(): SqlThemeMode {
      return theme;
    },

    setReadOnly(nextReadOnly: boolean): void {
      readOnly = Boolean(nextReadOnly);
      textareaEl.readOnly = readOnly;
      if (readOnly) {
        textareaEl.setAttribute('aria-readonly', 'true');
        closeCompletions();
      } else {
        textareaEl.removeAttribute('aria-readonly');
      }
    },

    focus(): void {
      textareaEl.focus();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const fn of cleanups) {
        fn();
      }
      cleanups.length = 0;
      containerEl.innerHTML = '';
    },

    slots: {
      header: headerSlot,
      footer: footerSlot,
      results: resultsSlot
    }
  };

  return instance;
}
