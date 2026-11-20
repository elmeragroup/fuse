/**
 * The in-memory file's per-character text styles and bindings, rules 50 to 55 in `fake/text.ts`.
 * Unit under test: the fake in `fake-figma.ts`. Oracle: the owner's reads of a private draft file
 * through the Plugin API on 2026-11-20, recorded on issue #522 as FT1 to FT7. Each case replays a
 * probe's writes and expects what Figma read back: the base style a link resets to once every
 * character holds one style (FT1), a whole-text binding over characters that never bound the field
 * and over one that lost its family binding to a font write (FT2), a font write over a bound
 * `fontStyle` or `fontWeight` (FT3), an instance at its default after its main takes ranges (FT5),
 * the writes that keep or clear a character's lost family binding (FT6), and a range family binding
 * a whole binding skips (FT7). Three cases go past the probes, each named as the fake's
 * extrapolation: an instance whose main's label changes length after the instance showed it, read
 * through its ranges and through the bindings it lists, and the base style a TEXT write gives an
 * instance after its main became one style. A last case holds the fake's own width rule, 31 in
 * `fake/layout.ts`: a text that hugs its characters takes half each character's size in width.
 */
import { describe, expect, it } from "vitest";

import { fixtureFile, float, string } from "./fake-fixtures.ts";

const ROBOTO: FontName = { family: "Roboto", style: "Regular" };
const ROBOTO_BOLD: FontName = { family: "Roboto", style: "Bold" };
const ROBOTO_MEDIUM: FontName = { family: "Roboto", style: "Medium" };
const INTER: FontName = { family: "Inter", style: "Regular" };
const INTER_BOLD: FontName = { family: "Inter", style: "Bold" };

/** A file holding the probes' variables, every font they write loaded. */
async function probeFile() {
  const file = fixtureFile([
    string("Fuse tokens", "roboto", "Roboto"),
    string("Fuse tokens", "inter", "Inter"),
    string("Fuse tokens", "bold", "Bold"),
    float("Fuse tokens", "size", 18),
    float("Fuse tokens", "weight", 700),
  ]);
  for (const font of [ROBOTO, ROBOTO_BOLD, ROBOTO_MEDIUM, INTER, INTER_BOLD]) {
    await file.figma.loadFontAsync(font);
  }
  const variables = await file.figma.variables.getLocalVariablesAsync();
  const variable = (name: string): Variable => {
    const found = variables.find((each) => each.name === name);
    if (found === undefined) {
      throw new Error(`The probe file holds no variable ${name}.`);
    }
    return found;
  };
  const nameOf = (id: string): string => variables.find((each) => each.id === id)?.name ?? id;
  return { figma: file.figma, variable, nameOf };
}

type ProbeFile = Awaited<ReturnType<typeof probeFile>>;

/** A component holding one text of the given characters in the given font at 14, as the probes drew. */
function componentText(figma: PluginAPI, characters: string, font: FontName) {
  const component = figma.createComponent();
  const text = figma.createText();
  component.appendChild(text);
  text.fontName = font;
  text.fontSize = 14;
  text.characters = characters;
  return { component, text };
}

/** Link a component's text to a new TEXT property, which resets it to its base style (rule 51). */
function link(component: ComponentNode, text: TextNode): void {
  const id = component.addComponentProperty("Label", "TEXT", text.characters);
  text.componentPropertyReferences = { characters: id };
}

/** Each run of a text's characters with its font, size and the variable names its fields bind. */
function segments(probe: ProbeFile, text: TextNode): readonly string[] {
  return text.getStyledTextSegments(["fontName", "fontSize", "boundVariables"]).map((segment) => {
    const bound = Object.entries(segment.boundVariables ?? {})
      .map(([field, alias]) => `${field}=${probe.nameOf(alias.id)}`)
      .sort();
    return [
      segment.characters,
      `${segment.fontName.family} ${segment.fontName.style}`,
      segment.fontSize,
      ...bound,
    ].join(" ");
  });
}

