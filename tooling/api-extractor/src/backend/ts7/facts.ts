/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- normalized compiler facts preserve optional fields. */
/* oxlint-disable anti-slop/no-runtime-typeof -- literal values are narrowed at the compiler boundary. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- assertions adapt unstable AST facts. */
/* oxlint-disable anti-slop/no-unknown-parameters -- primitive narrowing is the adapter's normalized-fact seam. */

import { relative } from "node:path";
import type { Node, TypeNode } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import {
  isCallExpression,
  isBindingElement,
  isClassDeclaration,
  isEnumDeclaration,
  isEnumMember,
  isFunctionDeclaration,
  isFunctionLikeDeclaration,
  isIdentifier,
  isIndexSignatureDeclaration,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isMappedTypeNode,
  isModuleDeclaration,
  isObjectBindingPattern,
  isParameterDeclaration,
  isParenthesizedTypeNode,
  isPropertyDeclaration,
  isPropertyAssignment,
  isPropertySignatureDeclaration,
  isQualifiedName,
  isTypeAliasDeclaration,
  isTypeOperatorNode,
  isTypeParameterDeclaration,
  isTypeReferenceNode,
  isTypeNode,
  isUnionTypeNode,
  isVariableDeclaration,
} from "typescript/unstable/ast/is";
import { SignatureKind, SymbolFlags, TypeFlags } from "typescript/unstable/sync";
import type { Checker, Signature, Symbol as TsSymbol, Type } from "typescript/unstable/sync";

import type { TypeFlagName } from "../../warnings.ts";
import type {
  BackendCompilerOperations,
  BackendDocumentation,
  BackendEnumFacts,
  BackendEnumMemberFacts,
  BackendIndexSignatureFacts,
  BackendNodeFacts,
  BackendNodeHandle,
  BackendNodeReference,
  BackendSignatureFacts,
  BackendSignatureHandle,
  BackendSymbolFacts,
  BackendSymbolHandle,
  BackendTypeFacts,
  BackendTypeHandle,
  BackendTypeNodeHandle,
  BackendTypeNameFacts,
  BackendWarningFact,
} from "../contracts.ts";
import { valueOrFirstDeclaration } from "./module.ts";

type DocumentationTagDraft = { name: string; value?: string };

export type TsgoFactsSession = {
  readonly checker: Checker;
  readonly rootDirectory: string;
  readonly symbol: (handle: BackendSymbolHandle, operation: string) => TsSymbol;
  readonly type: (handle: BackendTypeHandle, operation: string) => Type;
  readonly signature: (handle: BackendSignatureHandle, operation: string) => Signature;
  readonly node: (handle: BackendNodeReference, operation: string) => Node;
  readonly symbolHandle: (symbol: TsSymbol) => BackendSymbolHandle;
  readonly typeHandle: (type: Type) => BackendTypeHandle;
  readonly typeHandlesFor: (types: readonly Type[]) => readonly BackendTypeHandle[];
  readonly nodeHandle: (node: Node) => BackendNodeHandle;
  readonly signatureHandle: (signature: Signature) => BackendSignatureHandle;
  readonly typeNodeHandle: (node: TypeNode) => BackendTypeNodeHandle;
  readonly nodeReference: (node: Node) => BackendNodeReference;
  readonly symbolAt: (node: Node) => BackendSymbolHandle | undefined;
  readonly resolveNode: (node: { readonly resolve: () => Node | undefined }) => Node | undefined;
};

