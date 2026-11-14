# E2E Test Suite Ready

## Test Runner
- Command: `node tests/vscode-e2e/run-e2e.js`
- Expected: all tests pass with exit code 0
- Tier Commands (for sequential Milestone M4 Tier 1 → 2 → 3 → 4 execution):
  - Tier 1 (`66` tests): `node tests/vscode-e2e/run-e2e.js --tier=1`
  - Tier 2 (`64` tests): `node tests/vscode-e2e/run-e2e.js --tier=2`
  - Tier 3 (`20` tests): `node tests/vscode-e2e/run-e2e.js --tier=3`
  - Tier 4 (`10` tests): `node tests/vscode-e2e/run-e2e.js --tier=4`
  - Discovery only: `node tests/vscode-e2e/run-e2e.js --list`
  - Filter by ID/feature: `node tests/vscode-e2e/run-e2e.js --grep="T1-F1"`
  - Isolated server port: `127.0.0.1:4273` (configurable via `VSCODE_E2E_PORT=4273`; see `TEST_INFRA.md` for full harness architecture)

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 66 | 5–6 happy-path category-partition tests per feature (`F1`–`F12`) across `/workbench` and `/cloud-ide` (`tier1-*.spec.ts`) |
| 2. Boundary & Corner | 64 | 5–6 boundary, negative, error-recovery, and corner-case tests per feature (`F1`–`F12`) (`tier2-*.spec.ts`) |
| 3. Cross-Feature | 20 | 2-way and 3-way pairwise cross-feature interaction tests covering all `F1`–`F12` (`tier3-cross-feature.spec.ts`) |
| 4. Real-World Application | 10 | 8 end-to-end developer workflows + 2 explicit 11-point VS Code UI/UX Parity Checklist Audits on `/workbench` (`T4-09`) and `/cloud-ide` (`T4-10`) (`tier4-real-world-and-parity-audit.spec.ts`) |
| **Total** | **160** | Hermetic headless Chromium `@playwright/test` suite (`>= 146` threshold met and exceeded) |

## Feature Checklist
| Feature | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---------|:------:|:------:|:------:|:------:|
| F1: VS Code Title & Menu Bar Navigation | 6 | 5 | ✓ | ✓ |
| F2: VS Code Activity Bar & Collapsible Primary Sidebar | 5 | 5 | ✓ | ✓ |
| F3: Dedicated Bottom Panel & Sidebar-Terminal Separation | 5 | 5 | ✓ | ✓ |
| F4: Folder & File Explorer Sidebar | 6 | 6 | ✓ | ✓ |
| F5: Non-Destructive `Blank IDE` & Workspace Isolation | 5 | 5 | ✓ | ✓ |
| F6: End-to-End Non-Destructive `Clone Repo` | 6 | 6 | ✓ | ✓ |
| F7: End-to-End `Search` & Replace Sidebar View | 6 | 5 | ✓ | ✓ |
| F8: End-to-End `Source Control` (Git) Sidebar View | 6 | 5 | ✓ | ✓ |
| F9: End-to-End `Problems` Panel & Live Diagnostics | 5 | 5 | ✓ | ✓ |
| F10: Multi-Session `Terminal` Panel | 5 | 5 | ✓ | ✓ |
| F11: Non-Destructive `Settings` Editor Tab & Live Wiring | 6 | 6 | ✓ | ✓ |
| F12: UI/UX Rough Edges, Theme Contrast & Parity Polish | 5 | 6 | ✓ | ✓ |
