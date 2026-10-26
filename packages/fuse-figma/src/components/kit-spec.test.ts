/**
 * `walkLayers` over a hand-built root whose frames hold frames. The oracle is the layer order a
 * designer reads in Figma's layers panel, written out by hand: each layer, then what a frame
 * holds, before the next sibling. `coveredShadow` over hand-built layers, against CSS's painting
 * order. `glyphRanges` over the Dropdown menu shortcuts in `dropdown-menu-text.ts`, against the
 * positions of ⇧ and ⌘ in them counted by hand, and `glyphFonts` over a hand-built kit.
 */
import { describe, expect, it } from "vitest";

import { DROPDOWN_MENU_SHORTCUT_TEXT, DROPDOWN_POPUPS } from "./dropdown-menu-text";
import {
  coveredShadow,
  glyphFonts,
  glyphRanges,
  HUGGING_TEXT,
  NO_LIMITS,
  TOP_LEFT,
  walkLayers,
} from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentSetSpec,
  FrameLayerSpec,
  GlyphFontSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  TextLayerSpec,
} from "./kit-spec";

const zero = { kind: "literal", value: 0 } as const;
const black = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

function box(children: readonly ChildLayerSpec[]): BoxSpec {
  return {
    direction: "HORIZONTAL",
    sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: zero,
    paddingRight: zero,
    paddingBottom: zero,
    paddingLeft: zero,
    itemSpacing: zero,
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    cornerRadius: zero,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children,
  };
}

function frame(key: string, children: readonly ChildLayerSpec[]): FrameLayerSpec {
  return { kind: "frame", key, name: key, ...box(children) };
}

function text(key: string): TextLayerSpec {
  return {
    kind: "text",
    key,
    name: key,
    characters: key,
    textProperty: undefined,
    fontFamily: { kind: "literal", value: "Inter" },
    fontStyle: "Regular",
    fontSize: zero,
    lineHeight: zero,
    color: black,
    underline: undefined,
    sizing: HUGGING_TEXT,
    align: TOP_LEFT,
    truncation: undefined,
  };
}

function icon(key: string): IconLayerSpec {
  return {
    kind: "icon",
    key,
    name: key,
    icon: "icon/Check",
    swapProperty: undefined,
    size: zero,
    color: black,
  };
}

function instance(key: string): InstanceLayerSpec {
  return {
    kind: "instance",
    key,
    name: key,
    componentSet: "button",
    variant: "button/size=sm",
    sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
  };
}

describe("walkLayers", () => {
  // An instance is one row of this panel: the inner set's own panel lists what it holds.
  it("lists every layer below a root depth first, frames before what they hold, and an instance as one layer", () => {
    const root = box([
      icon("start"),
      frame("track", [frame("thumb", [icon("dot")]), text("caption")]),
      frame("empty", []),
      text("label"),
      frame("actions", [instance("action")]),
    ]);
    expect(walkLayers(root).map((layer) => layer.key)).toEqual([
      "start",
      "track",
      "thumb",
      "dot",
      "caption",
      "empty",
      "label",
      "actions",
      "action",
    ]);
  });
});

// Oracle: CSS 2.1 Appendix E, where a later box can paint its shadow above an earlier box's fill,
// which a box that puts its first layer on top would cover, and an 8-bit channel, which a fill moves
// only by half a step or more, so the clear fill a ring gets (alpha 0.0015) covers nothing.
describe("coveredShadow", () => {
  const ring = {
    color: black,
    offsetX: 0,
    offsetY: 0,
    radius: zero,
    spread: { kind: "literal", value: 2 },
  } as const;
  const filled = (key: string, a: number): FrameLayerSpec => ({
    ...frame(key, []),
    fill: { kind: "literal", color: { r: 0, g: 0, b: 1, a } },
  });
  const ringed = (key: string): FrameLayerSpec => ({ ...frame(key, []), shadows: [ring] });

  it.each([
    [
      "a fill nested in an earlier layer, before a later ring",
      [frame("header", [filled("badge", 1)]), ringed("footer")],
      { fill: "badge", shadow: "footer" },
    ],
    [
      "a fill, before a ring nested in a later layer",
      [filled("panel", 1), frame("header", [ringed("trigger")])],
      { fill: "panel", shadow: "trigger" },
    ],
    [
      "a fill at an alpha that moves a pixel, before a ring",
      [filled("panel", 0.002), ringed("footer")],
      { fill: "panel", shadow: "footer" },
    ],
    [
      "no fill where the earlier layer holds the clear fill a ring gets",
      [filled("trigger", 0.0015), ringed("footer")],
      undefined,
    ],
    ["no fill where the ring comes first", [ringed("header"), filled("panel", 1)], undefined],
    [
      "no fill where one layer holds the fill and the ring",
      [frame("header", [filled("badge", 1), ringed("trigger")])],
      undefined,
    ],
  ])("finds %s", (_case, layers, covered) => {
    expect(coveredShadow(layers)).toEqual(covered);
  });
});

/** The kit's glyph font: Inter for ⇧ and ⌘, which Roboto lacks (G1). */
const GLYPHS: GlyphFontSpec = { family: "Inter", glyphs: ["⇧", "⌘"] };

describe("glyphRanges", () => {
  it("gives each run of ⇧ and ⌘ in the docs shortcuts one range, and a label without them none", () => {
    const [group] = DROPDOWN_POPUPS.basic;
    const shortcuts = group.children.flatMap((child) => ("shortcut" in child ? [child.shortcut] : []));
    expect(
      [DROPDOWN_MENU_SHORTCUT_TEXT, ...shortcuts, "Profile", "P⌘⇧Q⌘"].map((text) => glyphRanges(text, GLYPHS))
    ).toEqual([
      [{ start: 0, end: 2 }],
      [{ start: 0, end: 2 }],
      [{ start: 0, end: 1 }],
      [{ start: 0, end: 1 }],
      [],
      [
        { start: 1, end: 3 },
        { start: 4, end: 5 },
      ],
    ]);
  });
});

describe("glyphFonts", () => {
  /** A set of one variant whose root holds `children`, with a `Keys` TEXT property. */
  function set(key: string, children: readonly ChildLayerSpec[]): ComponentSetSpec {
    return {
      key,
      page: "page",
      name: key,
      axes: [],
      columnAxis: "",
      textProperties: [{ name: "Keys", defaultValue: "K" }],
      swapProperties: [],
      variants: [{ key: `${key}/one`, properties: {}, root: { ...box(children), name: key } }],
    };
  }

  const keys: TextLayerSpec = { ...text("keys"), characters: "K", textProperty: "Keys", fontStyle: "Medium" };
  const shown = (value: string): InstanceLayerSpec => ({
    ...instance("row"),
    componentSet: "kbd",
    variant: "kbd/one",
    properties: { text: { Keys: value } },
  });

  it("loads the glyph font at the style of a label an instance's TEXT value gives a glyph", () => {
    const kit = { glyphFont: GLYPHS, componentSets: [set("kbd", [keys]), set("menu", [shown("⌘K")])] };
    expect(glyphFonts(kit)).toEqual([{ family: "Inter", style: "Medium" }]);
  });

  it("loads it at the style of a label whose own characters hold one, and not for a value without", () => {
    const own = { ...text("caption"), characters: "⇧ to select", fontStyle: "SemiBold" };
    const kit = { glyphFont: GLYPHS, componentSets: [set("kbd", [keys, own]), set("menu", [shown("K")])] };
    expect(glyphFonts(kit)).toEqual([{ family: "Inter", style: "SemiBold" }]);
  });
});
