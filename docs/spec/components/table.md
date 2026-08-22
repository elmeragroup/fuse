# Table

## 1 Header

- **Canonical name**: `Table` — namespace compound: `Table.Root`, `Table.Header`, `Table.Body`, `Table.Footer`, `Table.Row`, `Table.Head`, `Table.Cell`, `Table.Caption`. Companion namespace `VerticalTable`: `VerticalTable.Root`, `VerticalTable.Header`, `VerticalTable.Body`, `VerticalTable.Row`, `VerticalTable.Key`, `VerticalTable.Value`.
- **Export path**: `@elmeragroup/ui/table` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client — `VerticalTable.Header` uses base-ui `useRender`; no sortable or selection API is part of v1
- **Tier**: plain-element composite (no base-ui state primitive; semantic `<table>` markup)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/table.tsx`

## 2 Anatomy

| Part                   | Renders                                                             | data-slot                                             |
| ---------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `Table.Root`           | `<div>` scroll container + `<table>`                                | `table-container` (div), `table` (table)              |
| `Table.Header`         | `<thead>`                                                           | `table-header`                                        |
| `Table.Body`           | `<tbody>`                                                           | `table-body`                                          |
| `Table.Footer`         | `<tfoot>`                                                           | `table-footer`                                        |
| `Table.Row`            | `<tr>`                                                              | `table-row`                                           |
| `Table.Head`           | `<th>`                                                              | `table-head`                                          |
| `Table.Cell`           | `<td>`                                                              | `table-cell`                                          |
| `Table.Caption`        | `<caption>`                                                         | `table-caption`                                       |
| `VerticalTable.Root`   | `<div>` (spacing wrapper, carries `data-variant`)                   | `vertical-table-root`                                 |
| `VerticalTable.Header` | `<h2>` (plain semantic heading)                                     | `vertical-table-header`                               |
| `VerticalTable.Body`   | `<div>` bordered wrapper + `Table.Root` (`table-fixed`) + `<tbody>` | `vertical-table` (div), `vertical-table-body` (tbody) |
| `VerticalTable.Row`    | `Table.Row` (`<tr>`), group scope `group/vertical-table-row-item`   | `table-row`                                           |
| `VerticalTable.Key`    | `Table.Cell` (`<td>`, muted key column)                             | `table-cell`                                          |
| `VerticalTable.Value`  | `Table.Cell` (`<td>`)                                               | `table-cell`                                          |

```tsx
<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>Order</Table.Head>
      <Table.Head>Status</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row data-state={isSelected ? "selected" : undefined}>
      <Table.Cell>#1042</Table.Cell>
      <Table.Cell>Active</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table.Root>
```

`VerticalTable` is the key/value ("facts sheet") layout: `Root` > `Header` + `Body`, where `Body` either maps a `data` array to `Row`/`Key`/`Value` triplets or takes them as explicit children (both may be combined; `data` rows render first).

## 3 Props

All parts take `className` (merged via `cn`) plus native element pass-through.

| Part                   | Type                                                                             | Notes                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Table.Root`           | `ComponentProps<"table">`                                                        | props and `className` go to the `<table>`; the scroll-container div is fixed (`relative w-full overflow-x-auto`)                              |
| `Table.Header`         | `ComponentProps<"thead">`                                                        |                                                                                                                                               |
| `Table.Body`           | `ComponentProps<"tbody">`                                                        | carries the full in-frame reshaping chain (§6)                                                                                                |
| `Table.Footer`         | `ComponentProps<"tfoot">`                                                        | `border-t bg-muted/72 font-medium`                                                                                                            |
| `Table.Row`            | `ComponentProps<"tr">`                                                           | consumers set `data-state="selected"` for selection styling (§6)                                                                              |
| `Table.Head`           | `ComponentProps<"th">`                                                           | `h-10 px-2`, left-aligned, `text-muted-foreground`; checkbox column auto-collapse via `has-[[role=checkbox]]:w-px has-[[role=checkbox]]:pe-0` |
| `Table.Cell`           | `ComponentProps<"td">`                                                           | `p-2`, `whitespace-nowrap`; checkbox `has-[[role=checkbox]]:pe-0`                                                                             |
| `Table.Caption`        | `ComponentProps<"caption">`                                                      | `caption-bottom` (set on the table), `mt-4 text-sm text-muted-foreground`                                                                     |
| `VerticalTable.Root`   | `ComponentProps<"div"> & { variant?: "default" \| "non-bordered-compact" }`      | default `"default"`; emits `data-variant`, consumed by descendants                                                                            |
| `VerticalTable.Header` | `ComponentProps<"h2">`                                                           | plain `<h2>`; polymorphic via `render` (`useRender`) if another level is needed                                                               |
| `VerticalTable.Body`   | `ComponentProps<"div"> & { data?: VerticalTableItem[] }`                         | props and `className` go to the wrapper div **only** (§8.3); renders div > `Table.Root className="table-fixed"` > tbody                       |
| `VerticalTable.Row`    | `ComponentProps<"tr"> & { fontWeight?: "normal" \| "bold"; isHidden?: boolean }` | defaults `"normal"`, `false`; emits `data-font-weight`; `isHidden` adds `hidden`                                                              |
| `VerticalTable.Key`    | `ComponentProps<"td"> & { text?: "default" \| "truncate"; isLoading?: boolean }` | defaults `"truncate"`, `false`; `isLoading` swaps children for a `Skeleton` (`h-4 w-full max-w-24`)                                           |
| `VerticalTable.Value`  | `ComponentProps<"td"> & { text?: "default" \| "truncate"; isLoading?: boolean }` | same contract as `Key`                                                                                                                        |

