/**
 * How the build covers what a composite draws around an instance part: an auto margin, a margin of a
 * length, an `align-self` and a translate, on an instance the composite holds or one an instance
 * built in place holds. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell
 * `chip` sets (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that
 * says what the browser draws, or Figma's instance model, under which an instance carries only the
 * overrides `OVERRIDDEN_FIELD` in `instance-parts.ts` lists and its own sizing, and an instance nested
 * in another carries only TEXT values. The coverage contract makes a declaration that does not reach
 * Figma `unmapped` and one with nothing to draw `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, ICON, instanceOf, notesOf, part, rest } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { SetManifest } from "../capture/manifest";

/** The inner set the instance-part cases place in a row. */
const tag = chip({ key: "review-tag", name: "Review tag", slot: "tag" });
const TAG = instanceOf("tag", tag);

/**
 * Build a chip whose root wins `classes` and holds a Review row instance with the parts, whose root
 * is `rowRoot`. The tag's root `tagRoot` is in the row and in the Review tag set.
 */
function buildNestedRow(
  classes: string,
  parts: NonNullable<SetManifest["parts"]>,
  rowRoot: FixtureElement,
  tagRoot: FixtureElement
) {
  const row = chip({ key: "review-row", name: "Review row", slot: "row", parts });
  return buildCaptured(
    chip({ parts: [instanceOf("row", row)] }),
    rest({ slot: "chip", classes, children: [rowRoot] }),
    {
      inner: [
        { manifest: tag, cells: rest(tagRoot) },
        { manifest: row, cells: rest(rowRoot) },
      ],
    }
  );
}

/** The outcomes of a declaration's rows. */
function outcomesOf(coverage: Parameters<typeof notesOf>[0], className: string) {
  return notesOf(coverage, className).map(([, outcome]) => outcome);
}

