// The radial chart's rings. Unit under test: ringBands, ringAt, ringFills, ringAngle and
// ringStroke. Oracles, written by hand: ticket 08's Q4 radii from a 0.3 hole and a 0.7 fill,
// CONTRACT section 8.4's maxima (1.12 × max draws the full sweep with `data-over-max`, and nothing
// laps), Q5's caps (round caps inside the value's angle, butt caps below the stroke width, nothing
// at 0) and D24's ring floor, one device pixel of arc along the centre line.
import { describe, expect, it } from "vitest";

import { ringAngle, ringAt, ringBands, ringFills, ringStroke } from "./rings";

describe("ringBands", () => {
  // A 100 radius with a 30 hole leaves 70 for three rings, 70/3 each, the first ring outermost.
  const bands = ringBands(3, { outer: 100, innerRadius: 0.3, fill: 0.7 });

  it("splits the band from the hole to the rim evenly, first ring outermost", () => {
    const third = 70 / 3;
    const expected = [
      [100 - third, 100],
      [100 - 2 * third, 100 - third],
      [30, 100 - 2 * third],
    ];
    bands.forEach(({ inner, outer }, index) => {
      expect(inner).toBeCloseTo(expected[index]?.[0] ?? Number.NaN, 12);
      expect(outer).toBeCloseTo(expected[index]?.[1] ?? Number.NaN, 12);
    });
  });

  it("strokes 0.7 of each band, centred in it", () => {
    for (const { radius, width, inner, outer } of bands) {
      expect(radius).toBeCloseTo((inner + outer) / 2, 12);
      expect(width).toBeCloseTo((0.7 * 70) / 3, 12);
    }
  });

  it("picks by radius band, each reaching the middle of its gaps, and nothing in the hole or past the rim", () => {
    expect(ringAt(95, bands)).toBe(0);
    expect(ringAt(60, bands)).toBe(1);
    expect(ringAt(31, bands)).toBe(2);
    expect(ringAt(29, bands)).toBeNull();
    expect(ringAt(101, bands)).toBeNull();
  });
});

describe("ringFills and ringAngle", () => {
  it("fills the largest ring to the full sweep without an explicit maximum", () => {
    const fills = ringFills([275, 200], { kind: "largest" });
    expect(fills.map((fill) => ringAngle(fill, 360))).toEqual([360, (200 / 275) * 360]);
    expect(fills.map(({ over }) => over)).toEqual([false, false]);
  });

  it("draws 1.12 × max as the full sweep, over, with its true share", () => {
    const [fill] = ringFills([5.6], { kind: "root", max: 5 });
    expect(fill?.share).toBeCloseTo(1.12, 12);
    expect(fill?.over).toBe(true);
    expect(fill === undefined ? null : ringAngle(fill, 270)).toBe(270);
  });

  it("reads each row's own maximum, and has no share without one", () => {
    const fills = ringFills([3.9, 2], { kind: "rows", maxima: [5, null] });
    expect(fills[0]?.share).toBeCloseTo(0.78, 12);
    expect(fills[1]).toEqual({ max: null, share: null, over: false });
  });

  it("fills nothing for a missing or non-positive value", () => {
    const fills = ringFills([null, 0, -1], { kind: "root", max: 5 });
    expect(fills.map((fill) => ringAngle(fill, 360))).toEqual([0, 0, 0]);
  });
});

describe("ringStroke", () => {
  // A 50 px ring with a 10 px stroke: each round cap reaches 5 px, atan-free, 5/50 rad = 5.7296°.
  const cap = (5 / 50) * (180 / Math.PI);
  const pixels = { radius: 50, width: 10, dpr: 1 };

  it("sets round caps inside the value's angle, so the drawn extent is the angle", () => {
    const stroke = ringStroke(90, pixels);
    expect(stroke.cap).toBe("round");
    expect(stroke.start).toBeCloseTo(cap, 12);
    expect(stroke.length).toBeCloseTo(90 - 2 * cap, 12);
  });

  it("draws butt caps at the true length for an arc shorter than the stroke width", () => {
    // 10° of a 50 px radius is 8.73 px of arc, under the 10 px stroke.
    expect(ringStroke(10, pixels)).toEqual({ start: 0, length: 10, cap: "butt" });
  });

  it("keeps one device pixel of arc for a non-zero value", () => {
    // 0.1° is 0.087 px of arc. One CSS pixel at 1 dp is 1/50 rad of a 50 px ring.
    const stroke = ringStroke(0.1, pixels);
    expect(stroke.cap).toBe("butt");
    expect(stroke.length).toBeCloseTo((1 / 50) * (180 / Math.PI), 12);
    expect(ringStroke(0.1, { ...pixels, dpr: 2 }).length).toBeCloseTo((0.5 / 50) * (180 / Math.PI), 12);
  });

  it("draws nothing at 0", () => {
    expect(ringStroke(0, pixels)).toEqual({ start: 0, length: 0, cap: "none" });
  });
});
