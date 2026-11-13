/**
 * The Fuse library program one generation run reads through TypeScript's API, opened once and
 * shared by every pass that resolves an entry's parts: the part identities and the function
 * reference.
 */

import { API, SignatureKind, SymbolFlags } from "typescript/sync";
import type { Checker, Printer, Program, Symbol as TsSymbol } from "typescript/sync";

import { fuseTsconfig, repoRoot } from "./paths.ts";

/** The library program, its checker and the compiler's declaration printer. */
export type FuseProgram = {
  readonly checker: Checker;
  readonly program: Program;
  readonly printer: Printer;
};

/** The open library program, and the function that closes it once every pass has read it. */
export type OpenFuseProgram = { readonly fuse: FuseProgram; readonly close: () => void };

/**
 * Opens the Fuse library program for one generation run.
 *
 * @returns The program and its close.
 */
export function openFuseProgram(): OpenFuseProgram {
  const api = new API({ cwd: repoRoot });
  const project = api.createSnapshot({ openProjects: [fuseTsconfig] }).getConfiguredProject(fuseTsconfig);
  if (project === undefined) {
    api.close();
    throw new Error(`Could not open the project at ${fuseTsconfig}`);
  }
  return {
    fuse: { checker: project.checker, program: project.program, printer: api.printer },
    close: () => api.close(),
  };
}

/**
 * The exports of an entry module, or undefined when the program holds no module there.
 *
 * @param fuse - The library program.
 * @param entryFile - The entry's source file.
 * @returns The entry's exported symbols.
 */
export function entryExports(fuse: FuseProgram, entryFile: string): readonly TsSymbol[] | undefined {
  const sourceFile = fuse.program.getSourceFile(entryFile);
  const moduleSymbol = sourceFile === undefined ? undefined : fuse.checker.getSymbolAtLocation(sourceFile);
  return moduleSymbol === undefined ? undefined : fuse.checker.getExportsOfModule(moduleSymbol);
}

/**
 * The symbol an alias names, or the symbol itself.
 *
 * @param checker - The program's checker.
 * @param symbol - The symbol.
 * @returns The declaring symbol.
 */
export function resolved(checker: Checker, symbol: TsSymbol): TsSymbol {
  return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

/** The part's name and the symbol that declares it, top-level or a namespace member. */
export type PartSymbol = { readonly name: string; readonly symbol: TsSymbol };

/**
 * One export's parts: a callable export is one part, and a namespace's members are its parts.
 *
 * @param checker - The program's checker.
 * @param exported - The exported symbol.
 * @returns Each part's name, such as `Chart.Root`, and its declaring symbol, in member order.
 */
export function partSymbols(checker: Checker, exported: TsSymbol): PartSymbol[] {
  const symbol = resolved(checker, exported);
  const type = checker.getTypeOfSymbol(symbol);
  if (checker.getSignaturesOfType(type, SignatureKind.Call).length > 0) {
    return [{ name: exported.name, symbol }];
  }
  return checker.getPropertiesOfType(type).map((member) => ({
    name: `${exported.name}.${member.name}`,
    symbol: resolved(checker, member),
  }));
}
