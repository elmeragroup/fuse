# @elmeragroup/ui — implementation specification

The architecture and product contracts for `@elmeragroup/ui`, the whitelabel React component library serving Elmera Group's consumer brands and corporate Elmera across 20 theme permutations. These chapters, [CONTEXT.md](../../CONTEXT.md), and the [ADRs](../adr/) own library-wide decisions. [Component authoring](../component-authoring.md) covers shared implementation rules; public JSDoc, authored component pages, and co-located tests describe each component.

## What is being built

A single public npm package, `@elmeragroup/ui`, that renders the same component tree as any of 20 themes — `internal`/`external` × Fjordkraft (`fkas`) / TrøndelagKraft (`tkas`) / Gudbrandsdal Energi (`guen`) / Fjordkraft Företag (`fkab`, permanent fkas alias) / Telinet (`fkse`) / Elmera (`elma`) × `private`/`company` — selected by three data attributes, with no rebuild and no fork. **67 canonical components in four tiers**: base-ui (the default), react-aria interim (11 components — the date cluster plus RAC remnants, quarantined behind `react-aria/` paths, marked for migration), composites, and unheadless primitives — the three non-interim tiers together hold **55 shipped + 1 deferred (`chart`, Wave 9)**. Vocabulary: [CONTEXT.md](../../CONTEXT.md) is the glossary and its terms are used verbatim throughout. Country flags are the same packaged SVG assets on every operating system; there is no user-agent branch, emoji-flag fallback, or CDN dependency.

## Fixed constraints

React 19 · base-ui primitives · Tailwind v4 · tv (tailwind-variants) · Phosphor icons · pnpm + turborepo · oxlint + oxfmt + anti-slop · vitest (unit + browser mode) · tsdown ESM-only build · published public on npmjs.com under `@elmeragroup/ui` · library code MIT, bundled third-party artwork under its recorded source licenses · light themes only at v1 (dark axis reserved in the contract).

## The document set

| Document                                         | Owns                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)               | Package structure, entries/exports, tsdown build, JS + CSS distribution, dependency policy                  |
| [icons.md](icons.md)                             | Curated Phosphor exports, bespoke icons/logos/illustrations, country-flag asset contract                    |
| [theming.md](theming.md)                         | Token contract, cascade mechanism, the full 20-permutation value matrix, theme provider API, token pipeline |
| [component authoring](../component-authoring.md) | Shared API, styling, density, testing, and demo conventions                                                 |
| [accessibility.md](accessibility.md)             | WCAG 2.2 AA target, focus/keyboard/labeling rules, i18n string architecture, contrast policy, motion        |
| [performance.md](performance.md)                 | Bundle budgets, RSC/client-boundary policy, CSS budgets, lazy-loading stance, runtime practices             |
| [tooling.md](tooling.md)                         | Repo workspace, lint/format guardrails, scaffolding, full testing strategy, merge gate                      |
| [docs-site.md](docs-site.md)                     | Docs site (design + pipeline), API-reference generation, llms.txt                                           |
| [release.md](release.md)                         | Changesets flow, channels, npm Trusted Publishing, org-setup prerequisites                                  |
| [roadmap.md](roadmap.md)                         | Deferred work with triggers: react-aria→base-ui migration, dark mode, VR, new brands/locales                |

Hard-to-reverse trade-offs are recorded as ADRs in [../adr/](../adr/) (0001 token contract · 0002 theme attributes · 0003 controlled brand / host first-paint · 0004 Phosphor · 0005 package architecture · 0006 intl strings · 0007 docs API extraction pipeline · 0008 tests assert behaviour, not source spelling · 0009 docs client boundaries). The spec documents are normative; ADRs carry the why.

## Changing the library

1. Read [component authoring](../component-authoring.md), then the chapter that owns the change. Architecture owns package entries; theming owns tokens and providers; accessibility owns keyboard, labels, and focus; performance owns budgets and RSC classification.
2. Update implementation, tests, public JSDoc, and authored docs together. Maintain the independently reviewed demo coverage in `apps/docs/test/fixtures/component-demo-requirements.json`, then regenerate API artifacts.
3. Reuse the existing component dependencies and shared helpers. Do not introduce placeholder public exports to bypass an unfinished dependency.
4. Add a changeset when the published package changes. Publishing still waits on the prerequisites in [release.md](release.md).

When documents overlap, the owner in the table above wins. Resolve contradictions in the same change as the code.

### Required reference snapshots

`.ref/` is intentionally gitignored because it contains large upstream checkouts and two access-controlled company repositories. It is not a runtime/build dependency of the published package, but the pinned checkout **is required before copying new implementation code or assets from a reference**. A clean-clone implementer creates the exact directory names below, clones the listed remote, checks out the detached commit, and verifies `git -C .ref/<name> rev-parse HEAD` equals the table. Missing access to either company repository is a stop condition for affected components—not permission to invent replacement behavior or artwork.

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
