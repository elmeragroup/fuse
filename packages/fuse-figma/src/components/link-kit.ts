/**
 * Link, as one component set on the Link page: each color variant at each underline, in three
 * states, 54 cells. `Link` renders an `<a data-slot="link">`. A link has no disabled state.
 *
 * The set crosses the two axes the docs demos vary, `variant` and `underline`. No demo sets
 * `weight` on a link, which takes its sentence's weight, so the text keeps the host page's.
 * `truncate` cuts a link's text only where its container is narrower than the text, as the
 * Truncate demo's row is, and a link in a hugging Figma frame keeps its text's own width past a
 * limit (P7), so the set leaves it off. The set also leaves off the External link demo's icon.
 */
import { linkVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
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
 * The text every cell shows, the default of the `Label` text property: the link of the docs Router
 * links example. The compare renderer renders the same text.
 */
export const LINK_LABEL = "invoice 1042";

/** A cell's look, as `Link`'s `variant` and `underline` props take it. */
export type LinkLooks = { readonly variant: LinkVariant; readonly underline: LinkUnderline };

/**
 * A cell's variant and underline, which the compare renderer passes to `Link`.
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

/**
 * The link's manifest, which the capture-backed build reads with `captures/link.json`: a link, as
 * `<Link href="/invoices/1042">invoice 1042</Link>` at a variant and underline.
 */
export const LINK_MANIFEST: SetManifest = {
  key: "link",
  name: "Link",
  slot: "link",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "underline", values: UNDERLINES },
    { name: "state", values: ["rest", "hover", "focus"] },
  ],
  columnAxis: "state",
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
