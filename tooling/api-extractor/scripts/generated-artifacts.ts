import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { issue14FixtureManifest } from "./fixture-catalog.ts";
import {
  appendError,
  asError,
  closeWorkerInput,
  terminateWorker,
  waitForWorkerEvent,
  waitForWorkerExit,
  workerError,
  writeWorkerMessage,
} from "./generated-artifact-protocol.ts";
import type { WorkerEventReader } from "./generated-artifact-protocol.ts";

/* oxlint-disable anti-slop/no-unknown-parameters -- private IPC values cross a JSON process boundary. */
/* oxlint-disable anti-slop/no-runtime-typeof -- runtime guards validate private pipe values before use. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- private IPC values are constrained at the process boundary. */

export const generatedArtifactFixtureDirectory = resolve(import.meta.dirname, "../test/fixtures");

export type GeneratedJsonFile = {
  readonly path: string;
  readonly value: unknown;
};

type FileSystemError = Error & { readonly code?: string };

type ImmutableOracle = {
  readonly path: string;
  readonly realPath: string;
  readonly device: number;
  readonly inode: number;
};

type DirectoryIdentity = {
  readonly path: string;
  readonly device: number;
  readonly inode: number;
};

type ArtifactWritePreflight = {
  readonly root: DirectoryIdentity;
  readonly oracles: readonly ImmutableOracle[];
  readonly stagingCandidates: readonly StagingPreflight[];
};

type StagingPreflight = {
  readonly stagingParent: DirectoryIdentity;
  readonly stagingParentDirectories: readonly DirectoryIdentity[];
};

type WorkerFile = {
  readonly path: string;
  readonly content: string;
  readonly index: number;
  readonly parentDirectories: readonly DirectoryIdentity[];
};

type WorkerRequest = {
  readonly root: DirectoryIdentity;
  readonly candidates: readonly StagingPreflight[];
  readonly oracles: readonly ImmutableOracle[];
  readonly files: readonly WorkerFile[];
};

const stableStagingParentCandidates = [tmpdir(), "/tmp", "/var/tmp"] as const;

function assertWorkerExecutable(): void {
  try {
    const executable = statSync(process.execPath);
    if (!executable.isFile()) {
      throw new Error(`Generated artifact worker executable is not a regular file: ${process.execPath}`);
    }
    accessSync(process.execPath, constants.X_OK);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Generated artifact worker executable")) {
      throw error;
    }
    throw new Error(`Generated artifact worker executable is unavailable: ${process.execPath}`, {
      cause: error,
    });
  }
}

/**
 * Narrow test seam for exercising a filesystem race after preflight and
 * before the atomic commit. Production callers leave it unset.
 */
export type GeneratedArtifactWriteHooks = {
  /**
   * Test-only seam invoked after an exclusive staging directory has been
   * allocated and anchored inside the isolated helper process.
   * Production callers leave it unset.
   */
  readonly afterStagingDirectoryCreate?: (context: { readonly stagingPath: string }) => void;
  readonly beforeRename?: (context: {
    readonly destinationPath: string;
    readonly temporaryPath: string;
    readonly file: GeneratedJsonFile;
  }) => void;
};

function oracleSet(fixtureDirectory: string): readonly ImmutableOracle[] {
  return issue14FixtureManifest.map(({ fixture }) => {
    const path = join(fixtureDirectory, fixture, "output.json");
    if (!existsSync(path)) {
      throw new Error(`Immutable Issue 14 oracle is missing: ${path}`);
    }
    const file = lstatSync(path);
    if (!file.isFile()) {
      throw new Error(`Immutable Issue 14 oracle is not a regular file: ${path}`);
    }
    const realPath = realpathSync(path);
    const identity = statSync(path);
    return { path, realPath, device: identity.dev, inode: identity.ino };
  });
}

function sameIdentity(
  destination: { readonly realPath: string; readonly device: number; readonly inode: number },
  oracle: ImmutableOracle
): boolean {
  return (
    destination.realPath === oracle.realPath ||
    (destination.device === oracle.device && destination.inode === oracle.inode)
  );
}

function isMissing(error: Error): error is FileSystemError {
  return "code" in error && error.code === "ENOENT";
}

function pathContains(parent: string, child: string): boolean {
  const relativePath = relative(parent, child).replaceAll("\\", "/");
  return (
    relativePath.length === 0 ||
    (relativePath !== ".." && !relativePath.startsWith("../") && !isAbsolute(relativePath))
  );
}

