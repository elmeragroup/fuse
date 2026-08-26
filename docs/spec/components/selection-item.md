# SelectionItem

## 1 Header

- **Canonical name**: `SelectionItem` (namespace compound)
- **Export path**: `@elmeragroup/ui/selection-item` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: base-ui structural primitive — the shared card row shell that `CheckboxItem` and `RadioItem` (labeled selection rows) plug a control into. Not usable standalone without a `Field.Root` + group primitive supplying context.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/selection-item.tsx` (part styling reused from `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/item.tsx`; `disabledHatch` from `.ref/OrderModuleInternalWeb/packages/ui/src/styles/utils.ts`)

## 2 Anatomy

Six parts. `Shell` renders a `Field.Item` containing a full-width `Field.Label` row (control + row children) and, when present, a sub-section band below the label. `Content`, `Description`, `Actions`, `Title`, `SubSection` are thin wrappers/re-exports of the `Item` family.

| Part                        | Base                                                              | Notes                                                         |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `SelectionItem.Shell`       | `Field.Item` + base-ui `Field.Label` + `ItemMedia variant="icon"` | card row; partitions children (see §7/§8)                     |
| `SelectionItem.Title`       | `ItemTitle` (`div`)                                               | adds `font-normal`                                            |
| `SelectionItem.Description` | `ItemDescription` (`p`)                                           | re-export, unmodified                                         |
| `SelectionItem.Content`     | `ItemContent` (`div`)                                             | re-export, unmodified                                         |
| `SelectionItem.Actions`     | `ItemActions` (`div`)                                             | adds `-translate-y-0.5 items-start`                           |
| `SelectionItem.SubSection`  | `ItemFooter` (`div`)                                              | returns `null` when childless; rendered **outside** the label |

```tsx
<SelectionItem.Shell dataSlot="radio-item" control={<RadioGroupItem value="a" />}>
  <SelectionItem.Content>
    <SelectionItem.Title>Fixed price</SelectionItem.Title>
    <SelectionItem.Description>Locked for 12 months.</SelectionItem.Description>
  </SelectionItem.Content>
  <SelectionItem.Actions>{badge}</SelectionItem.Actions>
  <SelectionItem.SubSection mode={selected ? "visible" : "hidden"}>{details}</SelectionItem.SubSection>
</SelectionItem.Shell>
```

## 3 Props

All parts accept `className` (merged via `cn`).

**SelectionItem.Shell**

| Prop              | Type               | Default      | Notes                                                                                                                                                                                                 |
| ----------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataSlot`        | `string`           | — (required) | emitted as `data-slot` on the `Field.Item` root (`"checkbox-item"`, `"radio-item"`)                                                                                                                   |
| `control`         | `ReactNode`        | — (required) | the selection control rendered in the `ItemMedia variant="icon"` slot; **documented escape hatch** for custom indicators (switch, icon crossfade) that the dropped external-card axes used to provide |
| `controlPosition` | `"start" \| "end"` | `"start"`    | **new axis** (§8.2) — `"end"` places the control slot after the row children (trailing indicator)                                                                                                     |
| `isDisabled`      | `boolean`          | —            | applies `cursor-not-allowed bg-muted` + shared `disabledHatch` overlay                                                                                                                                |
| `children`        | `ReactNode`        | —            | partitioned: `SubSection` elements are pulled out below the label; everything else renders in the label row                                                                                           |

**SelectionItem.SubSection** — `ComponentProps<"div">` plus:

