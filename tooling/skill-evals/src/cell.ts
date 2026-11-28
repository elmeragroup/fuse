/**
 * One cell of an eval run: one task, one arm, one repeat. It copies the task's fixture to its own
 * folder, installs it, starts a Fuse MCP server for the arm, runs the agent, then checks the app.
 */

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { summarizeStream } from "./agent-stream.ts";
import type { AgentRun } from "./agent-stream.ts";
import {
  checkDocument,
  checkFuseImports,
  checkSource,
  checkStylesheetMode,
  stylesheetFindings,
} from "./checks.ts";
import type { CheckResult, PackageExports, SourceFile } from "./checks.ts";
import { outputTail, runCommand, succeeded } from "./command.ts";
import { startFuseServer } from "./fuse-server.ts";
import type { SkillListing } from "./fuse-server.ts";
import { encodeJsonText } from "./json-text.ts";
import { promptFor } from "./task.ts";
import type { Arm, Task } from "./task.ts";

/** What every cell of a run shares. */
export type RunSettings = {
  /** The fixtures folder, `tooling/skill-evals/fixtures`. */
  readonly fixturesDirectory: string;
  /** The server bundle, `apps/mcp/dist/main.mjs`. */
  readonly serverBundle: string;
  /** The docs catalog the server reads. */
  readonly catalogFile: string;
  /** The skills folder the with-skill arm's server serves, `apps/mcp/skills`. */
  readonly skillsDirectory: string;
  /** The checkout's commit at run time, which the server reports as its version. */
  readonly commit: string;
  /** The run's output folder, outside the repository. */
  readonly outDirectory: string;
  /** The model both arms run. */
  readonly model: string;
  /** The most one agent run may spend, which the CLI enforces. */
  readonly maxBudgetUsd: number;
  /** How long one agent run may take before the runner stops it. */
  readonly agentTimeout: Duration.Duration;
  /** Whether to run the agent, or only set up and check the untouched fixture. */
  readonly agent: "run" | "skip";
};

/** Which cell. */
export type CellKey = { readonly task: Task; readonly arm: Arm; readonly repeat: number };

/** How a cell ended. */
export type CellStatus =
  | { readonly _tag: "checked" }
  | { readonly _tag: "setup-failed"; readonly message: string };

/** Everything one cell recorded. */
export type CellResult = {
  readonly task: string;
  readonly arm: Arm;
  readonly repeat: number;
  readonly status: CellStatus;
  /** The app the agent worked in. */
  readonly appDirectory: string;
  readonly prompt: string;
  /** What the arm's server listed, the evidence that the baseline could read no skill. */
  readonly server: { readonly skills: SkillListing; readonly resources: readonly string[] } | undefined;
  /** The `@elmeragroup/fuse` version the app has installed after the run, if any. */
  readonly fuseVersion: string | undefined;
  /** What the agent did, or `undefined` when the run skipped it or setup failed first. */
  readonly agent: AgentRun | undefined;
  readonly checks: readonly CheckResult[];
};

/** A step before the agent failed, so the cell has no result to check. */
class SetupFailed extends Schema.TaggedError<SetupFailed>()("SetupFailed", { message: Schema.String }) {}

