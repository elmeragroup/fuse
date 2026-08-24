/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- normalized optional module facts preserve the contract. */

import { relative, resolve } from "node:path";
import type { Node, SourceFile } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import {
  isClassDeclaration,
  isExportDeclaration,
  isExportSpecifier,
  isEnumDeclaration,
  isFunctionDeclaration,
  isImportDeclaration,
  isInterfaceDeclaration,
  isStringLiteral,
  isTypeAliasDeclaration,
  isVariableDeclaration,
} from "typescript/unstable/ast/is";
import { SymbolFlags, TypeFlags } from "typescript/unstable/sync";
import type { Checker, Project, Symbol as TsSymbol } from "typescript/unstable/sync";

import { FileNotInProgramError } from "../../errors.ts";
import type {
  BackendDocumentation,
  BackendExportDraft,
  BackendModuleDraft,
  BackendResolvedModule,
  BackendSymbolHandle,
} from "../contracts.ts";

export type TsgoModuleSession = {
  readonly project: Project;
  readonly checker: Checker;
  readonly rootDirectory: string;
  readonly cwd: string;
  readonly ensureOpen: (operation: string) => void;
  readonly symbolHandle: (symbol: TsSymbol) => BackendSymbolHandle;
  readonly documentationOfSymbol: (symbol: BackendSymbolHandle) => BackendDocumentation | undefined;
};

export function readModule(session: TsgoModuleSession, filePath: string): BackendModuleDraft {
  session.ensureOpen("readModule");
  const absoluteFilePath = resolvePath(session.cwd, filePath);
  const source = session.project.program.getSourceFile(absoluteFilePath);
  if (source === undefined)
    throw new FileNotInProgramError({
      filePath: absoluteFilePath,
      message: `File is not part of the TypeScript project: ${absoluteFilePath}`,
    });
  const moduleSymbol = session.checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) {
    throw new FileNotInProgramError({
      filePath: absoluteFilePath,
      message: `File has no module symbol: ${absoluteFilePath}`,
    });
  }
  const rawSymbols = [...session.checker.getExportsOfModule(moduleSymbol)];
  const symbols = rawSymbols.sort((left, right) => {
    const leftReExport = isReExport(left);
    const rightReExport = isReExport(right);
    const reExportOrder = Number(leftReExport) - Number(rightReExport);
    if (reExportOrder !== 0) return reExportOrder;
    if (!leftReExport && !rightReExport) {
      const pureTypeOrder =
        Number(isPureObjectType(left, session.checker)) - Number(isPureObjectType(right, session.checker));
      if (pureTypeOrder !== 0) return pureTypeOrder;
    }
    return 0;
  });
  const exports: BackendExportDraft[] = [];
  for (const symbol of symbols) {
    const entry = exportDescriptor(session, symbol, absoluteFilePath);
    if (entry === undefined) continue;
    exports.push(entry);
    const declaration = valueOrFirstDeclaration(exportTarget(session.checker, symbol));
    const isEnum = declaration !== undefined && isEnumDeclaration(declaration);
    if (!isEnum) {
      for (const member of symbol.getExports().values()) {
        const nested = exportDescriptor(session, member, absoluteFilePath, `${symbol.name}.${member.name}`, [
          symbol.name,
          member.name,
        ]);
        if (nested !== undefined) exports.push(nested);
      }
    }
  }
  const imports = source.statements
    .filter(isImportDeclaration)
    .flatMap((statement) =>
      isStringLiteral(statement.moduleSpecifier) ? [statement.moduleSpecifier.text] : []
    );
  const typeOnlyStarExports = source.statements.flatMap((statement) =>
    isExportDeclaration(statement) &&
    statement.isTypeOnly &&
    statement.exportClause === undefined &&
    statement.moduleSpecifier !== undefined &&
    isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : []
  );
  return {
    name: moduleName(session.rootDirectory, absoluteFilePath),
    exports,
    ...(imports.length === 0 ? {} : { imports }),
    ...(typeOnlyStarExports.length === 0 ? {} : { typeOnlyStarExports }),
  };
}

export function resolveModule(
  session: TsgoModuleSession,
  moduleSpecifier: string,
  containingFile: string
): BackendResolvedModule | undefined {
  session.ensureOpen("resolveModule");
  const absoluteContaining = resolvePath(session.cwd, containingFile);
  const source = session.project.program.getSourceFile(absoluteContaining);
  if (source === undefined) return undefined;
  // Ask the checker about the authored module specifier. This is the native
  // production resolution seam: it applies paths, package exports, suffixes,
  // and the configured module-resolution mode before we inspect declarations.
  // Do not reimplement `resolveModuleName` here; that legacy API is not part
  // of the TS7 boundary.
  const moduleStatement = source.statements.find((statement) => {
    if (isImportDeclaration(statement)) {
      return isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === moduleSpecifier;
    }
    return (
      isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleSpecifier
    );
  });
  const moduleNode =
    moduleStatement === undefined
      ? undefined
      : isImportDeclaration(moduleStatement)
        ? moduleStatement.moduleSpecifier
        : isExportDeclaration(moduleStatement)
          ? moduleStatement.moduleSpecifier
          : undefined;
  if (moduleNode === undefined) return undefined;
  const moduleSymbol = session.checker.getSymbolAtLocation(moduleNode);
  if (moduleSymbol === undefined || session.checker.isUnknownSymbol(moduleSymbol)) return undefined;
  const symbols = [
    moduleSymbol,
    ...((moduleSymbol.flags & SymbolFlags.Alias) !== 0
      ? [session.checker.getImmediateAliasedSymbol(moduleSymbol)].filter(
          (symbol): symbol is TsSymbol => symbol !== undefined
        )
      : []),
  ];
  const declarations = symbols.flatMap((symbol) =>
    symbol.declarations
      .map((candidate) => candidate.resolve())
      .filter((candidate): candidate is Node => candidate !== undefined)
  );
  const declaration = declarations
    .map((candidate) => candidate.getSourceFile())
    .sort((left, right) => Number(right.isDeclarationFile) - Number(left.isDeclarationFile))[0];
  const resolvedFilePath = declaration?.fileName;
  return resolvedFilePath === undefined
    ? undefined
    : { filePath: resolvePath(session.cwd, resolvedFilePath) };
}

