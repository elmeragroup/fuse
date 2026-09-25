import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { staleCacheFiles, summarizedHashes } from "../scripts/prune-turbo-cache.ts";

describe("turbo cache pruning", () => {
  it("removes every file of an entry the run did not use and keeps the used ones", () => {
    const files = [
      "4c0f8df7825fb4da.tar.zst",
      "4c0f8df7825fb4da-meta.json",
      "4c0f8df7825fb4da-manifest.json",
      "9f94169e68c9e9ee.tar.zst",
      "9f94169e68c9e9ee-meta.json",
    ];
    expect(staleCacheFiles(files, new Set(["4c0f8df7825fb4da"]))).toEqual([
      "9f94169e68c9e9ee.tar.zst",
      "9f94169e68c9e9ee-meta.json",
    ]);
  });

  it("leaves files outside turbo's entry naming alone", () => {
    expect(staleCacheFiles(["README.md", "notes-meta.json", ".DS_Store"], new Set())).toEqual([]);
  });

  it("collects task hashes across every summary in the runs directory", () => {
    const runs = mkdtempSync(join(tmpdir(), "turbo-runs-"));
    mkdirSync(runs, { recursive: true });
    writeFileSync(
      join(runs, "a.json"),
      JSON.stringify({ tasks: [{ taskId: "docs#build", hash: "1111111111111111" }] })
    );
    writeFileSync(
      join(runs, "b.json"),
      JSON.stringify({ tasks: [{ taskId: "docs#test", hash: "2222222222222222" }] })
    );
    expect([...summarizedHashes(runs)].sort()).toEqual(["1111111111111111", "2222222222222222"]);
  });

  it("rejects a runs file that is not a turbo summary", () => {
    const runs = mkdtempSync(join(tmpdir(), "turbo-runs-"));
    writeFileSync(join(runs, "a.json"), JSON.stringify({ tasks: [{ taskId: "docs#build" }] }));
    expect(() => summarizedHashes(runs)).toThrow("a.json is not a turbo run summary");
  });
});
