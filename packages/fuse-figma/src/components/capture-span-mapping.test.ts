/**
 * How the build draws a row whose `100%` width spans a parent that fits its content beside another
 * block, as Calendar's header spans its card above the month grid, and a middle layer that grows
 * in that row between two that keep their width. The unit under test is `buildSetsInOrder` on
 * hand-built captures (`test/capture-fixtures.ts`). The oracles are CSS Sizing 3 §5.2.1, where the
 * parent shrinks to fit its widest child, the percentage counting as `auto` meanwhile, and the row
 * then spans it; CSS Flexbox 1 §9.7, where the one growing layer takes all the free space; and the
 * live Figma probes of 2026-11-19: a hugging row with a minimum width grows past it around a hugging
 * middle layer that SPACE_BETWEEN centers and drops the item spacing beside (CAL2), a filling middle
 * layer never widens the row (CAL1), and a hugging column that centers its layers centers a fixed
 * frame under the row once the row is wider (CAL3).
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, frameOf, HUG, literal, notesOf, part, rest } from "../../test/capture-fixtures";
import type { FixtureElement, FixtureOptions } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { LabelManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec, FrameLayerSpec } from "./kit-spec";

/** A build whose `font-sans` binds the synced family, as every kit label's does. */
const FONT_SANS: FixtureOptions = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/** The title's label. */
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  shownIn: () => true,
};

/** The text classes the label needs, which the root carries and its parts inherit. */
const TEXT_STYLE = "font-sans text-[14px] leading-[20px] text-[#000000]";

/** The width the capture measures beside the header: the body's 100px content. */
const BESIDE: MeasuredFacts = { spansBeside: 100 };

/** The header's own classes, Calendar's header with its gap and padding in pixels. */
const HEADER = "box-border flex w-full items-center gap-[4px] px-[4px]";

/** The title's classes, Calendar's heading with its margins in pixels. */
const TITLE = "flex-1 mx-[8px] text-center";

/** A fixed button beside the title, which neither grows nor shrinks. */
const BUTTON = "shrink-0 size-[24px]";

/** What a case changes from Calendar's header and card. */
type CardChange = {
  readonly header?: string;
  readonly measured?: MeasuredFacts;
  readonly title?: string;
  readonly first?: string;
  readonly body?: string;
  /** The card's own classes. */
  readonly card?: string;
  /** A fourth layer after the second button. */
  readonly fourth?: true;
  /** A mark the title holds beside its label. */
  readonly mark?: true;
};

/**
 * Build a card that fits its content around a header and a body: the header's buttons around its
 * title, and the body's 100px box, with the facts measured of the header.
 */
function buildCard({
  header = HEADER,
  measured = BESIDE,
  title = TITLE,
  first = BUTTON,
  body = "flex justify-center",
  card = "",
  fourth,
  mark,
}: CardChange = {}) {
  const extra = fourth === true ? [{ slot: "more", classes: BUTTON }] : [];
  const headerElement: FixtureElement = {
    slot: "head",
    classes: header,
    measured,
    children: [
      { slot: "prev", classes: first },
      {
        slot: "title",
        classes: title,
        text: "Label",
        children: mark === true ? [{ slot: "mark", classes: "inline-block size-[4px]" }] : [],
      },
      { slot: "next", classes: BUTTON },
      ...extra,
    ],
  };
  return buildCaptured(
    chip({
      parts: [
        part({
          key: "header",
          slot: "head",
          parts: [
            part({ key: "prev", slot: "prev" }),
            part({
              key: "title",
              slot: "title",
              label: LABEL,
              parts: mark === true ? [part({ key: "mark", slot: "mark" })] : [],
            }),
            part({ key: "next", slot: "next" }),
            ...(fourth === true ? [part({ key: "more", slot: "more" })] : []),
          ],
        }),
        part({ key: "body", slot: "body", parts: [part({ key: "content", slot: "content" })] }),
      ],
    }),
    rest({
      slot: "chip",
      classes: `${TEXT_STYLE} block w-fit p-[4px] ${card}`,
      children: [
        headerElement,
        { slot: "body", classes: body, children: [{ slot: "content", classes: "size-[100px]" }] },
      ],
    }),
    FONT_SANS
  );
}

/** The header's frame in a built card. */
function headerOf(root: BoxSpec | undefined): FrameLayerSpec | undefined {
  return frameOf(root);
}

/** The frame the header draws second, around the title's margins. */
function titleOf(root: BoxSpec | undefined): FrameLayerSpec | undefined {
  const title = headerOf(root)?.children[1];
  return title?.kind === "frame" ? title : undefined;
}

