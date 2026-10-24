/**
 * @innovatorved/code-lab — Fuzzy-Searchable Command Palette (Cmd+Shift+P / Cmd+K)
 */

import { CL_ICONS } from './icons';

export interface CommandPaletteItem {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export function getStandardWorkbenchCommands(workbench: any): CommandPaletteItem[] {
  const isGuided = Boolean(workbench.hasGuidedLab && workbench.mode === 'guided');

  return [
    {
      id: 'run-code',
      label: isGuided ? 'CodeLab: Verify Current Guided Step' : 'CodeLab: Run Active Code / Demo',
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
      label: 'CodeLab: Run Unit Tests',
      shortcut: '⌘↵',
      action: () => workbench.runTests()
    },
    {
      id: 'format-document',
      label: 'Format: Format Active Document',
      shortcut: '⇧⌥F',
      action: () => workbench.formatActiveDocument()
    },
    {
      id: 'share-snapshot',
      label: 'Share: Copy URL Snapshot to Clipboard (#codelab=...)',
      action: () => workbench.shareSnapshot()
    },
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
      id: 'open-stdin',
      label: 'View: Open Stdin / Custom Input Panel',
      action: () => {
        workbench.drawerTab = 'stdin';
        if (typeof workbench._renderDrawerBody === 'function') workbench._renderDrawerBody();
        const drawer = workbench.container?.querySelector('#cl-drawer');
        if (drawer) drawer.classList.remove('is-minimized');
      }
    },
    {
      id: 'open-problems',
      label: 'View: Show Problems & Diagnostics',
      action: () => {
        workbench.drawerTab = 'problems';
        if (typeof workbench._renderDrawerBody === 'function') workbench._renderDrawerBody();
        const drawer = workbench.container?.querySelector('#cl-drawer');
        if (drawer) drawer.classList.remove('is-minimized');
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
      action: () => { if (workbench.activeFile) workbench.startInlineRename('file', workbench.activeFile); }
    },
    {
      id: 'delete-active',
      label: 'File: Delete Active File',
      action: () => { if (workbench.activeFile) workbench.deleteFile(workbench.activeFile); }
    },
    {
      id: 'export-workspace-zip',
      label: 'Workspace: Export Project as ZIP Archive',
      action: () => workbench.exportProjectZip({ download: true })
    },
    {
      id: 'export-workspace-json',
      label: 'Workspace: Export Workspace as JSON',
      action: () => workbench.exportWorkspace({ download: true })
    },
    {
      id: 'switch-lang',
      label: 'Language: Cycle Active Language (JS / TS / C++ / PY)',
      action: () => {
        const order = ['js'];
        if (workbench.enabledLanguages?.has('ts')) order.push('ts');
        if (workbench.enabledLanguages?.has('cpp')) order.push('cpp');
        if (workbench.enabledLanguages?.has('py')) order.push('py');
        const next = order[(order.indexOf(workbench.lang) + 1) % order.length] || 'js';
        workbench.setLanguage(next);
      }
    },
    {
      id: 'toggle-fullscreen',
      label: 'View: Toggle Fullscreen Workbench',
      action: () => workbench.toggleFullscreen()
    },
    {
      id: 'search-workspace',
      label: 'Search: Find & Replace Across Files...',
      shortcut: '⇧⌘F',
      action: () => workbench.showSearchModal()
    },
    {
      id: 'open-scm',
      label: 'Git: Source Control (Status, Stage & Commit)...',
      action: () => workbench.showScmModal()
    }
  ];
}
