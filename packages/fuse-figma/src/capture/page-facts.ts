/**
 * What the capture measures of a root's tree in Chromium, beyond its winning declarations: the facts
 * a capture keeps because they hold on any platform, read by a page function over DevTools.
 */
import type { CDPSession } from "playwright";

import type { MeasuredFacts } from "./capture-format.ts";
import { clearFill } from "./clear-fill.ts";
import { coincidingAround } from "./coinciding-around.ts";
import type { Rect } from "./coinciding-around.ts";
import { gridColumns } from "./grid-facts.ts";
import { generatesNoBox, holdsOwnText, pseudoInFlow } from "./no-box.ts";
import { EVERY_MODE } from "./page-modes.ts";
import { paintsLast } from "./paints-last.ts";
import { parentSpansBlock } from "./parent-spans-block.ts";
import { paints, pseudoBox, pseudoPaintOf } from "./pseudo-boxes.ts";
import type { PseudoPaint } from "./pseudo-boxes.ts";

/**
 * Measure a root's tree in the page and keep what holds on any platform, by each element's
 * element-ordinal path from the root, `""` for the root:
 *
 * - `containerWidth`, on the root: the content width of the element around it, where the root's
 *   margin box fills it, widening with it, and one more character of the root's text leaves it as it
 *   is, so CSS sets it and not the text. A positioned element with an auto width, as Base UI's
 *   positioner, shrinks to its content, so it is no such container.
 * - `widest`: in a root as wide as its own content, at its `min-width` or past it, the leaf row with
 *   text that fills its parent and whose own text is the widest, more than half a pixel wider than
 *   the next. That row's text sets the root's width once it outgrows the minimum, as a longer label
 *   does, so the build hugs it and keeps the minimum as its own (PH3).
 * - `oneLine`: an element under a `max-width` whose own text sits on one line, or a wrapping flex
 *   row whose items do.
 * - `underMaxHeight`: an element more than half a pixel under its `max-height`.
 * - `underMaxWidth`: an element as wide with its `max-width` {@link MAX_WIDTH_CLEARANCE_PX} lower,
 *   in every mode of {@link EVERY_MODE} once the faces its text needs there have loaded, so the
 *   maximum never narrows it. The page reads the lowered maximum back, so a maximum Chromium cannot
 *   lower, such as `min-content`, which makes the `calc()` invalid, records nothing.
 * - `tableTiles`: a table, a row group, a row or a cell whose parts tile its content box with no
 *   space between, within {@link LAYOUT_UNIT_PX}, in every mode of {@link EVERY_MODE}: a table's or
 *   a group's rows down it, each as wide as it; a row's cells across it, each as tall as it; a cell's
 *   one child filling it and keeping its size where the cell shrinks to fit it as a block, so the
 *   child sizes itself, or its own text at the width and height the cell sets itself, or, where it
 *   sets a height and no width and its text does not wrap, at that height and the width it takes as a
 *   block at its max-content width; and a table, a group or a row tiles only where each part it holds tiles in turn. A row or
 *   a row group of a table that collapses its borders sets them on the grid lines (CSS 2.1
 *   §17.6.2), so its parts tile its border box. Neither the columns nor the rows (CSS 2.1 §17.5)
 *   stretch a cell past what it holds, and no border spacing lies between them, so each box draws as
 *   an auto layout that hugs its parts.
 * - `bordersCollapse`: a table row whose table collapses its borders, in every mode of
 *   {@link EVERY_MODE}, so its borders take no room in its own box (CSS 2.1 §17.6.2), and whose
 *   borders are its own: no other box that can share one of its bordered edges sets a border there,
 *   which could win that edge (CSS 2.1 §17.6.2.1).
 * - `inlineRow`: an item of a flex row whose own display is `inline`, which the row blockifies (CSS
 *   Display 3 §2.7), where in every mode of {@link EVERY_MODE}, once its faces have loaded, the row is
 *   a flex container that neither wraps nor reverses, the item is one of its in-flow items, and those
 *   items sit on its one line in source order: each is one box whose own text keeps to one line,
 *   starts where the one before it ends or after it, within {@link LAYOUT_UNIT_PX}, and shares a band
 *   of the line with every other.
 * - `freeAlongMain`: a flex container whose items hold auto margins along its direction, which with
 *   those margins at zero leaves at least {@link FREE_SPACE_CLEARANCE_PX} between its last item and
 *   its content box's end, in every mode of {@link EVERY_MODE} once its faces have loaded, so the
 *   margins take that room (CSS Flexbox 1 §8.1).
 * - `fitsAlongMain`: a flex container as `freeAlongMain` takes one, whose items, with their auto
 *   margins at zero, leave at least {@link FIT_CLEARANCE_PX} between the last and its content box's
 *   end, in every mode of {@link EVERY_MODE} once its faces have loaded, so the line's items fit it
 *   and none shrinks (CSS Flexbox 1 §9.7).
 * - `basisAsDeclared`, on the root: a root whose computed `height` holds a percentage, as CSS Typed
 *   OM gives it, or is `auto` in a flex row that does not wrap, where the first element above it whose
 *   computed `height` is a length is as tall as that length, within {@link LAYOUT_UNIT_PX}, in every
 *   mode of {@link EVERY_MODE}, so no flex column around it grew or shrank it and the root's
 *   percentage, or the rows that stretch it, resolve against it.
 * - `ratioHeight`: an element with a preferred aspect ratio, none of it `auto`, and a computed
 *   `height` of `auto`, as tall as its width times the ratio within {@link LAYOUT_UNIT_PX}, and with
 *   the width, height and computed `aspect-ratio` of the page's own mode in every mode of
 *   {@link EVERY_MODE}. The ratio then sets the height (CSS Sizing 4 §4.2), and content taller than
 *   that height, which an `overflow: visible` box grows to hold (§4.3), did not grow it. It records
 *   the border box's width and height, which the build compares with the width it reads, since a
 *   flex row shrinks a box below its `width` (CSS Flexbox 1 §9.7) and the ratio follows the shrunk
 *   width.
 * - `itemsAtContent`: a flex row that neither wraps nor reverses, with two or more in-flow items that
 *   grow, each as wide as its own max-content width and that as wide as its min-content width, within
 *   {@link LAYOUT_UNIT_PX}, in every mode of {@link EVERY_MODE} once its faces have loaded. It holds
 *   for the text the capture renders, and shows Chromium sizing a row that hugs its items as wide as
 *   their content widths together (CSS Flexbox 1 §9.7). `content-shares.ts` reads it only beside
 *   declarations that keep it for any text.
 * - `ellipsisFits`: an element that ends its one line of text in an ellipsis, `text-overflow:
 *   ellipsis` on a box that hides its overflow and keeps to one line, whose content box is at least
 *   a pixel wider than its first character and the ellipsis together. Chromium keeps the first
 *   character of a line however narrow the box and sets the ellipsis after it, both clipped at the
 *   box, so only a box that holds both draws what a Figma text that ends in an ellipsis draws.
 * - `coincidingAround`, on the root: how many of the elements around it, innermost first, lie
 *   exactly behind it, as {@link coincidingAround} decides from their boxes and the paint the page
 *   counts. The page returns each background color it reads, and `clearFill` judges it by its
 *   alpha outside the page. An element's other child counts as reaching the root where its box or a box below it
 *   meets the root's box. Wherever they lie, it also counts where it or an element below it holds
 *   text, is SVG or MathML, is a list item with a marker, is replaced through `content`, hosts an
 *   open shadow root, generates a `::before` or `::after` box, or has a shadow, filter, backdrop
 *   filter, border image, reflection or outline. A replaced element or form control counts only
 *   where its box meets the root's. The element's own text, marker, `content`, open shadow root and
 *   generated box count as a child that reaches the root, and so do its inset shadow, border image
 *   and outline. The page checks this list and measures no paint, so paint it does not list, as a
 *   closed shadow root's, goes unseen. Issue #766 tracks measuring the fact from Chromium's pixels.
 * - `lineFits`: an element whose one element child is an inline-level box and which holds no text
 *   of its own, whose content box's top and bottom edges are the child's margin box's, within half
 *   a pixel, at its own line height and at 2px more, in every mode of {@link EVERY_MODE} once its
 *   faces have loaded. Matching edges leave no baseline offset, which
 *   moves the child down a line taller than a fixed-height box, and a line 2px taller grows the strut
 *   by 1px above and below (CSS 2.1 §10.8.1), so the line box adds nothing to the child by at least
 *   that margin. The second reading holds only where the page's computed line height took the 2px
 *   and the child kept its own.
 * - `trackFits`: a grid with one column, as wide as its content box, whose column at the grid's
 *   min-content width, with no `min-width` or `max-width` of its own, is at least
 *   {@link TRACK_CLEARANCE_PX} narrower than its column at the captured width. The items' least
 *   widths then fit inside the content box, so the `auto` column is the content box's width (CSS
 *   Grid 1 §11.5, §11.8), on both platforms the capture runs on.
 * - `gridHugs`, `gridHolds`, `gridWidest` and `gridTallest`: on a grid of two or more columns, the
 *   columns as wide as their widest item at max-content, as rendered and with each text one
 *   character longer, the columns wider than their items at min-content by
 *   {@link GRID_CLEARANCE_PX}, and the item that sets each column's width and each row's height, its
 *   track's only item or one leading every other by that clearance, each in every mode of
 *   {@link EVERY_MODE} once its faces have loaded, as `grid-facts.ts` reads them.
 * - `noBox`: an element that, in every mode of {@link EVERY_MODE} once its faces have loaded,
 *   generates no box and adds nothing to its parent's flow but its children's boxes, as `no-box.ts`
 *   decides.
 * - `gridItems` and `gridItem`: on such a grid, how many items it lays out, and on each item its
 *   place among them, which `gridWidest` and `gridTallest` number, where every mode finds the same.
 * - `pseudoBoxes`: each of an element's `::before` and `::after` that paints its box and, in every
 *   mode of {@link EVERY_MODE} once its faces have loaded, is an absolute box laid out against the
 *   element, as `pseudo-boxes.ts` decides.
 * - `parentSpansBlock`: an absolute element below the root whose static parent has, as its border
 *   box, the padding box of the element's containing block, the root or an element below it, in
 *   every mode of {@link EVERY_MODE} once
 *   its faces have loaded, as `parent-spans-block.ts` decides.
 * - `paintsLast`: a child of the root whose positive `z-index` paints it over every other box of the
 *   root, as the root's last child, in every mode of {@link EVERY_MODE} once its faces have loaded,
 *   as `paints-last.ts` decides.
 * - `identityTransform`: an element whose `transform` computes to the identity matrix in every mode
 *   of {@link EVERY_MODE} once its faces have loaded, as a translation by a `calc()` of zero does.
 *   Chromium computes a transform to a matrix, and to `none` only where the element sets none.
 * - `oneLength`: on an absolute element below the root, the axes along which its border box is one
 *   length, within {@link LAYOUT_UNIT_PX}, in every mode of {@link EVERY_MODE} once its faces have
 *   loaded.
 * - `spansBeside`: on an in-flow element below the root whose computed `width` is `100%`, with no
 *   horizontal margin, in a parent with a `display` of `block` or `flow-root` whose computed `width`
 *   is `fit-content` or `max-content`, beside other in-flow children with no horizontal margin: the
 *   content width the parent fits to with the element taking no room, its other children's widest
 *   max-content width. Every mode of {@link EVERY_MODE}, once its faces have loaded, must meet each of
 *   these conditions and measure the same width within {@link LAYOUT_UNIT_PX}, since a mode's rule can
 *   halve the element's width or make the parent a flex column. The parent shrinks to fit its widest child, the
 *   percentage counting as `auto` meanwhile (CSS Sizing 3 §5.2.1), and the element then spans it,
 *   so it is as wide as its own content or that width, whichever is wider.
 *
 * The page restores every element it changes before it returns, and the mode it stamps for the
 * facts above too, also where a measurement throws. A cell's roots share one page and its mode, so a
 * caller measures them one after another.
 *
 * @param cdp - A DevTools session on the page.
 * @param nodeId - The root's node.
 * @returns Each element's facts, by its path from the root.
 * @throws `FactsUnmeasured` where the page function throws, a defect in it or in the page, which
 *   stops the capture rather than keep facts it did not finish measuring.
 */
