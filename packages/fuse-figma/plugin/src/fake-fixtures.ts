/**
 * Small synced files for the plugin's unit tests, on the in-memory file in `fake-figma.ts`. A
 * test names the few variables its planner binds, and gets a file whose collections hold them
 * in one mode, and the run a planner takes.
 */

import type {
  CollectionSpec,
  Rgba,
  VariableReference,
  VariableType,
  VariableValue,
} from "../../src/variable-set.ts";
import { createFakeFigma } from "./fake-figma.ts";
import type { FakeFigma } from "./fake-figma.ts";
import type { Run } from "./fields.ts";
import type { Plan } from "./plan.ts";
import { loadKitVariables } from "./variables.ts";

/** A variable a fixture file holds, with its value in the collection's one mode. */
export type FixtureVariable = {
  readonly collection: string;
  readonly name: string;
  readonly type: VariableType;
  readonly value: VariableValue;
};

/** A FLOAT variable. */
export function float(collection: string, name: string, value: number): FixtureVariable {
  return { collection, name, type: "FLOAT", value: { _tag: "Float", value } };
}

/** A STRING variable. */
export function string(collection: string, name: string, value: string): FixtureVariable {
  return { collection, name, type: "STRING", value: { _tag: "String", value } };
}

/** A COLOR variable. */
export function color(collection: string, name: string, value: Rgba): FixtureVariable {
  return { collection, name, type: "COLOR", value: { _tag: "Color", color: value } };
}

/** A variable of the given type that aliases another variable of the file. */
export function aliasOf(
  collection: string,
  name: string,
  type: VariableType,
  target: VariableReference
): FixtureVariable {
  return { collection, name, type, value: { _tag: "Alias", target } };
}

/**
 * A synced file that holds the given variables, each collection in one mode, `Default`.
 *
 * @param variables - The variables.
 * @returns The file.
 */
export function fixtureFile(variables: readonly FixtureVariable[]): FakeFigma {
  const names = [...new Set(variables.map((variable) => variable.collection))];
  const collections = names.map((name): CollectionSpec => ({
    name,
    modes: ["Default"],
    variables: variables
      .filter((variable) => variable.collection === name)
      .map((variable) => ({
        name: variable.name,
        type: variable.type,
        scopes: [],
        webSyntax: undefined,
        description: "",
        values: new Map([["Default", variable.value]]),
      })),
  }));
  return createFakeFigma({ collections });
}

/**
 * The run a planner takes on a fixture file, with the file's collections as the kit's.
 *
 * @param file - The file.
 * @param plan - The plan the planner records into.
 * @returns The run.
 */
export async function fixtureRun(file: FakeFigma, plan: Plan): Promise<Run> {
  const collections = await file.figma.variables.getLocalVariableCollectionsAsync();
  const variables = await loadKitVariables(
    file.figma,
    new Set(collections.map((collection) => collection.name))
  );
  return { figma: file.figma, variables, plan };
}
