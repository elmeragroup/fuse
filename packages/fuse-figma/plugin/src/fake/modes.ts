/**
 * Modes: how a node resolves a variable through the modes it reads, and the number a layer shows
 * for a field a binding sets.
 *
 * It models this rule. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 8. `resolveForConsumer` reads each collection in the mode the node or its nearest ancestor
 *    pins, or in the collection's default mode, and follows aliases across collections, each
 *    in the mode the node reads for the alias target's collection. `fuse-variable-set.ts`
 *    builds its theme axes on this rule. A bound number reads its variable in the modes its layer
 *    reads now. On a real file on 2026-11-20 a FLOAT variable, 40 in Comfortable and 24 in Dense,
 *    bound a rectangle's width, an auto layout row's `paddingLeft` and `itemSpacing`, and a
 *    component's width, beside an instance of that component, in an unpinned frame. Each read 24
 *    once `appendChild` moved it into a frame pinned to Dense, and the row, which hugged its
 *    layers, narrowed from 100 to 68. Each read 40 when moved back, and 24 again once the unpinned
 *    frame pinned Dense (FM1). A literal write unbinds the number, and a later change of modes
 *    leaves it alone: on the same file an auto layout frame whose `paddingLeft` bound the variable
 *    read 7 and no binding after `paddingLeft = 7`, and still 7 once moved under the Dense frame
 *    (FM2). So the fake resolves a bound number when it is read, in the modes of the layer read,
 *    and stores no resolved value for later. A layer shows the binding it holds itself, or else the
 *    one its source shows, for an instance its main's and for a sublayer its main layer's, until
 *    the layer writes the number as its own. A layer that shows no binding reads the number of
 *    the nearest layer along that chain that holds its own. A hugging layer measures its children
 *    by the same reads, an instance child by the length it binds through its main. So a
 *    `remove()` that leaves a component without a parent, or `combineAsVariants`, a move or a pin,
 *    changes what the next read gives with nothing written. A width or a height reads through
 *    `lengthOn` and `settled` (rules 32, 56). A literal write to any bound number field but a width
 *    or a height drops the binding the layer holds and makes the number its own, where FM2 wrote
 *    only `paddingLeft`. An unbind keeps the number the layer showed, as its own. The fake lays a
 *    row out again only where it lays one out at all (rule 32), and does not place the row's
 *    layers. A sublayer's inherited binding on a field other than a corner is the fake's reading,
 *    as rule 38 probed only corners. FM1 and FM2 left open a cleared pin, which the fake does not
 *    model, and a `resize` over a bound width or height. A text's bound numbers and a bound paint
 *    color still resolve once, when they bind.
 */

import { f32, numberOwner, sourceOf } from "./state.ts";
import type {
  CollectionState,
  FileState,
  LimitField,
  Literal,
  NodeState,
  StoredNumberField,
  VariableState,
} from "./state.ts";

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
export function resolve(file: FileState, variable: VariableState, consumer: NodeState | undefined): Literal {
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

/**
 * Store a number on the layer, as a binding or an unbind does. A read resolves a bound field again
 * (rule 8), so a bound field's stored number only seeds the value the layer keeps once unbound.
 */
export function storeNumber(state: NodeState, field: StoredNumberField, value: number): void {
  const stored = f32(value);
  switch (field) {
    case "minWidth":
    case "maxWidth":
    case "minHeight":
    case "maxHeight":
      state.limits[field] = stored;
      return;
    case "itemSpacing":
      state.itemSpacing = stored;
      return;
    case "counterAxisSpacing":
      state.counterAxisSpacing = stored;
      return;
    case "paddingTop":
      state.padding.top = stored;
      return;
    case "paddingRight":
      state.padding.right = stored;
      return;
    case "paddingBottom":
      state.padding.bottom = stored;
      return;
    case "paddingLeft":
      state.padding.left = stored;
      return;
    case "topLeftRadius":
      state.radii.topLeft = stored;
      return;
    case "topRightRadius":
      state.radii.topRight = stored;
      return;
    case "bottomRightRadius":
      state.radii.bottomRight = stored;
      return;
    case "bottomLeftRadius":
      state.radii.bottomLeft = stored;
      return;
    case "strokeTopWeight":
      state.strokeWeights.top = stored;
      return;
    case "strokeRightWeight":
      state.strokeWeights.right = stored;
      return;
    case "strokeBottomWeight":
      state.strokeWeights.bottom = stored;
      return;
    case "strokeLeftWeight":
      state.strokeWeights.left = stored;
      return;
    case "opacity":
      state.opacity = stored;
      return;
    case "gridColumnGap":
      state.grid.columnGap = stored;
      return;
    case "gridRowGap":
      state.grid.rowGap = stored;
      return;
  }
}

/** The number a layer stores for a field, apart from any binding. */
function storedNumber(state: NodeState, field: StoredNumberField): number | null {
  switch (field) {
    case "minWidth":
    case "maxWidth":
    case "minHeight":
    case "maxHeight":
      return state.limits[field];
    case "itemSpacing":
      return state.itemSpacing;
    case "counterAxisSpacing":
      return state.counterAxisSpacing;
    case "paddingTop":
      return state.padding.top;
    case "paddingRight":
      return state.padding.right;
    case "paddingBottom":
      return state.padding.bottom;
    case "paddingLeft":
      return state.padding.left;
    case "topLeftRadius":
      return state.radii.topLeft;
    case "topRightRadius":
      return state.radii.topRight;
    case "bottomRightRadius":
      return state.radii.bottomRight;
    case "bottomLeftRadius":
      return state.radii.bottomLeft;
    case "strokeTopWeight":
      return state.strokeWeights.top;
    case "strokeRightWeight":
      return state.strokeWeights.right;
    case "strokeBottomWeight":
      return state.strokeWeights.bottom;
    case "strokeLeftWeight":
      return state.strokeWeights.left;
    case "opacity":
      return state.opacity;
    case "gridColumnGap":
      return state.grid.columnGap;
    case "gridRowGap":
      return state.grid.rowGap;
  }
}

/** A field that reads null where the layer sets none. */
type NullableNumberField = LimitField | "counterAxisSpacing";

/**
 * The number a layer shows for a field a binding can set (rule 8): the variable it binds, or its
 * source shows bound, resolved in the layer's own modes, or else the number of the nearest layer
 * along its chain of sources that holds the field as its own.
 */
export function shownNumber(state: NodeState, field: Exclude<StoredNumberField, NullableNumberField>): number;
export function shownNumber(state: NodeState, field: StoredNumberField): number | null;
export function shownNumber(state: NodeState, field: StoredNumberField): number | null {
  for (let node = state; ;) {
    const bound = node.bindings.get(field);
    if (bound !== undefined) {
      return f32(resolveNumber(state.file, variableState(state.file, bound), state));
    }
    const source = sourceOf(node);
    if (source === undefined || node.overridden.has(numberOwner(field))) {
      return storedNumber(node, field);
    }
    node = source;
  }
}

/**
 * Make a number a layer's own, so it stops showing its source's (rule 8), as a literal write or an
 * unbind does. A layer with no source owns every number already.
 */
export function ownNumber(state: NodeState, field: StoredNumberField): void {
  if (sourceOf(state) !== undefined) {
    state.overridden.add(numberOwner(field));
  }
}
