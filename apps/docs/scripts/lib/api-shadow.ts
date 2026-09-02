/**
 * Validation bridge between the Effect extractor and the docs API model.
 *
 * A shadow run extracts the same public entry files through both the current
 * checker walk and the Effect extractor, adapts both to the docs API model, and
 * compares them. The complete difference set is reviewed once and stored in
 * `test/api-shadow.snapshot.json`; `pnpm run shadow:update` rewrites it after a
 * deliberate change on either side. The run itself writes nothing.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { currentSide, effectSide, inputCapturesEqual } from "./api-effect-adapter.ts";
import type { SideRun } from "./api-effect-adapter.ts";
import { compareComponent, compareProblems } from "./api-shadow-compare.ts";
import { docsShadowInventory } from "./api-shadow-files.ts";
import type {
  ApiShadowDifference,
  DocsShadowComponentResult,
  DocsShadowReport,
  DocsShadowSnapshot,
  ProblemShadowDifference,
} from "./api-shadow-types.ts";
import { openLibraryProject } from "./api.ts";
import type { LibraryProject } from "./api.ts";
import { docsRoot } from "./paths.ts";

export type {
  DocsShadowComponent,
  ShadowProblem,
  ApiShadowDifference,
  ProblemShadowDifference,
  ShadowPropEvidence,
  ShadowPartEvidence,
  DocsShadowComponentResult,
  DocsShadowSnapshot,
  DocsShadowSummary,
  DocsShadowReport,
} from "./api-shadow-types.ts";
export { docsShadowInventory } from "./api-shadow-files.ts";
export {
  compareParts,
  compareEvidence,
  compareProblems,
  reviewAgainstSnapshot,
} from "./api-shadow-compare.ts";
export { inputCapturesEqual } from "./api-effect-adapter.ts";

export const shadowSnapshotFile = path.join(docsRoot, "test/api-shadow.snapshot.json");

export type DocsShadowRunOptions = {
  /** Test-only side injection used to prove a failing side surfaces as the run's failure. */
  readonly currentSide?: (
    inventory: ReturnType<typeof docsShadowInventory>,
    context: LibraryProject
  ) => SideRun;
  /** Test-only side injection used to prove a failing side surfaces as the run's failure. */
  readonly effectSide?: (
    inventory: ReturnType<typeof docsShadowInventory>,
    context: LibraryProject
  ) => Promise<SideRun>;
};

/** Runs both extractors over the complete component inventory without invoking any writer. */
export async function runDocsShadowComparison(options: DocsShadowRunOptions = {}): Promise<DocsShadowReport> {
  const inventory = docsShadowInventory();
  const extractionInputs = inventory.map((entry) => entry.entryFile);
  const context = openLibraryProject();
  let currentRun: SideRun;
  let effectRun: SideRun;
  try {
    currentRun = (options.currentSide ?? currentSide)(inventory, context);
    effectRun = await (options.effectSide ?? effectSide)(inventory, context);
  } finally {
    context.close();
  }
  if (!inputCapturesEqual(currentRun.inputs, effectRun.inputs)) {
    throw new Error("docs shadow current and Effect input captures differ");
  }
  const components: readonly DocsShadowComponentResult[] = inventory.map((entry, index) => ({
    inventory: entry,
    current: currentRun.results[index]?.parts ?? [],
    effect: effectRun.results[index]?.parts ?? [],
    currentProblems: currentRun.results[index]?.problems ?? [],
    effectProblems: effectRun.results[index]?.problems ?? [],
    currentEvidence: currentRun.results[index]?.evidence ?? [],
    effectEvidence: effectRun.results[index]?.evidence ?? [],
  }));
  const apiDifferences = components.flatMap(compareComponent);
  const currentProblems = components.flatMap((entry) => entry.currentProblems);
  const effectProblems = components.flatMap((entry) => entry.effectProblems);
  const problemDifferences = compareProblems(currentProblems, effectProblems);
  const propCount = (parts: readonly { readonly props: readonly unknown[] }[]) =>
    parts.reduce((sum, part) => sum + part.props.length, 0);
  return {
    inventory,
    extractionInputs,
    currentInputs: currentRun.inputs.map((input) => input.entryFile),
    effectInputs: effectRun.inputs.map((input) => input.entryFile),
    currentInputHashes: currentRun.inputs,
    effectInputHashes: effectRun.inputs,
    components,
    apiDifferences,
    problemDifferences,
    summary: {
      componentCount: inventory.length,
      currentPartCount: components.reduce((count, component) => count + component.current.length, 0),
      effectPartCount: components.reduce((count, component) => count + component.effect.length, 0),
      currentPropCount: components.reduce((count, component) => count + propCount(component.current), 0),
      effectPropCount: components.reduce((count, component) => count + propCount(component.effect), 0),
      currentProblemCount: currentProblems.length,
      effectProblemCount: effectProblems.length,
      apiDifferenceCount: apiDifferences.length,
      problemDifferenceCount: problemDifferences.length,
    },
  };
}

/** The snapshot a report would be stored as: differences only, in a stable order. */
export function snapshotOf(report: DocsShadowReport): DocsShadowSnapshot {
  const byKey =
    <T>(select: (value: T) => string) =>
    (left: T, right: T) =>
      select(left).localeCompare(select(right));
  const apiDifferences: readonly ApiShadowDifference[] = [...report.apiDifferences].sort(
    byKey((difference) => `${difference.component}|${difference.path}`)
  );
  const problemDifferences: readonly ProblemShadowDifference[] = [...report.problemDifferences].sort(
    byKey((difference) => `${difference.component}|${difference.key}`)
  );
  return { summary: report.summary, apiDifferences, problemDifferences };
}

export function readShadowSnapshot(file = shadowSnapshotFile): DocsShadowSnapshot {
  // SAFETY: the file is written only by snapshotOf through the update script;
  // reviewAgainstSnapshot compares it field by field against measured values.
  return JSON.parse(readFileSync(file, "utf8")) as DocsShadowSnapshot;
}

export function serializeShadowSnapshot(snapshot: DocsShadowSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
