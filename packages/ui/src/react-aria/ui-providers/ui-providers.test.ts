import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");
const source = readFileSync(join(here, "ui-providers.tsx"), "utf8");
const facade = readFileSync(join(here, "../ui-providers.ts"), "utf8");
const forbiddenIdentifiers = [/\buserAgent\b/, /\bUserAgentParserResult\b/, /@elmeragroup\/lib/] as const;

function expectNoForbiddenIdentifiers(text: string): void {
  for (const pattern of forbiddenIdentifiers) {
    expect(text).not.toMatch(pattern);
  }
}

describe("ui-providers source contract", () => {
  it("rejects the deleted user-agent API, @elmeragroup/lib, and .ref leakage", () => {
    for (const text of [source, facade]) {
      expectNoForbiddenIdentifiers(text);
      expect(text).not.toContain(".ref/");
    }
  });
});

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

  it("keeps the forbidden identifiers out of this entry and the package manifest", () => {
    const manifest = readFileSync(join(packageRoot, "package.json"), "utf8");
    for (const text of [source, facade, manifest]) {
      expectNoForbiddenIdentifiers(text);
    }
  });
});
