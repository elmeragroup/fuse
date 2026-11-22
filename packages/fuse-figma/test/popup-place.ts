/**
 * Where Base UI places an anchored popup against its trigger, and where a pivot puts a layer's centre,
 * shared by the suites that measure a real Fuse popup's arrow in Chromium. A suite waits until the
 * popup sits where {@link placedBeside} says, since the pass that places the popup also writes its
 * arrow's offset, and then reads the arrow against the spec's centre.
 */
import type { PivotSpec } from "../src/components/kit-spec.ts";

/** A box's place and size, in CSS pixels from the page's top left corner. */
export type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** How far apart, in CSS pixels, a popup may sit from Base UI's place for it: a 64th of a pixel. */
const PLACE_TOLERANCE_PX = 1 / 64;

/**
 * Where Base UI puts a popup's top left corner against its trigger: on `side`, `offset` away from it,
 * and centred on it across that side.
 *
 * @param side - The side of the trigger the popup opens on: `top`, `bottom`, `left` or `right`.
 * @param popup - The popup's border box, for its size.
 * @param trigger - The trigger's border box.
 * @param offset - The popup's `sideOffset`.
 * @returns The popup's left and top edges.
 */
export function placeFor(side: string, popup: Box, trigger: Box, offset: number) {
  const centredLeft = trigger.left + trigger.width / 2 - popup.width / 2;
  const centredTop = trigger.top + trigger.height / 2 - popup.height / 2;
  switch (side) {
    case "top":
      return { left: centredLeft, top: trigger.top - offset - popup.height };
    case "bottom":
      return { left: centredLeft, top: trigger.top + trigger.height + offset };
    case "left":
      return { left: trigger.left - offset - popup.width, top: centredTop };
    default:
      return { left: trigger.left + trigger.width + offset, top: centredTop };
  }
}

/**
 * Whether Base UI has placed a popup where {@link placeFor} says, within a 64th of a pixel.
 *
 * @param side - The side the popup opens on.
 * @param popup - The popup's border box.
 * @param trigger - The trigger's border box.
 * @param offset - The popup's `sideOffset`.
 * @returns True once the popup sits there.
 */
export function placedBeside(side: string, popup: Box, trigger: Box, offset: number): boolean {
  const expected = placeFor(side, popup, trigger, offset);
  return (
    Math.abs(expected.left - popup.left) <= PLACE_TOLERANCE_PX &&
    Math.abs(expected.top - popup.top) <= PLACE_TOLERANCE_PX
  );
}

/**
 * Where a pivot puts a layer's centre in a parent of `width` × `height`.
 *
 * @param pivot - The layer's place by its centre.
 * @param width - The parent's width.
 * @param height - The parent's height.
 * @returns The centre, from the parent's top left corner.
 */
export function specCentre(pivot: PivotSpec, width: number, height: number) {
  switch (pivot.edge) {
    case "top":
      return { x: width / 2 + pivot.along, y: pivot.inset };
    case "bottom":
      return { x: width / 2 + pivot.along, y: height - pivot.inset };
    case "left":
      return { x: pivot.inset, y: height / 2 + pivot.along };
    case "right":
      return { x: width - pivot.inset, y: height / 2 + pivot.along };
  }
}
