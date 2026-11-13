import { createServiceId, type Event, type IDisposable } from '@code-lab/core';

export type FsEntryKind = 'file' | 'directory';

export interface FsStat {
  readonly kind: FsEntryKind;
  readonly size: number;
  readonly mtimeMs: number;
}

export interface FsChangeEvent {
  readonly type: 'created' | 'updated' | 'deleted' | 'renamed';
  readonly path: string;
  readonly oldPath?: string;
}

export interface IFsBackend {
  readonly name: 'memory' | 'indexeddb' | 'opfs';
  loadAll(): Promise<Map<string, Uint8Array>>;
  writeEntry(path: string, bytes: Uint8Array): Promise<void>;
  deleteEntry(path: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IFileSystemService extends IDisposable {
  readonly backendName: string;
  readonly onDidChangeFile: Event<FsChangeEvent>;
  hydrate(): Promise<void>;
  exists(path: string): boolean;
  stat(path: string): FsStat;
  readFile(path: string): string;
  readFileBytes(path: string): Uint8Array;
  writeFile(path: string, content: string | Uint8Array): void;
  deleteFile(path: string, options?: { recursive?: boolean }): void;
  rename(oldPath: string, newPath: string): void;
  mkdir(path: string): void;
  readdir(path: string): string[];
  toRecord(prefix?: string): Record<string, string>;
  loadRecord(files: Readonly<Record<string, string>>, prefix?: string): void;
  flush(): Promise<void>;
  switchBackend(backend: IFsBackend): Promise<void>;
}

export const IFileSystemServiceId = createServiceId<IFileSystemService>('code-lab.fs');
