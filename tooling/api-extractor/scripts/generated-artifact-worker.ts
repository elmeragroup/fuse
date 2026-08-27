import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
} from "node:fs";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

import {
  assertDestinationReservation,
  assertDestinationSnapshotUnchanged,
  assertTemporaryFileUnchanged,
  closeDescriptor,
  createArtifactTransaction,
  createTemporaryFile,
  discardTransactionBackups,
  recordCommittedDestination,
  removeTemporaryFile,
  rollbackTransaction,
  writeDescriptor,
} from "./generated-artifact-transaction.ts";
import type { ArtifactTransaction, TemporaryFile } from "./generated-artifact-transaction.ts";

/* oxlint-disable anti-slop/no-unknown-parameters -- private IPC values cross a JSON process boundary. */
/* oxlint-disable anti-slop/no-runtime-typeof -- runtime guards validate private IPC values before use. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- private IPC values are constrained at the process boundary. */

type FileSystemError = Error & { readonly code?: string };

type DirectoryIdentity = {
  readonly path: string;
  readonly device: number;
  readonly inode: number;
};

type StagingPreflight = {
  readonly stagingParent: DirectoryIdentity;
  readonly stagingParentDirectories: readonly DirectoryIdentity[];
};

type ImmutableOracle = {
  readonly path: string;
  readonly realPath: string;
  readonly device: number;
  readonly inode: number;
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

type WorkerCommand =
  | { readonly id: number; readonly kind: "continue" }
  | { readonly id: number; readonly kind: "fail"; readonly message: string };

type WorkerCommandEnvelope = {
  readonly id?: unknown;
  readonly kind?: unknown;
  readonly message?: unknown;
};

type WorkerError = {
  readonly message: string;
  readonly cleanup?: string;
};

type WorkerEvent =
  | {
      readonly kind: "staging-ready";
      readonly id: number;
      readonly stagingPath: string;
    }
  | {
      readonly kind: "before-rename";
      readonly id: number;
      readonly index: number;
      readonly destinationPath: string;
      readonly temporaryPath: string;
    }
  | { readonly kind: "done"; readonly id: number }
  | { readonly kind: "error"; readonly id: number; readonly error: WorkerError };

type WorkerLineReader = {
  readonly next: () => Promise<string>;
  readonly close: () => void;
};

type WorkerLineWaiter = {
  readonly resolve: (line: string) => void;
  readonly reject: (error: Error) => void;
};

type AnchoredStagingDirectory = DirectoryIdentity & {
  readonly descriptor: number;
  readonly parent: DirectoryIdentity;
};

function isMissing(error: Error): error is FileSystemError {
  return "code" in error && error.code === "ENOENT";
}

function isDirectoryIdentity(value: unknown): value is DirectoryIdentity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DirectoryIdentity>;
  return (
    typeof candidate.path === "string" &&
    typeof candidate.device === "number" &&
    typeof candidate.inode === "number"
  );
}

function createLineReader(): WorkerLineReader {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const queued: string[] = [];
  const waiters: WorkerLineWaiter[] = [];
  let closed = false;

  input.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter !== undefined) waiter.resolve(line);
    else queued.push(line);
  });
  input.on("close", () => {
    closed = true;
    for (const waiter of waiters.splice(0))
      waiter.reject(new Error("Generated artifact worker input closed."));
  });

  return {
    next: () => {
      const line = queued.shift();
      if (line !== undefined) return Promise.resolve(line);
      if (closed) return Promise.reject(new Error("Generated artifact worker input closed."));
      return new Promise<string>((resolveLine, rejectLine) =>
        waiters.push({ resolve: resolveLine, reject: rejectLine })
      );
    },
    close: () => {
      input.close();
      process.stdin.destroy();
    },
  };
}

async function readJsonLine<T>(reader: WorkerLineReader): Promise<T> {
  const line = await reader.next();
  try {
    return JSON.parse(line) as T;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Generated artifact worker received invalid JSON.");
    throw error;
  }
}

async function waitForCommand(reader: WorkerLineReader, id: number): Promise<WorkerCommand> {
  const command = await readJsonLine<unknown>(reader);
  if (typeof command !== "object" || command === null) {
    throw new Error("Generated artifact worker received an invalid command.");
  }
  const candidate = command as WorkerCommandEnvelope;
  if (candidate.id !== id) {
    throw new Error(
      `Generated artifact worker received an unexpected command id: ${formatCommandId(candidate.id)}`
    );
  }
  if (candidate.kind === "continue") return { id, kind: "continue" };
  if (candidate.kind === "fail" && typeof candidate.message === "string") {
    return { id, kind: "fail", message: candidate.message };
  }
  throw new Error("Generated artifact worker received an invalid command.");
}

