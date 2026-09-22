/**
 * The sync operations. One compares a Figma file with a variable set, the other brings the
 * file in line. Both read Figma through `FigmaApi` and take the set as an argument, so they
 * work for any set and tests can use a small one.
 */

import { Effect, Schema } from "effect";

import { FigmaApi } from "./figma-api.ts";
import type { FigmaRequestFailed, FileKey } from "./figma-api.ts";
import { places } from "./plural.ts";
import { isInSync, planSync } from "./sync-plan.ts";
import type { PlanConflict, SyncPlan } from "./sync-plan.ts";
import type { VariableSet } from "./variable-set.ts";

/** What a sync found and did. */
export type SyncOutcome = { readonly _tag: "InSync" } | { readonly _tag: "Applied"; readonly plan: SyncPlan };

/**
 * Figma accepted the batch, yet reading the file back still shows differences. Something
 * the sync does not model changed the file, such as a value Figma normalises differently.
 */
export class SyncDidNotConverge extends Schema.TaggedError<SyncDidNotConverge>()("SyncDidNotConverge", {
  message: Schema.String,
  remainingChanges: Schema.Number,
}) {}

/**
 * Plan the changes that would make the file match the set, without writing anything.
 *
 * @param fileKey - The file to compare.
 * @param desired - The variables the file should hold.
 * @returns The plan; an empty plan means the file already matches.
 */
export const planFileSync = Effect.fn("TokenSync.plan")(function* (fileKey: FileKey, desired: VariableSet) {
  const figma = yield* FigmaApi;
  const file = yield* figma.readVariables(fileKey);
  return yield* Effect.fromResult(planSync(desired, file));
});

/**
 * Bring the file in line with the set. The sync reads the file back afterwards and fails
 * unless it now matches, so success means the file was verified, not only that Figma
 * accepted the request.
 *
 * @param fileKey - The file to update.
 * @param desired - The variables the file should hold.
 * @returns Whether the file already matched, or the plan the sync applied.
 */
export const syncFile = Effect.fn("TokenSync.sync")(function* (
  fileKey: FileKey,
  desired: VariableSet
): Effect.fn.Return<SyncOutcome, FigmaRequestFailed | PlanConflict | SyncDidNotConverge, FigmaApi> {
  const plan = yield* planFileSync(fileKey, desired);
  yield* Effect.annotateCurrentSpan({ fileKey, changes: plan.changes.length });
  if (isInSync(plan)) {
    return { _tag: "InSync" };
  }

  const figma = yield* FigmaApi;
  yield* figma.writeVariables(fileKey, plan.batch);
  const remaining = yield* planFileSync(fileKey, desired);
  if (!isInSync(remaining)) {
    return yield* new SyncDidNotConverge({
      message: `Figma accepted the update, but the file still differs from the tokens in ${places(remaining.changes.length)}. Run \`check\` to see them.`,
      remainingChanges: remaining.changes.length,
    });
  }
  return { _tag: "Applied", plan };
});
