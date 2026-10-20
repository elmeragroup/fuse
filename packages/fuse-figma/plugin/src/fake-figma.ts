/**
 * An in-memory Figma file behind the parts of the Plugin API that the components plugin calls,
 * for tests that run `reconcileKit` end to end. The file starts as a synced file: it holds the
 * variable collections `figma:sync` writes, with their modes, values and aliases, and one empty
 * page. Variables, collections, modes and nodes get ids in the order the file makes them, so a
 * test sees the same ids on every run.
 *
 * Every node, variable, collection and API object sits behind a guard that throws for a member
 * the fake does not model, so a plugin change that reads or writes something new fails here
 * instead of passing on an `undefined`. Every write lands in a log, so a test can tell that a
 * run stopped before its first write.
 *
 * The fake models the Figma rules below. Each rule a real file showed in 2026-10 names that run.
 *
 * 1. `setBoundVariableForPaint` returns the paint with its opacity set to the alpha of the bound
 *    COLOR variable in the collections' default modes, whatever opacity it was given. Two runs
 *    on a real file on 2026-10-19 wrote `error` at 10% and read it back at 100%.
 * 2. Assigning `effects`: an effect whose color binding is new to the node stores the value the
 *    variable takes in the node. An effect written with a color binding the node already held
 *    keeps the color written. On a real file on 2026-10-20, 28 focus rings bound to `ring`
 *    kept the black an earlier run wrote. A radius or spread binding keeps the value written.
 * 3. A drop shadow's spread draws only on a frame, component or instance that clips its content
 *    and has a visible fill, one with `visible` not false and an opacity above 0. On a real file
 *    on 2026-10-20 the ghost and link focus rings drew nothing over a fill at alpha 0, and a test
 *    frame drew its ring once the fill reached 0.001. The typings' `DropShadowEffect.spread`
 *    says the same. {@link drawsShadowSpread} reports it, and the stored spread stays as written.
 * 4. A component set keeps each variant property's values in an order of its own. A new set
 *    lists them in the order its children first show them, a value added later goes last, and
 *    moving the children or renaming a value leaves it where it is. Its `defaultVariant` is the
 *    top-left child, the smallest y and then the smallest x. On a real file on 2026-10-20 a run
 *    that appended xs and lg listed the sizes as default, sm, xs, lg and made xs the default, a
 *    later run that moved the variants into spec order left that list as it was, and a test set
 *    kept a renamed value in its slot.
 * 5. `resize` and `resizeWithoutConstraints` on an auto layout frame set both sizing modes to
 *    FIXED. `planSizing` in `fields.ts` writes the modes again after a size for this reason,
 *    since 4734b75e on 2026-10-19. Binding `width` or `height` resizes the same way.
 * 6. `createNodeFromSvg` returns a frame the size of the markup's `width` and `height`, painted
 *    white and clipping, on the current page. Its children are the drawn elements, each a
 *    vector named after its `id`, or `Vector`, as a real run showed on 2026-10-20. The fake
 *    leaves out what `defs`, `clipPath` and `mask` hold and lifts the elements out of groups.
 *    It reads no geometry, so every vector covers the whole drawing.
 * 7. A text write needs every font the layer holds loaded, and a font write needs only the new
 *    font, as the typings and Figma's text guide say and as the plugin relies on since
 *    e152633d and 11df4d6e on 2026-10-19. `loadFontAsync` rejects a font the test marks
 *    unavailable. Clearing a text binding writes no font, so it needs none.
 * 8. `resolveForConsumer` reads each collection in the mode the node or its nearest ancestor
 *    pins, or in the collection's default mode, and follows aliases across collections, each
 *    in the mode the node reads for the alias target's collection. `fuse-variable-set.ts`
 *    builds its theme axes on this rule.
 *
 * An instance's sublayers show the layers of its main component. An override, such as the
 * color an icon layer gives its glyph, belongs to the main layer it was made on. It moves to
 * the layer of the same name when the instance swaps, as Figma's help describes and the plugin
 * relies on, and it is lost when the main component replaces that layer, which is the fake's
 * reading of how Figma ties overrides to layers.
 *
 * It also models what the plugin typings document for a plugin with
 * `"documentAccess": "dynamic-page"`, as the components plugin declares: a page other than the
 * current one needs `loadAsync` before its children are read or changed, and an instance's
 * `mainComponent` cannot be read. `insertChild` refuses an index past the end. `layoutWrap` needs
 * an auto layout frame, and `minWidth` an auto layout frame or a child of one. A layer links
 * only a property of the component or set it sits in, of the type the link needs. A component
 * set holds only components. A removed node throws on every read but its id.
 *
 * The fake does not lay out: an auto layout frame keeps the size it was given, so a hugging
 * frame does not grow with its content.
 */

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";

import type { CollectionSpec, VariableValue as SyncedValue } from "../../src/variable-set.ts";

/** What a test sets up the fake file with. */
export type FakeFigmaOptions = {
  /** The collections the token sync writes, such as `fuseVariableSet()` builds them. */
  readonly collections: readonly CollectionSpec[];
  /** Fonts this machine cannot load. A font without a style marks every style of its family. */
  readonly unavailableFonts?: readonly FontNameInput[];
};

/** A fake file and what a test reads from it beside the Plugin API. */
export type FakeFigma = {
  /** The Plugin API over the file. */
  readonly figma: PluginAPI;
  /** Every write the file took, in order, such as `12:3 fills`. */
  readonly writes: readonly string[];
  /** Start a new plugin run: every page but the current one needs `loadAsync` again. */
  readonly reopen: () => void;
  /**
   * A synced variable by its collection and name.
   *
   * @throws When the file holds no such variable.
   */
  readonly variable: (collection: string, name: string) => Variable;
};

type NodeType =
  | "DOCUMENT"
  | "PAGE"
  | "FRAME"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE"
  | "TEXT"
  | "VECTOR";

/** The node a plugin sees for a node the fake holds. */
type Exposed = DocumentNode | PageNode | SceneNode;

type BindableField = VariableBindableNodeField | VariableBindableTextField;

/** The four sides of a stroke or of padding. */
type Sides = { top: number; right: number; bottom: number; left: number };

/** The four corner radii. */
type Corners = { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };

/** A TEXT, BOOLEAN or INSTANCE_SWAP property of a component set or a component. */
type PropertyState = {
  readonly type: "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  readonly defaultValue: string | boolean;
  readonly preferredValues: readonly InstanceSwapPreferredValue[] | undefined;
};

/** A literal a variable resolves to. */
type Literal =
  | { readonly kind: "color"; readonly color: RGBA }
  | { readonly kind: "float"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean };

/** A variable's value in one mode: a literal, or an alias of another variable by id. */
type StoredValue = Literal | { readonly kind: "alias"; readonly id: string };

type CollectionState = {
  readonly id: string;
  readonly name: string;
  readonly modes: readonly { readonly modeId: string; readonly name: string }[];
  readonly defaultModeId: string;
  readonly variableIds: string[];
  exposed: VariableCollection | undefined;
};

type VariableState = {
  readonly id: string;
  readonly name: string;
  readonly collection: CollectionState;
  readonly resolvedType: VariableResolvedDataType;
  readonly values: ReadonlyMap<string, StoredValue>;
  exposed: Variable | undefined;
};

type FileState = {
  nextNode: number;
  nextProperty: number;
  readonly writes: string[];
  readonly nodes: Map<string, NodeState>;
  document: NodeState | undefined;
  current: NodeState | undefined;
  readonly loadedFonts: Set<string>;
  readonly unavailableFonts: readonly FontNameInput[];
  readonly collections: readonly CollectionState[];
  readonly variables: ReadonlyMap<string, VariableState>;
};

/**
 * Everything the fake holds for a node, whatever its type. The guard decides which of these a
 * plugin can reach through the node's type.
 */
type NodeState = {
  readonly file: FileState;
  readonly id: string;
  readonly type: NodeType;
  readonly exposed: Exposed;
  name: string;
  parent: NodeState | undefined;
  children: NodeState[];
  removed: boolean;
  readonly sharedData: Map<string, string>;
  /** Whether a page's contents are loaded. */
  loaded: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  constraints: Constraints;
  fills: readonly Paint[];
  strokes: readonly Paint[];
  strokeWeights: Sides;
  strokeAlign: FrameNode["strokeAlign"];
  strokesIncludedInLayout: boolean;
  effects: readonly Effect[];
  radii: Corners;
  clipsContent: boolean;
  layoutMode: FrameNode["layoutMode"];
  layoutWrap: FrameNode["layoutWrap"];
  primaryAxisSizingMode: FrameNode["primaryAxisSizingMode"];
  counterAxisSizingMode: FrameNode["counterAxisSizingMode"];
  primaryAxisAlignItems: FrameNode["primaryAxisAlignItems"];
  counterAxisAlignItems: FrameNode["counterAxisAlignItems"];
  padding: Sides;
  itemSpacing: number;
  counterAxisSpacing: number | null;
  minWidth: number | null;
  /** The variable each bound field follows, by id. */
  readonly bindings: Map<BindableField, string>;
  /** The mode the node pins for each collection, by collection id. */
  readonly explicitModes: Map<string, string>;
  propertyReferences: FrameNode["componentPropertyReferences"];
  /** The TEXT, BOOLEAN and INSTANCE_SWAP properties of a set or a component, by property id. */
  readonly properties: Map<string, PropertyState>;
  /** The values each variant property of a set lists, in the set's own order (rule 4). */
  readonly variantOrder: Map<string, string[]>;
  /** The main component of an instance. */
  main: NodeState | undefined;
  /** The layer of the main component that an instance's sublayer shows. */
  mirrorOf: NodeState | undefined;
  /** The fields a designer or the plugin overrode on an instance's sublayer. */
  readonly overridden: Set<string>;
  characters: string;
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  textDecoration: TextDecoration;
  textDecorationOffset: TextDecorationOffset | null;
  textAutoResize: TextNode["textAutoResize"];
  autoRename: boolean;
};

