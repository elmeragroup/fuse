/**
 * Breadcrumb's parts, as four component sets on one page. The trail that lays them out waits until
 * kit components can hold instances.
 *
 * - `Breadcrumb link` is a link at rest, hover and focus: 3 cells. It is an `<a>` that hugs its
 *   text, turns `foreground` on hover and draws the shared focus ring.
 * - `Breadcrumb page` is the current page in `foreground`: 1 cell.
 * - `Breadcrumb ellipsis` is the 20px box around DotsThree: 1 cell. Its copy is visually hidden, so
 *   the kit draws no text for it.
 * - `Breadcrumb separator` is the `<li>` around the CaretRight it draws by default, at 14px: 1 cell.
 *
 * Every part sits in `Breadcrumb.List`, and a link, the page and the ellipsis sit in a
 * `Breadcrumb.Item` inside it. The sets name both by their recipe slots, and the build cascades
 * their classes around the root. The list's `text-sm` and `text-muted-foreground` set the type and
 * the text color each part inherits, and the icons take that color. The list's flex row and `sm:`
 * gap and the item's flex row lay out the trail, which no set draws. The list's `wrap-break-word`
 * breaks a word only where the word overflows the list, which a part that hugs its text never does.
 * `Breadcrumb.Root` around the list carries no class.
 */
import { breadcrumbVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { AncestorDefinition, ComponentDefinition, IconSlot } from "./component-spec";

const { list, item, link, page, separator, ellipsis } = breadcrumbVariants();

/** `Breadcrumb.List`, which holds every part. */
const LIST: AncestorDefinition = {
  slot: "breadcrumb-list",
  classes: list(),
  undrawn: "the list lays out and wraps the trail, which the set does not draw",
};

/** `Breadcrumb.Item`, which holds a link, the page or the ellipsis in the list. */
const ITEM: AncestorDefinition = {
  slot: "breadcrumb-item",
  classes: item(),
  undrawn: "the item lays out its entry in the trail, which the set does not draw",
};

/** The list and the item around a link, the page and the ellipsis. */
const IN_ITEM = [LIST, ITEM] as const;

/** The text every link cell shows, the first link of the docs Basic demo. */
export const BREADCRUMB_LINK_LABEL = "Home";

/** The text the page cell shows, the current page of the docs Basic demo. */
export const BREADCRUMB_PAGE_LABEL = "Breadcrumb";

/** A link, as `<Breadcrumb.Link href="/">Home</Breadcrumb.Link>` in its list and item. */
export const BREADCRUMB_LINK: ComponentDefinition = {
  key: "breadcrumb-link",
  name: "Breadcrumb link",
  slot: "breadcrumb-link",
  ancestorsFor: () => IN_ITEM,
  axes: [{ name: "state", values: ["rest", "hover", "focus"] }],
  columnAxis: "state",
  classesFor: () => link(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: BREADCRUMB_LINK_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};

/**
 * The current page, as `<Breadcrumb.Page>Breadcrumb</Breadcrumb.Page>`. It has no states, so the
 * set's one property, `current`, names the `aria-current="page"` that makes it the current page.
 * The page always renders `aria-disabled="true"`, so `aria-disabled:` holds in its cell.
 */
export const BREADCRUMB_PAGE: ComponentDefinition = {
  key: "breadcrumb-page",
  name: "Breadcrumb page",
  slot: "breadcrumb-page",
  ancestorsFor: () => IN_ITEM,
  axes: [{ name: "current", values: ["page"] }],
  columnAxis: "current",
  classesFor: () => page(),
  states: {},
  facts: new Map([["aria-disabled", () => true]]),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: BREADCRUMB_PAGE_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
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
};

/**
 * The marker for omitted links, as `<Breadcrumb.Ellipsis />` in its list and item. The recipe
 * declares no axes, so the set's one property, `size`, names its 20px box.
 */
export const BREADCRUMB_ELLIPSIS: ComponentDefinition = {
  key: "breadcrumb-ellipsis",
  name: "Breadcrumb ellipsis",
  slot: "breadcrumb-ellipsis",
  ancestorsFor: () => IN_ITEM,
  axes: [{ name: "size", values: ["20"] }],
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
 * The chevron the separator draws when it is given no children. A consumer can pass any other
 * `<svg>`, which the separator sizes the same, or text, as the docs Custom separator demo passes
 * `/`. The set draws the default, fixed, so no swap property picks it.
 */
const CARET: IconSlot = {
  key: "caret",
  name: "Caret",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "CaretRight",
  swapProperty: undefined,
};

/**
 * The separator, as `<Breadcrumb.Separator />` in its list. The recipe declares no axes, so the
 * set's one property, `size`, names the 14px its chevron takes.
 */
export const BREADCRUMB_SEPARATOR: ComponentDefinition = {
  key: "breadcrumb-separator",
  name: "Breadcrumb separator",
  slot: "breadcrumb-separator",
  ancestorsFor: () => [LIST],
  axes: [{ name: "size", values: ["14"] }],
  columnAxis: "size",
  classesFor: () => separator(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [CARET],
  swapProperties: [],
};
