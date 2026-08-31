import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, realpath, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

/* oxlint-disable anti-slop/no-unknown-parameters -- filesystem and test-hook failures are normalized at the module boundary. */

/**
 * This writer protects ordinary local and CI runs from malformed paths,
 * symlink escapes, overlapping writers, and ordinary filesystem failures. It
 * does not claim to defend a checkout against a host process that continually
 * replaces paths while a batch is being written.
 */

export type ArtifactEvidence = "generated" | "reviewed" | "immutable-upstream";

export type ArtifactBatchItem = {
  readonly destination: string;
  readonly content: string | Uint8Array;
  readonly evidence: ArtifactEvidence;
};

export type ArtifactBatchRequest = {
  readonly outputRoot: string;
  readonly artifacts: readonly ArtifactBatchItem[];
};

export type ArtifactBatchFailureCategory =
  | "invalid-root"
  | "invalid-batch"
  | "invalid-destination"
  | "duplicate-destination"
  | "file-directory-conflict"
  | "unauthorized-evidence"
  | "immutable-oracle"
  | "symlink-escape"
  | "concurrent-write"
  | "interrupted"
  | "filesystem-unavailable"
  | "write-failed"
  | "original-state-not-restored"
  | "temporary-state-not-removed";

export type ArtifactBatchResult =
  | {
      readonly status: "success";
      readonly artifacts: readonly {
        readonly destination: string;
        readonly evidence: Exclude<ArtifactEvidence, "immutable-upstream">;
      }[];
    }
  | {
      readonly status: "failure";
      readonly error: {
        readonly category: ArtifactBatchFailureCategory;
        readonly message: string;
        readonly destination?: string;
        readonly recovery?: {
          readonly originalState: "restored" | "restored-after-retry" | "not-restored";
          readonly temporaryState: "removed" | "removed-after-retry" | "not-removed";
        };
      };
    };

type FileSystemError = Error & { readonly code?: string };

type PreparedArtifact = {
  readonly destination: string;
  readonly absolutePath: string;
  readonly content: string | Uint8Array;
  readonly evidence: Exclude<ArtifactEvidence, "immutable-upstream">;
  readonly existed: boolean;
};

type ArtifactIdentity = {
  readonly device: number | bigint;
  readonly inode: number | bigint;
};

type Backup = {
  readonly destinationPath: string;
  readonly backupPath: string;
  readonly destination: string;
};

export type ArtifactBatchWriterTestControls = {
  readonly maximumDurationMs?: number;
  readonly beforeArtifactWrite?: (artifact: {
    readonly index: number;
    readonly destination: string;
  }) => void | Promise<void>;
  readonly beforeRollbackRestore?: (artifact: { readonly destination: string }) => void | Promise<void>;
  readonly beforeTemporaryCleanup?: (state: {
    readonly kind: "transaction" | "lock";
  }) => void | Promise<void>;
};

class ArtifactBatchError extends Error {
  readonly category: ArtifactBatchFailureCategory;
  readonly destination: string | undefined;

  constructor(category: ArtifactBatchFailureCategory, message: string, destination?: string) {
    super(message);
    this.category = category;
    this.destination = destination;
  }
}

function isMissing(error: Error): error is FileSystemError {
  return "code" in error && error.code === "ENOENT";
}

function isAlreadyPresent(error: Error): error is FileSystemError {
  return "code" in error && error.code === "EEXIST";
}

type ArtifactBatchRecovery = NonNullable<
  Extract<ArtifactBatchResult, { readonly status: "failure" }>["error"]["recovery"]
>;

function failure(error: ArtifactBatchError, recovery?: ArtifactBatchRecovery): ArtifactBatchResult {
  const detail = { category: error.category, message: error.message };
  const context = error.destination === undefined ? detail : { ...detail, destination: error.destination };
  if (recovery === undefined) return { status: "failure", error: context };
  return { status: "failure", error: { ...context, recovery } };
}

