/**
 * API-reference generation (docs-site.md §8).
 *
 * The library's own tsconfig is opened through the TypeScript API, so every table row
 * is a resolved checker fact: the prop's printed type, its destructuring default, and
 * its JSDoc. Anything the checker cannot resolve — and any public prop without JSDoc —
 * is recorded as a problem and fails the docs build rather than rendering an empty cell.
 *
 * The RSC column is equally mechanical: it reports whether the *source module that
 * declares the part* carries a `"use client"` directive (performance.md §3).
 */

import {
  isBindingElement,
  isFunctionLikeDeclaration,
  isIdentifier,
  isObjectBindingPattern,
} from "typescript/unstable/ast/is";
import { API, SignatureKind, SymbolFlags } from "typescript/unstable/sync";
import type {
  Checker,
  Program,
  Project,
  Signature,
  Symbol as TsSymbol,
  Type,
} from "typescript/unstable/sync";

import type { ApiPart, ApiProp, RscStatus } from "../../src/lib/docs-model.ts";
import type { ProblemLog } from "./errors.ts";
import { isLibrarySourcePath, repoRelative, uiTsconfig } from "./paths.ts";

export type LibraryProject = {
  project: Project;
  checker: Checker;
  program: Program;
  close: () => void;
};

/**
 * Opens `packages/ui` for type resolution. Callers must `close()` the result.
 *
 * Only the library is opened: a demo is never type-inspected by this pass — the page
 * imports it, so the bundler compiles it (docs-site.md §6).
 */
export function openLibraryProject(): LibraryProject {
  const api = new API({ cwd: process.cwd() });
  const snapshot = api.updateSnapshot({ openProjects: [uiTsconfig] });
  const project = snapshot.getProject(uiTsconfig);
  if (project === undefined) {
    api.close();
    throw new Error(`Could not open the project at ${uiTsconfig}`);
  }
  return {
    project,
    checker: project.checker,
    program: project.program,
    close: () => {
      api.close();
    },
  };
}

/**
 * A `"use client"` directive only counts as one when it leads the module, so a stray
 * string expression further down never flips the classification.
 */
export function readRscStatus(sourceText: string): RscStatus {
  const withoutComments = sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const line of withoutComments.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    if (/^["'']use client["''];?$/.test(trimmed)) {
      return "client";
    }
    if (/^["''][^"']*["''];?$/.test(trimmed)) {
      continue;
    }
    return "server";
  }
  return "server";
}

/** Package name a forwarded prop comes from, e.g. `@base-ui/react` or `react`. */
function declaringPackage(declarationPath: string): string | null {
  const marker = "/node_modules/";
  const last = declarationPath.lastIndexOf(marker);
  if (last === -1) {
    return null;
  }
  const rest = declarationPath.slice(last + marker.length);
  const segments = rest.split("/");
  const first = segments[0];
  if (first === undefined) {
    return null;
  }
  if (first.startsWith("@")) {
    const second = segments[1];
    return second === undefined ? first : `${first}/${second}`;
  }
  return first;
}

function isOwnProp(symbol: TsSymbol): boolean {
  return symbol.declarations.some((declaration) => isLibrarySourcePath(declaration.path));
}

function isOptional(symbol: TsSymbol): boolean {
  return (symbol.flags & SymbolFlags.Optional) !== 0;
}

export type PartSource = {
  /** Repo-relative path of the file that declares the part. */
  sourcePath: string;
  rsc: RscStatus;
  /** Destructuring defaults, keyed by prop name. */
  defaults: ReadonlyMap<string, string>;
};

function isRecipeAxisDeclaration(declarationPath: string): boolean {
  const normalized = declarationPath.replaceAll("\\", "/");
  const file = normalized.slice(normalized.lastIndexOf("/") + 1);
  return file.endsWith("-variants.ts") || file.endsWith("-variants.tsx");
}

/**
 * Classifies a prop from facts supplied by either checker.  Recipe axes are
 * checker-synthesized in the current model and are declared in `*-variants`
 * sources by the Effect model; neither case needs the consumer-facing JSDoc
 * policy applied to ordinary declared props.
 */
export function propOrigin(declarationPaths: readonly string[], synthesized: boolean): ApiProp["origin"] {
  return synthesized || declarationPaths.some(isRecipeAxisDeclaration) ? "recipe-axis" : "declared";
}

/**
 * Reads the implementation-side facts of a part: which file declares it (hence its RSC
 * status) and the defaults its props destructuring assigns.
 */