// Oracle: the coverage contract, under which a declaration that reaches a Figma field is `literal`
// and only one with nothing to draw is `dropped`. An auto margin the composite passes an instance part
// is drawn by the row that holds the instance, through the same row rules as a frame's (CSS Flexbox 1
// §8.1), and the inner set's variant holds no margin, so nothing repeats it.
describe("an auto margin on an instance part", () => {
  /** Build a chip whose row holds the parts, the tag instance among them, with the room measured. */
  function buildRow(
    classes: string,
    parts: NonNullable<SetManifest["parts"]>,
    children: readonly FixtureElement[]
  ) {
    return buildCaptured(
      chip({ parts }),
      rest({ slot: "chip", classes, measured: { freeAlongMain: true }, children }),
      { inner: [{ manifest: tag, cells: rest({ slot: "tag", classes: "size-[20px]" }) }] }
    );
  }

  it("draws ms-auto on the last of two layers through the row's spacing", async () => {
    const { variant, coverage } = await buildRow(
      "flex w-[200px]",
      [part({ key: "a", slot: "a" }), TAG],
      [
        { slot: "a", classes: "size-[20px]" },
        { slot: "tag", classes: "size-[20px] ms-auto" },
      ]
    );
    expect(variant?.root.primaryAlign).toBe("SPACE_BETWEEN");
    expect(notesOf(coverage, "ms-auto").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-left", "literal"],
    ]);
  });

  it("draws me-auto on the first of three layers through the frame that ends the others", async () => {
    const { variant, coverage } = await buildRow(
      "flex w-[200px] gap-[8px]",
      [TAG, part({ key: "b", slot: "b" }), part({ key: "c", slot: "c" })],
      [
        { slot: "tag", classes: "size-[20px] me-auto" },
        { slot: "b", classes: "size-[20px]" },
        { slot: "c", classes: "size-[20px]" },
      ]
    );
    expect(variant?.root.children.map((child) => child.key)).toEqual(["tag", "tag end"]);
    expect(notesOf(coverage, "me-auto").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-right", "literal"],
    ]);
  });

  // Oracle: Figma's instance model, under which an instance of the row's set draws that set's
  // variant and carries only what an override or its own sizing sets. Here the chip's
  // `[--push:auto]` reaches the tag's `var(--push,0px)` inside a Review row instance, so the row that
  // places the tag is the row instance's root. Its own variant takes `--push` at 0px and packs its
  // layers at its start, so the margin reaches Figma only where the row instance carries the
  // alignment or the frame in place.
  describe("inside an instance of the row's own set", () => {
    /** Build a chip that sets `--push` to auto around a Review row instance, as `buildNestedRow` builds one. */
    const buildNested = (
      parts: NonNullable<SetManifest["parts"]>,
      rowRoot: FixtureElement,
      tagRoot: FixtureElement
    ) => buildNestedRow("flex w-[200px] [--push:auto]", parts, rowRoot, tagRoot);

    const PUSHED_START: FixtureElement = { slot: "tag", classes: "size-[20px] ms-[var(--push,0px)]" };
    const PUSHED_END: FixtureElement = { slot: "tag", classes: "size-[20px] me-[var(--push,0px)]" };

    const SPACED = (width: string): FixtureElement => ({
      slot: "row",
      classes: `flex ${width}`,
      measured: { freeAlongMain: true },
      children: [{ slot: "a", classes: "size-[20px]" }, PUSHED_START],
    });

    it("leaves ms-auto unmapped where the row instance cannot carry its spacing", async () => {
      const { coverage } = await buildNested(
        [part({ key: "a", slot: "a" }), TAG],
        SPACED("w-[200px]"),
        PUSHED_START
      );
      const [note] = notesOf(coverage, "[--push:auto]");
      expect(note?.slice(0, 2)).toEqual(["--push", "unmapped"]);
      expect(note?.[2]).toContain("draws primaryAlign");
    });

    // The row instance's root draws the spacing whether the row holds the tag as an instance or as a
    // frame of its own, so a frame part's margin is unmapped there too.
    it("leaves ms-auto on a frame part unmapped where the row instance cannot carry its spacing", async () => {
      const { coverage } = await buildNested(
        [part({ key: "a", slot: "a" }), part({ key: "tag", slot: "tag" })],
        SPACED("w-[200px]"),
        PUSHED_START
      );
      const [note] = notesOf(coverage, "[--push:auto]");
      expect(note?.slice(0, 2)).toEqual(["--push", "unmapped"]);
      expect(note?.[2]).toContain("draws primaryAlign");
    });

    it("keeps ms-auto literal where the row instance fills the chip and carries its spacing", async () => {
      const { variant, coverage } = await buildNested(
        [part({ key: "a", slot: "a" }), TAG],
        SPACED("w-full"),
        PUSHED_START
      );
      expect(variant?.root.children[0]).toMatchObject({
        kind: "instance",
        overrides: [{ path: [], field: "primaryAlign", value: "SPACE_BETWEEN" }],
      });
      expect(notesOf(coverage, "[--push:auto]").map(([property, outcome]) => [property, outcome])).toEqual([
        ["--push", "literal"],
      ]);
    });

    it("leaves me-auto unmapped where the row instance cannot carry the frame that ends the others", async () => {
      const { coverage } = await buildNested(
        [TAG, part({ key: "b", slot: "b" }), part({ key: "c", slot: "c" })],
        {
          slot: "row",
          // `justify-start` packs the row's own variant at its start, as the frame packs the row in place,
          // so only the layers differ.
          classes: "flex w-[200px] gap-[8px] justify-start",
          measured: { freeAlongMain: true },
          children: [
            PUSHED_END,
            { slot: "b", classes: "size-[20px]" },
            { slot: "c", classes: "size-[20px]" },
          ],
        },
        PUSHED_END
      );
      const [note] = notesOf(coverage, "[--push:auto]");
      expect(note?.slice(0, 2)).toEqual(["--push", "unmapped"]);
      expect(note?.[2]).toContain("draws layers");
    });

    // An instance nested in another carries no override of its own, unless only its TEXT values
    // differ, so the Review holder instance that holds the Review row cannot carry the row's
    // spacing override. A margin of the row's own puts a frame around the row instance in the
    // holder's column (CSS Flexbox 1 §4.2), with the instance inside it as `box`, which changes
    // nothing of that.
    it.each([
      { holds: "the row", holder: "flex w-[200px]", width: "w-full", layer: "row" },
      {
        holds: "a frame around the row",
        holder: "flex flex-col w-[200px]",
        width: "w-full mt-[4px]",
        layer: "row / box",
      },
    ])(
      "leaves ms-auto unmapped where an instance of the row's holder holding $holds cannot carry the row's override",
      async ({ holder: holderClasses, width, layer }) => {
        const manifest = chip({
          key: "review-row",
          name: "Review row",
          slot: "row",
          parts: [part({ key: "a", slot: "a" }), TAG],
        });
        const holder = chip({
          key: "review-holder",
          name: "Review holder",
          slot: "holder",
          parts: [instanceOf("row", manifest)],
        });
        const HOLDER: FixtureElement = { slot: "holder", classes: holderClasses, children: [SPACED(width)] };
        const { coverage } = await buildCaptured(
          chip({ parts: [instanceOf("holder", holder)] }),
          rest({ slot: "chip", classes: "flex w-[200px] [--push:auto]", children: [HOLDER] }),
          {
            inner: [
              { manifest: tag, cells: rest(PUSHED_START) },
              { manifest, cells: rest(SPACED(width)) },
              { manifest: holder, cells: rest(HOLDER) },
            ],
          }
        );
        const notes = notesOf(coverage, "[--push:auto]");
        expect(notes.map(([, outcome]) => outcome)).toEqual(["unmapped"]);
        expect(notes[0]?.[2]).toMatch(new RegExp(`^${layer} draws instance `));
      }
    );
  });
});

