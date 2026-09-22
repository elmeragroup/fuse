/**
 * The `fuse-figma` command line. It parses flags, runs a sync over the Fuse variable set
 * and prints what happened.
 */

import { Config, Console, Data, Effect, Runtime, Schema } from "effect";
import { CliError, Command, Flag } from "effect/unstable/cli";

import packageJson from "../package.json" with { type: "json" };
import { FigmaApi, FileKey } from "./figma-api.ts";
import { fuseVariableSet } from "./fuse-variable-set.ts";
import { places } from "./plural.ts";
import { isInSync } from "./sync-plan.ts";
import type { PlannedChange, SyncPlan } from "./sync-plan.ts";
import { planFileSync, syncFile } from "./token-sync.ts";
import type { SyncOutcome } from "./token-sync.ts";

/** `check` found differences between the file and the tokens. */
export class DriftDetected extends Schema.TaggedError<DriftDetected>()("DriftDetected", {
  message: Schema.String,
  changes: Schema.Number,
}) {}

const fileKey = Flag.String("file-key").pipe(
  Flag.withDescription(
    "The Figma file to sync, the <file-key> part of figma.com/design/<file-key>/. Without this flag the sync reads FIGMA_FILE_KEY."
  ),
  Flag.withFallbackConfig(Config.String("FIGMA_FILE_KEY")),
  Flag.withSchema(FileKey)
);

const root = Command.make("fuse-figma").pipe(
  Command.withSharedFlags({ fileKey }),
  Command.withDescription(
    "Sync the Fuse design tokens into a Figma file's variables. Needs FIGMA_TOKEN, a personal access token with the file_variables scopes."
  )
);

const sync = Command.make(
  "sync",
  {},
  Effect.fn("cli.sync")(function* () {
    const { fileKey } = yield* root;
    const desired = yield* Effect.fromResult(fuseVariableSet());
    const outcome = yield* syncFile(fileKey, desired);
    yield* Console.log(describeOutcome(fileKey, outcome));
  })
).pipe(Command.withDescription("Create or update the Fuse collections in the file"));

const check = Command.make(
  "check",
  {},
  Effect.fn("cli.check")(function* () {
    const { fileKey } = yield* root;
    const plan = yield* planFileSync(fileKey, yield* Effect.fromResult(fuseVariableSet()));
    if (isInSync(plan)) {
      yield* Console.log(`Figma file ${fileKey} matches the Fuse tokens.`);
      return;
    }
    yield* Console.log(describePlan(plan));
    return yield* new DriftDetected({
      message: `Figma file ${fileKey} differs from the Fuse tokens in ${places(plan.changes.length)}. Run \`sync\` to update it.`,
      changes: plan.changes.length,
    });
  })
).pipe(
  Command.withDescription("Print what a sync would change, and fail when the file differs from the tokens")
);

// `Command.provide` builds the Figma client only when a command runs, so `--help` needs no token.
const cli = root.pipe(Command.withSubcommands([sync, check]), Command.provide(FigmaApi.layer));

/**
 * A failure whose message is already on stderr. The runtime still exits with status 1 but
 * does not log it again with a stack trace.
 */
class ReportedFailure extends Data.TaggedError("ReportedFailure") {
  override readonly [Runtime.errorReported] = false;
}

function report(failure: { readonly message: string }): Effect.Effect<never, ReportedFailure> {
  return Console.error(failure.message).pipe(Effect.andThen(Effect.fail(new ReportedFailure())));
}

/**
 * Run the command line. Every expected failure prints its message and fails with
 * `ReportedFailure`; argument errors keep the parser's own help output. A failure type
 * without a `message` does not compile here, so no new error can skip the report.
 *
 * @param argv - The arguments after the executable and script path.
 */
export const runCli = (argv: readonly string[]) =>
  Command.runWith(cli, { version: packageJson.version })(argv).pipe(
    Effect.catchIf(CliError.isCliError, Effect.fail, report)
  );

function describeOutcome(fileKey: FileKey, outcome: SyncOutcome): string {
  switch (outcome._tag) {
    case "InSync":
      return `Figma file ${fileKey} already matches the Fuse tokens.`;
    case "Applied":
      return `${describePlan(outcome.plan)}\nUpdated Figma file ${fileKey}; reading it back matches the tokens.`;
  }
}

/**
 * One line per collection and kind of change. Value changes are counted rather than
 * listed, because a first sync sets several thousand.
 */
function describePlan(plan: SyncPlan): string {
  const lines = new Map<string, number>();
  for (const change of plan.changes) {
    const line = `${change.collection}: ${changeLabel(change)}`;
    lines.set(line, (lines.get(line) ?? 0) + 1);
  }
  return [...lines].map(([line, count]) => (count === 1 ? line : `${line} ×${count}`)).join("\n");
}

function changeLabel(change: PlannedChange): string {
  switch (change._tag) {
    case "CreateCollection":
      return "create collection";
    case "CreateMode":
      return `create mode ${change.mode}`;
    case "RenameMode":
      return `rename mode ${change.from} to ${change.mode}`;
    case "DeleteMode":
      return `delete mode ${change.mode}`;
    case "CreateVariable":
      return "create variable";
    case "UpdateVariable":
      return "update scopes or code syntax";
    case "DeleteVariable":
      return `delete variable ${change.variable}`;
    case "SetValue":
      return "set value";
  }
}
