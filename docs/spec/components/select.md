# Select

## 1 Header

- **Canonical name**: `Select` (namespace compound)
- **Export path**: `@elmeragroup/ui/select` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/select.tsx`

## 2 Anatomy

| Part                      | Base                              | Notes                                                                                                                                        |
| ------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Select.Root`             | `SelectPrimitive.Root`            | bare re-export; state owner (value, open), no DOM of its own                                                                                 |
| `Select.Trigger`          | `SelectPrimitive.Trigger`         | input-like button chrome; `size` axis; auto-renders `SelectPrimitive.Icon` with a rotating `CaretDown`                                       |
| `Select.Value`            | `SelectPrimitive.Value`           | selected-value display inside the trigger (`flex flex-1 text-left`)                                                                          |
| `Select.Content`          | `Portal > Positioner > Popup`     | popup surface; auto-renders `Select.ScrollUpButton`, `SelectPrimitive.List` (wraps `children`), `Select.ScrollDownButton`                    |
| `Select.Item`             | `SelectPrimitive.Item`            | wraps `children` in `SelectPrimitive.ItemText`; auto-renders `SelectPrimitive.ItemIndicator` (`span` render, `Check` icon, absolute right-2) |
| `Select.Group`            | `SelectPrimitive.Group`           | `scroll-my-1 p-1`                                                                                                                            |
| `Select.Label`            | `SelectPrimitive.GroupLabel`      | group heading, muted `text-xs`                                                                                                               |
| `Select.Separator`        | `SelectPrimitive.Separator`       | `h-px bg-border`, pointer-events-none                                                                                                        |
| `Select.ScrollUpButton`   | `SelectPrimitive.ScrollUpArrow`   | `CaretUp`; sticky top scroll affordance                                                                                                      |
| `Select.ScrollDownButton` | `SelectPrimitive.ScrollDownArrow` | `CaretDown`; sticky bottom scroll affordance                                                                                                 |

```tsx
<Select.Root items={items}>
  <Select.Trigger>
    <Select.Value placeholder="Pick one" />
  </Select.Trigger>
  <Select.Content>
    <Select.Group>
      <Select.Label>Fruits</Select.Label>
      <Select.Item value="apple">Apple</Select.Item>
    </Select.Group>
  </Select.Content>
</Select.Root>
```

## 3 Props

