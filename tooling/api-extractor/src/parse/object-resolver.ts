import type {
  BackendEnumFacts,
  BackendIndexSignatureFacts,
  BackendNodeFacts,
  BackendNodeHandle,
  BackendNodeReference,
  BackendSignatureHandle,
  BackendSymbolHandle,
  BackendTypeHandle,
} from "../backend/contracts.ts";
import type {
  CallSignatureNode,
  EnumMember,
  IndexSignatureNode,
  ParameterNode,
  PropertyNode,
  SemanticType,
  TypeName,
  TypeParameterNode,
} from "../model.ts";
import { defaultExtractorOptions } from "../options.ts";
import type { ProvenanceEntry } from "../provenance.ts";
import type { ResolveSemanticType, ResolverContext } from "./contracts.ts";
import { ResolverFailure } from "./resolver-error.ts";
import {
  callSignatureSemanticPath,
  componentPropSemanticPath,
  enumMemberSemanticPath,
  objectPropertySemanticPath,
  parameterSemanticPath,
  returnValueSemanticPath,
} from "./semantic-paths.ts";

type Context = ResolverContext;

export function resolveEnumNode(facts: BackendEnumFacts, context: Context): SemanticType {
  const typeName: TypeName = { name: facts.name };
  if (facts.namespaces.length > 0) Object.assign(typeName, { namespaces: facts.namespaces });
  for (const warning of facts.warnings ?? []) {
    context.warnings.push({
      ...warning,
      parsedSymbolStack: [context.filePath, ...context.symbolStack],
    });
  }
  const exportPath = context.provenancePath;
  for (const member of facts.members) {
    const symbolFacts = context.operations.symbolFacts(member.symbol);
    recordProvenance(context, {
      path: enumMemberSemanticPath(exportPath, member.name),
      declarationPaths: declarationPathsFor(symbolFacts),
      synthesized: symbolFacts.declarations.length === 0,
    });
  }
  const members = facts.members.map((member): EnumMember => {
    const result = { name: member.name, value: member.value };
    if (member.documentation !== undefined) Object.assign(result, { documentation: member.documentation });
    return result;
  });
  const result = {
    kind: "enum" as const,
    typeName,
    members,
  };
  if (facts.documentation !== undefined) Object.assign(result, { documentation: facts.documentation });
  return result;
}

export function resolveSignatureNode(
  signature: BackendSignatureHandle,
  context: Context,
  signatureIndex: number,
  resolveType: ResolveSemanticType
): CallSignatureNode {
  context.operations.setErrorContext?.(context.symbolStack);
  const facts = context.operations.signatureFacts(signature);
  const signaturePath = callSignatureSemanticPath(context.provenancePath, signatureIndex);
  const parameters = facts.parameters.map((parameter) => {
    const info = context.operations.symbolFacts(parameter);
    const declaration = info.valueDeclaration ?? info.declarations[0];
    const node = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
    const parameterType =
      context.operations.propertyType(parameter) ?? context.operations.typeOfSymbol(parameter, false);
    const authoredDefaultValue = node?.initializerText;
    const defaultValue = parameterDefaultValue(node, context);
    const parameterPath = parameterSemanticPath(signaturePath, info.name);
    const bindingDefaults = normalizedBindingDefaults(node);
    const output: ParameterNode = {
      name: info.name,
      type: resolveType(parameterType, parameterTypeNode(parameter, context), parameter, {
        ...context,
        provenancePath: parameterPath,
        bindingDefaults,
        symbolStack: [...context.symbolStack, `parameter: ${info.name}`],
      }),
      optional: info.flags.includes("optional") || node?.optional === true || defaultValue !== undefined,
    };
    const provenance: ProvenanceEntry = {
      path: parameterPath,
      declarationPaths: declarationPathsFor(info),
      synthesized: info.declarations.length === 0,
    };
    if (authoredDefaultValue !== undefined)
      Object.assign(provenance, { defaultInitializer: authoredDefaultValue });
    recordProvenance(context, provenance);
    const docs = context.operations.documentationOfSymbol?.(parameter);
    if (docs !== undefined) Object.assign(output, { documentation: docs });
    if (defaultValue !== undefined) Object.assign(output, { defaultValue });
    return output;
  });
  const result: CallSignatureNode = {
    parameters,
    returnValueType: resolveType(facts.returnType, returnTypeNode(facts.declaration, context), undefined, {
      ...context,
      provenancePath: returnValueSemanticPath(signaturePath),
    }),
  };
  if (facts.typeParameters.length > 0)
    Object.assign(result, {
      typeParameters: facts.typeParameters.map((parameter) =>
        typeParameterContract(parameter, context, resolveType)
      ),
    });
  return result;
}

