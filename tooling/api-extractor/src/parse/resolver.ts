/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- Optional model fields preserve the upstream encoding. */
/* oxlint-disable anti-slop/no-runtime-typeof -- semantic model literals are narrowed at the resolver seam. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- the fallback flag tuple is package-owned. */

import type {
  BackendCompilerOperations,
  BackendExportDraft,
  BackendNodeHandle,
  BackendNodeReference,
  BackendTypeNodeHandle,
  BackendExtractionSession,
  BackendSymbolHandle,
  BackendTypeHandle,
  BackendWarningFact,
  BackendNodeFacts,
} from "../backend/contracts.ts";
import type { BackendModuleDraft } from "../backend/contracts.ts";
import type { ExportNode, ModuleNode, SemanticType, TypeArgument, TypeName } from "../model.ts";
import { defaultExtractorOptions } from "../options.ts";
import type { ExtractorOptions } from "../options.ts";
import type { ProvenanceEntry } from "../provenance.ts";
import type { ExtractWarning } from "../warnings.ts";
import { componentNode } from "./component.ts";
import { addUndefined } from "./component.ts";
import type { ResolverContext } from "./contracts.ts";
import { unsupported, warningMessage } from "./fallback.ts";
import {
  declarationPathsFor,
  propertyTypeNode,
  resolveEnumNode,
  resolveObjectNode,
  resolveSignatureNode,
  canonicalizeProvenance,
  recordProvenance,
} from "./object-resolver.ts";
import {
  collectSemanticPaths,
  componentPropSemanticPathFromProvenancePath,
  exportSemanticPath,
} from "./semantic-paths.ts";
export { ResolverFailure } from "./resolver-error.ts";
export type { ResolverContext as Context } from "./contracts.ts";

const builtInTypeScriptUtilityNames = new Set([
  "Pick",
  "Omit",
  "ReturnType",
  "Parameters",
  "InstanceType",
  "Partial",
  "Required",
  "Readonly",
  "Exclude",
  "Extract",
]);

export type ResolvedModule = {
  readonly module: ModuleNode;
  readonly warnings: readonly ExtractWarning[];
  readonly provenance: readonly ProvenanceEntry[];
};
type Context = ResolverContext;

export function resolveModule(
  session: BackendExtractionSession,
  draft: BackendModuleDraft,
  filePath: string,
  options?: ExtractorOptions
): ResolvedModule {
  const resolvedOptions = { ...defaultExtractorOptions, ...options };
  const warnings: BackendWarningFact[] = [];
  const context: Context = {
    operations: session.compiler,
    filePath,
    warnings,
    provenance: [],
    provenancePath: [],
    provenancePropertyContainer: "object",
    symbolStack: [],
    options: resolvedOptions,
    substitutions: new Map(),
    active: new Set(),
    propertyDepth: 0,
    pureTypeExport: false,
    authoredIntersectionMember: false,
  };
  context.operations.setErrorContext?.([]);
  const exports = draft.exports.map((entry) => resolveExport(entry, context));
  const module: ModuleNode = {
    name: draft.name,
    exports,
    ...(draft.imports === undefined ? {} : { imports: draft.imports }),
  };
  const semanticPaths = collectSemanticPaths(module);
  return {
    module,
    warnings: warnings.map(warningMessage),
    provenance: canonicalizeProvenance(context.provenance).filter((entry) =>
      semanticPaths.has(JSON.stringify(entry.path))
    ),
  };
}

