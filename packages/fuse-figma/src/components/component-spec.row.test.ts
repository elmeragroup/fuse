/**
 * Build rules Item's row is the first set to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { FILL, HUG } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf, ICON } from "../../test/fixture-sets";
import { heightBounds } from "./box-sizing";
import type { PartDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";

/** The outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.part, row.outcome, row.detail]);

/** The bytes a fixture image shows: the PNG signature, which the build carries without decoding. */
const PICTURE = (): Uint8Array => Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

/** An `<img>` with no `data-slot` and no class of its own, as a consumer puts in Item's media. */
const IMG: PartDefinition = {
  key: "image",
  slot: undefined,
  element: { tag: "img", attributes: {} },
  shownIn: () => true,
  classesFor: () => "",
  label: undefined,
  iconsFor: () => [],
  image: PICTURE,
};

// Oracle: Tailwind compiles `[&_img]:size-full` to `.… img`, which matches each `<img>` inside the
// box that carries the class at (0,1,1), so it sizes and fits a picture that carries no class of its
// own. An image box with `object-fit: cover` draws as an image paint at FILL.
describe("a class that styles an `<img>` part through `[&_img]:`", () => {
  it("fills the box with the picture the `<img>` shows", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex size-[40px] overflow-hidden [&_img]:size-full [&_img]:object-cover", { parts: [IMG] })
    );
    const image = frameOf(variant?.root);
    expect(image?.sizing).toEqual({ horizontal: FILL, vertical: FILL });
    expect(image?.fill).toMatchObject({ kind: "image", scaleMode: "FILL" });
    expect(
      new Set(
        coverage
          .filter((row) => row.className.startsWith("[&_img]:"))
          .map((row) => `${row.part} ${row.property} ${row.outcome}`)
      )
    ).toEqual(new Set(["chip width literal", "chip height literal", "chip object-fit literal"]));
  });

  // `.… img` matches an `<img>` at any depth, so a picture inside another part takes the classes too.
  it("styles an `<img>` nested in another part as it styles a direct one", async () => {
    const own = (key: string): PartDefinition => ({ ...IMG, key, classesFor: () => "size-[8px]" });
    const { variant } = await buildFixture(
      chip("flex [&_img]:object-cover [&_img]:rounded-[4px]", {
        parts: [own("image"), { ...dot("flex"), parts: [own("nested")] }],
      })
    );
    const [direct, wrapper] = variant?.root.children ?? [];
    const nested = wrapper?.kind === "frame" ? frameOf(wrapper) : undefined;
    for (const image of [direct?.kind === "frame" ? direct : undefined, nested]) {
      expect([image?.cornerRadius, image?.fill]).toEqual([
        { kind: "literal", value: 4 },
        expect.objectContaining({ kind: "image", scaleMode: "FILL" }),
      ]);
    }
  });

  it("leaves the class unmapped where the definition draws no `<img>` below the box", async () => {
    const { coverage } = await buildFixture(chip("flex size-[40px] [&_img]:size-full"));
    expect(
      coverage.filter((row) => row.className === "[&_img]:size-full").map((row) => [row.outcome, row.detail])
    ).toEqual([
      ["unmapped", "the definition draws no `<img>` part below chip"],
      ["unmapped", "the definition draws no `<img>` part below chip"],
    ]);
  });
});

