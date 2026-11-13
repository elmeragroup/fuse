/**
 * The renderer of the `link` set: each cell as the real Fuse `<Link>` at the cell's variant and
 * underline, as the docs Router links example's link, `href="/invoices/1042"` around its text. The page
 * forces hover and focus on the `<a data-slot="link">` itself.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Link } from "../../../fuse/dist/link.js";
import type { Cell } from "../components/component-spec.ts";
import { LINK_LABEL, linkLooks } from "../components/link-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `link` cell: the demo's link at the cell's variant and underline. */
export const link: CellRendering = {
  element: (cell: Cell) => createElement(Link, { ...linkLooks(cell), href: "/invoices/1042" }, LINK_LABEL),
};
