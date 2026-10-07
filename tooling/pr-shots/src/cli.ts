/**
 * The `pnpm shots` command line. It parses argv into a `ShotOptions`, runs the shots and turns
 * every expected failure into an exit code.
 */

import { Console, Data, Effect, Layer, Option, Runtime } from "effect";
import { Argument, CliError, Command, Flag } from "effect/unstable/cli";
import path from "node:path";

import packageJson from "../package.json" with { type: "json" };
import { Capture } from "./capture.ts";
import { DocsServer } from "./docs-server.ts";
import { Gh } from "./gh.ts";
import {
  Count,
  Densities,
  Engines,
  PullRequest,
  Route,
  RunName,
  Scale,
  SourceFromText,
  TargetFromText,
  Themes,
  Threshold,
  Viewports,
  DEFAULT_VIEWPORT,
  prodSource,
} from "./options.ts";
import type { ShotOptions } from "./options.ts";
import { DEFAULT_THRESHOLD } from "./pixel-diff.ts";
import { runShots } from "./run-shots.ts";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

/** The flags, which decode straight into a `ShotOptions`. */
const shotFlags = {
  name: Argument.String("name").pipe(
    Argument.withDescription(
      "The run's name, lowercase letters, digits and dashes. It names the output directory and the PR-body markers."
    ),
    Argument.withSchema(RunName)
  ),
  route: Flag.String("route").pipe(
    Flag.withDescription("The docs path to open, such as /components/phone-number-field."),
    Flag.withMetavar("path"),
    Flag.withSchema(Route)
  ),
  target: Flag.String("target").pipe(
    Flag.withDescription(
      "The element, as <role>:<exact accessible name>, such as textbox:Mobile. Only the first colon separates them. Without it the shot covers the page."
    ),
    Flag.withMetavar("role:name"),
    Flag.withSchema(TargetFromText),
    Flag.optional,
    Flag.map(Option.getOrNull)
  ),
  nth: Flag.String("nth").pipe(
    Flag.withDescription(
      "Which match to take, counting from 0, when several share the role and name. Default: 0."
    ),
    Flag.withMetavar("n"),
    Flag.withSchema(Count),
    Flag.withDefault(0)
  ),
  fill: Flag.String("fill").pipe(
    Flag.withDescription("Clicks the target, types this text and blurs it before the shot."),
    Flag.withMetavar("text"),
    Flag.optional,
    Flag.map(Option.getOrNull)
  ),
  frame: Flag.Literals("frame", ["auto", "stage", "target", "viewport", "page"]).pipe(
    Flag.withDescription(
      "stage clips the target's closest [data-demo-stage]; target clips the element alone; viewport is the window at the top of the page; page is the whole page. auto takes stage for a target in a demo stage, target for one outside, and viewport without a target. Default: auto."
    ),
    Flag.withDefault("auto")
  ),
  pad: Flag.String("pad").pipe(
    Flag.withDescription("CSS pixels added on every side of the frame. Default: 12."),
    Flag.withMetavar("px"),
    Flag.withSchema(Count),
    Flag.withDefault(12)
  ),
  themes: Flag.String("themes").pipe(
    Flag.withDescription(
      "Theme slugs such as external-tkas-company, picked in the header's theme menu. Default: the page's preview theme."
    ),
    Flag.withMetavar("slug,..."),
    Flag.withSchema(Themes),
    Flag.withDefault([{ _tag: "page-default" }] as const)
  ),
  densities: Flag.String("densities").pipe(
    Flag.withDescription(
      "dense, comfortable or both, stamped on the demo stage as an override. Default: the theme's own density."
    ),
    Flag.withMetavar("list"),
    Flag.withSchema(Densities),
    Flag.withDefault([{ _tag: "stage-default" }] as const)
  ),
  engines: Flag.String("engines").pipe(
    Flag.withDescription("Any of chromium, webkit, firefox. Default: chromium."),
    Flag.withMetavar("list"),
    Flag.withSchema(Engines),
    Flag.withDefault(["chromium"] as const)
  ),
  viewports: Flag.String("viewports").pipe(
    Flag.withDescription(
      "Window sizes as <width>x<height> in CSS pixels, such as 1280x800,390x844. Default: 1280x900."
    ),
    Flag.withMetavar("WxH,..."),
    Flag.withSchema(Viewports),
    Flag.withDefault([DEFAULT_VIEWPORT] as const)
  ),
  scale: Flag.String("scale").pipe(
    Flag.withDescription("The device scale factor, above 0 and at most 4. Default: 2."),
    Flag.withMetavar("n"),
    Flag.withSchema(Scale),
    Flag.withDefault(2)
  ),
  colorScheme: Flag.Literals("color-scheme", ["light", "dark"]).pipe(
    Flag.withDescription("The color scheme the browser reports to the page. Default: light."),
    Flag.withDefault("light")
  ),
  before: Flag.String("before").pipe(
    Flag.withDescription("Where the base comes from: prod, local or a URL. Default: prod."),
    Flag.withMetavar("source"),
    Flag.withSchema(SourceFromText),
    Flag.withDefault(prodSource())
  ),
  after: Flag.String("after").pipe(
    Flag.withDescription("Where the change comes from: prod, local or a URL. Default: local."),
    Flag.withMetavar("source"),
    Flag.withSchema(SourceFromText),
    Flag.withDefault({ _tag: "local" } as const)
  ),
  diff: Flag.Boolean("diff").pipe(
    Flag.withDescription(
      "Writes a pixel diff of each before/after pair and adds a Diff column to table.md. --no-diff turns it off."
    ),
    Flag.withDefault(true),
    Flag.map((on): "on" | "off" => (on ? "on" : "off"))
  ),
  threshold: Flag.String("threshold").pipe(
    Flag.withDescription("pixelmatch's matching threshold, 0 to 1; smaller is more sensitive. Default: 0.1."),
    Flag.withMetavar("0..1"),
    Flag.withSchema(Threshold),
    Flag.withDefault(DEFAULT_THRESHOLD)
  ),
  pr: Flag.String("pr").pipe(
    Flag.withDescription("Uploads the shots to this pull request. Without it the run prints the gh command."),
    Flag.withMetavar("n"),
    Flag.withSchema(PullRequest),
    Flag.optional,
    Flag.map(Option.getOrNull)
  ),
};

