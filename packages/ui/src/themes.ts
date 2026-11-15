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
  label: 'Charcoal Ink',
  kind: 'dark',
  monacoBase: 'vs-dark',
  colors: {
    '--cl-bg': '#0f0f10',
    '--cl-editor-bg': '#0f0f10',
    '--cl-surface': '#141415',
    '--cl-chrome-bg': '#141415',
    '--cl-widget-bg': '#18181a',
    '--cl-input-bg': '#141415',
    '--cl-input-border': '#27272a',
    '--cl-fg': '#f4f4f5',
    '--cl-fg-active': '#ffffff',
    '--cl-muted': '#a1a1aa',
    '--cl-fg-muted': '#a1a1aa',
    '--cl-border': '#27272a',
    '--cl-accent': '#f4f4f5',
    '--cl-accent-fg': '#0f0f10',
    '--cl-btn-primary-bg': '#f4f4f5',
    '--cl-btn-primary-hover': '#ffffff',
    '--cl-btn-primary-fg': '#0f0f10',
    '--cl-focus-border': '#a1a1aa',
    '--cl-list-hover': '#1f1f22',
    '--cl-list-active': '#28282b',
    '--cl-list-active-fg': '#f4f4f5',
    '--cl-badge-bg': '#28282b',
    '--cl-badge-fg': '#f4f4f5',
    '--cl-git-modified': '#fbbf24',
    '--cl-git-added': '#34d399',
    '--cl-git-untracked': '#34d399',
    '--cl-git-deleted': '#f87171',
    '--cl-error': '#f87171',
    '--cl-warning': '#fbbf24',
    '--cl-info': '#e4e4e7'
  }
};

export const LIGHT_THEME: ThemeDefinition = {
  id: 'light',
  label: 'Warm Paper',
  kind: 'light',
  monacoBase: 'vs',
  colors: {
    '--cl-bg': '#ffffff',
    '--cl-editor-bg': '#ffffff',
    '--cl-surface': '#f7f7f5',
    '--cl-chrome-bg': '#f7f7f5',
    '--cl-widget-bg': '#f1f1ee',
    '--cl-input-bg': '#ffffff',
    '--cl-input-border': '#d3d0c9',
    '--cl-fg': '#18181b',
    '--cl-fg-active': '#09090b',
    '--cl-muted': '#52525b',
    '--cl-fg-muted': '#52525b',
    '--cl-border': '#e6e4df',
    '--cl-accent': '#18181b',
    '--cl-accent-fg': '#ffffff',
    '--cl-btn-primary-bg': '#18181b',
    '--cl-btn-primary-hover': '#27272a',
    '--cl-btn-primary-fg': '#ffffff',
    '--cl-focus-border': '#3f3f46',
    '--cl-list-hover': '#f1f1ee',
    '--cl-list-active': '#ecebe7',
    '--cl-list-active-fg': '#18181b',
    '--cl-badge-bg': '#ecebe7',
    '--cl-badge-fg': '#18181b',
    '--cl-git-modified': '#b54708',
    '--cl-git-added': '#067647',
    '--cl-git-untracked': '#067647',
    '--cl-git-deleted': '#b42318',
    '--cl-error': '#b42318',
    '--cl-warning': '#b54708',
    '--cl-info': '#18181b'
  }
};

export const HIGH_CONTRAST_THEME: ThemeDefinition = {
  id: 'high-contrast',
  label: 'High Contrast Ink',
  kind: 'high-contrast',
  monacoBase: 'hc-black',
  colors: {
    '--cl-bg': '#000000',
    '--cl-editor-bg': '#000000',
    '--cl-surface': '#000000',
    '--cl-chrome-bg': '#000000',
    '--cl-widget-bg': '#0f0f10',
    '--cl-input-bg': '#000000',
    '--cl-input-border': '#ffffff',
    '--cl-fg': '#ffffff',
    '--cl-fg-active': '#ffffff',
    '--cl-muted': '#e4e4e7',
    '--cl-fg-muted': '#e4e4e7',
    '--cl-border': '#ffffff',
    '--cl-accent': '#ffffff',
    '--cl-accent-fg': '#000000',
    '--cl-btn-primary-bg': '#ffffff',
    '--cl-btn-primary-hover': '#e4e4e7',
    '--cl-btn-primary-fg': '#000000',
    '--cl-focus-border': '#fbbf24',
    '--cl-list-hover': '#18181a',
    '--cl-list-active': '#27272a',
    '--cl-list-active-fg': '#ffffff',
    '--cl-badge-bg': '#ffffff',
    '--cl-badge-fg': '#000000',
    '--cl-git-modified': '#fbbf24',
    '--cl-git-added': '#34d399',
    '--cl-git-untracked': '#34d399',
    '--cl-git-deleted': '#f87171',
    '--cl-error': '#f87171',
    '--cl-warning': '#fbbf24',
    '--cl-info': '#ffffff'
  }
};

