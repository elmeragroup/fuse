/**
 * How the build paints a box: `currentcolor` a custom property passes down, a part under
 * `visibility: hidden`, a border on some sides or whose style is none, and a background clip. The
 * unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
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
  HUG,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";

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

  // Oracle: CSS Writing Modes 3 §3.1 and CSS Logical Properties 1 §4. Under `vertical-rl` the
  // inline axis runs down, so `border-s-[3px]` widens the top side: the box draws 14px wide and 16px
  // tall around the 8px part. The left-to-right page the capture reads it on gives the left side the
  // 3px, which would hold it 16px wide and 14px tall. The box turns by its own `writing-mode`, or in
  // a mode the capture measured (`otherFlow`), as a dark-only rule's `writing-mode` turns it.
  it.each([
    { turns: "by its own writing-mode", classes: "[writing-mode:vertical-rl]", facts: {} },
    {
      turns: "in a mode the capture measured",
      classes: "",
      facts: { measured: { otherFlow: ["sides", "widths"] } } as const,
    },
  ])(
    "leaves a box that hugs it at a hug where its logical border sides lie elsewhere, $turns",
    async ({ classes, facts }) => {
      const { variant, coverage } = await buildCaptured(
        chip({ parts: [part()] }),
        rest({
          slot: "chip",
          classes: `flex p-[2px] ${classes} border border-s-[3px] border-[#000000]`,
          children: [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
          ...facts,
        })
      );
      expect([
        variant?.root.sizing,
        variant?.root.stroke,
        notesOf(coverage, "invisible").map(([, outcome]) => outcome),
      ]).toEqual([{ horizontal: HUG, vertical: HUG }, undefined, ["unmapped"]]);
    }
  );

  // Oracle: Chromium 153 on a right-to-left 12px box around a hidden 8px part, where a dark rule sets
  // only `border-inline-start-color`: every side computes 0px in every mode, so the box keeps its
  // 12px. A logical color moves no width, so the capture's `otherFlow` names the sides alone.
  it("holds a box at its size where only a logical border color lies elsewhere", async () => {
    const { variant, coverage } = await buildCaptured(
      chip({ parts: [part()] }),
      rest({
        slot: "chip",
        classes: "flex p-[2px]",
        children: [{ slot: "chip-dot", classes: "size-[8px] invisible" }],
        measured: { otherFlow: ["sides"] },
      })
    );
    expect([
      variant?.root.sizing,
      frameOf(variant?.root)?.hidden,
      notesOf(coverage, "invisible").map(([, outcome]) => outcome),
    ]).toEqual([fixedSize(literal(12), literal(12)), true, ["literal"]]);
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

// Oracle: CSS Logical Properties 1 §4, CSS Cascade 5 §6 and CSS Backgrounds 3 §3.3. In a
// left-to-right horizontal page `border-inline-start-color` and `border-inline-color` set the left
// side's color, and the declaration applied last wins it, so `border-s-*` or `border-x-*` after a
// `border-*` color paints the left side, as a chip segment's `border-transparent border-0 border-s
// border-s-border` draws a hairline. A side at a zero width draws nothing whatever its style.
describe("a stroke on some sides", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;
  /** The border declarations a coverage notes as drawn, which a stroke left out must not hold. */
  const drawnBorderRows = (coverage: readonly CoverageRow[]) =>
    coverage.filter(
      (row) => row.property.startsWith("border") && (row.outcome === "literal" || row.outcome === "bound")
    );

  it("takes the color its drawing side sets of its own", async () => {
    const { variant, coverage } = await buildChip(
      "border border-transparent border-0 border-s border-s-[#ff0000]"
    );
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 0, bottom: 0, left: 1 } });
    expect(notesOf(coverage, "border-transparent")).toEqual([
      ["border-color", "dropped", "it colors only sides the border gives no width, which draw nothing"],
    ]);
  });

  // CSS Backgrounds 3 §3.3: a side at a zero width draws nothing, and a group member's `border-l-0`
  // or `border-t-0` wins that side of Button's `border`, which the other sides keep. On the kit's
  // left-to-right page `border-x-0` zeroes the left and the right (CSS Logical Properties 1 §4.4).
  it.each([
    ["border-l-0", { top: 1, right: 1, bottom: 1, left: 0 }, "border-left-width", "the left side"],
    ["border-t-0", { top: 0, right: 1, bottom: 1, left: 1 }, "border-top-width", "the top side"],
    [
      "border-x-0",
      { top: 1, right: 0, bottom: 1, left: 0 },
      "border-inline-width",
      "the right and left sides",
    ],
  ])("keeps a literal border's weight on the sides %s leaves drawing", async (bare, sides, width, named) => {
    const { variant, coverage } = await buildChip(`border border-[#ff0000] ${bare}`);
    expect([
      variant?.root.stroke,
      coverage.filter((row) => row.outcome === "unmapped"),
      notesOf(coverage, bare).filter(([property]) => property === width),
    ]).toEqual([{ color: RED, sides }, [], [[width, "literal", `no stroke on ${named}`]]]);
  });

  // A vertical group's member leaves its top side bare, the side the stroke reads first.
  it.each([
    ["border-l-0", ["left"], "left"],
    ["border-t-0", ["top"], "top"],
  ])("keeps a bound weight on the sides %s leaves drawing", async (zero, bare, side) => {
    const weight = { collection: "Fuse tokens", name: "border-w" } as const;
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: `border border-(length:--border-w) border-[#ff0000] ${zero}` }),
      {
        variables: makeVariableIndex([{ ref: weight, webSyntax: "var(--border-w)", minimum: 1, maximum: 2 }]),
      }
    );
    expect([
      variant?.root.stroke,
      coverage.filter((row) => row.outcome === "unmapped"),
      notesOf(coverage, zero),
    ]).toEqual([
      { color: RED, weight: { kind: "variable", variable: weight }, bare },
      [],
      [
        [`border-${side}-style`, "dropped", "it sets only sides the border leaves bare, which draw nothing"],
        [
          `border-${side}-width`,
          "literal",
          `no stroke on the ${side} side, where the other sides keep the border's weight`,
        ],
      ],
    ]);
  });

  // Oracle: the Figma paint type, which holds one RGBA color or a variable per stroke, and Chromium
  // 153, which paints a black border with a red right side, or a right side in the system color
  // `CanvasText`. Bare left side or not, the sides that draw take two colors, or one the kit cannot
  // read, so the stroke stays out with the colors' own reasons, and the left side's 0 notes why its
  // side was bare.
  it.each([
    [
      "border-r-[#ff0000]",
      "border-right-color",
      ["unmapped", "Figma strokes every side in one color, and the sides that draw take two"],
      ["unmapped", "Figma strokes every side in one color, and the sides that draw take two"],
    ],
    [
      "[border-right-color:CanvasText]",
      "border-right-color",
      ["unmapped", "no Figma field reads CanvasText"],
      ["unmapped", "another side's width, style or color does not map, so the stroke is left out"],
    ],
  ])(
    "leaves a bound weight's bare stroke out where %s colors a drawing side apart",
    async (color, property, own, shared) => {
      const weight = { collection: "Fuse tokens", name: "border-w" } as const;
      const { variant, coverage } = await buildCaptured(
        chip(),
        rest({
          slot: "chip",
          classes: `border border-(length:--border-w) border-[#000000] border-l-0 ${color}`,
        }),
        {
          variables: makeVariableIndex([
            { ref: weight, webSyntax: "var(--border-w)", minimum: 1, maximum: 2 },
          ]),
        }
      );
      expect([
        variant?.root.stroke,
        notesOf(coverage, color),
        notesOf(coverage, "border-[#000000]"),
        notesOf(coverage, "border-l-0").filter(([each]) => each === "border-left-width"),
      ]).toEqual([
        undefined,
        [[property, ...own]],
        [["border-color", ...shared]],
        [
          [
            "border-left-width",
            "unmapped",
            "its width of 0 leaves the left side bare, but the stroke is left out",
          ],
        ],
      ]);
    }
  );

  // Oracle: the Figma plugin typings. A Figma paint holds an RGBA color or a variable, and no system
  // color, so `CanvasText` reaches no stroke, and the stroke stays out with nothing noted as drawn.
  // At `--border-w: 2px` Chromium 153 computes the border 2px on the top, right and bottom and 0px on
  // the left, so the zero width is still why the left side was bare.
  it("leaves a bound weight's stroke out, noting no side as drawn, where its color does not map", async () => {
    const width = { collection: "Fuse tokens", name: "border-w" } as const;
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "border border-(length:--border-w) border-l-0 [border-color:CanvasText]",
      }),
      { variables: makeVariableIndex([{ ref: width, webSyntax: "var(--border-w)", minimum: 1, maximum: 2 }]) }
    );
    const left = "another side's width, style or color does not map, so the stroke is left out";
    expect([
      variant?.root.stroke,
      drawnBorderRows(coverage),
      notesOf(coverage, "border-l-0"),
      notesOf(coverage, "[border-color:CanvasText]"),
      notesOf(coverage, "border-(length:--border-w)"),
    ]).toEqual([
      undefined,
      [],
      [
        ["border-left-style", "dropped", "it sets only sides the border leaves bare, which draw nothing"],
        [
          "border-left-width",
          "unmapped",
          "its width of 0 leaves the left side bare, but the stroke is left out",
        ],
      ],
      [["border-color", "unmapped", "no Figma field reads CanvasText"]],
      ["border-bottom-style", "border-right-style", "border-top-style", "border-width"].map((property) => [
        property,
        "unmapped",
        left,
      ]),
    ]);
  });

  // Oracle: Chromium 153's computed `border-*-width` for a 1px solid border with
  // `border-left-width: 0` and a later `border-inline-style`: `none` computes the right side to 0px
  // too (CSS Backgrounds 3 §3.3), and `dashed` keeps it at 1px, dashed, which one Figma stroke style
  // cannot draw beside solid sides, so the stroke stays out.
  it.each([
    [
      "none",
      { color: RED, sides: { top: 1, right: 0, bottom: 1, left: 0 } },
      ["border-inline-style", "dropped", "a none style draws no border on its side"],
    ],
    ["dashed", undefined, ["border-inline-style", "unmapped", "no Figma field reads dashed"]],
  ])("reads a side style that wins a bare side and a drawing one, at %s", async (style, stroke, note) => {
    const classes = `[border-inline-style:${style}]`;
    const { variant, coverage } = await buildChip(`border border-[#ff0000] border-l-0 ${classes}`);
    expect([
      variant?.root.stroke,
      notesOf(coverage, classes),
      stroke === undefined ? drawnBorderRows(coverage) : [],
    ]).toEqual([stroke, [note], []]);
  });

  // Oracle: Chromium 153's computed left border of a 1px red border on black text under
  // `[border-left:solid]!`: 3px, black and solid, since the shorthand resets the side's width to
  // `medium` and its color to `currentcolor` (CSS Backgrounds 3 §3.4). Figma strokes every side in
  // one color, so the stroke stays out.
  it("leaves a border shorthand unmapped where it wins a drawing side's style", async () => {
    const classes = "[border-left:solid]!";
    const { variant, coverage } = await buildChip(`border border-[#ff0000] text-[#000000] ${classes}`);
    expect([variant?.root.stroke, notesOf(coverage, classes), drawnBorderRows(coverage)]).toEqual([
      undefined,
      [["border-left", "unmapped", "no Figma field reads solid"]],
      [],
    ]);
  });

  // Oracle: Chromium 153's computed borders of a 1px solid red border on black text, the
  // declarations applied in the classes' order. `border-inline: none` resets both inline sides to 3px
  // of `currentcolor`, styled none (CSS Backgrounds 3 §3.4), so a later `border-left-style: solid`
  // draws the left side 3px and black, the right 0px. Under `border-inline: 0` and a later
  // `border-left-width: 2px`, the left side draws 2px and black. Figma strokes every side in one
  // color, so neither stroke maps: the first shorthand's `medium` width reads as no weight, and the
  // second shorthand colors the left side. A shorthand's `hidden` computes its side to 0px (CSS
  // Backgrounds 3 §3.3), as `border-left: 2px hidden blue` does, so the other sides draw and the
  // shorthand draws nothing.
  const LEFT_OUT = "another side's width, style or color does not map, so the stroke is left out";
  it.each([
    {
      classes: "[border-inline:none] [border-left-style:solid]",
      stroke: undefined,
      notes: [
        ["border-inline", "unmapped", "no Figma field reads none"],
        ["border-left-style", "unmapped", LEFT_OUT],
      ],
    },
    {
      classes: "[border-inline:0] [border-left-width:2px] [border-left-style:solid]",
      stroke: undefined,
      notes: [
        [
          "border-inline",
          "unmapped",
          "a border shorthand colors a side that draws, and the build does not read it",
        ],
        ["border-left-width", "unmapped", LEFT_OUT],
        ["border-left-style", "unmapped", LEFT_OUT],
      ],
    },
    {
      classes: "[border-left:2px_hidden_blue]",
      stroke: { color: RED, sides: { top: 1, right: 1, bottom: 1, left: 0 } },
      notes: [["border-left", "dropped", "its side's style draws no border, whatever its width"]],
    },
  ])(
    "reads a border shorthand that sets a side apart by its own reason, under $classes",
    async ({ classes, stroke, notes }) => {
      const { variant, coverage } = await buildChip(`border border-[#ff0000] text-[#000000] ${classes}`);
      expect([
        variant?.root.stroke,
        classes.split(" ").flatMap((each) => notesOf(coverage, each)),
        stroke === undefined ? drawnBorderRows(coverage) : [],
        stroke === undefined ? notesOf(coverage, "border-[#ff0000]") : [],
      ]).toEqual([stroke, notes, [], stroke === undefined ? [["border-color", "unmapped", LEFT_OUT]] : []]);
    }
  );

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
    // Nothing draws, so no side is left out for want of another.
    expect(coverage.filter((row) => row.property.startsWith("border") && row.outcome === "unmapped")).toEqual(
      []
    );
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