Exported type:

```ts
type VerticalTableItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  fontWeight?: "normal" | "bold"; // per-row, default "normal"
  isLoading?: boolean; // skeletons the value cell, default false
  text?: "default" | "truncate"; // default "truncate"
};
```

`text: "truncate"` applies `truncate`; `"default"` applies `whitespace-normal` (overriding the base cell's `whitespace-nowrap`).

## 4 Variants

- `Table.*`: no tv recipe, no variant axes — single-look class strings whose in-frame branch is selector-driven (§6), not prop-driven.
- `VerticalTable.Root` `variant` axis: `"default" | "non-bordered-compact"` (default `"default"`). Not a tv recipe — implemented as a `data-variant` attribute consumed by descendant `in-data-[variant=non-bordered-compact]:` selectors: the bordered wrapper drops border/background, rows drop borders, `Key` loses its muted background and horizontal padding (`px-0 py-1`), `Value` tightens to `p-1`, skeletons stretch to `h-lh`. Module-private styling; no recipe is exported.

## 5 Consumed tokens

`muted` (`bg-muted/72` footer, row hover, selected rows; `bg-muted/50` `VerticalTable.Key`; skeleton fill via the Skeleton component's `bg-muted`), `muted-foreground` (`Table.Head`, `Table.Caption`), `background` (`bg-background` on the vertical-table wrapper and on in-frame `<td>`s), `border`/`border-border` (row and cell borders), `--radius-xl` (in-frame corner rounding, incl. the `calc(var(--radius-xl)-1px)` inner-hairline radius), `--radius-md` (vertical-table wrapper `rounded-md`). The `Table.Body` in-frame hairline keeps the ref's `--theme()` literal: `before:shadow-[0_1px_--theme(--color-black/6%)]` — a documented literal, not a token (see frame.md, same technique).

## 6 Data attributes

**Emitted**: `data-slot` per part as tabled in §2; `data-variant` on `VerticalTable.Root`; `data-font-weight` on `VerticalTable.Row` (consumed by `Key`/`Value` via `group-data-[font-weight=bold]/vertical-table-row-item:font-medium` / `...=normal]:font-normal`).

**Consumed — `data-state="selected"` contract**: `Table.Row` styles `data-[state=selected]:bg-muted/72`; in-frame, `Table.Body` re-routes it to the cells (`data-[state=selected]:*:[td]:bg-muted/72` while the row itself goes transparent). The library never sets this attribute — consumers (e.g. a TanStack row model) put `data-state="selected"` on `Table.Row`. Kept verbatim as the selection contract.

**Consumed — the in-frame reshaping chain (kept, no-refactor zone)**: `Table.*` reacts to an ancestor `data-slot="frame"` via `in-data-[slot=frame]:` selectors (~1.5 KB of it lives on `Table.Body`). Placed inside `Frame.Root`, the table restyles itself into a framed panel with no prop. Enumerated:

- **Table geometry**: `Table.Root` switches the table to `border-separate border-spacing-0` so per-cell borders and radii can render.
- **Radius clipping**: `Table.Body` gets `rounded-xl`; the four corner `<td>`s get `rounded-ss-xl` / `rounded-se-xl` / `rounded-es-xl` / `rounded-ee-xl` (first row first/last cell, last row first/last cell) — the body's rounded corners are actually cut by the corner cells.
- **Hairline + shadow**: a `before:` overlay (`inset-px`, `rounded-[calc(var(--radius-xl)-1px)]`, `shadow-[0_1px_--theme(--color-black/6%)]`, `pointer-events-none`) draws the inner hairline; hidden outside frames (`not-in-data-[slot=frame]:before:hidden`). Body also gets `shadow-xs/5`.
- **Border relocation**: rows drop `border-b`; instead each `<td>` gets `border-b`, first-row `<td>`s `border-t`, first-column `border-s`, last-column `border-e` — borders move from rows to cells so corners can round.
- **Row backgrounds**: `<td>`s get `bg-background` with `bg-clip-padding` (background must not bleed under the translucent borders at rounded corners); row hover flips cells to `bg-transparent` (the frame's muted ground shows through); selected rows paint cells `bg-muted/72`.
- **Header/Footer**: header `<th>`s compact to `h-9`, header rows lose borders and hover; footer drops its border and background.
- **Cell padding**: first/last cells become `p-[calc(--spacing(2.5)-1px)]` (padding compensates the added 1px cell border); caption becomes `my-4`.

This chain is the family's hardest port and is documented faithfully — ported as-is, never redesigned piecemeal.

## 7 Accessibility

- Native table semantics throughout: `table`/`rowgroup`/`row`/`columnheader`/`cell` roles come from the elements; nothing is re-rolled with ARIA.
- `Table.Root`'s scroll container is a plain div; for keyboard-scrollable wide tables consumers add `tabIndex={0}` + an accessible name themselves (out of scope here).
- `Table.Caption` is a real `<caption>` — preferred accessible name for the table.
- `VerticalTable.Header` is a plain `<h2>` in the document outline (§8.2); it is not programmatically associated with the table — consumers who need the association use `aria-labelledby` on `VerticalTable.Body`.
- `VerticalTable.Key`/`Value` are both `<td>`; keys are visually distinguished only. Consumers needing row-header semantics can pass `render`/element overrides — the default trades `<th scope="row">` for the ref's proven layout, kept as-is.
- Skeleton loading cells: purely visual (see skeleton.md); pair with `aria-busy` on the region when announcing load state matters.
- No keyboard behavior of its own.

## 8 Divergence from reference

1. **Rename: flat → namespace** — `Table → Table.Root`, `TableHeader → .Header`, `TableBody → .Body`, `TableFooter → .Footer`, `TableRow → .Row`, `TableHead → .Head`, `TableCell → .Cell`, `TableCaption → .Caption`; `VerticalTableRoot → VerticalTable.Root`, `VerticalTableHeader → .Header`, `VerticalTableBody → .Body`, `VerticalTableRow → .Row`, `VerticalTableKey → .Key`, `VerticalTableValue → .Value`. The ref's seventh flat export `VerticalTable` (bordered wrapper div + inner `Table`) is folded into `VerticalTable.Body`, which now renders wrapper > table > tbody as one part. Type rename: `TableVerticalBodyItem → VerticalTableItem` (`TableVerticalBodyProps` is subsumed by the part's props).
2. **DE-RAC (ruled)** — the ref's `VerticalTableHeader` wraps react-aria `Heading` (default `level={2}`); replaced by a plain semantic `<h2>` carrying the identical classes the ref's Heading emitted at level 2 (`font-heading text-inherit text-lg leading-snug font-medium`). react-aria leaves this family entirely.
3. **Ref bug fixed (ruled): double `{...props}` spread** — the ref's `VerticalTable` spreads `{...props}` onto **both** the wrapper div and the inner `Table` (duplicating ids, aria attributes and event handlers in the DOM), while `className` went only to the inner table. Fixed: all props including `className` go to the part's root (the wrapper div) only.
4. **Skeleton override token fix (ruled)** — the ref's compact-variant skeleton override `in-data-[variant=non-bordered-compact]:bg-neutral-90` uses a raw palette class (forbidden by `no-primitive-colors`). Replaced with the muted family: `bg-muted` — which equals `Skeleton`'s own base fill, so the color override is dropped as redundant and only the compact `h-lh` sizing override remains.
5. **`dark:` dropped (ruled)** — `Table.Body`'s single `dark:before:shadow-[0_-1px_--theme(--color-white/8%)]` is removed per conventions (`no-tailwind-dark-variant`); consequently its `not-dark:` guard on `bg-clip-padding` becomes unconditional `bg-clip-padding`.
6. **KEPT (no-refactor zones)**: the full in-frame selector chain (§6), the `data-[state=selected]` consumer contract, the `--theme()` shadow literals, and the `calc(--spacing(2.5)-1px)` / `calc(var(--radius-xl)-1px)` arithmetic — all verbatim.

## 9 Test requirements

- Role queries only: `getByRole("table")`, `getAllByRole("row")`, `getByRole("columnheader", { name })`, `getByRole("cell", { name })`; caption names the table (`getByRole("table", { name })`).
- Row-group structure: header/body/footer render `rowgroup` roles; rows land in the right group.
- Selection contract: a `Table.Row` given `data-state="selected"` carries the attribute through to the DOM (styling asserted only in browser tests).
- `VerticalTable.Body` `data` prop: N items render N rows, each with exactly two cells (key then value); `isHidden` rows are `hidden`; `data` rows precede `children` rows.
- `isLoading` on `Key`/`Value` renders a skeleton instead of children (query: cell has no text content, contains the skeleton node); no duplicated ids/handlers on wrapper vs table (regression test for §8.3).
- `VerticalTable.Header` is `getByRole("heading", { level: 2 })`.
- **Browser test (in-frame visual contract)**: a table inside `Frame.Root` gets `border-separate` on the table, rounded corner cells, `bg-background` cells, and a hidden-outside-frame `before` hairline — asserted via computed styles in the browser project, not jsdom.

## 10 Demo requirements

Plain runnable `.tsx` demos: `table-basic.tsx` (plain table: header, body rows, footer, caption, one selected row via `data-state`), `table-in-frame.tsx` (the same table inside `Frame.Root` + `Frame.Panel` siblings, showing the selector-driven reshape), `vertical-table-data.tsx` (`VerticalTable.Root/.Header/.Body` fed a `data` array including `isLoading: true` rows showing skeletons, plus one explicit `Row/Key/Value` child), `vertical-table-compact.tsx` (`variant="non-bordered-compact"`).
