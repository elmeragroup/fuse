/**
 * The kit check that reads only the kit. It refuses a spec that contradicts itself: a page key
 * listed twice, a node on a page the kit does not list, a set whose variants, axes or properties
 * disagree, a sizing, turn or stacking Figma cannot draw as CSS does, an instance layer the plugin
 * cannot plan, a glyph it cannot draw in the glyph font, image bytes Figma cannot store or a hash
 * they do not give, and a preview that places what the kit lacks.
 *
 * `buildKit` runs it, so `figma:plugin` stops before Figma sees such a spec. The plugin runs it
 * again before it plans, together with the checks against the file's variables in
 * `plugin/src/check-kit.ts`. This module imports no Figma typings and no Node module, because the
 * plugin bundles it.
 */

import { Data, Result } from "effect";

import {
  coveredShadow,
  fixedLength,
  glyphRanges,
  layerAt,
  outOfLayout,
  topLevelSpecs,
  walkLayers,
} from "./kit-spec.ts";
import type {
  AxisSpec,
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  InstanceLayerSpec,
  InstanceOverride,
  KitSpec,
  TextLayerSpec,
  VariantSpec,
} from "./kit-spec.ts";
import { sha1Hex } from "./sha1.ts";

/** The kit spec contradicts itself, or asks for something Figma or the plugin cannot draw. */
export class KitContradiction extends Data.TaggedError("KitContradiction")<{
  readonly message: string;
}> {}

function contradiction(message: string): KitContradiction {
  return new KitContradiction({ message });
}

/**
 * A variant's Figma name, which is also where Figma reads its variant property values from.
 *
 * @param spec - The component set.
 * @param variant - The variant.
 * @returns `prop=value, prop=value` in the set's axis order.
 * @throws `KitContradiction` when the variant sets no value on an axis.
 */
export function variantName(spec: ComponentSetSpec, variant: VariantSpec): string {
  return spec.axes
    .map((axis) => {
      const value = variant.properties[axis.name];
      if (value === undefined) {
        throw contradiction(`${spec.name}: the variant ${variant.key} sets no ${axis.name}.`);
      }
      return `${axis.name}=${value}`;
    })
    .join(", ");
}

/** A cell of the variant grid, counted from the top left. */
export type GridCell = {
  readonly row: number;
  readonly column: number;
};

/**
 * The axis whose values give a variant its column in the set's grid.
 *
 * @param spec - The component set.
 * @returns The column axis.
 * @throws `KitContradiction` when the column axis is not one of the set's axes.
 */
export function columnAxisOf(spec: ComponentSetSpec): AxisSpec {
  const columnAxis = spec.axes.find((axis) => axis.name === spec.columnAxis);
  if (columnAxis === undefined) {
    throw contradiction(`${spec.name}: the column axis ${spec.columnAxis} is not one of the set's axes.`);
  }
  return columnAxis;
}

/**
 * A variant's cell in the grid. Its column is its value on the column axis, and its row is its
 * position among the combinations of the other axes, in axis order.
 *
 * @param spec - The component set.
 * @param variant - The variant.
 * @returns The variant's cell.
 * @throws `KitContradiction` when the variant has a value its axis does not list.
 */
export function gridCell(spec: ComponentSetSpec, variant: VariantSpec): GridCell {
  let row = 0;
  let column = 0;
  for (const axis of spec.axes) {
    const index = axis.values.indexOf(variant.properties[axis.name] ?? "");
    if (index < 0) {
      throw contradiction(
        `${spec.name}: the variant ${variant.key} has a ${axis.name} the axis does not list.`
      );
    }
    if (axis.name === spec.columnAxis) {
      column = index;
    } else {
      row = row * axis.values.length + index;
    }
  }
  return { row, column };
}

/**
 * Check that a component set's spec agrees with itself. Every variant sets a listed value on
 * each axis, the column axis is one of the axes, every text layer links a TEXT property and every
 * frame or instance a BOOLEAN property the set defines, and no two properties share a name, since
 * the plugin finds each property's id by its name.
 */
