/**
 * Diffs a desired variable set against a file and produces the one change batch that
 * makes the file match. Matching is by name, so every collection, mode and variable that
 * survives keeps its Figma id, and so do the bindings designers made to it. A collection the
 * set renames is first renamed in place, with its modes, so it matches under its new name and
 * keeps its id and its mode ids. The plan touches only the collections the set names, and
 * deletes the local collections the set retires. Inside the collections it holds the set is authoritative, so the plan deletes
 * modes and variables it does not name.
 *
 * Planning walks each desired collection once and emits one planned change per write. A
 * planned change carries both the names a reader sees and the write itself, and
 * `changeBatch` sorts the same list into Figma's four arrays. A plan holds no separate
 * batch, so what `check` prints and what `sync` sends cannot disagree.
 */

import { Result, Schema } from "effect";

import { CollectionId, fileTypeName, ModeId, VariableId } from "./file-variables.ts";
import type {
  ChangeBatch,
  CodeSyntax,
  CollectionChange,
  FileCollection,
  FileMode,
  FileValue,
  FileVariable,
  FileVariables,
  ModeChange,
  ValueChange,
  VariableChange,
  VariableMetadata,
  WriteValue,
} from "./file-variables.ts";
import { qualifiedName } from "./variable-set.ts";
import type { CollectionSpec, Rgba, VariableSet, VariableSpec, VariableValue } from "./variable-set.ts";

/** One write of a plan, with the names people reading the plan need. */
export type PlannedChange =
  | {
      readonly _tag: "CreateCollection";
      readonly collection: string;
      readonly write: Extract<CollectionChange, { readonly _tag: "CreateCollection" }>;
    }
  | {
      readonly _tag: "RenameCollection";
      readonly collection: string;
      readonly from: string;
      readonly write: Extract<CollectionChange, { readonly _tag: "RenameCollection" }>;
    }
  | {
      readonly _tag: "DeleteCollection";
      readonly collection: string;
      readonly write: Extract<CollectionChange, { readonly _tag: "DeleteCollection" }>;
    }
  | {
      readonly _tag: "RenameMode";
      readonly collection: string;
      readonly from: string;
      readonly mode: string;
      readonly write: Extract<ModeChange, { readonly _tag: "RenameMode" }>;
    }
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

/**
 * The file holds more than one local collection with a renamed collection's old name, so the
 * sync cannot tell which one to rename in place and refuses rather than create a fresh one.
 */
export class AmbiguousRenameSource extends Schema.TaggedError<AmbiguousRenameSource>()(
  "AmbiguousRenameSource",
  {
    message: Schema.String,
    from: Schema.String,
    to: Schema.String,
    count: Schema.Number,
  }
) {}

/**
 * Renaming a collection's modes would give two modes one name: the collection already holds a
 * mode with a target name, or two of its modes rename to the same name. Renaming around it
 * would let reconciliation delete a mode and drop the frames pinned to it.
 */
export class RenameModeConflict extends Schema.TaggedError<RenameModeConflict>()("RenameModeConflict", {
  message: Schema.String,
  collection: Schema.String,
  mode: Schema.String,
  target: Schema.String,
}) {}

/**
 * The file holds both a renamed collection's new name and a collection with its old name. The
 * migration is not complete, and the sync cannot merge the two, so it refuses until a designer
 * repins the frames on the old collection and deletes it.
 */
export class UnresolvedLegacyCollection extends Schema.TaggedError<UnresolvedLegacyCollection>()(
  "UnresolvedLegacyCollection",
  {
    message: Schema.String,
    from: Schema.String,
    to: Schema.String,
  }
) {}

/** Everything that stops a plan from being made. */
export type PlanConflict =
  | AmbiguousRenameSource
  | DuplicateCollection
  | RenameModeConflict
  | UnresolvedLegacyCollection
  | VariableTypeConflict;

/** The conflicts a collection rename can raise before any write is planned. */
type RenameConflict = AmbiguousRenameSource | RenameModeConflict | UnresolvedLegacyCollection;

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
    const renamed = yield* renames(desired, file);
    const matches: CollectionMatch[] = [];
    for (const [index, spec] of desired.collections.entries()) {
      matches.push(yield* matchCollection(spec, index, renamed.file));
    }
    // Aliases cross collections, so values resolve only once every variable has an id.
    const ids = variableIds(matches);
    const values = matches.flatMap((match) => valueChanges(match, ids));
    return {
      changes: [
        ...renamed.changes,
        ...retirements(desired, file),
        ...matches.flatMap((match) => match.changes),
        ...aliasTargetsFirst(desired, values),
      ],
    };
  });
}

/**
 * Delete every local collection the set retires. `FileVariables` holds no library
 * collections or extensions, so the plan cannot reach one. Figma applies collection changes
 * before any value, so a variable that still aliases a retired one gets its new value later
 * in the same batch.
 */
