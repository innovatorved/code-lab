/**
 * @code-lab/core — Deterministic lifecycle and disposable management.
 * Zero DOM dependencies (Layer 0).
 */

export interface IDisposable {
  dispose(): void;
}

export function isDisposable(value: unknown): value is IDisposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as IDisposable).dispose === 'function'
  );
}

export function toDisposable(fn: () => void): IDisposable {
  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      fn();
    }
  };
}

export class DisposableStore implements IDisposable {
  private readonly items = new Set<IDisposable>();
  private disposed = false;

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public get size(): number {
    return this.items.size;
  }

  public add<T extends IDisposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
      return item;
    }
    this.items.add(item);
    return item;
  }

  public addFn(cleanup: () => void): IDisposable {
    return this.add(toDisposable(cleanup));
  }

  public clear(): void {
    const snapshot = Array.from(this.items);
    this.items.clear();
    const errors: unknown[] = [];
    for (let i = snapshot.length - 1; i >= 0; i--) {
      try {
        snapshot[i].dispose();
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Multiple errors occurred while clearing DisposableStore');
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
}

export class MutableDisposable<T extends IDisposable> implements IDisposable {
  private current: T | undefined;
  private disposed = false;

  public get value(): T | undefined {
    return this.current;
  }

  public set value(next: T | undefined) {
    if (this.disposed) {
      if (next) next.dispose();
      return;
    }
    if (this.current === next) return;
    if (this.current) {
      this.current.dispose();
    }
    this.current = next;
  }

  public clear(): void {
    if (this.current) {
      this.current.dispose();
      this.current = undefined;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
}
