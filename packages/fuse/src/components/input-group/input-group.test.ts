import { describe, expect, it } from "vitest";

import { controlMd } from "../../styles/control-size-md";
import { inputGroupButtonVariants } from "./input-group-variants";

const BUTTON_SIZES = ["xs", "sm", "icon-xs", "icon-sm"] as const;

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

describe("inputGroupButtonVariants", () => {
  it("pads every addon with the md control icon edge and sm with the field inset, not Button's own", () => {
    // Unit under test: the addon padding. Oracle: the md control icon edge the field box and
    // Button's md label share, which the addon forwards whole, and the field inset with its md
    // fallback.
    for (const size of BUTTON_SIZES) {
      const resolved = tokens(inputGroupButtonVariants({ size }));
      expect(resolved, size).toEqual(expect.arrayContaining(tokens(controlMd.iconEdge())));
      expect(resolved.join(" "), size).not.toContain("--control-px-button");
    }
    expect(tokens(inputGroupButtonVariants({ size: "sm" }))).toEqual(
      expect.arrayContaining(["px-[var(--field-px,var(--control-px-md))]"])
    );
  });
});
