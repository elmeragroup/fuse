/**
 * Which set's coverage lists a declaration on an element of an instance part (#754). The unit under
 * test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets (`test/capture-fixtures.ts`).
 * Oracle: the coverage contract, under which the set whose own capture applies a declaration on the
 * same box of the element that stands for this one lists its rows, and the set that holds the
 * instance lists every other, so each declaration reaches exactly one set's coverage. Figma's instance
 * model decides each row's outcome: an instance carries an override of a fill and its own sizing, a
 * nested instance carries only TEXT values, and a fill the inner variant already draws repeats it.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, instanceOf, notesOf, part, rest } from "../../test/capture-fixtures";
import type { FixtureElement, Written } from "../../test/capture-fixtures";
import { makeVariableIndex } from "./css-values";

/** The inner set the cases place in a chip, directly or inside a Review row. */
const tag = chip({ key: "review-tag", name: "Review tag", slot: "tag" });
const TAG = instanceOf("tag", tag);

/** The chip's root, a row 200px wide that holds the children. */
const chipRoot = (children: readonly FixtureElement[]): FixtureElement => ({
  slot: "chip",
  classes: "flex w-[200px]",
  children,
});

/** A Review row set with the parts. */
const reviewRow = (fields: Parameters<typeof chip>[0]) =>
  chip({ key: "review-row", name: "Review row", slot: "row", ...fields });

// The tag carries `data-on:` in its own markup, and only the chip's markup turns it on, so the tag
// set's own capture holds no declaration of it and the chip owns the row.
describe("an inner set's own class that only the composite's markup turns on", () => {
  /** Build a chip that holds the tag, whose own capture carries `data-on:` but wins only `bg-[#ff0000]`. */
  const buildOn = (on: string) =>
    buildCaptured(
      chip({ parts: [TAG] }),
      rest(chipRoot([{ slot: "tag", classes: `size-[20px] bg-[#ff0000] ${on}` }])),
      {
        inner: [
          { manifest: tag, cells: rest({ slot: "tag", classes: "size-[20px] bg-[#ff0000]", carried: on }) },
        ],
      }
    );

  it("keeps a fill an override carries in the composite's coverage", async () => {
    const { coverage } = await buildOn("data-on:bg-[#0000ff]");
    expect(
      notesOf(coverage, "data-on:bg-[#0000ff]").map(([property, outcome]) => [property, outcome])
    ).toEqual([["background-color", "literal"]]);
  });

  it("drops a fill the tag's variant already draws", async () => {
    const { coverage } = await buildOn("data-on:bg-[#ff0000]");
    expect(notesOf(coverage, "data-on:bg-[#ff0000]")).toEqual([
      [
        "background-color",
        "dropped",
        "the instance's variant review-tag/state=rest draws the same, so the class repeats it",
      ],
    ]);
  });
});

// The row's capture leaves out the optional icon-like part `a` the inner sample shows first, as a
// menu row without an icon holds its shortcut first. Its `b` applies the same fill in both captures.
describe("an instance whose composite leaves out an optional part before another", () => {
  it("leaves the later part's own declaration to the inner set", async () => {
    const fill = "data-on:bg-[#ff0000]";
    const row = reviewRow({
      parts: [
        part({ key: "a", slot: "a", optional: { name: "A", defaultValue: true } }),
        part({ key: "b", slot: "b" }),
      ],
    });
    const rowRoot = (children: readonly FixtureElement[]): FixtureElement => ({
      slot: "row",
      classes: "flex",
      children,
    });
    const b: FixtureElement = { slot: "b", classes: `size-[20px] ${fill}` };
    const own = await buildCaptured(
      row,
      rest(rowRoot([{ slot: "a", classes: "size-[10px]", carried: fill }, b]))
    );
    const { coverage } = await buildCaptured(
      chip({ parts: [{ ...instanceOf("row", row), properties: () => ({ boolean: { A: false } }) }] }),
      rest(chipRoot([rowRoot([b])])),
      {
        inner: [
          {
            manifest: row,
            cells: rest(rowRoot([{ slot: "a", classes: "size-[10px]", carried: fill }, b])),
          },
        ],
      }
    );
    expect({
      row: notesOf(own.coverage, fill).map(([property, outcome]) => [property, outcome]),
      chip: notesOf(coverage, fill),
    }).toEqual({
      // `a` carries the class where it styles nothing, so the row's own coverage drops that too.
      row: [
        ["", "dropped"],
        ["background-color", "literal"],
      ],
      chip: [],
    });
  });
});

