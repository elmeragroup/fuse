/**
 * The room a popup has. Base UI writes `--available-height` and `--available-width` on a popup's
 * positioner: the room between the anchor and the viewport's edge on each axis, less the collision
 * padding. The kit draws each popup with room to spare, so that room never caps it, and a maximum
 * that reads it caps the popup only where another length in a `min()` beside it does, as the
 * Combobox list caps at 252px.
 */
import { isInfiniteLength, readNumber, substituteVars } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { NumberSpec } from "./kit-spec";

/** The custom property Base UI writes with a popup's available room along the axis a maximum caps. */
const AVAILABLE = { "max-height": "--available-height", "max-width": "--available-width" } as const;

/** A maximum that may read a popup's available room. */
export type PopupMaximum = keyof typeof AVAILABLE;

/**
 * Why a maximum at the available room drops, and why one beside it caps at its other length.
 *
 * @param maximum - The maximum's property.
 * @returns The reason, naming the axis.
 */
export function withRoom(maximum: PopupMaximum): string {
  const axis = maximum === "max-width" ? "width" : "height";
  return `the kit draws a popup with room, so the available ${axis} never caps it`;
}

/**
 * What a maximum that reads the available room caps at in the kit: nothing, a length, or a value
 * the build cannot read, which stays unmapped.
 */
export type RoomyMaximum =
  | { readonly kind: "none" }
  | { readonly kind: "length"; readonly value: NumberSpec }
  | { readonly kind: "unread" };

/**
 * Read a declared maximum that reads its axis's available room with that room unbounded, as a popup
 * with room has it.
 *
 * @param maximum - The maximum's property.
 * @param declared - The maximum as declared, before its variables are substituted.
 * @param variables - The synced variables the remaining length can bind.
 * @returns What the maximum caps at, or undefined where it does not read the available room.
 */
export function roomyMaximum(
  maximum: PopupMaximum,
  declared: string,
  variables: VariableIndex
): RoomyMaximum | undefined {
  const available = AVAILABLE[maximum];
  if (!declared.includes(`var(${available})`)) {
    return undefined;
  }
  const unbounded = substituteVars(
    declared,
    (name) => (name === available ? { value: "calc(infinity * 1px)", computed: true } : undefined),
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
