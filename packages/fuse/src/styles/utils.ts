import { cn } from "./cn";
import { tv } from "./tv";

/**
 * The `control` slot's classes for the `within` and `overlay` targets. They cancel the control's
 * own ring and outline, the invalid face's offset line included, so the paired element paints the
 * only indicator.
 */
const controlRingCancel = cn(
  "focus-visible:ring-0 focus-visible:outline-none aria-invalid:focus-visible:ring-0 aria-invalid:focus-visible:ring-offset-0"
);

/**
 * The shared keyboard focus ring, 2px of `--ring` drawn flush against the control with no
 * offset gap. The flush ring keeps one 2px reach in every target, so a ring never paints the
 * page color between itself and the control. `contrast-matrix.test.ts` holds the ring's color
 * to 3:1 against the page and card it is drawn on.
 *
 * - `self` paints on the element that matches `:focus-visible`.
 * - `within` paints on a group whose `data-focus-ring-control` direct child is focus-visible;
 *   its `control` slot cancels the control's own ring so the group paints once. Only a direct
 *   child counts, as in the within state face in `state-face.ts`, so a field box nested in the
 *   group's addon, such as a NumberField, rings itself and leaves the outer group unpainted.
 *   The owner keeps its control as a direct child. A date box, whose segments may sit deeper,
 *   rings through {@link dateBoxFocusRingClass} instead.
 * - `overlay` is for a control whose parent clips, such as a scroll area's viewport, where an
 *   outer box-shadow ring would be clipped away. It draws a 2px `--ring` outline instead, which
 *   forced-colors mode keeps. The outline sits flush with the inside edge of an empty `root`
 *   element that covers the positioned parent's padding box, under the parent's corner radius.
 *   Render `root` as a later sibling of the control, after every positioned sibling it must
 *   paint above. The `control` slot marks the control as the peer, cancels its own ring and
 *   outline as `within` does, and makes the control `isolate` while it is focus-visible. The
 *   control's content then stacks inside the control, whatever its `z-index`, and `root`, at
 *   `z-index: auto`, paints above it. Host content that stacks above the parent still covers
 *   the outline, and stacking outside the focused control does not change.
 *
 * `self` and `within` draw the ring as a box-shadow. Their focused faces use `outline-hidden`,
 * so forced-colors mode, which drops box-shadow, still draws an outline.
 *
 * A focused invalid control on the `self` or `within` target paints the invalid focus face from
 * the constants below instead, which the state face composes: see {@link ariaInvalidFocusRingClass}.
 */
export const focusRing = tv({
  slots: {
    root: "",
    control: "",
  },
  variants: {
    target: {
      self: {
        root: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
      },
      within: {
        root: "has-[>[data-focus-ring-control]:focus-visible]:ring-2 has-[>[data-focus-ring-control]:focus-visible]:ring-ring has-[>[data-focus-ring-control]:focus-visible]:outline-hidden",
        control: controlRingCancel,
      },
      overlay: {
        root: [
          "pointer-events-none absolute inset-0 rounded-[inherit]",
          "peer-focus-visible/focus-ring-control:outline-2 peer-focus-visible/focus-ring-control:-outline-offset-2 peer-focus-visible/focus-ring-control:outline-ring",
        ],
        control: ["peer/focus-ring-control focus-visible:isolate", controlRingCancel],
      },
    },
  },
  defaultVariants: {
    target: "self",
  },
});

/**
 * The self-target focus ring, resolved once at module scope. Components import it instead of
 * calling `focusRing({ target: "self" }).root()` themselves, so the adapter runs once per process
 * rather than once per module.
 */
export const selfFocusRingClass = focusRing({ target: "self" }).root();

/**
 * The within-target focus ring root class, resolved once at module scope. It is the parent
 * face that lights up when the element carrying `data-focus-ring-control` is
 * keyboard-focused. Pair it with {@link withinFocusRingControlClass} on the control.
 */
export const withinFocusRingClass = focusRing({ target: "within" }).root();

/**
 * The control half of the within-target focus ring: it suppresses the control's own
 * ring, the invalid face's offset line included, so only the parent paints one. Pair with
 * {@link withinFocusRingClass} or {@link dateBoxFocusRingClass}.
 */
export const withinFocusRingControlClass = focusRing({ target: "within" }).control();

/**
 * The keyboard focus outline drawn 2px inside the element, in the `--ring` color, for a box that a
 * clipping parent would cut an outer ring from, such as a scrolling table. An outline paints above
 * the element's in-flow content but below a positioned descendant, and forced-colors mode keeps it.
 */
export const insetFocusOutlineClass = cn(
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
);

/**
 * The overlay-target focus ring class, resolved once at module scope, for the empty element that
 * follows a clipped control as its sibling and draws the control's focus outline. Pair it with
 * {@link overlayFocusRingControlClass} on the control.
 */
export const overlayFocusRingClass = focusRing({ target: "overlay" }).root();

/**
 * The control half of the overlay-target focus ring. It marks the control as the overlay's peer,
 * suppresses the control's own ring and outline, so only the overlay draws one, and makes the
 * control `isolate` while it is focus-visible. Pair with {@link overlayFocusRingClass}.
 */
export const overlayFocusRingControlClass = focusRing({ target: "overlay" }).control();

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
 * The focused invalid face of {@link ariaInvalidFocusRingClass} on a within-target group.
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
 * The focused invalid face of {@link ariaInvalidFocusRingClass} on a within-target host that
 * Base UI marks `data-invalid`, such as Slider's thumb, which paints the ring for the range
 * input nested in it as a direct child.
 * The thumb takes the data-target state face, so its halo and this ring key off the same
 * attribute. The selector outweighs the within ring and the halo.
 */
export const dataWithinInvalidFocusRingClass = cn(
  "data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-3 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-error/20 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-offset-1 data-invalid:has-[>[data-focus-ring-control]:focus-visible]:ring-offset-error"
);

/**
 * The focus ring of a date box: DateField's box, a picker's group and a picker popup's time
 * input. The box rings while one of its segments matches `:focus-visible`, and paints the invalid
 * focus face of {@link dataInvalidFocusRingClass} instead while the box carries
 * `data-invalid` or `aria-invalid="true"`. Its `date-box-focus` variant lives in `fuse.css`.
 */
export const dateBoxFocusRingClass = cn(
  "date-box-focus:ring-2 date-box-focus:ring-ring date-box-focus:outline-hidden",
  "data-invalid:date-box-focus:ring-3 data-invalid:date-box-focus:ring-error/20 data-invalid:date-box-focus:ring-offset-1 data-invalid:date-box-focus:ring-offset-error",
  "aria-invalid:date-box-focus:ring-3 aria-invalid:date-box-focus:ring-error/20 aria-invalid:date-box-focus:ring-offset-1 aria-invalid:date-box-focus:ring-offset-error"
);

/** Icon-crossfade faces. */
export const iconCrossfadeTransition = cn(
  "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
);
export const iconCrossfadeShown = cn("scale-100 opacity-100 blur-none");
export const iconCrossfadeHidden = cn("scale-[0.25] opacity-0 blur-[4px]");
