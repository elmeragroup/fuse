/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- normalized compiler facts preserve optional fields. */
/* oxlint-disable anti-slop/no-runtime-typeof -- literal values are narrowed at the compiler boundary. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- assertions adapt unstable AST facts. */
/* oxlint-disable anti-slop/no-unknown-parameters -- primitive narrowing is the adapter's normalized-fact seam. */

/**
 * SIZE CEILING: full. Nothing more lands here before the node-facts or
 * type-name machinery splits into its own sibling (`class-facts.ts` style).
 */

import type { InterfaceDeclaration, Node, TypeNode } from "typescript/unstable/ast";
import { SyntaxKind } from "typescript/unstable/ast";
import {
  isArrayTypeNode,
  isCallExpression,
  isBindingElement,
  isClassExpression,
  isGetAccessorDeclaration,
  isMethodDeclaration,
  isMethodSignatureDeclaration,
  isNamedTupleMember,
  isOptionalTypeNode,
  isRestTypeNode,
  isSetAccessorDeclaration,
  isShorthandPropertyAssignment,
  isTupleTypeNode,
  isClassDeclaration,
  isEnumDeclaration,
  isEnumMember,
  isFunctionDeclaration,
  isFunctionLikeDeclaration,
  isIdentifier,
  isIndexSignatureDeclaration,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isImportTypeNode,
  isMappedTypeNode,
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
  isTypeQueryNode,
  isTypeReferenceNode,
  isTypeNode,
  isUnionTypeNode,
  isVariableDeclaration,
} from "typescript/unstable/ast/is";
import { SignatureKind, SymbolFlags, TypeFlags } from "typescript/unstable/sync";
import type { Checker, Program, Signature, Symbol as TsSymbol, Type } from "typescript/unstable/sync";

import type { TypeFlagName } from "../../warnings.ts";
import type {
  BackendCompilerOperations,
  BackendEnumFacts,
  BackendEnumMemberFacts,
  BackendIndexSignatureFacts,
  BackendNodeFacts,
  BackendNodeHandle,
  BackendNodeReference,
  BackendSignatureFacts,
  BackendSignatureHandle,
  BackendSymbolHandle,
  BackendTypeFacts,
  BackendTypeHandle,
  BackendTypeNodeHandle,
  BackendTypeNameFacts,
  BackendWarningFact,
} from "../contracts.ts";
import { callExpressionFacts } from "./call-facts.ts";
import { constructSignaturesOfType, declarationModifiers } from "./class-facts.ts";
import { documentationOfNode, documentationOfParameter, documentationOfSymbol } from "./documentation.ts";
import {
  declarationOwnership,
  isExternalDeclaration,
  isTypeScriptLibraryDeclaration,
} from "./file-ownership.ts";
import { valueOrFirstDeclaration } from "./module.ts";
import { symbolFacts, symbolNamespaces } from "./symbol-facts.ts";