const STATES = new WeakMap<NodeHandle, NodeState>();

const SHARED_DATA_SEPARATOR = "\u0000";

/** Members test runners and promises probe on any object, which the guard answers with nothing. */
const INTROSPECTION = new Set<string>([
  "then",
  "toJSON",
  "asymmetricMatch",
  "$$typeof",
  "nodeType",
  "tagName",
  "@@__IMMUTABLE_ITERABLE__@@",
  "@@__IMMUTABLE_RECORD__@@",
  "_isMockFunction",
]);

function isIntrospection(property: string | symbol): boolean {
  return INTROSPECTION.has(String(property)) || String(property).startsWith("Symbol(");
}

/**
 * Wrap an object so that reading or writing a member it does not define throws.
 *
 * @param target - The object that models the API.
 * @param kind - What the object stands for, for the error.
 * @returns The guarded object.
 */
function guard<Target extends object>(target: Target, kind: string): Target {
  return new Proxy(target, {
    get: (object, property) => {
      if (property in object) {
        // SAFETY: the `in` check found the member on the object or its prototype chain.
        return object[property as keyof Target];
      }
      if (isIntrospection(property)) {
        return undefined;
      }
      throw new Error(`The fake Figma file does not model ${kind}.${String(property)}.`);
    },
    set: (object, property, value) => {
      if (!(property in object)) {
        throw new Error(`The fake Figma file does not model writing ${kind}.${String(property)}.`);
      }
      if (!Reflect.set(object, property, value)) {
        throw new Error(`${kind}.${String(property)} is read-only.`);
      }
      return true;
    },
  });
}

const f32 = Math.fround;

// SAFETY: `figma.mixed` is a symbol the plugin compares by identity, and this file makes one.
const MIXED: PluginAPI["mixed"] = Symbol("figma.mixed") as PluginAPI["mixed"];

/** A node a plugin holds, or the object behind it. */
type NodeHandle = BaseNode | FakeBaseNode;

function stateOf(node: NodeHandle): NodeState {
  const state = STATES.get(node);
  if (state === undefined) {
    throw new Error("The fake Figma file was handed a node it did not make.");
  }
  return state;
}

/** The node's state, refusing a node that was removed, as Figma does. */
function live(node: NodeHandle): NodeState {
  const state = stateOf(node);
  if (state.removed) {
    throw new Error(`The node with id ${state.id} does not exist: it was removed.`);
  }
  return state;
}

function write(state: NodeState, what: string): void {
  state.file.writes.push(`${state.id} ${what}`);
}

function sceneOf(state: NodeState): SceneNode {
  const node = state.exposed;
  if (node.type === "DOCUMENT" || node.type === "PAGE") {
    throw new Error(`${state.id} is a ${node.type}, not a layer.`);
  }
  return node;
}

function pageOf(state: NodeState): PageNode {
  const node = state.exposed;
  if (node.type !== "PAGE") {
    throw new Error(`${state.id} is a ${node.type}, not a page.`);
  }
  return node;
}

function componentOf(state: NodeState): ComponentNode {
  const node = state.exposed;
  if (node.type !== "COMPONENT") {
    throw new Error(`${state.id} is a ${node.type}, not a component.`);
  }
  return node;
}

function isFrameLike(state: NodeState): boolean {
  return (
    state.type === "FRAME" ||
    state.type === "COMPONENT" ||
    state.type === "COMPONENT_SET" ||
    state.type === "INSTANCE"
  );
}

function isAutoLayout(state: NodeState | undefined): boolean {
  return state !== undefined && isFrameLike(state) && state.layoutMode !== "NONE";
}

/** A component's key, which Figma derives from the node and keeps across edits. */
function componentKey(state: NodeState): string {
  let hash = 0x811c9dc5;
  for (const character of state.id) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, "0")}${state.id.replaceAll(":", "")}`;
}

function fontKey(font: FontNameInput): string {
  return `${font.family}${SHARED_DATA_SEPARATOR}${font.style ?? ""}`;
}

function fontLoaded(file: FileState, font: FontName): boolean {
  return file.loadedFonts.has(fontKey(font)) || file.loadedFonts.has(fontKey({ family: font.family }));
}

function requireFont(state: NodeState, font: FontName, what: string): void {
  if (!fontLoaded(state.file, font)) {
    throw new Error(
      `Cannot write ${what} of ${state.id} with unloaded font "${font.family} ${font.style}". Please call figma.loadFontAsync({ family: "${font.family}", style: "${font.style}" }) and await the returned promise first.`
    );
  }
}

/** The children a node shows, an instance's sublayers included. */
function childrenOf(state: NodeState): NodeState[] {
  if (state.type === "PAGE" && !state.loaded) {
    throw new Error(
      `The page ${state.name} is not loaded. Under "documentAccess": "dynamic-page", call page.loadAsync() before reading its children.`
    );
  }
  const source = state.type === "INSTANCE" ? state.main : state.mirrorOf;
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
function mirror(state: NodeState, source: NodeState, swapped: boolean): void {
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

function markRemoved(state: NodeState): void {
  state.removed = true;
  for (const child of state.children) {
    markRemoved(child);
  }
}

function detach(state: NodeState): void {
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
function insert(parent: NodeState, child: NodeState, index: number | undefined): void {
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

function descendants(state: NodeState): NodeState[] {
  return childrenOf(state).flatMap((child) => [child, ...descendants(child)]);
}

function findOne(state: NodeState, callback: (node: SceneNode) => boolean): SceneNode | null {
  const found = descendants(state).find((node) => callback(sceneOf(node)));
  return found === undefined ? null : sceneOf(found);
}

function findAll(state: NodeState, callback?: (node: SceneNode) => boolean): SceneNode[] {
  return descendants(state)
    .map(sceneOf)
    .filter((node) => callback === undefined || callback(node));
}

function findChild(state: NodeState, callback: (node: SceneNode) => boolean): SceneNode | null {
  const found = childrenOf(state).find((node) => callback(sceneOf(node)));
  return found === undefined ? null : sceneOf(found);
}

/** The mode a node reads a collection in: the nearest pinned one, or the default. */
function modeFor(consumer: NodeState | undefined, collection: CollectionState): string {
  for (let current = consumer; current !== undefined; current = current.parent) {
    const pinned = current.explicitModes.get(collection.id);
    if (pinned !== undefined) {
      return pinned;
    }
  }
  return collection.defaultModeId;
}

function variableState(file: FileState, id: string): VariableState {
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

function resolveColor(file: FileState, variable: VariableState, consumer: NodeState | undefined): RGBA {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "color") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a color.`);
  }
  return value.color;
}

