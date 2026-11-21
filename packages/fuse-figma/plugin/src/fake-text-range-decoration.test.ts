/**
 * The in-memory file's per-character decoration and links, rules 66 and 68 in `fake/text.ts`. The
 * text planner reads a label's lines and links from `getStyledTextSegments` and writes them with
 * whole and range writes, so the fake must read and write them as a real file does. Unit under
 * test: the fake in `fake-figma.ts`. Oracle: the live probe of 2026-11-21 on the private draft file
 * `pPbebn8deYsvOlH1xFxq9w` (RD1 to RD14, RH1 to RH7), whose readings each case names.
 */
import { describe, expect, it } from "vitest";

import { createFakeFigma } from "./fake-figma.ts";
import { fixtureFile } from "./fake-fixtures.ts";

const BLUE: SolidPaint = { type: "SOLID", color: { r: 0, g: 0, b: 1 } };

/** A text of the given characters in Roboto Regular, its font loaded. */
async function textOf(characters: string) {
  const { figma } = fixtureFile([]);
  await figma.loadFontAsync({ family: "Roboto", style: "Regular" });
  const text = figma.createText();
  text.fontName = { family: "Roboto", style: "Regular" };
  text.characters = characters;
  return { figma, text };
}

/** An underline field as the probe wrote it down: its unit and value, `AUTO`, a color's blue, or `null`. */
function field(value: TextDecorationOffset | TextDecorationThickness | TextDecorationColor | null): string {
  if (value === null) {
    return "null";
  }
  if ("unit" in value) {
    return value.unit === "AUTO" ? "AUTO" : `${value.unit}${String(value.value)}`;
  }
  return value.value === "AUTO" ? "AUTO" : `blue${String(value.value.color.b)}`;
}

/** Each run of a text's characters with one line, as `characters|line|offset|color`. */
function lines(text: TextNode): readonly string[] {
  return text
    .getStyledTextSegments(["textDecoration", "textDecorationOffset", "textDecorationColor"])
    .map((segment) =>
      [
        segment.characters,
        segment.textDecoration,
        field(segment.textDecorationOffset),
        field(segment.textDecorationColor),
      ].join("|")
    );
}

/** Each run of a text's characters with one link, as `characters|url`, or `characters|none`. */
function links(text: TextNode): readonly string[] {
  return text
    .getStyledTextSegments(["hyperlink"])
    .map((segment) => `${segment.characters}|${segment.hyperlink?.value ?? "none"}`);
}

describe("the fake's per-character decoration", () => {
  it("keeps a range's line through font writes and gives every character the first one's on a characters write (RD2, RD3)", async () => {
    const { figma, text } = await textOf("Open. Pay now");
    await figma.loadFontAsync({ family: "Roboto", style: "Medium" });
    text.setRangeTextDecoration(6, 13, "UNDERLINE");
    text.setRangeTextDecorationOffset(6, 13, { unit: "PIXELS", value: 3 });
    text.fontName = { family: "Roboto", style: "Medium" };
    text.fontSize = 18;
    const kept = lines(text);
    text.characters = "Open. Pay now";
    expect([kept, lines(text)]).toEqual([
      ["Open. |NONE|null|null", "Pay now|UNDERLINE|PIXELS3|AUTO"],
      ["Open. Pay now|NONE|null|null"],
    ]);
  });

  it("refuses an underline field on characters that draw no underline (RD1b, RD13b)", async () => {
    const { text } = await textOf("Open. Pay now");
    const range = (): void => text.setRangeTextDecorationOffset(0, 6, { unit: "PIXELS", value: 5 });
    const whole = (): void => {
      text.textDecorationOffset = { unit: "PIXELS", value: 2 };
    };
    expect(range).toThrow("Cannot set text decoration offset on a non-underlined text range");
    expect(whole).toThrow("Cannot set text decoration offset on a non-underlined text range");
  });

  it("remembers a character's underline fields under NONE and shows them when it is underlined again (RD4b, RD11)", async () => {
    const { figma, text } = await textOf("Open. Pay now");
    text.setRangeTextDecoration(6, 13, "UNDERLINE");
    text.setRangeTextDecorationColor(6, 13, { value: BLUE });
    text.textDecoration = "NONE";
    const cleared = lines(text);
    text.setRangeTextDecoration(6, 13, "UNDERLINE");
    text.textDecoration = "UNDERLINE";
    expect([cleared, lines(text), text.textDecorationColor === figma.mixed]).toEqual([
      ["Open. Pay now|NONE|null|null"],
      ["Open. |UNDERLINE|AUTO|AUTO", "Pay now|UNDERLINE|AUTO|blue1"],
      true,
    ]);
  });

  it("writes a whole underline field on every underlined character, and reads the one they share (RD1, RD9, RD12)", async () => {
    const { figma, text } = await textOf("Open. Pay now");
    text.setRangeTextDecoration(6, 13, "UNDERLINE");
    text.setRangeTextDecorationOffset(6, 13, { unit: "PIXELS", value: 3 });
    const offset = text.textDecorationOffset;
    const shared = offset === figma.mixed ? "mixed" : field(offset);
    text.textDecorationOffset = { unit: "PIXELS", value: 1 };
    const written = lines(text);
    text.textDecoration = "UNDERLINE";
    expect([shared, written, lines(text)]).toEqual([
      "PIXELS3",
      ["Open. |NONE|null|null", "Pay now|UNDERLINE|PIXELS1|AUTO"],
      ["Open. Pay now|UNDERLINE|PIXELS1|AUTO"],
    ]);
  });

  it("shows a main's range lines on an instance, which follows the main's later writes (RD5, RD6, RD7)", async () => {
    const { figma, text } = await textOf("ABC");
    const component = figma.createComponent();
    component.appendChild(text);
    text.setRangeTextDecoration(1, 2, "UNDERLINE");
    text.setRangeTextDecorationColor(1, 2, { value: BLUE });
    const instance = component.createInstance();
    const shown = instance.children[0];
    if (shown?.type !== "TEXT") {
      throw new Error("the instance shows no text");
    }
    const first = lines(shown);
    text.setRangeTextDecoration(2, 3, "UNDERLINE");
    const followed = lines(shown);
    text.textDecoration = "STRIKETHROUGH";
    expect([first, followed, lines(shown), lines(text)]).toEqual([
      ["A|NONE|null|null", "B|UNDERLINE|AUTO|blue1", "C|NONE|null|null"],
      ["A|NONE|null|null", "B|UNDERLINE|AUTO|blue1", "C|UNDERLINE|AUTO|AUTO"],
      ["ABC|STRIKETHROUGH|null|null"],
      ["ABC|STRIKETHROUGH|null|null"],
    ]);
  });
});

