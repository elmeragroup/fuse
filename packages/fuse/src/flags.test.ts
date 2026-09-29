import { getCountries } from "libphonenumber-js";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../scripts/entries";
import {
  flagHashFailure,
  flagPayload,
  listFlagFiles,
  parseProvenanceHashes,
  requireFlagsDirectory,
} from "../scripts/flag-assets";
import { FLAG_RAW_CEILING_BYTES, FLAG_SVG_COUNT } from "../scripts/flag-payload";
import { flagAssets } from "./flags";
import type { FlagAssetCode } from "./flags";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const flagsDir = join(packageRoot, "src/flags");

describe("flag assets", () => {
  const files = listFlagFiles(flagsDir);

  it("ships the pinned payload from the shared invariants", () => {
    const payload = flagPayload(flagsDir, files);
    expect(payload.count).toBe(FLAG_SVG_COUNT);
    expect(payload.bytes).toBeLessThanOrEqual(FLAG_RAW_CEILING_BYTES);
  });

  it("generates flagAssets keys from those filenames", () => {
    const codes = files.map((name) => name.slice(0, 2));
    expect(Object.keys(flagAssets).toSorted((left, right) => left.localeCompare(right))).toEqual(codes);
    const sample: FlagAssetCode = "NO";
    expect(flagAssets[sample]).toContain("NO.svg");
    expect(flagAssets.SE).toContain("SE.svg");
    expect(flagAssets.FI).toContain("FI.svg");
  });

  // Timeout: discoverEntries walks the published import graph; slow under full-gate parallel load.
  it("keeps /flags off the root barrel and uses local URL hrefs", () => {
    const discovered = discoverEntries(packageRoot);
    const flags = discovered.jsEntries.find((entry) => entry.subpath === "flags");
    const root = discovered.jsEntries.find((entry) => entry.subpath === ".");
    expect(flags?.inRootBarrel).toBe(false);
    expect(flags?.runtimeExports).toEqual(["flagAssets"]);
    expect(root?.runtimeExports).not.toContain("flagAssets");
    // Source-grep: barrel absence has no consumer-behavior probe beyond discoverEntries.
    expect(readFileSync(join(packageRoot, "src/index.ts"), "utf8")).not.toContain("./flags");
    expect(readFileSync(join(packageRoot, "src/flags/manifest.ts"), "utf8")).toContain(
      'new URL("./NO.svg?no-inline", import.meta.url).href'
    );
    expect(readFileSync(join(packageRoot, "src/flags/manifest.ts"), "utf8")).not.toMatch(/https?:\/\//);
  }, 30_000);

  it("has a libphonenumber gap of exactly AC, BQ, EH, and TA", () => {
    const assets = new Set(Object.keys(flagAssets));
    const missing = getCountries().filter((code) => !assets.has(code));
    expect(missing.toSorted((left, right) => left.localeCompare(right))).toEqual(["AC", "BQ", "EH", "TA"]);
  });

  // Timeout: copying + SHA-256 hashing the full flag set twice is slow under full-gate parallel load.
  it("fails the PROVENANCE SHA-256 gate when a packed SVG is mutated", () => {
    const hashes = parseProvenanceHashes(readFileSync(join(flagsDir, "PROVENANCE.md"), "utf8"));
    expect(flagHashFailure(flagsDir, files, hashes)).toBeUndefined();

    const scratch = mkdtempSync(join(tmpdir(), "fuse-flag-hash-"));
    try {
      for (const file of files) {
        copyFileSync(join(flagsDir, file), join(scratch, file));
      }
      writeFileSync(join(scratch, "NO.svg"), `${readFileSync(join(scratch, "NO.svg"), "utf8")}<!--mut-->`);
      expect(flagHashFailure(scratch, files, hashes)).toMatch(
        /NO\.svg SHA-256 .* does not match PROVENANCE\.md/
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 30_000);

  it("treats a missing flags directory as never-vendored and fails an empty one", () => {
    const missing = join(tmpdir(), `fuse-flags-missing-${Date.now()}`);
    expect(requireFlagsDirectory(missing)).toBe("missing");

    const empty = mkdtempSync(join(tmpdir(), "fuse-flags-empty-"));
    try {
      expect(() => requireFlagsDirectory(empty)).toThrow(/wiped/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
