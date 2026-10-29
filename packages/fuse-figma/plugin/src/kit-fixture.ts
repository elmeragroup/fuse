/**
 * The whole kit on the in-memory file in `fake-figma.ts`, shared by the suites that apply it end
 * to end: the kit `buildKit()` writes, the variables `fuseVariableSet()` syncs, synced and applied
 * files, the kit pages they hold and the sets and icon library on them, and the change lines a run
 * lists as it creates the pages and previews. `test/kit-inventory.ts` names the pages, sets and
 * previews.
 */
import { Effect, Result } from "effect";
import type { FileSystem, Layer } from "effect";

import type { KitBuildError } from "../../src/components/build-errors.ts";
import { walkLayers } from "../../src/components/kit-spec.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { AliasCycle, CollectionSpec, InvalidVariableSet, VariableSet } from "../../src/variable-set.ts";
import { deepFrozen } from "../../test/frozen.ts";
import { ICONS_PAGE, KIT_PAGES, previewsOn } from "../../test/kit-inventory.ts";
import type { InventoryPage } from "../../test/kit-inventory.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { reconcileKit } from "./reconcile.ts";
import type { ReconcileReport } from "./reconcile.ts";

/**
 * The spec builder and the token sync import Node and Fuse modules that the plugin's type check
 * cannot follow, so the fixture loads them by paths the check does not read.
 */
const SPEC_BUILDER = "../../src/components/build-kit.ts";
const TOKEN_SYNC = "../../src/fuse-variable-set.ts";
/** Node's file system for Effect, which the icon library's temporary directory needs. */
const NODE_PLATFORM = "@effect/platform-node";

type SpecBuilder = {
  readonly buildKit: () => Effect.Effect<{ readonly spec: KitSpec }, KitBuildError, FileSystem.FileSystem>;
};
type NodePlatform = { readonly NodeFileSystem: { readonly layer: Layer.Layer<FileSystem.FileSystem> } };
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
  // SAFETY: the path names @effect/platform-node, whose NodeFileSystem.layer provides FileSystem.
  const platform = (await import(NODE_PLATFORM)) as NodePlatform;
  const { spec } = await Effect.runPromise(
    builder.buildKit().pipe(Effect.provide(platform.NodeFileSystem.layer))
  );
  return deepFrozen({ kit: spec, collections: variableSet.success.collections });
}

/**
 * Build the kit and the variable set on the first call, deep frozen. The suites a Vitest worker runs
 * share one module registry (`vitest.config.ts`), so each worker builds them once.
 *
 * @returns The kit and its collections.
 * @throws When the Fuse variable set does not build.
 */
export function kitFixture(): Promise<KitFixture> {
  loaded ??= load();
  return loaded;
}

/**
 * The kit cut down to some of its pages, for a suite whose contract sits on them: those pages, every
 * page that holds a set their instances show, and the icon library's page, with the sets and
 * previews on them. A run of the cut kit plans and applies those pages as the whole kit would.
 *
 * @param kit - The whole kit.
 * @param pageKeys - The pages the suite reads.
 * @returns The cut kit.
 */
