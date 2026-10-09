import { describe, expect, it } from "vitest";

import { densityOwnedProperties, roleViolation, sentinelLengths } from "./density-attribution";
import type { DensityProbe, PropertyReading } from "./density-attribution";

/** A rendered reading: an auto-sized box with no padding, gap or own type change. */
const STILL: PropertyReading = {
  "padding-top": "0px",
  "padding-right": "0px",
  "padding-bottom": "0px",
  "padding-left": "0px",
  "row-gap": "normal",
  "column-gap": "normal",
  height: "auto",
  width: "auto",
  "min-height": "auto",
  "min-width": "auto",
  "font-size": "14px",
  "line-height": "20px",
};

function probe(base: Partial<PropertyReading>, sentinel: Partial<PropertyReading>): DensityProbe {
  return { base: { ...STILL, ...base }, sentinel: { ...STILL, ...sentinel } };
}

// The reviewers' cases. Each reading is what a probe reports for that CSS: a box size that is
// not declared reads `auto` in the typed computed value, and an inherited type is pinned, so
// neither moves under the sentinel metrics.
describe("density attribution", () => {
  it("fails a role part whose only change is a child growing inside it", () => {
    // The parent's height is `auto` in both reads: the child's growth is not the parent's.
    expect(roleViolation("surface", probe({}, {}))).toBe("reads no density metric of its own");
  });

  it("fails a surface that pads with a literal 4px where the small surface tier was", () => {
    const literal = { "padding-top": "4px", "padding-bottom": "4px" };
    expect(roleViolation("surface", probe(literal, literal))).toBe("reads no density metric of its own");
  });

  it("passes a surface that pads with the small surface tier, though it is 4px at both densities", () => {
    // The sentinel moves every metric, invariant ones included.
    const token = probe({ "padding-top": "4px" }, { "padding-top": "9px" });
    expect(roleViolation("surface", token)).toBeUndefined();
  });

  it("fails a fixed text-bearing part whose own height reads a metric", () => {
    const title = probe({ height: "32px" }, { height: "51px" });
    expect(roleViolation("fixed", title)).toBe("reads a density metric through its height");
  });

  it("passes a fixed part whose type it only inherits, and a layout part that only grows", () => {
    expect(roleViolation("fixed", probe({}, {}))).toBeUndefined();
    expect(roleViolation("layout", probe({}, {}))).toBeUndefined();
  });

  it("fails a layout part whose own gap reads a metric", () => {
    const stack = probe({ "row-gap": "12px" }, { "row-gap": "21px" });
    expect(roleViolation("layout", stack)).toBe("reads a density metric through its row-gap");
  });

  it("credits a control's own height, a row's padding and a label's type", () => {
    expect(densityOwnedProperties(probe({ height: "36px" }, { height: "57px" }))).toEqual(["height"]);
    expect(
      roleViolation("row", probe({ "padding-left": "8px" }, { "padding-left": "15px" }))
    ).toBeUndefined();
    expect(
      densityOwnedProperties(
        probe({ "font-size": "14px", "line-height": "20px" }, { "font-size": "24px", "line-height": "33px" })
      )
    ).toEqual(["font-size", "line-height"]);
  });

  it("gives every density metric a sentinel that differs from its dense length", () => {
    const sentinels = sentinelLengths([
      { name: "surface-pad-sm", px: { dense: 4 } },
      { name: "row-h", px: { dense: 32 } },
    ]);
    expect(sentinels).toEqual({ "--surface-pad-sm": "9px", "--row-h": "51px" });
  });
});
