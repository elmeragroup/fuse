/**
 * The whole kit on the in-memory file in `fake-figma.ts`, shared by the suites that apply it end
 * to end: the kit `buildKit()` writes, the variables `fuseVariableSet()` syncs, synced and applied
 * files, and the names the kit gives its pages and previews.
 */
import { Result } from "effect";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { AliasCycle, CollectionSpec, InvalidVariableSet, VariableSet } from "../../src/variable-set.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * The spec builder and the token sync import Node and Fuse modules that the plugin's type check
 * cannot follow, so the fixture loads them by paths the check does not read.
 */
const SPEC_BUILDER = "../../src/components/build-kit.ts";
const TOKEN_SYNC = "../../src/fuse-variable-set.ts";

type SpecBuilder = { readonly buildKit: () => Promise<{ readonly spec: KitSpec }> };
type TokenSync = {
  readonly fuseVariableSet: () => Result.Result<VariableSet, InvalidVariableSet | AliasCycle>;
};

/** The kit and the synced variables it binds. */
export type KitFixture = {
  readonly kit: KitSpec;
  readonly collections: readonly CollectionSpec[];
};

let loaded: Promise<KitFixture> | undefined;

async function load(): Promise<KitFixture> {
  // SAFETY: the path names build-kit.ts, whose `buildKit` resolves to the kit and its coverage.
  const builder = (await import(SPEC_BUILDER)) as SpecBuilder;
  // SAFETY: the path names fuse-variable-set.ts, whose `fuseVariableSet` returns the set or why
  // it does not build.
  const sync = (await import(TOKEN_SYNC)) as TokenSync;
  const variableSet = sync.fuseVariableSet();
  if (Result.isFailure(variableSet)) {
    throw new Error(`the Fuse variable set does not build: ${String(variableSet.failure)}`);
  }
  const { spec } = await builder.buildKit();
  return { kit: spec, collections: variableSet.success.collections };
}

/**
 * Build the kit and the variable set on the first call. Vitest gives each test file its own
 * module registry, so each suite builds them once.
 *
 * @returns The kit and its collections.
 * @throws When the Fuse variable set does not build.
 */
export function kitFixture(): Promise<KitFixture> {
  loaded ??= load();
  return loaded;
}

/**
 * A synced file without the kit pages.
 *
 * @param collections - The synced collections.
 * @param unavailableFonts - Fonts the machine cannot load.
 * @returns The file.
 */
export function syncedFile(
  collections: readonly CollectionSpec[],
  unavailableFonts: readonly FontName[] = []
): FakeFigma {
  return createFakeFigma({ collections, unavailableFonts });
}

/**
 * A synced file the plugin applied the kit to, opened again for the next run.
 *
 * @returns The file.
 */
export async function appliedFile(): Promise<FakeFigma> {
  const { kit, collections } = await kitFixture();
  const file = syncedFile(collections);
  await reconcileKit(file.figma, kit, true);
  file.reopen();
  return file;
}

/**
 * The page that carries a kit page key, loaded for reading.
 *
 * @param file - The file.
 * @param key - The page key, the Button page unless given.
 * @returns The page.
 * @throws When the file has no page with the key.
 */
export async function kitPage(file: FakeFigma, key = "page/button"): Promise<PageNode> {
  const page = file.figma.root.children.find((candidate) => keyOf(candidate) === key);
  if (page === undefined) {
    throw new Error(`the file has no page with the key ${key}`);
  }
  await page.loadAsync();
  return page;
}

/** The names of the four Button previews, which pin Fjordkraft private themes. */
export const PREVIEWS: readonly string[] = [
  "Button / Fjordkraft internal private, light",
  "Button / Fjordkraft internal private, dark",
  "Button / Fjordkraft external private, light",
  "Button / Fjordkraft external private, dark",
];

/**
 * The names of the four previews on a component's page.
 *
 * @param component - The page's name, such as `Toggle`.
 * @returns The preview names, in the order of {@link PREVIEWS}.
 */
export function previewsOf(component: string): readonly string[] {
  return PREVIEWS.map((name) => name.replace("Button", component));
}
