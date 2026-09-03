import { tv } from "tailwind-variants";

export const focusRing = tv({
  slots: {
    root: "",
    control: "",
  },
  variants: {
    target: {
      self: {
        root: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
      },
      within: {
        root: "has-[[data-focus-ring-control]:focus-visible]:ring-2 has-[[data-focus-ring-control]:focus-visible]:ring-ring has-[[data-focus-ring-control]:focus-visible]:ring-offset-2 has-[[data-focus-ring-control]:focus-visible]:ring-offset-background has-[[data-focus-ring-control]:focus-visible]:outline-none",
        control: "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
      },
      state: {
        root: "outline-none",
      },
    },
    isFocusVisible: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      target: "state",
      isFocusVisible: true,
      class: {
        root: "ring-2 ring-ring ring-offset-2 ring-offset-background",
      },
    },
  ],
  defaultVariants: {
    target: "self",
  },
});

/**
 * The self-target focus ring, resolved once at module scope and imported by every
 * consumer. Seventeen components used to hoist `focusRing({ target: "self" }).root()`
 * into a private module constant of their own; none does now, so the adapter is
 * evaluated once per process rather than once per module (spec 08, 2026-09-03).
 */
export const selfFocusRingClass = focusRing({ target: "self" }).root();

/**
 * The within-target focus ring root class, resolved once at module scope — the parent
 * face that lights up when the element carrying `data-focus-ring-control` is
 * keyboard-focused. Pair it with {@link withinFocusRingControlClass} on the control.
 */
export const withinFocusRingClass = focusRing({ target: "within" }).root();

/**
 * The control half of the within-target focus ring: it suppresses the control's own
 * ring so only the parent paints one. Pair with {@link withinFocusRingClass}.
 */
export const withinFocusRingControlClass = focusRing({ target: "within" }).control();

/**
 * The state-target focus ring's resting face — `outline-none` alone, the half that does
 * not depend on RAC's `isFocusVisible` render prop. Pair it with
 * {@link stateFocusRingVisibleClass} on the recipe's `isFocusVisible: true` arm.
 *
 * The `state` target exists because the interim react-aria tier hangs the ring on a
 * non-focusable wrapper (a `Group`, a calendar cell, a grid row) and is told about focus
 * through a render prop rather than a `:focus-visible` selector. Its two *fixed* rungs
 * are still constants, so they are resolved here like the other two targets. The one
 * call that genuinely cannot be — `react-aria/link`, which passes a live
 * `isFocusVisible` per render — keeps calling {@link focusRing} directly.
 */
export const stateFocusRingClass = focusRing({ target: "state" }).root();

/**
 * The state-target focus ring's keyboard-focused face, resolved once at module scope.
 * Recipes put it on their `isFocusVisible: true` arm; see {@link stateFocusRingClass}.
 */
export const stateFocusRingVisibleClass = focusRing({ target: "state", isFocusVisible: true }).root();

export const disabledHatch =
  "bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgb(0_0_0/0.02)_8px,rgb(0_0_0/0.02)_16px)]";

export const iconCrossfadeTransition =
  "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
export const iconCrossfadeShown = "blur-0 scale-100 opacity-100";
export const iconCrossfadeHidden = "scale-[0.25] opacity-0 blur-[4px]";
