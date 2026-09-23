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
    const plan = yield* syncFile(fileKey, yield* Effect.fromResult(fuseVariableSet()));
    if (isInSync(plan)) {
      yield* Console.log(`Figma file ${fileKey} already matches the Fuse tokens.`);
      return;
    }
    yield* Console.log(describePlan(plan));
    yield* Console.log(`Updated Figma file ${fileKey}; reading it back matches the tokens.`);
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
 * The exit status of a failed run. `check` exits 2 when the file drifted, so a CI job can
 * tell drift from a check that could not run, which exits 1.
 */
type ExitCode = 1 | 2;

/**
 * A failure whose message is already on stderr. The runtime exits with its status but does
 * not log it again with a stack trace.
 */
class ReportedFailure extends Data.TaggedError("ReportedFailure")<{ readonly exitCode: ExitCode }> {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = this.exitCode;
}

function report(failure: {
  readonly _tag: string;
  readonly message: string;
}): Effect.Effect<never, ReportedFailure> {
  const exitCode: ExitCode = failure._tag === "DriftDetected" ? 2 : 1;
  return Console.error(failure.message).pipe(Effect.andThen(Effect.fail(new ReportedFailure({ exitCode }))));
}

/**
 * Run the command line. Every expected failure prints its message and fails with
 * `ReportedFailure`, which exits 2 for drift and 1 for anything else; argument errors keep
 * the parser's own help output. A failure type without a `_tag` and a `message` does not
 * compile here, so no new error can skip the report.
 *
 * @param argv - The arguments after the executable and script path.
 */
export const runCli = (argv: readonly string[]) =>
  Command.runWith(cli, { version: packageJson.version })(argv).pipe(
    Effect.catchIf(CliError.isCliError, Effect.fail, report)
  );

/** The most changes of one kind in one collection that the plan lists one by one. */
const LISTED_CHANGES = 10;

/**
 * The plan, grouped by collection and kind of change. A group of up to 10 changes lists each
 * one with its variable and mode, so a small drift names what changed. A larger group is
 * one counted line, because a first sync sets several thousand values.
 */
function describePlan(plan: SyncPlan): string {
  const groups = new Map<string, string[]>();
  for (const change of plan.changes) {
    const { kind, detail } = changeLabel(change);
    const group = `${change.collection}: ${kind}`;
    groups.set(group, [...(groups.get(group) ?? []), `${change.collection}: ${detail}`]);
  }
  return [...groups]
    .flatMap(([group, lines]) => (lines.length <= LISTED_CHANGES ? lines : [`${group} ×${lines.length}`]))
    .join("\n");
}

/** A change's kind, which groups it, and the line that names it. */
type ChangeLabel = { readonly kind: string; readonly detail: string };

function changeLabel(change: PlannedChange): ChangeLabel {
  switch (change._tag) {
    case "CreateCollection":
      return { kind: "create collection", detail: "create collection" };
    case "CreateMode":
      return { kind: "create mode", detail: `create mode ${change.mode}` };
    case "DeleteMode":
      return { kind: "delete mode", detail: `delete mode ${change.mode}` };
    case "CreateVariable":
      return { kind: "create variable", detail: `create variable ${change.variable}` };
    case "UpdateVariable":
      return {
        kind: "update scopes or code syntax",
        detail: `update scopes or code syntax of ${change.variable}`,
      };
    case "DeleteVariable":
      return { kind: "delete variable", detail: `delete variable ${change.variable}` };
    case "SetValue":
      return { kind: "set value", detail: `set value of ${change.variable} in ${change.mode}` };
  }
}
