---
id: 009
title: Icon system
type: grilling
status: closed
assignee: tommy.lunde.barvag
blocked-by: [007]
---

## Question

What is the icon system? The refs conflict: internal re-exports ~180 **lucide-react** icons under one `Icon` object; external ships 78 **material-icons SVGs** compiled via `@svgr/webpack` (a build-time dependency a published package cannot impose on consumers) plus hand-written logo components.

Decide: one icon family (lucide vs material vs both during transition), delivery mechanism (pre-compiled React components — no SVGR requirement on consumers), the `Icon.*` namespace API, brand/segment logo components (`BrandLogo` switching on brand incl. Telinet-for-fkse), tree-shaking (180 re-exports in one object defeats it — namespace object vs per-icon exports), and where logos live given the licensing outcome of _Brand assets & licensing_.

## Resolution

Decided 2026-08-17 via grilling. **The icon family is Phosphor Icons** — a user-directed pivot away from _both_ reference families (internal lucide, external Material — Material abolished outright). Suitability established by [009-phosphor-icons.md](../research/009-phosphor-icons.md) (MIT, ESM tree-shakeable, 232/232 UI-concept coverage measured against @phosphor-icons/core, animatable spinners). Rationale in [ADR 0004](../../docs/adr/0004-phosphor-icons.md).

1. **Family**: Phosphor only. Every ported external component swaps MaterialIcon → Phosphor; internal components swap lucide → Phosphor. The spec's icon chapter carries the curated ~150-icon lucide→Phosphor name mapping (loader: `SpinnerGap`/`CircleNotch`; known substitutions: `activity`→`pulse`, `meter`→`gauge`).
2. **Delivery**: curated **per-icon named re-exports** from `@elmeragroup/ui/icons` over `@phosphor-icons/react` — pinned version, regular dependency, library adds its own `'use client'` banner (upstream dist lacks one). No `Icon` namespace object (tree-shaking). ESM-only publishing (already the tsdown template) sidesteps the upstream CJS monolith. **Accepted trade-off**: each used icon bundles all six weights (~0.8 KB gzip/icon); codegen-from-core is documented as the future optimization if that bites.
3. **Weights**: components render `regular` everywhere; re-export types narrow `weight` to `'regular' | 'fill'` (fill for selected/active states) — type-level guidance only, per the re-export interpretation the user confirmed explicitly.
4. **Bespoke assets**: all precompiled React components (no SVGR requirement on consumers). Payment/signing marks (BankID×2, Vipps, Signing, Contract, StromSmart, Alert, HomeTitle) and product logos (Order/Collect/Deviate/Funnel, DoubleCheck) as per-exports in `/icons`; brand artwork (`FkasMeter`, growing per brand) as per-exports in `/illustrations`.
5. **Logos**: one component per brand with `variant="full" | "mark"` replacing the `*Small`/`*Mini` pairs; `BrandLogo` switches on brand code via the `BRANDS` record (fkas/fkab → Fjordkraft, tkas → Trøndelagkraft, guen → Gudbrandsdal, fkse → **Telinet**). Roster additionally keeps `ElmeraGroupLogo` (neutral fallback) **and Steddi + Trumf logos** (user call: internal tools render them today, despite the brands being out of theming scope). The orphaned NGE-Sweden logo is dropped. **Contingency**: shipping logos in the public npm package depends on the licensing outcome of [Brand assets & licensing](010-brand-assets-licensing.md) (noted there); fallback is a private assets package. _Update 2026-08-17: contingency cleared — Brand assets & licensing resolved logos-public; the roster ships in `@elmeragroup/ui/icons` as decided here._
