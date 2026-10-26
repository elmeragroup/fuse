/**
 * Paints, effects, strokes and images: how the file stores a paint or an effect and its bindings,
 * where a drop shadow's spread draws, the images it stores by hash, and which layer paints above
 * another.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 1. `setBoundVariableForPaint` returns the paint with its opacity set to the alpha of the bound
 *    COLOR variable in the collections' default modes, whatever opacity it was given. Two runs
 *    on a real file on 2026-10-19 wrote `error` at 10% and read it back at 100%.
 * 2. Assigning `effects`: an effect whose color binding is new to the node stores the value the
 *    variable takes in the node. An effect written with a color binding the node already held
 *    keeps the color written. On a real file on 2026-10-20, 28 focus rings bound to `ring`
 *    kept the black an earlier run wrote. A radius or spread binding keeps the value written.
 * 3. A drop shadow's spread draws only on a frame, component or instance that clips its content
 *    and has a visible fill, one with `visible` not false and an opacity above 0. On a real file
 *    on 2026-10-20 the ghost and link focus rings drew nothing over a fill at alpha 0, and a test
 *    frame drew its ring once the fill reached 0.001. The typings' `DropShadowEffect.spread`
 *    says the same. {@link drawsShadowSpread} reports it, and the stored spread stays as written.
 * 22. `createImage` stores an image under the SHA-1 of its bytes in lowercase hex, and
 *    `getImageByHash` finds it there. On 2026-10-22 a real file decoded a PNG with `base64Decode`,
 *    gave Avatar's portrait the hash `shasum -a 1` gives its bytes, found the image by that hash, and
 *    returned null for an unknown one (P9, P9b). It stored the portrait's first 100 bytes and
 *    refused its 8-byte signature alone with `in createImage: Image type is unsupported` (P9b), so
 *    Figma reads the header, not the whole file. The fake stores bytes that open with a PNG
 *    signature and a whole IHDR chunk, and throws that error for any other bytes. No probe stored
 *    a JPEG or a GIF, a PNG cut inside its IHDR chunk, or one over the 4096px the reference states,
 *    so the fake takes the narrow reading. Storing an image changes the file, though an image is no
 *    node, so the fake logs it as a write, and a Plan that stores one fails a check for no writes.
 * 23. An IMAGE paint reads back with Figma's defaults filled in. On 2026-10-22 a real file read a
 *    written `{ type: 'IMAGE', scaleMode: 'FILL', imageHash }` back with `visible` true, `opacity`
 *    1, `blendMode` NORMAL, `scalingFactor` 1, `rotation` 0, every filter at 0, the identity
 *    `imageTransform` and the same hash, and read the same after that readback was written again
 *    (P9). No probe wrote a hash the file holds no image for, so the fake throws for one.
 * 27. `dashPattern` holds a stroke's dash and gap lengths apart from its paints. On 2026-10-22 a
 *    real file kept `[4, 4]` on a frame with a 1px SOLID stroke, kept it once the stroke's color
 *    was bound to `border` through `setBoundVariableForPaint` and written back, took `[2, 2]` with
 *    the binding kept, and cleared it with `[]` (PD). So writing `strokes` leaves the pattern, and
 *    writing the pattern leaves the paints. No probe wrote a pattern of odd length or a length that
 *    is not positive, so the fake stores any list as written, each length a 32-bit float.
 * 33. An auto layout paints a later child above an earlier one, and its first child on top when
 *    `itemReverseZIndex` is true, which reads back as written. On 2026-10-23 a vertical stack's
 *    filled panel painted over the bottom edge of a 2px ring its header held, and with the field true
 *    the ring was whole (PZ2). `paintsAbove` says which of two layers paints on top. Only a vertical
 *    stack was probed, so the fake refuses the field true on any other frame.
 * 46. A stroke's weight on each side. On 2026-10-23 a fixed column took a stroke bound to `border`
 *    with weights top 0, right 1, bottom 0 and left 0, INSIDE, and `strokesIncludedInLayout` false:
 *    `strokeWeight` read mixed, and a filling child took the column's full 120 (N9). On 2026-10-25
 *    columns padded 10 on the left and right around a 50 × 20 child took per-side weights (PS). With
 *    `strokesIncludedInLayout` true each side's weight took room on its own side: a left weight of 1
 *    hugged the column to 71 wide with the child at x 11, and a top weight of 2 hugged it to 22 tall.
 *    With false the stroke took none, at 70 × 20. So the fake writes each side alone once the weight
 *    was written (rule 49), reads `strokeWeight` mixed while the sides differ, and the frames it lays
 *    out (rule 32) keep each side's weight clear beside the padding while the stroke counts in the
 *    layout. It places no child.
 * 49. A 0 side weight on a stroke whose weight was never written. On 2026-10-25 the owner's Apply wrote
 *    sides top 0, right 0 and bottom 0 on a new Sidebar sub menu variant and left the left side, which
 *    read the default 1, and the file read every side 0. Frames, auto layout frames and components
 *    whose `strokeWeight` was never written read `[1,1,1,1]`, and top 0 turned them to `[0,0,0,0]`,
 *    with a plain or a bound stroke. After an explicit `strokeWeight`, or after that spill, each side
 *    wrote alone: from `[1,1,1,1]` top 0 read `[0,1,1,1]`, and from `[0,0,0,0]` left 1 read `[0,0,0,1]`
 *    (PS2). So the fake spills the first 0 to every side, then writes each side alone, and throws for a
 *    nonzero side written first, which no probe read. A side binding neither spills nor counts as a
 *    write, which no probe read either.
 */

