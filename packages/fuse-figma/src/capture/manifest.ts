/**
 * A set's manifest: the intent the capture-backed build reads beside the capture. A manifest is an
 * allowlist. It names the props matrix, the sample content and the host it renders in, the property
 * names, the instance boundaries and keys, and the valid state combinations; for an open composite,
 * the elements its cells measure and the placement props its component declares. It holds no CSS
 * knowledge: no classes, no selectors, no layout values, no facts and no omissions, since the
 * capture holds what the browser made of them.
 *
 * Each manifest type below lists its fields, and {@link MANIFEST_FIELDS} lists the same fields by
 * kind, which the oracle test walks every manifest object against.
 */

import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InstanceDefinition,
  InstanceProperties,
  PartDefinition,
  PreviewLength,
} from "../components/component-spec.ts";
import type { Viewport } from "../components/css-values.ts";
import type { AxisSpec, BooleanPropertySpec, SwapPropertySpec } from "../components/kit-spec.ts";

/**
 * A label: its key and layer name, the sample text or the text per cell, the TEXT property that
 * holds it, the cells that show it, and, for a form control, the attribute the text sits in.
 */
export type LabelManifest = {
  readonly key: string;
  readonly name: string;
  readonly shownIn: (cell: Cell) => boolean;
  /** The attribute a control holds its text in, such as `placeholder`, where it is not a text node. */
  readonly textAttribute?: (cell: Cell) => string | undefined;
  /** Set where the sample's text starts with a space, as Meter's value holds one after its icon. */
  readonly leadingSpace?: true;
} & (
  | { readonly characters: string; readonly textProperty: string | undefined }
  | { readonly charactersFor: (cell: Cell) => string }
);

/**
 * An icon a box shows: its key, its layer name, the Fuse icon, its INSTANCE_SWAP and BOOLEAN
 * properties, and where the markup holds it: the side of the label, whether the `<svg>` is the box's
 * child, and the `data-icon` it carries.
 */
export type IconManifest = {
  readonly key: string;
  readonly name: string;
  readonly side: "start" | "end";
  readonly direct: boolean;
  readonly dataIcon: "inline-start" | "inline-end" | undefined;
  readonly icon: string;
  readonly swapProperty: string | undefined;
  readonly optional?: BooleanPropertySpec;
};

/** What a box shows: its label, its icons per cell and its parts, in DOM order. */
type BoxManifest = {
  readonly label: LabelManifest | undefined;
  readonly iconsFor: (cell: Cell) => readonly IconManifest[];
  readonly parts?: readonly (PartManifest | InstanceManifest)[];
};

/**
 * A part: its key, the cells that show it, its BOOLEAN property, and its element, by its
 * `data-slot`, or by its place, the element-ordinal path from the nearest element with a `data-slot`,
 * such as `select-item/0`.
 */
export type PartManifest = BoxManifest & {
  readonly key: string;
  readonly shownIn: (cell: Cell) => boolean;
  readonly optional?: BooleanPropertySpec;
  /** Whether the part's element follows its box's text in the markup, as a row's shortcut does. */
  readonly after?: "label";
  /** The picture the sample shows in the part, as Avatar's image shows the docs portrait. */
  readonly image?: () => Uint8Array;
} & (
    | { readonly slot: string; readonly place?: never }
    | { readonly slot: undefined; readonly place: string }
  );

/**
 * An instance part: its key, the set it shows and that set's cell, the property values it passes,
 * the cells that show it, its BOOLEAN property, whether it exposes its properties, and the
 * `data-slot` the composite stamps on its root in place of the set's own.
 */
export type InstanceManifest = {
  readonly kind: "instance";
  readonly key: string;
  readonly of: SetManifest;
  readonly cell: (outer: Cell) => Cell;
  readonly properties?: (outer: Cell) => InstanceProperties;
  readonly shownIn: (cell: Cell) => boolean;
  readonly optional?: BooleanPropertySpec;
  readonly exposed?: true;
  readonly slot?: string;
  /** Whether the instance's element follows its box's text in the markup, as a row's shortcut does. */
  readonly after?: "label";
};

/**
 * A component set's manifest: its key and name, its root's `data-slot`, its props matrix, the parts
 * its states land on, the size of the host its sample renders in, its INSTANCE_SWAP properties, and
 * what it shows. An open composite adds the `data-slot` of each element its cells measure, and an
 * anchored one its component's `sideOffset`, as the component's `api.json` declares its default, and
 * `alignItemWithTrigger`, as the sample's renderer passes it.
 */
