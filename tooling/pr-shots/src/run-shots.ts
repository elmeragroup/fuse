/**
 * One `pnpm shots` run: starts the local docs server when a side needs it, takes the before and
 * after shots, diffs each pair, writes `table.md`, and uploads to a pull request when `--pr` asks
 * for it.
 */

import { Clock, Console, Duration, Effect, FileSystem, Option, Schema } from "effect";
import type { PlatformError } from "effect";
import path from "node:path";

import { Capture } from "./capture.ts";
import { DocsServer } from "./docs-server.ts";
import type { ReservedDocsServer } from "./docs-server.ts";
import { holdLock } from "./file-lock.ts";
import { Gh } from "./gh.ts";
import type { ShotOptions, Source } from "./options.ts";
import { diffPngs } from "./pixel-diff.ts";
import type { PngFile } from "./pixel-diff.ts";
import { placeShots } from "./pr-body.ts";
import { planCoordinates, planShots } from "./shot-plan.ts";
import type { Shot, ShotRow } from "./shot-plan.ts";
import {
  MAX_ATTACHMENTS,
  attachedFiles,
  ghEditArgs,
  plannedAttachmentCount,
  renderTable,
  shellCommand,
} from "./shot-table.ts";
import type { BeforeOutcome, ComparedRow, DiffCell, TableRows } from "./shot-table.ts";

/** The before source answered the route with an error other than 404. */
export class RouteRefused extends Schema.TaggedError<RouteRefused>()("RouteRefused", {
  message: Schema.String,
  route: Schema.String,
  status: Schema.Number,
}) {}

/** The run could not create, read or write a file in its output directory. */
export class OutputFailed extends Schema.TaggedError<OutputFailed>()("OutputFailed", {
  message: Schema.String,
  path: Schema.String,
}) {}

/** A run with `--pr` would upload more images than one `gh pr edit` attaches. */
export class TooManyAttachments extends Schema.TaggedError<TooManyAttachments>()("TooManyAttachments", {
  message: Schema.String,
  count: Schema.Number,
}) {}

/** How often a run tries again for the lock of a pull request another run is uploading to. */
const UPLOAD_LOCK_POLL = Duration.millis(200);

/** How long it waits in all: longer than any upload takes. */
const UPLOAD_LOCK_WAIT = Duration.minutes(2);

/** The lock file in a run's output directory; its leading dot keeps it out of the listings. */
const OUTPUT_LOCK = ".pr-shots.lock";

/** Another run held the pull request's lock for longer than the run waits. */
export class UploadWaitTimedOut extends Schema.TaggedError<UploadWaitTimedOut>()("UploadWaitTimedOut", {
  message: Schema.String,
  /** The pull request. */
  pr: Schema.Number,
  /** How long the run waited before it gave up, by its clock. */
  waitedMillis: Schema.Number,
}) {}

/**
 * Takes the pull request's lock for the scope. A live run holding it is contention, so the run
 * tries again until `UPLOAD_LOCK_WAIT` has passed on the clock and then gives up. Anything else,
 * such as a lock that needs a human to delete a file, fails at once with its instruction.
 */
const waitForPullRequestLock = Effect.fn("runShots.waitForPullRequestLock")(function* (
  lockFile: string,
  pr: number
) {
  const started = yield* Clock.currentTimeMillis;
  const deadline = started + Duration.toMillis(UPLOAD_LOCK_WAIT);
  for (;;) {
    const taken = yield* holdLock(lockFile, `pull request #${String(pr)}`).pipe(Effect.result);
    if (taken._tag === "Success") {
      return;
    }
    if (taken.failure._tag !== "LockHeld") {
      return yield* Effect.fail(taken.failure);
    }
    const now = yield* Clock.currentTimeMillis;
    if (now >= deadline) {
      return yield* new UploadWaitTimedOut({
        message: `Another pr-shots run has held pull request #${String(pr)} for ${String(Duration.toMinutes(UPLOAD_LOCK_WAIT))} minutes, longer than an upload takes. ${taken.failure.message}`,
        pr,
        waitedMillis: now - started,
      });
    }
    yield* Effect.sleep(UPLOAD_LOCK_POLL);
  }
});

/** `--fill` was given without a `--target` to type into. */
export class FillNeedsTarget extends Schema.TaggedError<FillNeedsTarget>()("FillNeedsTarget", {
  message: Schema.String,
}) {}

/** The PR body the run writes for `gh pr edit --body-file`, beside the images. */
const BODY_FILE = "pr-body.md";

