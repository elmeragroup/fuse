# Frame

## 1 Header

- **Canonical name**: `Frame` — namespace compound: `Frame.Root`, `Frame.Panel`, `Frame.Header`, `Frame.Title`, `Frame.Description`, `Frame.Footer`
- **Export path**: `@elmeragroup/ui` (`import { Frame } from "@elmeragroup/ui"`)
- **Tier**: plain-element composite (no base-ui primitive; pure layout/styling shell)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/frame.tsx`

## 2 Anatomy

| Part | Renders | data-slot |
| --- | --- | --- |
| `Frame.Root` | `<div>` — muted ground (`rounded-xl bg-muted/72 p-1`) | `frame` |
| `Frame.Panel` | `<div>` — white card surface with hairline overlay | `frame-panel` |
| `Frame.Header` | `<header>` (`flex flex-col px-5 py-4`) | `frame-panel-header` |
| `Frame.Title` | `<div>` (`text-sm font-semibold`) | `frame-panel-title` |
| `Frame.Description` | `<div>` (`text-sm text-muted-foreground`) | `frame-panel-description` |
| `Frame.Footer` | `<footer>` (`flex flex-col gap-1 px-5 py-4`) | `frame-panel-footer` |

```tsx
<Frame.Root>
  <Frame.Header>
    <Frame.Title>Invoices</Frame.Title>
    <Frame.Description>Last 30 days</Frame.Description>
  </Frame.Header>
  <Frame.Panel>…content…</Frame.Panel>
  <Frame.Footer>…actions…</Frame.Footer>
