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
      expect(existsSync(join(outside, "escaped.json"))).toBe(false);
      expect(transactionEntries(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
