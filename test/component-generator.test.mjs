import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** @type {string[]} */
const fixtures = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "elmera-component-generator-"));
  fixtures.push(directory);
  for (const path of [
    "plopfile.mjs",
    "plop-templates",
    "packages/ui/scripts",
    "packages/ui/src/icons/roster.ts",
  ]) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    cpSync(join(root, path), join(directory, path), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "dir");
  writeFileSync(join(directory, "package.json"), '{"private":true,"type":"module"}\n');
  // The fixture reuses installed tools and must never install into their symlink target.
  writeFileSync(join(directory, "pnpm-workspace.yaml"), "verifyDepsBeforeRun: false\n");
  return directory;
}

/**
 * @param {string} directory
 * @param {string | string[]} name
 */
function generate(directory, name) {
  const nodePlop = createRequire(join(root, "node_modules/plop/package.json")).resolve("node-plop");
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import nodePlop from ${JSON.stringify(nodePlop)};
    const plop = await nodePlop(${JSON.stringify(join(directory, "plopfile.mjs"))});
    const results = [];
    for (const name of [].concat(${JSON.stringify(name)})) {
      results.push(await plop.getGenerator('component').runActions({name}));
    }
    const result = {changes: results.flatMap((result) => result.changes), failures: results.flatMap((result) => result.failures)};
    process.stdout.write(JSON.stringify(result, (_key, value) => value instanceof Error ? value.message + String(value.stdout ?? "") + String(value.stderr ?? "") : value));
    process.exitCode = result.failures.length ? 1 : 0;
  `,
    ],
    { cwd: directory, encoding: "utf8", timeout: 20000 }
  );
}

/**
 * @param {string} directory
 * @param {string} relative
 * @returns {string[][]}
 */
function snapshot(directory, relative = "") {
  return readdirSync(join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = join(relative, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return [[path, "directory"], ...snapshot(directory, path)];
    return [[path, readFileSync(join(directory, path), "utf8")]];
  });
}

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("component generator", () => {
  it("registers a new component for export discovery and refuses a repeat without changing files", () => {
    const directory = fixture();
    const result = generate(directory, "status-light");
    expect(result.stderr + result.stdout).not.toContain("[FAILED]");
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readFileSync(join(directory, "packages/ui/scripts/size-budgets.ts"), "utf8")).toContain(
      'name: "status-light", entryFile: "status-light.js", measuredGzip: 0'
    );
    writeFileSync(join(directory, "packages/ui/src/index.ts"), "export {};\n");
    const discovery = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import { BARE_COMPONENT_ENTRIES, discoverJsEntriesFromAllowlist } from './packages/ui/scripts/entries.ts';
      if (!BARE_COMPONENT_ENTRIES.includes('status-light')) throw new Error('entry not registered');
      const entries = discoverJsEntriesFromAllowlist('./packages/ui', ['.', 'status-light']);
      process.stdout.write(JSON.stringify(entries));
    `,
      ],
      { cwd: directory, encoding: "utf8" }
    );
    expect(JSON.parse(discovery)).toEqual([
      { subpath: ".", sourceFile: "src/index.ts", runtimeExports: ["StatusLight"], inRootBarrel: true },
      {
        subpath: "status-light",
        sourceFile: "src/status-light.ts",
        runtimeExports: ["StatusLight"],
        inRootBarrel: true,
      },
    ]);
    const before = snapshot(directory);
    const repeated = generate(directory, "status-light");
    expect(repeated.stdout + repeated.stderr).toContain("already registered or reserved");
    expect(snapshot(directory)).toEqual(before);
  }, 30000);

  it("rejects existing, reserved, quarantined, deferred and invalid names without writes", () => {
    const directory = fixture();
    const before = snapshot(directory);
    const result = generate(directory, [
      "button",
      "theme",
      "theme-catalog",
      "react-aria",
      "calendar",
      "chart",
      "../outside",
      "BadName",
      " spaced ",
    ]);
    expect(result.status).toBe(1);
    const output = result.stdout + result.stderr;
    for (const reason of ["registered", "quarantined", "deferred", "kebab-case"]) {
      expect(output).toContain(reason);
    }
    expect(snapshot(directory)).toEqual(before);
  }, 30000);

  it("checks existing docs and registration markers before creating source files", () => {
    const directory = fixture();
    mkdirSync(join(directory, "apps/docs/src/app/(docs)/components/status-light"), { recursive: true });
    const before = snapshot(directory);
    expect(generate(directory, "status-light").stdout).toContain("already has source or documentation");
    expect(snapshot(directory)).toEqual(before);
    const budget = join(directory, "packages/ui/scripts/size-budgets.ts");
    writeFileSync(budget, readFileSync(budget, "utf8").replace("// plop:js-entry-budget", ""));
    const missingMarker = snapshot(directory);
    expect(generate(directory, "new-component").stdout).toContain("Expected one // plop:js-entry-budget");
    expect(snapshot(directory)).toEqual(missingMarker);
  }, 30000);
});
