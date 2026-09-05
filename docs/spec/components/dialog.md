# Dialog

## 1 Header

- **Canonical name**: `Dialog` (namespace compound)
- **Export path**: `@elmeragroup/ui/dialog` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/dialog.tsx`

## 2 Anatomy

| Part                 | Base                                       | Notes                                                                                            |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Dialog.Root`        | `DialogPrimitive.Root`                     | state owner (open/close, modality); renders no DOM; ref stamps `data-slot="dialog"` on it        |
| `Dialog.Trigger`     | `DialogPrimitive.Trigger`                  | opens the dialog                                                                                 |
| `Dialog.Portal`      | `DialogPrimitive.Portal`                   | exported for manual composition; `Dialog.Content` renders its own internally                     |
| `Dialog.Close`       | `DialogPrimitive.Close`                    | closes; also used internally for the corner close button and Footer's close button               |
| `Dialog.Overlay`     | `DialogPrimitive.Backdrop`                 | fixed scrim; auto-rendered by `Dialog.Content`                                                   |
| `Dialog.Content`     | `Portal > Overlay > DialogPrimitive.Popup` | centered popup surface; `size` axis; auto-renders the corner close button (`showCloseButton`)    |
| `Dialog.Header`      | `div`                                      | `flex flex-col gap-2`                                                                            |
| `Dialog.Footer`      | `div`                                      | `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`; optional built-in outline Close button |
| `Dialog.Title`       | `DialogPrimitive.Title`                    | `font-heading text-base leading-none font-medium text-balance`                                   |
| `Dialog.Description` | `DialogPrimitive.Description`              | muted `text-sm`, styles child `<a>` links (underline, hover foreground)                          |

