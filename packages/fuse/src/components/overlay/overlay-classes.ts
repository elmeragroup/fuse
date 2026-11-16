/**
 * The package-private class vocabulary that the overlay families share, such as Dialog, Sheet,
 * Popover, Select and Tooltip.
 * `package.json#exports` exports nothing here. The vocabulary reaches the standalone stylesheet only
 * through the emitted dist modules that import it, which are that sheet's only source.
 *
 * The resolved constants derive from the recipes below. The export names stay, so the overlay
 * consumers compile without edits.
 */

import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * One overlay layer for the whole family. The ref stamps the level on both Backdrop and Popup, so
 * this module declares it once and shares it, and DOM order, not a second z-index step, stacks the
 * Backdrop under the Popup.
 */
export const overlayLayer = "z-50";

/**
 * The toast viewport's layer, one step above {@link overlayLayer}. Toasts are status
 * messages that must stay visible over modal content: a toast raised from inside an open
 * Dialog or Sheet would otherwise paint under it, because the modal's portal mounts later.
 * Base UI leaves `[aria-live]` regions out of a modal's `aria-hidden` marking, so the toast
 * also stays reachable.
 */
export const toastLayer = "z-60";

/**
 * The floating action bar's layer, one step below {@link overlayLayer}. The bar sits above its
 * content's sticky headers and scrollbars, and a menu or dialog it opens covers it.
 */
export const actionBarLayer = "z-40";

/**
 * The 13-value overlay width axis, default `md`. `sm` to `7xl` read the Tailwind container
 * variables. No `--container-8xl+` variables exist, so the top three pixel caps stay literal and
 * documented.
 *
 * The axis writes a `--overlay-width` custom property, not a `max-width` utility. Sheet gates its cap
 * on two side selectors, `data-[side=left]:sm:` and `data-[side=right]:sm:`, and Dialog reads the
 * same variable through `max-w-(--overlay-width)` on its recipe base. The values repeat as literals,
 * not interpolations, because the Tailwind scanner only emits a utility whose candidate appears
 * literally in a source file, so `` `[--overlay-width:${…}]` `` would compile to nothing.
 *
 * Dialog and Sheet compose this through `extend` or `overlaySizeVariants.variants.size`.
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
      // Tailwind defines no `--container-8xl` or larger variable, so these pixel caps stay literal.
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
 * The backdrop scrim of both modal families, Dialog and Sheet. `bg-black/10` is not tokenized and
 * is allowlisted as a raw palette literal.
 *
 * The `backdropBlur` axis blurs what the scrim covers where the browser supports backdrop filters.
 * `false` keeps the tint and drops the blur, for a modal portaled into a transformed scope. There the
 * filter samples the backdrop at the wrong scale and offset, so the blurred copy no longer lines up
 * with the content under it.
 */
export const overlayScrimVariants = tv({
  base: "bg-black/10",
  variants: {
    backdropBlur: {
      true: "supports-backdrop-filter:backdrop-blur-xs",
    },
  },
  defaultVariants: {
    backdropBlur: true,
  },
});

/**
 * Popup-surface slots. Fill and edge stay separate slots, because Tooltip inverts the fill and
 * paints neither shadow nor ring, and it cannot subtract them from a composed surface. `ring-0` does
 * not remove `ring-foreground/10`, because tailwind-merge 3.7.0 treats ring width and ring color as
 * separate conflict groups. Tooltip composes {@link overlayPopupMotionClass} only. It does not take
 * {@link overlayPopupSurfaceClass} or {@link overlayTimedPopupClass}.
 *
 * {@link overlayPopupSurfaceClass} is the fill, the edge and `rounded-md`.
 * {@link overlayTimedPopupClass} is the surface, the motion and the duration.
 * {@link overlayModalPopupClass} is the surface with `shadow-lg`, the modal motion,
 * {@link overlayLayer} and the self focus ring. All three are `cn()` composites of the slots
 * below and those two shared constants, so each class is spelled once. Fill and edge stay
 * slots because Tooltip would otherwise have to negate a surface-only recipe.
 *
 * The positioner interpolates {@link overlayLayer} and the modal face composes it, instead of
 * restating `z-50`, which this module spells exactly once.
 */
