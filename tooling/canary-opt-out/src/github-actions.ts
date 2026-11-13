/**
 * The GitHub Actions side of the step: its error annotation, its output and its exit code. It
 * follows `tooling/release-announcement/src/github-actions.ts`, trimmed to what this step needs:
 * its one output is a boolean, so it is written as `name=value` with no delimiter to draw.
 */

import { NodeRuntime } from "@effect/platform-node";
import { Cause, Config, Console, Effect, FileSystem, Schema } from "effect";

/** Writing the step's output failed. */
class OutputFailed extends Schema.TaggedError<OutputFailed>()("OutputFailed", {
  message: Schema.String,
}) {}

/**
 * Appends a boolean output to the step's `GITHUB_OUTPUT` file.
 *
 * @param name - The output's name, a fixed identifier.
 * @param value - Its value.
 * @returns An effect that writes it.
 */
export const setBooleanOutput = Effect.fn("GitHubActions.setBooleanOutput")(function* (
  name: "skip",
  value: boolean
) {
  const path = yield* Config.NonEmptyString("GITHUB_OUTPUT");
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(path, `${name}=${String(value)}\n`, { flag: "a" })
    .pipe(
      Effect.mapError((error) => new OutputFailed({ message: `Could not write ${path}: ${error.message}` }))
    );
});

/**
 * Runs the step's program as the process's main program. A typed failure becomes an error
 * annotation with its message and exit code 1; a defect is logged in full with exit code 1.
 *
 * @param program - The step, with every service it needs provided.
 */
export function runStep<E extends { readonly message: string }>(program: Effect.Effect<void, E>): void {
  program.pipe(
    Effect.tapError((error) => {
      // The runner's escaping for a command's data (actions/toolkit, `escapeData`).
      const message =
        error instanceof Config.ConfigError
          ? `A setting is missing or invalid: ${error.cause.message}`
          : error.message;
      const data = message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
      return Console.log(`::error::${data}`);
    }),
    Effect.tapCause((cause) =>
      Cause.hasDies(cause) ? Effect.logFatal("The step failed unexpectedly", cause) : Effect.void
    ),
    NodeRuntime.runMain({ disableErrorReporting: true })
  );
}
