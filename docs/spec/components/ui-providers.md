# UiProviders

## 1 Header

- **Canonical name**: `UiProviders` (app-root provider; also re-exports `ElmeraGroupUiProvider` + `useElmeraGroupUi`)
- **Export path**: `@elmeragroup/ui/react-aria/ui-providers` — the `react-aria/` prefix marks the quarantined RAC dependency (`RouterProvider`).
- **Tier**: **react-aria interim** — foundational-layer module (cluster README group 4). The module **dies with the tier**: its entire RAC value is `RouterProvider` wiring, which base-ui does not need (base-ui components take render props for links instead of a global router context).
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/ui-providers.tsx` (+ the non-RAC `src/ui-context.tsx` it re-exports)

## 2 Anatomy

```
UiProviders
└─ ElmeraGroupUiProvider (plain React context: { userAgent, locale }, memoized)
   └─ RouterProvider navigate={navigate}   (react-aria-components)
      └─ children
```

**What it provides, precisely**: (1) RAC `RouterProvider` — installs the app's client-side `navigate` function so every RAC link-capable component in the tier (`Link`, RAC items with `href`, …) performs client-side routing instead of full page loads; (2) the Elmera UI context (`userAgent`, `locale`) consumed by e.g. PhoneNumberField's locale resolution and flag rendering. Only (1) is RAC; (2) lives in `ui-context.tsx` outside the react-aria folder and survives the tier.

## 3 Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | required | |
| `navigate` | `(url: string) => void` | required | the app router's navigate (e.g. Next.js `router.push`) |
| `userAgent` | `UserAgentParserResult` (`@elmeragroup/lib`) | — | forwarded to ui context |
| `locale` | `string` | — | forwarded to ui context |

`useElmeraGroupUi(): { userAgent?, locale? }` — the read hook. `ElmeraGroupUiProvider` takes `children`/`userAgent`/`locale` (no `navigate`).

## 4 Variants

None — renders no DOM.

## 5 Consumed tokens

None.

## 6 Data attributes

None emitted or consumed.

## 7 Accessibility

Indirect only: client-side `navigate` keeps RAC links as real `<a href>` elements (correct semantics) while intercepting activation — without it, tier links fall back to full navigations. No aria of its own.

## 8 Divergence from reference

1. **Export path**: bare export → `@elmeragroup/ui/react-aria/ui-providers` (interim quarantine prefix).
2. **Retirement is the ruling**: when the tier retires, `UiProviders` is deleted, not migrated — base-ui components accept render props (`render={<NextLink …/>}`) for framework links, so no global RouterProvider is needed. `ElmeraGroupUiProvider`/`useElmeraGroupUi` (userAgent + locale context) are tier-independent and keep a home outside `react-aria/`; their re-export here is a convenience only.
3. No styling, icons, or colors — nothing to convert; no `dark:`/`destructive` occurrences.
4. Family-wide: the RAC `popover` bare export is **dropped** from public (zero consumers); `field` and `item` bare exports likewise dropped in favor of base-ui field/item.

## 9 Test requirements

- Rendering a tier `Link href="/x"` inside `UiProviders` and clicking it calls `navigate("/x")` and prevents default navigation
- `useElmeraGroupUi()` returns the provided `userAgent`/`locale`; returns `undefined`s outside the provider (default context)
- Context value is referentially stable across re-renders with unchanged props (memoization)

## 10 Demo requirements

- `ui-providers-basic.tsx` — app-root setup with a mock `navigate` (logs the URL) and a `Link` demonstrating client-side interception
