# Popover

## 1 Header

- **Canonical name**: `Popover` (namespace compound)
- **Export path**: `@elmeragroup/ui/popover` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/popover.tsx`

## 2 Anatomy

| Part                  | Base                           | Notes                                                                               |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `Popover.Root`        | `PopoverPrimitive.Root`        | bare re-export; open-state owner, no DOM of its own                                 |
| `Popover.Trigger`     | `PopoverPrimitive.Trigger`     | bare re-export; anchor button                                                       |
| `Popover.Content`     | `Portal > Positioner > Popup`  | popup surface (`w-72 p-4`, flex column, `gap-4`); optional `Arrow` when `showArrow` |
| `Popover.Header`      | plain `div`                    | `flex flex-col gap-1 text-sm`; groups Title + Description                           |
| `Popover.Title`       | `PopoverPrimitive.Title`       | `font-medium text-balance`; wired as the popup's accessible name                    |
| `Popover.Description` | `PopoverPrimitive.Description` | `text-pretty text-muted-foreground`; wired as accessible description                |

```tsx
<Popover.Root>
  <Popover.Trigger render={<Button variant="outline" />}>Details</Popover.Trigger>
  <Popover.Content>
    <Popover.Header>
      <Popover.Title>Dimensions</Popover.Title>
      <Popover.Description>Set the dimensions for the layer.</Popover.Description>
    </Popover.Header>
    …
  </Popover.Content>
</Popover.Root>
```

The internal `Portal`, `Positioner`, `Popup` and `Arrow` parts are not exported (matching the ref, which also keeps them internal); `Popover.Content` is the only composition point for them (§8).

## 3 Props

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props (incl. `render` per conventions).

**Popover.Root** — `ComponentProps<PopoverPrimitive.Root>` verbatim (`open`/`defaultOpen`/`onOpenChange`, `modal`, `openOnHover`/`delay`/`closeDelay`, …). Primitive-tier naming.

**Popover.Trigger** — `ComponentProps<PopoverPrimitive.Trigger>` verbatim (`disabled`, `nativeButton`, `render`, …).

**Popover.Content** — `ComponentProps<PopoverPrimitive.Popup>` plus `Pick<ComponentProps<PopoverPrimitive.Positioner>, "align" | "alignOffset" | "side" | "sideOffset">` (destructured and forwarded to the internal Positioner) plus:

| Prop          | Type                                    | Default                      | Notes                                                    |
| ------------- | --------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `align`       | Positioner `align`                      | `"center"`                   |                                                          |
| `alignOffset` | `number`                                | `0`                          |                                                          |
| `side`        | Positioner `side`                       | `"bottom"`                   |                                                          |
| `sideOffset`  | `number`                                | `4`                          |                                                          |
| `showArrow`   | `boolean`                               | `false`                      | renders `PopoverPrimitive.Arrow` after `children`        |
| `container`   | `HTMLElement \| RefObject<HTMLElement>` | nearest `ThemeScope` element | forwarded to the internal `PopoverPrimitive.Portal` (§8) |

**Popover.Header** — `ComponentProps<"div">`.
**Popover.Title** / **Popover.Description** — their base-ui part's props verbatim.

## 4 Variants

No component-specific `tv` recipe and no variant axes — Content styling is inline; Trigger and the Popup both compose shared `focusRing({ target: "self" })`. `showArrow` is a boolean render toggle, not a styling variant.

## 5 Consumed tokens

- `popover` / `popover-foreground` — popup surface and text (`bg-popover text-popover-foreground`).
- `ring-foreground/10` — popup hairline (`ring-1`), paired with `shadow-md`.
- `muted-foreground` — Description text.
- `ring` + `background` — Trigger and Popup focus treatment.
- `popover` + `border` — arrow fill and edge (`before:bg-popover before:border-border`), matching the popup surface (§8; ref uses raw `bg-white` / `dark:` neutrals).
- Radii: popup `rounded-md` — `--radius`-derived scale step, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `popover` · `popover-trigger` · `popover-content` · `popover-header` · `popover-title` · `popover-description` (Root's lands on the trigger-side DOM base-ui renders; Root itself has no element).

**Emitted (by base-ui, styled by us)**: `data-open` / `data-closed` and `data-side` on the popup; `data-side` on the arrow; `data-popup-open` on the trigger (available, unstyled).

**Consumed selectors**:

- Popup: `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`, `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`, `data-[side=bottom|top|left|right|inline-start|inline-end]:slide-in-from-*`, `duration-100`, `origin-(--transform-origin)`. Bare `data-open:`/`data-closed:` are self-scoped custom variants and stay on the popup that emits the state.
- Arrow: `data-[side=bottom]:top-[-6px]`, `data-[side=top]:bottom-[-6px] rotate-180`, `data-[side=left]:right-[-9px] rotate-90`, `data-[side=right]:left-[-9px] -rotate-90` — the arrow flips per placement. Geometry kept from the ref: a `h-1.5 w-3 overflow-clip` window over a rotated `before:` square sized `calc(6px*sqrt(2))` so the diagonal spans the window exactly.

## 7 Accessibility

- Base-ui wires `aria-haspopup="dialog"` + `aria-expanded`/`aria-controls` on the trigger and `role="dialog"` on the popup; `Popover.Title`/`Popover.Description` wire `aria-labelledby`/`aria-describedby` onto the popup automatically.
- Keyboard: Enter/Space on the trigger opens; Escape closes and returns focus to the trigger; focus moves into the popup on open (first tabbable) and is returned on close.
- Outside press dismisses (light-dismiss); the popup traps focus only when `modal` is set on the Root.
- Per conventions, boolean aria uses `x || undefined`.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Popover`→`Popover.Root`, `PopoverTrigger`→`Popover.Trigger`, `PopoverContent`→`Popover.Content`, `PopoverHeader`→`Popover.Header`, `PopoverTitle`→`Popover.Title`, `PopoverDescription`→`Popover.Description`.
2. **Overlay `container` prop added (mandated)** to `Popover.Content`, forwarded to the internal `PopoverPrimitive.Portal`, defaulting to the nearest `ThemeScope` element. The ref hardcodes the portal with no target (→ `document.body`) and does not export a Portal part at all — `container` on Content is therefore the _only_ portal-control surface; documented as intentional (Portal/Positioner/Popup stay unexported here too).
3. **Arrow tokenized (LOCKED ruling)**: the ref arrow hardcodes `before:bg-white` plus `dark:before:border-white dark:before:bg-neutral-950` — raw palette colors, the family's worst `no-primitive-colors` violation, and mismatched with the token-driven `bg-popover` popup it decorates. Re-expressed as `before:bg-popover before:border-border` so the arrow always matches its popup across all 20 themes; the `sqrt(2)` clip-window geometry is kept verbatim. All `dark:` classes dropped per conventions. `showArrow` stays default `false`. Deliberately _not_ unified with Tooltip's always-rendered arrow — the two components' differing arrow show-behavior is intentional (see tooltip.md §8).
4. **`z-50` deduped**: the ref sets `isolate z-50` on the Positioner _and_ `z-50` on the Popup; kept on the outermost layer (Positioner) only. Flat z-strategy: every overlay gets exactly one `z-50` at its outermost portalled element.
5. **Focus unified:** Trigger and the Popup compose the canonical self-focus adapter, including when the Trigger is rendered without a Button target. The Popup does not use `outline-hidden`. _(Amended 2026-09-02.)_

