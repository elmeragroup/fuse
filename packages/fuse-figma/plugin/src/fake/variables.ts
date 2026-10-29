/**
 * Variables: the synced collections the file starts with, how a node resolves a variable through
 * the modes it reads, and the collections a subtree's bindings read.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 8. `resolveForConsumer` reads each collection in the mode the node or its nearest ancestor
 *    pins, or in the collection's default mode, and follows aliases across collections, each
 *    in the mode the node reads for the alias target's collection. `fuse-variable-set.ts`
 *    builds its theme axes on this rule.
 * 11. `resolvedVariableModes` lists only the collections the layer's subtree reads: those of
 *    the variables a field, text range, paint or effect binds somewhere under it, and those
 *    their aliases reach. The typings say "each variable collection in this file".
 *    `explicitVariableModes` lists every pin. On a real file on 2026-10-21 a Badge preview
 *    pinned `Fuse density` to Auto beside its theme. It resolved `Fuse tokens`, which its layers
 *    bind, and the brand, segment and variant collections those tokens alias through, but
 *    neither `Fuse density`, which no Badge layer binds, nor `Fuse primitives`. The Button and
 *    Toggle previews, whose sets bind density, resolved Auto.
 */

import type { CollectionSpec, VariableValue as SyncedValue } from "../../../src/variable-set.ts";
import { guard } from "./guard.ts";
import { shown, shownBindings } from "./overrides.ts";
import { EFFECT_FIELD_TYPES, f32, live, storeRgba, TEXT_FIELDS } from "./state.ts";
import type { CollectionState, FileState, Literal, NodeState, StoredValue, VariableState } from "./state.ts";
import { childrenOf } from "./tree.ts";

/** The mode a node reads a collection in: the nearest pinned one, or the default. */
export function modeFor(consumer: NodeState | undefined, collection: CollectionState): string {
  for (let current = consumer; current !== undefined; current = current.parent) {
    const pinned = current.explicitModes.get(collection.id);
    if (pinned !== undefined) {
      return pinned;
    }
  }
  return collection.defaultModeId;
}

export function variableState(file: FileState, id: string): VariableState {
  const variable = file.variables.get(id);
  if (variable === undefined) {
    throw new Error(`The file holds no variable with the id ${id}.`);
  }
  return variable;
}

/** The literal a variable takes in a node, or in the default modes without a node. */
function resolve(file: FileState, variable: VariableState, consumer: NodeState | undefined): Literal {
  const seen = new Set<string>();
  let current = variable;
  for (;;) {
    if (seen.has(current.id)) {
      throw new Error(`${variable.name} aliases itself.`);
    }
    seen.add(current.id);
    const value = current.values.get(modeFor(consumer, current.collection));
    if (value === undefined) {
      throw new Error(`${current.name} has no value in the mode ${variable.name} reads.`);
    }
    if (value.kind !== "alias") {
      return value;
    }
    current = variableState(file, value.id);
  }
}

export function resolveColor(
  file: FileState,
  variable: VariableState,
  consumer: NodeState | undefined
): RGBA {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "color") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a color.`);
  }
  return value.color;
}

export function resolveNumber(
  file: FileState,
  variable: VariableState,
  consumer: NodeState | undefined
): number {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "float") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a number.`);
  }
  return value.value;
}

