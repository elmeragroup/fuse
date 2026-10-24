/**
 * The room a popup has. Base UI writes `--available-height` on a popup's positioner: the height
 * between the anchor and the viewport's edge, less the collision padding. The kit draws each popup
 * with room to spare, so that height never caps it, and a `max-height` that reads it caps the popup
 * only where another length in a `min()` beside it does, as the Combobox list caps at 252px.
 */
import { isInfiniteLength, readNumber, substituteVars } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { NumberSpec } from "./kit-spec";

/** The custom property Base UI writes with a popup's available height. */
const AVAILABLE_HEIGHT = "--available-height";

/** Why a maximum at the available height drops, and why one beside it caps at its other length. */
export const WITH_ROOM = "the kit draws a popup with room, so the available height never caps it";

/**
 * What a maximum that reads the available height caps at in the kit: nothing, a length, or a value
 * the build cannot read, which stays unmapped.
 */
export type RoomyMaximum =
  | { readonly kind: "none" }
  | { readonly kind: "length"; readonly value: NumberSpec }
  | { readonly kind: "unread" };

/**
 * Read a declared maximum that reads `--available-height` with that height unbounded, as a popup
 * with room has it.
 *
 * @param declared - The maximum as declared, before its variables are substituted.
 * @param variables - The synced variables the remaining length can bind.
 * @returns What the maximum caps at, or undefined where it does not read the available height.
 */
export function roomyMaximum(declared: string, variables: VariableIndex): RoomyMaximum | undefined {
  if (!declared.includes(`var(${AVAILABLE_HEIGHT})`)) {
    return undefined;
  }
  const unbounded = substituteVars(
    declared,
    (name) => (name === AVAILABLE_HEIGHT ? { value: "calc(infinity * 1px)", computed: true } : undefined),
    () => false,
    new Set()
  );
  if (unbounded === undefined) {
    return { kind: "unread" };
  }
  if (isInfiniteLength(unbounded)) {
    return { kind: "none" };
  }
  const value = readNumber(unbounded, variables);
  return value === undefined ? { kind: "unread" } : { kind: "length", value };
}