```tsx
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content size="lg">
    <Dialog.Header>
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Supporting copy.</Dialog.Description>
    </Dialog.Header>
    …body…
    <Dialog.Footer showCloseButton>
      <Button>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

## 3 Props

**State classes:** `Dialog.Trigger`, `Dialog.Close`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Title`, `Dialog.Description` accept either a string or a callback receiving the current Base UI part state. Callback results are merged after library classes with the same conflict resolution as strings. Other parts retain their declared contracts; see [conventions](conventions.md#api-conventions).

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props.

**Dialog.Root** — `ComponentProps<DialogPrimitive.Root>` verbatim (`open`/`defaultOpen`/`onOpenChange`, `modal`, `disablePointerDismissal`, …). Primitive-tier naming per conventions.

**Dialog.Trigger / Dialog.Portal / Dialog.Close** — their base-ui part's props verbatim (all support `render` per useRender polymorphism).

**Dialog.Overlay** — `ComponentProps<DialogPrimitive.Backdrop>`.

**Dialog.Content** — `ComponentProps<DialogPrimitive.Popup>` + `VariantProps<dialogContentVariants>` plus:

| Prop              | Type                                            | Default                      | Notes                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`            | 13-value axis, see §4                           | `"md"`                       | max-width of the popup                                                                                                                                                                                                      |
| `showCloseButton` | `boolean`                                       | `true`                       | corner close button: `Dialog.Close` rendered as `Button variant="ghost" size="icon-sm"` with `hit-area-1 absolute top-4 right-4`, Phosphor `X` icon + locale-dictionary `closeLabel` as `aria-label` (no sr-only duplicate) |
| `container`       | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | forwarded to the internal Portal (§8)                                                                                                                                                                                       |
| `closeLabel`      | `string`                                        | locale dictionary            | accessible name for the built-in corner close button                                                                                                                                                                        |

`children` render before the corner close button inside the Popup.

**Dialog.Header** — `ComponentProps<"div">`.

**Dialog.Footer** — `ComponentProps<"div">` plus:

| Prop              | Type      | Default           | Notes                                                                                                                              |
| ----------------- | --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `showCloseButton` | `boolean` | `false`           | appends `Dialog.Close` rendered as `Button variant="outline"` with the resolved `closeLabel` as visible children, after `children` |
| `closeLabel`      | `string`  | locale dictionary | visible text for the built-in footer close action                                                                                  |

Footer's `showCloseButton` is a different job from Content's (a footer action, not the corner dismiss affordance); both stay.

**Dialog.Title / Dialog.Description** — their base-ui part's props verbatim.

## 4 Variants

`dialogContentVariants` — `tv` recipe, **module-private** (no borrow pattern; not exported).

`Dialog.Trigger` and a directly rendered public `Dialog.Close` compose shared `focusRing({ target: "self" })`. Close controls rendered through `Button` use Button's identical adapter; `cn` deduplicates the classes.

- Base: the shared overlay popup surface (`bg-popover text-popover-foreground` + `ring-1 ring-foreground/10`, its `md` elevation and radius rungs raised here to `shadow-lg rounded-xl`) plus `fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100%-2rem)] w-full max-w-(--overlay-width) -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto p-6 text-sm duration-100`, the shared self-target focus ring, and the enter/exit animation classes (§6). The rendered class set is unchanged from the hand-written form except the width consumer (§8.12). _(Amended 2026-09-04; §8.12.)_ The static one-pixel hairline remains when unfocused; the canonical two-pixel offset ring wins on keyboard-visible focus.
- Axis `size` (13 values, default `"md"`): `sm | md | lg | xl | 2xl | 3xl | 4xl | 5xl | 6xl | 7xl` map to `[--overlay-width:min(var(--container-*),90%)]`; the top three are hardcoded pixel caps — `8xl` → `min(1366px,90%)`, `9xl` → `min(1536px,90%)`, `10xl` → `min(1920px,90%)` (no `--container-8xl+` vars exist; kept as literals, documented). The axis is the package-private `overlaySizeVariants` recipe; Dialog composes `overlaySizeVariants.variants.size`. The popup reads the cap through `max-w-(--overlay-width)` on the recipe base; Sheet reads the same 13-row table (sheet.md §4). _(Amended 2026-09-04; §8.12.)_

Animation strategy: **keyframe-based** (`tw-animate-css`) — `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` / `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`, `duration-100`. Contrast with Sheet, which is transition-based (see sheet spec §4).

## 5 Consumed tokens

- `popover` / `popover-foreground` — popup surface and text. The fill, edge, and composed surface are slots of the package-private overlay popup recipe (`overlayPopupFillClass` / `overlayPopupEdgeClass` / `overlayPopupSurfaceClass` from the `fill` / `edge` / `surface` slots); Dialog composes the `surface` slot and raises elevation and radius through `cn`. _(Amended 2026-09-04.)_
- `foreground/10` — popup hairline (`ring-1`).
- `muted-foreground` — Description text; `foreground` — Description link hover.
- Overlay scrim is **literal `bg-black/10`** + `supports-backdrop-filter:backdrop-blur-xs` — deliberately not tokenized yet; a dark-mode-ready `--overlay` token is a roadmap item (§8).
- Corner close button consumes Button ghost tokens.
- `ring` + `background` — Trigger, Content fallback target, and directly rendered Close focus treatment.
- Radii: popup `rounded-xl` — `--radius` scale step, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `dialog` (Root) · `dialog-trigger` · `dialog-portal` · `dialog-close` · `dialog-overlay` · `dialog-content` · `dialog-header` · `dialog-footer` · `dialog-title` · `dialog-description`. The Content-internal corner close button also emits `data-slot="dialog-close"` (same value as the standalone part — faithful to ref). Footer's built-in Close button emits no `data-slot`.

**Emitted (by base-ui, styled by us)**: `data-open` / `data-closed` on Popup and Backdrop.

**Consumed selectors**: `data-open:animate-in …` / `data-closed:animate-out …` on Content and Overlay. These are the self-scoped custom variants from conventions and stay on the elements that own the attributes (Popup/Backdrop themselves). Dialog is not an anchored popup, so it does **not** compose the overlay popup recipe's `motion` / `duration` slots (`overlayPopupMotionClass` / `overlayPopupDurationClass`); its `duration-100` and fade/zoom keyframes stay local beside Content. The recipe's motion set is for the timed anchored popups (popover.md §6). _(Amended 2026-09-04.)_

## 7 Accessibility

- Base-ui wires `role="dialog"`, `aria-modal`, `aria-labelledby` → `Dialog.Title`, `aria-describedby` → `Dialog.Description`, and trigger `aria-haspopup`/`aria-expanded`/`aria-controls`.
- Focus is trapped inside the popup while open; on open, focus moves into the popup; on close, focus returns to the trigger.
- Keyboard: Escape closes unless the consumer cancels it (`onOpenChange(open, eventDetails)` → `eventDetails.cancel()` when `eventDetails.reason === "escape-key"`); Tab cycles within the trap.
- Backdrop click dismisses unless `disablePointerDismissal` is set (base-ui defaults; `modal` also governs outside interaction).
- Corner close button carries the localized `closeLabel` as `aria-label` and a `hit-area-1` expanded hit target. _(Amended 2026-09-02 — one accessible name; the sr-only span is dropped.)_
- Consumers should always render `Dialog.Title` (base-ui warns otherwise); `Dialog.Description` is optional but recommended.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Dialog`→`Dialog.Root`, `DialogTrigger`→`Dialog.Trigger`, `DialogPortal`→`Dialog.Portal`, `DialogClose`→`Dialog.Close`, `DialogOverlay`→`Dialog.Overlay`, `DialogContent`→`Dialog.Content`, `DialogHeader`→`Dialog.Header`, `DialogFooter`→`Dialog.Footer`, `DialogTitle`→`Dialog.Title`, `DialogDescription`→`Dialog.Description`.
2. **Overlay `container` prop added (mandated)** to `Dialog.Content` — forwarded to the internal `DialogPrimitive.Portal`, defaulting to the nearest `ThemeScope` element (portal-inside-ThemeScope discipline). The ref hardcodes `<DialogPortal>` with **nothing forwarded** — no way to retarget the portal without recomposing Content manually; this gap is closed.
3. **Close-button unification**: the corner close button (Button ghost `icon-sm` + `aria-label` + `hit-area-1`) becomes the **shared** close-button rendering also used by `Sheet.Content` (Dialog's pattern wins; see sheet spec §8). _(Amended 2026-09-02 — `aria-label` only; the sr-only span is dropped so assistive tech receives one name.)_
4. **z-index deduped**: the ref stamps `z-50` on both Overlay and Popup. One `z-50` at the outermost layer per overlay; within it, DOM order stacks Backdrop under Popup. The flat z-50 strategy (every overlay component at the same level, DOM-order stacking) is deliberate and documented. The class is the overlay module's `overlayLayer` constant, spelled once; the popup recipe's `positioner` slot interpolates it rather than restating it. _(Amended 2026-09-04.)_
5. **Icons → Phosphor**: `XIcon` (lucide) → `X`.
6. **Overlay scrim** stays literal `bg-black/10` (matches ref); flagged as the one deliberate primitive-color exception, with a dark-mode token migration on the roadmap.
7. `dialogContentVariants` stays **private** (ref does not export it; no borrow pattern).
8. **Focus unified:** public Trigger/Close parts compose the canonical self-focus adapter; built-in Close buttons inherit the same adapter from Button.
9. **Shared overlay spine adopted**: `Dialog.Content` composes the package-private overlay primitives instead of restating them — `OverlayPortal` for the theming.md §7.4 portal-target resolution, `OverlayContainerProps` for the `container` prop, `overlayPopupSurfaceClass` (the overlay popup recipe's `surface` slot: fill + edge + the `md` radius rung) for the fill/ring/radius, and `selfFocusRingClass` for the ring. The rendered class set, prop names, documented defaults, and DOM are unchanged. Dialog is **not** a consumer of `overlayPopupMotionClass`/`overlayPopupDurationClass`: it is not an anchored popup, so it takes neither the transform origin nor the per-side slide-ins that class carries, and its `duration-100` stays local beside the keyframes it times. _(Amended 2026-09-04.)_
10. **Popup fallback focus fixed:** the ref's unconditional Content `outline-none` becomes the canonical self-focus adapter. Base-ui normally focuses the first tabbable descendant; when none exists it focuses the popup fallback, which must retain a visible keyboard indicator.

11. **Close copy comes from the shared overlay `close` row**: `Dialog.Content` and `Dialog.Footer` read `overlayCloseStrings` from `components/overlay/intl` instead of a Dialog-local `intl/` directory. Dialog is one of four readers of that family-owned row, not its owner — Sheet, Toast, and the package-private `react-aria/internal/dialog.tsx` picker dialog read it too, and the last of those already resolved its label from Dialog's dictionary before this change. The four rendered strings, the `closeLabel` override precedence, and the DOM are unchanged; only the module the copy is authored in moves (accessibility.md §4.1, amended 2026-09-03). _(Amended 2026-09-03 — ADR [0006](../../adr/0006-intl-strings.md), amendment 2026-09-03; **pending owner confirmation**; the alternative not taken was keeping a Dialog-local `close` row built through `createStringDictionary`.)_
12. **One overlay width table**: `Dialog.Content` reads `overlaySizeVariants` (`[--overlay-width:…]`, composed via `overlaySizeVariants.variants.size`) and caps the popup with `max-w-(--overlay-width)` on the recipe base — the same 13-row table Sheet reads (sheet.md §8.13). Option A over B because Sheet already consumed a width variable; Dialog taking the same consumer leaves one table and the used max-width per rung unchanged. The alternative (plain `max-w-*` on both, plus three `max-w-none` negations on Sheet) would still special-case Sheet's gates as a second spelling of the cap. _(Added 2026-09-04. Amended 2026-09-04: the table is the `overlaySizeVariants` recipe.)_

Kept faithfully: the 13-value size axis incl. hardcoded 8xl–10xl pixel caps and default `md`; `showCloseButton` defaults (`true` on Content, `false` on Footer); Footer's outline close action; `duration-100` keyframe animations; `max-h-[calc(100%-2rem)]` + `overflow-y-auto` scroll containment; Description's child-link styling; Overlay `isolate` + backdrop blur. Divergence: both built-in close affordances use the provider-locale dictionary and optional `closeLabel` override instead of literal English.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Open/close: click trigger → `getByRole("dialog")` appears; Escape closes and returns focus to the trigger; `onOpenChange` fires.
- Focus trap: on open, focus lands inside the popup; Tab from the last tabbable wraps to the first; Shift+Tab wraps backwards; focus never escapes to the page behind.
- With no tabbable descendant, the popup itself receives fallback focus and renders the canonical focus ring.
- Labeling: `Dialog.Title` names the dialog (`getByRole("dialog", { name })`); `Dialog.Description` is wired via `aria-describedby` (attribute assertion).
- Close affordances: under the `en-US` provider, the corner button (`getByRole("button", { name: "Close" })`) closes; `showCloseButton={false}` removes it; Footer `showCloseButton` renders an outline button carrying the resolved locale label and closes.
- Close affordances render and operate in all four locales; `closeLabel` overrides dictionary copy on Content and Footer.
- `size`: at a 1280px viewport the dialog popup's used width follows the overlay axis sample (`sm` < default `md` < `10xl`); the `--overlay-width` class strings live in the overlay unit recipe test. _(Amended 2026-09-04; §8.12. Amended 2026-09-04 — spec 07 / [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md): browser asserts used width, not the class string.)_
- `container`: popup renders inside the provided element / nearest ThemeScope, not `document.body`.
- Non-dismissible dialog (`disablePointerDismissal` plus cancelling the `escape-key` reason in `onOpenChange`): Escape and backdrop click do not close.
- Type tests (`*.test-d.tsx`, tooling §7.3): the namespace ships all ten parts from `@elmeragroup/ui/dialog` and the root barrel; `DialogContentProps["size"]` is exactly the 13-value overlay axis; `showCloseButton` / `closeLabel` are on both `Content` and `Footer`; parts take `useRender`'s `render` and never an `as` prop _(Added 2026-09-03 — [ADR 0008](../../adr/0008-tests-assert-behaviour-not-source-spelling.md).)_

## 10 Demo requirements

Plain runnable `.tsx` demos: `dialog-basic.tsx` (Trigger, Title, Description, Footer with actions), `dialog-sizes.tsx` (size axis sampler incl. an `8xl+` value), `dialog-footer-close.tsx` (Footer `showCloseButton` next to a primary action), `dialog-no-close-button.tsx` (`showCloseButton={false}`, explicit `Dialog.Close` in the body), `dialog-scrolling.tsx` (long content exercising `max-h` + internal scroll).