function resolveNumber(file: FileState, variable: VariableState, consumer: NodeState | undefined): number {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "float") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a number.`);
  }
  return value.value;
}

function resolveString(file: FileState, variable: VariableState, consumer: NodeState | undefined): string {
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

function alias(id: string): VariableAlias {
  return { type: "VARIABLE_ALIAS", id };
}

/** The variable a plugin hands the fake, which must be one the file holds. */
function fileVariable(file: FileState, variable: Variable): VariableState {
  return variableState(file, variable.id);
}

function requireType(variable: VariableState, type: VariableResolvedDataType, field: string): void {
  if (variable.resolvedType !== type) {
    throw new Error(
      `Cannot bind the ${variable.resolvedType} variable ${variable.name} to ${field}, which takes a ${type}.`
    );
  }
}

/** A paint as Figma stores it: 32-bit channels and the documented defaults filled in. */
function storePaint(paint: Paint): Paint {
  if (paint.type !== "SOLID") {
    return paint;
  }
  return {
    ...paint,
    color: { r: f32(paint.color.r), g: f32(paint.color.g), b: f32(paint.color.b) },
    opacity: f32(paint.opacity ?? 1),
    visible: paint.visible ?? true,
    blendMode: paint.blendMode ?? "NORMAL",
  };
}

function storeRgba(color: RGBA): RGBA {
  return { r: f32(color.r), g: f32(color.g), b: f32(color.b), a: f32(color.a) };
}

/** The variable ids an effect list binds to shadow colors. */
function heldColorBindings(effects: readonly Effect[]): ReadonlySet<string> {
  return new Set(
    effects.flatMap((effect) =>
      (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") &&
      effect.boundVariables?.color !== undefined
        ? [effect.boundVariables.color.id]
        : []
    )
  );
}

/** An effect as the node stores it under rule 2. */
function storeEffect(state: NodeState, effect: Effect, held: ReadonlySet<string>): Effect {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    return effect;
  }
  const bound = effect.boundVariables?.color?.id;
  const color =
    bound === undefined || held.has(bound)
      ? effect.color
      : resolveColor(state.file, variableState(state.file, bound), state);
  return {
    ...effect,
    color: storeRgba(color),
    offset: { x: f32(effect.offset.x), y: f32(effect.offset.y) },
    radius: f32(effect.radius),
    spread: f32(effect.spread ?? 0),
  };
}

/** Resize a node, and turn an auto layout frame's sizing modes to FIXED (rule 5). */
function resize(state: NodeState, width: number, height: number): void {
  if (width < 0.01 || height < 0.01) {
    throw new Error(`Cannot resize ${state.id} to ${width} × ${height}: both must be at least 0.01.`);
  }
  state.width = f32(width);
  state.height = f32(height);
  if (isAutoLayout(state)) {
    state.primaryAxisSizingMode = "FIXED";
    state.counterAxisSizingMode = "FIXED";
  }
}

function rescale(state: NodeState, scale: number): void {
  state.x = f32(state.x * scale);
  state.y = f32(state.y * scale);
  state.width = f32(state.width * scale);
  state.height = f32(state.height * scale);
  for (const child of state.children) {
    rescale(child, scale);
  }
}

function requireAutoLayoutOrChild(state: NodeState, field: string): void {
  if (!isAutoLayout(state) && !isAutoLayout(state.parent)) {
    throw new Error(
      `${field} applies only to auto layout frames and their children, and ${state.id} is neither.`
    );
  }
}

/** Write the number a node field takes, as a binding or a literal write does. */
function setNumberField(state: NodeState, field: VariableBindableNodeField, value: number): void {
  switch (field) {
    case "width":
      resize(state, value, state.height);
      return;
    case "height":
      resize(state, state.width, value);
      return;
    case "minWidth":
      requireAutoLayoutOrChild(state, "minWidth");
      state.minWidth = f32(value);
      return;
    case "itemSpacing":
      state.itemSpacing = f32(value);
      return;
    case "counterAxisSpacing":
      state.counterAxisSpacing = f32(value);
      return;
    case "paddingTop":
      state.padding.top = f32(value);
      return;
    case "paddingRight":
      state.padding.right = f32(value);
      return;
    case "paddingBottom":
      state.padding.bottom = f32(value);
      return;
    case "paddingLeft":
      state.padding.left = f32(value);
      return;
    case "topLeftRadius":
      state.radii.topLeft = f32(value);
      return;
    case "topRightRadius":
      state.radii.topRight = f32(value);
      return;
    case "bottomRightRadius":
      state.radii.bottomRight = f32(value);
      return;
    case "bottomLeftRadius":
      state.radii.bottomLeft = f32(value);
      return;
    case "strokeTopWeight":
      state.strokeWeights.top = f32(value);
      return;
    case "strokeRightWeight":
      state.strokeWeights.right = f32(value);
      return;
    case "strokeBottomWeight":
      state.strokeWeights.bottom = f32(value);
      return;
    case "strokeLeftWeight":
      state.strokeWeights.left = f32(value);
      return;
    case "opacity":
      state.opacity = f32(value);
      return;
    default:
      throw new Error(`The fake Figma file does not model binding ${field}.`);
  }
}

/** The fields a binding to `cornerRadius` or `strokeWeight` lands on, as the typings note. */
function bindingTargets(field: BindableField): readonly BindableField[] {
  switch (field) {
    case "cornerRadius":
      return ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
    case "strokeWeight":
      return ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
    default:
      return [field];
  }
}

const TEXT_FIELDS: ReadonlySet<string> = new Set<VariableBindableTextField>([
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent",
]);

function isTextField(field: BindableField): field is VariableBindableTextField {
  return TEXT_FIELDS.has(field);
}

/** Bind or unbind a field of a layer that is not text. */
function bindNodeField(state: NodeState, field: VariableBindableNodeField, variable: Variable | null): void {
  const targets = bindingTargets(field);
  if (variable === null) {
    for (const target of targets) {
      state.bindings.delete(target);
    }
    write(state, `unbind ${field}`);
    return;
  }
  const bound = fileVariable(state.file, variable);
  requireType(bound, "FLOAT", field);
  const value = resolveNumber(state.file, bound, state);
  for (const target of targets) {
    if (isTextField(target)) {
      throw new Error(`${state.id} is a ${state.type}, which has no ${target}.`);
    }
    setNumberField(state, target, value);
    state.bindings.set(target, bound.id);
  }
  write(state, `bind ${field}`);
}

/** The fonts a text layer holds. The fake gives every character the layer's one font. */
function heldFonts(state: NodeState): readonly FontName[] {
  return [state.fontName];
}

function requireHeldFonts(state: NodeState, what: string): void {
  for (const font of heldFonts(state)) {
    requireFont(state, font, what);
  }
}

/** Bind or unbind a field of a text layer (rule 7 for the fonts it touches). */
function bindTextField(state: NodeState, field: BindableField, variable: Variable | null): void {
  if (!isTextField(field)) {
    if (field === "characters") {
      throw new Error("The fake Figma file does not model binding characters.");
    }
    bindNodeField(state, field, variable);
    return;
  }
  if (variable === null) {
    state.bindings.delete(field);
    write(state, `unbind ${field}`);
    return;
  }
  requireHeldFonts(state, field);
  const bound = fileVariable(state.file, variable);
  switch (field) {
    case "fontFamily": {
      requireType(bound, "STRING", field);
      const font = { family: resolveString(state.file, bound, state), style: state.fontName.style };
      requireFont(state, font, field);
      state.fontName = font;
      break;
    }
    case "fontStyle": {
      requireType(bound, "STRING", field);
      const font = { family: state.fontName.family, style: resolveString(state.file, bound, state) };
      requireFont(state, font, field);
      state.fontName = font;
      break;
    }
    case "fontSize":
      requireType(bound, "FLOAT", field);
      state.fontSize = f32(resolveNumber(state.file, bound, state));
      break;
    case "lineHeight":
      requireType(bound, "FLOAT", field);
      state.lineHeight = { unit: "PIXELS", value: f32(resolveNumber(state.file, bound, state)) };
      break;
    default:
      throw new Error(`The fake Figma file does not model binding ${field}.`);
  }
  state.bindings.set(field, bound.id);
  write(state, `bind ${field}`);
}

function nodeBindings(state: NodeState): NonNullable<FrameNode["boundVariables"]> {
  const nodeFields: { [field in VariableBindableNodeField]?: VariableAlias } = {};
  const textFields: { [field in VariableBindableTextField]?: VariableAlias[] } = {};
  for (const [field, id] of state.bindings) {
    if (isTextField(field)) {
      textFields[field] = [alias(id)];
    } else {
      nodeFields[field] = alias(id);
    }
  }
  return { ...nodeFields, ...textFields };
}

/** The node a layer's property link reads from: its component set, or its component. */
function propertyOwner(state: NodeState): NodeState | undefined {
  for (let current = state.parent; current !== undefined; current = current.parent) {
    if (current.type === "COMPONENT_SET") {
      return current;
    }
    if (current.type === "COMPONENT") {
      return current.parent?.type === "COMPONENT_SET" ? current.parent : current;
    }
  }
  return undefined;
}

const LINKED_TYPES = new Map<string, ComponentPropertyType>([
  ["characters", "TEXT"],
  ["mainComponent", "INSTANCE_SWAP"],
  ["visible", "BOOLEAN"],
]);

function linkProperties(state: NodeState, references: FrameNode["componentPropertyReferences"]): void {
  if (references === null) {
    state.propertyReferences = null;
    write(state, "componentPropertyReferences");
    return;
  }
  const owner = propertyOwner(state);
  for (const [nodeProperty, propertyId] of Object.entries(references)) {
    const type = LINKED_TYPES.get(nodeProperty);
    if (type === undefined) {
      throw new Error(`The fake Figma file does not model linking ${nodeProperty}.`);
    }
    if (owner === undefined) {
      throw new Error(`${state.id} links ${propertyId}, but it sits in no component.`);
    }
    const definition = definitions(owner)[propertyId];
    if (definition?.type !== type) {
      throw new Error(
        `${state.id} links ${nodeProperty} to ${propertyId}, which is no ${type} property of ${owner.id}.`
      );
    }
  }
  state.propertyReferences = { ...references };
  write(state, "componentPropertyReferences");
}

/** A variant's property values, read from its name, or undefined for a name without them. */
function variantValues(name: string): ReadonlyMap<string, string> | undefined {
  const pairs = name.split(",").map((part) => part.trim().split("="));
  if (pairs.some((pair) => pair.length !== 2)) {
    return undefined;
  }
  return new Map(pairs.map(([property = "", value = ""]) => [property.trim(), value.trim()]));
}

/** The top-left variant of a set (rule 4). */
function defaultVariant(set: NodeState): NodeState {
  const [first, ...rest] = set.children;
  if (first === undefined) {
    throw new Error(`The component set ${set.id} holds no variants.`);
  }
  return rest.reduce(
    (best, child) => (child.y < best.y || (child.y === best.y && child.x < best.x) ? child : best),
    first
  );
}

/**
 * Keep a renamed variant's value in the slot of the value it replaced, when no other variant
 * still shows that value (rule 4).
 */
function renameVariantValues(
  set: NodeState,
  variant: NodeState,
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string> | undefined
): void {
  for (const [property, old] of before) {
    const renamed = after?.get(property);
    const order = set.variantOrder.get(property);
    const shown = set.children.some(
      (child) => child !== variant && variantValues(child.name)?.get(property) === old
    );
    if (renamed === undefined || renamed === old || order === undefined || shown || order.includes(renamed)) {
      continue;
    }
    set.variantOrder.set(
      property,
      order.map((value) => (value === old ? renamed : value))
    );
  }
}

/**
 * A set's variant properties and their values in the set's own order: the values it still shows
 * keep their places, and a value it shows for the first time goes last (rule 4).
 */
function variantOptions(set: NodeState): Map<string, string[]> {
  const shown = new Map<string, string[]>();
  for (const child of set.children) {
    for (const [property, value] of variantValues(child.name) ?? []) {
      const values = shown.get(property) ?? [];
      if (!values.includes(value)) {
        values.push(value);
      }
      shown.set(property, values);
    }
  }
  for (const [property, values] of shown) {
    const kept = (set.variantOrder.get(property) ?? []).filter((value) => values.includes(value));
    set.variantOrder.set(property, [...kept, ...values.filter((value) => !kept.includes(value))]);
  }
  return new Map([...shown.keys()].map((property) => [property, set.variantOrder.get(property) ?? []]));
}

/** A set's or a component's property definitions, the variant properties first (rule 4). */
function definitions(state: NodeState): ComponentPropertyDefinitions {
  const result: ComponentPropertyDefinitions = {};
  if (state.type === "COMPONENT_SET") {
    const top = variantValues(defaultVariant(state).name);
    for (const [property, values] of variantOptions(state)) {
      result[property] = { type: "VARIANT", defaultValue: top?.get(property) ?? "", variantOptions: values };
    }
  }
  for (const [id, property] of state.properties) {
    result[id] =
      property.preferredValues === undefined
        ? { type: property.type, defaultValue: property.defaultValue }
        : {
            type: property.type,
            defaultValue: property.defaultValue,
            preferredValues: [...property.preferredValues],
          };
  }
  return result;
}

function requirePropertyHolder(state: NodeState): void {
  if (state.type === "COMPONENT" && state.parent?.type === "COMPONENT_SET") {
    throw new Error(`${state.id} is a variant. Read and change the properties of its component set instead.`);
  }
}

function componentWithId(file: FileState, id: string): NodeState {
  const found = file.nodes.get(id);
  if (found?.type !== "COMPONENT" || found.removed) {
    throw new Error(`An INSTANCE_SWAP property must start with a component, and ${id} is none.`);
  }
  return found;
}

function checkPreferred(file: FileState, preferred: readonly InstanceSwapPreferredValue[]): void {
  const keys = new Set(
    [...file.nodes.values()]
      .filter((node) => node.type === "COMPONENT" && !node.removed)
      .map((node) => componentKey(node))
  );
  for (const value of preferred) {
    if (value.type !== "COMPONENT" || !keys.has(value.key)) {
      throw new Error(`The preferred value ${value.key} is no component of the file.`);
    }
  }
}

function addProperty(
  state: NodeState,
  name: string,
  type: ComponentPropertyType,
  defaultValue: string | boolean | VariableAlias,
  options: ComponentPropertyOptions | undefined
): string {
  requirePropertyHolder(state);
  if (type !== "TEXT" && type !== "BOOLEAN" && type !== "INSTANCE_SWAP") {
    throw new Error(`The fake Figma file does not model adding a ${type} property.`);
  }
  const value = checkedDefault(state.file, type, defaultValue);
  const preferred = options?.preferredValues;
  if (preferred !== undefined) {
    checkPreferred(state.file, preferred);
  }
  state.file.nextProperty += 1;
  const id = `${name}#${state.file.nextProperty}:0`;
  state.properties.set(id, {
    type,
    defaultValue: value,
    preferredValues: preferred === undefined ? undefined : [...preferred],
  });
  write(state, `add the property ${id}`);
  return id;
}

