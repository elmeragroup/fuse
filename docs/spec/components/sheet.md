# Sheet

## 1 Header

- **Canonical name**: `Sheet` (namespace compound)
- **Export path**: `@elmeragroup/ui/sheet` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/sheet.tsx`

## 2 Anatomy

Built on **`@base-ui/react/drawer`** (not Dialog): a dialog with swipe-to-dismiss. This choice imposes real structure — a `Viewport` layer, a `VirtualKeyboardProvider`, and inline swipe transforms — all documented below.

| Part                | Base                                                                                       | Notes                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `Sheet.Root`        | `SheetSideContext.Provider > SheetPrimitive.Root > SheetPrimitive.VirtualKeyboardProvider` | owns `side`; derives `swipeDirection`; `VirtualKeyboardProvider` **must** sit inside `Root` — it reads Root's dialog store |
| `Sheet.Trigger`     | `SheetPrimitive.Trigger`                                                                   | opens                                                                                                                      |
| `Sheet.Close`       | `SheetPrimitive.Close`                                                                     | closes                                                                                                                     |
| `Sheet.Portal`      | `SheetPrimitive.Portal`                                                                    | exported for manual composition; `Sheet.Content` renders its own internally                                                |
| `Sheet.Overlay`     | `SheetPrimitive.Backdrop`                                                                  | fixed scrim; auto-rendered by `Sheet.Content`                                                                              |
| `Sheet.Content`     | `Portal > Overlay > Viewport > Popup > SheetPrimitive.Content`                             | panel; reads side from context, re-emits `data-side`; auto-renders the corner close button                                 |
| `Sheet.Header`      | `div`                                                                                      | `flex flex-col gap-1.5 px-4 pt-4`                                                                                          |
| `Sheet.Body`        | `div`                                                                                      | `min-h-0 flex-1 space-y-6 overflow-y-auto px-4` — the scroll container                                                     |
| `Sheet.Footer`      | `div`                                                                                      | `mt-auto flex flex-col gap-2 p-4`                                                                                          |
| `Sheet.Title`       | `SheetPrimitive.Title`                                                                     | `font-heading text-xl font-medium text-balance text-foreground`                                                            |
| `Sheet.Description` | `SheetPrimitive.Description`                                                               | muted `text-base text-pretty`                                                                                              |

Inside Content, `SheetPrimitive.Popup` (slot `sheet-content`) carries positioning/animation; `SheetPrimitive.Content` (slot `sheet-content-inner`, `flex h-full w-full flex-col gap-4`) is the drawer's swipeable content region wrapping `children` + close button. Both layers are load-bearing.

```tsx
<Sheet.Root side="right">
  <Sheet.Trigger>Open</Sheet.Trigger>
  <Sheet.Content size="lg">
    <Sheet.Header>
      <Sheet.Title>Details</Sheet.Title>
      <Sheet.Description>Supporting copy.</Sheet.Description>
    </Sheet.Header>
    <Sheet.Body>…</Sheet.Body>
    <Sheet.Footer>
      <Button>Save</Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
