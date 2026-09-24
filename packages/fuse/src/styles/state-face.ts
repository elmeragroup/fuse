import { tv } from "tailwind-variants";

/**
 * The state face of a whole interactive control: the one disabled look (`opacity-50` plus
 * the `not-allowed` cursor) and the one invalid look (`border-error`, a 3px ring, and
 * `ring-error/20`). Hover and press stay still on a disabled control through the
 * `enabled-hover:` and `enabled-active:` variants in `fuse.css`, which skip `:disabled`,
 * `data-disabled` and `aria-disabled="true"`. That gate is the only mechanism, so no face
 * drops pointer events and a Tooltip on a disabled control still opens.
 *
 * The `target` axis names where the control reads its state, as `focusRing` does for focus:
 *
 * - `native` keys off `:disabled`, for native `<button>`, `<input>` and `<textarea>` roots.
 * - `data` keys off Base UI's `data-disabled` and `data-invalid` state attributes, for roots
 *   that never match `:disabled`, such as a `<span>` radio or a `render={<a />}` button.
 * - `aria` keys off `aria-disabled="true"` and `aria-invalid` alone, for a box that carries
 *   those attributes itself but is neither a native control nor a Base UI state root.
 *
 * The `native` and `data` roots carry the `aria` arms as well. The hover gate treats
 * `aria-disabled="true"` as disabled on every control, and any control can be announced
 * unavailable while it stays activatable, so every target that dims must dim for it too.
 * Keeping the arms in the recipe rather than at each call site means no control can take
 * the gate without the look.
 * - `rac` takes React Aria's `isDisabled` and `isInvalid` render props, for the interim
 *   tier's non-focusable wrappers.
 * - `within` keys off the embedded control marked `data-focus-ring-control` (`:disabled`,
 *   `aria-disabled="true"`, `aria-invalid`), for a group whose box is the control
 *   (InputGroup, Combobox chips, NumberField). Its `control` slot goes on the embedded
 *   control: it keeps the `not-allowed` cursor there, since the browser gives a disabled
 *   input its own cursor, and cancels the dim and ring an embedded control paints itself
 *   (InputGroup's Input), so the face paints once.
 *
 * A control composes every target its state can arrive through. Button, for example, is a
 * native button and a Base UI root at once, so it takes the `native` and `data` targets.
 *
 * The face covers whole controls only. Parts (calendar cells, date segments, the
 * search-field icon, labels that dim beside their control) keep their own muted text colour
 * and are not state faces.
 */
export const stateFace = tv({
  slots: {
    root: "",
    control: "",
  },
  variants: {
    target: {
      native: {
        root: "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
      },
      data: {
        root: "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 data-invalid:border-error data-invalid:ring-3 data-invalid:ring-error/20 data-disabled:cursor-not-allowed data-disabled:opacity-50",
      },
      aria: {
        root: "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
      },
      rac: {
        root: "",
      },
      within: {
        root: "has-[[data-focus-ring-control]:disabled]:cursor-not-allowed has-[[data-focus-ring-control]:disabled]:opacity-50 has-[[data-focus-ring-control][aria-disabled=true]]:cursor-not-allowed has-[[data-focus-ring-control][aria-disabled=true]]:opacity-50 has-[[data-focus-ring-control][aria-invalid=true]]:border-error has-[[data-focus-ring-control][aria-invalid=true]]:ring-3 has-[[data-focus-ring-control][aria-invalid=true]]:ring-error/20",
        control:
          "disabled:cursor-not-allowed disabled:opacity-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-100 aria-invalid:ring-0",
      },
    },
    isDisabled: {
      true: {},
      false: {},
    },
    isInvalid: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      target: "rac",
      isDisabled: true,
      class: { root: "cursor-not-allowed opacity-50" },
    },
    {
      target: "rac",
      isInvalid: true,
      class: { root: "border-error ring-3 ring-error/20" },
    },
  ],
  defaultVariants: {
    target: "native",
  },
});

/** The native-target state face, resolved once: `:disabled` plus the aria arms. */
export const nativeStateFaceClass = stateFace({ target: "native" }).root();

/** The data-target state face, resolved once: Base UI's `data-disabled` and `data-invalid` plus the aria arms. */
export const dataStateFaceClass = stateFace({ target: "data" }).root();

/** The aria-target state face, resolved once: `aria-disabled="true"` and `aria-invalid`. */
export const ariaStateFaceClass = stateFace({ target: "aria" }).root();

/**
 * The rac-target disabled face, resolved once. A recipe puts it on its `isDisabled: true`
 * arm, because React Aria reports the state through a render prop, not a selector.
 */
export const racDisabledStateFaceClass = stateFace({ target: "rac", isDisabled: true }).root();

/** The rac-target invalid face, resolved once, for a recipe's `isInvalid: true` arm. */
export const racInvalidStateFaceClass = stateFace({ target: "rac", isInvalid: true }).root();

/**
 * The within-target state face on the group, resolved once. Pair it with
 * {@link withinStateFaceControlClass} on the control marked `data-focus-ring-control`.
 */
export const withinStateFaceClass = stateFace({ target: "within" }).root();

/**
 * The control half of the within-target state face: it keeps the `not-allowed` cursor on the
 * embedded control and cancels the control's own dim and ring so only the group paints them.
 * Pair with {@link withinStateFaceClass}.
 */
export const withinStateFaceControlClass = stateFace({ target: "within" }).control();
