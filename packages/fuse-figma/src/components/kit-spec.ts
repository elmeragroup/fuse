/**
 * The component kit the Fuse plugin reconciles into a Figma file. The spec builder writes it
 * as JSON from the Fuse recipes, and the plugin bundles that JSON with this module. Every
 * type is plain data that survives the JSON round trip.
 *
 * Each node the plugin creates carries its `key` in shared plugin data under the
 * {@link PLUGIN_DATA_NAMESPACE} namespace, so the plugin finds the node again after a
 * designer renames it.
 */

/** The shared plugin data namespace for every key the plugin writes. */
export const PLUGIN_DATA_NAMESPACE = "fuse";

/** The shared plugin data entry that holds a node's key. */
export const PLUGIN_DATA_KEY = "key";

/** A variable the sync owns, found by its collection and variable name. */
export type VariableRef = {
  readonly collection: string;
  readonly name: string;
};

/** An sRGB color with alpha, each channel from 0 to 1. */
export type RgbaSpec = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

/** A number field: bound to a FLOAT variable, or a literal in pixels. */
export type NumberSpec =
  | { readonly kind: "variable"; readonly variable: VariableRef }
  | { readonly kind: "literal"; readonly value: number };

/** A literal 0, the length of an unset padding, gap or corner. */
export const ZERO: NumberSpec = { kind: "literal", value: 0 };

/** A string field, such as a font family: bound to a STRING variable, or a literal. */
export type StringSpec =
  | { readonly kind: "variable"; readonly variable: VariableRef }
  | { readonly kind: "literal"; readonly value: string };

/**
 * A solid paint. A bound paint takes its opacity from the variable's alpha, so a role mixed
 * toward transparent, such as `bg-primary/80`, binds the role tint `primary/80`.
 */
export type ColorSpec =
  | { readonly kind: "variable"; readonly variable: VariableRef }
  | { readonly kind: "literal"; readonly color: RgbaSpec };

/**
 * An image paint: the bytes of an image file, which the plugin hands Figma to store, and how the
 * image fills the box. `FILL` scales the image to cover the box and crops what overflows, as
 * `object-fit: cover` draws an `<img>`.
 */
export type ImagePaintSpec = {
  readonly kind: "image";
  /** The bytes of a PNG file, base64 encoded, the one format the kit ships. */
  readonly bytes: string;
  /**
   * The SHA-1 of the bytes in lowercase hex, the hash Figma names the stored image by (P9b). Plan
   * compares a held paint with it, so it stores no image.
   */
  readonly hash: string;
  readonly scaleMode: "FILL";
};

/** A box's fill: a solid paint, or an image. */
export type FillSpec = ColorSpec | ImagePaintSpec;

/**
 * A drop shadow. Tailwind's `ring-*` utilities become a zero-blur shadow with a spread. The blur
 * and spread can bind a FLOAT variable, as the outline Button's shadow does.
 */
export type ShadowSpec = {
  readonly color: ColorSpec;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly radius: NumberSpec;
  readonly spread: NumberSpec;
};

/**
 * A fill Figma counts as visible that changes no 8-bit channel: black at an alpha below half a
 * step, 1/510, moves a channel by less than 0.5, which rounds away. Figma does not count a fill
 * at alpha 0. On a real file on 2026-10-20, ghost and link focus rings held their 2px spread
 * over such a fill and drew nothing, and a test frame drew the ring once its fill reached 0.001.
 */
const CLEAR: ColorSpec = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.0015 } };

/**
 * Whether a box casts a shadow with a spread, as a focus ring is.
 *
 * @param shadows - The box's shadows.
 * @returns True where a spread is bound or is not 0.
 */
export function castsSpread(shadows: readonly ShadowSpec[]): boolean {
  return shadows.some((shadow) => shadow.spread.kind === "variable" || shadow.spread.value !== 0);
}

/**
 * The fill a box's spread ring needs. Figma draws a drop shadow's spread only from a frame that
 * clips its content and has a visible fill, a root on a real file on 2026-10-20 and a part below
 * one on 2026-10-23 (PR2). A box without a fill, such as a ghost Button or an Accordion trigger,
 * therefore gets one that shows nothing, as CSS paints nothing for an unset `background-color`. The
 * plugin gives a root this fill, since the build makes every root clip, and the build gives a part
 * the fill and clipping, so the part's spec holds what the plugin writes.
 *
 * @param box - The box's fill and shadows.
 * @returns The fill the box draws, or undefined for none.
 */