function checkComponentSet(spec: ComponentSetSpec): void {
  columnAxisOf(spec);
  const texts = spec.textProperties.map((property) => property.name);
  const booleans = (spec.booleanProperties ?? []).map((property) => property.name);
  const names = [...texts, ...booleans, ...spec.swapProperties.map((property) => property.name)];
  const twice = names.find((name, index) => names.indexOf(name) !== index);
  if (twice !== undefined) {
    throw contradiction(
      `${spec.name} names two properties ${twice}, and the plugin finds each property by its name.`
    );
  }
  for (const variant of spec.variants) {
    variantName(spec, variant);
    gridCell(spec, variant);
    for (const layer of walkLayers(variant.root)) {
      const link =
        layer.kind === "text"
          ? { property: layer.textProperty, defined: texts }
          : { property: layer.visibleProperty, defined: booleans };
      if (link.property !== undefined && !link.defined.includes(link.property)) {
        throw contradiction(
          `${spec.name}: the variant ${variant.key} links ${link.property}, which the set does not define.`
        );
      }
    }
  }
}

const AXES = [
  { axis: "horizontal", length: "width", limits: ["minWidth", "maxWidth"] },
  { axis: "vertical", length: "height", limits: ["minHeight", "maxHeight"] },
] as const;

/**
 * Refuse a box that limits an axis it fixes, that holds a frame or text filling an axis the box
 * hugs, or that holds an absolute frame filling an axis.
 * Figma clamps a fixed length to a limit, so the plan would resize the box on every run. CSS
 * resolves a `width` against its own `min-width` and `max-width`, so the build folds such a limit
 * into the length. A hugging box takes its size from its layers, so a layer that fills it along
 * the box's direction collapses to its smallest size, where CSS resolves the percentage against an
 * auto size the same circular way. Across the direction a layer that fills stretches to the length
 * the box's other layers set, as a real file did on 2026-10-23 (PF), so it passes beside a layer in
 * the flow that sets a length there, a fixed or hugging one or an icon, or in a box with a minimum on
 * that axis, which a real file's filling sections took on 2026-10-24 (PM), and collapses beside none.
 * Figma refuses FILL on an absolute layer, as a real file did on 2026-10-22 (P8).
 */
function checkBox(set: ComponentSetSpec, variant: VariantSpec, box: BoxSpec, name: string): void {
  for (const { axis, length, limits } of AXES) {
    const absolute = box.children.find(
      (child) => child.kind !== "icon" && outOfLayout(child) && child.sizing[axis].kind === "fill"
    );
    if (absolute !== undefined) {
      throw contradiction(
        `${set.name}: ${absolute.name} in the variant ${variant.key} is absolute and fills its ${length}, and Figma refuses FILL on an absolute layer. Give it a fixed ${length}.`
      );
    }
    const limit =
      box.sizing[axis].kind === "fixed" ? limits.find((field) => box.limits[field] !== undefined) : undefined;
    if (limit !== undefined) {
      throw contradiction(
        `${set.name}: ${name} in the variant ${variant.key} sets ${limit} on its fixed ${length}. Fold the limit into the ${length}, as CSS resolves a ${length} against its own limits.`
      );
    }
    const filling = box.children.find((child) => child.kind !== "icon" && child.sizing[axis].kind === "fill");
    if (filling === undefined || box.sizing[axis].kind !== "hug") {
      continue;
    }
    const across = (box.direction === "HORIZONTAL" ? "vertical" : "horizontal") === axis;
    if (!across) {
      throw contradiction(
        `${set.name}: ${filling.name} in the variant ${variant.key} fills the ${length} of a parent that hugs it, so Figma would shrink it to its smallest ${length}.`
      );
    }
    // A minimum on the axis sets a length too: a column that hugs both ways from a 128px `minWidth`
    // drew its filling sections 128 wide (PM).
    const setsLength =
      box.limits[limits[0]] !== undefined ||
      box.children.some(
        (child) => child.kind === "icon" || (child.sizing[axis].kind !== "fill" && !outOfLayout(child))
      );
    if (!setsLength) {
      throw contradiction(
        `${set.name}: ${filling.name} in the variant ${variant.key} fills the ${length} of a parent that hugs it, beside no layer that sets that ${length}, so Figma would shrink it to its smallest ${length}.`
      );
    }
  }
}

