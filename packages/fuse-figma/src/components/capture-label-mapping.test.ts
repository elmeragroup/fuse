/**
 * How the build maps a box's own text, its label, as a capture records the browser's winners: the
 * label's sizing and wrapping, its ellipsis, the cap a `max-width` puts on it, its letter spacing and
 * alignment, a native control's own placement of its text, and the text style and color the root
 * inherits from the elements around it. The unit under test is `buildComponentSet` on hand-built
 * captures (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that says
 * how the browser sets the text, HTML's rendering of a form control, or a Figma probe that says how
 * Figma draws it.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  chip,
  FILL,
  frameOf,
  HUG,
  ICON,
  literal,
  notesOf,
  part,
  rest,
  textOf,
} from "../../test/capture-fixtures";
import type { FixtureElement, FixtureOptions, PartFields } from "../../test/capture-fixtures";
import type { LabelManifest, PartManifest, SetManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

/** A label that a `Label` text property sets, starting as `Label`. */
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  shownIn: () => true,
};

/** The text classes a label needs, which the chip's root carries and its parts inherit. */
const TEXT_STYLE = "font-sans text-[14px] leading-[20px] text-[#000000]";

/** A build whose `font-sans` binds the synced family, as every kit label's does. */
const FONT_SANS: FixtureOptions = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/**
 * What `white-space-collapse: collapse`, which `white-space: normal` and `nowrap` set, does to a label
 * whose characters hold no run of white space: nothing (CSS Text 4 §3.1).
 */
const COLLAPSES = "the characters hold no run of white space or line break to collapse";

const FILL_WIDTH = { horizontal: FILL, vertical: HUG };
const HUGGING = { horizontal: HUG, vertical: HUG };

/** A part below the chip's root, the `chip-dot`, holding the label unless the case gives another. */
function labelled(fields: PartFields = {}): PartManifest {
  return part({ label: LABEL, ...fields });
}

/** Why a narrow label span's clip stays unmapped in a row that does not clip. */
const NARROW_SPAN =
  "the label's element clips its text at its own edge, where a label with no room for its ellipsis hugs its text, and the row does not clip it at that edge";

/** Build a chip whose root wins the text style and `classes` and holds the label itself. */
function buildLabelled(classes: string, root: Partial<FixtureElement> = {}, label: LabelManifest = LABEL) {
  return buildCaptured(
    chip({ label }),
    rest({ slot: "chip", classes: `${TEXT_STYLE} ${classes}`, text: textOfLabel(label), ...root }),
    FONT_SANS
  );
}

/** Build a chip whose root wins the text style and `classes` and holds one part that holds the label. */
function buildWithPart(classes: string, part: FixtureElement, manifest: PartManifest = labelled()) {
  return buildCaptured(
    chip({ parts: [manifest] }),
    rest({
      slot: "chip",
      classes: `${TEXT_STYLE} ${classes}`,
      children: [{ slot: "chip-dot", text: "Label", ...part }],
    }),
    FONT_SANS
  );
}

/** The characters a label shows. */
function textOfLabel(label: LabelManifest): string {
  return "characters" in label ? label.characters : label.charactersFor({});
}

// Oracle: CSS Display and CSS Text 3. A block box sets its own text in lines across its width, and
// sets its first line box at the top of its content box (CSS 2.1 §9.4.1), so a box taller than its
// line, by its height or its minimum, keeps the text at the top.
describe("a block box that holds only its label", () => {
  it("sets it in lines across its width", async () => {
    const { variant, coverage } = await buildLabelled("block w-[100px]");
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
    expect(notesOf(coverage, "block")).toEqual([
      ["display", "literal", "a block box that sets its own text in lines"],
    ]);
  });

  it.each(["h-[100px]", "min-h-[100px]"])("with %s sets its line at the top", async (height) => {
    const { variant } = await buildLabelled(`block w-[100px] ${height}`);
    expect(variant?.root.counterAlign).toBe("MIN");
  });
});