// Oracle: the coverage contract, under which a declaration that reaches a Figma field is `literal`
// and only one with nothing to draw is `dropped`. A part's `align-self` places it across the row in
// place of the row's `align-items` (CSS Box Alignment 3 §6.1), so on an instance part the row that
// holds the instance draws it, through the row's counter alignment. The inner set's variant aligns
// nothing for it, so nothing repeats it.
describe("an align-self on an instance part", () => {
  /** Build a 40px chip row that holds only the tag instance, whose inner root is `inner`. */
  function buildRow(tagInPlace: string, inner: string) {
    return buildCaptured(
      chip({ parts: [TAG] }),
      rest({
        slot: "chip",
        classes: "flex w-[100px] h-[40px]",
        children: [{ slot: "tag", classes: tagInPlace }],
      }),
      { inner: [{ manifest: tag, cells: rest({ slot: "tag", classes: inner }) }] }
    );
  }

  it("draws self-end through the row's counter alignment", async () => {
    const { variant, coverage } = await buildRow("size-[20px] self-end", "size-[20px]");
    expect(variant?.root.counterAlign).toBe("MAX");
    expect(notesOf(coverage, "self-end").map(([property, outcome]) => [property, outcome])).toEqual([
      ["align-self", "literal"],
    ]);
  });

  // Oracle: Figma's instance model, under which an instance of the row's set draws that set's
  // variant and carries only what an override or its own sizing sets, and no override sets a root's
  // counter alignment. Here the chip's `[--place:flex-end]` reaches the tag's
  // `[align-self:var(--place,auto)]` inside a Review row instance, so the row that places the tag is
  // the row instance's root. Its own variant takes `--place` at `auto`, so `items-start` tops the
  // tag, where the chip's value ends it.
  it("leaves the alignment unmapped where the holding row is an instance that cannot carry it", async () => {
    const PLACED: FixtureElement = { slot: "tag", classes: "size-[20px] [align-self:var(--place,auto)]" };
    const ROW: FixtureElement = {
      slot: "row",
      classes: "flex w-[100px] h-[40px] items-start",
      children: [PLACED],
    };
    const { coverage } = await buildNestedRow("flex w-[200px] [--place:flex-end]", [TAG], ROW, PLACED);
    const [note] = notesOf(coverage, "[--place:flex-end]");
    expect(note?.slice(0, 2)).toEqual(["--place", "unmapped"]);
    expect(note?.[2]).toContain("draws counterAlign");
  });
});

