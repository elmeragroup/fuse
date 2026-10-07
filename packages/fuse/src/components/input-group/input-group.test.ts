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
    expect(inputGroupAddonVariants()).toContain("pl-2");
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
  it("defaults to the compact xs addon size, squares the icon values, and keeps Button's md box for sm", () => {
    expect(tokens(inputGroupButtonVariants())).toContain("h-[max(1.5rem,24px)]");

    expect(tokens(inputGroupButtonVariants({ size: "icon-xs" }))).toEqual(
      expect.arrayContaining(["size-[max(1.5rem,24px)]", "p-0"])
    );
    expect(tokens(inputGroupButtonVariants({ size: "icon-sm" }))).toEqual(
      expect.arrayContaining(["size-8", "p-0"])
    );

    for (const token of tokens(inputGroupButtonVariants({ size: "sm" }))) {
      expect(token, token).not.toMatch(/^(?:h|size)-/);
    }
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

  it("is a shell-local exemption: no control size of its own and no density variants", () => {
    for (const size of BUTTON_SIZES) {
      const resolved = inputGroupButtonVariants({ size });
      // The addon reads only the md control parts it shares with the field box: the icon edge
      // at every size, and the inset at sm.
      const metrics = new Set([...resolved.matchAll(/--control-[a-z-]+/gu)].map(([name]) => name));
      const allowed = size === "sm" ? ["--control-px-icon-md", "--control-px-md"] : ["--control-px-icon-md"];
      expect([...metrics].toSorted(), size).toEqual(allowed);
      expect(resolved, size).not.toContain("dense:");
      expect(resolved, size).not.toContain("comfortable:");
      expect(resolved, size).not.toContain("data-density");
    }
  });
});
