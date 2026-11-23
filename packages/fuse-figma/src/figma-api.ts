/**
 * The Figma Variables REST API. This module owns the protocol: authentication, response
 * decoding, request encoding, error classification and retries. Everything else sees
 * `FileVariables` and `ChangeBatch`.
 */

import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";

import { CollectionId, ModeId, VariableId } from "./file-variables.ts";
import type {
  ChangeBatch,
  CodeSyntax,
  CollectionChange,
  FileCollection,
  FileValue,
  FileVariable,
  FileVariables,
  ModeChange,
  ValueChange,
  VariableChange,
  VariableMetadata,
  WriteValue,
} from "./file-variables.ts";

/** The key in a Figma file URL, `figma.com/design/<key>/…`; a branch key also works. */
export const FileKey = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[A-Za-z0-9]+$/, { message: "A Figma file key has only letters and digits" })
  ),
  Schema.brand("FileKey")
);

/** A parsed Figma file key. */
export type FileKey = typeof FileKey.Type;

/** Which call failed, for messages and telemetry. */
export type FigmaOperation = "read variables" | "write variables";

/**
 * Why a call never got an answer. It keeps the request line and drops the request itself,
 * whose headers carry the token.
 */
const TransportFailure = Schema.Struct({
  /** The `HttpClientError` reason, such as `TransportError`. */
  reason: Schema.String,
  method: Schema.String,
  url: Schema.String,
});

/** Figma answered with an error, could not be reached, or sent a body the sync cannot read. */
export class FigmaRequestFailed extends Schema.TaggedError<FigmaRequestFailed>()("FigmaRequestFailed", {
  message: Schema.String,
  operation: Schema.Literals(["read variables", "write variables"]),
  status: Schema.optionalKey(Schema.Finite),
  cause: Schema.optionalKey(TransportFailure),
}) {}

/** `FIGMA_TOKEN` is unset or empty. */
export class FigmaTokenMissing extends Schema.TaggedError<FigmaTokenMissing>()("FigmaTokenMissing", {
  message: Schema.String,
}) {}

/** The Figma calls a sync needs. */
export class FigmaApi extends Context.Service<
  FigmaApi,
  {
    /** Read the local variables a sync may own. */
    readonly readVariables: (fileKey: FileKey) => Effect.Effect<FileVariables, FigmaRequestFailed>;

    /**
     * Apply one batch in order, splitting it into requests within Figma's 4 MB body limit
     * when needed. Figma applies each request completely or not at all. If a later request
     * fails, Figma keeps the requests it accepted before it, and the error says how many.
     * The next sync plans from the file as it is. It matches by name what those requests
     * created and writes only the rest.
     */
    readonly writeVariables: (
      fileKey: FileKey,
      batch: ChangeBatch
    ) => Effect.Effect<void, FigmaRequestFailed>;
  }
