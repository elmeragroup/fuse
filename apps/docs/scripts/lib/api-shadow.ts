/**
 * Validation-only bridge between the Effect extractor and the docs API model.
 *
 * This module is intentionally not imported by `scripts/generate.ts`: the current
 * generator remains the production writer. A shadow run opens the same project,
 * extracts the same public entry files, adapts the semantic/provenance result, and
 * compares it with the current checker model without writing any artifact.
 */

import { currentSide, effectSide, inputCapturesEqual } from "./api-shadow-adapter.ts";
import type { SideRun } from "./api-shadow-adapter.ts";
import { compareComponent, compareProblems, reviewDifferences } from "./api-shadow-compare.ts";
import { parityDecisions } from "./api-shadow-decisions.ts";
import { docsShadowInventory, protectedBytesEqual, snapshotProtectedBytes } from "./api-shadow-files.ts";
import type { DocsShadowComponentResult, DocsShadowReport, ProtectedBytes } from "./api-shadow-types.ts";

export {
  DOCS_SHADOW_SLUGS,
  type DocsShadowSlug,
  type DocsShadowComponent,
  type ShadowProblem,
  type ApiShadowDifference,
  type ProblemShadowDifference,
  type ShadowPropEvidence,
  type ShadowPartEvidence,
  type ProtectedBytes,
  type DocsShadowComponentResult,
  type ParityDecision,
  type DocsShadowSummary,
  type DocsShadowReport,
} from "./api-shadow-types.ts";
export { docsShadowInventory, snapshotProtectedBytes, protectedBytesEqual } from "./api-shadow-files.ts";
export {
  differenceFingerprint,
  compareParts,
  compareEvidence,
  compareProblems,
  reviewDifferences,
} from "./api-shadow-compare.ts";
export { inputCapturesEqual } from "./api-shadow-adapter.ts";
export { parityDecisions } from "./api-shadow-decisions.ts";

export type DocsShadowRunOptions = {
  /** Test-only side injection used to prove the exception guard preserves failures. */
  readonly currentSide?: (inventory: ReturnType<typeof docsShadowInventory>) => SideRun;
  /** Test-only side injection used to prove the exception guard preserves failures. */
  readonly effectSide?: (inventory: ReturnType<typeof docsShadowInventory>) => Promise<SideRun>;
  /** Test-only observation of both protected-byte snapshots. */
  readonly onProtectedSnapshot?: (phase: "before" | "after", snapshot: ProtectedBytes) => void;
};

/** Runs both extractors over the complete shell inventory without invoking any writer. */
export async function runDocsShadowComparison(options: DocsShadowRunOptions = {}): Promise<DocsShadowReport> {
  const inventory = docsShadowInventory();
  const extractionInputs = inventory.map((entry) => entry.entryFile);
  const protectedBytesBefore = snapshotProtectedBytes();
  let result: Omit<DocsShadowReport, "protectedBytesBefore" | "protectedBytesAfter"> | undefined;
  let protectedBytesAfter: ProtectedBytes | undefined;
  let originalFailure: unknown;
  let hasOriginalFailure = false;
  let afterFailure: Error | undefined;
  try {
    options.onProtectedSnapshot?.("before", protectedBytesBefore);
    const currentRun = (options.currentSide ?? currentSide)(inventory);
    const effectRun = await (options.effectSide ?? effectSide)(inventory);
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
    const reviewed = reviewDifferences(apiDifferences, problemDifferences, parityDecisions);
    const currentPartCount = components.reduce((count, component) => count + component.current.length, 0);
    const effectPartCount = components.reduce((count, component) => count + component.effect.length, 0);
    const currentPropCount = components.reduce(
      (count, component) => count + component.current.reduce((sum, part) => sum + part.props.length, 0),
      0
    );
    const effectPropCount = components.reduce(
      (count, component) => count + component.effect.reduce((sum, part) => sum + part.props.length, 0),
      0
    );
    const currentProblemCount = currentProblems.length;
    const effectProblemCount = effectProblems.length;
    const currentInputs = currentRun.inputs.map((input) => input.entryFile);
    const effectInputs = effectRun.inputs.map((input) => input.entryFile);
    result = {
      inventory,
      extractionInputs,
      currentInputs,
      effectInputs,
      currentInputHashes: currentRun.inputs,
      effectInputHashes: effectRun.inputs,
      components,
      apiDifferences,
      problemDifferences,
      decisions: parityDecisions,
      unexplainedApiDifferences: reviewed.unexplainedApiDifferences,
      unexplainedProblemDifferences: reviewed.unexplainedProblemDifferences,
      summary: {
        componentCount: inventory.length,
        currentPartCount,
        effectPartCount,
        currentPropCount,
        effectPropCount,
        currentProblemCount,
        effectProblemCount,
        apiDifferenceCount: apiDifferences.length,
        problemDifferenceCount: problemDifferences.length,
        reviewedApiDifferenceCount: reviewed.reviewedApiDifferences.length,
        reviewedProblemDifferenceCount: reviewed.reviewedProblemDifferences.length,
        unexplainedApiDifferenceCount: reviewed.unexplainedApiDifferences.length,
        unexplainedProblemDifferenceCount: reviewed.unexplainedProblemDifferences.length,
      },
    };
  } catch (error) {
    hasOriginalFailure = true;
    originalFailure = error;
  } finally {
    try {
      protectedBytesAfter = snapshotProtectedBytes();
      options.onProtectedSnapshot?.("after", protectedBytesAfter);
      if (!protectedBytesEqual(protectedBytesBefore, protectedBytesAfter)) {
        afterFailure = new Error("docs shadow run changed protected generator or generated bytes");
      }
    } catch (snapshotError) {
      // Never hide the extraction/comparison failure that caused the run to abort.
      afterFailure = snapshotError instanceof Error ? snapshotError : new Error(String(snapshotError));
    }
  }
  if (hasOriginalFailure) {
    if (originalFailure instanceof Error) throw originalFailure;
    throw new Error(String(originalFailure));
  }
  if (afterFailure !== undefined) throw afterFailure;
  if (result === undefined) {
    throw new Error("docs shadow run did not produce a report");
  }
  // The successful path always assigns the after snapshot in the finally block.
  if (protectedBytesAfter === undefined) throw new Error("docs shadow run did not take an after snapshot");
  return { ...result, protectedBytesBefore, protectedBytesAfter };
}
