## Summary
- What problem does this PR solve, and which `@code-lab/*` package(s) are touched?

## Architecture & Quality Checklist
- [ ] `bun run build` succeeds and `dist/` remains uncommitted (`git status` clean)
- [ ] `bun run check:boundaries` passes (0 layer violations, 0 circular dependencies)
- [ ] `bun run check:size` passes (`@innovatorved/code-lab/sql` < 35 KB gzipped)
- [ ] `bun run lint`, `bun run typecheck`, and `bun run typecheck:strict` pass
- [ ] `bun run test` and `node tests/run-all.js` pass all suites
- [ ] `bun run test:browser` passes Playwright Chromium E2E specs
- [ ] Regression test added in `tests/`
