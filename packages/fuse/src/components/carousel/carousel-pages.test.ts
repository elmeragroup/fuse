/**
 * Unit under test: the carousel's page math. Oracle: hand-sized layouts whose snap positions are
 * worked out here from the CSS Scroll Snap rules, a slide's snap area aligned in the snapport and
 * the result clamped to the scroll range, never from the functions under test.
 */
import { describe, expect, it } from "vitest";

import { clampIndex, nearestPage, pagesOf, parseSnapAlign, samePages, visibleSlides } from "./carousel-pages";
import type { ScrollPort, SlideGeometry, SnapAlign } from "./carousel-pages";

/** `count` slides of `size` px from the scroll origin, `gap` px apart, all aligned `align`. */
function row(count: number, size: number, gap = 0, align: SnapAlign = "start"): SlideGeometry[] {
  return Array.from({ length: count }, (_, index) => ({
    start: index * (size + gap),
    size,
    marginStart: 0,
    marginEnd: 0,
    align,
  }));
}

/** A 300px viewport over slides that end at `contentEnd`, with no scroll padding. */
function port(contentEnd: number, padding: Partial<Pick<ScrollPort, "paddingStart" | "paddingEnd">> = {}) {
  return { size: 300, scrollSize: contentEnd, paddingStart: 0, paddingEnd: 0, ...padding };
}

describe("pagesOf", () => {
  it("makes one page per full-width slide", () => {
    expect(pagesOf(port(1200), row(4, 300))).toEqual({
      positions: [0, 300, 600, 900],
      leadingSlides: [0, 1, 2, 3],
    });
  });

  it("makes one page per snap position when three slides show at once", () => {
    // Six 100px slides in a 300px viewport scroll 300px: slides 3, 4 and 5 all clamp to the end.
    expect(pagesOf(port(600), row(6, 100))).toEqual({
      positions: [0, 100, 200, 300],
      leadingSlides: [0, 1, 2, 3],
    });
  });

  it("counts the gap between slides into each position", () => {
    // 280px slides 20px apart: each starts 300px after the last; the content ends at 1180.
    expect(pagesOf(port(1180), row(4, 280, 20)).positions).toEqual([0, 300, 600, 880]);
  });

  it("insets the snapport by the viewport's scroll padding", () => {
    // A 24px start padding stops each slide 24px in, except the first, which clamps to 0.
    expect(pagesOf(port(1200, { paddingStart: 24 }), row(4, 300)).positions).toEqual([0, 276, 576, 876]);
  });

  it("grows a slide's snap area by its scroll margin", () => {
    const slides = row(3, 300).map((slide) => ({ ...slide, marginStart: 10 }));
    expect(pagesOf(port(900), slides).positions).toEqual([0, 290, 590]);
  });

  it("centres and end-aligns snap areas in the snapport", () => {
    // 200px slides: centred, slide 1 (200–400) centres at 300, so the viewport starts at 150.
    expect(pagesOf(port(800), row(4, 200, 0, "center")).positions).toEqual([0, 150, 350, 500]);
    // End-aligned, slide 1 ends at 400, so the viewport starts at 100; slide 0 clamps to 0.
    expect(pagesOf(port(800), row(4, 200, 0, "end")).positions).toEqual([0, 100, 300, 500]);
  });

  it("skips slides that do not snap, so a layout can page by groups", () => {
    const slides = row(6, 100).map((slide, index) => ({
      ...slide,
      align: index % 3 === 0 ? ("start" as const) : ("none" as const),
    }));
    expect(pagesOf(port(600), slides)).toEqual({ positions: [0, 300], leadingSlides: [0, 3] });
  });

  /** A start-aligned slide at `start`, `size` px long. */
  function slideAt(start: number, size: number): SlideGeometry {
    return { start, size, marginStart: 0, marginEnd: 0, align: "start" };
  }

  it("merges snap positions under a pixel apart into the earlier, led by the first slide in document order", () => {
    // Slide 1 snaps at 300.6 and slide 2, which overlaps it, at 300: both well inside the 900px
    // scroll range, so neither clamps. One page at 300, led by slide 1.
    const slides = [slideAt(0, 300), slideAt(300.6, 299.4), slideAt(300, 300), slideAt(600, 300)];
    expect(pagesOf(port(1200), slides)).toEqual({ positions: [0, 300, 600], leadingSlides: [0, 1, 3] });
  });

  it("keeps snap positions a pixel apart as two pages", () => {
    const slides = [slideAt(0, 300), slideAt(300, 1), slideAt(301, 299), slideAt(600, 300)];
    expect(pagesOf(port(1200), slides)).toEqual({
      positions: [0, 300, 301, 600],
      leadingSlides: [0, 1, 2, 3],
    });
  });

  it("has no pages without slides, and one when no slide snaps", () => {
    expect(pagesOf(port(0), [])).toEqual({ positions: [], leadingSlides: [] });
    expect(pagesOf(port(900), row(3, 300, 0, "none"))).toEqual({ positions: [0], leadingSlides: [0] });
  });
});

