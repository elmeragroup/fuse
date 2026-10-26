/**
 * `reconcileKit` with a kit whose list holds a row that holds a key group that holds two caps, PN's
 * shape, on the in-memory file in `fake-figma.ts`. The oracles are the fake's rule 45, which follows
 * what a real file did with TEXT values set through exposure two levels down on 2026-10-25 (PN), the
 * change lines Plan lists, and a second Plan that lists nothing.
 */
import { describe, expect, it } from "vitest";

import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  KitSpec,
  NestedPropertiesSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { applyTo, literal } from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed, color, fixtureFile, float, GLYPH_FONT } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const HUG = { kind: "hug" } as const;
const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

/** A label a `Label` property sets. */
function label(key: string, characters: string): TextLayerSpec {
  return {
    kind: "text",
    key,
    name: "label",
    characters,
    textProperty: "Label",
    fontFamily: { kind: "literal", value: "Roboto" },
    fontStyle: "Medium",
    fontSize: literal(12),
    lineHeight: literal(16),
    color: BLACK,
    underline: undefined,
    sizing: HUGGING_TEXT,
    align: TOP_LEFT,
    truncation: undefined,
  };
}

/** A hugging row named `name` that holds `children`, gap 4. */
function row(name: string, children: readonly ChildLayerSpec[]): ComponentRootSpec {
  return {
    name,
    direction: "HORIZONTAL",
    sizing: { horizontal: HUG, vertical: HUG },
    limits: NO_LIMITS,
    clips: true,
    paddingTop: literal(0),
    paddingRight: literal(0),
    paddingBottom: literal(0),
    paddingLeft: literal(0),
    itemSpacing: literal(4),
    primaryAlign: "MIN",
    counterAlign: "CENTER",
    cornerRadius: literal(0),
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children,
  };
}

/** An instance layer of `set`'s `variant`, exposed unless `exposed` is false. */
function instance(
  key: string,
  set: string,
  variant: string,
  fields: Partial<InstanceLayerSpec> = {},
  exposed = true
): InstanceLayerSpec {
  const layer: InstanceLayerSpec = {
    kind: "instance",
    key,
    name: set,
    componentSet: set,
    variant,
    sizing: { horizontal: HUG, vertical: HUG },
    ...fields,
  };
  return exposed ? { ...layer, exposed: true } : layer;
}

/** A set of one axis, its variants' roots from `root`, with a `Label` TEXT property where it has one. */
function setOf(
  key: string,
  axis: string,
  values: readonly string[],
  root: (value: string) => ComponentRootSpec,
  label?: string
): ComponentSetSpec {
  return {
    key,
    page: "page",
    name: key,
    axes: [{ name: axis, values }],
    columnAxis: axis,
    textProperties: label === undefined ? [] : [{ name: "Label", defaultValue: label }],
    swapProperties: [],
    variants: values.map((value) => ({
      key: `${key}/${axis}=${value}`,
      properties: { [axis]: value },
      root: root(value),
    })),
  };
}

const CAP = setOf("cap", "content", ["text"], () => row("cap", [label("cap/label", "K")]), "K");
const GROUP = setOf("group", "keys", ["2"], () =>
  row("group", [
    instance("group/first", "cap", "cap/content=text", { properties: { text: { Label: "Ctrl" } } }),
    instance("group/second", "cap", "cap/content=text"),
  ])
);
const ITEM = setOf(
  "item",
  "highlighted",
  ["false", "true"],
  () =>
    row("item", [label("item/label", "New customer"), instance("item/shortcut", "group", "group/keys=2")]),
  "New customer"
);

/** The caps' values a list row gives, Alt and N as the docs Groups demo's first row. */
const ALT_N: readonly NestedPropertiesSpec[] = [
  { path: ["item/shortcut", "group/first"], text: { Label: "Alt" } },
  { path: ["item/shortcut", "group/second"], text: { Label: "N" } },
];

/** The kit: the four sets, the list's row at `highlighted` with the given nested values. */
function kitWith(
  highlighted: string,
  nested: readonly NestedPropertiesSpec[] = ALT_N,
  item: ComponentSetSpec = ITEM
): KitSpec {
  const list = setOf("list", "content", ["grouped"], () =>
    row("list", [
      instance("list/row", "item", `item/highlighted=${highlighted}`, {
        properties: { text: { Label: "Customers" }, nested },
      }),
    ])
  );
  return {
    pages: [{ key: "page", name: "Fuse components" }],
    fonts: [{ family: "Roboto", style: "Medium" }],
    glyphFont: GLYPH_FONT,
    icons: { key: "icons", page: "page", name: "Icons", size: 16, color: BLACK, icons: [] },
    componentSets: [CAP, GROUP, item, list],
    previews: [],
  };
}

/** A file with the synced collections and no kit page. */
function tokenFile(): FakeFigma {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    float("Fuse density", "row-h", 32),
  ]);
}

/** The row instance in the list's variant, and what its caps show through exposure. */
async function listRow(file: FakeFigma) {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const set = page?.children.find((node) => keyOf(node) === "list");
  const [variant] = set?.type === "COMPONENT_SET" ? set.children : [];
  if (variant?.type !== "COMPONENT") {
    throw new Error("the list set holds no variant");
  }
  const held = childNamed(variant, "INSTANCE", "item");
  const caps = held.exposedInstances.filter((exposed) => exposed.name === "cap");
  const labelOf = (cap: InstanceNode) =>
    Object.entries(cap.componentProperties).find(([id]) => id.startsWith("Label#"))?.[1].value;
  return { held, caps: caps.map(labelOf) };
}

