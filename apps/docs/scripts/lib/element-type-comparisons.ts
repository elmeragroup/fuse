/**
 * The public parts Fuse recognises by element identity: a parent that reads `child.type ===
 * SelectionItemSubSection` treats a child as that part only when the child's type is that very
 * component. Live code wraps the parts it can edit in a component of its own, which such a parent
 * no longer recognises, so it leaves these parts unwrapped. The pass reads Fuse's own source, so a
 * new comparison joins the set without a list to keep.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { SyntaxKind } from "typescript/ast";
import type { Node } from "typescript/ast";
import { isBinaryExpression, isPropertyAccessExpression } from "typescript/ast/is";
import type { Checker, Symbol as TsSymbol } from "typescript/sync";

import { resolved } from "./fuse-program.ts";
import type { FuseProgram } from "./fuse-program.ts";
import { pagePartSymbols } from "./part-identity.ts";
import type { IdentityPage } from "./part-identity.ts";
import { fuseSrc, repoRelative } from "./paths.ts";

/**
 * The component a value is, keyed by the symbol of its type. A function's type is the function,
 * and a namespace member such as `SelectionItem.SubSection` has the type of the component it holds,
 * so a part and a comparison against that component share the key.
 */
function componentKey(checker: Checker, symbol: TsSymbol): number | undefined {
  return checker.getTypeOfSymbol(resolved(checker, symbol)).getSymbol()?.id;
}

/** Every library source file, tests left out. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(absolute);
    return /\.tsx?$/u.test(entry.name) && !entry.name.includes(".test") && !entry.name.endsWith(".d.ts")
      ? [absolute]
      : [];
  });
}

/** Whether a property access reads React's `ReactElement.type`. */
function isElementType(checker: Checker, node: Node): boolean {
  if (!isPropertyAccessExpression(node) || node.name.text !== "type") return false;
  const symbol = checker.getSymbolAtLocation(node.name);
  return symbol?.declarations.some((declaration) => declaration.path.includes("/@types/react/")) === true;
}

/** One `element.type === Y` comparison: where it is and what `Y` names. */
type Comparison = { readonly at: string; readonly against: Node };

/** Every comparison of an element's type in one file, with the side it compares against. */
function comparisons(checker: Checker, file: string, root: Node): Comparison[] {
  const found: Comparison[] = [];
  const visit = (node: Node): void => {
    if (
      isBinaryExpression(node) &&
      (node.operatorToken.kind === SyntaxKind.EqualsEqualsEqualsToken ||
        node.operatorToken.kind === SyntaxKind.ExclamationEqualsEqualsToken)
    ) {
      const against = isElementType(checker, node.left)
        ? node.right
        : isElementType(checker, node.right)
          ? node.left
          : undefined;
      if (against !== undefined) found.push({ at: repoRelative(file), against });
    }
    node.forEachChild(visit);
  };
  visit(root);
  return found;
}

/**
 * The public parts a Fuse parent compares an element's type against, such as
 * `SelectionItem.SubSection` and `Table.Root`. A comparison against a value outside Fuse, such as
 * React's `Fragment`, or against a tag name string, recognises no part and is skipped.
 *
 * @param fuse - The library program of the generation run.
 * @param pages - Every page's entries, each with the exports it documents.
 * @returns The part names, sorted.
 * @throws {Error} When a comparison names a Fuse component that is no public part, since Live code
 * could not tell which part to leave unwrapped.
 */
export function identityComparedParts(fuse: FuseProgram, pages: readonly IdentityPage[]): readonly string[] {
  const { checker } = fuse;
  const partsByKey = new Map<number, Set<string>>();
  for (const page of pages) {
    for (const { name, symbol } of pagePartSymbols(fuse, page)) {
      const key = componentKey(checker, symbol);
      if (key !== undefined) partsByKey.set(key, (partsByKey.get(key) ?? new Set()).add(name));
    }
  }
  const parts = new Set<string>();
  const problems: string[] = [];
  for (const file of sourceFiles(fuseSrc)) {
    // Only a file that reads `.type` can compare one; fetching every syntax tree costs a round
    // trip each. The checker still decides each match in the files that pass.
    if (!readFileSync(file, "utf8").includes(".type")) continue;
    const sourceFile = fuse.program.getSourceFile(file);
    if (sourceFile === undefined) continue;
    for (const { at, against } of comparisons(checker, file, sourceFile)) {
      const symbol = checker.getSymbolAtLocation(
        isPropertyAccessExpression(against) ? against.name : against
      );
      if (symbol === undefined) continue;
      const declaration = resolved(checker, symbol).declarations[0];
      // Tag names, React's own types, and a context compared by value recognise no Fuse part.
      if (declaration === undefined || !declaration.path.toLowerCase().startsWith(fuseSrc.toLowerCase()))
        continue;
      const key = componentKey(checker, symbol);
      const named = key === undefined ? undefined : partsByKey.get(key);
      if (named === undefined) {
        problems.push(
          `${at}: compares an element's type against ${symbol.name}, which is no documented part`
        );
        continue;
      }
      for (const name of named) parts.add(name);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `Live code cannot tell which parts Fuse recognises by identity:\n${problems.join("\n")}\n` +
        "Document the component as a part of its page, or compare something other than the element type."
    );
  }
  return [...parts].sort();
}
