/**
 * The modules the docs generation pass writes for the theme studio. `registration.ts` loads this
 * module on call, because it runs in Node only and client modules import the registration.
 */

import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import type { TokenRef } from "../../lib/docs-model.ts";
import { buildStudioSeeds, renderStudioSeed, renderStudioSeedIndex } from "./seeds.ts";
import { buildSlotTokenIndex, recipeModules, renderSlotTokenIndex } from "./slot-tokens.ts";

/** What the studio's modules are generated from. */
export type StudioGeneratorInput = {
  readonly catalog: ResolvedThemeCatalog;
  /** Every documented component: its slug, its directory and the tokens its recipe reads. */
  readonly components: readonly {
    readonly slug: string;
    readonly dir: string;
    readonly tokens: readonly TokenRef[];
  }[];
};

/** One generated module, at its path under `src/generated`, without the generated banner. */
export type StudioGeneratedFile = { readonly file: string; readonly source: string };

/**
 * Every density metric's name in `fuse.css` order, which groups the metrics by family rather
 * than by role: label text comes before the surface metrics.
 */
function renderMetricOrder(catalog: ResolvedThemeCatalog): string {
  const order = catalog.density.map(({ name }) => name);
  return `/** Every density metric's name in \`fuse.css\` order. */
export const DENSITY_METRIC_ORDER: readonly string[] = ${JSON.stringify(order, null, 2)};
`;
}

/**
 * The studio's generated modules:
 *
 * - one seed module per theme, behind a loader of dynamic imports, so the studio's first load
 *   carries none of them and each theme loads when the studio shows it;
 * - the slot-to-tokens index, each slot's component and the tokens its recipe reads, kept small
 *   for the selection inspector's client;
 * - the density metric order its knobs and CSS export follow.
 */
export function studioGeneratedFiles({ catalog, components }: StudioGeneratorInput): StudioGeneratedFile[] {
  const seeds = buildStudioSeeds(catalog);
  const index = buildSlotTokenIndex(
    components.map(({ slug, dir, tokens }) => ({ slug, dir, modules: recipeModules(dir), tokens }))
  );
  return [
    ...seeds.map((seed) => ({ file: `studio-seeds/${seed.slug}.ts`, source: renderStudioSeed(seed) })),
    { file: "studio-seeds.ts", source: renderStudioSeedIndex(catalog, seeds) },
    { file: "studio-slot-tokens.ts", source: renderSlotTokenIndex(index) },
    { file: "studio-density.ts", source: renderMetricOrder(catalog) },
  ];
}