function nearestSharedAncestor(left: string, right: string): string {
  let current = left;
  while (!pathContains(current, right)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function sharedAncestorCanBeRenamed(left: string, right: string): boolean {
  const shared = nearestSharedAncestor(left, right);
  const parent = dirname(shared);
  if (parent === shared) return false;
  try {
    accessSync(parent, constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathChainCanBeRenamed(path: string): boolean {
  // A staging candidate is itself a directory entry in its parent.  Checking
  // only the nearest shared ancestor with the artifact root misses a
  // user-owned TMPDIR whose own entry can be moved independently.  Every
  // entry in the candidate's canonical path must therefore have a parent the
  // current process cannot replace; otherwise cleanup would depend on a
  // pathname that can become stale between mkdir and rename.
  let current = path;
  while (true) {
    const parent = dirname(current);
    if (parent === current) return false;
    try {
      accessSync(parent, constants.W_OK | constants.X_OK);
      return true;
    } catch {
      current = parent;
    }
  }
}

function secureParentDirectories(destinationPath: string): readonly DirectoryIdentity[] {
  const parentPath = dirname(destinationPath);
  const paths: string[] = [];
  let current = parentPath;
  while (true) {
    paths.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const identities: DirectoryIdentity[] = [];
  for (const path of paths.reverse()) {
    let file;
    try {
      file = lstatSync(path);
    } catch (error) {
      if (error instanceof Error && isMissing(error)) {
        throw new Error(`Generated Issue 14 artifact parent is missing: ${path}`);
      }
      throw error;
    }
    if (file.isSymbolicLink()) {
      throw new Error(`Generated Issue 14 artifact refuses symlinked parent: ${path}`);
    }
    if (!file.isDirectory()) {
      throw new Error(`Generated Issue 14 artifact parent is not a directory: ${path}`);
    }
    identities.push({ path, device: file.dev, inode: file.ino });
  }
  return identities;
}

function artifactRootIdentity(fixtureDirectory: string): DirectoryIdentity {
  const path = resolve(fixtureDirectory);
  let file;
  try {
    file = lstatSync(path);
  } catch (error) {
    if (error instanceof Error && isMissing(error)) {
      throw new Error(`Generated Issue 14 artifact root is missing: ${path}`);
    }
    throw error;
  }
  if (file.isSymbolicLink()) {
    throw new Error(`Generated Issue 14 artifact root must not be a symlink: ${path}`);
  }
  if (!file.isDirectory()) {
    throw new Error(`Generated Issue 14 artifact root is not a directory: ${path}`);
  }
  // Walk the root and all of its ancestors once so the root identity and its
  // later destination checks share the same no-symlink path policy.
  secureParentDirectories(join(path, ".generated-artifact-root-check"));
  return { path, device: file.dev, inode: file.ino };
}

function assertWithinArtifactRoot(root: DirectoryIdentity, destinationPath: string): void {
  const relativePath = relative(root.path, destinationPath).replaceAll("\\", "/");
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      `Generated Issue 14 artifact destination is outside the artifact root: ${destinationPath}`
    );
  }
}

function stableStagingParents(root: DirectoryIdentity): readonly StagingPreflight[] {
  const seen = new Set<string>();
  const candidates: StagingPreflight[] = [];
  for (const candidate of stableStagingParentCandidates) {
    let path: string;
    try {
      path = realpathSync(resolve(candidate));
    } catch (error) {
      if (error instanceof Error && isMissing(error)) continue;
      throw error;
    }
    // A staging directory must not be created inside the artifact-root tree.
    // A canonical candidate may, however, be the root's stable parent (for
    // example `/tmp` when a test copy is created below it); the exclusive
    // staging entry is a sibling of the root there, not part of the root.
    // Also reject a candidate whose nearest shared ancestor or own path chain
    // has a writable parent: replacing either independently would recreate
    // the stale-path leak before cleanup.
    const candidateIsInsideArtifactRoot = pathContains(root.path, path);
    const sharedReplaceable = sharedAncestorCanBeRenamed(path, root.path);
    const chainReplaceable = pathChainCanBeRenamed(path);
    if (seen.has(path) || candidateIsInsideArtifactRoot || sharedReplaceable || chainReplaceable) {
      continue;
    }
    seen.add(path);

    const stagingParentDirectories = secureParentDirectories(join(path, ".generated-artifact-staging-check"));
    const stagingParent = stagingParentDirectories.at(-1);
    if (stagingParent === undefined || stagingParent.device !== root.device) continue;
    candidates.push({ stagingParent, stagingParentDirectories });
  }
  if (candidates.length === 0) {
    throw new Error(
      "Generated Issue 14 artifacts require a canonical same-filesystem staging location outside the artifact-root tree."
    );
  }
  return candidates;
}

/**
 * Validate every generated destination before a caller starts extraction or
 * writes its first file.  The immutable set is the complete 116-fixture
 * `output.json` set, and both resolved paths and filesystem identity are
 * checked so symlink and hardlink aliases cannot truncate an oracle.
 */
export function assertSafeGeneratedArtifactDestinations(
  destinations: readonly string[],
  fixtureDirectory = generatedArtifactFixtureDirectory
): void {
  preflightGeneratedArtifactDestinations(destinations, fixtureDirectory);
}

function preflightGeneratedArtifactDestinations(
  destinations: readonly string[],
  fixtureDirectory: string
): ArtifactWritePreflight {
  const resolvedDestinations: string[] = [];
  const firstIndexByPath = new Map<string, number>();
  for (const [index, destination] of destinations.entries()) {
    const absolutePath = resolve(destination);
    const firstIndex = firstIndexByPath.get(absolutePath);
    if (firstIndex !== undefined) {
      throw new Error(
        `Generated Issue 14 artifact has a duplicate resolved destination: ${absolutePath} (entries ${firstIndex} and ${index}).`
      );
    }
    firstIndexByPath.set(absolutePath, index);
    resolvedDestinations.push(absolutePath);
  }
  const root = artifactRootIdentity(fixtureDirectory);
  const stagingCandidates = stableStagingParents(root);
  const stagingDevice = stagingCandidates[0]?.stagingParent.device;
  if (stagingDevice === undefined) {
    throw new Error(
      "Generated Issue 14 artifacts require a canonical same-filesystem staging location outside the artifact-root tree."
    );
  }
  const oracles = oracleSet(root.path);
  const existingDestinations: Array<ImmutableOracle> = [];
  for (const absolutePath of resolvedDestinations) {
    assertWithinArtifactRoot(root, absolutePath);
    const parentDirectories = secureParentDirectories(absolutePath);
    const destinationParent = parentDirectories.at(-1);
    if (destinationParent === undefined || destinationParent.device !== stagingDevice) {
      throw new Error(
        `Generated Issue 14 artifact destination must share a filesystem with staging: ${absolutePath}`
      );
    }
    if (basename(absolutePath) === "output.json") {
      throw new Error("Generated Issue 14 artifacts refuse to target immutable output.json.");
    }
    try {
      const file = lstatSync(absolutePath);
      if (file.isSymbolicLink()) {
        throw new Error(`Generated Issue 14 artifact refuses symlink destination: ${absolutePath}`);
      }
      if (!file.isFile()) {
        throw new Error(`Generated Issue 14 artifact destination is not a regular file: ${absolutePath}`);
      }
      const destinationIdentity = {
        realPath: realpathSync(absolutePath),
        device: statSync(absolutePath).dev,
        inode: statSync(absolutePath).ino,
      };
      if (oracles.some((oracle) => sameIdentity(destinationIdentity, oracle))) {
        throw new Error(
          `Generated Issue 14 artifact aliases immutable output.json by path or filesystem identity: ${absolutePath}`
        );
      }
      const existingDestination = existingDestinations.find(
        (candidate) =>
          candidate.device === destinationIdentity.device && candidate.inode === destinationIdentity.inode
      );
      if (existingDestination !== undefined) {
        throw new Error(
          `Generated Issue 14 artifact destination aliases another generated destination by filesystem identity: ${absolutePath} aliases ${existingDestination.path}`
        );
      }
      existingDestinations.push({
        path: absolutePath,
        realPath: destinationIdentity.realPath,
        device: destinationIdentity.device,
        inode: destinationIdentity.inode,
      });
    } catch (error) {
      if (error instanceof Error && isMissing(error)) continue;
      throw error;
    }
  }
  return { root, oracles, stagingCandidates };
}

/**
 * Write a complete generated-artifact batch only after validating all paths.
 * The filesystem work runs in a short-lived helper process. That process may
 * use its private cwd as an inode anchor while this caller remains free of
 * global cwd mutation, including when this function is called by a worker
 * thread or by concurrent callers.
 */
export function writeGeneratedJsonFiles(
  files: readonly GeneratedJsonFile[],
  fixtureDirectory = generatedArtifactFixtureDirectory,
  hooks: GeneratedArtifactWriteHooks = {}
): void {
  assertWorkerExecutable();
  const prepared = files.map((file) => ({
    file,
    path: resolve(file.path),
    content: `${JSON.stringify(file.value, null, 2)}\n`,
  }));
  const preflight = preflightGeneratedArtifactDestinations(
    prepared.map((file) => file.path),
    fixtureDirectory
  );
  let child: ReturnType<typeof spawn> | undefined;
  let reader: WorkerEventReader | undefined;
  let activeCommandId: number | undefined;
  let primaryError: Error | undefined;
  let helperClosed = false;
  let helperSpawnError: Error | undefined;
  try {
    const request: WorkerRequest = {
      root: preflight.root,
      candidates: preflight.stagingCandidates,
      oracles: preflight.oracles,
      files: prepared.map((entry, index) => ({
        path: entry.path,
        content: entry.content,
        index,
        parentDirectories: [preflight.root, ...secureParentDirectories(entry.path)],
      })),
    };
    child = spawn(process.execPath, [generatedArtifactWorkerScript], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "ignore"],
    });
    // `spawn` reports an unavailable executable asynchronously. The caller is
    // synchronous and blocks while reading the helper pipe, so install the
    // error sink before the first write and use the upfront executable check
    // below to surface the ordinary missing-executable case synchronously.
    child.once("error", (error) => {
      helperSpawnError = asError(error);
    });
    reader = { buffer: "" };
    const eventReader = reader;
    writeWorkerMessage(child, request);

    while (!helperClosed) {
      const event = waitForWorkerEvent(child, eventReader);
      if (event.kind === "error") throw workerError(event.error);
      if (event.kind === "done") {
        if (event.id !== prepared.length + 2) {
          throw new Error("Generated artifact worker returned an invalid completion id.");
        }
        closeWorkerInput(child);
        waitForWorkerExit(child, eventReader);
        helperClosed = true;
        break;
      }
      if (event.kind === "staging-ready") {
        if (event.id !== 1) throw new Error("Generated artifact worker returned an invalid staging id.");
        activeCommandId = event.id;
        let hookError: Error | undefined;
        try {
          hooks.afterStagingDirectoryCreate?.({ stagingPath: event.stagingPath });
        } catch (error) {
          hookError = error instanceof Error ? error : new Error(String(error));
        }
        writeWorkerMessage(
          child,
          hookError === undefined
            ? { id: event.id, kind: "continue" }
            : { id: event.id, kind: "fail", message: hookError.message }
        );
        activeCommandId = undefined;
        continue;
      }
      if (event.id !== event.index + 2) {
        throw new Error("Generated artifact worker returned an invalid rename id.");
      }
      const file = prepared[event.index];
      if (file === undefined) {
        throw new Error(`Generated artifact worker returned an invalid file index: ${event.index}`);
      }
      activeCommandId = event.id;
      let hookError: Error | undefined;
      try {
        hooks.beforeRename?.({
          destinationPath: event.destinationPath,
          temporaryPath: event.temporaryPath,
          file: file.file,
        });
      } catch (error) {
        hookError = error instanceof Error ? error : new Error(String(error));
      }
      writeWorkerMessage(
        child,
        hookError === undefined
          ? { id: event.id, kind: "continue" }
          : { id: event.id, kind: "fail", message: hookError.message }
      );
      activeCommandId = undefined;
    }
  } catch (error) {
    primaryError = helperSpawnError ?? (error instanceof Error ? error : new Error(String(error)));
  }

  let lifecycleError: Error | undefined;
  if (child !== undefined && !helperClosed) {
    if (activeCommandId !== undefined) {
      try {
        writeWorkerMessage(child, {
          id: activeCommandId,
          kind: "fail",
          message: "Generated artifact worker was aborted by its caller.",
        });
      } catch (error) {
        lifecycleError = asError(error);
      }
    }
    try {
      closeWorkerInput(child);
      waitForWorkerExit(child, reader ?? { buffer: "" });
      helperClosed = true;
    } catch (error) {
      lifecycleError = appendError(lifecycleError, asError(error));
      const terminationError = terminateWorker(child);
      if (terminationError !== undefined) {
        lifecycleError = appendError(lifecycleError, terminationError);
      } else {
        // A forced termination means the helper's finally path could not be
        // observed. Surface that loss of cleanup evidence even when the OS
        // did terminate the process successfully.
        lifecycleError = appendError(
          lifecycleError,
          new Error("Generated artifact worker was terminated before cleanup could be confirmed.")
        );
      }
    }
  }

  if (primaryError !== undefined) {
    if (lifecycleError !== undefined) {
      throw new AggregateError([primaryError, lifecycleError], primaryError.message, {
        cause: primaryError,
      });
    }
    throw primaryError;
  }
  if (lifecycleError !== undefined) throw lifecycleError;
}

const generatedArtifactWorkerScript = fileURLToPath(
  new URL("./generated-artifact-worker.ts", import.meta.url)
);

/** SHA-256 for persisted evidence fields that bind artifact bytes. */
export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
