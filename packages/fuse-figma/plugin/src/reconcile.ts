/**
 * Plan or apply the whole kit. Plan and Apply run the same planning pass, which reads the
 * file and records every write as an operation without making it. Apply then performs the
 * operations in order, so the change list a plan returns is what an apply does. A run that
 * moves nodes between pages is the exception: Apply moves them first and plans the rest again.
 *
 * The run takes the plugin API as an argument rather than reading the `figma` global, so a
 * test can hand it a fake file.
 */

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { checkKit, kitCollections } from "./check-kit.ts";
import { planComponentSet } from "./component-set.ts";
import type { PlannedSet } from "./component-set.ts";
import { requireFont } from "./fields.ts";
import type { Run } from "./fields.ts";
import { planIconLibrary } from "./icons.ts";
import { planPages, planRetiredPages } from "./pages.ts";
import type { PlannedPage } from "./pages.ts";
import { changeLines, performPlan, runPlan } from "./plan.ts";
import type { Plan, Target } from "./plan.ts";
import { placePageContents, planPreviews } from "./previews.ts";
import { loadKitVariables } from "./variables.ts";

/** What a run changed, or would change, and what it could not represent. */
export type ReconcileReport = {
  readonly changes: readonly string[];
  readonly warnings: readonly string[];
};

/**
 * Plan every page of the kit.
 *
 * @returns The page to show after an apply: the first page that holds a component set.
 */
async function planKit(run: Run, kit: KitSpec): Promise<Target<PageNode>> {
  const pages = await planPages(run, kit);
  const changed = new Set<string>();
  // Plans the nodes of one page, and records whether that recorded any operation, which may
  // move or resize what the page layout reads.
  const onPage = async <Result>(
    key: string,
    plan: (page: PlannedPage) => Promise<Result>
  ): Promise<Result> => {
    const page = pages.listed.find((candidate) => candidate.spec.key === key);
    if (page === undefined) {
      throw new Error(`The kit places a node on the page ${key}, which it does not list.`);
    }
    const start = run.plan.operations.length;
    const result = await plan(page);
    if (run.plan.operations.length > start) {
      changed.add(key);
    }
    return result;
  };

  // The icons come first, because the sets' icon layers and swap properties use them. The sets follow
  // in kit order, which puts each set after the sets whose variants its instance layers show.
  const library = await onPage(kit.icons.page, (page) => planIconLibrary(run, page, kit.icons));
  const sets: PlannedSet[] = [];
  const setsByKey = new Map<string, PlannedSet>();
  for (const spec of kit.componentSets) {
    const set = await onPage(spec.page, (page) =>
      planComponentSet(run, page, spec, library.icons, setsByKey)
    );
    sets.push(set);
    setsByKey.set(spec.key, set);
  }
  for (const page of pages.listed) {
    const key = page.spec.key;
    const previews = kit.previews.filter((preview) => preview.page === key);
    const frames = await onPage(key, (planned) => planPreviews(run, planned, previews, setsByKey));
    const row = [
      ...sets.filter((set) => set.spec.page === key).map((set) => ({ name: set.spec.name, node: set.node })),
      ...(kit.icons.page === key ? [{ name: kit.icons.name, node: library.frame }] : []),
    ];
    placePageContents(run, page, row, frames, changed.has(key));
  }

  const first =
    pages.listed.find((page) => kit.componentSets.some((set) => set.page === page.spec.key)) ??
    pages.listed[0];
  if (first === undefined) {
    throw new Error("The kit lists no page.");
  }
  planRetiredPages(run, pages.retired, first.node);
  return first.node;
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
  const startRun = (plan: Plan): Run => {
    const run: Run = { figma, variables, plan };
    checkKit(figma, variables, kit);
    for (const font of kit.fonts) {
      requireFont(run, "The kit", font);
    }
    return run;
  };

  // A node's values resolve through the page it sits on, so a run that moves nodes to another
  // page plans them only once they sit there. Apply makes the page changes first and then plans
  // the rest against the file as moved. Plan lists the page changes alone.
  const pagePhase = await runPlan(false, (plan) => planPages(startRun(plan), kit));
  const { moves } = pagePhase.result;
  if (moves > 0) {
    if (!apply) {
      const land = moves === 1 ? "the move lands" : `the ${moves} moves land`;
      return {
        changes: [...changeLines(pagePhase.plan), `Document: plan the rest of the kit again once ${land}`],
        warnings: pagePhase.plan.warnings,
      };
    }
    await performPlan(pagePhase.plan);
    const rest = await runPlan(true, (plan) => planKit(startRun(plan), kit));
    await figma.setCurrentPageAsync(rest.result.get());
    return {
      changes: [...changeLines(pagePhase.plan), ...changeLines(rest.plan)],
      warnings: [...pagePhase.plan.warnings, ...rest.plan.warnings],
    };
  }

  const { plan, result: page } = await runPlan(apply, (plan) => planKit(startRun(plan), kit));
  if (apply) {
    await figma.setCurrentPageAsync(page.get());
  }
  return { changes: changeLines(plan), warnings: plan.warnings };
}