// Oracle: CSS Box Alignment 3 §6.1, where a flex item's `align-self` places it across the row in place
// of the row's `align-items`, as Item's `item-described:self-start` tops the media and the content
// beside a description while the actions keep the row's center. A Figma auto layout aligns all its
// layers one way, so the row takes the alignment its layers ask for. A layer that sets none draws
// where CSS draws it only stretched across the row, and only where it is no taller than the layers
// that set one, so any other leaves the row's `align-items` unmapped.
describe("a part's own alignment across its row", () => {
  const RING = (classes: string): PartDefinition => ({ ...dot(classes), key: "ring", slot: "chip-ring" });

  it("aligns the row as every layer asks", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex items-center", { parts: [dot("size-[8px] self-start"), RING("size-[4px] self-start")] })
    );
    expect(variant?.root.counterAlign).toBe("MIN");
    expect(notesOf(coverage, "self-start")).toEqual([
      ["chip-dot", "literal", "at the start of the counter axis, where the row places its layers"],
      ["chip-ring", "literal", "at the start of the counter axis, where the row places its layers"],
    ]);
    expect(notesOf(coverage, "items-center")).toEqual([
      ["chip", "dropped", "every layer of the row sets its own `align-self`"],
    ]);
  });

  // Oracle: PF, where a real file stretched a frame that filled down a hugging row to the height its
  // other layers set, and the frame centred its text, which draws a box CSS centres on the row once
  // the box paints nothing and centres its own layers the same way.
  it("stretches a layer that sets no alignment across the row, centring what it holds as the row centres it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex items-center", { parts: [dot("size-[8px] self-start"), RING("flex items-center")] })
    );
    const ring = variant?.root.children[1];
    expect([variant?.root.counterAlign, ring?.kind === "frame" && ring.sizing.vertical]).toEqual([
      "MIN",
      FILL,
    ]);
    expect(ring?.kind === "frame" && ring.counterAlign).toBe("CENTER");
    // The row settles its alignment once its layers map, so its row follows the ring's.
    expect(notesOf(coverage, "items-center")).toEqual([
      ["chip-ring", "literal", "centered on the counter axis"],
      [
        "chip",
        "literal",
        "chip-ring stretches across the counter axis and places its layers centered on it, where CSS places it centered on the counter axis",
      ],
    ]);
  });

  /** What the row's `align-items` row says where a layer that sets no alignment cannot stretch. */
  const UNSTRETCHED =
    "Figma aligns a row's layers one way, so chip-ring can sit centered on the counter axis only by stretching across it, which draws what CSS draws only for a layer that paints nothing, places its own layers so and is no taller than the layers that set `align-self`";

  // CSS centres the 4px ring on the 8px row at 2px from its top, which no alignment of the row draws.
  it("leaves the row's alignment unmapped where a layer with a height of its own cannot stretch", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex items-center", { parts: [dot("size-[8px] self-start"), RING("size-[4px]")] })
    );
    expect(variant?.root.counterAlign).toBe("MIN");
    expect(notesOf(coverage, "items-center")).toEqual([["chip", "unmapped", UNSTRETCHED]]);
  });

  // CSS makes the row 40px tall, as tall as the ring's content, and tops the 8px dot in it. Stretched,
  // the ring would take the 8px the dot sets (PF) and push its 40px content out of it.
  it("leaves the row's alignment unmapped where a layer's content is taller than the layers that set one", async () => {
    const tall: PartDefinition = { ...dot("size-[40px]"), key: "inner", slot: "chip-inner" };
    const { variant, coverage } = await buildFixture(
      chip("flex items-center", {
        parts: [dot("size-[8px] self-start"), { ...RING("flex items-center"), parts: [tall] }],
      })
    );
    const ring = variant?.root.children[1];
    expect(ring?.kind === "frame" && ring.sizing.vertical).toEqual({ kind: "hug" });
    expect(notesOf(coverage, "items-center")).toEqual([
      ["chip-ring", "literal", "centered on the counter axis"],
      ["chip", "unmapped", UNSTRETCHED],
    ]);
  });

  // Oracle: the arithmetic of each variable's values across its modes, and CSS Inline 3 §4.4, where a
  // unitless line height is that share of the font size. A layer at least as tall in every mode as
  // the ring's content at its tallest holds the ring's content inside the row it sets, so the
  // stretched ring centres it where CSS does; content that can outgrow that layer in some mode
  // cannot stretch. A dot of `h-(--tall)`, 20px or 24px, is at least 20px tall, and one line of
  // `text-(length:--size)/normal` over 14px or 16px at least 21px. A `max-h-(--low)` of 12px or 16px
  // holds a dot around a 40px layer to 12px in one mode, and a `min-h-(--low)` raises an empty dot to
  // no more than that there, so neither keeps a 14px content inside the row.
  describe("against heights a variable sets", () => {
    const variables = makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
      {
        ref: { collection: "Fuse density", name: "tall" },
        webSyntax: "var(--tall)",
        minimum: 20,
        maximum: 24,
      },
      {
        ref: { collection: "Fuse density", name: "size" },
        webSyntax: "var(--size)",
        minimum: 14,
        maximum: 16,
      },
      { ref: { collection: "Fuse density", name: "low" }, webSyntax: "var(--low)", minimum: 12, maximum: 16 },
      {
        ref: { collection: "Fuse density", name: "high" },
        webSyntax: "var(--high)",
        minimum: 16,
        maximum: 24,
      },
      {
        ref: { collection: "Fuse density", name: "floor" },
        webSyntax: "var(--floor)",
        minimum: 12,
        maximum: 32,
      },
      { ref: { collection: "Fuse density", name: "cap" }, webSyntax: "var(--cap)", minimum: 16, maximum: 24 },
    ]);
    const TALL_DOT = dot("w-[8px] h-(--tall) self-start");
    const LINE_DOT: PartDefinition = {
      ...dot("flex font-sans text-[#000000] text-(length:--size)/normal self-start"),
      label: { key: "label", name: "label", characters: "Dot", textProperty: undefined, shownIn: () => true },
    };
    const holding = (setter: PartDefinition, content: string) =>
      chip("flex items-center", {
        parts: [
          setter,
          {
            ...RING("flex items-center"),
            parts: [{ ...dot(`w-[4px] ${content}`), key: "inner", slot: "chip-inner" }],
          },
        ],
      });

    it.each([
      ["a bound height", TALL_DOT, "h-(--low)"],
      ["a line over a bound font size", LINE_DOT, "h-[20px]"],
    ])("stretches the ring where %s is never shorter than its content", async (_setter, setter, content) => {
      const { variant, coverage } = await buildFixture(holding(setter, content), { variables });
      const ring = variant?.root.children[1];
      expect(ring?.kind === "frame" && ring.sizing.vertical).toEqual(FILL);
      expect(notesOf(coverage, "items-center").find(([part]) => part === "chip")?.[1]).toBe("literal");
    });

    it.each([
      ["a bound height", TALL_DOT, "h-(--high)"],
      ["a line over a bound font size", LINE_DOT, "h-[22px]"],
      [
        "a bound max height",
        {
          ...dot("flex w-[8px] max-h-(--low) self-start"),
          parts: [{ ...dot("w-[8px] h-[40px]"), key: "tall", slot: "chip-tall" }],
        },
        "h-[14px]",
      ],
      ["a bound min height", dot("w-[8px] min-h-(--low) self-start"), "h-[14px]"],
      [
        "a 24px height, beside content whose minimum outgrows its maximum in one mode,",
        dot("w-[8px] h-[24px] self-start"),
        "min-h-(--floor) max-h-(--cap)",
      ],
    ])(
      "leaves the row's alignment unmapped where %s can be shorter than its content",
      async (_setter, setter, content) => {
        const { coverage } = await buildFixture(holding(setter, content), { variables });
        expect(notesOf(coverage, "items-center").find(([part]) => part === "chip")).toEqual([
          "chip",
          "unmapped",
          UNSTRETCHED,
        ]);
      }
    );

    // Oracle: CSS 2.1 §10.7, where a minimum above the maximum wins. A `min-h-(--floor)` of 12px or 32px
    // over a `max-h-(--cap)` of 16px or 24px holds an empty box to 12px in the first mode and raises it
    // to 32px in the second.
    it("bounds a box whose minimum outgrows its maximum in one mode by the minimum", async () => {
      const { variant } = await buildFixture(
        chip("flex", { parts: [dot("w-[4px] min-h-(--floor) max-h-(--cap)")] }),
        { variables }
      );
      expect(heightBounds(variant?.root.children[0], variables)).toEqual({ min: 12, max: 32 });
    });
  });

  it("leaves two alignments a row cannot draw at once unmapped", async () => {
    const { coverage } = await buildFixture(
      chip("flex items-center", { parts: [dot("size-[8px] self-start"), RING("size-[4px] self-end")] })
    );
    expect(
      new Set(coverage.filter((row) => row.property === "align-self").map((row) => row.outcome))
    ).toEqual(new Set(["unmapped"]));
  });
});

