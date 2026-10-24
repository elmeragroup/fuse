/**
 * Unit under test: the Label component set as the build produces it. Oracle: the Fuse variable or
 * literal each Figma field of a cell must carry, read by hand from the `label` slot of
 * `field-variants.ts` and `label-type.ts`: a flex box that hugs its text (`w-fit`) with an 8px gap,
 * no padding, fill or stroke, the text `Email` in `font-sans` at Medium, bound to the label type
 * pair `label-text` and `label-leading`, in the `foreground` the page sets, and 50% opacity in a
 * disabled Field (`group-data-disabled/field:opacity-50`).
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  HUG,
  HUGGING_LABEL,
  literal,
  paint,
  token,
  UNLIMITED,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** A label at `opacity`, hugging its text. */
const label = (opacity: number) => ({
  name: "field-label",
  direction: "HORIZONTAL",
  sizing: { horizontal: HUG, vertical: HUG },
  limits: UNLIMITED,
  clips: true,
  paddingTop: literal(0),
  paddingRight: literal(0),
  paddingBottom: literal(0),
  paddingLeft: literal(0),
  itemSpacing: literal(8),
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: literal(0),
  shadows: [],
  opacity,
  children: [
    {
      kind: "text",
      key: "label",
      name: "label",
      characters: "Email",
      textProperty: "Label",
      fontFamily: token("font-sans"),
      fontStyle: "Medium",
      fontSize: density("label-text"),
      lineHeight: density("label-leading"),
      color: paint("foreground"),
      ...HUGGING_LABEL,
    },
  ],
});

describe("the Label component set", () => {
  it("holds rest and disabled, with columns by state and the Label text property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "label");
    expect(set?.axes).toEqual([{ name: "state", values: ["rest", "disabled"] }]);
    expect(set?.columnAxis).toBe("state");
    expect([set?.textProperties, set?.swapProperties]).toEqual([
      [{ name: "Label", defaultValue: "Email" }],
      [],
    ]);
  });

  it.each([
    ["rest", 1],
    ["disabled", 0.5],
  ])("draws the %s label at opacity %s, hugging its text", (state, opacity) => {
    expect(variantRoot(spec, `label/state=${state}`)).toEqual(label(opacity));
  });
});
