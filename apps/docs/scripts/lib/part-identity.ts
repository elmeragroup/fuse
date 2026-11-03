/**
 * The declaration behind every part of the pages that share one entry, read from the entry itself.
 *
 * Two parts are one part exactly when they resolve to the same declaration, whatever their names
 * or files. A page whose namespace resolves to the same declarations under the same keys as an
 * earlier page's is that page under another name, as `AreaChart` is `Chart`.
 */

import { entryExports, partSymbols } from "./fuse-program.ts";
import type { FuseProgram } from "./fuse-program.ts";

/** What the identity pass reads of one page: its entry and the exports it documents. */
export type IdentityPage = {
  readonly slug: string;
  readonly entryFile: string;
  readonly exportNames: readonly string[];
};

/** Each part of one page and the declaration it resolves to, keyed by the part's name. */
export type PageIdentities = ReadonlyMap<string, number>;

/**
 * Resolves every part of the given pages to its declaration.
 *
 * @param fuse - The library program of the generation run.
 * @param pages - The pages, each with the entry file and the export names it documents.
 * @returns Per page slug, each part's declaration id, in the entry's member order. Ids compare
 * within one program only.
 */
export function partIdentities(
  fuse: FuseProgram,
  pages: readonly IdentityPage[]
): ReadonlyMap<string, PageIdentities> {
  const result = new Map<string, PageIdentities>();
  for (const page of pages) {
    const exports = entryExports(fuse, page.entryFile);
    if (exports === undefined) {
      throw new Error(`${page.slug}: the project holds no module at ${page.entryFile}`);
    }
    const parts = page.exportNames.flatMap((name) => {
      const exported = exports.find((candidate) => candidate.name === name);
      if (exported === undefined) throw new Error(`${page.slug}: ${page.entryFile} exports no ${name}`);
      return partSymbols(fuse.checker, exported).map(({ name: part, symbol }) => [part, symbol.id] as const);
    });
    result.set(page.slug, new Map(parts));
  }
  return result;
}