/**
 * The `shots` command without its services. Tests swap its handler to read what it parsed.
 */
export const shots = Command.make(
  "shots",
  shotFlags,
  Effect.fn("cli.shots")(function* (options: ShotOptions) {
    yield* runShots(options, repoRoot);
  })
).pipe(
  Command.withDescription(
    "Take before and after screenshots of a docs route for a pull request. See tooling/pr-shots/README.md."
  )
);

// `Command.provide` builds the services only when the command runs, so `--help` starts nothing.
const cli = shots.pipe(
  Command.provide(Layer.mergeAll(Capture.layer, DocsServer.layerNextDev(repoRoot), Gh.layer(repoRoot)))
);

/** The exit status of a failed run: 2 for a command line that does not parse, 1 otherwise. */
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
  return Console.error(failure.message).pipe(
    Effect.andThen(Effect.fail(new ReportedFailure({ exitCode: 1 })))
  );
}

/**
 * A command line that did not parse. The parser has printed the help and the errors, so this
 * only sets exit 2. `--help` alone keeps its own exit 0.
 */
function usage(error: CliError.CliError): Effect.Effect<never, CliError.CliError | ReportedFailure> {
  return error._tag === "ShowHelp" && error.errors.length === 0
    ? Effect.fail(error)
    : Effect.fail(new ReportedFailure({ exitCode: 2 }));
}

/**
 * Run the command line. A command line that does not parse exits 2 after the parser's help and
 * errors; every other expected failure prints its message and exits 1. A failure type without a
 * `_tag` and a `message` does not compile here, so no new error can skip the report.
 *
 * @param argv - The arguments after the executable and script path.
 */
export const runCli = (argv: readonly string[]) =>
  Command.runWith(cli, { version: packageJson.version })(argv).pipe(
    Effect.catchIf(CliError.isCliError, usage, report)
  );
