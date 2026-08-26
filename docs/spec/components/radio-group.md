# RadioGroup

## 1 Header

- **Canonical name**: `RadioGroup` (labeled composite), `RadioGroupItem` (primitive), `Radio` (labeled inline row), `RadioItem` (labeled selection row, also a namespace), `RadioItemGroup`, `RadioIconButton`
- **Export path**: `@elmeragroup/ui/radio-group` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: `RadioGroupItem` and `RadioIconButton` are base-ui primitives; `RadioGroup`/`RadioItemGroup` are labeled composites (isX/onChange(value) face); `Radio` and `RadioItem` are labeled composites over `Field.Item` / `SelectionItem.Shell`.
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/radio-group.tsx`

## 2 Anatomy

| Part                                                         | Base                                                                                                     | Notes                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `RadioGroup`                                                 | `Field` + `FieldSet`/`FieldLegend`/`FieldDescription`/`FieldError` wrapping `@base-ui/react/radio-group` | header row hosts legend + pending spinner       |
| `RadioGroupItem`                                             | `@base-ui/react/radio` `Radio.Root` + `.Indicator`                                                       | 16px circle, 8px dot indicator                  |
| `Radio`                                                      | `Field.Item` + base-ui `Field.Label` + `RadioGroupItem`                                                  | compact inline label row                        |
| `RadioItem`                                                  | `SelectionItem.Shell` with a `RadioGroupItem` control                                                    | card row; carries namespace aliases (§8.1)      |
| `RadioItem.Title/.Description/.Content/.Actions/.SubSection` | aliases of `SelectionItem.*`                                                                             | **the same objects** as the SelectionItem parts |
| `RadioItemGroup`                                             | `RadioGroup` + `ItemGroup` (`role="list"`, `gap-0 select-none`)                                          | stacked-card variant                            |
| `RadioIconButton`                                            | base-ui `Radio.Root` styled as an icon button                                                            | segmented icon picker                           |

```tsx
<RadioGroup label="Contract" value={value} onChange={setValue} isPending={isLoading}>
  <RadioItem value="fixed">
    <RadioItem.Content>
      <RadioItem.Title>Fixed</RadioItem.Title>
    </RadioItem.Content>
  </RadioItem>
</RadioGroup>
```

## 3 Props

**RadioGroup** (`RadioGroupProps`)

| Prop                            | Type                         | Default      | Notes                                                                                                                                                                             |
| ------------------------------- | ---------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                         | `string`                     | —            | `FieldLegend variant="label"` in the header row                                                                                                                                   |
| `description`                   | `string`                     | —            | `FieldDescription`                                                                                                                                                                |
| `errorMessage`                  | `ReactNode`                  | —            | `FieldError` (rendered only when truthy); widened per the labeled-composite convention (§8)                                                                                       |
| `isPending`                     | `boolean`                    | —            | spinner (`SpinnerGap`, `size-3 animate-spin`) at the header row's end; sets `aria-busy` on the radiogroup while true; header renders when `label` or `isPending` is truthy (§8.2) |
| `orientation`                   | `"vertical" \| "horizontal"` | `"vertical"` | vertical: `flex-col gap-2`; horizontal: `flex-wrap gap-4`                                                                                                                         |
| `value`                         | `string \| null`             | —            | `null` is passed through to keep the primitive controlled with no selection                                                                                                       |
| `defaultValue`                  | `string`                     | —            | uncontrolled initial value                                                                                                                                                        |
| `onChange`                      | `(value: string) => void`    | —            | wraps `onValueChange`; coerces with `String(next)`                                                                                                                                |
| `isDisabled` / `isInvalid`      | `boolean`                    | —            | on `Field` (and `disabled` on the primitive)                                                                                                                                      |
| `isReadOnly` / `isRequired`     | `boolean`                    | —            | `readOnly` / `required` on the primitive                                                                                                                                          |
| `name`                          | `string`                     | —            | set **directly on the radio-group primitive** (unlike CheckboxGroup — §8.7)                                                                                                       |
| `id` / `className` / `children` | —                            | —            | on the primitive                                                                                                                                                                  |

**RadioItemGroup** — same `RadioGroupProps`; wraps `children` in `ItemGroup`.

**RadioGroupItem** — `ComponentProps<RadioPrimitive.Root>` pass-through, including Base UI's stateful `className` callback; primitive naming (`value`, `disabled`, `required`, …). Library classes compose with a string `className` or the callback result for each state.

**Radio** (`RadioProps`) — `value: string` (required), `isDisabled?`, `className?`, `children?` (label content).

**RadioItem** (`RadioItemProps`)

| Prop                     | Type               | Default      | Notes                                                                 |
| ------------------------ | ------------------ | ------------ | --------------------------------------------------------------------- |
| `value`                  | `string`           | — (required) | forwarded to the inner `RadioGroupItem`                               |
| `isDisabled`             | `boolean`          | —            | control + shell disabled styling                                      |
| `controlPosition`        | `"start" \| "end"` | `"start"`    | forwarded to `SelectionItem.Shell` (new axis, selection-item.md §8.2) |
| `className` / `children` | —                  | —            | children partitioned by the shell                                     |

**RadioIconButton** (`RadioIconButtonProps`) — `value: string` (required), `"aria-label": string` (required; mechanically icon-only, accessibility.md §3), `isDisabled?`, `className?`, `children?` (the icon), and:

| Prop   | Type                                                          | Default  | Notes                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size` | `"icon" \| "icon-xxs" \| "icon-xs" \| "icon-sm" \| "icon-lg"` | `"icon"` | size map: `icon-xxs` size-6/svg-3, `icon-xs` size-7/svg-3.5, `icon-sm` size-8/svg-4, `icon` size-9/svg-4, `icon-lg` size-10/svg-5 (svg sizes apply only to `svg:not([class*='size-'])`) |

