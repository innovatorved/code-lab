/**
 * @innovatorved/code-lab — Guided Pane: Walkthrough Stepper, Hints & Verification
 */

import { CL_ICONS } from './icons';

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface GuidedStepData {
  id: string;
  title: string;
  instructions: string | string[];
  hint?: string;
  testNames?: string[];
}

export function renderStepPillsHtml(steps: GuidedStepData[], activeIndex: number, completedStepIds: Set<string>): string {
  if (!steps || steps.length === 0) return '';

  return `
    <div class="codelab-stepper" role="tablist" aria-label="Step progress">
      ${steps.map((step, idx) => {
        const isPassed = completedStepIds.has(step.id);
        const isActive = idx === activeIndex;
        const cls = `codelab-step-pill ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`;
        const safeTitle = escapeHtml(step.title);
        return `
          <button type="button" role="tab" aria-selected="${isActive}" class="${cls}" data-cl-step="${idx}" title="Step ${idx + 1}: ${safeTitle}">
            <span class="codelab-step-pill__num">${isPassed ? CL_ICONS.check : idx + 1}</span>
            <span class="codelab-step-pill__label">${safeTitle}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}
