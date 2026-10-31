/**
 * The declaration behind every part of the pages that share one entry, read from the entry itself.
 *
 * Two parts are one part exactly when they resolve to the same declaration, whatever their names
 * or files. A page whose namespace resolves to the same declarations under the same keys as an
 * earlier page's is that page under another name, as `AreaChart` is `Chart`.
 */

import { API, SignatureKind, SymbolFlags } from "typescript/sync";
import type { Checker, Symbol as TsSymbol } from "typescript/sync";

import { fuseTsconfig, repoRoot } from "./paths.ts";

/** What the identity pass reads of one page: its entry and the exports it documents. */
export type IdentityPage = {
  readonly slug: string;
  readonly entryFile: string;
  readonly exportNames: readonly string[];
};

/** Each part of one page and the declaration it resolves to, keyed by the part's name. */
export type PageIdentities = ReadonlyMap<string, number>;

function resolved(checker: Checker, symbol: TsSymbol): TsSymbol {
  return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

/** One export's parts: a callable export is one part, and a namespace's members are its parts. */
function partsOf(checker: Checker, exported: TsSymbol): (readonly [string, number])[] {
  const symbol = resolved(checker, exported);
  const type = checker.getTypeOfSymbol(symbol);
  if (checker.getSignaturesOfType(type, SignatureKind.Call).length > 0) {
    return [[exported.name, symbol.id]];
  }
  return checker
    .getPropertiesOfType(type)
    .map((member) => [`${exported.name}.${member.name}`, resolved(checker, member).id] as const);
}

/**
 * Resolves every part of the given pages to its declaration.
 *
 * @param pages - The pages, each with the entry file and the export names it documents.
 * @returns Per page slug, each part's declaration id, in the entry's member order. Ids compare
 * within one call only.
 */
export function partIdentities(pages: readonly IdentityPage[]): ReadonlyMap<string, PageIdentities> {
  const api = new API({ cwd: repoRoot });
  try {
    const project = api.createSnapshot({ openProjects: [fuseTsconfig] }).getConfiguredProject(fuseTsconfig);
    if (project === undefined) {
      throw new Error(`Could not open the project at ${fuseTsconfig}`);
    }
    const { checker, program } = project;
    const result = new Map<string, PageIdentities>();
    for (const page of pages) {
      const sourceFile = program.getSourceFile(page.entryFile);
      const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
      if (moduleSymbol === undefined) {
        throw new Error(`${page.slug}: the project holds no module at ${page.entryFile}`);
      }
      const exports = checker.getExportsOfModule(moduleSymbol);
      const parts = page.exportNames.flatMap((name) => {
        const exported = exports.find((candidate) => candidate.name === name);
        if (exported === undefined) throw new Error(`${page.slug}: ${page.entryFile} exports no ${name}`);
        return partsOf(checker, exported);
      });
      result.set(page.slug, new Map(parts));
    }
    return result;
  } finally {
    api.close();
  }
}
