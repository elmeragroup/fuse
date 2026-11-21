/**
 * The room a flex line leaves along its direction past its items and the gaps between them, as the
 * capture's page function measures it for the facts `freeAlongMain` and `fitsAlongMain`, which say
 * whether the auto margins along the line take room and whether its items fit it, and for
 * `oneFlexLine`, which says a wrapping flex container lays its items out on one line. It also reads
 * a wrapping flex row's lines for `flexLines`, which says whether they draw as a Figma WRAP row. The
 * page calls `roomAlong` on each flex container whose items hold auto margins along its direction,
 * and `roomAlong` and `flexLinesIn` on each that wraps, in one sweep of every mode it stamps. It
 * compares the least room with each fact's clearance, and a mode with no room records none of those
 * facts.
 * The functions are passed to the page as their source, so each reads nothing outside its own body
 * and the helpers it is handed.
 */

import type { FlexLineLayout, FlexLinesFact, FlexLinesRefusal } from "./capture-format.ts";

/** One auto margin of a flex container's item along the container's direction. */
type AutoMargin = { readonly child: Element; readonly side: string };

/**
 * One in-flow item of a flex container: an element, or the run of text that lays out in one
 * anonymous flex item (CSS Flexbox 1 §4), as the text nodes it gathers in order.
 */
type FlexItem = Element | readonly Text[];

/** The helpers the page hands {@link roomAlong}. */
type PageHelpers = {
  /** Writes styles for a measure, puts them back, and returns what the measure read. */
  readonly withStyles: <T>(writes: readonly (readonly [Element, string, string])[], measure: () => T) => T;
  /** The auto margins along a flex container's direction of its items, as `items` finds them. */
  readonly autoMargins: (element: Element) => readonly AutoMargin[];
  /** A flex container's in-flow items, as {@link flexItems} finds them. */
  readonly items: (element: Element) => readonly FlexItem[] | undefined;
  /** The border box of an item, as {@link itemBox} reads it. */
  readonly box: (item: FlexItem) => DOMRect | undefined;
  /** Whether a transform applies between a node and a flex container, as {@link transformedWithin} says. */
  readonly transformed: (node: Node, container: Element) => boolean;
};

/** What the page hands {@link flexItems}. */
type ItemReaders = {
  /** Whether an element sits in its parent's flow. */
  readonly inFlow: (element: Element) => boolean;
  /** `pseudoInFlow` in `no-box.ts`: whether an element's `::before` or `::after` is a box in its parent's flow. */
  readonly pseudo: (element: Element) => boolean;
};

/**
 * A flex container's in-flow items. A child whose `display` is `contents` generates no box, so its
 * children and its text take its place in the container's flow (CSS Display 3 §2.5), and the walk
 * looks through it. Each run of text between two boxes in that flow, across comments and the
 * children the walk looks through, lays out in one anonymous item, and a run of document white space
 * alone (space, tab, line feed, carriage return, form feed) makes none (CSS Flexbox 1 §4). A
 * nonbreaking space is no document white space, so a run of them is an item. Absolute, fixed and
 * `display: none` children sit in no line. An in-flow `::before` or `::after` of the container or of
 * a child the walk looks through is an item the page cannot measure, so the walk finds no items
 * there. Runs in the page.
 *
 * @param element - The flex container.
 * @param readers - What the page hands in.
 * @returns The items in order, each run of text as its text nodes, or undefined where a `::before`
 *   or `::after` makes an item.
 */
export function flexItems(element: Element, readers: ItemReaders): readonly FlexItem[] | undefined {
  const { inFlow, pseudo } = readers;
  // The container's flow in order: its text nodes and the children that generate a box.
  const flow = (parent: Element): readonly (Element | Text)[] | undefined => {
    if (pseudo(parent)) {
      return undefined;
    }
    const nodes: (Element | Text)[] = [];
    for (const node of parent.childNodes) {
      if (node instanceof Text) {
        nodes.push(node);
        continue;
      }
      if (!(node instanceof Element)) {
        continue;
      }
      const display = getComputedStyle(node).display;
      if (display === "contents") {
        const inner = flow(node);
        if (inner === undefined) {
          return undefined;
        }
        nodes.push(...inner);
      } else if (display !== "none") {
        nodes.push(node);
      }
    }
    return nodes;
  };
  const nodes = flow(element);
  if (nodes === undefined) {
    return undefined;
  }
  const items: FlexItem[] = [];
  let run: Text[] = [];
  const close = (): void => {
    if (!/^[ \t\n\r\f]*$/.test(run.map((text) => text.data).join(""))) {
      items.push(run);
    }
    run = [];
  };
  for (const node of nodes) {
    if (node instanceof Text) {
      run.push(node);
      continue;
    }
    close();
    if (inFlow(node)) {
      items.push(node);
    }
  }
  close();
  return items;
}