// Oracle: CSS Text 3 and CSS Sizing 3. A label laid out in a definite content width, fixed or filling,
// breaks its lines there (`white-space: normal`), as a Figma text that fills the width and hugs its
// height does; a box that hugs its width is as wide as its text on one line. A column with an unset
// `align-items` stretches its text across a definite width (Flexbox 1 §9.4 step 11). `nowrap` keeps
// the text on one line at its own width. `text-wrap-mode` and `text-wrap-style` inherit (CSS Text 4
// §6.1), an element's own declaration beats an inherited one (CSS Cascade 4 §7.2), and of two
// declarations of one specificity the later wins (§6.4): Tailwind 4 puts `.text-balance` before
// `.whitespace-nowrap`, so on one element `nowrap` wins `text-wrap-mode`.
describe("a label's sizing", () => {
  it("fills a fixed width and wraps, hugging its height", async () => {
    const { variant } = await buildLabelled("flex w-[100px]");
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
  });

  it("fills a part that fills its parent", async () => {
    const { variant } = await buildWithPart("flex w-[100px]", { classes: "w-full" });
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
  });

  it("reads an explicit whitespace-normal as wrapping", async () => {
    const { variant, coverage } = await buildLabelled("w-[100px] whitespace-normal");
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
    expect(notesOf(coverage, "whitespace-normal")).toEqual([
      ["text-wrap-mode", "literal", "the label wraps at the box's width"],
      ["white-space-collapse", "dropped", COLLAPSES],
    ]);
  });

  it("hugs its one line with nowrap, whatever the box's width", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[100px] whitespace-nowrap");
    expect(textOf(variant?.root)?.sizing).toEqual(HUGGING);
    expect(notesOf(coverage, "whitespace-nowrap")).toEqual([
      ["text-wrap-mode", "literal", "the label hugs its width"],
      ["white-space-collapse", "dropped", COLLAPSES],
    ]);
  });

  it("reads the text-wrap a part's label inherits from the box around it", async () => {
    const { coverage } = await buildWithPart("flex items-start text-balance", {});
    expect(notesOf(coverage, "text-balance")).toEqual([
      ["text-wrap-mode", "literal", "the box hugs the label on one line"],
      ["text-wrap-style", "dropped", "the box hugs the label on one line"],
    ]);
  });

  it("lets nowrap win over text-balance on one element, as the later rule does", async () => {
    const { variant, coverage } = await buildLabelled("w-[100px] text-balance whitespace-nowrap");
    expect(textOf(variant?.root)?.sizing).toEqual(HUGGING);
    expect(notesOf(coverage, "text-balance")).toEqual([
      ["text-wrap-style", "dropped", "the label keeps to one line, so it breaks no lines to choose"],
    ]);
  });

  describe("beside a white-space declared on another element", () => {
    it("drops an inherited text-balance where the label's own nowrap keeps it on one line", async () => {
      const { coverage } = await buildWithPart("flex text-balance", { classes: "flex whitespace-nowrap" });
      expect(notesOf(coverage, "text-balance")).toEqual([
        ["text-wrap-mode", "dropped", "the cell shows no text"],
        ["text-wrap-style", "dropped", "the label keeps to one line, so it breaks no lines to choose"],
      ]);
    });

    it("lets a text-balance the label's box declares wrap the text an inherited nowrap keeps on one line", async () => {
      const { coverage } = await buildWithPart("flex whitespace-nowrap", { classes: "flex text-balance" });
      expect(notesOf(coverage, "text-balance")).toEqual([
        ["text-wrap-mode", "literal", "the box hugs the label on one line"],
        ["text-wrap-style", "dropped", "the box hugs the label on one line"],
      ]);
    });
  });

  it("stretches across a column with a definite width, and hugs in a column that hugs its width", async () => {
    const stretched = await buildLabelled("flex flex-col w-[100px]");
    expect(textOf(stretched.variant?.root)?.sizing).toEqual(FILL_WIDTH);
    const hugging = await buildLabelled("flex flex-col");
    expect(textOf(hugging.variant?.root)?.sizing).toEqual(HUGGING);
    expect(hugging.coverage.filter((row) => row.property === "align-items")).toEqual([]);
  });
});

// Oracle: CSS Sizing 3 §5.1, where `fit-content` is the smaller of the text's one-line width and the
// room the column leaves. A box that paints shows its own width, so it keeps hugging.
describe("a `w-fit` part that holds only its text in a column", () => {
  it("keeps hugging where it paints", async () => {
    const title: LabelManifest = { ...LABEL, characters: "A title longer than its column" };
    const { variant } = await buildWithPart(
      "flex flex-col w-[100px]",
      { classes: "flex w-fit items-center bg-[#ff0000]", text: "A title longer than its column" },
      labelled({ label: title })
    );
    expect(frameOf(variant?.root)?.sizing.horizontal).toEqual(HUG);
  });
});

