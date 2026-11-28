/**
 * One cell of an eval run: one task, one arm, one repeat. It works in a temporary folder of its
 * own, outside the checkout and away from every other cell: it copies the task's fixture there,
 * installs it from the pass's frozen lockfile, starts a Fuse MCP server for the arm, runs the
 * agent, checks the app, and then copies what the run left into the run's folder.
 */

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";

import { auditStream, classifyAgent, summarizeStream } from "./agent-stream.ts";
import type { AgentRun, ForbiddenPath } from "./agent-stream.ts";
import { checkApp } from "./check-app.ts";
import type { CheckResult } from "./checks.ts";
import { outputTail, runCommand, succeeded } from "./command.ts";
import type { CommandOutcome } from "./command.ts";
import { startFuseServer } from "./fuse-server.ts";
import type { SkillListing } from "./fuse-server.ts";
import type { Environment } from "./isolation.ts";
import { encodeJsonText } from "./json-text.ts";
import { promptFor } from "./task.ts";
import type { Arm, FixtureName, Task } from "./task.ts";

/** The pass's snapshot of what the server reads, which both arms share. */
export type PassInputs = {
  /** The server bundle, copied from `apps/mcp/dist/main.mjs`. */
  readonly serverBundle: string;
  /** The docs catalog the server reads. */
  readonly catalogFile: string;
  /** The skills folder the with-skill arm's server serves. */
  readonly skillsDirectory: string;
  /** Each skill's `SKILL.md` text by its `skill://` URI, which a read must return to count. */
  readonly skills: ReadonlyMap<string, string>;
};

/** A fixture as the pass resolved it once, for every cell to install from. */
export type FrozenFixture = {
  /** The fixture's folder under `fixtures/`. */
  readonly directory: string;
  /** The lockfile the pass's one resolution wrote. */
  readonly lockfile: string;
};

/** What every cell of a pass shares. */
export type RunSettings = {
  readonly inputs: PassInputs;
  readonly fixtures: ReadonlyMap<FixtureName, FrozenFixture>;
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
  /** The environment every program of the cell starts with, scrubbed of the checkout and the run. */
  readonly environment: Environment;
  /** The paths an agent's tool call must not name. */
  readonly forbidden: readonly ForbiddenPath[];
};

/** Which cell. */
export type CellKey = { readonly task: Task; readonly arm: Arm; readonly repeat: number };

/** How far a cell got. */
export type CellStatus =
  | {
      /** The cell could not start: the install, the server, the agent's launch or its Fuse connection failed. */
      readonly _tag: "not-started";
      readonly message: string;
    }
  | {
      /** The run skipped the agent, so the checks read the untouched fixture. */
      readonly _tag: "agent-skipped";
    }
  | {
      /** The agent ran but did not finish: a budget stop, a timeout or an error exit. */
      readonly _tag: "unfinished";
      readonly reason: string;
    }
  | {
      /** The agent finished. */
      readonly _tag: "finished";
    };

/** Whether a cell that ran is a sample of its arm. */
export type CellSample =
  | { readonly _tag: "counted" }
  | {
      /** The cell left the comparison: its agent never received the skill, or reached outside its app. */
      readonly _tag: "set-apart";
      readonly reasons: readonly string[];
    };

/** What one agent run cost. */
export type AgentCost =
  | { readonly _tag: "known"; readonly usd: number }
  | {
      /** The stream has no result line, as after a timeout, so the CLI never reported a cost. */
      readonly _tag: "unknown";
    };

/** The agent's process, its stream and the audit of its tool calls. */
export type AgentRecord = {
  readonly process: CommandOutcome;
  readonly run: AgentRun;
  readonly cost: AgentCost;
  /** The tool calls that reached outside the app, empty for a clean run. */
  readonly audit: readonly string[];
};

/** Everything one cell recorded. */
export type CellResult = {
  readonly task: string;
  readonly arm: Arm;
  readonly repeat: number;
  readonly status: CellStatus;
  readonly sample: CellSample;
  /** The app as the run left it, without `node_modules`, in the run's folder. */
  readonly appDirectory: string;
  readonly prompt: string;
  /** What the arm's server listed, the evidence that the baseline could read no skill. */
  readonly server: { readonly skills: SkillListing; readonly resources: readonly string[] } | undefined;
  /** The `@elmeragroup/fuse` version the app has installed after the run, if any. */
  readonly fuseVersion: string | undefined;
  /** What the agent did, or `undefined` when the run skipped it or the cell stopped first. */
  readonly agent: AgentRecord | undefined;
  readonly checks: readonly CheckResult[];
};

/** A step before the agent's work failed, so the cell has no result to check. */
class CellUnstartable extends Schema.TaggedError<CellUnstartable>()("CellUnstartable", {
  message: Schema.String,
}) {}

