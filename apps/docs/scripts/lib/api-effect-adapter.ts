import { Cause, Effect, Exit } from "effect";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { ProjectExtractor } from "@elmeragroup/api-extractor";
import type {
  ExtractionResult,
  ExtractWarning,
  ExtractorOptions,
  IntersectionNode,
  PropertyNode,
  ProvenanceEntry,
  SemanticType,
  TypeName,
  UnionNode,
} from "@elmeragroup/api-extractor";

import type { ApiPart, ApiProp } from "../../src/lib/docs-model.ts";
import { dependencyPackageName } from "../../src/lib/docs-model.ts";
import { normalizePath, normalizeMessage, repoRelativePath } from "./api-shadow-paths.ts";
import type {
  DocsApiComponent,
  DocsShadowComponent,
  ShadowInputCapture,
  ShadowPartEvidence,
  ShadowProblem,
  ShadowPropEvidence,
} from "./api-shadow-types.ts";
import {
  componentPartRequests,
  componentPartSources,
  describeComponentApi,
  inspectCurrentPartEvidence,
  inspectPartForwarded,
  propOrigin,
  shortTypeOf,
} from "./api.ts";
import type { CurrentPartEvidence, PartForwarded, PartSource } from "./api.ts";
import type { LibraryProject } from "./api.ts";
import { inspectComponent, inspectComponentDemos, inspectGlobalDocs } from "./docs-inspection.ts";
import { ProblemLog } from "./errors.ts";
import { repoRoot, uiTsconfig } from "./paths.ts";

export type SideResult = {
  readonly parts: readonly ApiPart[];
  readonly evidence: readonly ShadowPartEvidence[];
  readonly problems: readonly ShadowProblem[];
};

export type SideRun = {
  readonly results: readonly SideResult[];
  readonly inputs: readonly ShadowInputCapture[];
};

type ApiPartMapping = {
  readonly part: ApiPart;
  readonly evidence: ShadowPartEvidence;
};

type PartsExtraction = {
  readonly parts: readonly ApiPart[];
  readonly evidence: readonly ShadowPartEvidence[];
};

type CanonicalComponentFacts = {
  readonly sources: ReadonlyMap<string, PartSource>;
  readonly forwarded: ReadonlyMap<string, PartForwarded>;
};

type SemanticProperty = PropertyNode;

/** The current checker walk reports paths only, so its ownership is read from the path. */
function isLibraryDeclaration(value: string): boolean {
  return normalizePath(value).toLowerCase().includes("packages/ui/src/");
}

/** The Effect extractor reports each declaration's owner beside its path. */
function isLibraryOwned(provenance: ProvenanceEntry): boolean {
  return provenance.declarations.some((declaration) => declaration.owner?.kind === "project");
}

/** The declaring files of an entry, in the extractor's sorted order. */
function declarationPathsOf(provenance: ProvenanceEntry | undefined): readonly string[] {
  return provenance?.declarations.map((declaration) => declaration.path) ?? [];
}

/** Distinct dependency packages that declare the entry, sorted. */
function dependencyPackages(provenance: ProvenanceEntry | undefined): readonly string[] {
  const packages = new Set<string>();
  for (const { owner } of provenance?.declarations ?? []) {
    if (owner?.kind === "dependency") packages.add(owner.packageName);
  }
  return [...packages].sort((left, right) => left.localeCompare(right));
}

function adapterProblem(component: string, code: string, message: string): ShadowProblem {
  return { component, source: "docs-adapter", code, message: normalizeMessage(message) };
}

function warningProblem(component: string, warning: ExtractWarning): ShadowProblem {
  return {
    component,
    source: "effect-extractor",
    code: warning.code,
    message: `${normalizeMessage(warning.message)} [${normalizePath(warning.filePath)}:${String(warning.line)}:${String(warning.column)}]`,
  };
}

function currentProblem(component: string, message: string): ShadowProblem {
  return { component, source: "current-docs", code: "docs-problem", message: normalizeMessage(message) };
}

function dedupeDocumentation(documentation: string | undefined): string {
  if (documentation === undefined) return "";
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const paragraph of documentation.split(/\n{2,}|\n/u)) {
    const trimmed = paragraph.trim();
    if (trimmed === "" || seen.has(trimmed)) continue;
    seen.add(trimmed);
    kept.push(trimmed);
  }
  return kept.join(" ");
}

