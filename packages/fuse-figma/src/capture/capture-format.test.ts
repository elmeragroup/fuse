/**
 * Unit under test: `capturesAgree`, which `figma:capture --check` holds a fresh capture to the kept
 * one with. Oracle: the wrapped Combobox chips field's dense layout as Chromium measured it on
 * 2026-11-22, on macOS and in Playwright's Linux image, where Linux sets each chip's text on whole
 * pixels: `Apple` 58.828px and 59px, `Banana` 68.344px and 68px, `Cherry` 63.406px and 63px and
 * `Date` 52.734px and 52px, 6px apart, `Date` and the input on a second line 28px down, and the input
 * filling the 242px line, which grows from its intrinsic width, 146px and 160px. The two readings
 * break the same lines with the same gaps, so the captures agree. A fresh capture that moves an item
 * to another line, opens another gap, sets an item at its own width more than 2px apart, leaves the
 * input short of the line's end or changes any other byte does not, a space or a refusal's reason
 * included.
 */
import { describe, expect, it } from "vitest";

import { CAPTURE_FORMAT, CAPTURE_VERSION, capturesAgree, formatCapture } from "./capture-format.ts";
import type { FlexLineItem, SetCapture } from "./capture-format.ts";

/** An item by its box and its own width. */
type Box = readonly [x: number, y: number, width: number, height: number, own: number];

const MACOS: readonly Box[] = [
  [0, 0, 58.828125, 22, 58.828125],
  [64.828125, 0, 68.34375, 22, 68.34375],
  [139.171875, 0, 63.40625, 22, 63.40625],
  [0, 28, 52.734375, 22, 52.734375],
  [58.734375, 29, 183.265625, 20, 146],
];

const LINUX: readonly Box[] = [
  [0, 0, 59, 22, 59],
  [65, 0, 68, 22, 68],
  [139, 0, 63, 22, 63],
  [0, 28, 52, 22, 52],
  [58, 29, 184, 20, 160],
];

/** The text of a one-cell capture whose root is a wrapping row with this dense layout. */
function captureOf(boxes: readonly Box[], text = "chips"): string {
  const items: FlexLineItem[] = boxes.map(([x, y, width, height, own]) => ({ x, y, width, height, own }));
  const capture: SetCapture = {
    format: CAPTURE_FORMAT,
    version: CAPTURE_VERSION,
    set: "sample",
    environment: { chromium: "", theme: "", locale: "" },
    page: [],
    declarations: [],
    cells: [
      {
        key: "sample/state=rest",
        cell: { state: "rest" },
        roots: [
          {
            around: [],
            root: {
              tag: "div",
              attributes: {},
              classes: [],
              text,
              declarations: [],
              initial: [],
              pseudo: {},
              variables: {},
              unmatched: [],
              measured: {
                flexLines: {
                  fills: [{ mode: "light / dense", density: "dense", width: 242, items }],
                },
              },
              children: [],
            },
          },
        ],
      },
    ],
  };
  return formatCapture(capture);
}

/** The macOS layout with one item's box changed. */
function moved(index: number, box: Box): readonly Box[] {
  return MACOS.map((each, at) => (at === index ? box : each));
}

describe("capturesAgree", () => {
  it("counts a Linux capture whose text sets on whole pixels as the kept macOS one", () => {
    expect(capturesAgree(captureOf(MACOS), captureOf(LINUX))).toBe(true);
  });

  it.each([
    ["Date on the first line", moved(3, [208.578125, 0, 52.734375, 22, 52.734375])],
    ["Banana 8px after Apple", moved(1, [66.828125, 0, 68.34375, 22, 68.34375])],
    ["Cherry 3px wider at its own width", moved(2, [139.171875, 0, 66.40625, 22, 66.40625])],
    ["the input short of the line's end", moved(4, [58.734375, 29, 180, 20, 146])],
  ] as const)("tells a capture with %s from the kept one", (_, boxes) => {
    expect(capturesAgree(captureOf(MACOS), captureOf(boxes))).toBe(false);
  });

  it("tells a capture that differs outside the layouts from the kept one", () => {
    expect(capturesAgree(captureOf(MACOS), captureOf(LINUX, "chip"))).toBe(false);
  });

  it("tells a capture that differs by a space outside the layouts from the kept one", () => {
    expect(capturesAgree(captureOf(MACOS), captureOf(LINUX).replace('"format"', ' "format"'))).toBe(false);
  });

  it("tells a capture whose row refuses from one whose row refuses for another reason", () => {
    const refusing = (fact: string) =>
      captureOf(MACOS).replace(/"flexLines":\{"fills":.*?\]\}\]\}/, `"flexLines":"${fact}"`);
    expect([
      refusing("unread").includes('"flexLines":"unread"'),
      capturesAgree(refusing("unread"), refusing("shrinks")),
    ]).toEqual([true, false]);
  });
});
