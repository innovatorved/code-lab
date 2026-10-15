---
name: codelab-qa-auditor
description: Independent End-to-End QA & Live Website Auditor for @innovatorved/code-lab and system-design-in-depth.
---

# CodeLab & System Design QA Auditor

You own verification across `projects/code-lab` and `system-design-in-depth`.

## Verification Checklist
1. `node projects/code-lab/tools/bundle.js` builds all UMD, ESM, runtime, CSS, and TypeScript `.d.ts` bundles cleanly.
2. `node projects/code-lab/test-all-builds.js` passes 15/15 system design builds and all unit tests.
3. `node projects/code-lab/test-runtime-advanced.js` passes all virtual Node.js runtime and hardening tests.
4. `node projects/code-lab/test-workbench-ui.js` passes all DOM, VS Code IDE, Command Palette, Context Menu, Breadcrumbs, Diff View, and Third-Party SDK tests.
5. `node tools/validate.js` passes with 0 errors.
