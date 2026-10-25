/**
 * The in-place diff of an instance part: what the inner component's root, built where the composite
 * renders it, draws differently from the inner set's variant, and what the instance layer carries for
 * each difference. A Figma instance takes everything from its main component but its property values,
 * the paints, corners, shadows and text alignments it overrides, and its own sizing in its parent's
 * auto layout, so a difference the instance cannot carry stays unmapped, and the composite cannot
 * drift from its parts.
 */
import { isDeepStrictEqual } from "node:util";

import { drawsAtOwnWidth } from "./hugging-rows";
import { ringFill } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceOverride,
  SizingSpec,
  TextLayerSpec,
} from "./kit-spec";

/**
 * A field of a layer the inner root holds that the built root draws one way and the inner variant
 * another, which no instance field carries.
 */
export type InstanceDifference = {
  /** The keys of the layers from the inner root down to the layer, empty for the root. */
  readonly path: readonly string[];
  /**
   * The spec field, such as `paddingLeft`, or `layers` for the kinds and keys of a box's layers.
   */
  readonly field: string;
  /** The field's value in the root built in place, as JSON, or `none` for no value. */
  readonly inPlace: string;
  /** The field's value in the inner variant, as JSON, or `none` for no value. */
  readonly variant: string;
};

/** What an instance layer carries for the inner root built in place, and what it cannot carry. */
export type InstanceDiff = {
  /** The characters of each label a TEXT property sets, by the property's name, where they differ. */
  readonly text: Readonly<Record<string, string>>;
  /** The key of the icon each INSTANCE_SWAP property picks, by the property's name, where it differs. */
  readonly swap: Readonly<Record<string, string>>;
  /** The paints, corners and shadows that differ, in layer order, the root first. */
  readonly overrides: readonly InstanceOverride[];
  /** The sizing of the root built in place, which the instance takes in its parent's auto layout. */
  readonly sizing: SizingSpec;
  /** The differences no instance field carries. */
  readonly unmapped: readonly InstanceDifference[];
};

/** A layer the diff compares field by field: the root or a frame, a text or an icon. */
type ComparedLayer = BoxSpec | TextLayerSpec | IconLayerSpec;

/** The value of one field of a layer. */
type ValueOf<Layer> = Layer[keyof Layer];

/**
 * A value the diff compares: a field of a compared layer, a nested instance layer, which it compares
 * whole, or the kinds and keys of a box's layers.
 */
type FieldValue =
  | ValueOf<ComponentRootSpec>
  | ValueOf<FrameLayerSpec>
  | ValueOf<TextLayerSpec>
  | ValueOf<IconLayerSpec>
  | ChildLayerSpec
  | readonly string[];

/** What the diff gathers as it walks the two roots. */
type Found = {
  /** The sizing of the inner root built in place, which the instance takes. */
  readonly root: SizingSpec;
  readonly text: Map<string, string>;
  readonly swap: Map<string, string>;
  readonly overrides: InstanceOverride[];
  readonly unmapped: InstanceDifference[];
};

/**
 * Diff the inner root built in place against the inner variant's root, layer by layer.
 *
 * - The characters of a label a TEXT property sets, and the icon an INSTANCE_SWAP property picks,
 *   become property values.
 * - A fill, a stroke's color, a text's color, an icon's glyph color, a corner and shadows become
 *   overrides at the layer's key path. The root's fill is the one its ring needs, as the plugin
 *   writes it.
 * - The root's sizing is the instance's, whatever the outer layout makes of each axis: a fill, a
 *   length or a hug (N4). The layers inside guard it, since a layer that sizes against the root's
 *   length draws another way where that length changes.
 * - A text the variant fills across, a direct child of a root the instance hugs, draws at its own
 *   width, as the text built in place hugs (PH2).
 * - The spacing of a box with fewer than two layers in its auto layout in both trees draws nothing,
 *   since a gap sits only between adjacent items (CSS Box Alignment 3 §8). A layer a BOOLEAN hides
 *   counts, since a designer can show it.
 * - Every other field, the kinds and keys of a box's layers among them, stays unmapped where it
 *   differs, and the diff compares no layer of a box whose layers differ.
 *
 * @param inPlace - The inner root, built below the outer parts with the outer `className` merged in.
 * @param variant - The inner variant's root, as the inner set holds it.
 * @returns The property values, overrides and sizing the instance carries, and what it cannot.
 */
export function diffInstance(inPlace: ComponentRootSpec, variant: ComponentRootSpec): InstanceDiff {
  const found: Found = {
    root: inPlace.sizing,
    text: new Map(),
    swap: new Map(),
    overrides: [],
    unmapped: [],
  };
  diffBox(found, [], inPlace, variant, "root");
  return {
    text: Object.fromEntries(found.text),
    swap: Object.fromEntries(found.swap),
    overrides: found.overrides,
    sizing: inPlace.sizing,
    unmapped: found.unmapped,
  };
}

