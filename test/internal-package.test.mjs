import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString, isString, readJsonObject } from "./json-object.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8");

/** The one catalog entry for the in-house tooling package (tooling.md §2). */
function catalogVersion() {
  const match = /^  "@elmeragroup\/internal": (\S+)$/m.exec(workspace);
  if (match?.[1] === undefined)
    throw new Error("pnpm-workspace.yaml has no catalog entry for @elmeragroup/internal");
  return match[1];
}

describe("@elmeragroup/internal", () => {
  it("is pinned once, in the catalog, to an exact version", () => {
    expect(catalogVersion()).toMatch(/^\d+\.\d+\.\d+(-canary\.\d+)?$/);
    for (const manifest of ["package.json", join("apps", "docs", "package.json")]) {
      const devDependencies = asRecord(readJsonObject(join(repoRoot, manifest)).devDependencies, manifest);
      expect(asString(devDependencies["@elmeragroup/internal"], manifest)).toBe("catalog:");
    }
  });

  it("names the pinned canary in the release-age exclusion list, and nothing else of its own", () => {
    // A canary is younger than the 72-hour guard by definition; the exclusion is per exact
    // version so a bump has to be written down here too, next to the catalog pin.
    const exclusions = [...workspace.matchAll(/^  - "?@elmeragroup\/internal@(\S+?)"?$/gm)].map(
      (match) => match[1]
    );
    expect(exclusions).toEqual([catalogVersion()]);
  });

  it("provides both lint plugins .oxlintrc.json loads", () => {
    const plugins = readJsonObject(join(repoRoot, ".oxlintrc.json")).jsPlugins;
    if (!Array.isArray(plugins)) throw new Error("jsPlugins is not an array");
    const specifiers = asRecordArray(
      plugins.filter((plugin) => !isString(plugin)),
      "jsPlugins"
    ).map((plugin) => asString(plugin.specifier, "plugin specifier"));
    expect(specifiers).toEqual(["@elmeragroup/internal/oxlint", "@elmeragroup/internal/oxlint/anti-slop"]);
  });
});