export async function measuredFacts(
  cdp: CDPSession,
  nodeId: number
): Promise<ReadonlyMap<string, MeasuredFacts>> {
  const { object } = await cdp.send("DOM.resolveNode", { nodeId });
  if (object.objectId === undefined) {
    return new Map();
  }
  const { result, exceptionDetails } = await cdp.send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    returnByValue: true,
    awaitPromise: true,
    functionDeclaration: MEASURE_IN_PAGE,
  });
  if (exceptionDetails !== undefined) {
    throw new FactsUnmeasured(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  // SAFETY: the page function returns facts by path, as plain JSON, each with the paint of the
  // pseudo-elements it measured as absolute boxes beside them, and the root's with the boxes and
  // paint of the elements around it.
  const measured = (result.value ?? {}) as Record<string, PageFacts>;
  return new Map(Object.entries(measured).flatMap(([path, facts]) => judgedFacts(path, facts)));
}

/**
 * An element around the root as the page reads it: its padding box, and for each other child and
 * its own paint over the root, whether the page counts it as reaching the root's box, whether it
 * paints anything the page checks other than a fill, and, where it does not, the distinct computed
 * `background-color` of it and every element below it.
 */
type AroundReading = {
  readonly padding: Rect;
  readonly others: readonly {
    readonly reaches: boolean;
    readonly paintsBesideFill: boolean;
    readonly fills: readonly string[];
  }[];
};

/**
 * An element's facts as the page returns them: `coincidingAround` holds the readings Node judges
 * into the fact, and `pseudoPaint` the paint Node judges into `pseudoBoxes`.
 */
type PageFacts = Omit<MeasuredFacts, "coincidingAround" | "pseudoBoxes"> & {
  readonly coincidingAround?: { readonly root: Rect; readonly around: readonly AroundReading[] };
  readonly pseudoPaint?: Record<string, PseudoPaint>;
};

/**
 * An element's facts with the readings the page took judged into facts. `coincidingAround` takes
 * the count {@link coincidingOf} judges from its readings, in the same place, so the facts keep the
 * order the page put them in, and goes where the count is 0. `pseudoPaint` gives `pseudoBoxes` for each absolute `::before` and `::after` whose
 * box paints, as `paints` judges it.
 */
function judgedFacts(
  path: string,
  { pseudoPaint, ...facts }: PageFacts
): readonly (readonly [string, MeasuredFacts])[] {
  const { coincidingAround: reading, ...rest } = facts;
  const coinciding = reading === undefined ? 0 : coincidingOf(reading);
  const judged: MeasuredFacts = coinciding > 0 ? { ...facts, coincidingAround: coinciding } : rest;
  const boxes = (["before", "after"] as const).filter((name) => {
    const paint = pseudoPaint?.[name];
    return paint !== undefined && paints(paint);
  });
  const kept: MeasuredFacts = boxes.length === 0 ? judged : { ...judged, pseudoBoxes: boxes };
  return Object.keys(kept).length === 0 ? [] : [[path, kept]];
}

/**
 * How many of the elements around the root lie exactly behind it, as {@link coincidingAround}
 * decides, where a child that paints nothing besides fills `clearFill` judges clear paints nothing.
 */
function coincidingOf({ root, around }: NonNullable<PageFacts["coincidingAround"]>): number {
  return coincidingAround(
    root,
    around.map(({ padding, others }) => ({
      padding,
      others: others.map(({ reaches, paintsBesideFill, fills }) => {
        const paintsNothing = !paintsBesideFill && fills.every(clearFill);
        return { meets: !paintsNothing && reaches, paintsNothing };
      }),
    }))
  );
}

/**
 * The least room, in CSS pixels, a one-column grid's column must keep past its items' least width
 * for the page to record `trackFits`. Chromium sets the same text a fraction of a pixel wider on one
 * platform than the other: on 2026-11-17 the same Roboto 600 24px words gave a grid a min-content
 * column of 140.859px on macOS and 141px in Playwright's Linux image. The page records the fact
 * only with a whole pixel to spare, the room `ellipsisFits` keeps for the same reason, so a grid
 * whose least width comes close to its column records nothing and the build leaves it unmapped. A
 * least width within the platforms' fraction of a pixel of that bound could still land on either
 * side, so `figma:capture --check` in the Linux image is what shows each kept capture agrees.
 */
const TRACK_CLEARANCE_PX = 1;

/**
 * The least lead, in CSS pixels, by which the page counts a grid's column as wider than its items'
 * min-content width, or one item as setting its track over the others (`gridHolds`, `gridWidest`,
 * `gridTallest`). The same Roboto file sets "Selection" at 14px 57.59px wide on macOS and 56px wide in
 * Playwright's Linux image (C5 review, 2026-11-18), a gap wider than {@link TRACK_CLEARANCE_PX}, so the
 * page keeps two whole pixels.
 */
const GRID_CLEARANCE_PX = 2;

/** The page threw while it measured a root's facts, so the capture has none to keep. */
export class FactsUnmeasured extends Error {
  readonly _tag = "FactsUnmeasured" as const;
}

/**
 * How far below its `max-width` a box's width must stay, in CSS pixels, for the page to record
 * `underMaxWidth`: the page lowers the maximum by this much and checks the width did not move. It
 * absorbs the fraction of a pixel by which the same text sets wider on one platform than the other,
 * which {@link TRACK_CLEARANCE_PX} records at under a pixel, many times over. No measurement of type
 * across fonts backs the 24px; `figma:capture --check` in the Linux image shows each kept capture
 * agrees.
 */
const MAX_WIDTH_CLEARANCE_PX = 24;

/**
 * The least free space, in CSS pixels, a flex line must leave its items' auto margins along its
 * direction for the page to record `freeAlongMain`. It keeps the same margin as
 * {@link MAX_WIDTH_CLEARANCE_PX}, for the same reason and with the same evidence.
 */
const FREE_SPACE_CLEARANCE_PX = 24;

/**
 * The least free space, in CSS pixels, a flex line must leave along its direction, with its auto
 * margins at zero, for the page to record `fitsAlongMain`: the line's items fit it. It is the whole
 * pixel {@link TRACK_CLEARANCE_PX} keeps for the same reason, so a line whose items come within the
 * platforms' fraction of a pixel of its end records nothing.
 */
const FIT_CLEARANCE_PX = TRACK_CLEARANCE_PX;

/**
 * Chromium's layout unit, 1/64 of a CSS pixel: a box's width moves by at least this much when its
 * maximum narrows it, so a smaller difference between two readings of one layout is no change.
 */
const LAYOUT_UNIT_PX = 1 / 64;

/** The page side of {@link measuredFacts}, called on the root. */
const MEASURE_IN_PAGE = `async function () {
  const modes = ${JSON.stringify(EVERY_MODE)};
  const root = this;
  const out = {};
  const put = (path, key, value) => { (out[path] ??= {})[key] = value; };
  const contentWidth = (element) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().width - ["padding-left", "padding-right", "border-left-width", "border-right-width"].reduce((sum, name) => sum + (Number.parseFloat(style.getPropertyValue(name)) || 0), 0);
  };
  const texts = (element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const found = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? "").trim() !== "") { found.push(node); }
    }
    return found;
  };
  const withLonger = (element, read) => {
    const nodes = texts(element);
    const before = nodes.map((node) => node.textContent);
    nodes.forEach((node) => { node.textContent += "W"; });
    const value = read();
    nodes.forEach((node, index) => { node.textContent = before[index]; });
    return value;
  };
  const maxContent = (element) => {
    const style = element.getAttribute("style");
    try {
      element.style.width = "max-content";
      return element.getBoundingClientRect().width;
    } finally {
      if (style === null) { element.removeAttribute("style"); } else { element.setAttribute("style", style); }
    }
  };
  const inFlow = (element) => !["absolute", "fixed"].includes(getComputedStyle(element).position) && getComputedStyle(element).display !== "none";
  // The auto margins of a flex container's items along its direction, as their computed values keep
  // \`auto\` (CSS Typed OM), where \`getComputedStyle\` gives their used lengths.
  const autoMargins = (element) => {
    const direction = getComputedStyle(element).flexDirection;
    const sides = direction.startsWith("row") ? ["left", "right"] : ["top", "bottom"];
    return [...element.children].filter(inFlow).flatMap((child) => sides.filter((side) => String(child.computedStyleMap().get("margin-" + side)) === "auto").map((side) => ({ child, side })));
  };
  const elements = [];
  const walk = (element, path) => {
    elements.push({ element, path });
    if (element.localName === "svg") { return; }
    [...element.children].forEach((child, index) => walk(child, path === "" ? String(index) : path + "/" + String(index)));
  };
  walk(root, "");
  const parent = root.parentElement;
  const shrinks = (element) => ["absolute", "fixed"].includes(getComputedStyle(element).position);
  if (parent !== null && !shrinks(root) && !shrinks(parent)) {
    const before = contentWidth(parent);
    const style = parent.getAttribute("style");
    const width = root.getBoundingClientRect().width;
    parent.style.width = String(parent.getBoundingClientRect().width + 10) + "px";
    const follows = Math.abs(root.getBoundingClientRect().width - width - 10) <= 0.5;
    if (style === null) { parent.removeAttribute("style"); } else { parent.setAttribute("style", style); }
    const own = getComputedStyle(root);
    const margins = (Number.parseFloat(own.marginLeft) || 0) + (Number.parseFloat(own.marginRight) || 0);
    const fills = Math.abs(width + margins - before) <= 0.5 && follows;
    if (fills && withLonger(root, () => Math.abs(contentWidth(parent) - before) <= 0.01)) {
      put("", "containerWidth", Math.round(before * 100) / 100);
    }
  }
  const box = root.getBoundingClientRect();
  const rectOf = (rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  // Content an element draws whatever its box's paint says: a replaced element or form control, SVG
  // or MathML, a list item, an element its own content property replaces, an open shadow root's
  // tree, or a generated ::before or ::after box. Any of these counts as paint. \`draws\` is the part
  // of it whose paint the page does not bound by the element's box. A closed shadow root is unseen
  // here (issue #766).
  const REPLACED = new Set(["img", "video", "audio", "canvas", "iframe", "object", "embed", "picture", "input", "textarea", "select", "button", "meter", "progress", "math"]);
  const generates = (element) => ["::before", "::after"].some((pseudo) => !["none", "normal"].includes(getComputedStyle(element, pseudo).content));
  const marks = (style) => style.display.includes("list-item") && (style.listStyleType !== "none" || style.listStyleImage !== "none");
  const draws = (each) => {
    const style = getComputedStyle(each);
    return marks(style) || !["none", "normal"].includes(style.content) || each.shadowRoot !== null || generates(each);
  };
  const drawsContent = (each) => REPLACED.has(each.localName) || each.namespaceURI !== "http://www.w3.org/1999/xhtml" || getComputedStyle(each).display.includes("list-item") || draws(each);
  // Whether an element and every element below it paint none of what the page checks besides their
  // fill, whose colors \`fillsOf\` lists for \`coincidingOf\` to judge outside the page.
  const paintsBesideFill = (element) => ![element, ...element.querySelectorAll("*")].every((each) => {
    const style = getComputedStyle(each);
    const sides = ["top", "right", "bottom", "left"];
    return !drawsContent(each) && style.backgroundImage === "none" && style.borderImageSource === "none" && style.boxShadow === "none" && style.backdropFilter === "none" &&
      sides.every((side) => style.getPropertyValue("border-" + side + "-style") === "none" || Number.parseFloat(style.getPropertyValue("border-" + side + "-width")) === 0) &&
      (style.outlineStyle === "none" || Number.parseFloat(style.outlineWidth) === 0) &&
      [...each.childNodes].every((node) => node.nodeType !== 3 || (node.textContent ?? "").trim() === "");
  });
  const fillsOf = (element) => [...new Set([element, ...element.querySelectorAll("*")].map((each) => getComputedStyle(each).backgroundColor))];
  const overlapsRoot = (edges) => edges.left < box.right && edges.right > box.left && edges.top < box.bottom && edges.bottom > box.top;
  const meetsRoot = (rect) => rect.width > 0 && rect.height > 0 && overlapsRoot(rect);
  const ownText = (element) => [...element.childNodes].filter((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "");
  // Whether an element or an element below it counts as reaching the root's box. A box that meets
  // it counts, since a box can overflow its parent. Wherever it lies, so does text, SVG or MathML,
  // what \`draws\` lists, a shadow, a filter, a backdrop filter, a border image, a reflection or an
  // outline, since each can paint past the element's box (CSS Overflow 3 §2.2) by an amount the page
  // does not measure.
  const reaches = (element) => [element, ...element.querySelectorAll("*")].some((each) => {
    const style = getComputedStyle(each);
    return each.namespaceURI !== "http://www.w3.org/1999/xhtml" || draws(each) || ownText(each).length > 0 || style.boxShadow !== "none" || style.filter !== "none" || style.backdropFilter !== "none" ||
      style.borderImageSource !== "none" || style.webkitBoxReflect !== "none" ||
      (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) !== 0) ||
      meetsRoot(each.getBoundingClientRect());
  });
  const around = [];
  let below = root;
  for (let up = root.parentElement; up !== null && !up.hasAttribute("data-compare-cell"); up = up.parentElement) {
    const edges = up.getBoundingClientRect();
    const style = getComputedStyle(up);
    const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const padding = { left: edges.left + px("border-left-width"), top: edges.top + px("border-top-width"), right: edges.right - px("border-right-width"), bottom: edges.bottom - px("border-bottom-width") };
    const others = [...up.children].filter((each) => each !== below).map((each) => {
      const beside = paintsBesideFill(each);
      return { reaches: reaches(each), paintsBesideFill: beside, fills: beside ? [] : fillsOf(each) };
    });
    // The element's own text, its marker, content that replaces it, a shadow root and a generated
    // box count as a child over the root, and so does its own paint that can cover the padding box
    // behind the root: an inset shadow (CSS Backgrounds 3 §7.1), a border image wider than its
    // border, or an outline, which a negative offset draws inside the box.
    const ownPaint = style.boxShadow.includes("inset") || style.borderImageSource !== "none" || (style.outlineStyle !== "none" && px("outline-width") !== 0);
    const own = ownPaint || ownText(up).length > 0 || draws(up) ? [{ reaches: true, paintsBesideFill: true, fills: [] }] : [];
    around.push({ padding, others: [...others, ...own] });
    below = up;
  }
  put("", "coincidingAround", { root: rectOf(box), around });
  const width = root.getBoundingClientRect().width;
  if (Math.abs(maxContent(root) - width) <= 0.5) {
    const rows = elements.filter(({ element }) => element !== root && element.hasAttribute("data-slot") && element.parentElement !== null && texts(element).length > 0 && Math.abs(element.getBoundingClientRect().width - contentWidth(element.parentElement)) <= 0.5);
    const leaves = rows.filter((row) => !rows.some((other) => other !== row && row.element.contains(other.element)));
    const widths = leaves.map(({ element, path }) => ({ path, width: maxContent(element) })).sort((left, right) => right.width - left.width);
    const [first, second] = widths;
    if (first !== undefined && (second === undefined || first.width - second.width > 0.5)) {
      put(first.path, "widest", true);
    }
  }
  const underMaxWidth = [];
  const freeAlongMain = [];
  const tableTiles = [];
  const lineBoxes = [];
  const TABLE_BOXES = new Set(["table", "table-row-group", "table-header-group", "table-footer-group", "table-row", "table-cell"]);
  for (const { element, path } of elements) {
    const style = getComputedStyle(element);
    const own = [...element.childNodes].filter((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "");
    const tracks = style.display.endsWith("grid") ? style.gridTemplateColumns.trim().split(/\\s+/) : [];
    if (tracks.length === 1) {
      const column = Number.parseFloat(tracks[0] ?? "");
      const saved = element.getAttribute("style");
      element.style.setProperty("width", "min-content", "important");
      element.style.setProperty("min-width", "0px", "important");
      element.style.setProperty("max-width", "none", "important");
      const least = Number.parseFloat(getComputedStyle(element).gridTemplateColumns);
      if (saved === null) { element.removeAttribute("style"); } else { element.setAttribute("style", saved); }
      if (Math.abs(column - contentWidth(element)) <= 0.5 && least + ${String(TRACK_CLEARANCE_PX)} <= column) { put(path, "trackFits", true); }
    }
    if (style.flexWrap.startsWith("wrap") && element.children.length > 1) {
      let bottom = -Infinity;
      let lines = 0;
      for (const child of [...element.children].map((each) => each.getBoundingClientRect()).sort((left, right) => left.top - right.top)) {
        if (child.top >= bottom - 0.5) { lines += 1; }
        bottom = Math.max(bottom, child.bottom);
      }
      if (lines === 1) { put(path, "oneLine", true); }
    } else if (own.length > 0 && style.maxWidth !== "none") {
      const tops = new Set();
      for (const node of own) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) { tops.add(Math.round(rect.top)); }
      }
      if (tops.size === 1) { put(path, "oneLine", true); }
    }
    const text = style.textOverflow === "ellipsis" && style.overflowX !== "visible" && (style.textWrapMode === "nowrap" || style.whiteSpace === "nowrap") ? (element.textContent ?? "").trim() : "";
    if (text !== "") {
      const [first] = new Intl.Segmenter().segment(text);
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
      probe.textContent = (first?.segment ?? "") + "\u2026";
      element.append(probe);
      const need = probe.getBoundingClientRect().width;
      probe.remove();
      if (contentWidth(element) >= need + 1) { put(path, "ellipsisFits", true); }
    }
    if (style.maxHeight !== "none" && element.getBoundingClientRect().height + 0.5 < Number.parseFloat(style.maxHeight)) {
      put(path, "underMaxHeight", true);
    }
    if (style.maxWidth !== "none") { underMaxWidth.push({ element, path }); }
    if (style.display.endsWith("flex") && !style.flexWrap.startsWith("wrap") && autoMargins(element).length > 0) { freeAlongMain.push({ element, path }); }
    if (TABLE_BOXES.has(style.display)) { tableTiles.push({ element, path }); }
    const [child, ...others] = element.children;
    if (child !== undefined && others.length === 0 && own.length === 0) { lineBoxes.push({ element, path }); }
  }
  // The facts that must hold in every mode a designer can pick: each candidate is measured with the
  // page stamped in each mode, once the faces the mode's text needs have loaded, and keeps the fact
  // only where every mode keeps it. The page's own mode comes back whatever a measurement throws.
  const settleFonts = async () => {
    const faces = new Set();
    for (const { element } of elements) {
      if (ownText(element).length > 0) {
        const style = getComputedStyle(element);
        faces.add([style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(" "));
      }
    }
    await Promise.all([...faces].map((face) => document.fonts.load(face)));
    await document.fonts.ready;
  };
  // Stamp the page in each mode, settle the mode's faces and visit it, then put the page's own mode
  // back, whatever a visit throws.
  const inEveryMode = async (visit) => {
    const html = document.documentElement;
    const body = document.body;
    const saved = [html, body].map((element) => [element, [...element.attributes].filter((attribute) => attribute.name.startsWith("data-")).map((attribute) => [attribute.name, attribute.value])]);
    try {
      for (const mode of modes) {
        for (const [name, value] of Object.entries(mode.root)) { html.setAttribute(name, value); }
        for (const [name, value] of Object.entries(mode.body)) { body.setAttribute(name, value); }
        await settleFonts();
        visit();
      }
    } finally {
      for (const [element, attributes] of saved) {
        for (const name of [...element.attributes].map((attribute) => attribute.name).filter((name) => name.startsWith("data-"))) { element.removeAttribute(name); }
        for (const [name, value] of attributes) { element.setAttribute(name, value); }
      }
    }
    await settleFonts();
  };
  // The candidates that hold in every mode.
  const holdsInEveryMode = async (candidates, holds) => {
    if (candidates.length === 0) { return candidates; }
    let kept = candidates;
    await inEveryMode(() => { kept = kept.filter((candidate) => holds(candidate.element)); });
    return kept;
  };
  // Each candidate with the least value its measure takes across the modes.
  const leastInEveryMode = async (candidates, measure) => {
    const least = candidates.map((candidate) => ({ ...candidate, least: Infinity }));
    if (least.length === 0) { return least; }
    await inEveryMode(() => {
      for (const candidate of least) { candidate.least = Math.min(candidate.least, measure(candidate.element)); }
    });
    return least;
  };
  // Write temporary styles on elements, measure, and put each \`style\` attribute back as it was.
  const withStyles = (writes, measure) => {
    const saved = [...new Set(writes.map(([element]) => element))].map((element) => [element, element.getAttribute("style")]);
    try {
      for (const [element, property, value] of writes) { element.style.setProperty(property, value, "important"); }
      return measure();
    } finally {
      for (const [element, attribute] of saved) {
        if (attribute === null) { element.removeAttribute("style"); } else { element.setAttribute("style", attribute); }
      }
    }
  };
  // A maximum is lowered by the clearance, which Chromium must apply: an intrinsic keyword such as
  // \`min-content\` makes the \`calc()\` invalid, so it keeps its value.
  const underMax = (element) => {
    const maximum = getComputedStyle(element).maxWidth;
    if (maximum === "none" || /content/.test(maximum)) { return false; }
    const width = element.getBoundingClientRect().width;
    return withStyles([[element, "max-width", "calc(" + maximum + " - ${String(MAX_WIDTH_CLEARANCE_PX)}px)"]], () =>
      getComputedStyle(element).maxWidth !== maximum &&
      Math.abs(element.getBoundingClientRect().width - width) < ${String(LAYOUT_UNIT_PX)});
  };
  for (const { path } of await holdsInEveryMode(underMaxWidth, underMax)) { put(path, "underMaxWidth", true); }
  // An element whose one element child is an inline-level box and which holds no text of its own,
  // whose content box's top and bottom edges are the child's margin box's at its own line height and
  // at 2px more, the child's line height held.
  const lineFits = (element) => {
    const [child] = element.children;
    const style = getComputedStyle(element);
    const line = Number.parseFloat(style.lineHeight);
    if (child === undefined || !getComputedStyle(child).display.startsWith("inline-") || !Number.isFinite(line)) { return false; }
    const sum = (style, names) => names.reduce((total, name) => total + (Number.parseFloat(style.getPropertyValue(name)) || 0), 0);
    const fits = () => {
      const box = element.getBoundingClientRect();
      const inner = getComputedStyle(element);
      const top = box.top + sum(inner, ["border-top-width", "padding-top"]);
      const bottom = box.bottom - sum(inner, ["border-bottom-width", "padding-bottom"]);
      const outer = getComputedStyle(child);
      const edges = child.getBoundingClientRect();
      return Math.abs(edges.top - sum(outer, ["margin-top"]) - top) <= 0.5 && Math.abs(edges.bottom + sum(outer, ["margin-bottom"]) - bottom) <= 0.5;
    };
    if (!fits()) { return false; }
    const childLine = getComputedStyle(child).lineHeight;
    return withStyles([[child, "line-height", childLine], [element, "line-height", String(line + 2) + "px"]], () => {
      const applied = Math.abs(Number.parseFloat(getComputedStyle(element).lineHeight) - line - 2) <= 0.01 && getComputedStyle(child).lineHeight === childLine;
      return applied && fits();
    });
  };
  for (const { path } of await holdsInEveryMode(lineBoxes, lineFits)) { put(path, "lineFits", true); }
  // The room a flex line leaves along its direction past its items and the gaps between them, once
  // the auto margins along it give their room back, or -Infinity for a line in neither direction.
  const roomAlong = (element) => {
    const style = getComputedStyle(element);
    const row = style.flexDirection === "row";
    if (!row && style.flexDirection !== "column") { return -Infinity; }
    const writes = autoMargins(element).map(({ child, side }) => [child, "margin-" + side, "0px"]);
    return withStyles(writes, () => {
      const box = element.getBoundingClientRect();
      const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
      const end = row ? box.right - px("border-right-width") - px("padding-right") : box.bottom - px("border-bottom-width") - px("padding-bottom");
      const used = Math.max(...[...element.children].filter(inFlow).map((child) => {
        const edges = child.getBoundingClientRect();
        const after = Number.parseFloat(getComputedStyle(child).getPropertyValue(row ? "margin-right" : "margin-bottom")) || 0;
        return (row ? edges.right : edges.bottom) + after;
      }));
      return end - used;
    });
  };
  // One sweep measures each line's least room, which each fact compares with its own clearance.
  for (const { path, least } of await leastInEveryMode(freeAlongMain, roomAlong)) {
    if (least >= ${String(FREE_SPACE_CLEARANCE_PX)}) { put(path, "freeAlongMain", true); }
    if (least >= ${String(FIT_CLEARANCE_PX)}) { put(path, "fitsAlongMain", true); }
  }
  // A table box whose parts tile its content box with no space between, each part as the box lays
  // it out: a table or a row group its rows down it, each as wide as it, a row its cells across it,
  // each as tall as it, and a cell its one child, or its own text at the cell's own length, or, where
  // it sets no width, at the width it takes as a block at its max-content width, so no column or row
  // stretches a cell past what it holds.
  const near = (left, right) => Math.abs(left - right) < ${String(LAYOUT_UNIT_PX)};
  // A row or a row group whose table collapses its borders sets them on the grid lines between the
  // cells (CSS 2.1 §17.6.2), not inside its own box, so its parts span its border box.
  const collapsesInto = (element) => {
    const style = getComputedStyle(element);
    return style.borderCollapse === "collapse" && ["table-row", "table-row-group", "table-header-group", "table-footer-group"].includes(style.display);
  };
  const contentBox = (element) => {
    const box = element.getBoundingClientRect();
    if (collapsesInto(element)) {
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }
    const style = getComputedStyle(element);
    const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    return {
      left: box.left + px("border-left-width") + px("padding-left"),
      right: box.right - px("border-right-width") - px("padding-right"),
      top: box.top + px("border-top-width") + px("padding-top"),
      bottom: box.bottom - px("border-bottom-width") - px("padding-bottom"),
    };
  };
  const marginBox = (element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    return { left: box.left - px("margin-left"), right: box.right + px("margin-right"), top: box.top - px("margin-top"), bottom: box.bottom + px("margin-bottom") };
  };
  // A cell's own length on an axis where it sets one, as CSS Typed OM computes it: a length in px.
  const ownLength = (element, property) => {
    const value = element.computedStyleMap().get(property);
    return value !== null && value !== undefined && "unit" in value && value.unit === "px" ? value.value : undefined;
  };
  const tiles = (element) => {
    const display = getComputedStyle(element).display;
    const inner = contentBox(element);
    const parts = [...element.children].filter(inFlow);
    if (display === "table-cell") {
      const [only, ...rest] = parts;
      if (only !== undefined) {
        const outer = marginBox(only);
        const fills = rest.length === 0 && ownText(element).length === 0 && near(outer.left, inner.left) && near(outer.right, inner.right) && near(outer.top, inner.top) && near(outer.bottom, inner.bottom);
        if (!fills) { return false; }
        // The child must keep its size where the cell shrinks to fit it as a block outside the table,
        // so its own size, not the column's or the row's, is what the cell wraps.
        const own = only.getBoundingClientRect();
        return withStyles([
          [element, "display", "block"],
          [element, "width", "max-content"],
          [element, "height", "auto"],
        ], () => {
          const alone = only.getBoundingClientRect();
          return near(alone.width, own.width) && near(alone.height, own.height);
        });
      }
      const box = element.getBoundingClientRect();
      const width = ownLength(element, "width");
      const height = ownLength(element, "height");
      if (width !== undefined && height !== undefined) {
        return near(box.width, width) && near(box.height, height);
      }
      // A cell that sets a height and no width holds its text at its own height where the text
      // fits it, and at the width it takes as a block at its max-content width, where no column
      // stretches it, so it hugs its text across. Its text must not wrap, as Fuse's Table cells set
      // with \`whitespace-nowrap\`: a designer's narrower column would otherwise wrap it to more lines
      // than the fixed height holds.
      const unwrapped = getComputedStyle(element).textWrapMode === "nowrap";
      return unwrapped && width === undefined && height !== undefined && near(box.height, height) && withStyles([
        [element, "display", "block"],
        [element, "width", "max-content"],
        [element, "height", "auto"],
        [element, "min-height", height + "px"],
      ], () => {
        const alone = element.getBoundingClientRect();
        return near(alone.width, box.width) && near(alone.height, box.height);
      });
    }
    const across = display === "table-row";
    const wanted = across ? ["table-cell"] : ["table-row", "table-row-group", "table-header-group", "table-footer-group"];
    if (parts.length === 0 || ownText(element).length > 0 || !parts.every((part) => wanted.includes(getComputedStyle(part).display))) {
      return false;
    }
    let edge = across ? inner.left : inner.top;
    for (const part of parts) {
      const box = part.getBoundingClientRect();
      const fits = across
        ? near(box.left, edge) && near(box.top, inner.top) && near(box.bottom, inner.bottom)
        : near(box.top, edge) && near(box.left, inner.left) && near(box.right, inner.right);
      if (!fits) { return false; }
      edge = across ? box.right : box.bottom;
    }
    // A row or a group hugs its parts only where each of them hugs what it holds in turn.
    return near(edge, across ? inner.right : inner.bottom) && parts.every((part) => tiles(part));
  };
  for (const { path } of await holdsInEveryMode(tableTiles, tiles)) { put(path, "tableTiles", true); }
  // A row's collapsed border is its own only where no other box on the same grid line sets one: a
  // wider one, a \`hidden\` one or a cell's equal one wins the line instead (CSS 2.1 §17.6.2.1).
  // The check errs toward leaving a border out. On each side the row sets, none of these may set a
  // border: its own cells, the next row on that side and that row's cells, the table, and any
  // column, row group or spanning cell of the table.
  const SIDES = ["top", "right", "bottom", "left"];
  const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const borders = (element, side) => {
    const style = getComputedStyle(element);
    const kind = style.getPropertyValue("border-" + side + "-style");
    return kind === "hidden" || (kind !== "none" && Number.parseFloat(style.getPropertyValue("border-" + side + "-width")) > 0);
  };
  const tableAround = (element) => {
    let up = element.parentElement;
    while (up !== null && !["table", "inline-table"].includes(getComputedStyle(up).display)) { up = up.parentElement; }
    return up;
  };
  const ownsBorders = (row) => {
    const own = SIDES.filter((side) => borders(row, side));
    const table = tableAround(row);
    if (own.length === 0) { return true; }
    if (table === null) { return false; }
    const boxes = (displays) => [...table.querySelectorAll("*")].filter((element) => displays.includes(getComputedStyle(element).display) && tableAround(element) === table);
    const rows = boxes(["table-row"]);
    const at = rows.indexOf(row);
    const cellsOf = (element) => element === undefined ? [] : [...element.children].filter((cell) => getComputedStyle(cell).display === "table-cell");
    const anywhere = [
      ...boxes(["table-column", "table-column-group", "table-row-group", "table-header-group", "table-footer-group"]),
      ...boxes(["table-cell"]).filter((cell) => cell.rowSpan > 1),
    ];
    const across = { top: rows[at - 1], bottom: rows[at + 1] };
    return own.every((side) => {
      const neighbor = across[side];
      const same = [table, ...cellsOf(row)].map((box) => [box, side]);
      const facing = (neighbor === undefined ? [] : [neighbor, ...cellsOf(neighbor)]).map((box) => [box, OPPOSITE[side]]);
      const either = anywhere.flatMap((box) => [[box, side], [box, OPPOSITE[side]]]);
      return ![...same, ...facing, ...either].some(([box, edge]) => borders(box, edge));
    });
  };
  const tableRows = tableTiles.filter(({ element }) => getComputedStyle(element).display === "table-row");
  for (const { path } of await holdsInEveryMode(tableRows, (row) => collapsesInto(row) && ownsBorders(row))) { put(path, "bordersCollapse", true); }
  // A flex row's items whose own display is \`inline\`, which the row blockifies: the page reads
  // each item's display with the row a block for a moment, where nothing blockifies it.
  const pathOf = new Map(elements.map(({ element, path }) => [element, path]));
  const inlineRows = [];
  for (const { element } of elements) {
    const style = getComputedStyle(element);
    if (!style.display.endsWith("flex")) { continue; }
    const items = [...element.children].filter(inFlow);
    const inline = withStyles([[element, "display", "block"]], () => items.filter((item) => getComputedStyle(item).display === "inline"));
    if (inline.length > 0) { inlineRows.push({ element, inline }); }
  }
  // The row's items sit on its one line in source order, each one box with its own text on one
  // line, each starting where the one before it ends or after, all sharing a band of the line.
  // \`flex-direction\` and \`flex-wrap\` keep their values on a box that is no flex container, so the
  // row must be one in each mode, with each inline item among its in-flow items.
  const inlineOf = new Map(inlineRows.map(({ element, inline }) => [element, inline]));
  const oneRow = (element) => {
    const style = getComputedStyle(element);
    if (!["flex", "inline-flex"].includes(style.display) || style.flexDirection !== "row" || style.flexWrap !== "nowrap") { return false; }
    const items = [...element.children].filter(inFlow);
    if (!(inlineOf.get(element) ?? []).every((item) => items.includes(item))) { return false; }
    let end = -Infinity;
    let top = -Infinity;
    let bottom = Infinity;
    for (const item of items) {
      const boxes = item.getClientRects();
      const [box] = boxes;
      if (boxes.length !== 1 || box === undefined || box.left + ${String(LAYOUT_UNIT_PX)} < end) { return false; }
      const lines = new Set();
      for (const node of ownText(item)) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) { lines.add(Math.round(rect.top)); }
      }
      if (lines.size > 1) { return false; }
      end = box.right;
      top = Math.max(top, box.top);
      bottom = Math.min(bottom, box.bottom);
    }
    return top < bottom;
  };
  // A flex row's items that grow, each as wide as its own max-content width: the row's free space,
  // spread from their bases, leaves none of them wider than its content.
  const growing = (element) => [...element.children].filter(inFlow).filter((child) => (Number.parseFloat(getComputedStyle(child).flexGrow) || 0) > 0);
  const atContent = (element) => {
    const style = getComputedStyle(element);
    if (!style.display.endsWith("flex") || style.flexDirection !== "row" || style.flexWrap !== "nowrap") { return false; }
    const items = growing(element);
    // Each item is as wide as its max-content, and that is its min-content too, for the text the
    // capture renders; the build reads the fact only where declarations keep it for any text.
    return items.length > 1 && items.every((item) => {
      const width = item.getBoundingClientRect().width;
      const most = withStyles([[item, "flex", "none"], [item, "width", "max-content"]], () => item.getBoundingClientRect().width);
      const least = withStyles([[item, "flex", "none"], [item, "width", "min-content"]], () => item.getBoundingClientRect().width);
      return Math.abs(width - most) < ${String(LAYOUT_UNIT_PX)} && Math.abs(most - least) < ${String(LAYOUT_UNIT_PX)};
    });
  };
  // A root whose height is a percentage, and the first element above it whose computed height is a
  // length: that element is as tall as that length, so a column around it neither grew nor shrank it.
  const pxHeight = (element) => {
    const value = element.computedStyleMap().get("height");
    return value !== null && value !== undefined && "unit" in value && value.unit === "px" ? value.value : undefined;
  };
  const percentHeight = (element) => {
    const value = element.computedStyleMap().get("height");
    return value !== null && value !== undefined && !("value" in value && typeof value.value === "string") && pxHeight(element) === undefined;
  };
  const lengthAbove = (element) => {
    for (let up = element.parentElement; up !== null; up = up.parentElement) {
      if (pxHeight(up) !== undefined) { return up; }
    }
    return undefined;
  };
  const basisAsDeclared = (element) => {
    const above = lengthAbove(element);
    if (above === undefined) { return false; }
    const style = getComputedStyle(above);
    const px = (name) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const box = above.getBoundingClientRect().height;
    const used = style.boxSizing === "border-box" ? box : box - px("padding-top") - px("padding-bottom") - px("border-top-width") - px("border-bottom-width");
    return Math.abs(used - (pxHeight(above) ?? Number.NaN)) < ${String(LAYOUT_UNIT_PX)};
  };
  // A root of \`auto\` height that its parent's flex row may stretch, as List detail's pane.
  const stretchable = (element) => {
    const parent = element.parentElement;
    const around = parent === null ? undefined : getComputedStyle(parent);
    return String(element.computedStyleMap().get("height")) === "auto" && around !== undefined && around.display.endsWith("flex") && around.flexDirection === "row" && around.flexWrap === "nowrap";
  };
  if ((percentHeight(root) || stretchable(root)) && (await holdsInEveryMode([{ element: root, path: "" }], basisAsDeclared)).length > 0) {
    put("", "basisAsDeclared", true);
  }
  // An element with a preferred aspect ratio and an \`auto\` height, as tall as its width times the
  // ratio in the page's own mode, and with the same width, height and ratio in every mode, so no mode
  // changed the box and no content stretched it past the ratio's height. The fact records the box,
  // since a flex row can shrink it below the width the build reads (CSS Flexbox 1 §9.7).
  const ratioOf = (element) => {
    const value = getComputedStyle(element).aspectRatio;
    if (value.includes("auto")) { return undefined; }
    const [across, down = 1, ...rest] = value.split("/").map(Number);
    return rest.length === 0 && across > 0 && down > 0 ? { value, perWidth: down / across } : undefined;
  };
  const ratioBoxes = elements.flatMap(({ element, path }) => {
    const ratio = ratioOf(element);
    const box = element.getBoundingClientRect();
    return ratio !== undefined && String(element.computedStyleMap().get("height")) === "auto" && near(box.height, box.width * ratio.perWidth)
      ? [{ element, path, ratio: ratio.value, width: box.width, height: box.height }]
      : [];
  });
  const ratioKept = new Map(ratioBoxes.map((candidate) => [candidate.element, candidate]));
  const ratioHeight = (element) => {
    const own = ratioKept.get(element);
    const box = element.getBoundingClientRect();
    return own !== undefined && ratioOf(element)?.value === own.ratio && near(box.width, own.width) && near(box.height, own.height);
  };
  for (const { path, width, height } of await holdsInEveryMode(ratioBoxes, ratioHeight)) { put(path, "ratioHeight", { width, height }); }
  const growingRows = elements.filter(({ element }) => getComputedStyle(element).display.endsWith("flex") && growing(element).length > 1);
  for (const { path } of await holdsInEveryMode(growingRows, atContent)) { put(path, "itemsAtContent", true); }
  for (const { inline } of await holdsInEveryMode(inlineRows, oneRow)) {
    for (const item of inline) {
      const path = pathOf.get(item);
      if (path !== undefined) { put(path, "inlineRow", true); }
    }
  }
  // The columns of each grid of two or more that hug their items, and whether every column holds its
  // items, in every mode: a column hugs only where each mode measured it so.
  const holdsOwnText = (${holdsOwnText.toString()});
  const pseudoInFlow = (${pseudoInFlow.toString()});
  const generatesNoBox = (${generatesNoBox.toString()});
  const addsBox = (element) => holdsOwnText(element) || pseudoInFlow(element);
  // An element that generates no box and adds nothing to its parent's flow but its children's boxes.
  const wrappers = elements.filter(({ element }) => generatesNoBox(element, holdsOwnText, pseudoInFlow));
  for (const { path } of await holdsInEveryMode(wrappers, (each) => generatesNoBox(each, holdsOwnText, pseudoInFlow))) { put(path, "noBox", true); }
  const gridColumns = (${gridColumns.toString()});
  const gridHelpers = (element) => ({ withStyles, longer: (read) => withLonger(element, read), addsBox, unit: ${String(LAYOUT_UNIT_PX)}, clearance: ${String(GRID_CLEARANCE_PX)} });
  const grids = elements.flatMap(({ element, path }) => {
    const first = gridColumns(element, gridHelpers(element));
    return first === undefined ? [] : [{ element, path, hugs: new Set(first.hugs), holds: new Set(first.holds), widest: first.widest, tallest: first.tallest, items: first.items }];
  });
  if (grids.length > 0) {
    await inEveryMode(() => {
      for (const grid of grids) {
        const read = gridColumns(grid.element, gridHelpers(grid.element));
        grid.hugs = new Set([...grid.hugs].filter((column) => read?.hugs.includes(column) === true));
        grid.holds = new Set([...grid.holds].filter((column) => read?.holds.includes(column) === true));
        // A track's longest item counts only where every mode measured the same one.
        grid.widest = grid.widest.map((item, column) => (read?.widest[column] === item ? item : -1));
        grid.tallest = grid.tallest.map((item, row) => (read?.tallest[row] === item ? item : -1));
        // The grid counts as measured only where every mode finds the same items.
        grid.items = grid.items !== undefined && read !== undefined && read.items.length === grid.items.length && read.items.every((item, index) => item === grid.items[index]) ? grid.items : undefined;
      }
    });
  }
  for (const { path, hugs, holds, widest, tallest, items } of grids) {
    if (items === undefined) { continue; }
    put(path, "gridItems", items.length);
    items.forEach((item, index) => { const at = pathOf.get(item); if (at !== undefined) { put(at, "gridItem", index); } });
    if (hugs.size > 0) { put(path, "gridHugs", [...hugs].sort((left, right) => left - right)); }
    if (holds.size > 0) { put(path, "gridHolds", [...holds].sort((left, right) => left - right)); }
    if (widest.some((item) => item >= 0)) { put(path, "gridWidest", widest); }
    if (tallest.some((item) => item >= 0)) { put(path, "gridTallest", tallest); }
  }
  // An absolute ::before or ::after laid out in every mode, with the paint its box computes to, which
  // \`pseudoPaints\` judges outside the page.
  const pseudoPaintOf = (${pseudoPaintOf.toString()});
  const pseudoBox = (${pseudoBox.toString()});
  for (const name of ["before", "after"]) {
    const pseudo = "::" + name;
    const boxes = elements.filter(({ element }) => pseudoBox(element, pseudo));
    for (const { element, path } of await holdsInEveryMode(boxes, (each) => pseudoBox(each, pseudo))) {
      put(path, "pseudoPaint", { ...(out[path]?.pseudoPaint ?? {}), [name]: pseudoPaintOf(element, pseudo) });
    }
  }
  // An absolute element whose parent spans its containing block, in every mode.
  const parentSpansBlock = (${parentSpansBlock.toString()});
  const spanned = elements.filter(({ element }) => element !== root && parentSpansBlock(element, root));
  for (const { path } of await holdsInEveryMode(spanned, (each) => parentSpansBlock(each, root))) { put(path, "parentSpansBlock", true); }
  // A child of the root that paints over every other box of the root by its z-index, in every mode.
  const paintsLast = (${paintsLast.toString()});
  const raised = elements.filter(({ element }) => paintsLast(element, root));
  for (const { path } of await holdsInEveryMode(raised, (each) => paintsLast(each, root))) { put(path, "paintsLast", true); }
  // An element that sets a transform which computes to the identity matrix, in every mode.
  const identityMatrix = (element) => ["matrix(1, 0, 0, 1, 0, 0)", "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"].includes(getComputedStyle(element).transform);
  const unmoved = elements.filter(({ element }) => identityMatrix(element));
  for (const { path } of await holdsInEveryMode(unmoved, identityMatrix)) { put(path, "identityTransform", true); }
  // The lengths of each absolute element below the root in every mode, kept on the axes where they agree.
  const absolutes = elements
    .filter(({ element }) => element !== root && getComputedStyle(element).position === "absolute")
    .map((each) => ({ ...each, widths: [], heights: [] }));
  if (absolutes.length > 0) {
    await inEveryMode(() => {
      for (const each of absolutes) {
        const box = each.element.getBoundingClientRect();
        each.widths.push(box.width);
        each.heights.push(box.height);
      }
    });
  }
  const agree = (lengths) => Math.max(...lengths) - Math.min(...lengths) <= ${String(LAYOUT_UNIT_PX)};
  for (const { path, widths, heights } of absolutes) {
    const axes = [...(agree(widths) ? ["horizontal"] : []), ...(agree(heights) ? ["vertical"] : [])];
    if (axes.length > 0) { put(path, "oneLength", axes); }
  }
  // A block that spans a parent which fits its content, and the widest max-content width beside it in every mode.
  const typed = (element, property) => String(element.computedStyleMap().get(property));
  const fitsContent = (element) => ["block", "flow-root"].includes(getComputedStyle(element).display) && ["fit-content", "max-content"].includes(typed(element, "width"));
  const unmargined = (element) => ["margin-left", "margin-right"].every((side) => getComputedStyle(element).getPropertyValue(side) === "0px");
  // The block's in-flow siblings, where it spans a parent that fits its content beside them, all
  // with no horizontal margin, or undefined where it does not.
  const besideSpan = (element) => {
    const parent = element.parentElement;
    if (!inFlow(element) || typed(element, "width") !== "100%" || !unmargined(element) || !fitsContent(parent)) { return undefined; }
    const beside = [...parent.children].filter((child) => child !== element && inFlow(child));
    return beside.length > 0 && beside.every(unmargined) ? beside : undefined;
  };
  const spanning = elements
    .filter(({ element }) => element !== root && element.parentElement !== null && root.contains(element.parentElement) && besideSpan(element) !== undefined)
    .map((each) => ({ ...each, widths: [] }));
  if (spanning.length > 0) {
    await inEveryMode(() => {
      // Each mode checks the block anew, and the parent fits the others alone once the block takes no room.
      for (const each of spanning) {
        each.widths.push(besideSpan(each.element) === undefined ? NaN : withStyles([[each.element, "display", "none"]], () => contentWidth(each.element.parentElement)));
      }
    });
  }
  for (const { path, widths } of spanning) {
    if (widths.every(Number.isFinite) && agree(widths)) { put(path, "spansBeside", Math.round(widths[0] * 64) / 64); }
  }
  return out;
}`;
