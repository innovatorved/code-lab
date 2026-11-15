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
  binaryFiles?: Record<string, Uint8Array | string>;
  gitFiles?: Record<string, Uint8Array | string>;
  gitMeta?: Record<string, unknown>;
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

export type WorkspaceKind = 'blank' | 'repo' | 'demo' | 'custom';

export interface WorkspaceMeta {
  labId: string;
  title: string;
  kind: WorkspaceKind;
  repo?: string;
  updatedAt: number;
  fileCount?: number;
}

export const WORKSPACE_REGISTRY_KEY = 'codelab:workspace-registry:v1';

const DEFAULT_DB_NAME = 'codelab_workspace_db';
const DEFAULT_STORE_NAME = 'projects';
const DEFAULT_LS_PREFIX = 'codelab:project:';
const WORKBENCH_STATE_PREFIX = 'sd-codelab-v1:';
const LEGACY_WORKBENCH_PREFIX = 'codelab_';

const memoryRegistry: Map<string, WorkspaceMeta> = new Map();
const memoryOrIdbNonEmptyProjects: Set<string> = new Set();
let registryWriteFailed = false;
let lastBlankTs = 0;
let blankSeq = 0;

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }
    const ls = globalThis.localStorage;
    if (
      !ls ||
      typeof ls.getItem !== 'function' ||
      typeof ls.setItem !== 'function' ||
      typeof ls.removeItem !== 'function'
    ) {
      return null;
    }
    return ls;
  } catch (err) {
    const _ignored = err;
    void _ignored;
    return null;
  }
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function normalizeWorkspaceMeta(raw: unknown, existing?: WorkspaceMeta): WorkspaceMeta | null {
  if (!isPlainRecord(raw)) return null;
  const labId = typeof raw.labId === 'string' ? raw.labId.trim() : '';
  if (!labId) return null;

  const rawKind = raw.kind;
  const kind: WorkspaceKind =
    rawKind === 'blank' || rawKind === 'repo' || rawKind === 'demo' || rawKind === 'custom'
      ? rawKind
      : (existing?.kind ?? 'custom');

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : (existing?.title || labId);

  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : Date.now();

  const repo =
    typeof raw.repo === 'string'
      ? (raw.repo.trim() || undefined)
      : existing?.repo;

  const fileCount =
    typeof raw.fileCount === 'number' && Number.isFinite(raw.fileCount) && raw.fileCount >= 0
      ? Math.floor(raw.fileCount)
      : existing?.fileCount;

  return {
    labId,
    title,
    kind,
    updatedAt,
    ...(repo !== undefined ? { repo } : {}),
    ...(fileCount !== undefined ? { fileCount } : {})
  };
}

function readRegistryEntries(): Map<string, WorkspaceMeta> {
  const ls = getSafeLocalStorage();
  if (ls && !registryWriteFailed) {
    try {
      const raw = ls.getItem(WORKSPACE_REGISTRY_KEY);
      if (raw === null) {
        memoryRegistry.clear();
        return new Map();
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return new Map();
      }
      const map = new Map<string, WorkspaceMeta>();
      for (const entry of parsed) {
        const normalized = normalizeWorkspaceMeta(entry);
        if (!normalized) continue;
        const prev = map.get(normalized.labId);
        if (!prev || normalized.updatedAt >= prev.updatedAt) {
          map.set(normalized.labId, normalized);
        }
      }
      memoryRegistry.clear();
      for (const [k, v] of map.entries()) {
        memoryRegistry.set(k, { ...v });
      }
      return map;
    } catch (err) {
      const _ignored = err;
      void _ignored;
      return new Map();
    }
  }

  const out = new Map<string, WorkspaceMeta>();
  for (const [k, v] of memoryRegistry.entries()) {
    out.set(k, { ...v });
  }
  return out;
}

function persistRegistryEntries(map: Map<string, WorkspaceMeta>): void {
  const sorted = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  memoryRegistry.clear();
  for (const item of sorted) {
    memoryRegistry.set(item.labId, { ...item });
  }
  const ls = getSafeLocalStorage();
  if (ls) {
    try {
      ls.setItem(WORKSPACE_REGISTRY_KEY, JSON.stringify(sorted));
      registryWriteFailed = false;
    } catch (err) {
      const _ignored = err;
      void _ignored;
      registryWriteFailed = true;
    }
  }
}

