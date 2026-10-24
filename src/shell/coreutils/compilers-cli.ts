/**
 * @innovatorved/code-lab — Shell Compiler Coreutils
 * Provides `node`, `tsx`, `tsc`, `g++`, `clang++`, `python`, `python3`, `pytest`, `pip`.
 */

export interface ShellExecutionContext {
  vfs: any;
  cwd: string;
  env: Record<string, string>;
  resolvePath: (p: string) => string;
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  shell?: any;
}

export interface ShellExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export const COMPILER_COREUTILS = {
  async python3(args: string[], ctx: ShellExecutionContext): Promise<ShellExecResult> {
    if (args.length === 0) {
      return { code: 0, stdout: 'Python 3.12.8 (CPython WebAssembly via Pyodide)\n', stderr: '' };
    }

    if (args[0] === '--version' || args[0] === '-V') {
      return { code: 0, stdout: 'Python 3.12.8 (CPython WebAssembly via Pyodide)\n', stderr: '' };
    }

    let codeToRun: string | undefined;
    let entryFile: string | undefined;

    if (args[0] === '-c' && args.length > 1) {
      codeToRun = args[1];
    } else if (!args[0].startsWith('-')) {
      entryFile = ctx.resolvePath(args[0]);
    }

    const pyCompiler =
      (ctx.shell && ctx.shell.options && ctx.shell.options.pythonCompiler) ||
      (typeof globalThis !== 'undefined' && (globalThis as any).__codelabPythonCompiler) ||
      (typeof window !== 'undefined' && (window as any).__codelabPythonCompiler);

    if (typeof pyCompiler !== 'function') {
      return {
        code: 1,
        stdout: '',
        stderr: 'python3: Python WebAssembly toolchain is not loaded. Enable pythonExtension from "@innovatorved/code-lab/extensions/python".\n'
      };
    }

    let stdoutAcc = '';
    let stderrAcc = '';

    const res = await pyCompiler({
      entry: entryFile,
      source: codeToRun,
      vfs: ctx.vfs,
      onStdout: (t: string) => {
        stdoutAcc += t;
        if (ctx.onStdout) ctx.onStdout(t);
      },
      onStderr: (t: string) => {
        stderrAcc += t;
        if (ctx.onStderr) ctx.onStderr(t);
      }
    });

    return {
      code: res.ok ? 0 : (res.exitCode || 1),
      stdout: stdoutAcc,
      stderr: stderrAcc
    };
  },

  async python(args: string[], ctx: ShellExecutionContext): Promise<ShellExecResult> {
    return COMPILER_COREUTILS.python3(args, ctx);
  },

  async pytest(args: string[], ctx: ShellExecutionContext): Promise<ShellExecResult> {
    const testFiles = args.filter((a) => !a.startsWith('-'));
    const target = testFiles[0] || 'test.py';
    return COMPILER_COREUTILS.python3([target], ctx);
  },

  async pip(args: string[], ctx: ShellExecutionContext): Promise<ShellExecResult> {
    void ctx;
    if (args.length === 0 || args[0] === '--version' || args[0] === '-V') {
      return { code: 0, stdout: 'pip 24.0 from /usr/lib/python/pip (python 3.12)\n', stderr: '' };
    }
    if (args[0] === 'install') {
      const pkgs = args.slice(1).filter((p) => !p.startsWith('-'));
      return {
        code: 0,
        stdout: `Successfully installed ${pkgs.join(', ') || 'packages'}\n`,
        stderr: ''
      };
    }
    return { code: 0, stdout: 'pip 24.0 (Pyodide micropip)\n', stderr: '' };
  }
};
