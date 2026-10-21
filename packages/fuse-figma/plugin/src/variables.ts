/**
 * The file's local variables and modes, found by the names the token sync writes. The kit
 * binds only variables that `figma:sync` owns, so a missing one means the file was not
 * synced or was synced from an older Fuse.
 */

import type { ModeRef, VariableRef } from "../../src/components/kit-spec.ts";

/** A mode of a local collection. */
export type ResolvedMode = {
  readonly collection: VariableCollection;
  readonly modeId: string;
};

/** Looks up the variables and modes the kit names. Each lookup throws when the file lacks it. */
export type KitVariables = {
  readonly variable: (ref: VariableRef) => Variable;
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
 * @returns The lookups for the kit's variable and mode references.
 * @throws When the file has two local collections with a name the kit uses.
 */
export async function loadKitVariables(figma: PluginAPI, names: ReadonlySet<string>): Promise<KitVariables> {
  const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collections = allCollections.filter(
    (collection) => !collection.remote && !collection.isExtension && names.has(collection.name)
  );
  const collectionsByName = new Map<string, VariableCollection>();
  for (const name of names) {
    const named = collections.filter((collection) => collection.name === name);
    if (named.length > 1) {
      throw new Error(
        `The file has ${named.length} local collections named ${name}. Rename or delete all but one, then run the plugin again.`
      );
    }
    const [collection] = named;
    if (collection !== undefined) {
      collectionsByName.set(name, collection);
    }
  }

  const variablesByName = new Map<string, Variable>();
  for (const variable of await figma.variables.getLocalVariablesAsync()) {
    const collection = collections.find((candidate) => candidate.id === variable.variableCollectionId);
    if (collection !== undefined) {
      variablesByName.set(`${collection.name}/${variable.name}`, variable);
    }
  }

  const collectionNamed = (name: string): VariableCollection => {
    const collection = collectionsByName.get(name);
    if (collection === undefined) {
      throw new Error(`The file has no local collection named ${name}. ${RUN_SYNC_FIRST}`);
    }
    return collection;
  };

  return {
    variable: (ref) => {
      collectionNamed(ref.collection);
      const variable = variablesByName.get(`${ref.collection}/${ref.name}`);
      if (variable === undefined) {
        throw new Error(
          `The ${ref.collection} collection has no variable named ${ref.name}. ${RUN_SYNC_FIRST}`
        );
      }
      return variable;
    },
    mode: (ref) => {
      const collection = collectionNamed(ref.collection);
      const mode = collection.modes.find((candidate) => candidate.name === ref.mode);
      if (mode === undefined) {
        throw new Error(`The ${ref.collection} collection has no mode named ${ref.mode}. ${RUN_SYNC_FIRST}`);
      }
      return { collection, modeId: mode.modeId };
    },
  };
}