>()("@elmeragroup/fuse-figma/FigmaApi") {
  /** The REST implementation, authenticated with `FIGMA_TOKEN`. */
  static readonly layer = Layer.effect(
    FigmaApi,
    Effect.gen(function* () {
      const token = yield* Config.schema(Schema.Redacted(Schema.NonEmptyString), "FIGMA_TOKEN").pipe(
        Effect.mapError(
          () =>
            new FigmaTokenMissing({
              message:
                "Set FIGMA_TOKEN to a Figma personal access token with the file_variables:read and file_variables:write scopes. Create one under Settings → Security in Figma.",
            })
        )
      );
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest((request) =>
          request.pipe(
            HttpClientRequest.prependUrl(FIGMA_API),
            HttpClientRequest.setHeader(TOKEN_HEADER, Redacted.value(token)),
            HttpClientRequest.acceptJson
          )
        ),
        // A host that opts into span header capture (`HttpClient.TracerHeaderFilter`) gets every
        // request header recorded, masked only by `CurrentRedactedNames`, whose defaults do not
        // include Figma's token header.
        HttpClient.transform((response) =>
          response.pipe(
            Effect.updateService(Headers.CurrentRedactedNames, (names) => [...names, TOKEN_HEADER])
          )
        ),
        HttpClient.filterStatusOk
      );

      const readVariables = Effect.fn("FigmaApi.readVariables")(function* (fileKey: FileKey) {
        yield* Effect.annotateCurrentSpan({ fileKey });
        const response = yield* client
          .get(`/v1/files/${fileKey}/variables/local`)
          .pipe(withRetries("read variables"));
        const body = yield* HttpClientResponse.schemaBodyJson(LocalVariablesResponse)(response).pipe(
          Effect.mapError((cause) => invalidBody("read variables", cause.message))
        );
        return fileVariables(body);
      });

      /**
       * Apply a batch in requests that each stay within Figma's body limit, in the order one
       * request would apply it. A batch within the limit goes out as one request. Each later
       * request refers to what earlier ones created by the real ids Figma returned, because
       * a temporary id names nothing outside its own request. When another request follows,
       * the write fails if Figma's response omits the real id of any object the request
       * created. Before it sends anything, the write fails if one change alone, or the
       * collection and mode changes together, would not fit in one request.
       */
      const writeVariables = Effect.fn("FigmaApi.writeVariables")(function* (
        fileKey: FileKey,
        batch: ChangeBatch
      ) {
        yield* Effect.annotateCurrentSpan({ fileKey });
        const tooLarge = sizeProblem(batch);
        if (tooLarge !== undefined) {
          return yield* new FigmaRequestFailed({
            message: `Could not write variables: ${tooLarge} The sync sent nothing.`,
            operation: "write variables",
          });
        }
        const realIds = new Map<string, string>();
        const real: RealId = (id) => realIds.get(id) ?? id;
        // Counts a request as applied once Figma answers it with a 200, before its body is
        // read, and the failure note reads the count when the write fails.
        let applied = 0;
        yield* Effect.gen(function* () {
          let cursor = START;
          while (!isDone(batch, cursor)) {
            const request = yield* Effect.fromResult(nextRequest(batch, cursor, real)).pipe(
              Effect.mapError(
                (problem) =>
                  new FigmaRequestFailed({
                    message: `Could not write variables: ${problem}`,
                    operation: "write variables",
                  })
              )
            );
            const response = yield* client
              .execute(
                HttpClientRequest.post(`/v1/files/${fileKey}/variables`).pipe(
                  HttpClientRequest.bodyJsonUnsafe(request.body)
                )
              )
              .pipe(withRetries("write variables"));
            applied += 1;
            cursor = request.next;
            if (isDone(batch, cursor)) {
              // Read the body anyway, so the connection can serve the next call.
              yield* Effect.ignore(response.arrayBuffer);
              continue;
            }
            const created = yield* createdRealIds(response, createdIds(request.body));
            for (const [temporary, realId] of created) realIds.set(temporary, realId);
          }
        }).pipe(Effect.mapError((error) => annotateWriteFailure(error, applied)));
        yield* Effect.annotateCurrentSpan({ requests: applied });
      });

      return FigmaApi.of({ readVariables, writeVariables });
    })
  );
}

const FIGMA_API = "https://api.figma.com";
const TOKEN_HEADER = "x-figma-token";
const RETRIES = 4;

/**
 * The largest request body Figma accepts. The REST page says the body "must be 4MB or less"
 * without defining a megabyte, so the sync takes the smaller reading, 4,000,000 bytes of the
 * UTF-8 JSON it sends.
 */
const MAX_BODY_BYTES = 4_000_000;

/**
 * The longest `Retry-After` the sync waits out. Figma documents no maximum, and a low-tier
 * seat can be told to wait an hour, so a longer wait fails at once and names the wait.
 */
const MAX_RETRY_AFTER = Duration.seconds(60);

/** What to do about one failed call, decided once from its error. */
type RetryDecision =
  /** Figma rate limited the call and asked for a wait the sync accepts. */
  | { readonly _tag: "RetryAfter"; readonly wait: Duration.Duration }
  /** Retry after an exponential back-off. */
  | { readonly _tag: "Backoff" }
  /** Figma rate limited the call and asked for a longer wait than the sync accepts. */
  | { readonly _tag: "WaitTooLong"; readonly wait: Duration.Duration }
  | { readonly _tag: "DoNotRetry" };

/** A failed call with the decision about it. */
type FailedCall = {
  readonly error: HttpClientError.HttpClientError;
  readonly decision: RetryDecision;
};

/**
 * Decide once what a failure means for a retry. A rate-limited call is safe to repeat
 * because Figma refuses it before doing anything. A read changes nothing, so a transport
 * failure or a server error is worth another read. A write that failed or went unanswered
 * may have been applied, and repeating it could create a second copy of every new
 * collection, so no other write failure is retried.
 */