const INSTALL_TIMEOUT = Duration.minutes(5);
const CHECK_TIMEOUT = Duration.minutes(5);
/** The built-in tools both arms get: file edits, a shell and the MCP resource readers. */
const BUILT_IN_TOOLS = [
  "Bash",
  "Read",
  "Edit",
  "Write",
  "Glob",
  "Grep",
  "ListMcpResourcesTool",
  "ReadMcpResourceTool",
];
const FUSE_TOOLS = ["mcp__fuse__search_docs", "mcp__fuse__read_doc"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html"]);
/** Folders that hold no app source: installed packages and build output. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist"]);

/**
 * Runs one cell and writes its `cell.json`. A failure before the agent runs is part of the result,
 * so one broken cell does not stop the run.
 *
 * @param settings - What every cell shares.
 * @param key - The task, the arm and the repeat.
 * @returns What the cell recorded.
 */
export const runCell = Effect.fn("cell.run")(function* (settings: RunSettings, key: CellKey) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { task, arm, repeat } = key;
  yield* Effect.annotateCurrentSpan({ task: task.id, arm, repeat });
  const cellDirectory = path.join(settings.outDirectory, task.id, `${arm}-${String(repeat)}`);
  const appDirectory = path.join(cellDirectory, "app");
  const prompt = promptFor(task, arm);
  const setupFailed = (step: string) => (cause: { readonly message: string }) =>
    new SetupFailed({ message: `${step}: ${cause.message}` });

  const attempt = Effect.gen(function* () {
    yield* fs.makeDirectory(cellDirectory, { recursive: true }).pipe(Effect.mapError(setupFailed("mkdir")));
    yield* fs
      .copy(path.join(settings.fixturesDirectory, task.fixture), appDirectory)
      .pipe(Effect.mapError(setupFailed("copy the fixture")));
    const install = yield* runCommand({
      executable: "pnpm",
      args: ["install"],
      cwd: appDirectory,
      timeout: INSTALL_TIMEOUT,
    }).pipe(Effect.mapError(setupFailed("pnpm install")));
    if (!succeeded(install)) {
      return yield* new SetupFailed({ message: `pnpm install failed:\n${outputTail(install, 20)}` });
    }

    // The baseline's server reads an empty skills folder, so it lists no skill and its
    // instructions name none.
    const skillsDirectory =
      arm === "with-skill" ? settings.skillsDirectory : path.join(cellDirectory, "no-skills");
    if (arm === "baseline") {
      yield* fs
        .makeDirectory(skillsDirectory, { recursive: true })
        .pipe(Effect.mapError(setupFailed("mkdir")));
    }

    return yield* Effect.scoped(
      Effect.gen(function* () {
        const server = yield* startFuseServer({
          bundle: settings.serverBundle,
          catalogFile: settings.catalogFile,
          skillsDirectory,
          commit: settings.commit,
        }).pipe(Effect.mapError(setupFailed("start the Fuse server")));
        const wanted = [task.skill, ...task.handsOverTo].map((skill) => `skill://${skill}/SKILL.md`);
        const listed = server.skills._tag === "listed" ? server.skills.uris : [];
        const skillResources = server.resources.filter((uri) => uri.startsWith("skill://"));
        const contaminated =
          arm === "baseline"
            ? listed.length > 0 || skillResources.length > 0
            : wanted.some((uri) => !listed.includes(uri));
        if (contaminated) {
          return yield* new SetupFailed({
            message: `The ${arm} server serves the wrong skills: ${[...listed, ...skillResources].join(", ") || "none"}`,
          });
        }
        const agent =
          settings.agent === "run"
            ? yield* runAgent(settings, cellDirectory, appDirectory, prompt, server.url)
            : undefined;
        return { server: { skills: server.skills, resources: server.resources }, agent };
      })
    );
  });

  const outcome = yield* attempt.pipe(Effect.result);
  const result: CellResult =
    outcome._tag === "Failure"
      ? {
          task: task.id,
          arm,
          repeat,
          status: { _tag: "setup-failed", message: outcome.failure.message },
          appDirectory,
          prompt,
          server: undefined,
          fuseVersion: undefined,
          agent: undefined,
          checks: [],
        }
      : {
          task: task.id,
          arm,
          repeat,
          status: { _tag: "checked" },
          appDirectory,
          prompt,
          server: outcome.success.server,
          agent: outcome.success.agent,
          ...(yield* checkApp(appDirectory, task)),
        };
  yield* encodeJsonText(result).pipe(
    Effect.flatMap((text) => fs.writeFileString(path.join(cellDirectory, "cell.json"), `${text}\n`)),
    Effect.orDie
  );
  return result;
});

/** Runs the headless agent in the app and keeps its transcript beside the app. */
const runAgent = Effect.fn("cell.runAgent")(function* (
  settings: RunSettings,
  cellDirectory: string,
  appDirectory: string,
  prompt: string,
  serverUrl: URL
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const mcpConfig = path.join(cellDirectory, "mcp.json");
  yield* encodeJsonText({ mcpServers: { fuse: { type: "http", url: serverUrl.href } } }).pipe(
    Effect.flatMap((text) => fs.writeFileString(mcpConfig, text)),
    Effect.orDie
  );
  const run = yield* runCommand({
    executable: "claude",
    args: [
      "-p",
      prompt,
      "--model",
      settings.model,
      "--mcp-config",
      mcpConfig,
      "--strict-mcp-config",
      // Only these built-in tools exist in the session, so it has no web tools and no subagents.
      "--tools",
      ...BUILT_IN_TOOLS,
      "--allowedTools",
      ...BUILT_IN_TOOLS,
      ...FUSE_TOOLS,
      "--permission-mode",
      "acceptEdits",
      // No user or local settings, so the machine's hooks, memory and plugins stay out of the run.
      "--setting-sources",
      "project",
      "--no-session-persistence",
      "--max-budget-usd",
      String(settings.maxBudgetUsd),
      "--output-format",
      "stream-json",
      "--verbose",
    ],
    cwd: appDirectory,
    timeout: settings.agentTimeout,
  }).pipe(Effect.mapError((cause) => new SetupFailed({ message: `claude did not start: ${cause.message}` })));
  yield* fs.writeFileString(path.join(cellDirectory, "transcript.jsonl"), run.stdout).pipe(Effect.orDie);
  yield* fs.writeFileString(path.join(cellDirectory, "agent.stderr.txt"), run.stderr).pipe(Effect.orDie);
  return summarizeStream(run.stdout.split("\n"));
});