function resolveExport(entry: BackendExportDraft, base: Context): ExportNode {
  const symbolStack = entry.symbolStack ?? [entry.name];
  const semanticPath = exportSemanticPath(entry.name);
  base.operations.setErrorContext?.(symbolStack);
  const symbolFacts = base.operations.symbolFacts(entry.symbol);
  recordProvenance(base, {
    path: semanticPath,
    declarationPaths: declarationPathsFor(symbolFacts),
    synthesized: symbolFacts.declarations.length === 0,
  });
  const declaration = symbolFacts.valueDeclaration ?? symbolFacts.declarations[0];
  const declarationFacts = declaration === undefined ? undefined : base.operations.nodeFacts(declaration);
  const sourceNode =
    declarationFacts?.kind === "function" || declarationFacts?.kind === "functionLike"
      ? undefined
      : declaration === undefined
        ? undefined
        : typeNodeFromDeclaration(base.operations, declaration);
  const declared =
    declarationFacts?.kind === "typeAlias" ||
    declarationFacts?.kind === "interface" ||
    declarationFacts?.kind === "class" ||
    declarationFacts?.kind === "enum";
  const type = base.operations.typeOfSymbol(entry.symbol, declared);
  const declaredType =
    type ?? (declaration === undefined ? undefined : base.operations.typeAtNode(declaration));
  const resolvedProvenance: ProvenanceEntry[] = [];
  const resolvedType = typeNode(declaredType, sourceNode, entry.symbol, {
    ...base,
    provenance: resolvedProvenance,
    provenancePath: semanticPath,
    symbolStack,
    pureTypeExport: entry.pureType === true,
  });
  const componentContext = {
    ...base,
    symbolStack: entry.symbolStack ?? [entry.name],
  };
  const authoredProps = authoredComponentProps(entry.symbol, componentContext);
  const bindingDefaults = authoredComponentBindingDefaults(entry.symbol, componentContext);
  const authoredProvenance: ProvenanceEntry[] = [];
  const authoredPropsType =
    authoredProps === undefined
      ? undefined
      : typeNode(base.operations.typeAtNode(authoredProps), authoredProps, undefined, {
          ...base,
          provenance: authoredProvenance,
          provenancePath: semanticPath,
          provenancePropertyContainer: "componentProps",
          propertyDepth: 0,
          symbolStack,
          ...(bindingDefaults === undefined ? {} : { bindingDefaults }),
        });
  const resolvedOutputType = componentNode(resolvedType, entry.name, authoredPropsType);
  const selectedProvenance =
    resolvedOutputType.kind === "component"
      ? authoredProvenance.length > 0
        ? authoredProvenance
        : componentProvenance(resolvedProvenance, semanticPath, resolvedOutputType)
      : resolvedProvenance;
  for (const provenance of selectedProvenance) recordProvenance(base, provenance);
  const output: ExportNode = {
    name: entry.name,
    type: resolvedOutputType,
    ...(entry.documentation === undefined ? {} : { documentation: entry.documentation }),
    ...(entry.extendsTypes === undefined ? {} : { extendsTypes: entry.extendsTypes }),
  };
  return output;
}

/**
 * Discover authored component props from normalized declaration/call/argument
 * relations. The backend only reports syntax relationships; React wrapper and
 * render-function policy lives here in the compiler-free resolver.
 */
function authoredComponentProps(
  symbol: BackendSymbolHandle,
  context: Context
): BackendTypeNodeHandle | undefined {
  const firstParameter = authoredComponentParameter(symbol, context);
  return firstParameter === undefined ? undefined : context.operations.nodeFacts(firstParameter).type;
}

function authoredComponentBindingDefaults(
  symbol: BackendSymbolHandle,
  context: Context
): ReadonlyMap<string, string> | undefined {
  const firstParameter = authoredComponentParameter(symbol, context);
  const defaults =
    firstParameter === undefined ? undefined : context.operations.nodeFacts(firstParameter).bindingDefaults;
  if (defaults === undefined || defaults.length === 0) return undefined;
  return new Map(defaults.map((entry) => [entry.name, entry.initializerText]));
}

function authoredComponentParameter(
  symbol: BackendSymbolHandle,
  context: Context
): BackendNodeHandle | undefined {
  const exportName = context.symbolStack.at(-1);
  if (exportName !== "default" && (exportName === undefined || !/^[A-Z]/u.test(exportName))) return undefined;
  context.operations.setErrorContext?.(context.symbolStack);
  const facts = context.operations.symbolFacts(symbol);
  const declaration = facts.valueDeclaration ?? facts.declarations[0];
  if (declaration === undefined) return undefined;
  const declarationFacts = context.operations.nodeFacts(declaration);
  if (declarationFacts.kind === "function" || declarationFacts.kind === "functionLike")
    return declarationFacts.parameters?.[0];
  if (declarationFacts.kind !== "variable" || declarationFacts.initializer === undefined) return undefined;
  const initializerFacts = context.operations.nodeFacts(declarationFacts.initializer);
  if (initializerFacts.kind === "function" || initializerFacts.kind === "functionLike")
    return initializerFacts.parameters?.[0];
  if (initializerFacts.kind !== "callExpression") return undefined;
  const renderFunction = (initializerFacts.arguments ?? []).find((argument) => {
    const kind = context.operations.nodeFacts(argument).kind;
    return kind === "functionLike" || kind === "function";
  });
  return renderFunction === undefined
    ? undefined
    : context.operations.nodeFacts(renderFunction).parameters?.[0];
}

