/**
 * Unit under test: `reconcileKit`'s text styles, on the in-memory file in `fake-figma.ts`, which
 * models a real file's text styles as probe PT1 read them (fake rule 59). The oracles are the Plan and
 * Apply contract every kit node keeps (Plan lists each write, Apply makes them, a second Plan lists none) and, for
 * the whole kit, type the Fuse recipes document: Text's `sm`, `default` and `lg` sizes read the
 * theme's paragraph line heights and `bold` caps at `medium` (`text-variants.ts`), Span sets a snug
 * 1.375 line (`span-variants.ts`), Heading levels 1 to 3 read the theme's `--heading-<level>-*` roles
 * (`heading-class.ts`), and Tailwind's scale sets `text-xs` at 12px, `text-2xl` at 24px, `text-6xl`
 * at 60px, `leading-relaxed` at 1.625 and `leading-tight` at 1.25.
 */
import { describe, expect, it } from "vitest";

import { PLUGIN_DATA_KEY, PLUGIN_DATA_NAMESPACE } from "../../src/components/kit-spec.ts";
import type { TextStyleSpec } from "../../src/components/kit-spec.ts";
import type { VariableValue as SyncedValue, VariableType } from "../../src/variable-set.ts";
import { applyTo, KIT, literal } from "./button-kit-fixture.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { color, fixtureFile, float, string } from "./fake-fixtures.ts";
import { appliedFile, kitFixture } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** The lines of a report that touch the text styles. */
function styleLines(changes: readonly string[]): string[] {
  return changes.filter((line) => line.startsWith("Text styles"));
}

/** A style by name. */
async function styleNamed(file: FakeFigma, name: string): Promise<TextStyle> {
  const style = (await file.figma.getLocalTextStylesAsync()).find((candidate) => candidate.name === name);
  if (style === undefined) {
    throw new Error(`the file has no text style ${name}`);
  }
  return style;
}

/** What a style holds: each bound field as `Collection/name`, and the literal font, size and line height. */
function typeOf(file: FakeFigma, style: TextStyle) {
  const names = new Map<string, string>();
  const bound = (field: VariableBindableTextField) => {
    const id = style.boundVariables?.[field]?.id;
    return id === undefined ? undefined : names.get(id);
  };
  for (const [collection, name] of [
    ["Fuse tokens", "font-sans"],
    ["Fuse tokens", "font-heading"],
    ["Fuse tokens", "heading-1-weight"],
    ["Fuse tokens", "heading-1-size"],
    ["Fuse tokens", "heading-1-leading"],
    ["Fuse tokens", "paragraph-leading-sm"],
  ] as const) {
    names.set(file.variable(collection, name).id, `${collection}/${name}`);
  }
  return {
    family: bound("fontFamily"),
    weight: bound("fontWeight"),
    size: bound("fontSize") ?? style.fontSize,
    lineHeight: bound("lineHeight") ?? style.lineHeight,
    style: bound("fontWeight") === undefined ? style.fontName.style : undefined,
  };
}

