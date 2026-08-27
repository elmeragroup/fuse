import { Effect } from "effect";
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
  openLibraryProject,
  propOrigin,
  shortTypeOf,
} from "./api.ts";
import type { CurrentPartEvidence, PartSource } from "./api.ts";
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
};

type SemanticProperty = PropertyNode;

function isLibraryDeclaration(value: string): boolean {
  return normalizePath(value).toLowerCase().includes("packages/ui/src/");
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
      return renderSemanticType(type.resolvedType ?? type.type, nested);
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

function propertyProvenance(
  result: ExtractionResult,
  partName: string,
  propName: string,
  aliases: readonly string[]
): ProvenanceEntry | undefined {
  const direct = provenanceAt(result, [partName, "props", propName]);
  if (direct !== undefined) return direct;
  for (const alias of aliases) {
    const candidate = provenanceAt(result, [alias, "properties", propName]);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

function provenanceAt(result: ExtractionResult, pathParts: readonly string[]): ProvenanceEntry | undefined {
  return result.provenance.find(
    (entry) =>
      entry.path.length === pathParts.length &&
      entry.path.every((segment, index) => segment === pathParts[index])
  );
}

function declarationPackages(paths: readonly string[]): readonly string[] {
  const packages = new Set<string>();
  for (const candidate of paths) {
    const normalized = normalizePath(candidate);
    const marker = "/node_modules/";
    const index = normalized.lastIndexOf(marker);
    if (index === -1) continue;
    const segments = normalized.slice(index + marker.length).split("/");
    const first = segments[0];
    if (first === undefined || first === "") continue;
    packages.add(first.startsWith("@") ? `${first}/${segments[1] ?? ""}`.replace(/\/$/u, "") : first);
  }
  return [...packages].sort((left, right) => left.localeCompare(right));
}

function ownership(paths: readonly string[], synthesized: boolean): ShadowPropEvidence["ownership"] {
  if (synthesized) return "synthesized";
  return paths.some(isLibraryDeclaration) ? "library" : "external";
}

function propEvidence(name: string, paths: readonly string[], synthesized: boolean): ShadowPropEvidence {
  const declarationPaths = normalizedUniquePaths(paths);
  return { name, declarationPaths, ownership: ownership(declarationPaths, synthesized), synthesized };
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
  aliases: readonly string[],
  sources: ReadonlyMap<string, PartSource>
): string {
  const canonical = sources.get(partName) ?? aliases.map((alias) => sources.get(alias)).find(Boolean);
  if (canonical !== undefined) return canonical.sourcePath;
  const root =
    provenanceAt(result, [partName]) ?? aliases.map((alias) => provenanceAt(result, [alias])).find(Boolean);
  const implementation = root?.declarationPaths.find(
    (candidate) => isLibraryDeclaration(candidate) && /\.tsx?$/u.test(normalizePath(candidate))
  );
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
  const declarationPaths = provenance?.declarationPaths ?? [];
  const localOrigin = propOrigin(declarationPaths, provenance?.synthesized === true);
  if (localOrigin === "recipe-axis" || declarationPaths.some(isLibraryDeclaration)) {
    return localOrigin;
  }
  const packages = declarationPackages(declarationPaths);
  return packages.length === 1 && packages[0] !== undefined ? { packageName: packages[0] } : localOrigin;
}

function toApiPart(
  inventory: DocsApiComponent,
  result: ExtractionResult,
  rootName: string,
  partName: string,
  semanticTypes: readonly SemanticType[],
  aliases: readonly string[],
  canonicalSources: ReadonlyMap<string, PartSource>,
  problems: ShadowProblem[]
): ApiPartMapping {
  const source =
    canonicalSources.get(partName) ?? aliases.map((alias) => canonicalSources.get(alias)).find(Boolean);
  const sourcePath = implementationSource(inventory, result, partName, aliases, canonicalSources);
  const semanticProps = mergedProperties(semanticTypes);
  const props: ApiProp[] = [];
  const evidence: ShadowPropEvidence[] = [];
  const forwarded = new Set<string>();

  for (const property of semanticProps) {
    const provenance = propertyProvenance(result, rootName, property.name, aliases);
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
    const declarationPaths = provenance?.declarationPaths ?? [];
    const synthesized = provenance?.synthesized ?? true;
    evidence.push(propEvidence(property.name, declarationPaths, synthesized));
    for (const packageName of declarationPackages(declarationPaths)) forwarded.add(packageName);
    const type = withUndefined(renderSemanticType(property.type), property.optional);
    props.push({
      name: property.name,
      origin,
      type,
      shortType: shortTypeOf(property.name, type),
      defaultValue:
        canonicalDefault(source, property.name) ??
        (dependencyPackageName(origin) === null ? null : (property.documentation?.defaultValue ?? null)),
      description,
      required: !property.optional,
    });
  }
  props.sort((left, right) => left.name.localeCompare(right.name));
  const sortedEvidence = [...evidence].sort((left, right) => left.name.localeCompare(right.name));
  const declarationPaths = [partName, ...aliases]
    .map((name) => provenanceAt(result, [name]))
    .flatMap((entry) => entry?.declarationPaths ?? []);
  const synthesized = [partName, ...aliases]
    .map((name) => provenanceAt(result, [name]))
    .some((entry) => entry?.synthesized === true);
  return {
    part: {
      name: partName,
      rsc: source?.rsc ?? "client",
      sourcePath,
      props,
      forwardedFrom: [...forwarded].sort((left, right) => left.localeCompare(right)),
      forwardedCount: 0,
    },
    evidence: partEvidence(partName, declarationPaths, synthesized, sortedEvidence),
  };
}

function aliasNames(result: ExtractionResult, rootName: string): readonly string[] {
  return result.module.exports
    .map((candidate) => candidate.name)
    .filter((name) => name.startsWith(`${rootName}`) && name.endsWith("Props"));
}

function partNameForAlias(rootName: string, alias: string): string | null {
  const suffix = alias.slice(rootName.length, -"Props".length);
  if (suffix === "") return rootName;
  if (!/^[A-Z][A-Za-z0-9]*$/u.test(suffix)) return null;
  return `${rootName}.${suffix}`;
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
  const aliases = aliasNames(result, rootName);
  if (exported.kind === "component") {
    const mapped = toApiPart(
      inventory,
      result,
      rootName,
      rootName,
      [
        exported,
        ...aliases
          .map((alias) => exportType(result, alias))
          .filter((type): type is SemanticType => type !== undefined),
      ],
      aliases,
      canonical.sources,
      problems
    );
    return { parts: [mapped.part], evidence: [mapped.evidence] };
  }
  const parts: ApiPart[] = [];
  const evidence: ShadowPartEvidence[] = [];
  for (const alias of aliases) {
    const partName = partNameForAlias(rootName, alias);
    const aliasType = exportType(result, alias);
    if (
      partName === null ||
      aliasType === undefined ||
      !["component", "object", "intersection", "union"].includes(aliasType.kind)
    )
      continue;
    const mapped = toApiPart(
      inventory,
      result,
      rootName,
      partName,
      [aliasType],
      [alias],
      canonical.sources,
      problems
    );
    parts.push(mapped.part);
    evidence.push(mapped.evidence);
  }
  if (parts.length > 0) {
    problems.push(
      adapterProblem(
        inventory.slug,
        "partial-compound-export",
        `${rootName}: semantic export kind "${exported.kind}" yielded ${String(parts.length)} aliased part(s); unaliased members are not represented`
      )
    );
    return { parts, evidence };
  }
  problems.push(
    adapterProblem(
      inventory.slug,
      "unsupported-component-shape",
      `${rootName}: semantic export kind "${exported.kind}" has no renderable component parts`
    )
  );
  return { parts: [], evidence: [] };
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

export function currentSide(inventory: readonly DocsShadowComponent[]): SideRun {
  const inputs = captureInputs(inventory);
  const context = openLibraryProject();
  try {
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
  } finally {
    context.close();
  }
}

export type EffectSideOptions = Pick<ExtractorOptions, "includeExternalTypes">;

export async function effectSide(
  inventory: readonly DocsApiComponent[],
  options: EffectSideOptions = {}
): Promise<SideRun> {
  const inputs = captureInputs(inventory);
  const extraction = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const extractor = yield* ProjectExtractor;
        const results: ExtractionResult[] = [];
        for (const entry of inventory) {
          results.push(
            yield* extractor.extractModule(entry.entryFile, {
              typeOperatorOutput: "resolved",
              ...options,
            })
          );
        }
        return results;
      }).pipe(Effect.provide(ProjectExtractor.live({ tsconfigPath: uiTsconfig, cwd: repoRoot })))
    )
  );
  const canonical = new Map<string, CanonicalComponentFacts>();
  const context = openLibraryProject();
  try {
    for (const entry of inventory) {
      const request = { entryFile: entry.entryFile, exportNames: entry.exportNames };
      canonical.set(entry.slug, {
        sources: componentPartSources(context, request),
      });
    }
  } finally {
    context.close();
  }
  const results = extraction.map((result, index) => {
    const entry = inventory[index];
    if (entry === undefined)
      throw new Error("docs shadow extraction returned fewer results than the inventory");
    const problems = result.warnings.map((warning) => warningProblem(entry.slug, warning));
    const mapped = partsFromExtraction(
      entry,
      result,
      canonical.get(entry.slug) ?? { sources: new Map() },
      problems
    );
    return { parts: mapped.parts, evidence: mapped.evidence, problems };
  });
  return { results, inputs };
}
