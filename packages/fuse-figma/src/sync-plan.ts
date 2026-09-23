/**
 * Diffs a desired variable set against a file and produces the one change batch that
 * makes the file match. Matching is by name, so every collection, mode and variable that
 * survives keeps its Figma id, and so do the bindings designers made to it. The plan
 * touches only the collections the set names. Inside them the set is authoritative, so the
 * plan deletes modes and variables it does not name.
 *
 * Planning walks each desired collection once and emits one planned change per write. A
 * planned change carries both the names a reader sees and the write itself, and
 * `changeBatch` sorts the same list into Figma's four arrays. A plan holds no separate
 * batch, so what `check` prints and what `sync` sends cannot disagree.
 */

import { Result, Schema } from "effect";

import { CollectionId, ModeId, VariableId } from "./file-variables.ts";
import type {
  ChangeBatch,
  CodeSyntax,
  FileCollection,
  FileMode,
  FileValue,
  FileVariable,
  FileVariables,
  ModeChange,
  NewCollection,
  ValueChange,
  VariableChange,
  VariableMetadata,
  WriteValue,
} from "./file-variables.ts";
import { qualifiedName } from "./variable-set.ts";
import type { CollectionSpec, Rgba, VariableSet, VariableSpec, VariableValue } from "./variable-set.ts";

/** One write of a plan, with the names people reading the plan need. */
export type PlannedChange =
  | { readonly _tag: "CreateCollection"; readonly collection: string; readonly write: NewCollection }
  | {
      readonly _tag: "CreateMode";
      readonly collection: string;
      readonly mode: string;
      readonly write: Extract<ModeChange, { readonly _tag: "NameInitialMode" | "CreateMode" }>;
    }
  | {
      readonly _tag: "DeleteMode";
      readonly collection: string;
      readonly mode: string;
      readonly write: Extract<ModeChange, { readonly _tag: "DeleteMode" }>;
    }
  | {
      readonly _tag: "CreateVariable";
      readonly collection: string;
      readonly variable: string;
      readonly write: Extract<VariableChange, { readonly _tag: "CreateVariable" }>;
    }
  | {
      readonly _tag: "UpdateVariable";
      readonly collection: string;
      readonly variable: string;
      readonly write: Extract<VariableChange, { readonly _tag: "UpdateVariable" }>;
    }
  | {
      readonly _tag: "DeleteVariable";
      readonly collection: string;
      readonly variable: string;
      readonly write: Extract<VariableChange, { readonly _tag: "DeleteVariable" }>;
    }
  | {
      readonly _tag: "SetValue";
      readonly collection: string;
      readonly variable: string;
      readonly mode: string;
      readonly write: ValueChange;
    };

/** The changes a sync makes, in the order the batch applies them within each kind. */
export type SyncPlan = {
  readonly changes: readonly PlannedChange[];
};

/**
 * A variable exists with the right name but the wrong type. Figma cannot change a type in
 * place, and replacing the variable would silently unbind every layer that uses it.
 */
export class VariableTypeConflict extends Schema.TaggedError<VariableTypeConflict>()("VariableTypeConflict", {
  message: Schema.String,
  collection: Schema.String,
  variable: Schema.String,
  fileType: Schema.String,
  wantedType: Schema.String,
}) {}

/** The file has two local collections with a name the sync owns, so it cannot tell which one to update. */
export class DuplicateCollection extends Schema.TaggedError<DuplicateCollection>()("DuplicateCollection", {
  message: Schema.String,
  collection: Schema.String,
}) {}

/** Everything that stops a plan from being made. */
export type PlanConflict = DuplicateCollection | VariableTypeConflict;

/**
 * Channel and number differences below this are round-trip noise. Figma stores values as
 * 32-bit floats, and 1e-4 is far below the 1/255 step of an 8-bit display.
 */
const TOLERANCE = 1e-4;

type PlannedModeChange = Extract<PlannedChange, { readonly _tag: "CreateMode" | "DeleteMode" }>;

/** A desired variable with its id in the batch, real or temporary, and the values the file holds. */
type VariableTarget = {
  readonly spec: VariableSpec;
  readonly id: VariableId;
  readonly current: ReadonlyMap<ModeId, FileValue>;
};