describe("the kit's text styles on a synced file", () => {
  it("Plan lists each style's creation, Apply makes them, and a second Plan lists none", async () => {
    const { kit, collections } = await kitFixture();
    const file = createFakeFigma({ collections });
    const planned = styleLines((await reconcileKit(file.figma, kit, false)).changes);
    expect(planned).toEqual(
      expect.arrayContaining(["Text styles: create Heading/1", "Text styles: create Span/sm/regular"])
    );
    expect(planned.every((line) => line.startsWith("Text styles: create "))).toBe(true);

    const applied = await appliedFile();
    expect(styleLines((await reconcileKit(applied.figma, kit, false)).changes)).toEqual([]);
    const names = (await applied.figma.getLocalTextStylesAsync()).map((style) => style.name);
    expect(names.map((name) => `Text styles: create ${name}`)).toEqual(planned);
  });

  it("binds each type field to the synced variable the recipe reads, and writes literals elsewhere", async () => {
    const file = await appliedFile();
    const type = async (name: string) => typeOf(file, await styleNamed(file, name));
    expect(await type("Heading/1")).toEqual({
      family: "Fuse tokens/font-heading",
      weight: "Fuse tokens/heading-1-weight",
      size: "Fuse tokens/heading-1-size",
      lineHeight: "Fuse tokens/heading-1-leading",
      style: undefined,
    });
    expect(await type("Text/sm/regular")).toEqual({
      family: "Fuse tokens/font-sans",
      weight: undefined,
      size: 14,
      lineHeight: "Fuse tokens/paragraph-leading-sm",
      style: "Regular",
    });
    expect(await type("Text/xs/medium")).toEqual({
      family: "Fuse tokens/font-sans",
      weight: undefined,
      size: 12,
      lineHeight: { unit: "PIXELS", value: 19.5 },
      style: "Medium",
    });
    expect(await type("Span/2xl/regular")).toEqual({
      family: "Fuse tokens/font-sans",
      weight: undefined,
      size: 24,
      lineHeight: { unit: "PIXELS", value: 33 },
      style: "Regular",
    });
    expect(await type("Heading/6xl/semibold")).toEqual({
      family: "Fuse tokens/font-heading",
      weight: undefined,
      size: 60,
      lineHeight: { unit: "PIXELS", value: 75 },
      style: "SemiBold",
    });
    const textSm = (await file.figma.getLocalTextStylesAsync())
      .map((style) => style.name)
      .filter((name) => name.startsWith("Text/sm/"));
    expect(textSm).toEqual(["Text/sm/regular", "Text/sm/medium"]);
  });
});

/** A body style whose family and line height bind variables, and whose size is a literal. */
const BODY: TextStyleSpec = {
  key: "text-style/body",
  name: "Body/regular",
  description: "Body text.",
  fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
  fontWeight: { kind: "literal", style: "Regular" },
  fontSize: literal(14),
  lineHeight: { kind: "variable", variable: { collection: "Fuse tokens", name: "leading" } },
  letterSpacing: { unit: "PERCENT", value: 0 },
  textCase: "ORIGINAL",
  textDecoration: "NONE",
  textWrapStyle: "AUTO",
};

/** A heading style whose weight binds a variable. */
const TITLE: TextStyleSpec = {
  ...BODY,
  key: "text-style/title",
  name: "Title",
  description: "A title.",
  fontWeight: { kind: "variable", variable: { collection: "Fuse tokens", name: "weight" } },
  fontSize: literal(24),
  lineHeight: literal(32),
};

/** The one-variant kit without its set, keeping these styles. */
const styleKit = (textStyles: readonly TextStyleSpec[]) => ({
  ...KIT,
  componentSets: [],
  fonts: [],
  textStyles,
  // No page holds a set, so none has docs.
  docs: [],
});

/** A synced file that holds the variables the two styles bind, and the kit applied to it. */
async function appliedStyles(): Promise<FakeFigma> {
  const file = fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    string("Fuse tokens", "font-sans", "Roboto"),
    float("Fuse tokens", "leading", 20),
    float("Fuse tokens", "weight", 500),
  ]);
  return applyTo(file, styleKit([BODY, TITLE]));
}

