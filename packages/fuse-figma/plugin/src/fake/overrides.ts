/**
 * What an instance and its sublayers show of their main component: the field values and bindings a
 * layer shows, the overrides an instance holds, and a BOOLEAN property that hides a layer.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 36. A sublayer's id is `I`, the instance's id, `;` and its main layer's id (N1), and a sublayer reads
 *    the shared plugin data its main layer carries where it holds none of its own (N3). A swapped one
 *    reads its new main component's instead (rule 48).
 * 37. `overrides` lists each layer of an instance that holds an override, from the instance down, with
 *    its fields: the instance's own `name`, `width` and `height` (N1), its `fills`, `effects` and "the
 *    corner fields", and a sublayer's `fills` (N3). N3 did not name the corner fields, so the fake
 *    lists `cornerRadius` and the four corners the typings name. No probe listed a frame's own
 *    padding or alignment, so the fake lists them under their names in the typings (rule 64). A
 *    property value is no override (N1). A fill written equal to the main's left no `fills`
 *    override, and `overrides` listed only the instance's `name` (NS), so a fill, stroke or effects
 *    the fake stores equal to what the layer's source shows clears that override, and the field
 *    follows the source again. A number does not: a corner, gap, stroke weight or padding written or
 *    bound equal to the main's stays listed with `boundVariables` (FM3, rule 8). The fake lists a
 *    number other than a corner or a padding under its name in the typings. A whole `strokeWeight`
 *    lists `strokeWeight` and the four sides, the top one as `stokeTopWeight`, as FM3 read it and
 *    the typings spell it. A number write that changes a hugging instance's size lists its `width`
 *    and `height` too, as `itemSpacing = 7` on a hugging row did (FM3), and the instance still hugs.
 *    `removeOverrides` exists (N3), and the fake follows the typings' "removes all direct
 *    overrides": it clears what `overrides` lists and the numbers a layer holds as its own with
 *    their bindings (rule 8), and keeps the property values, apart from the lengths of an instance
 *    its modes hold (rule 56).
 * 38. An instance and its sublayers show their main component's fills, strokes, effects and corners,
 *    and its corner bindings, until they override them. On 2026-10-23 a padding change and a fill
 *    rebound to `destructive` on the inner variant reached the nested instance, which kept its `Retry`
 *    label (N2), and an instance's own fill bound to `success`, corner 2 and shadow, and its label's
 *    fill, all stayed when the main rebound its fill, set its corner to 10, cleared its effects and
 *    changed its label's fill (N3).
 * 48. A swapped sublayer reads its new main component's shared plugin data. On 2026-10-25 the owner's
 *    Apply stopped on an `Icon button` instance whose INSTANCE_SWAP `Icon` showed CaretDown: its one
 *    child, `Icon`, an instance of CaretDown with the id `I<instance>;<main layer>`, read the key
 *    `icon/CaretDown`, while the main's `Icon` at the same place, a Plus instance, read `icon-only`
 *    (PK). So a sublayer swapped by `swapComponent` or a swap property reads the entries its new main
 *    component carries where it holds none of its own, and keeps its name (rule 43), its id and its
 *    place, as the instance's children stand one for one, in order, for its main's. A swap made on the
 *    main's own layer is no swap apart: after `swapComponent(Q)` on a component's own `Icon`, keyed
 *    `icon-only`, the layer still read `icon-only`, and an instance's sublayer read `icon-only`, named
 *    Q from `getMainComponentAsync`, showed Q's `glyph` and listed no override (PK2). So a sublayer
 *    that does not swap apart reads its main layer's entries and shows its main layer's component.
 *    A `swapComponent` on a sublayer to the component it already shows is no swap apart either. On
 *    2026-11-20 a real file's nested sublayer, keyed `slot` on its main layer, still read `slot`
 *    after `swapComponent(A)` while it showed `A`, and the enclosing instance listed no override. On
 *    a second instance, the same sublayer swapped to `C` read `C`'s key (FD4). The fake compares the
 *    component the sublayer shows at the time of the call.
 *
 * An instance's sublayers show the layers of its main component, and a nested instance's sublayers
 * the sublayers its main layer shows. An override, such as the color an icon layer gives its glyph,
 * belongs to the main layer it was made on. It moves to the layer of the same name when the
 * instance swaps, as Figma's help describes and the plugin relies on, and it is lost when the main
 * component replaces that layer, which is the fake's reading of how Figma ties overrides to layers.
 */

