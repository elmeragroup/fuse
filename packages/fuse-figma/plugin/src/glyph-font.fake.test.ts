/**
 * A label that draws the kit's glyph font on its glyph ranges, on the in-memory file in
 * `fake-figma.ts`, through Apply and Plan. Unit under test: the text layer's plan in `text-layer.ts`
 * and `glyph-font.ts`. Oracle: the fake's rules 10, 50, 51, 54 and 55, from the owner's probes
 * recorded on #522. A whole font write keeps a glyph's family state while the label's characters
 * still differ, and a whole binding skips a character with that state (FT2, FT6, FT7). A `characters`
 * write gives every character the first one's style and clears the state (FT1, FT6). A whole family
 * binding gives the label's family to a glyph range with no state (FT2), in the range's own style. A
 * label character a designer gave a family state of its own, by a null range binding or a range
 * binding to another variable, keeps it through a whole binding (FT6, FT7). So each case below converges
 * in one Apply: the label's other characters end bound, its glyph ranges in the glyph font, unbound,
 * and the next Plan lists nothing.
 */
import { describe, expect, it } from "vitest";

import type { TextLayerSpec } from "../../src/components/kit-spec.ts";
import { applyTo, buttonVariant, fixture, LABEL, nestedKit } from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed, float, string } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

/** A kit whose one label shows the given characters, in its own style unless the case gives one. */
const kitOf = (characters: string, edit: Partial<TextLayerSpec> = {}) =>
  nestedKit([{ ...LABEL, characters, fontStyle: "Regular", ...edit }]);

/** Each run of the label's characters with its family and the fields it binds. */
async function runs(file: FakeFigma): Promise<readonly string[]> {
  const label = childNamed(await buttonVariant(file), "TEXT", "Label");
  return label
    .getStyledTextSegments(["fontName", "boundVariables"])
    .map((segment) =>
      [segment.characters, segment.fontName.family, ...Object.keys(segment.boundVariables ?? {}).sort()].join(
        " "
      )
    );
}

/** The changes the next Plan lists. */
async function planned(file: FakeFigma, kit: ReturnType<typeof kitOf>): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, kit, false)).changes;
}

describe("a label that draws glyph ranges", () => {
  it("binds the family of every other character when the run changes its characters", async () => {
    const { file } = fixture("Roboto", false);
    await applyTo(file, kitOf("⇧⌘P"));
    await applyTo(file, kitOf("⌘B"));
    expect([await runs(file), await planned(file, kitOf("⌘B"))]).toEqual([
      ["⌘ Inter", "B Roboto fontFamily"],
      [],
    ]);
  });

  it("draws its glyph ranges again after the family binding a half-applied label takes", async () => {
    const { file } = fixture("Roboto", false);
    await applyTo(file, kitOf("⌘B"));
    // The state an Apply that bound the family before the characters left: `⌘` Inter with no family
    // state, `B` Roboto unbound. A whole write gives both one style, which clears any state (FT6), and
    // a range write on a never-bound character sets none (T2f).
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    label.fontName = { family: "Inter", style: "Regular" };
    label.setRangeFontName(1, 2, { family: "Roboto", style: "Regular" });
    file.reopen();
    await applyTo(file, kitOf("⌘B"));
    expect([await runs(file), await planned(file, kitOf("⌘B"))]).toEqual([
      ["⌘ Inter", "B Roboto fontFamily"],
      [],
    ]);
  });

  it("binds a variable size on every character when the run replaces the characters around a glyph", async () => {
    const { file } = fixture("Roboto", false, [float("Fuse tokens", "control-text", 14)]);
    const bound = kitOf("Save", {
      fontSize: { kind: "variable", variable: { collection: "Fuse tokens", name: "control-text" } },
    });
    await applyTo(file, kitOf("⌘K"));
    await applyTo(file, bound);
    expect([await runs(file), await planned(file, bound)]).toEqual([["Save Roboto fontFamily fontSize"], []]);
  });

  it.each([
    [
      "a null range binding unbound one of them",
      "AB",
      (label: TextNode) => label.setRangeBoundVariable(0, 1, "fontFamily", null),
      ["AB Roboto fontFamily"],
    ],
    [
      "a range binding bound one of them to another variable",
      "⌘AB",
      (label: TextNode, other: Variable) => label.setRangeBoundVariable(2, 3, "fontFamily", other),
      ["⌘ Inter", "AB Roboto fontFamily"],
    ],
  ])("binds every other character again where %s", async (_case, characters, edit, expected) => {
    const { file } = fixture("Roboto", false, [string("Fuse tokens", "roboto-alt", "Roboto")]);
    await applyTo(file, kitOf(characters));
    const other = (await file.figma.variables.getLocalVariablesAsync("STRING")).find(
      (variable) => variable.name === "roboto-alt"
    );
    if (other === undefined) {
      throw new Error("The fixture holds no roboto-alt.");
    }
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    await file.figma.loadFontAsync({ family: "Inter", style: "Regular" });
    edit(childNamed(await buttonVariant(file), "TEXT", "Label"), other);
    file.reopen();
    await applyTo(file, kitOf(characters));
    expect([await runs(file), await planned(file, kitOf(characters))]).toEqual([expected, []]);
  });

  it("binds the family over a glyph in another style with only the faces the run loads", async () => {
    const { file } = fixture("Roboto", false);
    await applyTo(file, kitOf("⌘B"));
    // `⌘` in Inter Bold and `B` in Roboto Regular, neither bound and neither with a family state: a
    // whole write gives both one style, which clears the state (FT6), and a range write on a
    // never-bound character sets none (T2f).
    const label = childNamed(await buttonVariant(file), "TEXT", "Label");
    await file.figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    label.fontName = { family: "Inter", style: "Bold" };
    label.setRangeFontName(1, 2, { family: "Roboto", style: "Regular" });
    file.reopen();
    await applyTo(file, kitOf("⌘B"));
    expect([await runs(file), await planned(file, kitOf("⌘B"))]).toEqual([
      ["⌘ Inter", "B Roboto fontFamily"],
      [],
    ]);
  });

  it.each([
    [
      "both bindings were removed from one character",
      kitOf("AB", {
        fontSize: { kind: "variable", variable: { collection: "Fuse tokens", name: "control-text" } },
      }),
      (label: TextNode) => {
        label.setRangeBoundVariable(0, 1, "fontFamily", null);
        label.setRangeBoundVariable(0, 1, "fontSize", null);
      },
    ],
    [
      "one character lost its family binding and took another size",
      kitOf("AB"),
      (label: TextNode) => {
        label.setRangeBoundVariable(0, 1, "fontFamily", null);
        label.setRangeFontSize(0, 1, 20);
      },
    ],
  ])("binds a variable size on every character where %s", async (_case, before, edit) => {
    const { file } = fixture("Roboto", false, [float("Fuse tokens", "control-text", 14)]);
    const bound = kitOf("AB", {
      fontSize: { kind: "variable", variable: { collection: "Fuse tokens", name: "control-text" } },
    });
    await applyTo(file, before);
    await file.figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    edit(childNamed(await buttonVariant(file), "TEXT", "Label"));
    file.reopen();
    await applyTo(file, bound);
    expect([await runs(file), await planned(file, bound)]).toEqual([["AB Roboto fontFamily fontSize"], []]);
  });
});
