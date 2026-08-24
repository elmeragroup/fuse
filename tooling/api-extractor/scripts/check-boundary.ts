import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  declarationBoundaryViolations,
  packageSourceFiles,
  publicDeclarationGraph,
  sourceBoundaryViolations,
} from "./boundary-scanner.ts";

const packageDirectory = resolve(import.meta.dirname, "..");
const sourceDirectory = join(packageDirectory, "src");
const declarationDirectory = join(packageDirectory, "dist");
const publicIndex = join(declarationDirectory, "src", "index.d.ts");
const tsconfigPath = join(packageDirectory, "tsconfig.json");
const compilerScript = resolve(import.meta.dirname, "../node_modules/typescript/bin/tsc");

export type BoundaryCheckResult = {
  readonly sourceFilesChecked: number;
  readonly declarationFilesChecked: number;
  readonly publicDeclarationFilesChecked: number;
};

export type FreshDeclarationOutputOptions = {
  readonly tsconfigPath: string;
  readonly cwd: string;
  readonly declarationDirectory: string;
};

function declarationFiles(directory: string): readonly string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return declarationFiles(path);
    return /\.d\.(?:ts|mts|cts)$/u.test(entry.name) ? [path] : [];
  });
}

function declarationSet(directory: string): readonly string[] {
  return declarationFiles(directory)
    .map((path) => relative(directory, path).replaceAll("\\", "/"))
    .sort();
}

function compilerFailureDetail(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Emit declarations into a fresh temporary directory and compare the exact
 * compiler output with the checked-in build. A manifest cannot bless stale
 * declarations because it is not consulted by this check.
 */
export function assertFreshDeclarationOutput(options: FreshDeclarationOutputOptions): void {
  if (!existsSync(options.declarationDirectory)) {
    throw new Error("Boundary declaration output is missing: dist/");
  }
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "api-extractor-boundary-"));
  try {
    try {
      execFileSync(
        process.execPath,
        [
          compilerScript,
          "--project",
          options.tsconfigPath,
          "--outDir",
          temporaryDirectory,
          "--declaration",
          "true",
          "--emitDeclarationOnly",
          "true",
          "--declarationMap",
          "true",
          "--incremental",
          "false",
          "--pretty",
          "false",
        ],
        { cwd: options.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      );
    } catch (cause) {
      throw new Error(`Fresh TypeScript declaration emit failed: ${compilerFailureDetail(cause)}`);
    }

    const expected = declarationSet(temporaryDirectory);
    const actual = declarationSet(options.declarationDirectory);
    if (expected.length !== actual.length || expected.some((path, index) => actual[index] !== path)) {
      const missing = expected.filter((path) => !actual.includes(path));
      const unexpected = actual.filter((path) => !expected.includes(path));
      throw new Error(
        `Boundary declaration output is stale or incomplete: ${[
          missing.length === 0 ? "" : `missing ${missing.join(", ")}`,
          unexpected.length === 0 ? "" : `unexpected ${unexpected.join(", ")}`,
        ]
          .filter(Boolean)
          .join("; ")}`
      );
    }
    for (const path of expected) {
      const expectedContent = readFileSync(join(temporaryDirectory, path));
      const actualContent = readFileSync(join(options.declarationDirectory, path));
      if (!expectedContent.equals(actualContent)) {
        throw new Error(`Boundary declaration output is stale: declaration content changed at ${path}.`);
      }
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function checkBoundary(): BoundaryCheckResult {
  if (!existsSync(declarationDirectory) || !existsSync(publicIndex)) {
    throw new Error("Boundary scan requires a declaration build at dist/");
  }
  assertFreshDeclarationOutput({ tsconfigPath, cwd: packageDirectory, declarationDirectory });
  const sourceFilePaths = packageSourceFiles(packageDirectory);
  const contracts = readFileSync(join(sourceDirectory, "backend", "contracts.ts"), "utf8");
  if (contracts.includes("extractModule") || /\bresolveModule\s*\?/u.test(contracts)) {
    throw new Error("The backend contract exposes an optional or resolved-module extraction seam.");
  }
  const ts7AdapterDirectory = join(sourceDirectory, "backend", "ts7") + "/";
  const sourceViolations = sourceFilePaths.flatMap((path) =>
    path.startsWith(ts7AdapterDirectory) ? [] : sourceBoundaryViolations(path, readFileSync(path, "utf8"))
  );
  const declarationFilePaths = declarationFiles(declarationDirectory);
  const publicDeclarationFiles = publicDeclarationGraph(publicIndex);
  const declarationViolations = publicDeclarationFiles.flatMap((path) =>
    declarationBoundaryViolations(path, readFileSync(path, "utf8"))
  );
  const violations = [...sourceViolations, ...declarationViolations];
  if (violations.length > 0) {
    throw new Error(
      "Compiler declarations/imports escaped the backend boundary:\n" +
        violations.map((violation) => `- ${violation.path}: ${violation.reason}`).join("\n")
    );
  }
  return {
    sourceFilesChecked: sourceFilePaths.length,
    declarationFilesChecked: declarationFilePaths.length,
    publicDeclarationFilesChecked: publicDeclarationFiles.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkBoundary();
  console.log(JSON.stringify({ ...result, status: "clear" }));
}
