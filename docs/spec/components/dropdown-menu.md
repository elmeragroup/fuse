# DropdownMenu

## 1 Header

- **Canonical name**: `DropdownMenu` (namespace compound)
- **Export path**: `@elmeragroup/ui/dropdown-menu` (also re-exported from `@elmeragroup/ui`)
- **Tier**: styled base-ui primitive wrapper (overlay component; base-ui `Menu` family)
- **RSC**: client
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/dropdown-menu.tsx`

## 2 Anatomy

| Part                        | Base                           | Notes                                                                                                                                                      |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DropdownMenu.Root`         | `MenuPrimitive.Root`           | bare re-export; open-state owner, no DOM                                                                                                                   |
| `DropdownMenu.Trigger`      | `MenuPrimitive.Trigger`        | bare re-export; anchor button                                                                                                                              |
| `DropdownMenu.Portal`       | `MenuPrimitive.Portal`         | bare re-export; exported (unlike Popover/Tooltip) for advanced composition                                                                                 |
| `DropdownMenu.Content`      | `Portal > Positioner > Popup`  | scrollable menu surface (`min-w-32 p-1`, `max-h-(--available-height)`)                                                                                     |
| `DropdownMenu.Group`        | `MenuPrimitive.Group`          | bare re-export                                                                                                                                             |
| `DropdownMenu.Label`        | `MenuPrimitive.GroupLabel`     | muted `text-xs font-medium` heading; `inset`                                                                                                               |
| `DropdownMenu.Item`         | `MenuPrimitive.Item`           | shared item recipe; `inset`, `variant`                                                                                                                     |
| `DropdownMenu.LinkItem`     | `MenuPrimitive.LinkItem`       | Funnel addition (no shadcn equivalent): navigational item rendering an `<a>`; pass `render={<Link href=… />}` for router links; styled identically to Item |
| `DropdownMenu.CheckboxItem` | `MenuPrimitive.CheckboxItem`   | auto-renders indicator span (absolute right-2) with `CheckboxItemIndicator > Check`; `inset`                                                               |
| `DropdownMenu.RadioGroup`   | `MenuPrimitive.RadioGroup`     | bare re-export                                                                                                                                             |
| `DropdownMenu.RadioItem`    | `MenuPrimitive.RadioItem`      | auto-renders indicator span with `RadioItemIndicator > Check` — a check, not a dot (§8); `inset`                                                           |
| `DropdownMenu.Separator`    | `MenuPrimitive.Separator`      | `-mx-1 my-1 h-px bg-border`                                                                                                                                |
| `DropdownMenu.Shortcut`     | plain `span`                   | `ml-auto` muted shortcut hint; recolors on item focus via the item's group scope                                                                           |
| `DropdownMenu.Sub`          | `MenuPrimitive.SubmenuRoot`    | submenu state owner, no DOM                                                                                                                                |
| `DropdownMenu.SubTrigger`   | `MenuPrimitive.SubmenuTrigger` | item-styled trigger; auto-appends `CaretRight` (`ml-auto`); `inset`                                                                                        |
| `DropdownMenu.SubContent`   | `Portal > Positioner > Popup`  | own thin popup with sub-specific defaults — does **not** reuse Content (§8 bugfix)                                                                         |