// Oracle: CSS Text 3 §8.2, where an `em` spacing is a share of the font size, Tailwind's
// `tracking-tight`, which is `-0.025em`, and probe PL, where Figma read `{ unit: "PERCENT", value:
// -2.5 }` back exactly and drew it at any size as the same share. A spacing in pixels has no share.
describe("a label's letter spacing", () => {
  it("reads an em spacing as a percent of the font size", async () => {
    const { variant, coverage } = await buildLabelled("tracking-tight");
    expect(textOf(variant?.root)?.letterSpacing).toEqual({ unit: "PERCENT", value: -2.5 });
    expect(notesOf(coverage, "tracking-tight")).toContainEqual([
      "letter-spacing",
      "literal",
      "letters -2.5% of the font size apart",
    ]);
  });

  it("leaves a spacing in pixels unmapped and draws none", async () => {
    const { variant, coverage } = await buildLabelled("tracking-[1px]");
    expect(textOf(variant?.root)?.letterSpacing).toBeUndefined();
    expect(notesOf(coverage, "tracking-[1px]")).toContainEqual([
      "letter-spacing",
      "unmapped",
      expect.any(String),
    ]);
  });
});

// Oracle: CSS Flexbox 1 and CSS Text 3. A flex box's own text is an anonymous flex item that does not
// grow, so a short label sits at its own width where `justify-content` places it. A Figma text that
// fills the row sets its lines by its own alignment, so it draws what CSS draws only at the start or
// with both centered. A word with no soft wrap opportunity (UAX #14) never wraps, so its item keeps its
// own width, which a hugging text draws, unless `word-break` lets the browser break inside a word.
describe("a wrapping label in a flex box", () => {
  const TWO_WORDS: LabelManifest = { ...LABEL, characters: "Two words" };
  const CENTERED =
    "the row places the label at its own width in the center, where a text that fills it sets its lines at the left";

  it("fills a row that places it at the start", async () => {
    const { variant } = await buildLabelled("flex w-[200px] justify-start", {}, TWO_WORDS);
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
  });

  it("stays unmapped in a row that centers it, where a fill sets its lines at the left", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] justify-center", {}, TWO_WORDS);
    expect(textOf(variant?.root)?.sizing).toEqual(HUGGING);
    expect(notesOf(coverage, "justify-center")).toContainEqual(["justify-content", "unmapped", CENTERED]);
  });

  it("hugs a word where a row centers it, since the word never wraps", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] justify-center");
    expect([textOf(variant?.root)?.sizing, variant?.root.primaryAlign]).toEqual([HUGGING, "CENTER"]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("stays unmapped for a word where word-break lets the browser break it", async () => {
    const { coverage } = await buildLabelled("flex w-[200px] justify-center break-all");
    expect(notesOf(coverage, "justify-center")).toContainEqual(["justify-content", "unmapped", CENTERED]);
  });

  it("fills a row that centers it when its lines are centered too", async () => {
    const { variant, coverage } = await buildLabelled(
      "flex w-[200px] justify-center text-center",
      {},
      TWO_WORDS
    );
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.align.horizontal]).toEqual([FILL_WIDTH, "CENTER"]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });
});

