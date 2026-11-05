// Unit under test: fitRingLabels, which thins a RadiusAxis by the room along its spoke. Oracles,
// worked by hand. Each value is a 16 px line on a chip 4 px right of the spoke, padded 2 px either
// side, and keeps 2 px from anything else. An angle label at reach 1.1 reads away from the centre:
// at 12 o'clock it centres on the spoke with its bottom edge on 1.1 R, and at 15° its left and
// bottom edges sit on its point, 1.1 R · (sin 15°, −cos 15°).
import { describe, expect, it } from "vitest";

import { fitRimLabel, fitRingLabels, ringAnchor } from "./ring-labels";

/** A one-character value, 8 px wide, on each of a radar's five rings on [0, 4]. */
const RADAR = [0, 0.25, 0.5, 0.75, 1].map((radius) => ({ radius, width: 8 }));

describe("ring values along the spoke", () => {
  it("thins by stride, keeps every value a narrower dial showed, and stays under the 12 o'clock label", () => {
    // A 30 px label at 12 o'clock. At 120 px, R = 60: the rim's chip tops out at 68 px, past the
    // label's bottom at 66 less the gap, and 0 sits on the centre, so 0.25, 0.5 and 0.75 have room,
    // 15 px apart, too close; a stride of 2 leaves 0.5 alone. At 160 px, R = 80, they sit 20 px
    // apart, so all three show. At 200 px, R = 100, the rim's chip tops out at 108, 2 px under 110.
    const angles = [{ angle: 0, width: 30, shownAt: "always" as const }];
    expect(fitRingLabels(RADAR, { reach: 1.1, inner: 0, angles })).toEqual(["none", 160, 120, 160, 200]);
  });

  it("keeps a value off a label beside 12 o'clock", () => {
    // "Jan" at 15°, 20 px wide, its bottom at 1.1 R cos 15° ≈ 1.0625 R. The rim's chip tops out at
    // R + 8, which clears it by 2 px once 0.0625 R ≥ 10, so R ≥ 160, the 320 px bucket. The 0.5
    // ring's chip sits far below it from the first bucket.
    const rings = [0.5, 1].map((radius) => ({ radius, width: 52 }));
    const jan = { angle: 15, width: 20, shownAt: "always" as const };
    expect(fitRingLabels(rings, { reach: 1.1, inner: 0, angles: [jan] })).toEqual([120, 320]);
  });

  it("gives a label the axis hides at a width no room there", () => {
    // A 12 o'clock label blocks the rim's value below R = 100, the 200 px bucket. Shown only from
    // 280 px, where R = 140 leaves the rim's chip 14 px under it, it never blocks, so the value
    // shows from the first bucket.
    const rim = [{ radius: 1, width: 8 }];
    const always = { angle: 0, width: 30, shownAt: "always" as const };
    expect(fitRingLabels(rim, { reach: 1.1, inner: 0, angles: [always] })).toEqual([200]);
    expect(fitRingLabels(rim, { reach: 1.1, inner: 0, angles: [{ ...always, shownAt: 280 }] })).toEqual([
      120,
    ]);
  });

  it("waits to show a value until no wider dial's label takes its room", () => {
    // The 12 o'clock label shows from 160 px, where R = 80 leaves the rim's chip only 8 px under its
    // 88, so the value has room at 120 px and loses it at 160. A value never hides as the dial
    // widens, so it waits for 200 px, from which R = 100 keeps it clear at every width.
    const rim = [{ radius: 1, width: 8 }];
    const label = { angle: 0, width: 30, shownAt: 160 };
    expect(fitRingLabels(rim, { reach: 1.1, inner: 0, angles: [label] })).toEqual([200]);
  });

  it("keeps a value off the hole's centre text", () => {
    // The 0.35 ring's value clears text reaching 0.3 R once 0.35 R − 10 ≥ 0.3 R, so R ≥ 200, the
    // 400 px bucket.
    const rings = [0.35, 1].map((radius) => ({ radius, width: 8 }));
    expect(fitRingLabels(rings, { reach: 1.1, inner: 0.3, angles: [] })[0]).toBe(400);
  });

  it("hides a value a mark covers, and runs the values down to 6 o'clock where marks fill the top", () => {
    // Marks that fill the top half of the dial cover every chip on the 12 o'clock spoke. On the
    // 6 o'clock spoke, with no label there, the two values sit 0.5 R apart, which holds a line and
    // the gap from R = 36, so both show from the first bucket.
    const rings = [0.5, 1].map((radius) => ({ radius, width: 8 }));
    const top = { reach: 1.1, inner: 0, angles: [], marks: (_x: number, y: number) => y < 0 };
    expect(fitRingLabels(rings, top)).toEqual(["none", "none"]);
    expect(ringAnchor(rings, top)).toBe(180);
    expect(fitRingLabels(rings, { ...top, anchor: 180 })).toEqual([120, 120]);
  });
});

describe("a label past the rim beside the angle labels", () => {
  const top = { angle: 0, width: 30, shownAt: "always" as const };

  it("shows from the first width where it sits clear of every shown angle label", () => {
    // At 90° it reads right from 1.1 R, far from the labels at 12 and 6 o'clock at any width.
    expect(fitRimLabel({ angle: 90, width: 30 }, 1.1, [top, { ...top, angle: 180 }])).toBe(120);
    // At 10° it centres 1.1 R · sin 10° ≈ 0.191 R right of the 12 o'clock label, both 30 px wide, and
    // their bottoms sit 0.017 R apart, so the two boxes meet until 0.191 R − 15 ≥ 15 + 2: R ≥ 167.6,
    // first reached at the 360 px bucket.
    expect(fitRimLabel({ angle: 10, width: 30 }, 1.1, [top])).toBe(360);
  });

  it("shows nowhere when a label it covers shows at some wider width", () => {
    expect(fitRimLabel({ angle: 0, width: 30 }, 1.1, [top])).toBe("none");
    // The covered label shows only from 280 px, so the label clears it below 280 but not above.
    expect(fitRimLabel({ angle: 0, width: 30 }, 1.1, [{ ...top, shownAt: 280 }])).toBe("none");
  });
});