function asBatchError(error: unknown, category: ArtifactBatchFailureCategory): ArtifactBatchError {
  if (error instanceof ArtifactBatchError) return error;
  const message =
    category === "filesystem-unavailable"
      ? "The artifact output root is not available for writing."
      : "The artifact batch could not be fully written.";
  return new ArtifactBatchError(category, message);
}

function normalizedDestination(destination: string): string {
  if (destination.length === 0 || isAbsolute(destination)) {
    throw new ArtifactBatchError(
      "invalid-destination",
      "Artifact destinations must be non-empty paths relative to the output root.",
      destination
    );
  }
  const normalized = normalize(destination).replaceAll("\\", "/");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new ArtifactBatchError(
      "invalid-destination",
      "Artifact destination escapes the output root.",
      destination
    );
  }
  if (normalized.split("/").some((part) => part.startsWith(".artifact-batch-"))) {
    throw new ArtifactBatchError(
      "invalid-destination",
      "Artifact destination uses a reserved writer path.",
      destination
    );
  }
  return normalized;
}

async function rootPath(outputRoot: string): Promise<string> {
  const requestedRoot = resolve(outputRoot);
  let rootEntry;
  try {
    rootEntry = await lstat(requestedRoot);
  } catch {
    throw new ArtifactBatchError("invalid-root", "The artifact output root does not exist.");
  }
  if (rootEntry.isSymbolicLink()) {
    throw new ArtifactBatchError("symlink-escape", "The artifact output root must not be a symlink.");
  }
  if (!rootEntry.isDirectory()) {
    throw new ArtifactBatchError("invalid-root", "The artifact output root must be a directory.");
  }
  return realpath(requestedRoot);
}

async function existingPath(path: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(path);
  } catch (error) {
    if (error instanceof Error && isMissing(error)) return undefined;
    throw error;
  }
}

async function assertSafeParentPath(
  root: string,
  destinationPath: string,
  destination: string
): Promise<void> {
  const parentRelative = relative(root, dirname(destinationPath));
  if (parentRelative.length === 0) return;
  let current = root;
  for (const part of parentRelative.split(sep)) {
    current = join(current, part);
    const entry = await existingPath(current);
    if (entry === undefined) return;
    if (entry.isSymbolicLink()) {
      throw new ArtifactBatchError(
        "symlink-escape",
        "Artifact destination passes through a symlink.",
        destination
      );
    }
    if (!entry.isDirectory()) {
      throw new ArtifactBatchError(
        "file-directory-conflict",
        "Artifact destination requires a directory where a file already exists.",
        destination
      );
    }
  }
}

async function immutableOracleIdentities(root: string): Promise<readonly ArtifactIdentity[]> {
  const identities: ArtifactIdentity[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".artifact-batch-")) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && entry.name === "output.json") {
        const identity = await stat(path);
        identities.push({ device: identity.dev, inode: identity.ino });
      }
    }
  };
  await visit(root);
  return identities;
}

