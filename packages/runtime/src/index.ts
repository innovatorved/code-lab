import {
  CodeLabError,
  createServiceId,
  Emitter,
  type Event,
  type IDisposable
} from '@code-lab/core';
import type { IFileSystemService } from '@code-lab/fs';

export type RuntimeStatus = 'idle' | 'running' | 'stopped' | 'error';

export interface RuntimeExecutionRequest {
  readonly entry: string;
  readonly mode?: 'run' | 'test' | 'repl';
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly stdin?: string;
  readonly timeoutMs?: number;
}

export interface RuntimeExecutionResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut?: boolean;
}

export type RuntimeExecutorDelegate = (
  req: RuntimeExecutionRequest & { files: Record<string, string>; signal: AbortSignal }
) => Promise<RuntimeExecutionResult>;

export interface IRuntimeService extends IDisposable {
  readonly status: RuntimeStatus;
  readonly activeRunCount: number;
  readonly onDidChangeStatus: Event<RuntimeStatus>;
  execute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult>;
  cancelAll(): void;
}

export const IRuntimeServiceId = createServiceId<IRuntimeService>('code-lab.runtime');

export class WorkerHostSupervisor implements IRuntimeService {
  private currentStatus: RuntimeStatus = 'idle';
  private readonly activeControllers = new Set<AbortController>();
  private readonly statusEmitter = new Emitter<RuntimeStatus>({ name: 'runtime.status' });
  private readonly fs: IFileSystemService;
  private readonly delegate: RuntimeExecutorDelegate;
  private disposed = false;

  public constructor(fs: IFileSystemService, delegate: RuntimeExecutorDelegate) {
    this.fs = fs;
    this.delegate = delegate;
  }

  public get status(): RuntimeStatus {
    return this.currentStatus;
  }

  public get activeRunCount(): number {
    return this.activeControllers.size;
  }

  public get onDidChangeStatus(): Event<RuntimeStatus> {
    return this.statusEmitter.event;
  }

  private setStatus(next: RuntimeStatus): void {
    if (this.currentStatus === next) return;
    this.currentStatus = next;
    this.statusEmitter.fire(next);
  }

  public async execute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult> {
    if (this.disposed) {
      throw new CodeLabError('ERR_DISPOSED', 'RuntimeService has been disposed');
    }
    const controller = new AbortController();
    this.activeControllers.add(controller);
    this.setStatus('running');

    const timeoutMs = request.timeoutMs ?? 8000;
    const start = Date.now();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const files = this.fs.toRecord('/workspace');
      const res = await this.delegate({
        ...request,
        files,
        signal: controller.signal
      });
      this.setStatus(this.activeControllers.size > 1 ? 'running' : res.ok ? 'idle' : 'error');
      return res;
    } catch (err) {
      this.setStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        exitCode: timedOut ? 124 : 1,
        stdout: '',
        stderr: timedOut ? `Execution timed out after ${timeoutMs}ms` : message,
        durationMs: Date.now() - start,
        timedOut
      };
    } finally {
      clearTimeout(timer);
      this.activeControllers.delete(controller);
      if (this.activeControllers.size === 0 && this.currentStatus === 'running') {
        this.setStatus('idle');
      }
    }
  }

  public cancelAll(): void {
    for (const ctrl of this.activeControllers) {
      ctrl.abort();
    }
    this.activeControllers.clear();
    this.setStatus('stopped');
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAll();
    this.statusEmitter.dispose();
  }
}
