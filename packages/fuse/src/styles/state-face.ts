import { cn } from "./cn";

/**
 * The state face of a whole interactive control: the one disabled look (`opacity-50` plus
 * the `not-allowed` cursor) and the one invalid look (`border-error`, a 3px ring, and
 * `ring-error/20`). Hover and press stay still on a disabled control through the
 * `enabled-hover:` and `enabled-active:` variants in `fuse.css`, which skip `:disabled`,
 * `data-disabled` and `aria-disabled="true"`. That gate is the only mechanism, so no face
 * drops pointer events and a Tooltip on a disabled control still opens.
 *
 * Each target is exported as fixed class constants, named for where a control reads its
 * state, as the focus-ring targets are:
 *
 * - `native` keys off `:disabled`, for native `<button>`, `<input>` and `<textarea>` roots.
 * - `data` keys off Base UI's `data-disabled` and `data-invalid` state attributes, for roots
 *   that never match `:disabled`, such as a `<span>` radio or a `render={<a />}` button.
 * - `aria` keys off `aria-disabled="true"` and `aria-invalid` alone, for a box that carries
 *   those attributes itself but is neither a native control nor a Base UI state root.
 *
 * The `native` and `data` faces carry the `aria` arms as well. The hover gate treats
 * `aria-disabled="true"` as disabled on every control, and any control can be announced
 * unavailable while it stays activatable, so every target that dims must dim for it too.
 * Composing the arms here rather than at each call site means no control can take the gate
 * without the look.
 *
 * - `rac` is the disabled or invalid look alone, with no selector, for a recipe told the
 *   state through a prop or render prop (React Aria wrappers, CheckboxCard's `isDisabled`).
 *   The recipe puts it on its own `isDisabled` or `isInvalid` arm.
 * - `within` keys off the group's own control: a direct child marked
 *   `data-focus-ring-control` (`:disabled`, `aria-disabled="true"`, `aria-invalid`), for a
 *   group whose box is the control (InputGroup, Combobox chips, NumberField). Each owner keeps
 *   its control as a direct child, so a control nested deeper, such as a NumberField inside an
 *   InputGroup addon, belongs to its own owner and never paints the outer group. The control
 *   face goes on the owned control: it keeps the `not-allowed` cursor there, since the browser
 *   gives a disabled input its own cursor, and cancels the dim and ring an embedded control
 *   paints itself (InputGroup's Input), so the face paints once.
 *
 * A control composes every target its state can arrive through. Button, for example, is a
 * native button and a Base UI root at once, so it takes the `native` and `data` targets.
 *
 * The face covers whole controls only. Parts (calendar cells, date segments, the
 * search-field icon, labels that dim beside their control) keep their own muted text colour
 * and are not state faces.
 */

const ariaDisabledFace = cn("aria-disabled:cursor-not-allowed aria-disabled:opacity-50");

const ariaInvalidFace = cn("aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20");

/** The native-target state face: `:disabled` plus the aria arms. */
export const nativeStateFaceClass = cn(
  "disabled:cursor-not-allowed disabled:opacity-50",
  ariaDisabledFace,
  ariaInvalidFace
);

/** The data-target state face: Base UI's `data-disabled` and `data-invalid` plus the aria arms. */
export const dataStateFaceClass = cn(
  ariaDisabledFace,
  ariaInvalidFace,
  "data-invalid:border-error data-invalid:ring-3 data-invalid:ring-error/20",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50"
);

/** The aria-target state face: `aria-disabled="true"` and `aria-invalid`. */
export const ariaStateFaceClass = cn(ariaDisabledFace, ariaInvalidFace);

/**
 * The rac-target disabled face. A recipe puts it on its `isDisabled: true` arm, because a
 * prop or render prop reports the state there, not a selector.
 */
export const racDisabledStateFaceClass = cn("cursor-not-allowed opacity-50");

/** The rac-target invalid face, for a recipe's `isInvalid: true` arm. */
export const racInvalidStateFaceClass = cn("border-error ring-3 ring-error/20");

/**
 * The within-target state face on the group. It reads only a direct child marked
 * `data-focus-ring-control`, so the owner must keep its control as a direct child: a control
 * wrapped in another element, or nested in an addon, does not reach this group. Pair it with
 * {@link withinStateFaceControlClass} on that control.
 */
export const withinStateFaceClass = cn(
  "has-[>[data-focus-ring-control]:disabled]:cursor-not-allowed has-[>[data-focus-ring-control]:disabled]:opacity-50",
  "has-[>[data-focus-ring-control][aria-disabled=true]]:cursor-not-allowed has-[>[data-focus-ring-control][aria-disabled=true]]:opacity-50",
  "has-[>[data-focus-ring-control][aria-invalid=true]]:border-error has-[>[data-focus-ring-control][aria-invalid=true]]:ring-3 has-[>[data-focus-ring-control][aria-invalid=true]]:ring-error/20"
);

/**
 * The control half of the within-target state face: it keeps the `not-allowed` cursor on the
 * owned control and cancels the control's own dim and ring so only the group paints them.
 * Pair with {@link withinStateFaceClass}.
 */
export const withinStateFaceControlClass = cn(
  "disabled:cursor-not-allowed disabled:opacity-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-100 aria-invalid:ring-0"
);
