# UiProviders

## 1 Header

- **Canonical name**: two modules, split by tier (ruled — see §8):
  - `ElmeraGroupUiProvider` + `useElmeraGroupUi` — **theme entry**, `@elmeragroup/ui/theme` (tier-independent; the locale source for the whole library, ADR 0006).
  - `UiProviders` — `@elmeragroup/ui/react-aria/ui-providers`, the RAC `RouterProvider` wrapper (interim convenience that composes the theme-entry provider).
- **Export path**: permanent exports from `@elmeragroup/ui/theme`; interim `UiProviders` only from `@elmeragroup/ui/react-aria/ui-providers` (the root barrel excludes every quarantined RAC entry)
- **RSC**: client — both providers create/read React context; their source modules begin `"use client"`, while the `/theme` facade remains directive-free
- **Tier**: `ElmeraGroupUiProvider` is foundational and permanent. `UiProviders` is **react-aria interim** — its RAC value is `RouterProvider` wiring, which base-ui does not need (base-ui components take render props for links instead of a global router context); it **dies with the tier**.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/ui-providers.tsx` (+ the non-RAC `src/ui-context.tsx` it re-exports)

## 2 Anatomy

```
UiProviders                                    (react-aria interim)
└─ ElmeraGroupUiProvider locale={locale}       (theme entry: plain React context { locale }, memoized)
   └─ I18nProvider locale={locale}             (react-aria-components; feeds RAC's own localized strings)
      └─ RouterProvider navigate={navigate}    (react-aria-components)
         └─ children
```

**What each provides, precisely**:

1. `ElmeraGroupUiProvider` — the required, union-typed `locale` consumed by every string-bearing component's internal `useLocalizedStrings(dictionary)` hook (accessibility.md §4 / ADR 0006). Plain data: no `navigator` sniffing, SSR-safe.
2. RAC `I18nProvider` — forwards the same locale into react-aria so the tier's date/calendar components render RAC-provided strings (nav-button names, segment labels, announcements) in the correct language instead of RAC's `navigator.language` guess.
3. RAC `RouterProvider` — installs the app's client-side `navigate` so every RAC link-capable component in the tier performs client-side routing.

Only (2) and (3) are RAC; (1) lives in the theme entry and survives the tier.

## 3 Props

**ElmeraGroupUiProvider** (`@elmeragroup/ui/theme`)

| Prop       | Type                                                           | Default      | Notes                                                                                                |
| ---------- | -------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `children` | `ReactNode`                                                    | required     |                                                                                                      |
| `locale`   | `SupportedLocale` (`"nb-NO" \| "sv-SE" \| "en-US" \| "fi-FI"`) | **required** | the single locale source for component dictionaries (ADR 0006); apps never pass locale per component |

`useElmeraGroupUi(): { locale: SupportedLocale }` — the read hook; throws outside the provider (the provider is required for string-bearing components).

**UiProviders** (`@elmeragroup/ui/react-aria/ui-providers`)

| Prop       | Type                    | Default      | Notes                                                                    |
| ---------- | ----------------------- | ------------ | ------------------------------------------------------------------------ |
| `children` | `ReactNode`             | required     |                                                                          |
| `navigate` | `(url: string) => void` | required     | the app router's navigate (e.g. Next.js `router.push`)                   |
| `locale`   | `SupportedLocale`       | **required** | forwarded to the composed `ElmeraGroupUiProvider` and RAC `I18nProvider` |

## 4 Variants

None — renders no DOM.

## 5 Consumed tokens

None.

## 6 Data attributes

None emitted or consumed.

## 7 Accessibility

- Client-side `navigate` keeps RAC links as real `<a href>` elements (correct semantics) while intercepting activation — without it, tier links fall back to full navigations.
- Locale correctness is an a11y concern: the required `locale` guarantees dictionary strings and RAC-provided AT labels announce in the user's language (accessibility.md §4). No aria of its own.

## 8 Divergence from reference

1. **Module split (ruled)**: `ElmeraGroupUiProvider`/`useElmeraGroupUi` move **out of the react-aria tier** into the `/theme` entry (`@elmeragroup/ui/theme`), alongside `ThemeProvider`/`ThemeScope` (architecture.md entry map). The ref co-locates them with the RAC wrapper via `ui-context.tsx`; the split makes the permanent locale context independent of the dying tier.
2. **`userAgent` removed (ruled)**: the ref's `userAgent` prop and the `UserAgentParserResult` type (`@elmeragroup/lib`) are **deleted from the public API**. Its only consumer was PhoneNumberField's OS-based emoji-flag support check, which the vendored-SVG flag ruling abolishes (phone-number-field.md §8).
3. **`locale` becomes required and union-typed (ADR 0006)**: ref `locale?: string` → `locale: SupportedLocale` (`"nb-NO" | "sv-SE" | "en-US" | "fi-FI"`). `useElmeraGroupUi()` returns `{ locale: SupportedLocale }` — never `undefined`; string-bearing components depend on it via `useLocalizedStrings`.
4. **`UiProviders` composes the theme-entry provider** and gains a required `locale` it forwards; it also wraps children in RAC `I18nProvider` so the interim date cluster receives the same locale for RAC-provided strings (new — the ref let RAC fall back to `navigator.language`).
5. **Retirement is the ruling**: when the tier retires, `UiProviders` is deleted, not migrated — base-ui components accept render props (`render={<NextLink …/>}`) for framework links, so no global RouterProvider is needed. `ElmeraGroupUiProvider`/`useElmeraGroupUi` live on in `/theme`.
6. No styling, icons, or colors — nothing to convert; no `dark:`/`destructive` occurrences.
7. Family-wide: the RAC `popover` bare export is **dropped** from public (zero consumers); `field` and `item` bare exports likewise dropped in favor of base-ui field/item.

## 9 Test requirements

- Rendering a tier `Link href="/x"` inside `UiProviders` and clicking it calls `navigate("/x")` and prevents default navigation
- `useElmeraGroupUi()` returns the provided `locale`; throws (or errors per implementation) outside the provider
- Context value is referentially stable across re-renders with unchanged props (memoization)
- Public-API type test: `SupportedLocale` union is exactly `"nb-NO" | "sv-SE" | "en-US" | "fi-FI"`; `locale` is required on both providers; `UserAgentParserResult` is **not** exported anywhere
- Source/package scan rejects the identifiers `userAgent`, `UserAgentParserResult`, and imports from `@elmeragroup/lib`.
- A string-bearing component (e.g. `Combobox.Empty` default) rendered under `ElmeraGroupUiProvider locale="nb-NO"` shows the nb-NO dictionary string; under `locale="sv-SE"` the sv-SE string (the dictionary-default matrix per locale lives in each component's own §9)
- RAC forwarding: a tier date component under `UiProviders locale="nb-NO"` renders RAC-provided labels in Norwegian (I18nProvider wiring)

## 10 Demo requirements

- `ui-providers-basic.tsx` — app-root setup with a mock `navigate` (logs the URL), required `locale`, and a `Link` demonstrating client-side interception
- `ui-providers-locale-switch.tsx` — `ElmeraGroupUiProvider` re-rendered with a locale switcher, showing dictionary strings flip across a couple of string-bearing components