/** A variant's boxes, the root and every frame below it, each with its layer name. */
function boxesOf(variant: VariantSpec): readonly { readonly box: BoxSpec; readonly name: string }[] {
  return [
    { box: variant.root, name: variant.root.name },
    ...walkLayers(variant.root).flatMap((layer) =>
      layer.kind === "frame" ? [{ box: layer, name: layer.name }] : []
    ),
  ];
}

/**
 * Refuse a sizing Figma cannot draw as CSS does. A variant sits in its component set, which has no
 * auto layout, so Figma refuses FILL on its root, as a real file did on 2026-10-22. Each box, the
 * root and every frame below it, passes `checkBox`.
 */
function checkSizing(set: ComponentSetSpec): void {
  for (const variant of set.variants) {
    const { root } = variant;
    for (const { axis, length } of AXES) {
      if (root.sizing[axis].kind === "fill") {
        throw contradiction(
          `${set.name}: the variant ${variant.key} fills its ${length}, and a variant sits in its component set, which has no auto layout. Give it a fixed ${length}.`
        );
      }
    }
    for (const { box, name } of boxesOf(variant)) {
      checkBox(set, variant, box, name);
    }
  }
}

/** Whether a layer's two sides are fixed at one length, as an icon's always are. */
function squareSides(layer: Exclude<ChildLayerSpec, { readonly kind: "text" }>): boolean {
  if (layer.kind === "icon") {
    return true;
  }
  const width = fixedLength(layer.sizing.horizontal);
  const height = fixedLength(layer.sizing.vertical);
  return width !== undefined && JSON.stringify(width) === JSON.stringify(height);
}

/**
 * Refuse a turn the plugin cannot draw as CSS does. CSS's `rotate` leaves the layout as it was,
 * while Figma lays a turned layer out by its turned box. On 2026-10-22 a real file kept a
 * half-turned layer's box in its auto layout slot (PR), and a 20 × 10 frame at -90 made its hugging
 * row 10 × 20 (PQ). So the kit takes a half turn on any layer and a quarter turn only on a layer
 * with two equal fixed sides, whose box the turn keeps. The plugin places an absolute layer by its
 * `x` and `y`, which a turn moves (PR), so an absolute frame cannot turn.
 */
function checkRotations(set: ComponentSetSpec): void {
  for (const variant of set.variants) {
    for (const layer of walkLayers(variant.root)) {
      if (layer.kind === "text" || layer.kind === "instance" || layer.rotation === undefined) {
        continue;
      }
      const { rotation } = layer;
      const where = `${set.name}: ${layer.name} in the variant ${variant.key}`;
      if (rotation % 90 !== 0) {
        throw contradiction(
          `${where} has a rotation of ${rotation}, and the kit draws only half and quarter turns.`
        );
      }
      if (rotation % 180 !== 0 && !squareSides(layer)) {
        throw contradiction(
          `${where} turns a quarter turn without two equal fixed sides, and Figma lays a turned layer out by its turned box, where CSS leaves the layout as it was.`
        );
      }
      if (layer.kind === "frame" && layer.absolute !== undefined) {
        throw contradiction(
          `${where} is absolute and turns, and the plugin places an absolute layer by an x and y that a turn moves.`
        );
      }
    }
  }
}

/**
 * Refuse a stack the plugin cannot draw as the build decides one. The build puts a box's first layer
 * on top only in a column, the one shape a real file drew on 2026-10-23 (PZ2), and only where no
 * earlier fill covers a later shadow (`box-mapping.ts`), so a built kit passes. This guards a spec
 * written by hand, through the same {@link coveredShadow} the build reads.
 */
