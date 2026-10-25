/**
 * The facts every popup kit shares: the constant cell predicates, and the variants Base UI stamps on
 * an open popup that the popup's motion classes read.
 */

import type { Cell } from "./component-spec";

/** A predicate that holds in every cell. */
export const always = (): boolean => true;

/** A predicate that holds in no cell. */
export const never = (): boolean => false;

/** The sides Base UI can place a popup on, each of which it stamps as `data-side`. */
const SIDES = ["top", "bottom", "left", "right", "inline-start", "inline-end"] as const;

/** Where the kit draws a popup and whether its cell says it is open. */
export type PopupPlacement = {
  /** The side of its anchor the popup sits on, `bottom` by default. */
  readonly side?: (typeof SIDES)[number];
  /**
   * Whether the cell says `data-open` holds, true by default. False leaves `data-open` out, for a part
   * whose cell cannot say it, such as a submenu's trigger, which an open submenu marks
   * `data-popup-open` instead.
   */
  readonly open?: boolean;
};

/**
 * The variants Base UI stamps on an open popup placed on one side of its anchor: `data-open`, never
 * `data-closed`, and the side it places the popup on. A kit spreads them and adds its own.
 *
 * @param placement - The popup's side and whether `data-open` is listed.
 * @returns Each variant with the cells it holds in.
 */
export function openPopupFacts({ side = "bottom", open = true }: PopupPlacement = {}): ReadonlyMap<
  string,
  (cell: Cell) => boolean
> {
  return new Map<string, (cell: Cell) => boolean>([
    ...(open ? [["data-open", always] as const] : []),
    ["data-closed", never],
    [`data-[side=${side}]`, always],
    ...SIDES.filter((other) => other !== side).map((other) => [`data-[side=${other}]`, never] as const),
  ]);
}
