/**
 * The Figma Variables REST API. This module owns the protocol: authentication, response
 * decoding, request encoding, error classification and retries. Everything else sees
 * `FileVariables` and `ChangeBatch`.
 */

import { Config, Context, Duration, Effect, Layer, Option, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import type { HttpClientError } from "effect/unstable/http";

import { CollectionId, ModeId, VariableId } from "./file-variables.ts";
import type {
  ChangeBatch,
  CodeSyntax,
  FileCollection,
  FileValue,
  FileVariable,
  FileVariables,
  ModeChange,
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

/** Figma answered with an error, could not be reached, or sent a body the sync cannot read. */
export class FigmaRequestFailed extends Schema.TaggedError<FigmaRequestFailed>()("FigmaRequestFailed", {
  message: Schema.String,
  operation: Schema.Literals(["read variables", "write variables"]),
  status: Schema.optionalKey(Schema.Number),
  cause: Schema.optionalKey(Schema.Defect()),
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

    /** Apply one batch; Figma applies all of it or none of it. */
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
            HttpClientRequest.setHeader("X-Figma-Token", Redacted.value(token)),
            HttpClientRequest.acceptJson
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

      const writeVariables = Effect.fn("FigmaApi.writeVariables")(function* (
        fileKey: FileKey,
        batch: ChangeBatch
      ) {
        yield* Effect.annotateCurrentSpan({ fileKey });
        const request = HttpClientRequest.post(`/v1/files/${fileKey}/variables`).pipe(
          HttpClientRequest.bodyJsonUnsafe(postVariablesBody(batch))
        );
        yield* client.execute(request).pipe(withRetries("write variables"));
      });

      return FigmaApi.of({ readVariables, writeVariables });
    })
  );
}

const FIGMA_API = "https://api.figma.com";
const RETRIES = 4;

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
      cause: error,
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
};

/** `POST /v1/files/:key/variables`, as the REST API documents it. */
type PostVariablesBody = {
  readonly variableCollections: readonly {
    readonly action: "CREATE";
    readonly id: string;
    readonly name: string;
    readonly initialModeId: string;
    readonly hiddenFromPublishing: false;
  }[];
  readonly variableModes: readonly (
    | {
        readonly action: "CREATE" | "UPDATE";
        readonly id: string;
        readonly name: string;
        readonly variableCollectionId: string;
      }
    | { readonly action: "DELETE"; readonly id: string; readonly variableCollectionId: string }
  )[];
  readonly variables: readonly (
    | (VariableMetadataRequest & {
        readonly action: "CREATE";
        readonly id: string;
        readonly name: string;
        readonly variableCollectionId: string;
        readonly resolvedType: string;
      })
    | (VariableMetadataRequest & { readonly action: "UPDATE"; readonly id: string })
    | { readonly action: "DELETE"; readonly id: string }
  )[];
  readonly variableModeValues: readonly {
    readonly variableId: string;
    readonly modeId: string;
    readonly value:
      | (typeof Rgba)["Type"]
      | number
      | string
      | { readonly type: "VARIABLE_ALIAS"; readonly id: string };
  }[];
};

function postVariablesBody(batch: ChangeBatch): PostVariablesBody {
  return {
    variableCollections: batch.collections.map((collection) => ({
      action: "CREATE",
      id: collection.id,
      name: collection.name,
      initialModeId: collection.initialModeId,
      hiddenFromPublishing: false,
    })),
    variableModes: batch.modes.map(modeRequest),
    variables: batch.variables.map(variableRequest),
    variableModeValues: batch.values.map((change) => ({
      variableId: change.variableId,
      modeId: change.modeId,
      value: valueRequest(change.value),
    })),
  };
}

function modeRequest(change: ModeChange): PostVariablesBody["variableModes"][number] {
  switch (change._tag) {
    case "NameInitialMode":
      return {
        action: "UPDATE",
        id: change.id,
        name: change.name,
        variableCollectionId: change.collectionId,
      };
    case "CreateMode":
      return {
        action: "CREATE",
        id: change.id,
        name: change.name,
        variableCollectionId: change.collectionId,
      };
    case "DeleteMode":
      return { action: "DELETE", id: change.id, variableCollectionId: change.collectionId };
  }
}

function variableRequest(change: VariableChange): PostVariablesBody["variables"][number] {
  switch (change._tag) {
    case "CreateVariable":
      return {
        action: "CREATE",
        id: change.id,
        name: change.name,
        variableCollectionId: change.collectionId,
        resolvedType: change.type,
        ...metadataRequest(change.metadata),
      };
    case "UpdateVariable":
      return { action: "UPDATE", id: change.id, ...metadataRequest(change.metadata) };
    case "DeleteVariable":
      return { action: "DELETE", id: change.id };
  }
}

/** `codeSyntax` is present only when the metadata sets one, and then it is complete. */
function metadataRequest(metadata: VariableMetadata): VariableMetadataRequest {
  return metadata.codeSyntax === undefined
    ? { scopes: metadata.scopes }
    : { scopes: metadata.scopes, codeSyntax: metadata.codeSyntax };
}

function valueRequest(value: WriteValue): PostVariablesBody["variableModeValues"][number]["value"] {
  switch (value._tag) {
    case "Alias":
      return { type: "VARIABLE_ALIAS", id: value.id };
    case "Color":
      return value.color;
    case "Float":
    case "String":
      return value.value;
  }
}

const Rgba = Schema.Struct({ r: Schema.Number, g: Schema.Number, b: Schema.Number, a: Schema.Number });
const Rgb = Schema.Struct({ r: Schema.Number, g: Schema.Number, b: Schema.Number });
const Alias = Schema.Struct({ type: Schema.Literal("VARIABLE_ALIAS"), id: Schema.String });
const ComposedColor = Schema.Struct({
  color: Schema.Union([Rgba, Rgb, Alias]),
  opacity: Schema.Union([Schema.Number, Alias]),
});
const Value = Schema.Union([Schema.Boolean, Schema.Number, Schema.String, Alias, Rgba, ComposedColor]);

const LocalVariable = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  variableCollectionId: Schema.String,
  resolvedType: Schema.Literals(["BOOLEAN", "COLOR", "FLOAT", "STRING"]),
  valuesByMode: Schema.Record(Schema.String, Value),
  remote: Schema.Boolean,
  scopes: Schema.Array(Schema.String),
  codeSyntax: Schema.Struct({
    WEB: Schema.optionalKey(Schema.String),
    ANDROID: Schema.optionalKey(Schema.String),
    iOS: Schema.optionalKey(Schema.String),
  }),
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

function fileVariable(variable: LocalVariable): FileVariable {
  return {
    id: VariableId(variable.id),
    name: variable.name,
    type: variable.resolvedType,
    scopes: variable.scopes,
    codeSyntax: variable.codeSyntax,
    values: new Map(
      Object.entries(variable.valuesByMode).map(
        ([modeId, value]) => [ModeId(modeId), fileValue(value)] as const
      )
    ),
  };
}

const isBoolean = Schema.is(Schema.Boolean);
const isNumber = Schema.is(Schema.Number);
const isString = Schema.is(Schema.String);
const isAlias = Schema.is(Alias);
const isRgba = Schema.is(Rgba);

function fileValue(value: typeof Value.Type): FileValue {
  if (isBoolean(value)) return { _tag: "Boolean", value };
  if (isNumber(value)) return { _tag: "Float", value };
  if (isString(value)) return { _tag: "String", value };
  if (isAlias(value)) return { _tag: "Alias", id: VariableId(value.id) };
  if (isRgba(value)) return { _tag: "Color", color: value };
  return { _tag: "ComposedColor" };
}
