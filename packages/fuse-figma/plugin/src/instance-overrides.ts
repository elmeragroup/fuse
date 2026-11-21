/**
 * The overrides an instance layer plans in its last stage: the paints, stroke weights, font styles,
 * corners, shadows, paddings and alignments the spec gives the instance and the layers below it, and the inner
 * variant's own value for each one the instance holds and the spec dropped. `instance-layers.ts`
 * stages the instance and calls {@link planOverrides} once every operation that can replace a
 * sublayer has run.
 */

import type { CornerRadiusSpec, CornersSpec } from "../../src/components/corner-spec.ts";
import { layerAt, ringFill, rootOnlyOverride, shownLabel } from "../../src/components/kit-spec.ts";
import type {
  ComponentRootSpec,
  InnerVariantSpec,
  FillSpec,
  InstanceLayerSpec,
  InstanceOverride,
  InstanceOverrideValue,
  InstancePaintOverride,
  NumberSpec,
  PaddingField,
} from "../../src/components/kit-spec.ts";
import { paddingField, planStrokeSides, strokeWeightField } from "./box.ts";
import { planCorners, planEffects, planNumber, planPaints, planScalar } from "./fields.ts";
import type { Run } from "./fields.ts";
import { heldFonts, requireFont, shownFace } from "./fonts.ts";
import { baseCharacters } from "./glyph-font.ts";
import { glyphOf } from "./icons.ts";
import { change } from "./plan.ts";
import { textBinding } from "./text-layer.ts";

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

/** The side of a box each padding override names, as `paddingField` in `box.ts` takes it. */
const SIDE_OF = {
  paddingTop: "Top",
  paddingRight: "Right",
  paddingBottom: "Bottom",
  paddingLeft: "Left",
} as const satisfies Record<PaddingField, string>;

/** A box layer of an instance that takes a fill, stroke, corner, shadow or padding override. */
function boxOf(layer: HeldLayer, field: string): FrameNode | InstanceNode {
  const { node } = layer;
  if (node.type !== "FRAME" && node.type !== "INSTANCE") {
    throw new Error(`${layer.label} is a ${node.type}, which takes no ${field} override.`);
  }
  return node;
}

/**
 * Plan one override with the planner of its field, so an override the layer holds plans nothing. A
 * text whose whole font the plan writes lands in `refaced` by its key path. `faceAt` names the font
 * a face write at a key path gives the whole label.
 */