const typeFlagDisplayOrder: readonly [TypeFlags, TypeFlagName][] = [
  [TypeFlags.Any, "Any"],
  [TypeFlags.Unknown, "Unknown"],
  [TypeFlags.Undefined, "Undefined"],
  [TypeFlags.Null, "Null"],
  [TypeFlags.Void, "Void"],
  [TypeFlags.String, "String"],
  [TypeFlags.Number, "Number"],
  [TypeFlags.BigInt, "BigInt"],
  [TypeFlags.Boolean, "Boolean"],
  [TypeFlags.ESSymbol, "ESSymbol"],
  [TypeFlags.StringLiteral, "StringLiteral"],
  [TypeFlags.NumberLiteral, "NumberLiteral"],
  [TypeFlags.BigIntLiteral, "BigIntLiteral"],
  [TypeFlags.BooleanLiteral, "BooleanLiteral"],
  [TypeFlags.UniqueESSymbol, "UniqueESSymbol"],
  [TypeFlags.EnumLiteral, "EnumLiteral"],
  [TypeFlags.Enum, "Enum"],
  [TypeFlags.NonPrimitive, "NonPrimitive"],
  [TypeFlags.Never, "Never"],
  [TypeFlags.TypeParameter, "TypeParameter"],
  [TypeFlags.Object, "Object"],
  [TypeFlags.Index, "Index"],
  [TypeFlags.TemplateLiteral, "TemplateLiteral"],
  [TypeFlags.StringMapping, "StringMapping"],
  [TypeFlags.Substitution, "Substitution"],
  [TypeFlags.IndexedAccess, "IndexedAccess"],
  [TypeFlags.Conditional, "Conditional"],
  [TypeFlags.Union, "Union"],
  [TypeFlags.Intersection, "Intersection"],
];

export function createCompilerOperations(session: TsgoFactsSession): BackendCompilerOperations {
  return {
    typeOfSymbol: (symbol, declared) => typeOfSymbol(session, symbol, declared),
    typeAtNode: (node) => typeAtNode(session, node),
    typeFacts: (type) => typeFacts(session, type),
    symbolFacts: (symbol) => symbolFacts(session, symbol),
    documentationOfSymbol: (symbol) => documentationOfSymbol(session, symbol),
    enumFacts: (type) => enumFacts(session, type),
    nodeFacts: (node) => nodeFacts(session, node),
    typeNameFacts: (type, sourceNode, includeArguments) =>
      typeNameFacts(session, type, sourceNode, includeArguments),
    signaturesOfType: (type) => signaturesOfType(session, type),
    signatureFacts: (signature) => signatureFacts(session, signature),
    propertiesOfType: (type) => propertiesOfType(session, type),
    propertyType: (property) => propertyType(session, property),
    indexSignatureOfType: (type) => indexSignatureOfType(session, type),
    baseConstraintOfType: (type) => baseConstraintOfType(session, type),
    isArrayType: (type) => isArrayType(session, type),
    isReadonlyType: (type) => isReadonlyType(session, type),
    typeToString: (type) => typeToString(session, type),
  };
}

function typeOfSymbol(
  session: TsgoFactsSession,
  handle: BackendSymbolHandle,
  declared: boolean
): BackendTypeHandle | undefined {
  const raw = session.symbol(handle, "typeOfSymbol");
  const target = (raw.flags & SymbolFlags.Alias) !== 0 ? session.checker.getAliasedSymbol(raw) : raw;
  const declaration = valueOrFirstDeclaration(target);
  const type =
    declaration !== undefined && isVariableDeclaration(declaration)
      ? session.checker.getTypeAtLocation(declaration)
      : declared &&
          declaration !== undefined &&
          (isTypeAliasDeclaration(declaration) ||
            isInterfaceDeclaration(declaration) ||
            isClassDeclaration(declaration) ||
            isEnumDeclaration(declaration))
        ? session.checker.getDeclaredTypeOfSymbol(target)
        : session.checker.getTypeOfSymbol(target);
  return type === undefined ? undefined : session.typeHandle(type);
}

function typeAtNode(session: TsgoFactsSession, handle: BackendNodeReference): BackendTypeHandle | undefined {
  const raw = session.node(handle, "typeAtNode");
  const type = isTypeNode(raw)
    ? session.checker.getTypeFromTypeNode(raw)
    : session.checker.getTypeAtLocation(raw);
  return type === undefined ? undefined : session.typeHandle(type);
}

