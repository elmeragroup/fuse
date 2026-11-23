/**
 * The kit check's read of a box's stroke and of a `strokeSides` override as the kit's JSON holds
 * them. The plugin reads the kit as JSON, which carries no type, so a stroke or override of a shape
 * `StrokeSpec` or `InstanceOverride` in `kit-spec.ts` rules out would reach its planner, which picks
 * a stroke's form by the field it holds and reads each side's weight there. The check decodes each
 * form's weights, sides and dashes as JSON values and refuses any other shape. It does not read the
 * stroke's color or `inLayout`.
 */

import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import { STROKE_SIDES } from "./kit-spec.ts";
import type { InstanceOverride, StrokeSpec } from "./kit-spec.ts";

/**
 * A value of the kit's JSON, or undefined, which an in-memory spec may hold for an absent field. Each
 * spec type is assignable to it, so the check reads the fields a type rules out.
 */
type KitJson = string | number | boolean | null | undefined | readonly KitJson[] | KitFields;

/** The fields of a JSON object. */
type KitFields = { readonly [field: string]: KitJson };

const isText = Schema.is(Schema.String);
const isNumber = Predicate.isNumber;
const isFlag = Schema.is(Schema.Boolean);
const isList = Schema.is(Schema.Array(Schema.Unknown));
const isFinite = Schema.is(Schema.Finite);
const isPixels = Schema.is(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)));

/**
 * The fields of a JSON object, or undefined for any other value.
 *
 * @param json - The value.
 * @returns Its fields, or undefined for no object or a list.
 */
function fieldsOf(json: KitJson): KitFields | undefined {
  if (json === undefined || json === null || isText(json) || isNumber(json) || isFlag(json) || isList(json)) {
    return undefined;
  }
  return json;
}

/** A value as a message quotes it: its JSON, or `undefined`, which has none. */
function quote(json: KitJson): string {
  return json === undefined ? "undefined" : JSON.stringify(json);
}

/**
 * Whether the JSON holds a field: any value but undefined, which an in-memory spec may hold for an
 * absent field. A null is a value of the wrong shape, which the form's read then refuses.
 */
function holds(fields: KitFields, field: string): boolean {
  return fields[field] !== undefined;
}

/**
 * What a weight holds that `NumberSpec` in `kit-spec.ts` does not: a literal of a finite number, or a
 * variable named by its collection and name. Undefined for either.
 */
function weightFault(json: KitJson): string | undefined {
  const fields = fieldsOf(json);
  const variable = fieldsOf(fields?.variable);
  const literal = fields?.kind === "literal" && isFinite(fields.value);
  const bound =
    fields?.kind === "variable" &&
    variable !== undefined &&
    isText(variable.collection) &&
    isText(variable.name);
  return literal || bound ? undefined : `the weight ${quote(json)}, which is no literal weight or variable`;
}

/**
 * What a stroke's weight on each side holds that the four literal weights in pixels of `SideStroke`
 * in `kit-spec.ts` do not, or undefined for those four.
 */
function sideWeightsFault(json: KitJson): string | undefined {
  const fields = fieldsOf(json);
  if (fields === undefined) {
    return `${quote(json)}, which names no weight on each side`;
  }
  for (const side of STROKE_SIDES) {
    const weight = fields[side];
    if (weight === undefined) {
      return `no weight on the ${side} side`;
    }
    if (!isPixels(weight)) {
      return `the ${side} side's ${quote(weight)}, which is no weight in pixels`;
    }
  }
  return undefined;
}

/**
 * What a list of bare sides names that no Figma stroke the build writes takes: no list, no side,
 * every side, which leaves no side the weight, a side other than the four, or a side twice.
 * Undefined for some of the four, each once.
 */
function bareSidesFault(json: KitJson): string | undefined {
  if (!Array.isArray(json)) {
    return `${quote(json)}, which is no list of sides`;
  }
  const bare: readonly KitJson[] = json;
  const named: readonly KitJson[] = STROKE_SIDES;
  if (bare.length === 0) {
    return "no side";
  }
  if (STROKE_SIDES.every((side) => bare.includes(side))) {
    return "every side, which leaves no side the weight";
  }
  const other = bare.find((side) => !named.includes(side));
  if (other !== undefined) {
    return `a side ${quote(other)}, which no stroke has`;
  }
  const twice = bare.find((side, index) => bare.indexOf(side) !== index);
  return twice === undefined ? undefined : `the ${quote(twice)} side twice`;
}

