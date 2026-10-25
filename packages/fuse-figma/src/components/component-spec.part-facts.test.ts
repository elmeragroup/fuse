/**
 * The attributes a frame part's own element carries, as Base UI stamps `data-orientation` on
 * `Sidebar.Separator` inside the Sidebar panel, whose root carries none. Unit under test:
 * `buildComponentSet`, through the `chip` fixture. Oracle: Selectors 4 §6.1, where an attribute
 * selector matches only the element that carries the attribute, so `data-horizontal:` styles the part
 * that carries `data-orientation="horizontal"` and no other box.
 */
import { describe, expect, it } from "vitest";

import { fixed, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { Cell, PartDefinition } from "./component-spec";

const always = (): boolean => true;

/** A part whose element carries `data-orientation="horizontal"`, holding the parts given. */
const horizontal = (parts: readonly PartDefinition[] = []): PartDefinition => ({
  ...dot("w-[10px] h-[4px] data-horizontal:h-[2px]"),
  facts: new Map([["data-horizontal", always]]),
  parts,
});

describe("a frame part's facts", () => {
  it("hold on the part's own element and on no other box", async () => {
    const { variant } = await buildFixture(
      chip("flex w-[40px] h-[20px] data-horizontal:h-[30px]", { parts: [horizontal()] })
    );
    const part = variant?.root.children[0];
    expect(part?.kind === "frame" ? part.sizing.vertical : undefined).toEqual(fixed(literal(2)));
    expect(variant?.root.sizing.vertical).toEqual(fixed(literal(20)));
  });

  it("refuse a variant the set's table gives a meaning", async () => {
    const collapsed = (cell: Cell) => cell.state === "rest";
    await expect(
      buildFixture(
        chip("flex w-[40px]", {
          facts: new Map([["data-horizontal", collapsed]]),
          parts: [horizontal()],
        })
      )
    ).rejects.toThrow("the part chip-dot gives `data-horizontal` a second meaning");
  });

  it("refuse a part that holds parts, whose elements carry none of them", async () => {
    await expect(
      buildFixture(chip("flex w-[40px]", { parts: [horizontal([{ ...dot("h-[1px]"), key: "inner" }])] }))
    ).rejects.toThrow("the part chip-dot holds parts, which carry none of its facts");
  });
});
