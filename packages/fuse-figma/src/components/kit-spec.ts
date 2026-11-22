/**
 * The component kit the Fuse plugin reconciles into a Figma file. The spec builder writes it
 * as JSON from the Fuse recipes, and the plugin bundles that JSON with this module. Every
 * type is plain data that survives the JSON round trip.
 *
 * Each node the plugin creates carries its `key` in shared plugin data under the
 * {@link PLUGIN_DATA_NAMESPACE} namespace, so the plugin finds the node again after a
 * designer renames it.
 */

import type { CornerRadiusSpec } from "./corner-spec";
import { ownKey } from "./own-key";

/** The shared plugin data namespace for every key the plugin writes. */
export const PLUGIN_DATA_NAMESPACE = "fuse";

/** The shared plugin data entry that holds a node's key. */
export const PLUGIN_DATA_KEY = "key";

/**
 * The prefix of every text style's key. The plugin deletes a keyed style the kit dropped only when
 * its key has this prefix.
 */
export const TEXT_STYLE_KEY_PREFIX = "text-style/";

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
   * UI 4 §5), or from a table row's border where its table collapses its borders (CSS 2.1 §17.6.2),
   * so the box's layers keep their room under it, as Figma's `strokesIncludedInLayout` false draws.
   * Absent for any other border, which takes its room, as `box-sizing: border-box` counts it.
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
  /**
   * False for a table row's border where its table collapses its borders, which CSS sets on the grid
   * line between rows (CSS 2.1 §17.6.2) and not inside the row, so the row's layers keep their room
   * under it, as Figma's `strokesIncludedInLayout` false draws. Absent for a border that takes its
   * room.
   */
  readonly inLayout?: false;
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
  if (stroke.inLayout === false) {
    return ZERO;
  }
  return "sides" in stroke ? { kind: "literal", value: stroke.sides[side] } : stroke.weight;
}

/**
 * The weight of each side of a solid stroke: its own on some sides, or its one literal weight on
 * every side, as an instance overrides a stroke's sides.
 *
 * @param stroke - The stroke.
 * @returns The four weights, or undefined for a dashed stroke or a bound weight, which four literal
 *   weights would not draw in every mode.
 */
