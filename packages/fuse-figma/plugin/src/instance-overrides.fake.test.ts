/**
 * The overrides a chip segment and a group member need on a Button instance, on the in-memory file in
 * `fake-figma.ts`: the stroke's side weights on the root, its corners, a bound padding, the label's
 * face and the root's widest width. Unit under test: `instance-overrides.ts` and the sizing stage of
 * `instance-layers.ts`, through `reconcileKit` on a synced file. Oracle: the kit spec, here List detail's first row Button with an
 * override added, as a chip segment's `border-0 border-s` keeps only its start edge of Button's 1px
 * border, an operator's `font-normal` shows Regular where Button's label is Medium and a value's
 * `max-w-56` caps it at 224px, and what a real file's `overrides` listed on 2026-11-20: each side a
 * write changed, a text's `fontName` and an instance's `maxWidth`, each kept listed after the main's
 * value was written back (SW). On 2026-11-21 a literal width limit's write kept the paired height
 * limit the instance showed through a change of the main's literal, and the instance showed a
 * binding the main held (MH). The fonts each write needs and leaves follow the fake's text rules 7,
 * 10, 50 and 51 (PG8, PG13). No real file has run the plugin's writes yet: the owner's Apply is their
 * check.
 */
import { describe, expect, it } from "vitest";

