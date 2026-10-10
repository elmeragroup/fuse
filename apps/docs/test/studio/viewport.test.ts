import { describe, expect, it } from "vitest";

import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  fitRects,
  fitWidth,
  mostlyOffscreen,
  panBy,
  revealRect,
  screenToWorld,
  stepZoom,
  wheelZoomFactor,
  zoomAt,
} from "../../src/studio/lib/viewport";

// A viewport maps a world point w to the screen point w * zoom + (x, y). Every expected value
// below is worked by hand from that one formula.

describe("clampZoom", () => {
  it("keeps zoom between 10% and 400%", () => {
    expect(MIN_ZOOM).toBe(0.1);
    expect(MAX_ZOOM).toBe(4);
    expect(clampZoom(0.01)).toBe(0.1);
    expect(clampZoom(9)).toBe(4);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe("panBy", () => {
  it("moves the origin by the screen delta and keeps the zoom", () => {
    // (10, 20) + (5, -8) = (15, 12).
    expect(panBy({ x: 10, y: 20, zoom: 2 }, { x: 5, y: -8 })).toEqual({ x: 15, y: 12, zoom: 2 });
  });
});

describe("screenToWorld", () => {
  it("inverts the viewport mapping", () => {
    // (300 - 100) / 2 = 100, (250 - 50) / 2 = 100.
    expect(screenToWorld({ x: 100, y: 50, zoom: 2 }, { x: 300, y: 250 })).toEqual({ x: 100, y: 100 });
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the cursor fixed", () => {
    // At zoom 1 with origin (0, 0), the cursor at (200, 100) sits over world (200, 100).
    // At zoom 2 that world point must still land on (200, 100): x = 200 - 200 * 2 = -200,
    // y = 100 - 100 * 2 = -100.
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 200, y: 100 }, 2)).toEqual({ x: -200, y: -100, zoom: 2 });
  });

  it("works from a panned, zoomed viewport", () => {
    // World under the cursor: ((240-40)/2, (160-60)/2) = (100, 50). Keeping it under the cursor
    // at half zoom needs x = 240 - 100 * 0.5 = 190 and y = 160 - 50 * 0.5 = 135.
    expect(zoomAt({ x: 40, y: 60, zoom: 2 }, { x: 240, y: 160 }, 0.5)).toEqual({
      x: 190,
      y: 135,
      zoom: 0.5,
    });
  });

  it("clamps the zoom and anchors at the clamped value", () => {
    // Asked for 10, clamped to 4. Cursor (100, 100) over world (100, 100) at zoom 1:
    // x = 100 - 100 * 4 = -300.
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 100 }, 10)).toEqual({ x: -300, y: -300, zoom: 4 });
  });
});

describe("fitRects", () => {
  const screen = { width: 1000, height: 600 };

  it("fits the bounds of every rect inside the padded screen and centres them", () => {
    // Bounds of (0,0,400,200) and (600,300,200,100) are (0,0)–(800,400): 800 × 400.
    // Padded screen is 1000 - 2*50 = 900 by 600 - 2*50 = 500.
    // zoom = min(900/800, 500/400) = min(1.125, 1.25) = 1.125.
    // Centred: x = 500 - 400 * 1.125 = 50, y = 300 - 200 * 1.125 = 75.
    const fitted = fitRects(
      [
        { x: 0, y: 0, width: 400, height: 200 },
        { x: 600, y: 300, width: 200, height: 100 },
      ],
      screen,
      50
    );
    expect(fitted).toEqual({ x: 50, y: 75, zoom: 1.125 });
  });

  it("handles rects away from the origin", () => {
    // No padding, so zoom = min(1000/2000, 600/500) = 0.5. The rect's centre (2000, 2250) must
    // land on the screen centre: x = 500 - 2000 * 0.5 = -500, y = 300 - 2250 * 0.5 = -825.
    expect(fitRects([{ x: 1000, y: 2000, width: 2000, height: 500 }], screen, 0)).toEqual({
      x: -500,
      y: -825,
      zoom: 0.5,
    });
  });

  it("clamps a fit that would zoom past the range", () => {
    // A 10 × 10 rect would fit at 60; clamped to 4. Centre (5, 5): x = 500 - 20, y = 300 - 20.
    expect(fitRects([{ x: 0, y: 0, width: 10, height: 10 }], screen, 0)).toEqual({ x: 480, y: 280, zoom: 4 });
  });

  it("returns undefined when there is nothing to fit", () => {
    expect(fitRects([], screen, 0)).toBeUndefined();
  });
});

describe("stepZoom", () => {
  it("moves to the next preset stop in either direction", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(0.75);
    // From between two stops, 1.2 steps up to 1.5 and down to 1.
    expect(stepZoom(1.2, 1)).toBe(1.5);
    expect(stepZoom(1.2, -1)).toBe(1);
  });

  it("stays at the ends of the range", () => {
    expect(stepZoom(4, 1)).toBe(4);
    expect(stepZoom(0.1, -1)).toBe(0.1);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in for a negative delta and out for a positive one, symmetrically", () => {
    // exp(-(-10) * 0.01) = exp(0.1) ≈ 1.10517; its reciprocal for +10.
    expect(wheelZoomFactor(-10)).toBeCloseTo(1.10517, 5);
    expect(wheelZoomFactor(10)).toBeCloseTo(1 / 1.10517, 5);
  });

  it("caps a single mouse-wheel notch so one click never jumps far", () => {
    // A notch of 100 is capped at 50: exp(-0.5) ≈ 0.60653.
    expect(wheelZoomFactor(100)).toBeCloseTo(0.60653, 5);
    expect(wheelZoomFactor(-500)).toBeCloseTo(1.64872, 5);
  });
});

