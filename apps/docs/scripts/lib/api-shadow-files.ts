import type { DocsShadowComponent } from "./api-shadow-types.ts";
import { componentInspections } from "./docs-inspection.ts";

/** Reads exactly the route-local component pages consumed by the production generator, in production order. */
export function docsShadowInventory(): readonly DocsShadowComponent[] {
  const seen = new Set<string>();
  return componentInspections().map((inspection) => {
    if (seen.has(inspection.slug)) {
      throw new Error(`docs shadow inventory contains duplicate component "${inspection.slug}"`);
    }
    seen.add(inspection.slug);
    return {
      slug: inspection.slug,
      entryFile: inspection.paths.entryFile,
      exportName: inspection.paths.exportName,
      exportNames: inspection.paths.apiExportNames,
      sourceFile: inspection.paths.sourceFile,
    };
  });
}
