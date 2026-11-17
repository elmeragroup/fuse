/**
 * Pagination's parts and the row that lays them out, as four component sets on one page.
 *
 * - `Pagination link` is a page number at rest, hover and focus, current off and on: 6 cells.
 *   `Pagination.Link` renders an `<a>` with Button's look at `size="icon"`, ghost, or outline with
 *   `aria-current="page"` while current. The number takes the host page's type.
 * - `Pagination edge` is the previous and next link at rest, hover and focus: 6 cells. Each is that
 *   link at `size="default"`, ghost, with the caret on the side the component puts it. Its copy is the
 *   en-US default, in a bare `<span>`.
 * - `Pagination ellipsis` is the md control square around DotsThree: 1 cell. Its copy is visually
 *   hidden, so the kit draws no text for it.
 * - `Pagination row` is the docs Basic demo's row: previous, the pages 1 to 3 with 1 current, and
 *   next, 1 cell. Each part is an instance of its set in a `Pagination.Item`.
 *
 * An `<a>` has no disabled state, and Pagination renders neither `aria-disabled` nor Button's
 * pending markers on one, so the link and the edge draw no disabled or pending state.
 */
import type {
  IconManifest,
  InstanceManifest,
  LabelManifest,
  PartManifest,
  SetManifest,
} from "../capture/manifest";
import type { Cell } from "./component-spec";

/** The states an `<a>` shows. */
const STATE_AXIS = { name: "state", values: ["rest", "hover", "focus"] };

/**
 * The number every link cell shows, the default of the `Label` text property: the current page of
 * the docs Basic demo. The compare renderer renders the same text.
 */
export const PAGINATION_LINK_LABEL = "1";

/** The link's number, which the `Label` property sets. */
const LINK_LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: PAGINATION_LINK_LABEL,
  textProperty: "Label",
  shownIn: () => true,
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
    },
  },
} as const satisfies Record<Direction, { readonly copy: string; readonly caret: IconManifest }>;

/** The dots the ellipsis draws, fixed, so no swap property picks them. */
const DOTS: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "DotsThree",
  swapProperty: undefined,
};

/**
 * The page numbers the row's links show, the docs Basic demo's, the first current. The first is the
 * link set's own label, {@link PAGINATION_LINK_LABEL}. The compare renderer renders the same.
 */
export const PAGINATION_ROW_PAGES = [PAGINATION_LINK_LABEL, "2", "3"] as const;

/**
 * The link's manifest, which the capture-backed build reads with `captures/pagination-link.json`:
 * `<Pagination.Link href isActive>1</Pagination.Link>`, ghost, or outline while current.
 */
export const PAGINATION_LINK_MANIFEST: SetManifest = {
  key: "pagination-link",
  name: "Pagination link",
  slot: "pagination-link",
  axes: [{ name: "current", values: ["off", "on"] }, STATE_AXIS],
  columnAxis: "state",
  label: LINK_LABEL,
  iconsFor: () => [],
  swapProperties: [],
};

/**
 * The edge's manifest, which the capture-backed build reads with `captures/pagination-edge.json`:
 * `<Pagination.Previous href />` and `<Pagination.Next href />`. Its `data-slot` is
 * `pagination-previous` or `pagination-next`. Its label names no element: the `<span>` around the
 * copy carries no class, so it takes the link's own type.
 */
export const PAGINATION_EDGE_MANIFEST: SetManifest = {
  key: "pagination-edge",
  name: "Pagination edge",
  slot: "pagination-edge",
  elementSlot: (cell) => `pagination-${directionOf(cell)}`,
  axes: [{ name: "direction", values: ["previous", "next"] }, STATE_AXIS],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    charactersFor: (cell) => EDGES[directionOf(cell)].copy,
    shownIn: () => true,
  },
  iconsFor: (cell) => [EDGES[directionOf(cell)].caret],
  swapProperties: [],
};

/**
 * The ellipsis's manifest, which the capture-backed build reads with
 * `captures/pagination-ellipsis.json`: `<Pagination.Ellipsis />`. The component takes no variant
 * props, so the set's one property, `size`, names the md control square it fills.
 */
export const PAGINATION_ELLIPSIS_MANIFEST: SetManifest = {
  key: "pagination-ellipsis",
  name: "Pagination ellipsis",
  slot: "pagination-ellipsis",
  axes: [{ name: "size", values: ["md"] }],
  columnAxis: "size",
  label: undefined,
  iconsFor: () => [DOTS],
  swapProperties: [],
};

/** A `Pagination.Item` around an instance of a part's set. */
function itemManifest(inner: InstanceManifest): PartManifest {
  return {
    key: `${inner.key}-item`,
    slot: "pagination-item",
    shownIn: () => true,
    label: undefined,
    iconsFor: () => [],
    parts: [inner],
  };
}

/** The previous or next edge, an instance of the edge's set at rest. */
function edgeManifest(direction: Direction): InstanceManifest {
  return {
    kind: "instance",
    key: direction,
    of: PAGINATION_EDGE_MANIFEST,
    slot: `pagination-${direction}`,
    cell: () => ({ direction, state: "rest" }),
    shownIn: () => true,
  };
}

/**
 * A page link, an instance of the link's set at rest, current for the first page, and exposed, so a
 * designer retypes the number from the row's panel.
 */
function pageManifest(number: string, current: boolean): InstanceManifest {
  return {
    kind: "instance",
    key: `page-${number}`,
    of: PAGINATION_LINK_MANIFEST,
    cell: () => ({ current: current ? "on" : "off", state: "rest" }),
    properties: () => ({ text: { Label: number } }),
    shownIn: () => true,
    exposed: true,
  };
}

/**
 * The row's manifest, which the capture-backed build reads with `captures/pagination-row.json`: the
 * docs Basic demo's `<Pagination.Root>` around `<Pagination.Content>`, which holds the previous edge,
 * the three page links and the next edge, each in its `<Pagination.Item>`. The set's one property,
 * `pages`, names the three pages the row shows.
 */
export const PAGINATION_ROW_MANIFEST: SetManifest = {
  key: "pagination-row",
  name: "Pagination row",
  slot: "pagination",
  axes: [{ name: "pages", values: ["3"] }],
  columnAxis: "pages",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "content",
      slot: "pagination-content",
      shownIn: () => true,
      label: undefined,
      iconsFor: () => [],
      parts: [
        itemManifest(edgeManifest("previous")),
        ...PAGINATION_ROW_PAGES.map((number, index) => itemManifest(pageManifest(number, index === 0))),
        itemManifest(edgeManifest("next")),
      ],
    },
  ],
  swapProperties: [],
};
