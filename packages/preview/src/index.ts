import {
  CodeLabError,
  createServiceId,
  Emitter,
  type Event,
  type IDisposable
} from '@code-lab/core';

export const SAFE_IFRAME_SANDBOX = 'allow-scripts allow-forms allow-modals';

export interface PreviewPolicyOptions {
  readonly allowExternalNetwork?: boolean;
  readonly allowedOrigins?: readonly string[];
}

function sanitizeSourceList(origins: readonly string[] | undefined): string[] {
  if (!origins) return [];
  const valid: string[] = [];
  for (const raw of origins) {
    const trimmed = raw.trim();
    if (/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(trimmed)) {
      valid.push(trimmed);
    }
  }
  return valid;
}

export function buildPreviewCsp(options: PreviewPolicyOptions = {}): string {
  const extra = sanitizeSourceList(options.allowedOrigins);
  const netSources = options.allowExternalNetwork
    ? ["'self'", 'https:', 'http:', 'ws:', 'wss:', ...extra]
    : ["'self'", ...extra];

  return [
    "default-src 'self' data: blob:",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://esm.sh https://cdn.jsdelivr.net ${extra.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${netSources.join(' ')}`,
    "frame-ancestors 'self'",
    "base-uri 'none'",
    "object-src 'none'"
  ].join('; ');
}

export function sanitizePreviewUrl(rawUrl: string): string {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return 'about:blank';
  if (/^(?:javascript|vbscript|data):/i.test(trimmed)) {
    throw new CodeLabError('ERR_SECURITY_POLICY', `Blocked unsafe preview URL scheme: ${trimmed}`);
  }
  return trimmed;
}

export interface PreviewState {
  readonly instanceId: string;
  readonly port: number;
  readonly path: string;
  readonly reloadNonce: number;
  readonly csp: string;
}

export interface IPreviewService extends IDisposable {
  readonly state: PreviewState;
  readonly onDidChangePreview: Event<PreviewState>;
  navigate(port: number, path?: string): void;
  reload(): void;
  updatePolicy(options: PreviewPolicyOptions): void;
}

export const IPreviewServiceId = createServiceId<IPreviewService>('code-lab.preview');

export class PreviewService implements IPreviewService {
  private current: PreviewState;
  private readonly emitter = new Emitter<PreviewState>({ name: 'preview.change' });

  public constructor(instanceId: string, initialPort = 3000, policy: PreviewPolicyOptions = {}) {
    this.current = {
      instanceId,
      port: initialPort,
      path: '/',
      reloadNonce: 0,
      csp: buildPreviewCsp(policy)
    };
  }

  public get state(): PreviewState {
    return this.current;
  }

  public get onDidChangePreview(): Event<PreviewState> {
    return this.emitter.event;
  }

  public navigate(port: number, path = '/'): void {
    const cleanPath = sanitizePreviewUrl(path);
    this.current = {
      ...this.current,
      port: Math.max(1, Math.min(65535, Math.trunc(port))),
      path: cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath
    };
    this.emitter.fire(this.current);
  }

  public reload(): void {
    this.current = {
      ...this.current,
      reloadNonce: this.current.reloadNonce + 1
    };
    this.emitter.fire(this.current);
  }

  public updatePolicy(options: PreviewPolicyOptions): void {
    this.current = {
      ...this.current,
      csp: buildPreviewCsp(options)
    };
    this.emitter.fire(this.current);
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}