function typeFacts(session: TsgoFactsSession, handle: BackendTypeHandle): BackendTypeFacts {
  const type = session.type(handle, "typeFacts");
  const symbol = type.getSymbol();
  const aliasSymbol = type.getAliasSymbol();
  const intrinsic = isIntrinsic(type.flags);
  return {
    typeText: session.checker.typeToString(type),
    flags: typeFlagNames(type.flags),
    ...(intrinsic === undefined ? {} : { intrinsic }),
    ...(type.isErrorType() ? { isError: true } : {}),
    ...(type.isTypeParameter() ? { isTypeParameter: true } : {}),
    ...(type.isUnionType() ? { isUnion: true } : {}),
    ...(type.isIntersectionType() ? { isIntersection: true } : {}),
    ...(type.isIndexType() ? { isIndex: true, indexTarget: session.typeHandle(type.getTarget()) } : {}),
    ...(type.isTupleType() ? { isTuple: true } : {}),
    ...(session.checker.isArrayType(type) ? { isArray: true } : {}),
    ...(type.isIntersectionType() ||
    (type.flags & TypeFlags.Object) !== 0 ||
    ((type.flags & TypeFlags.NonPrimitive) !== 0 && session.checker.typeToString(type) === "object")
      ? { isObject: true }
      : {}),
    ...(type.isTypeReference() ? { isTypeReference: true } : {}),
    ...((type.flags & TypeFlags.EnumLike) !== 0 ? { isEnum: true } : {}),
    ...(symbol === undefined ? {} : { symbol: session.symbolHandle(symbol) }),
    ...(aliasSymbol === undefined ? {} : { aliasSymbol: session.symbolHandle(aliasSymbol) }),
    ...(type.isLiteralType() && isLiteral(type.value) ? { literal: type.value } : {}),
    ...(type.isUnionType() || type.isIntersectionType()
      ? { unionOrIntersectionTypes: session.typeHandlesFor(type.getTypes()) }
      : {}),
    ...(type.isTypeReference()
      ? { typeArguments: session.typeHandlesFor(session.checker.getTypeArguments(type)) }
      : {}),
    ...(type.getAliasTypeArguments().length > 0
      ? { aliasTypeArguments: session.typeHandlesFor(type.getAliasTypeArguments()) }
      : {}),
  };
}

function symbolFacts(session: TsgoFactsSession, handle: BackendSymbolHandle): BackendSymbolFacts {
  const symbol = session.symbol(handle, "symbolFacts");
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
  return {
    name: symbol.name,
    flags: [
      ...((symbol.flags & SymbolFlags.Alias) !== 0 ? (["alias"] as const) : []),
      ...((symbol.flags & SymbolFlags.TypeParameter) !== 0 ? (["typeParameter"] as const) : []),
      ...((symbol.flags & SymbolFlags.Optional) !== 0 ? (["optional"] as const) : []),
    ],
    declarationPaths: sourcePaths,
    declarations,
    repositoryRelativeDeclarationPaths: sourcePaths.map((path) => relativePath(session.rootDirectory, path)),
    ...(valueDeclaration === undefined ? {} : { valueDeclaration }),
  };
}

function relativePath(rootDirectory: string, filePath: string): string {
  const path = relative(rootDirectory, filePath).replaceAll("\\", "/");
  return path === "" ? "." : path;
}

function documentationOfSymbol(
  session: TsgoFactsSession,
  handle: BackendSymbolHandle
): BackendDocumentation | undefined {
  const symbol = session.symbol(handle, "documentationOfSymbol");
  const description = session.checker.getDocumentationCommentOfSymbol(symbol).trim();
  const rawTags = session.checker.getJsDocTagsOfSymbol(symbol);
  const visibility = visibilityFromTags(rawTags.map((tag) => tag.name));
  const defaultTag = rawTags.find((tag) => tag.name === "default");
  const tags = rawTags
    .filter((tag) => !["default", "private", "internal", "public", "param"].includes(tag.name))
    .map((tag) => {
      const result: DocumentationTagDraft = { name: tag.name };
      if (tag.text !== undefined) {
        const value = String(tag.text);
        result.value =
          tag.name === "type" && value.startsWith("{") && value.endsWith("}") ? value.slice(1, -1) : value;
      }
      return result;
    });
  if (description === "" && tags.length === 0 && visibility === undefined && defaultTag?.text === undefined)
    return undefined;
  const declaration = symbol.declarations
    .map((candidate) => session.resolveNode(candidate))
    .find((candidate): candidate is Node => candidate !== undefined);
  const parameterTagOnly =
    declaration !== undefined && isParameterDeclaration(declaration) && description === "";
  return {
    ...(description === "" ? (parameterTagOnly ? { description: "" } : {}) : { description }),
    ...(defaultTag?.text === undefined ? {} : { defaultValue: String(defaultTag.text) }),
    ...(visibility === undefined ? {} : { visibility }),
    tags,
  };
}