export function ringFill(box: Pick<BoxSpec, "fill" | "shadows">): FillSpec | undefined {
  return box.fill ?? (castsSpread(box.shadows) ? CLEAR : undefined);
}

/**
 * Whether a box's fill shows: a literal color only where its alpha moves an 8-bit channel by half a
 * step or more, so not the clear one {@link ringFill} gives a box for its ring.
 *
 * @param fill - The box's fill.
 * @returns False for no fill and for one that changes no pixel.
 */
function showsFill(fill: FillSpec | undefined): boolean {
  return fill !== undefined && (fill.kind !== "literal" || fill.color.a * 255 >= 0.5);
}

/** A layer and its frames below it, the layers that can fill or cast a shadow. */
function framesOf(layer: ChildLayerSpec): readonly FrameLayerSpec[] {
  return layer.kind === "frame"
    ? [layer, ...walkLayers(layer).filter((below): below is FrameLayerSpec => below.kind === "frame")]
    : [];
}

/**
 * A fill that a box putting its first layer on top would paint over a shadow: a frame that shows a
 * fill anywhere in an earlier layer, and a frame that casts a shadow anywhere in a later one. CSS
 * paints the shadow above the fill wherever the later box paints after the earlier one, so the box
 * cannot prove it draws them in CSS's order.
 *
 * @param layers - The box's layers, in order.
 * @returns The names of the frame that fills and the frame that casts the shadow, or undefined.
 */
export function coveredShadow(
  layers: readonly ChildLayerSpec[]
): { readonly fill: string; readonly shadow: string } | undefined {
  for (const [index, later] of layers.entries()) {
    const shadow = framesOf(later).find((frame) => frame.shadows.length > 0);
    const fill = layers
      .slice(0, index)
      .flatMap(framesOf)
      .find((frame) => showsFill(frame.fill));
    if (shadow !== undefined && fill !== undefined) {
      return { fill: fill.name, shadow: shadow.name };
    }
  }
  return undefined;
}

/**
 * A stroke drawn inside the box: one weight on every side, or a weight on each side, as a CSS border
 * on some sides draws.
 */
export type StrokeSpec = EverySideStroke | SideStroke;

/** A stroke of one weight on every side, counted in the auto layout as a CSS border is. */
export type EverySideStroke = {
  readonly color: ColorSpec;
  readonly weight: NumberSpec;
  /**
   * The lengths in pixels of a dashed stroke's dash and gap, which repeat around the box, as Figma's
   * `dashPattern` holds them. Absent for a solid stroke.
   */
  readonly dashPattern?: readonly number[];
  /**
   * False for a stroke drawn from a CSS outline, which takes no room in the box's layout (CSS Basic
   * UI 4 §5), so the box's layers keep their room under it, as Figma's `strokesIncludedInLayout`
   * false draws. Absent for a border, which takes its room, as `box-sizing: border-box` counts it.
   */
  readonly inLayout?: false;
};

/**
 * A solid stroke with a weight in pixels on each side, 0 on a side the CSS border leaves bare. It
 * counts in the auto layout, where each side's weight takes room on that side, as a CSS border on
 * that side does (PS).
 */
export type SideStroke = {
  readonly color: ColorSpec;
  readonly sides: Readonly<Record<StrokeSide, number>>;
};

/** A side of a box's stroke. */
export type StrokeSide = "top" | "right" | "bottom" | "left";

/**
 * The room a box's stroke takes in its auto layout on one side: none for no stroke or one drawn out
 * of the layout, the weight of a stroke on every side, and the side's own weight of a stroke on some
 * sides (PS).
 *
 * @param stroke - The box's stroke, or undefined for none.
 * @param side - The side.
 * @returns The room in pixels, or the bound weight of a stroke on every side.
 */
export function strokeRoom(stroke: StrokeSpec | undefined, side: StrokeSide): NumberSpec {
  if (stroke === undefined) {
    return ZERO;
  }
  if ("sides" in stroke) {
    return { kind: "literal", value: stroke.sides[side] };
  }
  return stroke.inLayout === false ? ZERO : stroke.weight;
}

/**
 * How a text layer sizes each axis. Its height follows its lines unless both sides are fixed: it
 * hugs its characters on both axes, or its width fills its box's room or is fixed and its lines
 * wrap there, or both sides are fixed. Figma's auto resize has these three forms,
 * `WIDTH_AND_HEIGHT`, `HEIGHT` and `NONE`, which the plugin derives from the sizing.
 */
