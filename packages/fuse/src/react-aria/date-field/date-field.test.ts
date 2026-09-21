import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { dateFieldVariants } from "../../styles/date-field";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

describe("dateFieldVariants", () => {
  it("reads the md padding and control type pair on the DateInput slot, with no py-*", () => {
    const input = dateFieldVariants().input();
    expect(input).toContain("px-(--control-px-md)");
    expect(input).toContain("[font-size:var(--control-text)]");
    expect(input).toContain("[line-height:var(--control-leading)]");
    expect(input).not.toContain("py-");
    expect(input).not.toContain("text-sm");
    expect(input).not.toContain("px-2");
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

describe("date-field package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are DateField and DateInput", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/date-field");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["DateField", "DateInput"]);
    expect(entry?.sourceFile).toBe("src/react-aria/date-field.ts");
    expect(root?.runtimeExports).not.toContain("DateField");
    expect(root?.runtimeExports).not.toContain("DateInput");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/date-field");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("date-field");
  }, 30_000);
});