function visibilityFromTags(names: readonly string[]): BackendDocumentation["visibility"] {
  const tags = new Set(names);
  if (tags.has("private")) return "private";
  if (tags.has("internal")) return "internal";
  if (tags.has("public")) return "public";
  return undefined;
}

function enumFacts(session: TsgoFactsSession, handle: BackendTypeHandle): BackendEnumFacts | undefined {
  const type = session.type(handle, "enumFacts");
  if ((type.flags & TypeFlags.EnumLike) === 0) return undefined;
  const initial = type.getAliasSymbol() ?? type.getSymbol();
  if (initial === undefined) return undefined;
  const parent = initial.getParent();
  const symbol = parent !== undefined && (parent.flags & SymbolFlags.Enum) !== 0 ? parent : initial;
  if ((symbol.flags & SymbolFlags.Enum) === 0) return undefined;
  const members: BackendEnumMemberFacts[] = [];
  const warnings: BackendWarningFact[] = [];
  for (const member of symbol.getExports().values()) {
    const declaration = member.declarations
      .map((candidate) => session.resolveNode(candidate))
      .find((candidate): candidate is Node => candidate !== undefined && isEnumMember(candidate));
    const memberType = session.checker.getTypeOfSymbol(member);
    const value = declaration === undefined ? undefined : session.checker.getConstantValue(declaration);
    const inferredValue =
      value ??
      (memberType?.isLiteralType() === true && isLiteral(memberType.value) ? memberType.value : undefined);
    if (
      declaration === undefined ||
      (typeof inferredValue !== "string" && typeof inferredValue !== "number")
    ) {
      warnings.push(enumWarning(session, symbol, member.name));
    }
    if (typeof inferredValue !== "string" && typeof inferredValue !== "number") continue;
    members.push({
      name: member.name,
      value: inferredValue,
      symbol: session.symbolHandle(member),
      ...(declaration === undefined ? {} : { declaration: session.nodeHandle(declaration) }),
      ...(session.checker.getDocumentationCommentOfSymbol(member).trim() === "" &&
      session.checker.getJsDocTagsOfSymbol(member).length === 0
        ? {}
        : { documentation: documentationOfSymbol(session, session.symbolHandle(member)) }),
    });
  }
  return {
    name: symbol.name,
    namespaces: symbolNamespaces(symbol),
    members,
    ...(warnings.length === 0 ? {} : { warnings }),
    ...(session.checker.getDocumentationCommentOfSymbol(symbol).trim() === "" &&
    session.checker.getJsDocTagsOfSymbol(symbol).length === 0
      ? {}
      : { documentation: documentationOfSymbol(session, session.symbolHandle(symbol)) }),
  };
}

function enumWarning(session: TsgoFactsSession, symbol: TsSymbol, memberName: string): BackendWarningFact {
  const declaration = symbol.declarations
    .map((candidate) => session.resolveNode(candidate))
    .find((candidate): candidate is Node => candidate !== undefined);
  const sourceFile = declaration?.getSourceFile();
  const start = declaration === undefined || sourceFile === undefined ? 0 : declaration.getStart(sourceFile);
  const position = sourceFile?.getLineAndCharacterOfPosition(start);
  return {
    code: "missing-enum-declaration",
    filePath: sourceFile?.fileName ?? "<unknown>",
    line: (position?.line ?? 0) + 1,
    column: (position?.character ?? 0) + 1,
    parsedSymbolStack: [],
    enumName: symbol.name,
    memberName,
  };
}

