/**
 * The fake file's state: the node, variable and collection records behind every exposed object, the
 * handles that map an exposed node to its record, the write log, the field tables the other modules
 * share, and the maker of public nodes the node classes install.
 */

export type NodeType =
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

export type BindableField = VariableBindableNodeField | VariableBindableTextField;

/** The four sides of a stroke or of padding. */
export type Sides = { top: number; right: number; bottom: number; left: number };

/** The four corner radii. */
type Corners = { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };

/** The lengths an auto layout frame or child keeps its size within. */
export type LimitField = "minWidth" | "maxWidth" | "minHeight" | "maxHeight";

/**
 * The font, size and line height of one character of a text layer, and the variables its text
 * fields bind, by id.
 */
export type CharacterStyle = {
  readonly font: FontName;
  readonly fontSize: number;
  readonly lineHeight: LineHeight;
  readonly bindings: ReadonlyMap<VariableBindableTextField, string>;
};

/** A TEXT, BOOLEAN or INSTANCE_SWAP property of a component set or a component. */
export type PropertyState = {
  readonly type: "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  readonly defaultValue: string | boolean;
  readonly preferredValues: readonly InstanceSwapPreferredValue[] | undefined;
};

/** A literal a variable resolves to. */
export type Literal =
  | { readonly kind: "color"; readonly color: RGBA }
  | { readonly kind: "float"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean };

/** A variable's value in one mode: a literal, or an alias of another variable by id. */
export type StoredValue = Literal | { readonly kind: "alias"; readonly id: string };

export type CollectionState = {
  readonly id: string;
  readonly name: string;
  readonly modes: readonly { readonly modeId: string; readonly name: string }[];
  readonly defaultModeId: string;
  readonly variableIds: string[];
  exposed: VariableCollection | undefined;
};

export type VariableState = {
  readonly id: string;
  readonly name: string;
  readonly collection: CollectionState;
  readonly resolvedType: VariableResolvedDataType;
  readonly values: ReadonlyMap<string, StoredValue>;
  exposed: Variable | undefined;
};

export type FileState = {
  nextNode: number;
  nextProperty: number;
  readonly writes: string[];
  readonly nodes: Map<string, NodeState>;
  document: NodeState | undefined;
  current: NodeState | undefined;
  readonly loadedFonts: Set<string>;
  unavailableFonts: readonly FontNameInput[];
  readonly collections: readonly CollectionState[];
  readonly variables: ReadonlyMap<string, VariableState>;
  /** The hash of each image the file stores (rule 22). */
  readonly images: Set<string>;
  /**
   * Whether `children` leaves out the hidden layers inside instances, as the plugin can ask with
   * `figma.skipInvisibleInstanceChildren` (rule 25). Each run starts with false.
   */
  skipInvisibleInstanceChildren: boolean;
};

/**
 * Everything the fake holds for a node, whatever its type. The guard decides which of these a
 * plugin can reach through the node's type.
 */
