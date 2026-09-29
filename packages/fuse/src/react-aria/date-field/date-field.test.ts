import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { dateFieldVariants } from "../../styles/date-field";

describe("dateFieldVariants", () => {
  it("floors only a box the field paints itself, and never sets the box's display", () => {
    const own = dateFieldVariants({ surface: "own" }).input();
    const group = dateFieldVariants({ surface: "group" }).input();
    expect(own).toContain("min-w-[150px]");
    expect(group).not.toContain("min-w-");
    for (const input of [own, group]) {
      expect(input).not.toMatch(/(?:^|\s)(?:block|flex|grid|inline)(?:\s|$)/u);
    }
  });

  it("emits no size axis and no raw palette", () => {
    expect(dateFieldVariants.variantKeys).not.toContain("size");
    const emitted = [false, true]
      .flatMap((isPlaceholder) =>
        [false, true].flatMap((isDisabled) =>
          [false, true].map((isFocused) => {
            const slots = dateFieldVariants({ isPlaceholder, isDisabled, isFocused });
            return [slots.base(), slots.input(), slots.segment()].join(" ");
          })
        )
      )
      .join(" ");
    expect(emitted).not.toMatch(RAW_PALETTE_RE);
  });
});