export type TextSizingSpec =
  | { readonly horizontal: HugSize; readonly vertical: HugSize }
  | { readonly horizontal: FillSize | FixedSize; readonly vertical: HugSize }
  | { readonly horizontal: FixedSize; readonly vertical: FixedSize };

type HugSize = Extract<SizeSpec, { readonly kind: "hug" }>;
type FillSize = Extract<SizeSpec, { readonly kind: "fill" }>;
type FixedSize = Extract<SizeSpec, { readonly kind: "fixed" }>;

/** A text that hugs its characters on both axes, as every label drew before text sizing. */
export const HUGGING_TEXT: TextSizingSpec = { horizontal: { kind: "hug" }, vertical: { kind: "hug" } };

/** Where a text layer sets its lines within its own box, as Figma's text alignment names it. */
export type TextAlignSpec = {
  readonly horizontal: "LEFT" | "CENTER" | "RIGHT";
  readonly vertical: "TOP" | "CENTER" | "BOTTOM";
};

/** Lines set from the top left, Figma's alignment for a new text layer. */
export const TOP_LEFT: TextAlignSpec = { horizontal: "LEFT", vertical: "TOP" };

/** A text that ends in an ellipsis after `maxLines` lines, a whole number of at least 1. */
export type TruncationSpec = {
  readonly maxLines: number;
};

/** A text layer. `textProperty` names the component's TEXT property that sets its characters. */
export type TextLayerSpec = {
  readonly kind: "text";
  readonly key: string;
  readonly name: string;
  readonly characters: string;
  readonly textProperty: string | undefined;
  readonly fontFamily: StringSpec;
  /** The Figma style of the font family, such as `Medium`, which the plugin loads. */
  readonly fontStyle: string;
  readonly fontSize: NumberSpec;
  readonly lineHeight: LineHeightSpec;
  readonly color: ColorSpec;
  /**
   * The underline `text-decoration-line: underline` draws, or undefined for none. `offset` is
   * the `text-underline-offset` in pixels, and an unset offset keeps Figma's automatic one.
   */
  readonly underline: { readonly offset: number | undefined } | undefined;
  readonly sizing: TextSizingSpec;
  readonly align: TextAlignSpec;
  /** Where the text cuts its characters off, or undefined where it shows them all. */
  readonly truncation: TruncationSpec | undefined;
  /** The space added between letters, absent for the font's own spacing. */
  readonly letterSpacing?: LetterSpacingSpec;
  /**
   * The width at which a text that hugs its width wraps, as a box around it that hugs its width up to
   * a `max-width` wraps it in CSS. A hugging Figma text with a `maxWidth` wraps there (P7). Absent for
   * a text nothing caps.
   */
  readonly maxWidth?: NumberSpec;
};

/**
 * A text's line height: a number field in pixels, or a percent of the font size, as Figma's
 * `lineHeight` holds it in `PERCENT`. A unitless CSS line height over a font size a variable sets is
 * that share of the size in every mode. A real file kept a percent as written and drew the line box
 * at that share of a font size bound to `label-text` in each density mode (PH).
 */
export type LineHeightSpec = NumberSpec | { readonly kind: "percent"; readonly value: number };

/**
 * Letter spacing as a percent of the font size, as Figma's `letterSpacing` holds it in `PERCENT`.
 * An `em` spacing in CSS is the same share, so it keeps its ratio at any font size (PL).
 */
export type LetterSpacingSpec = {
  readonly unit: "PERCENT";
  readonly value: number;
};

/**
 * An icon layer: an instance of one of the kit's icon components, sized and colored by the
 * cell. The icon's glyph takes `color`, as a Fuse icon takes `currentColor`.
 */
export type IconLayerSpec = {
  readonly kind: "icon";
  readonly key: string;
  readonly name: string;
  /** The key of the icon component the layer shows. */
  readonly icon: string;
  /**
   * The INSTANCE_SWAP property that lets a designer pick another icon, or undefined for a
   * fixed icon, such as the spinner a pending Button shows.
   */
  readonly swapProperty: string | undefined;
  readonly size: NumberSpec;
  readonly color: ColorSpec;
  /** How far the layer turns, in degrees as {@link RotationSpec} counts them, absent for none. */
  readonly rotation?: RotationSpec;
  /**
   * The BOOLEAN property of the set that shows or hides the icon, which links its `visible` beside
   * its swap link (PI2), absent for an icon that shows wherever its variant holds it.
   */
  readonly visibleProperty?: string;
};