/** The fields of a layer, by name. */
function fieldsOf(layer: ComparedLayer): ReadonlyMap<string, FieldValue> {
  return new Map<string, FieldValue>(Object.entries(layer));
}

/** Each field either layer holds, in the order the built layer holds them, then the variant's others. */
function fieldNames(inPlace: ComparedLayer, variant: ComparedLayer): readonly string[] {
  return [...new Set([...Object.keys(inPlace), ...Object.keys(variant)])];
}

/** A value as a difference names it: its JSON, or `none` for no value. */
function described(value: FieldValue): string {
  return value === undefined ? "none" : JSON.stringify(value);
}

/** Note a difference no instance field carries. */
function noteUnmapped(
  found: Found,
  path: readonly string[],
  field: string,
  inPlace: FieldValue,
  variant: FieldValue
): void {
  found.unmapped.push({ path, field, inPlace: described(inPlace), variant: described(variant) });
}

/**
 * Diff a box, the root or a frame. Its fill, stroke color, corner and shadows become overrides, the
 * root's sizing the instance's, and the diff compares its layers in turn where their kinds and keys
 * agree.
 */
function diffBox(
  found: Found,
  path: readonly string[],
  inPlace: BoxSpec,
  variant: BoxSpec,
  kind: "root" | "frame"
): void {
  const built = fieldsOf(inPlace);
  const held = fieldsOf(variant);
  for (const field of fieldNames(inPlace, variant)) {
    switch (field) {
      case "sizing":
        // The instance takes the root's sizing as its own.
        if (kind === "frame") {
          diffField(found, path, field, built.get(field), held.get(field));
        }
        break;
      case "fill":
        diffFill(
          found,
          path,
          kind === "root" ? ringFill(inPlace) : inPlace.fill,
          kind === "root" ? ringFill(variant) : variant.fill
        );
        break;
      case "stroke":
        diffStroke(found, path, inPlace.stroke, variant.stroke);
        break;
      case "cornerRadius":
        if (!isDeepStrictEqual(inPlace.cornerRadius, variant.cornerRadius)) {
          found.overrides.push({ path, field: "cornerRadius", value: inPlace.cornerRadius });
        }
        break;
      case "shadows":
        if (!isDeepStrictEqual(inPlace.shadows, variant.shadows)) {
          found.overrides.push({ path, field: "effects", shadows: inPlace.shadows });
        }
        break;
      case "children":
        diffLayers(found, path, inPlace.children, variant.children);
        break;
      case "itemSpacing":
        if (flowCount(inPlace) > 1 || flowCount(variant) > 1) {
          diffField(found, path, field, built.get(field), held.get(field));
        }
        break;
      default:
        diffField(found, path, field, built.get(field), held.get(field));
    }
  }
}

/** How many of a box's layers its auto layout places, hidden ones included. */
function flowCount(box: BoxSpec): number {
  return box.children.filter((layer) => layer.kind !== "frame" || layer.absolute === undefined).length;
}

/** Note a field no instance field carries where its two values differ. */
function diffField(
  found: Found,
  path: readonly string[],
  field: string,
  inPlace: FieldValue,
  variant: FieldValue
): void {
  if (!isDeepStrictEqual(inPlace, variant)) {
    noteUnmapped(found, path, field, inPlace, variant);
  }
}

/** Diff a fill: a color or none becomes an override, and an image fill that differs stays unmapped. */
function diffFill(
  found: Found,
  path: readonly string[],
  inPlace: BoxSpec["fill"],
  variant: BoxSpec["fill"]
): void {
  if (isDeepStrictEqual(inPlace, variant)) {
    return;
  }
  if (inPlace?.kind === "image" || variant?.kind === "image") {
    noteUnmapped(found, path, "fill", inPlace, variant);
    return;
  }
  found.overrides.push({ path, field: "fill", color: inPlace });
}

/**
 * Diff a stroke. Only its color can differ, which becomes an override, since its weight, dashes and
 * room in the layout shape the box, and a stroke only one of the two draws stays unmapped.
 */
function diffStroke(
  found: Found,
  path: readonly string[],
  inPlace: BoxSpec["stroke"],
  variant: BoxSpec["stroke"]
): void {
  if (isDeepStrictEqual(inPlace, variant)) {
    return;
  }
  if (
    inPlace !== undefined &&
    variant !== undefined &&
    isDeepStrictEqual({ ...inPlace, color: variant.color }, variant)
  ) {
    found.overrides.push({ path, field: "strokeColor", color: inPlace.color });
    return;
  }
  noteUnmapped(found, path, "stroke", inPlace, variant);
}

