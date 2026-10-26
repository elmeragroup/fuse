/**
 * Instances, component properties and variants: the properties a set or component defines, the
 * values an instance sets, swaps, exposure and nested values.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 4. A component set keeps each variant property's values in an order of its own. A new set
 *    lists them in the order its children first show them, a value added later goes last, and
 *    moving the children or renaming a value leaves it where it is. Its `defaultVariant` is the
 *    top-left child, the smallest y and then the smallest x. On a real file on 2026-10-20 a run
 *    that appended xs and lg listed the sizes as default, sm, xs, lg and made xs the default, a
 *    later run that moved the variants into spec order left that list as it was, and a test set
 *    kept a renamed value in its slot.
 * 25. A BOOLEAN property shows or hides the layers that link their `visible` to it, as a real file
 *    showed on 2026-10-22 (PB). `addComponentProperty("Optional", "BOOLEAN", true)` on a set
 *    returned `Optional#149:3`, and a text in each of two variants linked it through
 *    `componentPropertyReferences = { visible: id }`. An instance listed it in
 *    `componentProperties` as `{ type: "BOOLEAN", value: true }`. `setProperties({ [id]: false })`
 *    hid the linked layer, which left the instance's auto layout with its 8px gap, so the hugging
 *    instance went from 102 to 24 wide. Setting true showed it again at 102. A property added
 *    with default false hid the component's own linked layer too: a hugging component of two
 *    layers and a 4px gap went from 54 to 20 wide (PQ). The probes also read the instance's
 *    `children` without the hidden layer, which the correction to PB and PQ puts down to
 *    `figma.skipInvisibleInstanceChildren`: the probe environment sets it, and a plugin that does
 *    not, as this one does not, gets the typings' default, false, where `children` lists the
 *    hidden layer and the layer reads `visible` false. The fake reads a component's linked layer
 *    at the property's default, and an instance's at the value the instance sets or else at the
 *    default. It leaves a hidden sublayer out of `children` only while the flag is set, and a run
 *    starts with it false. A hidden layer leaves only the layout rule 32 lays out, and keeps its
 *    box's size. PB set only a BOOLEAN property on an instance, and rule 34 covers the other kinds.
 *    The fake throws for a property the instance's set or component lacks. No probe wrote a layer's
 *    own `visible`, so the fake reads every other layer as visible and takes no write.
 * 34. `setProperties` on an instance nested in a component (N1, 2026-10-23). `componentProperties`
 *    listed `Label#<id>` TEXT, `Show icon#<id>` BOOLEAN and the variant by its bare name, VARIANT, and
 *    `setProperties` wrote a TEXT value (`Retry`), a BOOLEAN false, which hid the linked layer, and a
 *    VARIANT value (`outline`). The fake shows a TEXT value as the characters of each sublayer whose
 *    main layer links the property, and an outer instance shows the values the component set on the
 *    instance nested in it and applies the swap values among them when it swaps that instance. One
 *    projection of the values serves `componentProperties` and the swap. A VARIANT write swaps to the set's variant with the values asked for, as
 *    rule 35 does. N1 ran with the fonts loaded, so the fake requires the linked labels' fonts for a
 *    TEXT write, as rule 7 requires them for every text write. On 2026-10-24 an INSTANCE_SWAP value,
 *    a component's id, swapped the nested instance's icon to that component, `componentProperties`
 *    read the id back, and a fill override on the icon's glyph stayed (NS). So the fake swaps each
 *    sublayer whose main layer links the property's `mainComponent`, and the glyph's override moves
 *    to the new glyph of the same name, as below. It refuses a variable value, a value of the wrong
 *    type, and a variant value the set lacks.
 * 35. `swapComponent` and a VARIANT write keep the instance's node id and its TEXT and BOOLEAN values
 *    (N1), and its `componentPropertyReferences.visible`, its `isExposedInstance` and its swap
 *    property's value (NS). An override the instance itself holds stays, and a sublayer's fill
 *    override moves to the new sublayer of the same name, as below.
 * 39. `isExposedInstance` reads back true once written on an instance inside a component in a set,
 *    an instance of that component lists the nested instance in `exposedInstances`, and
 *    `setProperties` on the listed instance sets its TEXT (`Undo`) (N5). The typings make the field
 *    writable only on such an instance and inherited below it, so the fake refuses it elsewhere and
 *    reads an instance seen through an outer instance from its main layer alone.
 * 41. An instance's label keeps a `textAlignHorizontal` override. On 2026-10-24 a CENTER written on
 *    the label sublayer of an instance of a component whose label was LEFT listed the sublayer with
 *    `textAlignHorizontal` in `overrides`, and the label kept CENTER and showed the new characters
 *    when the main's label turned RIGHT and took new characters. Writing the main's RIGHT on it
 *    afterwards kept the field listed, unlike a fill (NS), so an equal write leaves the override
 *    (NA). A label that overrides none shows its main layer's alignment, as rule 38 has the rest
 *    follow the main. No probe swapped an instance with the override, so a swap drops it.
 * 43. One icon instance links a BOOLEAN's `visible` and an INSTANCE_SWAP's `mainComponent` together.
 *    On 2026-10-25 an `Icon/A` instance in a hugging row, gap 8, took both links and read both back;
 *    with the BOOLEAN's default false it was hidden in the main and in an instance, and the row was
 *    59 wide. Setting it true showed the icon (83 wide), a swap through the property to `Icon/B` kept
 *    it shown with both links, and false hid it again with the swap value kept (PI2). Rules 25 and 34
 *    already read the two links apart, so the fake needs nothing more for them. The swap listed the
 *    icon's `name` in the instance's `overrides`, while the layer kept its name `icon`, a hand-set
 *    `custom` too, and a swap back to `Icon/A` still listed `name` (PI3). So a layer a property swaps
 *    keeps its name, and the fake lists `name` among its overrides from then on.
 * 44. A `minWidth` written on an instance is an override. On 2026-10-25 a fresh instance listed
 *    `minWidth` and `minHeight` on its root after a `minWidth` write alone, with `minHeight` reading
 *    null, and kept both listed after `minWidth` went back to null (PH3). The fake lists both from the
 *    first write on. It does not lay out, so the minimum clamps no size. No probe wrote another limit
 *    on an instance, so the fake lists none for those.
 * 45. TEXT values set through exposure two levels down. On 2026-10-25 a `Command item` row instance
 *    listed in `exposedInstances` its exposed `kbd-group` and the two exposed caps inside it, and the
 *    group's own `exposedInstances` listed the caps. `setProperties` on each cap set its TEXT, and the
 *    row's `overrides` listed `componentProperties` on both caps. The values stayed through the row's
 *    own TEXT write, a switch of the row's variant and edits of all three mains, and the switch gave
 *    the caps new ids, the old ones no longer existing (PN). So the fake lists the exposed instances
 *    below an exposed one too, marks `componentProperties` on a sublayer that sets properties, and
 *    carries each such sublayer's values to the new sublayer at the same names when its instance
 *    swaps. With both caps named `kbd`, each value stayed with the cap in the same place among the
 *    caps of that name, through a switch and back, and a value set on the second cap alone stayed on
 *    the second (PN2), so the fake matches each layer by its name and that place.
 */