export type SetManifest = BoxManifest & {
  readonly key: string;
  readonly name: string;
  readonly slot: string;
  readonly elementSlot?: (cell: Cell) => string;
  readonly axes: readonly AxisSpec[];
  readonly addedAxes?: ReadonlySet<string>;
  readonly columnAxis: string;
  readonly statePart?: string;
  /**
   * The place of the element that takes the set's states where it carries no `data-slot`, as
   * Number field's `<input>` sits at `field/1/0/0`, by the element-ordinal path a part's place names.
   */
  readonly statePlace?: string;
  readonly statePeer?: string;
  readonly focusPart?: string;
  /** The width of the host the sample renders in, in CSS pixels. */
  readonly previewWidth?: number;
  /** The height of the host the sample renders in. */
  readonly previewHeight?: PreviewLength;
  /** The viewport a fixed popup renders in, which its host is as large as. */
  readonly viewport?: Viewport;
  readonly swapProperties: readonly SwapPropertySpec[];
  /** The `data-slot` of each element an open composite's cell measures, in its renderer's order. */
  readonly union?: readonly string[];
  /** An anchored popup's distance from its anchor in pixels, its component's default. */
  readonly sideOffset?: number;
  /**
   * Whether an anchored popup opens over its anchor, as Select's does by default. The kit draws it
   * beside its anchor only, so the build reads only `false`.
   */
  readonly alignItemWithTrigger?: boolean;
};

/**
 * The widths a manifest's sample host may take, in CSS pixels: plain sizes a renderer gives the box
 * a sample sits in, chosen for the kit's previews, never computed from a component's own CSS. A size
 * a component's CSS sets, as a popup's `min-w-36` or its anchor's width, comes from the capture.
 *
 * - 576: a Command list's host, the docs Groups demo's `max-w-xl` palette box.
 * - 512: an Alert's host, the docs Variants demo's `max-w-lg` column, and Empty's.
 * - 384: a Field's width, the field boxes' and the Input group's host.
 * - 320: a Command row's host.
 * - 256: a Meter's host, the `w-64` a container gives it.
 * - 160: a Dropdown menu row's host.
 */
export const SAMPLE_HOST_WIDTHS: ReadonlySet<number> = new Set([576, 512, 384, 320, 256, 160]);

/**
 * The fields each kind of manifest object may hold, as its type lists them. The oracle test walks
 * every object of every switched manifest and rejects any other field.
 */
export const MANIFEST_FIELDS = {
  set: [
    "key",
    "name",
    "slot",
    "elementSlot",
    "axes",
    "addedAxes",
    "columnAxis",
    "statePart",
    "statePlace",
    "statePeer",
    "focusPart",
    "previewWidth",
    "previewHeight",
    "viewport",
    "swapProperties",
    "union",
    "sideOffset",
    "alignItemWithTrigger",
    "label",
    "iconsFor",
    "parts",
  ],
  part: ["key", "shownIn", "optional", "after", "image", "slot", "place", "label", "iconsFor", "parts"],
  instance: ["kind", "key", "of", "cell", "properties", "shownIn", "optional", "after", "exposed", "slot"],
  label: [
    "key",
    "name",
    "shownIn",
    "textAttribute",
    "leadingSpace",
    "characters",
    "textProperty",
    "charactersFor",
  ],
  icon: ["key", "name", "side", "direct", "dataIcon", "icon", "swapProperty", "optional"],
} as const satisfies Record<string, readonly string[]>;

/** The definition the mapper walks for a manifest box's label and icons. */
function boxDefinition(box: BoxManifest) {
  return {
    // A form control's label names no placement: the mapping takes it from the captured element.
    label: box.label,
    iconsFor: (cell: Cell): readonly IconSlot[] => box.iconsFor(cell),
    classesFor: () => "",
  };
}

/** The definition the mapper walks for a manifest part. */
function partDefinition(part: PartManifest | InstanceManifest): PartDefinition | InstanceDefinition {
  if ("kind" in part) {
    return { ...part, of: manifestDefinition(part.of) };
  }
  const { parts, label: _label, iconsFor: _iconsFor, ...rest } = part;
  const definition: PartDefinition = { ...rest, ...boxDefinition(part) };
  return parts === undefined ? definition : { ...definition, parts: parts.map(partDefinition) };
}

/**
 * The definition the mapper walks for a manifest: the manifest's intent, with no classes, facts or
 * states, which the capture-backed cascade does not read. An anchored composite's root clips
 * nothing, since its popup's shadow reaches past it.
 *
 * @param manifest - The manifest.
 * @returns The definition.
 */
export function manifestDefinition(manifest: SetManifest): ComponentDefinition {
  const {
    parts,
    label: _label,
    iconsFor: _iconsFor,
    union: _union,
    sideOffset,
    alignItemWithTrigger: _alignItemWithTrigger,
    statePlace: _statePlace,
    ...rest
  } = manifest;
  const plain: ComponentDefinition = {
    ...rest,
    ...boxDefinition(manifest),
    facts: new Map(),
    states: {},
    omittedStates: new Set(),
  };
  const definition: ComponentDefinition =
    sideOffset === undefined ? plain : { ...plain, rootOverflow: "visible" };
  return parts === undefined ? definition : { ...definition, parts: parts.map(partDefinition) };
}