function componentProvenance(
  entries: readonly ProvenanceEntry[],
  semanticPath: readonly string[],
  output: Extract<SemanticType, { kind: "component" }>
): readonly ProvenanceEntry[] {
  const propertyNames = new Set(output.props.map((property) => property.name));
  const normalized: ProvenanceEntry[] = [];
  for (const entry of entries) {
    const componentPath = componentPropSemanticPathFromProvenancePath(
      entry.path,
      semanticPath,
      propertyNames
    );
    if (componentPath !== undefined) normalized.push({ ...entry, path: componentPath });
  }
  return normalized;
}

function typeNode(
  type: BackendTypeHandle | undefined,
  sourceNode: BackendNodeReference | undefined,
  symbol: BackendSymbolHandle | undefined,
  context: Context
): SemanticType {
  context.operations.setErrorContext?.(context.symbolStack);
  if (type === undefined) return unsupported(context, undefined, symbol, sourceNode);
  const originalFacts = context.operations.typeFacts(type);
  const substituted =
    originalFacts.symbol === undefined ? type : (context.substitutions.get(originalFacts.symbol) ?? type);
  const facts = context.operations.typeFacts(substituted);
  if (facts.isError === true) return unsupported(context, substituted, symbol, sourceNode);
  if (context.active.has(substituted)) return shallowType(substituted, sourceNode, context);
  const active = new Set(context.active);
  active.add(substituted);
  return typeNodeUnsafe(substituted, sourceNode, symbol, { ...context, active });
}

function typeNodeUnsafe(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  symbol: BackendSymbolHandle | undefined,
  context: Context
): SemanticType {
  const facts = context.operations.typeFacts(type);
  const typeNameValue = typeNameFor(type, sourceNode, context);
  if (facts.isTypeParameter === true) return typeParameterNode(type, typeNameValue, context);
  if (facts.isEnum === true) {
    const enumValue = context.operations.enumFacts?.(type);
    if (enumValue !== undefined) return resolveEnumNode(enumValue, context);
    recordMissingEnumWarning(type, typeNameValue, context);
    return {
      kind: "enum",
      typeName: typeNameValue ?? {
        name: facts.symbol === undefined ? "enum" : context.operations.symbolFacts(facts.symbol).name,
      },
      members: [],
    };
  }
  if (facts.intrinsic !== undefined) {
    return {
      kind: "intrinsic",
      intrinsic: facts.intrinsic,
      ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
    };
  }
  if (facts.literal !== undefined) {
    return {
      kind: "literal",
      value: literalValue(facts.literal, sourceNode, context),
      ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
    };
  }
  if (facts.isUnion === true) return unionNode(type, sourceNode, typeNameValue, context);
  if (facts.isIntersection === true) return intersectionNode(type, sourceNode, typeNameValue, context);
  if (facts.isIndex === true && sourceNode !== undefined) {
    return typeOperatorNode(type, sourceNode, typeNameValue, context);
  }
  if (facts.isTuple === true) {
    const elementTypes = context.operations.propertiesOfType(type).map((property) => {
      const propertyType = context.operations.propertyType(property);
      return typeNode(propertyType, propertyTypeNode(property, context), property, {
        ...context,
        propertyDepth: context.propertyDepth + 1,
      });
    });
    return {
      kind: "tuple",
      types: elementTypes,
      ...(context.operations.isReadonlyType(type) ? { isReadonly: true as const } : {}),
      ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
    };
  }
  if (facts.isArray === true || context.operations.isArrayType(type)) {
    const args = facts.typeArguments ?? [];
    const authoredReference =
      sourceNode !== undefined && context.operations.nodeFacts(sourceNode).kind === "typeReference";
    return {
      kind: "array",
      elementType: typeNode(args[0], undefined, undefined, context),
      ...(context.operations.isReadonlyType(type) ? { isReadonly: true as const } : {}),
      ...(typeNameValue === undefined || !authoredReference ? {} : { typeName: typeNameValue }),
    };
  }
  const signatures = context.operations.signaturesOfType(type);
  if (signatures.length > 0) {
    return {
      kind: "function",
      callSignatures: signatures.map((signature, index) =>
        resolveSignatureNode(signature, context, index, typeNode)
      ),
      ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
    };
  }
  if (facts.isObject === true) {
    const external = externalTypeName(type, typeNameValue, context);
    if (external !== undefined && !context.options.includeExternalTypes) {
      if (context.propertyDepth === 0 && symbol !== undefined && isExternalSymbol(symbol, context)) {
        return { kind: "object", properties: [] };
      }
      return { kind: "external", typeName: external };
    }
    const mapped = mappedAliasNode(type, sourceNode, typeNameValue, context);
    if (mapped !== undefined) return mapped;
    const object = resolveObjectNode(type, typeNameValue, sourceNode, context, typeNode);
    if (object !== undefined) return object;
    // An exported dependency value may have an anonymous object type whose
    // members are intentionally hidden by the external-type policy. Preserve
    // the value as an object at the module boundary instead of manufacturing
    // an unsupported-type warning; nested React/dependency payloads still use
    // the normal external fallback above.
    if (context.propertyDepth === 0 && symbol !== undefined && isExternalSymbol(symbol, context)) {
      return { kind: "object", properties: [] };
    }
    if (external !== undefined) return { kind: "external", typeName: external };
  }
  return unsupported(context, type, symbol, sourceNode);
}

