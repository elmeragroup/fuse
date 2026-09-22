/**
 * The variables the repository wants a Figma file to hold, keyed by name. A set has no
 * Figma ids. The sync matches collections, modes and variables by name, so one set works
 * for any file.
 */

import { Brand, Result, Schema } from "effect";

/** A gamma-encoded sRGB color with every channel in `0..1`, Figma's `RGBA` value. */
export type Rgba = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

/** The address of another variable in the same set. */
export type VariableReference = {
  /** The name of the collection that owns the target. */
  readonly collection: string;

  /** The target variable's name inside that collection. */
  readonly variable: string;
};

/** A value that points at another variable, which Figma resolves per mode. */
export type AliasValue = {
  readonly _tag: "Alias";
  readonly target: VariableReference;
};

/** A literal color. */
export type ColorValue = {
  readonly _tag: "Color";
  readonly color: Rgba;
};

/** A literal number, in Figma's unitless pixels. */
export type FloatValue = {
  readonly _tag: "Float";
  readonly value: number;
};

/** A literal string. */
export type StringValue = {
  readonly _tag: "String";
  readonly value: string;
};

/** A literal value, which a variable can hold only when its type matches. */
export type LiteralValue = ColorValue | FloatValue | StringValue;

/** Any value a variable can take in one mode. */
export type VariableValue = AliasValue | LiteralValue;

/** The Figma variable types the sync writes. */
export type VariableType = "COLOR" | "FLOAT" | "STRING";

/**
 * The Figma picker scopes the sync assigns. An empty list hides a variable from every
 * picker while keeping it available as an alias target.
 */
export type VariableScope = "ALL_SCOPES" | "CORNER_RADIUS" | "FONT_FAMILY";

/** A variable the sync owns. */
export type VariableSpec = {
  /** The variable's name, unique in its collection; `/` separates Figma groups. */
  readonly name: string;

  /** The Figma type, which a sync can set only when it creates the variable. */
  readonly type: VariableType;

  /** The pickers that offer the variable. */
  readonly scopes: readonly VariableScope[];

  /**
   * The CSS a developer writes for it, shown in Figma's code panel. `undefined` leaves the
   * file's code syntax as it is.
   */
  readonly webSyntax: string | undefined;

  /** One value per mode of the owning collection, keyed by mode name. */
  readonly values: ReadonlyMap<string, VariableValue>;
};

/** One Figma variable collection the sync owns completely. */
export type CollectionSpec = {
  /** The collection's name, which identifies it in the target file. */
  readonly name: string;

  /** Mode names in order. */
  readonly modes: readonly string[];

  /** Every variable the collection holds; any other variable in it is stale. */
  readonly variables: readonly VariableSpec[];
};

/**
 * The complete set of collections a sync writes into a file. Only {@link makeVariableSet}
 * builds one, so a set always has these properties:
 *
 * - Collection names are unique, and so are mode and variable names inside a collection.
 * - Every collection has at least one mode.
 * - Every variable has exactly one value for each mode of its collection.
 * - Every literal matches its variable's type.
 * - Every alias targets another variable of the set with the same type.
 */
export type VariableSet = {
  readonly collections: readonly CollectionSpec[];
} & Brand.Brand<"VariableSet">;

/** The collections given to {@link makeVariableSet} break one of a set's rules. */
export class InvalidVariableSet extends Schema.TaggedError<InvalidVariableSet>()("InvalidVariableSet", {
  message: Schema.String,
  location: Schema.String,
}) {}

const brandVariableSet = Brand.nominal<VariableSet>();

const LITERAL_TYPES = {
  Color: "COLOR",
  Float: "FLOAT",
  String: "STRING",
} as const satisfies Record<LiteralValue["_tag"], VariableType>;

/**
 * The name a variable has across the whole set, `<collection>/<variable>`.
 *
 * @param collection - The owning collection's name.
 * @param variable - The variable's name inside it.
 */
export function qualifiedName(collection: string, variable: string): string {
  return `${collection}/${variable}`;
}

/**
 * Check the collections once, so the planner can rely on the rules listed on
 * {@link VariableSet}.
 *
 * @param collections - The collections a sync should own, in the order it creates them.
 * @returns The set, or the first rule a collection breaks.
 */
export function makeVariableSet(
  collections: readonly CollectionSpec[]
): Result.Result<VariableSet, InvalidVariableSet> {
  const variables = new Map<string, VariableSpec>();
  const collectionNames = new Set<string>();
  for (const collection of collections) {
    if (collectionNames.has(collection.name)) {
      return invalid(collection.name, "appears twice");
    }
    collectionNames.add(collection.name);
    if (collection.modes.length === 0) {
      return invalid(collection.name, "has no modes");
    }
    if (new Set(collection.modes).size !== collection.modes.length) {
      return invalid(collection.name, "names a mode twice");
    }
    for (const variable of collection.variables) {
      const name = qualifiedName(collection.name, variable.name);
      if (variables.has(name)) {
        return invalid(name, "appears twice");
      }
      variables.set(name, variable);
    }
  }

  for (const collection of collections) {
    for (const variable of collection.variables) {
      const problem = valueProblem(collection, variable, variables);
      if (problem !== undefined) {
        return invalid(qualifiedName(collection.name, variable.name), problem);
      }
    }
  }
  return Result.succeed(brandVariableSet({ collections }));
}

function valueProblem(
  collection: CollectionSpec,
  variable: VariableSpec,
  variables: ReadonlyMap<string, VariableSpec>
): string | undefined {
  const missing = collection.modes.find((mode) => !variable.values.has(mode));
  if (missing !== undefined) {
    return `has no value for mode "${missing}"`;
  }
  if (variable.values.size !== collection.modes.length) {
    return "has a value for a mode its collection does not have";
  }
  for (const [mode, value] of variable.values) {
    if (value._tag !== "Alias") {
      const type = LITERAL_TYPES[value._tag];
      if (type !== variable.type) {
        return `is a ${variable.type} variable but holds a ${type} value in mode "${mode}"`;
      }
      continue;
    }
    const targetName = qualifiedName(value.target.collection, value.target.variable);
    const target = variables.get(targetName);
    if (target === undefined) {
      return `aliases "${targetName}", which the set does not define`;
    }
    if (target === variable) {
      return "aliases itself";
    }
    if (target.type !== variable.type) {
      return `is a ${variable.type} variable but aliases the ${target.type} variable "${targetName}"`;
    }
  }
  return undefined;
}

function invalid(location: string, problem: string): Result.Result<never, InvalidVariableSet> {
  return Result.fail(
    new InvalidVariableSet({
      message: `The Figma variable set is invalid: "${location}" ${problem}.`,
      location,
    })
  );
}