/** The outcome of the coverage row of a class on a property. */
function outcomeOf(coverage: Parameters<typeof notesOf>[0], className: string, property: string) {
  return notesOf(coverage, className).find(([each]) => each === property)?.[1];
}

describe("a row that spans a parent fitting its content beside a block one width in every mode", () => {
  it("hugs with that width as its minimum", async () => {
    const { variant, coverage } = await buildCard();
    const header = headerOf(variant?.root);
    expect(header?.sizing.horizontal).toEqual(HUG);
    expect(header?.limits.minWidth).toEqual(literal(100));
    expect(outcomeOf(coverage, "w-full", "width")).toBe("literal");
  });

  it.each([
    ["without the measurement", { measured: {} }],
    // A parent's own minimum makes it wider than its widest block (CSS 2.1 §10.4).
    ["where the parent sets its own minimum width", { card: "min-w-[300px]" }],
  ])("leaves the width unmapped %s", async (_case, change: CardChange) => {
    const { variant, coverage } = await buildCard(change);
    expect(headerOf(variant?.root)?.limits.minWidth).toBeUndefined();
    expect(outcomeOf(coverage, "w-full", "width")).toBe("unmapped");
  });

  // CAL3: the column centers the body's hugging row under the wider header, where CSS spans the body
  // across the card and its `justify-center` centers its content.
  it("centers the block beside it, which centers its content and paints nothing", async () => {
    const { variant } = await buildCard();
    expect(variant?.root.counterAlign).toBe("CENTER");
  });

  it.each([
    ["packs its content at its start", "flex justify-start"],
    ["paints a fill", "flex justify-center bg-[#ff0000]"],
    ["pads its content", "flex justify-center px-[2px]"],
    // Chromium sets a `fit-content` or `max-content` body 100px wide at the card's start, x 0, where
    // the column would center it at x 77.95 under the 255.9px header.
    ["fits its content", "flex justify-center w-fit"],
    ["takes its max-content width", "flex justify-center w-max"],
  ])("keeps the column at its start beside a block that %s", async (_case, body) => {
    const { variant } = await buildCard({ body });
    expect(variant?.root.counterAlign).toBe("MIN");
  });
});

describe("a middle layer that grows between two that keep their width", () => {
  // The text sits halfway between the buttons in CSS at any row width, and SPACE_BETWEEN puts the
  // hugging title there, its 8px margins and the 4px gap drawn as its 12px padding (CAL2).
  it("hugs between them, which the row spaces out with no item spacing", async () => {
    const { variant, coverage } = await buildCard();
    const header = headerOf(variant?.root);
    const title = titleOf(variant?.root);
    expect([header?.primaryAlign, header?.itemSpacing]).toEqual(["SPACE_BETWEEN", literal(0)]);
    expect([title?.sizing.horizontal, title?.paddingLeft, title?.paddingRight]).toEqual([
      HUG,
      literal(12),
      literal(12),
    ]);
    expect(outcomeOf(coverage, "flex-1", "flex")).toBe("literal");
    expect(outcomeOf(coverage, "gap-[4px]", "gap")).toBe("literal");
  });

  it.each([
    ["sets its text at its start", { title: "flex-1 mx-[8px] text-left" }],
    ["takes unequal margins", { title: "flex-1 ms-[8px] me-[4px] text-center" }],
    ["takes zero margins", { title: "flex-1 mx-0 text-center" }],
    ["sits beside a layer that can shrink", { first: "size-[24px]" }],
    ["sits in a row that sets its own alignment", { header: `${HEADER} justify-start` }],
    ["sits in a row of four layers", { fourth: true as const }],
    ["holds a part beside its label", { mark: true as const }],
    // `grow-0` after `flex-1` keeps the heading at its text, so Chromium leaves the room after it.
    ["has its growth taken back", { title: `${TITLE} grow-0` }],
    // Chromium paints a heading's own paint across the 172px it grows to, where the hugging layer
    // draws it around its text alone.
    ["paints a fill", { title: `${TITLE} bg-[#ff0000]` }],
    ["draws a border", { title: `${TITLE} border border-[#ff0000]` }],
    ["casts a shadow", { title: `${TITLE} shadow-[0_0_0_1px_#ff0000]` }],
  ])("stays unmapped where it %s", async (_case, change: CardChange) => {
    const { variant, coverage } = await buildCard(change);
    expect(headerOf(variant?.root)?.primaryAlign).not.toBe("SPACE_BETWEEN");
    expect(outcomeOf(coverage, "flex-1", "flex")).toBe("unmapped");
  });
});