function decide(operation: FigmaOperation, error: HttpClientError.HttpClientError): RetryDecision {
  const status = error.response?.status;
  if (status === 429) {
    return Option.match(retryAfter(error), {
      onNone: () => ({ _tag: "Backoff" }),
      onSome: (wait) =>
        Duration.isGreaterThan(wait, MAX_RETRY_AFTER)
          ? { _tag: "WaitTooLong", wait }
          : { _tag: "RetryAfter", wait },
    });
  }
  const readWorthRepeating =
    operation === "read variables" &&
    (status === undefined ? error.reason._tag === "TransportError" : status >= 500);
  return readWorthRepeating ? { _tag: "Backoff" } : { _tag: "DoNotRetry" };
}

/** A 429's `Retry-After`, which Figma sends in whole seconds. */
function retryAfter(error: HttpClientError.HttpClientError): Option.Option<Duration.Duration> {
  const header = error.response?.headers["retry-after"];
  const seconds = Number(header);
  return header !== undefined && Number.isFinite(seconds)
    ? Option.some(Duration.seconds(seconds))
    : Option.none();
}

/**
 * Retry a call up to `RETRIES` times while its decision allows it, then turn the last
 * failure into a `FigmaRequestFailed`. Each wait is as long as `Retry-After` asks, or an
 * exponential back-off, and each retry logs a warning.
 */
function withRetries(
  operation: FigmaOperation
): <A, R>(
  effect: Effect.Effect<A, HttpClientError.HttpClientError, R>
) => Effect.Effect<A, FigmaRequestFailed, R> {
  const schedule = Schedule.exponential("500 millis").pipe(
    Schedule.setInputType<FailedCall>(),
    Schedule.while(
      ({ input, attempt }) =>
        attempt <= RETRIES && (input.decision._tag === "RetryAfter" || input.decision._tag === "Backoff")
    ),
    // This runs only for a retry the condition above allows, so every warning is a real retry.
    Schedule.modifyDelay(({ input, attempt, duration }) => {
      const delay = input.decision._tag === "RetryAfter" ? input.decision.wait : duration;
      return Effect.logWarning(
        `Figma request failed (${input.error.response?.status ?? input.error.reason._tag}); retry ${attempt} of ${RETRIES} in ${Duration.format(delay)}.`
      ).pipe(Effect.as(delay));
    })
  );
  return (effect) =>
    effect.pipe(
      Effect.mapError((error): FailedCall => ({ error, decision: decide(operation, error) })),
      Effect.retry(schedule),
      Effect.catch((failure) => requestFailed(operation, failure))
    );
}

const ErrorBody = Schema.Struct({
  message: Schema.optionalKey(Schema.String),
  err: Schema.optionalKey(Schema.String),
});

/**
 * Classify a failed call. Figma explains most refusals in the body's `message` field, or
 * `err` on older endpoints, so that text leads and a hint on what to check follows.
 */
const requestFailed = Effect.fnUntraced(function* (
  operation: FigmaOperation,
  { error, decision }: FailedCall
): Effect.fn.Return<never, FigmaRequestFailed> {
  const response = error.response;
  if (response === undefined) {
    return yield* new FigmaRequestFailed({
      message: `Could not ${operation}: ${error.message}`,
      operation,
      cause: { reason: error.reason._tag, method: error.request.method, url: error.request.url },
    });
  }
  const body = yield* HttpClientResponse.schemaBodyJson(ErrorBody)(response).pipe(Effect.option);
  const explanation = Option.flatMap(body, ({ message, err }) => Option.fromNullishOr(message ?? err));
  const answer = Option.match(explanation, {
    onNone: () => `${response.status}`,
    onSome: (text) => `${response.status} (${text})`,
  });
  return yield* new FigmaRequestFailed({
    message: `Could not ${operation}: Figma answered ${answer}.${statusHint(response.status, decision)}`,
    operation,
    status: response.status,
  });
});

