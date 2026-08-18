# Dialog

## 1 Header

- **Canonical name**: `Dialog` (namespace compound)
- **Export path**: `@elmeragroup/ui` (`import { Dialog } from "@elmeragroup/ui"`)
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/dialog.tsx`

## 2 Anatomy

| Part | Base | Notes |
| --- | --- | --- |
| `Dialog.Root` | `DialogPrimitive.Root` | state owner (open/close, modality); renders no DOM; ref stamps `data-slot="dialog"` on it |
| `Dialog.Trigger` | `DialogPrimitive.Trigger` | opens the dialog |
| `Dialog.Portal` | `DialogPrimitive.Portal` | exported for manual composition; `Dialog.Content` renders its own internally |
| `Dialog.Close` | `DialogPrimitive.Close` | closes; also used internally for the corner close button and Footer's close button |
| `Dialog.Overlay` | `DialogPrimitive.Backdrop` | fixed scrim; auto-rendered by `Dialog.Content` |
| `Dialog.Content` | `Portal > Overlay > DialogPrimitive.Popup` | centered popup surface; `size` axis; auto-renders the corner close button (`showCloseButton`) |
| `Dialog.Header` | `div` | `flex flex-col gap-2` |
| `Dialog.Footer` | `div` | `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`; optional built-in outline Close button |
| `Dialog.Title` | `DialogPrimitive.Title` | `font-heading text-base leading-none font-medium text-balance` |
| `Dialog.Description` | `DialogPrimitive.Description` | muted `text-sm`, styles child `<a>` links (underline, hover foreground) |

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

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props.

**Dialog.Root** — `ComponentProps<DialogPrimitive.Root>` verbatim (`open`/`defaultOpen`/`onOpenChange`, `modal`, `dismissible`, …). Primitive-tier naming per conventions.

**Dialog.Trigger / Dialog.Portal / Dialog.Close** — their base-ui part's props verbatim (all support `render` per useRender polymorphism).

**Dialog.Overlay** — `ComponentProps<DialogPrimitive.Backdrop>`.

**Dialog.Content** — `ComponentProps<DialogPrimitive.Popup>` + `VariantProps<dialogContentVariants>` plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | 13-value axis, see §4 | `"md"` | max-width of the popup |
| `showCloseButton` | `boolean` | `true` | corner close button: `Dialog.Close` rendered as `Button variant="ghost" size="icon-sm"` with `hit-area-1 absolute top-4 right-4`, Phosphor `X` icon + `sr-only` "Close" label |
| `container` | `HTMLElement \| RefObject<HTMLElement>` | active `ThemeScope` element | forwarded to the internal Portal (§8) |

`children` render before the corner close button inside the Popup.

**Dialog.Header** — `ComponentProps<"div">`.

**Dialog.Footer** — `ComponentProps<"div">` plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `showCloseButton` | `boolean` | `false` | appends `Dialog.Close` rendered as `Button variant="outline"` with literal children "Close", after `children` |

Footer's `showCloseButton` is a different job from Content's (a footer action, not the corner dismiss affordance); both stay.

**Dialog.Title / Dialog.Description** — their base-ui part's props verbatim.

## 4 Variants

`dialogContentVariants` — `tv` recipe, **module-private** (no borrow pattern; not exported).

- Base: `fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100%-2rem)] w-full -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto rounded-xl bg-popover p-6 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none` + enter/exit animation classes (§6).
- Axis `size` (13 values, default `"md"`): `sm | md | lg | xl | 2xl | 3xl | 4xl | 5xl | 6xl | 7xl` map to `max-w-[min(var(--container-*),90%)]`; the top three are hardcoded pixel caps — `8xl` → `min(1366px,90%)`, `9xl` → `min(1536px,90%)`, `10xl` → `min(1920px,90%)` (no `--container-8xl+` vars exist; kept as literals, documented).

Animation strategy: **keyframe-based** (`tailwindcss-animate`) — `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` / `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`, `duration-100`. Contrast with Sheet, which is transition-based (see sheet spec §4).

## 5 Consumed tokens

- `popover` / `popover-foreground` — popup surface and text.
- `foreground/10` — popup hairline (`ring-1`).
- `muted-foreground` — Description text; `foreground` — Description link hover.
- Overlay scrim is **literal `bg-black/10`** + `supports-backdrop-filter:backdrop-blur-xs` — deliberately not tokenized yet; a dark-mode-ready `--overlay` token is a roadmap item (§8).
- Corner close button consumes Button ghost tokens.
- Radii: popup `rounded-xl` — `--radius` scale step, no hardcoded values.

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `dialog` (Root) · `dialog-trigger` · `dialog-portal` · `dialog-close` · `dialog-overlay` · `dialog-content` · `dialog-header` · `dialog-footer` · `dialog-title` · `dialog-description`. The Content-internal corner close button also emits `data-slot="dialog-close"` (same value as the standalone part — faithful to ref). Footer's built-in Close button emits no `data-slot`.

**Emitted (by base-ui, styled by us)**: `data-open` / `data-closed` on Popup and Backdrop.

**Consumed selectors**: `data-open:animate-in …` / `data-closed:animate-out …` on Content and Overlay. Per conventions' ancestor-match trap, these variants must stay on the element that owns the attribute (Popup/Backdrop themselves) — never on descendants.

## 7 Accessibility

- Base-ui wires `role="dialog"`, `aria-modal`, `aria-labelledby` → `Dialog.Title`, `aria-describedby` → `Dialog.Description`, and trigger `aria-haspopup`/`aria-expanded`/`aria-controls`.
- Focus is trapped inside the popup while open; on open, focus moves into the popup; on close, focus returns to the trigger.
- Keyboard: Escape closes (unless `dismissible={false}`); Tab cycles within the trap.
- Backdrop click dismisses when `modal`/`dismissible` allow it (base-ui defaults).
- Corner close button carries an `sr-only` "Close" label and a `hit-area-1` expanded hit target.
- Consumers should always render `Dialog.Title` (base-ui warns otherwise); `Dialog.Description` is optional but recommended.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `Dialog`→`Dialog.Root`, `DialogTrigger`→`Dialog.Trigger`, `DialogPortal`→`Dialog.Portal`, `DialogClose`→`Dialog.Close`, `DialogOverlay`→`Dialog.Overlay`, `DialogContent`→`Dialog.Content`, `DialogHeader`→`Dialog.Header`, `DialogFooter`→`Dialog.Footer`, `DialogTitle`→`Dialog.Title`, `DialogDescription`→`Dialog.Description`.
2. **Overlay `container` prop added (mandated)** to `Dialog.Content` — forwarded to the internal `DialogPrimitive.Portal`, defaulting to the active `ThemeScope` element (portal-inside-ThemeScope discipline). The ref hardcodes `<DialogPortal>` with **nothing forwarded** — no way to retarget the portal without recomposing Content manually; this gap is closed.
3. **Close-button unification**: the corner close button (Button ghost `icon-sm` + `sr-only` label + `hit-area-1`) becomes the **shared** close-button rendering also used by `Sheet.Content` (Dialog's pattern wins; see sheet spec §8).
4. **z-index deduped**: the ref stamps `z-50` on both Overlay and Popup. One `z-50` at the outermost layer per overlay; within it, DOM order stacks Backdrop under Popup. The flat z-50 strategy (every overlay component at the same level, DOM-order stacking) is deliberate and documented.
5. **Icons → Phosphor**: `XIcon` (lucide) → `X`.
6. **Overlay scrim** stays literal `bg-black/10` (matches ref); flagged as the one deliberate primitive-color exception, with a dark-mode token migration on the roadmap.
7. `dialogContentVariants` stays **private** (ref does not export it; no borrow pattern).

Kept faithfully: the 13-value size axis incl. hardcoded 8xl–10xl pixel caps and default `md`; `showCloseButton` defaults (`true` on Content, `false` on Footer); Footer's outline Close button with literal "Close" children; `duration-100` keyframe animations; `max-h-[calc(100%-2rem)]` + `overflow-y-auto` scroll containment; Description's child-link styling; Overlay `isolate` + backdrop blur.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Open/close: click trigger → `getByRole("dialog")` appears; Escape closes and returns focus to the trigger; `onOpenChange` fires.
- Focus trap: on open, focus lands inside the popup; Tab from the last tabbable wraps to the first; Shift+Tab wraps backwards; focus never escapes to the page behind.
- Labeling: `Dialog.Title` names the dialog (`getByRole("dialog", { name })`); `Dialog.Description` is wired via `aria-describedby` (attribute assertion).
- Close affordances: corner button (`getByRole("button", { name: "Close" })`) closes; `showCloseButton={false}` removes it; Footer `showCloseButton` renders an outline "Close" button that closes.
- `size`: `data-slot="dialog-content"` element carries the expected max-width class for a sample of values (`sm`, `md`, `10xl`).
- `container`: popup renders inside the provided element / active ThemeScope, not `document.body`.
- `dismissible={false}`: Escape and backdrop click do not close.

## 10 Demo requirements

Plain runnable `.tsx` demos: `dialog-basic.tsx` (Trigger, Title, Description, Footer with actions), `dialog-sizes.tsx` (size axis sampler incl. an `8xl+` value), `dialog-footer-close.tsx` (Footer `showCloseButton` next to a primary action), `dialog-no-close-button.tsx` (`showCloseButton={false}`, explicit `Dialog.Close` in the body), `dialog-scrolling.tsx` (long content exercising `max-h` + internal scroll).
