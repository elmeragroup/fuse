/**
 * Avatar, as one component set: initials or a picture in a circle, at the docs' four sizes, 8
 * cells. An Avatar is not interactive, so the set has no state axis, and its columns are the sizes.
 *
 * - The root is Base UI's `<span data-slot="avatar">`, the recipe's `root` slot: a `muted` circle
 *   that clips what it holds, 32px by default. The docs size demo passes `size-6`, `size-8`,
 *   `size-10` and `size-12` as consumer classes, which the kit merges over the recipe as Avatar
 *   merges its `className`, for 24, 32, 40 and 48px. Its `align-middle` drops, since a variant root
 *   sits in no line of text.
 * - The initials hold no soft wrap opportunity, so the browser sets them on one line at their own
 *   width, and the fallback's label hugs where the fallback centers it (`label-layout.ts`).
 * - A fallback cell holds `<span data-slot="avatar-fallback">`, which fills the circle and centers
 *   the initials `AL` at 14/20 Medium in `muted-foreground`, as every docs demo shows them. The
 *   `Label` text property sets them.
 * - An image cell holds `<img data-slot="avatar-image">`, which fills the circle and shows the docs
 *   portrait as an image paint. Its `object-cover` covers the circle, which the paint draws at FILL.
 *   A designer replaces the picture by changing that fill on an instance.
 * - Avatar group stacks avatars, which waits for kit components that hold instances.
 */
import { readFileSync } from "node:fs";

import { avatarVariants, cn } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, PartDefinition } from "./component-spec";

const SLOTS = avatarVariants();

/**
 * The docs demos' sizes, as consumer classes, by the `size` axis value in pixels, the recipe's 32
 * first. The kit merges them over the recipe as Avatar merges a consumer's `className`, and the
 * compare renderer passes them as that `className`.
 */
export const SIZE_CLASSES: ReadonlyMap<string, string> = new Map([
  ["32", "size-8"],
  ["24", "size-6"],
  ["40", "size-10"],
  ["48", "size-12"],
]);

/**
 * The consumer class of a cell's size.
 *
 * @param cell - An `avatar` cell.
 * @returns The size's class from {@link SIZE_CLASSES}.
 * @throws When the cell names no size the set declares, a defect in the caller's cell.
 */
export function sizeClassFor(cell: Cell): string {
  const classes = cell.size === undefined ? undefined : SIZE_CLASSES.get(cell.size);
  if (classes === undefined) {
    throw new Error(`Avatar has no size ${cell.size ?? ""}`);
  }
  return classes;
}

/**
 * The initials the fallback shows, the default of the `Label` text property, as every docs demo
 * shows them. The compare renderer renders the same text.
 */
export const AVATAR_INITIALS = "AL";

/**
 * The docs portrait as a PNG, which Figma stores where it takes no SVG. The docs demo
 * `avatar-basic.tsx` draws it as an SVG data URI: a `#5b8def` square with a white head and
 * shoulders. On 2026-10-22 Playwright's Chromium drew that data URI in a 96 × 96 `<img>` at a device
 * scale of 1, twice the largest Avatar, and the `<img>`'s element screenshot is the file. The build
 * and the compare renderer both read it here, so Figma and the browser draw the same pixels.
 *
 * @returns The bytes of `avatar-portrait.png`.
 */
export function portraitPng(): Uint8Array {
  return readFileSync(new URL("./avatar-portrait.png", import.meta.url));
}

const holdsImage = (cell: Cell): boolean => cell.content === "image";

/** The initials Base UI renders while no image has loaded. */
const FALLBACK: PartDefinition = {
  key: "fallback",
  slot: "avatar-fallback",
  shownIn: (cell) => !holdsImage(cell),
  classesFor: () => SLOTS.fallback(),
  label: {
    key: "label",
    name: "label",
    characters: AVATAR_INITIALS,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
};

/** The portrait, an `<img>` Base UI keeps mounted. */
const IMAGE: PartDefinition = {
  key: "image",
  slot: "avatar-image",
  shownIn: holdsImage,
  classesFor: () => SLOTS.image(),
  label: undefined,
  iconsFor: () => [],
  image: portraitPng,
};

/**
 * An avatar, as `<Avatar.Root className={sizeClassFor(cell)}>` around `<Avatar.Fallback>AL</Avatar.Fallback>`
 * or the portrait's `<Avatar.Image>`.
 */
export const AVATAR: ComponentDefinition = {
  key: "avatar",
  name: "Avatar",
  slot: "avatar",
  axes: [
    { name: "content", values: ["fallback", "image"] },
    { name: "size", values: [...SIZE_CLASSES.keys()] },
  ],
  columnAxis: "size",
  classesFor: (cell) => cn(SLOTS.root(), sizeClassFor(cell)),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [FALLBACK, IMAGE],
  swapProperties: [],
};
