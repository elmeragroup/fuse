import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { withLocale } from "../../../test/locale-matrix";
import { atHostRoots, expectTargets } from "../../../test/target-size";
import { renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Combobox } from "./index";

/**
 * The chip-remove buttons' 24px targets (WCAG 2.5.8), on one row and on two wrapped rows, at both
 * densities and at the 16px root and a 14px host root. The floor is a fixed 24px, so a host root
 * below 16px, which scales the rem chip line and hit area, must not take a target under it.
 */

const HOST_ROOTS = [16, 14] as const;

/** Run a check at every host root and density. */
function atEveryRootAndDensity(check: (at: string) => void): void {
  atHostRoots(HOST_ROOTS, (root) => {
    for (const density of DENSITIES) {
      stampDensity(density);
      check(`${density} ${String(root)}px`);
    }
  });
}

/** The chip around a remove button. */
function chipOf(remove: HTMLElement): HTMLElement {
  const chip = remove.parentElement;
  if (chip === null) {
    throw new Error("expected the remove button inside its chip");
  }
  return chip;
}

describe("Combobox chip targets", () => {
  it("fits the chip-remove button inside its chip with a 24px target on one row", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Combobox.Root multiple defaultValue={["Apple", "Banana"]}>
          <Combobox.Chips aria-label="Selected fruit">
            <Combobox.Chip>Apple</Combobox.Chip>
            <Combobox.Chip>Banana</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Fruit" />
          </Combobox.Chips>
        </Combobox.Root>
      )
    );
    const remove = roleNamed("button", "Remove Apple");
    const nextRemove = roleNamed("button", "Remove Banana");
    const chip = chipOf(remove);
    const nextChip = chipOf(nextRemove);
    atEveryRootAndDensity((at) => {
      const box = remove.getBoundingClientRect();
      const chipBox = chip.getBoundingClientRect();
      expect(box.left, `${at} left edge`).toBeGreaterThanOrEqual(chipBox.left);
      expect(box.right, `${at} right edge`).toBeLessThanOrEqual(chipBox.right);
      expect(box.top, `${at} top edge`).toBeGreaterThanOrEqual(chipBox.top);
      expect(box.bottom, `${at} bottom edge`).toBeLessThanOrEqual(chipBox.bottom);
      expectTargets([remove, nextRemove], at);
      // The target stays off the neighbouring chip at the chips' gap.
      const nextBox = nextChip.getBoundingClientRect();
      const hit = document.elementFromPoint(nextBox.left + 0.5, nextBox.top + nextBox.height / 2);
      expect(nextChip.contains(hit), `${at} next chip keeps its edge`).toBe(true);
    });
  });

  it.each(["default", "sm"] as const)("keeps the 24px targets of %s chips on two rows apart", (size) => {
    // Two chips of one width in a box too narrow for both, so they wrap onto two rows with their
    // remove buttons one above the other.
    renderThemed(
      withLocale(
        "en-US",
        <Combobox.Root multiple defaultValue={["Fig one", "Fig two"]}>
          <Combobox.Chips aria-label="Wrapped fruit" size={size} style={{ width: 64 }}>
            <Combobox.Chip removeLabel="Remove upper fig">Fig</Combobox.Chip>
            <Combobox.Chip removeLabel="Remove lower fig">Fig</Combobox.Chip>
            <Combobox.ChipsInput aria-label="Fruit" />
          </Combobox.Chips>
        </Combobox.Root>
      )
    );
    const upper = roleNamed("button", "Remove upper fig");
    const lower = roleNamed("button", "Remove lower fig");
    atEveryRootAndDensity((at) => {
      expect(lower.getBoundingClientRect().top, `${size} ${at} wraps`).toBeGreaterThan(
        upper.getBoundingClientRect().bottom
      );
      expectTargets([upper, lower], `${size} ${at}`);
    });
  });
});