/**
 * A layer's turn in degrees, as Figma's `rotation` counts it: counterclockwise, from -180 to 180,
 * about the layer's center as auto layout keeps its box in its slot (PR). CSS turns clockwise, so
 * `rotate: 90deg` is -90 and `rotate: 180deg` is 180. The kit check takes only quarter turns.
 */
export type RotationSpec = number;

/**
 * How an absolute layer follows its parent's resize on one axis, as Figma's constraints name it:
 * `STRETCH` keeps its distance to both of the parent's edges, so it grows with the parent, `SCALE`
 * keeps its position and length as shares of the parent's, `MAX` keeps its distance to the parent's
 * end, and `CENTER` keeps its centre's distance from the parent's centre, as the layer and the parent
 * resize (N11).
 */
export type ConstraintSpec = "STRETCH" | "SCALE" | "MAX" | "CENTER";

/** A constraint that keeps the layer's place as the spec's `x` and `y` set it, at the parent's start. */
type PlacingConstraint = Extract<ConstraintSpec, "STRETCH" | "SCALE">;

/**
 * A layer outside its parent's auto layout, as `position: absolute` takes a box out of its parent's
 * flow: at `x` and `y` in pixels from the parent's top left, following the parent's resize as its
 * constraints say.
 */
export type AbsoluteSpec = {
  readonly x: number;
  readonly y: number;
  readonly constraints: { readonly horizontal: PlacingConstraint; readonly vertical: PlacingConstraint };
};

/**
 * An instance outside its parent's auto layout at the parent's end and centred down it, as a Sidebar
 * menu badge sits over the end of its row. The instance hugs its content, so its `x` and `y` follow
 * a width only Figma knows: the spec holds what MAX and CENTER keep instead, and the plugin places the
 * instance from them once its size and its parent's have settled.
 */
export type AnchoredSpec = {
  readonly constraints: { readonly horizontal: "MAX"; readonly vertical: "CENTER" };
  /** The pixels from the instance's end to its parent's, which MAX keeps. */
  readonly endInset: number;
  /** The pixels from the parent's centre down to the instance's centre, which CENTER keeps. */
  readonly centerOffset: number;
};

/**
 * A frame outside its parent's auto layout placed by its centre: across, a fixed distance from the
 * parent's horizontal centre, and down, a fixed distance above the parent's bottom edge, as a
 * Tooltip's arrow hangs from its popup, turned 45°. CSS turns a box about its centre and leaves the
 * centre where it was, while Figma's `x` and `y` are the turned box's origin, which follow the turn and
 * the parent's size, so the spec holds the centre, and the plugin places the layer from it once its
 * turn is written and its parent's size has settled. CENTER across and MAX down keep the place as the
 * parent resizes.
 */
export type PivotSpec = {
  readonly constraints: { readonly horizontal: "CENTER"; readonly vertical: "MAX" };
  /** The pixels from the parent's horizontal centre to the layer's centre, rightward. */
  readonly centerOffset: number;
  /** The pixels from the layer's centre down to the parent's bottom edge. */
  readonly bottomInset: number;
};

/**
 * A frame layer below a component root, such as a checkbox's indicator around its icon. It
 * draws its box as a root does, and holds text, icon and frame layers of its own.
 */
export type FrameLayerSpec = BoxSpec & {
  readonly kind: "frame";
  readonly key: string;
  readonly name: string;
  /** Where the layer sits outside its parent's auto layout, absent for a layer the auto layout places. */
  readonly absolute?: AbsoluteSpec;
  /**
   * Where a layer outside its parent's auto layout sits by its centre, as a Tooltip's arrow does,
   * absent for every other layer. A layer holds `absolute` or `pivot`, never both.
   */
  readonly pivot?: PivotSpec;
  /**
   * The BOOLEAN property of the set that shows or hides the layer, which links its `visible`, absent
   * for a layer that shows wherever its variant holds it.
   */
  readonly visibleProperty?: string;
  /** How far the layer turns, in degrees as {@link RotationSpec} counts them, absent for none. */
  readonly rotation?: RotationSpec;
};

/**
 * The TEXT, BOOLEAN and INSTANCE_SWAP values an instance layer gives the inner set's properties, each
 * by the property's name, only where the value differs from the property's default. A swap value is
 * the key of an icon component.
 */
export type InstancePropertiesSpec = {
  readonly text?: Readonly<Record<string, string>>;
  readonly boolean?: Readonly<Record<string, boolean>>;
  readonly swap?: Readonly<Record<string, string>>;
  /**
   * The TEXT values of exposed instances inside the instance, each at the keys of the instance layers
   * from the inner root down, which the plugin sets on the exposed sublayer (PN). Absent for none.
   */
  readonly nested?: readonly NestedPropertiesSpec[];
};

