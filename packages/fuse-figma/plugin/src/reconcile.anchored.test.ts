/**
 * `reconcileKit` with a kit whose Item set holds a Row instance in its flow and a Badge instance at
 * MAX × CENTER, as a Sidebar menu item holds its menu badge, on the in-memory file in
 * `fake-figma.ts`. The oracles are the fake's rule 47, after what a real file did on 2026-10-25 (N11):
 * the badge keeps its end inset and its centre offset as it and the item resize, a density switch
 * included, and lists only `layoutPositioning` among its overrides. Plan compares the inset and the
 * offset, so a second Plan lists nothing.
 */
import { describe, expect, it } from "vitest";

import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  AnchoredSpec,
  ColorSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  KitSpec,
} from "../../src/components/kit-spec.ts";
import { FILL, literal } from "./button-kit-fixture.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const BLACK: ColorSpec = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } };
const HUG = { kind: "hug" } as const;
const ROW_H = { kind: "variable", variable: { collection: "Fuse density", name: "row-h" } } as const;

/** A root with no paint, padding or layers, sized as given. */
function bareRoot(name: string, sizing: ComponentRootSpec["sizing"]): ComponentRootSpec {
  return {
    name,
    direction: "HORIZONTAL",
    sizing,
    limits: NO_LIMITS,
    clips: true,
    paddingTop: literal(0),
    paddingRight: literal(0),
    paddingBottom: literal(0),
    paddingLeft: literal(0),
    itemSpacing: literal(0),
    primaryAlign: "MIN",
    counterAlign: "CENTER",
    cornerRadius: literal(0),
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [],
  };
}

/** A set of one variant, `state=rest`, around a root. */
function oneVariant(key: string, name: string, root: ComponentRootSpec, text = false): ComponentSetSpec {
  return {
    key,
    page: "page",
    name,
    axes: [{ name: "state", values: ["rest"] }],
    columnAxis: "state",
    textProperties: text ? [{ name: "Count", defaultValue: "24" }] : [],
    booleanProperties: [],
    swapProperties: [],
    variants: [{ key: `${key}/state=rest`, properties: { state: "rest" }, root }],
  };
}

/** The row: as tall as `row-h`, hugging across. */
const ROW = oneVariant(
  "row",
  "Row",
  bareRoot("row", { horizontal: HUG, vertical: { kind: "fixed", length: ROW_H } })
);

/** The badge: 20px tall, hugging its count across. */
const BADGE = oneVariant(
  "badge",
  "Badge",
  {
    ...bareRoot("badge", { horizontal: HUG, vertical: { kind: "fixed", length: literal(20) } }),
    paddingLeft: literal(4),
    paddingRight: literal(4),
    children: [
      {
        kind: "text",
        key: "badge/count",
        name: "Count",
        characters: "24",
        textProperty: "Count",
        fontFamily: { kind: "literal", value: "Roboto" },
        fontStyle: "Medium",
        fontSize: literal(12),
        lineHeight: literal(16),
        color: BLACK,
        underline: undefined,
        sizing: HUGGING_TEXT,
        align: TOP_LEFT,
        truncation: undefined,
      },
    ],
  },
  true
);

/** The badge's sizing in the item: hugging its count, 20px tall. */
const BADGE_SIZING: InstanceLayerSpec["sizing"] = {
  horizontal: HUG,
  vertical: { kind: "fixed", length: literal(20) },
};

/** 4px from the item's end, centred on the item. */
const AT_END: AnchoredSpec = {
  constraints: { horizontal: "MAX", vertical: "CENTER" },
  endInset: 4,
  centerOffset: 0,
};

/** The item: a 240px column that hugs the row, with the badge over the row's end. */
function itemSet(
  at: AnchoredSpec = AT_END,
  badgeSizing: InstanceLayerSpec["sizing"] = BADGE_SIZING
): ComponentSetSpec {
  const row: InstanceLayerSpec = {
    kind: "instance",
    key: "item/row",
    name: "row",
    componentSet: "row",
    variant: "row/state=rest",
    sizing: { horizontal: FILL, vertical: { kind: "fixed", length: ROW_H } },
  };
  const badge: InstanceLayerSpec = {
    kind: "instance",
    key: "item/badge",
    name: "badge",
    componentSet: "badge",
    variant: "badge/state=rest",
    sizing: badgeSizing,
    absolute: at,
  };
  return oneVariant("item", "Item", {
    ...bareRoot("item", { horizontal: { kind: "fixed", length: literal(240) }, vertical: HUG }),
    direction: "VERTICAL",
    counterAlign: "MIN",
    children: [row, badge],
  });
}

/** The kit: the row, the badge and the item, with no preview. */
function kitWith(item: ComponentSetSpec = itemSet()): KitSpec {
  return {
    pages: [{ key: "page", name: "Fuse components" }],
    fonts: [{ family: "Roboto", style: "Medium" }],
    icons: { key: "icons", page: "page", name: "Icons", size: 16, color: BLACK, icons: [] },
    componentSets: [ROW, BADGE, item],
    previews: [],
  };
}

