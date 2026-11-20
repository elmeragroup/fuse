/**
 * A variant root that lays out as a Figma grid, on the in-memory file in `fake-figma.ts`. Unit under
 * test: the box's grid plan through Apply and Plan, and the kit check that runs before it. Oracles,
 * from the typings' `GridLayoutMixin` and `GridChildrenMixin`, which the fake's rule 61 models: a
 * grid holds one `GridTrackSize` a track, binds `gridColumnGap` to a FLOAT variable, and under
 * `ROW_AUTO_FLOW` puts its layers in cells by layer order row by row, so four layers in two columns
 * take row 0 columns 0 and 1, then row 1 (PG1); a layer fills its cell on one axis and keeps its own
 * length on the other, as `layoutSizingHorizontal` and `layoutSizingVertical` read back each on its
 * own, and a HUG track is as long as the layers in it that do not fill it, so the filling `a` takes
 * the 20px `c` sets below it and the filling `b` the 20px `a` sets beside it (PG2), and the grid hugs
 * its two 20px rows and the 4px gap; a HUG track reads back with `value` 1 (PG1); a row that turns
 * into a grid fixes its sizing and leaves its layers in no cell until the grid places them
 * ROW_AUTO_FLOW (PG7); the run's check of the file's variables, before its first write, finds a
 * missing gap variable as it finds any other the kit binds; and
 * a FLEX track is invalid on an axis the grid hugs, and a grid frame takes only MIN for its alignments
 * (PG10), each of which the check refuses before the run writes.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { ComponentRootSpec, FrameLayerSpec, GridSpec, KitSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, frame, kitWithRoot } from "./button-kit-fixture.ts";
import { aliasOf, color, fixtureFile, float, string } from "./fake-fixtures.ts";
import { base64Decode } from "./fake/paints.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const KEYS = ["a", "b", "c", "d"] as const;

const FIXED = { kind: "fixed", length: { kind: "literal", value: 20 } } as const;
const FILL = { kind: "fill" } as const;

/** The grid's layers: `a` fills its cell across, `b` down, and `c` and `d` are 20px squares. */
const SIZES = [
  { horizontal: FILL, vertical: FIXED },
  { horizontal: FIXED, vertical: FILL },
  { horizontal: FIXED, vertical: FIXED },
  { horizontal: FIXED, vertical: FIXED },
] as const;

/** One of the grid's layers. */
function item(key: string, index: number): FrameLayerSpec {
  return { ...frame(key, key, []), sizing: SIZES[index] ?? SIZES[2] };
}

/** Two columns, a HUG and a FLEX, two HUG rows, the column gap bound to `gap-x`. */
const GRID: GridSpec = {
  columns: [{ kind: "hug" }, { kind: "flex", share: 1 }],
  rows: [{ kind: "hug" }, { kind: "hug" }],
  columnGap: { kind: "variable", variable: { collection: "Fuse tokens", name: "gap-x" } },
  rowGap: { kind: "literal", value: 4 },
  cells: KEYS.map((key, index) => ({ key, row: Math.floor(index / 2), column: index % 2 })),
};

/** The Button root as a 200px-wide grid of the four layers, its height hugging them. */
function gridRoot(root: ComponentRootSpec, grid: GridSpec = GRID): ComponentRootSpec {
  return {
    ...root,
    direction: "GRID",
    sizing: {
      horizontal: { kind: "fixed", length: { kind: "literal", value: 200 } },
      vertical: { kind: "hug" },
    },
    itemSpacing: { kind: "literal", value: 0 },
    // Figma takes only MIN on a grid frame (PG10).
    primaryAlign: "MIN",
    counterAlign: "MIN",
    grid,
    children: KEYS.map(item),
  };
}

/** A synced file whose `gap-x` is 10. */
function gridFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
    float("Fuse tokens", "gap-x", 10),
  ]);
}

/** The check's verdict: `accepted`, or the contradiction's message. */
function verdict(kit: KitSpec): string {
  const checked = checkKitSpec(kit, base64Decode);
  return Result.isSuccess(checked) ? "accepted" : checked.failure.message;
}