function typeNameText(typeName: TypeName): string {
  return [...(typeName.namespaces ?? []), typeName.name].join(".");
}

function renderNamedType(typeName: TypeName): string {
  const name = typeNameText(typeName);
  if (typeName.typeArguments === undefined || typeName.typeArguments.length === 0) return name;
  return `${name}<${typeName.typeArguments.map((argument) => renderSemanticType(argument.type)).join(", ")}>`;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

/** Normalizes and de-duplicates declaration provenance without changing first-seen order. */
function normalizedUniquePaths(paths: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    const normalized = normalizePath(path);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function renderSemanticType(type: SemanticType, nested = false): string {
  switch (type.kind) {
    case "intrinsic":
      return type.intrinsic;
    case "literal":
      return String(type.value);
    case "external":
      return renderNamedType(type.typeName);
    case "typeParameter":
      return type.name;
    case "typeQuery":
      return type.expressionName;
    case "array": {
      const element = renderSemanticType(type.elementType, true);
      return type.isReadonly === true ? `readonly ${element}[]` : `${element}[]`;
    }
    case "tuple": {
      const rendered = `[${type.types.map((member) => renderSemanticType(member)).join(", ")}]`;
      return type.isReadonly === true ? `readonly ${rendered}` : rendered;
    }
    case "union":
      return renderUnion(type);
    case "intersection":
      return renderIntersection(type);
    case "typeOperator":
      return renderSemanticType(type.resolvedType, nested);
    case "function": {
      const signatures = type.callSignatures.map((signature) => {
        const parameters = signature.parameters
          .map(
            (parameter) =>
              `${parameter.name}${parameter.optional ? "?" : ""}: ${renderSemanticType(parameter.type)}`
          )
          .join(", ");
        return `(${parameters}) => ${renderSemanticType(signature.returnValueType)}`;
      });
      const rendered = signatures.join(" | ");
      return nested && signatures.length === 1 ? `(${rendered})` : rendered;
    }
    case "object": {
      if (type.typeName !== undefined) return renderNamedType(type.typeName);
      const members = type.properties
        .map(
          (property) =>
            `${property.name}${property.optional ? "?" : ""}: ${renderSemanticType(property.type)}`
        )
        .join("; ");
      return `{ ${members}${members === "" ? "" : ";"} }`;
    }
    case "component":
      return type.typeName === undefined ? "React.Component" : renderNamedType(type.typeName);
    case "class":
      return type.typeName === undefined ? "class" : renderNamedType(type.typeName);
    case "enum":
      return renderNamedType(type.typeName);
  }
}

function renderUnion(type: UnionNode): string {
  if (type.typeName !== undefined) return renderNamedType(type.typeName);
  const rendered = unique(type.types.map((member) => renderSemanticType(member, true)));
  return [...rendered].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)).join(" | ");
}

function renderIntersection(type: IntersectionNode): string {
  if (type.typeName !== undefined && type.types.length === 0) return renderNamedType(type.typeName);
  return type.types.map((member) => renderSemanticType(member, true)).join(" & ");
}

function withUndefined(type: string, optional: boolean): string {
  if (!optional || type.split(" | ").some((member) => member === "undefined")) return type;
  return `${type} | undefined`;
}

function partProperties(type: SemanticType): readonly SemanticProperty[] {
  if (type.kind === "function") {
    const parameter = type.callSignatures[0]?.parameters[0];
    return parameter === undefined ? [] : propertiesOf(parameter.type);
  }
  return mergedProperties([type]);
}

function propProvenancePath(
  ownerPath: PartOwnerPath,
  type: SemanticType,
  propertyName: string
): readonly string[] {
  if (type.kind === "function") {
    const parameter = type.callSignatures[0]?.parameters[0];
    if (parameter !== undefined) {
      return [...ownerPath, "callSignatures", "0", "parameters", parameter.name, "properties", propertyName];
    }
  }
  return [...ownerPath, "props", propertyName];
}