function formatCommandId(id: unknown): string {
  if (typeof id === "string") return id;
  if (typeof id === "number") return id.toString();
  return "unknown";
}

async function emit(event: WorkerEvent): Promise<void> {
  const payload = `${JSON.stringify(event)}\n`;
  await new Promise<void>((resolveEvent, rejectEvent) => {
    process.stdout.write(payload, "utf8", (error) => {
      if (error === undefined || error === null) resolveEvent();
      else rejectEvent(error);
    });
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const serialized = JSON.stringify(error);
  return typeof serialized === "string" ? serialized : "<unknown error>";
}

function isCandidateAllocationFailure(error: Error): error is FileSystemError {
  if (!("code" in error)) return false;
  const code = (error as FileSystemError).code;
  return code !== undefined && ["EACCES", "EDQUOT", "ENOSPC", "EPERM", "EROFS"].includes(code);
}

function assertDirectoriesUnchanged(expected: readonly DirectoryIdentity[]): void {
  for (const directory of expected) {
    let current;
    try {
      current = lstatSync(directory.path);
    } catch (error) {
      if (error instanceof Error && isMissing(error)) {
        throw new Error(`Generated Issue 14 artifact parent disappeared: ${directory.path}`);
      }
      throw error;
    }
    if (current.isSymbolicLink()) {
      throw new Error(`Generated Issue 14 artifact refuses symlinked parent: ${directory.path}`);
    }
    if (!current.isDirectory()) {
      throw new Error(`Generated Issue 14 artifact parent is not a directory: ${directory.path}`);
    }
    if (current.dev !== directory.device || current.ino !== directory.inode) {
      throw new Error(`Generated Issue 14 artifact parent changed during write: ${directory.path}`);
    }
  }
}

function assertOraclesUnchanged(oracles: readonly ImmutableOracle[]): void {
  for (const oracle of oracles) {
    let current;
    try {
      current = lstatSync(oracle.path);
    } catch (error) {
      if (error instanceof Error && isMissing(error)) {
        throw new Error(`Generated Issue 14 immutable oracle disappeared: ${oracle.path}`);
      }
      throw error;
    }
    if (!current.isFile() || current.isSymbolicLink()) {
      throw new Error(`Generated Issue 14 immutable oracle changed type: ${oracle.path}`);
    }
    const identity = statSync(oracle.path);
    if (identity.dev !== oracle.device || identity.ino !== oracle.inode) {
      throw new Error(`Generated Issue 14 immutable oracle identity changed: ${oracle.path}`);
    }
  }
}

function combineErrors(primary: Error, cleanup: Error): WorkerError {
  return {
    message: primary.message || "Generated Issue 14 artifact operation failed.",
    cleanup: cleanup.message,
  };
}

function serializedError(primary: unknown, cleanup?: unknown): WorkerError {
  const primaryError = primary instanceof Error ? primary : new Error(errorMessage(primary));
  if (cleanup === undefined) return { message: primaryError.message };
  const cleanupError = cleanup instanceof Error ? cleanup : new Error(errorMessage(cleanup));
  return combineErrors(primaryError, cleanupError);
}

function removeStagingFromCurrentParent(
  staging: DirectoryIdentity,
  expectedParent?: DirectoryIdentity
): void {
  const currentParent = lstatSync(".");
  if (
    currentParent.isSymbolicLink() ||
    !currentParent.isDirectory() ||
    (expectedParent !== undefined &&
      (currentParent.dev !== expectedParent.device || currentParent.ino !== expectedParent.inode))
  ) {
    throw new Error(
      `Generated Issue 14 staging parent changed during cleanup: ${expectedParent?.path ?? "<anchored parent>"}`
    );
  }
  const matches = readdirSync(".").filter((name) => {
    try {
      const candidate = lstatSync(name);
      return candidate.isDirectory() && candidate.dev === staging.device && candidate.ino === staging.inode;
    } catch {
      return false;
    }
  });
  if (matches.length !== 1) {
    throw new Error(
      `Generated Issue 14 artifact staging identity is not uniquely reachable for cleanup: ${staging.path}`
    );
  }
  const match = matches[0];
  if (match === undefined) {
    throw new Error(
      `Generated Issue 14 artifact staging identity is not reachable for cleanup: ${staging.path}`
    );
  }
  const beforeRemove = lstatSync(match);
  if (
    beforeRemove.isSymbolicLink() ||
    !beforeRemove.isDirectory() ||
    beforeRemove.dev !== staging.device ||
    beforeRemove.ino !== staging.inode
  ) {
    throw new Error(`Generated Issue 14 artifact staging replacement is not verified: ${staging.path}`);
  }

  // The child cwd is an inode anchor, but the staging entry may have moved to
  // another parent. Search that actual parent and remove only the entry whose
  // inode was captured immediately after mkdir. Opening and fstat'ing the
  // match narrows the symlink/replacement interval before rmdir. Node has no
  // descriptor-relative rmdir, however, so the final lexical lstat/rmdir
  // interval is not atomic: a non-cooperative actor can replace the entry
  // after the last check. Any mismatch observed before rmdir fails closed and
  // leaves the residue in place; this code does not claim to bind the later
  // pathname operation to the opened descriptor.
  const matchDescriptor = openSync(match, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(matchDescriptor);
    if (!opened.isDirectory() || opened.dev !== staging.device || opened.ino !== staging.inode) {
      throw new Error(`Generated Issue 14 artifact staging replacement is not verified: ${staging.path}`);
    }
    const latest = lstatSync(match);
    if (
      latest.isSymbolicLink() ||
      !latest.isDirectory() ||
      latest.dev !== staging.device ||
      latest.ino !== staging.inode
    ) {
      throw new Error(`Generated Issue 14 artifact staging replacement is not verified: ${staging.path}`);
    }
    rmdirSync(match);
  } finally {
    closeDescriptor(matchDescriptor);
  }
}

function cleanupStaging(staging: AnchoredStagingDirectory): void {
  // The child is synchronously anchored in the staging inode. `..` therefore
  // resolves to the actual current parent even if the entry was renamed and
  // its old name recreated while the parent process ran a deterministic test
  // hook. The final lstat/open/fstat/rmdir sequence is intentionally
  // synchronous and contains no await. Node exposes no descriptor-relative
  // rmdir, so this is a bounded lexical interval rather than an atomic
  // compare-and-remove. A replacement observed by the identity checks is
  // retained and reported; a replacement arriving after the final check is
  // outside the guarantee of this pathname-only primitive.
  let cleanupError: Error | undefined;
  try {
    process.chdir("..");
    removeStagingFromCurrentParent(staging);
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error(String(error));
  } finally {
    try {
      closeDescriptor(staging.descriptor);
    } catch (error) {
      const closeError = error instanceof Error ? error : new Error(String(error));
      cleanupError = cleanupError === undefined ? closeError : new AggregateError([cleanupError, closeError]);
    }
  }
  if (cleanupError !== undefined) throw cleanupError;
}

async function allocateStaging(
  request: WorkerRequest,
  originalWorkingDirectory: string,
  reader: WorkerLineReader
): Promise<AnchoredStagingDirectory> {
  for (const candidate of request.candidates) {
    let stageAnchored = false;
    let enteredStage = false;
    let stagePath: string | undefined;
    let allocated: DirectoryIdentity | undefined;
    let descriptor: number | undefined;
    let stage: AnchoredStagingDirectory | undefined;
    try {
      assertDirectoriesUnchanged(candidate.stagingParentDirectories);
      const parent = lstatSync(candidate.stagingParent.path);
      if (
        parent.isSymbolicLink() ||
        !parent.isDirectory() ||
        parent.dev !== candidate.stagingParent.device ||
        parent.ino !== candidate.stagingParent.inode
      ) {
        throw new Error(
          `Generated Issue 14 artifact staging parent changed during write: ${candidate.stagingParent.path}`
        );
      }

      // Enter the validated parent before allocation. This is an isolated
      // child process, so the cwd anchor cannot affect a caller or a sibling
      // writer. The random private name and the synchronous mkdir/lstat/open
      // sequence bound the pre-observation interval: there is no await or
      // caller-controlled hook before the first lstat. We do not claim that a
      // same-UID actor can be detected if it replaces the entry in that tiny
      // interval. Once the first identity is observed, descriptor fstat plus
      // the anchored-directory check reject later replacement races.
      process.chdir(candidate.stagingParent.path);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const name = `.${basename(request.root.path)}.generated-artifact-staging.${process.pid}.${randomUUID()}.tmp`;
        try {
          mkdirSync(name, 0o700);
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "EEXIST") continue;
          if (error instanceof Error && isCandidateAllocationFailure(error)) {
            stagePath = undefined;
            break;
          }
          throw error;
        }
        stagePath = join(candidate.stagingParent.path, name);
        const initial = lstatSync(name);
        if (initial.isSymbolicLink() || !initial.isDirectory()) {
          throw new Error(`Generated Issue 14 artifact staging path is not a directory: ${stagePath}`);
        }
        if (initial.dev !== request.root.device) {
          throw new Error(`Generated Issue 14 artifact staging is on a different filesystem: ${stagePath}`);
        }
        // The identity is captured immediately after mkdir, by the first
        // lstat. It is never treated as an identity known before allocation.
        allocated = { path: stagePath, device: initial.dev, inode: initial.ino };
        descriptor = openSync(name, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        const opened = fstatSync(descriptor);
        if (!opened.isDirectory() || opened.dev !== allocated.device || opened.ino !== allocated.inode) {
          throw new Error(
            `Generated Issue 14 artifact staging identity changed before anchoring: ${stagePath}`
          );
        }
        process.chdir(name);
        enteredStage = true;
        const anchored = lstatSync(".");
        if (
          anchored.isSymbolicLink() ||
          !anchored.isDirectory() ||
          anchored.dev !== allocated.device ||
          anchored.ino !== allocated.inode
        ) {
          throw new Error(`Generated Issue 14 artifact staging path changed before anchoring: ${stagePath}`);
        }
        stage = {
          path: stagePath,
          device: allocated.device,
          inode: allocated.inode,
          descriptor,
          parent: candidate.stagingParent,
        };
        stageAnchored = true;
        break;
      }
      if (stage === undefined || stagePath === undefined) {
        closeDescriptor(descriptor);
        descriptor = undefined;
        process.chdir(originalWorkingDirectory);
        continue;
      }

      await emit({ kind: "staging-ready", id: 1, stagingPath: stagePath });
      const command = await waitForCommand(reader, 1);
      if (command.kind === "fail") throw new Error(command.message);

      assertDirectoriesUnchanged(candidate.stagingParentDirectories);
      const current = lstatSync(stagePath);
      if (
        current.isSymbolicLink() ||
        !current.isDirectory() ||
        current.dev !== stage.device ||
        current.ino !== stage.inode
      ) {
        throw new Error(`Generated Issue 14 artifact staging path changed during write: ${stagePath}`);
      }
      return stage;
    } catch (error) {
      if (stage !== undefined && stageAnchored) {
        try {
          cleanupStaging(stage);
        } catch (cleanupError) {
          throw new Error(`${errorMessage(error)}; cleanup: ${errorMessage(cleanupError)}`);
        }
      } else {
        if (enteredStage) {
          try {
            process.chdir("..");
          } catch {
            // The parent identity check below remains fail-closed if this
            // anchored path was replaced before the descriptor check.
          }
        }
        closeDescriptor(descriptor);
        if (allocated !== undefined) {
          try {
            removeStagingFromCurrentParent(allocated, candidate.stagingParent);
          } catch (cleanupError) {
            throw new Error(`${errorMessage(error)}; cleanup: ${errorMessage(cleanupError)}`);
          }
        }
      }
      throw error;
    }
  }
  throw new Error("Could not allocate an available Issue 14 artifact staging directory.");
}

async function run(request: WorkerRequest, reader: WorkerLineReader): Promise<void> {
  const originalWorkingDirectory = process.cwd();
  let staging: AnchoredStagingDirectory | undefined;
  let primaryError: Error | undefined;
  let transaction: ArtifactTransaction | undefined;
  try {
    staging = await allocateStaging(request, originalWorkingDirectory, reader);
    transaction = createArtifactTransaction(request.files.map((file) => file.path));
    for (const file of request.files) {
      let descriptor: number | undefined;
      let temporary: TemporaryFile | undefined;
      const entry = transaction.entries[file.index];
      if (entry === undefined) {
        throw new Error(`Generated artifact worker received an invalid file index: ${file.index}`);
      }
      let entryError: Error | undefined;
      try {
        assertOraclesUnchanged(request.oracles);
        assertDirectoriesUnchanged(file.parentDirectories);
        temporary = createTemporaryFile(file.path);
        descriptor = temporary.fd;
        writeDescriptor(descriptor, file.content);
        await emit({
          kind: "before-rename",
          id: file.index + 2,
          index: file.index,
          destinationPath: file.path,
          temporaryPath: join(staging.path, temporary.name),
        });
        const command = await waitForCommand(reader, file.index + 2);
        if (command.kind === "fail") throw new Error(command.message);
        // The descriptor stays open over the caller hook. Revalidate both the
        // descriptor and the pathname immediately after that hook so a
        // deleted-and-recreated temporary entry cannot be committed.
        assertTemporaryFileUnchanged(temporary);
        assertDirectoriesUnchanged(file.parentDirectories);
        assertOraclesUnchanged(request.oracles);
        assertDestinationReservation(transaction, file.path);
        if (entry.initial.kind === "file") {
          if (entry.backup === undefined) {
            throw new Error(`Generated artifact worker has no backup for existing destination: ${file.path}`);
          }
          assertDestinationSnapshotUnchanged(file.path, entry.backup);
        }
        assertTemporaryFileUnchanged(temporary);
        assertDirectoriesUnchanged(file.parentDirectories);
        assertOraclesUnchanged(request.oracles);
        // Keep the ownership check immediately adjacent to the rename. The
        // helper has no await in this final interval, so a post-preflight
        // hardlink or case-fold alias is rejected before the path can be
        // replaced by this entry's bytes.
        assertDestinationReservation(transaction, file.path);
        const committedDevice = temporary.device;
        const committedInode = temporary.inode;
        closeSync(descriptor);
        descriptor = undefined;
        renameSync(temporary.name, file.path);
        recordCommittedDestination(transaction, file.path, {
          device: committedDevice,
          inode: committedInode,
        });
        temporary = undefined;
      } catch (error) {
        entryError = error instanceof Error ? error : new Error(String(error));
      }

      let cleanupError: Error | undefined;
      if (descriptor !== undefined) {
        try {
          closeSync(descriptor);
        } catch (error) {
          cleanupError = error instanceof Error ? error : new Error(String(error));
        }
      }
      if (temporary !== undefined) {
        try {
          removeTemporaryFile(temporary);
        } catch (error) {
          const current = error instanceof Error ? error : new Error(String(error));
          cleanupError = cleanupError === undefined ? current : new AggregateError([cleanupError, current]);
        }
      }
      if (entryError !== undefined) {
        primaryError =
          cleanupError === undefined
            ? entryError
            : new AggregateError([entryError, cleanupError], entryError.message, { cause: entryError });
        break;
      }
      if (cleanupError !== undefined) {
        primaryError = cleanupError;
        break;
      }
    }
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
  }

  if (primaryError !== undefined) {
    if (transaction !== undefined) {
      const rollbackError = rollbackTransaction(transaction);
      if (rollbackError !== undefined) {
        primaryError = new AggregateError([primaryError, rollbackError], primaryError.message, {
          cause: primaryError,
        });
      }
    }
  } else if (transaction !== undefined) {
    const backupCleanupError = discardTransactionBackups(transaction);
    if (backupCleanupError !== undefined) primaryError = backupCleanupError;
  }

  let cleanupError: Error | undefined;
  if (staging !== undefined) {
    try {
      cleanupStaging(staging);
    } catch (error) {
      cleanupError = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (primaryError !== undefined) {
    await emit({
      kind: "error",
      id: request.files.length + 3,
      error: serializedError(primaryError, cleanupError),
    });
  } else if (cleanupError !== undefined) {
    await emit({
      kind: "error",
      id: request.files.length + 3,
      error: serializedError(cleanupError),
    });
  } else {
    await emit({ kind: "done", id: request.files.length + 2 });
  }
}

async function main(): Promise<void> {
  const reader = createLineReader();
  try {
    const request = await readJsonLine<WorkerRequest>(reader);
    if (!isDirectoryIdentity(request.root))
      throw new Error("Generated artifact worker received an invalid root.");
    await run(request, reader);
  } catch (error) {
    try {
      await emit({
        kind: "error",
        id: 0,
        error: serializedError(error),
      });
    } catch {
      // The parent will surface a closed stdout pipe as a helper failure.
    }
    process.exitCode = 1;
  } finally {
    reader.close();
  }
}

if (process.argv[1]?.endsWith("generated-artifact-worker.ts")) void main();
