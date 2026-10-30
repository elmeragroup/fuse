import { describe, expect, it } from "vitest";

import { comboboxChipsVariants } from "../../components/combobox/combobox-variants";
import {
  fieldBox,
  fieldBoxChromeClass,
  inputGroupRootClass,
  numberFieldGroupClass,
} from "../../styles/field-box";
import { fieldReads, fieldSize } from "../../styles/field-size";
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
  it.each([
    [
      "merges the recipe classes underneath a plain string",
      "px-8",
      "px-2 rounded-md",
      false,
      "rounded-md px-8",
    ],
    [
      "resolves the render-prop function form before merging (hovered)",
      (renderProps: HoverState) => (renderProps.isHovered ? "px-8" : ""),
      "px-2",
      true,
      "px-8",
    ],
    [
      "resolves the render-prop function form before merging (not hovered)",
      (renderProps: HoverState) => (renderProps.isHovered ? "px-8" : ""),
      "px-2",
      false,
      "px-2",
    ],
  ] as const)("%s", (_title, className, recipe, isHovered, expected) => {
    const composed = composeTailwindRenderProps<HoverState>(className, recipe);
    expect(resolveClassName(composed, { isHovered })).toBe(expected);
  });

  // RAC's mergeProps lets a callback className replace a context-supplied one, so the
  // result must be a function even when the consumer passes a string or nothing.
  it.each([
    ["a string", "px-8"],
    ["undefined", undefined],
  ] as const)("returns a callback for %s className", (_title, className) => {
    expect(composeTailwindRenderProps<HoverState>(className, "px-2")).toBeTypeOf("function");
  });
});

describe("fieldGroupVariants", () => {
  it.each(["default", "sm"] as const)("writes the %s field size on the box", (size) => {
    // Oracle: the box writes, which field-size.test.ts pins by hand.
    expect(fieldGroupVariants({ size }).split(" ")).toEqual(
      expect.arrayContaining(fieldSize({ size }).box().split(" "))
    );
  });

  it("reads the box height from the field size", () => {
    expect(fieldGroupVariants().split(" ")).toContain(fieldReads.height());
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
    const inputGroupBox = inputGroupRootClass.split(" ");
    const chipsBox = comboboxChipsVariants().chips().split(" ");
    for (const token of tokens) {
      expect(racBox, `interim tier lost ${token}`).toContain(token);
      expect(baseUiBox, `base-ui tier lost ${token}`).toContain(token);
      expect(numberFieldBox, `NumberField group lost ${token}`).toContain(token);
      expect(inputGroupBox, `InputGroup root lost ${token}`).toContain(token);
      // The chips box pads its chips inside the border, so it publishes its own inner corner
      // (`chipsShellClass`) over the shell's.
      if (!token.startsWith("[--shell-inner:")) {
        expect(chipsBox, `Combobox chips box lost ${token}`).toContain(token);
      }
    }
  });

  it("leaves no field box a second radius or elevation rung to drift on", () => {
    for (const rendered of [
      fieldGroupVariants(),
      fieldBox({ box: "control" }),
      numberFieldGroupClass,
      inputGroupRootClass,
      comboboxChipsVariants().chips(),
    ]) {
      expect(rendered.match(/(?:^|\s)rounded-\S+/gu)).toHaveLength(1);
      expect(rendered.match(/(?:^|\s)shadow-\S+/gu)).toHaveLength(1);
    }
  });
});
