/**
 * Instance layers: an instance of another kit set's variant inside a variant, such as an Alert's
 * action Button, so the composite stays linked to the set that draws the part. The plan points the
 * instance at the variant, sets the inner set's properties, overrides paints, corners and shadows on
 * it and on the layers below it, and a text's alignment across its lines, sizes it in its parent's
 * auto layout, links its visibility to the outer set's BOOLEAN property and marks whether it is
 * exposed.
 *
 * On 2026-10-23 and 2026-10-24 a real file showed what a nested instance does (N1 to N5, NS):
 * `swapComponent` and a variant change keep its node, its property values, its visibility link and
 * its exposure, its sublayers read the shared plugin data of their main layers, an override survives
 * an edit of the same field in the main, and an override written equal to the main's is none, so that
 * field follows the main again. A text's alignment is the exception: its override stays listed after
 * a write equal to the main's (NA). On 2026-10-25 a swapped icon read its new main component's key
 * instead (PK), so the plan finds a sublayer by the key of the main component's layer at its place.
 *
 * On 2026-10-25 a real file set the TEXT property of an instance exposed two levels down through
 * exposure, and the value stayed through the outer instance's own writes and a switch of its variant,
 * which gave the nested sublayers new ids (PN). So the last stage finds each nested instance again by
 * its key path and sets the values the spec gives it.
 *
 * The plan reads an instance in stages, each against what the stage before leaves (`planInstance`).
 */

