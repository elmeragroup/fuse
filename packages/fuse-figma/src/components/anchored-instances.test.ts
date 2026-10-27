/**
 * Unit under test: the built kit's absolute MAX × MIN instances and the mains they show. Oracle: probe
 * W5-P14b, where a real file kept a MAX instance's end inset through a density switch that resized it
 * only where its main is auto layout (the Icon button moved from x 400 to 396 in a 448px popup), while
 * a plain frame whose bound size changed by mode kept its x and drifted to a 12px end inset. The build
 * has no rule that refuses such an instance, since every box it builds is auto layout
 * (`DirectionSpec` has no `NONE`). This test pins that for every MAX × MIN instance, and lists them,
 * so a new one, or a main without auto layout, forces that rule to be written.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** Every instance layer at or below these layers. */
function instancesIn(
  layers: readonly ChildLayerSpec[]
): readonly Extract<ChildLayerSpec, { kind: "instance" }>[] {
  return layers.flatMap((layer) =>
    layer.kind === "instance" ? [layer] : layer.kind === "frame" ? instancesIn(layer.children) : []
  );
}

describe("absolute MAX × MIN instances", () => {
  it("show only mains with auto layout, which keep the end inset as density resizes them (W5-P14b)", () => {
    const anchored = spec.componentSets.flatMap(({ variants }) =>
      variants.flatMap((variant) =>
        instancesIn(variant.root.children)
          .filter((layer) => layer.absolute?.constraints.vertical === "MIN")
          .map((layer) => {
            const main = variantRoot(spec, layer.variant);
            return [variant.key, layer.variant, main.direction] as const;
          })
      )
    );
    expect(anchored).toEqual([
      ["dialog-content/content=basic", "icon-button/variant=ghost,size=icon-sm,state=rest", "HORIZONTAL"],
      [
        "dialog-content/content=footer-close",
        "icon-button/variant=ghost,size=icon-sm,state=rest",
        "HORIZONTAL",
      ],
    ]);
  });
});
