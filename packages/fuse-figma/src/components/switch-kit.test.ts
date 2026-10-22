/**
 * Unit under test: the Switch component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from `switchVariants` in
 * `switch-variants.ts`, `state-face.ts`, the focus ring in `styles/utils.ts` and Tailwind's
 * `shadow-xs`. `rounded-full` draws as half of each fixed side's shorter length. The thumb's place
 * comes from the browser's geometry in `checked-recheck.md`: off, its 75% dot sits 2px in from the
 * start of the default track's 30px by 16.4px content box, and on, the 16px thumb sits flush with
 * its end, 14px in.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  CENTERED_BOX,
  ERROR_RING,
  FOCUS_RING,
  literal,
  paint,
  SHADOW_XS,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ComponentRootSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function track(size: string, checked: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `switch/size=${size},checked=${checked},state=${state}`);
}

/** A box with no padding or gap. */
const BARE = {
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(0),
} as const;

/** The thumb: a transparent slot of the thumb's size, centering a dot at the size it paints. */
function thumb(slot: number, dot: number, fill: string) {
  return {
    kind: "frame",
    key: "thumb",
    name: "switch-thumb",
    width: literal(slot),
    height: literal(slot),
    ...CENTERED_BOX,
    cornerRadius: literal(0),
    children: [
      {
        kind: "frame",
        key: "dot",
        name: "dot",
        width: literal(dot),
        height: literal(dot),
        ...CENTERED_BOX,
        cornerRadius: literal(dot / 2),
        fill: paint(fill),
        children: [],
      },
    ],
  };
}

describe("the Switch component set", () => {
  it("holds the 2 × 2 × 4 matrix, with columns by state and no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "switch");
    expect(set?.axes).toEqual([
      { name: "size", values: ["default", "sm"] },
      { name: "checked", values: ["off", "on"] },
      { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(16);
    expect([set?.textProperties, set?.swapProperties]).toEqual([[], []]);
  });

  it("draws the default track off as a muted-foreground outline, its 12px dot at the start", () => {
    expect(track("default", "off", "rest")).toEqual({
      name: "switch",
      width: literal(32),
      height: literal(18.4),
      ...BARE,
      primaryAlign: "MIN",
      counterAlign: "CENTER",
      cornerRadius: literal(9.2),
      stroke: { color: paint("muted-foreground"), weight: literal(1) },
      shadows: [SHADOW_XS],
      opacity: 1,
      children: [thumb(16, 12, "muted-foreground")],
    });
  });

  it("fills the default track on with primary, its 16px background thumb flush with the end", () => {
    const on = track("default", "on", "rest");
    expect([on.fill, on.stroke?.color, on.primaryAlign, on.children]).toEqual([
      paint("primary"),
      paint("primary"),
      "MAX",
      [thumb(16, 16, "background")],
    ]);
  });

  it("draws the small track at 24px by 14px, with a 9px dot off and a 12px thumb on", () => {
    const off = track("sm", "off", "rest");
    expect([off.width, off.height, off.cornerRadius, off.primaryAlign, off.children]).toEqual([
      literal(24),
      literal(14),
      literal(7),
      "MIN",
      [thumb(12, 9, "muted-foreground")],
    ]);
    const on = track("sm", "on", "rest");
    expect([on.primaryAlign, on.children]).toEqual(["MAX", [thumb(12, 12, "background")]]);
  });

  it("rings focus, dims disabled, and draws invalid with the error border and ring", () => {
    expect(track("default", "off", "focus").shadows).toEqual([FOCUS_RING, SHADOW_XS]);
    expect(track("sm", "on", "disabled").opacity).toBe(0.5);
    for (const checked of ["off", "on"]) {
      const invalid = track("default", checked, "invalid");
      expect([invalid.stroke?.color, invalid.shadows]).toEqual([paint("error"), [ERROR_RING, SHADOW_XS]]);
    }
  });

  it("drops the after: hit area with its reason", () => {
    const hitArea = coverage.filter(
      (row) => row.component === "Switch" && row.className.startsWith("after:")
    );
    expect(new Set(hitArea.map((row) => row.className))).toEqual(
      new Set(["after:absolute", "after:-inset-x-3", "after:-inset-y-3", "after:content-['']"])
    );
    expect(new Set(hitArea.map((row) => `${row.outcome}: ${row.detail}`))).toEqual(
      new Set(["dropped: a hit area around the track, which paints nothing"])
    );
  });
});
