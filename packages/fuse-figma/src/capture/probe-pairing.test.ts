/**
 * The probe's pairing of each box it measures with the part the build drew there. Unit under test:
 * `contradictions`, as it pairs each recorded part with the box at its place and the layer at its
 * path, and the build's record of each part's place. Oracle: hand-built chips and the kit's sets,
 * whose markup each case reads by hand, as its comment says.
 */
import { Result } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { buildCaptured, chip, part, rest } from "../../test/capture-fixtures";
import type { BuiltFixture } from "../../test/capture-fixtures";
import { KEPT } from "../../test/probed-box";
import { densityLengths } from "../components/build-kit.ts";
import type { DrawnPart } from "../components/drawn-parts.ts";
import type { ProbedBox } from "./perturbation.ts";
import { contradictions, sizingReadsOf } from "./probe-sizing.ts";

// Oracle: a hand-built chip whose `pad` part is 40px wide with an 8px margin, which the build draws
// as a frame of its margins around the `box` that draws its border box, read by hand: the border box
// keeps 40px, and the margin frame around it is 56px. A box the probe kept at 40px agrees with the
// first and contradicts the second.
describe("pairing each part the build drew with its box", () => {
  let built: BuiltFixture;

  beforeAll(async () => {
    built = await buildCaptured(
      chip({ parts: [part({ key: "pad", slot: "chip-pad" })] }),
      rest({
        slot: "chip",
        classes: "flex",
        children: [{ slot: "chip-pad", classes: "m-[8px] size-[40px]" }],
      })
    );
  }, 120_000);

  const pad: ProbedBox = {
    ...KEPT,
    slot: "chip-pad",
    place: "0/root/0",
    base: 40,
    wider: 40,
    longer: 40,
    longest: 40,
  };

  /** The pad's part as the build recorded it, with fields a case sets. */
  const recorded = (fields: Partial<DrawnPart> = {}): DrawnPart => {
    const own = built.accounting.get(built.variant?.key ?? "")?.parts.find(({ slot }) => slot === "chip-pad");
    if (own === undefined) {
      throw new Error("the build records no chip-pad");
    }
    return { ...own, ...fields };
  };

  const probe = (boxes: readonly ProbedBox[], parts: readonly DrawnPart[]) =>
    contradictions(
      built.componentSet,
      new Map([[built.variant?.key ?? "", { id: "cell", boxes, gap: undefined }]]),
      new Map([[built.variant?.key ?? "", parts]]),
      sizingReadsOf([built.componentSet], Result.getOrThrow(densityLengths("dense")))
    );

  it("compares a part with a margin against the box its margin frame holds", () => {
    const { found, compared, unpaired } = probe([pad], [recorded()]);
    expect({ found, compared, unpaired }).toEqual({ found: [], compared: 1, unpaired: [] });
  });

  it.each<readonly [string, readonly ProbedBox[], Partial<DrawnPart>, string]>([
    ["a part with no box at its place", [], {}, "the probe measured no box at its place"],
    [
      "a part whose place holds a box of another data-slot",
      [{ ...pad, slot: "chip-other" }],
      {},
      "the box at its place carries the data-slot chip-other",
    ],
    [
      "a part whose path reaches no layer",
      [pad],
      { path: ["gone"] },
      "its path gone reaches no frame, instance or icon of the variant",
    ],
  ])("fails %s", (_case, boxes, fields, why) => {
    expect(probe(boxes, [recorded(fields)]).unpaired).toEqual([
      { cell: "chip/state=rest", slot: "chip-pad", part: "pad", place: "0/root/0", why },
    ]);
  });

  it("compares nothing for a part the build left out", () => {
    const { compared, unpaired } = probe([pad], [recorded({ path: undefined })]);
    expect({ compared, unpaired }).toEqual({ compared: 0, unpaired: [] });
  });

  it("fails a measured cell the build recorded nothing for, and passes one it recorded no parts for", () => {
    const key = built.variant?.key ?? "";
    const cells = new Map([[key, { id: "cell", boxes: [pad], gap: undefined }]]);
    const reads = sizingReadsOf([built.componentSet], Result.getOrThrow(densityLengths("dense")));
    const missing = contradictions(built.componentSet, cells, new Map(), reads);
    const empty = contradictions(built.componentSet, cells, new Map([[key, []]]), reads);
    expect([missing.unrecorded, empty.unrecorded, empty.compared]).toEqual([["chip/state=rest"], [], 0]);
  });

  it("fails a measured cell the set builds no variant for", () => {
    const { compared, unrecorded, unbuilt } = contradictions(
      built.componentSet,
      new Map([["chip/state=gone", { id: "cell", boxes: [pad], gap: undefined }]]),
      new Map(),
      sizingReadsOf([built.componentSet], Result.getOrThrow(densityLengths("dense")))
    );
    expect({ compared, unrecorded, unbuilt }).toEqual({
      compared: 0,
      unrecorded: [],
      unbuilt: ["chip/state=gone"],
    });
  });
});

