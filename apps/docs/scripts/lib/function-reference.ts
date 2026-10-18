/**
 * The reference of every public function a page documents, such as a hook or a formatter.
 *
 * `@elmeragroup/internal` describes each part through its props parameter, which suits
 * components and says nothing useful about `formatChartValue(value, format, options)`. This pass
 * reads the same library program through TypeScript's API and describes each part whose call
 * signature returns something other than a React element by its signature, its parameters with
 * their `@param` text and its return value with its `@returns` text.
 */

import { SyntaxKind } from "typescript/unstable/ast";
import { API, NodeBuilderFlags, SignatureKind, SymbolFlags } from "typescript/unstable/sync";
import type { Checker, Emitter, Signature, Symbol as TsSymbol, Type } from "typescript/unstable/sync";

import type { ApiFunction } from "../../src/lib/docs-model.ts";
import type { DocsApiComponent } from "./docs-inspection.ts";
import { fuseTsconfig, repoRoot } from "./paths.ts";

/**
 * A return type that makes a call signature a component rather than a function. The printed
 * type is the test, because a component returns a React element or node under several spellings.
 */
const COMPONENT_RETURN = /^(?:ReactElement|ReactNode|ReactPortal|JSX\.Element|Element)\b/u;

function printed(checker: Checker, type: Type | undefined): string {
  return type === undefined
    ? "unknown"
    : checker.typeToString(type, undefined, NodeBuilderFlags.NoTruncation);
}

/**
 * The call signature as one line, printed by the compiler's own declaration printer, so type
 * parameters keep their constraints and defaults, such as
 * `useToastManager<Data extends object = object>(): UseToastManagerReturnValue<Data>`.
 */
function signatureText(
  checker: Checker,
  emitter: Emitter,
  name: string,
  signature: Signature
): string | undefined {
  const declaration = checker.signatureToSignatureDeclaration(
    signature,
    SyntaxKind.FunctionDeclaration,
    undefined,
    NodeBuilderFlags.NoTruncation
  );
  if (declaration === undefined) return undefined;
  return emitter
    .printNode(declaration)
    .replace(/^function\s*/u, name)
    .replace(/;\s*$/u, "")
    .replace(/\s*\n\s*/gu, " ");
}