import type {
  ChildLayerSpec,
  ComponentSetSpec,
  InstanceOverride,
  KitSpec,
  LimitsSpec,
  NumberSpec,
  TextLayerSpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { walkLayers } from "../../src/components/kit-spec.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { appliedFile, applyTo, kitFixture, kitPage, setOn } from "./kit-fixture.ts";
import { firstRow, onFirstRowButton } from "./list-detail-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** The changes a Plan, or an Apply where `apply` is true, of `kit` lists on `file`. */
async function reconcile(file: FakeFigma, kit: KitSpec, apply = false) {
  const report = await reconcileKit(file.figma, kit, apply);
  file.reopen();
  return report.changes;
}

/** The first row's Button of `List detail`'s `content=empty` variant, with `added` among its overrides. */
function withOverride(kit: KitSpec, added: InstanceOverride): KitSpec {
  return onFirstRowButton(kit, (button) => ({ ...button, overrides: [...(button.overrides ?? []), added] }));
}

/** `kit` with every label of the Button set's variants as `edit` makes it. */
function withButtonLabels(kit: KitSpec, edit: (label: TextLayerSpec) => TextLayerSpec): KitSpec {
  const onLabels = (layers: readonly ChildLayerSpec[]): readonly ChildLayerSpec[] =>
    layers.map((layer) => {
      if (layer.kind === "frame") {
        return { ...layer, children: onLabels(layer.children) };
      }
      return layer.kind === "text" ? edit(layer) : layer;
    });
  return {
    ...kit,
    componentSets: kit.componentSets.map((set) =>
      set.name !== "Button"
        ? set
        : {
            ...set,
            variants: set.variants.map((variant) => ({
              ...variant,
              root: { ...variant.root, children: onLabels(variant.root.children) },
            })),
          }
    ),
  };
}

/** `set` with no instance of Button giving its `Label` property a value. */
function withoutLabelValue(set: ComponentSetSpec): ComponentSetSpec {
  const onLayers = (layers: readonly ChildLayerSpec[]): readonly ChildLayerSpec[] =>
    layers.map((layer) => {
      if (layer.kind === "frame") {
        return { ...layer, children: onLayers(layer.children) };
      }
      if (
        layer.kind !== "instance" ||
        layer.componentSet !== "button" ||
        layer.properties?.text === undefined
      ) {
        return layer;
      }
      const { Label: _, ...text } = layer.properties.text;
      return { ...layer, properties: { ...layer.properties, text } };
    });
  return {
    ...set,
    variants: set.variants.map((variant) => ({
      ...variant,
      root: { ...variant.root, children: onLayers(variant.root.children) },
    })),
  };
}

/**
 * `kit` with every Button label sized as Dropdown menu's shortcut keys are, in a literal size and
 * line height, which a label that shows a glyph needs (G12b).
 */
function glyphReady(kit: KitSpec): KitSpec {
  const keys = kit.componentSets
    .find((set) => set.name === "Dropdown menu item")
    ?.variants.flatMap((variant) => walkLayers(variant.root))
    .find((layer): layer is TextLayerSpec => layer.kind === "text" && layer.key === "keys");
  if (keys === undefined) {
    throw new Error("the kit's Dropdown menu item shows no shortcut keys");
  }
  return withButtonLabels(kit, (label) => ({
    ...label,
    fontSize: keys.fontSize,
    lineHeight: keys.lineHeight,
  }));
}

/**
 * `kit` with every Button label static, as `edit` makes it, and no instance giving one a value: the
 * Button set has no TEXT property.
 */
function staticButtonLabels(kit: KitSpec, edit: (label: TextLayerSpec) => TextLayerSpec): KitSpec {
  return withButtonLabels(
    {
      ...kit,
      componentSets: kit.componentSets.map((set) =>
        set.name === "Button" ? { ...set, textProperties: [] } : withoutLabelValue(set)
      ),
    },
    (label) => edit({ ...label, textProperty: undefined })
  );
}

/** Each run of a text's characters in one font, with that font. */
function faces(text: TextNode): readonly (readonly [string, string])[] {
  return text
    .getStyledTextSegments(["fontName"])
    .map((segment) => [segment.characters, `${segment.fontName.family} ${segment.fontName.style}`] as const);
}

/** The first row's label, as change lines and errors name it. */
const FIRST_LABEL = "List detail / content=empty / list-detail-list / row-1 / button / label";

/** A family whose only face is Regular, as Google Fonts ships it. */
const PACIFICO = { family: "Pacifico", style: "Regular" } as const;

const LATO = { family: "Lato", style: "Medium" } as const;

/**
 * Give a label the Medium of each family a designer chose, in turn: the first as a whole-text font
 * write, which sets the style a TEXT write resets the label to (G5), and each after as a range over
 * every character, which leaves that style in the fake (rule 51). No probe has read what a TEXT write
 * restores once a range covers every character, and a face write lands in the main's family either
 * way. Then start a new run.
 */
async function designFonts(file: FakeFigma, label: TextNode, families: readonly string[]): Promise<void> {
  for (const [index, family] of families.entries()) {
    const font = { family, style: "Medium" };
    await file.figma.loadFontAsync(font);
    if (index === 0) {
      label.fontName = font;
    } else {
      label.setRangeFontName(0, label.characters.length, font);
    }
  }
  file.reopen();
}

/**
 * The first row's Button on a file the kit landed on with every Button label static and its weight
 * bound to the kit's one weight variable, `selection-title-weight`, which is 400 in the file's
 * default modes and names Regular (CSS Fonts 4 §2.2). Given `characters`, each label shows them,
 * sized as a label that shows a glyph needs (`glyphReady`).
 */
async function boundWeightRow(characters?: string) {
  const { kit, collections } = await kitFixture();
  const weight = kit.componentSets
    .flatMap((set) => set.variants.flatMap((variant) => walkLayers(variant.root)))
    .find((layer): layer is TextLayerSpec => layer.kind === "text" && layer.weight !== undefined)?.weight;
  if (weight === undefined) {
    throw new Error("the kit binds no label's weight");
  }
  const weighted =
    characters === undefined
      ? staticButtonLabels(kit, (label) => ({ ...label, weight }))
      : staticButtonLabels(glyphReady(kit), (label) => ({ ...label, weight, characters }));
  const { file: applied } = await applyTo(createFakeFigma({ collections }), weighted);
  const { file, button } = await firstRow(applied);
  const variable = (await file.figma.variables.getLocalVariablesAsync("FLOAT")).find(
    (each) => each.name === weight.variable.name
  );
  return { file, button, weighted, variable };
}

/** `kit` with every Button variant's root as `edit` makes it. */
function withButtonRoots(kit: KitSpec, edit: (root: VariantSpec["root"]) => VariantSpec["root"]): KitSpec {
  return {
    ...kit,
    componentSets: kit.componentSets.map((set) =>
      set.name !== "Button"
        ? set
        : { ...set, variants: set.variants.map((variant) => ({ ...variant, root: edit(variant.root) })) }
    ),
  };
}

/** `kit` with every Button root hugging its height within the limits `edit` gives it. */
function huggingButtons(kit: KitSpec, edit: (root: VariantSpec["root"]) => LimitsSpec): KitSpec {
  return withButtonRoots(kit, (root) => ({
    ...root,
    sizing: { ...root.sizing, vertical: { kind: "hug" } },
    limits: edit(root),
  }));
}

/** `kit` with every Button variant's stroke of one weight dashed by `dashPattern`. */
function withDashedButton(kit: KitSpec, dashPattern: readonly number[]): KitSpec {
  return withButtonRoots(kit, (root) =>
    root.stroke === undefined || "sides" in root.stroke
      ? root
      : { ...root, stroke: { ...root.stroke, dashPattern } }
  );
}

const START = { top: 0, right: 0, bottom: 0, left: 1 };

describe("an instance's stroke weights on an applied file", () => {
  it("override the main's on the instance, and the next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    const sided = withOverride(kit, { path: [], field: "strokeSides", sides: START });
    const { file, button } = await firstRow();
    expect(await reconcile(file, sided)).toContain(
      "List detail / content=empty / list-detail-list / row-1 / button: stroke weights → 0 0 0 1"
    );
    await reconcile(file, sided, true);
    expect([
      [button.strokeTopWeight, button.strokeRightWeight, button.strokeBottomWeight, button.strokeLeftWeight],
      await reconcile(file, sided),
    ]).toEqual([[0, 0, 0, 1], []]);
  });

  it("go back to the main's where the kit drops the override", async () => {
    const { kit } = await kitFixture();
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, { path: [], field: "strokeSides", sides: START }), true);
    expect(await reconcile(file, kit)).toContain(
      "List detail / content=empty / list-detail-list / row-1 / button: strokeWeight → 1"
    );
    await reconcile(file, kit, true);
    expect([
      [button.strokeTopWeight, button.strokeRightWeight, button.strokeBottomWeight, button.strokeLeftWeight],
      await reconcile(file, kit),
    ]).toEqual([[1, 1, 1, 1], []]);
  });

  it("go back to the main's one weight where the kit drops the override as the main turns dashed", async () => {
    const { kit } = await kitFixture();
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, { path: [], field: "strokeSides", sides: START }), true);
    const dashed = withDashedButton(kit, [2, 2]);
    await reconcile(file, dashed, true);
    expect([
      [button.strokeTopWeight, button.strokeRightWeight, button.strokeBottomWeight, button.strokeLeftWeight],
      await reconcile(file, dashed),
    ]).toEqual([[1, 1, 1, 1], []]);
  });
});

