/**
 * Unit under test: the `showArrow=true` variant of `Popover content` through Apply, on the in-memory
 * file in `fake-figma.ts`, in an instance resized wider than the popup's `w-72`. Oracle: the Fuse
 * Popover's CSS, under which Base UI centres the arrow on the popup it hangs from, whatever the
 * popup's width, and the instance stands for that popup. So once the instance is 400px wide, the
 * frame that draws the popup's box spans it, and the arrow's centre sits 200px from its left edge.
 * The fake lays out no FILL length (rule 32), so the test reads the frame's span from its sizing:
 * FILL across a column takes the column's width, as a real file showed a FILL frame 300 wide in a
 * fixed 300-wide column (NH), where a FIXED frame keeps its 288 at the instance's left edge. The
 * arrow's centre is read from its `x`, its width and its parent, the instance root it hangs in.
 */
import { describe, expect, it } from "vitest";

import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage, setOn } from "./kit-fixture.ts";

/** The width the test resizes the instance to, wider than the popup's 288px. */
const RESIZED = 400;

describe("a Popover content instance with the arrow", () => {
  it("keeps the popup's frame spanning the instance under the arrow once the instance resizes", async () => {
    const { kit } = await kitFixture();
    const key = kit.componentSets
      .find((each) => each.key === "popover-content")
      ?.variants.find((each) => each.properties.showArrow === "true")?.key;
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/popover"), "Popover content");
    const variant = set.children.find((child) => key !== undefined && keyOf(child) === key);
    if (variant?.type !== "COMPONENT") {
      throw new Error("Popover content holds no showArrow=true variant");
    }
    const instance = variant.createInstance();
    instance.resize(RESIZED, instance.height);
    const frames = instance.children.filter((child) => child.type === "FRAME");
    const popup = frames.find((child) => child.layoutPositioning !== "ABSOLUTE");
    const arrow = frames.find((child) => child.layoutPositioning === "ABSOLUTE");
    if (popup?.type !== "FRAME" || arrow?.type !== "FRAME") {
      throw new Error("the instance holds no popup frame beside an absolute arrow");
    }
    expect([instance.width, instance.layoutMode, popup.x, popup.layoutSizingHorizontal]).toEqual([
      RESIZED,
      "VERTICAL",
      0,
      "FILL",
    ]);
    expect(arrow.x + arrow.width / 2).toBeCloseTo(RESIZED / 2, 3);
  });
});
