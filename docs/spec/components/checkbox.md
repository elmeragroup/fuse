# Checkbox

## 1 Header

- **Canonical name**: `Checkbox` (primitive), `CheckboxGroup` (labeled composite), `CheckboxItem` (labeled selection row, also a namespace), `CheckboxItemGroup`, `CheckboxDescription`
- **Export path**: `@elmeragroup/ui/checkbox` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: `Checkbox` is a base-ui primitive; `CheckboxGroup`/`CheckboxItemGroup` are labeled composites (isX/onChange(value) face); `CheckboxItem` is a labeled composite over `SelectionItem.Shell`.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/checkbox.tsx`

## 2 Anatomy

| Part                                                            | Base                                                                                                        | Notes                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `Checkbox`                                                      | `@base-ui/react/checkbox` `Checkbox.Root` + `.Indicator`                                                    | 16px square, Check/Minus indicator                     |
| `CheckboxGroup`                                                 | `Field` + `FieldSet`/`FieldLegend`/`FieldDescription`/`FieldError` wrapping `@base-ui/react/checkbox-group` | labeled composite                                      |
| `CheckboxItemGroup`                                             | `CheckboxGroup` + private SelectionItem list (`role="list"`)                                                | stacked-card variant; `orientation` lays out that list |
| `CheckboxItem`                                                  | `SelectionItem.Shell` with a `Checkbox` control                                                             | single component; carries namespace aliases (§8.1)     |
| `CheckboxItem.Title/.Description/.Content/.Actions/.SubSection` | aliases of `SelectionItem.*`                                                                                | **the same objects** as the SelectionItem parts        |
| `CheckboxDescription`                                           | `div` + `small`                                                                                             | inline "checkbox + trailing note" row                  |

```tsx
<CheckboxGroup label="Toppings" allValues={["a", "b"]} onChange={setValues}>
  <CheckboxItem parent>…all…</CheckboxItem>
  <CheckboxItem value="a">…</CheckboxItem>
</CheckboxGroup>
```

## 3 Props

**Checkbox** — `ComponentProps<CheckboxPrimitive.Root>` pass-through plus `className` (merged via `cn`). Primitive naming (`disabled`, `readOnly`, `value`, `checked`, `indeterminate`, `parent`, `required`, `name`). No extra props; the indicator is internal (Minus when `state.indeterminate`, Check otherwise, via the Indicator `render` callback).

**CheckboxGroup** (`CheckboxGroupProps`)

| Prop                            | Type                         | Default      | Notes                                                                                                                                                        |
| ------------------------------- | ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`                         | `string`                     | —            | `FieldLegend variant="label"`; row omitted when absent                                                                                                       |
| `description`                   | `string`                     | —            | `FieldDescription`                                                                                                                                           |
| `errorMessage`                  | `ReactNode`                  | —            | `FieldError` (rendered only when truthy); widened per the labeled-composite convention (§8)                                                                  |
| `orientation`                   | `"vertical" \| "horizontal"` | `"vertical"` | vertical: primitive `flex-col gap-2`; horizontal: primitive `flex-wrap gap-4`. On `CheckboxItemGroup` the same axis also lays out the stacked-card list (§2) |
| `value` / `defaultValue`        | `string[]`                   | —            | controlled/uncontrolled                                                                                                                                      |
| `onChange`                      | `(value: string[]) => void`  | —            | mapped to base-ui `onValueChange`                                                                                                                            |
| `allValues`                     | `string[]`                   | —            | enables the tri-state `parent` checkbox (base-ui derives checked/indeterminate from members)                                                                 |
| `isDisabled` / `isInvalid`      | `boolean`                    | —            | forwarded to `Field` (and `disabled` to the group primitive)                                                                                                 |
| `name`                          | `string`                     | —            | set on **`Field`**, not the group primitive — base-ui CheckboxGroup has no `name`; Field context threads it to member hidden inputs (§8.6)                   |
| `id` / `className` / `children` | —                            | —            | `id` and `className` go on the group primitive                                                                                                               |

