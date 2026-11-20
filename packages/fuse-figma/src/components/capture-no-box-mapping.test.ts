/**
 * How the build draws a part whose element generates no box, as Selection item's `<label>` around
 * its control and text. The unit under test is `buildSetsInOrder` on hand-built captures of
 * one-cell `chip` sets (`test/capture-fixtures.ts`). Oracles: CSS Display 3 §2.5, under which a
 * `display: contents` element generates no box and its children take its place in its parent's flow,
 * so the parent lays out the wrapper's parts and the wrapper's own box properties set nothing, while
 * the properties it sets that inherit still reach its parts (CSS Cascade 4 §3); the capture's `noBox`
 * fact, which the page records only where the element generates no box in every mode and adds no
 * box of its own text or pseudo-elements; and the coverage contract, under which a wrapper the
 * capture did not prove keeps its `display` unmapped, and a declaration the kit reads nowhere and
 * that no reason drops stays unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, notesOf, part, rest } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { LabelManifest } from "../capture/manifest";

/** A row whose `wrap` part holds two 20px squares, the wrapper carrying the given facts and classes. */
function buildWrapped(measured: MeasuredFacts, label?: LabelManifest, text?: string) {
  const square = (slot: string) => ({ slot, classes: "size-[20px]" });
  const element: FixtureElement = {
    slot: "wrap",
    classes: "contents p-[6px] text-[#ff0000] tracking-[2px]",
    measured,
    children: [square("a"), square("b")],
  };
  const fields = {
    key: "wrap",
    slot: "wrap",
    parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })],
  };
  const wrapper = part(label === undefined ? fields : { ...fields, label });
  return buildCaptured(
    chip({ parts: [wrapper] }),
    rest({
      slot: "chip",
      classes: "flex gap-[4px]",
      children: [text === undefined ? element : { ...element, text }],
    })
  );
}

describe("a part whose element generates no box", () => {
  it("hands its parts to its parent, keyed under its key, and draws no layer of its own", async () => {
    const { variant } = await buildWrapped({ noBox: true });
    expect(variant?.root.children.map((child) => child.key)).toEqual(["wrap/a", "wrap/b"]);
  });

  it("reads its display as the lift and drops its own padding, while what it passes down stays to its parts", async () => {
    const { coverage } = await buildWrapped({ noBox: true });
    expect([
      notesOf(coverage, "contents"),
      notesOf(coverage, "p-[6px]").map(([, outcome]) => outcome),
    ]).toEqual([
      [
        [
          "display",
          "literal",
          "the element generates no box (display: contents), so the kit lays its parts out in its parent's flow",
        ],
      ],
      ["dropped", "dropped", "dropped", "dropped"],
    ]);
    // The inherited color and letter spacing take no box reason: each part reads the color, and the
    // letter spacing drops as a text property where the cell shows no text. Tailwind registers its
    // `--tw-tracking` as not inherited, so it sets nothing on a box the wrapper lacks.
    expect(["text-[#ff0000]", "tracking-[2px]"].flatMap((name) => notesOf(coverage, name))).toEqual([
      ["color", "literal", "rgba(255, 0, 0, 1)"],
      [
        "--tw-tracking",
        "dropped",
        "the element generates no box (display: contents), so it has no box this property sets",
      ],
      ["letter-spacing", "dropped", "the cell shows no text"],
    ]);
  });

  it("draws as a frame with its display unmapped where the capture did not prove it generates no box", async () => {
    const { variant, coverage } = await buildWrapped({});
    expect([
      variant?.root.children.map((child) => child.key),
      notesOf(coverage, "contents").map(([property, outcome]) => [property, outcome]),
    ]).toEqual([["wrap"], [["display", "unmapped"]]]);
  });

  it("stops the build where its element holds text of its own, which would be a box beside its parts", async () => {
    await expect(buildWrapped({ noBox: true }, undefined, "   ")).rejects.toThrow(
      "the part wrap generates no box and holds text of its own"
    );
  });

  it("stops the build where it shows a label its parent has no layer for", async () => {
    const label: LabelManifest = {
      key: "text",
      name: "text",
      characters: "Hi",
      textProperty: undefined,
      shownIn: () => true,
    };
    await expect(buildWrapped({ noBox: true }, label)).rejects.toThrow(
      "the part wrap generates no box and shows a label"
    );
  });
});
