/**
 * The chart entry's API report. It runs `@microsoft/api-extractor` over the built `dist/chart.d.ts`
 * and compares the result with the committed `etc/chart.api.md`, so a public type change that the
 * report does not show fails. `--local` rewrites the report instead.
 *
 * The entry exports only the namespaces, so a type the parts reference but the entry does not export
 * is a forgotten export. The message callback collects each flag by the symbol name the extractor
 * gives it. The check parses the report's declarations and allows only the four namespaces' own
 * members, so a context, store or helper type that leaks into the public types fails here by name.
 */
import { Extractor, ExtractorConfig, ExtractorLogLevel, ExtractorMessageId } from "@microsoft/api-extractor";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Node } from "typescript/ast";
import {
  isExportDeclaration,
  isExportSpecifier,
  isIdentifier,
  isModuleBlock,
  isModuleDeclaration,
  isNamedExports,
} from "typescript/ast/is";
import { API } from "typescript/sync";

import { buildPackage } from "./build.ts";
import { packageRootFromScript, toPosix } from "./paths.ts";

/** The symbol a forgotten-export message names. */
const FORGOTTEN_SYMBOL = /^The symbol "([^"]+)" needs to be exported/u;

/** The ES module namespaces whose direct members are the chart's part components. */
const NAMESPACES: ReadonlySet<string> = new Set(["Chart", "PieChart", "RadialChart", "RadarChart"]);

/** The declarations block of an API report, its first `ts` code fence. api-extractor writes CRLF. */
function declarationBlock(report: string): string {
  return /```ts\r?\n([\s\S]*?)```/u.exec(report)?.[1] ?? "";
}

/** Each top-level statement of TypeScript source. Parsing needs no program, so no project loads. */
function parseStatements<T>(source: string, read: (statements: readonly Node[]) => T): T {
  const api = new API();
  try {
    const retained = api.createSourceFile("/chart.api.d.ts", source);
    try {
      return read(retained.sourceFile.statements);
    } finally {
      retained.dispose();
    }
  } finally {
    api.close();
  }
}

/**
 * The part components a report lists as direct members of the four namespaces. api-extractor
 * writes an ES module namespace as `declare namespace Chart { export { ChartBar as Bar } }`, so a
 * part is the local name each export specifier re-exports. No other declaration names a part.
 *
 * @param report - The API report's text.
 * @returns The sorted, distinct part names.
 */
export function namespaceParts(report: string): string[] {
  return parseStatements(declarationBlock(report), (statements) => {
    const parts = new Set<string>();
    for (const statement of statements) {
      if (!isModuleDeclaration(statement) || !isIdentifier(statement.name)) continue;
      if (!NAMESPACES.has(statement.name.text) || statement.body === undefined) continue;
      if (!isModuleBlock(statement.body)) continue;
      for (const member of statement.body.statements) {
        if (!isExportDeclaration(member) || member.exportClause === undefined) continue;
        if (!isNamedExports(member.exportClause)) continue;
        for (const specifier of member.exportClause.elements) {
          if (!isExportSpecifier(specifier)) continue;
          const local = specifier.propertyName ?? specifier.name;
          if (isIdentifier(local)) parts.add(local.text);
        }
      }
    }
    return [...parts].sort();
  });
}

/**
 * The symbol a forgotten-export message names.
 *
 * @param text - The message text api-extractor writes.
 * @returns The symbol name, or undefined for any other text.
 */
export function forgottenSymbol(text: string): string | undefined {
  return FORGOTTEN_SYMBOL.exec(text)?.[1];
}

/**
 * The forgotten symbols that are not part components.
 *
 * @param forgotten - The symbols api-extractor flagged.
 * @param parts - The part component names, which may be forgotten.
 * @returns The other flagged symbols, sorted and distinct.
 */
export function leakedSymbols(forgotten: readonly string[], parts: readonly string[]): string[] {
  const allowed = new Set(parts);
  return [...new Set(forgotten.filter((name) => !allowed.has(name)))].sort();
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The newest modification time under `directory`, in milliseconds. */
function newestMtime(directory: string): number {
  let newest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
  }
  return newest;
}

function main(packageRoot: string, local: boolean): void {
  const declarations = join(packageRoot, "dist/chart.d.ts");
  // The turbo task depends on `build`, so a fresh dist is the normal case. A direct run on an
  // older or missing dist builds it first, so the report never reads stale declarations.
  if (!isFile(declarations) || statSync(declarations).mtimeMs < newestMtime(join(packageRoot, "src"))) {
    buildPackage(packageRoot);
  }
  const config = ExtractorConfig.loadFileAndPrepare(join(packageRoot, "api-extractor.json"));
  const forgotten: string[] = [];
  const result = Extractor.invoke(config, {
    localBuild: local,
    showVerboseMessages: false,
    messageCallback: (message) => {
      const symbol = forgottenSymbol(message.text);
      if (message.messageId === ExtractorMessageId.ForgottenExport && symbol !== undefined) {
        forgotten.push(symbol);
        // Classified below against the report's namespace members, so it never reaches the count.
        message.logLevel = ExtractorLogLevel.None;
      }
    },
  });
  const fileName = config.reportConfigs[0]?.fileName ?? "chart.api.md";
  const reportPath = join(config.reportFolder, fileName);
  // Check mode leaves the committed report alone and writes the fresh one to the temp folder.
  const fresh = readFileSync(join(local ? config.reportFolder : config.reportTempFolder, fileName), "utf8");
  const leaked = leakedSymbols(forgotten, namespaceParts(fresh));
  if (leaked.length > 0) {
    throw new Error(
      `The chart's public types reference symbols the entry does not export: ${leaked.join(", ")}. Export each from src/chart.ts or keep it out of the public types.`
    );
  }
  if (!result.succeeded) {
    throw new Error(
      local
        ? "api-extractor reported errors."
        : `${toPosix(relative(packageRoot, reportPath))} is stale or api-extractor reported errors. Run \`pnpm --filter @elmeragroup/fuse api:report --local\` and commit the report.`
    );
  }
}

if (import.meta.main) {
  main(packageRootFromScript(import.meta.url), process.argv.includes("--local"));
}
