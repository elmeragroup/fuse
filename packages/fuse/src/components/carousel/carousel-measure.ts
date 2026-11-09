/**
 * The carousel engine's measurement: one read of a scroll-snap viewport and its slides, converted
 * to the viewport's scroll coordinates. It reads the DOM, keeps nothing and reports only what it
 * found; what to do with a reading, cache it, retry it or accept it, is the engine's
 * (`carousel-engine.ts`).
 *
 * Every length is in the viewport's scroll coordinates, the space of `scrollLeft`, `clientWidth`
 * and `scrollWidth`. A transform on an ancestor, such as `scale(0.5)`, scales the boxes
 * `getBoundingClientRect` reports but not the scroll range, so a measurement divides each box by
 * the viewport's painted size over its layout size, per axis. That keeps sub-pixel slide widths,
 * which the integer `offsetLeft` and `offsetWidth` would round. A rotated or skewed ancestor is not
 * supported: a box's bounds are then not a scaled copy of its layout.
 *
 * While a transform animates, a box is painted where the animation is when it is read, and WebKit
 * samples a running animation afresh at each layout read in a task, so a slow read can find the
 * viewport at one scale and the slides at another. A measurement therefore reads every style first
 * and then every box back to back, between two reads of the viewport's box. When the viewport's
 * box moved between them by enough to put a position off by `STEADY`, the reading is unsteady
 * (`steady`). The painted boxes stay the one geometry throughout: they keep sub-pixel starts, and
 * they include every border and transform between the viewport and a slide, and a transform on a
 * slide itself, such as a hover scale, as the browser's snap areas do.
 */
import { documentOrder } from "../../internal/dom-node";
import { parseSnapAlign } from "./carousel-pages";
import type { ScrollPort, SlideGeometry, SnapAxis } from "./carousel-pages";

/** The axis a carousel scrolls on. */
export type CarouselOrientation = "horizontal" | "vertical";

/** A box's layout size, in the viewport's scroll coordinates. */
export type Size = { readonly width: number; readonly height: number };

/** A box as `getClientRects` paints it, in viewport px. */
type PaintedBox = Pick<DOMRectReadOnly, "top" | "right" | "bottom" | "left" | "width" | "height">;

/** Painted over layout size, per axis: 1 without a transform, 0.5 under `scale(0.5)`. */
type Scale = { readonly x: number; readonly y: number };

/** A usable reading of the viewport and its slides, in scroll coordinates. */
export type CarouselReading = {
  /** The connected members with a layout box, in document order. */
  readonly slides: readonly HTMLElement[];
  /** Each slide's place in `slides`; also how a mutation finds the slide it lies in. */
  readonly numbers: ReadonlyMap<HTMLElement, number>;
  /** Each of `slides`' snap geometry, in the same order. */
  readonly geometry: readonly SlideGeometry[];
  readonly port: ScrollPort;
  /** Whether a horizontal viewport's computed `direction` is right-to-left. */
  readonly rtl: boolean;
  /** The layout size of the viewport and of each of `slides`, as a resize report gives it. */
  readonly sizes: ReadonlyMap<Element, Size>;
};

/**
 * What one measurement found. `no-box`: the viewport has no layout box, as under `display: none`.
 * `non-finite`: the painted boxes convert to no finite scroll geometry, as when the viewport is
 * scaled to nothing, under `scale(0)`, where no box says where anything is. `geometry`: a reading,
 * `steady` when the viewport's box held still while the slides were read, so the reading is one
 * picture of them.
 */
export type CarouselMeasurement =
  | { readonly kind: "no-box" }
  | { readonly kind: "non-finite" }
  | ({ readonly kind: "geometry"; readonly steady: boolean } & CarouselReading);

/**
 * The boxes a measurement read are one picture when an animating transform can have moved them by
 * less than this, in scroll px, while it read them.
 */
const STEADY = 0.5;

/** A computed length in px, resolving a percentage against `basis` and `auto` to `0`. */
function lengthOf(value: string, basis: number): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return value.trim().endsWith("%") ? (parsed / 100) * basis : parsed;
}

/** The physical sides of the scroll axis's start and end, for reading computed styles. */
type AxisSides = { readonly start: "left" | "right" | "top"; readonly end: "left" | "right" | "bottom" };

function sidesOf(orientation: CarouselOrientation, rtl: boolean): AxisSides {
  if (orientation === "vertical") {
    return { start: "top", end: "bottom" };
  }
  return rtl ? { start: "right", end: "left" } : { start: "left", end: "right" };
}

