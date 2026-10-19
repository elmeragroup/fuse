/**
 * Field writers. Each compares a node field with its spec and records a change only when
 * they differ, so a second run over an applied file plans nothing. A bound field counts as
 * equal when it binds the same variable. A literal field counts as equal when no variable
 * binds it and the value matches within the precision Figma stores, which is a 32-bit
 * float.
 */

import type {
  ColorSpec,
  NumberSpec,
  RgbaSpec,
  ShadowSpec,
  VariableRef,
} from "../../src/components/kit-spec.ts";
import { change, warn } from "./ledger.ts";
import type { Ledger } from "./ledger.ts";
import type { KitVariables } from "./variables.ts";

/** What every writer needs: the plugin API, the file's variables and the run's ledger. */
export type Run = {
  readonly figma: PluginAPI;
  readonly variables: KitVariables;
  readonly ledger: Ledger;
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

function variableLabel(ref: VariableRef): string {
  return `${ref.collection}/${ref.name}`;
}

/**
 * Bring one number field in line with its spec.
 *
 * @param run - The run.
 * @param node - The node that owns the field.
 * @param label - The node's label, for change lines.
 * @param field - The field.
 * @param spec - The value the field should hold.
 */
export function syncNumber(
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
    change(run.ledger, label, `${field.name} → ${spec.variable.name}`, () => {
      for (const binding of field.bindings) {
        node.setBoundVariable(binding, variable);
      }
    });
    return;
  }
  if (field.bindings.every((binding) => bound?.[binding] === undefined) && field.matches(spec.value)) {
    return;
  }
  change(run.ledger, label, `${field.name} → ${describeNumber(spec)}`, () => {
    for (const binding of field.bindings) {
      node.setBoundVariable(binding, null);
    }
    field.write(spec.value);
  });
}

/**
 * Write a scalar field, such as a layout mode or a name, when it differs.
 *
 * @param run - The run.
 * @param label - The node's label, for change lines.
 * @param name - The field name, for change lines.
 * @param current - The value the node holds.
 * @param desired - The value the spec asks for.
 * @param write - Writes the desired value.
 */
export function syncScalar<Value extends string | number | boolean>(
  run: Run,
  label: string,
  name: string,
  current: Value,
  desired: Value,
  write: () => void
): void {
  if (current !== desired) {
    change(run.ledger, label, `${name} → ${String(desired)}`, write);
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
  if (paint.type !== "SOLID" || paint.visible === false) {
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
 * Bring a node's fills or strokes in line with a single solid paint, or with none.
 *
 * @param run - The run.
 * @param label - The node's label, for change lines.
 * @param name - `fill`, `stroke` or `text color`, for change lines.
 * @param current - The paints the node holds; `figma.mixed` never matches.
 * @param spec - The one paint the spec asks for, or undefined for no paint.
 * @param write - Writes the desired paint list.
 */
export function syncPaints(
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
      change(run.ledger, label, `${name} → none`, () => write([]));
    }
    return;
  }
  const [only] = holds ?? [];
  if (holds?.length === 1 && only !== undefined && paintMatches(run, only, spec)) {
    return;
  }
  change(run.ledger, label, `${name} → ${describeColor(spec)}`, () => write([solidPaint(run, spec)]));
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
  if (effect.type !== "DROP_SHADOW" || !effect.visible) {
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
 * Bring a node's effects in line with the spec's drop shadows.
 *
 * @param run - The run.
 * @param node - The node.
 * @param label - The node's label, for change lines.
 * @param specs - The shadows the spec asks for, in order.
 */
export function syncShadows(
  run: Run,
  node: SceneNode & BlendMixin,
  label: string,
  specs: readonly ShadowSpec[]
): void {
  for (const spec of specs) {
    if (spec.color.kind === "variable" && spec.color.opacity < 1) {
      // Unverified on a real file: a bound effect color may take its alpha from the variable
      // and drop the opacity the spec asks for.
      warn(
        run.ledger,
        label,
        `a shadow binds ${variableLabel(spec.color.variable)} at ${Math.round(spec.color.opacity * 100)}%, and Figma may drop that opacity`
      );
    }
  }
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
  change(run.ledger, label, `shadows → ${description}`, () => {
    node.effects = specs.map((spec) => dropShadow(run, spec));
  });
}