**CheckboxItemGroup** — same `CheckboxGroupProps`; wraps `children` in the private SelectionItem list (`role="list"`). `orientation` is forwarded to the labeled outer group **and** to that list: vertical remains connected `flex-col gap-0`; horizontal is the actual item list `flex-row flex-wrap gap-4` with individually rounded full-border cards. The private list is not a public export.

**CheckboxItem** (`CheckboxItemProps`) — discriminated union:

| Prop                        | Type               | Default   | Notes                                                                                                                         |
| --------------------------- | ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `value`                     | `string`           | —         | required unless `parent`                                                                                                      |
| `parent`                    | `boolean`          | —         | `{ value: string; parent?: false } \| { parent: true; value?: never }`; parent derives tri-state from the group's `allValues` |
| `isDisabled` / `isReadOnly` | `boolean`          | —         | forwarded to the inner `Checkbox`; `isDisabled` also styles the shell                                                         |
| `controlPosition`           | `"start" \| "end"` | `"start"` | forwarded to `SelectionItem.Shell` (new axis, see selection-item.md §8.2)                                                     |
| `className` / `children`    | —                  | —         | children partitioned by the shell                                                                                             |

**CheckboxDescription** — `{ children?: ReactNode; describedBy?: ReactNode }`. A string `describedBy` renders as `<small class="text-sm text-muted-foreground">`; any other node renders as-is.

## 4 Variants

No tv recipes in this file; all styling is inline class strings. `CheckboxGroup`'s `orientation` is a plain conditional, not a recipe axis. `CheckboxItemGroup` applies that same axis to the stacked-card list (not merely the outer primitive around one child). `CheckboxItem` inherits `itemVariants` (outline) through the shell.

**Radius** _(amended 2026-09-02)_: the 16px box uses `rounded-[min(var(--radius-md),4px)]` — `--radius-md` with a 4px optical cap so a large-radius theme cannot over-round a 16px control (same clamp pattern as Button `xs`). The painted box is not a density rung; `size-4` stays.

## 5 Consumed tokens

- `card` — checkbox resting surface (`bg-card`; §8.3).
- `input` — resting border (`border-input`).
- `primary` / `primary-foreground` — checked and indeterminate surface/border/glyph.
- `ring` — shared `focusRing({ target: "self" })`.
- `error` — invalid border/ring (`aria-invalid:border-error aria-invalid:ring-error/20`; §8.4).
- `muted-foreground` — `CheckboxDescription` note text.
- Group label/description/error tokens come from the Field parts (see field.md §5).

## 6 Data attributes

**Emitted**: `data-slot="checkbox"` (root), `data-slot="checkbox-indicator"`, `data-slot="checkbox-group"` (group primitive), `data-slot="checkbox-item"` (shell root via `dataSlot`). Base-ui emits state attrs on the root: `data-checked` / `data-unchecked`, `data-indeterminate`, `data-disabled`, `data-readonly`, `data-required`, `data-valid`/`data-invalid` (inside Field).

**Consumed**: own base-ui attrs for styling (`data-checked:`, `data-indeterminate:`, `disabled:`, `aria-invalid:`); the shell consumes the checkbox's `data-checked` via the control-slot-scoped `has-[[data-slot=selection-item-control]_[data-checked]]:` selectors (selection-item.md §6). `data-slot="checkbox-group"` is consumed by Field.Set gap tightening (field.md §6).

## 7 Accessibility

