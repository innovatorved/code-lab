/**
 * @code-lab/settings — Resilient JSON with Comments (JSONC) parser.
 * Supports `//` line comments, `/* ... * /` block comments, and trailing commas,
 * returning structured 1-based line/column diagnostics instead of throwing.
 */

export interface JsoncParseError {
  readonly message: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface JsoncParseResult<T = unknown> {
  readonly value: T | undefined;
  readonly errors: readonly JsoncParseError[];
}

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let col = 1;
  const limit = Math.min(Math.max(0, offset), text.length);
  for (let i = 0; i < limit; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

export function stripJsonCommentsAndTrailingCommas(input: string): {
  cleaned: string;
  errors: JsoncParseError[];
} {
  const errors: JsoncParseError[] = [];
  const chars: string[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];
    const next = input[i + 1];

    // String literal — preserve verbatim (handling escapes)
    if (ch === '"') {
      const start = i;
      chars.push(ch);
      i++;
      let closed = false;
      while (i < len) {
        const c = input[i];
        if (c === '\\') {
          chars.push(c);
          if (i + 1 < len) {
            chars.push(input[i + 1]);
            i += 2;
          } else {
            i++;
          }
          continue;
        }
        chars.push(c);
        i++;
        if (c === '"') {
          closed = true;
          break;
        }
        if (c === '\n' || c === '\r') {
          break;
        }
      }
      if (!closed) {
        const lc = offsetToLineCol(input, start);
        errors.push({
          message: 'Unterminated string literal in JSONC',
          offset: start,
          line: lc.line,
          column: lc.column
        });
      }
      continue;
    }

    // Line comment //
    if (ch === '/' && next === '/') {
      chars.push(' ', ' ');
      i += 2;
      while (i < len && input[i] !== '\n') {
        chars.push(input[i] === '\r' ? '\r' : ' ');
        i++;
      }
      continue;
    }

    // Block comment /* ... */
    if (ch === '/' && next === '*') {
      const start = i;
      chars.push(' ', ' ');
      i += 2;
      let closed = false;
      while (i < len) {
        if (input[i] === '*' && input[i + 1] === '/') {
          chars.push(' ', ' ');
          i += 2;
          closed = true;
          break;
        }
        chars.push(input[i] === '\n' ? '\n' : input[i] === '\r' ? '\r' : ' ');
        i++;
      }
      if (!closed) {
        const lc = offsetToLineCol(input, start);
        errors.push({
          message: 'Unterminated block comment in JSONC',
          offset: start,
          line: lc.line,
          column: lc.column
        });
      }
      continue;
    }

    chars.push(ch);
    i++;
  }

  // Second pass: replace trailing commas before `}` or `]` with spaces (preserving offsets)
  for (let idx = 0; idx < chars.length; idx++) {
    if (chars[idx] === '"') {
      idx++;
      while (idx < chars.length) {
        if (chars[idx] === '\\') {
          idx += 2;
          continue;
        }
        if (chars[idx] === '"') break;
        idx++;
      }
      continue;
    }
    if (chars[idx] === ',') {
      let look = idx + 1;
      while (look < chars.length && /\s/.test(chars[look])) {
        look++;
      }
      if (look < chars.length && (chars[look] === '}' || chars[look] === ']')) {
        chars[idx] = ' ';
      }
    }
  }

  return { cleaned: chars.join(''), errors };
}

export function parseJsonc<T = unknown>(raw: string): JsoncParseResult<T> {
  if (!raw || !raw.trim()) {
    return { value: undefined, errors: [] };
  }
  const { cleaned, errors } = stripJsonCommentsAndTrailingCommas(raw);
  try {
    const parsed = JSON.parse(cleaned) as T;
    return { value: parsed, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const posMatch = /position\s+(\d+)/i.exec(msg);
    const lineColMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(msg);
    const offset = posMatch ? Number(posMatch[1]) : 0;
    const lc = posMatch
      ? offsetToLineCol(raw, offset)
      : lineColMatch
        ? { line: Number(lineColMatch[1]), column: Number(lineColMatch[2]) }
        : offsetToLineCol(raw, raw.length);
    return {
      value: undefined,
      errors: [
        ...errors,
        {
          message: msg,
          offset,
          line: lc.line,
          column: lc.column
        }
      ]
    };
  }
}
