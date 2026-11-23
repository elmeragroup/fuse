/**
 * Parses argv through the real `shots` command, with its handler swapped for one that keeps
 * what the parser produced, so tests see the `ShotOptions` a run would get without running it.
 */

import * as CliOutput from "effect/cli/CliOutput";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";

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
      size: Effect.die("the CLI never watches the terminal size"),
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
export const parseArgv = Effect.fnUntraced(function* (argv: readonly string[]) {
  const parsed = yield* Ref.make(Option.none<ShotOptions>());
  const command = shots.pipe(Command.withHandler((options) => Ref.set(parsed, Option.some(options))));
  yield* Command.runWith(command, { version: "test", renderErrors: false })(argv);
  return Option.getOrThrowWith(yield* Ref.get(parsed), () => new Error(`${argv.join(" ")} ran no command`));
}, Effect.provide(cliEnvironment));

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