function sideValue(
  style: CSSStyleDeclaration,
  property: "scroll-padding" | "scroll-margin",
  side: string
): string {
  return style.getPropertyValue(`${property}-${side}`);
}

/**
 * An element's border-box size as layout gives it, before any transform, from its computed
 * style, which keeps fractions.
 */
function layoutSizeOf(style: CSSStyleDeclaration): Size {
  const width = Number.parseFloat(style.width) || 0;
  const height = Number.parseFloat(style.height) || 0;
  if (style.boxSizing === "border-box") {
    return { width, height };
  }
  const sum = (...values: string[]) =>
    values.reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
  return {
    width: width + sum(style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth),
    height:
      height + sum(style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth),
  };
}

/** The scroll position on the axis in a direction, positive from the start in either. */
export function scrollPositionOf(
  viewport: HTMLElement,
  orientation: CarouselOrientation,
  rtl: boolean
): number {
  if (orientation === "vertical") {
    return viewport.scrollTop;
  }
  // Every engine reports a right-to-left `scrollLeft` as 0 at the start, negative toward the end.
  return rtl ? -viewport.scrollLeft : viewport.scrollLeft;
}

/**
 * The viewport's painted over layout size, per axis, or `null` when it is scaled to nothing, as
 * under `scale(0)`, where no box says where anything is. An axis with no layout size reads as 1.
 */
function scaleOf(painted: PaintedBox, layoutSize: Size): Scale | null {
  const x = layoutSize.width > 0 ? painted.width / layoutSize.width : 1;
  const y = layoutSize.height > 0 ? painted.height / layoutSize.height : 1;
  return Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 ? { x, y } : null;
}

/**
 * Whether the viewport's box held still enough between its reads before and after the slides'
 * that a move of that size would put no position off by `STEADY`. A shift moves every box
 * alike; a change of scale moves each box by its distance from the scroll origin times the
 * change, and no slide starts past the scroll range's length. Both are painted px, so they are
 * divided by the scale. It judges the endpoints only: two reads that agree cannot prove that each
 * slide read between them saw the same sample, as when a sample returns to an earlier one.
 *
 * @param scale - The painted over layout size along the axis, from `before`.
 * @param layoutLength - The viewport's layout length along the axis.
 * @param scrollSize - The scroll range's length.
 */
function steady(
  orientation: CarouselOrientation,
  before: PaintedBox,
  after: PaintedBox,
  scale: number,
  layoutLength: number,
  scrollSize: number
): boolean {
  const [start, end, length] =
    orientation === "vertical"
      ? [after.top - before.top, after.bottom - before.bottom, after.height - before.height]
      : [after.left - before.left, after.right - before.right, after.width - before.width];
  const shift = Math.max(Math.abs(start), Math.abs(end));
  const growth = layoutLength > 0 ? Math.abs(length) / layoutLength : 0;
  return (shift + growth * scrollSize) / scale < STEADY;
}

/** Where the viewport's scroll origin is painted, and what converts painted px to scroll px. */
type PaintFrame = {
  readonly orientation: CarouselOrientation;
  readonly rtl: boolean;
  readonly scale: Scale;
  /** The painted padding box's top, left and right edges. */
  readonly top: number;
  readonly left: number;
  readonly right: number;
  /** The scroll position the boxes were painted at, positive from the start. */
  readonly scrolled: number;
};

/** The viewport's layout metrics a frame is built from: `clientTop`, `clientLeft`, `clientWidth`. */
type ViewportClient = {
  readonly clientTop: number;
  readonly clientLeft: number;
  readonly clientWidth: number;
};

/**
 * The frame of a viewport painted as `box` at `scale`: its padding box's start edge on screen,
 * from which the scroll origin is `scrolled` px back.
 */
function frameOf(
  orientation: CarouselOrientation,
  rtl: boolean,
  box: PaintedBox,
  scale: Scale,
  client: ViewportClient,
  scrolled: number
): PaintFrame {
  const top = box.top + client.clientTop * scale.y;
  const left = box.left + client.clientLeft * scale.x;
  return {
    orientation,
    rtl,
    scale,
    top,
    left,
    right: left + client.clientWidth * scale.x,
    scrolled,
  };
}

/** A painted box in scroll coordinates: where it starts along the axis, and its layout size. */
type PlacedBox = { readonly start: number; readonly size: Size };

/**
 * A painted box in a frame's scroll coordinates: where it starts along the axis, from the scroll
 * origin's start side, and its layout size.
 */