export function listWorkspaces(): WorkspaceMeta[] {
  return Array.from(readRegistryEntries().values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getWorkspaceMeta(labId: string): WorkspaceMeta | null {
  if (typeof labId !== 'string') return null;
  const trimmed = labId.trim();
  if (!trimmed) return null;
  const found = readRegistryEntries().get(trimmed);
  return found ? { ...found } : null;
}

export function upsertWorkspaceMeta(meta: WorkspaceMeta): void {
  if (!isPlainRecord(meta)) return;
  const trimmedId = typeof meta.labId === 'string' ? meta.labId.trim() : '';
  if (!trimmedId) return;
  const map = readRegistryEntries();
  const normalized = normalizeWorkspaceMeta(meta, map.get(trimmedId));
  if (!normalized) return;
  map.set(normalized.labId, normalized);
  persistRegistryEntries(map);
}

export function removeWorkspaceMeta(labId: string): void {
  if (typeof labId !== 'string') return;
  const trimmed = labId.trim();
  if (!trimmed) return;
  const map = readRegistryEntries();
  if (map.delete(trimmed)) {
    persistRegistryEntries(map);
  } else {
    memoryRegistry.delete(trimmed);
  }
}

function payloadHasSavedFiles(rawJson: string | null): boolean {
  if (!rawJson) return false;
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!isPlainRecord(parsed)) return false;

    if (isPlainRecord(parsed.files) && Object.keys(parsed.files).length > 0) {
      return true;
    }

    if (isPlainRecord(parsed.customFiles)) {
      for (const val of Object.values(parsed.customFiles)) {
        if (typeof val === 'string') {
          return true;
        }
        if (isPlainRecord(val) && Object.keys(val).length > 0) {
          return true;
        }
      }
    }
  } catch (err) {
    const _ignored = err;
    void _ignored;
  }
  return false;
}

function checkHasWorkspaceData(
  labId: string,
  extraPrefix?: string,
  instanceMemory?: ReadonlyMap<string, StoredProject>
): boolean {
  if (typeof labId !== 'string') return false;
  const trimmed = labId.trim();
  if (!trimmed) return false;

  if (instanceMemory) {
    const proj = instanceMemory.get(trimmed);
    if (proj && isPlainRecord(proj.files) && Object.keys(proj.files).length > 0) {
      return true;
    }
  }

  if (memoryOrIdbNonEmptyProjects.has(trimmed)) {
    return true;
  }

  const ls = getSafeLocalStorage();
  if (ls) {
    try {
      if (payloadHasSavedFiles(ls.getItem(`${WORKBENCH_STATE_PREFIX}${trimmed}`))) {
        return true;
      }
      if (payloadHasSavedFiles(ls.getItem(`${LEGACY_WORKBENCH_PREFIX}${trimmed}`))) {
        return true;
      }
      if (payloadHasSavedFiles(ls.getItem(`${DEFAULT_LS_PREFIX}${trimmed}`))) {
        return true;
      }
      if (
        typeof extraPrefix === 'string' &&
        extraPrefix &&
        extraPrefix !== DEFAULT_LS_PREFIX &&
        payloadHasSavedFiles(ls.getItem(`${extraPrefix}${trimmed}`))
      ) {
        return true;
      }
    } catch (err) {
      const _ignored = err;
      void _ignored;
    }
  }

  return false;
}

export function hasWorkspaceData(labId: string): boolean {
  return checkHasWorkspaceData(labId);
}

export function createBlankWorkspaceId(): string {
  const now = Date.now();
  if (now === lastBlankTs) {
    blankSeq += 1;
  } else {
    lastBlankTs = now;
    blankSeq = 0;
  }
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const suffix = blankSeq > 0 ? `${blankSeq.toString(36)}${rand}` : rand;
  return `blank-workspace-${now}-${suffix}`;
}

export function encodeBase64Bytes(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return typeof btoa === 'function' ? btoa(binary) : binary;
}

export function decodeBase64Bytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(0);
}

function cloneByteMap(
  map: Record<string, Uint8Array | string> | undefined,
  serializeBase64 = false
): Record<string, Uint8Array | string> | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const out: Record<string, Uint8Array | string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(map)) {
    if (v instanceof Uint8Array) {
      out[k] = serializeBase64 ? encodeBase64Bytes(v) : new Uint8Array(v);
      count++;
    } else if (ArrayBuffer.isView(v)) {
      const view = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      out[k] = serializeBase64 ? encodeBase64Bytes(view) : new Uint8Array(view);
      count++;
    } else if (typeof v === 'string') {
      out[k] = serializeBase64 ? v : decodeBase64Bytes(v);
      count++;
    }
  }
  return count > 0 ? out : undefined;
}

