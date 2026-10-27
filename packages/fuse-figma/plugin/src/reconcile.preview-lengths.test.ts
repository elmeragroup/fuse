/**
 * `reconcileKit` with a preview frame pinned to a density mode that makes its Item instance taller
 * than the Item variant, on the in-memory file in `fake-figma.ts`. The oracles are the fake's rule 56,
 * after what a real file did on 2026-10-26 (G13 to G15, G19): such an instance holds its literal width
 * when the variant's changes, follows a bound width while it reads the binding, and keeps its length
 * once it unbinds its own width. A real instance also hugged an axis its main fixes (N4). The owner's
 * file showed the first: after 531ea20d narrowed the Combobox sets, the comfortable previews kept the
 * old widths and Plan read clean.
 */
import { describe, expect, it } from "vitest";

import type {
  ColorSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  KitSpec,
  NumberSpec,
} from "../../src/components/kit-spec.ts";
import { applyTo, bareRoot, literal, oneVariant } from "./button-kit-fixture.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { GLYPH_FONT } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const BLACK: ColorSpec = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } };
const HUG = { kind: "hug" } as const;
const ROW_H = { kind: "variable", variable: { collection: "Fuse density", name: "row-h" } } as const;
const ITEM_W = { kind: "variable", variable: { collection: "Fuse density", name: "item-w" } } as const;

/** The row: as tall as `row-h`, 40px wide. */
const ROW = oneVariant(
  "row",
  "Row",
  bareRoot("row", {
    horizontal: { kind: "fixed", length: literal(40) },
    vertical: { kind: "fixed", length: ROW_H },
  })
);

/**
 * The item: as wide as `width`, hugging a Row instance's height, as a Combobox item hugs its density
 * padding, so a Comfortable preview makes it taller than the variant.
 */
function itemSet(width: NumberSpec): ComponentSetSpec {
  const row: InstanceLayerSpec = {
    kind: "instance",
    key: "item/row",
    name: "row",
    componentSet: "row",
    variant: "row/state=rest",
    sizing: {
      horizontal: { kind: "fixed", length: literal(40) },
      vertical: { kind: "fixed", length: ROW_H },
    },
  };
  return oneVariant("item", "Item", {
    ...bareRoot("item", { horizontal: { kind: "fixed", length: width }, vertical: HUG }),
    children: [row],
  });
}

/** The kit: the row and the item, and a preview of the item pinned Comfortable. */
function kitWith(width: NumberSpec): KitSpec {
  return {
    pages: [{ key: "page", name: "Fuse components" }],
    fonts: [],
    glyphFont: GLYPH_FONT,
    icons: { key: "icons", page: "page", name: "Icons", size: 16, color: BLACK, icons: [] },
    componentSets: [ROW, itemSet(width)],
    previews: [
      {
        key: "preview/comfortable",
        name: "Comfortable",
        page: "page",
        modes: [{ collection: "Fuse density", mode: "Comfortable" }],
        groups: [
          {
            key: "preview/comfortable/item",
            name: "Item",
            componentSet: "item",
            variants: ["item/state=rest"],
          },
        ],
      },
    ],
  };
}

function density(name: string, dense: number, comfortable: number) {
  return {
    name,
    type: "FLOAT" as const,
    scopes: [],
    webSyntax: undefined,
    description: "",
    values: new Map([
      ["Dense", { _tag: "Float" as const, value: dense }],
      ["Comfortable", { _tag: "Float" as const, value: comfortable }],
    ]),
  };
}

/**
 * A synced file whose `row-h` is 32 Dense and 36 Comfortable and `item-w` 100 and 140, the Dense mode
 * its default.
 */
function densityFile(): FakeFigma {
  return createFakeFigma({
    collections: [
      {
        name: "Fuse tokens",
        modes: ["Default"],
        variables: [
          {
            name: "background",
            type: "COLOR",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([["Default", { _tag: "Color", color: { r: 1, g: 1, b: 1, a: 1 } }]]),
          },
        ],
      },
      {
        name: "Fuse density",
        modes: ["Dense", "Comfortable"],
        variables: [density("row-h", 32, 36), density("item-w", 100, 140)],
      },
    ],
  });
}

/** The Item variant and its instance in the preview. */
async function itemNodes(file: FakeFigma): Promise<{ variant: ComponentNode; instance: InstanceNode }> {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const set = page?.children.find((node) => keyOf(node) === "item");
  const preview = page?.children.find((node) => keyOf(node) === "preview/comfortable");
  const [variant] = set?.type === "COMPONENT_SET" ? set.children : [];
  const [group] = preview?.type === "FRAME" ? preview.children : [];
  const [instance] = group?.type === "FRAME" ? group.children : [];
  if (variant?.type !== "COMPONENT" || instance?.type !== "INSTANCE") {
    throw new Error("the kit page holds no Item variant or no Item instance in the preview");
  }
  return { variant, instance };
}