```tsx
<DropdownMenu.Root>
  <DropdownMenu.Trigger render={<Button variant="outline" />}>Open</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Group>
      <DropdownMenu.Label>Account</DropdownMenu.Label>
      <DropdownMenu.Item>
        Profile <DropdownMenu.Shortcut>⇧⌘P</DropdownMenu.Shortcut>
      </DropdownMenu.Item>
      <DropdownMenu.LinkItem render={<Link href="/settings" />}>Settings</DropdownMenu.LinkItem>
    </DropdownMenu.Group>
    <DropdownMenu.Separator />
    <DropdownMenu.CheckboxItem checked>Show toolbar</DropdownMenu.CheckboxItem>
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.Item variant="destructive">Delete</DropdownMenu.Item>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

## 3 Props

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props (incl. `render`). Primitive-tier naming throughout (`disabled`, not `isDisabled`).

**DropdownMenu.Root** — `ComponentProps<MenuPrimitive.Root>` verbatim (`open`/`defaultOpen`/`onOpenChange`, `modal`, `disabled`, `closeParentOnEsc`, …).
**DropdownMenu.Trigger / Portal / Group / RadioGroup / Sub** — their base-ui part's props verbatim (`RadioGroup`: `value`/`defaultValue`/`onValueChange`; `Sub`: submenu root props).

**DropdownMenu.Content** — `ComponentProps<MenuPrimitive.Popup>` plus `Pick<ComponentProps<MenuPrimitive.Positioner>, "align" | "alignOffset" | "side" | "sideOffset">` plus:

| Prop          | Type                                            | Default                      | Notes                                                            |
| ------------- | ----------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `align`       | Positioner `align`                              | `"start"`                    | menus lead from the trigger edge (vs Popover/Tooltip `"center"`) |
| `alignOffset` | `number`                                        | `0`                          |                                                                  |
| `side`        | Positioner `side`                               | `"bottom"`                   |                                                                  |
| `sideOffset`  | `number`                                        | `4`                          |                                                                  |
| `container`   | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | forwarded to the internal `MenuPrimitive.Portal` (§8)            |

**DropdownMenu.SubContent** — same surface as Content but with sub-specific defaults and its own thin popup (§8):

| Prop          | Type                                            | Default                      | Notes                                                 |
| ------------- | ----------------------------------------------- | ---------------------------- | ----------------------------------------------------- |
| `align`       | Positioner `align`                              | `"start"`                    |                                                       |
| `alignOffset` | `number`                                        | `-3`                         | tucks the submenu's first item level with its trigger |
| `side`        | Positioner `side`                               | `"right"`                    |                                                       |
| `sideOffset`  | `number`                                        | `0`                          | flush against the parent menu                         |
| `container`   | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | forwarded to its own Portal (§8)                      |

**DropdownMenu.Item** — `ComponentProps<MenuPrimitive.Item>` plus:

| Prop      | Type                         | Default     | Notes                                                                                                           |
| --------- | ---------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `inset`   | `boolean`                    | —           | emitted as `data-inset`; pads `pl-8` to align with indicator-bearing items                                      |
| `variant` | `"default" \| "destructive"` | `"default"` | emitted as `data-variant`; the _value_ stays `"destructive"` (consumer-compat), classes use `error` tokens (§8) |

**DropdownMenu.LinkItem** — `ComponentProps<MenuPrimitive.LinkItem>` (incl. `href`, `render`). No `inset`/`variant` in the ref; kept faithful.
**DropdownMenu.CheckboxItem** — `ComponentProps<MenuPrimitive.CheckboxItem>` (`checked`/`defaultChecked`/`onCheckedChange`, `closeOnClick`, …) plus `inset?: boolean`.
**DropdownMenu.RadioItem** — `ComponentProps<MenuPrimitive.RadioItem>` (`value`, `disabled`, …) plus `inset?: boolean`.
**DropdownMenu.Label / SubTrigger** — their base part's props plus `inset?: boolean`.
**DropdownMenu.Separator** — `ComponentProps<MenuPrimitive.Separator>`. **DropdownMenu.Shortcut** — `ComponentProps<"span">`.

## 4 Variants

No component-specific `tv` recipe. Trigger composes the shared self-target focus ring. _(Amended 2026-09-03; see §8.10.)_ `variant` on Item is a hand-rolled `data-variant` axis inside the shared item class string `dropdownMenuItemClassName` (module-private constant shared by Item, LinkItem, CheckboxItem, RadioItem, and SubTrigger); that constant also composes the same self-focus adapter. `inset` is a `data-inset` boolean axis on Label/Item/CheckboxItem/RadioItem/SubTrigger.

## 5 Consumed tokens

- `popover` / `popover-foreground` — Content and SubContent surface/text.
- `ring-foreground/10` — popup hairline (`ring-1`); Content pairs it with `shadow-md`, SubContent with `shadow-lg`.
- `accent` / `accent-foreground` — focused item/sub-trigger highlight (`focus:bg-accent focus:text-accent-foreground`, sub-trigger also `data-popup-open:`/`data-open:`).
- `error` — destructive-variant items: `data-[variant=destructive]:text-error`, `…focus:bg-error/10`, `…focus:text-error`, `…*:[svg]:text-error` (ref `destructive` classes renamed, §8).
- `muted-foreground` — Label and Shortcut text.
- `border` — Separator fill.
- `ring` + `background` — Trigger and menu-item focus treatment.
- Radii: popups `rounded-md`, items `rounded-sm` — `--radius`-derived scale steps, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**:

- `data-slot`: `dropdown-menu` · `dropdown-menu-trigger` · `dropdown-menu-portal` · `dropdown-menu-content` · `dropdown-menu-group` · `dropdown-menu-label` · `dropdown-menu-item` · `dropdown-menu-link-item` · `dropdown-menu-checkbox-item` · `dropdown-menu-checkbox-item-indicator` · `dropdown-menu-radio-group` · `dropdown-menu-radio-item` · `dropdown-menu-radio-item-indicator` · `dropdown-menu-separator` · `dropdown-menu-shortcut` · `dropdown-menu-sub` · `dropdown-menu-sub-trigger` · `dropdown-menu-sub-content`.
- `data-inset` on Label/Item/CheckboxItem/RadioItem/SubTrigger; `data-variant="default" | "destructive"` on Item.

**Emitted (by base-ui, styled by us)**: `data-open` / `data-closed`, `data-side` on popups; `data-disabled` on items; `data-popup-open` / `data-open` on SubTrigger; `data-checked` on checkbox/radio items (available, indicator handles visuals).

**Consumed selectors**:

- Popups: `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`, `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`, `data-[side=…]:slide-in-from-*`, `duration-100`, `origin-(--transform-origin)`; sizing via `max-h-(--available-height)` with `overflow-y-auto`, and the `data-closed:overflow-hidden` guard that hides the scrollbar during the exit animation. Bare `data-open:`/`data-closed:` are self-scoped custom variants and stay on each popup that emits the state.
- Items (`dropdownMenuItemClassName`): `focus:bg-accent focus:text-accent-foreground`, `not-data-[variant=destructive]:focus:**:text-accent-foreground`, `data-inset:pl-8`, `data-disabled:pointer-events-none data-disabled:opacity-50`, `[&_svg:not([class*='size-'])]:size-4`, and the `group/dropdown-menu-item` scope consumed by Shortcut (`group-focus/dropdown-menu-item:text-accent-foreground`).
- SubTrigger adds `data-popup-open:bg-accent data-popup-open:text-accent-foreground` (+ the equivalent `data-open:` pair).

## 7 Accessibility

- Base-ui wires `role="menu"` on popups, `role="menuitem"` / `menuitemcheckbox` / `menuitemradio` on items (with `aria-checked`), `aria-haspopup="menu"` + `aria-expanded` on triggers, and `role="group"` + GroupLabel labelling for `Group`/`Label`.
- Keyboard: Enter/Space/ArrowDown on the trigger opens and highlights the first item (ArrowUp opens to the last); Arrow keys move highlight; typeahead jumps to matching items; Enter/Space activates; Escape closes the whole menu and returns focus to the trigger.
- Submenus: ArrowRight on a SubTrigger opens its SubContent and moves highlight in; ArrowLeft closes the submenu and returns to the SubTrigger; hover opens after base-ui's intent delay.
- CheckboxItem toggles and RadioItem selects on activation (menu closes per base-ui `closeOnClick` semantics); `LinkItem` navigates like a link and participates in menu keyboard flow.
- `disabled` items stay in the roving arrow sequence and expose `aria-disabled="true"`, but Enter, Space, and click never activate them and the menu stays open; they are dimmed via `data-disabled`. Per conventions, boolean aria uses `x || undefined`. _(Amended 2026-09-03; see §8.11.)_

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `DropdownMenu`→`DropdownMenu.Root`, and `DropdownMenuTrigger/Portal/Content/Group/Label/Item/LinkItem/CheckboxItem/RadioGroup/RadioItem/Separator/Shortcut/Sub/SubTrigger/SubContent` → the matching `DropdownMenu.*` parts.
2. **Overlay `container` prop added (mandated)** to `DropdownMenu.Content` and `DropdownMenu.SubContent`, forwarded to their internal `MenuPrimitive.Portal`, defaulting to the nearest `ThemeScope` element. The ref hardcodes both portals (→ `document.body`) even though it also exports a standalone `Portal` part that `Content` never consumes; the standalone `DropdownMenu.Portal` export is kept for advanced composition.
3. **SubContent BUGFIX (LOCKED ruling)**: the ref implements `DropdownMenuSubContent` by _rendering `DropdownMenuContent`_ — so the submenu double-wraps Portal+Positioner through Content's internals and double-applies popup base classes (Content's full base string _and_ SubContent's near-duplicate string are both fed through `cn`, leaving conflicts like `shadow-md` vs `shadow-lg` and `min-w-32` vs `min-w-[96px]` to tailwind-merge ordering — a standing merge hazard). Ruled: `DropdownMenu.SubContent` gets its own thin `Portal > Positioner > Popup` with a single class string (`w-auto min-w-[96px] p-1 shadow-lg ring-1 ring-foreground/10 rounded-md bg-popover text-popover-foreground` + the shared open/close animation set) and the sub-specific positioner defaults `start / -3 / right / 0`. Content and SubContent now render through **one** module-private `Portal > Positioner > Popup`, parameterized by `data-slot`, popup-chrome extra, and the four positioner values each part resolves from its own defaults — which is what keeps this ruling true by construction: neither part renders through the other, and each popup is still one class string. _(Amended 2026-09-03; see §8.10.)_
4. **`destructive` classes → `error` tokens; variant value unchanged**: `dropdownMenuItemClassName`'s `data-[variant=destructive]:text-destructive`, `…focus:bg-destructive/10`, `…focus:text-destructive`, `…*:[svg]:text-destructive` are re-expressed on `error` tokens per conventions (library source never says `destructive` in class names). The `variant` prop _value_ stays `"destructive"` and so does the emitted `data-variant="destructive"` — consumer-facing API compat.
5. **Only `dark:` class dropped**: `dark:data-[variant=destructive]:focus:bg-destructive/20` removed per the no-`dark:`-variants convention (dark axis lives in tokens).
6. **`z-50` deduped**: the ref sets `isolate z-50` on the Positioner _and_ `z-50` on the Popup; kept once on the outermost layer (Positioner) per the flat z-strategy — every overlay gets exactly one `z-50` at its outermost portalled element.
7. **Icons → Phosphor**: `Check`→`Check` (checkbox + radio indicators), `ChevronRight`→`CaretRight` (SubTrigger caret).
8. **Radio indicator is a check, not a dot (documented, kept)**: the ref renders `Check` inside `RadioItemIndicator` where shadcn uses a filled circle; kept as the proven Funnel face.
9. **Focus unified:** Trigger and every focusable menu-item face compose the canonical self-focus adapter; the accent background remains the roving-highlight cue but is not used as a focus-ring substitute.

10. **Shared overlay spine adopted:** the unified popup composes `OverlayPortal`, `overlayPositionerClass` (+ `outline-none`), and `overlayTimedPopupClass`; `dropdownMenuItemClassName` composes `selfFocusRingClass` + `menuItemClass` plus this family's `focus:` highlight face and its `data-variant` arms; Label, Separator, and both item indicators compose `menuGroupLabelClass` / `menuSeparatorClass` / `menuItemIndicatorClass`. `DropdownMenu.Content` takes the shared positioner block and redeclares `align` (menus lead from the trigger edge). `SubContent` redeclares `align`, `alignOffset`, `side`, and `sideOffset` whose prose names the SubTrigger, the negative tuck, and the flush against the parent menu (§3); `container` takes the shared one-place wording. Published defaults come from each part's destructuring (popover.md §8.7). The extras that stay this family's are Content's `max-h`/`min-w-32`/overflow/`outline-none`/`data-closed:overflow-hidden` and SubContent's `w-auto min-w-[96px] p-1 shadow-lg`. Emitted class sets for both popups, prop names, documented defaults, and DOM are unchanged. _(ticket 02, 2026-09-04: SubContent redeclares the four positioner keys whose §3 notes differ from the shared trigger sentences.) (ticket 05, 2026-09-04: the timed popup surface is `overlayTimedPopupClass`.) (ticket 08, 2026-09-04: `OverlayPortal` owns the wait-not-body rule.)_

11. **Disabled items stay arrow-reachable (spec corrected, not code):** base-ui's `Menu.Root` hard-codes `disabledIndices: EMPTY_ARRAY` into its `useListNavigation`, so a `disabled` item keeps its place in the roving sequence and is announced as `aria-disabled` rather than vanishing from it — the APG-sanctioned "focusable but not activatable" reading, which lets a screen-reader user hear that the option exists and is unavailable. There is no prop to opt out short of forking the primitive, and skipping the item would be the worse a11y outcome, so §7 and §9 were reworded to the behaviour that ships instead of the reference's "skipped by arrow navigation". Activation is still refused: Enter, Space, and click fire no `onClick` and leave the menu open. _(Added 2026-09-03; the browser suite's "lets arrows reach a disabled item but refuses to activate it" scenario is the proof.)_

Kept faithfully: `LinkItem` (Funnel addition, render-prop router links, shares the private `dropdownMenuItemClassName` with Item); `inset` props across Label/Item/CheckboxItem/RadioItem/SubTrigger; `max-h-(--available-height)` + `overflow-y-auto` with the `data-closed:overflow-hidden` scrollbar guard; the `group/dropdown-menu-item` → Shortcut focus-recolor hook; SubContent defaults `start/-3/right/0`; `dropdownMenuItemClassName` stays module-private (no recipe export).

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Open/close: trigger click and ArrowDown open `getByRole("menu")`; Escape closes and returns focus to the trigger; activating an item closes the menu.
- Arrow navigation: ArrowDown/ArrowUp cycle `menuitem`s; a disabled item is reached like any other but cannot be activated; Home/End per base-ui. _(Amended 2026-09-03; see §8.11.)_
- Typeahead: typing a prefix while open highlights the matching item.
- Submenu: ArrowRight on the SubTrigger opens the submenu (`data-popup-open` asserted) and focuses its first item; ArrowLeft closes back to the SubTrigger; Escape closes the entire tree.
- CheckboxItem: `getByRole("menuitemcheckbox")` toggles `aria-checked`; `onCheckedChange` fires; indicator visibility follows checked state.
- RadioGroup/RadioItem: `menuitemradio` items reflect `aria-checked` from group value; activation calls `onValueChange` with the value.
- LinkItem: renders `getByRole("menuitem")` backed by an `<a href>`; `render` composition with a router link keeps menu keyboard flow.
- Variant/inset: `data-variant="destructive"` and `data-inset` emitted; error-token classes applied to destructive items.
- `container`: Content and SubContent render inside the provided element / nearest ThemeScope, not `document.body`.

## 10 Demo requirements

Plain runnable `.tsx` demos: `dropdown-menu-basic.tsx` (groups, labels, shortcuts, separator), `dropdown-menu-checkboxes.tsx` (CheckboxItems with controlled state), `dropdown-menu-radio-group.tsx` (RadioGroup with the check-style indicator), `dropdown-menu-submenu.tsx` (nested Sub/SubTrigger/SubContent), `dropdown-menu-links.tsx` (LinkItem with a router `render`), `dropdown-menu-destructive.tsx` (destructive-variant item with icon, inset alignment, disabled item).