describe("mostlyOffscreen", () => {
  const screen = { width: 1000, height: 800 };

  it("is false for a rect fully on screen", () => {
    // World (100, 100, 200 x 200) at zoom 1 lands on (100, 100)..(300, 300), all inside.
    expect(
      mostlyOffscreen({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 100, width: 200, height: 200 }, screen)
    ).toBe(false);
  });

  it("is true when less than half of the rect shows", () => {
    // Panned by (-250, 0), the rect spans x -150..50: 50 of its 200 px show, 50 * 200 = 10 000 of
    // 40 000 px², a quarter.
    expect(
      mostlyOffscreen({ x: -250, y: 0, zoom: 1 }, { x: 100, y: 100, width: 200, height: 200 }, screen)
    ).toBe(true);
  });

  // World (0, 0, 300 x 250) at zoom 4 is 1200 x 1000 = 1 200 000 px², larger than the
  // 1000 x 800 = 800 000 px² screen on both axes. Half the screen, 400 000 px², is the bar.
  const large = { x: 0, y: 0, width: 300, height: 250 };

  it("is false when the rect is larger than the screen and covers it", () => {
    // Panned by (-100, -100), it spans -100..1100 across and -100..900 down: the whole screen,
    // 800 000 px², shows.
    expect(mostlyOffscreen({ x: -100, y: -100, zoom: 4 }, large, screen)).toBe(false);
  });

  it("measures a rect larger than the screen against half the screen, not half the rect", () => {
    // Panned by (-600, -100), it shows 0..600 across, the full 800 down: 480 000 px², under half
    // the rect (600 000) but over half the screen (400 000), so it counts as shown.
    expect(mostlyOffscreen({ x: -600, y: -100, zoom: 4 }, large, screen)).toBe(false);
    // Panned by (-710, -100), it shows 0..490 across: 392 000 px², under half the screen.
    expect(mostlyOffscreen({ x: -710, y: -100, zoom: 4 }, large, screen)).toBe(true);
  });

  it("is true for a rect entirely off screen", () => {
    expect(
      mostlyOffscreen({ x: 2000, y: 0, zoom: 1 }, { x: 100, y: 100, width: 200, height: 200 }, screen)
    ).toBe(true);
  });
});

describe("revealRect", () => {
  // At zoom 2 from (100, 50), on an 800 × 600 screen with a 20 px margin: the room is 20..780
  // across and 20..580 down.
  const viewport = { x: 100, y: 50, zoom: 2 };
  const screen = { width: 800, height: 600 };
  const margins = { top: 20, right: 20, bottom: 20, left: 20 };

  it("leaves a rect already in view where it is", () => {
    // It draws at screen x 100..200, y 50..100, inside the room.
    expect(revealRect(viewport, { x: 0, y: 0, width: 50, height: 25 }, screen, margins)).toEqual(viewport);
  });

  it("pans a rect clipped at the top left in by the margin", () => {
    // Screen x -20..20, y -10..10: right by 20 - -20 = 40, down by 20 - -10 = 30.
    expect(revealRect(viewport, { x: -60, y: -30, width: 20, height: 10 }, screen, margins)).toEqual({
      x: 140,
      y: 80,
      zoom: 2,
    });
  });

  it("pans a rect clipped at the bottom right in by the margin", () => {
    // Screen x 760..860, y 570..610: left by 860 - 780 = 80, up by 610 - 580 = 30.
    expect(revealRect(viewport, { x: 330, y: 260, width: 50, height: 20 }, screen, margins)).toEqual({
      x: 20,
      y: 20,
      zoom: 2,
    });
  });

  it("shows the start of a rect wider than the room", () => {
    // Screen x 300..1100 is 800 wide, more than the 760 of room: its left edge moves to 20.
    expect(revealRect(viewport, { x: 100, y: 0, width: 400, height: 25 }, screen, margins)).toEqual({
      x: -180,
      y: 50,
      zoom: 2,
    });
  });

  it("keeps each edge's own margin clear", () => {
    // With 10 at the top and left and 100 at the bottom and right, the room is 10..700 across and
    // 10..500 down. Screen x 740..760, y 520..540: left by 760 - 700 = 60, up by 540 - 500 = 40.
    const uneven = { top: 10, right: 100, bottom: 100, left: 10 };
    expect(revealRect(viewport, { x: 320, y: 235, width: 10, height: 10 }, screen, uneven)).toEqual({
      x: 40,
      y: 10,
      zoom: 2,
    });
  });
});

describe("fitWidth", () => {
  const screen = { width: 390, height: 796 };
  const margins = { top: 48, right: 24, left: 24 };

  it("fills the room between the side margins and puts the rect's top at the top margin", () => {
    // Room 390 - 24 - 24 = 342 across a 684-wide rect: zoom 0.5, whatever the rect's height.
    // Its left edge lands on the left margin: x = 24 - 100 * 0.5 = -26.
    // Its top lands on the top margin: y = 48 - 50 * 0.5 = 23.
    expect(fitWidth({ x: 100, y: 50, width: 684, height: 4000 }, screen, margins)).toEqual({
      x: -26,
      y: 23,
      zoom: 0.5,
    });
  });

  it("centres a rect the zoom range keeps narrower than the room", () => {
    // 342 / 10 = 34.2 clamps to 4, a 40-wide rect: x = 24 + (342 - 40) / 2 - 100 * 4 = -225,
    // y = 48 - 50 * 4 = -152.
    expect(fitWidth({ x: 100, y: 50, width: 10, height: 10 }, screen, margins)).toEqual({
      x: -225,
      y: -152,
      zoom: 4,
    });
  });
});
