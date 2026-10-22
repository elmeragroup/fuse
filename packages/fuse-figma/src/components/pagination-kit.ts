/**
 * Pagination's parts, as three component sets on one page. The row that lays them out waits until
 * kit components can hold instances.
 *
 * - `Pagination link` is a page number at rest, hover and focus, current off and on: 6 cells.
 *   `Pagination.Link` renders an `<a>` with Button's recipe at `size="icon"`, the md square, as the
 *   ghost variant, or the outline variant with `aria-current="page"` while current, plus the
 *   `gap-1` of `paginationVariants`. The square sets no type, so the number takes the host page's.
 * - `Pagination edge` is the previous and next link at rest, hover and focus: 6 cells. Each is that
 *   link at `size="default"`, the md label, ghost, with the caret on the side the component puts it
 *   and the `pl-2.5` or `pr-2.5` on that side. Its copy is the en-US default, in a bare `<span>`.
 * - `Pagination ellipsis` is the md control square around DotsThree: 1 cell. Its copy is visually
 *   hidden, so the kit draws no text for it.
 *
 * An `<a>` has no disabled state, and Pagination renders neither `aria-disabled` nor Button's
 * pending markers on one, so the link and the edge draw no disabled or pending state.
 */
import { buttonVariants, cn, paginationVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON_OMITTED_STATES, BUTTON_PENDING_ONLY_VARIANTS } from "./button-kit";
import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";

const { link, linkIcon, ellipsis, ellipsisIcon } = paginationVariants();

/** The states an `<a>` shows. */
const STATE_AXIS = { name: "state", values: ["rest", "hover", "focus"] };

/**
 * Button's omissions, its pending-only variants and its disabled arms. A Pagination link is an
 * `<a>`, which never matches `:disabled`, and Pagination stamps no `aria-disabled`,
 * `data-disabled` or `data-pending-indicator` on it.
 */
const OMITTED_STATES = new Set([
  ...BUTTON_OMITTED_STATES,
  ...BUTTON_PENDING_ONLY_VARIANTS,
  "disabled",
  "data-disabled",
]);

/**
 * The number every link cell shows, the default of the `Label` text property: the current page of
 * the docs Basic demo. The compare renderer renders the same text.
 */
export const PAGINATION_LINK_LABEL = "1";

/**
 * The page's own type, which a link inherits, since Button's `icon` square sets none: the
 * browser's `medium` 16px, and preflight's `line-height: 1.5` on `<html>`, as the docs and the
 * compare page load it.
 */
const HOST_TYPE = [
  { className: "html, the browser's medium font size", property: "font-size", value: "16px" },
  { className: "html, Tailwind preflight", property: "line-height", value: "1.5" },
];

/**
 * A page link, as `<Pagination.Link href isActive>1</Pagination.Link>`: ghost, or outline while
 * current.
 */
export const PAGINATION_LINK: ComponentDefinition = {
  key: "pagination-link",
  name: "Pagination link",
  slot: "pagination-link",
  inheritedFor: () => HOST_TYPE,
  axes: [{ name: "current", values: ["off", "on"] }, STATE_AXIS],
  columnAxis: "state",
  classesFor: (cell) =>
    cn(buttonVariants({ variant: cell.current === "on" ? "outline" : "ghost", size: "icon" }), link()),
  states: {},
  facts: new Map(),
  omittedStates: OMITTED_STATES,
  label: {
    key: "label",
    name: "label",
    characters: PAGINATION_LINK_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};

type Direction = "previous" | "next";

function isDirection(value: string | undefined): value is Direction {
  return value === "previous" || value === "next";
}

/**
 * A cell's direction.
 *
 * @param cell - A `pagination-edge` cell.
 * @returns The direction its `direction` axis names.
 * @throws When the cell names no direction the set declares, a defect in the caller's cell.
 */
export function directionOf(cell: Cell): Direction {
  if (!isDirection(cell.direction)) {
    throw new Error(`Pagination edge has no direction ${cell.direction ?? ""}`);
  }
  return cell.direction;
}

/**
 * Each edge's en-US copy, from Pagination's dictionary, and the caret the component draws on its
 * side of the copy. The caret is fixed, so no swap property picks it.
 */
const EDGES = {
  previous: {
    copy: "Previous",
    caret: {
      key: "caret",
      name: "Caret",
      side: "start",
      direct: true,
      dataIcon: undefined,
      icon: "CaretLeft",
      swapProperty: undefined,
      classes: linkIcon(),
    },
  },
  next: {
    copy: "Next",
    caret: {
      key: "caret",
      name: "Caret",
      side: "end",
      direct: true,
      dataIcon: undefined,
      icon: "CaretRight",
      swapProperty: undefined,
      classes: linkIcon(),
    },
  },
} as const satisfies Record<Direction, { readonly copy: string; readonly caret: IconSlot }>;

/**
 * The previous or next link, as `<Pagination.Previous href />` and `<Pagination.Next href />`.
 * Its `data-slot` is `pagination-previous` or `pagination-next`, so the compare finds the root as
 * the cell's one `<a>`, and the root layer takes the name of the `PaginationEdge` that renders both.
 */
export const PAGINATION_EDGE: ComponentDefinition = {
  key: "pagination-edge",
  name: "Pagination edge",
  slot: "pagination-edge",
  element: { tag: "a", attributes: {} },
  axes: [{ name: "direction", values: ["previous", "next"] }, STATE_AXIS],
  columnAxis: "state",
  classesFor: (cell) =>
    // `PaginationEdge` passes its direction's `link` slot to `PaginationLink` as its `className`,
    // which merges it after Button's recipe and the plain `link` slot.
    cn(
      buttonVariants({ variant: "ghost", size: "default" }),
      link(),
      paginationVariants({ direction: directionOf(cell) }).link()
    ),
  states: {},
  facts: new Map(),
  omittedStates: OMITTED_STATES,
  label: {
    key: "label",
    name: "label",
    charactersFor: (cell) => EDGES[directionOf(cell)].copy,
    shownIn: () => true,
    textElement: { tag: "span", attributes: {} },
  },
  iconsFor: (cell) => [EDGES[directionOf(cell)].caret],
  swapProperties: [],
};

/** The dots the ellipsis draws, fixed, so no swap property picks them. */
const DOTS: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "DotsThree",
  swapProperty: undefined,
  classes: ellipsisIcon(),
};

/**
 * The gap marker, as `<Pagination.Ellipsis />`. The recipe declares no axes, so the set's one
 * property, `size`, names the md control square it fills, which is also its column axis.
 */
export const PAGINATION_ELLIPSIS: ComponentDefinition = {
  key: "pagination-ellipsis",
  name: "Pagination ellipsis",
  slot: "pagination-ellipsis",
  axes: [{ name: "size", values: ["md"] }],
  columnAxis: "size",
  classesFor: () => ellipsis(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [DOTS],
  swapProperties: [],
};
