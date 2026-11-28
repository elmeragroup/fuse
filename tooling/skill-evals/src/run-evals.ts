/**
 * A whole eval pass: it makes a new run folder, snapshots the inputs, resolves each fixture once,
 * runs the cells, and rewrites the report and the JSON record after each cell, so a stopped pass
 * keeps what it finished.
 */

import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { tmpdir } from "node:os";

import { runCell } from "./cell.ts";
import type { CellKey, CellResult, RunSettings } from "./cell.ts";
import type { CheckResult } from "./checks.ts";
import { runCommand, succeeded } from "./command.ts";
import { isInside, scrubEnvironment } from "./isolation.ts";
import { encodeJsonText } from "./json-text.ts";
import { freezeFixtures, snapshotInputs } from "./pass.ts";
import { renderReport, runRecord } from "./report.ts";
import type { RunProvenance } from "./report.ts";
import { ARMS, loadTasks } from "./task.ts";
import type { Arm, Task } from "./task.ts";

/** What the command line asks for. */
export type EvalOptions = {
  /** The task ids to run, or every task when empty. */
  readonly tasks: readonly string[];
  readonly arms: "both" | Arm;
  /** How many times to run each cell, from 1. */
  readonly repeat: number;
  readonly model: string;
  /** How many cells run at once, from 1. */
  readonly concurrency: number;
  /** The most one agent run may spend, in US dollars. */
  readonly maxBudgetUsd: number;
  /** How long one agent run may take, in minutes. */
  readonly timeoutMinutes: number;
  /** The run's folder, which must not exist yet, or a new one under the system's temporary folder. */
  readonly out: string | undefined;
  /** Whether to run the agent, or only set up and check the untouched fixtures. */
  readonly agent: "run" | "skip";
};

/** The run cannot start: an option is out of range, a task is unknown or an input is missing. */
export class EvalsUnstartable extends Schema.TaggedError<EvalsUnstartable>()("EvalsUnstartable", {
  message: Schema.String,
}) {}

/** The report or the record could not be written at the end of the pass. */
export class ReportWriteFailed extends Schema.TaggedError<ReportWriteFailed>()("ReportWriteFailed", {
  message: Schema.String,
}) {}

