/**
 * How the build rounds a box's corners one by one: a radius per corner on a box of literal sides,
 * and one corner on a box that hugs its text. The unit under test is `buildSetsInOrder` on
 * hand-built captures of one-cell `chip` sets (`test/capture-fixtures.ts`). Each case names its
 * oracle: the CSS specification that says what the browser draws, or the Figma plugin typings that
 * say what Figma draws, under the coverage contract, where a declaration that does not reach Figma
 * is `unmapped` and one with nothing to draw is `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, buildChip, chip, literal, notesOf, part, rest } from "../../test/capture-fixtures";
import { makeVariableIndex } from "./css-values";

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
    ["size-[36px] rounded-[8px] rounded-tl-[calc(1px-4px)]", corners(0, 8, 8, 8)],
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

  // Oracle: CSS Values 4 §10.12. A radius is a non-negative length, so Chromium computes a whole
  // `calc(1px - 4px)` radius as 0px.
  it("draws a whole radius whose calc() computes below 0 as 0", async () => {
    const { variant, coverage } = await buildChip("size-[36px] rounded-[calc(1px-4px)]");
    expect([variant?.root.cornerRadius, notesOf(coverage, "rounded-[calc(1px-4px)]")]).toEqual([
      literal(0),
      [["border-radius", "literal", "0px"]],
    ]);
  });

  // Oracle: CSS Cascade 5 §6 and CSS Backgrounds 3 §5.1. A parent's later `rounded-r-none`, put on
  // the Button by the parent's rule, wins the right corners, and the Button's `rounded-*` keeps the
  // left ones. Fuse's ButtonGroup sets all four corners by longhands, so this is the case of a parent
  // that sets only some. The capture measured the Button wider than twice its radius (`cornersFit`), and its 36px
  // height holds two 16px radii, so CSS scales neither.
  it("squares the corners a parent's rule takes from a Button's own radius", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 16,
      },
    ]);
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "flex h-[36px] rounded-(--radius)",
        fromParent: "rounded-r-none",
        measured: { cornersFit: true },
      }),
      { variables }
    );
    const radius = { kind: "variable", variable: { collection: "Fuse tokens", name: "radius" } };
    expect(variant?.root.cornerRadius).toEqual({
      kind: "corners",
      topLeft: radius,
      topRight: literal(0),
      bottomRight: literal(0),
      bottomLeft: radius,
    });
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  // Oracle: CSS Backgrounds 3 §5.5. A whole `border-radius: var(--r)` beside `rounded-b-none` rounds
  // the top corners by `--r`. Two 16px radii fit a 36px top side, so CSS draws them as written at any
  // width. Two 20px radii overrun it, so CSS scales them to 18px at 36px wide and draws 20px at 48px,
  // which no one Figma length follows.
  it.each([
    {
      radius: "16px",
      cornerRadius: corners(16, 16, 0, 0),
      outcome: "literal",
    },
    {
      radius: "20px",
      cornerRadius: literal(0),
      outcome: "unmapped",
      detail:
        "CSS scales the radius `border-radius` gives the topLeft and topRight corners, with the others, to fit the box's sides, by a factor its size sets, which no Figma corner follows, so none of the box's corners maps",
    },
  ])(
    "maps a whole radius of $radius beside a corner longhand only where CSS scales no corner",
    async ({ radius, cornerRadius, outcome, detail }) => {
      const { variant, coverage } = await buildChip(
        `size-[36px] [--r:${radius}] rounded-(--r) rounded-b-none`
      );
      const notes = [...notesOf(coverage, "rounded-(--r)"), ...notesOf(coverage, "rounded-b-none")];
      expect([
        variant?.root.cornerRadius,
        notes.map(([property, each]) => [property, each]),
        detail === undefined ? [] : [...new Set(notes.map(([, , note]) => note))],
      ]).toEqual([
        cornerRadius,
        [
          ["border-radius", outcome],
          ["border-bottom-left-radius", outcome],
          ["border-bottom-right-radius", outcome],
        ],
        detail === undefined ? [] : [detail],
      ]);
    }
  );

  // Oracle: CSS Backgrounds 3 §5.5. An infinite radius scales every radius by one factor, which a
  // variable beside it follows in no binding, so the variable is why neither corner maps.
  it("names the variable beside an infinite radius as why no corner maps", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse tokens", name: "radius" },
        webSyntax: "var(--radius)",
        minimum: 4,
        maximum: 8,
      },
    ]);
    const { variant, coverage } = await buildChip(
      "size-[36px] rounded-tl-full rounded-tr-(--radius)",
      [],
      {},
      { variables }
    );
    expect([
      variant?.root.cornerRadius,
      notesOf(coverage, "rounded-tl-full"),
      notesOf(coverage, "rounded-tr-(--radius)"),
    ]).toEqual([
      literal(0),
      [
        [
          "border-top-left-radius",
          "unmapped",
          "CSS scales the variable on the topRight corner beside this infinite radius by a factor no binding follows, so none of the box's corners maps",
        ],
      ],
      [
        [
          "border-top-right-radius",
          "unmapped",
          "CSS scales this variable beside the infinite radius on the topLeft corner by a factor no binding follows, so none of the box's corners maps",
        ],
      ],
    ]);
  });

  // Oracle: Chromium computed `border-top-right-radius` 8px under `direction: rtl` for
  // `border-start-start-radius: 8px` (CSS Logical Properties 1 §6.2), the corner a left-to-right page
  // gives the top left. The capture splits `rounded-[4px]` into the right corners it wins there.
  it("leaves a right-to-left box's corners unmapped where it sets a logical corner", async () => {
    const { variant, coverage } = await buildChip(
      "size-[36px] [direction:rtl] rounded-[4px] rounded-s-[8px]"
    );
    const rtl =
      "the box lays out other than left to right in horizontal lines, which puts its logical corners elsewhere than the capture reads them";
    const other = "another of the box's corners does not map, so none of its corners does";
    expect([
      variant?.root.cornerRadius,
      notesOf(coverage, "rounded-s-[8px]"),
      notesOf(coverage, "rounded-[4px]"),
    ]).toEqual([
      literal(0),
      [
        ["border-end-start-radius", "unmapped", rtl],
        ["border-start-start-radius", "unmapped", rtl],
      ],
      [
        ["border-bottom-right-radius", "unmapped", other],
        ["border-top-right-radius", "unmapped", other],
      ],
    ]);
  });

  // Oracle: CSS Logical Properties 1 §6.2 and Chromium 153's computed style of a `::before` below an
  // ancestor's `dir="rtl"`: `border-start-start-radius: 6px` rounds its top right. The capture measures
  // no flow for a pseudo-element, so a logical corner on the layer it draws may lie on any corner, and
  // its own direction reads left to right where the `dir` sits outside its cascade.
  it("leaves a drawn pseudo-element's logical corner unmapped, whose flow the capture does not measure", async () => {
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "relative size-[36px]",
        pseudo: {
          before: {
            classes: "absolute top-0 left-0 size-[16px] bg-[#ff0000] rounded-ss-[6px]",
            written: [{ className: "before:content-['']", property: "content", value: '""' }],
          },
        },
        measured: { pseudoBoxes: ["before"] },
      })
    );
    const before = variant?.root.children.find((layer) => layer.key === "::before");
    expect([
      before?.kind === "frame" ? before.cornerRadius : "no layer",
      notesOf(coverage, "rounded-ss-[6px]"),
    ]).toEqual([
      literal(0),
      [
        [
          "border-start-start-radius",
          "unmapped",
          "the capture does not measure where the box lays out, as on a pseudo-element, so the build cannot tell where its logical corners lie",
        ],
      ],
    ]);
  });

  it("names an infinite radius on a box that fixes no side as why it stays unmapped", async () => {
    const { variant, coverage } = await buildChip("rounded-s-full");
    expect([variant?.root.cornerRadius, notesOf(coverage, "rounded-s-full")]).toEqual([
      literal(0),
      ["border-end-start-radius", "border-start-start-radius"].map((property) => [
        property,
        "unmapped",
        "an infinite radius takes its length from the box's sides, which hold no literal length",
      ]),
    ]);
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

// Oracle: CSS Backgrounds 3 §5.5 and probe P10, as above, on a box that hugs its text across. One
// corner alone scales only past a whole side, so CSS draws it as written on any box at least that
// wide and tall; Figma caps it at half the shorter side. Chromium's `cornersFit` says the box, with
// its sample text, is wider than twice the radius in every mode, so the 12px corner maps. Without it
// the box counts only its 20px of padding, under the 24px a 12px corner needs, so it stays unmapped.
describe("a radius per corner on a box that hugs its text", () => {
  const label = {
    key: "label",
    name: "label",
    characters: "#1042",
    textProperty: "Text",
    shownIn: () => true,
  } as const;
  const variables = makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]);

  it.each([
    [
      "the capture measured it holding the corner",
      {
        kind: "corners",
        topLeft: literal(12),
        topRight: literal(0),
        bottomRight: literal(0),
        bottomLeft: literal(0),
      },
      true,
    ],
    ["the capture measured nothing", literal(0), false],
  ])("where %s rounds its top left corner as %j", async (_case, expected, cornersFit) => {
    const root = {
      slot: "chip",
      text: "#1042",
      classes:
        "flex h-[32px] px-[10px] font-sans text-[14px] leading-[14px] text-[#000000] whitespace-nowrap rounded-tl-[12px]",
    };
    const { variant } = await buildCaptured(
      chip({ label }),
      rest(cornersFit ? { ...root, measured: { cornersFit } } : root),
      { variables }
    );
    expect(variant?.root.cornerRadius).toEqual(expected);
  });
});

// Oracle: CSS Box Sizing 3 §5.2 and probe P10. A `min-width: 30px` holds the box 30px wide whatever
// its text, which leaves a 12px corner within half of it. Without it the box counts only its 20px of
// padding, under the 24px a 12px corner needs. A `max-width` that narrows the box is the capture's
// to measure (`corners-fit.chromium.test.ts`).
describe("a radius per corner on a hugging box held to a minimum width", () => {
  const variables = makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]);

  it("rounds its top left corner under min-w-[30px]", async () => {
    const { variant } = await buildCaptured(
      chip({
        label: {
          key: "label",
          name: "label",
          characters: "Order",
          textProperty: "Text",
          shownIn: () => true,
        },
      }),
      rest({
        slot: "chip",
        text: "Order",
        classes:
          "flex h-[32px] px-[10px] min-w-[30px] font-sans text-[14px] leading-[14px] text-[#000000] whitespace-nowrap rounded-tl-[12px]",
      }),
      { variables }
    );
    expect(variant?.root.cornerRadius).toEqual({
      kind: "corners",
      topLeft: literal(12),
      topRight: literal(0),
      bottomRight: literal(0),
      bottomLeft: literal(0),
    });
  });
});
