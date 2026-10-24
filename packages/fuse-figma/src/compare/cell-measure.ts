/**
 * The box a cell compares and the crop the page takes around it. Most cells measure one element. An
 * open composite measures its trigger and its popup, which the page portals beside the trigger in
 * the cell's slot, so its box is the union of the two, as the Figma composite's frame holds both.
 */

import type { PageRect } from "./preview-page.ts";

/**
 * The box of a cell's measured elements.
 *
 * @param boxes - Each measured element's border box in CSS pixels, at least one.
 * @returns The smallest box that holds every one.
 * @throws When given no box, since every cell measures at least one element.
 */
export function measuredBox(boxes: readonly PageRect[]): PageRect {
  if (boxes.length === 0) {
    throw new Error("a cell measures at least one element");
  }
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The crop of a cell: its box with the padding on every side, which must start on the pixel grid
 * and be no larger than the cell's slot.
 *
 * @param id - The cell's id, for the error.
 * @param slot - The cell's slot on the page.
 * @param box - The measured box.
 * @param padding - The space the crop keeps around the box.
 * @returns The crop in CSS pixels.
 * @throws When the box is off the pixel grid or larger than the slot allows, which a renderer or
 *   the page layout must fix.
 */
export function cellClip(id: string, slot: PageRect, box: PageRect, padding: number): PageRect {
  if (Math.abs(box.x - Math.round(box.x)) > 1 / 64 || Math.abs(box.y - Math.round(box.y)) > 1 / 64) {
    throw new Error(`the page placed cell ${id} at ${String(box.x)},${String(box.y)}, off the pixel grid`);
  }
  if (box.width + 2 * padding > slot.width || box.height + 2 * padding > slot.height) {
    throw new Error(`cell ${id} is ${String(box.width)}×${String(box.height)}, larger than its slot`);
  }
  return {
    x: Math.round(box.x) - padding,
    y: Math.round(box.y) - padding,
    width: Math.ceil(box.width) + 2 * padding,
    height: Math.ceil(box.height) + 2 * padding,
  };
}

/**
 * Check that a client cell's crop stays inside its slot, so it shows nothing of a neighbour. Base UI
 * places a popup against its trigger, so a popup that grows past its slot lands in the next one. A
 * static cell's element sits at the slot's padding, give or take a pixel its own markup moves it,
 * as a Sidebar sub button's does, so its size alone keeps its crop clear.
 *
 * @param id - The cell's id, for the error.
 * @param slot - The cell's slot on the page.
 * @param clip - The cell's crop from {@link cellClip}.
 * @throws When the crop reaches past the slot, which the renderer or the page layout must fix.
 */
export function clipInsideSlot(id: string, slot: PageRect, clip: PageRect): void {
  if (
    clip.x < slot.x ||
    clip.y < slot.y ||
    clip.x + clip.width > slot.x + slot.width ||
    clip.y + clip.height > slot.y + slot.height
  ) {
    throw new Error(
      `cell ${id} crops ${String(clip.x)},${String(clip.y)} ${String(clip.width)}×${String(clip.height)}, past its slot at ${String(slot.x)},${String(slot.y)} ${String(slot.width)}×${String(slot.height)}`
    );
  }
}