/**
 * The border box of a flex item: an element's own, or for a run of text on one line, the box around
 * its glyphs, which spans the anonymous item's content box along a row. A run on several lines
 * leaves each line as long as its words, so the box around its glyphs can fall short of the item's
 * end, and the page reads no box for it. Runs in the page.
 *
 * @param item - The item.
 * @returns The box in viewport pixels, or undefined for a run of text on more than one line.
 */
export function itemBox(item: FlexItem): DOMRect | undefined {
  if (item instanceof Element) {
    return item.getBoundingClientRect();
  }
  const [first] = item;
  const last = item.at(-1);
  if (first === undefined || last === undefined) {
    return undefined;
  }
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.length);
  const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
  return tops.size > 1 ? undefined : range.getBoundingClientRect();
}

/**
 * Whether forcing a wrapping flex container's `flex-wrap` to `nowrap` leaves each of its in-flow
 * items where it was and as large, within Chromium's layout unit. A container whose items the page
 * cannot all measure, as {@link flexItems} and {@link itemBox} say, counts as moving. Runs in the
 * page.
 *
 * @param element - The flex container, whose `flex-wrap` computes to `wrap`.
 * @param helpers - What the page hands in.
 * @param unit - Chromium's layout unit in CSS pixels, below which two readings are one length.
 * @returns True where no item moves.
 */
export function nowrapMovesNothing(element: Element, helpers: PageHelpers, unit: number): boolean {
  const { withStyles, items, box } = helpers;
  const found = items(element);
  if (getComputedStyle(element).flexWrap !== "wrap" || found === undefined || found.length === 0) {
    return false;
  }
  const near = (left: number, right: number): boolean => Math.abs(left - right) < unit;
  const before = found.map(box);
  return withStyles([[element, "flex-wrap", "nowrap"]], () =>
    found.every((item, index) => {
      const was = before[index];
      const now = box(item);
      // A run of text with no box counts as moving.
      return (
        was !== undefined &&
        now !== undefined &&
        near(was.left, now.left) &&
        near(was.top, now.top) &&
        near(was.width, now.width) &&
        near(was.height, now.height)
      );
    })
  );
}

/**
 * Whether a node, or an element between it and a flex container, the container included, has a
 * `transform`, `translate`, `scale` or `rotate` other than `none`. The page reads each box where
 * Chromium paints it, after them, while they leave its layout box where it was (CSS Transforms 1 §3,
 * CSS Transforms 2 §5), so a reading through such a box is not its layout. Runs in the page.
 *
 * @param node - An item, or a text node of a run, or the container itself.
 * @param container - The flex container.
 * @returns True where any of them applies.
 */
export function transformedWithin(node: Node, container: Element): boolean {
  for (let at = node instanceof Element ? node : node.parentElement; at !== null; at = at.parentElement) {
    const { transform, translate, scale, rotate } = getComputedStyle(at);
    if ([transform, translate, scale, rotate].some((value) => value !== "none")) {
      return true;
    }
    if (at === container) {
      return false;
    }
  }
  return false;
}

/**
 * What one mode shows of a wrapping flex row's lines, as {@link flexLinesIn} reads them.
 *
 * - `one`: its items sit on one line.
 * - `fills`: two or more lines, which keep their breaks with the row a clearance wider and narrower,
 *   where no item sits narrower than its flex base size, and whose lines, each as tall as its tallest
 *   item with no item stretched, sum with the row gaps to the row's content height. It holds the
 *   row's content width and each item's box and own width, as {@link FlexLineLayout} keeps them.
 * - `shrinks`: two or more lines, and an item that line layout shrank: with shrinking turned off it
 *   is wider, or the items break elsewhere.
 * - `tight-break`: two or more lines, and a break that moves with the row a clearance wider or narrower.
 * - `spare-height`: two or more lines that, with no item stretched, leave some of the row's content
 *   height over.
 * - `unread`: the page cannot read the row's lines, or reads two or more and cannot read them as a
 *   Figma row draws them: an item is a run of text, a box with no height, or one whose box it cannot
 *   read, or has a margin, an `order` or a transform, or a box between holds a transform.
 */
