/**
 * Breadcrumb's parts and the trail that lays them out, as five component sets on one page.
 *
 * - `Breadcrumb link` is a link at rest, hover and focus: 3 cells. It is an `<a>` that hugs its
 *   text.
 * - `Breadcrumb page` is the current page: 1 cell.
 * - `Breadcrumb ellipsis` is the 20px box around DotsThree: 1 cell. Its copy is visually hidden, so
 *   the kit draws no text for it.
 * - `Breadcrumb separator` is the `<li>` around the CaretRight it draws by default, at 14px: 1 cell.
 * - `Breadcrumb trail` is the docs Basic demo's trail, `Home`, `Quick start` and the current page:
 *   1 cell. Its `Ellipsis` BOOLEAN property shows the Ellipsis demo's ellipsis after `Home`, with its
 *   separator. Showing it changes no style outside the two, as the capture of the trail with and
 *   without it showed, so it is a property rather than an axis. The list is its root, and each entry
 *   an item frame around an instance of the part's set, with a separator instance between the
 *   entries.
 *
 * Every part sits in `Breadcrumb.List`, and a link, the page and the ellipsis sit in a
 * `Breadcrumb.Item` inside it. The list sets the type and the text color each part inherits.
 */
import type {
  FuseParts,
  IconManifest,
  InstanceManifest,
  LabelManifest,
  PartManifest,
  SetManifest,
} from "../capture/manifest";
import type { Cell } from "./component-spec";
import type { AxisSpec, BooleanPropertySpec } from "./kit-spec";

/** The text every link cell shows, the first link of the docs Basic demo. */
export const BREADCRUMB_LINK_LABEL = "Home";

/** The text the page cell shows, the current page of the docs Basic demo. */
export const BREADCRUMB_PAGE_LABEL = "Breadcrumb";

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
 * The chevron the separator draws when it is given no children. A consumer can pass any other
 * `<svg>`, which the separator sizes the same, or text, as the docs Custom separator demo passes
 * `/`. The set draws the default, fixed, so no swap property picks it.
 */
const CARET: IconManifest = {
  key: "caret",
  name: "Caret",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "CaretRight",
  swapProperty: undefined,
};

/** A manifest of a Breadcrumb part that holds a label or an icon. */
function partManifest(part: {
  readonly key: string;
  readonly name: string;
  readonly api: FuseParts;
  readonly slot: string;
  readonly axes: readonly AxisSpec[];
  readonly columnAxis: string;
  readonly label: LabelManifest | undefined;
  readonly iconsFor: (cell: Cell) => readonly IconManifest[];
}): SetManifest {
  return {
    key: part.key,
    name: part.name,
    api: part.api,
    slot: part.slot,
    axes: part.axes,
    columnAxis: part.columnAxis,
    label: part.label,
    iconsFor: part.iconsFor,
    swapProperties: [],
  };
}

/**
 * The link's manifest, which the capture-backed build reads with `captures/breadcrumb-link.json`:
 * `<Breadcrumb.Link href="/">Home</Breadcrumb.Link>` in its list and item.
 */
export const BREADCRUMB_LINK_MANIFEST: SetManifest = partManifest({
  key: "breadcrumb-link",
  name: "Breadcrumb link",
  api: { page: "breadcrumb", parts: ["Breadcrumb.Link"] },
  slot: "breadcrumb-link",
  axes: [{ name: "state", values: ["rest", "hover", "focus"] }],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    characters: BREADCRUMB_LINK_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
});

/**
 * The page's manifest, which the capture-backed build reads with `captures/breadcrumb-page.json`:
 * `<Breadcrumb.Page>Breadcrumb</Breadcrumb.Page>`, which `aria-current="page"` marks. It has no
 * states, so the set's one property is `state=rest`.
 */
export const BREADCRUMB_PAGE_MANIFEST: SetManifest = partManifest({
  key: "breadcrumb-page",
  name: "Breadcrumb page",
  api: { page: "breadcrumb", parts: ["Breadcrumb.Page"] },
  slot: "breadcrumb-page",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    characters: BREADCRUMB_PAGE_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
});

/**
 * The ellipsis's manifest, which the capture-backed build reads with
 * `captures/breadcrumb-ellipsis.json`: the marker for omitted links, `<Breadcrumb.Ellipsis />` in its
 * list and item, a 20px box. The component takes no variant props, so the set's one property is
 * `state=rest`.
 */
