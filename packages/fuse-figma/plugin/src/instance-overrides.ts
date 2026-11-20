/**
 * The overrides an instance layer plans in its last stage: the paints, stroke weights, corners,
 * shadows and alignments the spec gives the instance and the layers below it, and the inner variant's
 * own value for each one the instance holds and the spec dropped. `instance-layers.ts` stages the
 * instance and calls {@link planOverrides} once every operation that can replace a sublayer has run.
 */

import { layerAt, ringFill } from "../../src/components/kit-spec.ts";
import type {
  ComponentRootSpec,
  FillSpec,
  InstanceLayerSpec,
  InstanceOverride,
  InstanceOverrideValue,
  InstancePaintOverride,
  NumberSpec,
} from "../../src/components/kit-spec.ts";
import { planStrokeSides, strokeWeightField } from "./box.ts";
import { planCorners, planEffects, planNumber, planPaints, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { glyphOf } from "./icons.ts";

/** A layer of the instance the kit owns: the instance itself, or a sublayer found by its key path. */
export type HeldLayer = {
  readonly node: SceneNode;
  readonly label: string;
  readonly path: readonly string[];
};

/**
 * A path as a map key.
 *
 * @param path - The keys of the layers from the instance's root down.
 * @returns The key.
 */
export function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

/**
 * An override the plan writes: the spec's, or the inner variant's own value for one it dropped. A
 * paint takes the spec's color as a fill, and every other field the spec's value as it stands. A
 * stroke whose override the spec drops goes back to the inner variant's weights, which may be one
 * bound or literal weight on every side, as `strokeWeight`.
 */
type OverrideWrite =
  | { readonly field: InstancePaintOverride["field"]; readonly paint: FillSpec | undefined }
  | InstanceOverrideValue
  | { readonly field: "strokeWeight"; readonly weight: NumberSpec };

/** The write an override of the spec asks for. */
function writeOf(override: InstanceOverride): OverrideWrite {
  if ("color" in override) {
    return { field: override.field, paint: override.color };
  }
  const { path: _path, ...value } = override;
  return value;
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
    case "strokeSides":
      planStrokeSides(run, boxOf(layer, write.field), label, write.sides);
      return;
    case "strokeWeight": {
      const box = boxOf(layer, write.field);
      planNumber(run, box, label, strokeWeightField(box), write.weight);
      return;
    }
    case "cornerRadius": {
      const box = boxOf(layer, write.field);
      planCorners(run, box, label, write.value);
      return;
    }
    case "primaryAlign": {
      const box = boxOf(layer, write.field);
      planScalar(run, label, "primaryAxisAlignItems", box.primaryAxisAlignItems, write.value, () => {
        box.primaryAxisAlignItems = write.value;
      });
      return;
    }
    case "effects":
      // An instance's shadow override holds no background blur: no kit instance whose main blurs
      // what lies behind it overrides its shadows.
      planEffects(run, boxOf(layer, write.field), label, write.shadows, undefined);
  }
}

/**
 * What the inner variant itself shows for a field at a key path: the value an instance goes back to
 * when the spec drops its override. A root takes the fill its ring needs, as the plugin writes it.
 */
function innerValue(
  root: ComponentRootSpec,
  path: readonly string[],
  field: InstanceOverride["field"]
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
      case "strokeSides": {
        // A stroke of one weight goes back to it whatever its dashes or binding, as the main's own
        // stroke changes in the same run. A layer with no stroke draws none, whatever its weights.
        const { stroke } = layer;
        if (stroke === undefined) {
          return undefined;
        }
        return "sides" in stroke
          ? { field, sides: stroke.sides }
          : { field: "strokeWeight", weight: stroke.weight };
      }
      case "cornerRadius":
        return { field, value: layer.cornerRadius };
      case "effects":
        return { field, shadows: layer.shadows };
      case "primaryAlign":
        return { field, value: layer.primaryAlign };
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
): readonly InstanceOverride["field"][] {
  const fields = new Set<InstanceOverride["field"]>();
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
const BOX_FIELDS: ReadonlyMap<NodeChangeProperty, InstanceOverride["field"]> = new Map<
  NodeChangeProperty,
  InstanceOverride["field"]
>([
  ["fills", "fill"],
  ["strokes", "strokeColor"],
  // Each side lists alone, the top one as `stokeTopWeight`, the typings' spelling, and a real file
  // listed no `strokeWeight` after a write of it or of a side on 2026-11-20 (SW).
  ["stokeTopWeight", "strokeSides"],
  ["strokeRightWeight", "strokeSides"],
  ["strokeBottomWeight", "strokeSides"],
  ["strokeLeftWeight", "strokeSides"],
  ["effects", "effects"],
  ["cornerRadius", "cornerRadius"],
  ["topLeftRadius", "cornerRadius"],
  ["topRightRadius", "cornerRadius"],
  ["bottomLeftRadius", "cornerRadius"],
  ["bottomRightRadius", "cornerRadius"],
  ["primaryAxisAlignItems", "primaryAlign"],
]);

/**
 * Plan the overrides the instance holds and the spec dropped back to the inner variant's own values.
 * `overrides` lists the instance's own fields and its sublayers', as a real file did (N1, N3), so the
 * plan reads which paints, corners and shadows a layer overrides. The value written is the inner
 * variant's, so a held one that matches plans nothing, and each later run compares the field with
 * the main's again. A fill written equal to the main's leaves no override, and the field follows
 * the main again (NS). A side's stroke weight written back stays listed (SW), so the instance keeps
 * that override, at the main's value.
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
 * sublayers as they stand. The staging in `instance-layers.ts` plans this only once every operation
 * that can replace or add a sublayer has run, so each layer the spec names is there.
 *
 * @param run - The run.
 * @param instance - The instance.
 * @param layers - The instance and its keyed sublayers by key path.
 * @param label - The instance's label, for errors.
 * @param spec - The instance layer, whose overrides the plan writes.
 * @param root - The inner variant's root, whose values a dropped override goes back to.
 * @throws When the instance holds no layer at a path the spec overrides, which the kit check and the
 *   staging rule out.
 */
export function planOverrides(
  run: Run,
  instance: InstanceNode,
  layers: ReadonlyMap<string, HeldLayer>,
  label: string,
  spec: InstanceLayerSpec,
  root: ComponentRootSpec
): void {
  for (const override of spec.overrides ?? []) {
    const layer = layers.get(pathKey(override.path));
    if (layer === undefined) {
      throw new Error(`${label} holds no layer ${override.path.join(" / ")} to override.`);
    }
    planOverride(run, layer, writeOf(override));
  }
  planDroppedOverrides(run, instance, layers, spec, root);
}
