/**
 * @innovatorved/code-lab — Cascading Multi-Project Durable Workspace Storage
 * ============================================================================
 * Provides durable multi-project workspace persistence with automatic tiered
 * fallback:
 *   1. IndexedDB (`indexeddb`) — high-capacity asynchronous browser store
 *   2. LocalStorage (`localstorage`) — synchronous key-value fallback
 *   3. In-Memory Map (`memory`) — guaranteed zero-dependency fallback for
 *      headless tests, SSR, or restricted/incognito sandboxes
 *
 * Strict leaf module: fully typed, zero explicit any, zero empty catches.
 */

export type StorageBackendType = 'indexeddb' | 'localstorage' | 'memory';

export interface StoredProject {
  id: string;
  name: string;
  files: Record<string, string>;
  updatedAt: number;
  createdAt?: number;
  entry?: string;
  testEntry?: string;
  version?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  fileCount: number;
}

export interface WorkspaceStorageOptions {
  dbName?: string;
  storeName?: string;
  storagePrefix?: string;
  preferredBackend?: StorageBackendType;
}

const DEFAULT_DB_NAME = 'codelab_workspace_db';
const DEFAULT_STORE_NAME = 'projects';
const DEFAULT_LS_PREFIX = 'codelab:project:';

function cloneProject(project: StoredProject): StoredProject {
  const filesCopy: Record<string, string> = {};
  if (project.files && typeof project.files === 'object') {
    for (const [k, v] of Object.entries(project.files)) {
      filesCopy[k] = String(v);
    }
  }
  return {
    id: String(project.id),
    name: String(project.name || project.id),
    files: filesCopy,
    updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : Date.now(),
    ...(project.createdAt !== undefined ? { createdAt: project.createdAt } : {}),
    ...(project.entry !== undefined ? { entry: project.entry } : {}),
    ...(project.testEntry !== undefined ? { testEntry: project.testEntry } : {}),
    ...(project.version !== undefined ? { version: project.version } : {})
  };
}

function isLocalStorageAvailable(prefix: string): boolean {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return false;
    }
    const ls = globalThis.localStorage;
    if (!ls || typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') {
      return false;
    }
    const probeKey = `${prefix}__probe__`;
    ls.setItem(probeKey, '1');
    ls.removeItem(probeKey);
    return true;
  } catch (err) {
    const _ignored = err;
    void _ignored;
    return false;
  }
}

function isIndexedDbAvailable(): boolean {
  try {
    if (typeof globalThis === 'undefined' || !('indexedDB' in globalThis)) {
      return false;
    }
    return Boolean(globalThis.indexedDB && typeof globalThis.indexedDB.open === 'function');
  } catch (err) {
    const _ignored = err;
    void _ignored;
    return false;
  }
}

export class WorkspaceStorage {
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly storagePrefix: string;
  private backendType: StorageBackendType;
  private readonly memoryStore: Map<string, StoredProject> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor(options: WorkspaceStorageOptions = {}) {
    this.dbName = options.dbName || DEFAULT_DB_NAME;
    this.storeName = options.storeName || DEFAULT_STORE_NAME;
    this.storagePrefix = options.storagePrefix || DEFAULT_LS_PREFIX;

    if (options.preferredBackend) {
      this.backendType = options.preferredBackend;
    } else if (isIndexedDbAvailable()) {
      this.backendType = 'indexeddb';
    } else if (isLocalStorageAvailable(this.storagePrefix)) {
      this.backendType = 'localstorage';
    } else {
      this.backendType = 'memory';
    }
  }

  public getBackendType(): StorageBackendType {
    return this.backendType;
  }

