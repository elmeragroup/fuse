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
    // kbd.browser.test.tsx measures the 20px height and 12px text; the width floor shows only here.
    expect(tokens(styles.cap())).toEqual(expect.arrayContaining(["min-w-5", "px-1"]));
  });

  it("paints the cap from the muted and border role pairs only", () => {
    // kbd.browser.test.tsx reads the muted pair off the live cap.
    expect(tokens(styles.cap())).toEqual(expect.arrayContaining(["border", "border-border"]));
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
