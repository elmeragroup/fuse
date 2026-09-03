# 0006 — Built-in localized strings via @internationalized/string dictionaries

Date: 2026-08-18. Status: accepted; amended 2026-09-02 — `useLocalizedStrings` caches formatters per dictionary identity and locale; amended 2026-09-03 — dictionaries are assembled by `createStringDictionary`, and a row may be owned by an overlay family rather than one component.

## Context

Several components carry user-facing or AT-facing strings (combobox empty state, pagination nav labels, toast close, date-cluster labels). The five brands span Norway, Sweden, and (imminently) Finland, so any single baked-in default language is wrong for someone; consuming apps range from fully multilingual whitelabels to single-country single-brand apps that should get correct language with zero setup. Requiring every string as a prop maximizes friction; optional English defaults ship wrong-language UI silently. Research into react-aria's mechanism (wayfinder ticket 026; `.ref/react-spectrum`) found: per-component per-locale message files compiled to plain JS, resolved at runtime by the public, dependency-free `@internationalized/string` (~1 kB); Adobe's surrounding machinery (glob imports, four parallel custom resolvers, string-compiler build step, locale-subsetting resolver plugin, SSR string injection) exists to manage **34 eager locales** — a scale we do not have.

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

## Amendment 2026-09-02 — formatter cache

`useLocalizedStrings` caches one `LocalizedStringFormatter` per dictionary identity (`WeakMap` keyed by the dictionary object) and locale, so chips, toasts, and pagination edges share an instance instead of allocating one per mount. Same dictionary and locale return the same formatter instance; a different locale or dictionary yields a distinct one. No public API change — locale still comes only from the provider and explicit string props still override the dictionary.

## Amendment 2026-09-03 — one dictionary factory, and family-owned rows

Two consequences of the decision above, recorded now that every dictionary exists.

**Assembly is one function.** Each `intl/index.ts` was a byte-identical `new LocalizedStringDictionary({ "en-US": …, "fi-FI": …, "nb-NO": …, "sv-SE": … })`. That assembly is now the package-private `createStringDictionary({ enUS, fiFI, nbNO, svSE })` in `hooks/create-string-dictionary.ts`; the four locales are named arguments, so a locale missing from a dictionary is a type error at the call site rather than a runtime lookup miss, and the shared key/value type parameters make the four row modules prove they carry the same keys. Adding a fifth locale stays the mechanical change the decision promised — one argument on the factory plus one module per owner. The factory returns a fresh dictionary per call, so the 2026-09-02 formatter cache is unaffected: identity is still per dictionary object, and one dictionary and locale still yield one formatter instance.

**A row's owner may be a family.** §4.1 ownership was read as strictly per component, which forced the same four `close` strings to be authored three times because Dialog, Sheet, and Toast each render the same corner dismiss affordance. The rule is now: a row belongs to the single module where the string is authored, and where several components render the same affordance with the same copy, that family owns it. Exactly one v1 row is family-owned — `overlay.close`, in `components/overlay/intl`, read by Dialog, Sheet, and Toast. Nothing else is shared, and per-component `closeLabel` / `label` props still override at the call site, so no rendered string and no public API changes.

**Status: pending owner confirmation.** The alternative not taken was to keep three per-component `close` rows and merely build them through the factory: fewer moved files, but the same four strings authored in three places, which is the duplication the shared-spine work exists to remove. If the owner rules §4.1 ownership strictly per component, reverting is mechanical — restore the three `intl/` directories, each a `createStringDictionary` call, and re-point three imports.