function statusHint(status: number, decision: RetryDecision): string {
  switch (status) {
    case 401:
      return " Check that FIGMA_TOKEN is a valid personal access token.";
    case 403:
      return " The Variables REST API needs an Enterprise plan, a Full seat with edit access to the file, and a token with the file_variables:read and file_variables:write scopes.";
    case 404:
      return " Check the file key; it is the part after /design/ in the file URL.";
    case 429:
      return decision._tag === "WaitTooLong"
        ? ` Figma asked the sync to wait ${Duration.toSeconds(decision.wait)} seconds before the next request, longer than the ${Duration.toSeconds(MAX_RETRY_AFTER)} seconds it waits; try again later.`
        : " Figma is still rate limiting after several retries; try again later.";
    default:
      return "";
  }
}

/**
 * Add what a failed write leaves in the file and what to do next. A request that got no
 * response may or may not have been applied, so only the requests Figma answered count as
 * kept. A 500 on the first request has one possible cause, a new file that refuses REST
 * writes. Seen on 2026-11-16: a new file answered even a one-collection write with this 500
 * until a plugin session created and deleted a collection in it; then it took the whole
 * first sync.
 */
function annotateWriteFailure(error: FigmaRequestFailed, applied: number): FigmaRequestFailed {
  const unanswered = error.cause !== undefined;
  const note = unanswered
    ? unknownOutcome(applied)
    : applied > 0
      ? keptRequests(applied)
      : error.status === 500
        ? "A new file can refuse every REST variable write until an editor session has made one. Open it in Figma, create a variable collection, delete it, then sync again."
        : "";
  if (note === "") return error;
  const fields: FailureFields = {
    message: `${error.message}${error.message.endsWith(".") ? " " : ". "}${note}`,
    operation: error.operation,
  };
  if (error.status !== undefined) fields.status = error.status;
  if (error.cause !== undefined) fields.cause = error.cause;
  return new FigmaRequestFailed(fields);
}

/** What a write that lost its last response leaves in the file and what to do about it. */
function unknownOutcome(applied: number): string {
  const confirmed =
    applied === 0
      ? ""
      : `Figma kept the first ${applied === 1 ? "request" : `${String(applied)} requests`} of this sync. `;
  return `${confirmed}Whether Figma applied the last request is unknown. The next sync reads the file and writes whatever is missing.`;
}

/** The fields of a `FigmaRequestFailed`, writable so the optional ones can be added one by one. */
type FailureFields = {
  -readonly [K in keyof ConstructorParameters<typeof FigmaRequestFailed>[0]]: ConstructorParameters<
    typeof FigmaRequestFailed
  >[0][K];
};

function invalidBody(operation: FigmaOperation, detail: string): FigmaRequestFailed {
  return new FigmaRequestFailed({
    message: `Could not ${operation}: Figma sent a response the sync cannot read. ${detail}`,
    operation,
  });
}

/** The editable metadata of a variable in a POST. Only the fields the sync sets are present. */
type VariableMetadataRequest = {
  readonly scopes: readonly string[];
  readonly codeSyntax?: CodeSyntax;
  readonly description: string;
};

type CollectionRequest =
  | {
      readonly action: "CREATE";
      readonly id: string;
      readonly name: string;
      readonly initialModeId: string;
      readonly hiddenFromPublishing: false;
    }
  | { readonly action: "UPDATE"; readonly id: string; readonly name: string }
  | { readonly action: "DELETE"; readonly id: string };

type ModeRequest =
  | {
      readonly action: "CREATE" | "UPDATE";
      readonly id: string;
      readonly name: string;
      readonly variableCollectionId: string;
    }
  | { readonly action: "DELETE"; readonly id: string; readonly variableCollectionId: string };

type VariableRequest =
  | (VariableMetadataRequest & {
      readonly action: "CREATE";
      readonly id: string;
      readonly name: string;
      readonly variableCollectionId: string;
      readonly resolvedType: string;
    })
  | (VariableMetadataRequest & { readonly action: "UPDATE"; readonly id: string })
  | { readonly action: "DELETE"; readonly id: string };

type ValueRequest = {
  readonly variableId: string;
  readonly modeId: string;
  readonly value:
    | (typeof Rgba)["Type"]
    | number
    | string
    | { readonly type: "VARIABLE_ALIAS"; readonly id: string };
};

/** `POST /v1/files/:key/variables`, as the REST API documents it. */
type PostVariablesBody = {
  readonly variableCollections: readonly CollectionRequest[];
  readonly variableModes: readonly ModeRequest[];
  readonly variables: readonly VariableRequest[];
  readonly variableModeValues: readonly ValueRequest[];
};

