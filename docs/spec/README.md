# @elmeragroup/ui — implementation specification

The implementation-ready architecture and product specification for `@elmeragroup/ui`: the whitelabel React component library serving Elmera Group's five consumer energy brands plus corporate Elmera across **20 theme permutations** (variant × brand × segment). This document set, [CONTEXT.md](../../CONTEXT.md), and the ADRs in [../adr/](../adr/) are the **normative decision layer**. The pinned `.ref/` snapshots are the **required lift-source layer** wherever a component header or asset chapter names one: copy the named implementation/assets, then apply every normative rule and that component's §8 divergences. Tickets, research, and prototypes are provenance only; an implementation agent does not need them and they never override the normative layer. The pre-v1 `wayfinder/` planning tree (tickets, research, prototypes) was removed when v1 was reached; "wayfinder ticket NNN" citations in the chapters are provenance pointers into git history before that removal, and new decisions land in a chapter's §8 or an ADR. A spec amendment lands in the same change as the code it describes, is dated to that change, and names its ADR or §8 entry. A numbered `ticket`/`ruling` citation that is not a `wayfinder ticket NNN` provenance pointer is self-contained on that line: date plus one sentence of substance (`ruling 74b, 2026-08-24: …`).

## What is being built

A single public npm package, `@elmeragroup/ui`, that renders the same component tree as any of 20 themes — `internal`/`external` × Fjordkraft (`fkas`) / TrøndelagKraft (`tkas`) / Gudbrandsdal Energi (`guen`) / Fjordkraft Företag (`fkab`, permanent fkas alias) / Telinet (`fkse`) / Elmera (`elma`) × `private`/`company` — selected by three data attributes, with no rebuild and no fork. **67 canonical components in four tiers**: base-ui (the default), react-aria interim (11 components — the date cluster plus RAC remnants, quarantined behind `react-aria/` paths, marked for migration), composites, and unheadless primitives — the three non-interim tiers together hold **55 shipped + 1 deferred (`chart`, Wave 9)**. Vocabulary: [CONTEXT.md](../../CONTEXT.md) is the glossary and its terms are used verbatim throughout. Country flags are the same packaged SVG assets on every operating system; there is no user-agent branch, emoji-flag fallback, or CDN dependency.

## Fixed constraints

React 19 · base-ui primitives · Tailwind v4 · tv (tailwind-variants) · Phosphor icons · pnpm + turborepo · oxlint + oxfmt + anti-slop · vitest (unit + browser mode) · tsdown ESM-only build · published public on npmjs.com under `@elmeragroup/ui` · library code MIT, bundled third-party artwork under its recorded source licenses · light themes only at v1 (dark axis reserved in the contract).

## The document set

| Document                             | Owns                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)   | Package structure, entries/exports, tsdown build, JS + CSS distribution, dependency policy                                                      |
| [icons.md](icons.md)                 | Curated Phosphor exports, bespoke icons/logos/illustrations, country-flag asset contract                                                        |
| [theming.md](theming.md)             | Token contract, cascade mechanism, the full 20-permutation value matrix, theme provider API, token pipeline                                     |
| [components/](components/)           | Per-component API specs (68 files) — start at [conventions.md](components/conventions.md), the shared-conventions chapter every spec references |
| [accessibility.md](accessibility.md) | WCAG 2.2 AA target, focus/keyboard/labeling rules, i18n string architecture, contrast policy, motion                                            |
| [performance.md](performance.md)     | Bundle budgets, RSC/client-boundary policy, CSS budgets, lazy-loading stance, runtime practices                                                 |
| [tooling.md](tooling.md)             | Repo workspace, lint/format guardrails, scaffolding, full testing strategy, merge gate                                                          |
| [docs-site.md](docs-site.md)         | Docs site (design + pipeline), playground, API-reference generation, llms.txt                                                                   |
| [release.md](release.md)             | Changesets flow, channels, npm Trusted Publishing, org-setup prerequisites                                                                      |
| [roadmap.md](roadmap.md)             | Deferred work with triggers: react-aria→base-ui migration, dark mode, VR, new brands/locales                                                    |

Hard-to-reverse trade-offs are recorded as ADRs in [../adr/](../adr/) (0001 token contract · 0002 theme attributes · 0003 controlled brand / host first-paint · 0004 Phosphor · 0005 package architecture · 0006 intl strings · 0007 docs API extraction pipeline). The spec documents are normative; ADRs carry the why.

## How to implement from this spec

