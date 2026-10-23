/**
 * Build rules Item's row is the first set to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { FILL } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf } from "../../test/fixture-sets";
import type { PartDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";

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
describe("a row that wraps", () => {
  const RING: PartDefinition = { ...dot("size-[8px]"), key: "ring", slot: "chip-ring" };

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