export const BREADCRUMB_ELLIPSIS_MANIFEST: SetManifest = partManifest({
  key: "breadcrumb-ellipsis",
  name: "Breadcrumb ellipsis",
  api: { page: "breadcrumb", parts: ["Breadcrumb.Ellipsis"] },
  slot: "breadcrumb-ellipsis",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [DOTS],
});

/**
 * The separator's manifest, which the capture-backed build reads with
 * `captures/breadcrumb-separator.json`: `<Breadcrumb.Separator />` in its list. The component takes
 * no variant props, so the set's one property is `state=rest`. Its chevron takes 14px.
 */
export const BREADCRUMB_SEPARATOR_MANIFEST: SetManifest = partManifest({
  key: "breadcrumb-separator",
  name: "Breadcrumb separator",
  api: { page: "breadcrumb", parts: ["Breadcrumb.Separator"] },
  slot: "breadcrumb-separator",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [CARET],
});

/** The text of the trail's second link, the docs Basic demo's. The compare renderer renders it. */
export const BREADCRUMB_TRAIL_LINK_LABEL = "Quick start";

/**
 * The BOOLEAN property that shows the trail's ellipsis and its separator, as the docs Ellipsis demo
 * does. It starts false, as the Basic demo's trail has none.
 */
export const BREADCRUMB_ELLIPSIS_PROPERTY = "Ellipsis";

const ELLIPSIS: BooleanPropertySpec = { name: BREADCRUMB_ELLIPSIS_PROPERTY, defaultValue: false };

/** An entry of the trail: a `Breadcrumb.Item` around an instance of a part's set. */
function entryManifest(inner: InstanceManifest, optional?: BooleanPropertySpec): PartManifest {
  const entry: PartManifest = {
    key: `${inner.key}-item`,
    slot: "breadcrumb-item",
    shownIn: () => true,
    label: undefined,
    iconsFor: () => [],
    parts: [inner],
  };
  return optional === undefined ? entry : { ...entry, optional };
}

/** The separator after an entry, an instance of the separator's set. */
function separatorManifest(key: string, optional?: BooleanPropertySpec): InstanceManifest {
  const separator: InstanceManifest = {
    kind: "instance",
    key: `${key}-separator`,
    of: BREADCRUMB_SEPARATOR_MANIFEST,
    cell: () => ({ state: "rest" }),
    shownIn: () => true,
  };
  return optional === undefined ? separator : { ...separator, optional };
}

/**
 * The trail's manifest, which the capture-backed build reads with `captures/breadcrumb-trail.json`:
 * the docs Basic demo's trail, and the Ellipsis demo's where `Ellipsis` is on. `Breadcrumb.List`
 * holds `Home`, `Quick start` and the current page, each in its item, with a separator between them. The
 * links and the page are exposed, so a designer retypes them from the trail's panel.
 */
export const BREADCRUMB_TRAIL_MANIFEST: SetManifest = {
  key: "breadcrumb-trail",
  name: "Breadcrumb trail",
  api: { page: "breadcrumb", parts: ["Breadcrumb.List"] },
  slot: "breadcrumb-list",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [],
  parts: [
    entryManifest({
      kind: "instance",
      key: "home",
      of: BREADCRUMB_LINK_MANIFEST,
      cell: () => ({ state: "rest" }),
      shownIn: () => true,
      exposed: true,
    }),
    separatorManifest("home"),
    entryManifest(
      {
        kind: "instance",
        key: "ellipsis",
        of: BREADCRUMB_ELLIPSIS_MANIFEST,
        cell: () => ({ state: "rest" }),
        shownIn: () => true,
      },
      ELLIPSIS
    ),
    separatorManifest("ellipsis", ELLIPSIS),
    entryManifest({
      kind: "instance",
      key: "quick-start",
      of: BREADCRUMB_LINK_MANIFEST,
      cell: () => ({ state: "rest" }),
      properties: () => ({ text: { Label: BREADCRUMB_TRAIL_LINK_LABEL } }),
      shownIn: () => true,
      exposed: true,
    }),
    separatorManifest("quick-start"),
    entryManifest({
      kind: "instance",
      key: "page",
      of: BREADCRUMB_PAGE_MANIFEST,
      cell: () => ({ state: "rest" }),
      shownIn: () => true,
      exposed: true,
    }),
  ],
  swapProperties: [],
};
