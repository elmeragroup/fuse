/**
 * This module holds the services the plugin's Effect programs depend on, and runs a program over
 * them. `code.ts` provides the `figma` global and the inlined kit, and a test provides a fake file
 * and its own kit, so no program reads a module global.
 */

import { Context, Effect, Layer, Scheduler } from "effect";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import { kitCollections } from "./check-kit.ts";
import type { PluginError } from "./errors.ts";
import { loadKitVariables } from "./variables.ts";
import type { KitVariables } from "./variables.ts";

/** The Figma Plugin API over the open file. */
export class FigmaPlugin extends Context.Service<FigmaPlugin, PluginAPI>()(
  "@elmeragroup/fuse-figma/plugin/FigmaPlugin"
) {}

/** The kit the spec builder wrote. */
export class Kit extends Context.Service<Kit, KitSpec>()("@elmeragroup/fuse-figma/plugin/Kit") {}

/** The file's variables and modes that the kit binds, found by name. */
export class FileVariables extends Context.Service<FileVariables, KitVariables>()(
  "@elmeragroup/fuse-figma/plugin/FileVariables"
) {
  /**
   * Read the collections the kit names from the file. Each build reads the file again, so a run
   * that follows an Apply sees what the Apply wrote.
   */
  static readonly layer = Layer.effect(
    FileVariables,
    Effect.gen(function* () {
      const figma = yield* FigmaPlugin;
      const kit = yield* Kit;
      return yield* loadKitVariables(figma, kitCollections(kit));
    })
  );
}

/**
 * Run a plugin program once over a file and a kit.
 *
 * The program runs without Effect's cooperative yields. By default a fiber hands the thread back
 * through `setTimeout` every 2048 operations, and each such turn lets Figma redraw or take an edit
 * in the middle of a run. A run then yields only where it awaits Figma, as the plugin did before
 * it ran on Effect.
 *
 * @param program - The program.
 * @param figma - The plugin API over the file.
 * @param kit - The kit.
 * @returns What the program returns. The promise rejects with the program's error, or with what a
 *   defect threw.
 */
export function runPlugin<A>(
  program: Effect.Effect<A, PluginError, FigmaPlugin | Kit>,
  figma: PluginAPI,
  kit: KitSpec
): Promise<A> {
  return program.pipe(
    Effect.provideService(FigmaPlugin, figma),
    Effect.provideService(Kit, kit),
    Effect.provideService(Scheduler.PreventSchedulerYield, true),
    Effect.runPromise
  );
}
