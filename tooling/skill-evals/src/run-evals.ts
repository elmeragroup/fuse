/**
 * A whole eval run: it picks the cells from the options, runs them, and rewrites the report and
 * the JSON record after each cell, so a stopped run keeps what it finished.
 */

import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { tmpdir } from "node:os";

import { runCell } from "./cell.ts";
import type { CellKey, CellResult, RunSettings } from "./cell.ts";
import { runCommand, succeeded } from "./command.ts";
import { encodeJsonText } from "./json-text.ts";
import { renderReport, runRecord } from "./report.ts";
import type { RunProvenance } from "./report.ts";
import { ARMS, loadTasks } from "./task.ts";
import type { Arm } from "./task.ts";

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
  /** The output folder, or a new one under the system's temporary folder. */
  readonly out: string | undefined;
  /** Whether to run the agent, or only set up and check the untouched fixtures. */
  readonly agent: "run" | "skip";
};

/** The run cannot start: an option is out of range, a task is unknown or an input is missing. */
export class EvalsUnstartable extends Schema.TaggedError<EvalsUnstartable>()("EvalsUnstartable", {
  message: Schema.String,
}) {}

const INSTALL_COMMAND = /pnpm add @elmeragroup\/fuse[^\s"'`\\]*/u;

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
  const allTasks = yield* loadTasks(path.join(packageRoot, "tasks.json"));
  const unknown = options.tasks.filter((id) => !allTasks.some((task) => task.id === id));
  if (unknown.length > 0) {
    return yield* unstartable(
      `Unknown task ${unknown.join(", ")}. Tasks: ${allTasks.map((task) => task.id).join(", ")}.`
    );
  }
  const tasks =
    options.tasks.length === 0 ? allTasks : allTasks.filter((task) => options.tasks.includes(task.id));

  const serverBundle = path.join(repoRoot, "apps/mcp/dist/main.mjs");
  const catalogFile = path.join(repoRoot, "apps/docs/src/generated/catalog.json");
  for (const [file, how] of [
    [serverBundle, "pnpm --filter mcp build"],
    [catalogFile, "pnpm exec turbo run generate --filter=docs"],
  ] as const) {
    if (!(yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false)))) {
      return yield* unstartable(`${file} is missing. Run \`${how}\` first.`);
    }
  }
  const catalogText = yield* fs
    .readFileString(catalogFile)
    .pipe(Effect.mapError((cause) => unstartable(cause.message)));

  const git = (args: readonly string[]) =>
    runCommand({ executable: "git", args, cwd: repoRoot, timeout: Duration.seconds(30) }).pipe(
      Effect.mapError((cause) => unstartable(cause.message)),
      Effect.flatMap((run) =>
        succeeded(run)
          ? Effect.succeed(run.stdout.trim())
          : unstartable(`git ${args.join(" ")} failed: ${run.stderr}`)
      )
    );
  const commit = yield* git(["rev-parse", "--short", "HEAD"]);
  const changed = yield* git(["diff", "HEAD", "--name-only"]);
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const provenance: RunProvenance = {
    model: options.model,
    commit,
    uncommitted: changed === "" ? [] : changed.split("\n"),
    installCommand: INSTALL_COMMAND.exec(catalogText)?.[0],
    startedAt,
  };

  const outDirectory = path.resolve(
    options.out ?? path.join(tmpdir(), "fuse-skill-evals", provenance.startedAt.replace(/[:.]/gu, "-"))
  );
  // pnpm would install an app inside the checkout as part of the workspace.
  const fromRepo = path.relative(repoRoot, outDirectory);
  if (fromRepo === "" || !fromRepo.startsWith("..")) {
    return yield* unstartable(`--out must be outside the repository, but ${outDirectory} is inside it.`);
  }
  yield* fs
    .makeDirectory(outDirectory, { recursive: true })
    .pipe(Effect.mapError((cause) => unstartable(cause.message)));
  const settings: RunSettings = {
    fixturesDirectory: path.join(packageRoot, "fixtures"),
    serverBundle,
    catalogFile,
    skillsDirectory: path.join(repoRoot, "apps/mcp/skills"),
    commit,
    outDirectory,
    model: options.model,
    maxBudgetUsd: options.maxBudgetUsd,
    agentTimeout: Duration.minutes(options.timeoutMinutes),
    agent: options.agent,
  };

  const arms = options.arms === "both" ? ARMS : [options.arms];
  const keys: CellKey[] = tasks.flatMap((task) =>
    arms.flatMap((arm) =>
      Array.from({ length: options.repeat }, (_, index) => ({ task, arm, repeat: index + 1 }))
    )
  );
  yield* Console.log(`Running ${String(keys.length)} cell(s) in ${outDirectory}`);

  const finished: CellResult[] = [];
  const write = Effect.gen(function* () {
    const record = runRecord(provenance, finished);
    yield* fs.writeFileString(path.join(outDirectory, "results.json"), `${yield* encodeJsonText(record)}\n`);
    yield* fs.writeFileString(path.join(outDirectory, "report.md"), renderReport(record, tasks));
  }).pipe(Effect.orDie);
  yield* Effect.forEach(
    keys,
    (key) =>
      Effect.gen(function* () {
        yield* Console.log(`▶ ${key.task.id} ${key.arm} #${String(key.repeat)}`);
        const result = yield* runCell(settings, key);
        finished.push(result);
        yield* write;
        const passed = result.checks.filter((check) => check.passed).length;
        const cost =
          result.agent?.ending._tag === "finished" ? ` $${result.agent.ending.costUsd.toFixed(2)}` : "";
        yield* Console.log(
          result.status._tag === "setup-failed"
            ? `✗ ${key.task.id} ${key.arm} #${String(key.repeat)}: ${result.status.message}`
            : `✓ ${key.task.id} ${key.arm} #${String(key.repeat)}: ${String(passed)}/${String(result.checks.length)} checks${cost}`
        );
      }),
    { concurrency: options.concurrency, discard: true }
  );
  yield* write;
  yield* Console.log(
    `\nReport: ${path.join(outDirectory, "report.md")}\nRecord: ${path.join(outDirectory, "results.json")}`
  );
  return outDirectory;
});
