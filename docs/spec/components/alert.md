# Alert

## 1 Header

- **Canonical name**: `Alert` — namespace compound: `Alert.Root`, `Alert.Icon`, `Alert.Title`, `Alert.Description`
- **Export path**: `@elmeragroup/ui/alert` (`import { Alert } from "@elmeragroup/ui/alert"`)
- **RSC**: server (owns no state/effects; `onAction` is a forwarded consumer handler — passing it requires a client boundary at the consumer)
- **Tier**: styled composite over the base-ui Item family (**FULL RE-HOME**, user-ruled: ref composes on `react-aria/item.tsx`; ours composes on `base-ui/item.tsx` — Item.Root/.Media/.Content/.Actions — and base-ui `Button`)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/alert.tsx` (composition re-homed; see §8)

## 2 Anatomy

| Part                | Renders                                                              | Notes                                                         |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `Alert.Root`        | base-ui `Item` (`variant="outline"` `size="sm"`) with `role="alert"` | owns the variant; lays out Media → Content → optional Actions |
| `Alert.Icon`        | variant-matched Phosphor icon inside `Item.Media`                    | auto-rendered by Root; exported for standalone use            |
| `Alert.Title`       | `<h3 data-slot="item-title">` (own heading — see §8.2)               | `level` prop adjusts heading rank                             |
| `Alert.Description` | base-ui `ItemDescription` (`<p>`)                                    | body copy                                                     |

Internally Root renders `ItemMedia` (icon), `ItemContent` (children), and — when both `onAction` and a non-empty `actionLabel` are set — `ItemActions` containing a base-ui `Button size="sm" type="button"` styled by the variant's `button` slot. The action pair is atomic: both present or neither.

```tsx
<Alert.Root variant="warning" onAction={retry} actionLabel="Retry">
  <Alert.Title>Sync delayed</Alert.Title>
  <Alert.Description>Facility data is more than an hour old.</Alert.Description>
