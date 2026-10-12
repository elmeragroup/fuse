import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { kbdVariants } from "./kbd-variants";

const styles = kbdVariants();

function tokens(classes: string): string[] {
  return classes.split(/\s+/u);
}

describe("kbdVariants", () => {
  it("sizes the cap with fixed lengths, never a density metric", () => {
    for (const slot of [styles.cap(), styles.group()]) {
      expect(slot).not.toMatch(/--(?:control|row|surface|label)-/u);
    }
    expect(tokens(styles.cap())).toEqual(expect.arrayContaining(["h-5", "min-w-5", "px-1", "text-xs"]));
  });

  it("paints the cap from the muted and border role pairs only", () => {
    expect(tokens(styles.cap())).toEqual(
      expect.arrayContaining(["bg-muted", "text-muted-foreground", "border", "border-border"])
    );
    expect(styles.cap()).not.toMatch(RAW_PALETTE_RE);
    expect(styles.cap()).not.toContain("dark:");
  });

  it("rounds the cap and the group with the sm rung, and the group hands its corner to its caps", () => {
    expect(tokens(styles.cap())).toContain("rounded-sm");
    expect(tokens(styles.group())).toEqual(
      expect.arrayContaining(["rounded-sm", "*:data-[slot=kbd]:rounded-[inherit]"])
    );
  });
});