export function resolveObjectNode(
  type: BackendTypeHandle,
  typeNameValue: TypeName | undefined,
  sourceNode: BackendNodeReference | undefined,
  context: Context,
  resolveType: ResolveSemanticType
): Extract<SemanticType, { kind: "object" }> | undefined {
  const facts = context.operations.typeFacts(type);
  if (facts.isObject !== true) return undefined;
  const candidateProperties = context.operations.propertiesOfType(type);
  // Apply structural/external policy before object resolution is asked for a
  // decision. The inclusion callback is deliberately deferred until after
  // shouldResolveObject so propertyCount describes the eligible shape.
  const properties = propertiesOfType(candidateProperties, type, context);
  const hasLocalCandidate = properties.some((property) => {
    const info = context.operations.symbolFacts(property);
    const declarations = declarationsOf(info);
    return (
      declarations.length === 0 ||
      !declarations.every((declaration) =>
        context.operations.nodeFacts(declaration).filePath.includes("/node_modules/")
      )
    );
  });
  const indexSignature = context.operations.indexSignatureOfType(type);
  const objectSymbol = facts.symbol === undefined ? undefined : context.operations.symbolFacts(facts.symbol);
  const isReadonlyObject =
    properties.length > 0 &&
    properties.every((property) => {
      const info = context.operations.symbolFacts(property);
      const declarations = declarationsOf(info);
      return (
        declarations.length > 0 &&
        declarations.every(
          (declaration) =>
            context.operations.nodeFacts(declaration).declarationFlags?.includes("readonly") === true
        )
      );
    });
  const hasAuthoredObjectSyntax =
    sourceNode !== undefined &&
    (context.operations.nodeFacts(sourceNode).kind === "intersection" ||
      context.operations.nodeFacts(sourceNode).text === "object" ||
      context.operations.nodeFacts(sourceNode).text.startsWith("{"));
  const resolveData = {
    name: typeNameValue?.name ?? "",
    propertyCount: properties.length,
    depth: context.active.size,
    propertyDepth: context.propertyDepth,
  };
  let callbackDecision: boolean | undefined;
  try {
    callbackDecision = context.options.shouldResolveObject?.(resolveData);
  } catch (cause) {
    throw new ResolverFailure(
      `shouldResolveObject failed while resolving ${typeNameValue?.name ?? "an object"}`,
      context.symbolStack,
      cause
    );
  }
  const shouldResolve = callbackDecision ?? defaultObjectResolution(resolveData);
  const unanchoredObject =
    (typeNameValue === undefined &&
      context.propertyDepth === 0 &&
      objectSymbol?.name.startsWith("__") === true &&
      !isReadonlyObject &&
      !hasLocalCandidate &&
      !hasAuthoredObjectSyntax) ||
    (typeNameValue === undefined &&
      context.propertyDepth === 0 &&
      !hasAuthoredObjectSyntax &&
      !context.authoredIntersectionMember) ||
    (properties.length === 0 &&
      indexSignature === undefined &&
      typeNameValue === undefined &&
      !hasLocalCandidate &&
      !hasAuthoredObjectSyntax);
  if (unanchoredObject) {
    // The callback order is observable, but an anonymous compiler object still
    // has no stable semantic shape to return. Preserve callback failures while
    // avoiding a shallow object node for the default depth/count fallback.
    if (shouldResolve !== false) properties.filter((property) => includeProperty(property, type, context));
    return undefined;
  }
  if (shouldResolve === false) {
    const result = {
      kind: "object" as const,
      properties: [],
    };
    if (typeNameValue !== undefined) Object.assign(result, { typeName: typeNameValue });
    if (indexSignature !== undefined)
      Object.assign(result, { indexSignature: indexSignatureNode(indexSignature, context, resolveType) });
    return result;
  }
  // Preserve inclusion callback failures for anonymous authored values while
  // keeping the required resolution-before-inclusion order.
  const includedProperties = properties.filter((property) => includeProperty(property, type, context));
  // Anonymous module-level values have no authored API shape to anchor. Keep
  // the upstream fallback contract for those values; an anonymous object is
  // resolvable when it is explicitly authored in a type node or is nested
  // under another object that is already being described.
  const resolvedProperties = includedProperties.map((property) => {
    const info = context.operations.symbolFacts(property);
    const propertyType =
      context.operations.propertyType(property) ?? context.operations.typeOfSymbol(property, false);
    const docs = context.operations.documentationOfSymbol?.(property);
    const declarationFacts = declarationsOf(info);
    const readonly = declarationFacts.some((declaration) =>
      context.operations.nodeFacts(declaration).declarationFlags?.includes("readonly")
    );
    const declarationInitializer = declarationFacts
      .map((declaration) => context.operations.nodeFacts(declaration).initializerText)
      .find((value): value is string => value !== undefined);
    const initializer =
      declarationInitializer ??
      (context.propertyDepth === 0 ? context.bindingDefaults?.get(info.name) : undefined);
    const propertyPath =
      context.provenancePropertyContainer === "componentProps"
        ? componentPropSemanticPath(context.provenancePath, info.name)
        : objectPropertySemanticPath(context.provenancePath, info.name);
    const provenance: ProvenanceEntry = {
      path: propertyPath,
      declarationPaths: declarationPathsFor(info),
      synthesized: info.declarations.length === 0,
    };
    if (readonly) Object.assign(provenance, { readonly: true });
    if (initializer !== undefined) Object.assign(provenance, { defaultInitializer: initializer });
    recordProvenance(context, provenance);
    const result = {
      name: info.name,
      type: resolveType(propertyType, propertyTypeNode(property, context), property, {
        ...context,
        provenancePath: propertyPath,
        provenancePropertyContainer: "object",
        symbolStack: [...context.symbolStack, `property: ${info.name}`],
        propertyDepth: context.propertyDepth + 1,
      }),
      optional:
        info.flags.includes("optional") ||
        declarationFacts.some((declaration) => context.operations.nodeFacts(declaration).optional === true),
    };
    if (docs !== undefined) Object.assign(result, { documentation: docs });
    return result satisfies PropertyNode;
  });
  const result = {
    kind: "object" as const,
    properties: resolvedProperties,
  };
  if (typeNameValue !== undefined) Object.assign(result, { typeName: typeNameValue });
  if (indexSignature !== undefined)
    Object.assign(result, { indexSignature: indexSignatureNode(indexSignature, context, resolveType) });
  return result;
}

