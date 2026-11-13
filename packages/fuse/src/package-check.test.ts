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
import { ARTIFACTS_DIR } from "../scripts/tarball";
import { copyTwemojiNotices, TWEMOJI_LICENSE_FILE, TWEMOJI_NOTICE_FILE } from "../scripts/twemoji-notices";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Twemoji notice copying", () => {
  const scratchDirs: string[] = [];

  afterEach(() => {
    for (const directory of scratchDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  function scratch(): string {
    const directory = mkdtempSync(join(tmpdir(), "fuse-notices-"));
    scratchDirs.push(directory);
    return directory;
  }

  it("copies both notices byte-for-byte, creating the nested license directory", () => {
    const destination = scratch();
    copyTwemojiNotices(packageRoot, destination);
    for (const file of [TWEMOJI_NOTICE_FILE, TWEMOJI_LICENSE_FILE]) {
      expect(readFileSync(join(destination, file))).toEqual(readFileSync(join(packageRoot, file)));
    }
  });

  it.each([TWEMOJI_NOTICE_FILE, TWEMOJI_LICENSE_FILE])("refuses to copy when %s is missing", (missing) => {
    const source = scratch();
    mkdirSync(join(source, "licenses"));
    for (const file of [TWEMOJI_NOTICE_FILE, TWEMOJI_LICENSE_FILE]) {
      if (file !== missing) writeFileSync(join(source, file), readFileSync(join(packageRoot, file)));
    }
    expect(() => copyTwemojiNotices(source, scratch())).toThrow(
      `packages/fuse Twemoji notices: missing ${missing}`
    );
  });
});

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
  it.each([
    [
      "fails extra names that are not in the expected set",
      ["BRANDS", "SneakyExtra"],
      ["BRANDS"],
      "./theme unexpected runtime exports: SneakyExtra",
    ],
    [
      "fails missing names that the expected set requires",
      ["BRANDS"],
      ["BRANDS", "isBrandCode"],
      "./theme missing runtime exports: isBrandCode",
    ],
    [
      "passes when packed names equal the expected set",
      ["BRANDS", "isBrandCode"],
      ["isBrandCode", "BRANDS"],
      undefined,
    ],
  ] as const)("%s", (_case, packed, expected, failure) => {
    expect(packedValueExportFailure("./theme", packed, expected)).toBe(failure);
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
    const dir = mkdtempSync(join(tmpdir(), "fuse-directive-"));
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
