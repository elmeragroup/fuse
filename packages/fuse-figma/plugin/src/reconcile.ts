/**
 * Plan or apply the whole kit. Plan and Apply run the same planning pass, which reads the
 * file and records every write as an operation without making it. Apply then performs the
 * operations in order, so the change list a plan returns is what an apply does.
 *
 * The run takes the plugin API as an argument rather than reading the `figma` global, so a
 * test can hand it a fake file.
 */

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { checkKit, kitCollections } from "./check-kit.ts";
import { requireNewSetFonts } from "./child-layers.ts";
import { planComponentSet } from "./component-set.ts";
import type { PlannedSet } from "./component-set.ts";
import { requireFont } from "./fields.ts";
import type { Run } from "./fields.ts";
import { planIconLibrary } from "./icons.ts";
import { findOwned, setKey, staleOwned } from "./identity.ts";
import { change, changeLines, create, existing, runPlan } from "./plan.ts";
import type { Target } from "./plan.ts";
import { placePageContents, planPreviews } from "./previews.ts";
import { loadKitVariables } from "./variables.ts";

/** What a run changed, or would change, and what it could not represent. */
export type ReconcileReport = {
  readonly changes: readonly string[];
  readonly warnings: readonly string[];
};

const isPage = (node: BaseNode): node is PageNode => node.type === "PAGE";

async function planPage(run: Run, kit: KitSpec, page: PageNode): Promise<void> {
  const start = run.plan.operations.length;
  const keep = new Set([
    kit.icons.key,
    ...kit.componentSets.map((set) => set.key),
    ...kit.previews.map((preview) => preview.key),
  ]);
  for (const stale of staleOwned(page.children, keep)) {
    change(run.plan, page.name, `delete ${stale.name}`, () => stale.remove());
  }
  // The icons come first, because the sets' icon layers and swap properties use them.
  const library = await planIconLibrary(run, page, kit.icons);
  const sets: PlannedSet[] = [];
  for (const spec of kit.componentSets) {
    sets.push(await planComponentSet(run, page, spec, library.icons));
  }
  const frames = await planPreviews(run, page, kit.previews, new Map(sets.map((set) => [set.spec.key, set])));
  placePageContents(run, page, sets, library.frame, frames, run.plan.operations.length > start);
}

async function planDocument(run: Run, kit: KitSpec): Promise<Target<PageNode>> {
  const document = "Document";
  const found = findOwned(run.plan, run.figma.root.children, document, kit.page.key, kit.page.name, isPage);
  if (found !== undefined) {
    await found.loadAsync();
    await planPage(run, kit, found);
    return existing(found);
  }
  // The new page pins no modes, and its sets plan their contents only when the page's
  // operation runs, so the pass requires their label fonts here.
  for (const set of kit.componentSets) {
    await requireNewSetFonts(run, {}, set);
  }
  const sets = kit.componentSets.map((set) => set.name).join(", ");
  return create(
    run.plan,
    document,
    `create the page ${kit.page.name} with ${sets} and ${kit.previews.length} previews`,
    () => {
      const made = run.figma.createPage();
      made.name = kit.page.name;
      setKey(made, kit.page.key);
      return made;
    },
    async (made, plan) => {
      await made.loadAsync();
      await planPage({ ...run, plan }, kit, made);
    }
  );
}

/**
 * Plan or apply the kit on the current file.
 *
 * @param figma - The plugin API.
 * @param kit - The kit the spec builder wrote.
 * @param apply - Whether to write the changes or only list them.
 * @returns The changes and the warnings.
 */
export async function reconcileKit(figma: PluginAPI, kit: KitSpec, apply: boolean): Promise<ReconcileReport> {
  const variables = await loadKitVariables(figma, kitCollections(kit));
  const { plan, result: page } = await runPlan(apply, (plan) => {
    const run: Run = { figma, variables, plan };
    checkKit(variables, kit);
    for (const font of kit.fonts) {
      requireFont(run, kit.page.name, font);
    }
    return planDocument(run, kit);
  });
  if (apply) {
    await figma.setCurrentPageAsync(page.get());
  }
  return { changes: changeLines(plan), warnings: plan.warnings };
}