function propertiesOf(type: SemanticType): readonly SemanticProperty[] {
  switch (type.kind) {
    case "component":
      return type.props;
    case "object":
      return type.properties;
    case "intersection":
      // The parser keeps a flattened intersection property list, but a union
      // branch can contribute additional properties (Button's aria-label is one
      // such branch). Retain both levels and let the adapter merge by name.
      return [...type.properties, ...type.types.flatMap(propertiesOf)];
    case "union":
      return type.types.flatMap(propertiesOf);
    default:
      return [];
  }
}

function unionBranchProperties(type: SemanticType): readonly (readonly SemanticProperty[])[] {
  if (type.kind !== "union") return [propertiesOf(type)];
  return type.types.map(propertiesOf);
}

function mergedProperties(types: readonly SemanticType[]): readonly SemanticProperty[] {
  const candidates = types.flatMap((type) => propertiesOf(type));
  const branchSets = types.flatMap((type) => unionBranchProperties(type));
  const names = [...new Set(candidates.map((candidate) => candidate.name))];
  const merged: SemanticProperty[] = [];
  for (const name of names) {
    const matches = candidates.filter((candidate) => candidate.name === name);
    const first = matches[0];
    if (first === undefined) continue;
    const optionalByUnion =
      branchSets.length > 1 &&
      branchSets.some((branch) => !branch.some((candidate) => candidate.name === name));
    const mergedType: SemanticType = {
      kind: "union",
      types: unique(
        matches.flatMap((candidate) => renderSemanticType(candidate.type).split(/\s+\|\s+/u))
      ).map((rendered) => ({
        kind: "external",
        typeName: { name: rendered },
      })),
    };
    merged.push({
      ...first,
      optional: first.optional || matches.some((candidate) => candidate.optional) || optionalByUnion,
      type: mergedType,
    } satisfies SemanticProperty);
  }
  return merged;
}

/** Finds the semantic export without touching a writer or a generated artifact. */
function exportType(result: ExtractionResult, name: string): SemanticType | undefined {
  return result.module.exports.find((candidate) => candidate.name === name)?.type;
}

/** Semantic path of the node that owns a part's props: the export root, or one member of a component object. */
type PartOwnerPath = readonly string[];

function provenanceAt(result: ExtractionResult, pathParts: readonly string[]): ProvenanceEntry | undefined {
  return result.provenance.find(
    (entry) =>
      entry.path.length === pathParts.length &&
      entry.path.every((segment, index) => segment === pathParts[index])
  );
}

function ownershipOf(synthesized: boolean, library: boolean): ShadowPropEvidence["ownership"] {
  if (synthesized) return "synthesized";
  return library ? "library" : "external";
}

/** Evidence for the current side, whose walk reports declaration paths only. */
function propEvidence(name: string, paths: readonly string[], synthesized: boolean): ShadowPropEvidence {
  const declarationPaths = normalizedUniquePaths(paths);
  return {
    name,
    declarationPaths,
    ownership: ownershipOf(synthesized, declarationPaths.some(isLibraryDeclaration)),
    synthesized,
  };
}

/** Evidence for the Effect side, read from the entry's owners. */
function effectPropEvidence(name: string, provenance: ProvenanceEntry | undefined): ShadowPropEvidence {
  const declarationPaths = normalizedUniquePaths(declarationPathsOf(provenance));
  const synthesized = provenance?.synthesized ?? true;
  return {
    name,
    declarationPaths,
    ownership: ownershipOf(synthesized, provenance !== undefined && isLibraryOwned(provenance)),
    synthesized,
  };
}

function partEvidence(
  name: string,
  paths: readonly string[],
  synthesized: boolean,
  props: readonly ShadowPropEvidence[]
): ShadowPartEvidence {
  return {
    name,
    declarationPaths: normalizedUniquePaths(paths),
    synthesized,
    propOrder: props.map((prop) => prop.name),
    props,
  };
}

function implementationSource(
  inventory: DocsApiComponent,
  result: ExtractionResult,
  partName: string,
  ownerPath: PartOwnerPath,
  sources: ReadonlyMap<string, PartSource>
): string {
  const canonical = sources.get(partName);
  if (canonical !== undefined) return canonical.sourcePath;
  const root = provenanceAt(result, ownerPath);
  const implementation = root?.declarations.find(
    (declaration) => declaration.owner?.kind === "project" && /\.tsx?$/u.test(normalizePath(declaration.path))
  )?.path;
  return implementation === undefined
    ? repoRelativePath(inventory.sourceFile)
    : normalizePath(implementation);
}