// Oracle: Figma's instance model, under which an instance of the row's set draws that set's variant
// and carries only what an override or its own sizing sets, and no override adds a layer or sets the
// padding of a frame below its root. The chip's custom property reaches the tag inside a Review row instance, where the row
// instance's root holds the tag and draws what the composite draws around it. The row's own variant
// takes the property's fallback, which draws nothing around the tag.
describe("a margin or translate drawn around an instance part inside an instance", () => {
  /** Build a chip whose root wins `chipClasses` around a Review row instance that holds the tag. */
  const buildNested = (chipClasses: string, rowRoot: FixtureElement, tagRoot: FixtureElement) =>
    buildNestedRow(chipClasses, [TAG], rowRoot, tagRoot);

  // The margin draws as a frame around the tag in the row (CSS Flexbox 1 §4.2). At the 0px fallback
  // the row's variant holds the bare instance, so the row's layers differ. At the 4px fallback the
  // variant draws the frame too, so only the frame's padding differs.
  it.each([
    { fallback: "0px", carries: "the frame around the tag", detail: /^the root draws layers / },
    { fallback: "4px", carries: "the frame's padding", detail: /^tag draws paddingLeft / },
  ])(
    "leaves a margin with a $fallback fallback unmapped where the row instance cannot carry $carries",
    async ({ fallback, detail }) => {
      const SPACED: FixtureElement = { slot: "tag", classes: `size-[20px] ms-[var(--gap,${fallback})]` };
      const { coverage } = await buildNested(
        "flex w-[200px] [--gap:8px]",
        { slot: "row", classes: "flex w-[100px]", children: [SPACED] },
        SPACED
      );
      const notes = notesOf(coverage, "[--gap:8px]");
      expect(notes.map(([, outcome]) => outcome)).toEqual(["unmapped"]);
      expect(notes[0]?.[2]).toMatch(detail);
    }
  );

  // The chip draws a frame around the Review row instance for the row's own margin, but the row
  // instance would need a frame around the tag too, which no override adds, so one read the chip
  // draws leaves the declaration unmapped.
  it("leaves a margin unmapped where the chip draws one frame and the row instance cannot draw the other", async () => {
    const SPACED: FixtureElement = { slot: "tag", classes: "size-[20px] ms-[var(--gap,0px)]" };
    const { coverage } = await buildNested(
      "flex w-[200px] [--gap:8px]",
      { slot: "row", classes: "flex w-[100px] ms-[var(--gap,0px)]", children: [SPACED] },
      SPACED
    );
    expect(outcomesOf(coverage, "[--gap:8px]")).toEqual(["unmapped"]);
  });

  // The other instance's 8px margin needs a frame the row's variant, at the 0px fallback, does not
  // draw. At 4px the tag's margin takes its fallback, so the frame around the tag repeats the
  // variant's. At 8px that frame pads 8px where the variant's pads 4px, which no override sets.
  it.each([
    { tagMargin: "4px", draws: "repeats the variant's frame", tagOutcome: "dropped" },
    { tagMargin: "8px", draws: "pads the variant's frame another way", tagOutcome: "unmapped" },
  ])(
    "leaves a $tagMargin tag margin that $draws $tagOutcome beside a margin that adds a frame",
    async ({ tagMargin, tagOutcome }) => {
      const other = chip({ key: "review-other", name: "Review other", slot: "other" });
      const SPACED: FixtureElement = { slot: "tag", classes: "flex size-[20px] ms-[var(--a,4px)]" };
      const OTHER: FixtureElement = { slot: "other", classes: "size-[20px] ms-[var(--b,0px)]" };
      const row = chip({
        key: "review-row",
        name: "Review row",
        slot: "row",
        parts: [TAG, instanceOf("other", other)],
      });
      const ROW: FixtureElement = { slot: "row", classes: "flex w-[100px]", children: [SPACED, OTHER] };
      const { coverage } = await buildCaptured(
        chip({ parts: [instanceOf("row", row)] }),
        rest({ slot: "chip", classes: `flex w-[200px] [--a:${tagMargin}] [--b:8px]`, children: [ROW] }),
        {
          inner: [
            { manifest: other, cells: rest(OTHER) },
            { manifest: tag, cells: rest(SPACED) },
            { manifest: row, cells: rest(ROW) },
          ],
        }
      );
      expect([outcomesOf(coverage, `[--a:${tagMargin}]`), outcomesOf(coverage, "[--b:8px]")]).toEqual([
        [tagOutcome],
        ["unmapped"],
      ]);
    }
  );

  // The row draws the frame for the tag's 4px margin as its variant does, so that read repeats it,
  // but the tag's own 4px padding differs from its variant's 2px, which no override sets.
  it("leaves a declaration unmapped where one read repeats the row's frame and another pads the tag", async () => {
    const SPACED: FixtureElement = {
      slot: "tag",
      classes: "flex size-[20px] ms-[var(--gap,4px)] ps-[var(--gap,2px)]",
    };
    const { coverage } = await buildNested(
      "flex w-[200px] [--gap:4px]",
      { slot: "row", classes: "flex w-[100px]", children: [SPACED] },
      SPACED
    );
    expect(outcomesOf(coverage, "[--gap:4px]")).toEqual(["unmapped"]);
  });

  // A translate moves only the tag's painting (CSS Transforms 1 §6), which the column draws by taking
  // 1px from its left padding and giving it to its right, where the row's variant pads 8px each side.
  // The column is a frame below the row's root, whose paddings no override sets.
  it("leaves a translate unmapped where the row instance cannot carry the column's paddings", async () => {
    const MOVED: FixtureElement = { slot: "tag", classes: "size-[20px] [translate:var(--shift,0px)]" };
    const COLUMN: FixtureElement = {
      slot: "column",
      classes: "flex flex-col w-[100px] px-[8px]",
      children: [MOVED],
    };
    const { coverage } = await buildNestedRow(
      "flex w-[200px] [--shift:-1px]",
      [{ ...part({ key: "column", slot: "column" }), parts: [TAG] }],
      { slot: "row", classes: "flex w-[100px]", children: [COLUMN] },
      MOVED
    );
    const [note] = notesOf(coverage, "[--shift:-1px]");
    expect(note?.slice(0, 2)).toEqual(["--shift", "unmapped"]);
    expect(note?.[2]).toMatch(/^column draws padding(Left|Right) /);
  });
});