function applied(width: NumberSpec): Promise<FakeFigma> {
  return applyTo(densityFile(), kitWith(width));
}

describe("a preview instance its modes make taller than its variant", () => {
  // The owner's file on 2026-10-26: an Apply of the plugin before this check narrowed the variant
  // and left the instance, and the next Plan read clean.
  it("writes the width of an instance held at its old width, and one Apply converges", async () => {
    const file = await applied(literal(404));
    const { variant, instance } = await itemNodes(file);
    expect([variant.width, variant.height, instance.width, instance.height]).toEqual([404, 32, 404, 36]);
    expect(instance.overrides).toEqual([{ id: instance.id, overriddenFields: ["width", "height"] }]);

    // The variant narrows as that Apply wrote it: a resize, then the hug back.
    variant.resize(366, variant.height);
    variant.layoutSizingVertical = "HUG";
    file.reopen();
    expect([variant.width, instance.width, instance.height]).toEqual([366, 404, 36]);

    const narrow = kitWith(literal(366));
    expect((await reconcileKit(file.figma, narrow, false)).changes).toEqual([
      "Item: lay out 1 variants in 1 columns and 1 rows",
      "Comfortable / Item / item/state=rest: width → 366",
      "Fuse components: place Row, Item and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, narrow, true);
    file.reopen();
    expect([instance.width, instance.height]).toEqual([366, 36]);
    expect([instance.layoutSizingHorizontal, instance.layoutSizingVertical]).toEqual(["FIXED", "HUG"]);
    expect(await reconcileKit(file.figma, narrow, false)).toEqual({ changes: [], warnings: [] });
  });

  it("plans the instance's width with the variant's when the kit narrows it", async () => {
    const file = await applied(literal(404));
    const { variant, instance } = await itemNodes(file);
    const narrow = kitWith(literal(366));
    expect((await reconcileKit(file.figma, narrow, false)).changes).toEqual([
      "Item / state=rest: width → 366",
      "Item: lay out 1 variants in 1 columns and 1 rows",
      "Comfortable / Item / item/state=rest: width → 366",
      "Fuse components: place Row, Item and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, narrow, true);
    file.reopen();
    expect([variant.width, instance.width, instance.height]).toEqual([366, 366, 36]);
    expect(await reconcileKit(file.figma, narrow, false)).toEqual({ changes: [], warnings: [] });
  });

  it("binds a bound width again on an instance that lost its binding", async () => {
    const file = await applied(ITEM_W);
    const { instance } = await itemNodes(file);
    const itemW = (await file.figma.variables.getLocalVariablesAsync()).find(
      (variable) => variable.name === "item-w"
    );
    expect([instance.width, instance.boundVariables?.width?.id]).toEqual([140, itemW?.id]);

    // A designer detaches the width, which then stays at 140 whatever `item-w` holds (G19).
    instance.setBoundVariable("width", null);
    file.reopen();
    expect(instance.boundVariables?.width).toBeUndefined();

    expect((await reconcileKit(file.figma, kitWith(ITEM_W), false)).changes).toEqual([
      "Comfortable / Item / item/state=rest: width → item-w",
      "Fuse components: place Row, Item and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, kitWith(ITEM_W), true);
    file.reopen();
    expect([instance.width, instance.boundVariables?.width?.id]).toEqual([140, itemW?.id]);
    expect([instance.layoutSizingHorizontal, instance.layoutSizingVertical]).toEqual(["FIXED", "HUG"]);
    expect(await reconcileKit(file.figma, kitWith(ITEM_W), false)).toEqual({ changes: [], warnings: [] });
  });

  // N4: a real instance hugged its height at 26px while the height bound `row-h`, so its length read
  // as the spec's while it hugged. Here the Item is as wide as the Row it hugs, so a hugging instance
  // reads the spec's 40.
  it("fixes an axis the variant fixes on an instance that hugs it at the spec's length", async () => {
    const file = await applied(literal(40));
    const { instance } = await itemNodes(file);
    instance.layoutSizingHorizontal = "HUG";
    file.reopen();
    expect([instance.width, instance.layoutSizingHorizontal]).toEqual([40, "HUG"]);

    const kit = kitWith(literal(40));
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([
      "Comfortable / Item / item/state=rest: layoutSizingHorizontal → FIXED, width → 40",
      "Fuse components: place Row, Item and Icons in a row and stack 1 previews below them",
    ]);
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect([instance.width, instance.height]).toEqual([40, 36]);
    expect([instance.layoutSizingHorizontal, instance.layoutSizingVertical]).toEqual(["FIXED", "HUG"]);
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
  });
});