function isText(value: string | VariableAlias): value is string {
  return !(value instanceof Object);
}

function checkedDefault(
  file: FileState,
  type: PropertyState["type"],
  value: string | boolean | VariableAlias
): string | boolean {
  if (value === true || value === false) {
    if (type !== "BOOLEAN") {
      throw new Error(`A ${type} property cannot start with a boolean.`);
    }
    return value;
  }
  if (isText(value)) {
    if (type === "INSTANCE_SWAP") {
      componentWithId(file, value);
    } else if (type === "BOOLEAN") {
      throw new Error("A BOOLEAN property must start with a boolean.");
    }
    return value;
  }
  throw new Error("The fake Figma file does not model a property that starts with a variable.");
}

function editProperty(
  state: NodeState,
  id: string,
  edit: Parameters<ComponentSetNode["editComponentProperty"]>[1]
): string {
  requirePropertyHolder(state);
  const property = state.properties.get(id);
  if (property === undefined) {
    throw new Error(`${state.id} has no property ${id} to edit.`);
  }
  if (edit.description !== undefined || edit.slotSettings !== undefined) {
    throw new Error("The fake Figma file does not model slot properties.");
  }
  const preferred = edit.preferredValues;
  if (preferred !== undefined) {
    if (property.type !== "INSTANCE_SWAP") {
      throw new Error(
        `Only an INSTANCE_SWAP property takes preferred values, and ${id} is a ${property.type}.`
      );
    }
    checkPreferred(state.file, preferred);
  }
  const edited: PropertyState = {
    type: property.type,
    defaultValue:
      edit.defaultValue === undefined
        ? property.defaultValue
        : checkedDefault(state.file, property.type, edit.defaultValue),
    preferredValues: preferred === undefined ? property.preferredValues : [...preferred],
  };
  const renamed = edit.name === undefined ? id : `${edit.name}#${id.split("#")[1] ?? ""}`;
  state.properties.delete(id);
  state.properties.set(renamed, edited);
  write(state, `edit the property ${id}`);
  return renamed;
}

/** A copy of a node and its layers, as a duplicate or an instance's sublayer gets. */
function copyNode(file: FileState, source: NodeState, type: NodeType, id?: string): NodeState {
  const copy = createNode(file, type, source.name, id);
  copy.x = source.x;
  copy.y = source.y;
  copy.width = source.width;
  copy.height = source.height;
  copy.opacity = source.opacity;
  copy.constraints = source.constraints;
  copy.fills = source.fills;
  copy.strokes = source.strokes;
  copy.strokeWeights = { ...source.strokeWeights };
  copy.strokeAlign = source.strokeAlign;
  copy.strokesIncludedInLayout = source.strokesIncludedInLayout;
  copy.effects = source.effects;
  copy.radii = { ...source.radii };
  copy.clipsContent = source.clipsContent;
  copy.layoutMode = source.layoutMode;
  copy.layoutWrap = source.layoutWrap;
  copy.primaryAxisSizingMode = source.primaryAxisSizingMode;
  copy.counterAxisSizingMode = source.counterAxisSizingMode;
  copy.primaryAxisAlignItems = source.primaryAxisAlignItems;
  copy.counterAxisAlignItems = source.counterAxisAlignItems;
  copy.padding = { ...source.padding };
  copy.itemSpacing = source.itemSpacing;
  copy.counterAxisSpacing = source.counterAxisSpacing;
  copy.minWidth = source.minWidth;
  for (const [field, variable] of source.bindings) {
    copy.bindings.set(field, variable);
  }
  for (const [collection, mode] of source.explicitModes) {
    copy.explicitModes.set(collection, mode);
  }
  copy.propertyReferences = source.propertyReferences === null ? null : { ...source.propertyReferences };
  copy.main = source.main;
  copy.characters = source.characters;
  copy.fontName = source.fontName;
  copy.fontSize = source.fontSize;
  copy.lineHeight = source.lineHeight;
  copy.textDecoration = source.textDecoration;
  copy.textDecorationOffset = source.textDecorationOffset;
  copy.textAutoResize = source.textAutoResize;
  copy.autoRename = source.autoRename;
  return copy;
}

