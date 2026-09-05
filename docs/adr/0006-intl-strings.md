# 0006 — Built-in localized strings via @internationalized/string dictionaries

Date: 2026-08-18. Status: accepted.

## Context

Several components carry user-facing or AT-facing strings (combobox empty state, pagination nav labels, toast close, date-cluster labels). The five brands span Norway, Sweden, and (imminently) Finland, so any single baked-in default language is wrong for someone; consuming apps range from fully multilingual whitelabels to single-country single-brand apps that should get correct language with zero setup. Requiring every string as a prop maximizes friction; optional English defaults ship wrong-language UI silently. Research into react-aria's mechanism  found: per-component per-locale message files compiled to plain JS, resolved at runtime by the public, dependency-free `@internationalized/string` (~1 kB); Adobe's surrounding machinery (glob imports, four parallel custom resolvers, string-compiler build step, locale-subsetting resolver plugin, SSR string injection) exists to manage **34 eager locales** — a scale we do not have.

## Decision

Adopt **the runtime, not the machinery**. String-bearing components own a co-located `intl/` directory of **plain TS locale modules** (`nb-NO.ts`, `sv-SE.ts`, `en-US.ts`, `fi-FI.ts`), explicitly imported into a per-component dictionary consumed via `LocalizedStringDictionary`/`LocalizedStringFormatter` from `@internationalized/string` (regular dependency). All four locales ship eagerly. Locale comes **only from context**: `ElmeraGroupUiProvider` takes a required, union-typed `locale: SupportedLocale`; components read it via an internal hook — apps never pass locale per component. Explicit string props remain on components and **override** the dictionary. No ICU parser ships; plural/number cases use the formatter's helpers with hand-written message functions.

## Alternatives rejected

- **Props-only, on-screen strings required** (earlier working decision, superseded here) — compile-time language safety, but per-app friction for exactly the single-country apps that should be zero-config.
- **Optional props with English defaults** — silent wrong-language UI for Norwegian/Swedish/Finnish users.
- **Full react-aria machinery** (glob import + string-compiler + forked optimize-locales plugin) — the glob specifier is non-standard (react-aria maintains four resolver implementations and disables `noImplicitAny` to tolerate it); subsetting and SSR injection only pay off at tens of locales. At four locales the eager cost is a few hundred bytes per component.
- **i18next/other app-level i18n as a peer** — couples the library to an app framework choice; the library's strings are its own concern.

## Consequences

- `ElmeraGroupUiProvider` becomes required for string-bearing components. The internal reference's browser-detection field is intentionally not carried forward; the public provider contains only the typed, load-bearing locale contract.
- Adding a locale = adding one TS module per string-bearing component + widening the `SupportedLocale` union — a mechanical, type-guided change.
- All shipped locales are in every consumer bundle. Accepted at ≤ ~10 locales; past that, move to per-locale modules kept separate through the build + resolver-level subsetting (react-aria's model). The public API is unchanged by that switch.
- `SupportedLocale` is the exact four-value public input union, so normal typed use selects a shipped module directly. The dictionary's `en-US` fallback remains defensive runtime behavior for untyped JavaScript input, not an additional supported-locale negotiation contract.
- Tests: one dictionary-default render test per shipped locale per string-bearing component, plus prop-override tests; the `SupportedLocale` union is covered by public-API type tests.
