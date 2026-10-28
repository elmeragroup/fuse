/**
 * Unit under test: the Tooltip sets `Tooltip content` and `Tooltip (open)` as the build produces them.
 * Oracle: the Figma field each cell must carry, read by hand from `tooltip-variants.ts`,
 * `inner-corner/tooltip.ts` and `tooltip.tsx` (side top, offset 4, centred), and the open Basic demo
 * Chromium measured with preflight on 2026-10-27:
 *
 * - The popup is 92 × 28 dense and 100 × 32 comfortable: 12px text on a 16px line, padded 12px and
 *   6px dense, 16px and 8px comfortable, `rounded-md`, `bg-foreground` behind `text-background`.
 * - The arrow's turned box is 14.14px square, centred at (W/2, H - 2): a 10px square with 2px corners,
 *   turned 45°, which Figma counts as -45. Base UI wrote its `left` as 41px and 45px.
 * - The trigger, the ghost icon Button, sits 4px below the popup and centred under it.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, fixed, HUG, literal, paint, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

describe("the Tooltip content component set", () => {
  it("sits on its own page with the Basic demo's text behind a TEXT property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "tooltip-content");
    expect([set?.name, set?.page, set?.textProperties.map((property) => property.name)]).toEqual([
      "Tooltip content",
      "page/tooltip",
      ["Text"],
    ]);
  });

  it("draws the inverted popup, hugging its 12px line inside the density padding, and leaves the arrow unclipped", () => {
    const root = variantRoot(spec, "tooltip-content/content=basic");
    expect(root).toMatchObject({
      sizing: { horizontal: HUG, vertical: HUG },
      limits: { maxWidth: literal(320) },
      clips: false,
      paddingTop: density("row-py"),
      paddingLeft: density("surface-pad-md"),
      cornerRadius: token("radius-md"),
      fill: paint("foreground"),
    });
    expect(root.children[0]).toMatchObject({
      kind: "text",
      characters: "Add to library",
      fontSize: literal(12),
      lineHeight: literal(16),
      color: paint("background"),
      sizing: { horizontal: HUG, vertical: HUG },
    });
  });

  it("turns the arrow -45 and places it by its centre, on the popup's centre and 2px above its bottom edge", () => {
    expect(variantRoot(spec, "tooltip-content/content=basic").children[1]).toMatchObject({
      kind: "frame",
      key: "arrow",
      sizing: { horizontal: fixed(literal(10)), vertical: fixed(literal(10)) },
      cornerRadius: literal(2),
      fill: paint("foreground"),
      rotation: -45,
      pivot: { constraints: { horizontal: "CENTER", vertical: "MAX" }, centerOffset: 0, bottomInset: 2 },
    });
  });
});

describe("the Tooltip (open) component set", () => {
  it("stacks the popup over the ghost icon Button with Info, 4px apart and centred, clipping nothing", () => {
    const root = variantRoot(spec, "tooltip-open/placement=above");
    expect([root.direction, root.itemSpacing, root.counterAlign, root.clips]).toEqual([
      "VERTICAL",
      literal(4),
      "CENTER",
      false,
    ]);
    expect(
      root.children.map((child) =>
        child.kind === "instance" ? [child.key, child.variant, child.properties] : []
      )
    ).toEqual([
      ["content", "tooltip-content/content=basic", undefined],
      ["trigger", "icon-button/variant=ghost,size=icon,state=rest", { swap: { Icon: "icon/Info" } }],
    ]);
  });
});
