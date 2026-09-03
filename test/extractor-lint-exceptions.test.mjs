import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, isString, readJsoncObject } from "./json-object.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const extractorRoot = join(repoRoot, "tooling", "api-extractor");
const backendGlob = "tooling/api-extractor/src/backend/ts7/**";

/** File-wide headers: `/* oxlint-disable …` or `// oxlint-disable …` without `-next-line`. */
const fileWideDisable = /(?:\/\*|\/\/)\s*oxlint-disable(?!-next-line)\b/;
const nextLineDisable = /oxlint-disable-next-line\s+(\S+)([^\n]*)/g;

/**
 * @param {string} directory
 * @returns {string[]}
 */
function sourceFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "fixtures" || entry.name === "dist") continue;
      found.push(...sourceFiles(full));
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) found.push(full);
  }
  return found;
}

/**
 * @param {Record<string, unknown>} override
 * @returns {string[]}
 */
function overrideFiles(override) {
  const files = override.files;
  if (!Array.isArray(files)) throw new Error("override.files is not an array");
  return files.filter((file) => isString(file));
}

describe("api-extractor lint exceptions", () => {
  const files = sourceFiles(extractorRoot);

  it("has sources to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("carries no file-wide oxlint-disable header", () => {
    const offenders = files
      .filter((file) => fileWideDisable.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });

  it("gives every next-line disable a reason", () => {
    const offenders = [];
    for (const file of files) {
      for (const match of readFileSync(file, "utf8").matchAll(nextLineDisable)) {
        if (!match[2].includes("--") || match[2].replace(/^.*--/, "").trim() === "") {
          offenders.push(`${relative(repoRoot, file)}: ${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("exempts one directory in .oxlintrc.json, with a reason, for two named rules", () => {
    const parsed = readJsoncObject(join(repoRoot, ".oxlintrc.json"));
    const overrides = asRecordArray(parsed.overrides, "overrides");
    const extractorOverrides = overrides.filter((entry) =>
      overrideFiles(entry).some((file) => file.startsWith("tooling/api-extractor"))
    );
    expect(extractorOverrides).toHaveLength(1);
    expect(overrideFiles(extractorOverrides[0])).toEqual([backendGlob]);
    expect(asRecord(extractorOverrides[0].rules, "override rules")).toEqual({
      "anti-slop/no-runtime-typeof": "off",
      "anti-slop/no-unknown-parameters": "off",
    });

    const source = readFileSync(join(repoRoot, ".oxlintrc.json"), "utf8");
    const reason = source
      .slice(0, source.indexOf(JSON.stringify(backendGlob)))
      .split(/\{\s*$/m)
      .at(-1);
    expect(reason).toMatch(/\/\/ .*native/);
  });
});
