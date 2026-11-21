/**
 * A variant root that wraps its layers into lines, on the in-memory file in `fake-figma.ts`. Unit
 * under test: the box's `layoutWrap` and `counterAxisSpacing` plan through Apply and Plan. Oracles,
 * from the live probes of 2026-11-21: a WRAP row breaks a line before the layer that passes the
 * line's room (WR1), so three 40px layers 10px apart in a 100px row take two lines; it spaces the
 * lines by `counterAxisSpacing`, which binds a FLOAT variable and reads the alias back (WR3, WR9), and
 * hugs its lines and the gap between them (WR4); and turning WRAP off keeps the row's sizing (WR8),
 * the one part of a row that keeps one line the fake models, since it lays out no hug of frames.
 * A second Plan over what Apply wrote lists nothing.
 */
import { describe, expect, it } from "vitest";

import type { ComponentRootSpec, FrameLayerSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, frame, kitWithRoot } from "./button-kit-fixture.ts";
import { aliasOf, color, fixtureFile, float, string } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

const SQUARE = { kind: "fixed", length: { kind: "literal", value: 40 } } as const;
const LINE = { kind: "fixed", length: { kind: "literal", value: 20 } } as const;

/** One of the row's layers, 40 by 20. */
function item(key: string): FrameLayerSpec {
  return { ...frame(key, key, []), sizing: { horizontal: SQUARE, vertical: LINE } };
}

/** The Button root as a 100px row of three layers 10px apart, its height hugging its lines. */
function wrappingRoot(root: ComponentRootSpec): ComponentRootSpec {
  return {
    ...root,
    direction: "HORIZONTAL",
    sizing: {
      horizontal: { kind: "fixed", length: { kind: "literal", value: 100 } },
      vertical: { kind: "hug" },
    },
    limits: { ...root.limits, minHeight: undefined, minWidth: undefined },
    paddingTop: { kind: "literal", value: 0 },
    paddingRight: { kind: "literal", value: 0 },
    paddingBottom: { kind: "literal", value: 0 },
    paddingLeft: { kind: "literal", value: 0 },
    itemSpacing: { kind: "literal", value: 10 },
    lineGap: { kind: "variable", variable: { collection: "Fuse tokens", name: "gap-y" } },
    primaryAlign: "MIN",
    counterAlign: "CENTER",
    stroke: undefined,
    children: ["a", "b", "c"].map(item),
  };
}

/** The same row with no gap between lines, which keeps its layers on one line. */
function oneLineRoot(root: ComponentRootSpec): ComponentRootSpec {
  const { lineGap: _lineGap, ...oneLine } = wrappingRoot(root);
  return oneLine;
}

/** A synced file whose `gap-y` is 4. */
function wrapFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
    float("Fuse tokens", "gap-y", 4),
  ]);
}

describe("a variant root that wraps its layers into lines", () => {
  it("wraps, binds the gap between its lines, hugs both lines, and turns WRAP off again for one line", async () => {
    const file = wrapFile();
    const wrapping = kitWithRoot(wrappingRoot);
    await reconcileKit(file.figma, wrapping, true);
    file.reopen();
    const root = await buttonVariant(file);
    const gap = (await file.figma.variables.getLocalVariablesAsync()).find((each) => each.name === "gap-y");
    expect([
      root.layoutWrap,
      root.boundVariables?.counterAxisSpacing?.id,
      root.counterAxisSpacing,
      root.layoutSizingHorizontal,
      root.layoutSizingVertical,
      root.width,
      root.height,
    ]).toEqual(["WRAP", gap?.id, 4, "FIXED", "HUG", 100, 44]);
    expect((await reconcileKit(file.figma, wrapping, false)).changes).toEqual([]);

    const oneLine = kitWithRoot(oneLineRoot);
    await reconcileKit(file.figma, oneLine, true);
    file.reopen();
    const unwrapped = await buttonVariant(file);
    expect([unwrapped.layoutWrap, unwrapped.layoutSizingHorizontal, unwrapped.layoutSizingVertical]).toEqual([
      "NO_WRAP",
      "FIXED",
      "HUG",
    ]);
    expect((await reconcileKit(file.figma, oneLine, false)).changes).toEqual([]);
  });
});