// Oracle: CSS Overflow 3 and 4 and probe P7. A box that hugs its width grows to its `max-width` and no
// further, so CSS wraps and clamps the label there, while a Figma text in a hugging frame keeps its
// own width past the frame's limit, so the clamp and the limit stay unmapped.
describe("a label that ends in an ellipsis", () => {
  // Oracle: CSS Overflow 3 §3.2 and CSS Overflow 4 §4.2. In a block of a fixed width, `truncate`
  // keeps the text on one line and ends it in an ellipsis, and `line-clamp-2` ends it in one after its
  // second line. Figma's `textTruncation: "ENDING"` with `maxLines` cuts a text that fills its frame
  // the same way, and the kit writes both from the label's `truncation`. A one-line ellipsis needs the
  // capture's measurement that the box holds its first character and the ellipsis, as a 120px box
  // holds `B…`.
  it.each([
    ["truncate", 1],
    ["line-clamp-2", 2],
  ])(
    "ends a label that fills a 120px block in an ellipsis after its lines under %s",
    async (classes, maxLines) => {
      const { variant } = await buildLabelled(`block w-[120px] ${classes}`, {
        measured: { ellipsisFits: true },
      });
      expect(textOf(variant?.root)?.truncation).toEqual({ maxLines });
    }
  );

  // Oracle: Chromium's rendering of `Dashboard` in 14px type under `truncate`, read on 2026-11-17 for
  // U3.5: in an 8px box it draws part of the `D`, in a 16px box `D` and part of the ellipsis, and in
  // 24px `D…`. It keeps the first character however narrow the box, where a Figma text that ends in
  // an ellipsis draws the ellipsis alone, as the collapsed Sidebar row drew `…` for a browser's `D`.
  // A box the capture did not measure with room for the first character and the ellipsis takes none.
  it("draws no ellipsis in a box the capture did not measure with room for its first character and the ellipsis", async () => {
    const { variant, coverage } = await buildLabelled("block w-[8px] truncate");
    expect(textOf(variant?.root)?.truncation).toBeUndefined();
    expect(notesOf(coverage, "truncate")).toContainEqual([
      "text-overflow",
      "unmapped",
      "the box has no room for its first character and the ellipsis, where Chromium draws both clipped at the box and a Figma text draws the ellipsis alone",
    ]);
  });

  // Oracle: CSS Overflow 3 §3. A label's `<span>` that hides its overflow clips its text at its own
  // edge, so in an 8px row Chromium draws part of the first character and nothing past the span. A
  // hugging Figma text keeps its whole width, and only a frame around it that clips cuts it off. With
  // no ellipsis to draw, the label hugs, so the span's clip draws only where the row's frame clips at
  // the span's end: a row that clips with no end padding, as the large collapsed Sidebar row. A row
  // that does not clip, or clips at a padding edge past the span, shows text Chromium hides.
  it.each([
    ["unmapped in a row that does not clip", "flex w-[8px]", ["overflow", "unmapped", NARROW_SPAN]],
    [
      "unmapped in a row that clips past its end padding",
      "flex w-[8px] overflow-hidden pr-[4px]",
      ["overflow", "unmapped", NARROW_SPAN],
    ],
    [
      "drawn by a row that clips",
      "flex w-[8px] overflow-hidden",
      ["overflow", "literal", "the label's element clips its text at the room the row leaves it"],
    ],
  ])("leaves the clip of a narrow label span %s", async (_, classes, note) => {
    const truncate = "[&>span:last-child]:truncate";
    const { coverage } = await buildLabelled(classes, {
      text: "",
      carried: truncate,
      children: [{ tag: "span", text: "Label", textIndex: 0, fromParent: truncate }],
    });
    expect(notesOf(coverage, truncate)).toContainEqual(note);
  });

  it("leaves a clamp in a box that hugs up to a max-width unmapped", async () => {
    const detail =
      "the box hugs its width up to its max-width, where CSS wraps or cuts off the label, and a text in a hugging frame keeps its own width";
    const { variant, coverage } = await buildLabelled("w-fit max-w-[100px] line-clamp-2");
    expect(textOf(variant?.root)?.truncation).toBeUndefined();
    expect(notesOf(coverage, "line-clamp-2")).toContainEqual(["-webkit-line-clamp", "unmapped", detail]);
    expect(notesOf(coverage, "max-w-[100px]")).toContainEqual(["max-width", "unmapped", detail]);
  });
});

