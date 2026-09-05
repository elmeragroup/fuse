# Combobox

## 1 Header

- **Canonical name**: `Combobox` (namespace compound) + `useComboboxAnchor` hook
- **Export path**: `@elmeragroup/ui/combobox` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (overlay component), tightly coupled to `InputGroup` and `Button`
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/combobox.tsx`

## 2 Anatomy

| Part                  | Base                                                                                           | Notes                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Combobox.Root`       | `ComboboxPrimitive.Root`                                                                       | bare re-export; state owner (value, inputValue, open, selection mode, filtering). **Must come from the `@base-ui/react` root import** (§8)  |
| `Combobox.Input`      | `InputGroup > ComboboxPrimitive.Input(render=InputGroup.Input) + InputGroup.Addon(inline-end)` | the whole field chrome; addon holds the trigger and/or clear buttons; `children` render inside the InputGroup (extra addons, hidden inputs) |
| `Combobox.Trigger`    | `ComboboxPrimitive.Trigger`                                                                    | appends a rotating `CaretDown` after `children`; inside `Combobox.Input` it is rendered through `InputGroup.Button` (ghost, icon-sm)        |
| `Combobox.Clear`      | `ComboboxPrimitive.Clear`                                                                      | `render={<InputGroup.Button variant="ghost" size="icon-sm" />}` with an `X` icon; **unexported in the ref**, exported here (§8)             |
| `Combobox.Content`    | `Portal > Positioner > Popup`                                                                  | popup surface; declares `group/combobox-content`; emits `data-external-anchor`                                                              |
| `Combobox.List`       | `ComboboxPrimitive.List`                                                                       | scroll container with the `--spacing()` max-height calc (§8-kept)                                                                           |
| `Combobox.Item`       | `ComboboxPrimitive.Item`                                                                       | `children` + auto `ItemIndicator` (`span` render, `Check`, absolute right-2)                                                                |
| `Combobox.Group`      | `ComboboxPrimitive.Group`                                                                      | passthrough (no default classes)                                                                                                            |
| `Combobox.Label`      | `ComboboxPrimitive.GroupLabel`                                                                 | muted `text-xs` group heading                                                                                                               |
| `Combobox.Collection` | `ComboboxPrimitive.Collection`                                                                 | render-prop iteration over (filtered) `items`                                                                                               |
| `Combobox.Empty`      | `ComboboxPrimitive.Empty`                                                                      | hidden until the popup's `data-empty` flips it to `flex`                                                                                    |
| `Combobox.Separator`  | `ComboboxPrimitive.Separator`                                                                  | `h-px bg-border`                                                                                                                            |
| `Combobox.Chips`      | `ComboboxPrimitive.Chips`                                                                      | multi-select chip container with full input-like chrome (border, focus ring, invalid ring)                                                  |
| `Combobox.Chip`       | `ComboboxPrimitive.Chip`                                                                       | one selected value; auto `ChipRemove` (`Button` ghost icon-sm, `X`) unless `showRemove={false}`                                             |
| `Combobox.ChipsInput` | `ComboboxPrimitive.Input`                                                                      | bare inline input for use inside `Combobox.Chips` (no InputGroup wrapper); marks the owned within-focus receiver                            |
| `Combobox.Value`      | `ComboboxPrimitive.Value`                                                                      | selected-value display (render-prop capable)                                                                                                |
| `useComboboxAnchor()` | `useRef<HTMLDivElement \| null>(null)`                                                         | typed ref helper to anchor `Combobox.Content` to an external element (e.g. the `Combobox.Chips` container or an `InputGroup.Root`)          |

```tsx
<Combobox.Root items={items}>
  <Combobox.Input placeholder="Search…" showClear />
  <Combobox.Content>
    <Combobox.Empty>No results.</Combobox.Empty>
    <Combobox.List>
      <Combobox.Collection>
        {(item) => (
          <Combobox.Item key={item} value={item}>
            {item}
          </Combobox.Item>
        )}
      </Combobox.Collection>
    </Combobox.List>
  </Combobox.Content>
</Combobox.Root>
```

## 3 Props

