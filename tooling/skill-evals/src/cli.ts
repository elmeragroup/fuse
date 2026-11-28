/**
 * The `pnpm skill-evals` command line. It parses argv into `EvalOptions`, runs the evals and turns
 * every expected failure into an exit code.
 */

import * as CliError from "effect/cli/CliError";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";
import path from "node:path";

import packageJson from "../package.json" with { type: "json" };
import { runEvals } from "./run-evals.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const evalFlags = {
  tasks: Flag.String("task").pipe(
    Flag.withDescription("A task id from tasks.json. Repeat it for more. Default: every task."),
    Flag.withMetavar("id"),
    Flag.atLeast(0)
  ),
  arms: Flag.Literals("arm", ["both", "with-skill", "baseline"]).pipe(
    Flag.withDescription("Which arm to run: with-skill, baseline or both. Default: both."),
    Flag.withDefault("both")
  ),
  repeat: Flag.Int("repeat").pipe(
    Flag.withDescription("How many times to run each task and arm. Default: 1."),
    Flag.withDefault(1)
  ),
  model: Flag.String("model").pipe(
    Flag.withDescription("The model both arms run. Default: claude-sonnet-5-5."),
    Flag.withDefault("claude-sonnet-5-5")
  ),
  concurrency: Flag.Int("concurrency").pipe(
    Flag.withDescription("How many cells run at once. Default: 1."),
    Flag.withDefault(1)
  ),
  maxBudgetUsd: Flag.Finite("max-budget-usd").pipe(
    Flag.withDescription("The most one agent run may spend, in US dollars. Default: 2."),
    Flag.withDefault(2)
  ),
  timeoutMinutes: Flag.Finite("timeout-minutes").pipe(
    Flag.withDescription("How long one agent run may take before it is stopped. Default: 20."),
    Flag.withDefault(20)
  ),
  out: Flag.String("out").pipe(
    Flag.withDescription("The output folder. Default: a new folder under the system's temporary folder."),
    Flag.withMetavar("dir"),
    Flag.optional,
    Flag.map(Option.getOrUndefined)
  ),
  agent: Flag.Boolean("skip-agent").pipe(
    Flag.withDescription(
      "Set up and check each untouched fixture without running an agent, which costs nothing."
    ),
    Flag.withDefault(false),
    Flag.map((skip): "run" | "skip" => (skip ? "skip" : "run"))
  ),
};

const command = Command.make(
  "skill-evals",
  evalFlags,
  Effect.fn("cli.skillEvals")(function* (options) {
    yield* runEvals(options, repoRoot);
  })
).pipe(
  Command.withDescription(
    "Runs each Fuse skill task with the skill and without it, checks the resulting app, and writes a report."
  )
);

/** The exit status of a failed run: 2 for a command line that does not parse, 1 otherwise. */
const ExitCode = Schema.Literals([1, 2]);

/** A failure whose message is already on stderr, so the runtime only sets the exit status. */
class ReportedFailure extends Schema.TaggedError<ReportedFailure>()("ReportedFailure", {
  exitCode: ExitCode,
}) {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = this.exitCode;
}

function report(failure: {
  readonly _tag: string;
  readonly message: string;
}): Effect.Effect<never, ReportedFailure> {
  return Console.error(failure.message).pipe(
    Effect.andThen(Effect.fail(new ReportedFailure({ exitCode: 1 })))
  );
}

/** A command line that did not parse: the parser has printed its errors. `--help` keeps exit 0. */
function usage(error: CliError.CliError): Effect.Effect<never, CliError.CliError | ReportedFailure> {
  return error._tag === "ShowHelp" && error.errors.length === 0
    ? Effect.fail(error)
    : Effect.fail(new ReportedFailure({ exitCode: 2 }));
}

/**
 * Runs the command line.
 *
 * @param argv - The arguments after the executable and script path.
 * @returns An effect that runs the evals, exiting 2 on a command line that does not parse and 1
 *   on any other expected failure.
 */
export const runCli = (argv: readonly string[]) =>
  Command.runWith(command, { version: packageJson.version })(argv).pipe(
    Effect.catchIf(CliError.isCliError, usage, report)
  );