// Oracle: Figma's instance model. A declaration whose reads fill several fields reaches Figma only
// where the instances carry each read, so one read no instance carries leaves the declaration
// unmapped, whatever the composite draws for its other reads.
describe("a declaration read both around an instance part and on its layers", () => {
  /** The Review tag set with a dot inside, which the tag's own alignments place. */
  const dotted = chip({ key: "review-tag", name: "Review tag", slot: "tag", parts: [part()] });

  // The chip's row draws the tag's `align-self` through its counter alignment, but the tag's
  // `align-items` sets the tag root's counter alignment, MAX in place and MIN in the tag's variant,
  // which no instance override carries.
  it("leaves the declaration unmapped where the instance cannot carry the read on its layers", async () => {
    const PLACED: FixtureElement = {
      slot: "tag",
      classes: "flex size-[30px] [align-self:var(--place,auto)] [align-items:var(--place,flex-start)]",
      children: [{ slot: "chip-dot", classes: "size-[8px]" }],
    };
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("tag", dotted)] }),
      rest({ slot: "chip", classes: "flex h-[80px] [--place:flex-end]", children: [PLACED] }),
      { inner: [{ manifest: dotted, cells: rest(PLACED) }] }
    );
    expect(outcomesOf(coverage, "[--place:flex-end]")).toEqual(["unmapped"]);
  });

  // In a Review row instance, the row's `items-end` already places the tag at the end, so the tag's
  // `align-self` repeats it. The tag's `justify-content` packs its dot at the end, which the tag
  // carries as a primaryAlign override, but the row instance holds the tag as a nested instance,
  // which carries no override.
  it("leaves the declaration unmapped where the row instance cannot carry the tag's override", async () => {
    const PLACED: FixtureElement = {
      slot: "tag",
      classes: "flex w-full h-[20px] [justify-content:var(--a,flex-start)] [align-self:var(--a,auto)]",
      children: [{ slot: "chip-dot", classes: "size-[8px]" }],
    };
    const row = chip({
      key: "review-row",
      name: "Review row",
      slot: "row",
      parts: [instanceOf("tag", dotted)],
    });
    const ROW: FixtureElement = { slot: "row", classes: "flex w-[100px] items-end", children: [PLACED] };
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("row", row)] }),
      rest({ slot: "chip", classes: "flex w-[200px] [--a:flex-end]", children: [ROW] }),
      {
        inner: [
          { manifest: dotted, cells: rest(PLACED) },
          { manifest: row, cells: rest(ROW) },
        ],
      }
    );
    expect(outcomesOf(coverage, "[--a:flex-end]")).toEqual(["unmapped"]);
  });
});

