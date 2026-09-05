# Card

## 1 Header

- **Canonical name**: `Card` (namespace: `Card.Root`, `Card.Header`, `Card.Tag`, `Card.Title`, `Card.Description`, `Card.Action`, `Card.Content`, `Card.Footer`); recipe `cardVariants` (PUBLIC)
- **Export path**: `@elmeragroup/ui/card` (also re-exported from `@elmeragroup/ui`); `cardVariants` comes from the same entry
- **RSC**: server
- **Tier**: styled layout surface (no base-ui primitive; plain elements)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/card.tsx` + `styles/card.ts`. The rich external card (`.ref/OrderModuleWeb/packages/ui/src/card.tsx`) is **decomposed away** — see §8.

## 2 Anatomy

All parts are plain elements styled by the `cardVariants` slot recipe. Every part accepts the shared `direction` axis so a part rendered outside `Card.Root` still resolves the right slot classes (tv slots are per-part, not context-driven — each part re-invokes the recipe).

```tsx
<Card.Root>
  <Card.Header>
    <Card.Tag>Invoice</Card.Tag>
    <Card.Title icon={<Lightning aria-hidden />}>March usage</Card.Title>
    <Card.Description>Estimated consumption for the period.</Card.Description>
    <Card.Action><Button size="sm">Export</Button></Card.Action>
  </Card.Header>
  <Card.Content>…</Card.Content>
  <Card.Footer>…</Card.Footer>
</Card.Root>
```

| Part | Element | Slot |
| --- | --- | --- |
| `Card.Root` | `div` | `base` |
| `Card.Header` | `div` (container query scope `@container/card-header`, grid) | `cardHeader` |
| `Card.Tag` | `div` | `cardTag` |
| `Card.Title` | `h3` (via `level`, default 3) | `cardTitle` |
| `Card.Description` | `p` | `cardDescription` |
| `Card.Action` | `div` (grid col 2, row-span 2) | `cardAction` |
| `Card.Content` | `div` | `cardContent` |
| `Card.Footer` | `div` | `cardFooter` |

## 3 Props

All parts: `React.HTMLAttributes<HTML…Element> & VariantProps<typeof cardVariants>` (`direction` + `className` + native props).

| Part | Prop | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| all | `direction` | `"vertical" \| "horizontal"` | `"vertical"` | shared tv axis; pass to each part used |
| `Card.Title` | `level` | `1‑6` | `3` | heading element level (`h3` default) |
| `Card.Title` | `size` | typography size | `"2xl"` | maps to `text-{size}`; kept from ref |
| `Card.Title` | `icon` | `ReactNode` | — | rendered before children; adds `flex items-center gap-x-1.5 [&>svg]:size-5` |
| `Card.Description` | `size` | typography size | `"sm"` | maps to `text-{size}` |

## 4 Variants

Recipe: **`cardVariants`** — **PUBLIC** (slot recipe). Sanctioned borrow: `text-field`'s `card` variant composes it (see text-field.md §4), so the recipe stays exported and typed via `VariantProps`.

| Axis | Values | Default |
| --- | --- | --- |
| `direction` | `vertical` (header/content/footer take `p-6`, content/footer `pt-0`) · `horizontal` (`flex-row items-center space-x-6 p-6` on base; title `text-xl`) | `vertical` |

One axis only — this is deliberate (§8). Base slot classes: `base` = `flex flex-col rounded-lg border bg-card text-card-foreground shadow-xs`; `cardHeader` = `@container/card-header grid auto-rows-min items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto]` (two-column grid appears only when a `Card.Action` is present); `cardAction` = `col-start-2 row-span-2 row-start-1 self-start justify-self-end`.

## 5 Consumed tokens

- `card` / `card-foreground` — surface fill and text (`bg-card text-card-foreground`).
- `border` — root border (via bare `border`).
- `muted-foreground` — `Card.Tag` and `Card.Description` text.
- `--radius` — `rounded-lg` derives from the radius scale; no hardcoded radii.

## 6 Data attributes

**Emitted**: `data-slot="card" | "card-header" | "card-tag" | "card-title" | "card-description" | "card-action" | "card-content" | "card-footer"` on the respective parts.

**Consumed**: `Card.Header` styles against `has-data-[slot=card-action]` (grid columns switch on when an action child exists). External targeting/testing goes through `data-slot` — no dedicated test-id prop (§8).

## 7 Accessibility

- `Card.Title` renders a real heading (`h3` by default; `level` prop adjusts document outline). Consumers must keep levels consistent with page structure.
- `Card.Description` is a plain `p` — no aria wiring; the card is a non-interactive surface.
- Interactive rows inside cards are not part of this component — use `Item.Root render={<a/>}` / `render={<button/>}` (see item.md) so focus/keyboard semantics come from real interactive elements.
- No focus or keyboard behavior of its own.

## 8 Divergence from reference

**LOCKED ruling (judgment call 7, user-ruled): decomposition wins.** The internal ref's lean card is the spec; the external ref's rich card (17 exports, 9 variant axes) is decomposed onto other primitives and its extra axes die.

1. **Namespace rename**: flat `Card`/`CardHeader`/`CardTag`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter` → `Card.Root`/`.Header`/`.Tag`/`.Title`/`.Description`/`.Action`/`.Content`/`.Footer` per conventions.
2. **DE-RAC — `Card.Title`**: the ref renders react-aria `Heading`; spec renders a plain `h3` element. `level` prop kept (default 3), `size` default `"2xl"` kept, `icon` prop kept.
3. **DE-RAC — `Card.Description`**: the ref renders react-aria `Text`; spec renders a plain `p`. `size` default `"sm"` kept.
4. **External-card migration mapping** (OrderModuleWeb consumers moving off the rich card):