function planOverride(
  run: Run,
  layer: HeldLayer,
  write: OverrideWrite,
  refaced: Set<string>,
  faceAt: (path: readonly string[]) => FontName
): void {
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
    case "fontStyle": {
      if (node.type !== "TEXT") {
        throw new Error(`${label} is a ${node.type}, which takes no font style override.`);
      }
      if (planFace(run, node, label, faceAt(layer.path))) {
        refaced.add(pathKey(layer.path));
      }
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
    case "paddingTop":
    case "paddingRight":
    case "paddingBottom":
    case "paddingLeft": {
      const box = boxOf(layer, write.field);
      planNumber(run, box, label, paddingField(box, SIDE_OF[write.field]), write.value);
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
 * Plan a label's face as one font write over the whole text. The font is the face the instance
 * shows the label in (`shownFace`): the inner label's family, resolved in the instance's modes, in
 * the face the spec gives the label or the inner label's own, whatever the label holds when the write
 * runs: a family a designer gave it, a range of another over its characters, or the style a
 * TEXT write reset it to (G5), so the run writes only the fonts its planning pass required
 * (`requireHeldLabelFonts` in `instance-layers.ts`). A label every character of which outside its
 * glyph ranges shows the font, and that binds no weight, takes no write. A bound weight takes one
 * even where the face shows, since the face is literal and the write drops the binding (PG8). The
 * write keeps the family binding where the family stays and drops it where it changes (G8, rule
 * 50). The glyph ranges, which the write replaces, go on after in the same face (`planLabelGlyphs`
 * in `instance-layers.ts`).
 *
 * @returns Whether the plan writes the font.
 */
function planFace(run: Run, text: TextNode, label: string, font: FontName): boolean {
  const base =
    text.characters.length > 0
      ? baseCharacters(run, text, false).map((character) => character.font)
      : heldFonts(run, text);
  const shown = base.every((held) => held.family === font.family && held.style === font.style);
  if (shown && textBinding(run, text, "fontWeight") === null) {
    return false;
  }
  change(run.plan, label, `font → ${font.family} ${font.style}`, () => {
    text.fontName = font;
  });
  requireFont(run, label, font);
  return true;
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
        return { field, value: eachCorner(layer.cornerRadius) };
      case "effects":
        return { field, shadows: layer.shadows };
      case "primaryAlign":
        return { field, value: layer.primaryAlign };
      case "paddingTop":
      case "paddingRight":
      case "paddingBottom":
      case "paddingLeft":
        return { field, value: layer[field] };
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
  // A label whose weight binds a variable goes back to it by that binding, which `planLabelGlyphs`
  // in `instance-layers.ts` writes, and which gives each character the face the weight names.
  if (layer.kind === "text" && field === "fontStyle" && layer.weight === undefined) {
    return { field, style: layer.fontStyle };
  }
  if (layer.kind === "icon" && field === "glyph") {
    return { field, paint: layer.color };
  }
  return undefined;
}

/**
 * A corner radius as a length on each corner, so the plan compares and writes each corner on its
 * own. On 2026-11-21 a real file's instance kept following the main on each corner it had not
 * overridden (CR2), so a corner the plan leaves alone keeps following the main, where a write of all
 * four would make each the instance's own.
 */
function eachCorner(spec: CornerRadiusSpec): CornersSpec {
  return spec.kind === "corners"
    ? spec
    : { kind: "corners", topLeft: spec, topRight: spec, bottomRight: spec, bottomLeft: spec };
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
      } else if (name === "fontName") {
        fields.add("fontStyle");
      }
    } else if (node.type === "FRAME" || node.type === "INSTANCE") {
      for (const field of BOX_FIELDS.get(name) ?? []) {
        fields.add(field);
      }
    }
  }
  return [...fields];
}

/**
 * The box fields the kit overrides, by the Figma fields `overrides` lists for them (N3). A binding
 * lists `boundVariables` alone: on 2026-11-21 a real file's instance listed no corner after a corner
 * bound to another variable, and no padding after `paddingLeft` bound to one (CR1, CR6). So
 * `boundVariables` stands for the corners and the paddings, which the kit binds on an instance, and
 * the plan compares each with the inner variant's, which plans nothing where the two agree.
 */
const BOX_FIELDS: ReadonlyMap<NodeChangeProperty, readonly InstanceOverride["field"][]> = new Map<
  NodeChangeProperty,
  readonly InstanceOverride["field"][]
