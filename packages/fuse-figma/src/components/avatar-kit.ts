/**
 * Avatar, as two component sets on one page.
 *
 * `Avatar` is initials or a picture in a circle, at the docs' four sizes, 8 cells. An Avatar is not
 * interactive, so the set has no state axis, and its columns are the sizes.
 *
 * - The root is Base UI's `<span data-slot="avatar">`. The docs size demo passes `size-6`, `size-8`,
 *   `size-10` and `size-12` as consumer classes, for 24, 32, 40 and 48px.
 * - A fallback cell holds `<span data-slot="avatar-fallback">` with the initials `AL`, as every docs
 *   demo shows them. The `Label` text property sets them.
 * - An image cell holds `<img data-slot="avatar-image">`, which shows the docs portrait as an image
 *   paint. A designer replaces the picture by changing that fill on an instance.
 *
 * `Avatar group` is the docs Group demo's three avatars: 1 cell. The group's `<div
 * data-slot="avatar-group">` holds an instance of the 32px fallback avatar per person, each showing
 * its initials through `Label`. The demo's avatars hold pictures, but the image avatar's picture is
 * an image paint no instance property sets, so each instance shows the initials its fallback holds.
 */
import type { InstanceManifest, LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { portraitPng } from "./portrait";

/**
 * The docs demos' sizes, as consumer classes, by the `size` axis value in pixels, the recipe's 32
 * first. The compare renderer passes them as Avatar's `className`.
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

/** The initials, which the `Label` text property sets. */
const INITIALS: LabelManifest = {
  key: "label",
  name: "label",
  characters: AVATAR_INITIALS,
  textProperty: "Label",
  shownIn: () => true,
};

/**
 * The avatar's parts: the initials Base UI renders while no image has loaded, or the portrait, an
 * `<img>` Base UI keeps mounted.
 */
const AVATAR_PARTS: readonly PartManifest[] = [
  {
    key: "fallback",
    slot: "avatar-fallback",
    shownIn: (cell) => !holdsImage(cell),
    label: INITIALS,
    iconsFor: () => [],
  },
  {
    key: "image",
    slot: "avatar-image",
    shownIn: holdsImage,
    image: portraitPng,
    label: undefined,
    iconsFor: () => [],
  },
];

/**
 * The avatar's manifest, which the capture-backed build reads with `captures/avatar.json`: an
 * avatar, as `<Avatar.Root className={sizeClassFor(cell)}>` around
 * `<Avatar.Fallback>AL</Avatar.Fallback>` or the portrait's `<Avatar.Image>`.
 */
export const AVATAR_MANIFEST: SetManifest = {
  key: "avatar",
  name: "Avatar",
  slot: "avatar",
  axes: [
    { name: "content", values: ["fallback", "image"] },
    { name: "size", values: [...SIZE_CLASSES.keys()] },
  ],
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [],
  parts: AVATAR_PARTS,
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
function memberManifest(initials: string): InstanceManifest {
  return {
    kind: "instance",
    key: initials.toLowerCase(),
    of: AVATAR_MANIFEST,
    cell: () => ({ content: "fallback", size: "32" }),
    properties: () => ({ text: { Label: initials } }),
    shownIn: () => true,
    exposed: true,
  };
}

/**
 * The group's manifest, which the capture-backed build reads with `captures/avatar-group.json`: a
 * stack of avatars, as `<Avatar.Group>` around three `<Avatar.Root>`s. The recipe declares no axes,
 * so the set's one property, `avatars`, names how many the stack holds.
 */
export const AVATAR_GROUP_MANIFEST: SetManifest = {
  key: "avatar-group",
  name: "Avatar group",
  slot: "avatar-group",
  axes: [{ name: "avatars", values: [String(AVATAR_GROUP_INITIALS.length)] }],
  columnAxis: "avatars",
  label: undefined,
  iconsFor: () => [],
  parts: AVATAR_GROUP_INITIALS.map(memberManifest),
  swapProperties: [],
};