/** A synced file whose `row-h` is 32 Dense and 36 Comfortable, the Dense mode its default. */
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
        variables: [
          {
            name: "row-h",
            type: "FLOAT",
            scopes: [],
            webSyntax: undefined,
            description: "",
            values: new Map([
              ["Dense", { _tag: "Float", value: 32 }],
              ["Comfortable", { _tag: "Float", value: 36 }],
            ]),
          },
        ],
      },
    ],
  });
}

/** The Item variant, its row and its badge, each read so it settles, the instances first (PI). */
async function itemLayers(file: FakeFigma) {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const set = page?.children.find((node) => keyOf(node) === "item");
  const [variant] = set?.type === "COMPONENT_SET" ? set.children : [];
  if (variant?.type !== "COMPONENT") {
    throw new Error("the kit page holds no Item variant");
  }
  const row = childNamed(variant, "INSTANCE", "row");
  const badge = childNamed(variant, "INSTANCE", "badge");
  const sizes = [row.width, row.height, badge.width, badge.height];
  return { variant, row, badge, sizes };
}

/** The badge's end inset and centre offset, as a designer measures them. */
function placeOf(variant: ComponentNode | InstanceNode, badge: InstanceNode): readonly [number, number] {
  return [variant.width - badge.x - badge.width, badge.y + badge.height / 2 - variant.height / 2];
}

describe("a variant that holds an instance at MAX × CENTER", () => {
  it("places the instance in one Apply, and the next Plan lists nothing", async () => {
    const file = densityFile();
    await reconcileKit(file.figma, kitWith(), true);
    file.reopen();
    expect(await reconcileKit(file.figma, kitWith(), false)).toEqual({ changes: [], warnings: [] });
    const { variant, badge } = await itemLayers(file);
    expect([badge.layoutPositioning, badge.constraints, placeOf(variant, badge)]).toEqual([
      "ABSOLUTE",
      { horizontal: "MAX", vertical: "CENTER" },
      [4, 0],
    ]);
    // The plugin names the layer, so `name` is listed too, as it was on the real file (N11).
    expect(badge.overrides).toEqual([{ id: badge.id, overriddenFields: ["name", "layoutPositioning"] }]);
  });

  // N11's outer instance: an Item instance pinned Comfortable reads its row 36 tall, and its badge
  // keeps its place there, which the kit's own variant leaves as it was.
  it("keeps the place in an outer instance a density switch makes taller, and lists nothing", async () => {
    const file = densityFile();
    await reconcileKit(file.figma, kitWith(), true);
    file.reopen();
    const { variant } = await itemLayers(file);
    const density = (await file.figma.variables.getLocalVariableCollectionsAsync()).find(
      (collection) => collection.name === "Fuse density"
    );
    if (density === undefined) {
      throw new Error("the file holds no density collection");
    }
    const outer = variant.createInstance();
    outer.setExplicitVariableModeForCollection(density, density.modes[1]?.modeId ?? "");
    const row = childNamed(outer, "INSTANCE", "row");
    const badge = childNamed(outer, "INSTANCE", "badge");
    expect([row.height, outer.height, placeOf(outer, badge)]).toEqual([36, 36, [4, 0]]);
    expect(await reconcileKit(file.figma, kitWith(), false)).toEqual({ changes: [], warnings: [] });
  });

  it("plans an instance a designer moved back to its place, in one line", async () => {
    const file = densityFile();
    await reconcileKit(file.figma, kitWith(), true);
    file.reopen();
    const { badge } = await itemLayers(file);
    badge.x -= 10;
    expect((await reconcileKit(file.figma, kitWith(), false)).changes).toEqual([
      "Item / state=rest / badge: place → 4px from the end, its centre 0px from the centre",
      "Item: lay out 1 variants in 1 columns and 1 rows",
      "Fuse components: place Row, Badge, Item and Icons in a row",
    ]);
    await reconcileKit(file.figma, kitWith(), true);
    file.reopen();
    expect(await reconcileKit(file.figma, kitWith(), false)).toEqual({ changes: [], warnings: [] });
  });

  // Figma refuses FILL on an absolute layer (P8), so the kit check stops the run before any write.
  it("stops Plan and Apply before any write where the instance fills its parent's width", async () => {
    const file = densityFile();
    const filling = kitWith(itemSet(AT_END, { ...BADGE_SIZING, horizontal: FILL }));
    const message = "Item: badge in the variant item/state=rest is absolute and fills its width";
    const before = file.writes.length;
    await expect(reconcileKit(file.figma, filling, false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, filling, true)).rejects.toThrow(message);
    expect(file.writes.slice(before)).toEqual([]);
  });
});
