import { describe, expect, it } from "vitest";

import { mergeClassName } from "./merge-class-name";

type HoverState = { isHovered: boolean };

function resolveClassName(
  composed: string | ((renderProps: HoverState) => string),
  renderProps: HoverState
): string {
  return composed instanceof Function ? composed(renderProps) : composed;
}

describe("mergeClassName", () => {
  it.each([
    [
      "merges the recipe classes underneath a plain string",
      "px-8",
      "px-2 rounded-md",
      false,
      "rounded-md px-8",
    ],
    [
      "resolves the state callback before merging (hovered)",
      (renderProps: HoverState) => (renderProps.isHovered ? "px-8" : ""),
      "px-2",
      true,
      "px-8",
    ],
    [
      "resolves the state callback before merging (not hovered)",
      (renderProps: HoverState) => (renderProps.isHovered ? "px-8" : ""),
      "px-2",
      false,
      "px-2",
    ],
  ] as const)("%s", (_title, className, recipe, isHovered, expected) => {
    const composed = mergeClassName<HoverState>(className, recipe);
    expect(resolveClassName(composed, { isHovered })).toBe(expected);
  });
});
