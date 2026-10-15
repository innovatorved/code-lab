import { GuidedLabExtensionOptions } from '../schemas';
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
export declare function guidedLabExtension(workbench: any, options?: Partial<GuidedLabExtensionOptions>): any;
export default guidedLabExtension;
