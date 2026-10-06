/**
 * Parses argv through the real `shots` command, with its handler swapped for one that keeps
 * what the parser produced, so tests see the `ShotOptions` a run would get without running it.
 */

import { Effect, FileSystem, Layer, Option, Path, Ref, Stdio, Terminal } from "effect";
import { CliOutput, Command } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";

import { shots } from "../src/cli.ts";
import type { ShotOptions } from "../src/options.ts";

/** The services `Command.runWith` needs, none of which a parse uses. */
export const cliEnvironment = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(100),
      rows: Effect.succeed(40),
      readInput: Effect.die("the CLI never reads input"),
      readLine: Effect.die("the CLI never reads input"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("the CLI never spawns processes"))
  ),
  CliOutput.layer(CliOutput.defaultFormatter({ colors: false }))
);

/**
 * Parse argv the way `pnpm shots` does.
 *
 * @param argv - The arguments after `pnpm shots`.
 * @returns The parsed run, or the parser's `CliError`.
 */
export function parseArgv(argv: readonly string[]) {
  return Effect.gen(function* () {
    const parsed = yield* Ref.make(Option.none<ShotOptions>());
    const command = shots.pipe(Command.withHandler((options) => Ref.set(parsed, Option.some(options))));
    yield* Command.runWith(command, { version: "test", renderErrors: false })(argv);
    return Option.getOrThrowWith(yield* Ref.get(parsed), () => new Error(`${argv.join(" ")} ran no command`));
  }).pipe(Effect.provide(cliEnvironment));
}

/**
 * Parse argv that the test expects to parse, for tests of what comes after parsing.
 *
 * @param argv - The arguments after `pnpm shots`.
 * @returns The parsed run.
 * @throws When argv does not parse, which is a mistake in the test.
 */
export function shotOptions(argv: readonly string[]): ShotOptions {
  return Effect.runSync(parseArgv(argv));
}