describe("a text style's identity across runs", () => {
  it("finds a renamed style by its key, names it back and keeps its id", async () => {
    const file = await appliedStyles();
    const body = await styleNamed(file, "Body/regular");
    body.name = "Paragraph";
    const plan = await reconcileKit(file.figma, styleKit([BODY, TITLE]), false);
    expect(styleLines(plan.changes)).toEqual(["Text styles / Body/regular: rename from Paragraph"]);
    await reconcileKit(file.figma, styleKit([BODY, TITLE]), true);
    expect((await styleNamed(file, "Body/regular")).id).toBe(body.id);
  });

  it("writes a designer's edit of a bound field back as one type change, then converges", async () => {
    const file = await appliedStyles();
    const body = await styleNamed(file, "Body/regular");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    body.setBoundVariable("lineHeight", null);
    body.lineHeight = { unit: "PIXELS", value: 24 };
    const plan = await reconcileKit(file.figma, styleKit([BODY, TITLE]), false);
    expect(styleLines(plan.changes)).toEqual(["Text styles / Body/regular: lineHeight → leading"]);
    await reconcileKit(file.figma, styleKit([BODY, TITLE]), true);
    expect(styleLines((await reconcileKit(file.figma, styleKit([BODY, TITLE]), false)).changes)).toEqual([]);
  });

  it("deletes a style the kit dropped, keeps a designer's own style, and adopts one by name", async () => {
    const file = await appliedStyles();
    const own = file.figma.createTextStyle();
    own.name = "paragraph/regular";
    const named = file.figma.createTextStyle();
    named.name = "Caption";
    const caption: TextStyleSpec = { ...BODY, key: "text-style/caption", name: "Caption", description: "" };
    const plan = await reconcileKit(file.figma, styleKit([BODY, caption]), false);
    expect(styleLines(plan.changes)).toEqual([
      "Text styles: delete Title",
      "Text styles: adopt the text style named Caption as text-style/caption",
      // A new style holds Inter Regular at 12, so the Regular style stays.
      "Text styles / Caption: fontFamily → font-sans, fontSize → 14, lineHeight → leading",
    ]);
    await reconcileKit(file.figma, styleKit([BODY, caption]), true);
    const names = (await file.figma.getLocalTextStylesAsync()).map((style) => style.name);
    expect(names).toEqual(["Body/regular", "paragraph/regular", "Caption"]);
    expect(styleLines((await reconcileKit(file.figma, styleKit([BODY, caption]), false)).changes)).toEqual(
      []
    );
  });

  it("stops Plan and Apply before any write when two styles carry one key", async () => {
    const file = await appliedStyles();
    const copy = file.figma.createTextStyle();
    copy.setSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY, BODY.key);
    const writes = file.writes.length;
    const message = "Text styles holds 2 text styles with the key text-style/body.";
    await expect(reconcileKit(file.figma, styleKit([BODY, TITLE]), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, styleKit([BODY, TITLE]), true)).rejects.toThrow(message);
    expect(file.writes.length).toBe(writes);
  });
});

/**
 * A synced file whose `Fuse tokens` weight aliases one in `Fuse identity`, which holds one weight in
 * its first mode, `Branded`, and another in `Neutral`, as the heading weights do.
 */
function identityWeightFile(branded: number, neutral: number, unavailableFonts: readonly FontName[] = []) {
  const variable = (name: string, type: VariableType, value: SyncedValue) => ({
    name,
    type,
    scopes: [],
    webSyntax: undefined,
    description: "",
    values: new Map([["Default", value]]),
  });
  return createFakeFigma({
    collections: [
      {
        name: "Fuse tokens",
        modes: ["Default"],
        variables: [
          variable("background", "COLOR", { _tag: "Color", color: { r: 1, g: 1, b: 1, a: 1 } }),
          variable("font-sans", "STRING", { _tag: "String", value: "Roboto" }),
          variable("leading", "FLOAT", { _tag: "Float", value: 20 }),
          variable("weight", "FLOAT", {
            _tag: "Alias",
            target: { collection: "Fuse identity", variable: "weight" },
          }),
        ],
      },
      {
        name: "Fuse identity",
        modes: ["Branded", "Neutral"],
        variables: [
          {
            ...variable("weight", "FLOAT", { _tag: "Float", value: branded }),
            values: new Map<string, SyncedValue>([
              ["Branded", { _tag: "Float", value: branded }],
              ["Neutral", { _tag: "Float", value: neutral }],
            ]),
          },
        ],
      },
    ],
    unavailableFonts,
  });
}

