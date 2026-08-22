import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { discoverEntries } from "../scripts/entries";
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

    const discovered = discoverEntries(packageRoot);
    const badge = discovered.jsEntries.find((entry) => entry.subpath === "badge");
    expect(badge?.inRootBarrel).toBe(true);
    expect(badge?.runtimeExports).toEqual(["Badge"]);
    expect(renderRootBarrel(discovered)).toContain(`export * from "./badge";`);
    expect(renderRootBarrel(discovered)).toContain(`export * from "./theme";`);
    expect(renderRootBarrel(discovered)).not.toContain(`export * from "./icons";`);
    expect(exportBindingTarget(buildSourceExportMap(discovered), "./badge")).toEqual({
      types: "./src/badge.ts",
      import: "./src/badge.ts",
    });
    expect(discovered.jsEntries.find((entry) => entry.subpath === ".")?.runtimeExports).toContain("Badge");
  });

  it("fails generation when two barrel facades export the same value name", () => {
    const packageRoot = scratchPackage({
      "src/badge.ts": `export { Shared } from "./components/badge/badge";\n`,
      "src/button.ts": `export { Shared } from "./components/button/button";\n`,
    });

    expect(() => discoverEntries(packageRoot)).toThrow(
      /Duplicate barrel export Shared from badge and button/
    );
  });

  it("fails generation when a facade uses export *", () => {
    const packageRoot = scratchPackage({
      "src/button.ts": `export * from "./components/button/button";\n`,
    });

    expect(() => discoverEntries(packageRoot)).toThrow(/export \*/);
  });
});
