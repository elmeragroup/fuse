/**
 * A text layer whose weight binds a FLOAT variable, on the in-memory file in `fake-figma.ts`. Unit
 * under test: the text layer's plan through Apply and Plan. Oracles: the fake's rule 10, after
 * Figma's guide to typography variables, under which a `fontWeight` binding gives the text the face
 * its family names for the weight, Medium for 500; and rule 7, under which a run loads every font
 * before its first write, so a face the binding shows in another mode, which the machine lacks,
 * stops the run before it writes; probe PG8, under which a `fontName` write drops the `fontWeight`
 * binding, so a run that writes the label's font binds the weight again; and probe PG13, under which
 * a whole-text `fontWeight` binding written after the glyph ranges' font binds every range, `⌘` in
 * Inter included, so a run that writes a glyph range's font binds the whole text again. The same
 * holds for the label an instance of the set shows where its TEXT property sets other characters:
 * the TEXT write resets the label to one style (G5), and the run writes its glyph ranges after.
 */
import { describe, expect, it } from "vitest";

import type { KitSpec, TextLayerSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, LABEL, nestedKit, outerKit } from "./button-kit-fixture.ts";
import { aliasOf, childNamed, color, fixtureFile, float, string } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * A label whose weight binds `title-weight`, which takes 400 to 700 across the kit's modes, so it
 * can show Regular, Medium or Bold. The fixture file holds one mode, where it is 500.
 */
const WEIGHTED: TextLayerSpec = {
  ...LABEL,
  fontStyle: "Regular",
  weight: {
    variable: { collection: "Fuse tokens", name: "title-weight" },
    faces: ["Regular", "Medium", "SemiBold", "Bold"],
  },
};

const kit: KitSpec = nestedKit([WEIGHTED]);

/** The label the Outer variant's instance shows, `⌘B` unless a case gives other characters. */
async function instanceLabel(file: ReturnType<typeof weightedFile>, characters = "⌘B"): Promise<TextNode> {
  const labels = (node: BaseNode): TextNode[] =>
    node.type === "TEXT" && node.parent?.type === "INSTANCE" && node.characters === characters
      ? [node]
      : "children" in node
        ? node.children.flatMap(labels)
        : [];
  for (const page of file.figma.root.children) {
    await page.loadAsync();
    const [found] = labels(page);
    if (found !== undefined) {
      return found;
    }
  }
  throw new Error(`no instance shows ${characters}`);
}

/** A synced file whose `title-weight` is 500 in its one mode. */
function weightedFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
    float("Fuse tokens", "title-weight", 500),
  ]);
}

