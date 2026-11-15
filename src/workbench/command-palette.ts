/**
 * @innovatorved/code-lab — VS Code Quick Open & Fuzzy Command Palette (Cmd+P / Cmd+Shift+P / F1)
 */

export interface CommandPaletteItem {
  id: string;
  label: string;
  category?: string;
  detail?: string;
  shortcut?: string;
  action: () => void;
}

export interface FuzzyMatchResult {
  score: number;
  indices: number[];
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * VS Code-style subsequence fuzzy matcher with bonuses for consecutive matches,
 * word-boundary / camelCase transitions, and prefix alignment.
 */
export function fuzzyScoreText(query: string, candidate: string): FuzzyMatchResult | null {
  const q = String(query || '').trim();
  const text = String(candidate || '');
  if (!q) return { score: 1, indices: [] };
  if (!text) return null;

  const qLower = q.toLowerCase();
  const tLower = text.toLowerCase();

  const indices: number[] = [];
  let qi = 0;
  let score = 0;
  let prevMatchIdx = -2;

  for (let ti = 0; ti < text.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      indices.push(ti);
      score += 10;

      // Consecutive match bonus
      if (ti === prevMatchIdx + 1) {
        score += 14;
      }
      // Prefix match bonus
      if (ti === 0) {
        score += 18;
      } else {
        const prev = text[ti - 1];
        const curr = text[ti];
        // Path separator / word boundary / camelCase transition bonus
        if (prev === '/' || prev === '-' || prev === '_' || prev === ' ' || prev === ':' || prev === '.') {
          score += 12;
        } else if (prev >= 'a' && prev <= 'z' && curr >= 'A' && curr <= 'Z') {
          score += 10;
        }
      }

      prevMatchIdx = ti;
      qi++;
    }
  }

  if (qi < qLower.length) return null;

  // Slightly prefer shorter, tighter matches
  score -= Math.min(20, Math.floor((text.length - q.length) * 0.25));
  return { score, indices };
}

/**
 * Renders HTML with `<mark class="codelab-palette-hl">` around matched subsequence characters.
 */
export function renderHighlightedText(text: string, indices: number[]): string {
  if (!indices || indices.length === 0) return escapeHtml(text);
  const matchSet = new Set(indices);
  let html = '';
  let inMark = false;
  for (let i = 0; i < text.length; i++) {
    const isHit = matchSet.has(i);
    if (isHit && !inMark) {
      html += '<mark class="codelab-palette-hl">';
      inMark = true;
    } else if (!isHit && inMark) {
      html += '</mark>';
      inMark = false;
    }
    html += escapeHtml(text[i]);
  }
  if (inMark) html += '</mark>';
  return html;
}

