/**
 * How the build paints a box: a background clipped to the padding box, `currentcolor` a custom property passes down, and a part under `visibility: hidden`. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that says what the
 * browser draws, or the Figma plugin typings that say what Figma draws, under the coverage contract,
 * where a declaration that does not reach Figma is `unmapped` and one with nothing to draw is
 * `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  buildChip,
  chip,
  fixedSize,
  frameOf,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
import { makeVariableIndex } from "./css-values";

// Oracle: CSS Backgrounds 3 §3.7 and the Figma plugin typings. `padding-box` paints the background
// inside the border only, where Figma paints a fill under the whole frame and an INSIDE stroke over
// it: the two draw alike where the box has no border, or a solid border that hides the fill under it
// because it is opaque. A translucent or dashed border shows what the clip leaves out.
describe("background-clip: padding-box", () => {
  it.each([
    [
      "bg-clip-padding bg-[#ffffff]",
      "dropped",
      "the box has no border, so its padding box is its border box",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border border-[#000000]",
      "dropped",
      "the box's border draws as a solid stroke, opaque in every mode, over the fill beneath it",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border border-[#00000080]",
      "unmapped",
      "no Figma field reads padding-box",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border border-dashed border-[#000000]",
      "unmapped",
      "no Figma field reads padding-box",
    ],
    [
      "bg-clip-padding bg-[#ffffff] border-0 border-s border-[#00000080]",
      "unmapped",
      "no Figma field reads padding-box",
    ],
  ])("on %s is %s", async (classes, outcome, detail) => {
    const { coverage } = await buildChip(classes);
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([["background-clip", outcome, detail]]);
  });

  it.each([
    [true, "dropped"],
    [false, "unmapped"],
  ])("beside a border bound to a variable opaque in every mode (%s) is %s", async (opaque, outcome) => {
    const variables = makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "border" }, webSyntax: "var(--border)", opaque },
    ]);
    const { coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "bg-clip-padding bg-[#ffffff] border border-(--border)" }),
      { variables }
    );
    expect(notesOf(coverage, "bg-clip-padding").map(([, read]) => read)).toEqual([outcome]);
  });
});

// Oracle: CSS Color 4 §6.4. `currentcolor` that a custom property passes down resolves where it is
// used: on `color`, to the color the element inherits, and on any other property, to the element's
// own `color`.
describe("currentcolor through a custom property", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;
  const GREEN = { kind: "literal", color: { r: 0, g: 1, b: 0, a: 1 } } as const;

  it("fills a part with the part's own color", async () => {
    const { variant } = await buildChip(
      "flex text-[#ff0000] [--x:currentColor]",
      [{ slot: "chip-dot", classes: "size-[8px] text-[#00ff00] bg-(--x)" }],
      { parts: [part()] }
    );
    expect(frameOf(variant?.root)?.fill).toEqual(GREEN);
  });

  it("colors a part's text with the color it inherits", async () => {
    const { variant } = await buildCaptured(
      chip({
        parts: [
          part({
            label: {
              key: "label",
              name: "label",
              characters: "Hi",
              textProperty: undefined,
              shownIn: () => true,
            },
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex font-sans text-[14px] leading-[20px] text-[#ff0000] [--x:currentColor]",
        children: [{ slot: "chip-dot", text: "Hi", classes: "text-(color:--x)" }],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    const text = frameOf(variant?.root)?.children[0];
    expect(text?.kind === "text" ? text.color : text).toEqual(RED);
  });

  it("colors the text of a part below with the color the declaring part inherits", async () => {
    const { variant } = await buildCaptured(
      chip({
        parts: [
          part({
            parts: [
              part({
                key: "cell",
                slot: "cell",
                label: {
                  key: "label",
                  name: "label",
                  characters: "Hi",
                  textProperty: undefined,
                  shownIn: () => true,
                },
              }),
            ],
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex font-sans text-[14px] leading-[20px] text-[#ff0000] [--x:currentColor]",
        children: [
          { slot: "chip-dot", classes: "flex text-(color:--x)", children: [{ slot: "cell", text: "Hi" }] },
        ],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    const text = frameOf(frameOf(variant?.root))?.children[0];
    expect(text?.kind === "text" ? text.color : text).toEqual(RED);
  });
});

// Oracle: CSS Display 3 §4.1 and the Figma plugin typings. `visibility: hidden` paints nothing of
// the box while it keeps its room, and a Figma layer with `visible` false paints nothing while its
// auto layout lays out as if it were gone. The two draw alike where the hidden part is the one layer
// of a box fixed on both axes, which keeps its size either way, or of a box that hugs it, drawn at the
// part's literal size and its own padding and border, as CSS keeps the hidden part's room in it; a
// part whose margins a hugging frame draws has no literal size there, so a box that hugs it cannot
// keep the room CSS keeps for it (8px and 2px margins hold 12px), and it stays unmapped.
describe("a hidden part", () => {
  it("draws hidden as the one layer of a fixed box", async () => {
    const { variant, coverage } = await buildChip(
      "flex size-[24px]",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBe(true);
    expect(notesOf(coverage, "invisible").map(([property, outcome]) => [property, outcome])).toEqual([
      ["visibility", "literal"],
    ]);
  });

  it("draws hidden in a box that hugs it, which keeps the part's literal size and its padding", async () => {
    const { variant } = await buildChip(
      "flex p-[2px]",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBe(true);
    expect(variant?.root.sizing).toEqual(fixedSize(literal(12), literal(12)));
  });

  it("keeps a shorthand border beside the padding around the part it holds", async () => {
    const { variant } = await buildChip(
      "flex p-[2px] border-[3px] border-[#000000]",
      [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
      { parts: [part()] }
    );
    expect(variant?.root.sizing).toEqual(fixedSize(literal(18), literal(18)));
  });

  it("hides a part with margins in a fixed box, and leaves it unmapped in a box that hugs it", async () => {
    const hidden = async (classes: string) => {
      const { variant, coverage } = await buildChip(
        classes,
        [{ slot: "chip-dot", classes: "size-[8px] m-[2px] invisible" }],
        {
          parts: [part()],
        }
      );
      return {
        hidden: frameOf(variant?.root)?.hidden,
        notes: notesOf(coverage, "invisible").map(([, outcome]) => outcome),
      };
    };
    expect(await hidden("flex size-[24px]")).toEqual({ hidden: true, notes: ["literal"] });
    expect(await hidden("flex")).toEqual({ hidden: undefined, notes: ["unmapped"] });
  });

  it("stays unmapped in a box that hugs a part of no literal size", async () => {
    const { variant, coverage } = await buildChip(
      "flex",
      [{ slot: "chip-dot", classes: "h-[8px] invisible" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.hidden).toBeUndefined();
    expect(notesOf(coverage, "invisible").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Logical Properties 1 §6.2 and CSS Backgrounds 3 §5.5, against Figma's four corner
// radii, each capped at half the shorter side (probe P10). On the kit's left-to-right page
// `rounded-s-*` rounds the top left and bottom left. CSS scales every radius by one factor where the
// radii along a side add past it, so `rounded-s-full` on a 36px square is 18px on both left corners,
// within the cap, and two 20px corners along a 36px side are 18px each; `rounded-tl-full` alone
// scales to the whole 36px side, a 30px corner alone keeps 30px, and a 30px and a 10px corner along
// a 36px side are 27px and 9px, each past the 18px Figma would draw, so they stay unmapped. A variable maps only where its greatest value in any mode leaves
// CSS nothing to scale and stays within the cap. A box that also sets `border-radius` leaves the
// order of the two to the cascade, which the build does not read, so it stays unmapped too.
describe("a radius per corner", () => {
  const corners = (topLeft: number, topRight: number, bottomRight: number, bottomLeft: number) => ({
    kind: "corners",
    topLeft: literal(topLeft),
    topRight: literal(topRight),
    bottomRight: literal(bottomRight),
    bottomLeft: literal(bottomLeft),
  });

  it.each([
    ["size-[36px] rounded-s-full", corners(18, 0, 0, 18)],
    ["size-[36px] rounded-e-full", corners(0, 18, 18, 0)],
    ["size-[36px] rounded-t-[8px]", corners(8, 8, 0, 0)],
    ["size-[36px] rounded-ss-[4px] rounded-ee-[6px]", corners(4, 0, 6, 0)],
    ["size-[36px] rounded-tl-[20px] rounded-tr-[20px]", corners(18, 18, 0, 0)],
  ])("draws %s on the corners it names", async (classes, expected) => {
    const { variant, coverage } = await buildChip(classes);
    expect(variant?.root.cornerRadius).toEqual(expected);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("reads the sides of a box that hugs one part of a literal size", async () => {
    const { variant } = await buildChip(
      "flex rounded-s-full",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      {
        parts: [part()],
      }
    );
    expect(variant?.root.cornerRadius).toEqual(corners(18, 0, 0, 18));
  });

  // Oracle: CSS Backgrounds 3 §3.5 and §5.5. `border: 2px solid` adds 2px on each side, so the box
  // that hugs the 36px part is a 40px square, and Chromium rounds its left corners at 20px.
  it("reads the sides a border shorthand adds to a box that hugs one part", async () => {
    const { variant } = await buildChip(
      "flex rounded-s-full [border:2px_solid] border-[#ff0000]",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      { parts: [part()] }
    );
    expect(variant?.root.stroke).toEqual({
      color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
      weight: literal(2),
    });
    expect(variant?.root.cornerRadius).toEqual(corners(20, 0, 0, 20));
  });

  it("reads the sides a box's minimum holds it at around a smaller part, as CSS raises it", async () => {
    const { variant } = await buildChip(
      "flex min-w-[64px] min-h-[64px] rounded-s-full",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      { parts: [part()] }
    );
    expect(variant?.root.cornerRadius).toEqual(corners(32, 0, 0, 32));
  });

  it("leaves the corners unmapped where a limit it cannot read could set the box's side", async () => {
    const { variant } = await buildChip(
      "flex min-w-[50%] rounded-s-full",
      [{ slot: "chip-dot", classes: "size-[36px]" }],
      {
        parts: [part()],
      }
    );
    expect(variant?.root.cornerRadius).toEqual(literal(0));
  });

  it("binds each corner a variable sets to that variable", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 16,
      },
    ]);
    const { variant } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "size-[36px] rounded-t-(--radius)" }),
      {
        variables,
      }
    );
    const radius = { kind: "variable", variable: { collection: "Fuse tokens", name: "radius" } };
    expect(variant?.root.cornerRadius).toEqual({
      kind: "corners",
      topLeft: radius,
      topRight: radius,
      bottomRight: literal(0),
      bottomLeft: literal(0),
    });
  });

  it("leaves a variable that CSS scales in some mode unmapped", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 24,
      },
    ]);
    const { variant } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "size-[36px] rounded-t-(--radius)" }),
      {
        variables,
      }
    );
    expect(variant?.root.cornerRadius).toEqual(literal(0));
  });

  // A min-square control, whose height is a variable and its minimum width: CSS scales the two
  // radii of its left or right side to at most half the height, and Figma caps each corner at half
  // the shorter side, the height, so a radius past half the least height still draws alike. Any
  // other corner set on such a box stays unmapped, since CSS and Figma part where a radius overruns.
  describe("on a box whose height is a variable and its minimum width", () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 24,
      },
      {
        ref: { collection: "Fuse density", name: "control-h" },
        webSyntax: "var(--control-h)",
        minimum: 24,
        maximum: 32,
      },
    ]);
    const radius = { kind: "variable", variable: { collection: "Fuse tokens", name: "radius" } };
    const square = "flex h-(--control-h) min-w-(--control-h)";

    it.each([
      [
        "rounded-s-(--radius)",
        { topLeft: radius, topRight: literal(0), bottomRight: literal(0), bottomLeft: radius },
      ],
      [
        "rounded-e-(--radius)",
        { topLeft: literal(0), topRight: radius, bottomRight: radius, bottomLeft: literal(0) },
      ],
    ])("draws %s on the side it names", async (classes, expected) => {
      const { variant } = await buildCaptured(
        chip(),
        rest({ slot: "chip", classes: `${square} ${classes}` }),
        {
          variables,
        }
      );
      expect(variant?.root.cornerRadius).toEqual({ kind: "corners", ...expected });
    });

    it.each([
      // The pair sits on the top side, the width, which can be longer than the height.
      `${square} rounded-t-(--radius)`,
      // One corner alone scales to the whole side in CSS, past Figma's cap.
      `${square} rounded-tl-(--radius)`,
      // Two radii along one side scale by one factor in CSS, where Figma caps each on its own.
      `${square} rounded-tl-(--radius) rounded-bl-[4px]`,
      // With no minimum width, the box can be narrower than it is tall.
      "flex h-(--control-h) rounded-s-(--radius)",
      // The minimum height the sizing leaves unmapped makes the box 24 by 48 at the least height,
      // where CSS draws the 24px radii whole and Figma would cap them at 12px against a 24px height.
      `${square} min-h-[48px] rounded-s-[24px]`,
    ])("leaves %s unmapped", async (classes) => {
      const { variant } = await buildCaptured(chip(), rest({ slot: "chip", classes }), { variables });
      expect(variant?.root.cornerRadius).toEqual(literal(0));
    });
  });

  // Oracle: CSS Variables 1 §3 and CSS Backgrounds 3 §5.1. A `var()` is substituted before the
  // shorthand's values are counted, so `var(--pair) 4px` with `--pair: 2px 8px` is `2px 8px 4px`,
  // whose top right corner is 8px, and a lone `var(--pair)` is `2px 8px`, whose bottom right corner
  // is 2px. Read as written, the value's second token, 4px, would take the first box's corner, and
  // the lone `var()` gives each corner `2px 8px`, which reads as no radius.
  it.each([
    ["var(--pair) 4px", ["top-left", "bottom-right", "bottom-left"]],
    ["var(--pair)", ["top-left"]],
  ])(
    "leaves border-radius: %s, whose var() stands for several values, unmapped where it wins some corners",
    async (value, zeroed) => {
      const written = (property: string, each: string) => ({
        className: "pair-radius",
        property,
        value: each,
      });
      const { variant, coverage } = await buildCaptured(
        chip(),
        rest({
          slot: "chip",
          classes: "w-[64px] h-[36px]",
          written: [
            written("--pair", "2px 8px"),
            written("border-radius", value),
            ...zeroed.map((corner) => written(`border-${corner}-radius`, "0")),
          ],
        })
      );
      expect(variant?.root.cornerRadius).toEqual(literal(0));
      const outcomes = notesOf(coverage, "pair-radius")
        .filter(([property]) => String(property).endsWith("radius"))
        .map(([, outcome]) => outcome);
      expect(new Set(outcomes)).toEqual(new Set(["unmapped"]));
    }
  );

  // Oracle: CSS Logical Properties 1 §4.4 and CSS Backgrounds 3 §5.1. On a left-to-right page a
  // start corner is a left one, so a later `rounded-s-*` wins the two left corners over an earlier
  // `border-radius`, which keeps the right ones.
  it.each([
    ["size-[36px] rounded-none rounded-s-[8px]", corners(8, 0, 0, 8)],
    ["size-[36px] rounded-[4px] rounded-s-[8px]", corners(8, 4, 4, 8)],
  ])("draws %s with the start corners on the left", async (classes, expected) => {
    const { variant } = await buildChip(classes);
    expect(variant?.root.cornerRadius).toEqual(expected);
  });

  // Oracle: CSS 2 §10.7 and CSS Backgrounds 3 §5.5. A 48px `min-height` wins over the 24px height,
  // so Chromium draws a 48px square, whose two 24px left radii sum to its height and draw whole. The
  // build leaves the variable `min-height` unmapped and reads a 48 by 24 box, where CSS would scale
  // the radii to 12px, so it can tell neither length.
  it("leaves the corners unmapped where an unmapped min-height can make the box taller", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse density", name: "tall" },
        webSyntax: "var(--tall)",
        minimum: 48,
        maximum: 48,
      },
    ]);
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "flex w-[48px] h-[24px] min-h-(--tall) rounded-none rounded-l-[24px]" }),
      { variables }
    );
    expect(variant?.root.cornerRadius).toEqual(literal(0));
    expect(notesOf(coverage, "rounded-l-[24px]").map(([, outcome]) => outcome)).toEqual([
      "unmapped",
      "unmapped",
    ]);
  });

  // Oracle: CSS Backgrounds 3 §5.1 and CSS Values 4 §10.12. A radius is a non-negative length, so
  // Chromium rejects `12` with no unit, and clamps `calc(2px - 4px)` to 0, at the time it
  // substitutes the `var()`. The lone `var()` the capture holds can stand for either.
  it.each(["12", "calc(2px - 4px)"])(
    "leaves border-radius: var(--r), with --r: %s, unmapped where it wins some corners",
    async (radius) => {
      const written = (property: string, value: string) => ({ className: "lone-radius", property, value });
      const { variant, coverage } = await buildCaptured(
        chip(),
        rest({
          slot: "chip",
          classes: "w-[64px] h-[36px]",
          written: [
            written("--r", radius),
            written("border-radius", "var(--r)"),
            written("border-top-left-radius", "0"),
          ],
        })
      );
      expect(variant?.root.cornerRadius).toEqual(literal(0));
      const outcomes = notesOf(coverage, "lone-radius")
        .filter(([property]) => String(property).endsWith("radius"))
        .map(([, outcome]) => outcome);
      expect(new Set(outcomes)).toEqual(new Set(["unmapped"]));
    }
  );

  // Oracle: CSS Values 4 §10.12 and CSS Backgrounds 3 §5.1. Chromium clamps `calc(8px - 12px)` to
  // 0px, since a radius is a non-negative length, so a 64 by 36 box draws the bottom right corner
  // square and keeps the 5px top right and bottom left corners.
  it("clamps a negative calc() radius to 0 where border-radius wins some corners", async () => {
    const { variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[64px] h-[36px]",
        written: [
          { className: "negative-radius", property: "border-radius", value: "calc(8px - 12px) 5px" },
          { className: "negative-radius", property: "border-top-left-radius", value: "0" },
        ],
      })
    );
    expect(variant?.root.cornerRadius).toEqual(corners(0, 5, 0, 5));
  });

  // Oracle: CSS 2 §10.7 and CSS Backgrounds 3 §5.5. The 48px `min-height` wins over the 24px height,
  // so Chromium draws a 48px square, whose infinite radius draws as 24px. The build leaves the
  // variable `min-height` unmapped and reads a 48 by 24 box, whose half shorter side is 12px.
  it("leaves rounded-full unmapped where an unmapped min-height can make the box taller", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse density", name: "tall" },
        webSyntax: "var(--tall)",
        minimum: 48,
        maximum: 48,
      },
    ]);
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "flex w-[48px] h-[24px] min-h-(--tall) rounded-full" }),
      { variables }
    );
    expect(variant?.root.cornerRadius).toEqual(literal(0));
    expect(notesOf(coverage, "rounded-full").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });

  it.each([
    "size-[36px] rounded-tl-full",
    "size-[36px] rounded-tl-[30px]",
    "size-[36px] rounded-tl-[30px] rounded-tr-[10px]",
    "rounded-s-full",
  ])("leaves %s unmapped", async (classes) => {
    const { variant, coverage } = await buildChip(classes);
    expect(variant?.root.cornerRadius).toEqual(literal(0));
    expect(coverage.some((row) => row.outcome === "unmapped" && row.property.endsWith("radius"))).toBe(true);
  });
});

// Oracle: CSS Logical Properties 1 §4, CSS Cascade 5 §6 and CSS Backgrounds 3 §3.3. In a
// left-to-right horizontal page `border-inline-start-color` and `border-inline-color` set the left
// side's color, and the declaration applied last wins it, so `border-s-*` or `border-x-*` after a
// `border-*` color paints the left side, as a chip segment's `border-transparent border-0 border-s
// border-s-border` draws a hairline. A side at a zero width draws nothing whatever its style.
describe("a stroke on some sides", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;

  it("takes the color its drawing side sets of its own", async () => {
    const { variant, coverage } = await buildChip(
      "border border-transparent border-0 border-s border-s-[#ff0000]"
    );
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 0, bottom: 0, left: 1 } });
    expect(notesOf(coverage, "border-transparent")).toEqual([
      ["border-color", "dropped", "it colors only sides the border gives no width, which draw nothing"],
    ]);
  });

  it("takes the color of the axis shorthand that wins its drawing side", async () => {
    const { variant, coverage } = await buildChip("border-s border-transparent border-x-[#ff0000]");
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 0, bottom: 0, left: 1 } });
    expect(notesOf(coverage, "border-transparent")).toEqual([
      ["border-color", "dropped", "it colors only sides the border gives no width, which draw nothing"],
    ]);
  });

  // The four sides' own zero widths agree, so the border draws as one border of no width.
  it.each([
    ["border-s-0 border-transparent", "it colors only sides the border gives no width, which draw nothing"],
    [
      "border-s-0 [border-inline-start-style:dashed] border-s-[#ff0000]",
      "it colors only sides the border gives no width, which draw nothing",
    ],
    [
      "border-t-0 border-r-0 border-b-0 border-l-0 border-transparent",
      "the border has no width, so it draws nothing",
    ],
  ])("draws no stroke from %s, whose sides have no width", async (classes, detail) => {
    const { variant, coverage } = await buildChip(classes);
    expect(variant?.root.stroke).toBeUndefined();
    const color = classes.split(" ").at(-1) ?? "";
    expect(notesOf(coverage, color).map(([, outcome, note]) => [outcome, note])).toEqual([
      ["dropped", detail],
    ]);
  });

  it("leaves the stroke unmapped where a border shorthand wins its drawing side's color", async () => {
    // `border-left` comes after `border-inline-color`, so its blue wins the left side's color, and
    // the left side's own width and style, after both, draw it.
    const { variant, coverage } = await buildChip(
      "[border-inline-color:#ff0000] [border-left:0_solid_#0000ff] border-l [border-left-style:solid]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "[border-left:0_solid_#0000ff]")).toEqual([
      [
        "border-left",
        "unmapped",
        "a border shorthand colors a side that draws, and the build does not read it",
      ],
    ]);
    expect(notesOf(coverage, "[border-inline-color:#ff0000]")).toEqual([
      [
        "border-inline-color",
        "dropped",
        "it colors only sides the border gives no width, which draw nothing",
      ],
    ]);
  });

  it("leaves a side's color unmapped where its style does not map", async () => {
    const { variant, coverage } = await buildChip(
      "border-s [border-inline-start-style:dashed] border-transparent border-s-[#ff0000]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "border-s-[#ff0000]").map(([property, outcome]) => [property, outcome])).toEqual(
      [["border-inline-start-color", "unmapped"]]
    );
  });

  // Oracle: CSS Backgrounds 3 §3 and CSS Cascade 5 §6. Each side's width, style and color cascade on
  // their own, so a later side longhand wins only its side and the earlier `border-width` or
  // `border-style` keeps the other three: Chromium draws a solid red border on all four sides, with
  // the left side's own width. Four equal sides draw as one weight.
  it.each([
    ["[border-left-width:2px]", "2px", { weight: literal(2) }],
    ["[border-left-width:2px]", "1px", { sides: { top: 1, right: 1, bottom: 1, left: 2 } }],
    ["[border-left-style:solid]", "2px", { weight: literal(2) }],
  ])("draws every side where %s follows a %s solid border", async (side, width, drawn) => {
    const { variant } = await buildChip(
      `[border-width:${width}] [border-style:solid] border-[#ff0000] ${side}`
    );
    expect(variant?.root.stroke).toEqual({ color: RED, ...drawn });
  });

  // Oracle: CSS Backgrounds 3 §3.5. `border-left` after the red border wins the left side's width,
  // style and color, so Chromium draws the left side 2px solid blue beside three 1px red ones. The
  // build reads the shorthand's width and style but no shorthand's color, so the stroke stays out
  // rather than drawing the left side red.
  it("leaves the stroke unmapped where a side shorthand wins a side's color", async () => {
    const { variant, coverage } = await buildChip(
      "[border-width:1px] [border-style:solid] border-[#ff0000] [border-left:2px_solid_#0000ff]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "[border-left:2px_solid_#0000ff]")).toContainEqual([
      "border-left",
      "unmapped",
      "a border shorthand colors a side that draws, and the build does not read it",
    ]);
  });

  // Oracle: CSS Backgrounds 3 §3 and §4.2, and the dash lengths `dashesOf` records from Chromium.
  // The left side's own 2px width equals the 2px the other three take from `border-width`, so all
  // four sides are 2px dashed red, and Chromium draws one dashed border of 6px dashes and 4px gaps.
  it("draws one dashed stroke where a side's own width equals the others'", async () => {
    const { variant } = await buildChip(
      "[border-width:2px] [border-style:dashed] border-[#ff0000] [border-left-width:2px]"
    );
    expect(variant?.root.stroke).toEqual({ color: RED, weight: literal(2), dashPattern: [6, 4] });
  });

  // Oracle: CSS Values 4 §10.1 and CSS Color 4 §5.1. `calc(1px + 1px)` computes to 2px and
  // `rgb(255 0 0)` to the red `#ff0000` names, so the left side's own width or color equals the other
  // three sides', and Chromium draws one 2px dashed red border.
  it.each([["[border-left-width:calc(1px_+_1px)]"], ["[border-left-color:rgb(255_0_0)]"]])(
    "draws one dashed stroke where %s equals the other sides' value",
    async (side) => {
      const { variant } = await buildChip(
        `[border-width:2px] [border-style:dashed] border-[#ff0000] ${side}`
      );
      expect(variant?.root.stroke).toEqual({ color: RED, weight: literal(2), dashPattern: [6, 4] });
    }
  );

  // Oracle: CSS Backgrounds 3 §4.3 and CSS Variables 1 §3. A border width takes no unitless number
  // but 0, so `--w: 12` makes `border-width: var(--w)` invalid at computed-value time, and Chromium
  // draws its three sides at the initial `medium`, 3px, which the build does not read from the
  // substitution. The stroke stays out rather than drawing 12px.
  it("leaves out the stroke a var() border-width of a unitless number sets", async () => {
    const written = (property: string, value: string) => ({ className: "var-width", property, value });
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[64px] h-[36px] [border-style:solid] border-[#ff0000]",
        written: [
          written("--w", "12"),
          written("border-width", "var(--w)"),
          written("border-left-width", "0"),
        ],
      })
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "var-width").find(([property]) => property === "border-width")?.[1]).toBe(
      "unmapped"
    );
  });

  // Oracle: CSS Backgrounds 3 §4.4 and CSS Variables 1 §3. `12 solid blue` is no `border` value, so
  // `border-left: var(--line)` is invalid at computed-value time and gives the left side its initial
  // `medium none` border, and the later `border-color` colors every side red: Chromium draws the 2px
  // solid red border on the other three sides only. The build leaves the shorthand unmapped rather
  // than drawing a 12px left side.
  it("leaves unmapped a var() border-left whose width is a unitless number", async () => {
    const written = (property: string, value: string) => ({ className: "var-line", property, value });
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[64px] h-[36px] [border:2px_solid]",
        written: [
          written("--line", "12 solid blue"),
          written("border-left", "var(--line)"),
          written("border-color", "#ff0000"),
        ],
      })
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "var-line").find(([property]) => property === "border-left")?.[1]).toBe(
      "unmapped"
    );
  });

  // Oracle: CSS Variables 1 §3 and CSS Cascade 5 §6. `--w: 1px` makes `border-width: var(--w)` 1px
  // on the three sides it keeps, and the later `border-left-width: 0` wins the left, so Chromium
  // draws a 1px solid red border on the top, right and bottom and none on the left.
  it("draws the sides a var() border-width keeps beside a later zero side", async () => {
    const written = (property: string, value: string) => ({ className: "var-width", property, value });
    const { variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[64px] h-[36px] [border-style:solid] border-[#ff0000]",
        written: [
          written("--w", "1px"),
          written("border-width", "var(--w)"),
          written("border-left-width", "0"),
        ],
      })
    );
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 1, right: 1, bottom: 1, left: 0 } });
  });

  // Oracle: CSS Backgrounds 3 §3.5 and CSS Cascade 5 §6. `border: 0 solid`, as Tailwind preflight
  // writes it, gives every side a zero width and a solid style, and the later `border-left-width`
  // wins only the left width, so Chromium draws a 2px solid red left edge.
  it("draws a side whose style a border shorthand sets", async () => {
    const { variant } = await buildChip("[border:0_solid] [border-left-width:2px] border-[#ff0000]");
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 0, bottom: 0, left: 2 } });
  });

  // Oracle: CSS Backgrounds 3 §3.5. `border: 2px solid` sets every side's width and style, and
  // `border-left: 2px solid` the left side's alone, so Chromium draws a 2px solid red border on
  // every side, or on the left one only.
  it.each([
    ["[border:2px_solid]", { weight: literal(2) }],
    ["[border-left:2px_solid]", { sides: { top: 0, right: 0, bottom: 0, left: 2 } }],
  ])("draws the border %s sets", async (shorthand, drawn) => {
    const { variant } = await buildChip(`${shorthand} border-[#ff0000]`);
    expect(variant?.root.stroke).toEqual({ color: RED, ...drawn });
  });

  // Oracle: CSS Backgrounds 3 §3.7. The opaque solid border that `border: 2px solid` draws hides the
  // fill beneath it, so `padding-box` paints as Figma's fill under an inside stroke does.
  it("drops background-clip: padding-box under an opaque border shorthand", async () => {
    const { coverage } = await buildChip("[border:2px_solid] border-[#ff0000] bg-clip-padding bg-[#ffffff]");
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      [
        "background-clip",
        "dropped",
        "the box's border draws as a solid stroke, opaque in every mode, over the fill beneath it",
      ],
    ]);
  });

  // Oracle: CSS Backgrounds 3 §4.3. A side whose style is `none` or `hidden` has a used width of 0,
  // whatever width it declares, so Chromium draws the 2px solid red border on the other three sides.
  it.each([
    ["thick", "none"],
    ["thin", "hidden"],
  ])("draws the other sides where a %s left side's style is %s", async (width, lineStyle) => {
    const { variant } = await buildChip(
      `[border-width:2px] [border-style:solid] border-[#ff0000] [border-left-width:${width}] [border-left-style:${lineStyle}]`
    );
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 2, right: 2, bottom: 2, left: 0 } });
  });

  it("leaves the stroke out where the sides that draw take two colors", async () => {
    const { variant, coverage } = await buildChip(
      "border-0 border-s border-e border-s-[#ff0000] border-e-[#0000ff]"
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(notesOf(coverage, "border-s-[#ff0000]")).toEqual([
      [
        "border-inline-start-color",
        "unmapped",
        "Figma strokes every side in one color, and the sides that draw take two",
      ],
    ]);
  });
});

describe("a four-sided border shorthand that wins some sides", () => {
  // Oracle: CSS Variables 1 §3 and CSS Backgrounds 3 §4. A lone `var()` is substituted before the
  // shorthand's values are counted, so `--v: solid dashed` gives the top and bottom sides `solid` and
  // the right side `dashed`. Each side the shorthand wins takes the whole `var()`, which stands for
  // two values, so it reads as no style there.
  it("leaves border-style: var(--v), with --v: solid dashed, unmapped on each side it wins", async () => {
    const written = (property: string, value: string) => ({ className: "lone-side", property, value });
    const { coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[64px] h-[36px] border border-[#000000]",
        written: [
          written("--v", "solid dashed"),
          written("border-style", "var(--v)"),
          written("border-left-style", "solid"),
        ],
      })
    );
    const won = notesOf(coverage, "lone-side").filter(([property]) =>
      ["top", "right", "bottom"].some((side) => property === `border-${side}-style`)
    );
    expect(won.map(([property, outcome]) => [property, outcome])).toEqual([
      ["border-bottom-style", "unmapped"],
      ["border-right-style", "unmapped"],
      ["border-top-style", "unmapped"],
    ]);
  });

  // Oracle: CSS Variables 1 §3 and CSS Backgrounds 3 §4.1. `--v: #ff0000 #0000ff` is substituted
  // before `border-color` counts its values, so the top and bottom sides draw red and the right side
  // blue, beside the left side's own black. Figma strokes every side in one color, so the box takes
  // no stroke. `border-color` stays whole, and the stroke reads it as no one color.
  it("leaves border-color: var(--v), with --v: #ff0000 #0000ff, unmapped with no stroke", async () => {
    const written = (property: string, value: string) => ({ className: "lone-color", property, value });
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[64px] h-[36px] border border-[#000000]",
        written: [
          written("--v", "#ff0000 #0000ff"),
          written("border-color", "var(--v)"),
          written("border-left-color", "#000000"),
        ],
      })
    );
    expect(variant?.root.stroke).toBeUndefined();
    expect(
      notesOf(coverage, "lone-color")
        .filter(([property]) => property === "border-color")
        .map(([, outcome]) => outcome)
    ).toEqual(["unmapped"]);
  });

  // Oracle: CSS Variables 1 §3 and CSS Backgrounds 3 §4.2 and §4.3. `--w: 2px` makes
  // `border-width: var(--w)` one 2px width on every side, and the pseudo-element names no border
  // style, so its border draws nothing and only its white fill paints, over the whole box.
  it("draws a pseudo-element whose lone var() border-width resolves to one length", async () => {
    const written = (property: string, value: string) => ({ className: "lone-width", property, value });
    const { variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "relative w-[64px] h-[36px]",
        measured: { pseudoBoxes: ["before"] },
        pseudo: {
          before: {
            classes: "absolute inset-0 bg-white",
            written: [
              { className: "before:content-['']", property: "content", value: '""' },
              written("--w", "2px"),
              written("border-width", "var(--w)"),
            ],
          },
        },
      })
    );
    expect(variant?.root.children.map((child) => child.key)).toEqual(["::before"]);
  });

  // Oracle: CSS Variables 1 §3 and CSS Backgrounds 3 §4.3. The `var()` is substituted before the
  // widths are counted, so `var(--pair) 4px` with `--pair: 2px 8px` is `2px 8px 4px`, whose right
  // width is 8px. Read as written, the second token, 4px, would take the right side.
  it("leaves a pseudo-element's border-width whose var() stands for several values unmapped", async () => {
    const written = (property: string, value: string) => ({ className: "pair-width", property, value });
    const { coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "relative w-[64px] h-[36px]",
        measured: { pseudoBoxes: ["before"] },
        pseudo: {
          before: {
            classes: "absolute inset-0 border-solid border-[#000000]",
            written: [
              { className: "before:content-['']", property: "content", value: '""' },
              written("--pair", "2px 8px"),
              written("border-width", "var(--pair) 4px"),
              written("border-left-width", "0"),
            ],
          },
        },
      })
    );
    expect(notesOf(coverage, "pair-width").filter(([property]) => property === "border-right-width")).toEqual(
      []
    );
    expect(
      notesOf(coverage, "pair-width")
        .filter(([property]) => property === "border-width")
        .map(([, outcome]) => outcome)
    ).toEqual(["unmapped"]);
  });
});
