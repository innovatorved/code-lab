/**
 * @innovatorved/code-lab — Explorer File Tree & CRUD Utilities
 */

import { CL_ICONS } from './icons';

export interface FileNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  children: FileNode[];
}

export function buildFileHierarchy(files: Record<string, string>, creatingItem?: any): FileNode {
  const root: FileNode = { name: '', fullPath: '', isFolder: true, children: [] };

  const paths = Object.keys(files).sort();
  for (const p of paths) {
    const parts = p.split('/').filter(Boolean);
    let curr = root;
    let accPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accPath = accPath ? `${accPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let child = curr.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullPath: accPath,
          isFolder: !isLast,
          children: []
        };
        curr.children.push(child);
      }
      curr = child;
    }
  }

  return root;
}

export function getFileIcon(filename: string): string {
  if (filename.endsWith('.json')) return CL_ICONS.database;
  if (filename.endsWith('.md')) return CL_ICONS.book;
  if (filename.endsWith('.cpp') || filename.endsWith('.hpp') || filename.endsWith('.h')) return CL_ICONS.code;
  if (filename.endsWith('.py')) return CL_ICONS.code;
  return CL_ICONS.file;
}