/** The TEXT values of one exposed instance inside an instance, at the keys of the instance layers down to it. */
export type NestedPropertiesSpec = {
  readonly path: readonly string[];
  readonly text: Readonly<Record<string, string>>;
};

/**
 * A paint, corner, shadow or text alignment an instance layer overrides on the inner variant's root, at
 * the empty `path`, or on a layer below it, at the keys of the layers from the root down. `fill`,
 * `strokeColor`, `cornerRadius` and `effects` apply to the root or a frame, `textColor` and
 * `textAlign`, the alignment across a text's lines, to a text, and `glyph` to an icon's glyph. A `fill`
 * or `strokeColor` of undefined paints none.
 */
export type InstanceOverride =
  | {
      readonly path: readonly string[];
      readonly field: "fill" | "strokeColor";
      readonly color: ColorSpec | undefined;
    }
  | { readonly path: readonly string[]; readonly field: "textColor" | "glyph"; readonly color: ColorSpec }
  | {
      readonly path: readonly string[];
      readonly field: "textAlign";
      readonly horizontal: TextAlignSpec["horizontal"];
    }
  | { readonly path: readonly string[]; readonly field: "cornerRadius"; readonly value: NumberSpec }
  | { readonly path: readonly string[]; readonly field: "effects"; readonly shadows: readonly ShadowSpec[] };

/**
 * An instance layer: an instance of another component set's variant inside a variant, such as an
 * Alert's action Button, so the composite stays linked to the set that draws the part. The inner set
 * owns every layer inside the instance, so {@link walkLayers} stops at it. The layer sets the inner
 * set's properties, overrides paints, corners and shadows, and sizes itself in its parent's auto
 * layout.
 */
export type InstanceLayerSpec = {
  readonly kind: "instance";
  readonly key: string;
  /** The layer name, the inner root's `data-slot`, as other layers take theirs. */
  readonly name: string;
  /** The key of the inner component set, which the kit lists before the set that holds this layer. */
  readonly componentSet: string;
  /** The key of the inner set's variant the instance shows. */
  readonly variant: string;
  /** The inner set's property values that differ from their defaults, absent where none does. */
  readonly properties?: InstancePropertiesSpec;
  /** The overrides on the instance and the layers below it, absent for none. */
  readonly overrides?: readonly InstanceOverride[];
  /**
   * How the instance sizes in its parent's auto layout. Only a fixed axis has a length, which may bind
   * a variable. A real file kept a hugging instance's height when its height bound one (N4), so the
   * plugin fixes the axis before it binds the length.
   */
  readonly sizing: SizingSpec;
  /**
   * The least width the instance takes, as a popup's widest row keeps the popup's minimum, absent for
   * the inner variant's own. A hugging instance with one fills its filling text up to it and hugs past
   * it (PH3).
   */
  readonly minWidth?: NumberSpec;
  /**
   * True for an instance whose properties a designer sets from the outer instance's properties panel,
   * as Figma's `isExposedInstance` marks it, absent for one they do not.
   */
  readonly exposed?: true;
  /**
   * The BOOLEAN property of the set that shows or hides the instance, which links its `visible`, absent
   * for an instance that shows wherever its variant holds it.
   */
  readonly visibleProperty?: string;
  /** Where the instance sits outside its parent's auto layout, absent for one the auto layout places. */
  readonly absolute?: AnchoredSpec;
};

/** A layer inside a component root or a frame layer. */
export type ChildLayerSpec = TextLayerSpec | IconLayerSpec | FrameLayerSpec | InstanceLayerSpec;

/**
 * Whether a layer sits outside its parent's auto layout: an absolute frame or instance, or a frame
 * placed by its centre, which takes no room in the flow and counts toward no hug (P8).
 *
 * @param layer - The layer.
 * @returns True for an absolute layer.
 */
export function outOfLayout(layer: ChildLayerSpec): boolean {
  return (
    ((layer.kind === "frame" || layer.kind === "instance") && layer.absolute !== undefined) ||
    (layer.kind === "frame" && layer.pivot !== undefined)
  );
}

/**
 * Where an auto layout box places its children across its direction: at the start, centered or
 * at the end, as `items-*` places them in CSS.
 */
export type CounterAlignSpec = "MIN" | "CENTER" | "MAX";

/**
 * Where an auto layout box places its children along its direction, as `justify-*` places them
 * in CSS. `SPACE_BETWEEN` puts the first and last child flush with the edges and the room left
 * between the children, as `justify-between` does.
 */
