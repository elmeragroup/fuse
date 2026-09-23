/**
 * An in-memory Figma file behind the Variables REST API, served through Effect's
 * `HttpClient` seam. It applies a POST the way the API documents: arrays in a fixed order,
 * temporary ids mapped to real ones, the whole batch atomic, and a 400 for anything the
 * API rejects. It stores numbers as 32-bit floats, as Figma does, and its reads include
 * the rows a sync must skip: library collections and variables, collection extensions and
 * deleted variables that layers still reference. Tests read the result back the way
 * designers see it, by resolving a variable in a mode context.
 */

import { Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import type { HttpClientRequest } from "effect/unstable/http";

type Rgba = { r: number; g: number; b: number; a: number };
type Alias = { type: "VARIABLE_ALIAS"; id: string };
/** A color whose channels or opacity alias other variables; opacity is a percentage. */
type ComposedColor = { color: Alias | Omit<Rgba, "a">; opacity: Alias | number };
type StoredValue = Alias | ComposedColor | Rgba | boolean | number | string;
type ResolvedType = "BOOLEAN" | "COLOR" | "FLOAT" | "STRING";
type CodeSyntax = { WEB?: string; ANDROID?: string; iOS?: string };

/**
 * Where a collection comes from. A library collection is remote, and an extension inherits
 * its parent's variables and modes; the REST API edits neither.
 */
type CollectionOrigin = "local" | "library" | "extension";

type StoredCollection = {
  id: string;
  name: string;
  origin: CollectionOrigin;
  modes: { modeId: string; name: string }[];
};

type StoredVariable = {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: ResolvedType;
  valuesByMode: Map<string, StoredValue>;
  scopes: string[];
  codeSyntax: CodeSyntax;
  /** Deleted in the editor while layers or aliases still point at it. */
  deletedButReferenced: boolean;
};

type FileState = {
  collections: Map<string, StoredCollection>;
  variables: Map<string, StoredVariable>;
};

/** The picker scopes and code syntax of a stored variable. */
export type StoredMetadata = { scopes: string[]; codeSyntax: CodeSyntax };

/** A canned reply that replaces the next matching request's normal handling. */
export type ScriptedReply = {
  readonly method: "GET" | "POST";
  readonly status: number;
  readonly headers?: Record<string, string>;
};

const MAX_MODES = 40;
const MAX_MODE_NAME = 40;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const Action = Schema.Literals(["CREATE", "UPDATE", "DELETE"]);
const PostBody = Schema.Struct({
  variableCollections: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        action: Action,
        id: Schema.String,
        name: Schema.optionalKey(Schema.String),
        initialModeId: Schema.optionalKey(Schema.String),
        hiddenFromPublishing: Schema.optionalKey(Schema.Boolean),
      })
    )
  ),
  variableModes: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        action: Action,
        id: Schema.String,
        name: Schema.optionalKey(Schema.String),
        variableCollectionId: Schema.optionalKey(Schema.String),
      })
    )
  ),
  variables: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        action: Action,
        id: Schema.String,
        name: Schema.optionalKey(Schema.String),
        variableCollectionId: Schema.optionalKey(Schema.String),
        resolvedType: Schema.optionalKey(Schema.Literals(["BOOLEAN", "COLOR", "FLOAT", "STRING"])),
        scopes: Schema.optionalKey(Schema.Array(Schema.String)),
        codeSyntax: Schema.optionalKey(
          Schema.Struct({
            WEB: Schema.optionalKey(Schema.String),
            ANDROID: Schema.optionalKey(Schema.String),
            iOS: Schema.optionalKey(Schema.String),
          })
        ),
      })
    )
  ),
  variableModeValues: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        variableId: Schema.String,
        modeId: Schema.String,
        value: Schema.Union([
          Schema.Boolean,
          Schema.Number,
          Schema.String,
          Schema.Struct({ type: Schema.Literal("VARIABLE_ALIAS"), id: Schema.String }),
          Schema.Struct({
            r: Schema.Number,
            g: Schema.Number,
            b: Schema.Number,
            a: Schema.optionalKey(Schema.Number),
          }),
        ]),
      })
    )
  ),
});
type PostBody = typeof PostBody.Type;
type PostValue = NonNullable<PostBody["variableModeValues"]>[number]["value"];

class Rejected extends Error {}

/** A Figma file with its variables, and a record of the requests it served. */
export class InMemoryFigma {
  /** Every request received, in order. */
  readonly requests: { readonly method: string; readonly path: string }[] = [];

