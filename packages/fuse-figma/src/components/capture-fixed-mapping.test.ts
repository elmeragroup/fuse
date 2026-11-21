/**
 * Whether the build draws an instance part fixed against its viewport's right edge where CSS puts
 * it. The unit under test is `buildSetsInOrder` on hand-built captures of a `chip` whose root is the
 * viewport, a fixed `inset-0` row that packs its layers at its end, holding a panel instance fixed
 * in the same 640×448 viewport (`test/capture-fixtures.ts`).
 * Oracles: CSS 2.1 §10.3.7 and §10.6.4, under which a fixed box with `right: 0` and `left: auto`
 * sits with its margin box against the viewport's right edge whatever its siblings do, so a
 * `margin-right` moves its border box off that edge, and `left: auto` is the initial value, the same
 * as no `left`; Figma's auto layout, under which a row that packs its layers at its end draws its
 * last layer there; and the coverage contract, under which a place the kit draws where CSS puts it
 * reads `literal` and any other stays `unmapped`.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, FILL, rest } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { SetManifest } from "../capture/manifest";
import type { CoverageRow } from "./coverage";

const VIEWPORT = { width: 640, height: 448 } as const;

/** The panel's set, fixed in the viewport. */
const PANEL = chip({ key: "panel", name: "Panel", slot: "panel", viewport: VIEWPORT });

/** The panel's instance part in the composite. */
const PANEL_PART = {
  kind: "instance",
  key: "panel",
  of: PANEL,
  cell: () => ({ state: "rest" }),
  shownIn: () => true,
} as const;

/** A plain sibling of the panel in the composite. */
const SIBLING_PART = {
  key: "mark",
  slot: "mark",
  shownIn: () => true,
  label: undefined,
  iconsFor: () => [],
} as const;

const SIBLING: FixtureElement = { slot: "mark", classes: "size-[8px]" };

/** Sheet's own right panel: against the right edge from top to bottom, 448px wide. */
const EDGE = "fixed inset-y-0 right-0 h-full w-[448px]";

/**
 * Build a composite whose root is the viewport, a row packed at its end, holding the panel, whose
 * classes are `panel`, with a sibling before or after it where `sibling` says.
 */
function composite(panel: string, sibling: "none" | "before" | "after") {
  const panelElement: FixtureElement = { slot: "panel", classes: panel };
  const parts: NonNullable<SetManifest["parts"]> =
    sibling === "none"
      ? [PANEL_PART]
      : sibling === "before"
        ? [SIBLING_PART, PANEL_PART]
        : [PANEL_PART, SIBLING_PART];
  const children =
    sibling === "none"
      ? [panelElement]
      : sibling === "before"
        ? [SIBLING, panelElement]
        : [panelElement, SIBLING];
  return buildCaptured(
    chip({ viewport: VIEWPORT, parts }),
    rest({ slot: "chip", classes: "fixed inset-0 flex justify-end", children }),
    { inner: [{ manifest: PANEL, cells: rest(panelElement) }] }
  );
}

/** The properties of the rows that leave the panel's place unmapped in the composite, sorted. */
const unmappedPlace = (coverage: readonly CoverageRow[]) =>
  coverage
    .filter(
      (row) =>
        row.part === "panel" &&
        row.outcome === "unmapped" &&
        ["position", "top", "right", "bottom", "left"].includes(row.property)
    )
    .map((row) => row.property)
    .toSorted();

describe("a panel fixed against its viewport's right edge", () => {
  it.each([
    ["alone", EDGE, "none"],
    ["after a sibling, which the row draws before it", EDGE, "before"],
    ["with an explicit `left: auto`, as `inset: 0 0 0 auto` expands", `${EDGE} left-auto`, "none"],
  ] as const)("is placed against the row's end and fills its height %s", async (_name, panel, sibling) => {
    const { variant, coverage } = await composite(panel, sibling);
    const instance = variant?.root.children.find((child) => child.key === "panel");
    expect({
      height: instance?.kind === "instance" ? instance.sizing.vertical : undefined,
      unmapped: unmappedPlace(coverage),
    }).toEqual({ height: FILL, unmapped: [] });
  });

  it.each([
    ["before a sibling, which the row draws at its end", EDGE, "after"],
    ["16px inside the edge by its right margin", `${EDGE} mr-[16px]`, "none"],
  ] as const)("leaves its place unmapped %s", async (_name, panel, sibling) => {
    const { coverage } = await composite(panel, sibling);
    expect(unmappedPlace(coverage)).toEqual(["bottom", "position", "right", "top"]);
  });
});