/** A duplicate of a node with its layers and its shared plugin data, as Figma's clone makes. */
function duplicate(file: FileState, source: NodeState): NodeState {
  const copy = copyNode(file, source, source.type);
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
function placeOnCurrentPage(file: FileState, state: NodeState): void {
  const page = file.current;
  if (page === undefined) {
    throw new Error("The fake Figma file has no current page.");
  }
  insert(page, state, undefined);
}

/** The members every node has. */
class FakeBaseNode {
  get id(): string {
    return stateOf(this).id;
  }

  get removed(): boolean {
    return stateOf(this).removed;
  }

  get name(): string {
    return live(this).name;
  }

  set name(value: string) {
    const state = live(this);
    write(state, "name");
    const set = state.parent?.type === "COMPONENT_SET" ? state.parent : undefined;
    const before = set === undefined ? undefined : variantValues(state.name);
    state.name = value;
    state.autoRename = false;
    if (set !== undefined && before !== undefined) {
      renameVariantValues(set, state, before, variantValues(value));
    }
  }

  getSharedPluginData(namespace: string, key: string): string {
    return live(this).sharedData.get(`${namespace}${SHARED_DATA_SEPARATOR}${key}`) ?? "";
  }

  setSharedPluginData(namespace: string, key: string, value: string): void {
    const state = live(this);
    write(state, `shared plugin data ${namespace}/${key}`);
    const entry = `${namespace}${SHARED_DATA_SEPARATOR}${key}`;
    if (value === "") {
      state.sharedData.delete(entry);
    } else {
      state.sharedData.set(entry, value);
    }
  }
}

class FakeDocument extends FakeBaseNode {
  get type(): "DOCUMENT" {
    return "DOCUMENT";
  }

  get children(): ReadonlyArray<PageNode> {
    return live(this).children.map(pageOf);
  }
}

class FakePage extends FakeBaseNode {
  get type(): "PAGE" {
    return "PAGE";
  }

  get children(): ReadonlyArray<SceneNode> {
    return childrenOf(live(this)).map(sceneOf);
  }

  appendChild(child: SceneNode): void {
    insert(live(this), live(child), undefined);
  }

  insertChild(index: number, child: SceneNode): void {
    insert(live(this), live(child), index);
  }

  findOne(callback: (node: SceneNode) => boolean): SceneNode | null {
    return findOne(live(this), callback);
  }

  findAll(callback?: (node: SceneNode) => boolean): SceneNode[] {
    return findAll(live(this), callback);
  }

  findChild(callback: (node: SceneNode) => boolean): SceneNode | null {
    return findChild(live(this), callback);
  }

  get explicitVariableModes(): { [collectionId: string]: string } {
    return Object.fromEntries(live(this).explicitModes);
  }

  setExplicitVariableModeForCollection(collection: VariableCollection, modeId: string): void {
    pinMode(live(this), collection, modeId);
  }

  loadAsync(): Promise<void> {
    live(this).loaded = true;
    return Promise.resolve();
  }
}

/**
 * Pin a collection's mode on a node. The typings deprecate passing a collection id, which
 * throws under `"documentAccess": "dynamic-page"`, so the fake takes only a collection.
 */
function pinMode(state: NodeState, collection: VariableCollection, modeId: string): void {
  const found = state.file.collections.find((candidate) => candidate.id === collection.id);
  if (found === undefined || !found.modes.some((mode) => mode.modeId === modeId)) {
    throw new Error(`The file has no collection ${String(collection.id)} with a mode ${modeId}.`);
  }
  write(state, `pin ${found.name} to ${modeId}`);
  state.explicitModes.set(found.id, modeId);
}

/** The members every layer has. */
class FakeSceneNode extends FakeBaseNode {
  remove(): void {
    const state = live(this);
    if (state.mirrorOf !== undefined) {
      throw new Error(`Cannot remove ${state.id}, a layer inside an instance.`);
    }
    write(state, "remove");
    detach(state);
    markRemoved(state);
  }

  get x(): number {
    return live(this).x;
  }

  set x(value: number) {
    const state = live(this);
    // The typings: an auto layout frame places its children, and a write to their x is a no-op.
    if (!isAutoLayout(state.parent)) {
      write(state, "x");
      state.x = f32(value);
    }
  }

  get y(): number {
    return live(this).y;
  }

  set y(value: number) {
    const state = live(this);
    if (!isAutoLayout(state.parent)) {
      write(state, "y");
      state.y = f32(value);
    }
  }

  get width(): number {
    return live(this).width;
  }

  get height(): number {
    return live(this).height;
  }

  resize(width: number, height: number): void {
    const state = live(this);
    resize(state, width, height);
    write(state, "resize");
  }

  resizeWithoutConstraints(width: number, height: number): void {
    const state = live(this);
    resize(state, width, height);
    write(state, "resizeWithoutConstraints");
  }

  rescale(scale: number): void {
    const state = live(this);
    if (scale < 0.01) {
      throw new Error(`Cannot rescale ${state.id} by ${scale}: the scale must be at least 0.01.`);
    }
    write(state, "rescale");
    rescale(state, scale);
  }

  get opacity(): number {
    return live(this).opacity;
  }

  set opacity(value: number) {
    const state = live(this);
    write(state, "opacity");
    state.opacity = f32(value);
  }

  get constraints(): Constraints {
    return live(this).constraints;
  }

  set constraints(value: Constraints) {
    const state = live(this);
    write(state, "constraints");
    state.constraints = { ...value };
  }

  get boundVariables(): FrameNode["boundVariables"] {
    return nodeBindings(live(this));
  }

  setBoundVariable(field: BindableField, variable: Variable | null): void {
    const state = live(this);
    if (isTextField(field)) {
      throw new Error(`${state.id} is a ${state.type}, which has no ${field}.`);
    }
    if (field === "characters") {
      throw new Error(`${state.id} is a ${state.type}, which has no characters.`);
    }
    bindNodeField(state, field, variable);
  }

  get componentPropertyReferences(): FrameNode["componentPropertyReferences"] {
    const references = live(this).propertyReferences;
    return references === null ? null : { ...references };
  }

  set componentPropertyReferences(references: FrameNode["componentPropertyReferences"]) {
    linkProperties(live(this), references);
  }

  get explicitVariableModes(): { [collectionId: string]: string } {
    return Object.fromEntries(live(this).explicitModes);
  }

  setExplicitVariableModeForCollection(collection: VariableCollection, modeId: string): void {
    pinMode(live(this), collection, modeId);
  }
}

/** The members of frames, components, component sets and instances. */
class FakeFrameLikeNode extends FakeSceneNode {
  get children(): ReadonlyArray<SceneNode> {
    return childrenOf(live(this)).map(sceneOf);
  }

  appendChild(child: SceneNode): void {
    insert(live(this), live(child), undefined);
  }

  insertChild(index: number, child: SceneNode): void {
    insert(live(this), live(child), index);
  }

  findOne(callback: (node: SceneNode) => boolean): SceneNode | null {
    return findOne(live(this), callback);
  }

  findAll(callback?: (node: SceneNode) => boolean): SceneNode[] {
    return findAll(live(this), callback);
  }

  findChild(callback: (node: SceneNode) => boolean): SceneNode | null {
    return findChild(live(this), callback);
  }

  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return live(this).fills;
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    const state = live(this);
    if (paints === MIXED) {
      throw new Error("Cannot write figma.mixed as fills.");
    }
    write(state, "fills");
    state.fills = paints.map(storePaint);
  }

  get strokes(): ReadonlyArray<Paint> {
    return live(this).strokes;
  }

  set strokes(paints: ReadonlyArray<Paint>) {
    const state = live(this);
    write(state, "strokes");
    state.strokes = paints.map(storePaint);
  }

  get strokeWeight(): number | PluginAPI["mixed"] {
    const { top, right, bottom, left } = live(this).strokeWeights;
    return top === right && right === bottom && bottom === left ? top : MIXED;
  }

  set strokeWeight(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a stroke weight.");
    }
    write(state, "strokeWeight");
    const weight = f32(value);
    state.strokeWeights = { top: weight, right: weight, bottom: weight, left: weight };
  }

  get strokeTopWeight(): number {
    return live(this).strokeWeights.top;
  }

  get strokeRightWeight(): number {
    return live(this).strokeWeights.right;
  }

  get strokeBottomWeight(): number {
    return live(this).strokeWeights.bottom;
  }

  get strokeLeftWeight(): number {
    return live(this).strokeWeights.left;
  }

  get strokeAlign(): FrameNode["strokeAlign"] {
    return live(this).strokeAlign;
  }

  set strokeAlign(value: FrameNode["strokeAlign"]) {
    const state = live(this);
    write(state, "strokeAlign");
    state.strokeAlign = value;
  }

  get strokesIncludedInLayout(): boolean {
    return live(this).strokesIncludedInLayout;
  }

  set strokesIncludedInLayout(value: boolean) {
    const state = live(this);
    write(state, "strokesIncludedInLayout");
    state.strokesIncludedInLayout = value;
  }

  get effects(): ReadonlyArray<Effect> {
    return live(this).effects;
  }

  /** Rule 2: a new color binding stores the variable's value, a held one keeps the color written. */
  set effects(effects: ReadonlyArray<Effect>) {
    const state = live(this);
    write(state, "effects");
    const held = heldColorBindings(state.effects);
    state.effects = effects.map((effect) => storeEffect(state, effect, held));
  }

  get cornerRadius(): number | PluginAPI["mixed"] {
    const { topLeft, topRight, bottomRight, bottomLeft } = live(this).radii;
    return topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft ? topLeft : MIXED;
  }

  set cornerRadius(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a corner radius.");
    }
    write(state, "cornerRadius");
    const radius = f32(value);
    state.radii = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
  }

  get topLeftRadius(): number {
    return live(this).radii.topLeft;
  }

  get topRightRadius(): number {
    return live(this).radii.topRight;
  }

  get bottomRightRadius(): number {
    return live(this).radii.bottomRight;
  }

  get bottomLeftRadius(): number {
    return live(this).radii.bottomLeft;
  }

  get clipsContent(): boolean {
    return live(this).clipsContent;
  }

  set clipsContent(value: boolean) {
    const state = live(this);
    write(state, "clipsContent");
    state.clipsContent = value;
  }

  get layoutMode(): FrameNode["layoutMode"] {
    return live(this).layoutMode;
  }

  set layoutMode(value: FrameNode["layoutMode"]) {
    const state = live(this);
    write(state, "layoutMode");
    state.layoutMode = value;
  }

  get layoutWrap(): FrameNode["layoutWrap"] {
    return live(this).layoutWrap;
  }

  set layoutWrap(value: FrameNode["layoutWrap"]) {
    const state = live(this);
    if (state.layoutMode !== "HORIZONTAL" && state.layoutMode !== "VERTICAL") {
      throw new Error(
        `layoutWrap needs a horizontal or vertical auto layout, and ${state.id} has ${state.layoutMode}.`
      );
    }
    write(state, "layoutWrap");
    state.layoutWrap = value;
  }

  get primaryAxisSizingMode(): FrameNode["primaryAxisSizingMode"] {
    return live(this).primaryAxisSizingMode;
  }

  set primaryAxisSizingMode(value: FrameNode["primaryAxisSizingMode"]) {
    const state = live(this);
    write(state, "primaryAxisSizingMode");
    state.primaryAxisSizingMode = value;
  }

  get counterAxisSizingMode(): FrameNode["counterAxisSizingMode"] {
    return live(this).counterAxisSizingMode;
  }

  set counterAxisSizingMode(value: FrameNode["counterAxisSizingMode"]) {
    const state = live(this);
    write(state, "counterAxisSizingMode");
    state.counterAxisSizingMode = value;
  }

  get primaryAxisAlignItems(): FrameNode["primaryAxisAlignItems"] {
    return live(this).primaryAxisAlignItems;
  }

  set primaryAxisAlignItems(value: FrameNode["primaryAxisAlignItems"]) {
    const state = live(this);
    write(state, "primaryAxisAlignItems");
    state.primaryAxisAlignItems = value;
  }

  get counterAxisAlignItems(): FrameNode["counterAxisAlignItems"] {
    return live(this).counterAxisAlignItems;
  }

  set counterAxisAlignItems(value: FrameNode["counterAxisAlignItems"]) {
    const state = live(this);
    write(state, "counterAxisAlignItems");
    state.counterAxisAlignItems = value;
  }

  get paddingTop(): number {
    return live(this).padding.top;
  }

  set paddingTop(value: number) {
    const state = live(this);
    write(state, "paddingTop");
    state.padding.top = f32(value);
  }

  get paddingRight(): number {
    return live(this).padding.right;
  }

  set paddingRight(value: number) {
    const state = live(this);
    write(state, "paddingRight");
    state.padding.right = f32(value);
  }

  get paddingBottom(): number {
    return live(this).padding.bottom;
  }

  set paddingBottom(value: number) {
    const state = live(this);
    write(state, "paddingBottom");
    state.padding.bottom = f32(value);
  }

  get paddingLeft(): number {
    return live(this).padding.left;
  }

  set paddingLeft(value: number) {
    const state = live(this);
    write(state, "paddingLeft");
    state.padding.left = f32(value);
  }

  get itemSpacing(): number {
    return live(this).itemSpacing;
  }

  set itemSpacing(value: number) {
    const state = live(this);
    write(state, "itemSpacing");
    state.itemSpacing = f32(value);
  }

  get counterAxisSpacing(): number | null {
    return live(this).counterAxisSpacing;
  }

  set counterAxisSpacing(value: number | null) {
    const state = live(this);
    write(state, "counterAxisSpacing");
    state.counterAxisSpacing = value === null ? null : f32(value);
  }

  get minWidth(): number | null {
    return live(this).minWidth;
  }

  set minWidth(value: number | null) {
    const state = live(this);
    if (value !== null) {
      requireAutoLayoutOrChild(state, "minWidth");
    }
    write(state, "minWidth");
    state.minWidth = value === null ? null : f32(value);
  }
}

