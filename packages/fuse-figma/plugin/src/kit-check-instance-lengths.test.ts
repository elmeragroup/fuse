/**
 * The kit check's hold on an instance's fixed length against the limits it keeps. Unit under test:
 * `checkKitSpec` over a kit whose second set holds an instance of a Button that hugs both axes.
 * Oracle: Figma clamps a fixed length to a limit, so a literal length outside a literal limit would
 * be written on every run. The spec holds no value a variable takes in a mode, so a bound length or
 * limit shows no conflict: `row-h` against itself agrees in every mode, and Button's `control-h-md`,
 * 36 dense and 44 comfortable, sits inside a 60px cap.
 */
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { InstanceLayerSpec, KitSpec, LimitsSpec, NumberSpec } from "../../src/components/kit-spec.ts";
import { NO_LIMITS } from "../../src/components/kit-spec.ts";
import { LABEL, literal, outerKit } from "./button-kit-fixture.ts";
import { base64Decode } from "./fake/paints.ts";

/** A bound number, whose value the spec does not hold. */
const bound = (name: string): NumberSpec => ({
  kind: "variable",
  variable: { collection: "Fuse tokens", name },
});
const ROW_H = bound("row-h");

/**
 * The outer kit with both roots hugging both axes within `limits`, and `edit` on the Button instance.
 * The outer root holds only the instance, so its own limits refuse nothing.
 */
function limitedKit(
  limits: Partial<LimitsSpec>,
  edit: (layer: InstanceLayerSpec) => InstanceLayerSpec
): KitSpec {
  const base = outerKit(LABEL);
  return {
    ...base,
    componentSets: base.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({
        ...variant,
        root: {
          ...variant.root,
          sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
          limits: { ...NO_LIMITS, ...limits },
          children: variant.root.children.map((layer) => (layer.kind === "instance" ? edit(layer) : layer)),
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

/** An instance fixed at `height` on its vertical axis. */
const fixedHeight =
  (height: NumberSpec) =>
  (layer: InstanceLayerSpec): InstanceLayerSpec => ({
    ...layer,
    sizing: { ...layer.sizing, vertical: { kind: "fixed", length: height } },
  });

const WHERE = "Outer: Inner in the variant outer/size=md";

describe("the kit check's instance lengths against their limits", () => {
  it.each<readonly [string, Partial<LimitsSpec>, (layer: InstanceLayerSpec) => InstanceLayerSpec, string]>([
    [
      "a fixed height above its main's minimum",
      { minHeight: literal(40) },
      fixedHeight(literal(48)),
      "accepted",
    ],
    [
      "a fixed height below its main's minimum",
      { minHeight: literal(64) },
      fixedHeight(literal(48)),
      `${WHERE} fixes its height at 48, outside its minHeight of 64, and Figma clamps a fixed length to its limits, so the plan would write the height on every run.`,
    ],
    [
      "a fixed height above its main's maximum",
      { maxHeight: literal(40) },
      fixedHeight(literal(48)),
      `${WHERE} fixes its height at 48, outside its maxHeight of 40, and Figma clamps a fixed length to its limits, so the plan would write the height on every run.`,
    ],
    [
      "a fixed width below the minimum it carries over its main's",
      { minWidth: literal(80) },
      (layer) => ({
        ...layer,
        minWidth: literal(120),
        sizing: { ...layer.sizing, horizontal: { kind: "fixed", length: literal(100) } },
      }),
      `${WHERE} fixes its width at 100, outside its minWidth of 120, and Figma clamps a fixed length to its limits, so the plan would write the width on every run.`,
    ],
    [
      "a literal fixed height where its main binds its minimum",
      { minHeight: ROW_H },
      fixedHeight(literal(48)),
      "accepted",
    ],
    [
      "a fixed height bound to the variable its main's minimum binds",
      { minHeight: ROW_H },
      fixedHeight(ROW_H),
      "accepted",
    ],
    [
      "a fixed height bound to control-h-md under its main's 60px cap",
      { maxHeight: literal(60) },
      fixedHeight(bound("control-h-md")),
      "accepted",
    ],
  ])("judges %s", (_case, limits, edit, expected) => {
    expect(verdict(limitedKit(limits, edit))).toBe(expected);
  });
});
