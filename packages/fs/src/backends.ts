import { PosixPath } from '@code-lab/core';
import type { IFsBackend } from './types';

export class MemoryBackend implements IFsBackend {
  public readonly name = 'memory' as const;
  private readonly store = new Map<string, Uint8Array>();

  public constructor(initial?: Readonly<Record<string, string | Uint8Array>>) {
    if (initial) {
      const encoder = new TextEncoder();
      for (const [rawPath, data] of Object.entries(initial)) {
        const clean = PosixPath.normalize(rawPath.startsWith('/') ? rawPath : '/' + rawPath);
        this.store.set(clean, typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data));
      }
    }
  }

  public async loadAll(): Promise<Map<string, Uint8Array>> {
    const out = new Map<string, Uint8Array>();
    for (const [k, v] of this.store.entries()) {
      out.set(k, new Uint8Array(v));
    }
    return out;
  }

  public async writeEntry(path: string, bytes: Uint8Array): Promise<void> {
    this.store.set(path, new Uint8Array(bytes));
  }

  public async deleteEntry(path: string): Promise<void> {
    this.store.delete(path);
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }
}

export class IndexedDbBackend implements IFsBackend {
  public readonly name = 'indexeddb' as const;
  private readonly dbName: string;
  private readonly storeName = 'files';
  private readonly fallback = new MemoryBackend();

  public constructor(namespace = 'codelab-vfs') {
    this.dbName = `codelab-fs-${namespace}`;
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async loadAll(): Promise<Map<string, Uint8Array>> {
    const db = await this.openDb();
    if (!db) return this.fallback.loadAll();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const out = new Map<string, Uint8Array>();
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const key = String(cursor.key);
            const val = cursor.value;
            if (val instanceof Uint8Array) {
              out.set(key, new Uint8Array(val));
            } else if (val instanceof ArrayBuffer) {
              out.set(key, new Uint8Array(val));
            } else if (typeof val === 'string') {
              out.set(key, new TextEncoder().encode(val));
            }
            cursor.continue();
          } else {
            db.close();
            resolve(out);
          }
        };
        cursorReq.onerror = () => {
          db.close();
          resolve(out);
        };
      } catch {
        db.close();
        resolve(this.fallback.loadAll());
      }
    });
  }

  public async writeEntry(path: string, bytes: Uint8Array): Promise<void> {
    await this.fallback.writeEntry(path, bytes);
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(new Uint8Array(bytes), path);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  public async deleteEntry(path: string): Promise<void> {
    await this.fallback.deleteEntry(path);
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(path);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }

  public async clear(): Promise<void> {
    await this.fallback.clear();
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }
}

interface OpfsWritable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

interface OpfsFileHandle {
  readonly kind: 'file';
  getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
  createWritable(): Promise<OpfsWritable>;
}

interface OpfsDirectoryHandle {
  readonly kind: 'directory';
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterableIterator<[string, OpfsDirectoryHandle | OpfsFileHandle]>;
}

export class OpfsBackend implements IFsBackend {
  public readonly name = 'opfs' as const;
  public lastError: unknown = null;
  private readonly rootDirName: string;
  private readonly fallback = new MemoryBackend();
  private readonly onError?: (err: unknown) => void;

  public constructor(namespace = 'codelab', options: { onError?: (err: unknown) => void } = {}) {
    this.rootDirName = `codelab-${namespace}`;
    this.onError = options.onError;
  }

  private async getNamespaceRoot(): Promise<OpfsDirectoryHandle | null> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage ||
      typeof navigator.storage.getDirectory !== 'function'
    ) {
      return null;
    }
    try {
      const root = (await navigator.storage.getDirectory()) as unknown as OpfsDirectoryHandle;
      return await root.getDirectoryHandle(this.rootDirName, { create: true });
    } catch {
      return null;
    }
  }

  public async loadAll(): Promise<Map<string, Uint8Array>> {
    const root = await this.getNamespaceRoot();
    if (!root) return this.fallback.loadAll();
    const out = new Map<string, Uint8Array>();
    const walk = async (dir: OpfsDirectoryHandle, prefix: string): Promise<void> => {
      for await (const [name, handle] of dir.entries()) {
        const full = `${prefix}/${name}`;
        if (handle.kind === 'directory') {
          await walk(handle, full);
        } else {
          const file = await handle.getFile();
          const buf = await file.arrayBuffer();
          out.set(full, new Uint8Array(buf));
        }
      }
    };
    try {
      await walk(root, '');
      return out;
    } catch {
      return this.fallback.loadAll();
    }
  }

  public async writeEntry(path: string, bytes: Uint8Array): Promise<void> {
    await this.fallback.writeEntry(path, bytes);
    const root = await this.getNamespaceRoot();
    if (!root) return;
    try {
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 0) return;
      let dir = root;
      for (let i = 0; i < segments.length - 1; i++) {
        dir = await dir.getDirectoryHandle(segments[i], { create: true });
      }
      const fileHandle = await dir.getFileHandle(segments[segments.length - 1], { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
    } catch (err) {
      this.lastError = err;
      this.onError?.(err);
    }
  }

  public async deleteEntry(path: string): Promise<void> {
    await this.fallback.deleteEntry(path);
    const root = await this.getNamespaceRoot();
    if (!root) return;
    try {
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 0) return;
      let dir = root;
      for (let i = 0; i < segments.length - 1; i++) {
        dir = await dir.getDirectoryHandle(segments[i]);
      }
      await dir.removeEntry(segments[segments.length - 1], { recursive: true });
    } catch (err) {
      this.lastError = err;
      this.onError?.(err);
    }
  }

  public async clear(): Promise<void> {
    await this.fallback.clear();
    const root = await this.getNamespaceRoot();
    if (!root) return;
    try {
      for await (const [name] of root.entries()) {
        await root.removeEntry(name, { recursive: true });
      }
    } catch (err) {
      this.lastError = err;
      this.onError?.(err);
    }
  }
}
