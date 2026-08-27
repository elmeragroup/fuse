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
import { effectSide } from "./api-shadow-adapter.ts";
import { docsShadowInventory } from "./api-shadow-files.ts";

export type ComponentApiParts = {
  readonly slug: string;
  readonly parts: readonly ApiPart[];
};

function mergeSelectedProps(current: ApiPart, extracted: ApiPart | undefined): ApiPart {
  if (extracted === undefined) return current;
  const currentNames = new Set(current.props.map((prop) => prop.name));
  const selected = extracted.props.filter(
    (prop) =>
      dependencyPackageName(prop.origin) === BASE_UI_PACKAGE_NAME &&
      prop.description !== "" &&
      !currentNames.has(prop.name)
  );
  if (selected.length === 0) return current;
  return {
    ...current,
    props: [...current.props, ...selected],
    forwardedCount: Math.max(0, current.forwardedCount - selected.length),
  };
}

/**
 * Returns production parts keyed by slug, enriched only with Base UI-owned props.
 * Inventory and ordering continue to come from the current generator.
 */
export async function includeBaseUiPrimitiveProps(
  components: readonly ComponentApiParts[]
): Promise<ReadonlyMap<string, readonly ApiPart[]>> {
  const inventory = docsShadowInventory();
  const currentBySlug = new Map(components.map((component) => [component.slug, component.parts]));
  if (
    currentBySlug.size !== inventory.length ||
    inventory.some((component) => !currentBySlug.has(component.slug))
  ) {
    throw new Error("Base UI API enrichment requires the complete component-page inventory");
  }

  const extracted = await effectSide(inventory, { includeExternalTypes: [BASE_UI_PACKAGE_NAME] });
  return new Map(
    inventory.map((component, index) => {
      const current = currentBySlug.get(component.slug);
      if (current === undefined) throw new Error(`Missing current API parts for ${component.slug}`);
      const selectedByName = new Map(
        (extracted.results[index]?.parts ?? []).map((part) => [part.name, part])
      );
      return [component.slug, current.map((part) => mergeSelectedProps(part, selectedByName.get(part.name)))];
    })
  );
}
