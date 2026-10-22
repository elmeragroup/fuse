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
  /**
   * The underline `text-decoration-line: underline` draws, or undefined for none. `offset` is
   * the `text-underline-offset` in pixels, and an unset offset keeps Figma's automatic one.
   */
  readonly underline: { readonly offset: number | undefined } | undefined;
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
};

/**
 * A frame layer below a component root, such as a checkbox's indicator around its icon. It
 * draws its box as a root does, and holds text, icon and frame layers of its own.
 */
export type FrameLayerSpec = BoxSpec & {
  readonly kind: "frame";
  readonly key: string;
  readonly name: string;
};

/** A layer inside a component root or a frame layer. */
export type ChildLayerSpec = TextLayerSpec | IconLayerSpec | FrameLayerSpec;

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
  readonly fill: ColorSpec | undefined;
  readonly stroke: StrokeSpec | undefined;
  readonly shadows: readonly ShadowSpec[];
  /** The layer opacity, from 0 to 1. */
  readonly opacity: number;
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
 * before the next sibling.
 *
 * @param box - A component root or a frame layer.
 * @returns The layers in layer order, the box itself left out.
 */
export function walkLayers(box: BoxSpec): readonly ChildLayerSpec[] {
  return box.children.flatMap((child) => (child.kind === "frame" ? [child, ...walkLayers(child)] : [child]));
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
 * A component set: its variant axes, its TEXT and INSTANCE_SWAP properties, and one variant per
 * matrix cell.
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
