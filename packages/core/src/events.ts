/**
 * @code-lab/core — Typed Event<T> & Emitter<T> bus (VS Code / Lumino pattern).
 * Every subscription returns an IDisposable so listeners never leak.
 */

import { type IDisposable, toDisposable } from './disposable';

export type EventListener<T> = (event: T) => void;

export type Event<T> = (listener: EventListener<T>) => IDisposable;

export interface EventTraceRecord {
  readonly channel: string;
  readonly timestamp: number;
  readonly listenerCount: number;
  readonly payloadSummary: string;
}

export type EventMonitorHook = (record: EventTraceRecord) => void;

let globalEventMonitor: EventMonitorHook | null = null;

export function setGlobalEventMonitor(hook: EventMonitorHook | null): IDisposable {
  globalEventMonitor = hook;
  return toDisposable(() => {
    if (globalEventMonitor === hook) {
      globalEventMonitor = null;
    }
  });
}

function summarizePayload(payload: unknown): string {
  if (payload === undefined) return 'void';
  if (payload === null) return 'null';
  if (typeof payload === 'string') {
    return payload.length > 80 ? `${payload.slice(0, 77)}...` : payload;
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }
  try {
    const raw = JSON.stringify(payload);
    if (!raw) return typeof payload;
    return raw.length > 100 ? `${raw.slice(0, 97)}...` : raw;
  } catch {
    return Object.prototype.toString.call(payload);
  }
}

export interface EmitterOptions {
  readonly name?: string;
  readonly leakWarningThreshold?: number;
  readonly onListenerError?: (err: unknown) => void;
}

export class Emitter<T> implements IDisposable {
  private readonly listeners = new Set<EventListener<T>>();
  private readonly channelName: string;
  private readonly leakThreshold: number;
  private readonly onListenerError?: (err: unknown) => void;
  private disposed = false;
  private cachedEvent: Event<T> | null = null;

  public constructor(options: EmitterOptions = {}) {
    this.channelName = options.name ?? 'anonymous';
    this.leakThreshold = options.leakWarningThreshold ?? 250;
    this.onListenerError = options.onListenerError;
  }

  public get listenerCount(): number {
    return this.listeners.size;
  }

  public get event(): Event<T> {
    if (!this.cachedEvent) {
      this.cachedEvent = (listener: EventListener<T>): IDisposable => {
        if (this.disposed) {
          return toDisposable(() => {});
        }
        this.listeners.add(listener);
        if (this.leakThreshold > 0 && this.listeners.size > this.leakThreshold) {
          console.warn(
            `[CodeLab][Emitter:${this.channelName}] Listener count (${this.listeners.size}) exceeded threshold (${this.leakThreshold}). Check for missing dispose() calls.`
          );
        }
        return toDisposable(() => {
          this.listeners.delete(listener);
        });
      };
    }
    return this.cachedEvent;
  }

  public fire(payload: T): void {
    if (this.disposed) return;
    if (globalEventMonitor) {
      globalEventMonitor({
        channel: this.channelName,
        timestamp: Date.now(),
        listenerCount: this.listeners.size,
        payloadSummary: summarizePayload(payload)
      });
    }
    if (this.listeners.size === 0) return;
    const snapshot = Array.from(this.listeners);
    for (const listener of snapshot) {
      try {
        listener(payload);
      } catch (err) {
        if (this.onListenerError) {
          this.onListenerError(err);
        } else {
          throw err;
        }
      }
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
  }
}

export namespace EventUtils {
  export function once<T>(event: Event<T>): Event<T> {
    return (listener: EventListener<T>): IDisposable => {
      let didFire = false;
      let sub: IDisposable | null = null;
      sub = event((value) => {
        if (didFire) return;
        didFire = true;
        if (sub) sub.dispose();
        listener(value);
      });
      if (didFire) {
        sub.dispose();
      }
      return sub;
    };
  }

  export function filter<T>(event: Event<T>, predicate: (value: T) => boolean): Event<T> {
    return (listener: EventListener<T>): IDisposable =>
      event((value) => {
        if (predicate(value)) listener(value);
      });
  }

  export function map<I, O>(event: Event<I>, mapper: (value: I) => O): Event<O> {
    return (listener: EventListener<O>): IDisposable =>
      event((value) => {
        listener(mapper(value));
      });
  }
}
