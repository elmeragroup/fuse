/**
 * Package-private class vocabulary shared by every overlay family — the public base-ui
 * Dialog/Sheet and the interim RAC Dialog alike. Nothing here is exported through
 * `package.json#exports`; it reaches the standalone stylesheet only through the emitted
 * dist modules that import it, which are that sheet's only source (architecture.md §5).
 *
 * Resolved constants are derived from the recipes below. Export names stay so the
 * thirteen overlay consumers compile without edits.
 */

import { tv } from "tailwind-variants";
import type { VariantProps } from "tailwind-variants";

/**
 * One overlay layer for the whole family (dialog.md §8.4): the ref stamps the level on
 * both Backdrop and Popup, we declare it once and share it, so DOM order — not a second
 * z-index step — stacks the Backdrop under the Popup.
 */
export const overlayLayer = "z-50";

/**
 * The 13-value overlay width axis (dialog.md §4), default `md`. `sm`–`7xl` read the
 * Tailwind container variables; no `--container-8xl+` variables exist, so the top three
 * pixel caps stay literal and documented.
 *
 * Written as a `--overlay-width` custom property, not a `max-width` utility: Sheet
 * gates its cap on two side selectors (`data-[side=left]:sm:` / `data-[side=right]:sm:`),
 * and Dialog reads the same variable through `max-w-(--overlay-width)` on its recipe
 * base. **The values are restated as literals, not interpolated** — the Tailwind scanner
 * only emits a utility whose candidate appears literally in a source file, so
 * `` `[--overlay-width:${…}]` `` would compile to nothing.
 *
 * Dialog and Sheet compose this via `extend` or `overlaySizeVariants.variants.size`.
 */
