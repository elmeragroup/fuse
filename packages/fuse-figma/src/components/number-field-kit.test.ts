/**
 * Unit under test: the `Number field stepper` and `Number field` sets as the build produces them.
 * Oracle: the Figma field each cell must carry, read by hand from `number-field-variants.ts`,
 * `field-box.ts`, `field-frame-variants.ts` and `number-field.tsx`, the docs Basic, Error, States and
 * Denomination demos, and Chromium's layout of the field with preflight and Fuse's built CSS on
 * 2026-10-27:
 *
 * - The group is `h-(--control-h-md)`, 36px dense and 44px comfortable, with a 1px border. Each stepper
 *   is `w-[max(var(--control-h-xs),24px)]` and `h-full`, 24×34 dense and 32×42 comfortable, with a 1px
 *   start border, `border-0 border-s`. The input fills the room the denomination and steppers leave.
 *   The standalone stepper's `h-full` takes that field box's content height, `control-h-md` less the
 *   two 1px borders, which `field-box-content-h` holds in each density.
 * - The field's parts sit 4px apart, FieldFrame's part spacing.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, FILL, fixed, HUG, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

/** The layer at a path of keys below a root. */
function at(layers: readonly ChildLayerSpec[], ...keys: readonly string[]): ChildLayerSpec | undefined {
  const [key, ...rest] = keys;
  const layer = layers.find((candidate) => candidate.key === key);
  return rest.length === 0 || layer?.kind !== "frame" ? layer : at(layer.children, ...rest);
}

describe("the Number field stepper component set", () => {
  it("sits on the Number field page at rest, hovered, disabled and read-only, with a swappable glyph", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "number-field-stepper");
    expect([set?.name, set?.page, set?.axes, set?.swapProperties.map((property) => property.name)]).toEqual([
      "Number field stepper",
      "page/number-field",
      [{ name: "state", values: ["rest", "hover", "disabled", "readonly"] }],
      ["Icon"],
    ]);
  });

  it("draws a control-h-xs column with a 1px input start edge, muted on hover and when disabled", () => {
    const stepper = (state: string) => variantRoot(spec, `number-field-stepper/state=${state}`);
    // Centred both ways and unpadded, so Figma centres the glyph in the content box the left stroke
    // leaves, at x 4.5 dense and 8.5 comfortable, as CSS does (W5-P7).
    expect(stepper("rest")).toMatchObject({
      sizing: { horizontal: fixed(density("control-h-xs")), vertical: fixed(density("field-box-content-h")) },
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      paddingLeft: literal(0),
      paddingRight: literal(0),
      fill: paint("background"),
      stroke: { color: paint("input"), sides: { top: 0, right: 0, bottom: 0, left: 1 } },
    });
    expect([stepper("hover").fill, stepper("disabled").fill, stepper("readonly").fill]).toEqual([
      paint("muted"),
      paint("muted"),
      paint("background"),
    ]);
    expect([stepper("rest").children[0], stepper("disabled").children[0]]).toMatchObject([
      { kind: "icon", icon: "icon/Plus", size: literal(16), color: paint("foreground") },
      { kind: "icon", color: paint("muted-foreground") },
    ]);
  });
});

describe("the Number field component set", () => {
  it("sits on the Number field page in five states, with the denomination behind a BOOLEAN that starts off", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "number-field");
    expect([set?.name, set?.page, set?.axes, set?.booleanProperties]).toEqual([
      "Number field",
      "page/number-field",
      [{ name: "state", values: ["rest", "focus", "disabled", "readonly", "invalid"] }],
      [{ name: "Denomination", defaultValue: false }],
    ]);
  });

  it("lays the value, the denomination and the filling steppers in the md field box, its parts 4px apart", () => {
    const root = variantRoot(spec, "number-field/state=rest");
    expect([root.sizing, root.itemSpacing]).toEqual([
      { horizontal: fixed(literal(384)), vertical: HUG },
      literal(4),
    ]);
    const group = at(root.children, "number-field", "group");
    expect(group).toMatchObject({
      direction: "HORIZONTAL",
      sizing: { horizontal: FILL, vertical: fixed(density("control-h-md")) },
      stroke: { color: paint("input"), weight: literal(1) },
    });
    expect(group?.kind === "frame" ? group.children.map((child) => child.key) : []).toEqual([
      "input",
      "denomination",
      "steppers",
    ]);
    expect(at(root.children, "number-field", "group", "input")).toMatchObject({
      sizing: { horizontal: FILL },
    });
    expect(at(root.children, "number-field", "group", "denomination")).toMatchObject({
      visibleProperty: "Denomination",
    });
    const steppers = at(root.children, "number-field", "group", "steppers");
    expect(
      steppers?.kind === "frame"
        ? steppers.children.map((child) =>
            child.kind === "instance"
              ? [child.key, child.variant, child.sizing.vertical, child.properties]
              : []
          )
        : []
    ).toEqual([
      ["decrease", "number-field-stepper/state=rest", FILL, { swap: { Icon: "icon/Minus" } }],
      ["increase", "number-field-stepper/state=rest", FILL, undefined],
    ]);
  });

  it("fills a disabled or read-only group muted and gives its steppers the matching state", () => {
    const group = (state: string) =>
      at(variantRoot(spec, `number-field/state=${state}`).children, "number-field", "group");
    const variants = (state: string) => {
      const steppers = at(
        variantRoot(spec, `number-field/state=${state}`).children,
        "number-field",
        "group",
        "steppers"
      );
      return steppers?.kind === "frame"
        ? steppers.children.map((child) => (child.kind === "instance" ? child.variant : ""))
        : [];
    };
    const disabled = group("disabled");
    expect(disabled?.kind === "frame" ? disabled.fill : undefined).toEqual(paint("muted"));
    expect([variants("disabled"), variants("readonly"), variants("invalid")]).toEqual([
      ["number-field-stepper/state=disabled", "number-field-stepper/state=disabled"],
      ["number-field-stepper/state=readonly", "number-field-stepper/state=readonly"],
      ["number-field-stepper/state=rest", "number-field-stepper/state=rest"],
    ]);
  });
});
