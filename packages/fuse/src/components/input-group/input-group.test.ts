import { describe, expect, it } from "vitest";

import { controlMd } from "../../styles/control-size-md";
import { inputGroupAddonVariants, inputGroupButtonVariants } from "./input-group-variants";

const ALIGNMENTS = ["inline-start", "inline-end", "block-start", "block-end"] as const;
const BUTTON_SIZES = ["xs", "sm", "icon-xs", "icon-sm"] as const;

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

describe("inputGroupAddonVariants", () => {
  it("defaults to the inline-start rail and resolves every align value with the shared rail base", () => {
    expect(inputGroupAddonVariants()).toContain("order-first");
    expect(inputGroupAddonVariants()).toContain("pl-(--control-px-icon-md)");
    // The addon text is the group's field text, md density type unless the group is sm.
    expect(inputGroupAddonVariants()).toContain("text-[length:var(--field-text,var(--control-text))]");
    for (const align of ALIGNMENTS) {
      const resolved = inputGroupAddonVariants({ align });
      expect(resolved, align).toContain("cursor-text");
      expect(resolved, align).toContain("text-muted-foreground");
      expect(resolved, align).not.toContain("group-data-[disabled=true]");
      expect(resolved, align).not.toContain("dark:");
    }
    expect(inputGroupAddonVariants({ align: "inline-end" })).toContain("order-last");
    expect(inputGroupAddonVariants({ align: "block-start" })).toContain("w-full");
    expect(inputGroupAddonVariants({ align: "block-end" })).toContain("w-full");
  });
});

describe("inputGroupButtonVariants", () => {
  it("defaults to the xs rung, squares icon-xs on the xs rung and icon-sm on the field's inner square, and gives sm the field height", () => {
    expect(tokens(inputGroupButtonVariants())).toContain("h-[max(var(--control-h-xs),24px)]");

    expect(tokens(inputGroupButtonVariants({ size: "icon-xs" }))).toEqual(
      expect.arrayContaining(["size-[max(var(--control-h-xs),24px)]", "p-0"])
    );
    expect(tokens(inputGroupButtonVariants({ size: "icon-sm" }))).toEqual(
      // `--field-inner`: the sm square in a default group, the floored xs square in an sm one.
      expect.arrayContaining(["size-[var(--field-inner,var(--control-h-sm))]", "p-0"])
    );

    // sm keeps Button's md label but takes the group's field height, md outside an sm group.
    expect(
      tokens(inputGroupButtonVariants({ size: "sm" })).filter((token) => /^(?:h|size)-/.test(token))
    ).toEqual(["h-[var(--field-h,var(--control-h-md))]"]);
  });

  it("pads every addon with the md control icon edge and sm with the md inset, not Button's own", () => {
    // Unit under test: the addon padding. Oracle: the md control parts the field box and
    // Button's md label share, which the addon forwards whole.
    for (const size of BUTTON_SIZES) {
      const resolved = tokens(inputGroupButtonVariants({ size }));
      expect(resolved, size).toEqual(expect.arrayContaining(tokens(controlMd.iconEdge())));
      expect(resolved.join(" "), size).not.toContain("--control-px-button");
    }
    expect(tokens(inputGroupButtonVariants({ size: "sm" }))).toEqual(
      expect.arrayContaining(tokens(controlMd.inset()))
    );
  });

  it("reads only existing rungs and the field height, and no density variants", () => {
    // Every size keeps the field's md icon edge. The box reads the xs rung, or the field's inner
    // square with its sm fallback for icon-sm, and sm keeps the md inset and reads the field height
    // with its md fallback.
    const expected = {
      xs: ["--control-gap-xs", "--control-h-xs", "--control-px-icon-md", "--control-px-icon-xs"],
      sm: ["--control-h-md", "--control-px-icon-md", "--control-px-md"],
      "icon-xs": ["--control-h-xs", "--control-px-icon-md"],
      "icon-sm": ["--control-h-sm", "--control-px-icon-md"],
    } as const satisfies Record<(typeof BUTTON_SIZES)[number], readonly string[]>;
    for (const size of BUTTON_SIZES) {
      const resolved = inputGroupButtonVariants({ size });
      const metrics = new Set([...resolved.matchAll(/--control-[a-z-]+/gu)].map(([name]) => name));
      expect([...metrics].toSorted(), size).toEqual(expected[size]);
      expect(resolved, size).not.toContain("dense:");
      expect(resolved, size).not.toContain("comfortable:");
      expect(resolved, size).not.toContain("data-density");
    }
  });
});
