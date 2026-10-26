/**
 * The renderer of the `link` set: each cell as the real Fuse React Aria `<Link>` at the cell's
 * variant and weight, as the docs Router demo's first link, `href="/invoices/1042"` around its text.
 * `disabled` sets `isDisabled`, so React Aria renders a `<span role="link">` marked `aria-disabled`
 * and `data-disabled` in place of the `<a>`. The page measures the one element marked `data-rac`.
 *
 * React Aria sets a link's hover and focus faces from pointer and focus events once a page
 * hydrates, and the compare page renders static markup. So `forcedAttributes` names what React Aria
 * writes on the link in those states, which the page writes when it forces the state:
 * `data-hovered` while hovered, which `enabled-hover:` reads on an element marked `data-rac`, and
 * `data-focused`, `data-focus-visible` and the class Link's `className` function gives at the
 * render prop `isFocusVisible` while a keyboard user focuses the link: the recipe, then the state
 * focus ring.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { cn, focusRing, linkVariants } from "@elmeragroup/fuse/recipe-catalog";

import { Link } from "../../../fuse/dist/react-aria/link.js";
import type { Cell } from "../components/component-spec.ts";
import { LINK_LABEL } from "../components/link-kit.ts";
import { ownKey } from "../components/own-key.ts";
import type { CellRendering } from "./cell-renderers.ts";

type LinkVariant = keyof typeof linkVariants.variants.variant;
type LinkWeight = keyof typeof linkVariants.variants.weight;

function isVariant(value: string | undefined): value is LinkVariant {
  return ownKey(linkVariants.variants.variant, value);
}

function isWeight(value: string | undefined): value is LinkWeight {
  return ownKey(linkVariants.variants.weight, value);
}

/** A cell's variant and weight, as Link's props take them. */
function looks(cell: Cell) {
  const { variant, weight } = cell;
  if (!isVariant(variant) || !isWeight(weight)) {
    throw new Error(`Link has no variant ${variant ?? ""} or weight ${weight ?? ""}`);
  }
  return { variant, weight };
}

/** A `link` cell: the demo's link at the cell's variant and weight, disabled where the cell is. */
export const link: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      Link,
      { ...looks(cell), href: "/invoices/1042", isDisabled: cell.state === "disabled" },
      LINK_LABEL
    ),
  forcedAttributes: (cell: Cell) => {
    if (cell.state === "hover") {
      return { "data-hovered": "true" };
    }
    if (cell.state === "focus") {
      return {
        "data-focused": "true",
        "data-focus-visible": "true",
        class: cn(linkVariants(looks(cell)), focusRing({ target: "state", isFocusVisible: true }).root()),
      };
    }
    return {};
  },
};