export type TsgoFactsSession = {
  readonly checker: Checker;
  readonly program: Program;
  readonly rootDirectory: string;
  readonly ensureOpen: (operation: string) => void;
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

/**
 * Memoizes one normalized fact reader for the lifetime of a single extraction.
 *
 * The cache is keyed by the handle *object*, never by its numeric id: the
 * session interns one frozen handle per compiler entity, so object identity is
 * canonical within an extraction while ids restart at 1 in every registry. A
 * handle from another extraction therefore always misses the cache and reaches
 * the registry's session check instead of silently reading this session's facts
 * for a different entity. Every cached reader is a pure function of the
 * compiler snapshot behind that registry, so a repeated read is guaranteed to
 * observe the same facts.
 *
 * The closed-session guard is checked before the cache, because the guard the
 * underlying reader runs is only reached on a miss: a handle read once before
 * `close()` must fail afterwards exactly like every other operation.
 */
function memoizedByHandle<Handle extends object, Result>(
  session: TsgoFactsSession,
  operation: string,
  read: (handle: Handle) => Result
): (handle: Handle) => Result {
  const cache = new WeakMap<Handle, Result>();
  return (handle) => {
    session.ensureOpen(operation);
    const cached = cache.get(handle);
    if (cached !== undefined || cache.has(handle)) return cached as Result;
    const result = read(handle);
    cache.set(handle, result);
    return result;
  };
}

export function createCompilerOperations(session: TsgoFactsSession): BackendCompilerOperations {
  return {
    typeOfSymbol: (symbol, declared) => typeOfSymbol(session, symbol, declared),
    typeAtNode: memoizedByHandle(session, "typeAtNode", (node: BackendNodeReference) =>
      typeAtNode(session, node)
    ),
    typeFacts: memoizedByHandle(session, "typeFacts", (type: BackendTypeHandle) => typeFacts(session, type)),
    declarationOwnership: (node) => declarationOwnership(session, node),
    symbolFacts: memoizedByHandle(session, "symbolFacts", (symbol: BackendSymbolHandle) =>
      symbolFacts(session, symbol)
    ),
    documentationOfSymbol: (symbol) => documentationOfSymbol(session, symbol),
    enumFacts: memoizedByHandle(session, "enumFacts", (type: BackendTypeHandle) => enumFacts(session, type)),
    nodeFacts: memoizedByHandle(session, "nodeFacts", (node: BackendNodeReference) =>
      nodeFacts(session, node)
    ),
    typeNameFacts: (type, sourceNode) => typeNameFacts(session, type, sourceNode),
    signaturesOfType: memoizedByHandle(session, "signaturesOfType", (type: BackendTypeHandle) =>
      signaturesOfType(session, type)
    ),
    constructSignaturesOfType: memoizedByHandle(
      session,
      "constructSignaturesOfType",
      (type: BackendTypeHandle) => constructSignaturesOfType(session, type)
    ),
    signatureFacts: memoizedByHandle(session, "signatureFacts", (signature: BackendSignatureHandle) =>
      signatureFacts(session, signature)
    ),
    documentationOfNode: (node: BackendNodeReference) => documentationOfNode(session, node),
    documentationOfParameter: (
      parameter: BackendSymbolHandle,
      ownerDeclaration: BackendNodeReference | undefined
    ) => documentationOfParameter(session, parameter, ownerDeclaration),
    propertiesOfType: memoizedByHandle(session, "propertiesOfType", (type: BackendTypeHandle) =>
      propertiesOfType(session, type)
    ),
    propertyType: memoizedByHandle(session, "propertyType", (property: BackendSymbolHandle) =>
      propertyType(session, property)
    ),
    indexSignaturesOfType: memoizedByHandle(session, "indexSignaturesOfType", (type: BackendTypeHandle) =>
      indexSignaturesOfType(session, type)
    ),
    baseConstraintOfType: memoizedByHandle(session, "baseConstraintOfType", (type: BackendTypeHandle) =>
      baseConstraintOfType(session, type)
    ),
    isArrayType: memoizedByHandle(session, "isArrayType", (type: BackendTypeHandle) =>
      isArrayType(session, type)
    ),
    isReadonlyType: memoizedByHandle(session, "isReadonlyType", (type: BackendTypeHandle) =>
      isReadonlyType(session, type)
    ),
    typeToString: memoizedByHandle(session, "typeToString", (type: BackendTypeHandle) =>
      typeToString(session, type)
    ),
  };
}

/**
 * The type an exported symbol describes.
 *
 * Class symbols report their STATIC side through `getTypeOfSymbol`, which is
 * where construct signatures live — the same choice upstream makes so
 * `export class Dialog {}` resolves as a class. Interfaces, aliases, and enums
 * keep `getDeclaredTypeOfSymbol`, which for a class would silently describe
 * only its instance side.
 */
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
  const typeText = session.checker.typeToString(type);
  return {
    typeText,
    flags: typeFlagNames(type.flags),
    ...(intrinsic === undefined ? {} : { intrinsic }),
    ...(type.isErrorType() ? { isError: true } : {}),
    ...(type.isTypeParameter() ? { isTypeParameter: true } : {}),
    ...(type.isUnionType() ? { isUnion: true } : {}),
    ...(type.isIntersectionType() ? { isIntersection: true } : {}),
    ...(type.isIndexType() ? { isIndex: true, indexTarget: session.typeHandle(type.getTarget()) } : {}),
    ...(tupleTarget(type) === undefined ? {} : { isTuple: true }),
    ...(session.checker.isArrayType(type) ? { isArray: true } : {}),
    ...(type.isIntersectionType() ||
    (type.flags & TypeFlags.Object) !== 0 ||
    ((type.flags & TypeFlags.NonPrimitive) !== 0 && typeText === "object")
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
      ? {
          referenceTarget: session.typeHandle(type.getTarget()),
          typeArguments: session.typeHandlesFor(session.checker.getTypeArguments(type)),
        }
      : {}),
    ...(type.getAliasTypeArguments().length > 0
      ? { aliasTypeArguments: session.typeHandlesFor(type.getAliasTypeArguments()) }
      : {}),
    ...(type.isConditionalType()
      ? {
          conditionalCheckType: session.typeHandle(type.getCheckType()),
          conditionalTrueType: session.typeHandle(type.getTrueType()),
          conditionalFalseType: session.typeHandle(type.getFalseType()),
        }
      : {}),
    ...(type.isSubstitutionType()
      ? {
          substitutionBaseType: session.typeHandle(type.getBaseType()),
          substitutionConstraint: session.typeHandle(type.getConstraint()),
        }
      : {}),
  };
}

