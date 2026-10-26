/**
 * Rows that hug inside a popup that hugs them. A Dropdown menu popup has no width of its own, so CSS
 * sizes it to its widest row, while a Figma column whose layers all fill hugs only to its `minWidth`
 * (PM). So the row that sets the popup's width hugs, and an instance of a row set drawn at a definite
 * width then draws its filling text at the text's own width (PH2).
 */
import { isDeepStrictEqual } from "node:util";

import { pixelsAcross } from "./box-sizing";
import type { Room } from "./box-sizing";
import type { LayerStyle } from "./cascade";
import type { Cell, InstanceDefinition, PartDefinition } from "./component-spec";
import type { VariableIndex } from "./css-values";
import type { LimitsSpec, NumberSpec, SizeSpec, SizingSpec } from "./kit-spec";
import type { Layout } from "./placement";

/**
 * Whether a text the inner variant fills across draws as the hugging text of the root built in place:
 * on 2026-10-25 Figma drew a FILL text that is a direct child of an instance root set to HUG across at
 * the text's own width, and that width followed the TEXT property, as a hugging text's does (PH2). A
 * text deeper down sizes against the frame around it, which the instance's hug does not reach.
 *
 * @param root - The sizing of the inner root built in place, which the instance takes.
 * @param path - The keys of the layers from the inner root down to the text.
 * @param inPlace - The text's sizing in the root built in place.
 * @param variant - The text's sizing in the inner variant.
 * @returns True where the two draw alike.
 */
export function drawsAtOwnWidth(
  root: SizingSpec,
  path: readonly string[],
  inPlace: SizingSpec,
  variant: SizingSpec
): boolean {
  return (
    root.horizontal.kind === "hug" &&
    path.length === 1 &&
    inPlace.horizontal.kind === "hug" &&
    variant.horizontal.kind === "fill" &&
    isDeepStrictEqual(inPlace.vertical, variant.vertical)
  );
}

/**
 * Whether a part is the row that sets its popup's width in a cell, or holds it in a frame part at any
 * depth, as a Dropdown menu group holds its widest row.
 *
 * @param part - A frame or an instance part.
 * @param cell - The cell of the set the part belongs to.
 * @returns True for the row and every frame around it.
 */
export function holdsWidthRow(part: PartDefinition | InstanceDefinition, cell: Cell): boolean {
  return (
    part.setsWidth?.(cell) === true ||
    (!("kind" in part) &&
      (part.parts ?? []).some((child) => child.shownIn(cell) && holdsWidthRow(child, cell)))
  );
}

/**
 * How a box that hugs its rows sizes them across, or undefined where the rule does not apply. A block
 * box with no width of its own shrinks to fit its widest block, at least its `min-width` (CSS 2.1
 * §10.3.7), and every block in it is that wide (§10.3.3). A Figma column whose layers all fill hugs only
 * to its `minWidth` (PM), and one that hugs a layer takes that layer's width while its filling layers
 * stretch to it (PH2, PF). So in a box that stacks blocks and hugs its width, with a `min-width` or a
 * part that holds the named row, the part that holds the row hugs and every other part fills. A popup
 * that names no row is at its minimum, which its filling rows take.
 *
 * @param box - The box's layout, its width's sizing and its limits.
 * @param holds - Whether each part in its flow holds the named row.
 * @returns HUG or FILL for each part, in order, or undefined where the box is no such popup.
 */
export function rowsAcross(
  box: { readonly layout: Layout; readonly width: SizeSpec; readonly limits: LimitsSpec },
  holds: readonly boolean[]
): readonly SizeSpec[] | undefined {
  const applies =
    box.layout.blocks &&
    box.width.kind === "hug" &&
    (box.limits.minWidth !== undefined || holds.some((each) => each));
  return applies ? holds.map((each) => (each ? HUG_SIZE : FILL_SIZE)) : undefined;
}

const HUG_SIZE: SizeSpec = { kind: "hug" };
const FILL_SIZE: SizeSpec = { kind: "fill" };

/**
 * The least width a popup that hugs its rows keeps its named row at: its `min-width` less its padding
 * across, or, for a frame around the row, what the popup gives it less the frame's own padding, where
 * the padding is the same length in every mode. A hugging instance with that `minWidth` fills its
 * filling text up to it and hugs past it (PH3), so the row never draws narrower than the rows that
 * fill, and never wraps its text where they would.
 *
 * @param own - The box's own `min-width`, or undefined.
 * @param room - What the box around it gives the box, with the minimum it passes down.
 * @param style - The box's style, whose padding across the minimum leaves out.
 * @param variables - The synced variables the padding can read.
 * @returns The minimum as a literal length, or undefined where none reads in pixels.
 */
export function rowMinimum(
  own: NumberSpec | undefined,
  room: Room,
  style: LayerStyle,
  variables: VariableIndex
): NumberSpec | undefined {
  const base = own ?? room.rowMinimum;
  const padding = pixelsAcross(style, ["padding-left", "padding-right"], variables);
  return base?.kind === "literal" && padding !== undefined
    ? { kind: "literal", value: base.value - padding }
    : undefined;
}

/**
 * The room a popup that hugs its rows gives a part: the sizing across `rowsAcross` decides, and, for
 * the part that holds the named row, the minimum it carries down to the row.
 *
 * @param inside - The room the box gives the part before the rule.
 * @param across - The part's sizing across, or undefined where the box is no such popup.
 * @param minimum - The box's row minimum, or undefined.
 * @returns The part's room.
 */
export function rowRoom(inside: Room, across: SizeSpec | undefined, minimum: NumberSpec | undefined): Room {
  const sized =
    across === undefined ? inside : { ...inside, horizontal: { ...inside.horizontal, auto: across } };
  return across?.kind === "hug" && minimum !== undefined ? { ...sized, rowMinimum: minimum } : sized;
}

/**
 * The minimum width a part draws with: the popup's row minimum for the named row, as its own room
 * carries it, and none for any other part.
 *
 * @param part - A frame or an instance part.
 * @param cell - The cell of the set the part belongs to.
 * @param room - The room the part's box gives it.
 * @returns The minimum, or undefined.
 */
export function namedMinimum(
  part: PartDefinition | InstanceDefinition,
  cell: Cell,
  room: Room
): NumberSpec | undefined {
  return part.setsWidth?.(cell) === true ? room.rowMinimum : undefined;
}
