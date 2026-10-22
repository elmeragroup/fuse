/**
 * The renderers of the four Breadcrumb sets: each cell as the real Fuse part inside the
 * `Breadcrumb.Root` and `Breadcrumb.List` around it, as the docs Basic and Ellipsis demos place it.
 *
 * - A `breadcrumb-link` cell renders `<Breadcrumb.Link href="/">` around the text
 *   `breadcrumb-kit.ts` draws, in a `Breadcrumb.Item`.
 * - A `breadcrumb-page` cell renders `<Breadcrumb.Page>` around its text, in an item.
 * - A `breadcrumb-ellipsis` cell renders `<Breadcrumb.Ellipsis />` in an item.
 * - A `breadcrumb-separator` cell renders `<Breadcrumb.Separator />` in the list, which draws its
 *   default CaretRight.
 * - The list sets the type and the muted text color each part inherits, and the item makes the
 *   part a flex item, so the page measures the box the trail gives it.
 * - The root and the ellipsis read their copy from `LocaleProvider`, which throws without one, so
 *   every cell renders in `en-US`, the locale the docs set.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Breadcrumb } from "../../../fuse/dist/breadcrumb.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { BREADCRUMB_LINK_LABEL, BREADCRUMB_PAGE_LABEL } from "../components/breadcrumb-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The part in a trail of its own, in English. */
function inTrail(part: ReactElement): ReactElement {
  return createElement(LocaleProvider, {
    locale: "en-US",
    children: createElement(Breadcrumb.Root, null, createElement(Breadcrumb.List, null, part)),
  });
}

/** The part in an item of the trail. */
function inItem(part: ReactElement): ReactElement {
  return inTrail(createElement(Breadcrumb.Item, null, part));
}

/** A `breadcrumb-link` cell: the demo's first link. */
export const breadcrumbLink: CellRendering = {
  element: () => inItem(createElement(Breadcrumb.Link, { href: "/" }, BREADCRUMB_LINK_LABEL)),
};

/** The `breadcrumb-page` cell: the demo's current page. */
export const breadcrumbPage: CellRendering = {
  element: () => inItem(createElement(Breadcrumb.Page, null, BREADCRUMB_PAGE_LABEL)),
};

/** The `breadcrumb-ellipsis` cell: the marker for omitted links. */
export const breadcrumbEllipsis: CellRendering = {
  element: () => inItem(createElement(Breadcrumb.Ellipsis)),
};

/** The `breadcrumb-separator` cell: the default chevron. */
export const breadcrumbSeparator: CellRendering = {
  element: () => inTrail(createElement(Breadcrumb.Separator)),
};
