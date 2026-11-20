/**
 * The overrides a chip segment needs on its Button instance, on the in-memory file in
 * `fake-figma.ts`: the stroke's side weights on the root, the label's face and the root's widest
 * width. Unit under test: `instance-overrides.ts` and the sizing stage of `instance-layers.ts`, through
 * `reconcileKit` on a synced file. Oracle: the kit spec, here List detail's first row Button with an
 * override added, as a chip segment's `border-0 border-s` keeps only its start edge of Button's 1px
 * border, an operator's `font-normal` shows Regular where Button's label is Medium and a value's
 * `max-w-56` caps it at 224px, and what a real file's `overrides` listed on 2026-11-20: each side a
 * write changed, a text's `fontName` and an instance's `maxWidth`, each kept listed after the main's
 * value was written back (SW). The fonts each write needs and leaves follow the fake's text rules 7, 10,
 * 50 and 51 (PG8, PG13). No real file has run the plugin's writes yet: the owner's Apply is their
 * check.
 */
import { describe, expect, it } from "vitest";

import type {
  ChildLayerSpec,
  ComponentSetSpec,
  InstanceOverride,
  KitSpec,
  TextLayerSpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { walkLayers } from "../../src/components/kit-spec.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { applyTo, kitFixture } from "./kit-fixture.ts";
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

describe("an instance's widest width on an applied file", () => {
  // A `maxWidth` write also lists `maxHeight` among the instance's overrides (SW), and the fake keeps
  // an instance's own limits through a change of the main's, as an override keeps its value (N3), so
  // the instance shows the main's height cap only once the plan writes it.
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
    const tall = withButtonRoots(capped, (root) => ({
      ...root,
      sizing: { ...root.sizing, vertical: { kind: "hug" } },
      limits: { ...root.limits, maxHeight: { kind: "literal", value: 60 } },
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
