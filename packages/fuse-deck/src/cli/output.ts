/**
 * Where the CLI's results go. With `--json`, stdout carries exactly one JSON document per run:
 * the result, a domain failure (`{ _tag, message, hint? }`, exit 1) or a usage failure
 * (`{ _tag: "InvalidInvocation", message }`, exit 2). Without it, results are text on stdout and
 * failures text on stderr. Diagnostics always go to stderr.
 *
 * `printDocument` is the one place that writes JSON.
 */

import * as CliOutput from "effect/cli/CliOutput";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** A JSON value. */
export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };

/**
 * One JSON document: an object whose `_tag` names what it reports. A field set to `undefined` is
 * left out, as `JSON.stringify` does.
 */
export type JsonDocument = { readonly _tag: string; readonly [key: string]: Json | undefined };

/** How a run prints: one JSON document, or text for a person. */
export type OutputMode = "json" | "text";

/** The run's output mode, read from argv before anything parses. */
export const Output = Context.Reference<OutputMode>("@elmeragroup/fuse-deck/Output", {
  defaultValue: () => "text",
});

/**
 * The output mode argv asks for. JSON mode is only ever explicit: `--json` before any `--`.
 * Usage errors happen before flags parse, so the mode cannot come from the parsed flag.
 *
 * @param argv - The arguments after the executable and script path.
 * @returns `json` when argv holds `--json` or `--json=true` before `--`, otherwise `text`.
 */
export function outputModeFromArgv(argv: readonly string[]): OutputMode {
  const end = argv.indexOf("--");
  const options = end === -1 ? argv : argv.slice(0, end);
  return options.some((arg) => arg === "--json" || arg === "--json=true") ? "json" : "text";
}

/**
 * Print one JSON document on stdout, and finish once stdout has taken all of it. Nothing else in
 * the CLI writes JSON. A pipe on macOS takes 64 KiB at a time, and a failed run exits as soon as it
 * returns, so a document that returned before the write finished would arrive cut off.
 *
 * @param document - The document.
 */
export function printDocument(document: JsonDocument): Effect.Effect<void> {
  return encodeDocument(document).pipe(
    // A `JsonDocument` holds only JSON values, so encoding it cannot fail.
    Effect.orDie,
    Effect.flatMap((text) =>
      Effect.callback<void>((resume) => {
        process.stdout.write(`${text}\n`, () => {
          resume(Effect.void);
        });
      })
    )
  );
}

const encodeDocument = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

/** What a command reports: its JSON document and its text for a person. */
export type Reply = {
  /** The JSON document `--json` prints. */
  readonly document: JsonDocument;
  /** The text printed without `--json`. */
  readonly text: string;
};

/**
 * Print a command's result in the run's output mode.
 *
 * @param reply - The result as a document and as text.
 */
export const reply = Effect.fn("Output.reply")(function* (result: Reply) {
  if ((yield* Output) === "json") {
    yield* printDocument(result.document);
  } else {
    yield* Console.log(result.text);
  }
});

/** One problem in a failure that found several, such as `check`'s. */
export type ReportableProblem = {
  readonly _tag: string;
  readonly message: string;
  readonly hint: string;
  readonly id?: string;
  readonly path?: string;
};

/** A domain failure as the CLI reports it: what failed, why, what to do, and what it names. */
export type ReportableError = {
  readonly _tag: string;
  readonly message: string;
  readonly hint?: string;
  /** The slide the failure names. */
  readonly id?: string;
  /** The file or directory the failure names. */
  readonly path?: string;
  /** The lock file a lock failure names. */
  readonly file?: string;
  /** Each problem a check found. */
  readonly problems?: readonly ReportableProblem[];
};

/**
 * Report a domain failure: its document on stdout with `--json`, its message, problems and hint on
 * stderr without.
 *
 * @param error - The failure.
 */
export const reportFailure = Effect.fn("Output.reportFailure")(function* (error: ReportableError) {
  if ((yield* Output) === "json") {
    yield* printDocument(failureDocument(error));
    return;
  }
  const problems = (error.problems ?? []).map((problem) => `- ${problem.message}\n  ${problem.hint}`);
  yield* Console.error(
    [error.message, ...problems, ...(error.hint === undefined ? [] : [error.hint])].join("\n")
  );
});

function failureDocument(error: ReportableError) {
  return {
    _tag: error._tag,
    message: error.message,
    hint: error.hint,
    id: error.id,
    path: error.path,
    file: error.file,
    problems: error.problems,
  } satisfies JsonDocument;
}

/**
 * The presenter for `--json` runs. A command line that does not parse, or names a command without
 * its subcommand, becomes one `InvalidInvocation` document. `--help` and `--version` stay text.
 */
export const jsonPresenter: CliOutput.Presenter = {
  present: (event) => {
    switch (event._tag) {
      case "InvalidInvocation":
        return printDocument({
          _tag: "InvalidInvocation",
          message: event.errors.map((error) => error.message).join("\n"),
        });
      case "Help":
        return event.reason === "Implicit"
          ? printDocument({
              _tag: "InvalidInvocation",
              message: `\`${event.commandPath.join(" ")}\` needs a subcommand. Run \`${event.commandPath.join(" ")} --help\` to list them.`,
            })
          : CliOutput.defaultPresenter.present(event);
      case "Version":
        return CliOutput.defaultPresenter.present(event);
    }
  },
};
