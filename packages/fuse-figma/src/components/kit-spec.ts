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

/** A string field, such as a font family: bound to a STRING variable, or a literal. */
export type StringSpec =
  | { readonly kind: "variable"; readonly variable: VariableRef }
  | { readonly kind: "literal"; readonly value: string };

/**
 * A solid paint. A bound color keeps its paint opacity apart from the variable, the way
 * `bg-primary/80` mixes `--primary` toward transparent.
 */
export type ColorSpec =
  | { readonly kind: "variable"; readonly variable: VariableRef; readonly opacity: number }
  | { readonly kind: "literal"; readonly color: RgbaSpec };

/** A drop shadow. Tailwind's `ring-*` utilities become a zero-blur shadow with a spread. */
export type ShadowSpec = {
  readonly color: ColorSpec;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly radius: number;
  readonly spread: number;
};

/** A stroke drawn inside the box and counted in the auto layout, as a CSS border is. */
export type StrokeSpec = {
  readonly color: ColorSpec;
  readonly weight: NumberSpec;
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
  readonly lineHeight: NumberSpec;
  readonly color: ColorSpec;
};

/**
 * An icon slot. The proof of concept draws a placeholder ring in the icon's box, stroked in
 * the icon color, until the kit has an icon component set to swap in.
 */
export type IconLayerSpec = {
  readonly kind: "icon";
  readonly key: string;
  readonly name: string;
  readonly size: NumberSpec;
  readonly color: ColorSpec;
};

/** A layer inside a component root. */
export type ChildLayerSpec = TextLayerSpec | IconLayerSpec;

/**
 * A component root: a horizontal auto layout frame that hugs its content along the row and
 * centers it on both axes, as an `inline-flex items-center justify-center` box does.
 */
export type ComponentRootSpec = {
  /** The layer name, the part's `data-slot`. */
  readonly name: string;
  /** The fixed height. An unset height hugs the content. */
  readonly height: NumberSpec | undefined;
  readonly minWidth: NumberSpec | undefined;
  readonly paddingTop: NumberSpec;
  readonly paddingRight: NumberSpec;
  readonly paddingBottom: NumberSpec;
  readonly paddingLeft: NumberSpec;
  readonly itemSpacing: NumberSpec;
  readonly cornerRadius: NumberSpec;
  readonly fill: ColorSpec | undefined;
  readonly stroke: StrokeSpec | undefined;
  readonly shadows: readonly ShadowSpec[];
  /** The layer opacity, from 0 to 1. */
  readonly opacity: number;
  readonly children: readonly ChildLayerSpec[];
};

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

/** A TEXT component property and the characters it starts with. */
export type TextPropertySpec = {
  readonly name: string;
  readonly defaultValue: string;
};

/** A component set: its variant axes, TEXT properties and one variant per matrix cell. */
export type ComponentSetSpec = {
  readonly key: string;
  readonly name: string;
  readonly axes: readonly AxisSpec[];
  /** The axis the plugin lays out as columns. The other axes form the rows, in axis order. */
  readonly columnAxis: string;
  readonly textProperties: readonly TextPropertySpec[];
  readonly variants: readonly VariantSpec[];
};

/** A variable mode a preview frame pins, found by collection and mode name. */
export type ModeRef = {
  readonly collection: string;
  readonly mode: string;
};

/** A frame of instances that pins one theme and density, to check bound values render. */
export type PreviewSpec = {
  readonly key: string;
  readonly name: string;
  readonly modes: readonly ModeRef[];
  /** The component set and the variant keys it places, in order. */
  readonly componentSet: string;
  readonly variants: readonly string[];
};

/** A font the plugin loads before it writes text. */
export type FontSpec = {
  readonly family: string;
  readonly style: string;
};

/** Everything the plugin reconciles, on one page of the file. */
export type KitSpec = {
  readonly page: { readonly key: string; readonly name: string };
  readonly fonts: readonly FontSpec[];
  readonly componentSets: readonly ComponentSetSpec[];
  readonly previews: readonly PreviewSpec[];
};
