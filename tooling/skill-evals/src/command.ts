/**
 * Runs a program to its end in its own process group and keeps its output. The cell runs the
 * install, the type-check, the build and the agent through it.
 */

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

/** The program could not be started. */
export class CommandUnstartable extends Schema.TaggedError<CommandUnstartable>()("CommandUnstartable", {
  message: Schema.String,
  command: Schema.String,
}) {}

/** How a program run ended. */
export type CommandOutcome =
  | { readonly _tag: "exited"; readonly exitCode: number }
  | { readonly _tag: "timed-out"; readonly after: Duration.Duration };

/** A finished program run. */
export type CommandRun = {
  readonly outcome: CommandOutcome;
  /** Everything it printed on stdout. */
  readonly stdout: string;
  /** Everything it printed on stderr. */
  readonly stderr: string;
};

/** What to run. */
export type CommandSpec = {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** Variables added to the inherited environment. */
  readonly env?: Readonly<Record<string, string>>;
  /** How long it may run before the runner stops its process group. */
  readonly timeout: Duration.Duration;
};

/**
 * Runs a program until it exits or its timeout passes. Either way its whole process group stops
 * before this returns, so a server the program started in the background does not outlive it.
 *
 * @param spec - The program, its arguments, its folder and its timeout.
 * @returns How it ended and what it printed, or `CommandUnstartable` when it could not start.
 */
export const runCommand = Effect.fn("command.run")(function* (spec: CommandSpec) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const label = [spec.executable, ...spec.args].join(" ");
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner
        .spawn(
          ChildProcess.make(spec.executable, [...spec.args], {
            cwd: spec.cwd,
            env: { ...spec.env },
            extendEnv: true,
            stdin: "ignore",
            forceKillAfter: Duration.seconds(5),
          })
        )
        .pipe(Effect.mapError((cause) => new CommandUnstartable({ message: cause.message, command: label })));
      const stdout: string[] = [];
      const stderr: string[] = [];
      const drain = (stream: Stream.Stream<Uint8Array, unknown>, into: string[]) =>
        stream.pipe(
          Stream.decodeText(),
          Stream.runForEach((chunk) => Effect.sync(() => into.push(chunk))),
          Effect.ignore
        );
      const drained = yield* Effect.all([drain(handle.stdout, stdout), drain(handle.stderr, stderr)], {
        concurrency: 2,
        discard: true,
      }).pipe(Effect.forkScoped);
      const outcome = yield* handle.exitCode.pipe(
        Effect.map((exitCode): CommandOutcome => ({ _tag: "exited", exitCode })),
        Effect.catchTag("PlatformError", () =>
          Effect.succeed<CommandOutcome>({ _tag: "exited", exitCode: -1 })
        ),
        Effect.timeoutOrElse({
          duration: spec.timeout,
          orElse: () => Effect.succeed<CommandOutcome>({ _tag: "timed-out", after: spec.timeout }),
        })
      );
      if (outcome._tag === "exited") yield* Fiber.join(drained);
      return { outcome, stdout: stdout.join(""), stderr: stderr.join("") } satisfies CommandRun;
    })
  );
});

/**
 * Whether a run exited 0.
 *
 * @param run - The finished run.
 * @returns `true` only for an exit with code 0.
 */
export function succeeded(run: CommandRun): boolean {
  return run.outcome._tag === "exited" && run.outcome.exitCode === 0;
}

/**
 * The last lines a run printed, for a report.
 *
 * @param run - The finished run.
 * @param lines - How many lines to keep.
 * @returns Its stdout and stderr, cut to their last lines.
 */
export function outputTail(run: CommandRun, lines: number): string {
  return `${run.stdout}\n${run.stderr}`.trim().split("\n").slice(-lines).join("\n");
}