/**
 * Turns an id a change refers to into the id a request sends. An id that an earlier request
 * of the same write created becomes the real id Figma returned for it, and every other id
 * stays as it is.
 */
type RealId = (id: CollectionId | ModeId | VariableId) => string;

function collectionRequest(change: CollectionChange, real: RealId): CollectionRequest {
  switch (change._tag) {
    case "CreateCollection":
      return {
        action: "CREATE",
        id: change.id,
        name: change.name,
        initialModeId: change.initialModeId,
        hiddenFromPublishing: false,
      };
    case "RenameCollection":
      return { action: "UPDATE", id: real(change.id), name: change.name };
    case "DeleteCollection":
      return { action: "DELETE", id: real(change.id) };
  }
}

function modeRequest(change: ModeChange, real: RealId): ModeRequest {
  switch (change._tag) {
    case "NameInitialMode":
    case "RenameMode":
      return {
        action: "UPDATE",
        id: real(change.id),
        name: change.name,
        variableCollectionId: real(change.collectionId),
      };
    case "CreateMode":
      return {
        action: "CREATE",
        id: change.id,
        name: change.name,
        variableCollectionId: real(change.collectionId),
      };
    case "DeleteMode":
      return { action: "DELETE", id: real(change.id), variableCollectionId: real(change.collectionId) };
  }
}

function variableRequest(change: VariableChange, real: RealId): VariableRequest {
  switch (change._tag) {
    case "CreateVariable":
      return {
        action: "CREATE",
        id: change.id,
        name: change.name,
        variableCollectionId: real(change.collectionId),
        resolvedType: change.type,
        ...metadataRequest(change.metadata),
      };
    case "UpdateVariable":
      return { action: "UPDATE", id: real(change.id), ...metadataRequest(change.metadata) };
    case "DeleteVariable":
      return { action: "DELETE", id: real(change.id) };
  }
}

/** `codeSyntax` is present only when the metadata sets one, and then it is complete. */
function metadataRequest(metadata: VariableMetadata): VariableMetadataRequest {
  const { scopes, codeSyntax, description } = metadata;
  return codeSyntax === undefined ? { scopes, description } : { scopes, codeSyntax, description };
}

function valueRequest(change: ValueChange, real: RealId): ValueRequest {
  return {
    variableId: real(change.variableId),
    modeId: real(change.modeId),
    value: writeValue(change.value, real),
  };
}

function writeValue(value: WriteValue, real: RealId): ValueRequest["value"] {
  switch (value._tag) {
    case "Alias":
      return { type: "VARIABLE_ALIAS", id: real(value.id) };
    case "Color":
      return value.color;
    case "Float":
    case "String":
      return value.value;
  }
}

/** The index of the first unsent change in each of the batch's lists. */
type Cursor = {
  readonly collections: number;
  readonly modes: number;
  readonly variables: number;
  readonly values: number;
};

const START: Cursor = { collections: 0, modes: 0, variables: 0, values: 0 };

function isDone(batch: ChangeBatch, cursor: Cursor): boolean {
  return (
    cursor.collections === batch.collections.length &&
    cursor.modes === batch.modes.length &&
    cursor.variables === batch.variables.length &&
    cursor.values === batch.values.length
  );
}

/** One request of a write and where the next request starts. */
type NextRequest = {
  readonly body: PostVariablesBody;
  readonly next: Cursor;
};

/** The entries `nextRequest` took from one of the batch's lists, and the index of the first one left. */
type Filled<R> = { readonly items: readonly R[]; readonly next: number };

/** One entry of one of a POST body's lists. */
type BodyItem = PostVariablesBody[keyof PostVariablesBody][number];

const textEncoder = new TextEncoder();

/** The UTF-8 length of a value as JSON, the encoding `bodyJsonUnsafe` sends. */
function jsonBytes(value: PostVariablesBody | BodyItem): number {
  return textEncoder.encode(JSON.stringify(value)).byteLength;
}

const EMPTY_BODY_BYTES = jsonBytes({
  variableCollections: [],
  variableModes: [],
  variables: [],
  variableModeValues: [],
});

