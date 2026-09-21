import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("ui-providers package surface", () => {
  // Timeout: discoverEntries walks the published import graph; slow under full-gate parallel load.
  it("is a subpath-only react-aria entry whose only value export is UiProviders", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/ui-providers");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["UiProviders"]);
    expect(entry?.sourceFile).toBe("src/react-aria/ui-providers.ts");
    expect(root?.runtimeExports).not.toContain("UiProviders");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/ui-providers");
  }, 30_000);
});
