/**
 * Instance layers: an instance of another kit set's variant inside a variant, such as an Alert's
 * action Button, so the composite stays linked to the set that draws the part. The plan points the
 * instance at the variant, sets the inner set's properties, overrides paints, corners and shadows on
 * it and on the layers below it, its own alignment along its auto layout's direction (LD1), and a
 * text's alignment across its lines, sizes it in its parent's
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

import { Effect } from "effect";

import { glyphRanges, layerAt, walkLayers } from "../../src/components/kit-spec.ts";
import type {
  ComponentRootSpec,
  InstanceLayerSpec,
  InstanceOverride,
  NestedPropertiesSpec,
  TextLayerSpec,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { findProperty, propertyName } from "./component-properties.ts";
import type { PlannedSet } from "./component-set.ts";
import type { PluginError } from "./errors.ts";
import { planLimit, planScalar, planVisibleLink } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { fontFor, fontsOf, heldFonts, requireFont, shownFace, shownLabel, shownLabels } from "./fonts.ts";
import type { InnerSpecs } from "./fonts.ts";
import { staleGlyphRanges } from "./glyph-font.ts";
import type { PlannedIcon } from "./icons.ts";
import { keyOf } from "./identity.ts";
import { pathKey, planOverrides } from "./instance-overrides.ts";
import type { HeldLayer } from "./instance-overrides.ts";
import { planInstanceSizing } from "./instance-sizing.ts";
import { planLeaving } from "./placing.ts";
import { changeLater, changeWith, planWhenRun } from "./plan.ts";
import type { Target } from "./plan.ts";
import { currentRun } from "./services.ts";
import type { PlanServices } from "./services.ts";
import { planGlyphFaces, weightUnbound } from "./text-layer.ts";

/** The inner set and variant an instance layer shows, as the plan leaves them. */
type InnerVariant = {
  readonly set: PlannedSet;
  readonly spec: VariantSpec;
  readonly node: Target<ComponentNode>;
};

