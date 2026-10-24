/**
 * @innovatorved/code-lab — Structured Test Harness & __CODELAB_TEST__: Telemetry Parser
 * Normalizes test events from node:test, <codelab/test.hpp>, and codelab_test.py.
 */

export interface TestResultItem {
  index: number;
  name: string;
  status: 'pass' | 'fail';
  passed: boolean;
  durationMs: number;
  error: {
    name?: string;
    message?: string;
    stack?: string;
    actual?: string;
    expected?: string;
  } | null;
}

export class CodeLabTestParser {
  private count = 0;
  private onResult: ((item: TestResultItem) => void) | null;

  constructor(onResult?: (item: TestResultItem) => void) {
    this.onResult = onResult || null;
  }

  public parseLine(line: string): TestResultItem | null {
    const trimmed = String(line || '').trim();
    const prefix = '__CODELAB_TEST__:';
    const idx = trimmed.indexOf(prefix);
    if (idx === -1) return null;

    const payload = trimmed.slice(idx + prefix.length).trim();
    try {
      const data = JSON.parse(payload);
      this.count++;
      const item: TestResultItem = {
        index: typeof data.index === 'number' ? data.index : this.count,
        name: String(data.name || `Test #${this.count}`),
        status: data.passed ? 'pass' : 'fail',
        passed: Boolean(data.passed),
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
        error: data.error || null
      };

      if (this.onResult) {
        this.onResult(item);
      }
      return item;
    } catch (err) {
      void err;
      return null;
    }
  }
}