## 4 Variants

- No tv recipes in this file: `orientation` is a plain conditional; `RadioIconButton` sizes live in a plain `Record` map (`iconButtonSizes`), module-private. `RadioItem` inherits `itemVariants` (outline) through the shell.

## 5 Consumed tokens

- `input` — resting borders (`border-input` on RadioGroupItem and RadioIconButton).
- `primary` / `primary-foreground` — checked border/fill and indicator dot.
- `ring` — interactive radio controls compose shared `focusRing({ target: "self" })`.
- `error` — invalid border/ring (`aria-invalid:`/`data-invalid:`; §8.4).
- `card` — RadioIconButton resting surface (§8.3).
- `muted` — RadioIconButton hover and checked surface.
- `foreground` — RadioIconButton icon color.
- Label/description/error tokens come from Field parts (field.md §5).

## 6 Data attributes

**Emitted**: `data-slot="radio-group"` (primitive), `data-slot="radio-group-item"`, `data-slot="radio-group-indicator"`, `data-slot="radio-icon-button"`, `data-slot="radio-item"` (shell root via `dataSlot`). Base-ui emits `data-checked`/`data-unchecked`, `data-disabled`, `data-readonly`, `data-required`, `data-valid`/`data-invalid` on radio roots; `RadioGroupItem` also sets the group class `group/radio-group-item`.

**Consumed**: own state attrs for styling (`data-checked:`, `data-invalid:`, `disabled:`, `aria-invalid:`); `RadioItem`'s shell consumes the radio's `data-checked` via the control-slot-scoped `has-[[data-slot=selection-item-control]_[data-checked]]:` selectors (selection-item.md §6).

## 7 Accessibility

- Base-ui renders `role="radiogroup"` with `role="radio"` items. Arrow keys move selection between enabled items (Left/Up previous, Right/Down next, wrapping); Tab enters the group on the checked (or first) item and leaves it on the next Tab; Space selects a focused unchecked item.
- `RadioGroup` provides fieldset/legend semantics (`FieldSet`/`FieldLegend`); `errorMessage` announces via `FieldError` (`role="alert"`); `isInvalid` wires `aria-invalid` through Field.
- `Radio` and `RadioItem` wrap the control in a base-ui `Field.Label` — the whole row is a click target; `RadioItem` sub-sections stay outside the label (selection-item.md §7).
- `RadioItemGroup` renders `Item.Group` (`role="list"`, `gap-0 select-none`). `RadioItem` shells adopt `role="listitem"` only inside that group; they stay direct DOM siblings of the list.
- Hit target on `RadioGroupItem`: `after:-inset-x-3 after:-inset-y-2` expands the clickable area — **kept**; adjacent controls need clearance.
- Invalid + checked override: `aria-invalid:aria-checked:border-primary` lets the checked border win over the error border — **kept**.
- Pending spinner is a decorative icon. `isPending` sets `aria-busy` on the radiogroup region (accessibility.md §2); the attribute is omitted when pending is false or absent. If pending must be announced as a live message, the consumer owns that live region.
- `RadioIconButton` is mechanically icon-only: `aria-label` is a required non-optional string (accessibility.md §3).

