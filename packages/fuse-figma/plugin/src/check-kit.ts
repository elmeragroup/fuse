/**
 * The kit check, which opens every planning pass. It finds each error a later step of the
 * run could meet: a variable or mode the file lacks, a variable of the wrong type, image bytes
 * Figma cannot store or a hash they do not give, a turn or a stacking the plugin cannot draw, an
 * instance layer it cannot plan, or a spec that contradicts itself. An operation that creates a node
 * plans the node's contents when it runs, so those plans can then look up nothing that fails.
 */

import {
  coveredShadow,
  fixedLength,
  layerAt,
  topLevelSpecs,
  walkLayers,
} from "../../src/components/kit-spec.ts";
import type {
  BoxSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  FillSpec,
  InstanceLayerSpec,
  InstanceOverride,
  KitSpec,
  NumberSpec,
  StringSpec,
  VariableRef,
  VariantSpec,
} from "../../src/components/kit-spec.ts";
import { checkComponentSet } from "./component-set.ts";
import { variableLabel } from "./fields.ts";
import { PREVIEW_BACKGROUND } from "./previews.ts";
import { sha1Hex } from "./sha1.ts";
import type { KitVariables } from "./variables.ts";

/** A variable the kit binds, and the type the bound field needs. */
type BoundRef = {
  readonly ref: VariableRef;
  readonly type: VariableResolvedDataType;
};

function boundNumber(spec: NumberSpec | undefined): BoundRef[] {
  return spec?.kind === "variable" ? [{ ref: spec.variable, type: "FLOAT" }] : [];
}

function boundColor(spec: FillSpec | undefined): BoundRef[] {
  return spec?.kind === "variable" ? [{ ref: spec.variable, type: "COLOR" }] : [];
}

function boundString(spec: StringSpec): BoundRef[] {
  return spec.kind === "variable" ? [{ ref: spec.variable, type: "STRING" }] : [];
}

/** The variables a box's own fields bind, its layers left out. */
function boxRefs(box: BoxSpec): BoundRef[] {
  return [
    ...[
      fixedLength(box.sizing.horizontal),
      fixedLength(box.sizing.vertical),
      box.limits.minWidth,
      box.limits.maxWidth,
      box.limits.minHeight,
      box.limits.maxHeight,
      box.paddingTop,
      box.paddingRight,
      box.paddingBottom,
      box.paddingLeft,
      box.itemSpacing,
      box.cornerRadius,
      box.stroke?.weight,
      ...box.shadows.flatMap((shadow) => [shadow.radius, shadow.spread]),
    ].flatMap(boundNumber),
    ...[box.fill, box.stroke?.color, ...box.shadows.map((shadow) => shadow.color)].flatMap(boundColor),
  ];
}

/** The variables an instance override binds. */
function overrideRefs(override: InstanceOverride): BoundRef[] {
  switch (override.field) {
    case "cornerRadius":
      return boundNumber(override.value);
    case "effects":
      return override.shadows.flatMap((shadow) => [
        ...boundNumber(shadow.radius),
        ...boundNumber(shadow.spread),
        ...boundColor(shadow.color),
      ]);
    case "textAlign":
      return [];
    default:
      return boundColor(override.color);
  }
}

/** The variables one layer's own fields bind. A frame's layers come from the walk. */
function layerRefs(layer: ChildLayerSpec): BoundRef[] {
  switch (layer.kind) {
    case "text":
      return [
        ...boundString(layer.fontFamily),
        ...[
          layer.fontSize,
          layer.lineHeight.kind === "percent" ? undefined : layer.lineHeight,
          fixedLength(layer.sizing.horizontal),
          fixedLength(layer.sizing.vertical),
          layer.maxWidth,
        ].flatMap(boundNumber),
        ...boundColor(layer.color),
      ];
    case "icon":
      return [...boundNumber(layer.size), ...boundColor(layer.color)];
    case "frame":
      return boxRefs(layer);
    case "instance":
      return [
        ...[fixedLength(layer.sizing.horizontal), fixedLength(layer.sizing.vertical)].flatMap(boundNumber),
        ...(layer.overrides ?? []).flatMap(overrideRefs),
      ];
  }
}