// Oracle: CSS Backgrounds 3 §3.3. A border whose style is `none` computes each side's width to 0, so
// it draws nothing, whatever width or color the box also sets, as a framed Table's header row's
// `border-none` sets over the `border-b` its header gives it.
describe("a border whose style is none", () => {
  it("draws no stroke and drops its width and color", async () => {
    const { variant, coverage } = await buildChip("size-[20px] border-b border-none border-[#000000]");
    expect(variant?.root.stroke).toBeUndefined();
    const rows = coverage.filter((row) => row.property.startsWith("border-"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.outcome !== "dropped")).toEqual([]);
  });
});

// Oracle: CSS Backgrounds 3 §3.7. `background-clip` clips the background, so a box that paints none,
// as a hovered framed Table cell's `bg-transparent` leaves it, has nothing for the clip to draw.
// Oracle: CSS Logical Properties 1 §4 and Chromium 153's computed style of an absolute `::before`
// with `border-inline: 2px solid`: 2px on its left and right in horizontal lines, and on its top and
// bottom under its box's `writing-mode: vertical-rl`. The capture measures no flow for a
// pseudo-element, which a `dir` it cannot see may turn too, so the build cannot tell which physical
// sides the shorthand sets, and draws no layer for it.
describe("a pseudo-element's border named by flow-relative sides", () => {
  it.each(["", "[writing-mode:vertical-rl]"])("draws no layer for it in a box of %j", async (flow) => {
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: `relative size-[36px] ${flow}`,
        pseudo: {
          before: {
            classes: "absolute top-0 left-0 size-[16px] [border-inline:2px_solid_#ff0000]",
            written: [{ className: "before:content-['']", property: "content", value: '""' }],
          },
        },
        measured: { pseudoBoxes: ["before"] },
      })
    );
    expect([
      variant?.root.children.map((layer) => layer.key),
      notesOf(coverage, "[border-inline:2px_solid_#ff0000]"),
    ]).toEqual([
      [],
      [
        [
          "border-inline",
          "unmapped",
          "the kit draws no layer for the `::before` pseudo-element, and the build does not tell whether its border-inline paints",
        ],
      ],
    ]);
  });
});

describe("background-clip: padding-box on a box with no background", () => {
  it("is dropped beside a translucent border", async () => {
    const { coverage, variant } = await buildChip("size-[20px] bg-clip-padding border border-[#00000080]");
    expect(notesOf(coverage, "bg-clip-padding")).toEqual([
      ["background-clip", "dropped", "the box paints no background, so the clip has nothing to clip"],
    ]);
    expect(variant?.root.children).toEqual([]);
  });
});

// Oracle: CSS Backgrounds 3 §3.7. The clip drops only where the box paints no background. A system
// color, a gradient or a `background` shorthand paints one the kit does not read (Chromium paints
// `background: red` inside a translucent border), so the clip keeps the background inside the border
// in CSS, which nothing in Figma draws.
describe("background-clip: padding-box beside a background the kit does not read", () => {
  it.each(["bg-[CanvasText]", "bg-[linear-gradient(#ffffff,#000000)]", "[background:#ff0000]"])(
    "stays unmapped beside %s",
    async (background) => {
      const { coverage } = await buildChip(
        `size-[20px] bg-clip-padding ${background} border border-[#00000080]`
      );
      expect(notesOf(coverage, "bg-clip-padding").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
    }
  );
});
