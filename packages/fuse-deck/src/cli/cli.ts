/**
 * The `fuse-deck` command line. It parses argv, runs a command over the deck and reports the
 * result in the output mode argv asked for. A command line that does not parse exits 2, a domain
 * failure exits 1.
 */

import * as Cause from "effect/Cause";
import * as Argument from "effect/cli/Argument";
import * as CliConfig from "effect/cli/CliConfig";
import * as CliError from "effect/cli/CliError";
import * as CliOutput from "effect/cli/CliOutput";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as GlobalFlag from "effect/cli/GlobalFlag";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";

import packageJson from "../../package.json" with { type: "json" };
import { checkDeck } from "../deck/check.ts";
import { DeckFiles } from "../deck/deck-files.ts";
import type { DeckManifest, OrderPosition } from "../deck/deck-manifest.ts";
import { mdxText } from "../deck/mdx-text.ts";
import { DEFAULT_THEME, scaffoldDeck } from "../deck/scaffold.ts";
import { SlideId, slidePath } from "../deck/slide-id.ts";
import { parseSlideSource } from "../deck/slide-source.ts";
import * as Vocabulary from "../deck/vocabulary.ts";
import type { LayoutName } from "../deck/vocabulary.ts";
import { shippedSkillPath } from "../package-root.ts";
import { jsonPresenter, Output, outputModeFromArgv, printDocument, reply, reportFailure } from "./output.ts";
import type { ReportableError } from "./output.ts";

/**
 * `--json`, accepted before or after any subcommand. The run reads its mode from argv before
 * parsing, so a command line that does not parse still answers in JSON; the parsed value is unused.
 */
const Json = GlobalFlag.Setting("json")({
  flag: Flag.Boolean("json").pipe(
    Flag.withDescription("Print exactly one JSON document on stdout, including for failures."),
    Flag.withDefault(false)
  ),
});

/** The deck in the working directory or the nearest one above it. */
const deckLayer = Layer.suspend(() => DeckFiles.layerFrom(process.cwd()));

const create = Command.make(
  "create",
  {
    directory: Argument.String("dir").pipe(
      Argument.withDescription("The new deck's directory. It may exist if empty.")
    ),
    brief: Flag.String("brief").pipe(
      Flag.withDescription(
        "What the talk is for. BRIEF.md keeps it verbatim and the cover slide shows its first line."
      ),
      Flag.withMetavar("text"),
      Flag.optional
    ),
    theme: Flag.String("theme").pipe(
      Flag.withDescription(`A Fuse theme slug, <identity>-<brand>-<segment>. Default: ${DEFAULT_THEME}.`),
      Flag.withMetavar("slug"),
      Flag.withDefault(DEFAULT_THEME)
    ),
  },
  Effect.fn("cli.create")(function* (input) {
    const created = yield* scaffoldDeck(input);
    const next = [
      `cd ${created.root}`,
      "fuse-deck describe --json",
      "fuse-deck slides add <id> --title <text>",
      "fuse-deck check --json",
    ];
    yield* reply({
      document: { _tag: "DeckCreated", root: created.root, files: created.files, next },
      text: [
        `Created a deck in ${created.root}:`,
        ...created.files.map((file) => `  ${file}`),
        "",
        "Next:",
        ...next.map((step) => `  ${step}`),
      ].join("\n"),
    });
  })
).pipe(Command.withDescription("Scaffold a new deck: deck.json, a cover slide, BRIEF.md and AGENTS.md"));

const describe = Command.make(
  "describe",
  {},
  Effect.fn("cli.describe")(function* () {
    yield* reply({
      document: {
        _tag: "DeckVocabulary",
        skill: shippedSkillPath(),
        layouts: Vocabulary.LAYOUTS.map(({ name, summary }) => ({ name, summary })),
        defaultLayout: Vocabulary.DEFAULT_LAYOUT,
        frontmatter: Vocabulary.FRONTMATTER_FIELDS.map(({ name, type, summary }) => ({
          name,
          type,
          summary,
        })),
        components: Vocabulary.COMPONENTS.map(({ name, usage, summary }) => ({ name, usage, summary })),
        deck: Vocabulary.DECK_FIELDS.map(({ name, type, summary }) => ({ name, type, summary })),
        files: Vocabulary.FILES.map(({ path, summary }) => ({ path, summary })),
        commands: Vocabulary.VERBS.map(({ usage, summary }) => ({ usage, summary })),
      },
      text: describeText(),
    });
  })
).pipe(
  Command.withDescription(
    "Print every layout, component, frontmatter key, setting and command, and the path of the shipped skill, as one document"
  )
);