export type FlexLinesReading =
  | "one"
  | Exclude<FlexLinesRefusal, "some-modes">
  | { readonly fills: Pick<FlexLineLayout, "width" | "items"> };

/** A row's reading in one mode, with the mode as the page stamps it and its `data-density`. */
export type ModeReading = {
  readonly mode: string;
  readonly density: string;
  readonly reading: FlexLinesReading | undefined;
};

/**
 * The fact a wrapping flex row's lines record across the modes, from its reading in each, as
 * {@link flexLinesIn} reads one. A row that sits on one line in every mode records none, and
 * `oneFlexLine` speaks for it. A row that breaks a line in some modes only, or that wraps in some
 * modes only, records `some-modes`. Otherwise one reading that refuses a WRAP row decides, the first
 * of `unread`, `shrinks`, `tight-break` and `spare-height`, and where every mode fills, the fact
 * keeps each distinct layout once, with the first mode that gave it and that mode's density, so the
 * build resolves each length the layout reads in it. Runs in the page.
 *
 * @param readings - The row's reading in each mode, undefined where it does not wrap there.
 * @returns The fact, or undefined for a row on one line in every mode.
 */
export function flexLinesAcross(readings: readonly ModeReading[]): FlexLinesFact | undefined {
  const broken = readings.filter(({ reading }) => reading !== undefined && reading !== "one");
  if (broken.length === 0) {
    return undefined;
  }
  if (broken.length < readings.length) {
    return "some-modes";
  }
  for (const refusal of ["unread", "shrinks", "tight-break", "spare-height"] as const) {
    if (broken.some(({ reading }) => reading === refusal)) {
      return refusal;
    }
  }
  const layouts = new Map<string, FlexLineLayout>();
  for (const { mode, density, reading } of broken) {
    // Every broken reading fills here, since a refusal returned above.
    if (
      reading === undefined ||
      reading === "one" ||
      reading === "unread" ||
      reading === "shrinks" ||
      reading === "tight-break" ||
      reading === "spare-height"
    ) {
      continue;
    }
    const key = JSON.stringify([density, reading.fills]);
    if (!layouts.has(key)) {
      layouts.set(key, { mode, density, ...reading.fills });
    }
  }
  const [first, ...rest] = layouts.values();
  return first === undefined ? "unread" : { fills: [first, ...rest] };
}

/**
 * Read a wrapping flex row's lines in the page's mode. The items must be elements with a height, no
 * margin, no `order` and no transform on them, the row or a `display: contents` box between, so their
 * border boxes are the outer boxes CSS collects into lines, in document order (CSS Flexbox 1 §9.3).
 * An item opens a line where its top sits at or below the bottom of every item of the line before,
 * since CSS stacks the lines across the row and places each item within its own (§9.4), whatever
 * `align-items` does inside a line and however few items a line holds.
 *
 * With its lines found, the page measures three things, each with the styles it writes undone after:
 * - the row a clearance wider and narrower breaks its lines at the same items;
 * - with `flex-shrink: 0` on every item, each item keeps its width and its line, so line layout shrank
 *   none of them below its flex base size (§9.7), which a Figma layer, drawn at that size, never does;
 * - with `align-content: flex-start` on the row and `align-self: flex-start` on every item, no item
 *   stretches and the lines pack at the top, so the lines fill the row's content height where the
 *   first starts at its top and the last ends at its bottom. Without such a fill `align-content`
 *   stretches the lines into the spare height (§9.4), which a Figma WRAP row never does (WR4).
 * Lines that fill the row record each item's border box relative to the row's content box, and its
 * own width with `flex: 0 0 auto`, the width a layer that hugs it draws.
 *
 * A row whose items the page cannot read so reads every item's margin box: each element's, and the
 * box around a run of text's glyphs where the run sets one line. The run of text lays out in one
 * anonymous item, whose line holds the box around its glyphs. Margin boxes on one line share a band
 * across the row, and lines stack apart (§9.4), so items in two or more bands break a line. The row
 * records `unread` there, and also where an item has no box the page can read, a run of text on
 * several lines, or one under a transform, since nothing then tells whether the row breaks a line.
 * Runs in the page.
 *
 * @param element - The flex container.
 * @param helpers - What the page hands in.
 * @param unit - Chromium's layout unit in CSS pixels, below which two readings are one length.
 * @param clearance - How much wider and narrower the row may be and break its lines at the same items.
 * @returns The reading, or undefined for a box that is no flex row whose `flex-wrap` is `wrap`.
 */