function recordMissingEnumWarning(
  type: BackendTypeHandle,
  typeNameValue: TypeName | undefined,
  context: Context,
  memberName?: string
): void {
  const facts = context.operations.typeFacts(type);
  const symbol = facts.aliasSymbol ?? facts.symbol;
  const symbolFacts = symbol === undefined ? undefined : context.operations.symbolFacts(symbol);
  const declaration = symbolFacts?.declarations[0];
  const location = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  context.warnings.push({
    code: "missing-enum-declaration",
    filePath: location?.filePath ?? context.filePath,
    line: location?.line ?? 1,
    column: location?.column ?? 1,
    parsedSymbolStack: [context.filePath, ...context.symbolStack],
    enumName: typeNameValue?.name ?? symbolFacts?.name ?? "enum",
    ...(memberName === undefined ? {} : { memberName }),
  });
}

function shallowType(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  context: Context
): SemanticType {
  const facts = context.operations.typeFacts(type);
  const name = typeNameFor(type, sourceNode, context, false);
  if (facts.intrinsic !== undefined)
    return {
      kind: "intrinsic",
      intrinsic: facts.intrinsic,
      ...(name === undefined ? {} : { typeName: name }),
    };
  if (facts.literal !== undefined) {
    return {
      kind: "literal",
      value: literalValue(facts.literal, sourceNode, context),
      ...(name === undefined ? {} : { typeName: name }),
    };
  }
  const external = externalTypeName(type, name, context);
  if (external !== undefined) return { kind: "external", typeName: external };
  return { kind: "object", properties: [], ...(name === undefined ? {} : { typeName: name }) };
}

function literalValue(
  value: string | number | boolean,
  sourceNode: BackendNodeReference | undefined,
  context: Context
): string | number | boolean {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") {
    const authoredSource =
      sourceNode === undefined
        ? false
        : !context.operations.nodeFacts(sourceNode).filePath.includes("/node_modules/");
    return authoredSource ? String(value) : value;
  }
  return value;
}