describe("the fake's range decoration on an instance", () => {
  /** A component holding `ABC`, its font loaded, and an instance of it and the text it shows. */
  async function instanced() {
    const { figma, text } = await textOf("ABC");
    const component = figma.createComponent();
    component.appendChild(text);
    const instance = component.createInstance();
    const shown = instance.children[0];
    if (shown?.type !== "TEXT") {
      throw new Error("the instance shows no text");
    }
    return { text, instance, shown };
  }

  it("lists a range underline of the instance's own as overrides, after which the main's later range writes no longer reach it (RD8)", async () => {
    const { text, instance, shown } = await instanced();
    shown.setRangeTextDecoration(0, 1, "UNDERLINE");
    text.setRangeTextDecoration(2, 3, "UNDERLINE");
    expect([instance.overrides, lines(shown)]).toEqual([
      [{ id: shown.id, overriddenFields: ["characters", "styledTextSegments"] }],
      ["A|UNDERLINE|AUTO|AUTO", "BC|NONE|null|null"],
    ]);
  });

  // Oracle: the typings' `removeOverrides`, which "removes all direct overrides" of the instance.
  it("shows the main's lines again once the instance's overrides are removed", async () => {
    const { text, instance, shown } = await instanced();
    shown.setRangeTextDecoration(0, 1, "UNDERLINE");
    instance.removeOverrides();
    text.setRangeTextDecoration(2, 3, "UNDERLINE");
    expect([instance.overrides, lines(shown)]).toEqual([[], ["AB|NONE|null|null", "C|UNDERLINE|AUTO|AUTO"]]);
  });

  // By analogy with RD8, which probed a range underline: no probe wrote a range link on an instance.
  it("lists a range link of the instance's own as overrides, and follows the main's link again once they are removed", async () => {
    const { text, instance, shown } = await instanced();
    shown.setRangeHyperlink(0, 1, { type: "URL", value: "https://example.com/a" });
    const overrides = instance.overrides;
    instance.removeOverrides();
    text.hyperlink = { type: "URL", value: "https://example.com/abc" };
    expect([overrides, instance.overrides, links(shown)]).toEqual([
      [{ id: shown.id, overriddenFields: ["characters", "styledTextSegments"] }],
      [],
      ["ABC|https://example.com/abc"],
    ]);
  });
});

// Oracle: RD11 and RD12, where whole `AUTO` offset, thickness and color writes went to every
// character, and RD4b, where a character kept its underline fields under NONE.
describe("the fake's whole underline field writes", () => {
  it("gives a whole AUTO offset to a character whose underline a range cleared", async () => {
    const { text } = await textOf("Open. Pay now");
    text.setRangeTextDecoration(6, 13, "UNDERLINE");
    text.setRangeTextDecorationOffset(6, 13, { unit: "PIXELS", value: 3 });
    text.setRangeTextDecoration(6, 13, "NONE");
    text.setRangeTextDecoration(0, 6, "UNDERLINE");
    text.textDecorationOffset = { unit: "AUTO" };
    text.setRangeTextDecoration(6, 13, "UNDERLINE");
    expect(lines(text)).toEqual(["Open. Pay now|UNDERLINE|AUTO|AUTO"]);
  });
});

