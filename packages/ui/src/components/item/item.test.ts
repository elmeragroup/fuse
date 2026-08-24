import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { focusRing } from "../../styles/utils";
import { itemVariants } from "./item-variants";

const here = dirname(fileURLToPath(import.meta.url));
const focusSelf = focusRing({ target: "self" }).root();

describe("itemVariants", () => {
  it("defaults to the default variant and size", () => {
    const classes = itemVariants();
    expect(classes).toContain("border-transparent");
    expect(classes).toContain("gap-3.5");
    expect(classes).toContain("px-4");
  });

  it("resolves each variant and size", () => {
    expect(itemVariants({ variant: "outline" })).toContain("border-border");
    expect(itemVariants({ variant: "muted" })).toContain("bg-muted/50");
    expect(itemVariants({ size: "sm" })).toContain("px-3");
    expect(itemVariants({ size: "xs" })).toContain("in-data-[slot=dropdown-menu-content]:p-0");
  });

  it("composes the shared self focus ring and never a dark variant", () => {
    const classes = itemVariants();
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(classes).toContain(token);
    }
    expect(classes).not.toContain("dark:");
  });
});

describe("item source contract", () => {
  it("keeps itemVariants public and drops RAC leftovers", () => {
    const source = [
      readFileSync(join(here, "item.tsx"), "utf8"),
      readFileSync(join(here, "item-variants.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).toContain("itemVariants");
    expect(source).toContain('slot: "item"');
    expect(source).toContain('hostProps.role = "listitem"');
  });
});
