/**
 * Unit under test: the corners and side weights of each member of the Button group set, as the kit
 * builds them: each instance's corner and stroke-side overrides over its inner Button or Icon button
 * variant, resolved in the in-memory file the token sync writes under every pin a designer can give
 * a frame (`test/mode-sweep.ts`).
 * Oracle: Chromium's computed `border-*-radius` and `border-*-width` of each member of the real Fuse
 * ButtonGroup, rendered as `figma:capture` renders the docs demos, under the theme each pin stamps.
 * The group rounds a member's outer corners with `rounded-md`, squares its inner ones and collapses
 * the border it shares with the member before it, whatever corner the identity gives `radius-md` or
 * width it gives the outline. `figma:capture --check` reads one theme, and the frozen keys and the
 * inventory counts read no corner or weight.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import { named, pixelsIn, sweepSet, sweptFile } from "../../test/mode-sweep.ts";
import type { SweptCell, SweptFile } from "../../test/mode-sweep.ts";
import { cornerLengths } from "./corner-spec.ts";
import { bareSideWeights, leavesSidesBare, strokeRoom, ZERO } from "./kit-spec.ts";
import type { InstanceLayerSpec, InstanceOverride, NumberSpec, StrokeSide } from "./kit-spec.ts";

/** The CSS longhands of each Figma corner, in Figma's order, and of each side. */
const CORNERS = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
] as const;

const SIDES = [
  ["top", "border-top-width"],
  ["right", "border-right-width"],
  ["bottom", "border-bottom-width"],
  ["left", "border-left-width"],
] as const satisfies readonly (readonly [StrokeSide, string])[];

let kit: BuiltSets;
let file: SweptFile;
let swept: readonly SweptCell[];

beforeAll(async () => {
  [kit, file] = await Promise.all([builtKit(), sweptFile()]);
  swept = await sweepSet("button-group", () => true, file.modes, [
    ...CORNERS,
    ...SIDES.map(([, css]) => css),
  ]);
});

/** The override of a field a member gives its root, at the empty key path. */
function rootOverride(
  member: InstanceLayerSpec,
  field: InstanceOverride["field"]
): InstanceOverride | undefined {
  return member.overrides?.find((each) => each.field === field && each.path.length === 0);
}

/** A member's four corners as the instance draws them: its root's override, or its inner variant's. */
function cornersOf(member: InstanceLayerSpec): readonly NumberSpec[] {
  const override = rootOverride(member, "cornerRadius");
  const lengths = cornerLengths(
    override?.field === "cornerRadius" ? override.value : variantRoot(kit.spec, member.variant).cornerRadius
  );
  // One length rounds every corner.
  return lengths.length === 1 ? CORNERS.map(() => lengths[0] ?? ZERO) : lengths;
}

/**
 * A member's weight on each side as the instance draws it: the sides its root's `strokeSides`
 * override leaves bare of its inner variant's stroke, or else that stroke. An override the plugin
 * would refuse draws no side.
 *
 * @throws An `Error` for an override of a weight on each side, which no member of the set takes:
 *   the first member in each orientation keeps all four sides and takes no `strokeSides` override,
 *   and each other member's override leaves sides of its Button's bound weight bare, so the sweep
 *   reads that form alone.
 */
function sidesOf(member: InstanceLayerSpec): readonly NumberSpec[] {
  const override = rootOverride(member, "strokeSides");
  const { stroke } = variantRoot(kit.spec, member.variant);
  if (override?.field === "strokeSides" && override.sides !== undefined) {
    throw new Error(`${member.key} overrides a weight on each side, which no Button group member takes`);
  }
  if (override !== undefined && leavesSidesBare(override)) {
    const weights = bareSideWeights(stroke, override.bare);
    return weights === undefined ? [] : SIDES.map(([side]) => weights[side]);
  }
  return SIDES.map(([side]) => strokeRoom(stroke, side));
}

/** Where a member's built lengths and Chromium's computed ones differ, as one line each. */
function apart(
  each: SweptCell,
  lengths: (member: InstanceLayerSpec) => readonly NumberSpec[],
  properties: readonly string[]
): readonly string[] {
  const members = variantRoot(kit.spec, each.key).children.filter(
    (layer): layer is InstanceLayerSpec => layer.kind === "instance"
  );
  const rendered = each.elements.filter((element) => element.place === "button");
  if (rendered.length !== members.length) {
    return [`${each.key} ${named(each.mode)}: ${members.length} members built, ${rendered.length} rendered`];
  }
  return members.flatMap((member, index) => {
    const figma = lengths(member).map((length) => pixelsIn(file.figma, length, each.mode));
    const chromium = properties.map((property) => Number.parseFloat(rendered[index]?.styles[property] ?? ""));
    return figma.length === chromium.length &&
      figma.every((value, at) => Math.abs(value - (chromium[at] ?? Number.NaN)) <= 0.01)
      ? []
      : [
          `${each.key} ${member.key} ${named(each.mode)}: ${figma.join(" ")} in Figma, ${chromium.join(" ")} in Chromium`,
        ];
  });
}

describe("the Button group set", () => {
  it("rounds each member's corners as Chromium does under every pin", () => {
    expect(new Set(swept.map(({ mode }) => mode))).toEqual(new Set(file.modes));
    expect(swept.flatMap((each) => apart(each, cornersOf, CORNERS))).toEqual([]);
  });

  it("weighs each member's sides as Chromium does under every pin", () => {
    expect(
      swept.flatMap((each) =>
        apart(
          each,
          sidesOf,
          SIDES.map(([, css]) => css)
        )
      )
    ).toEqual([]);
  });
});
