/**
 * How the build draws a flex row's `display: inline` items and an italic label, as DateInput's
 * segments and its placeholder segments have them.
 * The unit under test is `buildComponentSet` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle, the CSS specification that says what the
 * browser draws, under the coverage contract, where a declaration that does not reach Figma is
 * `unmapped`.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, frameOf, notesOf, part, rest, textOf } from "../../test/capture-fixtures";
import type { FixtureElement, FixtureOptions } from "../../test/capture-fixtures";
import type { LabelManifest, PartManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

/** The text classes a label needs, which the chip's root carries and its parts inherit. */
const TEXT_STYLE = "text-[14px] leading-[20px] text-[#000000]";

/** A build whose `font-sans` and `font-heading` bind the synced families, as the kit's labels do. */
const FONT_SANS: FixtureOptions = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
    { ref: { collection: "Fuse tokens", name: "font-heading" }, webSyntax: "var(--font-heading)" },
  ]),
};

/** A segment's text, `10`. */
const SEGMENT: LabelManifest = {
  key: "text",
  name: "text",
  characters: "10",
  textProperty: undefined,
  shownIn: () => true,
};

/** Build a chip whose root wins `root` and the text style around one part, the `chip-dot`. */
function buildRow(root: string, dot: FixtureElement, manifest: PartManifest = part({ label: SEGMENT })) {
  return buildCaptured(
    chip({ parts: [manifest] }),
    rest({
      slot: "chip",
      classes: `font-sans ${TEXT_STYLE} ${root}`,
      children: [{ slot: "chip-dot", ...dot }],
    }),
    FONT_SANS
  );
}

// Oracle: CSS Display 3 §2.7. A flex container blockifies its in-flow children, so an `inline` item
// that holds only its text is a block box that sets it, which the capture's `inlineRow` measured on
// the row's one line in source order. Without that measurement, or around anything but its own text,
// the item's display stays unmapped.
describe("a flex row's inline item", () => {
  it("draws as a frame that hugs its text where the capture measured the row on one line", async () => {
    const { variant, coverage } = await buildRow("flex", {
      classes: "inline p-[2px]",
      text: "10",
      measured: { inlineRow: true },
    });
    expect(frameOf(variant?.root)?.sizing).toEqual({
      horizontal: { kind: "hug" },
      vertical: { kind: "hug" },
    });
    expect(notesOf(coverage, "inline").map(([property, outcome]) => [property, outcome])).toEqual([
      ["display", "literal"],
    ]);
  });

  it("stays unmapped without the measurement", async () => {
    const { coverage } = await buildRow("flex", { classes: "inline p-[2px]", text: "10" });
    expect(notesOf(coverage, "inline").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });

  it("stays unmapped around a part beside its text", async () => {
    const inner = part({ key: "mark", slot: "chip-mark" });
    const { coverage } = await buildRow(
      "flex",
      {
        classes: "inline p-[2px]",
        text: "10",
        textIndex: 1,
        measured: { inlineRow: true },
        children: [{ slot: "chip-mark", classes: "size-[4px]" }],
      },
      part({ label: SEGMENT, parts: [inner] })
    );
    expect(notesOf(coverage, "inline").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Fonts 4 §5.2 and the kit's fonts. `font-style: italic` picks the family's italic face,
// which Roboto, the family `font-sans` binds in every theme, ships for every weight. Figma names it
// `Italic` for the regular weight and `Medium Italic` beside `Medium`. Another family may have no
// italic face, where the browser slants the upright one, as `font-heading`, Neo Sans in Fjordkraft's
// branded themes, so its italic stays unmapped.
describe("an italic label", () => {
  /** The font style the chip's own label draws in, and the outcome of its italic. */
  async function italic(classes: string) {
    const { variant, coverage } = await buildCaptured(
      chip({ label: SEGMENT }),
      rest({ slot: "chip", classes: `${TEXT_STYLE} ${classes}`, text: "10" }),
      FONT_SANS
    );
    return {
      style: textOf(variant?.root)?.fontStyle,
      outcome: notesOf(coverage, "italic").map(([, each]) => each),
    };
  }

  it.each([
    ["font-sans italic", "Italic"],
    ["font-sans font-medium italic", "Medium Italic"],
  ])("draws %s in Roboto's %s face", async (classes, style) => {
    expect(await italic(classes)).toEqual({ style, outcome: ["literal"] });
  });

  it("stays unmapped in the heading family", async () => {
    expect(await italic("font-[family-name:var(--font-heading)] italic")).toEqual({
      style: "Regular",
      outcome: ["unmapped"],
    });
  });
});
