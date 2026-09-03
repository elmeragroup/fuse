import { Schema } from "effect";

/**
 * Errors cross the extractor boundary as data.  In particular, never retain a
 * checker/AST object (or an opaque backend handle) as a cause: those objects
 * are process-local and can be both cyclic and enormous.
 */
export function safeCause(cause: unknown): string {
  try {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- safe-cause normalization narrows untrusted thrown values.
    if (typeof cause === "string") return cause;
    if (cause === null) return "null";
    if (cause === undefined) return "undefined";
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- safe-cause normalization narrows untrusted thrown values.
    if (typeof cause === "number" || typeof cause === "boolean" || typeof cause === "bigint") {
      return String(cause);
    }
    if (cause instanceof Error) {
      const code =
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- safe-cause normalization narrows untrusted thrown values.
        "code" in cause && (typeof cause.code === "string" || typeof cause.code === "number")
          ? ` [${cause.code}]`
          : "";
      return `${cause.name}: ${cause.message}${code}`;
    }
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- safe-cause normalization narrows untrusted thrown values.
    if (typeof cause === "object") {
      // SAFETY: this branch only reads two optional primitive diagnostic fields;
      // the object itself never crosses a durable package boundary.
      const value = cause as { readonly _tag?: unknown; readonly message?: unknown };
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- safe-cause normalization narrows untrusted thrown values.
      const tag = typeof value._tag === "string" ? value._tag : "BackendFailure";
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- safe-cause normalization narrows untrusted thrown values.
      const message = typeof value.message === "string" ? value.message : "Compiler operation failed";
      return `${tag}: ${message}`;
    }
    return Object.prototype.toString.call(cause);
  } catch {
    return "Unknown compiler failure";
  }
}

export class ConfigError extends Schema.TaggedError<ConfigError>()("ConfigError", {
  tsconfigPath: Schema.String,
  message: Schema.String,
  cause: Schema.String,
}) {}

export class BackendError extends Schema.TaggedError<BackendError>()("BackendError", {
  message: Schema.String,
  cause: Schema.String,
  operation: Schema.optionalKey(Schema.String),
  filePath: Schema.optionalKey(Schema.String),
  symbolStack: Schema.optionalKey(Schema.Array(Schema.String)),
}) {}

export class FileNotInProgramError extends Schema.TaggedError<FileNotInProgramError>()(
  "FileNotInProgramError",
  {
    filePath: Schema.String,
    message: Schema.String,
  }
) {}

export class ExtractError extends Schema.TaggedError<ExtractError>()("ExtractError", {
  filePath: Schema.String,
  symbolStack: Schema.Array(Schema.String),
  message: Schema.String,
  cause: Schema.String,
}) {}
