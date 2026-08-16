---
id: 013
title: Testing strategy
type: grilling
status: open
assignee: null
blocked-by: [008]
---

## Question

What is the testing strategy for a published component library? Vitest + browser mode are fixed; everything else is open.

Today the internal ref has **zero tests inside packages/ui** — all component tests live in the consuming app (`test/browser/base-ui-*.test.tsx` with `@vitest/browser-playwright` + `vitest-browser-react`, needing the built `dist/index.css` and base-ui dedupe workarounds). That doesn't work for a standalone library.

Decide: in-package test layout (unit jsdom/happy-dom vs browser-mode split, kumo's `VITEST_ENV` switch), which reference tests migrate in, per-theme testing (do components get asserted under multiple brand permutations?), visual regression (kumo/base-ui both gate on it — tool choice, e.g. Argos/Playwright screenshots, and whether v1 specs it or roadmaps it), a11y test automation, export-path validation test (kumo pattern), type tests (`*.test-d.tsx`), and CI gate definition (what blocks a merge/publish).
