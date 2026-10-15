import {
  GuidedLabExtensionOptions,
  GuidedLabExtensionOptionsSchema,
  GuidedStep
} from '../schemas';

/**
 * Guided Lab Extension for CodeLab
 *
 * Provides TutorialKit / Codedamn-style interactive curriculum challenges:
 * - Step-by-step instructions pane with architectural notes & hints
 * - 'Guided Challenge' vs 'Reference Sandbox' mode switcher
 * - 'Verify Step' test runner for targeted validation
 * - Reference solution diff viewer
 * - Multi-language (JS/TS) curriculum switching
 */
export function guidedLabExtension(workbench: any, options: Partial<GuidedLabExtensionOptions> = {}) {
  const parsed = GuidedLabExtensionOptionsSchema.partial().parse(options);

  workbench.hasGuidedLab = true;
  if (parsed.steps && parsed.steps.length > 0) {
    workbench.steps = parsed.steps;
  }
  if (parsed.mode) {
    workbench.mode = parsed.mode;
  }
  if (typeof parsed.stepIndex === 'number') {
    workbench.activeStepIndex = parsed.stepIndex;
  }

  workbench.guidedConfig = {
    ...workbench.guidedConfig,
    ...parsed,
    steps: workbench.steps
  };

  if (parsed.tsStarterFiles || parsed.tsSolutionFiles || parsed.tsFiles) {
    workbench.hasMultipleLanguages = true;
  }

  if (typeof workbench._renderShell === 'function' && workbench.container) {
    workbench._renderShell();
    if (typeof workbench._bindEvents === 'function') {
      workbench._bindEvents();
    }
    if (typeof workbench._renderFileLists === 'function') {
      workbench._renderFileLists();
    }
  }

  return workbench;
}

export default guidedLabExtension;
