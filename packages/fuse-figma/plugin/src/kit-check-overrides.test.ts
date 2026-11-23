/**
 * The kit check's hold on where an instance's padding override applies, and on the stroke an
 * instance leaves bare on some sides. Unit under test: `checkKitSpec` over a kit whose second set
 * holds an instance of a Button that draws its label inside a frame, with a `paddingLeft` override at
 * the root or at that frame, or a `strokeSides` override that leaves the root's left side bare.
 * Oracle: the build, which carries a padding that differs on the inner root only and bare sides only
 * of a solid stroke of one bound weight (`instance-diff.ts`), and the plugin, which writes and takes
 * back a padding override on the root alone and writes a bare side's 0 beside the inner weight the
 * other sides keep, so a spec outside those names a write no Apply would make.
 */
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { InstanceOverride, KitSpec, StrokeSpec } from "../../src/components/kit-spec.ts";
import { BARE_LEFT, frame, LABEL, literal, outerKit, strokedOuterKit } from "./button-kit-fixture.ts";
import { base64Decode } from "./fake/paints.ts";

/** The outer kit, its Button's label inside an `Inset` frame, with `override` on the instance. */
function paddedKit(override: InstanceOverride): KitSpec {
  const base = outerKit(LABEL);
  return {
    ...base,
    componentSets: base.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({
        ...variant,
        root: {
          ...variant.root,
          children: variant.root.children.map((layer) =>
            layer.kind === "instance"
              ? { ...layer, overrides: [override] }
              : frame("button/inset", "Inset", [layer])
          ),
        },
      })),
    })),
  };
}

/** The check's verdict: `accepted`, or the refusal's message. */
function verdict(kit: KitSpec): string {
  const checked = checkKitSpec(kit, base64Decode);
  return Result.isSuccess(checked) ? "accepted" : checked.failure.message;
}

describe("the kit check's instance padding overrides", () => {
  it("accepts a padding override on the instance's root", () => {
    expect(verdict(paddedKit({ path: [], field: "paddingLeft", value: literal(3) }))).toBe("accepted");
  });

  it("refuses a padding override on a frame below the root", () => {
    expect(verdict(paddedKit({ path: ["button/inset"], field: "paddingLeft", value: literal(3) }))).toBe(
      "Outer: Inner in the variant outer/size=md overrides the paddingLeft of button/inset, a layer below the root, and the kit overrides that field on the root alone."
    );
  });
});

