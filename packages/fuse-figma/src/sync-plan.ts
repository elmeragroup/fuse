/**
 * Diffs a desired variable set against a file and produces the one change batch that
 * makes the file match. Matching is by name, so every collection, mode and variable that
 * survives keeps its Figma id, and so do the bindings designers made to it. The plan
 * touches only the collections the set names. Inside them the set is authoritative, so the
 * plan deletes modes and variables it does not name.
 *
 * Planning pairs each desired collection, mode and variable with its counterpart in the
 * file exactly once, into one diff per collection. The printed changes and the batch are
 * both read off that diff, so they cannot disagree.
 */

import { Result, Schema } from "effect";

import { CollectionId, ModeId, VariableId } from "./file-variables.ts";
import type {
  ChangeBatch,
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

/** One line of a plan, for people reading what a sync will do. */
export type PlannedChange =
  | { readonly _tag: "CreateCollection"; readonly collection: string }
  | { readonly _tag: "CreateMode"; readonly collection: string; readonly mode: string }
  | {
      readonly _tag: "RenameMode";
      readonly collection: string;
      readonly from: string;
      readonly mode: string;
    }
  | { readonly _tag: "DeleteMode"; readonly collection: string; readonly mode: string }
  | { readonly _tag: "CreateVariable"; readonly collection: string; readonly variable: string }
  | { readonly _tag: "UpdateVariable"; readonly collection: string; readonly variable: string }
  | { readonly _tag: "DeleteVariable"; readonly collection: string; readonly variable: string }
  | {
      readonly _tag: "SetValue";
      readonly collection: string;
      readonly variable: string;
      readonly mode: string;
    };

/** The changes a sync makes and the batch that makes them. */
export type SyncPlan = {
  readonly changes: readonly PlannedChange[];
  readonly batch: ChangeBatch;
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

/** Where a desired collection lands: a collection the batch creates, or one the file has. */
type CollectionTarget =
  | { readonly _tag: "Create"; readonly id: CollectionId; readonly initialModeId: ModeId }
  | { readonly _tag: "Existing"; readonly id: CollectionId };

/** A mode the file has, or the one Figma gives a new collection, whose name the sync never reads. */
type CurrentMode = { readonly id: ModeId; readonly name: string | undefined };

/**
 * Where a desired mode lands. A missing mode first takes over a stale mode by renaming it,
 * which keeps the mode id and the frames pinned to it. Only when no stale mode is left is
 * it created.
 */
type ModeTarget =
  | { readonly _tag: "Keep"; readonly name: string; readonly id: ModeId }
  | {
      readonly _tag: "Rename";
      readonly name: string;
      readonly id: ModeId;
      readonly from: string | undefined;
    }
  | { readonly _tag: "Create"; readonly name: string; readonly id: ModeId };

/** Where each desired mode lands, and the file's modes left over to delete. */
type ModeMatch = {
  readonly modes: readonly ModeTarget[];
  readonly staleModes: readonly FileMode[];
};

/** Where a desired variable lands. */
type VariableTarget =
  | { readonly _tag: "Create"; readonly spec: VariableSpec; readonly id: VariableId }
  | { readonly _tag: "Update" | "Keep"; readonly spec: VariableSpec; readonly found: FileVariable };

/** A mode value the batch sets, with the names a reader of the plan needs. */
type ValueTarget = {
  readonly variable: string;
  readonly mode: string;
  readonly change: ValueChange;
};

/** One desired collection paired with the file. */
type CollectionMatch = {
  readonly spec: CollectionSpec;
  readonly collection: CollectionTarget;
  readonly modes: readonly ModeTarget[];
  readonly staleModes: readonly FileMode[];
  readonly variables: readonly VariableTarget[];
  readonly staleVariables: readonly FileVariable[];
};

/** A matched collection with the mode values that differ from the file. */
type CollectionDiff = CollectionMatch & { readonly values: readonly ValueTarget[] };

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
    const diffs = matches.map((match): CollectionDiff => ({ ...match, values: valueTargets(match, ids) }));
    return { changes: diffs.flatMap(plannedChanges), batch: changeBatch(diffs) };
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

    // Temporary ids only need to be unique within one request.
    const initialModeId = ModeId(`tmp_mode_${index}_0`);
    const collection: CollectionTarget =
      existing === undefined
        ? { _tag: "Create", id: CollectionId(`tmp_collection_${index}`), initialModeId }
        : { _tag: "Existing", id: existing.id };
    // A new collection starts with one mode, which is stale like any mode the set does not name.
    const currentModes: readonly CurrentMode[] = existing?.modes ?? [{ id: initialModeId, name: undefined }];
    const { modes, staleModes } = matchModes(spec.modes, currentModes, (position) =>
      ModeId(`tmp_mode_${index}_${position}`)
    );

    const fileVariables = existing?.variables ?? [];
    const found = new Map(fileVariables.map((variable) => [variable.name, variable]));
    const variables: VariableTarget[] = [];
    for (const [position, variable] of spec.variables.entries()) {
      const newId = VariableId(`tmp_variable_${index}_${position}`);
      variables.push(yield* matchVariable(spec.name, variable, found.get(variable.name), newId));
    }
    const wanted = new Set(spec.variables.map((variable) => variable.name));
    const staleVariables = fileVariables.filter((variable) => !wanted.has(variable.name));
    return { spec, collection, modes, staleModes, variables, staleVariables };
  });
}

