/**
 * Unit under test: `drawsAtOwnWidth`, the in-place diff's reading of a filling text in an instance
 * that hugs. Oracle: probe PH2, where Figma drew a FILL text that is a direct child of an instance root
 * set to HUG across at the text's own width, as a hugging text draws, and the CSS box model, where a
 * text deeper down sizes against the box around it, which the instance's hug does not reach.
 */
import { describe, expect, it } from "vitest";

import { FILL, fixed, HUG, literal } from "../../test/built-kit";
import { drawsAtOwnWidth } from "./hugging-rows";
import type { SizingSpec } from "./kit-spec";

const HUGGING: SizingSpec = { horizontal: HUG, vertical: HUG };
const FILLING: SizingSpec = { horizontal: FILL, vertical: HUG };

describe("a text that fills its variant's row, in an instance", () => {
  it("draws at its own width as the hugging text in place, where it is a direct child of a root that hugs", () => {
    expect(drawsAtOwnWidth(HUGGING, ["label"], HUGGING, FILLING)).toBe(true);
  });

  it.each([
    ["sits below a frame", HUGGING, ["frame", "label"], HUGGING, FILLING],
    [
      "sits in a root that does not hug",
      { horizontal: fixed(literal(120)), vertical: HUG },
      ["label"],
      HUGGING,
      FILLING,
    ],
    ["differs down the text", HUGGING, ["label"], { horizontal: HUG, vertical: fixed(literal(20)) }, FILLING],
    ["fills in place too", HUGGING, ["label"], FILLING, FILLING],
  ] as const)("stays a difference where it %s", (_case, root, path, inPlace, variant) => {
    expect(drawsAtOwnWidth(root, path, inPlace, variant)).toBe(false);
  });
});