export function resolveString(
  file: FileState,
  variable: VariableState,
  consumer: NodeState | undefined
): string {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "string") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a string.`);
  }
  return value.value;
}

function figmaValue(value: StoredValue): VariableValue {
  switch (value.kind) {
    case "alias":
      return { type: "VARIABLE_ALIAS", id: value.id };
    case "color":
      return value.color;
    case "float":
    case "string":
    case "boolean":
      return value.value;
  }
}

export function alias(id: string): VariableAlias {
  return { type: "VARIABLE_ALIAS", id };
}

/** The variable a plugin hands the fake, which must be one the file holds. */
export function fileVariable(file: FileState, variable: Variable): VariableState {
  return variableState(file, variable.id);
}

export function requireType(variable: VariableState, type: VariableResolvedDataType, field: string): void {
  if (variable.resolvedType !== type) {
    throw new Error(
      `Cannot bind the ${variable.resolvedType} variable ${variable.name} to ${field}, which takes a ${type}.`
    );
  }
}

export function nodeBindings(state: NodeState): NonNullable<FrameNode["boundVariables"]> {
  const nodeFields: { [field in VariableBindableNodeField]?: VariableAlias } = {};
  for (const [field, id] of shownBindings(state)) {
    nodeFields[field] = alias(id);
  }
  const textFields: { [field in VariableBindableTextField]?: VariableAlias[] } = {};
  // Characters typed in one style share its record, so each distinct style is read once.
  const styles = [...new Set(state.styles)];
  for (const field of TEXT_FIELDS) {
    const ids = new Set(styles.flatMap((style) => style.bindings.get(field) ?? []));
    if (ids.size > 0) {
      textFields[field] = [...ids].map(alias);
    }
  }
  return { ...nodeFields, ...textFields };
}

/** The variable ids a layer's fields, text, paints and effects bind. */
function layerBindings(state: NodeState): string[] {
  const paints = [...shown(state, "fills"), ...shown(state, "strokes")].flatMap((paint) =>
    paint.type === "SOLID" && paint.boundVariables?.color !== undefined ? [paint.boundVariables.color.id] : []
  );
  const effects = shown(state, "effects").flatMap((effect) =>
    effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW"
      ? [...EFFECT_FIELD_TYPES.keys()].flatMap((field) => effect.boundVariables?.[field]?.id ?? [])
      : []
  );
  const text = state.styles.flatMap((style) => [...style.bindings.values()]);
  return [...state.bindings.values(), ...text, ...paints, ...effects];
}

/** The variable ids a layer and every layer under it bind, an instance's sublayers included. */
function subtreeBindings(state: NodeState): Set<string> {
  const ids = new Set(layerBindings(state));
  for (const child of childrenOf(state)) {
    for (const id of subtreeBindings(child)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * The collections a layer reads through the bindings in its subtree: each bound variable's,
 * and each alias target's, following the aliases in the modes the layer reads.
 */
export function boundCollections(state: NodeState): Set<string> {
  const visited = new Set<string>();
  const collections = new Set<string>();
  for (const id of subtreeBindings(state)) {
    for (let next: string | undefined = id; next !== undefined && !visited.has(next);) {
      visited.add(next);
      const variable = variableState(state.file, next);
      collections.add(variable.collection.id);
      const value = variable.values.get(modeFor(state, variable.collection));
      next = value?.kind === "alias" ? value.id : undefined;
    }
  }
  return collections;
}

/** The literal a synced value holds, or the alias it names by id. */
function storedValue(
  value: SyncedValue,
  idOf: (collection: string, variable: string) => string
): StoredValue {
  switch (value._tag) {
    case "Alias":
      return { kind: "alias", id: idOf(value.target.collection, value.target.variable) };
    case "Color":
      return { kind: "color", color: storeRgba(value.color) };
    case "Float":
      return { kind: "float", value: f32(value.value) };
    case "String":
      return { kind: "string", value: value.value };
  }
}

/** A synced file's collections, and its variables by id. */
type SeededVariables = {
  readonly collections: readonly CollectionState[];
  readonly variables: ReadonlyMap<string, VariableState>;
};

/** The file's collections and variables, with the ids Figma would give them in this order. */
export function seedVariables(collections: readonly CollectionSpec[]): SeededVariables {
  const ids = new Map<string, string>();
  let next = 0;
  const states = collections.map((collection, index): CollectionState => {
    const modes = collection.modes.map((name, mode) => ({ modeId: `${index + 1}:${mode}`, name }));
    const [first] = modes;
    if (first === undefined) {
      throw new Error(`The collection ${collection.name} has no modes.`);
    }
    for (const variable of collection.variables) {
      next += 1;
      ids.set(`${collection.name}/${variable.name}`, `VariableID:1:${next}`);
    }
    return {
      id: `VariableCollectionId:1:${index + 1}`,
      name: collection.name,
      modes,
      defaultModeId: first.modeId,
      variableIds: [],
      exposed: undefined,
    };
  });
  const idOf = (collection: string, variable: string): string => {
    const id = ids.get(`${collection}/${variable}`);
    if (id === undefined) {
      throw new Error(`The synced collections alias ${collection}/${variable}, which they do not hold.`);
    }
    return id;
  };
  const variables = new Map<string, VariableState>();
  collections.forEach((collection, index) => {
    const state = states[index];
    if (state === undefined) {
      throw new Error(`The collection ${collection.name} has no state.`);
    }
    for (const variable of collection.variables) {
      const id = idOf(collection.name, variable.name);
      state.variableIds.push(id);
      const values = new Map<string, StoredValue>();
      for (const mode of state.modes) {
        const value = variable.values.get(mode.name);
        if (value === undefined) {
          throw new Error(`${collection.name}/${variable.name} has no value in ${mode.name}.`);
        }
        values.set(mode.modeId, storedValue(value, idOf));
      }
      variables.set(id, {
        id,
        name: variable.name,
        collection: state,
        resolvedType: variable.type,
        values,
        exposed: undefined,
      });
    }
  });
  return { collections: states, variables };
}

export function exposeCollection(collection: CollectionState): VariableCollection {
  if (collection.exposed !== undefined) {
    return collection.exposed;
  }
  const api: Pick<
    VariableCollection,
    "id" | "name" | "remote" | "isExtension" | "modes" | "defaultModeId" | "variableIds"
  > = {
    id: collection.id,
    name: collection.name,
    remote: false,
    isExtension: false,
    modes: collection.modes.map((mode) => ({ ...mode })),
    defaultModeId: collection.defaultModeId,
    variableIds: [...collection.variableIds],
  };
  // SAFETY: the object models the members of a local collection the plugin reads, and the
  // guard throws for every other member.
  const exposed = guard(api, "VariableCollection") as VariableCollection;
  collection.exposed = exposed;
  return exposed;
}

export function exposeVariable(file: FileState, variable: VariableState): Variable {
  if (variable.exposed !== undefined) {
    return variable.exposed;
  }
  const api: Pick<
    Variable,
    "id" | "name" | "remote" | "variableCollectionId" | "resolvedType" | "valuesByMode" | "resolveForConsumer"
  > = {
    id: variable.id,
    name: variable.name,
    remote: false,
    variableCollectionId: variable.collection.id,
    resolvedType: variable.resolvedType,
    valuesByMode: Object.fromEntries([...variable.values].map(([mode, value]) => [mode, figmaValue(value)])),
    resolveForConsumer: (consumer) => ({
      value: figmaValue(resolve(file, variable, live(consumer))),
      resolvedType: variable.resolvedType,
    }),
  };
  // SAFETY: the object models the members of a local variable the plugin reads, and the guard
  // throws for every other member.
  const exposed = guard(api, "Variable") as Variable;
  variable.exposed = exposed;
  return exposed;
}
