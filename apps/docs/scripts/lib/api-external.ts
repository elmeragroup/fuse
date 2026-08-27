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
import type { DocsApiComponent, ShadowProblem } from "./api-shadow-types.ts";
import { componentPartPropFacts, openLibraryProject, shortTypeOf } from "./api.ts";
import type { CurrentPartPropFact } from "./api.ts";
import { resolveComponentPaths } from "./components.ts";

export type ComponentApiParts = {
  readonly slug: string;
  readonly parts: readonly ApiPart[];
};

type CurrentPropFacts = ReadonlyMap<string, ReadonlyMap<string, ReadonlyMap<string, CurrentPartPropFact>>>;

const ACCEPTED_HYBRID_PROBLEMS = new Set([
  "docs-adapter:missing-description",
  "docs-adapter:partial-compound-export",
  "docs-adapter:unsupported-component-shape",
  "effect-extractor:unsupported-type-fallback",
]);

function problemKey(problem: ShadowProblem): string {
  return `${problem.source}:${problem.code}`;
}

function assertExpectedHybridProblems(results: Awaited<ReturnType<typeof effectSide>>["results"]): void {
  const unexpected = results
    .flatMap((result) => result.problems)
    .filter((problem) => !ACCEPTED_HYBRID_PROBLEMS.has(problemKey(problem)));
  if (unexpected.length > 0) {
    throw new Error(
      `Base UI API enrichment produced unexpected diagnostics:\n${unexpected
        .map((problem) => `${problem.component} ${problemKey(problem)}: ${problem.message}`)
        .join("\n")}`
    );
  }
}

function productionInventory(components: readonly ComponentApiParts[]): readonly DocsApiComponent[] {
  return components.map((component) => {
    const paths = resolveComponentPaths(component.slug);
    return {
      slug: component.slug,
      entryFile: paths.entryFile,
      exportName: paths.exportName,
      exportNames: paths.apiExportNames,
      sourceFile: paths.sourceFile,
    };
  });
}

function currentPropFacts(inventory: readonly DocsApiComponent[]): CurrentPropFacts {
  const context = openLibraryProject();
  try {
    return new Map(
      inventory.map((component) => [
        component.slug,
        componentPartPropFacts(context, {
          entryFile: component.entryFile,
          exportNames: component.exportNames,
        }),
      ])
    );
  } finally {
    context.close();
  }
}

function mergeSelectedProps(
  current: ApiPart,
  extracted: ApiPart | undefined,
  currentProps: ReadonlyMap<string, CurrentPartPropFact>
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
    const fact = currentProps.get(prop.name);
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
 * Inventory and ordering continue to come from the current generator.
 */
export async function includeBaseUiPrimitiveProps(
  components: readonly ComponentApiParts[]
): Promise<ReadonlyMap<string, readonly ApiPart[]>> {
  const inventory = productionInventory(components);
  const currentBySlug = new Map(components.map((component) => [component.slug, component.parts]));
  if (currentBySlug.size !== components.length) {
    throw new Error("Base UI API enrichment received duplicate component slugs");
  }

  const factsBySlug = currentPropFacts(inventory);
  const extracted = await effectSide(inventory, { includeExternalTypes: [BASE_UI_PACKAGE_NAME] });
  assertExpectedHybridProblems(extracted.results);
  return new Map(
    inventory.map((component, index) => {
      const current = currentBySlug.get(component.slug);
      if (current === undefined) throw new Error(`Missing current API parts for ${component.slug}`);
      const factsByPart = factsBySlug.get(component.slug);
      if (factsByPart === undefined) throw new Error(`Missing current prop facts for ${component.slug}`);
      const selectedByName = new Map(
        (extracted.results[index]?.parts ?? []).map((part) => [part.name, part])
      );
      return [
        component.slug,
        current.map((part) => {
          const currentProps = factsByPart.get(part.name);
          if (currentProps === undefined) throw new Error(`Missing current prop facts for ${part.name}`);
          return mergeSelectedProps(part, selectedByName.get(part.name), currentProps);
        }),
      ];
    })
  );
}