## 8 Divergence from reference

1. **Renames (flat → namespace aliases)**: `RadioItemActions`→`RadioItem.Actions`, `RadioItemContent`→`RadioItem.Content`, `RadioItemDescription`→`RadioItem.Description`, `RadioItemSubSection`→`RadioItem.SubSection`, `RadioItemTitle`→`RadioItem.Title` — namespace **aliases of `SelectionItem.*`**, identical object references (shell partitioning works across spellings). `RadioGroup`, `RadioGroupItem`, `Radio`, `RadioItem`, `RadioItemGroup`, `RadioIconButton` stay single components.
2. **Header-row gate BUGFIX**: ref renders the legend row when `label || isPending !== undefined` — so `isPending={false}` (any boolean wiring) renders an empty legend row with an empty `FieldLegend`. Fixed to gate on truthy `isPending`: row renders when `label || isPending`.
3. **`bg-background` → `bg-card`** on `RadioIconButton` resting surface (input-like surface; bugfix per conventions).
4. **`destructive` → `error`** token renames (`aria-invalid:border-destructive`, `ring-destructive/20` on RadioGroupItem; `data-invalid:border-destructive` on RadioIconButton).
5. **All `dark:` classes dropped** (`dark:bg-input/30`, `dark:aria-invalid:border-destructive/50`, `dark:aria-invalid:ring-destructive/40`, `dark:data-checked:bg-primary` on RadioGroupItem).
6. **Icon → Phosphor**: `LoaderCircle` (lucide) → `SpinnerGap` with `animate-spin`, from `@elmeragroup/ui/icons`.
7. **`name` placement asymmetry KEPT and documented**: `RadioGroup` sets `name` directly on the base-ui radio-group primitive (which supports it); `CheckboxGroup` must thread `name` via Field context because base-ui's checkbox-group has no `name` (checkbox.md §8.6). Same external face, different plumbing — upstream-driven.
8. **`RadioItem` gains `controlPosition` pass-through** — consequence of the new shell axis (selection-item.md §8.2).
9. **`onChange` `String(next)` coercion KEPT; null-mapping BUGFIXED** — the ref's `value ?? undefined` mapping switches Base UI from controlled to uncontrolled when a controlled string value is cleared. Pass `null` through so the `string | null` controlled face tolerates cleared form state without a warning.
10. **`errorMessage` widened `string` → `ReactNode`** — the group follows the library-wide labeled-composite contract; `FieldError` already accepts node children.

## 9 Test requirements

Role/label-based queries only.

- `getByRole("radiogroup")` named by the legend; items via `getByRole("radio", { name })`.
- Arrow-key navigation: focus checked item, ArrowDown moves selection to next item, wraps at the end, skips disabled items; Tab exits the group.
- `onChange` receives the string value (not an event); controlled `value` including `null` (nothing checked) works without React uncontrolled warnings.
- Header-row gate pinned: `isPending={false}` with no `label` renders **no** legend row (bugfix assertion); `isPending` true shows the spinner alongside the label and sets `aria-busy` on the named radiogroup; `isPending` false or absent omits `aria-busy`.
- A non-string `errorMessage` renders intact with `role="alert"`; `isInvalid` sets invalid state on items; checked+invalid item keeps primary border (pinned override).
- `isReadOnly` / `isRequired` / `name` forwarded (hidden input carries `name`).
- `Radio`: label click selects; disabled row is skipped by arrow navigation.
- `RadioItem`: row click selects; SubSection click does not change selection (isolation smoke test); `controlPosition="end"` renders trailing control.
- `RadioIconButton`: selectable via click and keyboard within a group; each `size` renders (browser layout assertion); accessible name required in test fixtures.

## 10 Demo requirements

Plain runnable `.tsx` demos: `radio-group-basic.tsx` (labeled group of `Radio` rows, both orientations), `radio-group-pending.tsx` (label + `isPending` spinner during async load, error message toggle), `radio-item-group.tsx` (`RadioItemGroup` stacked cards with Title/Description/Actions and a `mode`-animated SubSection on the selected item; subsections hidden via `mode="hidden"` are also `inert`), `radio-icon-button.tsx` (icon-button segmented picker across all five sizes), `radio-controlled-null.tsx` (controlled `value` including cleared `null` state).