/** Each corner of a layer, as its variable's name where it binds one, else its radius. */
async function cornersOf(file: FakeFigma, node: InstanceNode): Promise<readonly (string | number)[]> {
  const fields = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
  return Promise.all(
    fields.map(async (field) => {
      const id = node.boundVariables?.[field]?.id;
      return id === undefined
        ? node[field]
        : ((await file.figma.variables.getVariableByIdAsync(id))?.name ?? id);
    })
  );
}

const RADIUS_MD = { kind: "variable", variable: { collection: "Fuse tokens", name: "radius-md" } } as const;

const RADIUS_BUTTON = {
  kind: "variable",
  variable: { collection: "Fuse tokens", name: "radius-button" },
} as const;

const SQUARE = { kind: "literal", value: 0 } as const;

const BUTTON = "List detail / content=empty / list-detail-list / row-1 / button";

/** The main component an instance shows. */
async function mainOf(instance: InstanceNode): Promise<ComponentNode> {
  const main = await instance.getMainComponentAsync();
  if (main === null) {
    throw new Error(`${instance.name} shows no main`);
  }
  return main;
}

// Oracle: probes CR1 to CR3 on a real file on 2026-11-21. An instance took a literal and a bound
// corner each on its own, the corners it left kept following the main through the main's later
// edits, and a corner written back to the main's binding stayed the instance's own. A bound corner
// listed `boundVariables` alone, so the plan reads that field to take a dropped binding back to the
// main's.
describe("an instance's corners on an applied file", () => {
  // A horizontal group's first member keeps the main's rounding on its left and squares its right.
  const FIRST_MEMBER: InstanceOverride = {
    path: [],
    field: "cornerRadius",
    value: {
      kind: "corners",
      topLeft: RADIUS_BUTTON,
      topRight: SQUARE,
      bottomRight: SQUARE,
      bottomLeft: RADIUS_BUTTON,
    },
  };

  it("override the main's corner by corner, and go back to it corner by corner where the kit drops them", async () => {
    const { kit } = await kitFixture();
    const member = withOverride(kit, FIRST_MEMBER);
    const { file, button } = await firstRow();
    await reconcile(file, member, true);
    expect([await cornersOf(file, button), await reconcile(file, member)]).toEqual([
      ["radius-button", 0, 0, "radius-button"],
      [],
    ]);
    const dropped = await reconcile(file, kit);
    await reconcile(file, kit, true);
    const again = await reconcile(file, kit);
    const main = await mainOf(button);
    main.setBoundVariable("topLeftRadius", null);
    main.topLeftRadius = 7;
    expect([
      dropped.filter((line) => line.startsWith(`${BUTTON}: `)),
      again,
      await cornersOf(file, button),
    ]).toEqual([
      [`${BUTTON}: topRightRadius → radius-button`, `${BUTTON}: bottomRightRadius → radius-button`],
      [],
      [7, "radius-button", "radius-button", "radius-button"],
    ]);
  });

  it("go back to the main's binding where the kit drops a corner override bound to another variable", async () => {
    const { kit } = await kitFixture();
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, { path: [], field: "cornerRadius", value: RADIUS_MD }), true);
    await reconcile(file, kit, true);
    expect([await cornersOf(file, button), await reconcile(file, kit)]).toEqual([
      ["radius-button", "radius-button", "radius-button", "radius-button"],
      [],
    ]);
  });
});

