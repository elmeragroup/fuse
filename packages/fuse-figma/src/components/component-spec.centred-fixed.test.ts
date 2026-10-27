/**
 * An instance whose inner set's root is fixed at the centre of a declared viewport, inside a composite
 * fixed in the same viewport that centres it, as Alert dialog's open example centres its popup over the
 * scrim. Unit under test: `buildFixtures`, the in-place build of the instance. Oracle: CSS 2.1 §10.1,
 * where a fixed box's containing block is the viewport, so its percentages take it in the composite as
 * in its own set, and CSS 2.1 §10.3.7 and §10.6.4 with CSS Transforms 2, where `top-1/2 left-1/2` and
 * `-translate-1/2` put the box's centre on the viewport's centre, which a flex box as large as the
 * viewport draws by centring it on both axes.
 */
import { describe, expect, it } from "vitest";

import { fixed, HUG, literal } from "../../test/built-kit";
import { buildFixtures, chip, dot } from "../../test/fixture-sets";
import type { ComponentDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";

const VIEWPORT = { width: 640, height: 448 };

/** A popup as Dialog fixes it: centred, as wide as min(448px, 90%), capped at 100% less 32px. */
const POPUP = chip(
  "fixed top-1/2 left-1/2 flex w-full max-w-[min(448px,90%)] max-h-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 p-[16px] bg-[#ffffff]",
  {
    key: "popup",
    name: "Popup",
    slot: "popup",
    viewport: VIEWPORT,
    parts: [{ ...dot("h-[40px] w-[40px]"), key: "body", slot: "chip-body" }],
  }
);

/** A scrim over the same viewport, holding the popup, with the given alignment. */
function scrim(align: string): ComponentDefinition {
  return chip(`fixed inset-0 flex ${align} bg-[#000000]`, {
    key: "scrim",
    name: "Scrim",
    slot: "scrim",
    viewport: VIEWPORT,
    parts: [
      { kind: "instance", key: "popup", of: POPUP, cell: () => ({ state: "rest" }), shownIn: () => true },
    ],
  });
}

/** The popup's rows in the scrim's coverage, by property. */
const popupRows = (coverage: readonly CoverageRow[], property: string) =>
  coverage.filter((row) => row.part === "popup" && row.property === property).map((row) => [row.outcome]);

describe("a fixed popup instance its composite centres in the viewport", () => {
  it("sizes against the viewport in place and reads its centring as the composite's", async () => {
    const [, built] = await buildFixtures([POPUP, scrim("items-center justify-center")]);
    const root = built?.componentSet.variants[0]?.root;
    const [popup] = root?.children ?? [];
    expect([root?.sizing, popup?.kind === "instance" ? popup.sizing : undefined]).toEqual([
      { horizontal: fixed(literal(640)), vertical: fixed(literal(448)) },
      { horizontal: fixed(literal(448)), vertical: HUG },
    ]);
    // The in-place rows that agree with the popup's own set land in its coverage, not the composite's,
    // so the composite lists none of them, and none unmapped.
    expect((built?.coverage ?? []).filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("leaves the place unmapped where the composite does not centre the popup", async () => {
    const [, built] = await buildFixtures([POPUP, scrim("items-start justify-start")]);
    expect(popupRows(built?.coverage ?? [], "position")).toEqual([["unmapped"]]);
  });
});

/**
 * A popup as the Command palette fixes it: 60px below the viewport's top, centred across by
 * `left-1/2 -translate-x-1/2` (CSS 2.1 §10.3.7, §10.6.4, CSS Transforms 2), which a column as large as
 * the viewport draws by padding its top 60px and centring the popup across.
 */
const TOP_POPUP = chip("fixed top-[60px] left-1/2 flex w-[400px] -translate-x-1/2 p-[16px] bg-[#ffffff]", {
  key: "top-popup",
  name: "Top popup",
  slot: "popup",
  viewport: VIEWPORT,
  parts: [{ ...dot("h-[40px] w-[40px]"), key: "body", slot: "chip-body" }],
});

/** A scrim over the same viewport, a column padding its top by the given length. */
function topScrim(top: string): ComponentDefinition {
  return chip(`fixed inset-0 flex flex-col items-center pt-[${top}] bg-[#000000]`, {
    key: "top-scrim",
    name: "Top scrim",
    slot: "scrim",
    viewport: VIEWPORT,
    parts: [
      { kind: "instance", key: "popup", of: TOP_POPUP, cell: () => ({ state: "rest" }), shownIn: () => true },
    ],
  });
}

describe("a fixed popup instance its composite places at a top inset", () => {
  it("reads its place as the composite's padding above it and its centring across", async () => {
    const [, built] = await buildFixtures([TOP_POPUP, topScrim("60px")]);
    const root = built?.componentSet.variants[0]?.root;
    expect(root).toMatchObject({ paddingTop: literal(60), counterAlign: "CENTER" });
    expect((built?.coverage ?? []).filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("leaves the place unmapped where the composite's padding is not the popup's top", async () => {
    const [, built] = await buildFixtures([TOP_POPUP, topScrim("40px")]);
    expect(popupRows(built?.coverage ?? [], "position")).toEqual([["unmapped"]]);
  });
});
