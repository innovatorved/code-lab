import { z } from 'zod';

/**
 * Zod Schemas and Inferred TypeScript Types for code-lab v0.1.9
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

// ── 8. Search Options & Match Results ────────────────────────────────────────

export const SearchOptionsSchema = z.object({
  query: z.string().default(''),
  caseSensitive: z.boolean().optional().default(false),
  wholeWord: z.boolean().optional().default(false),
  regex: z.boolean().optional().default(false),
  isRegex: z.boolean().optional().default(false),
  include: z.string().optional(),
  includeGlob: z.string().optional(),
  includePattern: z.union([z.string(), z.array(z.string())]).optional(),
  exclude: z.string().optional(),
  excludeGlob: z.string().optional(),
  excludePattern: z.union([z.string(), z.array(z.string())]).optional(),
  maxMatches: z.number().int().positive().optional(),
  maxMatchesPerFile: z.number().int().positive().optional()
});

export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

// ── 9. Diagnostic Item & Problems ───────────────────────────────────────────

export const DiagnosticSeveritySchema = z.enum(['error', 'warning', 'info', 'hint']);
export type DiagnosticSeverity = z.infer<typeof DiagnosticSeveritySchema>;

export const DiagnosticItemSchema = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number().int(),
  col: z.number().int().optional(),
  column: z.number().int().optional(),
  endLine: z.number().int().optional(),
  endCol: z.number().int().optional(),
  endColumn: z.number().int().optional(),
  message: z.string(),
  severity: DiagnosticSeveritySchema,
  source: z.string().optional(),
  code: z.union([z.string(), z.number()]).optional(),
  tags: z.array(z.string()).optional()
});

export type DiagnosticItem = z.infer<typeof DiagnosticItemSchema>;

// ── 10. Stored Project ──────────────────────────────────────────────────────

export const StoredProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  files: z.record(z.string()),
  updatedAt: z.number(),
  createdAt: z.number().optional(),
  entry: z.string().optional(),
  testEntry: z.string().optional(),
  version: z.number().optional()
});

export type StoredProject = z.infer<typeof StoredProjectSchema>;

// ── 11. Git File Status & SCM Summary ───────────────────────────────────────

export const GitFileChangeTypeSchema = z.enum(['modified', 'added', 'deleted', 'untracked']);
export type GitFileChangeType = z.infer<typeof GitFileChangeTypeSchema>;

export const GitFileStatusSchema = z.object({
  path: z.string(),
  status: GitFileChangeTypeSchema,
  staged: z.boolean(),
  oldContent: z.string().optional(),
  newContent: z.string().optional()
});

export type GitFileStatus = z.infer<typeof GitFileStatusSchema>;

export const GitStateSummarySchema = z.object({
  branch: z.string().default('main'),
  headCommit: z.string().optional(),
  branches: z.array(z.string()).default(['main']),
  staged: z.array(GitFileStatusSchema).default([]),
  unstaged: z.array(GitFileStatusSchema).default([]),
  untracked: z.array(GitFileStatusSchema).default([]),
  modified: z.array(GitFileStatusSchema).optional(),
  deleted: z.array(GitFileStatusSchema).optional(),
  hasChanges: z.boolean().default(false),
  isClean: z.boolean().default(true),
  ahead: z.number().int().default(0),
  behind: z.number().int().default(0)
});

export type GitStateSummary = z.infer<typeof GitStateSummarySchema>;
