import { useEffect, useRef } from 'react';
import CodeLab, { type CodeLabOptions, type CodeLabWorkbench } from '@innovatorved/code-lab';
import '@innovatorved/code-lab/code-lab.css';

export interface CodeLabEmbedProps {
  id?: string;
  title?: string;
  lang?: 'js' | 'ts' | 'sql' | 'py' | 'cpp';
  entry?: string;
  files: Record<string, string>;
  settings?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  showLanguageSelector?: boolean;
  height?: string;
}

const DEFAULT_SETTINGS: Record<string, unknown> = {
  'workbench.colorTheme': 'dark',
  'editor.fontSize': 14,
  'terminal.fontSize': 13
};

/**
 * Minimal React / Next.js client component wrapper around `CodeLab.mount`.
 */
export function CodeLabEmbed({
  id = 'react-embed',
  title = 'CodeLab Sandbox',
  lang = 'ts',
  entry = 'index.ts',
  files,
  settings = DEFAULT_SETTINGS,
  overrides,
  showLanguageSelector = true,
  height = '640px'
}: CodeLabEmbedProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<CodeLabWorkbench | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const options: CodeLabOptions = {
      id,
      title,
      lang,
      entry,
      files,
      settings,
      overrides,
      showLanguageSelector
    };

    instanceRef.current = CodeLab.mount(el, options);
    return () => {
      instanceRef.current?.destroy?.();
      instanceRef.current = null;
    };
  }, [id, title, lang, entry, files, settings, overrides, showLanguageSelector]);

  return <div ref={hostRef} style={{ width: '100%', height }} />;
}