// Oracle: the kit's Badge, whose root holds its label as a text layer, which draws text and has no
// box the probe's sizing rules read.
describe("a path that ends at a text layer", () => {
  let built: BuiltSets;

  beforeAll(async () => {
    built = await builtKit();
  }, 120_000);

  it("fails the part it records", () => {
    const set = built.spec.componentSets.find((each) => each.key === "badge");
    const variant = set?.variants[0];
    const text = variant?.root.children.find((child) => child.kind === "text");
    if (set === undefined || variant === undefined || text === undefined) {
      throw new Error("the kit builds no badge with a text layer");
    }
    const box: ProbedBox = { ...KEPT, slot: "badge-label", place: "0/root/0" };
    const { unpaired } = contradictions(
      set,
      new Map([[variant.key, { id: "cell", boxes: [box], gap: undefined }]]),
      new Map([[variant.key, [{ place: "0/root/0", slot: "badge-label", part: "label", path: [text.key] }]]]),
      sizingReadsOf(built.spec.componentSets, Result.getOrThrow(densityLengths("dense")))
    );
    expect(unpaired).toEqual([
      {
        cell: variant.key,
        slot: "badge-label",
        part: "label",
        place: "0/root/0",
        why: `its path ${text.key} reaches no frame, instance or icon of the variant`,
      },
    ]);
  });
});

// Oracle: the markup of Select's grouped popup, whose list holds the Citrus group, then
// `Select.Separator` at `data-slot="select-separator"`, a set whose own slot is `menu-separator`, and
// Selection item's, whose `<label>` generates no box and holds the cluster whose `item-content` sits
// in a `content` part. A pairing by the manifest's `data-slot` compared neither. The layer each pairs
// with is the builder's to record, and `drawn-parts.test.ts` covers lifted keys and margin frames.
describe("parts a pairing by data-slot left out", () => {
  let built: BuiltSets;

  beforeAll(async () => {
    built = await builtKit();
  }, 120_000);

  it.each<readonly [string, string, string]>([
    ["select-popup/content=grouped", "select-separator", "0/root/0/1"],
    ["selection-item/state=rest", "item-content", "0/root/0/1/0"],
  ])("compares %s's %s", (variant, slot, place) => {
    const set = built.spec.componentSets.find((each) => variant.startsWith(`${each.key}/`));
    const own = built.drawn.get(variant)?.find((each) => each.slot === slot);
    if (set === undefined || own === undefined) {
      throw new Error(`the build records no ${slot} in ${variant}`);
    }
    const { compared, unpaired } = contradictions(
      set,
      new Map([[variant, { id: "cell", boxes: [{ ...KEPT, slot, place, text: false }], gap: undefined }]]),
      new Map([[variant, [own]]]),
      sizingReadsOf(built.spec.componentSets, Result.getOrThrow(densityLengths("dense")))
    );
    expect({ place: own.place, compared, unpaired }).toEqual({
      place,
      compared: 1,
      unpaired: [],
    });
  });
});

// Oracle: a hand-built chip whose two parts share the `chip-close` slot, as Dialog's footer Cancel
// and its corner close do: the first is 40px wide, the second a `flex-1` item that fills the 200px
// row, read by hand. The first part's box kept its 40px with its text, and the second widened with
// its container. Paired by place, each agrees with its own layer. Paired by slot, both would take
// one layer and one of them would contradict it.
describe("parts that share a data-slot", () => {
  let built: BuiltFixture;

  beforeAll(async () => {
    built = await buildCaptured(
      chip({
        parts: [part({ key: "cancel", slot: "chip-close" }), part({ key: "corner", slot: "chip-close" })],
      }),
      rest({
        slot: "chip",
        classes: "flex w-[200px]",
        children: [
          { slot: "chip-close", classes: "w-[40px]" },
          { slot: "chip-close", classes: "flex-1" },
        ],
      })
    );
  }, 120_000);

  const cancel: ProbedBox = {
    ...KEPT,
    slot: "chip-close",
    place: "0/root/0",
    base: 40,
    wider: 40,
    longer: 40,
    longest: 40,
  };

  /** What the probe finds of the two parts' boxes, given in the order the markup does not hold them. */
  const probe = (corner: ProbedBox) => {
    const key = built.variant?.key ?? "";
    const parts = (built.accounting.get(key)?.parts ?? []).filter(({ slot }) => slot === "chip-close");
    const { found, compared, unpaired } = contradictions(
      built.componentSet,
      new Map([[key, { id: "cell", boxes: [corner, cancel], gap: undefined }]]),
      new Map([[key, parts]]),
      sizingReadsOf([built.componentSet], Result.getOrThrow(densityLengths("dense")))
    );
    return { found, compared, unpaired };
  };

  it("pairs each with the box at its place", () => {
    const corner: ProbedBox = {
      ...KEPT,
      slot: "chip-close",
      place: "0/root/1",
      base: 160,
      wider: 280,
      longer: 160,
      longest: 160,
    };
    expect(probe(corner)).toEqual({ found: [], compared: 2, unpaired: [] });
  });

  it("names the part and its place where its box contradicts its layer", () => {
    const corner: ProbedBox = {
      ...KEPT,
      slot: "chip-close",
      place: "0/root/1",
      base: 160,
      wider: 160,
      longer: 160,
      longest: 160,
    };
    expect(probe(corner).found).toEqual([
      {
        cell: "chip/state=rest",
        slot: "chip-close",
        part: "corner",
        place: "0/root/1",
        inferred: "fixed",
        mapped: "fill",
      },
    ]);
  });
});
