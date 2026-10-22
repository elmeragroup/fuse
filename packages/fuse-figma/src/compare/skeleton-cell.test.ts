/**
 * The HTML the built Fuse Skeleton renders for a cell. The unit under test is the Skeleton
 * renderer. The oracle is Skeleton's public contract and the docs demos' shapes: one empty
 * `<div data-slot="skeleton" aria-hidden="true">` with no role, whose classes carry the consumer's
 * size, `h-4 w-48` for a line and `size-10 rounded-full` for a circle.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { skeleton } from "./skeleton-cell";

describe("the Skeleton renderer", () => {
  it.each([
    ["line", ["h-4", "w-48"]],
    ["circle", ["size-10", "rounded-full"]],
  ])("renders one hidden %s placeholder div with the demo's size classes", (placeholder, sizeClasses) => {
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- `shape` is the set's axis, as the owner named it
    const elements = elementsOf(renderCellHtml(skeleton, { shape: placeholder }));
    expect(
      elements.map((element) => [
        element.name,
        element.attributes.get("data-slot"),
        element.attributes.get("aria-hidden"),
        element.attributes.get("role"),
      ])
    ).toEqual([["div", "skeleton", "true", undefined]]);
    expect(elements[0]?.attributes.get("class")?.split(" ")).toEqual(expect.arrayContaining(sizeClasses));
  });
});
