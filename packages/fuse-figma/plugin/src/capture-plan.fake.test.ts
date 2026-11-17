/**
 * The fake-file round trip of the kit the capture builds. Unit under test: the plugin's Apply and
 * Plan over that kit. Oracle: Apply writes the whole kit, so a Plan of the same kit on the file it
 * wrote lists nothing; a line it lists is a field Apply does not write or Plan reads back otherwise.
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
 * The spec builder's modules, which the test imports by path, as `kit-fixture.ts` does, so the
 * plugin's type check, whose library predates them, leaves them out.
 */
const SPEC_BUILDER = "../../src/components/build-kit.ts";
const TOKEN_SYNC = "../../src/fuse-variable-set.ts";
const NODE_PLATFORM = "@effect/platform-node";

type SpecBuilder = {
  readonly buildKit: () => Effect.Effect<{ readonly spec: KitSpec }, KitBuildError, FileSystem.FileSystem>;
};
type TokenSync = {
  readonly fuseVariableSet: () => Result.Result<VariableSet, InvalidVariableSet | AliasCycle>;
};
type NodePlatform = { readonly NodeFileSystem: { readonly layer: Layer.Layer<FileSystem.FileSystem> } };

describe("Plan of the capture build over the file its Apply wrote", () => {
  it("lists nothing", async () => {
    // SAFETY: each path names the module whose exports the type above lists.
    const builder = (await import(SPEC_BUILDER)) as SpecBuilder;
    // SAFETY: as above.
    const platform = (await import(NODE_PLATFORM)) as NodePlatform;
    // SAFETY: as above.
    const sync = (await import(TOKEN_SYNC)) as TokenSync;
    const { spec } = await Effect.runPromise(
      builder.buildKit().pipe(Effect.provide(platform.NodeFileSystem.layer))
    );
    const variables = sync.fuseVariableSet();
    if (Result.isFailure(variables)) {
      throw variables.failure;
    }
    const file = createFakeFigma({ collections: variables.success.collections, unavailableFonts: [] });
    await reconcileKit(file.figma, spec, true);
    file.reopen();
    expect((await reconcileKit(file.figma, spec, false)).changes).toEqual([]);
  });
});