export function readPartSource(context: LibraryProject, signature: Signature): PartSource | null {
  const handle = signature.declaration;
  if (handle === undefined) {
    return null;
  }
  const node = handle.resolve(context.project);
  if (node === undefined) {
    return null;
  }
  const sourceFile = node.getSourceFile();
  const defaults = new Map<string, string>();
  if (isFunctionLikeDeclaration(node)) {
    const pattern = node.parameters[0]?.name;
    if (pattern !== undefined && isObjectBindingPattern(pattern)) {
      for (const element of pattern.elements) {
        if (!isBindingElement(element) || element.initializer === undefined) {
          continue;
        }
        const name = element.propertyName ?? element.name;
        if (name !== undefined && isIdentifier(name)) {
          defaults.set(name.text, element.initializer.getText().trim());
        }
      }
    }
  }
  return {
    sourcePath: repoRelative(sourceFile.fileName),
    rsc: readRscStatus(sourceFile.text),
    defaults,
  };
}

/**
 * A symbol declared in several union branches reports each branch's JSDoc in turn.
 * Identical paragraphs are the same sentence repeated, not two facts.
 */
function dedupeDocumentation(documentation: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const paragraph of documentation.split(/\n{2,}|\n/)) {
    const trimmed = paragraph.trim();
    if (trimmed === "" || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    kept.push(trimmed);
  }
  return kept.join(" ");
}

function printType(checker: Checker, type: Type | undefined): string | null {
  if (type === undefined || type.isErrorType()) {
    return null;
  }
  const printed = checker.typeToString(type);
  return printed === "" ? null : printed;
}

/**
 * The one-line type a closed reference row shows, or `null` when the printed type is
 * short enough to show in full (docs-site.md §8; adapted from base-ui's `shortType`).
 *
 * A plain-string heuristic on purpose: it decides what a *collapsed* row displays, and
 * the expanded panel always carries the real signature, so being approximate costs
 * nothing while parsing the printed type would cost a second type model.
 *
 * `on`/`get` must be followed by a capital to count as the handler/accessor convention —
 * a prop literally named `open` or `gettable` is not a function.
 */
export function shortTypeOf(propName: string, printedType: string): string | null {
  if (/^(?:on|get)[A-Z]/.test(propName) || printedType.includes("=>")) {
    return "function";
  }
  const unionBars = printedType.split("|").length - 1;
  if (unionBars >= 2 || printedType.length >= 30) {
    return "Union";
  }
  return null;
}

export type PartRequest = {
  /** Display name, e.g. `Dialog.Content`. */
  name: string;
  type: Type;
};

/** Evidence the current checker model exposes for one part and its visible props. */
export type CurrentPropEvidence = {
  readonly name: string;
  readonly declarationPaths: readonly string[];
  readonly synthesized: boolean;
};

export type CurrentPartEvidence = {
  readonly name: string;
  readonly declarationPaths: readonly string[];
  readonly synthesized: boolean;
  readonly propOrder: readonly string[];
  readonly props: readonly CurrentPropEvidence[];
};

function callSignature(checker: Checker, type: Type): Signature | null {
  const signatures = checker.getSignaturesOfType(type, SignatureKind.Call);
  return signatures[0] ?? null;
}

function isForwardedProp(symbol: TsSymbol): boolean {
  const declarationPaths = symbol.declarations.map((declaration) => declaration.path);
  return (
    propOrigin(declarationPaths, symbol.declarations.length === 0) !== "recipe-axis" && !isOwnProp(symbol)
  );
}

/** Forwarded-prop summary for one checker-backed part: omitted count and declaring packages. */
export type PartForwarded = {
  readonly count: number;
  readonly from: readonly string[];
};

const emptyForwarded: PartForwarded = { count: 0, from: [] };

function forwardedOfPropsType(checker: Checker, propsType: Type): PartForwarded {
  const from = new Set<string>();
  let count = 0;
  for (const property of checker.getPropertiesOfType(propsType)) {
    if (!isForwardedProp(property)) continue;
    count += 1;
    for (const declaration of property.declarations) {
      const packageName = declaringPackage(declaration.path);
      if (packageName !== null) from.add(packageName);
    }
  }
  return { count, from: [...from].sort((left, right) => left.localeCompare(right)) };
}

/**
 * Counts props the part accepts that are neither library-declared nor recipe
 * axes — the same omitted set `describePart` drops from the table.
 */
export function inspectPartForwarded(context: LibraryProject, part: PartRequest): PartForwarded {
  const signature = callSignature(context.checker, part.type);
  const parameter = signature?.getParameters()[0];
  if (parameter === undefined) return emptyForwarded;
  const propsType = context.checker.getTypeOfSymbol(parameter);
  if (propsType === undefined || propsType.isErrorType()) return emptyForwarded;
  return forwardedOfPropsType(context.checker, propsType);
}