// The chip holds a Review row that holds the tag. A declaration belongs to the innermost set whose
// own capture applies it at the tag, and to the chip where neither the tag's nor the row's does.
describe("a declaration on a nested instance that only the outermost markup turns on", () => {
  const row = reviewRow({ parts: [TAG] });

  /** Build the chip, whose tag is `chipTag`, around a row whose root carries `rowCarried`. */
  const buildNested = (tagRoot: FixtureElement, rowCarried: string, chipTag: FixtureElement) => {
    const rowRoot = (child: FixtureElement): FixtureElement => ({
      slot: "row",
      classes: "flex",
      carried: rowCarried,
      children: [child],
    });
    return buildCaptured(chip({ parts: [instanceOf("row", row)] }), rest(chipRoot([rowRoot(chipTag)])), {
      inner: [
        { manifest: tag, cells: rest(tagRoot) },
        { manifest: row, cells: rest(rowRoot(tagRoot)) },
      ],
    });
  };

  it("lists the tag's own variant in the chip's coverage", async () => {
    const on = "data-on:bg-[#ff0000]";
    const tagRoot: FixtureElement = { slot: "tag", classes: "size-[20px] bg-[#ff0000]", carried: on };
    const { coverage } = await buildNested(tagRoot, "", {
      ...tagRoot,
      classes: `size-[20px] bg-[#ff0000] ${on}`,
    });
    expect(notesOf(coverage, on)).toEqual([
      [
        "background-color",
        "dropped",
        "the instance's variant review-tag/state=rest draws the same, so the class repeats it",
      ],
    ]);
  });

  it("lists the row's own variant in the chip's coverage", async () => {
    const on = "data-on:*:bg-[#00ff00]";
    const tagRoot: FixtureElement = { slot: "tag", classes: "size-[20px] bg-[#00ff00]" };
    const { coverage } = await buildNested(tagRoot, on, { ...tagRoot, fromParent: on });
    expect(notesOf(coverage, on)).toEqual([
      [
        "background-color",
        "dropped",
        "the instance's variant review-tag/state=rest draws the same, so the class repeats it",
      ],
    ]);
  });

  // The row's `*:` class sets the tag's fill in the row's own capture too, so the row's coverage
  // lists it, where the tag instance carries the fill as an override, and the chip lists none.
  it("leaves a holder's class its own capture applies to the holder's coverage", async () => {
    const all = "*:bg-[#00ff00]";
    const tagRoot: FixtureElement = { slot: "tag", classes: "size-[20px]" };
    const rowRoot: FixtureElement = {
      slot: "row",
      classes: "flex w-[100px]",
      carried: all,
      children: [{ ...tagRoot, fromParent: all }],
    };
    const inner = [{ manifest: tag, cells: rest(tagRoot) }];
    const held = await buildCaptured(row, rest(rowRoot), { inner });
    const holder = await buildCaptured(chip({ parts: [instanceOf("row", row)] }), rest(chipRoot([rowRoot])), {
      inner: [...inner, { manifest: row, cells: rest(rowRoot) }],
    });
    expect({
      row: notesOf(held.coverage, all).map(([property, outcome]) => [property, outcome]),
      chip: notesOf(holder.coverage, all),
    }).toEqual({ row: [["background-color", "literal"]], chip: [] });
  });
});

