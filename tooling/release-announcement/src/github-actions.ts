/**
 * The GitHub Actions side of a step: its annotations, its outputs and its exit code.
 *
 * Annotations are workflow commands on standard output, escaped as the runner expects, so a
 * message cannot end its command early or start another. Outputs go to the `GITHUB_OUTPUT` file
 * in the runner's multi-line form under a random delimiter, which no value can know in advance,
 * so a value cannot write a further output.
 */

import { NodeRuntime } from "@effect/platform-node";
import { Cause, Config, Console, Crypto, Effect, FileSystem, Schema } from "effect";

/** An annotation's level. */
type AnnotationLevel = "notice" | "warning" | "error";

/**
 * Writes an annotation that the run's summary shows.
 *
 * @param level - The annotation's level.
 * @param message - Its text, which may span lines.
 * @returns An effect that writes it.
 */
export function annotate(level: AnnotationLevel, message: string): Effect.Effect<void> {
  // The runner's escaping for a command's data (actions/toolkit, `escapeData`).
  const data = message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  return Console.log(`::${level}::${data}`);
}

/** Writing the step's outputs failed. */
class OutputFailed extends Schema.TaggedError<OutputFailed>()("OutputFailed", {
  message: Schema.String,
}) {}

/**
 * Appends outputs to the step's `GITHUB_OUTPUT` file, each as `name<<delimiter`, its value and the
 * delimiter, under a delimiter drawn for this write.
 *
 * @param outputs - The outputs, by name.
 * @returns An effect that writes them.
 */
export const setOutputs = Effect.fn("GitHubActions.setOutputs")(function* (
  outputs: ReadonlyArray<readonly [name: string, value: string]>
) {
  const path = yield* Config.NonEmptyString("GITHUB_OUTPUT");
  const uuid = yield* (yield* Crypto.Crypto)
    .randomUUIDv4()
    .pipe(
      Effect.mapError(
        (error) => new OutputFailed({ message: `Could not draw a delimiter: ${error.message}` })
      )
    );
  const delimiter = `ghadelimiter_${uuid}`;
  const lines: string[] = [];
  for (const [name, value] of outputs) {
    if (!/^[\w-]+$/u.test(name) || value.includes(delimiter)) {
      return yield* new OutputFailed({ message: `The ${name} output cannot be written safely` });
    }
    lines.push(`${name}<<${delimiter}`, value, delimiter);
  }
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(path, `${lines.join("\n")}\n`, { flag: "a" })
    .pipe(
      Effect.mapError((error) => new OutputFailed({ message: `Could not write ${path}: ${error.message}` }))
    );
});

/**
 * Runs a step's program as the process's main program. A typed failure becomes an error
 * annotation with its message and exit code 1; a defect is logged in full with exit code 1.
 *
 * @param program - The step, with every service it needs provided.
 */
export function runStep<E extends { readonly message: string }>(program: Effect.Effect<void, E>): void {
  program.pipe(
    Effect.tapError((error) =>
      annotate(
        "error",
        error instanceof Config.ConfigError
          ? `A setting is missing or invalid: ${error.cause.message}`
          : error.message
      )
    ),
    Effect.tapCause((cause) =>
      Cause.hasDies(cause) ? Effect.logFatal("The step failed unexpectedly", cause) : Effect.void
    ),
    NodeRuntime.runMain({ disableErrorReporting: true })
  );
}