**State classes:** `Combobox.Trigger`, `Combobox.Clear`, `Combobox.Content`, `Combobox.List`, `Combobox.Item`, `Combobox.Group`, `Combobox.Label`, `Combobox.Empty`, `Combobox.Separator`, `Combobox.Chips`, `Combobox.Chip`, `Combobox.ChipsInput` accept either a string or a callback receiving the current Base UI part state. Callback results are merged after library classes with the same conflict resolution as strings. Other parts retain their declared contracts; see [conventions](conventions.md#api-conventions).

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props. Primitive-tier naming per conventions.

**Combobox.Root** — `Omit<ComponentProps<ComboboxPrimitive.Root>, "locale">` (`items`, `value`/`defaultValue`/`onValueChange`, `inputValue`/`defaultInputValue`/`onInputValueChange`, `multiple`, `filter`, `openOnInputClick`, `autoHighlight`, `disabled`, `readOnly`, `required`, `name`, …). It reads the required provider locale and forwards it to base-ui; components do not accept an independent locale.

**Combobox.Input** — `ComponentProps<ComboboxPrimitive.Input>` plus:

| Prop          | Type        | Default           | Notes                                                                                    |
| ------------- | ----------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `showTrigger` | `boolean`   | `true`            | renders the caret trigger button in the inline-end addon, named from dictionary `toggle` |
| `showClear`   | `boolean`   | `false`           | renders `Combobox.Clear` in the same addon                                               |
| `disabled`    | `boolean`   | `false`           | forwarded to the inner `InputGroup.Input` **and** to the trigger/clear buttons           |
| `className`   | `string`    | —                 | applied to the **outer InputGroup** (`w-auto`), not the input element                    |
| `children`    | `ReactNode` | —                 | rendered inside the InputGroup after the addon                                           |
| `clearLabel`  | `string`    | locale dictionary | forwarded to the auto-rendered Clear button when `showClear`                             |

Runtime note (kept, §8): `showTrigger` and `showClear` are effectively mutually exclusive — the trigger button carries `group-has-data-[slot=combobox-clear]/input-group:hidden`, so whenever a clear button exists in the group the trigger is hidden even if both flags are true.

**Combobox.Trigger** — `ComponentProps<ComboboxPrimitive.Trigger>`; `children` render before the built-in caret.

**Combobox.Clear** — `ComponentProps<ComboboxPrimitive.Clear> & { label?: string }`; fixed ghost icon-sm InputGroup.Button face with `X`; `label` defaults to dictionary `clear` and supplies the accessible name.

**Combobox.Content** — `ComponentProps<ComboboxPrimitive.Popup>` plus positioner props (forwarded to `ComboboxPrimitive.Positioner`) plus the conventions' overlay `container`:

| Prop          | Type                                            | Default                      | Notes                                                                    |
| ------------- | ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `side`        | Positioner `side`                               | `"bottom"`                   |                                                                          |
| `sideOffset`  | `number`                                        | `6`                          | (Select uses 4 — faithful to each ref)                                   |
| `align`       | Positioner `align`                              | `"start"`                    |                                                                          |
| `alignOffset` | `number`                                        | `0`                          |                                                                          |
| `anchor`      | Positioner `anchor` (element/ref/virtual)       | —                            | pass `useComboboxAnchor()`'s ref; also flips `data-external-anchor` (§6) |
| `container`   | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | portal target (§8)                                                       |

**Combobox.Chip** — `ComponentProps<ComboboxPrimitive.Chip>` plus:

| Prop          | Type      | Default                                                                                            | Notes                                                                                                                                                                                                                                                                                      |
| ------------- | --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `showRemove`  | `boolean` | `true`                                                                                             | renders the `ChipRemove` button with `X`                                                                                                                                                                                                                                                   |
| `removeLabel` | `string`  | dictionary `removeItem` formatted with the Chip's string children, then `itemToStringLabel(value)` | explicit accessible-name override (always wins); default formats `removeItem` with string/number children; when children are not a string, falls back to Root `itemToStringLabel(value)` for this chip; if neither yields text, the localized "Remove" string alone with no trailing space |

**Combobox.Empty** — its primitive props with optional `children`; absent children render dictionary `empty`. **Combobox.Value / List / Item / Group / Label / Collection / Separator / Chips / ChipsInput** — their base-ui part's props verbatim (`Combobox.Item`: `value`, `disabled`; `Combobox.ChipsInput` is `ComboboxPrimitive.Input` props without the InputGroup extras).

**useComboboxAnchor** — no arguments; returns `RefObject<HTMLDivElement | null>` to spread on the anchor element and pass as `anchor`.

## 4 Variants

No `tv` recipes and no axes — Content, Item, Label, and Separator compose the shared overlay/menu class constants plus Combobox-specific extras, and the rest is inline per part; nothing exported (no borrow pattern). _(Amended 2026-09-03; see §8.11.)_ Button faces are borrowed from `InputGroup.Button` (ghost/icon-sm) and `Button` (ghost/icon-sm for chip remove).

## 5 Consumed tokens

- `popover` / `popover-foreground` — popup surface and text.
- `ring-foreground/10` — popup hairline (`ring-1`).
- `accent` / `accent-foreground` — highlighted item (`data-highlighted:`).
- `muted` — chip fill (`bg-muted`); `muted-foreground` — trigger caret, group labels, empty text.
- `input` — Chips border (`border-input`); popup-embedded InputGroup restyle (`*:data-[slot=input-group]:border-input/30 …bg-input/30`).
- `ring` — Chips compose shared `focusRing({ target: "within" })`.
- `error` — Chips invalid chrome (`has-aria-invalid:border-error has-aria-invalid:ring-3 has-aria-invalid:ring-error/20`, §8).
- `card` — field surface via the composed `InputGroup` (per its own spec).
- `foreground` — chip text; `border` — separator fill.
- Radii: popup `rounded-md`, Chips `rounded-md`, chip `rounded-sm`, item `rounded-sm` — `--radius`-derived, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**:

- `data-slot`: `combobox-value` · `combobox-trigger` · `combobox-clear` · `combobox-content` · `combobox-list` · `combobox-item` · `combobox-group` · `combobox-label` · `combobox-collection` · `combobox-empty` · `combobox-separator` · `combobox-chips` · `combobox-chip` · `combobox-chip-remove` · `combobox-chip-input` (ChipsInput — the ref's singular spelling, kept) — plus `data-slot="input-group-button"` on the trigger's InputGroup.Button face inside `Combobox.Input`. `Combobox.ChipsInput` also emits `data-focus-ring-control` for the Chips within adapter. Root emits nothing.
- `data-external-anchor="true" | "false"` on Content — `!!anchor`; true switches popup sizing from `min-w-[calc(var(--anchor-width)+--spacing(7))]` to `min-w-(--anchor-width)` (anchored mode hugs the anchor exactly).

**Emitted (by base-ui, styled by us)**: `data-popup-open` (trigger ancestry — caret rotation via `in-data-popup-open:rotate-180`), `data-open`/`data-closed` + `data-side` (popup), `data-highlighted`/`data-disabled` (items), `data-empty` (popup + list), `data-pressed` (trigger button), `disabled` (chip children via `has-disabled:`).

**Consumed selectors**:

- `Combobox.Input`'s trigger button: `group-has-data-[slot=combobox-clear]/input-group:hidden` (trigger/clear exclusivity) and `data-pressed:bg-transparent`.
- Popup: `data-open:animate-in fade-in-0 zoom-in-95`, `data-closed:animate-out fade-out-0 zoom-out-95`, `data-[side=bottom|top|left|right|inline-start|inline-end]:slide-in-from-*`, `data-[external-anchor=true]:min-w-(--anchor-width)`; sizing vars `max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin)`; child restyle `*:data-[slot=input-group]:m-1 …mb-0 …h-(--control-h-sm) …border-input/30 …bg-input/30 …shadow-none` for a popup-embedded search InputGroup (the `sm` control rung, not a literal 32 px). Bare `data-open:`/`data-closed:` are the self-scoped custom variants from conventions and stay on the popup that emits the state. _(Amended 2026-09-04: `data-external-anchor` renamed from `data-chips`.)_
- List: `data-empty:p-0` and the kept max-height calc `max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))]` — caps the list at 72 spacing units minus a 9-unit allowance for popup-embedded chrome, never exceeding available height minus the same allowance.
- Empty: `group-data-empty/combobox-content:flex` (visible only when the popup reports no matches).
- Item: `data-highlighted:bg-accent data-highlighted:text-accent-foreground`, `data-disabled:pointer-events-none data-disabled:opacity-50`.
- Chips: `has-aria-invalid:` invalid chrome, `has-data-[slot=combobox-chip]:px-1.5` (tighter padding once chips exist), and the shared within-focus recipe.
- Chip: `has-disabled:pointer-events-none …cursor-not-allowed …opacity-50`, `has-data-[slot=combobox-chip-remove]:pr-0`.
- Cross-component: a popup-embedded `InputGroup.Root` keeps its canonical focus ring; Combobox changes its static border/fill sizing only and never suppresses keyboard focus treatment (input-group §8).

## 7 Accessibility

- Base-ui wires `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-autocomplete` on the input, `role="listbox"`/`role="option"` + `aria-selected` in the popup; label association via base-ui Field when composed.
- Keyboard: typing filters the list (Root `filter`); ArrowDown/ArrowUp open the popup and move highlight; Enter selects the highlighted item (in single mode closes and fills the input; in multiple mode keeps the popup open and appends a chip); Escape closes; Backspace in an empty `ChipsInput` removes the last chip; Arrow keys navigate between chips, Delete/Backspace removes the focused chip.
- Trigger and Clear are real buttons in the inline-end addon, focusable in DOM order after the input; Clear only renders while there is something to clear (base-ui behavior) and returns focus to the input. The caret Trigger's accessible name is dictionary `combobox.toggle` ("Toggle options" in en-US) so it is not named only after the field. _(Amended 2026-09-02.)_
- Clear and chip-remove buttons receive localized accessible names by default; explicit props override them. `Combobox.Empty` supplies localized no-results text when children are absent and announces it when no options match.
- Invalid state: `aria-invalid` on the input surfaces on the InputGroup chrome; in chips mode the `has-aria-invalid:` ring surfaces on the Chips container.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Combobox`→`Combobox.Root`, `ComboboxInput`→`Combobox.Input`, `ComboboxTrigger`→`Combobox.Trigger`, `ComboboxContent`→`Combobox.Content`, `ComboboxList`→`Combobox.List`, `ComboboxItem`→`Combobox.Item`, `ComboboxGroup`→`Combobox.Group`, `ComboboxLabel`→`Combobox.Label`, `ComboboxCollection`→`Combobox.Collection`, `ComboboxEmpty`→`Combobox.Empty`, `ComboboxSeparator`→`Combobox.Separator`, `ComboboxChips`→`Combobox.Chips`, `ComboboxChip`→`Combobox.Chip`, `ComboboxChipsInput`→`Combobox.ChipsInput`, `ComboboxValue`→`Combobox.Value`. `useComboboxAnchor` keeps its name.
2. **`Combobox.Clear` exported**: the ref defines `ComboboxClear` but leaves it out of the export list (only reachable via `showClear`). Decide-as-spec: exported as a namespace part — the namespace makes it a natural public part and enables custom compositions.
3. **Overlay `container` prop added** to `Combobox.Content` — forwarded to `ComboboxPrimitive.Portal`, defaulting to the nearest `ThemeScope` element (portal-inside-ThemeScope discipline). Ref portals to `document.body`.
4. **Dead `data-variant=destructive` selector removed** from `Combobox.Item` (`not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground` → unconditional): copied from dropdown-menu; nothing here sets `data-variant`.
5. **`destructive` → `error`** token renames (Chips `has-aria-invalid:` chrome).
6. **All `dark:` classes dropped** (`dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40` on Chips) — dark axis lives in tokens.
7. **Duplicated stacking classes deduped**: the Positioner keeps `isolate z-50`; the Popup drops its duplicate (ref repeats them on Select's popup; combobox's popup has no `z-50` but the ruling is applied family-wide — Positioner owns stacking).
8. **Icons → Phosphor**: `CheckIcon`→`Check` (item indicator), `ChevronDownIcon`→`CaretDown` (trigger caret), `XIcon`→`X` (clear + chip remove).
9. **Provider-owned locale and strings:** removes Root's public `locale`; Clear, Chip remove, Empty, and the Input caret Trigger use the co-located four-locale dictionary with optional copy overrides (`clearLabel` / `removeLabel` / Empty `children`). The caret name is dictionary `toggle` in all four locales. _(Amended 2026-09-02.)_
10. **Chip `removeLabel` default uses children, then `itemToStringLabel(value)`** (amended 2026-09-05, review ticket 05): Chip still exposes no `value` prop. Its native element registers through a ref with the enclosing Chips. After commit, registered elements are ordered by document position and each chip receives its own stable index into `Combobox.Value`. This matches Base UI's removal order without a mutable render counter, including StrictMode, isolated child rerenders and keyed selection reordering. Ref cleanup removes departed chips from registration; caller refs and custom render composition remain supported. Before DOM registration, non-text children with no explicit label use the localized generic removal name; layout reconciliation resolves the item-specific fallback before paint.

    String/number children remain the first default label source. Non-text children fall back to Root `itemToStringLabel` for the selected item at the chip's committed position. If neither yields text, the localized "Remove" string has no trailing space. Explicit `removeLabel` always wins. The implementation uses the package-root Base UI import and does not reach into private Base UI contexts.

11. **Shared overlay spine adopted:** `Combobox.Content` composes `OverlayPortal`, `OverlayContainerProps`, `OverlayPositionerProps`, and `overlayPositionerClass` / `overlayTimedPopupClass`; `Combobox.Item`, `Combobox.Label`, and `Combobox.Separator` compose `menuItemClass` / `menuItemIndicatorClass` / `menuGroupLabelClass` / `menuSeparatorClass`; Chips and ChipsInput compose `withinFocusRingClass` / `withinFocusRingControlClass`, and `isChipText` becomes the shared `isTextValueNode`. Content takes the shared positioner block whole and keeps `anchor` as its extra; published defaults come from destructuring (popover.md §8.7). The extras that stay Combobox's are the popup geometry and embedded-InputGroup selectors, the option's `w-full pr-8 pl-2` and its `data-highlighted:` highlight face (base-ui spells the listbox highlight `data-highlighted:`, so `menuItemClass` deliberately excludes it), and the indicator's `size-4`. Emitted class set, prop names, documented defaults, and DOM are unchanged. _(Amended 2026-09-04: tickets 02, 05, 08.)_
12. **`data-external-anchor` not `data-chips`** (ticket 09, 2026-09-04): Content emits `data-external-anchor` because any `anchor` caller (Chips and PhoneNumberField) reuses the width switch; `data-chips` named the chips family and no longer described the rule.

Kept faithfully:

- **Root import requirement**: `import { Combobox } from "@base-ui/react"` — the `@base-ui/react/combobox` subpath type-checks but crashes at runtime with a null React context (same issue as phone-number-field). Keep the root import until upstream fixes it; guard with a comment in source.
- `showTrigger`/`showClear` runtime mutual exclusivity via `group-has-data-[slot=combobox-clear]/input-group:hidden` (§3).
- `Combobox.Input` wrapping itself in an `InputGroup` (className goes to the group; `w-auto`).
- The `--spacing()` max-height calc on `Combobox.List` (§6).
- `data-external-anchor={!!anchor}` on Content and its `min-w` switch.
- The chips family (multi-select) incl. `has-aria-invalid:` chrome, `has-data-[slot=combobox-chip]:px-1.5`, chip `showRemove`, `ChipsInput` as a bare input.
- `data-slot="combobox-chip-input"` singular spelling on ChipsInput.
- Popup-embedded InputGroup spacing, height (`h-(--control-h-sm)`), border tint, fill, and shadow restyle selectors; focus-ring suppression is explicitly not carried forward.
- `useComboboxAnchor` as a plain typed `useRef` helper.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Filtering: type into `getByRole("combobox")`; assert the listbox narrows to matching options and `Combobox.Empty` text appears for a no-match query (and disappears again).
- Selection: ArrowDown + Enter selects the highlighted option, closes the popup, fills the input; `onValueChange` receives the value.
- Trigger button: `getByRole("button", { name })` using dictionary `toggle` in each locale; click opens/closes; caret rotation state via `data-popup-open` (attribute assertion).
- Clear button: with `showClear`, after a selection `getByRole("button", { name: /clear/i })` empties the value and the trigger button stays hidden while Clear is present (assert exclusivity); focus returns to the input.
- Chips multi-select: with `multiple` + Chips/Chip/ChipsInput, selecting options appends chips (popup stays open); chip remove button deletes its chip; Backspace in the empty ChipsInput removes the last chip; `aria-invalid` surfaces the Chips error ring.
- Anchored mode: passing `anchor` from `useComboboxAnchor` sets `data-external-anchor="true"` on the popup and positions against the anchor element.
- `container`: popup renders inside the provided element / nearest ThemeScope, not `document.body`.
- Disabled: `Combobox.Input disabled` disables input, trigger, and clear.
- Empty/Clear/Remove defaults render in all four locales; `children`, `clearLabel`, `label`, and `removeLabel` override their respective copy. Chip-remove for object items without string children is named from `itemToStringLabel(value)`; if that yields no text, the name is the localized "Remove" string with no trailing space.
- Chip identity: Alpha/Beta retain correct names and remove the matching object after StrictMode mounting, isolated child rerender, selected-item reordering and removal. Explicit removal labels remain intact in uncontrolled object selections. Assert actual selected values and accessible names, not registration details.
- Import-shape guard: source-level test/lint asserting the base-ui root import (no `@base-ui/react/combobox` subpath).

## 10 Demo requirements

Plain runnable `.tsx` demos: `combobox-basic.tsx` (Input with trigger, filtered list, Empty state), `combobox-groups.tsx` (Groups + Labels + Separator, Collection over grouped items), `combobox-multi-chips.tsx` (`multiple` with Chips/Chip/ChipsInput anchored via `useComboboxAnchor`, showClear, invalid state), `combobox-input-group-anchor.tsx` (popup anchored to an outer `InputGroup.Root` — phone-number-field pattern — with a popup-embedded search InputGroup exercising the `*:data-[slot=input-group]` restyle).
