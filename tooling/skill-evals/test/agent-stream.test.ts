import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { summarizeStream } from "../src/agent-stream.ts";

// Unit under test: the summary of a headless run. Oracle: a stream that `claude -p
// --output-format stream-json --verbose` (Claude Code 2.1.332) printed for a with-skill run of
// build-ui-toggle-group, trimmed of thinking blocks and long text, and the tool calls a reader
// counts in it: one skill read, two searches, one read_doc and two shell commands.
const lines = readFileSync(new URL("fixtures/stream.jsonl", import.meta.url), "utf8").split("\n");

describe("summarizeStream", () => {
  it("counts each tool call and the skill the agent read, and keeps the result's numbers", () => {
    const run = summarizeStream(lines);
    expect(run.model).toBe("claude-sonnet-5-5");
    expect(run.mcpServers).toEqual({ fuse: "connected" });
    expect(run.toolCalls).toEqual({
      Bash: 2,
      ReadMcpResourceTool: 1,
      mcp__fuse__read_doc: 1,
      mcp__fuse__search_docs: 2,
    });
    expect(run.skillReads).toEqual(["skill://fuse-build-ui/SKILL.md"]);
    expect(run.ending).toMatchObject({ _tag: "finished", subtype: "success", isError: false, turns: 7 });
  });

  it("summarizes a stream the runner cut off mid-line, without a result", () => {
    const withoutResult = lines.filter((line) => !line.includes('"type":"result"'));
    const cut = [...withoutResult.slice(0, 4), (withoutResult[4] ?? "").slice(0, 40)];
    const run = summarizeStream(cut);
    expect(run.ending).toEqual({ _tag: "cut-off" });
    expect(run.toolCalls).toEqual({ ReadMcpResourceTool: 1, mcp__fuse__search_docs: 1 });
  });
});
