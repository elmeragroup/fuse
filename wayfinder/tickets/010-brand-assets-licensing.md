---
id: 010
title: Brand assets & licensing
type: grilling
status: open
assignee: null
blocked-by: []
---

## Question

The registry decision is **public npmjs.com** — what can legally and strategically ship inside a public package?

At stake: Fjordkraft's heading font is **Neo Sans, a licensed commercial font** (woff2 files live in the ref apps today); brand logos ship as components inside the ref ui packages; brand palettes themselves are public-by-nature (visible in any shipped CSS) but logos/fonts have redistribution terms.

Decide:

1. Fonts: keep the refs' pattern where **apps supply fonts** via `--font-primary`/`--font-heading` CSS variables (library never ships font files — cleanest), vs a separate private `@elmeragroup/fonts` package, vs public shipping (needs license verification with the font vendor).
2. Logos: public package (logos are publicly visible marks anyway) vs private assets package; who signs off?
3. Whether *any* part needs to stay private, and if so how the public/private split works in CI.
4. License for the public package code itself (MIT? proprietary-source-visible?) and who in Elmera approves open distribution.

This is HITL: the license facts and sign-off are the human's to bring or chase (spawn a follow-up task ticket if legal/design input must be gathered).