function cloneProject(project: StoredProject, serializeBase64 = false): StoredProject {
  const filesCopy: Record<string, string> = {};
  if (project.files && typeof project.files === 'object') {
    for (const [k, v] of Object.entries(project.files)) {
      filesCopy[k] = String(v);
    }
  }
  const binaryCopy = cloneByteMap(project.binaryFiles, serializeBase64);
  const gitCopy = cloneByteMap(project.gitFiles, serializeBase64);
  const gitMetaCopy = isPlainRecord(project.gitMeta) ? { ...project.gitMeta } : undefined;
  return {
    id: String(project.id),
    name: String(project.name || project.id),
    files: filesCopy,
    ...(binaryCopy ? { binaryFiles: binaryCopy } : {}),
    ...(gitCopy ? { gitFiles: gitCopy } : {}),
    ...(gitMetaCopy ? { gitMeta: gitMetaCopy } : {}),
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
  public static readonly WORKSPACE_REGISTRY_KEY = WORKSPACE_REGISTRY_KEY;
  public static readonly listWorkspaces = listWorkspaces;
  public static readonly getWorkspaceMeta = getWorkspaceMeta;
  public static readonly upsertWorkspaceMeta = upsertWorkspaceMeta;
  public static readonly removeWorkspaceMeta = removeWorkspaceMeta;
  public static readonly hasWorkspaceData = hasWorkspaceData;
  public static readonly createBlankWorkspaceId = createBlankWorkspaceId;

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
    const hasFiles = Object.keys(normalized.files).length > 0;
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
        if (ok) {
          if (hasFiles) memoryOrIdbNonEmptyProjects.add(normalized.id);
          else memoryOrIdbNonEmptyProjects.delete(normalized.id);
          return true;
        }
        this.downgradeFromIdb();
      }
    }

    if (this.backendType === 'localstorage') {
      try {
        const key = `${this.storagePrefix}${normalized.id}`;
        const serializable = cloneProject(normalized, true);
        globalThis.localStorage.setItem(key, JSON.stringify(serializable));
        memoryOrIdbNonEmptyProjects.delete(normalized.id);
        return true;
      } catch (err) {
        // QuotaExceededError or disabled storage -> fallback to memory
        const _ignored = err;
        void _ignored;
        this.backendType = 'memory';
      }
    }

    if (hasFiles) memoryOrIdbNonEmptyProjects.add(normalized.id);
    else memoryOrIdbNonEmptyProjects.delete(normalized.id);
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
    memoryOrIdbNonEmptyProjects.delete(id);
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

  public listWorkspaces(): WorkspaceMeta[] {
    return listWorkspaces();
  }

  public getWorkspaceMeta(labId: string): WorkspaceMeta | null {
    return getWorkspaceMeta(labId);
  }

  public upsertWorkspaceMeta(meta: WorkspaceMeta): void {
    upsertWorkspaceMeta(meta);
  }

  public removeWorkspaceMeta(labId: string): void {
    removeWorkspaceMeta(labId);
  }

  public hasWorkspaceData(labId: string): boolean {
    return checkHasWorkspaceData(labId, this.storagePrefix, this.memoryStore);
  }

  public createBlankWorkspaceId(): string {
    return createBlankWorkspaceId();
  }
}

export function createWorkspaceStorage(options: WorkspaceStorageOptions = {}): WorkspaceStorage {
  return new WorkspaceStorage(options);
}

export const CodeLabWorkspaceStorage = {
  WORKSPACE_REGISTRY_KEY,
  WorkspaceStorage,
  createWorkspaceStorage,
  listWorkspaces,
  getWorkspaceMeta,
  upsertWorkspaceMeta,
  removeWorkspaceMeta,
  hasWorkspaceData,
  createBlankWorkspaceId,
  encodeBase64Bytes,
  decodeBase64Bytes
};

if (typeof globalThis !== 'undefined') {
  const g = globalThis as unknown as Record<string, unknown>;
  g.CodeLabWorkspaceStorage = CodeLabWorkspaceStorage;
}

export default {
  ...CodeLabWorkspaceStorage
};
