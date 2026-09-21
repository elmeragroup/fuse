import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

import { flagPayload, listFlagFiles } from "./flag-assets.ts";
import { packageRootFromScript } from "./paths.ts";
import {
  budgetFailure,
  CSS_BUDGETS,
  FLAG_RAW_BUDGETS,
  JS_ENTRY_BUDGETS,
  NAMED_IMPORT_BUDGETS,
} from "./size-budgets.ts";
import { fail, withExtractedTarball } from "./tarball.ts";

const packageRoot = packageRootFromScript(import.meta.url);
const PEER_EXTERNALS = ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "tailwindcss"];

function gzipSize(bytes: Uint8Array): number {
  return gzipSync(bytes).byteLength;
}

function workStem(name: string): string {
  if (name === ".") {
    return "root";
  }
  return name.replaceAll("/", "-");
}

/**
 * Budget breaches collected across the run so one failing measurement reports every overage
 * instead of stopping at the first. Structural errors (a missing packed entry) still throw
 * immediately, because no measurement can follow them.
 */
const breaches: string[] = [];

function reportBudget(name: string, bytes: number, ceiling: number, unit: string): void {
  console.log(`${name}: ${bytes} ${unit} (ceiling ${ceiling})`);
  const failure = budgetFailure(name, bytes, ceiling);
  if (failure !== undefined) {
    breaches.push(failure);
  }
}

function rolldownBundle(input: string, output: string): void {
  const args = [
    "exec",
    "rolldown",
    input,
    "--format",
    "esm",
    "--minify",
    "--platform",
    "browser",
    "--file",
    output,
  ];
  for (const external of PEER_EXTERNALS) {
    args.push("--external", external);
  }
  const result = spawnSync("pnpm", args, { cwd: packageRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`rolldown failed for ${input}:\n${result.stderr || result.stdout}`);
  }
}

function checkJsEntry(
  extracted: string,
  work: string,
  entryFile: string,
  name: string,
  ceilingGzip: number
): void {
  const input = join(extracted, entryFile);
  if (!existsSync(input)) {
    throw new Error(`Packed entry ${name} missing ${entryFile}`);
  }
  const output = join(work, `${workStem(name)}.js`);
  rolldownBundle(input, output);
  reportBudget(name, gzipSize(readFileSync(output)), ceilingGzip, "gzip bytes");
}

function checkNamedImport(
  extracted: string,
  work: string,
  entryFile: string,
  exportName: string,
  name: string,
  ceilingGzip: number
): void {
  const input = join(extracted, entryFile);
  if (!existsSync(input)) {
    throw new Error(`Packed entry ${name} missing ${entryFile}`);
  }
  const fixture = join(work, `${workStem(name)}.fixture.js`);
  writeFileSync(fixture, `export { ${exportName} } from ${JSON.stringify(input)};\n`);
  const output = join(work, `${workStem(name)}.js`);
  rolldownBundle(fixture, output);
  reportBudget(name, gzipSize(readFileSync(output)), ceilingGzip, "gzip bytes");
}

function checkCss(extracted: string, file: string, name: string, ceilingGzip: number): void {
  const path = join(extracted, file);
  if (!existsSync(path)) {
    throw new Error(`Packed CSS ${name} missing ${file}`);
  }
  reportBudget(name, gzipSize(readFileSync(path)), ceilingGzip, "gzip bytes");
}

function checkFlagRaw(extracted: string, name: string, ceilingBytes: number): void {
  const flagsDir = join(extracted, "flags");
  if (!existsSync(flagsDir)) {
    throw new Error(`Packed ${name} missing flags/`);
  }
  const files = listFlagFiles(flagsDir);
  reportBudget(name, flagPayload(flagsDir, files).bytes, ceilingBytes, "raw bytes");
}

try {
  withExtractedTarball(packageRoot, "fuse-size-", (extracted) => {
    const work = join(dirname(extracted), "work");
    mkdirSync(work);
    for (const budget of JS_ENTRY_BUDGETS) {
      checkJsEntry(extracted, work, budget.entryFile, budget.name, budget.ceilingGzip);
    }
    for (const budget of NAMED_IMPORT_BUDGETS) {
      checkNamedImport(extracted, work, budget.entryFile, budget.exportName, budget.name, budget.ceilingGzip);
    }
    for (const budget of CSS_BUDGETS) {
      checkCss(extracted, budget.file, budget.name, budget.ceilingGzip);
    }
    for (const budget of FLAG_RAW_BUDGETS) {
      checkFlagRaw(extracted, budget.name, budget.ceilingBytes);
    }
  });
  if (breaches.length > 0) {
    throw new Error(`size budgets failed:\n${breaches.join("\n")}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

console.log("size-limit passed");