// Oracle: CSS Pseudo-Elements 4 §3, under which an element's `::before` is a box of its own, so a
// declaration on it and the same declaration on the element are two declarations.
describe("a declaration on a pseudo-element and the same one on its host", () => {
  // The `::before` fill is the tag's own, a read in place the kit cannot draw, so it lands unmapped
  // naming the instance; the host's fill is the chip's, which the instance carries as an override.
  it("lists the composite's fill on the host where the inner set applies it on `::before`", async () => {
    const fill = "bg-[#00ff00]";
    const { coverage } = await buildCaptured(
      chip({ parts: [TAG] }),
      rest(
        chipRoot([{ slot: "tag", classes: `size-[20px] ${fill}`, pseudo: { before: { classes: fill } } }])
      ),
      {
        inner: [
          {
            manifest: tag,
            cells: rest({ slot: "tag", classes: "size-[20px]", pseudo: { before: { classes: fill } } }),
          },
        ],
      }
    );
    expect(notesOf(coverage, fill)).toEqual([
      ["background-color", "literal", "rgba(0, 255, 0, 1)"],
      [
        "background-color",
        "unmapped",
        "in the tag instance, the kit draws no layer for the `::before` pseudo-element, whose background-color paints",
      ],
    ]);
  });

  it("lists the composite's `::before` declaration where the inner set applies it on the host", async () => {
    const reset: Written = { className: "fuse.css base layer", property: "padding-left", value: "0" };
    const own: FixtureElement = { slot: "tag", classes: "size-[20px]", written: [reset] };
    const { coverage } = await buildCaptured(
      chip({ parts: [TAG] }),
      rest(chipRoot([{ ...own, pseudo: { before: { written: [reset] } } }])),
      { inner: [{ manifest: tag, cells: rest(own) }] }
    );
    expect(notesOf(coverage, reset.className)).toEqual([
      [
        "padding-left",
        "dropped",
        "the `::before` pseudo-element paints nothing: its content is empty and it sets no fill, border, shadow or outline",
      ],
    ]);
  });
});

// Oracle: the selector Tailwind compiles a `space-x-*` class to, `:where(.x > :not(:last-child))`,
// which styles every child of the class's element but the last (Selectors 4 §14.3). Only the chip's
// first part wins the row's spacing; in the row's own capture no child does. An instance carries no
// item spacing, so the row is unmapped either way: the case decides whose row it is, the chip's own
// rather than a read of the row instance's.
describe("a row's child spacing that only the composite's markup turns on", () => {
  it("lists the spacing as the composite's own row", async () => {
    const spacing: Written = {
      className: "spaced",
      property: "margin-inline-end",
      value: "4px",
      selector: ":where(.spaced > :not(:last-child))",
      specificity: [0, 0, 0],
    };
    const row = reviewRow({ parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] });
    const rowRoot = (a: FixtureElement): FixtureElement => ({
      slot: "row",
      classes: "flex",
      carried: "spaced",
      children: [a, { slot: "b", classes: "size-[20px]" }],
    });
    // The rule reaches `a` in both captures. Its `:where()` adds no specificity, so the standalone
    // row's `me-0` on `a` outranks it there, and in the chip, whose `a` carries no `me-0`, the rule wins.
    const a = (classes: string): FixtureElement => ({ slot: "a", classes, writtenFromParent: [spacing] });
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("row", row)] }),
      rest(chipRoot([rowRoot(a("size-[20px]"))])),
      { inner: [{ manifest: row, cells: rest(rowRoot(a("size-[20px] me-0"))) }] }
    );
    expect(notesOf(coverage, "spaced")).toEqual([
      ["margin-inline-end", "unmapped", "the kit draws no margin between a box's children"],
    ]);
  });
});

// A row holds its label's text in a `<span>`, which a class of the row styles. A static frame has no
// pointer, so the cursor drops.
describe("a label span's declaration that only the composite's markup turns on", () => {
  it("lists it in the composite's coverage", async () => {
    const on = "data-on:*:cursor-not-allowed";
    const row = reviewRow({
      label: { key: "label", name: "label", characters: "Label", textProperty: "Label", shownIn: () => true },
    });
    const rowRoot = (span: FixtureElement): FixtureElement => ({
      slot: "row",
      classes: "flex font-sans text-[14px] leading-[20px] text-[#ff0000]",
      carried: on,
      children: [{ tag: "span", text: "Label", textIndex: 0, ...span }],
    });
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("row", row)] }),
      rest(chipRoot([rowRoot({ fromParent: on })])),
      {
        inner: [{ manifest: row, cells: rest(rowRoot({ classes: "text-[#ff0000]" })) }],
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    expect(notesOf(coverage, on)).toEqual([["cursor", "dropped", "a static frame has no pointer"]]);
  });
});