function checkStacking(set: ComponentSetSpec): void {
  for (const variant of set.variants) {
    for (const { box, name } of boxesOf(variant)) {
      if (box.firstOnTop !== true) {
        continue;
      }
      const where = `${set.name}: ${name} in the variant ${variant.key}`;
      if (box.direction !== "VERTICAL") {
        throw contradiction(
          `${where} puts its first layer on top in a row, and a real file drew that only in a column (PZ2).`
        );
      }
      const covered = coveredShadow(box.children);
      if (covered !== undefined) {
        throw contradiction(
          `${where} puts its first layer on top, so the fill of ${covered.fill} would cover the shadow ${covered.shadow} casts, which CSS can paint above that fill.`
        );
      }
    }
  }
}

/** The layer an override's field applies to: the root or a frame, a text, or an icon. */
const OVERRIDE_TARGETS = {
  fill: "box",
  strokeColor: "box",
  cornerRadius: "box",
  effects: "box",
  textColor: "text",
  textAlign: "text",
  glyph: "icon",
} as const satisfies Record<InstanceOverride["field"], LayerKind>;

/** What a layer is, for an override: a box, the root or a frame, or another layer's kind. */
type LayerKind = "box" | Exclude<ChildLayerSpec["kind"], "frame">;

function kindOf(layer: BoxSpec | ChildLayerSpec): LayerKind {
  return !("kind" in layer) || layer.kind === "frame" ? "box" : layer.kind;
}

/** The properties of the inner set an instance can set, by the spec's group and Figma's type. */
const PROPERTY_GROUPS = [
  { group: "text", type: "TEXT" },
  { group: "boolean", type: "BOOLEAN" },
  { group: "swap", type: "INSTANCE_SWAP" },
] as const;

function propertyNames(
  set: ComponentSetSpec,
  type: (typeof PROPERTY_GROUPS)[number]["type"]
): readonly string[] {
  const properties =
    type === "TEXT"
      ? set.textProperties
      : type === "BOOLEAN"
        ? (set.booleanProperties ?? [])
        : set.swapProperties;
  return properties.map((property) => property.name);
}

/** Refuse a property an instance sets that the inner set lacks, or defines as another type. */
function checkInstanceProperties(
  where: string,
  layer: InstanceLayerSpec,
  inner: ComponentSetSpec,
  icons: KitSpec["icons"]
): void {
  for (const { group, type } of PROPERTY_GROUPS) {
    for (const [name, value] of Object.entries(layer.properties?.[group] ?? {})) {
      if (propertyNames(inner, type).includes(name)) {
        if (group === "swap" && !icons.icons.some((icon) => icon.key === value)) {
          throw contradiction(
            `${where} swaps ${name} to ${String(value)}, which the kit's icon library lacks.`
          );
        }
        continue;
      }
      const other = PROPERTY_GROUPS.find((candidate) => propertyNames(inner, candidate.type).includes(name));
      throw contradiction(
        other === undefined
          ? `${where} sets the property ${name}, which ${inner.name} does not define.`
          : `${where} sets ${name} as a ${type} property, which ${inner.name} defines as a ${other.type} property.`
      );
    }
  }
}

/**
 * Refuse a nested value the plugin cannot set: one at a path the inner variant lacks, through an
 * instance that is not exposed, which Figma lists in no `exposedInstances` (N5, PN), ending at a layer
 * that is no instance, or for a TEXT property the nested set does not define.
 */
