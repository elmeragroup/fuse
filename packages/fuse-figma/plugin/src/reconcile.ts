/**
 * Plan or apply the whole kit. Plan and Apply run the same planning pass, which reads the
 * file and records every write as an operation without making it. Apply then performs the
 * operations in order, so the change list a plan returns is what an apply does. A run that
 * moves nodes between pages is the exception: Apply moves them first and plans the rest again.
 *
 * The run is an Effect. It reads the plugin API, the kit, the file's variables and the glyph font
 * as services, so a test can hand it a fake file, and each phase records into the `Plan` that
 * `runPlan` provides. The structural walk reads the leaf planners' `Run` through `currentRun`, and
 * `Plan.watch` tells it whether a page's planning recorded a write. `reconcileKit` runs the Effect
 * as a promise for callers outside Effect.
 */

import { Effect } from "effect";

import { glyphFonts } from "../../src/components/kit-spec.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import { checkKit } from "./check-kit.ts";
import { planComponentSet } from "./component-set.ts";
import type { PlannedSet } from "./component-set.ts";
import type { PluginError } from "./errors.ts";
import { requireFont } from "./fonts.ts";
import { planIconLibrary } from "./icons.ts";
import { planPages, planRetiredPages } from "./pages.ts";
import type { PlannedPage } from "./pages.ts";
import { changeLines, performPlan, Plan, runPlan } from "./plan.ts";
import type { Target } from "./plan.ts";
import { placePageContents, planPreviews } from "./previews.ts";
import { currentRun, FigmaPlugin, GlyphFont, Kit, runPlugin } from "./services.ts";
import type { PlanServices } from "./services.ts";
import { kitVariablesLayer } from "./variables.ts";

/** What a run changed, or would change, and what it could not represent. */
export type ReconcileReport = {
  readonly changes: readonly string[];
  readonly warnings: readonly string[];
};

/**
 * Open a planning pass: check the kit against itself and the file, and require the fonts every run
 * loads. A glyph range write can run in the plan of a node an operation creates, after the run met
 * its requirements, so the glyph fonts load up front with the kit's own.
 */
const startRun = Effect.fnUntraced(function* (kit: KitSpec) {
  const run = yield* currentRun;
  yield* Effect.fromResult(checkKit(run.figma, run.variables, kit));
  for (const font of [...kit.fonts, ...glyphFonts(kit)]) {
    requireFont(run, "The kit", font);
  }
});

/**
 * Plan every page of the kit.
 *
 * @returns The page to show after an apply: the first page that holds a component set.
 */
const planKit = Effect.fnUntraced(function* (kit: KitSpec) {
  yield* startRun(kit);
  const pages = yield* planPages(kit);
  const changed = new Set<string>();
  // Plans the nodes of one page, and records whether that recorded any operation, which may
  // move or resize what the page layout reads.
  const onPage = <Result>(
    key: string,
    plan: (page: PlannedPage) => Effect.Effect<Result, PluginError, PlanServices>
  ): Effect.Effect<Result, PluginError, PlanServices> =>
    Effect.gen(function* () {
      const page = pages.listed.find((candidate) => candidate.spec.key === key);
      if (page === undefined) {
        throw new Error(`The kit places a node on the page ${key}, which it does not list.`);
      }
      const [result, recorded] = yield* Plan.watch(plan(page));
      if (recorded) {
        changed.add(key);
      }
      return result;
    });

  // The icons come first, because the sets' icon layers and swap properties use them. The sets follow
  // in kit order, which puts each set after the sets whose variants its instance layers show.
  const library = yield* onPage(kit.icons.page, (page) => planIconLibrary(page, kit.icons));
  const sets: PlannedSet[] = [];
  const setsByKey = new Map<string, PlannedSet>();
  for (const spec of kit.componentSets) {
    const set = yield* onPage(spec.page, (page) => planComponentSet(page, spec, library.icons, setsByKey));
    sets.push(set);
    setsByKey.set(spec.key, set);
  }
  const run = yield* currentRun;
  for (const page of pages.listed) {
    const key = page.spec.key;
    const previews = kit.previews.filter((preview) => preview.page === key);
    const frames = yield* onPage(key, (planned) => planPreviews(planned, previews, setsByKey));
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
});

/**
 * Plan or apply the kit on the current file, with its variables and glyph font in scope.
 *
 * @param apply - Whether to write the changes or only list them.
 * @returns The changes and the warnings.
 */
const reconcileFile = Effect.fnUntraced(function* (apply: boolean) {
  const figma = yield* FigmaPlugin;
  const kit = yield* Kit;
  const showPage = (page: Target<PageNode>) => Effect.promise(() => figma.setCurrentPageAsync(page.get()));

  // A node's values resolve through the page it sits on, so a run that moves nodes to another
  // page plans them only once they sit there. Apply makes the page changes first and then plans
  // the rest against the file as moved. Plan lists the page changes alone.
  const pagePhase = yield* runPlan(false, Effect.andThen(startRun(kit), planPages(kit)));
  const { moves } = pagePhase.result;
  if (moves > 0) {
    if (!apply) {
      const land = moves === 1 ? "the move lands" : `the ${moves} moves land`;
      const report: ReconcileReport = {
        changes: [...changeLines(pagePhase.plan), `Document: plan the rest of the kit again once ${land}`],
        warnings: pagePhase.plan.warnings,
      };
      return report;
    }
    yield* performPlan(pagePhase.plan);
    const rest = yield* runPlan(true, planKit(kit));
    yield* showPage(rest.result);
    const report: ReconcileReport = {
      changes: [...changeLines(pagePhase.plan), ...changeLines(rest.plan)],
      warnings: [...pagePhase.plan.warnings, ...rest.plan.warnings],
    };
    return report;
  }

  const { plan, result: page } = yield* runPlan(apply, planKit(kit));
  if (apply) {
    yield* showPage(page);
  }
  const report: ReconcileReport = { changes: changeLines(plan), warnings: plan.warnings };
  return report;
});

/**
 * Plan or apply the kit on the current file. Each run reads the file's variables again, so the
 * Plan that follows an Apply reads what the Apply wrote. The failures a designer can fix, such as
 * a variable the file lacks, arrive as typed errors.
 *
 * @param apply - Whether to write the changes or only list them.
 * @returns The changes and the warnings.
 */
export const reconcile = (apply: boolean) =>
  Effect.gen(function* () {
    const kit = yield* Kit;
    return yield* Effect.provideService(reconcileFile(apply), GlyphFont, kit.glyphFont);
  }).pipe(Effect.provide(kitVariablesLayer));

/**
 * Plan or apply the kit on the current file, as a promise.
 *
 * @param figma - The plugin API.
 * @param kit - The kit the spec builder wrote.
 * @param apply - Whether to write the changes or only list them.
 * @returns The changes and the warnings. The promise rejects with the error that stopped the run.
 */
export function reconcileKit(figma: PluginAPI, kit: KitSpec, apply: boolean): Promise<ReconcileReport> {
  return runPlugin(reconcile(apply), figma, kit);
}