/** One desired collection paired with the file, before its values are compared. */
type CollectionMatch = {
  readonly spec: CollectionSpec;

  /** Every desired mode with the id it has in the batch, real or temporary. */
  readonly modes: readonly FileMode[];
  readonly variables: readonly VariableTarget[];

  /** The collection, mode and variable writes, in the order the batch applies them. */
  readonly changes: readonly PlannedChange[];
};

/** True when the plan changes nothing, meaning the file already matches the set. */
export function isInSync(plan: SyncPlan): boolean {
  return plan.changes.length === 0;
}

/**
 * Plan the batch that makes `file` hold exactly the collections in `desired`.
 *
 * @param desired - The variables the file should hold.
 * @param file - The file's current local variables.
 * @returns The plan, or the conflict that prevents one.
 */
export function planSync(desired: VariableSet, file: FileVariables): Result.Result<SyncPlan, PlanConflict> {
  return Result.gen(function* () {
    const matches: CollectionMatch[] = [];
    for (const [index, spec] of desired.collections.entries()) {
      matches.push(yield* matchCollection(spec, index, file));
    }
    // Aliases cross collections, so values resolve only once every variable has an id.
    const ids = variableIds(matches);
    return { changes: matches.flatMap((match) => [...match.changes, ...valueChanges(match, ids)]) };
  });
}

function matchCollection(
  spec: CollectionSpec,
  index: number,
  file: FileVariables
): Result.Result<CollectionMatch, PlanConflict> {
  return Result.gen(function* () {
    const named = file.collections.filter((collection) => collection.name === spec.name);
    if (named.length > 1) {
      return yield* Result.fail(
        new DuplicateCollection({
          message: `The file has ${named.length} local collections named "${spec.name}". Rename or delete all but one, then sync again.`,
          collection: spec.name,
        })
      );
    }
    const [existing] = named;
    const collection =
      existing === undefined ? newCollection(spec, index) : existingCollection(spec, existing, index);

    const fileVariables = existing?.variables ?? [];
    const found = new Map(fileVariables.map((variable) => [variable.name, variable]));
    const variables: VariableTarget[] = [];
    const variableChanges: PlannedChange[] = [];
    for (const [position, variable] of spec.variables.entries()) {
      // Temporary ids only need to be unique within one request.
      const newId = VariableId(`tmp_variable_${index}_${position}`);
      const matched = yield* matchVariable(
        spec.name,
        collection.id,
        variable,
        found.get(variable.name),
        newId
      );
      variables.push(matched.target);
      variableChanges.push(...matched.changes);
    }
    const wanted = new Set(spec.variables.map((variable) => variable.name));
    for (const variable of fileVariables) {
      if (!wanted.has(variable.name)) {
        variableChanges.push({
          _tag: "DeleteVariable",
          collection: spec.name,
          variable: variable.name,
          write: { _tag: "DeleteVariable", id: variable.id },
        });
      }
    }
    return {
      spec,
      modes: collection.modes,
      variables,
      changes: [...collection.changes, ...variableChanges],
    };
  });
}

/** A collection's id in the batch, where its modes land, and the collection and mode writes. */
type CollectionModes = {
  readonly id: CollectionId;
  readonly modes: readonly FileMode[];
  readonly changes: readonly PlannedChange[];
};

/**
 * Figma gives a new collection one mode, which `initialModeId` names for the rest of the
 * request. The plan names it after the first desired mode, the only rename a sync makes,
 * and creates the others.
 */
function newCollection(spec: CollectionSpec, index: number): CollectionModes {
  const id = CollectionId(`tmp_collection_${index}`);
  const modes = spec.modes.map((name, position): FileMode => ({
    name,
    id: ModeId(`tmp_mode_${index}_${position}`),
  }));
  const [initial, ...rest] = modes;
  const initialMode = guaranteed(initial, `"${spec.name}" has a mode`);
  return {
    id,
    modes,
    changes: [
      {
        _tag: "CreateCollection",
        collection: spec.name,
        write: { id, name: spec.name, initialModeId: initialMode.id },
      },
      createMode(spec.name, id, initialMode, "NameInitialMode"),
      ...rest.map((mode) => createMode(spec.name, id, mode, "CreateMode")),
    ],
  };
}

/**
 * A mode keeps its id only while the tokens keep its name. The plan never renames a mode
 * of a collection the file has, because a stale mode and a missing one are unrelated
 * themes, and a rename would turn every frame pinned to the stale theme into the new one.
 */
