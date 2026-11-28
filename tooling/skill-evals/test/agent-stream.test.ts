import * as Duration from "effect/Duration";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { auditStream, classifyAgent, summarizeStream } from "../src/agent-stream.ts";
import type { AgentRun } from "../src/agent-stream.ts";

// Unit under test: the summary, the audit and the verdict of a headless run. Oracles: two streams
// that `claude -p --output-format stream-json --verbose` (Claude Code 2.1.332) printed, trimmed,
// with their tool calls and numbers counted by hand. `stream.jsonl` is a with-skill run of
// build-ui-toggle-group. `skill-read.jsonl` reads a skill, then reaches for `/checkout/AGENTS.md`
// through Bash and Read; the skill's text in it is cut to SKILL below. The audit's oracle is the
// rule that a path inside the cell's folder is the agent's own, whatever its name.
const lines = (name: string) =>
  readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8").split("\n");
const toggleRun = lines("stream.jsonl");
const skillRun = lines("skill-read.jsonl");
const SKILL_URI = "skill://fuse-build-ui/SKILL.md";
const SKILL = "---\nname: fuse-build-ui\n---\n\n# Building UI with Fuse\n";
const NOWHERE = { folders: [], cwd: "/app" };

/** A stream line that calls a tool, as the CLI prints one. */
const call = (id: string, name: string, input: Readonly<Record<string, string>>) =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });

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
    {
      case: "a read that returned the served text",
      served: SKILL,
      stream: skillRun,
      received: true,
      answered: true,
    },
    {
      case: "a read that returned other text",
      served: `${SKILL}More.\n`,
      stream: skillRun,
      received: false,
      answered: true,
    },
    {
      case: "a read whose result is an error",
      served: SKILL,
      stream: skillRun.map((line) =>
        line.includes('"type":"user"') && line.includes("contents")
          ? line.replace('"type":"tool_result",', '"type":"tool_result","is_error":true,')
          : line
      ),
      received: false,
      answered: true,
    },
    {
      case: "a read with no result",
      served: SKILL,
      stream: skillRun.filter((line) => !line.includes("contents")),
      received: false,
      answered: false,
    },
  ])("$case", ({ served, stream, received, answered }) => {
    expect(summarizeStream(stream, new Map([[SKILL_URI, served]])).skillReads).toEqual([
      { uri: SKILL_URI, received, beforeFirstEdit: answered },
    ]);
  });

  it.each([
    { case: "an edit after the skill's text came back", at: 3, beforeFirstEdit: true },
    { case: "an edit before the skill's text came back", at: 2, beforeFirstEdit: false },
    { case: "an edit before the skill was asked for", at: 1, beforeFirstEdit: false },
  ])("$case", ({ at, beforeFirstEdit }) => {
    const edit = call("edit", "Write", { file_path: "/app/src/App.tsx", content: "" });
    const stream = [...skillRun.slice(0, at), edit, ...skillRun.slice(at)];
    expect(summarizeStream(stream, new Map([[SKILL_URI, SKILL]])).skillReads).toEqual([
      { uri: SKILL_URI, received: true, beforeFirstEdit },
    ]);
  });
});

describe("auditStream", () => {
  it("names each call that reaches a forbidden path", () => {
    expect(auditStream(skillRun, [{ label: "the checkout", path: "/checkout" }], NOWHERE)).toEqual([
      "Bash names the checkout",
      "Read names the checkout",
    ]);
  });

  it("names a SKILL.md read through the shell, and not one read as a skill:// resource", () => {
    const shellRead = skillRun.map((line) =>
      line.replace("head -1 /checkout/AGENTS.md", "cat ../skills/fuse-build-ui/SKILL.md")
    );
    expect(auditStream(shellRead, [], NOWHERE)).toEqual(["Bash names a SKILL.md outside a skill:// read"]);
  });

  it("passes a file in the cell's own app whose name looks like another cell's, and names one in a sibling cell", () => {
    const own = { folders: ["/tmp/fuse-skill-eval-cell-A"], cwd: "/tmp/fuse-skill-eval-cell-A/app" };
    const otherCells = [{ label: "another cell's folder", path: "/tmp/fuse-skill-eval-" }];
    const stream = [
      call("1", "Write", { file_path: "src/fuse-skill-eval-preview.tsx", content: "export {};" }),
      call("2", "Read", { file_path: "/tmp/fuse-skill-eval-cell-A/app/src/fuse-skill-eval-preview.tsx" }),
      call("3", "Edit", { file_path: "src/App.tsx", new_string: `import "./fuse-skill-eval-preview";` }),
      call("4", "Bash", { command: "cat src/fuse-skill-eval-preview.tsx" }),
      call("5", "Read", { file_path: "/tmp/fuse-skill-eval-cell-B/app/src/App.tsx" }),
      call("6", "Read", { file_path: "../../fuse-skill-eval-cell-B/app/src/App.tsx" }),
    ];
    expect(auditStream(stream, otherCells, own)).toEqual([
      "Read names another cell's folder",
      "Read names another cell's folder",
    ]);
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