function bindingDefaults(
  name: Node | undefined
): readonly { readonly name: string; readonly initializerText: string }[] {
  if (name === undefined || !isObjectBindingPattern(name)) return [];
  return name.elements.flatMap((element) => {
    if (
      !isBindingElement(element) ||
      element.initializer === undefined ||
      element.name === undefined ||
      !isIdentifier(element.name)
    )
      return [];
    const propertyName = element.propertyName;
    if (propertyName !== undefined && !isIdentifier(propertyName)) return [];
    return [
      {
        name: propertyName?.text ?? element.name.text,
        initializerText: element.initializer.getText().trim(),
      },
    ];
  });
}

function nodeFacts(session: TsgoFactsSession, handle: BackendNodeReference): BackendNodeFacts {
  const node = session.node(handle, "nodeFacts");
  const sourceFile = node.getSourceFile();
  const start = node.getStart(sourceFile);
  const position = sourceFile.getLineAndCharacterOfPosition(start);
  const base: BackendNodeFacts = {
    kind: nodeKind(node),
    text: node.getText().replaceAll(/\s+/gu, " ").trim(),
    filePath: sourceFile.fileName,
    line: position.line + 1,
    column: position.character + 1,
  };
  const type = sourceNodeType(node);
  const result: BackendNodeFacts = {
    ...base,
    ...(type === undefined ? {} : { type: session.typeNodeHandle(type) }),
  };
  if (isTypeReferenceNode(node)) {
    return {
      ...result,
      typeName: typeNameFromNode(session, node),
      children: node.typeArguments?.map((child) => session.typeNodeHandle(child)),
    };
  }
  if (isUnionTypeNode(node) || isIntersectionTypeNode(node))
    return { ...result, children: node.types.map((child) => session.typeNodeHandle(child)) };
  if (isTypeOperatorNode(node))
    return {
      ...result,
      operator: node.operator === SyntaxKind.KeyOfKeyword ? "keyof" : undefined,
      children: [session.typeNodeHandle(node.type)],
    };
  if (isParenthesizedTypeNode(node)) return { ...result, children: [session.typeNodeHandle(node.type)] };
  if (isMappedTypeNode(node))
    return {
      ...result,
      keyName: node.typeParameter.name.text,
      constraint:
        node.typeParameter.constraint === undefined
          ? undefined
          : session.typeNodeHandle(node.typeParameter.constraint),
      mappedValueType: node.type === undefined ? undefined : session.typeNodeHandle(node.type),
      mappedOptional: node.questionToken !== undefined && node.questionToken.kind !== SyntaxKind.MinusToken,
    };
  if (
    isTypeAliasDeclaration(node) ||
    isInterfaceDeclaration(node) ||
    isClassDeclaration(node) ||
    isFunctionLikeDeclaration(node)
  ) {
    return {
      ...result,
      typeParameters: node.typeParameters?.map((parameter) => session.nodeHandle(parameter)),
      parameters: isFunctionLikeDeclaration(node)
        ? node.parameters.map((parameter) => session.nodeHandle(parameter))
        : undefined,
      returnType:
        isFunctionLikeDeclaration(node) && node.type !== undefined
          ? session.typeNodeHandle(node.type)
          : undefined,
      heritageTypes:
        isInterfaceDeclaration(node) || isClassDeclaration(node)
          ? node.heritageClauses?.flatMap((clause) =>
              clause.types.map((typeNode) => session.nodeReference(typeNode))
            )
          : undefined,
    };
  }
  if (isTypeParameterDeclaration(node))
    return {
      ...result,
      name: node.name.text,
      constraint: node.constraint === undefined ? undefined : session.typeNodeHandle(node.constraint),
      defaultType: node.defaultType === undefined ? undefined : session.typeNodeHandle(node.defaultType),
      typeName: { name: node.name.text, namespaces: [], authoredSymbol: session.symbolAt(node.name) },
    };
  if (
    isParameterDeclaration(node) ||
    isPropertyDeclaration(node) ||
    isPropertySignatureDeclaration(node) ||
    isPropertyAssignment(node) ||
    isVariableDeclaration(node)
  )
    return {
      ...result,
      name: isIdentifier(node.name) ? node.name.text : undefined,
      initializerText: node.initializer?.getText().trim(),
      initializer: node.initializer === undefined ? undefined : session.nodeHandle(node.initializer),
      optional: "questionToken" in node && node.questionToken !== undefined,
      declarationFlags: modifierFlags(node),
      ...(isParameterDeclaration(node)
        ? {
            bindingDefaults: bindingDefaults(node.name),
          }
        : {}),
    };
  if (isCallExpression(node)) {
    return {
      ...result,
      arguments: node.arguments.map((argument) => session.nodeHandle(argument)),
    };
  }
  if (isIndexSignatureDeclaration(node))
    return {
      ...result,
      keyName:
        node.parameters[0] && isIdentifier(node.parameters[0].name)
          ? node.parameters[0].name.text
          : undefined,
    };
  return result;
}