describe("a label whose weight binds a variable", () => {
  it("binds the weight, shows the face it names, and the next Plan lists nothing", async () => {
    const file = weightedFile();
    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    const bound = label.boundVariables?.fontWeight?.[0]?.id;
    const variable = (await file.figma.variables.getLocalVariablesAsync()).find(
      (each) => each.name === "title-weight"
    );
    expect([keyOf(label), label.fontName, bound]).toEqual([
      "button/label",
      { family: "Roboto", style: "Medium" },
      variable?.id,
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });

  it("binds the weight again after a run writes the label's font", async () => {
    const file = weightedFile();
    await reconcileKit(file.figma, kit, true);
    // The label takes Inter in place of the family `font-sans` binds, so the run writes its font.
    const inter: KitSpec = nestedKit([{ ...WEIGHTED, fontFamily: { kind: "literal", value: "Inter" } }]);
    file.reopen();
    await reconcileKit(file.figma, inter, true);
    file.reopen();
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    const variable = (await file.figma.variables.getLocalVariablesAsync()).find(
      (each) => each.name === "title-weight"
    );
    expect([label.fontName, label.boundVariables?.fontWeight?.[0]?.id]).toEqual([
      { family: "Inter", style: "Medium" },
      variable?.id,
    ]);
    expect((await reconcileKit(file.figma, inter, false)).changes).toEqual([]);
  });

  it("loads the glyph font's face its weight names and draws the glyphs in it, converging", async () => {
    // `⌘` takes the kit's glyph font, Inter, and the binding gives it Inter's face for 500.
    const kitWith = nestedKit([{ ...WEIGHTED, characters: "⌘K" }]);
    const file = weightedFile();
    await reconcileKit(file.figma, kitWith, true);
    file.reopen();
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    const variable = (await file.figma.variables.getLocalVariablesAsync()).find(
      (each) => each.name === "title-weight"
    );
    expect([
      label.getStyledTextSegments(["fontName"]).map((segment) => segment.fontName),
      label.getRangeBoundVariable(0, 2, "fontWeight"),
    ]).toEqual([
      [
        { family: "Inter", style: "Medium" },
        { family: "Roboto", style: "Medium" },
      ],
      { type: "VARIABLE_ALIAS", id: variable?.id },
    ]);
    expect((await reconcileKit(file.figma, kitWith, false)).changes).toEqual([]);
  });

  it("binds the weight again over a glyph range the run writes again", async () => {
    // A designer sets `⌘` in Roboto and binds the weight over the whole text again, so every range is
    // bound and `⌘` is in the wrong family. The run writes `⌘` back to Inter, which drops that
    // range's binding, so it binds the whole text after, which binds every range (PG13).
    const kitWith = nestedKit([{ ...WEIGHTED, characters: "⌘K" }]);
    const file = weightedFile();
    await reconcileKit(file.figma, kitWith, true);
    file.reopen();
    const variable = (await file.figma.variables.getLocalVariablesAsync()).find(
      (each) => each.name === "title-weight"
    );
    const drifted = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    await file.figma.loadFontAsync({ family: "Roboto", style: "Medium" });
    drifted.setRangeFontName(0, 1, { family: "Roboto", style: "Regular" });
    if (variable !== undefined) {
      drifted.setBoundVariable("fontWeight", variable);
    }
    file.reopen();
    await reconcileKit(file.figma, kitWith, true);
    file.reopen();
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    expect([
      label.getStyledTextSegments(["fontName"]).map((segment) => segment.fontName),
      label.getRangeBoundVariable(0, 2, "fontWeight"),
    ]).toEqual([
      [
        { family: "Inter", style: "Medium" },
        { family: "Roboto", style: "Medium" },
      ],
      { type: "VARIABLE_ALIAS", id: variable?.id },
    ]);
    expect((await reconcileKit(file.figma, kitWith, false)).changes).toEqual([]);
  });

  it.each([
    ["the default text holds the glyph too", "⌘K"],
    // The run loads the glyph font's faces for the characters the instance gives, before its first write.
    ["only the instance's text holds the glyph", "K"],
  ])(
    "gives the glyphs of an instance's label the face the weight names, binding it, where %s",
    async (_case, characters) => {
      const file = weightedFile();
      const outer = outerKit({ ...WEIGHTED, characters }, "⌘B");
      await reconcileKit(file.figma, outer, true);
      file.reopen();
      const label = await instanceLabel(file);
      const variable = (await file.figma.variables.getLocalVariablesAsync()).find(
        (each) => each.name === "title-weight"
      );
      expect([
        label.getStyledTextSegments(["fontName"]).map((segment) => segment.fontName),
        label.getRangeBoundVariable(0, 2, "fontWeight"),
      ]).toEqual([
        [
          { family: "Inter", style: "Medium" },
          { family: "Roboto", style: "Medium" },
        ],
        { type: "VARIABLE_ALIAS", id: variable?.id },
      ]);
      expect((await reconcileKit(file.figma, outer, false)).changes).toEqual([]);
    }
  );

  it("loads the glyph font's face before the first write where a later run gives an instance the glyph", async () => {
    const file = weightedFile();
    await reconcileKit(file.figma, outerKit({ ...WEIGHTED, characters: "K" }, "B"), true);
    file.reopen();
    const outer = outerKit({ ...WEIGHTED, characters: "K" }, "⌘B");
    await reconcileKit(file.figma, outer, true);
    file.reopen();
    expect(
      (await instanceLabel(file)).getStyledTextSegments(["fontName"]).map((segment) => segment.fontName)
    ).toEqual([
      { family: "Inter", style: "Medium" },
      { family: "Roboto", style: "Medium" },
    ]);
    expect((await reconcileKit(file.figma, outer, false)).changes).toEqual([]);
  });

  it("loads the glyph font's face before the first write where a later run restores a glyph default", async () => {
    const file = weightedFile();
    await reconcileKit(file.figma, outerKit({ ...WEIGHTED, characters: "Save" }, "Open", "⌘K"), true);
    file.reopen();
    const outer = outerKit({ ...WEIGHTED, characters: "Save" }, undefined, "⌘K");
    await reconcileKit(file.figma, outer, true);
    file.reopen();
    expect(
      (await instanceLabel(file, "⌘K")).getStyledTextSegments(["fontName"]).map((segment) => segment.fontName)
    ).toEqual([
      { family: "Inter", style: "Medium" },
      { family: "Roboto", style: "Medium" },
    ]);
    expect((await reconcileKit(file.figma, outer, false)).changes).toEqual([]);
  });

  it("plans the glyph's face and the weight back where a designer sets an instance's glyph Regular", async () => {
    // A `fontName` write on `⌘` drops its range's weight binding (PG8).
    const file = weightedFile();
    const outer = outerKit({ ...WEIGHTED, characters: "⌘K" }, "⌘B");
    await reconcileKit(file.figma, outer, true);
    file.reopen();
    await file.figma.loadFontAsync({ family: "Inter", style: "Regular" });
    (await instanceLabel(file)).setRangeFontName(0, 1, { family: "Inter", style: "Regular" });
    file.reopen();
    const changes = (await reconcileKit(file.figma, outer, false)).changes;
    expect(changes.filter((line) => line.includes("Inner / Label"))).toEqual([
      expect.stringContaining("font at 0-1 → Inter Medium"),
      expect.stringContaining("fontWeight → title-weight"),
    ]);
  });

  it("stops before its first write where the machine lacks a face another mode shows", async () => {
    // The file's one mode shows Medium; only another mode's 700 shows Bold.
    const file = weightedFile();
    file.reopen({ unavailableFonts: [{ family: "Roboto", style: "Bold" }] });
    const before = file.writes.length;
    await expect(reconcileKit(file.figma, kit, true)).rejects.toThrow("Roboto Bold");
    expect(file.writes.length).toBe(before);
  });
});
