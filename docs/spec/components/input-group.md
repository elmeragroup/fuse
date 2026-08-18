# InputGroup

## 1 Header

- **Canonical name**: `InputGroup` (namespace compound)
- **Export path**: `@elmeragroup/ui` (`import { InputGroup } from "@elmeragroup/ui"`)
- **Tier**: structural primitive composing `Input`/`Textarea`/`Button`
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/input-group.tsx`

## 2 Anatomy

The Root carries the entire "input chrome" (border, radius, shadow, focus ring, invalid ring); the embedded controls are stripped bare and the ring is re-derived from `:has()` selectors on the Root.

| Part | Base | Notes |
| --- | --- | --- |
| `InputGroup.Root` | `div` `role="group"` | chrome owner; height 9, auto for block addons/textarea |
| `InputGroup.Addon` | `div` `role="group"` | icon/text/button rail; `align` axis; click focuses sibling input |
| `InputGroup.Button` | `Button` | re-typed compact size axis (§4) |
| `InputGroup.Text` | `span` | muted inline text/icons |
| `InputGroup.Input` | `Input` | chrome stripped, slot re-tagged `input-group-control` |
| `InputGroup.Textarea` | `Textarea` | chrome stripped, `resize-none`, slot re-tagged |

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

| Prop | Type | Default |
| --- | --- | --- |
| `align` | `"inline-start" \| "inline-end" \| "block-start" \| "block-end"` | `"inline-start"` |

Built-in `onClick`: if the click target is not inside a `<button>`, focuses the sibling `<input>` (`parentElement.querySelector("input")`) — the addon behaves as an extension of the input's hit area. Consumer `onClick` is spread after and also runs.

**InputGroup.Button** — `Omit<ComponentProps<typeof Button>, "size" | "type">` plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `"xs" \| "sm" \| "icon-xs" \| "icon-sm"` | `"xs"` | local 4-value subset, NOT Button's `size` (§4) |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | re-typed; defaults to non-submitting |
| `variant` | Button's `variant` | `"ghost"` | forwarded to Button |

**InputGroup.Text** — `ComponentProps<"span">`.

**InputGroup.Input** — `ComponentProps<"input">`, forwarded to `Input`.
**InputGroup.Textarea** — `ComponentProps<"textarea">`, forwarded to `Textarea`.

## 4 Variants

Both recipes are **module-private** (no borrow pattern; stated per convention):

- `inputGroupAddonVariants` (tv) — axis `align`: `inline-start` (default; `order-first pl-2`, negative-margin trims for nested button/kbd), `inline-end` (`order-last pr-2`), `block-start` / `block-end` (full-width rows above/below; Root switches to `flex-col h-auto` and pads the input via `has-[>[data-align=block-*]]` selectors). Base includes `cursor-text`, muted text, `[&>svg:not([class*='size-'])]:size-4`, kbd radius `rounded-[calc(var(--radius)-5px)]` (kept clamp arithmetic, documented).
- `inputGroupButtonVariants` (tv) — axis `size`: `xs` (default; `h-6`, `rounded-[calc(var(--radius)-5px)]`), `sm` (empty string — Button's own `sm` metrics pass through), `icon-xs` (`size-6`, zero padding), `icon-sm` (`size-8`, zero padding).

**Button size re-typing mechanism**: Button's own `size` prop is omitted; the local 4-value subset is applied purely as extra classes via `inputGroupButtonVariants` and forwarded to the DOM as **`data-size`** (never as Button's `size`), so Button renders at its default size with compact overrides layered on, and CSS/consumers can target `[data-size=…]`.

## 5 Consumed tokens

- `input` — Root border (`border-input`), disabled fill (`has-disabled:bg-input/50`).
- `ring` — focus chrome re-derived on Root (`has-[[data-slot=input-group-control]:focus-visible]:border-ring …ring-3 …ring-ring/50`).
- `error` — invalid chrome (`has-[[data-slot][aria-invalid=true]]:border-error …ring-error/20`).
- `muted-foreground` — Addon and Text foreground.
- Radius: Root `rounded-md`; nested compact radii use the kept `calc(var(--radius)-5px)` arithmetic.

## 6 Data attributes

**Emitted**: `data-slot="input-group"` (Root), `"input-group-addon"` + `data-align` (Addon), `"input-group-text"` (Text — added, §8), `"input-group-control"` (Input/Textarea, overriding the primitives' own slot), `data-size` (Button).

**Consumed**: `[data-slot=input-group-control]:focus-visible` and `[data-slot][aria-invalid=true]` (Root chrome); `>[data-align=block-start/end]` and `>[data-align=inline-start/end]` (Root layout + input padding); `group-data-[disabled=true]/input-group` (Addon dimming); **`in-data-[slot=combobox-content]`** — focus-ring neutralization coupling: when an InputGroup sits inside combobox popup content, Root's focus-within border/ring is suppressed (`border-inherit ring-0`) because the popup owns the focus treatment; this couples InputGroup to the combobox's `data-slot="combobox-content"` contract. `InputGroup.Text`'s slot participates in the ButtonGroup `[data-slot]` sizing contract (§8).

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

Kept faithfully: Addon focus-sibling-input `onClick`; Button size re-typing via `data-size`; combobox-content ring neutralization; Input/Textarea chrome-stripping overrides (`rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0`, textarea additionally `resize-none py-2`).

## 9 Test requirements

- Root renders `getByRole("group")`; input reachable by role (with Field-provided or aria-label name).
- Addon click focuses the input (userEvent click on addon text → input has focus); clicking a button inside the addon does NOT move focus to the input and fires the button.
- Keyboard: Tab order is input → addon button (DOM order); focusing the input via keyboard sets `:focus-visible` on the control (assert via the control's `data-slot="input-group-control"` state, queries still role-based).
- `InputGroup.Button`: default `type="button"` (pressing Enter inside a form's group input does not trigger it); `data-size` reflects the size prop for all four values; Button's own `size` prop is not accepted (type-level test).
- `aria-invalid` on the control surfaces group invalid chrome (attribute assertion on control; chrome via state attr, not snapshot).
- `align` reflected as `data-align` for all four values; block alignments render Root as column.
- Disabled input dims the group (`has-disabled` state) and addon.

## 10 Demo requirements

Plain runnable `.tsx` demos: `input-group-icons.tsx` (leading MagnifyingGlass icon + trailing Text suffix), `input-group-buttons.tsx` (inline-end Button `xs`, `icon-xs` clear button), `input-group-block.tsx` (block-start label row + block-end helper row), `input-group-textarea.tsx` (Textarea control with block-end action bar), `input-group-invalid.tsx` (aria-invalid + disabled states), `input-group-kbd.tsx` (keyboard-shortcut kbd hint in an addon).