function matchModes(
  desired: readonly string[],
  current: readonly CurrentMode[],
  newId: (position: number) => ModeId
): ModeMatch {
  const byName = new Map<string, ModeId>();
  for (const mode of current) {
    if (mode.name !== undefined) byName.set(mode.name, mode.id);
  }
  const stale = current.filter((mode) => mode.name === undefined || !desired.includes(mode.name));

  const modes: ModeTarget[] = [];
  let renamed = 0;
  for (const [position, name] of desired.entries()) {
    const id = byName.get(name);
    const reused = stale[renamed];
    if (id !== undefined) {
      modes.push({ _tag: "Keep", name, id });
    } else if (reused === undefined) {
      modes.push({ _tag: "Create", name, id: newId(position) });
    } else {
      modes.push({ _tag: "Rename", name, id: reused.id, from: reused.name });
      renamed += 1;
    }
  }
  // A set's collection has at least one mode, so a new collection's initial mode is always
  // renamed and never reaches this list.
  const staleModes = stale
    .slice(renamed)
    .flatMap((mode): FileMode[] => (mode.name === undefined ? [] : [{ id: mode.id, name: mode.name }]));
  return { modes, staleModes };
}

function matchVariable(
  collection: string,
  spec: VariableSpec,
  found: FileVariable | undefined,
  newId: VariableId
): Result.Result<VariableTarget, VariableTypeConflict> {
  if (found === undefined) {
    return Result.succeed({ _tag: "Create", spec, id: newId });
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
  return Result.succeed({ _tag: sameMetadata(found, spec) ? "Keep" : "Update", spec, found });
}

function idOf(target: VariableTarget): VariableId {
  return target._tag === "Create" ? target.id : target.found.id;
}

/** The id each desired variable has in the batch, real or temporary, by qualified name. */
function variableIds(matches: readonly CollectionMatch[]): ReadonlyMap<string, VariableId> {
  return new Map(
    matches.flatMap((match) =>
      match.variables.map(
        (target) => [qualifiedName(match.spec.name, target.spec.name), idOf(target)] as const
      )
    )
  );
}

function valueTargets(match: CollectionMatch, ids: ReadonlyMap<string, VariableId>): ValueTarget[] {
  return match.variables.flatMap((target) =>
    match.modes.flatMap((mode): ValueTarget[] => {
      const name = qualifiedName(match.spec.name, target.spec.name);
      const value = guaranteed(
        target.spec.values.get(mode.name),
        `"${name}" has a value for mode "${mode.name}"`
      );
      const wanted = writeValue(value, ids);
      const current = target._tag === "Create" ? undefined : target.found.values.get(mode.id);
      if (current !== undefined && sameValue(current, wanted)) {
        return [];
      }
      return [
        {
          variable: target.spec.name,
          mode: mode.name,
          change: { variableId: idOf(target), modeId: mode.id, value: wanted },
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
 * Read a value that `makeVariableSet` guarantees: every variable has a value for each mode
 * of its collection, and every alias targets a variable of the set. A miss is a defect.
 */
function guaranteed<A>(value: A | undefined, invariant: string): A {
  if (value === undefined) {
    throw new Error(`Variable set invariant broken: expected ${invariant}`);
  }
  return value;
}

function plannedChanges(diff: CollectionDiff): PlannedChange[] {
  const collection = diff.spec.name;
  const changes: PlannedChange[] = [];
  if (diff.collection._tag === "Create") {
    changes.push({ _tag: "CreateCollection", collection });
  }
  for (const mode of diff.modes) {
    switch (mode._tag) {
      case "Keep":
        break;
      case "Create":
        changes.push({ _tag: "CreateMode", collection, mode: mode.name });
        break;
      case "Rename":
        // Naming the mode Figma gives a new collection reads as creating it.
        changes.push(
          mode.from === undefined
            ? { _tag: "CreateMode", collection, mode: mode.name }
            : { _tag: "RenameMode", collection, from: mode.from, mode: mode.name }
        );
        break;
    }
  }
  for (const mode of diff.staleModes) {
    changes.push({ _tag: "DeleteMode", collection, mode: mode.name });
  }
  for (const target of diff.variables) {
    if (target._tag === "Create") {
      changes.push({ _tag: "CreateVariable", collection, variable: target.spec.name });
    } else if (target._tag === "Update") {
      changes.push({ _tag: "UpdateVariable", collection, variable: target.spec.name });
    }
  }
  for (const variable of diff.staleVariables) {
    changes.push({ _tag: "DeleteVariable", collection, variable: variable.name });
  }
  for (const value of diff.values) {
    changes.push({ _tag: "SetValue", collection, variable: value.variable, mode: value.mode });
  }
  return changes;
}

function changeBatch(diffs: readonly CollectionDiff[]): ChangeBatch {
  return {
    collections: diffs.flatMap(newCollection),
    modes: diffs.flatMap(modeChanges),
    variables: diffs.flatMap(variableChanges),
    values: diffs.flatMap((diff) => diff.values.map((value) => value.change)),
  };
}

function newCollection(diff: CollectionDiff): NewCollection[] {
  const { collection } = diff;
  return collection._tag === "Create"
    ? [{ id: collection.id, name: diff.spec.name, initialModeId: collection.initialModeId }]
    : [];
}

/**
 * Renames come first and deletes last. A collection only gains modes when no stale mode is
 * left to delete, so it never goes over Figma's 40-mode cap and never runs out of modes.
 */
function modeChanges(diff: CollectionDiff): ModeChange[] {
  const collectionId = diff.collection.id;
  const renames = diff.modes.flatMap((mode): ModeChange[] =>
    mode._tag === "Rename" ? [{ _tag: "RenameMode", collectionId, id: mode.id, name: mode.name }] : []
  );
  const creates = diff.modes.flatMap((mode): ModeChange[] =>
    mode._tag === "Create" ? [{ _tag: "CreateMode", collectionId, id: mode.id, name: mode.name }] : []
  );
  const deletes = diff.staleModes.map((mode): ModeChange => ({
    _tag: "DeleteMode",
    collectionId,
    id: mode.id,
  }));
  return [...renames, ...creates, ...deletes];
}

function variableChanges(diff: CollectionDiff): VariableChange[] {
  const collectionId = diff.collection.id;
  const writes = diff.variables.flatMap((target): VariableChange[] => {
    switch (target._tag) {
      case "Create":
        return [
          {
            _tag: "CreateVariable",
            collectionId,
            id: target.id,
            name: target.spec.name,
            type: target.spec.type,
            metadata: metadataOf(target.spec),
          },
        ];
      case "Update":
        return [{ _tag: "UpdateVariable", id: target.found.id, metadata: metadataOf(target.spec) }];
      case "Keep":
        return [];
    }
  });
  const deletes = diff.staleVariables.map((variable): VariableChange => ({
    _tag: "DeleteVariable",
    id: variable.id,
  }));
  return [...writes, ...deletes];
}

function metadataOf(spec: VariableSpec): VariableMetadata {
  return { scopes: spec.scopes, webSyntax: spec.webSyntax };
}

/**
 * Scopes compare as sets because Figma does not document their order. The sync owns only
 * the web syntax it sets. Figma does not document whether an update merges code syntax or
 * replaces it; the sync assumes a merge, so the Android and iOS entries stay as designers
 * wrote them. The first sync against a real file checks this assumption.
 */
function sameMetadata(found: FileVariable, spec: VariableSpec): boolean {
  const scopes = new Set(found.scopes);
  return (
    scopes.size === spec.scopes.length &&
    spec.scopes.every((scope) => scopes.has(scope)) &&
    (spec.webSyntax === undefined || found.webSyntax === spec.webSyntax)
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
