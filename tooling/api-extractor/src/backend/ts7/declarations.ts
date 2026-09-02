import type { Node } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import type { Project } from "typescript/unstable/sync";

import type { CompilerSourceFileMetadata } from "./file-ownership.ts";
import { isExternalSourceFile } from "./file-ownership.ts";

export type CompilerDeclaration = {
  readonly index: number;
  readonly path: string;
  readonly kind?: number;
  readonly resolve: (project?: Project) => Node | undefined;
};

type OwnedDeclarationSession = {
  readonly sourceFileMetadata: (path: string) => CompilerSourceFileMetadata | undefined;
  readonly resolveDeclaration: (declaration: CompilerDeclaration) => Node | undefined;
};

/** NodeHandle.resolve fetches the whole file. Excluded paths wait for parser policy. */
export function resolveOwnedDeclaration(
  session: OwnedDeclarationSession,
  declaration: CompilerDeclaration | undefined
): Node | undefined {
  if (
    declaration === undefined ||
    isExternalSourceFile(declaration.path, session.sourceFileMetadata(declaration.path))
  ) {
    return undefined;
  }
  return session.resolveDeclaration(declaration);
}

export function valueOrFirstDeclarationHandle<Declaration extends { readonly kind: number }>(symbol: {
  readonly declarations: readonly Declaration[];
  readonly valueDeclaration?: Declaration;
}): Declaration | undefined {
  return (
    symbol.declarations.find(
      (declaration) =>
        declaration.kind === SyntaxKind.VariableDeclaration ||
        declaration.kind === SyntaxKind.FunctionDeclaration ||
        declaration.kind === SyntaxKind.ClassDeclaration
    ) ??
    symbol.valueDeclaration ??
    symbol.declarations[0]
  );
}
