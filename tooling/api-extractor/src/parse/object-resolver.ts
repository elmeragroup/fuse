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
} from "../model.ts";
import { defaultExtractorOptions } from "../options.ts";
import type { ProvenanceEntry } from "../provenance.ts";
import type { OmittedIndexSignatureReason } from "../warnings.ts";
import type { ResolveSemanticType, ResolverContext } from "./contracts.ts";
import { isInternalSymbolName } from "./contracts.ts";
import { isExternalSymbol } from "./ownership.ts";
import { ResolverFailure } from "./resolver-error.ts";
import {
  callSignatureSemanticPath,
  componentPropSemanticPath,
  indexSignatureKeySemanticPath,
  enumMemberSemanticPath,
  objectPropertySemanticPath,
  parameterSemanticPath,
  returnValueSemanticPath,
} from "./semantic-paths.ts";
import type { SemanticPath } from "./semantic-paths.ts";
import { signatureTypeParameter } from "./type-parameter.ts";

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
  const parameters = facts.parameters.map((parameter) =>
    resolveParameter(parameter, signaturePath, context, resolveType, facts.declaration)
  );
  const result: CallSignatureNode = {
    parameters,
    returnValueType: resolveType(facts.returnType, returnTypeNode(facts.declaration, context), undefined, {
      ...context,
      provenancePath: returnValueSemanticPath(signaturePath),
    }),
  };
  if (facts.typeParameters.length > 0)
    Object.assign(result, {
      typeParameters: facts.typeParameters.map((parameter, index) =>
        signatureTypeParameter(parameter, context, resolveType, facts.declaration, index)
      ),
    });
  return result;
}

/**
 * Resolves one signature parameter: its type against authored syntax, its
 * documentation, optionality, and default value. Shared by call and construct
 * signatures so free functions, methods, and constructors cannot drift.
 */
