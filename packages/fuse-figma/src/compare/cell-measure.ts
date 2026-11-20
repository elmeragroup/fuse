/**
 * The box a cell compares and the crop the page takes around it. Most cells measure one element. An
 * open composite measures its trigger and its popup, which the page portals beside the trigger in
 * the cell's slot, so its box is the union of the two, as the Figma composite's frame holds both.
 */

import type { CellContent, PageRect } from "./preview-page.ts";

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
 * The crop around a cell's box: the box's edges rounded out to whole CSS pixels, with the padding on
 * every side.
 *
 * @param box - The measured box.
 * @param padding - The space the crop keeps around the box.
 * @returns The crop in CSS pixels.
 */
function cropAround(box: PageRect, padding: number): PageRect {
  return {
    x: Math.round(box.x) - padding,
    y: Math.round(box.y) - padding,
    width: Math.ceil(box.width) + 2 * padding,
    height: Math.ceil(box.height) + 2 * padding,
  };
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
  return cropAround(box, padding);
}

/**
 * The part of a cell's crop that lies inside its slot: the whole crop, or the crop less the strip of
 * at most {@link STATIC_CROP_ALLOWANCE} that a static cell's crop reaches past the slot. The slot
 * clips its own cell's paint, so that strip can hold only a neighbor's paint, and the page
 * screenshots this part alone and leaves the strip transparent.
 *
 * @param crop - The cell's crop from {@link cellClip}.
 * @param slot - The cell's slot on the page.
 * @returns The crop's intersection with the slot, in CSS pixels.
 */
export function cropInSlot(crop: PageRect, slot: PageRect): PageRect {
  const x = Math.max(crop.x, slot.x);
  const y = Math.max(crop.y, slot.y);
  return {
    x,
    y,
    width: Math.min(crop.x + crop.width, slot.x + slot.width) - x,
    height: Math.min(crop.y + crop.height, slot.y + slot.height) - y,
  };
}

/** How far past a slot's edge a laid-out box may reach, for the subpixel rounding of its edges. */
const SLOT_TOLERANCE = 1 / 64;

/**
 * How far past its slot a static cell's crop may reach, in CSS pixels. Fuse's `Sidebar.MenuSubButton`
 * carries `-translate-x-px`, so the button sits 1px outside the sub menu that hosts it, and each
 * `sidebar-menu-sub-button` cell's crop starts 1px before its slot. The slot clips its paint to its
 * own rect, so the button paints nothing past the slot and the neighbor's crop stays as it is. The
 * strip of the crop past the slot holds only the neighbor's paint, which {@link cropInSlot} leaves
 * out of the screenshot. A
 * client cell's crop gets no allowance, since Base UI places its popup and a popup past the slot
 * lands in the next one.
 */
const STATIC_CROP_ALLOWANCE = 1;

/** A host in a cell's slot: its border box in CSS pixels, and a name for messages. */
export type SlotHost = PageRect & {
  /** The host's tag and `data-slot`, such as `div` or `div[data-slot=action-bar]`. */
  readonly label: string;
};

/** What a cell's slot holds, as the page lays it out in the state the cell shows. */
export type SlotContents = {
  /** The cell's name, such as its variant key, for the message. */
  readonly name: string;
  /** The cell's slot on the page. */
  readonly slot: PageRect;
  /** Whether the slot holds static markup or a client cell, which sets how far its crop may reach. */
  readonly content: CellContent["_tag"];
  /** The elements the slot holds directly, or a client slot's mount root and portals hold. */
  readonly hosts: readonly SlotHost[];
  /** The border box of each measured element. */
  readonly measured: readonly PageRect[];
};

function inside(box: PageRect, slot: PageRect, reach = 0): boolean {
  const margin = reach + SLOT_TOLERANCE;
  return (
    box.x >= slot.x - margin &&
    box.y >= slot.y - margin &&
    box.x + box.width <= slot.x + slot.width + margin &&
    box.y + box.height <= slot.y + slot.height + margin
  );
}

function rectText(box: PageRect, slot: PageRect): string {
  return `${String(box.width)}×${String(box.height)} at ${String(box.x - slot.x)},${String(box.y - slot.y)}`;
}

/**
 * Check that a cell stays inside its slot, so it neither lays out over the next cell nor shows any of
 * it. Each host must lay out inside the slot: a renderer can mount a host wider than the root it
 * measures, as Action bar's 576px host is, and the slot spans the host only when the renderer names
 * its width in `hostWidth`. The crop, the measured box with the padding around it, must lie inside
 * the slot too, give or take {@link STATIC_CROP_ALLOWANCE} for a static cell. Content past a host's box is not checked, since each slot clips its paint to its
 * own rect.
 *
 * @param contents - The cell's slot and what it holds.
 * @param padding - The space the crop keeps around the measured box.
 * @returns Undefined when the cell fits, or a line that names the cell, its slot, and each host or
 *   the crop that reaches past it, with positions from the slot's corner.
 */
export function slotBreach(
  { name, slot, content, hosts, measured }: SlotContents,
  padding: number
): string | undefined {
  const crop = cropAround(measuredBox(measured), padding);
  const cropReach = content === "Static" ? STATIC_CROP_ALLOWANCE : 0;
  const past = [
    ...hosts.filter((host) => !inside(host, slot)).map((host) => `${host.label} ${rectText(host, slot)}`),
    ...(inside(crop, slot, cropReach) ? [] : [`its crop ${rectText(crop, slot)}`]),
  ];
  return past.length === 0
    ? undefined
    : `${name} reaches past its ${String(slot.width)}×${String(slot.height)} slot: ${past.join(", ")}`;
}