  /** The body of every POST Figma accepted, in order. */
  readonly acceptedWrites: PostBody[] = [];

  private state: FileState = { collections: new Map(), variables: new Map() };
  private nextId = 1;
  private readonly scripted: ScriptedReply[] = [];
  private afterWrite: (() => void) | undefined;

  constructor(
    private readonly fileKey: string,
    private readonly token: string
  ) {}

  /** An `HttpClient` layer that routes every request to this file. */
  layer(): Layer.Layer<HttpClient.HttpClient> {
    return Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request) =>
        Effect.sync(() => HttpClientResponse.fromWeb(request, this.handle(request)))
      )
    );
  }

  /** Answer the next request with this method using a canned status instead. */
  script(reply: ScriptedReply): void {
    this.scripted.push(reply);
  }

  /**
   * Run `edit` once, right after the next write Figma accepts. It stands for Figma storing
   * a value differently from what the write sent.
   */
  afterNextWrite(edit: () => void): void {
    this.afterWrite = edit;
  }

  /** Add a local collection as a designer would, returning its id. */
  addCollection(name: string, modeNames: readonly string[]): string {
    return this.storeCollection(name, "local", modeNames);
  }

  /** Subscribe to a library collection, which the file reads as remote, returning its id. */
  addLibraryCollection(name: string, modeNames: readonly string[]): string {
    return this.storeCollection(name, "library", modeNames);
  }

  /** Extend a collection, as a brand theme would, returning the extension's id. */
  addExtension(name: string, parentId: string): string {
    const parent = this.collectionById(parentId);
    return this.storeCollection(
      name,
      "extension",
      parent.modes.map((mode) => mode.name)
    );
  }

  /** Add a variable to a collection by id, with the same value in every mode. */
  addVariable(collectionId: string, name: string, resolvedType: ResolvedType, value: StoredValue): string {
    const owner = this.collectionById(collectionId);
    const id = this.mintId("VariableID");
    this.state.variables.set(id, {
      id,
      name,
      variableCollectionId: owner.id,
      resolvedType,
      valuesByMode: new Map(owner.modes.map((mode) => [mode.modeId, float32(value)])),
      scopes: ["ALL_SCOPES"],
      codeSyntax: {},
      deletedButReferenced: false,
    });
    return id;
  }

  /** Delete a variable in the editor while a layer still uses it, which keeps its row. */
  deleteButKeepReferenced(variableId: string): void {
    const variable = this.state.variables.get(variableId);
    if (variable === undefined) throw new Error(`No variable ${variableId}`);
    variable.deletedButReferenced = true;
  }

  /** Change one mode value of a local variable as a designer would. */
  setValue(collection: string, variable: string, mode: string, value: StoredValue): void {
    const owner = this.collectionNamed(collection);
    this.variableNamed(collection, variable).valuesByMode.set(
      this.modeNamed(owner, mode).modeId,
      float32(value)
    );
  }

  /** Change the picker scopes and code syntax of a local variable as a designer would. */
  setMetadata(collection: string, variable: string, metadata: StoredMetadata): void {
    const stored = this.variableNamed(collection, variable);
    stored.scopes = [...metadata.scopes];
    stored.codeSyntax = { ...metadata.codeSyntax };
  }

  /** A variable's stored state by id, for rows that name lookups skip. */
  variableById(id: string) {
    const variable = this.state.variables.get(id);
    if (variable === undefined) throw new Error(`No variable ${id}`);
    return {
      name: variable.name,
      deletedButReferenced: variable.deletedButReferenced,
      values: [...variable.valuesByMode.values()],
    };
  }

  /** A mode's id, for checking which modes a sync kept. */
  modeId(collection: string, mode: string): string {
    return this.modeNamed(this.collectionNamed(collection), mode).modeId;
  }

  /** Mode ids of a collection in order. */
  modeIds(collection: string): string[] {
    return this.collectionNamed(collection).modes.map((mode) => mode.modeId);
  }

  /** Local collection names in creation order. */
  collectionNames(): string[] {
    return this.localCollections().map((collection) => collection.name);
  }

  /** Mode names of a collection in order. */
  modeNames(collection: string): string[] {
    return this.collectionNamed(collection).modes.map((mode) => mode.name);
  }

  /** Live variable names of a collection in creation order. */
  variableNames(collection: string): string[] {
    const owner = this.collectionNamed(collection);
    return this.liveVariables()
      .filter((variable) => variable.variableCollectionId === owner.id)
      .map((variable) => variable.name);
  }

  /** Every live variable id with its qualified name, for checking that ids survive a sync. */
  variableIds(): Map<string, string> {
    return new Map(
      this.liveVariables().map((variable) => [
        `${this.collectionById(variable.variableCollectionId).name}/${variable.name}`,
        variable.id,
      ])
    );
  }

  /** A collection's id. */
  collectionId(collection: string): string {
    return this.collectionNamed(collection).id;
  }

  /** The scopes and code syntax of a variable. */
  metadata(collection: string, variable: string): StoredMetadata {
    const stored = this.variableNamed(collection, variable);
    return { scopes: stored.scopes, codeSyntax: stored.codeSyntax };
  }

  /**
   * Resolve a variable the way Figma renders it on a layer. Each collection uses the mode
   * the layer sets for it, or its first mode, and aliases resolve until a literal.
   */
  resolve(
    collection: string,
    variable: string,
    modes: Readonly<Record<string, string>>
  ): Rgba | number | string | boolean {
    return this.resolveVariable(this.variableNamed(collection, variable), modes, 0);
  }

  /** The qualified names an alias chain passes through, starting at the variable itself. */
  aliasChain(collection: string, variable: string, modes: Readonly<Record<string, string>>): string[] {
    const chain: string[] = [];
    let current: StoredVariable | undefined = this.variableNamed(collection, variable);
    while (current !== undefined) {
      const owner = this.collectionById(current.variableCollectionId);
      chain.push(`${owner.name}/${current.name}`);
      const value = current.valuesByMode.get(this.contextMode(owner, modes));
      current = isAlias(value) ? this.state.variables.get(value.id) : undefined;
    }
    return chain;
  }

  private handle(request: HttpClientRequest.HttpClientRequest): Response {
    const url = new URL(request.url);
    this.requests.push({ method: request.method, path: url.pathname });
    const scriptedIndex = this.scripted.findIndex((reply) => reply.method === request.method);
    if (scriptedIndex !== -1) {
      const [reply] = this.scripted.splice(scriptedIndex, 1);
      if (reply !== undefined) {
        return errorResponse(reply.status, "Scripted failure", reply.headers);
      }
    }
    if (request.headers["x-figma-token"] !== this.token) {
      return errorResponse(403, "Invalid token");
    }
    if (url.origin !== "https://api.figma.com") {
      return errorResponse(404, "Not found");
    }
    if (request.method === "GET" && url.pathname === `/v1/files/${this.fileKey}/variables/local`) {
      return Response.json({ status: 200, error: false, meta: this.localVariables() });
    }
    if (request.method === "POST" && url.pathname === `/v1/files/${this.fileKey}/variables`) {
      return this.post(request);
    }
    return errorResponse(404, "Not found");
  }

  private localVariables() {
    const variableCollections = Object.fromEntries(
      [...this.state.collections.values()].map((collection) => [
        collection.id,
        {
          id: collection.id,
          name: collection.name,
          modes: collection.modes,
          key: `key-${collection.id}`,
          defaultModeId: collection.modes[0]?.modeId,
          remote: collection.origin === "library",
          isExtension: collection.origin === "extension",
          hiddenFromPublishing: false,
          variableIds: [...this.state.variables.values()]
            .filter((variable) => variable.variableCollectionId === collection.id)
            .map((variable) => variable.id),
        },
      ])
    );
    const variables = Object.fromEntries(
      [...this.state.variables.values()].map((variable) => [
        variable.id,
        {
          id: variable.id,
          name: variable.name,
          variableCollectionId: variable.variableCollectionId,
          resolvedType: variable.resolvedType,
          scopes: variable.scopes,
          codeSyntax: variable.codeSyntax,
          deletedButReferenced: variable.deletedButReferenced,
          key: `key-${variable.id}`,
          valuesByMode: Object.fromEntries(variable.valuesByMode),
          remote: this.collectionById(variable.variableCollectionId).origin === "library",
          description: "",
          hiddenFromPublishing: false,
        },
      ])
    );
    return { variables, variableCollections };
  }

  private post(request: HttpClientRequest.HttpClientRequest): Response {
    if (request.body._tag !== "Uint8Array") {
      return errorResponse(400, "Expected a JSON body");
    }
    if (request.body.body.byteLength > MAX_BODY_BYTES) {
      return errorResponse(413, "Request payload too large");
    }
    const decoded = Schema.decodeUnknownExit(Schema.fromJsonString(PostBody))(
      new TextDecoder().decode(request.body.body)
    );
    if (decoded._tag === "Failure") {
      return errorResponse(400, "Invalid request body");
    }
    const draft = cloneState(this.state);
    const tempIds = new Map<string, string>();
    try {
      this.apply(draft, decoded.value, tempIds);
    } catch (error) {
      if (error instanceof Rejected) {
        return errorResponse(400, error.message);
      }
      throw error;
    }
    this.state = draft;
    this.acceptedWrites.push(decoded.value);
    const edit = this.afterWrite;
    this.afterWrite = undefined;
    edit?.();
    return Response.json({
      status: 200,
      error: false,
      meta: { tempIdToRealId: Object.fromEntries(tempIds) },
    });
  }

  private apply(draft: FileState, body: PostBody, tempIds: Map<string, string>): void {
    const real = (id: string | undefined): string => (id === undefined ? "" : (tempIds.get(id) ?? id));
    const create = (tempId: string, prefix: string): string => {
      if (tempIds.has(tempId)) reject(`Duplicate temporary id ${tempId}`);
      const id = this.mintId(prefix);
      tempIds.set(tempId, id);
      return id;
    };

    const editable = (id: string | undefined): StoredCollection => {
      const collection = draft.collections.get(real(id)) ?? reject(`No collection ${id}`);
      if (collection.origin === "library") reject(`Cannot edit the remote collection ${collection.name}`);
      return collection;
    };
    const live = (id: string): StoredVariable => {
      const variable = draft.variables.get(real(id));
      if (variable === undefined || variable.deletedButReferenced) reject(`No variable ${id}`);
      if (editable(variable.variableCollectionId).origin === "extension")
        reject(`Cannot edit ${variable.name}; an extension inherits its variables`);
      return variable;
    };

    for (const change of body.variableCollections ?? []) {
      // The sync only creates collections. Failing loudly here catches a write that starts
      // doing anything else before a real file sees it.
      if (change.action !== "CREATE") {
        throw new Error(`The fake does not model collection updates or deletes (got ${change.action})`);
      }
      if (change.name === undefined || change.name === "") reject("A new collection needs a name");
      const id = create(change.id, "VariableCollectionId");
      const modeId =
        change.initialModeId === undefined ? this.mintId("Mode") : create(change.initialModeId, "Mode");
      draft.collections.set(id, {
        id,
        name: change.name ?? "",
        origin: "local",
        modes: [{ modeId, name: "Mode 1" }],
      });
    }

    for (const change of body.variableModes ?? []) {
      const collection = editable(change.variableCollectionId);
      if (collection.origin === "extension") reject(`${collection.name} inherits its modes`);
      if (change.action === "CREATE") {
        if (collection.modes.length >= MAX_MODES) reject(`A collection can have at most ${MAX_MODES} modes`);
        collection.modes.push({
          modeId: create(change.id, "Mode"),
          name: validModeName(change.name, collection),
        });
        continue;
      }
      const mode =
        collection.modes.find((candidate) => candidate.modeId === real(change.id)) ??
        reject(`No mode ${change.id}`);
      if (change.action === "UPDATE") {
        mode.name = validModeName(change.name, collection, mode.modeId);
        continue;
      }
      if (collection.modes.length === 1) reject("A collection needs at least one mode");
      collection.modes = collection.modes.filter((candidate) => candidate !== mode);
      for (const variable of draft.variables.values()) {
        if (variable.variableCollectionId === collection.id) variable.valuesByMode.delete(mode.modeId);
      }
    }

    for (const change of body.variables ?? []) {
      if (change.action === "CREATE") {
        const collection = editable(change.variableCollectionId);
        if (collection.origin === "extension") reject(`${collection.name} inherits its variables`);
        const name = change.name ?? reject("A new variable needs a name");
        if (/[.{}]/.test(name)) reject(`Invalid variable name ${name}`);
        if (
          [...draft.variables.values()].some(
            (v) => v.variableCollectionId === collection.id && v.name === name && !v.deletedButReferenced
          )
        ) {
          reject(`Duplicate variable name ${name}`);
        }
        const resolvedType = change.resolvedType ?? reject("A new variable needs a type");
        const id = create(change.id, "VariableID");
        draft.variables.set(id, {
          id,
          name,
          variableCollectionId: collection.id,
          resolvedType,
          valuesByMode: new Map(collection.modes.map((mode) => [mode.modeId, defaultValue(resolvedType)])),
          scopes: [...(change.scopes ?? ["ALL_SCOPES"])],
          codeSyntax: { ...change.codeSyntax },
          deletedButReferenced: false,
        });
        continue;
      }
      const variable = live(change.id);
      if (change.action === "DELETE") {
        draft.variables.delete(variable.id);
        continue;
      }
      if (change.scopes !== undefined) variable.scopes = [...change.scopes];
      // Figma does not document whether an UPDATE merges code syntax or replaces it. The fake
      // replaces it, the stricter rule, so a sync that keeps other platforms' entries under
      // replacement also keeps them under a merge.
      if (change.codeSyntax !== undefined) variable.codeSyntax = { ...change.codeSyntax };
    }

    for (const change of body.variableModeValues ?? []) {
      const variable = live(change.variableId);
      const collection = editable(variable.variableCollectionId);
      const modeId = real(change.modeId);
      if (!collection.modes.some((mode) => mode.modeId === modeId)) {
        reject(`Mode ${change.modeId} is not in the variable's collection`);
      }
      variable.valuesByMode.set(modeId, checkedValue(draft, variable, change.value, real));
    }

    const cycle = aliasCycleThrough(draft);
    if (cycle !== undefined) reject(`Alias cycle through ${cycle}`);
  }

  private resolveVariable(
    variable: StoredVariable,
    modes: Readonly<Record<string, string>>,
    depth: number
  ): Rgba | number | string | boolean {
    if (depth > 16) throw new Error(`Alias cycle through ${variable.name}`);
    const owner = this.collectionById(variable.variableCollectionId);
    const value = variable.valuesByMode.get(this.contextMode(owner, modes));
    if (value === undefined)
      throw new Error(`${owner.name}/${variable.name} has no value in the context mode`);
    if (isComposed(value)) throw new Error(`${owner.name}/${variable.name} holds a composed color`);
    if (!isAlias(value)) return value;
    const target = this.state.variables.get(value.id);
    if (target === undefined) throw new Error(`${owner.name}/${variable.name} aliases a missing variable`);
    return this.resolveVariable(target, modes, depth + 1);
  }

  private contextMode(collection: StoredCollection, modes: Readonly<Record<string, string>>): string {
    const wanted = modes[collection.name];
    const mode = wanted === undefined ? collection.modes[0] : this.modeNamed(collection, wanted);
    if (mode === undefined) throw new Error(`${collection.name} has no modes`);
    return mode.modeId;
  }

  private storeCollection(name: string, origin: CollectionOrigin, modeNames: readonly string[]): string {
    const id = this.mintId("VariableCollectionId");
    this.state.collections.set(id, {
      id,
      name,
      origin,
      modes: modeNames.map((modeName) => ({ modeId: this.mintId("Mode"), name: modeName })),
    });
    return id;
  }

  private localCollections(): StoredCollection[] {
    return [...this.state.collections.values()].filter((collection) => collection.origin === "local");
  }

  private liveVariables(): StoredVariable[] {
    return [...this.state.variables.values()].filter((variable) => !variable.deletedButReferenced);
  }

  private collectionNamed(name: string): StoredCollection {
    const found = this.localCollections().find((collection) => collection.name === name);
    if (found === undefined) throw new Error(`No local collection named ${name}`);
    return found;
  }

  private collectionById(id: string): StoredCollection {
    const found = this.state.collections.get(id);
    if (found === undefined) throw new Error(`No collection ${id}`);
    return found;
  }

  private modeNamed(collection: StoredCollection, name: string): { modeId: string; name: string } {
    const found = collection.modes.find((mode) => mode.name === name);
    if (found === undefined) throw new Error(`${collection.name} has no mode ${name}`);
    return found;
  }

  private variableNamed(collection: string, name: string): StoredVariable {
    const owner = this.collectionNamed(collection);
    const found = this.liveVariables().find(
      (variable) => variable.variableCollectionId === owner.id && variable.name === name
    );
    if (found === undefined) throw new Error(`No variable ${collection}/${name}`);
    return found;
  }

  private mintId(prefix: string): string {
    const id = `${prefix}:1:${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}

function reject(message: string): never {
  throw new Rejected(message);
}

function errorResponse(status: number, message: string, headers?: Record<string, string>): Response {
  const body = { status, error: true, message };
  if (headers === undefined) return Response.json(body, { status });
  return Response.json(body, { status, headers });
}

function validModeName(name: string | undefined, collection: StoredCollection, self?: string): string {
  if (name === undefined || name === "") reject("A mode needs a name");
  if (name.length > MAX_MODE_NAME) reject(`Mode names cannot be longer than ${MAX_MODE_NAME} characters`);
  if (collection.modes.some((mode) => mode.name === name && mode.modeId !== self))
    reject(`Duplicate mode name ${name}`);
  return name;
}

function defaultValue(type: ResolvedType): StoredValue {
  switch (type) {
    case "BOOLEAN":
      return false;
    case "COLOR":
      return { r: 1, g: 1, b: 1, a: 1 };
    case "FLOAT":
      return 0;
    case "STRING":
      return "";
  }
}

function checkedValue(
  draft: FileState,
  variable: StoredVariable,
  value: PostValue,
  real: (id: string) => string
): StoredValue {
  if (isAlias(value)) {
    const target = draft.variables.get(real(value.id)) ?? reject(`Alias to missing variable ${value.id}`);
    if (target.id === variable.id) reject("A variable cannot alias itself");
    if (target.resolvedType !== variable.resolvedType)
      reject(`Alias from ${variable.resolvedType} to ${target.resolvedType}`);
    return { type: "VARIABLE_ALIAS", id: target.id };
  }
  switch (variable.resolvedType) {
    case "COLOR": {
      if (!(value instanceof Object) || !("r" in value)) reject(`${variable.name} needs a color`);
      const color = { r: value.r, g: value.g, b: value.b, a: value.a ?? 1 };
      if (Object.values(color).some((channel) => channel < 0 || channel > 1))
        reject("Color channels must be in 0..1");
      return float32(color);
    }
    case "FLOAT":
      return Number.isFinite(value) ? float32(Number(value)) : reject(`${variable.name} needs a number`);
    case "STRING":
      return Schema.is(Schema.String)(value) ? value : reject(`${variable.name} needs a string`);
    case "BOOLEAN":
      return value === true || value === false ? value : reject(`${variable.name} needs a boolean`);
  }
}

/**
 * A variable on an alias cycle, or `undefined`. Figma does not document how it treats a
 * cycle that only closes across modes, so the fake applies the sync's own conservative rule:
 * a variable points at every variable any of its modes aliases, and any cycle is refused.
 * It follows each chain from every variable, which is slow but plain, and the files in the
 * tests hold a few hundred variables.
 */
function aliasCycleThrough(state: FileState): string | undefined {
  const aliased = (variable: StoredVariable): StoredVariable[] =>
    [...variable.valuesByMode.values()].flatMap((value) => {
      const target = isAlias(value) ? state.variables.get(value.id) : undefined;
      return target === undefined ? [] : [target];
    });
  for (const start of state.variables.values()) {
    const seen = new Set<StoredVariable>();
    const pending = aliased(start);
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (next === start) return start.name;
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...aliased(next));
    }
  }
  return undefined;
}

function isAlias(value: StoredValue | PostValue | undefined): value is Alias {
  return value instanceof Object && "type" in value;
}

function isComposed(value: StoredValue): value is ComposedColor {
  return value instanceof Object && "opacity" in value;
}

/** Figma stores numbers and color channels as 32-bit floats. */
function float32(value: StoredValue): StoredValue {
  if (Number.isFinite(value)) return Math.fround(Number(value));
  if (value instanceof Object && "r" in value && "a" in value) {
    return {
      r: Math.fround(value.r),
      g: Math.fround(value.g),
      b: Math.fround(value.b),
      a: Math.fround(value.a),
    };
  }
  return value;
}

function cloneState(state: FileState): FileState {
  return {
    collections: new Map(
      [...state.collections].map(([id, collection]) => [
        id,
        { ...collection, modes: collection.modes.map((mode) => ({ ...mode })) },
      ])
    ),
    variables: new Map(
      [...state.variables].map(([id, variable]) => [
        id,
        {
          ...variable,
          valuesByMode: new Map(variable.valuesByMode),
          scopes: [...variable.scopes],
          codeSyntax: { ...variable.codeSyntax },
          deletedButReferenced: variable.deletedButReferenced,
        },
      ])
    ),
  };
}