/** A JSDoc `@param` or `@returns` text without the TSDoc hyphen that leads it. */
function tagText(text: string): string {
  return text
    .replace(/^\s*-\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** JSDoc text with each paragraph on one line, so the HTML and markdown wrap it themselves. */
function paragraphs(text: string): string {
  return text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter((paragraph) => paragraph !== "")
    .join("\n\n");
}

function resolved(checker: Checker, symbol: TsSymbol): TsSymbol {
  return (symbol.flags & SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);
}

/** The part's name and the symbol that declares it, top-level or a namespace member. */
type PartSymbol = { readonly name: string; readonly symbol: TsSymbol };

function partSymbols(checker: Checker, exported: TsSymbol): PartSymbol[] {
  const symbol = resolved(checker, exported);
  const type = checker.getTypeOfSymbol(symbol);
  if (type === undefined) return [];
  if (checker.getSignaturesOfType(type, SignatureKind.Call).length > 0) {
    return [{ name: exported.name, symbol }];
  }
  return checker.getPropertiesOfType(type).map((member) => ({
    name: `${exported.name}.${member.name}`,
    symbol: resolved(checker, member),
  }));
}

/** The function reference of one part, or `undefined` when the part is a component. */
function describeFunction(
  checker: Checker,
  emitter: Emitter,
  part: PartSymbol,
  warnings: string[]
): ApiFunction | undefined {
  const type = checker.getTypeOfSymbol(part.symbol);
  const [signature] = type === undefined ? [] : checker.getSignaturesOfType(type, SignatureKind.Call);
  if (signature === undefined) return undefined;
  const returnType = printed(checker, checker.getReturnTypeOfSignature(signature));
  if (COMPONENT_RETURN.test(returnType)) return undefined;
  // A namespace member's own symbol is the object property, so its function's declaration carries
  // the JSDoc when the property has none.
  const documented =
    checker.getDocumentationCommentOfSymbol(part.symbol).trim() === ""
      ? (type?.getSymbol() ?? part.symbol)
      : part.symbol;
  const tags = checker.getJsDocTagsOfSymbol(documented);
  const description = paragraphs(checker.getDocumentationCommentOfSymbol(documented));
  if (description === "") {
    warnings.push(`${part.name}: public function has no JSDoc description`);
  }
  // A const that aliases another library's function, such as `useFocusable`, carries its own
  // `@param` tags, while the signature's parameters keep the original declaration's empty docs.
  const paramTags = new Map(
    tags
      .filter((tag) => tag.name === "param")
      .map((tag) => /^(\w+)\s+([\s\S]*)$/u.exec(tag.text ?? ""))
      .flatMap((match) => (match?.[1] === undefined ? [] : [[match[1], tagText(match[2] ?? "")] as const]))
  );
  const parameters = signature.getParameters().map((parameter) => {
    const text =
      tagText(checker.getDocumentationCommentOfSymbol(parameter)) || (paramTags.get(parameter.name) ?? "");
    if (text === "") {
      warnings.push(`${part.name}(${parameter.name}): public parameter has no @param description`);
    }
    return {
      name: parameter.name,
      type: printed(checker, checker.getTypeOfSymbol(parameter)),
      optional: (parameter.flags & SymbolFlags.Optional) !== 0,
      description: text,
    };
  });
  const returns = tagText(tags.find((tag) => tag.name === "returns")?.text ?? "");
  const printedSignature = signatureText(checker, emitter, part.name, signature);
  if (printedSignature === undefined) {
    throw new Error(`${part.name}: the compiler printed no declaration for its call signature`);
  }
  return {
    signature: printedSignature,
    description,
    parameters,
    returns: { type: returnType, description: returns },
  };
}

/** Every function part of the pages, and the JSDoc each one lacks. */
export type FunctionReferences = {
  /** Per page slug, its function references keyed by part name. Pages with no function part have no entry. */
  readonly pages: ReadonlyMap<string, ReadonlyMap<string, ApiFunction>>;
  /**
   * Each missing function or `@param` description. The generation pass prints them, as it prints
   * the extractor's accepted warnings, because older hooks predate this reference.
   */
  readonly warnings: readonly string[];
};

/**
 * Describes every function part of the given pages.
 *
 * @param inventory - The pages, with the entry file and the export names each one walks.
 * @returns The function references per page, and the JSDoc they lack.
 */
export function functionReferences(inventory: readonly DocsApiComponent[]): FunctionReferences {
  const api = new API({ cwd: repoRoot });
  try {
    const project = api.updateSnapshot({ openProjects: [fuseTsconfig] }).getProject(fuseTsconfig);
    if (project === undefined) {
      throw new Error(`Could not open the project at ${fuseTsconfig}`);
    }
    const { checker, emitter, program } = project;
    const warnings: string[] = [];
    const pages = new Map<string, ReadonlyMap<string, ApiFunction>>();
    for (const page of inventory) {
      const sourceFile = program.getSourceFile(page.entryFile);
      const moduleSymbol = sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
      if (moduleSymbol === undefined) continue;
      const exports = checker.getExportsOfModule(moduleSymbol);
      const functions = new Map<string, ApiFunction>();
      for (const exportName of page.exportNames) {
        const exported = exports.find((candidate) => candidate.name === exportName);
        for (const part of exported === undefined ? [] : partSymbols(checker, exported)) {
          const described = describeFunction(checker, emitter, part, warnings);
          if (described !== undefined) functions.set(part.name, described);
        }
      }
      if (functions.size > 0) pages.set(page.slug, functions);
    }
    return { pages, warnings };
  } finally {
    api.close();
  }
}
