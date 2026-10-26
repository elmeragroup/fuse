/**
 * The glyph range rules of the in-memory file in `fake-figma.ts`, rules 50 to 55, on texts such as
 * `⇧⌘P` bound to `font-sans` and an instance of the component that holds one. The oracle is what the
 * test file `Elmera Fuse - Import test` read back in the net-zero probes G2 to G12 on 2026-10-26, as
 * the fake's header names them. The planners' glyph tests converge against these rules, so a rule that
 * drifts from the real file would let a plan pass that Figma would not keep.
 */
import { describe, expect, it } from "vitest";

import { childNamed, fixtureFile, float, string } from "./fake-fixtures.ts";

const INTER = { family: "Inter", style: "Regular" };
const ROBOTO = { family: "Roboto", style: "Regular" };

/**
 * A component set of one row holding a 14px text on a 20px line, `⇧⌘P` unless given, Roboto Regular
 * and bound to `font-sans` as a whole, which resolves to Roboto, and its TEXT property, as each probe
 * began. The file also holds the STRING `font-symbols`, valued Inter, and the FLOAT `size`, valued 18.
 */
async function probe(characters = "⇧⌘P") {
  const file = fixtureFile([
    string("Fuse tokens", "font-sans", "Roboto"),
    string("Probe", "font-symbols", "Inter"),
    float("Probe", "size", 18),
  ]);
  const { figma } = file;
  await figma.loadFontAsync(INTER);
  await figma.loadFontAsync(ROBOTO);
  await figma.loadFontAsync({ family: "Roboto", style: "Medium" });
  const row = figma.createComponent();
  row.name = "variant=default";
  const text = figma.createText();
  text.name = "Keys";
  text.characters = characters;
  text.fontName = ROBOTO;
  text.fontSize = 14;
  text.lineHeight = { unit: "PIXELS", value: 20 };
  text.setBoundVariable("fontFamily", file.variable("Fuse tokens", "font-sans"));
  row.appendChild(text);
  const set = figma.combineAsVariants([row], figma.currentPage);
  const keys = set.addComponentProperty("Keys", "TEXT", characters);
  return { file, row, text, keys, fontSans: file.variable("Fuse tokens", "font-sans").id };
}

/** A text's segments as each one's characters, font and whether its family binds `font-sans`. */
function fonts(text: TextNode, fontSans: string): readonly (readonly [string, string, boolean])[] {
  return text
    .getStyledTextSegments(["fontName", "boundVariables"])
    .map((segment) => [
      segment.characters,
      `${segment.fontName.family} ${segment.fontName.style}`,
      segment.boundVariables?.fontFamily?.id === fontSans,
    ]);
}

/** A text's segments as each one's characters, family and bound family id. */
function segments(text: TextNode): readonly (readonly [string, string, string | undefined])[] {
  return text
    .getStyledTextSegments(["fontName", "boundVariables"])
    .map((segment) => [segment.characters, segment.fontName.family, segment.boundVariables?.fontFamily?.id]);
}

describe("rule 50: a range font write unbinds the range's family (G2)", () => {
  it("reads ⇧⌘ Inter with no bound family beside P in Roboto bound to font-sans, and the font as mixed", async () => {
    const { file, text, fontSans } = await probe();
    text.setRangeFontName(0, 2, INTER);
    expect([segments(text), text.fontName === file.figma.mixed]).toEqual([
      [
        ["⇧⌘", "Inter", undefined],
        ["P", "Roboto", fontSans],
      ],
      true,
    ]);
  });
});