function typeParameterContract(
  type: BackendTypeHandle,
  context: Context,
  resolveType: ResolveSemanticType
): TypeParameterNode {
  const facts = context.operations.typeFacts(type);
  const symbol = facts.symbol;
  const info = symbol === undefined ? undefined : context.operations.symbolFacts(symbol);
  const declaration = info?.declarations[0];
  const node = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  const result = {
    kind: "typeParameter" as const,
    name: info?.name ?? "T",
  };
  if (node?.constraint !== undefined)
    Object.assign(result, {
      constraint: resolveType(
        context.operations.typeAtNode(node.constraint),
        node.constraint,
        undefined,
        context
      ),
    });
  if (node?.defaultType !== undefined)
    Object.assign(result, {
      defaultValue: resolveType(
        context.operations.typeAtNode(node.defaultType),
        node.defaultType,
        undefined,
        context
      ),
    });
  return result;
}

export function declarationPathsFor(info: {
  readonly declarationPaths: readonly string[];
  readonly repositoryRelativeDeclarationPaths?: readonly string[];
}): readonly string[] {
  return info.repositoryRelativeDeclarationPaths ?? info.declarationPaths;
}

/** Keep one deterministic sidecar entry for each structural semantic path. */
export function recordProvenance(context: Context, entry: ProvenanceEntry): void {
  const existing = context.provenance.find((candidate) => samePath(candidate.path, entry.path));
  if (existing === undefined) {
    context.provenance.push(entry);
    return;
  }
  const declarationPaths = [...new Set([...existing.declarationPaths, ...entry.declarationPaths])].sort();
  const merged: ProvenanceEntry = {
    ...existing,
    declarationPaths,
    synthesized: existing.synthesized && entry.synthesized,
  };
  if (existing.readonly === true || entry.readonly === true) Object.assign(merged, { readonly: true });
  const defaultInitializer = existing.defaultInitializer ?? entry.defaultInitializer;
  if (defaultInitializer !== undefined) Object.assign(merged, { defaultInitializer });
  const index = context.provenance.indexOf(existing);
  context.provenance[index] = merged;
}