function retirements(desired: VariableSet, file: FileVariables): readonly PlannedChange[] {
  return file.collections
    .filter((collection) => desired.retiredCollections.includes(collection.name))
    .map((collection) => ({
      _tag: "DeleteCollection",
      collection: collection.name,
      write: { _tag: "DeleteCollection", id: collection.id },
    }));
}

/** The file as it reads once the set's renames apply, and the writes that rename it. */
type RenamedFile = {
  readonly file: FileVariables;
  readonly changes: readonly PlannedChange[];
};

/**
 * Rename each collection the set renames, with its modes, when the file holds exactly one
 * local collection with its old name and none with its new name. The result is the file as it
 * reads after the renames, which the rest of the plan matches against, and the rename writes,
 * which apply before every other collection and mode write. A file that holds only the new
 * name keeps it, and any of its modes that still carry an old name are renamed by id too, so a
 * collection a designer renamed by hand keeps its pins. Every other case fails before any write: two
 * collections with the old name, the old and the new name side by side, or a mode rename that
 * would give two modes one name. Falling through would create a fresh collection or delete a
 * mode, and either drops the frames pinned to the old modes.
 */
function renames(desired: VariableSet, file: FileVariables): Result.Result<RenamedFile, RenameConflict> {
  return Result.gen(function* () {
    const changes: PlannedChange[] = [];
    const renamedIds = new Map<CollectionId, FileCollection>();
    for (const rename of desired.renamedCollections) {
      const sources = file.collections.filter((collection) => collection.name === rename.from);
      const [source] = sources;
      if (source === undefined) {
        // The collection already has its new name, perhaps renamed by hand, but its modes may
        // still carry the old names. Rename them by id, so their pins survive reconciliation.
        // Two destinations are left to the duplicate-collection conflict below.
        const destinations = file.collections.filter((collection) => collection.name === rename.to);
        const [destination] = destinations;
        if (destination === undefined || destinations.length > 1) continue;
        const modes = yield* renamedModes(destination, rename.to, rename.modes);
        changes.push(...modeRenames(destination, modes, rename.to));
        renamedIds.set(destination.id, { ...destination, modes });
        continue;
      }
      if (file.collections.some((collection) => collection.name === rename.to)) {
        return yield* Result.fail(
          new UnresolvedLegacyCollection({
            message: `The file holds both "${rename.to}" and the collection it replaces, "${rename.from}". Repin the frames that use "${rename.from}" to "${rename.to}", delete "${rename.from}", then sync again.`,
            from: rename.from,
            to: rename.to,
          })
        );
      }
      if (sources.length > 1) {
        return yield* Result.fail(
          new AmbiguousRenameSource({
            message: `The file has ${String(sources.length)} local collections named "${rename.from}", which the sync renames to "${rename.to}". Delete all but one, then sync again.`,
            from: rename.from,
            to: rename.to,
            count: sources.length,
          })
        );
      }
      const modes = yield* renamedModes(source, rename.to, rename.modes);
      changes.push({
        _tag: "RenameCollection",
        collection: rename.to,
        from: rename.from,
        write: { _tag: "RenameCollection", id: source.id, name: rename.to },
      });
      changes.push(...modeRenames(source, modes, rename.to));
      renamedIds.set(source.id, { ...source, name: rename.to, modes });
    }
    const collections = file.collections.map((collection) => renamedIds.get(collection.id) ?? collection);
    return { file: { collections }, changes };
  });
}

/** The writes that rename `collection`'s modes to `modes`, one per mode whose name changes. */
function modeRenames(
  collection: FileCollection,
  modes: readonly FileMode[],
  to: string
): readonly PlannedChange[] {
  return modes.flatMap((mode, index): PlannedChange[] => {
    const before = collection.modes[index];
    if (before === undefined || before.name === mode.name) return [];
    return [
      {
        _tag: "RenameMode",
        collection: to,
        from: before.name,
        mode: mode.name,
        write: { _tag: "RenameMode", collectionId: collection.id, id: mode.id, name: mode.name },
      },
    ];
  });
}

/**
 * A renamed collection's modes after the rename, in file order, or the conflict when two
 * modes would end up with one name.
 */
function renamedModes(
  source: FileCollection,
  to: string,
  targets: ReadonlyMap<string, string>
): Result.Result<readonly FileMode[], RenameModeConflict> {
  const modes = source.modes.map((mode): FileMode => ({
    ...mode,
    name: targets.get(mode.name) ?? mode.name,
  }));
  for (const [index, mode] of modes.entries()) {
    const clash = modes.findIndex((other, position) => position !== index && other.name === mode.name);
    const original = source.modes[index];
    if (clash === -1 || original === undefined || original.name === mode.name) continue;
    return Result.fail(
      new RenameModeConflict({
        message: `${source.name === to ? `In "${to}", renaming` : `Renaming "${source.name}" to "${to}" would rename`} its mode "${original.name}" to "${mode.name}" would clash with another of its modes, which already is or becomes "${mode.name}". Rename or delete one of them in Figma, then sync again.`,
        collection: source.name,
        mode: original.name,
        target: mode.name,
      })
    );
  }
  return Result.succeed(modes);
}

