/**
 * Unit under test: the Checkbox component set as the build produces it. Oracle: the Fuse variable
 * or literal each Figma field of a cell must carry, read by hand from `checkbox-variants.ts`,
 * `state-face.ts`, `corner-radius.ts`, the focus ring in `styles/utils.ts` and Tailwind's
 * `shadow-xs`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  ERROR_RING,
  FOCUS_RING,
  literal,
  paint,
  SHADOW_XS,
  token,
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

function checkbox(checked: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `checkbox/checked=${checked},state=${state}`);
}

/** The indicator `checkbox.tsx` renders while checked or mixed, around its 14px glyph. */
const indicator = (icon: string) => ({
  kind: "frame",
  key: "indicator",
  name: "checkbox-indicator",
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(0),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: literal(0),
  shadows: [],
  opacity: 1,
  children: [
    {
      kind: "icon",
      key: "icon",
      name: "Icon",
      icon: `icon/${icon}`,
      swapProperty: undefined,
      size: literal(14),
      color: paint("primary-foreground"),
    },
  ],
});

describe("the Checkbox component set", () => {
  it("holds the 3 × 4 matrix, with columns by state and no properties of its own", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "checkbox");
    expect(set?.axes).toEqual([
      { name: "checked", values: ["off", "on", "mixed"] },
      { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(12);
    expect([set?.textProperties, set?.swapProperties]).toEqual([[], []]);
  });

  it("draws an empty 16px card box with a muted-foreground border and the 4px-capped corner when off", () => {
    expect(checkbox("off", "rest")).toEqual({
      name: "checkbox",
      width: literal(16),
      height: literal(16),
      paddingTop: literal(0),
      paddingRight: literal(0),
      paddingBottom: literal(0),
      paddingLeft: literal(0),
      itemSpacing: literal(0),
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      cornerRadius: token("radius-checkbox"),
      fill: paint("card"),
      stroke: { color: paint("muted-foreground"), weight: literal(1) },
      shadows: [SHADOW_XS],
      opacity: 1,
      children: [],
    });
  });

  it("fills checked and mixed with primary around a centered 14px Check or Minus", () => {
    for (const [checked, icon] of [
      ["on", "Check"],
      ["mixed", "Minus"],
    ] as const) {
      const box = checkbox(checked, "rest");
      expect([box.fill, box.stroke?.color, box.children]).toEqual([
        paint("primary"),
        paint("primary"),
        [indicator(icon)],
      ]);
    }
  });

  it("rings focus, dims disabled, and keeps the primary border only on a checked invalid box", () => {
    expect(checkbox("off", "focus").shadows).toEqual([FOCUS_RING, SHADOW_XS]);
    expect(checkbox("on", "disabled").opacity).toBe(0.5);
    // `aria-invalid:aria-checked:border-primary` matches `aria-checked="true"`, which a mixed box,
    // `aria-checked="mixed"`, does not carry, so it keeps the error border of the state face.
    const checkedInvalid = checkbox("on", "invalid");
    expect([checkedInvalid.stroke?.color, checkedInvalid.shadows]).toEqual([
      paint("primary"),
      [ERROR_RING, SHADOW_XS],
    ]);
    const mixedInvalid = checkbox("mixed", "invalid");
    expect([mixedInvalid.stroke?.color, mixedInvalid.shadows]).toEqual([
      paint("error"),
      [ERROR_RING, SHADOW_XS],
    ]);
    expect(checkbox("off", "invalid").stroke?.color).toEqual(paint("error"));
  });

  it("drops the after: hit area with its reason", () => {
    const hitArea = coverage.filter(
      (row) => row.component === "Checkbox" && row.className.startsWith("after:")
    );
    expect(new Set(hitArea.map((row) => row.className))).toEqual(
      new Set(["after:absolute", "after:-inset-x-3", "after:-inset-y-2", "after:content-['']"])
    );
    expect(new Set(hitArea.map((row) => `${row.outcome}: ${row.detail}`))).toEqual(
      new Set(["dropped: a hit area around the box, which paints nothing"])
    );
  });
});
