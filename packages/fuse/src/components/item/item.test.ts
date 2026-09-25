import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { selfFocusRingClass } from "../../styles/utils";
import { Item } from "./index";
import { ItemRootElement } from "./item-markup";
import { ITEM_TITLE_CLASSES } from "./item-title-classes";
import { itemVariants } from "./item-variants";

describe("itemVariants", () => {
  it("defaults to the default variant and size", () => {
    const classes = itemVariants();
    expect(classes).toContain("border-transparent");
    expect(classes).toContain("gap-3.5");
    expect(classes).toContain("px-4");
  });

  it("resolves each variant and size", () => {
    expect(itemVariants({ variant: "outline" })).toContain("border-border");
    expect(itemVariants({ variant: "muted" })).toContain("bg-muted/50");
    expect(itemVariants({ size: "sm" })).toContain("px-3");
    expect(itemVariants({ size: "xs" })).toContain("in-data-[slot=dropdown-menu-content]:p-0");
  });

  it("composes the shared self focus ring and never a dark variant", () => {
    const classes = itemVariants();
    // Oracle: the shared focus recipe, which utils.test.ts pins by hand.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
    expect(classes).not.toContain("dark:");
  });
});

describe("ITEM_TITLE_CLASSES", () => {
  it("is the Item.Title / Alert.Title face", () => {
    expect(ITEM_TITLE_CLASSES).toContain("font-medium");
    expect(ITEM_TITLE_CLASSES).toContain("line-clamp-1");
    expect(ITEM_TITLE_CLASSES).toContain("underline-offset-4");
  });
});

describe("ItemRootElement", () => {
  it("matches Item.Root markup outside a group when no render prop is passed", () => {
    const props = {
      variant: "outline" as const,
      size: "sm" as const,
      role: "alert",
      className: "bg-card",
      children: "Sync delayed",
    };
    // Oracle: public Item.Root. ItemRootElement is the server-rendered twin Alert uses.
    const oracle = renderToStaticMarkup(createElement(Item.Root, props));
    expect(renderToStaticMarkup(createElement(ItemRootElement, props))).toBe(oracle);
  });
});

describe("Item.Media and Item.Footer class contracts", () => {
  it("emits image variant without a dark class", () => {
    const html = renderToStaticMarkup(createElement(Item.Media, { variant: "image" }, "Portrait"));
    expect(html).toContain('data-variant="image"');
    expect(html).not.toContain("dark:");
  });

  it("hides and reveals footer mode with the documented class tokens", () => {
    const hidden = renderToStaticMarkup(createElement(Item.Footer, { mode: "hidden" }, "Hidden"));
    const visible = renderToStaticMarkup(createElement(Item.Footer, { mode: "visible" }, "Visible"));
    expect(hidden).toContain("pointer-events-none");
    expect(hidden).toContain("0fr");
    expect(visible).toContain("starting:");
  });
});