type PlannedValueChange = Extract<PlannedChange, { readonly _tag: "SetValue" }>;

/**
 * Order the value writes so that every variable's values follow the values of each variable
 * it aliases. Figma applies values in array order and refuses an alias cycle, and it does
 * not say whether it checks after each value or once at the end. Writes in set order can
 * pass through a cycle when the tokens reverse an alias, because the new alias would land
 * while the old one still points back. In this order every alias a write adds points at a
 * variable whose values, and whose targets' values, already hold their final values, and
 * `makeVariableSet` proved that final graph acyclic. Variables keep set order where aliases
 * do not force another.
 */
function aliasTargetsFirst(
  desired: VariableSet,
  values: readonly PlannedValueChange[]
): PlannedValueChange[] {
  const byVariable = new Map<string, PlannedValueChange[]>();
  for (const change of values) {
    const name = qualifiedName(change.collection, change.variable);
    byVariable.set(name, [...(byVariable.get(name) ?? []), change]);
  }
  return aliasOrder(desired).flatMap((name) => byVariable.get(name) ?? []);
}

/** Every variable of the set by qualified name, each one after the variables it aliases. */
function aliasOrder(desired: VariableSet): readonly string[] {
  const specs = new Map(
    desired.collections.flatMap((collection) =>
      collection.variables.map(
        (variable) => [qualifiedName(collection.name, variable.name), variable] as const
      )
    )
  );
  const order: string[] = [];
  const placed = new Set<string>();
  // A depth-first walk that places each variable after its targets. The set has no cycle,
  // so marking a variable before its targets are placed never cuts a chain short.
  const place = (name: string): void => {
    if (placed.has(name)) return;
    placed.add(name);
    for (const value of specs.get(name)?.values.values() ?? []) {
      if (value._tag === "Alias") place(qualifiedName(value.target.collection, value.target.variable));
    }
    order.push(name);
  };
  for (const name of specs.keys()) place(name);
  return order;
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
        write: { _tag: "CreateCollection", id, name: spec.name, initialModeId: initialMode.id },
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
 * the set's mode counts, or 2. Renaming the last stale mode instead would keep its id, but
 * it would also turn an unrelated theme into the new one.
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
    const fileType = fileTypeName(found.type);
    return Result.fail(
      new VariableTypeConflict({
        message: `"${qualifiedName(collection, spec.name)}" is a ${fileType} variable in Figma but the tokens define a ${spec.type}. Figma cannot change a variable's type; delete it in Figma and sync again, then rebind the layers that used it.`,
        collection,
        variable: spec.name,
        fileType,
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

function valueChanges(match: CollectionMatch, ids: ReadonlyMap<string, VariableId>): PlannedValueChange[] {
  const collection = match.spec.name;
  return match.variables.flatMap((target) =>
    match.modes.flatMap((mode): PlannedValueChange[] => {
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
  const collections: CollectionChange[] = [];
  const modes: ModeChange[] = [];
  const variables: VariableChange[] = [];
  const values: ValueChange[] = [];
  for (const change of changes) {
    switch (change._tag) {
      case "CreateCollection":
      case "RenameCollection":
      case "DeleteCollection":
        collections.push(change.write);
        break;
      case "CreateMode":
      case "RenameMode":
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
 * code syntax, the file's Android and iOS entries included, because an update replaces code
 * syntax and would drop the entries it leaves out. Without web syntax the write leaves code
 * syntax out entirely.
 */
function metadataOf(spec: VariableSpec, fileSyntax: CodeSyntax): VariableMetadata {
  return {
    scopes: spec.scopes,
    codeSyntax: spec.webSyntax === undefined ? undefined : { ...fileSyntax, WEB: spec.webSyntax },
    description: spec.description,
  };
}

/**
 * Scopes compare as sets because Figma does not document their order. Of the code syntax,
 * the sync owns only the web entry, and only on the variables it sets one for. The sync owns
 * every description, so a description a designer wrote counts as drift.
 */
function sameMetadata(found: FileVariable, spec: VariableSpec): boolean {
  const scopes = new Set(found.scopes);
  return (
    scopes.size === spec.scopes.length &&
    spec.scopes.every((scope) => scopes.has(scope)) &&
    (spec.webSyntax === undefined || found.codeSyntax.WEB === spec.webSyntax) &&
    found.description === spec.description
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
