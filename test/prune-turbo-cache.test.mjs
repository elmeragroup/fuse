import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { pruneTurboCache, staleCacheFiles, summarizedHashes } from "../scripts/prune-turbo-cache.ts";

/** @type {string[]} */
const scratchDirs = [];

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "turbo-prune-"));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

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
    const runs = scratch();
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
    const runs = scratch();
    writeFileSync(join(runs, "a.json"), JSON.stringify({ tasks: [{ taskId: "docs#build" }] }));
    expect(() => summarizedHashes(runs)).toThrow("a.json is not a turbo run summary");
  });

  it("keeps the cache and names the missing run summary when the runs directory is absent", () => {
    const cache = scratch();
    writeFileSync(join(cache, "4c0f8df7825fb4da.tar.zst"), "");
    const runs = join(cache, "runs");
    expect(() => pruneTurboCache(cache, runs)).toThrow(
      `No task hashes in ${runs}; was TURBO_RUN_SUMMARY set?`
    );
    expect(readdirSync(cache)).toEqual(["4c0f8df7825fb4da.tar.zst"]);
  });

  it("deletes the unsummarized entries from the cache directory", () => {
    const cache = scratch();
    const runs = scratch();
    for (const file of [
      "1111111111111111.tar.zst",
      "2222222222222222.tar.zst",
      "2222222222222222-meta.json",
    ]) {
      writeFileSync(join(cache, file), "");
    }
    writeFileSync(join(runs, "a.json"), JSON.stringify({ tasks: [{ hash: "1111111111111111" }] }));
    expect(pruneTurboCache(cache, runs)).toEqual({ kept: 1, removed: 2 });
    expect(readdirSync(cache)).toEqual(["1111111111111111.tar.zst"]);
  });
});