describe("the kit check's bare stroke sides", () => {
  const BORDER = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
  const OUTLINE = {
    kind: "variable",
    variable: { collection: "Fuse tokens", name: "outline-width" },
  } as const;
  const over = (why: string) =>
    `Outer: Inner in the variant outer/size=md leaves sides of the root bare, whose stroke in Button button/size=md ${why}.`;

  // Oracle: `diffInstance`, which writes bare sides only over a main whose solid stroke takes the
  // same bound weight on every side, the one stroke the build writes bare sides beside.
  it("accepts bare sides over a solid stroke of one bound weight", () => {
    expect(verdict(strokedOuterKit({ color: BORDER, weight: OUTLINE }, [BARE_LEFT]))).toBe("accepted");
  });

  it.each([
    [
      "a solid stroke of a literal weight",
      { color: BORDER, weight: literal(1) },
      "takes a literal weight, whose bare sides the build writes as a weight on each side",
    ],
    [
      "a dashed stroke",
      { color: BORDER, weight: literal(1), dashPattern: [2, 2] },
      "is dashed, and the build leaves no side of a dashed stroke bare",
    ],
    [
      "a stroke of a weight on each side",
      { color: BORDER, sides: { top: 1, right: 1, bottom: 1, left: 0 } },
      "takes a weight on each side",
    ],
    [
      "a stroke of one weight already bare on another side",
      { color: BORDER, weight: OUTLINE, bare: ["right"] },
      "leaves sides bare already",
    ],
    ["no stroke", undefined, "draws no stroke"],
  ] as const)("refuses bare sides over %s", (_, stroke, why) => {
    expect(verdict(strokedOuterKit(stroke, [BARE_LEFT]))).toBe(over(why));
  });

  it.each([
    [[], "no side"],
    [["start"], 'a side "start", which no stroke has'],
    [["left", "left"], 'the "left" side twice'],
    [["top", "right", "bottom", "left"], "every side, which leaves no side the weight"],
    ["left", '"left", which is no list of sides'],
    [null, "null, which is no list of sides"],
  ])("refuses an override that leaves bare %j", (bare, fault) => {
    const override = { path: [], field: "strokeSides", bare } as const;
    // @ts-expect-error The plugin reads the kit as JSON, which carries no type, so these sides reach it.
    expect(verdict(strokedOuterKit({ color: BORDER, weight: OUTLINE }, [override]))).toBe(
      `Outer: Inner in the variant outer/size=md leaves sides of the root bare as no stroke the build writes does: ${fault}.`
    );
  });

  // Oracle: `readBareStroke` in `box-paint.ts`, which writes bare sides only beside a solid bound
  // weight, and draws a literal weight's as a weight on each side.
  it.each([
    [
      "a literal weight",
      { color: BORDER, weight: literal(1), bare: ["left"] },
      "leaves sides of a stroke of a literal weight bare, which the build draws as a weight on each side",
    ],
    [
      "dashes",
      { color: BORDER, weight: OUTLINE, bare: ["left"], dashPattern: [2, 2] },
      "leaves sides of a dashed stroke bare, which the build draws no stroke for",
    ],
    ["no side", { color: BORDER, weight: OUTLINE, bare: [] }, "leaves bare no side"],
    [
      "a side name",
      { color: BORDER, weight: OUTLINE, bare: "left" },
      'leaves bare "left", which is no list of sides',
    ],
    ["null", { color: BORDER, weight: OUTLINE, bare: null }, "leaves bare null, which is no list of sides"],
    [
      "a bound weight that names no variable",
      { color: BORDER, weight: { kind: "variable" }, bare: ["left"] },
      'leaves sides bare of a stroke of the weight {"kind":"variable"}, which is no literal weight or variable',
    ],
  ])("refuses a box's stroke that leaves sides bare beside %s", (_, stroke, fault) => {
    // @ts-expect-error The plugin reads the kit as JSON, which carries no type, so these strokes reach it.
    expect(verdict(strokedOuterKit(stroke, []))).toBe(
      `Button: button in the variant button/size=md ${fault}.`
    );
  });

  // Oracle: `SideStroke` and `EverySideStroke` in `kit-spec.ts`, whose four literal weights or one
  // weight `sideWeights` reads, and which the plugin's planner reads by the field each holds.
  it.each([
    [
      "no side weights",
      { color: BORDER, sides: null },
      "draws a stroke of null, which names no weight on each side",
    ],
    [
      "three side weights",
      { color: BORDER, sides: { top: 1, right: 1, bottom: 1 } },
      "draws a stroke of no weight on the left side",
    ],
    [
      "a weight on each side beside one weight",
      { color: BORDER, sides: { top: 1, right: 2, bottom: 3, left: 4 }, weight: OUTLINE },
      "names both a weight on each side and one weight of its stroke",
    ],
    [
      "a weight on each side beside dashes",
      { color: BORDER, sides: { top: 1, right: 2, bottom: 3, left: 4 }, dashPattern: [2, 2] },
      "dashes a stroke of a weight on each side, which the build draws solid",
    ],
  ])("refuses a box's stroke of %s", (_, stroke, fault) => {
    // @ts-expect-error The plugin reads the kit as JSON, which carries no type, so these strokes reach it.
    expect(verdict(strokedOuterKit(stroke, []))).toBe(
      `Button: button in the variant button/size=md ${fault}.`
    );
  });

  // The main's own box refuses the weight before the override's check reads it as the weight the
  // other sides keep.
  it("refuses bare sides over a main whose stroke weight is null", () => {
    // @ts-expect-error The plugin reads the kit as JSON, which carries no type, so this stroke reaches it.
    expect(verdict(strokedOuterKit({ color: BORDER, weight: null }, [BARE_LEFT]))).toBe(
      "Button: button in the variant button/size=md draws a stroke of the weight null, which is no literal weight or variable."
    );
  });

  // Oracle: `StrokeSidesOverride` in `kit-spec.ts`, whose four literal weights the plugin writes.
  it.each([
    [null, "null, which names no weight on each side"],
    [{}, "no weight on the top side"],
    [{ top: "1", right: 1, bottom: 1, left: 0 }, 'the top side\'s "1", which is no weight in pixels'],
  ])("refuses an override of the side weights %j", (sides, fault) => {
    const override = { path: [], field: "strokeSides", sides } as const;
    // @ts-expect-error The plugin reads the kit as JSON, which carries no type, so these weights reach it.
    expect(verdict(strokedOuterKit({ color: BORDER, weight: literal(1) }, [override]))).toBe(
      `Outer: Inner in the variant outer/size=md overrides the strokeSides of the root with ${fault}.`
    );
  });

  // The plugin reads the kit as JSON, which carries no type, and would write the bare sides where the
  // build's reader takes the weight on each side.
  it("refuses an override that names both a weight on each side and bare sides", () => {
    const mixed: InstanceOverride = {
      path: [],
      field: "strokeSides",
      sides: { top: 2, right: 2, bottom: 2, left: 2 },
      // @ts-expect-error A `strokeSides` override names a weight on each side or the sides it leaves bare.
      bare: ["left"],
    };
    expect(verdict(strokedOuterKit({ color: BORDER, weight: literal(2) }, [mixed]))).toBe(
      "Outer: Inner in the variant outer/size=md overrides the strokeSides of the root with both a weight on each side and bare sides, which the plugin and the build read apart."
    );
  });

  it("refuses a strokeSides override that names neither a weight on each side nor bare sides", () => {
    // @ts-expect-error A `strokeSides` override names a weight on each side or the sides it leaves bare.
    const neither: InstanceOverride = { path: [], field: "strokeSides" };
    expect(verdict(strokedOuterKit({ color: BORDER, weight: OUTLINE }, [neither]))).toBe(
      "Outer: Inner in the variant outer/size=md overrides the strokeSides of the root with neither a weight on each side nor bare sides, which leaves the plugin no weight to write."
    );
  });

  // Oracle: `StrokeSpec` and `InstanceOverride` in `kit-spec.ts`, which hold a weight on each side or
  // one weight with one to three bare sides. The build cannot write the shapes below, and the plugin
  // reads the kit as JSON, where the check refuses each.
  it("types out a stroke or override the check refuses as JSON", () => {
    const sides = { top: 1, right: 1, bottom: 1, left: 0 } as const;
    // @ts-expect-error A stroke names one weight with its bare sides, or a weight on each side.
    const both: StrokeSpec = { color: BORDER, weight: OUTLINE, bare: ["left"], sides };
    // @ts-expect-error A stroke leaves one to three sides bare.
    const every: StrokeSpec = { color: BORDER, weight: OUTLINE, bare: ["top", "right", "bottom", "left"] };
    // @ts-expect-error An override leaves one to three sides bare.
    const none: InstanceOverride = { path: [], field: "strokeSides", bare: [] };
    expect([
      verdict(strokedOuterKit(both, [])),
      verdict(strokedOuterKit(every, [])),
      verdict(strokedOuterKit({ color: BORDER, weight: OUTLINE }, [none])),
    ]).toEqual([
      "Button: button in the variant button/size=md names both a weight on each side and bare sides of its stroke.",
      "Button: button in the variant button/size=md leaves bare every side, which leaves no side the weight.",
      "Outer: Inner in the variant outer/size=md leaves sides of the root bare as no stroke the build writes does: no side.",
    ]);
  });
});