function parseColorRgb(raw: string): [number, number, number] | null {
  const s = raw.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
      return null;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
      return null;
    }
    return null;
  }
  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(s);
  if (rgbMatch) {
    const r = Math.min(255, Number.parseInt(rgbMatch[1], 10));
    const g = Math.min(255, Number.parseInt(rgbMatch[2], 10));
    const b = Math.min(255, Number.parseInt(rgbMatch[3], 10));
    return [r, g, b];
  }
  return null;
}

function toLinearChannel(channel8Bit: number): number {
  const srgb = channel8Bit / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Picks `'#ffffff'` or `'#000000'` to maximize WCAG 2.1 contrast (>= 4.58:1)
 * against a solid hex/rgb background color, returning `fallback` for dynamic CSS expressions.
 */
export function pickContrastingFg(color: string, fallback = '#ffffff'): string {
  const rgb = parseColorRgb(color);
  if (!rgb) return fallback;
  const lum =
    0.2126 * toLinearChannel(rgb[0]) +
    0.7152 * toLinearChannel(rgb[1]) +
    0.0722 * toLinearChannel(rgb[2]);
  const whiteContrast = 1.05 / (lum + 0.05);
  const blackContrast = (lum + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
}

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
  const rawPaletteCandidate = obj.colors ?? obj.tokens;
  const rawColors =
    typeof rawPaletteCandidate === 'object' && rawPaletteCandidate !== null && !Array.isArray(rawPaletteCandidate)
      ? (rawPaletteCandidate as Record<string, unknown>)
      : {};
  const base = kind === 'light' ? LIGHT_THEME : kind === 'high-contrast' ? HIGH_CONTRAST_THEME : DARK_THEME;
  const colors: Record<string, string> = { ...base.colors };
  let explicitAccentFg = false;
  let explicitFgMuted = false;
  let explicitMuted = false;
  for (const [k, v] of Object.entries(rawColors)) {
    if (typeof v === 'string') {
      const cssVar = k.startsWith('--') ? k : `--cl-${k.replace(/\./g, '-')}`;
      colors[cssVar] = v;
      if (cssVar === '--cl-accent-fg') explicitAccentFg = true;
      if (cssVar === '--cl-fg-muted') explicitFgMuted = true;
      if (cssVar === '--cl-muted') explicitMuted = true;
    }
  }
  if (!explicitAccentFg && colors['--cl-accent']) {
    colors['--cl-accent-fg'] = pickContrastingFg(
      colors['--cl-accent'],
      base.colors['--cl-accent-fg'] ?? '#ffffff'
    );
  }
  if (explicitMuted && !explicitFgMuted && colors['--cl-muted']) {
    colors['--cl-fg-muted'] = colors['--cl-muted'];
  } else if (explicitFgMuted && !explicitMuted && colors['--cl-fg-muted']) {
    colors['--cl-muted'] = colors['--cl-fg-muted'];
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

    const setCssVar = (prop: string, val: string): void => {
      if (target.style && typeof target.style.setProperty === 'function') {
        target.style.setProperty(prop, val);
      } else if (target.style) {
        (target.style as unknown as Record<string, string>)[prop] = val;
      }
    };

    for (const [cssVar, val] of Object.entries(t.colors)) {
      setCssVar(cssVar, val);
    }
    const accent = t.colors['--cl-accent'];
    const accentFg = t.colors['--cl-accent-fg'] ?? (accent ? pickContrastingFg(accent) : '#ffffff');
    setCssVar('--cl-accent-fg', accentFg);
    const fgMuted = t.colors['--cl-fg-muted'] ?? t.colors['--cl-muted'];
    if (fgMuted) {
      setCssVar('--cl-fg-muted', fgMuted);
    }

    // Pair color-scheme with explicit background/color/accent-color per Modern Web Guidance
    if (target.style) {
      target.style.colorScheme = t.kind === 'light' ? 'light' : 'dark';
      if (t.colors['--cl-bg']) target.style.backgroundColor = t.colors['--cl-bg'];
      if (t.colors['--cl-fg']) target.style.color = t.colors['--cl-fg'];
      if (accent) target.style.accentColor = accent;
    }
  }

  public dispose(): void {
    this.changeEmitter.dispose();
  }
}