class FakeFrame extends FakeFrameLikeNode {
  get type(): "FRAME" {
    return "FRAME";
  }
}

class FakeComponent extends FakeFrameLikeNode {
  get type(): "COMPONENT" {
    return "COMPONENT";
  }

  get key(): string {
    return componentKey(live(this));
  }

  createInstance(): InstanceNode {
    const main = live(this);
    const instance = copyNode(main.file, main, "INSTANCE");
    instance.main = main;
    instance.bindings.clear();
    instance.propertyReferences = null;
    placeOnCurrentPage(main.file, instance);
    write(instance, `create an instance of ${main.id}`);
    const node = instance.exposed;
    if (node.type !== "INSTANCE") {
      throw new Error(`${instance.id} is a ${node.type}, not an instance.`);
    }
    return node;
  }

  clone(): ComponentNode {
    const state = live(this);
    const copy = duplicate(state.file, state);
    placeOnCurrentPage(state.file, copy);
    write(copy, `duplicate ${state.id}`);
    return componentOf(copy);
  }

  get variantProperties(): { [property: string]: string } | null {
    const state = live(this);
    const values = state.parent?.type === "COMPONENT_SET" ? variantValues(state.name) : undefined;
    return values === undefined ? null : Object.fromEntries(values);
  }

  get componentPropertyDefinitions(): ComponentPropertyDefinitions {
    const state = live(this);
    requirePropertyHolder(state);
    return definitions(state);
  }

  addComponentProperty(
    propertyName: string,
    type: ComponentPropertyType,
    defaultValue: string | boolean | VariableAlias,
    options?: ComponentPropertyOptions
  ): string {
    return addProperty(live(this), propertyName, type, defaultValue, options);
  }

  editComponentProperty(
    propertyName: string,
    newValue: Parameters<ComponentNode["editComponentProperty"]>[1]
  ): string {
    return editProperty(live(this), propertyName, newValue);
  }
}

class FakeComponentSet extends FakeFrameLikeNode {
  get type(): "COMPONENT_SET" {
    return "COMPONENT_SET";
  }

  get defaultVariant(): ComponentNode {
    return componentOf(defaultVariant(live(this)));
  }

  get componentPropertyDefinitions(): ComponentPropertyDefinitions {
    return definitions(live(this));
  }

  addComponentProperty(
    propertyName: string,
    type: ComponentPropertyType,
    defaultValue: string | boolean | VariableAlias,
    options?: ComponentPropertyOptions
  ): string {
    return addProperty(live(this), propertyName, type, defaultValue, options);
  }

  editComponentProperty(
    propertyName: string,
    newValue: Parameters<ComponentSetNode["editComponentProperty"]>[1]
  ): string {
    return editProperty(live(this), propertyName, newValue);
  }
}

class FakeInstance extends FakeFrameLikeNode {
  get type(): "INSTANCE" {
    return "INSTANCE";
  }

  get mainComponent(): ComponentNode | null {
    throw new Error(
      'An instance\'s mainComponent is write-only under "documentAccess": "dynamic-page". Use getMainComponentAsync.'
    );
  }

  getMainComponentAsync(): Promise<ComponentNode | null> {
    const main = live(this).main;
    return Promise.resolve(main === undefined ? null : componentOf(main));
  }

  swapComponent(componentNode: ComponentNode): void {
    const state = live(this);
    const main = live(componentNode);
    if (main.type !== "COMPONENT") {
      throw new Error(`An instance swaps only to a component, and ${main.id} is a ${main.type}.`);
    }
    write(state, `swap to ${main.id}`);
    state.main = main;
    mirror(state, main, true);
  }
}

class FakeText extends FakeSceneNode {
  get type(): "TEXT" {
    return "TEXT";
  }

  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return live(this).fills;
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    const state = live(this);
    if (paints === MIXED) {
      throw new Error("Cannot write figma.mixed as fills.");
    }
    write(state, "fills");
    state.fills = paints.map(storePaint);
  }

  get characters(): string {
    return live(this).characters;
  }

  set characters(value: string) {
    const state = live(this);
    requireHeldFonts(state, "characters");
    write(state, "characters");
    state.characters = value;
    if (state.autoRename) {
      state.name = value;
    }
  }

  get autoRename(): boolean {
    return live(this).autoRename;
  }

  get fontName(): FontName | PluginAPI["mixed"] {
    return live(this).fontName;
  }

  set fontName(font: FontName | PluginAPI["mixed"]) {
    const state = live(this);
    if (font === MIXED) {
      throw new Error("Cannot write figma.mixed as a font.");
    }
    requireFont(state, font, "fontName");
    write(state, "fontName");
    state.fontName = { family: font.family, style: font.style };
  }

  get fontSize(): number | PluginAPI["mixed"] {
    return live(this).fontSize;
  }

  set fontSize(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a font size.");
    }
    requireHeldFonts(state, "fontSize");
    write(state, "fontSize");
    state.fontSize = f32(value);
  }

  get lineHeight(): LineHeight | PluginAPI["mixed"] {
    return live(this).lineHeight;
  }

  set lineHeight(value: LineHeight | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a line height.");
    }
    requireHeldFonts(state, "lineHeight");
    write(state, "lineHeight");
    state.lineHeight =
      value.unit === "AUTO" ? { unit: "AUTO" } : { unit: value.unit, value: f32(value.value) };
  }

  get textDecoration(): TextDecoration | PluginAPI["mixed"] {
    return live(this).textDecoration;
  }

  set textDecoration(value: TextDecoration | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a text decoration.");
    }
    requireHeldFonts(state, "textDecoration");
    write(state, "textDecoration");
    state.textDecoration = value;
    state.textDecorationOffset =
      value === "UNDERLINE" ? (state.textDecorationOffset ?? { unit: "AUTO" }) : null;
  }

  /** Figma holds an underline offset only while the layer is underlined. */
  get textDecorationOffset(): TextDecorationOffset | PluginAPI["mixed"] | null {
    return live(this).textDecorationOffset;
  }

  set textDecorationOffset(value: TextDecorationOffset | PluginAPI["mixed"] | null) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as an underline offset.");
    }
    requireHeldFonts(state, "textDecorationOffset");
    write(state, "textDecorationOffset");
    if (state.textDecoration === "UNDERLINE") {
      state.textDecorationOffset = value;
    }
  }

  get textAutoResize(): TextNode["textAutoResize"] {
    return live(this).textAutoResize;
  }

  set textAutoResize(value: TextNode["textAutoResize"]) {
    const state = live(this);
    requireHeldFonts(state, "textAutoResize");
    write(state, "textAutoResize");
    state.textAutoResize = value;
  }

  getRangeAllFontNames(start: number, end: number): FontName[] {
    const state = live(this);
    requireRange(state, start, end);
    return [...heldFonts(state)];
  }

  getRangeBoundVariable(
    start: number,
    end: number,
    field: VariableBindableTextField
  ): VariableAlias | null | PluginAPI["mixed"] {
    const state = live(this);
    requireRange(state, start, end);
    const id = state.bindings.get(field);
    return id === undefined ? null : alias(id);
  }

  override setBoundVariable(field: BindableField, variable: Variable | null): void {
    bindTextField(live(this), field, variable);
  }
}