function typeNameFromNode(session: TsgoFactsSession, node: TypeNode): BackendTypeNameFacts {
  const typeReference = node as TypeNode & {
    readonly typeName: Node;
    readonly typeArguments?: readonly TypeNode[];
  };
  const typeName = typeReference.typeName;
  const authoredSymbol = session.symbolAt(isQualifiedName(typeName) ? typeName.right : typeName);
  const qualified = qualifiedNamespaces(typeName);
  const authoredRawSymbol =
    authoredSymbol === undefined ? undefined : session.symbol(authoredSymbol, "typeNameFromNode");
  const namespaces =
    qualified.length > 0 || authoredRawSymbol === undefined ? qualified : symbolNamespaces(authoredRawSymbol);
  return {
    name: rightmostName(typeName) ?? "",
    namespaces,
    ...(typeReference.typeArguments === undefined
      ? {}
      : {
          authoredArguments: typeReference.typeArguments.map((argument) => session.typeNodeHandle(argument)),
        }),
    ...(authoredSymbol === undefined ? {} : { authoredSymbol }),
  };
}

function typeNameFacts(
  session: TsgoFactsSession,
  handle: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  _includeArguments: boolean
): BackendTypeNameFacts | undefined {
  const rawNode = sourceNode === undefined ? undefined : session.node(sourceNode, "typeNameFacts");
  // Optional properties hand the resolver the authored value node while the
  // checker type is a union with `undefined`. The authored reference is only
  // the name of one union member, not the union itself, so do not let that
  // node manufacture a union-level type name. The resolver still obtains a
  // semantic alias name from the checker type below when one exists (for
  // example ReactNode/AwaitedReactNode).
  if (rawNode !== undefined && isTypeReferenceNode(rawNode)) {
    const type = session.type(handle, "typeNameFacts");
    const authored = typeNameFromNode(session, rawNode);
    if (!type.isUnionType() && !type.isIntersectionType()) return authored;
    const authoredSymbol = authored.authoredSymbol;
    const authoredDeclarationPaths =
      authoredSymbol === undefined
        ? []
        : session.symbol(authoredSymbol, "typeNameFacts").declarations.map((declaration) => declaration.path);
    if (!authoredDeclarationPaths.some((path) => path.includes("/node_modules/"))) return authored;
  }
  const type = session.type(handle, "typeNameFacts");
  const symbol = type.getAliasSymbol() ?? type.getSymbol();
  if (symbol === undefined || isInternalSymbol(symbol.name)) return undefined;
  return { name: symbol.name, namespaces: symbolNamespaces(symbol) };
}

function signaturesOfType(
  session: TsgoFactsSession,
  handle: BackendTypeHandle
): readonly BackendSignatureHandle[] {
  const type = session.type(handle, "signaturesOfType");
  return session.checker
    .getSignaturesOfType(type, SignatureKind.Call)
    .map((signature) => session.signatureHandle(signature));
}

function signatureFacts(session: TsgoFactsSession, handle: BackendSignatureHandle): BackendSignatureFacts {
  const signature = session.signature(handle, "signatureFacts");
  const returnType = session.checker.getReturnTypeOfSignature(signature);
  const declaration =
    signature.declaration === undefined ? undefined : session.resolveNode(signature.declaration);
  return {
    parameters: signature.getParameters().map((parameter) => session.symbolHandle(parameter)),
    ...(returnType === undefined ? {} : { returnType: session.typeHandle(returnType) }),
    typeParameters: signature.getTypeParameters().map((parameter) => session.typeHandle(parameter)),
    ...(declaration === undefined ? {} : { declaration: session.nodeHandle(declaration) }),
  };
}

