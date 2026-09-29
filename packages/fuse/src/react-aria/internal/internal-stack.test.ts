import { describe, expect, it } from "vitest";

import { fieldBox, fieldBoxChromeClass, numberFieldGroupClass } from "../../styles/field-box";
import { checkboxVariants } from "./checkbox";
import { composeTailwindRenderProps } from "./compose-tailwind-render-props";
import { fieldGroupVariants } from "./field";

type HoverState = { isHovered: boolean };

function resolveClassName(
  composed: string | ((renderProps: HoverState) => string),
  renderProps: HoverState
): string {
  return composed instanceof Function ? composed(renderProps) : composed;
}

describe("composeTailwindRenderProps", () => {
  it("merges the recipe classes underneath a plain string", () => {
    const composed = composeTailwindRenderProps<HoverState>("px-8", "px-2 rounded-md");
    expect(resolveClassName(composed, { isHovered: false })).toBe("rounded-md px-8");
  });

  it("resolves the render-prop function form before merging", () => {
    const composed = composeTailwindRenderProps<HoverState>(
      (renderProps) => (renderProps.isHovered ? "px-8" : ""),
      "px-2"
    );
    expect(resolveClassName(composed, { isHovered: true })).toBe("px-8");
    expect(resolveClassName(composed, { isHovered: false })).toBe("px-2");
  });
});

describe("fieldGroupVariants", () => {
  it("does not grow a size axis for density (conventions ruling 2)", () => {
    expect(fieldGroupVariants.variantKeys).not.toContain("size");
  });
});

describe("field-box chrome parity", () => {
  // Unit under test: each field box's merged classes. Oracle: the shared chrome they
  // compose, whose tokens field-box.test.ts pins by hand. A consumer class that cancels a
  // chrome token in the merge fails here.
  const tokens = fieldBoxChromeClass.split(" ");

  it("lands every shared chrome token on every field box's computed output", () => {
    const racBox = fieldGroupVariants().split(" ");
    const baseUiBox = fieldBox({ box: "control" }).split(" ");
    const numberFieldBox = numberFieldGroupClass.split(" ");
    for (const token of tokens) {
      expect(racBox, `interim tier lost ${token}`).toContain(token);
      expect(baseUiBox, `base-ui tier lost ${token}`).toContain(token);
      expect(numberFieldBox, `NumberField group lost ${token}`).toContain(token);
    }
  });

  it("leaves no field box a second radius or elevation rung to drift on", () => {
    for (const rendered of [fieldGroupVariants(), fieldBox({ box: "control" }), numberFieldGroupClass]) {
      expect(rendered.match(/(?:^|\s)rounded-\S+/gu)).toHaveLength(1);
      expect(rendered.match(/(?:^|\s)shadow-\S+/gu)).toHaveLength(1);
    }
  });
});

describe("checkboxVariants", () => {
  it("keeps the private recipe on role tokens after retokenization", () => {
    const { base, box, icon } = checkboxVariants({ isSelected: true });
    const rendered = `${base()} ${box()} ${icon()}`;
    expect(rendered).not.toContain("theme(colors");
    expect(rendered).not.toContain("destructive");
    expect(rendered).toContain("var(--primary)");
  });

  it("swaps the reference's destructive vocabulary for error", () => {
    expect(checkboxVariants({ isInvalid: true }).box()).toContain("var(--error)");
  });
});