const INSTALL_COMMAND = /pnpm add @elmeragroup\/fuse[^\s"'`\\]*/u;

/** The canonical form of a path that may not exist yet: its nearest existing ancestor, resolved. */
const canonicalPath = Effect.fn("runEvals.canonicalPath")(function* (target: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rest: string[] = [];
  let current = target;
  for (;;) {
    const real = yield* fs.realPath(current).pipe(Effect.option);
    if (real._tag === "Some") return path.join(real.value, ...rest.reverse());
    const parent = path.dirname(current);
    if (parent === current) return target;
    rest.push(path.basename(current));
    current = parent;
  }
});

/**
 * Runs the evals the options pick.
 *
 * @param options - The parsed command line.
 * @param repoRoot - The checkout that holds `apps/mcp` and the generated docs catalog.
 * @returns The folder that holds the report, once every cell has finished.
 */
export const runEvals = Effect.fn("runEvals")(function* (options: EvalOptions, repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const unstartable = (message: string) => new EvalsUnstartable({ message });

  for (const [name, value] of [
    ["--repeat", options.repeat],
    ["--concurrency", options.concurrency],
  ] as const) {
    if (!Number.isInteger(value) || value < 1)
      return yield* unstartable(`${name} must be a whole number from 1.`);
  }
  if (!(options.maxBudgetUsd > 0)) return yield* unstartable("--max-budget-usd must be above 0.");
  if (!(options.timeoutMinutes > 0)) return yield* unstartable("--timeout-minutes must be above 0.");

  const packageRoot = path.join(repoRoot, "tooling/skill-evals");
  const checkout = {
    serverBundle: path.join(repoRoot, "apps/mcp/dist/main.mjs"),
    catalogFile: path.join(repoRoot, "apps/docs/src/generated/catalog.json"),
    skillsDirectory: path.join(repoRoot, "apps/mcp/skills"),
    taskFile: path.join(packageRoot, "tasks.json"),
  };
  for (const [file, how] of [
    [checkout.serverBundle, "pnpm --filter mcp build"],
    [checkout.catalogFile, "pnpm exec turbo run generate --filter=docs"],
  ] as const) {
    if (!(yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false)))) {
      return yield* unstartable(`${file} is missing. Run \`${how}\` first.`);
    }
  }
  // Read the task file first, so an unknown task fails before the run folder exists.
  const checkoutTasks = yield* loadTasks(checkout.taskFile);
  const unknown = options.tasks.filter((id) => !checkoutTasks.some((task) => task.id === id));
  if (unknown.length > 0) {
    return yield* unstartable(
      `Unknown task ${unknown.join(", ")}. Tasks: ${checkoutTasks.map((task) => task.id).join(", ")}.`
    );
  }

  const command = (executable: string, args: readonly string[]) =>
    runCommand({
      executable,
      args,
      cwd: repoRoot,
      env: scrubEnvironment(process.env, []),
      timeout: Duration.seconds(30),
    }).pipe(
      Effect.mapError((cause) => unstartable(cause.message)),
      Effect.flatMap((run) =>
        succeeded(run)
          ? Effect.succeed(run.stdout.trim())
          : unstartable(`${executable} ${args.join(" ")} failed: ${run.stderr}`)
      )
    );
  const checkoutCommit = yield* command("git", ["rev-parse", "--short", "HEAD"]);
  const changed = yield* command("git", ["diff", "HEAD", "--name-only"]);
  const claudeVersion = options.agent === "run" ? yield* command("claude", ["--version"]) : "(not run)";
  const startedAt = DateTime.formatIso(yield* DateTime.now);

  const requested = path.resolve(
    options.out ?? path.join(tmpdir(), "fuse-skill-evals", startedAt.replace(/[:.]/gu, "-"))
  );
  const repoReal = yield* canonicalPath(repoRoot);
  const outReal = yield* canonicalPath(requested);
  // pnpm would install an app inside the checkout as part of the workspace.
  if (isInside(repoReal, outReal)) {
    return yield* unstartable(`--out must be outside the repository, but ${requested} is inside it.`);
  }
  yield* fs
    .makeDirectory(path.dirname(outReal), { recursive: true })
    .pipe(Effect.mapError((cause) => unstartable(cause.message)));
  // A pass never reuses a folder, so no cell can score another pass's app.
  yield* fs
    .makeDirectory(outReal)
    .pipe(
      Effect.mapError((cause) =>
        unstartable(
          cause.reason._tag === "AlreadyExists"
            ? `${requested} already exists. Each pass writes a new folder.`
            : cause.message
        )
      )
    );
  const outDirectory = outReal;

  const forbiddenFolders = [...new Set([repoRoot, repoReal, requested, outDirectory])];
  const environment = scrubEnvironment(process.env, forbiddenFolders);
  const snapshot = yield* snapshotInputs(checkout, outDirectory).pipe(
    Effect.mapError((cause) => unstartable(cause.message))
  );
  const allTasks = yield* loadTasks(snapshot.taskFile);
  const tasks: readonly Task[] =
    options.tasks.length === 0 ? allTasks : allTasks.filter((task) => options.tasks.includes(task.id));
  const catalogText = yield* fs
    .readFileString(snapshot.inputs.catalogFile)
    .pipe(Effect.mapError((cause) => unstartable(cause.message)));
  yield* Console.log(
    `Resolving ${String(new Set(tasks.map((task) => task.fixture)).size)} fixture(s) in ${outDirectory}`
  );
  const frozen = yield* freezeFixtures(
    tasks,
    path.join(packageRoot, "fixtures"),
    outDirectory,
    environment
  ).pipe(Effect.mapError((cause) => unstartable(cause.message)));

  const provenance: RunProvenance = {
    model: options.model,
    checkoutCommit,
    uncommitted: changed === "" ? [] : changed.split("\n"),
    installCommand: INSTALL_COMMAND.exec(catalogText)?.[0],
    claudeVersion,
    inputs: [...snapshot.digests, ...frozen.digests],
    startedAt,
  };
  const untouched: Readonly<Record<string, readonly CheckResult[]>> = frozen.untouched;
  const settings: RunSettings = {
    inputs: snapshot.inputs,
    fixtures: frozen.fixtures,
    outDirectory,
    model: options.model,
    maxBudgetUsd: options.maxBudgetUsd,
    agentTimeout: Duration.minutes(options.timeoutMinutes),
    agent: options.agent,
    environment,
    forbidden: [
      ...[repoRoot, repoReal].map((folder) => ({ label: "the checkout", path: folder })),
      ...[requested, outDirectory].map((folder) => ({ label: "the run's folder", path: folder })),
    ],
  };

  const arms = options.arms === "both" ? ARMS : [options.arms];
  const keys: CellKey[] = tasks.flatMap((task) =>
    arms.flatMap((arm) =>
      Array.from({ length: options.repeat }, (_, index) => ({ task, arm, repeat: index + 1 }))
    )
  );
  yield* Console.log(`Running ${String(keys.length)} cell(s)`);

  // One writer: each write takes the newest snapshot under the lock and replaces each file by
  // rename, so an older snapshot never lands after a newer one.
  const finished = yield* Ref.make<readonly CellResult[]>([]);
  const unrecorded = yield* Ref.make<readonly string[]>([]);
  const lock = yield* Semaphore.make(1);
  const replace = (file: string, text: string) =>
    fs.writeFileString(`${file}.tmp`, text).pipe(Effect.andThen(fs.rename(`${file}.tmp`, file)));
  const write = lock
    .withPermits(1)(
      Effect.gen(function* () {
        const record = runRecord(provenance, untouched, yield* Ref.get(finished));
        const json = yield* encodeJsonText(record);
        yield* replace(path.join(outDirectory, "results.json"), `${json}\n`);
        yield* replace(path.join(outDirectory, "report.md"), renderReport(record, tasks));
      })
    )
    .pipe(
      Effect.mapError(
        (cause) => new ReportWriteFailed({ message: `Writing the report failed: ${cause.message}` })
      )
    );

  yield* Effect.forEach(
    keys,
    (key) =>
      Effect.gen(function* () {
        const label = `${key.task.id} ${key.arm} #${String(key.repeat)}`;
        yield* Console.log(`▶ ${label}`);
        const result = yield* runCell(settings, key).pipe(Effect.result);
        if (result._tag === "Failure") {
          yield* Console.error(`✗ ${label}: ${result.failure.message}`);
          yield* Ref.update(unrecorded, (labels) => [...labels, label]);
          return;
        }
        const cell = result.success;
        yield* Ref.update(finished, (cells) => [...cells, cell]);
        yield* write.pipe(
          Effect.catch((cause) => Console.error(`${cause.message}. The next write retries.`))
        );
        const passed = cell.checks.filter((check) => check.passed).length;
        const cost = cell.agent?.cost._tag === "known" ? ` $${cell.agent.cost.usd.toFixed(2)}` : "";
        const state =
          cell.status._tag === "not-started"
            ? `did not start: ${cell.status.message.split("\n")[0] ?? ""}`
            : `${cell.status._tag}${cell.sample._tag === "set-apart" ? ", set apart" : ""}, ${String(passed)}/${String(cell.checks.length)} checks${cost}`;
        yield* Console.log(
          `${cell.status._tag === "finished" || cell.status._tag === "agent-skipped" ? "✓" : "✗"} ${label}: ${state}`
        );
      }),
    { concurrency: options.concurrency, discard: true }
  );
  yield* write;
  yield* Console.log(
    `\nReport: ${path.join(outDirectory, "report.md")}\nRecord: ${path.join(outDirectory, "results.json")}`
  );
  const lost = yield* Ref.get(unrecorded);
  if (lost.length > 0) {
    return yield* new ReportWriteFailed({
      message: `The records of ${lost.join(", ")} could not be written.`,
    });
  }
  return outDirectory;
});
