/**
 * @innovatorved/code-lab — High-Performance Cross-File Search & Replace Core
 * ============================================================================
 * Pure TypeScript implementation of workspace-wide text search and atomic multi-file
 * replacements. Supports regex, whole-word, case-sensitive matching, glob filtering,
 * line/column coordinate extraction, and match highlight snippets.
 *
 * Strict leaf module: fully typed, zero explicit any, zero empty catches.
 */

export interface SearchOptions {
  query?: string;
  replacement?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  isRegex?: boolean;
  include?: string;
  includeGlob?: string;
  includePattern?: string | string[];
  exclude?: string;
  excludeGlob?: string;
  excludePattern?: string | string[];
  maxMatches?: number;
  maxMatchesPerFile?: number;
  targetFiles?: string[];
}

export interface SearchMatchItem {
  line: number;
  col: number;
  column?: number;
  length: number;
  matchText?: string;
  lineText: string;
  beforeSnippet?: string;
  afterSnippet?: string;
  matchIndex?: number;
  matchEndIndex?: number;
}

export interface SearchMatchGroup {
  file: string;
  matches: SearchMatchItem[];
}

export interface SearchResult extends Array<SearchMatchGroup> {
  matches: SearchMatchGroup[];
  totalMatches: number;
  fileCount: number;
  filesCount: number;
  query: string;
  durationMs?: number;
  error?: string;
}

export interface ReplaceResult {
  updatedFiles: Record<string, string>;
  files: Record<string, string>;
  replacedCount: number;
  filesAffected: string[];
  filesModified: number;
}

/**
 * Escapes regex special characters in a literal string.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes a virtual workspace path (POSIX forward-slashes, no leading ./ or /).
 */
export function normalizeSearchPath(filePath: string): string {
  let p = filePath.replace(/\\/g, '/');
  while (p.startsWith('./')) {
    p = p.slice(2);
  }
  while (p.startsWith('/')) {
    p = p.slice(1);
  }
  return p;
}

