/**
 * The in-place diff of an instance part: what the inner component's root, built where the composite
 * renders it, draws differently from the inner set's variant, and what the instance layer carries for
 * each difference. A Figma instance takes everything from its main component but its property values,
 * the paints, stroke weights, font styles, corners, shadows and alignments it overrides, and its own sizing in its parent's auto
 * layout, so a difference the instance cannot carry stays unmapped, and the composite cannot drift
 * from its parts.
 */
import { isDeepStrictEqual } from "node:util";

import { HALF_TURN_MIRRORS } from "./glyph-mirrors";
import type { SettledRoot } from "./hugging-rows";
import { outOfLayout, ringFill, solidSides } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  IconLayerSpec,
  InstanceLayerSpec,
  InstanceOverride,
  InstancePropertiesSpec,
  LimitsSpec,
  NestedPropertiesSpec,
  NumberSpec,
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
  /** The TEXT values of exposed instances inside the root that differ, at their key paths. */
  readonly nested: readonly NestedPropertiesSpec[];
  /** The paints, corners, shadows and alignments that differ, in layer order, the root first. */
  readonly overrides: readonly InstanceOverride[];
  /** The sizing of the root built in place, which the instance takes in its parent's auto layout. */
  readonly sizing: SizingSpec;
  /** The root's widest width built in place, which the instance takes, absent for the variant's own. */
  readonly maxWidth?: NumberSpec;
  /** Each glyph turned half a turn in place that the instance swaps to its mirror, at its key path. */
  readonly mirrored: readonly Mirrored[];
  /** The differences no instance field carries. */
  readonly unmapped: readonly InstanceDifference[];
};