export type PrimaryAlignSpec = CounterAlignSpec | "SPACE_BETWEEN";

/** The axis along which an auto layout box places its children: a row or a column. */
export type DirectionSpec = "HORIZONTAL" | "VERTICAL";

/**
 * How a box sizes along one axis: a fixed length, the size of its content, or the room its
 * parent's auto layout gives it, as Figma's fixed, hug and fill sizing do.
 */
export type SizeSpec =
  | { readonly kind: "fixed"; readonly length: NumberSpec }
  | { readonly kind: "hug" }
  | { readonly kind: "fill" };

/** The sizing of a box along each axis. */
export type SizingSpec = {
  readonly horizontal: SizeSpec;
  readonly vertical: SizeSpec;
};

/** The lengths a box keeps its size within, each undefined where nothing limits it. */
export type LimitsSpec = {
  readonly minWidth: NumberSpec | undefined;
  readonly maxWidth: NumberSpec | undefined;
  readonly minHeight: NumberSpec | undefined;
  readonly maxHeight: NumberSpec | undefined;
};

/** No limit on either axis. */
export const NO_LIMITS: LimitsSpec = {
  minWidth: undefined,
  maxWidth: undefined,
  minHeight: undefined,
  maxHeight: undefined,
};

/**
 * The fixed length of one axis.
 *
 * @param size - The axis's sizing.
 * @returns The length, or undefined where the box hugs or fills the axis.
 */
export function fixedLength(size: SizeSpec): NumberSpec | undefined {
  return size.kind === "fixed" ? size.length : undefined;
}

/**
 * A box: an auto layout frame that sizes each axis as its sizing says, keeps within its limits,
 * and places its children on each axis as its alignment says.
 */
export type BoxSpec = {
  readonly direction: DirectionSpec;
  readonly sizing: SizingSpec;
  readonly limits: LimitsSpec;
  /** Whether the box hides what overflows it, as `overflow: hidden` does. */
  readonly clips: boolean;
  readonly paddingTop: NumberSpec;
  readonly paddingRight: NumberSpec;
  readonly paddingBottom: NumberSpec;
  readonly paddingLeft: NumberSpec;
  readonly itemSpacing: NumberSpec;
  /** Where the children sit along the direction, as `justify-content` places them. */
  readonly primaryAlign: PrimaryAlignSpec;
  /** Where the children sit across the direction, as `align-items` places them. */
  readonly counterAlign: CounterAlignSpec;
  readonly cornerRadius: NumberSpec;
  readonly fill: FillSpec | undefined;
  readonly stroke: StrokeSpec | undefined;
  /**
   * The drop shadows in the order Figma paints them, each above the ones before it (PE2), so the
   * reverse of `box-shadow`'s, whose first shadow CSS paints on top.
   */
  readonly shadows: readonly ShadowSpec[];
  /** The layer opacity, from 0 to 1. */
  readonly opacity: number;
  /**
   * True for a box that paints its first layer on top, as Figma's `itemReverseZIndex` does, where
   * CSS paints a ring an earlier layer holds over a later layer's fill. Absent for a box that paints
   * each layer above the ones before it, as Figma does by default.
   */
  readonly firstOnTop?: true;
  readonly children: readonly ChildLayerSpec[];
};

/**
 * A component root: the box a variant component draws, such as an `inline-flex items-center
 * justify-center` Button. A root sits in its component set, which has no auto layout, so it
 * cannot fill an axis.
 */
export type ComponentRootSpec = BoxSpec & {
  /** The layer name, the part's `data-slot`. */
  readonly name: string;
};

/**
 * Every layer below a box, depth first: each layer, then the layers a frame among them holds,
 * before the next sibling. An instance layer is one layer, since the inner set owns what it holds.
 *
 * @param box - A component root or a frame layer.
 * @returns The layers in layer order, the box itself left out.
 */
export function walkLayers(box: BoxSpec): readonly ChildLayerSpec[] {
  return box.children.flatMap((child) => (child.kind === "frame" ? [child, ...walkLayers(child)] : [child]));
}

/**
 * The layer at a key path below a box, the path an instance override names: the box itself for the
 * empty path, and otherwise the layer whose key is the path's last, below the frames its other keys
 * name.
 *
 * @param box - A variant's root.
 * @param path - The keys from the box down.
 * @returns The box or the layer, or undefined where the box holds none at the path.
 */