/**
 * The next request of a write. It holds the unsent changes in the order Figma applies them,
 * up to the last one that keeps the body within `MAX_BODY_BYTES`. Once a change does not
 * fit, no change after it goes into this request, so the requests together apply the batch
 * in the order one request would. The byte count is exact, because a JSON array is its
 * entries joined by commas. `sizeProblem` has checked that every change fits an empty
 * request, but real ids are longer than temporary ones, so a change that no longer fits an
 * empty request fails here rather than go out alone.
 */
function nextRequest(batch: ChangeBatch, cursor: Cursor, real: RealId): Result.Result<NextRequest, string> {
  let bytes = EMPTY_BODY_BYTES;
  let full = false;
  let tooLarge: string | undefined;
  /** The changes from `from` on that still fit, and the index of the first one left. */
  const fill = <C, R extends BodyItem>(
    changes: readonly C[],
    from: number,
    encode: (change: C, real: RealId) => R,
    describe: (change: C, names: BatchNames) => string
  ): Filled<R> => {
    const items: R[] = [];
    if (full) return { items, next: from };
    for (let index = from; index < changes.length; index += 1) {
      const change = changes[index];
      if (change === undefined) return { items, next: index };
      const item = encode(change, real);
      const size = jsonBytes(item) + (items.length > 0 ? 1 : 0);
      if (bytes + size > MAX_BODY_BYTES) {
        if (bytes === EMPTY_BODY_BYTES) tooLarge = tooLargeAlone(describe(change, batchNames(batch)), size);
        full = true;
        return { items, next: index };
      }
      items.push(item);
      bytes += size;
    }
    return { items, next: changes.length };
  };

  const collections = fill(batch.collections, cursor.collections, collectionRequest, collectionLabel);
  const modes = fill(batch.modes, cursor.modes, modeRequest, modeLabel);
  const variables = fill(batch.variables, cursor.variables, variableRequest, variableLabel);
  const values = fill(batch.values, cursor.values, valueRequest, valueLabel);
  if (tooLarge !== undefined) return Result.fail(tooLarge);
  return Result.succeed({
    body: {
      variableCollections: collections.items,
      variableModes: modes.items,
      variables: variables.items,
      variableModeValues: values.items,
    },
    next: {
      collections: collections.next,
      modes: modes.next,
      variables: variables.next,
      values: values.next,
    },
  });
}

/**
 * Why the batch cannot go out within Figma's limit, checked before the write sends anything.
 * One change can be too large for a request of its own. The collection and mode changes can
 * also be too large together, and they must share the first request: a collection names its
 * first mode in a mode change, and a write that stopped between the two would leave Figma's
 * default name on that mode, which a rerun would not fix.
 */
function sizeProblem(batch: ChangeBatch): string | undefined {
  const asSent: RealId = (id) => id;
  const alone = <C, R extends BodyItem>(
    changes: readonly C[],
    encode: (change: C, real: RealId) => R,
    describe: (change: C, names: BatchNames) => string
  ): string | undefined => {
    for (const change of changes) {
      const size = jsonBytes(encode(change, asSent));
      if (EMPTY_BODY_BYTES + size > MAX_BODY_BYTES) {
        return tooLargeAlone(describe(change, batchNames(batch)), size);
      }
    }
    return undefined;
  };
  const single =
    alone(batch.collections, collectionRequest, collectionLabel) ??
    alone(batch.modes, modeRequest, modeLabel) ??
    alone(batch.variables, variableRequest, variableLabel) ??
    alone(batch.values, valueRequest, valueLabel);
  if (single !== undefined) return single;
  const structure =
    EMPTY_BODY_BYTES +
    listBytes(batch.collections.map((change) => collectionRequest(change, asSent))) +
    listBytes(batch.modes.map((change) => modeRequest(change, asSent)));
  return structure > MAX_BODY_BYTES
    ? `The collection and mode changes take ${String(structure)} bytes together, more than the ${String(MAX_BODY_BYTES)} bytes Figma accepts in one request, and they have to share one request so that each new collection gets the name of its first mode.`
    : undefined;
}

/** The bytes a list of entries adds to a JSON body: the entries and the commas between them. */
function listBytes(items: readonly BodyItem[]): number {
  return items.reduce((total, item) => total + jsonBytes(item), Math.max(items.length - 1, 0));
}

function tooLargeAlone(change: string, size: number): string {
  return `${change} alone takes ${String(size)} bytes, more than fits in the ${String(MAX_BODY_BYTES)} bytes Figma accepts in one request.`;
}