const overlayPopupVariants = tv({
  slots: {
    /**
     * The modal title typography that `Dialog.Title` and `Sheet.Title` share, so none of them can
     * drift. AlertDialog's title takes it through `Dialog.Title`. `text-xl` keeps its own 28px line,
     * so a wrapped title stays readable, and the title stands above comfortable `--label-text` and
     * `--control-text`. It carries no color, because the title inherits its surface's ink,
     * `text-dialog-foreground` in Dialog and Sheet. Every title is a heading element, so `m-0`
     * resets the block margins a host without Tailwind's preflight would otherwise keep.
     * `titleLine` is one line of this type, so change both together.
     */
    title: "text-xl font-medium m-0 font-heading text-balance",
    /**
     * One title line beside the title, for the glyph AlertDialog sets in its header row: as tall
     * as `text-xl`'s line, with the glyph centered on it. It sets no font size, so an icon sized in
     * `em` keeps the header's size, and it hides when the icon renders nothing.
     */
    titleLine: "flex h-[calc(var(--text-xl)*var(--text-xl--line-height))] shrink-0 items-center empty:hidden",
    /** The Dialog footer's action row. */
    footer: "sm:flex-row sm:justify-end flex flex-col-reverse gap-2",
    /**
     * The positioner face of every anchored overlay: one stacking context and the single
     * overlay layer. A site passes its own extras, such as DropdownMenu's `outline-none`, as the
     * extra `cn` argument.
     */
    positioner: `isolate ${overlayLayer}`,
    /**
     * The tokenized popup fill and its paired text role. It states the fill as `--surface`,
     * so a chart in the popup cuts its rings and seams out of the popover color.
     */
    fill: "bg-popover text-popover-foreground [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-popover)]",
    /**
     * The modal fill and its paired text role, which Dialog, AlertDialog through Dialog, and Sheet
     * compose after their faces. The `dialog` role aliases the popover pair except in branded
     * light, where it is the page tint, so the white fields and selection rows in a modal stand
     * apart from it as they do on the page. `Command.Content` stays on the popover fill. The slot
     * states the fill as `--surface`, so a chart in the modal cuts out of the dialog color.
     */
    modalFill:
      "bg-dialog text-dialog-foreground [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-dialog)]",
    /** The popup edge: the `md` elevation rung plus the hairline ring. */
    edge: "shadow-md ring-1 ring-foreground/10",
    /**
     * The anchored half of the popup motion: the transform origin Base UI publishes, and a 2-unit
     * slide in from the side the trigger sits on. Only `data-starting-style` sets a slide offset, so a
     * close after the entry finishes fades and zooms in place. Only a popup that a trigger
     * anchors takes it, through {@link overlayPopupMotionClass}. That class composes it after the
     * `zoom` slot, so its transition list, which adds `translate` to the pair's, wins the class
     * merge. The slide and that list sit under `motion-safe:`, as the central reduced-motion rule in
     * `styles/fuse.css` asks.
     */
    anchor:
      "origin-(--transform-origin) motion-safe:transition-[opacity,scale,translate] motion-safe:data-starting-style:data-[side=bottom]:-translate-y-2 motion-safe:data-starting-style:data-[side=inline-end]:-translate-x-2 motion-safe:data-starting-style:data-[side=inline-start]:translate-x-2 motion-safe:data-starting-style:data-[side=left]:translate-x-2 motion-safe:data-starting-style:data-[side=right]:-translate-x-2 motion-safe:data-starting-style:data-[side=top]:translate-y-2",
    /**
     * The opacity fade that {@link overlayPopupMotionClass}, {@link overlayModalPopupClass} and
     * {@link overlayBackdropMotionClass} share. Base UI's `data-starting-style` and
     * `data-ending-style` hold the part at 0, and a CSS transition eases it to rest and back. A
     * transition starts from its current value, so a close during the open, or an open during the
     * close, reverses instead of restarting. Base UI unmounts a closing part once its transitions
     * finish. The list holds opacity alone at one duration, so under reduced motion the fade keeps
     * its own timing. The backdrop takes the fade alone, through {@link overlayBackdropMotionClass},
     * and the popups take it with `zoom`.
     */
    fade: "transition-opacity ease-[ease] data-ending-style:opacity-0 data-starting-style:opacity-0",
    /**
     * The zoom from and to 95% that the anchored popups and the modals add to the fade, and the
     * transition list that adds `scale` to it. Both sit under `motion-safe:`, so a reduced-motion
     * user sees the fade alone. Anchored popups take the pair with {@link overlayPopupMotionClass},
     * modals with {@link overlayModalPopupClass}.
     */
    zoom: "motion-safe:transition-[opacity,scale] motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95",
    /**
     * The anchored popup's transition list with `height` and `width` added, for a timed anchored
     * popup that also morphs its size. {@link overlayResizingPopupClass} composes it after the
     * `anchor` slot, so it replaces that slot's list in the class merge. It spells out the `anchor`
     * list again because the Tailwind scanner only emits a class written literally. Change the two
     * together. It sits under `motion-safe:` with the rest, so a reduced-motion user sees the size
     * snap.
     */
    resize: "motion-safe:transition-[opacity,scale,translate,height,width]",
    /**
     * The shared popup timing rung. {@link overlayTimedPopupClass} folds it in for the timed
     * anchored popups, {@link overlayModalPopupClass} for the modals and
     * {@link overlayBackdropMotionClass} for the backdrop. Tooltip ships motion untimed, on
     * Tailwind's default 150ms transition duration.
     */
    duration: "duration-100",
  },
});

/** The popup slots, resolved once at module scope. The recipe has no axes, so no render repeats the work. */
const overlayPopupSlots = overlayPopupVariants();