export function flexLinesIn(
  element: Element,
  helpers: PageHelpers,
  unit: number,
  clearance: number
): FlexLinesReading | undefined {
  const { withStyles, autoMargins, items, box, transformed } = helpers;
  const style = getComputedStyle(element);
  if (!style.display.endsWith("flex") || style.flexDirection !== "row" || style.flexWrap !== "wrap") {
    return undefined;
  }
  const near = (left: number, right: number): boolean => Math.abs(left - right) < unit;
  const px = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0;
  const found = items(element);
  const elements = (found ?? []).filter((item): item is Element => item instanceof Element);
  const MARGINS = ["margin-top", "margin-right", "margin-bottom", "margin-left"];
  const readable =
    found !== undefined &&
    elements.length === found.length &&
    autoMargins(element).length === 0 &&
    !transformed(element, element) &&
    elements.every((item) => {
      const own = getComputedStyle(item);
      return (
        !transformed(item, element) &&
        own.order === "0" &&
        item.getBoundingClientRect().height >= unit &&
        MARGINS.every((name) => Number.parseFloat(own.getPropertyValue(name)) === 0)
      );
    });
  if (!readable) {
    if (found === undefined || transformed(element, element)) {
      return "unread";
    }
    // Each item's margin box across the row, undefined where the page reads none.
    const spans = found.map((item) => {
      const edges = (item instanceof Element ? [item] : item).some((node) => transformed(node, element))
        ? undefined
        : box(item);
      if (edges === undefined) {
        return undefined;
      }
      const own = item instanceof Element ? getComputedStyle(item) : undefined;
      const margin = (name: string): number =>
        own === undefined ? 0 : Number.parseFloat(own.getPropertyValue(name)) || 0;
      return { top: edges.top - margin("margin-top"), bottom: edges.bottom + margin("margin-bottom") };
    });
    if (spans.some((span) => span === undefined)) {
      return "unread";
    }
    let bands = 0;
    let bottom = -Infinity;
    for (const span of spans
      .flatMap((each) => (each === undefined ? [] : [each]))
      .toSorted((left, right) => left.top - right.top)) {
      if (span.top > bottom - unit / 2) {
        bands += 1;
      }
      bottom = Math.max(bottom, span.bottom);
    }
    return bands > 1 ? "unread" : "one";
  }
  // Each item's line, counted from 0, from where the items sit across the row.
  const lines = (): readonly number[] => {
    let line = -1;
    let bottom = -Infinity;
    return elements.map((item) => {
      const edges = item.getBoundingClientRect();
      if (edges.top > bottom - unit / 2) {
        line += 1;
        bottom = edges.bottom;
      } else {
        bottom = Math.max(bottom, edges.bottom);
      }
      return line;
    });
  };
  const placed = lines();
  if ((placed.at(-1) ?? 0) < 1) {
    return "one";
  }
  const at = placed.join();
  const widths = elements.map((item) => item.getBoundingClientRect().width);
  const unshrunk = withStyles(
    elements.map((item) => [item, "flex-shrink", "0"] as const),
    () =>
      lines().join() === at &&
      elements.every((item, index) => near(item.getBoundingClientRect().width, widths[index] ?? NaN))
  );
  if (!unshrunk) {
    return "shrinks";
  }
  const width = element.getBoundingClientRect().width;
  const keeps = (delta: number): boolean => {
    const length = String(width + delta) + "px";
    return withStyles(
      [
        [element, "box-sizing", "border-box"],
        [element, "width", length],
        [element, "min-width", length],
        [element, "max-width", length],
      ],
      () => near(element.getBoundingClientRect().width, width + delta) && lines().join() === at
    );
  };
  if (!keeps(clearance) || !keeps(-clearance)) {
    return "tight-break";
  }
  const fills = withStyles(
    [
      [element, "align-content", "flex-start"],
      ...elements.map((item) => [item, "align-self", "flex-start"] as const),
    ],
    () => {
      const own = element.getBoundingClientRect();
      const edges = elements.map((item) => item.getBoundingClientRect());
      const top = Math.min(...edges.map(({ top }) => top));
      const bottom = Math.max(...edges.map(({ bottom }) => bottom));
      return (
        lines().join() === at &&
        near(top, own.top + px("border-top-width") + px("padding-top")) &&
        near(bottom, own.bottom - px("border-bottom-width") - px("padding-bottom"))
      );
    }
  );
  if (!fills) {
    return "spare-height";
  }
  const row = element.getBoundingClientRect();
  const left = row.left + px("border-left-width") + px("padding-left");
  const top = row.top + px("border-top-width") + px("padding-top");
  const owns = withStyles(
    elements.flatMap((item) => [
      [item, "flex-grow", "0"] as const,
      [item, "flex-shrink", "0"] as const,
      [item, "flex-basis", "auto"] as const,
    ]),
    () => elements.map((item) => item.getBoundingClientRect().width)
  );
  return {
    fills: {
      width:
        row.width -
        px("border-left-width") -
        px("padding-left") -
        px("border-right-width") -
        px("padding-right"),
      items: elements.map((item, index) => {
        const edges = item.getBoundingClientRect();
        return {
          x: edges.left - left,
          y: edges.top - top,
          width: edges.width,
          height: edges.height,
          own: owns[index] ?? Number.NaN,
        };
      }),
    },
  };
}

