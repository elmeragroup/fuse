/**
 * Unit under test: the shared menu sets, `Menu group label` and `Menu separator`, as the build
 * produces them. Oracle: the Figma field each cell must carry, read by hand from
 * `menu-row-classes.ts` and `select-variants.ts`, and the widths Chromium measured on the compare page
 * on 2026-10-25: the docs Groups demo's caption 136px wide in its 144px popup, and a separator 144px
 * wide in a 144px host that pads 4px across.
 *
 * - The caption is `text-xs px-(--row-px) py-1.5 text-muted-foreground`: 12px type on a 16px line,
 *   inset by `row-px` across and 6px down, in `muted-foreground`. Dropdown menu's adds `font-medium`,
 *   and its inset form `data-inset:pl-[calc(var(--row-px)+1.5rem)]`, the code syntax of the synced
 *   `row-indicator-room`. Chromium measured each Dropdown caption 136px wide in a 144px popup.
 * - The separator is `-mx-(--surface-pad-sm) my-1 h-px bg-border`: a 1px `border` rule, its container's
 *   width plus `surface-pad-sm`, 4px at both densities, on each side.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  HUG,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

describe("the Menu group label component set", () => {
  it("draws the plain caption and Dropdown menu's two on the Select page, its text a property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "menu-group-label");
    expect([set?.name, set?.page, set?.axes, set?.textProperties]).toEqual([
      "Menu group label",
      "page/select",
      [{ name: "kind", values: ["plain", "menu", "menu inset"] }],
      [{ name: "Label", defaultValue: "Citrus" }],
    ]);
  });

  it.each([
    ["menu", density("row-px")],
    ["menu inset", density("row-indicator-room")],
  ])("sets Dropdown menu's %s caption in Medium, padded at its start by %o", (kind, start) => {
    const root = variantRoot(spec, `menu-group-label/kind=${kind}`);
    expect([root.sizing, root.paddingLeft, root.paddingRight]).toEqual([
      { horizontal: fixed(literal(136)), vertical: HUG },
      start,
      density("row-px"),
    ]);
    expect(root.children).toEqual([
      expect.objectContaining({ kind: "text", fontStyle: "Medium", color: paint("muted-foreground") }),
    ]);
  });

  it("insets the muted caption as wide as a Select group gives it", () => {
    const root = variantRoot(spec, "menu-group-label/kind=plain");
    expect(root).toMatchObject({
      name: "menu-group-label",
      sizing: { horizontal: fixed(literal(136)), vertical: HUG },
      paddingTop: literal(6),
      paddingRight: density("row-px"),
      paddingBottom: literal(6),
      paddingLeft: density("row-px"),
      fill: undefined,
    });
    expect(root.children).toEqual([
      {
        kind: "text",
        key: "label",
        name: "label",
        characters: "Citrus",
        textProperty: "Label",
        fontFamily: token("font-sans"),
        fontStyle: "Regular",
        fontSize: literal(12),
        lineHeight: literal(16),
        color: paint("muted-foreground"),
        sizing: { horizontal: FILL, vertical: HUG },
        align: { horizontal: "LEFT", vertical: "TOP" },
      },
    ]);
  });
});

describe("the Menu separator component set", () => {
  it("draws a 1px border rule as wide as a popup that pads 4px across", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "menu-separator");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Menu separator",
      "page/select",
      [{ name: "size", values: ["default"] }],
    ]);
    expect(variantRoot(spec, "menu-separator/size=default")).toMatchObject({
      name: "menu-separator",
      sizing: { horizontal: fixed(literal(144)), vertical: fixed(literal(1)) },
      fill: paint("border"),
      children: [],
    });
  });
});