function checkNestedValues(where: string, layer: InstanceLayerSpec, shown: VariantSpec, kit: KitSpec): void {
  for (const nested of layer.properties?.nested ?? []) {
    const at = `${where} gives a nested value at ${nested.path.join(" / ")}`;
    let root: ComponentRootSpec = shown.root;
    let rootKey = shown.key;
    let pending: string[] = [];
    let target: ComponentSetSpec | undefined;
    for (const key of nested.path) {
      pending = [...pending, key];
      const found = layerAt(root, pending);
      if (found === undefined) {
        throw contradiction(`${at}, which ${rootKey} lacks.`);
      }
      if ("kind" in found && found.kind === "instance") {
        if (found.exposed !== true) {
          throw contradiction(`${at}, and ${key} is not exposed, so a designer could not set it either.`);
        }
        target = kit.componentSets.find((set) => set.key === found.componentSet);
        const variant = target?.variants.find((candidate) => candidate.key === found.variant);
        if (variant === undefined) {
          throw contradiction(`${at}, whose ${key} shows ${found.variant}, which the kit does not define.`);
        }
        root = variant.root;
        rootKey = variant.key;
        pending = [];
      } else if ("kind" in found && found.kind !== "frame") {
        throw contradiction(`${at}, which is no instance.`);
      }
    }
    if (pending.length > 0 || target === undefined) {
      throw contradiction(`${at}, which is no instance.`);
    }
    const defined = propertyNames(target, "TEXT");
    const unknown = Object.keys(nested.text).find((name) => !defined.includes(name));
    if (unknown !== undefined) {
      throw contradiction(`${at} for ${unknown}, which ${target.name} does not define as a TEXT property.`);
    }
  }
}

/**
 * Refuse an instance layer the plugin cannot plan: an instance of its own set, of a set the kit lists
 * later or not at all, or of a variant the inner set lacks, a property the inner set lacks or defines
 * as another type, a swap to an icon the library lacks, and an override at a path the inner variant
 * lacks, on a layer that takes no such override, or of a field another override of the same layer
 * sets, since the plugin compares each with what the layer holds and would write them in turn. The
 * plugin plans the sets in kit order, so an instance's variant exists by the time its set is planned,
 * and a later set or a cycle cannot.
 */
function checkInstances(kit: KitSpec): void {
  const order = new Map(kit.componentSets.map((set, index) => [set.key, index]));
  kit.componentSets.forEach((set, index) => {
    for (const variant of set.variants) {
      for (const layer of walkLayers(variant.root)) {
        if (layer.kind !== "instance") {
          continue;
        }
        const where = `${set.name}: ${layer.name} in the variant ${variant.key}`;
        const at = order.get(layer.componentSet);
        const inner = at === undefined ? undefined : kit.componentSets[at];
        if (at === undefined || inner === undefined) {
          throw contradiction(`${where} shows ${layer.componentSet}, which the kit does not define.`);
        }
        if (at === index) {
          throw contradiction(`${where} is an instance of its own set.`);
        }
        if (at > index) {
          throw contradiction(
            `${where} shows ${inner.name}, which the kit lists after ${set.name}, and the plugin plans the sets in kit order.`
          );
        }
        const shown = inner.variants.find((candidate) => candidate.key === layer.variant);
        if (shown === undefined) {
          throw contradiction(`${where} shows ${layer.variant}, which ${inner.name} does not define.`);
        }
        checkInstanceProperties(where, layer, inner, kit.icons);
        checkNestedValues(where, layer, shown, kit);
        const overridden = new Set<string>();
        for (const override of layer.overrides ?? []) {
          const target = layerAt(shown.root, override.path);
          const path = override.path.length === 0 ? "the root" : override.path.join(" / ");
          const field = JSON.stringify([...override.path, override.field]);
          if (overridden.has(field)) {
            throw contradiction(
              `${where} overrides the ${override.field} of ${path} twice, and the plugin would write each in turn on every run.`
            );
          }
          overridden.add(field);
          if (target === undefined) {
            throw contradiction(`${where} overrides ${path}, which ${inner.name} ${layer.variant} lacks.`);
          }
          const kind = kindOf(target);
          if (kind !== OVERRIDE_TARGETS[override.field]) {
            throw contradiction(
              `${where} overrides the ${override.field} of ${path}, a ${kind}, which takes none.`
            );
          }
        }
      }
    }
  });
}

