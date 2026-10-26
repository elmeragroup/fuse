/**
 * Field planners. Each compares a node field with its spec and records an operation only when
 * they differ, so a second run over an applied file plans nothing. A bound field counts as
 * equal when it binds the same variable. A literal field counts as equal when no variable
 * binds it and the value matches within the precision Figma stores, which is a 32-bit
 * float. A planner looks up every variable and builds every paint before it records the
 * operation, so the operation only assigns. An image paint's operation also stores the image the
 * paint names, first, so Plan stores nothing.
 */

import type {
  ColorSpec,
  DirectionSpec,
  FillSpec,
  GlyphFontSpec,
  ImagePaintSpec,
  LimitsSpec,
  NumberSpec,
  RgbaSpec,
  ShadowSpec,
  SizeSpec,
  VariableRef,
} from "../../src/components/kit-spec.ts";
import { change, changeTogether } from "./plan.ts";
import type { PlanRecorder } from "./plan.ts";
import type { KitVariables } from "./variables.ts";

/**
 * What every planner needs: the plugin API, the file's variables, the run's plan, and the kit's glyph
 * font, which a text planner gives its glyph ranges.
 */
export type Run = {
  readonly figma: PluginAPI;
  readonly variables: KitVariables;
  readonly plan: PlanRecorder;
  readonly glyphFont: GlyphFontSpec;
};

/**
 * The run with another plan, such as the plan of a group or of a new node's contents. The run's
 * other members stay, so a nested planner reads the same file, variables and glyph font.
 *
 * @param run - The run.
 * @param plan - The plan the nested planner records into.
 * @returns The nested planner's run.
 */
export function withPlan(run: Run, plan: PlanRecorder): Run {
  return { figma: run.figma, variables: run.variables, plan, glyphFont: run.glyphFont };
}

/**
 * Record the writes a group plans as one operation, as `changeTogether` does, for a planner that
 * takes a run.
 *
 * @param run - The run.
 * @param label - The node the group touches.
 * @param build - Plans the group's writes with the group's run.
 * @param finish - Runs after the group's writes.
 */
export function changeTogetherIn(
  run: Run,
  label: string,
  build: (group: Run) => void,
  finish: () => void
): void {
  changeTogether(run.plan, label, (plan) => build(withPlan(run, plan)), finish);
}

/**
 * A number field of a node. Some spec fields cover several Figma fields, such as a corner
 * radius that binds all four corners.
 */
export type NumberField = {
  readonly name: string;
  readonly bindings: readonly VariableBindableNodeField[];
  readonly matches: (value: number) => boolean;
  readonly write: (value: number) => void;
};

/**
 * Whether two numbers agree within what a 32-bit float keeps.
 *
 * @param left - One value.
 * @param right - The other value.
 * @returns True when they differ by less than a hundredth.
 */
