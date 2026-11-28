/**
 * Reads what a headless agent did from the lines `claude -p --output-format stream-json --verbose`
 * prints: its session setup, every tool call and the closing result with turns, cost and duration.
 */

import * as Duration from "effect/Duration";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import type { CommandOutcome } from "./command.ts";

/** The session setup line, the first the CLI prints. */
const InitLine = Schema.Struct({
  type: Schema.Literal("system"),
  subtype: Schema.Literal("init"),
  model: Schema.String,
  tools: Schema.Array(Schema.String),
  mcp_servers: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.String })),
});

const ToolUse = Schema.Struct({
  type: Schema.Literal("tool_use"),
  id: Schema.String,
  name: Schema.String,
  input: Schema.Record(Schema.String, Schema.Unknown),
});

/**
 * The inputs that can name a skill: `ReadMcpResourceTool`'s `uri` and `read_doc`'s `hrefs`. Other
 * tools' inputs decode to neither.
 */
const SkillReadInput = Schema.Struct({
  uri: Schema.optional(Schema.String),
  hrefs: Schema.optional(Schema.Array(Schema.String)),
});
const decodeSkillReadInput = Schema.decodeUnknownOption(SkillReadInput);

/** An assistant line. One message can span several lines, each with some of its content blocks. */
const AssistantLine = Schema.Struct({
  type: Schema.Literal("assistant"),
  message: Schema.Struct({ content: Schema.Array(Schema.Unknown) }),
});

/** A user line, which carries the tool results. */
const UserLine = Schema.Struct({
  type: Schema.Literal("user"),
  message: Schema.Struct({ content: Schema.Union([Schema.String, Schema.Array(Schema.Unknown)]) }),
});

const ToolResult = Schema.Struct({
  type: Schema.Literal("tool_result"),
  tool_use_id: Schema.String,
  is_error: Schema.optional(Schema.Union([Schema.Boolean, Schema.Null])),
  content: Schema.optional(
    Schema.Union([
      Schema.String,
      Schema.Array(Schema.Struct({ type: Schema.String, text: Schema.optional(Schema.String) })),
    ])
  ),
});

/** What `ReadMcpResourceTool` answers: the resource's contents, as JSON text. */
const ResourceContents = Schema.fromJsonString(
  Schema.Struct({
    contents: Schema.Array(Schema.Struct({ uri: Schema.String, text: Schema.optional(Schema.String) })),
  })
);

/** The closing line. */
const ResultLine = Schema.Struct({
  type: Schema.Literal("result"),
  subtype: Schema.String,
  is_error: Schema.Boolean,
  num_turns: Schema.Finite,
  duration_ms: Schema.Finite,
  total_cost_usd: Schema.Finite,
  result: Schema.optional(Schema.String),
});

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));
const decodeInit = Schema.decodeUnknownOption(InitLine);
const decodeAssistant = Schema.decodeUnknownOption(AssistantLine);
const decodeUser = Schema.decodeUnknownOption(UserLine);
const decodeToolUse = Schema.decodeUnknownOption(ToolUse);
const decodeToolResult = Schema.decodeUnknownOption(ToolResult);
const decodeResourceContents = Schema.decodeUnknownOption(ResourceContents);
const decodeResult = Schema.decodeUnknownOption(ResultLine);

/** How the stream ended. */
export type StreamEnding =
  | {
      /** The CLI printed its result line. */
      readonly _tag: "result";
      /** The result's subtype, such as `success` or `error_max_budget_usd`. */
      readonly subtype: string;
      readonly isError: boolean;
      readonly turns: number;
      readonly durationMs: number;
      readonly costUsd: number;
      /** The agent's last message. */
      readonly finalMessage: string;
    }
  | {
      /** The stream stopped before a result line, as when the runner's timeout stopped the agent. */
      readonly _tag: "no-result";
    };

/** One attempt to read a skill, and whether the agent got the skill's text back. */
export type SkillRead = { readonly uri: string; readonly received: boolean };