const list = Command.make(
  "list",
  {},
  Effect.fn("cli.slides.list")(function* () {
    const deck = yield* DeckFiles;
    const loaded = yield* deck.load;
    const slides: Array<{ id: SlideId; path: string; title: string | null; layout: LayoutName | null }> = [];
    for (const { id } of loaded.slides) {
      const source = loaded.dangling.includes(id)
        ? Option.none()
        : Result.getSuccess(parseSlideSource(id, yield* deck.readSlide(id)));
      slides.push({
        id,
        path: slidePath(id),
        title: Option.getOrNull(Option.flatMap(source, (each) => each.title)),
        layout: Option.getOrNull(Option.map(source, (each) => each.layout)),
      });
    }
    yield* reply({
      document: { _tag: "SlideList", slides },
      text:
        slides.length === 0
          ? "The deck has no slides."
          : slides
              .map(
                (slide, index) =>
                  `${String(index + 1)}. ${slide.id}  ${slide.title ?? "(no title)"}  [${slide.layout ?? "unreadable"}]`
              )
              .join("\n"),
    });
  })
).pipe(
  Command.withDescription("List the slides in order, with each one's title and layout"),
  Command.provide(deckLayer)
);

const slideIdArgument = Argument.String("id").pipe(Argument.withSchema(SlideId));
const anchorFlag = (name: "after" | "before", description: string) =>
  Flag.String(name).pipe(
    Flag.withDescription(description),
    Flag.withMetavar("id"),
    Flag.withSchema(SlideId),
    Flag.optional
  );

const add = Command.make(
  "add",
  {
    id: slideIdArgument.pipe(
      Argument.withDescription("The new slide's id: lowercase letters, digits and dashes.")
    ),
    after: anchorFlag("after", "Put the new slide after this one. Default: at the end."),
    layout: Flag.Literals("layout", Vocabulary.LAYOUT_NAMES).pipe(
      Flag.withDescription(`The slide's layout. Default: ${Vocabulary.DEFAULT_LAYOUT}.`),
      Flag.optional
    ),
    title: Flag.String("title").pipe(
      Flag.withDescription("The slide's first heading. Default: the id in words."),
      Flag.withMetavar("text"),
      Flag.optional
    ),
  },
  Effect.fn("cli.slides.add")(function* ({ id, after, layout, title }) {
    const deck = yield* DeckFiles;
    const position: OrderPosition = Option.match(after, {
      onNone: () => ({ _tag: "End" }),
      onSome: (anchor) => ({ _tag: "After", anchor }),
    });
    const manifest = yield* deck.addSlide(id, position, newSlide(id, layout, title));
    yield* reply({
      document: { _tag: "SlideAdded", id, path: slidePath(id), order: manifest.order },
      text: `Added ${slidePath(id)}.\n${orderText(manifest)}`,
    });
  })
).pipe(Command.withDescription("Create slides/<id>.mdx and add it to the order"), Command.provide(deckLayer));

const move = Command.make(
  "move",
  {
    id: slideIdArgument.pipe(Argument.withDescription("The slide to move.")),
    after: anchorFlag("after", "Move it after this slide."),
    before: anchorFlag("before", "Move it before this slide."),
  },
  Effect.fn("cli.slides.move")(function* ({ id, after, before }) {
    const deck = yield* DeckFiles;
    const position = Option.getOrThrowWith(
      Option.orElse(
        Option.map(after, (anchor) => ({ _tag: "After", anchor }) as const),
        () => Option.map(before, (anchor) => ({ _tag: "Before", anchor }) as const)
      ),
      () => new Error("The move validation lets only one anchor through.")
    );
    const manifest = yield* deck.moveSlide(id, position);
    yield* reply({
      document: { _tag: "SlideMoved", id, order: manifest.order },
      text: `Moved ${id}.\n${orderText(manifest)}`,
    });
  })
).pipe(
  Command.validate(({ after, before }) =>
    Option.isSome(after) === Option.isSome(before)
      ? Effect.fail(new CliError.ValidationError({ message: "Pass exactly one of --after and --before." }))
      : Effect.void
  ),
  Command.withDescription("Move a slide in the order"),
  Command.provide(deckLayer)
);

const remove = Command.make(
  "remove",
  { id: slideIdArgument.pipe(Argument.withDescription("The slide to remove.")) },
  Effect.fn("cli.slides.remove")(function* ({ id }) {
    const deck = yield* DeckFiles;
    const manifest = yield* deck.removeSlide(id);
    yield* reply({
      document: { _tag: "SlideRemoved", id, path: slidePath(id), order: manifest.order },
      text: `Removed ${id} and deleted ${slidePath(id)}.\n${orderText(manifest)}`,
    });
  })
).pipe(
  Command.withDescription("Take a slide out of the order and delete its file"),
  Command.provide(deckLayer)
);

const slides = Command.make("slides").pipe(
  Command.withDescription("List, add, move and remove slides, keeping deck.json and the files in step"),
  // Each subcommand finds the deck itself, so `slides` without one reports a usage error from
  // anywhere instead of failing to find a deck first.
  Command.withSubcommands([list, add, move, remove])
);