export function layerAt(box: BoxSpec, path: readonly string[]): BoxSpec | ChildLayerSpec | undefined {
  let layer: BoxSpec | ChildLayerSpec = box;
  for (const key of path) {
    const next: ChildLayerSpec | undefined =
      "children" in layer ? layer.children.find((child) => child.key === key) : undefined;
    if (next === undefined) {
      return undefined;
    }
    layer = next;
  }
  return layer;
}

/** One variant of a component set, one cell of its matrix. */
export type VariantSpec = {
  readonly key: string;
  /** The variant property values, in the set's axis order. */
  readonly properties: Readonly<Record<string, string>>;
  readonly root: ComponentRootSpec;
};

/** A variant property of a component set and its values, in display order. */
export type AxisSpec = {
  readonly name: string;
  readonly values: readonly string[];
};

/**
 * The values of one axis of a component or component set.
 *
 * @param component - The component, or anything else that lists axes.
 * @param name - The axis's name, such as `state`.
 * @returns The axis's values in order, or none when there is no such axis.
 */
export function axisValues(
  component: { readonly axes: readonly AxisSpec[] },
  name: string
): readonly string[] {
  return component.axes.find((axis) => axis.name === name)?.values ?? [];
}

/** A TEXT component property and the characters it starts with. */
export type TextPropertySpec = {
  readonly name: string;
  readonly defaultValue: string;
};

/** An INSTANCE_SWAP component property and the key of the icon component it starts with. */
export type SwapPropertySpec = {
  readonly name: string;
  readonly defaultIcon: string;
};

/**
 * A BOOLEAN component property, which shows or hides the layers that link their `visible` to it,
 * and the value it starts with.
 */
export type BooleanPropertySpec = {
  readonly name: string;
  readonly defaultValue: boolean;
};

/**
 * A component set: its variant axes, its TEXT, BOOLEAN and INSTANCE_SWAP properties, and one variant
 * per matrix cell.
 */
export type ComponentSetSpec = {
  readonly key: string;
  readonly name: string;
  /** The key of the page the set sits on. */
  readonly page: string;
  readonly axes: readonly AxisSpec[];
  /** The axis the plugin lays out as columns. The other axes form the rows, in axis order. */
  readonly columnAxis: string;
  readonly textProperties: readonly TextPropertySpec[];
  /**
   * The BOOLEAN properties that show or hide optional layers, absent on a set without one, so a set
   * built before they existed keeps its spec.
   */
  readonly booleanProperties?: readonly BooleanPropertySpec[];
  readonly swapProperties: readonly SwapPropertySpec[];
  readonly variants: readonly VariantSpec[];
};

/** The name of the one vector every icon component draws, which an icon layer recolors. */
export const ICON_GLYPH = "glyph";

/**
 * One icon component: an icon of Fuse's roster that paints only with `currentColor`, drawn from
 * the markup the Fuse icon renders. It flattens to one vector, {@link ICON_GLYPH}, which takes
 * the color of the layer it sits in.
 */
export type IconSpec = {
  /** `icon/` and the export name, such as `icon/ArrowRight`. */
  readonly key: string;
  /** The export name, such as `ArrowRight`, which names the component. */
  readonly name: string;
  /** The SVG the icon renders, with `currentColor` painted black. */
  readonly svg: string;
};

/** The frame of icon components that icon layers instance and swap between. */
export type IconLibrarySpec = {
  readonly key: string;
  readonly name: string;
  /** The key of the page the library sits on. */
  readonly page: string;
  /** Each component's width and height in pixels. */
  readonly size: number;
  /** The color a glyph takes in the component itself. */
  readonly color: ColorSpec;
  readonly icons: readonly IconSpec[];
};

/** A variable mode a preview frame pins, found by collection and mode name. */
export type ModeRef = {
  readonly collection: string;
  readonly mode: string;
};

/** The instances of one component set in a preview frame, which start on a row of their own. */
export type PreviewGroupSpec = {
  /** The preview's key, `/` and the set's key. */
  readonly key: string;
  /** The set's name. */
  readonly name: string;
  readonly componentSet: string;
  /** The variant keys the group places, in order. */
  readonly variants: readonly string[];
};

/**
 * A frame of instances that pins one theme, to check bound values render. It holds a group for
 * each component set on its page.
 */
export type PreviewSpec = {
  readonly key: string;
  readonly name: string;
  /** The key of the page the preview sits on, which holds every set the preview places. */
  readonly page: string;
  readonly modes: readonly ModeRef[];
  readonly groups: readonly PreviewGroupSpec[];
};

/** A font the plugin loads before it writes text. */
export type FontSpec = {
  readonly family: string;
  readonly style: string;
};