// Oracle: probe CR6, where a real file's instance listed `boundVariables` alone after a bound
// padding. A group member's `[--button-px-floor:0px]` binds its padding to the plain inset.
describe("an instance's bound padding on an applied file", () => {
  it("takes a dropped padding binding back to the main's", async () => {
    const { kit } = await kitFixture();
    const plain = {
      kind: "variable",
      variable: { collection: "Fuse density", name: "control-px-button-md" },
    } as const;
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, { path: [], field: "paddingLeft", value: plain }), true);
    expect(await reconcile(file, kit)).toContain(`${BUTTON}: paddingLeft → button-label-px/md`);
    await reconcile(file, kit, true);
    const id = button.boundVariables?.paddingLeft?.id;
    expect([
      id === undefined ? undefined : (await file.figma.variables.getVariableByIdAsync(id))?.name,
      await reconcile(file, kit),
    ]).toEqual(["button-label-px/md", []]);
  });
});

describe("an instance label's face on an applied file", () => {
  const REGULAR: InstanceOverride = { path: ["label"], field: "fontStyle", style: "Regular" };

  it("overrides the main's on the label, keeps its family bound, and the next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    const regular = withOverride(kit, REGULAR);
    const { file, button } = await firstRow();
    expect(await reconcile(file, regular)).toContain(
      "List detail / content=empty / list-detail-list / row-1 / button / label: font → Roboto Regular"
    );
    await reconcile(file, regular, true);
    const label = childNamed(button, "TEXT", "label");
    expect([
      label.fontName,
      label.boundVariables?.fontFamily?.[0]?.id !== undefined,
      await reconcile(file, regular),
    ]).toEqual([{ family: "Roboto", style: "Regular" }, true, []]);
  });

  it("goes back to the main's where the kit drops the override", async () => {
    const { kit } = await kitFixture();
    const { file, button } = await firstRow();
    await reconcile(file, withOverride(kit, REGULAR), true);
    expect(await reconcile(file, kit)).toContain(
      "List detail / content=empty / list-detail-list / row-1 / button / label: font → Roboto Medium"
    );
    await reconcile(file, kit, true);
    expect([childNamed(button, "TEXT", "label").fontName, await reconcile(file, kit)]).toEqual([
      { family: "Roboto", style: "Medium" },
      [],
    ]);
  });

  // A face write lands in the main label's family whatever the label holds, so neither a designer's
  // whole-text font, which a TEXT write resets the label to (G5), nor a range over every character
  // changes the face it ends in, and a main that changes first defers the write.
  it.each([
    ["as a TEXT write runs first", [], (kit: KitSpec) => kit],
    ["in a family a designer gave the label", ["Lato"], (kit: KitSpec) => kit],
    [
      "in a family a designer gave the label, as the main's stroke changes",
      ["Georgia"],
      (kit: KitSpec) => withDashedButton(kit, [2, 2]),
    ],
    [
      "over a designer's family and a range of another over every character",
      ["Lato", "Georgia"],
      (kit: KitSpec) => kit,
    ],
  ])("writes the main's family in the face before the first write, %s", async (_, designed, mainOf) => {
    const { kit } = await kitFixture();
    const bold = onFirstRowButton(mainOf(glyphReady(kit)), (button) => ({
      ...button,
      properties: { ...button.properties, text: { ...button.properties?.text, Label: "Save ⌘S" } },
      overrides: [...(button.overrides ?? []), { path: ["label"], field: "fontStyle", style: "Bold" }],
    }));
    const { file, button } = await firstRow();
    await designFonts(file, childNamed(button, "TEXT", "label"), designed);
    await reconcile(file, bold, true);
    expect([faces(childNamed(button, "TEXT", "label")), await reconcile(file, bold)]).toEqual([
      [
        ["Save ", "Roboto Bold"],
        ["⌘", "Inter Bold"],
        ["S", "Roboto Bold"],
      ],
      [],
    ]);
  });

  it("writes a face over a character in a family that lacks it, which the label keeps no character of", async () => {
    const { kit } = await kitFixture();
    const bold = withOverride(kit, { path: ["label"], field: "fontStyle", style: "Bold" });
    const { file, button } = await firstRow();
    const label = childNamed(button, "TEXT", "label");
    await file.figma.loadFontAsync(PACIFICO);
    label.setRangeFontName(2, 3, PACIFICO);
    file.reopen({ unavailableFonts: [{ family: PACIFICO.family, style: "Bold" }] });
    await reconcile(file, bold, true);
    expect([faces(label), await reconcile(file, bold)]).toEqual([[[label.characters, "Roboto Bold"]], []]);
  });

  // The face write that clears the binding replaces the glyph ranges too (G8), which go back on after.
  it.each([
    ["its own characters", undefined, (characters: string) => [[characters, "Roboto Regular"]]],
    [
      "glyphs",
      "⌘P",
      () => [
        ["⌘", "Inter Regular"],
        ["P", "Roboto Regular"],
      ],
    ],
  ])(
    "clears a bound weight under a literal face a label of %s already shows, and the next Plan lists nothing",
    async (_, characters, shown) => {
      const { file, button, weighted, variable } = await boundWeightRow(characters);
      const regular = withOverride(weighted, REGULAR);
      await reconcile(file, regular, true);
      const label = childNamed(button, "TEXT", "label");
      expect([
        variable !== undefined,
        faces(label),
        label.boundVariables?.fontWeight,
        await reconcile(file, regular),
      ]).toEqual([true, shown(label.characters), undefined, []]);
    }
  );

  it("binds the weight again over a character a designer gave another family, and the next Plan lists nothing", async () => {
    const { file, button, weighted, variable } = await boundWeightRow();
    const label = childNamed(button, "TEXT", "label");
    await file.figma.loadFontAsync(LATO);
    label.setRangeFontName(0, 1, LATO);
    file.reopen();
    expect(await reconcile(file, weighted)).toContain(`${FIRST_LABEL}: fontWeight → ${variable?.name ?? ""}`);
    await reconcile(file, weighted, true);
    expect([
      faces(label),
      label.getRangeBoundVariable(0, label.characters.length, "fontWeight"),
      await reconcile(file, weighted),
    ]).toEqual([
      [
        [label.characters.slice(0, 1), "Lato Regular"],
        [label.characters.slice(1), "Roboto Regular"],
      ],
      { type: "VARIABLE_ALIAS", id: variable?.id },
      [],
    ]);
  });

  it.each([
    [
      "a range over every character, under a TEXT write and a face",
      "Georgia Medium",
      async () => {
        const { kit } = await kitFixture();
        const { file, button } = await firstRow();
        await designFonts(file, childNamed(button, "TEXT", "label"), ["Lato", "Georgia"]);
        const bold = onFirstRowButton(kit, (layer) => ({
          ...layer,
          properties: { ...layer.properties, text: { ...layer.properties?.text, Label: "Save" } },
          overrides: [...(layer.overrides ?? []), { path: ["label"], field: "fontStyle", style: "Bold" }],
        }));
        return { file, kit: bold, unavailable: { family: "Georgia", style: "Medium" } };
      },
    ],
    [
      "a character of another family, under a weight bound again",
      "Lato Medium",
      async () => {
        const { file, button, weighted } = await boundWeightRow();
        await file.figma.loadFontAsync(LATO);
        childNamed(button, "TEXT", "label").setRangeFontName(0, 1, LATO);
        return { file, kit: weighted, unavailable: LATO };
      },
    ],
  ])("stops before the first write where Figma cannot load the font of %s", async (_, font, setUp) => {
    const { file, kit, unavailable } = await setUp();
    file.reopen({ unavailableFonts: [unavailable] });
    const before = file.writes.length;
    await expect(reconcile(file, kit, true)).rejects.toThrow(
      `${FIRST_LABEL} needs the font ${font}, which Figma cannot load.`
    );
    expect(file.writes.slice(before)).toEqual([]);
  });

  // A held instance keeps the font an earlier TEXT value gave its label, so each kit lands on a new
  // file, whose instances show their main's label.
  it.each([
    [
      "a label in the glyph font's family",
      (kit: KitSpec) =>
        withButtonLabels(kit, (label) => ({ ...label, fontFamily: { kind: "literal", value: "Inter" } })),
      [["Henrik Aasen", "Inter Regular"]],
      "Inter",
    ],
    [
      "an empty label",
      (kit: KitSpec) =>
        onFirstRowButton(kit, (button) => ({
          ...button,
          properties: { ...button.properties, text: { ...button.properties?.text, Label: "" } },
        })),
      [],
      "Roboto",
    ],
  ])("writes the face on %s", async (_, kitOf, shown, family) => {
    const { kit, collections } = await kitFixture();
    const base = kitOf(kit);
    const regular = withOverride(base, REGULAR);
    const { file: applied } = await applyTo(createFakeFigma({ collections }), base);
    const { file, button } = await firstRow(applied);
    await reconcile(file, regular, true);
    const label = childNamed(button, "TEXT", "label");
    expect([faces(label), label.fontName, await reconcile(file, regular)]).toEqual([
      shown,
      { family, style: "Regular" },
      [],
    ]);
  });

  it.each([
    [
      "⌘P",
      [
        ["⌘", "Inter SemiBold"],
        ["P", "Roboto SemiBold"],
      ],
      [
        ["⌘", "Inter Medium"],
        ["P", "Roboto Medium"],
      ],
    ],
  ])(
    "keeps a static label's glyphs of %s in the glyph font as its face changes and goes back",
    async (characters, faced, restored) => {
      const { kit, collections } = await kitFixture();
      const staticLabel = staticButtonLabels(glyphReady(kit), (label) => ({ ...label, characters }));
      const semiBold = withOverride(staticLabel, { path: ["label"], field: "fontStyle", style: "SemiBold" });
      // A held instance keeps the characters an earlier TEXT value gave it, so the kit lands on a new file.
      const { file: applied } = await applyTo(createFakeFigma({ collections }), staticLabel);
      const { file, button } = await firstRow(applied);
      await reconcile(file, semiBold, true);
      const shown = [faces(childNamed(button, "TEXT", "label")), await reconcile(file, semiBold)];
      await reconcile(file, staticLabel, true);
      expect([
        ...shown,
        faces(childNamed(button, "TEXT", "label")),
        await reconcile(file, staticLabel),
      ]).toEqual([faced, [], restored, []]);
    }
  );

  it("goes back to a static label's bound weight where the kit drops the override as the main binds one", async () => {
    const { kit, collections } = await kitFixture();
    const weight = kit.componentSets
      .flatMap((set) => set.variants.flatMap((variant) => walkLayers(variant.root)))
      .find((layer): layer is TextLayerSpec => layer.kind === "text" && layer.weight !== undefined)?.weight;
    if (weight === undefined) {
      throw new Error("the kit binds no label's weight");
    }
    const staticLabel = staticButtonLabels(kit, (label) => label);
    const { file: applied } = await applyTo(createFakeFigma({ collections }), staticLabel);
    const { file, button } = await firstRow(applied);
    await reconcile(
      file,
      withOverride(staticLabel, { path: ["label"], field: "fontStyle", style: "Bold" }),
      true
    );
    // The kit's one bound weight, `selection-title-weight`, is 400 in the file's default modes, which
    // names Regular (CSS Fonts 4 §2.2).
    const weighted = staticButtonLabels(kit, (label) => ({ ...label, weight }));
    await reconcile(file, weighted, true);
    const label = childNamed(button, "TEXT", "label");
    const variable = (await file.figma.variables.getLocalVariablesAsync("FLOAT")).find(
      (each) => each.name === weight.variable.name
    );
    expect([
      label.fontName,
      label.boundVariables?.fontWeight?.[0]?.id,
      await reconcile(file, weighted),
    ]).toEqual([{ family: "Roboto", style: "Regular" }, variable?.id, []]);
  });
});

