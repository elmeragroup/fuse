# ScrollArea

## 1 Header

- **Canonical name**: `ScrollArea` — namespace compound: `ScrollArea.Root`, `ScrollArea.Bar`
- **Export path**: `@elmeragroup/ui/scroll-area` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: base-ui composite (styled custom scrollbars over native scrolling)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/scroll-area.tsx` (the legacy `styles/scroll-area.ts` tv is retired — §8)

## 2 Anatomy

| Part | base-ui primitive | data-slot |
| --- | --- | --- |
| `ScrollArea.Root` | `ScrollArea.Root` from `@base-ui/react/scroll-area` | `scroll-area` |
| (internal) viewport | `ScrollArea.Viewport` | `scroll-area-viewport` |
| (internal) content | `ScrollArea.Content` | `scroll-area-content` |
| `ScrollArea.Bar` | `ScrollArea.Scrollbar` + `ScrollArea.Thumb` | `scroll-area-scrollbar` / `scroll-area-thumb` |
| (internal) corner | `ScrollArea.Corner` | — |

`ScrollArea.Root` is batteries-included: it renders Viewport → Content around `children`, one `ScrollArea.Bar` for its `orientation`, and a `Corner`. `ScrollArea.Bar` is exported for consumers composing base-ui primitives directly.

```tsx
<ScrollArea.Root className="h-72 rounded-md border">
  {longContent}
</ScrollArea.Root>
```

## 3 Props

### ScrollArea.Root

`ComponentProps<typeof ScrollAreaPrimitive.Root> & { orientation?; type? }`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | which single scrollbar Root renders (§8.3 limitation) |
| `type` | `"auto" \| "always" \| "hover"` | `"hover"` | Radix-style visibility API mapped onto base-ui (§4) |
| `className` | `string` | — | merged onto `relative overflow-hidden` |
| `children` | `ReactNode` | — | wrapped in Viewport → Content |

### ScrollArea.Bar

`ComponentProps<typeof ScrollAreaPrimitive.Scrollbar> & { type?: ScrollAreaType }` — pass-through includes `keepMounted` (overridden by `type` mapping), `render`.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | vertical: `w-2.5 border-l`; horizontal: `h-2.5 flex-col border-t` |
| `type` | `"auto" \| "always" \| "hover"` | `"hover"` | as above |

## 4 Variants

No tv recipe (§8.2). One config map, kept with its source comment verbatim:

```ts
// Base UI has no `type` prop — map the Radix-style API to keepMounted + visibility.
const SCROLLBAR_TYPE = {
  always: { keepMounted: true, className: "opacity-100" },
  auto: { keepMounted: false, className: "opacity-100" },
  hover: {
    keepMounted: false,
    className:
      "pointer-events-none opacity-0 transition-opacity data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0",
  },
} satisfies Record<ScrollAreaType, { keepMounted: boolean; className: string }>;
```

- `always`: bar stays mounted and visible.
- `auto`: unmounted when no overflow; visible whenever mounted.
- `hover` (default): fades in on `data-hovering`/`data-scrolling` (base-ui state attributes), instant (`duration-0`) while scrolling.

## 5 Consumed tokens

`border` (thumb fill `bg-border`; scrollbar edge borders are `*-transparent`), `ring` (viewport composes shared self-focus recipe). Viewport radius is `rounded-[inherit]` — inherits the consumer's radius, no hardcoded value.

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2; base-ui emits `data-orientation` on the scrollbar plus state attributes `data-hovering`, `data-scrolling`, and `data-has-overflow`/`data-overflow-*` family on Root/Viewport.

**Consumed**: the `hover` type's visibility classes key off `data-[hovering]` and `data-[scrolling]` on the scrollbar itself (self-scoped arbitrary data variants per conventions).

## 7 Accessibility

- Native scrolling underneath: the viewport remains a real scroll container, so wheel, touch, PageUp/PageDown, arrows, and screen-reader scrolling all work natively; the custom bars are presentational overlays (`touch-none select-none` on the bar only).
- Viewport is focusable when scrollable per base-ui and composes `focusRing({ target: "self" })`.
- Thumb is pointer-draggable via base-ui; no ARIA roles added — base-ui manages scrollbar semantics.
- `type="hover"` bars set `pointer-events-none` while hidden so they never block content clicks.

## 8 Divergence from reference

1. **Rename** — ref exports `ScrollArea` + `ScrollBar`; ours are `ScrollArea.Root` + `ScrollArea.Bar` per namespace convention.
2. **DELETED: legacy `styles/scroll-area.ts` tv recipe** — the ref carries an unused `scrollAreaVariants` (slots `base`/`viewport`/`scrollbar`/`thumb`, `orientation` axis) that `scroll-area.tsx` never imports; retired so there is exactly one styling source (the component file). Divergence, not a rename: the recipe is gone, not exported.
3. **KEPT, stated honestly: single-orientation Root** — `orientation` on Root renders **one** `ScrollArea.Bar` (plus `Corner`). Two-axis scrolling is not supported by the composite; a consumer needing both axes composes base-ui primitives directly with two `ScrollArea.Bar`s. The spec makes this limitation explicit rather than implying `orientation="horizontal"` adds to a vertical default.
4. **KEPT verbatim: the Radix-style `type` → `keepMounted` + visibility mapping** including the explicit source comment (§4) — it documents why the API diverges from base-ui's surface.
5. No `dark:` classes, no raw palette classes in the ref — nothing to clean.

## 9 Test requirements

- Content renders inside the viewport and is reachable (text query through the scroll container).
- `orientation="vertical"` (default) renders exactly one scrollbar with `data-orientation="vertical"`; `orientation="horizontal"` renders only the horizontal one — never both.
- `type="always"` keeps the scrollbar mounted with `opacity-100` even without hover; `type="hover"` scrollbar carries the `data-[hovering]`-gated classes and `pointer-events-none` at rest.
- Keyboard: focusing the viewport and pressing ArrowDown/PageDown scrolls content (native behavior preserved).
- Overflow-free content with `type="auto"`/`hover` mounts no scrollbar (`keepMounted: false`).

## 10 Demo requirements

Plain runnable `.tsx` demos: `scroll-area-vertical.tsx` (tall list in a fixed-height bordered box), `scroll-area-horizontal.tsx` (`orientation="horizontal"` image strip), `scroll-area-always.tsx` (`type="always"` persistent bar), `scroll-area-composed.tsx` (base-ui primitives + two `ScrollArea.Bar`s for two-axis scrolling — documents the §8.3 escape hatch).