/** The cell's record could not be written into the run's folder. */
export class CellRecordFailed extends Schema.TaggedError<CellRecordFailed>()("CellRecordFailed", {
  message: Schema.String,
}) {}

const INSTALL_TIMEOUT = Duration.minutes(5);
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
/**
 * Claude Code's file tools refuse a read outside the working directory with this setting on. Both
 * arms run with it. Its sibling `blockReadsOutsideWorkingDirectories` also covers the shell, but
 * it refuses heredocs, `$?` and chained commands it cannot analyze, which changed how every agent
 * worked; the cell's own folder, the scrubbed environment and the audit cover the shell instead.
 */
const SESSION_SETTINGS = `{"permissions":{"blockFileToolReadsOutsideWorkingDirectories":true}}`;

/** The prefix of every temporary folder a pass makes, which the audit looks for. */
export const TEMPORARY_PREFIX = "fuse-skill-eval-";

/**
 * Runs one cell and writes its folder in the run's folder. A failure before the agent's work is
 * part of the result, so one broken cell does not stop the run.
 *
 * @param settings - What every cell shares.
 * @param key - The task, the arm and the repeat.
 * @returns What the cell recorded, or `CellRecordFailed` when its folder could not be written.
 */
export const runCell = Effect.fn("cell.run")(function* (settings: RunSettings, key: CellKey) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { task, arm, repeat } = key;
  yield* Effect.annotateCurrentSpan({ task: task.id, arm, repeat });
  const recordDirectory = path.join(settings.outDirectory, task.id, `${arm}-${String(repeat)}`);
  const prompt = promptFor(task, arm);
  const unstartable = (step: string) => (cause: { readonly message: string }) =>
    new CellUnstartable({ message: `${step}: ${cause.message}` });
  const recordFailed = (cause: { readonly message: string }) =>
    new CellRecordFailed({ message: `Writing ${recordDirectory} failed: ${cause.message}` });
  yield* fs.makeDirectory(recordDirectory, { recursive: true }).pipe(Effect.mapError(recordFailed));

  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const root = yield* fs
        .makeTempDirectoryScoped({ prefix: `${TEMPORARY_PREFIX}cell-` })
        .pipe(Effect.mapError(unstartable("make the cell's folder")));
      const rootReal = yield* fs.realPath(root).pipe(Effect.mapError(unstartable("make the cell's folder")));
      const appDirectory = path.join(root, "app");
      const attempt = Effect.gen(function* () {
        const fixture = settings.fixtures.get(task.fixture);
        if (fixture === undefined)
          return yield* new CellUnstartable({ message: `no frozen ${task.fixture}` });
        yield* fs
          .copy(fixture.directory, appDirectory)
          .pipe(Effect.mapError(unstartable("copy the fixture")));
        yield* fs
          .copyFile(fixture.lockfile, path.join(appDirectory, "pnpm-lock.yaml"))
          .pipe(Effect.mapError(unstartable("copy the lockfile")));
        const install = yield* runCommand({
          executable: "pnpm",
          args: ["install", "--frozen-lockfile"],
          cwd: appDirectory,
          env: settings.environment,
          timeout: INSTALL_TIMEOUT,
        }).pipe(Effect.mapError(unstartable("pnpm install")));
        if (!succeeded(install)) {
          return yield* new CellUnstartable({ message: `pnpm install failed:\n${outputTail(install, 20)}` });
        }

        // The baseline's server reads an empty skills folder, so it lists no skill and its
        // instructions name none.
        const skillsDirectory =
          arm === "with-skill" ? settings.inputs.skillsDirectory : path.join(root, "no-skills");
        if (arm === "baseline") {
          yield* fs.makeDirectory(skillsDirectory).pipe(Effect.mapError(unstartable("mkdir")));
        }
        const server = yield* startFuseServer({
          bundle: settings.inputs.serverBundle,
          catalogFile: settings.inputs.catalogFile,
          skillsDirectory,
          env: settings.environment,
        }).pipe(Effect.mapError(unstartable("start the Fuse server")));
        const wanted = [task.skill, ...task.handsOverTo].map((skill) => `skill://${skill}/SKILL.md`);
        const listed = server.skills._tag === "listed" ? server.skills.uris : [];
        const skillResources = server.resources.filter((uri) => uri.startsWith("skill://"));
        const wrong =
          arm === "baseline"
            ? server.skills._tag !== "no-extension" || skillResources.length > 0
            : wanted.some((uri) => !listed.includes(uri));
        if (wrong) {
          return yield* new CellUnstartable({
            message: `The ${arm} server serves the wrong skills: ${[...listed, ...skillResources].join(", ") || "none"}`,
          });
        }
        const listing = { skills: server.skills, resources: server.resources };
        if (settings.agent === "skip") return { server: listing, agent: undefined };

        const mcpConfig = path.join(root, "mcp.json");
        yield* encodeJsonText({ mcpServers: { fuse: { type: "http", url: server.url.href } } }).pipe(
          Effect.flatMap((text) => fs.writeFileString(mcpConfig, text)),
          Effect.mapError(unstartable("write the MCP config"))
        );
        const agentRun = yield* runCommand({
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
            "--settings",
            SESSION_SETTINGS,
            "--no-session-persistence",
            "--max-budget-usd",
            String(settings.maxBudgetUsd),
            "--output-format",
            "stream-json",
            "--verbose",
          ],
          cwd: appDirectory,
          env: settings.environment,
          timeout: settings.agentTimeout,
        }).pipe(Effect.mapError(unstartable("claude did not start")));
        yield* fs
          .writeFileString(path.join(recordDirectory, "transcript.jsonl"), agentRun.stdout)
          .pipe(Effect.mapError(recordFailed));
        yield* fs
          .writeFileString(path.join(recordDirectory, "agent.stderr.txt"), agentRun.stderr)
          .pipe(Effect.mapError(recordFailed));
        const lines = agentRun.stdout.split("\n");
        const run = summarizeStream(lines, settings.inputs.skills);
        const audit = auditStream(
          lines,
          [...settings.forbidden, { label: "another cell's folder", path: TEMPORARY_PREFIX }],
          [rootReal, root]
        );
        const agent: AgentRecord = {
          process: agentRun.outcome,
          run,
          cost:
            run.ending._tag === "result" ? { _tag: "known", usd: run.ending.costUsd } : { _tag: "unknown" },
          audit,
        };
        return { server: listing, agent };
      });

      const outcome = yield* attempt.pipe(Effect.result);
      if (outcome._tag === "Failure") {
        if (outcome.failure._tag === "CellRecordFailed") return yield* outcome.failure;
        return {
          task: task.id,
          arm,
          repeat,
          status: { _tag: "not-started", message: outcome.failure.message },
          sample: { _tag: "counted" },
          appDirectory: path.join(recordDirectory, "app"),
          prompt,
          server: undefined,
          fuseVersion: undefined,
          agent: undefined,
          checks: [],
        } satisfies CellResult;
      }
      const { server, agent } = outcome.success;
      const verdict = agent === undefined ? undefined : classifyAgent(agent.process, agent.run);
      const status: CellStatus =
        verdict === undefined
          ? { _tag: "agent-skipped" }
          : verdict._tag === "not-started"
            ? { _tag: "not-started", message: verdict.reason }
            : verdict._tag === "unfinished"
              ? { _tag: "unfinished", reason: verdict.reason }
              : { _tag: "finished" };
      const reasons = [
        ...(agent?.audit ?? []),
        ...(arm === "with-skill" &&
        agent !== undefined &&
        !agent.run.skillReads.some((read) => read.received && read.uri === `skill://${task.skill}/SKILL.md`)
          ? [`the agent never received skill://${task.skill}/SKILL.md`]
          : []),
      ];
      const checked =
        status._tag === "not-started"
          ? { fuseVersion: undefined, checks: [] }
          : yield* checkApp(appDirectory, task, settings.environment);
      yield* copyApp(appDirectory, path.join(recordDirectory, "app")).pipe(Effect.mapError(recordFailed));
      return {
        task: task.id,
        arm,
        repeat,
        status,
        sample: reasons.length === 0 ? { _tag: "counted" } : { _tag: "set-apart", reasons },
        appDirectory: path.join(recordDirectory, "app"),
        prompt,
        server,
        agent,
        ...checked,
      } satisfies CellResult;
    })
  );
  yield* encodeJsonText(result).pipe(
    Effect.flatMap((text) => fs.writeFileString(path.join(recordDirectory, "cell.json"), `${text}\n`)),
    Effect.mapError(recordFailed)
  );
  return result;
});

/** Copies an app into the run's folder, without its installed packages. */
const copyApp = Effect.fn("cell.copyApp")(function* (from: string, to: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const walk = (relative: readonly string[]): Effect.Effect<void, PlatformError.PlatformError> =>
    Effect.gen(function* () {
      yield* fs.makeDirectory(path.join(to, ...relative), { recursive: true });
      for (const entry of yield* fs.readDirectoryEntries(path.join(from, ...relative))) {
        if (entry.name === "node_modules") continue;
        const segments = [...relative, entry.name];
        if (entry.type === "Directory") yield* walk(segments);
        else if (entry.type === "File")
          yield* fs.copyFile(path.join(from, ...segments), path.join(to, ...segments));
      }
    });
  yield* walk([]);
});