| Prop   | Type                                 | Default     | Notes                                                                                                                                                                                                 |
| ------ | ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode` | `"default" \| "visible" \| "hidden"` | `"default"` | `itemFooterVariants` axis: `default` static open; `visible` animates in (grid-rows + `starting:` styles); `hidden` collapses (`grid-rows-[minmax(0,0fr)]`, `pointer-events-none`, fade/translate out) |

Renders `null` when `Children.toArray(children).length === 0`.

**SelectionItem.Title / Description / Content / Actions** — plain `ComponentProps<"div">` (`"p"` for Description); pass-through to the `Item` parts.

## 4 Variants

- Shell composes the shared `itemVariants` recipe (from `item.tsx`) pinned to `variant: "outline"`; `itemVariants` **is exported** (borrow pattern in the ref), but `SelectionItem` exposes no variant axis of its own besides `controlPosition`.
- `SubSection` uses `itemFooterVariants` (tv, module-private) — `mode` axis above.
- Vertical stacking styles are baked in, not an axis: `rounded-none not-first:border-t-0 first:rounded-t-lg last:rounded-b-lg`, plus the checked border-repaint hack `has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px has-[[data-slot=selection-item-control]_[data-checked]]:not-first:border-t` (§8.6). Checked surface/border selectors are scoped to the private control slot so a checked descendant in SubSection cannot repaint the shell.

## 5 Consumed tokens

- `background` — resting shell surface (`bg-background`).
- `muted` — checked surface (`has-[[data-slot=selection-item-control]_[data-checked]]:bg-muted`) and disabled surface.
- `primary` — checked border (`has-[[data-slot=selection-item-control]_[data-checked]]:border-primary`).
- `border` — resting border via `itemVariants` outline variant.
- `ring` + `background` — the plugged-in Checkbox/Radio control's shared focus recipe. `itemVariants` contains a self-focus adapter for interactive Item uses, but it remains inert on this non-focusable shell.
- `muted-foreground` — Description text (from `ItemDescription`).
- `disabledHatch` overlay is a shared recipe from `styles/utils` (near-transparent black repeating gradient — deliberate non-token texture, shared so it stays identical across CheckboxItem/RadioItem/addon badges).

## 6 Data attributes

**Emitted**: `data-slot` = the `dataSlot` prop on the shell root; private `data-slot="selection-item-control"` on the control-slot `ItemMedia` host (the inherited `item-media` name is replaced on this host so checked-state `:has()` can target the `control` prop only); inherited part slots `item-content`, `item-title`, `item-description`, `item-actions`, `item-footer` (+`data-mode`) and `item-footer-content` on SubSection's inner wrapper. `data-variant="icon"` remains on the control-slot host.

**Consumed**: `data-checked` from the plugged-in control, scoped to the private control slot via `has-[[data-slot=selection-item-control]_[data-checked]]:` (border/surface repaint); `disabled` on the control via `has-disabled:cursor-not-allowed` on the label; `data-slot=item-description` presence shifts `ItemMedia` to `self-start translate-y-0.5`.

## 7 Accessibility

- The whole row is a base-ui `Field.Label` wrapping the control — clicking anywhere in the row toggles/selects the control. Keyboard behavior belongs to the plugged-in control (`Checkbox`, `RadioGroupItem`).
- **SubSections render outside the label** deliberately: interactive content in a sub-section must not toggle the control when clicked. The shell partitions direct children by `child.type === SelectionItem.SubSection` reflection (§8.5).
- Inside `CheckboxItemGroup` / `RadioItemGroup`, `SelectionItem.Shell` defaults to `role="listitem"` so the wrapping `Item.Group` (`role="list"`) is a complete list. That grouping context is private to SelectionItem and is not part of the public namespace. Outside those groups the shell adds no role.
- The sub-section band indents under the text column via an `aria-hidden` spacer `<span>` whose width must equal the control slot width (§8.2); it carries no semantics.
- `isDisabled` styles the surface but does not disable anything itself — disabling is the control's/group's job; the label picks up `has-disabled:cursor-not-allowed`.
- Keyboard focus remains on the plugged-in Checkbox/Radio control, which renders the single canonical ring. The non-focusable shell never draws a second ring.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `SelectionItemShell`→`SelectionItem.Shell`, `SelectionItemTitle`→`SelectionItem.Title`, `SelectionItemDescription`→`SelectionItem.Description` (ref re-exports `ItemDescription`), `SelectionItemContent`→`SelectionItem.Content` (ref re-exports `ItemContent`), `SelectionItemActions`→`SelectionItem.Actions`, `SelectionItemSubSection`→`SelectionItem.SubSection`. `CheckboxItem.*` and `RadioItem.*` expose the same five sub-parts as namespace aliases — **the same objects**, not copies (see checkbox.md/radio-group.md §8).
2. **NEW axis `controlPosition?: "start" | "end"` (default `"start"`)** — the ref hardcodes control-first. `"end"` restores the external RadioCard's trailing-indicator pattern. Requirement: the sub-section indent spacer must **derive its width from the control slot** (same width, same side as the control) instead of the ref's hardcoded `w-4` `<span>` — otherwise wide custom `control` nodes or `controlPosition="end"` misalign the sub-section with the text column.
3. **External card axes DROPPED** — the external ref's RadioCard/CheckboxCard family axes (pluggable switch/checkbox indicator prop, `iconPosition` grid, `shape`, Heading `level`, `wrapChildren={false}`, the `layout`/`itemSpacing`/`connectedEdges` matrix) are not carried over. Migration: pass a custom node via `control` (escape hatch) and compose Title/Description/Content/Actions for layout; stacked-group edge handling is the shell's built-in first/last rounding.
4. **`aria-invalid:aria-checked:border-primary`-style state overrides live on the controls, not the shell** — unchanged here; noted because the shell relies on the control emitting base-ui state attributes for the control-slot-scoped `has-[[data-slot=selection-item-control]_[data-checked]]:` selectors.
5. **`child.type` reflection partitioning KEPT (documented fragility)** — SubSections are detected by identity comparison `child.type === SelectionItemSubSection` on **direct** children only. Wrapping a SubSection in another component, a Fragment, or an HOC hides it from the filter and it renders _inside_ the label (clicks toggle the control). This is deliberate ref behavior (wrappers would defeat the outside-the-label guarantee) and is kept as-is; the constraint must be documented in JSDoc and docs.
6. **`-mt-px` border-collapse hack KEPT** — stacked items collapse borders with `not-first:border-t-0`; a checked non-first item repaints its top border in `primary` by pulling itself up one pixel (`has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px has-[[data-slot=selection-item-control]_[data-checked]]:not-first:border-t`) instead of a z-index lift. Fragile against margin overrides via `className`; kept and documented. The ref's descendant-wide `has-data-checked:` is **not** kept — checked selectors are scoped to the private control slot so a checked interactive control inside SubSection cannot repaint an otherwise unchecked shell.

## 9 Test requirements

- Shell renders `data-slot` from the `dataSlot` prop.
- Click-vs-subsection isolation: with a `Checkbox` control and a SubSection containing a button, clicking the row text toggles the checkbox (role-based query); clicking the SubSection button does **not** change checkbox state.
- Partitioning fragility pinned: a SubSection wrapped in a Fragment renders inside the label (test documents, not fixes, the behavior).
- Childless SubSection renders nothing (`container` has no `item-footer` slot; asserted via absence of its accessible content).
- `mode="hidden"` SubSection content is not clickable (`pointer-events-none`).
- `controlPosition="end"` renders the control after the row children; sub-section spacer width matches the control slot in both positions (layout assertion in browser test).
- `isDisabled` shell with a disabled control: row click does not toggle; surface has disabled styling state.
- Checked state reflects on the shell from the **control slot only** (`data-checked` on the plugged-in control drives border/surface — assert via control's `aria-checked` plus shell attributes, role queries only). An unchecked shell containing a separately checked interactive control inside SubSection retains unchecked surface/top-border state; selecting the shell's own control still paints checked state.

## 10 Demo requirements

Plain runnable `.tsx` demos: `selection-item-basic.tsx` (shell + title/description/actions with a radio control), `selection-item-subsection.tsx` (SubSection with interactive content and `mode` toggling between `visible`/`hidden` on selection), `selection-item-control-end.tsx` (`controlPosition="end"` trailing indicator with custom `control` node), `selection-item-stacked.tsx` (three shells stacked showing border collapse and checked repaint), `selection-item-disabled.tsx` (disabledHatch surface).