/** A glyph turned half a turn in place, which the instance draws as its half-turn mirror. */
export type Mirrored = {
  /** The keys of the layers from the inner root down to the glyph. */
  readonly path: readonly string[];
  /** The key of the mirror the instance swaps to. */
  readonly icon: string;
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
  /**
   * The root's alignment along its direction where it differs, noted unmapped at `unmapped`'s index
   * until the walk ends, and the place among the overrides it takes if nothing else stays unmapped.
   */
  aligned: { readonly override: InstanceOverride; readonly at: number } | undefined;
  /** The root's widest width built in place, where only it among the root's limits differs. */
  maxWidth: NumberSpec | undefined;
  /** The sizing the instance takes and the text sizings that draw alike in it, settled before the walk. */
  readonly root: SettledRoot;
  readonly text: Map<string, string>;
  readonly swap: Map<string, string>;
  readonly nested: NestedPropertiesSpec[];
  readonly overrides: InstanceOverride[];
  readonly mirrored: Mirrored[];
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
 * - A solid stroke on some sides becomes an override of the four weights where the variant's stroke
 *   is solid with literal weights and both take their room in the layout alike, as a chip segment's
 *   `border-0 border-s` keeps the start edge of Button's 1px border.
 * - A text's face becomes an override where both texts take a literal weight in the same family, as
 *   a chip operator's `font-normal` shows Regular inside a Button whose label is Medium. A face a
 *   bound weight picks stays unmapped.
 * - The root's `primaryAlign` becomes an override where the instance fills its parent along the
 *   root's direction and the alignment is its one difference no other field carries, as a
 *   `justify-start` on a Button that fills its row draws. On 2026-11-19 a real file kept such a
 *   Button instance's `primaryAxisAlignItems` override, which its `overrides` listed, through a variant
 *   switch, a TEXT property change, a density switch and nesting in another component's instance
 *   (LD1). The alignment places the root's layers, so beside a layer the diff leaves unmapped it would
 *   not place them where CSS does, and it stays unmapped with that layer, as in a Dropdown menu row
 *   whose shortcut margin stays unmapped (#773). An instance that hugs or takes a fixed length along
 *   its direction, and a frame below the root, keep the alignment unmapped, since the probe covered
 *   neither.
 * - The root's widest width becomes the instance's own `maxWidth` where only it among the root's
 *   limits differs, as a chip value's `max-w-56` caps its Button, as the instance carries a popup
 *   row's `minWidth` (PH3).
 * - The instance takes the sizing `settleInstanceRoot` in `hugging-rows.ts` settles before the walk:
 *   the root's built in place, whatever the outer layout makes of each axis, a fill, a length or a
 *   hug (N4), or across the variant's where a column stretches a root around one word. The layers
 *   inside guard it, since a layer that sizes against the root's length draws another way where that
 *   length changes.
 * - A text's sizing draws as the variant's where the settled root says so: a text the variant fills
 *   across, a direct child of a root the instance hugs, draws at its own width, as the text built in
 *   place hugs (PH2), and the one word of a root the instance hugs as the variant's does draws as
 *   the variant's hugging text.
 * - An exposed instance inside the root that differs only in TEXT values, its own or those of exposed
 *   instances inside it, carries them as nested values at its key path, since Figma sets an exposed
 *   instance's TEXT property through exposure at any depth (PN).
 * - A glyph turned half a turn in place, where the variant's is unturned and a property swaps it,
 *   becomes a swap to its proven half-turn mirror (`glyph-mirrors.ts`), since Figma turns no layer
 *   inside an instance (PT).
 * - The spacing of a box with fewer than two layers in its auto layout in both trees draws nothing,
 *   since a gap sits only between adjacent items (CSS Box Alignment 3 §8). A layer a BOOLEAN hides
 *   counts, since a designer can show it.
 * - Every other field, the kinds and keys of a box's layers among them, stays unmapped where it
 *   differs, and the diff compares no layer of a box whose layers differ.
 *
 * @param inPlace - The inner root, built below the outer parts with the outer `className` merged in.
 * @param variant - The inner variant's root, as the inner set holds it.
 * @param root - The sizing the instance takes and the texts that draw alike, as
 *   `settleInstanceRoot` settles them.
 * @returns The property values, overrides and sizing the instance carries, and what it cannot.
 */
export function diffInstance(
  inPlace: ComponentRootSpec,
  variant: ComponentRootSpec,
  root: SettledRoot
): InstanceDiff {
  const found: Found = {
    aligned: undefined,
    maxWidth: undefined,
    root,
    text: new Map(),
    swap: new Map(),
    nested: [],
    overrides: [],
    mirrored: [],
    unmapped: [],
  };
  diffBox(found, [], inPlace, variant, "root");
  // The alignment the walk noted unmapped becomes an override where it is the one difference left.
  const { aligned } = found;
  const carried = aligned !== undefined && found.unmapped.length === 1 ? aligned : undefined;
  const capped = found.maxWidth === undefined ? {} : { maxWidth: found.maxWidth };
  return {
    ...capped,
    text: Object.fromEntries(found.text),
    swap: Object.fromEntries(found.swap),
    nested: found.nested,
    overrides:
      carried === undefined
        ? found.overrides
        : [...found.overrides.slice(0, carried.at), carried.override, ...found.overrides.slice(carried.at)],
    sizing: root.sizing,
    mirrored: found.mirrored,
    unmapped: carried === undefined ? found.unmapped : [],
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
      case "primaryAlign":
        if (kind === "root" && fillsAlong(inPlace) && inPlace.primaryAlign !== variant.primaryAlign) {
          found.aligned = {
            override: { path, field: "primaryAlign", value: inPlace.primaryAlign },
            at: found.overrides.length,
          };
        }
        diffField(found, path, field, built.get(field), held.get(field));
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
      case "limits":
        if (kind === "root" && widestOnly(inPlace.limits, variant.limits)) {
          found.maxWidth = inPlace.limits.maxWidth;
        } else {
          diffField(found, path, field, built.get(field), held.get(field));
        }
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

/**
 * Whether two roots' limits differ in the widest width alone, which the root built in place sets, as
 * a chip value's `max-w-56` caps the Button it renders.
 */
function widestOnly(inPlace: LimitsSpec, variant: LimitsSpec): boolean {
  return (
    inPlace.maxWidth !== undefined &&
    !isDeepStrictEqual(inPlace.maxWidth, variant.maxWidth) &&
    isDeepStrictEqual({ ...inPlace, maxWidth: undefined }, { ...variant, maxWidth: undefined })
  );
}

/** Whether a root fills its parent along its own direction, as the instance LD1 probed did. */
function fillsAlong(root: BoxSpec): boolean {
  return (root.direction === "VERTICAL" ? root.sizing.vertical : root.sizing.horizontal).kind === "fill";
}

/** How many of a box's layers its auto layout places, hidden ones included. */
function flowCount(box: BoxSpec): number {
  return box.children.filter((layer) => !outOfLayout(layer)).length;
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
 * Diff a stroke. Its color becomes an override. A solid stroke on some sides in place, over a solid
 * stroke of the variant on its sides or of one literal weight on every side, becomes an override of
 * the four weights, as a chip segment's `border-0 border-s` keeps only its start edge of Button's
 * 1px border. Both strokes must take their room in the layout alike. Any other difference, a dash, a
 * bound weight or a stroke only one of the two draws, stays unmapped.
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
  const sides = inPlace !== undefined && "sides" in inPlace ? inPlace.sides : undefined;
  const held = variant === undefined ? undefined : solidSides(variant);
  if (sides !== undefined && held !== undefined && inPlace?.inLayout === variant?.inLayout) {
    found.overrides.push({ path, field: "strokeSides", sides });
    if (!isDeepStrictEqual(inPlace?.color, variant?.color) && inPlace !== undefined) {
      found.overrides.push({ path, field: "strokeColor", color: inPlace.color });
    }
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
    } else if (layer.kind === "instance" && held?.kind === "instance") {
      diffNested(found, at, layer, held);
    } else {
      diffField(found, at, "instance", layer, held);
    }
  });
}

/** An instance layer's BOOLEAN and INSTANCE_SWAP values, its property values beside its TEXT values. */
function untexted(layer: InstanceLayerSpec): Pick<InstancePropertiesSpec, "boolean" | "swap"> {
  const { boolean, swap } = layer.properties ?? {};
  const booleans = boolean === undefined ? {} : { boolean };
  return swap === undefined ? booleans : { ...booleans, swap };
}

/** An instance layer's TEXT values, its own at the empty path and those it gives instances inside it. */
function textsOf(layer: InstanceLayerSpec): ReadonlyMap<string, NestedPropertiesSpec> {
  const { text, nested = [] } = layer.properties ?? {};
  return new Map(
    [{ path: [], text: text ?? {} }, ...nested].map((values) => [JSON.stringify(values.path), values])
  );
}

/**
 * Diff an instance layer inside the root. Where the two differ only in TEXT values and the instance
 * in place is exposed, each value that differs becomes a nested value at the instance's key path
 * (PN). A value the variant gives and the instance in place leaves at its default, and every other
 * difference, leaves the whole layer unmapped.
 */
function diffNested(
  found: Found,
  path: readonly string[],
  inPlace: InstanceLayerSpec,
  variant: InstanceLayerSpec
): void {
  const built = textsOf(inPlace);
  const held = textsOf(variant);
  const changed: NestedPropertiesSpec[] = [];
  let carried =
    inPlace.exposed === true &&
    isDeepStrictEqual(
      { ...inPlace, properties: untexted(inPlace) },
      { ...variant, properties: untexted(variant) }
    );
  for (const at of new Set([...built.keys(), ...held.keys()])) {
    const values = built.get(at);
    const heldText = held.get(at)?.text ?? {};
    if (Object.keys(heldText).some((name) => values?.text[name] === undefined)) {
      carried = false;
    }
    const text = Object.fromEntries(
      Object.entries(values?.text ?? {}).filter(([name, value]) => heldText[name] !== value)
    );
    if (values !== undefined && Object.keys(text).length > 0) {
      changed.push({ path: [...path, ...values.path], text });
    }
  }
  if (!carried) {
    diffField(found, path, "instance", inPlace, variant);
    return;
  }
  found.nested.push(...changed);
}

/**
 * Diff a text: its characters become the value of the TEXT property that sets them, its color, its
 * alignment across its lines and the face of a literal weight in its family overrides, and every
 * other field stays unmapped where it differs.
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
    } else if (field === "sizing" && found.root.textsAlike(path, inPlace.sizing, variant.sizing)) {
      // The two sizings draw alike inside the instance's settled sizing (PH2).
      continue;
    } else if (field === "fontStyle" && literalFace(inPlace, variant)) {
      // An operator segment's `font-normal` shows Regular where Button's label is Medium.
      if (inPlace.fontStyle !== variant.fontStyle) {
        found.overrides.push({ path, field: "fontStyle", style: inPlace.fontStyle });
      }
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

/**
 * Whether two texts show a face of one family by a literal weight, so the face alone tells them apart.
 * A bound weight picks its face in each mode, which a font written on the instance would replace.
 */
function literalFace(inPlace: TextLayerSpec, variant: TextLayerSpec): boolean {
  return (
    inPlace.weight === undefined &&
    variant.weight === undefined &&
    isDeepStrictEqual(inPlace.fontFamily, variant.fontFamily)
  );
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
 * The icon an instance swaps to for an in-place glyph turned half a turn where the variant's is
 * unturned: the glyph's proven half-turn mirror, behind a swap property. Undefined for any other turn.
 */
function halfTurnMirror(inPlace: IconLayerSpec, variant: IconLayerSpec): string | undefined {
  return inPlace.rotation === 180 && variant.rotation === undefined && variant.swapProperty !== undefined
    ? HALF_TURN_MIRRORS.get(inPlace.icon)
    : undefined;
}

/**
 * Diff an icon: the icon it shows becomes the value of the INSTANCE_SWAP property that picks it, its
 * color a glyph override, and every other field stays unmapped where it differs. Another icon in a
 * layer no property swaps stays unmapped. A glyph turned half a turn in place draws its half-turn
 * mirror unturned, so it swaps to the mirror where one is proven, since Figma turns no layer inside an
 * instance (PT).
 */
function diffIcon(
  found: Found,
  path: readonly string[],
  inPlace: IconLayerSpec,
  variant: IconLayerSpec
): void {
  const built = fieldsOf(inPlace);
  const held = fieldsOf(variant);
  const mirror = halfTurnMirror(inPlace, variant);
  if (mirror !== undefined) {
    found.mirrored.push({ path, icon: mirror });
  }
  for (const field of fieldNames(inPlace, variant)) {
    if (field === "rotation" && mirror !== undefined) {
      continue;
    }
    if (field === "icon") {
      const shown = mirror ?? inPlace.icon;
      if (shown === variant.icon) {
        continue;
      }
      if (variant.swapProperty === undefined) {
        noteUnmapped(found, path, field, shown, variant.icon);
      } else {
        found.swap.set(variant.swapProperty, shown);
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