export function kitOn(kit: KitSpec, pageKeys: readonly string[]): KitSpec {
  const pageOfSet = new Map(kit.componentSets.map((set) => [set.key, set.page]));
  const pages = new Set([...pageKeys, kit.icons.page]);
  for (let grown = true; grown;) {
    grown = false;
    for (const set of kit.componentSets.filter((candidate) => pages.has(candidate.page))) {
      for (const layer of set.variants.flatMap((variant) => walkLayers(variant.root))) {
        const page = layer.kind === "instance" ? pageOfSet.get(layer.componentSet) : undefined;
        if (page !== undefined && !pages.has(page)) {
          pages.add(page);
          grown = true;
        }
      }
    }
  }
  return {
    ...kit,
    pages: kit.pages.filter((page) => pages.has(page.key)),
    componentSets: kit.componentSets.filter((set) => pages.has(set.page)),
    previews: kit.previews.filter((preview) => pages.has(preview.page)),
  };
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

/** A synced file the plugin applied the kit to, and the report of that Apply. */
export type AppliedKit = {
  /**
   * The file, opened again for the next run. The fixtures hand each call a fork of it, which
   * changes apart from every other.
   */
  readonly file: FakeFigma;
  /** What the Apply that laid the kit out on the synced file reported. */
  readonly applied: ReconcileReport;
};

/**
 * Apply a kit to a file and open the file again for the next run.
 *
 * @param file - A synced file.
 * @param kit - The kit.
 * @returns The file and the Apply's report, deep frozen.
 */
export async function applyTo(file: FakeFigma, kit: KitSpec): Promise<AppliedKit> {
  const report = deepFrozen(await reconcileKit(file.figma, kit, true));
  file.reopen();
  return { file, applied: report };
}

/** A fork of an applied file, with the report of the Apply it copies. */
async function forkOf(base: Promise<AppliedKit>): Promise<AppliedKit> {
  const { file, applied } = await base;
  return { file: file.fork(), applied };
}

/** The applied file every fork copies, which no test reads or changes itself. */
let applied: Promise<AppliedKit> | undefined;

/**
 * Apply the kit to a synced file on the first call, and hand each call a fork of that file, so a
 * Vitest worker applies the kit once for every suite it runs. A fork holds what a freshly applied
 * file holds, which `reconcile.fake.test.ts` cross-checks.
 *
 * @returns The forked file and the Apply's report.
 */
export function appliedKit(): Promise<AppliedKit> {
  applied ??= kitFixture().then(({ kit, collections }) => applyTo(syncedFile(collections), kit));
  return forkOf(applied);
}

/** The applied files of the cut kits, by their page keys. */
const appliedCuts = new Map<string, Promise<AppliedKit>>();

/**
 * Apply the kit cut down to some pages (`kitOn`) to a synced file on the first call for those
 * pages, and hand each call a fork of that file, as `appliedKit()` does for the whole kit.
 *
 * @param pageKeys - The pages the suite reads.
 * @returns The forked file and the Apply's report.
 */
export function appliedKitOn(pageKeys: readonly string[]): Promise<AppliedKit> {
  const key = pageKeys.join(" ");
  const base =
    appliedCuts.get(key) ??
    kitFixture().then(({ kit, collections }) => applyTo(syncedFile(collections), kitOn(kit, pageKeys)));
  appliedCuts.set(key, base);
  return forkOf(base);
}

/**
 * A synced file the plugin applied the kit to, opened again for the next run, as a fork that
 * changes apart from every other.
 *
 * @returns The file.
 */
export async function appliedFile(): Promise<FakeFigma> {
  return (await appliedKit()).file;
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

/**
 * The component set of a name on a page.
 *
 * @param page - The page.
 * @param name - The set's name.
 * @returns The set.
 * @throws When the page holds no set of that name.
 */
export function setOn(page: PageNode, name: string): ComponentSetNode {
  const set = page.children.find(
    (node): node is ComponentSetNode => node.type === "COMPONENT_SET" && node.name === name
  );
  if (set === undefined) {
    throw new Error(`${page.name} has no component set ${name}`);
  }
  return set;
}

/**
 * The component set of a name on the Button page.
 *
 * @param file - The file.
 * @param name - The set's name.
 * @returns The set.
 */
export async function componentSet(file: FakeFigma, name: string): Promise<ComponentSetNode> {
  return setOn(await kitPage(file), name);
}

/**
 * The icon library on the Icons page.
 *
 * @param file - The file.
 * @returns The library's frame.
 */
export async function iconLibrary(file: FakeFigma): Promise<FrameNode> {
  return childNamed(await kitPage(file, ICONS_PAGE.key), "FRAME", "Icons");
}

/**
 * Names as the plugin's change lines list them: `a`, `a and b`, `a, b and c`.
 *
 * @param names - The names.
 * @returns The list.
 */
export function listed(names: readonly string[]): string {
  const last = names.at(-1) ?? "";
  return names.length < 2 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * The names of a page's previews, in frame order.
 *
 * @param page - The page.
 * @returns The names.
 */
export function previewNames(page: InventoryPage): readonly string[] {
  return previewsOn(page).map(({ name }) => name);
}

/** The pages a run creates on a file without them, the component pages first. */
export const CREATE_PAGES = [...KIT_PAGES, ICONS_PAGE].map(
  (page) => `Document: create the page ${page.name}`
);

/** Each page's previews a run creates, then its sets placed in a row with the previews below them. */
export const CREATE_AND_PLACE_PREVIEWS = KIT_PAGES.flatMap((page) => [
  ...previewNames(page).map((name) => `${page.name}: create the preview ${name}`),
  `${page.name}: place ${listed(page.sets.map((set) => set.name))} in a row and stack 4 previews below them`,
]);
