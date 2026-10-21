/**
 * The renderer of the `badge` set: each cell as the real Fuse `<Badge variant size>Badge</Badge>`.
 * A Badge has no state, so the cell's variant and size are its only props.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Badge, badgeVariants } from "../../../fuse/dist/badge.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import type { CellRendering } from "./cell-renderers.ts";

type BadgeVariant = keyof typeof badgeVariants.variants.variant;
type BadgeSize = keyof typeof badgeVariants.variants.size;

/** The label every cell shows, the kit's `Label` default. */
const CELL_LABEL = "Badge";

function isVariant(value: string | undefined): value is BadgeVariant {
  return ownKey(badgeVariants.variants.variant, value);
}

function isSize(value: string | undefined): value is BadgeSize {
  return ownKey(badgeVariants.variants.size, value);
}

/** A `badge` cell: a Badge with a label. */
export const badge: CellRendering = {
  element: (cell: Cell) => {
    const { variant, size } = cell;
    if (!isVariant(variant) || !isSize(size)) {
      throw new Error(`Badge has no variant ${variant ?? ""} or size ${size ?? ""}`);
    }
    return createElement(Badge, { variant, size }, CELL_LABEL);
  },
};