// The tag's own sample hides its dot, or an element around the dot, with `hidden`. Check 8 skips a
// hidden element and everything below it in the tag's own capture (CSS Display 3 §2.5: `display: none`
// generates no box for the element or anything below it), so the tag accounts for none of the dot's
// declarations, and the chip, whose tag shows the dot, lists them. The tag's own coverage keeps only
// the `hidden` that hides the dot.
describe("an inner element that the inner set's own sample hides", () => {
  const fill = "bg-[#00ff00]";
  const size = "size-[8px]";
  const dotTag = chip({ key: "review-tag", name: "Review tag", slot: "tag", parts: [part()] });

  /**
   * Build the tag on its own, whose sample holds `own`, and a chip around it, whose tag holds
   * `shown`, with the properties each set's coverage lists for the dot's classes.
   */
  const buildHidden = async (own: FixtureElement, shown: FixtureElement) => {
    const tagRoot = (child: FixtureElement): FixtureElement => ({
      slot: "tag",
      classes: "flex size-[20px]",
      children: [child],
    });
    const alone = await buildCaptured(dotTag, rest(tagRoot(own)));
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("tag", dotTag)] }),
      rest(chipRoot([tagRoot(shown)])),
      {
        inner: [{ manifest: dotTag, cells: rest(tagRoot(own)) }],
      }
    );
    const listed = (rows: typeof coverage) =>
      [fill, size, "hidden"].flatMap((className) =>
        notesOf(rows, className).map(([property]) => `${className} ${String(property)}`)
      );
    return { tag: listed(alone.coverage), chip: listed(coverage) };
  };
  const dot: FixtureElement = { slot: "chip-dot", classes: `${size} ${fill}` };
  const chipOwns = ["bg-[#00ff00] background-color", "size-[8px] height", "size-[8px] width"];

  it.each([
    ["the dot itself", { ...dot, classes: `hidden ${size} ${fill}` }, dot, ["hidden display"]],
    [
      "the element around the dot",
      { tag: "div", classes: "hidden", children: [dot] },
      { tag: "div", classes: "flex", children: [dot] },
      [],
    ],
  ])(
    "lists the dot's declarations in the chip's coverage alone where the tag hides %s",
    async (_, own, shown, tag) => {
      expect(await buildHidden(own, shown)).toEqual({ tag, chip: chipOwns });
    }
  );

  // Control: the tag's own sample shows the dot, so the tag lists its declarations and the chip none.
  it("leaves a shown dot's declarations to the inner set (control)", async () => {
    expect(await buildHidden(dot, dot)).toEqual({ tag: chipOwns, chip: [] });
  });

  // Both captures hide the tag's `::before`, so the tag's row that says it generates no box is the
  // only one.
  it("leaves a `::before` both captures hide to the inner set", async () => {
    const tag = chip({ key: "review-tag", name: "Review tag", slot: "tag" });
    const hidden: FixtureElement = {
      slot: "tag",
      classes: "size-[20px]",
      pseudo: { before: { classes: `hidden ${fill}` } },
    };
    const alone = await buildCaptured(tag, rest(hidden));
    const { coverage } = await buildCaptured(chip({ parts: [TAG] }), rest(chipRoot([hidden])), {
      inner: [{ manifest: tag, cells: rest(hidden) }],
    });
    const listed = (rows: typeof coverage) =>
      ["hidden", fill].flatMap((className) => notesOf(rows, className).map(([property]) => property));
    expect({ tag: listed(alone.coverage), chip: listed(coverage) }).toEqual({
      tag: ["display", "background-color"],
      chip: [],
    });
  });
});

