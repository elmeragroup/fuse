# Item

## 1 Header

- **Canonical name**: `Item` (namespace: `Item.Root`, `Item.Media`, `Item.Content`, `Item.Actions`, `Item.Group`, `Item.Separator`, `Item.Title`, `Item.Description`, `Item.Header`, `Item.Footer`); recipe `itemVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/item` (also re-exported from `@elmeragroup/ui`); `itemVariants` comes from the same entry
- **RSC**: client — uses base-ui `useRender` and Item.Group context
- **Tier**: base-ui-era layout composite (`useRender` polymorphic root; other parts plain elements)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/item.tsx`. The react-aria `react-aria/item.tsx` sibling is the **retired RAC tier** — deltas in §8.

## 2 Anatomy

A media/content/actions row, optionally grouped with separators. `Item.Root` is the family's `useRender` convention exemplar: polymorphic via `render`, with variant state flowing into data attributes (§6).

```tsx
import { Lightning } from "@elmeragroup/ui/icons";

<Item.Group>
  <Item.Root variant="outline" render={<a href={order.href} />}>
    <Item.Media variant="icon">
      <Lightning aria-hidden />
    </Item.Media>
    <Item.Content>
      <Item.Title>{order.name}</Item.Title>
      <Item.Description>{order.summary}</Item.Description>
    </Item.Content>
    <Item.Actions>
      <Badge variant="success">Active</Badge>
    </Item.Actions>
  </Item.Root>
  <Item.Separator />
</Item.Group>;
```

| Part               | Element                                 | Notes                                                                                                 |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Item.Root`        | `useRender` (default `div`)             | flex-wrap row; `group/item` scope                                                                     |
| `Item.Media`       | `div`                                   | leading icon/image box; own `variant` axis                                                            |
| `Item.Content`     | `div`                                   | `flex-1` column; second adjacent content goes `flex-none`                                             |
| `Item.Title`       | `div`                                   | `line-clamp-1 text-sm font-medium` — plain div, no heading                                            |
| `Item.Description` | `p`                                     | `line-clamp-2 text-muted-foreground`, inline-link hooks                                               |
| `Item.Actions`     | `div`                                   | trailing controls row                                                                                 |
| `Item.Header`      | `div`                                   | `basis-full justify-between` full-width leading row                                                   |
| `Item.Footer`      | `div` + inner `item-footer-content` div | grid-rows reveal animation via `mode`                                                                 |
| `Item.Group`       | `div role="list"`                       | provides private group context; `gap-4`, tightens to `gap-2.5`/`gap-2` when it contains `data-size=sm | xs` items |
| `Item.Separator`   | `Separator`                             | horizontal, `my-2`                                                                                    |

## 3 Props

| Part             | Prop               | Type                                 | Default     | Notes                                                             |
| ---------------- | ------------------ | ------------------------------------ | ----------- | ----------------------------------------------------------------- |
| `Item.Root`      | `variant`          | `"default" \| "outline" \| "muted"`  | `"default"` | tv axis, also emitted as state                                    |
| `Item.Root`      | `size`             | `"default" \| "sm" \| "xs"`          | `"default"` | tv axis, also emitted as state                                    |
| `Item.Root`      | `render`           | `useRender` render prop              | `div`       | polymorphism (`<a/>`, `<button/>`); props merged via `mergeProps` |
| `Item.Media`     | `variant`          | `"default" \| "icon" \| "image"`     | `"default"` | emitted as `data-variant`                                         |
| `Item.Footer`    | `mode`             | `"default" \| "visible" \| "hidden"` | `"default"` | animated reveal/collapse; emitted as `data-mode`                  |
| `Item.Separator` | …`Separator` props | —                                    | —           | `orientation` preset to `horizontal`                              |
| all              | `className`        | `string`                             | —           | merged via `cn`                                                   |

All parts otherwise spread native props; `Item.Root` is `useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>`.

## 4 Variants

Recipe: **`itemVariants`** — **PUBLIC**. The ref exports it and `selection-item` borrows it (see selection-item.md); sanctioned borrow pattern.

