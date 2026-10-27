/**
 * The node tree: the layers a parent holds, an instance's sublayers mirrored from its main
 * component, and how the file creates, copies, inserts and removes a node.
 */

import { BLACK, NEW_TEXT_STYLE, sourceOf, STATES, WHITE, write } from "./state.ts";
import type { FileState, NodeState, NodeType, UncopiedField } from "./state.ts";

/** The children a node shows, an instance's sublayers included. */
export function childrenOf(state: NodeState): NodeState[] {
  if (state.type === "PAGE" && !state.loaded) {
    throw new Error(
      `The page ${state.name} is not loaded. Under "documentAccess": "dynamic-page", call page.loadAsync() before reading its children.`
    );
  }
  const source = sourceOf(state);
  if (source !== undefined) {
    mirror(state, source, false);
  }
  return state.children;
}

/**
 * Give an instance, or a sublayer of one, a sublayer for each child of the layer it shows. A
 * sublayer stays while its main layer does. A swap also carries the overrides of a sublayer to
 * the new sublayer of the same name, as Figma keeps a glyph's color when an icon swaps.
 */
export function mirror(state: NodeState, source: NodeState, swapped: boolean): void {
  const shown = childrenOf(source);
  if (
    !swapped &&
    shown.length === state.children.length &&
    shown.every((child, index) => state.children[index]?.mirrorOf === child)
  ) {
    return;
  }
  const previous = state.children;
  state.children = shown.map((child) => {
    const kept = swapped ? undefined : previous.find((sublayer) => sublayer.mirrorOf === child);
    if (kept !== undefined) {
      return kept;
    }
    const sublayer = copyNode(state.file, child, child.type, `I${state.id};${child.id}`);
    sublayer.mirrorOf = child;
    sublayer.parent = state;
    const named = swapped ? previous.find((old) => old.name === child.name) : undefined;
    if (named?.overridden.has("fills") === true) {
      sublayer.fills = named.fills;
      sublayer.overridden.add("fills");
    }
    return sublayer;
  });
  for (const old of previous) {
    if (!state.children.includes(old)) {
      markRemoved(old);
    }
  }
}

export function markRemoved(state: NodeState): void {
  state.removed = true;
  for (const child of state.children) {
    markRemoved(child);
  }
}

export function detach(state: NodeState): void {
  const parent = state.parent;
  if (parent === undefined) {
    return;
  }
  parent.children = parent.children.filter((child) => child !== state);
  state.parent = undefined;
}

function isAncestor(candidate: NodeState, of: NodeState): boolean {
  for (let current: NodeState | undefined = of; current !== undefined; current = current.parent) {
    if (current === candidate) {
      return true;
    }
  }
  return false;
}

/** Move `child` into `parent` at `index`, or at the end. */
export function insert(parent: NodeState, child: NodeState, index: number | undefined): void {
  childrenOf(parent);
  if (parent.type === "INSTANCE" || parent.mirrorOf !== undefined) {
    throw new Error(`Cannot move a layer into the instance ${parent.id}.`);
  }
  if (child.mirrorOf !== undefined) {
    throw new Error(`Cannot move ${child.id}, a layer inside an instance.`);
  }
  if (parent.type === "COMPONENT_SET" && child.type !== "COMPONENT") {
    throw new Error(`A component set holds only components, and ${child.id} is a ${child.type}.`);
  }
  if (isAncestor(child, parent)) {
    throw new Error(`Cannot move ${child.id} into itself.`);
  }
  if (index !== undefined && (index < 0 || index > parent.children.length)) {
    throw new Error(`Cannot insert at index ${index}: ${parent.id} holds ${parent.children.length} layers.`);
  }
  detach(child);
  const at = index === undefined ? parent.children.length : Math.min(index, parent.children.length);
  parent.children.splice(at, 0, child);
  child.parent = parent;
  write(parent, `insert ${child.id} at ${at}`);
}

/**
 * The fields a copy takes from its source, with every object cloned. The return type names
 * every field of `NodeState` but the uncopied ones, so a new field fails the type check until
 * it is copied here or listed as uncopied.
 */
function copiedFields(source: NodeState): Omit<NodeState, UncopiedField> {
  return {
    name: source.name,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
    rotation: source.rotation,
    opacity: source.opacity,
    constraints: { ...source.constraints },
    anchors: { ...source.anchors },
    anchoredAt: { ...source.anchoredAt },
    fills: source.fills,
    strokes: source.strokes,
    strokeWeights: { ...source.strokeWeights },
    strokeWeightWritten: source.strokeWeightWritten,
    strokeAlign: source.strokeAlign,
    strokesIncludedInLayout: source.strokesIncludedInLayout,
    dashPattern: source.dashPattern,
    effects: source.effects,
    radii: { ...source.radii },
    clipsContent: source.clipsContent,
    itemReverseZIndex: source.itemReverseZIndex,
    layoutMode: source.layoutMode,
    layoutWrap: source.layoutWrap,
    primaryAxisSizingMode: source.primaryAxisSizingMode,
    counterAxisSizingMode: source.counterAxisSizingMode,
    primaryAxisAlignItems: source.primaryAxisAlignItems,
    counterAxisAlignItems: source.counterAxisAlignItems,
    padding: { ...source.padding },
    itemSpacing: source.itemSpacing,
    counterAxisSpacing: source.counterAxisSpacing,
    limits: { ...source.limits },
    layoutGrow: source.layoutGrow,
    layoutAlign: source.layoutAlign,
    layoutPositioning: source.layoutPositioning,
    bindings: new Map(source.bindings),
    explicitModes: new Map(source.explicitModes),
    propertyReferences: source.propertyReferences === null ? null : { ...source.propertyReferences },
    main: source.main,
    characters: source.characters,
    styles: source.styles,
    baseStyle: source.baseStyle,
    textDecoration: source.textDecoration,
    letterSpacing: { ...source.letterSpacing },
    textDecorationOffset: source.textDecorationOffset === null ? null : { ...source.textDecorationOffset },
    textAutoResize: source.textAutoResize,
    textAlignHorizontal: source.textAlignHorizontal,
    textAlignVertical: source.textAlignVertical,
    textTruncation: source.textTruncation,
    maxLines: source.maxLines,
    autoRename: source.autoRename,
  };
}