describe("the base style a link resets a text to (FT1)", () => {
  it.each([
    [
      "two range writes that cover every character",
      (text: TextNode) => {
        text.setRangeFontSize(0, 1, 20);
        text.setRangeFontSize(1, 2, 20);
      },
      ["AB Roboto Regular 20"],
    ],
    [
      "one range write over every character",
      (text: TextNode) => {
        text.setRangeFontSize(0, 2, 20);
      },
      ["AB Roboto Regular 20"],
    ],
    [
      "a characters write after a range size",
      (text: TextNode) => {
        text.setRangeFontSize(0, 1, 20);
        text.characters = "XY";
      },
      ["XY Roboto Regular 20"],
    ],
    [
      "a characters write after a range font",
      (text: TextNode) => {
        text.setRangeFontName(0, 1, ROBOTO_BOLD);
        text.characters = "XY";
      },
      ["XY Roboto Bold 14"],
    ],
    [
      "one range font over every character",
      (text: TextNode) => {
        text.setRangeFontName(0, 2, ROBOTO_BOLD);
      },
      ["AB Roboto Bold 14"],
    ],
    // G12c: a range write that leaves a character alone leaves the base as it was.
    [
      "a range write over one character",
      (text: TextNode) => {
        text.setRangeFontSize(1, 2, 20);
      },
      ["AB Roboto Regular 14"],
    ],
  ])("is the style %s left every character", async (_, writes, expected) => {
    const probe = await probeFile();
    const { component, text } = componentText(probe.figma, "AB", ROBOTO);
    writes(text);
    link(component, text);
    expect(segments(probe, text)).toEqual(expected);
  });
});

describe("a whole-text binding (FT2)", () => {
  it("gives every character the family a family binding holds, in each one's style, and binds it", async () => {
    const probe = await probeFile();
    const regular = componentText(probe.figma, "AB", INTER).text;
    regular.setBoundVariable("fontFamily", probe.variable("roboto"));
    const bold = componentText(probe.figma, "AB", INTER_BOLD).text;
    bold.setBoundVariable("fontFamily", probe.variable("roboto"));
    expect([segments(probe, regular), segments(probe, bold)]).toEqual([
      ["AB Roboto Regular 14 fontFamily=roboto"],
      ["AB Roboto Bold 14 fontFamily=roboto"],
    ]);
  });

  it("binds a character a range font write gave another family, where it held no family binding", async () => {
    const probe = await probeFile();
    const { text } = componentText(probe.figma, "AB", ROBOTO);
    text.setRangeFontName(0, 1, INTER);
    text.setBoundVariable("fontFamily", probe.variable("inter"));
    expect(segments(probe, text)).toEqual(["AB Inter Regular 14 fontFamily=inter"]);
  });

  it("gives a range binding's range the variable's family, bound, and leaves the rest", async () => {
    const probe = await probeFile();
    const { text } = componentText(probe.figma, "AB", INTER);
    text.setRangeBoundVariable(0, 1, "fontFamily", probe.variable("roboto"));
    expect(segments(probe, text)).toEqual(["A Roboto Regular 14 fontFamily=roboto", "B Inter Regular 14"]);
  });

  it("leaves a character that lost its family binding to a font write in its font and unbound", async () => {
    const probe = await probeFile();
    const roboto = probe.variable("roboto");
    const lost = componentText(probe.figma, "⌘K", ROBOTO).text;
    lost.setBoundVariable("fontFamily", roboto);
    lost.setRangeFontName(0, 1, INTER);
    lost.setBoundVariable("fontFamily", roboto);
    const rebound = segments(probe, lost);
    lost.setBoundVariable("fontFamily", null);
    lost.setBoundVariable("fontFamily", roboto);
    const never = componentText(probe.figma, "⌘K", ROBOTO).text;
    never.setRangeFontName(0, 1, INTER);
    never.setBoundVariable("fontFamily", null);
    never.setBoundVariable("fontFamily", roboto);
    expect([rebound, segments(probe, lost), segments(probe, never)]).toEqual([
      ["⌘ Inter Regular 14", "K Roboto Regular 14 fontFamily=roboto"],
      ["⌘ Inter Regular 14", "K Roboto Regular 14 fontFamily=roboto"],
      ["⌘K Roboto Regular 14 fontFamily=roboto"],
    ]);
  });

  it("of the size binds every character but one that lost its family binding to a font write", async () => {
    const probe = await probeFile();
    const never = componentText(probe.figma, "⌘K", ROBOTO).text;
    never.setRangeFontName(0, 1, INTER);
    never.setBoundVariable("fontSize", probe.variable("size"));
    const lost = componentText(probe.figma, "⌘K", ROBOTO).text;
    lost.setBoundVariable("fontFamily", probe.variable("roboto"));
    lost.setRangeFontName(0, 1, INTER);
    lost.setBoundVariable("fontSize", probe.variable("size"));
    expect([segments(probe, never), segments(probe, lost)]).toEqual([
      ["⌘ Inter Regular 18 fontSize=size", "K Roboto Regular 18 fontSize=size"],
      ["⌘ Inter Regular 18", "K Roboto Regular 18 fontFamily=roboto fontSize=size"],
    ]);
  });
});

