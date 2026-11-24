/**
 * @innovatorved/code-lab — VS Code Quick Open & Fuzzy Command Palette (Cmd+P / Cmd+Shift+P / F1)
 */

export interface CommandPaletteItem {
  id: string;
  label: string;
  category?: string;
  detail?: string;
  shortcut?: string;
  action: () => void;
}

export interface FuzzyMatchResult {
  score: number;
  indices: number[];
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * VS Code-style subsequence fuzzy matcher with bonuses for consecutive matches,
 * word-boundary / camelCase transitions, and prefix alignment.
 */
export function fuzzyScoreText(query: string, candidate: string): FuzzyMatchResult | null {
  const q = String(query || '').trim();
  const text = String(candidate || '');
  if (!q) return { score: 1, indices: [] };

  const qLower = q.toLowerCase();
  const tLower = text.toLowerCase();

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  const indices: number[] = [];

  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      indices.push(ti);
      score += 10;

      if (indices.length > 1 && indices[indices.length - 2] === ti - 1) {
        consecutive++;
        score += 12 + consecutive * 4;
      } else {
        consecutive = 0;
      }

      if (ti === 0) {
        score += 25;
      } else {
        const prev = text[ti - 1];
        const curr = text[ti];
        if (prev === '/' || prev === '\\' || prev === '-' || prev === '_' || prev === '.' || prev === ' ' || prev === ':') {
          score += 18;
        } else if (prev >= 'a' && prev <= 'z' && curr >= 'A' && curr <= 'Z') {
          score += 14;
        }
      }

      if (text[ti] === q[qi]) score += 2;
      qi++;
    }
  }

  if (qi < qLower.length) return null;

  score -= Math.min(20, Math.floor((text.length - q.length) / 4));
  if (tLower === qLower) score += 100;
  else if (tLower.startsWith(qLower)) score += 45;

  return { score, indices };
}

export function renderHighlightedText(text: string, indices: number[]): string {
  if (!indices || indices.length === 0) return escapeHtml(text);
  const set = new Set(indices);
  let html = '';
  let inMark = false;
  for (let i = 0; i < text.length; i++) {
    const matched = set.has(i);
    if (matched && !inMark) {
      html += '<mark class="codelab-palette-hl">';
      inMark = true;
    } else if (!matched && inMark) {
      html += '</mark>';
      inMark = false;
    }
    html += escapeHtml(text[i]);
  }
  if (inMark) html += '</mark>';
  return html;
}
