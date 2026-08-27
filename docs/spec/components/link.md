# Link

## 1 Header

- **Canonical name**: `Link` (single component)
- **Export path**: `@elmeragroup/ui/react-aria/link` — exports `Link` + `LinkProps`. `react-aria/` prefix marks the remaining RAC dependency (quarantine, self-documenting migration marker).
- **RSC**: client
- **Tier**: **react-aria interim** — foundational-layer atom (cluster README group 4). Migrates to a base-ui/native anchor when the tier retires.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/react-aria/link.tsx` + `.ref/OrderModuleInternalWeb/packages/ui/src/styles/link.ts`

## 2 Anatomy

Single element: RAC `Link`, which renders a real `<a>` when `href` is set, otherwise a `role="link"` span with full keyboard/press handling. `ref` forwards to that element. Client-side navigation flows through the RAC `RouterProvider` installed by `UiProviders` (see ui-providers spec).

## 3 Props

`LinkProps = ComponentPropsWithoutRef<typeof ReactAriaLink> & VariantProps<typeof linkVariants>`

| Prop                                                                                                             | Type             | Default | Notes                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ---------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `href`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `hrefLang`                                        | anchor attrs     | —       | RAC pass-through; no `href` → span link                                                            |
| `routerOptions`                                                                                                  | router-specific  | —       | forwarded to the `RouterProvider` `navigate` integration                                           |
| `isDisabled`                                                                                                     | `boolean`        | —       | ref-style boolean (RAC)                                                                            |
| `onPress` / `onPressStart` / `onPressEnd` / `onClick`                                                            | RAC press events | —       |                                                                                                    |
| `onHoverStart` / `onHoverEnd` / `onHoverChange`, `onFocus` / `onBlur` / `onFocusChange`, `onKeyDown` / `onKeyUp` | RAC              | —       |                                                                                                    |
| `autoFocus`, `aria-label`, `aria-current`, …                                                                     | RAC              | —       | pass-through                                                                                       |
| `variant`, `leading`, `truncate`, `align`, `weight`                                                              | see §4           | —       | typography axes from `linkVariants`                                                                |
| `className`                                                                                                      | `string`         | —       | merged after recipe via `cn` (plain string here — the ref does not compose render-prop classNames) |

No `usePredictedEvents`/intent props exist in the ref's surface — it is a plain RAC `Link` wrapper; nothing beyond RAC's own props is added.

## 4 Variants

`linkVariants` — module-private tv in `styles/link.ts` (no borrow pattern):

| Axis       | Values                                                                                                                    | Default   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| `variant`  | `default` (text-inherit) · `foreground` · `primary` · `secondary` · `brand` · `muted` · `inherit` · `error` (renamed, §8) | `default` |
| `leading`  | `none` · `tight` · `snug` · `relaxed` · `loose`                                                                           | —         |
| `truncate` | `true`                                                                                                                    | —         |
| `align`    | `left` · `center` · `right` · `justify`                                                                                   | —         |
| `weight`   | `normal` (font-normal) · `bold` (font-medium — faithful quirk, §8)                                                        | `normal`  |

Base: `font-sans transition-opacity hover:opacity-80`; composes shared `focusRing({ target: "state", isFocusVisible })` from RAC render props.

## 5 Consumed tokens

`text-foreground`, `text-primary`, `text-secondary`, `text-brand`, `text-muted-foreground`, `text-error` (renamed), plus `ring`/`background` through the shared focus recipe. `default`/`inherit` use `text-inherit` (no text-color token).

## 6 Data attributes

Emitted by RAC: `data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-current` (from `aria-current`). `isFocusVisible` is consumed through the recipe's state adapter.

## 7 Accessibility

- With `href`: native `<a>` semantics. Without: `role="link"` + `tabIndex=0` with Enter activation, provided by RAC
- `isDisabled` removes it from the tab order and sets `aria-disabled` (RAC behavior)
- Hover opacity is supplemented by the canonical shared focus ring when RAC reports keyboard-visible focus; pointer focus does not show it.

## 8 Divergence from reference

1. **Export path**: bare `@elmeragroup/ui/link` → `@elmeragroup/ui/react-aria/link` (interim quarantine prefix).
2. **destructive → error**: variant value `destructive` (`text-destructive`) renamed to `error` (`text-error`) — canonical status naming; `destructive` never appears in library source. No other raw colors, no `dark:`/`inverted:` variants present.
3. Faithful quirks kept: `variant="default"` and `variant="inherit"` are duplicates (both `text-inherit`); `weight="bold"` maps to `font-medium`. Recorded, not fixed — this atom dies with the tier.
4. No icons in this module.
5. The RAC `Link` surface is captured as-is; router integration relies on `UiProviders`' `RouterProvider` (which also dies with the tier — base-ui replaces this with render props on the consuming component).
6. **Focus unified:** the ref relied on an outline inherited from its shared RAC styles/browser handling; this entry explicitly composes the library-wide `focusRing` state adapter.
7. **All five axes are applied:** the ref typed the full `VariantProps<typeof linkVariants>` surface but passed only `variant` into the recipe (`cn(linkVariants({ variant }), className)`), so `leading`, `truncate`, `align` and `weight` were accepted and silently dropped. This port applies all five.

## 9 Test requirements

- `getByRole("link", { name })` with `href` renders an `<a href>`; without `href` still exposes `role="link"` and activates on Enter (`onPress` fires)
- `isDisabled`: not tabbable, `data-disabled` present, `onPress` suppressed
- Inside `UiProviders`: clicking an internal `href` calls the provided `navigate` (client-side routing path)
- Variant classes: `variant="error"` applies `text-error`; `className` merges last
- Keyboard focus shows the shared ring; pointer focus does not.

## 10 Demo requirements

- `link-variants.tsx` — the color variants plus `truncate` and `weight`
- `link-router.tsx` — `UiProviders navigate` wiring with an internal and an external (`target="_blank"`) link