import { deepFrozen } from "../../../test/frozen.ts";
import { shownBinding } from "./modes.ts";
import { EFFECT_FIELD_TYPES, isStoredNumber, numberOwner, sourceOf } from "./state.ts";
import type { NodeState, StoredNumberField } from "./state.ts";

/** The fields an instance or a sublayer shows from its source until it overrides them (rule 38). */
type ShownField = "fills" | "strokes" | "effects";

/** The paints and effects `shown` has deep frozen, so a value read again skips the walk. */
const frozenShown = new WeakSet<object>();

/**
 * A field as a layer shows it: its own where it overrides it or has no source, else its source's
 * (rule 38). Figma hands out frozen paints and effects, and a fork shares these values with the
 * file it came from, so the fake freezes what it hands out. A corner reads as a number (rule 8).
 */
export function shown<Field extends ShownField>(state: NodeState, field: Field): NodeState[Field] {
  const source = sourceOf(state);
  if (source !== undefined && !state.overridden.has(field)) {
    return shown(source, field);
  }
  const value = state[field];
  if (!frozenShown.has(value)) {
    frozenShown.add(deepFrozen(value));
  }
  return value;
}

/** Note an override of a field on an instance or a sublayer (rule 37); any other layer has none. */
export function markOverride(state: NodeState, field: string): void {
  if (sourceOf(state) !== undefined) {
    state.overridden.add(field);
  }
}

/**
 * Note a write of a field an instance or a sublayer shows from its source (rule 37): an override,
 * or none where the layer now holds what its source shows. On 2026-10-24 a fill written equal to the
 * main's left no `fills` override, and the field followed the main again (NS).
 */
export function noteOverride(state: NodeState, field: ShownField): void {
  const source = sourceOf(state);
  if (source === undefined) {
    return;
  }
  const shownBySource: Pick<NodeState, ShownField> = {
    fills: shown(source, "fills"),
    strokes: shown(source, "strokes"),
    effects: shown(source, "effects"),
  };
  if (fieldKey(field, state) === fieldKey(field, shownBySource)) {
    state.overridden.delete(field);
  } else {
    state.overridden.add(field);
  }
}

/**
 * List the numbers a write, a binding or an unbind made an instance's or a sublayer's own (rules 8,
 * 37): `overrides` lists each from then on, the corners together, and `boundVariables` where the
 * layer binds the field or its source showed it bound. On 2026-11-20 an instance that wrote 7 over
 * its main's bound `itemSpacing`, `topLeftRadius`, `strokeWeight` or `paddingLeft`, then bound the
 * main's own variable, listed the field and `boundVariables`, and still did once the main took a
 * literal (FM3). So a number the layer holds equal to its source's stays its own.
 */
export function listNumbers(state: NodeState, fields: readonly StoredNumberField[]): void {
  const source = sourceOf(state);
  if (source === undefined) {
    return;
  }
  for (const field of fields) {
    if (CORNER_FIELDS.some((corner) => corner === field)) {
      state.overridden.add("radii");
    }
    if (state.bindings.has(field) || shownBinding(source, field) !== undefined) {
      state.overridden.add("boundVariables");
    }
  }
}

/** The four corner fields. */
const CORNER_FIELDS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** A plain value a key holds. */
type KeyPart = string | number | boolean | null;

/**
 * A layer's paints or effects for a field, as text that two layers holding the same ones share,
 * whatever order their objects list their fields in.
 */
function fieldKey(field: ShownField, layer: Pick<NodeState, ShownField>): string {
  switch (field) {
    case "fills":
    case "strokes":
      return JSON.stringify(layer[field].map(paintKey));
    case "effects":
      return JSON.stringify(layer.effects.map(effectKey));
  }
}

/** A stored paint's fields in a fixed order. */
function paintKey(paint: Paint): readonly KeyPart[] {
  const shared = [paint.type, paint.visible ?? true, paint.blendMode ?? "NORMAL", paint.opacity ?? 1];
  switch (paint.type) {
    case "SOLID":
      return [
        ...shared,
        paint.color.r,
        paint.color.g,
        paint.color.b,
        paint.boundVariables?.color?.id ?? null,
      ];
    case "IMAGE":
      return [...shared, paint.imageHash, paint.scaleMode];
    default:
      return shared;
  }
}