/** What one headless agent run did, from its stream. */
export type AgentRun = {
  /** The model the session reported, or `undefined` when the stream has no setup line. */
  readonly model: string | undefined;
  /** Whether the stream has its setup line, which the CLI prints once the session starts. */
  readonly started: boolean;
  /** The tools the session offered. */
  readonly tools: readonly string[];
  /** Each MCP server's connection status at setup, by name. */
  readonly mcpServers: Readonly<Record<string, string>>;
  /** Tool calls by tool name, in name order. */
  readonly toolCalls: Readonly<Record<string, number>>;
  /** Every `skill://` URI the agent read or tried to read, in call order. */
  readonly skillReads: readonly SkillRead[];
  readonly ending: StreamEnding;
};

/** The `skill://` URIs a tool call names, whatever tool it calls. */
function skillUris(call: typeof ToolUse.Type): readonly string[] {
  const input = decodeSkillReadInput(call.input);
  if (Option.isNone(input)) return [];
  const { uri, hrefs } = input.value;
  return [...(uri === undefined ? [] : [uri]), ...(hrefs ?? [])].filter((value) =>
    value.startsWith("skill://")
  );
}

/** A tool result's text, whether the CLI wrote it as a string or as text blocks. */
function resultText(result: typeof ToolResult.Type): string {
  const content = result.content;
  if (content === undefined) return "";
  return Predicate.isString(content) ? content : content.map((block) => block.text ?? "").join("");
}

/**
 * Whether a tool result carries a skill's text: the resource contents `ReadMcpResourceTool`
 * answers with that URI and exactly that text, or any other answer that holds the whole text.
 */
function carriesSkill(
  result: typeof ToolResult.Type | undefined,
  uri: string,
  skill: string | undefined
): boolean {
  if (result === undefined || result.is_error === true || skill === undefined) return false;
  const text = resultText(result);
  const contents = decodeResourceContents(text);
  if (Option.isSome(contents)) {
    return contents.value.contents.some((entry) => entry.uri === uri && entry.text === skill);
  }
  return text.includes(skill);
}

/** The parts of a stream the summary and the audit read. */
function readStream(lines: readonly string[]) {
  let init: typeof InitLine.Type | undefined;
  let result: typeof ResultLine.Type | undefined;
  const calls = new Map<string, typeof ToolUse.Type>();
  const results = new Map<string, typeof ToolResult.Type>();
  for (const line of lines) {
    const json = decodeJson(line);
    if (Option.isNone(json)) continue;
    const value = json.value;
    init ??= Option.getOrUndefined(decodeInit(value));
    result = Option.getOrUndefined(decodeResult(value)) ?? result;
    const assistant = decodeAssistant(value);
    if (Option.isSome(assistant)) {
      for (const block of assistant.value.message.content) {
        const call = decodeToolUse(block);
        if (Option.isSome(call)) calls.set(call.value.id, call.value);
      }
    }
    const user = decodeUser(value);
    if (Option.isSome(user) && !Predicate.isString(user.value.message.content)) {
      for (const block of user.value.message.content) {
        const toolResult = decodeToolResult(block);
        if (Option.isSome(toolResult)) results.set(toolResult.value.tool_use_id, toolResult.value);
      }
    }
  }
  return { init, result, calls, results };
}

/**
 * Summarizes a stream. A line that is not JSON, or of a type the summary does not read, is
 * skipped, so a stream cut off mid-line still summarizes.
 *
 * @param lines - The lines the CLI printed on stdout.
 * @param skills - The text the server serves for each skill URI, which a read must return to count
 *   as received.
 * @returns What the run did.
 */