function canonicalDefault(source: PartSource | undefined, propName: string): string | null {
  return source?.defaults.get(propName) ?? null;
}

/**
 * Derives the Effect-side origin from Effect-owned facts only.  The current
 * checker model is deliberately not consulted: doing so would turn origin
 * parity into a tautology and hide a current-side policy drift.
 */
export function effectOrigin(provenance: ProvenanceEntry | undefined): ApiProp["origin"] {
  const declarationPaths = declarationPathsOf(provenance);
  const localOrigin = propOrigin(declarationPaths, provenance?.synthesized === true);
  if (localOrigin === "recipe-axis" || (provenance !== undefined && isLibraryOwned(provenance))) {
    return localOrigin;
  }
  const packages = dependencyPackages(provenance);
  return packages.length === 1 && packages[0] !== undefined ? { packageName: packages[0] } : localOrigin;
}

function toApiPart(
  inventory: DocsApiComponent,
  result: ExtractionResult,
  partName: string,
  ownerPath: PartOwnerPath,
  type: SemanticType,
  canonical: CanonicalComponentFacts,
  problems: ShadowProblem[]
): ApiPartMapping {
  const source = canonical.sources.get(partName);
  const sourcePath = implementationSource(inventory, result, partName, ownerPath, canonical.sources);
  const semanticProps = partProperties(type);
  const props: ApiProp[] = [];
  const evidence: ShadowPropEvidence[] = [];
  const counted = canonical.forwarded.get(partName) ?? { count: 0, from: [] };

  for (const property of semanticProps) {
    const provenance = provenanceAt(result, propProvenancePath(ownerPath, type, property.name));
    const origin = effectOrigin(provenance);
    const description = dedupeDocumentation(property.documentation?.description);
    if (origin === "declared" && description === "") {
      problems.push(
        adapterProblem(
          inventory.slug,
          "missing-description",
          `${partName}.${property.name}: public prop has no JSDoc description (${sourcePath})`
        )
      );
    }
    evidence.push(effectPropEvidence(property.name, provenance));
    const printedType = withUndefined(renderSemanticType(property.type), property.optional);
    props.push({
      name: property.name,
      origin,
      type: printedType,
      shortType: shortTypeOf(property.name, printedType),
      defaultValue:
        canonicalDefault(source, property.name) ??
        (dependencyPackageName(origin) === null ? null : (property.documentation?.defaultValue ?? null)),
      description,
      required: !property.optional,
    });
  }
  props.sort((left, right) => left.name.localeCompare(right.name));
  const sortedEvidence = [...evidence].sort((left, right) => left.name.localeCompare(right.name));
  const owner = provenanceAt(result, ownerPath);
  const declarationPaths = declarationPathsOf(owner);
  const synthesized = owner?.synthesized === true;
  return {
    part: {
      name: partName,
      rsc: source?.rsc ?? "client",
      sourcePath,
      props,
      forwardedFrom: counted.from,
      forwardedCount: counted.count,
    },
    evidence: partEvidence(partName, declarationPaths, synthesized, sortedEvidence),
  };
}

function canonicalShellPart(
  inventory: DocsApiComponent,
  partName: string,
  canonical: CanonicalComponentFacts
): ApiPartMapping {
  const source = canonical.sources.get(partName);
  const counted = canonical.forwarded.get(partName) ?? { count: 0, from: [] };
  const sourcePath = source?.sourcePath ?? repoRelativePath(inventory.sourceFile);
  return {
    part: {
      name: partName,
      rsc: source?.rsc ?? "client",
      sourcePath,
      props: [],
      forwardedFrom: counted.from,
      forwardedCount: counted.count,
    },
    evidence: partEvidence(partName, source === undefined ? [] : [source.sourcePath], false, []),
  };
}

