/**
 * The file's local variables and modes, found by the names the token sync writes. The kit
 * binds only variables that `figma:sync` owns, so a missing one means the file was not
 * synced or was synced from an older Fuse.
 */

import { Effect, Layer, Result } from "effect";

import type { ModeRef, VariableRef } from "../../src/components/kit-spec.ts";
import { kitCollections } from "./check-kit.ts";
import { DuplicateCollections, FileNotSynced } from "./errors.ts";
import { FigmaPlugin, FileVariables, Kit } from "./services.ts";

/** A mode of a local collection. */
export type ResolvedMode = {
  readonly collection: VariableCollection;
  readonly modeId: string;
};

/**
 * Looks up the variables and modes the kit names. `findVariable` and `findMode` return
 * `FileNotSynced` when the file lacks one. The kit check finds every variable and mode the kit
 * names before a run plans anything, so the planners read them through `variable` and `mode`,
 * whose failure is a defect.
 */
export type KitVariables = {
  readonly findVariable: (ref: VariableRef) => Result.Result<Variable, FileNotSynced>;
  readonly findMode: (ref: ModeRef) => Result.Result<ResolvedMode, FileNotSynced>;
  /** The variable, which the kit check found. */
  readonly variable: (ref: VariableRef) => Variable;
  /** The mode, which the kit check found. */
  readonly mode: (ref: ModeRef) => ResolvedMode;
};

const RUN_SYNC_FIRST = "Run `figma:sync` on this file first.";

/**
 * Index the local collections the kit names, and their variables, by name. Only those names
 * need to be unique, so other collections in the file may share a name, as in the token
 * sync's plan.
 *
 * @param figma - The plugin API.
 * @param names - The collections the kit's variable and mode references name.
 * @returns The lookups for the kit's variable and mode references, or `DuplicateCollections` when
 *   the file has two local collections with a name the kit uses.
 */
export const loadKitVariables = Effect.fnUntraced(function* (figma: PluginAPI, names: ReadonlySet<string>) {
  const allCollections = yield* Effect.promise(() => figma.variables.getLocalVariableCollectionsAsync());
  const collections = allCollections.filter(
    (collection) => !collection.remote && !collection.isExtension && names.has(collection.name)
  );
  const collectionsByName = new Map<string, VariableCollection>();
  for (const name of names) {
    const named = collections.filter((collection) => collection.name === name);
    if (named.length > 1) {
      return yield* new DuplicateCollections({
        message: `The file has ${named.length} local collections named ${name}. Rename or delete all but one, then run the plugin again.`,
        collection: name,
        count: named.length,
      });
    }
    const [collection] = named;
    if (collection !== undefined) {
      collectionsByName.set(name, collection);
    }
  }

  const variablesByName = new Map<string, Variable>();
  const localVariables = yield* Effect.promise(() => figma.variables.getLocalVariablesAsync());
  for (const variable of localVariables) {
    const collection = collections.find((candidate) => candidate.id === variable.variableCollectionId);
    if (collection !== undefined) {
      variablesByName.set(`${collection.name}/${variable.name}`, variable);
    }
  }

  const collectionNamed = (name: string): Result.Result<VariableCollection, FileNotSynced> => {
    const collection = collectionsByName.get(name);
    return collection === undefined
      ? Result.fail(
          new FileNotSynced({
            message: `The file has no local collection named ${name}. ${RUN_SYNC_FIRST}`,
            collection: name,
          })
        )
      : Result.succeed(collection);
  };
  const findVariable = (ref: VariableRef): Result.Result<Variable, FileNotSynced> =>
    Result.flatMap(collectionNamed(ref.collection), () => {
      const variable = variablesByName.get(`${ref.collection}/${ref.name}`);
      return variable === undefined
        ? Result.fail(
            new FileNotSynced({
              message: `The ${ref.collection} collection has no variable named ${ref.name}. ${RUN_SYNC_FIRST}`,
              collection: ref.collection,
            })
          )
        : Result.succeed(variable);
    });
  const findMode = (ref: ModeRef): Result.Result<ResolvedMode, FileNotSynced> =>
    Result.flatMap(collectionNamed(ref.collection), (collection) => {
      const mode = collection.modes.find((candidate) => candidate.name === ref.mode);
      return mode === undefined
        ? Result.fail(
            new FileNotSynced({
              message: `The ${ref.collection} collection has no mode named ${ref.mode}. ${RUN_SYNC_FIRST}`,
              collection: ref.collection,
            })
          )
        : Result.succeed({ collection, modeId: mode.modeId });
    });

  const lookups: KitVariables = {
    findVariable,
    findMode,
    variable: (ref) => Result.getOrThrowWith(findVariable(ref), (failure) => new Error(failure.message)),
    mode: (ref) => Result.getOrThrowWith(findMode(ref), (failure) => new Error(failure.message)),
  };
  return lookups;
});

/**
 * Read the collections the kit names from the file. Each build reads the file again, so a run that
 * follows an Apply sees what the Apply wrote.
 */
export const kitVariablesLayer = Layer.effect(
  FileVariables,
  Effect.gen(function* () {
    const figma = yield* FigmaPlugin;
    const kit = yield* Kit;
    return yield* loadKitVariables(figma, kitCollections(kit));
  })
);
