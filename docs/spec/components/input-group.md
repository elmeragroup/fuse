# InputGroup

## 1 Header

- **Canonical name**: `InputGroup` (namespace compound)
- **Export path**: `@elmeragroup/ui/input-group` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: structural primitive composing `Input`/`Textarea`/`Button`
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/input-group.tsx`

## 2 Anatomy

The Root carries the entire "input chrome" (border, radius, shadow, focus ring, invalid ring); the embedded controls are stripped bare and the ring is re-derived from `:has()` selectors on the Root.

| Part                  | Base                 | Notes                                                                  |
| --------------------- | -------------------- | ---------------------------------------------------------------------- |
| `InputGroup.Root`     | `div` `role="group"` | chrome owner; pins `md` control height, auto for block addons/textarea |
| `InputGroup.Addon`    | `div` `role="group"` | icon/text/button rail; `align` axis; click focuses sibling input       |
| `InputGroup.Button`   | `Button`             | re-typed compact size axis (§4)                                        |
| `InputGroup.Text`     | `span`               | muted inline text/icons                                                |
| `InputGroup.Input`    | `Input`              | chrome stripped, slot re-tagged `input-group-control`                  |
| `InputGroup.Textarea` | `Textarea`           | chrome stripped, `resize-none`, slot re-tagged                         |

```tsx
<InputGroup.Root>
  <InputGroup.Addon>
    <MagnifyingGlass />
  </InputGroup.Addon>
  <InputGroup.Input placeholder="Search…" />
  <InputGroup.Addon align="inline-end">
    <InputGroup.Button>Clear</InputGroup.Button>
  </InputGroup.Addon>