describe("an instance's width limits on an applied file", () => {
  // A literal `minWidth` write also lists `minHeight` among the instance's overrides (PH3), and the
  // instance keeps the number it showed then through a change of the main's literal, while a binding
  // the main holds shows through (MH). So the instance shows a changed literal of the main's only once
  // the plan writes it.
  it("carries the instance's minimum, follows the main's minimum height through a literal, a binding and none, and each next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    // A minimum height holds on a main that hugs its height, which the kit check asks of it.
    const tall = (minHeight: (root: VariantSpec["root"]) => NumberSpec | undefined) => (base: KitSpec) =>
      huggingButtons(base, (root) => ({ ...root.limits, minHeight: minHeight(root) }));
    const literal = (value: number) => tall(() => ({ kind: "literal", value }));
    const carried = (base: KitSpec) =>
      onFirstRowButton(base, (layer) => ({ ...layer, minWidth: { kind: "literal", value: 120 } }));
    // Each Button variant binds its root's left padding, a number variable the main's minimum can take.
    const bound = tall((root) => root.paddingLeft);
    const { file, button } = await firstRow();
    const main = await button.getMainComponentAsync();
    const steps: (readonly [number | null, number | null, string | undefined, readonly string[]])[] = [];
    // The second Apply carries the minimum and changes the main's height in one run.
    for (const each of [
      literal(40)(kit),
      carried(literal(56)(kit)),
      carried(literal(64)(kit)),
      carried(bound(kit)),
      carried(literal(72)(kit)),
      carried(tall(() => undefined)(kit)),
    ]) {
      await reconcile(file, each, true);
      steps.push([
        button.minWidth,
        button.minHeight,
        button.boundVariables?.minHeight?.id,
        await reconcile(file, each),
      ]);
    }
    const padding = main?.boundVariables?.paddingLeft?.id;
    expect(padding).toBeDefined();
    expect(steps).toEqual([
      [null, 40, undefined, []],
      [120, 56, undefined, []],
      [120, 64, undefined, []],
      [120, main?.paddingLeft, padding, []],
      [120, 72, undefined, []],
      [120, null, undefined, []],
    ]);
  });

  // A `maxWidth` write also lists `maxHeight` among the instance's overrides (SW), and the instance
  // keeps the height cap it showed then through a change of the main's literal (MH), so the instance
  // shows the main's height cap only once the plan writes it.
  it("caps the instance, follows the main's height cap, goes back to the main's width cap where the kit drops it, and each next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    // A main with a cap of its own tells going back to it from clearing the instance's.
    const mainCap = withButtonRoots(kit, (root) => ({
      ...root,
      limits: { ...root.limits, maxWidth: { kind: "literal", value: 300 } },
    }));
    const capped = onFirstRowButton(mainCap, (layer) => ({
      ...layer,
      maxWidth: { kind: "literal", value: 224 },
    }));
    // A height cap holds on a main that hugs its height, which the kit check asks of it.
    const tall = huggingButtons(capped, (root) => ({
      ...root.limits,
      maxHeight: { kind: "literal", value: 60 },
    }));
    const { file, button } = await firstRow();
    const steps: (readonly [number | null, number | null, readonly string[]])[] = [];
    for (const each of [mainCap, capped, tall, mainCap]) {
      await reconcile(file, each, true);
      steps.push([button.maxWidth, button.maxHeight, await reconcile(file, each)]);
    }
    expect(steps).toEqual([
      [300, null, []],
      [224, null, []],
      [224, 60, []],
      [300, null, []],
    ]);
  });
});