/** Every source file of the app outside `node_modules` and `dist`, by its path from the app root. */
const readSources = Effect.fn("cell.readSources")(function* (appDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: SourceFile[] = [];
  const walk = (relative: readonly string[]): Effect.Effect<void> =>
    Effect.gen(function* () {
      const entries = yield* fs
        .readDirectoryEntries(path.join(appDirectory, ...relative))
        .pipe(Effect.orElseSucceed(() => []));
      for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
        if (SKIPPED_FOLDERS.has(entry.name) || entry.name.startsWith(".")) continue;
        const segments = [...relative, entry.name];
        if (entry.type === "Directory") {
          yield* walk(segments);
        } else if (entry.type === "File" && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          const text = yield* fs.readFileString(path.join(appDirectory, ...segments)).pipe(Effect.option);
          if (Option.isSome(text)) files.push({ path: segments.join("/"), text: text.value });
        }
      }
    });
  yield* walk([]);
  return files;
});

const InstalledPackage = Schema.Struct({
  version: Schema.String,
  exports: Schema.Record(Schema.String, Schema.Unknown),
});
const decodeInstalledPackage = Schema.decodeUnknownOption(Schema.fromJsonString(InstalledPackage));

/** Type-checks and builds the app, then decides each check from its files. */
const checkApp = Effect.fn("cell.checkApp")(function* (appDirectory: string, task: Task) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const command = (name: string, args: readonly string[]) =>
    runCommand({ executable: "pnpm", args, cwd: appDirectory, timeout: CHECK_TIMEOUT }).pipe(
      Effect.map((run): CheckResult => ({
        name,
        passed: succeeded(run),
        detail: succeeded(run) ? "exit 0" : outputTail(run, 8),
      })),
      Effect.catchTag("CommandUnstartable", (cause) =>
        Effect.succeed({ name, passed: false, detail: cause.message })
      )
    );
  const typeCheck = yield* command("Type-check passes", ["exec", "tsc", "-b"]);
  // A build the agent left behind must not count.
  yield* fs.remove(path.join(appDirectory, "dist"), { recursive: true, force: true }).pipe(Effect.ignore);
  const build = yield* command("Build passes", ["run", "build"]);
  const html = yield* fs.readFileString(path.join(appDirectory, "dist/index.html")).pipe(Effect.option);

  const packageDirectory = path.join(appDirectory, "node_modules/@elmeragroup/fuse");
  const installed = yield* fs.readFileString(path.join(packageDirectory, "package.json")).pipe(
    Effect.map(decodeInstalledPackage),
    Effect.orElseSucceed(() => decodeInstalledPackage(""))
  );
  const packageRealPath = yield* fs.realPath(packageDirectory).pipe(Effect.option);
  // A `null` target excludes its subpath, as Node resolves package exports.
  const exports = Option.map(
    installed,
    ({ exports: field }): PackageExports =>
      new Map(Object.entries(field).map(([key, target]) => [key, target === null ? "excluded" : "exported"]))
  );

  const sources = yield* readSources(appDirectory);
  const findings = stylesheetFindings(sources);
  const reached = new Set<string>();
  for (const source of findings.sourcePaths) {
    const target = yield* fs
      .realPath(path.resolve(appDirectory, path.dirname(source.file), source.path))
      .pipe(Effect.option);
    if (
      target._tag === "Some" &&
      packageRealPath._tag === "Some" &&
      (target.value === packageRealPath.value ||
        target.value.startsWith(`${packageRealPath.value}${path.sep}`))
    ) {
      reached.add(`${source.file}\n${source.path}`);
    }
  }

  const srcFiles = sources.filter((file) => file.path.startsWith("src/"));
  const checks: CheckResult[] = [
    typeCheck,
    build,
    checkDocument(html._tag === "Some" ? html.value : undefined, task.document),
    checkStylesheetMode(findings, task.stylesheet, (source) => reached.has(`${source.file}\n${source.path}`)),
    checkFuseImports(sources, Option.getOrUndefined(exports)),
    ...task.sourceChecks.map((check) => checkSource(srcFiles, check)),
  ];
  return { fuseVersion: installed._tag === "Some" ? installed.value.version : undefined, checks };
});
