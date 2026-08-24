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

/**
 * Reads the implementation-side facts of a part: which file declares it (hence its RSC
 * status) and the defaults its props destructuring assigns.
 */
function readPartSource(context: LibraryProject, signature: Signature): PartSource | null {
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

export type PartRequest = {
  /** Display name, e.g. `Dialog.Content`. */
  name: string;
  type: Type;
};

function callSignature(checker: Checker, type: Type): Signature | null {
  const signatures = checker.getSignaturesOfType(type, SignatureKind.Call);
  return signatures[0] ?? null;
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
  const forwarded = new Set<string>();
  let forwardedCount = 0;

  for (const property of checker.getPropertiesOfType(propsType)) {
    // A prop with no declaration at all is synthesised by `VariantProps` over a library
    // `tv` recipe: there is no declaration site to hang JSDoc on, so its printed union
    // is the documentation and the JSDoc gate does not apply.
    const isRecipeAxis = property.declarations.length === 0;
    if (!isRecipeAxis && !isOwnProp(property)) {
      forwardedCount += 1;
      for (const declaration of property.declarations) {
        const packageName = declaringPackage(declaration.path);
        if (packageName !== null) {
          forwarded.add(packageName);
        }
      }
      continue;
    }
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
    forwardedFrom: [...forwarded].sort((left, right) => left.localeCompare(right)),
    forwardedCount,
  };
}

export type ComponentApiRequest = {
  /** Absolute path of the public entry module, e.g. `packages/ui/src/button.ts`. */
  entryFile: string;
  /** Name the entry exports, e.g. `Button` or `Dialog`. */
  exportName: string;
};

/**
 * Resolves one component's public surface: a single part for a plain component, or one
 * part per member for a namespace compound (`Dialog.Root`, `Dialog.Content`, …).
 */
export function describeComponentApi(
  context: LibraryProject,
  request: ComponentApiRequest,
  problems: ProblemLog
): readonly ApiPart[] {
  const { checker, program } = context;
  const sourceFile = program.getSourceFile(request.entryFile);
  if (sourceFile === undefined) {
    problems.add(`${request.entryFile}: entry module is not part of the library program`);
    return [];
  }
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    problems.add(`${request.entryFile}: entry module has no module symbol`);
    return [];
  }
  const rootSymbol = checker
    .getExportsOfModule(moduleSymbol)
    .find((exported) => exported.name === request.exportName);
  if (rootSymbol === undefined) {
    problems.add(`${request.entryFile}: does not export "${request.exportName}"`);
    return [];
  }
  const rootType = checker.getTypeOfSymbol(rootSymbol);
  if (rootType === undefined || rootType.isErrorType()) {
    problems.add(`${request.exportName}: exported value has an unresolvable type`);
    return [];
  }

  if (callSignature(checker, rootType) !== null) {
    const part = describePart(context, { name: request.exportName, type: rootType }, problems);
    return part === null ? [] : [part];
  }

  const parts: ApiPart[] = [];
  for (const member of checker.getPropertiesOfType(rootType)) {
    const memberType = checker.getTypeOfSymbol(member);
    if (memberType === undefined || callSignature(checker, memberType) === null) {
      continue;
    }
    const part = describePart(
      context,
      { name: `${request.exportName}.${member.name}`, type: memberType },
      problems
    );
    if (part !== null) {
      parts.push(part);
    }
  }
  if (parts.length === 0) {
    problems.add(`${request.exportName}: no renderable parts were found on the exported namespace`);
  }
  return parts;
}