/**
 * Read the room a flex line leaves along its direction once the auto margins along it give their
 * room back. Auto margins take the room of each line on its own (CSS Flexbox 1 §9.5), so the page
 * measures a single line: a container that wraps measures with `flex-wrap` forced to `nowrap`. Room
 * of zero or more there means no item shrank, so their outer sizes fit one line and CSS collects
 * them all into it (CSS Flexbox 1 §9.3 step 1): the container lays its line out as with `nowrap`, and
 * the room is that line's. Room below zero says nothing of the wrapping line. A box that is no flex
 * container, or that wraps in reverse, has no such room. The line packs its items at its start while it measures, since the
 * auto margins take the free space before `justify-content` could move them (CSS Flexbox 1 §8.1).
 * A column that holds a run of text has no room the page can read: the box around a run's glyphs
 * leaves out the leading its line height adds above and below them (CSS 2.1 §10.8.1), so it ends
 * short of the anonymous item's bottom. The page reads each box where Chromium paints it, after
 * its `transform`, `translate`, `scale` and `rotate`, which leave its layout box where it was (CSS
 * Transforms 1 §3, CSS Transforms 2 §5), so it reads no room where any of them other than `none`
 * applies to the container, an item, or a `display: contents` box the walk found the item through.
 * Runs in the page.
 *
 * @param element - The flex container.
 * @param helpers - What the page hands in.
 * @returns The room in CSS pixels, or undefined for a line in neither direction, a column that holds
 *   text, a box that is no single-line flex container, a run of text the page reads no box for, or a
 *   transformed box.
 */
export function roomAlong(element: Element, helpers: PageHelpers): number | undefined {
  const { withStyles, autoMargins, items, box, transformed } = helpers;
  const style = getComputedStyle(element);
  const found = items(element);
  if (
    !style.display.endsWith("flex") ||
    !["nowrap", "wrap"].includes(style.flexWrap) ||
    found === undefined
  ) {
    return undefined;
  }
  const row = style.flexDirection === "row";
  if (!row && (style.flexDirection !== "column" || found.some((item) => !(item instanceof Element)))) {
    return undefined;
  }
  // Each item's box and the boxes between it and the container, the container's included.
  if (
    transformed(element, element) ||
    found.some((item) => (item instanceof Element ? [item] : item).some((node) => transformed(node, element)))
  ) {
    return undefined;
  }
  const writes: (readonly [Element, string, string])[] = [
    [element, "justify-content", "flex-start"],
    [element, "flex-wrap", "nowrap"],
    ...autoMargins(element).map(({ child, side }) => [child, "margin-" + side, "0px"] as const),
  ];
  return withStyles(writes, () => {
    const own = element.getBoundingClientRect();
    const px = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const end = row
      ? own.right - px("border-right-width") - px("padding-right")
      : own.bottom - px("border-bottom-width") - px("padding-bottom");
    const ends: number[] = [];
    for (const item of found) {
      const edges = box(item);
      // A run of text with no box leaves no room the page can read.
      if (edges === undefined) {
        return undefined;
      }
      const after =
        item instanceof Element
          ? Number.parseFloat(
              getComputedStyle(item).getPropertyValue(row ? "margin-right" : "margin-bottom")
            ) || 0
          : 0;
      ends.push((row ? edges.right : edges.bottom) + after);
    }
    return end - Math.max(...ends);
  });
}
