import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

describe("date-range-picker package surface", () => {
  it("is a subpath-only react-aria entry publishing exactly the one documented name", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/date-range-picker");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["DateRangePicker"]);
    expect(entry?.sourceFile).toBe("src/react-aria/date-range-picker.ts");
    expect(root?.runtimeExports).not.toContain("DateRangePicker");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/date-range-picker");
    // The bare path stays reserved for the base-ui successor.
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("date-range-picker");
  }, 30_000);
});
