// Unit under test: fitRingLabels, which thins a RadiusAxis by the room along its spoke. Oracles,
// worked by hand. Each value is a 16 px line on a chip 4 px right of the spoke, padded 2 px either
// side, and keeps 2 px from anything else. An angle label sits with its middle on its ray at
// R + 6 + |sin θ| · w/2 + |cos θ| · 8.75/2, a cap height, its box a 16 px line tall: at
// 12 o'clock a 30 px label spans x from −15 to 15 and y from −(R + 18.375) to −(R + 2.375), and at
// 15° a 30 px label's middle lies R + 14.108 out, so its left edge sits at 0.2588 (R + 14.108) − 15.
import { describe, expect, it } from "vitest";

import { fitHandLabel, fitRingLabels, ringAnchor } from "./ring-labels";

/** A one-character value, 8 px wide, on each of a radar's five rings on [0, 4]. */
const RADAR = [0, 0.25, 0.5, 0.75, 1].map((radius) => ({ radius, width: 8 }));

describe("ring values along the spoke", () => {
  it("thins by stride, keeps every value a narrower dial showed, and stays under the 12 o'clock label", () => {
    // A 30 px label at 12 o'clock ends R + 2.375 up, under the rim's chip, which tops out at R + 8, so
    // the rim's value never shows; 0.75 R's chip tops out under it from R = 30. At 120 px, R = 60,
    // and 0 sits on the centre, so 0.25, 0.5 and 0.75 have room, 15 px apart, too close; a stride of
    // 2 leaves 0.5 alone. At 160 px, R = 80, they sit 20 px apart, so all three show.
    const angles = [{ angle: 0, width: 30, shownAt: "always" as const }];
    expect(fitRingLabels(RADAR, { inner: 0, angles })).toEqual(["none", 160, 120, 160, "none"]);
  });

  it("keeps a value off a label beside 12 o'clock", () => {
    // "Jan" at 15°, 20 px wide, its middle R + 12.81 out, so its bottom edge sits 0.9659 R + 4.37 up,
    // always level with the rim's chip, which only its left edge, 0.2588 (R + 12.81) − 10, can clear:
    // 2 px past the 52 px chip's right edge at 60 once R ≥ 265.4, the 560 px bucket. The 0.5 ring's
    // chip sits far below it from the first bucket.
    const rings = [0.5, 1].map((radius) => ({ radius, width: 52 }));
    const jan = { angle: 15, width: 20, shownAt: "always" as const };
    expect(fitRingLabels(rings, { inner: 0, angles: [jan] })).toEqual([120, 560]);
  });

  it("gives a label the axis hides at a width no room there", () => {
    // A 30 px label at 15° blocks the rim's 8 px value, whose chip ends at 16, until its left edge
    // clears it by 2 px, 0.2588 (R + 14.108) − 15 ≥ 18, so R ≥ 113.4, the 240 px bucket. Shown only
    // from 280 px, where R = 140 leaves it clear, it never blocks, so the value shows from the first
    // bucket.
    const rim = [{ radius: 1, width: 8 }];
    const always = { angle: 15, width: 30, shownAt: "always" as const };
    expect(fitRingLabels(rim, { inner: 0, angles: [always] })).toEqual([240]);
    expect(fitRingLabels(rim, { inner: 0, angles: [{ ...always, shownAt: 280 }] })).toEqual([120]);
  });

  it("waits to show a value until no wider dial's label takes its room", () => {
    // The 15° label shows from 160 px, where R = 80 leaves it over the rim's chip, so the value has
    // room at 120 px and loses it at 160. A value never hides as the dial widens, so it waits for
    // 240 px, from which R = 120 keeps it clear at every width.
    const rim = [{ radius: 1, width: 8 }];
    const label = { angle: 15, width: 30, shownAt: 160 };
    expect(fitRingLabels(rim, { inner: 0, angles: [label] })).toEqual([240]);
  });

  it("keeps a value off the hole's centre text", () => {
    // The 0.35 ring's value clears text reaching 0.3 R once 0.35 R − 10 ≥ 0.3 R, so R ≥ 200, the
    // 400 px bucket.
    const rings = [0.35, 1].map((radius) => ({ radius, width: 8 }));
    expect(fitRingLabels(rings, { inner: 0.3, angles: [] })[0]).toBe(400);
  });

  it("hides a value a mark covers, and runs the values down to 6 o'clock where marks fill the top", () => {
    // Marks that fill the top half of the dial cover every chip on the 12 o'clock spoke. On the
    // 6 o'clock spoke, with no label there, the two values sit 0.5 R apart, which holds a line and
    // the gap from R = 36, so both show from the first bucket.
    const rings = [0.5, 1].map((radius) => ({ radius, width: 8 }));
    const top = { inner: 0, angles: [], marks: (_x: number, y: number) => y < 0 };
    expect(fitRingLabels(rings, top)).toEqual(["none", "none"]);
    expect(ringAnchor(rings, top)).toEqual({ anchor: 180, shown: [120, 120] });
    expect(fitRingLabels(rings, { ...top, anchor: 180 })).toEqual([120, 120]);
  });
});

describe("a label on a hand inside the rim", () => {
  it("shows from the first width where it keeps the gap from the hole", () => {
    // At 90° a 30 px label's middle sits R − 6 − 15 in, so its inner edge lies R − 36 from the
    // centre. With a hole of 0.5 R that edge keeps 2 px once R − 36 ≥ 0.5 R + 2, so R ≥ 76: the
    // 160 px bucket. With no hole, R ≥ 38 holds at the first bucket.
    expect(fitHandLabel({ angle: 90, width: 30 }, 0.5)).toBe(160);
    expect(fitHandLabel({ angle: 90, width: 30 }, 0)).toBe(120);
    // At 0° its middle sits R − 6 − 4.375 in and its line reaches 8 px lower, to R − 18.375, which
    // keeps 2 px from a 0.8 R hole once R ≥ 101.875: the 240 px bucket.
    expect(fitHandLabel({ angle: 0, width: 30 }, 0.8)).toBe(240);
  });

  it("shows nowhere when the hole leaves it no room at any width", () => {
    // R − 36 ≥ 0.95 R + 2 needs R ≥ 760, past the widest bucket, 1200 px.
    expect(fitHandLabel({ angle: 90, width: 30 }, 0.95)).toBe("none");
  });
});
