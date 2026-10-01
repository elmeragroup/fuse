import { describe, expect, it } from "vitest";

import { buttonVariants } from "../components/button/button-variants";
import { cn } from "./cn";
import { controlLabel, controlSize, controlWrap } from "./control-size";

function tokens(classes: string): string[] {
  return classes.split(/\s+/u).filter(Boolean);
}

const SIZES = ["xs", "sm", "md", "lg"] as const;

describe("control size: the wrap fit", () => {
  it.each(SIZES)("relaxes the %s label height to a minimum and adds the wrap inset", (size) => {
    const label = tokens(controlLabel(size, { iconEdge: "include" }));
    const wrap = tokens(controlWrap(size));

    // Everything the label fit paints apart from its height, plus the floor, the inset and
    // wrapping text. The inset is half the height minus one line and the 1px border.
    expect(wrap).not.toContain(`h-(--control-h-${size})`);
    expect(wrap).toContain(`min-h-(--control-h-${size})`);
    expect(wrap).toContain(`py-[calc((var(--control-h-${size})-1lh)/2-1px)]`);
    expect(wrap).toContain("whitespace-normal");
    for (const token of label.filter((item) => item !== `h-(--control-h-${size})`)) {
      expect(wrap, token).toContain(token);
    }
    expect(controlSize({ size, fit: "wrap" })).toBe(controlWrap(size));
  });
});

describe("buttonVariants: the wrap axis", () => {
  const LABEL_SIZES = [
    ["default", "md"],
    ["xs", "xs"],
    ["sm", "sm"],
    ["lg", "lg"],
  ] as const;

  it.each(LABEL_SIZES)("keeps the %s size on the label fit when wrap is off or omitted", (size, control) => {
    const omitted = tokens(buttonVariants({ size }));
    expect(tokens(buttonVariants({ size, wrap: false }))).toEqual(omitted);
    for (const token of tokens(controlLabel(control, { iconEdge: "include" }))) {
      expect(omitted, token).toContain(token);
    }
    expect(omitted).toContain("whitespace-nowrap");
    expect(omitted).not.toContain("whitespace-normal");
  });

  it.each(LABEL_SIZES)("swaps the %s size to the wrap fit, centered, when wrap is on", (size, control) => {
    const wrapped = tokens(buttonVariants({ size, wrap: true }));
    for (const token of tokens(controlWrap(control))) {
      expect(wrapped, token).toContain(token);
    }
    expect(wrapped).not.toContain(`h-(--control-h-${control})`);
    // The size arm's `whitespace-normal` replaces the base `whitespace-nowrap` through the
    // recipe's own merge, so the two never both reach the element.
    expect(wrapped).not.toContain("whitespace-nowrap");
    expect(wrapped).toContain("text-center");
  });

  it("leaves the squares and icon-inline alone whether wrap is on or off", () => {
    for (const size of ["icon", "icon-xs", "icon-sm", "icon-lg", "icon-inline"] as const) {
      expect(buttonVariants({ size, wrap: true })).toBe(buttonVariants({ size }));
      expect(buttonVariants({ size, wrap: true })).not.toContain("whitespace-normal");
    }
  });

  it("lets a consumer className still replace the wrap inset and floor", () => {
    const merged = tokens(cn(buttonVariants({ wrap: true }), "min-h-0 py-0"));
    expect(merged).toContain("min-h-0");
    expect(merged).toContain("py-0");
    expect(merged).not.toContain("min-h-(--control-h-md)");
    expect(merged).not.toContain("py-[calc((var(--control-h-md)-1lh)/2-1px)]");
  });
});