// Oracle: a style reads its bound weight in each collection's first mode (PT1), so the font the
// first mode's weight picks is the one the write needs, and the kit's font preflight fails a run before
// its first write when the machine lacks a font a write needs (`reconcile.test.ts`). A font only
// another mode picks is one a frame shows as missing, as Figma does for a kit label (#525).
describe("the fonts a text style's bound weight picks", () => {
  it("applies and converges when only a font another mode picks cannot load", async () => {
    const file = identityWeightFile(500, 700, [{ family: "Roboto", style: "Bold" }]);
    await reconcileKit(file.figma, styleKit([TITLE]), true);
    file.reopen({ unavailableFonts: [{ family: "Roboto", style: "Bold" }] });
    expect(styleLines((await reconcileKit(file.figma, styleKit([TITLE]), false)).changes)).toEqual([]);
    const title = await styleNamed(file, "Title");
    expect(title.fontName).toEqual({ family: "Roboto", style: "Medium" });
    expect(title.boundVariables?.fontWeight?.id).toBe(file.variable("Fuse tokens", "weight").id);
  });

  it("stops Plan and Apply before any write when the font the first mode picks cannot load", async () => {
    const file = identityWeightFile(700, 500, [{ family: "Roboto", style: "Bold" }]);
    const writes = file.writes.length;
    const message = "Text styles / Title needs the font Roboto Bold, which Figma cannot load.";
    await expect(reconcileKit(file.figma, styleKit([TITLE]), false)).rejects.toThrow(message);
    await expect(reconcileKit(file.figma, styleKit([TITLE]), true)).rejects.toThrow(message);
    expect(file.writes.length).toBe(writes);
  });

  it("writes the font the first mode's weight picks, and converges", async () => {
    const file = identityWeightFile(700, 500);
    await reconcileKit(file.figma, styleKit([TITLE]), true);
    file.reopen();
    expect(styleLines((await reconcileKit(file.figma, styleKit([TITLE]), false)).changes)).toEqual([]);
    const title = await styleNamed(file, "Title");
    expect(title.fontName).toEqual({ family: "Roboto", style: "Bold" });
    expect(title.boundVariables?.fontWeight?.id).toBe(file.variable("Fuse tokens", "weight").id);
  });
});

describe("a text style's other fields", () => {
  // Oracle: a recipe that sets no case, decoration or spacing draws text without them, so an
  // adopted style that holds them draws other type than the kit's.
  it("sets the case, decoration and spacing an adopted style held to the recipe's, and converges", async () => {
    const file = await appliedStyles();
    await file.figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const named = file.figma.createTextStyle();
    named.name = "Caption";
    named.textCase = "UPPER";
    named.textDecoration = "UNDERLINE";
    named.letterSpacing = { unit: "PIXELS", value: 3 };
    const caption: TextStyleSpec = { ...BODY, key: "text-style/caption", name: "Caption", description: "" };
    const plan = await reconcileKit(file.figma, styleKit([BODY, TITLE, caption]), false);
    expect(styleLines(plan.changes)).toEqual([
      "Text styles: adopt the text style named Caption as text-style/caption",
      "Text styles / Caption: fontFamily → font-sans, fontSize → 14, lineHeight → leading, letterSpacing → 0%, textCase → ORIGINAL, textDecoration → NONE",
    ]);
    await reconcileKit(file.figma, styleKit([BODY, TITLE, caption]), true);
    const adopted = await styleNamed(file, "Caption");
    expect([adopted.textCase, adopted.textDecoration, adopted.letterSpacing]).toEqual([
      "ORIGINAL",
      "NONE",
      { unit: "PERCENT", value: 0 },
    ]);
    expect(
      styleLines((await reconcileKit(file.figma, styleKit([BODY, TITLE, caption]), false)).changes)
    ).toEqual([]);
  });

  // Oracle: PT1, where a real file read a description back HTML-escaped (fake rule 59).
  it("converges on a description that holds characters a real file stores escaped", async () => {
    const file = await appliedStyles();
    const quoted: TextStyleSpec = { ...BODY, description: `Body & "caption" text, <p> or 'span'.` };
    await reconcileKit(file.figma, styleKit([quoted, TITLE]), true);
    expect(styleLines((await reconcileKit(file.figma, styleKit([quoted, TITLE]), false)).changes)).toEqual(
      []
    );
  });
});
