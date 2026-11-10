import { describe, expect, it } from "vitest";

import { ITEM_TITLE_CLASSES } from "./item-title-classes";

describe("ITEM_TITLE_CLASSES", () => {
  it("is the Item.Title / Alert.Title face", () => {
    expect(ITEM_TITLE_CLASSES).toContain("font-medium");
    expect(ITEM_TITLE_CLASSES).toContain("underline-offset-4");
  });
});