import { sha1Hex } from "../../../src/components/sha1.ts";
import { guard } from "./guard.ts";
import { noteOverride, shown } from "./overrides.ts";
import { EFFECT_FIELD_TYPES, f32, live, MIXED, storeRgba, write } from "./state.ts";
import type { FileState, NodeState, Sides } from "./state.ts";
import { childrenOf } from "./tree.ts";
import { alias, fileVariable, requireType, resolveColor, variableState } from "./variables.ts";

/** The filters of an image paint, each at the 0 a real file read back where none was written (rule 23). */
const NO_IMAGE_FILTERS: Required<ImageFilters> = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
};

/**
 * A paint as Figma stores it: 32-bit channels and the documented defaults filled in, and an image
 * paint with the defaults a real file read back (rule 23).
 */
export function storePaint(file: FileState, paint: Paint): Paint {
  if (paint.type === "IMAGE") {
    if (paint.imageHash === null || !file.images.has(paint.imageHash)) {
      throw new Error(
        `The fake Figma file holds no image ${String(paint.imageHash)}, and does not model a paint of an image it lacks.`
      );
    }
    return {
      visible: true,
      blendMode: "NORMAL",
      scalingFactor: 1,
      rotation: 0,
      imageTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      ...paint,
      opacity: f32(paint.opacity ?? 1),
      filters: { ...NO_IMAGE_FILTERS, ...paint.filters },
    };
  }
  if (paint.type !== "SOLID") {
    return paint;
  }
  return {
    ...paint,
    color: { r: f32(paint.color.r), g: f32(paint.color.g), b: f32(paint.color.b) },
    opacity: f32(paint.opacity ?? 1),
    visible: paint.visible ?? true,
    blendMode: paint.blendMode ?? "NORMAL",
  };
}

/** The variable ids an effect list binds to shadow colors. */
export function heldColorBindings(effects: readonly Effect[]): ReadonlySet<string> {
  return new Set(
    effects.flatMap((effect) =>
      (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") &&
      effect.boundVariables?.color !== undefined
        ? [effect.boundVariables.color.id]
        : []
    )
  );
}

/** An effect as the node stores it under rule 2. */
export function storeEffect(state: NodeState, effect: Effect, held: ReadonlySet<string>): Effect {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    return effect;
  }
  const bound = effect.boundVariables?.color?.id;
  const color =
    bound === undefined || held.has(bound)
      ? effect.color
      : resolveColor(state.file, variableState(state.file, bound), state);
  return {
    ...effect,
    color: storeRgba(color),
    offset: { x: f32(effect.offset.x), y: f32(effect.offset.y) },
    radius: f32(effect.radius),
    spread: f32(effect.spread ?? 0),
  };
}

/**
 * Write one side's stroke weight (rule 49). On a node whose weight was never written, a 0 sets every
 * side to 0, and a nonzero weight throws, as no probe read one.
 */
export function writeStrokeSide(state: NodeState, side: keyof Sides, value: number): void {
  const weight = f32(value);
  if (state.strokeWeightWritten) {
    state.strokeWeights[side] = weight;
    return;
  }
  if (weight !== 0) {
    throw new Error(
      `The fake Figma file does not model a nonzero ${side} weight on a never-written stroke weight (PS2).`
    );
  }
  state.strokeWeights = { top: 0, right: 0, bottom: 0, left: 0 };
  state.strokeWeightWritten = true;
}

const BASE64_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard base64 with padding, as `figma.base64Encode` returns it. */
export function base64Encode(data: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < data.length; index += 3) {
    const bits = ((data[index] ?? 0) << 16) | ((data[index + 1] ?? 0) << 8) | (data[index + 2] ?? 0);
    const digit = (shift: number) => BASE64_DIGITS.charAt((bits >> shift) & 63);
    encoded += digit(18) + digit(12);
    encoded += index + 1 < data.length ? digit(6) : "=";
    encoded += index + 2 < data.length ? digit(0) : "=";
  }
  return encoded;
}

/** Standard base64, with or without padding, decoded as `figma.base64Decode` decodes it (rule 22). */
export function base64Decode(data: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let count = 0;
  for (const char of data.replace(/=+$/, "")) {
    const digit = BASE64_DIGITS.indexOf(char);
    if (digit < 0) {
      throw new Error(`The fake Figma file decodes standard base64, which has no ${char}.`);
    }
    bits = (bits << 6) | digit;
    count += 6;
    if (count >= 8) {
      count -= 8;
      bytes.push((bits >> count) & 0xff);
      bits &= (1 << count) - 1;
    }
  }
  return Uint8Array.from(bytes);
}