export type NodeState = {
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
  /** The layer's rotation in degrees, counterclockwise, from -180 to 180 (rule 26). */
  rotation: number;
  opacity: number;
  constraints: Constraints;
  /**
   * What MAX and CENTER keep of an absolute layer's place (rule 47): the pixels from its end to its
   * parent's, and from its parent's centre down to its own, from which `x` and `y` read. Undefined on
   * an axis whose constraint keeps `x` or `y` as written.
   */
  anchors: { end: number | undefined; centre: number | undefined };
  fills: readonly Paint[];
  strokes: readonly Paint[];
  strokeWeights: Sides;
  /** Whether a weight was written, after which each side writes alone (rule 49). */
  strokeWeightWritten: boolean;
  strokeAlign: FrameNode["strokeAlign"];
  strokesIncludedInLayout: boolean;
  /** The stroke's dash and gap lengths, apart from its paints, empty for a solid stroke (rule 27). */
  dashPattern: readonly number[];
  effects: readonly Effect[];
  radii: Corners;
  clipsContent: boolean;
  /** Whether the auto layout paints its first child on top (rule 33). */
  itemReverseZIndex: boolean;
  layoutMode: FrameNode["layoutMode"];
  layoutWrap: FrameNode["layoutWrap"];
  primaryAxisSizingMode: FrameNode["primaryAxisSizingMode"];
  counterAxisSizingMode: FrameNode["counterAxisSizingMode"];
  primaryAxisAlignItems: FrameNode["primaryAxisAlignItems"];
  counterAxisAlignItems: FrameNode["counterAxisAlignItems"];
  padding: Sides;
  itemSpacing: number;
  counterAxisSpacing: number | null;
  /** The node's limits, each null where none applies (rule 16). */
  limits: Record<LimitField, number | null>;
  /**
   * Whether the node grows along its auto layout parent's direction, 0 or 1. The fake hides it
   * and `layoutAlign` behind the `layoutSizing*` shorthand (rule 12).
   */
  layoutGrow: number;
  /** Whether the node stretches across its auto layout parent's direction. */
  layoutAlign: "INHERIT" | "STRETCH";
  /** Whether the node sits in its auto layout parent's flow, or outside it at its own place (rule 24). */
  layoutPositioning: FrameNode["layoutPositioning"];
  /** The variable each bound field that is not a text field follows, by id. */
  readonly bindings: Map<VariableBindableNodeField, string>;
  /** The mode the node pins for each collection, by collection id. */
  readonly explicitModes: Map<string, string>;
  propertyReferences: FrameNode["componentPropertyReferences"];
  /** The TEXT, BOOLEAN and INSTANCE_SWAP properties of a set or a component, by property id. */
  readonly properties: Map<string, PropertyState>;
  /** The values each variant property of a set lists, in the set's own order (rule 4). */
  readonly variantOrder: Map<string, string[]>;
  /** The main component of an instance. */
  main: NodeState | undefined;
  /**
   * The property values an instance sets, by property id: a BOOLEAN's flag (rule 25), a TEXT's
   * characters and an INSTANCE_SWAP's component id (rule 34).
   */
  readonly propertyValues: Map<string, string | boolean>;
  /** Whether an instance inside a component in a set is exposed to the instances around it (rule 39). */
  exposedInstance: boolean;
  /** The layer of the main component that an instance's sublayer shows. */
  mirrorOf: NodeState | undefined;
  /**
   * The fields a designer or the plugin overrode on an instance or its sublayer (rules 37 and 38), by
   * the name of the state field they cover, `size` for the width and height, and `mainComponent` for a
   * nested instance swapped apart from its main layer.
   */
  readonly overridden: Set<string>;
  /**
   * Whether an instance holds its lengths because its modes gave it another size than its main,
   * rather than through a resize of its own, so a swap gives it the new component's size (rule 56).
   */
  heldByModes: boolean;
  /** The lengths an instance unbound itself, which no longer show its source's binding (rule 56). */
  readonly unboundLengths: Set<"width" | "height">;
  characters: string;
  /** The style of each character, or of the one a text layer without characters types in. */
  styles: readonly CharacterStyle[];
  /**
   * The style the whole-text writes leave, which a link or a TEXT write resets every character to
   * (rule 51).
   */
  baseStyle: CharacterStyle;
  textDecoration: TextDecoration;
  /** The text's letter spacing, one for the whole layer (rule 28). */
  letterSpacing: LetterSpacing;
  textDecorationOffset: TextDecorationOffset | null;
  textAutoResize: TextNode["textAutoResize"];
  textAlignHorizontal: TextNode["textAlignHorizontal"];
  textAlignVertical: TextNode["textAlignVertical"];
  /** Whether a text ends in an ellipsis where it overflows (rule 20). */
  textTruncation: TextNode["textTruncation"];
  /** The lines a truncating text keeps, or null for all of them (rule 20). */
  maxLines: number | null;
  autoRename: boolean;
};

/** The style a new text layer types in. */
export const NEW_TEXT_STYLE: CharacterStyle = {
  font: { family: "Inter", style: "Regular" },
  fontSize: 12,
  lineHeight: { unit: "AUTO" },
  bindings: new Map(),
};

export const STATES = new WeakMap<NodeHandle, NodeState>();

export const SHARED_DATA_SEPARATOR = "\u0000";

export const f32 = Math.fround;

export const MIXED: PluginAPI["mixed"] =
  // SAFETY: `figma.mixed` is a symbol the plugin compares by identity, and this file makes one.
  Symbol("figma.mixed") as PluginAPI["mixed"];

/** The object behind a node the plugin holds, which the guard wraps. */
type NodeTarget = { readonly id: string };

/** A node a plugin holds, or the object behind it. */
type NodeHandle = BaseNode | NodeTarget;

export function stateOf(node: NodeHandle): NodeState {
  const state = STATES.get(node);
  if (state === undefined) {
    throw new Error("The fake Figma file was handed a node it did not make.");
  }
  return state;
}

/** The node's state, refusing a node that was removed, as Figma does. */
export function live(node: NodeHandle): NodeState {
  const state = stateOf(node);
  if (state.removed) {
    throw new Error(`The node with id ${state.id} does not exist: it was removed.`);
  }
  return state;
}

export function write(state: NodeState, what: string): void {
  state.file.writes.push(`${state.id} ${what}`);
}

export function sceneOf(state: NodeState): SceneNode {
  const node = state.exposed;
  if (node.type === "DOCUMENT" || node.type === "PAGE") {
    throw new Error(`${state.id} is a ${node.type}, not a layer.`);
  }
  return node;
}

export function pageOf(state: NodeState): PageNode {
  const node = state.exposed;
  if (node.type !== "PAGE") {
    throw new Error(`${state.id} is a ${node.type}, not a page.`);
  }
  return node;
}