describe("rule 51: linking a text's characters resets its style (G3)", () => {
  it("leaves one Roboto segment bound to font-sans when the link follows the range write", async () => {
    const { text, keys, fontSans } = await probe();
    text.setRangeFontName(0, 2, INTER);
    text.componentPropertyReferences = { characters: keys };
    expect(segments(text)).toEqual([["⇧⌘P", "Roboto", fontSans]]);
  });

  it("keeps both segments when the range write follows the link", async () => {
    const { text, keys, fontSans } = await probe();
    text.componentPropertyReferences = { characters: keys };
    text.setRangeFontName(0, 2, INTER);
    expect(segments(text)).toEqual([
      ["⇧⌘", "Inter", undefined],
      ["P", "Roboto", fontSans],
    ]);
  });
});

/** The probe's main, linked and then given its range, and an instance of it with its text sublayer. */
async function instanced() {
  const made = await probe();
  made.text.componentPropertyReferences = { characters: made.keys };
  made.text.setRangeFontName(0, 2, INTER);
  const instance = made.row.createInstance();
  return { ...made, instance, sublayer: childNamed(instance, "TEXT", "Keys") };
}

describe("rule 52: a TEXT property write resets the linked text of the instance (G4, G5)", () => {
  it("shows the main's segments at the default before any write", async () => {
    const { sublayer, fontSans } = await instanced();
    expect(segments(sublayer)).toEqual([
      ["⇧⌘", "Inter", undefined],
      ["P", "Roboto", fontSans],
    ]);
  });

  it.each(["⌘B", "⇧⌘K", "⇧⌘P"])("leaves one Roboto segment bound to font-sans after %s", async (value) => {
    const { instance, sublayer, keys, fontSans } = await instanced();
    instance.setProperties({ [keys]: value });
    expect(segments(sublayer)).toEqual([[value, "Roboto", fontSans]]);
  });
});

describe("rule 53: a range font write on an instance's text holds until the next TEXT write (G6)", () => {
  it("reads ⌘ Inter unbound beside B bound, lists no font override, and resets on the next write", async () => {
    const { instance, sublayer, keys, fontSans } = await instanced();
    instance.setProperties({ [keys]: "⌘B" });
    sublayer.setRangeFontName(0, 1, INTER);
    const written = segments(sublayer);
    const listed = instance.overrides.find((override) => override.id === sublayer.id)?.overriddenFields ?? [];
    instance.setProperties({ [keys]: "⌘B" });
    expect([written, listed.filter((field) => field.startsWith("font")), segments(sublayer)]).toEqual([
      [
        ["⌘", "Inter", undefined],
        ["B", "Roboto", fontSans],
      ],
      [],
      [["⌘B", "Roboto", fontSans]],
    ]);
  });
});

describe("rules 51 and 52: a reset takes the style the range writes left alone (G7)", () => {
  it("resets `P⌘` to Roboto bound when its characters link after a range at its end", async () => {
    const { text, keys, fontSans } = await probe("P⌘");
    text.setRangeFontName(1, 2, INTER);
    const ranged = fonts(text, fontSans);
    text.componentPropertyReferences = { characters: keys };
    expect([ranged, fonts(text, fontSans)]).toEqual([
      [
        ["P", "Roboto Regular", true],
        ["⌘", "Inter Regular", false],
      ],
      [["P⌘", "Roboto Regular", true]],
    ]);
  });

  it("shows both segments on an instance at the default, and resets to Roboto bound after `B⌘`", async () => {
    const { row, text, keys, fontSans } = await probe("P⌘");
    text.componentPropertyReferences = { characters: keys };
    text.setRangeFontName(1, 2, INTER);
    const instance = row.createInstance();
    const sublayer = childNamed(instance, "TEXT", "Keys");
    const shown = fonts(sublayer, fontSans);
    instance.setProperties({ [keys]: "B⌘" });
    expect([shown, fonts(sublayer, fontSans)]).toEqual([
      [
        ["P", "Roboto Regular", true],
        ["⌘", "Inter Regular", false],
      ],
      [["B⌘", "Roboto Regular", true]],
    ]);
  });
});

/**
 * A text's segments as each one's characters, font, size, whether its family binds `font-sans`, and
 * the id of the variable its size binds.
 */
