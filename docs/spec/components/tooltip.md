# Tooltip

## 1 Header

- **Canonical name**: `Tooltip` (namespace compound)
- **Export path**: `@elmeragroup/ui/tooltip` (also re-exported from `@elmeragroup/ui`)
- **RSC**: client
- **Tier**: styled base-ui primitive wrapper (overlay component)
- **Source of truth**: `.ref/OrderModuleInternalWeb/packages/ui/src/base-ui/tooltip.tsx`

## 2 Anatomy

| Part               | Base                          | Notes                                                                                                                                     |
| ------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Tooltip.Provider` | `TooltipPrimitive.Provider`   | app/section-level grouping: shared `delay` (our default `0`) and skip-delay hand-off between neighboring tooltips; no DOM                 |
| `Tooltip.Root`     | `TooltipPrimitive.Root`       | open-state owner, no DOM; per-tooltip `delay` prop wraps a scoped Provider (§8)                                                           |
| `Tooltip.Trigger`  | `TooltipPrimitive.Trigger`    | hover/focus anchor; stamps `data-slot`, composes the self-focus ring, and carries the `aria-describedby` pointing at the popup (§7, §8.9) |
| `Tooltip.Content`  | `Portal > Positioner > Popup` | inverted pill (`bg-foreground text-background`, `text-xs`, `max-w-xs`); always renders `TooltipPrimitive.Arrow` after `children`          |

```tsx
<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger render={<Button variant="ghost" size="icon" />}>
      <Info />
    </Tooltip.Trigger>
    <Tooltip.Content>Add to library</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```

The internal `Portal`, `Positioner`, `Popup` and `Arrow` parts are not exported (matching the ref); `Tooltip.Content` is the only composition point for them (§8). The arrow is always rendered — deliberately different from Popover's opt-in `showArrow` (§8).

## 3 Props

All rendering parts take `className` (merged via `cn`) and forward the rest of their base-ui part's props (incl. `render` per conventions).

**Tooltip.Provider** — `ComponentProps<TooltipPrimitive.Provider>` with one changed default:

| Prop                    | Type     | Default          | Notes                                                    |
| ----------------------- | -------- | ---------------- | -------------------------------------------------------- |
| `delay`                 | `number` | `0`              | ref overrides base-ui's default (600ms) to instant; kept |
| `closeDelay`, `timeout` | base-ui  | base-ui defaults | forwarded verbatim                                       |

**Tooltip.Root** — `ComponentProps<TooltipPrimitive.Root>` (`open`/`defaultOpen`/`onOpenChange`, `hoverable`, `disabled`, …) plus:

| Prop    | Type     | Default | Notes                                                                                                            |
| ------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `delay` | `number` | —       | when set, wraps this Root in a _scoped_ `TooltipPrimitive.Provider` with that delay (§8 — resets outer grouping) |

**Tooltip.Trigger** — `ComponentProps<TooltipPrimitive.Trigger>` verbatim.

**Tooltip.Content** — `ComponentProps<TooltipPrimitive.Popup>` plus `Pick<ComponentProps<TooltipPrimitive.Positioner>, "align" | "alignOffset" | "side" | "sideOffset">` (destructured and forwarded to the internal Positioner) plus:

| Prop          | Type                                            | Default                      | Notes                                                                |
| ------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `align`       | Positioner `align`                              | `"center"`                   |                                                                      |
| `alignOffset` | `number`                                        | `0`                          |                                                                      |
| `side`        | Positioner `side`                               | `"top"`                      | tooltips open upward by default (vs Popover/DropdownMenu `"bottom"`) |
| `sideOffset`  | `number`                                        | `4`                          |                                                                      |
| `container`   | `HTMLElement \| RefObject<HTMLElement \| null>` | nearest `ThemeScope` element | forwarded to the internal `TooltipPrimitive.Portal` (§8)             |

## 4 Variants

No component-specific `tv` recipe and no variant axes — the single inverted style is composed on Content from the shared popup **motion** set plus Tooltip's own inverted pill classes; Trigger composes the shared self-target focus ring. _(Amended 2026-09-03; §8.10.)_

## 5 Consumed tokens

- `foreground` / `background` — inverted surface: `bg-foreground text-background` popup, `bg-foreground fill-foreground` arrow. Token-inverted by design (no raw colors; flips correctly per theme), kept as-is (§8).
- `ring` — Trigger focus treatment (`background` also supplies its ring offset).
- Radii: popup `rounded-md`, arrow `rounded-[2px]` tip softening — kept from the ref (documented: the 2px literal is the arrow tip's corner soften, below token granularity).

## 6 Data attributes

**Emitted (by our wrappers)**: `data-slot`: `tooltip-provider` · `tooltip` · `tooltip-trigger` · `tooltip-content` (Provider/Root render no DOM; their slot attrs pass through base-ui props).

**Emitted (by base-ui, styled by us)**: `data-open` / `data-closed` and `data-side` on the popup; `data-side` on the arrow; `data-popup-open` on the trigger (available, unstyled).

**Consumed selectors**:

- Popup: `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`, `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`, `data-[side=bottom|top|left|right|inline-start|inline-end]:slide-in-from-*`, `origin-(--transform-origin)`. Bare `data-open:`/`data-closed:` are self-scoped custom variants and stay on the popup that emits the state.
- Arrow: `size-2.5 rotate-45` diamond with per-side offset/centering — `data-[side=top]:-bottom-2.5`, `data-[side=bottom]:top-1`, and for left/right/inline-start/inline-end a `top-1/2!` + `-translate-y-1/2` vertical centering with `-left-1`/`-right-1` — kept verbatim.

## 7 Accessibility

- The trigger's `aria-describedby` is **wired by this component, not by base-ui**: `Tooltip.Root` mints one `useId` per tooltip and publishes it on a package-private context; `Tooltip.Trigger` reads it as `aria-describedby` and `Tooltip.Content` stamps the same value as the popup's `id` plus an explicit `role="tooltip"` (§8.9). Base-ui 1.6.0 wires neither, so removing either half silently drops the description. The popup content is descriptive only (never put interactive controls in a tooltip).
- Opens on pointer hover (after the effective provider `delay`) and on keyboard focus of the trigger (focus-open is instant); closes on hover/focus leaving, and immediately on Escape.
- Grouping: within one `Tooltip.Provider`, moving between triggers inside the skip-delay window opens the next tooltip without re-waiting the delay.
- The tooltip never receives focus; `hoverable` (base-ui default) keeps it open while the pointer is over the popup.
- Per conventions, boolean aria uses `x || undefined`.

## 8 Divergence from reference

1. **Renames (flat → namespace)**: `TooltipProvider`→`Tooltip.Provider`, `Tooltip`→`Tooltip.Root`, `TooltipTrigger`→`Tooltip.Trigger`, `TooltipContent`→`Tooltip.Content`.
2. **Overlay `container` prop added (mandated)** to `Tooltip.Content`, forwarded to the internal `TooltipPrimitive.Portal`, defaulting to the nearest `ThemeScope` element. The ref hardcodes the portal with no target (→ `document.body`) and exports no Portal part — `container` on Content is the only portal-control surface (Portal/Positioner/Popup stay unexported).
3. **Dead Radix classes removed (LOCKED ruling)**: the ref popup carries `data-[state=delayed-open]:animate-in/fade-in-0/zoom-in-95` — a Radix state attribute base-ui never emits (base-ui emits `data-open`/`data-closed`). Dead selectors dropped; the parallel `data-open:` set already covers the entrance.
4. **Phantom `kbd` hooks removed (LOCKED ruling)**: the ref popup carries `has-data-[slot=kbd]:pr-1.5` and four `**:data-[slot=kbd]:*` descendant selectors for a `Kbd` component that does not exist in the package. Removed; to be reconsidered if/when a `Kbd` component is specced.
5. **Per-tooltip `delay` behavior KEPT, prominently documented (LOCKED ruling)**: `Tooltip.Root`'s `delay` prop silently wraps the Root in a _nested scoped_ `TooltipPrimitive.Provider` (base-ui puts per-tooltip delay on a Provider). Consequence: that tooltip forms its own provider group — it no longer participates in the outer Provider's shared delay or skip-delay hand-off. Kept as the proven face; the reset-outer-grouping consequence must appear in the prop's docs.
6. **Arrow show-behavior deliberately not unified with Popover**: Tooltip keeps its _always-rendered_ `bg-foreground fill-foreground` token-inverted arrow (already token-clean in the ref); Popover keeps opt-in `showArrow` default `false`. Documented as an intentional family difference, not a divergence to fix.
7. **`z-50` deduped**: the ref sets `isolate z-50` on the Positioner _and_ `z-50` on the Popup (plus `z-50` on the Arrow, which becomes redundant): kept once on the outermost layer (Positioner) per the flat z-strategy — every overlay gets exactly one `z-50` at its outermost portalled element.
8. **Focus unified:** Trigger composes the canonical self-focus adapter, including when rendered without a Button target.
9. **`aria-describedby` and `role="tooltip"` are hand-rolled** (2026-09-03): §2 called Trigger a bare re-export and §7 credited base-ui with the description wiring. Base-ui 1.6.0 does neither, so Root mints a `useId`, a private context carries it, Trigger sets `aria-describedby` and Popup sets the matching `id` and `role="tooltip"`. Kept as compensation for the primitive; the three halves are one mechanism and are locked by the §9 name/description test.
10. **Shared overlay spine adopted, minus the surface and the timing rung**: `Tooltip.Content` composes `OverlayPortal` (theming.md §7.4), `OverlayContainerProps`, `OverlayPositionerProps`, `overlayPositionerClass`, `overlayPopupMotionClass` and `selfFocusRingClass`. It is deliberately **not** a consumer of the composed popup surface: it inverts the fill and flies frameless (the "Kept faithfully" line below: no shadow/ring, tooltips fly frameless), and it could not subtract the surface's ring afterwards — tailwind-merge treats ring width and ring colour as separate conflict groups, so `ring-0` would leave `ring-foreground/10` live and change the rendered set. It also takes the motion set **untimed**, without the shared `duration-100` rung the other popup families pair with it (§6). It takes the shared positioner block whole and redeclares only `side`, whose description notes that tooltips open upward; published defaults come from destructuring (popover.md §8.7). The rendered class set, prop names, documented defaults, and DOM are unchanged. _(Amended 2026-09-04.)_

Kept faithfully: Provider `delay` default `0`; inverted `bg-foreground text-background` pill with `text-xs max-w-xs px-3 py-1.5`; the full arrow placement class set incl. `rounded-[2px]` and `translate-y-[calc(-50%-2px)]`; no shadow/ring on the popup (tooltips fly frameless); `side="top"` default.

## 9 Test requirements

Role/label-based queries throughout; keyboard flows per §7:

- Hover open: hovering the trigger shows `getByRole("tooltip")` after the effective delay (default `0` → immediate); unhover hides it.
- Focus open: keyboard-focusing the trigger opens instantly; blur closes; Escape while open closes immediately.
- `aria-describedby`: while open, the trigger's accessible description equals the tooltip text.
- Provider grouping: two tooltips under one Provider — after opening the first, moving to the second opens without delay (skip-delay window).
- Per-tooltip `delay`: a Root with `delay={500}` does not open before the delay elapses and does not inherit the outer Provider's skip-delay state (scoped-provider consequence, §8.5).
- Positioner forwarding: `side`/`align` overrides surface as `data-side` on the popup; default is `data-side="top"`.
- `container`: popup renders inside the provided element / nearest ThemeScope, not `document.body`.

## 10 Demo requirements

Plain runnable `.tsx` demos: `tooltip-basic.tsx` (Provider + one icon-button trigger), `tooltip-sides.tsx` (four triggers with `side="top" | "right" | "bottom" | "left"`), `tooltip-delay.tsx` (grouped Provider delay vs a per-tooltip `delay` override, demonstrating the scoped-provider reset), `tooltip-controlled.tsx` (controlled `open` for docs screenshots).