function propertiesOfType(
  session: TsgoFactsSession,
  handle: BackendTypeHandle
): readonly BackendSymbolHandle[] {
  const type = session.type(handle, "propertiesOfType");
  const ordered: TsSymbol[] = [];
  const seen = new Set<string>();
  const add = (property: TsSymbol): void => {
    if (seen.has(property.name)) return;
    seen.add(property.name);
    ordered.push(property);
  };
  const declaration = type
    .getSymbol()
    ?.declarations.map((candidate) => candidate.resolve())
    .find((candidate): candidate is Node => candidate !== undefined && isInterfaceDeclaration(candidate));
  if (declaration !== undefined && isInterfaceDeclaration(declaration)) {
    for (const clause of declaration.heritageClauses ?? []) {
      if (clause.token !== SyntaxKind.ExtendsKeyword) continue;
      for (const heritage of clause.types) {
        const heritageType = session.checker.getTypeAtLocation(heritage);
        if (heritageType === undefined) continue;
        for (const property of session.checker.getPropertiesOfType(heritageType)) add(property);
      }
    }
  }
  for (const property of session.checker.getPropertiesOfType(type)) add(property);
  return ordered.map((property) => session.symbolHandle(property));
}

function propertyType(session: TsgoFactsSession, handle: BackendSymbolHandle): BackendTypeHandle | undefined {
  const property = session.symbol(handle, "propertyType");
  const type = session.checker.getTypeOfSymbol(property);
  return type === undefined ? undefined : session.typeHandle(type);
}

function indexSignatureOfType(
  session: TsgoFactsSession,
  handle: BackendTypeHandle
): BackendIndexSignatureFacts | undefined {
  const type = session.type(handle, "indexSignatureOfType");
  const infos = session.checker.getIndexInfosOfType(type);
  const info =
    infos.find((candidate) => (candidate.keyType.flags & TypeFlags.String) !== 0) ??
    infos.find((candidate) => (candidate.keyType.flags & TypeFlags.Number) !== 0);
  if (info === undefined) return undefined;
  const declaration = info.declaration?.resolve();
  return {
    keyType: (info.keyType.flags & TypeFlags.Number) !== 0 ? "number" : "string",
    valueType: session.typeHandle(info.valueType),
    ...(declaration === undefined ? {} : { declaration: session.nodeHandle(declaration) }),
    ...(declaration !== undefined &&
    isIndexSignatureDeclaration(declaration) &&
    !declaration.getSourceFile().fileName.includes("/node_modules/") &&
    declaration.parameters[0] !== undefined &&
    isIdentifier(declaration.parameters[0].name)
      ? { keyName: declaration.parameters[0].name.text }
      : {}),
  };
}

function baseConstraintOfType(
  session: TsgoFactsSession,
  handle: BackendTypeHandle
): BackendTypeHandle | undefined {
  const type = session.type(handle, "baseConstraintOfType");
  const base = session.checker.getBaseConstraintOfType(type);
  return base === undefined ? undefined : session.typeHandle(base);
}

function isArrayType(session: TsgoFactsSession, handle: BackendTypeHandle): boolean {
  return session.checker.isArrayType(session.type(handle, "isArrayType"));
}

function isReadonlyType(session: TsgoFactsSession, handle: BackendTypeHandle): boolean {
  const type = session.type(handle, "isReadonlyType") as Type & { readonly?: boolean };
  return type.readonly === true;
}

function typeToString(session: TsgoFactsSession, handle: BackendTypeHandle): string {
  return session.checker.typeToString(session.type(handle, "typeToString"));
}

function sourceNodeType(node: Node | undefined): TypeNode | undefined {
  if (node === undefined) return undefined;
  if (isTypeNode(node)) return node;
  if (isTypeAliasDeclaration(node)) return node.type;
  if (
    isParameterDeclaration(node) ||
    isPropertyDeclaration(node) ||
    isPropertySignatureDeclaration(node) ||
    isVariableDeclaration(node) ||
    isFunctionLikeDeclaration(node)
  )
    return node.type;
  return undefined;
}

