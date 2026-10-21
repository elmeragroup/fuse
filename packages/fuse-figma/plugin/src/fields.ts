/**
 * Field planners. Each compares a node field with its spec and records an operation only when
 * they differ, so a second run over an applied file plans nothing. A bound field counts as
 * equal when it binds the same variable. A literal field counts as equal when no variable
 * binds it and the value matches within the precision Figma stores, which is a 32-bit
 * float. A planner looks up every variable and builds every paint before it records the
 * operation, so the operation only assigns.
 */

import type {
  ColorSpec,
  NumberSpec,
  RgbaSpec,
  ShadowSpec,
  VariableRef,
} from "../../src/components/kit-spec.ts";
import { change, changeTogether, requirement } from "./plan.ts";
import type { Plan } from "./plan.ts";
import type { KitVariables } from "./variables.ts";

/** What every planner needs: the plugin API, the file's variables and the run's plan. */
export type Run = {
  readonly figma: PluginAPI;
  readonly variables: KitVariables;
  readonly plan: Plan;
};

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
 * Require a font before the run's first write. Figma refuses a text write unless the fonts it
 * touches are loaded, and a file can hold a font this machine cannot load. Loading every font
 * first makes such a font stop the run, Plan included, with nothing written.
 *
 * @param run - The run.
 * @param label - The layer that needs the font, for the error.
 * @param font - The font.
 */
export function requireFont(run: Run, label: string, font: FontName): void {
  const axes = font.variationSettings === undefined ? "" : ` ${JSON.stringify(font.variationSettings)}`;
  const key = `font ${font.family} ${font.style}${axes}`;
  requirement(run.plan, key, async () => {
    try {
      await run.figma.loadFontAsync(font);
    } catch (cause) {
      throw new Error(
        `${label} needs the font ${font.family} ${font.style}, which Figma cannot load. Install it, then run the plugin again.`,
        { cause }
      );
    }
  });
}

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
 * What a node holds, for a change line. A bound paint shows as `variable`, because the paint
 * planner only reads a binding's id. A bound shadow also shows the color Figma stores, which
 * the shadow planner compares. A mismatch after an apply shows what Figma kept.
 */
function describeHeldPaint(paint: Paint): string {
  if (paint.type !== "SOLID") {
    return paint.type;
  }
  const color =
    paint.boundVariables?.color === undefined
      ? describeRgba(paint.color, paint.opacity ?? 1)
      : `variable at ${Math.round((paint.opacity ?? 1) * 100)}%`;
  const hidden = paint.visible === false ? ", hidden" : "";
  const blend = (paint.blendMode ?? "NORMAL") === "NORMAL" ? "" : `, ${paint.blendMode}`;
  return `${color}${hidden}${blend}`;
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
 * Plan one number field against its spec.
 *
 * @param run - The run.
 * @param node - The node that owns the field.
 * @param label - The node's label, for change lines.
 * @param field - The field.
 * @param spec - The value the field should hold.
 */
export function planNumber(
  run: Run,
  node: SceneNode,
  label: string,
  field: NumberField,
  spec: NumberSpec
): void {
  const bound = node.boundVariables;
  if (spec.kind === "variable") {
    const variable = run.variables.variable(spec.variable);
    if (field.bindings.every((binding) => bound?.[binding]?.id === variable.id)) {
      return;
    }
    change(run.plan, label, `${field.name} → ${spec.variable.name}`, () => {
      for (const binding of field.bindings) {
        node.setBoundVariable(binding, variable);
      }
    });
    return;
  }
  if (field.bindings.every((binding) => bound?.[binding] === undefined) && field.matches(spec.value)) {
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

function paintMatches(run: Run, paint: Paint, spec: ColorSpec): boolean {
  // Figma documents NORMAL as the blend mode of a paint that sets none.
  if (paint.type !== "SOLID" || paint.visible === false || (paint.blendMode ?? "NORMAL") !== "NORMAL") {
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
 * Plan a node's fills or strokes as a single solid paint, or as none.
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
  spec: ColorSpec | undefined,
  write: (paints: Paint[]) => void
): void {
  const holds = current === run.figma.mixed ? undefined : current;
  if (spec === undefined) {
    if (holds?.length !== 0) {
      change(run.plan, label, `${name} → none`, () => write([]));
    }
    return;
  }
  const [only] = holds ?? [];
  if (holds?.length === 1 && only !== undefined && paintMatches(run, only, spec)) {
    return;
  }
  const paint = solidPaint(run, spec);
  const held = holds === undefined ? "mixed" : describeHeld(holds, describeHeldPaint);
  change(run.plan, label, `${name} → ${describeColor(spec)} (holds ${held})`, () => write([paint]));
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

/** The sizing modes of an auto layout frame. */
export type SizingModes = {
  readonly primary: "FIXED" | "AUTO";
  readonly counter: "FIXED" | "AUTO";
};

/**
 * Plan a size and the sizing modes as one operation. `resize` turns both sizing modes to
 * FIXED, so the operation writes both sizing modes again after the size.
 *
 * @param run - The run.
 * @param node - The auto layout frame.
 * @param label - The node's label, for change lines.
 * @param planSize - Plans the size into the run it receives.
 * @param modes - The sizing modes the spec asks for.
 */
export function planSizing(
  run: Run,
  node: FrameNode | ComponentNode,
  label: string,
  planSize: (group: Run) => void,
  modes: SizingModes
): void {
  const writeModes = (): void => {
    node.primaryAxisSizingMode = modes.primary;
    node.counterAxisSizingMode = modes.counter;
  };
  changeTogether(
    run.plan,
    label,
    (plan) => {
      const group: Run = { ...run, plan };
      planSize(group);
      planScalar(
        group,
        label,
        "primaryAxisSizingMode",
        node.primaryAxisSizingMode,
        modes.primary,
        writeModes
      );
      planScalar(
        group,
        label,
        "counterAxisSizingMode",
        node.counterAxisSizingMode,
        modes.counter,
        writeModes
      );
    },
    writeModes
  );
}