/**
 * Refuse a label that shows a glyph the kit's glyph font draws where the plugin cannot draw it so: a
 * glyph that is more than one UTF-16 code unit, a label whose family is a literal, a label whose size
 * or line height binds a variable, and a nested TEXT value. The plugin draws each glyph range in the
 * glyph font, unbound, and keeps the label's other characters bound to its family variable,
 * `font-sans` in the kit (G2), so a label holds exactly those two families. A literal family would
 * leave two literal fonts that follow no theme. A whole size binding gives a glyph range its value
 * but not the binding (G12b), and no probe shows a Plan over such a label converging. The plugin
 * plans no ranges on a label a nested value sets.
 */
function checkGlyphs(kit: KitSpec): void {
  const { glyphFont } = kit;
  const long = glyphFont.glyphs.find((glyph) => glyph.length !== 1);
  if (long !== undefined) {
    throw contradiction(
      `The kit draws ${long} in ${glyphFont.family}, and a glyph range holds one UTF-16 code unit.`
    );
  }
  const shows = (characters: string): boolean => glyphRanges(characters, glyphFont).length > 0;
  const refuseLabel = (where: string, label: TextLayerSpec): void => {
    if (label.fontFamily.kind !== "variable") {
      throw contradiction(
        `${where} shows a glyph the kit draws in ${glyphFont.family}, and its label ${label.name} sets a literal family, where the plugin keeps the other characters bound to a family variable.`
      );
    }
    for (const [field, spec] of [
      ["size", label.fontSize],
      ["line height", label.lineHeight],
    ] as const) {
      if (spec.kind === "variable") {
        throw contradiction(
          `${where} shows a glyph the kit draws in ${glyphFont.family}, and its label ${label.name} binds its ${field} to a variable, which a whole binding gives the glyph ranges unbound (G12b), and no probe shows a Plan over such a label converging.`
        );
      }
    }
  };
  for (const set of kit.componentSets) {
    for (const variant of set.variants) {
      for (const layer of walkLayers(variant.root)) {
        const where = `${set.name}: ${layer.name} in the variant ${variant.key}`;
        if (layer.kind === "text" && shows(layer.characters)) {
          refuseLabel(where, layer);
        }
        if (layer.kind !== "instance") {
          continue;
        }
        const inner = kit.componentSets
          .find((candidate) => candidate.key === layer.componentSet)
          ?.variants.find((candidate) => candidate.key === layer.variant);
        for (const [name, value] of Object.entries(layer.properties?.text ?? {})) {
          for (const label of inner === undefined || !shows(value) ? [] : walkLayers(inner.root)) {
            if (label.kind === "text" && label.textProperty === name) {
              refuseLabel(where, label);
            }
          }
        }
        for (const nested of layer.properties?.nested ?? []) {
          if (Object.values(nested.text).some(shows)) {
            throw contradiction(
              `${where} gives a nested value at ${nested.path.join(" / ")} a glyph the kit draws in ${glyphFont.family}, and the plugin draws no glyph range through a nested value.`
            );
          }
        }
      }
    }
  }
}

/** The signature every PNG file opens with (PNG specification §5.2). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The IHDR chunk's type, `IHDR`, which follows its 4-byte length, 13, after the signature. */
const IHDR = [0x49, 0x48, 0x44, 0x52];

/** The signature and the whole IHDR chunk: 8 bytes, then 4 of length, 4 of type, 13 of data and 4 of CRC. */
const PNG_HEADER_LENGTH = 33;

/** The longest side, in pixels, of an image Figma's `createImage` reference says it stores. */
const MAX_IMAGE_SIDE = 4096;

/**
 * What stops Figma from storing the bytes, or undefined where nothing does. The kit ships PNG alone.
 * On 2026-10-22 a real file stored the first 100 bytes of a PNG and refused its signature alone
 * (P9b), so Figma reads the header: the signature and the IHDR chunk, which holds the width and
 * height (PNG specification §11.2.2). No probe ran past the 4096px the reference states.
 */