| Recipe                         | Axis      | Values                                                                                                                                                                            | Default   |
| ------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `itemVariants`                 | `variant` | `default` (`border-transparent`) · `outline` (`border-border`) · `muted` (`border-transparent bg-muted/50`)                                                                       | `default` |
| `itemVariants`                 | `size`    | `default` (`gap-3.5 px-4 py-3.5`) · `sm` (`gap-2.5 px-3 py-2.5`) · `xs` (`gap-2 px-2.5 py-2`, zeroed inside dropdown-menu content via `in-data-[slot=dropdown-menu-content]:p-0`) | `default` |
| `itemMediaVariants` (private)  | `variant` | `default` · `icon` (`svg size-4` guard) · `image` (`size-10 rounded-sm` box, shrinks with item size; see outline note)                                                            | `default` |
| `itemFooterVariants` (private) | `mode`    | `default` (static open) · `visible` (`starting:` entry animation) · `hidden` (collapsed `0fr`, pointer-events-none)                                                               | `default` |

Item's `size` axis is density-classified as **not a control-box rung**: it encodes row padding and gap, which sit outside the control-box remit (conventions.md density ladder; ruling 82, 2026-08-22: a layout size axis without a pinned control height is legal). The lint treats a layout size axis without a pinned control height as legal.

Base notes:

