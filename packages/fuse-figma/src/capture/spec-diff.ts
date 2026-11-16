/**
 * The differential oracle of a switched set: the field-by-field difference between the component
 * set the recipe cascade builds and the one the capture builds, with their coverage rows, and the
 * per-set file that classifies each difference.
 */

import { Schema } from "effect";

import type { CoverageRow } from "../components/coverage.ts";
import type { ComponentSetSpec } from "../components/kit-spec.ts";

/** One field the two specs disagree on, by its path from the set. */
export type FieldDifference = {
  /** The field's path, such as `variants[label/state=rest].root.opacity`. */
  readonly path: string;
  /** The recipe spec's value as JSON, or undefined where it lacks the field. */
  readonly recipe: string | undefined;
  /** The capture spec's value as JSON, or undefined where it lacks the field. */
  readonly capture: string | undefined;
};

/** A JSON value as a built spec holds it. */
type Json = string | number | boolean | null | undefined | readonly Json[] | JsonObject;

/** A JSON object. */
type JsonObject = { readonly [key: string]: Json };

/** Whether a value is a JSON object, not an array or a primitive. */
function isObject(value: Json): value is JsonObject {
  return value instanceof Object && !Array.isArray(value);
}

const isString = Schema.is(Schema.String);

/** A value's `key` field, where it is an object whose `key` is a string. */
function keyOf(value: Json): string | undefined {
  const key = isObject(value) ? value.key : undefined;
  return isString(key) ? key : undefined;
}

/**
 * The step of a path into an array element: its `key` where every element of both arrays has a
 * distinct one, as variants and layers do, so a reordered or inserted layer reads as one
 * difference rather than as every later index.
 */
function keyedSteps(left: readonly Json[], right: readonly Json[]): readonly string[] | undefined {
  const keys = [...left, ...right].map(keyOf);
  if (keys.some((key) => key === undefined)) {
    return undefined;
  }
  const leftKeys = left.map(keyOf);
  const rightKeys = right.map(keyOf);
  if (new Set(leftKeys).size !== leftKeys.length || new Set(rightKeys).size !== rightKeys.length) {
    return undefined;
  }
  return [...new Set(keys.flatMap((key) => (key === undefined ? [] : [key])))];
}

/** Whether a value is a JSON list. */
function isList(value: Json): value is readonly Json[] {
  return Array.isArray(value);
}

/** Collect the differences below one path. */
function collect(path: string, recipe: Json, capture: Json, into: FieldDifference[]): void {
  if (JSON.stringify(recipe) === JSON.stringify(capture)) {
    return;
  }
  if (isList(recipe) && isList(capture)) {
    const keys = keyedSteps(recipe, capture);
    if (keys !== undefined) {
      const byKey = (list: readonly Json[], key: string) => list.find((value) => keyOf(value) === key);
      for (const key of keys) {
        collect(`${path}[${key}]`, byKey(recipe, key), byKey(capture, key), into);
      }
      return;
    }
    if (recipe.length === capture.length) {
      recipe.forEach((value, index) => {
        collect(`${path}[${String(index)}]`, value, capture[index], into);
      });
      return;
    }
  } else if (isObject(recipe) && isObject(capture)) {
    const keys = [...new Set([...Object.keys(recipe), ...Object.keys(capture)])];
    for (const key of keys) {
      collect(path === "" ? key : `${path}.${key}`, recipe[key], capture[key], into);
    }
    return;
  }
  into.push({
    path,
    recipe: recipe === undefined ? undefined : JSON.stringify(recipe),
    capture: capture === undefined ? undefined : JSON.stringify(capture),
  });
}

/**
 * The fields two built component sets disagree on.
 *
 * @param recipe - The set as the recipe cascade builds it.
 * @param capture - The set as the capture builds it.
 * @returns Each differing field, in the order the walk meets them.
 */
export function diffSpecs(recipe: SetSpec, capture: SetSpec): readonly FieldDifference[] {
  const into: FieldDifference[] = [];
  collect("", recipe, capture, into);
  return into;
}

/** A built component set, with or without its page. */
type SetSpec = Omit<ComponentSetSpec, "page">;

/** A coverage row as the oracle compares it: everything but the set's name. */
export type RowKey = string;

/** A coverage row's key, which two builds of a set compare. */
export function rowKey(row: CoverageRow): RowKey {
  return JSON.stringify([row.part, row.className, row.property, row.value, row.outcome, row.detail]);
}

/** The coverage rows only the recipe build has, and those only the capture build has. */
export type CoverageDifference = {
  readonly lost: readonly CoverageRow[];
  readonly added: readonly CoverageRow[];
};

/**
 * The coverage rows each build has and the other lacks.
 *
 * @param recipe - The recipe build's rows.
 * @param capture - The capture build's rows.
 * @returns The rows only the recipe build has, and those only the capture build has.
 */
export function diffCoverage(
  recipe: readonly CoverageRow[],
  capture: readonly CoverageRow[]
): CoverageDifference {
  const recipeKeys = new Set(recipe.map(rowKey));
  const captureKeys = new Set(capture.map(rowKey));
  return {
    lost: recipe.filter((row) => !captureKeys.has(rowKey(row))),
    added: capture.filter((row) => !recipeKeys.has(rowKey(row))),
  };
}
