/**
 * Reads and edits a pull request through the GitHub CLI.
 */

import { Context, Duration, Effect, Layer, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

/** What a `gh` call was for. */
export type GhOperation = "read the PR body" | "edit the PR";

/** A `gh` call failed. */
export class GhFailed extends Schema.TaggedError<GhFailed>()("GhFailed", {
  message: Schema.String,
  operation: Schema.Literals(["read the PR body", "edit the PR"]),
}) {}

/** How the `Gh` service runs the GitHub CLI. */
export type GhConfig = {
  /** The checkout, so gh picks the repository from its remote. */
  readonly repoRoot: string;
  /** The executable, `gh` on `PATH`. */
  readonly executable: string;
  /** Arguments every call starts with, such as a script path for a stand-in. */
  readonly baseArgs: readonly string[];
};

/** The pull request calls an upload needs. */
export class Gh extends Context.Service<
  Gh,
  {
    /** Read a pull request's body. */
    readonly readBody: (pr: number) => Effect.Effect<string, GhFailed>;

    /**
     * Run `gh` with the given arguments in `cwd`, such as a `pr edit` that attaches images.
     * Relative attachment paths resolve against `cwd`. Succeeds with gh's output. Interrupting
     * the call kills gh and waits for it to exit.
     */
    readonly edit: (args: readonly string[], cwd: string) => Effect.Effect<string, GhFailed>;
  }
>()("@elmeragroup/pr-shots/Gh") {
  /**
   * The `gh` binary on `PATH`.
   *
   * @param repoRoot - The checkout, so gh picks the repository from its remote.
   * @returns A layer that runs `gh`.
   */
  static readonly layer = (repoRoot: string) => Gh.layerWith({ repoRoot, executable: "gh", baseArgs: [] });

  /**
   * A `gh` stand-in run as `executable` with `baseArgs` before each call's arguments.
   *
   * @param config - The checkout, the executable and the arguments it always gets.
   * @returns A layer that runs that executable through the platform's process service.
   */
  static readonly layerWith = (config: GhConfig) =>
    Layer.effect(
      Gh,
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

        // The spawn is scoped, so an interrupt kills gh's process group and waits for it.
        const gh = (operation: GhOperation, args: readonly string[], cwd: string) =>
          Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(
                ChildProcess.make(config.executable, [...config.baseArgs, ...args], {
                  cwd,
                  stdin: "ignore",
                  forceKillAfter: Duration.seconds(2),
                })
              );
              const [stdout, stderr, exitCode] = yield* Effect.all(
                [text(handle.stdout), text(handle.stderr), handle.exitCode],
                { concurrency: "unbounded" }
              );
              return { stdout, stderr: stderr.trim(), exitCode };
            })
          ).pipe(
            Effect.mapError(
              (cause) => new GhFailed({ message: `gh could not ${operation}: ${cause.message}`, operation })
            ),
            Effect.flatMap(({ stdout, stderr, exitCode }) =>
              exitCode === 0
                ? Effect.succeed(stdout)
                : Effect.fail(
                    new GhFailed({
                      message: `gh could not ${operation}${stderr === "" ? ` (exit ${String(exitCode)})` : `: ${stderr}`}`,
                      operation,
                    })
                  )
            )
          );

        return Gh.of({
          readBody: Effect.fn("Gh.readBody")(function* (pr: number) {
            const stdout = yield* gh(
              "read the PR body",
              ["pr", "view", String(pr), "--json", "body", "--jq", ".body"],
              config.repoRoot
            );
            return stdout.replace(/\n$/, "");
          }),
          edit: Effect.fn("Gh.edit")(function* (args: readonly string[], cwd: string) {
            return (yield* gh("edit the PR", args, cwd)).trim();
          }),
        });
      })
    );
}

function text<E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> {
  return stream.pipe(Stream.decodeText(), Stream.mkString);
}
