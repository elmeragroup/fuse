import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asRecordArray, asString, isString, readJsonObject } from "./json-object.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Provenance recorded in vendor/internal/README.md; the archive is checked against it. */
const ARCHIVE = "elmeragroup-internal-0.1.0-canary.1.tgz";
const ARCHIVE_SHA256 = "1b254c00a3bb937ef46b1381adae629f56448c76eb25203882bbaa8596407323";

const archivePath = join(repoRoot, "vendor", "internal", ARCHIVE);

describe("vendored @elmeragroup/internal", () => {
  it("ships the verified archive unchanged", () => {
    expect(existsSync(archivePath), `${ARCHIVE} is missing from vendor/internal`).toBe(true);
    const sha256 = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
    expect(sha256).toBe(ARCHIVE_SHA256);
  });

  it("is installed by the docs workspace through a relative file: path", () => {
    const manifest = readJsonObject(join(repoRoot, "apps", "docs", "package.json"));
    const devDependencies = asRecord(manifest.devDependencies, "docs devDependencies");
    const specifier = asString(devDependencies["@elmeragroup/internal"], "@elmeragroup/internal specifier");
    expect(specifier).toBe(`file:../../vendor/internal/${ARCHIVE}`);
  });

  it("is installed at the workspace root, where .oxlintrc.json resolves its lint plugins", () => {
    const manifest = readJsonObject(join(repoRoot, "package.json"));
    const devDependencies = asRecord(manifest.devDependencies, "root devDependencies");
    const specifier = asString(devDependencies["@elmeragroup/internal"], "@elmeragroup/internal specifier");
    expect(specifier).toBe(`file:vendor/internal/${ARCHIVE}`);
    const plugins = readJsonObject(join(repoRoot, ".oxlintrc.json")).jsPlugins;
    if (!Array.isArray(plugins)) throw new Error("jsPlugins is not an array");
    const specifiers = asRecordArray(
      plugins.filter((plugin) => !isString(plugin)),
      "jsPlugins"
    ).map((plugin) => asString(plugin.specifier, "plugin specifier"));
    expect(specifiers).toEqual(["@elmeragroup/internal/oxlint", "@elmeragroup/internal/oxlint/anti-slop"]);
  });

  it("records no machine-specific path in the lockfile", () => {
    const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8");
    expect(lockfile).toContain(`file:vendor/internal/${ARCHIVE}`);
    expect(lockfile).not.toMatch(/file:\/(?:Users|home)\//);
  });
});
