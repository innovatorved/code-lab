/**
 * @code-lab/core — Generic typed ContributionRegistry for plugins & extension points.
 */

import { type IDisposable, toDisposable } from './disposable';
import { Emitter, type Event } from './events';

export interface ContributionChangeEvent<K, V> {
  readonly kind: 'added' | 'removed';
  readonly key: K;
  readonly value: V;
}

export class ContributionRegistry<K, V> implements IDisposable {
  private readonly items = new Map<K, V>();
  private readonly emitter: Emitter<ContributionChangeEvent<K, V>>;

  public constructor(pointName = 'contributions') {
    this.emitter = new Emitter<ContributionChangeEvent<K, V>>({ name: `registry:${pointName}` });
  }

  public get onDidChange(): Event<ContributionChangeEvent<K, V>> {
    return this.emitter.event;
  }

  public register(key: K, value: V): IDisposable {
    this.items.set(key, value);
    this.emitter.fire({ kind: 'added', key, value });
    return toDisposable(() => {
      if (this.items.get(key) === value) {
        this.items.delete(key);
        this.emitter.fire({ kind: 'removed', key, value });
      }
    });
  }

  public get(key: K): V | undefined {
    return this.items.get(key);
  }

  public has(key: K): boolean {
    return this.items.has(key);
  }

  public entries(): Array<[K, V]> {
    return Array.from(this.items.entries());
  }

  public values(): V[] {
    return Array.from(this.items.values());
  }

  public size(): number {
    return this.items.size;
  }

  public dispose(): void {
    this.items.clear();
    this.emitter.dispose();
  }
}