function existingCollection(spec: CollectionSpec, existing: FileCollection, index: number): CollectionModes {
  const found = new Map(existing.modes.map((mode) => [mode.name, mode.id]));
  const modes = spec.modes.map((name, position): FileMode => ({
    name,
    id: found.get(name) ?? ModeId(`tmp_mode_${index}_${position}`),
  }));
  const creates = modes
    .filter((mode) => !found.has(mode.name))
    .map((mode) => createMode(spec.name, existing.id, mode, "CreateMode"));
  const deletes = existing.modes
    .filter((mode) => !spec.modes.includes(mode.name))
    .map((mode): PlannedModeChange => ({
      _tag: "DeleteMode",
      collection: spec.name,
      mode: mode.name,
      write: { _tag: "DeleteMode", collectionId: existing.id, id: mode.id },
    }));
  const kept = modes.length - creates.length;
  return { id: existing.id, modes, changes: orderModeChanges(kept, creates, deletes) };
}

/**
 * Order one collection's mode changes so that, while Figma applies them in order, the
 * collection never holds more than 40 modes and never runs out of modes. The file and the
 * set each stay within 40 modes, which `makeVariableSet` checks for the set.
 *
 * When a mode survives, every stale mode goes first and the new modes follow, so the count
 * falls to the kept modes and then rises to the set's size. When no mode survives, the plan
 * deletes every stale mode but the last, creates the first new mode, deletes the last stale
 * mode and then creates the rest. The count then never exceeds the larger of the file's and
 * the set's mode counts, or 2. Renaming the last
 * stale mode instead would keep its id, but it would also turn an unrelated theme into the
 * new one.
 */
function orderModeChanges(
  kept: number,
  creates: readonly PlannedModeChange[],
  deletes: readonly PlannedModeChange[]
): readonly PlannedModeChange[] {
  if (kept > 0) {
    return [...deletes, ...creates];
  }
  return [...deletes.slice(0, -1), ...creates.slice(0, 1), ...deletes.slice(-1), ...creates.slice(1)];
}

function createMode(
  collection: string,
  collectionId: CollectionId,
  mode: FileMode,
  tag: "NameInitialMode" | "CreateMode"
): PlannedModeChange {
  return {
    _tag: "CreateMode",
    collection,
    mode: mode.name,
    write: { _tag: tag, collectionId, id: mode.id, name: mode.name },
  };
}

function matchVariable(
  collection: string,
  collectionId: CollectionId,
  spec: VariableSpec,
  found: FileVariable | undefined,
  newId: VariableId
): Result.Result<
  { readonly target: VariableTarget; readonly changes: readonly PlannedChange[] },
  VariableTypeConflict
> {
  if (found === undefined) {
    return Result.succeed({
      target: { spec, id: newId, current: new Map() },
      changes: [
        {
          _tag: "CreateVariable",
          collection,
          variable: spec.name,
          write: {
            _tag: "CreateVariable",
            collectionId,
            id: newId,
            name: spec.name,
            type: spec.type,
            metadata: metadataOf(spec, {}),
          },
        },
      ],
    });
  }
  if (found.type !== spec.type) {
    return Result.fail(
      new VariableTypeConflict({
        message: `"${qualifiedName(collection, spec.name)}" is a ${found.type} variable in Figma but the tokens define a ${spec.type}. Figma cannot change a variable's type; delete it in Figma and sync again, then rebind the layers that used it.`,
        collection,
        variable: spec.name,
        fileType: found.type,
        wantedType: spec.type,
      })
    );
  }
  const target: VariableTarget = { spec, id: found.id, current: found.values };
  if (sameMetadata(found, spec)) {
    return Result.succeed({ target, changes: [] });
  }
  return Result.succeed({
    target,
    changes: [
      {
        _tag: "UpdateVariable",
        collection,
        variable: spec.name,
        write: { _tag: "UpdateVariable", id: found.id, metadata: metadataOf(spec, found.codeSyntax) },
      },
    ],
  });
}

/** The id each desired variable has in the batch, real or temporary, by qualified name. */
function variableIds(matches: readonly CollectionMatch[]): ReadonlyMap<string, VariableId> {
  return new Map(
    matches.flatMap((match) =>
      match.variables.map((target) => [qualifiedName(match.spec.name, target.spec.name), target.id] as const)
    )
  );
}

