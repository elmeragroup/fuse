import type { ESTree } from "@oxlint/plugins";

import { moduleExportName } from "./ast-names.ts";

/** The local names a module binds to Base UI's exports, from the package root or any subpath. */
export type BaseUiBindings = {
  /** Each named value import's local name, mapped to the export it names (`D` → `Dialog`). */
  readonly named: Map<string, string>;
  /** Each namespace import's local name (`import * as Base from "@base-ui/react"`). */
  readonly namespaces: Set<string>;
};

/** An empty set of bindings, filled by {@link noteBaseUiImport}. */
export function baseUiBindings(): BaseUiBindings {
  return { named: new Map(), namespaces: new Set() };
}

/**
 * Records the value bindings an import declaration takes from Base UI. Every entry, the package
 * root `@base-ui/react` and each subpath such as `@base-ui/react/dialog`, exports a part under the
 * same name, so a named import is matched by the export it names, under any alias.
 *
 * @param declaration - The import declaration.
 * @param bindings - The module's bindings so far.
 * @param kinds - Whether type-only imports bind too, for a rule that reads type positions.
 */
export function noteBaseUiImport(
  declaration: ESTree.ImportDeclaration,
  bindings: BaseUiBindings,
  kinds: "values" | "values-and-types" = "values"
): void {
  const source = declaration.source.value;
  const values = kinds === "values";
  if (values && declaration.importKind === "type") return;
  if (source !== "@base-ui/react" && !source.startsWith("@base-ui/react/")) return;
  for (const specifier of declaration.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      bindings.namespaces.add(specifier.local.name);
    } else if (specifier.type === "ImportSpecifier" && !(values && specifier.importKind === "type")) {
      bindings.named.set(specifier.local.name, moduleExportName(specifier.imported));
    }
  }
}

/** A Base UI part a name reaches: the export it reads and the member of that export, if any. */
export type BaseUiReference = { readonly exported: string; readonly member: string | undefined };

/**
 * Resolves a dotted name, given as its segments, to the Base UI export it reads: `Local`,
 * `Local.Member`, `Namespace.Export` or `Namespace.Export.Member`.
 *
 * @param segments - The name's identifiers, outermost first.
 * @param bindings - The module's Base UI bindings.
 * @returns The export and member, or `undefined` for a name that reads no Base UI export.
 */
export function baseUiReference(
  segments: readonly string[],
  bindings: BaseUiBindings
): BaseUiReference | undefined {
  const [head, second, third] = segments;
  if (head === undefined) return undefined;
  const named = bindings.named.get(head);
  if (named !== undefined && segments.length <= 2) return { exported: named, member: second };
  if (bindings.namespaces.has(head) && second !== undefined && segments.length <= 3) {
    return { exported: second, member: third };
  }
  return undefined;
}