describe("an instance's root padding on an applied file", () => {
  // Rule 64 lists an instance's own padding under its name, so the plan reads a held override and
  // writes the main's binding back where the kit drops it.
  it("overrides the main's side, goes back to the main's binding where the kit drops it, and each next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    const padded = withOverride(kit, {
      path: [],
      field: "paddingLeft",
      value: { kind: "literal", value: 3 },
    });
    const { file, button } = await firstRow();
    const main = await button.getMainComponentAsync();
    const steps: (readonly [number, string | undefined, readonly string[]])[] = [];
    for (const each of [padded, kit]) {
      await reconcile(file, each, true);
      steps.push([button.paddingLeft, button.boundVariables?.paddingLeft?.id, await reconcile(file, each)]);
    }
    expect(steps).toEqual([
      [3, undefined, []],
      [main?.paddingLeft, main?.boundVariables?.paddingLeft?.id, []],
    ]);
  });
});

describe("a padding inside an instance on an applied file", () => {
  // The kit overrides a padding on the root alone, so one a designer sets on a frame below it is
  // no override the kit dropped.
  it("keeps a designer's inset on a frame inside an instance through Apply, and the next Plan lists nothing", async () => {
    const { kit } = await kitFixture();
    const file = await appliedFile();
    const set = setOn(await kitPage(file, "page/radio"), "Radio row");
    const variant = set.children.find(
      (node) => keyOf(node) === "radio-row/width=hug,checked=true,state=rest"
    );
    if (variant?.type !== "COMPONENT") {
      throw new Error("the Radio row set holds no checked variant at its hugging width");
    }
    const radio = childNamed(childNamed(variant, "FRAME", "label"), "INSTANCE", "radio-group-item");
    const indicator = childNamed(radio, "FRAME", "radio-group-indicator");
    indicator.paddingLeft = 3;
    file.reopen();
    await reconcile(file, kit, true);
    expect([indicator.paddingLeft, await reconcile(file, kit)]).toEqual([3, []]);
  });
});
