/**
 * The kit a test run builds once, before its workers start (`kit-setup.ts`), and the readers the
 * suites take it from: the full kit here, the component sets in `test/built-kit.ts`, and the
 * applied fake file in `plugin/src/kit-fixture.ts`.
 */
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Result } from "effect";
import { readFileSync } from "node:fs";
import { deserialize } from "node:v8";
import { inject } from "vitest";

import { buildKit } from "../../src/components/build-kit.ts";
import type { BuiltKit } from "../../src/components/build-kit.ts";
import type { CoverageRow } from "../../src/components/coverage.ts";
import type { KitSpec } from "../../src/components/kit-spec.ts";
import { fuseVariableSet } from "../../src/fuse-variable-set.ts";
import type { CollectionSpec } from "../../src/variable-set.ts";
import { deepFrozen } from "./frozen.ts";

/** What the setup builds: the whole kit, its coverage, its drawn parts and the synced collections it binds. */
export type CachedKit = {
  readonly kit: KitSpec;
  readonly coverage: readonly CoverageRow[];
  readonly drawn: BuiltKit["drawn"];
  readonly collections: readonly CollectionSpec[];
};

/** The whole kit and the synced collections it binds. */
export type FullKit = Pick<CachedKit, "kit" | "collections">;

declare module "vitest" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest types `provide`/`inject` by interface declaration merging; a type alias cannot augment.
  interface ProvidedContext {
    /**
     * The file that holds the run's {@link CachedKit}, serialized with `node:v8`. Absent when the
     * setup did not build the kit, so each worker builds its own.
     */
    readonly fuseFigmaKit?: string;
  }
}

let cached: { readonly path: string; readonly kit: CachedKit } | undefined;

/**
 * The kit the run's setup built, read on the first call and deep frozen. The setup hands workers
 * a path rather than the kit, because Vitest sends the provided context with every test file, and
 * the kit is about 8 MB.
 *
 * @returns The kit, or `undefined` when the setup did not build it.
 */
export function injectedKit(): CachedKit | undefined {
  const path = inject("fuseFigmaKit");
  if (path === undefined) {
    return undefined;
  }
  if (cached?.path !== path) {
    // SAFETY: `kit-setup.ts` writes this file with `serialize` from a `CachedKit` and no other
    // code writes it. `node:v8` keeps maps, sets, typed arrays and `undefined` fields.
    const kit = deserialize(readFileSync(path)) as CachedKit;
    cached = { path, kit: deepFrozen(kit) };
  }
  return cached.kit;
}

/**
 * Build the kit, its coverage and the synced collections it binds. The setup calls it once for a
 * run, and `fullKit()` calls it in each worker when the setup built nothing.
 *
 * @returns The kit.
 * @throws When the Fuse variable set or the kit does not build.
 */
export async function buildCachedKit(): Promise<CachedKit> {
  const variableSet = fuseVariableSet();
  if (Result.isFailure(variableSet)) {
    throw new Error("the Fuse variable set does not build", { cause: variableSet.failure });
  }
  const { spec, coverage, drawn } = await Effect.runPromise(
    buildKit().pipe(Effect.provide(NodeFileSystem.layer))
  );
  return { kit: spec, coverage, drawn, collections: variableSet.success.collections };
}

async function loadFullKit(): Promise<FullKit> {
  const { kit, collections } = injectedKit() ?? deepFrozen(await buildCachedKit());
  return Object.freeze({ kit, collections });
}

let full: Promise<FullKit> | undefined;

/**
 * The kit `buildKit()` writes and the collections `fuseVariableSet()` syncs, deep frozen: the
 * setup's kit when it built one, otherwise a kit the worker builds on the first call. Every call in
 * a worker returns the same values.
 *
 * @returns The kit and its collections.
 * @throws When the Fuse variable set or the kit does not build.
 */
export function fullKit(): Promise<FullKit> {
  full ??= loadFullKit();
  return full;
}