function rootRefs(root: ComponentRootSpec): BoundRef[] {
  return [...boxRefs(root), ...walkLayers(root).flatMap(layerRefs)];
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
 * the flow that sets a length there, a fixed or hugging one or an icon, and collapses beside none.
 * Figma refuses FILL on an absolute layer, as a real file did on 2026-10-22 (P8).
 */
function checkBox(set: ComponentSetSpec, variant: VariantSpec, box: BoxSpec, name: string): void {
  for (const { axis, length, limits } of AXES) {
    const absolute = box.children.find(
      (child) => child.kind === "frame" && child.absolute !== undefined && child.sizing[axis].kind === "fill"
    );
    if (absolute !== undefined) {
      throw new Error(
        `${set.name}: ${absolute.name} in the variant ${variant.key} is absolute and fills its ${length}, and Figma refuses FILL on an absolute layer. Give it a fixed ${length}.`
      );
    }
    const limit =
      box.sizing[axis].kind === "fixed" ? limits.find((field) => box.limits[field] !== undefined) : undefined;
    if (limit !== undefined) {
      throw new Error(
        `${set.name}: ${name} in the variant ${variant.key} sets ${limit} on its fixed ${length}. Fold the limit into the ${length}, as CSS resolves a ${length} against its own limits.`
      );
    }
    const filling = box.children.find((child) => child.kind !== "icon" && child.sizing[axis].kind === "fill");
    if (filling === undefined || box.sizing[axis].kind !== "hug") {
      continue;
    }
    const across = (box.direction === "HORIZONTAL" ? "vertical" : "horizontal") === axis;
    if (!across) {
      throw new Error(
        `${set.name}: ${filling.name} in the variant ${variant.key} fills the ${length} of a parent that hugs it, so Figma would shrink it to its smallest ${length}.`
      );
    }
    const setsLength = box.children.some(
      (child) =>
        child.kind === "icon" ||
        (child.sizing[axis].kind !== "fill" && !(child.kind === "frame" && child.absolute !== undefined))
    );
    if (!setsLength) {
      throw new Error(
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
        throw new Error(
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
        throw new Error(
          `${where} has a rotation of ${rotation}, and the kit draws only half and quarter turns.`
        );
      }
      if (rotation % 180 !== 0 && !squareSides(layer)) {
        throw new Error(
          `${where} turns a quarter turn without two equal fixed sides, and Figma lays a turned layer out by its turned box, where CSS leaves the layout as it was.`
        );
      }
      if (layer.kind === "frame" && layer.absolute !== undefined) {
        throw new Error(
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
        throw new Error(
          `${where} puts its first layer on top in a row, and a real file drew that only in a column (PZ2).`
        );
      }
      const covered = coveredShadow(box.children);
      if (covered !== undefined) {
        throw new Error(
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
          throw new Error(`${where} swaps ${name} to ${String(value)}, which the kit's icon library lacks.`);
        }
        continue;
      }
      const other = PROPERTY_GROUPS.find((candidate) => propertyNames(inner, candidate.type).includes(name));
      throw new Error(
        other === undefined
          ? `${where} sets the property ${name}, which ${inner.name} does not define.`
          : `${where} sets ${name} as a ${type} property, which ${inner.name} defines as a ${other.type} property.`
      );
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
          throw new Error(`${where} shows ${layer.componentSet}, which the kit does not define.`);
        }
        if (at === index) {
          throw new Error(`${where} is an instance of its own set.`);
        }
        if (at > index) {
          throw new Error(
            `${where} shows ${inner.name}, which the kit lists after ${set.name}, and the plugin plans the sets in kit order.`
          );
        }
        const shown = inner.variants.find((candidate) => candidate.key === layer.variant);
        if (shown === undefined) {
          throw new Error(`${where} shows ${layer.variant}, which ${inner.name} does not define.`);
        }
        checkInstanceProperties(where, layer, inner, kit.icons);
        const overridden = new Set<string>();
        for (const override of layer.overrides ?? []) {
          const target = layerAt(shown.root, override.path);
          const path = override.path.length === 0 ? "the root" : override.path.join(" / ");
          const field = JSON.stringify([...override.path, override.field]);
          if (overridden.has(field)) {
            throw new Error(
              `${where} overrides the ${override.field} of ${path} twice, and the plugin would write each in turn on every run.`
            );
          }
          overridden.add(field);
          if (target === undefined) {
            throw new Error(`${where} overrides ${path}, which ${inner.name} ${layer.variant} lacks.`);
          }
          const kind = kindOf(target);
          if (kind !== OVERRIDE_TARGETS[override.field]) {
            throw new Error(
              `${where} overrides the ${override.field} of ${path}, a ${kind}, which takes none.`
            );
          }
        }
      }
    }
  });
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
function checkImages(figma: PluginAPI, set: ComponentSetSpec): void {
  for (const variant of set.variants) {
    for (const { box, name } of boxesOf(variant)) {
      if (box.fill?.kind !== "image") {
        continue;
      }
      const where = `${set.name}: ${name} in the variant ${variant.key} fills with`;
      const bytes = figma.base64Decode(box.fill.bytes);
      const problem = unstorable(bytes);
      if (problem !== undefined) {
        throw new Error(`${where} ${problem}.`);
      }
      const hash = sha1Hex(bytes);
      if (hash !== box.fill.hash) {
        throw new Error(
          `${where} an image whose bytes hash to ${hash}, where the kit names ${box.fill.hash}. Build the plugin again.`
        );
      }
    }
  }
}

/**
 * Every variable the run binds: the sets', the icon library's glyph color, and the background
 * the previews and the library paint.
 */
function boundRefs(kit: KitSpec): BoundRef[] {
  const refs = kit.componentSets.flatMap((set) => set.variants.flatMap((variant) => rootRefs(variant.root)));
  return [...refs, ...boundColor(kit.icons.color), { ref: PREVIEW_BACKGROUND, type: "COLOR" }];
}

/**
 * The collections the run reads, through the variables it binds and the modes the previews
 * pin.
 *
 * @param kit - The kit.
 * @returns The collection names.
 */
export function kitCollections(kit: KitSpec): ReadonlySet<string> {
  return new Set([
    ...boundRefs(kit).map(({ ref }) => ref.collection),
    ...kit.previews.flatMap((preview) => preview.modes.map((mode) => mode.collection)),
  ]);
}

/**
 * Check the kit against itself and against the file's variables. The planning pass calls this
 * before it records any operation.
 *
 * @param figma - The plugin API, which decodes the kit's images.
 * @param variables - The file's variables.
 * @param kit - The kit.
 * @throws When the file lacks a variable or mode the kit names, a variable has the wrong type,
 *   an image fill holds bytes Figma cannot store or a hash that is not their SHA-1, or the spec contradicts itself,
 *   such as a page key listed twice, a node on a page the kit does not list, a preview that places
 *   a set from another page, an instance the plugin cannot plan, or a fill, limit, turn or stacking
 *   Figma cannot draw.
 */
export function checkKit(figma: PluginAPI, variables: KitVariables, kit: KitSpec): void {
  const pages = new Set<string>();
  for (const page of kit.pages) {
    if (pages.has(page.key)) {
      throw new Error(`The kit lists the page key ${page.key} twice.`);
    }
    pages.add(page.key);
  }
  for (const { name, page } of topLevelSpecs(kit)) {
    if (!pages.has(page)) {
      throw new Error(`${name} sits on the page ${page}, which the kit does not list.`);
    }
  }
  for (const set of kit.componentSets) {
    checkComponentSet(set);
    checkSizing(set);
    checkRotations(set);
    checkStacking(set);
    checkImages(figma, set);
  }
  checkInstances(kit);
  for (const preview of kit.previews) {
    for (const group of preview.groups) {
      const set = kit.componentSets.find((candidate) => candidate.key === group.componentSet);
      if (set === undefined) {
        throw new Error(
          `${preview.name} places variants of ${group.componentSet}, which the kit does not define.`
        );
      }
      if (set.page !== preview.page) {
        throw new Error(`${preview.name} places ${set.name}, which sits on another page.`);
      }
      const variants = new Set(set.variants.map((variant) => variant.key));
      for (const variant of group.variants) {
        if (!variants.has(variant)) {
          throw new Error(`${preview.name} places ${variant}, which ${set.name} does not define.`);
        }
      }
    }
    for (const ref of preview.modes) {
      variables.mode(ref);
    }
  }
  for (const { ref, type } of boundRefs(kit)) {
    const variable = variables.variable(ref);
    if (variable.resolvedType !== type) {
      throw new Error(
        `${variableLabel(ref)} is a ${variable.resolvedType} variable, and the kit binds it to a field that takes a ${type}. Run \`figma:sync\` on this file first.`
      );
    }
  }
}
