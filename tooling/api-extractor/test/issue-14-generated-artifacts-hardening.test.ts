import { spawnSync } from "node:child_process";
import {
  cpSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { removeTemporaryFile, snapshotDestination } from "../scripts/generated-artifact-transaction.ts";
import { writeGeneratedJsonFiles } from "../scripts/generated-artifacts.ts";
import {
  createTemporaryRoot,
  createIgnoredTemporaryRoot,
  fixtureRoot,
  stagingDirectoriesFor,
  temporaryFilesRecursively,
} from "./issue-14-fixtures.ts";

describe("Issue 14 generated-artifact filesystem hardening", () => {
  it("preserves post-copy validation errors while cleaning a closed backup descriptor", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-backup-validation-");
    let backupPath: string | undefined;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "base-ui-component", "backup-validation.json");
      writeFileSync(destinationPath, "original backup bytes\n");

      const returnedBackup = snapshotDestination(destinationPath);
      expect(returnedBackup.kind).toBe("file");
      if (returnedBackup.kind !== "file") throw new Error("Expected an existing destination backup");
      expect(Object.keys(returnedBackup.staging).sort()).toEqual(["device", "inode", "name", "path"]);
      expect("fd" in returnedBackup.staging).toBe(false);
      const returnedBackupPath = resolve(returnedBackup.staging.path);
      expect(existsSync(returnedBackupPath)).toBe(true);
      removeTemporaryFile(returnedBackup.staging);
      expect(existsSync(returnedBackupPath)).toBe(false);

      expect(() =>
        snapshotDestination(destinationPath, {
          afterBackup: (staging) => {
            expect(Object.keys(staging).sort()).toEqual(["device", "inode", "name", "path"]);
            expect("fd" in staging).toBe(false);
            backupPath = resolve(staging.path);
            unlinkSync(destinationPath);
          },
        })
      ).toThrow(/ENOENT/u);

      expect(existsSync(destinationPath)).toBe(false);
      if (backupPath === undefined) throw new Error("Snapshot hook did not capture its backup path");
      expect(existsSync(backupPath)).toBe(false);
    } finally {
      if (backupPath !== undefined) rmSync(backupPath, { force: true });
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("cleans earlier backups when upfront transaction preservation fails", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-backup-failure-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const firstDestination = join(temporaryRoot, "base-ui-component", "backup-first.json");
      const secondDestination = join(temporaryRoot, "base-ui-component", "backup-unreadable.json");
      writeFileSync(firstDestination, "first original\n");
      writeFileSync(secondDestination, "second original\n");
      chmodSync(secondDestination, 0o000);

      expect(() =>
        writeGeneratedJsonFiles(
          [
            { path: firstDestination, value: { first: "replacement" } },
            { path: secondDestination, value: { second: "replacement" } },
          ],
          temporaryRoot
        )
      ).toThrow(/EACCES|permission denied/u);

      expect(readFileSync(firstDestination, "utf8")).toBe("first original\n");
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      chmodSync(join(temporaryRoot, "base-ui-component", "backup-unreadable.json"), 0o600);
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("skips a user-replaceable TMPDIR candidate without leaving staging residue", () => {
    const packageDirectory = resolve(fixtureRoot, "../..");
    // Keep the artifact root outside the canonical temporary tree so the
    // protected `/tmp` fallback remains a valid same-device candidate after
    // the user-owned TMPDIR candidate is rejected.
    const temporaryRoot = createIgnoredTemporaryRoot(".api-extractor-generated-stage-root-");
    const replaceableTemporaryDirectory = createTemporaryRoot("api-extractor-generated-stage-parent-");
    const movedTemporaryDirectory = `${replaceableTemporaryDirectory}-old`;
    const childScript = `
      import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
      import { basename, join } from "node:path";
      const candidate = process.env.TMPDIR;
      const artifactRoot = process.env.ISSUE14_ARTIFACT_ROOT;
      if (candidate === undefined || artifactRoot === undefined) {
        throw new Error("Issue 14 staging candidate test is missing its environment");
      }
      const { writeGeneratedJsonFiles } = await import("./scripts/generated-artifacts.ts");
      const stagingPrefix = "." + basename(artifactRoot) + ".generated-artifact-staging.";
      const stagingEntries = (path) =>
        existsSync(path)
          ? readdirSync(path, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && entry.name.startsWith(stagingPrefix))
              .map((entry) => entry.name)
          : [];
      const destination = join(artifactRoot, "base-ui-component", "tmpdir-stage-skip.tsgo.json");
      const movedCandidate = candidate + "-old";
      let error;
      try {
        writeGeneratedJsonFiles([{ path: destination, value: { skipped: true } }], artifactRoot, {
          beforeRename: () => {
            renameSync(candidate, movedCandidate);
            mkdirSync(candidate);
          },
        });
      } catch (cause) {
        error = String(cause);
      }
      const result = {
        error,
        destinationExists: existsSync(destination),
        candidateEntries: stagingEntries(candidate),
        movedCandidateEntries: stagingEntries(movedCandidate),
      };
      console.log(JSON.stringify(result));
      if (
        error !== undefined ||
        !result.destinationExists ||
        result.candidateEntries.length !== 0 ||
        result.movedCandidateEntries.length !== 0
      ) {
        process.exitCode = 1;
      }
    `;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", childScript], {
        cwd: packageDirectory,
        env: {
          ...process.env,
          TMPDIR: replaceableTemporaryDirectory,
          ISSUE14_ARTIFACT_ROOT: temporaryRoot,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      // SAFETY: the child emits this fixed JSON shape after the write attempt.
      const report = JSON.parse(result.stdout) as {
        readonly error?: string;
        readonly destinationExists: boolean;
        readonly candidateEntries: readonly string[];
        readonly movedCandidateEntries: readonly string[];
      };
      expect(report.error).toBeUndefined();
      expect(report.destinationExists).toBe(true);
      expect(report.candidateEntries).toEqual([]);
      expect(report.movedCandidateEntries).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      rmSync(replaceableTemporaryDirectory, { recursive: true, force: true });
      rmSync(movedTemporaryDirectory, { recursive: true, force: true });
    }
  });

  it("falls back when the first same-device staging candidate cannot allocate", () => {
    const packageDirectory = resolve(fixtureRoot, "../..");
    // Keep the artifact root outside the temporary candidate tree so the
    // canonical `/tmp` candidate remains eligible after the first candidate
    // is rejected as non-allocatable.
    const temporaryRoot = createIgnoredTemporaryRoot(".api-extractor-generated-stage-fallback-root-");
    // `/var` is a stable, same-device directory whose root-owned parent chain
    // is not replaceable by the test user, but where staging allocation is not
    // permitted. The later `/tmp` candidate remains eligible.
    const unavailableCandidate = "/var";
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const childScript = `
        import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
        import { basename, dirname, join } from "node:path";
        const candidate = process.env.TMPDIR;
        const artifactRoot = process.env.ISSUE14_ARTIFACT_ROOT;
        if (candidate === undefined || artifactRoot === undefined) {
          throw new Error("Issue 14 staging fallback test is missing its environment");
        }
        const { writeGeneratedJsonFiles } = await import("./scripts/generated-artifacts.ts");
        const stagingPrefix = "." + basename(artifactRoot) + ".generated-artifact-staging.";
        const stagingEntries = (path) =>
          existsSync(path)
            ? readdirSync(path, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && entry.name.startsWith(stagingPrefix))
                .map((entry) => entry.name)
            : [];
        const fallbackParents = new Set(["/tmp", "/var/tmp"].map((path) => {
          try {
            return realpathSync(path);
          } catch {
            return path;
          }
        }));
        const destination = join(artifactRoot, "base-ui-component", "unavailable-stage-fallback.tsgo.json");
        let selectedTemporaryPath;
        let error;
        try {
          writeGeneratedJsonFiles([{ path: destination, value: { fallback: true } }], artifactRoot, {
            beforeRename: ({ temporaryPath }) => {
              selectedTemporaryPath = temporaryPath;
            },
          });
        } catch (cause) {
          error = String(cause);
        }
        const result = {
          error,
          destinationExists: existsSync(destination),
          selectedTemporaryParent:
            selectedTemporaryPath === undefined ? undefined : dirname(selectedTemporaryPath),
          candidateDevice: statSync(candidate).dev,
          fallbackDevices: [...fallbackParents]
            .filter((path) => existsSync(path))
            .map((path) => statSync(path).dev),
          candidateEntries: stagingEntries(candidate),
          fallbackEntries: [...fallbackParents].flatMap((path) => stagingEntries(path)),
        };
        console.log(JSON.stringify(result));
        if (
          error !== undefined ||
          !result.destinationExists ||
          result.selectedTemporaryParent === candidate ||
          result.selectedTemporaryParent === undefined ||
          result.candidateEntries.length !== 0 ||
          result.fallbackEntries.length !== 0
        ) {
          process.exitCode = 1;
        }
      `;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", childScript], {
        cwd: packageDirectory,
        env: {
          ...process.env,
          TMPDIR: unavailableCandidate,
          ISSUE14_ARTIFACT_ROOT: temporaryRoot,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      // SAFETY: the child emits this fixed JSON shape after the write attempt.
      const report = JSON.parse(result.stdout) as {
        readonly error?: string;
        readonly destinationExists: boolean;
        readonly selectedTemporaryParent?: string;
        readonly candidateDevice: number;
        readonly fallbackDevices: readonly number[];
        readonly candidateEntries: readonly string[];
        readonly fallbackEntries: readonly string[];
      };
      expect(report.error).toBeUndefined();
      expect(report.destinationExists).toBe(true);
      expect(report.selectedTemporaryParent).not.toBe(unavailableCandidate);
      expect(report.selectedTemporaryParent).toBeDefined();
      expect(report.fallbackDevices).toContain(report.candidateDevice);
      expect(report.candidateEntries).toEqual([]);
      expect(report.fallbackEntries).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("cleans the temporary file when an atomic commit hook fails", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-cleanup-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-conformance-cleanup.json");
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: () => {
              throw new Error("synthetic commit failure");
            },
          }
        )
      ).toThrow("synthetic commit failure");
      expect(existsSync(destinationPath)).toBe(false);
      expect(readdirSync(temporaryRoot).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("preserves the primary commit failure when temporary cleanup also fails", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-cleanup-precedence-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-conformance-cleanup-precedence.json");
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: ({ temporaryPath }) => {
              unlinkSync(temporaryPath);
              throw new Error("primary commit safety failure");
            },
          }
        )
      ).toThrow("primary commit safety failure");
      expect(existsSync(destinationPath)).toBe(false);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("cleans stable staging after a destination parent is replaced during the final check", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-parent-replacement-");
    const movedRoot = `${temporaryRoot}-old`;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-conformance-parent-replacement.json");
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: () => {
              renameSync(temporaryRoot, movedRoot);
              mkdirSync(temporaryRoot);
            },
          }
        )
      ).toThrow(/parent changed/u);
      expect(existsSync(destinationPath)).toBe(false);
      expect(existsSync(join(movedRoot, "issue-14-conformance-parent-replacement.json"))).toBe(false);
      expect(readFileSync(join(movedRoot, "base-ui-component", "output.json"))).toEqual(oracleBefore);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(temporaryFilesRecursively(movedRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      rmSync(movedRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans stable staging when a commit failure follows parent replacement", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-parent-failure-");
    const movedRoot = `${temporaryRoot}-old`;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-conformance-parent-failure.json");
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: () => {
              renameSync(temporaryRoot, movedRoot);
              mkdirSync(temporaryRoot);
              throw new Error("synthetic commit failure after parent replacement");
            },
          }
        )
      ).toThrow("synthetic commit failure after parent replacement");
      expect(existsSync(destinationPath)).toBe(false);
      expect(existsSync(join(movedRoot, "issue-14-conformance-parent-failure.json"))).toBe(false);
      expect(readFileSync(join(movedRoot, "base-ui-component", "output.json"))).toEqual(oracleBefore);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(temporaryFilesRecursively(movedRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      rmSync(movedRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans staging when the shared root parent is replaced during the final check", () => {
    const outerRoot = createTemporaryRoot("api-extractor-generated-shared-parent-replacement-");
    const temporaryRoot = join(outerRoot, "fixtures");
    const movedRoot = `${outerRoot}-old`;
    try {
      mkdirSync(temporaryRoot);
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-shared-parent-replacement.json");
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: () => {
              renameSync(outerRoot, movedRoot);
              mkdirSync(outerRoot);
              mkdirSync(temporaryRoot);
            },
          }
        )
      ).toThrow(/parent changed/u);
      expect(existsSync(destinationPath)).toBe(false);
      expect(existsSync(join(movedRoot, "issue-14-shared-parent-replacement.json"))).toBe(false);
      expect(readFileSync(join(movedRoot, "fixtures/base-ui-component/output.json"))).toEqual(oracleBefore);
      expect(temporaryFilesRecursively(outerRoot)).toEqual([]);
      expect(temporaryFilesRecursively(movedRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(outerRoot, { recursive: true, force: true });
      rmSync(movedRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans staging when a commit failure follows shared root-parent replacement", () => {
    const outerRoot = createTemporaryRoot("api-extractor-generated-shared-parent-failure-");
    const temporaryRoot = join(outerRoot, "fixtures");
    const movedRoot = `${outerRoot}-old`;
    try {
      mkdirSync(temporaryRoot);
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-shared-parent-failure.json");
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: () => {
              renameSync(outerRoot, movedRoot);
              mkdirSync(outerRoot);
              mkdirSync(temporaryRoot);
              throw new Error("synthetic shared parent commit failure");
            },
          }
        )
      ).toThrow("synthetic shared parent commit failure");
      expect(existsSync(destinationPath)).toBe(false);
      expect(existsSync(join(movedRoot, "issue-14-shared-parent-failure.json"))).toBe(false);
      expect(readFileSync(join(movedRoot, "fixtures/base-ui-component/output.json"))).toEqual(oracleBefore);
      expect(temporaryFilesRecursively(outerRoot)).toEqual([]);
      expect(temporaryFilesRecursively(movedRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(outerRoot, { recursive: true, force: true });
      rmSync(movedRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("commits and cleans through a staging-directory rename while restoring cwd", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-staging-rename-");
    let recreatedStaging: string | undefined;
    let movedStaging: string | undefined;
    const workingDirectory = process.cwd();
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-staging-rename.tsgo.json");
      writeGeneratedJsonFiles(
        [{ path: destinationPath, value: { stagingRenameSafe: true } }],
        temporaryRoot,
        {
          beforeRename: ({ temporaryPath }) => {
            recreatedStaging = dirname(temporaryPath);
            movedStaging = `${recreatedStaging}-old`;
            renameSync(recreatedStaging, movedStaging);
            mkdirSync(recreatedStaging);
          },
        }
      );
      expect(process.cwd()).toBe(workingDirectory);
      expect(JSON.parse(readFileSync(destinationPath, "utf8"))).toEqual({ stagingRenameSafe: true });
      if (recreatedStaging === undefined || movedStaging === undefined) {
        throw new Error("Staging rename hook did not capture both staging paths");
      }
      expect(existsSync(movedStaging)).toBe(false);
      expect(temporaryFilesRecursively(recreatedStaging)).toEqual([]);
      expect(temporaryFilesRecursively(movedStaging)).toEqual([]);
    } finally {
      expect(process.cwd()).toBe(workingDirectory);
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans the anchored staging inode after it moves to another parent", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-cross-parent-stage-");
    const relocationParent = createTemporaryRoot("api-extractor-generated-cross-parent-target-");
    let recreatedStaging: string | undefined;
    let relocatedStaging: string | undefined;
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-cross-parent-stage.tsgo.json");
      writeGeneratedJsonFiles(
        [{ path: destinationPath, value: { crossParentStageSafe: true } }],
        temporaryRoot,
        {
          beforeRename: ({ temporaryPath }) => {
            recreatedStaging = dirname(temporaryPath);
            const relocatedPath = join(relocationParent, basename(recreatedStaging));
            relocatedStaging = relocatedPath;
            renameSync(recreatedStaging, relocatedPath);
            mkdirSync(recreatedStaging);
          },
        }
      );
      expect(JSON.parse(readFileSync(destinationPath, "utf8"))).toEqual({ crossParentStageSafe: true });
      if (recreatedStaging === undefined || relocatedStaging === undefined) {
        throw new Error("Cross-parent staging hook did not capture both staging paths");
      }
      // The replacement old pathname is not ours and must survive. Only the
      // verified stage inode moved to the other parent may be removed.
      expect(existsSync(recreatedStaging)).toBe(true);
      expect(temporaryFilesRecursively(recreatedStaging)).toEqual([]);
      expect(existsSync(relocatedStaging)).toBe(false);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      rmSync(relocationParent, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans the identity-stable staging directory after a renamed-stage failure", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-staging-failure-");
    let recreatedStaging: string | undefined;
    let movedStaging: string | undefined;
    const workingDirectory = process.cwd();
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-staging-failure.tsgo.json");
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: ({ temporaryPath }) => {
              recreatedStaging = dirname(temporaryPath);
              movedStaging = `${recreatedStaging}-old`;
              renameSync(recreatedStaging, movedStaging);
              mkdirSync(recreatedStaging);
              throw new Error("synthetic renamed-stage failure");
            },
          }
        )
      ).toThrow("synthetic renamed-stage failure");
      expect(process.cwd()).toBe(workingDirectory);
      expect(existsSync(destinationPath)).toBe(false);
      if (recreatedStaging === undefined || movedStaging === undefined) {
        throw new Error("Staging failure hook did not capture both staging paths");
      }
      expect(existsSync(movedStaging)).toBe(false);
      expect(temporaryFilesRecursively(recreatedStaging)).toEqual([]);
      expect(temporaryFilesRecursively(movedStaging)).toEqual([]);
    } finally {
      expect(process.cwd()).toBe(workingDirectory);
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans an allocated staging directory when post-mkdir identity validation fails", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-post-mkdir-");
    let recreatedStaging: string | undefined;
    let movedStaging: string | undefined;
    const workingDirectory = process.cwd();
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-post-mkdir.tsgo.json");
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            afterStagingDirectoryCreate: ({ stagingPath }) => {
              recreatedStaging = stagingPath;
              movedStaging = `${stagingPath}-old`;
              renameSync(stagingPath, movedStaging);
              mkdirSync(stagingPath);
            },
          }
        )
      ).toThrow(/staging path changed/u);
      expect(process.cwd()).toBe(workingDirectory);
      expect(existsSync(destinationPath)).toBe(false);
      if (recreatedStaging === undefined || movedStaging === undefined) {
        throw new Error("Post-mkdir hook did not capture both staging paths");
      }
      expect(existsSync(movedStaging)).toBe(false);
      expect(temporaryFilesRecursively(recreatedStaging)).toEqual([]);
      expect(temporaryFilesRecursively(movedStaging)).toEqual([]);
    } finally {
      expect(process.cwd()).toBe(workingDirectory);
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans a renamed staging directory after atomic commit failure", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-staging-rename-failure-");
    let recreatedStaging: string | undefined;
    let movedStaging: string | undefined;
    const workingDirectory = process.cwd();
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-staging-rename-commit-failure.tsgo.json");
      writeFileSync(destinationPath, JSON.stringify({ existing: true }));
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: ({ temporaryPath }) => {
              recreatedStaging = dirname(temporaryPath);
              movedStaging = `${recreatedStaging}-old`;
              renameSync(recreatedStaging, movedStaging);
              mkdirSync(recreatedStaging);
              unlinkSync(destinationPath);
              mkdirSync(destinationPath);
            },
          }
        )
      ).toThrow(/EISDIR|ENOTDIR/u);
      expect(process.cwd()).toBe(workingDirectory);
      if (recreatedStaging === undefined || movedStaging === undefined) {
        throw new Error("Staging commit-failure hook did not capture both staging paths");
      }
      expect(readdirSync(destinationPath)).toEqual([]);
      expect(existsSync(movedStaging)).toBe(false);
      expect(temporaryFilesRecursively(recreatedStaging)).toEqual([]);
      expect(temporaryFilesRecursively(movedStaging)).toEqual([]);
    } finally {
      expect(process.cwd()).toBe(workingDirectory);
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });

  it("cleans stable staging when the atomic rename itself fails", () => {
    const temporaryRoot = createTemporaryRoot("api-extractor-generated-rename-failure-");
    try {
      cpSync(fixtureRoot, temporaryRoot, { recursive: true });
      const destinationPath = join(temporaryRoot, "issue-14-conformance-rename-failure.json");
      const oraclePath = join(temporaryRoot, "base-ui-component", "output.json");
      const oracleBefore = readFileSync(oraclePath);
      writeFileSync(destinationPath, JSON.stringify({ existing: true }));
      expect(() =>
        writeGeneratedJsonFiles(
          [{ path: destinationPath, value: { shouldNotCommit: true } }],
          temporaryRoot,
          {
            beforeRename: () => {
              unlinkSync(destinationPath);
              mkdirSync(destinationPath);
            },
          }
        )
      ).toThrow(/EISDIR|ENOTDIR/u);
      expect(readdirSync(destinationPath)).toEqual([]);
      expect(readFileSync(oraclePath)).toEqual(oracleBefore);
      expect(temporaryFilesRecursively(temporaryRoot)).toEqual([]);
      expect(stagingDirectoriesFor(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
      for (const staging of stagingDirectoriesFor(temporaryRoot)) {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  });
});