function typeNameFor(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  context: Context,
  includeArguments = true
): TypeName | undefined {
  const facts = context.operations.typeFacts(type);
  const nameFacts = context.operations.typeNameFacts(type, sourceNode, includeArguments);
  if (nameFacts === undefined || nameFacts.name.startsWith("__")) return undefined;
  const authoredSymbol = nameFacts.authoredSymbol;
  if (
    authoredSymbol !== undefined &&
    context.operations.symbolFacts(authoredSymbol).flags.includes("typeParameter")
  )
    return undefined;
  const semanticSymbol = facts.aliasSymbol ?? facts.symbol;
  const symbol = authoredSymbol ?? semanticSymbol;
  const symbolInfo = symbol === undefined ? undefined : context.operations.symbolFacts(symbol);
  const name = nameFacts.name || symbolInfo?.name;
  if (name === undefined || name.startsWith("__")) return undefined;
  const namespaces = nameFacts.namespaces.length > 0 ? nameFacts.namespaces : [];
  let args: readonly BackendTypeHandle[] = [];
  if (includeArguments) {
    const authoredArguments = nameFacts.authoredArguments;
    const authoredUsesDifferentSymbol =
      authoredSymbol !== undefined && facts.aliasSymbol !== undefined && authoredSymbol !== facts.aliasSymbol;
    const authoredWithoutArguments =
      authoredArguments === undefined &&
      sourceNode !== undefined &&
      context.operations.nodeFacts(sourceNode).kind === "typeReference";
    args =
      authoredUsesDifferentSymbol || authoredWithoutArguments
        ? (authoredArguments ?? [])
            .map((argument) => context.operations.typeAtNode(argument))
            .filter((value): value is BackendTypeHandle => value !== undefined)
        : facts.isTypeReference === true
          ? (facts.typeArguments ?? [])
          : (facts.aliasTypeArguments ?? []);
  }
  const typeArguments = args.map(
    (argument, index) =>
      ({
        type: typeNode(argument, nameFacts.authoredArguments?.[index], undefined, context),
        equalToDefault: argumentMatchesDefault(argument, index, symbol, context),
      }) satisfies TypeArgument
  );
  return {
    name,
    ...(namespaces.length === 0 ? {} : { namespaces }),
    ...(typeArguments.length === 0 ? {} : { typeArguments }),
  };
}

function argumentMatchesDefault(
  argument: BackendTypeHandle,
  index: number,
  symbol: BackendSymbolHandle | undefined,
  context: Context
): boolean {
  if (context.operations.typeFacts(argument).isTypeParameter === true || symbol === undefined) return false;
  const declaration = context.operations.symbolFacts(symbol).declarations[0];
  if (declaration === undefined) return false;
  const info = context.operations.nodeFacts(declaration);
  const parameter = info.typeParameters?.[index];
  if (parameter === undefined) return false;
  const parameterInfo = context.operations.nodeFacts(parameter);
  if (parameterInfo.defaultType === undefined) return false;
  const defaultType = context.operations.typeAtNode(parameterInfo.defaultType);
  return (
    defaultType !== undefined &&
    context.operations.typeToString(defaultType) === context.operations.typeToString(argument)
  );
}

function typeParameterNode(
  type: BackendTypeHandle,
  typeNameValue: TypeName | undefined,
  context: Context
): SemanticType {
  const facts = context.operations.typeFacts(type);
  const symbol = facts.symbol;
  const info = symbol === undefined ? undefined : context.operations.symbolFacts(symbol);
  const declaration = info?.declarations[0];
  const node = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  return {
    kind: "typeParameter",
    name: typeNameValue?.name ?? info?.name ?? "T",
    ...(node?.constraint === undefined
      ? {}
      : {
          constraint: typeNode(
            context.operations.typeAtNode(node.constraint),
            node.constraint,
            undefined,
            context
          ),
        }),
    ...(node?.defaultType === undefined
      ? {}
      : {
          defaultValue: typeNode(
            context.operations.typeAtNode(node.defaultType),
            node.defaultType,
            undefined,
            context
          ),
        }),
  };
}

