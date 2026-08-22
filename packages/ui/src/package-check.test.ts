import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { discoverEntries } from "../scripts/entries";
import {
  emittedDirectiveFailure,
  packedValueExportFailure,
  parsePackedEvalJson,
} from "../scripts/package-check-lib";
import { parseFacadeValueExports } from "../scripts/parse-facade";
import { ARTIFACTS_DIR } from "../scripts/tarball";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function sorted(names: readonly string[]): string[] {
  return [...names].toSorted((left, right) => left.localeCompare(right));
}

describe("packed eval JSON", () => {
  it("returns the parsed value or the standard fail-path message", () => {
    expect(parsePackedEvalJson("not-json", "packed entries")).toEqual({
      ok: false,
      failure: "Packed import JSON parse failed for packed entries",
    });
    expect(parsePackedEvalJson('{"a":["Button"]}', "packed entries")).toEqual({
      ok: true,
      value: { a: ["Button"] },
    });
    expect(parsePackedEvalJson("{", "flagAssets URLs")).toEqual({
      ok: false,
      failure: "Packed import JSON parse failed for flagAssets URLs",
    });
  });
});

describe("artifacts directory single-sourcing", () => {
  it("keeps turbo.json's pack outputs in sync with ARTIFACTS_DIR", () => {
    // turbo.json is JSONC and cannot import the constant; pin the sync here.
    const turbo = readFileSync(join(packageRoot, "../../turbo.json"), "utf8");
    const outputs = /"pack":\s*\{[\s\S]*?"outputs":\s*\[\s*"([^"]+)"\s*\]/.exec(turbo)?.[1];
    expect(outputs).toBe(`${ARTIFACTS_DIR}/**`);
  });
});

describe("packed value-export gate", () => {
  it("fails extra names that are not in the expected set", () => {
    const message = packedValueExportFailure("./theme", ["BRANDS", "SneakyExtra"], ["BRANDS"]);
    expect(message).toBe("./theme unexpected runtime exports: SneakyExtra");
  });

  it("fails missing names that the expected set requires", () => {
    const message = packedValueExportFailure("./theme", ["BRANDS"], ["BRANDS", "isBrandCode"]);
    expect(message).toBe("./theme missing runtime exports: isBrandCode");
  });

  it("passes when packed names equal the expected set", () => {
    expect(
      packedValueExportFailure("./theme", ["BRANDS", "isBrandCode"], ["isBrandCode", "BRANDS"])
    ).toBeUndefined();
  });

  it("uses the parsed theme facade and asserts icons parse equals the roster", () => {
    const themeFacade = parseFacadeValueExports(
      "src/theme.ts",
      readFileSync(join(packageRoot, "src/theme.ts"), "utf8")
    );
    expect(themeFacade).toContain("BRAND_CODES");
    expect(themeFacade).toContain("isBrandCode");
    const discovered = discoverEntries(packageRoot);
    const theme = discovered.jsEntries.find((entry) => entry.subpath === "theme");
    expect(theme?.runtimeExports).toEqual(themeFacade);

    const iconsFacade = parseFacadeValueExports(
      "src/icons.ts",
      readFileSync(join(packageRoot, "src/icons.ts"), "utf8")
    );
    const icons = discovered.jsEntries.find((entry) => entry.subpath === "icons");
    expect(sorted(icons?.runtimeExports ?? [])).toEqual(sorted(iconsFacade));
  });
});

describe("emitted-directive walker", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function scratch(): string {
    const dir = mkdtempSync(join(tmpdir(), "elmera-ui-directive-"));
    scratchDirs.push(dir);
    return dir;
  }

  it("does not fail a use-client module outside the published import graph", () => {
    const root = scratch();
    const extracted = scratch();
    mkdirSync(join(root, "src/hooks"), { recursive: true });
    writeFileSync(join(root, "src/theme.ts"), `export const themeAttributes = {};\n`);
    writeFileSync(join(root, "src/hooks/unpublished.ts"), `"use client";\nexport const useX = () => 1;\n`);
    writeFileSync(join(extracted, "theme.js"), `export const themeAttributes = {};\n`);
    expect(emittedDirectiveFailure(extracted, ["src/theme.ts"], root)).toBeUndefined();
  });

  it("fails when a published source has use client but packed JS lacks it", () => {
    const root = scratch();
    const extracted = scratch();
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/button.tsx"), `"use client";\nexport function Button() {}\n`);
    writeFileSync(join(extracted, "button.js"), `export function Button() {}\n`);
    expect(emittedDirectiveFailure(extracted, ["src/button.tsx"], root)).toMatch(
      /Directive mismatch for button.tsx/
    );
  });

  it("scopes the walker to discoverEntries().sourceFiles, not all of src", () => {
    const discovered = discoverEntries(packageRoot);
    // Test-only fixture: reachable from no entry (Dialog made the hook itself reachable).
    expect(discovered.sourceFiles).not.toContain("src/hooks/intl-fixture/index.ts");
    expect(discovered.sourceFiles).toContain("src/theme.ts");
  });
});
