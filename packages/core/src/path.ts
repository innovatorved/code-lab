/**
 * @code-lab/core — Pure POSIX path and glob matching utilities (zero Node/DOM deps).
 */

export const PosixPath = {
  isAbsolute(filePath: string): boolean {
    return filePath.startsWith('/');
  },

  normalize(filePath: string): string {
    if (!filePath) return '.';
    const isAbs = filePath.startsWith('/');
    const parts = filePath.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (stack.length > 0 && stack[stack.length - 1] !== '..') {
          stack.pop();
        } else if (!isAbs) {
          stack.push('..');
        }
      } else {
        stack.push(part);
      }
    }
    const joined = stack.join('/');
    if (isAbs) return '/' + joined;
    return joined || '.';
  },

  join(...segments: string[]): string {
    const filtered = segments.filter((s) => s.length > 0);
    if (filtered.length === 0) return '.';
    return PosixPath.normalize(filtered.join('/'));
  },

  dirname(filePath: string): string {
    const norm = PosixPath.normalize(filePath);
    if (norm === '/') return '/';
    const idx = norm.lastIndexOf('/');
    if (idx === -1) return '.';
    if (idx === 0) return '/';
    return norm.slice(0, idx);
  },

  basename(filePath: string, suffix?: string): string {
    const norm = PosixPath.normalize(filePath);
    if (norm === '/') return '/';
    const idx = norm.lastIndexOf('/');
    const base = idx === -1 ? norm : norm.slice(idx + 1);
    if (suffix && base.endsWith(suffix)) {
      return base.slice(0, base.length - suffix.length);
    }
    return base;
  },

  extname(filePath: string): string {
    const base = PosixPath.basename(filePath);
    const idx = base.lastIndexOf('.');
    if (idx <= 0) return '';
    return base.slice(idx);
  },

  relative(from: string, to: string): string {
    const a = PosixPath.normalize(from).replace(/^\/+/, '').split('/').filter(Boolean);
    const b = PosixPath.normalize(to).replace(/^\/+/, '').split('/').filter(Boolean);
    let common = 0;
    while (common < a.length && common < b.length && a[common] === b[common]) {
      common++;
    }
    const up = new Array<string>(a.length - common).fill('..');
    const down = b.slice(common);
    return [...up, ...down].join('/') || '.';
  }
};

export function globToRegExp(pattern: string): RegExp {
  let regex = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          regex += '(?:.*/)?';
          i += 3;
          continue;
        }
        regex += '.*';
        i += 2;
        continue;
      }
      regex += '[^/]*';
      i++;
      continue;
    }
    if (ch === '?') {
      regex += '[^/]';
      i++;
      continue;
    }
    if ('\\^$.|+()[]{}'.includes(ch)) {
      regex += '\\' + ch;
    } else {
      regex += ch;
    }
    i++;
  }
  regex += '$';
  return new RegExp(regex);
}

export function matchesGlob(targetPath: string, pattern: string): boolean {
  const cleanTarget = targetPath.replace(/^\/+/, '');
  const cleanPattern = pattern.replace(/^\/+/, '');
  return globToRegExp(cleanPattern).test(cleanTarget);
}