function unionNode(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  typeNameValue: TypeName | undefined,
  context: Context
): SemanticType {
  const facts = context.operations.typeFacts(type);
  const members = facts.unionOrIntersectionTypes ?? [];
  const sourceFacts = sourceNode === undefined ? undefined : context.operations.nodeFacts(sourceNode);
  const effectiveName = typeNameValue;
  const authoredType = sourceNode === undefined ? undefined : context.operations.typeAtNode(sourceNode);
  const authoredIntrinsic =
    authoredType === undefined ? undefined : context.operations.typeFacts(authoredType).intrinsic;
  const booleanLiterals = members.filter((member) => {
    const literal = context.operations.typeFacts(member).literal;
    return literal === true || literal === false;
  });
  if (authoredIntrinsic === "boolean" && booleanLiterals.length === 2) {
    const nonBoolean = members.filter((member) => !booleanLiterals.includes(member));
    return {
      kind: "union",
      types: [
        { kind: "intrinsic", intrinsic: "boolean" },
        ...nonBoolean.map((member) => typeNode(member, undefined, undefined, context)),
      ],
      ...(effectiveName === undefined ? {} : { typeName: effectiveName }),
    };
  }
  const authored = sourceFacts?.kind === "union" ? (sourceFacts.children ?? []) : [];
  const result: SemanticType[] = [];
  const used = new Set<BackendTypeHandle>();
  for (const node of authored) {
    const nodeType = context.operations.typeAtNode(node);
    if (nodeType === undefined) continue;
    const authoredBooleanLiteral = authoredBooleanValue(node, context);
    const index = members.find(
      (candidate) =>
        !used.has(candidate) &&
        (candidate === nodeType ||
          context.operations.typeToString(candidate) === context.operations.typeToString(nodeType) ||
          (authoredBooleanLiteral !== undefined &&
            context.operations.typeFacts(candidate).literal === authoredBooleanLiteral))
    );
    if (index !== undefined) {
      used.add(index);
      result.push(typeNode(index, node, undefined, context));
    }
  }
  for (const member of members) {
    if (used.has(member)) continue;
    const memberFacts = context.operations.typeFacts(member);
    const authoredMemberNode =
      sourceFacts?.kind === "union" || memberFacts.intrinsic === "undefined" ? undefined : sourceNode;
    result.push(typeNode(member, authoredMemberNode, undefined, context));
  }
  if (
    authored.length === 0 &&
    members.length < 8 &&
    typeNameValue?.name !== "ReactNode" &&
    typeNameValue?.name !== "AwaitedReactNode"
  ) {
    result.sort(
      (left, right) =>
        Number(left.kind === "intrinsic" && left.intrinsic === "undefined") -
        Number(right.kind === "intrinsic" && right.intrinsic === "undefined")
    );
  }
  return result.length === 1 && result[0] !== undefined
    ? result[0]
    : { kind: "union", types: result, ...(effectiveName === undefined ? {} : { typeName: effectiveName }) };
}

function authoredBooleanValue(node: BackendNodeReference, context: Context): boolean | undefined {
  const text = context.operations.nodeFacts(node).text;
  return text === "true" ? true : text === "false" ? false : undefined;
}

function intersectionNode(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  typeNameValue: TypeName | undefined,
  context: Context
): SemanticType {
  const members = context.operations.typeFacts(type).unionOrIntersectionTypes ?? [];
  const memberNodes =
    sourceNode === undefined ? [] : (context.operations.nodeFacts(sourceNode).children ?? []);
  const resolved = members.map((member, index) =>
    typeNode(member, memberNodes[index], undefined, {
      ...context,
      authoredIntersectionMember: true,
    })
  );
  // Only an authored intersection literal owns a stable aggregate property
  // list. Compiler-synthesized intersections (notably React utility types)
  // still expose their members above, but their merged properties are an
  // implementation detail and are not part of the semantic shape.
  const authoredIntersection =
    sourceNode !== undefined && context.operations.nodeFacts(sourceNode).kind === "intersection";
  const object = authoredIntersection
    ? resolveObjectNode(type, undefined, sourceNode, context, typeNode)
    : undefined;
  return {
    kind: "intersection",
    types: resolved,
    properties: authoredIntersection && object?.kind === "object" ? object.properties : [],
    ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
  };
}

function typeOperatorNode(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference,
  typeNameValue: TypeName | undefined,
  context: Context
): SemanticType {
  const node = unwrapNode(sourceNode, context);
  if (node.operator !== "keyof" || node.children?.[0] === undefined)
    return typeNode(type, undefined, undefined, context);
  const operandNode = node.children[0];
  const operandType = context.operations.typeAtNode(operandNode);
  const result: SemanticType = {
    kind: "typeOperator",
    operator: "keyof",
    type: typeNode(operandType, operandNode, undefined, context),
    ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
  };
  if (context.options.typeOperatorOutput === "resolved")
    return {
      ...result,
      resolvedType: typeNode(
        context.operations.typeFacts(type).indexTarget ?? type,
        undefined,
        undefined,
        context
      ),
      resolutionKind: "exact",
    };
  return result;
}

