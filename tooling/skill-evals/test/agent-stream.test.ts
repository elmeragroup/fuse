import * as Duration from "effect/Duration";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { auditStream, classifyAgent, summarizeStream } from "../src/agent-stream.ts";
import type { AgentRun } from "../src/agent-stream.ts";

// Unit under test: the summary, the audit and the verdict of a headless run. Oracles: two streams
// that `claude -p --output-format stream-json --verbose` (Claude Code 2.1.332) printed, trimmed,
// with their tool calls and numbers counted by hand. `stream.jsonl` is a with-skill run of
// build-ui-toggle-group. `skill-read.jsonl` reads a skill, then reaches for `/checkout/AGENTS.md`
// through Bash and Read; the skill's text in it is cut to SKILL below.
const lines = (name: string) =>
  readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8").split("\n");
const toggleRun = lines("stream.jsonl");
const skillRun = lines("skill-read.jsonl");
const SKILL_URI = "skill://fuse-build-ui/SKILL.md";
const SKILL = "---\nname: fuse-build-ui\n---\n\n# Building UI with Fuse\n";

describe("summarizeStream", () => {
  it("counts each tool call and keeps the result's numbers", () => {
    const run = summarizeStream(toggleRun, new Map());
    expect(run.model).toBe("claude-sonnet-5-5");
    expect(run.mcpServers).toEqual({ fuse: "connected" });
    expect(run.toolCalls).toEqual({
      Bash: 2,
      ReadMcpResourceTool: 1,
      mcp__fuse__read_doc: 1,
      mcp__fuse__search_docs: 2,
    });
    expect(run.ending).toEqual({
      _tag: "result",
      subtype: "success",
      isError: false,
      turns: 7,
      durationMs: 17193,
      costUsd: 0.07198630000000002,
      finalMessage: "The Notification settings screen is in `src/App.tsx`, and the type-check (`tsc -",
    });
  });

  it("summarizes a stream the runner cut off mid-line, without a result", () => {
    const withoutResult = toggleRun.filter((line) => !line.includes('"type":"result"'));
    const cut = [...withoutResult.slice(0, 4), (withoutResult[4] ?? "").slice(0, 40)];
    const run = summarizeStream(cut, new Map());
    expect(run.ending).toEqual({ _tag: "no-result" });
    expect(run.toolCalls).toEqual({ ReadMcpResourceTool: 1, mcp__fuse__search_docs: 1 });
  });

  it.each([
    { case: "a read that returned the served text", served: SKILL, stream: skillRun, received: true },
    { case: "a read that returned other text", served: `${SKILL}More.\n`, stream: skillRun, received: false },
    {
      case: "a read whose result is an error",
      served: SKILL,
      stream: skillRun.map((line) =>
        line.includes('"type":"user"') && line.includes("contents")
          ? line.replace('"type":"tool_result",', '"type":"tool_result","is_error":true,')
          : line
      ),
      received: false,
    },
    {
      case: "a read with no result",
      served: SKILL,
      stream: skillRun.filter((line) => !line.includes("contents")),
      received: false,
    },
  ])("$case", ({ served, stream, received }) => {
    expect(summarizeStream(stream, new Map([[SKILL_URI, served]])).skillReads).toEqual([
      { uri: SKILL_URI, received },
    ]);
  });
});

describe("auditStream", () => {
  it("names each call that reaches a forbidden path", () => {
    expect(auditStream(skillRun, [{ label: "the checkout", path: "/checkout" }], [])).toEqual([
      "Bash names the checkout",
      "Read names the checkout",
    ]);
  });

  it("names a SKILL.md read through the shell, and not one read as a skill:// resource", () => {
    const shellRead = skillRun.map((line) =>
      line.replace("head -1 /checkout/AGENTS.md", "cat ../skills/fuse-build-ui/SKILL.md")
    );
    expect(auditStream(shellRead, [], [])).toEqual(["Bash names a SKILL.md outside a skill:// read"]);
  });
});

describe("classifyAgent", () => {
  const summary = (overrides: Partial<AgentRun>): AgentRun => ({
    ...summarizeStream(toggleRun, new Map()),
    ...overrides,
  });
  const success = summary({});

  it.each([
    {
      case: "exit 0 after a successful result",
      process: { _tag: "exited", exitCode: 0 } as const,
      run: success,
      verdict: "finished",
    },
    {
      case: "exit 70 after a successful result",
      process: { _tag: "exited", exitCode: 70 } as const,
      run: success,
      verdict: "unfinished",
    },
    {
      case: "a budget stop",
      process: { _tag: "exited", exitCode: 1 } as const,
      run: summary({
        ending: {
          ...success.ending,
          _tag: "result",
          subtype: "error_max_budget_usd",
          isError: true,
          turns: 3,
          durationMs: 1,
          costUsd: 2,
          finalMessage: "",
        },
      }),
      verdict: "unfinished",
    },
    {
      case: "a timeout",
      process: { _tag: "timed-out", after: Duration.minutes(20) } as const,
      run: summary({ ending: { _tag: "no-result" } }),
      verdict: "unfinished",
    },
    {
      case: "a Fuse server that failed to connect",
      process: { _tag: "exited", exitCode: 0 } as const,
      run: summary({ mcpServers: { fuse: "failed" } }),
      verdict: "not-started",
    },
    {
      case: "a session that never started",
      process: { _tag: "exited", exitCode: 1 } as const,
      run: summarizeStream([], new Map()),
      verdict: "not-started",
    },
  ])("$case", ({ process, run, verdict }) => {
    expect(classifyAgent(process, run)._tag).toBe(verdict);
  });
});