- Base-ui renders a `role="checkbox"` button plus a hidden `<input>`; Space toggles, label click toggles (the whole `CheckboxItem` row is a `Field.Label`).
- Tri-state: a `parent` checkbox reports `aria-checked="mixed"` when the group's `value` is a proper non-empty subset of `allValues`; toggling it checks/unchecks all members.
- Hit target: `after:absolute after:-inset-x-3 after:-inset-y-2` expands the 16px box's clickable area beyond its painted bounds — **kept**; document that adjacent interactive elements need clearance.
- Invalid + checked override: `aria-invalid:aria-checked:border-primary` deliberately lets the checked border win over the error border so a checked box in an invalid group still reads as selected — **kept**.
- `CheckboxGroup` provides fieldset/legend semantics via `FieldSet`/`FieldLegend`; `errorMessage` announces via `FieldError` (`role="alert"`).
- `CheckboxItemGroup` renders the private SelectionItem list (`role="list"`). Vertical (default) is connected `flex-col gap-0`; horizontal is `flex-row flex-wrap gap-4`. `CheckboxItem` shells adopt `role="listitem"` only inside that group; they stay direct DOM siblings of the list. Vertical/default shells keep connected first/last rounding, `not-first:border-t-0`, and checked `-mt-px`; horizontal item groups render individually rounded full-border cards with neither vertical border collapse nor checked negative margin.
- `CheckboxDescription`'s note is visual-only (not wired to `aria-describedby`); use Field description wiring when programmatic association is required.

## 8 Divergence from reference

1. **Renames (flat → namespace aliases)**: `CheckboxItemActions`→`CheckboxItem.Actions`, `CheckboxItemContent`→`CheckboxItem.Content`, `CheckboxItemDescription`→`CheckboxItem.Description`, `CheckboxItemSubSection`→`CheckboxItem.SubSection`, `CheckboxItemTitle`→`CheckboxItem.Title`. These are namespace **aliases of `SelectionItem.*`** — identical object references, so `child.type` partitioning (selection-item.md §8.5) works across both spellings. `Checkbox`, `CheckboxGroup`, `CheckboxItemGroup`, `CheckboxDescription`, and `CheckboxItem` itself stay single components (labeled-composite face is convention, not divergence).
2. **Icons → Phosphor**: `CheckIcon` (lucide) → `Check`, `MinusIcon` → `Minus`, from `@elmeragroup/ui/icons`, regular weight.
3. **`bg-white` → `bg-card`** on the checkbox resting surface — input-like surfaces use `bg-card` per conventions (bugfix; ref hardcodes white).
4. **`destructive` → `error`** token renames (`aria-invalid:border-destructive` → `border-error`, `ring-destructive/20` → `ring-error/20`).
5. **All `dark:` and `inverted:` classes dropped** (`dark:bg-input/30`, `dark:aria-invalid:border-destructive/50`, `dark:aria-invalid:ring-destructive/40`, `dark:data-indeterminate:bg-primary`, `dark:data-checked:bg-primary`, `inverted:bg-input/30`) — the dark axis lives in tokens.
6. **`name` threading asymmetry KEPT and documented**: base-ui's CheckboxGroup primitive has no `name` prop, so `CheckboxGroup` sets `name` on the wrapping `Field` and Field context threads it to member hidden inputs. `RadioGroup` puts `name` directly on its primitive (radio-group.md §8). The asymmetry is upstream-driven; both faces expose the same `name?: string`.
7. **Tri-state parent via `allValues` KEPT** — the `parent` union on `CheckboxItem`/`Checkbox` and the group's `allValues` are documented base-ui behavior, not library logic.
8. **`CheckboxItem` gains `controlPosition` pass-through** — consequence of the new shell axis (selection-item.md §8.2).
9. **`errorMessage` widened `string` → `ReactNode`** — the group follows the library-wide labeled-composite contract; `FieldError` already accepts node children.
10. **Item-group `orientation` is effective on the stacked list** — the inherited axis is forwarded to the private SelectionItem list so vertical stays a connected `flex-col gap-0` stack and horizontal is the actual item list `flex-row flex-wrap gap-4` with individually rounded cards, not merely the outer primitive around one child.

