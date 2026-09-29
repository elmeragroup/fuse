import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { pruneTurboCache } from "../scripts/prune-turbo-cache.ts";

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
  it("keeps the cache and names the missing run summary when the runs directory is absent", () => {
    const cache = scratch();
    writeFileSync(join(cache, "4c0f8df7825fb4da.tar.zst"), "");
    const runs = join(cache, "runs");
    expect(() => pruneTurboCache(cache, runs)).toThrow(
      `No task hashes in ${runs}; was TURBO_RUN_SUMMARY set?`
    );
    expect(readdirSync(cache)).toEqual(["4c0f8df7825fb4da.tar.zst"]);
  });

  it("rejects a runs file that is not a turbo summary and leaves the cache alone", () => {
    const cache = scratch();
    const runs = scratch();
    writeFileSync(join(cache, "4c0f8df7825fb4da.tar.zst"), "");
    writeFileSync(join(runs, "a.json"), JSON.stringify({ tasks: [{ taskId: "docs#build" }] }));
    expect(() => pruneTurboCache(cache, runs)).toThrow("a.json is not a turbo run summary");
    expect(readdirSync(cache)).toEqual(["4c0f8df7825fb4da.tar.zst"]);
  });

  it("deletes every file of the entries no run summary records and keeps the rest", () => {
    const cache = scratch();
    const runs = scratch();
    for (const file of [
      "1111111111111111.tar.zst",
      "1111111111111111-meta.json",
      "1111111111111111-manifest.json",
      "2222222222222222.tar.zst",
      "2222222222222222-meta.json",
      "3333333333333333.tar.zst",
      "README.md",
      "notes-meta.json",
    ]) {
      writeFileSync(join(cache, file), "");
    }
    writeFileSync(join(runs, "a.json"), JSON.stringify({ tasks: [{ hash: "1111111111111111" }] }));
    writeFileSync(join(runs, "b.json"), JSON.stringify({ tasks: [{ hash: "3333333333333333" }] }));
    expect(pruneTurboCache(cache, runs)).toEqual({ kept: 2, removed: 2 });
    expect(readdirSync(cache).sort()).toEqual([
      "1111111111111111-manifest.json",
      "1111111111111111-meta.json",
      "1111111111111111.tar.zst",
      "3333333333333333.tar.zst",
      "README.md",
      "notes-meta.json",
    ]);
  });
});
