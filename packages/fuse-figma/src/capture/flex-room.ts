/**
 * The room a flex line leaves along its direction past its items and the gaps between them, as the
 * capture's page function measures it for the facts `freeAlongMain` and `fitsAlongMain`, which say
 * whether the auto margins along the line take room and whether its items fit it, and for
 * `oneFlexLine`, which says a wrapping flex container lays its items out on one line. The page calls
 * `roomAlong` on each flex container whose items hold auto margins along its direction, and on each
 * that wraps, in every mode it stamps, and compares the least reading with each fact's clearance. A
 * mode with no reading records none of the facts.
 * The functions are passed to the page as their source, so each reads nothing outside its own body
 * and the helpers it is handed.
 */

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
  const { withStyles, autoMargins, items, box } = helpers;
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
  const transformed = (node: Node): boolean => {
    for (let at = node instanceof Element ? node : node.parentElement; at !== null; at = at.parentElement) {
      const { transform, translate, scale, rotate } = getComputedStyle(at);
      if ([transform, translate, scale, rotate].some((value) => value !== "none")) {
        return true;
      }
      if (at === element) {
        return false;
      }
    }
    return false;
  };
  if (
    transformed(element) ||
    found.some((item) => (item instanceof Element ? [item] : item).some(transformed))
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
