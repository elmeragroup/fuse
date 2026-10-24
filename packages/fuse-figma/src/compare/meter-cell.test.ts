/**
 * The HTML the built Fuse Meter renders for a cell. The unit under test is the Meter renderer. The
 * oracle is Meter's public contract, the docs Modes demo and Base UI's meter markup: a 256px host
 * holding `<div role="meter" data-slot="meter">`, whose `aria-valuenow` and `aria-valuemax` are the
 * demo's value, clamped to its maximum, and its maximum, and whose value span shows the cell's text
 * after the icon.
 */
import { describe, expect, it } from "vitest";

import { METER_CONSTANTS, meterToneCell, meterVariants } from "@elmeragroup/fuse/recipe-catalog";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { meter } from "./meter-cell";

/** The Meter level each `level` value of the set draws, by the docs Modes demo's values. */
const LEVELS = {
  low: METER_CONSTANTS.LEVELS.LOW,
  medium: METER_CONSTANTS.LEVELS.MEDIUM,
  full: METER_CONSTANTS.LEVELS.FULL,
  exceeded: METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE,
} as const;

/** The elements of a cell's markup, and the meter root among them. */
function render(mode: string, level: string) {
  const elements = elementsOf(renderCellHtml(meter, { mode, level }));
  const slot = (name: string) => elements.find((element) => element.attributes.get("data-slot") === name);
  return { elements, slot };
}

describe("the Meter renderer", () => {
  it("renders the default meter at 85 of 100 in a 256px host, its value as plain text after the Warning icon", () => {
    const { elements, slot } = render("default", "medium");
    expect([elements[0]?.name, elements[0]?.attributes.get("style")]).toEqual(["div", "width:256px"]);
    const root = slot("meter")?.attributes;
    expect([root?.get("role"), root?.get("aria-valuenow"), root?.get("aria-valuemax")]).toEqual([
      "meter",
      "85",
      "100",
    ]);
    expect(slot("meter-label")?.text).toBe("Storage used");
    expect(slot("meter-value")?.text).toBe(" 85%");
    const value = elements.findIndex((element) => element.attributes.get("data-slot") === "meter-value");
    expect(elements.filter((element) => element.parent === value).map((element) => element.name)).toEqual([
      "svg",
    ]);
  });

  it("renders the exceeded level at 130 of 120, which Base UI clamps to its maximum and a full bar", () => {
    const { slot } = render("default", "exceeded");
    const root = slot("meter")?.attributes;
    expect([root?.get("aria-valuenow"), root?.get("aria-valuemax")]).toEqual(["120", "120"]);
    expect(slot("meter-bar-fill")?.attributes.get("style")).toBe(
      "inset-inline-start:0;height:inherit;width:100%"
    );
  });

  // Unit under test: the mode and level the renderer gives Meter. Oracle: `meterToneCell` and
  // `meterVariants`, the table and recipe Meter itself reads, from the recipe catalog. Each cell's
  // value span carries its tone's classes, and holds an icon exactly where the table names one.
  it.each(
    Object.values(METER_CONSTANTS.MODES).flatMap((mode) =>
      Object.entries(LEVELS).map(([level, meterLevel]) => [mode, level, meterLevel] as const)
    )
  )(
    "renders %s at the %s level in the tone and with the icon meterToneCell names",
    (mode, level, meterLevel) => {
      const { tone, icon } = meterToneCell(mode, meterLevel);
      const { elements, slot } = render(mode, level);
      expect(slot("meter-value")?.attributes.get("class")?.split(" ")).toEqual(
        expect.arrayContaining(meterVariants({ tone }).labelValue().split(" "))
      );
      const value = elements.findIndex((element) => element.attributes.get("data-slot") === "meter-value");
      expect(elements.some((element) => element.parent === value && element.name === "svg")).toBe(
        icon !== "none"
      );
    }
  );
});