// Oracle: Figma's instance model and the coverage contract. An instance carries only the overrides
// `OVERRIDDEN_FIELD` lists and its own sizing, and a nested instance only TEXT values, so a read
// reaches Figma only where every instance up to the composite carries it. A declaration then has one
// row per its worst read: one unmapped row where a read reaches no field, and dropped only where
// every read repeats the variant.
describe("a declaration whose reads several instances decide", () => {
  const other = chip({ key: "review-other", name: "Review other", slot: "other" });
  const OTHER_PART = instanceOf("other", other);

  /** Build a chip that wins `classes` around a Review row instance holding the tag and the other instance. */
  function buildPair(classes: string, tagRoot: FixtureElement, otherRoot: FixtureElement) {
    const row = chip({ key: "review-row", name: "Review row", slot: "row", parts: [TAG, OTHER_PART] });
    const ROW: FixtureElement = { slot: "row", classes: "flex w-[100px]", children: [tagRoot, otherRoot] };
    return buildCaptured(
      chip({ parts: [instanceOf("row", row)] }),
      rest({ slot: "chip", classes, children: [ROW] }),
      {
        inner: [
          { manifest: tag, cells: rest(tagRoot) },
          { manifest: other, cells: rest(otherRoot) },
          { manifest: row, cells: rest(ROW) },
        ],
      }
    );
  }

  // The other instance's 8px margin adds a frame the row's variant lacks, so the row's layers differ.
  // The tag instance still carries its corner as an override and its width as its own sizing, but
  // the row instance holds it as a nested instance, which carries neither.
  it.each([
    { reads: "a corner", tagClasses: "rounded-[var(--corner,0px)]", declaration: "[--corner:4px]" },
    { reads: "a width", tagClasses: "w-[var(--w,20px)]", declaration: "[--w:30px]" },
  ])(
    "leaves $reads the tag carries unmapped where a sibling's frame changes the row's layers",
    async ({ tagClasses, declaration }) => {
      const { coverage } = await buildPair(
        `flex w-[200px] ${declaration} [--c:8px]`,
        { slot: "tag", classes: `flex size-[20px] ${tagClasses}` },
        { slot: "other", classes: "size-[20px] ms-[var(--c,0px)]" }
      );
      expect(outcomesOf(coverage, declaration)).toEqual(["unmapped"]);
    }
  );

  // The tag's frame pads its top 8px where the row's variant pads it 4px, but the left padding the
  // tag's start margin draws is 4px in both, so that margin repeats the variant.
  it("drops a margin whose side of the frame repeats the variant beside a margin that changes another side", async () => {
    const { coverage } = await buildPair(
      "flex w-[200px] [--a:4px] [--b:8px] [--c:8px]",
      { slot: "tag", classes: "flex size-[20px] ms-[var(--a,4px)] mt-[var(--b,4px)]" },
      { slot: "other", classes: "size-[20px] ms-[var(--c,0px)]" }
    );
    expect([
      outcomesOf(coverage, "[--a:4px]"),
      outcomesOf(coverage, "[--b:8px]"),
      outcomesOf(coverage, "[--c:8px]"),
    ]).toEqual([["dropped"], ["unmapped"], ["unmapped"]]);
  });

  // Row's `--alias` is Row's own declaration, which the tag reads for its start margin through
  // `--push`. The Row instance carries the spacing as an override, but the Holder instance holds it
  // as a nested instance, so both declarations the read reaches are unmapped.
  it("leaves the holding row's own declaration unmapped where an outer instance cannot carry its read", async () => {
    const PUSHED: FixtureElement = { slot: "tag", classes: "size-[20px] ms-[var(--alias,0px)]" };
    const row = chip({
      key: "review-row",
      name: "Review row",
      slot: "row",
      parts: [part({ key: "a", slot: "a" }), TAG],
    });
    const ROW: FixtureElement = {
      slot: "row",
      classes: "flex w-full [--alias:var(--push,0px)]",
      measured: { freeAlongMain: true },
      children: [{ slot: "a", classes: "size-[20px]" }, PUSHED],
    };
    const holder = chip({
      key: "review-holder",
      name: "Review holder",
      slot: "holder",
      parts: [instanceOf("row", row)],
    });
    const HOLDER: FixtureElement = { slot: "holder", classes: "flex flex-col w-[200px]", children: [ROW] };
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("holder", holder)] }),
      rest({ slot: "chip", classes: "flex w-[200px] [--push:auto]", children: [HOLDER] }),
      {
        inner: [
          { manifest: tag, cells: rest(PUSHED) },
          { manifest: row, cells: rest(ROW) },
          { manifest: holder, cells: rest(HOLDER) },
        ],
      }
    );
    expect([
      outcomesOf(coverage, "[--push:auto]"),
      outcomesOf(coverage, "[--alias:var(--push,0px)]"),
    ]).toEqual([["unmapped"], ["unmapped"]]);
  });

  // The chip draws the frame for the tag's margin, but the other instance's 8px least height differs
  // from its variant's 2px, which no instance field carries.
  it("gives one unmapped row for a declaration two sibling instances read", async () => {
    const { coverage } = await buildCaptured(
      chip({ parts: [TAG, OTHER_PART] }),
      rest({
        slot: "chip",
        classes: "flex w-[200px] [--g:8px]",
        children: [
          { slot: "tag", classes: "flex size-[20px] ms-[var(--g,0px)]" },
          { slot: "other", classes: "flex w-[20px] min-h-[var(--g,2px)]" },
        ],
      }),
      {
        inner: [
          { manifest: tag, cells: rest({ slot: "tag", classes: "flex size-[20px] ms-[var(--g,0px)]" }) },
          { manifest: other, cells: rest({ slot: "other", classes: "flex w-[20px] min-h-[var(--g,2px)]" }) },
        ],
      }
    );
    expect(outcomesOf(coverage, "[--g:8px]")).toEqual(["unmapped"]);
  });

  // No Figma padding takes a percentage (CSS Box Model 3 §4), so the padding read reaches no field,
  // whether the chip draws a frame for the margin read or the margin is zero and adds nothing.
  it.each([
    { gap: "8px", margin: "the chip draws the margin" },
    { gap: "0px", margin: "the margin adds nothing" },
  ])("gives one unmapped row where the mapper rejects one read and $margin", async ({ gap }) => {
    const SPACED: FixtureElement = {
      slot: "tag",
      classes: "flex ms-[var(--g,0px)] [padding-left:calc(5%_+_var(--g,2px))]",
    };
    const { coverage } = await buildCaptured(
      chip({ parts: [TAG] }),
      rest({ slot: "chip", classes: `flex w-[200px] [--g:${gap}]`, children: [SPACED] }),
      { inner: [{ manifest: tag, cells: rest(SPACED) }] }
    );
    expect(outcomesOf(coverage, `[--g:${gap}]`)).toEqual(["unmapped"]);
  });

  // Each branch's wrapper declares its own `--g`, two declarations of one class. The first tag reads
  // its wrapper's as a least height the tag's variant lacks, which no instance field carries. The second reads its
  // wrapper's as a margin the chip draws as a frame (CSS Flexbox 1 §4.2), so each keeps its own row.
  it("gives each captured declaration of one class its own row", async () => {
    const branch = (index: number, spacing: string) => {
      const manifest = part({
        key: `branch${index}`,
        slot: `branch${index}`,
        parts: [
          { ...part({ key: `wrapper${index}`, slot: "wrap" }), parts: [instanceOf(`tag${index}`, tag)] },
        ],
      });
      const element: FixtureElement = {
        slot: `branch${index}`,
        classes: "flex",
        children: [
          {
            slot: "wrap",
            classes: "flex [--g:8px]",
            children: [{ slot: "tag", classes: `flex w-[20px] ${spacing}` }],
          },
        ],
      };
      return { manifest, element };
    };
    const padded = branch(1, "min-h-[var(--g)]");
    const spaced = branch(2, "ms-[var(--g)]");
    const { coverage } = await buildCaptured(
      chip({ parts: [padded.manifest, spaced.manifest] }),
      rest({ slot: "chip", classes: "flex w-[200px]", children: [padded.element, spaced.element] }),
      { inner: [{ manifest: tag, cells: rest({ slot: "tag", classes: "flex w-[20px]" }) }] }
    );
    expect(
      outcomesOf(coverage, "[--g:8px]").toSorted((left = "", right = "") => left.localeCompare(right))
    ).toEqual(["literal", "unmapped"]);
  });

  // The other instance's 8px margin adds a frame the row's variant lacks, so the row's root layers
  // differ. The chip's `--d` leaves the wrapper's icon out (CSS Display 3 §2.5), so the wrapper holds
  // no layer where the row's variant holds the icon, which no override removes. At a 0px margin the
  // root's layers match and the diff names the wrapper's layers itself.
  it.each(["0px", "8px"])(
    "leaves an icon the composite hides unmapped beside a %s sibling margin",
    async (gap) => {
      const other = chip({ key: "review-other", name: "Review other", slot: "other" });
      const OTHER: FixtureElement = { slot: "other", classes: "size-[20px] ms-[var(--gap,0px)]" };
      const row = chip({
        key: "review-row",
        name: "Review row",
        slot: "row",
        parts: [part({ key: "wrap", slot: "wrap", iconsFor: () => [ICON] }), instanceOf("other", other)],
      });
      const ROW: FixtureElement = {
        slot: "row",
        classes: "flex w-[100px]",
        children: [
          {
            slot: "wrap",
            classes: "flex size-[25px]",
            children: [{ tag: "svg", classes: "size-4 text-[#000000] [display:var(--d,block)]" }],
          },
          OTHER,
        ],
      };
      const { coverage } = await buildCaptured(
        chip({ parts: [instanceOf("row", row)] }),
        rest({ slot: "chip", classes: `flex w-[200px] [--d:none] [--gap:${gap}]`, children: [ROW] }),
        {
          inner: [
            { manifest: other, cells: rest(OTHER) },
            { manifest: row, cells: rest(ROW) },
          ],
        }
      );
      expect(outcomesOf(coverage, "[--d:none]")).toEqual(["unmapped"]);
    }
  );

  // The tag instance swaps its CaretDown to the half-turn mirror the chip's `--turn` draws, since
  // Figma turns no layer inside an instance. A Review row instance holds the tag as a nested
  // instance, which carries only TEXT values, so it cannot carry the swap.
  it.each([
    { holder: "the chip", nested: false, outcome: "literal" },
    { holder: "a Review row instance", nested: true, outcome: "unmapped" },
  ])("gives a mirrored glyph $outcome where $holder holds the tag", async ({ nested, outcome }) => {
    const turning = chip({
      key: "review-tag",
      name: "Review tag",
      slot: "tag",
      iconsFor: () => [{ ...ICON, icon: "CaretDown", swapProperty: "Glyph" }],
      swapProperties: [{ name: "Glyph", defaultIcon: "CaretDown" }],
    });
    const TURNED: FixtureElement = {
      slot: "tag",
      classes: "flex size-[30px]",
      children: [{ tag: "svg", classes: "size-4 text-[#000000] [rotate:var(--turn,0deg)]" }],
    };
    const row = chip({
      key: "review-row",
      name: "Review row",
      slot: "row",
      parts: [instanceOf("tag", turning)],
    });
    const ROW: FixtureElement = { slot: "row", classes: "flex w-[100px]", children: [TURNED] };
    const { coverage } = await buildCaptured(
      chip({ parts: [nested ? instanceOf("row", row) : instanceOf("tag", turning)] }),
      rest({ slot: "chip", classes: "flex w-[200px] [--turn:180deg]", children: [nested ? ROW : TURNED] }),
      {
        inner: [
          { manifest: turning, cells: rest(TURNED) },
          ...(nested ? [{ manifest: row, cells: rest(ROW) }] : []),
        ],
      }
    );
    expect(outcomesOf(coverage, "[--turn:180deg]")).toEqual([outcome]);
  });

  // Row passes the tag a shadow whose color the chip's `--ink` sets. The tag instance carries the
  // shadow as an override, but the Row instance holds it as a nested instance, which carries none,
  // so every longhand of the passed class is unmapped.
  it("leaves every longhand of a passed shadow unmapped where the outer instance cannot carry it", async () => {
    const TAG_ROOT: FixtureElement = { slot: "tag", classes: "flex size-[20px]" };
    const SHADOWED: FixtureElement = {
      ...TAG_ROOT,
      classes: `${TAG_ROOT.classes} shadow-[0_0_4px_var(--ink,#000000)]`,
    };
    const row = chip({ key: "review-row", name: "Review row", slot: "row", parts: [TAG] });
    const ROW: FixtureElement = { slot: "row", classes: "flex w-[100px]", children: [SHADOWED] };
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("row", row)] }),
      rest({ slot: "chip", classes: "flex w-[200px] [--ink:#ff0000]", children: [ROW] }),
      {
        inner: [
          { manifest: tag, cells: rest(TAG_ROOT) },
          { manifest: row, cells: rest(ROW) },
        ],
      }
    );
    expect(
      notesOf(coverage, "shadow-[0_0_4px_var(--ink,#000000)]").map(([property, outcome]) => [
        property,
        outcome,
      ])
    ).toEqual([
      ["--tw-shadow", "unmapped"],
      ["box-shadow", "unmapped"],
    ]);
  });
});
