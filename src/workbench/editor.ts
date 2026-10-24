/**
 * @innovatorved/code-lab — Monaco Editor Host, Model Lifecycle & Formatting
 */

export interface EditorPosition {
  lineNumber: number;
  column: number;
}

/**
 * Normalizes C++ source indentation and braces.
 */
export function formatCppSource(code: string): string {
  if (!code || typeof code !== 'string') return code;
  const lines = code.split('\n');
  const formatted: string[] = [];
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      formatted.push('');
      continue;
    }

    if (trimmed.startsWith('#')) {
      formatted.push(trimmed);
      continue;
    }

    // Dedent for closing brace
    let currentIndent = indentLevel;
    if (trimmed.startsWith('}') || trimmed.startsWith(');') || trimmed.startsWith('public:') || trimmed.startsWith('private:') || trimmed.startsWith('protected:')) {
      currentIndent = Math.max(0, indentLevel - 1);
    }

    formatted.push('  '.repeat(currentIndent) + trimmed);

    // Update indentLevel
    for (let c = 0; c < trimmed.length; c++) {
      if (trimmed[c] === '{') indentLevel++;
      else if (trimmed[c] === '}') indentLevel = Math.max(0, indentLevel - 1);
    }
  }

  return formatted.join('\n');
}
