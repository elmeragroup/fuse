/**
 * `reconcileKit` with a kit whose shortcut row draws `⇧⌘P` and whose popup holds two instances of the
 * row, one at the default and one overridden to `⌘B`, on the in-memory file in `fake-figma.ts`. The
 * oracles are the fake's rules 50 to 55, which follow what a real file did with a glyph range on
 * 2026-10-26 (G2 to G12), the glyph positions in the Dropdown menu shortcuts counted by hand, and a
 * second Plan that lists nothing.
 */
import { describe, expect, it } from "vitest";

import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT } from "../../src/components/kit-spec.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  KitSpec,
  TextLayerSpec,
} from "../../src/components/kit-spec.ts";
import { BLACK, literal } from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed, color, fixtureFile, GLYPH_FONT, string } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

const HUG = { kind: "hug" } as const;

/** The row's shortcut, whose `Shortcut keys` property sets its characters and whose family follows `font-sans`. */
const KEYS: TextLayerSpec = {
  kind: "text",
  key: "item/keys",
  name: "keys",
  characters: "⇧⌘P",
  textProperty: "Shortcut keys",
  fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
  fontStyle: "Regular",
  fontSize: literal(12),
  lineHeight: literal(16),
  color: BLACK,
  underline: undefined,
  sizing: HUGGING_TEXT,
  align: TOP_LEFT,
  truncation: undefined,
};

/** A row that hugs what it holds. */
function row(name: string, children: readonly ChildLayerSpec[]): ComponentRootSpec {
  return {
    name,
    direction: "HORIZONTAL",
    sizing: { horizontal: HUG, vertical: HUG },
    limits: NO_LIMITS,
    clips: false,
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
    children,
  };
}

/** A set of one variant, `item/one` or `popup/one`, holding `children`. */
function set(
  key: string,
  textProperties: ComponentSetSpec["textProperties"],
  children: readonly ChildLayerSpec[]
) {
  return {
    key,
    page: "page",
    name: key,
    axes: [{ name: "kind", values: ["one"] }],
    columnAxis: "kind",
    textProperties,
    swapProperties: [],
    variants: [{ key: `${key}/one`, properties: { kind: "one" }, root: row(key, children) }],
  } satisfies ComponentSetSpec;
}

/** A popup row: an instance of the item, with the shortcut the spec gives it, if any. */
function shortcut(key: string, keys: string | undefined): InstanceLayerSpec {
  const layer: InstanceLayerSpec = {
    kind: "instance",
    key,
    name: key,
    componentSet: "item",
    variant: "item/one",
    sizing: { horizontal: HUG, vertical: HUG },
  };
  return keys === undefined ? layer : { ...layer, properties: { text: { "Shortcut keys": keys } } };
}

/** The kit: the item, then the popup that holds Profile at the default and Billing at `⌘B`. */
function kitWith(glyphs: readonly string[]): KitSpec {
  return {
    pages: [{ key: "page", name: "Fuse components" }],
    fonts: [{ family: "Roboto", style: "Regular" }],
    glyphFont: { ...GLYPH_FONT, glyphs },
    icons: { key: "icons", page: "page", name: "Icons", size: 16, color: BLACK, icons: [] },
    componentSets: [
      set("item", [{ name: "Shortcut keys", defaultValue: "⇧⌘P" }], [KEYS]),
      set("popup", [], [shortcut("profile", undefined), shortcut("billing", "⌘B")]),
    ],
    previews: [],
  };
}

const KIT = kitWith(GLYPH_FONT.glyphs);

/**
 * A file whose `font-sans` holds Roboto, with the `background` the kit page's sets sit on, and a
 * designer's `Brand / font-symbols` that holds Inter.
 */
function robotoFile(): FakeFigma {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    string("Fuse tokens", "font-sans", "Roboto"),
    string("Brand", "font-symbols", "Inter"),
  ]);
}

/** The text of the item's variant and of each popup row, as each one's segments: characters, family, bound family. */
async function drawn(file: FakeFigma) {
  const page = file.figma.root.children.find((node) => keyOf(node) === "page");
  await page?.loadAsync();
  const variant = (key: string): ComponentNode => {
    const found = page?.children.find((node) => keyOf(node) === key);
    const [only] = found?.type === "COMPONENT_SET" ? found.children : [];
    if (only?.type !== "COMPONENT") {
      throw new Error(`the kit page holds no set ${key}`);
    }
    return only;
  };
  const fontSans = file.variable("Fuse tokens", "font-sans").id;
  const segments = (text: TextNode) =>
    text
      .getStyledTextSegments(["fontName", "boundVariables"])
      .map((segment) => [
        segment.characters,
        segment.fontName.family,
        segment.boundVariables?.fontFamily?.id === fontSans
          ? "font-sans"
          : segment.boundVariables?.fontFamily?.id,
      ]);
  const popup = variant("popup");
  return {
    main: segments(childNamed(variant("item"), "TEXT", "keys")),
    profile: segments(childNamed(childNamed(popup, "INSTANCE", "profile"), "TEXT", "keys")),
    billing: segments(childNamed(childNamed(popup, "INSTANCE", "billing"), "TEXT", "keys")),
  };
}

/** What the kit should leave: each glyph run Inter, unbound, and each letter Roboto bound to `font-sans`. */
const EXPECTED = {
  main: [
    ["⇧⌘", "Inter", undefined],
    ["P", "Roboto", "font-sans"],
  ],
  profile: [
    ["⇧⌘", "Inter", undefined],
    ["P", "Roboto", "font-sans"],
  ],
  billing: [
    ["⌘", "Inter", undefined],
    ["B", "Roboto", "font-sans"],
  ],
};

