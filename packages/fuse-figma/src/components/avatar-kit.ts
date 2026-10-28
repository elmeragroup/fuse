/**
 * Avatar, as two component sets on one page.
 *
 * `Avatar` is initials or a picture in a circle, at the docs' four sizes, 8 cells. An Avatar is not
 * interactive, so the set has no state axis, and its columns are the sizes.
 *
 * - The root is Base UI's `<span data-slot="avatar">`, with `avatarRootClass`: a `muted` circle
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
 *
 * `Avatar group` is the docs Group demo's three avatars: 1 cell. The group's `<div
 * data-slot="avatar-group">` holds an instance of the 32px fallback avatar per person, each showing
 * its initials through `Label`. The demo's avatars hold pictures, but the image avatar's picture is
 * an image paint no instance property sets, so each instance shows the initials its fallback holds.
 *
 * - `-space-x-2` draws as an item spacing of -8, each avatar 8px over the one before, the later on
 *   top, as CSS paints a later sibling (`negativeRowSpacing` in `box-flow.ts`).
 * - `[:where(&>*)]:ring-2 [:where(&>*)]:ring-background` reaches every avatar, so each instance
 *   carries the 2px `background` ring as a shadow override. The avatar root's `muted` fill and its
 *   clipping let the spread draw (probe PR2).
 */
import {
  avatarFallbackClass,
  avatarGroupClass,
  avatarImageClass,
  avatarRootClass,
  cn,
} from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { portraitPng } from "./portrait";

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

const holdsImage = (cell: Cell): boolean => cell.content === "image";

/** The initials Base UI renders while no image has loaded. */
const FALLBACK: PartDefinition = {
  key: "fallback",
  slot: "avatar-fallback",
  shownIn: (cell) => !holdsImage(cell),
  classesFor: () => avatarFallbackClass,
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
  classesFor: () => avatarImageClass,
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
  classesFor: (cell) => cn(avatarRootClass, sizeClassFor(cell)),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [FALLBACK, IMAGE],
  swapProperties: [],
};

/**
 * The initials of the docs Group demo's people, in its order. The compare renderer renders the same
 * initials.
 */
export const AVATAR_GROUP_INITIALS = ["AL", "GH", "KJ"] as const;

/**
 * An avatar of the group, exposed, so a designer retypes its initials from the group's panel.
 *
 * @param initials - The avatar's initials, which the `Label` property sets.
 * @returns The 32px fallback avatar, keyed by its initials.
 */
function memberOf(initials: string): InstanceDefinition {
  return {
    kind: "instance",
    key: initials.toLowerCase(),
    of: AVATAR,
    cell: () => ({ content: "fallback", size: "32" }),
    properties: () => ({ text: { Label: initials } }),
    shownIn: () => true,
    exposed: true,
  };
}

/**
 * A stack of avatars, as `<Avatar.Group>` around three `<Avatar.Root>`s. The recipe declares no axes,
 * so the set's one property, `avatars`, names how many the stack holds.
 */
export const AVATAR_GROUP: ComponentDefinition = {
  key: "avatar-group",
  // CSS leaves the root unclipped, so a ring a layer draws at its edge shows past it (compare-real-1).
  rootOverflow: "visible",
  name: "Avatar group",
  slot: "avatar-group",
  axes: [{ name: "avatars", values: [String(AVATAR_GROUP_INITIALS.length)] }],
  columnAxis: "avatars",
  classesFor: () => avatarGroupClass,
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: AVATAR_GROUP_INITIALS.map(memberOf),
  undrawnChildren: () => 0,
  swapProperties: [],
};