export function componentOf(state: NodeState): ComponentNode {
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

export function isAutoLayout(state: NodeState | undefined): boolean {
  return state !== undefined && isFrameLike(state) && state.layoutMode !== "NONE";
}

/** A component's key, which Figma derives from the node and keeps across edits. */
export function componentKey(state: NodeState): string {
  let hash = 0x811c9dc5;
  for (const character of state.id) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, "0")}${state.id.replaceAll(":", "")}`;
}

/**
 * The layer an instance or a sublayer shows, its children and every field it does not override
 * (rule 38): an instance's main component, a sublayer's main layer, or the component a nested
 * instance was swapped to.
 */
export function sourceOf(state: NodeState): NodeState | undefined {
  const own = state.mirrorOf === undefined || state.overridden.has("mainComponent");
  return state.type === "INSTANCE" && own ? state.main : state.mirrorOf;
}

export function storeRgba(color: RGBA): RGBA {
  return { r: f32(color.r), g: f32(color.g), b: f32(color.b), a: f32(color.a) };
}

/** A layer's length on an axis and its parent's. */
export type Lengths = { readonly own: number; readonly outer: number };

/** An axis of a layer, named as `layoutMode` names the direction along it. */
export type Axis = "HORIZONTAL" | "VERTICAL";

export type Sizing = FrameNode["layoutSizingHorizontal"];

/** The fields a binding to `cornerRadius` or `strokeWeight` lands on, as the typings note. */
export function bindingTargets(field: VariableBindableNodeField): readonly VariableBindableNodeField[] {
  switch (field) {
    case "cornerRadius":
      return ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
    case "strokeWeight":
      return ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
    default:
      return [field];
  }
}

export const TEXT_FIELDS: ReadonlySet<VariableBindableTextField> = new Set<VariableBindableTextField>([
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent",
]);

export function isTextField(field: BindableField): field is VariableBindableTextField {
  const names: ReadonlySet<string> = TEXT_FIELDS;
  return names.has(field);
}

/** The fields that hold a corner's radius. */
export const CORNERS: ReadonlySet<VariableBindableNodeField> = new Set(bindingTargets("cornerRadius"));

/** The value the characters share, or `figma.mixed` when they differ (rule 10). */
export function shared<T>(state: NodeState, read: (style: CharacterStyle) => T): T | PluginAPI["mixed"] {
  const values = new Map(state.styles.map((style) => [JSON.stringify(read(style)), read(style)] as const));
  const [value, ...others] = values.values();
  return value === undefined || others.length > 0 ? MIXED : value;
}

export function isText(value: string | VariableAlias): value is string {
  return !(value instanceof Object);
}

/**
 * The fields of a node a copy does not take from its source: its identity, its place in the
 * tree, and what a duplicate or an instance's sublayer gets otherwise or not at all.
 */
export type UncopiedField =
  | "file"
  | "id"
  | "type"
  | "exposed"
  | "parent"
  | "children"
  | "removed"
  | "sharedData"
  | "loaded"
  | "mirrorOf"
  | "overridden"
  | "unboundLengths"
  | "heldByModes"
  | "properties"
  | "propertyValues"
  | "exposedInstance"
  | "variantOrder";

/** A layer's transform within its parent, as `relativeTransform` holds it: its turn, then its place. */
export type Transform = readonly [readonly [number, number, number], readonly [number, number, number]];

/** A node object, and the guarded node a plugin sees for it. */
export type Made = {
  readonly target: NodeTarget;
  readonly exposed: Exposed;
};

/** Makes the public node of a type. The node classes install it as they load. */
let nodeMaker: ((type: NodeType) => Made) | undefined;

/**
 * Install the maker of public nodes. The node classes install theirs when their module loads, so
 * the code below them can create nodes without importing them.
 *
 * @param maker - Makes the public node of a type.
 */
export function installNodeMaker(maker: (type: NodeType) => Made): void {
  nodeMaker = maker;
}

/** The public node for a node type, from the installed maker. */
export function madeNode(type: NodeType): Made {
  if (nodeMaker === undefined) {
    throw new Error("The fake Figma file's node classes have not loaded.");
  }
  return nodeMaker(type);
}

export const WHITE: SolidPaint = {
  type: "SOLID",
  color: { r: 1, g: 1, b: 1 },
  opacity: 1,
  visible: true,
  blendMode: "NORMAL",
};

export const BLACK: SolidPaint = { ...WHITE, color: { r: 0, g: 0, b: 0 } };

export const EFFECT_FIELD_TYPES = new Map<VariableBindableEffectField, VariableResolvedDataType>([
  ["color", "COLOR"],
  ["radius", "FLOAT"],
  ["spread", "FLOAT"],
  ["offsetX", "FLOAT"],
  ["offsetY", "FLOAT"],
]);