export function resolveParameter(
  parameter: BackendSymbolHandle,
  signaturePath: SemanticPath,
  context: Context,
  resolveType: ResolveSemanticType,
  ownerDeclaration?: BackendNodeHandle
): ParameterNode {
  const info = context.operations.symbolFacts(parameter);
  const declaration = info.valueDeclaration ?? info.declarations[0];
  const node = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  const parameterType =
    context.operations.propertyType(parameter) ?? context.operations.typeOfSymbol(parameter, false);
  // A generic signature's authored parameter node names the DECLARATION's type
  // parameter (`props: P`), not the instantiated argument. Replaying that node
  // would name and shape the resolved type after a parameter of the declaring
  // interface, so it is dropped like any other unreplayable syntax.
  // A parameter's authored type node is read from its owning declaration
  // exactly as a property's is — the shared reader IS the parameter case.
  const authoredSourceNode = omitTypeParameterSourceNode(propertyTypeNode(parameter, context), context);
  const authoredDefaultValue = node?.initializerText;
  const defaultValue = parameterDefaultValue(node, context);
  const parameterPath = parameterSemanticPath(signaturePath, info.name);
  const bindingDefaults = normalizedBindingDefaults(node);
  const output: ParameterNode = {
    name: info.name,
    type: resolveType(parameterType, authoredSourceNode, parameter, {
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
  // Parameter documentation comes only from scoped authored sources: the
  // owning declaration's `@param` entry, or a JSDoc block written directly on
  // the parameter. The checker's aggregate would leak another overload's
  // summary across signatures that share a parameter name.
  const docs = context.operations.documentationOfParameter?.(parameter, ownerDeclaration);
  if (docs !== undefined) Object.assign(output, { documentation: docs });
  if (defaultValue !== undefined) Object.assign(output, { defaultValue });
  return output;
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
  const hasLocalCandidate = properties.some(
    (property) =>
      context.operations.symbolFacts(property).declarations.length === 0 ||
      !isExternalSymbol(property, context)
  );
  const indexSignature = selectIndexSignature(type, context);
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
  // Each predicate records a different reason an anonymous object has no
  // anchor in the model. The compiler-internal predicate adds to the module
  // value one only while resolving a member of an authored intersection:
  // `authoredIntersectionMember` suppresses that one, and otherwise the first
  // predicate's every condition is implied by it.
  const isAnonymousCompilerObject =
    typeNameValue === undefined &&
    context.propertyDepth === 0 &&
    objectSymbol !== undefined &&
    isInternalSymbolName(objectSymbol.name) &&
    !isReadonlyObject &&
    !hasLocalCandidate &&
    !hasAuthoredObjectSyntax;
  const isAnonymousModuleValue =
    typeNameValue === undefined &&
    // Only the export's OWN value declines here (`export const value = { … }`).
    // An unnamed object in a nested position — an inferred function return, for
    // example — is ordinary structure to describe, not a module value, and
    // upstream resolves such shapes (`namespace-export-resolution`'s useHook).
    context.provenancePath.length === 1 &&
    context.propertyDepth === 0 &&
    !hasAuthoredObjectSyntax &&
    !context.authoredIntersectionMember;
  const isEmptyUnanchored =
    properties.length === 0 &&
    indexSignature === undefined &&
    typeNameValue === undefined &&
    !hasLocalCandidate &&
    !hasAuthoredObjectSyntax;
  if (isAnonymousCompilerObject || isAnonymousModuleValue || isEmptyUnanchored) {
    // The callback order is observable, but an anonymous compiler object still
    // has no stable semantic shape to return. Preserve callback failures while
    // avoiding a shallow object node for the default depth/count fallback.
    if (shouldResolve !== false) {
      for (const property of properties) includeProperty(property, type, context);
    }
    return undefined;
  }
  recordUnrepresentedConstructSignatures(type, context);
  if (shouldResolve === false) {
    const result = {
      kind: "object" as const,
      properties: [],
    };
    if (typeNameValue !== undefined) Object.assign(result, { typeName: typeNameValue });
    if (indexSignature !== undefined)
      Object.assign(result, {
        indexSignature: indexSignatureNode(indexSignature, type, context, resolveType),
      });
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
    Object.assign(result, {
      indexSignature: indexSignatureNode(indexSignature, type, context, resolveType),
    });
  return result;
}

/**
 * Drops an authored type node that only names a type parameter of the
 * declaring signature — but only where the anonymous-shape policy would
 * otherwise read that nameless anchor as an unresolvable module value (the
 * export root). The node describes the declaration's own parameter, not the
 * instantiated argument the checker resolved, so replaying it there would
 * leave a callable's parameter shape undescribed. Nested positions keep the
 * node: their resolution is anchored by the enclosing member either way.
 */
export function omitTypeParameterSourceNode(
  sourceNode: BackendNodeReference | undefined,
  context: Context
): BackendNodeReference | undefined {
  if (sourceNode === undefined) return undefined;
  if (context.propertyDepth !== 0) return sourceNode;
  const authoredSymbol = context.operations.nodeFacts(sourceNode).typeName?.authoredSymbol;
  if (authoredSymbol === undefined) return sourceNode;
  if (!context.operations.symbolFacts(authoredSymbol).flags.includes("typeParameter")) return sourceNode;
  return context.substitutions.has(authoredSymbol) ? sourceNode : undefined;
}

export function declarationPathsFor(info: {
  readonly declarationPaths: readonly string[];
  readonly repositoryRelativeDeclarationPaths?: readonly string[];
}): readonly string[] {
  return info.repositoryRelativeDeclarationPaths ?? info.declarationPaths;
}

/**
 * Keep one deterministic sidecar entry for each structural semantic path.
 *
 * Known collision, deliberately kept: the path grammar addresses a member by
 * name alone, so same-named static and instance members of one class produce
 * the same path and their entries merge here. The merged entry unions their
 * declaration paths instead of keeping the two origins distinguishable — do not
 * add a static/instance discriminator to the grammar without a reviewed change.
 */
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
  const reexportChain = existing.reexportChain ?? entry.reexportChain;
  if (reexportChain !== undefined) Object.assign(merged, { reexportChain });
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
    // A mapped type synthesizes one member per constraint key and other
    // compiler views can contribute members with no declaration either; they
    // belong to their owner's local shape rather than being filtered here.
    const ownerFacts = context.operations.typeFacts(ownerType);
    const ownerSymbol = ownerFacts.aliasSymbol ?? ownerFacts.symbol;
    return ownerSymbol === undefined || !isExternalSymbol(ownerSymbol, context);
  }
  // A class instance reached as an object must not contribute its methods:
  // they belong to the class model, not to an object's property list. Upstream
  // whitelists the declaration kinds an object property may be written as
  // (`objectTypeResolver.ts`), which excludes plain method declarations and
  // leaves method *signatures* (interfaces) in place.
  const primaryDeclaration = info.valueDeclaration ?? declarations[0];
  if (
    primaryDeclaration !== undefined &&
    !objectMemberDeclarationKinds.has(context.operations.nodeFacts(primaryDeclaration).kind)
  )
    return false;
  if (
    declarations.some((declaration) =>
      context.operations.nodeFacts(declaration).declarationFlags?.includes("static")
    )
  )
    return false;
  if (
    declarations.some((declaration) =>
      context.operations
        .nodeFacts(declaration)
        .declarationFlags?.some((flag) => flag === "private" || flag === "protected")
    )
  )
    return false;
  return !isExternalSymbol(property, context) || context.options.includeExternalTypes;
}

/** Declaration kinds an object-typed shape may report its members from. */
const objectMemberDeclarationKinds = new Set<BackendNodeFacts["kind"]>([
  "property",
  "methodSignature",
  "parameter",
  "getAccessor",
  "setAccessor",
]);

/**
 * Chooses the one index signature the semantic model can carry and records
 * every signature it cannot.
 *
 * The model has a single `indexSignature` slot with a `string` or `number` key,
 * matching upstream. A type may legitimately declare more — a `symbol` key, a
 * template-literal pattern key, or both a string and a number key — and those
 * are recoverable omissions, so each one is reported as a structured warning
 * rather than disappearing from the output.
 */
function selectIndexSignature(
  type: BackendTypeHandle,
  context: Context
): BackendIndexSignatureFacts | undefined {
  const all = context.operations.indexSignaturesOfType(type);
  const selected =
    all.find((candidate) => candidate.keyType === "string") ??
    all.find((candidate) => candidate.keyType === "number");
  const omitted = all.filter((candidate) => candidate !== selected);
  // The two omissions have different causes and different remedies, so they are
  // reported apart: a `symbol` or pattern key has no encoding in the model at
  // all, while a `number` key alongside a `string` key is perfectly
  // representable and lost only because the model carries one signature.
  recordOmittedIndexSignatures(
    omitted.filter((candidate) => candidate.keyType === "string" || candidate.keyType === "number"),
    "additional-signature",
    context
  );
  recordOmittedIndexSignatures(
    omitted.filter((candidate) => candidate.keyType !== "string" && candidate.keyType !== "number"),
    "unrepresentable-key",
    context
  );
  return selected;
}

function recordOmittedIndexSignatures(
  omitted: readonly BackendIndexSignatureFacts[],
  reason: OmittedIndexSignatureReason,
  context: Context
): void {
  if (omitted.length === 0) return;
  const declaration = omitted.find((candidate) => candidate.declaration !== undefined)?.declaration;
  const location = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  context.warnings.push({
    code: "omitted-index-signature",
    filePath: location?.filePath ?? context.filePath,
    line: location?.line ?? 1,
    column: location?.column ?? 1,
    parsedSymbolStack: [context.filePath, ...context.symbolStack],
    reason,
    keyTypes: omitted.map((candidate) => candidate.keyType),
  });
}

/**
 * Reports construct signatures a shape carries but the model cannot.
 *
 * Only a class becomes a class node; an interface or object literal type that
 * merely declares `new (…)` is reported as a bare object, exactly as upstream
 * does. The same loss hits callable-first shapes: a function node carries only
 * call signatures, so construct signatures declared beside them vanish. The
 * signatures themselves are recoverable information, so each omission is a
 * structured warning addressed at the `constructSignatures` slot of the
 * current structural path instead of a silent loss.
 */
export function recordUnrepresentedConstructSignatures(type: BackendTypeHandle, context: Context): void {
  const constructs = context.operations.constructSignaturesOfType?.(type) ?? [];
  const first = constructs.at(0);
  if (first === undefined) return;
  const declaration = context.operations.signatureFacts(first).declaration;
  const location = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  context.warnings.push({
    code: "unrepresented-construct-signatures",
    filePath: location?.filePath ?? context.filePath,
    line: location?.line ?? 1,
    column: location?.column ?? 1,
    parsedSymbolStack: [context.filePath, ...context.symbolStack],
    structuralPath: [...context.provenancePath, "constructSignatures"],
    signatureCount: constructs.length,
  });
}

/**
 * Names the object members of a type that survive eligibility policy.
 *
 * Shared by the callable warning sites: a function node cannot carry members,
 * so the resolver reports which named members a callable shape declared before
 * they are dropped. Inclusion callbacks are deliberately not consulted here —
 * this is about what the model could represent, not what a caller filtered.
 */
export function eligiblePropertyNames(type: BackendTypeHandle, context: Context): readonly string[] {
  return propertiesOfType(context.operations.propertiesOfType(type), type, context).map(
    (property) => context.operations.symbolFacts(property).name
  );
}

/**
 * Reports named members a callable shape declares besides its call signatures.
 *
 * A function node describes only the callable half, and the model gives it no
 * member list — an interface that merges `(…) => T` with properties keeps just
 * its signatures, so the dropped names become a structured warning addressed
 * at the callable's structural path instead of a silent loss. Intersections are
 * exempt: their aggregate property view is a separate resolution decision that
 * the compound resolver owns, and only shapes that anchor a described value
 * (depth zero) report at all.
 */
export function recordOmittedCallableMembers(
  type: BackendTypeHandle,
  signatures: readonly BackendSignatureHandle[],
  context: Context
): void {
  if (context.propertyDepth !== 0 || signatures.length === 0) return;
  if (context.operations.typeFacts(type).isIntersection === true) return;
  const memberNames = eligiblePropertyNames(type, context);
  if (memberNames.length === 0) return;
  const firstSignature = signatures.at(0);
  if (firstSignature === undefined) return;
  const declaration = context.operations.signatureFacts(firstSignature).declaration;
  const location = declaration === undefined ? undefined : context.operations.nodeFacts(declaration);
  context.warnings.push({
    code: "omitted-callable-members",
    filePath: location?.filePath ?? context.filePath,
    line: location?.line ?? 1,
    column: location?.column ?? 1,
    parsedSymbolStack: [context.filePath, ...context.symbolStack],
    structuralPath: [...context.provenancePath],
    memberNames,
  });
}

export function indexSignatureNode(
  index: BackendIndexSignatureFacts,
  owner: BackendTypeHandle | undefined,
  context: Context,
  resolveType: ResolveSemanticType
): IndexSignatureNode {
  recordIndexSignatureKeyProvenance(owner, false, context);
  const result = {
    keyType: index.keyType === "number" ? ("number" as const) : ("string" as const),
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

/**
 * Records where an index signature's key came from. A key declared by an
 * authored index signature is attributed to the declarations of the type that
 * carries it. A key a mapped type synthesized (`synthesized`) is never
 * declared — the mapped type invents one per constraint member — so its entry
 * is attributed to the mapped type's own declarations and marked synthesized.
 * A key with no declaring symbol at all is marked synthesized for the same
 * reason: no declaration of that key exists.
 */
export function recordIndexSignatureKeyProvenance(
  owner: BackendTypeHandle | undefined,
  synthesized: boolean,
  context: Context
): void {
  const facts = owner === undefined ? undefined : context.operations.typeFacts(owner);
  const symbol = facts?.aliasSymbol ?? facts?.symbol;
  const info = symbol === undefined ? undefined : context.operations.symbolFacts(symbol);
  recordProvenance(context, {
    path: indexSignatureKeySemanticPath(context.provenancePath),
    declarationPaths: info === undefined ? [] : declarationPathsFor(info),
    synthesized: synthesized || info === undefined || info.declarations.length === 0,
  });
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

function returnTypeNode(
  declaration: BackendNodeHandle | undefined,
  context: Context
): BackendNodeReference | undefined {
  return declaration === undefined ? undefined : context.operations.nodeFacts(declaration).returnType;
}