11. **Group skeleton and orientation map are shared, not copied** (2026-09-03): `CheckboxGroup` renders the package-private `SelectionGroupFrame` (selection-item.md §8.8) for its `Field.Root` → `Field.Set` → legend → description → error shape, and both its group layout and `CheckboxItemGroup`'s card-list layout come from the one `selectionGroupOrientationClass` map that `RadioGroup` also reads — the two families had three copies of the same two class strings between them (spec 08 finding S18). `CheckboxItemGroup` inlines the two-line stacked-card wrap (`CheckboxGroup` around `SelectionItemGroup`); its public signature and `orientation` default (read from its own destructuring) are unchanged. The redundant `errorMessage ? … : null` guard is gone: `Field.Error` already returns null for falsy children. Rendered class sets are unchanged part for part, at both orientations and in the plain, card, disabled and invalid states; the parity is pinned by the selection-item browser suite comparing the two families' computed layout rather than by a class-string assertion. _(Amended 2026-09-04: the shared card-group render helper is gone.)_ _(Amended 2026-09-04: `SelectionGroupFrame` is gone; `CheckboxGroup` renders `FieldFrame heading="legend"` from field.md §8.9.)_
12. **`describedBy` is `ReactNode`, not `string | ReactNode`** (2026-09-03): the union was an identity — `string` is already a `ReactNode` — so it described a distinction the type never made. The runtime behaviour it was meant to signal is unchanged and is stated in §3 and in the JSDoc instead: only a string becomes the muted `<small>`.
13. **The string-only `describedBy` guard is the shared helper** (2026-09-03): the local `stringDescribedBy` is gone and `CheckboxDescription` asks `isTextNode(describedBy)` from `internal/is-text-node` (conventions.md "One `isTextNode`"). The §3 behaviour is unchanged, empty string included — a string still becomes the muted `<small>`, every other node still renders intact — and the component now carries no `anti-slop/no-runtime-typeof` disable of its own (spec 08 finding S21).

## 9 Test requirements

Role/label-based queries only.

- `Checkbox`: `getByRole("checkbox")`; Space toggles; `disabled` blocks toggling; `readOnly` renders but doesn't change on click.
- `CheckboxGroup` labeled: group content queryable via the legend text; `onChange` receives `string[]` (value, not event); controlled `value` wins over clicks without `onChange` feedback.
- Tri-state: group with `allValues` + parent `CheckboxItem` — checking two of three members gives parent `aria-checked="mixed"`; clicking parent checks all; clicking again unchecks all.
- A non-string `errorMessage` renders intact with `role="alert"`; `isInvalid` sets `aria-invalid`/`data-invalid` on members; checked+invalid member keeps the primary border (pinned override).
- `name`: hidden inputs carry the group `name` (threaded via Field).
- `CheckboxItem`: row click toggles; SubSection click does not (shared shell behavior, one smoke test here).
- Hit-target: click 8px outside the painted box still toggles (browser test on the `after:` inset).
- `orientation` switches layout via computed direction, not class names, in browser tests: `CheckboxGroup` primitive `flex-col` vs `flex-row` wrap, and `CheckboxItemGroup`'s actual item list (`flex-col gap-0` connected stack vs `flex-row flex-wrap gap-4`). Horizontal item-group shells are individually rounded with full borders and no checked negative margin; vertical item groups keep direct-sibling `list`/`listitem` semantics.

## 10 Demo requirements

Plain runnable `.tsx` demos: `checkbox-basic.tsx` (bare checkbox + label via Field), `checkbox-group.tsx` (labeled group, both orientations, error message toggle), `checkbox-tristate.tsx` (parent + `allValues` select-all), `checkbox-item-group.tsx` (`CheckboxItemGroup` stacked cards with Title/Description/Actions and a SubSection named as a region (`Fixed price details`); subsections hidden via `mode="hidden"` are also `inert`), `checkbox-description.tsx` (`CheckboxDescription` with string and ReactNode `describedBy`).
