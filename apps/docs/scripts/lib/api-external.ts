/**
 * Selective dependency enrichment for the production API artifacts.
 *
 * The current checker walk remains authoritative for part discovery and library-owned
 * props. The Effect extractor contributes only props whose declaration provenance belongs
 * to the explicitly selected dependency. This keeps the production inventory intact while
 * making the package-selection boundary observable in every generated consumer.
 */

import type { ApiPart } from "../../src/lib/docs-model.ts";
import { BASE_UI_PACKAGE_NAME, dependencyPackageName } from "../../src/lib/docs-model.ts";
import { effectSide } from "./api-effect-adapter.ts";
import { assertKnownBaseUiDiagnostics } from "./api-external-diagnostics.ts";
import type { DocsApiComponent } from "./api-shadow-types.ts";
import { readPartPropFact, shortTypeOf } from "./api.ts";
import type { ComponentApi, LibraryPartApi, LibraryProject } from "./api.ts";

function mergeSelectedProps(
  context: LibraryProject,
  current: ApiPart,
  extracted: ApiPart | undefined,
  currentPart: LibraryPartApi
): ApiPart {
  if (extracted === undefined) return current;
  const currentNames = new Set(current.props.map((prop) => prop.name));
  const selected = extracted.props.flatMap((prop) => {
    if (
      dependencyPackageName(prop.origin) !== BASE_UI_PACKAGE_NAME ||
      prop.description === "" ||
      currentNames.has(prop.name)
    ) {
      return [];
    }
    const fact = readPartPropFact(context, currentPart, prop.name);
    if (fact === undefined) return [];
    if (fact.type === null) {
      throw new Error(`${current.name}.${prop.name}: selected Base UI prop has an unresolvable type`);
    }
    return [
      { ...prop, type: fact.type, shortType: shortTypeOf(prop.name, fact.type), required: fact.required },
    ];
  });
  if (selected.length === 0) return current;
  if (selected.length > current.forwardedCount) {
    throw new Error(
      `${current.name}: selected ${String(selected.length)} Base UI props from ${String(current.forwardedCount)} forwarded props`
    );
  }
  return {
    ...current,
    props: [...current.props, ...selected],
    forwardedCount: current.forwardedCount - selected.length,
  };
}

/**
 * Returns production parts keyed by slug, enriched only with Base UI-owned props.
 * Inventory and ordering continue to come from the model `extractLibraryApi` yields.
 */
export async function includeBaseUiPrimitiveProps(
  inventory: readonly DocsApiComponent[],
  model: readonly ComponentApi[],
  context: LibraryProject
): Promise<ReadonlyMap<string, readonly ApiPart[]>> {
  const modelBySlug = new Map(model.map((component) => [component.slug, component]));
  if (modelBySlug.size !== model.length) {
    throw new Error("Base UI API enrichment received duplicate component slugs");
  }

  const extracted = await effectSide(inventory, model, { includeExternalTypes: [BASE_UI_PACKAGE_NAME] });
  assertKnownBaseUiDiagnostics(extracted.results.flatMap((result) => result.problems));
  return new Map(
    inventory.map((component, index) => {
      const current = modelBySlug.get(component.slug);
      if (current === undefined) throw new Error(`Missing current API parts for ${component.slug}`);
      const partApiByName = new Map(current.partApis.map((part) => [part.name, part]));
      const selectedByName = new Map(
        (extracted.results[index]?.parts ?? []).map((part) => [part.name, part])
      );
      return [
        component.slug,
        current.parts.map((part) => {
          const currentPart = partApiByName.get(part.name);
          if (currentPart === undefined) throw new Error(`Missing current prop facts for ${part.name}`);
          return mergeSelectedProps(context, part, selectedByName.get(part.name), currentPart);
        }),
      ];
    })
  );
}
