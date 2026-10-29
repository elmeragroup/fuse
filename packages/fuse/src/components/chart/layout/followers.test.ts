// Unit under test: followerGeometry, the one projection of the active slot onto the follower
// marks. Oracle: positions written by hand from the linear scale of CONTRACT section 8.15, and the
// two cases of layer 05's review, q3's layout domain and s10's negative endpoint.
import { describe, expect, it } from "vitest";

import { buildCartesianModel } from "./cartesian-model";
import { followerGeometry } from "./followers";

function model(rows: readonly { readonly [key: string]: number | string }[], keys: readonly string[]) {
  return buildCartesianModel({
    rows,
    series: keys.map((key) => [key, {}] as const),
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });
}

describe("followerGeometry", () => {
  it("projects through the layout's domain, not the Root's", () => {
    // q3: a value of 5 under a layout domain of [0, 10] sits halfway, at 50 %, whatever Root's is.
    const root = model(
      [
        { name: "a", v: 5 },
        { name: "b", v: 100 },
      ],
      ["v"]
    );
    const series = root.series[0];
    if (series === undefined) throw new Error("no series");
    expect(followerGeometry(root, series, 0, [0, 10])).toEqual({
      top: 50,
      height: 50,
      endpoint: 50,
      negative: false,
      stackTop: true,
    });
  });

  it("anchors a negative bar's value at its low end", () => {
    // s10: under [-4, 0] the -4 bar spans the plot from 0 % at zero to 100 % at -4, so its value
    // sits at the bottom, 100 %, and -2 sits at 50 %.
    const negative = model(
      [
        { name: "a", v: -4 },
        { name: "b", v: -2 },
      ],
      ["v"]
    );
    const series = negative.series[0];
    if (series === undefined) throw new Error("no series");
    expect(followerGeometry(negative, series, 0, [-4, 0])).toEqual({
      top: 0,
      height: 100,
      endpoint: 100,
      negative: true,
      stackTop: true,
    });
    expect(followerGeometry(negative, series, 1, [-4, 0])?.endpoint).toBe(50);
  });

  it("projects nothing for a slot that draws nothing", () => {
    const gap = buildCartesianModel({
      rows: [{ name: "a", v: null }],
      series: [["v", {}]],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const series = gap.series[0];
    if (series === undefined) throw new Error("no series");
    expect(followerGeometry(gap, series, 0, [0, 1])).toBeNull();
  });
});
