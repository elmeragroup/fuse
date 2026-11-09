/**
 * Unit under test: `measureCarousel`, the facts it reports from one read of a viewport and its
 * slides: whether the viewport has a box and a finite scale, each slide's start and size in scroll
 * coordinates, converted by the viewport's scale per axis from its padding box's start edge in
 * either direction or orientation, and whether the viewport's box held still around the slides'.
 * Oracle: hand-painted boxes on fake elements whose scroll-coordinate starts and sizes, and whose
 * movement in scroll px, are worked out here from the scale and the viewport's borders, never from
 * the measurement under test.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { measureCarousel } from "./carousel-measure";
import type { CarouselOrientation } from "./carousel-measure";

/** A box as `getClientRects` paints it, in viewport px. */
type PaintedBox = Pick<DOMRectReadOnly, "top" | "right" | "bottom" | "left" | "width" | "height">;

function box(left: number, top: number, width: number, height: number): PaintedBox {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

/** A computed style with the given properties, every other one empty. */
function computed(
  properties: Partial<Record<string, string>>,
  style: Partial<Pick<CSSStyleDeclaration, "direction" | "width" | "height" | "boxSizing">>
) {
  const declared: Partial<CSSStyleDeclaration> = {
    ...style,
    getPropertyValue: (name: string) => properties[name] ?? "",
  };
  // SAFETY: the measurement reads only the properties set here and `getPropertyValue`.
  return declared as CSSStyleDeclaration;
}

/** The part of an element the measurement reads: its boxes, and where it is in the document. */
type Fake = {
  readonly isConnected: boolean;
  readonly getClientRects: () => ArrayLike<PaintedBox>;
  readonly compareDocumentPosition: (other: Node) => number;
};

/** A viewport and its slides as `measured` fakes them. */
type Setup = {
  readonly orientation?: CarouselOrientation;
  readonly direction?: "ltr" | "rtl";
  /** The viewport's border-box size in layout, before any transform. */
  readonly layout?: { readonly width: number; readonly height: number };
  /** The viewport's border width on every side. */
  readonly border?: number;
  /** `scrollLeft`, negative toward the end in right-to-left as every engine reports it. */
  readonly scrollLeft?: number;
  readonly scrollTop?: number;
  readonly scrollWidth?: number;
  readonly scrollHeight?: number;
  /** The viewport's box at each read in turn, the last one again once they run out. */
  readonly boxes: PaintedBox[];
  /** Each slide's box, in document order, or `undefined` for one with no box. */
  readonly slides: readonly (PaintedBox | undefined)[];
};

/**
 * Measure a fake border-box viewport, 400×200 without borders, scrolled 30px and 1200×800 to
 * scroll unless `setup` says otherwise, whose slides snap to their start.
 */
function measured(setup: Setup) {
  const {
    orientation = "horizontal",
    direction = "ltr",
    layout = { width: 400, height: 200 },
    border = 0,
    scrollLeft = 30,
    scrollTop = 30,
    scrollWidth = 1200,
    scrollHeight = 800,
    boxes,
  } = setup;
  const styles = new Map<unknown, CSSStyleDeclaration>();
  const order = new Map<unknown, number>();
  const viewport = {
    clientTop: border,
    clientLeft: border,
    clientWidth: layout.width - 2 * border,
    clientHeight: layout.height - 2 * border,
    scrollWidth,
    scrollHeight,
    scrollLeft,
    scrollTop,
    getClientRects: (): ArrayLike<PaintedBox> => {
      const next = boxes.length > 1 ? boxes.shift() : boxes[0];
      return next === undefined ? [] : [next];
    },
  };
  styles.set(
    viewport,
    computed(
      {},
      { direction, width: `${layout.width}px`, height: `${layout.height}px`, boxSizing: "border-box" }
    )
  );
  const slides: Fake[] = [];
  for (const painted of setup.slides) {
    const slide: Fake = {
      isConnected: true,
      getClientRects: () => (painted === undefined ? [] : [painted]),
      // `DOCUMENT_POSITION_FOLLOWING` for a slide made after this one, `PRECEDING` otherwise.
      compareDocumentPosition: (other) => ((order.get(other) ?? 0) > (order.get(slide) ?? 0) ? 4 : 2),
    };
    order.set(slide, slides.length);
    slides.push(slide);
    styles.set(slide, computed({ "scroll-snap-align": "start" }, {}));
  }
  vi.stubGlobal("Node", { DOCUMENT_POSITION_FOLLOWING: 4 });
  vi.stubGlobal("getComputedStyle", (element: Element) => styles.get(element));
  // SAFETY: the measurement reads only a slide's connection, boxes and document order.
  const elements = slides.map((slide) => slide as HTMLElement);
  const result = measureCarousel(
    // SAFETY: the measurement reads only the viewport metrics and boxes set here.
    viewport as HTMLElement,
    orientation,
    new Set(elements)
  );
  return {
    result,
    /** The layout size the measurement gives each slide, or the measurement's kind. */
    slideSizes: () =>
      result.kind === "geometry" ? elements.map((element) => result.sizes.get(element)) : result.kind,
  };
}

/** Each slide's start in scroll px, or what the measurement found instead of geometry. */
function starts({ result }: ReturnType<typeof measured>) {
  return result.kind === "geometry" ? result.geometry.map((slide) => slide.start) : result.kind;
}

/** Whether the reading is steady, or what the measurement found instead of geometry. */
function steadiness({ result }: ReturnType<typeof measured>) {
  return result.kind === "geometry" ? result.steady : result.kind;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// A 400×200 border box with 2px borders, painted at half size from (100, 50): its padding box is
// 396px wide and 196px tall in layout, and starts 1 painted px in from each painted edge, at
// (101, 51), and ends at 101 + 396 × 0.5 = 299 on the right.
const bordered = { border: 2, boxes: [box(100, 50, 200, 100)] };

describe("measureCarousel's scale", () => {
  it("converts each axis by its own painted over layout size", () => {
    // Painted 200 wide and 400 tall for 400×200 in layout: half across and double down, so a slide
    // painted 50×40 is 100×20 in layout.
    const reading = measured({ boxes: [box(100, 50, 200, 400)], slides: [box(100, 50, 50, 40)] });
    expect(reading.slideSizes()).toEqual([{ width: 100, height: 20 }]);
  });

  it("reads an axis with no layout size as unscaled", () => {
    // No height in layout: the vertical axis keeps painted px, the horizontal one is halved.
    const reading = measured({
      layout: { width: 400, height: 0 },
      boxes: [box(100, 50, 200, 0)],
      slides: [box(100, 50, 50, 40)],
    });
    expect(reading.slideSizes()).toEqual([{ width: 100, height: 40 }]);
  });

  it("finds no finite geometry for a viewport scaled to nothing", () => {
    const reading = measured({ boxes: [box(100, 50, 0, 0)], slides: [box(100, 50, 0, 0)] });
    expect(reading.result).toEqual({ kind: "non-finite" });
  });

  it("finds no box for a viewport without one", () => {
    const reading = measured({ boxes: [], slides: [box(100, 50, 100, 100)] });
    expect(reading.result).toEqual({ kind: "no-box" });
  });
});

describe("measureCarousel's placement", () => {
  it("places a left-to-right slide from the padding box's painted left edge", () => {
    // A slide painted 50px past the padding box's 101 is 100 scroll px in, and 30 more with the
    // viewport scrolled by 30; 75×90 painted is 150×180 in layout.
    const reading = measured({ ...bordered, slides: [box(151, 60, 75, 90)] });
    expect(starts(reading)).toEqual([130]);
    expect(reading.slideSizes()).toEqual([{ width: 150, height: 180 }]);
  });

  it("places a right-to-left slide from the padding box's painted right edge", () => {
    // A slide whose right edge is painted at 249 is 50 painted px, 100 scroll px, from the padding
    // box's 299, and 30 more with the viewport scrolled 30px toward its end, at -30.
    const reading = measured({
      ...bordered,
      direction: "rtl",
      scrollLeft: -30,
      slides: [box(174, 60, 75, 90)],
    });
    expect(reading.result).toMatchObject({ kind: "geometry", rtl: true });
    expect(starts(reading)).toEqual([130]);
  });

  it("places a vertical slide from the padding box's painted top edge", () => {
    // A slide painted at 76 is 25 painted px, 50 scroll px, below the padding box's 51, and 10 more
    // with the viewport scrolled 10px down; 40 painted px tall is 80 in layout.
    const reading = measured({
      ...bordered,
      orientation: "vertical",
      scrollTop: 10,
      slides: [box(101, 76, 100, 40)],
    });
    expect(starts(reading)).toEqual([60]);
    expect(reading.result.kind === "geometry" && reading.result.geometry[0]?.size).toBe(80);
  });

  it("leaves out a slide without a box", () => {
    // Without borders the padding box starts at 100: the slide at 200 is 200 scroll px in, plus 30.
    const reading = measured({
      boxes: [box(100, 50, 200, 100)],
      slides: [undefined, box(200, 50, 100, 100)],
    });
    expect(starts(reading)).toEqual([230]);
  });
});

describe("measureCarousel's steadiness", () => {
  // Without borders at half size, slides painted at 100 and 200 are 0 and 200 scroll px in, plus 30.
  const halfViewport = box(100, 50, 200, 100);
  const slides = [box(100, 50, 100, 100), box(200, 50, 100, 100)];

  it("is steady when the viewport's box reads the same around the slides'", () => {
    const reading = measured({ boxes: [halfViewport], slides });
    expect(steadiness(reading)).toBe(true);
    expect(starts(reading)).toEqual([30, 230]);
  });

  it("reports the geometry it read before the viewport moved, as unsteady", () => {
    // Painted a pixel to the right after the slides were read, two scroll px at half scale.
    const reading = measured({ boxes: [halfViewport, box(101, 50, 200, 100)], slides });
    expect(steadiness(reading)).toBe(false);
    expect(starts(reading)).toEqual([30, 230]);
  });

  it("is unsteady once a shift reaches half a scroll px", () => {
    // At half scale, a painted 0.125px shift is 0.25 scroll px, and 0.25 painted px is 0.5.
    expect(steadiness(measured({ boxes: [halfViewport, box(100.125, 50, 200, 100)], slides }))).toBe(true);
    expect(steadiness(measured({ boxes: [halfViewport, box(100.25, 50, 200, 100)], slides }))).toBe(false);
  });

  it("counts a change of scale across the whole scroll range", () => {
    // Unscaled, growing the 400px viewport by 0.125px moves its right edge 0.125px and a slide at
    // the far end of the range 0.125 / 400 × the range more: 0.625px across 1600px, 0.375px across
    // 800px.
    const grow = (scrollWidth: number) =>
      steadiness(
        measured({ scrollWidth, boxes: [box(100, 50, 400, 200), box(100, 50, 400.125, 200)], slides })
      );
    expect(grow(1600)).toBe(false);
    expect(grow(800)).toBe(true);
  });

  it("judges only the scroll axis", () => {
    // Moved 10 painted px down, or right, after the slides were read: 20 scroll px along one axis.
    const down = box(100, 60, 200, 100);
    const right = box(110, 50, 200, 100);
    const along = (orientation: CarouselOrientation, after: PaintedBox) =>
      steadiness(measured({ orientation, boxes: [halfViewport, after], slides }));
    expect(along("horizontal", down)).toBe(true);
    expect(along("horizontal", right)).toBe(false);
    expect(along("vertical", right)).toBe(true);
    expect(along("vertical", down)).toBe(false);
  });
});
