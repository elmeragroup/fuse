/**
 * Unit under test: the `Toggle group` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `toggle-group-variants.ts`,
 * `toggle-group.tsx` and the docs Multiple demo, and Chromium's layout of the demo with preflight and
 * Fuse's built CSS on 2026-10-27:
 *
 * - At every variant, size and density the items sit 8px apart, `--gap` 2 from the root's inline
 *   style times the 4px spacing unit, and the root hugs them: 188×36 for the default variant at the
 *   default size dense, 194×36 for the outline one, as tall as its items.
 * - Bold is pressed, Italic and Underline are not.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, HUG, literal, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const group = (variant: string, size: string) =>
  variantRoot(spec, `toggle-group/variant=${variant},size=${size}`);

describe("the Toggle group component set", () => {
  it("sits on the Toggle page at the Toggle's two variants and four sizes", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "toggle-group");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Toggle group",
      "page/toggle",
      [
        { name: "variant", values: ["default", "outline"] },
        { name: "size", values: ["default", "xs", "sm", "lg"] },
      ],
    ]);
  });

  it("hugs a row of items 8px apart, the gap the root's inline --gap sets", () => {
    const roots = ["default", "outline"].flatMap((variant) =>
      ["default", "xs", "sm", "lg"].map((size) => group(variant, size))
    );
    expect(
      new Set(roots.map((root) => JSON.stringify([root.direction, root.sizing, root.itemSpacing])))
    ).toEqual(new Set([JSON.stringify(["HORIZONTAL", { horizontal: HUG, vertical: HUG }, literal(8)])]));
  });

  it("holds the Multiple demo's toggles at the group's variant and size, Bold pressed", () => {
    expect(
      group("outline", "sm").children.map((child) =>
        child.kind === "instance" ? [child.key, child.variant, child.properties] : []
      )
    ).toEqual([
      ["bold", "toggle/variant=outline,size=sm,state=rest,pressed=on,icon=none", { text: { Label: "Bold" } }],
      [
        "italic",
        "toggle/variant=outline,size=sm,state=rest,pressed=off,icon=none",
        { text: { Label: "Italic" } },
      ],
      [
        "underline",
        "toggle/variant=outline,size=sm,state=rest,pressed=off,icon=none",
        { text: { Label: "Underline" } },
      ],
    ]);
  });

  // The spaced group's items draw as Toggles do: the group's `item` classes paint only in the
  // segmented look or a focused item, which no cell shows.
  it("draws each item as its Toggle variant, with no override", () => {
    expect(
      group("outline", "default").children.map((child) =>
        child.kind === "instance" ? child.overrides : "frame"
      )
    ).toEqual([undefined, undefined, undefined]);
  });
});