const check = Command.make(
  "check",
  {},
  Effect.fn("cli.check")(function* () {
    const report = yield* checkDeck();
    yield* reply({
      document: { _tag: "DeckChecked", slides: report.slides, theme: report.theme },
      text: `The deck's ${String(report.slides)} slides are consistent. Theme: ${report.theme}.`,
    });
  })
).pipe(
  Command.withDescription(
    "Report dangling ids, orphan files and invalid frontmatter; exit 1 when there are any"
  ),
  Command.provide(deckLayer)
);

const cli = Command.make("fuse-deck").pipe(
  Command.withDescription(
    "Build Fuse-themed slide decks from MDX. Agents start with `fuse-deck describe --json`."
  ),
  Command.withGlobalFlags([Json]),
  Command.withSubcommands([create, describe, slides, check])
);

/** A slide's starting text. */
function newSlide(id: SlideId, layout: Option.Option<LayoutName>, title: Option.Option<string>): string {
  const heading = Option.getOrElse(title, () => {
    const words = id.split("-").join(" ");
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  });
  const frontmatter = Option.match(layout, {
    onNone: () => "",
    onSome: (name) => `---\nlayout: ${name}\n---\n\n`,
  });
  return `${frontmatter}# ${mdxText(heading)}\n`;
}

function orderText(manifest: DeckManifest): string {
  return `Order: ${manifest.order.join(", ")}`;
}

function describeText(): string {
  const section = (title: string, rows: ReadonlyArray<readonly [string, string]>) =>
    [title, ...rows.map(([name, summary]) => `  ${name}\n    ${summary}`)].join("\n");
  return [
    section(
      "LAYOUTS",
      Vocabulary.LAYOUTS.map(({ name, summary }) => [name, summary])
    ),
    section(
      "FRONTMATTER",
      Vocabulary.FRONTMATTER_FIELDS.map(({ name, summary }) => [name, summary])
    ),
    section(
      "COMPONENTS",
      Vocabulary.COMPONENTS.map(({ usage, summary }) => [usage, summary])
    ),
    section(
      "DECK.JSON",
      Vocabulary.DECK_FIELDS.map(({ name, summary }) => [name, summary])
    ),
    section(
      "FILES",
      Vocabulary.FILES.map(({ path, summary }) => [path, summary])
    ),
    section(
      "COMMANDS",
      Vocabulary.VERBS.map(({ usage, summary }) => [usage, summary])
    ),
    section("SKILL", [
      [shippedSkillPath(), "The workflow for writing a deck. Open it before the first slide."],
    ]),
  ].join("\n\n");
}

/** The exit status of a failed run: 2 for a command line that does not parse, 1 otherwise. */
const ExitCode = Schema.Literals([1, 2]);

/**
 * A failure the run has already reported. The runtime exits with its status but does not log it
 * again with a stack trace.
 */
class ReportedFailure extends Schema.TaggedError<ReportedFailure>()("ReportedFailure", {
  exitCode: ExitCode,
}) {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = this.exitCode;
}

/** A command line that did not parse. The presenter has reported it, so this only sets exit 2. */
function usage(_error: CliError.CliError): Effect.Effect<never, ReportedFailure> {
  return Effect.fail(new ReportedFailure({ exitCode: 2 }));
}

function report(error: ReportableError): Effect.Effect<never, ReportedFailure> {
  return reportFailure(error).pipe(Effect.andThen(Effect.fail(new ReportedFailure({ exitCode: 1 }))));
}

/**
 * In JSON mode a defect still answers with one document, so stdout always parses. Interrupts and
 * reported failures pass through.
 */
function reportDefect(cause: Cause.Cause<ReportedFailure>): Effect.Effect<never, ReportedFailure> {
  return Cause.hasDies(cause)
    ? printDocument({ _tag: "UnexpectedError", message: Cause.pretty(cause) }).pipe(
        Effect.andThen(Effect.fail(new ReportedFailure({ exitCode: 1 })))
      )
    : Effect.failCause(cause);
}

/** Only `--help`, `--version` and `--log-level`; the wizard and completions write to stdout themselves. */
const BUILT_INS = [GlobalFlag.Help, GlobalFlag.Version, GlobalFlag.LogLevel];

/**
 * Run the command line. A failure type without a `_tag` and a `message` does not compile here, so
 * no new error can skip the report.
 *
 * @param argv - The arguments after the executable and script path.
 */
export const runCli = (argv: readonly string[]) => {
  const mode = outputModeFromArgv(argv);
  const run = Command.runWith(cli, { version: packageJson.version })(argv).pipe(
    Effect.catchIf(CliError.isCliError, usage, report)
  );
  return (mode === "json" ? run.pipe(Effect.catchCause(reportDefect)) : run).pipe(
    Effect.provideService(Output, mode),
    Effect.provide([
      CliConfig.layer({ builtIns: BUILT_INS }),
      mode === "json" ? CliOutput.layerPresenter(jsonPresenter) : Layer.empty,
    ])
  );
};