/**
 * The family the kit draws some symbol glyphs in, where the family a label binds has none. Figma,
 * unlike a browser, falls back to no other font for a glyph its font lacks: on 2026-10-26 a Roboto
 * text `⇧⌘P` drew `P` alone, with a combined 13px blank advance for the two glyphs, and reported no
 * missing font, where Inter drew both (G1). Each range of a label's characters that holds only these glyphs
 * takes `family` at the label's own style and binds no family, while its other characters keep the
 * label's family (G2).
 */
export type GlyphFontSpec = {
  /** The family that draws the glyphs, a literal Figma family. */
  readonly family: string;
  /** The glyphs, each one UTF-16 code unit, as Figma's range methods count characters. */
  readonly glyphs: readonly string[];
};

/** Some characters of a text, from `start` up to but not including `end`, in UTF-16 code units. */
export type TextRange = {
  readonly start: number;
  readonly end: number;
};

/**
 * The ranges of some characters the glyph font draws: each run of the font's glyphs, so `⇧⌘P` gives
 * one range over `⇧⌘`.
 *
 * @param characters - The characters a text shows.
 * @param font - The glyph font.
 * @returns The ranges, in order, none for characters that hold no glyph.
 */
export function glyphRanges(characters: string, font: GlyphFontSpec): readonly TextRange[] {
  const ranges: TextRange[] = [];
  let start: number | undefined;
  for (let index = 0; index <= characters.length; index += 1) {
    const glyph = index < characters.length && font.glyphs.includes(characters.charAt(index));
    if (glyph && start === undefined) {
      start = index;
    } else if (!glyph && start !== undefined) {
      ranges.push({ start, end: index });
      start = undefined;
    }
  }
  return ranges;
}

/**
 * The glyph font at each style a label that shows a glyph takes: a label whose own characters hold
 * one, and a label an instance's TEXT value gives one. The plugin loads them before its first write.
 *
 * @param kit - The kit.
 * @returns The fonts, each once.
 */
export function glyphFonts(kit: Pick<KitSpec, "componentSets" | "glyphFont">): readonly FontSpec[] {
  const { glyphFont } = kit;
  const shows = (characters: string): boolean => glyphRanges(characters, glyphFont).length > 0;
  const variants = new Map(
    kit.componentSets.flatMap((set) => set.variants.map((variant) => [variant.key, variant] as const))
  );
  const styles = new Set<string>();
  for (const layer of kit.componentSets.flatMap((set) =>
    set.variants.flatMap((variant) => walkLayers(variant.root))
  )) {
    if (layer.kind === "text" && shows(layer.characters)) {
      styles.add(layer.fontStyle);
    }
    if (layer.kind !== "instance") {
      continue;
    }
    const inner = variants.get(layer.variant);
    for (const [name, value] of Object.entries(layer.properties?.text ?? {})) {
      for (const label of inner === undefined || !shows(value) ? [] : walkLayers(inner.root)) {
        if (label.kind === "text" && label.textProperty === name) {
          styles.add(label.fontStyle);
        }
      }
    }
  }
  return [...styles].map((style) => ({ family: glyphFont.family, style }));
}

/**
 * A page of the kit. The plugin finds it by its key alone, so a page a designer gave the same
 * name stays theirs.
 */
export type PageSpec = {
  readonly key: string;
  readonly name: string;
};

/** Everything the plugin reconciles, on the pages it lists. */
export type KitSpec = {
  /** The kit's pages, in the order the plugin creates them. */
  readonly pages: readonly PageSpec[];
  readonly fonts: readonly FontSpec[];
  /** The family the kit draws the glyphs `font-sans` lacks in. */
  readonly glyphFont: GlyphFontSpec;
  readonly icons: IconLibrarySpec;
  readonly componentSets: readonly ComponentSetSpec[];
  readonly previews: readonly PreviewSpec[];
};

/**
 * The kit's top-level nodes, each of which sits on one of the kit's pages.
 *
 * @param kit - The kit.
 * @returns The icon library, then the component sets, then the previews.
 */
export function topLevelSpecs(kit: KitSpec): readonly (IconLibrarySpec | ComponentSetSpec | PreviewSpec)[] {
  return [kit.icons, ...kit.componentSets, ...kit.previews];
}

/**
 * The key of the icon component for a Fuse icon.
 *
 * @param name - The icon's export name, such as `ArrowRight`.
 * @returns The key, such as `icon/ArrowRight`.
 */
export function iconKey(name: string): string {
  return `icon/${name}`;
}
