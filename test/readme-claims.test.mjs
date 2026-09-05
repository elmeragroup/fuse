import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asRecord, asString, readJsonObject } from "./json-object.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

/** pnpm invocations the README shows that are not repo scripts. */
const NOT_A_SCRIPT = new Set(["install", "changeset"]);

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
    expect(rootClaims.length, "README must show root pnpm commands").toBeGreaterThan(5);
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
    expect(filtered.length, "README must show filtered pnpm commands").toBeGreaterThan(3);
    for (const claim of filtered) {
      const [, packageName, script] = claim.split(/\s+/);
      const directory = workspaceDirectoryByName.get(packageName);
      if (directory === undefined) {
        throw new Error(`README claims \`pnpm ${claim}\` for a package its package map omits`);
      }
      expect(Object.keys(packageScripts(directory)), `README claims \`pnpm ${claim}\``).toContain(script);
    }
  });

  it("documents every root script the repo defines", () => {
    for (const script of Object.keys(rootScripts)) {
      expect(readme, `README must document the root \`${script}\` script`).toContain(`pnpm ${script}`);
    }
  });

  it("keeps the ci:checks description in step with the root script", () => {
    const ciChecks = asString(rootScripts["ci:checks"], "scripts.ci:checks");
    expect(ciChecks).toContain("oxfmt --check");
    expect(ciChecks).toContain("turbo run ci:checks");
    expect(readme, "README must describe ci:checks as oxfmt then turbo").toContain(
      "`oxfmt --check` then `turbo run ci:checks`"
    );
  });

  it("explains the @elmeragroup/ui ci:checks anchor instead of leaving a bare placeholder", () => {
    const uiCiChecks = asString(packageScripts("packages/ui")["ci:checks"], "ui scripts.ci:checks");
    expect(uiCiChecks, "the ui ci:checks placeholder must say what it is").not.toBe("true");
    expect(uiCiChecks).toContain("no-op anchor");
    expect(readme, "README must explain the no-op anchor").toContain("no-op anchor");
    expect(readFileSync(join(repoRoot, "turbo.json"), "utf8")).toContain("no-op");
  });
});

describe("README package map", () => {
  it("lists paths that exist under names those packages actually declare", () => {
    const rows = packageMapRows();
    expect(rows.length, "README must map every workspace package").toBe(7);
    for (const row of rows) {
      const manifest = join(repoRoot, row.path, "package.json");
      expect(existsSync(manifest), `README maps ${row.path}, which has no package.json`).toBe(true);
      expect(asString(readJsonObject(manifest).name, `${row.path} name`)).toBe(row.name);
    }
  });
});

describe("README prerequisites", () => {
  it("states the Node range the engines field enforces and the pinned version", () => {
    const engines = asRecord(readJsonObject(join(repoRoot, "package.json")).engines, "engines");
    const nodeRange = asString(engines.node, "engines.node");
    expect(nodeRange).toBe(">=24.13.0 <25");
    expect(readme, "README must state the supported Node range").toContain("`>=24.13 <25`");
    const pinned = readFileSync(join(repoRoot, ".node-version"), "utf8").trim();
    expect(readme, "README must name the .node-version pin").toContain(`(\`${pinned}\`)`);
  });

  it("states the pnpm major the packageManager field pins", () => {
    const packageManager = asString(
      readJsonObject(join(repoRoot, "package.json")).packageManager,
      "packageManager"
    );
    const major = packageManager.replace(/^pnpm@/, "").split(".")[0];
    expect(readme, "README must state the pnpm major").toContain(`**pnpm ${major}**`);
  });
});

describe("README contribution flow", () => {
  it("tells contributors to regenerate the shadow snapshot and api.json after rebasing", () => {
    expect(readme, "README must name the post-rebase regeneration step").toContain("After rebasing");
    expect(readme).toContain("pnpm --filter docs generate");
    expect(readme).toContain("pnpm --filter docs shadow:update");
    expect(readme, "README must name the shadow snapshot the docs gate compares against").toContain(
      "api-shadow.snapshot.json"
    );
    expect(
      existsSync(join(repoRoot, "apps/docs/test/api-shadow.snapshot.json")),
      "the snapshot the README names must exist"
    ).toBe(true);
    expect(readme, "README must name the gate that stale artifacts fail").toContain("docs#test:shadow");
  });

  it("keeps the changeset rule: add one, or take the label — never rewrite one to pass a gate", () => {
    expect(readme).toContain("`no-changeset`");
    expect(readme, "README must forbid editing a changeset to move a gate").toContain(
      "Never edit an existing changeset to move a gate"
    );
  });
});