>([
  ["fills", ["fill"]],
  ["strokes", ["strokeColor"]],
  // Each side lists alone, the top one as `stokeTopWeight`, the typings' spelling (SW). A whole
  // `strokeWeight` write lists `strokeWeight` beside the four sides (FM3), though SW saw none listed,
  // so the plan reads the sides alone.
  ["stokeTopWeight", ["strokeSides"]],
  ["strokeRightWeight", ["strokeSides"]],
  ["strokeBottomWeight", ["strokeSides"]],
  ["strokeLeftWeight", ["strokeSides"]],
  ["effects", ["effects"]],
  ["cornerRadius", ["cornerRadius"]],
  ["topLeftRadius", ["cornerRadius"]],
  ["topRightRadius", ["cornerRadius"]],
  ["bottomLeftRadius", ["cornerRadius"]],
  ["bottomRightRadius", ["cornerRadius"]],
  ["primaryAxisAlignItems", ["primaryAlign"]],
  ["paddingTop", ["paddingTop"]],
  ["paddingRight", ["paddingRight"]],
  ["paddingBottom", ["paddingBottom"]],
  ["paddingLeft", ["paddingLeft"]],
  // SAFETY: CR1 and CR6 read `boundVariables` among an instance's overridden fields, which the
  // typings' NodeChangeProperty does not name.
  [
    "boundVariables" as NodeChangeProperty,
    ["cornerRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  ],
]);

/** An override write on a layer of the instance. */
type PlannedWrite = { readonly layer: HeldLayer; readonly write: OverrideWrite };

/**
 * The writes that take the overrides the instance holds and the spec dropped back to the inner
 * variant's own values.
 * `overrides` lists the instance's own fields and its sublayers', as a real file did (N1, N3), so the
 * plan reads which paints, corners and shadows a layer overrides. The value written is the inner
 * variant's, so a held one that matches plans nothing, and each later run compares the field with
 * the main's again. A fill written equal to the main's leaves no override, and the field follows
 * the main again (NS). A side's stroke weight written back stays listed (SW), as any number written
 * equal to the main's stays the layer's own (FM3), so the instance keeps that override, at the main's
 * value.
 */
function droppedWrites(
  instance: InstanceNode,
  layers: ReadonlyMap<string, HeldLayer>,
  spec: InstanceLayerSpec,
  root: ComponentRootSpec
): readonly PlannedWrite[] {
  const writes: PlannedWrite[] = [];
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
      // The kit overrides a padding on the root alone, so a padding a layer below holds is a
      // designer's, which no spec drops.
      if (rootOnlyOverride(field) && held.layer.path.length > 0) {
        continue;
      }
      const write = kept.has(`${pathKey(held.layer.path)}:${field}`)
        ? undefined
        : innerValue(root, held.layer.path, field);
      if (write !== undefined) {
        writes.push({ layer: held.layer, write });
      }
    }
  }
  return writes;
}

/**
 * Plan the spec's overrides and the ones the instance holds and the spec dropped, each label's face
 * first, against the sublayers as they stand. The staging in `instance-layers.ts` plans this only once every operation
 * that can replace or add a sublayer has run, so each layer the spec names is there.
 *
 * @param run - The run.
 * @param instance - The instance.
 * @param layers - The instance and its keyed sublayers by key path.
 * @param label - The instance's label, for errors.
 * @param spec - The instance layer, whose overrides the plan writes.
 * @param inner - The inner variant, whose values a dropped override goes back to, and the TEXT
 *   properties of its set.
 * @returns The key paths of the texts whose whole font the plan writes, by an override or by going
 *   back to the inner variant's face, whose glyph ranges that write replaces.
 * @throws When the instance holds no layer at a path the spec overrides, which the kit check and the
 *   staging rule out.
 */
export function planOverrides(
  run: Run,
  instance: InstanceNode,
  layers: ReadonlyMap<string, HeldLayer>,
  label: string,
  spec: InstanceLayerSpec,
  inner: InnerVariantSpec
): ReadonlySet<string> {
  const { root } = inner.variant;
  const refaced = new Set<string>();
  const writes = [
    ...(spec.overrides ?? []).map((override): PlannedWrite => {
      const layer = layers.get(pathKey(override.path));
      if (layer === undefined) {
        throw new Error(`${label} holds no layer ${override.path.join(" / ")} to override.`);
      }
      return { layer, write: writeOf(override) };
    }),
    ...droppedWrites(instance, layers, spec, root),
  ];
  const faceAt = (path: readonly string[]): FontName => {
    const text = layerAt(root, path);
    if (text === undefined || !("kind" in text) || text.kind !== "text") {
      throw new Error(`${label} shows no label at ${path.join(" / ")} to give a face.`);
    }
    return shownFace(run, instance, shownLabel(spec, inner, text));
  };
  // A face write goes first, so each later write on its label needs only the face it wrote, whatever
  // font a TEXT write reset the label to.
  const faces = writes.filter(({ write }) => write.field === "fontStyle");
  for (const { layer, write } of [...faces, ...writes.filter((each) => !faces.includes(each))]) {
    planOverride(run, layer, write, refaced, faceAt);
  }
  return refaced;
}
