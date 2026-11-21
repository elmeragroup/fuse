/**
 * Link, as one component set on the Link page: each color variant at each underline and weight, in
 * three states, 108 cells. `Link` renders an `<a data-slot="link">`. A link has no disabled state.
 *
 * The set crosses the axes the docs demos vary, `variant` and `underline`, with `weight`. A link
 * with no `weight` takes its sentence's weight, the host page's 400, which `normal` sets too, so the
 * axis lists the two values `weight` takes. `truncate` cuts a link's text only where its container is narrower than the text, as the
 * Truncate demo's row is, and a link in a hugging Figma frame keeps its text's own width past a
 * limit (P7), so the set leaves it off. The set also leaves off the External link demo's icon.
 */
import { linkVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { ownKey } from "./own-key";

type LinkVariant = keyof typeof linkVariants.variants.variant;
type LinkUnderline = keyof typeof linkVariants.variants.underline;
type LinkWeight = keyof typeof linkVariants.variants.weight;

function isVariant(value: string | undefined): value is LinkVariant {
  return ownKey(linkVariants.variants.variant, value);
}

function isUnderline(value: string | undefined): value is LinkUnderline {
  return ownKey(linkVariants.variants.underline, value);
}

function isWeight(value: string | undefined): value is LinkWeight {
  return ownKey(linkVariants.variants.weight, value);
}

/** Every variant the recipe declares, in its order, so a new one reaches Figma too. */
const VARIANTS = Object.keys(linkVariants.variants.variant).filter(isVariant);

/** The underlines in the recipe's order, its default `always` first. */
const UNDERLINES = Object.keys(linkVariants.variants.underline).filter(isUnderline);

/** The weights in the recipe's order, `normal` first, the weight a link with no `weight` shows. */
const WEIGHTS = Object.keys(linkVariants.variants.weight).filter(isWeight);

/**
 * The text every cell shows, the default of the `Label` text property: the link of the docs Router
 * links example. The compare renderer renders the same text.
 */
export const LINK_LABEL = "invoice 1042";

/** A cell's look, as `Link`'s `variant`, `underline` and `weight` props take it. */
export type LinkLooks = {
  readonly variant: LinkVariant;
  readonly underline: LinkUnderline;
  readonly weight: LinkWeight;
};

/**
 * A cell's variant, underline and weight, which the compare renderer passes to `Link`.
 *
 * @throws When the cell names a variant, underline or weight the recipe does not declare, a defect
 *   in the caller's cell.
 */
export function linkLooks(cell: Cell): LinkLooks {
  const { variant, underline, weight } = cell;
  if (!isVariant(variant) || !isUnderline(underline) || !isWeight(weight)) {
    throw new Error(
      `Link has no variant ${variant ?? ""}, underline ${underline ?? ""} or weight ${weight ?? ""}`
    );
  }
  return { variant, underline, weight };
}

/**
 * The link's manifest, which the capture-backed build reads with `captures/link.json`: a link, as
 * `<Link href="/invoices/1042">invoice 1042</Link>` at a variant, underline and weight.
 */
export const LINK_MANIFEST: SetManifest = {
  key: "link",
  name: "Link",
  api: { page: "link", parts: ["Link"] },
  slot: "link",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "underline", values: UNDERLINES },
    { name: "weight", values: WEIGHTS },
    { name: "state", values: ["rest", "hover", "focus"] },
  ],
  // The weight axis came after the set's first release, so a `normal` link keeps the key it had then.
  addedAxes: new Set(["weight"]),
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