function sized(
  text: TextNode,
  fontSans: string
): readonly (readonly [string, string, number, boolean, string | undefined])[] {
  return text
    .getStyledTextSegments(["fontName", "fontSize", "boundVariables"])
    .map((segment) => [
      segment.characters,
      `${segment.fontName.family} ${segment.fontName.style}`,
      segment.fontSize,
      segment.boundVariables?.fontFamily?.id === fontSans,
      segment.boundVariables?.fontSize?.id,
    ]);
}

describe("rules 51 and 55: a reset takes the base style whole-text writes give, and no range write (G10, G12)", () => {
  it("resets `⌘K` to Roboto 20/28 bound to font-sans after a whole size and line height over an Inter ⌘ (G12a)", async () => {
    const { text, keys, fontSans } = await probe("⌘K");
    text.setRangeFontName(0, 1, INTER);
    text.fontSize = 20;
    text.lineHeight = { unit: "PIXELS", value: 28 };
    const written = [sized(text, fontSans), text.lineHeight];
    text.componentPropertyReferences = { characters: keys };
    expect([written, [sized(text, fontSans), text.lineHeight]]).toEqual([
      [
        [
          ["⌘", "Inter Regular", 20, false, undefined],
          ["K", "Roboto Regular", 20, true, undefined],
        ],
        { unit: "PIXELS", value: 28 },
      ],
      [[["⌘K", "Roboto Regular", 20, true, undefined]], { unit: "PIXELS", value: 28 }],
    ]);
  });

  it("gives an Inter ⌘ a whole size binding's value but not the binding, and resets to it bound (G12b)", async () => {
    const { file, text, keys, fontSans } = await probe("⌘K");
    const size = file.variable("Probe", "size");
    text.setRangeFontName(0, 1, INTER);
    text.setBoundVariable("fontSize", size);
    const bound = sized(text, fontSans);
    text.componentPropertyReferences = { characters: keys };
    expect([bound, sized(text, fontSans)]).toEqual([
      [
        ["⌘", "Inter Regular", 18, false, undefined],
        ["K", "Roboto Regular", 18, true, size.id],
      ],
      [["⌘K", "Roboto Regular", 18, true, size.id]],
    ]);
  });

  it("resets a range size write on `⌘K` to the 14px it began with (G12c)", async () => {
    const { text, keys, fontSans } = await probe("⌘K");
    text.setRangeFontSize(1, 2, 24);
    const ranged = sized(text, fontSans);
    text.componentPropertyReferences = { characters: keys };
    expect([ranged, sized(text, fontSans)]).toEqual([
      [
        ["⌘", "Roboto Regular", 14, true, undefined],
        ["K", "Roboto Regular", 24, true, undefined],
      ],
      [["⌘K", "Roboto Regular", 14, true, undefined]],
    ]);
  });

  it("resets to an unbound family after a whole-text unbind, which reaches every character (G10)", async () => {
    const { text, keys, fontSans } = await probe("P⌘");
    text.setBoundVariable("fontFamily", null);
    text.setRangeFontName(1, 2, INTER);
    text.componentPropertyReferences = { characters: keys };
    expect(sized(text, fontSans)).toEqual([["P⌘", "Roboto Regular", 14, false, undefined]]);
  });
});