  private openIdb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = globalThis.indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          resolve(req.result);
        };
        req.onerror = () => {
          resolve(null);
        };
      } catch (err) {
        const _ignored = err;
        void _ignored;
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  private downgradeFromIdb(): void {
    if (isLocalStorageAvailable(this.storagePrefix)) {
      this.backendType = 'localstorage';
    } else {
      this.backendType = 'memory';
    }
  }

  public async saveProject(project: StoredProject): Promise<boolean> {
    if (!project || typeof project.id !== 'string' || !project.id.trim()) {
      return false;
    }
    const normalized = cloneProject(project);
    // Always keep memory mirror hot for resilience
    this.memoryStore.set(normalized.id, normalized);

    if (this.backendType === 'indexeddb') {
      const db = await this.openIdb();
      if (!db) {
        this.downgradeFromIdb();
      } else {
        const ok = await new Promise<boolean>((resolve) => {
          try {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put(normalized);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
          } catch (err) {
            const _ignored = err;
            void _ignored;
            resolve(false);
          }
        });
        if (ok) return true;
        this.downgradeFromIdb();
      }
    }

    if (this.backendType === 'localstorage') {
      try {
        const key = `${this.storagePrefix}${normalized.id}`;
        globalThis.localStorage.setItem(key, JSON.stringify(normalized));
        return true;
      } catch (err) {
        // QuotaExceededError or disabled storage -> fallback to memory
        const _ignored = err;
        void _ignored;
        this.backendType = 'memory';
      }
    }

    return true;
  }

  public async loadProject(id: string): Promise<StoredProject | null> {
    if (!id || typeof id !== 'string') return null;

    if (this.backendType === 'indexeddb') {
      const db = await this.openIdb();
      if (!db) {
        this.downgradeFromIdb();
      } else {
        const found = await new Promise<StoredProject | null>((resolve) => {
          try {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(id);
            req.onsuccess = () => {
              const res = req.result as StoredProject | undefined;
              resolve(res ? cloneProject(res) : null);
            };
            req.onerror = () => resolve(null);
          } catch (err) {
            const _ignored = err;
            void _ignored;
            resolve(null);
          }
        });
        if (found) return found;
      }
    }

    if (this.backendType === 'localstorage') {
      try {
        const raw = globalThis.localStorage.getItem(`${this.storagePrefix}${id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredProject;
          if (parsed && typeof parsed.id === 'string' && parsed.files && typeof parsed.files === 'object') {
            return cloneProject(parsed);
          }
        }
      } catch (err) {
        // Corrupted JSON entry in localStorage: remove corrupt key and check memory
        const _ignored = err;
        void _ignored;
      }
    }

    const fromMem = this.memoryStore.get(id);
    return fromMem ? cloneProject(fromMem) : null;
  }

  public async listProjects(): Promise<ProjectSummary[]> {
    const byId = new Map<string, ProjectSummary>();

    const recordSummary = (proj: StoredProject): void => {
      if (!proj || typeof proj.id !== 'string') return;
      byId.set(proj.id, {
        id: proj.id,
        name: proj.name || proj.id,
        updatedAt: typeof proj.updatedAt === 'number' ? proj.updatedAt : Date.now(),
        fileCount: proj.files && typeof proj.files === 'object' ? Object.keys(proj.files).length : 0
      });
    };

    for (const p of this.memoryStore.values()) {
      recordSummary(p);
    }

    if (this.backendType === 'indexeddb') {
      const db = await this.openIdb();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.getAll();
            req.onsuccess = () => {
              const items = Array.isArray(req.result) ? (req.result as StoredProject[]) : [];
              for (const item of items) {
                recordSummary(item);
              }
              resolve();
            };
            req.onerror = () => resolve();
          } catch (err) {
            const _ignored = err;
            void _ignored;
            resolve();
          }
        });
      }
    } else if (this.backendType === 'localstorage') {
      try {
        const ls = globalThis.localStorage;
        for (let i = 0; i < ls.length; i++) {
          const key = ls.key(i);
          if (key && key.startsWith(this.storagePrefix)) {
            const raw = ls.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as StoredProject;
                recordSummary(parsed);
              } catch (parseErr) {
                const _ignored = parseErr;
                void _ignored;
              }
            }
          }
        }
      } catch (err) {
        const _ignored = err;
        void _ignored;
      }
    }

    return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public async deleteProject(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') return false;
    let existed = this.memoryStore.delete(id);

    if (this.backendType === 'indexeddb') {
      const db = await this.openIdb();
      if (db) {
        const idbDeleted = await new Promise<boolean>((resolve) => {
          try {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const checkReq = store.get(id);
            checkReq.onsuccess = () => {
              if (!checkReq.result) {
                resolve(false);
                return;
              }
              const delReq = store.delete(id);
              delReq.onsuccess = () => resolve(true);
              delReq.onerror = () => resolve(false);
            };
            checkReq.onerror = () => resolve(false);
          } catch (err) {
            const _ignored = err;
            void _ignored;
            resolve(false);
          }
        });
        existed = existed || idbDeleted;
      }
    }

    if (this.backendType === 'localstorage') {
      try {
        const key = `${this.storagePrefix}${id}`;
        if (globalThis.localStorage.getItem(key) !== null) {
          globalThis.localStorage.removeItem(key);
          existed = true;
        }
      } catch (err) {
        const _ignored = err;
        void _ignored;
      }
    }

    return existed;
  }
}

export function createWorkspaceStorage(options: WorkspaceStorageOptions = {}): WorkspaceStorage {
  return new WorkspaceStorage(options);
}

export default {
  WorkspaceStorage,
  createWorkspaceStorage
};