describe("TEXT values of instances exposed inside an instance", () => {
  it("converges in one Apply, the caps showing the values", async () => {
    const kit = kitWith("false");
    const file = tokenFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    expect(await reconcileKit(file.figma, kit, false)).toEqual({ changes: [], warnings: [] });
    expect((await listRow(file)).caps).toEqual(["Alt", "N"]);
  });

  it("plans a line for each nested instance whose values differ", async () => {
    const file = await applyTo(tokenFile(), kitWith("false", []));
    expect((await listRow(file)).caps).toEqual(["Ctrl", "K"]);
    expect((await reconcileKit(file.figma, kitWith("false"), false)).changes).toEqual([
      'list / content=grouped / item / item/shortcut / group/first: properties → Label "Alt"',
      'list / content=grouped / item / item/shortcut / group/second: properties → Label "N"',
      "list: lay out 1 variants in 1 columns and 1 rows",
      "Fuse components: place cap, group, item, list and Icons in a row",
    ]);
  });

  // A TEXT write changes the cap's characters, which needs every font its label holds (rule 7).
  it("loads the font a designer gave a cap's label before it writes the cap, and converges", async () => {
    const file = await applyTo(tokenFile(), kitWith("false", []));
    const bold = { family: "Roboto", style: "Bold" };
    await file.figma.loadFontAsync(bold);
    const [first] = (await listRow(file)).held.exposedInstances.filter((exposed) => exposed.name === "cap");
    if (first === undefined) {
      throw new Error("the row shows no cap");
    }
    childNamed(first, "TEXT", "label").fontName = bold;
    file.reopen();
    await reconcileKit(file.figma, kitWith("false"), true);
    file.reopen();
    expect([await reconcileKit(file.figma, kitWith("false"), false), (await listRow(file)).caps]).toEqual([
      { changes: [], warnings: [] },
      ["Alt", "N"],
    ]);
  });

  /** Give the row's first cap's label Roboto Bold, then open the file on a machine that lacks it. */
  async function boldFirstCapUnavailable(file: FakeFigma): Promise<void> {
    const bold = { family: "Roboto", style: "Bold" };
    await file.figma.loadFontAsync(bold);
    const [first] = (await listRow(file)).held.exposedInstances.filter((exposed) => exposed.name === "cap");
    if (first === undefined) {
      throw new Error("the row shows no cap");
    }
    childNamed(first, "TEXT", "label").fontName = bold;
    file.reopen({ unavailableFonts: [bold] });
  }

  // A run loads a font only for a label it writes, so a font it does not need never stops it.
  it("plans nothing where the caps hold their values, though a cap's font is unavailable", async () => {
    const file = await applyTo(tokenFile(), kitWith("false"));
    await boldFirstCapUnavailable(file);
    expect(await reconcileKit(file.figma, kitWith("false"), false)).toEqual({ changes: [], warnings: [] });
  });

  it("stops Plan on the unavailable font of a cap it writes", async () => {
    const file = await applyTo(tokenFile(), kitWith("false", []));
    await boldFirstCapUnavailable(file);
    await expect(reconcileKit(file.figma, kitWith("false"), false)).rejects.toThrow(
      "needs the font Roboto Bold, which Figma cannot load"
    );
  });

  it("keeps the values through a switch of the row's variant, in one Apply", async () => {
    const file = await applyTo(tokenFile(), kitWith("false"));
    const highlighted = kitWith("true");
    await reconcileKit(file.figma, highlighted, true);
    file.reopen();
    expect(await reconcileKit(file.figma, highlighted, false)).toEqual({ changes: [], warnings: [] });
    const { held, caps } = await listRow(file);
    expect([(await held.getMainComponentAsync())?.name, caps]).toEqual(["highlighted=true", ["Alt", "N"]]);
  });
});

describe("the kit check of nested values", () => {
  const where = "list: item in the variant list/content=grouped";
  /** The item set with its shortcut not exposed. */
  const hidden = setOf(
    "item",
    "highlighted",
    ["false", "true"],
    () =>
      row("item", [
        label("item/label", "New customer"),
        instance("item/shortcut", "group", "group/keys=2", {}, false),
      ]),
    "New customer"
  );
  it.each([
    [
      "a path through an instance that is not exposed",
      kitWith("false", ALT_N, hidden),
      `${where} gives a nested value at item/shortcut / group/first, and item/shortcut is not exposed, so a designer could not set it either.`,
    ],
    [
      "a path the inner variant lacks",
      kitWith("false", [{ path: ["item/shortcut", "group/third"], text: { Label: "N" } }]),
      `${where} gives a nested value at item/shortcut / group/third, which group/keys=2 lacks.`,
    ],
    [
      "a path that ends at a layer that is no instance",
      kitWith("false", [{ path: ["item/label"], text: { Label: "N" } }]),
      `${where} gives a nested value at item/label, which is no instance.`,
    ],
    [
      "a TEXT property the nested set lacks",
      kitWith("false", [{ path: ["item/shortcut", "group/first"], text: { Title: "N" } }]),
      `${where} gives a nested value at item/shortcut / group/first for Title, which cap does not define as a TEXT property.`,
    ],
  ])("stops Plan before any write for %s", async (_, kit, message) => {
    const file = tokenFile();
    const setup = file.writes.length;
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});