function requireRange(state: NodeState, start: number, end: number): void {
  if (start < 0 || end > state.characters.length || start >= end) {
    throw new Error(
      `The range ${start} to ${end} is outside the ${state.characters.length} characters of ${state.id}.`
    );
  }
}

class FakeVector extends FakeSceneNode {
  get type(): "VECTOR" {
    return "VECTOR";
  }

  /** A sublayer of an instance shows its main layer's fills until they are overridden. */
  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shownFills(live(this));
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    const state = live(this);
    if (paints === MIXED) {
      throw new Error("Cannot write figma.mixed as fills.");
    }
    write(state, "fills");
    state.fills = paints.map(storePaint);
    state.overridden.add("fills");
  }

  get strokes(): ReadonlyArray<Paint> {
    return live(this).strokes;
  }

  set strokes(paints: ReadonlyArray<Paint>) {
    const state = live(this);
    write(state, "strokes");
    state.strokes = paints.map(storePaint);
    state.overridden.add("strokes");
  }
}

function shownFills(state: NodeState): readonly Paint[] {
  return state.mirrorOf !== undefined && !state.overridden.has("fills")
    ? shownFills(state.mirrorOf)
    : state.fills;
}

/** A node object, and the guarded node a plugin sees for it. */
type Made = {
  readonly target: FakeBaseNode;
  readonly exposed: Exposed;
};

/** The public node for a node type, behind the guard. */
function makeNode(type: NodeType): Made {
  switch (type) {
    case "DOCUMENT": {
      const target = new FakeDocument();
      // SAFETY: FakeDocument models DocumentNode's members with their types, and the guard
      // throws for every other member.
      return { target, exposed: guard(target, "DocumentNode") as DocumentNode };
    }
    case "PAGE": {
      const target = new FakePage();
      // SAFETY: as above, for PageNode.
      return { target, exposed: guard(target, "PageNode") as PageNode };
    }
    case "FRAME": {
      const target = new FakeFrame();
      // SAFETY: as above, for FrameNode.
      return { target, exposed: guard(target, "FrameNode") as FrameNode };
    }
    case "COMPONENT": {
      const target = new FakeComponent();
      // SAFETY: as above, for ComponentNode.
      return { target, exposed: guard(target, "ComponentNode") as ComponentNode };
    }
    case "COMPONENT_SET": {
      const target = new FakeComponentSet();
      // SAFETY: as above, for ComponentSetNode.
      return { target, exposed: guard(target, "ComponentSetNode") as ComponentSetNode };
    }
    case "INSTANCE": {
      const target = new FakeInstance();
      // SAFETY: as above, for InstanceNode.
      return { target, exposed: guard(target, "InstanceNode") as InstanceNode };
    }
    case "TEXT": {
      const target = new FakeText();
      // SAFETY: as above, for TextNode.
      return { target, exposed: guard(target, "TextNode") as TextNode };
    }
    case "VECTOR": {
      const target = new FakeVector();
      // SAFETY: as above, for VectorNode.
      return { target, exposed: guard(target, "VectorNode") as VectorNode };
    }
  }
}

const WHITE: SolidPaint = {
  type: "SOLID",
  color: { r: 1, g: 1, b: 1 },
  opacity: 1,
  visible: true,
  blendMode: "NORMAL",
};

const BLACK: SolidPaint = { ...WHITE, color: { r: 0, g: 0, b: 0 } };

function createNode(file: FileState, type: NodeType, name: string, id?: string): NodeState {
  const { target, exposed } = makeNode(type);
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
    opacity: 1,
    constraints: { horizontal: "MIN", vertical: "MIN" },
    fills: type === "TEXT" ? [BLACK] : type === "VECTOR" || type === "INSTANCE" ? [] : [WHITE],
    strokes: [],
    strokeWeights: { top: 1, right: 1, bottom: 1, left: 1 },
    strokeAlign: "INSIDE",
    strokesIncludedInLayout: false,
    effects: [],
    radii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    clipsContent: type === "FRAME",
    layoutMode: "NONE",
    layoutWrap: "NO_WRAP",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    itemSpacing: 0,
    counterAxisSpacing: 0,
    minWidth: null,
    bindings: new Map(),
    explicitModes: new Map(),
    propertyReferences: null,
    properties: new Map(),
    variantOrder: new Map(),
    main: undefined,
    mirrorOf: undefined,
    overridden: new Set(),
    characters: "",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 12,
    lineHeight: { unit: "AUTO" },
    textDecoration: "NONE",
    textDecorationOffset: null,
    textAutoResize: "WIDTH_AND_HEIGHT",
    autoRename: type === "TEXT",
  };
  // The guard reads a getter on the object itself, so the object and the guarded node both
  // lead to the state.
  STATES.set(target, state);
  STATES.set(exposed, state);
  file.nodes.set(state.id, state);
  return state;
}

/** One drawn element of an SVG: its layer name and its paints. */
type SvgElement = {
  readonly name: string;
  readonly fill: string;
  readonly stroke: string;
};

const SVG_ROOT = /<svg\b([^>]*)>/;
const UNDRAWN = /<(defs|clipPath|mask)\b[^>]*>[\s\S]*?<\/\1>/g;
const DRAWN = /<(path|circle|rect|ellipse|polygon|polyline|line)\b([^>]*?)\/?>/g;

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes)?.[1];
}

const NAMED_COLORS = new Map([
  ["white", "#ffffff"],
  ["black", "#000000"],
]);

/** The paints an SVG paint attribute draws with: none, or one solid paint. */
function svgPaints(value: string): Paint[] {
  if (value === "none") {
    return [];
  }
  const hex = NAMED_COLORS.get(value.toLowerCase()) ?? value;
  const parsed = Hex.parse(hex);
  if (parsed._tag === "err") {
    throw new Error(`The fake Figma file reads SVG paints in six-digit hex, white or black, not ${value}.`);
  }
  const { r, g, b } = getOrThrow(parsed);
  return [storePaint({ type: "SOLID", color: { r, g, b }, opacity: 1, visible: true, blendMode: "NORMAL" })];
}

/** Rule 6: the frame `createNodeFromSvg` makes. */
function drawSvg(file: FileState, svg: string): NodeState {
  const root = SVG_ROOT.exec(svg)?.[1];
  const width = Number(attribute(root ?? "", "width"));
  const height = Number(attribute(root ?? "", "height"));
  if (root === undefined || !(width > 0) || !(height > 0)) {
    throw new Error("The fake Figma file draws only an SVG whose root sets a width and a height.");
  }
  const fill = attribute(root, "fill") ?? "#000000";
  const stroke = attribute(root, "stroke") ?? "none";
  const elements: SvgElement[] = [...svg.replaceAll(UNDRAWN, "").matchAll(DRAWN)].map(
    ([, , attributes = ""]) => ({
      name: attribute(attributes, "id") ?? "Vector",
      fill: attribute(attributes, "fill") ?? fill,
      stroke: attribute(attributes, "stroke") ?? stroke,
    })
  );
  const frame = createNode(file, "FRAME", "svg");
  frame.width = f32(width);
  frame.height = f32(height);
  frame.clipsContent = true;
  frame.fills = [WHITE];
  frame.children = elements.map((element) => {
    const vector = createNode(file, "VECTOR", element.name);
    vector.width = frame.width;
    vector.height = frame.height;
    vector.fills = svgPaints(element.fill);
    vector.strokes = svgPaints(element.stroke);
    vector.parent = frame;
    return vector;
  });
  placeOnCurrentPage(file, frame);
  write(frame, "create from SVG");
  return frame;
}

function flatten(
  file: FileState,
  nodes: readonly NodeState[],
  parent: NodeState,
  index: number | undefined
): NodeState {
  const [first] = nodes;
  if (first === undefined) {
    throw new Error("flatten needs at least one node.");
  }
  for (const node of nodes) {
    if (node.mirrorOf !== undefined) {
      throw new Error(`Cannot flatten ${node.id}, a layer inside an instance.`);
    }
  }
  const vector = createNode(file, "VECTOR", "Vector");
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  vector.x = left;
  vector.y = top;
  vector.width = f32(Math.max(...nodes.map((node) => node.x + node.width)) - left);
  vector.height = f32(Math.max(...nodes.map((node) => node.y + node.height)) - top);
  vector.fills = first.fills;
  vector.strokes = first.strokes;
  for (const node of nodes) {
    write(node, "flatten");
    detach(node);
    markRemoved(node);
  }
  insert(parent, vector, index);
  return vector;
}