/**
 * Take a run's shots and write them under `.scratch/shots/<name>/` in `repoRoot`.
 *
 * @param options - The parsed run.
 * @param repoRoot - The checkout's root directory.
 */
export const runShots = Effect.fn("runShots")(function* (options: ShotOptions, repoRoot: string) {
  if (options.fill !== null && options.target === null) {
    return yield* new FillNeedsTarget({
      message: "--fill types into the --target element, so it needs --target as well.",
    });
  }
  // Checked from the matrix, before any page opens, so an upload that cannot work costs nothing.
  const planned = plannedAttachmentCount(planCoordinates(options), options.diff);
  if (options.pr !== null && planned > MAX_ATTACHMENTS) {
    return yield* new TooManyAttachments({
      message: `This run would upload ${String(planned)} images, but gh pr edit attaches at most ${String(MAX_ATTACHMENTS)}. Take fewer themes, densities, engines or window sizes per run and split the matrix across runs with different names.`,
      count: planned,
    });
  }
  const capture = yield* Capture;
  const docs = yield* DocsServer;
  const outDir = path.join(repoRoot, ".scratch/shots", options.name);

  // Every lock comes before the first change, so a run that cannot have them fails having
  // touched nothing. The output lock is held through the upload. Finalizers run in reverse, so
  // it is freed last.
  yield* holdLock(path.join(outDir, OUTPUT_LOCK), `the output directory ${shown(outDir)}`);
  const localServer =
    options.before._tag === "local" || options.after._tag === "local"
      ? Option.some(yield* docs.reserve)
      : Option.none<ReservedDocsServer>();
  yield* prepareOutDir(outDir);

  // Started on first use and shared by both sides; the run's scope stops it.
  const local = yield* Effect.cached(
    Option.match(localServer, {
      onNone: () => Effect.die("a local source without a reserved docs server"),
      onSome: (reserved) =>
        Console.log("Starting the docs app from this checkout (next dev)…").pipe(
          Effect.andThen(reserved.start(options.route))
        ),
    })
  );
  const resolve = (source: Source) => (source._tag === "remote" ? Effect.succeed(source.origin) : local);

  // `auto` resolves on the change, the after source, and both sides use that frame, so each
  // pair compares like with like.
  const afterOrigin = yield* resolve(options.after);
  const afterLabel = sourceLabel(options.after);
  const frame = yield* capture.resolveFrame({ origin: afterOrigin, sourceLabel: afterLabel, options });
  const rows = planShots(options, frame);

  const beforeOrigin = yield* resolve(options.before);
  const beforeLabel = sourceLabel(options.before);
  const beforeStatus = yield* capture.probe(beforeOrigin, options.route);
  let before: BeforeOutcome = { _tag: "captured" };
  if (beforeStatus === 404) {
    before = { _tag: "not-deployed" };
    yield* Console.log(`${options.route} answers 404 on ${beforeLabel}; skipping the before shots.`);
  } else if (beforeStatus >= 400) {
    return yield* new RouteRefused({
      message: `${options.route} answered ${String(beforeStatus)} on ${beforeLabel}`,
      route: options.route,
      status: beforeStatus,
    });
  } else {
    yield* Console.log(`Capturing before shots from ${beforeLabel}…`);
    yield* capture.capture({
      origin: beforeOrigin,
      sourceLabel: beforeLabel,
      options,
      shots: rows.map((row) => row.before),
      outDir,
    });
  }

  yield* Console.log(`Capturing after shots from ${afterLabel}…`);
  yield* capture.capture({
    origin: afterOrigin,
    sourceLabel: afterLabel,
    options,
    shots: rows.map((row) => row.after),
    outDir,
  });

  const tableRows = yield* diffPairs(options, rows, before, outDir);
  const table = renderTable(options, tableRows, before, beforeLabel, afterLabel);
  yield* writeOutput(path.join(outDir, "table.md"), table);
  const files = attachedFiles(tableRows, before);
  yield* report(outDir, files);
  yield* upload(options, outDir, table, files);
}, Effect.scoped);

/**
 * Writes `<row>-diff.png` for every pair whose images share a size, and returns the rows with
 * what comparing each pair found.
 */
