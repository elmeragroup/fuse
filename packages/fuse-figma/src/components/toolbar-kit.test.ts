/**
 * Unit under test: the `Toolbar` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `toolbar-variants.ts`,
 * `styles/inner-corner/toolbar.ts`, `separator-class.ts`, `toolbar.tsx` and the docs Basic demo, and
 * Chromium's layout of the demo with preflight and Fuse's built CSS on 2026-10-27:
 *
 * - Horizontal: the bar is 286.3×42 dense and 328.3×46 comfortable, a 1px border around 4px padding,
 *   its items 4px apart; the File group is 192.8×32 dense; the separator is 1×24 at y 9, 4px short of
 *   the 32px items at each end.
 * - Vertical: the bar is 106.3×119 dense, its items centred across; the separator is 88.3×1 at x 9,
 *   4px short of the widest item, the 96.3px Download button, at each end.
 * - The disabled Delete button reads `aria-disabled="true"` at opacity 0.5, the Button set's disabled
 *   face.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, FILL, fixed, HUG, literal, paint, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const bar = (orientation: string) => variantRoot(spec, `toolbar/orientation=${orientation}`);

/** Each instance's key and variant below a layer, in layer order. */
function instances(layers: readonly ChildLayerSpec[]): readonly (readonly [string, string])[] {
  return layers.flatMap((layer) =>
    layer.kind === "instance"
      ? [[layer.key, layer.variant] as const]
      : layer.kind === "frame"
        ? instances(layer.children)
        : []
  );
}

const GHOST = "button/variant=ghost,size=sm,state=rest,icon=start";
const DISABLED = "button/variant=ghost,size=sm,state=disabled,icon=start";

describe("the Toolbar component set", () => {
  it("sits on its own page, horizontal and vertical", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "toolbar");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Toolbar",
      "page/toolbar",
      [{ name: "orientation", values: ["horizontal", "vertical"] }],
    ]);
  });

  it("draws the bar as a hugging, bordered popover shell whose items sit 4px apart", () => {
    expect([bar("horizontal"), bar("vertical")]).toMatchObject([
      {
        direction: "HORIZONTAL",
        sizing: { horizontal: HUG, vertical: HUG },
        paddingTop: literal(4),
        paddingLeft: literal(4),
        itemSpacing: literal(4),
        cornerRadius: token("radius-lg"),
        fill: paint("popover"),
        stroke: { color: paint("border"), weight: literal(1) },
      },
      { direction: "VERTICAL", sizing: { horizontal: HUG, vertical: HUG }, counterAlign: "CENTER" },
    ]);
  });

  it("holds the File group's ghost buttons, the separator and the disabled Delete button", () => {
    expect([instances(bar("horizontal").children), instances(bar("vertical").children)]).toEqual([
      [
        ["download", GHOST],
        ["duplicate", GHOST],
        ["box", "separator/orientation=vertical"],
        ["delete", DISABLED],
      ],
      [
        ["download-vertical", GHOST],
        ["duplicate-vertical", GHOST],
        ["box", "separator/orientation=horizontal"],
        ["delete-vertical", DISABLED],
      ],
    ]);
    const group = bar("horizontal").children[0];
    expect(group?.kind === "frame" ? group.children[0] : undefined).toMatchObject({
      properties: { text: { Label: "Download" }, swap: { "Start icon": "icon/Download" } },
    });
  });

  it("stretches the separator across the bar, 4px short of the items at each end", () => {
    const separator = (orientation: string) =>
      bar(orientation).children.find((layer) => layer.key === "separator");
    expect([separator("horizontal"), separator("vertical")]).toMatchObject([
      {
        kind: "frame",
        sizing: { horizontal: HUG, vertical: FILL },
        paddingTop: literal(4),
        paddingBottom: literal(4),
        children: [{ kind: "instance", sizing: { horizontal: fixed(literal(1)), vertical: FILL } }],
      },
      {
        kind: "frame",
        sizing: { horizontal: FILL, vertical: HUG },
        paddingLeft: literal(4),
        paddingRight: literal(4),
        children: [{ kind: "instance", sizing: { horizontal: FILL, vertical: fixed(literal(1)) } }],
      },
    ]);
  });

  // `aria-disabled:opacity-50` repeats the disabled face's `disabled:opacity-50`, and its
  // `cursor-not-allowed` draws nothing in a static frame, so the stamp draws no override.
  it("draws the disabled Delete button as the Button set's disabled variant, with no override of its face", () => {
    const deleted = bar("horizontal").children.find((layer) => layer.key === "delete");
    expect(deleted?.kind === "instance" ? deleted.overrides?.map((override) => override.field) : []).toEqual([
      "glyph",
      "textColor",
    ]);
  });
});