describe("rule 50: a font write keeps a character's binding only where its family stays (G8, G9, G10)", () => {
  it("keeps `Apple` bound through Roboto Medium and drops the binding with Inter", async () => {
    const { text, fontSans } = await probe("Apple");
    text.fontName = { family: "Roboto", style: "Medium" };
    const medium = fonts(text, fontSans);
    text.fontName = INTER;
    expect([medium, fonts(text, fontSans)]).toEqual([
      [["Apple", "Roboto Medium", true]],
      [["Apple", "Inter Regular", false]],
    ]);
  });

  it("writes Roboto over an unbound Inter ⌘ without binding it, and keeps K bound", async () => {
    const { text, fontSans } = await probe("⌘K");
    text.setRangeFontName(0, 1, INTER);
    text.fontName = ROBOTO;
    expect(fonts(text, fontSans)).toEqual([
      ["⌘", "Roboto Regular", false],
      ["K", "Roboto Regular", true],
    ]);
  });

  it("unbinds K with Inter, leaves it unbound when Roboto comes back, and keeps a same-family range bound", async () => {
    const { text, fontSans } = await probe("⌘K");
    text.setRangeFontName(1, 2, INTER);
    const inter = fonts(text, fontSans);
    text.setRangeFontName(1, 2, ROBOTO);
    const back = fonts(text, fontSans);
    const same = await probe("AK");
    same.text.setRangeFontName(1, 2, ROBOTO);
    expect([inter, back, fonts(same.text, same.fontSans)]).toEqual([
      [
        ["⌘", "Roboto Regular", true],
        ["K", "Inter Regular", false],
      ],
      [
        ["⌘", "Roboto Regular", true],
        ["K", "Roboto Regular", false],
      ],
      [["AK", "Roboto Regular", true]],
    ]);
  });

  it("keeps a binding to an Inter-valued variable through an Inter write, until a null range binding (G11)", async () => {
    const { file, text, fontSans } = await probe("⌘K");
    const symbols = file.variable("Probe", "font-symbols");
    text.setRangeFontName(0, 1, INTER);
    text.setRangeBoundVariable(0, 1, "fontFamily", symbols);
    const bound = segments(text);
    text.setRangeFontName(0, 1, INTER);
    const written = segments(text);
    text.setRangeBoundVariable(0, 1, "fontFamily", null);
    const held: readonly (readonly [string, string, string | undefined])[] = [
      ["⌘", "Inter", symbols.id],
      ["K", "Roboto", fontSans],
    ];
    expect([bound, written, segments(text)]).toEqual([
      held,
      held,
      [
        ["⌘", "Inter", undefined],
        ["K", "Roboto", fontSans],
      ],
    ]);
  });

  it("binds an unbound Roboto ⌘ through a range bind (G9)", async () => {
    const { file, text, fontSans } = await probe("⌘K");
    text.setRangeFontName(0, 1, INTER);
    text.setRangeFontName(0, 1, ROBOTO);
    text.setRangeBoundVariable(0, 1, "fontFamily", file.variable("Fuse tokens", "font-sans"));
    expect(fonts(text, fontSans)).toEqual([["⌘K", "Roboto Regular", true]]);
  });
});

describe("rule 54: a whole-text family bind binds only the characters already in the variable's family (G10)", () => {
  it.each(["⇧⌘P", "⌘K"])("changes nothing on %s with its glyphs Inter unbound", async (characters) => {
    const { file, text, fontSans } = await probe(characters);
    const glyphs = characters.length - 1;
    text.setRangeFontName(0, glyphs, INTER);
    const before = fonts(text, fontSans);
    text.setBoundVariable("fontFamily", file.variable("Fuse tokens", "font-sans"));
    expect(fonts(text, fontSans)).toEqual(before);
  });

  it("unbinds every character with null, then binds K again and leaves ⌘ Inter unbound", async () => {
    const { file, text, fontSans } = await probe("⌘K");
    text.setRangeFontName(0, 1, INTER);
    text.setBoundVariable("fontFamily", null);
    const unbound = fonts(text, fontSans);
    text.setBoundVariable("fontFamily", file.variable("Fuse tokens", "font-sans"));
    expect([unbound, fonts(text, fontSans)]).toEqual([
      [
        ["⌘", "Inter Regular", false],
        ["K", "Roboto Regular", false],
      ],
      [
        ["⌘", "Inter Regular", false],
        ["K", "Roboto Regular", true],
      ],
    ]);
  });
});