export function solidSides(stroke: StrokeSpec): SideStroke["sides"] | undefined {
  if ("sides" in stroke) {
    return stroke.sides;
  }
  const { weight } = stroke;
  return stroke.dashPattern === undefined && weight.kind === "literal"
    ? { top: weight.value, right: weight.value, bottom: weight.value, left: weight.value }
    : undefined;
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

/**
 * A text layer's weight bound to a FLOAT variable, which gives the layer in each mode the face its
 * family names for the weight there, and every face it can show, which the plugin loads first.
 */
export type TextWeightSpec = {
  readonly variable: VariableRef;
  /** Each face the variable's weights name, lightest first, as `FONT_WEIGHT_STYLES` names them. */
  readonly faces: readonly string[];
};

/** A text layer. `textProperty` names the component's TEXT property that sets its characters. */
export type TextLayerSpec = {
  readonly kind: "text";
  readonly key: string;
  readonly name: string;
  readonly characters: string;
  readonly textProperty: string | undefined;
  readonly fontFamily: StringSpec;
  /**
   * The Figma style of the font family, such as `Medium`, which the plugin loads: the face of the
   * lightest weight where `weight` binds a variable.
   */
  readonly fontStyle: string;
  /** The variable the layer's `fontWeight` binds, absent for a layer whose weight is a literal. */
  readonly weight?: TextWeightSpec;
  readonly fontSize: NumberSpec;
  readonly lineHeight: LineHeightSpec;
  readonly color: ColorSpec;
  /**
   * The runs of characters that take a color other than `color`, in order and apart, as Code's
   * highlighter colors each token through a span of its own. Absent for a text in one color.
   */
  readonly ranges?: readonly TextRangeSpec[];
  /** The underline `text-decoration-line: underline` draws, or undefined for none. */
  readonly underline: UnderlineSpec | undefined;
  /**
   * A line through the text, which `text-decoration-line: line-through` draws, in the text's own
   * fill at the thickness the renderer chooses, as Figma draws a `STRIKETHROUGH` text. Absent for
   * none, and never beside an underline.
   */
  readonly strikethrough?: true;
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
 * A run of a text's characters in a color of its own: from `start`, the index of its first character,
 * to `end`, the index after its last, as Figma's range methods count them.
 */
export type TextRangeSpec = {
  readonly start: number;
  readonly end: number;
  readonly color: ColorSpec;
};

/**
 * A text's line height: a number field in pixels, or a percent of the font size, as Figma's
 * `lineHeight` holds it in `PERCENT`. A unitless CSS line height over a font size a variable sets is
 * that share of the size in every mode. CSS resolves a percentage against the declaring element's
 * font size. Children inherit that length. So a percentage over a synced font size is that share
 * only on a box whose font size binds the declaring element's variable. A real file kept a percent
 * as written and drew the line box at that share of a font size bound to `label-text` in each
 * density mode (PH).
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

/**
 * Where a layer outside its parent's auto layout sits on one axis, by its distances in pixels to its
 * parent's outer edges or centre, each kept by a Figma constraint as the parent resizes:
 *
 * - `start`: the layer's start edge `start` from the parent's start edge, which MIN keeps;
 * - `end`: the layer's end edge `end` inside the parent's end edge, which MAX keeps;
 * - `centre`: the layer's centre `offset` from the parent's centre, toward the end, which CENTER keeps;
 * - `stretch`: the layer spans the parent less `start` and `end`, which STRETCH keeps;
 * - `scale`: the layer starts `start` from the parent's start edge, its start and length keeping their
 *   shares of the parent's length, which SCALE keeps.
 *
 * An axis other than `start` follows the parent's length, which the plugin reads once the parent's
 * other layers are planned, and a `stretch` sets the layer's length too.
 */
export type AxisPlacementSpec =
  | { readonly kind: "start"; readonly start: number }
  | { readonly kind: "end"; readonly end: number }
  | { readonly kind: "centre"; readonly offset: number }
  | { readonly kind: "stretch"; readonly start: number; readonly end: number }
  | { readonly kind: "scale"; readonly start: number };

/** The places an instance takes on an axis: one that keeps the length the instance's main gives it. */
export type InstanceAxisPlacementSpec = Extract<
  AxisPlacementSpec,
  { readonly kind: "start" | "end" | "centre" }
>;

/**
 * A layer outside its parent's auto layout, as `position: absolute` takes a box out of its parent's
 * flow, placed on each axis against its containing block. `within` names that block: `parent`, the
 * frame that holds the layer, whose outer edges the distances measure from, the one block the kit
 * draws a place against.
 */
export type EdgePlacementSpec<Axis extends AxisPlacementSpec = AxisPlacementSpec> = {
  readonly kind: "edges";
  readonly within: "parent";
  readonly horizontal: Axis;
  readonly vertical: Axis;
};

/** The edge of its parent that a frame placed by its centre hangs from. */
export type PivotEdge = "top" | "right" | "bottom" | "left";

/**
 * Each pivot edge's axes: the axis along the edge, where CENTER keeps the layer's offset from the
 * parent's centre, and the end of the axis across it that the edge sits at, where MIN keeps a top or
 * left inset and MAX a bottom or right one. The reader in `pivot-part.ts`, the plugin's writes and
 * its read-back all take their axes from this table.
 */
export const PIVOT_EDGES = {
  top: { along: "horizontal", from: "start", constraints: { horizontal: "CENTER", vertical: "MIN" } },
  bottom: { along: "horizontal", from: "end", constraints: { horizontal: "CENTER", vertical: "MAX" } },
  left: { along: "vertical", from: "start", constraints: { horizontal: "MIN", vertical: "CENTER" } },
  right: { along: "vertical", from: "end", constraints: { horizontal: "MAX", vertical: "CENTER" } },
} as const satisfies Record<
  PivotEdge,
  {
    readonly along: "horizontal" | "vertical";
    readonly from: "start" | "end";
    readonly constraints: {
      readonly horizontal: "CENTER" | "MIN" | "MAX";
      readonly vertical: "CENTER" | "MIN" | "MAX";
    };
  }
>;

/**
 * A frame outside its parent's auto layout, placed by its centre: a fixed distance from the
 * parent's centre along one edge, and a fixed distance inside that edge, as a Tooltip's arrow hangs
 * from the popup's edge that faces its trigger, turned 45°. CSS turns a box about its centre and
 * leaves the centre where it was, while Figma's `x` and `y` are the turned box's origin, which follow
 * the turn and the parent's size, so the spec holds the centre, and the plugin places the layer from
 * it once its turn is written and its parent's size has settled. The constraints {@link PIVOT_EDGES}
 * names keep the place as the parent resizes.
 */
export type PivotSpec = {
  readonly kind: "pivot";
  /** The parent's edge the layer hangs from. */
  readonly edge: PivotEdge;
  /**
   * The pixels from the parent's centre to the layer's centre along the edge: rightward along a top
   * or bottom edge, downward along a left or right one.
   */
  readonly along: number;
  /** The pixels from the edge to the layer's centre, into the parent. */
  readonly inset: number;
};

/** Where a frame sits outside its parent's auto layout: by its edges, or by its centre. */
export type PlacementSpec = EdgePlacementSpec | PivotSpec;

/** The Figma constraint that keeps each axis's place, as {@link AxisPlacementSpec} names them. */
export const AXIS_CONSTRAINT = {
  start: "MIN",
  end: "MAX",
  centre: "CENTER",
  stretch: "STRETCH",
  scale: "SCALE",
} as const satisfies Record<AxisPlacementSpec["kind"], string>;

/**
 * A frame layer below a component root, such as a checkbox's indicator around its icon. It
 * draws its box as a root does, and holds text, icon and frame layers of its own.
 */
export type FrameLayerSpec = BoxSpec & {
  readonly kind: "frame";
  readonly key: string;
  readonly name: string;
  /** Where the layer sits outside its parent's auto layout, absent for a layer the auto layout places. */
  readonly placement?: PlacementSpec;
  /**
   * The BOOLEAN property of the set that shows or hides the layer, which links its `visible`, absent
   * for a layer that shows wherever its variant holds it.
   */
  readonly visibleProperty?: string;
  /**
   * True for a layer drawn hidden, Figma's `visible` false, as CSS's `visibility: hidden` paints
   * nothing of the box; absent for a layer that shows. A hidden layer follows no BOOLEAN property.
   */
  readonly hidden?: true;
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
 * A paint, stroke weight, font style, corner, shadow, padding or alignment an instance layer overrides on the inner
 * variant's root, at the empty `path`, or on a layer below it, at the keys of the layers from the root
 * down. `fill`, `strokeColor`, `strokeSides`, `cornerRadius` and `effects` apply to the root or a
 * frame, `primaryAlign`, where the auto layout places its layers along its direction, and a side's
 * padding, `paddingTop`, `paddingRight`, `paddingBottom` or `paddingLeft`, to the root
 * alone, `textColor`, `textAlign`, the alignment across a text's lines, and `fontStyle`, the face of
 * a label whose weight is a literal, to a text, and `glyph` to an icon's glyph. A `fill` or `strokeColor` of undefined paints none.
 */
export type InstanceOverride = { readonly path: readonly string[] } & (
  | InstancePaintOverride
  | InstanceOverrideValue
);

/** The color an instance override paints: a `fill` or `strokeColor` of undefined paints none. */
export type InstancePaintOverride =
  | { readonly field: "fill" | "strokeColor"; readonly color: ColorSpec | undefined }
  | { readonly field: "textColor" | "glyph"; readonly color: ColorSpec };

/**
 * The value of an instance override that paints nothing, which the plugin writes as the spec gives
 * it.
 */
export type InstanceOverrideValue =
  | { readonly field: "textAlign"; readonly horizontal: TextAlignSpec["horizontal"] }
  | { readonly field: "strokeSides"; readonly sides: SideStroke["sides"] }
  | { readonly field: "fontStyle"; readonly style: string }
  | { readonly field: "cornerRadius"; readonly value: CornerRadiusSpec }
  | { readonly field: "primaryAlign"; readonly value: PrimaryAlignSpec }
  | { readonly field: "effects"; readonly shadows: readonly ShadowSpec[] }
  | { readonly field: PaddingField; readonly value: NumberSpec };

/** A side's padding of a box, as the spec and Figma's auto layout name it. */
export type PaddingField = "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";

/**
 * Whether an override of `field` applies to the inner variant's root alone, at the empty `path`, as
 * a side's padding does. The build carries a padding that differs on the root only, so the kit check
 * refuses one at another path, and the plugin leaves a padding a layer below the root holds to the
 * designer who set it.
 *
 * @param field - The override's field.
 * @returns True for a side's padding.
 */
export function rootOnlyOverride(field: InstanceOverride["field"]): field is PaddingField {
  return (
    field === "paddingTop" || field === "paddingRight" || field === "paddingBottom" || field === "paddingLeft"
  );
}

/**
 * An instance layer: an instance of another component set's variant inside a variant, such as an
 * Alert's action Button, so the composite stays linked to the set that draws the part. The inner set
 * owns every layer inside the instance, so {@link walkLayers} stops at it. The layer sets the inner
 * set's properties, overrides paints, corners, shadows and alignments, and sizes itself in its
 * parent's auto layout.
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
   * The widest width the instance takes, as a chip value's `max-w-56` caps its Button, absent for the
   * inner variant's own.
   */
  readonly maxWidth?: NumberSpec;
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
  readonly placement?: EdgePlacementSpec<InstanceAxisPlacementSpec>;
};

/** A layer inside a component root or a frame layer. */
export type ChildLayerSpec = TextLayerSpec | IconLayerSpec | FrameLayerSpec | InstanceLayerSpec;

/**
 * Whether a layer sits outside its parent's auto layout: a frame or an instance with a placement,
 * which takes no room in the flow and counts toward no hug (P8). Every reader of a box's flow asks
 * this, so a placement of any kind leaves the flow alike.
 *
 * @param layer - The layer.
 * @returns True for a placed layer.
 */
export function outOfLayout(layer: ChildLayerSpec): boolean {
  return (layer.kind === "frame" || layer.kind === "instance") && layer.placement !== undefined;
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

/**
 * How an auto layout box places its children: along a row, down a column, or in the cells of a grid,
 * Figma's `layoutMode` GRID, whose tracks and cells the box's `grid` holds. No box is without auto
 * layout, which an absolute MAX instance needs to keep its end inset in its outer component's main as
 * density resizes it (W5-P14b). In an instance of the outer component only a placement wrapper keeps
 * it (PG14b, PG16); `anchored-instances.test.ts` pins both.
 */
export type DirectionSpec = "HORIZONTAL" | "VERTICAL" | "GRID";

/**
 * One track of a grid, a column or a row, as Figma's `GridTrackSize` sizes it: `fixed` at a length in
 * pixels; `flex`, a share of the room the fixed and hugging tracks leave, as CSS's `fr` takes it; or
 * `hug`, as wide as what it holds, as CSS's `fit-content(100%)` takes it.
 */
export type GridTrackSpec =
  | { readonly kind: "fixed"; readonly length: number }
  | { readonly kind: "flex"; readonly share: number }
  | { readonly kind: "hug" };

/** Where one of a grid's layers sits: its row and column, from 0, each one track wide. */
export type GridCellSpec = { readonly key: string; readonly row: number; readonly column: number };

/**
 * A grid's tracks, the gaps between them and the cell each of its layers in flow takes, which a box
 * whose `direction` is GRID holds, and only such a box.
 */
export type GridSpec = {
  readonly columns: readonly GridTrackSpec[];
  readonly rows: readonly GridTrackSpec[];
  readonly columnGap: NumberSpec;
  readonly rowGap: NumberSpec;
  /** Each layer in flow by its key, in the box's layer order. */
  readonly cells: readonly GridCellSpec[];
};

/**
 * How a box sizes along one axis: a fixed length, the size of its content, or the room its
 * parent's auto layout gives it, as Figma's fixed, hug and fill sizing do.
 */
export type SizeSpec =
  | { readonly kind: "fixed"; readonly length: NumberSpec }
  | { readonly kind: "hug" }
  | { readonly kind: "fill" }
  /**
   * The length a `stretch` placement leaves the layer between its distances to its parent's edges,
   * where the build cannot tell the parent's length: the plugin sets it once the parent's other layers
   * are planned, and no geometry reads it. A stretch whose length the build can tell is `fixed`.
   */
  | { readonly kind: "placed" };

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
  /**
   * The width and height whose ratio Figma's aspect lock keeps, `targetAspectRatio`, on a box whose
   * CSS aspect ratio sets its height from its width, or its width from its height. The box's fixed lengths, so a lock taken after
   * the box is resized to them holds the CSS ratio, and an instance that fills a host's width keeps
   * the ratio's height there (PG19). Absent for a box with no lock.
   */
  readonly aspectLock?: { readonly width: number; readonly height: number };
  readonly paddingTop: NumberSpec;
  readonly paddingRight: NumberSpec;
  readonly paddingBottom: NumberSpec;
  readonly paddingLeft: NumberSpec;
  readonly itemSpacing: NumberSpec;
  /** The grid a box whose `direction` is GRID lays its layers out in, absent for any other box. */
  readonly grid?: GridSpec;
  /** Where the children sit along the direction, as `justify-content` places them. */
  readonly primaryAlign: PrimaryAlignSpec;
  /** Where the children sit across the direction, as `align-items` places them. */
  readonly counterAlign: CounterAlignSpec;
  readonly cornerRadius: CornerRadiusSpec;
  readonly fill: FillSpec | undefined;
  readonly stroke: StrokeSpec | undefined;
  /**
   * The drop shadows in the order Figma paints them, each above the ones before it (PE2), so the
   * reverse of `box-shadow`'s, whose first shadow CSS paints on top.
   */
  readonly shadows: readonly ShadowSpec[];
  /**
   * The radius of the background blur Figma draws behind the box, as CSS's `backdrop-filter: blur()`
   * blurs what lies behind it, absent for a box that blurs nothing behind it.
   */
  readonly backgroundBlur?: NumberSpec;
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

/**
 * The value an instance gives a TEXT property of its set: its own, or else the property's default,
 * which Apply writes back over a value the instance kept from an earlier spec.
 *
 * @param layer - The instance.
 * @param property - The TEXT property of the instance's set.
 * @returns The characters the property's labels show on the instance.
 */
export function instanceText(layer: InstanceLayerSpec, property: TextPropertySpec): string {
  const given = layer.properties?.text;
  // Only a value the instance gives counts, not a key its record inherits, such as `constructor`.
  return (
    (given !== undefined && ownKey(given, property.name) ? given[property.name] : undefined) ??
    property.defaultValue
  );
}

/** An inner variant an instance shows, and the TEXT properties of its set. */
export type InnerVariantSpec = {
  readonly variant: VariantSpec;
  readonly textProperties: readonly TextPropertySpec[];
};

/**
 * A label of an inner variant as an instance layer shows it: at the characters the instance shows,
 * the value it gives the label's TEXT property or the property's default, which Apply writes where it
 * gives none, or the label's own where no TEXT property sets it, and in the face the layer's override
 * gives it. A face override is a literal face, which a font write gives the whole label, and that
 * write drops a weight binding (PG8), so the label shows the face with no bound weight. The family
 * stays the inner label's, which the face write lands in (`fontFor` in `plugin/src/fonts.ts`).
 *
 * @param layer - The instance layer.
 * @param inner - The inner variant it shows, which holds the label, and the TEXT properties of its set.
 * @param label - The label.
 * @returns The label at the characters and face the instance shows.
 */
export function shownLabel(
  layer: InstanceLayerSpec,
  inner: InnerVariantSpec,
  label: TextLayerSpec
): TextLayerSpec {
  const property = inner.textProperties.find((candidate) => candidate.name === label.textProperty);
  const characters = property === undefined ? label.characters : instanceText(layer, property);
  const [face] = (layer.overrides ?? []).flatMap((override) =>
    override.field === "fontStyle" && layerAt(inner.variant.root, override.path) === label
      ? [override.style]
      : []
  );
  if (face === undefined) {
    return { ...label, characters };
  }
  const { weight: _, ...literal } = label;
  return { ...literal, characters, fontStyle: face };
}

/**
 * The labels of an inner variant whose fonts the instance layer's writes need, as the layer shows
 * them ({@link shownLabel}): each a TEXT property sets and each whose face the layer overrides. The
 * characters an instance shows can hold the glyph font's glyphs where the inner label's own do not,
 * and then need its faces too. A face only the override names is a font no other layer of the kit
 * may need.
 *
 * @param layer - The instance layer.
 * @param inner - The inner variant it shows, and the TEXT properties of its set.
 * @returns The text layers, at the characters and face the instance shows.
 */
export function shownLabels(layer: InstanceLayerSpec, inner: InnerVariantSpec): readonly TextLayerSpec[] {
  const faced = new Set(
    (layer.overrides ?? []).flatMap((override) =>
      override.field === "fontStyle" ? [layerAt(inner.variant.root, override.path)] : []
    )
  );
  return walkLayers(inner.variant.root).flatMap((label) =>
    label.kind === "text" && (label.textProperty !== undefined || faced.has(label))
      ? [shownLabel(layer, inner, label)]
      : []
  );
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

/**
 * One instance a preview group places: the variant it shows, and the BOOLEAN properties it sets off
 * their defaults, so a preview shows each part a property hides or shows in its other state too.
 */
export type PreviewInstanceSpec = {
  /** The variant's key. */
  readonly variant: string;
  /** The BOOLEAN values the instance sets by property name, or undefined for every default. */
  readonly booleans?: Readonly<Record<string, boolean>>;
};

/** The instances of one component set in a preview frame, which start on a row of their own. */
export type PreviewGroupSpec = {
  /** The preview's key, `/` and the set's key. */
  readonly key: string;
  /** The set's name. */
  readonly name: string;
  readonly componentSet: string;
  /** The instances the group places, in order. */
  readonly instances: readonly PreviewInstanceSpec[];
};

/**
 * The key of a preview's instance: the preview's key, `/` and the variant's key, then `/` and each
 * BOOLEAN value it sets, as `Name=true`, in the order the instance names them.
 *
 * @param previewKey - The preview's key.
 * @param instance - The instance.
 * @returns The key, such as `preview/alert/neutral-fkas-private-light/alert/variant=default,described=false/Action=true`.
 */
export function previewInstanceKey(previewKey: string, instance: PreviewInstanceSpec): string {
  const values = Object.entries(instance.booleans ?? {}).map(([name, value]) => `${name}=${String(value)}`);
  return [`${previewKey}/${instance.variant}`, ...(values.length === 0 ? [] : [values.join(",")])].join("/");
}

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
 * one, and a label an instance's TEXT value, or the property's default where the instance gives
 * none, gives one. The plugin loads them before its first write.
 *
 * @param kit - The kit.
 * @returns The fonts, each once.
 */
export function glyphFonts(kit: Pick<KitSpec, "componentSets" | "glyphFont">): readonly FontSpec[] {
  const { glyphFont } = kit;
  const shows = (characters: string): boolean => glyphRanges(characters, glyphFont).length > 0;
  const inners = new Map(
    kit.componentSets.flatMap((set) =>
      set.variants.map((variant) => [variant.key, { variant, textProperties: set.textProperties }] as const)
    )
  );
  const styles = new Set<string>();
  for (const layer of kit.componentSets.flatMap((set) =>
    set.variants.flatMap((variant) => walkLayers(variant.root))
  )) {
    if (layer.kind === "text" && shows(layer.characters)) {
      styles.add(layer.fontStyle);
    }
    const inner = layer.kind === "instance" ? inners.get(layer.variant) : undefined;
    if (layer.kind !== "instance" || inner === undefined) {
      continue;
    }
    for (const label of shownLabels(layer, inner)) {
      if (shows(label.characters)) {
        styles.add(label.fontStyle);
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

/** The Figma style of each font weight a recipe reaches, such as `Medium` for 500. */
export const FONT_WEIGHT_STYLES: ReadonlyMap<number, string> = new Map([
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
]);

/** A font weight: bound to a FLOAT variable, or a literal Figma style such as `Medium`. */
export type FontWeightSpec =
  | { readonly kind: "variable"; readonly variable: VariableRef }
  | { readonly kind: "literal"; readonly style: string };

/**
 * A local text style the plugin keeps in the file, built from the capture of a Text, Heading or Span
 * sample. The plugin finds it by `key` in shared plugin data, so a designer can rename it. It sets
 * every field a Figma text style applies: these from the sample, and the rest to Figma's defaults.
 */
export type TextStyleSpec = {
  /** The style's key, such as `text-style/text/sm/medium`. */
  readonly key: string;
  /** The style's name, whose `/` segments Figma shows as folders, such as `Text/sm/medium`. */
  readonly name: string;
  /** What the style draws, which Figma shows beside it. */
  readonly description: string;
  readonly fontFamily: StringSpec;
  readonly fontWeight: FontWeightSpec;
  readonly fontSize: NumberSpec;
  readonly lineHeight: LineHeightSpec;
  /** Letter spacing as a percent of the font size, 0 where the sample sets none. */
  readonly letterSpacing: LetterSpacingSpec;
  readonly textCase: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  readonly textDecoration: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  readonly textWrapStyle: "AUTO" | "BALANCE" | "PRETTY";
};

/**
 * A text layer of a page's docs: a heading, named `Header` as the Obra kit names its component-name
 * captions and its section labels, or the page's description.
 */
export type DocTextSpec = {
  readonly kind: "text";
  readonly key: string;
  readonly name: string;
  readonly page: string;
  /** The text, such as the page's name, its description or `Examples`. */
  readonly text: string;
  /** The key of the local text style the text links. */
  readonly style: string;
};

/**
 * The labels around a component set's grid, which make the set's section of its page: a frame
 * behind the set, outside it, holding the set's name in the page's label column, a header above
 * each column naming its value on the set's column axis, and a header beside each row that holds a
 * variant, naming its values on the other axes.
 */
export type SetLabelsSpec = {
  readonly kind: "labels";
  readonly key: string;
  readonly name: string;
  readonly page: string;
  /** The key of the set the labels read. */
  readonly componentSet: string;
  /** The key of the local text style the set's name links. */
  readonly nameStyle: string;
  /** The key of the local text style each row and column header links. */
  readonly axisStyle: string;
};

/**
 * A page's usage example: a group frame, as a preview's, holding an instance of one of the page's
 * sets at the page's own modes, such as the open Select the docs default demo shows.
 */
export type PageExampleSpec = {
  readonly kind: "example";
  readonly key: string;
  readonly name: string;
  readonly page: string;
  /** The key of the set the example shows. */
  readonly componentSet: string;
  /** The key of the variant the example's instance shows. */
  readonly variant: string;
};

/**
 * An underline under a text. `offset` is the `text-underline-offset` and `thickness` the
 * `text-decoration-thickness`, both in pixels, and an unset one keeps Figma's automatic one. `color`
 * is the `text-decoration-color`, and an unset one, as CSS's `currentcolor`, keeps Figma's `AUTO`,
 * which draws in the text's own fill.
 */
export type UnderlineSpec = {
  readonly offset: number | undefined;
  readonly thickness: number | undefined;
  readonly color: ColorSpec | undefined;
};

/**
 * A text that opens a web page, such as a page's `View documentation` link, which opens the
 * component's docs page.
 */
export type DocLinkSpec = {
  readonly kind: "link";
  readonly key: string;
  readonly name: string;
  readonly page: string;
  readonly text: string;
  /** The key of the local text style the text links. */
  readonly style: string;
  /** The URL the whole text links to. */
  readonly url: string;
  /** The text's fill, the color Fuse's `Link` draws its text in. */
  readonly color: ColorSpec;
  /** The underline Fuse's `Link` draws at rest. */
  readonly underline: UnderlineSpec;
};

/**
 * A horizontal line 1px high under a page's title, description and docs link, as wide as the page's
 * content, in a color the theme sets.
 */
export type DocRuleSpec = {
  readonly kind: "rule";
  readonly key: string;
  readonly name: string;
  readonly page: string;
  readonly color: ColorSpec;
};

/** A node that documents a page, outside the page's sets and previews. */
export type DocSpec = DocTextSpec | DocLinkSpec | DocRuleSpec | SetLabelsSpec | PageExampleSpec;

/**
 * The docs of one component page, complete: its title, its description, its docs link and the rule
 * under them, the labels of each set it holds, the `Themes` header beside the previews, the
 * `Examples` header and its example.
 */
export type PageDocsSpec = {
  /** The page's key. */
  readonly page: string;
  readonly title: DocTextSpec;
  /** The component's docs page lede, in one line under the title. */
  readonly description: DocTextSpec;
  /** `View documentation`, linking to the component's published docs page. */
  readonly docsLink: DocLinkSpec;
  readonly rule: DocRuleSpec;
  /** One labels frame per set on the page, in the page's set order. */
  readonly labels: readonly SetLabelsSpec[];
  readonly themesHeader: DocTextSpec;
  readonly examplesHeader: DocTextSpec;
  readonly example: PageExampleSpec;
};

/**
 * A kit's doc nodes, one after another, as the plugin finds each by its key.
 *
 * @param docs - The kit's docs, a record per component page.
 * @returns Each page's title, description, docs link, rule, labels, `Themes` header, `Examples`
 *   header and example, page by page.
 */
export function docNodes(docs: readonly PageDocsSpec[]): readonly DocSpec[] {
  return docs.flatMap((page) => [
    page.title,
    page.description,
    page.docsLink,
    page.rule,
    ...page.labels,
    page.themesHeader,
    page.examplesHeader,
    page.example,
  ]);
}

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
  /** The local text styles, in the order the plugin creates them. */
  readonly textStyles: readonly TextStyleSpec[];
  /** The docs of each component page, one record per page that holds a set. */
  readonly docs: readonly PageDocsSpec[];
  /**
   * Set on a probe, `figma:plugin --sets`, which holds a few of the kit's sets. Plan refuses a file
   * that holds a kit set the probe lacks, such as one the whole kit was applied to, where it would
   * delete every set the probe leaves out. Absent on the whole kit.
   */
  readonly probe?: true;
};

/**
 * The kit's top-level nodes, each of which sits on one of the kit's pages.
 *
 * @param kit - The kit.
 * @returns The icon library, then the component sets, then the previews, then the docs.
 */
export function topLevelSpecs(
  kit: KitSpec
): readonly (IconLibrarySpec | ComponentSetSpec | PreviewSpec | DocSpec)[] {
  return [kit.icons, ...kit.componentSets, ...kit.previews, ...docNodes(kit.docs)];
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

/**
 * A Phosphor weight the library draws an icon in besides its default bold: `fill`, the solid glyph
 * Checkbox card's checked icon renders.
 */
export type IconWeight = "fill";

/**
 * The name of an icon in the library: its export name, and for a weight other than the default,
 * the weight after it, as `CheckCircleFill`.
 *
 * @param name - The icon's export name.
 * @param weight - The weight, or undefined for the default.
 * @returns The library name.
 */
export function weightedIconName(name: string, weight: IconWeight | undefined): string {
  return weight === undefined ? name : `${name}${weight.charAt(0).toUpperCase()}${weight.slice(1)}`;
}
