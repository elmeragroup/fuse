import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Item } from "./index";
import { itemRootProps } from "./item-root-props";
import { ITEM_TITLE_CLASSES } from "./item-title-classes";
import { itemVariants } from "./item-variants";

describe("itemVariants", () => {
  it("defaults to the default variant and size", () => {
    const classes = itemVariants();
    expect(classes).toContain("border-transparent");
    expect(classes).toContain("gap-3.5");
    expect(classes).toContain("px-4");
    expect(classes).not.toContain("dark:");
  });

  it("resolves each variant and size", () => {
    expect(itemVariants({ variant: "outline" })).toContain("border-border");
    expect(itemVariants({ variant: "muted" })).toContain("bg-muted/50");
    expect(itemVariants({ size: "sm" })).toContain("px-3");
    expect(itemVariants({ size: "xs" })).toContain("in-data-[slot=dropdown-menu-content]:p-0");
  });
});

describe("ITEM_TITLE_CLASSES", () => {
  it("is the Item.Title / Alert.Title face", () => {
    expect(ITEM_TITLE_CLASSES).toContain("font-medium");
    expect(ITEM_TITLE_CLASSES).toContain("line-clamp-1");
    expect(ITEM_TITLE_CLASSES).toContain("underline-offset-4");
  });
});

describe("itemRootProps", () => {
  it("lets a consumer class win a Tailwind conflict with the recipe", () => {
    const tokens = itemRootProps({
      variant: "default",
      size: "sm",
      className: "px-6 bg-card",
    }).className.split(" ");
    expect(tokens).toContain("px-6");
    expect(tokens).toContain("bg-card");
    expect(tokens).not.toContain("px-3");
  });
});

describe("Item.Media and Item.Footer class contracts", () => {
  it("hides and reveals footer mode with the documented class tokens", () => {
    const hidden = renderToStaticMarkup(createElement(Item.Footer, { mode: "hidden" }, "Hidden"));
    const visible = renderToStaticMarkup(createElement(Item.Footer, { mode: "visible" }, "Visible"));
    expect(hidden).toContain("pointer-events-none");
    expect(hidden).toContain("0fr");
    expect(visible).toContain("starting:");
  });
});