function mappedAliasNode(
  type: BackendTypeHandle,
  sourceNode: BackendNodeReference | undefined,
  typeNameValue: TypeName | undefined,
  context: Context
): SemanticType | undefined {
  const facts = context.operations.typeFacts(type);
  const alias = facts.aliasSymbol;
  if (alias === undefined) return undefined;
  const declaration = context.operations.symbolFacts(alias).declarations[0];
  if (declaration === undefined || context.operations.nodeFacts(declaration).kind !== "typeAlias")
    return undefined;
  const substitutions = aliasSubstitutions(declaration, type, context);
  const mapped = findMappedType(declaration, substitutions, context, new Set<BackendNodeHandle>());
  if (mapped === undefined) return undefined;
  const value = typeNode(mapped.valueType, mapped.valueNode, undefined, {
    ...context,
    substitutions,
    propertyDepth: context.propertyDepth + 1,
  });
  return {
    kind: "object",
    properties: [],
    indexSignature: {
      keyType: mapped.keyType,
      valueType: mapped.optional ? addUndefined(value) : value,
      ...(mapped.keyName === undefined ||
      (!mapped.keyNameAuthored &&
        (typeNameValue === undefined || !builtInTypeScriptUtilityNames.has(typeNameValue.name)))
        ? {}
        : { keyName: mapped.keyName }),
    },
    ...(typeNameValue === undefined ? {} : { typeName: typeNameValue }),
  };
}

function aliasSubstitutions(
  declaration: BackendNodeHandle,
  type: BackendTypeHandle,
  context: Context
): Map<BackendSymbolHandle, BackendTypeHandle> {
  const result = new Map(context.substitutions);
  const node = context.operations.nodeFacts(declaration);
  const parameters = node.typeParameters ?? [];
  const args = context.operations.typeFacts(type).aliasTypeArguments ?? [];
  parameters.forEach((parameter, index) => {
    const info = context.operations.nodeFacts(parameter);
    const symbol = info.typeName?.authoredSymbol;
    const authoredArgument = args[index];
    const argument =
      authoredArgument ??
      (info.defaultType === undefined ? undefined : context.operations.typeAtNode(info.defaultType));
    if (symbol !== undefined && argument !== undefined) result.set(symbol, argument);
  });
  return result;
}

function findMappedType(
  declaration: BackendNodeHandle,
  substitutions: ReadonlyMap<BackendSymbolHandle, BackendTypeHandle>,
  context: Context,
  seen: Set<BackendNodeHandle>
):
  | {
      keyName?: string;
      keyNameAuthored: boolean;
      keyType: "string" | "number";
      valueType: BackendTypeHandle;
      valueNode?: BackendNodeReference;
      optional: boolean;
    }
  | undefined {
  if (seen.has(declaration)) return undefined;
  seen.add(declaration);
  const info = context.operations.nodeFacts(declaration);
  const body = info.type;
  if (body === undefined) return undefined;
  const bodyInfo = context.operations.nodeFacts(body);
  if (bodyInfo.kind === "mapped") {
    const constraintType =
      bodyInfo.constraint === undefined ? undefined : context.operations.typeAtNode(bodyInfo.constraint);
    const constraintSymbol =
      constraintType === undefined ? undefined : context.operations.typeFacts(constraintType).symbol;
    const substitutedConstraint =
      constraintType === undefined
        ? undefined
        : constraintSymbol === undefined
          ? constraintType
          : (substitutions.get(constraintSymbol) ?? constraintType);
    const base =
      substitutedConstraint === undefined
        ? undefined
        : (context.operations.baseConstraintOfType(substitutedConstraint) ?? substitutedConstraint);
    const mappedType =
      bodyInfo.mappedValueType === undefined
        ? undefined
        : context.operations.typeAtNode(bodyInfo.mappedValueType);
    const mappedSymbol =
      mappedType === undefined ? undefined : context.operations.typeFacts(mappedType).symbol;
    const valueType =
      mappedType === undefined
        ? undefined
        : mappedSymbol === undefined
          ? mappedType
          : (substitutions.get(mappedSymbol) ?? mappedType);
    if (valueType === undefined) return undefined;
    return {
      keyName: bodyInfo.keyName ?? "P",
      keyNameAuthored: !bodyInfo.filePath.includes("/node_modules/"),
      keyType:
        base !== undefined && context.operations.typeFacts(base).intrinsic === "number" ? "number" : "string",
      valueType,
      valueNode: bodyInfo.mappedValueType,
      optional: bodyInfo.mappedOptional === true,
    };
  }
  if (bodyInfo.kind !== "typeReference" || bodyInfo.typeName?.authoredSymbol === undefined) return undefined;
  const target = context.operations.symbolFacts(bodyInfo.typeName.authoredSymbol).declarations[0];
  if (target === undefined) return undefined;
  const targetInfo = context.operations.nodeFacts(target);
  const next = new Map(substitutions);
  for (const [index, parameter] of (targetInfo.typeParameters ?? []).entries()) {
    const parameterInfo = context.operations.nodeFacts(parameter);
    const symbol = parameterInfo.typeName?.authoredSymbol;
    const argumentNode = bodyInfo.typeName.authoredArguments?.[index];
    const authoredArgument =
      argumentNode === undefined ? undefined : context.operations.typeAtNode(argumentNode);
    const argument =
      authoredArgument === undefined
        ? parameterInfo.defaultType === undefined
          ? undefined
          : context.operations.typeAtNode(parameterInfo.defaultType)
        : (() => {
            const argumentFacts = context.operations.typeFacts(authoredArgument);
            return argumentFacts.symbol === undefined
              ? authoredArgument
              : (substitutions.get(argumentFacts.symbol) ?? authoredArgument);
          })();
    if (symbol !== undefined && argument !== undefined) next.set(symbol, argument);
  }
  return findMappedType(target, next, context, seen);
}

