/**
 * The renderers of the four Pagination sets: each cell as the real Fuse part with the `href` the
 * docs Basic demo gives it.
 *
 * - A `pagination-link` cell renders `<Pagination.Link>` around the number `pagination-kit.ts`
 *   draws, with `isActive` at `current=on`.
 * - A `pagination-edge` cell renders `<Pagination.Previous>` or `<Pagination.Next>`, which write
 *   their own caret and copy.
 * - A `pagination-ellipsis` cell renders `<Pagination.Ellipsis>`.
 * - The `pagination-row` cell renders the docs Basic demo: `<Pagination.Root>` around
 *   `<Pagination.Content>`, which holds the previous edge, the links to pages 1 to 3 with 1 current,
 *   and the next edge, each in its `<Pagination.Item>`.
 * - The root, the edges and the ellipsis read their copy from `LocaleProvider`, which throws without
 *   one, so every cell renders in `en-US`, the locale the docs set.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Pagination } from "../../../fuse/dist/pagination.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import { directionOf, PAGINATION_LINK_LABEL, PAGINATION_ROW_PAGES } from "../components/pagination-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

function inEnglish(part: ReactElement): ReactElement {
  return createElement(LocaleProvider, { locale: "en-US", children: part });
}

/** A `pagination-link` cell: a page link around the number, current or not. */
export const paginationLink: CellRendering = {
  element: (cell: Cell) =>
    inEnglish(
      createElement(
        Pagination.Link,
        { href: `#${PAGINATION_LINK_LABEL}`, isActive: cell.current === "on" },
        PAGINATION_LINK_LABEL
      )
    ),
};

/** A `pagination-edge` cell: the previous or the next link. */
export const paginationEdge: CellRendering = {
  element: (cell: Cell) => {
    const direction = directionOf(cell);
    const edge = direction === "previous" ? Pagination.Previous : Pagination.Next;
    return inEnglish(createElement(edge, { href: `#${direction}` }));
  },
};

/** The `pagination-ellipsis` cell: the gap marker. */
export const paginationEllipsis: CellRendering = {
  element: () => inEnglish(createElement(Pagination.Ellipsis)),
};

/** The `pagination-row` cell: the Basic demo's previous edge, three pages with the first current, and next. */
export const paginationRow: CellRendering = {
  element: () => {
    const item = (part: ReactElement) => createElement(Pagination.Item, null, part);
    const pages = PAGINATION_ROW_PAGES.map((number, index) =>
      item(createElement(Pagination.Link, { href: `#${number}`, isActive: index === 0 }, number))
    );
    return inEnglish(
      createElement(
        Pagination.Root,
        null,
        createElement(
          Pagination.Content,
          null,
          item(createElement(Pagination.Previous, { href: "#previous" })),
          ...pages,
          item(createElement(Pagination.Next, { href: "#next" }))
        )
      )
    );
  },
};