/**
 * The bytes a PNG file opens with: its signature, then the IHDR chunk's length, 13, and its type
 * (PNG specification §5.2, §11.2.2). The chunk's 13 bytes of data and its CRC follow.
 */
const PNG_HEADER_START = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
];

/** The signature and the whole IHDR chunk: 8 bytes, then 4 of length, 4 of type, 13 of data and 4 of CRC. */
const PNG_HEADER_LENGTH = 33;

/** An image the file stores, which a paint names by its hash. It is no node. */
export function exposeImage(hash: string): Image {
  // SAFETY: the object models the image member the plugin reads, and the guard throws for every
  // other member.
  return guard({ hash }, "Image") as Image;
}

/** Store an image's bytes under their SHA-1, refusing bytes without a whole PNG header (rule 22). */
export function createImage(file: FileState, bytes: Uint8Array): Image {
  const header =
    bytes.length >= PNG_HEADER_LENGTH && PNG_HEADER_START.every((byte, index) => bytes[index] === byte);
  if (!header) {
    throw new Error("in createImage: Image type is unsupported");
  }
  const hash = sha1Hex(bytes);
  file.images.add(hash);
  file.writes.push(`store the image ${hash}`);
  return exposeImage(hash);
}

/** Write a layer's fills, an override on an instance or a sublayer (rule 37). */
export function writeFills(state: NodeState, paints: ReadonlyArray<Paint> | PluginAPI["mixed"]): void {
  if (paints === MIXED) {
    throw new Error("Cannot write figma.mixed as fills.");
  }
  write(state, "fills");
  state.fills = paints.map((paint) => storePaint(state.file, paint));
  noteOverride(state, "fills");
}

/** Rule 1: a bound paint takes the variable's alpha, in the default modes, as its opacity. */
export function bindPaint(file: FileState, paint: SolidPaint, variable: Variable | null): SolidPaint {
  if (variable === null) {
    const { boundVariables: _unbound, ...unbound } = paint;
    return unbound;
  }
  const bound = fileVariable(file, variable);
  requireType(bound, "COLOR", "a paint's color");
  const { r, g, b, a } = resolveColor(file, bound, undefined);
  return { ...paint, color: { r, g, b }, opacity: a, boundVariables: { color: alias(bound.id) } };
}

/** Bind a shadow's field. The value stays as written: rule 2 applies when the node stores it. */
export function bindEffect(
  file: FileState,
  effect: Effect,
  field: VariableBindableEffectField,
  variable: Variable | null
): Effect {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    throw new Error(`The fake Figma file does not model binding a ${effect.type}.`);
  }
  const { [field]: _previous, ...others } = effect.boundVariables ?? {};
  if (variable === null) {
    return { ...effect, boundVariables: others };
  }
  const bound = fileVariable(file, variable);
  requireType(bound, EFFECT_FIELD_TYPES.get(field) ?? "FLOAT", `a shadow's ${field}`);
  return { ...effect, boundVariables: { ...others, [field]: alias(bound.id) } };
}

/**
 * Whether Figma draws a drop shadow's spread on a node: a frame, component or instance that
 * clips its content and has a visible fill (rule 3).
 *
 * @param node - A node of a fake file.
 * @returns True when the node draws its shadows' spread.
 */
export function drawsShadowSpread(node: SceneNode): boolean {
  const state = live(node);
  return (
    (state.type === "FRAME" || state.type === "COMPONENT" || state.type === "INSTANCE") &&
    state.clipsContent &&
    shown(state, "fills").some((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0)
  );
}

/** A node and the layers that hold it, from the document down. */
function lineage(state: NodeState): readonly NodeState[] {
  return state.parent === undefined ? [state] : [...lineage(state.parent), state];
}

/**
 * Whether Figma paints one layer above another (rule 33). A layer paints above the frames that hold
 * it. Of two layers in different children of one frame, the one in the later child paints above,
 * or the one in the earlier child where the frame is an auto layout with `itemReverseZIndex` true.
 *
 * @param upper - A layer of a fake file.
 * @param lower - Another layer of the same file.
 * @returns True when `upper` paints above `lower`.
 */
export function paintsAbove(upper: SceneNode, lower: SceneNode): boolean {
  const above = lineage(live(upper));
  const below = lineage(live(lower));
  const split = above.findIndex((state, index) => below[index] !== state);
  if (split === -1 || split >= below.length) {
    return above.length > below.length;
  }
  const holder = above[split - 1];
  const upperChild = above[split];
  const lowerChild = below[split];
  if (holder === undefined || upperChild === undefined || lowerChild === undefined) {
    throw new Error("The fake Figma file compares only layers of one document.");
  }
  const children = childrenOf(holder);
  const later = children.indexOf(upperChild) > children.indexOf(lowerChild);
  const reversed = holder.layoutMode !== "NONE" && holder.itemReverseZIndex;
  return reversed ? !later : later;
}