function namespaceMembers(
  type: SemanticType
): readonly { readonly name: string; readonly type: SemanticType }[] | undefined {
  if (type.kind !== "object" || type.properties.length === 0) return undefined;
  const members = type.properties.filter(
    (property) =>
      property.type.kind === "component" ||
      property.type.kind === "function" ||
      property.type.kind === "external"
  );
  return members.length === 0 ? undefined : members;
}

/** One Effect-side part planned from a semantic export, or a checker-backed fallback shell. */
export type EffectExportPart = {
  readonly name: string;
  readonly ownerPath: readonly string[];
  readonly type: SemanticType | undefined;
};

function canonicalNamesForRoot(rootName: string, names: readonly string[]): readonly string[] {
  return names.filter((name) => name === rootName || name.startsWith(`${rootName}.`));
}

/**
 * Maps a semantic export into API parts. Hooks (`function`) and unexpanded
 * re-export/namespace roots (`intrinsic`/`external`) become parts; a namespace
 * object that fell back to `any` uses the checker-discovered member names.
 */
export function renderableExportParts(
  rootName: string,
  type: SemanticType,
  canonicalPartNames: readonly string[]
): readonly EffectExportPart[] | undefined {
  if (type.kind === "component" || type.kind === "function") {
    return [{ name: rootName, ownerPath: [rootName], type }];
  }
  const members = namespaceMembers(type);
  if (members !== undefined) {
    return members.map((member) => ({
      name: `${rootName}.${member.name}`,
      ownerPath: [rootName, "properties", member.name],
      type: member.type,
    }));
  }
  const canonical = canonicalNamesForRoot(rootName, canonicalPartNames);
  if (canonical.length > 1 || (canonical.length === 1 && canonical[0] !== rootName)) {
    return canonical.map((name) => ({
      name,
      ownerPath: name === rootName ? [rootName] : [rootName, "properties", name.slice(rootName.length + 1)],
      type: name === rootName ? type : undefined,
    }));
  }
  if (type.kind === "external" || type.kind === "intrinsic" || canonical.length === 1) {
    return [{ name: rootName, ownerPath: [rootName], type }];
  }
  return undefined;
}

function partsFromRoot(
  inventory: DocsApiComponent,
  result: ExtractionResult,
  rootName: string,
  canonical: CanonicalComponentFacts,
  problems: ShadowProblem[]
): PartsExtraction {
  const exported = exportType(result, rootName);
  if (exported === undefined) {
    problems.push(
      adapterProblem(inventory.slug, "missing-export", `${inventory.entryFile}: missing "${rootName}"`)
    );
    return { parts: [], evidence: [] };
  }
  const planned = renderableExportParts(rootName, exported, [...canonical.sources.keys()]);
  if (planned === undefined) {
    problems.push(
      adapterProblem(
        inventory.slug,
        "unsupported-component-shape",
        `${rootName}: semantic export kind "${exported.kind}" has no renderable component parts`
      )
    );
    return { parts: [], evidence: [] };
  }
  const mapped = planned.map((entry) =>
    entry.type === undefined
      ? canonicalShellPart(inventory, entry.name, canonical)
      : toApiPart(inventory, result, entry.name, entry.ownerPath, entry.type, canonical, problems)
  );
  return { parts: mapped.map((entry) => entry.part), evidence: mapped.map((entry) => entry.evidence) };
}

function partsFromExtraction(
  inventory: DocsApiComponent,
  result: ExtractionResult,
  canonical: CanonicalComponentFacts,
  problems: ShadowProblem[]
): PartsExtraction {
  const parts: ApiPart[] = [];
  const evidence: ShadowPartEvidence[] = [];
  for (const rootName of inventory.exportNames) {
    const mapped = partsFromRoot(inventory, result, rootName, canonical, problems);
    parts.push(...mapped.parts);
    evidence.push(...mapped.evidence);
  }
  return { parts, evidence };
}

function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function captureInputs(inventory: readonly DocsApiComponent[]): readonly ShadowInputCapture[] {
  return inventory.map((entry) => ({
    entryFile: entry.entryFile,
    entrySha256: sha256File(entry.entryFile),
    sourceFile: entry.sourceFile,
    sourceSha256: sha256File(entry.sourceFile),
  }));
}

