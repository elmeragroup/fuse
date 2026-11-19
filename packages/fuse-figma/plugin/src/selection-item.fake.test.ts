/**
 * Selection item on a file the plugin applied the whole kit to, on the in-memory file in
 * `fake-figma.ts`. Unit under test: the kit's Selection item set through Apply and Plan. Oracles,
 * written by hand from the docs default demo's CSS and the fake's rule 61: the shell is a grid of
 * `auto minmax(0, 1fr)` columns, a HUG and a FLEX track, and one row of its two items, which its
 * `<label>`, a `display: contents` element, hands it (CSS Display 3 §2.5), the control slot in row
 * 0, column 0 and the text cluster in column 1, each placed row by row in layer order under
 * ROW_AUTO_FLOW; the control slot sits at its cell's start and hugs both ways (`self-start`), and the
 * cluster fills its column's width, since its width is `auto` under the grid's stretch, and hugs its
 * height (`self-start`); the control slot's `box-content` height of one first line sits inside its
 * 14px paddings, so its inner `content` frame takes the height, bound to `label-line-snug`, and the
 * slot hugs it; and a Plan after the Apply lists nothing.
 */
import { describe, expect, it } from "vitest";

import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

describe("Selection item on an applied file", () => {
  it("lays its row out as a grid of its control and its text, and the next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/selection-item"), "Selection item");
    const [row] = set.children;
    if (row?.type !== "COMPONENT") {
      throw new Error("the Selection item set holds no variant");
    }
    expect([row.layoutMode, row.gridItemsPositioning, row.gridColumnSizes, row.gridRowSizes]).toEqual([
      "GRID",
      "ROW_AUTO_FLOW",
      [
        { type: "HUG", value: 1 },
        { type: "FLEX", value: 1 },
      ],
      [{ type: "HUG", value: 1 }],
    ]);
    expect(
      row.children.map((child) =>
        "gridRowAnchorIndex" in child
          ? [
              keyOf(child),
              child.gridRowAnchorIndex,
              child.gridColumnAnchorIndex,
              child.layoutSizingHorizontal,
              child.layoutSizingVertical,
            ]
          : []
      )
    ).toEqual([
      ["label/control", 0, 0, "HUG", "HUG"],
      ["label/cluster", 0, 1, "FILL", "HUG"],
    ]);
    const control = row.children[0];
    const content = control !== undefined && "children" in control ? control.children[0] : undefined;
    const lines = (await file.figma.variables.getLocalVariablesAsync()).find(
      (variable) => variable.name === "label-line-snug"
    );
    expect([
      control !== undefined && "paddingTop" in control ? [control.paddingTop, control.paddingBottom] : [],
      content === undefined ? undefined : keyOf(content),
      content !== undefined && "layoutSizingVertical" in content ? content.layoutSizingVertical : undefined,
      content?.boundVariables?.height?.id,
    ]).toEqual([[14, 14], "content", "FIXED", lines?.id]);
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});
