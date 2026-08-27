/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- optional origin facts preserve the backend contract. */

import type { Node } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import { isIdentifier, isModuleDeclaration } from "typescript/unstable/ast/is";
import { SymbolFlags } from "typescript/unstable/sync";
import type { Symbol as TsSymbol } from "typescript/unstable/sync";

import type { BackendSymbolFacts, BackendSymbolHandle } from "../contracts.ts";
import { authoredSymbolName } from "./class-facts.ts";
import type { TsgoFactsSession } from "./facts.ts";
import { moduleOriginOfSymbol } from "./module-origin.ts";
import { repositoryRelativePath } from "./paths.ts";

/** Reads one symbol's normalized, alias-resolved facts. */
export function symbolFacts(session: TsgoFactsSession, handle: BackendSymbolHandle): BackendSymbolFacts {
  const symbol = session.symbol(handle, "symbolFacts");
  const target = (symbol.flags & SymbolFlags.Alias) !== 0 ? session.checker.getAliasedSymbol(symbol) : symbol;
  const repoPath = (path: string): string => repositoryRelativePath(session.rootDirectory, path);
  const declarations = symbol.declarations.flatMap((declaration) => {
    const resolved = session.resolveNode(declaration);
    return resolved === undefined ? [] : [session.nodeHandle(resolved)];
  });
  const resolvedValueDeclaration =
    symbol.valueDeclaration === undefined ? undefined : session.resolveNode(symbol.valueDeclaration);
  const valueDeclaration =
    resolvedValueDeclaration === undefined ? undefined : session.nodeHandle(resolvedValueDeclaration);
  const sourcePaths = symbol.declarations.map(
    (declaration) => session.resolveNode(declaration)?.getSourceFile().fileName ?? declaration.path
  );
  // Direct dependency declarations (for example React's `FC` interface) do
  // not carry an authored import node. The shared origin resolver derives
  // their package identity from ownership, while aliases still follow their
  // explicit import/re-export chain.
  const moduleOrigin = moduleOriginOfSymbol(session, symbol);
  const result: BackendSymbolFacts = {
    name: authoredSymbolName(symbol.name),
    identity: {
      name: authoredSymbolName(target.name),
      namespaces: symbolNamespaces(target),
    },
    ...(moduleOrigin === undefined ? {} : { moduleOrigin }),
    flags: [
      ...((symbol.flags & SymbolFlags.Alias) !== 0 ? (["alias"] as const) : []),
      ...((symbol.flags & SymbolFlags.Class) !== 0 ? (["class"] as const) : []),
      ...((symbol.flags & SymbolFlags.TypeParameter) !== 0 ? (["typeParameter"] as const) : []),
      ...((symbol.flags & SymbolFlags.Optional) !== 0 ? (["optional"] as const) : []),
    ],
    declarationPaths: sourcePaths,
    declarations,
    repositoryRelativeDeclarationPaths: sourcePaths.map(repoPath),
  };
  return valueDeclaration === undefined ? result : { ...result, valueDeclaration };
}

/** Returns enclosing namespace/module names for a compiler symbol. */
export function symbolNamespaces(symbol: TsSymbol): string[] {
  const declaration = symbol.declarations[0]?.resolve();
  if (declaration === undefined) return [];
  const result: string[] = [];
  let parent: Node = declaration.parent;
  while (parent.kind !== SyntaxKind.SourceFile) {
    if (isModuleDeclaration(parent) && isIdentifier(parent.name)) result.unshift(parent.name.text);
    parent = parent.parent;
  }
  return result;
}
