/**
 * The chart entry's API report. It runs `@microsoft/api-extractor` over the built `dist/chart.d.ts`
 * and compares the result with the committed `etc/chart.api.md`, so a public type change that the
 * report does not show fails. `--local` rewrites the report instead.
 *
 * The namespaces type their parts as `typeof ChartBar`, and the entry exports only the namespaces,
 * so api-extractor flags every part function as a forgotten export. The message callback collects
 * each flag by the symbol name the extractor gives it. The check parses the report's declarations
 * and allows only the `typeof` targets of the four namespace objects' own members, so a context,
 * store or helper type that leaks into the public types fails here by name, even when a props type
 * names it through `typeof`. TypeScript 7 parses through its snapshot API, because it has no
 * standalone `createSourceFile`.
 */
import { Extractor, ExtractorConfig, ExtractorLogLevel, ExtractorMessageId } from "@microsoft/api-extractor";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Node } from "typescript/unstable/ast";
import {
  isIdentifier,
  isPropertySignatureDeclaration,
  isTypeLiteralNode,
  isTypeQueryNode,
  isVariableStatement,
} from "typescript/unstable/ast/is";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

import { buildPackage } from "./build.ts";
import { packageRootFromScript, toPosix } from "./paths.ts";

/** The symbol a forgotten-export message names. */
const FORGOTTEN_SYMBOL = /^The symbol "([^"]+)" needs to be exported/u;

/** The namespace objects whose direct members are the chart's part components. */
const NAMESPACES: ReadonlySet<string> = new Set(["Chart", "PieChart", "RadialChart", "RadarChart"]);

/** The declarations block of an API report, its first `ts` code fence. api-extractor writes CRLF. */
function declarationBlock(report: string): string {
  return /```ts\r?\n([\s\S]*?)```/u.exec(report)?.[1] ?? "";
}

/** Each top-level statement of TypeScript source, parsed by TypeScript 7's snapshot API. */
function parseStatements<T>(source: string, read: (statements: readonly Node[]) => T): T {
  const virtualFs = createVirtualFileSystem({});
  const fileName = "/chart.api.d.ts";
  virtualFs.writeFile?.(fileName, source);
  const api = new API({ cwd: "/", fs: virtualFs });
  try {
    const sourceFile = api
      .updateSnapshot({ openFiles: [fileName] })
      .getDefaultProjectForFile(fileName)
      ?.program.getSourceFile(fileName);
    if (sourceFile === undefined) {
      throw new Error("TypeScript could not parse the API report's declarations");
    }
    return read(sourceFile.statements);
  } finally {
    api.close();
  }
}

/**
 * The part components a report lists as direct members of the four namespace objects, read from
 * the `typeof` target of each member of their type literals. Any other `typeof`, such as one in a
 * props type, names no part.
 *
 * @param report - The API report's text.
 * @returns The sorted, distinct part names.
 */
export function namespaceParts(report: string): string[] {
  return parseStatements(declarationBlock(report), (statements) => {
    const parts = new Set<string>();
    for (const statement of statements) {
      if (!isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const { name, type } = declaration;
        if (
          !isIdentifier(name) ||
          !NAMESPACES.has(name.text) ||
          type === undefined ||
          !isTypeLiteralNode(type)
        ) {
          continue;
        }
        for (const member of type.members) {
          if (
            isPropertySignatureDeclaration(member) &&
            isTypeQueryNode(member.type) &&
            isIdentifier(member.type.exprName)
          ) {
            parts.add(member.type.exprName.text);
          }
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