describe("a character's lost family binding (FT6)", () => {
  it.each([
    [
      "a whole Roboto font write, the binding still differing",
      (text: TextNode) => {
        text.fontName = ROBOTO;
      },
      ["⌘ Roboto Regular 14", "K Roboto Regular 14 fontFamily=roboto"],
    ],
    [
      "a whole Inter font write, which gives both characters one style",
      (text: TextNode) => {
        text.fontName = INTER;
      },
      ["⌘K Roboto Regular 14 fontFamily=roboto"],
    ],
    [
      "a characters write, which gives every character the first one's style",
      (text: TextNode) => {
        text.characters = "⌘B";
      },
      ["⌘B Roboto Regular 14 fontFamily=roboto"],
    ],
    [
      "a range Roboto font write",
      (text: TextNode) => {
        text.setRangeFontName(0, 1, ROBOTO);
      },
      ["⌘ Roboto Regular 14", "K Roboto Regular 14 fontFamily=roboto"],
    ],
  ])("holds or clears through %s, as a whole binding after it reads", async (_, writes, expected) => {
    const probe = await probeFile();
    const { text } = componentText(probe.figma, "⌘K", ROBOTO);
    text.setBoundVariable("fontFamily", probe.variable("roboto"));
    text.setRangeFontName(0, 1, INTER);
    writes(text);
    text.setBoundVariable("fontFamily", probe.variable("roboto"));
    expect(segments(probe, text)).toEqual(expected);
  });

  it("clears where a range binding gives every character one style, and a null range binding sets it", async () => {
    const probe = await probeFile();
    const roboto = probe.variable("roboto");
    const { text } = componentText(probe.figma, "⌘K", ROBOTO);
    text.setBoundVariable("fontFamily", roboto);
    text.setRangeFontName(0, 1, INTER);
    text.setRangeBoundVariable(0, 1, "fontFamily", roboto);
    const rebound = segments(probe, text);
    text.setRangeBoundVariable(0, 1, "fontFamily", null);
    text.setBoundVariable("fontFamily", roboto);
    // The state the range binding left, both characters bound, reached without the range font write.
    const uniform = componentText(probe.figma, "⌘K", ROBOTO).text;
    uniform.setBoundVariable("fontFamily", roboto);
    uniform.setRangeBoundVariable(0, 1, "fontFamily", null);
    uniform.setBoundVariable("fontFamily", roboto);
    expect([rebound, segments(probe, text), segments(probe, uniform)]).toEqual([
      ["⌘K Roboto Regular 14 fontFamily=roboto"],
      ["⌘ Roboto Regular 14", "K Roboto Regular 14 fontFamily=roboto"],
      ["⌘ Roboto Regular 14", "K Roboto Regular 14 fontFamily=roboto"],
    ]);
  });
});

describe("a whole family binding after a range family binding (FT7)", () => {
  /** `⌘K` bound to Roboto, then `⌘` set to Inter by a range font write, as FT6 and FT7 start. */
  function lostGlyph(probe: ProbeFile): TextNode {
    const { text } = componentText(probe.figma, "⌘K", ROBOTO);
    text.setBoundVariable("fontFamily", probe.variable("roboto"));
    text.setRangeFontName(0, 1, INTER);
    return text;
  }

  it("keeps a range binding on a character that lost its binding", async () => {
    const probe = await probeFile();
    const text = lostGlyph(probe);
    text.setRangeBoundVariable(0, 1, "fontFamily", probe.variable("inter"));
    text.setBoundVariable("fontFamily", probe.variable("roboto"));
    expect(segments(probe, text)).toEqual([
      "⌘ Inter Regular 14 fontFamily=inter",
      "K Roboto Regular 14 fontFamily=roboto",
    ]);
  });

  it("leaves unbound a character a null range binding unbound after a range binding", async () => {
    const probe = await probeFile();
    const text = lostGlyph(probe);
    text.setRangeBoundVariable(0, 1, "fontFamily", probe.variable("inter"));
    text.setRangeBoundVariable(0, 1, "fontFamily", null);
    text.setBoundVariable("fontFamily", probe.variable("roboto"));
    expect(segments(probe, text)).toEqual(["⌘ Inter Regular 14", "K Roboto Regular 14 fontFamily=roboto"]);
  });

  it("keeps a range binding on a character that never held a binding, and binds the rest", async () => {
    const probe = await probeFile();
    const { text } = componentText(probe.figma, "⌘K", ROBOTO);
    text.setRangeBoundVariable(0, 1, "fontFamily", probe.variable("inter"));
    const ranged = segments(probe, text);
    text.setBoundVariable("fontFamily", probe.variable("roboto"));
    expect([ranged, segments(probe, text)]).toEqual([
      ["⌘ Inter Regular 14 fontFamily=inter", "K Roboto Regular 14"],
      ["⌘ Inter Regular 14 fontFamily=inter", "K Roboto Regular 14 fontFamily=roboto"],
    ]);
  });
});