1. **Read order**: this README → [conventions.md](components/conventions.md) → [architecture.md](architecture.md) → [theming.md](theming.md); the rest as their subjects come up. Before lifting any referenced implementation or SVG path, provision and verify the snapshots below.
2. **Sequencing constraints** the spec imposes:
   - **Foundation:** scaffold the workspace/catalog, exports generator, tsdown build, test projects, and lint rules; then implement `cn`/shared recipes, the token pipeline, raw/standalone CSS, `themes.css`, `/theme`, and the locale dictionaries/hooks. Every component depends on this layer.
   - **Assets:** generate the curated Phosphor adapters and vendor the bespoke/flag assets before components start replacing reference icons or rendering countries.
   - **Component spine:** implement `Button`, `Separator`, `Field`, `Input`, and `Item`, plus the package-private RAC support stack, before the wider families. Load-bearing edges are explicit: Dialog → AlertDialog/Sheet; Field + Input → text/form composites; InputGroup + Field → PhoneNumberField (using direct `@base-ui/react` Combobox primitives, not the public `Combobox` component); Item + Field → SelectionItem → checkbox/radio cards; Toggle → ToggleGroup; Calendar + DateField → DatePicker/DateRangePicker. Other components may proceed once their imports are available.
   - Within each dependency-ready group, every component ships with its spec's §9 tests and §10 demos in the same change; do not create temporary public paths or placeholder exports to bypass an unfinished dependency.
   - **Docs-app MVP is the allowed first dogfood** (this **replaces** the former “do not start the docs site until an in-package prototype exists” rule). Once `Button` and `ScrollArea` exist, `apps/docs` may start as a workspace consumer of those two components. Scope is a three-column `(docs)` shell with docs-local SideNav + QuickNav over `ScrollArea`, live Button and ScrollArea pages, and reserved blank `(private)` / `(website)` route groups — **not** the full docs pipeline (no generated API tables, demo extraction, or command-palette search). Details: [docs-site.md](docs-site.md) §2.
   - Publishing waits on the org-setup prerequisites in [release.md](release.md) (tracked as an open task; blocks release, not development).
3. **Divergence discipline**: reference behavior is spec'd verbatim per component; every deliberate difference from the reference codebases is a §8 Divergence entry in that component's spec. When documents overlap, the chapter named as owner in the table above wins (for example, [performance](performance.md) owns RSC classification); within one owner, the more specific component contract wins. Any contradiction is fixed in the spec, not silently resolved in code.

### Required reference snapshots

`.ref/` is intentionally gitignored because it contains large upstream checkouts and two access-controlled company repositories. It is not a runtime/build dependency of the published package, but it **is an implementation prerequisite** for every §1 `Source of truth` path and every asset explicitly copied from a reference. A clean-clone implementer creates the exact directory names below, clones the listed remote, checks out the detached commit, and verifies `git -C .ref/<name> rev-parse HEAD` equals the table. Missing access to either company repository is a stop condition for affected components—not permission to invent replacement behavior or artwork.

| Directory                     | Clone remote                                                       | Required commit                            |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `.ref/base-ui`                | `https://github.com/mui/base-ui.git`                               | `582d51a8383b2b86b9bf466ba2ff7708807c1639` |
| `.ref/coss`                   | `https://github.com/cosscom/coss.git`                              | `e43fa4a8da4c490ebf3e1e1707b2a9af6fa2a217` |
| `.ref/flag-icons`             | `https://github.com/yammadev/flag-icons.git`                       | `a3d5adcf4fe650536d7694ca6d93c607ebf16c4e` |
| `.ref/kumo`                   | `https://github.com/cloudflare/kumo.git`                           | `bba0f5eb1249e9936f83e04319e6db0458e98717` |
| `.ref/OrderModuleInternalWeb` | `git@ssh.dev.azure.com:v3/fjordkraft/ITUTV/OrderModuleInternalWeb` | `83a2097485367ace2dc66d46b62b3878a044c73a` |
| `.ref/OrderModuleWeb`         | `git@ssh.dev.azure.com:v3/fjordkraft/ITUTV/OrderModuleWeb`         | `ac5727784ff37cfc761b234517fe0270df663e02` |
| `.ref/react-spectrum`         | `https://github.com/adobe/react-spectrum.git`                      | `de6bc849cc36ed441123cbefb8b2e542b03020f4` |
| `.ref/shadcn-ui`              | `https://github.com/shadcn-ui/ui.git`                              | `d4fc45b1fbabfccb7a6a4333d8004cf19481caa9` |

References supply code and immutable source artwork only. They do **not** decide package paths, public API, tokens, focus styling, localization, client boundaries, dependency policy, or test expectations; this spec does. Lifted files retain applicable license/copyright notices, and no `.ref/` path may appear in package source, generated declarations, or the packed artifact.

## Out of scope (ruled, not deferred)

Migration plans for the two existing OrderModule apps — ruled out of the effort entirely; the spec carries no compat assessment. Everything else deferred lives in [roadmap.md](roadmap.md) with its trigger.
