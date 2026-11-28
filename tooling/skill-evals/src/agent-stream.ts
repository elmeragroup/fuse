/**
 * Reads what a headless agent did from the lines `claude -p --output-format stream-json --verbose`
 * prints: its session setup, every tool call and the closing result with turns, cost and duration.
 */

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

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
  input: Schema.Unknown,
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
const decodeToolUse = Schema.decodeUnknownOption(ToolUse);
const decodeResult = Schema.decodeUnknownOption(ResultLine);

/** How the run ended. */
export type AgentEnding =
  | {
      /** The CLI printed its result line. */
      readonly _tag: "finished";
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
      readonly _tag: "cut-off";
    };

/** What one headless agent run did. */
export type AgentRun = {
  /** The model the session reported, or `undefined` when the stream has no setup line. */
  readonly model: string | undefined;
  /** The tools the session offered. */
  readonly tools: readonly string[];
  /** Each MCP server's connection status at setup, by name. */
  readonly mcpServers: Readonly<Record<string, string>>;
  /** Tool calls by tool name, in name order. */
  readonly toolCalls: Readonly<Record<string, number>>;
  /** Every `skill://` URI the agent read or tried to read, in call order. */
  readonly skillReads: readonly string[];
  readonly ending: AgentEnding;
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

/**
 * Summarizes a stream. A line that is not JSON, or of a type the summary does not read, is
 * skipped, so a stream cut off mid-line still summarizes.
 *
 * @param lines - The lines the CLI printed on stdout.
 * @returns What the run did.
 */
export function summarizeStream(lines: readonly string[]): AgentRun {
  let init: typeof InitLine.Type | undefined;
  let result: typeof ResultLine.Type | undefined;
  const calls = new Map<string, typeof ToolUse.Type>();
  for (const line of lines) {
    const json = decodeJson(line);
    if (Option.isNone(json)) continue;
    const value = json.value;
    init ??= Option.getOrUndefined(decodeInit(value));
    result = Option.getOrUndefined(decodeResult(value)) ?? result;
    const assistant = decodeAssistant(value);
    if (Option.isNone(assistant)) continue;
    for (const block of assistant.value.message.content) {
      const call = decodeToolUse(block);
      if (Option.isSome(call)) calls.set(call.value.id, call.value);
    }
  }
  const toolCalls: Record<string, number> = {};
  for (const name of [...calls.values()]
    .map((call) => call.name)
    .sort((left, right) => left.localeCompare(right))) {
    toolCalls[name] = (toolCalls[name] ?? 0) + 1;
  }
  return {
    model: init?.model,
    tools: init?.tools ?? [],
    mcpServers: Object.fromEntries((init?.mcp_servers ?? []).map((server) => [server.name, server.status])),
    toolCalls,
    skillReads: [...calls.values()].flatMap(skillUris),
    ending:
      result === undefined
        ? { _tag: "cut-off" }
        : {
            _tag: "finished",
            subtype: result.subtype,
            isError: result.is_error,
            turns: result.num_turns,
            durationMs: result.duration_ms,
            costUsd: result.total_cost_usd,
            finalMessage: result.result ?? "",
          },
  };
}