describe("the glyph font on a shortcut and on the instances that override it", () => {
  it("draws ⇧ and ⌘ in Inter on the main and on the ⌘B instance, and a second Plan lists nothing", async () => {
    const file = robotoFile();
    await reconcileKit(file.figma, KIT, true);
    file.reopen();
    expect(await reconcileKit(file.figma, KIT, false)).toEqual({ changes: [], warnings: [] });
    expect(await drawn(file)).toEqual(EXPECTED);
  });

  it("gives a kit applied before the glyph font its ranges in one Apply", async () => {
    const file = robotoFile();
    await reconcileKit(file.figma, kitWith([]), true);
    file.reopen();
    const before = await drawn(file);
    await reconcileKit(file.figma, KIT, true);
    file.reopen();
    expect(await reconcileKit(file.figma, KIT, false)).toEqual({ changes: [], warnings: [] });
    expect([before.billing, await drawn(file)]).toEqual([[["⌘B", "Roboto", "font-sans"]], EXPECTED]);
  });

  it.each([
    [
      "the family binding a letter a designer unbound needs",
      (file: FakeFigma, keys: TextNode) => keys.setRangeBoundVariable(2, 3, "fontFamily", null),
    ],
    [
      "the font write a letter a designer set Medium needs",
      (file: FakeFigma, keys: TextNode) => {
        keys.setRangeFontName(2, 3, { family: "Roboto", style: "Medium" });
        keys.setRangeBoundVariable(2, 3, "fontFamily", file.variable("Fuse tokens", "font-sans"));
      },
    ],
    [
      "the unbind a glyph range a designer bound to an Inter-valued variable needs (G11)",
      (file: FakeFigma, keys: TextNode) =>
        keys.setRangeBoundVariable(0, 2, "fontFamily", file.variable("Brand", "font-symbols")),
    ],
    [
      "the link to the TEXT property a designer removed (G3)",
      (_file: FakeFigma, keys: TextNode) => {
        keys.componentPropertyReferences = null;
      },
    ],
  ])("draws the ranges again after %s, in one Apply", async (_case, edit) => {
    const file = robotoFile();
    await reconcileKit(file.figma, KIT, true);
    const page = file.figma.root.children.find((node) => keyOf(node) === "page");
    await page?.loadAsync();
    const item = page?.children.find((node) => keyOf(node) === "item");
    const [variant] = item?.type === "COMPONENT_SET" ? item.children : [];
    if (variant?.type !== "COMPONENT") {
      throw new Error("the kit page holds no item variant");
    }
    await file.figma.loadFontAsync({ family: "Roboto", style: "Medium" });
    edit(file, childNamed(variant, "TEXT", "keys"));
    file.reopen();
    await reconcileKit(file.figma, KIT, true);
    file.reopen();
    expect(await reconcileKit(file.figma, KIT, false)).toEqual({ changes: [], warnings: [] });
    expect((await drawn(file)).main).toEqual(EXPECTED.main);
  });

  it("refuses a shortcut whose label sets a literal family", async () => {
    const literalKeys: TextLayerSpec = { ...KEYS, fontFamily: { kind: "literal", value: "Roboto" } };
    const kit = {
      ...KIT,
      componentSets: [set("item", [{ name: "Shortcut keys", defaultValue: "⇧⌘P" }], [literalKeys])],
    };
    await expect(reconcileKit(robotoFile().figma, kit, false)).rejects.toThrow(
      "item: keys in the variant item/one shows a glyph the kit draws in Inter, and its label keys sets a literal family, where the plugin keeps the other characters bound to a family variable."
    );
  });

  it.each([
    [
      "size",
      { fontSize: { kind: "variable", variable: { collection: "Fuse density", name: "label-text" } } },
    ],
    [
      "line height",
      { lineHeight: { kind: "variable", variable: { collection: "Fuse density", name: "label-line" } } },
    ],
  ] as const)(
    "refuses a shortcut whose label binds its %s, where no probe shows a Plan converging (G12b)",
    async (field, bound) => {
      const kit = {
        ...KIT,
        componentSets: [
          set("item", [{ name: "Shortcut keys", defaultValue: "⇧⌘P" }], [{ ...KEYS, ...bound }]),
        ],
      };
      await expect(reconcileKit(robotoFile().figma, kit, false)).rejects.toThrow(
        `item: keys in the variant item/one shows a glyph the kit draws in Inter, and its label keys binds its ${field} to a variable, which a whole binding gives the glyph ranges unbound (G12b), and no probe shows a Plan over such a label converging.`
      );
    }
  );

  it("refuses a glyph of more than one UTF-16 code unit, which a range cannot hold alone", async () => {
    await expect(reconcileKit(robotoFile().figma, kitWith(["⌘", "🔑"]), false)).rejects.toThrow(
      "The kit draws 🔑 in Inter, and a glyph range holds one UTF-16 code unit."
    );
  });

  it("refuses a nested TEXT value that shows a glyph", async () => {
    const nested: InstanceLayerSpec = {
      ...shortcut("menu", undefined),
      componentSet: "popup",
      variant: "popup/one",
      properties: { text: {}, nested: [{ path: ["billing"], text: { "Shortcut keys": "⌘K" } }] },
    };
    const exposed: InstanceLayerSpec = { ...shortcut("billing", "⌘B"), exposed: true };
    const kit = {
      ...KIT,
      componentSets: [
        set("item", [{ name: "Shortcut keys", defaultValue: "⇧⌘P" }], [KEYS]),
        set("popup", [], [shortcut("profile", undefined), exposed]),
        set("open", [], [nested]),
      ],
    };
    await expect(reconcileKit(robotoFile().figma, kit, false)).rejects.toThrow(
      "open: menu in the variant open/one gives a nested value at billing a glyph the kit draws in Inter, and the plugin draws no glyph range through a nested value."
    );
  });
});
