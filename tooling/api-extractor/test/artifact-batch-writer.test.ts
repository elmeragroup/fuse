import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { makeArtifactBatchWriterForTest, writeArtifactBatch } from "../scripts/artifact-batch-writer.ts";

function transactionEntries(root: string): readonly string[] {
  return readdirSync(root).filter((entry) => entry.startsWith(".artifact-batch-"));
}

describe("artifact batch writer", () => {
  it("writes a complete multi-artifact batch and removes transaction state", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-batch-"));
    try {
      writeFileSync(join(root, "existing.json"), "old contents\n");

      const result = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [
          {
            destination: "existing.json",
            content: "new contents\n",
            evidence: "generated",
          },
          {
            destination: "nested/new.json",
            content: '{"status":"pass"}\n',
            evidence: "reviewed",
          },
        ],
      });

      expect(result).toEqual({
        status: "success",
        artifacts: [
          { destination: "existing.json", evidence: "generated" },
          { destination: "nested/new.json", evidence: "reviewed" },
        ],
      });
      expect(readFileSync(join(root, "existing.json"), "utf8")).toBe("new contents\n");
      expect(readFileSync(join(root, "nested/new.json"), "utf8")).toBe('{"status":"pass"}\n');
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects the whole batch before changing an earlier valid destination", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-preflight-"));
    const outsidePath = join(root, "../escaped-artifact.json");
    try {
      writeFileSync(join(root, "existing.json"), "original\n");

      const result = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [
          {
            destination: "existing.json",
            content: "replacement\n",
            evidence: "generated",
          },
          {
            destination: "../escaped-artifact.json",
            content: "escaped\n",
            evidence: "generated",
          },
        ],
      });

      expect(result).toEqual({
        status: "failure",
        error: {
          category: "invalid-destination",
          message: "Artifact destination escapes the output root.",
          destination: "../escaped-artifact.json",
        },
      });
      expect(readFileSync(join(root, "existing.json"), "utf8")).toBe("original\n");
      expect(existsSync(outsidePath)).toBe(false);
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outsidePath, { force: true });
    }
  });

  it("restores every original destination when a later artifact cannot be written", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-rollback-"));
    try {
      writeFileSync(join(root, "first.json"), "first original\n");
      writeFileSync(join(root, "second.json"), "second original\n");
      const writeWithFailure = makeArtifactBatchWriterForTest({
        beforeArtifactWrite: ({ index }) => {
          if (index === 1) throw new Error("synthetic artifact write failure");
        },
      });

      const result = await writeWithFailure({
        outputRoot: root,
        artifacts: [
          { destination: "first.json", content: "first replacement\n", evidence: "generated" },
          { destination: "second.json", content: "second replacement\n", evidence: "reviewed" },
        ],
      });

      expect(result).toEqual({
        status: "failure",
        error: {
          category: "write-failed",
          message: "synthetic artifact write failure",
          destination: "second.json",
          recovery: {
            originalState: "restored",
            temporaryState: "removed",
          },
        },
      });
      expect(readFileSync(join(root, "first.json"), "utf8")).toBe("first original\n");
      expect(readFileSync(join(root, "second.json"), "utf8")).toBe("second original\n");
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects duplicate and file-directory destinations before staging", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-conflict-"));
    try {
      const duplicate = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [
          { destination: "nested/../same.json", content: "first\n", evidence: "generated" },
          { destination: "same.json", content: "second\n", evidence: "reviewed" },
        ],
      });
      expect(duplicate.status).toBe("failure");
      if (duplicate.status === "failure") {
        expect(duplicate.error.category).toBe("duplicate-destination");
      }

      const fileDirectoryConflict = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [
          { destination: "evidence", content: "file\n", evidence: "generated" },
          { destination: "evidence/report.json", content: "nested\n", evidence: "generated" },
        ],
      });
      expect(fileDirectoryConflict.status).toBe("failure");
      if (fileDirectoryConflict.status === "failure") {
        expect(fileDirectoryConflict.error.category).toBe("file-directory-conflict");
      }

      expect(existsSync(join(root, "same.json"))).toBe(false);
      expect(existsSync(join(root, "evidence"))).toBe(false);
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects immutable evidence and symlink escapes without changing the destination tree", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-policy-"));
    const outside = mkdtempSync(join(tmpdir(), "api-extractor-artifact-outside-"));
    try {
      mkdirSync(join(root, "fixture"));
      writeFileSync(join(root, "fixture/output.json"), "upstream oracle\n");
      symlinkSync(outside, join(root, "linked"), "dir");

      const immutable = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [
          {
            destination: "fixture/generated.json",
            content: "ordinary generated output\n",
            evidence: "generated",
          },
          {
            destination: "fixture/warnings.json",
            content: "reviewed warning evidence\n",
            evidence: "reviewed",
          },
          {
            destination: "fixture/output.json",
            content: "replacement\n",
            evidence: "immutable-upstream",
          },
        ],
      });
      expect(immutable.status).toBe("failure");
      if (immutable.status === "failure") expect(immutable.error.category).toBe("immutable-oracle");

      const symlinkEscape = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [{ destination: "linked/escaped.json", content: "escaped\n", evidence: "generated" }],
      });
      expect(symlinkEscape.status).toBe("failure");
      if (symlinkEscape.status === "failure") {
        expect(symlinkEscape.error.category).toBe("symlink-escape");
      }

      expect(readFileSync(join(root, "fixture/output.json"), "utf8")).toBe("upstream oracle\n");
      expect(existsSync(join(root, "fixture/generated.json"))).toBe(false);
      expect(existsSync(join(root, "fixture/warnings.json"))).toBe(false);
      expect(existsSync(join(outside, "escaped.json"))).toBe(false);
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("restores mixed evidence after a recoverable rollback fault and cleanup retry", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-recovery-"));
    try {
      writeFileSync(join(root, "generated.json"), "generated original\n");
      writeFileSync(join(root, "warnings.json"), "warnings original\n");
      let rollbackAttempts = 0;
      let transactionCleanupAttempts = 0;
      const writeWithRecovery = makeArtifactBatchWriterForTest({
        beforeArtifactWrite: ({ index }) => {
          if (index === 1) throw new Error("synthetic reviewed evidence failure");
        },
        beforeRollbackRestore: ({ destination }) => {
          if (destination === "warnings.json" && rollbackAttempts++ === 0) {
            throw new Error("synthetic recoverable rollback failure");
          }
        },
        beforeTemporaryCleanup: ({ kind }) => {
          if (kind === "transaction" && transactionCleanupAttempts++ === 0) {
            throw new Error("synthetic recoverable cleanup failure");
          }
        },
      });

      const result = await writeWithRecovery({
        outputRoot: root,
        artifacts: [
          { destination: "generated.json", content: "generated replacement\n", evidence: "generated" },
          { destination: "warnings.json", content: "warnings replacement\n", evidence: "reviewed" },
        ],
      });

      expect(result).toEqual({
        status: "failure",
        error: {
          category: "write-failed",
          message: "synthetic reviewed evidence failure",
          destination: "warnings.json",
          recovery: {
            originalState: "restored-after-retry",
            temporaryState: "removed-after-retry",
          },
        },
      });
      expect(readFileSync(join(root, "generated.json"), "utf8")).toBe("generated original\n");
      expect(readFileSync(join(root, "warnings.json"), "utf8")).toBe("warnings original\n");
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an overlapping writer without allowing a mixed artifact set", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-concurrent-"));
    try {
      writeFileSync(join(root, "first.json"), "original first\n");
      writeFileSync(join(root, "second.json"), "original second\n");
      let releaseFirst!: () => void;
      const firstPaused = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let announcePause!: () => void;
      const paused = new Promise<void>((resolve) => {
        announcePause = resolve;
      });
      const firstWriter = makeArtifactBatchWriterForTest({
        beforeArtifactWrite: async ({ index }) => {
          if (index !== 0) return;
          announcePause();
          await firstPaused;
        },
      });

      const first = firstWriter({
        outputRoot: root,
        artifacts: [
          { destination: "first.json", content: "winner first\n", evidence: "generated" },
          { destination: "second.json", content: "winner second\n", evidence: "reviewed" },
        ],
      });
      await paused;
      const second = await writeArtifactBatch({
        outputRoot: root,
        artifacts: [
          { destination: "first.json", content: "loser first\n", evidence: "generated" },
          { destination: "second.json", content: "loser second\n", evidence: "reviewed" },
        ],
      });
      releaseFirst();

      expect(second).toEqual({
        status: "failure",
        error: {
          category: "concurrent-write",
          message: "Another artifact batch is already writing to this output root.",
        },
      });
      await expect(first).resolves.toMatchObject({ status: "success" });
      expect(readFileSync(join(root, "first.json"), "utf8")).toBe("winner first\n");
      expect(readFileSync(join(root, "second.json"), "utf8")).toBe("winner second\n");
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns an interrupted failure within a bounded time and restores the destination", async () => {
    const root = mkdtempSync(join(tmpdir(), "api-extractor-artifact-timeout-"));
    try {
      writeFileSync(join(root, "report.json"), "original report\n");
      const writeThatStalls = makeArtifactBatchWriterForTest({
        maximumDurationMs: 50,
        beforeArtifactWrite: () => new Promise<void>(() => undefined),
      });
      const startedAt = Date.now();

      const result = await writeThatStalls({
        outputRoot: root,
        artifacts: [{ destination: "report.json", content: "replacement\n", evidence: "reviewed" }],
      });

      expect(Date.now() - startedAt).toBeLessThan(1_000);
      expect(result).toEqual({
        status: "failure",
        error: {
          category: "interrupted",
          message: "The artifact batch did not complete within its allowed time.",
          destination: "report.json",
          recovery: {
            originalState: "restored",
            temporaryState: "removed",
          },
        },
      });
      expect(readFileSync(join(root, "report.json"), "utf8")).toBe("original report\n");
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