```

## 3 Props

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props.

**Sheet.Root** — `Omit<ComponentProps<SheetPrimitive.Root>, "swipeDirection" | "children">` plus:

| Prop       | Type                                     | Default   | Notes                                                                                                                                                                         |
| ---------- | ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `side`     | `"top" \| "right" \| "bottom" \| "left"` | `"right"` | placed in `SheetSideContext`; also mapped through `SIDE_TO_SWIPE_DIRECTION` (`top→"up"`, `right→"right"`, `bottom→"down"`, `left→"left"`) to the primitive's `swipeDirection` |
| `children` | `ReactNode`                              | —         | re-typed because they are wrapped in `VirtualKeyboardProvider`                                                                                                                |

`swipeDirection` is **deliberately omitted** from the public props — it is coupled to `side` and must never diverge (swiping toward the panel's edge dismisses it). This side-in-context mechanism is the component's spine: Root broadcasts `side`, Content consumes it and re-emits `data-side` for styling.

**Sheet.Trigger / Sheet.Close / Sheet.Portal / Sheet.Overlay** — their base-ui part's props verbatim.

**Sheet.Content** — `ComponentProps<SheetPrimitive.Popup>` + `VariantProps<sheetContentVariants>` plus:

| Prop              | Type                                            | Default                      | Notes                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `size`            | 13-value axis, see §4                           | `"md"`                       | max-width; only affects `left`/`right` sides at the `sm:` breakpoint and up                                                                                                                                                          |
| `showCloseButton` | `boolean`                                       | `true`                       | shared close-button rendering (§8): `Sheet.Close` rendered as `Button variant="ghost" size="icon-sm"` with `hit-area-1 absolute top-4 right-4`, Phosphor `X` + locale-dictionary `closeLabel` as `aria-label` (no sr-only duplicate) |
| `closeLabel`      | `string`                                        | locale dictionary            | accessible name for the built-in close button                                                                                                                                                                                        |
| `container`       | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | forwarded to the internal Portal (§8)                                                                                                                                                                                                |

**Sheet.Header / Body / Footer** — `ComponentProps<"div">`.
**Sheet.Title / Sheet.Description** — their base-ui part's props verbatim.

## 4 Variants

`sheetContentVariants` — `tv` recipe, **module-private** (not exported).

`Sheet.Trigger` and a directly rendered public `Sheet.Close` compose shared `focusRing({ target: "self" })`. The built-in corner close control renders through Button and therefore uses Button's identical adapter.

- Base: the shared overlay popup fill (`bg-popover text-popover-foreground` — Sheet takes the fill only; it paints no ring and its own `shadow-lg`) plus `pointer-events-auto fixed bg-clip-padding text-sm shadow-lg` (no `z-50` — the Popup sits inside the Viewport, which carries the level; §8.6) + per-side positioning (`data-[side=right]:inset-y-0 right-0 h-full w-full border-l`, mirrored for left/top/bottom; top/bottom are `inset-x-0 h-auto` with `border-b`/`border-t`) + the transition/swipe classes below.
- Axis `size` (13 values, default `"md"`): same scale as Dialog — `sm…7xl` → `min(var(--container-*),90%)`, `8xl` → `min(1366px,90%)`, `9xl` → `min(1536px,90%)`, `10xl` → `min(1920px,90%)`. Each rung is **one declaration**, `[--sheet-width:…]`, typed `satisfies Record<OverlaySize, string>` against the shared overlay width axis; the two gated consumers `data-[side=left]:sm:max-w-(--sheet-width)` and `data-[side=right]:sm:max-w-(--sheet-width)` live once in the recipe base instead of once per rung. Below the `sm:` breakpoint, and always for `top`/`bottom` sides, the panel is full-width (`w-full`) and `size` is inert. _(Amended 2026-09-03; §8.11 — the used width per rung is unchanged; the emitted class set is not.)_

**Animation strategy: transitions, not keyframes** — and this must not be "cleaned up". Base-ui's Drawer writes inline transform via `--drawer-swipe-movement-x/-y` while the user swipes; the resting transform classes defer to those vars (`data-[side=right]:[transform:translateX(var(--drawer-swipe-movement-x,0px))]` etc.), so the same `transform` property serves swipe-follow, enter, and exit. A keyframe animation would fight the inline swipe transform. Mechanics:

- Enter/exit: `data-starting-style:`/`data-ending-style:` set the off-screen transform per side (`translateX(±100%)` / `translateY(±100%)`); `transition-transform duration-200 ease-out` animates in.
- Exit easing scales with fling strength: `data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*150ms)] data-ending-style:ease-[cubic-bezier(0.23,1,0.32,1)]`.
- While swiping, transitions are off: `data-swiping:transition-none` (panel and overlay both) so the panel tracks the finger 1:1.
- **`--drawer-swipe-movement-*` vars must not be refactored away** — they are the contract with the primitive.

**Pointer-events viewport hack**: `SheetPrimitive.Viewport` renders `fixed inset-0 z-50` with `pointer-events-none`, and the Popup restores `pointer-events-auto`. The Viewport must span the screen for the drawer's swipe geometry, but must not eat clicks outside the panel (the Backdrop owns those). Kept verbatim.

## 5 Consumed tokens

- `popover` / `popover-foreground` — panel surface and text (`bg-clip-padding` keeps the border crisp).
- `border` — the single side border (`border-l`/`border-r`/`border-t`/`border-b`) via default border color.
- `foreground` / `muted-foreground` — Title / Description.
- Overlay scrim is **literal `bg-black/10`** + backdrop blur — same deliberate exception as Dialog; dark-mode token on the roadmap (§8).
- Close button consumes Button ghost tokens (§8 unification).
- `ring` + `background` — Trigger and directly rendered Close focus treatment.
- No radius: sheets are edge-anchored and square by design.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `sheet` (Root, §8) · `sheet-trigger` · `sheet-close` · `sheet-portal` · `sheet-overlay` · `sheet-viewport` · `sheet-content` (Popup) · `sheet-content-inner` (drawer Content) · `sheet-header` · `sheet-body` · `sheet-footer` · `sheet-title` · `sheet-description`. The internal close button also emits `data-slot="sheet-close"`. Plus `data-side="top|right|bottom|left"` on the Popup — the context re-emission every side-conditional class keys off.

**Emitted (by base-ui, styled by us)**: `data-starting-style`, `data-ending-style`, `data-swiping` (Popup and Backdrop); `--drawer-swipe-movement-x/-y`, `--drawer-swipe-strength` inline vars.

**Consumed selectors**: all `data-[side=…]:` positioning/transform/border/size classes on the Popup; `data-swiping:transition-none` and `data-starting-style/ending-style:opacity-0` on the Overlay (`transition-opacity duration-150`).

## 7 Accessibility

- Base-ui Drawer wires `role="dialog"`, `aria-modal`, `aria-labelledby` → `Sheet.Title`, `aria-describedby` → `Sheet.Description`, focus trap, and trigger wiring — same contract as Dialog.
- Keyboard: Escape closes; Tab cycles within the trap; focus returns to the trigger on close.
- Touch: swipe toward the anchored edge dismisses (direction locked to `side`); partial swipes spring back; fling strength shortens the exit.
- `VirtualKeyboardProvider` keeps the panel usable when the on-screen keyboard appears (mobile forms in sheets).
- Corner close button carries localized `closeLabel` as `aria-label` + `hit-area-1`. _(Amended 2026-09-02 — one accessible name; the sr-only span is dropped.)_
- `Sheet.Body` is the scroll container (`overflow-y-auto`), keeping Header/Footer pinned for long content.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Sheet`→`Sheet.Root`, `SheetTrigger`→`Sheet.Trigger`, `SheetClose`→`Sheet.Close`, `SheetPortal`→`Sheet.Portal`, `SheetOverlay`→`Sheet.Overlay`, `SheetContent`→`Sheet.Content`, `SheetHeader`→`Sheet.Header`, `SheetBody`→`Sheet.Body`, `SheetFooter`→`Sheet.Footer`, `SheetTitle`→`Sheet.Title`, `SheetDescription`→`Sheet.Description`.
2. **Overlay `container` prop added (mandated)** to `Sheet.Content` — forwarded to the internal `SheetPrimitive.Portal`, defaulting to the nearest `ThemeScope` element (portal-inside-ThemeScope discipline). The ref hardcodes `<SheetPortal>` with nothing forwarded.
3. **Close-button unification**: the ref hand-rolls the corner close button as raw `SheetPrimitive.Close` markup (`inline-flex size-8 … opacity-70 hover:opacity-100 focus-visible:ring-[3px] … active:scale-[0.96]`) — duplicating Button's focus/active styles by hand. Replaced with the **shared** close-button rendering from Dialog (`Button variant="ghost" size="icon-sm"` render + `aria-label` + `hit-area-1`). Minor visual delta (ghost hover surface instead of opacity fade) accepted for one canonical close button. _(Amended 2026-09-02 — `aria-label` only; the sr-only span is dropped.)_
4. **Localized close label:** built-in copy comes from `sheet.close`; `closeLabel` overrides it.
5. **`data-slot="sheet"` added to `Sheet.Root`** — the ref omits it (every other Root in the family stamps its slot; consistency fix).
6. **z-index deduped**: the ref stamps `z-50` on Overlay, Viewport, **and** Popup (triple). The Popup stamp is dropped; the two remaining stamps are the shared `overlayLayer` constant on the Backdrop and on the Viewport — Sheet's two outermost portalled siblings, which both need the level because neither contains the other. DOM order stacks Backdrop < Viewport, and the Popup inherits from the Viewport. Flat z-50 strategy (all overlays at one level, DOM-order stacking) is deliberate. _(Amended 2026-09-03 — this entry and §4 said one stamp; two ship, one per portalled sibling.)_
7. **Icons → Phosphor**: `XIcon` → `X`.
8. **Overlay scrim** stays literal `bg-black/10` (matches ref); dark-mode token migration on the roadmap.
9. `sheetContentVariants` stays **private**.
10. **Focus unified:** public Trigger/Close parts compose the canonical self-focus adapter; the built-in Close button inherits it from Button.
11. **Shared overlay spine adopted, and the width axis moves to one CSS variable per rung**: `Sheet.Content` composes `useResolvedPortalContainer` (theming.md §7.4), `OverlayContainerProps` (whose shared sentence replaces Sheet's near-identical `container` wording in the published prop table), `overlayPopupFillClass` and `selfFocusRingClass`; the local `sheetLayer` alias for `overlayLayer` is gone. Sheet takes the **fill only**, not the composed popup surface — it paints `shadow-lg` and per-side borders rather than the surface's `shadow-md ring-1 ring-foreground/10`, and a ring it never wanted cannot be subtracted later (tailwind-merge treats ring width and ring colour as separate conflict groups). The `size` axis is retyped `satisfies Record<OverlaySize, string>` and each rung now sets `--sheet-width`, which is the one deliberate **class-set** change in this migration: the used max-width per rung, per side, per breakpoint is identical, and §9 asserts the resolved width rather than the class spelling. _(Amended 2026-09-03.)_

Kept faithfully: Drawer foundation with `Viewport` + `VirtualKeyboardProvider`-inside-Root; `side` default `"right"`; `SIDE_TO_SWIPE_DIRECTION` coupling with `swipeDirection` omitted from props; the entire transition-based animation strategy incl. `--drawer-swipe-movement-*` deference, `--drawer-swipe-strength` exit duration, and `data-swiping:transition-none`; the pointer-events viewport hack; size gating to left/right at `sm:`; Header/Body/Footer padding split (Body owns scroll); Title `text-xl` (larger than Dialog's `text-base`).

## 9 Test requirements

Role/label-based queries throughout. **Swipe-to-dismiss per side is not unit-testable** (pointer-capture gesture physics in the Drawer primitive; jsdom and even browser-mode synthetic events don't exercise it) — what IS tested instead:

- `Sheet.Root side` maps to the Popup's `data-side` attribute for all four values, and `swipeDirection` is asserted structurally (the primitive receives the mapped direction — via the `SIDE_TO_SWIPE_DIRECTION` table, unit-tested as a pure map).
- Open/close: trigger click → `getByRole("dialog")`; Escape closes and restores trigger focus; `onOpenChange` fires.
- Focus trap: focus enters on open, Tab wraps, never escapes.
- Labeling: Title names the dialog; Description wired via `aria-describedby`.
- Close: under the `en-US` provider, the corner button (`getByRole("button", { name: "Close" })`) closes; `showCloseButton={false}` removes it; explicit `Sheet.Close` works.
- The built-in close button renders in all four locales and respects `closeLabel`.
- Layout: `Sheet.Body` has the scroll-container classes; `data-slot` attributes present incl. `sheet` on Root's primitive and `sheet-viewport`.
- `size`: at a ≥`sm` viewport the panel's resolved content width equals `min(<rung>, 90% of the viewport)` for a sample (`sm`, `md`, `10xl`) on a left/right side, and `max-width` stays `none` on `top`/`bottom` — the axis is asserted through the used value, so the `--sheet-width` indirection is covered rather than a class spelling. _(Amended 2026-09-03; §8.11.)_
- `container`: panel renders inside the provided element / nearest ThemeScope, not `document.body`.

## 10 Demo requirements

Plain runnable `.tsx` demos: `sheet-basic.tsx` (right side, Header/Body/Footer), `sheet-sides.tsx` (all four `side` values, shows swipe direction per side on touch), `sheet-sizes.tsx` (size axis on `side="right"`, plus one `top` sheet showing size inertness), `sheet-form.tsx` (form in Body exercising VirtualKeyboardProvider on mobile), `sheet-scrolling.tsx` (long Body content, pinned Header/Footer).