// Tailwind's preflight gives a `<button>` `color: inherit`. In the tag's own sample nothing above it
// sets a color, so it computes to the initial color, a reset the tag's own build leaves out; in the
// chip it inherits the chip's red, so it sets something and the chip lists it.
describe("a preflight declaration that resets the longhand only in the inner set's own sample", () => {
  const inherit: Written = {
    className: "tailwind preflight",
    property: "color",
    value: "inherit",
    source: "preflight",
    selector: "button",
  };
  const button: FixtureElement = { tag: "button", slot: "tag", classes: "size-[20px]", written: [inherit] };

  /** Build a red chip around the tag, whose own sample computes `color` to its initial value or not. */
  const buildReset = (initial: readonly string[]) =>
    buildCaptured(
      chip({ parts: [TAG] }),
      rest({ ...chipRoot([button]), classes: "flex w-[200px] text-[#ff0000]" }),
      { inner: [{ manifest: tag, cells: rest({ ...button, initial }) }] }
    );

  it("lists the declaration in the chip's coverage", async () => {
    const { coverage } = await buildReset(["color"]);
    expect(notesOf(coverage, inherit.className).map(([property]) => property)).toEqual(["color"]);
  });

  // Control: where the tag's own sample computes another color, the tag lists the row and the chip none.
  it("leaves it to the inner set where its own sample sets a color with it (control)", async () => {
    const { coverage } = await buildReset([]);
    expect(notesOf(coverage, inherit.className)).toEqual([]);
  });
});

// The row's sample holds `b` in an unslotted wrapper. The chip's markup adds an unslotted `<div>`
// before that wrapper, or the row's sample holds one the chip leaves out, so a wrapper's place among
// its tag's siblings pairs the wrong wrappers. `b`'s fill is the row's own in both captures.
describe("an unslotted wrapper that only one capture holds before another", () => {
  const fill = "bg-[#ff0000]";
  const row = reviewRow({ parts: [part({ key: "b", slot: "b" })] });
  const rowRoot = (children: readonly FixtureElement[]): FixtureElement => ({
    slot: "row",
    classes: "flex",
    children,
  });
  const wrapper: FixtureElement = {
    tag: "div",
    classes: "flex",
    children: [{ slot: "b", classes: `size-[20px] ${fill}` }],
  };
  const extra: FixtureElement = { tag: "div", classes: "size-[4px]" };

  /** Build the row on its own and a chip around it, from the row's children in each capture. */
  const buildWrapped = async (own: readonly FixtureElement[], composite: readonly FixtureElement[]) => {
    const alone = await buildCaptured(row, rest(rowRoot(own)));
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("row", row)] }),
      rest(chipRoot([rowRoot(composite)])),
      {
        inner: [{ manifest: row, cells: rest(rowRoot(own)) }],
      }
    );
    return {
      row: notesOf(alone.coverage, fill).map(([property, outcome]) => [property, outcome]),
      chip: notesOf(coverage, fill),
    };
  };

  it.each([
    ["the chip's markup adds another wrapper", [wrapper], [extra, wrapper]],
    ["the row's sample holds another wrapper", [extra, wrapper], [wrapper]],
    ["neither capture holds another wrapper (control)", [wrapper], [wrapper]],
  ])("leaves the wrapped part's fill to the inner set where %s", async (_, own, composite) => {
    expect(await buildWrapped(own, composite)).toEqual({
      row: [["background-color", "literal"]],
      chip: [],
    });
  });

  // The row's sample wraps `a` then `b`; the chip's markup adds an empty `<div>` before the wrapper
  // and renders `b` first. The wrapper still holds `a` and `b` once each, so it is the row's wrapper.
  it("leaves a part's fill to the inner set where the composite reorders the wrapper's parts", async () => {
    const reordered = reviewRow({ parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] });
    const a: FixtureElement = { slot: "a", classes: `size-[20px] ${fill}` };
    const b: FixtureElement = { slot: "b", classes: "size-[20px]" };
    const holding = (children: readonly FixtureElement[]): FixtureElement => ({
      tag: "div",
      classes: "flex",
      children,
    });
    const own = rowRoot([holding([a, b])]);
    const alone = await buildCaptured(reordered, rest(own));
    const { coverage } = await buildCaptured(
      chip({ parts: [instanceOf("row", reordered)] }),
      rest(chipRoot([rowRoot([{ tag: "div" }, holding([b, a])])])),
      { inner: [{ manifest: reordered, cells: rest(own) }] }
    );
    expect({
      row: notesOf(alone.coverage, fill).map(([property, outcome]) => [property, outcome]),
      chip: notesOf(coverage, fill),
    }).toEqual({ row: [["background-color", "literal"]], chip: [] });
  });
});