function addProblem(problems: ProblemLog | undefined, message: string): void {
  problems?.add(message);
}

/**
 * Resolves the checker-backed part requests for one public component.  Both the
 * production API tables and the shadow evidence reader use this one traversal,
 * so member ordering and unsupported namespace handling cannot drift.
 */
export function componentPartRequests(
  context: LibraryProject,
  request: ComponentApiRequest,
  problems?: ProblemLog
): readonly PartRequest[] {
  const { checker, program } = context;
  const sourceFile = program.getSourceFile(request.entryFile);
  if (sourceFile === undefined) {
    addProblem(problems, `${request.entryFile}: entry module is not part of the library program`);
    return [];
  }
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    addProblem(problems, `${request.entryFile}: entry module has no module symbol`);
    return [];
  }
  const moduleExports = checker.getExportsOfModule(moduleSymbol);
  const parts: PartRequest[] = [];
  for (const exportName of request.exportNames) {
    const rootSymbol = moduleExports.find((exported) => exported.name === exportName);
    if (rootSymbol === undefined) {
      addProblem(problems, `${request.entryFile}: does not export "${exportName}"`);
      continue;
    }
    const rootType = checker.getTypeOfSymbol(rootSymbol);
    if (rootType === undefined || rootType.isErrorType()) {
      addProblem(problems, `${exportName}: exported value has an unresolvable type`);
      continue;
    }
    if (callSignature(checker, rootType) !== null) {
      parts.push({ name: exportName, type: rootType });
      continue;
    }
    const start = parts.length;
    for (const member of checker.getPropertiesOfType(rootType)) {
      const memberType = checker.getTypeOfSymbol(member);
      if (memberType === undefined || callSignature(checker, memberType) === null) continue;
      parts.push({ name: `${exportName}.${member.name}`, type: memberType });
    }
    if (parts.length === start) {
      addProblem(problems, `${exportName}: no renderable parts were found on the exported namespace`);
    }
  }
  return parts;
}

/**
 * Returns source facts for every checker-backed part, including AST-derived
 * destructuring defaults.  This is intentionally writer-free and is also used
 * when the Effect result is adapted for the docs shadow comparison.
 */
export function componentPartSources(
  context: LibraryProject,
  request: ComponentApiRequest
): ReadonlyMap<string, PartSource> {
  const sources = new Map<string, PartSource>();
  for (const part of componentPartRequests(context, request)) {
    const signature = callSignature(context.checker, part.type);
    if (signature === null) continue;
    const source = readPartSource(context, signature);
    if (source !== null) sources.set(part.name, source);
  }
  return sources;
}

/** Checker-owned facts for one public prop, including props omitted as forwarded. */
export type CurrentPartPropFact = {
  readonly type: string | null;
  readonly required: boolean;
};

/** Every public prop accepted by each checker-backed part, including forwarded props. */
export function componentPartPropFacts(
  context: LibraryProject,
  request: ComponentApiRequest
): ReadonlyMap<string, ReadonlyMap<string, CurrentPartPropFact>> {
  const factsByPart = new Map<string, ReadonlyMap<string, CurrentPartPropFact>>();
  for (const part of componentPartRequests(context, request)) {
    const signature = callSignature(context.checker, part.type);
    const parameter = signature?.getParameters()[0];
    if (parameter === undefined) {
      factsByPart.set(part.name, new Map());
      continue;
    }
    const propsType = context.checker.getTypeOfSymbol(parameter);
    if (propsType === undefined || propsType.isErrorType()) {
      factsByPart.set(part.name, new Map());
      continue;
    }
    factsByPart.set(
      part.name,
      new Map(
        context.checker.getPropertiesOfType(propsType).map((property) => [
          property.name,
          {
            type: printType(context.checker, context.checker.getTypeOfSymbol(property)),
            required: !isOptional(property),
          },
        ])
      )
    );
  }
  return factsByPart;
}

