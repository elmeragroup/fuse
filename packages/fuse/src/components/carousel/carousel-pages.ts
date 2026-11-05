/**
 * The carousel's page math: which scroll positions a native scroll-snap viewport stops at, which
 * of them is nearest a position, and which slides a position shows. Pure and React-free, so the
 * engine measures the DOM once and these functions answer from the numbers.
 *
 * Every length is logical px on the scroll axis, measured from the scroll origin: `0` is the
 * inline start in either direction, and the top for a vertical carousel. The engine turns the
 * physical `scrollLeft`, negative in a right-to-left viewport, into that position.
 */

/** A slide's computed `scroll-snap-align` on the scroll axis. */
export type SnapAlign = "start" | "center" | "end" | "none";

/** The axis a carousel scrolls on, in a horizontal writing mode. */
export type SnapAxis = "inline" | "block";

/** One slide's box on the scroll axis. */
export type SlideGeometry = {
  /** Where the slide's border box starts, from the scroll origin. */
  readonly start: number;
  /** The border box's length on the axis. */
  readonly size: number;
  /** The slide's `scroll-margin` at its start, which grows its snap area. */
  readonly marginStart: number;
  /** The slide's `scroll-margin` at its end. */
  readonly marginEnd: number;
  /** How its snap area aligns in the snapport. */
  readonly align: SnapAlign;
};

/** The viewport's geometry on the scroll axis. */
export type ScrollPort = {
  /** The visible length, `clientWidth` or `clientHeight`. */
  readonly size: number;
  /** The scrollable length, `scrollWidth` or `scrollHeight`. */
  readonly scrollSize: number;
  /** The viewport's `scroll-padding` at the start, which insets the snapport. */
  readonly paddingStart: number;
  /** The viewport's `scroll-padding` at the end. */
  readonly paddingEnd: number;
};

/** The pages a layout scrolls through: one per distinct snap position. */
export type Pages = {
  /** Each page's scroll position, ascending. */
  readonly positions: readonly number[];
  /** For each page, the first slide, in document order, that snaps to it. */
  readonly leadingSlides: readonly number[];
};

/** Two snap positions closer than this are one page: layout rounds lengths to a fraction of a px. */
const SAME_POSITION = 1;

/** A slide shows when more than this much of it is inside the viewport. */
const VISIBLE_OVERLAP = 1;

const ALIGNS: ReadonlySet<string> = new Set<SnapAlign>(["start", "center", "end", "none"]);

function isSnapAlign(value: string): value is SnapAlign {
  return ALIGNS.has(value);
}

/**
 * Read a computed `scroll-snap-align` for one axis. The property takes one value for both axes or
 * two, block first and inline second.
 *
 * @param computed - The computed value, such as `"start"` or `"none center"`.
 * @param axis - The axis the carousel scrolls on.
 * @returns The alignment on that axis, `none` for a value the property does not define.
 */
export function parseSnapAlign(computed: string, axis: SnapAxis): SnapAlign {
  const [first = "none", second] = computed.trim().split(/\s+/u);
  const value = second === undefined || axis === "block" ? first : second;
  return isSnapAlign(value) ? value : "none";
}

/**
 * The scroll position at which a slide's snap area aligns in the snapport, the viewport inset by
 * its scroll padding, before clamping to the scroll range.
 */
function snapPosition(port: ScrollPort, slide: SlideGeometry, align: Exclude<SnapAlign, "none">): number {
  const areaStart = slide.start - slide.marginStart;
  const areaSize = slide.size + slide.marginStart + slide.marginEnd;
  const snapportSize = port.size - port.paddingStart - port.paddingEnd;
  switch (align) {
    case "start":
      return areaStart - port.paddingStart;
    case "end":
      return areaStart + areaSize - (port.paddingStart + snapportSize);
    case "center":
      return areaStart + areaSize / 2 - (port.paddingStart + snapportSize / 2);
  }
}

/**
 * The pages a scroll-snap layout stops at. Each slide that snaps adds its snap position, clamped
 * to the scroll range, and positions within a pixel of each other are one page. So six slides a
 * third of the viewport wide make four pages, as the browser stops at four positions, and slides
 * whose `scroll-snap-align` is `none` add none, so a layout that snaps every third slide pages by
 * three.
 *
 * @param port - The viewport's geometry.
 * @param slides - Every slide, in document order.
 * @returns The pages, ascending. No slides make no pages; slides that never snap make one page at
 *   the start.
 */
export function pagesOf(port: ScrollPort, slides: readonly SlideGeometry[]): Pages {
  if (slides.length === 0) {
    return { positions: [], leadingSlides: [] };
  }
  const max = Math.max(0, port.scrollSize - port.size);
  const snaps = slides
    .flatMap((slide, index) =>
      slide.align === "none"
        ? []
        : [{ position: Math.min(max, Math.max(0, snapPosition(port, slide, slide.align))), index }]
    )
    .toSorted((left, right) => left.position - right.position || left.index - right.index);
  if (snaps.length === 0) {
    return { positions: [0], leadingSlides: [0] };
  }
  const positions: number[] = [];
  const leadingSlides: number[] = [];
  for (const snap of snaps) {
    const last = positions.at(-1);
    if (last !== undefined && snap.position - last < SAME_POSITION) {
      const lastIndex = leadingSlides.length - 1;
      leadingSlides[lastIndex] = Math.min(leadingSlides[lastIndex] ?? snap.index, snap.index);
      continue;
    }
    positions.push(snap.position);
    leadingSlides.push(snap.index);
  }
  return { positions, leadingSlides };
}

/**
 * The page whose position is nearest a scroll position. A position halfway between two pages
 * belongs to the earlier one.
 *
 * @param positions - The pages' positions, ascending.
 * @param position - The scroll position.
 * @returns The page's index, `0` when there are no pages.
 */
export function nearestPage(positions: readonly number[], position: number): number {
  let nearest = 0;
  for (const [index, candidate] of positions.entries()) {
    const best = positions[nearest] ?? candidate;
    if (Math.abs(candidate - position) < Math.abs(best - position)) {
      nearest = index;
    }
  }
  return nearest;
}

/**
 * The slides a scroll position shows: those with more than a pixel of their border box inside the
 * viewport, so a slide that only touches its edge does not count and a peeking one does.
 *
 * @param port - The viewport's geometry.
 * @param slides - Every slide, in document order.
 * @param position - The scroll position.
 * @returns The indexes of the slides in view.
 */
export function visibleSlides(
  port: ScrollPort,
  slides: readonly SlideGeometry[],
  position: number
): ReadonlySet<number> {
  const end = position + port.size;
  const visible = new Set<number>();
  for (const [index, slide] of slides.entries()) {
    const overlap = Math.min(end, slide.start + slide.size) - Math.max(position, slide.start);
    if (overlap > VISIBLE_OVERLAP) {
      visible.add(index);
    }
  }
  return visible;
}