// Oracle: CSS Sizing 3 §5.1 and CSS 2.1 §10.4. A box that hugs its width is as wide as its text, up to
// its `max-width` raised to its `min-width`, so its text wraps at that width less the box's padding
// and border. In a row the layers beside the text and the gaps take their share (CSS Flexbox 1 §9.7),
// and a part's margins take theirs (CSS Sizing 3 §2.3). Probe P7: a hugging Figma text with a
// `maxWidth` wrapped there and kept hugging, and Figma takes only a positive `maxWidth`.
describe("a label under a max-width", () => {
  async function capOf(classes: string, part?: FixtureElement, icons = false) {
    const manifest: PartManifest = labelled({ iconsFor: () => (icons ? [ICON] : []) });
    const { variant } =
      part === undefined ? await buildLabelled(classes) : await buildWithPart(classes, part, manifest);
    const text = textOf(variant?.root);
    return { sizing: text?.sizing, maxWidth: text?.maxWidth };
  }

  it("gives a wrapping label in a box that hugs up to a max-width that width less the padding", async () => {
    const { variant, coverage } = await buildLabelled("w-fit max-w-[100px] px-[10px]");
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.maxWidth]).toEqual([HUGGING, literal(80)]);
    expect(notesOf(coverage, "max-w-[100px]")).toEqual([["max-width", "literal", "100px"]]);
  });

  it("caps a label at the min-width that wins over the max-width, less the padding", async () => {
    expect(await capOf("w-fit min-w-[200px] max-w-[100px] px-[10px]")).toEqual({
      sizing: HUGGING,
      maxWidth: literal(180),
    });
  });

  it("stops the build where the padding leaves the label no width under the cap", async () => {
    await expect(buildLabelled("w-fit max-w-[16px] px-[8px]")).rejects.toThrow(
      "chip/state=rest: a box around label caps its width at 0px, and Figma takes only a positive max width"
    );
  });

  it("gives a label in a part the max-width of a box around it, less the padding in between", async () => {
    expect(
      await capOf("flex flex-col items-center max-w-[100px] px-[10px]", { classes: "px-[4px]" })
    ).toEqual({
      sizing: HUGGING,
      maxWidth: literal(72),
    });
  });

  it("takes an icon and the gap beside the label out of its capped part's width", async () => {
    expect(
      await capOf(
        "flex flex-col items-center max-w-[100px]",
        {
          classes: "flex gap-[4px]",
          children: [{ tag: "svg", fromParent: "[&_svg]:size-[16px]" }],
          textIndex: 1,
        },
        true
      )
    ).toEqual({ sizing: HUGGING, maxWidth: literal(80) });
  });

  it("takes a part's own margins out of the cap it gets", async () => {
    expect(
      await capOf("flex flex-col items-center max-w-[100px]", { classes: "ml-[10px] mr-[10px]" })
    ).toEqual({
      sizing: HUGGING,
      maxWidth: literal(80),
    });
  });
});

// Oracle: CSS Text 3, where `text-align` inherits, so a `text-center` on the root centers a part's lines.
describe("a label below a root that sets its text layout", () => {
  it("centers its lines under a root's text-center", async () => {
    const { variant, coverage } = await buildWithPart("text-center", {});
    expect(textOf(variant?.root)?.align).toEqual({ horizontal: "CENTER", vertical: "TOP" });
    expect(notesOf(coverage, "text-center")).toEqual([
      ["text-align", "literal", "the label sets its lines in the center"],
    ]);
  });
});

// Oracle: HTML's rendering of a text `<input>`, which draws its value on one line across its content
// box from the start, whatever the box's `display` or `white-space` say, so the label fills the width
// and ends in an ellipsis after one line (`DECISIONS.md` round 2), and of a `<textarea>`, which wraps
// its value at its width. A `text-align` class still sets the lines, as it does in CSS. A box that
// hugs its width takes the control's own width, which has no Figma form.
describe("a label that a native control sets", () => {
  const control = (tag: string, classes: string) => buildLabelled(classes, { tag });

  it("sets a filling label's lines where a text-align class says", async () => {
    const { variant } = await control("input", "w-[100px] h-[80px] text-right");
    expect(textOf(variant?.root)?.align.horizontal).toBe("RIGHT");
  });

  it("keeps an input's text to one line whatever white-space says, and drops it with the reason", async () => {
    const { variant, coverage } = await control("input", "w-[200px] whitespace-normal");
    expect(textOf(variant?.root)?.truncation).toEqual({ maxLines: 1 });
    expect(notesOf(coverage, "whitespace-normal")).toEqual([
      ["text-wrap-mode", "dropped", "the control sets its text on one line itself"],
      ["white-space-collapse", "dropped", "the control sets its text on one line itself"],
    ]);
  });

  it("stops the build for an input in a box that hugs its width", async () => {
    await expect(control("input", "flex")).rejects.toThrow(
      "chip/state=rest: the control sets its text on one line across its width, so its box needs a fixed or filling width"
    );
  });

  it("stops the build for a textarea in a box that hugs its width", async () => {
    await expect(control("textarea", "flex")).rejects.toThrow(
      "chip/state=rest: the control wraps its text at its width, so its box needs a fixed or filling width"
    );
  });
});

