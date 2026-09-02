/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument -- the native checker enumeration is only loosely typed; every fact leaving this file is normalized before it crosses the backend contract. */
/* oxlint-disable typescript/no-unnecessary-condition, typescript/prefer-optional-chain -- remote AST parents can end earlier at runtime than the shared node typing admits, so guards stay explicit. */

import { SyntaxKind } from "typescript/unstable/ast";
import type { SourceFile } from "typescript/unstable/ast";
import type { Symbol as TsSymbol } from "typescript/unstable/sync";

import type { TsgoModuleSession } from "./module.ts";
import { isStarExport } from "./syntax.ts";

/**
 * Export ordering for one container: the rank/position rule `readModule`
 * documents.
 *
 * TypeScript 7 enumerates a container's exports in a different order than
 * TypeScript 6, so the upstream symbol-table order is recovered by ranking
 * each export's introduction instead of trusting either enumeration. This
 * module owns that data model (`StarContribution`, `IntroductionKey`) and its
 * policy; it imports the shared specifier-resolution seam to see which names
 * each star statement contributes.
 */

/**
 * Orders one container's exports by the rank/position rule described in
 * `readModule`, so top-level modules and flattened namespaces enumerate alike.
 */
export function orderedContainerExports(
  session: TsgoModuleSession,
  containerSymbol: TsSymbol,
  containerFile: SourceFile
): readonly TsSymbol[] {
  const rawSymbols = exportsOf(session, containerSymbol);
  const contributions = starContributionOrder(session, containerFile);
  const ordered = rawSymbols.map((symbol, index) => ({
    symbol,
    index,
    ...introductionKey(
      session,
      symbol,
      containerFile,
      contributions,
      declaresLocalValue(session, symbol, containerFile)
    ),
  }));
  ordered.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.position !== right.position) return left.position - right.position;
    return left.index - right.index;
  });
  return ordered.map((entry) => entry.symbol);
}

/** Where a star re-export statement's contributions land in the authored order. */
type StarContribution = { readonly position: number; readonly names: ReadonlySet<string> };

/**
 * Materializes a container's export symbols as a concrete array.
 *
 * The checker's own enumeration is only loosely typed on the native seam, so
 * every caller goes through this one normalization point.
 */
export function exportsOf(session: TsgoModuleSession, containerSymbol: TsSymbol): readonly TsSymbol[] {
  const symbols: TsSymbol[] = [];
  for (const symbol of session.checker.getExportsOfModule(containerSymbol)) {
    symbols.push(symbol);
  }
  return symbols;
}

/**
 * Resolves every star export statement of the module and records which names
 * each contributes, in statement order. Names are matched by symbol name, the
 * only identity a contributed export carries.
 */
function starContributionOrder(session: TsgoModuleSession, source: SourceFile): readonly StarContribution[] {
  const contributions: StarContribution[] = [];
  for (const statement of source.statements) {
    if (!isStarExport(statement, undefined)) continue;
    // The authored module-specifier node already carries the checker symbol.
    // Looking the resolved path up again would fetch the entire dependency
    // source file solely to enumerate names for ordering.
    const moduleSymbol = session.checker.getSymbolAtLocation(statement.moduleSpecifier);
    const names = new Set<string>();
    if (moduleSymbol !== undefined) {
      for (const member of session.checker.getExportsOfModule(moduleSymbol)) names.add(member.name);
    }
    contributions.push({ position: statement.getStart(source), names });
  }
  return contributions;
}

/**
 * Whether the symbol declares a VALUE directly in this module — a variable,
 * function, class, or a default export. These are exactly the exports
 * upstream reports before every re-export and declared type; an
 * `export * as Name` alias is NOT one even though TypeScript flags it as an
 * alias to a module full of values.
 */
function declaresLocalValue(session: TsgoModuleSession, symbol: TsSymbol, source: SourceFile): boolean {
  const declaration = symbol.declarations.find((candidate) =>
    session.sameSourceFile(candidate.path, source.fileName)
  );
  if (declaration === undefined) return false;
  return (
    declaration.kind === SyntaxKind.VariableDeclaration ||
    declaration.kind === SyntaxKind.FunctionDeclaration ||
    declaration.kind === SyntaxKind.ClassDeclaration ||
    declaration.kind === SyntaxKind.ExportAssignment
  );
}

/**
 * Where an export's introduction places it in the container's authored order.
 */
type IntroductionKey = { readonly rank: number; readonly position: number };

/**
 * The sort rank and position an export's introduction gives it.
 *
 * Locally declared values rank first regardless of position; everything
 * introduced by an explicit statement of this file ranks next in statement
 * order; star-contributed names rank last, ordered by their star statement.
 */
function introductionKey(
  session: TsgoModuleSession,
  symbol: TsSymbol,
  source: SourceFile,
  contributions: readonly StarContribution[],
  locallyDeclaredValue: boolean
): IntroductionKey {
  const key = (rank: number, position: number): IntroductionKey => ({ rank, position });
  if (locallyDeclaredValue) return key(0, -1);
  const declaration = symbol.declarations.find((candidate) =>
    session.sameSourceFile(candidate.path, source.fileName)
  );
  if (declaration !== undefined) {
    // A declaration's authored position is only needed for ordering. Avoid a
    // second source-file lookup (NodeHandle paths may differ in casing from
    // the already opened SourceFile) by locating the matching authored
    // statement in that source's local tree.
    const position = authoredPosition(source, symbol.name);
    return key(1, position);
  }
  for (const contribution of contributions) {
    if (contribution.names.has(symbol.name)) return key(2, contribution.position);
  }
  // No introduction found (a global or augmented symbol): keep it last.
  return key(3, Number.MAX_SAFE_INTEGER);
}

function authoredPosition(source: SourceFile, name: string): number {
  for (const statement of source.statements) {
    // SAFETY: these optional fields mirror runtime AST members that may be present on authored statements; this widening only reads them without changing the node.
    const candidate = statement as typeof statement & {
      readonly name?: { readonly text?: string };
      readonly exportClause?: {
        readonly name?: { readonly text?: string };
        readonly elements?: readonly { readonly name?: { readonly text?: string } }[];
      };
    };
    // Explicit export clauses are the symbol's authored introduction. Check
    // them before declaration names: an alias symbol's declaration points at
    // its target, and a namespace export has its name on the clause itself.
    if (candidate.exportClause?.name?.text === name) return statement.getStart(source);
    if (candidate.exportClause?.elements?.some((element) => element.name?.text === name)) {
      return statement.getStart(source);
    }
  }
  // A direct declaration with the same name can precede its later explicit
  // export clause. Scan declarations only after every explicit clause so a
  // direct alias is ordered by its export statement rather than its target's
  // declaration position.
  for (const statement of source.statements) {
    // SAFETY: this optional field mirrors the runtime AST member that may be present on authored statements; this widening only reads it without changing the node.
    const candidate = statement as typeof statement & {
      readonly name?: { readonly text?: string };
    };
    if (candidate.name?.text === name) return statement.getStart(source);
  }
  return Number.MAX_SAFE_INTEGER;
}