function exportDescriptor(
  session: TsgoModuleSession,
  symbol: TsSymbol,
  filePath: string,
  publicName = symbol.name,
  symbolStack: readonly string[] = [publicName]
): BackendExportDraft | undefined {
  const target = exportTarget(session.checker, symbol);
  const source = session.project.program.getSourceFile(filePath);
  const declaration = valueOrFirstDeclaration(target);
  const inheritedTypes = extendsTypes(declaration);
  const docs = isReExport(symbol) ? undefined : session.documentationOfSymbol(session.symbolHandle(target));
  return {
    name: publicName,
    symbol: session.symbolHandle(target),
    symbolStack,
    ...(docs === undefined ? {} : { documentation: docs }),
    declarationSourcePath: declaration?.getSourceFile().fileName,
    pureType: isPureType(target),
    explicitValueReExport: source === undefined ? false : explicitValueReExport(symbol, source, publicName),
    ...(inheritedTypes === undefined ? {} : { extendsTypes: inheritedTypes }),
  };
}

export function valueOrFirstDeclaration(symbol: TsSymbol): Node | undefined {
  const value = symbol.declarations
    .map((declaration) => declaration.resolve())
    .find(
      (declaration) =>
        declaration !== undefined &&
        (isVariableDeclaration(declaration) ||
          isFunctionDeclaration(declaration) ||
          isClassDeclaration(declaration))
    );
  return value ?? symbol.valueDeclaration?.resolve() ?? symbol.declarations[0]?.resolve();
}

function exportTarget(checker: Checker, symbol: TsSymbol): TsSymbol {
  const declaration = symbol.declarations[0]?.resolve();
  if (
    (symbol.flags & SymbolFlags.Alias) === 0 &&
    (declaration === undefined || !isExportSpecifier(declaration))
  )
    return symbol;
  return checker.getAliasedSymbol(symbol);
}

function isReExport(symbol: TsSymbol): boolean {
  return symbol.declarations.some((declaration) => {
    const resolved = declaration.resolve();
    return resolved !== undefined && isExportSpecifier(resolved);
  });
}

function explicitValueReExport(symbol: TsSymbol, source: SourceFile, publicName: string): boolean {
  if (
    symbol.declarations.some((declaration) => {
      const resolved = declaration.resolve();
      return (
        resolved !== undefined &&
        isExportSpecifier(resolved) &&
        isExportDeclaration(resolved.parent) &&
        resolved.parent.isTypeOnly !== true
      );
    })
  ) {
    return true;
  }
  const exportName = publicName.slice(publicName.lastIndexOf(".") + 1);
  return source.statements.some(
    (statement) =>
      isExportDeclaration(statement) &&
      statement.isTypeOnly !== true &&
      statement.exportClause !== undefined &&
      "elements" in statement.exportClause &&
      statement.exportClause.elements.some(
        (specifier) =>
          isExportSpecifier(specifier) &&
          (specifier.name.text === exportName || specifier.propertyName?.text === symbol.name)
      )
  );
}

function extendsTypes(
  declaration: Node | undefined
): readonly { readonly name: string; readonly resolvedName?: string }[] | undefined {
  if (declaration === undefined || (!isInterfaceDeclaration(declaration) && !isClassDeclaration(declaration)))
    return undefined;
  const clauses =
    declaration.heritageClauses?.filter((clause) => clause.token === SyntaxKind.ExtendsKeyword) ?? [];
  return clauses.length === 0
    ? undefined
    : clauses.flatMap((clause) => clause.types.map((type) => ({ name: type.expression.getText() })));
}

function isPureType(symbol: TsSymbol): boolean {
  const declarations = symbol.declarations.map((declaration) => declaration.resolve()).filter(Boolean);
  return (
    declarations.length > 0 &&
    declarations.every(
      (declaration) =>
        declaration !== undefined &&
        (isInterfaceDeclaration(declaration) ||
          isTypeAliasDeclaration(declaration) ||
          isEnumDeclaration(declaration))
    )
  );
}

function isPureObjectType(symbol: TsSymbol, checker: Checker): boolean {
  if (!isPureType(symbol)) return false;
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  return (type.flags & (TypeFlags.Object | TypeFlags.Intersection)) !== 0;
}

function moduleName(rootDirectory: string, filePath: string): string {
  return relativePath(rootDirectory, filePath).replace(/\.d\.ts$|\.[cm]?tsx?$/, "");
}

function resolvePath(cwd: string, filePath: string): string {
  return resolve(cwd, filePath);
}

function relativePath(rootDirectory: string, filePath: string): string {
  return relative(rootDirectory, filePath).replaceAll("\\", "/");
}
