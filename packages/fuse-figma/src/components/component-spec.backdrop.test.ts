/**
 * The fill an ancestor paints behind a root, as `Sidebar.Provider`'s wrapper paints
 * `has-data-[variant=inset]:bg-sidebar` behind an inset panel's 8px band. Unit under test:
 * `buildComponentSet`, through the `chip` fixture. Oracle: CSS 2.1 Appendix E, where a box that paints
 * no background shows what its ancestors paint below it, so a root inside an ancestor whose box holds
 * the root's shows the ancestor's background across its whole box, and a root's own background
 * paints over it (CSS Backgrounds 3 §3.10).
 */
import { describe, expect, it } from "vitest";

import { buildFixture, chip } from "../../test/fixture-sets";
import type { AncestorDefinition } from "./component-spec";

/** An ancestor that paints red around the root. */
const WRAPPER: AncestorDefinition = {
  slot: "chip-wrapper",
  classes: "flex bg-[#ff0000]",
  undrawn: "the wrapper lays out the page, which the set does not draw",
};

/** The same ancestor, painting behind the root. */
const behind = (): AncestorDefinition => ({ ...WRAPPER, backdrop: true });

const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } };

describe("an ancestor that paints behind the root", () => {
  it("gives a root that paints no background the ancestor's background as its fill", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex p-[8px] w-[40px] h-[40px]", { ancestorsFor: () => [behind()] })
    );
    expect(variant?.root.fill).toEqual(RED);
    expect(
      coverage
        .filter((row) => row.part === "chip-wrapper")
        .map((row) => [row.className, row.property, row.outcome, row.detail])
    ).toEqual([
      [
        "bg-[#ff0000]",
        "background-color",
        "literal",
        "rgba(255, 0, 0, 1), which the ancestor paints behind the root, so the root shows it across its box",
      ],
      ["flex", "display", "dropped", "the wrapper lays out the page, which the set does not draw"],
    ]);
  });

  it("keeps a root's own background", async () => {
    const { variant } = await buildFixture(
      chip("flex p-[8px] w-[40px] h-[40px] bg-[#00ff00]", { ancestorsFor: () => [behind()] })
    );
    expect(variant?.root.fill).toEqual({ kind: "literal", color: { r: 0, g: 1, b: 0, a: 1 } });
  });

  it("leaves an ancestor that is no backdrop to its reason", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex p-[8px] w-[40px] h-[40px]", { ancestorsFor: () => [WRAPPER] })
    );
    expect(variant?.root.fill).toBeUndefined();
    expect(
      coverage.filter((row) => row.property === "background-color").map((row) => [row.outcome, row.detail])
    ).toEqual([["dropped", "the wrapper lays out the page, which the set does not draw"]]);
  });
});
