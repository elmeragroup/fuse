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
 * The catalog entry for a dependency.
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
      join("packages", "fuse", "package.json"),
    ]) {
      const devDependencies = asRecord(readJsonObject(join(repoRoot, manifest)).devDependencies, manifest);
      expect(asString(devDependencies["@elmeragroup/internal"], manifest)).toBe("catalog:");
    }
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

describe("minimumReleaseAgeExclude", () => {
  it("holds exactly the catalog-pinned permanent and temporary versions", () => {
    // A malformed extra entry fails the equality rather than being filtered away.
    const permanent = ["effect", "@elmeragroup/internal"];
    // tsrs 0.20.0 and its platform binaries are younger than the release-age guard until
    // 2026-10-29T11:47Z. Remove them here and in pnpm-workspace.yaml once they age past the guard.
    const tsrsPlatforms = [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64-gnu",
      "linux-arm64-musl",
      "linux-x64-gnu",
      "linux-x64-musl",
      "win32-x64",
    ];
    const temporary = [
      `tsrs@${catalogEntry("tsrs")}`,
      ...tsrsPlatforms.map((platform) => `@tsrs/${platform}@${catalogEntry("tsrs")}`),
    ];
    expect(workspace.minimumReleaseAgeExclude).toEqual([
      ...permanent.map((name) => `${name}@${catalogEntry(name)}`),
      ...temporary,
    ]);
  });
});