</InputGroup.Root>
```

## 3 Props

All parts take `className` (merged via `cn`) plus:

**InputGroup.Root** — `ComponentProps<"div">`. No other props; state is derived (`has-disabled`, `has-[[data-slot=input-group-control]:focus-visible]`, `has-[[data-slot][aria-invalid=true]]`).

**InputGroup.Addon** — `ComponentProps<"div">` plus:

| Prop    | Type                                                             | Default          |
| ------- | ---------------------------------------------------------------- | ---------------- |
| `align` | `"inline-start" \| "inline-end" \| "block-start" \| "block-end"` | `"inline-start"` |

Built-in `onClick`: if the click target is not inside a `<button>`, focuses the sibling `<input>` (`parentElement.querySelector("input")`) — the addon behaves as an extension of the input's hit area. Consumer `onClick` is spread after and also runs.

**InputGroup.Button** — `Omit<ComponentProps<typeof Button>, "size" | "type">` plus:

| Prop      | Type                                     | Default    | Notes                                                                                                               |
| --------- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `size`    | `"xs" \| "sm" \| "icon-xs" \| "icon-sm"` | `"xs"`     | local 4-value subset, NOT Button's `size` (§4). `icon-xs` / `icon-sm` require `aria-label` (icon-only union guard). |
| `type`    | `"button" \| "submit" \| "reset"`        | `"button"` | re-typed; defaults to non-submitting                                                                                |
| `variant` | Button's `variant`                       | `"ghost"`  | forwarded to Button                                                                                                 |

**InputGroup.Text** — `ComponentProps<"span">`.

**InputGroup.Input** — `ComponentProps<"input">`, forwarded to `Input`.
**InputGroup.Textarea** — `ComponentProps<"textarea">`, forwarded to `Textarea`.

## 4 Variants

Both recipes are **module-private** (no borrow pattern; stated per convention):

- `inputGroupAddonVariants` (tv) — axis `align`: `inline-start` (default; `order-first pl-2`, negative-margin trims for nested button/kbd), `inline-end` (`order-last pr-2`), `block-start` / `block-end` (full-width rows above/below; Root switches to `flex-col h-auto` and pads the input via `has-[>[data-align=block-*]]` selectors). Base includes `cursor-text`, muted text, `[&>svg:not([class*='size-'])]:size-4`, kbd radius `rounded-[calc(var(--radius)-5px)]` (kept clamp arithmetic, documented).
- `inputGroupButtonVariants` (tv) — axis `size`: `xs` (default; `h-6`, `rounded-[calc(var(--radius)-5px)]`), `sm` (empty string — Button's own `sm` metrics pass through), `icon-xs` (`size-6`, zero padding), `icon-sm` (`size-8`, zero padding).

**Density mapping.** Root is a single-height field box: pin `h-(--control-h-md)` per [conventions](conventions.md) ruling 2, 2026-08-21 (`h-auto` still wins for block addons/textarea). No `dense:` / `comfortable:` variants.

**Exemption — `InputGroup.Button` compact axis.** The local `xs` / `icon-xs` / `icon-sm` values (`h-6`, `size-6`, `size-8`) are addon chrome inside the group, not the four-rung control box. They do not match `xs`/`sm`/`md`/`lg` and **must not** invent a fifth `--control-*` rung. `sm` stays an empty string so Button's own `sm` metrics pass through. Dual-density tests assert these compact addon sizes stay identical across stamps.

**Button size re-typing mechanism**: Button's own `size` prop is omitted; the local 4-value subset is applied purely as extra classes via `inputGroupButtonVariants` and forwarded to the DOM as **`data-size`** (never as Button's `size`), so Button renders at its default size with compact overrides layered on, and CSS/consumers can target `[data-size=…]`.

## 5 Consumed tokens

- `input` — Root border (`border-input`), disabled fill (`has-disabled:bg-input/50`).
- `ring` — Root composes shared `focusRing({ target: "within" })` around the focused control.
- `error` — invalid chrome (`has-[[data-slot][aria-invalid=true]]:border-error …ring-error/20`).
- `muted-foreground` — Addon and Text foreground.
- Radius: Root `rounded-md`; nested compact radii use the kept `calc(var(--radius)-5px)` arithmetic.

## 6 Data attributes

**Emitted**: `data-slot="input-group"` (Root), `"input-group-addon"` + `data-align` (Addon), `"input-group-text"` (Text — added, §8), `"input-group-control"` + `data-focus-ring-control` (Input/Textarea, overriding the primitives' own slot and identifying the owned focus receiver), `data-size` (Button).

**Consumed**: `[data-slot=input-group-control]:focus-visible` and `[data-slot][aria-invalid=true]` (Root chrome); `>[data-align=block-start/end]` and `>[data-align=inline-start/end]` (Root layout + input padding); Root `has-disabled:opacity-50` (group dimming, including Addon — Root never stamps `data-disabled`, so a `group-data-[disabled=true]/input-group` arm cannot match). `InputGroup.Text`'s slot participates in the ButtonGroup `[data-slot]` sizing contract (§8). There is no popup-specific focus exception: an InputGroup inside Combobox content keeps the same visible ring as every other instance. _(Amended 2026-09-02 — Addon dimming is Root `has-disabled:`, not a never-matching `data-disabled` group selector.)_

## 7 Accessibility

- Root and Addon render `role="group"`; controls keep native semantics.
- The visual focus ring lives on Root but tracks the control's `:focus-visible` — keyboard focus on the input lights the whole group; buttons inside addons receive their own focus treatment from Button.
- Addon click-to-focus (§3) keeps the whole chrome acting as the input's target without stealing clicks from nested buttons.
- `InputGroup.Button` defaults `type="button"` so icon buttons inside forms never submit accidentally.
- Invalid state is driven by `aria-invalid` on the control (via base-ui Field or consumer) and surfaces on the group chrome.
- Tab order: input and any addon buttons in DOM order; addons themselves are not focusable.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `InputGroup`→`InputGroup.Root`, `InputGroupAddon`→`InputGroup.Addon`, `InputGroupButton`→`InputGroup.Button`, `InputGroupText`→`InputGroup.Text`, `InputGroupInput`→`InputGroup.Input`, `InputGroupTextarea`→`InputGroup.Textarea`.
2. **`InputGroup.Text` gains `data-slot="input-group-text"`** — the ref omits any `data-slot` on the span, breaking the ButtonGroup `[data-slot]` child-selector contract (ButtonGroup sizes/joins children by slot); fixed.
3. **`destructive` → `error`** token rename on invalid chrome.
4. **`dark:` variant classes dropped** (`dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[…]:ring-destructive/40` on Root; `dark:bg-transparent dark:disabled:bg-transparent` on Input/Textarea) — dark axis lives in tokens. Control-level transparent overrides remain in the light-set only.
5. Recipes `inputGroupAddonVariants` / `inputGroupButtonVariants` confirmed module-private (ref does not export them; pinned here against drift).
6. `data-focus-ring-control` marks only Input/Textarea for the shared within adapter; addon Buttons keep their independent Button ring and do not light the group chrome.
7. **Popup focus exception removed:** the ref's `in-data-[slot=combobox-content]:focus-within:border-inherit/ring-0` suppression is deleted. A static popup hairline is not a keyboard focus indicator, so embedded search inputs keep the canonical group ring.
8. **Density:** Root height retokenizes to `--control-h-md`. `InputGroup.Button` compact axis is an explicit shell-local exemption (see §4).

Kept faithfully: Addon focus-sibling-input `onClick`; Button size re-typing via `data-size`; Input/Textarea chrome stripping (`rounded-none border-0 bg-transparent shadow-none disabled:bg-transparent aria-invalid:ring-0`, textarea additionally `resize-none py-2`). The shared `focusRing({ target: "within" })` adapter owns both the Root's focus-visible ring and the nested control's self-ring neutralization; this component contains no local focus-ring literal.

## 9 Test requirements

- Root renders `getByRole("group")`; input reachable by role (with Field-provided or aria-label name).
- Addon click focuses the input (userEvent click on addon text → input has focus); clicking a button inside the addon does NOT move focus to the input and fires the button.
- Keyboard: Tab order is input → addon button (DOM order); focusing the input via keyboard sets `:focus-visible` on the control (assert via the control's `data-slot="input-group-control"` state, queries still role-based).
- `InputGroup.Button`: default `type="button"` (pressing Enter inside a form's group input does not trigger it); `data-size` reflects the size prop for all four values; Button's own `size` prop is not accepted (type-level test); icon-size without `aria-label` fails to compile. _(Amended 2026-09-02.)_
- `aria-invalid` on the control surfaces group invalid chrome (attribute assertion on control; chrome via state attr, not snapshot).
- `align` reflected as `data-align` for all four values; block alignments render Root as column.
- Disabled input dims the group (`has-disabled` state) and addon.
- A popup-embedded search InputGroup retains the same keyboard-visible Root ring (regression for §8.7).
- Dual-density: Root height matches the signed `md` rung at `dense` and `comfortable`; `InputGroup.Button` `xs`/`icon-xs`/`icon-sm` computed sizes are identical across stamps; nested `data-density` does not rescope Root height.

## 10 Demo requirements

Plain runnable `.tsx` demos: `input-group-icons.tsx` (leading MagnifyingGlass icon + trailing Text suffix), `input-group-buttons.tsx` (inline-end Button `xs`, `icon-xs` clear button), `input-group-block.tsx` (block-start label row + block-end helper row), `input-group-textarea.tsx` (Textarea control with block-end action bar), `input-group-invalid.tsx` (aria-invalid + disabled states), `input-group-kbd.tsx` (keyboard-shortcut kbd hint in an addon).
