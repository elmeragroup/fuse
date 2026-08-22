---
id: 026
title: A11y & performance guideline chapters
type: grilling
status: closed
assignee: tommy
blocked-by: []
---

## Question

The spec requires accessibility and performance guideline chapters. Their inputs are now fixed: the template's per-component a11y section ([Component API spec template](011-component-api-spec-template.md)), the role-based + keyboard testing bar ([Testing strategy](013-testing-strategy.md)), useRender/container conventions, and the bundle decisions (per-icon exports, barrel scope, sideEffects) from [Package architecture](008-package-architecture.md) and [Icon system](009-icon-system.md).

Handed over from [Spec: data display & feedback](023-spec-data-display.md): rule the base-ui Item list-semantics gap (Item.Group renders `role="list"` but Item has no `listitem` default — specs currently push the role to consumers).

Decide and draft: the a11y chapter (target conformance level — e.g. WCAG 2.2 AA, keyboard/focus conventions across the library, labeling rules for field compositions, contrast expectations per theme incl. known ref oddities like the shared violet ring on brand surfaces) and the performance chapter (bundle budgets per entry, RSC/client-boundary policy for each component tier, CSS size expectations, lazy-loading guidance for heavy composites like chart/date). Deliverable: the two chapter drafts under docs/spec/, linked here.

## Assets

- [docs/spec/accessibility.md](../../docs/spec/accessibility.md) — the a11y chapter draft
- [docs/spec/performance.md](../../docs/spec/performance.md) — the performance chapter draft
- [ADR 0006 — intl strings](../../docs/adr/0006-intl-strings.md)
- react-aria intl research (mechanism, bundle costs, reusable packages, ESM gotchas) — summarized in ADR 0006's context; full findings folded into the chapter's §4

## Resolution

Decided 2026-08-18 via grilling (two rounds + one research pass into `.ref/react-spectrum`). Both chapters drafted (assets above). The decisions:

**Accessibility chapter**

1. **WCAG 2.2 AA as design target**, no formal conformance claim; library/app responsibility split stated explicitly (EN 301 549 / 2.1 AA legal floor noted).
2. **Contrast**: token values stay locked; text-grade roles must meet 4.5:1 in all 16 themes; `feature-foreground` reclassified accent/decorative (text on feature panels is white); three documented accepted deviations (muted-foreground at the AA line, violet ring <3:1 on strong fills mitigated by mandatory ring-offset, feature tints); per-brand ring re-mint is a roadmap item; generated per-theme contrast matrix as a snapshot test.
3. **Focus**: `:focus-visible` only, mandatory `focusRing` recipe `ring-2 ring-ring ring-offset-2`, base-ui keyboard patterns verbatim, no positive tabindex, skip-links/landmarks app-side.
4. **Labeling**: Field is the canonical mechanism; TS-enforced `aria-label` for icon-only triggers (discriminated union); no dev-mode runtime label warnings.
5. **Strings/i18n (supersedes the required-props idea)**: adopt react-aria's model at our scale — public `@internationalized/string` runtime (~1 kB, dep-free), plain TS per-locale modules per component (no glob imports, no string-compiler, no subsetting plugin), locales **nb-NO, sv-SE, en-US, fi-FI** eager; locale held once on `ElmeraGroupUiProvider` (required, union-typed) and read via context — never passed per component; string props override dictionary defaults; [ADR 0006](../../docs/adr/0006-intl-strings.md).
6. **Item gap (from data-display)**: our Item auto-adopts `role="listitem"` inside Item.Group via context, overridable — ruled, divergence to be recorded in the item spec.
7. **Motion**: one central `prefers-reduced-motion` block (movement removed, opacity kept) + normative 150–300 ms ease-out band as review bar.

**Performance chapter** 8. **Budgets**: size-limit in CI over published artifacts, per-subpath + root barrel + themes.css; provisional ceilings in the chapter, calibrated to measured × ~1.5 at first build, ratchet-down-only thereafter. 9. **RSC**: default server-safe, `"use client"` only where interactivity lives; RSC status is a spec/API-table column; server→client flips are breaking; no `-client` wrapper entries. 10. **Lazy loading**: never internal (no dynamic `import()` in library source — lintable); docs ship next/dynamic + React.lazy recipes for chart and the date cluster; recharts stays optional peer. 11. **Runtime**: transform/opacity-only animation, memoized contexts, no per-frame CSS-var writes on ancestors; i18n eager-locale cost accepted with a documented ~10-locale revisit threshold.

Follow-ups pushed into existing places: item spec divergence (§6 above) belongs to Spec assembly's cross-check; ring re-mint + locale-subsetting threshold + nn-NO go to the roadmap document.
