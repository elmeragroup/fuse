---
id: 009
title: Icon system
type: grilling
status: open
assignee: null
blocked-by: [007]
---

## Question

What is the icon system? The refs conflict: internal re-exports ~180 **lucide-react** icons under one `Icon` object; external ships 78 **material-icons SVGs** compiled via `@svgr/webpack` (a build-time dependency a published package cannot impose on consumers) plus hand-written logo components.

Decide: one icon family (lucide vs material vs both during transition), delivery mechanism (pre-compiled React components — no SVGR requirement on consumers), the `Icon.*` namespace API, brand/segment logo components (`BrandLogo` switching on brand incl. Telinet-for-fkse), tree-shaking (180 re-exports in one object defeats it — namespace object vs per-icon exports), and where logos live given the licensing outcome of *Brand assets & licensing*.
