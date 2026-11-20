/**
 * The kit check's hold on where an instance's padding override applies. Unit under test:
 * `checkKitSpec` over a kit whose second set holds an instance of a Button that draws its label
 * inside a frame, with a `paddingLeft` override at the root or at that frame. Oracle: the build,
 * which carries a padding that differs on the inner root only (`instance-diff.ts`), and the plugin,
 * which writes and takes back a padding override on the root alone, so a spec that overrides a
 * frame's padding below the root names a write no Apply would make.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkKitSpec } from "../../src/components/kit-check.ts";
import type { InstanceOverride, KitSpec } from "../../src/components/kit-spec.ts";
import { frame, LABEL, literal, outerKit } from "./button-kit-fixture.ts";
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