function sameIdentity(left: ArtifactIdentity, right: ArtifactIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function writableEvidence(
  evidence: string,
  destination: string
): Exclude<ArtifactEvidence, "immutable-upstream"> {
  if (evidence === "immutable-upstream") {
    throw new ArtifactBatchError(
      "immutable-oracle",
      "Immutable upstream evidence cannot be written by the artifact batch writer.",
      destination
    );
  }
  if (evidence !== "generated" && evidence !== "reviewed") {
    throw new ArtifactBatchError(
      "unauthorized-evidence",
      "Artifact evidence classification is not authorized for generated output.",
      destination
    );
  }
  return evidence;
}

async function prepareBatch(request: ArtifactBatchRequest): Promise<{
  readonly root: string;
  readonly artifacts: readonly PreparedArtifact[];
}> {
  const root = await rootPath(request.outputRoot);
  if (request.artifacts.length === 0) {
    throw new ArtifactBatchError("invalid-batch", "An artifact batch must contain at least one artifact.");
  }

  const destinations = new Map<string, number>();
  const normalized = request.artifacts.map((artifact, index) => {
    const destination = normalizedDestination(artifact.destination);
    const evidence = writableEvidence(artifact.evidence, destination);
    const firstIndex = destinations.get(destination);
    if (firstIndex !== undefined) {
      throw new ArtifactBatchError(
        "duplicate-destination",
        `Artifact destination is repeated at entries ${firstIndex} and ${index}.`,
        destination
      );
    }
    destinations.set(destination, index);
    return {
      destination,
      content: artifact.content,
      evidence,
    };
  });

  const orderedDestinations = [...destinations.keys()].sort();
  for (const [index, destination] of orderedDestinations.entries()) {
    const next = orderedDestinations[index + 1];
    if (next?.startsWith(`${destination}/`)) {
      throw new ArtifactBatchError(
        "file-directory-conflict",
        "One artifact destination is also the parent directory of another artifact.",
        destination
      );
    }
  }

  const oracleIdentities = await immutableOracleIdentities(root);
  const existingIdentities: Array<{ readonly destination: string; readonly identity: ArtifactIdentity }> = [];
  const artifacts: PreparedArtifact[] = [];
  for (const { content, destination, evidence } of normalized) {
    const absolutePath = resolve(root, destination);
    const relativePath = relative(root, absolutePath);
    if (relativePath.length === 0 || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
      throw new ArtifactBatchError(
        "invalid-destination",
        "Artifact destination escapes the output root.",
        destination
      );
    }
    if (basename(absolutePath) === "output.json") {
      throw new ArtifactBatchError(
        "immutable-oracle",
        "Immutable upstream output.json evidence cannot be overwritten.",
        destination
      );
    }
    await assertSafeParentPath(root, absolutePath, destination);
    const entry = await existingPath(absolutePath);
    if (entry?.isSymbolicLink()) {
      throw new ArtifactBatchError(
        "symlink-escape",
        "Artifact destination must not be a symlink.",
        destination
      );
    }
    if (entry !== undefined && !entry.isFile()) {
      throw new ArtifactBatchError(
        "file-directory-conflict",
        "Artifact destination is not a regular file.",
        destination
      );
    }
    if (entry !== undefined) {
      const identity = { device: entry.dev, inode: entry.ino };
      if (oracleIdentities.some((oracle) => sameIdentity(identity, oracle))) {
        throw new ArtifactBatchError(
          "immutable-oracle",
          "Artifact destination aliases immutable upstream evidence.",
          destination
        );
      }
      const alias = existingIdentities.find((candidate) => sameIdentity(candidate.identity, identity));
      if (alias !== undefined) {
        throw new ArtifactBatchError(
          "duplicate-destination",
          `Artifact destination aliases ${alias.destination}.`,
          destination
        );
      }
      existingIdentities.push({ destination, identity });
    }
    artifacts.push({
      destination,
      absolutePath,
      content,
      evidence,
      existed: entry !== undefined,
    });
  }
  return { root, artifacts };
}

async function acquireLock(root: string): Promise<string> {
  const lockPath = join(root, ".artifact-batch-lock");
  try {
    await mkdir(lockPath);
    return lockPath;
  } catch (error) {
    if (error instanceof Error && isAlreadyPresent(error)) {
      throw new ArtifactBatchError(
        "concurrent-write",
        "Another artifact batch is already writing to this output root."
      );
    }
    throw error;
  }
}

async function ensureParentDirectories(
  root: string,
  destinationPath: string,
  createdDirectories: string[]
): Promise<void> {
  const parentRelative = relative(root, dirname(destinationPath));
  if (parentRelative.length === 0) return;
  let current = root;
  for (const part of parentRelative.split(sep)) {
    current = join(current, part);
    const entry = await existingPath(current);
    if (entry === undefined) {
      try {
        await mkdir(current);
        createdDirectories.push(current);
        continue;
      } catch (error) {
        if (!(error instanceof Error && isAlreadyPresent(error))) throw error;
      }
    }
    const currentEntry = await lstat(current);
    if (currentEntry.isSymbolicLink()) {
      throw new ArtifactBatchError(
        "symlink-escape",
        "Artifact destination passes through a symlink during the write."
      );
    }
    if (!currentEntry.isDirectory()) {
      throw new ArtifactBatchError(
        "file-directory-conflict",
        "Artifact destination parent changed into a file during the write."
      );
    }
  }
}

async function rollbackBatch(
  committed: readonly PreparedArtifact[],
  backups: readonly Backup[],
  createdDirectories: readonly string[],
  controls: ArtifactBatchWriterTestControls,
  deadline: number
): Promise<"restored" | "restored-after-retry"> {
  const retryRemovals: PreparedArtifact[] = [];
  const retryRestores: Backup[] = [];
  const retryDirectories: string[] = [];

  for (const artifact of [...committed].reverse()) {
    try {
      await rm(artifact.absolutePath, { force: true });
    } catch {
      retryRemovals.push(artifact);
    }
  }
  for (const backup of [...backups].reverse()) {
    if (retryRemovals.some((artifact) => artifact.absolutePath === backup.destinationPath)) {
      retryRestores.push(backup);
      continue;
    }
    try {
      await runControl(
        controls.beforeRollbackRestore?.({ destination: backup.destination }),
        deadline,
        backup.destination
      );
      await rm(backup.destinationPath, { force: true });
      await rename(backup.backupPath, backup.destinationPath);
    } catch {
      retryRestores.push(backup);
    }
  }
  for (const directory of [...createdDirectories].reverse()) {
    try {
      await rmdir(directory);
    } catch (error) {
      if (!(error instanceof Error && isMissing(error))) retryDirectories.push(directory);
    }
  }

  const retried = retryRemovals.length + retryRestores.length + retryDirectories.length > 0;
  try {
    for (const artifact of retryRemovals) await rm(artifact.absolutePath, { force: true });
    for (const backup of retryRestores) {
      await rm(backup.destinationPath, { force: true });
      await rename(backup.backupPath, backup.destinationPath);
    }
    for (const directory of retryDirectories) {
      try {
        await rmdir(directory);
      } catch (error) {
        if (!(error instanceof Error && isMissing(error))) throw error;
      }
    }
  } catch {
    const destination = retryRestores.at(-1)?.destination ?? retryRemovals.at(-1)?.destination;
    throw new ArtifactBatchError(
      "original-state-not-restored",
      "The artifact batch failed and the original destination could not be fully restored.",
      destination
    );
  }
  return retried ? "restored-after-retry" : "restored";
}

const defaultMaximumDurationMs = 30_000;

async function runControl(
  operation: void | Promise<void> | undefined,
  deadline: number,
  destination?: string
): Promise<void> {
  if (operation === undefined) return;
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new ArtifactBatchError(
      "interrupted",
      "The artifact batch did not complete within its allowed time.",
      destination
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ArtifactBatchError(
                "interrupted",
                "The artifact batch did not complete within its allowed time.",
                destination
              )
            ),
          remaining
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function writeBatch(
  request: ArtifactBatchRequest,
  controls: ArtifactBatchWriterTestControls
): Promise<ArtifactBatchResult> {
  const deadline = Date.now() + (controls.maximumDurationMs ?? defaultMaximumDurationMs);
  let prepared;
  try {
    prepared = await prepareBatch(request);
  } catch (error) {
    return failure(asBatchError(error, "invalid-batch"));
  }

  let lockPath: string;
  try {
    lockPath = await acquireLock(prepared.root);
  } catch (error) {
    return failure(asBatchError(error, "filesystem-unavailable"));
  }

  let transactionPath: string | undefined;
  const backups: Backup[] = [];
  const committed: PreparedArtifact[] = [];
  const createdDirectories: string[] = [];
  let result: ArtifactBatchResult;
  try {
    prepared = await prepareBatch(request);
    transactionPath = join(prepared.root, `.artifact-batch-${randomUUID()}`);
    const stagedPath = join(transactionPath, "staged");
    const backupPath = join(transactionPath, "backups");
    await mkdir(stagedPath, { recursive: true });
    await mkdir(backupPath);

    for (const [index, artifact] of prepared.artifacts.entries()) {
      await writeFile(join(stagedPath, String(index)), artifact.content, { flag: "wx" });
    }
    for (const [index, artifact] of prepared.artifacts.entries()) {
      if (!artifact.existed) continue;
      const path = join(backupPath, String(index));
      await rename(artifact.absolutePath, path);
      backups.push({
        destinationPath: artifact.absolutePath,
        backupPath: path,
        destination: artifact.destination,
      });
    }
    for (const [index, artifact] of prepared.artifacts.entries()) {
      await ensureParentDirectories(prepared.root, artifact.absolutePath, createdDirectories);
      try {
        await runControl(
          controls.beforeArtifactWrite?.({ index, destination: artifact.destination }),
          deadline,
          artifact.destination
        );
      } catch (error) {
        if (error instanceof ArtifactBatchError) throw error;
        throw new ArtifactBatchError(
          "write-failed",
          error instanceof Error ? error.message : "The artifact could not be written.",
          artifact.destination
        );
      }
      await rename(join(stagedPath, String(index)), artifact.absolutePath);
      committed.push(artifact);
    }

    try {
      await runControl(controls.beforeTemporaryCleanup?.({ kind: "transaction" }), deadline);
    } catch {
      // A recoverable first cleanup failure is retried through the real
      // filesystem operation below while the writer still owns the lock.
    }
    await rm(transactionPath, { recursive: true, force: true });
    transactionPath = undefined;
    result = {
      status: "success",
      artifacts: prepared.artifacts.map(({ destination, evidence }) => ({ destination, evidence })),
    };
  } catch (error) {
    const primary = asBatchError(error, "write-failed");
    try {
      const originalState = await rollbackBatch(committed, backups, createdDirectories, controls, deadline);
      result = failure(primary, { originalState, temporaryState: "removed" });
    } catch (rollbackError) {
      result = failure(asBatchError(rollbackError, "original-state-not-restored"), {
        originalState: "not-restored",
        temporaryState: "not-removed",
      });
    }
  }

  let cleanupFailed = false;
  let cleanupRetried = false;
  if (transactionPath !== undefined) {
    if (result.status === "failure" && result.error.recovery?.originalState === "not-restored") {
      // Backups are the last recoverable copy when restoration failed. Keep
      // them in the controlled root and report that temporary state remains.
      cleanupFailed = true;
    } else {
      try {
        try {
          await runControl(controls.beforeTemporaryCleanup?.({ kind: "transaction" }), deadline);
        } catch {
          cleanupRetried = true;
        }
        await rm(transactionPath, { recursive: true, force: true });
      } catch {
        cleanupFailed = true;
      }
    }
  }
  try {
    try {
      await runControl(controls.beforeTemporaryCleanup?.({ kind: "lock" }), deadline);
    } catch {
      cleanupRetried = true;
    }
    await rm(lockPath, { recursive: true, force: true });
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed && result.status === "success") {
    return failure(
      new ArtifactBatchError(
        "temporary-state-not-removed",
        "The artifact batch was written but temporary state remains."
      )
    );
  }
  if (result.status === "failure" && result.error.recovery !== undefined) {
    return {
      status: "failure",
      error: {
        ...result.error,
        recovery: {
          ...result.error.recovery,
          temporaryState: cleanupFailed ? "not-removed" : cleanupRetried ? "removed-after-retry" : "removed",
        },
      },
    };
  }
  return result;
}

/** Write a validated artifact batch without exposing transaction mechanics to callers. */
export function writeArtifactBatch(request: ArtifactBatchRequest): Promise<ArtifactBatchResult> {
  return writeBatch(request, {});
}

/** @internal Test-only fault injection at the writer seam. */
export function makeArtifactBatchWriterForTest(
  controls: ArtifactBatchWriterTestControls
): (request: ArtifactBatchRequest) => Promise<ArtifactBatchResult> {
  return (request) => writeBatch(request, controls);
}