import { layerAt, ringFill, walkLayers } from "../../src/components/kit-spec.ts";
import type {
  ComponentRootSpec,
  FillSpec,
  InstanceLayerSpec,
  InstanceOverride,
  NestedPropertiesSpec,
  NumberSpec,
  ShadowSpec,
  SizingSpec,
  TextLayerSpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { planAnchoring } from "./anchoring.ts";
import type { PlannedSet } from "./component-set.ts";
import {
  heldFonts,
  heldSizing,
  LAYOUT_SIZING,
  planNumber,
  planPaints,
  planScalar,
  planShadows,
  planVisibleLink,
  requireFont,
  SIZING_MEMBERS,
} from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { glyphOf } from "./icons.ts";
import type { PlannedIcon } from "./icons.ts";
import { keyOf } from "./identity.ts";
import { change, changeTogether, newPlan, performPlan } from "./plan.ts";
import type { Target } from "./plan.ts";
import { cornerField, planLength, planLimit } from "./root-layer.ts";

/** The inner set and variant an instance layer shows, as the plan leaves them. */
export type InnerVariant = {
  readonly set: PlannedSet;
  readonly spec: VariantSpec;
  readonly node: Target<ComponentNode>;
};

/** What an instance layer links to: the outer set's properties and the kit's icons. */
export type InstanceLinks = {
  readonly properties: ReadonlyMap<string, string>;
  readonly icons: ReadonlyMap<string, PlannedIcon>;
};

/**
 * The inner set and variant an instance layer names, which the plan of an earlier set leaves.
 *
 * @param sets - The sets the run planned before this one, by key.
 * @param layer - The instance layer.
 * @param label - The layer's label, for errors.
 * @returns The inner set and variant.
 * @throws When the kit lists no such set before this one, or the set no such variant, which the kit
 *   check refuses first.
 */
export function innerVariant(
  sets: ReadonlyMap<string, PlannedSet>,
  layer: InstanceLayerSpec,
  label: string
): InnerVariant {
  const set = sets.get(layer.componentSet);
  const spec = set?.spec.variants.find((variant) => variant.key === layer.variant);
  const node = set?.variants.get(layer.variant);
  if (set === undefined || spec === undefined || node === undefined) {
    throw new Error(
      `${label} shows ${layer.variant} of ${layer.componentSet}, which no earlier set defines.`
    );
  }
  return { set, spec, node };
}

/**
 * The labels of a variant that a TEXT property sets, whose fonts a TEXT write on an instance needs.
 *
 * @param variant - The inner variant.
 * @returns The text layers that link a TEXT property.
 */
export function linkedLabels(variant: VariantSpec): readonly TextLayerSpec[] {
  return walkLayers(variant.root).filter(
    (layer): layer is TextLayerSpec => layer.kind === "text" && layer.textProperty !== undefined
  );
}

/** A property value the spec asks the instance for, and how a held value matches it. */
type DesiredProperty = {
  readonly name: string;
  readonly type: "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  readonly holds: (value: string | boolean) => boolean;
  /** The value to write, which a swap reads from its icon once the icon exists. */
  readonly value: () => string | boolean;
  readonly shown: string;
};

/**
 * Every property of the inner set at the value the spec gives it, or at its default, so a value the
 * instance kept from an earlier spec or a swap goes back.
 */
function desiredProperties(
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  icons: ReadonlyMap<string, PlannedIcon>,
  label: string
): readonly DesiredProperty[] {
  const set = inner.set.spec;
  const given = spec.properties;
  const texts = set.textProperties.map((property): DesiredProperty => {
    const value = given?.text?.[property.name] ?? property.defaultValue;
    return {
      name: property.name,
      type: "TEXT",
      holds: (held) => held === value,
      value: () => value,
      shown: JSON.stringify(value),
    };
  });
  const booleans = (set.booleanProperties ?? []).map((property): DesiredProperty => {
    const value = given?.boolean?.[property.name] ?? property.defaultValue;
    return {
      name: property.name,
      type: "BOOLEAN",
      holds: (held) => held === value,
      value: () => value,
      shown: String(value),
    };
  });
  const swaps = set.swapProperties.map((property): DesiredProperty => {
    const key = given?.swap?.[property.name] ?? property.defaultIcon;
    const icon = icons.get(key);
    if (icon === undefined) {
      throw new Error(`${label} swaps ${property.name} to ${key}, which the kit's icon library lacks.`);
    }
    return {
      name: property.name,
      type: "INSTANCE_SWAP",
      holds: (held) => held === icon.node.existing?.id,
      value: () => icon.node.get().id,
      shown: icon.spec.name,
    };
  });
  return [...texts, ...booleans, ...swaps];
}

/**
 * The inner set's properties whose values the instance does not hold: `componentProperties` read,
 * each spec name matched to its `Name#id`. The variant is no property here: the instance shows it
 * through its main component.
 */
function differingProperties(
  instance: InstanceNode,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  icons: ReadonlyMap<string, PlannedIcon>,
  label: string
): readonly DesiredProperty[] {
  const held = Object.entries(instance.componentProperties);
  return desiredProperties(spec, inner, icons, label).filter((desired) => {
    const found = held.find(
      ([id, property]) => property.type === desired.type && id.split("#")[0] === desired.name
    );
    return found === undefined || !desired.holds(found[1].value);
  });
}

/**
 * Set properties in one `setProperties`, which finds each id through the inner set when it runs, so a
 * property the run adds to that set works.
 */
function writeProperties(
  instance: InstanceNode,
  label: string,
  inner: InnerVariant,
  differ: readonly DesiredProperty[]
): void {
  const values: { [id: string]: string | boolean } = {};
  for (const desired of differ) {
    const id = inner.set.properties.get(desired.name);
    if (id === undefined) {
      throw new Error(
        `${label}: ${inner.set.spec.name} has no ${desired.name} property when the instance sets it.`
      );
    }
    values[id] = desired.value();
  }
  instance.setProperties(values);
}

/** A layer of the instance the kit owns: the instance itself, or a sublayer found by its key path. */
type HeldLayer = {
  readonly node: SceneNode;
  readonly label: string;
  readonly path: readonly string[];
};

/** A path as a map key. */
function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

/**
 * The layer whose layers give an instance's sublayers their keys: its main component, or the instance
 * itself where a designer deleted the main, whose layers can no longer be read. Then each sublayer
 * gives its own key, as N3 read every sublayer but a swapped one.
 */
async function keySource(instance: InstanceNode): Promise<ChildrenMixin> {
  const main = await instance.getMainComponentAsync();
  return main === null || main.removed ? instance : main;
}

/**
 * The layers of an instance, or of a frame inside one, each beside the layer of the main component it
 * stands for. A real file kept an instance's children one for one and in order with its main's, and
 * read a swapped icon with its new main component's key where its main layer held another (PK), so a
 * sublayer takes its key from that layer.
 *
 * @throws When the two lists differ in length, which Figma rules out.
 */
function besideMain(
  layer: ChildrenMixin,
  main: ChildrenMixin,
  label: string
): readonly (readonly [SceneNode, SceneNode])[] {
  const shown = main.children;
  if (layer.children.length !== shown.length) {
    throw new Error(
      `${label} holds ${layer.children.length} layers where its main component holds ${shown.length}.`
    );
  }
  return layer.children.flatMap((child, index) => {
    const source = shown[index];
    return source === undefined ? [] : [[child, source] as const];
  });
}

/**
 * The instance and its keyed sublayers by key path, each found by the key of the main component's
 * layer it stands for (`besideMain`). The walk goes down through frames and stops at an icon or
 * another nested instance.
 */
async function heldLayers(instance: InstanceNode, label: string): Promise<ReadonlyMap<string, HeldLayer>> {
  const found = new Map<string, HeldLayer>([[pathKey([]), { node: instance, label, path: [] }]]);
  const walk = (
    parent: ChildrenMixin,
    main: ChildrenMixin,
    path: readonly string[],
    parentLabel: string
  ): void => {
    for (const [child, source] of besideMain(parent, main, parentLabel)) {
      const key = keyOf(source);
      if (key === "") {
        continue;
      }
      const layer = { node: child, label: `${parentLabel} / ${child.name}`, path: [...path, key] };
      found.set(pathKey(layer.path), layer);
      if (child.type === "FRAME" && source.type === "FRAME") {
        walk(child, source, layer.path, layer.label);
      }
    }
  };
  walk(instance, await keySource(instance), [], label);
  return found;
}

/**
 * The instance inside `instance` at a key path, found through frames and nested instances by the keys
 * of the main components' layers (`besideMain`), or undefined where the path leads nowhere.
 */
async function nestedAt(
  instance: InstanceNode,
  path: readonly string[],
  label: string
): Promise<InstanceNode | undefined> {
  let at: SceneNode = instance;
  let atLabel = label;
  let main: ChildrenMixin | undefined = await keySource(instance);
  for (const key of path) {
    const found: readonly [SceneNode, SceneNode] | undefined =
      main !== undefined && (at.type === "FRAME" || at.type === "INSTANCE")
        ? besideMain(at, main, atLabel).find(([, source]) => keyOf(source) === key)
        : undefined;
    if (found === undefined) {
      return undefined;
    }
    const [child, source]: readonly [SceneNode, SceneNode] = found;
    at = child;
    atLabel = `${atLabel} / ${child.name}`;
    if (child.type === "INSTANCE") {
      main = await keySource(child);
    } else {
      main = source.type === "FRAME" ? source : undefined;
    }
  }
  return at.type === "INSTANCE" ? at : undefined;
}

/** The TEXT values a nested instance holds another way than the spec gives them, by property id. */
function differingNested(
  target: InstanceNode,
  nested: NestedPropertiesSpec,
  label: string
): Readonly<Record<string, string>> {
  const held = Object.entries(target.componentProperties);
  return Object.fromEntries(
    Object.entries(nested.text).flatMap(([name, value]) => {
      const found = held.find(([id, property]) => property.type === "TEXT" && id.split("#")[0] === name);
      if (found === undefined) {
        throw new Error(`${label}: the nested instance has no TEXT property ${name} to set.`);
      }
      return found[1].value === value ? [] : [[found[0], value]];
    })
  );
}

/**
 * Plan the TEXT values the spec gives instances exposed inside the instance, each found again by its
 * key path when its operation runs, since a variant switch gives nested sublayers new ids (PN).
 */
async function planNested(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec
): Promise<void> {
  for (const nested of spec.properties?.nested ?? []) {
    const at = `${label} / ${nested.path.join(" / ")}`;
    const target = await nestedAt(instance, nested.path, label);
    if (target === undefined) {
      throw new Error(`${at}: the instance holds no nested instance at that path.`);
    }
    const differ = differingNested(target, nested, at);
    if (Object.keys(differ).length === 0) {
      continue;
    }
    const described = Object.entries(nested.text)
      .filter(([name]) => Object.keys(differ).some((id) => id.split("#")[0] === name))
      .map(([name, value]) => `${name} ${JSON.stringify(value)}`)
      .join(", ");
    change(run.plan, at, `properties → ${described}`, async () => {
      const now = await nestedAt(instance, nested.path, label);
      if (now === undefined) {
        throw new Error(`${at}: the instance holds no nested instance at that path.`);
      }
      now.setProperties(differingNested(now, nested, at));
    });
  }
}

/** An override the plan writes: the spec's, or the inner variant's own value for one it dropped. */
type OverrideWrite =
  | { readonly field: "fill" | "strokeColor" | "textColor" | "glyph"; readonly paint: FillSpec | undefined }
  | { readonly field: "cornerRadius"; readonly value: NumberSpec }
  | { readonly field: "effects"; readonly shadows: readonly ShadowSpec[] }
  | { readonly field: "textAlign"; readonly horizontal: TextLayerSpec["align"]["horizontal"] };

/** The write an override of the spec asks for. */
function writeOf(override: InstanceOverride): OverrideWrite {
  switch (override.field) {
    case "cornerRadius":
      return { field: override.field, value: override.value };
    case "effects":
      return { field: override.field, shadows: override.shadows };
    case "textAlign":
      return { field: override.field, horizontal: override.horizontal };
    default:
      return { field: override.field, paint: override.color };
  }
}

/** A box layer of an instance that takes a fill, stroke, corner or shadow override. */
function boxOf(layer: HeldLayer, field: string): FrameNode | InstanceNode {
  const { node } = layer;
  if (node.type !== "FRAME" && node.type !== "INSTANCE") {
    throw new Error(`${layer.label} is a ${node.type}, which takes no ${field} override.`);
  }
  return node;
}

/** Plan one override with the planner of its field, so an override the layer holds plans nothing. */
function planOverride(run: Run, layer: HeldLayer, write: OverrideWrite): void {
  const { label, node } = layer;
  switch (write.field) {
    case "fill": {
      const box = boxOf(layer, write.field);
      planPaints(run, label, "fill", box.fills, write.paint, (paints) => {
        box.fills = paints;
      });
      return;
    }
    case "strokeColor": {
      const box = boxOf(layer, write.field);
      planPaints(run, label, "stroke", box.strokes, write.paint, (paints) => {
        box.strokes = paints;
      });
      return;
    }
    case "textColor": {
      if (node.type !== "TEXT") {
        throw new Error(`${label} is a ${node.type}, which takes no text color override.`);
      }
      planPaints(run, label, "text color", node.fills, write.paint, (paints) => {
        node.fills = paints;
      });
      return;
    }
    case "textAlign": {
      if (node.type !== "TEXT") {
        throw new Error(`${label} is a ${node.type}, which takes no text alignment override.`);
      }
      planScalar(run, label, "textAlignHorizontal", node.textAlignHorizontal, write.horizontal, () => {
        node.textAlignHorizontal = write.horizontal;
      });
      return;
    }
    case "glyph": {
      const glyph = node.type === "INSTANCE" ? glyphOf(node) : undefined;
      if (glyph === undefined) {
        throw new Error(`${label} draws no glyph to color.`);
      }
      planPaints(run, `${label} / glyph`, "fill", glyph.fills, write.paint, (paints) => {
        glyph.fills = paints;
      });
      return;
    }
    case "cornerRadius": {
      const box = boxOf(layer, write.field);
      planNumber(run, box, label, cornerField(box), write.value);
      return;
    }
    case "effects":
      planShadows(run, boxOf(layer, write.field), label, write.shadows);
  }
}

/**
 * What the inner variant itself shows for a field at a key path: the value an instance goes back to
 * when the spec drops its override. A root takes the fill its ring needs, as the plugin writes it.
 */
function innerValue(
  root: ComponentRootSpec,
  path: readonly string[],
  field: OverrideWrite["field"]
): OverrideWrite | undefined {
  const layer = layerAt(root, path);
  if (layer === undefined) {
    return undefined;
  }
  if (!("kind" in layer) || layer.kind === "frame") {
    const fill = "kind" in layer ? layer.fill : ringFill(layer);
    switch (field) {
      case "fill":
        return { field, paint: fill };
      case "strokeColor":
        return { field, paint: layer.stroke?.color };
      case "cornerRadius":
        return { field, value: layer.cornerRadius };
      case "effects":
        return { field, shadows: layer.shadows };
      default:
        return undefined;
    }
  }
  if (layer.kind === "text" && field === "textColor") {
    return { field, paint: layer.color };
  }
  if (layer.kind === "text" && field === "textAlign") {
    return { field, horizontal: layer.align.horizontal };
  }
  if (layer.kind === "icon" && field === "glyph") {
    return { field, paint: layer.color };
  }
  return undefined;
}

/** The override fields a held override of a layer's Figma field stands for. */
function fieldsOf(
  node: SceneNode,
  glyph: boolean,
  overridden: readonly NodeChangeProperty[]
): readonly OverrideWrite["field"][] {
  const fields = new Set<OverrideWrite["field"]>();
  for (const name of overridden) {
    if (glyph) {
      if (name === "fills") {
        fields.add("glyph");
      }
    } else if (node.type === "TEXT") {
      if (name === "fills") {
        fields.add("textColor");
      } else if (name === "textAlignHorizontal") {
        fields.add("textAlign");
      }
    } else if (node.type === "FRAME" || node.type === "INSTANCE") {
      const field = BOX_FIELDS.get(name);
      if (field !== undefined) {
        fields.add(field);
      }
    }
  }
  return [...fields];
}

/** The box fields the kit overrides, by the Figma fields `overrides` lists for them (N3). */
const BOX_FIELDS: ReadonlyMap<NodeChangeProperty, OverrideWrite["field"]> = new Map<
  NodeChangeProperty,
  OverrideWrite["field"]
>([
  ["fills", "fill"],
  ["strokes", "strokeColor"],
  ["effects", "effects"],
  ["cornerRadius", "cornerRadius"],
  ["topLeftRadius", "cornerRadius"],
  ["topRightRadius", "cornerRadius"],
  ["bottomLeftRadius", "cornerRadius"],
  ["bottomRightRadius", "cornerRadius"],
]);

/**
 * Plan the overrides the instance holds and the spec dropped back to the inner variant's own values.
 * `overrides` lists the instance's own fields and its sublayers', as a real file did (N1, N3), so the
 * plan reads which paints, corners and shadows a layer overrides. The value written is the inner
 * variant's, so a held one that matches plans nothing. An override written equal to the main's is
 * none (NS), so the field follows the main again.
 */
function planDroppedOverrides(
  run: Run,
  instance: InstanceNode,
  layers: ReadonlyMap<string, HeldLayer>,
  spec: InstanceLayerSpec,
  root: ComponentRootSpec
): void {
  const kept = new Set(
    (spec.overrides ?? []).map((override) => `${pathKey(override.path)}:${override.field}`)
  );
  const byId = new Map<string, { readonly layer: HeldLayer; readonly glyph: boolean }>();
  for (const layer of layers.values()) {
    byId.set(layer.node.id, { layer, glyph: false });
    const glyph = layer.path.length > 0 && layer.node.type === "INSTANCE" ? glyphOf(layer.node) : undefined;
    if (glyph !== undefined) {
      byId.set(glyph.id, { layer, glyph: true });
    }
  }
  for (const { id, overriddenFields } of instance.overrides) {
    const held = byId.get(id);
    if (held === undefined) {
      continue;
    }
    for (const field of fieldsOf(held.layer.node, held.glyph, overriddenFields)) {
      const write = kept.has(`${pathKey(held.layer.path)}:${field}`)
        ? undefined
        : innerValue(root, held.layer.path, field);
      if (write !== undefined) {
        planOverride(run, held.layer, write);
      }
    }
  }
}

/**
 * Plan the spec's overrides, then the ones the instance holds and the spec dropped, against the
 * sublayers as they stand. The staging in {@link planInstance} plans this only once every operation
 * that can replace or add a sublayer has run, so each layer the spec names is there.
 *
 * @throws When the instance holds no layer at a path the spec overrides, which the kit check and the
 *   staging rule out.
 */
async function planOverrides(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  root: ComponentRootSpec
): Promise<void> {
  const layers = await heldLayers(instance, label);
  for (const override of spec.overrides ?? []) {
    const layer = layers.get(pathKey(override.path));
    if (layer === undefined) {
      throw new Error(`${label} holds no layer ${override.path.join(" / ")} to override.`);
    }
    planOverride(run, layer, writeOf(override));
  }
  planDroppedOverrides(run, instance, layers, spec, root);
}

/**
 * Plan how the instance sizes in its parent's auto layout, as one operation. An axis the spec fixes is
 * written FIXED first, since a real file kept a hugging instance's height when its height bound a
 * variable (N4). The lengths follow, written whatever they read on an axis that turns FIXED, then both
 * axes' sizing, since a resize turns a filling axis fixed (P2).
 *
 * @param held - `unknown` when the box that holds the instance turns in this run, which moves a fill
 *   to the other axis, so the sizing and lengths are written whatever they read now.
 */
function planSizing(run: Run, instance: InstanceNode, label: string, sizing: SizingSpec, held: Held): void {
  const desired = {
    horizontal: LAYOUT_SIZING[sizing.horizontal.kind],
    vertical: LAYOUT_SIZING[sizing.vertical.kind],
  };
  const reads = held === "read" ? heldSizing(instance) : undefined;
  const writeSizing = (): void => {
    instance.layoutSizingHorizontal = desired.horizontal;
    instance.layoutSizingVertical = desired.vertical;
  };
  changeTogether(
    run.plan,
    label,
    (plan) => {
      const group = { ...run, plan };
      for (const [axis, member] of SIZING_MEMBERS) {
        if (sizing[axis].kind === "fixed" && reads?.[axis] !== "FIXED") {
          change(plan, label, `${member} → FIXED`, () => {
            instance[member] = "FIXED";
          });
        }
      }
      // An axis that turns FIXED holds the length it hugged or filled, a binding included (N4), so
      // its length is written whatever it reads now.
      const lengths = (axis: keyof SizingSpec): Held => (reads?.[axis] === "FIXED" ? "read" : "unknown");
      planLength(group, instance, label, "width", sizing.horizontal, lengths("horizontal"), (value) =>
        instance.resize(value, instance.height)
      );
      planLength(group, instance, label, "height", sizing.vertical, lengths("vertical"), (value) =>
        instance.resize(instance.width, value)
      );
      for (const [axis, member] of SIZING_MEMBERS) {
        if (sizing[axis].kind !== "fixed" && reads?.[axis] !== desired[axis]) {
          change(plan, label, `${member} → ${desired[axis]}`, writeSizing);
        }
      }
    },
    writeSizing
  );
}

/**
 * Plan, when an operation runs, what it then reads: the writes `stage` records into a plan of their
 * own, performed at once, as `create` plans a new node's contents.
 */
async function planWhenRun(run: Run, stage: (later: Run) => Promise<void>): Promise<void> {
  const later = newPlan(run.plan);
  await stage({ ...run, plan: later });
  await performPlan(later);
}

/**
 * The last stage: the overrides and the sizing against the sublayers as they stand, the link to the
 * outer set's BOOLEAN property and the exposure.
 *
 * @param held - `unknown` when the box that holds the instance turns in this run.
 */
async function planOverridesAndSizing(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks,
  held: Held
): Promise<void> {
  await planOverrides(run, instance, label, spec, inner.spec.root);
  await planNested(run, instance, label, spec);
  // Figma refuses FILL on an absolute layer (P8), so an instance leaves the flow after its sizing
  // and comes back into it before.
  if (spec.absolute === undefined) {
    planAnchoring(run, instance, label, undefined, held);
  }
  planSizing(run, instance, label, spec.sizing, held);
  if (spec.absolute !== undefined) {
    planAnchoring(run, instance, label, spec.absolute, held);
  }
  // An instance with no minimum of its own shows the inner variant's (PH3).
  planLimit(run, instance, label, "minWidth", spec.minWidth ?? inner.spec.root.limits.minWidth);
  planVisibleLink(run, instance, label, spec.visibleProperty, links.properties);
  const exposed = spec.exposed === true;
  planScalar(run, label, "isExposedInstance", instance.isExposedInstance, exposed, () => {
    instance.isExposedInstance = exposed;
  });
}

/**
 * The stages after the main: the properties in one `setProperties`, then the last stage. A property
 * write can replace a sublayer, as a swap property replaces the icon and its glyph, so when the
 * instance's properties differ, the operation that writes them plans the last stage once it has run,
 * against the sublayers it leaves. Plan lists that operation alone.
 *
 * @param held - `unknown` when the box that holds the instance turns in this run.
 */
async function planStages(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks,
  held: Held
): Promise<void> {
  const differ = differingProperties(instance, spec, inner, links.icons, label);
  if (differ.length === 0) {
    await planOverridesAndSizing(run, instance, label, spec, inner, links, held);
    return;
  }
  const described = differ.map((desired) => `${desired.name} ${desired.shown}`).join(", ");
  change(run.plan, label, `properties → ${described}`, async () => {
    writeProperties(instance, label, inner, differ);
    await planWhenRun(run, (later) =>
      planOverridesAndSizing(later, instance, label, spec, inner, links, "read")
    );
  });
}

/**
 * Whether the run writes to what the instance shows before the instance's own operations: the inner
 * set, which also counts a set its variants nest instances of, since that set's change lays the inner
 * set out again, or an icon its swap properties or icon layers show, whose glyph a redraw replaces
 * or a repaint recolors.
 */
function changesFirst(
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  icons: ReadonlyMap<string, PlannedIcon>
): boolean {
  const swaps = inner.set.spec.swapProperties.map(
    (property) => spec.properties?.swap?.[property.name] ?? property.defaultIcon
  );
  const layers = walkLayers(inner.spec.root).flatMap((layer) => (layer.kind === "icon" ? [layer.icon] : []));
  return inner.set.changed || [...swaps, ...layers].some((key) => icons.get(key)?.changesGlyph === true);
}

/**
 * Require every font the labels of an instance the file holds use where the run may write their TEXT
 * property or their alignment: a TEXT write changes a label's characters, and an alignment write its
 * lines, which needs each font the label holds loaded, a font a designer gave it and each range of
 * mixed ones included, as Figma's text guide and the typings say. A label the spec aligns, or one that
 * holds an alignment the spec may drop, takes its fonts too. Planned before the first write, so a font
 * this machine lacks stops the run with nothing written.
 *
 * @param spec - The instance layer, whose overrides name the labels it aligns.
 * @param differ - The properties the instance's values differ in now, or undefined where its stages
 *   wait for an earlier operation, after which the run may write any of its TEXT properties and any
 *   nested value.
 */
async function requireHeldLabelFonts(
  run: Run,
  instance: InstanceNode,
  label: string,
  inner: InnerVariant,
  spec: InstanceLayerSpec,
  differ: readonly DesiredProperty[] | undefined
): Promise<void> {
  const written = new Set(
    differ === undefined
      ? inner.set.spec.textProperties.map((property) => property.name)
      : differ.flatMap((desired) => (desired.type === "TEXT" ? [desired.name] : []))
  );
  const keys = new Set([
    ...linkedLabels(inner.spec).flatMap((text) =>
      text.textProperty !== undefined && written.has(text.textProperty) ? [text.key] : []
    ),
    ...(spec.overrides ?? []).flatMap((override) =>
      override.field === "textAlign" ? [override.path.at(-1) ?? ""] : []
    ),
  ]);
  const aligned = new Set(
    instance.overrides.flatMap(({ id, overriddenFields }) =>
      overriddenFields.includes("textAlignHorizontal") ? [id] : []
    )
  );
  for (const layer of (await heldLayers(instance, label)).values()) {
    const { node } = layer;
    if (node.type === "TEXT" && (keys.has(layer.path.at(-1) ?? "") || aligned.has(node.id))) {
      for (const font of heldFonts(run, node)) {
        requireFont(run, layer.label, font);
      }
    }
  }
  // A nested value writes the labels of the instance it reaches, whatever fonts they hold now: those
  // whose values differ now, or every one where an earlier write, the main or the instance's own
  // properties, runs first and can replace the instances it reaches.
  const replaced = differ === undefined || differ.length > 0;
  for (const nested of spec.properties?.nested ?? []) {
    const target = await nestedAt(instance, nested.path, label);
    const at = `${label} / ${nested.path.join(" / ")}`;
    const writes =
      target !== undefined && (replaced || Object.keys(differingNested(target, nested, at)).length > 0);
    for (const layer of writes ? (await heldLayers(target, at)).values() : []) {
      if (layer.node.type === "TEXT") {
        for (const font of heldFonts(run, layer.node)) {
          requireFont(run, layer.label, font);
        }
      }
    }
  }
}

/** `prop=value, prop=value`, the variant's values in the set's axis order. */
function variantLabel(variant: VariantSpec): string {
  return Object.entries(variant.properties)
    .map(([axis, value]) => `${axis}=${value}`)
    .join(", ");
}

/**
 * Plan an instance layer the file holds, in stages that each read what the stage before left: the
 * main, the properties, then the overrides and the sizing (`planStages`). The stages compare with
 * the instance now only where nothing earlier in the run writes to what it shows. One that shows
 * another component swaps to the inner variant with `swapComponent`, which keeps its node and its
 * property values (N1), and keeps some overrides by the editor's heuristics. One whose inner set or
 * icons the run changes first, a fill, a default property or a redrawn or repainted icon among them, would compare
 * with what those operations replace. Either way one operation swaps where it must and plans the
 * other stages once it runs.
 *
 * @param run - The run.
 * @param instance - The instance.
 * @param label - The instance's label, for change lines.
 * @param spec - The instance layer.
 * @param inner - The inner set and variant.
 * @param links - The outer set's properties and the kit's icons.
 * @param held - `unknown` when the box that holds the instance turns in this run.
 */
export async function planInstance(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks,
  held: Held
): Promise<void> {
  planScalar(run, label, "name", instance.name, spec.name, () => {
    instance.name = spec.name;
  });
  const main = await instance.getMainComponentAsync();
  const shows = inner.node.existing !== undefined && main?.id === inner.node.existing.id;
  const now = shows && !changesFirst(spec, inner, links.icons);
  const differ = now ? differingProperties(instance, spec, inner, links.icons, label) : undefined;
  await requireHeldLabelFonts(run, instance, label, inner, spec, differ);
  if (now) {
    await planStages(run, instance, label, spec, inner, links, held);
    return;
  }
  const set = inner.set.spec.name;
  const description = shows
    ? `plan again once ${set}'s changes land`
    : `show ${set} ${variantLabel(inner.spec)}`;
  change(run.plan, label, description, async () => {
    if (!shows) {
      instance.swapComponent(inner.node.get());
    }
    await planWhenRun(run, (later) => planStages(later, instance, label, spec, inner, links, "read"));
  });
}

/**
 * Plan an instance layer an operation of this run created from the inner variant, once the inner
 * set's operations have run, so its layers exist, in the stages {@link planInstance} plans.
 *
 * @param run - The plan of the operation that created it.
 * @param instance - The new instance.
 * @param label - The instance's label, for change lines.
 * @param spec - The instance layer.
 * @param inner - The inner set and variant.
 * @param links - The outer set's properties and the kit's icons.
 */
export async function planNewInstance(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks
): Promise<void> {
  await planStages(run, instance, label, spec, inner, links, "read");
}