/** A copy of a node and its layers, as a duplicate or an instance's sublayer gets. */
export function copyNode(file: FileState, source: NodeState, type: NodeType, id?: string): NodeState {
  return Object.assign(createNode(file, type, source.name, id), copiedFields(source));
}

/** A duplicate of a node with its layers and its shared plugin data, as Figma's clone makes. */
export function duplicate(file: FileState, source: NodeState): NodeState {
  const copy = copyNode(file, source, source.type);
  copy.exposedInstance = source.exposedInstance;
  for (const [key, value] of source.sharedData) {
    copy.sharedData.set(key, value);
  }
  for (const [id, property] of source.properties) {
    copy.properties.set(id, property);
  }
  if (source.type !== "INSTANCE") {
    copy.children = source.children.map((child) => {
      const childCopy = duplicate(file, child);
      childCopy.parent = copy;
      return childCopy;
    });
  }
  return copy;
}

/** Put a node the API makes on the current page, as Figma does. */
export function placeOnCurrentPage(file: FileState, state: NodeState): void {
  const page = file.current;
  if (page === undefined) {
    throw new Error("The fake Figma file has no current page.");
  }
  insert(page, state, undefined);
}

/**
 * A shared plugin data entry as a node reads it: its own, or a sublayer's main layer's (rule 36), or a
 * swapped sublayer's new main component's (rule 48).
 */
export function sharedDataOf(state: NodeState, entry: string): string {
  const source = state.mirrorOf === undefined ? undefined : sourceOf(state);
  return state.sharedData.get(entry) ?? (source === undefined ? "" : sharedDataOf(source, entry));
}

export function createNode(file: FileState, type: NodeType, name: string, id?: string): NodeState {
  const { target, exposed } = file.makeNode(type);
  file.nextNode += 1;
  const state: NodeState = {
    file,
    id: id ?? `1:${file.nextNode}`,
    type,
    exposed,
    name,
    parent: undefined,
    children: [],
    removed: false,
    sharedData: new Map(),
    loaded: true,
    x: 0,
    y: 0,
    width: type === "TEXT" ? 0 : 100,
    height: type === "TEXT" ? 0 : 100,
    rotation: 0,
    opacity: 1,
    constraints: { horizontal: "MIN", vertical: "MIN" },
    anchors: { horizontal: undefined, vertical: undefined },
    anchoredAt: { horizontal: undefined, vertical: undefined },
    fills: type === "TEXT" ? [BLACK] : type === "VECTOR" || type === "INSTANCE" ? [] : [WHITE],
    strokes: [],
    strokeWeights: { top: 1, right: 1, bottom: 1, left: 1 },
    strokeWeightWritten: false,
    strokeAlign: "INSIDE",
    strokesIncludedInLayout: false,
    dashPattern: [],
    effects: [],
    radii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    clipsContent: type === "FRAME",
    itemReverseZIndex: false,
    layoutMode: "NONE",
    layoutWrap: "NO_WRAP",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    itemSpacing: 0,
    counterAxisSpacing: 0,
    limits: { minWidth: null, maxWidth: null, minHeight: null, maxHeight: null },
    layoutGrow: 0,
    layoutAlign: "INHERIT",
    layoutPositioning: "AUTO",
    bindings: new Map(),
    explicitModes: new Map(),
    propertyReferences: null,
    properties: new Map(),
    variantOrder: new Map(),
    main: undefined,
    propertyValues: new Map(),
    exposedInstance: false,
    mirrorOf: undefined,
    overridden: new Set(),
    unboundLengths: new Set(),
    heldByModes: false,
    characters: "",
    styles: [NEW_TEXT_STYLE],
    baseStyle: NEW_TEXT_STYLE,
    textDecoration: "NONE",
    textDecorationOffset: null,
    letterSpacing: { unit: "PERCENT", value: 0 },
    textAutoResize: "WIDTH_AND_HEIGHT",
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    textTruncation: "DISABLED",
    maxLines: null,
    autoRename: type === "TEXT",
  };
  // The guard reads a getter on the object itself, so the object and the guarded node both
  // lead to the state.
  STATES.set(target, state);
  STATES.set(exposed, state);
  file.nodes.set(state.id, state);
  return state;
}