export function getStandardWorkbenchCommands(workbench: any): CommandPaletteItem[] {
  const isGuided = Boolean(workbench.hasGuidedLab && workbench.mode === 'guided');

  const commands: CommandPaletteItem[] = [
    {
      id: 'run-code',
      label: isGuided ? 'CodeLab: Verify Current Guided Step' : 'Run: Run Active File',
      shortcut: '⌘↵',
      action: () => {
        if (isGuided) workbench.verifyCurrentStep();
        else workbench.runCode();
      }
    },
    {
      id: 'run-demo',
      label: 'CodeLab: Run Demo Script',
      shortcut: '⇧⌘↵',
      action: () => workbench.runDemo()
    },
    {
      id: 'run-tests',
      label: 'Test: Run Unit Tests',
      shortcut: '⌘↵',
      action: () => workbench.runTests()
    },
    {
      id: 'format-document',
      label: 'Format Document',
      category: 'Editor',
      shortcut: '⇧⌥F',
      action: () => workbench.formatActiveDocument()
    },
    {
      id: 'view-toggle-panel',
      label: 'View: Toggle Panel',
      shortcut: '⌘J',
      action: () => {
        if (typeof workbench.togglePanel === 'function') workbench.togglePanel();
        else if (typeof workbench.setPanelVisible === 'function') workbench.setPanelVisible(Boolean(workbench._panelCollapsed));
      }
    },
    {
      id: 'view-toggle-terminal',
      label: 'View: Toggle Terminal',
      shortcut: '⌃`',
      action: () => {
        if (typeof workbench.toggleTerminalPanel === 'function') workbench.toggleTerminalPanel();
        else if (typeof workbench.togglePanel === 'function') workbench.togglePanel('terminal');
      }
    },
    {
      id: 'view-toggle-sidebar',
      label: 'View: Toggle Primary Side Bar',
      shortcut: '⌘B',
      action: () => {
        if (typeof workbench.togglePrimarySidebar === 'function') workbench.togglePrimarySidebar();
      }
    },
    {
      id: 'terminal-new',
      label: 'Terminal: Create New Terminal',
      shortcut: '⌃⇧`',
      action: () => {
        if (typeof workbench.createNewTerminalSession === 'function') workbench.createNewTerminalSession();
      }
    },
    {
      id: 'terminal-split',
      label: 'Terminal: Split Terminal',
      shortcut: '⌘\\',
      action: () => {
        if (typeof workbench.splitTerminalSession === 'function') workbench.splitTerminalSession();
      }
    },
    {
      id: 'terminal-clear',
      label: 'Terminal: Clear',
      action: () => {
        if (typeof workbench.clearTerminal === 'function') workbench.clearTerminal();
      }
    },
    {
      id: 'open-problems',
      label: 'View: Focus Problems (Errors, Warnings)',
      shortcut: '⇧⌘M',
      action: () => {
        workbench.drawerTab = 'problems';
        if (typeof workbench.setPanelVisible === 'function') workbench.setPanelVisible(true);
        if (typeof workbench._renderDrawerBody === 'function') workbench._renderDrawerBody();
      }
    },
    {
      id: 'open-stdin',
      label: 'View: Open Output / Stdin Panel',
      action: () => {
        workbench.drawerTab = 'stdin';
        if (typeof workbench.setPanelVisible === 'function') workbench.setPanelVisible(true);
        if (typeof workbench._renderDrawerBody === 'function') workbench._renderDrawerBody();
      }
    },
    {
      id: 'new-file',
      label: 'File: New File...',
      action: () => workbench.startInlineCreate('file', '')
    },
    {
      id: 'new-folder',
      label: 'File: New Folder...',
      action: () => workbench.startInlineCreate('folder', '')
    },
    {
      id: 'rename-active',
      label: 'File: Rename Active File...',
      shortcut: 'F2',
      action: () => {
        if (workbench.activeFile && workbench.activeFile !== '__welcome__') {
          workbench.startInlineRename('file', workbench.activeFile);
        }
      }
    },
    {
      id: 'delete-active',
      label: 'File: Delete Active File',
      action: () => {
        if (workbench.activeFile && workbench.activeFile !== '__welcome__') {
          workbench.deleteFile(workbench.activeFile);
        }
      }
    },
    {
      id: 'open-welcome',
      label: 'Help: Welcome',
      action: () => {
        if (typeof workbench.openWelcomeTab === 'function') workbench.openWelcomeTab();
      }
    },
    {
      id: 'open-settings',
      label: 'Preferences: Open Settings (UI)',
      shortcut: '⌘,',
      action: () => {
        if (typeof workbench.openSettingsView === 'function') workbench.openSettingsView();
        else if (typeof workbench.showSettingsModal === 'function') workbench.showSettingsModal();
      }
    },
    {
      id: 'toggle-theme',
      label: 'Preferences: Cycle Color Theme (Dark Modern / Light Modern / High Contrast)',
      action: () => {
        const order = ['dark', 'light', 'high-contrast'];
        const cur = typeof workbench._resolvedTheme === 'function' ? workbench._resolvedTheme() : workbench.theme;
        const next = order[(order.indexOf(cur) + 1) % order.length] || 'dark';
        if (typeof workbench.setTheme === 'function') workbench.setTheme(next);
      }
    },
    {
      id: 'search-workspace',
      label: 'Search: Find in Files',
      shortcut: '⇧⌘F',
      action: () => workbench.showSearchModal()
    },
    {
      id: 'open-scm',
      label: 'Source Control: Focus on Source Control View',
      shortcut: '⌃⇧G',
      action: () => workbench.showScmModal()
    },
    {
      id: 'git-clone',
      label: 'Git: Clone Repository...',
      action: () => {
        if (typeof workbench.showCloneModal === 'function') workbench.showCloneModal();
      }
    },
    {
      id: 'git-stash',
      label: 'Git: Stash Changes',
      action: () => {
        if (workbench.shell && typeof workbench.shell.execute === 'function') {
          void workbench.shell.execute('git stash push').then(() => {
            if (typeof workbench._refreshGitDecorations === 'function') workbench._refreshGitDecorations();
          });
        }
      }
    },
    {
      id: 'git-stash-pop',
      label: 'Git: Pop Latest Stash',
      action: () => {
        if (workbench.shell && typeof workbench.shell.execute === 'function') {
          void workbench.shell.execute('git stash pop').then(() => {
            if (typeof workbench._syncFilesFromVfs === 'function') workbench._syncFilesFromVfs();
            if (typeof workbench._refreshGitDecorations === 'function') workbench._refreshGitDecorations();
          });
        }
      }
    },
    {
      id: 'share-snapshot',
      label: 'Share: Copy URL Snapshot to Clipboard (#codelab=...)',
      action: () => workbench.shareSnapshot()
    },
    {
      id: 'export-workspace-zip',
      label: 'File: Download Workspace as ZIP Archive',
      action: () => workbench.exportProjectZip({ download: true })
    },
    {
      id: 'export-workspace-json',
      label: 'File: Export Workspace as JSON',
      action: () => workbench.exportWorkspace({ download: true })
    },
    {
      id: 'toggle-fullscreen',
      label: 'View: Toggle Full Screen',
      action: () => workbench.toggleFullscreen()
    }
  ];

  if (workbench.hasGuidedLab) {
    commands.push(
      {
        id: 'compare-solution',
        label: 'Diff: Compare Active File with Reference Solution',
        action: () => workbench.showDiffModal(workbench.activeFile || workbench._pickDefaultFile(), 'solution')
      },
      {
        id: 'compare-starter',
        label: 'Diff: Compare Active File with Starter Template',
        action: () => workbench.showDiffModal(workbench.activeFile || workbench._pickDefaultFile(), 'starter')
      },
      {
        id: 'switch-lang',
        label: 'Language: Cycle Active Lab Language (JS / TS / C++ / PY)',
        action: () => {
          const order = ['js'];
          if (workbench.enabledLanguages?.has('ts')) order.push('ts');
          if (workbench.enabledLanguages?.has('cpp')) order.push('cpp');
          if (workbench.enabledLanguages?.has('py')) order.push('py');
          const next = order[(order.indexOf(workbench.lang) + 1) % order.length] || 'js';
          workbench.setLanguage(next);
        }
      }
    );
  }

  // Merge live Monaco editor actions (`Rename Symbol`, `Go to References`, `Change All Occurrences`, `Fold All`, etc.)
  const editor = workbench.editor;
  if (editor && typeof editor.getSupportedActions === 'function') {
    try {
      const existingLabels = new Set(commands.map((c) => c.label.toLowerCase()));
      const actions = editor.getSupportedActions() || [];
      for (const act of actions) {
        if (!act || !act.id || !act.label) continue;
        if (typeof act.isSupported === 'function' && !act.isSupported()) continue;
        const label = `Editor: ${act.label}`;
        if (existingLabels.has(label.toLowerCase()) || existingLabels.has(String(act.label).toLowerCase())) continue;
        existingLabels.add(label.toLowerCase());
        commands.push({
          id: `monaco:${act.id}`,
          label,
          action: () => {
            try {
              editor.focus?.();
              void act.run();
            } catch (_err) {
              void _err;
            }
          }
        });
      }
    } catch (_err) {
      void _err;
    }
  }

  return commands;
}