// Oracle: CSS inheritance. An element inherits its parent's computed value, so an element around the
// root resolves its own `var()` before the value reaches the root, and the root's `currentcolor` is
// the color it inherits. Of two elements around the root the nearer one passes its value down, and an
// element's own declaration beats every inherited value.
describe("a declaration an element around the root passes down in some cells", () => {
  const RED = { className: "data-invalid:text-[red]", property: "color", value: "rgb(255 0 0)" };
  const manifest = (states: readonly string[]): SetManifest =>
    chip({ axes: [{ name: "state", values: states }], label: LABEL });
  async function build(
    classes: string,
    field: (invalid: boolean) => FixtureElement,
    states: readonly string[] = ["rest", "invalid"]
  ) {
    return buildCaptured(
      manifest(states),
      states.map((state) => ({
        cell: { state },
        around: [
          { written: [{ className: "text-[black]", property: "color", value: "rgb(0 0 0)" }] },
          { slot: "field", ...field(state === "invalid") },
        ],
        root: { slot: "chip", classes: `font-sans text-[14px] leading-[20px] ${classes}`, text: "Label" },
      })),
      FONT_SANS
    );
  }
  const colors = (built: Awaited<ReturnType<typeof build>>) =>
    built.componentSet.variants.map((variant) => textOf(variant.root)?.color);
  const rgb = (r: number, g: number, b: number) => ({ kind: "literal", color: { r, g, b, a: 1 } });
  const red = (invalid: boolean): FixtureElement => (invalid ? { written: [RED] } : {});

  it("colors the text in the cells that name it, over the outer element's color", async () => {
    const built = await build("", red);
    expect(colors(built)).toEqual([rgb(0, 0, 0), rgb(1, 0, 0)]);
    expect(notesOf(built.coverage, RED.className)).toEqual([["color", "literal", "rgba(255, 0, 0, 1)"]]);
  });

  it("loses to a color class of the root's own, which leaves the outer color unread", async () => {
    const built = await build("text-[#0000ff]", red);
    expect(colors(built)).toEqual([rgb(0, 0, 1), rgb(0, 0, 1)]);
    expect(notesOf(built.coverage, RED.className)).toEqual([
      ["color", "dropped", "the root sets its own, so it does not inherit this"],
    ]);
  });

  it("passes the color the element computes from its own custom property, whatever the root sets", async () => {
    const tone = (invalid: boolean): FixtureElement =>
      invalid
        ? {
            written: [
              { className: "[--tone:red]", property: "--tone", value: "rgb(255 0 0)" },
              { className: "text-(--tone)", property: "color", value: "var(--tone)" },
            ],
          }
        : {};
    expect(colors(await build("[--tone:#0000ff]", tone))).toEqual([rgb(0, 0, 0), rgb(1, 0, 0)]);
  });

  it("gives the root's currentcolor the color it inherits", async () => {
    expect(colors(await build("text-current", red, ["invalid"]))).toEqual([rgb(1, 0, 0)]);
  });

  it("gives the root's label the type and color an element around it computes, per cell", async () => {
    const list = (invalid: boolean): FixtureElement => ({
      classes: `text-[12px] leading-[16px] ${invalid ? "data-invalid:text-[#ff0000]" : "text-[#00ff00]"} flex gap-[8px]`,
    });
    const built = await buildCaptured(
      manifest(["rest", "invalid"]),
      ["rest", "invalid"].map((state) => ({
        cell: { state },
        around: [{ slot: "list", ...list(state === "invalid") }],
        root: { slot: "chip", classes: "font-sans", text: "Label" },
      })),
      FONT_SANS
    );
    expect(
      built.componentSet.variants.map((variant) => {
        const text = textOf(variant.root);
        return [text?.fontSize, text?.lineHeight, text?.color];
      })
    ).toEqual([
      [literal(12), literal(16), rgb(0, 1, 0)],
      [literal(12), literal(16), rgb(1, 0, 0)],
    ]);
  });

  it("lets a nearer element's own color beat the one it inherits", async () => {
    const built = await buildCaptured(
      manifest(["rest", "invalid"]),
      ["rest", "invalid"].map((state) => ({
        cell: { state },
        around: [
          {
            slot: "list",
            classes: `text-[12px] leading-[16px] ${state === "invalid" ? "data-invalid:text-[#ff0000]" : "text-[#00ff00]"}`,
          },
          { slot: "item", classes: "text-[#0000ff]" },
        ],
        root: { slot: "chip", classes: "font-sans", text: "Label" },
      })),
      FONT_SANS
    );
    expect(built.componentSet.variants.map((variant) => textOf(variant.root)?.color)).toEqual([
      rgb(0, 0, 1),
      rgb(0, 0, 1),
    ]);
    expect(notesOf(built.coverage, "data-invalid:text-[#ff0000]")).toEqual([
      ["color", "dropped", "the item around the root sets its own, so the root does not inherit this"],
    ]);
  });
});