describe("nearestPage", () => {
  const positions = [0, 300, 600, 900];

  it("picks the closest position, and the earlier page at the halfway point", () => {
    expect(nearestPage(positions, 0)).toBe(0);
    expect(nearestPage(positions, 149)).toBe(0);
    expect(nearestPage(positions, 150)).toBe(0);
    expect(nearestPage(positions, 151)).toBe(1);
    expect(nearestPage(positions, 899.5)).toBe(3);
    expect(nearestPage(positions, 2000)).toBe(3);
    expect(nearestPage(positions, -40)).toBe(0);
  });

  it("answers 0 without pages", () => {
    expect(nearestPage([], 120)).toBe(0);
  });
});

describe("visibleSlides", () => {
  it("counts a slide in view or peeking, and not one that only touches the edge", () => {
    // At 0 the 300px viewport shows slide 0; slide 1 starts exactly at its end.
    expect([...visibleSlides(port(1200), row(4, 300), 0)]).toEqual([0]);
    // 40px in, slide 1 peeks.
    expect([...visibleSlides(port(1200), row(4, 300), 40)]).toEqual([0, 1]);
    // 299.5px in, slide 0 keeps half a pixel, which is not in view.
    expect([...visibleSlides(port(1200), row(4, 300), 299.5)]).toEqual([1]);
  });

  it("shows every slide of a page of three", () => {
    expect([...visibleSlides(port(600), row(6, 100), 200)]).toEqual([2, 3, 4]);
  });
});

describe("parseSnapAlign", () => {
  it("reads one value for both axes, and the block-then-inline pair", () => {
    expect(parseSnapAlign("start", "inline")).toBe("start");
    expect(parseSnapAlign("center", "block")).toBe("center");
    expect(parseSnapAlign("none end", "inline")).toBe("end");
    expect(parseSnapAlign("none end", "block")).toBe("none");
    expect(parseSnapAlign("", "inline")).toBe("none");
    expect(parseSnapAlign("unknown", "inline")).toBe("none");
  });
});

describe("samePages", () => {
  const pages = { positions: [0, 300], leadingSlides: [0, 1] };

  it("matches positions under a pixel apart, led by the same slides", () => {
    expect(samePages(pages, { positions: [0, 300.6], leadingSlides: [0, 1] })).toBe(true);
  });

  it("tells apart a pixel's move, another leading slide and another page count", () => {
    expect(samePages(pages, { positions: [0, 301], leadingSlides: [0, 1] })).toBe(false);
    expect(samePages(pages, { positions: [0, 300], leadingSlides: [0, 2] })).toBe(false);
    expect(samePages(pages, { positions: [0, 300, 600], leadingSlides: [0, 1, 2] })).toBe(false);
  });
});

describe("clampIndex", () => {
  it("truncates to a whole page and clamps to the first and last", () => {
    expect(clampIndex(2.7, 5)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(9, 3)).toBe(2);
  });

  it("clamps only from below before any page is measured", () => {
    expect(clampIndex(7, 0)).toBe(7);
    expect(clampIndex(-2, 0)).toBe(0);
  });
});