describe("a font write over a bound style or weight (FT3)", () => {
  it("drops a fontStyle binding on what it writes, the whole text or a range", async () => {
    const probe = await probeFile();
    const whole = componentText(probe.figma, "AB", ROBOTO).text;
    whole.setBoundVariable("fontStyle", probe.variable("bold"));
    const bound = segments(probe, whole);
    whole.fontName = ROBOTO_MEDIUM;
    const medium = componentText(probe.figma, "AB", ROBOTO).text;
    medium.setBoundVariable("fontStyle", probe.variable("bold"));
    medium.setRangeFontName(0, 1, ROBOTO_MEDIUM);
    const inter = componentText(probe.figma, "AB", ROBOTO).text;
    inter.setBoundVariable("fontStyle", probe.variable("bold"));
    inter.setRangeFontName(0, 1, INTER);
    expect([bound, segments(probe, whole), segments(probe, medium), segments(probe, inter)]).toEqual([
      ["AB Roboto Bold 14 fontStyle=bold"],
      ["AB Roboto Medium 14"],
      ["A Roboto Medium 14", "B Roboto Bold 14 fontStyle=bold"],
      ["A Inter Regular 14", "B Roboto Bold 14 fontStyle=bold"],
    ]);
  });

  it("drops a fontWeight binding on a range font write's range alone", async () => {
    const probe = await probeFile();
    const { text } = componentText(probe.figma, "AB", ROBOTO);
    text.setBoundVariable("fontWeight", probe.variable("weight"));
    text.setRangeFontName(0, 1, ROBOTO_MEDIUM);
    expect(segments(probe, text)).toEqual(["A Roboto Medium 14", "B Roboto Bold 14 fontWeight=weight"]);
  });
});

