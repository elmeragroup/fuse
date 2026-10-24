/**
 * Pagination's parts and the row that lays them out, as four component sets on one page.
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
 * - `Pagination row` is the docs Basic demo's row: previous, the pages 1 to 3 with 1 current, and
 *   next, 1 cell. `Pagination.Root` is its root, a column that centers `Pagination.Content`, the
 *   row, and each part is an instance of its set in a `Pagination.Item`, which carries no class.
 *
 * An `<a>` has no disabled state, and Pagination renders neither `aria-disabled` nor Button's
 * pending markers on one, so the link and the edge draw no disabled or pending state.
 */
import { buttonVariants, cn, paginationVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON_OMITTED_STATES, BUTTON_PENDING_ONLY_VARIANTS } from "./button-kit";
import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  PartDefinition,
} from "./component-spec";
import { HOST_TYPE } from "./host-type";

const { base, content, link, linkIcon, ellipsis, ellipsisIcon } = paginationVariants();

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
  elementSlot: (cell) => `pagination-${directionOf(cell)}`,
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

/**
 * The page numbers the row's links show, the docs Basic demo's, the first current. The first is the
 * link set's own label, {@link PAGINATION_LINK_LABEL}. The compare renderer renders the same.
 */
export const PAGINATION_ROW_PAGES = [PAGINATION_LINK_LABEL, "2", "3"] as const;

/** A `Pagination.Item` around an instance of a part's set, which the item carries no class for. */
function itemAround(inner: InstanceDefinition): PartDefinition {
  return {
    key: `${inner.key}-item`,
    slot: "pagination-item",
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
    parts: [inner],
  };
}

/** The previous or next edge, an instance of the edge's set at rest. */
function edgeOf(direction: Direction): InstanceDefinition {
  return {
    kind: "instance",
    key: direction,
    of: PAGINATION_EDGE,
    cell: () => ({ direction, state: "rest" }),
    shownIn: () => true,
  };
}

/**
 * A page link, an instance of the link's set at rest, current for the first page, and exposed, so a
 * designer retypes the number from the row's panel.
 */
function pageOf(number: string, current: boolean): InstanceDefinition {
  return {
    kind: "instance",
    key: `page-${number}`,
    of: PAGINATION_LINK,
    cell: () => ({ current: current ? "on" : "off", state: "rest" }),
    // The instance carries a label only where it differs from the link set's own, so page 1's carries none.
    properties: () => ({ text: { Label: number } }),
    shownIn: () => true,
    exposed: true,
  };
}

/**
 * The docs Basic demo's row, as `<Pagination.Root>` around `<Pagination.Content>`, which holds the
 * previous edge, the three page links and the next edge, each in its `<Pagination.Item>`. The links
 * take the host page's type, as the link set's do. The recipe declares no axes, so the set's one
 * property, `pages`, names the three pages the row shows.
 */
export const PAGINATION_ROW: ComponentDefinition = {
  key: "pagination-row",
  name: "Pagination row",
  slot: "pagination",
  inheritedFor: () => HOST_TYPE,
  axes: [{ name: "pages", values: ["3"] }],
  columnAxis: "pages",
  classesFor: () => base(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  // `Pagination.Root` holds `Pagination.Content` and nothing else, so its `space-y-4` styles no child.
  undrawnChildren: () => 0,
  parts: [
    {
      key: "content",
      slot: "pagination-content",
      shownIn: () => true,
      classesFor: () => content(),
      label: undefined,
      iconsFor: () => [],
      parts: [
        itemAround(edgeOf("previous")),
        ...PAGINATION_ROW_PAGES.map((number, index) => itemAround(pageOf(number, index === 0))),
        itemAround(edgeOf("next")),
      ],
    },
  ],
  swapProperties: [],
};