</Alert.Root>
```

## 3 Props

**Alert.Root** — `ComponentProps<"div">` (spread onto `Item`) plus:

| Prop          | Type                                                   | Default     | Notes                                                                                           |
| ------------- | ------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------- |
| `variant`     | `"default" \| "destructive" \| "warning" \| "success"` | `"default"` | drives base/icon/button slot classes and the icon glyph                                         |
| `onAction`    | `ComponentProps<typeof Button>["onClick"]`             | —           | required together with `actionLabel`; the pair renders the action button in `Item.Actions`      |
| `actionLabel` | `ReactNode`                                            | —           | accessible name and button children; required together with `onAction`; must be self-describing |
| `children`    | `ReactNode`                                            | —           | flows into `Item.Content` (typically Title + Description)                                       |

**Alert.Icon** — Phosphor icon props (`ComponentProps<typeof Info>`, per-icon named import from `@elmeragroup/ui/icons`) plus required `variant` (same union). Glyph map: `default → Info`, `warning → Warning`, `destructive → WarningOctagon`, `success → CheckCircle`.

**Alert.Title** — `ComponentProps<"h3">` plus `level?: 1–6` (default `3`; renders the matching `h*` element). No variant prop (§8.3).

**Alert.Description** — `ComponentProps<"p">` (spread onto base-ui `ItemDescription`; `text-foreground` added over its `text-muted-foreground` base). No variant prop (§8.3).

## 4 Variants

Recipe: `alertVariants` — **module-private** slot recipe (`tv` slots: `base`, `icon`, `description`, `button`). Single axis:

| `variant`     | base                                                          | icon              | button                                                   |
| ------------- | ------------------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| `default`     | `bg-background text-foreground`                               | `text-foreground` | `bg-background text-foreground`                          |
| `destructive` | `border-error bg-error/5 text-error`                          | `text-error`      | `bg-error text-error-foreground hover:bg-error/90`       |
| `warning`     | `border-warning bg-warning-soft text-warning-soft-foreground` | `text-warning`    | `bg-warning text-warning-foreground hover:bg-warning/90` |
| `success`     | `border-success bg-success/5 text-foreground`                 | `text-success`    | `bg-success text-success-foreground hover:bg-success/90` |

Slot bases: `base: "relative"`, `icon: "block size-5 shrink-0 text-foreground"`, `description: "text-foreground"`. Title typography comes from the package-private Item title seam, not a recipe slot (see §8.8). Default variant: `default`. Underneath, `Item`'s own `variant="outline"`/`size="sm"` axes provide border + padding.

## 5 Consumed tokens

`background`, `foreground`, `error`/`error-foreground` (border, `/5` tint, solid action button), `warning`/`warning-foreground`/`warning-soft`/`warning-soft-foreground` (soft alert surface + solid action button), `success`/`success-foreground`; via Item: `border`, `ring` (focus ring, inert here), `muted-foreground` (Description base, overridden to `foreground`). Radius via Item's `rounded-md`. No raw palette classes.

## 6 Data attributes

**Emitted** (via base-ui Item's `useRender` state serialization): `data-slot="item"` + `data-variant="outline"` + `data-size="sm"` on Root; `data-slot="item-media"`, `item-content`, `item-title`, `item-description`, `item-actions` on the respective parts. One alert-specific attribute: `Alert.Icon` stamps `data-slot="alert-icon"` on the glyph (the §9 icon assertion's hook). Alert's own `variant` stays class-only — it is not serialized to a data attribute.

**Consumed**: Item's internal group scopes (`group/item`, `group-has-data-[slot=item-description]` media alignment) work unchanged.

## 7 Accessibility

- `role="alert"` on Root — an assertive live region; content present at mount is announced when the element enters the DOM. For alerts that toggle visibility, mount/unmount the whole Root (don't hide with CSS).
- The icon is decorative: `Alert.Icon` passes `aria-hidden="true"` itself, after the caller's props, so it cannot be spread away. Phosphor sets no `aria-hidden` of its own — its SSR base renders a bare `<svg>` and only adds a `<title>` when `alt` is given — so this attribute is the component's, not the icon library's. Meaning is carried by Title/Description text. _(Amended 2026-09-03 — §8.9: the earlier text credited Phosphor with a decorative default that does not exist.)_
- `Alert.Title` is a real heading (`h3` default, `level`-adjustable) so alerts slot into the page outline.
- The action button is a standard focusable `Button` (`type="button"`); it lives inside the live region. `onAction` and `actionLabel` are required together; `actionLabel` is the accessible name and must be self-describing.
- No keyboard behavior beyond the button's.

## 8 Divergence from reference

1. **FULL RE-HOME (user-ruled)**: ref composes on `react-aria/item.tsx` (`Item`, `ItemMedia`, `ItemContent`, `ItemActions`, `ItemTitle`, `ItemDescription`) and the react-aria `Button`; ours composes on `base-ui/item.tsx` + base-ui `Button`. API deltas absorbed: (a) base-ui `Item` sets no default `role` — Root passes `role="alert"` explicitly (ref relied on overriding react-aria Item's `role="listitem"` default); (b) base-ui `Item` is `useRender`-polymorphic and emits `data-slot`/`data-variant`/`data-size` via state (ref emitted literal attributes); (c) base-ui `size="sm"` padding is `px-3 py-2.5` (ref's react-aria sm was `px-4 py-3`) — accepted; (d) **no intent-prefetch**: react-aria `ItemLink`/`onIntent`/`usePredictedEvents` has no base-ui counterpart and Alert never used it — gone without replacement.
2. **Alert.Title renders its own `h3`**: react-aria `ItemTitle` wrapped `Heading` (`level={3}`); base-ui `ItemTitle` is a plain `div`. Ours renders an `h*` element directly (default `h3`, `level` prop) carrying `data-slot="item-title"` and base-ui's title classes, preserving the ref's heading semantics on the new base.
3. **FIX (ruled): dead `VariantProps` removed from Title/Description** — ref types both as `… & VariantProps<typeof alertVariants>` but calls `alertVariants()` with no arguments, so a passed `variant` is silently ignored _and_ leaks into the DOM as an invalid `variant="…"` attribute. Ours drops the prop entirely.
4. **FIX (ruled): dead base-slot style removed** — ref's `base: "relative bg-destructive/10"`; every variant overrides the background, so `bg-destructive/10` is unreachable. Base becomes `relative`.
5. **Token alignment (LOCKED)**: `destructive` variant **value kept**; its classes move `destructive* → error*` (`border-error bg-error/5 text-error`, button `bg-error text-error-foreground hover:bg-error/90`) per canonical status tokens. The reference-only, undefined `warning-accent` name is not added to the token contract: warning uses the existing soft status pair for its surface and the solid warning pair for icon/action emphasis, exactly as §4 specifies.
6. **Icons → Phosphor**: lucide `Info → Info`, `AlertTriangle → Warning`, `OctagonX → WarningOctagon`, `CheckCircle → CheckCircle`, regular weight, from `@elmeragroup/ui/icons`.
7. **Rename: flat → namespace** — `Alert`/`AlertIcon`/`AlertTitle`/`AlertDescription` → `Alert.Root/.Icon/.Title/.Description`. `alertVariants` stays private (ref also does not export it).
8. **FIX (ruled): dead empty `content`/`title` slots removed — the recipe's `content: ""` and `title: ""` were invoked for nothing. `Item.Content` takes children only; Title classes come from the package-private Item title seam (`item-title-classes.ts`) shared with `Item.Title`, so `Alert.Title` stays an `h*` (§8.2) without copying the string.
9. **`aria-hidden` on the icon is ours, not Phosphor's** (2026-09-03): `Alert.Icon` passes `aria-hidden="true"` after the caller's props (`alert.tsx`), because `@phosphor-icons/react`'s SSR base renders a bare `<svg>` and adds only a `<title>` when `alt` is set — it sets no `aria-hidden` at any weight. §7 credited the icon library with a decorative default that does not exist; the attribute is load-bearing compensation and stays, and the §9 hidden-from-AT assertion is what locks it.

## 9 Test requirements

- `getByRole("alert")` finds Root for every variant; children render inside it.
- **Variant icons**: each variant renders its mapped Phosphor glyph (assert via icon `data-slot`/test hook, hidden from AT — `aria-hidden` verified).
- `getByRole("heading", { level: 3, name })` finds Title; `level={2}` renders an `h2`.
- Action: with both `onAction` and `actionLabel`, `getByRole("button", { name })` exists and fires the handler; with neither, no button renders. The pair is required together.
- Regression for §8.3: passing `variant` to Title/Description is a type error and no `variant` attribute appears in the DOM.
- No `bg-destructive`, `warning-accent`, or raw palette class appears in rendered class lists (token-contract guard).

## 10 Demo requirements

`alert-variants.tsx` (all four variants with Title + Description), `alert-action.tsx` (warning alert with `onAction`/`actionLabel`), `alert-title-only.tsx` (compact single-line alert), `alert-heading-level.tsx` (`level` prop inside an existing outline).
