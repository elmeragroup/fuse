/**
 * Unit under test: the built kit's absolute instances at their parent's end, and the frames that
 * hold them there. Oracles: CSS 2.1 §10.3.7, under which Dialog's and Sheet's `absolute top-4
 * right-4` closes keep 16px from the right and top whatever their size, and Toast's `absolute top-2
 * right-2` close keeps 8px from its root's right and top edges, since the root is its containing
 * block and draws no border; probes PG14 and PG14b, under which an instance at MAX in an instance of
 * the outer component keeps its `x` when a density switch resizes it, so its right inset drifts by
 * the change, where in the outer component's own main it keeps the inset (as W5-P14b found); and
 * probe PG16, under which an absolute auto layout frame STRETCH across the parent, aligned to its
 * end, padded by the offsets on the right and top and hugging its height, keeps the close in its flow
 * that far from both edges.
 *
 * The closes bind their size to `control-h-sm`, which density changes, so each sits in such a frame.
 * The Sidebar menu badge stays at MAX itself: the capture measured it one width in every mode, and
 * W5-P14b holds for a main with auto layout, which every box the kit builds is (`DirectionSpec` has
 * no `NONE`). A new instance at an end, or one that leaves its wrapper, changes the lists.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, instancesIn, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { walkLayers } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

describe("absolute instances at their parent's end", () => {
  it("sit in a wrapper that pads their CSS offsets where density resizes them (PG14b, PG16)", () => {
    const wrapped = spec.componentSets.flatMap(({ variants }) =>
      variants.flatMap((variant) =>
        walkLayers(variant.root).flatMap((layer) =>
          layer.kind === "frame" &&
          layer.children.some((child) => child.kind === "instance" && child.placement === undefined) &&
          layer.placement?.kind === "edges"
            ? [
                [
                  variant.key,
                  layer.key,
                  layer.placement.horizontal,
                  layer.placement.vertical,
                  layer.primaryAlign,
                  [layer.paddingTop, layer.paddingRight, layer.paddingBottom, layer.paddingLeft].map(
                    (padding) => (padding.kind === "literal" ? padding.value : padding)
                  ),
                  layer.sizing.vertical.kind,
                  layer.children.map((child) => child.key),
                ] as const,
              ]
            : []
        )
      )
    );
    const close = (variant: string, key: string, inset = 16) =>
      [
        variant,
        `${key} placement`,
        { kind: "stretch", start: 0, end: 0 },
        { kind: "start", start: 0 },
        "MAX",
        [inset, inset, 0, 0],
        "hug",
        [key],
      ] as const;
    expect(wrapped).toEqual([
      close("dialog-content/content=basic", "close"),
      close("dialog-content/content=footer-close", "close"),
      close("sheet-content/side=right", "corner-close"),
      ...["neutral", "info", "success", "warning", "error", "loading"].map((status) =>
        close(`toast/status=${status}`, "close", 8)
      ),
    ]);
  });

  it("keep their own MAX place only where one width in every mode, in a main with auto layout (W5-P14b)", () => {
    const placed = spec.componentSets.flatMap(({ variants }) =>
      variants.flatMap((variant) =>
        instancesIn(variant.root.children)
          .filter((layer) => layer.placement?.horizontal.kind === "end")
          .map(
            (layer) =>
              [
                variant.key,
                layer.key,
                layer.sizing.horizontal.kind,
                variantRoot(spec, layer.variant).direction,
              ] as const
          )
      )
    );
    expect(placed).toEqual([
      ["sidebar-menu-item-with-badge/isActive=false", "badge", "hug", "HORIZONTAL"],
      ["sidebar-menu-item-with-badge/isActive=true", "badge", "hug", "HORIZONTAL"],
    ]);
  });
});
