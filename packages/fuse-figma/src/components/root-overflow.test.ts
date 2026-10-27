/**
 * Unit under test: the roots of the sets whose layers draw a ring at the root's edge, as the build
 * produces them. Oracle: CSS Overflow 3 §3, where `overflow` is `visible` initially and none of these
 * roots' classes set it, so CSS paints a child's focus or invalid ring past the root's edge; and the
 * real-file compare of 2026-10-27 (`compare-real-1`), whose Figma cells cut those rings at a clipping
 * root's edges: the radio's at a Radio row's left and top (`cells/p16-c65`), the control's at a Text,
 * Select, Textarea and Number field's sides, and the first radio's at a Radio group's left. Each root
 * casts no shadow of its own, so it needs no clip to draw one (PR2).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let built: BuiltSets;

beforeAll(async () => {
  built = await builtKit();
});

/** The sets whose roots CSS leaves unclipped and whose layers draw a ring at their edge. */
const UNCLIPPED = [
  "radio-row",
  "radio-group",
  "toggle-group",
  "text-field",
  "select-field",
  "textarea-field",
  "number-field",
  "avatar-group",
] as const;

/** The same keys, to look a set up by. */
const KEYS: ReadonlySet<string> = new Set(UNCLIPPED);

describe("a root that CSS leaves unclipped, around a ring at its edge", () => {
  it.each(UNCLIPPED)("leaves %s's layers unclipped in every variant", (key) => {
    const set = built.spec.componentSets.find((candidate) => candidate.key === key);
    expect(set?.variants.map((variant) => variant.root.clips)).toEqual(set?.variants.map(() => false));
  });

  it("records no ring that a root cuts at its top or bottom in these sets", () => {
    const names = new Set(built.spec.componentSets.filter((set) => KEYS.has(set.key)).map((set) => set.name));
    expect(
      built.coverage.filter((row) => names.has(row.component) && row.detail.includes("the shadow reaches"))
    ).toEqual([]);
  });
});