/**
 * Matches a file path against a glob or literal substring filter.
 * Supports comma-separated patterns (e.g. `*.ts, *.js`).
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  if (!pattern || pattern === '*' || pattern === '**') return true;
  if (pattern.includes(',')) {
    const subPatterns = pattern
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (subPatterns.length > 1) {
      return subPatterns.some((sub) => matchesGlob(filePath, sub));
    }
  }

  const normPath = normalizeSearchPath(filePath);
  const normPattern = normalizeSearchPath(pattern.trim());

  if (normPattern === normPath) return true;

  // Plain substring match if no wildcards present
  if (!normPattern.includes('*') && !normPattern.includes('?')) {
    return normPath.includes(normPattern) || normPath.endsWith(normPattern);
  }

  // Convert glob pattern to regular expression
  let regexStr = '^';
  let i = 0;
  while (i < normPattern.length) {
    const c = normPattern[i];
    if (c === '*') {
      if (normPattern[i + 1] === '*') {
        i += 2;
        if (normPattern[i] === '/') {
          // `/**/` or leading `**/` matches zero or more directory segments
          regexStr += '(?:.*/)?';
          i++;
        } else {
          regexStr += '.*';
        }
        continue;
      } else {
        regexStr += '[^/]*';
        i++;
        continue;
      }
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
      continue;
    } else if ('./+^$()|[]{}\\'.includes(c)) {
      regexStr += '\\' + c;
      i++;
      continue;
    } else {
      regexStr += c;
      i++;
    }
  }
  regexStr += '$';

  try {
    const re = new RegExp(regexStr);
    if (re.test(normPath)) return true;
    // Also allow basename match when pattern has no directory separator (e.g. `*.ts` matching `src/app.ts`)
    if (!normPattern.includes('/')) {
      const baseName = normPath.split('/').pop() || normPath;
      if (re.test(baseName)) return true;
    }
    return false;
  } catch (err) {
    void err;
    return normPath.includes(normPattern.replace(/[*?]/g, ''));
  }
}

function checkFilter(path: string, filter?: string | string[]): boolean {
  if (!filter) return true;
  if (Array.isArray(filter)) {
    return filter.some((f) => matchesGlob(path, f));
  }
  return matchesGlob(path, filter);
}

function createSearchResult(
  groups: SearchMatchGroup[],
  totalMatches: number,
  fileCount: number,
  query: string,
  error?: string
): SearchResult {
  const arr = [...groups];
  const result = Object.assign(arr, {
    matches: groups,
    totalMatches,
    fileCount,
    filesCount: fileCount,
    query,
    durationMs: 0,
    error
  });
  return result as SearchResult;
}

/**
 * Searches across a map of virtual files for matching text or regex patterns.
 */
export function searchInFiles(
  files: Record<string, string>,
  queryOrOptions: string | SearchOptions,
  optionsOrUndefined?: SearchOptions
): SearchResult {
  let query = '';
  let opts: SearchOptions = {};

  if (typeof queryOrOptions === 'string') {
    query = queryOrOptions;
    opts = optionsOrUndefined || {};
  } else if (queryOrOptions && typeof queryOrOptions === 'object') {
    opts = queryOrOptions;
    query = opts.query || '';
  }

  if (!query) {
    return createSearchResult([], 0, 0, query);
  }

  const isCaseSensitive = Boolean(opts.caseSensitive);
  const isWholeWord = Boolean(opts.wholeWord);
  const isRegex = Boolean(opts.regex || opts.isRegex);
  const maxMatches = opts.maxMatches ?? 10000;
  const maxMatchesPerFile = opts.maxMatchesPerFile ?? 1000;

  const includeFilter = opts.include || opts.includeGlob || opts.includePattern;
  const excludeFilter = opts.exclude || opts.excludeGlob || opts.excludePattern;

  let patternStr = isRegex ? query : escapeRegex(query);
  if (isWholeWord) {
    patternStr = `\\b${patternStr}\\b`;
  }

  let regex: RegExp = /(?:)/;
  try {
    regex = new RegExp(patternStr, isCaseSensitive ? 'g' : 'gi');
  } catch (err) {
    const _err = err;
    const msg =
      typeof _err === 'object' && _err && 'message' in _err
        ? String((_err as { message: unknown }).message)
        : 'Invalid regular expression';
    return createSearchResult([], 0, 0, query, msg);
  }

  const matchedGroups: SearchMatchGroup[] = [];
  let totalMatches = 0;

  for (const [filePath, content] of Object.entries(files)) {
    if (includeFilter && !checkFilter(filePath, includeFilter)) continue;
    if (excludeFilter && checkFilter(filePath, excludeFilter)) continue;
    if (opts.targetFiles && !opts.targetFiles.includes(filePath)) continue;

    const fileMatches: SearchMatchItem[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineText = lines[lineIndex];
      regex.lastIndex = 0;
      let m: RegExpExecArray | null = null;

      while ((m = regex.exec(lineText)) !== null) {
        const matchLen = m[0].length;
        const col = m.index + 1;
        fileMatches.push({
          line: lineIndex + 1,
          col,
          column: col,
          length: matchLen,
          matchText: m[0],
          lineText,
          beforeSnippet: lineText.slice(0, m.index),
          afterSnippet: lineText.slice(m.index + matchLen),
          matchIndex: m.index,
          matchEndIndex: m.index + matchLen
        });
        totalMatches++;

        if (fileMatches.length >= maxMatchesPerFile || totalMatches >= maxMatches) {
          break;
        }

        // Prevent infinite loop on zero-width match
        if (matchLen === 0) {
          regex.lastIndex++;
          if (regex.lastIndex > lineText.length) {
            break;
          }
        }
      }

      if (fileMatches.length >= maxMatchesPerFile || totalMatches >= maxMatches) {
        break;
      }
    }

    if (fileMatches.length > 0) {
      matchedGroups.push({
        file: filePath,
        matches: fileMatches
      });
    }

    if (totalMatches >= maxMatches) {
      break;
    }
  }

  return createSearchResult(matchedGroups, totalMatches, matchedGroups.length, query);
}

/**
 * Replaces occurrences of a query pattern across virtual workspace files.
 */
export function replaceInFiles(
  files: Record<string, string>,
  arg2: string | SearchOptions,
  arg3?: string,
  arg4?: SearchOptions | string[]
): ReplaceResult {
  let query = '';
  let replacement = typeof arg3 === 'string' ? arg3 : '';
  let opts: SearchOptions = {};
  let targetFiles: string[] | undefined = undefined;

  if (typeof arg2 === 'string') {
    query = arg2;
    if (Array.isArray(arg4)) {
      targetFiles = arg4;
    } else if (arg4 && typeof arg4 === 'object') {
      opts = arg4;
      targetFiles = opts.targetFiles;
    }
  } else if (arg2 && typeof arg2 === 'object') {
    opts = arg2;
    query = opts.query || '';
    if (typeof arg3 !== 'string' && typeof opts.replacement === 'string') {
      replacement = opts.replacement;
    }
    if (Array.isArray(arg4)) {
      targetFiles = arg4;
    } else {
      targetFiles = opts.targetFiles;
    }
  }

  if (!query) {
    const copy = { ...files };
    return {
      updatedFiles: copy,
      files: copy,
      replacedCount: 0,
      filesAffected: [],
      filesModified: 0
    };
  }

  const isCaseSensitive = Boolean(opts.caseSensitive);
  const isWholeWord = Boolean(opts.wholeWord);
  const isRegex = Boolean(opts.regex || opts.isRegex);

  const includeFilter = opts.include || opts.includeGlob || opts.includePattern;
  const excludeFilter = opts.exclude || opts.excludeGlob || opts.excludePattern;

  let patternStr = isRegex ? query : escapeRegex(query);
  if (isWholeWord) {
    patternStr = `\\b${patternStr}\\b`;
  }

  let regex: RegExp = /(?:)/;
  try {
    regex = new RegExp(patternStr, isCaseSensitive ? 'g' : 'gi');
  } catch (err) {
    void err;
    const copy = { ...files };
    return {
      updatedFiles: copy,
      files: copy,
      replacedCount: 0,
      filesAffected: [],
      filesModified: 0
    };
  }

  const updatedFiles: Record<string, string> = { ...files };
  const filesAffected: string[] = [];
  let replacedCount = 0;

  for (const [filePath, content] of Object.entries(files)) {
    if (targetFiles && !targetFiles.includes(filePath)) continue;
    if (includeFilter && !checkFilter(filePath, includeFilter)) continue;
    if (excludeFilter && checkFilter(filePath, excludeFilter)) continue;

    const lines = content.split('\n');
    let countInFile = 0;
    const newLines: string[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      regex.lastIndex = 0;
      let lineMatches = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(lineText)) !== null) {
        lineMatches++;
        if (m[0].length === 0) {
          regex.lastIndex++;
          if (regex.lastIndex > lineText.length) {
            break;
          }
        }
      }
      if (lineMatches > 0) {
        countInFile += lineMatches;
        regex.lastIndex = 0;
        if (isRegex) {
          newLines.push(lineText.replace(regex, replacement));
        } else {
          newLines.push(lineText.replace(regex, () => replacement));
        }
      } else {
        newLines.push(lineText);
      }
    }

    if (countInFile > 0) {
      updatedFiles[filePath] = newLines.join('\n');
      filesAffected.push(filePath);
      replacedCount += countInFile;
    }
  }

  return {
    updatedFiles,
    files: updatedFiles,
    replacedCount,
    filesAffected,
    filesModified: filesAffected.length
  };
}
