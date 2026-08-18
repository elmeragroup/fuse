# 0004 — Phosphor Icons as the single icon family

Date: 2026-08-17. Status: accepted.

## Context

The two reference codebases use different icon families: internal re-exports ~150 curated **lucide-react** icons; external ships 78 **Material Symbols** SVGs compiled via @svgr/webpack — a build-time requirement a published package cannot impose, and a set used *inside* external components, gating every port. The library needs exactly one family. The owner directed a pivot to **Phosphor Icons**; research (wayfinder research 009) verified suitability: MIT, zero deps, ESM `sideEffects:false` per-icon tree-shaking, 1,512 icons × 6 weights, 232/232 coverage of the curated UI concepts, animatable spinners.

## Decision

**Phosphor is the only icon family.** `@elmeragroup/ui/icons` ships curated per-icon named re-exports over `@phosphor-icons/react` (pinned version, regular dependency, our own `'use client'` banner since upstream lacks one). No namespace `Icon` object — per-icon exports tree-shake. ESM-only publishing avoids upstream's 5 MB CJS monolith. Components render `regular` weight everywhere; re-export types narrow `weight` to `'regular' | 'fill'`. Bespoke SVGs (payment/signing/product marks, brand illustrations) ship as precompiled React components in `/icons` and `/illustrations`. Brand logos: one component per brand with `variant="full" | "mark"`; `BrandLogo` keys off the `BRANDS` record (fkse → Telinet).

## Alternatives rejected

- **lucide-only** (internal-wins default) — overridden by the owner's directed pivot; lucide's per-icon size is smaller but the design direction is Phosphor.
- **Material Symbols** — abolished: SVGR build requirement on consumers, and the smaller/less consistent set.
- **Codegen from @phosphor-icons/core** — smallest bundles (~0.5 KB/icon vs ~0.8 KB gzip with all six weights embedded) and RSC-native; rejected for v1 to avoid owning a codegen pipeline. Documented as the optimization path if icon bundle weight becomes a problem — the public API (per-icon exports, weight prop) is unchanged by that switch.
- **Peer dependency / no wrapping** — no curation enforcement, version-skew risk.

## Consequences

- Every component port (from either ref) swaps its icons; the spec's icon chapter carries the lucide→Phosphor mapping table.
- Each used icon carries all six Phosphor weights in the bundle — accepted consciously; the codegen path recovers it without API changes.
- The weight prop's type narrowing (`regular`/`fill`) guides consistency but does not reduce bytes.
- Logo distribution in the public package is contingent on the brand-asset licensing decision.