export function near(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

/** Colors and opacities live in 0 to 1, so they need a finer tolerance than pixels. */
function nearUnit(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

/**
 * A short label for a number spec in a change line.
 *
 * @param spec - The spec.
 * @returns The variable name or the rounded pixels.
 */
export function describeNumber(spec: NumberSpec): string {
  return spec.kind === "variable" ? spec.variable.name : String(Math.round(spec.value * 100) / 100);
}

/**
 * A short label for a color spec in a change line.
 *
 * @param spec - The spec.
 * @returns The variable name, or the literal color.
 */
function describeColor(spec: ColorSpec): string {
  return spec.kind === "variable" ? spec.variable.name : describeRgba(spec.color, spec.color.a);
}

function describeRgba(color: RGB, alpha: number): string {
  if (alpha === 0) {
    return "transparent";
  }
  const channel = (value: number): string =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  // A root's near-clear fill, alpha 0.0015, would round to 0% and read as transparent.
  const percent = alpha < 0.01 ? (alpha * 100).toFixed(2) : String(Math.round(alpha * 100));
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)} at ${percent}%`;
}

/**
 * An image paint for a change line: the start of its image's hash, which tells two images apart,
 * its scale mode, and its opacity where that is not full.
 */
function describeImage(paint: ImagePaint): string {
  const opacity = paint.opacity ?? 1;
  const faded = nearUnit(opacity, 1) ? "" : ` at ${Math.round(opacity * 100)}%`;
  return `image ${paint.imageHash?.slice(0, 8) ?? "none"} at ${paint.scaleMode}${faded}`;
}

/**
 * What a node holds, for a change line. A bound paint shows as `variable`, because the paint
 * planner only reads a binding's id. A bound shadow also shows the color Figma stores, which
 * the shadow planner compares. A mismatch after an apply shows what Figma kept.
 */
function describeHeldPaint(paint: Paint): string {
  if (paint.type !== "SOLID" && paint.type !== "IMAGE") {
    return paint.type;
  }
  const shown =
    paint.type === "IMAGE"
      ? describeImage(paint)
      : paint.boundVariables?.color === undefined
        ? describeRgba(paint.color, paint.opacity ?? 1)
        : `variable at ${Math.round((paint.opacity ?? 1) * 100)}%`;
  const hidden = paint.visible === false ? ", hidden" : "";
  const blend = (paint.blendMode ?? "NORMAL") === "NORMAL" ? "" : `, ${paint.blendMode}`;
  return `${shown}${hidden}${blend}`;
}

function describeHeldEffect(effect: Effect): string {
  if (effect.type !== "DROP_SHADOW") {
    return effect.type;
  }
  const stored = describeRgba(effect.color, effect.color.a);
  const color = effect.boundVariables?.color === undefined ? stored : `variable, stored ${stored},`;
  return `${color} ${effect.offset.x} ${effect.offset.y} ${effect.radius} ${effect.spread ?? 0}`;
}

function describeHeld<Item>(items: readonly Item[], describe: (item: Item) => string): string {
  return items.length === 0 ? "none" : items.map(describe).join(", ");
}

/**
 * A short label for a variable in a warning.
 *
 * @param ref - The variable.
 * @returns `collection/name`.
 */
export function variableLabel(ref: VariableRef): string {
  return `${ref.collection}/${ref.name}`;
}

/**
 * What a planner compares the spec with. `read` compares it with the node as the planning pass
 * reads it. `unknown` records the write whatever the node reads, for a field that an earlier
 * operation of the run changes in a way the pass cannot read ahead, as a direction change moves a
 * hug or a fill to the other axis and resizes the box.
 */
export type Held = "read" | "unknown";

/**
 * Plan one number field against its spec.
 *
 * @param run - The run.
 * @param node - The node that owns the field.
 * @param label - The node's label, for change lines.
 * @param field - The field.
 * @param spec - The value the field should hold.
 * @param held - Whether to compare with what the node holds, or write the field whatever it holds.
 */
export function planNumber(
  run: Run,
  node: SceneNode,
  label: string,
  field: NumberField,
  spec: NumberSpec,
  held: Held = "read"
): void {
  const bound = node.boundVariables;
  if (spec.kind === "variable") {
    const variable = run.variables.variable(spec.variable);
    if (held === "read" && field.bindings.every((binding) => bound?.[binding]?.id === variable.id)) {
      return;
    }
    change(run.plan, label, `${field.name} → ${spec.variable.name}`, () => {
      for (const binding of field.bindings) {
        node.setBoundVariable(binding, variable);
      }
    });
    return;
  }
  if (
    held === "read" &&
    field.bindings.every((binding) => bound?.[binding] === undefined) &&
    field.matches(spec.value)
  ) {
    return;
  }
  change(run.plan, label, `${field.name} → ${describeNumber(spec)}`, () => {
    for (const binding of field.bindings) {
      node.setBoundVariable(binding, null);
    }
    field.write(spec.value);
  });
}

/**
 * Plan the BOOLEAN property a layer's `visible` follows, which a designer toggles from the properties
 * panel to show or hide the part (PB). A layer the spec shows wherever its variant holds it follows
 * none.
 *
 * @param run - The run.
 * @param layer - A frame or an instance layer.
 * @param label - The layer's label, for change lines.
 * @param property - The property's name in the spec, or undefined for none.
 * @param ids - The set's property ids by name, which an operation that adds one fills in when it runs.
 */
export function planVisibleLink(
  run: Run,
  layer: FrameNode | InstanceNode,
  label: string,
  property: string | undefined,
  ids: ReadonlyMap<string, string>
): void {
  const linked = layer.componentPropertyReferences?.visible;
  if (property !== undefined && (linked === undefined || linked !== ids.get(property))) {
    change(run.plan, label, `visible → the ${property} property`, () => {
      const id = ids.get(property);
      if (id === undefined) {
        throw new Error(`${label}: the ${property} property has no id when the layer links to it.`);
      }
      layer.componentPropertyReferences = { ...layer.componentPropertyReferences, visible: id };
    });
  } else if (property === undefined && linked !== undefined) {
    change(run.plan, label, "visible → no property", () => {
      const { visible: _unlinked, ...rest } = layer.componentPropertyReferences ?? {};
      layer.componentPropertyReferences = rest;
    });
  }
}

/**
 * Plan a scalar field, such as a layout mode or a name, when it differs.
 *
 * @param run - The run.
 * @param label - The node's label, for change lines.
 * @param name - The field name, for change lines.
 * @param current - The value the node holds.
 * @param desired - The value the spec asks for.
 * @param write - Writes the desired value.
 */
export function planScalar<Value extends string | number | boolean>(
  run: Run,
  label: string,
  name: string,
  current: Value,
  desired: Value,
  write: () => void
): void {
  if (current !== desired) {
    change(run.plan, label, `${name} → ${String(desired)}`, write);
  }
}

/**
 * Build the solid paint a color spec asks for, binding its variable.
 *
 * @param run - The run.
 * @param spec - The color.
 * @returns The paint.
 */
export function solidPaint(run: Run, spec: ColorSpec): SolidPaint {
  if (spec.kind === "literal") {
    return {
      type: "SOLID",
      color: { r: spec.color.r, g: spec.color.g, b: spec.color.b },
      opacity: spec.color.a,
      visible: true,
      blendMode: "NORMAL",
    };
  }
  const base: SolidPaint = {
    type: "SOLID",
    color: { r: 0, g: 0, b: 0 },
    visible: true,
    blendMode: "NORMAL",
  };
  return run.figma.variables.setBoundVariableForPaint(base, "color", run.variables.variable(spec.variable));
}

function rgbaMatches(color: RGB, alpha: number, spec: RgbaSpec): boolean {
  return (
    nearUnit(color.r, spec.r) &&
    nearUnit(color.g, spec.g) &&
    nearUnit(color.b, spec.b) &&
    nearUnit(alpha, spec.a)
  );
}

/** Whether a paint shows as written: visible, and in the `NORMAL` blend mode the plugin writes. */
function shows(paint: Paint): boolean {
  // Figma documents NORMAL as the blend mode of a paint that sets none.
  return paint.visible !== false && (paint.blendMode ?? "NORMAL") === "NORMAL";
}

function paintMatches(run: Run, paint: Paint, spec: ColorSpec): boolean {
  if (paint.type !== "SOLID" || !shows(paint)) {
    return false;
  }
  const boundId = paint.boundVariables?.color?.id;
  if (spec.kind === "variable") {
    // A bound paint holds the variable's alpha as its opacity, so only the binding counts.
    // The first run on a real file, on 2026-10-19, wrote `error` at 10% and read back 100%.
    return boundId === run.variables.variable(spec.variable).id;
  }
  return boundId === undefined && rgbaMatches(paint.color, paint.opacity ?? 1, spec.color);
}

/**
 * The image paint a spec asks for, at full opacity in the `NORMAL` blend mode. It names its image by
 * the hash the build wrote, the SHA-1 of the bytes, which is the hash Figma names a stored image by
 * (P9b), so the plan builds it without storing the image.
 */
function imagePaint(spec: ImagePaintSpec): ImagePaint {
  return {
    type: "IMAGE",
    scaleMode: spec.scaleMode,
    imageHash: spec.hash,
    visible: true,
    opacity: 1,
    blendMode: "NORMAL",
  };
}

/**
 * Store the image a paint names, as the operation that writes the paint runs, so Plan stores
 * nothing. Storing an image changes the file, though an image is no node.
 *
 * @param run - The run.
 * @param spec - The image.
 * @throws When Figma stores the image under another hash than the spec's, which a real file did not
 *   do (P9b): the paint would name an image Figma does not hold, so the operation writes no paint.
 */
function storeImage(run: Run, spec: ImagePaintSpec): void {
  const { hash } = run.figma.createImage(run.figma.base64Decode(spec.bytes));
  if (hash !== spec.hash) {
    throw new Error(
      `Figma stored the image as ${hash}, where the kit names it ${spec.hash}, the SHA-1 the build wrote. The plugin writes no paint that names an image the file does not hold.`
    );
  }
}

/**
 * Whether a held paint shows the image paint the spec asks for. On 2026-10-22 a real file read a
 * written image paint back with its hash, its scale mode and Figma's defaults for the rest (P9), and
 * named the image by the SHA-1 of its bytes (P9b). So the hash and the scale mode decide, besides the
 * visibility, blend mode and opacity every paint is held to. The filters and rotation stay unread.
 */
function imageMatches(held: Paint, wanted: ImagePaint): boolean {
  return (
    held.type === "IMAGE" &&
    shows(held) &&
    nearUnit(held.opacity ?? 1, 1) &&
    held.imageHash === wanted.imageHash &&
    held.scaleMode === wanted.scaleMode
  );
}

/** The paint a fill spec asks for, whether a held paint shows it, and its words in a change line. */
type DesiredPaint = {
  readonly shownBy: (held: Paint) => boolean;
  /** Builds the paint to write, which a solid paint needs only when the node does not show it. */
  readonly build: () => Paint;
  /** What the operation does before it writes the paint, such as storing the image it names. */
  readonly prepare: () => void;
  readonly description: string;
};

function desiredPaint(run: Run, spec: FillSpec): DesiredPaint {
  if (spec.kind !== "image") {
    return {
      shownBy: (held) => paintMatches(run, held, spec),
      build: () => solidPaint(run, spec),
      prepare: () => undefined,
      description: describeColor(spec),
    };
  }
  const paint = imagePaint(spec);
  return {
    shownBy: (held) => imageMatches(held, paint),
    build: () => paint,
    prepare: () => storeImage(run, spec),
    description: describeImage(paint),
  };
}

/**
 * Plan a node's fills or strokes as a single solid or image paint, or as none.
 *
 * @param run - The run.
 * @param label - The node's label, for change lines.
 * @param name - `fill`, `stroke` or `text color`, for change lines.
 * @param current - The paints the node holds; `figma.mixed` never matches.
 * @param spec - The one paint the spec asks for, or undefined for no paint.
 * @param write - Writes the desired paint list.
 */
export function planPaints(
  run: Run,
  label: string,
  name: string,
  current: ReadonlyArray<Paint> | PluginAPI["mixed"],
  spec: FillSpec | undefined,
  write: (paints: Paint[]) => void
): void {
  const holds = current === run.figma.mixed ? undefined : current;
  if (spec === undefined) {
    if (holds?.length !== 0) {
      change(run.plan, label, `${name} → none`, () => write([]));
    }
    return;
  }
  const desired = desiredPaint(run, spec);
  const [only] = holds ?? [];
  if (holds?.length === 1 && only !== undefined && desired.shownBy(only)) {
    return;
  }
  const paint = desired.build();
  const held = holds === undefined ? "mixed" : describeHeld(holds, describeHeldPaint);
  change(run.plan, label, `${name} → ${desired.description} (holds ${held})`, () => {
    desired.prepare();
    write([paint]);
  });
}

/**
 * The value a variable takes in a node. Figma stores a value with each binding and draws that.
 * A new binding stores the variable's value, but an effect written with the binding it already
 * holds keeps the value written. On a real file on 2026-10-20, 28 focus rings bound to `ring`
 * kept the black an earlier run wrote and drew black where `ring` is gray.
 *
 * @param run - The run.
 * @param ref - The variable.
 * @param node - The node that binds it, whose modes pick the value.
 * @returns The value, with every alias followed.
 */
function boundValue(run: Run, ref: VariableRef, node: SceneNode): VariableValue {
  return run.variables.variable(ref).resolveForConsumer(node).value;
}

function boundColor(run: Run, ref: VariableRef, node: SceneNode): RGBA {
  // SAFETY: the kit check confirmed that every variable the kit binds to a color is a COLOR
  // variable, which resolves to a color with its alpha.
  return boundValue(run, ref, node) as RGBA;
}

/** A length in a node: the literal, or the value its variable takes there. */
function lengthIn(run: Run, spec: NumberSpec, node: SceneNode): number {
  // SAFETY: the kit check confirmed that every variable the kit binds to a length is a FLOAT
  // variable, which resolves to a number.
  return spec.kind === "literal" ? spec.value : (boundValue(run, spec.variable, node) as number);
}

/** The shadow fields a spec binds, each with its variable. */
function shadowBindings(spec: ShadowSpec): ReadonlyMap<VariableBindableEffectField, VariableRef> {
  const bindings = new Map<VariableBindableEffectField, VariableRef>();
  if (spec.color.kind === "variable") {
    bindings.set("color", spec.color.variable);
  }
  if (spec.radius.kind === "variable") {
    bindings.set("radius", spec.radius.variable);
  }
  if (spec.spread.kind === "variable") {
    bindings.set("spread", spec.spread.variable);
  }
  return bindings;
}

/** The shadow fields the plugin binds or leaves unbound. */
const SHADOW_FIELDS: readonly VariableBindableEffectField[] = ["color", "radius", "spread"];

function dropShadow(run: Run, node: SceneNode, spec: ShadowSpec): DropShadowEffect {
  const radius = lengthIn(run, spec.radius, node);
  const spread = lengthIn(run, spec.spread, node);
  let shadow: DropShadowEffect = {
    type: "DROP_SHADOW",
    color:
      spec.color.kind === "literal"
        ? { r: spec.color.color.r, g: spec.color.color.g, b: spec.color.color.b, a: spec.color.color.a }
        : boundColor(run, spec.color.variable, node),
    offset: { x: spec.offsetX, y: spec.offsetY },
    radius,
    spread,
    visible: true,
    blendMode: "NORMAL",
    showShadowBehindNode: false,
  };
  for (const [field, ref] of shadowBindings(spec)) {
    const variable = run.variables.variable(ref);
    // SAFETY: binding a field of a drop shadow returns a drop shadow with the same fields.
    shadow = run.figma.variables.setBoundVariableForEffect(shadow, field, variable) as DropShadowEffect;
  }
  // Two runs on a real file stored the focus ring's 2px spread as 0, and the third, which wrote
  // the geometry again after the bind, kept it on every variant.
  return { ...shadow, offset: { x: spec.offsetX, y: spec.offsetY }, radius, spread };
}

function shadowMatches(run: Run, node: SceneNode, effect: Effect, spec: ShadowSpec): boolean {
  if (
    effect.type !== "DROP_SHADOW" ||
    !effect.visible ||
    effect.blendMode !== "NORMAL" ||
    effect.showShadowBehindNode === true
  ) {
    return false;
  }
  const bindings = shadowBindings(spec);
  const bound = SHADOW_FIELDS.every((field) => {
    const ref = bindings.get(field);
    return (
      effect.boundVariables?.[field]?.id === (ref === undefined ? undefined : run.variables.variable(ref).id)
    );
  });
  const color = spec.color.kind === "literal" ? spec.color.color : boundColor(run, spec.color.variable, node);
  return (
    bound &&
    near(effect.offset.x, spec.offsetX) &&
    near(effect.offset.y, spec.offsetY) &&
    near(effect.radius, lengthIn(run, spec.radius, node)) &&
    near(effect.spread ?? 0, lengthIn(run, spec.spread, node)) &&
    rgbaMatches(effect.color, effect.color.a, color)
  );
}

function describeShadow(spec: ShadowSpec): string {
  return `${describeColor(spec.color)} ${spec.offsetX} ${spec.offsetY} ${describeNumber(spec.radius)} ${describeNumber(spec.spread)}`;
}

/**
 * Plan a node's effects as the spec's drop shadows.
 *
 * @param run - The run.
 * @param node - The node.
 * @param label - The node's label, for change lines.
 * @param specs - The shadows the spec asks for, in order.
 */
export function planShadows(
  run: Run,
  node: SceneNode & BlendMixin,
  label: string,
  specs: readonly ShadowSpec[]
): void {
  const current = node.effects;
  const same =
    current.length === specs.length &&
    specs.every((spec, index) => {
      const effect = current[index];
      return effect !== undefined && shadowMatches(run, node, effect, spec);
    });
  if (same) {
    return;
  }
  const description = specs.length === 0 ? "none" : specs.map(describeShadow).join(", ");
  const effects = specs.map((spec) => dropShadow(run, node, spec));
  const held = describeHeld(current, describeHeldEffect);
  change(run.plan, label, `shadows → ${description} (holds ${held})`, () => {
    node.effects = effects;
  });
}

/** How a node sizes along each axis, as `layoutSizingHorizontal` and `layoutSizingVertical` name it. */
export type LayoutSizing = {
  readonly horizontal: FrameNode["layoutSizingHorizontal"];
  readonly vertical: FrameNode["layoutSizingVertical"];
};

/** The `layoutSizing*` value each kind of axis sizing writes. */
export const LAYOUT_SIZING = {
  fixed: "FIXED",
  hug: "HUG",
  fill: "FILL",
} as const satisfies Record<SizeSpec["kind"], LayoutSizing["horizontal"]>;

/** Each axis and the member that sizes it. */
export const SIZING_MEMBERS = [
  ["horizontal", "layoutSizingHorizontal"],
  ["vertical", "layoutSizingVertical"],
] as const;

/**
 * How a layer sizes on each axis, as the plan compares it with the spec. A hidden child of an auto
 * layout reads `layoutSizing*` FIXED on an axis it fills, while it keeps the fill in `layoutGrow` 1
 * along its parent's direction and `layoutAlign` STRETCH across it, as a real file showed on
 * 2026-10-24 (NH), so a hidden child's fill reads from those. A shown layer reads FILL itself.
 *
 * @param node - A frame, component, instance or text.
 * @returns The sizing on each axis.
 */
export function heldSizing(
  node: Pick<
    FrameNode,
    "layoutSizingHorizontal" | "layoutSizingVertical" | "layoutGrow" | "layoutAlign" | "visible" | "parent"
  >
): LayoutSizing {
  const read: LayoutSizing = { horizontal: node.layoutSizingHorizontal, vertical: node.layoutSizingVertical };
  if (node.visible) {
    return read;
  }
  const { parent } = node;
  if (parent === null || !("layoutMode" in parent) || parent.layoutMode === "NONE") {
    return read;
  }
  const fills = (axis: "HORIZONTAL" | "VERTICAL"): boolean =>
    parent.layoutMode === axis ? node.layoutGrow === 1 : node.layoutAlign === "STRETCH";
  return {
    horizontal: fills("HORIZONTAL") ? "FILL" : read.horizontal,
    vertical: fills("VERTICAL") ? "FILL" : read.vertical,
  };
}

/**
 * The sizing an auto layout frame reads once its direction is `direction`. A direction change
 * keeps both sizing modes, each in its role along or across the direction, so a hug moves to the
 * other axis with it, as a real file showed on 2026-10-22. A fill stays, since it comes from the
 * parent's layout.
 */
function sizingAlong(node: FrameNode | ComponentNode, direction: DirectionSpec): LayoutSizing {
  const held = heldSizing(node);
  if (node.layoutMode === direction) {
    return held;
  }
  const after = (current: LayoutSizing["horizontal"], axis: DirectionSpec): LayoutSizing["horizontal"] => {
    if (current === "FILL") {
      return current;
    }
    const mode = axis === direction ? node.primaryAxisSizingMode : node.counterAxisSizingMode;
    return mode === "AUTO" ? "HUG" : "FIXED";
  };
  return { horizontal: after(held.horizontal, "HORIZONTAL"), vertical: after(held.vertical, "VERTICAL") };
}

/**
 * Plan a node's fixed lengths and its layout sizing as one operation. A resize, or a width or
 * height binding, turns a hugging or filling axis fixed, so the operation writes both axes' sizing
 * again after the lengths. The operation runs after the one that sets the node's direction, so
 * the plan compares the spec with the sizing the node reads in that direction. A turn also
 * resizes the node, as a hug moves to the other axis. On a real file on 2026-10-22 a row 40 tall
 * became 14 tall as a column. So when the node turns, the operation writes its fixed lengths
 * whatever the node reads now.
 *
 * @param run - The run.
 * @param node - The auto layout frame, which may also sit in one.
 * @param label - The node's label, for change lines.
 * @param spec - The direction and the sizing the spec asks for.
 * @param held - `unknown` when the node's parent turns in this run, which moves a fill to the
 *   other axis, so the operation writes both axes' sizing and the fixed lengths whatever the node
 *   reads now.
 * @param planLengths - Plans the fixed lengths into the run it receives, compared with what the
 *   node holds, or written whatever it holds when the lengths are `unknown`.
 */
export function planLayoutSizing(
  run: Run,
  node: FrameNode | ComponentNode,
  label: string,
  spec: { readonly direction: DirectionSpec; readonly sizing: LayoutSizing },
  held: Held,
  planLengths: (group: Run, lengths: Held) => void
): void {
  const { sizing } = spec;
  // No probe has shown what a box stores in its modes, or how it sizes, when it first gets an auto
  // layout, as every new box does, so a box without one writes its sizing whatever it predicts.
  const reads = held === "read" && node.layoutMode !== "NONE" ? sizingAlong(node, spec.direction) : undefined;
  const lengths: Held = held === "read" && node.layoutMode === spec.direction ? "read" : "unknown";
  const writeSizing = (): void => {
    node.layoutSizingHorizontal = sizing.horizontal;
    node.layoutSizingVertical = sizing.vertical;
  };
  changeTogetherIn(
    run,
    label,
    (group) => {
      planLengths(group, lengths);
      for (const [axis, member] of SIZING_MEMBERS) {
        if (reads?.[axis] !== sizing[axis]) {
          change(group.plan, label, `${member} → ${sizing[axis]}`, writeSizing);
        }
      }
    },
    writeSizing
  );
}

/**
 * The corner radius of a box or an instance, which a spec sets on all four corners at once.
 *
 * @param node - The box, or an instance layer that overrides its corners.
 * @returns The field.
 */
export function cornerField(node: ComponentNode | FrameNode | InstanceNode): NumberField {
  const corners = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
  return {
    name: "cornerRadius",
    bindings: corners,
    matches: (value) => corners.every((corner) => near(node[corner], value)),
    write: (value) => {
      node.cornerRadius = value;
    },
  };
}

/**
 * Plan a fixed width or height, or unbind one the spec lets the box or text hug or fill.
 *
 * @param run - The run.
 * @param node - The box, a text layer or an instance layer.
 * @param label - The node's label, for change lines.
 * @param name - The axis's length.
 * @param spec - The axis's sizing.
 * @param held - Whether to compare a fixed length with what the node holds, or write it whatever it holds.
 * @param write - Writes the fixed length.
 */
export function planLength(
  run: Run,
  node: ComponentNode | FrameNode | TextNode | InstanceNode,
  label: string,
  name: "width" | "height",
  spec: SizeSpec,
  held: Held,
  write: (value: number) => void
): void {
  if (spec.kind !== "fixed") {
    if (node.boundVariables?.[name] !== undefined) {
      change(run.plan, label, `${name} → ${spec.kind}`, () => node.setBoundVariable(name, null));
    }
    return;
  }
  planNumber(
    run,
    node,
    label,
    { name, bindings: [name], matches: (value) => near(node[name], value), write },
    spec.length,
    held
  );
}

/**
 * Plan one limit of a box or a text, or remove one the spec drops.
 *
 * @param run - The run.
 * @param node - The box, or a text layer.
 * @param label - The node's label, for change lines.
 * @param name - The limit.
 * @param spec - The length the limit should hold, or undefined for none.
 */
export function planLimit(
  run: Run,
  node: ComponentNode | FrameNode | TextNode | InstanceNode,
  label: string,
  name: keyof LimitsSpec,
  spec: NumberSpec | undefined
): void {
  if (spec === undefined) {
    if (node[name] !== null || node.boundVariables?.[name] !== undefined) {
      change(run.plan, label, `${name} → none`, () => {
        node.setBoundVariable(name, null);
        node[name] = null;
      });
    }
    return;
  }
  const field: NumberField = {
    name,
    bindings: [name],
    matches: (value) => {
      const held = node[name];
      return held !== null && near(held, value);
    },
    write: (value) => {
      node[name] = value;
    },
  };
  planNumber(run, node, label, field, spec);
}