/** The kind and key of each layer, which the two boxes must share for the diff to compare their layers. */
function kindsAndKeys(layers: readonly ChildLayerSpec[]): readonly string[] {
  return layers.map((layer) => `${layer.kind} ${layer.key}`);
}

/** Diff a box's layers pairwise where their kinds and keys agree, and note the layer tree otherwise. */
function diffLayers(
  found: Found,
  path: readonly string[],
  inPlace: readonly ChildLayerSpec[],
  variant: readonly ChildLayerSpec[]
): void {
  if (!isDeepStrictEqual(kindsAndKeys(inPlace), kindsAndKeys(variant))) {
    noteUnmapped(found, path, "layers", kindsAndKeys(inPlace), kindsAndKeys(variant));
    return;
  }
  inPlace.forEach((layer, index) => {
    const held = variant[index];
    const at = [...path, layer.key];
    if (layer.kind === "frame" && held?.kind === "frame") {
      diffBox(found, at, layer, held, "frame");
    } else if (layer.kind === "text" && held?.kind === "text") {
      diffText(found, at, layer, held);
    } else if (layer.kind === "icon" && held?.kind === "icon") {
      diffIcon(found, at, layer, held);
    } else {
      diffField(found, at, "instance", layer, held);
    }
  });
}

/**
 * Diff a text: its characters become the value of the TEXT property that sets them, its color and its
 * alignment across its lines overrides, and every other field stays unmapped where it differs.
 * Characters on a label no property sets, or two labels that give one property two texts, stay
 * unmapped, and so does an alignment that differs down the text, which no override carries.
 */
function diffText(
  found: Found,
  path: readonly string[],
  inPlace: TextLayerSpec,
  variant: TextLayerSpec
): void {
  const built = fieldsOf(inPlace);
  const held = fieldsOf(variant);
  for (const field of fieldNames(inPlace, variant)) {
    if (field === "characters") {
      diffCharacters(found, path, inPlace.characters, variant);
    } else if (field === "color") {
      if (!isDeepStrictEqual(inPlace.color, variant.color)) {
        found.overrides.push({ path, field: "textColor", color: inPlace.color });
      }
    } else if (field === "sizing" && drawsAtOwnWidth(found.root, path, inPlace.sizing, variant.sizing)) {
      // The variant's filling text draws at its own width once the instance hugs (PH2).
      continue;
    } else if (field === "align" && inPlace.align.vertical === variant.align.vertical) {
      // A label's TEXT property can give it more lines, which the alignment across places, so the
      // instance carries a different one as an override (NA), as Empty's `text-center` reaches its
      // Button labels.
      if (inPlace.align.horizontal !== variant.align.horizontal) {
        found.overrides.push({ path, field: "textAlign", horizontal: inPlace.align.horizontal });
      }
    } else {
      diffField(found, path, field, built.get(field), held.get(field));
    }
  }
}

/** Diff a text's characters, which only the TEXT property that sets them can carry. */
function diffCharacters(
  found: Found,
  path: readonly string[],
  characters: string,
  variant: TextLayerSpec
): void {
  const property = variant.textProperty;
  if (characters === variant.characters) {
    return;
  }
  const given = property === undefined ? undefined : found.text.get(property);
  if (property === undefined || (given !== undefined && given !== characters)) {
    noteUnmapped(found, path, "characters", characters, variant.characters);
    return;
  }
  found.text.set(property, characters);
}

/**
 * Diff an icon: the icon it shows becomes the value of the INSTANCE_SWAP property that picks it, its
 * color a glyph override, and every other field stays unmapped where it differs. Another icon in a
 * layer no property swaps stays unmapped.
 */
function diffIcon(
  found: Found,
  path: readonly string[],
  inPlace: IconLayerSpec,
  variant: IconLayerSpec
): void {
  const built = fieldsOf(inPlace);
  const held = fieldsOf(variant);
  for (const field of fieldNames(inPlace, variant)) {
    if (field === "icon") {
      if (inPlace.icon === variant.icon) {
        continue;
      }
      if (variant.swapProperty === undefined) {
        noteUnmapped(found, path, field, inPlace.icon, variant.icon);
      } else {
        found.swap.set(variant.swapProperty, inPlace.icon);
      }
    } else if (field === "color") {
      if (!isDeepStrictEqual(inPlace.color, variant.color)) {
        found.overrides.push({ path, field: "glyph", color: inPlace.color });
      }
    } else {
      diffField(found, path, field, built.get(field), held.get(field));
    }
  }
}