import { ownSize, settled } from "./layout.ts";
import { propertyOwner, propertyValue, rootMain } from "./overrides.ts";
import { componentKey, f32, isText, sourceOf, write } from "./state.ts";
import type { FileState, NodeState, PropertyState } from "./state.ts";
import { requireHeldFonts, resetStyles } from "./text.ts";
import { childrenOf, createNode, insert, mirror } from "./tree.ts";

const LINKED_TYPES = new Map<string, ComponentPropertyType>([
  ["characters", "TEXT"],
  ["mainComponent", "INSTANCE_SWAP"],
  ["visible", "BOOLEAN"],
]);

export function linkProperties(state: NodeState, references: FrameNode["componentPropertyReferences"]): void {
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
  if (references.characters !== undefined) {
    resetStyles(state);
  }
}

/**
 * The component an instance shows, whose layers its children stand for (rule 48): its own main where
 * it is no sublayer or swapped apart, else the one its main layer shows.
 */
export function shownComponent(state: NodeState): NodeState | undefined {
  const source = sourceOf(state);
  return source === undefined || source.type === "COMPONENT" ? source : shownComponent(source);
}

/** An instance's main component, and the set or component that holds the properties it shows. */
export function instanceOwner(state: NodeState) {
  const main = state.main;
  if (main === undefined) {
    throw new Error(`The instance ${state.id} has no main component.`);
  }
  return { main, owner: main.parent?.type === "COMPONENT_SET" ? main.parent : main };
}