export function canonicalizeProvenance(entries: readonly ProvenanceEntry[]): readonly ProvenanceEntry[] {
  return [...entries].sort((left, right) => comparePaths(left.path, right.path));
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function comparePaths(left: readonly string[], right: readonly string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = left[index] ?? "";
    const rightSegment = right[index] ?? "";
    const comparison = leftSegment < rightSegment ? -1 : leftSegment > rightSegment ? 1 : 0;
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function declarationsOf(info: {
  readonly declarations: readonly BackendNodeHandle[];
  readonly valueDeclaration?: BackendNodeHandle;
}): readonly BackendNodeHandle[] {
  return [
    ...info.declarations,
    ...(info.valueDeclaration === undefined ? [] : [info.valueDeclaration]),
  ].filter((declaration, index, all) => all.indexOf(declaration) === index);
}

function defaultObjectResolution(data: {
  readonly name: string;
  readonly propertyCount: number;
  readonly depth: number;
  readonly propertyDepth: number;
}): boolean {
  return defaultExtractorOptions.shouldResolveObject(data) ?? true;
}

function propertiesOfType(
  all: readonly BackendSymbolHandle[],
  ownerType: BackendTypeHandle,
  context: Context
): readonly BackendSymbolHandle[] {
  const seen = new Set<string>();
  return all.filter((property) => {
    const info = context.operations.symbolFacts(property);
    if (seen.has(info.name) || !propertyEligible(property, ownerType, context)) return false;
    seen.add(info.name);
    return true;
  });
}

function includeProperty(
  property: BackendSymbolHandle,
  ownerType: BackendTypeHandle,
  context: Context
): boolean {
  if (!propertyEligible(property, ownerType, context)) return false;
  const info = context.operations.symbolFacts(property);
  try {
    return context.options.shouldInclude?.({ name: info.name, depth: context.active.size + 1 }) ?? true;
  } catch (cause) {
    throw new ResolverFailure(
      `shouldInclude failed while resolving property ${info.name}`,
      context.symbolStack,
      cause
    );
  }
}

function propertyEligible(
  property: BackendSymbolHandle,
  ownerType: BackendTypeHandle,
  context: Context
): boolean {
  const info = context.operations.symbolFacts(property);
  if (info.name.startsWith("#")) return false;
  const declarations = declarationsOf(info);
  if (declarations.length === 0) {
    const ownerFacts = context.operations.typeFacts(ownerType);
    const ownerSymbol = ownerFacts.aliasSymbol ?? ownerFacts.symbol;
    const ownerDeclarations =
      ownerSymbol === undefined ? [] : declarationsOf(context.operations.symbolFacts(ownerSymbol));
    if (
      ownerDeclarations.some((declaration) =>
        context.operations.nodeFacts(declaration).filePath.includes("/node_modules/")
      )
    )
      return false;
  }
  if (
    declarations.some((declaration) =>
      context.operations
        .nodeFacts(declaration)
        .declarationFlags?.some((flag) => flag === "private" || flag === "protected")
    )
  )
    return false;
  const isExternal =
    declarations.length > 0 &&
    declarations.every((declaration) =>
      context.operations.nodeFacts(declaration).filePath.includes("/node_modules/")
    );
  return !isExternal || context.options.includeExternalTypes;
}

function indexSignatureNode(
  index: BackendIndexSignatureFacts,
  context: Context,
  resolveType: ResolveSemanticType
): IndexSignatureNode {
  const result = {
    keyType: index.keyType,
    valueType: resolveType(
      index.valueType,
      index.declaration === undefined ? undefined : context.operations.nodeFacts(index.declaration).type,
      undefined,
      { ...context, propertyDepth: context.propertyDepth + 1 }
    ),
  };
  if (index.keyName !== undefined) Object.assign(result, { keyName: index.keyName });
  return result;
}

function parameterDefaultValue(node: BackendNodeFacts | undefined, context: Context): string | undefined {
  if (node?.initializer === undefined) return undefined;
  const initializerType = context.operations.typeAtNode(node.initializer);
  if (initializerType !== undefined) {
    const literal = context.operations.typeFacts(initializerType).literal;
    if (literal !== undefined) return JSON.stringify(literal);
  }
  return node.initializerText;
}

function normalizedBindingDefaults(
  node: BackendNodeFacts | undefined
): ReadonlyMap<string, string> | undefined {
  if (node?.bindingDefaults === undefined || node.bindingDefaults.length === 0) return undefined;
  return new Map(node.bindingDefaults.map((entry) => [entry.name, entry.initializerText]));
}

export function propertyTypeNode(
  property: BackendSymbolHandle,
  context: Context
): BackendNodeReference | undefined {
  const info = context.operations.symbolFacts(property);
  const declaration = info.valueDeclaration ?? info.declarations[0];
  return declaration === undefined ? undefined : context.operations.nodeFacts(declaration).type;
}

function parameterTypeNode(
  parameter: BackendSymbolHandle,
  context: Context
): BackendNodeReference | undefined {
  return propertyTypeNode(parameter, context);
}

function returnTypeNode(
  declaration: BackendNodeHandle | undefined,
  context: Context
): BackendNodeReference | undefined {
  return declaration === undefined ? undefined : context.operations.nodeFacts(declaration).returnType;
}