function combineAsVariants(
  file: FileState,
  components: readonly NodeState[],
  parent: NodeState,
  index: number | undefined
): NodeState {
  if (components.length === 0) {
    throw new Error("combineAsVariants needs at least one component.");
  }
  for (const component of components) {
    if (component.type !== "COMPONENT") {
      throw new Error(
        `combineAsVariants combines only components, and ${component.id} is a ${component.type}.`
      );
    }
  }
  const set = createNode(file, "COMPONENT_SET", "Component Set");
  const left = Math.min(...components.map((component) => component.x));
  const top = Math.min(...components.map((component) => component.y));
  set.x = left;
  set.y = top;
  set.width = f32(Math.max(...components.map((component) => component.x + component.width)) - left);
  set.height = f32(Math.max(...components.map((component) => component.y + component.height)) - top);
  set.clipsContent = true;
  insert(parent, set, index);
  for (const component of components) {
    insert(set, component, undefined);
    component.x = f32(component.x - left);
    component.y = f32(component.y - top);
  }
  write(set, "combine as variants");
  return set;
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
function seedVariables(collections: readonly CollectionSpec[]): SeededVariables {
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

function exposeCollection(collection: CollectionState): VariableCollection {
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

function exposeVariable(file: FileState, variable: VariableState): Variable {
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

/** Rule 1: a bound paint takes the variable's alpha, in the default modes, as its opacity. */
function bindPaint(file: FileState, paint: SolidPaint, variable: Variable | null): SolidPaint {
  if (variable === null) {
    const { boundVariables: _unbound, ...unbound } = paint;
    return unbound;
  }
  const bound = fileVariable(file, variable);
  requireType(bound, "COLOR", "a paint's color");
  const { r, g, b, a } = resolveColor(file, bound, undefined);
  return { ...paint, color: { r, g, b }, opacity: a, boundVariables: { color: alias(bound.id) } };
}

const EFFECT_FIELD_TYPES = new Map<VariableBindableEffectField, VariableResolvedDataType>([
  ["color", "COLOR"],
  ["radius", "FLOAT"],
  ["spread", "FLOAT"],
  ["offsetX", "FLOAT"],
  ["offsetY", "FLOAT"],
]);

/** Bind a shadow's field. The value stays as written: rule 2 applies when the node stores it. */
function bindEffect(
  file: FileState,
  effect: Effect,
  field: VariableBindableEffectField,
  variable: Variable | null
): Effect {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    throw new Error(`The fake Figma file does not model binding a ${effect.type}.`);
  }
  const { [field]: _previous, ...others } = effect.boundVariables ?? {};
  if (variable === null) {
    return { ...effect, boundVariables: others };
  }
  const bound = fileVariable(file, variable);
  requireType(bound, EFFECT_FIELD_TYPES.get(field) ?? "FLOAT", `a shadow's ${field}`);
  return { ...effect, boundVariables: { ...others, [field]: alias(bound.id) } };
}

/**
 * Whether Figma draws a drop shadow's spread on a node: a frame, component or instance that
 * clips its content and has a visible fill (rule 3).
 *
 * @param node - A node of a fake file.
 * @returns True when the node draws its shadows' spread.
 */
export function drawsShadowSpread(node: SceneNode): boolean {
  const state = live(node);
  return (
    (state.type === "FRAME" || state.type === "COMPONENT" || state.type === "INSTANCE") &&
    state.clipsContent &&
    state.fills.some((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0)
  );
}

function fontUnavailable(file: FileState, font: FontNameInput): boolean {
  return file.unavailableFonts.some(
    (missing) =>
      missing.family === font.family && (missing.style === undefined || missing.style === font.style)
  );
}

/**
 * Make a fake file that a sync has filled with the given collections. It holds one empty page,
 * `Page 1`, which is the current page.
 *
 * @param options - The synced collections and the fonts the machine lacks.
 * @returns The Plugin API over the file and what a test reads beside it.
 */
export function createFakeFigma(options: FakeFigmaOptions): FakeFigma {
  const seeded = seedVariables(options.collections);
  const file: FileState = {
    nextNode: 0,
    nextProperty: 0,
    writes: [],
    nodes: new Map(),
    document: undefined,
    current: undefined,
    loadedFonts: new Set(),
    unavailableFonts: options.unavailableFonts ?? [],
    collections: seeded.collections,
    variables: seeded.variables,
  };
  const document = createNode(file, "DOCUMENT", "Document", "0:0");
  const firstPage = createNode(file, "PAGE", "Page 1", "0:1");
  document.children = [firstPage];
  firstPage.parent = document;
  file.document = document;
  file.current = firstPage;

  const stateOfParent = (parent: (BaseNode & ChildrenMixin) | undefined): NodeState => {
    if (parent !== undefined) {
      return live(parent);
    }
    if (file.current === undefined) {
      throw new Error("The fake Figma file has no current page.");
    }
    return file.current;
  };

  const variables: Pick<
    VariablesAPI,
    | "getLocalVariableCollectionsAsync"
    | "getLocalVariablesAsync"
    | "getVariableByIdAsync"
    | "getVariableCollectionByIdAsync"
    | "setBoundVariableForPaint"
    | "setBoundVariableForEffect"
  > = {
    getLocalVariableCollectionsAsync: () => Promise.resolve(file.collections.map(exposeCollection)),
    getLocalVariablesAsync: (type) =>
      Promise.resolve(
        [...file.variables.values()]
          .filter((variable) => type === undefined || variable.resolvedType === type)
          .map((variable) => exposeVariable(file, variable))
      ),
    getVariableByIdAsync: (id) => {
      const variable = file.variables.get(id);
      return Promise.resolve(variable === undefined ? null : exposeVariable(file, variable));
    },
    getVariableCollectionByIdAsync: (id) => {
      const collection = file.collections.find((candidate) => candidate.id === id);
      return Promise.resolve(collection === undefined ? null : exposeCollection(collection));
    },
    setBoundVariableForPaint: (paint, _field, variable) => bindPaint(file, paint, variable),
    setBoundVariableForEffect: (effect, field, variable) => bindEffect(file, effect, field, variable),
  };

  const api: Pick<
    PluginAPI,
    | "root"
    | "currentPage"
    | "mixed"
    | "loadFontAsync"
    | "setCurrentPageAsync"
    | "createPage"
    | "createFrame"
    | "createComponent"
    | "createText"
    | "createNodeFromSvg"
    | "combineAsVariants"
    | "flatten"
    | "variables"
  > = {
    get root(): DocumentNode {
      const node = document.exposed;
      if (node.type !== "DOCUMENT") {
        throw new Error("The fake Figma file's root is no document.");
      }
      return node;
    },
    get currentPage(): PageNode {
      if (file.current === undefined) {
        throw new Error("The fake Figma file has no current page.");
      }
      return pageOf(file.current);
    },
    mixed: MIXED,
    loadFontAsync: (font) => {
      if (fontUnavailable(file, font)) {
        return Promise.reject(new Error(`The font "${font.family} ${font.style ?? ""}" is not available.`));
      }
      file.loadedFonts.add(fontKey(font));
      return Promise.resolve();
    },
    setCurrentPageAsync: (page) => {
      const state = live(page);
      if (state.type !== "PAGE") {
        throw new Error(`${state.id} is a ${state.type}, not a page.`);
      }
      write(state, "show the page");
      state.loaded = true;
      file.current = state;
      return Promise.resolve();
    },
    createPage: () => {
      const page = createNode(file, "PAGE", `Page ${document.children.length + 1}`);
      document.children.push(page);
      page.parent = document;
      write(page, "create a page");
      return pageOf(page);
    },
    createFrame: () => {
      const frame = createNode(file, "FRAME", "Frame");
      placeOnCurrentPage(file, frame);
      write(frame, "create a frame");
      const node = frame.exposed;
      if (node.type !== "FRAME") {
        throw new Error(`${frame.id} is a ${node.type}, not a frame.`);
      }
      return node;
    },
    createComponent: () => {
      const component = createNode(file, "COMPONENT", "Component");
      placeOnCurrentPage(file, component);
      write(component, "create a component");
      return componentOf(component);
    },
    createText: () => {
      const text = createNode(file, "TEXT", "");
      placeOnCurrentPage(file, text);
      write(text, "create a text layer");
      const node = text.exposed;
      if (node.type !== "TEXT") {
        throw new Error(`${text.id} is a ${node.type}, not a text layer.`);
      }
      return node;
    },
    createNodeFromSvg: (svg) => {
      const node = drawSvg(file, svg).exposed;
      if (node.type !== "FRAME") {
        throw new Error(`${node.id} is a ${node.type}, not a frame.`);
      }
      return node;
    },
    combineAsVariants: (nodes, parent, index) => {
      const set = combineAsVariants(file, nodes.map(live), live(parent), index).exposed;
      if (set.type !== "COMPONENT_SET") {
        throw new Error(`${set.id} is a ${set.type}, not a component set.`);
      }
      return set;
    },
    flatten: (nodes, parent, index) => {
      const vector = flatten(file, nodes.map(live), stateOfParent(parent), index).exposed;
      if (vector.type !== "VECTOR") {
        throw new Error(`${vector.id} is a ${vector.type}, not a vector.`);
      }
      return vector;
    },
    // SAFETY: the object models the variable calls the plugin makes, and the guard throws for
    // every other member.
    variables: guard(variables, "figma.variables") as VariablesAPI,
  };

  return {
    // SAFETY: the object models the Plugin API calls the plugin makes, and the guard throws for
    // every other member.
    figma: guard(api, "figma") as PluginAPI,
    writes: file.writes,
    reopen: () => {
      for (const page of document.children) {
        page.loaded = page === file.current;
      }
    },
    variable: (collection, name) => {
      const found = [...file.variables.values()].find(
        (variable) => variable.collection.name === collection && variable.name === name
      );
      if (found === undefined) {
        throw new Error(`The fake Figma file holds no variable ${collection}/${name}.`);
      }
      return exposeVariable(file, found);
    },
  };
}