/** A variant's property values, read from its name, or undefined for a name without them. */
export function variantValues(name: string): ReadonlyMap<string, string> | undefined {
  const pairs = name.split(",").map((part) => part.trim().split("="));
  if (pairs.some((pair) => pair.length !== 2)) {
    return undefined;
  }
  return new Map(pairs.map(([property = "", value = ""]) => [property.trim(), value.trim()]));
}

/** The top-left variant of a set (rule 4). */
export function defaultVariant(set: NodeState): NodeState {
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
export function renameVariantValues(
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
export function definitions(state: NodeState): ComponentPropertyDefinitions {
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

export function requirePropertyHolder(state: NodeState): void {
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

export function addProperty(
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

export function editProperty(
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

/**
 * The fields `overrides` lists for each override the fake notes (rule 37): N1 listed an instance's
 * `name`, `width` and `height`, and N3 its `fills`, `effects` and "the corner fields", which the fake
 * takes as the four corners the typings name and `cornerRadius`, and a sublayer's `fills`. G19 listed
 * `boundVariables` after an instance's own unbind of its width (rule 56).
 */
export const OVERRIDE_FIELDS: ReadonlyMap<string, readonly NodeChangeProperty[]> = new Map<
  string,
  readonly NodeChangeProperty[]
>([
  ["name", ["name"]],
  ["width", ["width"]],
  ["height", ["height"]],
  ["fills", ["fills"]],
  ["strokes", ["strokes"]],
  ["effects", ["effects"]],
  ["radii", ["cornerRadius", "topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]],
  // SAFETY: G19 read `boundVariables` among an instance's overridden fields, which the typings'
  // NodeChangeProperty does not name.
  ["boundVariables", ["boundVariables" as NodeChangeProperty]],
  ["characters", ["characters"]],
  ["textAlignHorizontal", ["textAlignHorizontal"]],
  ["minWidth", ["minWidth"]],
  ["minHeight", ["minHeight"]],
  ["componentProperties", ["componentProperties"]],
  ["layoutPositioning", ["layoutPositioning"]],
]);

/**
 * Whether an instance is exposed (rule 39): a primary instance by its own mark, and an instance seen
 * through an outer instance by the mark its main layer carries, which it inherits.
 */
export function exposedOf(state: NodeState): boolean {
  return state.mirrorOf === undefined ? state.exposedInstance : exposedOf(state.mirrorOf);
}

/** The nearest component around a layer. */
export function nearestComponent(state: NodeState): NodeState | undefined {
  let current = state.parent;
  while (current !== undefined && current.type !== "COMPONENT") {
    current = current.parent;
  }
  return current;
}

/** The exposed instances below a layer, each one before those exposed below it (rules 39 and 45). */
export function exposedBelow(state: NodeState): readonly NodeState[] {
  return childrenOf(state).flatMap((child) =>
    child.type === "INSTANCE" && exposedOf(child) ? [child, ...exposedBelow(child)] : exposedBelow(child)
  );
}

/** A layer's place among its siblings: its name and its index among the siblings of that name (PN2). */
type NamedPlace = { readonly name: string; readonly index: number };

/** The property values a sublayer instance sets itself, at the places of the layers down to it (rule 45). */
type NestedValues = {
  readonly places: readonly NamedPlace[];
  readonly values: ReadonlyMap<string, string | boolean>;
};

/** A child's place among its siblings: its name, and how many siblings before it share that name. */
function placeOf(siblings: readonly NodeState[], child: NodeState): NamedPlace {
  const index = siblings.filter((sibling) => sibling.name === child.name).indexOf(child);
  return { name: child.name, index };
}

/** The values each sublayer instance below a layer sets itself, as the layer holds them now. */
function nestedValues(state: NodeState, places: readonly NamedPlace[] = []): readonly NestedValues[] {
  return state.children.flatMap((child) => {
    const at = [...places, placeOf(state.children, child)];
    const own = child.overridden.has("componentProperties")
      ? [{ places: at, values: new Map(child.propertyValues) }]
      : [];
    return [...own, ...nestedValues(child, at)];
  });
}

/**
 * Give the sublayer instance at each entry's places the values it set before a swap: the sibling of
 * the same name in the same place among those of that name, as a real file kept them (rule 45, PN2).
 */
function restoreNested(state: NodeState, nested: readonly NestedValues[]): void {
  for (const { places, values } of nested) {
    let at: NodeState | undefined = state;
    for (const { name, index } of places) {
      at = at === undefined ? undefined : childrenOf(at).filter((child) => child.name === name)[index];
    }
    if (at?.type === "INSTANCE") {
      for (const [id, value] of values) {
        at.propertyValues.set(id, value);
      }
      at.overridden.add("componentProperties");
    }
  }
}

/**
 * Point an instance at another component, keeping its node, its property values and its own
 * overrides (rules 35 and 37). A nested instance that swaps keeps the component apart from its main
 * layer. The swap properties the instance sets swap their layers in the new component too.
 */
export function swapTo(state: NodeState, main: NodeState): void {
  const nested = nestedValues(state);
  state.main = main;
  if (state.mirrorOf !== undefined) {
    state.overridden.add("mainComponent");
  }
  mirror(state, main, true);
  restoreNested(state, nested);
  applySwapValues(state);
  takeSwappedSize(state);
}

/**
 * Give an instance its modes hold the size of the component it swapped to, in its own modes, and keep
 * its lengths listed (rule 56, G17). An instance resized itself keeps its lengths.
 */
function takeSwappedSize(state: NodeState): void {
  if (!state.heldByModes) {
    return;
  }
  state.overridden.delete("width");
  state.overridden.delete("height");
  settled(state);
  ownSize(state);
  state.heldByModes = true;
}

/**
 * The layers below an instance whose main layers link a property of `field`, down to the instances
 * nested in it, which set their own properties.
 */
function linkedBelow(
  state: NodeState,
  field: "characters" | "mainComponent",
  id: string
): readonly NodeState[] {
  return childrenOf(state).flatMap((child) => {
    const linked = rootMain(child).propertyReferences?.[field] === id ? [child] : [];
    return child.type === "INSTANCE" ? linked : [...linked, ...linkedBelow(child, field, id)];
  });
}

/** A property's value as an instance shows it, and whether an instance set it rather than defaulted. */
type ShownProperty = {
  readonly type: PropertyState["type"];
  readonly value: string | boolean;
  readonly given: boolean;
};

/**
 * Each TEXT, BOOLEAN and INSTANCE_SWAP property of an instance's set or component at the value the
 * instance shows (rules 25 and 34): the one it sets, or the one the instance it shows through sets,
 * as an outer instance shows the values a component set on the instance nested in it (N1), or else
 * the default. `componentProperties` reads it, and a swap applies the swap values an instance set.
 */
export function shownProperties(state: NodeState): ReadonlyMap<string, ShownProperty> {
  const { owner } = instanceOwner(state);
  return new Map(
    [...owner.properties].map(([id, property]) => {
      const given = propertyValue(state, id);
      return [id, { type: property.type, value: given ?? property.defaultValue, given: given !== undefined }];
    })
  );
}

/**
 * Swap each layer a set INSTANCE_SWAP value the instance shows links to the component the value
 * names (rule 34). The layer keeps its name, and `overrides` lists its `name` (rule 43). A layer whose
 * property no instance set shows its main layer's component.
 */
function applySwapValues(state: NodeState): void {
  for (const [id, { type, value, given }] of shownProperties(state)) {
    if (type !== "INSTANCE_SWAP" || !given || value === true || value === false) {
      continue;
    }
    const component = componentWithId(state.file, value);
    for (const layer of linkedBelow(state, "mainComponent", id)) {
      if (layer.main !== component) {
        swapTo(layer, component);
        layer.overridden.add("name");
      }
    }
  }
}

/**
 * Set an instance's properties (rules 25 and 34). A VARIANT goes by its bare name and shows the
 * set's variant with the values asked for, through a swap that keeps the node and the other values,
 * as N1's did. A TEXT goes by its id and sets the characters the layers linked to it show, and
 * needs their fonts loaded, as every text write does (rule 7), since N1 ran with them loaded. A
 * BOOLEAN shows or hides its layers (PB). An INSTANCE_SWAP takes a component's id and swaps the
 * layers linked to it, as NS's did.
 */
export function setProperties(
  state: NodeState,
  properties: { readonly [propertyName: string]: string | boolean | VariableAlias }
): void {
  const { main, owner } = instanceOwner(state);
  const options = owner === main ? new Map<string, string[]>() : variantOptions(owner);
  const variant = new Map(variantValues(main.name) ?? []);
  const values: (readonly [string, string | boolean])[] = [];
  for (const [name, given] of Object.entries(properties)) {
    const value = propertyInput(name, given);
    const flag = value === true || value === false;
    const choices = options.get(name);
    if (choices !== undefined) {
      if (value === true || value === false || !choices.includes(value)) {
        throw new Error(`${owner.id} has no ${name} ${String(value)} to show.`);
      }
      variant.set(name, value);
      continue;
    }
    const property = owner.properties.get(name);
    if (property === undefined) {
      throw new Error(`${state.id} shows no property ${name} to set.`);
    }
    if (flag !== (property.type === "BOOLEAN")) {
      throw new Error(`The ${property.type} property ${name} takes no ${String(value)}.`);
    }
    if (property.type === "INSTANCE_SWAP" && value !== true && value !== false) {
      componentWithId(state.file, value);
    }
    if (property.type === "TEXT") {
      for (const text of linkedBelow(state, "characters", name)) {
        requireHeldFonts(text, "characters");
      }
    }
    values.push([name, value]);
  }
  const target = owner === main ? main : variantWith(owner, variant);
  write(state, "set properties");
  for (const [id, value] of values) {
    state.propertyValues.set(id, value);
  }
  // A sublayer's values are an override of the instance around it (rule 45).
  if (state.mirrorOf !== undefined && values.length > 0) {
    state.overridden.add("componentProperties");
  }
  if (target !== main) {
    swapTo(state, target);
  } else {
    applySwapValues(state);
  }
  // Each TEXT write restyles its texts, a value equal to the one they show too (rule 52).
  for (const [id] of values) {
    if (owner.properties.get(id)?.type === "TEXT") {
      for (const text of linkedBelow(state, "characters", id)) {
        resetStyles(text);
      }
    }
  }
}

/** A value `setProperties` was given, refusing a variable, which no probe set (rule 34). */
function propertyInput(name: string, value: string | boolean | VariableAlias): string | boolean {
  if (value === true || value === false || isText(value)) {
    return value;
  }
  throw new Error(`The fake Figma file does not model setting ${name} to a variable.`);
}

/** The variant of a set that shows every value asked for (rule 34). */
function variantWith(set: NodeState, values: ReadonlyMap<string, string>): NodeState {
  const found = set.children.find((child) => {
    const shownValues = variantValues(child.name);
    return shownValues !== undefined && [...values].every(([name, value]) => shownValues.get(name) === value);
  });
  if (found === undefined) {
    throw new Error(
      `${set.id} has no variant ${[...values].map(([name, value]) => `${name}=${value}`).join(", ")}.`
    );
  }
  return found;
}

export function combineAsVariants(
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
