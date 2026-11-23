/**
 * `reconcileKit` with the one-variant kit of `button-kit-fixture.ts` on the in-memory file in
 * `fake-figma.ts`, for a variant whose root strokes a dashed border or some of its sides. Each
 * suite's comment names the real-file reading its expectations follow.
 */
import { describe, expect, it } from "vitest";

import type { StrokeSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, fixture, kitWithRoot, literal, RELAYOUT } from "./button-kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

// Unit under test: `reconcileKit` on a variant whose root strokes a dashed border, as the dashed
// Empty does. Oracle: the fake's rule 27, after what a real file read on 2026-10-22 (PD): a dash
// pattern sits apart from the stroke's paints, so the color binding the stroke takes keeps it, a new
// pattern replaces it, and `[]` clears it. The pattern matches only with the same lengths, and the
// next Plan lists nothing.
describe("a variant whose root strokes a dashed border", () => {
  const SOLID_STROKE: StrokeSpec = {
    color: { kind: "variable", variable: { collection: "Fuse tokens", name: "background" } },
    weight: literal(1),
  };
  const stroked = (stroke: StrokeSpec) => kitWithRoot((root) => ({ ...root, stroke }));
  const DASHED = stroked({ ...SOLID_STROKE, dashPattern: [3, 2] });
  const SOLID = stroked(SOLID_STROKE);

  it("draws the dashes over the bound color in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, DASHED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, DASHED, false)).toEqual({ changes: [], warnings: [] });
    const root = await buttonVariant(file);
    expect(root.dashPattern).toEqual([3, 2]);
    expect(root.strokes).toMatchObject([
      { type: "SOLID", boundVariables: { color: { id: file.variable("Fuse tokens", "background").id } } },
    ]);
  });

  it("plans a pattern a designer changed back to the kit's, and clears it for a solid stroke", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, DASHED, true);
    file.reopen();
    (await buttonVariant(file)).dashPattern = [4, 4];
    expect((await reconcileKit(file.figma, DASHED, false)).changes).toEqual([
      "Button / size=md: dashPattern → 3, 2 (holds 4, 4)",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, DASHED, true);
    file.reopen();
    expect((await reconcileKit(file.figma, SOLID, false)).changes).toEqual([
      "Button / size=md: dashPattern → none (holds 3, 2)",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, SOLID, true);
    file.reopen();
    expect(await reconcileKit(file.figma, SOLID, false)).toEqual({ changes: [], warnings: [] });
    expect((await buttonVariant(file)).dashPattern).toEqual([]);
  });
});

// Unit under test: `reconcileKit` on a variant whose root strokes some sides, as the Sidebar
// container's `border-r` and a sub menu's `border-l` do. Oracle: the fake's rules 46 and 49, after
// what a real file read on 2026-10-23 and 2026-10-25 (N9, PS, PS2): each side holds its own weight,
// `strokeWeight` reads mixed, the stroke counts in the layout, each side taking room on its own side,
// and a first 0 on a new variant's weight sets every side. One Apply writes the sides, the next Plan
// lists nothing, and a side a designer changed plans the four weights back as one change.
describe("a variant whose root strokes some sides", () => {
  const edged = (sides: { top: number; right: number; bottom: number; left: number }) =>
    kitWithRoot((root) => ({
      ...root,
      stroke: {
        color: { kind: "variable", variable: { collection: "Fuse tokens", name: "background" } },
        sides,
      },
    }));
  const LEFT_EDGE = edged({ top: 0, right: 0, bottom: 0, left: 1 });
  const RIGHT_EDGE = edged({ top: 0, right: 1, bottom: 0, left: 0 });
  const weights = (root: ComponentNode) => [
    root.strokeTopWeight,
    root.strokeRightWeight,
    root.strokeBottomWeight,
    root.strokeLeftWeight,
    root.strokeAlign,
    root.strokesIncludedInLayout,
  ];

  it.each([
    ["left", LEFT_EDGE, [0, 0, 0, 1]],
    ["right", RIGHT_EDGE, [0, 1, 0, 0]],
  ] as const)(
    "writes a new variant's %s edge in the layout in one Apply, and the next Plan lists nothing",
    async (_edge, kit, sides) => {
      const { file } = fixture("Roboto");
      await reconcileKit(file.figma, kit, true);
      file.reopen();
      expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
      expect(weights(await buttonVariant(file))).toEqual([...sides, "INSIDE", true]);
    }
  );

  // A table row's rule in a table that collapses its borders sits on the grid line between rows
  // (CSS 2.1 §17.6.2), so the row keeps its height: the stroke stays out of the layout.
  const RULE = kitWithRoot((root) => ({
    ...root,
    stroke: {
      color: { kind: "variable", variable: { collection: "Fuse tokens", name: "background" } },
      sides: { top: 0, right: 0, bottom: 1, left: 0 },
      inLayout: false,
    },
  }));

  it("writes a row rule out of the layout in one Apply, and plans it back out where a designer counted it", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, RULE, true);
    file.reopen();
    expect(await reconcileKit(file.figma, RULE, false)).toEqual({ changes: [], warnings: [] });
    expect(weights(await buttonVariant(file))).toEqual([0, 0, 1, 0, "INSIDE", false]);
    (await buttonVariant(file)).strokesIncludedInLayout = true;
    expect((await reconcileKit(file.figma, RULE, false)).changes).toEqual([
      "Button / size=md: strokesIncludedInLayout → false",
      ...RELAYOUT,
    ]);
  });

  it("writes the left edge back in one Apply from every side at 0, as the owner's file held it (PS2)", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, LEFT_EDGE, true);
    file.reopen();
    (await buttonVariant(file)).strokeLeftWeight = 0;
    expect((await reconcileKit(file.figma, LEFT_EDGE, false)).changes).toEqual([
      "Button / size=md: stroke weights → 0 0 0 1",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, LEFT_EDGE, true);
    file.reopen();
    expect(await reconcileKit(file.figma, LEFT_EDGE, false)).toEqual({ changes: [], warnings: [] });
    expect(weights(await buttonVariant(file))).toEqual([0, 0, 0, 1, "INSIDE", true]);
  });

  it("plans a side a designer changed back to the kit's as one change of the four weights", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, RIGHT_EDGE, true);
    file.reopen();
    (await buttonVariant(file)).strokeLeftWeight = 2;
    expect((await reconcileKit(file.figma, RIGHT_EDGE, false)).changes).toEqual([
      "Button / size=md: stroke weights → 0 1 0 0",
      ...RELAYOUT,
    ]);
  });
});
