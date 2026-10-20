import { z } from 'zod';

/**
 * Zod Schemas and Inferred TypeScript Types for code-lab v0.1.7
 */

// ── 1. Guided Step ──────────────────────────────────────────────────────────

export const GuidedStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  concept: z.string().optional(),
  targetFile: z.string().optional(),
  targetSymbol: z.string().optional(),
  symbol: z.string().optional(), // alias for targetSymbol
  instructions: z.union([z.string(), z.array(z.string())]),
  hint: z.string().optional(),
  testNames: z.array(z.string()).optional()
});

export type GuidedStep = z.infer<typeof GuidedStepSchema>;

// ── 2. Language Bundle ──────────────────────────────────────────────────────

export const LanguageBundleSchema = z.object({
  language: z.enum(['js', 'ts']).default('js'),
  files: z.record(z.string()).default({}),
  starterFiles: z.record(z.string()).optional(),
  solutionFiles: z.record(z.string()).optional(),
  entry: z.string().optional(),
  testEntry: z.string().optional()
});

export type LanguageBundle = z.infer<typeof LanguageBundleSchema>;

// ── 3. Guided Lab Extension Options ─────────────────────────────────────────

export const GuidedLabExtensionOptionsSchema = z.object({
  steps: z.array(GuidedStepSchema).default([]),
  stepIndex: z.number().int().nonnegative().default(0),
  mode: z.enum(['guided', 'sandbox']).default('guided'),
  language: z.enum(['js', 'ts']).optional(),
  lang: z.enum(['js', 'ts']).optional(),
  starterFiles: z.record(z.string()).optional(),
  solutionFiles: z.record(z.string()).optional(),
  tsStarterFiles: z.record(z.string()).optional(),
  tsSolutionFiles: z.record(z.string()).optional(),
  tsFiles: z.record(z.string()).optional(),
  summary: z.string().optional(),
  onStepComplete: z.function().args(GuidedStepSchema, z.number()).returns(z.void()).optional(),
  onLabComplete: z.function().args(z.string()).returns(z.void()).optional()
});

export type GuidedLabExtensionOptions = z.infer<typeof GuidedLabExtensionOptionsSchema>;

// ── 4. GitHub Clone Options & Progress ──────────────────────────────────────

export const CloneProgressPhaseSchema = z.enum([
  'connecting',
  'metadata',
  'downloading',
  'mounting',
  'ready',
  'error'
]);

export type CloneProgressPhase = z.infer<typeof CloneProgressPhaseSchema>;

export const CloneProgressEventSchema = z.object({
  phase: CloneProgressPhaseSchema,
  message: z.string(),
  loaded: z.number().optional(),
  total: z.number().optional()
});

export type CloneProgressEvent = z.infer<typeof CloneProgressEventSchema>;

export const GitHubCloneOptionsSchema = z.object({
  intoRoot: z.boolean().default(true),
  targetDir: z.string().default('/workspace'),
  branch: z.string().optional(),
  depth: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().default(2000),
  maxFileSize: z.number().int().positive().default(5 * 1024 * 1024),
  concurrency: z.number().int().positive().default(8),
  clearExisting: z.boolean().default(false),
  onProgress: z.function().args(z.any()).returns(z.void()).optional(),
  fetchImpl: z.any().optional()
});

export type GitHubCloneOptions = z.infer<typeof GitHubCloneOptionsSchema>;

// ── 5. Runtime Execution Options ────────────────────────────────────────────

export const RuntimeExecuteOptionsSchema = z.object({
  files: z.record(z.string()).optional(),
  entry: z.string().optional(),
  mode: z.enum(['run', 'test', 'repl']).default('run'),
  replCode: z.string().optional(),
  printReplResult: z.boolean().optional(),
  testFilter: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  timeoutMs: z.number().positive().default(30000),
  maxOutputBytes: z.number().positive().default(256 * 1024),
  maxConsoleCalls: z.number().positive().default(5000),
  instanceId: z.string().optional(),
  concurrent: z.boolean().optional(),
  argv: z.union([z.array(z.string()), z.null()]).optional(),
  pid: z.number().int().optional(),
  isBackground: z.boolean().optional(),
  vfs: z.any().optional(),
  activePortTable: z.any().optional(),
  packages: z.record(z.any()).optional(),
  npmModules: z.record(z.any()).optional(),
  onStdout: z.function().args(z.string()).returns(z.void()).optional(),
  onStderr: z.function().args(z.string()).returns(z.void()).optional(),
  onTestResult: z.function().args(z.any()).returns(z.void()).optional()
});

export type RuntimeExecuteOptions = z.infer<typeof RuntimeExecuteOptionsSchema>;

// ── 6. Workspace Snapshot ───────────────────────────────────────────────────

export const WorkspaceSnapshotSchema = z.object({
  version: z.number().default(1),
  timestamp: z.number().optional(),
  files: z.record(z.string()),
  openTabs: z.array(z.string()).default([]),
  activeFile: z.string().nullable().optional(),
  mode: z.enum(['guided', 'sandbox']).optional(),
  lang: z.enum(['js', 'ts']).optional(),
  labId: z.string().optional()
});

export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

// ── 7. Workbench Options ────────────────────────────────────────────────────

export const WorkbenchOptionsSchema = z.object({
  id: z.string().optional(),
  labId: z.string().optional(),
  buildId: z.string().optional(),
  title: z.string().default('code-lab'),
  summary: z.string().optional(),
  theme: z.enum(['dark', 'light', 'auto']).default('auto'),
  persistState: z.boolean().default(true),
  repo: z.string().optional(),
  githubRepo: z.string().optional(),
  branch: z.string().optional(),
  files: z.record(z.string()).default({}),
  entry: z.string().default('demo.js'),
  testEntry: z.string().default('test.js'),
  testFile: z.string().optional(),
  backLabel: z.string().default('Back'),
  monacoUrl: z.string().optional(),
  previewOrigin: z.string().optional(),
  logger: z.any().optional(),
  debug: z.boolean().optional(),
  onClose: z.function().returns(z.void()).optional(),
  onRun: z.function().args(z.any()).returns(z.void()).optional(),
  onTestResult: z.function().args(z.any()).returns(z.void()).optional(),
  onCodeChange: z.function().args(z.string(), z.string()).returns(z.void()).optional(),
  plugins: z.array(z.any()).optional(),
  extensions: z.array(z.any()).optional(),
  // Backward-compatible guided lab properties:
  steps: z.array(GuidedStepSchema).optional(),
  starterFiles: z.record(z.string()).optional(),
  solutionFiles: z.record(z.string()).optional(),
  tsFiles: z.record(z.string()).optional(),
  tsStarterFiles: z.record(z.string()).optional(),
  tsSolutionFiles: z.record(z.string()).optional(),
  guided: z.any().optional(),
  mode: z.enum(['guided', 'sandbox']).optional(),
  language: z.enum(['js', 'ts']).optional(),
  lang: z.enum(['js', 'ts']).optional(),
  stepIndex: z.number().int().optional(),
  onStepComplete: z.function().args(z.any(), z.number()).returns(z.void()).optional(),
  onLabComplete: z.function().args(z.string()).returns(z.void()).optional()
});

export type WorkbenchOptions = z.infer<typeof WorkbenchOptionsSchema>;