/** What an instance layer links to: the outer set's properties and the kit's icons. */
type InstanceLinks = {
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
 * Find the inner variant of each instance layer among the sets the run planned before this one, as
 * `fontLayers` reads it.
 *
 * @param sets - The sets the run planned before this one, by key.
 * @returns The lookup, which throws as {@link innerVariant} does.
 */
export function innerSpecs(sets: ReadonlyMap<string, PlannedSet>): InnerSpecs {
  return (layer) => innerVariant(sets, layer, layer.name).spec;
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
      // An icon this run makes reads as itself once made: the stages that compare with it run after
      // its creation, as `changesFirst` defers them. Writing a swap the instance already shows
      // replaces the nested icon with a bare one, which drops the fill its main gives the glyph.
      holds: (held) => held === (icon.node.existing ?? icon.node.get()).id,
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
  return desiredProperties(spec, inner, icons, label).filter((desired) => {
    const found = findProperty(instance.componentProperties, desired.type, desired.name);
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

/** The main component an instance shows, or null where it has none. */
function mainOf(instance: InstanceNode): Effect.Effect<ComponentNode | null> {
  return Effect.promise(() => instance.getMainComponentAsync());
}

/**
 * The layer whose layers give an instance's sublayers their keys: its main component, or the instance
 * itself where a designer deleted the main, whose layers can no longer be read. Then each sublayer
 * gives its own key, as N3 read every sublayer but a swapped one.
 *
 * @param main - The instance's main component, as `mainOf` read it.
 */
function keySourceOf(instance: InstanceNode, main: ComponentNode | null): ChildrenMixin {
  return main === null || main.removed ? instance : main;
}

/** `keySourceOf` with the main component looked up. */
function keySource(instance: InstanceNode): Effect.Effect<ChildrenMixin> {
  return Effect.map(mainOf(instance), (main) => keySourceOf(instance, main));
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
 *
 * @param main - The instance's main component, read since the run last wrote to the instance: a
 *   property write can swap it.
 */
function heldLayers(
  instance: InstanceNode,
  label: string,
  main: ComponentNode | null
): ReadonlyMap<string, HeldLayer> {
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
  walk(instance, keySourceOf(instance, main), [], label);
  return found;
}

/**
 * The instance inside `instance` at a key path, found through frames and nested instances by the keys
 * of the main components' layers (`besideMain`), or undefined where the path leads nowhere.
 */
const nestedAt = Effect.fnUntraced(function* (
  instance: InstanceNode,
  path: readonly string[],
  label: string
) {
  let at: SceneNode = instance;
  let atLabel = label;
  let main: ChildrenMixin | undefined = yield* keySource(instance);
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
      main = yield* keySource(child);
    } else {
      main = source.type === "FRAME" ? source : undefined;
    }
  }
  return at.type === "INSTANCE" ? at : undefined;
});

/** The TEXT values a nested instance holds another way than the spec gives them, by property id. */
function differingNested(
  target: InstanceNode,
  nested: NestedPropertiesSpec,
  label: string
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(nested.text).flatMap(([name, value]) => {
      const found = findProperty(target.componentProperties, "TEXT", name);
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
const planNested = Effect.fnUntraced(function* (
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec
) {
  const run = yield* currentRun;
  for (const nested of spec.properties?.nested ?? []) {
    const at = `${label} / ${nested.path.join(" / ")}`;
    const target = yield* nestedAt(instance, nested.path, label);
    if (target === undefined) {
      throw new Error(`${at}: the instance holds no nested instance at that path.`);
    }
    const differ = differingNested(target, nested, at);
    if (Object.keys(differ).length === 0) {
      continue;
    }
    const described = Object.entries(nested.text)
      .filter(([name]) => Object.keys(differ).some((id) => propertyName(id) === name))
      .map(([name, value]) => `${name} ${JSON.stringify(value)}`)
      .join(", ");
    changeWith(
      run.plan,
      at,
      `properties → ${described}`,
      Effect.gen(function* () {
        const now = yield* nestedAt(instance, nested.path, label);
        if (now === undefined) {
          throw new Error(`${at}: the instance holds no nested instance at that path.`);
        }
        now.setProperties(differingNested(now, nested, at));
      })
    );
  }
});

/** The inner variant's text layer at a key path, or undefined where none is there. */
function textAt(root: ComponentRootSpec, path: readonly string[]): TextLayerSpec | undefined {
  const layer = layerAt(root, path);
  return layer !== undefined && "kind" in layer && layer.kind === "text" ? layer : undefined;
}

/**
 * Plan the glyph font on the glyph ranges of each label the instance holds, in the characters it
 * shows and the face the spec gives it, and the weight binding of a label that binds one, as a main's
 * label takes them. A TEXT write on the instance resets the label to one style, the default value
 * included (G5), and a range written after holds until the next (G6). A label at its default shows
 * the main's ranges (G4), which match, so it plans nothing. A label whose face the instance overrides
 * takes its glyph ranges in that face, static or not, and binds no weight, since the face is literal
 * (`shownLabel`). One whose override the spec drops goes back to the inner label's, by its weight
 * binding where the inner label binds one, whether or not the overrides stage wrote its whole font. A
 * label whose whole font that stage writes, `refaced`, takes its ranges again after that write,
 * whatever they read now.
 *
 * @param refaced - The key paths `planOverrides` writes the whole font of.
 */
function planLabelGlyphs(
  run: Run,
  layers: ReadonlyMap<string, HeldLayer>,
  root: ComponentRootSpec,
  spec: InstanceLayerSpec,
  refaced: ReadonlySet<string>
): void {
  for (const layer of layers.values()) {
    const label = textAt(root, layer.path);
    if (layer.node.type === "TEXT" && label !== undefined) {
      planGlyphFaces(
        run,
        layer.node,
        layer.label,
        shownLabel(spec, root, label),
        layer.node.characters,
        refaced.has(pathKey(layer.path))
      );
    }
  }
}

/** What the run can write on a label an instance holds, as the fonts preflight reads it. */
type LabelWrites = {
  /** A TEXT write, an alignment, a face, the glyph ranges or the weight binding. */
  readonly any: boolean;
  /** A write that gives the label a face of its own: a TEXT reset, a face, the glyph ranges or a binding. */
  readonly faces: boolean;
  /** A weight binding, which gives each character the weight's face in its own family (rule 10, PG13). */
  readonly binds: boolean;
};

/**
 * What the run can write on a label the instance holds, read with the predicates its writers use: a
 * TEXT write where the run writes the property, an alignment the spec gives or drops, a face the spec
 * gives or drops back to a static inner label's (`planOverrides`), and the glyph ranges and the
 * weight binding `planLabelGlyphs` writes. Where a TEXT write or a face write runs first, or the
 * stages wait for an earlier operation, the label changes before those, so they count as written.
 *
 * @param node - The label as the file holds it now.
 * @param shown - The inner label as the instance shows it (`shownLabel`).
 * @param marks - What the spec and the instance's overrides say of the label.
 */
function labelWrites(
  run: Run,
  node: TextNode,
  shown: TextLayerSpec,
  marks: {
    readonly text: boolean;
    readonly aligns: boolean;
    readonly face: boolean;
    readonly deferred: boolean;
  }
): LabelWrites {
  const changed = marks.text || marks.face || marks.deferred;
  const characters = marks.text ? shown.characters : node.characters;
  const stale = staleGlyphRanges(run, node, fontFor(run, node, shown).style);
  const glyphs =
    glyphRanges(characters, run.glyphFont).length > 0 &&
    (changed || stale.refonted.length > 0 || stale.unbound.length > 0);
  const binds = shown.weight !== undefined && (changed || glyphs || weightUnbound(run, node, shown));
  const faces = marks.text || marks.face || glyphs || binds;
  return { any: faces || marks.aligns, faces, binds };
}
/**
 * The last stage: the overrides, the linked labels' glyph ranges and the sizing against the sublayers
 * as they stand, the link to the outer set's BOOLEAN property and the exposure.
 *
 * @param held - `unknown` when the box that holds the instance turns in this run.
 * @param main - The instance's main component, read since the run last wrote to the instance.
 */
const planOverridesAndSizing = Effect.fnUntraced(function* (
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks,
  held: Held,
  main: ComponentNode | null
) {
  const run = yield* currentRun;
  const layers = heldLayers(instance, label, main);
  const refaced = planOverrides(run, instance, layers, label, spec, inner.spec.root);
  planLabelGlyphs(run, layers, inner.spec.root, spec, refaced);
  yield* planNested(instance, label, spec);
  // Figma refuses FILL on an absolute layer (P8), so an instance leaves the flow after its sizing
  // and comes back into it before.
  if (spec.placement === undefined) {
    planLeaving(run, instance, label, undefined);
  }
  planInstanceSizing(run, instance, label, spec.sizing, held);
  // Its parent places a placed instance once the parent's other layers are planned.
  if (spec.placement !== undefined) {
    planLeaving(run, instance, label, spec.placement);
  }
  // An instance with no minimum of its own shows the inner variant's (PH3).
  planLimit(run, instance, label, "minWidth", spec.minWidth ?? inner.spec.root.limits.minWidth);
  planVisibleLink(run, instance, label, spec.visibleProperty, links.properties);
  const exposed = spec.exposed === true;
  planScalar(run, label, "isExposedInstance", instance.isExposedInstance, exposed, () => {
    instance.isExposedInstance = exposed;
  });
});

/**
 * The stages after the main: the properties in one `setProperties`, then the last stage. A property
 * write can replace a sublayer, as a swap property replaces the icon and its glyph, so when the
 * instance's properties differ, the operation that writes them plans the last stage once it has run,
 * against the sublayers it leaves. Plan lists that operation alone.
 *
 * @param held - `unknown` when the box that holds the instance turns in this run.
 * @param main - The instance's main component, read since the run last wrote to the instance.
 */
const planStages = Effect.fnUntraced(function* (
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks,
  held: Held,
  main: ComponentNode | null
): Effect.fn.Return<void, PluginError, PlanServices> {
  const differ = differingProperties(instance, spec, inner, links.icons, label);
  if (differ.length === 0) {
    yield* planOverridesAndSizing(instance, label, spec, inner, links, held, main);
    return;
  }
  const described = differ.map((desired) => `${desired.name} ${desired.shown}`).join(", ");
  yield* changeLater(
    label,
    `properties → ${described}`,
    Effect.gen(function* () {
      writeProperties(instance, label, inner, differ);
      // A variant property write shows another variant, so the main is read again once it runs.
      yield* planWhenRun(
        Effect.flatMap(mainOf(instance), (shown) =>
          planOverridesAndSizing(instance, label, spec, inner, links, "read", shown)
        )
      );
    })
  );
});

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
 * Require, before the run's first write, every font the writes on the labels of an instance the file
 * holds need: for each label the run writes in any way (`labelWrites`), each font it holds now, a
 * font a designer gave it and each range of mixed ones included, which a TEXT, alignment or binding
 * write needs loaded, as Figma's text guide and the typings say. A label the run gives a face of its
 * own takes the fonts it then shows (`fontsOf`): the face in the inner label's family, resolved in
 * the instance's modes, which a face write lands in whatever the label holds (`shownFace`), and in
 * the glyph font's family where it shows glyphs. A weight binding keeps each character's family, so
 * a label it binds takes the weight's face in each family it holds now too. No face is required in a
 * family no write gives the label. Each label the spec's TEXT values and faces show (`shownLabels`)
 * takes the fonts it shows as well, which it may hold nowhere yet. A font this machine lacks then
 * stops the run with nothing written.
 *
 * A TEXT write resets a label to the style a sublayer takes from its main layer or a designer's
 * whole-text font write gave it (G5), which a range over every character hides and no probe has
 * read. The face write comes first among a label's overrides (`planOverrides`), so no later write
 * needs that style. A binding after such a reset with no face write lands in it, which this cannot
 * read.
 *
 * @param spec - The instance layer, whose overrides name the labels it aligns and gives a face.
 * @param differ - The properties the instance's values differ in now, or undefined where its stages
 *   wait for an earlier operation, after which the run may write any of its TEXT properties and any
 *   nested value.
 * @param main - The instance's main component, as it shows it now.
 */
const requireHeldLabelFonts = Effect.fnUntraced(function* (
  instance: InstanceNode,
  label: string,
  inner: InnerVariant,
  spec: InstanceLayerSpec,
  differ: readonly DesiredProperty[] | undefined,
  main: ComponentNode | null
) {
  const run = yield* currentRun;
  const { root } = inner.spec;
  const written = new Set(
    differ === undefined
      ? inner.set.spec.textProperties.map((property) => property.name)
      : differ.flatMap((desired) => (desired.type === "TEXT" ? [desired.name] : []))
  );
  const overridden = (field: InstanceOverride["field"]) =>
    new Set(
      (spec.overrides ?? []).flatMap((override) => (override.field === field ? [pathKey(override.path)] : []))
    );
  const faced = overridden("fontStyle");
  const aligned = overridden("textAlign");
  const holding = (field: NodeChangeProperty) =>
    new Set(
      instance.overrides.flatMap(({ id, overriddenFields }) => (overriddenFields.includes(field) ? [id] : []))
    );
  const heldFaces = holding("fontName");
  const heldAligned = holding("textAlignHorizontal");
  for (const text of shownLabels(spec, inner.spec)) {
    for (const font of fontsOf(run, text, shownFace(run, instance, text).family)) {
      requireFont(run, `${label} / ${text.name}`, font);
    }
  }
  // An instance whose labels the run can write nothing on leaves its sublayers unread.
  const glyphWork = walkLayers(root).some(
    (layer) =>
      layer.kind === "text" &&
      (layer.weight !== undefined ||
        glyphRanges(shownLabel(spec, root, layer).characters, run.glyphFont).length > 0)
  );
  const read =
    written.size > 0 ||
    faced.size > 0 ||
    aligned.size > 0 ||
    heldFaces.size > 0 ||
    heldAligned.size > 0 ||
    glyphWork;
  for (const layer of read ? heldLayers(instance, label, main).values() : []) {
    const { node } = layer;
    const text = textAt(root, layer.path);
    if (node.type !== "TEXT" || text === undefined) {
      continue;
    }
    const key = pathKey(layer.path);
    const shown = shownLabel(spec, root, text);
    const writes = labelWrites(run, node, shown, {
      text: text.textProperty !== undefined && written.has(text.textProperty),
      aligns: aligned.has(key) || heldAligned.has(node.id),
      face: faced.has(key) || (heldFaces.has(node.id) && text.weight === undefined),
      deferred: differ === undefined,
    });
    const held = writes.any ? heldFonts(run, node) : [];
    const face = shownFace(run, instance, shown);
    const bound = writes.binds ? held.map((font) => ({ family: font.family, style: face.style })) : [];
    for (const font of [...held, ...(writes.faces ? fontsOf(run, shown, face.family) : []), ...bound]) {
      requireFont(run, layer.label, font);
    }
  }
  // A nested value writes the labels of the instance it reaches, whatever fonts they hold now: those
  // whose values differ now, or every one where an earlier write, the main or the instance's own
  // properties, runs first and can replace the instances it reaches.
  const replaced = differ === undefined || differ.length > 0;
  for (const nested of spec.properties?.nested ?? []) {
    const target = yield* nestedAt(instance, nested.path, label);
    const at = `${label} / ${nested.path.join(" / ")}`;
    const writes =
      target !== undefined && (replaced || Object.keys(differingNested(target, nested, at)).length > 0);
    const writtenLayers = writes ? heldLayers(target, at, yield* mainOf(target)).values() : [];
    for (const layer of writtenLayers) {
      if (layer.node.type === "TEXT") {
        for (const font of heldFonts(run, layer.node)) {
          requireFont(run, layer.label, font);
        }
      }
    }
  }
});

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
 * @param instance - The instance.
 * @param label - The instance's label, for change lines.
 * @param spec - The instance layer.
 * @param inner - The inner set and variant.
 * @param links - The outer set's properties and the kit's icons.
 * @param held - `unknown` when the box that holds the instance turns in this run.
 * @returns The Effect that plans the instance.
 */
export const planInstance = Effect.fnUntraced(function* (
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks,
  held: Held
) {
  const run = yield* currentRun;
  planScalar(run, label, "name", instance.name, spec.name, () => {
    instance.name = spec.name;
  });
  const main = yield* mainOf(instance);
  const shows = inner.node.existing !== undefined && main?.id === inner.node.existing.id;
  const now = shows && !changesFirst(spec, inner, links.icons);
  const differ = now ? differingProperties(instance, spec, inner, links.icons, label) : undefined;
  yield* requireHeldLabelFonts(instance, label, inner, spec, differ, main);
  if (now) {
    // Nothing the run writes before these stages can swap the main, so they read it as looked up.
    yield* planStages(instance, label, spec, inner, links, held, main);
    return;
  }
  const set = inner.set.spec.name;
  const description = shows
    ? `plan again once ${set}'s changes land`
    : `show ${set} ${variantLabel(inner.spec)}`;
  yield* changeLater(
    label,
    description,
    Effect.gen(function* () {
      if (!shows) {
        instance.swapComponent(inner.node.get());
      }
      yield* planWhenRun(
        Effect.flatMap(mainOf(instance), (shown) =>
          planStages(instance, label, spec, inner, links, "read", shown)
        )
      );
    })
  );
});

/**
 * Plan an instance layer an operation of this run created from the inner variant, once the inner
 * set's operations have run, so its layers exist, in the stages {@link planInstance} plans.
 *
 * @param instance - The new instance.
 * @param label - The instance's label, for change lines.
 * @param spec - The instance layer.
 * @param inner - The inner set and variant.
 * @param links - The outer set's properties and the kit's icons.
 * @returns The Effect that plans the instance, into the recorder of the operation that created it.
 */
export function planNewInstance(
  instance: InstanceNode,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariant,
  links: InstanceLinks
): Effect.Effect<void, PluginError, PlanServices> {
  return Effect.flatMap(mainOf(instance), (main) =>
    planStages(instance, label, spec, inner, links, "read", main)
  );
}
