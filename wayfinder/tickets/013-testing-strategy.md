---
id: 013
title: Testing strategy
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [008]
---

## Question

What is the testing strategy for a published component library? Vitest + browser mode are fixed; everything else is open.

Today the internal ref has **zero tests inside packages/ui** — all component tests live in the consuming app (`test/browser/base-ui-*.test.tsx` with `@vitest/browser-playwright` + `vitest-browser-react`, needing the built `dist/index.css` and base-ui dedupe workarounds). That doesn't work for a standalone library.

Decide: in-package test layout (unit jsdom/happy-dom vs browser-mode split, kumo's `VITEST_ENV` switch), which reference tests migrate in, per-theme testing (do components get asserted under multiple brand permutations?), visual regression (kumo/base-ui both gate on it — tool choice, e.g. Argos/Playwright screenshots, and whether v1 specs it or roadmaps it), a11y test automation, export-path validation test (kumo pattern), type tests (`*.test-d.tsx`), and CI gate definition (what blocks a merge/publish).

## Resolution

Decided 2026-08-17 via grilling (one branch revisited against reference facts).

1. **Layout: two vitest projects, co-located.** `unit` (node/happy-dom: themeSlug/parseThemeSlug/validateTheme, tv recipes, exports-map logic) and `browser` (`@vitest/browser` + playwright: component behavior). `*.test.ts` / `*.browser.test.tsx` next to sources. No `VITEST_ENV` switch — projects express the split natively.
2. **Seed tests: rewrite fresh** (user call over migrate-and-adapt). The internal app's `base-ui-*.test.tsx` files are reference only; every component's tests are written new against its spec's test-requirements section.
3. **Per-theme: one default theme for functional tests + a dedicated theme-contract test** asserting all 16 themes supply their must-override tokens and the generated CSS matches the [value matrix](../research/004-theme-value-matrix.md) — pairs with [Token pipeline](018-token-pipeline.md).
4. **Visual regression: roadmap, as fogged** (user call over speccing it for v1). The demo pipeline keeps VR-target readiness designed in (plain-.tsx multi-output demos per [Docs site & playground](012-docs-and-playground.md)); the roadmap chapter carries tool choice (Playwright + Argos was the leading candidate).
5. **A11y: role-based + keyboard ("kumo+"), no axe** — decided after checking the refs: neither kumo nor coss uses any scanner; kumo's assurance is role-based queries, base-ui's is exhaustive primitive-level interaction tests we inherit. Ours: all component tests MUST query by role/label (semantics break → test breaks), plus explicit keyboard-interaction tests for each spec's a11y section on our compositions (field labeling, focus trap via container, etc.).
6. **Type tests: public-API contracts only** — `ThemeInput` union (illegal permutations must fail typecheck), variant prop unions, useRender signatures, exports-map resolution.
7. **CI gates**: merge = typecheck, oxlint (incl. anti-slop), oxfmt check, unit + browser + type tests, build. Publish adds publint, arethetypeswrong, the export-path test against the **published** shape, and the theme-contract test. VR joins the publish gate when the roadmap lands it.
