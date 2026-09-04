import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { discoverJsEntriesFromAllowlist } from "../scripts/entries";
import { buildSourceExportMap, exportBindingTarget, renderRootBarrel } from "../scripts/generate-exports";

const scratchDirs: string[] = [];

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function write(packageRoot: string, relative: string, contents: string): void {
  const path = join(packageRoot, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
}

function scratchPackage(files: Record<string, string>): string {
  const packageRoot = mkdtempSync(join(tmpdir(), "elmera-ui-barrel-"));
  scratchDirs.push(packageRoot);
  write(packageRoot, "src/styles/ui.css", "/* fixture */\n");
  write(packageRoot, "src/index.ts", "export {};\n");
  write(packageRoot, "src/theme.ts", `export { ThemeProvider } from "./theme/theme-provider";\n`);
  for (const [relative, contents] of Object.entries(files)) {
    write(packageRoot, relative, contents);
  }
  return packageRoot;
}

describe("barrel generation", () => {
  it("picks up an allowlisted scratch facade without editing shared files", () => {
    const packageRoot = scratchPackage({
      "src/badge.ts": `export { Badge } from "./components/badge/badge";\n`,
      "src/theme/theme-provider.ts": `export const ThemeProvider = 1;\n`,
      "src/components/badge/badge.ts": `export const Badge = 1;\n`,
    });

    const jsEntries = discoverJsEntriesFromAllowlist(packageRoot, [".", "theme", "badge"]);
    const discovered = { jsEntries, cssEntries: [], assetPatterns: [], sourceFiles: [] };
    const badge = jsEntries.find((entry) => entry.subpath === "badge");
    expect(badge?.inRootBarrel).toBe(true);
    expect(badge?.runtimeExports).toEqual(["Badge"]);
    expect(renderRootBarrel(discovered)).toContain(`export * from "./badge";`);
    expect(renderRootBarrel(discovered)).toContain(`export * from "./theme";`);
    expect(renderRootBarrel(discovered)).not.toContain(`export * from "./icons";`);
    expect(exportBindingTarget(buildSourceExportMap(discovered), "./badge")).toEqual({
      types: "./src/badge.ts",
      import: "./src/badge.ts",
    });
    expect(jsEntries.find((entry) => entry.subpath === ".")?.runtimeExports).toContain("Badge");
  });

  it("fails generation when two barrel facades export the same value name", () => {
    const packageRoot = scratchPackage({
      "src/badge.ts": `export { Shared } from "./components/badge/badge";\n`,
      "src/button.ts": `export { Shared } from "./components/button/button";\n`,
    });

    expect(() => discoverJsEntriesFromAllowlist(packageRoot, [".", "theme", "badge", "button"])).toThrow(
      /Duplicate barrel export Shared from badge and button/
    );
  });

  it("fails generation when a facade uses export *", () => {
    const packageRoot = scratchPackage({
      "src/button.ts": `export * from "./components/button/button";\n`,
    });

    expect(() => discoverJsEntriesFromAllowlist(packageRoot, [".", "theme", "button"])).toThrow(/export \*/);
  });

  it("throws with the entry name when a non-deferred allowlisted entry has no source", () => {
    const packageRoot = scratchPackage({
      "src/theme/theme-provider.ts": `export const ThemeProvider = 1;\n`,
    });

    expect(() => discoverJsEntriesFromAllowlist(packageRoot, [".", "theme", "button"], ["chart"])).toThrow(
      /Missing source entry for button/
    );
  });

  it("omits a deferred entry from the produced map and counts allowlist minus deferred", () => {
    const packageRoot = scratchPackage({
      "src/badge.ts": `export { Badge } from "./components/badge/badge";\n`,
      "src/theme/theme-provider.ts": `export const ThemeProvider = 1;\n`,
      "src/components/badge/badge.ts": `export const Badge = 1;\n`,
    });
    const allow = [".", "theme", "badge", "chart"] as const;
    const deferred = ["chart"] as const;
    const jsEntries = discoverJsEntriesFromAllowlist(packageRoot, allow, deferred);

    expect(jsEntries.map((entry) => entry.subpath)).not.toContain("chart");
    expect(jsEntries).toHaveLength(allow.length - deferred.length);
  });
});

describe("source-export generation ownership", () => {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const buildSource = readFileSync(join(packageRoot, "scripts/build.ts"), "utf8");
  const writeSourceExportsEntry = readFileSync(join(packageRoot, "scripts/write-source-exports.ts"), "utf8");
  const parsed: unknown = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  if (parsed === null || Array.isArray(parsed)) {
    throw new Error("packages/ui/package.json is not an object");
  }
  // SAFETY: this test only reads the generate:exports script string.
  const scripts = (parsed as { scripts: { "generate:exports": string } }).scripts;

  it("keeps tracked source exports out of the package build", () => {
    expect(buildSource).not.toContain("writeSourceExports");
    expect(buildSource).toContain("writePublishManifest");
    expect(writeSourceExportsEntry).toContain("writeSourceExports(");
    expect(scripts["generate:exports"]).toContain("scripts/write-source-exports.ts");
  });

  it("copies published dependency ranges in a loop over PUBLISHED_DEPENDENCY_RANGES keys", () => {
    const generateExports = readFileSync(join(packageRoot, "scripts/generate-exports.ts"), "utf8");
    expect(generateExports).toMatch(/for \(const name of Object\.keys\(/);
    expect(generateExports).toContain("PUBLISHED_DEPENDENCY_RANGES");
    expect(generateExports).not.toContain(
      'dependencies["react-aria-components"] = PUBLISHED_DEPENDENCY_RANGES'
    );
  });
});
