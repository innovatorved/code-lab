import {
  CodeLabError,
  createServiceId,
  Emitter,
  type Event,
  type IDisposable,
  toDisposable
} from '@code-lab/core';
import { parseJsonc } from '@code-lab/settings';

export type ThemeKind = 'dark' | 'light' | 'high-contrast';

export interface ThemeDefinition {
  readonly id: string;
  readonly label: string;
  readonly kind: ThemeKind;
  readonly colors: Readonly<Record<string, string>>;
  readonly monacoBase: 'vs-dark' | 'vs' | 'hc-black';
}

export const DARK_THEME: ThemeDefinition = {
  id: 'dark',
  label: 'CodeLab Dark',
  kind: 'dark',
  monacoBase: 'vs-dark',
  colors: {
    '--cl-bg': '#000000',
    '--cl-surface': '#0a0a0a',
    '--cl-fg': '#f5f5f5',
    '--cl-muted': '#8e8e93',
    '--cl-border': '#262626',
    '--cl-accent': '#0284c7'
  }
};

export const LIGHT_THEME: ThemeDefinition = {
  id: 'light',
  label: 'CodeLab Light',
  kind: 'light',
  monacoBase: 'vs',
  colors: {
    '--cl-bg': '#ffffff',
    '--cl-surface': '#f8fafc',
    '--cl-fg': '#0f172a',
    '--cl-muted': '#64748b',
    '--cl-border': '#e2e8f0',
    '--cl-accent': '#0284c7'
  }
};

export const HIGH_CONTRAST_THEME: ThemeDefinition = {
  id: 'high-contrast',
  label: 'CodeLab High Contrast',
  kind: 'high-contrast',
  monacoBase: 'hc-black',
  colors: {
    '--cl-bg': '#000000',
    '--cl-surface': '#000000',
    '--cl-fg': '#ffffff',
    '--cl-muted': '#e5e5e5',
    '--cl-border': '#facc15',
    '--cl-accent': '#38bdf8'
  }
};

export function parseCustomTheme(rawJsonc: string): ThemeDefinition {
  const parsed = parseJsonc<Record<string, unknown>>(rawJsonc);
  if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
    throw new CodeLabError('ERR_CONFIG_PARSE', parsed.errors[0]?.message ?? 'Invalid custom theme JSON');
  }
  const obj = parsed.value;
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : 'custom-theme';
  const label = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : id;
  const kind: ThemeKind =
    obj.kind === 'light' ? 'light' : obj.kind === 'high-contrast' ? 'high-contrast' : 'dark';
  const rawColors =
    typeof obj.colors === 'object' && obj.colors !== null && !Array.isArray(obj.colors)
      ? (obj.colors as Record<string, unknown>)
      : {};
  const base = kind === 'light' ? LIGHT_THEME : kind === 'high-contrast' ? HIGH_CONTRAST_THEME : DARK_THEME;
  const colors: Record<string, string> = { ...base.colors };
  for (const [k, v] of Object.entries(rawColors)) {
    if (typeof v === 'string') {
      const cssVar = k.startsWith('--') ? k : `--cl-${k.replace(/\./g, '-')}`;
      colors[cssVar] = v;
    }
  }
  return {
    id,
    label,
    kind,
    monacoBase: kind === 'light' ? 'vs' : kind === 'high-contrast' ? 'hc-black' : 'vs-dark',
    colors
  };
}

export interface IThemeService extends IDisposable {
  readonly activeTheme: ThemeDefinition;
  readonly onDidChangeTheme: Event<ThemeDefinition>;
  registerTheme(theme: ThemeDefinition): IDisposable;
  getThemes(): ThemeDefinition[];
  setTheme(themeId: string): ThemeDefinition;
  applyToElement(target: HTMLElement): void;
}

export const IThemeServiceId = createServiceId<IThemeService>('code-lab.theme');

export class ThemeService implements IThemeService {
  private readonly themes = new Map<string, ThemeDefinition>();
  private current: ThemeDefinition = DARK_THEME;
  private readonly changeEmitter = new Emitter<ThemeDefinition>({ name: 'theme.change' });

  public constructor() {
    this.themes.set(DARK_THEME.id, DARK_THEME);
    this.themes.set(LIGHT_THEME.id, LIGHT_THEME);
    this.themes.set(HIGH_CONTRAST_THEME.id, HIGH_CONTRAST_THEME);
  }

  public get activeTheme(): ThemeDefinition {
    return this.current;
  }

  public get onDidChangeTheme(): Event<ThemeDefinition> {
    return this.changeEmitter.event;
  }

  public registerTheme(theme: ThemeDefinition): IDisposable {
    this.themes.set(theme.id, theme);
    return toDisposable(() => {
      if (theme.id !== 'dark' && theme.id !== 'light' && theme.id !== 'high-contrast') {
        this.themes.delete(theme.id);
        if (this.current.id === theme.id) {
          this.setTheme('dark');
        }
      }
    });
  }

  public getThemes(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  public setTheme(themeId: string): ThemeDefinition {
    const next = this.themes.get(themeId) ?? DARK_THEME;
    if (this.current.id === next.id && this.current === next) {
      return this.current;
    }
    this.current = next;
    this.changeEmitter.fire(next);
    return next;
  }

  public applyToElement(target: HTMLElement): void {
    const t = this.current;
    target.setAttribute('data-cl-theme', t.kind);
    target.setAttribute('data-cl-theme-id', t.id);
    target.classList.toggle('cl-theme-light', t.kind === 'light');
    target.classList.toggle('cl-theme-dark', t.kind === 'dark');
    target.classList.toggle('cl-theme-hc', t.kind === 'high-contrast');

    for (const [cssVar, val] of Object.entries(t.colors)) {
      target.style.setProperty(cssVar, val);
    }
    // Pair color-scheme with explicit background/color/accent-color per Modern Web Guidance
    target.style.colorScheme = t.kind === 'light' ? 'light' : 'dark';
    if (t.colors['--cl-bg']) target.style.backgroundColor = t.colors['--cl-bg'];
    if (t.colors['--cl-fg']) target.style.color = t.colors['--cl-fg'];
    if (t.colors['--cl-accent']) target.style.accentColor = t.colors['--cl-accent'];
  }

  public dispose(): void {
    this.changeEmitter.dispose();
  }
}