// Oracle: CSS Flexbox 1 §9.3, where a wrapping row breaks a line only where its layers' hypothetical
// widths overflow it. A layer with `flex: 1` starts from a zero basis, so it takes what the others
// leave and breaks no line until the others and its narrowest content overflow the row, while a
// Figma row never wraps. A row of layers with widths of their own can break wherever they overflow.
// A row that hugs its width is as wide as its layers on one line (CSS Sizing 3 §5.1) only where the
// width CSS makes available to it is unbounded: a `max-width` of its own or of a box around it, a
// box of fixed width around it, which narrows a flex item to its width (CSS Flexbox 1 §9.7) or caps a
// column's item at its own (§9.4), a grid's track, against which its item sizes (CSS Grid 1 §6.2),
// and the containing block of an absolute box (CSS 2.1 §10.3.7) can each make it narrower than its
// layers, while Figma draws it hugging them all the same. So can its own `min-content` width (CSS
// Sizing 3 §5.1), which no Figma sizing reads.
describe("a row that wraps", () => {
  const RING: PartDefinition = { ...dot("size-[8px]"), key: "ring", slot: "chip-ring" };
  const HUGGING =
    "the row hugs its layers and nothing bounds the width CSS gives it, so it never runs out of room to break a line, and a Figma row never wraps";
  /** A wrapping row of two layers of the given width, as a part. */
  const wrapping = (classes: string, width: number): PartDefinition => ({
    ...dot(classes),
    key: "row",
    slot: "chip-row",
    parts: [
      { ...dot(`w-[${width}px] h-[8px]`), key: "first", slot: "chip-first" },
      { ...dot(`w-[${width}px] h-[8px]`), key: "second", slot: "chip-second" },
    ],
  });

  it.each([
    [
      "a row of fixed width, which narrows it",
      chip("flex w-[100px]", { parts: [wrapping("flex flex-wrap", 80)] }),
    ],
    [
      "a column of fixed width that starts its items, which caps it",
      chip("flex flex-col items-start w-[12px]", { parts: [wrapping("flex flex-wrap", 8)] }),
    ],
    [
      "the containing block of an absolute part",
      chip("relative flex", { parts: [wrapping("absolute top-0 left-0 flex flex-wrap", 8)] }),
    ],
    ["a 12px grid track", chip("grid grid-cols-[12px]", { parts: [wrapping("flex flex-wrap", 8)] })],
    [
      "a 100px grid track that a grid centers",
      chip("grid grid-cols-[100px] place-content-center", { parts: [wrapping("flex flex-wrap", 80)] }),
    ],
  ])("leaves `flex-wrap` unmapped on a hugging row inside %s", async (_bound, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(notesOf(coverage, "flex-wrap").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });

  it("leaves `flex-wrap` unmapped on a row whose width is its min-content, which no sizing reads", async () => {
    const { coverage } = await buildFixture(
      chip("flex flex-wrap w-min", {
        parts: [
          { ...dot("w-[80px] h-[8px]"), key: "first", slot: "chip-first" },
          { ...dot("w-[80px] h-[8px]"), key: "second", slot: "chip-second" },
        ],
      })
    );
    expect(notesOf(coverage, "flex-wrap").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });

  it("drops `flex-wrap` where the row hugs its width and nothing bounds it", async () => {
    const { coverage } = await buildFixture(chip("flex flex-wrap", { parts: [dot("size-[8px]"), RING] }));
    expect(notesOf(coverage, "flex-wrap")).toEqual([["chip", "dropped", HUGGING]]);
  });

  it.each([
    ["its own max-width", chip("flex flex-wrap max-w-[12px]", { parts: [dot("size-[8px]"), RING] })],
    [
      "the max-width of a hugging box around it",
      chip("flex max-w-[12px]", {
        parts: [{ ...dot("flex flex-wrap"), parts: [{ ...RING, key: "inner" }, RING] }],
      }),
    ],
  ])("leaves `flex-wrap` unmapped on a hugging row that %s caps", async (_cap, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(notesOf(coverage, "flex-wrap").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });

  it("drops `flex-wrap` where one layer grows to fill the row's fixed width", async () => {
    const { coverage } = await buildFixture(
      chip("flex flex-wrap w-[100px]", { parts: [dot("flex-1 h-[8px]"), RING] })
    );
    expect(notesOf(coverage, "flex-wrap")).toEqual([
      [
        "chip",
        "dropped",
        "the one layer that grows takes what the row's other layers leave, so the row breaks no line until they overflow it, and a Figma row never wraps",
      ],
    ]);
  });

  it("leaves `flex-wrap` unmapped on a row with no layer that grows", async () => {
    const { coverage } = await buildFixture(chip("flex flex-wrap w-[100px]", { parts: [RING] }));
    expect(notesOf(coverage, "flex-wrap").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Flexbox 1 §5.4. A flex box lays its items out in order-modified document order: by
// `order`, lowest first, with document order breaking ties, as Command's search addon follows its
// input in the DOM and draws first through `order-first`. Figma draws its layers in list order, so a
// row whose parts carry `order` lists them so. Outside a flex box `order` places nothing, and beside a
// label or an icon, which take no `order` here, the builder leaves it unread.
describe("a part's `order` in its row", () => {
  const RING = (classes: string) => ({ ...dot(classes), key: "ring", slot: "chip-ring" });
  const keysOf = (layers: readonly { readonly key: string }[] | undefined) =>
    layers?.map((layer) => layer.key);

  it("lists the parts in order-modified document order, and reads each `order` it sorts by", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex", { parts: [dot("size-[4px]"), RING("size-[8px] order-first")] })
    );
    expect(keysOf(variant?.root.children)).toEqual(["ring", "dot"]);
    expect(notesOf(coverage, "order-first")).toEqual([
      ["chip-ring", "literal", "the layer sits first in the row's order-modified document order"],
    ]);
  });

  it("keeps document order among parts of equal `order`", async () => {
    const { variant } = await buildFixture(
      chip("flex", {
        parts: [
          dot("size-[4px] order-last"),
          RING("size-[8px] order-last"),
          { ...dot("size-[2px]"), key: "pin", slot: "chip-pin" },
        ],
      })
    );
    expect(keysOf(variant?.root.children)).toEqual(["pin", "dot", "ring"]);
  });

  it.each([
    ["outside a flex box", chip("block", { parts: [dot("size-[4px]"), RING("size-[8px] order-first")] })],
    [
      "beside the box's own icon",
      chip("flex text-[rgb(0_0_0)]", {
        iconsFor: () => [{ ...ICON, classes: "size-4" }],
        parts: [RING("size-[8px] order-first")],
      }),
    ],
  ])("keeps document order and leaves `order` unmapped %s", async (_name, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(notesOf(coverage, "order-first").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: Tailwind compiles `[&>input]:pr-[6px]` to `.… > input`, which matches an `<input>` that is
// a direct child of the box and nothing deeper, as Input group's root pads its own control beside a
// trailing addon. The builder knows a part's tag only where the definition declares it.
describe("a class that styles a direct `<input>` child through `[&>input]:`", () => {
  const UNTAGGED = { ...dot("h-[8px] w-[40px]"), key: "control", slot: "chip-control" };
  const CONTROL = { ...UNTAGGED, tag: "input" };

  it("styles a direct child part that declares the tag", async () => {
    const { variant, coverage } = await buildFixture(chip("flex [&>input]:pr-[6px]", { parts: [CONTROL] }));
    const control = frameOf(variant?.root);
    expect(control?.paddingRight).toEqual({ kind: "literal", value: 6 });
    expect(notesOf(coverage, "[&>input]:pr-[6px]").map(([part, outcome]) => [part, outcome])).toEqual([
      ["chip", "literal"],
    ]);
  });

  it("reaches no `<input>` below a direct child, nor a part that declares no tag", async () => {
    const nested = await buildFixture(
      chip("flex [&>input]:pr-[6px]", { parts: [{ ...dot("flex"), parts: [CONTROL] }] })
    );
    const untagged = await buildFixture(chip("flex [&>input]:pr-[6px]", { parts: [UNTAGGED] }));
    for (const { coverage } of [nested, untagged]) {
      expect(notesOf(coverage, "[&>input]:pr-[6px]")).toEqual([
        ["chip", "unmapped", "the definition draws no direct `<input>` child of chip"],
      ]);
    }
  });
});

// Oracle: CSS Flexbox 1 §9.2 and CSS 2.1 §8.3. A flex item's outer size along the row is its margin
// box, so a negative end margin of 4px takes 4px from the room it uses, and the next item, or the
// row's end, sits 4px nearer its content. A box that paints nothing shows only its content, so taking
// the 4px from its padding on that side instead, with its width hugging, draws the same pixels, as
// Input group's trailing addon pulls its button toward the field's edge with `-mr-1`. Figma has no
// negative padding, so the fold holds only where the padding less the margin is 0 or more in every
// mode, and it binds the synced variable whose formula is that difference.
describe("a negative margin across a row on a box that paints nothing", () => {
  const variablesWith = (minimum: number) =>
    makeVariableIndex([
      { ref: { collection: "Fuse density", name: "p" }, webSyntax: "var(--p)", minimum, maximum: 12 },
      {
        ref: { collection: "Fuse density", name: "p-tight" },
        webSyntax: "calc(var(--p) - 0.25rem)",
        minimum: minimum - 4,
        maximum: 8,
      },
    ]);
  const ADDON = "flex h-[8px] pr-(--p) -mr-1";

  it("folds into the padding on its side, which binds the variable of the difference", async () => {
    const { variant, coverage } = await buildFixture(chip("flex w-[100px]", { parts: [dot(ADDON)] }), {
      variables: variablesWith(8),
    });
    const addon = frameOf(variant?.root);
    expect([addon?.kind, addon?.paddingRight]).toEqual([
      "frame",
      { kind: "variable", variable: { collection: "Fuse density", name: "p-tight" } },
    ]);
    expect(notesOf(coverage, "-mr-1")).toEqual([
      [
        "chip-dot",
        "bound",
        "Fuse density / p-tight, the padding on its side less this margin, since the box paints nothing and its width hugs",
      ],
    ]);
    expect(notesOf(coverage, "pr-(--p)")).toEqual([
      ["chip-dot", "bound", "Fuse density / p-tight, this padding less the negative margin on its side"],
    ]);
  });

  it.each([
    ["a box that paints", chip("flex w-[100px]", { parts: [dot(`${ADDON} bg-[rgb(0_0_0)]`)] }), 8],
    ["a padding the margin takes below 0 in a mode", chip("flex w-[100px]", { parts: [dot(ADDON)] }), 2],
    ["a box in a column", chip("flex flex-col w-[100px]", { parts: [dot(ADDON)] }), 8],
  ])("leaves the margin unmapped on %s", async (_name, definition, minimum) => {
    const { coverage } = await buildFixture(definition, { variables: variablesWith(minimum) });
    expect(notesOf(coverage, "-mr-1").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Box Alignment 3 §5.3. `justify-content: normal`, which a row with no `justify-content`
// takes, behaves as `flex-start` in a flex container, so the row packs its layers at its start
// wherever it has room beside them, as Select's item text sets "Apple" at the start of a 144px row.
// A set `justify-content` places them where it says.
describe("a fixed row's layer that fills it and hugs a narrower label", () => {
  const FONT_SANS = makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]);
  const row = (justify: string) =>
    chip("flex w-[144px] items-center", {
      parts: [
        {
          ...dot(
            `flex flex-1 gap-2 whitespace-nowrap font-sans text-[14px]/[20px] text-[#000000] ${justify}`
          ),
          label: {
            key: "label",
            name: "label",
            characters: "Apple",
            textProperty: undefined,
            shownIn: () => true,
          },
        },
      ],
    });

  it.each([
    ["no `justify-content`", "", "MIN"],
    ["`justify-center`", "justify-center", "CENTER"],
    ["`justify-end`", "justify-end", "MAX"],
  ])("places the label where %s packs it", async (_name, justify, align) => {
    const { variant } = await buildFixture(row(justify), { variables: FONT_SANS });
    const text = frameOf(variant?.root);
    expect([
      text?.sizing.horizontal,
      text?.children.map((child) => ("sizing" in child ? child.sizing.horizontal : undefined)),
    ]).toEqual([FILL, [HUG]]);
    expect(text?.primaryAlign).toBe(align);
  });
});

// Oracle: CSS Box Alignment 3 §5.3 and §8 and CSS Flexbox 1 §9.7. A layer that grows takes the free
// space of its row, so `justify-content: space-between` has none to share out and packs the layers at
// the start with the gap between them. A real file drew no gap under Figma's SPACE_BETWEEN beside a
// filling text (PV, W5-P3), and under MIN a 384px row drew a filling text 0..364 and a 16px frame
// 368..384 with its bound 4px gap (W5-P3), so the row draws MIN with its gap.
describe("a `justify-between` row of fixed width whose one layer grows", () => {
  /** A 16px part after the first, as Select's caret follows its value. */
  const end = { ...dot("flex w-[16px] h-[8px]"), key: "end", slot: "chip-end" };

  it("packs its layers at the start with the gap, the growing layer filling", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex w-[200px] items-center justify-between gap-[6px]", {
        parts: [dot("flex flex-1 h-[8px]"), end],
      })
    );
    expect([
      variant?.root.primaryAlign,
      variant?.root.itemSpacing,
      frameOf(variant?.root)?.sizing.horizontal,
    ]).toEqual(["MIN", { kind: "literal", value: 6 }, FILL]);
    expect(notesOf(coverage, "justify-between")).toEqual([
      [
        "chip",
        "literal",
        "beside a layer that grows into the free space, so packed at the start of the primary axis with the gap, which Figma's SPACE_BETWEEN would drop (PV, W5-P3)",
      ],
    ]);
  });

  it("keeps SPACE_BETWEEN where no layer grows, so the free space spreads them", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex w-[200px] items-center justify-between gap-[6px]", {
        parts: [dot("flex w-[8px] h-[8px]"), end],
      })
    );
    expect([variant?.root.primaryAlign, frameOf(variant?.root)?.sizing.horizontal]).toEqual([
      "SPACE_BETWEEN",
      { kind: "fixed", length: { kind: "literal", value: 8 } },
    ]);
    expect(notesOf(coverage, "justify-between")).toEqual([
      ["chip", "literal", "spaced out between the ends of the primary axis"],
    ]);
  });
});

// Oracle: CSS Box Alignment 3 §5.3: `space-between` with one alignment subject behaves as
// `flex-start`, as Select field's heading row packs its lone label at its start.
describe("a `justify-between` row of fixed width that holds one layer", () => {
  it("packs the layer at the start", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex w-[200px] items-center justify-between", { parts: [dot("flex w-[8px] h-[8px]")] })
    );
    expect(variant?.root.primaryAlign).toBe("MIN");
    expect(notesOf(coverage, "justify-between")).toEqual([
      [
        "chip",
        "literal",
        "with one layer, which `space-between` places as `flex-start` does, so packed at the start of the primary axis",
      ],
    ]);
  });
});