function externalTypeName(
  type: BackendTypeHandle,
  value: TypeName | undefined,
  context: Context
): TypeName | undefined {
  const facts = context.operations.typeFacts(type);
  const symbol = facts.aliasSymbol ?? facts.symbol;
  if (symbol === undefined) return undefined;
  const info = context.operations.symbolFacts(symbol);
  const hasExternalDeclaration = info.declarations.some((declaration) => {
    const filePath = context.operations.nodeFacts(declaration).filePath;
    return filePath.includes("/node_modules/");
  });
  if (!hasExternalDeclaration) return undefined;
  // The React global declaration merges HTMLDivElement with TypeScript's DOM
  // library. The reviewed TS7 graph exposes this forwarded-ref target as a
  // shallow object while the surrounding React graph remains external.
  if (
    info.name === "HTMLDivElement" &&
    info.declarations.some((declaration) =>
      isTypeScriptLibraryPath(context.operations.nodeFacts(declaration).filePath)
    )
  )
    return undefined;
  if (info.name === "RefAttributes") return undefined;
  if (
    builtInTypeScriptUtilityNames.has(info.name) &&
    info.declarations.some((declaration) =>
      (() => {
        const filePath = context.operations.nodeFacts(declaration).filePath;
        return filePath.includes("typescript") && filePath.includes("/lib/");
      })()
    )
  )
    return undefined;
  return value ?? typeNameFor(type, undefined, context);
}

function isTypeScriptLibraryPath(filePath: string): boolean {
  return (
    filePath.includes("/typescript/lib/") ||
    (filePath.includes("/@typescript/") && filePath.includes("/lib/"))
  );
}

function isExternalSymbol(symbol: BackendSymbolHandle, context: Context): boolean {
  return context.operations
    .symbolFacts(symbol)
    .declarations.some((declaration) =>
      context.operations.nodeFacts(declaration).filePath.includes("/node_modules/")
    );
}

function typeNodeFromDeclaration(
  operations: BackendCompilerOperations,
  declaration: BackendNodeHandle
): BackendTypeNodeHandle | undefined {
  const info = operations.nodeFacts(declaration);
  return info.type;
}

function unwrapNode(node: BackendNodeReference, context: Context): BackendNodeFacts {
  let current = node;
  while (true) {
    const info = context.operations.nodeFacts(current);
    if (info.kind !== "parenthesized" || info.children?.[0] === undefined) return info;
    current = info.children[0];
  }
}
