/**
 * How the build maps a label whose `font-weight` reads a synced variable, as Selection item's title
 * reads `--selection-title-weight`. The unit under test is `buildSetsInOrder` on a hand-built
 * capture of a one-cell `chip` set (`test/capture-fixtures.ts`). Oracles: Figma binds a text's
 * `fontWeight` to a FLOAT variable and shows, in each mode, the face its family names for the
 * weight there (the typings' `VariableBindableTextField`, Figma's guide to typography variables), so
 * the layer binds the variable and lists the faces between the variable's least and greatest
 * weight, Regular for 400 and Medium for 500, as CSS's numeric weights name them (CSS Fonts 4 §2.2);
 * and a weight that names no face the kit knows stops the build.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, rest, textOf } from "../../test/capture-fixtures";
import type { LabelManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Price alert",
  textProperty: "Title",
  shownIn: () => true,
};

/** A chip whose label's weight reads `--title-weight`, which the synced set bounds as given. */
function weighted(minimum: number, maximum: number) {
  return buildCaptured(
    chip({ label: LABEL }),
    rest({
      slot: "chip",
      classes: "font-sans text-[14px] leading-[20px] text-[#000000]",
      text: "Price alert",
      written: [
        {
          className: "font-[number:var(--title-weight)]",
          property: "font-weight",
          value: "var(--title-weight)",
        },
      ],
    }),
    {
      variables: makeVariableIndex([
        { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        {
          ref: { collection: "Fuse tokens", name: "title-weight" },
          webSyntax: "var(--title-weight)",
          minimum,
          maximum,
        },
      ]),
    }
  );
}

describe("a label whose weight reads a synced variable", () => {
  it("binds the variable, takes the lightest face, and loads every face the weights name", async () => {
    const { variant, fonts } = await weighted(400, 500);
    const label = textOf(variant?.root);
    expect([label?.weight, label?.fontStyle, fonts.map((font) => font.style).toSorted()]).toEqual([
      { variable: { collection: "Fuse tokens", name: "title-weight" }, faces: ["Regular", "Medium"] },
      "Regular",
      ["Medium", "Regular"],
    ]);
  });

  it("stops the build where a weight names no face the kit knows", async () => {
    await expect(weighted(450, 450)).rejects.toThrow("whose weights name no upright face the kit knows");
  });
});