/** The names a batch gives the objects it creates or renames, by id, for messages. */
type BatchNames = {
  readonly collections: ReadonlyMap<string, string>;
  readonly modes: ReadonlyMap<string, string>;
  readonly variables: ReadonlyMap<string, string>;
};

function batchNames(batch: ChangeBatch): BatchNames {
  const collections = new Map(
    batch.collections.flatMap((change) =>
      change._tag === "DeleteCollection" ? [] : [[change.id, change.name] as const]
    )
  );
  const modes = new Map(
    batch.modes.flatMap((change) => (change._tag === "DeleteMode" ? [] : [[change.id, change.name] as const]))
  );
  const variables = new Map(
    batch.variables.flatMap((change) =>
      change._tag === "CreateVariable"
        ? [
            [
              change.id,
              `${collections.get(change.collectionId) ?? change.collectionId}/${change.name}`,
            ] as const,
          ]
        : []
    )
  );
  return { collections, modes, variables };
}

/** A change for a message, by the names the batch gives, or by id where it gives none. */
function collectionLabel(change: CollectionChange, names: BatchNames): string {
  return `Collection "${names.collections.get(change.id) ?? change.id}"`;
}

function modeLabel(change: ModeChange, names: BatchNames): string {
  return `Mode "${names.modes.get(change.id) ?? change.id}" of collection "${names.collections.get(change.collectionId) ?? change.collectionId}"`;
}

function variableLabel(change: VariableChange, names: BatchNames): string {
  return `Variable "${names.variables.get(change.id) ?? change.id}"`;
}

function valueLabel(change: ValueChange, names: BatchNames): string {
  return `The value of "${names.variables.get(change.variableId) ?? change.variableId}" in mode "${names.modes.get(change.modeId) ?? change.modeId}"`;
}

/** The temporary ids a request creates, which Figma maps to real ids in its response. */
function createdIds(body: PostVariablesBody): readonly string[] {
  return [
    ...body.variableCollections.flatMap((item) =>
      item.action === "CREATE" ? [item.id, item.initialModeId] : []
    ),
    ...body.variableModes.flatMap((item) => (item.action === "CREATE" ? [item.id] : [])),
    ...body.variables.flatMap((item) => (item.action === "CREATE" ? [item.id] : [])),
  ];
}

/**
 * What a failed write leaves in the file and what to do about it. Figma keeps every request
 * it accepted before the one that failed.
 */
function keptRequests(applied: number): string {
  const kept = applied === 1 ? "the first request" : `the first ${String(applied)} requests`;
  return `Figma kept ${kept} of this sync, so the file is partly synced. Run sync again to write the rest.`;
}

/**
 * The real ids Figma returned for the temporary ids a request created. Fails if Figma's
 * response omits any of them.
 */
const createdRealIds = Effect.fnUntraced(function* (
  response: HttpClientResponse.HttpClientResponse,
  created: readonly string[]
): Effect.fn.Return<ReadonlyMap<string, string>, FigmaRequestFailed> {
  const body = yield* HttpClientResponse.schemaBodyJson(PostVariablesResponse)(response).pipe(
    Effect.mapError((cause) => invalidBody("write variables", cause.message))
  );
  const realIds = new Map(Object.entries(body.meta?.tempIdToRealId ?? {}));
  const missing = created.find((id) => !realIds.has(id));
  if (missing !== undefined) {
    return yield* new FigmaRequestFailed({
      message: `Could not write variables: Figma's response omits the real id of ${missing}.`,
      operation: "write variables",
    });
  }
  return realIds;
});

/**
 * The response to a POST, which maps each temporary id the request created to the real id
 * of the new object.
 */
const PostVariablesResponse = Schema.Struct({
  meta: Schema.optionalKey(
    Schema.Struct({ tempIdToRealId: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)) })
  ),
});