function unstorable(bytes: Uint8Array): string | undefined {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return "an image that is no PNG file, the one format the kit ships";
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length < PNG_HEADER_LENGTH ||
    view.getUint32(8) !== 13 ||
    !IHDR.every((byte, index) => bytes[12 + index] === byte)
  ) {
    return "a PNG whose header stops before a whole IHDR chunk";
  }
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if ([width, height].some((side) => side < 1 || side > MAX_IMAGE_SIDE)) {
    return `a ${width} × ${height} image, and Figma stores images from 1 to ${MAX_IMAGE_SIDE} pixels on a side`;
  }
  return undefined;
}

/**
 * Refuse an image fill Figma cannot store, or whose hash is not the SHA-1 of its bytes, the hash
 * Figma names the stored image by (P9b). A new node stores its image only when the operation that
 * creates it runs, after earlier writes, so the check refuses such a fill before the first write.
 */
function checkImages(decodeBase64: (text: string) => Uint8Array, set: ComponentSetSpec): void {
  for (const variant of set.variants) {
    for (const { box, name } of boxesOf(variant)) {
      if (box.fill?.kind !== "image") {
        continue;
      }
      const where = `${set.name}: ${name} in the variant ${variant.key} fills with`;
      const bytes = decodeBase64(box.fill.bytes);
      const problem = unstorable(bytes);
      if (problem !== undefined) {
        throw contradiction(`${where} ${problem}.`);
      }
      const hash = sha1Hex(bytes);
      if (hash !== box.fill.hash) {
        throw contradiction(
          `${where} an image whose bytes hash to ${hash}, where the kit names ${box.fill.hash}. Build the plugin again.`
        );
      }
    }
  }
}

/** Refuse a preview that places a set the kit lacks, a set from another page or a variant the set lacks. */
function checkPreviews(kit: KitSpec): void {
  for (const preview of kit.previews) {
    for (const group of preview.groups) {
      const set = kit.componentSets.find((candidate) => candidate.key === group.componentSet);
      if (set === undefined) {
        throw contradiction(
          `${preview.name} places variants of ${group.componentSet}, which the kit does not define.`
        );
      }
      if (set.page !== preview.page) {
        throw contradiction(`${preview.name} places ${set.name}, which sits on another page.`);
      }
      const variants = new Set(set.variants.map((variant) => variant.key));
      for (const variant of group.variants) {
        if (!variants.has(variant)) {
          throw contradiction(`${preview.name} places ${variant}, which ${set.name} does not define.`);
        }
      }
    }
  }
}

/**
 * Check the kit against itself.
 *
 * @param kit - The kit.
 * @param decodeBase64 - Decodes an image fill's bytes. The plugin passes `figma.base64Decode`, and
 *   the build passes Node's decoder.
 * @returns Nothing, or the first contradiction the check finds.
 */
export function checkKitSpec(
  kit: KitSpec,
  decodeBase64: (text: string) => Uint8Array
): Result.Result<void, KitContradiction> {
  try {
    const pages = new Set<string>();
    for (const page of kit.pages) {
      if (pages.has(page.key)) {
        throw contradiction(`The kit lists the page key ${page.key} twice.`);
      }
      pages.add(page.key);
    }
    for (const { name, page } of topLevelSpecs(kit)) {
      if (!pages.has(page)) {
        throw contradiction(`${name} sits on the page ${page}, which the kit does not list.`);
      }
    }
    for (const set of kit.componentSets) {
      checkComponentSet(set);
      checkSizing(set);
      checkRotations(set);
      checkStacking(set);
      checkImages(decodeBase64, set);
    }
    checkInstances(kit);
    checkGlyphs(kit);
    checkPreviews(kit);
    return Result.succeed(undefined);
  } catch (thrown) {
    if (thrown instanceof KitContradiction) {
      return Result.fail(thrown);
    }
    throw thrown;
  }
}