- Root base: `group/item flex w-full flex-wrap items-center rounded-md border text-sm transition-colors duration-100 [a]:transition-colors [a]:hover:bg-muted` plus shared `focusRing({ target: "self" })`; link-rendered items get hover fill automatically. The recipe owns outline suppression only while drawing its replacement ring.
- **`image` media outline**: `outline outline-1 -outline-offset-1 outline-black/10` — the `black/10` (and the ref's dark-side `white/10`) alpha literals are deliberate image-edge hairlines, not theme colors; kept and documented (dark half dropped, §8).
- Media nudges: `group-has-data-[slot=item-description]/item:translate-y-0.5 …:self-start` aligns media to first text line when a description exists.
- Footer reveal uses CSS grid-row `0fr↔1fr` + `@starting-style` — no JS animation.

## 5 Consumed tokens

- `border` — outline variant and root border slot.
- `muted` / `muted-foreground` — muted variant fill (`bg-muted/50`), link hover (`[a]:hover:bg-muted`), icon media box, description text.
- `foreground` — inherited text; `primary` — hovered inline links in description.
- `ring` — shared self-focus recipe.
- `--radius` — `rounded-md` root, `rounded-sm` image media.
- Sanctioned literals: `outline-black/10` (image hairline; see §4/§8).

## 6 Data attributes

**Emitted** — `Item.Root` is the **convention exemplar** for `useRender` state-driven attributes: it passes `state: { slot: "item", variant, size }` to `useRender`, which base-ui serializes to `data-slot="item" data-variant="…" data-size="…"` on whatever element `render` produces — state survives polymorphism, unlike hand-placed attributes. Inside `Item.Group`, the root also defaults to `role="listitem"`; an explicit `role` prop wins. Other parts emit literal `data-slot="item-media" | "item-content" | "item-title" | "item-description" | "item-actions" | "item-header" | "item-footer" | "item-footer-content" | "item-group" | "item-separator"`; `Item.Media` adds `data-variant`; `Item.Footer` adds `data-mode`.

**Consumed**: `Item.Group` gap tightens via `has-data-[size=sm]` / `has-data-[size=xs]`; media/description alignment via `group-has-data-[slot=item-description]/item`; image media sizes via `group-data-[size=sm]/item` / `group-data-[size=xs]/item`; xs padding zeroing via `in-data-[slot=dropdown-menu-content]`.

## 7 Accessibility

- `Item.Group` renders `role="list"` and provides a private context. `Item.Root` reads it once and defaults to `role="listitem"` inside the group, unless the consumer supplies a different `role`; outside a group it adds no role.
- Interactivity comes from `render`: `render={<a href/>}` and `render={<button/>}` give native focus/keyboard semantics; the root's `focus-visible` ring styles then apply. Never wire click handlers onto the default `div`.
- `Item.Title` is a plain `div` — no heading semantics (deliberate; see §8 RAC deltas).
- `Item.Footer` `mode="hidden"` is `pointer-events-none` and visually collapsed but not `display:none`/`aria-hidden` — consumers hiding focusable content must also make it inert.

## 8 Divergence from reference

1. **Namespace rename**: flat `Item`/`ItemMedia`/`ItemContent`/`ItemActions`/`ItemGroup`/`ItemSeparator`/`ItemTitle`/`ItemDescription`/`ItemHeader`/`ItemFooter` → `Item.Root`/`.Media`/`.Content`/`.Actions`/`.Group`/`.Separator`/`.Title`/`.Description`/`.Header`/`.Footer`.
2. **`dark:` half of the image outline dropped** (`dark:outline-white/10`) per `no-tailwind-dark-variant`; the light `outline-black/10` alpha literal is kept and documented as a sanctioned image-edge hairline (the dark-theme equivalent moves to tokens when the dark axis lands).
3. **Focus unified:** the ref's local three-pixel ring becomes the shared two-pixel ring with offset.
4. **RAC item retired — deltas its consumers will notice.** The react-aria `item.tsx` surface does not carry over; `alert` re-homes onto THIS item (see alert.md):
   - `ItemLink` (react-aria `Link` + predictive intent props) → `Item.Root render={<a/>}`. Intent-prefetch is not part of Item. Apps that need prefetch own it through their router/link API or app-level event code; no library helper hook is public.
   - `Item.Title` is a plain `div` — the RAC Title's `Heading` base and its `level`/`size`/`font` props (and the long-word `break-all` heuristic) are gone.
   - `Item.Description` loses the RAC `Text` `slot="description"` wiring and `size` prop; it is a plain `p`.
   - `ItemGroup`'s `compact` variant (collapsed gaps + fused outline borders on children) is gone — one group layout; the base-ui group auto-tightens gap by item size instead.
   - `ItemFooter`'s `isIsolateInteractionEnabled` (stopPropagation shield) is gone; isolate interactions in consumer handlers.
   - RAC `muted` variant was `border-input bg-muted`; base-ui `muted` is `border-transparent bg-muted/50`. RAC link hover was `bg-accent/50`; base-ui is `bg-muted`.
   - RAC sizes were `default`/`sm`; base-ui adds `xs`.
5. **List semantics fixed:** the base-ui ref dropped the RAC item's default `role="listitem"` while `Item.Group` kept `role="list"`, creating a half-list. This spec follows the cluster-wide accessibility ruling: group context makes `Item.Root` default to `role="listitem"` inside `Item.Group`, while an explicit consumer `role` remains authoritative.
6. `itemVariants` publicity confirmed (ref exports it; `selection-item` borrows it). `itemMediaVariants`/`itemFooterVariants` stay private.
7. **Layout size axis (ruling 82, 2026-08-22):** Item's `size` encodes row padding and gap, not a control-box rung; a layout size axis without a pinned control height is legal for the density lint.

## 9 Test requirements

- `Item.Root render={<a href/>}` renders `getByRole("link")` carrying `data-slot="item"`, `data-variant`, `data-size` (state-through-render exemplar assertion); `render={<button/>}` likewise for `getByRole("button")`.
- Keyboard: link/button-rendered items are tabbable; focus shows the `focus-visible` ring classes; Enter activates.
- `Item.Group` has `role="list"`; its default `Item.Root` children are queryable as list items without consumer props; an explicit role overrides that default; an item outside a group has no implicit role.
- Variant/size matrix resolves classes; `xs` inside a `data-slot="dropdown-menu-content"` container gets zeroed padding (class-state assertion).
- `Item.Media variant="image"` emits `data-variant="image"` and never a `dark:` class.
- `Item.Footer` mode transitions: `hidden` carries `pointer-events-none` + `0fr`; `visible` carries `starting:` classes; `data-mode` matches prop.
- `itemVariants` unit: defaults resolve; public export exists from the package root.
- Type tests (`*.test-d.tsx`, tooling §7.3): the namespace ships all ten parts from `@elmeragroup/ui/item` and the root barrel; `itemVariants` is public and carries the `variant` / `size` axes; `Item.Root` takes `useRender`'s `render` and never an `as` prop; `Item.Media` and `Item.Footer` reject off-axis values _(Added 2026-09-03 — [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

Plain runnable `.tsx` demos: `item-basic.tsx` (media/content/actions row), `item-as-link.tsx` (`render={<a/>}`, hover fill), `item-as-button.tsx` (`render={<button/>}`), `item-group.tsx` (Group + automatic list-item semantics + Separator, mixed sizes showing gap auto-tighten), `item-media-variants.tsx` (icon vs image box), `item-footer-reveal.tsx` (mode default/visible/hidden toggling), `item-sizes.tsx` (default/sm/xs).
