/**
 * @code-lab/core — Decorator-free ServiceId<T> Dependency Injection container.
 */

import { DisposableStore, type IDisposable, isDisposable } from './disposable';
import { CodeLabError } from './errors';

export interface ServiceId<T> {
  readonly id: string;
  readonly __brand?: (instance: T) => T;
}

export function createServiceId<T>(id: string): ServiceId<T> {
  if (!id || typeof id !== 'string') {
    throw new CodeLabError('ERR_INVALID_ARGUMENT', 'ServiceId requires a non-empty string id');
  }
  return Object.freeze({ id });
}

export type ServiceFactory<T> = (container: IServiceContainer) => T;

export interface IServiceContainer extends IDisposable {
  registerInstance<T>(serviceId: ServiceId<T>, instance: T): void;
  registerSingleton<T>(serviceId: ServiceId<T>, factory: ServiceFactory<T>): void;
  get<T>(serviceId: ServiceId<T>): T;
  tryGet<T>(serviceId: ServiceId<T>): T | undefined;
  has<T>(serviceId: ServiceId<T>): boolean;
  listRegisteredIds(): string[];
  createChild(): ServiceContainer;
}

interface ProviderEntry {
  kind: 'instance' | 'singleton';
  value?: unknown;
  factory?: ServiceFactory<unknown>;
  resolved: boolean;
}

export class ServiceContainer implements IServiceContainer {
  private readonly entries = new Map<string, ProviderEntry>();
  private readonly resolving = new Set<string>();
  private readonly ownedDisposables = new DisposableStore();
  private readonly parent: ServiceContainer | null;
  private disposed = false;

  public constructor(parent: ServiceContainer | null = null) {
    this.parent = parent;
  }

  public registerInstance<T>(serviceId: ServiceId<T>, instance: T): void {
    this.ensureNotDisposed();
    this.entries.set(serviceId.id, {
      kind: 'instance',
      value: instance,
      resolved: true
    });
  }

  public registerSingleton<T>(serviceId: ServiceId<T>, factory: ServiceFactory<T>): void {
    this.ensureNotDisposed();
    this.entries.set(serviceId.id, {
      kind: 'singleton',
      factory: factory as ServiceFactory<unknown>,
      resolved: false
    });
  }

  public has<T>(serviceId: ServiceId<T>): boolean {
    if (this.entries.has(serviceId.id)) return true;
    return this.parent ? this.parent.has(serviceId) : false;
  }

  public listRegisteredIds(): string[] {
    const ids = new Set<string>(this.entries.keys());
    if (this.parent) {
      for (const id of this.parent.listRegisteredIds()) {
        ids.add(id);
      }
    }
    return Array.from(ids).sort();
  }

  public tryGet<T>(serviceId: ServiceId<T>): T | undefined {
    const entry = this.entries.get(serviceId.id);
    if (!entry) {
      return this.parent ? this.parent.tryGet(serviceId) : undefined;
    }
    if (entry.resolved) {
      return entry.value as T;
    }
    if (this.resolving.has(serviceId.id)) {
      const chain = [...this.resolving, serviceId.id].join(' -> ');
      throw new CodeLabError(
        'ERR_DI_CYCLE',
        `Circular service dependency detected while resolving "${serviceId.id}": ${chain}`
      );
    }
    this.resolving.add(serviceId.id);
    try {
      const factory = entry.factory;
      if (!factory) {
        throw new CodeLabError('ERR_DI_MISSING', `Missing factory for service "${serviceId.id}"`);
      }
      const created = factory(this);
      entry.value = created;
      entry.resolved = true;
      if (isDisposable(created)) {
        this.ownedDisposables.add(created);
      }
      return created as T;
    } finally {
      this.resolving.delete(serviceId.id);
    }
  }

  public get<T>(serviceId: ServiceId<T>): T {
    const found = this.tryGet(serviceId);
    if (found === undefined && !this.has(serviceId)) {
      throw new CodeLabError(
        'ERR_DI_MISSING',
        `Service "${serviceId.id}" is not registered in ServiceContainer`
      );
    }
    return found as T;
  }

  public createChild(): ServiceContainer {
    this.ensureNotDisposed();
    const child = new ServiceContainer(this);
    this.ownedDisposables.add(child);
    return child;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ownedDisposables.dispose();
    this.entries.clear();
    this.resolving.clear();
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new CodeLabError('ERR_DISPOSED', 'Cannot operate on a disposed ServiceContainer');
    }
  }
}
