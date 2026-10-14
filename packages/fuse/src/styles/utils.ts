import { cn } from "./cn";
import { tv } from "./tv";

/**
 * The shared keyboard focus ring: a 2px `--ring` box-shadow drawn flush against the control,
 * with no offset gap. The flush ring keeps one 2px reach in every target, so a ring never
 * paints the page colour between itself and the control, and the ring's colour is held to 3:1
 * against the page and card it is drawn on (`contrast-matrix.test.ts`).
 *
 * - `self` paints on the element that matches `:focus-visible`.
 * - `within` paints on a group whose `data-focus-ring-control` descendant is focus-visible;
 *   its `control` slot cancels the control's own ring so the group paints once.
 * - `state` paints from React Aria's `isFocusVisible` render prop, for a non-focusable host.
 *
 * A focused invalid control paints the invalid focus face from the constants below instead,
 * which the state face composes: see {@link ariaInvalidFocusRingClass}.
 */
export const focusRing = tv({
  slots: {
    root: "",
    control: "",
  },
  variants: {
    target: {
      self: {
        root: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      },
      within: {
        root: "has-[[data-focus-ring-control]:focus-visible]:ring-2 has-[[data-focus-ring-control]:focus-visible]:ring-ring has-[[data-focus-ring-control]:focus-visible]:outline-none",
        control:
          "focus-visible:ring-0 focus-visible:outline-none aria-invalid:focus-visible:ring-0 aria-invalid:focus-visible:ring-offset-0",
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
        root: "ring-2 ring-ring",
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
 * evaluated once per process rather than once per module.
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
 * ring, the invalid face's offset line included, so only the parent paints one. Pair with
 * {@link withinFocusRingClass}.
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

/**
 * The focused invalid face for a control that carries `aria-invalid` itself. Outside the error
 * border it paints a solid 1px `--error` line flush against the box, and the resting 3px
 * `error/20` halo outside that line, reaching 4px. Tailwind's ring offset slot draws the solid
 * line and paints above the ring slot, whose spread is the halo's 3px plus the 1px offset.
 * Each arm stacks the invalid attribute on `:focus-visible`, so its selector outweighs both the
 * plain focus ring and the resting halo of the state face, whatever order Tailwind emits them
 * in. `state-face.ts` composes it into the aria arm of the invalid face.
 */
export const ariaInvalidFocusRingClass = cn(
  "aria-invalid:focus-visible:ring-3 aria-invalid:focus-visible:ring-error/20 aria-invalid:focus-visible:ring-offset-1 aria-invalid:focus-visible:ring-offset-error"
);

/**
 * The focused invalid face for a Base UI state root marked `data-invalid`. See
 * {@link ariaInvalidFocusRingClass}; `state-face.ts` composes it into the data-target face.
 */
export const dataInvalidFocusRingClass = cn(
  "data-invalid:focus-visible:ring-3 data-invalid:focus-visible:ring-error/20 data-invalid:focus-visible:ring-offset-1 data-invalid:focus-visible:ring-offset-error"
);

/**
 * The focused invalid face (see {@link ariaInvalidFocusRingClass}) on a within-target group.
 * It reads only the group's own control, a direct child marked `data-focus-ring-control` with
 * `aria-invalid="true"`, as the within state face does. NumberField is covered too, because
 * Base UI stamps `aria-invalid` on its input from the invalid Field. Each selector outweighs the
 * within ring and the halo, so source order never decides it. `state-face.ts` composes it into
 * the within-target face.
 */
export const withinInvalidFocusRingClass = cn(
  "has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-3 has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-error/20 has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-offset-1 has-[>[data-focus-ring-control][aria-invalid=true]:focus-visible]:ring-offset-error"
);

/**
 * The focused invalid face (see {@link ariaInvalidFocusRingClass}) on a within-target host that
 * Base UI marks `data-invalid`, such as Slider's thumb, which paints the ring for the range
 * input nested in it as a direct child.
 * The thumb takes the data-target state face, so its halo and this ring key off the same
 * attribute. The selector outweighs the within ring and the halo.
 */
export const dataWithinInvalidFocusRingClass = cn(
  "data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-3 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-error/20 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-offset-1 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-offset-error"
);

/**
 * The state-target focused invalid face (see {@link ariaInvalidFocusRingClass}), for a React
 * Aria recipe's compound of `isInvalid: true` and `isFocusVisible: true`. A compound applies
 * after both arms, so tailwind-merge keeps its ring over the plain focus ring's.
 */
export const stateInvalidFocusRingVisibleClass = cn("ring-3 ring-error/20 ring-offset-1 ring-offset-error");

/** Icon-crossfade faces. */
export const iconCrossfadeTransition = cn(
  "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
);
export const iconCrossfadeShown = cn("scale-100 opacity-100 blur-none");
export const iconCrossfadeHidden = cn("scale-[0.25] opacity-0 blur-[4px]");
