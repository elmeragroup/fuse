# Empty

## 1 Header

- **Canonical name**: `Empty` (namespace: `Empty.Root`, `Empty.Header`, `Empty.Media`, `Empty.Title`, `Empty.Description`, `Empty.Content`)
- **Export path**: `@elmeragroup/ui/empty` (also re-exported from `@elmeragroup/ui`)
- **Tier**: styled layout composite (plain elements; no base-ui primitive)
- **RSC**: server
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/empty.tsx`

## 2 Anatomy

Centered empty-state block: media/icon, then header (title + description), then content (actions, links).

```tsx
<Empty.Root variant="outline-dashed">
  <Empty.Header>
    <Empty.Media variant="icon">
      <Tray />
    </Empty.Media>
    <Empty.Title>No orders yet</Empty.Title>
    <Empty.Description>Orders you create will show up here.</Empty.Description>
  </Empty.Header>
  <Empty.Content>
    <Button>Create order</Button>
  </Empty.Content>
</Empty.Root>
```

| Part                | Element | Notes                                                                                                            |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `Empty.Root`        | `div`   | `flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg p-6 text-center text-balance md:p-12` |
| `Empty.Header`      | `div`   | `flex max-w-sm flex-col items-center gap-2 text-center`                                                          |
| `Empty.Media`       | `div`   | icon/illustration box; own `variant` axis                                                                        |
| `Empty.Title`       | `div`   | `text-lg font-medium tracking-tight` — deliberately not a heading (§7)                                           |
| `Empty.Description` | `p`     | muted, link-styling hooks for inline `<a>`                                                                       |
| `Empty.Content`     | `div`   | `flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance`                                  |

## 3 Props

All parts: `React.ComponentProps<"div">` (`Empty.Description`: `React.ComponentProps<"p">`) plus, where noted, `VariantProps` of a private recipe.

| Part          | Prop        | Type                                         | Default     | Notes                                                             |
| ------------- | ----------- | -------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `Empty.Root`  | `variant`   | `"default" \| "outline" \| "outline-dashed"` | `"default"` | private `emptyVariants` axis                                      |
| `Empty.Media` | `variant`   | `"default" \| "icon"`                        | `"default"` | private `emptyMediaVariants` axis; also emitted as `data-variant` |
| all           | `className` | `string`                                     | —           | merged via `cn`                                                   |

## 4 Variants

Recipes: **`emptyVariants`** and **`emptyMediaVariants`** — both **PRIVATE** (module-scoped micro-recipes; no borrow pattern exists, ruled to stay unexported).

| Recipe               | Axis      | Values                                                                                                                     | Default   |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- | --------- |
| `emptyVariants`      | `variant` | `default` (frameless) · `outline` (`border border-border`) · `outline-dashed` (`border border-dashed border-border`)       | `default` |
| `emptyMediaVariants` | `variant` | `default` (`bg-transparent`) · `icon` (`size-10 rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6`) | `default` |

Media base carries `mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0`.

## 5 Consumed tokens

- `border` — outline/outline-dashed frames.
- `muted` / `foreground` — `icon` media box fill and glyph.
- `muted-foreground` — description text.
- `primary` — hovered inline links in description (`[&>a:hover]:text-primary`).
- `--radius` — `rounded-lg` on root and icon media.

## 6 Data attributes

**Emitted**: `data-slot="empty" | "empty-header" | "empty-media" | "empty-title" | "empty-description" | "empty-content"`; `Empty.Media` also emits `data-variant="default" | "icon"`.

**Consumed**: none.

## 7 Accessibility

- `Empty.Title` is intentionally a `div`, not a heading — empty states are transient placeholders and must not perturb the page outline. Consumers needing a heading pass one as children of `Empty.Header`.
- `Empty.Description` renders a real `p`; inline links inside it get underline + hover-primary treatment and remain normal tab stops.
- Actions in `Empty.Content` are ordinary focusable controls; the component adds no focus management, roles, or live-region semantics. If the empty state replaces async results, the consumer owns the `aria-live` announcement.

## 8 Divergence from reference

1. **Namespace rename**: flat `Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent` → `Empty.Root`/`.Header`/`.Media`/`.Title`/`.Description`/`.Content`.
2. **`Empty.Media` data-slot mismatch fixed (ruled)**: the ref emits `data-slot="empty-icon"` on the media part while every sibling follows `empty-{part}` — becomes `data-slot="empty-media"`.
3. **`Empty.Description` element mismatch fixed (ruled)**: the ref types the part as `ComponentProps<"p">` but renders a `div` — spec renders a `p` to match the type (and the item-family description parts).
4. **Recipes stay private (ruled)**: `emptyVariants`/`emptyMediaVariants` are not exported.
5. Kept as-is, documented: the ref double-defaults `variant` (destructured default `"default"` plus `defaultVariants`) — harmless; spec keeps `defaultVariants` as the single source and the destructured default for the `data-variant` emit.

## 9 Test requirements

- Renders title/description/content children reachable by text queries; actions inside `Empty.Content` reachable via `getByRole("button" | "link")`.
- No heading role emitted by `Empty.Title` (regression guard on the outline decision).
- `Empty.Description` renders a `p` element (tag assertion — guards divergence 3).
- `Empty.Media` emits `data-slot="empty-media"` (guards divergence 2) and `data-variant` per prop.
- Root variants: `outline` and `outline-dashed` carry border classes; `default` carries none.
- Inline `<a>` inside description is focusable and styled hooks apply.

## 10 Demo requirements

Plain runnable `.tsx` demos: `empty-basic.tsx` (icon media + title + description), `empty-outline.tsx` (outline vs outline-dashed), `empty-with-actions.tsx` (Content with primary/secondary buttons), `empty-media-variants.tsx` (default illustration vs icon box), `empty-inline-link.tsx` (description with an inline link).