/** A stored effect's fields in a fixed order. */
function effectKey(effect: Effect): readonly KeyPart[] {
  if (effect.type === "BACKGROUND_BLUR" || effect.type === "LAYER_BLUR") {
    return [effect.type, effect.visible, effect.radius];
  }
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    return [effect.type, effect.visible];
  }
  const bound = [...EFFECT_FIELD_TYPES.keys()].map((name) => effect.boundVariables?.[name]?.id ?? null);
  const { r, g, b, a } = effect.color;
  return [
    effect.type,
    effect.visible,
    effect.blendMode,
    r,
    g,
    b,
    a,
    effect.offset.x,
    effect.offset.y,
    effect.radius,
    effect.spread ?? 0,
    ...bound,
  ];
}

/** The main component's layer a sublayer shows, through every instance between them. */
export function rootMain(state: NodeState): NodeState {
  let main = state;
  while (main.mirrorOf !== undefined) {
    main = main.mirrorOf;
  }
  return main;
}

/** The nearest instance around a layer, which sets the properties its main layer links. */
export function nearestInstance(state: NodeState): NodeState | undefined {
  let current = state.parent;
  while (current !== undefined && current.type !== "INSTANCE") {
    current = current.parent;
  }
  return current;
}

/**
 * The value an instance sets for a property, or the one the instance it shows through sets, as an
 * outer instance shows the values a component set on the instance nested in it.
 */
export function propertyValue(state: NodeState, id: string): string | boolean | undefined {
  return (
    state.propertyValues.get(id) ??
    (state.mirrorOf === undefined ? undefined : propertyValue(state.mirrorOf, id))
  );
}

/**
 * The variable each bound field follows, by id: its own, and on an instance or a sublayer the one
 * its source shows on each number it does not hold as its own, as it shows its source's corners
 * (rules 8, 38). An instance that binds no width or height of its own shows its source's binding
 * there (rule 56), and a sublayer its main layer's until it holds its own length.
 */
export function shownBindings(state: NodeState): ReadonlyMap<VariableBindableNodeField, string> {
  const source = sourceOf(state);
  if (source === undefined) {
    return state.bindings;
  }
  const inherited = [...shownBindings(source)].filter(([field]) => {
    if (state.bindings.has(field)) {
      return false;
    }
    if (field === "width" || field === "height") {
      return state.type === "INSTANCE"
        ? !state.unboundLengths.has(field)
        : !state.overridden.has(numberOwner(field));
    }
    return isStoredNumber(field) && !state.overridden.has(numberOwner(field));
  });
  return new Map([...state.bindings, ...inherited]);
}

/** The node a layer's property link reads from: its component set, or its component. */
export function propertyOwner(state: NodeState): NodeState | undefined {
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

/**
 * Whether a layer is hidden through a BOOLEAN property (rule 25). A component's layer that links
 * its `visible` to a property hides while the property starts false. An instance's sublayer reads
 * the property at the value the nearest instance around it sets, or the instance it shows through,
 * or else at its default.
 */
export function hiddenByProperty(state: NodeState): boolean {
  const main = rootMain(state);
  const id = main.propertyReferences?.visible;
  if (id === undefined) {
    return false;
  }
  const defaultValue = propertyOwner(main)?.properties.get(id)?.defaultValue;
  if (state.mirrorOf === undefined) {
    return defaultValue === false;
  }
  const instance = nearestInstance(state);
  return ((instance === undefined ? undefined : propertyValue(instance, id)) ?? defaultValue) === false;
}

/**
 * Whether a layer is hidden by a write of `visible`, which the typings let the plugin make on any
 * scene node. An instance's sublayer shows its main layer's value until a write on the sublayer
 * overrides it (rule 37), as it shows every other field.
 */
function hiddenByWrite(state: NodeState): boolean {
  return state.mirrorOf === undefined || state.overridden.has("visible")
    ? state.hidden
    : hiddenByWrite(state.mirrorOf);
}

/**
 * Whether a layer is hidden, through a BOOLEAN property (rule 25) or a write of `visible`. A hidden
 * layer reads `visible` false, leaves its parent's auto layout, which no longer counts its length
 * (PB), and reads FIXED on an axis it fills (rule 42).
 */
export function isHidden(state: NodeState): boolean {
  return hiddenByProperty(state) || hiddenByWrite(state);
}