// Oracle: CSS Text 4 §3.1. `white-space-collapse: preserve`, which `whitespace-pre` sets, keeps
// every space and line break as written, as a Figma text draws its characters, runs of spaces
// included.
describe("a label under whitespace-pre", () => {
  it("drops the preserve, which keeps a run of spaces as Figma does", async () => {
    const spaced: LabelManifest = { ...LABEL, characters: "1  /  2" };
    const { variant, coverage } = await buildLabelled("whitespace-pre", {}, spaced);
    expect(textOf(variant?.root)?.characters).toBe("1  /  2");
    expect(notesOf(coverage, "whitespace-pre")).toContainEqual([
      "white-space-collapse",
      "dropped",
      "a Figma text keeps every space and line break as written, as `preserve` does",
    ]);
  });
});

// Oracle: the text the browser rendered, as the capture recorded it for the label's element (#779),
// under the label's white space rules (CSS Text 3 §4.1.1): `normal` folds runs of spaces, tabs and
// line feeds, `pre-line` keeps the line feeds, `pre` keeps every character, and a no-break space
// (U+00A0) is no white space. The label's text is its element's text nodes and those of the elements
// below it that draw no layer, in order, each where it is visible (CSS 2.1 §11.2). The kit draws a
// label's manifest copy, so copy that differs from that text, as a day of `5` where the browser
// renders `05`, would show text the component never renders, and the build refuses it. A label none
// of whose text paints may differ.
describe("a label's manifest copy beside the captured text", () => {
  /** A label that shows the given characters. */
  const showing = (characters: string): LabelManifest => ({ ...LABEL, characters });

  it.each([
    ["the same text", "flex", { text: "Label" }, "Label"],
    ["text whose white space `normal` folds", "flex", { text: "  La \n bel " }, "La bel"],
    ["the spaces `pre` keeps", "flex whitespace-pre", { text: "A  B" }, "A  B"],
    [
      "the line feed `pre-line` keeps",
      "flex whitespace-pre-line",
      { text: "Line one  \n  Line two" },
      "Line one\nLine two",
    ],
    ["a no-break space", "flex", { text: "1\u00A0234" }, "1\u00A0234"],
    [
      "text split across its own node and a span",
      "flex",
      { text: "Hel", textIndex: 0, children: [{ tag: "span", text: "lo" }] },
      "Hello",
    ],
    [
      "text split across two spans",
      "flex",
      {
        text: "",
        children: [
          { tag: "span", text: "La" },
          { tag: "span", text: "bel" },
        ],
      },
      "Label",
    ],
    ["text that paints nothing", "flex invisible", { text: "30" }, "Label"],
  ])("builds with %s", async (_, classes, root, characters) => {
    const { variant } = await buildLabelled(classes, root, showing(characters));
    expect(textOf(variant?.root)?.characters).toBe(characters);
  });

  it.each([
    ["another word", "flex", { text: "Lable" }, "Label", '"Label", where the browser renders "Lable"'],
    [
      "spaces `pre` keeps",
      "flex whitespace-pre",
      { text: "A  B" },
      "A B",
      '"A B", where the browser renders "A  B"',
    ],
    [
      "a line feed `pre-line` keeps",
      "flex whitespace-pre-line",
      { text: "Line one\nLine two" },
      "Line one Line two",
      'renders "Line one\\nLine two"',
    ],
    ["a space for a no-break space", "flex", { text: "1\u00A0234" }, "1 234", 'renders "1\u00A0234"'],
    [
      "text split across two spans",
      "flex",
      {
        text: "",
        children: [
          { tag: "span", text: "La" },
          { tag: "span", text: "bel" },
        ],
      },
      "Wrong",
      '"Wrong", where the browser renders "Label"',
    ],
    ["an element with no text", "flex", { text: "" }, "Label", '"Label", where the browser renders ""'],
    [
      "a visible span under a hidden box",
      "flex invisible",
      { text: "", children: [{ tag: "span", classes: "visible", text: "Actual" }] },
      "Wrong",
      'renders "Actual"',
    ],
  ])("fails against %s", async (_, classes, root, characters, message) => {
    await expect(buildLabelled(classes, root, showing(characters))).rejects.toThrow(message);
  });
});