Kept faithfully: `w-72 p-4 gap-4` popup dimensions; `shadow-md` + `ring-1 ring-foreground/10` elevation; `duration-100` animation timing and the full slide/fade/zoom class set; `Header` as a plain unstyled-primitive div; `showArrow` default `false`; Title/Description typography.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Open/close: click on `getByRole("button")` trigger opens `getByRole("dialog")`; Escape closes and returns focus to the trigger; outside press (pointerdown outside the popup) closes.
- Focus management: on open, focus lands inside the popup; on close (Escape and outside press), focus returns to the trigger. When the popup itself is the keyboard focus target, the shared focus ring is visible (and absent on mouse focus).
- Naming: with `Popover.Title` / `Popover.Description`, the dialog is queryable via `getByRole("dialog", { name })` and exposes the description text via `toHaveAccessibleDescription`.
- `showArrow`: arrow element absent by default; present (with `data-side` mirroring placement) when `showArrow` is set.
- Positioner forwarding: `side`/`align` overrides surface as `data-side` on the popup.
- `container`: popup renders inside the provided element / nearest ThemeScope, not `document.body`.
- Controlled: `open` + `onOpenChange` round-trips on trigger click and Escape.

## 10 Demo requirements

Plain runnable `.tsx` demos: `popover-basic.tsx` (trigger + Header/Title/Description + a small form body), `popover-arrow.tsx` (`showArrow` across `side="top" | "bottom" | "left" | "right"`), `popover-placement.tsx` (align/offset combinations), `popover-controlled.tsx` (external open state with a programmatic close button).
