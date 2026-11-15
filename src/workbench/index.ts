/**
 * @innovatorved/code-lab — Workbench Subsystem Entrypoint
 */

export * from './icons';
export * from './styles';
export * from './toolbar';
export * from './drawer';
export * from './diff-editor';
export * from './command-palette';
export * from './share';
export * from './file-tree';
export * from './editor';
export * from './guided-pane';
export * from './xterm-adapter';
export * from './intellisense';

import * as icons from './icons';
import * as styles from './styles';
import * as toolbar from './toolbar';
import * as drawer from './drawer';
import * as diffEditor from './diff-editor';
import * as commandPalette from './command-palette';
import * as share from './share';
import * as fileTree from './file-tree';
import * as editor from './editor';
import * as guidedPane from './guided-pane';
import * as xtermAdapter from './xterm-adapter';
import * as intellisense from './intellisense';

export const CodeLabWorkbenchComponents = {
  ...icons,
  ...styles,
  ...toolbar,
  ...drawer,
  ...diffEditor,
  ...commandPalette,
  ...share,
  ...fileTree,
  ...editor,
  ...guidedPane,
  ...xtermAdapter,
  ...intellisense
};
