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
 * @returns The variable name with its opacity, or the literal color.
 */
export function describeColor(spec: ColorSpec): string {
  if (spec.kind === "variable") {
    return spec.opacity < 1
      ? `${spec.variable.name} at ${Math.round(spec.opacity * 100)}%`
      : spec.variable.name;
  }
  if (spec.color.a === 0) {
    return "transparent";
  }
  const channel = (value: number): string =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(spec.color.r)}${channel(spec.color.g)}${channel(spec.color.b)} at ${Math.round(spec.color.a * 100)}%`;
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

function solidPaint(run: Run, spec: ColorSpec): SolidPaint {
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
    opacity: spec.opacity,
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
  const opacity = paint.opacity ?? 1;
  const boundId = paint.boundVariables?.color?.id;
  if (spec.kind === "variable") {
    return boundId === run.variables.variable(spec.variable).id && nearUnit(opacity, spec.opacity);
  }
  return boundId === undefined && rgbaMatches(paint.color, opacity, spec.color);
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
  change(run.plan, label, `${name} → ${describeColor(spec)}`, () => write([paint]));
}

function dropShadow(run: Run, spec: ShadowSpec): DropShadowEffect {
  const base: DropShadowEffect = {
    type: "DROP_SHADOW",
    color:
      spec.color.kind === "literal"
        ? { r: spec.color.color.r, g: spec.color.color.g, b: spec.color.color.b, a: spec.color.color.a }
        : { r: 0, g: 0, b: 0, a: spec.color.opacity },
    offset: { x: spec.offsetX, y: spec.offsetY },
    radius: spec.radius,
    spread: spec.spread,
    visible: true,
    blendMode: "NORMAL",
    showShadowBehindNode: false,
  };
  if (spec.color.kind === "literal") {
    return base;
  }
  const variable = run.variables.variable(spec.color.variable);
  // SAFETY: binding the color of a drop shadow returns a drop shadow with the same fields.
  return run.figma.variables.setBoundVariableForEffect(base, "color", variable) as DropShadowEffect;
}

function shadowMatches(run: Run, effect: Effect, spec: ShadowSpec): boolean {
  if (effect.type !== "DROP_SHADOW" || !effect.visible || effect.blendMode !== "NORMAL") {
    return false;
  }
  const geometry =
    near(effect.offset.x, spec.offsetX) &&
    near(effect.offset.y, spec.offsetY) &&
    near(effect.radius, spec.radius) &&
    near(effect.spread ?? 0, spec.spread) &&
    effect.showShadowBehindNode !== true;
  if (!geometry) {
    return false;
  }
  const boundId = effect.boundVariables?.color?.id;
  if (spec.color.kind === "variable") {
    return boundId === run.variables.variable(spec.color.variable).id;
  }
  return boundId === undefined && rgbaMatches(effect.color, effect.color.a, spec.color.color);
}

function describeShadow(spec: ShadowSpec): string {
  return `${describeColor(spec.color)} ${spec.offsetX} ${spec.offsetY} ${spec.radius} ${spec.spread}`;
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
      return effect !== undefined && shadowMatches(run, effect, spec);
    });
  if (same) {
    return;
  }
  const description = specs.length === 0 ? "none" : specs.map(describeShadow).join(", ");
  const effects = specs.map((spec) => dropShadow(run, spec));
  change(run.plan, label, `shadows → ${description}`, () => {
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
