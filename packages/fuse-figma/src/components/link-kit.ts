/**
 * Link, as one component set on the Link page: each color variant at each underline, in three
 * states, 54 cells.
 *
 * `Link` renders an `<a data-slot="link">` whose classes are `linkVariants` at its variant and
 * underline. An `always` underline rests in its text color's `/35` role tint, which
 * `readDecorationColor` in `label-layout.ts` explains. The page forces hover and focus itself: a
 * hover draws an `always` underline in the text's own color, draws a `hover` one and fades a `none`
 * link through `enabled-hover:`, and keyboard focus draws the shared self focus ring. A link has no
 * disabled state.
 *
 * The set crosses the two axes the docs demos vary, `variant` and `underline`. No demo sets
 * `weight` on a link, which takes its sentence's weight, so the text keeps the host page's.
 * `truncate` cuts a link's text only where its container is narrower than the text, as the
 * Truncate demo's row is, and a link in a hugging Figma frame keeps its text's own width past a
 * limit (P7), so the set leaves it off. The External link demo's icon is left off too, so the set
 * omits the icon selectors.
 */
import { linkVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition } from "./component-spec";
import { HOST_TYPE } from "./host-type";
import { ownKey } from "./own-key";

type LinkVariant = keyof typeof linkVariants.variants.variant;
type LinkUnderline = keyof typeof linkVariants.variants.underline;

function isVariant(value: string | undefined): value is LinkVariant {
  return ownKey(linkVariants.variants.variant, value);
}

function isUnderline(value: string | undefined): value is LinkUnderline {
  return ownKey(linkVariants.variants.underline, value);
}

/** Every variant the recipe declares, in its order, so a new one reaches Figma too. */
const VARIANTS = Object.keys(linkVariants.variants.variant).filter(isVariant);

/** The underlines in the recipe's order, its default `always` first. */
const UNDERLINES = Object.keys(linkVariants.variants.underline).filter(isUnderline);

/**
 * The text every cell shows, the default of the `Label` text property: the link of the docs React
 * Aria demo. The compare renderer renders the same text.
 */
export const LINK_LABEL = "invoice 1042";

/** A cell's look, as `Link`'s `variant` and `underline` props take it. */
export type LinkLooks = { readonly variant: LinkVariant; readonly underline: LinkUnderline };

/**
 * A cell's variant and underline, which the kit draws and the compare renderer passes to `Link`.
 *
 * @throws When the cell names a variant or underline the recipe does not declare, a defect in the
 *   caller's cell.
 */
export function linkLooks(cell: Cell): LinkLooks {
  const { variant, underline } = cell;
  if (!isVariant(variant) || !isUnderline(underline)) {
    throw new Error(`Link has no variant ${variant ?? ""} or underline ${underline ?? ""}`);
  }
  return { variant, underline };
}

/** The classes `Link` gives a cell: the recipe at the cell's variant and underline. */
function classesFor(cell: Cell): string {
  return linkVariants(linkLooks(cell));
}

/** A link, as `<Link href="/invoices/1042">invoice 1042</Link>` at a variant and underline. */
export const LINK: ComponentDefinition = {
  key: "link",
  name: "Link",
  slot: "link",
  inheritedFor: () => HOST_TYPE,
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "underline", values: UNDERLINES },
    { name: "state", values: ["rest", "hover", "focus"] },
  ],
  columnAxis: "state",
  classesFor,
  states: {},
  facts: new Map(),
  // A cell holds the label alone, so no icon child takes the icon gap or keeps the link on one line.
  omittedStates: new Set([
    "[&>[data-icon=inline-end]]",
    "[&>[data-icon=inline-start]]",
    "has-[>[data-icon]]",
  ]),
  label: {
    key: "label",
    name: "label",
    characters: LINK_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};
