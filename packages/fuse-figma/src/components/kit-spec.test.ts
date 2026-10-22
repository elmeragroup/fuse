/**
 * `walkLayers` over a hand-built root whose frames hold frames. The oracle is the layer order a
 * designer reads in Figma's layers panel, written out by hand: each layer, then what a frame
 * holds, before the next sibling.
 */
import { describe, expect, it } from "vitest";

import { HUGGING_TEXT, NO_LIMITS, TOP_LEFT, walkLayers } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec, FrameLayerSpec, IconLayerSpec, TextLayerSpec } from "./kit-spec";

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

describe("walkLayers", () => {
  it("lists every layer below a root depth first, frames before what they hold", () => {
    const root = box([
      icon("start"),
      frame("track", [frame("thumb", [icon("dot")]), text("caption")]),
      frame("empty", []),
      text("label"),
    ]);
    expect(walkLayers(root).map((layer) => layer.key)).toEqual([
      "start",
      "track",
      "thumb",
      "dot",
      "caption",
      "empty",
      "label",
    ]);
  });
});
