/**
 * @innovatorved/code-lab — Workbench Subsystem Entrypoint
 */

export * from './icons';
export * from './diff-editor';
export * from './command-palette';
export * from './share';
export * from './editor';
export * from './xterm-adapter';
export * from './intellisense';

import * as icons from './icons';
import * as diffEditor from './diff-editor';
import * as commandPalette from './command-palette';
import * as share from './share';
import * as editor from './editor';
import * as xtermAdapter from './xterm-adapter';
import * as intellisense from './intellisense';

export const CodeLabWorkbenchComponents = {
  ...icons,
  ...diffEditor,
  ...commandPalette,
  ...share,
  ...editor,
  ...xtermAdapter,
  ...intellisense
};