describe("an instance at its default (FT5)", () => {
  it("shows the ranges its main's text takes after the instance was made, and lists no override", async () => {
    const probe = await probeFile();
    const { component, text } = componentText(probe.figma, "Save", ROBOTO);
    link(component, text);
    const instance = component.createInstance();
    const [label] = instance.children;
    if (label?.type !== "TEXT") {
      throw new Error("The instance shows no text.");
    }
    const before = segments(probe, label);
    text.setRangeFontName(0, 1, ROBOTO_BOLD);
    text.setRangeFontSize(1, 2, 20);
    expect([before, segments(probe, label), instance.overrides]).toEqual([
      ["Save Roboto Regular 14"],
      ["S Roboto Bold 14", "a Roboto Regular 20", "ve Roboto Regular 14"],
      [],
    ]);
  });

  // The fake's extrapolation from FT1 and FT5: the instance follows its main's base style too, so a
  // TEXT write after the main became one style resets the instance to that style.
  it("takes the style its main's text came to hold throughout on a TEXT write", async () => {
    const probe = await probeFile();
    const { component, text } = componentText(probe.figma, "Save", ROBOTO);
    link(component, text);
    const id = Object.keys(component.componentPropertyDefinitions)[0] ?? "";
    const instance = component.createInstance();
    const [label] = instance.children;
    if (label?.type !== "TEXT") {
      throw new Error("The instance shows no text.");
    }
    text.setRangeFontSize(0, 2, 20);
    text.setRangeFontSize(2, 4, 20);
    instance.setProperties({ [id]: "Open" });
    expect(segments(probe, label)).toEqual(["Open Roboto Regular 20"]);
  });

  // The fake's extrapolation from FT5: a text an instance shows takes one style per character it
  // shows, where a range write gave it styles of its own and its main's label then grew.
  it("restyles every character it shows after its main's label grows", async () => {
    const probe = await probeFile();
    const { component, text } = componentText(probe.figma, "Save", ROBOTO);
    link(component, text);
    const instance = component.createInstance();
    const [label] = instance.children;
    if (label?.type !== "TEXT") {
      throw new Error("The instance shows no text.");
    }
    label.setRangeFontSize(0, 1, 20);
    text.characters = "Saved!";
    label.setRangeFontSize(4, 6, 24);
    expect([segments(probe, label), label.getRangeBoundVariable(0, 6, "fontSize")]).toEqual([
      ["Save Roboto Regular 20", "d! Roboto Regular 24"],
      null,
    ]);
  });

  // The fake's extrapolation from FT5: the bindings an instance's text lists are those of the
  // characters it shows, one style each, after its main's label grew.
  it("lists only the bindings of the characters it shows after its main's label grows", async () => {
    const probe = await probeFile();
    const { component, text } = componentText(probe.figma, "AB", ROBOTO);
    link(component, text);
    const instance = component.createInstance();
    const [label] = instance.children;
    if (label?.type !== "TEXT") {
      throw new Error("The instance shows no text.");
    }
    label.setRangeBoundVariable(1, 2, "fontSize", probe.variable("size"));
    const bound = Object.keys(label.boundVariables ?? {});
    text.characters = "ABC";
    expect([
      bound,
      Object.keys(label.boundVariables ?? {}),
      Object.keys(instance.resolvedVariableModes),
    ]).toEqual([["fontSize"], [], []]);
  });
});

describe("a text that hugs its characters (rule 31)", () => {
  it("takes the width its characters' sizes give it after a binding, a write or a range write", async () => {
    const probe = await probeFile();
    const text = probe.figma.createText();
    text.fontName = ROBOTO;
    text.characters = "Save";
    const widths = [text.width];
    text.setBoundVariable("fontSize", probe.variable("size"));
    widths.push(text.width);
    text.fontSize = 20;
    widths.push(text.width);
    text.setRangeFontSize(0, 2, 10);
    widths.push(text.width);
    expect(widths).toEqual([24, 36, 40, 30]);
  });

  it.each([
    ["AB", "ABCD", 28],
    ["Save", "S", 7],
  ])(
    "takes the width of the characters a TEXT write gives it, %s to %s",
    async (characters, shown, width) => {
      const probe = await probeFile();
      const { component, text } = componentText(probe.figma, characters, ROBOTO);
      link(component, text);
      const id = Object.keys(component.componentPropertyDefinitions)[0] ?? "";
      const instance = component.createInstance();
      const [label] = instance.children;
      if (label?.type !== "TEXT") {
        throw new Error("The instance shows no text.");
      }
      instance.setProperties({ [id]: shown });
      expect(label.width).toBe(width);
    }
  );
});

describe("a range write on an instance's text (FT4)", () => {
  // The fake measures text by size alone (rule 31), so FT4's Bold on `S` changes no width here, and
  // a range size write stands in for a write that grows the label. The fake sizes a component from a
  // text it hugs only through such a write, so the instance's width is read after it alone.
  it("lists nothing where it keeps the label's width, and resizes the hugging instance where it grows it", async () => {
    const probe = await probeFile();
    const component = probe.figma.createComponent();
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisSizingMode = "AUTO";
    component.counterAxisSizingMode = "AUTO";
    const text = probe.figma.createText();
    component.appendChild(text);
    text.fontName = ROBOTO;
    text.fontSize = 14;
    text.characters = "Save";
    link(component, text);
    const instance = component.createInstance();
    const [label] = instance.children;
    if (label?.type !== "TEXT") {
      throw new Error("The instance shows no text.");
    }
    const overrides = () =>
      instance.overrides.map(({ id, overriddenFields }) => [
        id === instance.id ? "instance" : id,
        [...overriddenFields].sort(),
      ]);
    label.setRangeFontSize(0, 1, 14);
    const kept = [label.width, overrides()];
    label.setRangeFontSize(0, 1, 20);
    expect([kept, [label.width, instance.width, overrides()]]).toEqual([
      [28, []],
      [31, 31, [["instance", ["height", "width"]]]],
    ]);
  });
});