**State classes:** `Select.Trigger`, `Select.Value`, `Select.Content`, `Select.Item`, `Select.Group`, `Select.Label`, `Select.Separator`, `Select.ScrollUpButton`, `Select.ScrollDownButton` accept either a string or a callback receiving the current Base UI part state. Callback results are merged after library classes with the same conflict resolution as strings. Other parts retain their declared contracts; see [conventions](conventions.md#api-conventions).

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props.

**Select.Root** — primitive `SelectRoot.Props<Value, Multiple>` forwarded (`value`/`defaultValue`/`onValueChange` infer `Value`; `multiple` switches those to arrays; plus `open`/`defaultOpen`/`onOpenChange`, `items`, `disabled`, `readOnly`, `required`, `name`, `id`, `modal`, …). Primitive-tier naming per conventions (no `isDisabled` face).

**Select.Trigger** — `ComponentProps<SelectPrimitive.Trigger>` plus:

| Prop   | Type                | Default     | Notes                                                           |
| ------ | ------------------- | ----------- | --------------------------------------------------------------- |
| `size` | `"sm" \| "default"` | `"default"` | emitted as `data-size`; `default` → `md` rung, `sm` → `sm` rung |

`children` render before the built-in caret icon; the icon is not replaceable via props (override with `render` on `SelectPrimitive.Icon` is not exposed).

**Select.Content** — `ComponentProps<SelectPrimitive.Popup>` plus positioner props (destructured and forwarded to `SelectPrimitive.Positioner`) plus the conventions' overlay `container`:

| Prop                   | Type                                            | Default                      | Notes                                                                            |
| ---------------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `side`                 | Positioner `side`                               | `"bottom"`                   |                                                                                  |
| `sideOffset`           | `number`                                        | `4`                          |                                                                                  |
| `align`                | Positioner `align`                              | `"center"`                   |                                                                                  |
| `alignOffset`          | `number`                                        | `0`                          |                                                                                  |
| `alignItemWithTrigger` | `boolean`                                       | `true`                       | macOS-style: selected item overlays the trigger; emitted as `data-align-trigger` |
| `container`            | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | portal target (§8)                                                               |

`children` are wrapped in `SelectPrimitive.List` between the two scroll buttons.

**Select.Value** — `ComponentProps<SelectPrimitive.Value>` (incl. `placeholder`, `children` render-fn).
**Select.Item** — `ComponentProps<SelectPrimitive.Item>` (`value`, `disabled`, `label`, …).
**Select.Group / Label / Separator / ScrollUpButton / ScrollDownButton** — their base-ui part's props verbatim.

## 4 Variants

No `tv` recipe — the trigger's `size` axis is a hand-rolled `data-size` attribute styled via `data-[size=…]` height/padding/gap/type tokens; kept without a recipe export (no borrow pattern). `elmera/no-hardcoded-density-metrics` covers these `data-[size=…]` class strings. Content, Item, Label, and Separator compose the shared overlay/menu class constants plus Select-specific extras; the trigger and the remaining parts stay inline. _(Amended 2026-09-03; see §8.10.)_

**Density mapping.** Select Trigger `size` selects a shared density rung per [conventions](conventions.md). No `dense:` / `comfortable:` variants. Height is pinned, so there is no `py-*`. _(Amended 2026-09-02.)_

| Trigger `size` | Density rung | Notes                                                                                                                    |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `sm`           | `sm`         | `data-[size=sm]:h-(--control-h-sm) px-(--control-px-sm) gap-(--control-gap-sm) text-sm`. Type is size-owned (`text-sm`). |
| `default`      | `md`         | `data-[size=default]:h-(--control-h-md) px-(--control-px-md) gap-(--control-gap-md)` plus the control-type pair.         |

## 5 Consumed tokens

- `card` — trigger surface (`bg-card`, replaces ref `bg-white`, §8).
- `input` — trigger border.
- `ring` — trigger composes shared `focusRing({ target: "self" })`.
- `error` — trigger invalid chrome (`aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20`, §8).
- `popover` / `popover-foreground` — popup surface and text; scroll buttons repeat `bg-popover` to mask scrolled items.
- `ring-foreground/10` — popup hairline (`ring-1`).
- `accent` / `accent-foreground` — focused item highlight (`focus:bg-accent focus:text-accent-foreground`).
- `muted-foreground` — placeholder text (`data-placeholder:`), caret icon, group labels.
- `border` — separator fill.
- Radii: trigger `rounded-md`, popup `rounded-lg`, item `rounded-sm` — all `--radius`-derived scale steps, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**:

- `data-slot`: `select-trigger` · `select-value` · `select-content` · `select-item` · `select-group` · `select-label` · `select-separator` · `select-scroll-up-button` · `select-scroll-down-button` (Root emits nothing — it renders no DOM).
- `data-size="sm" | "default"` on Trigger.
- `data-align-trigger="true" | "false"` on Content (mirrors `alignItemWithTrigger`).

**Emitted (by base-ui, styled by us)**: `data-placeholder`, `data-popup-open` (trigger); `data-open` / `data-closed`, `data-side` (popup); `data-disabled` (items).

**Consumed selectors**:

- Trigger: `data-placeholder:text-muted-foreground`, `data-[size=…]` heights, `group-data-[popup-open]/select-trigger:rotate-180` on the caret (trigger declares `group/select-trigger`), `*:data-[slot=select-value]:line-clamp-1 …flex …items-center …gap-1.5` child styling for the Value part.
- Popup: `data-open:animate-in fade-in-0 zoom-in-95`, `data-closed:animate-out fade-out-0 zoom-out-95`, `data-[side=bottom|top|left|right|inline-start|inline-end]:slide-in-from-*`, and `data-[align-trigger=true]:animate-none` — when item-with-trigger alignment is active (the default) the entrance animation is suppressed, since the popup must appear exactly over the trigger without motion. Bare `data-open:`/`data-closed:` are self-scoped custom variants and stay on the popup that emits the state.
- Popup sizing vars: `max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin)` from the Positioner.
- Item: `focus:bg-accent focus:text-accent-foreground`, `data-disabled:pointer-events-none data-disabled:opacity-50`, `*:[span]:last:…` legacy shadcn child layout (kept).

## 7 Accessibility

- Base-ui wires `role="combobox"` + `aria-expanded`/`aria-controls` on the trigger, `role="listbox"`/`role="option"` + `aria-selected` in the popup, and label association via base-ui Field when composed.
- Keyboard: ArrowDown/ArrowUp (and Enter/Space) on the closed trigger opens the popup; Arrow keys move highlight; typeahead jumps to matching items while open **and** while closed (changes value directly); Enter/Space selects; Escape closes without selecting; Home/End jump to first/last item.
- With `alignItemWithTrigger` (default) the popup opens with the selected item positioned over the trigger and highlighted.
- Arrow keys may highlight a disabled option; Enter/Space/click do not select it and leave the popup open. Typeahead skips disabled items. `data-disabled` still dims the option.
- Invalid state arrives as `aria-invalid` on the trigger (via base-ui Field or consumer) and surfaces the error ring; per conventions, boolean aria uses `x || undefined`.
- Scroll buttons are pointer affordances only (keyboard scrolls the list natively); they render `aria-hidden` per base-ui.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Select`→`Select.Root`, `SelectTrigger`→`Select.Trigger`, `SelectValue`→`Select.Value`, `SelectContent`→`Select.Content`, `SelectItem`→`Select.Item`, `SelectGroup`→`Select.Group`, `SelectLabel`→`Select.Label`, `SelectSeparator`→`Select.Separator`, `SelectScrollUpButton`→`Select.ScrollUpButton`, `SelectScrollDownButton`→`Select.ScrollDownButton`.
2. **Overlay `container` prop added** to `Select.Content` — forwarded to `SelectPrimitive.Portal`, defaulting to the nearest `ThemeScope` element so the popup inherits scoped theme tokens (portal-inside-ThemeScope discipline). The ref portals to `document.body`.
3. **`bg-white` → `bg-card`** on the trigger (input-like surface convention; ref hardcodes white).
4. **Dead `data-variant=destructive` selector removed** from `Select.Item` (`not-data-[variant=destructive]:focus:**:text-accent-foreground` → unconditional `focus:**:text-accent-foreground`): copied from dropdown-menu, but nothing in select ever sets `data-variant`.
5. **`destructive` → `error`** token renames on trigger invalid chrome.
6. **All `dark:` and `inverted:` classes dropped** (`dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 inverted:bg-input/30 inverted:hover:bg-input/50` on the trigger) — dark axis lives in tokens.
7. **Duplicated `isolate z-50` deduped**: the ref puts `isolate z-50` on both Positioner and Popup; kept on the Positioner only (minor divergence, no stacking-context behavior change — the Positioner already isolates).
8. **Icons → Phosphor**: `CheckIcon`→`Check` (item indicator), `ChevronDownIcon`→`CaretDown` (trigger icon + scroll-down), `ChevronUpIcon`→`CaretUp` (scroll-up).
9. **Density retokenization:** Trigger `data-[size=default]:h-9` / `data-[size=sm]:h-8` become `--control-h-md` / `--control-h-sm`. Padding, gap, and type at `default` read `--control-px-md` / `--control-gap-md` / the control-type pair; `sm` reads the `sm` rungs with `text-sm`. `py-*` is omitted beside the pinned height. Dense computed height matches the ref; comfortable is the signed `ui.css` column. _(Amended 2026-09-02.)_

10. **Shared overlay spine adopted:** `Select.Content` composes `OverlayPortal`, `OverlayPositionerProps`/`OverlayContainerProps`, and `overlayPositionerClass` / `overlayTimedPopupClass`; `Select.Item`, `Select.Label`, and `Select.Separator` compose `menuItemClass` / `menuItemIndicatorClass` / `menuGroupLabelClass` / `menuSeparatorClass`; the trigger composes `selfFocusRingClass`. Select takes the shared positioner block whole; published defaults come from destructuring (popover.md §8.7). The extras that stay Select's are the `rounded-lg` radius rung, `data-[align-trigger=true]:animate-none`, the popup geometry, the option's `w-full pr-8 pl-2` and its `focus:` highlight face (base-ui spells the highlight `focus:` on Select items, so `menuItemClass` deliberately excludes it), the indicator's `size-4`, and the separator's `pointer-events-none`. Emitted class set, prop names, documented defaults, and DOM are unchanged. _(Amended 2026-09-04: tickets 02, 05, 08.)_
11. **Trigger chrome is the shared field-box chrome.** _(2026-09-04.)_ Select's trigger paints the same elevation, radius, border, fill, and transition as Input, so it composes `fieldBoxChromeClass` rather than restating those five utilities. The `size` axis stays local: `default`/`sm` prefix padding, gap, height, and type, and those prefixes cannot ride on `controlInsetMdClass`. The one rendered change is that an invalid trigger now transitions `border-color` like every other field box.

Kept faithfully: `data-size` sm|default trigger axis; `alignItemWithTrigger` default `true` and its `data-[align-trigger=true]:animate-none` consequence; auto-rendered scroll buttons inside Content; the rotating trigger caret keyed off `data-popup-open`; the Value child-selector styling from the trigger; `min-w-36` popup floor; item's `*:[span]:last:` layout selectors.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Open/close: `getByRole("combobox")` trigger; click and ArrowDown both open (`getByRole("listbox")` appears); Escape closes and returns focus to the trigger; selecting via click closes and updates the trigger's accessible value.
- Arrow navigation: ArrowDown/ArrowUp move the highlighted option (a disabled option may be highlighted); Enter selects a highlighted enabled option (`onValueChange` fires with the value, not an event) and does not select a highlighted disabled option (popup stays open); Home/End reach first/last. Typeahead skips disabled items.
- Typeahead: with the popup open, typing a prefix highlights the matching option; typing on the closed trigger changes the value without opening.
- `data-size` reflects `size` for both values; `data-align-trigger` reflects `alignItemWithTrigger`.
- Dual-density: at document `dense` and `comfortable`, Trigger height, padding, gap, and type for `default`/`sm` match the signed `--control-*` ladder; nested `data-density` and `ThemeScope` variant changes do not rescope metrics.
- `aria-invalid` on the trigger surfaces error chrome (attribute assertion); `disabled` root disables the trigger.
- Groups: `Select.Label` names its group in the accessibility tree (`getByRole("group", { name })`).
- `container`: popup renders inside the provided element / nearest ThemeScope, not `document.body`.

## 10 Demo requirements

Plain runnable `.tsx` demos: `select-basic.tsx` (placeholder Value, a handful of items), `select-groups.tsx` (two groups with Labels and a Separator), `select-sizes.tsx` (`size="sm"` vs `"default"` side by side), `select-scrolling.tsx` (long list exercising scroll buttons and `alignItemWithTrigger`), `select-invalid.tsx` (aria-invalid + disabled states).