// Oracle: RD14, where a range's underline color bound to a COLOR variable read back bound to it and
// showed the variable's dark value in a frame that pinned the dark mode.
describe("the fake's bound range underline color", () => {
  it("reads the variable's value in the mode the text's frame pins, and keeps its binding", async () => {
    const { figma } = createFakeFigma({
      collections: [
        {
          name: "Fuse tokens",
          modes: ["Light", "Dark"],
          variables: [
            {
              name: "link",
              type: "COLOR",
              scopes: [],
              webSyntax: undefined,
              description: "",
              values: new Map([
                ["Light", { _tag: "Color", color: { r: 0, g: 0, b: 1, a: 1 } }],
                ["Dark", { _tag: "Color", color: { r: 1, g: 1, b: 0, a: 1 } }],
              ]),
            },
          ],
        },
      ],
    });
    const [collection] = await figma.variables.getLocalVariableCollectionsAsync();
    const [link] = await figma.variables.getLocalVariablesAsync("COLOR");
    const dark = collection?.modes.find((mode) => mode.name === "Dark")?.modeId;
    if (collection === undefined || link === undefined || dark === undefined) {
      throw new Error("The file holds no Dark mode of a COLOR variable.");
    }
    await figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    const frame = figma.createFrame();
    frame.setExplicitVariableModeForCollection(collection, dark);
    const text = figma.createText();
    frame.appendChild(text);
    text.fontName = { family: "Roboto", style: "Regular" };
    text.characters = "Pay";
    text.setRangeTextDecoration(0, 3, "UNDERLINE");
    text.setRangeTextDecorationColor(0, 3, {
      value: figma.variables.setBoundVariableForPaint(
        { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
        "color",
        link
      ),
    });
    const [segment] = text.getStyledTextSegments(["textDecorationColor"]);
    const held = segment?.textDecorationColor;
    const paint = held === null || held === undefined || held.value === "AUTO" ? undefined : held.value;
    expect([paint?.color, paint?.boundVariables?.color?.id]).toEqual([{ r: 1, g: 1, b: 0 }, link.id]);
  });
});

describe("the fake's per-character links", () => {
  it("links a range to an absolute URL, which reads mixed on the whole text, and keeps it through fills, decoration and size writes (RH1, RH4)", async () => {
    const { figma, text } = await textOf("Open. Pay now");
    text.setRangeHyperlink(6, 13, { type: "URL", value: "https://example.com/pay?id=4821" });
    text.fontSize = 16;
    text.textDecoration = "NONE";
    text.fills = [BLUE];
    expect([links(text), text.hyperlink === figma.mixed]).toEqual([
      ["Open. |none", "Pay now|https://example.com/pay?id=4821"],
      true,
    ]);
  });

  it("refuses a fragment or a relative URL as a range's link (RH2)", async () => {
    const { text } = await textOf("Open. View invoice 4821");
    expect(() => text.setRangeHyperlink(6, 23, { type: "URL", value: "#invoice-4821" })).toThrow(
      "Unsupported or invalid hyperlink url"
    );
    expect(() => text.setRangeHyperlink(0, 4, { type: "URL", value: "/invoices/1042" })).toThrow(
      "Unsupported or invalid hyperlink url"
    );
  });

  it("clears every range's link with a whole null, and gives every character the first one's on a characters write (RH5, RH6)", async () => {
    const whole = await textOf("Whole");
    whole.text.hyperlink = { type: "URL", value: "https://example.com/" };
    whole.text.setRangeHyperlink(0, 2, null);
    const parted = links(whole.text);
    whole.text.hyperlink = null;
    const ranged = await textOf("Open. Pay now");
    ranged.text.setRangeHyperlink(6, 13, { type: "URL", value: "https://example.com/pay" });
    ranged.text.characters = "Open. Pay now";
    expect([parted, links(whole.text), links(ranged.text)]).toEqual([
      ["Wh|none", "ole|https://example.com/"],
      ["Whole|none"],
      ["Open. Pay now|none"],
    ]);
  });

  it("shows a main's range link on an instance, which follows the main's later writes (RH7)", async () => {
    const { figma, text } = await textOf("ABC");
    const component = figma.createComponent();
    component.appendChild(text);
    text.setRangeHyperlink(1, 2, { type: "URL", value: "https://example.com/b" });
    const instance = component.createInstance();
    const shown = instance.children[0];
    if (shown?.type !== "TEXT") {
      throw new Error("the instance shows no text");
    }
    const first = links(shown);
    text.setRangeHyperlink(1, 3, { type: "URL", value: "https://example.com/bc" });
    expect([first, links(shown)]).toEqual([
      ["A|none", "B|https://example.com/b", "C|none"],
      ["A|none", "BC|https://example.com/bc"],
    ]);
  });
});
