import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

describe("file-trigger package surface", () => {
  it("is a subpath-only react-aria entry whose only value export is FileTrigger", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/file-trigger");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["FileTrigger"]);
    expect(entry?.sourceFile).toBe("src/react-aria/file-trigger.ts");
    expect(root?.runtimeExports).not.toContain("FileTrigger");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/file-trigger");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("file-trigger");
  }, 30_000);
});