function valueChanges(match: CollectionMatch, ids: ReadonlyMap<string, VariableId>): PlannedChange[] {
  const collection = match.spec.name;
  return match.variables.flatMap((target) =>
    match.modes.flatMap((mode): PlannedChange[] => {
      const value = guaranteed(
        target.spec.values.get(mode.name),
        `"${qualifiedName(collection, target.spec.name)}" has a value for mode "${mode.name}"`
      );
      const wanted = writeValue(value, ids);
      const current = target.current.get(mode.id);
      if (current !== undefined && sameValue(current, wanted)) {
        return [];
      }
      return [
        {
          _tag: "SetValue",
          collection,
          variable: target.spec.name,
          mode: mode.name,
          write: { variableId: target.id, modeId: mode.id, value: wanted },
        },
      ];
    })
  );
}

function writeValue(value: VariableValue, ids: ReadonlyMap<string, VariableId>): WriteValue {
  if (value._tag !== "Alias") {
    return value;
  }
  const target = qualifiedName(value.target.collection, value.target.variable);
  return { _tag: "Alias", id: guaranteed(ids.get(target), `the alias target "${target}" is in the set`) };
}

/**
 * Read a value that `makeVariableSet` guarantees: every collection has a mode, every
 * variable has a value for each mode of its collection, and every alias targets a variable
 * of the set. A miss is a defect.
 */
function guaranteed<A>(value: A | undefined, invariant: string): A {
  if (value === undefined) {
    throw new Error(`Variable set invariant broken: expected ${invariant}`);
  }
  return value;
}

/**
 * The one write that applies a plan, its changes sorted into Figma's four arrays. Figma
 * applies the arrays in the order collections, modes, variables, values, and each array in
 * its own order. The sort keeps the planned order inside each array, so the modes keep the
 * order `orderModeChanges` chose.
 *
 * @param plan - The plan to apply.
 * @returns The batch for `FigmaApi.writeVariables`.
 */
export function changeBatch({ changes }: SyncPlan): ChangeBatch {
  const collections: NewCollection[] = [];
  const modes: ModeChange[] = [];
  const variables: VariableChange[] = [];
  const values: ValueChange[] = [];
  for (const change of changes) {
    switch (change._tag) {
      case "CreateCollection":
        collections.push(change.write);
        break;
      case "CreateMode":
      case "DeleteMode":
        modes.push(change.write);
        break;
      case "CreateVariable":
      case "UpdateVariable":
      case "DeleteVariable":
        variables.push(change.write);
        break;
      case "SetValue":
        values.push(change.write);
        break;
    }
  }
  return { collections, modes, variables, values };
}

/**
 * The metadata a write sends. When the sync sets web syntax, the write carries the whole
 * code syntax, the file's Android and iOS entries included. Figma does not document whether
 * an update merges code syntax or replaces it, and the complete object is right under
 * either rule. Without web syntax the write leaves code syntax out entirely.
 */
function metadataOf(spec: VariableSpec, fileSyntax: CodeSyntax): VariableMetadata {
  return {
    scopes: spec.scopes,
    codeSyntax: spec.webSyntax === undefined ? undefined : { ...fileSyntax, WEB: spec.webSyntax },
  };
}

/**
 * Scopes compare as sets because Figma does not document their order. Of the code syntax,
 * the sync owns only the web entry, and only on the variables it sets one for.
 */
function sameMetadata(found: FileVariable, spec: VariableSpec): boolean {
  const scopes = new Set(found.scopes);
  return (
    scopes.size === spec.scopes.length &&
    spec.scopes.every((scope) => scopes.has(scope)) &&
    (spec.webSyntax === undefined || found.codeSyntax.WEB === spec.webSyntax)
  );
}

function sameValue(current: FileValue, wanted: WriteValue): boolean {
  switch (wanted._tag) {
    case "Alias":
      return current._tag === "Alias" && current.id === wanted.id;
    case "Color":
      return current._tag === "Color" && sameColor(current.color, wanted.color);
    case "Float":
      return current._tag === "Float" && Math.abs(current.value - wanted.value) <= TOLERANCE;
    case "String":
      return current._tag === "String" && current.value === wanted.value;
  }
}

function sameColor(left: Rgba, right: Rgba): boolean {
  return (
    Math.abs(left.r - right.r) <= TOLERANCE &&
    Math.abs(left.g - right.g) <= TOLERANCE &&
    Math.abs(left.b - right.b) <= TOLERANCE &&
    Math.abs(left.a - right.a) <= TOLERANCE
  );
}