/** Compares the complete per-side input capture, including source bytes. */
export function inputCapturesEqual(
  left: readonly ShadowInputCapture[],
  right: readonly ShadowInputCapture[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((capture, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      capture.entryFile === other.entryFile &&
      capture.entrySha256 === other.entrySha256 &&
      capture.sourceFile === other.sourceFile &&
      capture.sourceSha256 === other.sourceSha256
    );
  });
}

function shadowCurrentEvidence(value: CurrentPartEvidence): ShadowPartEvidence {
  const props = value.props.map((property) =>
    propEvidence(property.name, property.declarationPaths, property.synthesized)
  );
  return {
    ...partEvidence(value.name, value.declarationPaths, value.synthesized, props),
    propOrder: value.propOrder,
  };
}

export function currentSide(inventory: readonly DocsShadowComponent[], context: LibraryProject): SideRun {
  const inputs = captureInputs(inventory);
  const results = inventory.map((entry) => {
    const problems = new ProblemLog();
    const request = { entryFile: entry.entryFile, exportNames: entry.exportNames };
    try {
      inspectComponentDemos(inspectComponent(entry.slug), problems);
    } catch (error) {
      problems.add(error instanceof Error ? error.message : String(error));
    }
    const parts = describeComponentApi(context, request, problems);
    return {
      parts,
      evidence: componentPartRequests(context, request).map((part) => {
        const visible = parts.find((candidate) => candidate.name === part.name);
        return shadowCurrentEvidence(
          inspectCurrentPartEvidence(context, part, new Set(visible?.props.map((prop) => prop.name) ?? []))
        );
      }),
      problems: problems.problems.map((message) => currentProblem(entry.slug, message)),
    };
  });
  const global = new ProblemLog();
  try {
    inspectGlobalDocs(global);
  } catch (error) {
    global.add(error instanceof Error ? error.message : String(error));
  }
  const globalProblems = global.problems.map((message) => currentProblem("docs-global", message));
  const first = results[0];
  if (first === undefined || globalProblems.length === 0) return { results, inputs };
  return {
    results: [{ ...first, problems: [...first.problems, ...globalProblems] }, ...results.slice(1)],
    inputs,
  };
}

export type EffectSideOptions = Pick<ExtractorOptions, "includeExternalTypes">;

/**
 * Extracts every inventory entry through the Effect extractor in one opened
 * project. The bridge to the native compiler is synchronous and every entry
 * shares that project, so the entries run sequentially by design.
 */
async function extractInventory(
  inventory: readonly DocsApiComponent[],
  options: EffectSideOptions
): Promise<readonly ExtractionResult[]> {
  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const extractor = yield* ProjectExtractor;
      return yield* Effect.forEach(inventory, (entry) => extractor.extractModule(entry.entryFile, options));
    }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath: uiTsconfig, cwd: repoRoot })))
  );
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.squash(exit.cause);
  if (failure instanceof Error && "_tag" in failure) {
    throw new Error(`Effect API extraction failed (${String(failure._tag)}): ${failure.message}`, {
      cause: failure,
    });
  }
  throw failure instanceof Error ? failure : new Error(String(failure));
}

export async function effectSide(
  inventory: readonly DocsApiComponent[],
  context: LibraryProject,
  options: EffectSideOptions = {}
): Promise<SideRun> {
  const inputs = captureInputs(inventory);
  const extraction = await extractInventory(inventory, options);
  const canonical = new Map<string, CanonicalComponentFacts>();
  for (const entry of inventory) {
    const request = { entryFile: entry.entryFile, exportNames: entry.exportNames };
    const sources = componentPartSources(context, request);
    const forwarded = new Map(
      componentPartRequests(context, request).map((part) => [part.name, inspectPartForwarded(context, part)])
    );
    canonical.set(entry.slug, { sources, forwarded });
  }
  const results = extraction.map((result, index) => {
    const entry = inventory[index];
    if (entry === undefined)
      throw new Error("docs shadow extraction returned fewer results than the inventory");
    const problems = result.warnings.map((warning) => warningProblem(entry.slug, warning));
    const mapped = partsFromExtraction(
      entry,
      result,
      canonical.get(entry.slug) ?? { sources: new Map(), forwarded: new Map() },
      problems
    );
    return { parts: mapped.parts, evidence: mapped.evidence, problems };
  });
  return { results, inputs };
}
