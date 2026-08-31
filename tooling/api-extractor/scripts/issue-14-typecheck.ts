import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { issue14FixtureManifest } from "./fixture-catalog.ts";
import type { Issue14Fixture } from "./fixture-catalog.ts";

const packageDirectory = resolve(import.meta.dirname, "..");
const fixtureDirectory = join(packageDirectory, "test/fixtures");
const compilerScript = resolve(packageDirectory, "node_modules/typescript/bin/tsc");
const typecheckCommandPrefix = "node scripts/issue-14-typecheck.ts" as const;
const typecheckCompilerOptions = [
  "--ignoreConfig",
  "--noEmit",
  "--module",
  "ESNext",
  "--moduleResolution",
  "Bundler",
  "--jsx",
  "react-jsx",
  "--target",
  "ES2022",
  "--strict",
  "--skipLibCheck",
  "false",
  "--pretty",
  "false",
] as const;

export type TypecheckResult = {
  readonly status: "pass" | "failed";
  readonly strategy: "direct-input" | "virtual-upstream-dependency";
  readonly command: string;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly string[];
};

export function issue14TypecheckStrategy(
  definition: Issue14Fixture
): "direct-input" | "virtual-upstream-dependency" {
  return definition.fixture === "module-imports-only" ? "virtual-upstream-dependency" : "direct-input";
}

/** The exact package-relative command that the persisted evidence records. */
export function issue14TypecheckCommand(definition: Issue14Fixture): string {
  return `${typecheckCommandPrefix} --fixture ${definition.fixture} --pretty false`;
}

function diagnosticsFrom(output: string): readonly string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replaceAll(packageDirectory, "<package>"));
}

function runTsc(definition: Issue14Fixture, inputPath: string, cwd: string): TypecheckResult {
  const result = spawnSync(process.execPath, [compilerScript, ...typecheckCompilerOptions, inputPath], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].join("\n");
  const diagnostics = diagnosticsFrom(output);
  return {
    status: result.status === 0 && result.error === undefined ? "pass" : "failed",
    strategy: issue14TypecheckStrategy(definition),
    command: issue14TypecheckCommand(definition),
    diagnosticCount: diagnostics.length,
    diagnostics,
  };
}

function typecheckWithVirtualDependency(definition: Issue14Fixture, inputPath: string): TypecheckResult {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "api-extractor-issue14-typecheck-"));
  const stagedInput = join(temporaryRoot, "test/fixtures/module-imports-only/input.ts");
  const stagedDependency = join(temporaryRoot, "src/models/export.ts");
  try {
    mkdirSync(dirname(stagedInput), { recursive: true });
    mkdirSync(dirname(stagedDependency), { recursive: true });
    // The staged tree is test-only; the copied input itself remains immutable.
    const input = readFileSync(inputPath);
    writeFileSync(stagedInput, input);
    writeFileSync(stagedDependency, "export class ExportNode {}\n");
    symlinkSync(join(packageDirectory, "node_modules"), join(temporaryRoot, "node_modules"), "junction");
    return runTsc(definition, stagedInput, temporaryRoot);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function typecheckFixture(definition: Issue14Fixture): TypecheckResult {
  const inputPath = join(fixtureDirectory, definition.fixture, definition.file);
  return definition.fixture === "module-imports-only"
    ? typecheckWithVirtualDependency(definition, inputPath)
    : runTsc(definition, inputPath, packageDirectory);
}

function packageVersion(packageName: string): string {
  const require = createRequire(import.meta.url);
  // SAFETY: package.json is a required dependency metadata file and its only consumed field is version.
  const metadata = require(packageName + "/package.json") as { readonly version: string };
  return metadata.version;
}

function cliFixture(): Issue14Fixture {
  const fixtureName = process.argv[process.argv.indexOf("--fixture") + 1];
  const definition = issue14FixtureManifest.find((candidate) => candidate.fixture === fixtureName);
  if (definition === undefined) throw new Error(`Unknown Issue 14 fixture: ${fixtureName ?? "<missing>"}`);
  if (
    process.argv[process.argv.indexOf("--pretty") + 1] !== "false" ||
    packageVersion("typescript") !== "7.0.2"
  ) {
    throw new Error("Issue 14 typecheck command requires --pretty false and typescript@7.0.2.");
  }
  return definition;
}

function main(): void {
  const result = typecheckFixture(cliFixture());
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "pass") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
