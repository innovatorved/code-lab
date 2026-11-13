import { CodeLabError, Emitter, type Event, PosixPath } from '@code-lab/core';
import { MemoryBackend } from './backends';
import type { FsChangeEvent, FsStat, IFileSystemService, IFsBackend } from './types';

interface FileNode {
  bytes: Uint8Array;
  mtimeMs: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export class FileSystemService implements IFileSystemService {
  private backend: IFsBackend;
  private readonly files = new Map<string, FileNode>();
  private readonly dirs = new Set<string>(['/', '/workspace']);
  private readonly changeEmitter = new Emitter<FsChangeEvent>({ name: 'fs.change' });
  private pendingChain: Promise<void> = Promise.resolve();
  private disposed = false;

  public constructor(backend?: IFsBackend) {
    this.backend = backend ?? new MemoryBackend();
  }

  public get backendName(): string {
    return this.backend.name;
  }

  public get onDidChangeFile(): Event<FsChangeEvent> {
    return this.changeEmitter.event;
  }

  private normalize(rawPath: string): string {
    return PosixPath.normalize(rawPath.startsWith('/') ? rawPath : `/workspace/${rawPath}`);
  }

  private ensureParentDirs(normPath: string): void {
    const parts = normPath.split('/').filter(Boolean);
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current += '/' + parts[i];
      this.dirs.add(current);
    }
  }

  private schedulePersist(op: () => Promise<void>): void {
    this.pendingChain = this.pendingChain.then(op, op);
  }

  public async hydrate(): Promise<void> {
    const loaded = await this.backend.loadAll();
    for (const [rawPath, bytes] of loaded.entries()) {
      const norm = this.normalize(rawPath);
      this.ensureParentDirs(norm);
      this.files.set(norm, { bytes: new Uint8Array(bytes), mtimeMs: Date.now() });
    }
  }

  public exists(path: string): boolean {
    const norm = this.normalize(path);
    return this.dirs.has(norm) || this.files.has(norm);
  }

  public stat(path: string): FsStat {
    const norm = this.normalize(path);
    if (this.dirs.has(norm)) {
      return { kind: 'directory', size: 0, mtimeMs: Date.now() };
    }
    const file = this.files.get(norm);
    if (!file) {
      throw new CodeLabError('ERR_FS_NOT_FOUND', `ENOENT: no such file or directory, stat '${path}'`, {
        context: { path: norm }
      });
    }
    return { kind: 'file', size: file.bytes.byteLength, mtimeMs: file.mtimeMs };
  }

  public readFile(path: string): string {
    return decoder.decode(this.readFileBytes(path));
  }

  public readFileBytes(path: string): Uint8Array {
    const norm = this.normalize(path);
    if (this.dirs.has(norm)) {
      throw new CodeLabError('ERR_FS_IS_DIR', `EISDIR: illegal operation on a directory, read '${path}'`);
    }
    const file = this.files.get(norm);
    if (!file) {
      throw new CodeLabError('ERR_FS_NOT_FOUND', `ENOENT: no such file or directory, open '${path}'`);
    }
    return new Uint8Array(file.bytes);
  }

  public writeFile(path: string, content: string | Uint8Array): void {
    const norm = this.normalize(path);
    if (this.dirs.has(norm)) {
      throw new CodeLabError('ERR_FS_IS_DIR', `EISDIR: illegal operation on a directory, write '${path}'`);
    }
    this.ensureParentDirs(norm);
    const existed = this.files.has(norm);
    const bytes = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
    this.files.set(norm, { bytes, mtimeMs: Date.now() });
    const snapshot = new Uint8Array(bytes);
    this.schedulePersist(() => this.backend.writeEntry(norm, snapshot));
    this.changeEmitter.fire({ type: existed ? 'updated' : 'created', path: norm });
  }

  public deleteFile(path: string, options: { recursive?: boolean } = {}): void {
    const norm = this.normalize(path);
    if (this.files.has(norm)) {
      this.files.delete(norm);
      this.schedulePersist(() => this.backend.deleteEntry(norm));
      this.changeEmitter.fire({ type: 'deleted', path: norm });
      return;
    }
    if (this.dirs.has(norm)) {
      if (!options.recursive) {
        const children = this.readdir(norm);
        if (children.length > 0) {
          throw new CodeLabError('ERR_INVALID_ARGUMENT', `Directory not empty: '${path}'`);
        }
      }
      const prefix = norm === '/' ? '/' : norm + '/';
      for (const fileKey of Array.from(this.files.keys())) {
        if (fileKey.startsWith(prefix)) {
          this.files.delete(fileKey);
          this.schedulePersist(() => this.backend.deleteEntry(fileKey));
        }
      }
      for (const dirKey of Array.from(this.dirs)) {
        if (dirKey !== '/' && (dirKey === norm || dirKey.startsWith(prefix))) {
          this.dirs.delete(dirKey);
        }
      }
      this.changeEmitter.fire({ type: 'deleted', path: norm });
      return;
    }
    throw new CodeLabError('ERR_FS_NOT_FOUND', `ENOENT: no such file or directory, unlink '${path}'`);
  }