export function summarizeStream(lines: readonly string[], skills: ReadonlyMap<string, string>): AgentRun {
  const { init, result, calls, results } = readStream(lines);
  const toolCalls: Record<string, number> = {};
  for (const name of [...calls.values()]
    .map((call) => call.name)
    .sort((left, right) => left.localeCompare(right))) {
    toolCalls[name] = (toolCalls[name] ?? 0) + 1;
  }
  return {
    model: init?.model,
    started: init !== undefined,
    tools: init?.tools ?? [],
    mcpServers: Object.fromEntries((init?.mcp_servers ?? []).map((server) => [server.name, server.status])),
    toolCalls,
    skillReads: [...calls.values()].flatMap((call) =>
      skillUris(call).map((uri) => ({
        uri,
        received: carriesSkill(results.get(call.id), uri, skills.get(uri)),
      }))
    ),
    ending:
      result === undefined
        ? { _tag: "no-result" }
        : {
            _tag: "result",
            subtype: result.subtype,
            isError: result.is_error,
            turns: result.num_turns,
            durationMs: result.duration_ms,
            costUsd: result.total_cost_usd,
            finalMessage: result.result ?? "",
          },
  };
}

/** A path the agent has no reason to name, with what it is for the report. */
export type ForbiddenPath = { readonly label: string; readonly path: string };

const SKILL_URI = /skill:\/\/[^\s"'`]*?SKILL\.md/gu;

/**
 * The tool calls that reached outside the agent's own app: an input that names a forbidden path,
 * or that names a `SKILL.md` other than through a `skill://` URI.
 *
 * @param lines - The lines the CLI printed on stdout.
 * @param forbidden - The checkout, the run's folder, the other cells' folders and the like.
 * @param own - The cell's own folder, as written and canonical, which the agent may name and which
 *   a forbidden prefix may match.
 * @returns One line per offending call, empty when the agent stayed in its folder.
 */
export function auditStream(
  lines: readonly string[],
  forbidden: readonly ForbiddenPath[],
  own: readonly string[]
): readonly string[] {
  const { calls } = readStream(lines);
  return [...calls.values()].flatMap((call) => {
    const input = own.reduce((text, folder) => text.replaceAll(folder, ""), JSON.stringify(call.input));
    const named = [
      ...new Set(forbidden.filter((entry) => input.includes(entry.path)).map((entry) => entry.label)),
    ];
    if (/SKILL\.md/iu.test(input.replace(SKILL_URI, ""))) named.push("a SKILL.md outside a skill:// read");
    return named.length === 0 ? [] : [`${call.name} names ${named.join(" and ")}`];
  });
}

/** How an agent run went, which decides whether its cell is a sample. */
export type AgentVerdict =
  | {
      /** The session never had the Fuse server, so the run measured nothing. */
      readonly _tag: "not-started";
      readonly reason: string;
    }
  | {
      /** The agent ran but stopped before it finished: a budget stop, a timeout or an error. */
      readonly _tag: "unfinished";
      readonly reason: string;
    }
  | {
      /** The agent finished: the CLI exited 0 after a successful result. */
      readonly _tag: "finished";
    };

/**
 * Decides how an agent run went from the process's end and the stream's.
 *
 * @param process - How the `claude` process ended.
 * @param run - The stream's summary.
 * @returns `not-started` when the session has no setup line or no connected Fuse server,
 *   `unfinished` for a timeout, an error exit or a result that is not a success, and `finished`
 *   otherwise.
 */
export function classifyAgent(process: CommandOutcome, run: AgentRun): AgentVerdict {
  if (!run.started) {
    return {
      _tag: "not-started",
      reason:
        process._tag === "exited"
          ? `the session did not start, and claude exited with code ${String(process.exitCode)}`
          : "the session did not start before the timeout",
    };
  }
  const fuse = run.mcpServers.fuse;
  if (fuse !== "connected") {
    return { _tag: "not-started", reason: `the Fuse server was ${fuse ?? "missing"} in the session` };
  }
  if (process._tag === "timed-out") {
    return { _tag: "unfinished", reason: `stopped at the ${Duration.format(process.after)} timeout` };
  }
  if (run.ending._tag === "no-result")
    return { _tag: "unfinished", reason: "the stream ended without a result" };
  if (run.ending.subtype !== "success" || run.ending.isError) {
    return { _tag: "unfinished", reason: `the result is ${run.ending.subtype}` };
  }
  if (process.exitCode !== 0) {
    return {
      _tag: "unfinished",
      reason: `claude exited with code ${String(process.exitCode)} after its result`,
    };
  }
  return { _tag: "finished" };
}