/**
 * Recovers the tuple *target* behind a checker type, or `undefined` when the
 * type is not a tuple.
 *
 * `ObjectFlags.Tuple` only ever sits on the uninstantiated tuple target. An
 * authored `[string, number]` reaches the API as a type *reference* to that
 * target, and `Type.isTupleType()` is a plain `objectFlags & Tuple` test, so
 * asking the reference alone reports `false` for every ordinary tuple. Reading
 * through `getTarget()` is what makes the tuple visible, and it is also where
 * `elementFlags`, `fixedLength`, and `readonly` live.
 */
function tupleTarget(type: Type): Type | undefined {
  if (type.isTupleType()) return type;
  if (!type.isTypeReference()) return undefined;
  const target = type.getTarget();
  return target.isTupleType() ? target : undefined;
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
  if (isTypeQueryNode(node)) return { ...result, expressionName: node.exprName.getText() };
  if (isImportTypeNode(node) && node.isTypeOf)
    return { ...result, expressionName: typeQueryExpressionName(node, sourceFile) };
  if (isUnionTypeNode(node) || isIntersectionTypeNode(node))
    return { ...result, children: node.types.map((child) => session.typeNodeHandle(child)) };
  if (isTypeOperatorNode(node))
    return {
      ...result,
      operator:
        node.operator === SyntaxKind.KeyOfKeyword
          ? "keyof"
          : node.operator === SyntaxKind.ReadonlyKeyword
            ? "readonly"
            : undefined,
      children: [session.typeNodeHandle(node.type)],
    };
  if (isParenthesizedTypeNode(node)) return { ...result, children: [session.typeNodeHandle(node.type)] };
  if (isArrayTypeNode(node)) return { ...result, children: [session.typeNodeHandle(node.elementType)] };
  // Named and optional wrappers are transparent for element resolution: only the
  // innermost node names a type. A rest wrapper is reported separately, because
  // the node it wraps describes several semantic elements rather than one.
  if (isTupleTypeNode(node))
    return {
      ...result,
      children: node.elements.map((element) => session.typeNodeHandle(unwrapTupleElement(element))),
      restElements: node.elements.map((element) => isRestTupleElement(element)),
    };
  if (isMappedTypeNode(node))
    return {
      ...result,
      keyName: node.typeParameter.name.text,
      constraint:
        node.typeParameter.constraint === undefined
          ? undefined
          : session.typeNodeHandle(node.typeParameter.constraint),
      mappedValueType: node.type === undefined ? undefined : session.typeNodeHandle(node.type),
      mappedNameType: node.nameType === undefined ? undefined : session.typeNodeHandle(node.nameType),
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
      // Method visibility lives here too: class extraction filters inherited
      // members by the `private`/`protected` modifiers on their declaration.
      declarationFlags: modifierFlags(node),
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
  if (isCallExpression(node)) return { ...result, ...callExpressionFacts(session, node) };
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

/**
 * Reads the authored expression of a `typeof` type query.
 *
 * A plain query stores its entity name. A `typeof import(…)` node reaches this
 * seam as an import-type node, and the `typeof` keyword and the `import`
 * expression are separate AST tokens even when trivia sits between them — so
 * the authored text is sliced from the `import` keyword rather than stripped
 * from the front of the whole node's text.
 */
function typeQueryExpressionName(node: Node, sourceFile: ReturnType<Node["getSourceFile"]>): string {
  if (isTypeQueryNode(node)) {
    return node.exprName.getText();
  }
  const text = node.getText(sourceFile);
  const importTokenIndex = text.search(/\bimport\b/u);
  return importTokenIndex === -1 ? text.trimStart() : text.slice(importTokenIndex).trimStart();
}

/** Whether an authored tuple element spreads its type across several positions. */
function isRestTupleElement(element: TypeNode): boolean {
  if (isNamedTupleMember(element)) return element.dotDotDotToken !== undefined;
  return isRestTypeNode(element) || (isOptionalTypeNode(element) && isRestTypeNode(element.type));
}

/** Strips named, optional, and rest wrappers from authored tuple element syntax. */
function unwrapTupleElement(element: TypeNode): TypeNode {
  let current: TypeNode = isNamedTupleMember(element) ? element.type : element;
  while (isOptionalTypeNode(current) || isRestTypeNode(current)) current = current.type;
  return current;
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
  // The enclosing namespace chain of the TARGET declaration speaks first
  // (`Nested.Foo` inside `namespace Root` reports ["Root", "Nested"]); the
  // written qualifier only fills in when the chain has nothing to say, which
  // mirrors upstream's `getFullName` namespace selection.
  const chain = authoredRawSymbol === undefined ? [] : symbolNamespaces(authoredRawSymbol);
  const namespaces = chain.length > 0 ? chain : qualified;
  const builtInArray = builtInArrayReferenceName(session, authoredRawSymbol);
  return {
    name: rightmostName(typeName) ?? "",
    namespaces,
    ...(typeReference.typeArguments === undefined
      ? {}
      : {
          authoredArguments: typeReference.typeArguments.map((argument) => session.typeNodeHandle(argument)),
        }),
    ...(authoredSymbol === undefined ? {} : { authoredSymbol }),
    ...(builtInArray === undefined ? {} : { builtInArray }),
  };
}

/**
 * Reports which built-in array interface an authored reference names.
 *
 * The reference is only TypeScript's own array when the symbol it resolves to —
 * through an import alias — is an *interface* named `Array` or `ReadonlyArray`
 * declared in a TypeScript library file. User code can declare all three of
 * those things separately, so all three are checked. This mirrors upstream's
 * `getBuiltInArrayReferenceName` (`typeContainerUtils.ts`).
 */
function builtInArrayReferenceName(
  session: TsgoFactsSession,
  symbol: TsSymbol | undefined
): "Array" | "ReadonlyArray" | undefined {
  if (symbol === undefined) return undefined;
  const target = (symbol.flags & SymbolFlags.Alias) !== 0 ? session.checker.getAliasedSymbol(symbol) : symbol;
  const name = target.name;
  if (name !== "Array" && name !== "ReadonlyArray") return undefined;
  if ((target.flags & SymbolFlags.Interface) === 0) return undefined;
  return target.declarations.some((declaration) => isTypeScriptLibraryDeclaration(session, declaration))
    ? name
    : undefined;
}

function typeNameFacts(
  session: TsgoFactsSession,
  handle: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined
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
    if (
      authoredSymbol === undefined ||
      !session
        .symbol(authoredSymbol, "typeNameFacts")
        .declarations.some((declaration) => isExternalDeclaration(session, declaration))
    )
      return authored;
  }
  const type = session.type(handle, "typeNameFacts");
  const symbol = type.getAliasSymbol() ?? type.getSymbol();
  if (symbol === undefined || internalSymbolNames.has(symbol.name)) return undefined;
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
    .find(
      (candidate): candidate is InterfaceDeclaration =>
        candidate !== undefined && isInterfaceDeclaration(candidate)
    );
  if (declaration !== undefined) {
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

/**
 * Normalizes every index signature a type carries, in the compiler's own order.
 *
 * All of them are reported, including the `symbol` and pattern key domains the
 * semantic model has no encoding for, so the decision to drop one — and the
 * warning that records it — stays in the compiler-free resolver.
 *
 * A key name is read from every authored index signature, wherever it is
 * declared, exactly as upstream's `getKeyName` does: an index signature written
 * in a dependency is only ever reached when the caller asked for external types,
 * and its parameter name is as authored as any other.
 */
function indexSignaturesOfType(
  session: TsgoFactsSession,
  handle: BackendTypeHandle
): readonly BackendIndexSignatureFacts[] {
  const type = session.type(handle, "indexSignaturesOfType");
  return session.checker.getIndexInfosOfType(type).map((info) => {
    const declaration = session.resolveNode(info.declaration ?? { resolve: () => undefined });
    return {
      keyType: indexKeyType(info.keyType.flags),
      valueType: session.typeHandle(info.valueType),
      ...(info.isReadonly ? { isReadonly: true } : {}),
      ...(declaration === undefined ? {} : { declaration: session.nodeHandle(declaration) }),
      ...(declaration !== undefined &&
      isIndexSignatureDeclaration(declaration) &&
      declaration.parameters[0] !== undefined &&
      isIdentifier(declaration.parameters[0].name)
        ? { keyName: declaration.parameters[0].name.text }
        : {}),
    };
  });
}

function indexKeyType(flags: TypeFlags): BackendIndexSignatureFacts["keyType"] {
  if ((flags & TypeFlags.Number) !== 0) return "number";
  if ((flags & TypeFlags.ESSymbolLike) !== 0) return "symbol";
  if ((flags & TypeFlags.String) !== 0) return "string";
  return "other";
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

/**
 * Reports TypeScript's semantic readonly marker for array and tuple containers.
 *
 * `readonly T[]` is a reference to the built-in `ReadonlyArray` interface and
 * `readonly [A, B]` is a tuple reference whose *target* carries the readonly
 * flag. Neither marker lives on the reference itself, so both are read from the
 * reference target. The declaring file is checked as well because user code may
 * declare its own `ReadonlyArray`. A generic tuple type that is its own target
 * is accepted directly for the same reason.
 */
function isReadonlyType(session: TsgoFactsSession, handle: BackendTypeHandle): boolean {
  const type = session.type(handle, "isReadonlyType");
  const tuple = tupleTarget(type);
  if (tuple !== undefined) return tuple.isTupleType() && tuple.readonly;
  if (!type.isTypeReference()) return false;
  const target = type.getTarget();
  const symbol = target.getSymbol();
  return (
    symbol?.name === "ReadonlyArray" &&
    symbol.declarations.some((declaration) => isTypeScriptLibraryDeclaration(session, declaration))
  );
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
  if ((flags & TypeFlags.ESSymbolLike) !== 0) return "symbol";
  if ((flags & TypeFlags.Never) !== 0) return "never";
  return undefined;
}

function nodeKind(node: Node): BackendNodeFacts["kind"] {
  if (isTypeAliasDeclaration(node)) return "typeAlias";
  if (isInterfaceDeclaration(node)) return "interface";
  if (isClassDeclaration(node)) return "class";
  if (isClassExpression(node)) return "classExpression";
  if (isEnumDeclaration(node)) return "enum";
  if (isEnumMember(node)) return "enumMember";
  if (isFunctionDeclaration(node)) return "function";
  // Member declaration kinds are reported precisely because object and class
  // extraction classify members by the declaration they were written as.
  if (isMethodDeclaration(node)) return "method";
  if (isMethodSignatureDeclaration(node)) return "methodSignature";
  if (isGetAccessorDeclaration(node)) return "getAccessor";
  if (isSetAccessorDeclaration(node)) return "setAccessor";
  if (isTypeReferenceNode(node)) return "typeReference";
  // A `typeof` query — including its `typeof import(…)` spelling — is reported
  // before the generic type-node fallback so the resolver can preserve the
  // authored expression instead of the value's type.
  if (isTypeQueryNode(node)) return "typeQuery";
  if (isImportTypeNode(node) && node.isTypeOf) return "typeQuery";
  if (isUnionTypeNode(node)) return "union";
  if (isIntersectionTypeNode(node)) return "intersection";
  if (isTypeOperatorNode(node)) return "typeOperator";
  if (isArrayTypeNode(node)) return "array";
  if (isTupleTypeNode(node)) return "tuple";
  if (isMappedTypeNode(node)) return "mapped";
  if (isParenthesizedTypeNode(node)) return "parenthesized";
  if (isTypeParameterDeclaration(node)) return "typeParameter";
  if (isParameterDeclaration(node)) return "parameter";
  if (isPropertyDeclaration(node) || isPropertySignatureDeclaration(node) || isPropertyAssignment(node))
    return "property";
  if (isShorthandPropertyAssignment(node)) return "property";
  if (isVariableDeclaration(node)) return "variable";
  if (isCallExpression(node)) return "callExpression";
  if (isFunctionLikeDeclaration(node)) return "functionLike";
  if (isIndexSignatureDeclaration(node)) return "indexSignature";
  return isTypeNode(node) ? "type" : "unknown";
}

function modifierFlags(node: Node): readonly ("readonly" | "private" | "protected" | "static")[] {
  return declarationModifiers(node).flatMap((modifier) =>
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

/**
 * Compiler-internal symbol names that never describe a public API name.
 * Hoisted so the hot `typeNameFacts` path does not rebuild the set per call.
 *
 * DELIBERATELY NOT the parse layer's prefix rule (`isInternalSymbolName` in
 * `parse/contracts.ts`): this closed set lists exactly the names the checker
 * reports here and also admits "VoidOrUndefinedOnly", which carries no `__`
 * prefix; merging either policy into the other would change what is refused.
 */
const internalSymbolNames: ReadonlySet<string> = new Set([
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
]);