  public rename(oldPath: string, newPath: string): void {
    const src = this.normalize(oldPath);
    const dst = this.normalize(newPath);
    if (src === dst) return;
    if (this.files.has(src)) {
      const node = this.files.get(src)!;
      this.files.delete(src);
      this.ensureParentDirs(dst);
      const copy = new Uint8Array(node.bytes);
      this.files.set(dst, { bytes: copy, mtimeMs: Date.now() });
      this.schedulePersist(async () => {
        await this.backend.deleteEntry(src);
        await this.backend.writeEntry(dst, copy);
      });
      this.changeEmitter.fire({ type: 'renamed', path: dst, oldPath: src });
      return;
    }
    if (this.dirs.has(src)) {
      const prefix = src + '/';
      this.dirs.delete(src);
      this.dirs.add(dst);
      this.ensureParentDirs(dst);
      for (const d of Array.from(this.dirs)) {
        if (d.startsWith(prefix)) {
          this.dirs.delete(d);
          this.dirs.add(dst + d.slice(src.length));
        }
      }
      for (const [k, node] of Array.from(this.files.entries())) {
        if (k.startsWith(prefix)) {
          const mapped = dst + k.slice(src.length);
          this.files.delete(k);
          const copy = new Uint8Array(node.bytes);
          this.files.set(mapped, { bytes: copy, mtimeMs: Date.now() });
          this.schedulePersist(async () => {
            await this.backend.deleteEntry(k);
            await this.backend.writeEntry(mapped, copy);
          });
        }
      }
      this.changeEmitter.fire({ type: 'renamed', path: dst, oldPath: src });
      return;
    }
    throw new CodeLabError('ERR_FS_NOT_FOUND', `ENOENT: no such file or directory, rename '${oldPath}'`);
  }

  public mkdir(path: string): void {
    const norm = this.normalize(path);
    if (this.files.has(norm)) {
      throw new CodeLabError('ERR_FS_EXISTS', `EEXIST: file already exists, mkdir '${path}'`);
    }
    this.ensureParentDirs(norm + '/placeholder');
    this.dirs.add(norm);
  }

  public readdir(path: string): string[] {
    const norm = this.normalize(path);
    if (!this.dirs.has(norm)) {
      throw new CodeLabError('ERR_FS_NOT_DIR', `ENOTDIR: not a directory, scandir '${path}'`);
    }
    const prefix = norm === '/' ? '/' : norm + '/';
    const children = new Set<string>();
    for (const d of this.dirs) {
      if (d !== norm && d.startsWith(prefix)) {
        const seg = d.slice(prefix.length).split('/')[0];
        if (seg) children.add(seg);
      }
    }
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length);
        if (!rest.includes('/')) children.add(rest);
      }
    }
    return Array.from(children).sort();
  }

  public toRecord(prefix = '/workspace'): Record<string, string> {
    const cleanPrefix = PosixPath.normalize(prefix);
    const out: Record<string, string> = {};
    for (const [k, node] of this.files.entries()) {
      if (cleanPrefix === '/') {
        out[k.replace(/^\/+/, '')] = decoder.decode(node.bytes);
      } else if (k.startsWith(cleanPrefix + '/')) {
        out[k.slice(cleanPrefix.length + 1)] = decoder.decode(node.bytes);
      }
    }
    return out;
  }

  public loadRecord(files: Readonly<Record<string, string>>, prefix = '/workspace'): void {
    const cleanPrefix = PosixPath.normalize(prefix);
    for (const [rel, content] of Object.entries(files)) {
      const target = rel.startsWith('/') ? rel : `${cleanPrefix}/${rel}`;
      this.writeFile(target, content);
    }
  }

  public async flush(): Promise<void> {
    await this.pendingChain;
  }

  public async switchBackend(nextBackend: IFsBackend): Promise<void> {
    await this.flush();
    this.backend = nextBackend;
    await this.backend.clear();
    for (const [path, node] of this.files.entries()) {
      await this.backend.writeEntry(path, new Uint8Array(node.bytes));
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.changeEmitter.dispose();
  }
}