| External part | New home |
| --- | --- |
| `CardSection` | `Frame.Panel` |
| `CardSectionHeader` | `Frame.Header` + `Frame.Title` |
| `CardLabelValueRow` / `CardLabel` / `CardValue` / `CardLabelValue` | `DescriptionList` parts, or `VerticalTable.Body` `data` prop for tabular label/value sets |
| `CardSectionAnchor` | `Item.Root render={<a href=…/>}` |
| `CardSectionButton` | `Item.Root render={<button/>}` |
| `CardSectionSideContent` | `Item.Media` |
| `CardText` | `Card.Description` |

5. **Dead external axes**: `emphasis` (6 values), `variant` (7 surfaces: default/bright/secondary/tertiary/quaternary/transparent/outline), `padding`, `border`, `noTop`, `noBottom`, `spacing`, `withSideContent` all **die**. Surface/weight decisions move to consumer `className`; section rounding/border concerns die with `CardSection`.
6. **External `dataTestId` prop dies** (`CardLabel`/`CardValue`/`CardLabelValue`) — `data-slot` serves targeting.
7. Source facts, kept as-is: the internal ref's external counterpart declares `background: "default"` in `defaultVariants` with no matching `background` axis (external-ref bug; irrelevant post-decomposition). The internal ref's `CardTitle` default size is `"2xl"` while the external ref's is `"h4"` — internal wins.

## 9 Test requirements

- `Card.Title` renders `getByRole("heading", { level: 3 })` by default; `level={2}` yields level-2 heading.
- All eight parts emit their `data-slot` values.
- Header grid: with a `Card.Action` child the header carries the `has-data-[slot=card-action]` two-column class state; without one it does not.
- `direction="horizontal"` on `Card.Root` applies `flex-row`; default is column.
- `icon` on `Card.Title` renders before the title text and applies the icon-gap classes.
- `cardVariants` unit: slot functions resolve for both directions; `base()` contains `bg-card`.
- No `destructive`, raw palette, or `dark:` classes in resolved output.

## 10 Demo requirements

Plain runnable `.tsx` demos: `card-basic.tsx` (Root/Header/Title/Description/Content/Footer), `card-with-action.tsx` (Header action slot grid), `card-tag.tsx` (Tag above Title, icon title), `card-horizontal.tsx` (`direction="horizontal"` on all parts), `card-item-rows.tsx` (interactive rows built from `Item.Root render={<a/>}` inside `Card.Content` — the external-card replacement pattern).
