/**
 * The preview entries' API reports, one per entry in `PREVIEW_ENTRIES`. For each entry it runs
 * `@microsoft/api-extractor` over the built `dist/<entry>.d.ts` and compares the result with the
 * committed `etc/<entry>.api.md`, so a public type change that the report does not show fails.
 * `--local` rewrites the reports instead.
 *
 * An entry exports its namespaces, not their parts, so a type the parts reference but the entry does
 * not export is a forgotten export. The message callback collects each flag by the symbol name the
 * extractor gives it. The check parses the report's declarations and allows only the entry's
 * namespaces' own members, so a context, store or helper type that leaks into the public types fails
 * here by name.
 *
 * The report reads `dist` as turbo's `build` left it and never builds on its own. A build here
 * empties the shared `dist` (tsdown cleans it) while `check` runs `test` and `test:browser`
 * against it, and the task cache knows from content hashes when `build` is fresh, which a script
 * can only guess from mtimes. Run it through turbo, so `build` runs or restores first.
 */
import { Extractor, ExtractorConfig, ExtractorLogLevel, ExtractorMessageId } from "@microsoft/api-extractor";
import { existsSync, readFileSync } from "node:fs";
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

import { PREVIEW_ENTRIES } from "./entries.ts";
import { packageRootFromScript, toPosix } from "./paths.ts";

/** The symbol a forgotten-export message names. */
const FORGOTTEN_SYMBOL = /^The symbol "([^"]+)" needs to be exported/u;

/** A preview entry: a subpath in `PREVIEW_ENTRIES`. */
export type PreviewEntry = (typeof PREVIEW_ENTRIES)[number];

/** What one entry's report allows as forgotten exports. */
type EntryReport = {
  /** The ES module namespaces whose direct members are the entry's part components. */
  readonly namespaces: ReadonlySet<string>;
  /**
   * Type helpers a public type's definition expands, which stay out of the entry. `ChartRadarCap`
   * counts a config's keys through the chart's two, and only that count is API, so their names are
   * not.
   */
  readonly privateTypeHelpers: readonly string[];
};

/** Each preview entry's report rules. */
export const ENTRY_REPORTS = {
  chart: {
    namespaces: new Set(["Chart", "PieChart", "RadialChart", "RadarChart"]),
    privateTypeHelpers: ["ChartHasFiveKeys", "ChartWithoutOne"],
  },
  tour: { namespaces: new Set(["Tour"]), privateTypeHelpers: [] },
} as const satisfies Record<PreviewEntry, EntryReport>;

/** The declarations block of an API report, its first `ts` code fence. api-extractor writes CRLF. */
function declarationBlock(report: string): string {
  return /```ts\r?\n([\s\S]*?)```/u.exec(report)?.[1] ?? "";
}

/** Each top-level statement of TypeScript source. Parsing needs no program, so no project loads. */
function parseStatements<T>(source: string, read: (statements: readonly Node[]) => T): T {
  const api = new API();
  try {
    const retained = api.createSourceFile("/entry.api.d.ts", source);
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
 * The part components a report lists as direct members of an entry's namespaces. api-extractor
 * writes an ES module namespace as `declare namespace Chart { export { ChartBar as Bar } }`, so a
 * part is the local name each export specifier re-exports. No other declaration names a part.
 *
 * @param report - The API report's text.
 * @param entry - The preview entry the report belongs to.
 * @returns The sorted, distinct part names.
 */
export function namespaceParts(report: string, entry: PreviewEntry): string[] {
  const namespaces = ENTRY_REPORTS[entry].namespaces;
  return parseStatements(declarationBlock(report), (statements) => {
    const parts = new Set<string>();
    for (const statement of statements) {
      if (!isModuleDeclaration(statement) || !isIdentifier(statement.name)) continue;
      if (!namespaces.has(statement.name.text) || statement.body === undefined) continue;
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
 * The forgotten symbols that are neither part components nor the entry's private type helpers.
 *
 * @param forgotten - The symbols api-extractor flagged.
 * @param parts - The part component names, which may be forgotten.
 * @param entry - The preview entry the symbols belong to.
 * @returns The other flagged symbols, sorted and distinct.
 */
export function leakedSymbols(
  forgotten: readonly string[],
  parts: readonly string[],
  entry: PreviewEntry
): string[] {
  const allowed = new Set<string>([...parts, ...ENTRY_REPORTS[entry].privateTypeHelpers]);
  return [...new Set(forgotten.filter((name) => !allowed.has(name)))].sort();
}

/** The turbo command that builds `dist` and then runs the report, with `--local` when `local` is set. */
function turboCommand(local: boolean): string {
  return `pnpm exec turbo run api:report --filter=@elmeragroup/fuse${local ? " -- --local" : ""}`;
}

function report(packageRoot: string, entry: PreviewEntry, local: boolean): void {
  const declarations = join(packageRoot, `dist/${entry}.d.ts`);
  if (!existsSync(declarations)) {
    throw new Error(
      `dist/${entry}.d.ts is missing. Run \`${turboCommand(local)}\`, which builds the package first.`
    );
  }
  const configObjectFullPath = join(packageRoot, "api-extractor.json");
  const base = ExtractorConfig.loadFile(configObjectFullPath);
  const config = ExtractorConfig.prepare({
    configObject: {
      ...base,
      mainEntryPointFilePath: `<projectFolder>/dist/${entry}.d.ts`,
      apiReport: { ...base.apiReport, enabled: true, reportFileName: entry },
    },
    configObjectFullPath,
    packageJsonFullPath: join(packageRoot, "package.json"),
  });
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
  const fileName = config.reportConfigs[0]?.fileName ?? `${entry}.api.md`;
  const reportPath = join(config.reportFolder, fileName);
  // Check mode leaves the committed report alone and writes the fresh one to the temp folder.
  const fresh = readFileSync(join(local ? config.reportFolder : config.reportTempFolder, fileName), "utf8");
  const leaked = leakedSymbols(forgotten, namespaceParts(fresh, entry), entry);
  if (leaked.length > 0) {
    throw new Error(
      `The ${entry} entry's public types reference symbols it does not export: ${leaked.join(", ")}. Export each from src/${entry}.ts or keep it out of the public types.`
    );
  }
  if (!result.succeeded) {
    throw new Error(
      local
        ? `api-extractor reported errors for the ${entry} entry.`
        : `${toPosix(relative(packageRoot, reportPath))} is stale or api-extractor reported errors. Run \`${turboCommand(true)}\` and commit the report.`
    );
  }
}

function main(packageRoot: string, local: boolean): void {
  for (const entry of PREVIEW_ENTRIES) {
    report(packageRoot, entry, local);
  }
}

if (import.meta.main) {
  main(packageRootFromScript(import.meta.url), process.argv.includes("--local"));
}