</Frame.Root>
```

Header and Footer are siblings of Panel inside Root — they sit directly on the muted ground, not inside a panel. Multiple `Frame.Panel`s may stack (see §4). A `Table.Root` placed anywhere inside `Frame.Root` reshapes itself into a framed panel via the `data-slot="frame"` selector contract (see table.md §6).

**data-slot naming asymmetry (kept)**: the parts are named `Frame.Header` / `Frame.Title` / `Frame.Description` / `Frame.Footer`, but their slots keep the ref's `frame-panel-*` prefix (`frame-panel-header`, etc.). Slots are the ref's stable selector contract — renaming them would break every `in-data-[slot=…]` consumer — so slots stay, and the asymmetry is documented here rather than fixed.

## 3 Props

All parts take `className` (merged via `cn`) plus native element pass-through; none hold state.

| Part | Type | Notes |
| --- | --- | --- |
| `Frame.Root` | `ComponentProps<"div"> & { stackedPanels?: boolean }` | default `false`; switches the sibling-adjacency rules (§4) |
| `Frame.Panel` | `ComponentProps<"div">` | `rounded-xl border bg-background bg-clip-padding p-5 shadow-xs/5` + `before:` hairline overlay (`inset-0`, `rounded-[calc(var(--radius-xl)-1px)]`, `shadow-[0_1px_--theme(--color-black/6%)]`, `pointer-events-none`) |
| `Frame.Header` | `ComponentProps<"header">` | |
| `Frame.Title` | `ComponentProps<"div">` | not a heading element; wrap or `render` a heading when the panel needs one in the outline |
| `Frame.Description` | `ComponentProps<"div">` | |
| `Frame.Footer` | `ComponentProps<"footer">` | |

## 4 Variants

No tv recipe. The only axis is `Frame.Root`'s `stackedPanels` boolean, implemented as two alternative sibling-adjacency class sets on Root (kept verbatim — no-refactor zone):

- **`stackedPanels: false`** (default): `*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1` — adjacent panels are separated by a 4px gutter of the muted ground.
- **`stackedPanels: true`**: adjacent panels fuse into one card — any child immediately followed by a panel loses its bottom radius and hides its hairline overlay (`*:has-[+[data-slot=frame-panel]]:rounded-b-none` + `…:before:hidden`), and any panel immediately following a panel loses its top radius and top border (`*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:rounded-t-none` + `…:border-t-0`).

Both sets select on the `frame-panel` slot, which is why Panel's slot name is load-bearing (§2 asymmetry note).

## 5 Consumed tokens

`muted` (`bg-muted/72` Root ground), `muted-foreground` (Description), `background` (`bg-background` Panel surface), `border` (Panel border), `--radius-xl` (Root and Panel `rounded-xl`; hairline `rounded-[calc(var(--radius-xl)-1px)]`). Shadow: `shadow-xs/5` plus the kept `--theme()` literal `before:shadow-[0_1px_--theme(--color-black/6%)]` — the 1px inner-highlight hairline, documented as a literal, not a token (table.md's in-frame body uses the identical technique).

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2 (`frame`, `frame-panel`, `frame-panel-header`, `frame-panel-title`, `frame-panel-description`, `frame-panel-footer`). No state attributes.

**Consumed (self)**: Root's adjacency rules select children by `data-slot="frame-panel"` (§4).

**Consumed (by others — exported contract)**: `data-slot="frame"` on Root is the anchor for `Table.*`'s `in-data-[slot=frame]:` reshaping chain (table.md §6). Renaming either slot value is a breaking change across the family.

## 7 Accessibility

- Purely presentational: divs plus semantic `<header>`/`<footer>` in Header/Footer. Because Root is a `<div>` (not `<section>`/`<article>`), the header/footer elements do not create landmark roles in most contexts — acceptable; they exist for document semantics.
- `Frame.Title` renders a `<div>`, deliberately outline-neutral: frames appear at arbitrary nesting depths, so heading level is the consumer's call (pass a heading via `render` or as children).
- No keyboard behavior, no ARIA wiring, no focus management.

## 8 Divergence from reference

1. **Rename: flat → namespace** — ref exports `Frame`, `FramePanel`, `FrameHeader`, `FrameTitle`, `FrameDescription`, `FrameFooter`; ours are `Frame.Root/.Panel/.Header/.Title/.Description/.Footer`.
2. **KEPT: `frame-panel-*` slot prefix asymmetry** — part names say `Frame.Header`, slots say `frame-panel-header`; retained verbatim (§2).
3. **KEPT (no-refactor zone): sibling-adjacency rules and `stackedPanels`** — the `has-[+[data-slot=frame-panel]]` / `[[data-slot=frame-panel]+[data-slot=frame-panel]]` selector pairs are the component's core mechanism and port as-is.
4. **KEPT: `--theme()` shadow literal** — `before:shadow-[0_1px_--theme(--color-black/6%)]` retained; the hairline is a deliberate literal shared with table.md.
5. **Frame ↔ Card**: the card judgment call (see card.md §8) decomposes the ref's monolithic `CardSection` so that its sectioned-surface role maps onto `Frame.Panel`; Card owns the standalone-card look, Frame owns grouped/stacked panels on a muted ground. Cross-reference, no API coupling.
6. No `dark:` classes, no raw palette classes in the ref — nothing to clean.

## 9 Test requirements

- Structure: Root renders children in order; each part emits its exact `data-slot` from §2 (the table.md contract depends on `frame`; the adjacency rules depend on `frame-panel`).
- `Frame.Header`/`Frame.Footer` render real `<header>`/`<footer>` elements (queried via `container` tag assertions; no landmark roles expected under a div parent — assert that explicitly).
- `stackedPanels` toggles the class-set swap: with it true, DOM snapshot of two adjacent panels differs from the default (unit-level class assertion is acceptable here since the axis is class-only).
- **Browser test (visual contract)**: two stacked panels render with fused borders (no double border, no inner radius) at `stackedPanels`, and with a visible 4px gutter otherwise; Panel's hairline overlay is non-interactive (`pointer-events: none`).

## 10 Demo requirements

Plain runnable `.tsx` demos: `frame-basic.tsx` (Root > Header (Title + Description) + one Panel + Footer), `frame-stacked-panels.tsx` (`stackedPanels` with three fused panels vs the default gutter side-by-side), `frame-with-table.tsx` (a `Table.Root` inside `Frame.Root` — the cross-component reshape, shared with table.md's `table-in-frame.tsx` scenario).
