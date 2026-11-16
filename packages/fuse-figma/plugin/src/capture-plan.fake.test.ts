/**
 * The fake-file Plan differential of the capture switch. Unit under test: the plugin's Plan over the
 * kit the capture builds, on a fake file the recipe build's kit was applied to. Oracle: Plan over
 * the recipe build's own kit on that file lists nothing, and each line Plan lists for the capture
 * build matches an entry of `oracles/plan.json`, each a follow-on of a difference the per-set
 * oracle files classify.
 */
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import type { FileSystem, Layer } from "effect";

import type { KitBuildError } from "../../src/components/build-errors.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { AliasCycle, InvalidVariableSet, VariableSet } from "../../src/variable-set.ts";
import { createFakeFigma } from "./fake-figma.ts";
import { reconcileKit } from "./reconcile.ts";

/**
 * The spec builder's and the oracle's modules, which the test imports by path, as
 * `kit-fixture.ts` does, so the plugin's type check, whose library predates them, leaves them out.
 */
const SPEC_BUILDER = "../../src/components/build-kit.ts";
const ORACLE = "../../src/capture/oracle.ts";
const TOKEN_SYNC = "../../src/fuse-variable-set.ts";
const NODE_PLATFORM = "@effect/platform-node";

type SpecBuilder = {
  readonly buildKit: (
    registry: undefined,
    engine: "recipe" | "switched"
  ) => Effect.Effect<{ readonly spec: KitSpec }, KitBuildError, FileSystem.FileSystem>;
};
type Oracle = {
  readonly keptPlanOracle: () => Result.Result<unknown, Error>;
  readonly classifyPlan: (
    lines: readonly string[],
    oracle: never
  ) => { readonly lines: readonly string[]; readonly stale: readonly string[] };
};
type TokenSync = {
  readonly fuseVariableSet: () => Result.Result<VariableSet, InvalidVariableSet | AliasCycle>;
};
type NodePlatform = { readonly NodeFileSystem: { readonly layer: Layer.Layer<FileSystem.FileSystem> } };

/** Both builds' kits, built once for the file. */
async function bothKits(): Promise<readonly [KitSpec, KitSpec]> {
  // SAFETY: each path names the module whose exports the type above lists.
  const builder = (await import(SPEC_BUILDER)) as SpecBuilder;
  // SAFETY: as above.
  const platform = (await import(NODE_PLATFORM)) as NodePlatform;
  const [recipe, capture] = await Effect.runPromise(
    Effect.all([builder.buildKit(undefined, "recipe"), builder.buildKit(undefined, "switched")]).pipe(
      Effect.provide(platform.NodeFileSystem.layer)
    )
  );
  return [recipe.spec, capture.spec];
}

describe("Plan of the capture build over the recipe build's file", () => {
  it("lists nothing for the recipe build itself, and only what oracles/plan.json classifies for the capture build", async () => {
    const [recipe, capture] = await bothKits();
    // SAFETY: each path names the module whose exports the type above lists.
    const sync = (await import(TOKEN_SYNC)) as TokenSync;
    // SAFETY: as above.
    const { classifyPlan, keptPlanOracle } = (await import(ORACLE)) as Oracle;
    const variables = sync.fuseVariableSet();
    if (Result.isFailure(variables)) {
      throw variables.failure;
    }
    const file = createFakeFigma({ collections: variables.success.collections, unavailableFonts: [] });
    await reconcileKit(file.figma, recipe, true);
    file.reopen();
    expect((await reconcileKit(file.figma, recipe, false)).changes).toEqual([]);
    const oracle = keptPlanOracle();
    if (Result.isFailure(oracle)) {
      throw oracle.failure;
    }
    const plan = await reconcileKit(file.figma, capture, false);
    // SAFETY: the oracle module parsed this value as its own `PlanOracle`.
    expect(classifyPlan(plan.changes, oracle.success as never)).toEqual({ lines: [], stale: [] });
  });
});