const diffPairs = Effect.fn("runShots.diffPairs")(function* (
  options: ShotOptions,
  rows: readonly ShotRow[],
  before: BeforeOutcome,
  outDir: string
) {
  if (options.diff === "off") {
    return { _tag: "without-diff", rows } satisfies TableRows;
  }
  if (before._tag === "not-deployed") {
    return {
      _tag: "with-diff",
      rows: rows.map((row): ComparedRow => ({ row, diff: { _tag: "no-before" } })),
    } satisfies TableRows;
  }
  yield* Console.log("Comparing each before and after pair…");
  const fs = yield* FileSystem.FileSystem;
  const read = (shot: Shot) => {
    const file = path.join(outDir, shot.file);
    return fs.readFile(file).pipe(
      Effect.map((bytes): PngFile => ({ file: shot.file, bytes })),
      Effect.mapError(outputFailed("read", file))
    );
  };
  const compared = yield* Effect.forEach(rows, (row) =>
    Effect.gen(function* () {
      const diff = yield* Effect.fromResult(
        diffPngs(yield* read(row.before), yield* read(row.after), options.threshold)
      );
      if (diff._tag === "size-changed") {
        return { row, diff } satisfies ComparedRow;
      }
      const diffPath = path.join(outDir, row.diffFile);
      yield* fs.writeFile(diffPath, diff.png).pipe(Effect.mapError(outputFailed("write", diffPath)));
      const cell: DiffCell = { _tag: "compared", changed: diff.changed, total: diff.total };
      return { row, diff: cell } satisfies ComparedRow;
    })
  );
  return { _tag: "with-diff", rows: compared } satisfies TableRows;
});

function sourceLabel(source: Source): string {
  return source._tag === "remote" ? source.label : "local checkout";
}

/** Creates the run directory and clears what an earlier run of the same name left there. */
const prepareOutDir = Effect.fn("runShots.prepareOutDir")(function* (outDir: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(outDir, { recursive: true }).pipe(Effect.mapError(outputFailed("create", outDir)));
  const files = yield* fs.readDirectory(outDir).pipe(Effect.mapError(outputFailed("read", outDir)));
  const stale = files.filter((file) => file.endsWith(".png") || file === "table.md" || file === BODY_FILE);
  yield* Effect.forEach(stale, (file) => {
    const stalePath = path.join(outDir, file);
    return fs.remove(stalePath).pipe(Effect.mapError(outputFailed("remove", stalePath)));
  });
});

function writeOutput(file: string, content: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(file, content).pipe(Effect.mapError(outputFailed("write", file)));
  });
}

function outputFailed(operation: "create" | "read" | "remove" | "write", file: string) {
  return (cause: PlatformError.PlatformError) =>
    new OutputFailed({ message: `Could not ${operation} ${file}: ${cause.message}`, path: file });
}

/** The output directory as the user's shell sees it. */
function shown(outDir: string): string {
  return path.relative(process.cwd(), outDir) || ".";
}

function report(outDir: string, files: readonly string[]) {
  return Console.log(
    [`\nWrote to ${shown(outDir)}/:`, ...files.map((file) => `  ${file}`), "  table.md"].join("\n")
  );
}

const upload = Effect.fn("runShots.upload")(function* (
  options: ShotOptions,
  outDir: string,
  table: string,
  files: readonly string[]
) {
  const relative = shown(outDir);
  if (options.pr === null) {
    const command = shellCommand("gh", ghEditArgs("<pr>", BODY_FILE, files));
    const tooMany =
      files.length > MAX_ATTACHMENTS
        ? `\nWarning: gh pr edit attaches at most ${String(MAX_ATTACHMENTS)} files; this run has ${String(files.length)}. Split the matrix across runs before uploading.`
        : "";
    yield* Console.log(
      `\nTo upload, put table.md into the PR body's ## Verification section as ${relative}/${BODY_FILE}, then run:\n` +
        `  cd ${relative} && ${command}${tooMany}\n` +
        "Or run again with --pr <n> to do both."
    );
    return;
  }
  const pr = options.pr;
  const gh = yield* Gh;
  // The body is read, edited and written back whole, so two runs uploading to one pull request
  // at once would drop the block of whichever wrote first. A lock per pull request in this
  // checkout's `.scratch/shots/` makes the second run wait for the first, for at most
  // `UPLOAD_LOCK_WAIT`. Runs on other machines are not covered.
  yield* Effect.scoped(
    Effect.gen(function* () {
      yield* waitForPullRequestLock(path.join(path.dirname(outDir), `.pr-${String(pr)}.lock`), pr);
      const body = yield* gh.readBody(pr);
      yield* writeOutput(path.join(outDir, BODY_FILE), placeShots(body, options.name, table));
      const args = ghEditArgs(String(pr), BODY_FILE, files);
      yield* Console.log(`\ncd ${relative} && ${shellCommand("gh", args)}`);
      yield* Console.log(yield* gh.edit(args, outDir));
    })
  );
});
