import { describe, expect, it } from "vitest";

import { composeTailwindRenderProps } from "./compose-tailwind-render-props";

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
