import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

describe("calendar package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are Calendar and the header parts", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/calendar");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["Calendar", "CalendarHeader", "CalendarGridHeader"]);
    expect(entry?.sourceFile).toBe("src/react-aria/calendar.ts");
    expect(root?.runtimeExports).not.toContain("Calendar");
    expect(root?.runtimeExports).not.toContain("CalendarHeader");
    expect(root?.runtimeExports).not.toContain("CalendarGridHeader");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/calendar");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("calendar");
  }, 30_000);
});