/**
 * What a box's stroke holds that no stroke the build writes does, worded to follow the box's name,
 * or undefined for no stroke or one of the three forms `StrokeSpec` in `kit-spec.ts` types: a weight
 * on each side, solid, of four literal weights; one bound weight that leaves some sides bare, solid;
 * or one weight on every side, solid or of dashes of finite lengths.
 *
 * @param stroke - The box's stroke as the kit's JSON holds it.
 * @returns Why the check refuses the stroke, or undefined where it holds one of the forms.
 */
export function strokeFault(stroke: StrokeSpec | undefined): string | undefined {
  return strokeJsonFault(stroke);
}

/** {@link strokeFault} on the stroke as the kit's JSON may hold it. */
function strokeJsonFault(json: KitJson): string | undefined {
  if (json === undefined) {
    return undefined;
  }
  const fields = fieldsOf(json);
  if (fields === undefined) {
    return `draws the stroke ${quote(json)}, which is no stroke`;
  }
  if (holds(fields, "sides")) {
    if (holds(fields, "bare")) {
      return "names both a weight on each side and bare sides of its stroke";
    }
    if (holds(fields, "weight")) {
      return "names both a weight on each side and one weight of its stroke";
    }
    if (holds(fields, "dashPattern")) {
      return "dashes a stroke of a weight on each side, which the build draws solid";
    }
    const sides = sideWeightsFault(fields.sides);
    return sides === undefined ? undefined : `draws a stroke of ${sides}`;
  }
  const weight = weightFault(fields.weight);
  if (holds(fields, "bare")) {
    if (weight !== undefined) {
      return `leaves sides bare of a stroke of ${weight}`;
    }
    if (fieldsOf(fields.weight)?.kind !== "variable") {
      return "leaves sides of a stroke of a literal weight bare, which the build draws as a weight on each side";
    }
    if (holds(fields, "dashPattern")) {
      return "leaves sides of a dashed stroke bare, which the build draws no stroke for";
    }
    const sides = bareSidesFault(fields.bare);
    return sides === undefined ? undefined : `leaves bare ${sides}`;
  }
  if (weight !== undefined) {
    return `draws a stroke of ${weight}`;
  }
  const dashes = fields.dashPattern;
  const dashed = dashes === undefined || (isList(dashes) && dashes.every((length) => isFinite(length)));
  return dashed ? undefined : `dashes its stroke by ${quote(dashes)}, which is no list of lengths`;
}

/**
 * What a `strokeSides` override holds that no override the build writes does, as a whole message, or
 * undefined for one of the two forms `StrokeSidesOverride` and `BareSidesOverride` in `kit-spec.ts`
 * type: four literal weights, or one to three bare sides, each once.
 *
 * @param override - The override as the kit's JSON holds it.
 * @param where - The instance layer, as the check's messages open with it.
 * @param path - The overridden layer, as the check's messages name it.
 * @returns Why the check refuses the override, or undefined where it holds one of the forms.
 */
export function strokeSidesFault(
  override: Extract<InstanceOverride, { readonly field: "strokeSides" }>,
  where: string,
  path: string
): string | undefined {
  return sidesOverrideFault(override, where, path);
}

/** {@link strokeSidesFault} on the override as the kit's JSON may hold it. */
function sidesOverrideFault(json: KitJson, where: string, path: string): string | undefined {
  const fields = fieldsOf(json) ?? {};
  const sides = holds(fields, "sides");
  const bare = holds(fields, "bare");
  if (sides && bare) {
    return `${where} overrides the strokeSides of ${path} with both a weight on each side and bare sides, which the plugin and the build read apart.`;
  }
  if (!sides && !bare) {
    return `${where} overrides the strokeSides of ${path} with neither a weight on each side nor bare sides, which leaves the plugin no weight to write.`;
  }
  const fault = sides ? sideWeightsFault(fields.sides) : bareSidesFault(fields.bare);
  if (fault === undefined) {
    return undefined;
  }
  return sides
    ? `${where} overrides the strokeSides of ${path} with ${fault}.`
    : `${where} leaves sides of ${path} bare as no stroke the build writes does: ${fault}.`;
}