export const overlaySizeVariants = tv({
  variants: {
    size: {
      sm: "[--overlay-width:min(var(--container-sm),90%)]",
      md: "[--overlay-width:min(var(--container-md),90%)]",
      lg: "[--overlay-width:min(var(--container-lg),90%)]",
      xl: "[--overlay-width:min(var(--container-xl),90%)]",
      "2xl": "[--overlay-width:min(var(--container-2xl),90%)]",
      "3xl": "[--overlay-width:min(var(--container-3xl),90%)]",
      "4xl": "[--overlay-width:min(var(--container-4xl),90%)]",
      "5xl": "[--overlay-width:min(var(--container-5xl),90%)]",
      "6xl": "[--overlay-width:min(var(--container-6xl),90%)]",
      "7xl": "[--overlay-width:min(var(--container-7xl),90%)]",
      // No --container-8xl+ variables exist; the pixel caps stay literal (dialog.md §4).
      "8xl": "[--overlay-width:min(1366px,90%)]",
      "9xl": "[--overlay-width:min(1536px,90%)]",
      "10xl": "[--overlay-width:min(1920px,90%)]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

/**
 * The keys of {@link overlaySizeVariants}'s `size` axis — the shared overlay width
 * table. Kept so existing `size: overlayWidthClasses` spreads and the overlay unit
 * suite stay source-compatible.
 */
export const overlayWidthClasses = overlaySizeVariants.variants.size;

/** The keys of {@link overlaySizeVariants}'s `size` axis — the shared overlay width axis. */
export type OverlaySize = NonNullable<VariantProps<typeof overlaySizeVariants>["size"]>;

/**
 * Popup-surface slots (dialog.md §5, popover.md §5/§6). Fill and edge stay separate
 * slots: Tooltip inverts the fill and paints neither shadow nor ring, and it cannot
 * subtract them from a composed surface — `ring-0` does not remove `ring-foreground/10`,
 * because tailwind-merge (3.6.0) treats ring width and ring colour as separate conflict
 * groups. Tooltip composes {@link overlayPopupMotionClass} only.
 *
 * The positioner interpolates {@link overlayLayer} rather than restating `z-50`, which
 * this module spells exactly once.
 */
const overlayPopupVariants = tv({
  slots: {
    /**
     * The backdrop scrim (dialog.md §5): `bg-black/10` is deliberately not tokenized and
     * is allowlisted as a raw palette literal; a dark-mode scrim token is on the roadmap.
     */
    scrim: "bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
    /** Dialog title typography (dialog.md §2), shared so the interim tier cannot drift. */
    title: "text-base font-medium font-heading leading-none text-balance",
    /** Dialog footer action row (dialog.md §2), shared with the interim tier's footer slot. */
    footer: "sm:flex-row sm:justify-end flex flex-col-reverse gap-2",
    /**
     * The positioner face of every anchored overlay: one stacking context and the single
     * overlay layer (popover.md §8.4). Site-specific extras — DropdownMenu's `outline-none`,
     * for one — are passed as the extra `cn` argument.
     */
    positioner: `isolate ${overlayLayer}`,
    /** The tokenized popup fill and its paired text role (popover.md §5). */
    fill: "bg-popover text-popover-foreground",
    /** The popup edge: the `md` elevation rung plus the hairline ring (popover.md §5). */
    edge: "shadow-md ring-1 ring-foreground/10",
    /**
     * The open/close motion set every anchored popup animates with (popover.md §6): the
     * transform origin base-ui publishes, the per-side slide-in, and the fade/zoom pair
     * on `data-open`/`data-closed`. The timing rung is deliberately **not** bundled in:
     * the four timed anchored popups compose {@link overlayTimedPopupClass}, and Tooltip
     * ships the set untimed (tooltip.md §6).
     */
    motion:
      "origin-(--transform-origin) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    /**
     * The shared popup timing rung (popover.md §6). Folded into
     * {@link overlayTimedPopupClass} for the four timed anchored popups; Tooltip ships
     * motion untimed, and Dialog keeps a local `duration-100` beside its own keyframes.
     */
    duration: "duration-100",
  },
});

/** Resolved once at module scope — the recipe has no axes (no per-render work). */
const overlayPopupSlots = overlayPopupVariants();

export const overlayScrimClass = overlayPopupSlots.scrim();
export const overlayTitleClass = overlayPopupSlots.title();
export const overlayFooterClass = overlayPopupSlots.footer();
export const overlayPositionerClass = overlayPopupSlots.positioner();
export const overlayPopupFillClass = overlayPopupSlots.fill();
export const overlayPopupEdgeClass = overlayPopupSlots.edge();
export const overlayPopupMotionClass = overlayPopupSlots.motion();
export const overlayPopupDurationClass = overlayPopupSlots.duration();

/**
 * Fill + edge + the `md` radius rung: the whole surface of a popup that sits on the
 * popover role. Dialog (`rounded-xl shadow-lg`) composes this directly; the four timed
 * anchored popups (Popover, Select, Combobox, DropdownMenu — Select raises the radius
 * to `rounded-lg`) take it through {@link overlayTimedPopupClass}. Each still overrides
 * a rung through the extra `cn` argument rather than restating the fill and ring.
 *
 * **Not Tooltip.** Tooltip inverts the fill (`bg-foreground text-background`) and paints
 * neither shadow nor ring, and it cannot subtract them here: `ring-0` does not remove
 * `ring-foreground/10`, because tailwind-merge (3.6.0) treats ring width and ring colour
 * as separate conflict groups, so overriding would leave a live token and change
 * Tooltip's rendered set. Tooltip composes {@link overlayPopupMotionClass} only, and
 * takes {@link overlayPopupFillClass}/{@link overlayPopupEdgeClass} as the seam if a
 * future surface of its own is wanted.
 *
 * Joined from the fill/edge slots rather than folded into a slot of its own: a surface
 * slot would be the thing Tooltip would then have to negate.
 */
export const overlayPopupSurfaceClass = [overlayPopupFillClass, overlayPopupEdgeClass, "rounded-md"].join(
  " "
);

/**
 * Surface + motion + duration: the four timed anchored popups (Popover, Select,
 * Combobox, DropdownMenu) compose this instead of restating the three parts.
 * Tooltip keeps {@link overlayPopupMotionClass} untimed; Dialog keeps
 * {@link overlayPopupSurfaceClass} plus its own keyframes — neither is a timed
 * anchored popup, which is what the fill/edge/motion/duration split is for.
 */
export const overlayTimedPopupClass = [
  overlayPopupSurfaceClass,
  overlayPopupMotionClass,
  overlayPopupDurationClass,
].join(" ");

/**
 * Menu-row slots shared by Select, Combobox, and DropdownMenu. The *highlight* face is
 * deliberately not on `item`: base-ui publishes it as `focus:` on menu items and
 * `data-highlighted:` on listbox options, so each family passes its own as the extra
 * `cn` argument, along with its horizontal padding (`px-2` for menus, `pr-8 pl-2` for
 * indicator-bearing options).
 */
const overlayMenuVariants = tv({
  slots: {
    item:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics, elmera/no-local-focus-ring -- select.md §4: option padding is menu layout, not a control rung; select.md §7: `outline-hidden` only clears the UA outline; this constant carries no highlight face and no ring, both of which stay with the consuming family
      "text-sm relative flex cursor-default items-center gap-2 rounded-sm py-1.5 outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    /** The trailing check slot on a selectable option row, positioned once for all three menu families. */
    indicator: "pointer-events-none absolute right-2 flex items-center justify-center",
    /** The hairline rule between option groups, shared by Select, Combobox, and DropdownMenu. */
    separator: "-mx-1 my-1 h-px bg-border",
    groupLabel:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- select.md §4: group label padding is menu layout, not a control rung
      "text-xs px-2 py-1.5 text-muted-foreground",
  },
});

const overlayMenuSlots = overlayMenuVariants();

export const menuItemClass = overlayMenuSlots.item();
export const menuItemIndicatorClass = overlayMenuSlots.indicator();
export const menuSeparatorClass = overlayMenuSlots.separator();
export const menuGroupLabelClass = overlayMenuSlots.groupLabel();