const Rgba = Schema.Struct({ r: Schema.Finite, g: Schema.Finite, b: Schema.Finite, a: Schema.Finite });
const Rgb = Schema.Struct({ r: Schema.Finite, g: Schema.Finite, b: Schema.Finite });
const Alias = Schema.Struct({ type: Schema.Literal("VARIABLE_ALIAS"), id: Schema.String });
const ComposedColor = Schema.Struct({
  color: Schema.Union([Rgba, Rgb, Alias]),
  opacity: Schema.Union([Schema.Finite, Alias]),
});
/** Stands in for a value shape newer than the sync; `Value` decodes any such value to it. */
const UnknownValue = Schema.Struct({ unknownValue: Schema.Literal(true) });
const Value = Schema.Union([
  Schema.Boolean,
  Schema.Finite,
  Schema.String,
  Alias,
  Rgba,
  ComposedColor,
  UnknownValue,
]).pipe(Schema.catchDecoding(() => Effect.succeedSome({ unknownValue: true } as const)));
const KnownType = Schema.Literals(["BOOLEAN", "COLOR", "FLOAT", "STRING"]);

/**
 * A variable row. The planner reads its id, name, collection, scopes, code syntax and
 * description, and those decode strictly. Figma reports an empty description for a variable
 * without one. Figma has added value shapes before, so `resolvedType` accepts
 * any name and `Value` decodes a shape it does not know to `UnknownValue`. A row in a
 * collection the sync does not own therefore cannot fail the read.
 */
const LocalVariable = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  variableCollectionId: Schema.String,
  resolvedType: Schema.String,
  valuesByMode: Schema.Record(Schema.String, Value),
  remote: Schema.Boolean,
  scopes: Schema.Array(Schema.String),
  codeSyntax: Schema.Struct({
    WEB: Schema.optionalKey(Schema.String),
    ANDROID: Schema.optionalKey(Schema.String),
    iOS: Schema.optionalKey(Schema.String),
  }),
  description: Schema.String,
  deletedButReferenced: Schema.optionalKey(Schema.Boolean),
});

const LocalVariableCollection = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  modes: Schema.Array(Schema.Struct({ modeId: Schema.String, name: Schema.String })),
  remote: Schema.Boolean,
  isExtension: Schema.optionalKey(Schema.Boolean),
});

const LocalVariablesResponse = Schema.Struct({
  meta: Schema.Struct({
    variables: Schema.Record(Schema.String, LocalVariable),
    variableCollections: Schema.Record(Schema.String, LocalVariableCollection),
  }),
});

type LocalVariablesResponse = typeof LocalVariablesResponse.Type;
type LocalVariable = typeof LocalVariable.Type;

function fileVariables(response: LocalVariablesResponse): FileVariables {
  const variables = Object.values(response.meta.variables).filter(
    (variable) => !variable.remote && variable.deletedButReferenced !== true
  );
  const collections = Object.values(response.meta.variableCollections)
    .filter((collection) => !collection.remote && collection.isExtension !== true)
    .map((collection): FileCollection => ({
      id: CollectionId(collection.id),
      name: collection.name,
      modes: collection.modes.map((mode) => ({ id: ModeId(mode.modeId), name: mode.name })),
      variables: variables
        .filter((variable) => variable.variableCollectionId === collection.id)
        .map(fileVariable),
    }));
  return { collections };
}

const isKnownType = Schema.is(KnownType);

function fileVariable(variable: LocalVariable): FileVariable {
  return {
    id: VariableId(variable.id),
    name: variable.name,
    type: isKnownType(variable.resolvedType)
      ? variable.resolvedType
      : { _tag: "UnknownType", name: variable.resolvedType },
    scopes: variable.scopes,
    codeSyntax: variable.codeSyntax,
    description: variable.description,
    values: new Map(
      Object.entries(variable.valuesByMode).map(
        ([modeId, value]) => [ModeId(modeId), fileValue(value)] as const
      )
    ),
  };
}

const isBoolean = Schema.is(Schema.Boolean);
const isNumber = Predicate.isNumber;
const isString = Schema.is(Schema.String);
const isAlias = Schema.is(Alias);
const isRgba = Schema.is(Rgba);
const isComposedColor = Schema.is(ComposedColor);

function fileValue(value: typeof Value.Type): FileValue {
  if (isBoolean(value)) return { _tag: "Boolean", value };
  if (isNumber(value)) return { _tag: "Float", value };
  if (isString(value)) return { _tag: "String", value };
  if (isAlias(value)) return { _tag: "Alias", id: VariableId(value.id) };
  if (isRgba(value)) return { _tag: "Color", color: value };
  if (isComposedColor(value)) return { _tag: "ComposedColor" };
  return { _tag: "Unknown" };
}
