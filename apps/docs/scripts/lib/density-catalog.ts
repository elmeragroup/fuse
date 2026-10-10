/**
 * The density section of the tokens handbook page, built from the resolved catalog: each density
 * role with the metrics it reads, in px per density, and the parts that declare it. The page reads
 * this generated module, so its values cannot drift from `fuse.css` or `PART_DENSITY`.
 */

import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import type { DensityCatalogRole } from "../../src/lib/docs-model.ts";

/**
 * Every density role in `DENSITY_ROLES` order, with its metrics in `fuse.css` order and its parts
 * in `PART_DENSITY` order.
 *
 * @param catalog - The resolved theme catalog.
 * @returns One entry per role.
 */
export function buildDensityCatalog(catalog: ResolvedThemeCatalog): readonly DensityCatalogRole[] {
  const { roles, parts } = catalog.partDensity;
  return roles.map((role) => ({
    role,
    metrics: catalog.density
      .filter((metric) => metric.role === role)
      .map(({ name, px }) => ({ name, dense: px.dense, comfortable: px.comfortable })),
    parts: Object.entries(parts)
      .filter(([, partRole]) => partRole === role)
      .map(([part]) => part),
  }));
}

/** The generated module the tokens handbook page imports. */
export function renderDensityCatalog(roles: readonly DensityCatalogRole[]): string {
  return `import type { DensityCatalogRole } from "../lib/docs-model";

/** Every density role, the metrics it reads in px per density, and the parts that declare it. */
export const DENSITY_CATALOG: readonly DensityCatalogRole[] = ${JSON.stringify(roles, null, 2)};
`;
}
