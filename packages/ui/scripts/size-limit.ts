import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { flagPayload, listFlagFiles } from "./flag-assets.ts";
import {
  budgetFailure,
  CSS_BUDGETS,
  FLAG_RAW_BUDGETS,
  JS_ENTRY_BUDGETS,
  NAMED_IMPORT_BUDGETS,
} from "./size-budgets.ts";
import { extractPackedPackage, findTarball } from "./tarball.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const PEER_EXTERNALS = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "tailwindcss",
  "recharts",
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function gzipSize(bytes: Uint8Array): number {
  return gzipSync(bytes).byteLength;
}

function workStem(name: string): string {
  if (name === ".") {
    return "root";
  }
  return name.replaceAll("/", "-");
}

function reportBudget(name: string, bytes: number, ceiling: number, unit: string): void {
  console.log(`${name}: ${bytes} ${unit} (ceiling ${ceiling})`);
  const message = budgetFailure(name, bytes, ceiling);
  if (message !== undefined) {
    fail(message);
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
    fail(`rolldown failed for ${input}:\n${result.stderr || result.stdout}`);
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
    fail(`Packed entry ${name} missing ${entryFile}`);
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
    fail(`Packed entry ${name} missing ${entryFile}`);
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
    fail(`Packed CSS ${name} missing ${file}`);
  }
  reportBudget(name, gzipSize(readFileSync(path)), ceilingGzip, "gzip bytes");
}

function checkFlagRaw(extracted: string, name: string, ceilingBytes: number): void {
  const flagsDir = join(extracted, "flags");
  if (!existsSync(flagsDir)) {
    fail(`Packed ${name} missing flags/`);
  }
  const files = listFlagFiles(flagsDir);
  reportBudget(name, flagPayload(flagsDir, files).bytes, ceilingBytes, "raw bytes");
}

let tarball: string;
try {
  tarball = findTarball(packageRoot);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const scratch = mkdtempSync(join(tmpdir(), "elmera-ui-size-"));
try {
  let extracted: string;
  try {
    extracted = extractPackedPackage(tarball, scratch, packageRoot);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const work = join(scratch, "work");
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
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("size-limit passed");