export const overlayTitleClass = overlayPopupSlots.title();
export const overlayTitleLineClass = overlayPopupSlots.titleLine();
export const overlayFooterClass = overlayPopupSlots.footer();
export const overlayPositionerClass = overlayPopupSlots.positioner();
export const overlayPopupFillClass = overlayPopupSlots.fill();
export const overlayModalFillClass = overlayPopupSlots.modalFill();
const overlayPopupEdgeClass = overlayPopupSlots.edge();
const overlayPopupFadeZoomClass = cn(overlayPopupSlots.fade(), overlayPopupSlots.zoom());
const overlayPopupDurationClass = overlayPopupSlots.duration();

/**
 * The open and close transitions every anchored popup moves with: the fade and zoom pair, then the
 * anchor slot's transform origin, per-side slide-in and the transition list that adds `translate`.
 * It leaves out the timing rung, because the timed anchored popups compose
 * {@link overlayTimedPopupClass} and Tooltip ships the set untimed.
 *
 * A later `motion-safe:transition-*` class replaces this set's motion-safe transition list in the
 * class merge. A popup that transitions more properties takes a composite from this module that
 * extends the list, such as {@link overlayResizingPopupClass}, instead of restating it.
 */
export const overlayPopupMotionClass = cn(overlayPopupFadeZoomClass, overlayPopupSlots.anchor());

/**
 * The backdrop's motion, which is the shared fade at the popup timing rung. Dialog's scrim fades in
 * with its popup and reverses with it.
 */
export const overlayBackdropMotionClass = cn(overlayPopupSlots.fade(), overlayPopupDurationClass);

/**
 * The fill, the edge and the `md` radius rung, which make the whole surface of a popup on the
 * popover role. Dialog and `Command.Content` take it through {@link overlayModalPopupClass} and
 * raise the radius to `rounded-xl` in their shells, and Dialog then swaps the fill for
 * {@link overlayModalFillClass}. The timed anchored popups, Popover, Select, Combobox and
 * DropdownMenu, take it through {@link overlayTimedPopupClass}, and Select raises the radius to
 * `rounded-lg`. Each still overrides a rung through the extra `cn` argument instead of restating the
 * fill and ring.
 *
 * Tooltip does not take it. Tooltip inverts the fill, `bg-foreground text-background`, and paints
 * neither shadow nor ring, and it cannot subtract them here. `ring-0` does not remove
 * `ring-foreground/10`, because tailwind-merge 3.7.0 treats ring width and ring color as separate
 * conflict groups, so an override would leave a live token and change Tooltip's rendered set.
 * Tooltip composes {@link overlayPopupMotionClass} only, and can take {@link overlayPopupFillClass}
 * and {@link overlayPopupEdgeClass} if it needs a surface of its own later. Fill and edge stay
 * separate slots for that reason. This export is the `cn()` composite of the fill, the edge and the
 * radius rung, not a restated slot.
 */
export const overlayPopupSurfaceClass = cn(overlayPopupFillClass, overlayPopupEdgeClass, "rounded-md");

/**
 * The surface, the motion and the duration, which the timed anchored popups, Popover, Select,
 * Combobox and DropdownMenu, compose instead of restating the three parts. Tooltip keeps
 * {@link overlayPopupMotionClass} untimed, and Dialog and `Command.Content` take
 * {@link overlayModalPopupClass}. None of them is a timed anchored popup, which is why the recipe
 * splits into the `fill`, `edge`, `fade`, `zoom`, `anchor` and `duration` slots.
 */
export const overlayTimedPopupClass = cn(
  overlayPopupSurfaceClass,
  overlayPopupMotionClass,
  overlayPopupDurationClass
);

/**
 * The timed popup class for an anchored popup that also morphs its size, as the data table filter's
 * menu and value popover do between steps. It is {@link overlayTimedPopupClass} with `height` and
 * `width` added to the open and close transitions, under `motion-safe:` with the rest.
 */
export const overlayResizingPopupClass = cn(overlayTimedPopupClass, overlayPopupSlots.resize());

/**
 * The face of the two modals, Dialog and `Command.Content`. It is the surface with the `lg`
 * elevation rung, the fade and zoom transitions with their timing rung, {@link overlayLayer} and the self
 * focus ring. No trigger anchors a modal, so it leaves out the transform origin and the per-side
 * slide-ins of {@link overlayPopupMotionClass}. Each modal composes it first and passes its shell
 * and layout as later `cn` arguments, so the shell's `rounded-xl` overrides the surface's
 * `rounded-md`. Dialog also passes {@link overlayModalFillClass}, which replaces the popover
 * fill; `Command.Content` keeps it.
 */
export const overlayModalPopupClass = cn(
  overlayPopupSurfaceClass,
  "shadow-lg",
  overlayPopupFadeZoomClass,
  overlayPopupDurationClass,
  overlayLayer,
  selfFocusRingClass
);
