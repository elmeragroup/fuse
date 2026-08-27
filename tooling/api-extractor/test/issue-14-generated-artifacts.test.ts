import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  linkSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";

import { writeGeneratedJsonFiles } from "../scripts/generated-artifacts.ts";

type WriterWorkerResult = {
  readonly status: string;
  readonly beforeWorkingDirectory: string;
  readonly afterWorkingDirectory: string;
  readonly error?: string;
};

import {
  createTemporaryRoot,
  fixtureRoot,
  stagingDirectoriesFor,
  temporaryFilesRecursively,
} from "./issue-14-fixtures.ts";

describe("Issue 14 generated artifacts", () => {
  it("rejects symlink and hardlink aliases for every generated write family", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-artifacts-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const oraclePath = join(temporaryRoot, "alias-with-explicit-type-args", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      const outputPath = join(temporaryRoot, "base-ui-component", "output.tsgo.json");
      rmSync(outputPath);
      symlinkSync(oraclePath, outputPath);
      const safePath = join(temporaryRoot, "base-ui-component", "preflight-safe.json");
      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: safePath, value: { safe: true } },
            { path: outputPath, value: { drift: true } },
          ],
          temporaryRoot
        )
      ).toThrow(/symlink|immutable/u);
      expect(existsSync(safePath)).toBe(false);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      rmSync(outputPath);

      const warningPath = join(temporaryRoot, "base-ui-component", "warnings.tsgo.json");
      rmSync(warningPath);
      linkSync(oraclePath, warningPath);
      expect(() =>
        writeGeneratedJsonFiles([{ path: warningPath, value: { drift: true } }], temporaryRoot)
      ).toThrow(/identity|immutable/u);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      rmSync(warningPath);

      const reasonPath = join(temporaryRoot, "base-ui-component", "ts7-oracle.json");
      rmSync(reasonPath);
      linkSync(oraclePath, reasonPath);
      expect(() =>
        writeGeneratedJsonFiles([{ path: reasonPath, value: { drift: true } }], temporaryRoot)
      ).toThrow(/identity|immutable/u);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      rmSync(reasonPath);

      const reportPath = join(temporaryRoot, "issue-14-conformance.json");
      rmSync(reportPath);
      linkSync(oraclePath, reportPath);
      expect(() =>
        writeGeneratedJsonFiles([{ path: reportPath, value: { drift: true } }], temporaryRoot)
      ).toThrow(/identity|immutable/u);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("atomically replaces a destination raced into an immutable-oracle hardlink", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-race-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const destinationPath = join(temporaryRoot, "base-ui-component", "race-output.tsgo.json");
      const oracleBefore = readFileSync(oraclePath);
      let hookCalls = 0;
      writeGeneratedJsonFiles([{ path: destinationPath, value: { raceSafe: true } }], temporaryRoot, {
        beforeRename: ({ destinationPath: racedPath }) => {
          hookCalls += 1;
          linkSync(oraclePath, racedPath);
        },
      });
      expect(hookCalls).toBe(1);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      expect(JSON.parse(readFileSync(destinationPath, "utf8"))).toEqual({ raceSafe: true });
      expect(readdirSync(dirname(destinationPath)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects a nonexistent destination beneath a symlinked parent before writing", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-parent-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      const symlinkParent = join(temporaryRoot, "linked-parent");
      const destinationPath = join(symlinkParent, "new-output.tsgo.json");
      symlinkSync(join(temporaryRoot, "base-ui-component"), symlinkParent, "dir");
      expect(() =>
        writeGeneratedJsonFiles([{ path: destinationPath, value: { shouldNotWrite: true } }], temporaryRoot)
      ).toThrow(/symlinked parent/u);
      expect(existsSync(join(temporaryRoot, "base-ui-component", "new-output.tsgo.json"))).toBe(false);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      expect(
        readdirSync(join(temporaryRoot, "base-ui-component")).filter((name) => name.endsWith(".tmp"))
      ).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("writes normal conformance and timing-shaped batches through the atomic helper", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-batch-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const conformancePath = join(temporaryRoot, "issue-14-conformance.json");
      const timingPath = join(temporaryRoot, "issue-14-timing.json");
      writeGeneratedJsonFiles(
        [
          { path: conformancePath, value: { issue: "14-full-conformance", status: "pass" } },
          { path: timingPath, value: { issue: "14-full-conformance", decision: "go" } },
        ],
        temporaryRoot
      );
      expect(JSON.parse(readFileSync(conformancePath, "utf8"))).toEqual({
        issue: "14-full-conformance",
        status: "pass",
      });
      expect(JSON.parse(readFileSync(timingPath, "utf8"))).toEqual({
        issue: "14-full-conformance",
        decision: "go",
      });
      expect(readdirSync(temporaryRoot).filter((name) => name.endsWith(".tmp"))).toEqual([]);

      const firstDestination = join(temporaryRoot, "base-ui-component", "transaction-first.json");
      const secondDestination = join(temporaryRoot, "base-ui-component", "transaction-second.json");
      writeFileSync(firstDestination, "preexisting-first\n");
      writeFileSync(secondDestination, "preexisting-second\n");
      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: firstDestination, value: { first: "replacement" } },
            { path: secondDestination, value: { second: "replacement" } },
          ],
          temporaryRoot,
          {
            beforeRename: ({ file }) => {
              if (file.path === secondDestination) throw new Error("synthetic second-entry commit failure");
            },
          }
        )
      ).toThrow("synthetic second-entry commit failure");
      expect(readFileSync(firstDestination, "utf8")).toBe("preexisting-first\n");
      expect(readFileSync(secondDestination, "utf8")).toBe("preexisting-second\n");
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects duplicate resolved destinations before staging or mutation", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-duplicate-destination-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "base-ui-component", "duplicate-output.tsgo.json");
      const duplicatePath = `${dirname(destinationPath)}/./${basename(destinationPath)}`;
      const laterDestination = join(temporaryRoot, "base-ui-component", "duplicate-later-failure.tsgo.json");
      const originalBytes = Buffer.from("original duplicate bytes\n");
      writeFileSync(destinationPath, originalBytes);
      let stagingHookCalls = 0;
      let renameHookCalls = 0;

      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: destinationPath, value: { first: true } },
            { path: duplicatePath, value: { second: true } },
            { path: laterDestination, value: { later: true } },
          ],
          temporaryRoot,
          {
            afterStagingDirectoryCreate: () => {
              stagingHookCalls += 1;
            },
            beforeRename: ({ file }) => {
              renameHookCalls += 1;
              if (file.path === laterDestination) throw new Error("synthetic later-entry failure");
            },
          }
        )
      ).toThrow(/duplicate resolved destination/u);

      expect(stagingHookCalls).toBe(0);
      expect(renameHookCalls).toBe(0);
      expect(readFileSync(destinationPath)).toEqual(originalBytes);
      expect(existsSync(laterDestination)).toBe(false);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("rejects distinct hardlinked destinations before staging or mutation", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-hardlinked-destinations-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const firstDestination = join(temporaryRoot, "base-ui-component", "hardlinked-first.tsgo.json");
      const secondDestination = join(temporaryRoot, "base-ui-component", "hardlinked-second.tsgo.json");
      const laterDestination = join(temporaryRoot, "base-ui-component", "hardlinked-later.tsgo.json");
      const originalBytes = Buffer.from("original hardlinked bytes\n");
      writeFileSync(firstDestination, originalBytes);
      linkSync(firstDestination, secondDestination);
      let stagingHookCalls = 0;
      let renameHookCalls = 0;

      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: firstDestination, value: { first: true } },
            { path: secondDestination, value: { second: true } },
            { path: laterDestination, value: { later: true } },
          ],
          temporaryRoot,
          {
            afterStagingDirectoryCreate: () => {
              stagingHookCalls += 1;
            },
            beforeRename: ({ file }) => {
              renameHookCalls += 1;
              if (file.path === laterDestination) throw new Error("synthetic later-entry failure");
            },
          }
        )
      ).toThrow(/aliases another generated destination/u);

      expect(stagingHookCalls).toBe(0);
      expect(renameHookCalls).toBe(0);
      expect(readFileSync(firstDestination)).toEqual(originalBytes);
      expect(readFileSync(secondDestination)).toEqual(originalBytes);
      expect(existsSync(laterDestination)).toBe(false);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("restores every destination when a later entry aliases a committed output", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-post-preflight-hardlink-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const firstDestination = join(temporaryRoot, "base-ui-component", "post-preflight-first.tsgo.json");
      const secondDestination = join(temporaryRoot, "base-ui-component", "post-preflight-second.tsgo.json");
      const laterDestination = join(temporaryRoot, "base-ui-component", "post-preflight-later.tsgo.json");

      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: firstDestination, value: { first: true } },
            { path: secondDestination, value: { second: true } },
            { path: laterDestination, value: { later: true } },
          ],
          temporaryRoot,
          {
            beforeRename: ({ file }) => {
              if (file.path === secondDestination) {
                if (existsSync(secondDestination)) unlinkSync(secondDestination);
                linkSync(firstDestination, secondDestination);
              }
              if (file.path === laterDestination) throw new Error("synthetic post-alias failure");
            },
          }
        )
      ).toThrow(/post-alias failure|transaction|alias/u);

      expect(existsSync(firstDestination)).toBe(false);
      expect(existsSync(secondDestination)).toBe(false);
      expect(existsSync(laterDestination)).toBe(false);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("restores a pre-existing destination after a post-preflight alias collision", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-post-preflight-existing-alias-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const firstDestination = join(temporaryRoot, "base-ui-component", "existing-alias-first.tsgo.json");
      const secondDestination = join(temporaryRoot, "base-ui-component", "existing-alias-second.tsgo.json");
      const laterDestination = join(temporaryRoot, "base-ui-component", "existing-alias-later.tsgo.json");
      const originalBytes = Buffer.from("B ORIGINAL\n");
      writeFileSync(secondDestination, originalBytes);

      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: firstDestination, value: { first: "new" } },
            { path: secondDestination, value: { second: "new" } },
            { path: laterDestination, value: { later: "new" } },
          ],
          temporaryRoot,
          {
            beforeRename: ({ destinationPath }) => {
              if (destinationPath === secondDestination) {
                unlinkSync(secondDestination);
                linkSync(firstDestination, secondDestination);
              }
            },
          }
        )
      ).toThrow(/transaction|alias/u);

      expect(existsSync(firstDestination)).toBe(false);
      expect(readFileSync(secondDestination)).toEqual(originalBytes);
      expect(existsSync(laterDestination)).toBe(false);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("handles missing case-fold aliases with an intentional portable outcome", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-case-fold-alias-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const upperDestination = join(temporaryRoot, "base-ui-component", "CaseAlias.tsgo.json");
      const lowerDestination = join(temporaryRoot, "base-ui-component", "casealias.tsgo.json");
      const laterDestination = join(temporaryRoot, "base-ui-component", "case-alias-later.tsgo.json");
      const caseProbeUpper = join(temporaryRoot, "base-ui-component", "CaseProbe.tsgo.json");
      const caseProbeLower = join(temporaryRoot, "base-ui-component", "caseprobe.tsgo.json");
      writeFileSync(caseProbeUpper, "probe\n");
      const caseInsensitive = existsSync(caseProbeLower);
      unlinkSync(caseProbeUpper);
      let laterFailureReached = false;

      expect(() => {
        writeGeneratedJsonFiles(
          [
            { path: upperDestination, value: { upper: true } },
            { path: lowerDestination, value: { lower: true } },
            { path: laterDestination, value: { later: true } },
          ],
          temporaryRoot,
          {
            beforeRename: ({ file }) => {
              if (file.path === laterDestination) {
                laterFailureReached = true;
                throw new Error("synthetic case-fold later failure");
              }
            },
          }
        );
      }).toThrow(/case-fold later failure|case-fold|transaction|alias/u);

      // On case-sensitive filesystems the names are distinct and the injected
      // later failure exercises ordinary transaction rollback. On a
      // case-insensitive filesystem they address one entry, so the worker must
      // reject the collision and still restore the initially-missing state.
      expect(laterFailureReached).toBe(!caseInsensitive);
      expect(existsSync(caseProbeUpper)).toBe(false);
      expect(existsSync(caseProbeLower)).toBe(false);
      expect(existsSync(upperDestination)).toBe(false);
      expect(existsSync(lowerDestination)).toBe(false);
      expect(existsSync(laterDestination)).toBe(false);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("keeps cwd isolated for concurrent worker-thread writers", async () => {
    const workingDirectory = process.cwd();
    const temporaryRoots = [0, 1].map((index) => {
      const root = createTemporaryRoot(`api-extractor-generated-worker-${index}-`);
      cpSync(fixtureRoot, root, { recursive: true });
      return root;
    });
    try {
      const results = await Promise.all(
        temporaryRoots.map(
          (fixtureDirectory, index) =>
            new Promise<WriterWorkerResult>((resolveWorker, rejectWorker) => {
              const worker = new Worker(new URL("./issue-14-writer-worker.ts", import.meta.url), {
                workerData: {
                  fixtureDirectory,
                  destinationPath: join(fixtureDirectory, "base-ui-component", `worker-${index}.tsgo.json`),
                },
              });
              let settled = false;
              worker.once("message", (message: WriterWorkerResult) => {
                settled = true;
                resolveWorker(message);
              });
              worker.once("error", (error) => {
                if (!settled) {
                  settled = true;
                  rejectWorker(error);
                }
              });
              worker.once("exit", (code) => {
                if (!settled && code !== 0) {
                  settled = true;
                  rejectWorker(new Error(`writer worker exited with ${code}`));
                }
              });
            })
        )
      );
      expect(process.cwd()).toBe(workingDirectory);
      expect(results.every((result) => result.status === "pass")).toBe(true);
      expect(results.every((result) => result.beforeWorkingDirectory === workingDirectory)).toBe(true);
      expect(results.every((result) => result.afterWorkingDirectory === workingDirectory)).toBe(true);
      expect(results.every((result) => result.error === undefined)).toBe(true);
      for (const [index, root] of temporaryRoots.entries()) {
        expect(
          JSON.parse(readFileSync(join(root, "base-ui-component", `worker-${index}.tsgo.json`), "utf8"))
        ).toEqual({
          workerSafe: true,
        });
      }
    } finally {
      expect(process.cwd()).toBe(workingDirectory);
      for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
    }
  });

  it("reaps repeated helper writers without cwd or staging residue", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-repeated-writers-");
    const workingDirectory = process.cwd();
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      for (let index = 0; index < 4; index += 1) {
        const destinationPath = join(temporaryRoot, "base-ui-component", `repeated-${index}.tsgo.json`);
        writeGeneratedJsonFiles([{ path: destinationPath, value: { repeated: index } }], temporaryRoot);
        expect(JSON.parse(readFileSync(destinationPath, "utf8"))).toEqual({ repeated: index });
      }
      expect(process.cwd()).toBe(workingDirectory);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      expect(process.cwd()).toBe(workingDirectory);
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("surfaces malformed helper startup protocol and leaves no staging residue", () => {
    const packageDirectory = resolve(fixtureRoot, "../..");
    const workerScript = resolve(packageDirectory, "scripts/generated-artifact-worker.ts");
    const result = spawnSync(process.execPath, [workerScript], {
      cwd: packageDirectory,
      input: "not-json\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status, result.stderr).toBe(1);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    // SAFETY: the dedicated helper emits this fixed error-event shape for a malformed request.
    const event = JSON.parse(lines[0] ?? "null") as {
      readonly kind?: string;
      readonly id?: number;
      readonly error?: { readonly message?: string };
    };
    expect(event.kind).toBe("error");
    expect(event.id).toBe(0);
    expect(event.error?.message).toMatch(/invalid JSON/u);
    expect(stagingDirectoriesFor(fixtureRoot)).toEqual([]);
  });

  it("surfaces a missing helper executable synchronously without creating staging", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-missing-helper-");
    const originalExecutable = process.execPath;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      process.execPath = join(temporaryRoot, "missing-node-executable");
      expect(() =>
        writeGeneratedJsonFiles(
          [
            {
              path: join(temporaryRoot, "issue-14-missing-helper.tsgo.json"),
              value: { shouldNotWrite: true },
            },
          ],
          temporaryRoot
        )
      ).toThrow(/worker executable is unavailable/u);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      process.execPath = originalExecutable;
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects a forged temporary replacement and retains the replacement bytes", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-forged-temporary-");
    let replacementPath: string | undefined;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-forged-temporary.tsgo.json");
      expect(() =>
        writeGeneratedJsonFiles([{ path: destinationPath, value: { original: true } }], temporaryRoot, {
          beforeRename: ({ temporaryPath }) => {
            replacementPath = temporaryPath;
            unlinkSync(temporaryPath);
            writeFileSync(temporaryPath, JSON.stringify({ forged: true }) + "\n");
          },
        })
      ).toThrow(/replaced before commit/u);
      expect(existsSync(destinationPath)).toBe(false);
      if (replacementPath === undefined) throw new Error("Forgery hook did not capture its replacement path");
      expect(JSON.parse(readFileSync(replacementPath, "utf8"))).toEqual({ forged: true });
    } finally {
      if (replacementPath !== undefined) {
        rmSync(replacementPath, { force: true });
        rmSync(dirname(replacementPath), { recursive: true, force: true });
      }
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("does not unlink a forged temporary replacement during error cleanup", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-forged-cleanup-");
    let replacementPath: string | undefined;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-forged-cleanup.tsgo.json");
      expect(() =>
        writeGeneratedJsonFiles([{ path: destinationPath, value: { original: true } }], temporaryRoot, {
          beforeRename: ({ temporaryPath }) => {
            replacementPath = temporaryPath;
            unlinkSync(temporaryPath);
            writeFileSync(temporaryPath, JSON.stringify({ forged: true }) + "\n");
            throw new Error("synthetic forged cleanup failure");
          },
        })
      ).toThrow("synthetic forged cleanup failure");
      expect(existsSync(destinationPath)).toBe(false);
      if (replacementPath === undefined) throw new Error("Cleanup hook did not capture its replacement path");
      expect(JSON.parse(readFileSync(replacementPath, "utf8"))).toEqual({ forged: true });
    } finally {
      if (replacementPath !== undefined) {
        rmSync(replacementPath, { force: true });
        rmSync(dirname(replacementPath), { recursive: true, force: true });
      }
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("refuses destinations outside the validated artifact root before staging", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-root-boundary-");
    const outsidePath = join(dirname(temporaryRoot), `${basename(temporaryRoot)}-outside.json`);
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      expect(() =>
        writeGeneratedJsonFiles([{ path: outsidePath, value: { shouldNotWrite: true } }], temporaryRoot)
      ).toThrow(/outside the artifact root/u);
      expect(existsSync(outsidePath)).toBe(false);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(outsidePath, { force: true });
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });
});
