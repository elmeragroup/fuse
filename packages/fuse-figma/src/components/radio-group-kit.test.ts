/**
 * Unit under test: the `Radio group` set as the build produces it.
 * Oracle: the Figma field each cell must carry, read by hand from `field-variants.ts`,
 * `field-frame-variants.ts`, `selection-item-variants.ts` and `radio-group.tsx`, the docs Basic and
 * Pending demos, and Chromium's layout of the group with preflight and Fuse's built CSS at both
 * densities on 2026-10-27:
 *
 * - The fieldset is `flex flex-col` at `surface-gap-md` (12px dense, 16px comfortable), since it
 *   holds a radio group. The description's `-mt-(--surface-gap-md)` puts it flush under the legend
 *   (legend 0..20, description 20..40 dense), and the group sits one gap below it (52 dense).
 * - Vertical: `flex flex-col gap-(--surface-gap-sm)`, each row stretched to 384px. Horizontal:
 *   `flex flex-wrap gap-(--surface-gap-lg)`, the rows at their own width, the last ending at 201px dense
 *   and 217px comfortable, so on one line.
 * - An invalid Field passes `data-invalid:text-error` to the legend, and Base UI renders the error after
 *   the group.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  frameLayerAt,
  HUG,
  literal,
  outline,
  paint,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { layerAt } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

function cell(orientation: string, state: string) {
  return variantRoot(spec, `radio-group/orientation=${orientation},state=${state}`);
}

describe("the Radio group component set", () => {
  it("sits on the Radio page, vertical and horizontal, at rest, disabled and invalid", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "radio-group");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Radio group",
      "page/radio",
      [
        { name: "orientation", values: ["vertical", "horizontal"] },
        { name: "state", values: ["rest", "disabled", "invalid"] },
      ],
    ]);
  });

  it("stacks the legend and the flush description, then the rows, surface-gap-md apart in the fieldset", () => {
    const root = cell("vertical", "rest");
    expect(root.sizing).toEqual({ horizontal: fixed(literal(384)), vertical: HUG });
    expect(outline(root.children)).toEqual([
      "field-set",
      "  legend-row-flush",
      "    legend-row",
      "      legend -> field-legend/variant=label",
      "    description -> field-description/state=rest",
      "  group",
      "    row-1 -> radio-row/width=fill,checked=on,state=rest",
      "    row-2 -> radio-row/width=fill,checked=off,state=rest",
      "    row-3 -> radio-row/width=fill,checked=off,state=rest",
    ]);
    expect(layerAt(root, ["field-set"])).toMatchObject({ itemSpacing: density("surface-gap-md") });
    expect(layerAt(root, ["field-set", "legend-row-flush"])).toMatchObject({
      itemSpacing: literal(0),
      sizing: { horizontal: FILL, vertical: HUG },
    });
  });

  it("stacks filling rows surface-gap-sm apart, or lays hugging rows surface-gap-lg apart in a row", () => {
    const group = (orientation: string) => frameLayerAt(cell(orientation, "rest"), ["field-set", "group"]);
    const rows = (orientation: string) => {
      const layer = group(orientation);
      const children = layer?.kind === "frame" ? layer.children : [];
      return children.map((child) => [
        child.kind === "icon" ? undefined : child.sizing.horizontal,
        child.kind === "instance" ? child.properties : undefined,
      ]);
    };
    expect([group("vertical"), group("horizontal")]).toMatchObject([
      { direction: "VERTICAL", itemSpacing: density("surface-gap-sm") },
      { direction: "HORIZONTAL", itemSpacing: density("surface-gap-lg"), primaryAlign: "MIN" },
    ]);
    expect([rows("vertical").map(([sizing]) => sizing), rows("horizontal")]).toEqual([
      [FILL, FILL, FILL],
      [
        [HUG, undefined],
        [HUG, { text: { Label: "Spot" } }],
        [HUG, { text: { Label: "Hourly" } }],
      ],
    ]);
  });

  it("disables every row, and shows the error and an `error` legend when invalid", () => {
    expect(
      outline(cell("vertical", "disabled").children).filter((line) => line.includes("-> radio-row"))
    ).toEqual([
      "    row-1 -> radio-row/width=fill,checked=on,state=disabled",
      "    row-2 -> radio-row/width=fill,checked=off,state=disabled",
      "    row-3 -> radio-row/width=fill,checked=off,state=disabled",
    ]);
    const invalid = cell("horizontal", "invalid");
    expect(outline(invalid.children).filter((line) => !line.includes("-> radio-row"))).toEqual([
      "field-set",
      "  legend-row-flush",
      "    legend-row",
      "      legend -> field-legend/variant=label",
      "    description-invalid -> field-description/state=rest",
      "  group",
      "  error -> field-error/state=invalid",
    ]);
    expect(layerAt(invalid, ["field-set", "legend-row-flush", "legend-row", "legend"])).toMatchObject({
      overrides: [{ path: ["text"], field: "textColor", color: paint("error") }],
    });
  });
});
