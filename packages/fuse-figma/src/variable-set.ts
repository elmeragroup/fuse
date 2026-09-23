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
export type VariableScope = "ALL_SCOPES" | "CORNER_RADIUS";

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
 * - Every collection has between 1 and 40 modes, and no mode name is longer than 40
 *   characters, Figma's limits.
 * - Every variable has exactly one value for each mode of its collection.
 * - Every literal matches its variable's type.
 * - Every alias targets a variable of the set with the same type.
 * - No chain of aliases leads back to where it started, in any mode.
 */
export type VariableSet = {
  readonly collections: readonly CollectionSpec[];
} & Brand.Brand<"VariableSet">;

/** The collections given to {@link makeVariableSet} break one of a set's rules. */
export class InvalidVariableSet extends Schema.TaggedError<InvalidVariableSet>()("InvalidVariableSet", {
  message: Schema.String,
  location: Schema.String,
}) {}

/** Aliases in the collections given to {@link makeVariableSet} lead back to where they started. */
export class AliasCycle extends Schema.TaggedError<AliasCycle>()("AliasCycle", {
  message: Schema.String,

  /** The qualified names along the cycle, starting and ending with the same variable. */
  cycle: Schema.Array(Schema.String),
}) {}

/** Figma's limits on the modes of one collection. */
const MAX_MODES = 40;
const MAX_MODE_NAME_LENGTH = 40;

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
 * @returns The set, the first rule a collection breaks, or an alias cycle.
 */
export function makeVariableSet(
  collections: readonly CollectionSpec[]
): Result.Result<VariableSet, InvalidVariableSet | AliasCycle> {
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
    if (collection.modes.length > MAX_MODES) {
      return invalid(
        collection.name,
        `has ${collection.modes.length} modes, more than the ${MAX_MODES} Figma allows`
      );
    }
    const longName = collection.modes.find((mode) => mode.length > MAX_MODE_NAME_LENGTH);
    if (longName !== undefined) {
      return invalid(
        collection.name,
        `names the mode "${longName}", longer than the ${MAX_MODE_NAME_LENGTH} characters Figma allows`
      );
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

  const cycle = aliasCycle(collections);
  if (cycle !== undefined) {
    return Result.fail(
      new AliasCycle({
        message: `The Figma variable set is invalid: ${describeCycle(cycle)}. Aliases must not form a cycle.`,
        cycle,
      })
    );
  }
  return Result.succeed(brandVariableSet({ collections }));
}

/**
 * The first alias cycle in the set, as the qualified names along it, or `undefined`.
 *
 * Figma resolves an alias with the layer's mode for the target collection, so whether a
 * chain loops depends on the modes a layer sets, and a set cannot know which combinations
 * designers pick. The check is therefore conservative. It counts every target a variable
 * aliases in any of its modes and refuses any cycle in that graph. It can refuse a set in
 * which no mode combination loops, which is the safe side for a file designers bind to.
 */
function aliasCycle(collections: readonly CollectionSpec[]): readonly string[] | undefined {
  const targets = new Map<string, ReadonlySet<string>>();
  for (const collection of collections) {
    for (const variable of collection.variables) {
      const aliased = new Set<string>();
      for (const value of variable.values.values()) {
        if (value._tag === "Alias")
          aliased.add(qualifiedName(value.target.collection, value.target.variable));
      }
      targets.set(qualifiedName(collection.name, variable.name), aliased);
    }
  }

  // A depth-first walk. `path` is the chain being followed; `cleared` holds variables whose
  // every chain already ended without a cycle.
  const path: string[] = [];
  const cleared = new Set<string>();
  const walk = (name: string): readonly string[] | undefined => {
    const start = path.indexOf(name);
    if (start !== -1) return [...path.slice(start), name];
    if (cleared.has(name)) return undefined;
    path.push(name);
    for (const target of targets.get(name) ?? []) {
      const cycle = walk(target);
      if (cycle !== undefined) return cycle;
    }
    path.pop();
    cleared.add(name);
    return undefined;
  };
  for (const name of targets.keys()) {
    const cycle = walk(name);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
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
    if (target.type !== variable.type) {
      return `is a ${variable.type} variable but aliases the ${target.type} variable "${targetName}"`;
    }
  }
  return undefined;
}

/** `"a" aliases "b", which aliases "a"`, for a cycle that starts and ends at the same name. */
function describeCycle(cycle: readonly string[]): string {
  const quoted = cycle.map((name) => `"${name}"`);
  const then = quoted.slice(2).map((name) => `, which aliases ${name}`);
  return [quoted.slice(0, 2).join(" aliases "), ...then].join("");
}

function invalid(location: string, problem: string): Result.Result<never, InvalidVariableSet> {
  return Result.fail(
    new InvalidVariableSet({
      message: `The Figma variable set is invalid: "${location}" ${problem}.`,
      location,
    })
  );
}