/** Extracts current checker evidence for only the props the docs table publishes. */
export function inspectCurrentPartEvidence(
  context: LibraryProject,
  part: PartRequest,
  visiblePropNames: ReadonlySet<string>
): CurrentPartEvidence {
  const signature = callSignature(context.checker, part.type);
  const declarationPaths = signature?.declaration === undefined ? [] : [signature.declaration.path];
  const parameter = signature?.getParameters()[0];
  if (parameter === undefined) {
    return { name: part.name, declarationPaths, synthesized: false, propOrder: [], props: [] };
  }
  const propsType = context.checker.getTypeOfSymbol(parameter);
  if (propsType === undefined || propsType.isErrorType()) {
    return { name: part.name, declarationPaths, synthesized: false, propOrder: [], props: [] };
  }
  const props = context.checker
    .getPropertiesOfType(propsType)
    .filter((property) => visiblePropNames.has(property.name))
    .map((property) => ({
      name: property.name,
      declarationPaths: property.declarations.map((declaration) => declaration.path),
      synthesized: property.declarations.length === 0,
    }));
  return {
    name: part.name,
    declarationPaths,
    synthesized: false,
    propOrder: props.map((property) => property.name),
    props: [...props].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function describePart(context: LibraryProject, request: PartRequest, problems: ProblemLog): ApiPart | null {
  const { checker } = context;
  const signature = callSignature(checker, request.type);
  if (signature === null) {
    problems.add(`${request.name}: no call signature — it does not look like a component`);
    return null;
  }
  const source = readPartSource(context, signature);
  if (source === null) {
    problems.add(`${request.name}: could not resolve the declaring source file`);
    return null;
  }

  const parameters = signature.getParameters();
  const propsSymbol = parameters[0];
  if (propsSymbol === undefined) {
    return {
      name: request.name,
      rsc: source.rsc,
      sourcePath: source.sourcePath,
      props: [],
      forwardedFrom: [],
      forwardedCount: 0,
    };
  }
  const propsType = checker.getTypeOfSymbol(propsSymbol);
  if (propsType === undefined || propsType.isErrorType()) {
    problems.add(`${request.name}: props type is unresolvable`);
    return null;
  }

  const props: ApiProp[] = [];
  const forwardedInfo = forwardedOfPropsType(checker, propsType);

  for (const property of checker.getPropertiesOfType(propsType)) {
    // A prop with no declaration at all is synthesised by `VariantProps` over a library
    // `tv` recipe: there is no declaration site to hang JSDoc on, so its printed union
    // is the documentation and the JSDoc gate does not apply.
    const declarationPaths = property.declarations.map((declaration) => declaration.path);
    const isRecipeAxis = propOrigin(declarationPaths, property.declarations.length === 0) === "recipe-axis";
    if (isForwardedProp(property)) continue;
    const printed = printType(checker, checker.getTypeOfSymbol(property));
    if (printed === null) {
      problems.add(
        `${request.name}.${property.name}: type is unresolvable — the docs build cannot print it (${source.sourcePath})`
      );
      continue;
    }
    const description = dedupeDocumentation(checker.getDocumentationCommentOfSymbol(property));
    if (description === "" && !isRecipeAxis) {
      problems.add(
        `${request.name}.${property.name}: public prop has no JSDoc description (${source.sourcePath})`
      );
      continue;
    }
    props.push({
      name: property.name,
      origin: isRecipeAxis ? "recipe-axis" : "declared",
      type: printed,
      shortType: shortTypeOf(property.name, printed),
      defaultValue: source.defaults.get(property.name) ?? null,
      description,
      required: !isOptional(property),
    });
  }

  props.sort((left, right) => left.name.localeCompare(right.name));

  return {
    name: request.name,
    rsc: source.rsc,
    sourcePath: source.sourcePath,
    props,
    forwardedFrom: forwardedInfo.from,
    forwardedCount: forwardedInfo.count,
  };
}

export type ComponentApiRequest = {
  /** Absolute path of the public entry module, e.g. `packages/ui/src/button.ts`. */
  entryFile: string;
  /**
   * Facade value exports to walk, in display order. Callers pass this explicitly
   * (`resolveComponentPaths(...).apiExportNames`) — the generator does not sweep
   * the entry for namespace-shaped companions.
   */
  exportNames: readonly string[];
};

/**
 * Resolves one component's public surface from an explicit list of export names:
 * a single part for a callable, or one part per member for a namespace compound
 * (`Dialog.Root`, `Dialog.Content`, …). Companions (`VerticalTable` next to `Table`)
 * are included only when the caller names them.
 */
export function describeComponentApi(
  context: LibraryProject,
  request: ComponentApiRequest,
  problems: ProblemLog
): readonly ApiPart[] {
  const requests = componentPartRequests(context, request, problems);
  const parts: ApiPart[] = [];
  for (const partRequest of requests) {
    const part = describePart(context, partRequest, problems);
    if (part !== null) {
      parts.push(part);
    }
  }
  return parts;
}