describe("a variant root that lays out as a grid", () => {
  it("takes its tracks and gaps, puts its layers in their cells, and the next Plan lists nothing", async () => {
    const kit = kitWithRoot((root) => gridRoot(root));
    const file = gridFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const root = await buttonVariant(file);
    const gap = (await file.figma.variables.getLocalVariablesAsync()).find((each) => each.name === "gap-x");
    expect([
      root.layoutMode,
      root.gridItemsPositioning,
      root.gridColumnSizes,
      root.gridRowSizes,
      root.boundVariables?.gridColumnGap?.id,
      root.gridRowGap,
    ]).toEqual([
      "GRID",
      "ROW_AUTO_FLOW",
      [
        { type: "HUG", value: 1 },
        { type: "FLEX", value: 1 },
      ],
      [
        { type: "HUG", value: 1 },
        { type: "HUG", value: 1 },
      ],
      gap?.id,
      4,
    ]);
    expect(
      root.children.map((child) =>
        "gridRowAnchorIndex" in child
          ? [
              keyOf(child),
              child.gridRowAnchorIndex,
              child.gridColumnAnchorIndex,
              child.gridChildHorizontalAlign,
              child.layoutSizingHorizontal,
              child.layoutSizingVertical,
              child.width,
              child.height,
            ]
          : []
      )
    ).toEqual([
      ["a", 0, 0, "MIN", "FILL", "FIXED", 20, 20],
      ["b", 0, 1, "MIN", "FIXED", "FILL", 20, 20],
      ["c", 1, 0, "MIN", "FIXED", "FIXED", 20, 20],
      ["d", 1, 1, "MIN", "FIXED", "FIXED", 20, 20],
    ]);
    // Two 20px rows and the 4px gap between them.
    expect(root.height).toBe(44);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("turns a row into a grid that hugs both ways, places its layers and hugs again", async () => {
    // The root first lays its four squares out as a row that hugs both ways, then as a grid of two
    // HUG columns that hugs both ways too.
    const hugging = { horizontal: { kind: "hug" }, vertical: { kind: "hug" } } as const;
    const row = kitWithRoot((root) => {
      const { grid: _grid, ...laid } = gridRoot(root);
      return { ...laid, direction: "HORIZONTAL", sizing: hugging, children: KEYS.map((key) => item(key, 2)) };
    });
    const kit = kitWithRoot((root) => ({
      ...gridRoot(root, { ...GRID, columns: [{ kind: "hug" }, { kind: "hug" }] }),
      sizing: hugging,
    }));
    const file = gridFile();
    await reconcileKit(file.figma, row, true);
    file.reopen();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const root = await buttonVariant(file);
    expect([
      root.layoutSizingHorizontal,
      root.layoutSizingVertical,
      root.width,
      root.height,
      root.children.map((child) =>
        "gridRowAnchorIndex" in child ? [child.gridRowAnchorIndex, child.gridColumnAnchorIndex] : []
      ),
    ]).toEqual([
      "HUG",
      "HUG",
      // The root's 16px side paddings around two 20px columns and the 10px `gap-x` between them,
      // and two 20px rows and the 4px gap.
      82,
      44,
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it.each([
    ["column", { ...GRID }],
    [
      "row",
      {
        ...GRID,
        columnGap: { kind: "literal", value: 10 },
        rowGap: { kind: "variable", variable: { collection: "Fuse tokens", name: "gap-x" } },
      },
    ],
  ] as const)(
    "stops Plan and Apply before any write when the file has no variable for its %s gap",
    async (_gap, grid: GridSpec) => {
      const kit = kitWithRoot((root) => gridRoot(root, grid));
      const file = fixtureFile([
        color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
        aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
        string("Fuse brand", "font-sans", "Roboto"),
      ]);
      const before = file.writes.length;
      const message = "The Fuse tokens collection has no variable named gap-x.";
      await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
      await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow(message);
      expect(file.writes.slice(before)).toEqual([]);
    }
  );

  it("is refused where it hugs its width beside a FLEX column", () => {
    const kit = kitWithRoot((root) => {
      const grid = gridRoot(root);
      return { ...grid, sizing: { ...grid.sizing, horizontal: { kind: "hug" } } };
    });
    expect(verdict(kit)).toBe(
      "Button: button in the variant button/size=md hugs an axis that a FLEX track shares out, which Figma calls invalid."
    );
  });

  it("is refused where it aligns its layers other than MIN, which Figma throws for on a grid", () => {
    const centered = kitWithRoot((root) => ({ ...gridRoot(root), primaryAlign: "CENTER" }));
    expect(verdict(centered)).toBe(
      "Button: button in the variant button/size=md is a grid that aligns CENTER and MIN, where Figma takes only MIN."
    );
  });

  it("is refused where its cells skip the order its layers take row by row", () => {
    const swapped = {
      ...GRID,
      cells: GRID.cells.map((cell, index) => ({ ...cell, key: KEYS[(index + 1) % 4] ?? "" })),
    };
    expect(verdict(kitWithRoot((root) => gridRoot(root, swapped)))).toBe(
      "Button: button in the variant button/size=md puts b where its layer a takes the next cell row by row, as Figma's ROW_AUTO_FLOW places it."
    );
  });
});
