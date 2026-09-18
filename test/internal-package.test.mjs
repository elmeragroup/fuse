import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { asRecord, asRecordArray, asString, isString, readJsonObject } from "./json-object.mjs";
import { repoRoot } from "./repo-tree.mjs";

const workspace = asRecord(
  parse(readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8")),
  "pnpm-workspace.yaml"
);

/**
 * The catalog entry for a dependency (tooling.md §2).
 * @param {string} name
 */
function catalogEntry(name) {
  return asString(asRecord(workspace.catalog, "catalog")[name], `catalog.${name}`);
}

describe("@elmeragroup/internal", () => {
  it("is pinned once, in the catalog, to an exact version", () => {
    expect(catalogEntry("@elmeragroup/internal")).toMatch(/^\d+\.\d+\.\d+(-canary\.\d+)?$/);
    for (const manifest of [
      "package.json",
      join("apps", "docs", "package.json"),
      join("packages", "ui", "package.json"),
    ]) {
      const devDependencies = asRecord(readJsonObject(join(repoRoot, manifest)).devDependencies, manifest);
      expect(asString(devDependencies["@elmeragroup/internal"], manifest)).toBe("catalog:");
    }
  });

  it("names the pinned canary in the release-age exclusion list, and nothing else of its own", () => {
    // A canary is younger than the 72-hour guard by definition; the exclusion is per exact
    // version so a bump has to be written down here too, next to the catalog pin.
    const exclusions = workspace.minimumReleaseAgeExclude;
    if (!Array.isArray(exclusions)) throw new Error("minimumReleaseAgeExclude is not an array");
    const internalExclusions = exclusions
      .filter(isString)
      .filter((entry) => entry.startsWith("@elmeragroup/internal@"))
      .map((entry) => entry.slice("@elmeragroup/internal@".length));
    expect(internalExclusions).toEqual([catalogEntry("@elmeragroup/internal")]);
  });

  it("pins effect to the exact version the engine declares", () => {
    const engine = asRecord(
      readJsonObject(join(repoRoot, "node_modules", "@elmeragroup", "internal", "package.json")).dependencies,
      "@elmeragroup/internal dependencies"
    );
    expect(catalogEntry("effect")).toBe(asString(engine.effect, "@elmeragroup/internal dependencies.effect"));
    const devDependencies = asRecord(
      readJsonObject(join(repoRoot, "package.json")).devDependencies,
      "package.json devDependencies"
    );
    expect(asString(devDependencies.effect, "package.json devDependencies.effect")).toBe("catalog:");
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
