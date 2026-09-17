import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { asRecord, asString, readJsonObject } from "./json-object.mjs";
import { repoRoot } from "./workflow.mjs";

const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

/** pnpm invocations the README shows that are not repo scripts. */
const NOT_A_SCRIPT = new Set(["install", "changeset", "exec"]);

/**
 * Every `pnpm …` command the README shows in backticks, minus the `pnpm ` prefix.
 * @returns {string[]}
 */
function claimedCommands() {
  return [...readme.matchAll(/`pnpm ([^`]+)`/g)].map((match) => match[1].trim());
}

/**
 * @param {string} workspaceDirectory
 * @returns {Record<string, unknown>}
 */
function packageScripts(workspaceDirectory) {
  const parsed = readJsonObject(join(repoRoot, workspaceDirectory, "package.json"));
  return asRecord(parsed.scripts, `${workspaceDirectory} scripts`);
}

/**
 * Package-map rows: `| \`path\` | \`name\` | … |`.
 * @returns {{ path: string; name: string }[]}
 */
function packageMapRows() {
  return [...readme.matchAll(/^\| `([^`]+)` +\| `([^`]+)` +\|/gm)].map((match) => ({
    path: match[1],
    name: match[2],
  }));
}

describe("README script claims", () => {
  const rootScripts = packageScripts(".");

  it("names only root scripts that exist", () => {
    const rootClaims = claimedCommands().filter((command) => !command.startsWith("--filter"));
    for (const claim of rootClaims) {
      const [script] = claim.split(/\s+/);
      if (NOT_A_SCRIPT.has(script)) {
        continue;
      }
      expect(Object.keys(rootScripts), `README claims \`pnpm ${claim}\``).toContain(script);
    }
  });

  it("names only filtered workspace scripts that exist in that workspace", () => {
    const workspaceDirectoryByName = new Map(
      packageMapRows().map((row) => /** @type {const} */ ([row.name, row.path]))
    );
    const filtered = claimedCommands().filter((command) => command.startsWith("--filter"));
    for (const claim of filtered) {
      const [, packageName, script] = claim.split(/\s+/);
      const directory = workspaceDirectoryByName.get(packageName);
      if (directory === undefined) {
        throw new Error(`README claims \`pnpm ${claim}\` for a package its package map omits`);
      }
      expect(Object.keys(packageScripts(directory)), `README claims \`pnpm ${claim}\``).toContain(script);
    }
  });
});

describe("README package map", () => {
  it("lists paths that exist under names those packages actually declare", () => {
    const rows = packageMapRows();
    for (const row of rows) {
      const manifest = join(repoRoot, row.path, "package.json");
      expect(existsSync(manifest), `README maps ${row.path}, which has no package.json`).toBe(true);
      expect(asString(readJsonObject(manifest).name, `${row.path} name`)).toBe(row.name);
    }
  });
});
