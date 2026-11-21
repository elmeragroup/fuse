/**
 * An open Select whose trigger fills its column, on the in-memory file in `fake-figma.ts` the plugin
 * applied the whole kit to. Unit under test: the sizing and minimum Apply writes on the trigger and
 * popup instances of `Select (open)` at `width=fill`. Oracle, written by hand from Fuse's Select
 * CSS: the trigger is `w-full` of the column and the popup `w-(--anchor-width) min-w-36`, so both
 * fill the column and the popup keeps a 144px minimum. The fake does not lay out a filling layer,
 * so the test reads the fields Apply writes, and `select-popup-width.chromium.test.ts` compares the
 * widths the spec gives them with Chromium's.
 */
import { describe, expect, it } from "vitest";

import { appliedFile, kitPage, setOn } from "./kit-fixture.ts";

describe("the open Select at width=fill on an applied file", () => {
  it("writes FILL on the trigger and the popup, and a 144px minWidth on the popup", async () => {
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/select"), "Select (open)");
    const main = set.children.find((child) => child.name === "side=bottom, size=default, width=fill");
    if (main?.type !== "COMPONENT") {
      throw new Error("the Select (open) set holds no side=bottom, size=default, width=fill variant");
    }
    expect(
      main.children.map((child) => [
        child.name,
        "layoutSizingHorizontal" in child ? child.layoutSizingHorizontal : "none",
        "minWidth" in child ? child.minWidth : "none",
      ])
    ).toEqual([
      ["select-trigger", "FILL", null],
      ["select-content", "FILL", 144],
    ]);
  });
});