function typeFlagNames(flags: TypeFlags): readonly TypeFlagName[] {
  const names = typeFlagDisplayOrder.filter(([flag]) => (flags & flag) === flag).map(([, name]) => name);
  return names.length === 0 ? ["Other"] : names;
}

function isLiteral(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isIntrinsic(flags: TypeFlags): BackendTypeFacts["intrinsic"] {
  if ((flags & TypeFlags.Any) !== 0) return "any";
  if ((flags & TypeFlags.Unknown) !== 0) return "unknown";
  if ((flags & TypeFlags.Undefined) !== 0) return "undefined";
  if ((flags & TypeFlags.Null) !== 0) return "null";
  if ((flags & TypeFlags.Void) !== 0) return "void";
  if ((flags & TypeFlags.String) !== 0) return "string";
  if ((flags & TypeFlags.Number) !== 0) return "number";
  if ((flags & TypeFlags.BigInt) !== 0) return "bigint";
  if ((flags & TypeFlags.Boolean) !== 0) return "boolean";
  if ((flags & TypeFlags.ESSymbol) !== 0) return "symbol";
  if ((flags & TypeFlags.Never) !== 0) return "never";
  return undefined;
}

function nodeKind(node: Node): BackendNodeFacts["kind"] {
  if (isTypeAliasDeclaration(node)) return "typeAlias";
  if (isInterfaceDeclaration(node)) return "interface";
  if (isClassDeclaration(node)) return "class";
  if (isEnumDeclaration(node)) return "enum";
  if (isEnumMember(node)) return "enumMember";
  if (isFunctionDeclaration(node)) return "function";
  if (isTypeReferenceNode(node)) return "typeReference";
  if (isUnionTypeNode(node)) return "union";
  if (isIntersectionTypeNode(node)) return "intersection";
  if (isTypeOperatorNode(node)) return "typeOperator";
  if (isMappedTypeNode(node)) return "mapped";
  if (isParenthesizedTypeNode(node)) return "parenthesized";
  if (isTypeParameterDeclaration(node)) return "typeParameter";
  if (isParameterDeclaration(node)) return "parameter";
  if (isPropertyDeclaration(node) || isPropertySignatureDeclaration(node) || isPropertyAssignment(node))
    return "property";
  if (isVariableDeclaration(node)) return "variable";
  if (isCallExpression(node)) return "callExpression";
  if (isFunctionLikeDeclaration(node)) return "functionLike";
  if (isIndexSignatureDeclaration(node)) return "indexSignature";
  return isTypeNode(node) ? "type" : "unknown";
}

function modifierFlags(node: Node): readonly ("readonly" | "private" | "protected" | "static")[] {
  const modifiers =
    (node as Node & { readonly modifiers?: readonly { readonly kind: SyntaxKind }[] }).modifiers ?? [];
  return modifiers.flatMap((modifier) =>
    modifier.kind === SyntaxKind.ReadonlyKeyword
      ? (["readonly"] as const)
      : modifier.kind === SyntaxKind.PrivateKeyword
        ? (["private"] as const)
        : modifier.kind === SyntaxKind.ProtectedKeyword
          ? (["protected"] as const)
          : modifier.kind === SyntaxKind.StaticKeyword
            ? (["static"] as const)
            : []
  );
}

function rightmostName(node: Node): string | undefined {
  return isIdentifier(node) ? node.text : isQualifiedName(node) ? node.right.text : undefined;
}

function qualifiedNamespaces(node: Node): string[] {
  if (!isQualifiedName(node)) return [];
  const result: string[] = [];
  let current: Node = node;
  while (isQualifiedName(current)) {
    if (isIdentifier(current.left)) result.unshift(current.left.text);
    current = current.left;
  }
  return result;
}

function symbolNamespaces(symbol: TsSymbol): string[] {
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

function isInternalSymbol(name: string): boolean {
  return new Set([
    "__call",
    "__constructor",
    "__new",
    "__index",
    "__export",
    "__global",
    "__missing",
    "__type",
    "__object",
    "__jsxAttributes",
    "__class",
    "__function",
    "VoidOrUndefinedOnly",
  ]).has(name);
}
