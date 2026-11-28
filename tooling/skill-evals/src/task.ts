/**
 * The eval tasks, as `tasks.json` holds them, and the prompt each arm of a task sends. A task is
 * data, so adding one touches no code.
 */

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

/** The name of a skill the Fuse MCP server ships, which is its folder in `apps/mcp/skills`. */
const SkillName = Schema.Literals(["fuse-setup", "fuse-build-ui", "fuse-theming"]);

/** A skill the Fuse MCP server ships. */
export type SkillName = typeof SkillName.Type;

/** The fixture app a task starts from, a folder under `fixtures/`. */
const FixtureName = Schema.Literals(["vite-plain", "vite-tailwind", "vite-tailwind-fuse"]);

/** The theme and density the built `<html>` start tag must carry. */
const ExpectedDocument = Schema.Struct({
  identity: Schema.Literals(["branded", "neutral"]),
  brand: Schema.Literals(["fkas", "tkas", "guen", "fkab", "fkse", "elma", "ngfi"]),
  segment: Schema.Literals(["private", "company"]),
  density: Schema.Literals(["dense", "comfortable"]),
});

/** The theme and density the built `<html>` start tag must carry. */
export type ExpectedDocument = typeof ExpectedDocument.Type;

/** How the app must load Fuse's CSS: Fuse's Tailwind source, or the prebuilt standalone sheet. */
const StylesheetMode = Schema.Literals(["tailwind", "standalone"]);

/** How the app must load Fuse's CSS. */
export type StylesheetMode = typeof StylesheetMode.Type;

/** A regular expression that one of the app's `src` files must match, or that none may match. */
const SourceCheck = Schema.Struct({
  /** What the check shows when it passes, as the report names it. */
  name: Schema.NonEmptyString,
  /** The pattern, as `new RegExp` reads it with the `u` flag. */
  pattern: Schema.NonEmptyString,
  /** `match` passes when a file matches; `no-match` passes when none does. */
  expect: Schema.Literals(["match", "no-match"]),
});

/** A regular expression that one of the app's `src` files must match, or that none may match. */
export type SourceCheck = typeof SourceCheck.Type;

/** The id a task goes by on the command line and in the report. */
const TaskId = Schema.NonEmptyString.check(Schema.isPattern(/^[a-z0-9-]+$/u));

/** One eval task. */
const Task = Schema.Struct({
  id: TaskId,
  /** The skill under test. The with-skill arm reads it first. */
  skill: SkillName,
  /** Skills the first one hands over to, which the with-skill arm reads when it refers to them. */
  handsOverTo: Schema.Array(SkillName),
  fixture: FixtureName,
  /** The request, as a user would make it. Both arms send it unchanged. */
  prompt: Schema.NonEmptyString,
  document: ExpectedDocument,
  stylesheet: StylesheetMode,
  sourceChecks: Schema.Array(SourceCheck),
  /** What a reviewer checks by reading the result, beyond what the script decides. */
  expectations: Schema.Array(Schema.NonEmptyString),
});

/** One eval task. */
export type Task = typeof Task.Type;

const TaskFile = Schema.Struct({ tasks: Schema.NonEmptyArray(Task) });

/** The task file could not be read, or it does not hold valid tasks. */
export class TaskFileInvalid extends Schema.TaggedError<TaskFileInvalid>()("TaskFileInvalid", {
  message: Schema.String,
  path: Schema.String,
}) {}

/**
 * Reads the tasks from a task file.
 *
 * @param path - The task file, such as `tasks.json`.
 * @returns The tasks in file order, or `TaskFileInvalid` when the file is unreadable, a task breaks
 *   the schema, two tasks share an id or a source check pattern is not a regular expression.
 */
export const loadTasks = Effect.fn("task.loadTasks")(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const invalid = (detail: string) =>
    new TaskFileInvalid({ message: `The task file ${path} is invalid: ${detail}`, path });
  const text = yield* fs.readFileString(path).pipe(Effect.mapError((cause) => invalid(cause.message)));
  const { tasks } = yield* Schema.decodeEffect(Schema.fromJsonString(TaskFile))(text).pipe(
    Effect.mapError((cause) => invalid(cause.message))
  );
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) return yield* invalid(`two tasks have the id ${task.id}`);
    seen.add(task.id);
    for (const check of task.sourceChecks) {
      const compiled = compilePattern(check.pattern);
      if (compiled._tag === "invalid") {
        return yield* invalid(
          `${task.id}'s check "${check.name}" has an invalid pattern: ${compiled.reason}`
        );
      }
    }
  }
  return tasks;
});

/** The outcome of compiling a source check's pattern. */
type CompiledPattern =
  | { readonly _tag: "compiled"; readonly regex: RegExp }
  | { readonly _tag: "invalid"; readonly reason: string };

/**
 * Compiles a source check's pattern with the `u` flag.
 *
 * @param pattern - The pattern from the task file.
 * @returns The regular expression, or why it does not compile.
 */
export function compilePattern(pattern: string): CompiledPattern {
  try {
    return { _tag: "compiled", regex: new RegExp(pattern, "u") };
  } catch (cause) {
    return { _tag: "invalid", reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** One arm of a task: the agent reads the skill first, or the server serves no skill at all. */
export type Arm = "with-skill" | "baseline";

/** Both arms, in report order. */
export const ARMS: readonly Arm[] = ["with-skill", "baseline"];

/** What both arms say about the tools, after the task's request. */
const SHARED_RULES = [
  "Do not use the web. Use only the fuse server's tools for facts about Fuse, and read Fuse's files under node_modules only when the docs and the installed package disagree.",
  "Nobody will answer questions during this task, so make each choice yourself.",
].join(" ");

/**
 * The prompt an arm sends. Both arms send the task's request and the same rules. The with-skill arm
 * also tells the agent to read the skill as an MCP resource first, because a headless run loads no
 * skills; the baseline's server serves none, and its prompt names none.
 *
 * @param task - The task.
 * @param arm - The arm.
 * @returns The prompt text.
 */
export function promptFor(task: Task, arm: Arm): string {
  const server =
    arm === "with-skill"
      ? [
          `You have an MCP server named fuse. First read the resource skill://${task.skill}/SKILL.md from that server and follow it step by step.`,
          ...task.handsOverTo.map(
            (skill) =>
              `When it refers to the ${skill} skill, read skill://${skill}/SKILL.md and follow that too.`
          ),
        ].join(" ")
      : "You have an MCP server named fuse.";
  return `${task.prompt}\n\n${server} ${SHARED_RULES}`;
}