function placeBox(frame: PaintFrame, box: PaintedBox): PlacedBox {
  const { scale } = frame;
  let offset: number;
  if (frame.orientation === "vertical") {
    offset = (box.top - frame.top) / scale.y;
  } else if (frame.rtl) {
    offset = (frame.right - box.right) / scale.x;
  } else {
    offset = (box.left - frame.left) / scale.x;
  }
  return {
    start: offset + frame.scrolled,
    size: { width: box.width / scale.x, height: box.height / scale.y },
  };
}

/**
 * Read the layout, once: the viewport's style and each slide's, then the viewport's box and each
 * slide's, between two reads of the viewport's box. A slide without a layout box, such as one a
 * host rule hides, takes no place in the reading: the user cannot reach it.
 *
 * @param viewport - The scroll-snap container.
 * @param orientation - The axis it scrolls on.
 * @param members - The mounted slides; the connected ones are read, in document order.
 * @returns What the measurement found.
 */
export function measureCarousel(
  viewport: HTMLElement,
  orientation: CarouselOrientation,
  members: ReadonlySet<HTMLElement>
): CarouselMeasurement {
  const vertical = orientation === "vertical";
  const axis: SnapAxis = vertical ? "block" : "inline";
  const style = getComputedStyle(viewport);
  const rtl = !vertical && style.direction === "rtl";
  const sides = sidesOf(orientation, rtl);
  const viewportSize = layoutSizeOf(style);
  const size = vertical ? viewport.clientHeight : viewport.clientWidth;
  const port: ScrollPort = {
    size,
    scrollSize: vertical ? viewport.scrollHeight : viewport.scrollWidth,
    paddingStart: lengthOf(sideValue(style, "scroll-padding", sides.start), size),
    paddingEnd: lengthOf(sideValue(style, "scroll-padding", sides.end), size),
  };
  // In the direction just read: a switch of direction mirrors the scroll position the previous
  // layout's direction would read.
  const scrolled = scrollPositionOf(viewport, orientation, rtl);
  // Every slide's snap style, before any box: the boxes are then read back to back.
  const candidates = [...members]
    .filter((member) => member.isConnected)
    .toSorted(documentOrder)
    .map((slide) => {
      const slideStyle = getComputedStyle(slide);
      return {
        slide,
        marginStart: lengthOf(sideValue(slideStyle, "scroll-margin", sides.start), 0),
        marginEnd: lengthOf(sideValue(slideStyle, "scroll-margin", sides.end), 0),
        align: parseSnapAlign(slideStyle.getPropertyValue("scroll-snap-align"), axis),
      };
    });
  // One read per box, between two of the viewport's: `getClientRects` is empty for an element
  // with no layout box, as under `display: none`, and holds the one border box of a block or flex
  // item otherwise.
  const [rect] = viewport.getClientRects();
  const read = candidates.map((candidate) => candidate.slide.getClientRects()[0]);
  const [after] = viewport.getClientRects();
  if (rect === undefined || after === undefined) {
    return { kind: "no-box" };
  }
  const scale = scaleOf(rect, viewportSize);
  if (scale === null) {
    return { kind: "non-finite" };
  }
  const frame = frameOf(orientation, rtl, rect, scale, viewport, scrolled);
  const shown = candidates.flatMap((candidate, index) => {
    const box = read[index];
    return box === undefined ? [] : [{ ...candidate, box }];
  });
  const slides = shown.map((candidate) => candidate.slide);
  const sizes = new Map<Element, Size>([[viewport, viewportSize]]);
  const geometry = shown.map(({ slide, box, marginStart, marginEnd, align }) => {
    const placed = placeBox(frame, box);
    sizes.set(slide, placed.size);
    return {
      start: placed.start,
      size: vertical ? placed.size.height : placed.size.width,
      marginStart,
      marginEnd,
      align,
    } satisfies SlideGeometry;
  });
  const finite = geometry.every(
    (slide) => Number.isFinite(slide.start) && Number.isFinite(slide.size) && slide.size >= 0
  );
  if (!finite) {
    return { kind: "non-finite" };
  }
  const isSteady = vertical
    ? steady(orientation, rect, after, scale.y, viewportSize.height, port.scrollSize)
    : steady(orientation, rect, after, scale.x, viewportSize.width, port.scrollSize);
  const numbers = new Map(slides.map((slide, index) => [slide, index]));
  return { kind: "geometry", steady: isSteady, slides, numbers, geometry, port, rtl, sizes };
}
